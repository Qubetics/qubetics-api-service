import * as express from 'express';
import { Request, Response } from 'express';
import * as Helpers from '../../service/index';
import ExplorerService from './explorer.service';
import { Controller } from '../../interfaces/index';
import {
	searchingValidation,
	getTpsHistoryValidation,
	getGraphHistoryValidation,
	getAddressDetailValidation,
	getGraphHistoryValidationToken,
} from './explorer.validation';

const setResponse = Helpers.ResponseHelper;

class ExplorerController implements Controller {
	public router = express.Router();

	constructor() {
		this.initializeRoutes();
	}

	private initializeRoutes() {
		this.router
			.get('/searching', searchingValidation, this.searching)
			.get('/peers', this.getAllPeers)
			.get('/summary', this.summary)
			.get('/dashboard', this.dashboard)
			.get('/top-validator', this.topValidator)

			.get(
				'/address-detail/:address',
				getAddressDetailValidation,
				this.getAddressDetail,
			)
			.get(
				'/graph/token-price',
				getGraphHistoryValidationToken,
				this.getTokenPriceDetail,
			)
			.get('/graph/tps', getTpsHistoryValidation, this.getTpsHistory)
			.get(
				'/graph/account',
				getGraphHistoryValidation,
				this.getAccountCounts,
			)
			.get(
				'/graph/coin-transfer',
				getGraphHistoryValidation,
				this.getCoinTransferCount,
			)
			.get(
				'/graph/contract-deployed',
				getGraphHistoryValidation,
				this.getContractDeployedCount,
			)
			.get('/market-cap', this.getMarketCap);
	}

	private searching = async (request: Request, response: Response) => {
		const serachingRes = await ExplorerService.searching(
			request.query.value as string,
		);

		if (serachingRes.error) {
			return setResponse.error(response, serachingRes);
		}
		return setResponse.success(response, serachingRes);
	};

	private getAllPeers = async (_request: Request, response: Response) => {
		const peersRes = await ExplorerService.getAllPeers();

		if (peersRes.error) {
			return setResponse.error(response, peersRes);
		}
		return setResponse.success(response, peersRes);
	};

	private dashboard = async (request: Request, response: Response) => {
		const dashboard = await ExplorerService.dashboard();

		if (dashboard.error) {
			return setResponse.error(response, dashboard);
		}
		return setResponse.success(response, dashboard);
	};
	private topValidator = async (request: Request, response: Response) => {
		const dashboard = await ExplorerService.getTopValidator();

		if (dashboard.error) {
			return setResponse.error(response, dashboard);
		}
		return setResponse.success(response, dashboard);
	};

	private summary = async (request: Request, response: Response) => {
		const summaryRes = await ExplorerService.summary();

		if (summaryRes.error) {
			return setResponse.error(response, summaryRes);
		}
		return setResponse.success(response, summaryRes);
	};

	private getTokenPriceDetail = async (
		request: Request,
		response: Response,
	) => {
		const data = {
			interval: !request.query?.interval
				? 1
				: Number(request.query.interval),
			time: !request.query?.time ? 'd' : <string>request.query.time,
		};

		const tpsHistoryRes = await ExplorerService.tokenPriceDetail(data);

		if (tpsHistoryRes.error) {
			return setResponse.error(response, tpsHistoryRes);
		}
		return setResponse.success(response, tpsHistoryRes);
	};

	private getTpsHistory = async (request: Request, response: Response) => {
		const data = {
			interval: !request.query?.interval
				? 1
				: Number(request.query.interval),
			time: !request.query?.time
				? 'd'
				: decodeURIComponent(<string>request.query.time),
		};

		const tpsHistoryRes = await ExplorerService.tpsHistory(data);

		if (tpsHistoryRes.error) {
			return setResponse.error(response, tpsHistoryRes);
		}
		return setResponse.success(response, tpsHistoryRes);
	};

	private getMarketCap = async (request: Request, response: Response) => {
		const result = await ExplorerService.getMarketCapHistory();

		if (result.error) {
			return setResponse.error(response, result);
		}
		return setResponse.success(response, result);
	};

	private getAccountCounts = async (request: Request, response: Response) => {
		const data = {
			interval: !request.query?.interval
				? 1
				: Number(request.query.interval),
			time: !request.query?.time ? 'd' : <string>request.query.time,
		};
		const res = await ExplorerService.getAccountCounts(data);

		if (res.error) {
			return setResponse.error(response, res);
		}
		return setResponse.success(response, res);
	};

	private getCoinTransferCount = async (
		request: Request,
		response: Response,
	) => {
		const data = {
			interval: !request.query?.interval
				? 1
				: Number(request.query.interval),
			time: !request.query?.time ? 'd' : <string>request.query.time,
		};
		const res = await ExplorerService.getCoinTransferCount(data);

		if (res.error) {
			return setResponse.error(response, res);
		}
		return setResponse.success(response, res);
	};

	private getContractDeployedCount = async (
		request: Request,
		response: Response,
	) => {
		const data = {
			interval: !request.query?.interval
				? 1
				: Number(request.query.interval),
			time: !request.query?.time ? 'd' : <string>request.query.time,
		};
		const res = await ExplorerService.getContractDeployedCount(data);

		if (res.error) {
			return setResponse.error(response, res);
		}
		return setResponse.success(response, res);
	};

	private getAddressDetail = async (request: Request, response: Response) => {
		const res = await ExplorerService.getAddressDetail(
			request.params.address,
		);
		if (res.error) {
			return setResponse.error(response, res);
		}
		return setResponse.success(response, res);
	};
}

export default ExplorerController;
