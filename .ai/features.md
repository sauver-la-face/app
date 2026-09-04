[← README](../README.md) · [Contexte IA](context.md) · [Onboarding](../docs/onboarding.md) · [Architecture](../docs/architecture-systeme.md) · [CDC](../docs/cdc.md)

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

### SEC-03 — Révocation de session patient (A07)

`[x]` 🔴 Critique · `apps/backend/src/shared/middleware/` · `apps/backend/src/features/patients/` · `apps/backend/src/infrastructure/schema.ts`

**Contexte :**

Un token patient est signé pour un an (`jwtTokenProvider.ts`) et sa vérification ne porte
que sur la signature, l'expiration et la forme du payload — aucun état serveur n'est
consulté. `requirePatientAuth` accepte donc le token dès que `verify()` retourne non-null.

Aucun mécanisme ne permet de couper l'accès d'un patient. `revokeActiveCodes()` ne révoque
que les codes **jamais utilisés** (`WHERE used_at IS NULL`) et n'est appelée que par
`issueAccessCode()` : émettre un nouveau code invalide les codes en attente, rien de plus.
Le code qui a réellement ouvert la session porte `used_at`, échappe à la révocation, et
`schema.ts` documente explicitement cette intention (« une fois utilisé, le code est valide
pour toujours »). Aucune route de `patientRouter` ne révoque quoi que ce soit.

Conséquence : sur un appareil perdu ou volé, l'accès aux données médicales du patient reste
ouvert jusqu'à l'expiration naturelle du token, soit jusqu'à un an. Le payload transporte
déjà `uuid_patient_code`, la vérification est donc possible sans changer le format du token.

**Comportement attendu :**

- Une route de révocation permet au médecin de couper la session d'un patient
- Après révocation, toute requête portant un token issu du code révoqué reçoit un 401
- La révocation vise le code **utilisé** qui a ouvert la session, contrairement à `revokeActiveCodes()` qui ne cible que les codes en attente
- Un patient dont la session est révoquée retrouve l'accès après émission et saisie d'un nouveau code
- La ligne A07 de l'audit OWASP est corrigée : elle classe aujourd'hui la catégorie en « ✅ Corrigé » alors que l'absence de révocation n'était pas couverte — le compromis « 1 an assumé offline-first » porte sur la durée, pas sur l'impossibilité de couper l'accès

**Règles de code :**

- La vérification de révocation vit dans `requirePatientAuth` (`shared/middleware/`), sur le `uuid_patient_code` du payload — un read par requête, cachable
- La méthode de révocation de session est **distincte** de `revokeActiveCodes()` : ne pas ajouter `used_at` à la condition existante, qui sert l'émission de code et doit continuer à ne toucher que les codes en attente
- Le commentaire de `schema.ts` sur `patient_code` doit refléter la nouvelle règle — c'est lui qui porte l'intention actuelle
- Vérifier l'effet sur l'index unique `patient_code_code_active_unique` (`ON code WHERE deleted_at IS NULL AND revoked_at IS NULL`) : révoquer un code utilisé libère ses 6 chiffres pour une réattribution future
- Aucune règle métier dans `presentation/` ni dans `infrastructure/` — la décision « ce token est-il encore valide » appartient au domaine
- Tester : token valide avant révocation → 200, même token après révocation → 401, révocation d'un patient sans session active, non-régression de `issueAccessCode()` qui ne doit toujours révoquer que les codes en attente

---
### SEC-04 — Routes non protégées : alertes et génération de codes (A01)

`[x]` 🔴 Critique · `apps/backend/src/features/alerts/` · `apps/backend/src/features/auth/` · `apps/backend/tests/`

**Contexte :**

Un audit complet des routes, mené après SEC-03, a révélé une chaîne d'accès
complète aux données médicales **sans aucune authentification** :

1. `GET /alerts` n'a aucun garde — `alertRouter` ne contient pas une seule ligne
   d'authentification. La réponse expose `patientDisplayName` (le nom du patient),
   `patientId`, `symptomCode` et `symptomLabelFr` : donnée de santé nominative,
   soit une donnée sensible au sens de l'article 9 du RGPD.
2. `POST /auth/patient/generate` fabrique un code d'accès à six chiffres pour
   n'importe quel `uuid_patient` fourni dans le corps, et le renvoie en clair.
   `createAuthRouter` est monté sans garde médecin. `POST /auth/patient/renew`
   présente le même défaut.
3. `POST /auth/patient/validate` échange ce code contre un JWT valable un an.

Les UUID nécessaires à l'étape 2 s'obtiennent à l'étape 1. Le rate limiting ne
protège pas : il compte les tentatives *échouées*, or ici rien n'est deviné.

SEC-01 avait bien imposé la session médecin, mais sur un périmètre énuméré à la
main — `patientRouter`, `photosRouter`, `exportsRouter`, `instructions` —, et
`alertRouter` comme `authRouter` n'y figuraient pas. L'audit OWASP a ensuite
classé A01 « Corrigé » en reprenant cette liste. Rien ne vérifiait qu'elle était
complète.

**Comportement attendu :**

- `GET /alerts` exige une session médecin
- `POST /auth/patient/generate` et `POST /auth/patient/renew` exigent une session médecin
- `POST /auth/patient/validate` reste public : c'est le login patient lui-même
- Un test monte l'**application complète** et parcourt la table de routage réelle : toute route est soit protégée, soit inscrite dans une liste explicite de routes publiques
- La ligne A01 de `docs/security/owasp.md` renvoie à ce test, pas à une affirmation en prose

