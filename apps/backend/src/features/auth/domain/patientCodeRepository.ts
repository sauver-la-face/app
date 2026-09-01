import type { PatientCodeValue } from '@sauver-la-face/shared';

export interface PatientCode {
  uuid_patient_code: string;
  uuid_patient: string;
  code: PatientCodeValue;
  created_at: Date;
  used_at: Date | null;
  deleted_at: Date | null;
  is_active: boolean;
  revoked_at: Date | null;
}

export interface PatientCodeRepository {
  save(patientCode: PatientCode): Promise<void>;
  findByCode(code: PatientCodeValue): Promise<PatientCode | null>;
  findById(uuid_patient_code: string): Promise<PatientCode | null>;
  findActiveByPatient(uuid_patient: string): Promise<PatientCode | null>;
  softDeleteExpiredUnused(cutoff: Date): Promise<number>;
}
