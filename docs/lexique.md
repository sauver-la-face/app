[← README](../README.md) · [Onboarding](onboarding.md) · [Architecture](architecture.md) · [CDC](cdc.md)

# Lexique technique — Sauver la Face

> Définitions des technologies et concepts utilisés dans le projet, avec leur rôle concret.

---

## Outils de développement

### Bun
Runtime JavaScript tout-en-un qui remplace Node.js. Il exécute le code TypeScript directement, gère les dépendances (comme npm), et lance les tests. Plus rapide que Node.js sur la plupart des opérations.
- Utilisé pour : lancer le backend, les tests, les scripts
- Commande type : `bun run dev:backend`

### Biome
Linter et formateur de code. Vérifie que le code respecte les règles de style et détecte les erreurs courantes (variables inutilisées, imports manquants, etc.). Remplace ESLint + Prettier en un seul outil.
- Utilisé pour : `bun run lint` et `bun run format`
- Config : `biome.json` à la racine

---

## Backend

### Hono
Framework web léger pour construire les routes HTTP du backend (équivalent Express.js mais plus rapide et compatible Bun).
- Utilisé pour : définir les endpoints API REST du backend

### Drizzle ORM
Bibliothèque qui permet d'écrire les requêtes SQL en TypeScript au lieu d'écrire du SQL brut. Génère et applique les migrations de base de données.
- Utilisé pour : toutes les requêtes PostgreSQL dans les fichiers `*.repository.ts`
- Commandes : `db:generate` pour créer une migration, `db:migrate` pour l'appliquer

### Pino
Bibliothèque de logs pour le backend. Remplace `console.log` avec des niveaux structurés (`debug`, `info`, `warn`, `error`, `fatal`) et un format JSON adapté à la production.
- Instance centralisée : `apps/backend/src/shared/logger.ts`
- Niveau contrôlé par `LOG_LEVEL` — via `.env.local` en dev, via la plateforme d'hébergement en prod

### Better Auth
Bibliothèque d'authentification qui gère les sessions, tokens JWT, et MFA (double authentification). Évite de coder l'auth from scratch.
- Utilisé pour : login médecins (MFA TOTP) et validation des codes 6 chiffres patients

### PostgreSQL
Base de données relationnelle principale. Stocke toutes les données persistantes du projet (patients, médecins, événements médicaux, etc.).

### MinIO
Serveur de stockage de fichiers compatible avec l'API Amazon S3. Stocke les photos de cicatrices envoyées par les patients.
- Utilisé pour : upload et récupération des photos dans `apps/backend/src/features/photos/`

---

## Mobile

### React Native + Expo
Framework pour créer l'application mobile Android en JavaScript/TypeScript. Expo ajoute une couche de simplicité pour accéder aux fonctionnalités natives (caméra, stockage, etc.).

### expo-sqlite
Base de données SQLite embarquée dans l'application mobile. Permet de stocker les données localement pour fonctionner sans connexion internet (mode offline).
- Utilisé pour : questionnaires, photos en attente, queue de synchronisation

### expo-secure-store
Stockage chiffré sur l'appareil (AES-256). Utilisé pour stocker le token JWT du patient de façon sécurisée.
- Jamais stocker de token dans AsyncStorage (non chiffré)

### Queue de synchronisation
Table SQLite `sync_queue` qui enregistre toutes les actions effectuées offline. Quand la connexion revient, les actions sont envoyées au backend dans l'ordre, avec retry automatique en cas d'échec.

---

## Dashboard web

### Next.js 14 (App Router)
Framework React pour le dashboard web des médecins. L'App Router est la nouvelle façon de structurer les pages avec des dossiers dans `app/`.

### TanStack Query
Bibliothèque qui gère les appels API côté web (chargement, cache, refetch automatique). Tous les appels API passent par des hooks dans `apps/web/src/hooks/`.
- Utilisé pour : polling des alertes toutes les 30s via `refetchInterval`

### Tailwind CSS
Framework CSS utilitaire. Les styles sont écrits directement dans le JSX avec des classes (`className="flex items-center gap-4"`).

---

## Infrastructure

### Docker + Docker Compose
Outils pour lancer l'environnement de développement complet en une seule commande. 4 services en production : PostgreSQL, MinIO, backend Hono, Caddy. pgAdmin disponible uniquement en dev via `docker compose --profile dev up`.

### Caddy
Reverse proxy qui se place devant le backend. Termine le TLS 1.3, génère les certificats Let's Encrypt automatiquement, et redirige le trafic vers Hono. Hono ne reçoit jamais directement les connexions internet.
- En dev : certificat auto-signé (`tls internal`)
- En prod : certificat Let's Encrypt automatique sur le domaine OVH

### GitHub Actions
Système d'intégration continue (CI). Lance automatiquement les tests et le lint à chaque push, et gère les transitions de statut des features dans `features.md`.

### HDS (Hébergement de Données de Santé)
Certification française obligatoire pour héberger des données médicales. Le projet est déployé uniquement sur des serveurs certifiés HDS (OVH Cloud).

---

## Concepts clés

### Offline-first
Approche où l'application mobile fonctionne complètement sans connexion. Les données sont d'abord sauvegardées localement, puis synchronisées avec le backend quand la connexion revient.

### Server-wins
Stratégie de résolution de conflits lors de la synchronisation : si une donnée a été modifiée à la fois sur le mobile et sur le serveur, la version du serveur est conservée.

### TDD (Test-Driven Development)
Méthode de développement où les tests sont écrits **avant** le code. On écrit d'abord le test qui décrit le comportement attendu, puis on écrit le code pour le faire passer.

### Soft delete
Supprimer logiquement un enregistrement sans l'effacer physiquement de la base de données. On marque l'enregistrement comme supprimé (ex: `deleted_at` non null) mais il reste en base.
- Utilisé pour : les codes patients non utilisés après 48h

### Rate limiting
Mécanisme qui bloque les tentatives répétées de connexion. Dans ce projet : 3 tentatives échouées → blocage 15 minutes par IP, pour les patients (code 6 chiffres) et les médecins. Protège contre les attaques par force brute.

### Pictogrammes de symptômes
Interface visuelle pour que le patient évalue ses symptômes sans lire de chiffres. Remplace le champ `severity` numérique. La liste définitive est à valider avec les chirurgiens toulousains (MED-01). Les pictogrammes marqués `triggers_alert` déclenchent une alerte automatique au médecin.

### MFA TOTP
Double authentification par code temporaire (Google Authenticator, Authy). Le médecin entre son mot de passe + un code à 6 chiffres qui change toutes les 30 secondes.

### SHA-256
Algorithme de hachage utilisé pour vérifier l'intégrité des photos. Le mobile calcule une empreinte de la photo avant l'envoi, le backend recalcule et compare — si elles diffèrent, la photo est rejetée.

### Migrations additives
Règle stricte du projet : les modifications de base de données ne peuvent qu'**ajouter** des colonnes (nullable), jamais en supprimer ni en renommer. Évite de casser les appareils mobiles qui n'ont pas encore synchronisé.
