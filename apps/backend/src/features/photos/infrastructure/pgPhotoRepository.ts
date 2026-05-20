import type { DbClient } from '@shared/db';

import { media } from '../../../infrastructure/schema';
import type { Photo } from '../domain/photo';
import type { PhotoRepository } from '../domain/photoRepository';

export class PgPhotoRepository implements PhotoRepository {
  constructor(private readonly db: DbClient) {}

  async save(photo: Photo): Promise<void> {
    await this.db.insert(media).values({
      uuid_media: photo.mediaId,
      uuid_event: photo.eventId,
      file_url: photo.fileUrl,
      file_type: photo.fileType,
      taken_at: photo.takenAt,
      description: null,
    });
  }
}
