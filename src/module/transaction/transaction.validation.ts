import * as Joi from 'joi';
import * as express from 'express';

export const getTxValidation = (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction,
) => {
	const schema = Joi.object({
		page: Joi.string()
			.custom((value, helpers) => {
				if (value.startsWith(' ')) {
					return helpers.error('custom.noLeadingSpaces');
				}
				const parsedValue = parseFloat(value.trim());
				if (
					isNaN(value) ||
					!Number.isInteger(parsedValue) ||
					parsedValue < 1 ||
					value.toString().length >= 19
				) {
					return helpers.error('custom.invalidPage');
				}
				return parsedValue;
			}, 'Number Validation')
			.messages({
				'custom.noLeadingSpaces': 'page should not start with a space',
				'any.required': 'page is required',
				'custom.invalidPage': 'invalid page number',
			}),
		limit: Joi.string()
			.custom((value, helpers) => {
				if (value.startsWith(' ')) {
					return helpers.error('custom.noLeadingSpaces');
				}
				const parsedValue = parseFloat(value.trim());
				if (
					isNaN(value) ||
					!Number.isInteger(parsedValue) ||
					parsedValue < 1 ||
					parsedValue > 200
				) {
					return helpers.error('custom.number');
				}
				return parsedValue;
			}, 'Number Validation')
			.messages({
				'custom.number':
					'limit should be a valid integer between 1 and 200',
				'custom.noLeadingSpaces': 'limit should not start with a space',
				'any.required': 'limit is required',
			}),
		order: Joi.string().optional().custom((value, helpers) => {
				console.log(value !== 'dsec'|| value !== 'asc');
				
				if(value === 'desc' || value === 'asc') {return value;}
				return helpers.error('custom.order');
				
			})
			.messages({
				'custom.order':
					'Order must be dsec or asc.',
			})
	});

	const { error } = schema.validate(req.query);
	if (error) {
		return res
			.status(400)
			.json({ error: true, message: error.details[0].message });
	}
	next();
};

export const getTxByHashValidation = (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction,
) => {
	const schema = Joi.object({
		transactionHash: Joi.string()
			.required()
			.custom((value, helpers) => {
				if (value.startsWith(' ')) {
					return helpers.error('custom.noLeadingSpaces');
				} else if (!value.startsWith('0x')) {
					return helpers.error('custom.validHash');
				} else if (value.length !== 66) {
					return helpers.error('custom.hashLength');
				}
			})

			.messages({
				'custom.validHash': 'transaction hash should be start with 0x',
				'custom.hashLength':
					'transaction hash length should be equals to 66',
				'custom.noLeadingSpaces':
					'transaction hash should not start with a space',
				'string.pattern.base': 'transaction hash must start with 0x',
				'string.base': 'transaction hash must be a string',
				'any.required': 'transaction hash is required',
				'string.empty': 'transaction hash cannot be empty',
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

export const getTxByAddressValidation = (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction,
) => {
	const schema = Joi.object({
		page: Joi.string()
			.custom((value, helpers) => {
				if (value.startsWith(' ')) {
					return helpers.error('custom.noLeadingSpaces');
				}
				const parsedValue = parseFloat(value.trim());
				if (
					isNaN(value) ||
					!Number.isInteger(parsedValue) ||
					parsedValue < 1 ||
					value.toString().length >= 19
				) {
					return helpers.error('custom.invalidPage');
				}
				return parsedValue;
			}, 'Number Validation')
			.messages({
				'custom.noLeadingSpaces': 'page should not start with a space',
				'any.required': 'page is required',
				'custom.invalidPage': 'invalid page number',
			}),
		limit: Joi.string()
			.custom((value, helpers) => {
				if (value.startsWith(' ')) {
					return helpers.error('custom.noLeadingSpaces');
				}
				const parsedValue = parseFloat(value.trim());
				if (
					isNaN(value) ||
					!Number.isInteger(parsedValue) ||
					parsedValue < 1 ||
					parsedValue > 200
				) {
					return helpers.error('custom.number');
				}
				return parsedValue;
			}, 'Number Validation')
			.messages({
				'custom.number':
					'limit should be a valid integer between 1 and 200',
				'custom.noLeadingSpaces': 'limit should not start with a space',
				'any.required': 'limit is required',
			}),
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
	const { error } = schema.validate(req.query);
	if (error) {
		return res
			.status(400)
			.json({ error: true, message: error.details[0].message });
	}
	next();
};
const isNumeric = (str: string) => {
	const pattern = /^-?\d+(\.\d+)?$/;
	return pattern.test(str);
};

export const getTxByBlock = (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction,
) => {
	const querySchema = Joi.object({
		value: Joi.string()
			.required()
			.custom((value, helpers) => {
				if (value.startsWith(' ')) {
					return helpers.error('custom.noLeadingSpaces');
				}

				if (!isNumeric(value.trim())) {
					if (!value.startsWith('0x')) {
						return helpers.error('custom.validHash');
					}

					if (value.startsWith('0x') && value.length < 66) {
						return helpers.error('custom.hashLength');
					}
				} else {
					// if (
					// 	!isNaN(parseFloat(value.trim())) &&
					// 	Number.isInteger(parseFloat(value.trim())) &&
					// 	parseFloat(value.trim()) < 1
					// ) {
					// 	return helpers.error('custom.nonzero');
					// } else
					if (
						!isNaN(parseFloat(value.trim())) &&
						Number.isInteger(value.trim())
					) {
						return parseFloat(value.trim());
					}
					if (value.toString().length >= 19) {
						return helpers.error('custom.invalidblock');
					}
				}
			})
			.messages({
				'custom.nonzero': 'block number should be grater then 0',
				'custom.validHash': 'block hash should be start with 0x',
				'custom.hashLength': 'block hash length should be equals to 66',
				'custom.noLeadingSpaces':
					'block hash should not start with a space',
				'string.pattern.base': 'block hash must start with 0x',
				'string.base': 'block hash must be a string',
				'any.required': 'block hash/number is required',
				'string.empty': 'block cannot be empty',
				'custom.invalidblock': 'invalid block number',
			}),
		// value: Joi.string().required().trim().messages({
		// 	'string.base': 'block number must be a boolean',
		// 	'any.required': 'block number is required',
		// 	'string.empty': 'block number cannot be empty',
		// }),
		page: Joi.string()
			// .trim()
			.required()
			.custom((value, helpers) => {
				if (value.startsWith(' ')) {
					return helpers.error('custom.noLeadingSpaces');
				}
				const parsedValue = parseFloat(value.trim());
				if (
					isNaN(value) ||
					!Number.isInteger(parsedValue) ||
					parsedValue < 1 ||
					value.toString().length >= 19
				) {
					return helpers.error('custom.invalidPage');
				}
				return parsedValue;
			}, 'Number Validation')
			.messages({
				'custom.noLeadingSpaces': 'page should not start with a space',
				'any.required': 'page is required',
				'custom.invalidPage': 'invalid page number',
			}),
		limit: Joi.string()
			// .trim()
			.required()
			.custom((value, helpers) => {
				if (value.startsWith(' ')) {
					return helpers.error('custom.noLeadingSpaces');
				}
				const parsedValue = parseFloat(value.trim());
				if (
					isNaN(value) ||
					!Number.isInteger(parsedValue) ||
					parsedValue < 1 ||
					parsedValue > 200
				) {
					return helpers.error('custom.number');
				}
				return parsedValue;
			}, 'Number Validation')
			.messages({
				'custom.number':
					'limit should be a valid integer between 1 and 200',
				'custom.noLeadingSpaces': 'limit should not start with a space',
				'any.required': 'limit is required',
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
