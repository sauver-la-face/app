import { describe, expect, test } from 'bun:test';
import type { MiddlewareHandler } from 'hono';
import { Hono } from 'hono';

import type { SessionVariables } from '../src/features/auth/presentation/authRouter';
import { ExportsUsecase } from '../src/features/exports/application/exportsUsecase';
import type { PatientExportData } from '../src/features/exports/domain/exportsDomain';
import type { ExportsRepository } from '../src/features/exports/domain/exportsRepository';
import type { PdfReportGenerator } from '../src/features/exports/domain/pdfReportGenerator';
import { createExportsRouter } from '../src/features/exports/presentation/exportsRouter';

class EmptyExportsRepository implements ExportsRepository {
  async findPatientExportById(): Promise<PatientExportData | null> {
    return null;
  }

  async listAllPatientsForExport(): Promise<PatientExportData[]> {
    return [];
  }
}

class StubPdfReportGenerator implements PdfReportGenerator {
  async generatePatientReport(): Promise<Uint8Array> {
    return new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
  }
}

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
  const usecase = new ExportsUsecase(new EmptyExportsRepository(), new StubPdfReportGenerator());
  const app = new Hono<{ Variables: SessionVariables }>();
  app.route('/', createExportsRouter(usecase, authMiddleware));
  return app;
}

describe('exports.router (SEC-01/A01 : authentification medecin obligatoire)', () => {
  test('401 sur GET /exports/patients.csv si aucune session medecin', async () => {
    const app = createTestApp(fakeAuthAs(null));

    const response = await app.request('/exports/patients.csv');

    expect(response.status).toBe(401);
  });

  test('200 sur GET /exports/patients.csv pour tout medecin authentifie', async () => {
    const app = createTestApp(fakeAuthAs('99999999-9999-4999-8999-999999999999'));

    const response = await app.request('/exports/patients.csv');

    expect(response.status).toBe(200);
  });
});
