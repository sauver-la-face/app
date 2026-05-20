import { logger } from '../../../shared/logger';
import { PATIENT_CODE_TTL_HOURS } from '../domain/auth.domain';
import type { PatientCodeRepository } from '../domain/patientCodeRepository';

export class AuthCron {
  constructor(private readonly repository: PatientCodeRepository) {}

  async cleanExpiredCodes(now: Date = new Date()): Promise<void> {
    const cutoff = new Date(now.getTime() - PATIENT_CODE_TTL_HOURS * 60 * 60 * 1000);

    try {
      const deletedCount = await this.repository.softDeleteExpiredUnused(cutoff);
      if (deletedCount > 0) {
        logger.info({ deletedCount, cutoff }, 'Soft deleted expired unused patient codes');
      }
    } catch (error) {
      logger.error({ error }, 'Failed to soft delete expired unused patient codes');
    }
  }
}
