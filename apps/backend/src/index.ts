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
import { AuthCron } from './features/auth/application/authCron';
import { AuthUsecase } from './features/auth/application/authUsecase';
import { JwtTokenProvider } from './features/auth/infrastructure/jwtTokenProvider';
import { DrizzlePatientCodeRepository } from './features/auth/infrastructure/patientCodeRepository';
// Imports unifiés pour l'Auth (Patients + Better Auth)
import {
  authRouter,
  createAuthRouter,
  type SessionVariables,
} from './features/auth/presentation/authRouter';
import { ExportsUsecase } from './features/exports/application/exportsUsecase';
import { PgExportsRepository } from './features/exports/infrastructure/exportsRepository';
import { PdfLibReportGenerator } from './features/exports/infrastructure/pdfLibReportGenerator';
import { createExportsRouter } from './features/exports/presentation/exportsRouter';
import { InstructionsUsecase } from './features/instructions/application/instructionsUsecase';
import {
  InMemoryInstructionRepository,
  PgInstructionRepository,
} from './features/instructions/infrastructure/instructionRepository';
import { createInstructionsRouter } from './features/instructions/presentation/instructionsRouter';
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
import { startAuditExportScheduler } from './shared/jobs/auditExportCron';
import { createAuditMiddleware } from './shared/middleware/auditMiddleware';
import { requirePhysicianAuth } from './shared/middleware/physicianAuthMiddleware';
import { createS3LogsStorageFromEnv } from './shared/storage/logsStorage';
import { buildPhotoPublicBaseUrl, createPhotoS3Client } from './shared/storage/s3Client';

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
    // La liste ne contient que ce qui fonctionne reellement. `photos` et
    // `exports` n'ont aucun depot en memoire : sans base, leurs routeurs ne
    // sont pas montes du tout. `sync` et la lecture patient des instructions
    // ont bien un depot en memoire, mais restent inatteignables : le code
    // d'acces patient passe par Postgres en toutes circonstances, donc aucun
    // token ne peut etre obtenu dans ce mode.
    logger.warn(
      {
        enMemoire: ['alerts', 'patients', 'instructions'],
        indisponibles: ['photos', 'exports'],
        authPatientRequiertPostgres: true,
      },
      'DATABASE_URL is not set: only physician-side features work, patient authentication requires a database',
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
  const exportsRepository = dynamicDb ? new PgExportsRepository(dynamicDb) : null;
  const instructionRepository = dynamicDb
    ? new PgInstructionRepository(dynamicDb)
    : new InMemoryInstructionRepository();
  const patientCodeRepository = new DrizzlePatientCodeRepository(db);

  // 2. Storage
  const s3Client = createPhotoS3Client();
  const bucket = process.env.MINIO_BUCKET_PHOTOS ?? 'photos';
  const photoStorage = new S3PhotoStorage(s3Client, bucket, buildPhotoPublicBaseUrl());

  // 3. Usecases
  const alertUsecase = new AlertUsecase(alertRepository, logger);
  const syncUsecase = new SyncUsecase(syncRepository, logger, 1);
  const patientUsecase = new PatientUsecase(patientRepository, logger);
  const photosUsecase = photoRepository ? new PhotosUsecase(photoStorage, photoRepository) : null;
  const exportsUsecase = exportsRepository
    ? new ExportsUsecase(exportsRepository, new PdfLibReportGenerator())
    : null;
  const instructionsUsecase = new InstructionsUsecase(instructionRepository, logger);

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }
  const tokenProvider = new JwtTokenProvider(jwtSecret ?? 'dev-secret');
  const patientAuthUsecase = new AuthUsecase(patientCodeRepository, tokenProvider);
  const authCron = new AuthCron(patientCodeRepository);

  // --- Lancement des tâches planifiées ---
  scheduleJobs(authCron);

  // --- Configuration CORS globale ---
  app.use(
    '*',
    cors({
      origin: process.env.WEB_URL ?? 'http://localhost:3000',
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      exposeHeaders: ['Content-Length'],
      maxAge: 600,
      credentials: true,
    }),
  );

  // --- Documentation OpenAPI ---
  // Servie hors production uniquement, au meme titre que /docs. Masquer
  // l'interface Swagger sans masquer la specification qu'elle affiche ne
  // protege rien : /openapi.json est le contenu, /docs n'en est que la vue.
  // Seuls les tests et les scripts generate:api-types la consomment, tous
  // en developpement.
  if (process.env.NODE_ENV !== 'production') {
    app.doc('/openapi.json', {
      info: {
        title: 'Sauver la Face API',
        version: '1.0.0',
        description: 'Documentation OpenAPI du backend Sauver la Face',
      },
      openapi: '3.0.0',
    });
  }

  // --- Enregistrement des Routes ---
  app.get('/health', (c) => c.json({ status: 'ok' }));

  // Routes Auth (classiques + patients)
  app.route('/', authRouter);
  app.route('/auth', createAuthRouter(patientAuthUsecase, requirePhysicianAuth));

  // Routes métier
  app.route('/', createAlertRouter(alertUsecase));
  app.route('/', createPatientRouter(patientUsecase));
  app.route('/', createSyncRouter(syncUsecase, tokenProvider, patientCodeRepository));
  if (photosUsecase && photoRepository)
    app.route(
      '/',
      createPhotosRouter(
        photosUsecase,
        photoRepository,
        s3Client,
        bucket,
        tokenProvider,
        patientCodeRepository,
      ),
    );
  if (exportsUsecase) app.route('/', createExportsRouter(exportsUsecase));
  app.route(
    '/',
    createInstructionsRouter(
      instructionsUsecase,
      instructionRepository,
      tokenProvider,
      patientCodeRepository,
    ),
  );

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
