# 0019 - Restreindre l'unicité des codes patient par des index partiels

- **Statut** : Accepté
- **Date** : 2026-08-31

## Contexte

Un code d'accès patient tient sur six chiffres, soit un million de valeurs
possibles. Deux patients ne doivent jamais porter le même code utilisable en
même temps, mais un code doit pouvoir être réattribué un jour, sans quoi
l'espace des codes s'épuise à mesure que le projet vit.

## Décision

L'unicité est portée par des index partiels, dont le prédicat définit
exactement ce qui compte comme « code encore utilisable » :

- `patient_code_code_active_unique` sur `code`, `WHERE deleted_at IS NULL AND revoked_at IS NULL`
- `patient_code_patient_active_unique` sur `uuid_patient`, `WHERE is_active = true AND used_at IS NULL AND deleted_at IS NULL AND revoked_at IS NULL` - un seul code actif non consommé par patient

## Alternatives écartées

- **Unicité globale sur `code`, sans prédicat** - garantit l'absence de
  collision, mais bloque définitivement chaque code émis : l'espace des six
  chiffres ne se libère jamais.
- **Ajouter `used_at IS NULL` au prédicat du premier index** - ferait sortir de
  l'unicité tout code consommé. Or un code consommé est précisément celui qui
  porte une session ouverte : ses six chiffres pourraient être réattribués à un
  autre patient alors qu'ils sont encore en service. Écarté délibérément.

## Conséquences

- `deleted_at` et `revoked_at` sont les deux seules colonnes qui font sortir un
  code de l'unicité, et donc les deux seules qui autorisent la réattribution de
  ses six chiffres.
- Toute évolution de la révocation doit intégrer cet effet de bord : poser
  `revoked_at` sur un code consommé libère ses chiffres pour un autre patient.
- La même technique sert ailleurs pour la performance et non pour l'unicité :
  `instructions_unread_idx`, `WHERE acknowledged_at IS NULL`, restreint l'index
  aux seules lignes que le polling des instructions non lues interroge.
