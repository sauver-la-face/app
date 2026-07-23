import {
  instructions,
  media,
  medicalEvent,
  medicalEventSymptom,
  medicalProcedure,
  patient,
  symptom,
} from '@infrastructure/schema';
import type { DbClient } from '@shared/db';
import { eq, inArray } from 'drizzle-orm';
import type {
  EventExportData,
  InstructionExportData,
  MediaExportData,
  PatientExportData,
  ProcedureExportData,
  SymptomExportData,
} from '../domain/exportsDomain';
import type { ExportsRepository } from '../domain/exportsRepository';

// Adapter Drizzle pour la lecture des données d'export.
// L'agrégation se fait en plusieurs requêtes (patients → procedures → events
// → symptoms / media / instructions). Volume cible : 200 patients actifs max
// (cf. .ai/context.md) — pas de besoin de pagination.
export class PgExportsRepository implements ExportsRepository {
  constructor(private readonly db: DbClient) {}

  async findPatientExportById(patientId: string): Promise<PatientExportData | null> {
    const patientRows = await this.db
      .select()
      .from(patient)
      .where(eq(patient.uuid_patient, patientId));
    const patientRow = patientRows[0];

    if (!patientRow) {
      return null;
    }

    const aggregates = await this.loadAggregatesForPatients([patientRow.uuid_patient]);

    return mapPatient(patientRow, aggregates);
  }

  async listAllPatientsForExport(): Promise<PatientExportData[]> {
    const patientRows = await this.db.select().from(patient);
    if (patientRows.length === 0) {
      return [];
    }

    const aggregates = await this.loadAggregatesForPatients(
      patientRows.map((row) => row.uuid_patient),
    );

    return patientRows.map((row) => mapPatient(row, aggregates));
  }

  private async loadAggregatesForPatients(patientIds: string[]): Promise<PatientAggregates> {
    if (patientIds.length === 0) {
      return emptyAggregates();
    }

    const procedureRows = await this.db
      .select()
      .from(medicalProcedure)
      .where(inArray(medicalProcedure.uuid_patient, patientIds));

    const proceduresByPatient = groupBy(procedureRows, (row) => row.uuid_patient);

    const procedureIds = procedureRows.map((row) => row.uuid_medical_procedure);
    if (procedureIds.length === 0) {
      return {
        proceduresByPatient,
        eventsByProcedure: new Map(),
        instructionsByProcedure: new Map(),
        symptomsByEvent: new Map(),
        mediaByEvent: new Map(),
      };
    }

    const [eventRows, instructionRows] = await Promise.all([
      this.db
        .select()
        .from(medicalEvent)
        .where(inArray(medicalEvent.uuid_medical_procedure, procedureIds)),
      this.db
        .select()
        .from(instructions)
        .where(inArray(instructions.uuid_medical_procedure, procedureIds)),
    ]);

    const eventsByProcedure = groupBy(eventRows, (row) => row.uuid_medical_procedure);
    const instructionsByProcedure = groupBy(instructionRows, (row) => row.uuid_medical_procedure);

    const eventIds = eventRows.map((row) => row.uuid_event);
    if (eventIds.length === 0) {
      return {
        proceduresByPatient,
        eventsByProcedure,
        instructionsByProcedure,
        symptomsByEvent: new Map(),
        mediaByEvent: new Map(),
      };
    }

    const [symptomRows, mediaRows] = await Promise.all([
      this.db
        .select({
          eventId: medicalEventSymptom.uuid_event,
          code: symptom.code,
          labelFr: symptom.label_fr,
          labelKm: symptom.label_km,
          triggersAlert: symptom.triggers_alert,
        })
        .from(medicalEventSymptom)
        .innerJoin(symptom, eq(symptom.uuid_symptom, medicalEventSymptom.uuid_symptom))
        .where(inArray(medicalEventSymptom.uuid_event, eventIds)),
      this.db.select().from(media).where(inArray(media.uuid_event, eventIds)),
    ]);

    const symptomsByEvent = groupBy(symptomRows, (row) => row.eventId);
    const mediaByEvent = groupBy(mediaRows, (row) => row.uuid_event);

    return {
      proceduresByPatient,
      eventsByProcedure,
      instructionsByProcedure,
      symptomsByEvent,
      mediaByEvent,
    };
  }
}

