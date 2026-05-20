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

export const patientHistoryProcedureSchema = z.object({
  procedureId: uuidSchema,
  procedureType: z.string(),
  date: isoDateSchema,
  hospitalName: z.string().nullable(),
});

export const patientHistorySymptomSchema = z.object({
  code: z.string(),
  labelFr: z.string(),
  labelKm: z.string(),
  triggersAlert: z.boolean(),
});

export const patientHistoryEventSchema = z.object({
  eventId: uuidSchema,
  procedureId: uuidSchema,
  physicianId: uuidSchema.nullable(),
  eventType: z.string(),
  eventTitle: z.string().nullable(),
  description: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  symptoms: z.array(patientHistorySymptomSchema),
});

export const patientHistoryMediaSchema = z.object({
  mediaId: uuidSchema,
  eventId: uuidSchema,
  fileUrl: z.string().url(),
  fileType: z.string(),
  takenAt: isoDateTimeSchema,
  description: z.string().nullable(),
});

export const patientHistoryInstructionSchema = z.object({
  instructionId: uuidSchema,
  procedureId: uuidSchema,
  physicianId: uuidSchema,
  content: z.string(),
  createdAt: isoDateTimeSchema,
  acknowledgedAt: isoDateTimeSchema.nullable(),
});

export const patientHistoryResponseSchema = z.object({
  patient: patientDetailsSchema,
  procedures: z.array(patientHistoryProcedureSchema),
  events: z.array(patientHistoryEventSchema),
  media: z.array(patientHistoryMediaSchema),
  instructions: z.array(patientHistoryInstructionSchema),
});

export type PatientCodeStatus = z.infer<typeof patientCodeStatusSchema>;
export type PatientSyncStatus = z.infer<typeof patientSyncStatusSchema>;
export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type PatientSummary = z.infer<typeof patientSummarySchema>;
export type PatientListResponse = z.infer<typeof patientListResponseSchema>;
export type PatientDetails = z.infer<typeof patientDetailsSchema>;
export type PatientAccessCode = z.infer<typeof patientAccessCodeSchema>;
export type PatientHistoryProcedure = z.infer<typeof patientHistoryProcedureSchema>;
export type PatientHistorySymptom = z.infer<typeof patientHistorySymptomSchema>;
export type PatientHistoryEvent = z.infer<typeof patientHistoryEventSchema>;
export type PatientHistoryMedia = z.infer<typeof patientHistoryMediaSchema>;
export type PatientHistoryInstruction = z.infer<typeof patientHistoryInstructionSchema>;
export type PatientHistoryResponse = z.infer<typeof patientHistoryResponseSchema>;
