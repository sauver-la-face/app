import type { MiddlewareHandler } from 'hono';
import { Hono } from 'hono';

import { requirePhysicianAuth } from '../../../shared/middleware/physicianAuthMiddleware';
import type { SessionVariables } from '../../auth/presentation/authRouter';
import { type ExportsUsecase, PatientNotFoundForExportError } from '../application/exportsUsecase';

// Hono pur (pas OpenAPIHono) : les réponses binaires (PDF) et textuelles (CSV)
// se typent mal via `OpenAPIHono.openapi()` qui force des `TypedResponse` JSON.
// Cohérent avec `photosRouter.ts` qui utilise aussi `Hono` pur pour l'upload
// multipart. La doc OpenAPI pour ces 3 routes pourra être ajoutée plus tard
// en cas de besoin via `openAPIRegistry.registerPath()`.

const PATIENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// SEC-01/A01 : ces routes exposent des dossiers patients (dashboard medecin).
// L'equipe de Toulouse suit collectivement les memes patients - seule une
// session medecin valide est exigee ici, aucun controle d'appartenance par patient.
export function createExportsRouter(
  exportsUsecase: ExportsUsecase,
  authMiddleware: MiddlewareHandler<{ Variables: SessionVariables }> = requirePhysicianAuth,
): Hono<{ Variables: SessionVariables }> {
  const router = new Hono<{ Variables: SessionVariables }>();

  router.use('/exports/*', authMiddleware);

  router.get('/exports/patients/:patientId/pdf', async (context) => {
    const patientId = context.req.param('patientId');
    if (!PATIENT_ID_PATTERN.test(patientId)) {
      return context.json({ code: 'VALIDATION_ERROR', message: 'Invalid patientId' }, 400);
    }

    try {
      const bytes = await exportsUsecase.exportPatientPdf(patientId);
      // pdf-lib renvoie `Uint8Array<ArrayBufferLike>` ; Hono `c.body()` attend
      // `Uint8Array<ArrayBuffer>`. La donnée n'est jamais sur un SharedArrayBuffer
      // ici (créée localement par pdf-lib) — cast safe.
      return context.body(bytes as Uint8Array<ArrayBuffer>, 200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="patient-${patientId}.pdf"`,
        'Content-Length': String(bytes.length),
      });
    } catch (error) {
      if (error instanceof PatientNotFoundForExportError) {
        return context.json({ code: error.code, message: error.message }, 404);
      }
      throw error;
    }
  });

  router.get('/exports/patients.csv', async (context) => {
    const csv = await exportsUsecase.exportAnonymizedCsv();
    const filename = `patients-anonymized-${new Date().toISOString().slice(0, 10)}.csv`;
    return context.body(csv, 200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
  });

  router.get('/exports/patients/:patientId/json', async (context) => {
    const patientId = context.req.param('patientId');
    if (!PATIENT_ID_PATTERN.test(patientId)) {
      return context.json({ code: 'VALIDATION_ERROR', message: 'Invalid patientId' }, 400);
    }

    try {
      const document = await exportsUsecase.exportPatientJsonPortability(patientId);
      return context.body(JSON.stringify(document), 200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="patient-${patientId}-portability.json"`,
      });
    } catch (error) {
      if (error instanceof PatientNotFoundForExportError) {
        return context.json({ code: error.code, message: error.message }, 404);
      }
      throw error;
    }
  });

  return router;
}
