import axios, { AxiosResponse, Method } from 'axios';
import {
	CONST_NAME,
	REDIS_KEY,
	STATIC_BURNED_AMOUNT,
	TRANSACTION_TYPE,
} from '../constant/response';
import { CoinMarketData } from '../interfaces/index';
import redisHelper from '../service/redis.helper';
import prisma from './db';
import logger from './logger';

export function isEven(n: number) {
	const res = n % 2 === 0;
	return res ?? false;
}

export function isExponentialNumber(str: string) {
	return str.includes('e');
}

export function txType(toAddress: string, inputLength: string) {
	let type;

	if (inputLength.length > 2 && toAddress === 'undefined') {
		type = TRANSACTION_TYPE.CONTRACT_CREATION;
	} else if (toAddress && inputLength.length > 2) {
		type = TRANSACTION_TYPE.CONTRACT_TRANSFER;
	} else {
		type = TRANSACTION_TYPE.COIN_TRANSFER;
	}
	return type;
}

export function getDigitsAfterE(scientificNotation: string) {
	try {
		if (!/e-|e\+/.test(scientificNotation)) {
			const digits = scientificNotation.split('.');
			if (!digits[1]) {
				return digits[0].length;
			}
			return digits[1].length;
		}
		const parts = scientificNotation.split(/e-|e\+/);
		const exponentPart = parts[1];

		const twoDigitsAfterE = exponentPart.substring(0, 2);
		const numericValue = parseInt(twoDigitsAfterE, 10);
		return numericValue;
	} catch (err) {
		return +scientificNotation;
	}
}

export function exp(val: string): string {
	const data = String(val).split(/[eE]/);
	if (data.length === 1) return data[0];
	let z = '';
	const sign = +val < 0 ? '-' : '';
	const str = data[0].replace('.', '');
	let value = Number(data[1]) + 1;
	if (value < 0) {
		z = `${sign}0.`;
		while (value < 0) {
			z += '0';
			value += 1;
		}

		return z + str.replace('-', '');
	}
	value -= str.length;
	while (value < 0) {
		z += '0';
		value += 1;
	}
	return str + z;
}

export async function fillMissingDatesWithZeroByhr(
	graphData: Array<{ hour: Date; count: number }>,
	startDate: Date,
) {
	startDate.setHours(startDate.getHours() + 1);

	const minTimestamp = new Date(startDate).getTime(); // Math.min(...timestamps);
	const maxTimestamp = new Date().getTime(); // Math.max(...timestamps);

	// Create a range of hours between the earliest and latest timestamps
	const rangeOfHours = [];
	for (
		let timestamp = minTimestamp;
		timestamp <= maxTimestamp;
		timestamp += 3600000
	) {
		rangeOfHours.push(new Date(timestamp).toISOString());
	}

	// Create a map to store the counts by hour for efficient lookup
	const countsMap = new Map(rangeOfHours.map((hour) => [hour, 0]));

	graphData.forEach((item: { hour: Date; count: number }) => {
		const hour = new Date(item.hour).toISOString();
		countsMap.set(hour, item.count);
	});

	// Initialize a new list to store the modified data
	const modifiedData = rangeOfHours.map((hour) => {
		const count = countsMap.get(hour);
		return { createdAt: hour, count };
	});
	return modifiedData;
}

export async function fillMissingDatesWithZeroByDay(
	data: Array<{ day: Date; count: number }>,
	startDate: Date,
	currentDateVal: Date,
) {
	startDate.setDate(startDate.getDate() + 1);
	const dateMap = new Map(
		data.map((item) => [item.day.toISOString(), item.count]),
	);
	const result = [];
	const currentDate = new Date(startDate);

	// Calculate the number of days between the startDate and the last date in your data
	const daysDifference = Math.floor(
		(+currentDateVal - +currentDate) / (24 * 60 * 60 * 1000),
	);

	for (let i = 0; i <= daysDifference; i += 1) {
		const currentDateIOS = currentDate.toISOString();
		const count = dateMap.get(currentDateIOS) || 0;
		result.push({ createdAt: currentDateIOS, count });

		currentDate.setDate(currentDate.getDate() + 1); // Move to the next day
	}

	return result;
}

export async function fillMissingDatesWithZeroByMonth(
	data: Array<{ month: Date; count: number }>,
	startDate: Date,
	currentDateVal: Date,
) {
	startDate.setMonth(startDate.getMonth() + 1);
	const dateMap = new Map(
		data.map((item) => [item.month.toISOString(), item.count]),
	);
	const result = [];
	const currentDate = new Date(startDate);

	// Calculate the number of months between the startDate and the last date in your data
	const monthsDifference =
		(currentDateVal.getFullYear() - currentDate.getFullYear()) * 12 +
		currentDateVal.getMonth() -
		currentDate.getMonth();

	for (let i = 0; i <= monthsDifference; i += 1) {
		const currentDateISO = currentDate.toISOString();
		const count = dateMap.get(currentDateISO) || 0;
		result.push({ createdAt: currentDateISO, count });

		currentDate.setMonth(currentDate.getMonth() + 1); // Move to the next month
	}

	return result;
}

