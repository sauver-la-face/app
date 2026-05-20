import { Hono } from 'hono';
import type { AlertUsecase } from '../application/alertUsecase';

export function createAlertRouter(alertUsecase: AlertUsecase): Hono {
  const router = new Hono();

  router.get('/alerts', async (context) => {
    const result = await alertUsecase.listAlerts(context.req.header('if-none-match'));
    context.header('ETag', result.etag);

    if (result.notModified) {
      return context.body(null, 304);
    }

    return context.json(result.response, 200);
  });

  return router;
}
