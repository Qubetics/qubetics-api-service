import * as Joi from 'joi';
import * as express from 'express';

export const fundTransferValidation = (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction,
) => {
	const schema = Joi.object({
		toAddress: Joi.string()
			.required()
			.pattern(/^0x.{40}$/)
			.trim()
			.messages({
				'string.pattern.base':
					'to address must start with 0x and be 42 characters long',
				'string.base': 'to address must be a string',
				'any.required': 'to address is required',
				'string.empty': 'to address cannot be empty',
			}),
		value: Joi.number().min(0.1).max(5).required().messages({
			'number.base': 'value must be a number',
			'any.required': 'value is required',
			'number.min': 'value should be at least {#limit}',
			'number.max': 'value should not exceed {#limit}',
		}),
		captchaToken: Joi.string().trim().messages({
			'string.base': 'captcha must be a string',
			'any.required': 'captcha is required',
			'string.empty': 'captcha cannot be empty',
		}),
	});

	const { error, value } = schema.validate(req.body);

	if (error) {
		return res
			.status(400)
			.json({ error: true, message: error.details[0].message });
	}
	next();
};
