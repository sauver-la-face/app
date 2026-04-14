[← README](../README.md) · [Onboarding](onboarding.md) · [Lexique](lexique.md) · [CDC](cdc.md)

# Architecture — Sauver la Face

> Décisions techniques, choix d'architecture et pourquoi ils ont été faits.

---

## Vue d'ensemble

```
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

### Pourquoi offline-first sur le mobile
Les patients sont au Cambodge avec une connexion réseau très instable. L'application doit fonctionner sans internet. Toutes les données (questionnaires, photos) sont d'abord stockées en SQLite local, puis synchronisées quand la connexion revient via une queue de sync (`sync_queue`).

### Pourquoi server-wins pour les conflits
Dans un contexte médical, les données du serveur (validées par un médecin) ont priorité sur celles du mobile. Si un patient modifie une réponse offline et que le médecin a modifié la même donnée entre-temps, la version médicale l'emporte. Tout conflit est loggé avant écrasement.

### Pourquoi Bun au lieu de Node.js
- Exécution TypeScript native sans transpilation
- Gestion des dépendances intégrée (remplace npm/yarn)
- Plus rapide au démarrage et à l'exécution
- Compatible avec l'écosystème Node.js existant

### Pourquoi Hono au lieu d'Express
- Conçu pour les runtimes modernes (Bun, Deno, Workers)
- Typage TypeScript natif sur les routes
- Performances supérieures à Express pour les API REST

### Pourquoi Drizzle ORM au lieu de Prisma
- Requêtes SQL typées sans couche d'abstraction lourde
- Migrations en TypeScript, versionnées dans le dépôt
- Compatibilité native Bun (Prisma nécessite des workarounds)

### Pourquoi Better Auth au lieu d'une auth custom
La gestion de l'authentification (sessions, tokens, MFA, refresh) est complexe et critique pour la sécurité. Better Auth gère tout ça sans qu'on ait à le coder. On se concentre sur la logique métier.

### Pourquoi un compte bot pour les workflows GitHub Actions
Les workflows qui commitent automatiquement sur `dev` (mise à jour `features.md`) ont besoin d'un token d'écriture. Deux options évaluées :
- **PAT personnel** — simple mais lié à une personne. Si elle quitte le projet, les workflows cassent.
- **Compte bot dédié (`sauver-la-face-bot`)** — retenu. Token indépendant des personnes, révocable sans impact sur l'équipe. Pratique recommandée par GitHub pour les automatisations en équipe.

### Pourquoi Caddy comme reverse proxy
- TLS 1.3 obligatoire pour les données de santé (RGPD + certification HDS) — Caddy l'active par défaut sans configuration
- Certificats Let's Encrypt automatiques — renouvellement inclus, zéro intervention manuelle
- En dev : certificat auto-signé en une ligne (`tls internal`)
- Config minimaliste (3 lignes) vs Nginx (~30 lignes) ou Traefik (labels Docker complexes)
- Hono ne termine jamais le TLS directement — Caddy est la seule porte d'entrée exposée à Internet

### Pourquoi OpenAPI avec @hono/zod-openapi
- Les schémas Zod de `@sauver-la-face/shared` sont réutilisés directement — aucune documentation manuelle
- `/docs` génère une interface Swagger UI interactive en dev
- `/openapi.json` permet de générer un client TypeScript pour le web et le mobile en une commande — les types sont toujours synchronisés avec le backend

### Pourquoi MinIO au lieu de S3 directement
- Déployable en local pour le développement (pas besoin de credentials AWS)
- Compatible avec l'API S3 — migration vers S3 ou OVH Object Storage sans changer le code
- Hébergeable sur OVH Cloud HDS (certification requise pour données médicales)

### Pourquoi polling au lieu de WebSockets pour les alertes
- 200 patients actifs max, 20 médecins max — le volume ne justifie pas la complexité des WebSockets
- TanStack Query gère le polling avec `refetchInterval` en une ligne
- Moins de surface d'attaque pour la sécurité
- Plus simple à débugger et maintenir

### Pourquoi Pino au lieu de Winston ou console.log
- Le plus rapide des loggers Node.js (format JSON natif, pas de sérialisation coûteuse)
- Format JSON adapté aux outils de monitoring (Datadog, Loki, etc.)
- Niveaux structurés — permet de filtrer par `LOG_LEVEL` sans toucher au code

### Logs d'audit — stockage S3
Les logs d'audit (accès aux données médicales) sont une obligation HDS. Pino écrit dans un fichier local, un cron journalier exporte vers S3 :
- **Dev** : bucket `logs-audit` sur MinIO local
- **Prod** : bucket `logs-audit` sur OVH Object Storage (certifié HDS, rétention 1 an)

Même client S3 dans le code — seules les variables d'environnement changent entre dev et prod.

---

## Architecture backend — 3 couches par feature

```text
feature/
  feature.router.ts      ← reçoit la requête HTTP, valide avec Zod, appelle le service
  feature.service.ts     ← logique métier uniquement, appelle le repository
  feature.repository.ts  ← requêtes SQL via Drizzle, aucune logique métier
```

**Règle absolue** : la logique métier ne doit jamais être dans le router ni dans le repository. Le router ne fait que valider et router. Le repository ne fait que lire/écrire en base.

---

## Architecture mobile — offline-first par feature

```
feature/
  feature.screen.tsx     ← composant UI
  feature.storage.ts     ← lecture/écriture SQLite local
  feature.service.ts     ← orchestration : storage → sync_queue → API
```

**Règle absolue** : toute donnée est d'abord écrite en SQLite (`feature.storage.ts`) avant tout appel réseau. L'appel réseau est géré par la queue de sync, pas directement dans l'UI.

---

## Schéma de base de données

```
physician ──────────────────────────────────────────┐
                                                     │
patient_code ──── patient ──── medical_procedure     │
                     │              │                │
                     │         medical_event ────────┤
                     │              │                │
                     │           media               │
                     │                               │
                     └──── instructions ─────────────┘
```

Toutes les migrations sont **additives** : on n'ajoute que des colonnes nullable, jamais de suppression ni de renommage. Raison : les appareils mobiles peuvent être désynchronisés depuis plusieurs semaines — un schéma incompatible bloquerait leur synchronisation.

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

---

## Contraintes de volume

Ces contraintes ont guidé les choix d'architecture (polling vs WebSocket, SQLite vs autre, etc.) :

- 200 patients actifs simultanés max
- 20 utilisateurs web simultanés max
- APK Android < 30 Mo
- Cache SQLite mobile : 50 Mo max par appareil
- Photos : max 50 par patient, JPEG qualité 80%, < 2 Mo
