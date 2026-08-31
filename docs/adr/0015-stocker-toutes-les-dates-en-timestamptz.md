# 0015 - Stocker toutes les dates en timestamptz

- **Statut** : Accepté
- **Date** : 2026-08-31

## Contexte

Les patients sont au Cambodge (UTC+7) et les médecins en France (UTC+1 ou +2
selon la saison). Un horodatage sans fuseau ne dit pas à quel moment réel un
événement médical s'est produit : la même valeur se lit différemment des deux
côtés.

## Décision

Toutes les colonnes de date et d'heure utilisent `timestamp with time zone`
(`timestamptz`).

## Alternatives écartées

- **`timestamp` sans fuseau** - une colonne plus légère, mais l'interprétation
  dépend alors du lecteur. Sur un suivi médical réparti sur deux fuseaux, c'est
  une ambiguïté qu'aucune convention d'équipe ne rattrape durablement.
- **Stocker un entier epoch** - non ambigu, mais illisible en base et privé de
  l'arithmétique de dates de PostgreSQL.

## Conséquences

- PostgreSQL stocke en UTC et convertit à la lecture selon le fuseau de la
  session : aucune conversion à écrire dans le code applicatif.
- La règle vaut sans exception : une seule colonne en `timestamp` nu suffit à
  réintroduire l'ambiguïté qu'on cherche à éliminer.
