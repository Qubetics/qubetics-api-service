import {
	RES_MSG,
	TRANSFER_TYPE,
	QUEUE_NAME,
	CONST_NAME,
	TRANSACTION_STATUS,
	REDIS_KEY,
} from '../../constant/response';
import {
	convertBigIntToNumber,
	serializeBigInt,
} from '../../helper/common.helper';
import Web3 from 'web3';
import web3Helper from '../../helper/web3.helper';
import { IESResponse } from '../../interfaces/index';
import prisma from '../../lib/db';
import { exp, txType } from '../../lib/utilities.helper';
import { RabbitMqService, RedisService } from '../../service';
import logger from '../../lib/logger';

class TransactionService {
	/**
	 * handle the asc pagination according to id
	 * @param page
	 * @param limit
	 * @returns
	 */
	ascPagination = async (page: number, limit: number) => {
		const isFirstPage = page === 1;
		const transactions = await prisma.transactions.findMany({
			select: {
				id: true,
				blockhash: true,
				blocknumber: true,
				txhash: true,
				contractAddress: true,
				status: true,
				type: true,
				timestamp: true,
				fromAddress: true,
				toAddress: true,
				gasPrice: true,
				gas: true,
				txFee: true,
				value: true,
				token: true,
				createdAt: true,
			},
			orderBy: {
				id: 'asc',
			},
			where: isFirstPage ? {} : { id: { gt: page } },
			take: limit,
		});

		const nextCursor =
			transactions.length === limit
				? convertBigIntToNumber(transactions)[transactions.length - 1]
						.id
				: null;
		const prevCursor = isFirstPage
			? null
			: page && transactions.length > 0
				? convertBigIntToNumber(transactions)[0].id - (limit + 1)
				: null;

		return {
			transactions,
			nextCursor,
			prevCursor: prevCursor === 0 ? 1 : prevCursor,
		};
	};

	/**
	 * handle the desc pagination according to id
	 * @param page
	 * @param limit
	 * @returns
	 */
	descPagination = async (page: number, limit: number) => {
		const isFirstPage = page === 1;

		const transactions = await prisma.transactions.findMany({
			select: {
				id: true,
				blockhash: true,
				blocknumber: true,
				txhash: true,
				contractAddress: true,
				status: true,
				type: true,
				timestamp: true,
				fromAddress: true,
				toAddress: true,
				gasPrice: true,
				gas: true,
				txFee: true,
				value: true,
				token: true,
				createdAt: true,
			},
			orderBy: {
				id: 'desc',
			},
			where: isFirstPage ? {} : { id: { lt: page } },
			take: limit,
		});

		const nextCursor =
			transactions.length === limit
				? convertBigIntToNumber(transactions)[transactions.length - 1]
						.id
				: null;
		const prevCursor = isFirstPage
			? null
			: page && transactions.length > 0
				? convertBigIntToNumber(transactions)[0].id + (limit + 1)
				: null;

		return { transactions, nextCursor, prevCursor };
	};

