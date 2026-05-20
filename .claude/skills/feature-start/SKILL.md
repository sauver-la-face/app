---
name: feature-start
description: Démarre une nouvelle feature selon le workflow Git obligatoire du projet (git checkout dev, pull, création de branche feature/XXX-00-nom)
disable-model-invocation: false
---

Demande à l'utilisateur l'identifiant et le nom de la feature à démarrer.
Exemples d'identifiants : AUTH-01, SYNC-01, MOB-03, WEB-01, DEVOPS-02

Format attendu de la branche : `feature/XXX-00-nom-court`
Exemples : `feature/AUTH-01-jwt-patients`, `feature/MOB-03-questionnaire-offline`

Une fois l'info obtenue, exécute dans l'ordre :

1. `git checkout dev`
2. `git pull origin dev`
3. `git checkout -b feature/[ID]-[nom]`

Confirme la branche créée et rappelle que :
- La PR sera créée vers `dev` uniquement quand la feature est **terminée et testée**
- Le statut dans `features.md` passera automatiquement de `[ ]` à `[~]` via GitHub Actions dès la création de la branche
