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
  // SEC-02/A01 : resout le patient proprietaire d'une instruction (via sa
  // procedure medicale), pour verifier l'appartenance avant accuse de lecture.
  findPatientIdByInstructionId(instructionId: string): Promise<string | null>;
}
