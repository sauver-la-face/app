import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';

import type { PhotoStorage } from '../domain/photoStorage';

export class S3PhotoStorage implements PhotoStorage {
  constructor(
    private readonly s3Client: S3Client,
    private readonly bucket: string,
    private readonly publicBaseUrl: string,
  ) {}

  async upload(mediaId: string, eventId: string, buffer: Buffer): Promise<string> {
    const key = `${eventId}/${mediaId}.jpg`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: 'image/jpeg',
      }),
    );

    return `${this.publicBaseUrl}/${this.bucket}/${key}`;
  }
}
