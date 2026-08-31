# Documentation - sauverLaFace-DOCS-02

| Fichier | Quand l'ouvrir |
|---|---|
| `architecture.md` | Au démarrage, puis à chaque fin de phase |
| `security/owasp.md` | À chaque feature touchant auth / données / entrées |
| `adr/` | À chaque décision technique structurante |

## Les dossiers cachés

Trois dossiers commencent par un point : `ls` ne les montre pas, mais ils sont
commités et ils travaillent.

| Dossier | Pourquoi il existe |
|---|---|
| `.ci/` | Le script de vérification du CHANGELOG. Ce n'est pas une convention, c'est un choix de ce projet : le script est appelé à l'identique par GitHub et par GitLab, donc le loger dans le dossier de l'une l'aurait rendu inutilisable pour l'autre. |
| `.github/` ou `.gitlab/` | Imposés par la forge, qui ne lit que ces chemins exacts : template de PR/MR, et job CI qui fait échouer la fusion si le CHANGELOG n'a pas bougé. |

La vérification se lance aussi à la main, avant de pousser :

```bash
bash .ci/check-changelog.sh main
```

Pour une PR qui ne mérite pas d'entrée — typo, refacto sans effet visible — le
job se saute avec le label `skip-changelog`.

Créé le 2026-08-31
