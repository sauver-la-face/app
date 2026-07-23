# CLAUDE.md — Instructions pour Claude Code

## Lecture obligatoire avant de générer du code

- `.ai/context.md` — stack, architecture, règles critiques
- `.ai/features.md` — fonctionnalités à implémenter et règles par feature

> `docs/cdc.md` est disponible comme référence complète si besoin d'approfondissement.

## Architecture backend — Clean Architecture + DDD par feature

Chaque feature backend suit 4 couches. Dépendances : `presentation → application → domain ← infrastructure`
Convention de nommage : **`camelCase` pour tous les fichiers sans exception**

```text
features/[feature]/
  presentation/
    [feature]Router.ts          ← HTTP + validation Zod, appelle application
  application/
    [feature]Usecase.ts         ← orchestration : appelle domain + repo, aucune règle métier
  domain/
    [entity].ts                 ← Entity DDD (UUID, identité persistante, règles métier)
    [entity]Repository.ts       ← interface (port), aucune dépendance externe
    [valueObject].ts            ← Value Object DDD (pas d'UUID, immuable, constructeur privé + create())
  infrastructure/
    [entity]Repository.ts       ← implémentation Drizzle (adapter)
```

**Couche `application/` — règles :**
- Chef d'orchestre uniquement : reçoit une commande, appelle le domaine, appelle l'infra via les interfaces
- Appelle les Entities et Value Objects de `domain/` pour déléguer la logique métier
- Appelle uniquement les interfaces Repository de `domain/` — jamais l'implémentation directement
- Ne connaît ni Drizzle ni Hono

**Couche `domain/` — règles DDD :**
- **Entity** : a un UUID, identité persistante même si les attributs changent (`Patient`, `Physician`, `MedicalEvent`)
- **Value Object** : pas d'UUID, défini par sa valeur, immuable, constructeur privé + méthode statique `create()` qui valide (`Email`, `PatientCodeValue`, `ChecksumSHA256`)
- Les règles métier et validations vivent ici — jamais dans `application/` ni `presentation/`
- Ne connaît ni Drizzle ni Hono

**Répartition domain/ vs packages/shared :**
- Concept utilisé par une seule app → `domain/` de la feature concernée
- Concept utilisé par plusieurs apps (ex: backend + mobile) → `packages/shared/src/domain/`

**Règles absolues :**
- `presentation/` ne contient aucune logique métier — valide et délègue uniquement
- `infrastructure/` ne contient aucune logique métier — lit et écrit uniquement
- Même nom `camelCase` dans `domain/` (interface) et `infrastructure/` (implémentation) — le dossier distingue les deux

## Architecture web — Feature-based (Next.js App Router)

```text
apps/web/src/
  app/                        ← routing Next.js (pages fines — importent depuis features/)
  features/
    [feature]/
      components/             ← UI pure, jamais de fetch direct — consomme les hooks
      hooks/                  ← logique métier + appels API via TanStack Query
      actions/                ← Server Actions Next.js (mutations : créer, modifier, supprimer)
```

**Règles absolues :**
- `app/` contient uniquement les pages — elles importent depuis `features/` et ne contiennent aucune logique
- `components/` reçoit des props et consomme des hooks — jamais de `fetch` direct
- `hooks/` contient toute la logique — `usePatients()`, `useAlerts()`, etc.
- `actions/` pour les mutations côté serveur

## Alias TypeScript (backend)

- `@shared/*` → `apps/backend/src/shared/*`
- Toujours utiliser cet alias pour importer depuis `shared/` — jamais de chemin relatif `../../shared/`
- Exemples : `import { logger } from "@shared/logger"` · `import { auditMiddleware } from "@shared/middleware/audit.middleware"`

## Règles mobile

- `expo-secure-store` ne stocke que des **strings** — toujours sérialiser les objets avec `JSON.stringify` avant stockage et `JSON.parse` à la lecture
- Jamais stocker de token dans `AsyncStorage` (non chiffré) — uniquement `expo-secure-store`

## Workflow Git — obligatoire avant toute feature

**Démarrage :**

```bash
git checkout dev && git pull origin dev
git checkout -b feature/XXX-00-nom
```

Le statut passe automatiquement de `[ ]` à `[~]` via GitHub Actions dès la création de la branche.

**Clôture (feature terminée et testée) :**

```bash
gh pr create --base dev --title "feat: XXX-00 nom" --body "..."
```

- Aucun push direct sur `dev`
- La PR est créée uniquement quand la feature est terminée et testée — pas avant
- Une fois la PR mergée, le statut passe automatiquement de `[~]` à `[x]` via GitHub Actions

## Règles features

- Toute nouvelle feature ajoutée dans `.ai/features.md` doit obligatoirement avoir un niveau de priorité : 🔴 Critique · 🟡 Majeur · 🟢 Mineur
- 🔴 Critique = bloque d'autres features ou obligation légale · 🟡 Majeur = core métier · 🟢 Mineur = confort, ne bloque rien
- Commencer par les features 🔴 Critique avant toute autre

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

# Tests unitaires (rapide, aucune dépendance externe)
bun run --cwd apps/backend test:unit

# Tests d'intégration (nécessite TEST_DATABASE_URL — voir .env.example)
bun run --cwd apps/backend test:integration

# Lint / Format
bun run lint
bun run format

# Compiler le package shared (obligatoire avant typecheck)
bun run build:shared

# Migrations Drizzle
bun run --cwd apps/backend db:generate
bun run --cwd apps/backend db:migrate
```
