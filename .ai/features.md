[← README](../README.md) · [Contexte IA](context.md) · [Onboarding](../docs/onboarding.md) · [Architecture](../docs/architecture.md) · [CDC](../docs/cdc.md)

# Fonctionnalités à implémenter — Sauver la Face

> Statuts : `[ ]` à faire · `[~]` en cours · `[x]` terminé

---

## BACKEND

### AUTH-01 — Authentification patients (codes 6 chiffres)

`[ ]` `apps/backend/src/features/auth/`

**Comportement attendu :**

- Génération d'un code numérique 6 chiffres unique par patient
- Soft delete automatique après 48h si le code n'est pas utilisé (job cron)
- Une fois utilisé (`used_at NOT NULL`), le code est valide pour toujours
- Renouvellement uniquement par un médecin

**Règles de code :**

- La logique de validation du code va dans `auth.service.ts` uniquement
- Le cron de soft delete est un service séparé `auth.cron.ts`
- Tester : génération, expiration 48h, soft delete, renouvellement, tentative sur code supprimé

---

### AUTH-02 — Authentification médecins (MFA TOTP)

`[ ]` `apps/backend/src/features/auth/`

**Comportement attendu :**

- MFA TOTP obligatoire via Better Auth
- Session timeout 2h d'inactivité
- Tokens JWT signés HMAC-SHA256, renouvellement silencieux

**Règles de code :**

- Utiliser Better Auth sans couche custom — ne pas réinventer la gestion de session
- Tester : login sans MFA rejeté, session expirée rejetée, refresh silencieux

---

### SYNC-01 — Réception et résolution des conflits (server-wins)

`[ ]` `apps/backend/src/features/sync/`

**Comportement attendu :**

- Réception du payload offline du mobile
- Résolution des conflits : le serveur a toujours raison
- Versioning de schéma : accepte `N` et `N-1`, rejette `> N` avec `APP_UPDATE_REQUIRED`
- Log du delta en cas de conflit

**Règles de code :**

- La logique server-wins va dans `sync.service.ts`
- Ne jamais écraser un enregistrement sans logger le conflit
- Tester : payload normal, conflit server-wins, version schéma incompatible

---

### ALERT-01 — Système d'alertes automatiques

`[ ]` `apps/backend/src/features/alerts/`

**Comportement attendu :**

- Alerte si `severity > 7` sur un `medical_event`
- Alerte si saignement présent
- Alerte si aucune synchronisation depuis 7 jours

**Règles de code :**

- Les seuils sont des constantes nommées dans `alerts.service.ts` (pas de magic numbers)
- Tester : chaque seuil individuellement, pas d'alerte en dessous du seuil

---

### PHOTO-01 — Stockage et validation des photos

`[ ]` · `apps/backend/src/features/photos/`

**Comportement attendu :**

- Réception de la photo uploadée par le mobile
- Validation checksum SHA-256 (comparé à celui envoyé par le mobile)
- Stockage dans MinIO HDS
- Rejet `PHOTO_INTEGRITY_ERROR` si mismatch checksum
- Retry côté mobile : backoff 2s, 4s, abandon à la 4e tentative

**Règles de code :**

- La validation checksum se fait dans `photos.service.ts` avant tout stockage
- Le client MinIO est dans `apps/backend/src/shared/storage/`

---

### EXPORT-01 — Export PDF / CSV RGPD

`[ ]` `apps/backend/src/features/exports/`

**Comportement attendu :**

- Export PDF rapport complet d'un patient
- Export CSV données anonymisées (RGPD)
- Droit portabilité : export JSON données brutes patient

**Règles de code :**

- La génération des fichiers va dans `exports.service.ts`
- Les données anonymisées : supprimer `first_name`, `last_name`, `birthdate` du CSV
- Tester : structure du PDF, anonymisation CSV, format JSON portabilité

---

### AUDIT-01 — Middleware d'audit logs

`[ ]` `apps/backend/src/shared/middleware/audit.middleware.ts`

**Comportement attendu :**

- Enregistrer automatiquement chaque requête HTTP reçue par le backend
- Logger : horodatage UTC, méthode HTTP, route, identifiant utilisateur, adresse IP, user-agent, statut de réponse, durée
- Ne jamais logger le contenu des données médicales (corps de requête, noms, photos)
- Export journalier des logs vers le stockage S3 (MinIO en dev, OVH Object Storage en prod)
- Rétention des logs : 1 an (obligation HDS)

**Fichiers à créer :**

