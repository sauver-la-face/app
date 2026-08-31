# 0020 - Fixer la session médecin à 2h d'inactivité et le token patient à un an

- **Statut** : Accepté
- **Date** : 2026-08-31

## Contexte

Les deux profils n'ont ni le même usage ni le même environnement. Le médecin
travaille depuis un poste, connecté, sur des données de santé de plusieurs
patients. Le patient utilise un téléphone hors ligne la majeure partie du temps
([0002](0002-construire-l-application-mobile-en-offline-first.md)), et n'a par
définition aucun moyen de rafraîchir un token quand le réseau est absent.

## Décision

La session médecin expire après 2h d'inactivité, avec renouvellement silencieux
tant que la session est active. Le token patient est signé pour un an et
renouvelé à chaque connexion.

## Alternatives écartées

- **Durée courte pour le patient** - alignerait les deux profils sur la
  pratique habituelle, mais rendrait l'application inutilisable : un token de
  quelques heures expire pendant une période hors ligne, sans possibilité de le
  renouveler.
- **Durée longue pour le médecin** - éviterait des reconnexions, au prix d'un
  poste qui reste ouvert sur des dossiers médicaux.

## Conséquences

- La fenêtre d'un an est un compromis assumé au profit du fonctionnement hors
  ligne : un appareil compromis conserve son accès jusqu'à l'expiration.
- **Aucun mécanisme de révocation de session patient n'existe côté serveur.**
  La vérification du token ne consulte aucun état, et la révocation des codes ne
  concerne que les codes jamais consommés. Ce manque est traité par SEC-03 ; tant
  qu'il n'est pas comblé, la seule invalidation possible est la rotation de la
  clé JWT ([0022](0022-faire-tourner-les-secrets-de-production-tous-les-90-jours.md)),
  qui déconnecte tous les patients à la fois.
