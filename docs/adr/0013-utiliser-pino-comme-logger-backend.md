# 0013 - Utiliser Pino comme logger backend

- **Statut** : Accepté
- **Date** : 2026-08-31

## Contexte

Le backend doit journaliser, et ces journaux servent aussi de matière aux logs
d'audit imposés par la certification HDS
([0014](0014-exporter-les-logs-d-audit-vers-s3-par-un-cron-journalier.md)). Le
format doit être exploitable par un outil de supervision, pas seulement
lisible dans un terminal.

## Décision

On utilise Pino comme logger du backend, exposé par `@shared/logger`.

## Alternatives écartées

- **Winston** - plus configurable, mais plus lent et sans format JSON natif.
- **`console.log`** - sans dépendance, mais ne produit ni niveaux structurés ni
  format exploitable en aval, et ne peut pas alimenter un audit.

## Conséquences

- Le format JSON est natif, sans coût de sérialisation supplémentaire.
- Les journaux sont directement consommables par un outil de supervision.
- Les niveaux structurés permettent de filtrer par `LOG_LEVEL` sans toucher au
  code.
- `console.log` est proscrit dans le backend : un appel direct échappe au format
  et n'atteint jamais l'audit.
