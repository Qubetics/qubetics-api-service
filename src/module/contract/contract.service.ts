import Web3 from 'web3';
import prisma from '../../lib/db';
import { GraphData, IESResponse } from '../../interfaces/index';
import {
	convertBigIntToNumber,
	serializeBigInt,
} from '../../helper/common.helper';
import { CONTRACT, CONTRACTLOGS, RES_MSG } from '../../constant/response';
import logger from '../../lib/logger';
import { RedisService } from '../../service';
import {
	cursorPagination,
	fillMissingDatesWithZeroByDay,
	fillMissingDatesWithZeroByMonth,
	fillMissingDatesWithZeroByhr,
	fillMissingMinutes,
	formatDate,
	formatDateByMin,
	formatDateForDay,
	formatDateForYear,
	parseAndFixJson,
} from '../../lib/utilities.helper';
import redisHelper from '../../service/redis.helper';
import moment from 'moment';

class ContractService {
	async getAllContract_(data: {
		page?: number;
		limit: number;
	}): Promise<IESResponse> {
		try {
			const isFirstPage = data.page === 1;

			const baseQuery = `SELECT "Contracts"."id", "Contracts"."creator", "Contracts"."address", "Contracts"."blockHash", "Contracts"."blockNumber",  "Contracts"."bytecodeHash", "Contracts"."txHash", "Contracts"."timestamp", "Contracts"."contractName" as tokenName, "Contracts"."contractType", "Contracts"."createdAt", "Contracts"."updatedAt", "ContractVerification"."contractname" as "contractname" , "Contracts"."contractName" as "contractName","ContractVerification"."verificationType", "ContractVerification"."iconUrl" FROM "Contracts" LEFT JOIN "ContractVerification" ON "Contracts"."address" = "ContractVerification"."contractAddress"`;

			const whereClause = isFirstPage
				? ''
				: `WHERE "Contracts"."id" < ${data.page} `;
			const orderLimitClause = `ORDER BY "Contracts"."createdAt" DESC
				 LIMIT ${data.limit}
				 `;
			const query = baseQuery + whereClause + orderLimitClause;
			const contracts: any = await prisma.$queryRawUnsafe(query);
			const nextCursor =
				contracts.length === data.limit
					? convertBigIntToNumber(contracts)[contracts.length - 1].id
					: null;
			const prevCursor = isFirstPage
				? null
				: data.page && contracts.length > 0
					? convertBigIntToNumber(contracts)[0].id + 11
					: null;

			if (!contracts?.length) throw new Error(RES_MSG.CONTRACT_NOT_FOUND);
			const contractCount = await prisma.contracts.count();

			const result = await prisma.contracts.groupBy({
				by: ['contractType'], // Group by the 'type' column
				_count: {
					contractType: true, // Count occurrences of each type
				},
			});
			console.log('contractTypeCount', result);

			// Loop through the result and filter each count

			const counts = result.reduce((acc: any, item) => {
				acc[item.contractType] = item._count.contractType;
				return acc;
			}, {});

			const {
				'ERC-20': erc20Count,
				'ERC-721': erc721Count,
				'ERC-777': erc777Count,
				'ERC-1155': erc1155Count,
				UNKNOWN: unknownCount,
			} = counts;

			return {
				error: false,
				message: RES_MSG.CONTRACT,
				data: {
					count: contractCount,
					contracts: convertBigIntToNumber(contracts),
					nextCursor,
					prevCursor,
					erc20Count: erc20Count ? Number(erc20Count) : 0,
					erc721Count: erc721Count ? Number(erc721Count) : 0,
					erc777Count: erc777Count ? Number(erc777Count) : 0,
					erc1155Count: erc1155Count ? Number(erc1155Count) : 0,
					unknownCount: unknownCount ? Number(unknownCount) : 0,
				},
			};
		} catch (err) {
			if (err instanceof Error) {
				logger.error(err);

				if (err.message.includes('prisma')) {
					return { error: true, message: RES_MSG.SERVER_ERROR };
				}
				return { error: true, message: err.message };
			} else {
				return { error: true, message: RES_MSG.ERROR };
			}
		}
	}

	async getContractIcon(data: {
		address: Array<string>;
	}): Promise<IESResponse> {
		try {
			const addresses = `(${data.address
				.map((address) => `'${address}'`)
				.join(', ')})`;
			const query = `SELECT "Contracts"."address", "ContractVerification"."iconUrl" FROM "Contracts"
			LEFT JOIN "ContractVerification" ON "Contracts"."address" = "ContractVerification"."contractAddress" WHERE "Contracts"."address" IN ${addresses}`;

			const contracts: any = await prisma.$queryRawUnsafe(query);

			if (!contracts?.length) throw new Error(RES_MSG.CONTRACT_NOT_FOUND);
			let result = contracts.reduce(
				(acc: any, { address, iconUrl }: any) => {
					acc[address] = iconUrl ? iconUrl : '';
					return acc;
				},
				{},
			);

			return {
				error: false,
				message: RES_MSG.CONTRACT,
				data: {
					images: result,
				},
			};
		} catch (err) {
			if (err instanceof Error) {
				logger.error(err);

				if (err.message.includes('prisma')) {
					return { error: true, message: RES_MSG.SERVER_ERROR };
				}
				return { error: true, message: err.message };
			} else {
				return { error: true, message: RES_MSG.ERROR };
			}
		}
	}

	async getContractByAddress(contractAddress: string): Promise<IESResponse> {
		try {
			const address = Web3.utils.toChecksumAddress(contractAddress);

			const contractData = await prisma.contracts.findFirst({
				where: {
					address,
				},
				select: {
					...CONTRACT,
					Tokens: {
						select: {
							decimal: true,
							totalSupply: true,
							tokenSymbol: true,
							tokenName: true,
						},
					},
					ContractVerification: {
						select: {
							contractname: true,
							iconUrl: true,
						},
					},
				},
			});

			const contractLogsCount = await prisma.contractLogs.count({
				where: { contractAddress: contractAddress },
			});

			let txCount;
			if (contractLogsCount === 0) {
				txCount = await prisma.transactions.count({
					where: { toAddress: contractAddress },
				});
			} else {
				txCount = contractLogsCount;
			}

			// Get updatedAt value only if contractType is 'UNKNOWN'
			// const updatedAt =
			// 	contractData?.contractType === 'UNKNOWN'
			// 		? (
			// 				await prisma.transactions.findFirst({
			// 					where: { toAddress: contractAddress },
			// 					select: { createdAt: true },
			// 				})
			// 			)?.createdAt ?? null
			// 		: undefined;
			const contractDataToSend = {
				...contractData,
				// updatedAt: updatedAt,
				decimal: contractData?.Tokens?.decimal ?? '',
				totalSupply: contractData?.Tokens?.totalSupply ?? '',
				symbol: contractData?.Tokens?.tokenSymbol ?? '',
				tokenName: contractData?.Tokens?.tokenName ?? '',
				txCount: txCount,
				contractName: contractData?.ContractVerification?.contractname
					? contractData?.ContractVerification?.contractname
					: contractData?.contractName,
			};
			delete contractDataToSend.Tokens;
			const contract = convertBigIntToNumber([contractDataToSend])[0];

			return {
				error: false,
				message: RES_MSG.CONTRACT,
				data: {
					contracts: contract,
				},
			};
		} catch (err) {
			if (err instanceof Error) {
				return { error: true, message: err.message };
			} else {
				return { error: true, message: RES_MSG.ERROR };
			}
		}
	}

