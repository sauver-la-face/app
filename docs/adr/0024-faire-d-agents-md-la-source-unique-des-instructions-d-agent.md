# 0024 - Faire d'AGENTS.md la source unique des instructions d'agent

- **Statut** : Accepté
- **Date** : 2026-09-04

## Contexte

Le dépôt portait deux fichiers d'instructions, `AGENTS.md` et `CLAUDE.md`,
dupliqués à environ 90 %. La duplication n'était pas le vrai problème : la
divergence l'était.

Les deux fichiers se contredisaient sur le workflow Git. `CLAUDE.md` imposait un
git worktree isolé par feature et interdisait de développer sur `dev`.
`AGENTS.md` décrivait un `git checkout dev && git checkout -b`, donc un
développement dans le clone principal. Selon le fichier lu, un assistant ne
recevait pas la même consigne, et la version d'`AGENTS.md` faisait changer de
branche un répertoire que dix-sept worktrees actifs partagent avec d'autres
sessions.

Trois éléments n'existaient par ailleurs que dans `CLAUDE.md` : la règle
d'accessibilité des cibles tactiles à 48 x 48 dp, la clôture du workflow
worktree, et deux commandes.

## Décision

`AGENTS.md` porte les instructions du projet. `CLAUDE.md` l'importe par
`@AGENTS.md` et n'accueille que ce qui serait faux pour un assistant autre que
Claude Code.

Le workflow worktree est retenu comme version unique, avec son motif désormais
écrit : plusieurs sessions coexistent, changer de branche dans le clone
principal casse le travail des autres.

## Alternatives écartées

- **Maintenir les deux fichiers synchronisés à la main.** C'était l'état
  d'origine, et c'est précisément ce qui a produit la divergence : une règle
  modifiée d'un côté ne l'est pas de l'autre, et rien ne le signale.
- **Inverser le sens de l'import, `CLAUDE.md` source et `AGENTS.md`
  importateur.** `AGENTS.md` est la convention interopérable, lue par plusieurs
  outils ; `CLAUDE.md` est propre à un seul. Faire dépendre le fichier partagé
  du fichier particulier inverse la dépendance naturelle.
- **Un lien symbolique entre les deux.** Invisible dans un diff GitHub, qui
  afficherait un fichier d'une ligne, et fragile sous Windows où il réclame un
  réglage global.

## Conséquences

- Une seule source à modifier. Écrire une règle projet dans `CLAUDE.md` devient
  une erreur, ce que le fichier énonce lui-même.
- Rien de propre à un assistant n'entre dans `AGENTS.md`. La mention du skill
  `/feature-start` y a été retirée pour cette raison : elle désigne quelque
  chose qui n'existe pas pour les autres lecteurs, et le skill s'annonce de
  lui-même auprès de celui qui peut s'en servir.
- Un lecteur humain qui ouvre `CLAUDE.md` seul ne voit plus les règles mais un
  renvoi, ce qui suppose qu'il le suive.
- L'import `@fichier` est une fonctionnalité de Claude Code. Un outil qui ne la
  comprend pas lit neuf lignes au lieu des règles. Le risque est accepté : ces
  outils lisent `AGENTS.md`, qui reste complet.
