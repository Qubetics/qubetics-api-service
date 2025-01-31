import Web3 from 'web3';
import prisma from '../../lib/db';
import { IESResponse } from '../../interfaces/index';
import {
	convertBigIntToNumber,
	serializeBigInt,
} from '../../helper/common.helper';
import { CONTRACT, CONTRACTLOGS, RES_MSG } from '../../constant/response';
import logger from '../../lib/logger';
import { RedisService } from '../../service';

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
			if (!contracts?.length) throw new Error(RES_MSG.BLOCK_NOT_FOUND);
			const contractCount = await prisma.contracts.count();

			if (data.order === 'asc') {
				const result = await prisma.contracts.aggregate({
					_max: {
						id: true, // Replace 'id' with your desired column
					},
				});

				maxId = result._max.id;
			}
			const getLastId = await prisma.contracts.findMany({
				select: {
					id: true, // Replace 'id' with your desired column
				},
				orderBy: {
					id: 'asc',
				},
				take: (contractCount % data.limit) + 1 || data.limit + 1,
			});

			contracts = contracts.map((contract) => ({
				...contract,
				tokenName: contract.contractName, // Alias for "contractName"
				contractname: contract.ContractVerification?.contractname, // Alias for "ContractVerification.contractname"
				verificationType:
					contract.ContractVerification?.verificationType,
				iconUrl: contract.ContractVerification?.iconUrl,
			}));

			const nextCursor =
				contracts.length === data.limit && isLimitFullFilled
					? convertBigIntToNumber(contracts)[contracts.length - 1].id
					: null;
			let nextCursorValue: number | null = nextCursor;
			if (data.order === 'asc') {
				if (maxId === data.page) {
					nextCursorValue = null;
				}
			} else if (data.order === 'desc') {
				if (contractCount === nextCursor || nextCursor === 1) {
					nextCursorValue = null;
				}
			}
			const prevCursor = isFirstPage
				? null
				: data.page && contracts.length > 0
					? data.order === 'asc'
						? convertBigIntToNumber(contracts)[0].id -
							(data.limit + 1)
						: convertBigIntToNumber(contracts)[0].id +
							(data.limit + 1)
					: null;

			if (!contracts?.length) throw new Error(RES_MSG.CONTRACT_NOT_FOUND);
			console.log('nextCursorValue', nextCursorValue, nextCursor);

			const groupByResult = await prisma.contracts.groupBy({
				by: ['contractType'], // Group by the 'type' column
				_count: {
					contractType: true, // Count occurrences of each type
				},
			});
			console.log('contractTypeCount', groupByResult);

			// Loop through the groupByResult and filter each count

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

			const offset = contractCount % data.limit || data.limit;
			const lastPage =
				data.order === 'asc'
					? maxId - offset
					: getLastId[getLastId.length - 1].id;

			return {
				error: false,
				message: RES_MSG.ALL_BLOCK_FETCH,
				data: {
					count: contractCount,
					contracts: convertBigIntToNumber(contracts),
					nextCursor: nextCursorValue,
					prevCursor: prevCursor === 0 ? 1 : prevCursor,
					lastPage: lastPage,
					erc20Count: erc20Count ? Number(erc20Count) : 0,
					erc721Count: erc721Count ? Number(erc721Count) : 0,
					erc777Count: erc777Count ? Number(erc777Count) : 0,
					erc1155Count: erc1155Count ? Number(erc1155Count) : 0,
					unknownCount: unknownCount ? Number(unknownCount) : 0,
					// lastPage: data.order === 'asc' ? maxId : data.limit + 1,
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
							is: {
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

			const { ...counterFilter } = searchFilter;

			if (data.page && data.page > 1) {
				searchFilter.id =
					data.order === 'asc'
						? { gt: data.page }
						: { lt: data.page };
			}

			// Perform the query with cursor-based pagination
			console.log('searchFilter', searchFilter);
			const [results, resultCount] = await Promise.all([
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
						id:
							data?.order === 'asc' || data?.order === 'desc'
								? data?.order
								: ('desc' as const),
					},
				}),
				prisma.contracts.aggregate({
					where: counterFilter,
					_count: { id: true },
					_min: { id: true },
					_max: { id: true },
				}),
			]);

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
				console.log('lastPageResult1	', lastPageResult);
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
}

export default new ContractService();
