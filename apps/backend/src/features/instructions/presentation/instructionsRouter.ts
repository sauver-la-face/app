import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  createInstructionSchema,
  instructionListResponseSchema,
  instructionSchema,
} from '@sauver-la-face/shared';
import {
  type PatientSessionLookup,
  type PatientSessionVariables,
  requirePatientAuth,
} from '@shared/middleware/patientAuthMiddleware';
import { requirePhysicianAuth } from '@shared/middleware/physicianAuthMiddleware';
import { forbiddenErrorSchema, validationErrorSchema } from '@shared/openapi';
import type { MiddlewareHandler } from 'hono';

import type { TokenProvider } from '../../auth/application/tokenProvider';
import type { SessionVariables } from '../../auth/presentation/authRouter';
import {
  InstructionNotFoundError,
  type InstructionsUsecase,
  MedicalProcedureNotFoundError,
} from '../application/instructionsUsecase';
import type { InstructionRepository } from '../domain/instructionRepository';

type Variables = SessionVariables & PatientSessionVariables;

const patientIdParamSchema = z.object({
  patientId: z
    .string()
    .uuid()
    .openapi({
      example: '11111111-1111-4111-8111-111111111111',
      param: { in: 'path', name: 'patientId' },
    }),
});

const instructionIdParamSchema = z.object({
  instructionId: z
    .string()
    .uuid()
    .openapi({
      example: '33333333-3333-4333-8333-333333333333',
      param: { in: 'path', name: 'instructionId' },
    }),
});

const instructionNotFoundErrorSchema = z.object({
  code: z.literal('INSTRUCTION_NOT_FOUND'),
  message: z.string(),
});

const medicalProcedureNotFoundErrorSchema = z.object({
  code: z.literal('MEDICAL_PROCEDURE_NOT_FOUND'),
  message: z.string(),
});

const createInstructionRoute = createRoute({
  method: 'post',
  path: '/instructions',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createInstructionSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: instructionSchema } },
      description: 'Instruction creee',
    },
    400: {
      content: { 'application/json': { schema: validationErrorSchema } },
      description: 'Erreur de validation',
    },
    404: {
      content: { 'application/json': { schema: medicalProcedureNotFoundErrorSchema } },
      description: 'Procedure medicale introuvable',
    },
  },
  tags: ['Instructions'],
});

const listPatientInstructionsRoute = createRoute({
  method: 'get',
  path: '/patients/{patientId}/instructions',
  request: { params: patientIdParamSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: instructionListResponseSchema } },
      description: 'Liste des instructions du patient',
    },
    403: {
      content: { 'application/json': { schema: forbiddenErrorSchema } },
      description: 'Le patient authentifie ne correspond pas au patientId du chemin',
    },
  },
  tags: ['Instructions'],
});

const acknowledgeInstructionRoute = createRoute({
  method: 'post',
  path: '/instructions/{instructionId}/acknowledge',
  request: { params: instructionIdParamSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: instructionSchema } },
      description: 'Instruction confirmee comme lue',
    },
    403: {
      content: { 'application/json': { schema: forbiddenErrorSchema } },
      description: "Le patient authentifie n'est pas proprietaire de l'instruction",
    },
    404: {
      content: { 'application/json': { schema: instructionNotFoundErrorSchema } },
      description: 'Instruction introuvable',
    },
  },
  tags: ['Instructions'],
});

// SEC-01 (creation, medecin) + SEC-02 (consultation/accuse de lecture, patient) :
// creation reservee au medecin authentifie ; lecture et accuse de lecture
// reserves au patient authentifie, uniquement pour ses propres instructions.
export function createInstructionsRouter(
  instructionsUsecase: InstructionsUsecase,
  instructionRepository: InstructionRepository,
  tokenProvider: TokenProvider,
  patientCodes: PatientSessionLookup,
  physicianAuthMiddleware: MiddlewareHandler<{
    Variables: Variables;
  }> = requirePhysicianAuth as unknown as MiddlewareHandler<{ Variables: Variables }>,
): OpenAPIHono<{ Variables: Variables }> {
  const router = new OpenAPIHono<{ Variables: Variables }>();

  router.use('/instructions', physicianAuthMiddleware);
  router.use('/patients/:patientId/instructions', requirePatientAuth(tokenProvider, patientCodes));
  router.use(
    '/instructions/:instructionId/acknowledge',
    requirePatientAuth(tokenProvider, patientCodes),
  );

  router.openapi(createInstructionRoute, async (context) => {
    const body = await context.req.json().catch(() => undefined);
    const parsed = createInstructionSchema.safeParse(body);

    if (!parsed.success) {
      return context.json(
        { code: 'VALIDATION_ERROR' as const, details: parsed.error.flatten() },
        400,
      );
    }

    try {
      const response = await instructionsUsecase.createInstruction(parsed.data);
      return context.json(response, 201);
    } catch (error) {
      if (error instanceof MedicalProcedureNotFoundError) {
        return context.json(
          { code: error.code as 'MEDICAL_PROCEDURE_NOT_FOUND', message: error.message },
          404,
        );
      }

      throw error;
    }
  });

  router.openapi(listPatientInstructionsRoute, async (context) => {
    const patientId = context.req.param('patientId');

    if (context.get('patientId') !== patientId) {
      return context.json(
        { code: 'FORBIDDEN' as const, message: 'Acces refuse a ce dossier patient' },
        403,
      );
    }

    const response = await instructionsUsecase.listForPatient(patientId);
    return context.json(response, 200);
  });

  router.openapi(acknowledgeInstructionRoute, async (context) => {
    const instructionId = context.req.param('instructionId');
    const ownerPatientId = await instructionRepository.findPatientIdByInstructionId(instructionId);

    if (!ownerPatientId || ownerPatientId !== context.get('patientId')) {
      return context.json(
        { code: 'FORBIDDEN' as const, message: 'Acces refuse a cette instruction' },
        403,
      );
    }

    try {
      const response = await instructionsUsecase.acknowledgeInstruction(instructionId);
      return context.json(response, 200);
    } catch (error) {
      if (error instanceof InstructionNotFoundError) {
        return context.json(
          { code: error.code as 'INSTRUCTION_NOT_FOUND', message: error.message },
          404,
        );
      }

      throw error;
    }
  });

  return router;
}
