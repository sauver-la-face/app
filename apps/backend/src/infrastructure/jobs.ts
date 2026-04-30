import cron from 'node-cron';
import type { AuthCron } from '../features/auth/application/auth.cron';
import { logger } from '../shared/logger';

export const scheduleJobs = (authCron: AuthCron) => {
  // Run every hour to clean expired patient codes
  cron.schedule('0 * * * *', async () => {
    logger.info('Running cron job: cleanExpiredCodes');
    await authCron.cleanExpiredCodes();
  });

  logger.info('Jobs scheduled');
};
