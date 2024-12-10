import * as Joi from 'joi';
import * as express from 'express';
import { RESPONSES } from '../../constant/response';

const isNumeric = (str: string) => {
	const pattern = /^-?\d*\.?\d+$/;
	return pattern.test(str);
};

export const searchingValidation = (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction,
) => {
	const querySchema = Joi.object({
		value: Joi.string()
			.required()
			.custom((val, helpers) => {
				if (val.startsWith(' ')) {
					return helpers.error('custom.noLeadingSpaces');
				}

				const value = val.trim();

				if (!isNumeric(value)) {
					if (!value.startsWith('0x')) {
						return helpers.error('custom.invalidHash');
					}

					if (
						value.startsWith('0x') &&
						!(value.length === 42 || value.length === 66)
					) {
						return helpers.error('custom.hashLength');
					}
				} else {
					if (value.includes('.')) {
						return helpers.error('custom.noDecimals');
					}
					if (
						!Number.isInteger(Number(value)) ||
						Number(value) <= 0
					) {
						return helpers.error('custom.nonzero');
					}
					// if (value.toString().length >= 19) {
					// 	return helpers.error('custom.invalidnumber');
					// }
				}
				return Number(value);
			})
			.messages({
				'custom.noDecimals': 'block number should not be in decimal',
				'custom.nonzero':
					'block number should be greater than or equal to 0',
				'custom.invalidHash':
					'block hash or transaction hash should be start with 0x',
				'custom.hashLength':
					'block or transaction hash must be 66 characters, and address must be 42 characters.',
				'custom.noLeadingSpaces':
					'block hash or transaction hash should not start with a space',
				'string.pattern.base':
					'block hash or transaction hash must start with 0x',
				'string.base':
					'block hash or transaction hash must be a string',
				'any.required': 'block hash or transaction hash is required',
				'string.empty': 'block cannot be empty',
				'custom.invalidnumber': 'invalid block number',
			}),
	});

	const queryResult = querySchema.validate(req.query);

	if (queryResult.error) {
		return res.status(400).json({
			error: true,
			message: queryResult.error.details[0].message,
		});
	}

	next();
};

export const getTpsHistoryValidation = (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction,
) => {
	const schema = Joi.object({
		interval: Joi.string()

			.required()
			.custom((value, helpers) => {
				const regex = /^\s+|\s+$/;
				let time;
				time = helpers.state.ancestors[0].time;
				if (time) {
					time = time.trim(); // Trim leading and trailing spaces from "time"
				}

				if (time === undefined) {
					return helpers.error('custom.requireTime');
				}
				if (time.startsWith(' ') || regex.test(time)) {
					return helpers.error('custom.noLeadingSpacesForTime');
				}

				if (value.startsWith(' ') || regex.test(value)) {
					return helpers.error('custom.noLeadingSpaces');
				}

				const timeNum = Number(value);

				// Access the "time" value from the parent
				if (time === 'hourly') {
					if (timeNum < 6 || timeNum > 24) {
						return helpers.error('custom.invalidInterval_h');
					}
				} else if (time === 'daily') {
					if (timeNum < 6 || timeNum > 31) {
						return helpers.error('custom.invalidInterval_d');
					}
				} else if (time === 'monthly') {
					if (timeNum < 6 || timeNum > 12) {
						return helpers.error('custom.invalidInterval_m');
					}
				} else {
					return helpers.error('custom.invalidtime');
				}
			})
			.messages({
				'custom.invalidInterval_h':
					'the interval should be 6 to 24 hours when dealing with time units in hour (hourly)',
				'custom.invalidInterval_d':
					'the interval should be 6 to 31 day when dealing with time units in day (daily)',
				'custom.invalidInterval_m':
					'the interval should be 6 to 12 month when dealing with time units in month (monthly).',
				'custom.invalidtime':
					"Invalid time unit should be 'hourly', 'daily', 'monthly',",
				'string.base': 'interval must be a string',
				'custom.noLeadingSpaces':
					'interval should not have leading or trailing spaces',
				'any.required': 'interval is required',
				'custom.noLeadingSpacesForTime':
					'time should not have leading or trailing spaces',
				'custom.requireTime': 'time is required',
			}),
		time: Joi.string()
			.required()
			.custom((value, helpers) => {
				const regex = /^\s+|\s+$/;
				if (value.startsWith(' ') || regex.test(value)) {
					return helpers.error('custom.noLeadingSpaces');
				}
				if (
					value === 'hourly' ||
					value === 'daily' ||
					value === 'monthly'
				) {
					return value;
				} else {
					return helpers.error('custom.invalidtime');
				}
			})
			.required()
			.messages({
				'custom.invalidtime':
					"time units should be 'hourly', 'daily', 'monthly' format",
				'string.base': 'time must be a string',
				'custom.requireInterval': 'interval is required',
				'custom.noLeadingSpaces':
					'time should not have leading or trailing spaces',
				'any.required': 'time is required',
				'any.only': 'time must be one of m or h or s',
				'string.empty': 'time cannot be empty',
			}),
	});

	const { error } = schema.validate(req.query);

	if (error) {
		return res
			.status(RESPONSES.BADREQUEST)
			.json({ error: true, message: error.details[0].message });
	}
	next();
};