interface ITimeStamp {
	[key: string]: number;
}
export async function fillMissingMinutes(
	inputData: Array<{ hour: Date; count: number }> | [],
	startMinute: Date,
	endMinute: Date,
) {
	startMinute.setMinutes(startMinute.getMinutes() + 1);
	const fromTime = startMinute;
	const toTime = endMinute;

	// Generate an array of timestamps with minute intervals
	const timestamps = [];
	const currentTime = new Date(fromTime);
	while (currentTime <= toTime) {
		timestamps.push(new Date(currentTime));
		currentTime.setMinutes(currentTime.getMinutes() + 1);
	}

	// Create an object to store the result
	const result: ITimeStamp = {};

	// Initialize the result object with zeros
	timestamps.forEach((timestamp: Date) => {
		result[timestamp.toISOString()] = 0;
	});
	// Update the result object with counts from the input data
	inputData.forEach((data) => {
		const dataTime = new Date(data.hour).toISOString();
		if (result[dataTime] === 0) {
			result[dataTime] = data.count;
		}
	});

	// Convert the result object back to an array of objects
	const resultArray = Object.keys(result).map((timestamp) => ({
		createdAt: timestamp,
		count: result[timestamp],
	}));
	return resultArray;
}

export async function fillMissingSeconds(
	data: Array<{ second: Date; count: number }>,
	startTime: Date,
	endTime: Date,
) {
	const newData = [];
	const currentTime = new Date(startTime);

	while (currentTime <= endTime) {
		const matchingData = data.find(
			(item) => item.second.getTime() === currentTime.getTime(),
		);
		if (matchingData) {
			const secondVal = {
				createdAt: matchingData.second,
				count: matchingData.count,
			};
			newData.push(secondVal);
		} else {
			newData.push({ createdAt: new Date(currentTime), count: 0 });
		}

		currentTime.setSeconds(currentTime.getSeconds() + 1);
	}

	return newData;
}

export function formatDate(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
	const day = String(date.getUTCDate()).padStart(2, '0');
	const hours = String(date.getUTCHours()).padStart(2, '0');
	// const minutes = String(date.getUTCMinutes()).padStart(2, '0');
	// const seconds = String(date.getUTCSeconds()).padStart(2, '0');

	return `${year}-${month}-${day}T${hours}:00:00.000Z`;
}
export function formatDateForDay(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
	const day = String(date.getUTCDate()).padStart(2, '0');
	// const hours = String(date.getUTCHours()).padStart(2, '0');
	// const minutes = String(date.getUTCMinutes()).padStart(2, '0');
	// const seconds = String(date.getUTCSeconds()).padStart(2, '0');

	return `${year}-${month}-${day}T00:00:00.000Z`;
}

