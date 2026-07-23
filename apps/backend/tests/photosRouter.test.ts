import { describe, expect, mock, test } from 'bun:test';
import type { MiddlewareHandler } from 'hono';
import { Hono } from 'hono';

import type { SessionVariables } from '../src/features/auth/presentation/authRouter';
import { PhotosUsecase } from '../src/features/photos/application/photosUsecase';
import type { PhotoRepository } from '../src/features/photos/domain/photoRepository';
import { createPhotosRouter } from '../src/features/photos/presentation/photosRouter';

const physicianId = '99999999-9999-4999-8999-999999999999';
const mediaId = '22222222-2222-4222-8222-222222222222';
const bucket = 'photos';

class FakePhotoRepository implements PhotoRepository {
  constructor(private readonly media = new Map<string, { fileUrl: string }>()) {}

  async save(): Promise<void> {
    // non utilisé par ces tests (upload hors scope SEC-01)
  }

  async findMediaById(id: string): Promise<{ fileUrl: string } | null> {
    return this.media.get(id) ?? null;
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

function createTestApp(authMiddleware: MiddlewareHandler<{ Variables: SessionVariables }>) {
  const photoRepository = new FakePhotoRepository(
    new Map([[mediaId, { fileUrl: `https://cdn.example.com/${bucket}/some/key.jpg` }]]),
  );
  const usecase = new PhotosUsecase({ upload: mock(async () => 'unused') }, photoRepository);
  const s3Client = fakeS3Client();

  const app = new Hono<{ Variables: SessionVariables }>();
  app.route(
    '/',
    createPhotosRouter(
      usecase,
      photoRepository,
      // biome-ignore lint/suspicious/noExplicitAny: double de test, pas le vrai SDK S3
      s3Client as any,
      bucket,
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
