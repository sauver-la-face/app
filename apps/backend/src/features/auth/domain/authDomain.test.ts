import { describe, expect, it } from 'bun:test';
import { PatientCodeValue } from '@sauver-la-face/shared';
import { canBeUsed, isExpired } from './authDomain';
import type { PatientCode } from './patientCodeRepository';

const createMockPatientCode = (overrides: Partial<PatientCode> = {}): PatientCode => ({
  uuid_patient_code: 'uuid-1',
  uuid_patient: 'patient-1',
  code: PatientCodeValue.create('123456'),
  created_at: new Date(),
  used_at: null,
  deleted_at: null,
  is_active: true,
  revoked_at: null,
  ...overrides,
});

describe('authDomain', () => {
  describe('isExpired', () => {
    it('should be expired after 48h if not used', () => {
      const now = new Date('2026-04-30T10:00:00Z');
      const createdAt = new Date('2026-04-28T09:59:59Z');
      const patientCode = createMockPatientCode({ created_at: createdAt });

      expect(isExpired(patientCode, now)).toBe(true);
    });

    it('should not be expired before 48h', () => {
      const now = new Date('2026-04-30T10:00:00Z');
      const createdAt = new Date('2026-04-28T10:00:01Z');
      const patientCode = createMockPatientCode({ created_at: createdAt });

      expect(isExpired(patientCode, now)).toBe(false);
    });

    it('should never be expired if already used', () => {
      const now = new Date('2026-05-30T10:00:00Z');
      const createdAt = new Date('2026-04-28T10:00:00Z');
      const patientCode = createMockPatientCode({
        created_at: createdAt,
        used_at: new Date('2026-04-29T10:00:00Z'),
      });

      expect(isExpired(patientCode, now)).toBe(false);
    });
  });

  describe('canBeUsed', () => {
    it('should be usable if active, not deleted, not revoked and not expired', () => {
      const now = new Date('2026-04-29T10:00:00Z');
      const patientCode = createMockPatientCode({
        created_at: new Date('2026-04-28T10:00:00Z'),
      });
      expect(canBeUsed(patientCode, now)).toBe(true);
    });

    it('should not be usable if inactive', () => {
      const now = new Date('2026-04-29T10:00:00Z');
      const patientCode = createMockPatientCode({ is_active: false });
      expect(canBeUsed(patientCode, now)).toBe(false);
    });

    it('should not be usable if deleted', () => {
      const now = new Date('2026-04-29T10:00:00Z');
      const patientCode = createMockPatientCode({ deleted_at: new Date() });
      expect(canBeUsed(patientCode, now)).toBe(false);
    });

    it('should not be usable if revoked', () => {
      const now = new Date('2026-04-29T10:00:00Z');
      const patientCode = createMockPatientCode({ revoked_at: new Date() });
      expect(canBeUsed(patientCode, now)).toBe(false);
    });
  });
});
