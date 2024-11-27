import axios, { AxiosResponse, Method } from 'axios';
import { TRANSACTION_TYPE } from '../constant/response';
import { CoinMarketData } from '../interfaces/index';
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
