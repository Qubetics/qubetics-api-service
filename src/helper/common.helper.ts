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
export { fetchRequest };
