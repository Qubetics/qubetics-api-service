import logger from '../lib/logger';

class CronService {
	constructor() {
		logger.info('cron service running...');
	}
}
export default new CronService();
