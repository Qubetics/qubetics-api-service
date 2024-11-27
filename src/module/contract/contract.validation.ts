import * as Joi from 'joi';
import * as express from 'express';

export const getContractValidation = (
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

	const { error, value } = schema.validate(req.query);
	if (error) {
		return res
			.status(400)
			.json({ error: true, message: error.details[0].message });
	}
	next();
};

export const getContractIconUrls = (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction,
) => {
	const schema = Joi.object({
		address: Joi.array()
			.items(Joi.string()) // Each item in the array should be a string
			.max(10)
			.min(1)
			.required(),
	});

	const { error, value } = schema.validate(req.body);
	if (error) {
		return res
			.status(400)
			.json({ error: true, message: error.details[0].message });
	}
	next();
};

export const getContractByAddressValidation = (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction,
) => {
	const schema = Joi.object({
		contractAddress: Joi.string()
			.required()
			.custom((value, helpers) => {
				if (value.startsWith(' ')) {
					return helpers.error('custom.noLeadingSpaces');
				}
				if (!value.startsWith('0x')) {
					return helpers.error('custom.validHash');
				}
				if (!(value.length === 42)) {
					return helpers.error('custom.hashLength');
				}
			})

			.messages({
				'custom.validHash': 'contract address should be start with 0x',
				'custom.hashLength':
					'contract address length should be equals to 42',
				'custom.noLeadingSpaces':
					'contract address should not start with a space',
				'string.pattern.base': 'contract address must start with 0x',
				'string.base': 'contract address must be a string',
				'any.required': 'contract address is required',
				'string.empty': 'contract address cannot be empty',
			}),
	});
	const { error } = schema.validate(req.params);
	if (error) {
		return res
			.status(400)
			.json({ error: true, message: error.details[0].message });
	}
	next();
};

export const getContractTxValidation = (
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
		contractAddress: Joi.string()
			.required()
			.custom((value, helpers) => {
				if (value.startsWith(' ')) {
					return helpers.error('custom.noLeadingSpaces');
				}
				if (!value.startsWith('0x')) {
					return helpers.error('custom.validHash');
				}
				if (!(value.length === 42)) {
					return helpers.error('custom.hashLength');
				}
			})

			.messages({
				'custom.validHash': 'contract address should be start with 0x',
				'custom.hashLength':
					'contract address length should be equals to 42',
				'custom.noLeadingSpaces':
					'contract address should not start with a space',
				'string.pattern.base': 'contract address must start with 0x',
				'string.base': 'contract address must be a string',
				'any.required': 'contract address is required',
				'string.empty': 'contract address cannot be empty',
			}),
	});
	const { error, value } = schema.validate(req.query);
	if (error) {
		return res
			.status(400)
			.json({ error: true, message: error.details[0].message });
	}
	next();
};