**Règles de code :**

- Le test d'inventaire lit `app.routes`, jamais une liste écrite à la main : une liste se périme, la table de routage est la réalité
- Une route inconnue du test le fait **échouer** — le défaut est le refus, pas l'oubli. C'est ce qui manquait à SEC-01
- Ne pas remplacer un garde à joker (`/patients/*`) par une énumération de chemins : le joker protège toute route future par défaut, une liste l'oublie par défaut et le trou est silencieux
- Ce test doit monter l'app entière : c'est le seul niveau où les recouvrements entre routeurs sont visibles, celui qui avait masqué `GET /patients/{id}/instructions` jusqu'à SEC-03
- Tester : chaque route protégée renvoie 401 sans identifiants, `validate` reste accessible, et l'ajout d'une route non déclarée casse la suite

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

### ALERT-03 — Alerte d'inactivité pour un patient enrôlé qui n'a jamais synchronisé

`[ ]` 🟢 Mineur · `apps/backend/src/features/alerts/`

**Contexte :**

`buildSyncOverdueAlerts` ne considère que les patients dont `last_synced_at` est renseigné (`alertsDomain.ts`, filtre `lastSyncedAt !== null`). Un patient qui a consommé son code d'accès — donc qui a l'application en main — mais dont aucune synchronisation n'est jamais remontée reste invisible côté alertes : il n'apparaît qu'en statut « jamais synchronisé » dans le tableau. C'est pourtant le silence le plus inquiétant du parcours.

Le comportement actuel est correct pour le cas inverse — fiche créée, code jamais remis au patient — où alerter n'aurait aucun sens : le patient n'a pas encore de moyen de donner signe de vie.

**Comportement attendu :**

- Le compte à rebours d'inactivité démarre au premier signe de vie possible : `last_synced_at` s'il existe, sinon la date d'utilisation du code d'accès (`patient_code.used_at`)
- Un patient sans code utilisé ne déclenche aucune alerte — comportement actuel préservé
- Le message distingue les deux cas : « aucune synchronisation depuis X jours » vs « première connexion il y a X jours, aucune donnée reçue »

**Règles de code :**

- La résolution de la date de départ vit dans `alerts/domain/` — le repository fournit `usedAt` en plus de `lastSyncedAt`, il ne décide pas
- Se combine avec **ALERT-02** (seuil paramétrable) : même seuil appliqué, seule la date de départ change
- Dépend de **ALERT-01** (déjà implémenté), extension non bloquante
- Tester : code utilisé il y a 10 jours sans sync → alerte, code utilisé hier sans sync → pas d'alerte, aucun code utilisé → pas d'alerte, sync récente → pas d'alerte

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

### API-02 — Conformité et sécurité du document OpenAPI

`[x]` 🟡 Majeur · `apps/backend/src/index.ts` · `apps/backend/src/shared/openapi.ts` · `apps/backend/src/features/*/presentation/`

**Contexte :**

Le document produit par API-01 était structurellement chargeable — Swagger UI l'affichait — mais le validateur Redocly y relevait 38 erreurs. La plus grave : `security-defined`, quinze fois. Le document ne déclarait aucun schéma d'authentification, ni à la racine ni par opération. Un lecteur y voyait treize chemins qui semblaient tous ouverts, `/patients` et `/alerts` compris, alors que SEC-01 et SEC-04 les protègent. La documentation affirmait l'inverse du code — et c'est ce document qui est servi publiquement en production, `/openapi.json` n'étant pas conditionné par `NODE_ENV`.

Trois autres familles : `operation-summary` (quinze opérations sans résumé), `nullable-type-sibling` (sept schémas avec `nullable: true` sans `type`, invalide en OpenAPI 3.0, issus de `z.any()` et `z.unknown()`), et `no-empty-servers` (aucune URL de base, donc aucun client générable).

**Comportement attendu :**

- Les deux authentifications du projet sont déclarées : session Better Auth par cookie pour le médecin, jeton porteur JWT pour le patient
- Chaque opération déclare celle qui la protège ; `/auth/patient/validate`, seule route métier publique, déclare `security: []` explicitement
- Le document passe le validateur Redocly sans erreur
- Un `servers` reflète l'URL publique du backend

**Règles de code :**

- Les schémas de sécurité sont enregistrés une fois dans `index.ts` via `openAPIRegistry.registerComponent`, jamais redéclarés par routeur
- Un `security` explicite sur chaque opération, y compris `[]` pour les routes publiques : l'absence de déclaration ne doit jamais servir à signifier « publique »
- Les réponses décrivent la forme réellement sérialisée — `details` porte un `error.flatten()` de Zod, pas une valeur libre ; `code` porte un Value Object dont le champ `value` sort tel quel faute de `toJSON`
- Ne jamais réintroduire `z.any()` ni `z.unknown()` dans une réponse documentée : les deux produisent `nullable` sans `type`
- **Limite connue** : `photosRouter` et `exportsRouter` n'utilisent pas `createRoute` — leurs routes n'apparaissent pas dans le document, qui décrit donc quinze opérations sur un total plus élevé. À traiter séparément.
- Tester : `bunx @redocly/cli lint` sur le document généré → zéro erreur

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
- Timeline des événements médicaux
- Graphique d'évolution de la sévérité des symptômes — **reporté, voir WEB-08**. Un panneau « Évolution des symptômes » avait été livré à sa place : il comptait les symptômes par événement, ce que la timeline dit déjà en les nommant, et un décompte ne mesure aucune sévérité. Retiré plutôt que laissé comme réponse approximative à une exigence qui demandait autre chose

