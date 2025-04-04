import {
	convertBigIntToNumber,
	serializeBigInt,
} from '../../helper/common.helper';
import Web3Helper from '../../helper/web3.helper';
import {
	RES_MSG,
	QUEUE_NAME,
	CONST_NAME,
	REDIS_KEY,
} from '../../constant/response';
import { IESResponse } from '../../interfaces/index';
import { RabbitMqService, RedisService } from '../../service/index';
import prisma from '../../lib/db';
import web3Helper from '../../helper/web3.helper';
import logger from '../../lib/logger';
import { cursorPagination } from '../../lib/utilities.helper';
import axios from 'axios';

class BlockService {
	async getAllLatestBlock_1(data: {
		page: number;
		limit: number;
		order: any;
	}): Promise<IESResponse> {
		try {
			let isLimitFullFilled = true;
			let maxId = 0;
			let minId: any = 0;
			let zerothElement = 0;
			let isFirstPage = data.page === 1;
			let blocks = await prisma.blocks.findMany({
				orderBy: {
					blocknumber: data.order,
				},
				where: isFirstPage
					? {}
					: {
							blocknumber:
								data.order === 'asc'
									? { gt: data.page }
									: { lt: data.page },
						},
				take: data.limit,
			});

			// check if limit is fullfilled with current block range
			if (blocks.length < data.limit) {
				isLimitFullFilled = false;
			}
			if (!blocks?.length) throw new Error(RES_MSG.BLOCK_NOT_FOUND);

			let blockCount = await RedisService.getString(
				REDIS_KEY.BLOCKS_COUNT,
			);

			if (!blockCount) {
				const result = await prisma.blocks.aggregate({
					_count: {
						blocknumber: true,
					},
				});
				blockCount = result._count.blocknumber;
			}

			zerothElement = serializeBigInt(blocks[0].blocknumber);
			console.log(zerothElement, 'zerothElement');
			const nextCursor =
				blocks.length === data.limit && isLimitFullFilled
					? convertBigIntToNumber(blocks)[blocks.length - 1]
							.blocknumber
					: null;

			const prevCursor: number = isFirstPage
				? null
				: data.order === 'asc'
					? serializeBigInt(blocks[blocks.length - 1].blocknumber)
					: serializeBigInt(blocks[0].blocknumber);

			if (!blocks?.length) throw new Error(RES_MSG.BLOCK_NOT_FOUND);
			let nextCursorValue: number | null = nextCursor;
			if (data.order === 'asc') {
				const result = await prisma.blocks.aggregate({
					_max: {
						blocknumber: true,
					},
				});
				maxId = serializeBigInt(result._max.blocknumber);
				if (maxId === data.page + data.limit) {
					nextCursorValue = null;
				}
			} else if (data.order === 'desc') {
				minId = await prisma.blocks.findMany({
					select: {
						blocknumber: true,
					},
					orderBy: {
						blocknumber: 'asc',
					},
					take: (blockCount % data.limit) + 1 || data.limit + 1,
				});
				if (blockCount === nextCursor || nextCursor === 1) {
					nextCursorValue = null;
				}
			}
			const offset: number = blockCount % data.limit || data.limit;

			const lastPage =
				data.order === 'asc'
					? maxId - offset
					: serializeBigInt(minId[minId.length - 1].blocknumber);
			console.log('HEHREHHE', minId, lastPage);

			return {
				error: false,
				message: RES_MSG.ALL_BLOCK_FETCH,
				data: {
					blockCount,
					blocks: convertBigIntToNumber(blocks),
					nextCursor: nextCursorValue,
					prevCursor: prevCursor,
					lastPage,
				},
			};
		} catch (err) {
			console.log('--Error BLOCK--', err);
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

	async getAllLatestBlocks(data: {
		page?: number;
		limit: number;
	}): Promise<IESResponse> {
		try {
			const whereCondition = data.page
				? { blocknumber: { gte: data.page } }
				: {};

			const [blocks] = await prisma.$transaction([
				prisma.blocks.findMany({
					orderBy: {
						blocknumber: 'asc',
					},
					where: whereCondition,
					take: data.limit,
				}),
			]);

			const blockCount = await RedisService.getString(
				REDIS_KEY.BLOCKS_COUNT,
			);
			if (!blocks?.length) throw new Error(RES_MSG.BLOCK_NOT_FOUND);

			const nextCursor =
				blocks.length === data.limit
					? convertBigIntToNumber(blocks)[blocks.length - 1]
							.blocknumber
					: null;
			const prevCursor =
				data.page && blocks.length > 0
					? convertBigIntToNumber(blocks)[0].blocknumber
					: null;

			return {
				error: false,
				message: RES_MSG.ALL_BLOCK_FETCH,
				data: {
					blockCount,
					blocks: convertBigIntToNumber(blocks),
					nextCursor,
					prevCursor,
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

	async getBlockByHash(hash: string): Promise<IESResponse> {
		try {
			let blockDetailsByHash = await prisma.blocks.findUnique({
				where: {
					blockhash: hash,
				},
			});

			if (!blockDetailsByHash) {
				const blockData = await Web3Helper.getDetailByBlockNumber(hash);

				if (blockData) {
					RabbitMqService.inQueueData(
						QUEUE_NAME.MISSING_BLOCK,
						JSON.stringify(Number(blockData?.number)),
					);
				} else {
					throw new Error(RES_MSG.BLOCK_NOT_FOUND);
				}
			}

			let attempts = 0;
			while (attempts < 7) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
				blockDetailsByHash = await prisma.blocks.findUnique({
					where: {
						blockhash: hash,
					},
				});
				if (blockDetailsByHash) break;
				attempts++;
			}
			await this.getTxByBlock(
				Number(blockDetailsByHash?.blocknumber),
				Number(blockDetailsByHash?.transactionCount),
			);

			//if (!blockDetailsByHash) throw new Error(RES_MSG.BLOCK_NOT_FOUND);
			return {
				error: false,
				message: RES_MSG.ALL_BLOCK_FETCH,
				data: {
					block: convertBigIntToNumber([blockDetailsByHash])[0],
				},
			};
		} catch (err) {
			if (err instanceof Error) {
				return { error: true, message: err.message };
			}
			return { error: true, message: RES_MSG.ERROR };
		}
	}

	async getTxByBlock(blockNumber: number, txCount: number) {
		try {
			const count = await prisma.transactions.count({
				where: {
					blocknumber: blockNumber,
				},
			});

			if (count !== txCount) {
				RabbitMqService.inQueueData(
					QUEUE_NAME.MISSING_BLOCK,
					JSON.stringify(blockNumber),
				);
			}
			return false;
		} catch (err) {
			return true;
		}
	}

	async getBlockByNumber(blockNumber: number): Promise<IESResponse> {
		try {
			let blockDetail: any = await prisma.blocks.findUnique({
				where: {
					blocknumber: blockNumber,
				},
			});
			if (!blockDetail) {
				const blockData =
					await Web3Helper.getDetailByBlockNumber(blockNumber);
				if (blockData) {
					RabbitMqService.inQueueData(
						QUEUE_NAME.MISSING_BLOCK,
						JSON.stringify(blockNumber),
					);

					blockDetail = {
						blocknumber: Number(blockData.number),
						gasLimit: Number(blockData.gasLimit),
						gasUsed: Number(blockData.gasUsed),
						nonce: Number(blockData.nonce),
						blockhash: blockData.hash,
						parentHash: blockData.parentHash,
						stateRoot: blockData.stateRoot,
						timestamp:
							Number(blockData.timestamp) * CONST_NAME.THOUSAND,
						transactionCount: blockData.transactions?.length
							? Number(blockData.transactions.length)
							: CONST_NAME.ZERO,
						miner: blockData.miner,
						transactionsRoot: blockData.transactionsRoot,
						baseFeePerGas: Number(blockData.baseFeePerGas),
						deposit: blockData.gasUsed.toString(),
						transfer: CONST_NAME.ZERO.toString(),
						receiptsRoot: blockData.receiptsRoot,
						sha3Uncles: blockData.sha3Uncles,
						size: Number(blockData.size),
						createdAt: new Date(),
					};
				} else {
					throw new Error(RES_MSG.BLOCK_NOT_FOUND);
				}
			}

			return {
				error: false,
				message: RES_MSG.ALL_BLOCK_FETCH,
				data: { block: convertBigIntToNumber([blockDetail])[0] },
			};
		} catch (err) {
			if (err instanceof Error) {
				if (err.message.includes('prisma')) {
					return { error: true, message: RES_MSG.SERVER_ERROR };
				}
				return { error: true, message: err.message };
			}
			return { error: true, message: RES_MSG.ERROR };
		}
	}

	async getBlockDetails(blockIdentity: string): Promise<IESResponse> {
		try {
			let blockDetail;

			if (blockIdentity.startsWith('0x')) {
				blockDetail = await prisma.blocks.findUnique({
					where: {
						blockhash: <string>blockIdentity.toLowerCase(),
					},
				});
			} else {
				blockDetail = await prisma.blocks.findUnique({
					where: {
						blocknumber: Number(blockIdentity),
					},
				});
			}
			if (!blockDetail) throw new Error(RES_MSG.BLOCK_NOT_FOUND);

			return {
				error: false,
				message: RES_MSG.ALL_BLOCK_FETCH,
				data: { block: convertBigIntToNumber([blockDetail])[0] },
			};
		} catch (err) {
			if (err instanceof Error) {
				if (err.message.includes('prisma')) {
					return { error: true, message: RES_MSG.SERVER_ERROR };
				}
				return { error: true, message: err.message };
			}
			return { error: true, message: RES_MSG.ERROR };
		}
	}

	async getLatestBlock(): Promise<IESResponse> {
		try {
			const lastHeader = await Web3Helper.getBlockNumber();
			return {
				error: false,
				message: RES_MSG.BLOCK_FETCH,
				data: { blockNumber: lastHeader?.toString() },
			};
		} catch (err) {
			if (err instanceof Error) {
				return { error: true, message: err.message };
			}
			return { error: true, message: RES_MSG.ERROR };
		}
	}

	async getAverageBlockTime(blockCount = 10): Promise<IESResponse> {
		const avgTime = await RedisService.getString(REDIS_KEY.BLOCK_AVG_TIME);
		const latestBlock = await RedisService.getString(
			CONST_NAME.LATEST_BLOCK,
		);
		try {
			if (avgTime) {
				return {
					error: false,
					message: RES_MSG.BLOCK_AVG_SUCCESS,
					data: { avgTime: avgTime, currentBlock: latestBlock },
				};
			}
			const currentBlock = await web3Helper.getBlockNumber();
			const blockNumber = +currentBlock.toString();
			const calls = [];
			for (let i = 0; i <= blockCount; i++) {
				calls.push(
					web3Helper.getDetailByBlockNumber(
						blockNumber - blockCount + i,
					),
				);
			}
			const blocks = await Promise.all(calls);
			let total = 0;
			for (let i = 1; i <= blockCount; i++) {
				const diff =
					+blocks[i].timestamp.toString() -
					+blocks[i - 1].timestamp.toString();
				total += diff;
			}

			const avg = total / blockCount;
			await RedisService.setStringWithExpiry(
				REDIS_KEY.BLOCK_AVG_TIME,
				avg.toFixed(2),
				120,
			);
			return {
				error: false,
				message: RES_MSG.BLOCK_AVG_SUCCESS,
				data: {
					avgTime: Number(avg).toFixed(2),
					currentBlock,
				},
			};
		} catch (err) {
			logger.error('Error inside block avg', err);

			return {
				error: false,
				message: RES_MSG.BLOCK_AVG_SUCCESS,
				data: {
					avgTime: avgTime || environment?.averageBlockTime,
					currentBlock: latestBlock,
				},
			};
		}
	}

	async getAllLatestBlock(data: {
		page: number;
		limit: number;
		order: any;
		filterBy: string;
	}): Promise<IESResponse> {
		try {
			let isLimitFullFilled = true;
			let maxId = 0;
			let minId: any = 0;
			let zerothElement = 0;
			const isFirstPage = data.page === 1;
			let blocks = await prisma.blocks.findMany({
				orderBy: {
					blocknumber: data.order,
				},
				// orderBy: {
				// 	blocknumber:
				// 		data.filterBy === 'newest' && data.order === 'desc'
				// 			? 'asc'
				// 			: 'desc',
				// },
				where: isFirstPage
					? {}
					: {
							blocknumber:
								data.order === 'asc'
									? { gt: data.page }
									: { lt: data.page },
						},
				take: data.limit,
			});

			// check if limit is fullfilled with current block range
			if (blocks.length < data.limit) {
				isLimitFullFilled = false;
			}
			if (!blocks?.length) throw new Error(RES_MSG.BLOCK_NOT_FOUND);

			let blockCount = await RedisService.getString(
				REDIS_KEY.BLOCKS_COUNT,
			);

			if (!blockCount) {
				const result = await prisma.blocks.aggregate({
					_count: {
						blocknumber: true,
					},
				});
				blockCount = result._count.blocknumber;
			}

			const blockCountData = await prisma.blocks.aggregate({
				// _count: { id: true },
				_min: { blocknumber: true },
				_max: { blocknumber: true },
			});

			// blockCount = blockCountData?._count.id;
			const minimumId: number = Number(blockCountData?._min.blocknumber);
			const maximumId: number = Number(blockCountData?._max.blocknumber);

			console.log('------blockCountData----------', blockCountData);

			zerothElement = serializeBigInt(blocks[0].blocknumber);
			console.log(zerothElement, 'zerothElement');

			if (!blocks?.length) throw new Error(RES_MSG.BLOCK_NOT_FOUND);
			console.log('data.filterBy', data.filterBy, data.order);
			const lastPageResult = await prisma.blocks.findMany({
				select: {
					blocknumber: true,
				},
				orderBy: {
					blocknumber:
						data.filterBy === 'newest' || !data.filterBy
							? 'asc'
							: 'desc',
				},
				where: {
					blocknumber:
						data.filterBy === 'newest' || !data.filterBy
							? { gt: minimumId }
							: { lt: maximumId },
				},
				take: blockCount % data.limit || data.limit,
			});
			console.log('lastPageResult', lastPageResult);
			const offset: number = blockCount % data.limit || data.limit;

			// const lastPage =
			// 	data.order === 'asc'
			// 		? maximumId - offset
			// 		: serializeBigInt(
			// 				lastPageResult[lastPageResult.length - 1]
			// 					.blocknumber,
			// 			);
			const lastPage = serializeBigInt(
				lastPageResult[lastPageResult.length - 1].blocknumber,
			);
			console.log('lastPage', lastPage);

			const cursorPages = cursorPagination(
				blocks,
				data.order,
				data.filterBy,
				data.limit,
				'blocknumber',
				blockCount,
				maximumId,
				minimumId,
			);
			console.log(
				'minimumId-pre',
				minimumId,
				cursorPages.previousCursor,
				cursorPages.nextCursor,
			);

			return {
				error: false,
				message: RES_MSG.ALL_BLOCK_FETCH,
				data: {
					blockCount: Number(blockCount),
					blocks: convertBigIntToNumber(cursorPages.sortedResults),
					nextCursor:
						blocks.length < data.limit
							? null
							: serializeBigInt(cursorPages.nextCursor),
					prevCursor: serializeBigInt(cursorPages.previousCursor),
					lastPage: lastPage,
				},
			};
		} catch (err) {
			console.log('--Error BLOCK--', err);
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

	async stateSync(): Promise<IESResponse> {
		try {
			const url = environment.nodeLink;
			const response: any = await axios.get(url + '/block?height');
			console.log(response.data?.result, 'RESPONSE-getBlockHeight');
			const rpcServers = environment.rpcServers;

			return {
				error: false,
				message: RES_MSG.BLOCK_FETCH,
				data: {
					height: response.data?.result?.block?.header?.height.toString(),
					hash: response.data?.result?.block_id?.hash?.toString(),
					rpcServers,
				},
			};
		} catch (err) {
			if (err instanceof Error) {
				return { error: true, message: err.message };
			}
			return { error: true, message: RES_MSG.ERROR };
		}
	}
}

export default new BlockService();
