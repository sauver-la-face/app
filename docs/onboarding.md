[← README](../README.md) · [Architecture](architecture.md) · [Schéma BDD](schema.dbml) · [Lexique](lexique.md) · [CDC](cdc.md)

# Onboarding — Sauver la Face

> Guide pour un nouveau développeur qui rejoint le projet.

---

## Le projet en une phrase

Application mobile offline-first pour des patients cambodgiens opérés lors de missions humanitaires de chirurgie maxillo-faciale. Les chirurgiens toulousains effectuent des missions ponctuelles au Cambodge, opèrent les patients, puis assurent le suivi à distance sur le long terme. Les patients envoient photos et questionnaires depuis leur téléphone, et les médecins locaux comme les chirurgiens toulousains surveillent leur évolution et mettent à jour les dossiers via un dashboard web.

---

## Avant de coder

### 1. Lire dans cet ordre

1. `README.md` — installation et commandes de base
2. `docs/lexique.md` — comprendre le rôle de chaque technologie
3. `.ai/context.md` — stack, architecture, règles critiques
4. `.ai/features.md` — ce qui est à faire et ce qui est terminé
5. `docs/architecture.md` — décisions techniques et pourquoi elles ont été prises

### 2. Installer l'environnement

Voir le README.md pour les étapes complètes. En résumé :

```bash
bun install
cp .env.example .env.local
cp apps/backend/.env.example apps/backend/.env.local
bun run docker:up:dev
# attendre "Backend démarré", puis synchroniser le schéma (premier lancement uniquement)
docker exec sauverlaface-backend-1 bun run --cwd /app/apps/backend db:migrate
bun run dev:web
```

### 3. Vérifier que tout fonctionne

```bash
bun run --cwd apps/backend test:unit   # tests unitaires, tous passent
bun run lint                           # aucune erreur Biome
```

---

## Workflow quotidien

### Démarrer une feature

```bash
git checkout dev
git pull origin dev
git checkout -b feature/XXX-00-nom-de-la-feature
```

Le format de branche est obligatoire : `feature/XXX-00-nom` (ex: `feature/AUTH-01-authentification-patient`).

### Pendant le développement

- **TDD obligatoire** : écrire les tests avant le code sur toutes les features critiques (auth, sync, alertes, exports)
- **Jamais de `console.log`** : utiliser le logger Pino backend — toujours importer le symbole `logger` depuis `apps/backend/src/shared/logger.ts` via l'alias `@shared/logger` (configuré dans `apps/backend/tsconfig.json`)
- **Types** : toujours importer depuis `@sauver-la-face/shared`, jamais redéfinir
- **Backend** : Clean Architecture + DDD par feature — `presentation → application → domain ← infrastructure`. Les Entities et Value Objects vivent dans `domain/`. `application/` orchestre sans contenir de règle métier. Concepts partagés entre apps → `packages/shared/src/domain/`

### Soumettre une PR

```bash
gh pr create --base dev --title "feat: XXX-00 nom de la feature"
```

- CodeRabbit review automatiquement la PR
- CI doit passer (Biome + TypeScript + tests)
- **Jamais de push direct sur `dev`**

---

## Points d'attention spécifiques au projet

### Contexte humanitaire
Les patients sont au Cambodge avec une connexion instable. L'application **doit fonctionner offline**. Toute donnée est d'abord écrite en SQLite local, puis synchronisée. Ne jamais supposer qu'une connexion est disponible côté mobile.

### Données médicales et consentement RGPD
Le projet est soumis au RGPD et à la certification HDS. Ne jamais logger de données patient (nom, prénom, date de naissance). Les exports CSV anonymisent systématiquement ces champs.

L'écran de consentement RGPD (MOB-01) est obligatoire au premier lancement de l'app mobile — il doit s'afficher avant tout autre écran. La date d'acceptation est sauvegardée dans `expo-secure-store`.

### Conflits de synchronisation
Stratégie **server-wins** : en cas de conflit entre une donnée mobile et une donnée serveur, le serveur a toujours raison. Toujours logger le conflit avant d'écraser.

### Migrations de base de données
**Uniquement additives** : on ne supprime jamais de colonnes, on n'en renomme jamais. Un appareil mobile qui n'a pas synchronisé depuis plusieurs semaines doit toujours pouvoir fonctionner.

---

## Docker — développement vs production

Docker Compose orchestre **3 services en production** : backend Hono, Caddy (reverse proxy), PostgreSQL. En développement, `bun run docker:up:dev` ajoute MinIO (S3 local) et pgAdmin.

Le `Dockerfile` du backend utilise un **multi-stage build** avec trois étapes :

```text
base  ← installation des dépendances (commune)
 ├── dev   ← hot reload (bun run dev) — utilisé par docker-compose.yml
 └── prod  ← démarrage simple (bun run start) — utilisé en production
```

En développement, Docker Compose cible automatiquement l'étape `dev` :

```yaml
# docker-compose.yml
build:
  target: dev  ← hot reload activé
```

Le fichier `docker-compose.override.yml` est chargé automatiquement en dev (pas en prod). Il expose le port `3001` du backend sur `127.0.0.1` pour le développement local. En production, le backend n'est accessible que via Caddy sur le réseau Docker interne.

En production, on cible `prod` via `-f docker-compose.yml` explicitement (sans override) :

```bash
bun run docker:up:prod  # équivalent à docker compose -f docker-compose.yml up
```

> Ne jamais déployer avec `target: dev` en production — le watch mode surveille les fichiers en permanence et consomme des ressources inutilement.

---

## Contacts et ressources

- **Branche de travail** : `dev`
- **Branche de production** : `main` (merges humains uniquement)
- **Reviews PR** : CodeRabbit (IA) pour `dev`, chef de projet pour `main`
- **Cahier des charges complet** : `docs/cdc.md`
