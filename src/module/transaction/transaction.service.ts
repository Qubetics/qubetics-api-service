import {
	RES_MSG,
	TRANSFER_TYPE,
	QUEUE_NAME,
	CONST_NAME,
	TRANSACTION_STATUS,
	REDIS_KEY,
} from '../../constant/response';
import { convertBigIntToNumber } from '../../helper/common.helper';
import Web3 from 'web3';
import web3Helper from '../../helper/web3.helper';
import { IESResponse } from '../../interfaces/index';
import prisma from '../../lib/db';
import { exp, txType } from '../../lib/utilities.helper';
import { RabbitMqService, RedisService } from '../../service';

class TransactionService {

	/**
	 * handle the asc pagination according to id
	 * @param page 
	 * @param limit 
	 * @returns 
	 */
	ascPagination = async (page: number, limit: number) => {
		const isFirstPage = page === 1;
		const transactions = await
		prisma.transactions.findMany({
			orderBy: {
				id: 'asc',
			},
			where: isFirstPage ? {} : { id: { gt: page } },
			take: limit,
		});

	const nextCursor =
		transactions.length === limit
			? convertBigIntToNumber(transactions)[
				transactions.length - 1
			].id
			: null;
	const prevCursor = isFirstPage
		? null
		: page && transactions.length > 0
			? convertBigIntToNumber(transactions)[0].id - (limit)
			: null;

	return { transactions, nextCursor, prevCursor };
	};

	/**
	 * handle the desc pagination according to id
	 * @param page 
	 * @param limit 
	 * @returns 
	 */
	descPagination = async (page: number, limit: number) => {
		const isFirstPage = page === 1;

		const transactions = await
			prisma.transactions.findMany({
				orderBy: {
					id: 'desc',
				},
				where: isFirstPage ? {} : { id: { lt: page } },
				take: limit,
			});

		const nextCursor =
			transactions.length === limit
				? convertBigIntToNumber(transactions)[
					transactions.length - 1
				].id
				: null;
		const prevCursor = isFirstPage
			? null
			: page && transactions.length > 0
				? convertBigIntToNumber(transactions)[0].id + (limit+1)
				: null;

		return { transactions, nextCursor, prevCursor };
	}

