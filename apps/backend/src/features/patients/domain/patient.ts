import type { CreatePatientInput, UpdatePatientInput } from '@sauver-la-face/shared';

interface PatientState {
  patientId?: string;
  firstName: string;
  lastName: string;
  sex: string | null;
  birthdate: string | null;
  region: string | null;
  anonymizedAt?: string | null;
  lastSyncedAt?: string | null;
}

export class Patient {
  private constructor(private readonly state: PatientState) {}

  static create(input: CreatePatientInput): Patient {
    return new Patient({
      firstName: normalizeRequired(input.firstName, 'PATIENT_FIRST_NAME_REQUIRED'),
      lastName: normalizeRequired(input.lastName, 'PATIENT_LAST_NAME_REQUIRED'),
      sex: normalizeOptional(input.sex),
      birthdate: normalizeBirthdate(input.birthdate ?? null),
      region: normalizeOptional(input.region),
      anonymizedAt: null,
      lastSyncedAt: null,
    });
  }

  static rehydrate(state: PatientState): Patient {
    return new Patient({
      patientId: state.patientId,
      firstName: normalizeRequired(state.firstName, 'PATIENT_FIRST_NAME_REQUIRED'),
      lastName: normalizeRequired(state.lastName, 'PATIENT_LAST_NAME_REQUIRED'),
      sex: normalizeOptional(state.sex),
      birthdate: normalizeBirthdate(state.birthdate ?? null),
      region: normalizeOptional(state.region),
      anonymizedAt: state.anonymizedAt ?? null,
      lastSyncedAt: state.lastSyncedAt ?? null,
    });
  }

  update(input: UpdatePatientInput): Patient {
    return new Patient({
      ...this.state,
      firstName:
        input.firstName === undefined
          ? this.state.firstName
          : normalizeRequired(input.firstName, 'PATIENT_FIRST_NAME_REQUIRED'),
      lastName:
        input.lastName === undefined
          ? this.state.lastName
          : normalizeRequired(input.lastName, 'PATIENT_LAST_NAME_REQUIRED'),
      sex: input.sex === undefined ? this.state.sex : normalizeOptional(input.sex),
      birthdate:
        input.birthdate === undefined
          ? (this.state.birthdate ?? null)
          : normalizeBirthdate(input.birthdate),
      region: input.region === undefined ? this.state.region : normalizeOptional(input.region),
    });
  }

  get firstName() {
    return this.state.firstName;
  }

  get lastName() {
    return this.state.lastName;
  }

  get sex() {
    return this.state.sex;
  }

  get birthdate() {
    return this.state.birthdate;
  }

  get region() {
    return this.state.region;
  }
}

function normalizeRequired(value: string, errorCode: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error(errorCode);
  }

  return normalized;
}

function normalizeOptional(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function normalizeBirthdate(value: string | null): string | null {
  if (value == null) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('PATIENT_BIRTHDATE_INVALID');
  }

  return value;
}
