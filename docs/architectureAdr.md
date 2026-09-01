[← README](../README.md) · [Onboarding](onboarding.md) · [ADR](adr/README.md) · [Schéma BDD](schema.dbml) · [Lexique](lexique.md) · [CDC](cdc.md)

# Architecture — Sauver la Face

> Description du système : couches, schéma de données, sécurité et accessibilité.
> Les décisions techniques et leurs alternatives écartées vivent dans [`docs/adr/`](adr/README.md).

---

## Vue d'ensemble

```text
┌─────────────────┐              ┌──────────────────┐              ┌────────────────┐
│  App mobile     │              │     Caddy        │              │  Dashboard web │
│  React Native   │◀──HTTPS─────▶│  Reverse Proxy   │◀──HTTPS─────▶│  Next.js 14    │
│  Expo SDK 52    │              │  TLS 1.3         │              │  Port 3000     │
│  (Android)      │              └────────▲─────────┘              └────────────────┘
└─────────────────┘                       │ HTTP (réseau interne Docker)
                                 ┌────────▼─────────┐
                                 │   Backend API    │
                                 │   Bun + Hono     │
                                 │   Port 3001      │
                                 └──────▲───────▲───┘
                                        │       │
                                  Drizzle ORM  Client S3
                                        │       │
                             ┌──────────▼─┐  ┌──▼──────────────────────────────────┐
                             │ PostgreSQL │  │            Client S3                │
                             │ (données)  │  │  dev : MinIO    prod : OVH S3 (HDS) │
                             └────────────┘  │  bucket photos  bucket logs-audit   │
                                             └─────────────────────────────────────┘
```

---

## Décisions d'architecture

Une décision = un fichier, dans [`docs/adr/`](adr/README.md). L'index y donne la
liste complète avec son statut et sa date.

Les treize décisions qui figuraient dans cette section ont été reprises dans les
ADR **0002 à 0014** : offline-first mobile, conflits en server-wins, choix de
Bun, Hono, Drizzle, Better Auth, de la GitHub App, de Caddy, d'OpenAPI, de
MinIO, du polling plutôt que des WebSockets, de Pino, et de l'export des logs
d'audit vers S3.

Une nouvelle décision structurante ne s'ajoute pas ici : elle se crée par
`bash docs/adr/nouvel-adr.sh "<titre à l'indicatif>"`.

---

## Architecture backend — Feature-based + Clean Architecture + DDD

Chaque feature suit les 4 couches Clean Architecture. Les dépendances ne vont que vers l'intérieur : `presentation → application → domain ← infrastructure`.

**Convention de nommage : `camelCase` pour tous les fichiers sans exception.**

```text
features/auth/
  presentation/
    authRouter.ts              ← reçoit HTTP, valide avec Zod, appelle application
  application/
    authUsecase.ts             ← orchestration : appelle domain + repo, aucune règle métier
  domain/
    physician.ts               ← Entity DDD (UUID, identité persistante, règles métier)
    physicianRepository.ts     ← interface (port) — aucune dépendance externe
    patientCode.ts             ← Entity DDD
    patientCodeRepository.ts   ← interface (port) — aucune dépendance externe
    patientCodeValue.ts        ← Value Object DDD (pas d'UUID, immuable, create() valide)
  infrastructure/
    physicianRepository.ts     ← implémentation Drizzle (adapter)
    patientCodeRepository.ts   ← implémentation Drizzle (adapter)
```

**Couche `application/` :**
- Chef d'orchestre : reçoit une commande, appelle le domaine, appelle l'infra via les interfaces
- Délègue toute règle métier aux Entities et Value Objects de `domain/`
- N'appelle jamais l'implémentation Drizzle directement — uniquement les interfaces

**Couche `domain/` — DDD :**
- **Entity** : a un UUID, identité persistante même si les attributs changent
- **Value Object** : pas d'UUID, défini par sa valeur, immuable, constructeur privé + `create()` qui valide
- Les règles métier et validations vivent ici — jamais dans `application/`
- **Pas de contrainte CHECK SQL** pour les règles métier — la validation appartient au Value Object, pas à la base de données. Les index partiels sont acceptés car ils relèvent de l'intégrité opérationnelle et de la performance, pas de la logique métier.

  | Mécanisme | Rôle | Où |
  |---|---|---|
  | `CHECK (code ~ '^[0-9]{6}$')` | Valider le format — règle métier | ❌ SQL → ✅ `PatientCodeValue.create()` |
  | `UNIQUE WHERE deleted_at IS NULL` | Empêcher la réattribution d'un code — intégrité opérationnelle | ✅ Index partiel SQL |

  Exemple : le format "6 chiffres" du code patient est une règle métier → `PatientCodeValue.create()`. En revanche, garantir qu'un code non supprimé ne peut pas être réattribué est une contrainte d'intégrité → index partiel `WHERE deleted_at IS NULL AND revoked_at IS NULL`.

