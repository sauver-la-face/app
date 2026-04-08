# AGENTS.md — Instructions pour assistants IA

Lire ces deux fichiers avant de générer du code sur ce projet :

- `.ai/context.md` — résumé du projet, stack, règles critiques
- `.ai/cdc.md` — cahier des charges complet

## Règles de génération de code

- Toujours utiliser les types du package `@sauver-la-face/shared` — ne jamais redéfinir les types déjà présents dans `packages/shared/src/schema.ts`
- Architecture backend : router / service / repository — la logique métier va dans le service, jamais dans le router
- TDD sur les parties critiques : écrire le test avant l'implémentation (sync, alertes, auth, exports)
- Stratégie de conflits offline : **server-wins** — le serveur a toujours raison
- Migrations Drizzle : **additives uniquement** (colonnes nullable), jamais de suppression ni renommage pendant une mission active
- Pas de `BETTER_AUTH_SECRET` dans `apps/web/` — la validation des tokens est déléguée au backend

## Structure du monorepo

```
apps/backend/   ← API REST (Bun + Hono)
apps/web/       ← Dashboard médecins (Next.js 14)
apps/mobile/    ← App patient (Expo SDK 52)
packages/shared/ ← Schémas Zod + types partagés (source de vérité unique)
packages/config/ ← tsconfig partagé
```
