import type { Context, MiddlewareHandler, Next } from 'hono';

import {
  type SessionVariables,
  sessionMiddleware,
} from '../../features/auth/presentation/authRouter';

// SEC-01/A01 : gardien d'authentification pour les routes reservees aux medecins
// (dashboard web). Rejette en 401 toute requete sans session Better Auth valide.
// L'equipe de Toulouse suit collectivement les memes patients (pas de
// patientele privee par medecin) - aucun controle d'appartenance par
// ressource ici, volontairement. Si un jour plusieurs equipes distinctes
// doivent partager la plateforme sans se voir, prevoir une table de liaison
// patient<->medecin (many-to-many) plutot qu'un scoping par proprietaire unique.
export const requirePhysicianAuth: MiddlewareHandler<{ Variables: SessionVariables }> = async (
  c: Context<{ Variables: SessionVariables }>,
  next: Next,
) => {
  await sessionMiddleware(c, async () => {});

  if (!c.get('user')) {
    return c.json({ code: 'UNAUTHORIZED', message: 'Authentification medecin requise' }, 401);
  }

  await next();
};