	async getAllTransaction(data: {
		page: number;
		limit: number;
		order: any;
	}): Promise<IESResponse> {
		try {

			let transactionsData: any;

			if (data.order === 'asc')
				transactionsData = await this.ascPagination(data.page, data.limit);
			else
				transactionsData = await this.descPagination(data.page, data.limit);

			const transactionCount = await RedisService.getString(
				REDIS_KEY.TRANSACTIONS_COUNT,
			);

			const {transactions, nextCursor, prevCursor} = transactionsData;

			const todayStart = new Date();
			todayStart.setHours(0, 0, 0, 0);

			const thirtyDaysAgo = new Date();
			thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

			const [getActiveAccount, previous30DaysTrxn] = await Promise.all([
				// prisma.transactions.findmany({
				// 	select: {
				// 		_count: true,
				// 	},
				// 	distinct: ['fromAddress'],
				// 	where: {
				// 		timestamp: {
				// 			gte: todayStart.toISOString(),
				// 			lte: new Date().toISOString(),
				// 		},
				// 	},
				// }),
				prisma.$queryRaw`
 					SELECT COUNT(DISTINCT "fromAddress") AS "count" FROM "Transactions" WHERE "timestamp" >= CAST(${todayStart.toISOString()} AS timestamp) AND "timestamp" <= CAST(${new Date().toISOString()} AS timestamp)`,
				prisma.transactions.count({
					where: {
						createdAt: {
							gte: thirtyDaysAgo, // Greater than or equal to 30 days ago
						},
					},
				}),
			]);
			// Query the count of transactions

			const activeAccount: any = convertBigIntToNumber(getActiveAccount);
			if (!transactions.length)
				throw new Error(RES_MSG.TRANSACTION_NOT_FOUND);

			return {
				error: false,
				message: RES_MSG.TRANSACTION_FETCH_SUCCESS,
				data: {
					count: transactionCount,
					transactions: convertBigIntToNumber(transactions),
					nextCursor: (transactionCount === nextCursor  || nextCursor === 1) ? null : nextCursor,
					prevCursor,
					previous30DaysTrxn,
					activeAccount: activeAccount ? activeAccount[0].count : 0,
					lastPage: data.order === 'asc' ? transactionCount - data.limit : (data.limit+1)
				},
			};
		} catch (err) {
			console.log('err', err);
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

	async getTransactionByHash(txHash: string): Promise<IESResponse> {
		try {
			let tokenInfo;
			let transactionData: any = await prisma.$queryRaw`
			   SELECT "Transactions".*,"DecodedLogs"."input","DecodedLogs"."logs" FROM "Transactions"
			   LEFT JOIN "DecodedLogs" ON "Transactions"."txhash" = "DecodedLogs"."txHash"
			   WHERE "Transactions"."txhash" = ${txHash};`;

			// let transactionData = await prisma.transactions.findUnique({
			// 	where: { txhash: txHash },
			// });

			transactionData = convertBigIntToNumber(transactionData);

			if (!transactionData.length) {
				try {
					const txData = await web3Helper.getTxByHash(txHash);
					if (txData) {
						RabbitMqService.inQueueData(
							QUEUE_NAME.MISSING_BLOCK,
							JSON.stringify(Number(txData?.blockNumber)),
						);
						const txReceipt =
							await web3Helper.getTransactionReceipt(txHash);
						const amount =
							Number(`${txData?.value}`) / CONST_NAME.ETH_EXP;
						const gasPrice = txData?.gasPrice
							? Number(txData?.gasPrice)
							: CONST_NAME.ZERO;

						const fee =
							(Number(txData?.gas) * gasPrice) /
							CONST_NAME.ETH_EXP;

						let transactionDetail = {
							blocknumber: Number(txData?.blockNumber),
							blockhash: txData?.blockHash,
							txhash: txData?.hash,
							type: txType(`${txData.to}`, txData.input),
							status: txReceipt?.status
								? TRANSACTION_STATUS.SUCCESS
								: TRANSACTION_STATUS.FAILED,

							fromAddress: <string>txData?.from,
							toAddress: <string>txData?.to ?? CONST_NAME.NA,
							contractAddress:
								txReceipt?.contractAddress ?? CONST_NAME.NA,
							timestamp: new Date().getTime(),
							token: CONST_NAME.ZERO.toString(),
							createdAt: new Date(),
							gasPrice,
							gas: txReceipt?.gasUsed
								? Number(txReceipt?.gasUsed)
								: Number(txData?.gas) || 0,
							value: exp(`${amount}`),
							txFee: exp(`${fee}`),
						};

						transactionData = convertBigIntToNumber([
							transactionDetail,
						])[0];
					}
				} catch (error) {
					throw new Error(RES_MSG.NOT_FOUND);
				}
			}

			const contractLogs = await prisma.contractLogs.findMany({
				where: { txHash: txHash },
				select: {
					contractAddress: true,
					topics: true,
					methodSignature: true,
					method: true,
				},
			});

			if (
				transactionData[0].type === TRANSFER_TYPE.CONTRACT_CREATION ||
				transactionData[0].type === TRANSFER_TYPE.CONTRACT_TRANSFER
			) {
				tokenInfo = await this.getContractAddress(transactionData[0]);
			}
			const tx = transactionData.length
				? transactionData[0]
				: transactionData;
			const mergedTransaction = {
				...tx,
				tokenInfo: tokenInfo
					? convertBigIntToNumber([tokenInfo])[0]
					: {},
			};
			return {
				error: false,
				message: RES_MSG.TRANSACTION_FETCH_SUCCESS,
				data: {
					transaction: mergedTransaction,
					contractLogs: contractLogs,
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

	async getContractAddress(transactionData: any) {
		try {
			let address;
			let tokenInfo;
			if (
				transactionData.type === TRANSFER_TYPE.CONTRACT_CREATION ||
				transactionData.type === TRANSFER_TYPE.CONTRACT_TRANSFER
			) {
				if (transactionData.type === TRANSFER_TYPE.CONTRACT_CREATION) {
					address = transactionData.contractAddress;
				} else if (
					transactionData.type === TRANSFER_TYPE.CONTRACT_TRANSFER
				) {
					address = transactionData.toAddress;
				}

				tokenInfo = await prisma.tokens.findUnique({
					where: {
						contractAddress: address,
					},
				});
			}
			return tokenInfo;
		} catch (err) {
			throw new Error(RES_MSG.TOKEN_FETCH_ERROR);
		}
	}
	async getTransactionByAddress(payloads: {
		page: number;
		limit: number;
		address: string;
	}): Promise<IESResponse> {
		try {
			const address = Web3.utils.toChecksumAddress(payloads.address);
			const [transactions, transactionCount] = await prisma.$transaction([
				prisma.transactions.findMany({
					where: {
						OR: [
							{ fromAddress: address },
							{ toAddress: address },
							{ contractAddress: address },
						],
					},
					skip: payloads.page * payloads.limit,
					take: payloads.limit,
					orderBy: {
						createdAt: 'desc',
					},
				}),
				prisma.transactions.count({
					where: {
						OR: [
							{ fromAddress: address },
							{ toAddress: address },
							{ contractAddress: address },
						],
					},
				}),
			]);
			if (!transactionCount)
				throw new Error(RES_MSG.TRANSACTION_NOT_FOUND);

			const updatedTransactions = convertBigIntToNumber(transactions);
			const isContractAddress = updatedTransactions.some(
				(transaction) =>
					transaction.contractAddress === address ||
					(transaction.toAddress === address &&
						transaction.type !== 'COIN_TRANSFER'),
			);

			return {
				error: false,
				message: RES_MSG.TRANSACTION_FETCH_SUCCESS,

				data: {
					count: transactionCount,
					transactions: updatedTransactions,
					isContractAddress,
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

	async getTransactionByBlock(payloads: {
		page: number;
		limit: number;
		value: string;
	}): Promise<IESResponse> {
		try {
			// if (!payloads.value || isNaN(Number(payloads.value))) {
			// 	return {
			// 		error: true,
			// 		message: RES_MSG.NOT_VALID_QUERY,
			// 	};

			let transactionData;
			//check if there is blockhash or blocknumber for checking the block details
			if (payloads.value.startsWith('0x')) {
				transactionData = await prisma.transactions.findMany({
					where: { blockhash: payloads.value },
					orderBy: {
						createdAt: 'desc',
					},
					skip: payloads.page * payloads.limit,
					take: payloads.limit,
				});
			} else {
				transactionData = await prisma.transactions.findMany({
					where: { blocknumber: +payloads.value },
					orderBy: {
						createdAt: 'desc',
					},
					skip: payloads.page * payloads.limit,
					take: payloads.limit,
				});
			}

			if (!transactionData.length)
				throw new Error(RES_MSG.TRANSACTION_NOT_FOUND);

			let txCount;

			if (payloads.value.startsWith('0x')) {
				txCount = await prisma.blocks.findUnique({
					select: {
						transactionCount: true,
					},
					where: { blockhash: payloads.value },
				});
			} else {
				txCount = await prisma.blocks.findUnique({
					select: {
						transactionCount: true,
					},
					where: { blocknumber: +payloads.value },
				});
			}

			return {
				message: RES_MSG.BLOCK_TRANSACTION_FETCH,
				error: false,
				data: {
					transaction: convertBigIntToNumber(transactionData),
					count: txCount
						? convertBigIntToNumber([txCount])[0].transactionCount
						: 0,
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

	async getErc20Transaction(data: {
		page: number;
		limit: number;
	}): Promise<IESResponse> {
		try {
			const transactions: any[] = await prisma.$queryRaw`
    SELECT "Transactions".*, "Contracts"."contractType","DecodedLogs"."input", "DecodedLogs"."logs", "DecodedLogs"."createdAt" as "logsTime","Tokens"."tokenName","Tokens"."tokenSymbol","Tokens"."decimal","Tokens"."contractAddress" as "tokenAddress"
    FROM "Transactions"
    INNER JOIN "DecodedLogs" ON "Transactions"."txhash" = "DecodedLogs"."txHash"
	 LEFT JOIN "Contracts" ON "DecodedLogs"."contractAddress" = "Contracts"."address"
	 LEFT JOIN "Tokens" ON "DecodedLogs"."contractAddress" = "Tokens"."contractAddress"
    WHERE "Transactions"."type" = 'CONTRACT_TRANSFER'
    AND "DecodedLogs"."logs" != '' 
    AND "DecodedLogs"."input" != ''  AND "Contracts"."contractType" = 'ERC-20' 
    ORDER BY "Transactions"."createdAt" DESC
    OFFSET ${data.page * data.limit}
    LIMIT ${data.limit}`;

			const transactionCount: any[] = await prisma.$queryRaw`
SELECT COUNT(*) 
FROM "Transactions"
INNER JOIN "DecodedLogs" ON "Transactions"."txhash" = "DecodedLogs"."txHash"
LEFT JOIN "Contracts" ON "DecodedLogs"."contractAddress" = "Contracts"."address"
LEFT JOIN "Tokens" ON "DecodedLogs"."contractAddress" = "Tokens"."contractAddress"
WHERE "Transactions"."type" = 'CONTRACT_TRANSFER'
AND "DecodedLogs"."logs" != '' 
AND "DecodedLogs"."input" != '' AND "Contracts"."contractType" = 'ERC-20' 
`;

			if (transactions.length === 0)
				throw new Error(RES_MSG.TRANSACTION_NOT_FOUND);

			const txCount =
				transactionCount && transactionCount.length
					? convertBigIntToNumber(transactionCount)[0].count
					: 0;

			return {
				error: false,
				message: RES_MSG.TRANSACTION_FETCH_SUCCESS,
				data: {
					count: txCount,
					transactions: convertBigIntToNumber(transactions),
				},
			};
		} catch (err) {
			console.log(err, 'error');

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

export default new TransactionService();
