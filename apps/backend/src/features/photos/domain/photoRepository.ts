import type { Photo } from './photo';

export interface PhotoRepository {
  save(photo: Photo): Promise<void>;
}
