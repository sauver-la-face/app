import { beforeEach, describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { rateLimiter, rateLimitStores } from './rateLimiter';

describe('rateLimiter middleware', () => {
  let app: Hono;

  beforeEach(() => {
    rateLimitStores.clear();
    app = new Hono();
    app.post(
      '/test',
      rateLimiter({
        maxAttempts: 2,
        windowMs: 1000,
        blockDurationMs: 1000,
      }),
      (c) => {
        const fail = c.req.query('fail');
        if (fail) return c.json({ error: 'fail' }, 401);
        return c.json({ ok: true }, 200);
      },
    );
  });

  it('should allow requests below limit', async () => {
    const res = await app.request('/test', { method: 'POST' });
    expect(res.status).toBe(200);
  });

  it('should block requests after max failed attempts', async () => {
    // 1st fail
    await app.request('/test?fail=1', { method: 'POST' });
    // 2nd fail -> should trigger block
    const res2 = await app.request('/test?fail=1', { method: 'POST' });
    expect(res2.status).toBe(401);

    // 3rd attempt -> should be blocked by middleware
    const res3 = await app.request('/test', { method: 'POST' });
    expect(res3.status).toBe(429);
    const body = await res3.json();
    expect(body.error).toBe('TOO_MANY_ATTEMPTS');
  });

  it('should reset attempts on success', async () => {
    // 1st fail
    await app.request('/test?fail=1', { method: 'POST' });
    // success
    await app.request('/test', { method: 'POST' });
    // another fail -> should not block yet because reset
    await app.request('/test?fail=1', { method: 'POST' });
    const res = await app.request('/test', { method: 'POST' });
    expect(res.status).toBe(200);
  });
});
