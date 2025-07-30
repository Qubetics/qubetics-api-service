import { Router } from 'express';
import BlockController from './module/block/block.contoller';
import TransactionController from './module/transaction/transaction.contoller';
import FaucetController from './module/faucet/faucet.contoller';
import ExplorerController from './module/explorer/explorer.contoller';
import ContractController from './module/contract/contract.controller';
import TokenController from './module/Token/token.controller';
import ValidatorController from './module/validator/validator.controller';

/**
 * Here, you can register routes by instantiating the controller.
 *
 */
export default function registerRoutes(): Router {
	const router = Router();

	const blockController = new BlockController();
	const transactionController = new TransactionController();
	// const faucetController = new FaucetController();
	const explorerController = new ExplorerController();
	const contractController = new ContractController();
	const tokenController = new TokenController();
	const validatorController = new ValidatorController();

	router.use('/status', (req, res) => {
		res.json({ message: 'Up and Running' });
	});
	router.use('/blocks', blockController.router);
	router.use('/transactions', transactionController.router);
	// router.use('/faucet', faucetController.router);
	router.use('/explorer', explorerController.router);
	router.use('/contracts', contractController.router);
	router.use('/tokens', tokenController.router);
	router.use('/validators', validatorController.router);
	return router;
}