export const getGraphHistoryValidation = (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction,
) => {
	const schema = Joi.object({
		interval: Joi.string()

			.optional()
			.custom((value, helpers) => {
				const regex = /^\s+|\s+$/;
				let time;
				time = helpers.state.ancestors[0].time;
				if (time) {
					time = time.trim(); // Trim leading and trailing spaces from "time"
				}

				if (time === undefined) {
					return helpers.error('custom.requireTime');
				}
				if (time.startsWith(' ') || regex.test(time)) {
					return helpers.error('custom.noLeadingSpacesForTime');
				}

				if (value.startsWith(' ') || regex.test(value)) {
					return helpers.error('custom.noLeadingSpaces');
				}

				// Access the "time" value from the parent
				// if (time === 'h') {
				// 	if (value !== '1') {
				// 		return helpers.error('custom.invalidInterval_h');
				// 	}
				// } else
				if (time === 'd') {
					if (value === '1' || value === '7' || value === '30') {
						return value;
					}
					return helpers.error('custom.invalidInterval_d');
				}
				if (time === 'y') {
					if (value === '1' || value === '5') {
						return value;
					}
					return helpers.error('custom.invalidInterval_y');
				}
				return helpers.error('custom.invalidtime');
			})
			.messages({
				'custom.invalidInterval_d':
					'the interval should be set to 1 day,7 day,30 day when dealing with time units in day (d).',
				'custom.invalidInterval_y':
					'the interval should be set to 1 year,5 year when dealing with time units in year (y).',
				'custom.invalidInterval_h':
					'the interval should be set to 1 hour when dealing with time units in hour (h).',
				'custom.invalidtime':
					'time units can be represented in Hours (h) or Days (d).',
				'string.base': 'interval must be a string',
				'custom.noLeadingSpaces':
					'interval should not have leading or trailing spaces',
				'any.required': 'interval is required',
				'custom.noLeadingSpacesForTime':
					'time should not have leading or trailing spaces',
				'custom.requireTime': 'time is required',
			}),
		time: Joi.string()
			.optional()
			.custom((value, helpers) => {
				const regex = /^\s+|\s+$/;
				if (value.startsWith(' ') || regex.test(value)) {
					return helpers.error('custom.noLeadingSpaces');
				}
				if (value === 'h' || value === 'd' || value === 'y') {
					return value;
				}
				return helpers.error('custom.invalidtime');
			})
			.messages({
				'custom.invalidtime':
					'time units can be represented in Hours (h) or Days (d).',
				'string.base': 'time must be a string',
				'custom.requireInterval': 'interval is required',
				'custom.noLeadingSpaces':
					'time should not have leading or trailing spaces',
				'any.required': 'time is required',
				'any.only': 'time must be one of m or h or s',
				'string.empty': 'time cannot be empty',
			}),
	});

	const { error } = schema.validate(req.query);

	if (error) {
		return res
			.status(400)
			.json({ error: true, message: error.details[0].message });
	}
	next();
};