**Règles de code :**

- Les données sont récupérées via un hook `usePatientHistory(id)`
- Les composants graphiques sont dans `apps/web/src/components/`

---

### WEB-03 — Gestion des utilisateurs et codes d'accès

`[x]` 🟡 Majeur · `apps/web/src/app/patients/`

**Comportement attendu :**

- Création d'un compte patient — sur sa page dédiée `/patients/new`, jamais depuis la liste
- Génération / renouvellement d'un code 6 chiffres
- Affichage du statut du code (actif / expiré / supprimé)

**Règles de code :**

- La génération du code est toujours côté backend (PATIENT-01 / AUTH-01)
- Le frontend affiche uniquement, ne génère jamais le code lui-même
- **Un seul chemin de création.** La page liste a porté un temps son propre formulaire, en plus de la page dédiée : deux formulaires pour une même action, adossés à deux hooks `useCreatePatient` homonymes dans deux fichiers. Ils divergent tôt ou tard — validation corrigée d'un côté seulement, champ ajouté à un seul endroit. La liste renvoie vers `/patients/new` et affiche le bandeau de confirmation au retour (`?cree=1`)

---

### WEB-04 — Export données (PDF / CSV)

`[x]` 🟢 Mineur · `apps/web/src/app/exports/`

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

### WEB-07 — Pages légales

`[x]` 🟡 Majeur · `apps/web/src/app/[locale]/mentions-legales/` · `apps/web/src/app/[locale]/confidentialite/` · `apps/web/src/app/[locale]/plan-du-site/`

**Contexte :**

Le pied de page défini dans `app/[locale]/layout.tsx` est rendu sous chaque écran de
l'application et pointe vers trois adresses qui n'existaient nulle part : `/mentions-legales`,
`/confidentialite` et `/plan-du-site` répondaient toutes les trois 404, y compris depuis la page
de connexion.

Le défaut n'est pas le lien mort mais ce que le lien annonce. Un pied de page qui écrit
« Données personnelles et confidentialité » sous chaque écran d'une application de santé prend un
engagement ; un 404 derrière cet engagement déplace la question d'un évaluateur du lien vers le
reste du dossier.

**Comportement attendu :**

- Les trois adresses répondent 200 dans les trois locales
- Le contenu décrit ce que l'application traite réellement — les champs du schéma, les durées du
  cahier des charges, les mécanismes implémentés — et non un texte type
- Le plan du site n'énumère que des pages réellement servies : annoncer une page inexistante
  reproduirait le défaut corrigé
- Les fiches patient sont volontairement absentes du plan : leur adresse contient un identifiant
  de patient

**Règles de code :**

- Aucune donnée n'est listée sans être vérifiée dans `infrastructure/schema.ts` : la page décrit
  le traitement réel, pas le traitement souhaité
- L'identité de l'éditeur et celle de l'hébergeur ne sont pas inventées — elles engagent
  juridiquement et restent explicitement à compléter par la structure porteuse
- Les trois pages partagent un gabarit unique (`features/legal/components/LegalPage.tsx`) pour
  qu'elles ne divergent pas visuellement au fil des modifications
- **Le khmer n'est pas traduit** : le bloc `legal` de la locale `km` reprend l'anglais, et chaque
  page le signale dans son introduction plutôt que de laisser croire à un oubli. Du texte
  juridique demande un locuteur natif. Dette assumée, à lever avant toute mise en production —
  elle s'ajoute aux 69 valeurs anglaises déjà présentes dans `patients` et `patientManagement`
- Tester : les trois adresses en `fr`, `en` et `km`, et le pied de page depuis un écran non
  authentifié

---

### WEB-08 — Graphique d'évolution de la sévérité des symptômes

`[ ]` 🟢 Mineur · `apps/backend/src/infrastructure/schema.ts` · `apps/web/src/features/patients/components/`

**Contexte :**

WEB-02 demandait un graphique d'évolution de la **sévérité**. Le panneau livré comptait les symptômes par événement — deux symptômes n'y paraissaient pas moins graves qu'une suppuration isolée — et répétait la timeline voisine avec moins d'information, puisqu'elle les nomme. Il a été retiré.

La cause n'est pas la mise en œuvre mais le modèle de données : la table `symptom` porte `code`, `label_fr`, `label_km` et `triggers_alert`. Ce booléen distingue les symptômes qui déclenchent une alerte, il ne gradue rien. Aucune sévérité n'est représentable aujourd'hui.

**Comportement attendu :**

- Chaque symptôme du référentiel porte un niveau de gravité (`leger` · `modere` · `severe`)
- La fiche patient trace ce niveau dans le temps : la courbe monte quand l'état se dégrade, descend quand il s'améliore
- Les dates sont espacées selon leur écart réel, un patient silencieux laissant un intervalle visible

**Règles de code :**

- Migration additive sur `symptom` avec une valeur par défaut : les lignes existantes restent valides, aucun symptôme ne devient nul
- Le niveau est une donnée du référentiel, pas une valeur calculée — il se décide avec les chirurgiens, comme la liste elle-même (MED-01)
- `triggers_alert` reste indépendant : un symptôme sévère ne déclenche pas forcément une alerte, et inversement
- Ne pas réintroduire un décompte comme substitut : c'est ce qui a été retiré
- Dépend de **MED-01** pour l'attribution des niveaux
- Tester : aggravation → courbe montante, amélioration → descendante, patient sans signalement → aucun point

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

