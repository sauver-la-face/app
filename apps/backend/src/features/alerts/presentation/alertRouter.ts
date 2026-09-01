import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { alertListResponseSchema } from '@sauver-la-face/shared';
import { requirePhysicianAuth } from '@shared/middleware/physicianAuthMiddleware';
import { unauthorizedErrorSchema } from '@shared/openapi';
import type { MiddlewareHandler } from 'hono';
import type { SessionVariables } from '../../auth/presentation/authRouter';
import type { AlertUsecase } from '../application/alertUsecase';

const listAlertsRoute = createRoute({
  method: 'get',
  path: '/alerts',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: alertListResponseSchema,
        },
      },
      description: 'Liste des alertes actives',
    },
    304: {
      description: 'Aucune modification depuis le dernier ETag',
    },
    401: {
      content: { 'application/json': { schema: unauthorizedErrorSchema } },
      description: 'Session medecin requise',
    },
  },
  tags: ['Alerts'],
});

// SEC-04/A01 : cette route n'avait aucune authentification. Sa reponse expose
// `patientDisplayName` et `symptomLabelFr` - le nom d'un patient associe a son
// symptome, donnee de sante nominative au sens de l'article 9 du RGPD. Elle
// fournissait en outre les `patientId` exploitables par les autres routes.
//
// SEC-01 avait impose la session medecin sur un perimetre enumere a la main
// (patients, photos, exports, instructions) ou alertRouter ne figurait pas.
export function createAlertRouter(
  alertUsecase: AlertUsecase,
  authMiddleware: MiddlewareHandler<{ Variables: SessionVariables }> = requirePhysicianAuth,
): OpenAPIHono<{ Variables: SessionVariables }> {
  const router = new OpenAPIHono<{ Variables: SessionVariables }>();

  router.use('/alerts', authMiddleware);

  router.openapi(listAlertsRoute, async (context) => {
    const result = await alertUsecase.listAlerts(context.req.header('if-none-match'));
    context.header('ETag', result.etag);

    if (result.notModified) {
      return context.body(null, 304);
    }

    return context.json(result.response, 200);
  });

  return router;
}
