import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { db } from '@shared/db';
import { betterAuth } from 'better-auth';
import { twoFactor } from 'better-auth/plugins';
import * as schema from '../../../infrastructure/schema';

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret && process.env.NODE_ENV === 'production') {
  throw new Error('BETTER_AUTH_SECRET is required in production');
}

export const auth = betterAuth({
  appName: 'Sauver la Face',
  secret: secret ?? 'test-secret-at-least-32-chars-long-123456',
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3001',
  trustedOrigins: (process.env.WEB_URL ?? 'http://localhost:3000').split(','),

  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      ...schema,
      // physician est la table user de Better Auth
      user: schema.physician,
    },
  }),

  // Authentification email + mot de passe pour les médecins
  emailAndPassword: {
    enabled: true,
  },

  // Session : expiration 2h d'inactivité (sliding window)
  session: {
    expiresIn: 60 * 60 * 2, // 2h
    updateAge: 0, // renouvellement silencieux à chaque requête
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // cache cookie 5 minutes côté client
    },
  },

  // Better Auth génère des UUIDs côté application pour rester cohérent avec notre schéma PostgreSQL.
  // On utilise une fonction (pas "uuid") car les tables Better Auth ont des colonnes text, pas uuid.
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },

  plugins: [
    twoFactor({
      issuer: 'Sauver la Face',
    }),
  ],

  // Rate limiting intégré — complété par le middleware custom dans authRouter (failed-only)
  rateLimit: {
    window: 60 * 15, // 15 minutes
    max: 100,
    customRules: {
      '/sign-in/email': {
        window: 60 * 15,
        max: 10, // garde-fou global — le middleware custom gère les 3 tentatives échouées
      },
    },
  },
});

export type Auth = typeof auth;
