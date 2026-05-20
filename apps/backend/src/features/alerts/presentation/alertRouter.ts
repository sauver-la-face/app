import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { alertListResponseSchema } from '@sauver-la-face/shared';
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
  },
  tags: ['Alerts'],
});

export function createAlertRouter(alertUsecase: AlertUsecase): OpenAPIHono {
  const router = new OpenAPIHono();

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
