export interface TriggeredSymptomAlertSource {
  patientId: string;
  firstName: string | null;
  lastName: string | null;
  medicalEventId: string;
  medicalEventCreatedAt: Date;
  symptomCode: string;
  symptomLabelFr: string;
}

export interface SyncOverdueAlertSource {
  patientId: string;
  firstName: string | null;
  lastName: string | null;
  lastSyncedAt: Date | null;
}

export interface AlertRepository {
  listTriggeredSymptomAlerts(): Promise<TriggeredSymptomAlertSource[]>;
  listSyncOverdueCandidates(): Promise<SyncOverdueAlertSource[]>;
}