- `apps/backend/src/shared/middleware/audit.middleware.ts` — middleware Hono branché sur toutes les routes
- `apps/backend/src/shared/storage/logs.storage.ts` — client S3 pour l'export des logs
- `apps/backend/src/shared/jobs/audit.export.cron.ts` — cron journalier de compression et export vers S3

**Règles de code :**

- Le middleware est branché une seule fois dans `apps/backend/src/index.ts` — actif sur toutes les routes automatiquement
- Utiliser le logger Pino centralisé (`import { logger } from "../logger"`) — jamais de nouvelle instance
- Niveau de log : `info` pour les succès, `warn` pour les échecs d'authentification, `error` pour les erreurs serveur
- Pino écrit dans un fichier local d'abord — le cron exporte ensuite vers S3 (robustesse si S3 indisponible)
- Utiliser `@aws-sdk/client-s3` — client universel compatible MinIO (dev) et OVH S3 (prod) sans changer le code
- En dev : MinIO local (`S3_ENDPOINT=localhost`, `S3_USE_SSL=false`)
- En prod : OVH Object Storage (`S3_ENDPOINT=s3.gra.io.cloud.ovh.net`, `S3_USE_SSL=true`)
- Variables d'environnement déjà ajoutées dans `.env.example` : `S3_ENDPOINT`, `S3_PORT`, `S3_USE_SSL`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET_LOGS`
- Bucket dédié aux logs (`logs-audit`) séparé du bucket photos (`photos`)
- Installer au moment de l'implémentation : `bun add @aws-sdk/client-s3`

---

### API-01 — Documentation OpenAPI auto-générée (Swagger UI)

`[ ]` `apps/backend/src/index.ts`

**Comportement attendu :**

- Documentation interactive accessible sur `http://localhost:3001/docs` en développement
- Générée automatiquement depuis les schémas Zod des routes Hono — aucune documentation manuelle
- Chaque route décrit ses paramètres d'entrée, les réponses possibles et les codes d'erreur
- `/openapi.json` expose le schéma brut pour générer des clients TypeScript côté web et mobile

**Règles de code :**

- Utiliser `@hono/zod-openapi` (déjà installé) — remplacer `new Hono()` par `new OpenAPIHono()`
- Chaque route est déclarée avec `.openapi()` — les schémas Zod de `@sauver-la-face/shared` sont réutilisés directement, aucun type à réécrire
- Le endpoint `/docs` est exposé uniquement en développement (`NODE_ENV !== 'production'`)
- Ajouter un script dans `package.json` du web et du mobile pour régénérer le client TypeScript : `bunx openapi-typescript http://localhost:3001/openapi.json -o src/api.types.ts`
- Quand un schéma Zod change dans `shared/`, régénérer le client — les types web et mobile sont automatiquement à jour

---

### PATIENT-01 — CRUD patients et gestion utilisateurs

`[ ]` · `apps/backend/src/features/patients/`

**Comportement attendu :**

- Création / lecture / mise à jour d'un patient
- Attribution d'un code d'accès à un patient (déclenche AUTH-01)
- Liste des patients avec statut de synchronisation

**Règles de code :**

- Toutes les requêtes SQL via `patients.repository.ts` (Drizzle uniquement, pas de SQL brut)
- Les types viennent de `@sauver-la-face/shared`

---

### INSTRUCTION-01 — Envoi d'instructions médicales

`[ ]` · `apps/backend/src/features/instructions/`

**Comportement attendu :**

- Création d'une instruction pictographique par un médecin pour un patient
- Suivi de la lecture via `acknowledged_at`
- Notification dashboard quand instruction lue

**Règles de code :**

- `acknowledged_at` est mis à jour uniquement par le mobile lors de la lecture
- Le médecin ne peut pas modifier `acknowledged_at`

---

## DASHBOARD WEB

### WEB-01 — Tableau de bord médecin

`[ ]` · `apps/web/src/app/dashboard/`

**Comportement attendu :**

- Liste des patients avec statut (alerte / ok / hors-ligne)
- Alertes critiques en haut de page
- Polling toutes les 30s via `refetchInterval` TanStack Query

**Règles de code :**

- Les appels API dans des hooks TanStack Query dans `apps/web/src/hooks/`
- Pas de `fetch` direct dans les composants
- Pas de `BETTER_AUTH_SECRET` côté web — auth déléguée au backend

---

### WEB-02 — Visualisation chronologique patient

`[ ]` · `apps/web/src/app/patients/[id]/`

**Comportement attendu :**

