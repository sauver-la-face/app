# 0016 - Garantir l'unicité des emails et des codes par un index fonctionnel en minuscules

- **Statut** : Accepté
- **Date** : 2026-08-31

## Contexte

`physician.mail` doit être unique. Avec une contrainte d'unicité classique,
`Doctor@hopital.fr` et `doctor@hopital.fr` sont deux valeurs distinctes, donc
deux comptes distincts pour la même personne. Le même risque existe sur
`symptom.code`.

## Décision

L'unicité est portée par un index unique fonctionnel sur `lower(mail)` plutôt
que par une contrainte inline. Le même principe s'applique à `symptom.code`,
par cohérence.

## Alternatives écartées

- **Contrainte `UNIQUE` classique** - la plus simple à déclarer, mais sensible
  à la casse : elle laisse passer les doublons qu'on cherche justement à
  interdire.
- **Normaliser en minuscules dans le code applicatif** - fonctionne tant que
  tous les chemins d'écriture y pensent. Une insertion par script, une
  migration ou un correctif manuel contourne la règle sans erreur visible.

## Conséquences

- La garantie est portée par la base, donc valable quel que soit le chemin
  d'écriture.
- Toute recherche par email doit interroger `lower(mail)` pour utiliser l'index,
  sous peine de déclencher un parcours complet de la table.
