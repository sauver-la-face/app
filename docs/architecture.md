# Architecture — Sauver la Face

> Décisions techniques, choix d'architecture et pourquoi ils ont été faits.

---

## Vue d'ensemble

```
┌─────────────────┐        ┌──────────────────┐
│  App mobile     │  sync  │   Backend API    │
│  React Native   │ ──────▶│   Bun + Hono     │
│  Expo SDK 52    │        │   Port 3001      │
│  (Android)      │        └────────┬─────────┘
└─────────────────┘                 │
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
    ┌─────────▼──────┐   ┌─────────▼──────┐   ┌─────────▼──────┐
    │  PostgreSQL    │   │     MinIO      │   │  Dashboard web │
    │  (données)     │   │  (photos)      │   │  Next.js 14    │
    └────────────────┘   └────────────────┘   │  Port 3000     │
                                              └────────────────┘
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

---

## Architecture backend — 3 couches par feature

```
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
| Transit | TLS 1.3 obligatoire |
| Stockage mobile | AES-256-GCM via expo-secure-store |
| Auth médecins | MFA TOTP obligatoire (Better Auth) |
| Auth patients | Code 6 chiffres + JWT signé HMAC-SHA256 |
| Intégrité photos | Checksum SHA-256 calculé mobile, vérifié backend |
| Hébergement | OVH Cloud certifié HDS |

---

## Contraintes de volume

Ces contraintes ont guidé les choix d'architecture (polling vs WebSocket, SQLite vs autre, etc.) :

- 200 patients actifs simultanés max
- 20 utilisateurs web simultanés max
- APK Android < 30 Mo
- Cache SQLite mobile : 50 Mo max par appareil
- Photos : max 50 par patient, JPEG qualité 80%, < 2 Mo
