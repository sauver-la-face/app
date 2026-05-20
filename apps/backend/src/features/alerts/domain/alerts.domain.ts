import type { Alert } from '@sauver-la-face/shared';
import { createHash } from 'node:crypto';
import type {
  SyncOverdueAlertSource,
  TriggeredSymptomAlertSource,
} from './alertRepository';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
export const syncOverdueThresholdDays = 7;

export function buildTriggeredSymptomAlerts(
  sources: TriggeredSymptomAlertSource[],
): Alert[] {
  return sources.map((source) => ({
    patientId: source.patientId,
    patientDisplayName: buildPatientDisplayName(source.firstName, source.lastName, source.patientId),
    type: 'symptom_triggered',
    severity: 'critical',
    message: `Symptome declencheur detecte : ${source.symptomLabelFr}`,
    occurredAt: source.medicalEventCreatedAt.toISOString(),
    medicalEventId: source.medicalEventId,
    symptomCode: source.symptomCode,
    symptomLabelFr: source.symptomLabelFr,
    lastSyncedAt: null,
  }));
}

export function buildSyncOverdueAlerts(
  sources: SyncOverdueAlertSource[],
  now: Date,
  thresholdDays = syncOverdueThresholdDays,
): Alert[] {
  const thresholdTime = now.getTime() - thresholdDays * DAY_IN_MS;

  return sources
    .filter((source) => source.lastSyncedAt !== null)
    .filter((source) => {
      if (source.lastSyncedAt === null) {
        return false;
      }

      return source.lastSyncedAt.getTime() <= thresholdTime;
    })
    .map((source) => ({
      patientId: source.patientId,
      patientDisplayName: buildPatientDisplayName(
        source.firstName,
        source.lastName,
        source.patientId,
      ),
      type: 'sync_overdue',
      severity: 'warning',
      message: `Aucune synchronisation depuis ${thresholdDays} jours`,
      occurredAt: source.lastSyncedAt!.toISOString(),
      medicalEventId: null,
      symptomCode: null,
      symptomLabelFr: null,
      lastSyncedAt: source.lastSyncedAt!.toISOString(),
    }));
}

export function sortAlerts(alerts: Alert[]): Alert[] {
  return [...alerts].sort((left, right) => {
    const occurredAtDiff = Date.parse(right.occurredAt) - Date.parse(left.occurredAt);

    if (occurredAtDiff !== 0) {
      return occurredAtDiff;
    }

    return `${left.patientId}:${left.type}`.localeCompare(`${right.patientId}:${right.type}`);
  });
}

export function createAlertsEtag(alerts: Alert[]): string {
  const normalizedAlerts = sortAlerts(alerts);
  const hash = createHash('md5').update(JSON.stringify(normalizedAlerts)).digest('hex');
  return `"${hash}"`;
}

export function matchesEtag(candidate: string | null | undefined, etag: string): boolean {
  if (!candidate) {
    return false;
  }

  return candidate
    .split(',')
    .map((value) => value.trim())
    .some((value) => stripWeakEtagPrefix(value) === stripWeakEtagPrefix(etag));
}

function stripWeakEtagPrefix(value: string): string {
  return value.startsWith('W/') ? value.slice(2) : value;
}

function buildPatientDisplayName(
  firstName: string | null,
  lastName: string | null,
  patientId: string,
): string {
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  return fullName || `Patient ${patientId.slice(0, 8)}`;
}
