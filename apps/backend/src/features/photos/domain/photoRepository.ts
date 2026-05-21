import type { Photo } from './photo';

export interface PhotoRepository {
  save(photo: Photo): Promise<void>;
  findMediaById(mediaId: string): Promise<{ fileUrl: string } | null>;
}
