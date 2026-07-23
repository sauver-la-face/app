import type { Photo } from './photo';

export interface PhotoRepository {
  save(photo: Photo): Promise<void>;
  findMediaById(mediaId: string): Promise<{ fileUrl: string } | null>;
  // SEC-02/A01 : resout le patient proprietaire d'un medical_event, pour
  // verifier que le patient authentifie uploade bien sur son propre dossier.
  findEventOwnerPatientId(eventId: string): Promise<string | null>;
}
