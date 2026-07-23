import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import {
  createPatientSchema,
  patientAccessCodeSchema,
  patientDetailsSchema,
  patientHistoryResponseSchema,
  patientListResponseSchema,
  updatePatientSchema,
} from '@sauver-la-face/shared';
import type { MiddlewareHandler } from 'hono';
import { requirePhysicianAuth } from '../../../shared/middleware/physicianAuthMiddleware';
import {
  notFoundErrorSchema,
  patientCodeGenerationErrorSchema,
  uuidParamSchema,
  validationErrorSchema,
} from '../../../shared/openapi';
import type { SessionVariables } from '../../auth/presentation/authRouter';
import {
  PatientCodeGenerationError,
  PatientNotFoundError,
  type PatientUsecase,
} from '../application/patientUsecase';

const listPatientsRoute = createRoute({
  method: 'get',
  path: '/patients',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: patientListResponseSchema,
        },
      },
      description: 'Liste des patients',
    },
  },
  tags: ['Patients'],
});

const createPatientRoute = createRoute({
  method: 'post',
  path: '/patients',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createPatientSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: patientDetailsSchema,
        },
      },
      description: 'Patient cree',
    },
    400: {
      content: {
        'application/json': {
          schema: validationErrorSchema,
        },
      },
      description: 'Erreur de validation',
    },
  },
  tags: ['Patients'],
});

const getPatientRoute = createRoute({
  method: 'get',
  path: '/patients/{patientId}',
  request: {
    params: uuidParamSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: patientDetailsSchema,
        },
      },
      description: 'Details patient',
    },
    404: {
      content: {
        'application/json': {
          schema: notFoundErrorSchema,
        },
      },
      description: 'Patient introuvable',
    },
  },
  tags: ['Patients'],
});

const getPatientHistoryRoute = createRoute({
  method: 'get',
  path: '/patients/{patientId}/history',
  request: {
    params: uuidParamSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: patientHistoryResponseSchema,
        },
      },
      description: 'Historique complet du patient',
    },
    404: {
      content: {
        'application/json': {
          schema: notFoundErrorSchema,
        },
      },
      description: 'Patient introuvable',
    },
  },
  tags: ['Patients'],
});

const updatePatientRoute = createRoute({
  method: 'patch',
  path: '/patients/{patientId}',
  request: {
    body: {
      content: {
        'application/json': {
          schema: updatePatientSchema,
        },
      },
      required: true,
    },
    params: uuidParamSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: patientDetailsSchema,
        },
      },
      description: 'Patient mis a jour',
    },
    400: {
      content: {
        'application/json': {
          schema: validationErrorSchema,
        },
      },
      description: 'Erreur de validation',
    },
    404: {
      content: {
        'application/json': {
          schema: notFoundErrorSchema,
        },
      },
      description: 'Patient introuvable',
    },
  },
  tags: ['Patients'],
});

const issueAccessCodeRoute = createRoute({
  method: 'post',
  path: '/patients/{patientId}/access-code',
  request: {
    params: uuidParamSchema,
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: patientAccessCodeSchema,
        },
      },
      description: 'Code d acces genere',
    },
    404: {
      content: {
        'application/json': {
          schema: notFoundErrorSchema,
        },
      },
      description: 'Patient introuvable',
    },
    500: {
      content: {
        'application/json': {
          schema: patientCodeGenerationErrorSchema,
        },
      },
      description: 'Generation du code impossible',
    },
  },
  tags: ['Patients'],
});

// SEC-01/A01 : ces routes exposent des dossiers patients (dashboard medecin).
// L'equipe de Toulouse suit collectivement les memes patients (pas de
// patientele privee par medecin) - seule une session medecin valide est
// exigee ici, aucun controle d'appartenance par patient.
export function createPatientRouter(
  patientUsecase: PatientUsecase,
  authMiddleware: MiddlewareHandler<{ Variables: SessionVariables }> = requirePhysicianAuth,
): OpenAPIHono<{ Variables: SessionVariables }> {
  const router = new OpenAPIHono<{ Variables: SessionVariables }>();

  router.use('/patients/*', authMiddleware);
  router.use('/patients', authMiddleware);

  router.openapi(listPatientsRoute, async (context) => {
    const response = await patientUsecase.listPatients();
    return context.json(response, 200);
  });

  router.openapi(createPatientRoute, async (context) => {
    const body = await context.req.json().catch(() => undefined);
    const parsedBody = createPatientSchema.safeParse(body);

    if (!parsedBody.success) {
      return context.json(
        {
          code: 'VALIDATION_ERROR' as const,
          details: parsedBody.error.flatten(),
        },
        400,
      );
    }

    const response = await patientUsecase.createPatient(parsedBody.data);
    return context.json(response, 201);
  });

  router.openapi(getPatientRoute, async (context) => {
    try {
      const response = await patientUsecase.getPatient(context.req.param('patientId'));
      return context.json(response, 200);
    } catch (error) {
      if (error instanceof PatientNotFoundError) {
        return context.json(
          { code: error.code as 'PATIENT_NOT_FOUND', message: error.message },
          404,
        );
      }

      throw error;
    }
  });

  router.openapi(getPatientHistoryRoute, async (context) => {
    try {
      const response = await patientUsecase.getPatientHistory(context.req.param('patientId'));
      return context.json(response, 200);
    } catch (error) {
      if (error instanceof PatientNotFoundError) {
        return context.json(
          { code: error.code as 'PATIENT_NOT_FOUND', message: error.message },
          404,
        );
      }

      throw error;
    }
  });

  router.openapi(updatePatientRoute, async (context) => {
    const body = await context.req.json().catch(() => undefined);
    const parsedBody = updatePatientSchema.safeParse(body);

    if (!parsedBody.success) {
      return context.json(
        {
          code: 'VALIDATION_ERROR' as const,
          details: parsedBody.error.flatten(),
        },
        400,
      );
    }

    try {
      const response = await patientUsecase.updatePatient(
        context.req.param('patientId'),
        parsedBody.data,
      );
      return context.json(response, 200);
    } catch (error) {
      if (error instanceof PatientNotFoundError) {
        return context.json(
          { code: error.code as 'PATIENT_NOT_FOUND', message: error.message },
          404,
        );
      }

      throw error;
    }
  });

  router.openapi(issueAccessCodeRoute, async (context) => {
    try {
      const response = await patientUsecase.issueAccessCode(context.req.param('patientId'));
      return context.json(response, 201);
    } catch (error) {
      if (error instanceof PatientNotFoundError) {
        return context.json(
          { code: error.code as 'PATIENT_NOT_FOUND', message: error.message },
          404,
        );
      }

      if (error instanceof PatientCodeGenerationError) {
        return context.json(
          { code: error.code as 'PATIENT_CODE_GENERATION_FAILED', message: error.message },
          500,
        );
      }

      throw error;
    }
  });

  return router;
}
