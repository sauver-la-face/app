import type { Context, MiddlewareHandler, Next } from 'hono';

import type { TokenProvider } from '../../features/auth/application/tokenProvider';

export type PatientSessionVariables = {
  patientId: string | null;
};

// SEC-02/A01/A07 : gardien d'authentification pour les routes mobile (patient).
// Factory car depend du TokenProvider injecte (secret JWT) - contrairement a
// requirePhysicianAuth qui s'appuie sur le singleton Better Auth global.
export function requirePatientAuth(
  tokenProvider: TokenProvider,
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

    c.set('patientId', payload.uuid_patient);
    await next();
  };
}
