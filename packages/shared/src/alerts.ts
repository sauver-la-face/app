import { z } from 'zod';

const uuidSchema = z.string().uuid();
const isoDateTimeSchema = z.string().datetime({ offset: true });

export const alertTypeSchema = z.enum(['symptom_triggered', 'sync_overdue']);
export const alertSeveritySchema = z.enum(['critical', 'warning']);

export const alertSchema = z.object({
  patientId: uuidSchema,
  patientDisplayName: z.string().min(1),
  type: alertTypeSchema,
  severity: alertSeveritySchema,
  message: z.string().min(1),
  occurredAt: isoDateTimeSchema,
  medicalEventId: uuidSchema.nullable(),
  symptomCode: z.string().nullable(),
  symptomLabelFr: z.string().nullable(),
  lastSyncedAt: isoDateTimeSchema.nullable(),
});

export const alertListResponseSchema = z.object({
  alerts: z.array(alertSchema),
});

export type Alert = z.infer<typeof alertSchema>;
export type AlertType = z.infer<typeof alertTypeSchema>;
export type AlertSeverity = z.infer<typeof alertSeveritySchema>;
export type AlertListResponse = z.infer<typeof alertListResponseSchema>;
