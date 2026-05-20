import { createHash } from 'node:crypto';

export class PhotoIntegrityError extends Error {
  readonly code = 'PHOTO_INTEGRITY_ERROR';

  constructor() {
    super('Photo checksum mismatch');
  }
}

export function computeChecksum(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function validateChecksum(buffer: Buffer, expected: string): void {
  const computed = computeChecksum(buffer);
  if (computed !== expected.toLowerCase()) {
    throw new PhotoIntegrityError();
  }
}