`[x]` 🟡 Majeur · `Caddyfile.prod` · `docker-compose.yml` · `docker-compose.override.yml` · `docker-compose.prod.yml`

**Contexte :**

Le service Caddy existait, mais sa configuration tenait en trois lignes servant
`:80` en HTTP simple. Caddy ne provisionne un certificat que pour un **nom
d'hôte** : une adresse de la forme `:80` ne déclenche jamais l'obtention
automatique. Le TLS annoncé par l'ADR 0009, par le tableau Sécurité de
`architectureAdr.md` et par le rapport de certification n'existait donc nulle
part, alors qu'il porte sur le transport de données de santé.

La séparation des fichiers Compose fait partie de cette feature et non d'une
autre : le certificat de production est inatteignable sans un environnement de
production réel. Or `docker-compose.prod.yml` n'existait pas — la séquence de
déploiement documentée au rapport (C2.1.1, critère 4) échouait sur un fichier
introuvable —, aucun profil `prod` n'était déclaré, et le backend construisait
`target: dev` en dur.

**Comportement attendu :**

- Caddy termine le TLS en entrée et proxifie vers le backend Hono (`backend:3001`)
- TLS 1.3 obligatoire — TLS 1.2 et inférieurs rejetés
- En développement : HTTP simple sur la boucle locale, aucune donnée réelle n'y transite
- En production : certificat Let's Encrypt automatique via `CADDY_DOMAIN`
- La séquence de déploiement du rapport fonctionne telle qu'elle est écrite
- L'image de production ne contient aucun montage de code de l'hôte

**Fichiers à créer/modifier :**

- `Caddyfile.prod` — configuration de production, TLS et en-têtes de sécurité
- `docker-compose.yml` — base commune, sans rien de spécifique au développement
- `docker-compose.override.yml` — développement, chargé automatiquement
- `docker-compose.prod.yml` — production, profil `prod` et `target: prod`

**Règles de code :**

- Le backend Hono n'expose jamais directement le port 3001 hors du réseau Docker — tout le trafic passe par Caddy
- `CADDY_DOMAIN` en variable d'environnement pour switcher entre dev (`localhost`) et prod (domaine réel)
- Le `Caddyfile` est monté en volume dans le service Docker — pas de rebuild image pour changer la config
- Ajouter `CADDY_DOMAIN` et `ACME_EMAIL` dans `.env.example` et `.env.production`
- Rien de spécifique au développement dans `docker-compose.yml` : un `volumes: []` posé dans un fichier de surcharge **ne supprime pas** les montages du fichier de base, ils fusionnent par chemin cible. La séparation se fait donc en amont, pas par annulation
- `docker-compose.override.yml` n'est chargé que par un `docker compose` sans `-f` — c'est ce qui garantit qu'aucun montage de code ni cible `dev` ne parte en production
- Un script nommé `prod` ne lit jamais `.env.local` : mieux vaut un échec bruyant sur un fichier absent qu'un démarrage silencieux avec les identifiants de développement
- Tester : `docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod config` résout `target: prod` sans montage de code, et `caddy validate` accepte le `Caddyfile.prod`

---
### DEVOPS-12 — Conteneuriser le dashboard web

`[x]` 🟡 Majeur · `apps/web/Dockerfile` · `docker-compose.prod.yml` · `Caddyfile.prod`

**Contexte :**

Le rapport de certification annonce quatre services en production, dont
Next.js. Or `apps/web` n'avait aucun `Dockerfile` et n'apparaissait dans aucun
fichier Compose : le dashboard n'était pas déployable.

**Comportement attendu :**

- L'image de production se construit et sert le dashboard
- Caddy route deux domaines : l'API vers `backend:3001`, le dashboard vers `web:3000`
- Le dashboard n'est conteneurisé qu'en production — en développement il tourne sur l'hôte, où le rechargement à chaud est plus rapide

**Règles de code :**

- **La base de l'image est Node, pas `oven/bun`.** `next build` (Next 16, Turbopack) charge un runtime CommonJS compilé que Bun ne sait pas évaluer : la construction échoue sur « Expected CommonJS module to have a function wrapper ». La CI n'y est pas confrontée parce qu'elle installe Node **et** Bun sur le runner. L'image reproduit cet environnement ; Bun y reste, c'est lui qui gère le lockfile et les dépendances workspace
- La version de Bun installée est épinglée, jamais `latest` : sinon l'image n'est pas reproductible d'une construction à l'autre
- `NEXT_PUBLIC_API_URL` est un **argument de build**, pas une variable d'exécution : Next l'inscrit dans le bundle client à la compilation. Changer de domaine impose de reconstruire l'image
- Routage Caddy par domaine et non par chemin : les routes du backend sont à la racine (`/patients`, `/alerts`, `/auth`), sans préfixe `/api`. Une séparation par chemin obligerait à les énumérer, et toute route ajoutée sans y penser partirait vers le mauvais service
- L'image de production **n'embarque pas `node_modules`**. `output: 'standalone'` produit un serveur autonome accompagné des seules dépendances réellement atteintes par le code, recopié dans une image Node nue — sans Bun ni outils de construction
- `outputFileTracingRoot` doit pointer sur la racine du monorepo : sans cela le traçage s'arrête au dossier de l'app et manque les dépendances hissées ainsi que `@sauver-la-face/shared`, et le serveur autonome démarre sur un module introuvable
- Les fichiers de `.next/static` et `public/` **ne sont pas tracés** par Next : les oublier donne une page qui répond 200 mais dont le CSS et le JavaScript tombent en 404
- Tester : l'image se construit, le conteneur démarre, sert une page en HTTP 200 **et ses fichiers statiques** en 200 également

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

