# Photos de démonstration

Dossier optionnel, lu par `scripts/seedDemo.ts`.

- **Vide** (cas par défaut) → le seed génère des visuels de remplacement légendés
  (SVG), qui indiquent clairement qu'il ne s'agit pas de photos réelles.
- **Contient des images** (`.jpg`, `.jpeg`, `.png`, `.webp`) → le seed les utilise
  à la place, dans l'ordre alphabétique, en boucle si elles sont moins nombreuses
  que les 8 photos de la chronologie.

Nommer les fichiers pour contrôler l'ordre : `01-face-j1.jpg`, `02-face-j3.jpg`, etc.

## Avant d'y déposer de vraies photos

Ces fichiers ne doivent **jamais** être commités : ce sont des données de santé au
sens du RGPD, même sur un jeu de démonstration. Le `.gitignore` de ce dossier les
exclut déjà — vérifier avec `git status` avant tout commit.

Pour une démonstration publique, préférer des images ne permettant aucune
ré-identification, avec le consentement écrit correspondant.
