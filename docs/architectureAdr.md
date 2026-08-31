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
| A01 — Broken Access Control | ✅ Corrigé | Aucune authentification n'était exigée sur `patientRouter`/`photosRouter`/`exportsRouter`/`sync`/`instructions` — n'importe qui pouvait lire, modifier ou écrire des données au nom de n'importe quel patient (IDOR confirmé). Corrigé en deux temps : session médecin obligatoire côté dashboard (SEC-01), JWT patient vérifié côté mobile (SEC-02) |
| A02 — Cryptographic Failures | Conforme | TLS 1.3, SQLCipher AES-256 mobile, stockage HDS — non revérifié techniquement lors de cet audit |
| A03 — Injection | Conforme | Drizzle ORM (requêtes paramétrées) + validation Zod systématique — aucune requête SQL brute rencontrée dans le code lu |
| A04 — Insecure Design | Conforme | Clean Architecture + DDD, règles métier isolées et testables |
| A05 — Security Misconfiguration | Conforme | Biome + CodeRabbit bloquants, protection de branche vérifiée en pratique (impossible de merger sans les 4 checks CI) |
| A06 — Vulnerable and Outdated Components | ✅ Corrigé | Aucun outil de suivi des dépendances vulnérables n'existait. `.github/dependabot.yml` ajouté (bun, docker, github-actions, scan hebdomadaire) |
| A07 — Identification and Authentication Failures | ✅ Corrigé | JWT patient (1 an, compromis assumé offline-first) et session médecin (2h) conformes, rate limiting (3 tentatives/15 min) confirmé exact. Point corrigé : le JWT patient était signé mais jamais vérifié côté serveur — `TokenProvider.verify()` implémenté et testé (secret invalide, expiration, malformation, mauvais rôle) |
| A08 — Software and Data Integrity Failures | Conforme | Checksum SHA-256 sur l'upload photo, vérifié en pratique (rejet réel d'un checksum invalide en test). CI bloquante avant merge |
| A09 — Security Logging and Monitoring Failures | Conforme | Middleware d'audit sur chaque requête, tentatives d'authentification échouées loguées |
| A10 — Server-Side Request Forgery | Non applicable | Aucun appel sortant construit à partir d'une entrée utilisateur — les appels S3/MinIO pointent vers un endpoint fixé côté serveur |

**Décision de modèle d'accès associée** : les chirurgiens de Toulouse forment une équipe soignante unique qui suit collectivement les mêmes patients — ce n'est pas une patientèle privée par médecin. Le correctif A01 côté dashboard est donc une authentification obligatoire (401), volontairement sans rattachement patient↔médecin ni contrôle d'appartenance (403). Si plusieurs équipes distinctes doivent un jour partager la plateforme sans se voir, prévoir une table de liaison `patient_physician` (many-to-many) à ce moment-là — pas avant (YAGNI).

---

## Accessibilité

