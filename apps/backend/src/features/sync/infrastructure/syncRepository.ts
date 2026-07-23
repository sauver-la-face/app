import {
  instructions,
  media,
  medicalEvent,
  medicalEventSymptom,
  medicalProcedure,
  patient,
} from '@infrastructure/schema';
import type { SyncServerState } from '@sauver-la-face/shared';
import type { DbClient } from '@shared/db';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import type { SyncChanges, SyncRepository } from '../domain/syncRepository';

type SyncStateByPatient = Record<string, SyncServerState>;

export class InMemorySyncRepository implements SyncRepository {
  private readonly stateByPatient: Map<string, SyncServerState>;

  constructor(seed: SyncStateByPatient = {}) {
    this.stateByPatient = new Map(
      Object.entries(seed).map(([patientId, state]) => [patientId, cloneServerState(state)]),
    );
  }

  async getServerState(patientId: string): Promise<SyncServerState> {
    const state = this.stateByPatient.get(patientId) ?? createEmptyServerState();
    return cloneServerState(state);
  }

  async applyPatientChanges(patientId: string, changes: SyncChanges): Promise<void> {
    const state = this.stateByPatient.get(patientId) ?? createEmptyServerState();

    for (const entry of changes.medicalEventSymptoms) {
      const alreadyExists = state.medicalEventSymptoms.some(
        (candidate) =>
          candidate.uuidEvent === entry.uuidEvent && candidate.uuidSymptom === entry.uuidSymptom,
      );

      if (!alreadyExists) {
        state.medicalEventSymptoms.push(entry);
      }
    }

    for (const entry of changes.media) {
      const alreadyExists = state.media.some(
        (candidate) => candidate.uuidMedia === entry.uuidMedia,
      );

      if (!alreadyExists) {
        state.media.push(entry);
      }
    }

    for (const entry of changes.instructionAcknowledgements) {
      const existingIndex = state.instructionAcknowledgements.findIndex(
        (candidate) => candidate.uuidInstructions === entry.uuidInstructions,
      );

      if (existingIndex === -1) {
        state.instructionAcknowledgements.push(entry);
        continue;
      }

      state.instructionAcknowledgements[existingIndex] = entry;
    }

    this.stateByPatient.set(patientId, cloneServerState(state));
  }
}

export class PgSyncRepository implements SyncRepository {
  constructor(private readonly db: DbClient) {}

  async getServerState(patientId: string): Promise<SyncServerState> {
    const procedureIds = await this.getPatientProcedureIds(patientId);

    if (procedureIds.length === 0) {
      return createEmptyServerState();
    }

    const eventIds = await this.getPatientEventIds(procedureIds);

    const [serverMedicalEventSymptoms, serverMedia, serverInstructions] = await Promise.all([
      this.getMedicalEventSymptoms(eventIds),
      this.getMedia(eventIds),
      this.getInstructionAcknowledgements(procedureIds),
    ]);

    return {
      medicalEventSymptoms: serverMedicalEventSymptoms,
      media: serverMedia,
      instructionAcknowledgements: serverInstructions,
    };
  }

  async applyPatientChanges(patientId: string, changes: SyncChanges): Promise<void> {
    const procedureIds = await this.getPatientProcedureIds(patientId);

    const eventIds = await this.getPatientEventIds(procedureIds);
    const allowedEventIds = new Set(eventIds);
    const allowedProcedureIds = new Set(procedureIds);

    for (const entry of changes.medicalEventSymptoms) {
      if (!allowedEventIds.has(entry.uuidEvent)) {
        continue;
      }

      await this.db
        .insert(medicalEventSymptom)
        .values({
          uuid_event: entry.uuidEvent,
          uuid_symptom: entry.uuidSymptom,
        })
        .onConflictDoNothing();
    }

    for (const entry of changes.media) {
      if (!allowedEventIds.has(entry.uuidEvent)) {
        continue;
      }

      await this.db
        .insert(media)
        .values({
          uuid_media: entry.uuidMedia,
          uuid_event: entry.uuidEvent,
          file_url: entry.fileUrl,
          file_type: entry.fileType,
          taken_at: new Date(entry.takenAt),
          description: entry.description ?? null,
        })
        .onConflictDoNothing();
    }

    for (const entry of changes.instructionAcknowledgements) {
      const matchingInstructionRows = await this.db
        .select({
          uuidInstructions: instructions.uuid_instructions,
          uuidMedicalProcedure: instructions.uuid_medical_procedure,
        })
        .from(instructions)
        .where(eq(instructions.uuid_instructions, entry.uuidInstructions));

      const matchingInstruction = matchingInstructionRows[0];

      if (
        !matchingInstruction ||
        !allowedProcedureIds.has(matchingInstruction.uuidMedicalProcedure)
      ) {
        continue;
      }

      await this.db
        .update(instructions)
        .set({
          acknowledged_at: new Date(entry.acknowledgedAt),
        })
        .where(eq(instructions.uuid_instructions, entry.uuidInstructions));
    }

    await this.db
      .update(patient)
      .set({
        last_synced_at: new Date(),
      })
      .where(eq(patient.uuid_patient, patientId));
  }

