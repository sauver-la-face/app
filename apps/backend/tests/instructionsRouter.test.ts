import { describe, expect, test } from 'bun:test';
import type { MiddlewareHandler } from 'hono';
import { Hono } from 'hono';

import { JwtTokenProvider } from '../src/features/auth/infrastructure/jwtTokenProvider';
import type { SessionVariables } from '../src/features/auth/presentation/authRouter';
import { InstructionsUsecase } from '../src/features/instructions/application/instructionsUsecase';
import { InMemoryInstructionRepository } from '../src/features/instructions/infrastructure/instructionRepository';
import { createInstructionsRouter } from '../src/features/instructions/presentation/instructionsRouter';
import type { PatientSessionVariables } from '../src/shared/middleware/patientAuthMiddleware';
import { sessionVivante } from './patientSessionStub';

const physicianId = '11111111-1111-4111-8111-111111111111';
const medicalProcedureId = '22222222-2222-4222-8222-222222222222';
const patientId = '55555555-5555-4555-8555-555555555555';
const otherPatientId = '66666666-6666-4666-8666-666666666666';
const unknownProcedureId = '99999999-9999-4999-8999-999999999999';
const silentLogger = { info: () => undefined, warn: () => undefined };
const now = new Date('2026-05-20T12:00:00.000Z');
const tokenProvider = new JwtTokenProvider('test-secret');

// Middleware de test : simule une session medecin authentifiee sans dependre
// de Better Auth / d'une base de donnees.
function fakePhysicianAuth(): MiddlewareHandler<{
  Variables: SessionVariables & PatientSessionVariables;
}> {
  return async (c, next) => {
    c.set('user', { id: physicianId } as SessionVariables['user']);
    c.set('session', null);
    await next();
  };
}

async function patientToken(uuid_patient: string): Promise<string> {
  return tokenProvider.sign({
    uuid_patient,
    uuid_patient_code: `code:${uuid_patient}`,
    role: 'patient',
  });
}

function createTestApp(seed: ConstructorParameters<typeof InMemoryInstructionRepository>[0] = {}) {
  const repository = new InMemoryInstructionRepository({
    procedures: [{ medicalProcedureId, patientId }],
    ...seed,
  });
  const usecase = new InstructionsUsecase(repository, silentLogger, () => now);
  const app = new Hono<{ Variables: SessionVariables & PatientSessionVariables }>();
  app.route(
    '/',
    createInstructionsRouter(
      usecase,
      repository,
      tokenProvider,
      sessionVivante(),
      fakePhysicianAuth(),
    ),
  );
  return { app, repository };
}

describe('instructions.router', () => {
  test('POST /instructions retourne 401 sans session medecin', async () => {
    const repository = new InMemoryInstructionRepository({
      procedures: [{ medicalProcedureId, patientId }],
    });
    const usecase = new InstructionsUsecase(repository, silentLogger, () => now);
    const app = new Hono<{ Variables: SessionVariables & PatientSessionVariables }>();
    app.route('/', createInstructionsRouter(usecase, repository, tokenProvider, sessionVivante()));

    const response = await app.request('/instructions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ medicalProcedureId, physicianId, content: 'x' }),
    });

    expect(response.status).toBe(401);
  });

  test('POST /instructions retourne 201 avec le DTO', async () => {
    const { app } = createTestApp();

    const response = await app.request('/instructions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        medicalProcedureId,
        physicianId,
        content: 'Garder la cicatrice propre.',
      }),
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.physicianId).toBe(physicianId);
    expect(body.medicalProcedureId).toBe(medicalProcedureId);
    expect(body.content).toBe('Garder la cicatrice propre.');
    expect(body.acknowledgedAt).toBeNull();
  });

  test('POST /instructions retourne 400 si le payload est invalide', async () => {
    const { app } = createTestApp();

    const response = await app.request('/instructions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ medicalProcedureId, physicianId, content: '' }),
    });

    expect(response.status).toBe(400);
  });

  test('POST /instructions retourne 404 si la procedure est inconnue', async () => {
    const { app } = createTestApp();

    const response = await app.request('/instructions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        medicalProcedureId: unknownProcedureId,
        physicianId,
        content: 'Hydrater la zone.',
      }),
    });

    expect(response.status).toBe(404);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.code).toBe('MEDICAL_PROCEDURE_NOT_FOUND');
  });

  test('GET /patients/:patientId/instructions retourne 401 sans token patient', async () => {
    const { app } = createTestApp();

    const response = await app.request(`/patients/${patientId}/instructions`);

    expect(response.status).toBe(401);
  });

  test('GET /patients/:patientId/instructions retourne 403 si le token appartient a un autre patient', async () => {
    const { app } = createTestApp();
    const token = await patientToken(otherPatientId);

    const response = await app.request(`/patients/${patientId}/instructions`, {
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(403);
  });

  test('GET /patients/:patientId/instructions retourne 200 avec la liste pour le bon patient', async () => {
    const { app } = createTestApp({
      instructions: [
        {
          instructionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          medicalProcedureId,
          physicianId,
          content: 'Premiere consigne',
          createdAt: new Date('2026-04-01T10:00:00Z'),
          acknowledgedAt: null,
        },
      ],
    });
    const token = await patientToken(patientId);

    const response = await app.request(`/patients/${patientId}/instructions`, {
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { instructions: unknown[] };
    expect(body.instructions).toHaveLength(1);
  });

  test('POST /instructions/:id/acknowledge retourne 403 si le token appartient a un autre patient', async () => {
    const instructionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const { app } = createTestApp({
      instructions: [
        {
          instructionId,
          medicalProcedureId,
          physicianId,
          content: 'Consigne',
          createdAt: new Date('2026-04-01T10:00:00Z'),
          acknowledgedAt: null,
        },
      ],
    });
    const token = await patientToken(otherPatientId);

    const response = await app.request(`/instructions/${instructionId}/acknowledge`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(403);
  });

  test('POST /instructions/:id/acknowledge retourne 200 et positionne acknowledgedAt pour le bon patient', async () => {
    const instructionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const { app } = createTestApp({
      instructions: [
        {
          instructionId,
          medicalProcedureId,
          physicianId,
          content: 'Consigne',
          createdAt: new Date('2026-04-01T10:00:00Z'),
          acknowledgedAt: null,
        },
      ],
    });
    const token = await patientToken(patientId);

    const response = await app.request(`/instructions/${instructionId}/acknowledge`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.acknowledgedAt).toBe(now.toISOString());
  });

  test('POST /instructions/:id/acknowledge retourne 403 pour instruction inconnue (proprietaire indetermine)', async () => {
    const { app } = createTestApp();
    const token = await patientToken(patientId);

    const response = await app.request(
      '/instructions/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/acknowledge',
      { method: 'POST', headers: { authorization: `Bearer ${token}` } },
    );

    expect(response.status).toBe(403);
  });
});
