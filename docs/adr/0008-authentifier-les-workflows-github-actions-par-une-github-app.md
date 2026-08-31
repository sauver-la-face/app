# 0008 - Authentifier les workflows GitHub Actions par une GitHub App

- **Statut** : Accepté
- **Date** : 2026-08-31

## Contexte

Les workflows qui tiennent à jour le statut des features commitent
automatiquement sur `dev`. Ils ont donc besoin d'un droit d'écriture sur le
dépôt, que le `GITHUB_TOKEN` fourni par défaut n'accorde pas.

## Décision

Les workflows s'authentifient via une GitHub App enregistrée sur le dépôt, qui
génère un token éphémère à chaque exécution.

## Alternatives écartées

- **PAT personnel** - le plus rapide à mettre en place, mais rattaché à une
  personne : si elle quitte le projet ou régénère son token, les workflows
  cassent.
- **Compte bot dédié** - indépendant des personnes, mais impose de créer et
  maintenir un second compte GitHub avec son adresse e-mail, et repose sur un
  token de longue durée.

## Conséquences

- L'App est rattachée au dépôt, pas à un individu : aucun départ ne casse les
  workflows.
- Les tokens sont éphémères (une heure), générés par
  `actions/create-github-app-token` avant le checkout.
- Deux secrets sont à maintenir dans le dépôt : `APP_ID` et `APP_PRIVATE_KEY`.
- L'App doit disposer de la permission Contents en lecture et écriture, et rester
  installée sur le dépôt - une désinstallation casse silencieusement la mise à
  jour des statuts.
