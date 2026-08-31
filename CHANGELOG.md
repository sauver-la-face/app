# Journal des modifications

Toutes les modifications notables de ce projet sont consignées dans ce fichier.

Le format s'appuie sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
et le projet suit le [versionnage sémantique](https://semver.org/lang/fr/).
Chaque version est marquée par un tag Git annoté (`vX.Y.Z`).

## [Non publié]

### Ajouté

- **DOCS-02** — structure documentaire : `docs/adr/` avec les 13 décisions techniques consignées une par fichier, `docs/security/owasp.md`, template d'architecture des six piliers, `docs/README.md`, dossiers `design/` et `brief/`
- **DOCS-02** — template de pull request et job CI `changelog` vérifiant qu'une entrée accompagne chaque PR

### Modifié

- **DOCS-02** — `docs/architecture.md` renommé en `docs/architectureAdr.md` pour libérer le chemin ; sa section « Décisions d'architecture » renvoie désormais vers `docs/adr/` au lieu de la dupliquer

Travaux en cours ou non démarrés :

- **DEVOPS-02** — Reverse proxy Caddy avec TLS 1.3 (en cours)
- **WEB-04** — Export des données depuis le dashboard (PDF / CSV)
- **WEB-05** — Envoi d'instructions pictographiques depuis le dashboard
- **MOB-01 à MOB-07**, **I18N-01** — Application mobile (non démarrée)

## [0.1.0] - 2026-08-21

Première version consolidée du monorepo : backend et dashboard web fonctionnels,
sécurisés et testés ; application mobile non démarrée. **Cette version n'est pas
déployée** — elle marque l'état du code à l'issue de la phase de développement.

### Ajouté

#### Backend (Hono · Drizzle · PostgreSQL)

- **AUTH-01** — Authentification des patients par code à 6 chiffres
- **AUTH-02** — Authentification des médecins avec MFA TOTP (Better Auth)
- **SYNC-01** — Réception des données mobiles et résolution des conflits (stratégie *server-wins*)
- **PATIENT-01** — CRUD patients et gestion des utilisateurs
- **ALERT-01** — Système d'alertes automatiques sur inactivité et symptômes critiques
- **PHOTO-01** — Stockage et validation des photos (S3/MinIO, checksum SHA-256)
- **INSTRUCTION-01** — Envoi d'instructions médicales aux patients
- **EXPORT-01** — Export des données patient au format PDF et CSV (conformité RGPD)
- **AUDIT-01** — Middleware d'audit logs sur les accès aux données de santé
- **API-01** — Documentation OpenAPI auto-générée exposée via Swagger UI
- **MED-01** — Référentiel des pictogrammes de symptômes (seed initial)

#### Dashboard web (Next.js App Router)

- **WEB-00** — Page de connexion médecin
- **WEB-01** — Tableau de bord médecin (liste des patients, alertes)
- **WEB-02** — Visualisation chronologique du suivi patient
- **WEB-03** — Gestion des utilisateurs et des codes d'accès patients
- **WEB-I18N-01** — Internationalisation du dashboard (français, anglais, khmer)
- **A11Y-01** — Corrections d'accessibilité WCAG 2.2 AA (contrastes, cibles tactiles)

#### Données

- Schéma Drizzle complet et migration initiale (patients, médecins, événements
  médicaux, symptômes, médias, instructions, codes d'accès)
- Anonymisation RGPD des patients
- Modèle logique de données (MLD) et export DBML documentés

#### Infrastructure et outillage

- Monorepo Bun workspaces (`apps/backend`, `apps/web`, `apps/mobile`, `packages/shared`)
- Chaîne d'intégration continue GitHub Actions : Biome, TypeScript, tests unitaires
- **DEVOPS-05** — Tests d'intégration backend sur PostgreSQL réel, avec CI dédiée
- **DEVOPS-06** — Suivi automatisé des dépendances vulnérables via Dependabot
  (écosystèmes `bun`, `docker`, `github-actions`)
- **DEVOPS-03** — Automatisation du statut des features via GitHub App (tokens éphémères)
- **DEVOPS-01** — Interface d'administration PostgreSQL (pgAdmin)
- **DEVOPS-07** — Alias TypeScript `@infrastructure/*` côté backend
- Docker Compose multi-stage avec profils `dev` et `prod`
- Revue de code automatisée CodeRabbit configurée en français
- Journalisation structurée avec Pino

#### Documentation

- **DOCS-01** — Audit OWASP Top 10 consigné dans `docs/architecture.md`
- **DEVOPS-08** — Documentation mise à jour après la séparation des tests
  unitaires et d'intégration
- **DEVOPS-09** — Workflow Git par *worktree* documenté dans `CLAUDE.md`
- **A11Y-02** — Standard des cibles tactiles mobile (48 dp) documenté

### Modifié

- Refonte du backend en Clean Architecture + DDD, découpée par feature
  (`presentation` → `application` → `domain` ← `infrastructure`)
- Convention de nommage `camelCase` appliquée à l'ensemble des fichiers backend
- Migration de Biome v1 vers v2
- Le package `packages/shared` est désormais compilé vers `dist/` pour être
  consommable par toutes les applications du monorepo
- Remplacement de `drizzle-kit push` par `db:migrate` dans la documentation et les scripts
- Les pictogrammes de symptômes remplacent le champ `severity` dans le schéma

### Corrigé

- **DEVOPS-04** — Réparation du système de migrations Drizzle (table de suivi absente)
- Dockerfile backend corrigé pour le contexte monorepo (`bun.lockb` → `bun.lock`)
- Chargement de `.env.local` par `drizzle-kit` via `dotenv-cli`
- Les usecases photos et exports ne bloquent plus le démarrage en l'absence de `DATABASE_URL`
- Configuration CORS et secrets d'authentification en environnement Docker de développement
- Compatibilité Windows des hooks (`bash -c`)

### Sécurité

- **SEC-01** — Authentification médecin obligatoire sur les routes patients,
  photos et exports (OWASP A01)
- **SEC-02** — Vérification du JWT patient côté serveur (OWASP A01 / A07)
- **DEVOPS-06** — Détection des dépendances vulnérables (OWASP A06)
- Bucket MinIO privé : les photos sont servies via un proxy backend authentifié,
  jamais exposées en accès direct
- Index unique fonctionnel `lower(mail)` sur la table `physician`
- Index d'unicité sur les codes patients actifs, empêchant toute réattribution
- Absence volontaire de `ON DELETE CASCADE` sur les données de santé (contrainte HDS)
- Cookie de locale durci (`SameSite` + `Secure`)
- Contraintes `CHECK` métier et index partiels sur les colonnes `revoked_at`

[Non publié]: https://github.com/sauver-la-face/app/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/sauver-la-face/app/releases/tag/v0.1.0
