# 0023 - Couper une session patient en révoquant le code porteur

- **Statut** : Accepté
- **Date** : 2026-08-31

## Contexte

Le token patient est signé pour un an
([0020](0020-fixer-la-session-medecin-a-2h-d-inactivite-et-le-token-patient-a-un-an.md))
et sa vérification ne consultait aucun état serveur : signature, expiration et
forme du payload, rien d'autre. Aucun mécanisme ne permettait donc de couper
l'accès d'un appareil perdu avant l'expiration naturelle du token.

`revokeActiveCodes()` ne pouvait pas jouer ce rôle : sa condition
`used_at IS NULL` ne vise que les codes jamais consommés, et elle n'est appelée
que lors de l'émission d'un nouveau code. Le code qui a réellement ouvert la
session lui échappait entièrement.

Le payload transportait déjà `uuid_patient_code`. Le moyen d'identifier la
session existait donc ; il n'était simplement pas utilisé.

## Décision

Une session patient se coupe en posant `revoked_at` sur le code **consommé**
qui l'a ouverte. `requirePatientAuth` relit ce code à chaque requête et répond
401 `SESSION_REVOKED` s'il est révoqué, supprimé, ou introuvable.

L'opération est exposée par `DELETE /patients/{patientId}/session`, réservée à
une session médecin, et portée par une méthode `revokeSession()` distincte de
`revokeActiveCodes()`.

## Alternatives écartées

- **Raccourcir la durée de vie du token** - supprimerait le besoin de
  révocation, mais rendrait l'application inutilisable hors ligne : un token
  court expire pendant une période sans réseau, sans moyen de le renouveler.
  C'est le compromis déjà arbitré en [0020](0020-fixer-la-session-medecin-a-2h-d-inactivite-et-le-token-patient-a-un-an.md).
- **Faire tourner la clé JWT** - le seul moyen d'invalidation qui existait
  jusqu'ici ([0022](0022-faire-tourner-les-secrets-de-production-tous-les-90-jours.md)),
  mais il déconnecte **tous** les patients à la fois. Inutilisable pour un seul
  appareil perdu.
- **Ajouter `used_at` à la condition de `revokeActiveCodes()`** - le plus court
  à écrire, mais cette méthode est appelée à chaque émission de code : tout
  patient recevant un nouveau code serait déconnecté au passage. Les deux
  opérations doivent rester séparées.
- **Une table de sessions patient** - la solution classique, mais elle
  introduit un état à maintenir alors que `patient_code` porte déjà exactement
  l'information nécessaire.

## Conséquences

- Une lecture en base par requête authentifiée, sur la clé primaire du code.
  Cachable si le volume l'exige ; le dimensionnement du projet ne le justifie
  pas aujourd'hui.
- Un code porteur introuvable est traité comme révoqué : mieux vaut refuser une
  session dont la validité n'est plus démontrable que la laisser passer par
  défaut.
- Le patient retrouve l'accès après émission et saisie d'un nouveau code.
- **L'unicité des codes a dû être étendue** : révoquer un code consommé le
  faisait sortir de l'index unique et libérait ses six chiffres pour un autre
  patient, avec deux lignes portant le même code et un `findByCode`
  indéterminé. Le prédicat devient
  `used_at IS NOT NULL OR (deleted_at IS NULL AND revoked_at IS NULL)`, ce qui
  prolonge l'intention de l'[ADR 0019](0019-restreindre-l-unicite-des-codes-patient-par-des-index-partiels.md) :
  un code ayant servi ne revient jamais en circulation.
- L'espace des codes se réduit donc à chaque session ouverte. Un million de
  combinaisons pour deux cents patients actifs : sans portée pratique.
