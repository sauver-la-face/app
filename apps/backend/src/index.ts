import { createDb } from '@shared/db';
import { logger } from '@shared/logger';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { poweredBy } from 'hono/powered-by';
import { AlertUsecase } from './features/alerts/application/alertUsecase';
import {
  InMemoryAlertRepository,
  PgAlertRepository,
} from './features/alerts/infrastructure/alertRepository';
import { createAlertRouter } from './features/alerts/presentation/alertRouter';
import { authRouter } from './features/auth/presentation/authRouter';
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
  const alertRepository = db ? new PgAlertRepository(db) : new InMemoryAlertRepository();
  const syncRepository = db ? new PgSyncRepository(db) : new InMemorySyncRepository();
  const patientRepository = db ? new PgPatientsRepository(db) : new InMemoryPatientsRepository();
  const alertUsecase = new AlertUsecase(alertRepository, logger);
  const syncUsecase = new SyncUsecase(syncRepository, logger, 1);
  const patientUsecase = new PatientUsecase(patientRepository, logger);

  if (!databaseUrl) {
    logger.warn(
      {
        features: ['alerts', 'sync', 'patients'],
      },
      'DATABASE_URL is not set, falling back to in-memory repositories',
    );
  }

  app.use(
    '/api/auth/*',
    cors({
      origin: process.env.WEB_URL ?? 'http://localhost:3001',
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['POST', 'GET', 'OPTIONS'],
      exposeHeaders: ['Content-Length'],
      maxAge: 600,
      credentials: true,
    }),
  );

  app.route('/', authRouter);
  app.route('/', createAlertRouter(alertUsecase));
  app.route('/', createPatientRouter(patientUsecase));
  app.route('/', createSyncRouter(syncUsecase));

  app.onError((error, context) => {
    logger.error({ error }, 'Unhandled backend error');
    return context.json({ code: 'INTERNAL_SERVER_ERROR' }, 500);
  });

  return app;
}

const app = createApp();

app.use('*', poweredBy());

if (process.env.NODE_ENV !== 'production') {
  app.use('*', honoLogger());
}

app.notFound((context) => context.json({ error: 'NOT_FOUND' }, 404));

app.onError((error, context) => {
  logger.error({ error }, 'Unhandled error');
  return context.json({ error: 'INTERNAL_SERVER_ERROR' }, 500);
});

const port = Number(process.env.PORT ?? 3001);
logger.info({ port }, 'Backend demarre');

export default {
  port,
  fetch: app.fetch,
};
