# 0007 - Utiliser Better Auth plutôt qu'une authentification maison

- **Statut** : Accepté
- **Date** : 2026-08-31

## Contexte

L'authentification des médecins suppose des sessions, des tokens, du
rafraîchissement et un second facteur. C'est à la fois complexe à écrire
correctement et critique pour la sécurité des données de santé.

## Décision

On délègue l'authentification médecin à Better Auth plutôt que de l'écrire.

## Alternatives écartées

- **Authentification maison** - tout coder soi-même : sessions, hachage,
  rotation de tokens, TOTP. Chaque brique est un endroit où se tromper
  silencieusement, pour aucune valeur métier ajoutée.

## Conséquences

- Les tables `session`, `account`, `verification` et `two_factor` du schéma sont
  gérées par Better Auth et ne doivent pas être manipulées à la main.
- Le MFA TOTP est couvert sans code spécifique.
- **Better Auth ne couvre que les médecins.** L'authentification patient reste
  maison - code à 6 chiffres puis JWT signé - et n'hérite donc d'aucune des
  garanties ci-dessus. Tout ce qui touche la session patient est à traiter
  explicitement, révocation comprise.
