import type { MiddlewareHandler } from 'hono';
import type { SessionVariables } from '../src/features/auth/presentation/authRouter';

// SEC-04 : depuis que `alertRouter` et les routes d'emission de code exigent
// une session medecin, leurs tests doivent en fournir une. Ce stub simule Better
// Auth sans base de donnees ni reseau.
//
// `medecinAuthentifie()` laisse passer, `medecinAbsent()` refuse comme le ferait
// `requirePhysicianAuth` — meme code et meme message, pour que les tests de
// refus verifient la reponse reelle et pas une approximation.
const PHYSICIAN_ID = '99999999-9999-4999-8999-999999999999';

export function medecinAuthentifie(
  physicianId: string = PHYSICIAN_ID,
): MiddlewareHandler<{ Variables: SessionVariables }> {
  return async (c, next) => {
    c.set('user', { id: physicianId } as SessionVariables['user']);
    c.set('session', null);
    await next();
  };
}

export function medecinAbsent(): MiddlewareHandler<{ Variables: SessionVariables }> {
  return async (c) =>
    c.json({ code: 'UNAUTHORIZED', message: 'Authentification medecin requise' }, 401);
}
