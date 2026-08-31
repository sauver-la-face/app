# 0004 - Utiliser Bun plutôt que Node.js

- **Statut** : Accepté
- **Date** : 2026-08-31

## Contexte

Le backend est écrit en TypeScript et doit choisir un runtime. Le choix
détermine la chaîne de build, le gestionnaire de dépendances et la
compatibilité de l'écosystème pour toute la durée du projet.

## Décision

On utilise Bun comme runtime et gestionnaire de dépendances du backend.

## Alternatives écartées

- **Node.js** - impose une étape de transpilation TypeScript avant exécution et
  un gestionnaire de dépendances séparé (npm ou yarn). Écosystème plus large et
  plus éprouvé, mais la chaîne d'outillage est plus lourde pour le même résultat.

## Conséquences

- Exécution TypeScript native, sans transpilation ni étape de build en
  développement.
- Gestion des dépendances intégrée, qui remplace npm et yarn.
- Démarrage et exécution plus rapides.
- L'écosystème Node.js reste utilisable, mais certains outils supposent Node et
  demandent des contournements - c'est l'un des critères qui a écarté Prisma,
  voir [0006](0006-utiliser-drizzle-orm-plutot-que-prisma.md).
