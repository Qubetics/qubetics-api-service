import { Router } from 'express';
import {
	TRANSACTION_STATUS,
	TransactionType,
	TRANSACTION_TYPE,
} from '../constant/response';

export interface IESResponse {
	error?: boolean;
	data?: object | object[];
	message?: string;
	status?: number;
}
export interface ITransactionData {
	txhash: string;
	blocknumber: number;
	blockhash: string;
	gasPrice: number;
	gas: number;
	type: TRANSACTION_TYPE;
	status: TRANSACTION_STATUS;
	fromAddress: string;
	toAddress: string;
	token?: string;
	contractAddress?: string;
	timestamp: number;
	value: string;
	txFee: string;
	createdAt?: Date;
}
export interface IUsers {
	address: string;
	id?: number;
	txn?: number;
}
export interface GraphData {
	createdAt: string;
	count: number;
	total_account?: number;
}
export interface GraphDataTotal {
	finalData: GraphData[];
	count: number;
}
export interface IGraphResponse {
	error?: boolean;
	data?: GraphDataTotal;
	message?: string;
	status?: number;
}
export interface Controller {
	router: Router;
}
export interface ISearchPayload {
	page?: number;
	limit?: number;
	address?: string;
	value?: string;
	contractAddress?: string;
	blockNumber?: bigint;
}
export interface IRawTransaction {
	from: string;
	to: string;
	maxFeePerGas: number;
	maxPriorityFeePerGas: number;
	value: string;
	gas: number;
	nonce: number;
}
export interface IContractLog {
	contractAddress: string;
	creator: string;
	contractName: string;
	contractType: string;
	createdAt: Date;
	blockNumber: number | bigint;
	timeStamp: number | bigint;
}

export interface IContract {
	blockNumber: number;
	blockHash: string;
	txHash: string;
	contractName: string;
	contractType: string;
	creator: string;
	address: string;
	timestamp: number;
	bytecode: string;
	createdAt: Date;
	updatedAt: Date;
}
export interface IPopularContractAddress extends IContractLog {
	count: number;
}

export interface CoinMarketData {
	price: number;
	volume_24h: number;
	market_cap: number;
	circulating_supply: number;
}

export interface Params {
	annualProvisions: number;
	blocksPerYear: number;
	inflation: string;
	bondedTokens: number;
	communityTax: number;
	validator: number;
	circulation_supply: number;
}

export interface BlockHeader {
	height: number;
	time: Date;
}
export interface IBlock {
	blocknumber: number;
	gasLimit: number;
	gasUsed: number;
	nonce: number;
	deposit: number;
	transfer: number;
	blockhash: string;
	parentHash: string;
	stateRoot: string;
	timestamp: Date;
	transactionCount: number;
	miner: string;
	transactionsRoot: string;
	baseFeePerGas: number;
	receiptsRoot: string;
	sha3Uncles: string;
	size: number;
	createdAt: Date;
}
export interface ITransaction {
	txhash: string;
	blocknumber: number;
	blockhash: string;
	gasPrice: number;
	gas: number;
	type: TransactionType;
	status: TRANSACTION_STATUS;
	fromAddress: string;
	toAddress: string;
	contractAddress: string;
	value: string;
	txFee: string;
	createdAt: Date;
}
export interface ICoinTransaction {
	txhash: string;
	blocknumber: string;
	blockhash: string;
	gasPrice: string;
	gas: string;
	fromAddress: string;
	createdAt: Date;
	toAddress: string;
	status: string;
	value: string;
}
export interface IContracts {
	blockNumber: number;
	blockHash: string;
	fromAddress: string;
	contractAddress: string;
	txHash: string;
	contractName: string;
	isErc20?: boolean;
	isErc720?: boolean;
}
export interface EventDetail {
	transactionhash: string;
	contractName: string;
	contractSymbol: string;
	gasFee: number;
	nonce: number;
	contractAddress: string;
	blockhash: string;
	blocknumber: number;
	value: string;
	topics: string[]; // Update with the actual type of 'topics'
	transactionIndex: number;
	logIndex: number;
	removed: boolean;
	textSignature: string;
	method: string;
	isInternal: number;
	creator: string;
	status: string;
}
interface ILocation {
	lat: string;
	lon: string;
	country: string;
}
interface ISoftware {
	full: string;
	version: string;
	networkId: string;
}
export interface IPeerData {
	peerId: string;
	roles: string;
	protocolVersion: string;
	bestHash: string;
	bestNumber: string;
	version: string;
	nodeName: string;
	software: ISoftware;
	location: ILocation;
}

export interface HolderData {
	contractAddress: string;
	tokenBalance: string;
	contract?:
		| {
				contractName: string;
				contractType: string;
				Tokens?: {
					tokenSymbol: string;
				};
		  }
		| undefined;
}
