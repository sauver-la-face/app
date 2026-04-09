# Fonctionnalités à implémenter — Sauver la Face

> Statuts : `[ ]` à faire · `[~]` en cours · `[x]` terminé

---

## BACKEND

### AUTH-01 — Authentification patients (codes 6 chiffres)

`[ ]` `apps/backend/src/features/auth/`

**Comportement attendu :**

- Génération d'un code numérique 6 chiffres unique par patient
- Soft delete automatique après 48h si le code n'est pas utilisé (job cron)
- Une fois utilisé (`used_at NOT NULL`), le code est valide pour toujours
- Renouvellement uniquement par un médecin

**Règles de code :**

- La logique de validation du code va dans `auth.service.ts` uniquement
- Le cron de soft delete est un service séparé `auth.cron.ts`
- Tester : génération, expiration 48h, soft delete, renouvellement, tentative sur code supprimé

---

### AUTH-02 — Authentification médecins (MFA TOTP)

`[ ]` `apps/backend/src/features/auth/`

**Comportement attendu :**

- MFA TOTP obligatoire via Better Auth
- Session timeout 2h d'inactivité
- Tokens JWT signés HMAC-SHA256, renouvellement silencieux

**Règles de code :**

- Utiliser Better Auth sans couche custom — ne pas réinventer la gestion de session
- Tester : login sans MFA rejeté, session expirée rejetée, refresh silencieux

---

### SYNC-01 — Réception et résolution des conflits (server-wins)

`[ ]` `apps/backend/src/features/sync/`

**Comportement attendu :**

- Réception du payload offline du mobile
- Résolution des conflits : le serveur a toujours raison
- Versioning de schéma : accepte `N` et `N-1`, rejette `> N` avec `APP_UPDATE_REQUIRED`
- Log du delta en cas de conflit

**Règles de code :**

- La logique server-wins va dans `sync.service.ts`
- Ne jamais écraser un enregistrement sans logger le conflit
- Tester : payload normal, conflit server-wins, version schéma incompatible

---

### ALERT-01 — Système d'alertes automatiques

`[ ]` `apps/backend/src/features/alerts/`

**Comportement attendu :**

- Alerte si `severity > 7` sur un `medical_event`
- Alerte si saignement présent
- Alerte si aucune synchronisation depuis 7 jours

**Règles de code :**

- Les seuils sont des constantes nommées dans `alerts.service.ts` (pas de magic numbers)
- Tester : chaque seuil individuellement, pas d'alerte en dessous du seuil

---

### PHOTO-01 — Stockage et validation des photos

`[ ]` · `apps/backend/src/features/photos/`

**Comportement attendu :**

- Réception de la photo uploadée par le mobile
- Validation checksum SHA-256 (comparé à celui envoyé par le mobile)
- Stockage dans MinIO HDS
- Rejet `PHOTO_INTEGRITY_ERROR` si mismatch checksum
- Retry côté mobile : backoff 2s, 4s, abandon à la 4e tentative

**Règles de code :**

- La validation checksum se fait dans `photos.service.ts` avant tout stockage
- Le client MinIO est dans `apps/backend/src/shared/storage/`

---

### EXPORT-01 — Export PDF / CSV RGPD

`[ ]` `apps/backend/src/features/exports/`

**Comportement attendu :**

- Export PDF rapport complet d'un patient
- Export CSV données anonymisées (RGPD)
- Droit portabilité : export JSON données brutes patient

**Règles de code :**

- La génération des fichiers va dans `exports.service.ts`
- Les données anonymisées : supprimer `first_name`, `last_name`, `birthdate` du CSV
- Tester : structure du PDF, anonymisation CSV, format JSON portabilité

---

### PATIENT-01 — CRUD patients et gestion utilisateurs

`[ ]` · `apps/backend/src/features/patients/`

**Comportement attendu :**

- Création / lecture / mise à jour d'un patient
- Attribution d'un code d'accès à un patient (déclenche AUTH-01)
- Liste des patients avec statut de synchronisation

