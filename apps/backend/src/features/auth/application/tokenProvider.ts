export interface TokenPayload {
  uuid_patient: string;
  uuid_patient_code: string;
  role: 'patient';
}

export interface TokenProvider {
  sign(payload: TokenPayload): Promise<string>;
}
