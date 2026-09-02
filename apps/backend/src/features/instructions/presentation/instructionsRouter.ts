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
import {
  forbiddenErrorSchema,
  unauthorizedErrorSchema,
  validationErrorSchema,
} from '@shared/openapi';
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
  summary: 'Envoyer une consigne post-operatoire a un patient',
  description: 'Redigee par le medecin depuis le dashboard, lue par le patient sur son telephone.',
  security: [{ sessionMedecin: [] }],
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
    401: {
      content: { 'application/json': { schema: unauthorizedErrorSchema } },
      description: 'Session medecin requise',
    },
    404: {
      content: { 'application/json': { schema: medicalProcedureNotFoundErrorSchema } },
      description: 'Procedure medicale introuvable',
    },
  },
  tags: ['Instructions'],
});

// SEC-03 : servie sous `/me` et non `/patients/{id}`. Deux raisons.
//
// Technique : `patientRouter` pose un garde medecin sur `/patients/*`, et Hono
// aplatit les sous-routeurs montes sur '/' dans une seule table. Sous l'ancien
// chemin, le garde medecin repondait 401 avant que le garde patient ne
// s'execute — la route etait injoignable depuis le mobile.
//
// De conception : `/patients/{id}/...` est une vue administrative, ou un tiers
// designe quelqu'un d'autre par son identifiant. `/me/...` est une vue a la
// premiere personne, ou le sujet lit ses propres donnees. L'identifiant
// disparaissant de l'URL, il n'y a plus de correspondance a verifier entre le
// chemin et le token : la classe de bug IDOR disparait par construction au lieu
// d'etre rattrapee par un 403.
const listPatientInstructionsRoute = createRoute({
  method: 'get',
  path: '/me/instructions',
  summary: 'Lister ses propres consignes post-operatoires',
  description:
    "SEC-03 : servie sous `/me` plutot que sous `/patients/{id}`. Le patient est deduit de son jeton, jamais d'un identifiant fourni dans l'URL.",
  security: [{ jetonPatient: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: instructionListResponseSchema } },
      description: 'Liste des instructions du patient authentifie',
    },
  },
  tags: ['Instructions'],
});

const acknowledgeInstructionRoute = createRoute({
  method: 'post',
  path: '/instructions/{instructionId}/acknowledge',
  summary: 'Accuser reception d une consigne',
  description:
    "Marque la consigne comme lue par le patient et remonte l'information au dashboard du medecin.",
  security: [{ jetonPatient: [] }],
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
  router.use('/me/instructions', requirePatientAuth(tokenProvider, patientCodes));
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

    // L'auteur vient de la session, jamais du corps de la requete. Le middleware
    // garantit deja la presence de l'utilisateur ; la garde reste explicite pour
    // que la regle soit lisible ici plutot que supposee ailleurs.
    const user = context.get('user');

    if (!user) {
      return context.json(
        { code: 'UNAUTHORIZED' as const, message: 'Session medecin requise' },
        401,
      );
    }

    try {
      const response = await instructionsUsecase.createInstruction({
        ...parsed.data,
        physicianId: user.id,
      });
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
    // Le patient vient du token, jamais du chemin : plus rien a comparer, donc
    // plus de 403 possible ici. C'est le gain du passage sous `/me`.
    const patientId = context.get('patientId') as string;
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
