import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { PATIENT_CODE_TTL_HOURS } from '../domain/authDomain';
import type { PatientCodeRepository } from '../domain/patientCodeRepository';
import { AuthCron } from './authCron';

class MockPatientCodeRepository {
  softDeleteExpiredUnused = mock(async (_cutoff: Date) => 10);
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
