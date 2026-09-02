import { afterEach, describe, expect, test } from 'bun:test';
import { createApp } from '../src/index';

afterEach(() => {
  delete process.env.NODE_ENV;
  delete process.env.JWT_SECRET;
});

describe('api.docs', () => {
  test('expose le schema OpenAPI JSON', async () => {
    process.env.NODE_ENV = 'test';
    const app = createApp();

    const response = await app.request('/openapi.json');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.openapi).toBe('3.0.0');
    expect(body.paths['/patients']).toBeTruthy();
    expect(body.paths['/sync']).toBeTruthy();
    expect(body.paths['/alerts']).toBeTruthy();
  });

  test('masque le schema OpenAPI en production', async () => {
    // Masquer /docs sans masquer /openapi.json ne protege rien : la
    // specification est le contenu, l'interface Swagger n'en est que la vue.
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long-123';
    const prodApp = createApp();

    const response = await prodApp.request('/openapi.json');

    expect(response.status).toBe(404);
  });

  test('expose /docs uniquement en developpement', async () => {
    process.env.NODE_ENV = 'development';
    const devApp = createApp();
    const devResponse = await devApp.request('/docs');

    expect(devResponse.status).toBe(200);
    expect(await devResponse.text()).toContain('/openapi.json');

    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long-123';
    const prodApp = createApp();
    const prodResponse = await prodApp.request('/docs');

    expect(prodResponse.status).toBe(404);
  });
});
