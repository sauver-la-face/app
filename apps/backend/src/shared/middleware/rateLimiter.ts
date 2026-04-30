import type { Context, Next } from 'hono';
import { logger } from '../logger';

interface RateLimitInfo {
  attempts: number;
  blockedUntil: number | null;
}

export const rateLimitStores = new Map<string, RateLimitInfo>();

export const rateLimiter = (options: {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs: number;
}) => {
  return async (c: Context, next: Next) => {
    const ip = c.req.header('x-forwarded-for') || 'unknown';
    const now = Date.now();

    const info = rateLimitStores.get(ip) || { attempts: 0, blockedUntil: null };

    if (info.blockedUntil && now < info.blockedUntil) {
      logger.warn({ ip }, 'Rate limit blocked');
      return c.json({ error: 'TOO_MANY_ATTEMPTS', blockedUntil: info.blockedUntil }, 429);
    }

    if (info.blockedUntil && now >= info.blockedUntil) {
      info.attempts = 0;
      info.blockedUntil = null;
    }

    await next();

    // After request: if it was a failure, increment attempts
    // Note: This logic assumes the middleware is called on endpoints that can fail.
    // For specific failure detection, we might need to check response status.
    if (c.res.status === 401) {
      info.attempts += 1;
      if (info.attempts >= options.maxAttempts) {
        info.blockedUntil = now + options.blockDurationMs;
        logger.warn({ ip, blockedUntil: info.blockedUntil }, 'Rate limit triggered');
      }
      rateLimitStores.set(ip, info);
    } else if (c.res.status === 200 || c.res.status === 201) {
      // Reset on success
      info.attempts = 0;
      info.blockedUntil = null;
      rateLimitStores.set(ip, info);
    }
  };
};
