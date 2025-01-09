import Web3Helper from '../../helper/web3.helper';
import {
	RES_MSG,
	CONST_NAME,
	REDIS_KEY,
	nodeIpDetail,
	RESPONSES,
	STATS_CONVERTER,
} from '../../constant/response';
import logger from '../../lib/logger';
import { RedisService } from '../../service/index';
import BlockService from '../block/block.service';
import TransactionService from '../transaction/transaction.service';
import {
	GraphData,
	IESResponse,
	IGraphResponse,
	IPeerData,
} from '../../interfaces/index';
import prisma from '../../lib/db';
import { formatDate, exp, formatDateForYear } from '../../lib/utilities.helper';
import { calculateData } from '../../helper/calculateAPR.helper';
import axios from 'axios';
import Web3 from 'web3';
import web3Helper from '../../helper/web3.helper';
class ExplorerService {
	async calculateAndUpdateFee(gasfee: string) {
		try {
			let txfee;

			const data = await prisma.txFee.findMany({
				select: {
					fee: true,
					id: true,
				},
			});

			if (!data.length) {
				await prisma.txFee.create({
					data: { fee: gasfee },
				});
			} else {
				txfee = !data.length ? 0 : Number(data[0]?.fee);

				const updatedFee = txfee + Number(gasfee);

				await prisma.txFee.update({
					where: {
						id: data[0].id,
					},
					data: {
						fee: exp(`${updatedFee}`),
					},
				});
			}
			logger.info('Fee calculation and update successfull');
			return true;
		} catch (error) {
			logger.error('Fee calculation and update unsuccessfull');
			logger.error(error);
			return false;
		}
	}

	processUserData = async (data: { address: string }) => {
		const existingUser = await prisma.users.findUnique({
			where: { address: data.address },
		});

		if (existingUser) {
			await prisma.users.update({
				where: { id: existingUser.id },
				data: {
					txn: Number(existingUser.txn) + CONST_NAME.ONE,
				},
			});
		} else {
			await prisma.users.create({
				data: {
					address: data.address,
					txn: CONST_NAME.ONE,
				},
			});
		}
		return true;
	};

	userSave = async (
		userData: Array<{ address: string }>,
	): Promise<IESResponse> => {
		try {
			userData.map(this.processUserData);

			return {
				error: false,
				message: RES_MSG.USER_ADDED,
				data: { isAdded: true },
			};
		} catch (err) {
			return {
				error: true,
				message: RES_MSG.SERVER_ERROR,
				data: { isAdded: false },
			};
		}
	};

	async searching(payload: string): Promise<IESResponse> {
		try {
			let txData;
			/*check if the string is not hex and call the getBlockDetails Routine
			  using the block number for getting block details
			*/
			if (!payload.startsWith('0x') && isNaN(Number(payload))) {
				throw new Error(RES_MSG.NOT_VALID_QUERY);
			} else if (!payload.startsWith('0x') && !isNaN(Number(payload))) {
				const result = await BlockService.getBlockByNumber(
					Number(payload),
				);
				return result;
			} else if (payload?.startsWith('0x') && payload?.length === 66) {
				const txData = await TransactionService.getTransactionByHash(
					payload?.toLowerCase(),
				);
				if (txData?.error) {
					const result = await BlockService.getBlockByHash(
						payload?.toLowerCase(),
					);
					if (result?.error) result.message = RES_MSG.NOT_FOUND;
					return result;
				}

				return txData;
			} else if (payload.startsWith('0x') && payload.length === 42) {
				/* here we search for all transaction specfic to a wallet address*/
				txData = await TransactionService.getTransactionByAddress({
					address: payload,
					limit: 10,
					page: 0,
				});

				return txData;
			} else {
				throw new Error(RES_MSG.NOT_FOUND);
			}
		} catch (err) {
			if (err instanceof Error) {
				return { error: true, message: RES_MSG.BLOCK_NOT_FOUND };
			}
			return { error: true, message: RES_MSG.ERROR };
		}
	}

