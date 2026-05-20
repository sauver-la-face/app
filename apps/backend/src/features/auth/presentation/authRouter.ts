import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { patientCodeSchema } from '@sauver-la-face/shared';
import { logger } from '@shared/logger';
import { Hono } from 'hono';
import { rateLimiter } from '../../../shared/middleware/rateLimiter';
import type { AuthUsecase } from '../application/authUsecase';
import { auth } from '../infrastructure/authConfig';

// ============================================================================
// PARTIE 1 : AUTHENTIFICATION BETTER AUTH (Depuis `dev`)
// ============================================================================

// État en mémoire des tentatives échouées par IP.
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

// Export du routeur pour l'authentification classique
export const authRouter = new Hono();

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

  const status = c.res.status;
  if (status === 401 || status === 422 || status === 403) {
    recordFailure(ip);
  } else if (status === 200) {
    resetFailures(ip);
  }
});

authRouter.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw));

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

// ============================================================================
// PARTIE 2 : AUTHENTIFICATION PATIENTS branche `feature`
// ============================================================================

const validateSchema = z.object({
  code: patientCodeSchema,
});

const generateSchema = z.object({
  uuid_patient: z.string().uuid(),
});

const renewSchema = z.object({
  uuid_patient: z.string().uuid(),
});

// Export de la factory du routeur patient (qui nécessite l'injection du usecase)
export const createAuthRouter = (authUsecase: AuthUsecase) => {
  const app = new OpenAPIHono();

  app.post(
    '/patient/validate',
    rateLimiter({
      maxAttempts: 3,
      windowMs: 15 * 60 * 1000,
      blockDurationMs: 15 * 60 * 1000,
    }),
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/patient/validate',
      request: {
        body: {
          content: {
            'application/json': {
              schema: validateSchema,
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Code valide',
          content: {
            'application/json': {
              schema: z.object({
                success: z.literal(true),
                patientCode: z.any(), // On pourra affiner le schéma plus tard
                token: z.string().optional(),
              }),
            },
          },
        },
        401: {
          description: 'Code invalide ou expiré',
          content: {
            'application/json': {
              schema: z.object({
                success: z.literal(false),
                error: z.string(),
              }),
            },
          },
        },
      },
    }),
    async (c) => {
      const { code } = c.req.valid('json');
      const result = await authUsecase.validatePatientCode(code);

      if (!result.success) {
        return c.json(result, 401);
      }

      return c.json(result, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/patient/generate',
      request: {
        body: {
          content: {
            'application/json': {
              schema: generateSchema,
            },
          },
        },
      },
      responses: {
        201: {
          description: 'Code généré',
          content: {
            'application/json': {
              schema: z.any(),
            },
          },
        },
      },
    }),
    async (c) => {
      const { uuid_patient } = c.req.valid('json');
      const patientCode = await authUsecase.generatePatientCode(uuid_patient);
      return c.json(patientCode, 201);
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/patient/renew',
      request: {
        body: {
          content: {
            'application/json': {
              schema: renewSchema,
            },
          },
        },
      },
      responses: {
        201: {
          description: 'Code renouvelé',
          content: {
            'application/json': {
              schema: z.any(),
            },
          },
        },
      },
    }),
    async (c) => {
      const { uuid_patient } = c.req.valid('json');
      const patientCode = await authUsecase.renewPatientCode(uuid_patient);
      return c.json(patientCode, 201);
    },
  );

  return app;
};
