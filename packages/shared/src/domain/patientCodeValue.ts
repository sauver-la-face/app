export class PatientCodeValue {
  private constructor(readonly value: string) {}

  static create(value: string): PatientCodeValue {
    if (!/^\d{6}$/.test(value)) {
      throw new Error('PATIENT_CODE_INVALID');
    }

    return new PatientCodeValue(value);
  }
}