- Historique des photos de cicatrices par date
- Graphique d'évolution de la sévérité des symptômes
- Timeline des événements médicaux

**Règles de code :**

- Les données sont récupérées via un hook `usePatientHistory(id)`
- Les composants graphiques sont dans `apps/web/src/components/`

---

### WEB-03 — Gestion des utilisateurs et codes d'accès

`[ ]` · `apps/web/src/app/patients/`

**Comportement attendu :**

- Création d'un compte patient
- Génération / renouvellement d'un code 6 chiffres
- Affichage du statut du code (actif / expiré / supprimé)

**Règles de code :**

- La génération du code est toujours côté backend (PATIENT-01 / AUTH-01)
- Le frontend affiche uniquement, ne génère jamais le code lui-même

---

### WEB-04 — Export données (PDF / CSV)

`[ ]` · `apps/web/src/app/exports/`

**Comportement attendu :**

- Bouton export PDF d'un rapport patient
- Export CSV anonymisé de tous les patients
- Téléchargement direct dans le navigateur

**Règles de code :**

- L'export est généré côté backend (EXPORT-01) — le frontend déclenche et télécharge uniquement

---

### WEB-05 — Envoi d'instructions pictographiques

`[ ]` · `apps/web/src/app/patients/[id]/instructions/`

**Comportement attendu :**

- Formulaire de création d'instruction (sélection pictogrammes)
- Affichage du statut de lecture (`acknowledged_at`)

---

## APPLICATION MOBILE

### MOB-02 — Authentification patient (code 6 chiffres)

`[ ]` `apps/mobile/src/features/auth/`

**Comportement attendu :**

- Écran de saisie du code 6 chiffres (clavier numérique)
- Stockage du token JWT dans `expo-secure-store` (AES-256)
- Session valide pour toujours une fois connecté

**Règles de code :**

- Le token ne transite jamais en clair — toujours via `expo-secure-store`
- L'expiration de session est gérée par le renouvellement silencieux du JWT
- Interface en khmer par défaut (`i18next`)

---

### MOB-03 — Questionnaire symptômes (offline)

`[ ]` · `apps/mobile/src/features/questionnaire/`

**Comportement attendu :**

- Questions visuelles via pictogrammes
- Réponses simples par tap
- Sauvegarde en SQLite local immédiatement
- Ajout à la `sync_queue` pour envoi ultérieur

**Règles de code :**

- Toute écriture passe par `questionnaire/storage/` avant tout appel réseau
- La `sync_queue` est dans `apps/mobile/src/features/sync/sync.queue.ts`

---

### MOB-04 — Capture et compression de photos

`[ ]` `apps/mobile/src/features/photos/`

**Comportement attendu :**

- Ouverture caméra native via Expo
- Compression automatique JPEG qualité 80%
- Validation avant stockage : magic bytes JPEG, taille > 0, dimensions min 200×200 px
- Calcul checksum SHA-256 avant upload
- Horodatage automatique (`taken_at`)

**Règles de code :**

- Validation dans `photos/storage/` avant tout stockage SQLite
- Le checksum est calculé côté mobile et vérifié côté backend (PHOTO-01)
- Tester : validation magic bytes, rejet image invalide, calcul checksum

---

### MOB-05 — Queue de synchronisation (offline → backend)

`[ ]` `apps/mobile/src/features/sync/`

**Comportement attendu :**

- Table `sync_queue` en SQLite : stocke toutes les actions en attente
- Envoi séquentiel à la reconnexion
- Retry backoff exponentiel : 1s, 2s, 4s, 8s — abandon après 4 tentatives
- Purge automatique des photos > 30 jours si quota 50 Mo atteint

**Règles de code :**

- La queue est traitée dans `sync.service.ts` (orchestration) et `sync.queue.ts` (table SQLite)
- Tester : envoi séquentiel, retry backoff, abandon après 4 tentatives, purge quota

---

### MOB-01 — Consentement RGPD première connexion

`[ ]` `apps/mobile/src/features/consent/`

**Comportement attendu :**

- Écran affiché une seule fois au premier lancement, avant l'écran de connexion
- Présentation claire de ce qui est collecté : photos de cicatrices, questionnaires de symptômes
- Le patient accepte ou refuse via deux boutons avec pictogrammes
- Si refus → l'app se ferme, aucune donnée n'est collectée
- Si accepte → consentement et date d'acceptation sauvegardés dans `expo-secure-store`
- L'écran ne réapparaît plus jamais après acceptation

**Règles de code :**

