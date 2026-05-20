import { existsSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { auditLogFilePath } from '../logger';

interface S3CompatibleClient {
  send(command: PutObjectCommand): Promise<unknown>;
}

interface S3LogsStorageConfig {
  bucketName: string;
  localFilePath?: string;
  s3Client: S3CompatibleClient;
}

export interface AuditLogExportResult {
  bucketName: string;
  key: string;
  sizeBytes: number;
}

export class S3LogsStorage {
  private readonly bucketName: string;
  private readonly localFilePath: string;
  private readonly s3Client: S3CompatibleClient;

  constructor(config: S3LogsStorageConfig) {
    this.bucketName = config.bucketName;
    this.localFilePath = config.localFilePath ?? auditLogFilePath;
    this.s3Client = config.s3Client;
  }

  async exportAuditLog(referenceDate: Date): Promise<AuditLogExportResult | null> {
    if (!existsSync(this.localFilePath)) {
      return null;
    }

    const fileContents = readFileSync(this.localFilePath);

    if (fileContents.byteLength === 0) {
      return null;
    }

    const body = gzipSync(fileContents);
    const key = buildAuditLogObjectKey(referenceDate);

    await this.s3Client.send(
      new PutObjectCommand({
        Body: body,
        Bucket: this.bucketName,
        ContentEncoding: 'gzip',
        ContentType: 'application/x-ndjson',
        Key: key,
      }),
    );

    return {
      bucketName: this.bucketName,
      key,
      sizeBytes: body.byteLength,
    };
  }
}

export function createS3LogsStorageFromEnv(): S3LogsStorage | null {
  const bucketName = process.env.S3_BUCKET_LOGS;
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;

  if (!bucketName || !endpoint || !accessKeyId || !secretAccessKey) {
    return null;
  }

  const useSsl = process.env.S3_USE_SSL === 'true';
  const port = process.env.S3_PORT ? Number(process.env.S3_PORT) : useSsl ? 443 : 9000;
  const protocol = useSsl ? 'https' : 'http';
  const s3Client = new S3Client({
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    endpoint: `${protocol}://${endpoint}:${port}`,
    forcePathStyle: true,
    region: 'eu-west-1',
  });

  return new S3LogsStorage({
    bucketName,
    s3Client,
  });
}

function buildAuditLogObjectKey(referenceDate: Date): string {
  const year = referenceDate.getUTCFullYear().toString();
  const month = `${referenceDate.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${referenceDate.getUTCDate()}`.padStart(2, '0');

  return `audit/${year}/${month}/${day}/audit-${year}-${month}-${day}.log.gz`;
}
