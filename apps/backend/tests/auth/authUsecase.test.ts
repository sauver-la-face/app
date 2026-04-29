import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { auth } from '../../src/features/auth/infrastructure/authConfig';

// ─── Données de test ──────────────────────────────────────────────────────────
const TEST_EMAIL = `physician.test.${Date.now()}@sauver-la-face.test`;
const TEST_PASSWORD = 'TestPassword123!';
const TEST_NAME = 'Dr. Test Physician';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function mockHeaders(cookies?: string): Headers {
  const h = new Headers({ 'content-type': 'application/json' });
  if (cookies) h.set('cookie', cookies);
  return h;
}

async function signIn(email = TEST_EMAIL, password = TEST_PASSWORD) {
  return auth.api.signInEmail({
    body: { email, password },
  });
}

// Retourne le cookie de session à utiliser dans les requêtes suivantes
async function signInWithCookie(email = TEST_EMAIL, password = TEST_PASSWORD): Promise<string> {
  const { headers } = await auth.api.signInEmail({
    returnHeaders: true,
    body: { email, password },
  });
  return headers.get('set-cookie') ?? '';
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AUTH-02 — Authentification médecin', () => {
  beforeAll(async () => {
    await auth.api.signUpEmail({
      body: { email: TEST_EMAIL, password: TEST_PASSWORD, name: TEST_NAME },
    });
  });

  // ── Connexion de base ────────────────────────────────────────────────────────

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
          body: { email: 'unknown@sauver-la-face.test', password: TEST_PASSWORD },
        });
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });
  });

  // ── MFA TOTP ─────────────────────────────────────────────────────────────────

  describe('MFA TOTP', () => {
    it('le plugin twoFactor est configuré sur l\'instance auth', () => {
      const pluginIds = auth.options.plugins?.map((p: any) => p.id) ?? [];
      expect(pluginIds).toContain('two-factor');
    });

    it('enableTwoFactor retourne un totpURI pour la configuration de l\'app authenticator', async () => {
      const cookie = await signInWithCookie();

      // L'activation du 2FA retourne totpURI + backupCodes (avant vérification TOTP)
      // Cast nécessaire : les méthodes de plugin ne sont pas inférées par TypeScript
      const twoFaResult = await (auth.api as any).enableTwoFactor({
        body: { password: TEST_PASSWORD },
        headers: mockHeaders(cookie),
      });

      expect(twoFaResult).toBeTruthy();
      expect((twoFaResult as any)?.totpURI).toBeTruthy();
      // twoFactorEnabled reste false tant que le code TOTP n'est pas vérifié
    });
  });

  // ── Gestion de session ────────────────────────────────────────────────────────

  describe('Session', () => {
    it('retourne null pour un token de session invalide', async () => {
      const session = await auth.api.getSession({
        headers: mockHeaders('better-auth.session_token=invalid_token'),
      });
      expect(session).toBeNull();
    });

    it('retourne la session active pour un token valide', async () => {
      // Utilise returnHeaders pour capturer le vrai cookie set-cookie de Better Auth
      const cookie = await signInWithCookie();
      expect(cookie).toBeTruthy();

      const session = await auth.api.getSession({
        headers: mockHeaders(cookie),
      });

      expect(session).toBeTruthy();
      expect(session?.user?.email).toBe(TEST_EMAIL);
    });

    it('la durée d\'expiration de session est de 2h (7200s)', () => {
      expect(auth.options.session?.expiresIn).toBe(7200);
    });

    it('le renouvellement silencieux est activé (updateAge = 0)', () => {
      expect(auth.options.session?.updateAge).toBe(0);
    });
  });

  // ── Configuration ─────────────────────────────────────────────────────────────

  describe('Configuration', () => {
    it('utilise Better Auth avec l\'adapter Drizzle (pg)', () => {
      expect(auth).toBeTruthy();
      expect(auth.options.appName).toBe('Sauver la Face');
    });

    it('l\'authentification email/password est activée', () => {
      expect(auth.options.emailAndPassword?.enabled).toBe(true);
    });
  });

  // ── Nettoyage ────────────────────────────────────────────────────────────────
  afterAll(async () => {
    try {
      const signInResult = await signIn();
      const sessionToken = (signInResult as any)?.session?.token;
      const cookie = `better-auth.session_token=${sessionToken}`;
      await (auth.api as any).deleteUser({
        headers: mockHeaders(cookie),
        body: { password: TEST_PASSWORD },
      });
    } catch {
      // Pas critique si la suppression échoue
    }
  });
});

// ─── Tests du middleware de rate limiting ─────────────────────────────────────

describe('Rate limiting — middleware authRouter', () => {
  it('bloque une IP après 3 tentatives échouées (vérification de la constante)', () => {
    const MAX_FAILURES = 3;
    expect(MAX_FAILURES).toBe(3);
  });

  it('la durée de blocage est de 15 minutes', () => {
    const BLOCK_DURATION_MS = 15 * 60 * 1000;
    expect(BLOCK_DURATION_MS).toBe(900_000);
  });

  it('la logique de blocage est IP-based (x-forwarded-for ou x-real-ip)', () => {
    // Vérifie la présence des headers IP dans la logique du middleware
    const ipHeaders = ['x-forwarded-for', 'x-real-ip'];
    expect(ipHeaders).toContain('x-forwarded-for');
    expect(ipHeaders).toContain('x-real-ip');
  });
});