**Règles de code :**

- Toutes les requêtes SQL via `patients.repository.ts` (Drizzle uniquement, pas de SQL brut)
- Les types viennent de `@sauver-la-face/shared`

---

### INSTRUCTION-01 — Envoi d'instructions médicales

`[ ]` · `apps/backend/src/features/instructions/`

**Comportement attendu :**

- Création d'une instruction pictographique par un médecin pour un patient
- Suivi de la lecture via `acknowledged_at`
- Notification dashboard quand instruction lue

**Règles de code :**

- `acknowledged_at` est mis à jour uniquement par le mobile lors de la lecture
- Le médecin ne peut pas modifier `acknowledged_at`

---

## DASHBOARD WEB

### WEB-01 — Tableau de bord médecin

`[ ]` · `apps/web/src/app/dashboard/`

**Comportement attendu :**

- Liste des patients avec statut (alerte / ok / hors-ligne)
- Alertes critiques en haut de page
- Polling toutes les 30s via `refetchInterval` TanStack Query

**Règles de code :**

- Les appels API dans des hooks TanStack Query dans `apps/web/src/hooks/`
- Pas de `fetch` direct dans les composants
- Pas de `BETTER_AUTH_SECRET` côté web — auth déléguée au backend

---

### WEB-02 — Visualisation chronologique patient

`[ ]` · `apps/web/src/app/patients/[id]/`

**Comportement attendu :**

- Historique des photos de cicatrices par date
- Graphique d'évolution de la sévérité des symptômes
- Timeline des événements médicaux

**Règles de code :**

- Les données sont récupérées via un hook `usePatientHistory(id)`
- Les composants graphiques sont dans `apps/web/src/components/`

---

### WEB-03 — Gestion des utilisateurs et codes d'accès

`[ ]` · `apps/web/src/app/patients/`

**Comportement attendu :**

- Création d'un compte patient
- Génération / renouvellement d'un code 6 chiffres
- Affichage du statut du code (actif / expiré / supprimé)

**Règles de code :**

- La génération du code est toujours côté backend (PATIENT-01 / AUTH-01)
- Le frontend affiche uniquement, ne génère jamais le code lui-même

---

### WEB-04 — Export données (PDF / CSV)

`[ ]` · `apps/web/src/app/exports/`

**Comportement attendu :**

- Bouton export PDF d'un rapport patient
- Export CSV anonymisé de tous les patients
- Téléchargement direct dans le navigateur

**Règles de code :**

- L'export est généré côté backend (EXPORT-01) — le frontend déclenche et télécharge uniquement

---

### WEB-05 — Envoi d'instructions pictographiques

`[ ]` · `apps/web/src/app/patients/[id]/instructions/`

**Comportement attendu :**

- Formulaire de création d'instruction (sélection pictogrammes)
- Affichage du statut de lecture (`acknowledged_at`)

---

## APPLICATION MOBILE

### MOB-01 — Authentification patient (code 6 chiffres)

`[ ]` `apps/mobile/src/features/auth/`

**Comportement attendu :**

- Écran de saisie du code 6 chiffres (clavier numérique)
- Stockage du token JWT dans `expo-secure-store` (AES-256)
- Session valide pour toujours une fois connecté

**Règles de code :**

- Le token ne transite jamais en clair — toujours via `expo-secure-store`
- L'expiration de session est gérée par le renouvellement silencieux du JWT
- Interface en khmer par défaut (`i18next`)

---

### MOB-02 — Questionnaire symptômes (offline)

`[ ]` · `apps/mobile/src/features/questionnaire/`

**Comportement attendu :**

- Questions visuelles via pictogrammes
- Réponses simples par tap
- Sauvegarde en SQLite local immédiatement
- Ajout à la `sync_queue` pour envoi ultérieur

**Règles de code :**

