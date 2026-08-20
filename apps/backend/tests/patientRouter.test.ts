import { describe, expect, mock, test } from 'bun:test';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { MiddlewareHandler } from 'hono';

import type { SessionVariables } from '../src/features/auth/presentation/authRouter';
import { PatientUsecase } from '../src/features/patients/application/patientUsecase';
import {
  InMemoryPatientsRepository,
  type PatientPersistenceRecord,
} from '../src/features/patients/infrastructure/patientRepository';
import { createPatientRouter } from '../src/features/patients/presentation/patientRouter';

const patientId = '11111111-1111-4111-8111-111111111111';
const unknownId = '99999999-9999-4999-8999-999999999999';
const physicianId = '22222222-2222-4222-8222-222222222222';
const now = new Date('2026-06-22T10:00:00.000Z');
const silentLogger = { info: mock(() => undefined), warn: mock(() => undefined) };

const existingPatient: PatientPersistenceRecord = {
  patientId,
  firstName: 'Sok',
  lastName: 'Chan',
  sex: 'F',
  birthdate: '1990-03-12',
  region: 'Phnom Penh',
  anonymizedAt: null,
  lastSyncedAt: null,
};

// Middleware de test : simule une session medecin authentifiee sans dependre
// de Better Auth / d'une base de donnees.
function fakeAuthAs(
  authenticatedPhysicianId: string | null,
): MiddlewareHandler<{ Variables: SessionVariables }> {
  return async (c, next) => {
    if (!authenticatedPhysicianId) {
      return c.json({ code: 'UNAUTHORIZED' }, 401);
    }
    c.set('user', { id: authenticatedPhysicianId } as SessionVariables['user']);
    c.set('session', null);
    await next();
  };
}

function createTestApp(
  seed: PatientPersistenceRecord[] = [],
  authMiddleware: MiddlewareHandler<{ Variables: SessionVariables }> = fakeAuthAs(physicianId),
) {
  const repository = new InMemoryPatientsRepository({ patients: seed });
  const usecase = new PatientUsecase(
    repository,
    silentLogger,
    () => now,
    () => '654321',
  );
  const app = new OpenAPIHono<{ Variables: SessionVariables }>();
  app.route('/', createPatientRouter(usecase, authMiddleware));
  return app;
}

describe('patients.router', () => {
  describe('SEC-01/A01 — authentification medecin obligatoire', () => {
    test('retourne 401 sur GET /patients si aucune session médecin', async () => {
      const app = createTestApp([existingPatient], fakeAuthAs(null));

      const response = await app.request('/patients');

      expect(response.status).toBe(401);
    });

    test('retourne 200 sur GET /patients pour tout médecin authentifié (équipe partagée)', async () => {
      const app = createTestApp([existingPatient], fakeAuthAs(physicianId));

      const response = await app.request('/patients');

      expect(response.status).toBe(200);
    });

    test('retourne 401 sur une route imbriquée sans session médecin', async () => {
      const app = createTestApp([existingPatient], fakeAuthAs(null));

      const response = await app.request(`/patients/${patientId}/history`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /patients', () => {
    test('retourne 200 avec la liste des patients', async () => {
      const app = createTestApp([existingPatient]);

      const response = await app.request('/patients');

      expect(response.status).toBe(200);
      const body = (await response.json()) as { patients: unknown[] };
      expect(body.patients).toHaveLength(1);
    });

    test('retourne 200 avec une liste vide', async () => {
      const app = createTestApp();

      const response = await app.request('/patients');

      expect(response.status).toBe(200);
      const body = (await response.json()) as { patients: unknown[] };
      expect(body.patients).toHaveLength(0);
    });
  });

  describe('POST /patients', () => {
    test('retourne 201 avec le patient créé', async () => {
      const app = createTestApp();

      const response = await app.request('/patients', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          firstName: 'Dara',
          lastName: 'Pich',
          sex: 'M',
          birthdate: '1985-07-20',
          region: 'Siem Reap',
        }),
      });

      expect(response.status).toBe(201);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.firstName).toBe('Dara');
      expect(body.lastName).toBe('Pich');
      expect(typeof body.patientId).toBe('string');
    });

    test('retourne 400 si le payload est invalide', async () => {
      const app = createTestApp();

      const response = await app.request('/patients', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ firstName: '' }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /patients/:patientId', () => {
    test('retourne 200 avec les détails du patient', async () => {
      const app = createTestApp([existingPatient]);

      const response = await app.request(`/patients/${patientId}`);

      expect(response.status).toBe(200);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.patientId).toBe(patientId);
      expect(body.firstName).toBe('Sok');
    });

    test('retourne 404 pour un patient inconnu', async () => {
      const app = createTestApp();

      const response = await app.request(`/patients/${unknownId}`);

      expect(response.status).toBe(404);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.code).toBe('PATIENT_NOT_FOUND');
    });
  });

  describe('GET /patients/:patientId/history', () => {
    test('retourne 200 avec un historique vide pour un patient sans données', async () => {
      const app = createTestApp([existingPatient]);

      const response = await app.request(`/patients/${patientId}/history`);

      expect(response.status).toBe(200);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.patient).toBeDefined();
      expect(body.procedures).toEqual([]);
      expect(body.events).toEqual([]);
    });

    test('retourne 404 pour un patient inconnu', async () => {
      const app = createTestApp();

      const response = await app.request(`/patients/${unknownId}/history`);

      expect(response.status).toBe(404);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.code).toBe('PATIENT_NOT_FOUND');
    });
  });

  describe('PATCH /patients/:patientId', () => {
    test('retourne 200 avec le patient mis à jour', async () => {
      const app = createTestApp([existingPatient]);

      const response = await app.request(`/patients/${patientId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ firstName: 'SokUpdated' }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.firstName).toBe('SokUpdated');
    });

    test('retourne 404 pour un patient inconnu', async () => {
      const app = createTestApp();

      const response = await app.request(`/patients/${unknownId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ firstName: 'Test' }),
      });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /patients/:patientId/access-code', () => {
    test("retourne 201 avec le code d'accès généré", async () => {
      const app = createTestApp([existingPatient]);

      const response = await app.request(`/patients/${patientId}/access-code`, {
        method: 'POST',
      });

      expect(response.status).toBe(201);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.patientId).toBe(patientId);
      expect(body.code).toBe('654321');
      expect(body.status).toBe('active');
    });

    test('retourne 404 pour un patient inconnu', async () => {
      const app = createTestApp();

      const response = await app.request(`/patients/${unknownId}/access-code`, {
        method: 'POST',
      });

      expect(response.status).toBe(404);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.code).toBe('PATIENT_NOT_FOUND');
    });
  });
});
