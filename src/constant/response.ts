export const RESPONSES = {
	SUCCESS: 200,
	CREATED: 201,
	ACCEPTED: 202,
	NOCONTENT: 204,
	BADREQUEST: 400,
	UN_AUTHORIZED: 401,
	FORBIDDEN: 403,
	NOTFOUND: 404,
	TIMEOUT: 408,
	TOO_MANY_REQ: 429,
	INTERNAL_SERVER: 500,
	BADGATEWAYS: 502,
	SERVICEUNAVILABLE: 503,
	GATEWAYTIMEOUT: 504,
};

export const RATE_LIMITER_MESSAGE = {
	TOO_MANY_REQUEST:
		'You are doing too many request. Please try again in 5 minutes.',
	WINDOW_MS: 5 * 60 * 1000, // 5 minutes  600000, // 10 minutes in milliseconds
	MAX: 20, // 20 request in 10 minutes
};

export const RES_MSG = {
	USER_ADDED: 'user save successfully',
	PEER_FETCH: 'peer fetch successfully',
	DATA_FETCH: 'data fetched successfully',
	ALL_BLOCK_FETCH: 'block fetched successfully',
	ALL_VALIDATOR_FETCH: 'block fetched successfully',
	INVALID_BLOCK_NUMBER: 'invalid block number',
	INVALID_BLOCK_HASH: 'invalid block hash',
	USER_NOT_FOUND: 'user not found',
	BLOCK_NOT_FOUND: 'block not found',
	VALIDATOR_NOT_FOUND: 'validator not found',
	CONTRACT_NOT_FOUND: 'contract not found',
	CONTRACT_TX_NOT_FOUND: 'data not found',
	ACCOUNT_HISTORY_SUCCESS: 'account history fetched successfully',
	MARKET_CAP_HISTORY_SUCCESS: 'market cap history fetched successfully',
	MARKET_CAP_HISTORY_ERROR: 'market cap history fetched unsuccessfully',
	TRANSACTION_HISTORY_SUCCESS: 'transaction history fetched successfully',
	BLOCK_FETCH: 'block fetched successfully',
	BLOCK_TRANSACTION_FETCH: 'block transactions fetched successfully',
	CONTRACT: 'contract fetched successfully',
	// TOKENS: 'tokens fetched successfully',
	CONTRACT_TX: 'conract transaction fetched successfully',
	POPULAR_TX_SUCCESS: 'popular transaction fetch successfully',
	MARKET_CAP_SUCCESS: 'market cap fetched successfully',
	EXCEEDS_BALANCE:
		'we could not transfer balance because you have already exceeded the max amount of qubetics coin',
	ERROR: 'Oops! Something went wrong. Please try again.',
	FAUCET_ACCOUNT_BALANCE_LOW: 'faucet account balance too low',
	FAUCET_MSG: 'only 1 transaction is allowed for 24 Hrs.',
	INVALID_PRIVATE_KEY: 'invalid private key.',
	INVALID_HASH: 'hash is not valid',
	NOT_VALID_BLOCK_NUMBER: 'block number is not valid',
	NOT_VALID_QUERY: 'query is not valid',
	NOT_FOUND: 'data not found',
	SERVER_ERROR: 'internal server error',
	SUCCESS: 'Success',
	// TOKEN: 'token fetched successfully',
	// TOKEN_NOT_FOUND: 'token not found',
	TRANSACTION_NOT_FOUND: 'transaction not found',
	TRANSACTION_FETCH_SUCCESS: 'transaction fetched successfully',
	TRANSACTION_DONE: 'transaction successful',
	TPS_HISTORY_SUCCESS: 'TPS history fetched successfully',
	TOKEN_HISTORY_SUCCESS: 'token history fetched successfully',
	INVALID_USER_ERROR: 'you are not genuine user',
	CAPTCHA_ERROR: 'invalid captcha',
	APR_VALUE_SUCCESS: 'APR value and validators count fetched successfully',
	APR_VALUE_ERROR:
		'error occur while fetching APR value and validators count',
	VALIDATOR_ERROR: 'Error occurred while getting validator details',
	TOKEN_FETCH_ERROR: 'error occured while fetch token detail',
};

export const BLOCKCHAIN_ERROR_MSG = {
	BLOCK_NUMBER_FETCH: 'error occured while fetching block number',
	TRANSACTION_FETCH: 'error occured while fetching transaction detail',
	GET_BALANCE: 'error occured while fetching balance detail',
	TRANSACTION_COUNT: 'error occured while fetching transaction count',
	GET_ACCOUNT: 'error occured while fetching account detail',
	INVALID_ADDRESS: 'invalid address',
	SIGN_AND_SEND: 'error while fund transfer',
};

export const CONST_NAME = {
	TOTAL_NODE: 'total_node_res',
	LATEST_BLOCK: 'latestBlock',
	FEES: 5,
	THOUSAND: 1000,
	HUNDRED: 100,
	ZERO: 0,
	ONE: 1,
	SLICED_VALUE: 200,
	MAX_FEES: 8,
	MAX_PRIORIY_FEES: 8,
	GAS: 21000,
	EXPIRE_TIME: 24 * 60 * 60,
	SUCCESS_STATUS: 'success',
	FAILED_STATUS: 'Failed',
	PENDING_STATUS: 'Pending',
	NA: 'N/A',
	YEAR_MILI_SEC: 31536000000,
	BLOCK_PER_YEAR: 365 * 24 * 60 * 60,
	ETH_EXP: 10 ** 18,
	NOT_FOUND: 'not found',
	MARKET_CAP_PRICE: 'MARKET_CAP_PRICE',
	BOND_STATUS: 'BOND_STATUS_BONDED',
};

