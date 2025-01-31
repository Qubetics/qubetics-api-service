import * as express from 'express';
import { Request, Response } from 'express';
import * as Helpers from '../../service/index';
import ContractService from './contract.service';
import { Controller } from '../../interfaces/index';
import {
	getContractValidation,
	getContractByAddressValidation,
	getContractTxValidation,
	getContractIconUrls,
} from './contract.validation';

const setResponse = Helpers.ResponseHelper;

class ContractController implements Controller {
	public router = express.Router();

	constructor() {
		this.initializeRoutes();
	}

	private initializeRoutes() {
		this.router
			.get('/all-contracts', getContractValidation, this.getAllContract)
			.post(
				'/all-contracts-icon',
				getContractIconUrls,
				this.getContractIcon,
			)
			.get(
				'/contract-detail-by-address/:contractAddress',
				getContractByAddressValidation,
				this.getContractByAddress,
			)
			.get(
				'/all-transaction',
				getContractTxValidation,
				this.getContractTransaction,
			)
			.get(
				'/get-internal-tx',
				getContractTxValidation,
				this.getInternalTx,
			)
			.get('/popular', getContractValidation, this.getPopularTx)
			.get('/events', getContractTxValidation, this.getContractEvents)
			.get('/transfer', getContractTxValidation, this.getContractTransfer)
			.get('/search/*', getContractValidation, this.searchContractToken)

			.get(
				'/search-get/*',
				getContractValidation,
				this.searchContractToken_,
			);
		// https://api.evm.qa.5ire.network/5ire/contracts/search/0xeE02101Da362c9bFc616F72AbF8301Ba94f3C4fe?page=1&limit=10;
	}

	private getAllContract = async (request: Request, response: Response) => {
		const data = {
			page: request.query?.page ? Number(request.query?.page) : 1,
			limit: !request.query?.limit ? 10 : Number(request.query?.limit),
			order: request.query?.order ? request.query.order : 'desc',
		};

		const contracts = await ContractService.getAllContract(data);

		if (contracts.error) {
			return setResponse.error(response, contracts);
		}
		return setResponse.success(response, contracts);
	};

	private getContractIcon = async (request: any, response: Response) => {
		const contracts = await ContractService.getContractIcon(request.body);

		if (contracts.error) {
			return setResponse.error(response, contracts);
		}
		return setResponse.success(response, contracts);
	};

	private getContractByAddress = async (
		request: Request,
		response: Response,
	) => {
		const contractByAddress = await ContractService.getContractByAddress(
			request.params?.contractAddress,
		);

		if (contractByAddress.error) {
			return setResponse.error(response, contractByAddress);
		}
		return setResponse.success(response, contractByAddress);
	};

	private getContractTransaction = async (
		request: Request,
		response: Response,
	) => {
		const data = {
			page: !request.query?.page ? 0 : Number(request.query.page) - 1,
			limit: !request.query?.limit ? 10 : Number(request.query.limit),
			contractAddress: <string>request.query?.contractAddress,
		};
		const contractTx = await ContractService.getContractTransaction(data);
		if (contractTx.error) {
			return setResponse.error(response, contractTx);
		}
		return setResponse.success(response, contractTx);
	};

	private getInternalTx = async (request: Request, response: Response) => {
		const data = {
			page: !request.query?.page ? 0 : Number(request.query.page) - 1,
			limit: !request.query?.limit ? 10 : Number(request.query.limit),
			contractAddress: <string>request.query.contractAddress,
		};
		const internalTx = await ContractService.getInternalTx(data);

		if (internalTx.error) {
			return setResponse.error(response, internalTx);
		}
		return setResponse.success(response, internalTx);
	};

	private getPopularTx = async (request: Request, response: Response) => {
		const data = {
			page: !request.query?.page ? 0 : Number(request.query.page) - 1,
			limit: !request.query?.limit ? 10 : Number(request.query.limit),
		};

		const popularTx = await ContractService.getPopularTx(data);

		if (popularTx.error) {
			return setResponse.error(response, popularTx);
		}
		return setResponse.success(response, popularTx);
	};

	private getContractTransfer = async (
		request: Request,
		response: Response,
	) => {
		const data = {
			page: !request.query?.page ? 0 : Number(request.query.page) - 1,
			limit: !request.query?.limit ? 10 : Number(request.query.limit),
			contractAddress: <string>request.query.contractAddress,
		};

		const popularTx = await ContractService.getContractTransfer(data);

		if (popularTx.error) {
			return setResponse.error(response, popularTx);
		}
		return setResponse.success(response, popularTx);
	};
	private getContractEvents = async (
		request: Request,
		response: Response,
	) => {
		const data = {
			page: !request.query?.page ? 0 : Number(request.query.page) - 1,
			limit: !request.query?.limit ? 10 : Number(request.query.limit),
			contractAddress: <string>request.query.contractAddress,
		};

		const popularTx = await ContractService.getContractEvents(data);

		if (popularTx.error) {
			return setResponse.error(response, popularTx);
		}
		return setResponse.success(response, popularTx);
	};

	private searchContractToken = async (
		request: Request,
		response: Response,
	) => {
		const data: any = {
			page: !request.query?.page ? 0 : Number(request.query.page),
			limit: !request.query?.limit ? 10 : Number(request.query.limit),
			contractName: <string>request.params[0], // to get the params
			order: request.query?.order ? request.query.order : 'desc',
		};

		const searchContractToken =
			await ContractService.getContractsTokens(data);

		if (searchContractToken.error) {
			return setResponse.error(response, searchContractToken);
		}
		return setResponse.success(response, searchContractToken);
	};

	private searchContractToken_ = async (
		request: Request,
		response: Response,
	) => {
		const data = {
			page: !request.query?.page ? 0 : Number(request.query.page) - 1,
			limit: !request.query?.limit ? 10 : Number(request.query.limit),
			contractName: <string>request.params[0], // to get the params
		};
		console.log(data.contractName, 'contractName-searchContractToken');
		const searchContractToken =
			await ContractService.getContractsTokens_(data);

		if (searchContractToken.error) {
			return setResponse.error(response, searchContractToken);
		}
		return setResponse.success(response, searchContractToken);
	};
}

export default ContractController;
