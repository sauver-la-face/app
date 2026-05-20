import { auth } from '../infrastructure/authConfig';

// Récupère la session courante depuis les headers de la requête.
// Utilisé par les autres features pour protéger leurs routes.
export const getSession = (headers: Headers) => auth.api.getSession({ headers });

// Vérifie qu'une session est active et retourne user + session, ou null.
export const requireSession = async (headers: Headers) => {
  const session = await auth.api.getSession({ headers });
  return session ?? null;
};
