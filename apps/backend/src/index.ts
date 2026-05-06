import { createDb } from '@shared/db';
import { logger } from '@shared/logger';
import { Hono } from 'hono';

import { PatientUsecase } from './features/patients/application/patientUsecase';
import {
  InMemoryPatientsRepository,
  PgPatientsRepository,
} from './features/patients/infrastructure/patientRepository';
import { createPatientRouter } from './features/patients/presentation/patientRouter';
import { SyncUsecase } from './features/sync/application/syncUsecase';
import {
  InMemorySyncRepository,
  PgSyncRepository,
} from './features/sync/infrastructure/syncRepository';
import { createSyncRouter } from './features/sync/presentation/syncRouter';

export function createApp(): Hono {
  const app = new Hono();
  const databaseUrl = process.env.DATABASE_URL;
  const db = databaseUrl ? createDb(databaseUrl) : null;
  const syncRepository = db ? new PgSyncRepository(db) : new InMemorySyncRepository();
  const patientRepository = db ? new PgPatientsRepository(db) : new InMemoryPatientsRepository();
  const syncUsecase = new SyncUsecase(syncRepository, logger, 1);
  const patientUsecase = new PatientUsecase(patientRepository, logger);

  if (!databaseUrl) {
    logger.warn(
      {
        features: ['sync', 'patients'],
      },
      'DATABASE_URL is not set, falling back to in-memory repositories',
    );
  }

  app.route('/', createPatientRouter(patientUsecase));
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
