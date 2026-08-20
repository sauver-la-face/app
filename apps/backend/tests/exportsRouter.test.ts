import { describe, expect, test } from 'bun:test';
import type { MiddlewareHandler } from 'hono';
import { Hono } from 'hono';

import type { SessionVariables } from '../src/features/auth/presentation/authRouter';
import { ExportsUsecase } from '../src/features/exports/application/exportsUsecase';
import type { PatientExportData } from '../src/features/exports/domain/exportsDomain';
import type { ExportsRepository } from '../src/features/exports/domain/exportsRepository';
import type { PdfReportGenerator } from '../src/features/exports/domain/pdfReportGenerator';
import { createExportsRouter } from '../src/features/exports/presentation/exportsRouter';

const patientId = '11111111-1111-4111-8111-111111111111';
const unknownId = '99999999-9999-4999-8999-999999999999';
const physicianId = '22222222-2222-4222-8222-222222222222';
const now = new Date('2026-06-22T10:00:00.000Z');

const samplePatient: PatientExportData = {
  patientId,
  firstName: 'Sok',
  lastName: 'Chan',
  sex: 'F',
  birthdate: '1990-03-12',
  region: 'Phnom Penh',
  anonymizedAt: null,
  lastSyncedAt: '2026-06-01T00:00:00.000Z',
  procedures: [],
  events: [],
  media: [],
  instructions: [],
};

class InMemoryExportsRepository implements ExportsRepository {
  constructor(private readonly patients: PatientExportData[] = []) {}

  async findPatientExportById(id: string): Promise<PatientExportData | null> {
    return this.patients.find((p) => p.patientId === id) ?? null;
  }

  async listAllPatientsForExport(): Promise<PatientExportData[]> {
    return this.patients;
  }
}

class FakePdfGenerator implements PdfReportGenerator {
  async generatePatientReport(_patient: PatientExportData): Promise<Uint8Array> {
    return new Uint8Array([37, 80, 68, 70]); // %PDF
  }
}

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
  patients: PatientExportData[] = [samplePatient],
  authMiddleware: MiddlewareHandler<{ Variables: SessionVariables }> = fakeAuthAs(physicianId),
) {
  const repository = new InMemoryExportsRepository(patients);
  const pdfGenerator = new FakePdfGenerator();
  const usecase = new ExportsUsecase(repository, pdfGenerator, () => now);
  const app = new Hono<{ Variables: SessionVariables }>();
  app.route('/', createExportsRouter(usecase, authMiddleware));
  return app;
}

describe('exports.router', () => {
  describe('SEC-01/A01 — authentification medecin obligatoire', () => {
    test('retourne 401 sur GET /exports/patients.csv si aucune session médecin', async () => {
      const app = createTestApp([samplePatient], fakeAuthAs(null));

      const response = await app.request('/exports/patients.csv');

      expect(response.status).toBe(401);
    });

    test('retourne 200 sur GET /exports/patients.csv pour tout médecin authentifié', async () => {
      const app = createTestApp([samplePatient], fakeAuthAs(physicianId));

      const response = await app.request('/exports/patients.csv');

      expect(response.status).toBe(200);
    });

    test("retourne 401 sur l'export PDF sans session médecin", async () => {
      const app = createTestApp([samplePatient], fakeAuthAs(null));

      const response = await app.request(`/exports/patients/${patientId}/pdf`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /exports/patients/:patientId/pdf', () => {
    test('retourne 200 avec Content-Type application/pdf pour un patient connu', async () => {
      const app = createTestApp();

      const response = await app.request(`/exports/patients/${patientId}/pdf`);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/pdf');
      expect(response.headers.get('Content-Disposition')).toContain(`patient-${patientId}.pdf`);
    });

    test('retourne 404 pour un patient inconnu', async () => {
      const app = createTestApp();

      const response = await app.request(`/exports/patients/${unknownId}/pdf`);

      expect(response.status).toBe(404);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.code).toBe('PATIENT_NOT_FOUND');
    });

    test("retourne 400 si patientId n'est pas un UUID", async () => {
      const app = createTestApp();

      const response = await app.request('/exports/patients/not-a-uuid/pdf');

      expect(response.status).toBe(400);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /exports/patients.csv', () => {
    test('retourne 200 avec Content-Type text/csv et headers CSV', async () => {
      const app = createTestApp();

      const response = await app.request('/exports/patients.csv');

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('text/csv');
      expect(response.headers.get('Content-Disposition')).toContain('patients-anonymized-');

      const text = await response.text();
      expect(text).toContain('patient_id');
      expect(text).toContain(patientId);
    });

    test('retourne un CSV vide (juste headers) quand aucun patient', async () => {
      const app = createTestApp([]);

      const response = await app.request('/exports/patients.csv');

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe(
        'patient_id,sex,region,anonymized_at,last_synced_at,procedures_count,events_count,alert_events_count',
      );
    });
  });

  describe('GET /exports/patients/:patientId/json', () => {
    test('retourne 200 avec le JSON de portabilité pour un patient connu', async () => {
      const app = createTestApp();

      const response = await app.request(`/exports/patients/${patientId}/json`);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('application/json');
      expect(response.headers.get('Content-Disposition')).toContain(
        `patient-${patientId}-portability.json`,
      );

      const body = JSON.parse(await response.text()) as Record<string, unknown>;
      expect(body.$schema).toBe('sauver-la-face/portability/v1');
      expect(body.generatedAt).toBe(now.toISOString());
    });

    test('retourne 404 pour un patient inconnu', async () => {
      const app = createTestApp();

      const response = await app.request(`/exports/patients/${unknownId}/json`);

      expect(response.status).toBe(404);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.code).toBe('PATIENT_NOT_FOUND');
    });

    test("retourne 400 si patientId n'est pas un UUID", async () => {
      const app = createTestApp();

      const response = await app.request('/exports/patients/not-a-uuid/json');

      expect(response.status).toBe(400);
    });
  });
});
