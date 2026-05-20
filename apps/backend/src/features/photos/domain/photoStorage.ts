export interface PhotoStorage {
  upload(mediaId: string, eventId: string, buffer: Buffer): Promise<string>;
}
