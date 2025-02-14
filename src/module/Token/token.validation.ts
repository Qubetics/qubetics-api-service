import * as Joi from 'joi';
import * as express from 'express';

export const getTokenValidation = (
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

export const getTokensValidation = (
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
			}),
		value: Joi.string()
			.custom((value, helpers) => {
				if (value.startsWith(' ')) {
					return helpers.error('custom.noLeadingSpaces');
				}
			})
			.messages({
				'custom.noLeadingSpaces': 'value should not start with a space',
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

export const tokenearchingValidation = (
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
				return value;
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

	const queryResult = querySchema.validate(req.params);

	if (queryResult.error) {
		return res.status(400).json({
			error: true,
			message: queryResult.error.details[0].message,
		});
	}

	next();
};

export const getTxByAddressValidation = (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction,
) => {
	const querySchema = Joi.object({
		page: Joi.string()
			// .trim()
			// .required()
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
			// .required()
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
					return 10;
				}
				return parsedValue;
			}, 'Number Validation')
			.messages({
				'custom.number':
					'limit should be a valid integer between 1 and 10',
				'custom.noLeadingSpaces': 'limit should not start with a space',
				'any.required': 'limit is required',
			}),
	});
	const paramSchema = Joi.object({
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
	// const queryResult = querySchema.validate(req.query);
	const paramResult = paramSchema.validate(req.params);
	const { error, value } = querySchema.validate(req.query, {
		abortEarly: false,
	});
	req.query.limit = value.limit === 10 ? '10' : value.limit?.toString();
	if (error) {
		return res.status(400).json({
			error: true,
			message: error.details[0].message,
		});
	}
	if (paramResult.error) {
		return res.status(400).json({
			error: true,
			message: paramResult.error.details[0].message,
		});
	}
	next();
};

export const getTokenValidationWithAddress = (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction,
) => {
	const querySchema = Joi.object({
		page: Joi.string()
			// .trim()
			// .required()
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
			// .required()
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
					return 10;
				}
				return parsedValue;
			}, 'Number Validation')
			.messages({
				'custom.number':
					'limit should be a valid integer between 1 and 10',
				'custom.noLeadingSpaces': 'limit should not start with a space',
				'any.required': 'limit is required',
			}),
	});
	const paramSchema = Joi.object({
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
	// const queryResult = querySchema.validate(req.query);
	const paramResult = paramSchema.validate(req.params);
	const { error, value } = querySchema.validate(req.query, {
		abortEarly: false,
	});
	req.query.limit = value.limit === 10 ? '10' : value.limit?.toString();
	if (error) {
		return res.status(400).json({
			error: true,
			message: error.details[0].message,
		});
	}
	if (paramResult.error) {
		return res.status(400).json({
			error: true,
			message: paramResult.error.details[0].message,
		});
	}
	next();
};