### DEVOPS-13 — Job CI de construction des images Docker

`[x]` 🟡 Majeur · `.github/workflows/ci.yml`

**Contexte :**

Les cinq jobs existants valident le code source, jamais les images livrées. Les cibles `prod` des deux `Dockerfile` n'étaient construites que sur le poste de la personne qui les écrivait — celle du backend ne l'avait jamais été du tout, `docker-compose.yml` construisant `target: dev` jusqu'à DEVOPS-02. Une image qui ne démarre pas ne se découvre alors qu'au déploiement.

Ce job était volontairement différé jusqu'à la séparation des fichiers Compose (DEVOPS-02), pour ne pas valider une structure sur le point d'être remplacée.

**Comportement attendu :**

- Construction des deux images en cible `prod` à chaque pull request et à chaque push sur `dev`
- Chaque image est **démarrée** et interrogée : `/health` pour le backend, `/fr` pour le dashboard
- Les fichiers statiques du dashboard sont vérifiés séparément — une page peut répondre 200 avec tous ses assets en 404
- `docker-compose.prod.yml` est validé par `docker compose config`

**Règles de code :**

- Les secrets de démarrage sont générés à la volée (`openssl rand`) — jamais de valeur en dur dans le workflow, même jetable
- `DATABASE_URL` pointe volontairement dans le vide : `/health` ne touche pas la base, et exiger un Postgres ferait échouer le job pour une raison étrangère à ce qu'il vérifie
- Vérifier les fichiers statiques, pas seulement le code HTTP de la page : c'est le seul moyen de détecter un `.next/static` non recopié en mode `standalone`
- Les conteneurs sont supprimés dans une étape `if: always()`
- Dépend de **DEVOPS-02** (séparation des Compose) et **DEVOPS-12** (Dockerfile web)
- Tester : image backend qui ne démarre pas → job rouge, `.next/static` absent → job rouge, chemin invalide dans le Compose de production → job rouge

---

### DEVOPS-14 — `WEB_URL` : accorder le format entre CORS et Better Auth

`[x]` 🟡 Majeur · `apps/backend/src/index.ts` · `apps/backend/src/features/auth/infrastructure/authConfig.ts`

**Contexte :**

La même variable d'environnement est lue à deux endroits, dans deux formats incompatibles :

```ts
// index.ts — middleware CORS : chaîne simple, une seule origine
origin: process.env.WEB_URL ?? 'http://localhost:3000'

// authConfig.ts — Better Auth : liste séparée par virgules
trustedOrigins: (process.env.WEB_URL ?? 'http://localhost:3000').split(',')
```

Deux conséquences. D'abord, un seul serveur de développement web peut fonctionner à la fois : sur tout autre port que 3000, le préflight est refusé et chaque appel API échoue. Le navigateur affiche « Failed to fetch », symptôme qui ressemble à une panne d'authentification alors que la cause est le CORS — le diagnostic coûte du temps à chaque fois.

Ensuite et surtout, la variable est piégée. Renseigner `WEB_URL="http://localhost:3000,http://localhost:3100"`, ce que la lecture de `authConfig.ts` encourage, fait passer la chaîne entière — virgule comprise — comme origine littérale au middleware CORS. Elle ne correspond alors à aucune origine réelle : on ne gagne pas le second port, on perd le premier.

**Comportement attendu :**

- `WEB_URL` accepte une liste d'origines séparées par des virgules, comprise de la même façon par le middleware CORS et par Better Auth
- Une valeur unique sans virgule continue de fonctionner à l'identique — aucune configuration existante n'est cassée
- La valeur par défaut reste `http://localhost:3000` quand la variable est absente

**Règles de code :**

- Le découpage et le nettoyage des espaces se font en un seul endroit, réutilisé par les deux lecteurs — deux `.split(',')` recopiés reproduiraient la divergence qu'il s'agit de supprimer
- Hono accepte un tableau pour `origin` : la correction ne demande aucune fonction de rappel
- `.env.example` documente le format liste et la raison — sans quoi le prochain qui posera une seconde origine retombera dans le piège
- Tester : une origine → comportement inchangé, deux origines → les deux acceptées, variable absente → `http://localhost:3000`, espaces autour des virgules → tolérés

**Le symptôme est trompeur, et il a une seconde cause :**

Une origine refusée par le CORS se manifeste dans le navigateur par un « Failed to fetch ». Le message désigne l'appel réseau, donc l'authentification pour qui le rencontre à la connexion — alors que le défaut est une variable de configuration côté serveur.

Exactement le même message apparaît pour une raison sans rapport, côté client cette fois. `authClient.ts` et `useDashboard.ts` retombent tous deux sur `http://localhost:3001` quand `NEXT_PUBLIC_API_URL` est absente. En développement local, ce repli tombe juste et masque le problème. En conteneur il est faux : `NEXT_PUBLIC_API_URL` est un **argument de build**, pas une variable d'exécution — Next l'inscrit dans le JavaScript à la compilation (`apps/web/Dockerfile`, `docker-compose.prod.yml` la passe comme `build.args`). Une image construite sans elle embarque donc `localhost:3001` en dur, et chaque navigateur qui l'ouvre interroge **sa propre machine** au lieu du serveur. Le symptôme est identique, la cause est ailleurs, et elle ne se voit qu'en production.

