import { z } from 'zod';

export const patientCodeSchema = z
  .string()
  .length(6, { message: 'Le code doit contenir exactement 6 chiffres' })
  .regex(/^\d+$/, { message: 'Le code doit contenir uniquement des chiffres' });

export type PatientCodeValueType = z.infer<typeof patientCodeSchema>;

export class PatientCodeValue {
  private constructor(private readonly value: string) {}

  static create(code: string): PatientCodeValue {
    const validated = patientCodeSchema.parse(code);
    return new PatientCodeValue(validated);
  }

  toString(): string {
    return this.value;
  }
}
