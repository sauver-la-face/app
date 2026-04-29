import type {
  SyncInstructionAcknowledgement,
  SyncMedicalEventSymptom,
  SyncServerState,
} from '@sauver-la-face/shared';

export interface SyncChanges {
  medicalEventSymptoms: SyncMedicalEventSymptom[];
  media: SyncServerState['media'];
  instructionAcknowledgements: SyncInstructionAcknowledgement[];
}

export interface SyncRepository {
  getServerState(patientId: string): Promise<SyncServerState>;
  applyPatientChanges(patientId: string, changes: SyncChanges): Promise<void>;
}
