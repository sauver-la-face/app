import type { DbClient } from '@shared/db';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';

import { patient, patientCode } from '../../../infrastructure/schema';
import type {
  PatientCodeRecord,
  PatientPersistenceRecord,
  PatientRepository,
  PatientRepositoryRecord,
} from '../domain/patientRepository';

interface InMemorySeed {
  patients?: Array<PatientPersistenceRecord>;
  codes?: Array<PatientCodeRecord>;
}

export class InMemoryPatientsRepository implements PatientRepository {
  private readonly patients = new Map<string, PatientPersistenceRecord>();
  private readonly codes: Array<PatientCodeRecord> = [];

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

function isUniqueViolation(error: unknown): error is { code: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === '23505'
  );
}

export type { PatientPersistenceRecord };
