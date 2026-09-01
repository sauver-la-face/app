# Journal des modifications

Toutes les modifications notables de ce projet sont consignées dans ce fichier.

Le format s'appuie sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
et le projet suit le [versionnage sémantique](https://semver.org/lang/fr/).
Chaque version est marquée par un tag Git annoté (`vX.Y.Z`).

## [Non publié]

### Ajouté

- **DEVOPS-12** — le dashboard web n'était pas déployable : `apps/web` n'avait aucun `Dockerfile` et n'apparaissait dans aucun fichier Compose, alors que le rapport de certification annonce Next.js parmi les quatre services de production. L'image est construite sur une base **Node et non `oven/bun`** — `next build` charge un runtime CommonJS compilé que Bun ne sait pas évaluer, ce que la CI ne rencontre pas puisqu'elle installe Node *et* Bun sur le runner. Caddy route désormais deux domaines : l'API vers `backend:3001`, le dashboard vers `web:3000`. Vérifié en construisant l'image et en interrogeant le conteneur (HTTP 200)
- **DOCS-02** — structure documentaire : `docs/adr/` avec les 13 décisions techniques consignées une par fichier, `docs/security/owasp.md`, template d'architecture des six piliers, `docs/README.md`, dossiers `design/` et `brief/`
- **DOCS-02** — template de pull request et job CI `changelog` vérifiant qu'une entrée accompagne chaque PR

### Corrigé

- **DOCKER-01** — `bun.lock` était listé dans `.dockerignore` : le `COPY package.json bun.lock* ./` du Dockerfile backend ne trouvait aucun verrou et, le glob tolérant l'absence, le build se poursuivait en silence. `bun install` résolvait alors chaque plage `^x.y.z` vers la dernière version publiée au lieu des versions verrouillées — l'image embarquait par exemple zod 4.5.4 quand le verrou fixe 4.4.3. Le glob est retiré pour que l'absence du verrou fasse échouer le build au lieu de le laisser dériver.

### Modifié

- **DEVOPS-02** — séparation des fichiers Compose. `docker-compose.prod.yml` n'existait pas : la séquence de déploiement documentée au rapport de certification échouait sur un fichier introuvable, aucun profil `prod` n'était déclaré, et le backend construisait `target: dev` en dur — la « production » livrait donc l'image de développement, avec le code de l'hôte monté par-dessus. Le développement vit maintenant dans `docker-compose.override.yml`, chargé automatiquement en local et ignoré dès qu'on passe des `-f` explicites
- **DEVOPS-02** — le script `docker:up:prod` utilisait `--env-file .env.local`, les identifiants de développement dans une commande nommée « prod ». Il lit désormais `.env.production` et échoue si le fichier est absent, plutôt que de démarrer silencieusement avec les mauvaises valeurs
- **DOCS-02** — accessibilité extraite dans `docs/accessibilite.md` ; décisions de schéma et de sécurité migrées en ADR 0015 à 0022
- **DOCS-02** — `docs/architecture.md` renommé en `docs/architectureAdr.md` pour libérer le chemin ; sa section « Décisions d'architecture » renvoie désormais vers `docs/adr/` au lieu de la dupliquer

### Corrigé

- **DEVOPS-10** — resynchronisation du snapshot Drizzle. `drizzle-kit generate` ne se connecte jamais à la base : il compare `schema.ts` au dernier snapshot. Or les migrations `0004` et `0005`, écrites à la main, n'en avaient jamais régénéré, laissant cette mémoire figée à l'état `0003`. Toute génération réémettait donc leurs opérations — un `ADD COLUMN last_synced_at` qui aurait échoué sur toute base déjà migrée. La migration `0006` est volontairement vide : elle ne porte que le snapshot à jour. `db:generate` répond désormais « No schema changes »
- **DEVOPS-10** — `patient_code_uuid_patient_idx` est déclaré dans `schema.ts`. L'index existait en base depuis `0000` sans y figurer, et Drizzle proposait de le supprimer à chaque génération alors que `getLatestCodes`, `revokeActiveCodes` et `revokeSession` s'appuient dessus

### Sécurité

- **SEC-04** (A01) — trois routes n'exigeaient aucune authentification. `GET /alerts` renvoyait le nom des patients associé à leurs symptômes — donnée de santé nominative — et fournissait les `patientId` ; `POST /auth/patient/generate` et `POST /auth/patient/renew` fabriquaient un code d'accès à six chiffres pour n'importe quel UUID et le renvoyaient en clair. Enchaînées, ces routes donnaient le contrôle du compte de n'importe quel patient, sans deviner quoi que ce soit — le rate limiting ne compte que les tentatives échouées. Les trois exigent désormais une session médecin
- **SEC-04** — `apps/backend/tests/routesProtegees.test.ts` parcourt la table de routage réelle de l'application montée en entier et impose que chaque route soit protégée ou explicitement déclarée publique. Une route non déclarée fait échouer la suite. C'est ce qui manquait à SEC-01, dont le périmètre était une liste écrite à la main où `alertRouter` et `authRouter` ne figuraient pas
- **DEVOPS-02** — le TLS de production n'existait pas. Le `Caddyfile` servait `:80` en HTTP simple, alors que l'ADR 0009, le tableau Sécurité de `architectureAdr.md` et le rapport de certification annoncent tous « TLS 1.3 obligatoire (RGPD + HDS), certificats Let's Encrypt automatiques ». Caddy ne provisionne un certificat que pour un nom d'hôte : une adresse `:80` ne déclenche jamais l'obtention automatique. `Caddyfile.prod` impose désormais TLS 1.3 minimum via `CADDY_DOMAIN_API` et `CADDY_DOMAIN_WEB`, avec HSTS et redirection HTTP → HTTPS
- **SEC-03** (A07) — révocation de session patient. Un token signé pour un an restait accepté indéfiniment : sa vérification ne consultait aucun état serveur, et `revokeActiveCodes()` ne touchait que les codes jamais consommés. Sur un appareil perdu, l'accès aux données médicales restait donc ouvert jusqu'à un an, sans aucun moyen de le couper. `DELETE /patients/{id}/session` révoque désormais le code porteur, que `requirePatientAuth` relit à chaque requête (401 `SESSION_REVOKED`)
- **SEC-03** — `GET /patients/{id}/instructions` devient `GET /me/instructions` : le garde médecin posé sur `/patients/*` masquait le garde patient, rendant la route injoignable depuis le mobile. L'identifiant disparaissant de l'URL, le contrôle 403 d'appartenance devient inutile — la classe de bug IDOR disparaît par construction
- **SEC-03** — l’unicité des codes patient est étendue aux codes déjà consommés (migration `0005`) : sans cela, révoquer une session libérait les six chiffres du code, réattribuables à un autre patient qui pouvait alors se voir refuser un code valide

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
