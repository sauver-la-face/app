# 0022 - Faire tourner les secrets de production tous les 90 jours

- **Statut** : Accepté
- **Date** : 2026-08-31

## Contexte

Un secret qui ne change jamais reste valable indéfiniment le jour où il fuite,
et rien ne signale la fuite. Les données concernées étant des données de santé,
la fenêtre d'exposition doit être bornée par construction.

## Décision

Les clés JWT et les identifiants OVH Object Storage sont renouvelés tous les 90
jours en production. Le développement n'est pas soumis à rotation : ses
identifiants vivent dans `.env.local` et ne donnent accès à aucune donnée
réelle.

## Alternatives écartées

- **Aucune rotation** - sans coût opérationnel, mais rend toute fuite
  définitive.
- **Rotation plus fréquente** - réduit encore la fenêtre, au prix d'une
  manœuvre manuelle régulière dont l'oubli provoque une panne. 90 jours est le
  compromis retenu entre exposition et charge d'exploitation.

## Conséquences

- La fenêtre d'exploitation d'un secret fuité est bornée à 90 jours.
- **Faire tourner la clé JWT invalide tous les tokens patient en cours.** Compte
  tenu de leur durée de vie d'un an
  ([0020](0020-fixer-la-session-medecin-a-2h-d-inactivite-et-le-token-patient-a-un-an.md)),
  c'est aujourd'hui le seul moyen d'invalider une session patient - au prix
  d'une déconnexion de tous les patients simultanément.
- Les détails d'implémentation de la rotation sont dans `docs/cdc.md`.
