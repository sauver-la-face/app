export class Photo {
  private constructor(
    readonly mediaId: string,
    readonly eventId: string,
    readonly fileUrl: string,
    readonly fileType: string,
    readonly takenAt: Date,
  ) {}

  static create(params: {
    mediaId: string;
    eventId: string;
    fileUrl: string;
    fileType: string;
    takenAt: Date;
  }): Photo {
    return new Photo(
      params.mediaId,
      params.eventId,
      params.fileUrl,
      params.fileType,
      params.takenAt,
    );
  }
}
