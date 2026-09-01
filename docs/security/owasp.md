# Sécurité - OWASP

Créé le 2026-08-31 · Dernière revue : -

> Se remplit **feature par feature**, pas au démarrage.
> États : `fait` · `non applicable` · `à faire`

## Web - OWASP Top 10:2025

> ⚠️ Vérifier la version en cours sur https://owasp.org/Top10/ avant tout
> usage en livrable.

| # | Point | État | Où c'est traité |
|---|---|---|---|
| A01 | Broken Access Control (inclut SSRF) | fait | Vérifié par `apps/backend/tests/routesProtegees.test.ts`, qui parcourt la table de routage réelle de l'application montée en entier : toute route répond 401 sans identifiants, ou figure dans une liste explicite de routes publiques. Une route non déclarée fait échouer la suite (SEC-01, SEC-02, SEC-04) |
| A02 | Security Misconfiguration | à faire | |
| A03 | Software Supply Chain Failures | à faire | |
| A04 | Cryptographic Failures | à faire | |
| A05 | Injection | à faire | |
| A06 | Insecure Design | à faire | |
| A07 | Authentication Failures | fait | `shared/middleware/patientAuthMiddleware.ts` relit le code porteur à chaque requête (401 `SESSION_REVOKED`) · `DELETE /patients/{id}/session` coupe la session · [ADR 0023](../adr/0023-couper-une-session-patient-en-revoquant-le-code-porteur.md) |
| A08 | Software or Data Integrity Failures | à faire | |
| A09 | Security Logging & Alerting Failures | à faire | |
| A10 | Mishandling of Exceptional Conditions | à faire | |

## Mobile - OWASP Mobile Top 10

> ⚠️ Vérifier la version en cours sur
> https://owasp.org/www-project-mobile-top-10/ avant tout usage en livrable.

| # | Point | État | Où c'est traité |
|---|---|---|---|
| M1 | Usage impropre des identifiants | à faire | |
| M2 | Sécurité insuffisante de la chaîne d'approvisionnement | à faire | |
| M3 | Authentification / autorisation non sécurisées | à faire | |
| M4 | Validation d'entrée/sortie insuffisante | à faire | |
| M5 | Communication non sécurisée | à faire | |
| M6 | Contrôles de confidentialité insuffisants | à faire | |
| M7 | Protection insuffisante du binaire | à faire | |
| M8 | Mauvaise configuration de sécurité | à faire | |
| M9 | Stockage de données non sécurisé | à faire | |
| M10 | Cryptographie insuffisante | à faire | |

---

## Notes

<!-- Exceptions assumées, points à revoir avant prod -->