	async getAllTransaction(data: {
		page: number;
		limit: number;
		order: any;
	}): Promise<IESResponse> {
		try {
			let transactionsData: any;
			let maxId: any = 0;
			let minId: any = 0;
			let transactionCount = await RedisService.getString(
				REDIS_KEY.TRANSACTIONS_COUNT,
			);

			if (!transactionCount) {
				transactionCount = await prisma.transactions.count();
			}
			if (data.order === 'asc') {
				transactionsData = await this.ascPagination(
					data.page,
					data.limit,
				);
				const result = await prisma.transactions.aggregate({
					_max: {
						id: true, // Replace 'id' with your desired column
					},
				});

				maxId = result._max.id;
			} else {
				transactionsData = await this.descPagination(
					data.page,
					data.limit,
				);
				minId = await prisma.transactions.findMany({
					select: {
						id: true, // Replace 'id' with your desired column
					},
					orderBy: {
						id: 'asc',
					},
					take: (transactionCount % data.limit) + 1 || data.limit + 1,
				});
			}

			const { transactions, nextCursor, prevCursor } = transactionsData;
			let nextCursorValue: number | null = nextCursor;

			const todayStart = new Date();
			todayStart.setHours(0, 0, 0, 0);

			const thirtyDaysAgo = new Date();
			thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

			const [getActiveAccount, previous30DaysTrxn] = await Promise.all([
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
			console.log('MAXMIN', maxId, minId);
			if (data.order === 'asc') {
				if (maxId === data.page + data.limit) {
					nextCursorValue = null;
				}
			} else if (data.order === 'desc') {
				if (transactionCount === nextCursor || nextCursor === 1) {
					nextCursorValue = null;
				}
			}

			const offset = transactionCount % data.limit || data.limit;
			const lastPage =
				data.order === 'asc'
					? maxId - offset
					: minId[minId.length - 1].id;
			return {
				error: false,
				message: RES_MSG.TRANSACTION_FETCH_SUCCESS,
				data: {
					count: transactionCount,
					transactions: convertBigIntToNumber(transactions),
					nextCursor: nextCursorValue,
					prevCursor,
					previous30DaysTrxn,
					activeAccount: activeAccount ? activeAccount[0].count : 0,
					lastPage,
				},
			};
		} catch (err) {
			logger.error('err', err);
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

	async getTransactionByHash_1(txHash: string): Promise<IESResponse> {
		try {
			let tokenInfo;
			let transactionData: any = await prisma.$queryRaw`
			   SELECT "Transactions".*,"DecodedLogs"."input","DecodedLogs"."logs" FROM "Transactions"
			   LEFT JOIN "DecodedLogs" ON "Transactions"."txhash" = "DecodedLogs"."txHash"
			   WHERE "Transactions"."txhash" = ${txHash};`;

			// let transactionData = await prisma.transactions.findUnique({
			// 	where: { txhash: txHash },
			// });

			transactionData = convertBigIntToNumber(transactionData[0]);

			if (!transactionData?.length) {
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
					console.log('found error', error);
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
				transactionData.type === TRANSFER_TYPE.CONTRACT_CREATION ||
				transactionData.type === TRANSFER_TYPE.CONTRACT_TRANSFER
			) {
				tokenInfo = await this.getContractAddress(transactionData);
			}
			const tx = transactionData;
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
			// 1️⃣ Wallet address lowercase karo
			const safeAddress = payloads.address.toLowerCase();
			const offset = payloads.page * payloads.limit;

			// 2️⃣ Raw SQL with UNION & LOWER
			const transactions = await prisma.$queryRaw`
    (
      SELECT

        -- t.id,
        t."txhash" AS "txhash",
        t."fromAddress" AS "fromAddress",
        t."toAddress" AS "toAddress",
        t."contractAddress" AS "contractAddress",
        t."value",
        t."timestamp" AS timestamp,
		t.type,
		t.status
      FROM "Transactions" "t"
      WHERE LOWER(t."fromAddress") = ${safeAddress}
         OR LOWER(t."toAddress") = ${safeAddress}
         OR LOWER(t."contractAddress") = ${safeAddress}
    )
    UNION
    (

      SELECT

        -- i.id,
        i."txnHash" AS "txhash",
        i."fromAddress" AS "fromAddress",
        i."toAddress" AS "toAddress",
        i."contractAddress" AS "contractAddress",
        -- i."value",
		(i."value"::numeric / 1e18)::TEXT AS value,
        i."timestamp" AS timestamp,
		'COIN_TRANSFER' AS type,
		  'SUCCESS' AS status

      FROM "internal_transaction" "i"
      WHERE LOWER(i."fromAddress") = ${safeAddress}
         OR LOWER(i."toAddress") = ${safeAddress}
    )
    ORDER BY timestamp DESC
    LIMIT ${payloads.limit} OFFSET ${offset};
  `;

			// ✅ Total Count
			// 		const countResult: any = await prisma.$queryRaw`
			// SELECT (
			//   (SELECT COUNT(*) FROM "Transactions"
			//    WHERE LOWER("fromAddress") = ${safeAddress}
			//       OR LOWER("toAddress") = ${safeAddress}
			//       OR LOWER("contractAddress") = ${safeAddress})
			//   +
			//   (SELECT COUNT(*) FROM "internal_transaction"
			//    WHERE LOWER("fromAddress") = ${safeAddress}
			//       OR LOWER("toAddress") = ${safeAddress})
			// ) AS total_count;
			//   `;

			console.log('transactions', transactions);

			const rawTxns: any = transactions;

			// Make them distinct by `txhash`
			const uniqueTxns = Array.from(
				new Map(
					rawTxns.map((item: any) => [item.txhash, item]),
				).values(),
			);
			const updatedTransactions = convertBigIntToNumber(uniqueTxns);
			const totalCount = Number(updatedTransactions.length);

			// const value = exp(`${Number(element?.value) / CONST_NAME.ETH_EXP}`);

			const isContractAddress = updatedTransactions.some(
				(transaction: {
					contractAddress: string;
					toAddress: string;
					type: string;
				}) =>
					transaction.contractAddress.toLowerCase() === safeAddress ||
					(transaction.toAddress.toLowerCase() === safeAddress &&
						transaction.type !== 'COIN_TRANSFER'),
			);

			return {
				error: false,
				message: RES_MSG.TRANSACTION_FETCH_SUCCESS,

				data: {
					count: totalCount,
					transactions: updatedTransactions,
					isContractAddress,
				},
			};

			//////////////////////////////////
			// return {
			// 	transactions,
			// 	totalCount,
			// 	page,
			// 	limit,
			// };
			// const address = Web3.utils.toChecksumAddress(payloads.address);
			// const [transactions, transactionCount] = await prisma.$transaction([
			// 	prisma.transactions.findMany({
			// 		where: {
			// 			OR: [
			// 				{ fromAddress: address },
			// 				{ toAddress: address },
			// 				{ contractAddress: address },
			// 			],
			// 		},
			// 		skip: payloads.page * payloads.limit,
			// 		take: payloads.limit,
			// 		orderBy: {
			// 			createdAt: 'desc',
			// 		},
			// 		include: {
			// 			internalTransactions: true,
			// 		},
			// 	}),
			// 	prisma.transactions.count({
			// 		where: {
			// 			OR: [
			// 				{ fromAddress: address },
			// 				{ toAddress: address },
			// 				{ contractAddress: address },
			// 			],
			// 		},
			// 	}),
			// ]);
			// if (!transactionCount)
			// 	throw new Error(RES_MSG.TRANSACTION_NOT_FOUND);

			// const updatedTransactions = convertBigIntToNumber(transactions);
			// const isContractAddress = updatedTransactions.some(
			// 	(transaction: {
			// 		contractAddress: string;
			// 		toAddress: string;
			// 		type: string;
			// 	}) =>
			// 		transaction.contractAddress === address ||
			// 		(transaction.toAddress === address &&
			// 			transaction.type !== 'COIN_TRANSFER'),
			// );

			// return {
			// 	error: false,
			// 	message: RES_MSG.TRANSACTION_FETCH_SUCCESS,

			// 	data: {
			// 		count: transactionCount,
			// 		transactions: updatedTransactions,
			// 		isContractAddress,
			// 	},
			// };
		} catch (err) {
			console.log('Error', err);
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
			logger.error('error', err);

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
			let transactionData: any;
			let transactionDataInDB: any = await prisma.$queryRaw`
			   SELECT "Transactions".*,"DecodedLogs"."input","DecodedLogs"."logs" FROM "Transactions"
			   LEFT JOIN "DecodedLogs" ON "Transactions"."txhash" = "DecodedLogs"."txHash"
			   WHERE "Transactions"."txhash" = ${txHash};`;

			// let transactionData = await prisma.transactions.findUnique({
			// 	where: { txhash: txHash },
			// });
			console.log('transactionDataInDB', transactionDataInDB);
			transactionData = serializeBigInt(transactionDataInDB[0]);
			console.log(transactionData, 'transactionDataA');
			if (transactionDataInDB.length < 1) {
				console.log('Not in DB');
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
						console.log('transactionDetail', transactionDetail);
						transactionData = serializeBigInt(transactionDetail);
					}
				} catch (error) {
					console.log(error, 'Display Error in searching');
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
			console.log('transactionData', transactionData);
			if (
				transactionData.type === TRANSFER_TYPE.CONTRACT_CREATION ||
				transactionData.type === TRANSFER_TYPE.CONTRACT_TRANSFER
			) {
				tokenInfo = await this.getContractAddress(transactionData);
			}
			const tx = transactionData;
			// console.log(tx, 'txtxtx');
			const mergedTransaction = {
				...tx,
				tokenInfo: tokenInfo ? serializeBigInt([tokenInfo])[0] : {},
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
			console.log(err, 'Caught the error');
			if (err instanceof Error) {
				return { error: true, message: err.message };
			} else {
				return { error: true, message: RES_MSG.ERROR };
			}
		}
	}
}

export default new TransactionService();
