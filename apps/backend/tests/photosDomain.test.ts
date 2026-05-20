import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';

import { ChecksumSHA256 } from '@sauver-la-face/shared';
import {
  computeChecksum,
  PhotoIntegrityError,
  validateChecksum,
} from '../src/features/photos/domain/photosDomain';

const knownBuffer = Buffer.from('hello world');
const knownChecksum = createHash('sha256').update(knownBuffer).digest('hex');

describe('ChecksumSHA256', () => {
  test('accepte un hash hex valide de 64 caracteres', () => {
    const checksum = ChecksumSHA256.create(knownChecksum);
    expect(checksum.value).toBe(knownChecksum.toLowerCase());
  });

  test('normalise en minuscules', () => {
    const checksum = ChecksumSHA256.create(knownChecksum.toUpperCase());
    expect(checksum.value).toBe(knownChecksum.toLowerCase());
  });

  test('rejette un hash trop court', () => {
    expect(() => ChecksumSHA256.create('abc123')).toThrow('CHECKSUM_INVALID');
  });

  test('rejette un hash avec des caracteres non hex', () => {
    expect(() => ChecksumSHA256.create('z'.repeat(64))).toThrow('CHECKSUM_INVALID');
  });
});

describe('photosDomain', () => {
  test('computeChecksum produit un resultat deterministe', () => {
    const result = computeChecksum(knownBuffer);
    expect(result).toBe(knownChecksum);
    expect(computeChecksum(knownBuffer)).toBe(result);
  });

  test('validateChecksum passe si le checksum correspond', () => {
    expect(() => validateChecksum(knownBuffer, knownChecksum)).not.toThrow();
  });

  test('validateChecksum accepte le checksum en majuscules', () => {
    expect(() => validateChecksum(knownBuffer, knownChecksum.toUpperCase())).not.toThrow();
  });

  test('validateChecksum rejette un checksum incorrect avec PHOTO_INTEGRITY_ERROR', () => {
    expect(() => validateChecksum(knownBuffer, 'a'.repeat(64))).toThrow(PhotoIntegrityError);
  });

  test('PhotoIntegrityError a le bon code', () => {
    try {
      validateChecksum(knownBuffer, 'a'.repeat(64));
    } catch (error) {
      expect(error).toBeInstanceOf(PhotoIntegrityError);
      expect((error as PhotoIntegrityError).code).toBe('PHOTO_INTEGRITY_ERROR');
    }
  });
});