> Compétence **C2.2.3** — critères 2 (référentiel choisi et justifié) et 3 (conformité mesurée).
> À rapprocher du critère 1 (OWASP Top 10), traité dans la section [Sécurité](#sécurité) ci-dessus.

### Référentiel choisi : WCAG 2.2, niveau AA

| Choix | Justification |
|---|---|
| **WCAG plutôt qu'un référentiel national** | Le projet est déployé au **Cambodge**, qui n'a pas de cadre légal d'accessibilité numérique national. WCAG est la norme **internationale** du W3C, indépendante de toute juridiction — c'est précisément parce qu'elle n'est liée à aucun pays qu'elle s'applique ici. (Un référentiel national comme le RGAA français n'aurait aucune portée au Cambodge.) |
| **Version 2.2** (et non 2.1) | Version stable la plus récente (W3C, octobre 2023). Elle ajoute des critères pertinents pour une application **mobile** : 2.4.11 *Focus non masqué*, 2.5.7 *Mouvements de glissement*, 2.5.8 *Taille de la cible (minimum)*. |
| **Niveau AA** (et non A ou AAA) | AA est le niveau de référence reconnu internationalement et atteignable en pratique. AAA impose des contraintes disproportionnées pour ce produit (ex : contraste 7:1, alternative en langue des signes). |

### Pourquoi l'accessibilité est centrale ici, pas optionnelle

L'application patient s'adresse à des Cambodgiens en suivi post-opératoire, dont une partie
a une **faible littératie**. L'interface patient est **pictographique et bilingue
(français / khmer)** par conception : l'accessibilité n'est pas une couche ajoutée en fin de
projet mais le fondement même de l'utilisabilité du produit.

| Type de handicap / besoin | Critère WCAG 2.2 concerné | Réponse dans le produit |
|---|---|---|
| Faible littératie / cognitif | 3.1 Lisibilité · 1.1.1 Contenu non textuel | Pictogrammes standardisés (voir MED-01), langage simplifié, bilingue FR/Khmer |
| Déficience visuelle (basse vision) | 1.4.3 Contraste minimum (AA) · 1.4.4 Redimensionnement du texte | Contrastes mesurés (voir ci-dessous), texte redimensionnable |
| Daltonisme | 1.4.1 Utilisation de la couleur | L'information critique (alertes médicales) n'est **jamais** portée par la seule couleur — toujours doublée d'un pictogramme ou d'un texte |
| Motricité fine réduite (usage mobile) | 2.5.8 Taille de la cible (AA, nouveau en 2.2) | Cibles tactiles dimensionnées pour le mobile |

### Périmètre et méthode de vérification

| Surface | Technologie | Vérification |
|---|---|---|
| Dashboard médecin | Next.js (web) | **Audit automatisé axe-core** + mesure de contrastes |
| Application patient | Expo / React Native (Android) | Accessibilité pictographique par conception ; test lecteur d'écran **TalkBack** manuel (non automatisable) |

> Honnêteté méthodologique : l'audit automatisé couvre le dashboard web. Le test au lecteur
> d'écran mobile relève d'une vérification manuelle sur device réel, documentée séparément.

### Conformité mesurée (critère 3)

Pour **prouver** la conformité du prototype — et non l'affirmer — la démarche suivie est
**mesurer → corriger → re-mesurer**.
Un audit automatisé a été réalisé sur les trois pages clés du dashboard ; chaque violation
détectée a été corrigée dans le code, puis une seconde mesure a validé la correction. Les
tableaux ci-dessous présentent, dans l'ordre, l'état initial mesuré, les violations trouvées,
les corrections apportées et l'état final re-mesuré.

- **Méthode** : audit **Lighthouse** (catégorie Accessibilité, propulsée par axe-core) exécuté sur Chrome headless, sur les pages clés du dashboard. Chaque violation est mappée au critère WCAG 2.2 exact. Mesures reproductibles via `bunx lighthouse <url> --only-categories=accessibility`.
- **Date de l'audit** : 2026-07-23 · outil : Lighthouse 12.2.1 / axe-core 4.10.

#### Scores par page (avant correction)

| Page | Score accessibilité | Violations |
|---|---|---|
| `/fr/patients` (liste) | **100 / 100** | aucune |
| `/fr/dashboard` | 95 / 100 | 1 (contraste) |
| `/fr/login` | 92 / 100 | 3 (2 contraste, 1 taille de cible) |

#### Violations détectées

| Page | Critère WCAG 2.2 | Élément | Mesure | Attendu |
|---|---|---|---|---|
| login | 1.4.3 Contraste (AA) | Bouton de connexion (texte blanc sur `#2EAC8E`) | 2.83:1 | ≥ 4.5:1 |
| login | 1.4.3 Contraste (AA) | Texte d'aide `text-gray-400` (`#9ca3af` sur blanc) | 2.53:1 | ≥ 4.5:1 |
| login | 2.5.8 Taille de la cible (AA, **nouveau en 2.2**) | Bouton « afficher le mot de passe » | 20×20 px | ≥ 24×24 px |
| dashboard | 1.4.3 Contraste (AA) | Libellé `text-gray-400` (`#9ca3af` sur blanc) | 2.53:1 | ≥ 4.5:1 |

> Le critère **2.5.8** (taille de cible) est un ajout de WCAG 2.2 : sa détection confirme
> l'intérêt d'avoir choisi la 2.2 plutôt que la 2.1.

#### Corrections apportées

| Violation | Correction | Résultat mesuré |
|---|---|---|
| Contraste bouton (blanc sur `#2EAC8E`, 2.83:1) | Vert de marque assombri en `#178064` (remplacé sur les 17 occurrences en dur) | **4.87:1** ✅ |
| Contraste texte `text-gray-400` (2.53:1) | Passé en `text-gray-500` (`#6b7280`) | **4.87:1** ✅ |
| Taille de cible bouton mot de passe (20×20 px) | Agrandi à 28×28 px (`h-7 w-7` + centrage flex) | **28×28 px** ✅ |

#### Résultat après correction

| Page | Score avant | Score après |
|---|---|---|
| `/fr/patients` | 100 / 100 | 100 / 100 |
| `/fr/dashboard` | 95 / 100 | **100 / 100** ✅ |
| `/fr/login` | 92 / 100 | **100 / 100** ✅ |

Les trois pages du dashboard atteignent **100/100** sur la catégorie Accessibilité de
Lighthouse, sans aucune violation WCAG 2.2 A/AA détectée.

> Réserve honnête : Lighthouse/axe couvre les vérifications **automatisables** (~40 % des
> critères WCAG). Les critères non automatisables (ordre de tabulation logique, pertinence
> des textes alternatifs, navigation complète au lecteur d'écran) relèvent d'une vérification
> manuelle et ne sont pas couverts par ce score. Le test mobile TalkBack reste également à
> réaliser sur device réel.

### Cibles tactiles sur mobile — standard 48×48 dp

Deux normes coexistent selon la surface, et il ne faut pas les confondre :

| Surface | Norme | Cible minimale |
|---|---|---|
| Dashboard web | WCAG 2.5.8 (AA) | 24 × 24 CSS px |
| Application mobile (Android) | Material Design / bonnes pratiques Android | **48 × 48 dp** |

Le `dp` (*density-independent pixel*) est l'unité Android ; 48 dp est le seuil de confort
tactile recommandé, plus strict que le minimum WCAG web. **Règle de code établie** : toute
cible tactile de l'app mobile (`Pressable`, `TouchableOpacity`, boutons, icônes cliquables)
doit mesurer **au moins 48 × 48 dp** de zone cliquable — au besoin via `hitSlop` ou du
padding, sans réduire la zone visible. Règle reportée dans `CLAUDE.md` (section Règles mobile).

> État actuel : l'app mobile ne contient pas encore d'UI interactive (seule la logique i18n
> est implémentée). Il n'y a donc aucune cible tactile à auditer aujourd'hui — la règle
> 48 × 48 dp est **définie en amont** pour être respectée dès le premier composant tactile.
> Affirmer une conformité mesurée sur une UI inexistante n'aurait aucune valeur de preuve.

### Synthèse — preuve de conformité au référentiel (critère 3)

| Exigence du référentiel | Surface | Méthode de preuve | Statut |
|---|---|---|---|
| Contraste texte/fond ≥ 4.5:1 (WCAG 1.4.3 AA) | Dashboard web | Mesure Lighthouse/axe, avant/après | ✅ **Vérifié conforme** (100/100) |
| Taille de cible ≥ 24 px (WCAG 2.5.8 AA) | Dashboard web | Mesure Lighthouse + inspection code | ✅ **Vérifié conforme** (28×28 px) |
| Absence de violation WCAG 2.2 A/AA automatisable | Dashboard web | Audit Lighthouse (login, dashboard, patients) | ✅ **Vérifié conforme** (3 pages à 100/100) |
| Taille de cible tactile ≥ 48 dp (Material) | App mobile | Règle de code établie ([CLAUDE.md](../CLAUDE.md)) | 🟡 **Standard défini** — UI mobile pas encore développée |
| Navigation au lecteur d'écran (TalkBack) | App mobile | Test manuel sur device réel | 🟡 **À réaliser** — nécessite UI mobile + device |
| Critères WCAG non automatisables (tabulation, alt, structure) | Dashboard web | Revue manuelle | 🟡 **À compléter** — hors périmètre de l'audit automatisé |

**Lecture de la preuve** : le prototype **implémenté et auditable** (le dashboard web) répond
aux exigences du référentiel WCAG 2.2 AA sur l'ensemble des critères automatiquement
vérifiables — mesuré, corrigé, re-mesuré. Les lignes en 🟡 ne sont pas des non-conformités du
prototype existant mais des exigences **dont le périmètre (mobile, manuel) n'est pas encore
implémenté ou automatisable** ; le standard applicable y est défini par avance.

### Conclusion

Le prototype implémenté et auditable répond aux exigences du référentiel WCAG 2.2 AA sur
l'ensemble des critères automatiquement vérifiables, avec une démarche mesurée, corrigée et
re-mesurée, appuyée sur des rapports archivés. Les exigences restantes (application mobile,
tests manuels au lecteur d'écran) ne constituent pas des non-conformités du prototype
existant, mais des vérifications dont le périmètre n'est pas encore implémenté — et pour
lesquelles le standard applicable (48 × 48 dp sur mobile, revue manuelle des critères non
automatisables) est défini par avance dans les conventions de code du projet.

Ces contraintes ont guidé les choix d'architecture (polling vs WebSocket, SQLite vs autre, etc.) :

- 200 patients actifs simultanés max
- 20 utilisateurs web simultanés max
- APK Android < 30 Mo
- Cache SQLite mobile : 50 Mo max par appareil
- Photos : max 50 par patient, JPEG qualité 80%, < 2 Mo