	async getContractTransaction(data: {
		page: number;
		limit: number;
		contractAddress: string;
	}): Promise<IESResponse> {
		try {
			console.log(data.contractAddress, 'contractAddress');
			const [contractLogs, contractLogsCount] = await prisma.$transaction(
				[
					prisma.contractLogs.findMany({
						skip: data.page * data.limit,
						take: data.limit,
						orderBy: {
							createdAt: 'desc',
						},
						select: {
							...CONTRACTLOGS,
							transactions: {
								select: {
									toAddress: true,
									fromAddress: true,
								},
							},
						},
						where: {
							contractAddress: data.contractAddress,
							method: {
								not: 'transfer',
							},
						},
					}),
					prisma.contractLogs.count({
						where: {
							contractAddress: data.contractAddress,
						},
					}),
				],
			);

			console.log('contractLogs....................', contractLogs);

			if (!contractLogs?.length) {
				const [contractTx, contractTxCount] = await prisma.$transaction(
					[
						prisma.transactions.findMany({
							skip: data.page * data.limit,
							take: data.limit,
							orderBy: {
								createdAt: 'desc',
							},
							where: {
								toAddress: data.contractAddress,
							},
						}),
						prisma.transactions.count({
							where: {
								toAddress: data.contractAddress,
							},
						}),
					],
				);

				if (!contractTx?.length)
					throw new Error(RES_MSG.CONTRACT_TX_NOT_FOUND);

				return {
					error: false,
					message: RES_MSG.CONTRACT_TX,
					data: {
						count: contractTxCount,
						contracts: convertBigIntToNumber(contractTx).map(
							(item) => ({
								...item,
								txHash: item.txhash,
								blockNumber: item.blocknumber,
								method: item?.method
									? item.method
									: item?.methodSignature,
							}),
						),
					},
				};
			}
			const dataToSend: any = [];
			contractLogs.forEach((e: any) => {
				const data = {
					...e,
					toAddress: e?.transactions?.toAddress || '',
					fromAddress: e?.transactions?.fromAddress || '',
				};
				delete data.transactions;
				dataToSend.push(data);
			});

			return {
				error: false,
				message: RES_MSG.CONTRACT_TX,
				data: {
					count: contractLogsCount,
					contracts: convertBigIntToNumber(dataToSend),
				},
			};
		} catch (err) {
			if (err instanceof Error) {
				if (err.message.includes('prisma')) {
					return { error: true, message: RES_MSG.SERVER_ERROR };
				}
				return { error: true, message: err.message };
			} else {
				return { error: true, message: RES_MSG.ERROR };
			}
		}
	}

	async getContractTransfer(data: {
		page: number;
		limit: number;
		contractAddress: string;
	}): Promise<IESResponse> {
		try {
			const [contractLogs, contractLogsCount] = await prisma.$transaction(
				[
					prisma.contractLogs.findMany({
						skip: data.page * data.limit,
						take: data.limit,
						orderBy: {
							createdAt: 'desc',
						},
						where: {
							contractAddress: data.contractAddress,
							OR: [
								{ methodSignature: '0xddf252ad' },
								{ method: 'transfer' },
							],
						},
						select: {
							...CONTRACTLOGS,
							transactions: {
								select: {
									toAddress: true,
									fromAddress: true,
								},
							},
						},
					}),
					prisma.contractLogs.count({
						where: {
							contractAddress: data.contractAddress,
							OR: [
								{ methodSignature: '0xddf252ad' },
								{ method: 'transfer' },
							],
						},
					}),
				],
			);
			if (!contractLogs?.length) throw new Error(RES_MSG.NOT_FOUND);

			const dataToSend: any = [];
			contractLogs.forEach((e: any) => {
				const data = {
					...e,
					toAddress: e?.transactions?.toAddress || '',
					fromAddress: e?.transactions?.fromAddress || '',
				};
				delete data.transactions;
				dataToSend.push(data);
			});
			return {
				error: false,
				message: RES_MSG.CONTRACT_TX,
				data: {
					count: contractLogsCount,
					contracts: convertBigIntToNumber(dataToSend),
				},
			};
		} catch (err) {
			if (err instanceof Error) {
				if (err.message.includes('prisma')) {
					return { error: true, message: RES_MSG.SERVER_ERROR };
				}
				return { error: true, message: err.message };
			} else {
				return { error: true, message: RES_MSG.ERROR };
			}
		}
	}

	async getContractEvents(data: {
		page: number;
		limit: number;
		contractAddress: string;
	}): Promise<IESResponse> {
		try {
			const [contractLogs, contractLogsCount] = await prisma.$transaction(
				[
					prisma.$queryRaw`
					SELECT  
					c."id",
					c."txHash", 
					c."contractAddress",
					c."blockNumber",
					c."topics",
					c."logs",
					c."method",
					c."methodSignature", 
					c."createdAt",
					c."updatedAt",
					c."status",
					c."timestamp",
					d."logs" as decodedlogs, 
					d."input" as decodedinput 
				FROM 
					"ContractLogs" c
				LEFT JOIN 
					"DecodedLogs" d
				ON 
					d."txHash" = c."txHash" 
				WHERE 
					c."contractAddress" = ${data.contractAddress} 
				ORDER BY 
					c."createdAt" DESC LIMIT ${data.limit}
					OFFSET ${data.page * data.limit};`,
					prisma.contractLogs.count({
						where: {
							contractAddress: data.contractAddress,
						},
					}),
				],
			);
			if (!contractLogs) throw new Error(RES_MSG.NOT_FOUND);
			return {
				error: false,
				message: RES_MSG.CONTRACT_TX,
				data: {
					count: contractLogsCount,
					contracts: convertBigIntToNumber(contractLogs),
				},
			};
		} catch (err) {
			logger.error('error inside getContractEvents : ', err);
			if (err instanceof Error) {
				if (err.message.includes('prisma')) {
					return { error: true, message: RES_MSG.SERVER_ERROR };
				}
				return { error: true, message: err.message };
			} else {
				return { error: true, message: RES_MSG.ERROR };
			}
		}
	}

	async getInternalTx(data: {
		page: number;
		limit: number;
		contractAddress: string;
	}): Promise<IESResponse> {
		try {
			const [contractLogs, contractLogsCount] = await prisma.$transaction(
				[
					prisma.contractLogs.findMany({
						skip: data.page * data.limit,
						take: data.limit,
						orderBy: {
							createdAt: 'desc',
						},
						where: {
							contractAddress: data.contractAddress,
						},
					}),
					prisma.contractLogs.count({
						where: {
							contractAddress: data.contractAddress,
						},
					}),
				],
			);
			if (!contractLogs?.length)
				throw new Error(RES_MSG.CONTRACT_TX_NOT_FOUND);
			return {
				error: false,
				message: RES_MSG.CONTRACT_TX,
				data: {
					count: contractLogsCount,
					contracts: convertBigIntToNumber(contractLogs),
				},
			};
		} catch (err) {
			logger.error('error inside getInternalTx : ', err);

			if (err instanceof Error) {
				if (err.message.includes('prisma')) {
					return { error: true, message: RES_MSG.SERVER_ERROR };
				}
				return { error: true, message: err.message };
			} else {
				return { error: true, message: RES_MSG.ERROR };
			}
		}
	}

	async getPopularTx(data: {
		page: number;
		limit: number;
	}): Promise<IESResponse> {
		try {
			const dbData = await prisma.contracts.findMany({
				where: {
					OR: [
						{ contractType: 'ERC-20' },
						{ contractType: 'ERC-721' },
					],
				},
				orderBy: {
					createdAt: 'desc',
				},
			});

			const dataToReturn: any[] = [];

			for (let i = 0; i < dbData.length; i++) {
				const element = dbData[i];
				const count = await prisma.contractLogs.count({
					where: {
						contractAddress: element.address,
					},
				});

				if (count > 0) {
					dataToReturn.push({
						...element,
						count,
					});
				}
			}

			const startIndex = data.page * data.limit;
			const endIndex = startIndex + data.limit;
			const paginatedResults = dataToReturn.slice(startIndex, endIndex);

			if (!paginatedResults?.length) {
				throw new Error(RES_MSG.NOT_FOUND);
			}

			const sortedContracts = paginatedResults.sort(
				(a, b) => b.count - a.count,
			);

			return {
				error: false,
				message: RES_MSG.POPULAR_TX_SUCCESS,
				data: {
					totalCount: dataToReturn.length,
					contracts: convertBigIntToNumber(sortedContracts),
				},
			};
		} catch (err) {
			logger.error('error in getPopularTx : ', err);

			if (err instanceof Error) {
				if (err.message.includes('prisma')) {
					return { error: true, message: RES_MSG.SERVER_ERROR };
				}
				return { error: true, message: err.message };
			} else {
				return { error: true, message: RES_MSG.ERROR };
			}
		}
	}

