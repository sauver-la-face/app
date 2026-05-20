import type { PatientCodeStatus, PatientSyncStatus } from '@sauver-la-face/shared';
import { PatientCodeValue } from '@sauver-la-face/shared';

import type { PatientCodeRecord } from './patientRepository';

const PATIENT_CODE_TTL_MS = 48 * 60 * 60 * 1000;
const OFFLINE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

export function resolvePatientSyncStatus(lastSyncedAt: Date | null, now: Date): PatientSyncStatus {
  if (lastSyncedAt === null) {
    return 'never_synced';
  }

  if (now.getTime() - lastSyncedAt.getTime() > OFFLINE_THRESHOLD_MS) {
    return 'offline';
  }

  return 'ok';
}

export function resolvePatientCodeStatus(
  latestCode:
    | Pick<PatientCodeRecord, 'createdAt' | 'usedAt' | 'deletedAt' | 'revokedAt'>
    | undefined,
  now: Date,
): PatientCodeStatus {
  if (!latestCode) {
    return 'none';
  }

  if (latestCode.revokedAt !== null) {
    return 'revoked';
  }

  if (latestCode.usedAt !== null) {
    return 'used';
  }

  if (latestCode.deletedAt !== null) {
    return 'expired';
  }

  if (now.getTime() - latestCode.createdAt.getTime() > PATIENT_CODE_TTL_MS) {
    return 'expired';
  }

  return 'active';
}

export function buildPatientCode(rawCode: string): PatientCodeValue {
  return PatientCodeValue.create(rawCode);
}

export function getPatientCodeExpiry(createdAt: Date): Date {
  return new Date(createdAt.getTime() + PATIENT_CODE_TTL_MS);
}
