[← README](../README.md) · [Onboarding](onboarding.md) · [Architecture](architecture.md) · [Lexique](lexique.md)

# Analyse Architecte — Sauver la Face
> Version 4 — Choix révisés et alignés

---

## 1. Objectifs du projet

Développer une application de suivi post-opératoire permettant aux patients cambodgiens opérés lors de missions humanitaires de chirurgie maxillo-faciale de transmettre leurs informations médicales (photos, questionnaires) à leurs soignants en mode offline-first, avec synchronisation automatique. Les chirurgiens toulousains effectuent des missions ponctuelles au Cambodge puis assurent le suivi à distance sur le long terme. Fournir aux chirurgiens toulousains et médecins locaux un tableau de bord web pour surveiller les patients à distance, gérer les alertes et planifier les missions.

---

## 2. Personas

**Persona 1 : Patient cambodgien post-opératoire**
- Profil : 25-65 ans, zone rurale/urbaine, revenus limités, smartphone Android bas de gamme
- Contexte usage : Domicile sans connexion fiable, utilisation hebdomadaire pour suivi médical
- Besoins : Interface simple pictographique, fonctionnement offline, saisie rapide symptômes/photos
- Niveau tech : Débutant, usage basique smartphone, lecture khmer/pictogrammes uniquement

**Persona 2 : Chirurgien toulousain**
- Profil : 35-60 ans, CHU Toulouse, expert chirurgie maxillo-faciale
- Contexte usage : Bureau/déplacement, consultation quotidienne patients, préparation missions
- Besoins : Vue d'ensemble patients, alertes critiques, historique complet, export données
- Niveau tech : Intermédiaire, utilisation web courante, formation rapide outils

**Persona 3 : Médecin cambodgien local**
- Profil : 30-55 ans, centre médical/hôpital local, suivi post-opératoire
- Contexte usage : Consultations patients, liaison chirurgiens France, connexion intermittente
- Besoins : Accès données patient, instructions pictographiques, gestion codes accès
- Niveau tech : Intermédiaire, français/anglais limité, préfère interface multilingue

---

## 3. Fonctionnalités must-have

### 📱 Mobile (patient)
1. **Consentement RGPD** : écran obligatoire au premier lancement avant toute collecte, acceptation ou refus explicite avec pictogrammes, date de consentement sauvegardée
2. **Authentification patient** : connexion code 6 chiffres, JWT valide pour toujours une fois activé, code expiré après 48h si non utilisé, renouvellement du code par médecin local uniquement
3. **Interface pictographique** : navigation max 2 clics, boutons min 48x48 dp, langues khmer/français/anglais
4. **Capture photos cicatrices** : appareil photo intégré, compression automatique, horodatage
5. **Questionnaire symptômes** : questions visuelles via pictogrammes, réponses simples par tap
6. **Mode offline complet** : 100% fonctionnalités mobiles sans réseau, stockage local SQLite 50 Mo max
7. **Synchronisation automatique** : détection connexion, upload silencieux, stratégie server-wins pour conflits
8. **Instructions médicales** : consultation des consignes pictographiques envoyées par le chirurgien, accusé réception

### 🖥️ Frontend web (médecins)
8. **Tableau de bord médecin** : liste patients, alertes symptômes critiques
9. **Visualisation chronologique** : historique photos par patient, évolution symptômes, graphiques tendances
10. **Gestion utilisateurs** : création comptes patients, attribution codes accès, rôles médecin local/chirurgien
11. **Export données** : PDF rapport patient, CSV données anonymisées, respect RGPD
12. **Instructions médicales** : envoi consignes pictographiques vers le patient

### ⚙️ Backend
13. **API REST sécurisée** : endpoints authentifiés, validation Zod, documentation OpenAPI auto-générée
14. **Système alertes** : alertes automatiques via pictogrammes de symptômes (`triggers_alert`), notifications temps réel médecins
15. **Gestion synchronisation** : réception données offline, résolution conflits server-wins, versioning schéma
16. **Stockage photos** : réception, validation checksum SHA-256, stockage MinIO HDS
17. **Authentification** : codes patients 6 chiffres + expiration 48h, MFA médecins web

## 4. Fonctionnalités nice-to-have

