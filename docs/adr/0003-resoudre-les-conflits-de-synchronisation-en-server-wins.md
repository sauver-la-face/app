# 0003 - Résoudre les conflits de synchronisation en server-wins

- **Statut** : Accepté
- **Date** : 2026-08-31

## Contexte

L'écriture locale d'abord ([0002](0002-construire-l-application-mobile-en-offline-first.md))
rend les conflits inévitables : un patient modifie une réponse hors ligne
pendant que le médecin modifie la même donnée côté serveur. Il faut une règle
d'arbitrage, et le contexte est médical.

## Décision

Le serveur gagne. En cas de divergence, la version du serveur - validée par un
médecin - écrase celle du mobile. Tout conflit est journalisé avant écrasement.

## Alternatives écartées

- **Client-wins** - ferait primer une saisie patient sur une donnée validée par
  un professionnel de santé. Inacceptable dans un contexte médical.
- **Fusion manuelle** - demande un arbitrage humain à chaque conflit. Impraticable
  au volume visé, et impossible à solliciter auprès d'un patient hors ligne.

## Conséquences

- Une saisie patient peut être écrasée sans son intervention ni sa validation.
- Le journal de conflit est la seule trace de la donnée écrasée : il doit être
  écrit avant l'écrasement, jamais après, et conservé.
