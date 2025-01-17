import { convertBigIntToNumber } from '../../helper/common.helper';
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

class BlockService {
	async getAllLatestBlock(data: {
		page?: number;
		limit: number;
	}): Promise<IESResponse> {
		try {
			let isLimitFullFilled = true;
			const isFirstPage = data.page === 1;
			let blocks = await prisma.blocks.findMany({
				orderBy: {
					blocknumber: 'desc',
				},
				where: isFirstPage ? {} : { blocknumber: { lt: data.page } },
				take: data.limit,
			});

			// check if limit is fullfilled with current block range
			if (blocks.length < data.limit) {
				const tempBlocks = await prisma.blocks.findMany({
					orderBy: {
						blocknumber: 'asc',
					},
					where: { blocknumber: { gt: data.page } },
					take: data.limit - blocks.length,
				});

				blocks = [...tempBlocks.reverse(), ...blocks];
				isLimitFullFilled = false;
			}

			const blockCount = await RedisService.getString(
				REDIS_KEY.BLOCKS_COUNT,
			);

			if (!blocks?.length) throw new Error(RES_MSG.BLOCK_NOT_FOUND);

			const nextCursor =
				blocks.length === data.limit && isLimitFullFilled
					? convertBigIntToNumber(blocks)[blocks.length - 1]
							.blocknumber
					: null;
			const prevCursor = isFirstPage
				? null
				: data.page && blocks.length > 0
					? convertBigIntToNumber(blocks)[0].blocknumber + 11
					: null;

			if (!blocks?.length) throw new Error(RES_MSG.BLOCK_NOT_FOUND);

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
		try {
			if (avgTime) {
				return {
					error: false,
					message: RES_MSG.BLOCK_AVG_SUCCESS,
					data: { avgTime: avgTime },
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
				data: { avgTime: Number(avg).toFixed(2) },
			};
		} catch (err) {
			logger.error('Error inside block avg', err);

			return {
				error: false,
				message: RES_MSG.BLOCK_AVG_SUCCESS,
				data: { avgTime: avgTime || environment?.averageBlockTime },
			};
		}
	}
}

export default new BlockService();
