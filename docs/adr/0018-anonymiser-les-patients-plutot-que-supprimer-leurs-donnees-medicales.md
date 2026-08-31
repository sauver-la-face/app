# 0018 - Anonymiser les patients plutôt que supprimer leurs données médicales

- **Statut** : Accepté
- **Date** : 2026-08-31

## Contexte

Le RGPD accorde un droit à l'effacement (art. 17), mais son article 17.3.c
prévoit une exception pour les données de santé nécessaires à des fins de santé
publique. Une demande d'effacement doit donc être honorée sans détruire
l'historique médical.

## Décision

Une demande d'effacement met à `NULL` les seules données d'identité de la table
`patient` - `first_name`, `last_name`, `birthdate` - et renseigne
`anonymized_at`. Les données médicales (`medical_procedure`, `medical_event`,
`media`) ne sont jamais supprimées.

## Alternatives écartées

- **Suppression physique du patient et de son historique** - lecture littérale
  de l'art. 17, mais détruit des données que l'art. 17.3.c autorise à conserver,
  et casse l'intégrité référentielle de tout le dossier médical.
- **Conserver l'identité et masquer à l'affichage** - ne répond pas à la
  demande : la donnée identifiante est toujours là, accessible à qui a l'accès
  base.

## Conséquences

- L'UUID patient reste intact : tout l'historique médical demeure traçable par
  UUID, mais n'est plus rattachable à une personne identifiable.
- Aucune clé étrangère vers `patient` n'utilise `ON DELETE CASCADE`, puisque la
  suppression d'un patient n'est jamais un `DELETE` SQL.
- L'anonymisation est irréversible : `anonymized_at` est la seule trace qu'une
  identité a existé.