Deux conséquences pour ce lot : le repli mérite d'être unique et déclaré à un seul endroit plutôt que recopié dans chaque hook, et l'absence de `NEXT_PUBLIC_API_URL` au build de l'image devrait échouer bruyamment plutôt que produire une image silencieusement inutilisable.

---

### DEVOPS-15 — Faire échouer le suivi de features au lieu de le laisser passer

`[x]` 🟡 Majeur · `.github/workflows/ci.yml` · `.github/workflows/update-feature-status.yml` · `.github/workflows/feature-in-progress.yml`

**Contexte :**

`update-feature-status` extrait l'identifiant du nom de branche, cherche `### <ID>` dans `features.md`, et sort en **succès** quand il ne trouve rien — deux fois : identifiant illisible dans le nom de branche, ou section absente du fichier. Le `|| true` posé sur le `grep` pour éviter un échec d'extraction et les deux `exit 0` qui suivent transforment l'anomalie en croix verte. Le message existe, dans les logs d'un job réussi que personne n'ouvre.

Le coût est mesuré, pas supposé : `DOCS-04` a livré trois lots sous un identifiant sans entrée, et `SEC-05` a été mergé en PR #109 dans le même angle mort. `DEVENV-01`, `DOCKER-01` et `API-03` sont dans le même cas, branches ouvertes.

Un second trou double le premier : le workflow ne se déclenche que sur `feature/`, alors que douze des dix-sept branches actives sont en `fix/`. La majorité du travail échappe au suivi par construction.

**Périmètre :**

- [x] Les deux `exit 0` de `update-feature-status` deviennent `exit 1`, avec une annotation `::error::` qui remonte en tête du run
- [x] Un job `Entrée de suivi` dans `ci.yml`, exécuté sur les PR, qui refuse une branche `feature/` ou `fix/` dont l'identifiant est illisible ou sans section dans `features.md`
- [x] Les deux `exit 0` de `feature-in-progress` deviennent `exit 1` de la même façon. Ce job est le seul des trois à lire `features.md` **sur `dev`** — il fait `checkout` avec `ref: dev` — donc son échec dit précisément que l'entrée n'y est pas encore

**Règles :**

- Le blocage appartient à la CI de PR, pas à `update-feature-status` : ce dernier tourne sur `pull_request: closed`, donc après le merge — le faire échouer produit une alarme, jamais une barrière. Les deux sont utiles, ils ne jouent pas le même rôle
- Les trois workflows disent trois choses différentes et aucun ne remplace les autres. `feature-in-progress` (création de branche) : l'entrée est-elle sur `dev` ? `Entrée de suivi` (PR) : le travail est-il spécifié quelque part ? `update-feature-status` (après merge) : le statut a-t-il pu être posé ? Le premier alerte au démarrage, le deuxième bloque, le troisième constate
- Le job ne juge que les branches `feature/` et `fix/`. Une branche hors convention sort en succès : elle ne prétend rien suivre, et faire échouer une branche de maintenance apprendrait surtout à contourner le job

**Hors périmètre :**

- Les entrées manquantes de `DEVENV-01`, `DOCKER-01`, `API-03` et `SEC-05` : elles décrivent un travail qu'il faut lire avant de le spécifier, et les inventer ici reproduirait le défaut que cette feature corrige
- L'extension d'`update-feature-status` aux branches `fix/`, qui change le sens du statut `[x]` et mérite d'être décidé pour lui-même

---

### DEMO-01 — Jeu de données de démonstration

`[x]` 🟡 Majeur · `apps/backend/scripts/seedDemo.ts`

**Contexte :**

Les scripts de seed existants ne produisent aucune alerte : `seedMed01` n'insère que le référentiel de symptômes, et `seedSync01` crée un patient dont le symptôme est `triggers_alert: false`, sans `last_synced_at`. Sur une base fraîche, le tableau de bord affiche donc le bandeau vert « aucune alerte » — ce qui contredit la démonstration du parcours médecin, où le premier écran montre « les alertes du jour ».

Le dossier patient (WEB-03) souffre du même vide : `seedSync01` insère une ligne `media` dont le `file_url` pointe sur `https://server.example/existing-media.jpg`, une URL fictive. `GET /photos/:mediaId` en extrait une clé S3 qui n'existe dans aucun bucket, et la vignette s'affiche cassée — alors que « toute la chronologie, photos comprises » est le point d'orgue du parcours de démonstration.

**Comportement attendu :**

