# 0002 - Construire l'application mobile en offline-first

- **Statut** : Accepté
- **Date** : 2026-08-31

## Contexte

Les patients suivis se trouvent au Cambodge, avec une connexion réseau très
instable. Une application qui exige le réseau pour enregistrer un questionnaire
ou une photo serait inutilisable une grande partie du temps, au moment précis
où le patient doit saisir son suivi.

## Décision

L'application mobile écrit d'abord en local. Toutes les données - réponses aux
questionnaires, photos - sont enregistrées en SQLite sur l'appareil, puis
poussées vers le backend par une queue de synchronisation (`sync_queue`)
lorsque la connexion revient.

## Alternatives écartées

- **Application connectée classique** - chaque saisie part directement au
  serveur. Plus simple à écrire, aucune duplication de schéma, mais l'application
  devient inutilisable dès que le réseau tombe. C'est le cas d'usage principal,
  pas un cas limite.

## Conséquences

- Toute donnée transite par SQLite avant le réseau : aucun chemin d'écriture
  direct vers l'API depuis l'interface.
- Un schéma local doit être maintenu en parallèle du schéma serveur.
- La synchronisation devient un sujet à part entière, avec sa propre gestion de
  conflits - voir [0003](0003-resoudre-les-conflits-de-synchronisation-en-server-wins.md).