export const getAddressDetailValidation = (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction,
) => {
	const schema = Joi.object({
		address: Joi.string()
			.required()
			.custom((value, helpers) => {
				if (value.startsWith(' ')) {
					return helpers.error('custom.noLeadingSpaces');
				}
				if (!value.startsWith('0x')) {
					return helpers.error('custom.validHash');
				}
				if (value.startsWith('0x') && value.length < 42) {
					return helpers.error('custom.hashLength');
				}
			})

			.messages({
				'custom.validHash': 'address should be start with 0x',
				'custom.hashLength': 'address length should be equals to 42',
				'custom.noLeadingSpaces':
					'address should not start with a space',
				'string.pattern.base': 'address must start with 0x',
				'string.base': 'address must be a string',
				'any.required': 'address is required',
				'string.empty': 'address cannot be empty',
			}),
	});
	const { error, value } = schema.validate(req.params);
	if (error) {
		return res
			.status(400)
			.json({ error: true, message: error.details[0].message });
	}
	next();
};

export const getGraphHistoryValidationToken = (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction,
) => {
	const schema = Joi.object({
		interval: Joi.string()

			.required()
			.custom((value, helpers) => {
				const regex = /^\s+|\s+$/;
				let time;
				time = helpers.state.ancestors[0].time;
				if (time) {
					time = time.trim(); // Trim leading and trailing spaces from "time"
				}

				if (time === undefined) {
					return helpers.error('custom.requireTime');
				}
				if (time.startsWith(' ') || regex.test(time)) {
					return helpers.error('custom.noLeadingSpacesForTime');
				}

				if (value.startsWith(' ') || regex.test(value)) {
					return helpers.error('custom.noLeadingSpaces');
				}

				// Access the "time" value from the parent

				if (time === 'y') {
					if (value !== '1') {
						return helpers.error('custom.invalidInterval_y');
					}
				} else if (time === 'd') {
					if (value === '1' || value === '7' || value === '30') {
						return value;
					} else {
						return helpers.error('custom.invalidInterval_d');
					}
				} else {
					return helpers.error('custom.invalidtime');
				}
			})
			.messages({
				'custom.invalidInterval_d':
					'the interval should be set to 1 day,7 day,30 day when dealing with time units in day (d).',

				'custom.invalidInterval_y':
					'the interval should be set to 1 year when dealing with time units in year (y).',

				'custom.invalidtime':
					'time units can be represented in  Days (d).',
				'string.base': 'interval must be a string',
				'custom.noLeadingSpaces':
					'interval should not have leading or trailing spaces',
				'any.required': 'interval is required',
				'custom.noLeadingSpacesForTime':
					'time should not have leading or trailing spaces',
				'custom.requireTime': 'time is required',
			}),
		time: Joi.string()
			.required()
			.custom((value, helpers) => {
				const regex = /^\s+|\s+$/;
				if (value.startsWith(' ') || regex.test(value)) {
					return helpers.error('custom.noLeadingSpaces');
				}
				if (value === 'y' || value === 'd') {
					return value;
				} else {
					return helpers.error('custom.invalidtime');
				}
			})
			.required()
			.messages({
				'custom.invalidtime':
					'time units can be represented in Days (d) or Year (y).',
				'string.base': 'time must be a string',
				'custom.requireInterval': 'interval is required',
				'custom.noLeadingSpaces':
					'time should not have leading or trailing spaces',
				'any.required': 'time is required',
				'any.only': 'time must be one of m or h or s',
				'string.empty': 'time cannot be empty',
			}),
	});

	const { error } = schema.validate(req.query);

	if (error) {
		return res
			.status(400)
			.json({ error: true, message: error.details[0].message });
	}
	next();
};
