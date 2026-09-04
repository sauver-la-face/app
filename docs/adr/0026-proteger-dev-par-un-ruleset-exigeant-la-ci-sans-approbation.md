# 0026 - Protéger dev par un ruleset exigeant la CI, sans approbation

- **Statut** : Accepté
- **Date** : 2026-09-04

## Contexte

La protection de `dev` exigeait une approbation et n'exigeait aucun check. Elle
réclamait donc une signature que GitHub interdit de se donner à soi-même, sur un
dépôt dont les pull requests récentes ont toutes été mergées sans revue, et
laissait passer une CI rouge. La seule barrière réelle portait sur ce que
personne ne pouvait fournir.

Elle était restée sans effet tant que le dépôt était privé : sur le plan
gratuit, GitHub n'applique la protection de branche qu'aux dépôts publics. Le
passage du dépôt en public, décidé pour donner accès au code à un jury de
certification, l'a activée d'un coup.

Le remplacement de l'approbation par six checks requis a révélé une dépendance
cachée. `feature-in-progress` et `update-feature-status` ne passent pas par une
pull request : ils commitent et poussent directement sur `dev` avec le token de
l'application `sauver-la-face-ci` (voir
[0008](0008-authentifier-les-workflows-github-actions-par-une-github-app.md)).
Une branche protégée par des checks rejette tout push direct, le commit poussé
n'ayant aucun check à présenter. Les deux workflows ont cessé de fonctionner et
les statuts sont restés bloqués.

## Décision

`dev` est protégée par un ruleset `protect-dev` : pull request obligatoire à
zéro approbation, huit checks requis, branche à jour avant merge, suppression et
force-push interdits. L'application `sauver-la-face-ci` y figure comme acteur de
contournement.

La protection classique de `dev` est retirée : les deux mécanismes s'additionnent
sinon dans leur version la plus stricte, et la protection classique continuerait
de rejeter les pushs de l'application.

## Alternatives écartées

- **Garder la protection classique.** Elle n'offre aucun contournement par
  acteur. C'est cette limite qui a cassé les workflows, et rien ne permet de l'y
  corriger.
- **Faire ouvrir une pull request aux workflows au lieu de pousser.** Aucune
  exemption à accorder, mais une pull request de robot par changement de statut,
  avec l'auto-merge à activer et à surveiller. Beaucoup de machinerie pour
  cocher une case.
- **Renoncer aux checks requis.** C'était la seule barrière réelle sur `dev`,
  l'approbation n'ayant jamais été applicable.
- **Poser les statuts à la main.** Le job `Entrée de suivi` bloque déjà
  l'essentiel, mais on perdrait toute l'automatisation pour éviter une exemption
  étroite.

## Conséquences

- `sauver-la-face-ci` peut écrire sur `dev` sans pull request ni check. Ses
  permissions se limitent à `contents: write` et `metadata: read` : elle ne peut
  ni modifier les réglages, ni lire les secrets, ni administrer le dépôt.
- Le périmètre réel de l'exemption n'est pas « les deux workflows » mais « tout
  ce qui peut lire `APP_PRIVATE_KEY` ». Ce secret est accessible à n'importe
  quel workflow déclenché depuis une branche du dépôt. Les pull requests issues
  d'un fork n'y ont pas accès.
- La pull request redevient obligatoire sur `dev`, ce qu'elle n'était plus
  depuis le retrait de l'approbation : seuls les checks l'imposaient encore, par
  effet de bord.
- `Images Docker (cibles prod)` devient requis sur `dev` et non plus seulement
  sur les pull requests vers `master`. Chaque pull request est plus longue, mais
  une régression d'image est arrêtée à l'intégration au lieu d'être découverte
  au moment d'une release.
- L'exemption reste nécessaire tant que le statut des features vit dans un
  fichier de `dev`. La déplacer vers un label ou un projet GitHub la rendrait
  inutile plutôt que tolérée : c'est la sortie à viser.
