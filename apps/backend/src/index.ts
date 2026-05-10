import { createDb } from '@shared/db';
import { Hono } from 'hono';
import { logger } from '@shared/logger';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { authRouter, type SessionVariables } from './features/auth/presentation/authRouter';

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
  app.route('/', createPatientRouter(patientUsecase));
  app.route('/', createSyncRouter(syncUsecase));

  app.onError((error, context) => {
    logger.error({ error }, 'Unhandled backend error');
    return context.json({ code: 'INTERNAL_SERVER_ERROR' }, 500);
  });

  return app;
}

const app = createApp();

import { basicAuth } from 'hono/basic-auth'
import { etag } from 'hono/etag'
import { poweredBy } from 'hono/powered-by'
import { prettyJSON } from 'hono/pretty-json'

// Mount Builtin Middleware
app.use('*', poweredBy())
// app.use('*', logger())
// import { Hono } from 'hono';
// import { logger } from '@shared/logger';

// const app = new Hono<{ Variables: SessionVariables }>();

// CORS — Better Auth nécessite credentials: true

// Logging HTTP (dev uniquement)
if (process.env.NODE_ENV !== 'production') {
  app.use('*', honoLogger());
}

// Feature routers

app.notFound((c) => c.json({ error: 'NOT_FOUND' }, 404));

app.onError((err, c) => {
  logger.error({ err }, 'Unhandled error');
  return c.json({ error: 'INTERNAL_SERVER_ERROR' }, 500);
});

const port = Number(process.env.PORT ?? 3001);
logger.info({ port }, 'Backend démarré');

export default {
  port,
  fetch: app.fetch,
};
