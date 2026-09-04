# Architecture - les six piliers

Créé le 2026-08-31 · Dernière revue : 2026-09-04

> Une réponse par pilier. « Non applicable » et « à décider » sont des
> réponses valides - à condition d'être écrites, avec leur motif. Un pilier
> écarté pour une raison explicite est un pilier traité ; un pilier vide, non.

Les chiffres viennent de [`cdc.md`](cdc.md), les mécanismes de
[`architecture-systeme.md`](architecture-systeme.md), les décisions de
[`adr/`](adr/README.md). Ce fichier ne les redit pas : il les relie à l'exigence
qu'ils servent.

---

## 1. Fiabilité

*Combien de temps l'appli a-t-elle le droit d'être indisponible ?
Que se passe-t-il quand une dépendance externe tombe ?
Comment on restaure, et depuis quoi ?*

- **Exigence** (chiffrée) : disponibilité 99,5 % sur le mobile, 99,9 % sur le
  dashboard web. RTO 4 h sur les données patient, RPO 24 h, RTO dégradé 30 min
  pour un dashboard en lecture seule ([`cdc.md`](cdc.md) §10).

- **Comment on y répond** (mécanisme + où dans le code) :
  - Le mobile ne dépend pas du réseau pour fonctionner : offline-first, toute
    donnée est écrite en SQLite puis empilée dans `sync_queue`
    ([ADR 0002](adr/0002-construire-l-application-mobile-en-offline-first.md)).
    C'est ce qui autorise un SLA mobile plus bas que celui du web — une coupure
    serveur n'interrompt pas la saisie.
  - Conflits de synchronisation résolus en server-wins, sans arbitrage manuel
    ([ADR 0003](adr/0003-resoudre-les-conflits-de-synchronisation-en-server-wins.md)).
  - Réseau dégradé : compatible EDGE/2G à 64 kbps, timeout 30 s, retry en
    backoff exponentiel 1-2-4-8 s puis abandon à 15 s ([`cdc.md`](cdc.md) §5).
  - Restauration : snapshot PostgreSQL quotidien chiffré AES-256 sur OVH Object
    Storage, rétention 30 jours, test de restauration mensuel automatisé. MinIO
    en réplication synchrone Strasbourg ↔ Roubaix avec bascule automatique.
  - Dashboard en mode dégradé : lecture seule via service worker, bannière
    horodatée, écritures désactivées.
  - Aucun changement de schéma n'est déployé pendant une mission active ; le
    backend accepte les schémas `N` et `N-1`.
  - `healthcheck` exposé par le backend (`apps/backend/src/index.ts`) et
    consommé par Docker Compose.

- **Ce qu'on ne fait pas** :
  - Pas de haute disponibilité PostgreSQL — ni réplica en lecture, ni bascule
    automatique. Un RTO de 4 h se tient avec une restauration depuis snapshot ;
    un cluster coûterait de l'exploitation pour un gain que l'exigence ne
    réclame pas.
  - Pas de multi-région active/active.
  - Pas de WebSocket, donc pas de reconnexion persistante à maintenir
    ([ADR 0012](adr/0012-rafraichir-les-alertes-par-polling-plutot-que-par-websockets.md)).

---

## 2. Sécurité

*Qui a le droit de faire quoi ? Où sont les données sensibles ?
Quelles contraintes réglementaires s'appliquent ?*

- **Exigence** : hébergement HDS certifié obligatoire, droit français, serveurs
  UE uniquement. RGPD : consentement explicite, portabilité, notification CNIL
  sous 72 h. Conservation 10 ans pour les données médicales (obligation légale),
  1 an pour les logs d'audit, 3 mois pour les logs techniques. Audit de sécurité
  annuel par un organisme certifié ([`cdc.md`](cdc.md) §6).

- **Comment on y répond** :
  - Hébergement OVH Cloud certifié HDS. Le risque CLOUD Act est réduit sans être
    nul ; les mitigations retenues — juridiction française, DPA, chiffrement au
    repos et en transit — sont écrites dans [`cdc.md`](cdc.md) plutôt que
    supposées.
  - Transit en TLS 1.3 terminé par Caddy
    ([ADR 0009](adr/0009-utiliser-caddy-comme-reverse-proxy.md)).
  - Médecins : MFA TOTP obligatoire, session coupée après 2 h d'inactivité — les
    postes sont partagés en milieu hospitalier
    ([ADR 0020](adr/0020-fixer-la-session-medecin-a-2h-d-inactivite-et-le-token-patient-a-un-an.md)).
  - Patients : code à 6 chiffres, JWT signé HMAC-SHA256, révocation par retrait
    du code porteur
    ([ADR 0023](adr/0023-couper-une-session-patient-en-revoquant-le-code-porteur.md)).
  - 3 tentatives échouées par IP et par tranche de 15 minutes
    ([ADR 0021](adr/0021-limiter-les-tentatives-d-authentification-a-3-par-15-minutes-et-par-ip.md)).
  - Rotation des secrets de production tous les 90 jours
    ([ADR 0022](adr/0022-faire-tourner-les-secrets-de-production-tous-les-90-jours.md)).
  - Stockage local chiffré AES-256-GCM via `expo-secure-store` ; intégrité des
    photos par checksum SHA-256 calculé sur le mobile et revérifié côté backend.
  - Droit à l'effacement traité par anonymisation, pour ne pas détruire la donnée
    médicale que la loi impose de conserver
    ([ADR 0018](adr/0018-anonymiser-les-patients-plutot-que-supprimer-leurs-donnees-medicales.md)).
  - Traçabilité : chaque accès aux données médicales est journalisé via Pino
    ([ADR 0013](adr/0013-utiliser-pino-comme-logger-backend.md)) et exporté
    quotidiennement vers un bucket `logs-audit` dédié
    ([ADR 0014](adr/0014-exporter-les-logs-d-audit-vers-s3-par-un-cron-journalier.md)).
    Les logs ne portent jamais de PII, seulement un `patientId`.

