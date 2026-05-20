import { describe, expect, mock, test } from 'bun:test';
import { Hono } from 'hono';
import { AlertUsecase } from '../src/features/alerts/application/alertUsecase';
import { InMemoryAlertRepository } from '../src/features/alerts/infrastructure/alertRepository';
import { createAlertRouter } from '../src/features/alerts/presentation/alertRouter';

const patientId = '11111111-1111-4111-8111-111111111111';
const now = new Date('2026-05-20T12:00:00.000Z');

describe('alerts.router', () => {
  test('retourne 200 et un etag pour GET /alerts', async () => {
    const app = createTestApp();

    const response = await app.request('/alerts');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toMatch(/^"[0-9a-f]{32}"$/);
    expect(body.alerts).toHaveLength(1);
  });

  test('retourne 304 quand le etag correspond', async () => {
    const app = createTestApp();
    const firstResponse = await app.request('/alerts');
    const etag = firstResponse.headers.get('etag');
    const secondResponse = await app.request('/alerts', {
      headers: etag ? { 'if-none-match': etag } : undefined,
    });

    expect(secondResponse.status).toBe(304);
  });
});

function createTestApp(): Hono {
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
  const app = new Hono();
  app.route('/', createAlertRouter(usecase));
  return app;
}
