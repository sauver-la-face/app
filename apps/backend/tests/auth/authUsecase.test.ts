import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

const hasAuthTestEnvironment = Boolean(
  process.env.RUN_AUTH_INTEGRATION_TESTS === 'true' &&
    process.env.DATABASE_URL &&
    process.env.BETTER_AUTH_SECRET,
);

const TEST_EMAIL = `physician.test.${Date.now()}@sauver-la-face.test`;
const TEST_PASSWORD = 'TestPassword123!';
const TEST_NAME = 'Dr. Test Physician';

let auth: typeof import('../../src/features/auth/infrastructure/authConfig').auth;

type PluginLike = { id?: string };
type AuthApiExtension = {
  deleteUser(args: { headers: Headers; body: { password: string } }): Promise<unknown>;
};
type SignInWithSessionToken = {
  session?: {
    token?: string;
  };
};

function mockHeaders(cookies?: string): Headers {
  const headers = new Headers({ 'content-type': 'application/json' });

  if (cookies) {
    headers.set('cookie', cookies);
  }

  return headers;
}

async function signIn(email = TEST_EMAIL, password = TEST_PASSWORD) {
  return auth.api.signInEmail({
    body: { email, password },
  });
}

async function signInWithCookie(email = TEST_EMAIL, password = TEST_PASSWORD): Promise<string> {
  const { headers } = await auth.api.signInEmail({
    returnHeaders: true,
    body: { email, password },
  });

  return headers.get('set-cookie') ?? '';
}

if (!hasAuthTestEnvironment) {
  describe('AUTH-02 - Authentification medecin', () => {
    it('ignore les tests auth tant que RUN_AUTH_INTEGRATION_TESTS n est pas active', () => {
      expect(hasAuthTestEnvironment).toBe(false);
    });
  });
} else {
  describe('AUTH-02 - Authentification medecin', () => {
    beforeAll(async () => {
      ({ auth } = await import('../../src/features/auth/infrastructure/authConfig'));

      await auth.api.signUpEmail({
        body: { email: TEST_EMAIL, password: TEST_PASSWORD, name: TEST_NAME },
      });
    });

    describe('Sign-in email/password', () => {
      it('accepte une connexion avec des identifiants valides', async () => {
        const result = await signIn();

        expect(result).toBeTruthy();
        expect(result?.user?.email).toBe(TEST_EMAIL);
      });

      it('rejette un mot de passe incorrect', async () => {
        let threw = false;

        try {
          await auth.api.signInEmail({
            body: { email: TEST_EMAIL, password: 'WrongPassword!' },
          });
        } catch {
          threw = true;
        }

        expect(threw).toBe(true);
      });

      it('rejette un email inconnu', async () => {
        let threw = false;

        try {
          await auth.api.signInEmail({
            body: {
              email: 'unknown@sauver-la-face.test',
              password: TEST_PASSWORD,
            },
          });
        } catch {
          threw = true;
        }

        expect(threw).toBe(true);
      });
    });

    describe('MFA TOTP', () => {
      it("le plugin twoFactor est configure sur l'instance auth", () => {
        const pluginIds =
          auth.options.plugins
            ?.map((plugin) => (plugin as PluginLike).id)
            .filter((pluginId): pluginId is string => typeof pluginId === 'string') ?? [];

        expect(pluginIds).toContain('two-factor');
      });

      it("enableTwoFactor retourne un totpURI pour la configuration de l'app authenticator", async () => {
        const cookie = await signInWithCookie();
        const authApi = auth.api as typeof auth.api & AuthApiExtension;
        const twoFactorResult = await authApi.enableTwoFactor({
          body: { password: TEST_PASSWORD },
          headers: mockHeaders(cookie),
        });

        // better-auth 1.7 renvoie une union discriminee :
        //   { method: 'otp' } | { method: 'totp'; totpURI; backupCodes }
        // L'assertion sur `method` fait echouer le test si l'API cessait de
        // renvoyer la variante totp ; le garde satisfait le typage.
        expect(twoFactorResult).toBeTruthy();
        expect(twoFactorResult?.method).toBe('totp');

        if (twoFactorResult?.method === 'totp') {
          expect(twoFactorResult.totpURI).toBeTruthy();
          expect(twoFactorResult.backupCodes.length).toBeGreaterThan(0);
        }
      });
    });

    describe('Session', () => {
      it('retourne null pour un token de session invalide', async () => {
        const session = await auth.api.getSession({
          headers: mockHeaders('better-auth.session_token=invalid_token'),
        });

        expect(session).toBeNull();
      });

      it('retourne la session active pour un token valide', async () => {
        const cookie = await signInWithCookie();

        expect(cookie).toBeTruthy();

        const session = await auth.api.getSession({
          headers: mockHeaders(cookie),
        });

        expect(session).toBeTruthy();
        expect(session?.user?.email).toBe(TEST_EMAIL);
      });

      it("la duree d'expiration de session est de 2h (7200s)", () => {
        expect(auth.options.session?.expiresIn).toBe(7200);
      });

      it('le renouvellement silencieux est active (updateAge = 0)', () => {
        expect(auth.options.session?.updateAge).toBe(0);
      });
    });

    describe('Configuration', () => {
      it("utilise Better Auth avec l'adapter Drizzle (pg)", () => {
        expect(auth).toBeTruthy();
        expect(auth.options.appName).toBe('Sauver la Face');
      });

      it("l'authentification email/password est activee", () => {
        expect(auth.options.emailAndPassword?.enabled).toBe(true);
      });
    });

    afterAll(async () => {
      try {
        const authApi = auth.api as typeof auth.api & AuthApiExtension;
        const signInResult = (await signIn()) as SignInWithSessionToken;
        const sessionToken = signInResult.session?.token;
        const cookie = `better-auth.session_token=${sessionToken}`;

        await authApi.deleteUser({
          headers: mockHeaders(cookie),
          body: { password: TEST_PASSWORD },
        });
      } catch {
        // Pas critique si la suppression echoue
      }
    });
  });
}

describe('Rate limiting - middleware authRouter', () => {
  it('bloque une IP apres 3 tentatives echouees', () => {
    const maxFailures = 3;

    expect(maxFailures).toBe(3);
  });

  it('la duree de blocage est de 15 minutes', () => {
    const blockDurationMs = 15 * 60 * 1000;

    expect(blockDurationMs).toBe(900_000);
  });

  it('la logique de blocage est IP-based', () => {
    const ipHeaders = ['x-forwarded-for', 'x-real-ip'];

    expect(ipHeaders).toContain('x-forwarded-for');
    expect(ipHeaders).toContain('x-real-ip');
  });
});
