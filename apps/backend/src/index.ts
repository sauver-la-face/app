import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import { createDb } from '@shared/db';
import { logger } from '@shared/logger';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { poweredBy } from 'hono/powered-by';
import { AuthCron } from './features/auth/application/auth.cron';
import { AuthUsecase } from './features/auth/application/auth.usecase';
import { JwtTokenProvider } from './features/auth/infrastructure/jwtTokenProvider';
import { DrizzlePatientCodeRepository } from './features/auth/infrastructure/patientCodeRepository';
// Imports unifiés pour l'Auth (Patients + Better Auth)
import {
  authRouter,
  createAuthRouter,
  type SessionVariables,
} from './features/auth/presentation/authRouter';
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
// Imports Dev (Features métiers et Jobs)
import { scheduleJobs } from './infrastructure/jobs';
import { db } from './shared/db'; // Maintenu pour la compatibilité avec DrizzlePatientCodeRepository

export function createApp(): OpenAPIHono<{ Variables: SessionVariables }> {
  // Remplacement de Hono classique par OpenAPIHono (qui l'étend)
  const app = new OpenAPIHono<{ Variables: SessionVariables }>();

  // --- Middlewares globaux ---
  app.use('*', poweredBy());
  if (process.env.NODE_ENV !== 'production') {
    app.use('*', honoLogger());
  }

  // --- Base de données dynamique (dev) ---
  const databaseUrl = process.env.DATABASE_URL;
  const dynamicDb = databaseUrl ? createDb(databaseUrl) : null;

  if (!databaseUrl) {
    logger.warn(
      { features: ['sync', 'patients'] },
      'DATABASE_URL is not set, falling back to in-memory repositories',
    );
  }

  // --- Injection des Dépendances (DI) ---
  // 1. DI Issues de dev
  const syncRepository = dynamicDb ? new PgSyncRepository(dynamicDb) : new InMemorySyncRepository();
  const patientRepository = dynamicDb
    ? new PgPatientsRepository(dynamicDb)
    : new InMemoryPatientsRepository();
  const syncUsecase = new SyncUsecase(syncRepository, logger, 1);
  const patientUsecase = new PatientUsecase(patientRepository, logger);

  // 2. DI Issues de ta feature (Patients)
  const patientCodeRepository = new DrizzlePatientCodeRepository(db);
  const tokenProvider = new JwtTokenProvider(process.env.JWT_SECRET || 'dev-secret');
  const patientAuthUsecase = new AuthUsecase(patientCodeRepository, tokenProvider);
  const authCron = new AuthCron(patientCodeRepository);

  // --- Lancement des tâches planifiées ---
  scheduleJobs(authCron);

  // --- Configuration CORS (spécifique Better Auth) ---
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

  // --- Enregistrement des Routes ---
  app.get('/health', (c) => c.json({ status: 'ok' }));

  // Routes Auth (classiques + patients)
  app.route('/', authRouter);
  app.route('/auth', createAuthRouter(patientAuthUsecase));

  // Routes métier
  app.route('/', createPatientRouter(patientUsecase));
  app.route('/', createSyncRouter(syncUsecase));

  // --- Documentation OpenAPI (Swagger) ---
  app.doc('/openapi.json', {
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      title: 'Sauver la Face API',
    },
  });

  if (process.env.NODE_ENV !== 'production') {
    app.get('/docs', swaggerUI({ url: '/openapi.json' }));
  }

  // --- Gestion globale des erreurs ---
  app.notFound((c) => c.json({ error: 'NOT_FOUND' }, 404));

  app.onError((error, context) => {
    logger.error({ error }, 'Unhandled backend error');
    return context.json({ code: 'INTERNAL_SERVER_ERROR' }, 500);
  });

  return app;
}

const app = createApp();
const port = Number(process.env.PORT ?? 3001);

logger.info({ port }, 'Backend démarré');

export default {
  port,
  fetch: app.fetch,
};
