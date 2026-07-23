import { instructions, medicalProcedure } from '@infrastructure/schema';
import type { DbClient } from '@shared/db';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type {
  CreateInstructionRecord,
  InstructionPersistenceRecord,
  InstructionRepository,
} from '../domain/instructionRepository';

interface InMemoryProcedure {
  medicalProcedureId: string;
  patientId: string;
}

interface InMemorySeed {
  procedures?: InMemoryProcedure[];
  instructions?: InstructionPersistenceRecord[];
}

export class InMemoryInstructionRepository implements InstructionRepository {
  private readonly procedures = new Map<string, InMemoryProcedure>();
  private readonly records: InstructionPersistenceRecord[] = [];

  constructor(seed: InMemorySeed = {}) {
    for (const procedure of seed.procedures ?? []) {
      this.procedures.set(procedure.medicalProcedureId, { ...procedure });
    }

    for (const record of seed.instructions ?? []) {
      this.records.push({ ...record });
    }
  }

  async procedureExists(medicalProcedureId: string): Promise<boolean> {
    return this.procedures.has(medicalProcedureId);
  }

  async create(record: CreateInstructionRecord): Promise<InstructionPersistenceRecord> {
    const persisted: InstructionPersistenceRecord = {
      instructionId: crypto.randomUUID(),
      medicalProcedureId: record.medicalProcedureId,
      physicianId: record.physicianId,
      content: record.content,
      createdAt: record.createdAt,
      acknowledgedAt: null,
    };
    this.records.push(persisted);
    return { ...persisted };
  }

  async findById(instructionId: string): Promise<InstructionPersistenceRecord | null> {
    const record = this.records.find((candidate) => candidate.instructionId === instructionId);
    return record ? { ...record } : null;
  }

  async listByPatient(patientId: string): Promise<InstructionPersistenceRecord[]> {
    const procedureIds = new Set(
      Array.from(this.procedures.values())
        .filter((procedure) => procedure.patientId === patientId)
        .map((procedure) => procedure.medicalProcedureId),
    );

    return this.records
      .filter((record) => procedureIds.has(record.medicalProcedureId))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .map((record) => ({ ...record }));
  }

  async markAcknowledged(
    instructionId: string,
    acknowledgedAt: Date,
  ): Promise<InstructionPersistenceRecord | null> {
    const record = this.records.find((candidate) => candidate.instructionId === instructionId);

    if (!record) {
      return null;
    }

    if (record.acknowledgedAt === null) {
      record.acknowledgedAt = acknowledgedAt;
    }

    return { ...record };
  }

  async findPatientIdByInstructionId(instructionId: string): Promise<string | null> {
    const record = this.records.find((candidate) => candidate.instructionId === instructionId);
    if (!record) {
      return null;
    }
    return this.procedures.get(record.medicalProcedureId)?.patientId ?? null;
  }
}

export class PgInstructionRepository implements InstructionRepository {
  constructor(private readonly db: DbClient) {}

  async procedureExists(medicalProcedureId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: medicalProcedure.uuid_medical_procedure })
      .from(medicalProcedure)
      .where(eq(medicalProcedure.uuid_medical_procedure, medicalProcedureId))
      .limit(1);

    return rows.length > 0;
  }

  async create(record: CreateInstructionRecord): Promise<InstructionPersistenceRecord> {
    const rows = await this.db
      .insert(instructions)
      .values({
        uuid_medical_procedure: record.medicalProcedureId,
        uuid_physician: record.physicianId,
        content: record.content,
        created_at: record.createdAt,
      })
      .returning();

    return mapRow(rows[0]);
  }

  async findById(instructionId: string): Promise<InstructionPersistenceRecord | null> {
    const rows = await this.db
      .select()
      .from(instructions)
      .where(eq(instructions.uuid_instructions, instructionId))
      .limit(1);

    return rows[0] ? mapRow(rows[0]) : null;
  }

  async listByPatient(patientId: string): Promise<InstructionPersistenceRecord[]> {
    const rows = await this.db
      .select({
        instructionId: instructions.uuid_instructions,
        medicalProcedureId: instructions.uuid_medical_procedure,
        physicianId: instructions.uuid_physician,
        content: instructions.content,
        createdAt: instructions.created_at,
        acknowledgedAt: instructions.acknowledged_at,
      })
      .from(instructions)
      .innerJoin(
        medicalProcedure,
        eq(instructions.uuid_medical_procedure, medicalProcedure.uuid_medical_procedure),
      )
      .where(eq(medicalProcedure.uuid_patient, patientId))
      .orderBy(desc(instructions.created_at));

    return rows.map((row) => ({
      instructionId: row.instructionId,
      medicalProcedureId: row.medicalProcedureId,
      physicianId: row.physicianId,
      content: row.content,
      createdAt: row.createdAt,
      acknowledgedAt: row.acknowledgedAt,
    }));
  }

  async markAcknowledged(
    instructionId: string,
    acknowledgedAt: Date,
  ): Promise<InstructionPersistenceRecord | null> {
    const rows = await this.db
      .update(instructions)
      .set({ acknowledged_at: acknowledgedAt })
      .where(
        and(
          eq(instructions.uuid_instructions, instructionId),
          isNull(instructions.acknowledged_at),
        ),
      )
      .returning();

    if (rows[0]) {
      return mapRow(rows[0]);
    }

    return this.findById(instructionId);
  }

  async findPatientIdByInstructionId(instructionId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ patientId: medicalProcedure.uuid_patient })
      .from(instructions)
      .innerJoin(
        medicalProcedure,
        eq(instructions.uuid_medical_procedure, medicalProcedure.uuid_medical_procedure),
      )
      .where(eq(instructions.uuid_instructions, instructionId))
      .limit(1);
    return row?.patientId ?? null;
  }
}

function mapRow(row: typeof instructions.$inferSelect): InstructionPersistenceRecord {
  return {
    instructionId: row.uuid_instructions,
    medicalProcedureId: row.uuid_medical_procedure,
    physicianId: row.uuid_physician,
    content: row.content,
    createdAt: row.created_at,
    acknowledgedAt: row.acknowledged_at,
  };
}
