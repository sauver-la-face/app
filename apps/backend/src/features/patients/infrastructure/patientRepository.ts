import {
  instructions,
  media,
  medicalEvent,
  medicalEventSymptom,
  medicalProcedure,
  patient,
  patientCode,
  symptom,
} from '@infrastructure/schema';
import type { DbClient } from '@shared/db';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import type {
  PatientCodeRecord,
  PatientHistoryInstructionRecord,
  PatientHistoryMediaRecord,
  PatientHistoryRecord,
  PatientHistorySymptomRecord,
  PatientPersistenceRecord,
  PatientRepository,
  PatientRepositoryRecord,
} from '../domain/patientRepository';

interface InMemorySeed {
  patients?: Array<PatientPersistenceRecord>;
  codes?: Array<PatientCodeRecord>;
  histories?: Array<PatientHistoryRecord>;
}

export class InMemoryPatientsRepository implements PatientRepository {
  private readonly patients = new Map<string, PatientPersistenceRecord>();
  private readonly codes: Array<PatientCodeRecord> = [];
  private readonly histories = new Map<string, PatientHistoryRecord>();

  constructor(seed: InMemorySeed = {}) {
    for (const patientRecord of seed.patients ?? []) {
      this.patients.set(patientRecord.patientId, {
        ...patientRecord,
      });
    }

    for (const codeRecord of seed.codes ?? []) {
      this.codes.push({
        ...codeRecord,
      });
    }

    for (const historyRecord of seed.histories ?? []) {
      this.histories.set(historyRecord.patient.patientId, cloneHistory(historyRecord));
    }
  }

  async create(
    record: Omit<PatientPersistenceRecord, 'patientId'>,
  ): Promise<PatientPersistenceRecord> {
    const patientId = crypto.randomUUID();
    const created = { patientId, ...record };
    this.patients.set(patientId, created);
    return { ...created };
  }

  async findById(patientId: string): Promise<PatientRepositoryRecord | null> {
    const patientRecord = this.patients.get(patientId);

    if (!patientRecord) {
      return null;
    }

    return {
      ...patientRecord,
      latestCode: this.getLatestCode(patientId),
    };
  }

  async findHistoryById(patientId: string): Promise<PatientHistoryRecord | null> {
    const history = this.histories.get(patientId);

    if (history) {
      return cloneHistory(history);
    }

    const patientRecord = await this.findById(patientId);
    if (!patientRecord) {
      return null;
    }

    return {
      patient: patientRecord,
      procedures: [],
      events: [],
      media: [],
      instructions: [],
    };
  }

  async update(
    patientId: string,
    record: Omit<PatientPersistenceRecord, 'patientId'>,
  ): Promise<PatientPersistenceRecord | null> {
    if (!this.patients.has(patientId)) {
      return null;
    }

    const updated = { patientId, ...record };
    this.patients.set(patientId, updated);
    return { ...updated };
  }

  async list(): Promise<PatientRepositoryRecord[]> {
    return Array.from(this.patients.values())
      .sort((left, right) =>
        `${left.lastName ?? ''} ${left.firstName ?? ''}`.localeCompare(
          `${right.lastName ?? ''} ${right.firstName ?? ''}`,
        ),
      )
      .map((record) => ({
        ...record,
        latestCode: this.getLatestCode(record.patientId),
      }));
  }

  async revokeActiveCodes(patientId: string, revokedAt: Date): Promise<void> {
    for (const codeRecord of this.codes) {
      if (
        codeRecord.patientId === patientId &&
        codeRecord.usedAt === null &&
        codeRecord.deletedAt === null &&
        codeRecord.revokedAt === null
      ) {
        codeRecord.revokedAt = revokedAt;
      }
    }
  }

  async createAccessCode(patientId: string, code: string, createdAt: Date): Promise<boolean> {
    if (!this.patients.has(patientId)) {
      return false;
    }

    const duplicateCode = this.codes.some(
      (candidate) =>
        candidate.code === code && candidate.deletedAt === null && candidate.revokedAt === null,
    );

    if (duplicateCode) {
      return false;
    }

    this.codes.push({
      patientId,
      code,
      createdAt,
      usedAt: null,
      deletedAt: null,
      revokedAt: null,
    });

    return true;
  }