### 📱 Mobile (patient)
1. **Reconnaissance vocale** : saisie symptômes voix khmer, transcription automatique
2. **Notifications push** : rappels prise photos, instructions médecin, rendez-vous
3. **Mode hors-ligne étendu** : cache 100 Mo, rétention 6 mois données locales
4. **Multi-device sync** : synchronisation données entre tablette/smartphone patient

### 🖥️ Frontend web (médecins)
5. **Tableau de bord statistiques** : KPI missions, taux guérison, données épidémiologiques
6. **Géolocalisation avancée** : cartographie patients par région, statistiques géographiques

### ⚙️ Backend
7. **Analyse IA photos** : détection automatique anomalies cicatrices, scoring risque infection
8. **API tiers** : intégration dossiers patients existants, connexion FHIR standard

---

## 5. Contraintes techniques

### Volumes
- Patients actifs simultanés : 200 max
- Utilisateurs web simultanés : 20 max (médecins/chirurgiens)
- Taille cache local SQLite : 50 Mo max par appareil
- Nombre photos par patient : 50 max historique
- Taille APK Android : < 30 Mo
- Taille base PostgreSQL : 10 Go estimés année 1

### Performance
- Temps lancement application mobile : < 3s (95e percentile)
- Temps réponse API web : < 500ms (95e percentile)
- Temps compression/upload photo : < 10s par image 2 Mo
- Temps synchronisation offline complète : < 2 min pour 50 Mo

### Réseau
- Seuil connexion minimum : 64 kbps EDGE/2G compatible
- Timeout requête API : 30s avec retry automatique
- Retry policy : backoff exponentiel 1s, 2s, 4s, 8s, abandon après 15s
- Compression données : gzip transport, images JPEG qualité 80%

### Synchronisation offline
- Stratégie conflits : server-wins (priorité serveur)
- Taille cache max : 50 Mo par appareil, purge photos anciennes
- Délai synchronisation max : 7 jours avant alerte médecin
- Rétention locale : 90 jours données patient, photos 30 jours

---

## 6. Contraintes non-techniques

### RGPD
- Consentement explicite collecte données médicales lors première connexion
- Droit suppression : anonymisation compte après 3 ans inactivité, suppression immédiate sur demande
- Droit portabilité : export JSON/CSV données patient
- Notification violations : procédure 72h CNIL
- Durée conservation : 10 ans données médicales (obligation légale), 3 ans logs techniques

### Sécurité

**Authentification :**
- Patients : code numérique 6 chiffres, JWT valide pour toujours une fois activé, expiration du code après 48h si non utilisé, renouvellement du code par médecin local uniquement
- Médecins web : MFA obligatoire TOTP, session timeout 2h d'inactivité (postes partagés hôpitaux), renouvellement silencieux automatique tant qu'actif
- Tokens JWT signés HMAC-SHA256

**Rate limiting :**
- 3 tentatives échouées → blocage 15 minutes par IP (patients et médecins)
- Indépendant de l'expiration 48h du code patient

**CSRF :**
- Cookies `SameSite=Strict` sur le dashboard web — géré par Better Auth

**Chiffrement :**
- AES-256-GCM en local sur l'appareil (expo-secure-store)
- TLS 1.3 obligatoire en transit (terminé par Caddy)
- Chiffrement disque au niveau infrastructure assuré par OVH HDS — pas de chiffrement colonne PostgreSQL nécessaire
- Rotation des clés JWT et credentials OVH S3 tous les 90 jours (production uniquement)

**Logs audit :**
- Connexions : horodatage UTC, IP, user-agent, succès/échec
- Actions médicales : consultation dossier, modification, export
- Rétention : 1 an logs audit, 3 mois logs techniques
- Stockage : Pino écrit en fichier local, export journalier vers S3 (MinIO en dev, OVH Object Storage certifié HDS en prod) dans un bucket dédié `logs-audit`

### SLA
- Disponibilité application mobile : 99.5% (mode offline compense les interruptions)
- Disponibilité tableau de bord web : 99.9%
- Temps résolution incident critique : 4h
- Temps résolution incident mineur : 24h

