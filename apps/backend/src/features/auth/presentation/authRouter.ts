import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { patientCodeSchema } from '@sauver-la-face/shared';
import { rateLimiter } from '../../../shared/middleware/rateLimiter';
import type { AuthUsecase } from '../application/auth.usecase';

const validateSchema = z.object({
  code: patientCodeSchema,
});

const generateSchema = z.object({
  uuid_patient: z.string().uuid(),
});

const renewSchema = z.object({
  uuid_patient: z.string().uuid(),
});

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