- **Ce qu'on ne fait pas** :
  - Pas de chiffrement au niveau colonne dans PostgreSQL. Le chiffrement disque
    d'OVH HDS suffit à la conformité ; le chiffrement colonne ajouterait une
    complexité réelle pour un gain de conformité nul.
  - Pas de chiffrement au repos en développement — la contrainte porte sur la
    production.
  - Pas de rattachement patient ↔ médecin : l'équipe soignante est traitée comme
    un ensemble unique, sans patientèle privée. C'est une exception assumée,
    documentée comme telle dans [`security/owasp.md`](security/owasp.md).

> Détail des dix points de référence : voir `security/owasp.md`.

---

## 3. Excellence opérationnelle

*Comment je saurai que ça casse en prod, et en combien de temps ?
Comment on déploie, et comment on revient en arrière ?
Qui reprend ce code dans six mois, et qu'est-ce qui va le bloquer ?*

- **Exigence** : incident critique résolu en 4 h, incident mineur en 24 h
  ([`cdc.md`](cdc.md) §6). Un contributeur qui arrive doit pouvoir démarrer sans
  solliciter l'auteur.

- **Comment on y répond** :
  - Déploiement reproductible par Docker Compose : quatre services en production
    — Caddy, backend Hono, PostgreSQL, MinIO. pgAdmin n'existe qu'en profil `dev`
    et n'est jamais déployé.
  - CI GitHub Actions : lint, tests et contrôle du CHANGELOG à chaque PR. Les
    workflows s'authentifient par une GitHub App plutôt que par un jeton
    personnel
    ([ADR 0008](adr/0008-authentifier-les-workflows-github-actions-par-une-github-app.md)).
  - Retour arrière : migrations additives uniquement — colonnes nullable, jamais
    de suppression — donc un schéma `N` reste lisible par un backend `N-1`.
  - Gel des déploiements de schéma pendant une mission active, via le flag
    `mission_active`.
  - Reprise du code : 23 ADR consignent chaque décision avec son contexte et ses
    conséquences ([`adr/README.md`](adr/README.md)), un
    [`onboarding.md`](onboarding.md) décrit le démarrage à froid, un
    [`lexique.md`](lexique.md) fixe le vocabulaire métier.
  - Documentation OpenAPI générée depuis le code plutôt qu'écrite à côté
    ([ADR 0010](adr/0010-generer-la-documentation-openapi-avec-hono-zod-openapi.md)),
    ce qui la rend fausse difficilement.

- **Ce qu'on ne fait pas** :
  - Pas d'APM ni de tracing distribué. Quatre services sur un seul hôte se
    diagnostiquent avec des logs.
  - Pas de déploiement continu vers la production : `master` ne reçoit que des
    merges humains.
  - **À décider** : la supervision. Aucun seuil d'alerte, aucun canal de
    notification et aucune astreinte ne sont définis à ce jour, alors que
    l'exigence affiche 4 h de résolution sur incident critique. En l'état, la
    détection repose sur un signalement utilisateur — ce qui rend le délai de 4 h
    invérifiable. C'est le principal écart de ce document.

---

## 4. Efficacité des performances

*Combien d'utilisateurs et de données au lancement ? Dans un an ?
Quel temps de réponse acceptable, et sur quel parcours ?
Qu'est-ce qui casse en premier quand ça monte ?*

- **Exigence** : 200 patients actifs simultanés au maximum, 20 postes web
  simultanés, base PostgreSQL estimée à 10 Go en année 1. API web sous 500 ms au
  95e percentile, lancement mobile sous 3 s au 95e, upload d'une photo de 2 Mo
  sous 10 s, synchronisation complète de 50 Mo sous 2 min. APK sous 30 Mo, cache
  mobile plafonné à 50 Mo par appareil ([`cdc.md`](cdc.md) §5).