	async getContractsTokens_(data: {
		page: number;
		limit: number;
		contractName: string;
	}): Promise<IESResponse> {
		try {
			const [
				contractData,
				tokensData,
				contractCount,
				tokenCount,
				verifiedContracts,
				verifiedContractCount,
			] = await Promise.all([
				prisma.contracts.findMany({
					skip: data.page * data.limit,
					take: data.limit,
					orderBy: {
						createdAt: 'desc',
					},
					select: {
						contractName: true,
						contractType: true,
						address: true,
						createdAt: true,
						updatedAt: true,
						timestamp: true,
						blockHash: true,
						blockNumber: true,
						creator: true,
						txHash: true,
						id: true,
						ContractVerification: {
							select: {
								contractname: true,
								verificationType: true,
							},
						},
					},

					where: {
						address: {
							contains: data.contractName,
							mode: 'insensitive',
						},
					},
				}),
				prisma.tokens.findMany({
					skip: data.page * data.limit,
					take: data.limit,
					orderBy: {
						createdAt: 'desc',
					},

					where: {
						OR: [
							{
								tokenName: {
									contains: data.contractName,
									mode: 'insensitive',
								},
							},
							{
								tokenSymbol: {
									contains: data.contractName,
									mode: 'insensitive',
								},
							},
							{
								contractAddress: {
									contains: data.contractName,
									mode: 'insensitive',
								},
							},
						],
					},
				}),
				prisma.contracts.count({
					where: {
						address: {
							contains: data.contractName,
							mode: 'insensitive',
						},
					},
				}),
				prisma.tokens.count({
					where: {
						OR: [
							{
								tokenName: {
									contains: data.contractName,
									mode: 'insensitive',
								},
							},
							{
								tokenSymbol: {
									contains: data.contractName,
									mode: 'insensitive',
								},
							},
							{
								contractAddress: {
									contains: data.contractName,
									mode: 'insensitive',
								},
							},
						],
					},
				}),
				prisma.contractVerification.findMany({
					skip: data.page * data.limit,
					take: data.limit,
					orderBy: {
						createdAt: 'desc',
					},
					where: {
						OR: [
							{
								contractAddress: {
									contains: data.contractName,
									mode: 'insensitive',
								},
							},
							{
								contractname: {
									contains: data.contractName,
									mode: 'insensitive',
								},
							},
						],
					},
					select: {
						contractAddress: true,
						contractname: true,
						verificationType: true,
						iconUrl: true,
						Contracts: {
							select: {
								contractName: true,
								contractType: true,
								address: true,
								createdAt: true,
								updatedAt: true,
								timestamp: true,
								blockHash: true,
								blockNumber: true,
								creator: true,
								txHash: true,
								id: true,
							},
						},
					},
				}),

				prisma.contractVerification.count({
					where: {
						OR: [
							{
								contractAddress: {
									contains: data.contractName,
									mode: 'insensitive',
								},
							},
							{
								contractname: {
									contains: data.contractName,
									mode: 'insensitive',
								},
							},
						],
					},
				}),
			]);

			let contractListing: any;
			let getTotalTokens: any;
			let contractCounting: number;
			console.log(contractData, '--contractData--');
			console.log(verifiedContracts, '--verifiedContracts--');
			console.log(tokensData, '--tokensData--');

			if (tokensData) {
				getTotalTokens = await Promise.all(
					tokensData.map(async (token: any) => {
						const holdersCount = await prisma.holders.count({
							where: {
								contractAddress: token.contractAddress,
							},
						});

						token.holders = holdersCount; // Add the holders count to the token
						return token; // Return the modified token
					}),
				);
			}

			if (
				Array.isArray(contractData) &&
				contractData.length === 0 &&
				verifiedContracts.length > 0
			) {
				console.log('FROM VERIFICATION');
				contractListing = await Promise.all(
					verifiedContracts.map(async (item: any) => ({
						...item,
						address: item?.Contracts?.address,
						transaction_count: await this.getContractTxCount(
							item?.Contracts?.address,
						),
						updatedAt: item?.Contracts?.updatedAt,
						createdAt: item.Contracts?.createdAt,
						contractName: item?.Contracts?.contractName,
						contractType: item.Contracts?.contractType,
						timestamp: item?.Contracts?.timestamp,
						blockNumber: item.Contracts.blockNumber.toString(),
						blockHash: item?.Contracts?.blockHash,
						creator: item.Contracts?.creator,
						txHash: item?.Contracts?.txHash,
						id: item?.Contracts?.id,

						Contracts: {
							...item.Contracts,
							blockNumber: item.Contracts.blockNumber.toString(), // Convert BigInt to string
						},
					})),
				);

				contractCounting = verifiedContractCount;

				console.log(
					'contractListing-VERIFICATION',
					convertBigIntToNumber(contractListing),
				);
			} else {
				console.log('FROM CONTRACTS');
				contractListing = contractData.map((item: any) => ({
					...item,
					contractname: item?.ContractVerification?.contractname,
					verificationType:
						item?.ContractVerification?.verificationType,
				}));

				contractCounting = contractCount;
				console.log('contractListing-CONTRACTS', contractListing);
			}
			const getContractsCount: any = await this.getContractsCount();
			console.log('getContractsCount', getContractsCount);
			const {
				'ERC-20': erc20Count,
				'ERC-721': erc721Count,
				'ERC-777': erc777Count,
				'ERC-1155': erc1155Count,
				UNKNOWN: unknownCount,
				count,
			} = getContractsCount.counts;

			console.log(getContractsCount.counts, 'getContractsCount.counts');

			return {
				error: false,
				message: RES_MSG.CONTRACT,
				data: {
					contracts: contractListing
						? convertBigIntToNumber(contractListing)
						: [],
					tokens: getTotalTokens
						? convertBigIntToNumber(getTotalTokens)
						: [],
					contractCount: contractCounting || 0,
					tokenCount: tokenCount || 0,
					erc20Count: erc20Count ? Number(erc20Count) : 0,
					erc721Count: erc721Count ? Number(erc721Count) : 0,
					erc777Count: erc777Count ? Number(erc777Count) : 0,
					erc1155Count: erc1155Count ? Number(erc1155Count) : 0,
					unknownCount: unknownCount ? Number(unknownCount) : 0,
					count: count ? Number(count) : 0,
				},
			};
		} catch (err) {
			logger.error('Error Log:: getContractsTokens_', err);
			if (err instanceof Error) {
				return { error: true, message: err.message };
			}
			return { error: true, message: RES_MSG.ERROR };
		}
	}

	async getContractTxCount(data: { contractAddress: string }) {
		try {
			const contractLogsCount = await prisma.contractLogs.count({
				where: { contractAddress: data.contractAddress },
			});

			let txCount;
			if (contractLogsCount === 0) {
				txCount = await prisma.transactions.count({
					where: { toAddress: data.contractAddress },
				});
			} else {
				txCount = contractLogsCount;
			}
			if (contractLogsCount) {
				return contractLogsCount;
			}
			return false;
		} catch (err) {
			logger.error('error inside getContractTxCount : ', err);
			if (err instanceof Error) {
				if (err.message.includes('prisma')) {
					return { error: true, message: RES_MSG.SERVER_ERROR };
				}
				return { error: true, message: err.message };
			} else {
				return { error: true, message: RES_MSG.ERROR };
			}
		}
	}

