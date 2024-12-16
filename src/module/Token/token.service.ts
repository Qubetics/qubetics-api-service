import prisma from '../../lib/db';
import { RES_MSG } from '../../constant/response';
import { HolderData, IESResponse } from '../../interfaces/index';
import { convertBigIntToNumber } from '../../helper/common.helper';
import { Prisma } from '@prisma/client';
import { off } from 'process';

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
			const [tokens, tokensCount, erc20Count] = await prisma.$transaction(
				[
					prisma.tokens.findMany({
						skip: data.page * data.limit,
						take: data.limit,
						orderBy: {
							createdAt: 'desc',
						},
					}),
					prisma.tokens.count(),
					prisma.tokens.findMany({
						where: {
							type: 'ERC-20',
						},
						orderBy: {
							createdAt: 'desc',
						},
					}),
				],
			);
			if (!tokens?.length) throw new Error(RES_MSG.NOT_FOUND);

			const getTotalTokens = await Promise.all(
				tokens.map(async (token: any) => {
					const holdersCount = await prisma.holders.count({
						where: {
							contractAddress: token.contractAddress,
						},
					});

					token.holders = holdersCount; // Add the holders count to the token
					return token; // Return the modified token
				}),
			);

			console.log(getTotalTokens, 'getTotalTokens');
			return {
				error: false,
				message: RES_MSG.SUCCESS,
				data: {
					count: tokensCount,
					tokens: convertBigIntToNumber(getTotalTokens),
					erc20Count: erc20Count?.length,
				},
			};
		} catch (err) {
			console.log('err in getAllTokens : ', err);
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
			console.log('err in getAllTokens : ', err);
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
			console.log('err in getAllTokens : ', err);
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
			console.log('err in getTokenByAddress: ', err);

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
			console.log('err in getTokenByAddress: ', err);

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
			console.log('err in getTokenByAddress: ', err);

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
			console.log('error : ', err);

			const error = err instanceof Error ? err.message : RES_MSG.ERROR;
			return { error: true, message: error };
		}
	}
}

export default new TokenService();
