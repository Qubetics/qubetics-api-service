import { rateLimit } from 'express-rate-limit';
import { RATE_LIMITER_MESSAGE } from '../constant/response';

const limiter = rateLimit({
	windowMs: RATE_LIMITER_MESSAGE.WINDOW_MS,
	max: RATE_LIMITER_MESSAGE.MAX,
	standardHeaders: 'draft-7',
	message: {
		error: true,
		message: RATE_LIMITER_MESSAGE.TOO_MANY_REQUEST,
	},
	legacyHeaders: false,
});

export default limiter;