	async getContractsCount() {
		try {
			const result: any = await prisma.$queryRaw`
  SELECT "contractType", COUNT(*) as "_count", SUM(COUNT(*)) OVER() as "totalCount" FROM "Contracts"  GROUP BY "Contracts"."contractType"`;
			console.log('result', result[0].totalCount);

			const counts = result.reduce((acc: any, item: any) => {
				console.log('item_____', item.totalCount);
				acc[item.contractType] = item._count;
				return acc;
			}, {});

			counts.count = result[0].totalCount;
			const {
				'ERC-20': erc20Count,
				'ERC-721': erc721Count,
				'ERC-777': erc777Count,
				'ERC-1155': erc1155Count,
				UNKNOWN: unknownCount,
				count: count,
			} = counts;
			console.log('counts-----', counts);

			return { counts };
		} catch (err) {
			logger.error('error inside getContractsCount : ', err);
			return false;
		}
	}

	async getAllContract(data: {
		page: number;
		limit: number;
		order: any;
	}): Promise<IESResponse> {
		try {
			let isLimitFullFilled = true;
			const isFirstPage = data.page === 1;
			let maxId: any = 0;
			let minId: any = 0;
			let contracts = await prisma.contracts.findMany({
				select: {
					id: true,
					creator: true,
					address: true,
					blockHash: true,
					blockNumber: true,
					bytecodeHash: true,
					txHash: true,
					timestamp: true,
					contractName: true,
					contractType: true,
					createdAt: true,
					updatedAt: true,
					ContractVerification: {
						select: {
							contractname: true,
							verificationType: true,
							iconUrl: true,
						},
					},
				},
				orderBy: {
					id: data.order,
				},
				where: isFirstPage
					? {}
					: {
							id:
								data.order === 'asc'
									? { gt: data.page }
									: { lt: data.page },
						},
				take: data.limit,
			});
			if (!contracts?.length) throw new Error(RES_MSG.CONTRACT_NOT_FOUND);

			const contractCount = await prisma.contracts.aggregate({
				_count: { id: true },
				_min: { id: true },
				_max: { id: true },
			});

			const totalContracts: number = contractCount?._count.id;
			const minimumId: number = Number(contractCount?._min.id);
			const maximumId: number = Number(contractCount?._max.id);

			const getLastId = await prisma.contracts.findMany({
				select: {
					id: true, // Replace 'id' with your desired column
				},
				orderBy: {
					id: 'asc',
				},
				where: {
					id: {
						gt: minimumId,
					},
				},
				take: totalContracts % data.limit || data.limit,
			});

			const groupByResult = await prisma.contracts.groupBy({
				by: ['contractType'], // Group by the 'type' column
				_count: {
					contractType: true, // Count occurrences of each type
				},
			});

			const counts = groupByResult.reduce((acc: any, item) => {
				acc[item.contractType] = item._count.contractType;
				return acc;
			}, {});

			const {
				'ERC-20': erc20Count,
				'ERC-721': erc721Count,
				'ERC-777': erc777Count,
				'ERC-1155': erc1155Count,
				UNKNOWN: unknownCount,
			} = counts;

			// const offset = totalContracts % data.limit || data.limit;
			// const lastPage =
			// 	data.order === 'asc'
			// 		? maximumId - offset
			// 		: getLastId[getLastId.length - 1].id;

			// const sortedResults =
			// 	data.order === 'asc' ? contracts.reverse() : contracts;
			const cursorPages = cursorPagination(
				contracts,
				data.order,
				'',
				data.limit,
				'id',
				totalContracts,
				maximumId,
				minimumId,
			);

			const sortedResults = cursorPages?.sortedResults
				? cursorPages?.sortedResults
				: contracts;

			const contractData = await Promise.all(
				sortedResults.map(async (item: any) => ({
					...item,
					tokenName: item.contractName, // Alias for "contractName"
					contractname: item.ContractVerification?.contractname, // Alias for "ContractVerification.contractname"
					verificationType:
						item.ContractVerification?.verificationType,
					iconUrl: item.ContractVerification?.iconUrl,
				})),
			);

			return {
				error: false,
				message: RES_MSG.ALL_BLOCK_FETCH,
				data: {
					count: totalContracts,
					contracts: convertBigIntToNumber(contractData),
					// nextCursor: cursorPages.nextCursor,
					// prevCursor:
					// 	data.page === 0 || data.page === 1
					// 		? null
					// 		: cursorPages.previousCursor,
					nextCursor:
						data.page > 1 &&
						cursorPages.nextCursor === cursorPages.previousCursor
							? null
							: cursorPages.nextCursor,
					prevCursor:
						((data.page === 1 || data.page === 0 || !data.page) &&
							!data.order) ||
						cursorPages.nextCursor === cursorPages.previousCursor
							? null
							: cursorPages.previousCursor,
					lastPage: getLastId
						? getLastId[getLastId.length - 1].id
						: null,
					erc20Count: erc20Count ? Number(erc20Count) : 0,
					erc721Count: erc721Count ? Number(erc721Count) : 0,
					erc777Count: erc777Count ? Number(erc777Count) : 0,
					erc1155Count: erc1155Count ? Number(erc1155Count) : 0,
					unknownCount: unknownCount ? Number(unknownCount) : 0,
				},
			};
		} catch (err) {
			if (err instanceof Error) {
				logger.error(err);
				if (err.message.includes('prisma')) {
					return { error: true, message: RES_MSG.SERVER_ERROR };
				}
				return { error: true, message: err.message };
			}
			return { error: true, message: RES_MSG.ERROR };
		}
	}

