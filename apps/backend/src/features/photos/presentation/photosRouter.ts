import { Hono } from 'hono';
import { z } from 'zod';

import { PhotoIntegrityError, type PhotosUsecase } from '../application/photosUsecase';

const uploadQuerySchema = z.object({
  checksum: z.string().regex(/^[a-f0-9]{64}$/i, 'CHECKSUM_INVALID'),
  eventId: z.string().uuid('EVENT_ID_INVALID'),
  takenAt: z.string().datetime('TAKEN_AT_INVALID'),
});

export function createPhotosRouter(photosUsecase: PhotosUsecase): Hono {
  const router = new Hono();

  router.post('/photos', async (context) => {
    let formData: FormData;

    try {
      formData = await context.req.formData();
    } catch {
      return context.json({ code: 'VALIDATION_ERROR', message: 'Invalid multipart body' }, 400);
    }

    const file = formData.get('file');
    const parsed = uploadQuerySchema.safeParse({
      checksum: formData.get('checksum'),
      eventId: formData.get('eventId'),
      takenAt: formData.get('takenAt'),
    });

    if (!parsed.success) {
      return context.json({ code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, 400);
    }

    if (!(file instanceof File) || file.size === 0) {
      return context.json({ code: 'VALIDATION_ERROR', message: 'Missing or empty file' }, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    try {
      const result = await photosUsecase.uploadPhoto({
        eventId: parsed.data.eventId,
        takenAt: new Date(parsed.data.takenAt),
        checksum: parsed.data.checksum,
        buffer,
      });

      return context.json(result, 201);
    } catch (error) {
      if (error instanceof PhotoIntegrityError) {
        return context.json({ code: error.code }, 422);
      }

      throw error;
    }
  });

  return router;
}
