import { REDIS_KEY, RES_MSG } from '../../constant/response';
import { convertBigIntToNumber } from '../../helper/common.helper';
import { IESResponse } from '../../interfaces';
import prisma from '../../lib/db';
import redisHelper from '../../service/redis.helper';

class ValidatorService {
	async getAllValidators(data: {
		page: number;
		limit: number;
	}): Promise<IESResponse> {
		try {
			let { page, limit } = data;
			let validatorData: any = [];
			let totalValidators: number;
			let activeValidators;

			let redis_key = `${REDIS_KEY.VALIDATOR_LIST}_page_${page}_limit_${limit}`;
			const redisData = await redisHelper.getString(redis_key);

			if (redisData) {
				validatorData = redisData.validators;
				totalValidators = redisData.totalValidators;
				activeValidators = redisData.activeValidators;
			} else {
				const [validators, validatorCount, activeValidatorCount] =
					await prisma.$transaction([
						prisma.validator.findMany({
							orderBy: {
								selfStake: 'desc',
							},
							skip: data.page * data.limit,
							take: data.limit,
						}),
						prisma.validator.count(),
						prisma.validator.count({
							where: {
								status: 'active',
							},
						}),
					]);

				if (!validators?.length)
					throw new Error(RES_MSG.VALIDATOR_NOT_FOUND);

				await redisHelper.setStringWithExpiry(
					redis_key,
					{
						validators: validators || [],
						totalValidators: validatorCount,
						activeValidators: activeValidatorCount,
					},
					600,
				);
				totalValidators = validatorCount;
				validatorData = validators;
				activeValidators = activeValidatorCount;
			}

			return {
				error: false,
				message: RES_MSG.ALL_VALIDATOR_FETCH,
				data: {
					count: totalValidators,
					activeValidators: activeValidators,
					validators: convertBigIntToNumber(validatorData),
				},
			};
		} catch (err) {
			if (err instanceof Error) {
				if (err.message.includes('prisma')) {
					return { error: true, message: RES_MSG.SERVER_ERROR };
				}
				return { error: true, message: err.message };
			}
			return { error: true, message: RES_MSG.ERROR };
		}
	}
}
export default new ValidatorService();
