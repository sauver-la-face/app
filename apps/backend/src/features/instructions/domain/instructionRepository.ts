export interface InstructionPersistenceRecord {
  instructionId: string;
  medicalProcedureId: string;
  physicianId: string;
  content: string;
  createdAt: Date;
  acknowledgedAt: Date | null;
}

export interface CreateInstructionRecord {
  medicalProcedureId: string;
  physicianId: string;
  content: string;
  createdAt: Date;
}

export interface InstructionRepository {
  procedureExists(medicalProcedureId: string): Promise<boolean>;
  create(record: CreateInstructionRecord): Promise<InstructionPersistenceRecord>;
  findById(instructionId: string): Promise<InstructionPersistenceRecord | null>;
  listByPatient(patientId: string): Promise<InstructionPersistenceRecord[]>;
  markAcknowledged(
    instructionId: string,
    acknowledgedAt: Date,
  ): Promise<InstructionPersistenceRecord | null>;
}
