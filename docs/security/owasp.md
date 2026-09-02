# Sécurité - OWASP

Créé le 2026-08-31 · Dernière revue : 2026-09-02 (A07 revue après le merge d'AUTH-02)

> Se remplit **feature par feature**, pas au démarrage.
> États : `fait` · `partiel` · `non applicable` · `à faire`
>
> `partiel` = un contrôle existe et est monté dans le code, mais une brèche
> connue subsiste. Ce qui reste est décrit dans la colonne « Où c'est traité »,
> après « **Reste :** ».
>
> Ce document décrit **le code publié sur `dev`**, jamais une instance en cours
> d'exécution. Auditer un conteneur revient à mesurer l'arbre de travail qui
> l'alimente, lequel peut être en retard de plusieurs commits — voir la note
> « Écart entre code publié et instance servie ».

## Web - OWASP Top 10:2025

> ⚠️ Vérifier la version en cours sur https://owasp.org/Top10/ avant tout
> usage en livrable.

| # | Point | État | Où c'est traité |
|---|---|---|---|
| A01 | Broken Access Control (inclut SSRF) | fait | Vérifié par `apps/backend/tests/routesProtegees.test.ts`, qui parcourt la table de routage réelle de l'application montée en entier : toute route répond 401 sans identifiants, ou figure dans une liste explicite de routes publiques. Une route non déclarée fait échouer la suite (SEC-01, SEC-02, SEC-04). Les quatre routes publiques assumées sont `POST /auth/patient/validate`, `GET /health`, `GET /docs` et `GET /openapi.json` · au-delà du 401, l'appartenance est vérifiée côté serveur : `patientId` du token comparé au corps de `/sync` (403 `PATIENT_MISMATCH`), `photoRepository.findEventOwnerPatientId` avant tout upload, instructions patient servies sous `/me` pour qu'il n'y ait plus d'identifiant à comparer · équipe soignante partagée, donc pas de scoping par médecin, décision assumée en A06 · volet SSRF : aucun appel sortant n'est construit à partir d'une entrée utilisateur, les endpoints S3 et MinIO étant lus dans l'environnement (`shared/storage/s3Client.ts`, `shared/storage/logsStorage.ts`) et jamais dans une requête — conclusion de l'audit du 2026-07-23, revérifiée le 2026-09-02 |
| A02 | Security Misconfiguration | partiel | En production, `Caddyfile.prod` est la seule porte d'entrée : TLS 1.3 minimum, HSTS un an sous-domaines inclus, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, suppression de l'en-tête `Server`, `X-Frame-Options` à `DENY` sur l'API et `SAMEORIGIN` sur le dashboard, le backend n'écoutant que sur le réseau Docker interne (DEVOPS-02, DEVOPS-12) · CORS restreint à `WEB_URL` (`index.ts`) · Swagger `/docs` et le logger HTTP désactivés hors développement · `JWT_SECRET` et `BETTER_AUTH_SECRET` obligatoires en production, l'application refuse de démarrer sinon (`index.ts`, `auth/infrastructure/authConfig.ts`) · Postgres, MinIO et pgAdmin publiés sur `127.0.0.1` uniquement, pgAdmin et MinIO derrière le profil `dev` (`docker-compose.yml`). **Reste :** `/openapi.json` est servi sans condition sur `NODE_ENV`, contrairement à `/docs`, et ne déclare aucun schéma de sécurité — le document présente donc des chemins protégés comme ouverts (traité sur la branche API-02, non mergée). La liste des routes publiques de `tests/routesProtegees.test.ts` les commente pourtant ensemble comme « servie uniquement hors production » : c'est vrai de `/docs`, que `tests/apiDocs.test.ts` vérifie bien en 404 en production, et faux de `/openapi.json`, qu'aucun test ne conditionne — `app.doc()` est appelé hors de toute garde dans `index.ts` · `poweredBy()` expose `X-Powered-By` · le `Caddyfile` de développement reste en `:80` en clair, ce qui est voulu, mais rien n'empêche de le lancer par erreur en production à la place de `Caddyfile.prod` |
| A03 | Software Supply Chain Failures | partiel | Dependabot sur trois écosystèmes, hebdomadaire (`.github/dependabot.yml`) : `bun` à la racine (couvre `apps/*` et `packages/*` via le `bun.lock` unique), `docker` pour l'image backend, `github-actions` pour les workflows · majeures d'`expo-*`, `react` et `react-native` volontairement retenues, raison écrite dans le fichier · `bun.lock` versionné · DEVOPS-06. **Reste :** aucune étape `bun audit` en CI (`.github/workflows/ci.yml`), la détection repose entièrement sur l'ouverture de PR par Dependabot · actions GitHub épinglées par tag majeur et non par SHA |
| A04 | Cryptographic Failures | partiel | TLS 1.3 en transit en production, imposé par `Caddyfile.prod` et non simplement négocié — sans la directive `protocols tls1.3`, Caddy accepte TLS 1.2 (DEVOPS-02) · mots de passe médecin hashés par Better Auth (`auth/infrastructure/authConfig.ts`) · JWT patient signé HS256 (`auth/infrastructure/jwtTokenProvider.ts`) · empreinte SHA-256 des photos (`packages/shared/src/domain/checksumSHA256.ts`) · rotation des clés JWT et des identifiants OVH tous les 90 jours ([ADR 0022](../adr/0022-faire-tourner-les-secrets-de-production-tous-les-90-jours.md)) · aucun secret en dur, tout passe par l'environnement. **Reste :** S3 et MinIO en HTTP par défaut, `S3_USE_SSL` et `MINIO_USE_SSL` doivent être posés explicitement (`shared/storage/s3Client.ts`, `shared/storage/logsStorage.ts`) — c'est le trajet backend → stockage d'objets, hors du périmètre de Caddy · chiffrement au repos ni configuré ni documenté |
| A05 | Injection | fait | Accès base exclusivement via Drizzle ORM, donc requêtes paramétrées — aucune concaténation de chaîne. Le template `sql` n'apparaît que dans `infrastructure/schema.ts`, sur des prédicats d'index constants sans donnée utilisateur · validation Zod à l'entrée de chaque route (`@hono/zod-openapi`, schémas de `packages/shared/src/`) et Value Objects validants `PatientCodeValue` et `ChecksumSHA256`, dont le constructeur privé rend impossible la construction d'une valeur non validée · rendu React échappé par défaut, aucun `dangerouslySetInnerHTML` dans `apps/web/src` |
| A06 | Insecure Design | partiel | Clean Architecture par feature : les décisions de sécurité vivent dans `domain/` et non dans `presentation/` (`auth/domain/authDomain.ts` porte `canSustainSession` et `canBeUsed`) · droit à l'effacement traité par anonymisation plutôt que par suppression du dossier médical ([ADR 0018](../adr/0018-anonymiser-les-patients-plutot-que-supprimer-leurs-donnees-medicales.md)) · durées de vie décidées et tracées : code patient 48 h, session médecin 2 h glissantes ([ADR 0020](../adr/0020-fixer-la-session-medecin-a-2h-d-inactivite-et-le-token-patient-a-un-an.md)), 3 tentatives par 15 min ([ADR 0021](../adr/0021-limiter-les-tentatives-d-authentification-a-3-par-15-minutes-et-par-ip.md)) · gardiens injectables donc testables sans base ni Better Auth · absence de scoping par médecin assumée et argumentée dans `shared/middleware/physicianAuthMiddleware.ts`, avec la solution prévue si le besoin apparaît (table de liaison `patient_physician`). **Reste :** aucune modélisation de menaces formalisée — les revues sont ponctuelles, déclenchées feature par feature |
| A07 | Authentication Failures | fait | `shared/middleware/patientAuthMiddleware.ts` relit le code porteur à chaque requête (401 `SESSION_REVOKED`) · `DELETE /patients/{id}/session` coupe la session · [ADR 0023](../adr/0023-couper-une-session-patient-en-revoquant-le-code-porteur.md) · blocage 15 min après 3 échecs par IP sur `/api/auth/sign-in/email` (`auth/presentation/authRouter.ts`) et sur `/auth/patient/validate` (`shared/middleware/rateLimiter.ts`) · session médecin 2 h d'inactivité en fenêtre glissante (`auth/infrastructure/authConfig.ts`) · code patient invalide, expiré, révoqué ou supprimé rejeté au niveau du domaine, chaque cas ayant son code d'erreur (`auth/application/authUsecase.ts`) · **second facteur TOTP exigé côté serveur** : `requirePhysicianAuth` renvoie `403 MFA_REQUIRED` à un médecin non enrôlé, sur les routers patients, photos, exports et instructions (`shared/middleware/physicianAuthMiddleware.ts`, AUTH-02). Le contrôle vit dans l'API et non dans le dashboard — une garde posée côté navigateur se contourne en appelant l'API directement, défaut corrigé par SEC-01. 403 et non 401 : la session est valide, c'est le compte qui n'est pas conforme. Les routes d'enrôlement `/api/auth/two-factor/*` restent ouvertes, sans quoi un médecin non enrôlé ne pourrait jamais s'enrôler. Cinq tests couvrent le gardien, dont l'absence et la valeur nulle de `twoFactorEnabled`, traitées comme des non-conformités et jamais comme des autorisations (`tests/physicianAuthMiddleware.test.ts`) · limitation de tentatives en mémoire de processus, voir les notes |
| A08 | Software or Data Integrity Failures | partiel | Empreinte SHA-256 recalculée côté serveur à chaque upload de photo et comparée à celle envoyée, 422 `PHOTO_INTEGRITY_ERROR` en cas d'écart (`photos/domain/photosDomain.ts`, `tests/photosDomain.test.ts`) — la valeur envoyée par le client n'est jamais crue sur parole · résolution des conflits de synchronisation décidée et tracée en server-wins ([ADR 0003](../adr/0003-resoudre-les-conflits-de-synchronisation-en-server-wins.md)) · `bun.lock` versionné, workflows CI authentifiés par GitHub App ([ADR 0008](../adr/0008-authentifier-les-workflows-github-actions-par-une-github-app.md)). **Reste :** pas de SBOM, aucune vérification de signature des dépendances ni des images Docker |
| A09 | Security Logging & Alerting Failures | partiel | `shared/middleware/auditMiddleware.ts` monté globalement dans `index.ts` : horodatage UTC, méthode, route, `userId`, IP, user-agent, statut et durée — jamais le corps de requête ni de donnée médicale · niveaux séparés, `warn` sur 401/403/429 et `error` sur 5xx, ce qui rend les échecs d'authentification filtrables sans lire tout le flux · Pino ([ADR 0013](../adr/0013-utiliser-pino-comme-logger-backend.md)) écrit d'abord un fichier local, un cron journalier le compresse et l'exporte vers S3 (`shared/jobs/auditExportCron.ts`, `shared/storage/logsStorage.ts`, [ADR 0014](../adr/0014-exporter-les-logs-d-audit-vers-s3-par-un-cron-journalier.md)) · AUDIT-01. **Reste :** aucune alerte ni détection sur motif suspect — les logs sont écrits et archivés, mais personne n'est prévenu · la rétention d'un an exigée par l'HDS n'est appliquée par aucune règle de cycle de vie sur le bucket · le backend ne journalise pas le SHA qu'il sert, ce qui rend indétectable l'écart décrit dans les notes |
| A10 | Mishandling of Exceptional Conditions | partiel | `app.onError` journalise l'erreur complète côté serveur et ne renvoie au client qu'un code `INTERNAL_SERVER_ERROR` sans détail ni pile, `app.notFound` renvoie `NOT_FOUND` (`index.ts`) · `JwtTokenProvider.verify` traduit toute exception — signature invalide, token expiré, payload malformé — en `null` donc en 401, sans distinguer les cas pour l'attaquant · fail-closed sur la révocation : un code porteur introuvable est traité comme révoqué (`shared/middleware/patientAuthMiddleware.ts`) · erreurs métier typées et converties en statuts explicites (`PatientNotFoundError`, `SyncVersionError`, `PhotoIntegrityError`, `MedicalProcedureNotFoundError`). **Reste :** `GET /photos/{mediaId}` n'entoure pas l'appel S3, une indisponibilité MinIO remonte en 500 générique au lieu d'un 503 · sans `DATABASE_URL`, l'application démarre en mode dégradé sur des dépôts en mémoire avec un simple `warn` |

## Mobile - OWASP Mobile Top 10

> ⚠️ Vérifier la version en cours sur
> https://owasp.org/www-project-mobile-top-10/ avant tout usage en livrable.

> **Presque rien à évaluer à ce jour.** `apps/mobile/src` ne contient que
> l'internationalisation (`i18n/`) : aucun écran, aucun stockage, aucun appel
> réseau. Les features MOB-01 à MOB-07 de `.ai/features.md` ne sont pas
> démarrées. Cette table se remplira avec elles.

| # | Point | État | Où c'est traité |
|---|---|---|---|
| M1 | Usage impropre des identifiants | à faire | |
| M2 | Sécurité insuffisante de la chaîne d'approvisionnement | partiel | Dependabot surveille le `bun.lock` racine, qui couvre `apps/mobile` (`.github/dependabot.yml`) · majeures d'`expo`, `expo-*` et `react-native` retenues volontairement, une montée de SDK devant passer par `expo install --fix` puis `npx expo-doctor`. **Reste :** aucune vérification propre au binaire mobile |
| M3 | Authentification / autorisation non sécurisées | à faire | |
| M4 | Validation d'entrée/sortie insuffisante | à faire | |
| M5 | Communication non sécurisée | à faire | |
| M6 | Contrôles de confidentialité insuffisants | à faire | |
| M7 | Protection insuffisante du binaire | à faire | |
| M8 | Mauvaise configuration de sécurité | à faire | |
| M9 | Stockage de données non sécurisé | à faire | |
| M10 | Cryptographie insuffisante | à faire | |

---

## Notes

<!-- Exceptions assumées, points à revoir avant prod -->

### Écart entre code publié et instance servie

Le conteneur backend monte `apps/backend/src` depuis l'arbre de travail, pas
depuis `origin/dev`. Un arbre en retard de plusieurs commits sert donc du code
antérieur aux correctifs déjà mergés, **sans qu'aucune trace ne le signale** :
le backend ne journalise pas le SHA qu'il exécute.

Le 2026-09-02, plusieurs sessions de travail ont audité l'instance en croyant
auditer le code et conclu à des failles corrigées depuis. Une première version
de ce document classait ainsi A01 en `partiel` en affirmant que `GET /alerts` et
les routes d'émission de code n'avaient aucun gardien : c'était vrai de
l'instance, faux du code, `SEC-04` (`efadbe7`) les ayant bouchés.

Deux conséquences, l'une pour la lecture, l'autre pour le code :

- Ce document décrit le code publié. Toute vérification passe par
  `git show origin/dev:<fichier>` ou par un worktree créé depuis `origin/dev` —
  jamais par une requête vers une instance, et jamais par un arbre local dont on
  n'a pas vérifié le retard avec `git rev-list --count HEAD..origin/dev`.
- Faire journaliser au backend, au démarrage, le SHA qu'il sert rendrait la
  méprise impossible. Quelques lignes dans `index.ts`, à côté du
  `logger.info({ port }, 'Backend démarré')` existant.

### Exceptions assumées

- **Pas de rattachement patient ↔ médecin.** L'équipe de Toulouse suit
  collectivement les mêmes patients. Tout médecin authentifié voit tous les
  dossiers, volontairement (SEC-01). Si plusieurs équipes distinctes doivent un
  jour partager la plateforme sans se voir, prévoir une table de liaison
  `patient_physician` à ce moment-là, pas avant.
- **Token patient valide un an.** Contrainte de l'offline-first
  ([ADR 0002](../adr/0002-construire-l-application-mobile-en-offline-first.md)) :
  un patient peut rester des semaines sans réseau. La durée est compensée par la
  relecture du code porteur à chaque requête (A07), pas réduite
  ([ADR 0020](../adr/0020-fixer-la-session-medecin-a-2h-d-inactivite-et-le-token-patient-a-un-an.md)).
- **Quatre routes publiques.** `POST /auth/patient/validate` (on ne peut pas
  exiger une session pour en ouvrir une), `GET /health`, `GET /docs` et
  `GET /openapi.json`. La liste est déclarée dans
  `apps/backend/tests/routesProtegees.test.ts` : toute route ajoutée sans
  gardien et sans y figurer fait échouer la suite.

### À revoir avant prod

- **La garde d'enrôlement existe sur le dashboard et manque sur les deux pages
  patient.** Depuis qu'AUTH-02 exige le second facteur, un médecin non enrôlé
  reçoit `403 MFA_REQUIRED` sur toutes les routes de données. Le parcours
  nominal le prend en charge : `DashboardPage.tsx` teste
  `session.user.twoFactorEnabled` et redirige vers `/[locale]/mfa/setup`, si
  bien qu'un compte fraîchement inscrit arrive bien sur l'enrôlement.
  `PatientManagementPage.tsx` et `PatientHistoryPage.tsx` ne testent en revanche
  que la présence de session (`!sessionPending && !session` → `/login`) : un
  médecin non enrôlé qui ouvre directement `/[locale]/patients` ou une fiche
  patient obtient une page rendue dont tous les appels renvoient 403, sans
  jamais être orienté vers l'enrôlement. Trois lignes à recopier depuis
  `DashboardPage.tsx`, pas un défaut d'architecture.
  Le fond reste néanmoins vrai et déborde ces deux pages : **le serveur
  distingue 401 et 403, le client non.** Aucun hook ne lit ce statut —
  `useDashboard` lève `PATIENTS_FETCH_FAILED` et `ALERTS_FETCH_FAILED` sur un
  simple `!res.ok`, `usePatientHistory` ne distingue que le 404, aucun ne lit le
  corps de la réponse. Toute cause future de 403 produira donc le même message
  d'échec indifférencié, quelle que soit la garde posée en amont.
- **`/openapi.json` public et muet sur l'authentification.** La route est servie
  sans condition sur `NODE_ENV`, contrairement à `/docs`, et ne déclare aucun
  schéma de sécurité : le document publié présente des chemins protégés comme
  ouverts. Les gardes existent, c'est leur documentation qui ment.
- **Limitation de tentatives en mémoire.** `ipFailures` dans `authRouter.ts` et
  `rateLimitStores` dans `rateLimiter.ts` sont des `Map` de processus : le
  compteur repart à zéro à chaque redémarrage et n'est pas partagé entre
  instances. Suffisant en mono-instance, à déplacer côté base ou cache si le
  backend est répliqué.
- **Rétention des logs d'audit.** Un an est exigé par l'HDS et documenté dans
  AUDIT-01, mais rien ne l'applique : l'export S3 dépose les objets sans règle
  de cycle de vie sur le bucket.
- **Chiffrement backend → stockage d'objets.** `S3_USE_SSL` et `MINIO_USE_SSL`
  valent `false` par défaut. Caddy ne couvre pas ce trajet : à poser
  explicitement en production, sous peine de faire transiter les photos en clair
  entre le backend et OVH Object Storage.
