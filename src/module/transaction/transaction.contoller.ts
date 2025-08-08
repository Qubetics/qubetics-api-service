import * as express from 'express';
import { Request, Response } from 'express';
import * as Helpers from '../../service/index';
import TransactionService from './transaction.service';
import { Controller } from '../../interfaces/index';
import {
	getTxValidation,
	getTxByHashValidation,
	getTxByAddressValidation,
	getTxByBlock,
} from './transaction.validation';
const setResponse = Helpers.ResponseHelper;

class ExplorerController implements Controller {
	public router = express.Router();

	constructor() {
		this.initializeRoutes();
	}

	private initializeRoutes() {
		this.router
			.get(
				'/get-all-transactions',
				getTxValidation,
				this.getAllTransaction,
			)
			.get(
				'/hash/:transactionHash',
				getTxByHashValidation,
				this.getTransactionByHash,
			)
			.get(
				'/get-transaction-by-address',
				getTxByAddressValidation,
				this.getTransactionByAddress,
			)
			.get(
				'/get-transaction-by-block',
				getTxByBlock,
				this.getTransactionByBlock,
			)
			.get(`/erc-20`, getTxValidation, this.getErc20Transaction)
			.get(
				'/internal/:transactionHash',
				getTxByHashValidation,
				this.getInternalTransactionsByHash,
			);
	}

	private getAllTransaction = async (
		request: Request,
		response: Response,
	) => {
		const data = {
			page: request.query?.page ? Number(request.query?.page) : 1,
			order: request.query?.order ? request.query?.order : 'desc',
			limit: !request.query?.limit ? 10 : Number(request.query?.limit),
		};

		const res = await TransactionService.getAllTransaction(data);

		if (res.error) {
			return setResponse.error(response, res);
		}
		return setResponse.success(response, res);
	};

	private getTransactionByHash = async (
		request: Request,
		response: Response,
	) => {
		const transactionByHash = await TransactionService.getTransactionByHash(
			request.params?.transactionHash,
		);

		if (transactionByHash.error) {
			return setResponse.error(response, transactionByHash);
		}
		return setResponse.success(response, transactionByHash);
	};

	private getTransactionByAddress = async (
		request: Request,
		response: Response,
	) => {
		const data = {
			page: !request.query?.page ? 1 : Number(request.query.page),
			limit: !request.query?.limit ? 10 : Number(request.query.limit),
			address: <string>request.query.address,
		};
		const transactionByAddress =
			await TransactionService.getTransactionByAddress(data);
		if (transactionByAddress.error) {
			return setResponse.error(response, transactionByAddress);
		}
		return setResponse.success(response, transactionByAddress);
	};

	private getTransactionByBlock = async (
		request: Request,
		response: Response,
	) => {
		const data = {
			page: !request.query?.page ? 0 : Number(request.query.page) - 1,
			limit: !request.query?.limit ? 10 : Number(request.query.limit),
			value: !request.query.value ? '' : <string>request.query.value,
		};
		const transactionByBlock =
			await TransactionService.getTransactionByBlock(data);

		if (transactionByBlock.error) {
			return setResponse.error(response, transactionByBlock);
		}
		return setResponse.success(response, transactionByBlock);
	};

	private getErc20Transaction = async (
		request: Request,
		response: Response,
	) => {
		const data = {
			page: !request.query?.page ? 0 : Number(request.query.page) - 1,
			limit: !request.query?.limit ? 10 : Number(request.query.limit),
		};
		const res = await TransactionService.getErc20Transaction(data);

		if (res.error) {
			return setResponse.error(response, res);
		}
		return setResponse.success(response, res);
	};

	private getInternalTransactionsByHash = async (
		request: Request,
		response: Response,
	) => {
		const data = {
			page: !request.query?.page ? 0 : Number(request.query.page) - 1,
			limit: !request.query?.limit ? 10 : Number(request.query.limit),
			hash: <string>request.params.transactionHash,
		};
		const res = await TransactionService.getInternalTxnsByHash(data);
		if (res.error) {
			return setResponse.error(response, res);
		}
		return setResponse.success(response, res);
	};
}

export default ExplorerController;