// ── Mapping helpers ─────────────────────────────────────────────────────────

interface PatientAggregates {
  proceduresByPatient: Map<string, (typeof medicalProcedure.$inferSelect)[]>;
  eventsByProcedure: Map<string, (typeof medicalEvent.$inferSelect)[]>;
  instructionsByProcedure: Map<string, (typeof instructions.$inferSelect)[]>;
  symptomsByEvent: Map<
    string,
    Array<{
      eventId: string;
      code: string;
      labelFr: string;
      labelKm: string;
      triggersAlert: boolean;
    }>
  >;
  mediaByEvent: Map<string, (typeof media.$inferSelect)[]>;
}

function emptyAggregates(): PatientAggregates {
  return {
    proceduresByPatient: new Map(),
    eventsByProcedure: new Map(),
    instructionsByProcedure: new Map(),
    symptomsByEvent: new Map(),
    mediaByEvent: new Map(),
  };
}

function mapPatient(
  row: typeof patient.$inferSelect,
  aggregates: PatientAggregates,
): PatientExportData {
  const procedureRows = aggregates.proceduresByPatient.get(row.uuid_patient) ?? [];

  const procedures: ProcedureExportData[] = procedureRows.map((procedure) => ({
    procedureId: procedure.uuid_medical_procedure,
    procedureType: procedure.procedure_type,
    date: procedure.date,
    hospitalName: procedure.hospital_name,
  }));

  const events: EventExportData[] = procedureRows
    .flatMap(
      (procedure) => aggregates.eventsByProcedure.get(procedure.uuid_medical_procedure) ?? [],
    )
    .map((event) => {
      const symptoms: SymptomExportData[] = (
        aggregates.symptomsByEvent.get(event.uuid_event) ?? []
      ).map(({ code, labelFr, labelKm, triggersAlert }) => ({
        code,
        labelFr,
        labelKm,
        triggersAlert,
      }));
      return {
        eventId: event.uuid_event,
        procedureId: event.uuid_medical_procedure,
        physicianId: event.uuid_physician,
        eventType: event.event_type,
        eventTitle: event.event_title,
        description: event.description,
        createdAt: event.created_at.toISOString(),
        symptoms,
      };
    });

  const eventList = procedureRows.flatMap(
    (procedure) => aggregates.eventsByProcedure.get(procedure.uuid_medical_procedure) ?? [],
  );

  const mediaList: MediaExportData[] = eventList
    .flatMap((event) => aggregates.mediaByEvent.get(event.uuid_event) ?? [])
    .map((mediaRow) => ({
      mediaId: mediaRow.uuid_media,
      eventId: mediaRow.uuid_event,
      fileUrl: mediaRow.file_url,
      fileType: mediaRow.file_type,
      takenAt: mediaRow.taken_at.toISOString(),
      description: mediaRow.description,
    }));

  const instructionList: InstructionExportData[] = procedureRows
    .flatMap(
      (procedure) => aggregates.instructionsByProcedure.get(procedure.uuid_medical_procedure) ?? [],
    )
    .map((instructionRow) => ({
      instructionId: instructionRow.uuid_instructions,
      procedureId: instructionRow.uuid_medical_procedure,
      physicianId: instructionRow.uuid_physician,
      content: instructionRow.content,
      createdAt: instructionRow.created_at.toISOString(),
      acknowledgedAt: instructionRow.acknowledged_at?.toISOString() ?? null,
    }));

  return {
    patientId: row.uuid_patient,
    firstName: row.first_name,
    lastName: row.last_name,
    sex: row.sex,
    birthdate: row.birthdate,
    region: row.region,
    anonymizedAt: row.anonymized_at?.toISOString() ?? null,
    lastSyncedAt: row.last_synced_at?.toISOString() ?? null,
    procedures,
    events,
    media: mediaList,
    instructions: instructionList,
  };
}

function groupBy<T, K>(items: readonly T[], keyFn: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return groups;
}
