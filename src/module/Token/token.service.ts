import prisma from '../../lib/db';
import { RES_MSG } from '../../constant/response';
import { HolderData, IESResponse } from '../../interfaces/index';
import { convertBigIntToNumber } from '../../helper/common.helper';
import { Prisma } from '@prisma/client';
import { off } from 'process';
import logger from '../../lib/logger';
import Web3 from 'web3';

class TokenService {
	/**
	 * get all tokens
	 * @param data
	 * @returns
	 */
	async getAllTokens(data: {
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
							Tokens: {
								select: {
									decimal: true,
									tokenSymbol: true,
								},
							},
						},
					},
				},
				where: {
					address: data?.address,
				},
			});

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
					tokenName: i?.contract?.contractName ?? '',
					tokenType: i?.contract?.contractType ?? '',
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
	}): Promise<IESResponse> {
		try {
			console.log('paylods12345', data);
			const transferType = 'CONTRACT_TRANSFER';
			const tokens: any = await prisma.$queryRaw`
	        SELECT 
            t."tokenName" ,
            t."tokenSymbol",
            tr.txhash,
			t."decimal" ,
			tr."timestamp",
			tr."fromAddress",
            tr.blocknumber,
			tr."toAddress",
			tr."type",
			-- dl."method",
            dl.input,
			tr.status,
			dl.logs
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
		  	SELECT COUNT(*)
			FROM
            "Transactions" tr
            LEFT JOIN
            "DecodedLogs" dl
	        ON tr.txhash = dl."txHash"
	        LEFT JOIN "Tokens" t
	        ON tr."contractAddress"=t."contractAddress"
			WHERE (tr."toAddress" = ${data.address} OR tr."fromAddress" = ${data.address} OR tr."contractAddress" = ${data.address}) AND tr."type" = 'CONTRACT_TRANSFER'
		`;
			console.log(':ToKENS', tokens);
			if (!tokens?.length) throw new Error(RES_MSG.NOT_FOUND);

			const tokenTransfers = tokens.map((element: any) => {
				console.log('element.logs', element.logs);
				let value = 0;
				if (element?.logs) {
					const jsonString = JSON.stringify(element?.logs);
					console.log(jsonString, 'DEMO!');

					const parsedData = JSON.parse(jsonString);
					console.log(parsedData, 'DEMO@');
					const fixedJsonString = this.parseAndFixJson(element?.logs);

					if (fixedJsonString && fixedJsonString[0]?.events) {
						fixedJsonString[0]?.events?.forEach((element: any) => {
							console.log(element.name, 'Name');
							console.log(element.type, 'Tyope');
							console.log(element.value, 'Valye');
							if (element.name == 'value') {
								value = element.value;
								element.value = value;
							}
						});
					}
				}

				return { ...element, value };
			});
			console.log('tokenTransfers', tokenTransfers);
			return {
				error: false,
				message: RES_MSG.SUCCESS,
				data: {
					tokens: convertBigIntToNumber(tokenTransfers),
					total_count: Number(total_count[0].count),
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

	public parseAndFixJson(input: any) {
		try {
			// Check if it's already valid JSON
			return JSON.parse(input);
		} catch (error) {
			console.warn('Invalid JSON detected. Attempting to fix...');

			const fixedJsonString = input
				.replace(/([{,])(\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$3":') // Quote keys
				.replace(/:\s*([a-zA-Z_][a-zA-Z0-9_]*)\b/g, ': "$1"') // Quote unquoted string values
				.replace(/0x[a-fA-F0-9]+/g, '"$&"'); // Quote hex values
			console.log(JSON.parse(fixedJsonString), 'fixedJsonString');
			try {
				return JSON.parse(fixedJsonString);
			} catch (finalError) {
				console.error('Failed to fix JSON:', finalError);
				return null; // Return null or handle the error accordingly
			}
		}
	}
}

export default new TokenService();
