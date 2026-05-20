import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import { createDb } from '@shared/db';
import { logger } from '@shared/logger';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { poweredBy } from 'hono/powered-by';
// Features métier
import { AlertUsecase } from './features/alerts/application/alertUsecase';
import {
  InMemoryAlertRepository,
  PgAlertRepository,
} from './features/alerts/infrastructure/alertRepository';
import { createAlertRouter } from './features/alerts/presentation/alertRouter';
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
import { PhotosUsecase } from './features/photos/application/photosUsecase';
import { PgPhotoRepository } from './features/photos/infrastructure/pgPhotoRepository';
import { S3PhotoStorage } from './features/photos/infrastructure/s3PhotoStorage';
import { createPhotosRouter } from './features/photos/presentation/photosRouter';
import { SyncUsecase } from './features/sync/application/syncUsecase';
import {
  InMemorySyncRepository,
  PgSyncRepository,
} from './features/sync/infrastructure/syncRepository';
import { createSyncRouter } from './features/sync/presentation/syncRouter';
// Jobs & Infrastructure
import { scheduleJobs } from './infrastructure/jobs';
import { db } from './shared/db'; // Maintenu pour la compatibilité avec DrizzlePatientCodeRepository
import { startAuditExportScheduler } from './shared/jobs/audit.export.cron';
import { createAuditMiddleware } from './shared/middleware/audit.middleware';
import { createS3LogsStorageFromEnv } from './shared/storage/logs.storage';
import { buildPhotoPublicBaseUrl, createPhotoS3Client } from './shared/storage/s3Client';

function throwNoDb(feature: string): never {
  throw new Error(`DATABASE_URL is required for feature: ${feature}`);
}

export function createApp(): OpenAPIHono<{ Variables: SessionVariables }> {
  const app = new OpenAPIHono<{ Variables: SessionVariables }>();

  // --- Middlewares globaux ---
  app.use('*', poweredBy());
  if (process.env.NODE_ENV !== 'production') {
    app.use('*', honoLogger());
  }
  app.use('*', createAuditMiddleware(logger));

  // --- Base de données dynamique ---
  const databaseUrl = process.env.DATABASE_URL;
  const dynamicDb = databaseUrl ? createDb(databaseUrl) : null;

  if (!databaseUrl) {
    logger.warn(
      { features: ['alerts', 'sync', 'patients', 'photos'] },
      'DATABASE_URL is not set, falling back to in-memory repositories',
    );
  }

  // --- Injection des Dépendances (DI) ---

  // 1. Repositories
  const alertRepository = dynamicDb
    ? new PgAlertRepository(dynamicDb)
    : new InMemoryAlertRepository();
  const syncRepository = dynamicDb ? new PgSyncRepository(dynamicDb) : new InMemorySyncRepository();
  const patientRepository = dynamicDb
    ? new PgPatientsRepository(dynamicDb)
    : new InMemoryPatientsRepository();
  const photoRepository = dynamicDb ? new PgPhotoRepository(dynamicDb) : null;
  const patientCodeRepository = new DrizzlePatientCodeRepository(db);

  // 2. Storage
  const s3Client = createPhotoS3Client();
  const bucket = process.env.MINIO_BUCKET_PHOTOS ?? 'photos';
  const photoStorage = new S3PhotoStorage(s3Client, bucket, buildPhotoPublicBaseUrl());

  // 3. Usecases
  const alertUsecase = new AlertUsecase(alertRepository, logger);
  const syncUsecase = new SyncUsecase(syncRepository, logger, 1);
  const patientUsecase = new PatientUsecase(patientRepository, logger);
  const photosUsecase = new PhotosUsecase(photoStorage, photoRepository ?? throwNoDb('photos'));

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

  // --- Documentation OpenAPI ---
  app.doc('/openapi.json', {
    info: {
      title: 'Sauver la Face API',
      version: '1.0.0',
      description: 'Documentation OpenAPI du backend Sauver la Face',
    },
    openapi: '3.0.0',
  });

  // --- Enregistrement des Routes ---
  app.get('/health', (c) => c.json({ status: 'ok' }));

  // Routes Auth (classiques + patients)
  app.route('/', authRouter);
  app.route('/auth', createAuthRouter(patientAuthUsecase));

  // Routes métier
  app.route('/', createAlertRouter(alertUsecase));
  app.route('/', createPatientRouter(patientUsecase));
  app.route('/', createSyncRouter(syncUsecase));
  app.route('/', createPhotosRouter(photosUsecase));

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
const auditLogsStorage = createS3LogsStorageFromEnv();

if (auditLogsStorage && process.env.NODE_ENV !== 'test') {
  startAuditExportScheduler(auditLogsStorage, logger);
}

const port = Number(process.env.PORT ?? 3001);
logger.info({ port }, 'Backend démarré');

export default {
  port,
  fetch: app.fetch,
};