	async getContractsTokens_2(data: {
		page: number;
		limit: number;
		order: string;
		contractName: string;
	}): Promise<any> {
		const { contractName, limit, page, order } = data;
		// Validate limit
		const parsedLimit = limit;

		try {
			const searchFilter: any = {
				OR: [
					{
						address: {
							contains: contractName,
							mode: 'insensitive',
						},
					},
					{
						contractName: {
							contains: contractName,
							mode: 'insensitive',
						},
					},
					{
						Tokens: {
							some: {
								tokenName: {
									contains: contractName,
									mode: 'insensitive',
								},
								contractAddress: {
									contains: contractName,
									mode: 'insensitive',
								},
								tokenSymbol: {
									contains: contractName,
									mode: 'insensitive',
								},
							},
						},
					},
					{
						ContractVerification: {
							is: {
								contractname: {
									contains: contractName,
									mode: 'insensitive',
								},
								contractAddress: {
									contains: contractName,
									mode: 'insensitive',
								},
							},
						},
					},
				],
			};

			// const { ...counterFilter } = searchFilter;
			const counterFilter = { ...searchFilter };

			console.log(counterFilter, 'counterFilter');
			let orderBy: string = 'desc';
			if (data?.order) {
				orderBy = data?.order.toString();
			}
			if (data.page && data.page > 1) {
				searchFilter.id =
					data.order === 'asc'
						? { gt: data.page }
						: { lt: data.page };
			}

			// Perform the query with cursor-based pagination
			console.log('searchFilter', searchFilter);
			const results: any = await Promise.all([
				prisma.contracts.findMany({
					where: searchFilter,
					select: {
						contractName: true,
						contractType: true,
						address: true,
						createdAt: true,
						updatedAt: true,
						timestamp: true,
						blockHash: true,
						blockNumber: true,
						creator: true,
						txHash: true,
						id: true,
						ContractVerification: {
							select: {
								contractAddress: true,
								contractname: true,
								verificationType: true,
								iconUrl: true,
							},
						},
						Tokens: {
							select: {
								creator: true,
								decimal: true,
								totalSupply: true,
								type: true,
								tokenName: true,
								tokenSymbol: true,
								contractAddress: true,
							},
						},
					},
					take: parsedLimit,
					// skip: page ? 1 : 0, // Skip the cursor for the next page
					// cursor: page ? { id: page } : undefined, // Use the cursor for pagination
					orderBy: {
						id: (data?.order === 'asc' || data?.order === 'desc'
							? data.order
							: 'desc') as 'asc' | 'desc',
					},
				}),
			]);

			const contractIdList = results.map((c: any) => c?.contract.id); // Extract IDs
			console.log('contractIdList', contractIdList);

			const resultCount = await prisma.contracts.aggregate({
				// where: counterFilter,
				where: { id: { in: contractIdList } }, // Now filtering using IDs
				_count: { id: true },
				_min: { id: true },
				_max: { id: true },
			});

			console.log('getContractsTokens Response', results, resultCount);

			if (!results.length) {
				return {
					data: {
						message: RES_MSG.DATA_NOT_FOUND,
						error: true,
					},
				};
			}
			const sortedResults =
				data.order === 'asc' ? results.reverse() : results;

			// Determine the first and last page from the search results
			// const firstContract = results[0].id || null;
			// const lastContract = results[results.length - 1] || null;

			const totalContracts = resultCount._count.id;
			const minimumId = resultCount._min.id;
			const maximumId = resultCount._max.id;

			const { ...lastPageFilter } = counterFilter;

			lastPageFilter.id = { gt: minimumId };
			let lastPageResult: any;
			if (totalContracts && totalContracts > parsedLimit) {
				console.log('lastPageResult');
				lastPageResult = await prisma.contracts.findMany({
					select: {
						id: true,
					},
					where: lastPageFilter,
					take: totalContracts % parsedLimit || parsedLimit,
				});
				console.log('lastPageResult1', lastPageResult);
			}

			const previousCursor =
				results[0].id === maximumId ? null : results[0].id;

			const nextCursor =
				results.length > 0 &&
				results[results.length - 1].id === minimumId
					? null
					: results[results.length - 1]?.id;

			const getContractsCount: any = await this.getContractsCount();
			const {
				'ERC-20': erc20Count,
				'ERC-721': erc721Count,
				'ERC-777': erc777Count,
				'ERC-1155': erc1155Count,
				UNKNOWN: unknownCount,
				count,
			} = getContractsCount.counts;

			const contractData = await Promise.all(
				sortedResults.map(async (item: any) => ({
					...item,
					transaction_count: await this.getContractTxCount(
						item?.address,
					),
					contractname:
						item?.ContractVerification?.contractname || '',
					verificationType:
						item?.ContractVerification?.verificationType || 0,
					iconUrl: item?.ContractVerification?.iconUrl || '',
					creator: item?.Tokens?.creator,
					decimal: item?.Tokens?.decimal,
					totalSupply: item?.Tokens?.totalSupply,
					type: item?.Tokens?.type,
					tokenName: item?.Tokens?.tokenName,
					tokenSymbol: item?.Tokens?.tokenSymbol,
					contractAddress: item?.Tokens?.contractAddress,
				})),
			);

			console.log('contractDataXX', contractData);
			return {
				error: false,
				message: RES_MSG.CONTRACT,
				data: {
					contracts: contractData
						? convertBigIntToNumber(contractData)
						: [],
					contractCount: totalContracts || 0,
					erc20Count: erc20Count ? Number(erc20Count) : 0,
					erc721Count: erc721Count ? Number(erc721Count) : 0,
					erc777Count: erc777Count ? Number(erc777Count) : 0,
					erc1155Count: erc1155Count ? Number(erc1155Count) : 0,
					unknownCount: unknownCount ? Number(unknownCount) : 0,
					count: count ? Number(count) : 0,
					nextCursor: nextCursor,
					prevCursor: previousCursor === 0 ? 1 : previousCursor,
					lastPage: lastPageResult
						? lastPageResult[lastPageResult.length - 1].id
						: null,
				},
			};
		} catch (err) {
			logger.error('Error Log:: getContractsTokens Error', err);
			return { error: true, message: RES_MSG.ERROR };
		}
	}

