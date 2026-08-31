# 0014 - Exporter les logs d'audit vers S3 par un cron journalier

- **Statut** : Accepté
- **Date** : 2026-08-31

## Contexte

La certification HDS impose de conserver les accès aux données médicales. Pino
([0013](0013-utiliser-pino-comme-logger-backend.md)) écrit dans un fichier
local, qui disparaît avec le conteneur et ne constitue donc pas une
conservation.

## Décision

Un cron journalier exporte les logs d'audit du fichier local vers un bucket
`logs-audit` en object storage.

## Alternatives écartées

- **Écriture directe en S3 à chaque requête** - aucune fenêtre de perte, mais
  place un appel réseau sur le chemin de chaque requête, et fait dépendre l'API
  de la disponibilité du stockage.
- **Conserver uniquement le fichier local** - sans coût, mais les journaux
  disparaissent avec le conteneur : l'obligation de conservation n'est pas
  remplie.

## Conséquences

- En développement, le bucket `logs-audit` est servi par MinIO
  ([0011](0011-utiliser-minio-en-developpement-pour-l-api-s3.md)) ; en
  production par OVH Object Storage, certifié HDS, avec une rétention d'un an.
- Le même client S3 sert dans les deux cas : seules les variables
  d'environnement changent.
- L'export étant journalier, les journaux produits depuis le dernier passage du
  cron sont perdus si le conteneur disparaît entre-temps.
