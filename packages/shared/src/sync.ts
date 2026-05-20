import { z } from 'zod';

export const syncSchemaVersion = 1;

const uuidSchema = z.string().uuid();
const isoDateTimeSchema = z.string().datetime({ offset: true });

export const syncMedicalEventSymptomSchema = z.object({
  uuidEvent: uuidSchema,
  uuidSymptom: uuidSchema,
});

export const syncMediaSchema = z.object({
  uuidMedia: uuidSchema,
  uuidEvent: uuidSchema,
  fileUrl: z.string().min(1),
  fileType: z.string().min(1).max(20),
  takenAt: isoDateTimeSchema,
  description: z.string().nullable().optional(),
});

export const syncInstructionAcknowledgementSchema = z.object({
  uuidInstructions: uuidSchema,
  acknowledgedAt: isoDateTimeSchema,
});

export const syncServerStateSchema = z.object({
  medicalEventSymptoms: z.array(syncMedicalEventSymptomSchema),
  media: z.array(syncMediaSchema),
  instructionAcknowledgements: z.array(syncInstructionAcknowledgementSchema),
});

export const syncRequestSchema = z.object({
  patientId: uuidSchema,
  schemaVersion: z.number().int().positive(),
  medicalEventSymptoms: z.array(syncMedicalEventSymptomSchema).default([]),
  media: z.array(syncMediaSchema).default([]),
  instructionAcknowledgements: z.array(syncInstructionAcknowledgementSchema).default([]),
});

export const syncResponseSchema = z.object({
  schemaVersion: z.number().int().positive(),
  serverState: syncServerStateSchema,
});

export type SyncMedicalEventSymptom = z.infer<typeof syncMedicalEventSymptomSchema>;
export type SyncMedia = z.infer<typeof syncMediaSchema>;
export type SyncInstructionAcknowledgement = z.infer<typeof syncInstructionAcknowledgementSchema>;
export type SyncServerState = z.infer<typeof syncServerStateSchema>;
export type SyncRequest = z.infer<typeof syncRequestSchema>;
export type SyncResponse = z.infer<typeof syncResponseSchema>;
