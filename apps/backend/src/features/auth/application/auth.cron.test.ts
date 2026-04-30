import { describe, expect, it, mock, beforeEach } from 'bun:test';
import { AuthCron } from './auth.cron';
import type { PatientCodeRepository } from '../domain/patientCodeRepository';
import { PATIENT_CODE_TTL_HOURS } from '../domain/auth.domain';

class MockPatientCodeRepository {
  softDeleteExpiredUnused = mock(async (cutoff: Date) => 10);
}

describe('AuthCron', () => {
  let repository: MockPatientCodeRepository;
  let cron: AuthCron;

  beforeEach(() => {
    repository = new MockPatientCodeRepository();
    cron = new AuthCron(repository as unknown as PatientCodeRepository);
  });

  it('should call softDeleteExpiredUnused with the correct cutoff date', async () => {
    const now = new Date('2026-04-30T10:00:00Z');
    const expectedCutoff = new Date(now.getTime() - PATIENT_CODE_TTL_HOURS * 60 * 60 * 1000);
    
    await cron.cleanExpiredCodes(now);

    expect(repository.softDeleteExpiredUnused).toHaveBeenCalledWith(expectedCutoff);
  });
});
