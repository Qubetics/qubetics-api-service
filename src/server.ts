import * as http from 'http';
import { AddressInfo } from 'net';
import Environment from './environments/environment';
import { setGlobalEnvironment } from './global';
import logger from './lib/logger';

const env: Environment = new Environment();
setGlobalEnvironment(env);

import App from './App';

// service starter
(() => {
	const app: App = new App();
	let server: http.Server;

	function serverError(error: NodeJS.ErrnoException): void {
		logger.error('For Error throwing....');
		throw error;
	}

	function serverListening(): void {
		const addressInfo: AddressInfo = <AddressInfo>server.address();
		logger.info(`Listening on ${addressInfo.address}:${env.port}`);
	}

	// start the service
	app.init()
		.then(() => {
			app.express.set('port', env.port);
			server = app.httpServer;
			server.on('error', serverError);
			server.on('listening', serverListening);
			server.listen(env.port);
		})
		.catch((err: Error) => {
			logger.info('Error while initialization the app');
			logger.error(err.name);
			logger.error(err.message);
			logger.error(err.stack);
		});

	// bind the error events
	process.on('unhandledRejection', (reason: Error) => {
		console.error('Unhandled Promise Rejection: ', reason);
	});
})();
