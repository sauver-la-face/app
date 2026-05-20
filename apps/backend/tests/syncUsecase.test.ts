import { describe, expect, mock, test } from 'bun:test';

import type { SyncRequest, SyncServerState } from '@sauver-la-face/shared';
import { SyncUsecase } from '../src/features/sync/application/syncUsecase';
import { SyncVersionError } from '../src/features/sync/domain/syncDomain';
import { InMemorySyncRepository } from '../src/features/sync/infrastructure/syncRepository';

const patientId = '11111111-1111-4111-8111-111111111111';
const eventId = '33333333-3333-4333-8333-333333333333';
const symptomId = '44444444-4444-4444-8444-444444444444';
const mediaId = '22222222-2222-4222-8222-222222222222';
const instructionId = '55555555-5555-4555-8555-555555555555';

describe('sync.usecase', () => {
  test("applique un payload normal et renvoie l'etat serveur", async () => {
    const repository = new InMemorySyncRepository();
    const logger = { info: mock(() => undefined), warn: mock(() => undefined) };
    const usecase = new SyncUsecase(repository, logger, 1);

    const result = await usecase.sync({
      patientId,
      schemaVersion: 1,
      medicalEventSymptoms: [{ uuidEvent: eventId, uuidSymptom: symptomId }],
      media: [
        {
          uuidMedia: mediaId,
          uuidEvent: eventId,
          fileUrl: 'https://client.example/media.jpg',
          fileType: 'jpeg',
          takenAt: '2026-04-28T10:00:00.000Z',
          description: null,
        },
      ],
      instructionAcknowledgements: [
        {
          uuidInstructions: instructionId,
          acknowledgedAt: '2026-04-28T10:05:00.000Z',
        },
      ],
    });

    expect(result.schemaVersion).toBe(1);
    expect(result.serverState.medicalEventSymptoms).toHaveLength(1);
    expect(result.serverState.media).toHaveLength(1);
    expect(result.serverState.instructionAcknowledgements).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalledTimes(0);
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  test('en cas de conflit, le serveur gagne et le delta est logge', async () => {
    const serverState: SyncServerState = {
      medicalEventSymptoms: [],
      media: [
        {
          uuidMedia: mediaId,
          uuidEvent: eventId,
          fileUrl: 'https://server.example/media.jpg',
          fileType: 'jpeg',
          takenAt: '2026-04-28T10:00:00.000Z',
          description: 'server',
        },
      ],
      instructionAcknowledgements: [],
    };

    const repository = new InMemorySyncRepository({
      [patientId]: serverState,
    });
    const logger = { info: mock(() => undefined), warn: mock(() => undefined) };
    const usecase = new SyncUsecase(repository, logger, 1);

    const result = await usecase.sync({
      patientId,
      schemaVersion: 1,
      medicalEventSymptoms: [],
      media: [
        {
          uuidMedia: mediaId,
          uuidEvent: eventId,
          fileUrl: 'https://client.example/media.jpg',
          fileType: 'jpeg',
          takenAt: '2026-04-28T10:00:00.000Z',
          description: 'client',
        },
      ],
      instructionAcknowledgements: [],
    });

    expect(result.serverState.media).toEqual(serverState.media);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  test('rejette une version de schema incompatible', async () => {
    const repository = new InMemorySyncRepository();
    const logger = { info: mock(() => undefined), warn: mock(() => undefined) };
    const usecase = new SyncUsecase(repository, logger, 2);

    const command: SyncRequest = {
      patientId,
      schemaVersion: 4,
      medicalEventSymptoms: [],
      media: [],
      instructionAcknowledgements: [],
    };

    await expect(usecase.sync(command)).rejects.toBeInstanceOf(SyncVersionError);
  });

  test('renvoie toujours la version serveur apres resolution', async () => {
    const repository = new InMemorySyncRepository();
    const logger = { info: mock(() => undefined), warn: mock(() => undefined) };
    const usecase = new SyncUsecase(repository, logger, 2);

    const result = await usecase.sync({
      patientId,
      schemaVersion: 1,
      medicalEventSymptoms: [],
      media: [],
      instructionAcknowledgements: [],
    });

    expect(result.schemaVersion).toBe(2);
  });
});
