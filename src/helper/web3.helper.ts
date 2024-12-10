import Web3 from 'web3';
import { BLOCKCHAIN_ERROR_MSG } from '../constant/response';
import { IRawTransaction } from '../interfaces/index';

class Web3Helper {
	public web3: Web3;

	public endPoint: string;

	constructor() {
		this.init();
	}

	async init() {
		try {
			this.web3 = new Web3(
				new Web3.providers.HttpProvider(environment.nodeLink),
			);
		} catch (Error) {
			console.log('Here s the errror', Error);
		}
	}

	async getBlockNumber() {
		try {
			return await this.web3.eth.getBlockNumber();
		} catch (err) {
			throw new Error(BLOCKCHAIN_ERROR_MSG.BLOCK_NUMBER_FETCH);
		}
	}

	async getDetailByBlockNumber(latestBlock: number | string) {
		try {
			const res = await this.web3.eth.getBlock(latestBlock);
			return res;
		} catch (err) {
			throw new Error(BLOCKCHAIN_ERROR_MSG.BLOCK_NUMBER_FETCH);
		}
	}

	async getTxByHash(txHash: string): Promise<any> {
		try {
			return await this.web3.eth.getTransaction(txHash);
		} catch (err) {
			throw new Error(BLOCKCHAIN_ERROR_MSG.TRANSACTION_FETCH);
		}
	}

	async getTransactionReceipt(hash: string) {
		try {
			const res = await this.web3.eth.getTransactionReceipt(hash);
			return res;
		} catch (err) {
			throw new Error(BLOCKCHAIN_ERROR_MSG.TRANSACTION_FETCH);
		}
	}

	async getBalance(publicKey: string) {
		try {
			return await this.web3.eth.getBalance(publicKey);
		} catch (err) {
			console.log('error while getting balance : ', err);

			if (err instanceof Error) {
				throw new Error(err.message);
			} else {
				throw new Error(BLOCKCHAIN_ERROR_MSG.GET_BALANCE);
			}
		}
	}

	async getTransactionCount(publicKey: string) {
		try {
			return await this.web3.eth.getTransactionCount(publicKey);
		} catch (err) {
			throw new Error(BLOCKCHAIN_ERROR_MSG.TRANSACTION_COUNT);
		}
	}

	async getAccount(privateKey: string) {
		try {
			const account =
				await this.web3.eth.accounts.privateKeyToAccount(privateKey);
			return account;
		} catch (err) {
			console.log('getAccount error : ', err);
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
			console.log('error : ', err);
			throw new Error(BLOCKCHAIN_ERROR_MSG.SIGN_AND_SEND);
		}
	}

	async sendSignedTransaction(rawTransaction: string) {
		try {
			return await this.web3.eth.sendSignedTransaction(rawTransaction);
		} catch (err) {
			console.log('error : ', err);

			throw new Error(BLOCKCHAIN_ERROR_MSG.SIGN_AND_SEND);
		}
	}

	async getPeerCount() {
		try {
			return await this.web3.eth.net.getPeerCount();
		} catch (err) {
			throw new Error(BLOCKCHAIN_ERROR_MSG.GET_ACCOUNT);
		}
	}

	isValidAddress(address: string) {
		try {
			Web3.utils.toChecksumAddress(address);
			return true;
		} catch (error) {
			throw new Error(BLOCKCHAIN_ERROR_MSG.INVALID_ADDRESS);
		}
	}
}
export default new Web3Helper();
