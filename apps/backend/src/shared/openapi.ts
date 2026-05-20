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
  details: z.record(z.unknown()),
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
