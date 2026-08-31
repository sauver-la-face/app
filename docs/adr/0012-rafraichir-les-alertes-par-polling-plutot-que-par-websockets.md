# 0012 - Rafraîchir les alertes par polling plutôt que par WebSockets

- **Statut** : Accepté
- **Date** : 2026-08-31

## Contexte

Le dashboard affiche les alertes patients et doit refléter leur évolution sans
que le médecin rafraîchisse la page. Le dimensionnement du projet est connu :
200 patients actifs et 20 médecins au maximum.

## Décision

Le dashboard interroge périodiquement l'API plutôt que de maintenir une
connexion ouverte. Le polling est géré par TanStack Query.

## Alternatives écartées

- **WebSockets** - poussent la mise à jour sans délai, mais imposent une
  connexion persistante à maintenir, à reconnecter et à sécuriser. Le volume en
  jeu ne justifie pas cette complexité.

## Conséquences

- Le rafraîchissement s'obtient par `refetchInterval`, en une ligne.
- La surface d'attaque reste celle de l'API HTTP existante, sans canal
  supplémentaire.
- Le comportement est simple à déboguer et à reproduire.
- Le coût des requêtes répétées est absorbé par un ETag : le backend calcule une
  empreinte des alertes actives et répond `304 Not Modified` sans corps quand
  rien n'a changé, TanStack Query conservant alors son cache.
- Une alerte n'apparaît qu'au prochain intervalle : la latence est bornée par
  celle-ci, jamais nulle.
