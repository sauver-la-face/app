import { randomUUID } from 'node:crypto';

import { Photo } from '../domain/photo';
import type { PhotoRepository } from '../domain/photoRepository';
import type { PhotoStorage } from '../domain/photoStorage';
import { validateChecksum } from '../domain/photosDomain';

export { PhotoIntegrityError } from '../domain/photosDomain';

interface UploadPhotoCommand {
  eventId: string;
  takenAt: Date;
  checksum: string;
  buffer: Buffer;
}

interface UploadPhotoResult {
  mediaId: string;
  fileUrl: string;
}

export class PhotosUsecase {
  constructor(
    private readonly photoStorage: PhotoStorage,
    private readonly photoRepository: PhotoRepository,
    private readonly idGenerator: () => string = randomUUID,
  ) {}

  async uploadPhoto(command: UploadPhotoCommand): Promise<UploadPhotoResult> {
    validateChecksum(command.buffer, command.checksum);

    const mediaId = this.idGenerator();
    const fileUrl = await this.photoStorage.upload(mediaId, command.eventId, command.buffer);

    const photo = Photo.create({
      mediaId,
      eventId: command.eventId,
      fileUrl,
      fileType: 'image/jpeg',
      takenAt: command.takenAt,
    });

    await this.photoRepository.save(photo);

    return { mediaId, fileUrl };
  }
}
