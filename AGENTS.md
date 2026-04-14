# AGENTS.md — Instructions pour assistants IA

## Lecture obligatoire avant de générer du code

- `.ai/context.md` — stack, architecture, règles critiques
- `.ai/features.md` — fonctionnalités à implémenter et règles par feature

> `docs/cdc.md` est disponible comme référence complète si besoin d'approfondissement.

## Alias TypeScript (backend)

- `@shared/*` → `apps/backend/src/shared/*`
- Toujours utiliser cet alias pour importer depuis `shared/` — jamais de chemin relatif `../../shared/`
- Exemples : `import { logger } from "@shared/logger"` · `import { auditMiddleware } from "@shared/middleware/audit.middleware"`

## Règles Markdown

- Tous les blocs de code doivent avoir un langage déclaré (MD040) : ` ```bash `, ` ```ts `, ` ```yaml `, ` ```text ` pour le texte brut — jamais de ` ``` ` nu.

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

# Compiler le package shared (obligatoire avant typecheck)
bun run build:shared

# Migrations Drizzle
bun run --cwd apps/backend db:generate
bun run --cwd apps/backend db:migrate
```
