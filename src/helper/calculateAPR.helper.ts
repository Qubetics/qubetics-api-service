import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { RES_MSG, CONST_NAME, REDIS_KEY } from '../constant/response';
import { Params, BlockHeader } from '../interfaces/index';
import logger from '../lib/logger';
import { getDigitsAfterE } from '../lib/utilities.helper';
import { RedisService } from '../service';

async function getTendermintParams(
	apiRes: AxiosInstance,
): Promise<Params | false> {
	try {
		const [
			validatorResponse,
			circulationSupplyResponse,
			inflationRateResponse,
			poolResponse,
			paramsResponse,
			total_Supply,
			annualProvision,
		] = await Promise.all([
			apiRes.get('/cosmos/staking/v1beta1/validators'),
			apiRes.get(
				`/cosmos/bank/v1beta1/supply/by_denom?denom=${environment.token_symbol}`,
			),
			apiRes.get('/cosmos/mint/v1beta1/inflation'),
			apiRes.get('/cosmos/staking/v1beta1/pool'),
			apiRes.get('/cosmos/distribution/v1beta1/params'),
			apiRes.get('/cosmos/bank/v1beta1/supply'),
			apiRes.get('/cosmos/mint/v1beta1/annual_provisions'),
		]);

		const activeValidator = validatorResponse?.data?.validators.filter(
			(item: any) => item.status === CONST_NAME.BOND_STATUS,
		);

		if (activeValidator?.length === 0) {
			return false;
		}
		const validator = validatorResponse?.data?.validators;

		const totalValidator: number | undefined =
			validatorResponse?.data?.validators?.length;
		if (totalValidator === undefined) {
			return false;
		}

		const circulation_supply: number =
			Number(circulationSupplyResponse.data.amount.amount) /
			CONST_NAME.ETH_EXP;

		const inflation = Number(inflationRateResponse.data.inflation);

		let blocksPerYear = Number(CONST_NAME.BLOCK_PER_YEAR);
		blocksPerYear = Number(blocksPerYear / 2);

		const bondedTokens =
			Number(poolResponse.data.pool.bonded_tokens) / 10 ** 18;
		// const bondedTokens = Number(poolResponse.data.pool.bonded_tokens);
		const communityTax = Number(paramsResponse.data.params.community_tax);
		const annualProvisions = annualProvision.data.annual_provisions;
		const totalSupply = Number(total_Supply.data.supply[0].amount);

		const bondedRate = Number((bondedTokens / circulation_supply) * 100);
		console.log(
			'bondedRate-totalSupply',
			totalSupply,
			bondedTokens,
			bondedRate,
			inflationRateResponse,
		);
		return {
			annualProvisions,
			blocksPerYear,
			inflation,
			bondedTokens,
			communityTax,
			activeValidator: activeValidator?.length,
			totalValidator,
			circulation_supply,
			bondedRate,
			total_supply: totalSupply,
		};
	} catch (error) {
		logger.error('getParams Error', error);
		return false;
	}
}

function calculateNominalAPR(params: Params): number {
	return (
		(params.annualProvisions * (CONST_NAME.ONE - params.communityTax)) /
		params.bondedTokens
	);
}

async function getBlocksPerYearReal(lcdApi: AxiosInstance): Promise<number> {
	try {
		const response: AxiosResponse = await lcdApi.get(
			'/cosmos/base/tendermint/v1beta1/blocks/latest',
		);

		const block1: BlockHeader = response.data.block.header;
		const blockRange =
			Number(block1.height) > CONST_NAME.THOUSAND
				? CONST_NAME.THOUSAND
				: CONST_NAME.ONE;
		const response2: AxiosResponse = await lcdApi.get(
			`/cosmos/base/tendermint/v1beta1/blocks/${
				Number(block1.height) - blockRange
			}`,
		);

		const block2: BlockHeader = response2.data.block.header;

		const yearMilisec = CONST_NAME.YEAR_MILI_SEC;
		const blockMilisec =
			(new Date(block1.time).valueOf() -
				new Date(block2.time).valueOf()) /
			blockRange;

		return Math.ceil(yearMilisec / blockMilisec);
	} catch (error) {
		logger.log('error', 'Error occurred while getting blocks per year.');
		return -CONST_NAME.ONE;
	}
}

function calculateRealAPR(
	params: Params,
	nominalAPR: number,
	blocksYearReal: number,
): number {
	const blockProvision = params.annualProvisions / params.blocksPerYear;
	const realProvision = blockProvision * blocksYearReal;
	return nominalAPR * (realProvision / params.annualProvisions);
}

const calculateData = async (): Promise<
	| {
			apr: string;
			circulationSupply: number;
			validator: number;
			bondedTokens: number;
			bondedRate: number;
			totalValidator: number;
	  }
	| { error: boolean; message: string }
