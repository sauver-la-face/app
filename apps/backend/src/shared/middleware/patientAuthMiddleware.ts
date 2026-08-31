import type { Context, MiddlewareHandler, Next } from 'hono';

import type { TokenProvider } from '../../features/auth/application/tokenProvider';
import { canSustainSession } from '../../features/auth/domain/authDomain';
import type { PatientCodeRepository } from '../../features/auth/domain/patientCodeRepository';

export type PatientSessionVariables = {
  patientId: string | null;
};

// Le middleware n'a besoin que de retrouver le code porteur : on ne lui donne
// pas tout le repository, pour qu'il ne puisse rien ecrire.
export type PatientSessionLookup = Pick<PatientCodeRepository, 'findById'>;

// SEC-02/A01/A07 : gardien d'authentification pour les routes mobile (patient).
// Factory car depend du TokenProvider injecte (secret JWT) - contrairement a
// requirePhysicianAuth qui s'appuie sur le singleton Better Auth global.
//
// SEC-03 : la signature ne suffit pas. Un token est valide un an et reste
// verifiable longtemps apres qu'un medecin a coupe l'acces ; c'est pourquoi le
// code porteur est relu a chaque requete. Le repository est un parametre
// obligatoire et non optionnel : un controle de securite qu'on peut oublier
// d'activer serait pire qu'absent.
export function requirePatientAuth(
  tokenProvider: TokenProvider,
  patientCodes: PatientSessionLookup,
): MiddlewareHandler<{ Variables: PatientSessionVariables }> {
  return async (c: Context<{ Variables: PatientSessionVariables }>, next: Next) => {
    const authHeader = c.req.header('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

    if (!token) {
      return c.json({ code: 'UNAUTHORIZED', message: 'Authentification patient requise' }, 401);
    }

    const payload = await tokenProvider.verify(token);

    if (!payload) {
      return c.json({ code: 'UNAUTHORIZED', message: 'Token invalide ou expire' }, 401);
    }

    // Une lecture par requete, sur la cle primaire. Un code absent est traite
    // comme revoque : mieux vaut refuser une session dont on ne peut plus
    // prouver la validite que la laisser passer par defaut.
    const patientCode = await patientCodes.findById(payload.uuid_patient_code);

    // Le rattachement code -> patient est verifie en plus du cycle de vie. Le
    // payload est signe, donc les deux champs concordent aujourd'hui ; mais si
    // un chemin d'emission signait un jour un couple incoherent, la session
    // survivrait a la revocation du bon patient. Une comparaison, aucun cout.
    if (
      !patientCode ||
      !canSustainSession(patientCode) ||
      patientCode.uuid_patient !== payload.uuid_patient
    ) {
      return c.json({ code: 'SESSION_REVOKED', message: 'Session revoquee' }, 401);
    }

    c.set('patientId', payload.uuid_patient);
    await next();
  };
}
