# 0017 - Utiliser le type boolean natif de PostgreSQL plutôt qu'un entier

- **Statut** : Accepté
- **Date** : 2026-08-31

## Contexte

`patient_code.is_active` exprime un état à deux valeurs. Plusieurs conventions
coexistent dans les bases relationnelles : booléen natif, entier 0/1, ou
caractère 'O'/'N'.

## Décision

Les colonnes à deux états utilisent le type `boolean` de PostgreSQL.

## Alternatives écartées

- **`integer` valant 0 ou 1** - courant par habitude d'autres moteurs, mais le
  type autorise 2, -1 ou 42 : la base ne protège plus contre une valeur qui n'a
  aucun sens, et le code doit s'en défendre.

## Conséquences

- Les valeurs invalides sont refusées par le moteur, pas détectées après coup.
- Les requêtes s'écrivent `WHERE is_active` plutôt que `WHERE is_active = 1`.
