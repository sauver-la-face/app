import { describe, expect, mock, test } from 'bun:test';

import { PatientUsecase } from '../src/features/patients/application/patientUsecase';
import {
  InMemoryPatientsRepository,
  type PatientPersistenceRecord,
} from '../src/features/patients/infrastructure/patientRepository';

const existingPatientId = '11111111-1111-4111-8111-111111111111';
const otherPatientId = '22222222-2222-4222-8222-222222222222';
const now = new Date('2026-05-06T12:00:00.000Z');

describe('patients.usecase', () => {
  test('cree, recupere et met a jour un patient', async () => {
    const repository = new InMemoryPatientsRepository();
    const logger = { info: mock(() => undefined), warn: mock(() => undefined) };
    const usecase = new PatientUsecase(
      repository,
      logger,
      () => now,
      () => '123456',
    );

    const created = await usecase.createPatient({
      firstName: 'Sok',
      lastName: 'Chan',
      sex: 'F',
      birthdate: '1990-03-12',
      region: 'Phnom Penh',
    });

    expect(created.firstName).toBe('Sok');
    expect(created.patientCodeStatus).toBe('none');
    expect(created.syncStatus).toBe('never_synced');

    const updated = await usecase.updatePatient(created.patientId, {
      region: 'Siem Reap',
    });

    expect(updated.region).toBe('Siem Reap');

    const fetched = await usecase.getPatient(created.patientId);
    expect(fetched.patientId).toBe(created.patientId);
    expect(logger.info).toHaveBeenCalledTimes(2);
  });

  test('liste les patients avec statuts de sync et de code', async () => {
    const repository = new InMemoryPatientsRepository({
      patients: [
        {
          patientId: existingPatientId,
          firstName: 'Sok',
          lastName: 'Chan',
          sex: 'F',
          birthdate: '1990-03-12',
          region: 'Phnom Penh',
          anonymizedAt: null,
          lastSyncedAt: new Date('2026-04-20T12:00:00.000Z'),
        },
      ],
      codes: [
        {
          patientId: existingPatientId,
          code: '654321',
          createdAt: new Date('2026-05-06T08:00:00.000Z'),
          usedAt: null,
          deletedAt: null,
          revokedAt: null,
        },
      ],
    });
    const logger = { info: mock(() => undefined), warn: mock(() => undefined) };
    const usecase = new PatientUsecase(
      repository,
      logger,
      () => now,
      () => '123456',
    );

    const result = await usecase.listPatients();

    expect(result.patients).toHaveLength(1);
    expect(result.patients[0]?.syncStatus).toBe('offline');
    expect(result.patients[0]?.patientCodeStatus).toBe('active');
  });

  test('attribue un code patient unique et revoque l ancien code actif', async () => {
    const repository = new InMemoryPatientsRepository({
      patients: [createPatientSeed(existingPatientId), createPatientSeed(otherPatientId)],
      codes: [
        {
          patientId: existingPatientId,
          code: '111111',
          createdAt: new Date('2026-05-06T07:00:00.000Z'),
          usedAt: null,
          deletedAt: null,
          revokedAt: null,
        },
        {
          patientId: otherPatientId,
          code: '111111',
          createdAt: new Date('2026-05-06T06:00:00.000Z'),
          usedAt: null,
          deletedAt: null,
          revokedAt: null,
        },
      ],
    });
    const logger = { info: mock(() => undefined), warn: mock(() => undefined) };
    const usecase = new PatientUsecase(
      repository,
      logger,
      () => now,
      (() => {
        const values = ['111111', '222222'];
        return () => values.shift() ?? '333333';
      })(),
    );

    const accessCode = await usecase.issueAccessCode(existingPatientId);
    const patient = await usecase.getPatient(existingPatientId);

    expect(accessCode.code).toBe('222222');
    expect(accessCode.status).toBe('active');
    expect(patient.patientCodeStatus).toBe('active');
  });
});

function createPatientSeed(patientId: string): PatientPersistenceRecord {
  return {
    patientId,
    firstName: 'Sok',
    lastName: 'Chan',
    sex: 'F',
    birthdate: '1990-03-12',
    region: 'Phnom Penh',
    anonymizedAt: null,
    lastSyncedAt: null,
  };
}
