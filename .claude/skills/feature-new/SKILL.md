---
name: feature-new
description: Spécifie une nouvelle feature dans .ai/features.md, amène l'entrée sur dev par une PR, puis démarre le worktree de travail
disable-model-invocation: false
---

Démarre une feature **de zéro** : écrit sa spécification, l'amène sur `dev`,
puis crée le worktree de travail. Si l'entrée `### XXX-00` existe déjà sur `dev`,
ce n'est pas ce skill qu'il faut mais `/feature-start`.

## Pourquoi deux temps

`feature-in-progress` lit `.ai/features.md` **sur `dev`** au moment de la
création de branche, pour poser le statut `[~]`. L'entrée doit donc être sur
`dev` avant que la branche existe. Et comme `dev` n'accepte que des pull
requests, elle ne peut y arriver que par une pull request préalable.

L'ordre n'est pas ajustable : il découle du fait que le statut est un fichier de
la branche d'intégration. Ce skill l'exécute à ta place, il ne le contourne pas.

## Ce qu'il faut obtenir avant de commencer

Demande à l'utilisateur, si ce n'est pas déjà dans sa demande :

- **L'identifiant**, au format `XXX-00`. Vérifie qu'il est libre :
  `grep -c "^### XXX-00" .ai/features.md` doit renvoyer `0`. Pour trouver le
  prochain numéro d'un préfixe :
  `grep -oE "^### PREFIXE-[0-9]+" .ai/features.md | sort -V | tail -1`
- **Le nom court** de la branche, en minuscules avec des tirets
- **La priorité** : 🔴 Critique, 🟡 Majeur ou 🟢 Mineur
- **De quoi rédiger l'entrée** : le problème, ce qui est dans le périmètre, ce
  qui n'y est pas

## Étape 1 : la pull request de spécification

Le véhicule est une branche `chore/`, et c'est délibéré : elle ne déclenche pas
`feature-in-progress` et n'est pas jugée par le job `Entrée de suivi`, qui
exigerait justement l'entrée qu'on est en train de créer.

```bash
git fetch origin dev
git worktree add ../sauverLaFace-[ID]-spec -b chore/[ID]-spec origin/dev
```

Dans ce worktree, écris l'entrée dans `.ai/features.md`, avant la section
`## RÈGLES GLOBALES`. Le titre sépare l'identifiant du libellé par un trait
d'union entouré d'espaces, la même convention que les titres d'ADR. La structure
attendue :

```text
### XXX-00 - Titre à l'infinitif

`[ ]` 🟡 Majeur · `chemin/du/fichier` · `autre/fichier`

**Contexte :**

Le problème, les faits, ce qui l'a rendu visible. Pas la solution.

**Périmètre :**

- [ ] Ce qui est à faire, un item par lot vérifiable

**Règles :**

- Les contraintes que l'implémentation doit respecter, avec leur motif

**Hors périmètre :**

- Ce qui est exclu, et pourquoi
```

Le statut initial est `[ ]`, avec l'espace : c'est ce que `feature-in-progress`
remplacera par `[~]`. La ligne de statut doit se trouver **deux lignes sous le
titre**, les workflows la cherchant à cette position exacte.

Ajoute une entrée dans `CHANGELOG.md` sous `[Non publié]`, section `Ajouté`,
sans quoi le check `verifie` échoue.

Puis :

```bash
git add -A && git commit -m "chore: [ID] entree de suivi"
git push -u origin HEAD
gh pr create --base dev --title "chore: [ID] entrée de suivi" --body "..."
```

## Étape 2 : attendre la CI, puis merger

La CI d'une pull request sans code prend environ une minute.

```bash
gh pr checks [NUMERO] --watch
gh pr merge [NUMERO] --merge
git worktree remove ../sauverLaFace-[ID]-spec
```

**Si un check échoue, arrête-toi et rends la main.** Ne merge jamais en forçant,
ne contourne aucun check, ne pose aucun label pour désactiver une vérification.
Un échec ici signale une erreur dans l'entrée, pas un obstacle à franchir.

## Étape 3 : la branche de travail

Identique à `/feature-start`, une fois l'entrée sur `dev` :

```bash
git fetch origin dev
git worktree add ../sauverLaFace-[ID] -b feature/[ID]-[nom] origin/dev
git -C ../sauverLaFace-[ID] push -u origin HEAD
```

Vérifie que le statut est bien passé à `[~]`, ce qui prouve que la chaîne a
fonctionné :

```bash
gh run list --workflow "Mise à jour statut feature en cours" --limit 1
```

## Confirme à l'utilisateur

- Le numéro de la pull request de spécification et son merge
- Le chemin du worktree de travail : `../sauverLaFace-[ID]`
- Que le statut est passé à `[~]`
- Que la pull request de la feature sera créée quand elle sera terminée et
  testée, pas avant

## Nettoyage après merge

Comme pour `/feature-start` : dès que la pull request ouverte depuis le worktree
de travail est mergée dans `dev`, supprime le worktree sans attendre qu'on te le
demande.

```bash
git worktree remove ../sauverLaFace-[ID]
```

En cas de `Filename too long` ou `Permission denied`, voir la procédure décrite
dans le skill `feature-start` : `core.longpaths` global après confirmation de
l'utilisateur, puis `robocopy /mir` depuis un dossier vide suivi d'un `rmdir` si
le dossier résiste.
