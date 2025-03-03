import * as fs from 'fs';
import * as path from 'path';
import { config as configDotenv } from 'dotenv';

import { EnvironmentFile, Environments } from './environment.constant';
import IEnvironment from './environment.interface';

class Environment implements IEnvironment {
	public port: number;

	public secretKey: string;

	public applyEncryption: boolean;

	public env: string;

	public saltValue: number;

	public nodeLink: string;

	public databaseUrl: string;

	public databaseReplicaUrl: string;

	public redisHost: string;

	public redisPort: string;

	public rabbitMq: string;

	public publicKey: string;

	public privateKey: string;

	public recaptchaSiteKey: string;

	public recaptchaUrl: string;

	public coinMarketApi: string;

	public coinMarketKey: string;

	public currency: string;

	public symbol: string;

	public evmHost: string;

	public nodeInfoUrl: string;

	public locationApiUrl: string;

	public nodeIp: string;

	public redisExpiry: number;

	public projectName: string;

	public faucetAmount: number;

	public averageBlockTime: string;

	public RPCURL: string;

	public token_symbol: string;

	public interval: number;

	/**
	 *
	 * @param NODE_ENV
	 */
	constructor(NODE_ENV?: string) {
		this.env = NODE_ENV || process.env.NODE_ENV || Environments.DEV;
		this.setEnvironment(this.env);
		const port: string | undefined | number = process.env.PORT || 3146;
		this.port = Number(port);
		// this.applyEncryption = JSON.parse(<string>process.env.APPLY_ENCRYPTION);
		this.secretKey = <string>process.env.SECRET_KEY;
		this.saltValue = (process.env.SALT_VALUE as unknown as number) || 10;
		this.nodeLink = <string>process.env.EVM_TENDERMENT_HTTP_HOST;
		this.databaseUrl = <string>process.env.DATABASE_URL;
		this.databaseReplicaUrl = <string>process.env.DATABASE_REPLICA_URL;
		this.redisHost = <string>process.env.REDIS_HOST;
		this.redisPort = <string>process.env.REDIS_PORT;
		this.rabbitMq = <string>process.env.RABITMQ_URL;
		this.publicKey = <string>process.env.PUBLIC_KEY;
		this.privateKey = <string>process.env.PRIVATE_KEY;
		this.recaptchaSiteKey = <string>process.env.RECAPTCHA_SECRET_KEY;
		this.recaptchaUrl = <string>process.env.GOOGLE_RECAPTCHA_URL;
		this.coinMarketApi = <string>process.env.COIN_MARKET_API_PATH;
		this.coinMarketKey = <string>process.env.COIN_MARKET_API_KEY;
		this.evmHost = <string>process.env.SWAGGER_HTTP_HOST;
		this.nodeInfoUrl = <string>process.env.NODE_INFO_URL;
		this.locationApiUrl = <string>process.env.LOCATION_API_URL;
		this.nodeIp = <string>process.env.NODE_INFO_IP;
		this.redisExpiry = Number(process.env.API_REDIS_EXPIRY ?? 3600);
		this.projectName = <string>process.env.PROJECT_NAME;
		this.faucetAmount = Number(process.env.FAUCET_AMOUNT) || 20;
		this.averageBlockTime = <string>process.env.AVG_BLOCK_TIME || '6.00';
		this.RPCURL = <string>process.env.HTTP_HOST;
		this.token_symbol = <string>process.env.TOKEN_SYMBOL;
		this.interval = Number(process.env.INTERVAL) || 90;
	}

	/**
	 *
	 * @returns
	 */
	public getCurrentEnvironment(): string {
		return this.env;
	}

	/**
	 *
	 * @param env
	 */
	public setEnvironment(env: string): void {
		let envPath: string;
		this.env = env || Environments.LOCAL;
		const rootdir: string = path.resolve(__dirname, '../../');
		switch (env) {
			case Environments.PRODUCTION:
				envPath = path.resolve(rootdir, EnvironmentFile.PRODUCTION);
				break;
			case Environments.TEST:
				envPath = path.resolve(rootdir, EnvironmentFile.TEST);
				break;
			case Environments.STAGING:
				envPath = path.resolve(rootdir, EnvironmentFile.QA);
				break;
			case Environments.LOCAL:
				envPath = path.resolve(rootdir, EnvironmentFile.LOCAL);
				break;
			default:
				envPath = path.resolve(rootdir, EnvironmentFile.LOCAL);
		}
		if (this.env !== Environments.PRODUCTION && !fs.existsSync(envPath)) {
			throw new Error('.env file is missing in root directory');
		}
		configDotenv({ path: envPath });
	}

	/**
	 *
	 * @returns
	 */
	public isProductionEnvironment(): boolean {
		return this.getCurrentEnvironment() === Environments.PRODUCTION;
	}

	/**
	 *
	 * @returns
	 */
	public isDevEnvironment(): boolean {
		return (
			this.getCurrentEnvironment() === Environments.DEV ||
			this.getCurrentEnvironment() === Environments.LOCAL
		);
	}

	/**
	 *
	 * @returns
	 */
	public isTestEnvironment(): boolean {
		return this.getCurrentEnvironment() === Environments.TEST;
	}

	/**
	 *
	 * @returns
	 */
	public isStagingEnvironment(): boolean {
		return this.getCurrentEnvironment() === Environments.STAGING;
	}
}

export default Environment;
