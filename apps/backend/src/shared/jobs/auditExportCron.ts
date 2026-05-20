import { logger } from '../logger';
import type { AuditLogExportResult, S3LogsStorage } from '../storage/logsStorage';

interface CronLogger {
  error(payload: Record<string, unknown>, message: string): void;
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
}

export async function runAuditExportCron(
  logsStorage: Pick<S3LogsStorage, 'exportAuditLog'>,
  cronLogger: CronLogger = logger,
  nowFactory: () => Date = () => new Date(),
): Promise<AuditLogExportResult | null> {
  const now = nowFactory();

  try {
    const result = await logsStorage.exportAuditLog(now);

    if (!result) {
      cronLogger.warn(
        {
          timestamp: now.toISOString(),
        },
        'No audit log file available for export',
      );
      return null;
    }

    cronLogger.info(
      {
        ...result,
        timestamp: now.toISOString(),
      },
      'Audit log exported',
    );

    return result;
  } catch (error) {
    cronLogger.error(
      {
        error,
        timestamp: now.toISOString(),
      },
      'Audit log export failed',
    );
    throw error;
  }
}

export function startAuditExportScheduler(
  logsStorage: Pick<S3LogsStorage, 'exportAuditLog'>,
  cronLogger: CronLogger = logger,
  nowFactory: () => Date = () => new Date(),
  intervalMs = 24 * 60 * 60 * 1000,
): Timer {
  const timer = setInterval(() => {
    void runAuditExportCron(logsStorage, cronLogger, nowFactory);
  }, intervalMs);

  timer.unref?.();
  return timer;
}
