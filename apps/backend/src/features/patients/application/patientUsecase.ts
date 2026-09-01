import type {
  CreatePatientInput,
  PatientAccessCode,
  PatientDetails,
  PatientHistoryResponse,
  PatientListResponse,
  PatientSummary,
  UpdatePatientInput,
} from '@sauver-la-face/shared';

import { logger } from '@shared/logger';

import { Patient } from '../domain/patient';
import type { PatientRepository, PatientRepositoryRecord } from '../domain/patientRepository';
import {
  buildPatientCode,
  getPatientCodeExpiry,
  resolvePatientCodeStatus,
  resolvePatientSyncStatus,
} from '../domain/patientsDomain';

interface PatientLogger {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
}

export class PatientNotFoundError extends Error {
  readonly code = 'PATIENT_NOT_FOUND';

  constructor(patientId: string) {
    super(`Patient ${patientId} not found`);
  }
}

export class PatientCodeGenerationError extends Error {
  readonly code = 'PATIENT_CODE_GENERATION_FAILED';

  constructor() {
    super('Unable to generate a unique patient access code');
  }
}

export class PatientUsecase {
  constructor(
    private readonly patientRepository: PatientRepository,
    private readonly patientLogger: PatientLogger = logger,
    private readonly nowFactory: () => Date = () => new Date(),
    private readonly codeGenerator: () => string = () =>
      Math.floor(Math.random() * 1_000_000)
        .toString()
        .padStart(6, '0'),
  ) {}

  async createPatient(command: CreatePatientInput): Promise<PatientDetails> {
    const patient = Patient.create(command);
    const persisted = await this.patientRepository.create({
      firstName: patient.firstName,
      lastName: patient.lastName,
      sex: patient.sex,
      birthdate: patient.birthdate,
      region: patient.region,
      anonymizedAt: null,
      lastSyncedAt: null,
    });

    this.patientLogger.info({ patientId: persisted.patientId }, 'Patient created');

    return toPatientDetails(
      {
        ...persisted,
        latestCode: undefined,
      },
      this.nowFactory(),
    );
  }

  async getPatient(patientId: string): Promise<PatientDetails> {
    const patient = await this.patientRepository.findById(patientId);

    if (!patient) {
      throw new PatientNotFoundError(patientId);
    }

    return toPatientDetails(patient, this.nowFactory());
  }

  async getPatientHistory(patientId: string): Promise<PatientHistoryResponse> {
    const history = await this.patientRepository.findHistoryById(patientId);

    if (!history) {
      throw new PatientNotFoundError(patientId);
    }

    return {
      patient: toPatientDetails(history.patient, this.nowFactory()),
      procedures: history.procedures,
      events: history.events,
      media: history.media,
      instructions: history.instructions,
    };
  }

  async updatePatient(patientId: string, command: UpdatePatientInput): Promise<PatientDetails> {
    const existingPatient = await this.patientRepository.findById(patientId);

    if (!existingPatient) {
      throw new PatientNotFoundError(patientId);
    }

    const updatedPatient = Patient.rehydrate({
      patientId,
      firstName: existingPatient.firstName ?? '',
      lastName: existingPatient.lastName ?? '',
      sex: existingPatient.sex,
      birthdate: existingPatient.birthdate,
      region: existingPatient.region,
      anonymizedAt: existingPatient.anonymizedAt?.toISOString() ?? null,
      lastSyncedAt: existingPatient.lastSyncedAt?.toISOString() ?? null,
    }).update(command);

    const persisted = await this.patientRepository.update(patientId, {
      firstName: updatedPatient.firstName,
      lastName: updatedPatient.lastName,
      sex: updatedPatient.sex,
      birthdate: updatedPatient.birthdate,
      region: updatedPatient.region,
      anonymizedAt: existingPatient.anonymizedAt,
      lastSyncedAt: existingPatient.lastSyncedAt,
    });

    if (!persisted) {
      throw new PatientNotFoundError(patientId);
    }

    this.patientLogger.info({ patientId }, 'Patient updated');

    return toPatientDetails(
      {
        ...persisted,
        latestCode: existingPatient.latestCode,
      },
      this.nowFactory(),
    );
  }

  async listPatients(): Promise<PatientListResponse> {
    const now = this.nowFactory();
    const patients = await this.patientRepository.list();

    return {
      patients: patients.map((patient) => toPatientSummary(patient, now)),
    };
  }

  // SEC-03/A07 : coupe la session mobile en cours d'un patient — appareil perdu
  // ou vole. Le token reste cryptographiquement valide jusqu'a un an, mais
  // requirePatientAuth relit le code porteur a chaque requete et le refusera.
  // Le patient retrouve l'acces apres emission et saisie d'un nouveau code.
  async revokeSession(patientId: string): Promise<void> {
    const patient = await this.patientRepository.findById(patientId);

    if (!patient) {
      throw new PatientNotFoundError(patientId);
    }

    await this.patientRepository.revokeSession(patientId, this.nowFactory());
    this.patientLogger.info({ patientId }, 'Patient session revoked');
  }

  async issueAccessCode(patientId: string): Promise<PatientAccessCode> {
    const patient = await this.patientRepository.findById(patientId);

    if (!patient) {
      throw new PatientNotFoundError(patientId);
    }

    const createdAt = this.nowFactory();
    await this.patientRepository.revokeActiveCodes(patientId, createdAt);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = buildPatientCode(this.codeGenerator()).value;
      const created = await this.patientRepository.createAccessCode(patientId, code, createdAt);

      if (!created) {
        continue;
      }

      this.patientLogger.info({ patientId }, 'Patient access code issued');

      return {
        patientId,
        code,
        status: 'active',
        createdAt: createdAt.toISOString(),
        expiresAt: getPatientCodeExpiry(createdAt).toISOString(),
      };
    }

    this.patientLogger.warn({ patientId }, 'Patient access code generation failed');
    throw new PatientCodeGenerationError();
  }
}

function toPatientDetails(patient: PatientRepositoryRecord, now: Date): PatientDetails {
  return toPatientSummary(patient, now);
}

function toPatientSummary(patient: PatientRepositoryRecord, now: Date): PatientSummary {
  return {
    patientId: patient.patientId,
    firstName: patient.firstName,
    lastName: patient.lastName,
    sex: patient.sex,
    birthdate: patient.birthdate,
    region: patient.region,
    anonymizedAt: patient.anonymizedAt?.toISOString() ?? null,
    lastSyncedAt: patient.lastSyncedAt?.toISOString() ?? null,
    syncStatus: resolvePatientSyncStatus(patient.lastSyncedAt, now),
    patientCodeStatus: resolvePatientCodeStatus(patient.latestCode, now),
  };
}
