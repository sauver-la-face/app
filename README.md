[Onboarding](docs/onboarding.md) · [Architecture](docs/architecture.md) · [Schéma BDD](docs/schema.dbml) · [Lexique](docs/lexique.md) · [CDC](docs/cdc.md) · [Contexte IA](.ai/context.md) · [Features](.ai/features.md)

# Sauver la Face

Application de suivi post-opératoire pour patients cambodgiens opérés lors de missions humanitaires de chirurgie maxillo-faciale.

---

## Prérequis

Installe ces outils avant de démarrer :

| Outil                                                            | Version  | Installation                                                                                     |
| ---------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| [Bun](https://bun.sh)                                            | 1.1.x+   | `winget install Oven-sh.Bun` (Windows) / `curl -fsSL https://bun.sh/install \| bash` (Mac/Linux) |
| [Node.js](https://nodejs.org)                                    | 20.x LTS | Requis pour Expo                                                                                 |
| [Docker Desktop](https://www.docker.com/products/docker-desktop) | 24.x+    | Télécharger sur le site officiel                                                                 |
| [Git](https://git-scm.com)                                       | —        | Télécharger sur le site officiel                                                                 |

---

## Installation

### 1. Cloner le dépôt

```bash
git clone https://github.com/Johnn81100/sauver-la-face.git
cd sauver-la-face
```

> La branche par défaut est `dev` — c'est la branche de travail.

### 2. Installer les dépendances

```bash
bun install
```

### 3. Configurer les variables d'environnement

Les fichiers `.env` avec les valeurs dev par défaut sont déjà committés. Tu dois seulement créer les fichiers locaux avec les vraies credentials :

```bash
# Racine — variables Docker Compose (postgres, minio)
cp .env.example .env.local

# Backend — credentials réels (DATABASE_URL, secrets)
cp apps/backend/.env.example apps/backend/.env.local
```

> Remplis les valeurs dans `.env.local` et `apps/backend/.env.local`. Ces fichiers sont gitignorés — ne jamais les committer.

### 4. Démarrer les services Docker

```bash
# Développement local (MinIO + pgAdmin inclus)
bun run docker:up:dev

# Production (postgres + backend + caddy uniquement)
bun run docker:up:prod
```

Cela démarre (en dev) :

- **PostgreSQL** sur le port défini dans `.env.local` (`POSTGRES_PORT`)
- **Caddy** (reverse proxy) sur les ports `80` / `443`
- **MinIO** sur le port `9000` (console : `9001`)
- **pgAdmin** sur `http://localhost:8080`

Vérifie que les services sont bien lancés :

```bash
docker compose ps
```

### 5. Synchroniser le schéma base de données

```bash
docker exec sauverlaface-backend-1 bun run --cwd /app/apps/backend db:migrate
```

---

## Lancer les applications

Le backend tourne dans Docker (lancé via `docker:up:dev`). Seuls le web et le mobile se lancent en local :

```bash
# Dashboard web (Next.js) — http://localhost:3000
bun run dev:web

# Application mobile (Expo)
bun run dev:mobile
```

| Service    | URL                        |
|------------|----------------------------|
| Web        | http://localhost:3000      |
| Backend    | http://localhost:3001      |
| pgAdmin    | http://localhost:8080      |
| MinIO      | http://localhost:9001      |

---

## Structure du projet

```
sauver-la-face/
  apps/
    backend/        ← API REST (Bun + Hono + Drizzle)
    web/            ← Dashboard médecins (Next.js 14)
    mobile/         ← App patient (React Native + Expo SDK 52)
  packages/
    shared/         ← Schémas Zod + types TypeScript partagés
    config/         ← tsconfig de base partagé
  .ai/
    context.md      ← Contexte projet pour les agents IA
    features.md     ← Fonctionnalités à implémenter
    cdc.md          ← Cahier des charges complet (déplacé dans docs/)
  docs/
    lexique.md      ← Lexique des technologies et concepts du projet
  docker-compose.yml
  biome.json
```

---

## Workflow Git

Le projet suit **GitHub Flow** :

- `dev` — branche par défaut et de référence, **toujours rebase depuis `dev` avant de démarrer une feature**
- `main` — branche de production, merges humains uniquement (chef de projet)
- `feature/XXX-00-nom` — une branche par fonctionnalité (ex: `feature/AUTH-01-authentification-patient`)

```bash
# Démarrer une nouvelle feature
git checkout dev
git pull origin dev
git checkout -b feature/AUTH-01-authentification-patient

# Soumettre une PR vers dev quand la feature est terminée
gh pr create --base dev --title "feat: AUTH-01 authentification patient"
```

**Automatisations :**

- Création de branche `feature/` → statut mis à jour automatiquement dans `features.md`
- PR ouverte → **CodeRabbit** review automatiquement
- CI bloquant → Biome + TypeScript + tests doivent passer
- PR mergée → statut mis à jour automatiquement dans `features.md`

---

## Commandes utiles

```bash
# Linter et formatter
bun run lint        # vérifie le code
bun run format      # formate le code

# Tests
bun test --recursive

# Installer Drizzle
bun add drizzle-orm

# Générer les migrations Drizzle
bun run --cwd apps/backend db:generate

# Arrêter Docker
bun run docker:down:dev
```

---

---

## Documentation

### Docs humaines
- [Onboarding](docs/onboarding.md) — guide pour un nouveau développeur qui rejoint le projet
- [Architecture](docs/architecture.md) — décisions techniques et pourquoi elles ont été prises
- [Schéma BDD](docs/schema.dbml) — modèle logique de données (DBML — visualisable sur dbdiagram.io)
- [Lexique technique](docs/lexique.md) — définitions des technologies et concepts utilisés dans le projet
- [Cahier des charges](docs/cdc.md) — spécifications complètes du projet

### Contexte agent IA
- [Contexte projet](.ai/context.md) — stack, architecture, règles critiques — **lire en premier**
- [Features](.ai/features.md) — fonctionnalités à implémenter, en cours et terminées

---

_Projet Sauver la Face — Ydays 2025/2026_
