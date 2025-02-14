import * as express from 'express';
import tokenService from './token.service';
import { Request, Response } from 'express';
import * as Helpers from '../../service/index';
import { Controller } from '../../interfaces/index';
import {
	getTokenValidation,
	getTokensValidation,
	getTokenValidationWithAddress,
} from './token.validation';
import {
	getContractByAddressValidation,
	getContractTxValidation,
} from '../contract/contract.validation';

const setResponse = Helpers.ResponseHelper;

class TokenController implements Controller {
	public router = express.Router();

	constructor() {
		this.initializeRoutes();
	}

	private initializeRoutes() {
		this.router
			.get(`/all-tokens`, getTokenValidation, this.getAllTokens)
			.get(``, getTokensValidation, this.getTokens)
			.get(
				'/token-by-contractAddress/:contractAddress',
				getContractByAddressValidation,
				this.getTokenByAddress,
			)
			.get('/holders', getContractTxValidation, this.getTokenHolders)
			.get('/token-by-wallet-address', this.getTokenDetailsByAddress)
			// .get('/token-transfer', getTokenValidation, this.getTokenTransfer)
			.get('/curernt-token-price')
			.get(
				'/token-transfer/:address',
				getTokenValidationWithAddress,
				this.getTokenTransfer_2,
			);
	}

	/**
	 * fetch all tokens data
	 * @param request
	 * @param response
	 * @returns
	 */
	private getAllTokens = async (request: Request, response: Response) => {
		const data = {
			page: !request.query?.page ? 0 : Number(request.query.page) - 1,
			limit: !request.query?.limit ? 10 : Number(request.query.limit),
		};

		const contracts = await tokenService.getAllTokens(data);

		if (contracts.error) {
			return setResponse.error(response, contracts);
		}
		return setResponse.success(response, contracts);
	};

	/**
	 * fetch all tokens transfer data
	 * @param request
	 * @param response
	 * @returns
	 */
	private getTokenTransfer = async (request: Request, response: Response) => {
		const data = {
			page: !request.query?.page ? 0 : Number(request.query.page) - 1,
			limit: !request.query?.limit ? 10 : Number(request.query.limit),
		};

		const contracts = await tokenService.getTokenTransfer(data);

		if (contracts.error) {
			return setResponse.error(response, contracts);
		}
		return setResponse.success(response, contracts);
	};

	/**
	 * fetch tokens data
	 * @param request
	 * @param response
	 * @returns
	 */
	private getTokens = async (request: Request, response: Response) => {
		const data = {
			page: !request.query?.page ? 0 : Number(request.query.page) - 1,
			limit: !request.query?.limit ? 100 : Number(request.query.limit),
			value: request.query?.value as string,
		};

		const tokens = await tokenService.getTokens(data);

		if (tokens.error) {
			return setResponse.error(response, tokens);
		}
		return setResponse.success(response, tokens);
	};

	/**
	 * get token by contract address
	 * @param request
	 * @param response
	 * @returns
	 */
	private getTokenByAddress = async (
		request: Request,
		response: Response,
	) => {
		const tokenByAddress = await tokenService.getTokenByAddress(
			request.params?.contractAddress,
		);

		if (tokenByAddress.error) {
			return setResponse.error(response, tokenByAddress);
		}
		return setResponse.success(response, tokenByAddress);
	};

	/**
	 * get token holders by contract address
	 * @param request
	 * @param response
	 * @returns
	 */
	private getTokenHolders = async (request: Request, response: Response) => {
		const data = {
			page: !request.query?.page ? 0 : Number(request.query.page) - 1,
			limit: !request.query?.limit ? 10 : Number(request.query.limit),
			contractAddress: <string>request.query.contractAddress,
		};
		const tokenByAddress = await tokenService.getTokenHolders(data);

		if (tokenByAddress.error) {
			return setResponse.error(response, tokenByAddress);
		}
		return setResponse.success(response, tokenByAddress);
	};

	/**
	 * get token holders by contract address
	 * @param request
	 * @param response
	 * @returns
	 */
	private getTokenDetailsByAddress = async (
		request: Request,
		response: Response,
	) => {
		const data = {
			page: !request.query?.page ? 0 : Number(request.query.page) - 1,
			limit: !request.query?.limit ? 10 : Number(request.query.limit),
			address: <string>request.query.address,
		};
		const tokenByAddress =
			await tokenService.getTokenDetailsByAddress(data);

		if (tokenByAddress.error) {
			return setResponse.error(response, tokenByAddress);
		}
		return setResponse.success(response, tokenByAddress);
	};

	private getTokenTransfer_2 = async (
		request: Request,
		response: Response,
	) => {
		if (!request.params.address) {
			return setResponse.error(response, {
				error: true,
				message: 'Address is required.',
			});
		}
		const data = {
			page: !request.query?.page ? 0 : Number(request.query.page) - 1,
			limit: !request.query?.limit ? 10 : Number(request.query.limit),
			address: <string>request.params.address,
		};

		const contracts = await tokenService.getTokenTransfer_2(data);

		if (contracts.error) {
			return setResponse.error(response, contracts);
		}
		return setResponse.success(response, contracts);
	};
}

export default TokenController;
