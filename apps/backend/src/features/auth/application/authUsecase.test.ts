import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { PatientCodeValue } from '@sauver-la-face/shared';
import type { PatientCode, PatientCodeRepository } from '../domain/patientCodeRepository';
import { AuthUsecase } from './authUsecase';
import type { TokenPayload, TokenProvider } from './tokenProvider';

class MockPatientCodeRepository implements PatientCodeRepository {
  save = mock(async (_patientCode: PatientCode) => {});
  findByCode = mock(async (_code: PatientCodeValue) => null as PatientCode | null);
  findActiveByPatient = mock(async (_uuid_patient: string) => null as PatientCode | null);
  softDeleteExpiredUnused = mock(async (_cutoff: Date) => 0);
}

class MockTokenProvider implements TokenProvider {
  sign = mock(async (_payload: TokenPayload) => 'mock-token');
  verify = mock(async (_token: string) => null as TokenPayload | null);
}

describe('AuthUsecase', () => {
  let repository: MockPatientCodeRepository;
  let tokenProvider: MockTokenProvider;
  let usecase: AuthUsecase;

  beforeEach(() => {
    repository = new MockPatientCodeRepository();
    tokenProvider = new MockTokenProvider();
    usecase = new AuthUsecase(repository, tokenProvider);
  });

  describe('generatePatientCode', () => {
    it('should generate and save a new 6-digit code for a patient', async () => {
      const uuid_patient = 'patient-1';
      const patientCode = await usecase.generatePatientCode(uuid_patient);

      expect(patientCode.uuid_patient).toBe(uuid_patient);
      expect(patientCode.code.toString()).toMatch(/^\d{6}$/);
      expect(repository.save).toHaveBeenCalledTimes(1);
    });

    it('should retry if the generated code already exists', async () => {
      const uuid_patient = 'patient-1';
      const existingCode = PatientCodeValue.create('123456');

      repository.findByCode
        .mockImplementationOnce(async () => ({ code: existingCode }) as PatientCode)
        .mockImplementationOnce(async () => null);

      let callCount = 0;
      const random = () => {
        callCount++;
        return callCount === 1 ? '123456' : '654321';
      };

      const patientCode = await usecase.generatePatientCode(uuid_patient, random);

      expect(patientCode.code.toString()).toBe('654321');
      expect(repository.findByCode).toHaveBeenCalledTimes(2);
    });
  });

  describe('validatePatientCode', () => {
    it('should mark a code as used on first valid validation', async () => {
      const codeValue = PatientCodeValue.create('123456');
      const patientCode: PatientCode = {
        uuid_patient_code: 'uuid-1',
        uuid_patient: 'patient-1',
        code: codeValue,
        created_at: new Date(),
        used_at: null,
        deleted_at: null,
        is_active: true,
        revoked_at: null,
      };

      repository.findByCode.mockResolvedValue(patientCode);

      const result = await usecase.validatePatientCode('123456');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.patientCode.used_at).not.toBeNull();
      }
      expect(repository.save).toHaveBeenCalledTimes(1);
    });

    it('should fail if code does not exist', async () => {
      repository.findByCode.mockResolvedValue(null);
      const result = await usecase.validatePatientCode('000000');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('INVALID_CODE');
      }
    });

    it('should fail if code is expired', async () => {
      const codeValue = PatientCodeValue.create('123456');
      const patientCode: PatientCode = {
        uuid_patient_code: 'uuid-1',
        uuid_patient: 'patient-1',
        code: codeValue,
        created_at: new Date(Date.now() - 50 * 60 * 60 * 1000), // 50h ago
        used_at: null,
        deleted_at: null,
        is_active: true,
        revoked_at: null,
      };

      repository.findByCode.mockResolvedValue(patientCode);

      const result = await usecase.validatePatientCode('123456');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('EXPIRED_CODE');
      }
    });
  });
});
