import { describe, expect, mock, test } from 'bun:test';
import { createHash } from 'node:crypto';
import type { S3Client } from '@aws-sdk/client-s3';
import type { MiddlewareHandler } from 'hono';
import { Hono } from 'hono';

import { JwtTokenProvider } from '../src/features/auth/infrastructure/jwtTokenProvider';
import type { SessionVariables } from '../src/features/auth/presentation/authRouter';
import { PhotosUsecase } from '../src/features/photos/application/photosUsecase';
import type { Photo } from '../src/features/photos/domain/photo';
import type { PhotoRepository } from '../src/features/photos/domain/photoRepository';
import type { PhotoStorage } from '../src/features/photos/domain/photoStorage';
import { createPhotosRouter } from '../src/features/photos/presentation/photosRouter';
import type { PatientSessionVariables } from '../src/shared/middleware/patientAuthMiddleware';
import { sessionVivante } from './patientSessionStub';

const physicianId = '99999999-9999-4999-8999-999999999999';
const patientId = '44444444-4444-4444-8444-444444444444';
const otherPatientId = '33333333-3333-4333-8333-333333333333';
const mediaId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const unknownMediaId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const eventId = '11111111-1111-4111-8111-111111111111';
const bucket = 'test-bucket';
const fileContent = Buffer.from('fake-image-content');
const checksum = createHash('sha256').update(fileContent).digest('hex');
const takenAt = '2026-06-22T10:00:00.000Z';
const fileUrl = `http://minio/${bucket}/photos/${mediaId}.jpg`;
const tokenProvider = new JwtTokenProvider('test-secret');

type Variables = SessionVariables & PatientSessionVariables;

class InMemoryPhotoRepository implements PhotoRepository {
  private readonly store = new Map<string, { fileUrl: string }>();
  private readonly eventOwners = new Map<string, string>();

  async save(photo: Photo): Promise<void> {
    this.store.set(photo.mediaId, { fileUrl: photo.fileUrl });
  }

  async findMediaById(id: string): Promise<{ fileUrl: string } | null> {
    return this.store.get(id) ?? null;
  }

  // SEC-02/A01 : resout le patient proprietaire d'un medical_event.
  async findEventOwnerPatientId(id: string): Promise<string | null> {
    return this.eventOwners.get(id) ?? null;
  }

  seed(id: string, url: string): void {
    this.store.set(id, { fileUrl: url });
  }

  seedEventOwner(id: string, ownerPatientId: string): void {
    this.eventOwners.set(id, ownerPatientId);
  }
}

class FakePhotoStorage implements PhotoStorage {
  async upload(id: string, _eventId: string, _buffer: Buffer): Promise<string> {
    return `http://minio/${bucket}/photos/${id}.jpg`;
  }
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
    uuid_patient_code: `code:${uuid_patient}`,
    role: 'patient',
  });
}

function buildFormData(overrides: Partial<Record<string, string | File>> = {}): FormData {
  const fd = new FormData();
  fd.append('file', new File([fileContent], 'photo.jpg', { type: 'image/jpeg' }));
  fd.append('checksum', checksum);
  fd.append('eventId', eventId);
  fd.append('takenAt', takenAt);
  for (const [k, v] of Object.entries(overrides)) {
    fd.set(k, v as string | File);
  }
  return fd;
}

interface TestAppOptions {
  seededMedia?: { mediaId: string; url: string };
  authMiddleware?: MiddlewareHandler<{ Variables: Variables }>;
  s3Client?: S3Client;
}

function createTestApp(options: TestAppOptions = {}) {
  const photoRepository = new InMemoryPhotoRepository();
  if (options.seededMedia) {
    photoRepository.seed(options.seededMedia.mediaId, options.seededMedia.url);
  }
  photoRepository.seedEventOwner(eventId, patientId);

  const usecase = new PhotosUsecase(new FakePhotoStorage(), photoRepository, () => mediaId);

  const s3Client =
    options.s3Client ??
    ({
      send: mock(async (_cmd: unknown) => ({
        Body: { transformToByteArray: async () => new Uint8Array(fileContent) },
        ContentType: 'image/jpeg',
      })),
    } as unknown as S3Client);

  const app = new Hono<{ Variables: Variables }>();
  app.route(
    '/',
    createPhotosRouter(
      usecase,
      photoRepository,
      s3Client,
      bucket,
      tokenProvider,
      sessionVivante(),
      options.authMiddleware ?? fakeAuthAs(physicianId),
    ),
  );
  return app;
}

