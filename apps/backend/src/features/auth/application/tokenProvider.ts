export interface TokenPayload {
  uuid_patient: string;
  uuid_patient_code: string;
  role: 'patient';
}

export interface TokenProvider {
  sign(payload: TokenPayload): Promise<string>;
  // Retourne null si le token est absent, malforme, invalide ou expire -
  // ne jamais lever d'exception ici, laisser l'appelant decider (401).
  verify(token: string): Promise<TokenPayload | null>;
}
