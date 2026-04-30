import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { db } from './shared/db';
import { DrizzlePatientCodeRepository } from './features/auth/infrastructure/patientCodeRepository';
import { AuthUsecase } from './features/auth/application/auth.usecase';
import { createAuthRouter } from './features/auth/presentation/authRouter';
import { logger } from './shared/logger';
import { JwtTokenProvider } from './features/auth/infrastructure/jwtTokenProvider';
import { AuthCron } from './features/auth/application/auth.cron';
import { scheduleJobs } from './infrastructure/jobs';

const app = new OpenAPIHono();

// Dependency Injection
const patientCodeRepository = new DrizzlePatientCodeRepository(db);
const tokenProvider = new JwtTokenProvider(process.env.JWT_SECRET || 'dev-secret');
const authUsecase = new AuthUsecase(patientCodeRepository, tokenProvider);
const authCron = new AuthCron(patientCodeRepository);

// Schedule Jobs
scheduleJobs(authCron);

// Routes
app.route('/auth', createAuthRouter(authUsecase));

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// OpenAPI Documentation
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

logger.info('Backend server starting...');

export default {
  port: process.env.PORT ?? 3001,
  fetch: app.fetch,
};
