import { describe, expect, test } from 'bun:test';
import { OpenAPIHono } from '@hono/zod-openapi';

import { JwtTokenProvider } from '../src/features/auth/infrastructure/jwtTokenProvider';
import { SyncUsecase } from '../src/features/sync/application/syncUsecase';
import { InMemorySyncRepository } from '../src/features/sync/infrastructure/syncRepository';
import { createSyncRouter } from '../src/features/sync/presentation/syncRouter';
import type { PatientSessionVariables } from '../src/shared/middleware/patientAuthMiddleware';

const patientId = '55555555-5555-4555-8555-555555555555';
const otherPatientId = '66666666-6666-4666-8666-666666666666';
const tokenProvider = new JwtTokenProvider('test-secret');

async function patientToken(uuid_patient: string): Promise<string> {
  return tokenProvider.sign({
    uuid_patient,
    uuid_patient_code: 'code-id',
    role: 'patient',
  });
}

function createTestApp() {
  const repository = new InMemorySyncRepository();
  const usecase = new SyncUsecase(repository, { info: () => undefined, warn: () => undefined }, 1);
  const app = new OpenAPIHono<{ Variables: PatientSessionVariables }>();
  app.route('/', createSyncRouter(usecase, tokenProvider));
  return app;
}

function syncPayload(overridePatientId: string) {
  return {
    patientId: overridePatientId,
    schemaVersion: 1,
    medicalEventSymptoms: [],
    media: [],
    instructionAcknowledgements: [],
  };
}

describe('sync.router POST /sync (SEC-02/A01/A07)', () => {
  test('401 sans token patient', async () => {
    const app = createTestApp();

    const response = await app.request('/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(syncPayload(patientId)),
    });

    expect(response.status).toBe(401);
  });

  test('403 si le patientId du payload ne correspond pas au token', async () => {
    const app = createTestApp();
    const token = await patientToken(otherPatientId);

    const response = await app.request('/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(syncPayload(patientId)),
    });

    expect(response.status).toBe(403);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.code).toBe('PATIENT_MISMATCH');
  });

  test('200 si le patientId du payload correspond au token', async () => {
    const app = createTestApp();
    const token = await patientToken(patientId);

    const response = await app.request('/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(syncPayload(patientId)),
    });

    expect(response.status).toBe(200);
  });
});