- Toute écriture passe par `questionnaire/storage/` avant tout appel réseau
- La `sync_queue` est dans `apps/mobile/src/features/sync/sync.queue.ts`

---

### MOB-03 — Capture et compression de photos

`[ ]` `apps/mobile/src/features/photos/`

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

### MOB-04 — Queue de synchronisation (offline → backend)

`[ ]` `apps/mobile/src/features/sync/`

**Comportement attendu :**

- Table `sync_queue` en SQLite : stocke toutes les actions en attente
- Envoi séquentiel à la reconnexion
- Retry backoff exponentiel : 1s, 2s, 4s, 8s — abandon après 4 tentatives
- Purge automatique des photos > 30 jours si quota 50 Mo atteint

**Règles de code :**

- La queue est traitée dans `sync.service.ts` (orchestration) et `sync.queue.ts` (table SQLite)
- Tester : envoi séquentiel, retry backoff, abandon après 4 tentatives, purge quota

---

### MOB-05 — Consultation des instructions médicales

`[ ]` · `apps/mobile/src/features/instructions/`

**Comportement attendu :**

- Affichage des instructions pictographiques envoyées par le médecin
- Accusé de réception automatique à l'ouverture (`acknowledged_at` mis à jour)
- Cache offline des instructions

**Règles de code :**

- `acknowledged_at` est envoyé au backend via la `sync_queue` (MOB-04)
- Les instructions sont mises en cache SQLite pour fonctionner offline

---

## DEVOPS

### DEVOPS-01 — Interface d'administration PostgreSQL (pgAdmin)

`[ ]` `docker-compose.yml`

**Comportement attendu :**

- pgAdmin accessible sur `http://localhost:8080`
- Connexion à la base PostgreSQL locale via l'interface web
- Authentification par email/mot de passe définis dans les variables d'environnement

**Règles de code :**

- Ajouter le service `pgadmin` dans `docker-compose.yml`
- Ajouter `PGADMIN_EMAIL` et `PGADMIN_PASSWORD` dans `.env.example` racine
- Le service ne doit tourner qu'en développement — ne jamais déployer en production

---

## WORKFLOW OBLIGATOIRE POUR LES AGENTS

### Démarrage d'une feature

1. `git checkout dev && git pull origin dev`
2. Créer la branche en respectant le format : `git checkout -b feature/XXX-00-nom`
3. Le statut passe automatiquement de `[ ]` à `[~]` via GitHub Actions dès la création de la branche.

### Clôture d'une feature (feature terminée)

Quand le code est prêt et testé, l'agent crée la PR manuellement vers `dev` :

```bash
gh pr create --base dev --title "feat: XXX-00 nom de la feature" --body "..."
```

- CodeRabbit review automatiquement la PR
- Une fois la PR mergée, le statut passe automatiquement de `[~]` à `[x]` via GitHub Actions

> **Aucun push direct sur `dev` n'est autorisé.**
> La PR est créée uniquement quand la feature est terminée et testée — pas avant.

---

## RÈGLES GLOBALES (toutes les features)

- **TDD obligatoire sur toutes les features** : l'agent écrit les tests en premier, génère l'implémentation pour les faire passer, puis le développeur valide. Ne jamais générer du code sans test associé.

- **Types** : toujours importer depuis `@sauver-la-face/shared`, jamais redéfinir
- **Backend** : router → service → repository. La logique métier va dans le service uniquement
- **Mobile** : toute donnée est d'abord écrite en SQLite, puis ajoutée à la `sync_queue`
- **Migrations** : additives uniquement (colonnes nullable), jamais de suppression
- **Nommage fichiers** : `feature.router.ts` / `feature.service.ts` / `feature.repository.ts`
- **Tests** : un fichier `feature.service.test.ts` par service critique
- **Logs** : utiliser Pino pour tout log backend — pas de `console.log`
- **Erreurs** : retourner des codes d'erreur explicites (`APP_UPDATE_REQUIRED`, `PHOTO_INTEGRITY_ERROR`, etc.)
