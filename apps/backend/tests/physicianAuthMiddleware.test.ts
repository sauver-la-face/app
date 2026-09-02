import { describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import type { SessionVariables } from '../src/features/auth/presentation/authRouter';
import { createRequirePhysicianAuth } from '../src/shared/middleware/physicianAuthMiddleware';

// Ce gardien n'etait couvert par aucun test : les routers acceptent un
// middleware injectable et les suites fournissaient un double, si bien que
// l'implementation reelle n'etait jamais exercee. C'est l'angle mort qui avait
// laisse passer SEC-01, ou aucune authentification n'etait montee sur les
// routes servant les dossiers patients.

type Utilisateur = { id: string; twoFactorEnabled?: boolean | null } | null;

/**
 * Monte une route protegee derriere le gardien, en injectant une resolution de
 * session simulee. Aucune dependance a Better Auth ni a la base.
 */
function construireApp(utilisateur: Utilisateur) {
  const resolveSession = async (
    c: { set: (key: string, value: unknown) => void },
    next: () => Promise<void>,
  ) => {
    c.set('user', utilisateur);
    c.set('session', utilisateur ? { id: 'session-de-test' } : null);
    await next();
  };

  const app = new Hono<{ Variables: SessionVariables }>();
  app.use('/patients', createRequirePhysicianAuth(resolveSession as never));
  app.get('/patients', (c) => c.json({ patients: [] }, 200));

  return app;
}

describe('requirePhysicianAuth', () => {
  test('refuse en 401 une requete sans session', async () => {
    const reponse = await construireApp(null).request('/patients');

    expect(reponse.status).toBe(401);
    expect(await reponse.json()).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  test('refuse en 403 un medecin authentifie mais sans second facteur', async () => {
    const reponse = await construireApp({
      id: 'medecin-1',
      twoFactorEnabled: false,
    }).request('/patients');

    // 403 et non 401 : la session est valide, c'est le compte qui n'est pas
    // conforme. Le client doit orienter vers l'enrolement, pas vers la connexion.
    expect(reponse.status).toBe(403);
    expect(await reponse.json()).toMatchObject({ code: 'MFA_REQUIRED' });
  });

  test('refuse egalement quand le second facteur est absent du profil', async () => {
    // Un compte anterieur a AUTH-02 peut ne rien porter du tout : l'absence doit
    // etre traitee comme une non-conformite, jamais comme une autorisation.
    const reponse = await construireApp({ id: 'medecin-ancien' }).request('/patients');

    expect(reponse.status).toBe(403);
    expect(await reponse.json()).toMatchObject({ code: 'MFA_REQUIRED' });
  });

  test('refuse quand le second facteur vaut null en base', async () => {
    const reponse = await construireApp({
      id: 'medecin-null',
      twoFactorEnabled: null,
    }).request('/patients');

    expect(reponse.status).toBe(403);
  });

  test('laisse passer un medecin enrole', async () => {
    const reponse = await construireApp({
      id: 'medecin-conforme',
      twoFactorEnabled: true,
    }).request('/patients');

    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({ patients: [] });
  });
});
