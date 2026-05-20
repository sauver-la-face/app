import type { Context, MiddlewareHandler } from 'hono';
import { logger } from '../logger';

interface AuditLogger {
  error(payload: Record<string, unknown>, message: string): void;
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
}

export function createAuditMiddleware(
  auditLogger: AuditLogger = logger,
  nowFactory: () => Date = () => new Date(),
): MiddlewareHandler {
  return async (context, next) => {
    const startedAt = nowFactory();

    try {
      await next();
      logAuditEntry(auditLogger, context, startedAt, nowFactory(), context.res.status);
    } catch (error) {
      logAuditEntry(auditLogger, context, startedAt, nowFactory(), 500);
      throw error;
    }
  };
}

function logAuditEntry(
  auditLogger: AuditLogger,
  context: Context,
  startedAt: Date,
  completedAt: Date,
  status: number,
): void {
  const payload = {
    timestamp: startedAt.toISOString(),
    method: context.req.method,
    route: context.req.path,
    userId: resolveUserId(context),
    ip: resolveClientIp(context),
    userAgent: context.req.header('user-agent') ?? null,
    status,
    durationMs: completedAt.getTime() - startedAt.getTime(),
  };

  if (status >= 500) {
    auditLogger.error(payload, 'Audit HTTP request');
    return;
  }

  if (status === 401 || status === 403 || status === 429) {
    auditLogger.warn(payload, 'Audit HTTP request');
    return;
  }

  auditLogger.info(payload, 'Audit HTTP request');
}

function resolveClientIp(context: Context): string {
  return (
    context.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    context.req.header('x-real-ip') ??
    'unknown'
  );
}

function resolveUserId(context: Context): string | null {
  const candidate = context.var as Record<string, unknown>;
  const user = candidate.user;

  if (typeof user !== 'object' || user === null || !('id' in user)) {
    return null;
  }

  const userId = (user as { id?: unknown }).id;
  return typeof userId === 'string' ? userId : null;
}
