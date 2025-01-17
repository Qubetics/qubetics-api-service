import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { RES_MSG, CONST_NAME } from '../constant/response';
import { Params, BlockHeader } from '../interfaces/index';
import logger from '../lib/logger';
import { getDigitsAfterE } from '../lib/utilities.helper';

async function getParams(apiRes: AxiosInstance): Promise<Params | false> {
	try {
		const [
			validatorResponse,
			circulationSupplyResponse,
			inflationRateResponse,
			poolResponse,
			paramsResponse,
		] = await Promise.all([
			apiRes.get('/cosmos/staking/v1beta1/validators'),
			apiRes.get(
				`/cosmos/bank/v1beta1/supply/by_denom?denom=${environment.projectName}`,
			),
			apiRes.get('/cosmos/mint/v1beta1/inflation'),
			apiRes.get('/cosmos/staking/v1beta1/pool'),
			apiRes.get('/cosmos/distribution/v1beta1/params'),
		]);

		const validator = validatorResponse?.data?.validators.filter(
			(item: any) => item.status === CONST_NAME.BOND_STATUS,
		);

		if (validator?.length === 0) {
			return false;
		}

		const circulation_supply: number =
			Number(circulationSupplyResponse.data.amount.amount) /
			CONST_NAME.ETH_EXP;

		const inflation_rate = Number(inflationRateResponse.data.inflation);

		const formattedInflationRate = `${inflation_rate}`;

		const annualProvisions = Number(
			circulation_supply * parseFloat(formattedInflationRate),
		);

		let blocksPerYear = Number(CONST_NAME.BLOCK_PER_YEAR);
		blocksPerYear = Number(blocksPerYear / 2);
		const inflation = formattedInflationRate;

		const bondedTokens =
			Number(poolResponse.data.pool.bonded_tokens) / 10 ** 18;

		const communityTax = Number(paramsResponse.data.params.community_tax);

		return {
			annualProvisions,
			blocksPerYear,
			inflation,
			bondedTokens,
			communityTax,
			validator: validator?.length,
			circulation_supply,
		};
	} catch (error) {
		// logger.log('error occurred while calculating stake APR', error);
		logger.error('getParams Error', error);
		return false;
	}
}

function calculateNominalAPR(params: Params): number {
	logger.info('calculateNominalAPR', params);
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
		const params = await getParams(apiRes);
		if (!params) throw new Error(RES_MSG.APR_VALUE_ERROR);
		const blocksYearReal = await getBlocksPerYearReal(apiRes);
		const nominalAPR: number = calculateNominalAPR(params);
		const actualAPR: number = calculateRealAPR(
			params,
			nominalAPR,
			blocksYearReal,
		);

		const expoValue: number = getDigitsAfterE(actualAPR.toString());
		const actualapr = actualAPR.toFixed(expoValue);
		return {
			apr: actualapr,
			circulationSupply: params?.circulation_supply,
			validator: params?.validator,
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

export { calculateData };
