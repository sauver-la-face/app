import { z } from 'zod';

const uuidSchema = z.string().uuid();
const isoDateTimeSchema = z.string().datetime({ offset: true });

// L'auteur d'une consigne n'est pas declare par le client : il est deduit de
// la session cote serveur. Un medecin authentifie pouvait sinon signer une
// consigne du nom d'un confrere, et le dossier de sante attribuait l'acte a
// quelqu'un qui ne l'avait pas pose.
export const createInstructionSchema = z.object({
  medicalProcedureId: uuidSchema,
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

// Ce que recoit le domaine : la saisie du medecin, plus l'auteur que la couche
// presentation lit dans la session. Les deux types sont volontairement
// distincts — confondre le contrat HTTP et la commande metier est precisement
// ce qui laissait le client choisir la signature de l'acte.
export type CreateInstructionCommand = CreateInstructionInput & {
  physicianId: string;
};
export type Instruction = z.infer<typeof instructionSchema>;
export type InstructionListResponse = z.infer<typeof instructionListResponseSchema>;
