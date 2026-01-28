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

export function convertBigIntToNumber_1(dataVal: any) {
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

export function convertBigIntToNumber(dataVal: any): any {
	if (typeof dataVal === 'bigint') {
		return Number(dataVal);
	}

	if (Array.isArray(dataVal)) {
		return dataVal.map(convertBigIntToNumber);
	}

	// if (dataVal !== null && typeof dataVal === 'object') {
	// 	const result: any = {};
	// 	for (const key in dataVal) {
	// 		if (Object.prototype.hasOwnProperty.call(dataVal, key)) {
	// 			const value = dataVal[key];
	// 			result[key] = convertBigIntToNumber(value);
	// 		}
	// 	}
	// 	return result;
	// }

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


/**
 * TICS Circulating Supply Calculator
 * ===================================
 * 
 * Main entry point for calculating TICS token circulating supply.
 * 
 * Usage:
 * ```typescript
 * import { getCirculatingSupply, getCirculatingSupplyDetails } from './supply-calculator';
 * 
 * // Get just the circulating supply number
 * const supply = getCirculatingSupply();
 * console.log(supply); // e.g., 1234567.89
 * 
 * // Get full details with breakdown
 * const details = getCirculatingSupplyDetails();
 * console.log(details.circulating_supply); // e.g., 1234567.89
 * console.log(details.breakdown); // Full allocation breakdown
 * ```
 * 
 */

import type { SupplyResult, Breakdown } from '../interfaces/index';
import { ALLOCATIONS, TOTAL_SUPPLY } from '../constant/response';
import { getCurrentDateTime, roundToDecimals } from '../lib/utilities.helper';
import { getUnlocked } from './calculateAPR.helper';

/**
 * Calculate circulating supply with full breakdown.
 * 
 * This is the internal calculation function that computes:
 * - Circulating supply (total unlocked tokens)
 * - Locked supply (total - circulating)
 * - Percentage of total supply in circulation
 * - Breakdown by allocation (8 categories)
 * 
 * @returns Complete supply details object
 */
export function calculateSupplyDetails(): SupplyResult {
  const currentDate = getCurrentDateTime();
  
  const breakdown: Breakdown = {};
  let totalUnlocked = 0;
  
  // Calculate unlocked amount for each allocation
  for (const [name, alloc] of Object.entries(ALLOCATIONS)) {
    const unlocked = getUnlocked(name, alloc, currentDate);
    
    breakdown[name] = {
      unlocked: roundToDecimals(unlocked, 2),
      total: alloc.total,
      percentage: alloc.total > 0 
        ? roundToDecimals((unlocked / alloc.total) * 100, 4) 
        : 0
    };
    
    totalUnlocked += unlocked;
  }
  
  return {
    timestamp: currentDate.toISOString(),
    circulating_supply: roundToDecimals(totalUnlocked, 2),
    total_supply: TOTAL_SUPPLY,
    max_supply: TOTAL_SUPPLY,
    circulating_percentage: roundToDecimals((totalUnlocked / TOTAL_SUPPLY) * 100, 4),
    locked_supply: roundToDecimals(TOTAL_SUPPLY - totalUnlocked, 2),
    breakdown
  };
}

/**
 * Get the current circulating supply as a number.
 * 
 * Returns only the circulating supply value (unlocked tokens).
 * This is the simplest function when you only need the current supply number.
 * 
 * @returns Circulating supply in TICS tokens (rounded to 2 decimal places)
 * 
 * @example
 * const supply = getCirculatingSupply();
 * console.log(`Current supply: ${supply.toLocaleString()} TICS`);
 * // Output: Current supply: 1,234,567.89 TICS
 */
export function getCirculatingSupply(): number {
  const result = calculateSupplyDetails();
  return result.circulating_supply;
}


export { fetchRequest };
