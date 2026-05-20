import { syncRequestSchema } from '@sauver-la-face/shared';
import { Hono } from 'hono';

import type { SyncUsecase } from '../application/syncUsecase';
import { SyncVersionError } from '../domain/sync.domain';

export function createSyncRouter(syncUsecase: SyncUsecase): Hono {
  const router = new Hono();

  router.post('/sync', async (context) => {
    const body = await context.req.json().catch(() => undefined);
    const parsedBody = syncRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return context.json(
        {
          code: 'VALIDATION_ERROR',
          details: parsedBody.error.flatten(),
        },
        400,
      );
    }

    try {
      const response = await syncUsecase.sync(parsedBody.data);
      return context.json(response, 200);
    } catch (error) {
      if (error instanceof SyncVersionError) {
        return context.json(
          {
            code: error.code,
            message: error.message,
            serverSchemaVersion: error.serverSchemaVersion,
          },
          409,
        );
      }

      throw error;
    }
  });

  return router;
}
