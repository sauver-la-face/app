[← README](../README.md) · [Architecture](architecture.md) · [Lexique](lexique.md) · [CDC](cdc.md)

# Onboarding — Sauver la Face

> Guide pour un nouveau développeur qui rejoint le projet.

---

## Le projet en une phrase

Application mobile offline-first pour des patients cambodgiens opérés lors de missions humanitaires de chirurgie maxillo-faciale. Les patients envoient photos et questionnaires depuis leur téléphone, les chirurgiens toulousains suivent leur évolution via un dashboard web.

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
bun run docker:up
bun run --cwd apps/backend db:migrate
```

### 3. Vérifier que tout fonctionne

```bash
bun test --recursive   # tous les tests passent
bun run lint           # aucune erreur Biome
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
- **Jamais de `console.log`** : utiliser le logger Pino (`import { logger } from "../shared/logger"`)
- **Types** : toujours importer depuis `@sauver-la-face/shared`, jamais redéfinir
- **Backend** : router → service → repository. La logique métier va dans le service uniquement

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

### Données médicales
Le projet est soumis au RGPD et à la certification HDS. Ne jamais logger de données patient (nom, prénom, date de naissance). Les exports CSV anonymisent systématiquement ces champs.

### Conflits de synchronisation
Stratégie **server-wins** : en cas de conflit entre une donnée mobile et une donnée serveur, le serveur a toujours raison. Toujours logger le conflit avant d'écraser.

### Migrations de base de données
**Uniquement additives** : on ne supprime jamais de colonnes, on n'en renomme jamais. Un appareil mobile qui n'a pas synchronisé depuis plusieurs semaines doit toujours pouvoir fonctionner.

---

## Contacts et ressources

- **Branche de travail** : `dev`
- **Branche de production** : `main` (merges humains uniquement)
- **Reviews PR** : CodeRabbit (IA) pour `dev`, chef de projet pour `main`
- **Cahier des charges complet** : `docs/cdc.md`
