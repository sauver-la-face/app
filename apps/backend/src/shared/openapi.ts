import { z } from '@hono/zod-openapi';

export const uuidParamSchema = z.object({
  patientId: z
    .string()
    .uuid()
    .openapi({
      example: '11111111-1111-4111-8111-111111111111',
      param: {
        in: 'path',
        name: 'patientId',
      },
    }),
});

// `details` recoit toujours le resultat de `error.flatten()` de Zod, jamais une
// forme libre. Le decrire tel quel corrige deux defauts a la fois : le document
// annoncait une valeur de type inconnu la ou la structure est parfaitement
// stable, et `z.unknown()` produisait `nullable: true` sans `type` — invalide
// en OpenAPI 3.0, ou `nullable` doit accompagner un `type`.
export const zodFlattenedErrorSchema = z.object({
  formErrors: z.array(z.string()),
  fieldErrors: z.record(z.string(), z.array(z.string())),
});

export const validationErrorSchema = z.object({
  code: z.literal('VALIDATION_ERROR'),
  details: zodFlattenedErrorSchema,
});

export const notFoundErrorSchema = z.object({
  code: z.literal('PATIENT_NOT_FOUND'),
  message: z.string(),
});

export const internalErrorSchema = z.object({
  code: z.literal('INTERNAL_SERVER_ERROR'),
});

export const patientCodeGenerationErrorSchema = z.object({
  code: z.literal('PATIENT_CODE_GENERATION_FAILED'),
  message: z.string(),
});

export const syncVersionErrorSchema = z.object({
  code: z.literal('APP_UPDATE_REQUIRED'),
  message: z.string(),
  serverSchemaVersion: z.number().int().positive(),
});

export const unauthorizedErrorSchema = z.object({
  code: z.literal('UNAUTHORIZED'),
  message: z.string(),
});

export const patientMismatchErrorSchema = z.object({
  code: z.literal('PATIENT_MISMATCH'),
  message: z.string(),
});

export const forbiddenErrorSchema = z.object({
  code: z.literal('FORBIDDEN'),
  message: z.string(),
});
