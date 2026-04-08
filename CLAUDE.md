# CLAUDE.md — Instructions pour Claude Code

Lire `.ai/context.md` et `.ai/cdc.md` avant de générer du code sur ce projet.

## Commandes

```bash
# Installer les dépendances
bun install

# Lancer le backend
bun run dev:backend

# Lancer le dashboard web
bun run dev:web

# Lancer l'app mobile
bun run dev:mobile

# Tests
bun test --recursive

# Lint / Format
bun run lint
bun run format

# Migrations Drizzle
bun run --cwd apps/backend db:generate
bun run --cwd apps/backend db:migrate
```

## Règles de génération de code

- Toujours utiliser les types du package `@sauver-la-face/shared` — ne jamais redéfinir les types déjà présents dans `packages/shared/src/schema.ts`
- Architecture backend : router / service / repository — la logique métier va dans le service, jamais dans le router
- TDD sur les parties critiques : écrire le test avant l'implémentation (sync, alertes, auth, exports)
- Stratégie de conflits offline : **server-wins** — le serveur a toujours raison
- Migrations Drizzle : **additives uniquement** (colonnes nullable), jamais de suppression ni renommage
- Pas de `BETTER_AUTH_SECRET` dans `apps/web/` — la validation des tokens est déléguée au backend
