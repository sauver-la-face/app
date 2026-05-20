import type { SyncRequest, SyncResponse } from '@sauver-la-face/shared';

import { logger } from '@shared/logger';

import { ensureSupportedSchemaVersion, resolveSyncPayload } from '../domain/sync.domain';
import type { SyncRepository } from '../domain/syncRepository';

interface SyncLogger {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
}

export class SyncUsecase {
  constructor(
    private readonly syncRepository: SyncRepository,
    private readonly syncLogger: SyncLogger = logger,
    private readonly serverSchemaVersion = 1,
  ) {}

  async sync(command: SyncRequest): Promise<SyncResponse> {
    ensureSupportedSchemaVersion(command.schemaVersion, this.serverSchemaVersion);

    const serverStateBefore = await this.syncRepository.getServerState(command.patientId);
    const resolution = resolveSyncPayload(command, serverStateBefore);

    for (const conflict of resolution.conflicts) {
      this.syncLogger.warn(
        {
          patientId: command.patientId,
          entity: conflict.entity,
          key: conflict.key,
          clientValue: conflict.clientValue,
          serverValue: conflict.serverValue,
        },
        'Sync conflict resolved with server-wins',
      );
    }

    await this.syncRepository.applyPatientChanges(command.patientId, resolution.appliedChanges);

    const serverState = await this.syncRepository.getServerState(command.patientId);

    this.syncLogger.info(
      {
        patientId: command.patientId,
        schemaVersion: this.serverSchemaVersion,
        conflictCount: resolution.conflicts.length,
        appliedMedicalEventSymptomsCount: resolution.appliedChanges.medicalEventSymptoms.length,
        appliedMediaCount: resolution.appliedChanges.media.length,
        appliedInstructionAcknowledgementsCount:
          resolution.appliedChanges.instructionAcknowledgements.length,
      },
      'Sync completed',
    );

    return {
      schemaVersion: this.serverSchemaVersion,
      serverState,
    };
  }
}
