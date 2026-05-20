import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { syncRequestSchema, syncResponseSchema } from '@sauver-la-face/shared';
import { syncVersionErrorSchema, validationErrorSchema } from '../../../shared/openapi';
import type { SyncUsecase } from '../application/syncUsecase';
import { SyncVersionError } from '../domain/syncDomain';

const syncRoute = createRoute({
  method: 'post',
  path: '/sync',
  request: {
    body: {
      content: {
        'application/json': {
          schema: syncRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: syncResponseSchema,
        },
      },
      description: 'Synchronisation reussie',
    },
    400: {
      content: {
        'application/json': {
          schema: validationErrorSchema,
        },
      },
      description: 'Erreur de validation',
    },
    409: {
      content: {
        'application/json': {
          schema: syncVersionErrorSchema,
        },
      },
      description: 'Version de schema incompatible',
    },
  },
  tags: ['Sync'],
});

export function createSyncRouter(syncUsecase: SyncUsecase): OpenAPIHono {
  const router = new OpenAPIHono();

  router.openapi(syncRoute, async (context) => {
    const body = await context.req.json().catch(() => undefined);
    const parsedBody = syncRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return context.json(
        {
          code: 'VALIDATION_ERROR' as const,
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
            code: error.code as 'APP_UPDATE_REQUIRED',
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
