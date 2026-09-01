import { describe, expect, test } from 'bun:test';
import { PatientCodeValue } from '@sauver-la-face/shared';
import { Hono } from 'hono';

import { AuthUsecase } from '../src/features/auth/application/authUsecase';
import type { TokenProvider } from '../src/features/auth/application/tokenProvider';
import type {
  PatientCode,
  PatientCodeRepository,
} from '../src/features/auth/domain/patientCodeRepository';
import { createAuthRouter } from '../src/features/auth/presentation/authRouter';

const patientId = '11111111-1111-4111-8111-111111111111';
const validCode = '123456';

class InMemoryPatientCodeRepository implements PatientCodeRepository {
  private readonly codes = new Map<string, PatientCode>();

  async save(patientCode: PatientCode): Promise<void> {
    this.codes.set(patientCode.uuid_patient_code, { ...patientCode });
  }

  async findById(uuid_patient_code: string): Promise<PatientCode | null> {
    const entry = this.codes.get(uuid_patient_code);
    return entry ? { ...entry } : null;
  }

  async findByCode(code: PatientCodeValue): Promise<PatientCode | null> {
    for (const entry of this.codes.values()) {
      if (entry.code.toString() === code.toString()) {
        return { ...entry };
      }
    }
    return null;
  }

  async findActiveByPatient(uuid_patient: string): Promise<PatientCode | null> {
    for (const entry of this.codes.values()) {
      if (
        entry.uuid_patient === uuid_patient &&
        entry.is_active &&
        entry.used_at === null &&
        entry.deleted_at === null &&
        entry.revoked_at === null
      ) {
        return { ...entry };
      }
    }
    return null;
  }

  async softDeleteExpiredUnused(_cutoff: Date): Promise<number> {
    return 0;
  }

  seed(code: PatientCode): void {
    this.codes.set(code.uuid_patient_code, { ...code });
  }
}

const fakeTokenProvider: TokenProvider = {
  sign: async () => 'fake-jwt-token',
  // Non sollicite par authRouter (login/generation uniquement), mais le
  // contrat TokenProvider impose les deux methodes. null = token invalide.
  verify: async () => null,
};

function createTestApp(seed?: PatientCode) {
  const repository = new InMemoryPatientCodeRepository();
  if (seed) {
    repository.seed(seed);
  }
  const usecase = new AuthUsecase(repository, fakeTokenProvider);
  const router = createAuthRouter(usecase);
  const app = new Hono();
  app.route('/', router);
  return app;
}

function makeActiveCode(overrides: Partial<PatientCode> = {}): PatientCode {
  return {
    uuid_patient_code: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    uuid_patient: patientId,
    code: PatientCodeValue.create(validCode),
    created_at: new Date(),
    used_at: null,
    deleted_at: null,
    is_active: true,
    revoked_at: null,
    ...overrides,
  };
}

// Chaque test utilise une IP distincte pour éviter les interférences du rate limiter
// (l'état ipFailures est module-level dans authRouter.ts)
let ipCounter = 0;
function nextIp(): Record<string, string> {
  ipCounter += 1;
  return { 'x-forwarded-for': `10.0.0.${ipCounter}`, 'content-type': 'application/json' };
}

describe('authRouter — patient endpoints', () => {
  describe('POST /patient/validate', () => {
    test('retourne 200 et un token pour un code valide', async () => {
      const app = createTestApp(makeActiveCode());

      const response = await app.request('/patient/validate', {
        method: 'POST',
        headers: nextIp(),
        body: JSON.stringify({ code: validCode }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect(body.token).toBe('fake-jwt-token');
    });

    test('retourne 401 pour un code inexistant', async () => {
      const app = createTestApp();

      const response = await app.request('/patient/validate', {
        method: 'POST',
        headers: nextIp(),
        body: JSON.stringify({ code: '999999' }),
      });

      expect(response.status).toBe(401);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.success).toBe(false);
    });

    test('retourne 401 pour un code expiré', async () => {
      const app = createTestApp(
        makeActiveCode({ created_at: new Date('2020-01-01T00:00:00.000Z') }),
      );

      const response = await app.request('/patient/validate', {
        method: 'POST',
        headers: nextIp(),
        body: JSON.stringify({ code: validCode }),
      });

      expect(response.status).toBe(401);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.error).toBe('EXPIRED_CODE');
    });

    test('retourne 401 pour un code supprimé', async () => {
      const app = createTestApp(makeActiveCode({ deleted_at: new Date() }));

      const response = await app.request('/patient/validate', {
        method: 'POST',
        headers: nextIp(),
        body: JSON.stringify({ code: validCode }),
      });

      expect(response.status).toBe(401);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.error).toBe('DELETED_CODE');
    });

    test('retourne 400 pour un payload invalide', async () => {
      const app = createTestApp();

      const response = await app.request('/patient/validate', {
        method: 'POST',
        headers: nextIp(),
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /patient/generate', () => {
    test('retourne 201 avec le code généré', async () => {
      const app = createTestApp();

      const response = await app.request('/patient/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ uuid_patient: patientId }),
      });

      expect(response.status).toBe(201);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.uuid_patient).toBe(patientId);
      expect(typeof body.code).toBe('object');
    });

    test('retourne 400 si uuid_patient n est pas un UUID', async () => {
      const app = createTestApp();

      const response = await app.request('/patient/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ uuid_patient: 'pas-un-uuid' }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /patient/renew', () => {
    test('retourne 201 avec le nouveau code', async () => {
      const app = createTestApp(makeActiveCode());

      const response = await app.request('/patient/renew', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ uuid_patient: patientId }),
      });

      expect(response.status).toBe(201);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.uuid_patient).toBe(patientId);
    });

    test('retourne 400 si uuid_patient est absent', async () => {
      const app = createTestApp();

      const response = await app.request('/patient/renew', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
    });
  });
});
