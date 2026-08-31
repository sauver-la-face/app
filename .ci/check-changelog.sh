#!/usr/bin/env bash
set -Eeuo pipefail
# Vérifie que CHANGELOG.md fait partie des fichiers modifiés par la PR/MR.
#
# Usage : bash .ci/check-changelog.sh <base>
#   base = branche cible (GitHub) ou base de fusion (GitLab)
#
# En local, avant de pousser :  bash .ci/check-changelog.sh main

BASE="${1:?usage: check-changelog.sh <base>}"
BASE_SHA=$(git merge-base "$BASE" HEAD)

if git diff --name-only "$BASE_SHA" HEAD | grep -qx 'CHANGELOG.md'; then
  echo "✅ CHANGELOG.md mis à jour"
else
  echo "❌ CHANGELOG.md non modifié."
  echo "   Ajoute une entrée sous [Non publié], ou pose le label skip-changelog."
  exit 1
fi
