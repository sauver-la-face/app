export interface PatientPersistenceRecord {
  patientId: string;
  firstName: string | null;
  lastName: string | null;
  sex: string | null;
  birthdate: string | null;
  region: string | null;
  anonymizedAt: Date | null;
  lastSyncedAt: Date | null;
}

export interface PatientCodeRecord {
  patientId: string;
  code: string;
  createdAt: Date;
  usedAt: Date | null;
  deletedAt: Date | null;
  revokedAt: Date | null;
}

export interface PatientRepositoryRecord extends PatientPersistenceRecord {
  latestCode?: PatientCodeRecord;
}

export interface PatientRepository {
  create(patient: Omit<PatientPersistenceRecord, 'patientId'>): Promise<PatientPersistenceRecord>;
  findById(patientId: string): Promise<PatientRepositoryRecord | null>;
  update(
    patientId: string,
    patient: Omit<PatientPersistenceRecord, 'patientId'>,
  ): Promise<PatientPersistenceRecord | null>;
  list(): Promise<PatientRepositoryRecord[]>;
  revokeActiveCodes(patientId: string, revokedAt: Date): Promise<void>;
  createAccessCode(patientId: string, code: string, createdAt: Date): Promise<boolean>;
}