	async getContractsTokens(data: {
		page: number;
		limit: number;
		order: string;
		contractName: string;
	}): Promise<any> {
		const { contractName, limit, page, order } = data;
		// Validate limit
		const parsedLimit = limit;

		try {
			let selectContracts =
				'SELECT "c"."id", "c"."contractName", "c"."contractType", "c"."address", "c"."createdAt", "c"."updatedAt", "c"."timestamp", "c"."blockHash", "c"."blockNumber", "c"."creator", "c"."txHash", "cv"."contractAddress", "cv"."contractname", "cv"."verificationType", "cv"."iconUrl", "t"."creator", "t"."decimal", "t"."totalSupply","t"."type", "t"."tokenName", "t"."tokenSymbol", "t"."contractAddress", COUNT("h"."address") as holders ';
			let selectContractsForCount =
				'SELECT COUNT(c.id) AS count_id, MIN(c.id) AS min_id, MAX(c.id) AS max_id ';
			let lastPageSelect = ' SELECT (c.id) ';

			let joinFrom =
				'FROM "Contracts" AS "c" LEFT JOIN "ContractVerification" AS "cv" ON "cv"."contractAddress" = "c"."address" LEFT JOIN "Tokens" AS "t" ON "t"."contractAddress" = "c"."address" LEFT JOIN "Holders" as h ON "h"."contractAddress" = "t"."contractAddress"';

			let idFilter = '';
			let searchFilter = `
			    WHERE (("c"."contractName" ILIKE '%${contractName}%' OR "c"."address" ILIKE '%${contractName}%')
			    OR ("t"."tokenName" ILIKE '%${contractName}%' OR "t"."contractAddress" ILIKE '%${contractName}%' OR "t"."tokenSymbol" ILIKE '%${contractName}%')
			    OR ("cv"."contractname" ILIKE '%${contractName}%' OR "cv"."contractAddress" ILIKE '%${contractName}%'))`;

			let orderBy: string = 'desc';
			if (data?.order) {
				orderBy = data?.order.toString();
			}
			if (data.page && data.page > 1) {
				if (data.order === 'asc') {
					idFilter = ` AND "c"."id" > ${data.page}`;
				} else {
					idFilter = ` AND "c"."id" < ${data.page}`;
				}
			}

			console.log('idFilter', idFilter);

			// Perform the query with cursor-based pagination

			const whereClause = `${searchFilter} ${idFilter}`;
			console.log('whereClause', whereClause);

			const orderClause = ` ORDER BY "c"."id" ${orderBy} `;
			const limitClause = ` LIMIT ${parsedLimit}`;
			const groupByClause = ` GROUP BY "c"."id", "c"."contractName", "c"."contractType", "c"."address", "c"."createdAt", 
         "c"."updatedAt", "c"."timestamp", "c"."blockHash", "c"."blockNumber", "c"."creator", 
         "c"."txHash", "cv"."contractAddress", "cv"."contractname", "cv"."verificationType", 
         "cv"."iconUrl", "t"."creator", "t"."decimal", "t"."totalSupply", "t"."type", 
         "t"."tokenName", "t"."tokenSymbol", "t"."contractAddress"`;

			const queryContracts =
				selectContracts +
				joinFrom +
				whereClause +
				groupByClause +
				orderClause +
				limitClause;
			const resultCountQuery =
				selectContractsForCount + joinFrom + searchFilter;
			console.log('queryContracts', queryContracts);

			const results: any = await prisma.$queryRawUnsafe(queryContracts);
			const resultCount: any =
				await prisma.$queryRawUnsafe(resultCountQuery);

			console.log('getContractsTokens Response', results, resultCount);

			if (!results.length) {
				return {
					data: {
						message: RES_MSG.DATA_NOT_FOUND,
						error: true,
					},
				};
			}
			// const sortedResults =
			// 	data.order === 'asc' ? results.reverse() : results;

			// Determine the first and last page from the search results
			// const firstContract = results[0].id || null;
			// const lastContract = results[results.length - 1] || null;

			const totalContracts = Number(resultCount[0].count_id);
			const minimumId = resultCount[0].min_id;
			const maximumId = resultCount[0].max_id;

			const lastPageRemainder = totalContracts % Number(parsedLimit);
			const lastPageFilter = ` AND "c"."id" > ${minimumId}`;
			const lastPageCondition = `${searchFilter} ${lastPageFilter}`;
			const lastPageLimitCheck = lastPageRemainder
				? lastPageRemainder
				: parsedLimit;
			const lastPageLimit = ` LIMIT ${lastPageLimitCheck}`;

			const cursorPages: any = cursorPagination(
				results,
				orderBy,
				'',
				parsedLimit,
				'id',
				totalContracts,
				maximumId,
				minimumId,
			);

			console.log('cursorPages', cursorPages);

			let lastPageResult: any;
			// let orderClauseForLastPage = ` ORDER BY "c"."id" desc `;
			// if (totalContracts && totalContracts < parsedLimit) {
			// if (!data.order || data.order === 'desc') {
			// 	console.log('IN CHECKING');
			// }
			let orderClauseForLastPage = ` ORDER BY "c"."id" asc `;
			const lastPageQuery =
				lastPageSelect +
				joinFrom +
				lastPageCondition +
				orderClauseForLastPage +
				lastPageLimit;
			console.log('lastPageQuery', lastPageQuery);
			lastPageResult = await prisma.$queryRawUnsafe(lastPageQuery);

			console.log('lastPageResult', lastPageResult);
			// console.log(
			// 	'lastPageResult',
			// 	lastPageResult[lastPageResult.length - 1].id,
			// );
			// }

			// const previousCursor =
			// 	results[0].id === maximumId ? null : results[0].id;

			// const nextCursor =
			// 	results.length > 0 &&
			// 	results[results.length - 1].id === minimumId
			// 		? null
			// 		: results[results.length - 1]?.id;

			const getContractsCount: any = await this.getContractsCount();
			const {
				'ERC-20': erc20Count,
				'ERC-721': erc721Count,
				'ERC-777': erc777Count,
				'ERC-1155': erc1155Count,
				UNKNOWN: unknownCount,
				count,
			} = getContractsCount.counts;

			const contractData = await Promise.all(
				results.map(async (item: any) => ({
					...item,
					transaction_count: await this.getContractTxCount(
						item?.address,
					),
					contractname: item?.contractname || '',
					verificationType: item?.verificationType || 0,
					iconUrl: item?.iconUrl || '',
					creator: item?.creator,
					decimal: item?.decimal,
					totalSupply: item?.totalSupply,
					type: item?.type,
					tokenName: item?.tokenName,
					tokenSymbol: item?.tokenSymbol,
					contractAddress: item?.contractAddress,
				})),
			);

			console.log('contractDataXX', contractData);
			return {
				error: false,
				message: RES_MSG.CONTRACT,
				data: {
					contracts: cursorPages.sortedResults
						? convertBigIntToNumber(cursorPages.sortedResults)
						: [],
					contractCount: totalContracts || 0,
					erc20Count: erc20Count ? Number(erc20Count) : 0,
					erc721Count: erc721Count ? Number(erc721Count) : 0,
					erc777Count: erc777Count ? Number(erc777Count) : 0,
					erc1155Count: erc1155Count ? Number(erc1155Count) : 0,
					unknownCount: unknownCount ? Number(unknownCount) : 0,
					count: count ? Number(count) : 0,
					nextCursor:
						page > 1 &&
						cursorPages.nextCursor === cursorPages.previousCursor
							? null
							: cursorPages.nextCursor,
					prevCursor:
						((page === 1 || page === 0 || !page) && !data.order) ||
						cursorPages.nextCursor === cursorPages.previousCursor
							? null
							: cursorPages.previousCursor,
					lastPage: lastPageResult.length
						? lastPageResult[lastPageResult.length - 1].id
						: null,
				},
			};
		} catch (err) {
			logger.error('Error Log:: getContractsTokens Error', err);
			return { error: true, message: RES_MSG.ERROR };
		}
	}

	// async contractGraphs(data: {
	// 	interval: string;
	// 	days: string;
	// 	address: string;
	// }): Promise<any> {
	// 	const { address, interval = 'daily', days = 30 } = data;
	// 	// Validate limit
	// 	const cacheKey = `contract_graph_${address}_${interval}_${days}`;

	// 	try {
	// 		// Check Redis cache first
	// 		const cachedData = await redisHelper.getString(cacheKey);
	// 		if (cachedData) {
	// 			return {
	// 				error: false,
	// 				message: RES_MSG.TRANSACTION_FEE_SUCCESS,
	// 				data: {
	// 					finalData: cachedData as Array<GraphData>,
	// 					count: 0,
	// 				},
	// 			};
	// 		}

	// 		// Define time range
	// 		const startDate = new Date();
	// 		startDate.setDate(startDate.getDate() - days);

	// 		// Fetch analytics data grouped by timestamp
	// 		const transactions = await prisma.transactions.findMany({
	// 			where: {
	// 				toAddress: address,
	// 				timestamp: { gte: startDate },
	// 			},
	// 			select: {
	// 				fromAddress: true,
	// 				toAddress: true,
	// 				value: true,
	// 				timestamp: true,
	// 			},
	// 			orderBy: { timestamp: 'asc' },
	// 		});

	// 		// Process transactions into graph data
	// 		const graphData = {};

	// 		transactions.forEach((tx) => {
	// 			const key = formatDate(new Date(tx.timestamp), interval);

	// 			if (!graphData[key]) {
	// 				graphData[key] = {
	// 					date: key,
	// 					transferAmount: 0,
	// 					transferCount: 0,
	// 					uniqueSenders: new Set(),
	// 					uniqueReceivers: new Set(),
	// 				};
	// 			}

	// 			graphData[key].transferAmount += Number(tx.value) || 0;
	// 			graphData[key].transferCount += 1;
	// 			graphData[key].uniqueSenders.add(tx.from);
	// 			graphData[key].uniqueReceivers.add(tx.to);
	// 		});

	// 		// Convert sets to counts and calculate total unique users
	// 		const result = Object.values(graphData).map((data) => ({
	// 			date: data.date,
	// 			transferAmount: data.transferAmount,
	// 			transferCount: data.transferCount,
	// 			uniqueSenders: data.uniqueSenders.size,
	// 			uniqueReceivers: data.uniqueReceivers.size,
	// 			totalUniqueUsers: new Set([
	// 				...data.uniqueSenders,
	// 				...data.uniqueReceivers,
	// 			]).size,
	// 		}));

	// 		// Cache response
	// 		await redisHelper.setStringWithExpiry(
	// 			cacheKey,
	// 			JSON.stringify(result),
	// 			600,
	// 		);

	// 		return {
	// 			error: false,
	// 			message: RES_MSG.TRANSACTION_FEE_SUCCESS,
	// 			data: {
	// 				finalData: result as Array<GraphData>,
	// 				count: 0,
	// 			},
	// 		};
	// 	} catch (err) {
	// 		console.error('Error fetching contract graph data:', error);
	// 		return { error: true, message: RES_MSG.ERROR };
	// 	}
	// }

