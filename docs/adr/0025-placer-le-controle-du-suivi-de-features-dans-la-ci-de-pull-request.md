# 0025 - Placer le contrôle du suivi de features dans la CI de pull request

- **Statut** : Accepté
- **Date** : 2026-09-04

## Contexte

Trois workflows entretiennent le statut des features dans `.ai/features.md`.
Deux d'entre eux extraient un identifiant du nom de branche, cherchent la
section `### <ID>`, et sortaient en succès quand ils ne trouvaient rien :
identifiant illisible, ou section absente. Le `|| true` posé sur le `grep` et
les `exit 0` qui suivaient transformaient l'anomalie en croix verte, avec un
message perdu dans les logs d'un job réussi que personne n'ouvre.

Le coût est mesuré, pas supposé. DOCS-04 a livré trois lots sous un identifiant
sans entrée. SEC-05 a été mergé en pull request 109 dans le même angle mort.
DEVENV-01, DOCKER-01 et API-03 sont dans le même cas, branches ouvertes.

Un second trou double le premier : `update-feature-status` ne se déclenche que
sur les branches `feature/`, alors que douze des dix-sept branches actives
portent le préfixe `fix/`. La majorité du travail échappe au suivi par
construction.

## Décision

Le blocage est porté par un job `Entrée de suivi` de `ci.yml`, exécuté sur les
pull requests et exigé avant merge. Il refuse une branche `feature/` ou `fix/`
dont l'identifiant est illisible ou sans section correspondante dans
`features.md`.

Les deux workflows de statut échouent désormais aussi, mais comme alarmes :
`feature-in-progress` à la création de branche, `update-feature-status` après le
merge.

## Alternatives écartées

- **Ne durcir que les workflows de statut.** `update-feature-status` s'exécute
  sur `pull_request: closed`, donc après le merge. Le faire échouer produit une
  alarme sur un travail déjà intégré, jamais une barrière.
- **Un hook `pre-push` local.** Contournable par `--no-verify`, non partagé
  entre les postes, et absent des exécutions automatisées.
- **Étendre `update-feature-status` aux branches `fix/`.** Cela change le sens
  du statut `[x]`, qui signifierait alors « corrigé » autant que « livré ». La
  question mérite d'être tranchée pour elle-même.

## Conséquences

- Une branche `feature/` ou `fix/` sans entrée ne peut plus être mergée.
  DEVENV-01, DOCKER-01 et API-03 devront recevoir la leur avant d'aboutir.
- Les branches hors convention passent sans contrôle. C'est délibéré : une
  branche `chore/` ne prétend rien suivre, et la faire échouer apprendrait
  surtout à renommer ses branches pour éviter le job.
- Pour que `[~]` soit posé, l'entrée doit être sur `dev` avant la création de la
  branche de travail. Le véhicule est une pull request de spécification portée
  par une branche hors convention, ce qui ajoute une pull request par feature.
- Les trois workflows posent trois questions distinctes et aucun ne remplace les
  autres : l'entrée est-elle sur `dev`, le travail est-il spécifié, le statut
  a-t-il pu être posé.
