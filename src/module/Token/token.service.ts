import prisma from '../../lib/db';
import { RES_MSG } from '../../constant/response';
import { HolderData, IESResponse } from '../../interfaces/index';
import {
	convertBigIntToNumber,
	serializeBigInt,
} from '../../helper/common.helper';
import { Prisma } from '@prisma/client';
import { off } from 'process';
import logger from '../../lib/logger';
import Web3 from 'web3';
import { cursorPagination, parseAndFixJson } from '../../lib/utilities.helper';

class TokenService {
	/**
	 * get all tokens
	 * @param data
	 * @returns
	 */
	async getAllTokens_(data: {
		page: number;
		limit: number;
	}): Promise<IESResponse> {
		try {
			const [tokens, tokensCount] = await prisma.$transaction([
				prisma.tokens.findMany({
					skip: data.page * data.limit,
					take: data.limit,
					orderBy: {
						createdAt: 'desc',
					},
					where: {
						type: 'ERC-20',
					},
				}),
				prisma.tokens.count({
					where: {
						type: 'ERC-20',
					},
				}),
			]);
			if (!tokens?.length) throw new Error(RES_MSG.NOT_FOUND);

			const getTotalTokens = await Promise.all(
				tokens.map(async (token: any) => {
					const holdersCount = await prisma.holders.count({
						where: {
							contractAddress: token.contractAddress,
						},
					});
					const getIconUrl =
						await prisma.contractVerification.findFirst({
							where: {
								contractAddress: token.contractAddress,
							},
							select: {
								iconUrl: true,
							},
						});

					token.holders = holdersCount; // Add the holders count to the token
					token.iconUrl = getIconUrl?.iconUrl
						? getIconUrl?.iconUrl
						: '';
					return token; // Return the modified token
				}),
			);

			return {
				error: false,
				message: RES_MSG.SUCCESS,
				data: {
					count: tokensCount,
					erc20Count: tokensCount ? Number(tokensCount) : 0,
					tokens: convertBigIntToNumber(getTotalTokens),
				},
			};
		} catch (err) {
			logger.error('err in getAllTokens : ', err);
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

	/**
	 * get all token transfer
	 * @param data
	 * @returns
	 */
	async getTokenTransfer(data: {
		page: number;
		limit: number;
	}): Promise<IESResponse> {
		try {
			const tokens: any = await prisma.$queryRaw`
	        SELECT 
            t."tokenName" ,
            t."tokenSymbol",
            tr.txhash,
			tr."timestamp",
			tr."fromAddress",
            tr.blocknumber,
            dl.input
            FROM
            "Transactions" tr
            JOIN
            "DecodedLogs" dl
	        ON tr.txhash = dl."txHash"
	        JOIN "Tokens" t
	        ON tr."toAddress"=t."contractAddress"	
            ORDER BY 
			tr.blocknumber	DESC 
            LIMIT ${data.limit}
			OFFSET ${data.page * data.limit}
		  `;

			const total_count: any = await prisma.$queryRaw`
		  	SELECT COUNT(*)
			FROM 
				"Transactions" tr
			JOIN
				"DecodedLogs" dl
				ON tr.txhash = dl."txHash"
			JOIN 
				"Tokens" t
				ON tr."toAddress" = t."contractAddress"
		`;

			if (!tokens?.length) throw new Error(RES_MSG.NOT_FOUND);

			return {
				error: false,
				message: RES_MSG.SUCCESS,
				data: {
					tokens: convertBigIntToNumber(tokens),
					total_count: Number(total_count[0].count),
				},
			};
		} catch (err) {
			logger.error('err in getAllTokens : ', err);
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

	/**
	 * get all tokens
	 * @param data
	 * @returns
	 */
	async getTokens(data: {
		page: number;
		limit: number;
		value: string;
	}): Promise<IESResponse> {
		try {
			const offset = data.page * data.limit;
			const limit = data.limit;
			const searchValue = data.value;

			let tokens;
			let tokensCount;

			if (searchValue) {
				tokens = await prisma.tokens.findMany({
					skip: offset,
					take: limit,

					where: {
						OR: [
							{
								tokenName: {
									contains: searchValue,
									mode: 'insensitive',
								},
							},
							{
								tokenSymbol: {
									contains: searchValue,
									mode: 'insensitive',
								},
							},
							{
								contractAddress: {
									contains: searchValue,
									mode: 'insensitive',
								},
							},
						],
					},
				});
				if (!tokens.length) throw new Error(RES_MSG.NOT_FOUND);
				return {
					error: false,
					message: RES_MSG.DATA_FETCH,
					data: convertBigIntToNumber(tokens),
				};
			}

			const rawQuery = `
			SELECT t.*, COUNT(tx.id) as transactionCount
			FROM "Tokens" t
			LEFT JOIN "Transactions" tx ON t."contractAddress" = tx."toAddress"
			GROUP BY t.id
			ORDER BY transactionCount DESC, t."createdAt" DESC
			OFFSET ${offset}
			LIMIT ${limit};
		`;

			[tokens, tokensCount] = await prisma.$transaction([
				prisma.$queryRaw(Prisma.sql([rawQuery])),
				prisma.tokens.count(),
			]);

			if (!tokens) throw new Error(RES_MSG.NOT_FOUND);

			return {
				error: false,
				message: RES_MSG.SUCCESS,
				data: {
					count: tokensCount,
					tokens: convertBigIntToNumber(tokens),
				},
			};
		} catch (err) {
			logger.error('err in getAllTokens : ', err);
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

	/**
	 * get token by address
	 * @param contractAddress
	 * @returns
	 */
	async getTokenByAddress(contractAddress: string): Promise<IESResponse> {
		try {
			const tokenData = await prisma.tokens.findUnique({
				where: { contractAddress: contractAddress },
			});
			if (!tokenData) {
				throw new Error(RES_MSG.NOT_FOUND);
			}
			return {
				error: false,
				message: RES_MSG.SUCCESS,
				data: {
					token: convertBigIntToNumber([tokenData])[0],
				},
			};
		} catch (err) {
			logger.error('err in getTokenByAddress: ', err);

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

	/**
	 * get token holders by token or contract address
	 * @param contractAddress
	 * @returns
	 */
	async getTokenHolders(data: {
		page: number;
		limit: number;
		contractAddress: string;
	}): Promise<IESResponse> {
		try {
			const holdersData = await prisma.holders.findMany({
				skip: data.page * data.limit,
				take: data.limit,
				where: {
					contractAddress: data.contractAddress,
				},
			});

			const holdersCount = await prisma.holders.count({
				where: {
					contractAddress: data.contractAddress,
				},
			});

			if (!holdersData.length) {
				throw new Error(RES_MSG.NOT_FOUND);
			}
			const tokenData = await prisma.tokens.findUnique({
				where: {
					contractAddress: data.contractAddress,
				},
				select: {
					decimal: true,
					totalSupply: true,
					type: true,
					tokenName: true,
				},
			});

			const dataToReturn = {
				count: holdersCount,
				holders: convertBigIntToNumber(holdersData),
				tokenDetails: convertBigIntToNumber([tokenData])[0],
			};
			return {
				error: false,
				message: RES_MSG.SUCCESS,
				data: dataToReturn,
			};
		} catch (err) {
			logger.error('err in getTokenByAddress: ', err);

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

	/**
	 * get token detail by wallet address
	 * @param address
	 * @param limit
	 * @param page
	 * @returns
	 */
	async getTokenDetailsByAddress(data: {
		page: number;
		limit: number;
		address: string;
	}): Promise<IESResponse> {
		try {
			const holdersData: any = await prisma.holders.findMany({
				skip: data.page * data.limit,
				take: data.limit,
				select: {
					contractAddress: true,
					tokenBalance: true,
					contract: {
						select: {
							contractName: true,
							contractType: true,
							ContractVerification: {
								select: {
									contractname: true,
								},
							},
							Tokens: {
								select: {
									decimal: true,
									tokenSymbol: true,
									tokenName: true,
								},
							},
						},
					},
				},
				where: {
					address: data?.address,
				},
			});
			// console.log('holdersCount', holdersData[0].contract.Tokens);

			const holdersCount = await prisma.holders.count({
				where: {
					address: data.address,
				},
			});
			console.log('holdersCount', holdersCount);
			if (!holdersData.length) {
				throw new Error(RES_MSG.NOT_FOUND);
			}

			const contractDetails: {
				tokenName: String;
				tokenType: String;
				tokenSymbol: String;
				tokenBalance: Number;
				contractAddress: String;
			}[] = [];
			for (const i of holdersData) {
				const dataToPush = {
					...i,
					tokenName:
						i?.contract?.contractName ||
						i?.contract.Tokens?.tokenName ||
						i?.contract?.ContractVerification?.contractname ||
						'',
					tokenType: i?.contract?.contractType || '',
					tokenSymbol: i?.contract?.Tokens?.tokenSymbol ?? '',
					decimals: i?.contract?.Tokens?.decimal,
				};
				delete dataToPush?.contract;
				contractDetails.push(dataToPush);
			}

			const dataToReturn = {
				count: holdersCount,
				contractDetails: convertBigIntToNumber(contractDetails),
			};
			return {
				error: false,
				message: RES_MSG.SUCCESS,
				data: dataToReturn,
			};
		} catch (err) {
			logger.error('err in getTokenByAddress: ', err);

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

	async getTokenBySearch(value: string): Promise<IESResponse> {
		try {
			const tokens = await prisma.tokens.findMany({
				where: {
					OR: [
						{ tokenName: value },
						{ tokenSymbol: value },
						{ contractAddress: value },
					],
				},
			});
			if (!tokens.length) throw new Error(RES_MSG.NOT_FOUND);
			return {
				error: false,
				message: RES_MSG.DATA_FETCH,
				data: convertBigIntToNumber(tokens),
			};
		} catch (err) {
			logger.error('error : ', err);

			const error = err instanceof Error ? err.message : RES_MSG.ERROR;
			return { error: true, message: error };
		}
	}

	async getTokenTransfer_2(data: {
		page: number;
		limit: number;
		address: string;
		order: string;
	}): Promise<IESResponse> {
		try {
			const parsedLimit = data.limit;
			data.address = data.address.trim();

			const tokens: any = await prisma.$queryRaw`
	        SELECT 
			tr.id,
            t."tokenName" ,
            t."tokenSymbol",
            tr.txhash,
			t."decimal" ,
			tr."timestamp",
			tr."fromAddress",
            tr.blocknumber,
			tr."toAddress",
			tr."type",
            dl.input,
			tr.status,
			dl.logs,
			tr."txFee",
			tr.gas,
			tr."gasPrice"
            FROM
            "Transactions" tr
            LEFT JOIN
            "DecodedLogs" dl
	        ON tr.txhash = dl."txHash"
	        LEFT JOIN "Tokens" t
	        ON dl."contractAddress"=t."contractAddress"
			WHERE (tr."toAddress" = ${data.address} OR tr."fromAddress" = ${
				data.address
			} OR tr."contractAddress" = ${
				data.address
			}) AND tr."type" = 'CONTRACT_TRANSFER'
            ORDER BY 
			tr.blocknumber	DESC 
            LIMIT ${data.limit}
			OFFSET ${data.page * data.limit}
		  `;

			const total_count: any = await prisma.$queryRaw`
		  	SELECT COUNT(tr.id) AS count, MIN(tr.id) AS min_id, MAX(tr.id) AS max_id
			FROM
            "Transactions" tr
            LEFT JOIN
            "DecodedLogs" dl
	        ON tr.txhash = dl."txHash"
	        LEFT JOIN "Tokens" t
	        ON dl."contractAddress"=t."contractAddress"
			WHERE (tr."toAddress" = ${data.address} OR tr."fromAddress" = ${data.address} OR tr."contractAddress" = ${data.address}) AND tr."type" = 'CONTRACT_TRANSFER'
		`;

			if (!tokens?.length) throw new Error(RES_MSG.NOT_FOUND);

			const tokenTransfers = tokens.map((element: any) => {
				console.log('element.logs', element.logs);
				let value: any;
				if (element?.logs) {
					const jsonString = JSON.stringify(element?.logs);
					console.log(jsonString, 'DEMO!');

					const parsedData = JSON.parse(jsonString);
					console.log(parsedData, 'DEMO@');
					const fixedJsonString = parseAndFixJson(element?.logs);

					if (fixedJsonString[0]?.events) {
						fixedJsonString[0]?.events?.forEach((event: any) => {
							console.log(event.name, 'Name');
							console.log(event.type, 'Type');
							console.log(event.value, 'Value');
							if (
								event.name === 'value' &&
								event.value !== undefined
							) {
								value = BigInt(event.value);
								event.value = value.toString();
							}
						});
					}
				} else if (element?.input) {
					const jsonString = JSON.stringify(element?.input);
					console.log(jsonString, 'DEMO-input!');

					const parsedData = JSON.parse(jsonString);
					console.log(parsedData, 'DEMO@');
					const fixedJsonString = parseAndFixJson(element?.input);

					if (fixedJsonString[0]?.params) {
						fixedJsonString[0]?.params?.forEach((param: any) => {
							console.log(param.name, 'Name');
							console.log(param.type, 'Type');
							console.log(param.value, 'Value');
							if (
								param.name === 'value' &&
								param.value !== undefined
							) {
								value = BigInt(param.value);
								param.value = value.toString();
							}
						});
					}
				}

				return { ...element, value };
			});

			console.log('It is Here');

			const totalTransactions = total_count[0]?.count;
			const minimumId = total_count[0]?.min_id;
			const maximumId = total_count[0]?.max_id;

			const sortedResults =
				data?.order === 'asc'
					? tokenTransfers.reverse()
					: tokenTransfers;
			console.log('sortedResults', sortedResults);
			const previousCursor =
				sortedResults[0].id === maximumId || sortedResults.length === 1
					? null
					: sortedResults[0].id;

			const nextCursor =
				(sortedResults.length > 0 &&
					sortedResults[sortedResults.length - 1].id === minimumId) ||
				sortedResults.length === 1
					? null
					: sortedResults[sortedResults.length - 1]?.id;

			let lastPageResult: any = null;
			if (
				Number(totalTransactions) &&
				Number(totalTransactions) > parsedLimit
			) {
				lastPageResult = await prisma.$queryRaw`
		  	SELECT tr.id
			FROM
            "Transactions" tr
            LEFT JOIN
            "DecodedLogs" dl
	        ON tr.txhash = dl."txHash"
	        LEFT JOIN "Tokens" t
	        ON dl."contractAddress"=t."contractAddress"
			WHERE (tr."toAddress" = ${data.address} OR tr."fromAddress" = ${
				data.address
			} OR tr."contractAddress" = ${
				data.address
			}) AND tr."type" = 'CONTRACT_TRANSFER' AND  tr.id > ${minimumId} 
			ORDER BY 
			tr.blocknumber	DESC 
            LIMIT ${data.limit}
			OFFSET ${Number(totalTransactions) % parsedLimit || parsedLimit}
		`;
			}
			console.log('Cursors', previousCursor, nextCursor, lastPageResult);
			return {
				error: false,
				message: RES_MSG.SUCCESS,
				data: {
					tokens: convertBigIntToNumber(sortedResults),
					total_count: Number(totalTransactions),
					nextCursor: nextCursor,
					prevCursor: previousCursor === 0 ? 1 : previousCursor,
					lastPage: lastPageResult
						? lastPageResult[lastPageResult.length - 1].id
						: null,
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

	async getAllTokens(data: {
		page: number;
		limit: number;
		order: any;
	}): Promise<IESResponse> {
		try {
			const isFirstPage = data.page === 1 && data.order !== 'asc';
			console.log('isFirstPage', isFirstPage, data.page);
			const a = await prisma.tokens.findMany({
				take: data.limit,
				orderBy: {
					id: data?.order,
				},
				where: {
					type: 'ERC-20',
					...(isFirstPage
						? {}
						: {
								id:
									data.order === 'asc'
										? { gt: data.page }
										: { lt: data.page },
							}),
				},
			});

			const [tokens, tokensCount] = await prisma.$transaction([
				prisma.tokens.findMany({
					take: data.limit,
					orderBy: {
						id: data?.order,
					},
					where: {
						type: 'ERC-20',
						...(isFirstPage
							? {}
							: {
									id:
										data.order === 'asc'
											? { gt: data.page }
											: { lt: data.page },
								}),
					},
				}),
				prisma.tokens.aggregate({
					_count: { id: true },
					_min: { id: true },
					_max: { id: true },
					where: {
						type: 'ERC-20',
					},
				}),
			]);
			if (!tokens?.length) throw new Error(RES_MSG.NOT_FOUND);

			const totalTokens: number = tokensCount?._count.id;
			const minimumId: number = Number(tokensCount?._min.id);
			const maximumId: number = Number(tokensCount?._max.id);

			const getLastId = await prisma.tokens.findMany({
				select: {
					id: true, // Replace 'id' with your desired column
				},
				orderBy: {
					id: 'asc',
				},
				where: {
					type: 'ERC-20',
					id: {
						gt: minimumId,
					},
				},
				take: totalTokens % data.limit || data.limit,
			});

			const cursorPages = cursorPagination(
				tokens,
				data.order,
				'',
				data.limit,
				'id',
				totalTokens,
				maximumId,
				minimumId,
			);

			const sortedResults = cursorPages?.sortedResults
				? cursorPages?.sortedResults
				: tokens;
			const getTotalTokens = await Promise.all(
				sortedResults.map(async (token: any) => {
					const holdersCount = await prisma.holders.count({
						where: {
							contractAddress: token.contractAddress,
						},
					});
					const getIconUrl =
						await prisma.contractVerification.findFirst({
							where: {
								contractAddress: token.contractAddress,
							},
							select: {
								iconUrl: true,
								contractname: true,
								verificationType: true,
							},
						});

					token.holders = holdersCount; // Add the holders count to the token
					token.iconUrl = getIconUrl?.iconUrl
						? getIconUrl?.iconUrl
						: '';
					token.verificationType = getIconUrl?.verificationType;
					token.contractname = getIconUrl?.contractname
						? getIconUrl?.contractname
						: '';
					return token; // Return the modified token
				}),
			);

			return {
				error: false,
				message: RES_MSG.SUCCESS,
				data: {
					count: totalTokens,
					erc20Count: totalTokens ? Number(totalTokens) : 0,
					tokens: convertBigIntToNumber(getTotalTokens),
					nextCursor:
						data.page > 1 &&
						cursorPages.nextCursor === cursorPages.previousCursor
							? null
							: cursorPages.nextCursor,
					// prevCursor:
					// 	((data.page === 1 || data.page === 0 || !data.page) &&
					// 		!data.order) ||
					// 	cursorPages.nextCursor === cursorPages.previousCursor
					// 		? null
					// 		: cursorPages.previousCursor,
					prevCursor: cursorPages.previousCursor,
					lastPage: getLastId
						? getLastId[getLastId.length - 1].id
						: null,
				},
			};
		} catch (err) {
			logger.error('err in getAllTokens : ', err);
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

export default new TokenService();
