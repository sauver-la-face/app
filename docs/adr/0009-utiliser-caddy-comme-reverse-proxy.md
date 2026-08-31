# 0009 - Utiliser Caddy comme reverse proxy

- **Statut** : Accepté
- **Date** : 2026-08-31

## Contexte

Les données de santé imposent TLS 1.3, au titre du RGPD et de la certification
HDS. Le backend Hono ne termine jamais le TLS lui-même : il faut un reverse
proxy en frontal, seul composant exposé à Internet, et il doit fonctionner
aussi bien en développement qu'en production.

## Décision

On utilise Caddy comme reverse proxy et unique terminaison TLS.

## Alternatives écartées

- **Nginx** - éprouvé et omniprésent, mais demande une trentaine de lignes de
  configuration pour le même résultat, et le renouvellement des certificats est
  à outiller séparément.
- **Traefik** - conçu pour Docker, mais la configuration passe par des labels
  répartis sur les services, plus difficiles à relire d'un bloc.

## Conséquences

- TLS 1.3 est actif par défaut, sans configuration à écrire ni à maintenir.
- Les certificats Let's Encrypt sont obtenus et renouvelés automatiquement.
- En développement, un certificat auto-signé s'obtient par une seule directive
  (`tls internal`).
- La configuration tient en trois lignes.
- Caddy est un point de passage unique : son indisponibilité rend l'API
  totalement injoignable.