- **Comment on y répond** :
  - Rafraîchissement des alertes par polling plutôt que par WebSocket : à
    20 postes, le polling coûte moins cher à exploiter qu'un canal persistant
    ([ADR 0012](adr/0012-rafraichir-les-alertes-par-polling-plutot-que-par-websockets.md)).
    Le dimensionnement est la justification de la décision, pas un effet de bord.
  - Photos compressées en JPEG qualité 80 %, plafonnées à 2 Mo et 50 par
    patient ; gzip sur le transport.
  - Purge du cache mobile : 90 jours pour les données patient, 30 jours pour les
    photos.
  - Unicité garantie par index fonctionnels en minuscules
    ([ADR 0016](adr/0016-garantir-l-unicite-des-emails-et-des-codes-par-un-index-fonctionnel-en-minuscules.md))
    et index partiels sur les codes patient
    ([ADR 0019](adr/0019-restreindre-l-unicite-des-codes-patient-par-des-index-partiels.md)) —
    la contrainte est tenue par la base, pas par du code applicatif.
  - Dates en `timestamptz` sans exception
    ([ADR 0015](adr/0015-stocker-toutes-les-dates-en-timestamptz.md)), ce qui
    évite les conversions à la lecture.

- **Ce qu'on ne fait pas** :
  - Pas de cache applicatif type Redis, pas de CDN. À 20 postes, les deux
    ajouteraient une dépendance à exploiter sans réduire un temps de réponse déjà
    tenu.
  - Pas d'autoscaling : les volumes sont plafonnés par le métier, pas subis.
  - **Ce qui casse en premier** : le polling. Il est dimensionné pour 20 postes
    web ; c'est le premier mécanisme à revoir si ce nombre change d'ordre de
    grandeur, avant la base ou le stockage.

---

## 5. Optimisation des coûts

*Combien ça coûte par mois ? Qu'est-ce qui fait exploser la facture ?
Quel est le budget, et qui le valide ?*

- **Exigence** : **à décider.** Aucun budget mensuel n'est fixé dans le CDC et
  aucun validateur n'est désigné. L'absence est ici un manque, pas un choix : le
  projet dépend d'un hébergement HDS dont le coût est structurellement supérieur
  à celui d'un hébergement générique, et personne n'a écrit ce qu'il est
  acceptable de dépenser.

- **Comment on y répond** :
  - Ce qui détermine la facture est identifié, à défaut d'être chiffré :
    l'hébergement OVH HDS, qui est une contrainte légale et non un choix
    négociable ; le stockage S3 des photos, borné par 50 photos de 2 Mo par
    patient ; la rétention MinIO de 10 ans doublée par la réplication sur deux
    sites ; les snapshots PostgreSQL sur 30 jours.
  - pgAdmin est exclu de la production, ce qui évite de payer un service
    d'administration en continu.
  - Le plafonnement métier — 200 patients, 20 postes — rend la facture
    prévisible plutôt que proportionnelle à un usage inconnu.

- **Ce qu'on ne fait pas** :
  - Pas de FinOps, pas d'alerte de dépassement, pas de suivi de consommation.
    Cohérent avec l'absence de budget : on ne surveille pas un seuil qui n'existe
    pas. Ce point est à reprendre en même temps que l'exigence.

---

## 6. Sobriété

*Qu'est-ce qui tourne alors que personne ne s'en sert ?
Quelles données on garde, et pendant combien de temps ?
Y a-t-il une contrainte d'écoconception - référentiel, marché public,
engagement RSE - ou bien on écrit qu'il n'y en a pas ?*

- **Exigence** : **il n'y en a pas.** Aucun référentiel d'écoconception (RGESN
  ou autre), aucun marché public, aucun engagement RSE ne s'applique au projet.
  C'est un constat vérifié dans le CDC, pas un oubli — et il est écrit pour que
  la question ne soit pas reposée à chaque revue.

- **Comment on y répond** : les choix faits pour d'autres raisons servent aussi
  celle-ci, et c'est le seul niveau d'engagement revendiqué.
  - L'offline-first supprime les allers-retours réseau : le mobile synchronise
    par lots plutôt qu'à chaque geste.
  - Le polling évite de maintenir 20 connexions persistantes ouvertes en
    permanence, dont la plupart pour rien.
  - Les photos sont compressées à la source et plafonnées, plutôt que stockées
    telles quelles.
  - Le cache mobile se purge seul — 90 jours pour les données, 30 pour les
    photos — au lieu de croître sans fin.
  - pgAdmin ne tourne qu'en développement.

- **Ce qu'on ne fait pas** :
  - Aucune mesure : ni empreinte carbone, ni consommation, ni indicateur suivi
    dans le temps. Sans référentiel imposé, la mesure serait déclarative.
  - La rétention de 10 ans sur les données médicales et sur MinIO n'est pas
    négociable : elle est imposée par la loi, pas par l'architecture. Elle sort
    du périmètre de ce pilier.
