import { PatientCodeValue } from '@sauver-la-face/shared';
import type { PatientCode } from './patientCodeRepository';

export const PATIENT_CODE_TTL_HOURS = 48;

export function generateCode(random: () => string): PatientCodeValue {
  return PatientCodeValue.create(random());
}

export function isExpired(patientCode: PatientCode, now: Date): boolean {
  if (patientCode.used_at) return false;
  const expirationDate = new Date(
    patientCode.created_at.getTime() + PATIENT_CODE_TTL_HOURS * 60 * 60 * 1000,
  );
  return now > expirationDate;
}

// SEC-03/A07 : un token patient vit un an et ne consulte aucun etat serveur.
// C'est ce code porteur, transporte dans le payload, qui permet de couper une
// session. Volontairement independant de `is_active` et de l'expiration : ces
// deux notions gouvernent le cycle de vie d'un code NON consomme, alors qu'ici
// on juge un code qui a deja ouvert une session et ne peut plus expirer.
export function canSustainSession(patientCode: PatientCode): boolean {
  if (patientCode.deleted_at) return false;
  if (patientCode.revoked_at) return false;
  return true;
}

export function canBeUsed(patientCode: PatientCode, now: Date): boolean {
  if (!patientCode.is_active) return false;
  if (patientCode.deleted_at) return false;
  if (patientCode.revoked_at) return false;
  if (isExpired(patientCode, now)) return false;
  return true;
}
