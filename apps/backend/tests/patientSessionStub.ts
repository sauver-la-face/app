import type { PatientCode } from '../src/features/auth/domain/patientCodeRepository';
import type { PatientSessionLookup } from '../src/shared/middleware/patientAuthMiddleware';

// SEC-03 : depuis que `requirePatientAuth` relit le code porteur a chaque
// requete, tout test de router doit lui fournir une source. Ce stub rend une
// session toujours vivante : les tests de routers verifient le routage et
// l'appartenance, la revocation elle-meme est couverte par
// patientAuthMiddleware.test.ts.
//
// Le middleware verifie aussi que le code appartient bien au patient du
// payload. Convention de test : l'identifiant du code encode son proprietaire
// (`code:<uuid_patient>`), ce qui reproduit l'invariant reel - un code
// n'appartient qu'a un seul patient - avec un stub unique, quel que soit le
// patient du token. Les autres champs sont du remplissage conforme au type.
export function sessionVivante(): PatientSessionLookup {
  return {
    findById: async (uuid_patient_code: string): Promise<PatientCode> => ({
      uuid_patient_code,
      uuid_patient: uuid_patient_code.startsWith('code:')
        ? uuid_patient_code.slice('code:'.length)
        : uuid_patient_code,
      code: { toString: () => '000000' } as PatientCode['code'],
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      used_at: new Date('2026-01-01T00:00:00.000Z'),
      deleted_at: null,
      is_active: true,
      revoked_at: null,
    }),
  };
}