  private getLatestCode(patientId: string): PatientCodeRecord | undefined {
    return [...this.codes]
      .filter((record) => record.patientId === patientId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
  }
}

export class PgPatientsRepository implements PatientRepository {
  constructor(private readonly db: DbClient) {}

  async create(
    record: Omit<PatientPersistenceRecord, 'patientId'>,
  ): Promise<PatientPersistenceRecord> {
    const rows = await this.db
      .insert(patient)
      .values({
        first_name: record.firstName,
        last_name: record.lastName,
        sex: record.sex,
        birthdate: record.birthdate,
        region: record.region,
        anonymized_at: record.anonymizedAt,
        last_synced_at: record.lastSyncedAt,
      })
      .returning();

    return mapPatientRow(rows[0]);
  }

  async findById(patientId: string): Promise<PatientRepositoryRecord | null> {
    const rows = await this.db.select().from(patient).where(eq(patient.uuid_patient, patientId));
    const patientRow = rows[0];

    if (!patientRow) {
      return null;
    }

    const latestCode = await this.getLatestCodes([patientId]);

    return {
      ...mapPatientRow(patientRow),
      latestCode: latestCode.get(patientId),
    };
  }

  async findHistoryById(patientId: string): Promise<PatientHistoryRecord | null> {
    const patientRecord = await this.findById(patientId);

    if (!patientRecord) {
      return null;
    }

    const procedureRows = await this.db
      .select()
      .from(medicalProcedure)
      .where(eq(medicalProcedure.uuid_patient, patientId));

    const procedures = procedureRows.map((procedureRow) => ({
      procedureId: procedureRow.uuid_medical_procedure,
      procedureType: procedureRow.procedure_type,
      date: procedureRow.date,
      hospitalName: procedureRow.hospital_name,
    }));

    const procedureIds = procedureRows.map((procedureRow) => procedureRow.uuid_medical_procedure);

    if (procedureIds.length === 0) {
      return {
        patient: patientRecord,
        procedures,
        events: [],
        media: [],
        instructions: [],
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

    const eventIds = eventRows.map((eventRow) => eventRow.uuid_event);
    const [symptomRows, mediaRows] =
      eventIds.length === 0
        ? [[], []]
        : await Promise.all([
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

    const events = eventRows.map((eventRow) => ({
      eventId: eventRow.uuid_event,
      procedureId: eventRow.uuid_medical_procedure,
      physicianId: eventRow.uuid_physician,
      eventType: eventRow.event_type,
      eventTitle: eventRow.event_title,
      description: eventRow.description,
      createdAt: eventRow.created_at.toISOString(),
      symptoms: (symptomsByEvent.get(eventRow.uuid_event) ?? []).map(mapSymptomRow),
    }));

    const medias: PatientHistoryMediaRecord[] = mediaRows.map((mediaRow) => ({
      mediaId: mediaRow.uuid_media,
      eventId: mediaRow.uuid_event,
      fileUrl: mediaRow.file_url,
      fileType: mediaRow.file_type,
      takenAt: mediaRow.taken_at.toISOString(),
      description: mediaRow.description,
    }));

    const instructionList: PatientHistoryInstructionRecord[] = instructionRows.map(
      (instructionRow) => ({
        instructionId: instructionRow.uuid_instructions,
        procedureId: instructionRow.uuid_medical_procedure,
        physicianId: instructionRow.uuid_physician,
        content: instructionRow.content,
        createdAt: instructionRow.created_at.toISOString(),
        acknowledgedAt: instructionRow.acknowledged_at?.toISOString() ?? null,
      }),
    );

    return {
      patient: patientRecord,
      procedures,
      events,
      media: medias,
      instructions: instructionList,
    };
  }

  async update(
    patientId: string,
    record: Omit<PatientPersistenceRecord, 'patientId'>,
  ): Promise<PatientPersistenceRecord | null> {
    const rows = await this.db
      .update(patient)
      .set({
        first_name: record.firstName,
        last_name: record.lastName,
        sex: record.sex,
        birthdate: record.birthdate,
        region: record.region,
        anonymized_at: record.anonymizedAt,
        last_synced_at: record.lastSyncedAt,
      })
      .where(eq(patient.uuid_patient, patientId))
      .returning();

    const updatedRow = rows[0];
    return updatedRow ? mapPatientRow(updatedRow) : null;
  }

  async list(): Promise<PatientRepositoryRecord[]> {
    const patientRows = await this.db.select().from(patient);
    const latestCodes = await this.getLatestCodes(patientRows.map((row) => row.uuid_patient));

    return patientRows
      .map((row) => ({
        ...mapPatientRow(row),
        latestCode: latestCodes.get(row.uuid_patient),
      }))
      .sort((left, right) =>
        `${left.lastName ?? ''} ${left.firstName ?? ''}`.localeCompare(
          `${right.lastName ?? ''} ${right.firstName ?? ''}`,
        ),
      );
  }

  async revokeActiveCodes(patientId: string, revokedAt: Date): Promise<void> {
    await this.db
      .update(patientCode)
      .set({
        is_active: false,
        revoked_at: revokedAt,
      })
      .where(
        and(
          eq(patientCode.uuid_patient, patientId),
          isNull(patientCode.used_at),
          isNull(patientCode.deleted_at),
          isNull(patientCode.revoked_at),
        ),
      );
  }

  async createAccessCode(patientId: string, code: string, createdAt: Date): Promise<boolean> {
    try {
      const rows = await this.db.select().from(patient).where(eq(patient.uuid_patient, patientId));

      if (rows.length === 0) {
        return false;
      }

      await this.db.insert(patientCode).values({
        uuid_patient: patientId,
        code,
        created_at: createdAt,
        is_active: true,
      });
      return true;
    } catch (error) {
      if (isUniqueViolation(error)) {
        return false;
      }

      throw error;
    }
  }

  private async getLatestCodes(patientIds: string[]): Promise<Map<string, PatientCodeRecord>> {
    if (patientIds.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select({
        patientId: patientCode.uuid_patient,
        code: patientCode.code,
        createdAt: patientCode.created_at,
        usedAt: patientCode.used_at,
        deletedAt: patientCode.deleted_at,
        revokedAt: patientCode.revoked_at,
      })
      .from(patientCode)
      .where(inArray(patientCode.uuid_patient, patientIds))
      .orderBy(desc(patientCode.created_at));

    const latestCodes = new Map<string, PatientCodeRecord>();

    for (const row of rows) {
      if (latestCodes.has(row.patientId)) {
        continue;
      }

      latestCodes.set(row.patientId, {
        patientId: row.patientId,
        code: row.code,
        createdAt: row.createdAt,
        usedAt: row.usedAt,
        deletedAt: row.deletedAt,
        revokedAt: row.revokedAt,
      });
    }

    return latestCodes;
  }
}

function mapPatientRow(row: typeof patient.$inferSelect): PatientPersistenceRecord {
  return {
    patientId: row.uuid_patient,
    firstName: row.first_name,
    lastName: row.last_name,
    sex: row.sex,
    birthdate: row.birthdate,
    region: row.region,
    anonymizedAt: row.anonymized_at,
    lastSyncedAt: row.last_synced_at,
  };
}

function mapSymptomRow(row: {
  code: string;
  labelFr: string;
  labelKm: string;
  triggersAlert: boolean;
}): PatientHistorySymptomRecord {
  return {
    code: row.code,
    labelFr: row.labelFr,
    labelKm: row.labelKm,
    triggersAlert: row.triggersAlert,
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

function cloneHistory(history: PatientHistoryRecord): PatientHistoryRecord {
  return {
    patient: {
      ...history.patient,
      latestCode: history.patient.latestCode ? { ...history.patient.latestCode } : undefined,
    },
    procedures: history.procedures.map((procedure) => ({ ...procedure })),
    events: history.events.map((event) => ({
      ...event,
      symptoms: event.symptoms.map((symptomRecord) => ({ ...symptomRecord })),
    })),
    media: history.media.map((mediaRecord) => ({ ...mediaRecord })),
    instructions: history.instructions.map((instruction) => ({ ...instruction })),
  };
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  // drizzle-orm enveloppe l'erreur pg dans une DrizzleQueryError : le code
  // Postgres (23505 = unique_violation) est exposé sur `.cause`, pas `.code`.
  const { code, cause } = error as { code?: string; cause?: unknown };
  return code === '23505' || isUniqueViolation(cause);
}

export type { PatientHistoryRecord, PatientPersistenceRecord };
