import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { requirePhysicianAuth } from '@shared/middleware/physicianAuthMiddleware';
import type { MiddlewareHandler } from 'hono';
import { Hono } from 'hono';
import { z } from 'zod';

import type { SessionVariables } from '../../auth/presentation/authRouter';
import { PhotoIntegrityError, type PhotosUsecase } from '../application/photosUsecase';
import type { PhotoRepository } from '../domain/photoRepository';

const uploadQuerySchema = z.object({
  checksum: z.string().regex(/^[a-f0-9]{64}$/i, 'CHECKSUM_INVALID'),
  eventId: z.string().uuid('EVENT_ID_INVALID'),
  takenAt: z.string().datetime('TAKEN_AT_INVALID'),
});

export function createPhotosRouter(
  photosUsecase: PhotosUsecase,
  photoRepository: PhotoRepository,
  s3Client: S3Client,
  bucket: string,
  authMiddleware: MiddlewareHandler<{ Variables: SessionVariables }> = requirePhysicianAuth,
): Hono<{ Variables: SessionVariables }> {
  const router = new Hono<{ Variables: SessionVariables }>();

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

  // SEC-01/A01 : consultation d'une photo reservee aux medecins authentifies
  // (equipe partagee - pas de controle d'appartenance par patient).
  router.get('/photos/:mediaId', authMiddleware, async (context) => {
    const { mediaId } = context.req.param();

    const record = await photoRepository.findMediaById(mediaId);
    if (!record) {
      return context.json({ code: 'NOT_FOUND' }, 404);
    }

    // Extrait la clé S3 depuis l'URL stockée : "{baseUrl}/{bucket}/{key}" → "{key}"
    const separator = `/${bucket}/`;
    const parts = record.fileUrl.split(separator);
    const key = parts.length >= 2 ? parts.slice(1).join(separator) : record.fileUrl;

    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const s3Response = await s3Client.send(command);

    if (!s3Response.Body) {
      return context.json({ code: 'NOT_FOUND' }, 404);
    }

    const buffer = Buffer.from(await s3Response.Body.transformToByteArray());

    return new Response(buffer, {
      headers: {
        'Content-Type': s3Response.ContentType ?? 'image/jpeg',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  });

  return router;
}
