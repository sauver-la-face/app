# Contexte projet — Sauver la Face

> Ce fichier est destiné aux assistants IA pour prendre connaissance du projet avant de générer du code.
> Lire ce fichier en priorité, puis consulter `.ai/cdc.md` pour le détail complet.

---

## Résumé du projet

Application de suivi post-opératoire pour patients cambodgiens opérés lors de missions humanitaires de chirurgie maxillo-faciale. Permet aux patients d'envoyer photos et questionnaires en mode offline-first, et aux chirurgiens toulousains de surveiller les patients via un dashboard web.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Monorepo | Bun Workspaces |
| Backend | Bun + Hono + Drizzle ORM + PostgreSQL |
| Auth | Better Auth (MFA médecins, codes 6 chiffres patients) |
| Stockage photos | MinIO (S3-compatible) |
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
```
apps/mobile/src/features/
  auth/         → code 6 chiffres, session, expo-secure-store
  questionnaire/ → SQLite local + sync queue
  photos/       → SQLite + compression JPEG
  instructions/ → cache offline, acknowledged_at
  sync/         → orchestration queue SQLite, retry backoff
```

---

## Règles critiques à respecter

### Sécurité
- TLS 1.3 obligatoire en transit
- AES-256-GCM pour le stockage local (expo-secure-store)
- MFA TOTP obligatoire pour les médecins web
- Jamais de `BETTER_AUTH_SECRET` côté Next.js — validation déléguée au backend
- Hébergement HDS certifié uniquement (OVH Cloud)

### Offline & synchronisation
- Stratégie conflits : **server-wins** (le serveur a toujours raison)
- Queue de sync : table `sync_queue` en SQLite, retry backoff exponentiel (1s, 2s, 4s, 8s)
- Migrations de schéma : **toujours additives** (colonnes nullable uniquement, jamais de suppression)
- Gel des déploiements de schéma pendant les missions actives (`MISSION_ACTIVE=true`)

### Codes patients
- Code numérique 6 chiffres, soft delete automatique après 48h si non utilisé
- Une fois utilisé (`used_at NOT NULL`), valide pour toujours
- Renouvellement uniquement par le médecin local

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
- `medical_event` — événements médicaux post-op (severity 1-10, alerte > 7)
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

*Consulter `.ai/cdc.md` pour le cahier des charges complet.*
