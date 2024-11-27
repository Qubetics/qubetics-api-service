import * as express from 'express';
import * as Helpers from '../../service/index';
import FaucetService from './faucet.service';
import { Controller } from '../../interfaces/index';
import { fundTransferValidation } from './faucet.validation';
const setResponse = Helpers.ResponseHelper;

class ExplorerController implements Controller {
	public router = express.Router();

	constructor() {
		this.initializeRoutes();
	}

	private initializeRoutes() {
		this.router.post(
			'/transfer',
			fundTransferValidation,
			this.fundTransfer,
		);
	}

	private fundTransfer = async (
		request: express.Request,
		response: express.Response,
	) => {
		const res = await FaucetService.fundTransfer(
			request.body.toAddress,
			request.body.value,
			request.body.captchaToken,
		);
		if (res.error) {
			return setResponse.error(response, res);
		}
		return setResponse.success(response, res);
	};
}

export default ExplorerController;
