import { eq, and, isNull, lt } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PatientCodeValue } from '@sauver-la-face/shared';
import * as schema from '../../../infrastructure/schema';
import type { PatientCode, PatientCodeRepository } from '../domain/patientCodeRepository';

export class DrizzlePatientCodeRepository implements PatientCodeRepository {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async save(patientCode: PatientCode): Promise<void> {
    await this.db
      .insert(schema.patientCode)
      .values({
        uuid_patient_code: patientCode.uuid_patient_code,
        uuid_patient: patientCode.uuid_patient,
        code: patientCode.code.toString(),
        created_at: patientCode.created_at,
        used_at: patientCode.used_at,
        deleted_at: patientCode.deleted_at,
        is_active: patientCode.is_active,
        revoked_at: patientCode.revoked_at,
      })
      .onConflictDoUpdate({
        target: schema.patientCode.uuid_patient_code,
        set: {
          used_at: patientCode.used_at,
          deleted_at: patientCode.deleted_at,
          is_active: patientCode.is_active,
          revoked_at: patientCode.revoked_at,
        },
      });
  }

  async findByCode(code: PatientCodeValue): Promise<PatientCode | null> {
    const result = await this.db.query.patientCode.findFirst({
      where: eq(schema.patientCode.code, code.toString()),
    });

    if (!result) return null;

    return {
      ...result,
      code: PatientCodeValue.create(result.code),
    };
  }

  async findActiveByPatient(uuid_patient: string): Promise<PatientCode | null> {
    const result = await this.db.query.patientCode.findFirst({
      where: and(
        eq(schema.patientCode.uuid_patient, uuid_patient),
        eq(schema.patientCode.is_active, true),
        isNull(schema.patientCode.used_at),
        isNull(schema.patientCode.deleted_at),
        isNull(schema.patientCode.revoked_at),
      ),
    });

    if (!result) return null;

    return {
      ...result,
      code: PatientCodeValue.create(result.code),
    };
  }

  async softDeleteExpiredUnused(cutoff: Date): Promise<number> {
    const result = await this.db
      .update(schema.patientCode)
      .set({ 
        deleted_at: new Date(),
        is_active: false 
      })
      .where(
        and(
          isNull(schema.patientCode.used_at),
          isNull(schema.patientCode.deleted_at),
          lt(schema.patientCode.created_at, cutoff),
        ),
      );
    
    return result.rowCount ?? 0;
  }
}