**Répartition domain/ vs packages/shared :**
- Concept utilisé par une seule app → `domain/` de la feature
- Concept utilisé par plusieurs apps → `packages/shared/src/domain/`

**Règles absolues :**
- `domain/` ne connaît ni Drizzle, ni Hono, ni rien d'externe
- `presentation/` ne contient aucune logique métier — valide et délègue uniquement
- `infrastructure/` ne contient aucune logique métier — lit/écrit uniquement
- Même fichier `camelCase` dans `domain/` (interface) et `infrastructure/` (implémentation) — le dossier distingue les deux

---

## Architecture web — Feature-based (Next.js App Router)

Pages fines dans `app/`, toute la logique dans `features/`.

```text
apps/web/src/
  app/                        ← routing Next.js (pages fines — importent depuis features/)
  features/
    [feature]/
      components/             ← UI pure (JSX uniquement, aucun appel API direct)
      hooks/                  ← logique métier + appels API via TanStack Query
      actions/                ← Server Actions Next.js (mutations : créer, modifier, supprimer)
```

**Règles absolues :**
- `components/` reçoit des props et consomme des hooks — jamais de `fetch` direct
- `hooks/` contient toute la logique — `usePatients()`, `useAlerts()`, etc.
- `actions/` pour les mutations côté serveur

---

## Architecture mobile — offline-first par feature

```text
feature/
  [feature]Screen.tsx    ← composant UI
  [feature]Storage.ts    ← lecture/écriture SQLite local
  [feature]Service.ts    ← orchestration : storage → sync_queue → API
```

**Règle absolue** : toute donnée est d'abord écrite en SQLite (`featureStorage.ts`) avant tout appel réseau. L'appel réseau est géré par la queue de sync, pas directement dans l'UI.

---

## Schéma de base de données

![MLD — Modèle Logique de Données](mld.png)

Toutes les migrations sont **additives** : on n'ajoute que des colonnes nullable, jamais de suppression ni de renommage. Raison : les appareils mobiles peuvent être désynchronisés depuis plusieurs semaines — un schéma incompatible bloquerait leur synchronisation.

### Décisions de schéma

Les décisions de modélisation sont consignées une par fichier dans
[`docs/adr/`](adr/README.md) :

- [0015](adr/0015-stocker-toutes-les-dates-en-timestamptz.md) — stocker toutes les dates en `timestamptz`
- [0016](adr/0016-garantir-l-unicite-des-emails-et-des-codes-par-un-index-fonctionnel-en-minuscules.md) — unicité insensible à la casse par index fonctionnel
- [0017](adr/0017-utiliser-le-type-boolean-natif-de-postgresql-plutot-qu-un-entier.md) — `boolean` natif plutôt qu'un entier
- [0018](adr/0018-anonymiser-les-patients-plutot-que-supprimer-leurs-donnees-medicales.md) — anonymiser plutôt que supprimer (RGPD art. 17.3.c)
- [0019](adr/0019-restreindre-l-unicite-des-codes-patient-par-des-index-partiels.md) — index partiels sur les codes patient

---

## Sécurité

