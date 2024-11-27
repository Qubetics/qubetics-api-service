import * as express from 'express';
import { Request, Response } from 'express';
import { Controller } from '../../interfaces/index';
import * as Helpers from '../../service/index';
import validatorService from './validator.service';
import { getValidatorsValidation } from './validator.validation';

const setResponse = Helpers.ResponseHelper;

class ValidatorController implements Controller {
	public router = express.Router();

	constructor() {
		this.initializeRoutes();
	}

	private initializeRoutes() {
		this.router.get(
			'/getAllValidators',
			getValidatorsValidation,
			this.getAllValidators,
		);
	}

	private getAllValidators = async (request: Request, response: Response) => {
		const data = {
			page: !request.query?.page ? 0 : Number(request.query?.page) - 1,
			limit: !request.query?.limit ? 10 : Number(request.query?.limit),
		};

		const res = await validatorService.getAllValidators(data);

		if (res.error) {
			return setResponse.error(response, res);
		}
		return setResponse.success(response, res);
	};
}
export default ValidatorController;
