-- Better Auth 1.7 : l'identite d'un compte est cadree par l'emetteur.
-- L'adaptateur Drizzle exige ce champ depuis cette version ; sans lui,
-- toute inscription echoue en 500 (BetterAuthError sur le modele "account").
-- https://better-auth.com/docs/guides/1-7-upgrade-guide#account-identity-is-scoped-by-issuer
ALTER TABLE "account" ADD COLUMN "issuer" text NOT NULL;
