import http from 'http';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import registerRoutes from './routes';
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from '../swagger.json';
import { RATE_LIMITER_MESSAGE } from './constant/response';

export default class App {
	public express: express.Application;

	public httpServer: http.Server;

	public limiter;

	constructor() {
		// Create a rate limiter with a limit of 20 requests per 2 minutes (120000 milliseconds)
		this.limiter = rateLimit({
			windowMs: RATE_LIMITER_MESSAGE.WINDOW_MS,
			max: RATE_LIMITER_MESSAGE.MAX,
			standardHeaders: 'draft-7',
			message: {
				error: true,
				message: RATE_LIMITER_MESSAGE.TOO_MANY_REQUEST,
			},
			legacyHeaders: false,
		});
	}

	public async init(): Promise<void> {
		this.express = express();
		this.httpServer = http.createServer(this.express);

		// add all global middleware like cors
		this.middleware();

		// register the all routes
		this.routes();

		this.setupSwaggerDocs();
	}

	/**
	 * here register your all routes
	 */
	private routes(): void {
		this.express.use(
			`/${environment.projectName}`,
			// this.limiter,
			registerRoutes(),
		);
	}

	/**
	 * here you can apply your middlewares
	 */
	private middleware(): void {
		this.express.use(cors());
		// support application/json type post data
		// support application/x-www-form-urlencoded post data
		// Helmet can help protect your app from some well-known web vulnerabilities by setting HTTP headers appropriately.
		this.express.use(
			helmet({
				contentSecurityPolicy: false,
				crossOriginEmbedderPolicy: false,
			}),
		);

		this.express.use(express.json({ limit: '100mb' }));
		this.express.use(
			express.urlencoded({ limit: '100mb', extended: true }),
		);
	}

	private setupSwaggerDocs(): void {
		this.express.use(
			'/api/docs',
			swaggerUi.serve,
			swaggerUi.setup(swaggerDocument),
		);
	}
}