- Le consentement est stocké dans `expo-secure-store` avec la date UTC d'acceptation (`consent_given_at`)
- Au lancement de l'app, vérifier la présence du consentement avant d'afficher l'écran de connexion
- L'interface est en khmer par défaut — dépend de **I18N-01**
- Utiliser des pictogrammes pour illustrer chaque type de donnée collectée (accessibilité patients)
- Ne jamais bypasser cet écran en développement — tester le flux complet
- Tester : premier lancement sans consentement, refus ferme l'app, acceptation sauvegardée, deuxième lancement skip l'écran

---

### MOB-06 — Consultation des instructions médicales

`[ ]` · `apps/mobile/src/features/instructions/`

**Comportement attendu :**

- Affichage des instructions pictographiques envoyées par le médecin
- Accusé de réception automatique à l'ouverture (`acknowledged_at` mis à jour)
- Cache offline des instructions

**Règles de code :**

- `acknowledged_at` est envoyé au backend via la `sync_queue` (MOB-05)
- Les instructions sont mises en cache SQLite pour fonctionner offline

---

### MOB-07 — Notifications (locales et push)

`[ ]` `apps/mobile/src/features/notifications/`

**Comportement attendu :**

**Notifications locales (offline) :**
- Rappel hebdomadaire automatique pour la prise de photos et le remplissage du questionnaire
- Programmées localement par l'app — fonctionnent sans connexion
- Planification au premier lancement après consentement (MOB-01)

**Notifications push (serveur) :**
- Alerte quand le médecin envoie de nouvelles instructions (INSTRUCTION-01)
- Envoyées depuis le backend via Expo Push Service

**Règles de code :**

- `expo-notifications` est déjà installé dans `apps/mobile/package.json`
- Demander la permission de notifications au premier lancement (après MOB-01)
- Les notifications locales sont gérées dans `notifications/local.service.ts`
- Les notifications push nécessitent l'enregistrement du token Expo côté backend — stocker le token dans `expo-secure-store`
- L'interface des notifications est en khmer par défaut — dépend de **I18N-01**
- Tester : permission accordée/refusée, rappel local programmé, réception notification push

---

## INTERNATIONALISATION

### I18N-01 — Internationalisation de l'application mobile (khmer / français)

`[ ]` `apps/mobile/src/i18n/`

**Comportement attendu :**

- Interface en khmer par défaut (`km`)
- Fallback en français (`fr`) si la traduction khmer est manquante
- Détection automatique de la langue du device via `expo-localization`
- Changement de langue possible depuis les paramètres de l'app

**Fichiers de traductions :**

- `apps/mobile/src/i18n/locales/km.json` — traductions khmer
- `apps/mobile/src/i18n/locales/fr.json` — traductions français
- `apps/mobile/src/i18n/index.ts` — configuration i18next

**Règles de code :**

- Initialiser i18next avec `initReactI18next` dans `apps/mobile/src/i18n/index.ts`
- Importer `i18n` une seule fois au point d'entrée de l'app (`App.tsx` ou `_layout.tsx`)
- Utiliser le hook `useTranslation()` dans tous les composants — jamais de string en dur
- Les clés de traduction suivent le format `feature.composant.element` (ex. `auth.login.title`)
- `expo-localization` est déjà installé — utiliser `getLocales()[0].languageCode` pour détecter la langue
- `i18next` et `react-i18next` sont déjà installés dans `apps/mobile/package.json`
- Tester : détection langue, fallback, changement de langue dynamique

---

## DEVOPS

### DEVOPS-03 — Automatisation statut features (workflows + authentification bot)

`[ ]` `.github/workflows/feature-in-progress.yml` · `.github/workflows/update-feature-status.yml`

**Comportement attendu :**

- Création d'une branche `feature/XXX-00-nom` → `features.md` passe automatiquement de `[ ]` à `[~]`
- PR mergée sur `dev` → `features.md` passe automatiquement de `[~]` à `[x]`
- Les deux workflows commitent sur `dev` via un token d'authentification dédié

**Décision technique — authentification des workflows**

Les workflows doivent pusher sur `dev`. Le `GITHUB_TOKEN` par défaut est en lecture seule — deux options :

| Option | Description | Avantages | Inconvénients |
|---|---|---|---|
| **PAT personnel** | Token généré depuis le compte du développeur | Simple, rapide à mettre en place | Lié à une personne — si elle quitte, les workflows cassent |
| **Compte bot dédié** | Compte GitHub `sauver-la-face-bot` avec son propre PAT | Indépendant des personnes, révocable sans impact | Nécessite un second compte GitHub |

