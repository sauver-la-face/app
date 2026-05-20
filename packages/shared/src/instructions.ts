import { z } from 'zod';

const uuidSchema = z.string().uuid();
const isoDateTimeSchema = z.string().datetime({ offset: true });

export const createInstructionSchema = z.object({
  medicalProcedureId: uuidSchema,
  physicianId: uuidSchema,
  content: z.string().trim().min(1).max(2000),
});

export const instructionSchema = z.object({
  instructionId: uuidSchema,
  medicalProcedureId: uuidSchema,
  physicianId: uuidSchema,
  content: z.string().min(1),
  createdAt: isoDateTimeSchema,
  acknowledgedAt: isoDateTimeSchema.nullable(),
});

export const instructionListResponseSchema = z.object({
  instructions: z.array(instructionSchema),
});

export type CreateInstructionInput = z.infer<typeof createInstructionSchema>;
export type Instruction = z.infer<typeof instructionSchema>;
export type InstructionListResponse = z.infer<typeof instructionListResponseSchema>;