	async getAllPeers(): Promise<IESResponse> {
		return new Promise(async (resolve, reject) => {
			try {
				let globeLocDetail: IPeerData[] = [];
				const radisCountPeer = await RedisService.getString(
					CONST_NAME.TOTAL_NODE,
				);
				if (radisCountPeer && radisCountPeer.length > 0) {
					globeLocDetail = radisCountPeer;
				} else {
					const url = environment.nodeLink;
					console.log('urlddd', url);
					const response = await axios.get(url + '/net_info');
					response.data.result.peers.push(nodeIpDetail);
					console.log('ssss', response.data.result.peers);
					console.log(
						'response.data.result.peers',
						response.data.result.peers.length,
					);
					for (
						let peer = 0;
						peer < response.data.result.peers.length;
						peer++
					) {
						const result = response.data.result.peers[peer];

						const ipResponse = await axios.get(
							`${environment.locationApiUrl}${result.remote_ip}`,
						);
						const { status } = ipResponse.data;
						if (status === CONST_NAME.SUCCESS_STATUS) {
							const ipDataRes = {
								peerId: result.node_info.id,
								roles: '',
								protocolVersion:
									result.node_info.protocol_version,
								bestHash: '',
								bestNumber: '',
								version: result.node_info.version,
								nodeName: result.node_info.moniker,
								software: {
									full: '',
									version: '',
									networkId: '',
								},
								location: ipResponse.data,
							};

							globeLocDetail.push(ipDataRes);
						}
					}
					console.log('nodes ', globeLocDetail);
					await Promise.all(globeLocDetail);

					RedisService.setString(
						CONST_NAME.TOTAL_NODE,
						globeLocDetail,
					);
				}

				const countryCount = new Set(
					globeLocDetail.map((peer) => peer.location.country),
				).size;

				resolve({
					error: false,
					message: RES_MSG.PEER_FETCH,
					data: {
						countryCount: countryCount,
						total: globeLocDetail.length,
						globeLocDetail,
					},
				});
			} catch (error) {
				reject(error);
			}
		});
	}
	async summary(): Promise<IESResponse> {
		try {
			const [userCount] = await prisma.$transaction([
				prisma.users.count({
					take: 1,
					orderBy: {
						id: 'desc',
					},
				}),
			]);

			if (!userCount) throw new Error(RES_MSG.USER_NOT_FOUND);

			return {
				message: RES_MSG.DATA_FETCH,
				error: false,
				data: {
					totalAccounts: userCount,
					totalToken: await prisma.tokens.count(),
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

	async tpsHistory(payloads: {
		time: string;
		interval: number;
	}): Promise<IGraphResponse> {
		try {
			const txnStats = await RedisService.getString(REDIS_KEY.TX_HISTORY);
			// console.log('txnCountFromRedis', txnCountFromRedis);

			// let txnCount = !txnCountFromRedis
			// 	? await prisma.transactions.count()
			// 	: txnCountFromRedis;
			// if (!txnCountFromRedis) {
			// 	// First time, get the count from the database
			// 	await RedisService.setString(
			// 		REDIS_KEY.TRANSACTIONS_COUNT,
			// 		txnCount,
			// 	);
			// }
			let _slice: any[] = txnStats[payloads.time.toLowerCase()];
			if (!!_slice) {
				_slice = _slice.slice(_slice.length - payloads.interval);
				const txnCount = _slice.reduce(
					(sum, item) => sum + item.count,
					0,
				);
				return {
					error: false,
					message: RES_MSG.SUCCESS,
					data: {
						finalData: _slice as Array<GraphData>,
						count: txnCount,
					},
				};
			}

			return {
				error: false,
				message: RES_MSG.NOT_FOUND,
				status: RESPONSES.NOTFOUND,
			};
		} catch (err) {
			return { error: true, message: RES_MSG.ERROR };
		}
	}

	async fetchHistoricalData(symbol: string) {
		try {
			const response = await axios.get(environment.coinMarketApi, {
				params: {
					symbol: symbol,
					time_start: Math.floor(
						(Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000,
					), // 7 days ago in seconds
					time_end: Math.floor(Date.now() / 1000), // Current time in seconds
					convert: 'USD',
					apiKey: environment.coinMarketKey,
				},
			});

			const historicalData = response.data.data;
			return historicalData;
		} catch (error) {
			console.error(
				'Error fetching historical data from Coin Market Cap API:',
				error,
			);
			throw error;
		}
	}

	// Function to calculate average token price, percentage change, and loss percentage for 7 days
	// async calculateMetrics(historicalData) {
	// 	const prices = historicalData.map(entry => entry.quote.USD.close);

	// 	// Calculate percentage change
	// 	const percentageChange = ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100;

	// 	// Calculate loss percentage (if percentageChange is negative)
	// 	const lossPercentage = percentageChange < 0 ? Math.abs(percentageChange) : 0;

	// 	return { percentageChange, lossPercentage };
	//  }
	async tokenPriceDetail(payloads: {
		time: string;
		interval: number;
	}): Promise<IESResponse> {
		try {
			const currentDate = new Date();
			const today = new Date();

			if (payloads.time === 'd') {
				if (payloads.interval === 1) {
					currentDate.setDate(currentDate.getDate() - 1); // Subtract 1 day
					const hourlyPrices = (await prisma.coinmarketInfo.findMany({
						where: {
							createdAt: {
								gte: formatDate(currentDate),
								lte: formatDate(today),
							},
						},
						orderBy: {
							createdAt: 'asc',
						},
						select: {
							createdAt: true,
							price: true,
							volume24h: true,
							volumeChange24h: true,
							percentChange1h: true,
							percentChange24h: true,
							percentChange7d: true,
							percentChange30d: true,
						},
					})) as Array<{ createdAt: Date; price: string }>;

					const result: Array<{ createdAt: Date; price: string }> =
						[];
					let lastHour: Date | null = null;
					for (const record of hourlyPrices) {
						if (
							!lastHour ||
							(+record.createdAt - +lastHour) / 36e5 >= 1
						) {
							result.push(record);
							lastHour = record.createdAt;
						}

						if (result.length >= 24) {
							break;
						}
					}

					const latestEntry = await prisma.coinmarketInfo.findFirst({
						orderBy: {
							createdAt: 'desc', // Order by date in descending order
						},
						select: {
							price: true,
						},
					});
					const currentPrice = latestEntry?.price ?? 0;

					const groupedData: Record<
						string,
						Array<{ createdAt: Date; price: string }>
					> = {};

					result.forEach((entry) => {
						const date = entry.createdAt.toLocaleDateString();

						if (!groupedData[date]) {
							groupedData[date] = [];
						}
						groupedData[date].push(entry);
					});

					const results = Object.entries(groupedData).map(
						([date, entries]) => ({
							[date]: entries,
						}),
					);

					return {
						error: false,
						message: RES_MSG.TOKEN_HISTORY_SUCCESS,
						data: {
							finalData: results,
							currentPrice: currentPrice,
						},
					};
				}
				const daysAgo = payloads.interval;
				const fromDate = new Date(currentDate);
				fromDate.setDate(fromDate.getDate() - daysAgo);
				const startDate = formatDate(fromDate);

				const hourlyPrices = await prisma.coinmarketInfo.findMany({
					where: {
						createdAt: {
							gte: new Date(startDate),
						},
					},
					orderBy: {
						createdAt: 'asc',
					},
					select: {
						createdAt: true,
						price: true,
						volume24h: true,
						volumeChange24h: true,
						percentChange1h: true,
						percentChange24h: true,
						percentChange7d: true,
						percentChange30d: true,
					},
				});

				const latestEntry = await prisma.coinmarketInfo.findFirst({
					orderBy: {
						createdAt: 'desc', // Order by date in descending order
					},
					select: {
						price: true,
					},
				});
				const currentPrice = latestEntry?.price ?? 0;

				const groupedData: Record<
					string,
					Array<{ createdAt: Date; price: string }>
				> = {};

				hourlyPrices.forEach((entry) => {
					const date = entry.createdAt.toLocaleDateString();
					if (!groupedData[date]) {
						groupedData[date] = [];
					}
					groupedData[date].push(entry);
				});

				const result = Object.entries(groupedData).map(
					([date, entries]) => ({
						[date]: entries,
					}),
				);

				return {
					error: false,
					message: RES_MSG.TOKEN_HISTORY_SUCCESS,
					//data: result,
					data: { finalData: result, currentPrice: currentPrice },
				};
			} else if (payloads.time === 'y') {
				if (payloads.interval === 1) {
					currentDate.setFullYear(currentDate.getFullYear() - 1); // Subtract 1 year

					const dailyPrices = await prisma.coinmarketInfo.findMany({
						where: {
							createdAt: {
								gte: formatDateForYear(currentDate),
								lte: formatDateForYear(today),
							},
						},
						orderBy: {
							createdAt: 'asc',
						},
						select: {
							createdAt: true,
							price: true,
							volume24h: true,
							volumeChange24h: true,
							percentChange1h: true,
							percentChange24h: true,
							percentChange7d: true,
							percentChange30d: true,
						},
					});

					const latestEntry = await prisma.coinmarketInfo.findFirst({
						orderBy: {
							createdAt: 'desc', // Order by date in descending order
						},
						select: {
							price: true,
						},
					});
					const currentPrice = latestEntry?.price ?? 0;

					const groupedData: Record<
						string,
						Array<{ createdAt: Date; price: string }>
					> = {};

					dailyPrices.forEach((entry) => {
						const date = entry.createdAt.toLocaleDateString();
						const monthYear = `${entry.createdAt.getUTCFullYear()}-${String(
							entry.createdAt.getUTCMonth() + 1,
						).padStart(2, '0')}`;

						if (!groupedData[monthYear]) {
							groupedData[monthYear] = [];
						}
						groupedData[monthYear].push(entry);
					});

					const results = Object.entries(groupedData).map(
						([monthYear, entries]) => ({
							[monthYear]: entries,
						}),
					);

					return {
						error: false,
						message: RES_MSG.TOKEN_HISTORY_SUCCESS,
						data: {
							finalData: results,
							currentPrice: currentPrice,
						},
					};
				}
			}

			return {
				error: true,
				message: 'Invalid time interval',
			};
		} catch (error) {
			console.error('Error retrieving graph data:', error);
			throw error;
		}
	}

	getRedisValue = async (): Promise<
		| {
				supply: number;
				marketCap: number;
		  }
		| false
	> => {
		try {
			let supply;
			supply = await RedisService.getString(REDIS_KEY.CIRCULATING_SUPPLY);
			supply = supply === null ? 0 : supply;

			let marketCap;
			marketCap = await RedisService.getString(REDIS_KEY.MARKET_CAP);
			marketCap = marketCap === null ? 0 : marketCap;

			return {
				supply,
				marketCap,
			};
		} catch (err) {
			logger.error('Error while getting value  from redis ');
			return false;
		}
	};

	async getMarketCapHistory() {
		try {
			const obj: { supply: number; marketCap: number } = {
				supply: 0,
				marketCap: 0,
			};

			const data = await this.getRedisValue();
			if (data === false) {
				obj.supply = CONST_NAME.ZERO;
				obj.marketCap = CONST_NAME.ZERO;
			} else {
				obj.supply = data?.supply;
				obj.marketCap = data?.marketCap;
			}

			return {
				error: false,
				message: RES_MSG.MARKET_CAP_SUCCESS,
				data: { obj },
			};
		} catch (err) {
			if (err instanceof Error) {
				return { error: true, message: err.message };
			} else {
				return {
					error: true,
					message: RES_MSG.MARKET_CAP_HISTORY_ERROR,
				};
			}
		}
	}

	async getAccountCounts(payloads: {
		time: string;
		interval: number;
	}): Promise<IGraphResponse> {
		try {
			let { time, interval } = payloads;

			let { key, len } = STATS_CONVERTER[time][interval];

			if (!key || !len)
				return {
					error: false,
					message: RES_MSG.DATA_NOT_FOUND,
				};

			const [addrStats, addrCount] = await Promise.all([
				RedisService.getString(REDIS_KEY.NEW_ACCOUNT_HISTORY),
				RedisService.getString(REDIS_KEY.TOTAL_ADDRESSES),
			]);

			let _slice: any[] = addrStats[key];
			if (_slice) {
				_slice = _slice.slice(Math.max(_slice.length - len, 0));

				return {
					error: false,
					message: RES_MSG.ACCOUNT_HISTORY_SUCCESS,
					data: {
						finalData: _slice as Array<GraphData>,
						count: addrCount,
					},
				};
			}

			return {
				error: false,
				message: RES_MSG.DATA_NOT_FOUND,
			};
		} catch (err) {
			console.log(':getAccountCounts Error', err);
			return { error: true, message: RES_MSG.ERROR };
		}
	}

	async getCoinTransferCount(payloads: {
		time: string;
		interval: number;
	}): Promise<IGraphResponse> {
		try {
			let { time, interval } = payloads;

			let { key, len } = STATS_CONVERTER[time][interval];

			if (!key || !len)
				return {
					error: false,
					message: RES_MSG.DATA_NOT_FOUND,
				};

			const [coinTxnStats, coinTnxCount] = await Promise.all([
				RedisService.getString(REDIS_KEY.COIN_TRANSFER_TX_HISTORY),
				RedisService.getString(REDIS_KEY.TOTAL_COIN_TRANSFER_TX),
			]);

			let _slice: any[] = coinTxnStats[key];

			if (!!_slice) {
				_slice = _slice.slice(Math.max(_slice.length - len, 0));

				return {
					error: false,
					message: RES_MSG.SUCCESS,
					data: {
						finalData: _slice as Array<GraphData>,
						count: coinTnxCount,
					},
				};
			}

			return {
				error: false,
				message: RES_MSG.DATA_NOT_FOUND,
			};
		} catch (err) {
			console.log('Error in code', err);
			return { error: true, message: RES_MSG.ERROR };
		}
	}

	async getContractDeployedCount(payloads: {
		time: string;
		interval: number;
	}): Promise<IGraphResponse> {
		try {
			let { time, interval } = payloads;

			let { key, len } = STATS_CONVERTER[time][interval];

			if (!key || !len)
				return {
					error: false,
					message: RES_MSG.DATA_NOT_FOUND,
				};
			const [contractTxnStats, contractTnxCount] = await Promise.all([
				RedisService.getString(REDIS_KEY.CONTRACT_DEPLOYMENT_HISTORY),
				RedisService.getString(REDIS_KEY.TOTAL_CONTRACT_DEPLOYED_TX),
			]);

			let _slice: any[] = contractTxnStats[payloads.time.toLowerCase()];
			if (!!_slice) {
				_slice = _slice.slice(Math.max(_slice.length - len, 0));

				return {
					error: false,
					message: RES_MSG.SUCCESS,
					data: {
						finalData: _slice as Array<GraphData>,
						count: contractTnxCount,
					},
				};
			}

			return {
				error: false,
				message: RES_MSG.NOT_FOUND,
				status: RESPONSES.NOTFOUND,
			};
		} catch (err) {
			return { error: true, message: RES_MSG.ERROR };
		}
	}

	async dashboard(): Promise<IESResponse> {
		try {
			const data: any = await calculateData();
			console.log('data-dashboard', data);

			const [latest_block, transactionCount, userCount] =
				await Promise.all([
					Number(await web3Helper.getBlockNumber()),
					await prisma.transactions.count(),
					await prisma.users.count(),
				]);
			return {
				error: false,
				message: RES_MSG.SUCCESS,
				data: {
					apr: data?.apr ? Number(data?.apr) : 0,
					validators: data?.validator ? data?.validator : 0,
					circulationSupply: data?.circulationSupply
						? data.circulationSupply
						: 0,
					latest_block: latest_block,
					total_transactions: transactionCount,
					total_accounts: userCount,
				},
			};
		} catch (err) {
			console.log('dashboard-Error', err);
			return { error: true, message: RES_MSG.APR_VALUE_ERROR };
		}
	}
	async getTopValidator(): Promise<IESResponse> {
		try {
			// Try to get the cached result from Redis first
			const cachedData = await RedisService.getString(
				REDIS_KEY.TOP_VALIDATOR,
			);

			if (cachedData) {
				return {
					error: false,
					message: 'top validator fetched successfully',
					data: cachedData,
				};
			}

			const oneDayAgo = new Date();
			oneDayAgo.setDate(oneDayAgo.getDate() - 1);
			const result = await prisma.blocks.groupBy({
				by: ['miner'],
				_count: {
					blocknumber: true,
				},
				where: {
					createdAt: {
						gte: oneDayAgo,
					},
				},
				orderBy: {
					_count: {
						blocknumber: 'desc',
					},
				},
				take: 1,
			});
			if (result?.length == 0)
				throw new Error("'No data found for the last 24 hours.'");

			const topMiner = result[0].miner;
			const blockCount = result[0]._count.blocknumber;

			const data = {
				topMiner,
				blockCount,
			};

			// Store the result in Redis with a 24-hour expiration
			await RedisService.setString(REDIS_KEY.TOP_VALIDATOR, data);

			return {
				error: false,
				message: 'top validator fetch successfully',
				data,
			};
		} catch (err) {
			return { error: true, message: RES_MSG.APR_VALUE_ERROR };
		}
	}

	async getAddressDetail(address: string): Promise<IESResponse> {
		try {
			console.log('address: ', address);

			const [user] = await Promise.all([
				prisma.users.findFirst({
					where: {
						address: address,
					},
					select: {
						txn: true,
					},
				}),
			]);

			let txnCount = user ? user.txn : '';

			let userBalance;
			// Check if USER_BALANCE is in Redis
			// let userBalance = await RedisService.getString(
			// 	REDIS_KEY.USER_BALANCE,
			// );
			try {
				userBalance = (
					await Web3Helper.getBalance(
						Web3.utils.toChecksumAddress(address),
					)
				).toString();

				// Store userBalance in Redis
				// await RedisService.setString(
				// 	REDIS_KEY.USER_BALANCE,
				// 	userBalance,
				// );
			} catch (error) {
				userBalance = '';
			}
			const actualBalance = userBalance
				? (Number(userBalance) / Math.pow(10, 18)).toString()
				: '';

			let marketCapPrice = await RedisService.getString(
				CONST_NAME.MARKET_CAP_PRICE,
			);

			let value: string;
			if (!marketCapPrice) {
				const latestEntry = await prisma.coinmarketInfo.findFirst({
					orderBy: {
						id: 'desc',
					},
					select: {
						price: true,
					},
				});

				console.log('latestEntry?.price: ', latestEntry?.price);

				const price = latestEntry?.price?.toString() ?? '';
				value = price
					? (Number(price) * Number(actualBalance)).toString()
					: '';
			} else {
				marketCapPrice = JSON.parse(marketCapPrice);

				value =
					marketCapPrice?.price && actualBalance
						? (
								Number(marketCapPrice?.price) *
								Number(actualBalance)
							).toString()
						: '';
			}

			return {
				error: false,
				message: RES_MSG.SUCCESS,
				data: {
					coinBalance: exp(actualBalance),
					value: exp(value),
					transactionCount: Number(txnCount),
				},
			};
		} catch (err) {
			console.log('error : ', err);

			return {
				error: true,
				message: err instanceof Error ? err.message : RES_MSG.ERROR,
			};
		}
	}

	async getTxFeeSum(payloads: {
		time: string;
		interval: number;
	}): Promise<IGraphResponse> {
		try {
			let { time, interval } = payloads;
			let { key, len } = STATS_CONVERTER[time][interval];

			if (!key || !len)
				return {
					error: false,
					message: RES_MSG.DATA_NOT_FOUND,
				};

			const [TxnFeeStats] = await Promise.all([
				RedisService.getString(REDIS_KEY.TX_FEE_HISTORY),
			]);

			let _slice: any[] = TxnFeeStats[key];

			if (!!_slice) {
				_slice = _slice.slice(Math.max(_slice.length - len, 0));

				return {
					error: false,
					message: RES_MSG.TRANSACTION_FEE_SUCCESS,
					data: {
						finalData: _slice as Array<GraphData>,
						count: 0,
					},
				};
			}

			return {
				error: false,
				message: RES_MSG.DATA_NOT_FOUND,
			};
		} catch (err) {
			console.log('tx-fee', err);
			return { error: true, message: RES_MSG.ERROR };
		}
	}
}

export default new ExplorerService();
