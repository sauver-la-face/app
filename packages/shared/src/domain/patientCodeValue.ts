import { z } from 'zod';

export const patientCodeSchema = z
  .string()
  .length(6, { message: 'Le code doit contenir exactement 6 chiffres' })
  .regex(/^\d+$/, { message: 'Le code doit contenir uniquement des chiffres' });

export type PatientCodeValueType = z.infer<typeof patientCodeSchema>;

export class PatientCodeValue {
  // On garde le `readonly` de "dev" (sans le "private") pour s'assurer de ne pas casser
  // d'éventuels appels à `.value` ailleurs dans le code de la branche dev.
  private constructor(readonly value: string) {}

  static create(code: string): PatientCodeValue {
    // On conserve ta validation Zod qui est plus complète et centralisée
    const validated = patientCodeSchema.parse(code);
    return new PatientCodeValue(validated);
  }

  toString(): string {
    return this.value;
  }
}
