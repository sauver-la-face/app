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

export const validationErrorSchema = z.object({
  code: z.literal('VALIDATION_ERROR'),
  // zod 4 exige la cle ET la valeur ; zod 3 sous-entendait des cles string
  details: z.record(z.string(), z.unknown()),
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
