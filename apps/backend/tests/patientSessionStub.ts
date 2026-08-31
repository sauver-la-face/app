import type { PatientCode } from '../src/features/auth/domain/patientCodeRepository';
import type { PatientSessionLookup } from '../src/shared/middleware/patientAuthMiddleware';

// SEC-03 : depuis que `requirePatientAuth` relit le code porteur a chaque
// requete, tout test de router doit lui fournir une source. Ce stub rend une
// session toujours vivante : les tests de routers verifient le routage et
// l'appartenance, la revocation elle-meme est couverte par
// patientAuthMiddleware.test.ts.
//
// Le middleware ne lit que `deleted_at` et `revoked_at`, et pose `patientId`
// depuis le payload du token - jamais depuis ce code. Les autres champs sont
// donc du remplissage conforme au type.
export function sessionVivante(): PatientSessionLookup {
  return {
    findById: async (uuid_patient_code: string): Promise<PatientCode> => ({
      uuid_patient_code,
      uuid_patient: '00000000-0000-4000-8000-000000000000',
      code: { toString: () => '000000' } as PatientCode['code'],
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      used_at: new Date('2026-01-01T00:00:00.000Z'),
      deleted_at: null,
      is_active: true,
      revoked_at: null,
    }),
  };
}
