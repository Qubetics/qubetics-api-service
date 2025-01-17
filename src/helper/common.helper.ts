/* eslint-disable */

import axios, { Method } from 'axios';
import logger from '../lib/logger';

const fetchRequest = async (
	url: string,
	data: object,
	method: Method,
	headers: object,
) =>
	new Promise((resolve, reject) => {
		try {
			resolve(
				axios({
					method,
					url,
					data,
					headers,
				}),
			);
		} catch (err) {
			logger.error(
				`\x1b[31mError in http request helper: ${err}\x1b[31m`,
			);
			reject(err);
		}
	});

export function convertBigIntToNumber(dataVal: any) {
	const finalDataVal = [];
	console.log('dataVal', dataVal);
	if (dataVal && typeof dataVal === 'object') {
		for (const dataObject of dataVal) {
			for (const key in dataObject) {
				if (Object.prototype.hasOwnProperty.call(dataObject, key)) {
					const value = dataObject[key];

					if (typeof value === 'bigint') {
						dataObject[key] = Number(value);
					}
				}
			}
			finalDataVal.push(dataObject);
		}
	}
	return finalDataVal;
}

export function serializeBigInt(dataVal: any): any {
	if (typeof dataVal === 'bigint') {
		return dataVal.toString();
	}
	if (Array.isArray(dataVal)) {
		return dataVal.map(convertBigIntToNumber);
	}
	if (dataVal !== null && typeof dataVal === 'object') {
		return Object.fromEntries(
			Object.entries(dataVal).map(([key, value]) => {
				if (
					(key === 'block_timestamp' ||
						key === 'timestamp' ||
						key === 'created_at' ||
						key === 'updated_at' ||
						key === 'createdAt' ||
						key === 'updatedAt') &&
					value instanceof Date
				) {
					return [key, value.toISOString()]; // Convert block_timestamp to string
				}
				return [key, convertBigIntToNumber(value)];
			}),
		);
	}
	return dataVal;
}

export { fetchRequest };
