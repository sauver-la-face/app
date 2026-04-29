import { createDb } from '@shared/db';
import { logger } from '@shared/logger';
import { Hono } from 'hono';

import { SyncUsecase } from './features/sync/application/syncUsecase';
import {
  InMemorySyncRepository,
  PgSyncRepository,
} from './features/sync/infrastructure/syncRepository';
import { createSyncRouter } from './features/sync/presentation/syncRouter';

export function createApp(): Hono {
  const app = new Hono();
  const syncRepository = process.env.DATABASE_URL
    ? new PgSyncRepository(createDb(process.env.DATABASE_URL))
    : new InMemorySyncRepository();
  const syncUsecase = new SyncUsecase(syncRepository, logger, 1);

  if (!process.env.DATABASE_URL) {
    logger.warn(
      {
        feature: 'sync',
      },
      'DATABASE_URL is not set, falling back to in-memory sync repository',
    );
  }

  app.route('/', createSyncRouter(syncUsecase));

  app.onError((error, context) => {
    logger.error({ error }, 'Unhandled backend error');
    return context.json({ code: 'INTERNAL_SERVER_ERROR' }, 500);
  });

  return app;
}

const app = createApp();

export default {
  port: Number(process.env.PORT ?? 3001),
  fetch: app.fetch,
};
