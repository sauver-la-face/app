import { describe, expect, mock, test } from 'bun:test';

import { PatientUsecase } from '../src/features/patients/application/patientUsecase';
import {
  InMemoryPatientsRepository,
  type PatientHistoryRecord,
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

  test('retourne un historique patient agrege pour la page web', async () => {
    const repository = new InMemoryPatientsRepository({
      patients: [createPatientSeed(existingPatientId)],
      histories: [createPatientHistorySeed(existingPatientId)],
    });
    const logger = { info: mock(() => undefined), warn: mock(() => undefined) };
    const usecase = new PatientUsecase(
      repository,
      logger,
      () => now,
      () => '123456',
    );

    const history = await usecase.getPatientHistory(existingPatientId);

    expect(history.patient.patientId).toBe(existingPatientId);
    expect(history.procedures).toHaveLength(1);
    expect(history.events).toHaveLength(2);
    expect(history.media[0]?.fileUrl).toBe('https://cdn.example.com/media-1.jpg');
    expect(history.events[0]?.symptoms[0]?.triggersAlert).toBe(true);
    expect(history.instructions[0]?.acknowledgedAt).toBe('2026-05-02T13:00:00.000Z');
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

function createPatientHistorySeed(patientId: string): PatientHistoryRecord {
  return {
    patient: {
      ...createPatientSeed(patientId),
      lastSyncedAt: new Date('2026-05-05T12:00:00.000Z'),
    },
    procedures: [
      {
        procedureId: '33333333-3333-4333-8333-333333333333',
        procedureType: 'Greffe osseuse',
        date: '2026-04-18',
        hospitalName: 'CHU Toulouse',
      },
    ],
    events: [
      {
        eventId: '44444444-4444-4444-8444-444444444444',
        procedureId: '33333333-3333-4333-8333-333333333333',
        physicianId: '55555555-5555-4555-8555-555555555555',
        eventType: 'follow_up',
        eventTitle: 'Controle a 2 semaines',
        description: 'Evolution satisfaisante avec oedeme limite.',
        createdAt: '2026-05-02T09:00:00.000Z',
        symptoms: [
          {
            code: 'pain_severe',
            labelFr: 'Douleur importante',
            labelKm: 'Pain severe km',
            triggersAlert: true,
          },
        ],
      },
      {
        eventId: '66666666-6666-4666-8666-666666666666',
        procedureId: '33333333-3333-4333-8333-333333333333',
        physicianId: null,
        eventType: 'photo_upload',
        eventTitle: 'Photo hebdomadaire',
        description: null,
        createdAt: '2026-05-05T10:30:00.000Z',
        symptoms: [
          {
            code: 'swelling_mild',
            labelFr: 'Leger gonflement',
            labelKm: 'Swelling mild km',
            triggersAlert: false,
          },
        ],
      },
    ],
    media: [
      {
        mediaId: '77777777-7777-4777-8777-777777777777',
        eventId: '66666666-6666-4666-8666-666666666666',
        fileUrl: 'https://cdn.example.com/media-1.jpg',
        fileType: 'image/jpeg',
        takenAt: '2026-05-05T10:25:00.000Z',
        description: 'Vue face',
      },
    ],
    instructions: [
      {
        instructionId: '88888888-8888-4888-8888-888888888888',
        procedureId: '33333333-3333-4333-8333-333333333333',
        physicianId: '55555555-5555-4555-8555-555555555555',
        content: 'Continuer le lavage quotidien.',
        createdAt: '2026-05-02T11:00:00.000Z',
        acknowledgedAt: '2026-05-02T13:00:00.000Z',
      },
    ],
  };
}