describe('photos.router', () => {
  describe('GET /photos/:mediaId — SEC-01/A01 authentification medecin', () => {
    test('retourne 401 si aucune session médecin', async () => {
      const app = createTestApp({
        seededMedia: { mediaId, url: fileUrl },
        authMiddleware: fakeAuthAs(null),
      });

      const response = await app.request(`/photos/${mediaId}`);

      expect(response.status).toBe(401);
    });

    test('retourne 200 si un médecin quelconque est authentifié (équipe partagée)', async () => {
      const app = createTestApp({ seededMedia: { mediaId, url: fileUrl } });

      const response = await app.request(`/photos/${mediaId}`);

      expect(response.status).toBe(200);
    });

    test("retourne 404 si le média n'existe pas, même authentifié", async () => {
      const app = createTestApp();

      const response = await app.request(`/photos/${unknownMediaId}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /photos — SEC-02/A01/A07 propriété du dossier patient', () => {
    test('retourne 401 sans token patient', async () => {
      const app = createTestApp();

      const response = await app.request('/photos', { method: 'POST', body: buildFormData() });

      expect(response.status).toBe(401);
    });

    test("retourne 403 si le token appartient à un patient différent du propriétaire de l'event", async () => {
      const app = createTestApp();
      const token = await patientToken(otherPatientId);

      const response = await app.request('/photos', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: buildFormData(),
      });

      expect(response.status).toBe(403);
    });

    test("retourne 201 si le token appartient au patient propriétaire de l'event", async () => {
      const app = createTestApp();
      const token = await patientToken(patientId);

      const response = await app.request('/photos', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: buildFormData(),
      });

      expect(response.status).toBe(201);
    });
  });

  describe('POST /photos — validation du payload', () => {
    async function ownerHeaders(): Promise<Record<string, string>> {
      return { authorization: `Bearer ${await patientToken(patientId)}` };
    }

    test('retourne 201 avec mediaId et fileUrl pour un upload valide', async () => {
      const app = createTestApp();

      const response = await app.request('/photos', {
        method: 'POST',
        headers: await ownerHeaders(),
        body: buildFormData(),
      });

      expect(response.status).toBe(201);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.mediaId).toBe(mediaId);
      expect(typeof body.fileUrl).toBe('string');
    });

    test('retourne 400 si le checksum est absent', async () => {
      const app = createTestApp();
      const fd = buildFormData();
      fd.delete('checksum');

      const response = await app.request('/photos', {
        method: 'POST',
        headers: await ownerHeaders(),
        body: fd,
      });

      expect(response.status).toBe(400);
    });

    test("retourne 400 si eventId n'est pas un UUID", async () => {
      const app = createTestApp();

      const response = await app.request('/photos', {
        method: 'POST',
        headers: await ownerHeaders(),
        body: buildFormData({ eventId: 'not-a-uuid' }),
      });

      expect(response.status).toBe(400);
    });

    test('retourne 400 si le fichier est absent', async () => {
      const app = createTestApp();
      const fd = buildFormData();
      fd.delete('file');

      const response = await app.request('/photos', {
        method: 'POST',
        headers: await ownerHeaders(),
        body: fd,
      });

      expect(response.status).toBe(400);
    });

    test('retourne 422 si le checksum ne correspond pas au fichier', async () => {
      const app = createTestApp();

      const response = await app.request('/photos', {
        method: 'POST',
        headers: await ownerHeaders(),
        body: buildFormData({ checksum: 'a'.repeat(64) }),
      });

      expect(response.status).toBe(422);
    });
  });

  describe('GET /photos/:mediaId — proxy S3', () => {
    test('retourne 200 avec le contenu binaire pour un média connu', async () => {
      const app = createTestApp({ seededMedia: { mediaId, url: fileUrl } });

      const response = await app.request(`/photos/${mediaId}`);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('image/jpeg');
      expect(response.headers.get('Cache-Control')).toBe('private, max-age=3600');
    });

    test("retourne 404 si le média n'existe pas", async () => {
      const app = createTestApp();

      const response = await app.request(`/photos/${unknownMediaId}`);

      expect(response.status).toBe(404);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.code).toBe('NOT_FOUND');
    });

    test('retourne 404 si S3 ne renvoie pas de Body', async () => {
      const app = createTestApp({
        seededMedia: { mediaId, url: fileUrl },
        s3Client: {
          send: mock(async () => ({ Body: null })),
        } as unknown as S3Client,
      });

      const response = await app.request(`/photos/${mediaId}`);

      expect(response.status).toBe(404);
    });
  });
});
