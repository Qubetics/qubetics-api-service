import * as express from 'express';
import { Request, Response } from 'express';
import { Controller } from '../../interfaces/index';
import * as Helpers from '../../service/index';
import BlockService from './block.service';
import {
	getBlocksValidation,
	getBlockByHashValidation,
	getBlocksValidations,
} from './block.validation';

const setResponse = Helpers.ResponseHelper;

class ExplorerController implements Controller {
	public router = express.Router();

	constructor() {
		this.initializeRoutes();
	}

	private initializeRoutes() {
		this.router
			.get('/get-all-blocks', getBlocksValidation, this.getAllBlock)
			.get('', getBlocksValidations, this.getAllBlocks) //cursor based pagination
			.get(
				'/hash/:blockHash',
				getBlockByHashValidation,
				this.getBlockByHash,
			)
			.get('/get-latest-block', this.getLatestBlock)
			.get('/block-time', this.blockTime)
			.get('/state-sync', this.getStateSync);
	}

	private getAllBlock = async (request: Request, response: Response) => {
		if (request.query.order === 'undefined') {
			request.query.order = 'desc';
		}
		if (
			request.query.filterBy === 'undefined' ||
			(request.query.filterBy !== 'newest' &&
				request.query.filterBy !== 'oldest')
		) {
			request.query.filterBy = 'newest';
		}
		const data: any = {
			page: request.query?.page ? Number(request.query?.page) : 1,
			limit: !request.query?.limit ? 10 : Number(request.query?.limit),
			order: request.query?.order ?? 'desc',
			filterBy: request.query?.filterBy ?? 'newest',
		};

		const res = await BlockService.getAllLatestBlock(data);

		if (res.error) {
			return setResponse.error(response, res);
		}
		return setResponse.success(response, res);
	};

	private getAllBlocks = async (request: Request, response: Response) => {
		const data = {
			page: request.query?.page ? Number(request.query?.page) : undefined,

			limit: !request.query?.limit ? 10 : Number(request.query?.limit),
		};

		const res = await BlockService.getAllLatestBlocks(data);

		if (res.error) {
			return setResponse.error(response, res);
		}
		return setResponse.success(response, res);
	};

	private getBlockByHash = async (request: Request, response: Response) => {
		const blockByHash = await BlockService.getBlockByHash(
			request.params?.blockHash,
		);

		if (blockByHash.error) {
			return setResponse.error(response, blockByHash);
		}
		return setResponse.success(response, blockByHash);
	};

	private getBlockDetails = async (request: Request, response: Response) => {
		// const blockNumber = Number(request.query.blockNumber);
		const blockDetails = await BlockService.getBlockDetails(
			request.query?.blockIdentity as string,
		);
		if (blockDetails.error) {
			return setResponse.error(response, blockDetails);
		}
		return setResponse.success(response, blockDetails);
	};

	private getLatestBlock = async (request: Request, response: Response) => {
		const blocks = await BlockService.getLatestBlock();

		if (blocks.error) {
			return setResponse.error(response, blocks);
		}

		return setResponse.success(response, blocks);
	};

	private blockTime = async (request: Request, response: Response) => {
		const res = await BlockService.getAverageBlockTime(20);

		if (res.error) {
			return setResponse.error(response, res);
		}
		return setResponse.success(response, res);
	};

	private getStateSync = async (request: Request, response: Response) => {
		const res = await BlockService.stateSync();

		if (res.error) {
			return setResponse.error(response, res);
		}
		return setResponse.success(response, res);
	};
}

export default ExplorerController;
