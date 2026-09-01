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

  const user = c.get('user');

  if (!user) {
    return c.json({ code: 'UNAUTHORIZED', message: 'Authentification medecin requise' }, 401);
  }

  // AUTH-02 : le second facteur est obligatoire pour acceder aux donnees de
  // sante. Le controle vit ici et non dans le dashboard : une garde posee
  // uniquement cote navigateur se contourne en appelant l'API directement,
  // exactement le defaut corrige par SEC-01.
  //
  // 403 et non 401 : la session est valide, c'est le compte qui n'est pas
  // conforme. Le client doit orienter vers l'enrolement, pas vers la connexion.
  //
  // Les routes d'enrolement (/api/auth/two-factor/*) sont servies par
  // authRouter, qui ne monte pas ce gardien : un medecin non enrole peut donc
  // toujours s'enroler.
  if (!user.twoFactorEnabled) {
    return c.json(
      {
        code: 'MFA_REQUIRED',
        message: 'Authentification a deux facteurs requise pour acceder aux donnees patient',
      },
      403,
    );
  }

  await next();
};
