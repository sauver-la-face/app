# CLAUDE.md — Instructions pour Claude Code

Lire `.ai/context.md` et `.ai/cdc.md` avant de générer du code sur ce projet.
Toutes les règles de génération de code sont dans `.ai/context.md`.

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
