# Architecture - les six piliers

Créé le 2026-08-31 · Dernière revue : -

> Une réponse par pilier. « Non applicable » et « à décider » sont des
> réponses valides - à condition d'être écrites, avec leur motif. Un pilier
> écarté pour une raison explicite est un pilier traité ; un pilier vide, non.

---

## 1. Fiabilité

*Combien de temps l'appli a-t-elle le droit d'être indisponible ?
Que se passe-t-il quand une dépendance externe tombe ?
Comment on restaure, et depuis quoi ?*

- **Exigence** (chiffrée) :
- **Comment on y répond** (mécanisme + où dans le code) :
- **Ce qu'on ne fait pas** :

---

## 2. Sécurité

*Qui a le droit de faire quoi ? Où sont les données sensibles ?
Quelles contraintes réglementaires s'appliquent ?*

- **Exigence** :
- **Comment on y répond** :
- **Ce qu'on ne fait pas** :

> Détail des dix points de référence : voir `security/owasp.md`.

---

## 3. Excellence opérationnelle

*Comment je saurai que ça casse en prod, et en combien de temps ?
Comment on déploie, et comment on revient en arrière ?
Qui reprend ce code dans six mois, et qu'est-ce qui va le bloquer ?*

- **Exigence** :
- **Comment on y répond** :
- **Ce qu'on ne fait pas** :

---

## 4. Efficacité des performances

*Combien d'utilisateurs et de données au lancement ? Dans un an ?
Quel temps de réponse acceptable, et sur quel parcours ?
Qu'est-ce qui casse en premier quand ça monte ?*

- **Exigence** :
- **Comment on y répond** :
- **Ce qu'on ne fait pas** :

---

## 5. Optimisation des coûts

*Combien ça coûte par mois ? Qu'est-ce qui fait exploser la facture ?
Quel est le budget, et qui le valide ?*

- **Exigence** :
- **Comment on y répond** :
- **Ce qu'on ne fait pas** :

---

## 6. Sobriété

*Qu'est-ce qui tourne alors que personne ne s'en sert ?
Quelles données on garde, et pendant combien de temps ?
Y a-t-il une contrainte d'écoconception - référentiel, marché public,
engagement RSE - ou bien on écrit qu'il n'y en a pas ?*

- **Exigence** :
- **Comment on y répond** :
- **Ce qu'on ne fait pas** :