export function formatDateForYear(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
	// const day = String(date.getUTCDate()).padStart(2, '0');
	// const hours = String(date.getUTCHours()).padStart(2, '0');
	// const minutes = String(date.getUTCMinutes()).padStart(2, '0');
	// const seconds = String(date.getUTCSeconds()).padStart(2, '0');

	return `${year}-${month}-01T00:00:00.000Z`;
}
export function formatDateByMin(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
	const day = String(date.getUTCDate()).padStart(2, '0');
	const hours = String(date.getUTCHours()).padStart(2, '0');
	const minutes = String(date.getUTCMinutes()).padStart(2, '0');
	// const seconds = String(date.getUTCSeconds()).padStart(2, '0');

	return `${year}-${month}-${day}T${hours}:${minutes}:00.000Z`;
}
export function formatDateBySec(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
	const day = String(date.getUTCDate()).padStart(2, '0');
	const hours = String(date.getUTCHours()).padStart(2, '0');
	const minutes = String(date.getUTCMinutes()).padStart(2, '0');
	const seconds = String(date.getUTCSeconds()).padStart(2, '0');

	return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000Z`;
}
export async function fetchRequest(
	url: string,
	data: { symbol: string; convert: string },
	method: Method,
	headers: object,
): Promise<CoinMarketData> {
	return new Promise((resolve, reject) => {
		const { symbol } = data;

		axios
			.get(url, {
				params: data,
				headers,
			})
			.then((res: AxiosResponse) => {
				const coinMarketPrice = {
					price: res.data.data[symbol].quote.USD.price,
					volume_24h: res.data.data[symbol].quote.USD.volume_24h,
					market_cap: res.data.data[symbol].quote.USD.market_cap,
					circulating_supply:
						res.data.data[symbol].circulating_supply,
				};

				resolve(coinMarketPrice);
			})
			.catch((err) => {
				logger.error(err.response.data.status.error_message);
				reject(new Error(err.response.data.status.error_message));
			});
	});
}

export async function formatTheDate(getDateTime: any) {
	const year = getDateTime.getUTCFullYear();
	const month = String(getDateTime.getUTCMonth() + 1).padStart(2, '0'); // getMonth() is zero-based
	const day = String(getDateTime.getUTCDate()).padStart(2, '0');
	const hours = String(getDateTime.getUTCHours()).padStart(2, '0');
	const minutes = String(getDateTime.getUTCMinutes()).padStart(2, '0');
	const seconds = String(getDateTime.getUTCSeconds()).padStart(2, '0');

	return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function cursorPagination(
	result: any,
	orderBy: string,
	filter: string,
	limit: number,
	uniqueParam: any,
	totalRecords: number,
	maximumId: number,
	minimumId: number,
) {
	let getFilter = '';

	if (filter) {
		getFilter = filter;
	}

	console.log('RESULT', result);
	// orderBy === 'desc' && getFilter === 'oldest'
	// 	? result.reverse()
	// 	: orderBy === 'asc' && getFilter === 'newest'
	// 		? result.reverse()
	// 		:
	// let sortedResults = result;
	let sortedResults = [...result];
	if (
		(orderBy === 'desc' && getFilter === 'oldest') ||
		(orderBy === 'asc' && getFilter === 'newest') ||
		(orderBy === 'asc' && getFilter !== 'newest' && getFilter !== 'oldest')
	) {
		console.log('Will reverse here');
		// sortedResults = result.reverse();
		sortedResults = [...result].reverse();
	}
	console.log('SORTED-RESULT', result);

	/** to get the next page :  get the last element of the result */
	let nextCursor = null;
	let previousCursor = null;
	if (
		!orderBy ||
		orderBy === 'desc' ||
		(orderBy === 'asc' && getFilter === 'oldest')
	) {
		nextCursor = sortedResults[sortedResults.length - 1][uniqueParam];
		previousCursor = sortedResults[0][uniqueParam];
	} else {
		nextCursor = result[0][uniqueParam];
		previousCursor = result[result.length - 1][uniqueParam];
	}

	// else if () {
	// 	nextCursor = result[0][uniqueParam];
	// 	previousCursor = result[result.length - 1][uniqueParam];
	// }

	// if (!orderBy || orderBy === 'desc') {
	// 	nextCursor = sortedResults[sortedResults.length - 1][uniqueParam];
	// }
	// const nextCursor = sortedResults
	// 	? sortedResults[sortedResults.length - 1][uniqueParam]
	// 	: null;

	/** to get the previous page : get the first element of the result */
	// previousCursor = result ? result[result.length - 1][uniqueParam] : null;
	const lastPageRemainder = totalRecords % Number(limit);

	return {
		sortedResults,
		nextCursor:
			(Number(nextCursor) === Number(minimumId) &&
				(!getFilter || getFilter === 'newest')) ||
			(Number(nextCursor) === Number(maximumId) &&
				getFilter === 'oldest') ||
			Number(totalRecords) < Number(limit)
				? null
				: nextCursor,
		previousCursor:
			(Number(previousCursor) === Number(maximumId) &&
				(!getFilter || getFilter === 'newest')) ||
			(Number(previousCursor) === Number(minimumId) &&
				getFilter === 'oldest') ||
			Number(totalRecords) < Number(limit)
				? null
				: previousCursor,
		lastPageRemainder,
	};
}

const CACHE_EXPIRATION = 600; // 10 minutes

// Helper function to format date
export function setFormatDate(date: any, interval: string) {
	if (interval === 'daily') return date.toISOString().split('T')[0]; // YYYY-MM-DD
	if (interval === 'weekly')
		return `${date.getFullYear()}-W${Math.ceil(date.getDate() / 7)}`;
	if (interval === 'monthly')
		return `${date.getFullYear()}-${(date.getMonth() + 1)
			.toString()
			.padStart(2, '0')}`;
	return date.toISOString();
}

export function parseAndFixJson(input: any) {
	try {
		// Check if it's already valid JSON
		return JSON.parse(input);
	} catch (error) {
		console.warn('Invalid JSON detected. Attempting to fix...');

		const fixedJsonString = input
			.replace(/([{,])(\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$3":') // Quote keys
			.replace(/:\s*([a-zA-Z_][a-zA-Z0-9_]*)\b/g, ': "$1"') // Quote unquoted string values
			.replace(/0x[a-fA-F0-9]+/g, '"$&"'); // Quote hex values
		console.log(JSON.parse(fixedJsonString), 'fixedJsonString');
		try {
			return JSON.parse(fixedJsonString);
		} catch (finalError) {
			console.error('Failed to fix JSON:', finalError);
			return null; // Return null or handle the error accordingly
		}
	}
}
// export const noExponent = function (num: number | string) {
// 	try {
// 		const data = String(num).split(/[eE]/);
// 		if (data.length === 1) return data[0];
// 		let z = '';
// 		const sign = Number(num) < 0 ? '-' : '';
// 		const str = data[0].replace('.', '');
// 		let mag = Number(data[1]) + 1;
// 		if (mag < 0) {
// 			z = `${sign}0.`;
// 			while (mag += 1) z += '0';
// 			return z + str.replace(/^\-/, '');
// 		}
// 		mag -= str.length;
// 		while (mag--) z += '0';
// 		// console.log('str + z : ', str + z);

// 		return str + z;
// 	} catch (error) {
// 		console.log('Exponent error', error);
// 		return '0';
// 	}
// };

export const noExponent = function (num: number | string) {
	try {
		const data = String(num).split(/[eE]/);
		if (data.length === 1) return data[0];
		let z = '';
		const sign = Number(num) < 0 ? '-' : '';
		const str = data[0].replace('.', '');
		let mag = Number(data[1]) + 1;
		if (mag < 0) {
			z = `${sign}0.`;
			while (mag++) z += '0';
			return z + str.replace(/^\-/, '');
		}
		mag -= str.length;
		while (mag--) z += '0';
		return str + z;
	} catch (error) {
		console.log('Exponent error', error);
		return '0';
	}
};

export async function getTotalSupply() {
	try {
		let burnedAmount: number = await redisHelper.getString(
			REDIS_KEY.TOTAL_BURNED_AMOUNT,
		);

		if (!burnedAmount) {
			/** save burned fees */
			burnedAmount = await getBurnedAmount();
			await redisHelper.setString(
				REDIS_KEY.TOTAL_BURNED_AMOUNT,
				burnedAmount,
			);
		}

		const { initialSupply } = environment;

		const totalSupply = initialSupply - burnedAmount;

		return totalSupply;
	} catch (err) {
		logger.error('dashboard-Error', err);
		return false;
	}
}

export async function getBurnedAmount() {
	try {
		const burnedAmount: any = await prisma.transactions.aggregate({
			_sum: {
				burnedFee: true,
			},
		});

		if (burnedAmount) {
			return (
				Number(burnedAmount?._sum.burnedFee) +
				Number(STATIC_BURNED_AMOUNT)
			);
		}
		return Number(STATIC_BURNED_AMOUNT);
	} catch (error) {
		console.log(error, 'error in getBurnedAmount');
		return STATIC_BURNED_AMOUNT;
	}
}

/**
 * Utility Helper Functions
 */

/**
 * Add calendar months to a date, handling month-end edge cases.
 *
 * @param date - The starting date
 * @param months - Number of months to add
 * @returns New date with months added
 *
 * @example
 * addMonths(new Date('2025-01-31'), 1) // Returns 2025-02-28
 * addMonths(new Date('2025-01-15'), 3) // Returns 2025-04-15
 */
export function addMonths(date: Date, months: number): Date {
	const result = new Date(date);
	const currentMonth = result.getMonth();
	const currentDay = result.getDate();

	result.setMonth(currentMonth + months);

	// Handle edge case where day doesn't exist in target month (e.g., Jan 31 + 1 month)
	if (result.getDate() !== currentDay) {
		result.setDate(0); // Set to last day of previous month
	}

	return result;
}

/**
 * Get current date normalized to 13:00 UTC.
 * All token unlocks happen at 13:00 UTC daily.
 *
 * @returns Current date at 13:00:00.000 UTC
 */
export function getCurrentDateTime(): Date {
	const now = new Date();
	return new Date(
		Date.UTC(
			now.getUTCFullYear(),
			now.getUTCMonth(),
			now.getUTCDate(),
			0,
			0,
			0,
			0,
		),
	);
}

/**
 * Round a number to specified decimal places.
 *
 * @param value - Number to round
 * @param decimals - Number of decimal places (default: 2)
 * @returns Rounded number
 */
export function roundToDecimals(value: number, decimals: number = 2): number {
	const multiplier = 10 ** decimals;
	return Math.round(value * multiplier) / multiplier;
}
