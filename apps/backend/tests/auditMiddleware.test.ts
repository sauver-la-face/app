import { afterEach, describe, expect, mock, test } from 'bun:test';
import { Hono } from 'hono';
import { createAuditMiddleware } from '../src/shared/middleware/audit.middleware';

afterEach(() => {
  delete process.env.NODE_ENV;
});

describe('audit.middleware', () => {
  test('log une requete reussie avec les metadonnees attendues', async () => {
    const logger = createLoggerMock();
    const app = new Hono();
    app.use('*', createAuditMiddleware(logger, createDateFactory('2026-05-20T10:00:00.000Z', 35)));
    app.get('/patients', (context) => context.json({ ok: true }, 200));

    const response = await app.request('/patients', {
      headers: {
        'user-agent': 'bun-test',
        'x-forwarded-for': '203.0.113.10',
      },
    });

    expect(response.status).toBe(200);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        durationMs: 35,
        ip: '203.0.113.10',
        method: 'GET',
        route: '/patients',
        status: 200,
        timestamp: '2026-05-20T10:00:00.000Z',
        userAgent: 'bun-test',
        userId: null,
      }),
      'Audit HTTP request',
    );
  });

  test('log en warn une reponse 401', async () => {
    const logger = createLoggerMock();
    const app = new Hono();
    app.use('*', createAuditMiddleware(logger, createDateFactory('2026-05-20T10:00:00.000Z', 12)));
    app.get('/api/auth/sign-in/email', (context) => context.json({ error: 'UNAUTHORIZED' }, 401));

    const response = await app.request('/api/auth/sign-in/email', {
      headers: {
        'x-real-ip': '198.51.100.5',
      },
    });

    expect(response.status).toBe(401);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        ip: '198.51.100.5',
        status: 401,
      }),
      'Audit HTTP request',
    );
  });

  test('log en error une erreur serveur', async () => {
    const logger = createLoggerMock();
    const app = new Hono();
    app.use('*', createAuditMiddleware(logger, createDateFactory('2026-05-20T10:00:00.000Z', 8)));
    app.get('/crash', () => {
      throw new Error('boom');
    });
    app.onError((error, context) => context.json({ error: error.message }, 500));

    const response = await app.request('/crash');

    expect(response.status).toBe(500);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        durationMs: 8,
        status: 500,
      }),
      'Audit HTTP request',
    );
  });
});

function createLoggerMock() {
  return {
    error: mock(() => undefined),
    info: mock(() => undefined),
    warn: mock(() => undefined),
  };
}

function createDateFactory(startIso: string, durationMs: number): () => Date {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + durationMs);
  const values = [start, end];

  return () => values.shift() ?? end;
}
