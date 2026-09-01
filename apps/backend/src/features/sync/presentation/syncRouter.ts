import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { syncRequestSchema, syncResponseSchema } from '@sauver-la-face/shared';
import {
  type PatientSessionLookup,
  type PatientSessionVariables,
  requirePatientAuth,
} from '@shared/middleware/patientAuthMiddleware';
import {
  patientMismatchErrorSchema,
  syncVersionErrorSchema,
  unauthorizedErrorSchema,
  validationErrorSchema,
} from '@shared/openapi';
import type { TokenProvider } from '../../auth/application/tokenProvider';
import type { SyncUsecase } from '../application/syncUsecase';
import { SyncVersionError } from '../domain/syncDomain';

const syncRoute = createRoute({
  method: 'post',
  path: '/sync',
  summary: 'Remonter les donnees collectees hors ligne par le mobile',
  description:
    "Resolution des conflits en server-wins. Met a jour la date de derniere synchronisation du patient, dont depend l'alerte d'inactivite de sept jours.",
  security: [{ jetonPatient: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: syncRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: syncResponseSchema,
        },
      },
      description: 'Synchronisation reussie',
    },
    400: {
      content: {
        'application/json': {
          schema: validationErrorSchema,
        },
      },
      description: 'Erreur de validation',
    },
    401: {
      content: {
        'application/json': {
          schema: unauthorizedErrorSchema,
        },
      },
      description: 'Authentification patient requise',
    },
    403: {
      content: {
        'application/json': {
          schema: patientMismatchErrorSchema,
        },
      },
      description: 'Le patient authentifie ne correspond pas au patientId du payload',
    },
    409: {
      content: {
        'application/json': {
          schema: syncVersionErrorSchema,
        },
      },
      description: 'Version de schema incompatible',
    },
  },
  tags: ['Sync'],
});

// SEC-02/A01/A07 : le patient authentifie (JWT verifie) doit correspondre au
// patientId du payload - sinon n'importe qui peut ecrire des donnees
// medicales au nom d'un autre patient.
export function createSyncRouter(
  syncUsecase: SyncUsecase,
  tokenProvider: TokenProvider,
  patientCodes: PatientSessionLookup,
): OpenAPIHono<{ Variables: PatientSessionVariables }> {
  const router = new OpenAPIHono<{ Variables: PatientSessionVariables }>();

  router.use('/sync', requirePatientAuth(tokenProvider, patientCodes));

  router.openapi(syncRoute, async (context) => {
    const body = await context.req.json().catch(() => undefined);
    const parsedBody = syncRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return context.json(
        {
          code: 'VALIDATION_ERROR' as const,
          details: parsedBody.error.flatten(),
        },
        400,
      );
    }

    if (context.get('patientId') !== parsedBody.data.patientId) {
      return context.json(
        {
          code: 'PATIENT_MISMATCH' as const,
          message: 'Le patient authentifie ne correspond pas au patientId du payload',
        },
        403,
      );
    }

    try {
      const response = await syncUsecase.sync(parsedBody.data);
      return context.json(response, 200);
    } catch (error) {
      if (error instanceof SyncVersionError) {
        return context.json(
          {
            code: error.code as 'APP_UPDATE_REQUIRED',
            message: error.message,
            serverSchemaVersion: error.serverSchemaVersion,
          },
          409,
        );
      }

      throw error;
    }
  });

  return router;
}
