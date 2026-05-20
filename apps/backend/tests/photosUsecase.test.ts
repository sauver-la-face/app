import { describe, expect, mock, test } from 'bun:test';
import { createHash } from 'node:crypto';

import { PhotosUsecase } from '../src/features/photos/application/photosUsecase';
import type { PhotoRepository } from '../src/features/photos/domain/photoRepository';
import type { PhotoStorage } from '../src/features/photos/domain/photoStorage';
import { PhotoIntegrityError } from '../src/features/photos/domain/photosDomain';

const eventId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const mediaId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const fakeUrl = `http://localhost:9000/photos/${eventId}/${mediaId}.jpg`;
const buffer = Buffer.from('fake-jpeg-bytes');
const validChecksum = createHash('sha256').update(buffer).digest('hex');
const takenAt = new Date('2026-05-20T10:00:00.000Z');

function makeStorage(url = fakeUrl): PhotoStorage & { uploadCalls: number } {
  let uploadCalls = 0;
  return {
    get uploadCalls() {
      return uploadCalls;
    },
    upload: mock(async () => {
      uploadCalls++;
      return url;
    }),
  };
}

function makeRepository(): PhotoRepository & { saveCalls: number } {
  let saveCalls = 0;
  return {
    get saveCalls() {
      return saveCalls;
    },
    save: mock(async () => {
      saveCalls++;
    }),
  };
}

describe('photos.usecase', () => {
  test('upload nominal : valide checksum, stocke dans S3 et persiste en base', async () => {
    const storage = makeStorage();
    const repository = makeRepository();
    const usecase = new PhotosUsecase(storage, repository, () => mediaId);

    const result = await usecase.uploadPhoto({ eventId, takenAt, checksum: validChecksum, buffer });

    expect(result.mediaId).toBe(mediaId);
    expect(result.fileUrl).toBe(fakeUrl);
    expect(storage.upload).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  test('checksum mismatch : leve PhotoIntegrityError sans appeler S3 ni la BDD', async () => {
    const storage = makeStorage();
    const repository = makeRepository();
    const usecase = new PhotosUsecase(storage, repository, () => mediaId);

    await expect(
      usecase.uploadPhoto({ eventId, takenAt, checksum: 'a'.repeat(64), buffer }),
    ).rejects.toBeInstanceOf(PhotoIntegrityError);

    expect(storage.upload).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  test('erreur S3 : propagee sans persister en base', async () => {
    const storage: PhotoStorage = {
      upload: mock(async () => {
        throw new Error('S3_UNAVAILABLE');
      }),
    };
    const repository = makeRepository();
    const usecase = new PhotosUsecase(storage, repository, () => mediaId);

    await expect(
      usecase.uploadPhoto({ eventId, takenAt, checksum: validChecksum, buffer }),
    ).rejects.toThrow('S3_UNAVAILABLE');

    expect(repository.save).not.toHaveBeenCalled();
  });
});