| Couche | Mécanisme |
|---|---|
| Transit | TLS 1.3 obligatoire (RGPD + HDS) — terminé par Caddy |
| Stockage mobile | AES-256-GCM via expo-secure-store |
| Auth médecins | MFA TOTP obligatoire (Better Auth) |
| Auth patients | Code 6 chiffres + JWT signé HMAC-SHA256 |
| Intégrité photos | Checksum SHA-256 calculé mobile, vérifié backend |
| Consentement | Écran RGPD obligatoire au premier lancement (date sauvegardée) |
| Hébergement | OVH Cloud certifié HDS |
| CSRF | Cookies `SameSite=Strict` sur le dashboard web (géré par Better Auth) |
| Audit logs | Chaque accès aux données médicales loggé — rétention 1 an (HDS) — voir [cdc.md](cdc.md) |
| Autorisation dashboard | Session médecin obligatoire (401) sur `patientRouter`/`photosRouter`/`exportsRouter`/`instructions` — équipe soignante partagée, pas de patientèle privée par médecin |
| Autorisation mobile | JWT patient vérifié côté serveur (401 si invalide, 403 si le patient authentifié n'est pas propriétaire de la ressource) sur `sync`/`photos`/`instructions` |

### Décisions de sécurité

Consignées dans [`docs/adr/`](adr/README.md) :

- [0020](adr/0020-fixer-la-session-medecin-a-2h-d-inactivite-et-le-token-patient-a-un-an.md) — session médecin 2h d'inactivité, token patient un an
- [0021](adr/0021-limiter-les-tentatives-d-authentification-a-3-par-15-minutes-et-par-ip.md) — 3 tentatives par 15 minutes et par IP
- [0022](adr/0022-faire-tourner-les-secrets-de-production-tous-les-90-jours.md) — rotation des secrets de production tous les 90 jours

### Audit OWASP Top 10 (2026-07-23)

Audit mené directement sur le code (pas sur la documentation) — chaque ligne ci-dessous a été vérifiée dans les fichiers source, pas supposée.

| Catégorie | Statut | Détail |
|---|---|---|
| A01 — Broken Access Control | ✅ Corrigé | Aucune authentification n'était exigée sur `patientRouter`/`photosRouter`/`exportsRouter`/`sync`/`instructions` — n'importe qui pouvait lire, modifier ou écrire des données au nom de n'importe quel patient (IDOR confirmé). Corrigé en deux temps : session médecin obligatoire côté dashboard (SEC-01), JWT patient vérifié côté mobile (SEC-02). **Complété le 2026-09-01 (SEC-04)** : le périmètre de SEC-01 était une liste écrite à la main où `alertRouter` et `authRouter` ne figuraient pas. `GET /alerts` exposait sans authentification le nom des patients et leurs symptômes, et `POST /auth/patient/generate` fabriquait un code d'accès pour n'importe quel UUID — les deux enchaînés donnaient le contrôle d'un compte patient. La couverture n'est plus affirmée mais **vérifiée par un test** qui parcourt la table de routage réelle. Suivi vivant : [docs/security/owasp.md](security/owasp.md) |
| A02 — Cryptographic Failures | Conforme | TLS 1.3, SQLCipher AES-256 mobile, stockage HDS — non revérifié techniquement lors de cet audit |
| A03 — Injection | Conforme | Drizzle ORM (requêtes paramétrées) + validation Zod systématique — aucune requête SQL brute rencontrée dans le code lu |
| A04 — Insecure Design | Conforme | Clean Architecture + DDD, règles métier isolées et testables |
| A05 — Security Misconfiguration | Conforme | Biome + CodeRabbit bloquants, protection de branche vérifiée en pratique (impossible de merger sans les 4 checks CI) |
| A06 — Vulnerable and Outdated Components | ✅ Corrigé | Aucun outil de suivi des dépendances vulnérables n'existait. `.github/dependabot.yml` ajouté (bun, docker, github-actions, scan hebdomadaire) |
| A07 — Identification and Authentication Failures | ✅ Corrigé | JWT patient (1 an, compromis assumé offline-first) et session médecin (2h) conformes, rate limiting (3 tentatives/15 min) confirmé exact. Point corrigé : le JWT patient était signé mais jamais vérifié côté serveur — `TokenProvider.verify()` implémenté et testé (secret invalide, expiration, malformation, mauvais rôle). **Complété le 2026-08-31 (SEC-03)** : cet audit concluait à tort que la catégorie était couverte. Il ne restait aucun moyen de révoquer une session patient — `revokeActiveCodes()` ne visait que les codes jamais consommés, et la table JWT annonçait à tort une « révocation explicite possible par le médecin ». Le suivi vivant est désormais dans [docs/security/owasp.md](security/owasp.md) |
| A08 — Software and Data Integrity Failures | Conforme | Checksum SHA-256 sur l'upload photo, vérifié en pratique (rejet réel d'un checksum invalide en test). CI bloquante avant merge |
| A09 — Security Logging and Monitoring Failures | Conforme | Middleware d'audit sur chaque requête, tentatives d'authentification échouées loguées |
| A10 — Server-Side Request Forgery | Non applicable | Aucun appel sortant construit à partir d'une entrée utilisateur — les appels S3/MinIO pointent vers un endpoint fixé côté serveur |

**Décision de modèle d'accès associée** : les chirurgiens de Toulouse forment une équipe soignante unique qui suit collectivement les mêmes patients — ce n'est pas une patientèle privée par médecin. Le correctif A01 côté dashboard est donc une authentification obligatoire (401), volontairement sans rattachement patient↔médecin ni contrôle d'appartenance (403). Si plusieurs équipes distinctes doivent un jour partager la plateforme sans se voir, prévoir une table de liaison `patient_physician` (many-to-many) à ce moment-là — pas avant (YAGNI).

---

## Accessibilité

Le référentiel retenu, le périmètre de vérification, la conformité mesurée et le
standard des cibles tactiles à 48 × 48 dp sont documentés dans
[accessibilite.md](accessibilite.md).

---

## Contraintes de volume

Ces contraintes ont guidé les choix d'architecture (polling vs WebSocket, SQLite vs autre, etc.) :

- 200 patients actifs simultanés max
- 20 utilisateurs web simultanés max
- APK Android < 30 Mo
- Cache SQLite mobile : 50 Mo max par appareil
- Photos : max 50 par patient, JPEG qualité 80%, < 2 Mo
