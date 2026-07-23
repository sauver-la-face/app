import { describe, expect, test } from 'bun:test';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { MiddlewareHandler } from 'hono';

import type { SessionVariables } from '../src/features/auth/presentation/authRouter';
import { PatientUsecase } from '../src/features/patients/application/patientUsecase';
import { InMemoryPatientsRepository } from '../src/features/patients/infrastructure/patientRepository';
import { createPatientRouter } from '../src/features/patients/presentation/patientRouter';

// Middleware de test : simule une session medecin authentifiee sans dependre
// de Better Auth / d'une base de donnees.
function fakeAuthAs(
  physicianId: string | null,
): MiddlewareHandler<{ Variables: SessionVariables }> {
  return async (c, next) => {
    if (!physicianId) {
      return c.json({ code: 'UNAUTHORIZED' }, 401);
    }
    c.set('user', { id: physicianId } as SessionVariables['user']);
    c.set('session', null);
    await next();
  };
}

function createTestApp(authMiddleware: MiddlewareHandler<{ Variables: SessionVariables }>) {
  const repository = new InMemoryPatientsRepository();
  const usecase = new PatientUsecase(repository);
  const app = new OpenAPIHono<{ Variables: SessionVariables }>();
  app.route('/', createPatientRouter(usecase, authMiddleware));
  return app;
}

describe('patients.router (SEC-01/A01 : authentification medecin obligatoire)', () => {
  test('401 sur GET /patients si aucune session medecin', async () => {
    const app = createTestApp(fakeAuthAs(null));

    const response = await app.request('/patients');

    expect(response.status).toBe(401);
  });

  test('200 sur GET /patients pour tout medecin authentifie (equipe partagee)', async () => {
    const app = createTestApp(fakeAuthAs('99999999-9999-4999-8999-999999999999'));

    const response = await app.request('/patients');

    expect(response.status).toBe(200);
  });
});