  private async getPatientProcedureIds(patientId: string): Promise<string[]> {
    const rows = await this.db
      .select({
        uuidMedicalProcedure: medicalProcedure.uuid_medical_procedure,
      })
      .from(medicalProcedure)
      .where(eq(medicalProcedure.uuid_patient, patientId));

    return rows.map((row) => row.uuidMedicalProcedure);
  }

  private async getPatientEventIds(procedureIds: string[]): Promise<string[]> {
    if (procedureIds.length === 0) {
      return [];
    }

    const rows = await this.db
      .select({
        uuidEvent: medicalEvent.uuid_event,
      })
      .from(medicalEvent)
      .where(inArray(medicalEvent.uuid_medical_procedure, procedureIds));

    return rows.map((row) => row.uuidEvent);
  }

  private async getMedicalEventSymptoms(eventIds: string[]) {
    if (eventIds.length === 0) {
      return [];
    }

    return this.db
      .select({
        uuidEvent: medicalEventSymptom.uuid_event,
        uuidSymptom: medicalEventSymptom.uuid_symptom,
      })
      .from(medicalEventSymptom)
      .where(inArray(medicalEventSymptom.uuid_event, eventIds));
  }

  private async getMedia(eventIds: string[]) {
    if (eventIds.length === 0) {
      return [];
    }

    const rows = await this.db
      .select({
        uuidMedia: media.uuid_media,
        uuidEvent: media.uuid_event,
        fileUrl: media.file_url,
        fileType: media.file_type,
        takenAt: media.taken_at,
        description: media.description,
      })
      .from(media)
      .where(inArray(media.uuid_event, eventIds));

    return rows.map((row) => ({
      uuidMedia: row.uuidMedia,
      uuidEvent: row.uuidEvent,
      fileUrl: row.fileUrl,
      fileType: row.fileType,
      takenAt: row.takenAt.toISOString(),
      description: row.description,
    }));
  }

  private async getInstructionAcknowledgements(procedureIds: string[]) {
    if (procedureIds.length === 0) {
      return [];
    }

    const rows = await this.db
      .select({
        uuidInstructions: instructions.uuid_instructions,
        acknowledgedAt: instructions.acknowledged_at,
      })
      .from(instructions)
      .where(
        and(
          inArray(instructions.uuid_medical_procedure, procedureIds),
          isNotNull(instructions.acknowledged_at),
        ),
      );

    return rows.map((row) => {
      if (row.acknowledgedAt === null) {
        throw new Error('acknowledgedAt should not be null after isNotNull filter');
      }

      return {
        uuidInstructions: row.uuidInstructions,
        acknowledgedAt: row.acknowledgedAt.toISOString(),
      };
    });
  }
}

function createEmptyServerState(): SyncServerState {
  return {
    medicalEventSymptoms: [],
    media: [],
    instructionAcknowledgements: [],
  };
}

function cloneServerState(state: SyncServerState): SyncServerState {
  return {
    medicalEventSymptoms: [...state.medicalEventSymptoms],
    media: state.media.map((entry) => ({ ...entry })),
    instructionAcknowledgements: state.instructionAcknowledgements.map((entry) => ({
      ...entry,
    })),
  };
}
