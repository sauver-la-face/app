import { describe, expect, test } from 'bun:test';

import type { SyncRequest, SyncServerState } from '@sauver-la-face/shared';
import {
  ensureSupportedSchemaVersion,
  resolveSyncPayload,
  SyncVersionError,
} from '../src/features/sync/domain/syncDomain';

const patientId = '11111111-1111-4111-8111-111111111111';
const mediaId = '22222222-2222-4222-8222-222222222222';
const eventId = '33333333-3333-4333-8333-333333333333';
const symptomId = '44444444-4444-4444-8444-444444444444';
const instructionId = '55555555-5555-4555-8555-555555555555';

describe('syncDomain', () => {
  test('accepte N et N-1', () => {
    expect(() => ensureSupportedSchemaVersion(2, 2)).not.toThrow();
    expect(() => ensureSupportedSchemaVersion(1, 2)).not.toThrow();
  });

  test('rejette une version de schema incompatible avec APP_UPDATE_REQUIRED', () => {
    expect(() => ensureSupportedSchemaVersion(3, 2)).toThrow(SyncVersionError);
    expect(() => ensureSupportedSchemaVersion(0, 2)).toThrow(SyncVersionError);
  });

  test('detecte les conflits et conserve uniquement les changements applicables', () => {
    const payload: SyncRequest = {
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
          description: 'client',
        },
      ],
      instructionAcknowledgements: [
        {
          uuidInstructions: instructionId,
          acknowledgedAt: '2026-04-28T10:05:00.000Z',
        },
      ],
    };

    const serverState: SyncServerState = {
      medicalEventSymptoms: [{ uuidEvent: eventId, uuidSymptom: symptomId }],
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
      instructionAcknowledgements: [
        {
          uuidInstructions: instructionId,
          acknowledgedAt: '2026-04-28T10:01:00.000Z',
        },
      ],
    };

    const resolution = resolveSyncPayload(payload, serverState);

    expect(resolution.conflicts).toHaveLength(2);
    expect(resolution.appliedChanges.medicalEventSymptoms).toHaveLength(0);
    expect(resolution.appliedChanges.media).toHaveLength(0);
    expect(resolution.appliedChanges.instructionAcknowledgements).toHaveLength(0);
  });
});
