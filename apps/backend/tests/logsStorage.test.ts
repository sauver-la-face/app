import { afterEach, describe, expect, mock, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import type { PutObjectCommand } from '@aws-sdk/client-s3';
import { S3LogsStorage } from '../src/shared/storage/logsStorage';

describe('logsStorage', () => {
  let temporaryDirectory: string | null = null;

  afterEach(() => {
    if (temporaryDirectory) {
      rmSync(temporaryDirectory, { force: true, recursive: true });
      temporaryDirectory = null;
    }
  });

  test('retourne null si le fichier local n existe pas', async () => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), 'audit-storage-'));
    const client = {
      send: mock(async () => undefined),
    };
    const storage = new S3LogsStorage({
      bucketName: 'logs-audit',
      localFilePath: join(temporaryDirectory, 'missing.log'),
      s3Client: client,
    });

    const result = await storage.exportAuditLog(new Date('2026-05-20T10:00:00.000Z'));

    expect(result).toBeNull();
    expect(client.send).toHaveBeenCalledTimes(0);
  });

  test('compresse puis upload le fichier local vers S3', async () => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), 'audit-storage-'));
    const localFilePath = join(temporaryDirectory, 'audit.log');
    writeFileSync(localFilePath, '{"message":"hello"}\n', 'utf8');

    const sentCommands: PutObjectCommand[] = [];
    const storage = new S3LogsStorage({
      bucketName: 'logs-audit',
      localFilePath,
      s3Client: {
        send: mock(async (command: PutObjectCommand) => {
          sentCommands.push(command);
        }),
      },
    });

    const result = await storage.exportAuditLog(new Date('2026-05-20T10:00:00.000Z'));

    expect(result).toEqual({
      bucketName: 'logs-audit',
      key: 'audit/2026/05/20/audit-2026-05-20.log.gz',
      sizeBytes: expect.any(Number),
    });
    expect(sentCommands).toHaveLength(1);
    expect(sentCommands[0]?.input.Bucket).toBe('logs-audit');
    expect(sentCommands[0]?.input.ContentEncoding).toBe('gzip');

    const body = sentCommands[0]?.input.Body;
    expect(body).toBeInstanceOf(Uint8Array);
    expect(gunzipSync(body as Uint8Array).toString('utf8')).toBe('{"message":"hello"}\n');
  });
});
