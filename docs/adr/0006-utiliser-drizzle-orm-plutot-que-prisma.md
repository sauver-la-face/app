# 0006 - Utiliser Drizzle ORM plutôt que Prisma

- **Statut** : Accepté
- **Date** : 2026-08-31

## Contexte

L'accès à PostgreSQL doit être typé et versionné, sur un runtime Bun
([0004](0004-utiliser-bun-plutot-que-node-js.md)).

## Décision

On utilise Drizzle ORM pour l'accès à la base et pour les migrations.

## Alternatives écartées

- **Prisma** - ORM le plus répandu, mais impose une couche d'abstraction plus
  lourde entre le code et le SQL, et demande des contournements pour tourner
  sous Bun.

## Conséquences

- Les requêtes sont écrites en SQL typé, sans couche d'abstraction intermédiaire.
- Les migrations sont écrites en TypeScript et versionnées dans le dépôt.
- Drizzle produit des requêtes paramétrées : c'est ce qui couvre l'injection SQL
  dans la checklist OWASP, aucune requête n'étant construite par concaténation.
