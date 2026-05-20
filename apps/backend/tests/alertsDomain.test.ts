import { describe, expect, test } from 'bun:test';
import type { Alert } from '@sauver-la-face/shared';
import {
  buildSyncOverdueAlerts,
  buildTriggeredSymptomAlerts,
  createAlertsEtag,
  matchesEtag,
  sortAlerts,
} from '../src/features/alerts/domain/alerts.domain';

const patientId = '11111111-1111-4111-8111-111111111111';
const eventId = '22222222-2222-4222-8222-222222222222';
const now = new Date('2026-05-20T12:00:00.000Z');

describe('alerts.domain', () => {
  test('cree une alerte critique pour chaque symptome declencheur', () => {
    const alerts = buildTriggeredSymptomAlerts([
      {
        patientId,
        firstName: 'Sok',
        lastName: 'Chan',
        medicalEventId: eventId,
        medicalEventCreatedAt: new Date('2026-05-19T10:00:00.000Z'),
        symptomCode: 'bleeding',
        symptomLabelFr: 'Saignement',
      },
    ]);

    expect(alerts).toEqual([
      {
        patientId,
        patientDisplayName: 'Sok Chan',
        type: 'symptom_triggered',
        severity: 'critical',
        message: 'Symptome declencheur detecte : Saignement',
        occurredAt: '2026-05-19T10:00:00.000Z',
        medicalEventId: eventId,
        symptomCode: 'bleeding',
        symptomLabelFr: 'Saignement',
        lastSyncedAt: null,
      },
    ]);
  });

  test('cree une alerte warning quand un patient n a pas synchronise depuis 7 jours', () => {
    const alerts = buildSyncOverdueAlerts(
      [
        {
          patientId,
          firstName: null,
          lastName: null,
          lastSyncedAt: new Date('2026-05-13T12:00:00.000Z'),
        },
        {
          patientId: '33333333-3333-4333-8333-333333333333',
          firstName: 'Dara',
          lastName: 'Lim',
          lastSyncedAt: new Date('2026-05-19T12:00:00.000Z'),
        },
      ],
      now,
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      patientId,
      patientDisplayName: 'Patient 11111111',
      type: 'sync_overdue',
      severity: 'warning',
      message: 'Aucune synchronisation depuis 7 jours',
      lastSyncedAt: '2026-05-13T12:00:00.000Z',
    });
  });

  test('genere un etag stable et detecte le not modified', () => {
    const alerts = sortAlerts([
      createAlert('2026-05-18T10:00:00.000Z', 'sync_overdue'),
      createAlert('2026-05-19T10:00:00.000Z', 'symptom_triggered'),
    ]);

    const etag = createAlertsEtag(alerts);

    expect(matchesEtag(etag, etag)).toBe(true);
    expect(matchesEtag(`W/${etag}`, etag)).toBe(true);
    expect(matchesEtag('"other"', etag)).toBe(false);
  });
});

function createAlert(occurredAt: string, type: Alert['type']): Alert {
  return {
    patientId,
    patientDisplayName: 'Sok Chan',
    type,
    severity: type === 'symptom_triggered' ? 'critical' : 'warning',
    message: 'message',
    occurredAt,
    medicalEventId: type === 'symptom_triggered' ? eventId : null,
    symptomCode: type === 'symptom_triggered' ? 'pain' : null,
    symptomLabelFr: type === 'symptom_triggered' ? 'Douleur' : null,
    lastSyncedAt: type === 'sync_overdue' ? occurredAt : null,
  };
}