	async contractGraphs_(data: {
		interval: number;
		// days: string;
		address: string;
	}): Promise<any> {
		try {
			// const { interval = 30 } = data;
			const interval: number = environment.interval;
			const address = Web3.utils.toChecksumAddress(data.address);

			const validateToken = await prisma.contracts.findFirst({
				where: {
					address: address,
				},
			});

			if (!validateToken) {
				return {
					error: true,
					message: RES_MSG.CONTRACT_NOT_FOUND,
				};
			}
			const currentDate = new Date();
			console.log('data-payload', data);
			const fromDate = new Date(currentDate);
			fromDate.setDate(fromDate.getDate() - interval);
			const startDate = formatDateForDay(fromDate);

			// 			const graphData: any = await prisma.$queryRaw`
			//     SELECT
			//         DATE_TRUNC(${time}, tr."timestamp") AS createdAt,
			//         COUNT(tr.id) AS transferCount,
			//         -- SUM(COALESCE((dl.logs->0->'events'->0->'value')::NUMERIC, 0)) AS transferAmount,
			//         COUNT(DISTINCT tr."fromAddress") AS uniqueSenders
			//     FROM "Transactions" tr
			//     LEFT JOIN "ContractLogs" cl ON cl."txHash" = tr."txhash"
			//     LEFT JOIN "DecodedLogs" dl ON cl."txHash" = dl."txHash"
			//     WHERE
			//         (tr."toAddress" = ${address} OR
			//          tr."fromAddress" = ${address} OR
			//          tr."contractAddress" = ${address})
			//         AND tr."type" = 'CONTRACT_TRANSFER'
			//         AND tr."timestamp" >= ${startDate}::timestamp
			//         AND tr."timestamp" <= ${currentDate}::timestamp
			//     GROUP BY createdAt
			//     ORDER BY createdAt ASC;
			// `;
			// 			console.log('graphData', graphData);
			// 			const finalData = graphData.map((row: any) => ({
			// 				createdAt: row.createdat.toISOString(), // Ensure correct date format
			// 				count: {
			// 					transferCount: Number(row.transfercount),
			// 					transferAmount: Number(row.transferamount),
			// 					uniqueSenders: Number(row.uniquesenders),
			// 				},
			// 			}));

			const tokens: any = await prisma.$queryRaw`
			    SELECT
				tr.id,
				tr.txhash,
				tr."timestamp",
				tr."fromAddress",
				tr."toAddress",
				dl.logs
			    FROM
			    "Transactions" tr
				LEFT JOIN
			    "ContractLogs" cl
				 ON cl."txHash" = tr."txhash"
			    LEFT JOIN
			    "DecodedLogs" dl
			    ON cl."txHash" = dl."txHash"
			    LEFT JOIN "Tokens" t
			    ON dl."contractAddress"=t."contractAddress"
				WHERE (tr."toAddress" = ${address} OR tr."fromAddress" = ${address} OR tr."contractAddress" = ${address}) AND tr."type" = 'CONTRACT_TRANSFER' AND (tr."timestamp" >= ${startDate} :: timestamp AND  tr."timestamp" <= ${currentDate} :: timestamp ) ORDER BY tr."timestamp" ASC;
			  `;

			// 			AND "timestamp" <= ${currentDate}

			// 		const graphData1: any = await prisma.$queryRaw`
			// SELECT
			//     DATE_TRUNC(${time}, tr."timestamp") AS date,
			//     COUNT(tr.id) AS transferCount,
			//     -- SUM(COALESCE(dl.decodedValue::NUMERIC, 0)) AS transferAmount,
			//     COUNT(DISTINCT tr."fromAddress") AS uniqueSenders,
			//     COUNT(DISTINCT tr."toAddress") AS uniqueReceivers,
			//     COUNT(DISTINCT tr."fromAddress") + COUNT(DISTINCT tr."toAddress") AS totalUniqueUsers
			// FROM "Transactions" tr
			// LEFT JOIN "DecodedLogs" dl ON tr.txhash = dl."txHash"
			// WHERE
			//     (tr."toAddress" = ${address} OR
			//      tr."fromAddress" = ${address} OR
			//      tr."contractAddress" = ${address})
			//     AND tr."type" = 'CONTRACT_TRANSFER'
			//     AND tr."timestamp" >= NOW() - INTERVAL '${days} days'
			// GROUP BY date
			// ORDER BY date ASC;
			// `;

			console.log('TOKENS', tokens);

			if (!tokens?.length) throw new Error(RES_MSG.NOT_FOUND);

			const tokenTransfers = tokens.map((element: any) => {
				let value: any;
				let toAddress: any;
				if (element?.logs) {
					const eventName = 'transfer';
					const jsonString = JSON.stringify(element?.logs);
					const parsedData = JSON.parse(jsonString);
					const fixedJsonString = parseAndFixJson(element?.logs);
					console.log(
						'elementtxHash_fixedJsonString',
						fixedJsonString[0].name,
						fixedJsonString[0].name.toLowerCase(),
					);
					if (
						fixedJsonString[0]?.events &&
						fixedJsonString[0].name.toLowerCase() === eventName
					) {
						fixedJsonString[0]?.events?.forEach((event: any) => {
							// console.log(event.name, 'Name');
							// console.log(event.type, 'Type');
							// console.log(event.value, 'Value');
							if (
								event.name === 'value' &&
								event.value !== undefined
							) {
								value = BigInt(event.value);
								event.value = value.toString();
							}
							if (
								event.name === 'to' &&
								event.value !== undefined
							) {
								toAddress = BigInt(event.value);
								event.toAddress = toAddress.toString();
							}
						});
					}
				}

				return { ...element, value, toAddress };
			});

			// Group transactions and calculate totals
			const graphData = tokenTransfers.reduce((acc: any, tx: any) => {
				console.log('tx', tx);
				const dateKey = tx.timestamp.toISOString().split('T')[0]; // Group by day
				// const dateKey = Math.floor(
				// 	new Date(tx.timestamp).getTime() / 1000,
				// );
				if (!acc[dateKey]) {
					acc[dateKey] = {
						date: dateKey,
						transferCount: 0,
						transferAmount: 0,
						uniqueSenders: new Set(),
						uniqueReceivers: new Set(),
					};
				}

				acc[dateKey].transferCount += 1;
				acc[dateKey].transferAmount += Number(tx.value || 0);
				acc[dateKey].uniqueSenders.add(tx.fromAddress);
				acc[dateKey].uniqueReceivers.add(tx.toAddress);

				return acc;
			}, {});
			// const finalData = Object.keys(graphData).map((date) => ({
			// 	createdAt: new Date(date).toISOString(),
			// 	count: {
			// 		transferCount: graphData[date].transferCount,
			// 		transferAmount: graphData[date].transferAmount,
			// 		uniqueSenders: graphData[date].uniqueSenders.size,
			// 		uniqueReceivers: graphData[date].uniqueReceivers.size,
			// 	},
			// }));

			// const finalData = Object.entries(graphData).map(
			// 	([date, data]: [string, any]) => ({
			// 		createdAt: new Date(date).toISOString(),
			// 		count:
			// 			data.transferCount > 0
			// 				? {
			// 						transferCount: data.transferCount,
			// 						transferAmount: data.transferAmount,
			// 						uniqueSenders: data.uniqueSenders.size,
			// 					}
			// 				: {}, // Return empty object if transferCount is 0
			// 	}),
			// );

			const start = new Date(startDate);
			const end = new Date(currentDate);

			// Generate all dates in the range
			const allDates: Record<string, any> = {};
			for (
				let d = new Date(start);
				d <= end;
				d.setDate(d.getDate() + 1)
			) {
				const dateStr = d.toISOString().split('T')[0];
				allDates[dateStr] = {
					transferCount: 0,
					transferAmount: 0,
					uniqueSenders: new Set(),
					uniqueReceivers: new Set(),
				};
			}

			// Merge with actual data
			for (const [date, data] of Object.entries(graphData)) {
				allDates[date] = data; // Overwrite with actual data
			}

			console.log('allDates', allDates);
			// Convert to final structure
			const finalData = Object.entries(allDates).map(
				([date, data]: [string, any]) => ({
					// createdAt: new Date(date).toISOString(),
					createdAt: Math.floor(new Date(date).getTime() / 1000),
					count:
						data.transferCount > 0
							? {
									transferCount: data.transferCount,
									transferAmount: data.transferAmount,
									uniqueSenders: data.uniqueSenders.size,
									uniqueReceivers: data.uniqueReceivers.size,
									totalUniques: parseInt(
										data.uniqueSenders.size +
											data.uniqueReceivers.size,
									),
								}
							: {}, // Return empty object if no transfers
				}),
			);

			console.log(JSON.stringify({ finalData }, null, 2));
			// console.log('It is Here', graphData);

			return {
				error: false,
				message: RES_MSG.SUCCESS,
				data: {
					finalData,
				},
			};
		} catch (err) {
			logger.error('err in getTokenTransfer_2 : ', err);
			if (err instanceof Error) {
				if (err.message.includes('prisma')) {
					return { error: true, message: RES_MSG.SERVER_ERROR };
				}
				return { error: true, message: err.message };
			} else {
				return { error: true, message: RES_MSG.ERROR };
			}
		}
	}

