import { PatientCodeValue } from '@sauver-la-face/shared';
import type { PatientCode } from './patientCodeRepository';

export const PATIENT_CODE_TTL_HOURS = 48;

export function generateCode(random: () => string): PatientCodeValue {
  return PatientCodeValue.create(random());
}

export function isExpired(patientCode: PatientCode, now: Date): boolean {
  if (patientCode.used_at) return false;
  const expirationDate = new Date(
    patientCode.created_at.getTime() + PATIENT_CODE_TTL_HOURS * 60 * 60 * 1000,
  );
  return now > expirationDate;
}

export function canBeUsed(patientCode: PatientCode, now: Date): boolean {
  if (!patientCode.is_active) return false;
  if (patientCode.deleted_at) return false;
  if (patientCode.revoked_at) return false;
  if (isExpired(patientCode, now)) return false;
  return true;
}