### Légales
- Hébergement : HDS certifié obligatoire — **OVH Cloud retenu** (société française, données sous droit français — risque CLOUD Act réduit mais non nul ; mitigations : juridiction française, contrat DPA avec OVH, données chiffrées AES-256 au repos et TLS 1.3 en transit)
- Juridiction : droit français, serveurs UE uniquement
- Responsabilité médicale : app = outil d'aide à la décision, responsabilité médecin
- Audit sécurité : annuel par organisme certifié

---

## 7. Choix technologiques

### Structure du projet — Monorepo Bun Workspaces

Un seul dépôt Git géré avec les workspaces natifs de Bun. Turborepo écarté — les volumes du projet ne justifient pas l'outil supplémentaire, Bun workspaces couvre tous les besoins.

```text
sauver-la-face/
  apps/
    backend/        ← Bun + Hono
    web/            ← Next.js (dashboard médecins)
    mobile/         ← React Native + Expo
  packages/
    shared/         ← Zod schemas + types TypeScript communs
    config/         ← tsconfig, biome.json partagés
  package.json      ← workspaces Bun
  docker-compose.yml
  biome.json
```

Le package `shared/` contient les schémas Zod définis une seule fois et consommés par les trois apps — c'est le ciment de la cohérence des types entre backend, dashboard et mobile.

---

### BACKEND

#### 1. Runtime — Bun
TypeScript natif sans transpilation. Performances I/O supérieures pour les uploads photos sur réseau 2G/3G. Package manager et test runner intégrés, zéro configuration supplémentaire.

#### 2. Framework HTTP — Hono
Framework léger, TypeScript-first, compatible Bun. Génération OpenAPI automatique via `@hono/zod-openapi` — la documentation API est générée depuis les schémas Zod sans effort manuel.

#### 3. Base de données — PostgreSQL
Conformité HDS avec chiffrement au niveau colonnes pour données médicales. Transactions ACID pour garantir la cohérence lors des synchronisations offline. Support JSON natif pour les métadonnées photos.

#### 4. ORM — Drizzle
TypeScript-first, performances proches du SQL brut, migrations versionnées via `drizzle-kit`. Les types de schéma sont partageables avec le package `shared/` pour cohérence totale entre la base de données et les trois apps.

#### 5. Authentification — Better Auth
MFA TOTP obligatoire pour les médecins web. Gestion des codes 6 chiffres patients avec session expirant après 48h d'inactivité. Compatible expo-secure-store pour le stockage sécurisé des tokens mobiles. Sessions stockées en PostgreSQL.

#### 6. Stockage photos — MinIO
Stockage S3-compatible auto-hébergé sur OVH HDS. Versioning des photos cicatrices, chiffrement AES-256 at-rest. Réplication synchrone entre deux buckets OVH (Strasbourg ↔ Roubaix).

#### 7. Logs — Pino
Logger JSON structuré, performant, compatible outils de centralisation (Loki). Audit trail complet pour conformité HDS.

#### 8. Tests — bun:test + TDD
Test runner natif Bun, zéro configuration, API compatible Jest. Couverture de code intégrée.

**Approche TDD ciblée sur les trois apps** — le test est écrit avant l'implémentation sur toutes les parties critiques :

**Backend :**
- Logique de synchronisation offline (server-wins, conflits, versioning schéma)
- Alertes médicales automatiques via pictogrammes de symptômes (`triggers_alert`) et inactivité 7 jours
- Authentification patient (code 6 chiffres, expiration 48h)
- Exports PDF/CSV RGPD

**Mobile :**
- Queue de synchronisation SQLite (retry, backoff, purge)
- Compression et validation photos (magic bytes, checksum)
- Expiration session 48h et renouvellement de code
- Gestion des conflits offline à la reconnexion

**Dashboard web :**
- Affichage et déclenchement des alertes critiques
- Exports PDF/CSV et conformité RGPD
- Hooks TanStack Query (états de chargement, invalidation cache)

Sur les composants UI et les écrans, du testing classique post-implémentation suffit.

**Workflow avec agents IA :** le développeur écrit le test, l'agent génère l'implémentation pour le faire passer, le développeur valide. Cela garantit que le code généré est correct et compris par l'équipe.

> **Supprimé : Redis + BullMQ.** Queue de synchronisation gérée côté mobile en SQLite. Les volumes (200 patients, 20 utilisateurs web) ne justifient pas un service de queue dédié. Ajout possible ultérieurement en une journée si le besoin se présente.

