import { RES_MSG } from '../../constant/response';
import { convertBigIntToNumber } from '../../helper/common.helper';
import { IESResponse } from '../../interfaces';
import prisma from '../../lib/db';

class ValidatorService {
	async getAllValidators(data: {
		page: number;
		limit: number;
	}): Promise<IESResponse> {
		try {
			const [validators, validatorCount] = await prisma.$transaction([
				prisma.validator.findMany({
					orderBy: {
						selfStake: 'desc',
					},
					skip: data.page * data.limit,
					take: data.limit,
				}),
				prisma.validator.count(),
			]);
			if (!validators?.length)
				throw new Error(RES_MSG.VALIDATOR_NOT_FOUND);

			return {
				error: false,
				message: RES_MSG.ALL_VALIDATOR_FETCH,
				data: {
					count: validatorCount,
					validators: convertBigIntToNumber(validators),
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
