import {
  medicalEvent,
  medicalEventSymptom,
  medicalProcedure,
  patient,
  symptom,
} from '@infrastructure/schema';
import type { DbClient } from '@shared/db';
import { eq, lte } from 'drizzle-orm';
import type {
  AlertRepository,
  SyncOverdueAlertSource,
  TriggeredSymptomAlertSource,
} from '../domain/alertRepository';
import { syncOverdueThresholdDays } from '../domain/alertsDomain';

interface InMemorySeed {
  triggeredSymptomAlerts?: TriggeredSymptomAlertSource[];
  syncOverdueCandidates?: SyncOverdueAlertSource[];
}

export class InMemoryAlertRepository implements AlertRepository {
  constructor(private readonly seed: InMemorySeed = {}) {}

  async listTriggeredSymptomAlerts(): Promise<TriggeredSymptomAlertSource[]> {
    return (this.seed.triggeredSymptomAlerts ?? []).map((record) => ({ ...record }));
  }

  async listSyncOverdueCandidates(): Promise<SyncOverdueAlertSource[]> {
    return (this.seed.syncOverdueCandidates ?? []).map((record) => ({ ...record }));
  }
}

export class PgAlertRepository implements AlertRepository {
  constructor(private readonly db: DbClient) {}

  async listTriggeredSymptomAlerts(): Promise<TriggeredSymptomAlertSource[]> {
    return this.db
      .select({
        patientId: patient.uuid_patient,
        firstName: patient.first_name,
        lastName: patient.last_name,
        medicalEventId: medicalEvent.uuid_event,
        medicalEventCreatedAt: medicalEvent.created_at,
        symptomCode: symptom.code,
        symptomLabelFr: symptom.label_fr,
      })
      .from(medicalEventSymptom)
      .innerJoin(symptom, eq(medicalEventSymptom.uuid_symptom, symptom.uuid_symptom))
      .innerJoin(medicalEvent, eq(medicalEventSymptom.uuid_event, medicalEvent.uuid_event))
      .innerJoin(
        medicalProcedure,
        eq(medicalEvent.uuid_medical_procedure, medicalProcedure.uuid_medical_procedure),
      )
      .innerJoin(patient, eq(medicalProcedure.uuid_patient, patient.uuid_patient))
      .where(eq(symptom.triggers_alert, true));
  }

  async listSyncOverdueCandidates(): Promise<SyncOverdueAlertSource[]> {
    const thresholdDate = new Date(Date.now() - syncOverdueThresholdDays * 24 * 60 * 60 * 1000);

    return this.db
      .select({
        patientId: patient.uuid_patient,
        firstName: patient.first_name,
        lastName: patient.last_name,
        lastSyncedAt: patient.last_synced_at,
      })
      .from(patient)
      .where(lte(patient.last_synced_at, thresholdDate));
  }
}