**Choix retenu : compte bot dédié (`sauver-la-face-bot`)**

Un PAT lié à un compte personnel crée une dépendance à une personne. Si le développeur quitte l'équipe ou change de compte, les workflows cassent silencieusement. Le compte bot est indépendant du turnover de l'équipe — c'est la pratique recommandée par GitHub pour les automatisations en équipe.

**Règles de code :**

- Créer le compte GitHub `sauver-la-face-bot` et lui donner accès au repo en tant que collaborateur
- Générer un PAT Fine-grained depuis ce compte avec uniquement `Contents: Read and write` sur ce repo
- Ajouter le token comme secret `GH_PAT` dans Settings → Secrets and variables → Actions
- Remplacer `token: ${{ secrets.GITHUB_TOKEN }}` par `token: ${{ secrets.GH_PAT }}` dans les deux workflows

---

### DEVOPS-02 — Reverse proxy Caddy avec TLS 1.3

`[ ]` `Caddyfile` · `docker-compose.yml`

**Comportement attendu :**

- Caddy termine le TLS en entrée et proxifie vers le backend Hono (`backend:3001`)
- TLS 1.3 obligatoire — TLS 1.2 et inférieurs rejetés
- En développement : certificat auto-signé généré automatiquement (`tls internal`)
- En production : certificat Let's Encrypt automatique via le domaine OVH

**Fichiers à créer/modifier :**

- `Caddyfile` à la racine — configuration du reverse proxy
- `docker-compose.yml` — ajouter le service `caddy` avec les ports 80 et 443

**Règles de code :**

- Le backend Hono n'expose jamais directement le port 3001 hors du réseau Docker — tout le trafic passe par Caddy
- `CADDY_DOMAIN` en variable d'environnement pour switcher entre dev (`localhost`) et prod (domaine réel)
- Le `Caddyfile` est monté en volume dans le service Docker — pas de rebuild image pour changer la config
- Ajouter `CADDY_DOMAIN` dans `.env.example` et `.env.local`

---

### DEVOPS-01 — Interface d'administration PostgreSQL (pgAdmin)

`[ ]` `docker-compose.yml`

**Comportement attendu :**

- pgAdmin accessible sur `http://localhost:8080`
- Connexion à la base PostgreSQL locale via l'interface web
- Authentification par email/mot de passe définis dans les variables d'environnement

**Règles de code :**

- Ajouter le service `pgadmin` dans `docker-compose.yml`
- Ajouter `PGADMIN_EMAIL` et `PGADMIN_PASSWORD` dans `.env.example` racine
- Le service ne doit tourner qu'en développement — ne jamais déployer en production

---

## WORKFLOW OBLIGATOIRE POUR LES AGENTS

### Démarrage d'une feature

1. `git checkout dev && git pull origin dev`
2. Créer la branche en respectant le format : `git checkout -b feature/XXX-00-nom`
3. Le statut passe automatiquement de `[ ]` à `[~]` via GitHub Actions dès la création de la branche.

### Clôture d'une feature (feature terminée)

Quand le code est prêt et testé, l'agent crée la PR manuellement vers `dev` :

```bash
gh pr create --base dev --title "feat: XXX-00 nom de la feature" --body "..."
```

- CodeRabbit review automatiquement la PR
- Une fois la PR mergée, le statut passe automatiquement de `[~]` à `[x]` via GitHub Actions

> **Aucun push direct sur `dev` n'est autorisé.**
> La PR est créée uniquement quand la feature est terminée et testée — pas avant.

---

## RÈGLES GLOBALES (toutes les features)

- **TDD obligatoire sur toutes les features** : l'agent écrit les tests en premier, génère l'implémentation pour les faire passer, puis le développeur valide. Ne jamais générer du code sans test associé.

- **Types** : toujours importer depuis `@sauver-la-face/shared`, jamais redéfinir
- **Backend** : router → service → repository. La logique métier va dans le service uniquement
- **Mobile** : toute donnée est d'abord écrite en SQLite, puis ajoutée à la `sync_queue`
- **Migrations** : additives uniquement (colonnes nullable), jamais de suppression
- **Nommage fichiers** : `feature.router.ts` / `feature.service.ts` / `feature.repository.ts`
- **Tests** : un fichier `feature.service.test.ts` par service critique
- **Logs** : utiliser Pino pour tout log backend — pas de `console.log`
- **Erreurs** : retourner des codes d'erreur explicites (`APP_UPDATE_REQUIRED`, `PHOTO_INTEGRITY_ERROR`, etc.)
