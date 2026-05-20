import type {
  SyncInstructionAcknowledgement,
  SyncRequest,
  SyncServerState,
} from '@sauver-la-face/shared';

import { syncSchemaVersion } from '@sauver-la-face/shared';

import type { SyncChanges } from './syncRepository';

export class SyncVersionError extends Error {
  code = 'APP_UPDATE_REQUIRED' as const;

  constructor(
    public readonly clientSchemaVersion: number,
    public readonly serverSchemaVersion: number,
  ) {
    super(
      `Unsupported schema version ${clientSchemaVersion}. Supported versions are ${serverSchemaVersion} and ${serverSchemaVersion - 1}.`,
    );
  }
}

export interface SyncConflict {
  entity: 'media' | 'instructionAcknowledgement';
  key: string;
  clientValue: unknown;
  serverValue: unknown;
}

export interface SyncResolution {
  conflicts: SyncConflict[];
  appliedChanges: SyncChanges;
}

export function ensureSupportedSchemaVersion(
  clientSchemaVersion: number,
  serverSchemaVersion = syncSchemaVersion,
): void {
  const minimumSupportedVersion = serverSchemaVersion - 1;

  if (clientSchemaVersion > serverSchemaVersion || clientSchemaVersion < minimumSupportedVersion) {
    throw new SyncVersionError(clientSchemaVersion, serverSchemaVersion);
  }
}

export function resolveSyncPayload(
  payload: SyncRequest,
  serverState: SyncServerState,
): SyncResolution {
  const conflicts: SyncConflict[] = [];

  const serverMedicalEventSymptomKeys = new Set(
    serverState.medicalEventSymptoms.map(buildMedicalEventSymptomKey),
  );
  const appliedMedicalEventSymptoms = payload.medicalEventSymptoms.filter(
    (entry) => !serverMedicalEventSymptomKeys.has(buildMedicalEventSymptomKey(entry)),
  );

  const serverMediaById = new Map(serverState.media.map((entry) => [entry.uuidMedia, entry]));
  const appliedMedia = payload.media.filter((entry) => {
    const serverEntry = serverMediaById.get(entry.uuidMedia);

    if (!serverEntry) {
      return true;
    }

    if (isSameMedia(entry, serverEntry)) {
      return false;
    }

    conflicts.push({
      entity: 'media',
      key: entry.uuidMedia,
      clientValue: entry,
      serverValue: serverEntry,
    });

    return false;
  });

  const serverInstructionsById = new Map(
    serverState.instructionAcknowledgements.map((entry) => [entry.uuidInstructions, entry]),
  );
  const appliedInstructionAcknowledgements = payload.instructionAcknowledgements.filter((entry) => {
    const serverEntry = serverInstructionsById.get(entry.uuidInstructions);

    if (!serverEntry) {
      return true;
    }

    if (isSameInstructionAcknowledgement(entry, serverEntry)) {
      return false;
    }

    conflicts.push({
      entity: 'instructionAcknowledgement',
      key: entry.uuidInstructions,
      clientValue: entry,
      serverValue: serverEntry,
    });

    return false;
  });

  return {
    conflicts,
    appliedChanges: {
      medicalEventSymptoms: appliedMedicalEventSymptoms,
      media: appliedMedia,
      instructionAcknowledgements: appliedInstructionAcknowledgements,
    },
  };
}

function buildMedicalEventSymptomKey(entry: { uuidEvent: string; uuidSymptom: string }): string {
  return `${entry.uuidEvent}:${entry.uuidSymptom}`;
}

function isSameMedia(
  left: SyncServerState['media'][number],
  right: SyncServerState['media'][number],
): boolean {
  return (
    left.uuidMedia === right.uuidMedia &&
    left.uuidEvent === right.uuidEvent &&
    left.fileUrl === right.fileUrl &&
    left.fileType === right.fileType &&
    left.takenAt === right.takenAt &&
    (left.description ?? null) === (right.description ?? null)
  );
}

function isSameInstructionAcknowledgement(
  left: SyncInstructionAcknowledgement,
  right: SyncInstructionAcknowledgement,
): boolean {
  return (
    left.uuidInstructions === right.uuidInstructions && left.acknowledgedAt === right.acknowledgedAt
  );
}