---

### FRONTEND WEB

#### 9. Framework — Next.js
App Router + Server Components. Choix assumé pour la montée en compétence de l'équipe — stack la plus demandée sur le marché. Les contraintes SSR/SEO ne s'appliquent pas à ce dashboard interne, mais la maîtrise de Next.js a une valeur pédagogique et professionnelle réelle.

#### 10. Data fetching — TanStack Query
Cache serveur, états de chargement, invalidation automatique pour les données patients en temps réel. S'intègre naturellement avec Next.js App Router. Alertes temps réel gérées par **polling** via `refetchInterval` TanStack Query — suffisant pour les volumes (20 utilisateurs web max), sans la complexité d'une connexion WebSocket ou SSE.

#### 12. UI — Tailwind CSS
Utility-first CSS, intégré nativement avec Next.js. Permet de construire rapidement un design system cohérent sans écrire de CSS custom. Cohérent avec la charte graphique du projet.

---

### MOBILE

#### 11. Framework — React Native + Expo
Cross-platform Android/iOS. Performance native nécessaire pour les appareils Android bas de gamme (API 26+). APK < 30 Mo respecté avec Expo bare workflow.

#### 12. Stockage offline — expo-sqlite
SQLite embarqué, 100% fonctionnel sans réseau. Transactions ACID pour la cohérence des données offline. La queue de synchronisation est implémentée directement en SQLite — une table `sync_queue` stocke les actions en attente et les envoie séquentiellement à la reconnexion.

#### 13. Sécurité locale — expo-secure-store
Chiffrement AES-256 des tokens JWT. Utilise le Keystore Android et le Keychain iOS. Résiste à l'extraction même sur appareils rootés.

#### 14. Internationalisation — i18next + expo-localization
Khmer (défaut) / français / anglais. Détection automatique de la locale système. Chargement lazy pour maintenir l'APK < 30 Mo.

#### 15. Notifications — expo-notifications
Deux types de notifications :
- **Locales** : rappels hebdomadaires générés directement par l'app (prise de photos, questionnaire) — fonctionnels en mode offline complet, sans serveur
- **Push** : notifications envoyées depuis le backend via Expo Push Service (nouvelles instructions médicales) — nécessitent une connexion, token Expo stocké dans `expo-secure-store`

---

### SHARED

#### 16. Validation et types partagés — Zod
Schémas définis une seule fois dans `packages/shared/` et consommés par le backend, le dashboard et le mobile. Élimine toute divergence de types entre les trois applications. Génération automatique des schémas OpenAPI via `@hono/zod-openapi`.

---

### DEVOPS

#### 17. Monorepo — Bun Workspaces
Workspaces natifs Bun pour gérer les dépendances entre apps et lier le package `shared/`. Turborepo écarté — Bun workspaces couvre tous les besoins du projet à ce stade.