- Six patients couvrant tous les états lisibles à l'écran : alerte critique (symptôme déclencheur récent), alerte d'inactivité (dernière synchronisation à J-11), accès créé avec code actif jamais utilisé, code expiré faute de saisie, code révoqué après perte de l'appareil (suivi normal par ailleurs), fiche sans aucun code émis
- Aucun patient ne fait doublon : chacun est le seul à produire au moins un badge. Un septième patient en « suivi normal » a été retiré pour cette raison — son couple OK / code utilisé était déjà porté par deux autres
- Après exécution, `GET /alerts` renvoie 3 alertes (2 critiques sur le même signalement, 1 d'inactivité) et `GET /patients` en renvoie 6
- **Les 9 badges de la liste sont représentés** : les 4 badges de statut (alerte, hors-ligne, jamais synchronisé, OK — l'alerte venant de `hasAlert`, pas de `syncStatus`) et les 5 états de code (actif, utilisé, expiré, révoqué, aucun). Un badge qu'aucun patient ne déclenche est un pan de l'interface que personne ne voit jamais, en démonstration comme en recette
- Les trois patients ajoutés pour les états de code ne créent aucune alerte supplémentaire : symptômes non déclencheurs, et `last_synced_at` soit récent soit nul — le compte reste à 3
- Trois de ces patients portent une chronologie photo réellement servie par `GET /photos/:mediaId` : les fichiers sont déposés dans le bucket MinIO, pas seulement référencés en base
- Rejouable sans produire de doublon ni casser les contraintes d'unicité

**Règles de code :**

- Les événements sont rattachés au médecin réellement enregistré (`DEMO_PHYSICIAN_EMAIL`, ou le premier médecin en base) — jamais à un médecin fictif créé par le script, sinon la démonstration se fait sous un compte différent de celui de la connexion
- Les patients sont retrouvés par nom avant insertion : un patient créé à la main depuis le dashboard est enrichi, pas dupliqué
- Les symptômes déclencheurs viennent de `SYMPTOMS_SEED` — jamais de `triggers_alert` écrit en dur dans le script
- Refus d'exécution si `NODE_ENV=production` : le script efface les données cliniques des patients qu'il gère
- Les clés S3 suivent la convention de `S3PhotoStorage` (`{eventId}/{mediaId}`) — le seed ne définit pas son propre format, sinon la route de lecture ne sait plus reconstruire la clé
- MinIO injoignable n'interrompt pas le seed : le jeu de données du tableau de bord ne dépend pas du stockage objet, seules les photos sont omises, avec un avertissement
- **Aucune photo médicale réelle n'est versionnée** : ce sont des données de santé, et les clichés disponibles en ligne montrent des enfants identifiables qu'on n'attribue pas à un dossier fabriqué. Le script génère des illustrations schématiques filigranées, dont l'aspect dérive du jour post-opératoire et des symptômes de l'événement. `scripts/demoAssets/` accueille de vraies images si besoin, et son `.gitignore` les exclut du dépôt
- Tester : exécution sur base vierge → 3 alertes, seconde exécution → toujours 4 patients et 3 alertes

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

### DOCS-02 — Structure documentaire : ADR, OWASP et accessibilité séparés

`[x]` 🟢 Mineur · `docs/` · `.ai/` · `README.md` · `CLAUDE.md` · `.github/`

**Contexte :**

`docs/architecture.md` mélangeait quatre natures de contenu dans un seul fichier de
434 lignes : des décisions techniques rédigées (« Pourquoi Bun au lieu de Node »), une
description structurelle du système, un audit OWASP daté, et un livrable d'accessibilité
rédigé pour un correcteur (« critère 3 », « preuve de conformité »). Quatre publics et
quatre durées de vie dans un même document, sans moyen de distinguer la règle qui engage
de l'argumentation qui plaide.

Le script `init-project` installe par ailleurs une structure documentaire standard —
`docs/adr/`, `docs/security/owasp.md`, template d'architecture, template de PR, job CI
CHANGELOG — mais il ne crée que les fichiers absents. Tant que `docs/architecture.md`
occupait le chemin, le template n'arrivait pas.

**Comportement attendu :**

- `docs/architecture.md` est renommé par `git mv` pour libérer le chemin au template, sans perdre l'historique du fichier
- Les 22 décisions techniques disparaissent du fichier au profit de `docs/adr/`, une par fichier, chacune avec ses alternatives écartées et ses conséquences
- Le livrable d'accessibilité vit dans `docs/accessibilite.md`, supprimable d'un seul `git rm` une fois le bloc 4 de la grille validé
- Chaque section vidée laisse un renvoi vers sa nouvelle adresse — personne ne doit réécrire une décision au mauvais endroit
- Toute référence de la documentation pointe vers un chemin existant

**Règles de code :**

- Une décision structurante se crée par `bash docs/adr/nouvel-adr.sh "<titre à l'indicatif>"`, jamais en ajoutant un paragraphe à un fichier existant
- Un ADR n'est pas modifié : quand la décision change, on en écrit un nouveau et l'ancien passe en « Remplacé par NNNN »
- Le statut par défaut du helper est `Proposé` — le passer à `Accepté` seulement si la décision est en vigueur dans le code
- Une affirmation de documentation contredite par le code se corrige, elle ne se recopie pas : la table JWT annonçait une « révocation explicite possible par le médecin » qui n'existe nulle part (voir SEC-03)
- Les blocs de code Markdown déclarent leur langage (MD040)

**Hors périmètre, à traiter en DOCS-03 :**

- Migration de l'audit OWASP de `docs/architectureAdr.md` vers `docs/security/owasp.md`, qui devient la référence
- Renommage de `docs/architectureAdr.md`, dont le nom annonce des ADR qu'il ne contient plus
- Remplissage du template des six piliers, aujourd'hui vide
- Import `@AGENTS.md` en tête de `CLAUDE.md`

---

### DOCS-03 — Faire de `docs/security/owasp.md` la référence OWASP unique

`[x]` 🟡 Majeur · `docs/security/owasp.md` · `docs/architectureAdr.md`

**Contexte :**

DOCS-02 a créé `docs/security/owasp.md` mais l'a laissé quasi vide : deux lignes renseignées sur vingt, A01 et A07, les huit autres lignes Web et les dix lignes Mobile sans état ni fichier. Un tableau d'audit vide ne prouve rien et se lit comme un aveu.

Deux tableaux OWASP coexistent par ailleurs, et ils se contredisent. Celui de `docs/architectureAdr.md` (« Audit OWASP Top 10 (2026-07-23) ») emploie la numérotation **2021** — A02 Cryptographic Failures, A03 Injection, A05 Security Misconfiguration, A06 Vulnerable Components, A10 SSRF — quand `docs/security/owasp.md` emploie la **2025**, où ces mêmes numéros désignent autre chose. Un lecteur qui rapproche « A02 » des deux tableaux lit deux catégories différentes sans le savoir. Le tableau de 2026-07-23 porte de surcroît des affirmations dépassées : « TLS 1.3 conforme, non revérifié techniquement » alors que DEVOPS-02 a établi que la terminaison TLS n'existait nulle part avant `c644315`.

**Comportement attendu :**

- Chaque ligne du tableau Web porte un état et cite le fichier qui porte le contrôle, jamais une intention
- Les lignes Mobile non évaluables le disent explicitement plutôt que de rester vides
- Un seul tableau OWASP dans la documentation — `docs/architectureAdr.md` renvoie vers lui au lieu d'en tenir un second
- Le document énonce la règle de vérification qui le rend fiable : il décrit le code publié sur `dev`, jamais une instance en cours d'exécution

**Règles de code :**

- Un état `partiel` complète `fait` / `non applicable` / `à faire` : un contrôle monté et testé avec une brèche connue à côté n'est ni l'un ni l'autre, et le forcer dans un état binaire efface soit le contrôle, soit la brèche. Chaque ligne `partiel` nomme ce qui reste après « Reste : »
- Toute cellule cite un chemin réel, vérifié par `git show origin/dev:<fichier>` ou depuis un worktree créé sur `origin/dev` — jamais depuis un arbre local dont le retard n'a pas été mesuré, jamais par une requête vers une instance
- Aucune référence à une branche non mergée : le document décrit le code publié, et une telle référence est fausse à la date où elle est lue
- Ne pas recopier une affirmation de documentation sans la vérifier dans le code — c'est l'erreur que DOCS-02 relevait déjà sur la table JWT (voir SEC-03), et le tableau de 2026-07-23 la reproduit sur TLS

- Le tableau « Audit OWASP Top 10 (2026-07-23) » de `docs/architectureAdr.md` est retiré, remplacé par un renvoi vers `docs/security/owasp.md` qui dit aussi pourquoi il est parti — un lecteur qui cherche l'ancien tableau doit comprendre qu'il n'a pas été égaré. La décision de modèle d'accès qui l'accompagnait est reprise dans « Exceptions assumées » d'`owasp.md`, la section « Sécurité » du même fichier conservant par ailleurs ses deux lignes d'autorisation dashboard et mobile

**Hors périmètre, à traiter en DOCS-04 :**

- Renommage de `docs/architectureAdr.md`, dont le nom annonce des ADR qu'il ne contient plus
- Remplissage du template des six piliers, aujourd'hui vide
- Import `@AGENTS.md` en tête de `CLAUDE.md`

---

### DOCS-04 — Solder la dette documentaire laissée par DOCS-02 et DOCS-03

`[~]` 🟡 Majeur · `docs/architecture.md` · `CLAUDE.md` · `AGENTS.md` · `docs/architecture-systeme.md`

**Contexte :**

DOCS-02 et DOCS-03 ont chacun renvoyé trois éléments en « hors périmètre » sans leur ouvrir d'entrée. Ils ont été livrés quand même — le renommage d'`architectureAdr.md` d'abord, puis le reste — sur des branches `feature/DOCS-04-*` dont l'identifiant ne correspondait à aucune section de ce fichier. Le workflow `update-feature-status` extrait bien l'ID du nom de branche, ne trouve pas de `### DOCS-04`, et sort en succès : son `|| true` sur le `grep` transforme l'absence en silence. Trois lots de travail ont donc traversé le suivi sans y laisser de trace.

Cette entrée existe pour que le suivi redevienne vrai. Elle est écrite après coup, ce qui est l'anomalie qu'elle corrige.

**Périmètre :**

- [x] Renommage de `docs/architectureAdr.md` en `docs/architecture-systeme.md`, et mise à jour des neuf fichiers qui y renvoient
- [x] Remplissage du template des six piliers de `docs/architecture.md` : par pilier, l'exigence chiffrée, le mécanisme qui y répond avec l'ADR ou le fichier qui le porte, et ce qui est écarté avec son motif
- [x] Import `@AGENTS.md` en tête de `CLAUDE.md`, précédé de la réconciliation des deux fichiers — ils étaient dupliqués à 90 % et se contredisaient sur le workflow Git

**Règles :**

- Aucun pilier n'est rempli avec un mécanisme existant s'il ne répond pas à une exigence écrite. « À décider » et « il n'y en a pas » sont des réponses valides, à condition de porter leur motif — le template le pose lui-même
- `AGENTS.md` est la source unique après l'import : aucune règle projet ne se remet dans `CLAUDE.md`, et rien de propre à un assistant particulier n'entre dans `AGENTS.md`

**Hors périmètre :**

- La supervision, signalée comme le principal écart du pilier « excellence opérationnelle » : le CDC exige 4 h de résolution sur incident critique alors qu'aucun seuil, canal ni astreinte n'est défini. Le document le consigne, il ne le corrige pas — cela demande une décision, pas de la documentation
- Le budget mensuel et son validateur, absents du CDC, qui relèvent de la même décision

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
