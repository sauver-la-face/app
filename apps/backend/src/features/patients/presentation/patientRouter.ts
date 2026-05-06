import { createPatientSchema, updatePatientSchema } from '@sauver-la-face/shared';
import { Hono } from 'hono';

import {
  PatientCodeGenerationError,
  PatientNotFoundError,
  type PatientUsecase,
} from '../application/patientUsecase';

export function createPatientRouter(patientUsecase: PatientUsecase): Hono {
  const router = new Hono();

  router.get('/patients', async (context) => {
    const response = await patientUsecase.listPatients();
    return context.json(response, 200);
  });

  router.post('/patients', async (context) => {
    const body = await context.req.json().catch(() => undefined);
    const parsedBody = createPatientSchema.safeParse(body);

    if (!parsedBody.success) {
      return context.json(
        {
          code: 'VALIDATION_ERROR',
          details: parsedBody.error.flatten(),
        },
        400,
      );
    }

    const response = await patientUsecase.createPatient(parsedBody.data);
    return context.json(response, 201);
  });

  router.get('/patients/:patientId', async (context) => {
    try {
      const response = await patientUsecase.getPatient(context.req.param('patientId'));
      return context.json(response, 200);
    } catch (error) {
      if (error instanceof PatientNotFoundError) {
        return context.json({ code: error.code, message: error.message }, 404);
      }

      throw error;
    }
  });

  router.patch('/patients/:patientId', async (context) => {
    const body = await context.req.json().catch(() => undefined);
    const parsedBody = updatePatientSchema.safeParse(body);

    if (!parsedBody.success) {
      return context.json(
        {
          code: 'VALIDATION_ERROR',
          details: parsedBody.error.flatten(),
        },
        400,
      );
    }

    try {
      const response = await patientUsecase.updatePatient(
        context.req.param('patientId'),
        parsedBody.data,
      );
      return context.json(response, 200);
    } catch (error) {
      if (error instanceof PatientNotFoundError) {
        return context.json({ code: error.code, message: error.message }, 404);
      }

      throw error;
    }
  });

  router.post('/patients/:patientId/access-code', async (context) => {
    try {
      const response = await patientUsecase.issueAccessCode(context.req.param('patientId'));
      return context.json(response, 201);
    } catch (error) {
      if (error instanceof PatientNotFoundError) {
        return context.json({ code: error.code, message: error.message }, 404);
      }

      if (error instanceof PatientCodeGenerationError) {
        return context.json({ code: error.code, message: error.message }, 500);
      }

      throw error;
    }
  });

  return router;
}
