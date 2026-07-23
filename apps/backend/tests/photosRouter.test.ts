import { describe, expect, mock, test } from 'bun:test';
import { createHash } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import { Hono } from 'hono';

import { JwtTokenProvider } from '../src/features/auth/infrastructure/jwtTokenProvider';
import type { SessionVariables } from '../src/features/auth/presentation/authRouter';
import { PhotosUsecase } from '../src/features/photos/application/photosUsecase';
import type { PhotoRepository } from '../src/features/photos/domain/photoRepository';
import { createPhotosRouter } from '../src/features/photos/presentation/photosRouter';
import type { PatientSessionVariables } from '../src/shared/middleware/patientAuthMiddleware';

const physicianId = '99999999-9999-4999-8999-999999999999';
const patientId = '44444444-4444-4444-8444-444444444444';
const otherPatientId = '33333333-3333-4333-8333-333333333333';
const mediaId = '22222222-2222-4222-8222-222222222222';
const eventId = '77777777-7777-4777-8777-777777777777';
const bucket = 'photos';
const tokenProvider = new JwtTokenProvider('test-secret');

type Variables = SessionVariables & PatientSessionVariables;

class FakePhotoRepository implements PhotoRepository {
  constructor(
    private readonly media = new Map<string, { fileUrl: string }>(),
    private readonly eventOwners = new Map<string, string>(),
  ) {}

  save = mock(async () => undefined);

  async findMediaById(id: string): Promise<{ fileUrl: string } | null> {
    return this.media.get(id) ?? null;
  }

  async findEventOwnerPatientId(id: string): Promise<string | null> {
    return this.eventOwners.get(id) ?? null;
  }
}

function fakeS3Client() {
  return {
    send: mock(async () => ({
      Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
      ContentType: 'image/jpeg',
    })),
  };
}

// Middleware de test : simule une session medecin authentifiee sans dependre
// de Better Auth / d'une base de donnees.
function fakeAuthAs(
  authenticatedPhysicianId: string | null,
): MiddlewareHandler<{ Variables: Variables }> {
  return async (c, next) => {
    if (!authenticatedPhysicianId) {
      return c.json({ code: 'UNAUTHORIZED' }, 401);
    }
    c.set('user', { id: authenticatedPhysicianId } as SessionVariables['user']);
    c.set('session', null);
    await next();
  };
}

async function patientToken(uuid_patient: string): Promise<string> {
  return tokenProvider.sign({
    uuid_patient,
    uuid_patient_code: 'code-id',
    role: 'patient',
  });
}

function createTestApp(authMiddleware: MiddlewareHandler<{ Variables: Variables }>) {
  const photoRepository = new FakePhotoRepository(
    new Map([[mediaId, { fileUrl: `https://cdn.example.com/${bucket}/some/key.jpg` }]]),
    new Map([[eventId, patientId]]),
  );
  const usecase = new PhotosUsecase({ upload: mock(async () => 'unused') }, photoRepository);
  const s3Client = fakeS3Client();

  const app = new Hono<{ Variables: Variables }>();
  app.route(
    '/',
    createPhotosRouter(
      usecase,
      photoRepository,
      // biome-ignore lint/suspicious/noExplicitAny: double de test, pas le vrai SDK S3
      s3Client as any,
      bucket,
      tokenProvider,
      authMiddleware,
    ),
  );
  return app;
}

describe('photos.router GET /photos/:mediaId (SEC-01/A01)', () => {
  test('401 si aucune session medecin', async () => {
    const app = createTestApp(fakeAuthAs(null));

    const response = await app.request(`/photos/${mediaId}`);

    expect(response.status).toBe(401);
  });

  test('200 si un medecin quelconque est authentifie (equipe partagee)', async () => {
    const app = createTestApp(fakeAuthAs(physicianId));

    const response = await app.request(`/photos/${mediaId}`);

    expect(response.status).toBe(200);
  });

  test('404 si le media n existe pas, meme authentifie', async () => {
    const app = createTestApp(fakeAuthAs(physicianId));

    const response = await app.request('/photos/33333333-3333-4333-8333-333333333333');

    expect(response.status).toBe(404);
  });
});

describe('photos.router POST /photos (SEC-02/A01/A07)', () => {
  function buildFormData(): FormData {
    const fileBytes = 'fake-jpeg-bytes';
    const checksum = createHash('sha256').update(fileBytes).digest('hex');
    const form = new FormData();
    form.set('checksum', checksum);
    form.set('eventId', eventId);
    form.set('takenAt', '2026-05-20T10:00:00.000Z');
    form.set('file', new File([fileBytes], 'photo.jpg', { type: 'image/jpeg' }));
    return form;
  }

  test('401 sans token patient', async () => {
    const app = createTestApp(fakeAuthAs(physicianId));

    const response = await app.request('/photos', { method: 'POST', body: buildFormData() });

    expect(response.status).toBe(401);
  });

  test("403 si le token appartient a un patient different du proprietaire de l'event", async () => {
    const app = createTestApp(fakeAuthAs(physicianId));
    const token = await patientToken(otherPatientId);

    const response = await app.request('/photos', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: buildFormData(),
    });

    expect(response.status).toBe(403);
  });

  test("201 si le token appartient au patient proprietaire de l'event", async () => {
    const app = createTestApp(fakeAuthAs(physicianId));
    const token = await patientToken(patientId);

    const response = await app.request('/photos', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: buildFormData(),
    });

    expect(response.status).toBe(201);
  });
});