> => {
	try {
		const apiUrl = environment.evmHost;
		const apiRes = axios.create({
			baseURL: apiUrl,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				Accept: 'application/json',
			},
			timeout: 5000,
		});
		const params = await getTendermintParams(apiRes);
		if (!params) throw new Error(RES_MSG.APR_VALUE_ERROR);
		const blocksYearReal = await getBlocksPerYearReal(apiRes);
		const nominalAPR: number = calculateNominalAPR(params);
		const actualAPR: any = calculateRealAPR(
			params,
			nominalAPR,
			blocksYearReal,
		);

		const expoValue: number = getDigitsAfterE(actualAPR.toString());
		const actualapr = actualAPR.toFixed(expoValue);
		return {
			apr: actualapr,
			circulationSupply: params?.circulation_supply,
			validator: params?.activeValidator,
			bondedTokens: params?.bondedTokens,
			bondedRate: params?.bondedRate,
			totalValidator: params?.totalValidator,
		};
	} catch (err) {
		logger.error('Error occurred while calculating stake APR', err);
		if (err instanceof Error) {
			return { error: true, message: err.message };
		}
		return {
			error: true,
			message: RES_MSG.APR_VALUE_ERROR,
		};
	}
};

const getDashboardData = async (): Promise<
	| {
			validator: number;
			totalValidator: number;
			bondedRate: number;
			apy: number;
	  }
	| { error: boolean; message: string }
> => {
	try {
		const apiUrl = environment.evmHost;
		const apiRes = axios.create({
			baseURL: apiUrl,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				Accept: 'application/json',
			},
			timeout: 5000,
		});

		const tenderMintParams = await getTendermintParams(apiRes);
		if (!tenderMintParams) throw new Error(RES_MSG.SERVER_ERROR);

		const apyValue = calculateAPY(
			Number(tenderMintParams.inflation),
			Number(tenderMintParams.bondedRate / 100),
			tenderMintParams.communityTax,
		);

		const blocksYearReal = await getBlocksPerYearReal(apiRes);
		const nominalAPR: number = calculateNominalAPR(tenderMintParams);
		const actualAPR: any = calculateRealAPR(
			tenderMintParams,
			nominalAPR,
			blocksYearReal,
		);

		const expoValue: number = getDigitsAfterE(actualAPR.toString());
		const actualapr = actualAPR.toFixed(expoValue);

		const validatorData = {
			validator: tenderMintParams?.activeValidator,
			totalValidator: tenderMintParams?.totalValidator,
			bondedRate: tenderMintParams?.bondedRate,
			apy: apyValue,
			totalSupply: tenderMintParams?.total_supply,
			inflation: Number(tenderMintParams?.inflation),
			circulating_supply: tenderMintParams?.circulation_supply,
			activeValidator: tenderMintParams?.activeValidator,
			bondedTokens: tenderMintParams?.bondedTokens,
			communityTax: tenderMintParams?.communityTax,
			apr: actualapr,
		};

		const existingDataStr: any = await RedisService.getString(
			REDIS_KEY.DASHBOARD_DATA,
		);
		let existingData: any = {};
		if (existingDataStr) {
			existingData = JSON.parse(existingDataStr);
		}

		// Step 2: Add or update fields
		existingData.validator = validatorData.validator;
		existingData.totalValidator = validatorData.totalValidator;
		existingData.bondedRate = validatorData.bondedRate;

		existingData.apy = validatorData.apy;
		existingData.totalSupply = validatorData.totalSupply;
		existingData.inflation = validatorData.inflation;
		existingData.circulating_supply = validatorData.circulating_supply;
		existingData.circulationSupply = validatorData.circulating_supply;
		existingData.activeValidator = validatorData.activeValidator;
		existingData.apr = validatorData.apr;

		const latest_block: string = await RedisService.getString(
			CONST_NAME.LATEST_BLOCK,
		);
		const total_transactions: string = await RedisService.getString(
			REDIS_KEY.TRANSACTIONS_COUNT,
		);
		const total_accounts: string = await RedisService.getString(
			REDIS_KEY.TOTAL_ADDRESSES,
		);
		existingData.latest_block = JSON.parse(latest_block);
		existingData.total_transactions = JSON.parse(total_transactions);
		existingData.total_accounts = JSON.parse(total_accounts);

		await RedisService.setStringWithExpiry(
			REDIS_KEY.DASHBOARD_DATA,
			JSON.stringify(existingData),
			600,
		);
		return validatorData;
	} catch (err) {
		logger.log('error', 'Error occurred while calculating stake APY', err);
		if (err instanceof Error) {
			return { error: true, message: err.message };
		}
		return { error: true, message: RES_MSG.SERVER_ERROR };
	}
};

function calculateAPY(
	inflation: number,
	bondedRate: number,
	communityTax: number,
): number {
	const apy = Number(
		((inflation / bondedRate) * (1 - communityTax) * 100).toFixed(2),
	);
	return apy;
}

export { calculateData, getDashboardData };