export const TRANSFER_TYPE = {
	DIRECT_TRANSFER: 'COIN_TRANSFER',
	CONTRACT_CREATION: 'CONTRACT_CREATION',
	CONTRACT_TRANSFER: 'CONTRACT_TRANSFER',
};

export const AUTH = {
	OTP_EXPIRATION_TIME: 5 * 60 * 1000,
};
export const GET_CONTRACT = {
	contractAddress: true,
	// creator: true,
	// contractName: true,
	// contractType: true,
	createdAt: true,
	// timeStamp:true,
	blockNumber: true,
};
export const CONTRACTLOGS = {
	txHash: true,
	contractAddress: true,
	blockHash: true,
	blockNumber: true,
	method: true,
	methodSignature: true,
	gasFee: true,
	status: true,
	timestamp: true,
	createdAt: true,
};

export const CONTRACT = {
	timestamp: true,
	contractName: true,
	contractType: true,
	blockHash: true,
	blockNumber: true,
	creator: true,
	address: true,
	txHash: true,
	createdAt: true,
	updatedAt: true,
};
export const ASC = 'asc';
export const DESC = 'desc';

export const REDIS_KEY = {
	PENDING_TX: 'PENDING_TRANSACTION',
	TPS_GRAPH: 'TPS_GRAPH_PAYLOAD',
	TOKEN_GRAPH: 'TOKEN_GRAPH_PAYLOAD',
	ACCOUNT_GRAPH: 'ACCOUNT_GRAPH_PAYLOAD',
	COIN_TRANSFER_GRAPH: 'COIN_TRANSFER_GRAPH_PAYLOAD',
	CONTRACT_DEPLOY_GRAPH: 'CONTRACT_DEPLOY_GRAPH_PAYLOAD',
	CIRCULATING_SUPPLY: 'CIRCULATING_SUPPLY',
	MARKET_CAP: 'MARKET_CAP',
	TOTAL_BLOCKS: 'TOTAL_BLOCKS',
	TOTAL_TOKENS: 'TOTAL_TOKENS',
	TOTAL_ADDRESSES: 'TOTAL_ADDRESSES',
	TOTAL_TOKEN_PRICE: 'TOTAL_TOKEN_PRICE',
	TOTAL_COIN_TRANSFER_TX: 'TOTAL_COIN_TRANSFER_TX',
	TOTAL_CONTRACT_DEPLOYED_TX: 'TOTAL_CONTRACT_DEPLOYED_TX',
	TOTAL_CONTRACT_LOGS: 'TOTAL_CONTRACT_LOGS',
	USER_BALANCE: 'USER_BALANCE',
	BLOCKS_COUNT: 'BLOCKS_COUNT',
	TRANSACTIONS_COUNT: 'TRANSACTIONS_COUNT',

	TOP_VALIDATOR: 'TOP_VALIDATOR',

	// stats
	TX_HISTORY: 'TxHistory',
	NEW_ACCOUNT_HISTORY: 'NewAccountHistory',
	COIN_TRANSFER_TX_HISTORY: 'CoinTransferTxHistory',
	CONTRACT_DEPLOYMENT_HISTORY: 'ContractDeploymentHistory',
	STAST_GENERATED: 'StatsGenerated',
};

export const QUEUE_NAME = {
	MISSING_BLOCK: 'MISSING_BLOCK',
	VALIDATOR_DETAIL: 'VALIDATOR_DETAIL',
	CONTRACT_DEPLOY_DETAIL: 'CONTRACT_DEPLOY_DETAIL',
};

export enum TransactionStatus {
	PENDING = 'PENDING',
	SUCCESS = 'SUCCESS',
	FAILED = 'FAILED',
}

export enum TransactionType {
	COIN_TRANSFER = 'COIN_TRANSFER',
	CONTRACT_CREATION = 'CONTRACT_CREATION',
	CONTRACT_TRANSFER = 'CONTRACT_TRANSFER',
}

export enum TRANSACTION_STATUS {
	PENDING = 'PENDING',
	SUCCESS = 'SUCCESS',
	FAILED = 'FAILED',
}
export const countriesData = [
	{
		name: 'Canada',
		lat: 56.1304,
		lon: -106.3468,
	},
	{
		name: 'United Kingdom',
		lat: 55.3781,
		lon: -3.436,
	},
	{
		name: 'Japan',
		lat: 36.2048,
		lon: -138.2529,
	},
	{
		name: 'India',
		lat: 20.5937,
		lon: -78.9629,
	},
	{
		name: 'Australia',
		lat: 25.2744,
		lon: -133.7751,
	},
	{
		name: 'china',
		lat: 35.8617,
		lon: -104.1954,
	},
];
export const nodeIpDetail = {
	node_info: {
		protocol_version: { p2p: '8', block: '11', app: '0' },
		id: '65962c794ccf6d0aa51453ddcbaf3f51386b80c0',
		listen_addr: 'tcp://0.0.0.0:26656',
		network: 'qubetics_9006-1',
		version: 'v0.34.24',
		channels: '40202122233038606100',
		moniker: 'qubeticsnode',
		other: { tx_index: 'on', rpc_address: 'tcp://0.0.0.0:26657' },
	},
	is_outbound: true,
	connection_status: {
		Duration: '677415308125874',
		SendMonitor: [],
		RecvMonitor: [],
		Channels: [],
	},
	remote_ip: environment.nodeIp,
};

export enum TRANSACTION_TYPE {
	COIN_TRANSFER = 'COIN_TRANSFER',
	CONTRACT_CREATION = 'CONTRACT_CREATION',
	CONTRACT_TRANSFER = 'CONTRACT_TRANSFER',
}
