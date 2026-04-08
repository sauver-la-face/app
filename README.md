# Sauver la Face

Application de suivi post-opératoire pour patients cambodgiens opérés lors de missions humanitaires de chirurgie maxillo-faciale.

---

## Prérequis

Installe ces outils avant de démarrer :

| Outil | Version | Installation |
|---|---|---|
| [Bun](https://bun.sh) | 1.1.x+ | `winget install Oven-sh.Bun` (Windows) / `curl -fsSL https://bun.sh/install \| bash` (Mac/Linux) |
| [Node.js](https://nodejs.org) | 20.x LTS | Requis pour Expo |
| [Docker Desktop](https://www.docker.com/products/docker-desktop) | 24.x+ | Télécharger sur le site officiel |
| [Git](https://git-scm.com) | — | Télécharger sur le site officiel |

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

Copie les fichiers d'exemple et remplis les valeurs manquantes :

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env
cp .env.example .env
```

> Les valeurs à renseigner sont indiquées dans chaque fichier `.env.example`.

### 4. Démarrer les services Docker

```bash
docker compose up -d
```

Cela démarre :
- **PostgreSQL** sur le port `5432`
- **MinIO** sur le port `9000` (console : `9001`)
- **Caddy** (reverse proxy) sur les ports `80` / `443`

Vérifie que les services sont bien lancés :

```bash
docker compose ps
```

### 5. Appliquer les migrations de base de données

```bash
bun run --cwd apps/backend db:migrate
```

---

## Lancer les applications

Chaque application se lance dans un terminal séparé :

```bash
# Backend (Hono) — http://localhost:3001
bun run dev:backend

# Dashboard web (Next.js) — http://localhost:3000
bun run dev:web

# Application mobile (Expo)
bun run dev:mobile
```

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
    cdc.md          ← Cahier des charges complet
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

# Générer les migrations Drizzle
bun run --cwd apps/backend db:generate

# Arrêter Docker
docker compose down
```

---

*Projet Sauver la Face — Ydays 2025/2026*
