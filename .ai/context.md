[← README](../README.md) · [Features](features.md) · [Onboarding](../docs/onboarding.md) · [Architecture](../docs/architecture.md) · [CDC](../docs/cdc.md)

# Contexte projet — Sauver la Face

> Ce fichier est destiné aux assistants IA pour prendre connaissance du projet avant de générer du code.
> Lire ce fichier en priorité, puis consulter `docs/cdc.md` pour le détail complet.

---

## Résumé du projet

Application de suivi post-opératoire pour patients cambodgiens opérés lors de missions humanitaires de chirurgie maxillo-faciale. Les chirurgiens toulousains effectuent des missions ponctuelles au Cambodge, opèrent les patients, puis rentrent en France. Le suivi post-opératoire se poursuit ensuite à distance sur le long terme : les patients envoient photos et questionnaires en mode offline-first, et les médecins locaux comme les chirurgiens toulousains surveillent l'évolution des patients et mettent à jour les dossiers via un dashboard web.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Monorepo | Bun Workspaces |
| Backend | Bun + Hono + Drizzle ORM + PostgreSQL |
| Auth | Better Auth (MFA médecins, codes 6 chiffres patients) |
| Stockage photos | MinIO (dev) / OVH Object Storage S3 (prod) |
| Logs d'audit | MinIO bucket `logs-audit` (dev) / OVH Object Storage bucket `logs-audit` (prod, HDS) |
| Logs | Pino |
| Dashboard web | Next.js 14 (App Router) + TanStack Query + Tailwind CSS |
| Mobile | React Native + Expo SDK 52 |
| Offline mobile | expo-sqlite + queue de sync SQLite |
| Sécurité locale | expo-secure-store (AES-256) |
| i18n | i18next + expo-localization (khmer / français / anglais) |
| Types partagés | Zod (package `@sauver-la-face/shared`) |
| Linter/Format | Biome |
| Tests | bun:test (TDD sur les parties critiques) |
| CI/CD | GitHub Actions |
| Containers | Docker + Docker Compose |
| Reverse proxy | Caddy (TLS 1.3, certificats automatiques) |
| API Documentation | @hono/zod-openapi → Swagger UI + client TypeScript généré |
| Notifications mobile | expo-notifications (locales offline + push serveur) |

---

## Architecture du code

### Backend — Feature-based, 3 couches par feature
```
apps/backend/src/features/
  patients/     → patients.router.ts / patients.service.ts / patients.repository.ts
  sync/         → logique server-wins, versioning schéma (TDD)
  alerts/       → seuils douleur > 7, saignement (TDD)
  exports/      → PDF, CSV RGPD
  auth/         → Better Auth, MFA, codes 6 chiffres (TDD)
```

### Dashboard web — Next.js App Router
```
apps/web/src/
  app/          → routing natif Next.js
  components/   → composants réutilisables
  hooks/        → TanStack Query hooks
  lib/          → helpers, formatters
```

### Mobile — Feature-based avec storage offline par feature

> Architecture cible — les dossiers seront créés au fur et à mesure de l'implémentation des features (voir `features.md`)

```text
apps/mobile/src/features/
  consent/      → consentement RGPD première connexion (obligatoire avant tout)
  auth/         → code 6 chiffres, session, expo-secure-store
  questionnaire/ → SQLite local + sync queue
  photos/       → SQLite + compression JPEG
  instructions/ → cache offline, acknowledged_at
  sync/         → orchestration queue SQLite, retry backoff
  notifications/ → rappels locaux + push serveur (token Expo)
```

---

## Règles critiques à respecter

### Sécurité
- TLS 1.3 obligatoire en transit — terminé par Caddy, jamais exposé directement par Hono
- AES-256-GCM pour le stockage local (expo-secure-store)
- MFA TOTP obligatoire pour les médecins web
- Jamais de `BETTER_AUTH_SECRET` côté Next.js — validation déléguée au backend
- Hébergement HDS certifié uniquement (OVH Cloud)
- Token push Expo stocké dans `expo-secure-store` — jamais en clair

### RGPD
- Consentement explicite obligatoire au premier lancement de l'app mobile (MOB-01) — avant toute collecte
- La date de consentement (`consent_given_at`) est sauvegardée dans `expo-secure-store`
- Jamais logger de données patient (nom, prénom, date de naissance) dans Pino

### Offline & synchronisation
- Stratégie conflits : **server-wins** (le serveur a toujours raison)
- Queue de sync : table `sync_queue` en SQLite, retry backoff exponentiel (1s, 2s, 4s, 8s)
- Migrations de schéma : **toujours additives** (colonnes nullable uniquement, jamais de suppression)

### Codes patients
- Code numérique 6 chiffres, soft delete automatique après 48h si non utilisé
- Une fois utilisé (`used_at NOT NULL`), valide pour toujours
- Renouvellement uniquement par le médecin local

### Logs
- Toujours importer le logger depuis `apps/backend/src/shared/logger.ts` — ne jamais créer une instance Pino locale
- Jamais de `console.log` dans le backend
- Niveaux disponibles : `trace` | `debug` | `info` | `warn` | `error` | `fatal`
- Par défaut : `debug` en développement, `info` en production
- Pour forcer un niveau sans toucher au code, définir `LOG_LEVEL` dans `.env.local`
- Quand utiliser quel niveau :
  - `debug` — détails internes utiles pendant le développement (ex: payload reçu)
  - `info` — événements normaux et attendus (ex: patient créé, sync réussie)
  - `warn` — situation anormale mais non bloquante (ex: tentative sur code expiré)
  - `error` — erreur impactant une opération (ex: checksum mismatch, échec sync)
  - `fatal` — erreur critique qui arrête le serveur

### Alertes temps réel
- Polling via `refetchInterval` TanStack Query (pas de WebSocket ni SSE)
- Seuil alerte automatique : douleur > 7 ou saignement présent

### Tests (TDD)
- Tests écrits **avant** l'implémentation sur : sync, alertes, auth, exports
- Le développeur écrit le test → l'IA génère l'implémentation → le développeur valide

### Git workflow
- Branche `dev` : référence de travail, rebase obligatoire avant chaque feature
- Branche `main` : production uniquement, review humaine obligatoire
- PR vers `dev` : review CodeRabbit (IA)
- PR vers `main` : review chef de projet uniquement

---

## Schéma de base de données (Drizzle)

Voir `packages/shared/src/schema.ts` pour le schéma complet.

Tables principales :
- `physician` — médecins et chirurgiens (mêmes droits)
- `patient` — données démographiques patient
- `patient_code` — codes 6 chiffres d'accès (soft delete 48h si non utilisé)
- `medical_procedure` — interventions chirurgicales
- `medical_event` — événements médicaux post-op (symptômes via pictogrammes)
- `symptom` — liste des pictogrammes de symptômes (`triggers_alert` pour les alertes auto) — liste à valider avec les chirurgiens (MED-01)
- `medical_event_symptom` — relation N-N entre événement et symptômes sélectionnés
- `media` — photos de cicatrices (stockées dans MinIO)
- `instructions` — consignes médicales envoyées au patient (acknowledged_at)

---

## Contraintes volumes

- 200 patients actifs simultanés max
- 20 utilisateurs web simultanés max
- APK Android < 30 Mo
- Cache SQLite mobile : 50 Mo max par appareil
- Photos : max 50 par patient, JPEG qualité 80%, < 2 Mo

---

*`docs/cdc.md` est disponible comme référence complète si besoin d'approfondissement.*
