import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  createInstructionSchema,
  instructionListResponseSchema,
  instructionSchema,
} from '@sauver-la-face/shared';

import { validationErrorSchema } from '../../../shared/openapi';
import {
  InstructionNotFoundError,
  type InstructionsUsecase,
  MedicalProcedureNotFoundError,
} from '../application/instructionsUsecase';

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
    404: {
      content: { 'application/json': { schema: instructionNotFoundErrorSchema } },
      description: 'Instruction introuvable',
    },
  },
  tags: ['Instructions'],
});

export function createInstructionsRouter(instructionsUsecase: InstructionsUsecase): OpenAPIHono {
  const router = new OpenAPIHono();

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
    const response = await instructionsUsecase.listForPatient(context.req.param('patientId'));
    return context.json(response, 200);
  });

  router.openapi(acknowledgeInstructionRoute, async (context) => {
    try {
      const response = await instructionsUsecase.acknowledgeInstruction(
        context.req.param('instructionId'),
      );
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
