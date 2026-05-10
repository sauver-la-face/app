import { logger } from '@shared/logger';
import { Hono } from 'hono';
import { auth } from '../infrastructure/authConfig';

// État en mémoire des tentatives échouées par IP.
// Suffisant pour 20 utilisateurs web simultanés — pas besoin de Redis en v1.
type IpState = { failures: number; blockedUntil: number | null };
const ipFailures = new Map<string, IpState>();

const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILURES = 3;

function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

function isBlocked(ip: string): boolean {
  const state = ipFailures.get(ip);
  if (!state?.blockedUntil) return false;
  if (Date.now() < state.blockedUntil) return true;
  // Le blocage a expiré : réinitialiser
  ipFailures.delete(ip);
  return false;
}

function recordFailure(ip: string): void {
  const state = ipFailures.get(ip) ?? { failures: 0, blockedUntil: null };
  state.failures += 1;
  if (state.failures >= MAX_FAILURES) {
    state.blockedUntil = Date.now() + BLOCK_DURATION_MS;
    logger.warn(
      { ip, blockedUntil: new Date(state.blockedUntil).toISOString() },
      'IP bloquée après 3 tentatives échouées',
    );
  }
  ipFailures.set(ip, state);
}

function resetFailures(ip: string): void {
  ipFailures.delete(ip);
}

export const authRouter = new Hono();

// Middleware de rate limiting sur les tentatives de connexion échouées
authRouter.use('/api/auth/sign-in/email', async (c, next) => {
  const ip = getClientIp(c.req.raw);

  if (isBlocked(ip)) {
    logger.warn({ ip }, 'Tentative de connexion depuis une IP bloquée');
    return c.json(
      {
        error: 'TOO_MANY_ATTEMPTS',
        message: 'Trop de tentatives. Réessayez dans 15 minutes.',
      },
      429,
    );
  }

  await next();

  // Après la réponse de Better Auth : comptabiliser les échecs
  const status = c.res.status;
  if (status === 401 || status === 422 || status === 403) {
    recordFailure(ip);
  } else if (status === 200) {
    resetFailures(ip);
  }
});

// Handler principal Better Auth — couvre toutes les routes /api/auth/*
authRouter.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw));

// Middleware d'injection de session pour les routes protégées
export type SessionVariables = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
};

export const sessionMiddleware = async (
  c: { req: { raw: Request }; set: (key: string, value: unknown) => void },
  next: () => Promise<void>,
) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set('user', session?.user ?? null);
  c.set('session', session?.session ?? null);
  await next();
};
