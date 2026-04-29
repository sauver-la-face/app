import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { authRouter, type SessionVariables } from './features/auth/presentation/authRouter';
import { logger } from '@shared/logger';

const app = new Hono<{ Variables: SessionVariables }>();

// CORS — Better Auth nécessite credentials: true
app.use(
  '/api/auth/*',
  cors({
    origin: process.env.WEB_URL ?? 'http://localhost:3000',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['POST', 'GET', 'OPTIONS'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  }),
);

// Logging HTTP (dev uniquement)
if (process.env.NODE_ENV !== 'production') {
  app.use('*', honoLogger());
}

// Feature routers
app.route('/', authRouter);

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
