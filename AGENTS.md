# AGENTS.md — Instructions pour assistants IA

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

## Règles features

- Toute nouvelle feature ajoutée dans `.ai/features.md` doit obligatoirement avoir un niveau de priorité : 🔴 Critique · 🟡 Majeur · 🟢 Mineur
- 🔴 Critique = bloque d'autres features ou obligation légale · 🟡 Majeur = core métier · 🟢 Mineur = confort, ne bloque rien
- Commencer par les features 🔴 Critique avant toute autre

## Règles Markdown

- Tous les blocs de code doivent avoir un langage déclaré (MD040) : ` ```bash `, ` ```ts `, ` ```yaml `, ` ```text ` pour le texte brut — jamais de ` ``` ` nu.

## Démarrage de l'environnement de dev

### Prérequis
- Docker Desktop en cours d'exécution
- `bun` installé

### 1. Installer les dépendances
```bash
bun install
```

### 2. Lancer les services Docker (postgres, minio, pgadmin, backend)
```bash
bun run docker:up:dev
```

Attendre que le backend log `Backend démarré` avant de continuer :
```bash
docker logs sauverlaface-backend-1 --follow
```

### 3. Synchroniser le schéma base de données (premier lancement uniquement)
```bash
docker exec sauverlaface-backend-1 bun run --cwd /app/apps/backend db:migrate
```

### 4. Lancer le dashboard web (local, hot reload)
```bash
bun run dev:web
```

### 5. Lancer l'app mobile (optionnel)
```bash
bun run dev:mobile
```

### URLs
| Service    | URL                        |
|------------|----------------------------|
| Web        | http://localhost:3000      |
| Backend    | http://localhost:3001      |
| pgAdmin    | http://localhost:8080      |
| MinIO      | http://localhost:9001      |

### Arrêter les services
```bash
bun run docker:down:dev
```

### Hot reload backend

Le backend tourne dans Docker. `bun --watch` ne détecte pas les changements de fichiers depuis Windows via volumes Docker (limitation WSL2). Après toute modification d'un fichier backend, relancer manuellement :

```bash
docker restart sauverlaface-backend-1
```

---

## Workflow Git

```bash
# Démarrer une feature
git checkout dev && git pull origin dev
git checkout -b feature/XXX-00-nom-de-la-feature

# Soumettre une PR quand la feature est terminée et testée
gh pr create --base dev --title "feat: XXX-00 nom"
```

**Règles absolues :**
- Jamais de push direct sur `dev` — toujours passer par une PR
- Format de branche obligatoire : `feature/XXX-00-nom` (ex: `feature/AUTH-01-authentification-patient`)
- La PR est créée uniquement quand la feature est terminée et que `bun run lint` + `bun test` passent
- La branche de production est `master` — merges humains uniquement, jamais via agent

---

## Sécurité et RGPD

- **Ne jamais logger de données patient** : `firstName`, `lastName`, `birthdate` sont des PII — les logs Pino ne doivent contenir que `{ patientId }` (UUID)
- **Tokens JWT** : stocker uniquement dans `expo-secure-store` côté mobile — jamais dans `AsyncStorage` (non chiffré)
- **Secrets** : `BETTER_AUTH_SECRET` et `JWT_SECRET` sont obligatoires en production — le backend lève une erreur au démarrage s'ils sont absents

---

## Autres commandes

```bash
# Tests unitaires (rapide, aucune dépendance externe)
bun run --cwd apps/backend test:unit

# Tests d'intégration (nécessite TEST_DATABASE_URL — voir .env.example)
bun run --cwd apps/backend test:integration

# Lint / Format
bun run lint
bun run format

# Compiler le package shared (obligatoire avant typecheck)
bun run build:shared

# Générer une migration Drizzle après changement de schéma
bun run --cwd apps/backend db:generate
```
