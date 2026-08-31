#!/usr/bin/env bash
set -Eeuo pipefail
# ============================================================================
# nouvel-adr.sh - crée un ADR numéroté et l'inscrit dans l'index
#
# Usage : bash docs/adr/nouvel-adr.sh "Utiliser Postgres plutôt que Mongo"
#
# Fait le mécanique et rien d'autre : numéro suivant, nom de fichier, titre,
# date, statut Proposé, ligne dans README.md. Les quatre sections restent
# vides - un ADR consigne un arbitrage réel, et personne d'autre que toi ne
# sait ce qui a été écarté ni pourquoi.
#
# Rien ne le lance automatiquement. Il s'appelle au moment où une décision
# vient d'être tranchée : aucun diff ne permet de détecter ce moment-là.
# ============================================================================

# ----------------------------------------------------------------------------
# Où vit le script - et donc où vivent son modèle et son index
# Même boucle que init-project.sh : BASH_SOURCE contient le chemin d'appel et
# non la cible, et readlink -f est une extension GNU absente des macOS anciens.
# ----------------------------------------------------------------------------
src="${BASH_SOURCE[0]}"
while [ -L "$src" ]; do
  dir=$(cd -P "$(dirname "$src")" && pwd)
  src=$(readlink "$src")
  case "$src" in /*) ;; *) src="$dir/$src" ;; esac
done
ADR_DIR=$(cd -P "$(dirname "$src")" && pwd)

MODELE="$ADR_DIR/0000-template.md"
INDEX="$ADR_DIR/README.md"

TITRE="${1:-}"
if [ -z "$TITRE" ]; then
  echo "⚠️  Il manque le titre de la décision."
  echo ""
  echo "   bash docs/adr/nouvel-adr.sh \"Utiliser Postgres plutôt que Mongo\""
  echo ""
  echo "   Le titre est celui de la décision, pas du problème : une phrase à"
  echo "   l'indicatif, lisible seule dans l'index dans six mois."
  exit 1
fi

if [ ! -f "$MODELE" ]; then
  echo "⚠️  Modèle introuvable : $MODELE"
  echo "    Le script lit 0000-template.md à côté de lui - il doit rester dans docs/adr/."
  exit 1
fi
if [ ! -f "$INDEX" ]; then
  echo "⚠️  Index introuvable : $INDEX"
  exit 1
fi

# ----------------------------------------------------------------------------
# Le slug du nom de fichier
#
# Accents dépliés à la main plutôt qu'avec iconv, absent de certaines images
# minimales, et en awk plutôt qu'en sed dont l'option -i diffère entre BSD et
# GNU. Le dépliage précède tolower() : sans ça, un É resterait tel quel.
# ----------------------------------------------------------------------------
slug=$(printf '%s' "$TITRE" | awk '
  {
    s = $0
    gsub(/À|Â|Ä|Á|Ã|Å/, "A", s); gsub(/à|â|ä|á|ã|å/, "a", s)
    gsub(/Ç/, "C", s);            gsub(/ç/, "c", s)
    gsub(/È|É|Ê|Ë/, "E", s);      gsub(/è|é|ê|ë/, "e", s)
    gsub(/Î|Ï|Í|Ì/, "I", s);      gsub(/î|ï|í|ì/, "i", s)
    gsub(/Ô|Ö|Ó|Ò|Õ/, "O", s);    gsub(/ô|ö|ó|ò|õ/, "o", s)
    gsub(/Ù|Û|Ü|Ú/, "U", s);      gsub(/ù|û|ü|ú/, "u", s)
    gsub(/Ý|Ÿ/, "Y", s);          gsub(/ý|ÿ/, "y", s)
    gsub(/Ñ/, "N", s);            gsub(/ñ/, "n", s)
    gsub(/Æ/, "AE", s);           gsub(/æ/, "ae", s)
    gsub(/Œ/, "OE", s);           gsub(/œ/, "oe", s)
    s = tolower(s)
    gsub(/[^a-z0-9]+/, "-", s)
    gsub(/^-+|-+$/, "", s)
    print s
  }')

if [ -z "$slug" ]; then
  echo "⚠️  Ce titre ne donne aucun nom de fichier utilisable : « $TITRE »"
  echo "    Il faut au moins une lettre ou un chiffre."
  exit 1
fi

# ----------------------------------------------------------------------------
# Le numéro suivant
#
# Le plus grand NNNN présent, plus un. 0000-template.md entre dans le calcul
# sans conséquence : il vaut zéro. Le préfixe 10# force la base décimale, sans
# quoi 0008 et 0009 seraient lus comme de l'octal invalide.
# ----------------------------------------------------------------------------
max=0
for f in "$ADR_DIR"/[0-9][0-9][0-9][0-9]-*.md; do
  [ -e "$f" ] || continue
  n=$((10#$(basename "$f" | cut -c1-4)))
  if [ "$n" -gt "$max" ]; then max=$n; fi
done
NUM=$(printf '%04d' $((max + 1)))

CIBLE="$ADR_DIR/$NUM-$slug.md"

# Un ADR portant déjà ce titre est presque toujours une relance par erreur.
# On refuse plutôt que d'écraser : le fichier existant contient du texte que
# personne d'autre ne peut réécrire.
for f in "$ADR_DIR"/[0-9][0-9][0-9][0-9]-"$slug".md; do
  if [ -e "$f" ]; then
    echo "⚠️  Un ADR porte déjà ce titre : $(basename "$f")"
    echo "    Rien n'a été créé. Choisis un autre titre, ou édite celui-là."
    exit 1
  fi
done

TODAY=$(date +%Y-%m-%d)

# ----------------------------------------------------------------------------
# Deux écritures, donc un rollback
# Un ADR absent de l'index est pire qu'un ADR non créé : il ne se voit pas.
# ----------------------------------------------------------------------------
rollback() {
  echo "❌ Échec ligne $1 : $2"
  if [ -f "$CIBLE" ]; then
    rm -f "$CIBLE" && echo "   supprimé : $(basename "$CIBLE")"
  fi
  echo "↩️  Rien n'a été créé."
  exit 1
}
trap 'rollback $LINENO "$BASH_COMMAND"' ERR

awk -v titre="$TITRE" -v num="$NUM" -v jour="$TODAY" '
  NR == 1 { print "# " num " - " titre; next }
  /^- \*\*Statut\*\* :/ { print "- **Statut** : Proposé"; next }
  /^- \*\*Date\*\* :/   { print "- **Date** : " jour; next }
  { print }
' "$MODELE" > "$CIBLE"

# ----------------------------------------------------------------------------
# La ligne d'index, après la dernière ligne du tableau
#
# L'ancre est `| [`, le début d'une ligne de tableau : le tableau peut être
# suivi de texte, et ajouter en fin de fichier casserait le rendu.
# ----------------------------------------------------------------------------
LIGNE="| [$NUM]($NUM-$slug.md) | $TITRE | Proposé | $TODAY |"
tmp=$(mktemp)
awk -v ligne="$LIGNE" '
  { l[NR] = $0; if ($0 ~ /^\| \[/) dernier = NR }
  END {
    for (i = 1; i <= NR; i++) {
      print l[i]
      if (i == dernier) print ligne
    }
    if (dernier == 0) { print ""; print ligne }
  }
' "$INDEX" > "$tmp"
mv "$tmp" "$INDEX"

trap - ERR

echo "✅ docs/adr/$NUM-$slug.md - créé (Proposé)"
echo "   docs/adr/README.md - ligne ajoutée au tableau"
echo ""
echo "💡 Reste à remplir : Contexte, Décision, Alternatives écartées, Conséquences."
echo "   « Alternatives écartées » est la section qui vaudra le plus dans six mois."
