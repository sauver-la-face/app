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

export interface PatientHistoryProcedureRecord {
  procedureId: string;
  procedureType: string;
  date: string;
  hospitalName: string | null;
}

export interface PatientHistorySymptomRecord {
  code: string;
  labelFr: string;
  labelKm: string;
  triggersAlert: boolean;
}

export interface PatientHistoryEventRecord {
  eventId: string;
  procedureId: string;
  physicianId: string | null;
  eventType: string;
  eventTitle: string | null;
  description: string | null;
  createdAt: string;
  symptoms: PatientHistorySymptomRecord[];
}

export interface PatientHistoryMediaRecord {
  mediaId: string;
  eventId: string;
  fileUrl: string;
  fileType: string;
  takenAt: string;
  description: string | null;
}

export interface PatientHistoryInstructionRecord {
  instructionId: string;
  procedureId: string;
  physicianId: string;
  content: string;
  createdAt: string;
  acknowledgedAt: string | null;
}

export interface PatientHistoryRecord {
  patient: PatientRepositoryRecord;
  procedures: PatientHistoryProcedureRecord[];
  events: PatientHistoryEventRecord[];
  media: PatientHistoryMediaRecord[];
  instructions: PatientHistoryInstructionRecord[];
}

export interface PatientRepository {
  create(patient: Omit<PatientPersistenceRecord, 'patientId'>): Promise<PatientPersistenceRecord>;
  findById(patientId: string): Promise<PatientRepositoryRecord | null>;
  findHistoryById(patientId: string): Promise<PatientHistoryRecord | null>;
  update(
    patientId: string,
    patient: Omit<PatientPersistenceRecord, 'patientId'>,
  ): Promise<PatientPersistenceRecord | null>;
  list(): Promise<PatientRepositoryRecord[]>;
  revokeActiveCodes(patientId: string, revokedAt: Date): Promise<void>;
  createAccessCode(patientId: string, code: string, createdAt: Date): Promise<boolean>;
}
