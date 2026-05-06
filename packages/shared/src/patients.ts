import { z } from 'zod';

const uuidSchema = z.string().uuid();
const isoDateTimeSchema = z.string().datetime({ offset: true });
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const trimmedOptionalString = (maxLength: number) =>
  z.string().trim().min(1).max(maxLength).nullable().optional();

export const patientCodeStatusSchema = z.enum(['none', 'active', 'expired', 'used', 'revoked']);

export const patientSyncStatusSchema = z.enum(['never_synced', 'ok', 'offline']);

export const createPatientSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  sex: trimmedOptionalString(10),
  birthdate: isoDateSchema.nullable().optional(),
  region: trimmedOptionalString(100),
});

export const updatePatientSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    sex: trimmedOptionalString(10),
    birthdate: isoDateSchema.nullable().optional(),
    region: trimmedOptionalString(100),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export const patientSummarySchema = z.object({
  patientId: uuidSchema,
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  sex: z.string().nullable(),
  birthdate: isoDateSchema.nullable(),
  region: z.string().nullable(),
  anonymizedAt: isoDateTimeSchema.nullable(),
  lastSyncedAt: isoDateTimeSchema.nullable(),
  syncStatus: patientSyncStatusSchema,
  patientCodeStatus: patientCodeStatusSchema,
});

export const patientListResponseSchema = z.object({
  patients: z.array(patientSummarySchema),
});

export const patientDetailsSchema = patientSummarySchema;

export const patientAccessCodeSchema = z.object({
  patientId: uuidSchema,
  code: z.string().regex(/^\d{6}$/),
  status: z.literal('active'),
  createdAt: isoDateTimeSchema,
  expiresAt: isoDateTimeSchema,
});

export type PatientCodeStatus = z.infer<typeof patientCodeStatusSchema>;
export type PatientSyncStatus = z.infer<typeof patientSyncStatusSchema>;
export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type PatientSummary = z.infer<typeof patientSummarySchema>;
export type PatientListResponse = z.infer<typeof patientListResponseSchema>;
export type PatientDetails = z.infer<typeof patientDetailsSchema>;
export type PatientAccessCode = z.infer<typeof patientAccessCodeSchema>;
