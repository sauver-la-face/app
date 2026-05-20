import { describe, expect, test } from 'bun:test';
import { Hono } from 'hono';

import { InstructionsUsecase } from '../src/features/instructions/application/instructionsUsecase';
import { InMemoryInstructionRepository } from '../src/features/instructions/infrastructure/instructionRepository';
import { createInstructionsRouter } from '../src/features/instructions/presentation/instructionsRouter';

const physicianId = '11111111-1111-4111-8111-111111111111';
const medicalProcedureId = '22222222-2222-4222-8222-222222222222';
const patientId = '55555555-5555-4555-8555-555555555555';
const unknownProcedureId = '99999999-9999-4999-8999-999999999999';
const silentLogger = { info: () => undefined, warn: () => undefined };
const now = new Date('2026-05-20T12:00:00.000Z');

function createTestApp(seed: ConstructorParameters<typeof InMemoryInstructionRepository>[0] = {}) {
  const repository = new InMemoryInstructionRepository({
    procedures: [{ medicalProcedureId, patientId }],
    ...seed,
  });
  const usecase = new InstructionsUsecase(repository, silentLogger, () => now);
  const app = new Hono();
  app.route('/', createInstructionsRouter(usecase));
  return { app, repository };
}

describe('instructions.router', () => {
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

  test('GET /patients/:patientId/instructions retourne 200 avec la liste', async () => {
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

    const response = await app.request(`/patients/${patientId}/instructions`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { instructions: unknown[] };
    expect(body.instructions).toHaveLength(1);
  });

  test('POST /instructions/:id/acknowledge retourne 200 et positionne acknowledgedAt', async () => {
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

    const response = await app.request(`/instructions/${instructionId}/acknowledge`, {
      method: 'POST',
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.acknowledgedAt).toBe(now.toISOString());
  });

  test('POST /instructions/:id/acknowledge retourne 404 si introuvable', async () => {
    const { app } = createTestApp();

    const response = await app.request(
      '/instructions/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/acknowledge',
      { method: 'POST' },
    );

    expect(response.status).toBe(404);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.code).toBe('INSTRUCTION_NOT_FOUND');
  });
});
