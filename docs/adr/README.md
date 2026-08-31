# Décisions d'architecture (ADR)

Une décision = un fichier. Voir `0000-template.md` pour le format.

| # | Titre | Statut | Date |
|---|---|---|---|
| [0001](0001-utiliser-les-adr.md) | Tracer les décisions techniques dans des ADR | Accepté | 2026-08-31 |
| [0002](0002-construire-l-application-mobile-en-offline-first.md) | Construire l'application mobile en offline-first | Accepté | 2026-08-31 |
| [0003](0003-resoudre-les-conflits-de-synchronisation-en-server-wins.md) | Résoudre les conflits de synchronisation en server-wins | Accepté | 2026-08-31 |
| [0004](0004-utiliser-bun-plutot-que-node-js.md) | Utiliser Bun plutôt que Node.js | Accepté | 2026-08-31 |
| [0005](0005-utiliser-hono-plutot-qu-express.md) | Utiliser Hono plutôt qu'Express | Accepté | 2026-08-31 |
| [0006](0006-utiliser-drizzle-orm-plutot-que-prisma.md) | Utiliser Drizzle ORM plutôt que Prisma | Accepté | 2026-08-31 |
| [0007](0007-utiliser-better-auth-plutot-qu-une-authentification-maison.md) | Utiliser Better Auth plutôt qu'une authentification maison | Accepté | 2026-08-31 |
| [0008](0008-authentifier-les-workflows-github-actions-par-une-github-app.md) | Authentifier les workflows GitHub Actions par une GitHub App | Accepté | 2026-08-31 |
| [0009](0009-utiliser-caddy-comme-reverse-proxy.md) | Utiliser Caddy comme reverse proxy | Accepté | 2026-08-31 |
| [0010](0010-generer-la-documentation-openapi-avec-hono-zod-openapi.md) | Générer la documentation OpenAPI avec @hono/zod-openapi | Accepté | 2026-08-31 |
| [0011](0011-utiliser-minio-en-developpement-pour-l-api-s3.md) | Utiliser MinIO en développement pour l'API S3 | Accepté | 2026-08-31 |
| [0012](0012-rafraichir-les-alertes-par-polling-plutot-que-par-websockets.md) | Rafraîchir les alertes par polling plutôt que par WebSockets | Accepté | 2026-08-31 |
| [0013](0013-utiliser-pino-comme-logger-backend.md) | Utiliser Pino comme logger backend | Accepté | 2026-08-31 |
| [0014](0014-exporter-les-logs-d-audit-vers-s3-par-un-cron-journalier.md) | Exporter les logs d'audit vers S3 par un cron journalier | Accepté | 2026-08-31 |
| [0015](0015-stocker-toutes-les-dates-en-timestamptz.md) | Stocker toutes les dates en timestamptz | Accepté | 2026-08-31 |
| [0016](0016-garantir-l-unicite-des-emails-et-des-codes-par-un-index-fonctionnel-en-minuscules.md) | Garantir l'unicité des emails et des codes par un index fonctionnel en minuscules | Accepté | 2026-08-31 |
| [0017](0017-utiliser-le-type-boolean-natif-de-postgresql-plutot-qu-un-entier.md) | Utiliser le type boolean natif de PostgreSQL plutôt qu'un entier | Accepté | 2026-08-31 |
| [0018](0018-anonymiser-les-patients-plutot-que-supprimer-leurs-donnees-medicales.md) | Anonymiser les patients plutôt que supprimer leurs données médicales | Accepté | 2026-08-31 |
| [0019](0019-restreindre-l-unicite-des-codes-patient-par-des-index-partiels.md) | Restreindre l'unicité des codes patient par des index partiels | Accepté | 2026-08-31 |
| [0020](0020-fixer-la-session-medecin-a-2h-d-inactivite-et-le-token-patient-a-un-an.md) | Fixer la session médecin à 2h d'inactivité et le token patient à un an | Accepté | 2026-08-31 |
| [0021](0021-limiter-les-tentatives-d-authentification-a-3-par-15-minutes-et-par-ip.md) | Limiter les tentatives d'authentification à 3 par 15 minutes et par IP | Accepté | 2026-08-31 |
| [0022](0022-faire-tourner-les-secrets-de-production-tous-les-90-jours.md) | Faire tourner les secrets de production tous les 90 jours | Accepté | 2026-08-31 |

Les ADR 0002 à 0022 consignent des décisions prises avant la mise en place de ce
dossier. Elles ont été reprises depuis `../architectureAdr.md` — sections
« Décisions d'architecture » (0002 à 0014), « Décisions de schéma » (0015 à 0019)
et « Sécurité » (0020 à 0022). La date est celle de leur consignation, pas celle
de l'arbitrage d'origine.
