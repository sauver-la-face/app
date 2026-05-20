import { describe, expect, mock, test } from 'bun:test';
import { runAuditExportCron } from '../src/shared/jobs/audit.export.cron';

describe('audit.export.cron', () => {
  test('log en info quand un export est effectue', async () => {
    const exportAuditLog = mock(async () => ({
      bucketName: 'logs-audit',
      key: 'audit/2026/05/20/audit-2026-05-20.log.gz',
      sizeBytes: 128,
    }));
    const logger = {
      error: mock(() => undefined),
      info: mock(() => undefined),
      warn: mock(() => undefined),
    };

    await runAuditExportCron(
      { exportAuditLog },
      logger,
      () => new Date('2026-05-20T10:00:00.000Z'),
    );

    expect(exportAuditLog).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        bucketName: 'logs-audit',
        key: 'audit/2026/05/20/audit-2026-05-20.log.gz',
        sizeBytes: 128,
      }),
      'Audit log exported',
    );
  });

  test('log en warn quand aucun fichier n est exportable', async () => {
    const logger = {
      error: mock(() => undefined),
      info: mock(() => undefined),
      warn: mock(() => undefined),
    };

    await runAuditExportCron(
      { exportAuditLog: mock(async () => null) },
      logger,
      () => new Date('2026-05-20T10:00:00.000Z'),
    );

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: '2026-05-20T10:00:00.000Z',
      }),
      'No audit log file available for export',
    );
  });
});
