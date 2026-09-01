import { describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import type { PatientCode } from '../src/features/auth/domain/patientCodeRepository';
import { JwtTokenProvider } from '../src/features/auth/infrastructure/jwtTokenProvider';
import {
  type PatientSessionVariables,
  requirePatientAuth,
} from '../src/shared/middleware/patientAuthMiddleware';

const SECRET = 'secret-de-test-sec-03';
const PATIENT_ID = '11111111-1111-4111-8111-111111111111';
const CODE_ID = '22222222-2222-4222-8222-222222222222';

function codeFixture(overrides: Partial<PatientCode> = {}): PatientCode {
  return {
    uuid_patient_code: CODE_ID,
    uuid_patient: PATIENT_ID,
    // Le middleware ne lit jamais la valeur du code, seulement son cycle de vie.
    code: { toString: () => '123456' } as PatientCode['code'],
    created_at: new Date('2026-08-01T00:00:00.000Z'),
    used_at: new Date('2026-08-01T00:05:00.000Z'),
    deleted_at: null,
    is_active: true,
    revoked_at: null,
    ...overrides,
  };
}

function buildApp(storedCode: PatientCode | null) {
  const tokenProvider = new JwtTokenProvider(SECRET);
  const repository = {
    findById: async (uuid: string) =>
      storedCode && storedCode.uuid_patient_code === uuid ? storedCode : null,
  };

  const app = new Hono<{ Variables: PatientSessionVariables }>();
  app.use('/protege', requirePatientAuth(tokenProvider, repository));
  app.get('/protege', (context) => context.json({ patientId: context.get('patientId') }, 200));

  return { app, tokenProvider };
}

async function appeler(app: Hono<{ Variables: PatientSessionVariables }>, token?: string) {
  return app.request('/protege', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

describe('requirePatientAuth — revocation de session (SEC-03)', () => {
  test('refuse une requete sans token', async () => {
    const { app } = buildApp(codeFixture());

    const response = await appeler(app);

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  test('refuse un token signe avec un autre secret', async () => {
    const { app } = buildApp(codeFixture());
    const intrus = await new JwtTokenProvider('autre-secret').sign({
      uuid_patient: PATIENT_ID,
      uuid_patient_code: CODE_ID,
      role: 'patient',
    });

    const response = await appeler(app, intrus);

    expect(response.status).toBe(401);
  });

  test('accepte un token dont le code porteur est toujours vivant', async () => {
    const { app, tokenProvider } = buildApp(codeFixture());
    const token = await tokenProvider.sign({
      uuid_patient: PATIENT_ID,
      uuid_patient_code: CODE_ID,
      role: 'patient',
    });

    const response = await appeler(app, token);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ patientId: PATIENT_ID });
  });

  test('refuse un token dont le code porteur a ete revoque', async () => {
    const { app, tokenProvider } = buildApp(
      codeFixture({ revoked_at: new Date('2026-08-31T12:00:00.000Z') }),
    );
    const token = await tokenProvider.sign({
      uuid_patient: PATIENT_ID,
      uuid_patient_code: CODE_ID,
      role: 'patient',
    });

    const response = await appeler(app, token);

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'SESSION_REVOKED' });
  });

  test('refuse un token dont le code porteur a ete supprime', async () => {
    const { app, tokenProvider } = buildApp(
      codeFixture({ deleted_at: new Date('2026-08-31T12:00:00.000Z') }),
    );
    const token = await tokenProvider.sign({
      uuid_patient: PATIENT_ID,
      uuid_patient_code: CODE_ID,
      role: 'patient',
    });

    const response = await appeler(app, token);

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'SESSION_REVOKED' });
  });

  test('refuse un token dont le code porteur appartient a un autre patient', async () => {
    const { app, tokenProvider } = buildApp(
      codeFixture({ uuid_patient: '99999999-9999-4999-8999-999999999999' }),
    );
    const token = await tokenProvider.sign({
      uuid_patient: PATIENT_ID,
      uuid_patient_code: CODE_ID,
      role: 'patient',
    });

    const response = await appeler(app, token);

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'SESSION_REVOKED' });
  });

  test('refuse un token dont le code porteur nexiste plus en base', async () => {
    const { app, tokenProvider } = buildApp(null);
    const token = await tokenProvider.sign({
      uuid_patient: PATIENT_ID,
      uuid_patient_code: CODE_ID,
      role: 'patient',
    });

    const response = await appeler(app, token);

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'SESSION_REVOKED' });
  });
});
