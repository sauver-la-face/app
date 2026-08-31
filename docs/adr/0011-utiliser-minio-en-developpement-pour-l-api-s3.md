# 0011 - Utiliser MinIO en développement pour l'API S3

- **Statut** : Accepté
- **Date** : 2026-08-31

## Contexte

Les photos et les logs d'audit sont stockés en object storage. En production,
l'hébergement doit être certifié HDS. En développement, exiger des identifiants
cloud pour lancer le projet ajoute une dépendance externe et un coût à chaque
poste.

## Décision

On utilise MinIO en développement, avec l'API S3, et OVH Object Storage en
production. Le code ne connaît qu'un client S3.

## Alternatives écartées

- **S3 réel en développement** - fidèle à la production, mais impose des
  identifiants cloud à chaque développeur et un coût de stockage pour des
  données jetables.
- **Stockage sur disque local en développement** - sans dépendance, mais le
  code de production ne serait alors jamais exercé pendant le développement.

## Conséquences

- Aucun changement de code entre développement et production : seules les
  variables d'environnement diffèrent.
- MinIO ne tourne qu'en développement et ne doit jamais être déployé en
  production.
- La conformité HDS repose entièrement sur le fournisseur de production, pas sur
  le code.
