import { describe, expect, mock, test } from 'bun:test';
import { AlertUsecase } from '../src/features/alerts/application/alertUsecase';
import { InMemoryAlertRepository } from '../src/features/alerts/infrastructure/alertRepository';

const patientId = '11111111-1111-4111-8111-111111111111';
const eventId = '22222222-2222-4222-8222-222222222222';
const now = new Date('2026-05-20T12:00:00.000Z');

describe('alerts.usecase', () => {
  test('retourne les alertes triees et un etag', async () => {
    const repository = new InMemoryAlertRepository({
      triggeredSymptomAlerts: [
        {
          patientId,
          firstName: 'Sok',
          lastName: 'Chan',
          medicalEventId: eventId,
          medicalEventCreatedAt: new Date('2026-05-20T09:00:00.000Z'),
          symptomCode: 'pain_severe',
          symptomLabelFr: 'Douleur severe',
        },
      ],
      syncOverdueCandidates: [
        {
          patientId: '33333333-3333-4333-8333-333333333333',
          firstName: 'Dara',
          lastName: 'Lim',
          lastSyncedAt: new Date('2026-05-10T12:00:00.000Z'),
        },
      ],
    });
    const logger = { info: mock(() => undefined) };
    const usecase = new AlertUsecase(repository, logger, () => now);

    const result = await usecase.listAlerts();

    expect(result.notModified).toBe(false);
    expect(result.etag).toMatch(/^"[0-9a-f]{32}"$/);
    expect(result.response.alerts).toHaveLength(2);
    expect(result.response.alerts[0]?.type).toBe('symptom_triggered');
    expect(result.response.alerts[1]?.type).toBe('sync_overdue');
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  test('retourne notModified quand le if-none-match correspond', async () => {
    const repository = new InMemoryAlertRepository({
      syncOverdueCandidates: [
        {
          patientId,
          firstName: 'Sok',
          lastName: 'Chan',
          lastSyncedAt: new Date('2026-05-10T12:00:00.000Z'),
        },
      ],
    });
    const usecase = new AlertUsecase(repository, { info: mock(() => undefined) }, () => now);

    const firstResult = await usecase.listAlerts();
    const secondResult = await usecase.listAlerts(firstResult.etag);

    expect(secondResult.notModified).toBe(true);
    expect(secondResult.etag).toBe(firstResult.etag);
  });
});
