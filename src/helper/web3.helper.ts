import Web3 from 'web3';
import { BLOCKCHAIN_ERROR_MSG } from '../constant/response';
import { IRawTransaction } from '../interfaces/index';
import logger from '../lib/logger';

class Web3Helper {
	public web3: Web3;

	public endPoint: string;

	constructor() {
		this.init();
	}

	async init() {
		try {
			this.web3 = new Web3(
				new Web3.providers.HttpProvider(environment.RPCURL),
			);
			return true;
		} catch (error) {
			logger.error('Here s the errror', error);
			return false;
		}
	}

	async getBlockNumber() {
		try {
			return await this.web3.eth.getBlockNumber();
		} catch (err) {
			logger.error('error while getBlockNumber : ', err);
			throw new Error(BLOCKCHAIN_ERROR_MSG.BLOCK_NUMBER_FETCH);
		}
	}

	async getDetailByBlockNumber(latestBlock: number | string) {
		try {
			const res = await this.web3.eth.getBlock(latestBlock);
			return res;
		} catch (err) {
			logger.error('error while getDetailByBlockNumber : ', err);
			throw new Error(BLOCKCHAIN_ERROR_MSG.BLOCK_NUMBER_FETCH);
		}
	}

	async getTxByHash(txHash: string): Promise<any> {
		try {
			return await this.web3.eth.getTransaction(txHash);
		} catch (err) {
			logger.error('error while getTxByHash : ', err);
			throw new Error(BLOCKCHAIN_ERROR_MSG.TRANSACTION_FETCH);
		}
	}

	async getTransactionReceipt(hash: string) {
		try {
			const res = await this.web3.eth.getTransactionReceipt(hash);
			return res;
		} catch (err) {
			logger.error('error while getTransactionCount : ', err);
			throw new Error(BLOCKCHAIN_ERROR_MSG.TRANSACTION_FETCH);
		}
	}

	async getBalance(publicKey: string) {
		try {
			return await this.web3.eth.getBalance(publicKey);
		} catch (err) {
			logger.error('error while getting balance : ', err);
			throw new Error(BLOCKCHAIN_ERROR_MSG.SIGN_AND_SEND);
		}
	}

	async getTransactionCount(publicKey: string, nonceType: string = '') {
		try {
			return await this.web3.eth.getTransactionCount(
				publicKey,
				nonceType,
			);
		} catch (err) {
			logger.error('error while getTransactionCount : ', err);
			throw new Error(BLOCKCHAIN_ERROR_MSG.SIGN_AND_SEND);
		}
	}

	async getAccount(privateKey: string) {
		try {
			return this.web3.eth.accounts.privateKeyToAccount(privateKey);
		} catch (err) {
			logger.error('getAccount error : ', err);
			throw new Error(BLOCKCHAIN_ERROR_MSG.INVALID_ADDRESS);
		}
	}

	async signTransaction(rawTransaction: IRawTransaction, privateKey: string) {
		try {
			return await this.web3.eth.accounts.signTransaction(
				rawTransaction,
				privateKey,
			);
		} catch (err) {
			logger.error('error signTransaction : ', err);
			throw new Error(BLOCKCHAIN_ERROR_MSG.SIGN_AND_SEND);
		}
	}

	async sendSignedTransaction(rawTransaction: string) {
		try {
			return await this.web3.eth.sendSignedTransaction(rawTransaction);
		} catch (err) {
			logger.error('error sendSignedTransaction: ', err);
			throw new Error(BLOCKCHAIN_ERROR_MSG.SIGN_AND_SEND);
		}
	}

	async getPeerCount() {
		try {
			return await this.web3.eth.net.getPeerCount();
		} catch (err) {
			logger.error('error getPeerCount : ', err);
			throw new Error(BLOCKCHAIN_ERROR_MSG.GET_ACCOUNT);
		}
	}

	isValidAddress(address: string) {
		try {
			Web3.utils.toChecksumAddress(address);
			return true;
		} catch (error) {
			logger.error('error isValidAddress : ', error);
			throw new Error(BLOCKCHAIN_ERROR_MSG.INVALID_ADDRESS);
		}
	}
}

const web3Helper = new Web3Helper();
export default web3Helper;
