# 0001 - Tracer les décisions techniques dans des ADR

- **Statut** : Accepté
- **Date** : 2026-08-31

## Contexte

Les décisions techniques structurantes se prennent en cours de projet et se
perdent. Six mois plus tard, personne - y compris soi-même - ne sait pourquoi
telle option a été retenue plutôt qu'une autre, ni ce qui avait été écarté.

## Décision

Chaque décision technique structurante donne lieu à un fichier dans
`docs/adr/`, nommé `NNNN-titre-en-kebab-case.md`, sur le modèle de
`0000-template.md`.

## Alternatives écartées

- **Un fichier unique** - plus simple à parcourir, mais écrase l'historique
  git, ne donne pas de référence stable citable, et devient illisible en
  croissant. Compensé ici par le tableau récapitulatif du README.
- **Ne rien tracer** - repose sur la mémoire, ne survit pas à un changement
  d'équipe.

## Conséquences

- La numérotation ne recule jamais : on ne renumérote pas, on ne supprime pas.
- Un ADR n'est pas modifié. Quand la décision change, on en écrit un nouveau
  et l'ancien passe en « Remplacé par NNNN ».
- Le tableau de `README.md` est mis à jour à chaque ajout.