	// computeCoinTransferHistory = async (onlyMinInterval: boolean = false) => {
	// 	try {
	// 		let graphData;
	// 		let startDate = '';

	// 		const currentDate = new Date();

	// 		const currentDateModi = formatDateByMin(new Date());
	// 		const oneHourAgo = new Date();
	// 		oneHourAgo.setHours(oneHourAgo.getHours() - 1);
	// 		startDate = formatDateByMin(oneHourAgo);
	// 		graphData = (await prisma.$queryRaw`
	// 		   SELECT DATE_TRUNC('minute', "timestamp") AS "hour", COUNT(*)::int AS "count"
	// 		   FROM "Transactions"
	// 		   WHERE "timestamp" >= ${new Date(startDate)}
	// 			AND "timestamp" <= ${currentDate}
	// 			AND "type" = 'CONTRACT_TRANSFER'
	// 		   GROUP BY "hour"
	// 		   ORDER BY "hour";
	// 		`) as Array<{ hour: Date; count: number }>;

	// 		const mintue = await fillMissingMinutes(
	// 			graphData,
	// 			new Date(startDate),
	// 			new Date(currentDateModi),
	// 		);

	// 		if (onlyMinInterval) return { mintue };

	// 		const oneDayAgo = new Date();
	// 		oneDayAgo.setDate(oneDayAgo.getDate() - 1);
	// 		startDate = formatDate(oneDayAgo);

	// 		graphData = (await prisma.$queryRaw`
	// 				SELECT DATE_TRUNC('hour', "timestamp") AS "hour", COUNT(*)::int AS "count"
	// 				FROM "Transactions"
	// 				WHERE "timestamp" >= ${new Date(startDate)}
	// 				AND "timestamp" <= ${currentDate}
	// 				AND "type" = 'CONTRACT_TRANSFER'
	// 				GROUP BY "hour"
	// 				ORDER BY "hour";
	// 				`) as Array<{ hour: Date; count: number }>;
	// 		const hourly = await fillMissingDatesWithZeroByhr(
	// 			graphData,
	// 			new Date(startDate),
	// 		);

	// 		const daysAgo = 60;
	// 		const fromDate = new Date(currentDate);
	// 		fromDate.setDate(fromDate.getDate() - daysAgo);
	// 		startDate = formatDateForDay(fromDate);

	// 		graphData = (await prisma.$queryRaw`
	// 			   SELECT DATE_TRUNC('day', "timestamp") AS "day", COUNT(*)::int AS "count"
	// 			   FROM "Transactions"
	// 			   WHERE "timestamp" >= ${new Date(startDate)}
	// 				AND "timestamp" <= ${currentDate}
	// 				AND "type" = 'CONTRACT_TRANSFER'
	// 			   GROUP BY "day"
	// 			   ORDER BY "day";
	// 			`) as Array<{ day: Date; count: number }>;

	// 		const daily = await fillMissingDatesWithZeroByDay(
	// 			graphData,
	// 			new Date(startDate),
	// 			currentDate,
	// 		);

	// 		const oneYearAgo = new Date();
	// 		oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1); // Subtract 1 year
	// 		startDate = formatDateForYear(oneYearAgo);

	// 		graphData = (await prisma.$queryRaw`
	// 				SELECT DATE_TRUNC('month', "timestamp") AS "month", COUNT(*)::int AS "count"
	// 				FROM "Transactions"
	// 				WHERE "timestamp" >= ${new Date(startDate)}
	// 				AND "timestamp" <= ${currentDate}
	// 				AND "type" = 'CONTRSCT'
	// 				GROUP BY "month"
	// 				ORDER BY "month";
	// 			`) as Array<{ month: Date; count: number }>;

	// 		const monthly = await fillMissingDatesWithZeroByMonth(
	// 			graphData,
	// 			new Date(startDate),
	// 			currentDate,
	// 		);

	// 		return {
	// 			key: REDIS_KEY.CoinTransferTxHistory,
	// 			data: { mintue, daily, hourly, monthly },
	// 			statsCurrents: {
	// 				mintue: mintue[mintue.length - 1],
	// 				hourly: hourly[hourly.length - 1],
	// 				daily: daily[daily.length - 1],
	// 				monthly: monthly[monthly.length - 1],
	// 			},
	// 		};

	// 		// return {
	// 		// 	error: false,
	// 		// 	message: RES_MSG.TRANSACTION_HISTORY_SUCCESS,
	// 		// 	data: {
	// 		// 		finalData: finalData as Array<GraphData>,
	// 		// 		count: count,
	// 		// 	},
	// 		// };
	// 	} catch (err) {
	// 		return { key: null };
	// 	}
	// };

	async contractGraphs(data: {
		interval: number;
		time: string;
		address: string;
	}): Promise<any> {
		try {
			const now = moment();
			const intervals = [
				{
					start: now.clone().subtract(1, 'years').startOf('year'),
					end: now.clone().subtract(6, 'months').endOf('month'),
				},
				{
					start: now.clone().subtract(6, 'months').startOf('month'),
					end: now.clone().endOf('month'),
				},
			];

			const analytics = [];
			for (const interval of intervals) {
				const transactions = await prisma.transactions.findMany({
					where: {
						toAddress: data.address,
						timestamp: {
							gte: interval.start.toDate(),
							lte: interval.end.toDate(),
						},
					},
				});

				const totalTransactions = transactions.length;
				// const totalAmount = transactions.reduce(
				// 	(sum: number, tx: { amount: any }) =>
				// 		sum + Number(tx.amount),
				// 	0,
				// );
				const uniqueSenders = new Set(
					transactions.map((tx) => tx.fromAddress),
				).size;

				analytics.push({
					period: `${interval.start.format(
						'MMM YYYY',
					)} - ${interval.end.format('MMM YYYY')}`,
					totalTransactions,
					// totalAmount,
					uniqueSenders,
				});
			}
			console.log('It is Here', analytics);

			return {
				error: false,
				message: RES_MSG.SUCCESS,
				data: {
					analytics,
				},
			};
		} catch (err) {
			logger.error('err in getTokenTransfer_2 : ', err);
			if (err instanceof Error) {
				if (err.message.includes('prisma')) {
					return { error: true, message: RES_MSG.SERVER_ERROR };
				}
				return { error: true, message: err.message };
			} else {
				return { error: true, message: RES_MSG.ERROR };
			}
		}
	}
}

export default new ContractService();
