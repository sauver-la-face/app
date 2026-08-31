# 0021 - Limiter les tentatives d'authentification à 3 par 15 minutes et par IP

- **Statut** : Accepté
- **Date** : 2026-08-31

## Contexte

Un code d'accès patient tient sur six chiffres : un million de combinaisons,
qu'un script parcourt en quelques minutes si rien ne l'en empêche. Le login
médecin est exposé au même type d'attaque.

## Décision

Trois tentatives échouées déclenchent un blocage de 15 minutes par adresse IP,
sur l'entrée du code patient comme sur le login médecin.

## Alternatives écartées

- **Aucune limite** - laisse la force brute aboutir sur un espace de six
  chiffres.
- **Blocage du compte après N échecs** - efficace contre la force brute, mais
  offre un déni de service : il suffit d'échouer trois fois sur le code d'un
  patient pour lui interdire l'accès à son propre suivi.

## Conséquences

- Le blocage porte sur l'IP, pas sur le compte : un patient légitime n'est
  jamais verrouillé par l'action d'un tiers.
- Un attaquant disposant de plusieurs adresses contourne la limite ; le
  mécanisme ralentit la force brute, il ne la rend pas impossible.
- Ce dispositif est indépendant du cycle de vie du code : le blocage de 15
  minutes protège contre la force brute, l'expiration de 48h gère la péremption
  d'un code jamais utilisé.
