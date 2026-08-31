# 0005 - Utiliser Hono plutôt qu'Express

- **Statut** : Accepté
- **Date** : 2026-08-31

## Contexte

L'API REST du backend a besoin d'un framework HTTP. Le choix doit tenir avec le
runtime retenu ([0004](0004-utiliser-bun-plutot-que-node-js.md)) et avec une
base de code entièrement typée.

## Décision

On utilise Hono comme framework HTTP du backend.

## Alternatives écartées

- **Express** - standard de fait et écosystème de middlewares le plus fourni,
  mais conçu pour Node.js classique. Son typage TypeScript est rapporté par des
  paquets tiers plutôt que natif, et ses performances sont en retrait sur une
  API REST.

## Conséquences

- Le framework est conçu pour les runtimes modernes (Bun, Deno, Workers), ce
  qui reste cohérent avec le choix de runtime.
- Le typage TypeScript porte nativement sur les routes.
- Le reste de la pile s'appuie sur les modules Hono : `hono/jwt` pour les tokens
  patient et `@hono/zod-openapi` pour la documentation
  ([0010](0010-generer-la-documentation-openapi-avec-hono-zod-openapi.md)).
  Changer de framework signifierait revoir ces deux briques.