#### 18. Reverse proxy — Caddy
TLS 1.3 obligatoire pour les données de santé (RGPD + HDS) — Caddy le gère par défaut. Certificats Let's Encrypt automatiques, renouvellement inclus. En développement, certificat auto-signé en une ligne (`tls internal`). Hono ne termine jamais le TLS directement — Caddy est la seule porte d'entrée exposée à Internet. Choix retenu face à Nginx (configuration SSL manuelle complexe) et Traefik (courbe d'apprentissage élevée).

#### 19. Containers — Docker + Docker Compose
Déploiement reproductible sur OVH HDS. Docker Compose orchestre **4 services en production** : Caddy (reverse proxy), backend Hono, PostgreSQL, MinIO. pgAdmin est un outil d'administration réservé au développement — activé uniquement via `--profile dev`, jamais déployé en production.

#### 20. CI/CD — GitHub Actions
Tests automatisés, déploiements zero-downtime. Pipelines exécutés uniquement sur les packages affectés par chaque PR.

**Workflows automatisés :**

| Déclencheur | Workflow | Action |
|---|---|---|
| Création branche `feature/XXX-00-nom` | `feature-in-progress.yml` | `features.md` → `[~]` (en cours) pushé sur `dev` |
| Push sur une PR | `ci.yml` | Biome lint + TypeScript typecheck + tests — bloquant |
| PR ouverte vers `dev` | CodeRabbit | Review qualitative automatique (logique, architecture, sécurité) |
| PR mergée sur `dev` | `update-feature-status.yml` | `features.md` → `[x]` (terminé) pushé sur `dev` |

**Règle de nommage des branches :** `feature/XXX-00-nom-de-la-feature` (ex: `feature/AUTH-01-authentification-patient`) — obligatoire pour que les workflows fonctionnent.

#### 21. Linter / Formatter — Biome
Remplace ESLint + Prettier en un seul outil. Cohérent avec l'écosystème Bun. Configuration unique à la racine via `biome.json`.

#### 22. Git workflow — GitHub Flow
Une branche par feature, PR obligatoire pour merge sur `dev` et sur `main`. La branche `dev` est la référence pour récupérer le code à jour — chaque développeur rebase depuis `dev` avant de démarrer une feature. La branche `main` est réservée aux releases stables déployées en production.

**Reviewers :**
- PR vers `dev` : review automatique par **CodeRabbit** (IA) — détection bugs, incohérences de types, problèmes de sécurité ligne par ligne
- PR vers `main` : review humaine obligatoire par le chef de projet uniquement — seul habilité à merger en production

**Fichier `.github/CODEOWNERS`** définit ces règles de review au niveau du repo.

---

### Alternatives écartées

| Technologie | Raison |
|---|---|
| Redis + BullMQ | Volumes insuffisants, queue gérée en SQLite côté mobile |
| Turborepo | Bun workspaces natifs suffisants pour la taille du projet |
| Vite + React + TanStack Router | Remplacé par Next.js pour la montée en compétence |
| Firebase | Hébergement Google US, incompatible HDS et offline-first |
| Node.js + Express | Remplacé par Bun + Hono, TypeScript natif, meilleures perfs I/O |
| ESLint + Prettier | Remplacés par Biome, cohérent avec l'écosystème Bun |
| Multi-repos | Types Zod partagés imposent un dépôt unique |
| AWS RDS | OVH Cloud retenu, meilleure conformité droit français |

---

## 8. Architecture du code — Feature-Based

Code organisé par domaine métier. Chaque feature est un module autonome avec ses propres composants, services et tests.

### Backend (Hono) — Feature-based + Clean Architecture

4 couches par feature. Dépendances : `presentation → application → domain ← infrastructure`. La logique métier est isolée dans `domain/` — testable sans base de données.

```text
apps/backend/src/
  features/
    patients/
      presentation/
        patients.router.ts      ← routes Hono + validation Zod
      application/
        patients.usecase.ts     ← orchestration (TDD)
      domain/
        patients.domain.ts      ← règles métier pures (TDD)
      infrastructure/
        patients.repository.ts  ← requêtes Drizzle/PostgreSQL
    sync/     ← même structure (server-wins, versioning schéma)
    alerts/   ← même structure (triggers_alert pictogrammes)
    exports/  ← même structure (PDF, CSV RGPD)
    auth/     ← même structure (Better Auth, MFA, codes 6 chiffres)
  shared/
    middleware/               ← audit Pino, auth guard
    database/                 ← Drizzle client, migrations
    storage/                  ← MinIO client
```

### Dashboard web (Next.js) — App Router natif

La structure de Next.js App Router organise les pages. Les composants et hooks réutilisables sont regroupés dans `components/` et `hooks/`. Plus pragmatique pour une équipe qui découvre Next.js.

```text
apps/web/src/
  app/                        ← routing Next.js natif
    dashboard/
    patients/[id]/
    alerts/
    exports/
    auth/
  components/                 ← composants réutilisables
  hooks/                      ← TanStack Query hooks
  lib/                        ← helpers, formatters
```

### Mobile (React Native) — Feature-based avec storage offline par feature

Chaque feature gère son propre état SQLite local et sa queue de sync. La couche `storage/` par feature est essentielle pour isoler la logique offline de chaque domaine.

```text
apps/mobile/src/
  features/
    consent/                  ← consentement RGPD (premier écran obligatoire)
    auth/
      screens/                ← écran code 6 chiffres
      hooks/                  ← session, expiration 48h
      storage/                ← token expo-secure-store
    questionnaire/
      screens/
      hooks/
      storage/                ← SQLite local + sync queue
    photos/
      screens/
      hooks/
      storage/                ← SQLite + compression
    instructions/
      screens/
      hooks/
      storage/                ← cache offline instructions
    sync/
      syncService.ts          ← orchestration queue SQLite
      syncQueue.ts            ← table sync_queue, retry logic
    notifications/
      localService.ts         ← rappels hebdomadaires offline
      pushService.ts          ← token Expo + notifications serveur
  shared/
    components/               ← pictogrammes, boutons
    i18n/                     ← khmer / français / anglais (i18next)
    storage/                  ← expo-sqlite client partagé
    utils/
```

---

## 9. Stratégie de migration de schéma (offline)

Un patient peut rester offline jusqu'à 7 jours. Si le schéma backend évolue pendant cette période, sa base SQLite locale est désynchronisée à la reconnexion.

### Règles de versioning
- Version de schéma incrémentale (`schema_version`) stockée dans la table `meta` SQLite côté mobile et dans la configuration backend.
- Migrations **toujours additives** : ajout de colonnes nullable uniquement. Aucune suppression ni renommage pendant une mission active.

### Négociation à la synchronisation

```
client_version == server_version  → sync normale
client_version < server_version   → envoi payload de migration avant sync
client_version > server_version   → rejet APP_UPDATE_REQUIRED
```

### Règle de gel des déploiements
Aucun changement de schéma déployé pendant une mission active. Le flag `mission_active` dans la configuration OVH bloque les déploiements de schéma en CI/CD. Le backend accepte les deux dernières versions de schéma (`N` et `N-1`).

---

## 10. Plan de reprise d'activité (PRA)

| Indicateur | Valeur | Périmètre |
|---|---|---|
| RTO | 4h | Données patient inaccessibles |
| RPO | 24h | Perte de données maximale acceptable |
| RTO dégradé | 30 min | Tableau de bord en lecture seule |

**PostgreSQL :** snapshot quotidien chiffré AES-256 sur OVH Object Storage, rétention 30 jours, test de restauration mensuel automatisé.

**MinIO :** réplication synchrone Strasbourg ↔ Roubaix, bascule automatique, rétention 10 ans.

**Mode dégradé dashboard :** lecture seule via service worker, bannière d'alerte horodatée, actions d'écriture désactivées. Les apps mobiles continuent de fonctionner normalement en offline.

---

## 11. Gestion des erreurs de synchronisation

### Photos corrompues

Validation mobile avant upload : magic bytes JPEG, taille > 0, dimensions minimales 200×200 px. Si KO → `status: corrupted` en SQLite, pictogramme d'erreur patient.

Validation backend : checksum SHA-256 comparé à la réception. Si mismatch → rejet `PHOTO_INTEGRITY_ERROR`.

Retry : backoff 2s puis 4s, abandon à la 4e tentative avec alerte dashboard médecin.

### Autres erreurs

| Type d'erreur | Comportement mobile | Comportement backend |
|---|---|---|
| Timeout réseau | Retry backoff exponentiel (1s, 2s, 4s, 8s) | — |
| Conflit de données | Résolution server-wins automatique | Log du conflit avec delta |
| Token expiré | Renouvellement silencieux | Réponse 401 + refresh token |
| Quota SQLite atteint | Purge photos > 30 jours, alerte patient | — |
| Version schéma incompatible | Blocage sync + message mise à jour app | Rejet APP_UPDATE_REQUIRED |

---

## 12. Schéma de base de données — Drizzle + PostgreSQL

Basé sur le MCD validé. `PatientCode` supporte plusieurs codes dans le temps par patient, un seul actif à la fois (le dernier non expiré et non utilisé).

```typescript
// packages/shared/src/schema.ts — voir le fichier source pour le schéma complet et à jour

export const physician = pgTable('physician', { /* uuid, first_name, last_name, phone_number, mail, password_hash */ })
export const patient = pgTable('patient', { /* uuid, first_name, last_name, sex, birthdate, region */ })
export const patientCode = pgTable('patient_code', { /* uuid, uuid_patient FK, code, created_at, used_at, deleted_at, is_active */ })
export const medicalProcedure = pgTable('medical_procedure', { /* uuid, uuid_patient FK, procedure_type, date, hospital_name */ })
export const medicalEvent = pgTable('medical_event', { /* uuid, uuid_medical_procedure FK, uuid_physician FK, event_type, event_title, description, created_at */ })

// Pictogrammes de symptômes — liste à valider avec les chirurgiens (MED-01)
export const symptom = pgTable('symptom', { /* uuid, code, label_fr, label_km, triggers_alert */ })
export const medicalEventSymptom = pgTable('medical_event_symptom', { /* uuid, uuid_event FK, uuid_symptom FK */ })

export const media = pgTable('media', { /* uuid, uuid_event FK, file_url, file_type, taken_at, description */ })
export const instructions = pgTable('instructions', { /* uuid, uuid_physician FK, uuid_medical_procedure FK, content, created_at, acknowledged_at */ })
```

> Le schéma complet et à jour est dans `packages/shared/src/schema.ts` — cette section est un résumé.

---

## 13. Variables d'environnement

Stratégie :
- `.env` — valeurs dev par défaut, **commité** (sans secrets)
- `.env.local` — overrides locaux du développeur, **gitignorés** (ne jamais utiliser en prod)
- **Production** — variables d'environnement injectées par la plateforme (Docker secrets, variables d'environnement du service d'hébergement, ou gestionnaire de secrets) — jamais de fichier `.env.local` en prod

### Backend (`apps/backend/.env`)

```env
# Base de données
DATABASE_URL=postgresql://user:password@localhost:5432/sauver_la_face

# Better Auth
BETTER_AUTH_SECRET=                  # secret JWT, générer avec: openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3001

# MinIO (stockage photos)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
MINIO_BUCKET_PHOTOS=photos
MINIO_USE_SSL=false                  # true en production

# App
NODE_ENV=development
PORT=3001

# Logs (optionnel — niveaux : trace | debug | info | warn | error | fatal)
# Par défaut : "debug" en développement, "info" en production
LOG_LEVEL=

# S3 — Logs d'audit (dev : MinIO local, prod : OVH Object Storage)
S3_ENDPOINT=localhost          # prod : s3.gra.io.cloud.ovh.net
S3_PORT=9000                   # prod : 443
S3_USE_SSL=false               # prod : true
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET_LOGS=logs-audit
```

### Dashboard web (`apps/web/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
# Pas de BETTER_AUTH_SECRET ici — la validation des tokens est déléguée au backend via HTTP
```

### Mobile (`apps/mobile/.env`)

```env
EXPO_PUBLIC_API_URL=http://localhost:3001
```

### Docker Compose (`docker-compose.yml`)

```env
POSTGRES_USER=sauver
POSTGRES_PASSWORD=
POSTGRES_DB=sauver_la_face
MINIO_ROOT_USER=
MINIO_ROOT_PASSWORD=
```

---

## 14. Versions des dépendances clés

Versions fixées pour garantir la reproductibilité entre les membres de l'équipe.

### Runtime et outils
| Outil | Version |
|---|---|
| Bun | 1.1.x (latest stable) |
| Node.js | 20.x LTS (compatibilité Expo) |
| Docker | 24.x+ |

### Backend
| Package | Version |
|---|---|
| hono | 4.x |
| @hono/zod-openapi | 0.16.x |
| drizzle-orm | 0.45.x |
| drizzle-kit | 0.31.x |
| better-auth | 1.x |
| zod | 3.x |
| pino | 9.x |

### Dashboard web
| Package | Version |
|---|---|
| next | 14.x (App Router) |
| react | 18.x |
| @tanstack/react-query | 5.x |
| tailwindcss | 3.x |
| typescript | 5.x |

### Mobile
| Package | Version |
|---|---|
| expo | SDK 52 |
| react-native | 0.76.x (inclus SDK 52) |
| expo-sqlite | 14.x |
| expo-secure-store | 13.x |
| expo-notifications | 0.29.x |
| expo-localization | 15.x |
| i18next | 23.x |
| react-i18next | 14.x |

### Shared
| Package | Version |
|---|---|
| zod | 3.x |
| typescript | 5.x |

---

*Projet Sauver la Face — Ydays 2025/2026 — Version 4*
