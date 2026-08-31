[← README](../README.md) · [Architecture](architectureAdr.md) · [ADR](adr/README.md) · [Onboarding](onboarding.md) · [CDC](cdc.md)

# Accessibilité — Sauver la Face

> Référentiel retenu, périmètre de vérification, conformité mesurée et standard
> des cibles tactiles. Les décisions techniques sont dans [`docs/adr/`](adr/README.md),
> la description du système dans [architectureAdr.md](architectureAdr.md).

---

> Compétence **C2.2.3** — critères 2 (référentiel choisi et justifié) et 3 (conformité mesurée).
> À rapprocher du critère 1 (OWASP Top 10), traité dans la section [Sécurité](architectureAdr.md#sécurité) de la doc d'architecture.

## Référentiel choisi : WCAG 2.2, niveau AA

| Choix | Justification |
|---|---|
| **WCAG plutôt qu'un référentiel national** | Le projet est déployé au **Cambodge**, qui n'a pas de cadre légal d'accessibilité numérique national. WCAG est la norme **internationale** du W3C, indépendante de toute juridiction — c'est précisément parce qu'elle n'est liée à aucun pays qu'elle s'applique ici. (Un référentiel national comme le RGAA français n'aurait aucune portée au Cambodge.) |
| **Version 2.2** (et non 2.1) | Version stable la plus récente (W3C, octobre 2023). Elle ajoute des critères pertinents pour une application **mobile** : 2.4.11 *Focus non masqué*, 2.5.7 *Mouvements de glissement*, 2.5.8 *Taille de la cible (minimum)*. |
| **Niveau AA** (et non A ou AAA) | AA est le niveau de référence reconnu internationalement et atteignable en pratique. AAA impose des contraintes disproportionnées pour ce produit (ex : contraste 7:1, alternative en langue des signes). |

## Pourquoi l'accessibilité est centrale ici, pas optionnelle

L'application patient s'adresse à des Cambodgiens en suivi post-opératoire, dont une partie
a une **faible littératie**. L'interface patient est **pictographique et bilingue
(français / khmer)** par conception : l'accessibilité n'est pas une couche ajoutée en fin de
projet mais le fondement même de l'utilisabilité du produit.

| Type de handicap / besoin | Critère WCAG 2.2 concerné | Réponse dans le produit |
|---|---|---|
| Faible littératie / cognitif | 3.1 Lisibilité · 1.1.1 Contenu non textuel | Pictogrammes standardisés (voir MED-01), langage simplifié, bilingue FR/Khmer |
| Déficience visuelle (basse vision) | 1.4.3 Contraste minimum (AA) · 1.4.4 Redimensionnement du texte | Contrastes mesurés (voir ci-dessous), texte redimensionnable |
| Daltonisme | 1.4.1 Utilisation de la couleur | L'information critique (alertes médicales) n'est **jamais** portée par la seule couleur — toujours doublée d'un pictogramme ou d'un texte |
| Motricité fine réduite (usage mobile) | 2.5.8 Taille de la cible (AA, nouveau en 2.2) | Cibles tactiles dimensionnées pour le mobile |

## Périmètre et méthode de vérification

| Surface | Technologie | Vérification |
|---|---|---|
| Dashboard médecin | Next.js (web) | **Audit automatisé axe-core** + mesure de contrastes |
| Application patient | Expo / React Native (Android) | Accessibilité pictographique par conception ; test lecteur d'écran **TalkBack** manuel (non automatisable) |

> Honnêteté méthodologique : l'audit automatisé couvre le dashboard web. Le test au lecteur
> d'écran mobile relève d'une vérification manuelle sur device réel, documentée séparément.

## Conformité mesurée (critère 3)

Pour **prouver** la conformité du prototype — et non l'affirmer — la démarche suivie est
**mesurer → corriger → re-mesurer**.
Un audit automatisé a été réalisé sur les trois pages clés du dashboard ; chaque violation
détectée a été corrigée dans le code, puis une seconde mesure a validé la correction. Les
tableaux ci-dessous présentent, dans l'ordre, l'état initial mesuré, les violations trouvées,
les corrections apportées et l'état final re-mesuré.

- **Méthode** : audit **Lighthouse** (catégorie Accessibilité, propulsée par axe-core) exécuté sur Chrome headless, sur les pages clés du dashboard. Chaque violation est mappée au critère WCAG 2.2 exact. Mesures reproductibles via `bunx lighthouse <url> --only-categories=accessibility`.
- **Date de l'audit** : 2026-07-23 · outil : Lighthouse 12.2.1 / axe-core 4.10.

### Scores par page (avant correction)

| Page | Score accessibilité | Violations |
|---|---|---|
| `/fr/patients` (liste) | **100 / 100** | aucune |
| `/fr/dashboard` | 95 / 100 | 1 (contraste) |
| `/fr/login` | 92 / 100 | 3 (2 contraste, 1 taille de cible) |

### Violations détectées

| Page | Critère WCAG 2.2 | Élément | Mesure | Attendu |
|---|---|---|---|---|
| login | 1.4.3 Contraste (AA) | Bouton de connexion (texte blanc sur `#2EAC8E`) | 2.83:1 | ≥ 4.5:1 |
| login | 1.4.3 Contraste (AA) | Texte d'aide `text-gray-400` (`#9ca3af` sur blanc) | 2.53:1 | ≥ 4.5:1 |
| login | 2.5.8 Taille de la cible (AA, **nouveau en 2.2**) | Bouton « afficher le mot de passe » | 20×20 px | ≥ 24×24 px |
| dashboard | 1.4.3 Contraste (AA) | Libellé `text-gray-400` (`#9ca3af` sur blanc) | 2.53:1 | ≥ 4.5:1 |

> Le critère **2.5.8** (taille de cible) est un ajout de WCAG 2.2 : sa détection confirme
> l'intérêt d'avoir choisi la 2.2 plutôt que la 2.1.

### Corrections apportées

| Violation | Correction | Résultat mesuré |
|---|---|---|
| Contraste bouton (blanc sur `#2EAC8E`, 2.83:1) | Vert de marque assombri en `#178064` (remplacé sur les 17 occurrences en dur) | **4.87:1** ✅ |
| Contraste texte `text-gray-400` (2.53:1) | Passé en `text-gray-500` (`#6b7280`) | **4.87:1** ✅ |
| Taille de cible bouton mot de passe (20×20 px) | Agrandi à 28×28 px (`h-7 w-7` + centrage flex) | **28×28 px** ✅ |

### Résultat après correction

| Page | Score avant | Score après |
|---|---|---|
| `/fr/patients` | 100 / 100 | 100 / 100 |
| `/fr/dashboard` | 95 / 100 | **100 / 100** ✅ |
| `/fr/login` | 92 / 100 | **100 / 100** ✅ |

Les trois pages du dashboard atteignent **100/100** sur la catégorie Accessibilité de
Lighthouse, sans aucune violation WCAG 2.2 A/AA détectée.

> Réserve honnête : Lighthouse/axe couvre les vérifications **automatisables** (~40 % des
> critères WCAG). Les critères non automatisables (ordre de tabulation logique, pertinence
> des textes alternatifs, navigation complète au lecteur d'écran) relèvent d'une vérification
> manuelle et ne sont pas couverts par ce score. Le test mobile TalkBack reste également à
> réaliser sur device réel.

## Cibles tactiles sur mobile — standard 48×48 dp

Deux normes coexistent selon la surface, et il ne faut pas les confondre :

| Surface | Norme | Cible minimale |
|---|---|---|
| Dashboard web | WCAG 2.5.8 (AA) | 24 × 24 CSS px |
| Application mobile (Android) | Material Design / bonnes pratiques Android | **48 × 48 dp** |

Le `dp` (*density-independent pixel*) est l'unité Android ; 48 dp est le seuil de confort
tactile recommandé, plus strict que le minimum WCAG web. **Règle de code établie** : toute
cible tactile de l'app mobile (`Pressable`, `TouchableOpacity`, boutons, icônes cliquables)
doit mesurer **au moins 48 × 48 dp** de zone cliquable — au besoin via `hitSlop` ou du
padding, sans réduire la zone visible. Règle reportée dans `CLAUDE.md` (section Règles mobile).

> État actuel : l'app mobile ne contient pas encore d'UI interactive (seule la logique i18n
> est implémentée). Il n'y a donc aucune cible tactile à auditer aujourd'hui — la règle
> 48 × 48 dp est **définie en amont** pour être respectée dès le premier composant tactile.
> Affirmer une conformité mesurée sur une UI inexistante n'aurait aucune valeur de preuve.

## Synthèse — preuve de conformité au référentiel (critère 3)

| Exigence du référentiel | Surface | Méthode de preuve | Statut |
|---|---|---|---|
| Contraste texte/fond ≥ 4.5:1 (WCAG 1.4.3 AA) | Dashboard web | Mesure Lighthouse/axe, avant/après | ✅ **Vérifié conforme** (100/100) |
| Taille de cible ≥ 24 px (WCAG 2.5.8 AA) | Dashboard web | Mesure Lighthouse + inspection code | ✅ **Vérifié conforme** (28×28 px) |
| Absence de violation WCAG 2.2 A/AA automatisable | Dashboard web | Audit Lighthouse (login, dashboard, patients) | ✅ **Vérifié conforme** (3 pages à 100/100) |
| Taille de cible tactile ≥ 48 dp (Material) | App mobile | Règle de code établie ([CLAUDE.md](../CLAUDE.md)) | 🟡 **Standard défini** — UI mobile pas encore développée |
| Navigation au lecteur d'écran (TalkBack) | App mobile | Test manuel sur device réel | 🟡 **À réaliser** — nécessite UI mobile + device |
| Critères WCAG non automatisables (tabulation, alt, structure) | Dashboard web | Revue manuelle | 🟡 **À compléter** — hors périmètre de l'audit automatisé |

**Lecture de la preuve** : le prototype **implémenté et auditable** (le dashboard web) répond
aux exigences du référentiel WCAG 2.2 AA sur l'ensemble des critères automatiquement
vérifiables — mesuré, corrigé, re-mesuré. Les lignes en 🟡 ne sont pas des non-conformités du
prototype existant mais des exigences **dont le périmètre (mobile, manuel) n'est pas encore
implémenté ou automatisable** ; le standard applicable y est défini par avance.

## Conclusion

Le prototype implémenté et auditable répond aux exigences du référentiel WCAG 2.2 AA sur
l'ensemble des critères automatiquement vérifiables, avec une démarche mesurée, corrigée et
re-mesurée, appuyée sur des rapports archivés. Les exigences restantes (application mobile,
tests manuels au lecteur d'écran) ne constituent pas des non-conformités du prototype
existant, mais des vérifications dont le périmètre n'est pas encore implémenté — et pour
lesquelles le standard applicable (48 × 48 dp sur mobile, revue manuelle des critères non
automatisables) est défini par avance dans les conventions de code du projet.
