import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { RES_MSG, CONST_NAME, CURRENT_DEFAULT_APR } from '../constant/response';
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

		const inflation_rate = Number(inflationRateResponse.data.inflation);

		const formattedInflationRate = `${inflation_rate}`;

		let blocksPerYear = Number(CONST_NAME.BLOCK_PER_YEAR);
		blocksPerYear = Number(blocksPerYear / 2);
		const inflation = formattedInflationRate;

		const bondedTokens =
			Number(poolResponse.data.pool.bonded_tokens) / 10 ** 18;
		// const bondedTokens = Number(poolResponse.data.pool.bonded_tokens);
		const communityTax = Number(paramsResponse.data.params.community_tax);
		const annualProvisions = annualProvision.data.annual_provisions;
		const totalSupply = Number(total_Supply.data.supply[0].amount);

		const bondedRate = Number((bondedTokens / circulation_supply) * 100);

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
			totalValidators: validatorResponse?.data?.validators.length,
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
		const params = await getParams(apiRes);
		if (!params) throw new Error(RES_MSG.APR_VALUE_ERROR);
		const getApr = await apiRes.get('/qubetics/validatorpool/params');
		const nominalAPR = getApr?.data?.params?.annual_roi;

		// const blocksYearReal = await getBlocksPerYearReal(apiRes);
		// const nominalAPR: number = calculateNominalAPR(params);
		// const actualAPR: any = calculateRealAPR(
		// 	params,
		// 	nominalAPR,
		// 	blocksYearReal,
		// );

		// const expoValue: number = getDigitsAfterE(actualAPR.toString());
		// const actualapr = actualAPR.toFixed(expoValue);
		return {
			apr: nominalAPR ?? CURRENT_DEFAULT_APR.toString(),
			circulationSupply: params?.circulation_supply,
			validator: params?.activeValidator,
			bondedTokens: params?.bondedTokens,
			bondedRate: params?.bondedRate,
			totalValidator: params?.totalValidator,
		};
	} catch (err) {
		logger.error(
			'Error occurred while calculating data for dashboard',
			err,
		);
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
