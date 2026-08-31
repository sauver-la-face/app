# 0010 - Générer la documentation OpenAPI avec @hono/zod-openapi

- **Statut** : Accepté
- **Date** : 2026-08-31

## Contexte

Trois applications consomment l'API : le dashboard web, l'application mobile et
les tests. Les schémas de validation Zod existent déjà dans
`@sauver-la-face/shared`. Une documentation tenue à la main à côté de ces
schémas divergerait du code à la première évolution.

## Décision

La documentation OpenAPI est générée à partir des schémas Zod existants, via
`@hono/zod-openapi`.

## Alternatives écartées

- **Documentation rédigée à la main** - lisible immédiatement, mais devient
  fausse dès qu'une route change, sans que rien ne le signale.
- **Annotations dans les commentaires** - la description reste à côté du code
  mais n'est pas la source de vérité : rien ne garantit qu'elle décrit le
  schéma réellement appliqué.

## Conséquences

- Les schémas Zod de `@sauver-la-face/shared` sont réutilisés directement :
  aucune documentation n'est écrite deux fois.
- `/docs` sert une interface Swagger UI interactive en développement.
- `/openapi.json` permet de générer un client TypeScript pour le web et le
  mobile, dont les types restent synchronisés avec le backend.
- La documentation ne peut décrire que ce que Zod valide : une règle métier
  appliquée en dehors du schéma n'apparaîtra pas.
