[← README](../README.md) · [Contexte IA](context.md) · [Onboarding](../docs/onboarding.md) · [Architecture](../docs/architectureAdr.md) · [CDC](../docs/cdc.md)

# Fonctionnalités à implémenter — Sauver la Face

> Statuts : `[ ]` à faire · `[~]` en cours · `[x]` terminé
> Priorités : 🔴 Critique (bloque d'autres features ou obligation légale) · 🟡 Majeur (core métier) · 🟢 Mineur (confort, ne bloque rien)
>
> **Règle** : toute nouvelle feature ajoutée dans ce fichier doit obligatoirement avoir un niveau de priorité défini.

---

## BACKEND

### AUTH-01 — Authentification patients (codes 6 chiffres)

`[x]` 🔴 Critique · `apps/backend/src/features/auth/`

**Comportement attendu :**

- Génération d'un code numérique 6 chiffres unique par patient
- Soft delete automatique après 48h si le code n'est pas utilisé (job cron)
- Une fois utilisé (`used_at NOT NULL`), le code est valide pour toujours
- Renouvellement uniquement par un médecin
- JWT patient : TTL 1 an — contexte offline-first, patients parfois déconnectés plusieurs semaines
- Révocation explicite possible par le médecin depuis le dashboard (`patient_code.revoked_at` vérifié à chaque requête)
- Renouvellement automatique du token à chaque connexion réussie
- Rate limiting : 3 tentatives échouées → blocage 15 minutes par IP (indépendant de l'expiration 48h)

**Règles de code :**

- La validation du format "6 chiffres" va dans `PatientCodeValue` (Value Object DDD dans `packages/shared/src/domain/`) — pas de contrainte CHECK SQL. Raison : les règles métier appartiennent au domaine, pas à la base de données. `varchar(6)` garantit uniquement la longueur max.
- La logique de validation du code va dans `auth/domain/auth.domain.ts` uniquement
- L'orchestration (générer, vérifier, renouveler) va dans `auth/application/auth.usecase.ts`
- Le cron de soft delete est un service séparé `auth/application/auth.cron.ts`
- Le rate limiting est un middleware branché sur l'endpoint de validation du code
- Tester : génération, expiration 48h, soft delete, renouvellement, tentative sur code supprimé, blocage après 3 tentatives

---

### AUTH-02 — Authentification médecins (MFA TOTP)

`[x]` 🔴 Critique · `apps/backend/src/features/auth/`

**Comportement attendu :**

- MFA TOTP obligatoire via Better Auth
- Session timeout 2h d'inactivité
- Tokens JWT signés HMAC-SHA256, renouvellement silencieux automatique tant que le médecin est actif
- Rate limiting : 3 tentatives échouées → blocage 15 minutes par IP

**Règles de code :**

- Utiliser Better Auth sans couche custom — ne pas réinventer la gestion de session
- Le rate limiting est un middleware branché sur l'endpoint de login
- Tester : login sans MFA rejeté, session expirée rejetée, refresh silencieux, blocage après 3 tentatives

---

### SEC-01 — Authentification médecin obligatoire sur les routes dashboard (A01)

`[x]` 🔴 Critique · `apps/backend/src/features/patients/` · `apps/backend/src/features/photos/` · `apps/backend/src/features/exports/`

**Contexte :**

Audit de sécurité (revue OWASP A01, 2026-07-23) : aucun middleware d'authentification n'est monté sur les routers patient/photos/exports/sync/instructions (`index.ts`) — seul un middleware d'audit (journalisation, non bloquant) est appliqué globalement. Un `sessionMiddleware` existe pour le flux de connexion médecin (Better Auth) mais n'est jamais activé via `.use()`. Résultat confirmé : n'importe qui, même sans être connecté, peut appeler ces routes et lire/modifier le dossier, l'historique, les photos ou les exports de n'importe quel patient.

**Décision explicite sur le modèle d'accès (2026-07-23) :** les chirurgiens de Toulouse forment une seule équipe soignante qui suit collectivement les mêmes patients — ce n'est **pas** une patientèle privée par médecin. Le correctif est donc uniquement une exigence d'authentification (401 si non connecté), **sans** rattachement patient ↔ médecin ni contrôle d'appartenance (403). Un premier essai de scoping strict par médecin a été fait puis annulé pour cette raison — voir `physicianAuthMiddleware.ts` pour le raisonnement. Si un jour plusieurs équipes distinctes doivent utiliser la plateforme sans se voir mutuellement, prévoir une table de liaison `patient_physician` (many-to-many) à ce moment-là, pas avant.

**Comportement attendu :**

- Un middleware d'authentification (session Better Auth) est monté sur `patientRouter`, `photosRouter` (route de consultation uniquement) et `exportsRouter` — 401 si aucune session médecin valide
- Tout médecin authentifié voit tous les patients (équipe partagée) — aucun filtrage par propriétaire
- Les routes patient (auth par code 6 chiffres, upload photo, sync mobile) restent hors périmètre de ce ticket — l'authentification JWT patient est un sujet séparé (aucune fonction `verify()` n'existe encore pour le token patient)

**Règles de code :**

- Le gardien d'authentification est un middleware partagé (`shared/middleware/physicianAuthMiddleware.ts`), injectable dans chaque router pour rester testable sans dépendre de Better Auth/une vraie base
- Ne pas ajouter de colonne de rattachement ni de vérification d'appartenance tant que le besoin d'équipes distinctes n'est pas réel (YAGNI)
- Tester : 401 sans session sur chaque router concerné, 200 pour tout médecin authentifié

---

### SEC-02 — Vérification JWT patient côté serveur (A01/A07)

`[x]` 🔴 Critique · `apps/backend/src/features/sync/` · `apps/backend/src/features/photos/` · `apps/backend/src/features/instructions/` · `apps/backend/src/features/auth/`

**Contexte :**

Suite à SEC-01 : le JWT patient est signé (`jwtTokenProvider.ts`) mais aucune fonction `verify()` n'existe côté serveur, et aucune route mobile ne vérifie le token. Conséquence concrète et confirmée dans le code : `POST /sync` lit `patientId` directement depuis le corps de la requête (`syncRequestSchema.patientId`) sans aucune vérification — n'importe qui peut écrire des données médicales (symptômes, media, accusés de lecture) au nom de n'importe quel patient. Même trou sur `POST /photos` (upload) et sur les routes `instructions` côté patient. `POST /instructions` (création côté médecin) n'a par ailleurs jamais été rattaché à `requirePhysicianAuth` lors de SEC-01 (oubli de périmètre).

**Comportement attendu :**

- `TokenProvider.verify(token)` vérifie la signature et l'expiration du JWT (`hono/jwt`), retourne le payload (`uuid_patient`, `uuid_patient_code`, `role`) ou `null` si invalide/expiré
- Middleware `requirePatientAuth` : lit `Authorization: Bearer <token>`, vérifie le token, rejette en 401 si absent/invalide, sinon expose `patientId` dans le contexte
- `POST /sync` : `patientId` du token doit correspondre au `patientId` du corps — 403 sinon, jamais de confiance aveugle dans le body
- `POST /photos` : le patient authentifié doit être le propriétaire de l'`eventId` ciblé (chaîne media → event → procedure → patient) — 403 sinon
- `GET /patients/{patientId}/instructions` : le patient authentifié doit correspondre au `patientId` du chemin — 403 sinon
- `POST /instructions/{instructionId}/acknowledge` : le patient authentifié doit être le propriétaire de l'instruction (via la procédure médicale liée) — 403 sinon
- `POST /instructions` (création) : rattaché à `requirePhysicianAuth` (oubli de SEC-01, corrigé ici)

**Règles de code :**

- `verify()` vit dans `TokenProvider` (interface) / `JwtTokenProvider` (implémentation) — même fichier que `sign()`
- `requirePatientAuth` est une factory qui prend le `TokenProvider` en paramètre (pas de singleton comme `requirePhysicianAuth`, car dépend du secret JWT injecté) — reste dans `shared/middleware/`
- Les contrôles d'appartenance (event/instruction → patient) vivent dans les repositories concernés (nouvelle méthode dédiée), jamais recalculés en dur dans le router
- Tester : token absent → 401, token invalide/expiré → 401, `patientId` du body/chemin différent du token → 403, cas nominal → 200/201

---

### SYNC-01 — Réception et résolution des conflits (server-wins)

`[x]` 🔴 Critique · `apps/backend/src/features/sync/`

**Comportement attendu :**

- Réception du payload offline du mobile
- Résolution des conflits : le serveur a toujours raison — PostgreSQL gagne toujours
- Versioning de schéma : accepte `N` et `N-1`, rejette `> N` avec `APP_UPDATE_REQUIRED`
- Log du delta en cas de conflit
- Renvoi de la version serveur au mobile après résolution — le mobile met à jour son SQLite

**Partition des responsabilités (conflits quasi impossibles par design) :**

| Table | Propriétaire | Conflit possible |
|---|---|---|
| `medical_event_symptom` | Patient uniquement | ❌ Non |
| `media` | Patient uniquement | ❌ Non |
| `instructions.acknowledged_at` | Patient uniquement | ❌ Non |
| `medical_procedure`, `medical_event`, `instructions`, `symptom` | Médecin uniquement | ❌ Non |

Le server-wins reste en place comme filet de sécurité mais ne sera quasiment jamais déclenché grâce à cette partition.

**Flow complet :**

```text
Mobile (SQLite) → Hono sync.usecase.ts → compare avec PostgreSQL
                        ↓
               conflit ? → version PostgreSQL gagne → log Pino
                        ↓
               réponse avec version serveur → mobile met à jour SQLite
```

**Règles de code :**

- La logique server-wins va dans `sync/application/sync.usecase.ts`
- La comparaison de versions va dans `sync/domain/sync.domain.ts`
- Ne jamais écraser un enregistrement sans logger le conflit via `@shared/logger`
- Tester : payload normal, conflit server-wins, version schéma incompatible, renvoi version serveur

---

### ALERT-01 — Système d'alertes automatiques

`[x]` 🟡 Majeur · `apps/backend/src/features/alerts/`

**Comportement attendu :**

- Alerte si un symptôme avec `triggers_alert = true` est sélectionné sur un `medical_event`
- Alerte si aucune synchronisation depuis 7 jours
- La liste des symptômes déclencheurs est définie dans la table `symptom` — pas de magic numbers dans le code

**Règles de code :**

- La logique d'alerte lit `triggers_alert` depuis la table `symptom` — si un jour un nouveau symptôme déclencheur est ajouté, aucun code à changer
- Dépend de **MED-01** pour la liste définitive des symptômes
- Implémenter HTTP 304 via ETag : calculer un hash MD5 des alertes actives, comparer avec `If-None-Match` du client — répondre `304` sans body si identique, `200` avec body si changement
- Tester : symptôme déclencheur → alerte, symptôme non déclencheur → pas d'alerte, absence de sync 7j → alerte, poll sans changement → 304, poll avec nouvelle alerte → 200

---

### ALERT-02 — Seuil d'alerte d'inactivité paramétrable

`[ ]` 🟡 Majeur · `apps/backend/src/features/alerts/`

**Contexte :**

Le seuil actuel (ALERT-01) est fixe à 7 jours, identique pour tous les patients. Suggestion de Mathieu Baro (revue Bloc 2) : un patient opéré récemment et un patient suivi depuis longtemps n'ont pas le même niveau de risque en cas d'absence de connexion, un seuil uniforme ne reflète pas cette réalité médicale.

**Comportement attendu :**

- Seuil configurable au niveau global (valeur par défaut applicable à tous les patients)
- Seuil configurable individuellement par patient, surchargeant la valeur globale si renseigné
- Si aucun seuil individuel n'est défini, le seuil global s'applique (comportement actuel préservé par défaut)

**Règles de code :**

- Ajouter une colonne `alert_threshold_days` (nullable, integer) sur la table `patient` — migration additive, aucun impact sur les patients existants (valeur NULL → seuil global appliqué)
- Le seuil global reste un paramètre de configuration (variable d'environnement ou table `settings`), pas une constante en dur
- La logique de lecture du seuil (individuel puis fallback global) va dans `alerts/domain/` — jamais dans `application/`
- Dépend de **ALERT-01** (déjà implémenté), extension non bloquante
- Tester : patient sans seuil individuel → seuil global appliqué, patient avec seuil individuel → surcharge appliquée, changement du seuil global sans impact sur les seuils individuels déjà définis

---

### PHOTO-01 — Stockage et validation des photos

`[x]` 🟡 Majeur · `apps/backend/src/features/photos/`

**Comportement attendu :**

- Réception de la photo uploadée par le mobile
- Validation checksum SHA-256 (comparé à celui envoyé par le mobile)
- Stockage S3 (MinIO en dev, OVH Object Storage certifié HDS en prod)
- Rejet `PHOTO_INTEGRITY_ERROR` si mismatch checksum
- Retry côté mobile : backoff 2s, 4s, abandon à la 4e tentative

**Règles de code :**

- La validation checksum se fait dans `photos/domain/photos.domain.ts` avant tout stockage
- L'orchestration (valider + stocker) va dans `photos/application/photos.usecase.ts`
- Le client MinIO est dans `apps/backend/src/shared/storage/`

---

### EXPORT-01 — Export PDF / CSV RGPD

`[x]` 🟢 Mineur · `apps/backend/src/features/exports/`

**Comportement attendu :**

- Export PDF rapport complet d'un patient
- Export CSV données anonymisées (RGPD)
- Droit portabilité : export JSON données brutes patient

**Règles de code :**

- La génération des fichiers va dans `exports/application/exports.usecase.ts`
- Les règles d'anonymisation RGPD vont dans `exports/domain/exports.domain.ts`
- Les données anonymisées : supprimer `first_name`, `last_name`, `birthdate` du CSV
- Tester : structure du PDF, anonymisation CSV, format JSON portabilité

---

### AUDIT-01 — Middleware d'audit logs

`[x]` 🟡 Majeur · `apps/backend/src/shared/middleware/audit.middleware.ts`

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

`[x]` 🟢 Mineur · `apps/backend/src/index.ts`

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

`[x]` 🟡 Majeur · `apps/backend/src/features/patients/`

**Comportement attendu :**

- Création / lecture / mise à jour d'un patient
- Attribution d'un code d'accès à un patient (déclenche AUTH-01)
- Liste des patients avec statut de synchronisation

**Règles de code :**

- Toutes les requêtes SQL via `patients.repository.ts` (Drizzle uniquement, pas de SQL brut)
- Les types viennent de `@sauver-la-face/shared`

---

### INSTRUCTION-01 — Envoi d'instructions médicales

`[x]` 🟡 Majeur · `apps/backend/src/features/instructions/`

**Comportement attendu :**

- Création d'une instruction pictographique par un médecin pour un patient
- Suivi de la lecture via `acknowledged_at`
- Notification dashboard quand instruction lue

**Règles de code :**

- `acknowledged_at` est mis à jour uniquement par le mobile lors de la lecture
- Le médecin ne peut pas modifier `acknowledged_at`

---

## DASHBOARD WEB

### WEB-00 — Page de connexion médecin

`[x]` 🔴 Critique · `apps/web/src/app/[locale]/login/`

**Comportement attendu :**

- Formulaire de connexion médecin (email + mot de passe) fidèle aux maquettes Figma
- Sélecteur de langue (fr/en/km) visible en haut à droite — dépend de WEB-I18N-01
- Bouton "Se connecter" avec état de chargement
- Lien "Identifiants oubliés ?"
- Footer : Mentions légales · Données personnelles · Plan du site
- Redirection vers le dashboard après connexion réussie

**Règles de code :**

- Utiliser Better Auth côté client — jamais de `BETTER_AUTH_SECRET` dans le web
- Toutes les strings via le dictionnaire i18n — jamais en dur
- Dépend de : WEB-I18N-01

---

### WEB-I18N-01 — Internationalisation du dashboard web (français / anglais / khmer)

`[x]` 🔴 Critique · `apps/web/src/i18n/`

**Comportement attendu :**

- Interface disponible en 3 langues : français (`fr`), anglais (`en`), khmer (`km`)
- Langue par défaut : français
- Sélecteur de langue visible sur toutes les pages (header)
- Routing i18n via Next.js : `/fr/dashboard`, `/en/dashboard`, `/km/dashboard`
- Persistance de la langue choisie dans un cookie

**Fichiers à créer :**

- `apps/web/src/i18n/request.ts` — configuration next-intl
- `apps/web/src/i18n/routing.ts` — définition des locales et locale par défaut
- `apps/web/src/messages/fr.json` — traductions français
- `apps/web/src/messages/en.json` — traductions anglais
- `apps/web/src/messages/km.json` — traductions khmer
- `apps/web/src/middleware.ts` — middleware next-intl pour le routing

**Règles de code :**

- Utiliser `next-intl` — conçu pour Next.js App Router, pas i18next
- Toutes les pages sont dans `apps/web/src/app/[locale]/` — jamais de string en dur dans les composants
- Utiliser le hook `useTranslations()` dans les composants client, `getTranslations()` dans les Server Components
- Les clés suivent le format `feature.composant.element` (ex: `auth.login.title`)
- Dépend de : toutes les features WEB — à implémenter avant WEB-01
- Tester : changement de langue, persistance après refresh, fallback si clé manquante

---

### WEB-01 — Tableau de bord médecin

`[x]` 🟡 Majeur · `apps/web/src/app/dashboard/`

**Comportement attendu :**

- Liste des patients avec statut (alerte / ok / hors-ligne)
- Alertes critiques en haut de page
- Polling toutes les 30s via `refetchInterval` TanStack Query

**Règles de code :**

- Les appels API dans des hooks TanStack Query dans `apps/web/src/features/dashboard/hooks/`
- Pas de `fetch` direct dans les composants
- Pas de `BETTER_AUTH_SECRET` côté web — auth déléguée au backend

---

### WEB-02 — Visualisation chronologique patient

`[x]` 🟡 Majeur · `apps/web/src/app/patients/[id]/`

**Comportement attendu :**

- Historique des photos de cicatrices par date
- Graphique d'évolution de la sévérité des symptômes
- Timeline des événements médicaux

**Règles de code :**

- Les données sont récupérées via un hook `usePatientHistory(id)`
- Les composants graphiques sont dans `apps/web/src/components/`

---

### WEB-03 — Gestion des utilisateurs et codes d'accès

`[x]` 🟡 Majeur · `apps/web/src/app/patients/`

**Comportement attendu :**

- Création d'un compte patient
- Génération / renouvellement d'un code 6 chiffres
- Affichage du statut du code (actif / expiré / supprimé)

**Règles de code :**

- La génération du code est toujours côté backend (PATIENT-01 / AUTH-01)
- Le frontend affiche uniquement, ne génère jamais le code lui-même

---

### WEB-04 — Export données (PDF / CSV)

`[ ]` 🟢 Mineur · `apps/web/src/app/exports/`

**Comportement attendu :**

- Bouton export PDF d'un rapport patient
- Export CSV anonymisé de tous les patients
- Téléchargement direct dans le navigateur

**Règles de code :**

- L'export est généré côté backend (EXPORT-01) — le frontend déclenche et télécharge uniquement

---

### WEB-05 — Envoi d'instructions pictographiques

`[ ]` 🟡 Majeur · `apps/web/src/app/patients/[id]/instructions/`

**Comportement attendu :**

- Formulaire de création d'instruction (sélection pictogrammes)
- Affichage du statut de lecture (`acknowledged_at`)

---

### WEB-06 — Suppression de la page racine morte

`[x]` 🟢 Mineur · `apps/web/src/app/page.tsx`

**Contexte :**

Depuis l'introduction du routage par locale (`app/[locale]/`), le proxy redirige
systématiquement `/` vers `/{locale}`, rendant `app/page.tsx` inatteignable. Cette page
dupliquait `app/[locale]/page.tsx` (même session, même déconnexion) sans i18n et avec du
texte en dur. Elle importait `useRouter` et `useEffect` sans directive `'use client'`, ce
qui faisait échouer `next build` — sans que la CI le détecte, aucun job ne lançant de build.

**Comportement attendu :**

- `apps/web/src/app/page.tsx` est supprimée
- `next build` passe sur le dashboard
- La CI exécute un job `build-web` qui aurait attrapé cette régression

**Règles de code :**

- Toute route publique du dashboard vit sous `app/[locale]/` — pas de page à la racine de
  `app/` en dehors du layout et de `globals.css`

---

### A11Y-01 — Corrections d'accessibilité WCAG 2.2 AA (dashboard)

`[x]` 🟡 Majeur · `apps/web/src/features/` · `docs/architectureAdr.md`

**Contexte :**

Audit d'accessibilité du dashboard web (Lighthouse / axe-core) au titre de la compétence
C2.2.3, critère 3 (« le prototype répond aux exigences du référentiel »). Le référentiel
retenu est **WCAG 2.2 niveau AA** (voir `docs/accessibilite.md`).
L'audit a révélé 4 violations sur 3 pages (login 92/100, dashboard 95/100, patients 100/100).

**Comportement attendu :**

- Les pages du dashboard atteignent 100/100 sur la catégorie Accessibilité de Lighthouse
- Aucune violation WCAG 2.2 A/AA automatiquement détectable

**Règles de code :**

- Contraste : vert de marque `#2EAC8E` (2.83:1) assombri en `#178064` (4.87:1) ; texte `text-gray-400` (2.53:1) → `text-gray-500`
- Taille de cible (WCAG 2.5.8, nouveau en 2.2) : bouton « afficher le mot de passe » agrandi de 20×20 à 28×28 px
- Résultats consignés dans `docs/accessibilite.md` (critère 3)
- Dette connue à tracer séparément : le vert de marque est écrit en dur (17 occurrences) au lieu d'un token — tokenisation à prévoir
- Tester : `bunx lighthouse <url> --only-categories=accessibility` sur login/dashboard/patients → 100/100

---

### A11Y-02 — Rédaction critère 3 + standard cibles tactiles mobile (48 dp)

`[x]` 🟢 Mineur · `docs/architectureAdr.md` · `CLAUDE.md`

**Contexte :**

Complète la présentation du critère 3 (C2.2.3) pour le dossier de certification. A11Y-01 a
mesuré et corrigé le dashboard web ; A11Y-02 rédige la présentation narrative (démarche
mesurer → corriger → re-mesurer, conclusion) directement dans
`docs/accessibilite.md`, et ajoute le **tableau de synthèse de conformité** prouvant que le
prototype répond aux exigences. Établit aussi le standard **48 × 48 dp** pour les cibles
tactiles mobile (Material Design), distinct du minimum web WCAG 2.5.8 (24 px).

**Comportement attendu :**

- `docs/accessibilite.md` se lit comme une présentation rédigée du critère 3, pas seulement des tableaux
- Un tableau de synthèse distingue clairement ce qui est **vérifié conforme** (web) de ce qui est **défini mais pas encore implémenté** (mobile, tests manuels) — sans maquiller une conformité non mesurée
- La règle 48 × 48 dp est inscrite dans les règles mobile de `CLAUDE.md`

**Règles de code :**

- Aucune affirmation de conformité sur une surface non implémentée (l'UI mobile n'existe pas encore → règle définie en amont, pas conformité mesurée)
- Ne pas confondre 48 dp (mobile/Material) et 24 px (web/WCAG 2.5.8) — les deux normes documentées séparément

---

## APPLICATION MOBILE

### MOB-02 — Authentification patient (code 6 chiffres)

`[ ]` 🔴 Critique · `apps/mobile/src/features/auth/`

**Comportement attendu :**

- Écran de saisie du code 6 chiffres (clavier numérique)
- Stockage du token JWT dans `expo-secure-store` (AES-256)
- Session valide 1 an — renouvelée automatiquement à chaque connexion réussie

**Règles de code :**

- Le token ne transite jamais en clair — toujours via `expo-secure-store`
- L'expiration de session est gérée par le renouvellement silencieux du JWT
- Interface en khmer par défaut (`i18next`)

---

### MOB-03 — Questionnaire symptômes (offline)

`[ ]` 🟡 Majeur · `apps/mobile/src/features/questionnaire/`

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

`[ ]` 🟡 Majeur · `apps/mobile/src/features/photos/`

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

`[ ]` 🔴 Critique · `apps/mobile/src/features/sync/`

**Comportement attendu :**

- Table `sync_queue` en SQLite : stocke toutes les actions en attente
- Envoi séquentiel à la reconnexion
- Retry backoff exponentiel : 1s, 2s, 4s, 8s — abandon après 4 tentatives
- Purge automatique des photos > 30 jours si quota 50 Mo atteint

**Règles de code :**

- La queue est traitée dans `syncService.ts` (orchestration) et `syncQueue.ts` (table SQLite)
- Tester : envoi séquentiel, retry backoff, abandon après 4 tentatives, purge quota

---

### MOB-01 — Consentement RGPD première connexion

`[ ]` 🔴 Critique · `apps/mobile/src/features/consent/`

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

`[ ]` 🟢 Mineur · `apps/mobile/src/features/instructions/`

**Comportement attendu :**

- Affichage des instructions pictographiques envoyées par le médecin
- Accusé de réception automatique à l'ouverture (`acknowledged_at` mis à jour)
- Cache offline des instructions

**Règles de code :**

- `acknowledged_at` est envoyé au backend via la `sync_queue` (MOB-05)
- Les instructions sont mises en cache SQLite pour fonctionner offline

---

### MOB-07 — Notifications (locales et push)

`[ ]` 🟢 Mineur · `apps/mobile/src/features/notifications/`

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
- Les notifications locales sont gérées dans `notifications/localService.ts`
- Les notifications push nécessitent l'enregistrement du token Expo côté backend — stocker le token dans `expo-secure-store`
- L'interface des notifications est en khmer par défaut — dépend de **I18N-01**
- Tester : permission accordée/refusée, rappel local programmé, réception notification push

---

## INTERNATIONALISATION

### I18N-01 — Internationalisation de l'application mobile (khmer / français)

`[ ]` 🟡 Majeur · `apps/mobile/src/i18n/`

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

## MÉDICAL

### MED-01 — Définition des pictogrammes de symptômes

`[x]` 🔴 Critique · `apps/backend/src/infrastructure/schema.ts` · à valider avec les chirurgiens toulousains

**Contexte :**

Le patient évalue ses symptômes via des pictogrammes visuels — pas de chiffres. La liste définitive doit être validée par les chirurgiens toulousains avant implémentation. La structure de base de données est prête (`symptom` + `medical_event_symptom`).

**À définir avec les chirurgiens :**

- Liste complète des symptômes observables post-op
- Libellés en français (`label_fr`) et en khmer (`label_km`)
- Quels symptômes déclenchent une alerte automatique (`triggers_alert = true`)

**Impact sur les autres features :**

- **ALERT-01** — les alertes lisent `triggers_alert` depuis la table `symptom`
- **MOB-03** — l'UI du questionnaire affiche les pictogrammes à sélectionner
- **EXPORT-01** — les exports PDF/CSV affichent les labels des symptômes sélectionnés
- **I18N-01** — les labels khmer sont dans la table, pas dans les fichiers i18n

**Règles de code :**

- Ne pas hardcoder de symptômes dans le code — tout passe par la table `symptom`
- Les pictogrammes (images) sont des assets dans `apps/mobile/src/assets/symptoms/`
- Le `code` du symptôme (ex: `pain_severe`, `bleeding`) fait le lien entre l'asset et la table

---

## DEVOPS

### DEVOPS-03 — Automatisation statut features (workflows + authentification bot)

`[x]` 🔴 Critique · `.github/workflows/feature-in-progress.yml` · `.github/workflows/update-feature-status.yml`

**Comportement attendu :**

- Création d'une branche `feature/XXX-00-nom` → `features.md` passe automatiquement de `[ ]` à `[~]`
- PR mergée sur `dev` → `features.md` passe automatiquement de `[~]` à `[x]`
- Les deux workflows commitent sur `dev` via un token d'authentification dédié

**Décision technique — authentification des workflows**

Les workflows doivent pusher sur `dev`. Le `GITHUB_TOKEN` par défaut est en lecture seule — trois options évaluées :

| Option | Description | Avantages | Inconvénients |
|---|---|---|---|
| **PAT personnel** | Token généré depuis le compte du développeur | Simple, rapide à mettre en place | Lié à une personne — si elle quitte, les workflows cassent |
| **Compte bot dédié** | Compte GitHub secondaire avec son propre PAT | Indépendant des personnes | Nécessite un second compte + email, PAT de longue durée |
| **GitHub App** | Application enregistrée sur le repo, génère des tokens éphémères | Indépendant des personnes, tokens 1h (sécurisé), standard industrie | Setup légèrement plus long |

**Choix retenu : GitHub App**

Une GitHub App n'appartient à aucune personne — elle est rattachée au repo. Elle génère des tokens éphémères (1 heure) via `actions/create-github-app-token`, ce qui est plus sécurisé qu'un PAT de longue durée. C'est la pratique recommandée par GitHub pour les automatisations en équipe et la seule solution vraiment indépendante des personnes.

**Règles de code :**

- Créer la GitHub App dans Settings → Developer settings → GitHub Apps → New GitHub App
  - Nom : `sauver-la-face-ci`
  - Permissions : Repository permissions → Contents → `Read and write`
  - Désactiver "Active" sous Webhook (pas nécessaire ici)
- Installer l'App sur le repo (bouton Install App)
- Stocker deux secrets dans Settings → Secrets and variables → Actions :
  - `APP_ID` — l'identifiant numérique de l'App (visible dans ses settings)
  - `APP_PRIVATE_KEY` — la clé privée `.pem` générée depuis l'App
- Dans les deux workflows, ajouter un step `actions/create-github-app-token@v1` avant le checkout pour générer un token éphémère, puis utiliser `${{ steps.app-token.outputs.token }}` à la place de `${{ secrets.GITHUB_TOKEN }}`

---

### DEVOPS-02 — Reverse proxy Caddy avec TLS 1.3

`[~]` 🟡 Majeur · `Caddyfile` · `docker-compose.yml`

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

### DEVOPS-04 — Réparation du système de migrations Drizzle

`[x]` 🔴 Critique · `apps/backend/drizzle/` · `apps/backend/src/shared/db.ts`

**Contexte :**

`drizzle-kit migrate` est actuellement cassé silencieusement. Toutes les migrations passées ont été appliquées manuellement via `drizzle-kit push`, ce qui n'a jamais créé la table `__drizzle_migrations` en base. Sans cette table, `drizzle-kit migrate` croit qu'il n'y a rien à faire et ne fait rien — sans erreur, sans message. Le workaround actuel (`drizzle-kit push`) est acceptable en dev solo mais inutilisable en équipe ou en CI/CD.

**Comportement attendu :**

- `bun run db:migrate` (via `docker exec`) applique les migrations manquantes et met à jour `__drizzle_migrations`
- Un nouveau développeur qui clone le repo peut initialiser la BDD avec `db:migrate` sans intervention manuelle
- Les migrations futures sont appliquées de manière incrémentale et traçable

**Plan de correction :**

1. Vérifier l'état réel de la BDD Docker : `SELECT * FROM __drizzle_migrations` (probablement absente)
2. Créer la table `__drizzle_migrations` avec le schéma attendu par Drizzle Kit :
   ```sql
   CREATE TABLE IF NOT EXISTS __drizzle_migrations (
     id SERIAL PRIMARY KEY,
     hash TEXT NOT NULL,
     created_at BIGINT
   );
   ```
3. Backfiller les migrations déjà appliquées (0001, 0002, 0003/0004) avec leurs hash SHA-256 calculés depuis les fichiers `.sql`
4. Vérifier que `drizzle-kit migrate` détecte la table, ne rejoue pas les migrations déjà présentes, et applique correctement une nouvelle migration de test
5. Supprimer le script de backfill une fois validé
6. Mettre à jour le README et l'onboarding pour remplacer `drizzle-kit push` par `db:migrate`

**Règles de code :**

- Ne jamais rejouer une migration déjà appliquée — le backfill doit être idempotent
- Le script de backfill est dans `apps/backend/scripts/fixDrizzleMigrations.ts` — à supprimer après usage
- Les migrations restent additives : aucune suppression ou renommage de colonne
- Tester : `db:migrate` sur une BDD vierge, `db:migrate` sur une BDD à jour (idempotent), migration suivante appliquée correctement

---

### DEVOPS-05 — Tests d'intégration backend (Postgres réel) + CI dédiée

`[x]` 🟡 Majeur · `.github/workflows/ci.yml` · `apps/backend/tests/`

**Contexte :**

La couverture `bun test --coverage` montrait un `% Lines` très faible sur `infrastructure/` (ex: `patientRepository.ts` ~30%, `syncRepository.ts` ~23%) car ces adapters Drizzle/S3 n'ont de sens qu'exécutés contre une vraie base — les mocker revient à tester des appels de mock, pas un comportement réel. Un premier test d'intégration sur `PgPatientsRepository` a d'ailleurs révélé un vrai bug : `isUniqueViolation()` ne détectait plus les violations de contrainte unique Postgres (code `23505`) depuis que `drizzle-orm` enveloppe l'erreur driver dans une `DrizzleQueryError` — le code réel est exposé sur `.cause`, plus directement sur `.code`. Conséquence : `issueAccessCode` (boucle de retry sur collision de code patient à 6 chiffres) plantait en 500 au lieu de réessayer.

**Comportement attendu :**

- Convention de nommage `*.integration.test.ts` pour distinguer les tests d'intégration des tests unitaires
- `bun run test:unit` exclut les tests d'intégration (rapide, aucune dépendance externe)
- `bun run test:integration` ne lance que les tests d'intégration, contre une vraie base Postgres de test
- La CI exécute les deux en parallèle : `test-unit` (sans service) et `test-integration` (avec service containers Postgres + MinIO)

**Règles de code :**

- `apps/backend/package.json` : scripts `test:unit` (`--path-ignore-patterns '**/*.integration.test.ts'`) et `test:integration` (filtre `integration`, `--pass-with-no-tests` tant que la suite est encore restreinte)
- Les tests d'intégration lisent `TEST_DATABASE_URL` (jamais `DATABASE_URL` de dev) — doivent `skipIf` proprement si la variable est absente plutôt que planter
- Chaque test d'intégration vide les tables concernées en `beforeEach` (pas de dépendance à l'ordre d'exécution) et ferme le pool en `afterAll`
- `.github/workflows/ci.yml` : job `test-integration` avec `services.postgres` (health check), étape `db:migrate` avant les tests — `services.minio` non ajouté tant qu'aucun test n'exerce S3 (l'image officielle `minio/minio` n'a pas de commande par défaut, GitHub Actions ne permet pas de `command:` sur un service ; prévoir `bitnami/minio` ou équivalent le jour où un test S3 sera écrit)
- Tester : round-trip création/lecture patient en DB réelle, contrainte unique réelle sur le code d'accès patient, comportement après révocation

---

### DEVOPS-07 — Alias TypeScript `@infrastructure/*` (backend)

`[x]` 🟢 Mineur · `apps/backend/tsconfig.json` · `apps/backend/src/`

**Contexte :**

`CLAUDE.md` impose déjà `@shared/*` pour importer depuis `shared/` — jamais de chemin relatif. En pratique la règle n'était pas totalement respectée (`../../../shared/logger`, `../../../shared/openapi`, `../../../shared/middleware/rateLimiter` présents dans plusieurs features) et aucun alias équivalent n'existait pour `src/infrastructure/schema`, importé en `../../../infrastructure/schema` depuis quasiment chaque `infrastructure/*Repository.ts` du backend.

**Comportement attendu :**

- Un alias `@infrastructure/*` résout vers `apps/backend/src/infrastructure/*`, au même titre que `@shared/*`
- Plus aucun import relatif à 2+ niveaux (`../../` ou plus) vers `shared/` ou `infrastructure/` dans le backend
- Les imports internes à une feature (ex: `presentation/` → `infrastructure/` de la même feature, ou `domain/` voisin) restent en relatif — l'alias ne concerne que les imports cross-cutting (`shared/`, `infrastructure/`)

**Règles de code :**

- `apps/backend/tsconfig.json` : ajouter `"@infrastructure/*": ["./src/infrastructure/*"]` dans `paths`, à côté de `@shared/*`
- Remplacer tous les imports relatifs vers `infrastructure/schema` et `shared/*` (features, `tests/`, `src/shared/db.ts`, `src/infrastructure/jobs.ts`) par l'alias correspondant
- Après remplacement, faire tourner `bunx biome check --write .` pour l'ordre des imports (alias avant relatif, tri alphabétique) — Biome le fait automatiquement, ne pas réordonner à la main
- Tester : `bunx tsc --noEmit` sans erreur, `bun run test:unit` + `bun run test:integration` inchangés (103 + 5 tests), aucun import relatif profond restant sur `shared/`/`infrastructure/`

---

### DEVOPS-08 — Mise à jour de la doc suite au split tests unitaires/intégration

`[x]` 🟢 Mineur · `README.md` · `CLAUDE.md` · `AGENTS.md` · `docs/onboarding.md` · `apps/backend/.env.example`

**Contexte :**

DEVOPS-05 a introduit `bun run test:unit` / `bun run test:integration` et la variable `TEST_DATABASE_URL`, mais plusieurs docs mentionnaient encore l'ancienne commande unique `bun test --recursive` sans distinction — un nouveau développeur qui suit ces docs ne saurait pas que les tests d'intégration nécessitent une base Postgres de test dédiée.

**Comportement attendu :**

- Toute doc qui documente comment lancer les tests référence `test:unit` / `test:integration`, pas `bun test --recursive`
- `apps/backend/.env.example` documente `TEST_DATABASE_URL` avec une explication de son rôle (base dédiée, jamais la base de dev)

**Règles de code :**

- Fichiers corrigés : `README.md`, `CLAUDE.md`, `AGENTS.md`, `docs/onboarding.md` (section "Vérifier que tout fonctionne" — garde `test:unit` seul, l'intégration demande un setup DB supplémentaire non couvert par l'onboarding rapide), `apps/backend/.env.example`
- Tester : `grep -r "bun test --recursive"` sur tout le repo (hors `node_modules`) ne retourne plus aucun résultat

---

### DEVOPS-09 — Mettre à jour le workflow Git dans CLAUDE.md (worktree)

`[x]` 🟢 Mineur · `CLAUDE.md`

**Contexte :**

`CLAUDE.md` documentait encore l'ancien workflow (`git checkout -b feature/XXX-00-nom` directement sur le dossier courant), alors que toutes les features depuis DEVOPS-05 sont développées dans des git worktree isolés (`git worktree add`) pour ne jamais travailler directement sur `dev`. `CLAUDE.md` étant le fichier d'instructions chargé automatiquement à chaque session, le documenter correctement évite qu'une future session sans contexte reparte sur l'ancien réflexe.

**Comportement attendu :**

- La section "Workflow Git" de `CLAUDE.md` décrit le workflow worktree (`git fetch` → `git worktree add` → push), pas l'ancien `checkout -b`
- Mention explicite du nettoyage du worktree après merge

**Règles de code :**

- Section "Workflow Git" de `CLAUDE.md` alignée avec `.claude/skills/feature-start/SKILL.md`
- Tester : relire la section, vérifier qu'elle correspond exactement aux commandes utilisées par le skill `feature-start`

---

### DEVOPS-01 — Interface d'administration PostgreSQL (pgAdmin)

`[x]` 🟢 Mineur · `docker-compose.yml`

**Comportement attendu :**

- pgAdmin accessible sur `http://localhost:8080`
- Connexion à la base PostgreSQL locale via l'interface web
- Authentification par email/mot de passe définis dans les variables d'environnement

**Règles de code :**

- Ajouter le service `pgadmin` dans `docker-compose.yml`
- Ajouter `PGADMIN_EMAIL` et `PGADMIN_PASSWORD` dans `.env.example` racine
- Le service ne doit tourner qu'en développement — ne jamais déployer en production

---

### DEVOPS-06 — Suivi automatisé des dépendances vulnérables (Dependabot)

`[x]` 🔴 Critique · `.github/dependabot.yml`

**Contexte :**

Audit de sécurité (revue OWASP A06, 2026-07-23) : aucun outil de suivi des vulnérabilités des dépendances n'existait — pas de Dependabot, pas de Renovate, pas d'étape `bun audit`/`npm audit` en CI. Risque de dérive silencieuse des versions de dépendances contenant des CVE connues.

**Comportement attendu :**

- Dependabot ouvre automatiquement une PR quand une dépendance a une mise à jour de sécurité ou une nouvelle version disponible
- Trois écosystèmes surveillés : `bun` (monorepo complet via le `bun.lock` racine — `apps/*`, `packages/*`), `docker` (`apps/backend/Dockerfile`), `github-actions` (les workflows CI/CD)
- Fréquence hebdomadaire (lundi)

**Règles de code :**

- Les mises à jour `minor`/`patch` Bun sont groupées dans une seule PR (`groups.minor-and-patch`) pour limiter le bruit — les montées majeures restent individuelles pour revue manuelle
- Ne pas ajouter d'écosystème pour un fichier qui n'existe pas (ex. pas d'entrée `docker` pour mobile/web tant qu'ils n'ont pas de Dockerfile)
- Si un nouveau workspace ou Dockerfile est ajouté, ajouter l'entrée correspondante dans `dependabot.yml`

---

### NOTIF-01 — Notification push patient en cas de retard de suivi

`[ ]` 🟡 Majeur · `apps/backend/src/features/notifications/`

**Contexte :**

Idée de Mathieu Baro (revue Bloc 2) : le système actuel (ALERT-01) notifie uniquement le médecin sur son dashboard en cas d'absence de synchronisation. Aucune notification n'est envoyée au patient concerné. Proposition : relancer directement le patient par notification push, en plus de l'alerte médecin existante.

**Comportement attendu :**

- Déclenchement manuel : le médecin envoie une notification de relance depuis la fiche patient du dashboard
- Déclenchement automatique : réutilise le seuil d'inactivité (ALERT-01, ou ALERT-02 si le seuil configurable est implémenté) pour envoyer la relance sans action du médecin
- Le patient reçoit une notification push simple, pictographique, cohérente avec l'accessibilité du reste de l'app (pas de texte dense)
- Un patient ne reçoit qu'une relance par période d'inactivité, pas de spam en cas de relances répétées côté médecin

**Règles de code :**

- Réutilise le mécanisme d'enregistrement du token Expo déjà prévu dans **MOB-07** — aucune nouvelle plomberie mobile nécessaire
- La détection "patient en retard" réutilise la logique de seuil de **ALERT-01** (et **ALERT-02** si le seuil par patient est implémenté)
- Le déclenchement manuel est une action côté dashboard (`apps/web/src/features/patients/actions/`) qui appelle l'endpoint backend d'envoi
- Le déclenchement automatique est un job planifié côté backend, similaire au cron de soft delete des codes patients (AUTH-01)
- Tester : déclenchement manuel envoie bien la notification, déclenchement automatique respecte le seuil, pas de double envoi sur la même période d'inactivité

---

## DOCUMENTATION

### DOCS-02 — Séparation documentation rédigée / documentation générée

`[ ]` 🟢 Mineur · `docs/architectureAdr.md` · `.ai/` · `README.md` · `CLAUDE.md`

**Contexte :**

`docs/architecture.md` mélangeait deux natures de contenu : treize décisions rédigées à la
main (« Pourquoi Bun au lieu de Node », « Pourquoi Drizzle au lieu de Prisma ») et une
description structurelle du système (couches backend / web / mobile, schéma de base de
données, sécurité, accessibilité). Un script doit désormais produire automatiquement un
fichier d'architecture à ce même chemin. Le nom doit donc être libéré, et les décisions
rédigées mises hors de portée d'un écrasement par la génération.

**Comportement attendu :**

- `docs/architecture.md` est renommé en `docs/architectureAdr.md` par `git mv`, de sorte que l'historique du fichier reste suivi
- Les références au chemin sont mises à jour dans `README.md`, `.ai/context.md`, `.ai/features.md`, `docs/onboarding.md`, `docs/cdc.md`, `docs/lexique.md` et `CLAUDE.md`
- Le chemin `docs/architecture.md` redevient disponible pour la sortie du script
- Les entrées de `CHANGELOG.md` ne sont pas réécrites : elles décrivent l'état du repo à leur date

**Règles de code :**

- Un fichier produit par le script n'est jamais édité à la main — toute correction passe par le script qui le génère
- Les décisions techniques rédigées (« pourquoi ce choix plutôt qu'un autre ») vivent dans `docs/architectureAdr.md`, jamais dans le fichier généré
- Les blocs de code Markdown déclarent leur langage (MD040)
- Avant d'ouvrir la PR, vérifier qu'aucun lien de la documentation ne pointe vers un chemin disparu

---

## RÈGLES GLOBALES (toutes les features)

- **TDD obligatoire sur toutes les features** : l'agent écrit les tests en premier, génère l'implémentation pour les faire passer, puis le développeur valide. Ne jamais générer du code sans test associé.

- **Types** : toujours importer depuis `@sauver-la-face/shared`, jamais redéfinir
- **Backend — Clean Architecture + DDD** : chaque feature suit 4 couches (`presentation → application → domain ← infrastructure`). Entities et Value Objects dans `domain/`, orchestration dans `application/` sans règle métier. Concepts partagés (ex: `PatientCodeValue`, `ChecksumSHA256`) → `packages/shared/src/domain/`
- **Web — Feature-based** : `app/` = pages fines uniquement, `features/[feature]/components/` = UI pure sans `fetch`, `features/[feature]/hooks/` = logique + TanStack Query, `features/[feature]/actions/` = mutations Server Actions
- **Mobile** : toute donnée est d'abord écrite en SQLite, puis ajoutée à la `sync_queue`
- **Migrations** : additives uniquement (colonnes nullable), jamais de suppression
- **Nommage fichiers** : `camelCase` pour tous les fichiers sans exception (backend, web, mobile)
- **Nommage backend** :
  - `presentation/[feature]Router.ts`
  - `application/[feature]Usecase.ts`
  - `domain/[entity].ts` (entité) · `domain/[entity]Repository.ts` (interface)
  - `infrastructure/[entity]Repository.ts` (implémentation Drizzle)
- **Tests** : un fichier `[feature]Domain.test.ts` par domain (testable sans BDD), un fichier `[feature]Usecase.test.ts` par use case critique
- **Logs** : utiliser Pino via `@shared/logger` — pas de `console.log`
- **Erreurs** : retourner des codes d'erreur explicites (`APP_UPDATE_REQUIRED`, `PHOTO_INTEGRITY_ERROR`, etc.)
