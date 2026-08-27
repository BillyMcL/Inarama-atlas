# Phase A — Audit et plan

Aucun code écrit. Arrêt demandé par le brief §3 : ce rapport attend validation.

Chemins retenus : atlas `D:\Desktop\claude qgis\web` (clone de `BillyMcL/Inarama-atlas`) · lore `D:\Desktop\Univers Inarama`.

---

## 1. Ce que j'ai vérifié

`index.html` (485 lignes) — les affirmations d'architecture du brief sont **exactes**, vérifiées ligne à ligne :

| Affirmation | Constat |
|---|---|
| `CRS.Simple`, W=18764 H=26784 MAXZ=7, `c2ll()` | ✅ l.122, 124, 129 |
| `INARAMA.load(nom, cb)` + cache-busting `INARAMA_BUILD` | ✅ l.104-110 (+ `loadOnce` ajouté cette semaine, garde anti-doublon) |
| Panes royaumes 350 / terres 450 / marqueurs 600 / décor 680 | ✅ l.191, 470, 384 (600 = défaut Leaflet) |
| `lieuxSync` / `revZoom` / `lblRevZoom` | ✅ l.315, 316, 323 |
| Aucun appel réseau externe | ✅ la seule URL du fichier est le namespace SVG |

---

## 2. Inventaire des données — champs **réellement** présents

| Fichier | Poids | Contenu | Propriétés constatées |
|---|---|---|---|
| `lieux.js` | 2 351 Ko | 4 233 Points | `nom` `type` `stat` `zone` `ruine` `etoile5` `couleur` `desc` (4233/4233) · `capitale` 4226 · `niveau` 3710 · `elem` 3472 · `prov_nom` 3268 · `royaume` 3095 · `race` 2855 · `chef_lieu` 474 · `ecole` 4 |
| `royaumes.js` | 314 Ko | 48 features (47 MultiPolygon + 1 sans géométrie) | `n` 48 · `c` 47 · `d` 47 · `lp` 47 · `np` 2 |
| `prov_labels.js` | 202 Ko | 476 entrées (tableau) | `n` · `p` · `d` |
| `provinces.js` | 863 Ko | 6 088 LineString | **aucune** |
| `terres_zones.js` | 1 383 Ko | 3 143 MultiPolygon | `e` |
| `routes.js` | 1 377 Ko | 3 425 LineString | `classe` |
| `routes_mer.js` | 415 Ko | 1 096 LineString | `classe` · `zone` |
| `rivieres_1/2/3.js` | 596 / 1 334 / 2 979 Ko | 2 198 / 5 496 / 14 286 LineString | **aucune** |
| `courants.js` | 1 511 Ko | 4 058 LineString | **aucune** |

---

## 3. Raccordement au lore

Arborescence du lore : 26 `.md` (`cadre/`, `geographie/`, `magie/`, `mythologie/`, `peuples/` + `README` `chronologie` `codex`) et `geographie/data/` (5 JSON : `affinites`, `lieux_existants`, `lieux_nouveaux`, `provinces`, `royaumes`).

| Raccordement voulu (brief §5) | Clé | Faisable ? |
|---|---|---|
| Type de lieu → définition | `type` → `geographie/README.md` §3.1 | ✅ **Oui.** Tableau explicite des 5 types (civil/sanctuaire/academie/guilde/arene) avec leur caractéristique. Ancre nette. |
| Zone → modèle de lecture | `zone` → `geographie/README.md` §0-1 | ✅ Oui, tableau explicite des préfixes H/G/B. |
| Royaume → fiche peuple | nom de royaume → titre dans `peuples/*.md` | ✅ **Oui — 46/48.** Les fiches peuple sont désormais mises au propre, structurées `## Hodolin` / `## Galombar` puis un titre de niveau 3 **par royaume** : ancre directe et propre. Les 2 restants (**Empire Hodolin**, **Empire Galombar**) ne sont pas des royaumes de race — ils relèvent de `peuples/celestes.md` et de `cadre/alliance.md` / `cadre/empire.md` / `cadre/trones.md`. À raccorder à la main dans `liens_lore.js`, ce que le brief prévoit. |
| Élément de terre sauvage → affinité | `e` → `magie/affinites.md` + `geographie/biomes.md` | ⚠️ Probable, non vérifié : je n'ai pas confronté les valeurs de `e` à la nomenclature de `affinites.md`. À faire en Phase C. |
| Lieu / province → article | `id` / `prov` | ❌ **Impossible en l'état** — voir lacune bloquante n° 1. |

`geographie/toponymie.md` est un document de **fabrication de noms** (registres par peuple, morphèmes). Utile pour comprendre, mais §4 dit explicitement que le nom **n'encode ni le type de lieu ni la géographie** : aucun raccordement automatique n'en sortira.

---

## 4. Lacunes constatées

### ✅ ~~BLOQUANT 1~~ → LEVÉ (ré-export fait)

Ré-export effectué **directement depuis le GeoPackage via GDAL**, sans ouvrir QGIS (le gpkg *est* la donnée autoritaire ; ça évite le risque de gel du plugin déjà rencontré).

**Méthode, et pourquoi elle est sûre :**
- Transformation monde → pixel retrouvée **par la mesure et prouvée** avant tout écrit : `px=(x_km−XMIN)/2`, `py=(YMAX−y_km)/2` — écart max **0,5 px** sur les 4 233 lieux, soit exactement l'arrondi entier de l'export d'origine.
- Fidélité de sérialisation vérifiée par **round-trip octet à octet** sur les deux fichiers avant modification : le diff ne contient donc que les champs ajoutés.
- `lieux` : jointure **par nom**, légitime car les 4 234 noms du gpkg sont **uniques** (vérifié).
- `prov_labels` : jointure **géométrique** (point-dans-polygone), car `prov_nom` **n'est pas unique** — 476 provinces pour seulement 396 noms distincts, 71 sans nom, plusieurs homonymes. Résultat : **bijection parfaite** 476 → 476 `prov` distincts (475 par contenance, 1 par proximité).

**Résultat :** `id` sur **4 233/4 233** lieux · `prov` sur **3 423** lieux · `prov` sur **476/476** provinces. Formats conformes (`(HL|GL|BL)\d{4}`, `[HGB]\d{3}`), identifiants tous distincts. Poids : `lieux.js` 2,35 → **2,40 Mo** (+2 %).

Recherche par clé validée en navigateur : `GL3438` → *Abyssarath*.

<details><summary>Ancien libellé du bloquant</summary>

### 🔴 BLOQUANT 1 — Les clés de jointure sont absentes de l'export web

Le brief pose que `id` (`HL0000`) et `prov` (`H050`) sont sacrés et servent de clés entre lore, atlas et jeu. **Or elles ne sont pas dans les données web** :

- `lieux.js` → 16 propriétés, **aucun `id`**
- `prov_labels.js` → `n`, `p`, `d`, **aucun `prov`**
- `provinces.js` → contours seuls, **zéro propriété**
- `royaumes.js` → `n` = le nom, qui **est** la clé : seul raccordement fonctionnel aujourd'hui

Le GeoPackage, lui, les a toutes : **4 234 `id` distincts, 476 `prov`, 47 `royaume`**.

→ **Rien du wiki, de la recherche ni des fiches ne peut être raccordé tant que l'export QGIS → web n'a pas été refait en ajoutant `id` et `prov`.** C'est le préalable à tout le reste.

</details>

### 🟠 Deux incohérences de données remontées (non corrigées)

Débusquées en contrôlant la cohérence entre préfixe d'`id` et champ `zone`. La règle d'or du lore — « le préfixe fait foi sur l'hémisphère » — donne l'`id` gagnant dans les deux cas, mais **l'identité relève du lore, pas de la cartographie** : je n'y touche pas.

| Lieu | Constat |
|---|---|
| **BL3973 « Kalyndros »** | `id` Bandeau et `prov`=**B060** (Bandeau), mais `zone`=**Galombar**. Deux sources sur trois disent Bandeau : c'est `zone` qui décroche. |
| **GL3706 « Ragnrune »** | `id` Galombar, `zone`=**Bandeau**, aucune province pour arbitrer. |

### 🟢 L'écart de comptage est expliqué

4 234 dans le gpkg, **4 233** dans le web : la différence est **GL3726 « Ngazi Vumbi »** (Bukharak, province G079), seule entité **sans géométrie**, donc non exportable. Reste l'incohérence interne du document de lore, qui annonce 4 235 au §1 et 4 234 au §3.1 — à trancher côté lore.

### ✅ ~~BLOQUANT 2 — Les balises n'existent pas~~ → ERREUR DE MA PART, CORRIGÉE

**Les échelons existent bel et bien**, définis dans `README.md` § *Échelons de connaissance*, et employés dans le corpus : **114 balises**. Mon signalement était faux.

Cause unique : **j'auditais l'export daté du 24/07**, antérieur à leur introduction. `cadre/trones.md` — le fichier le plus balisé après `chronologie.md` — n'existe même pas dans ce paquet. (Ma regex, elle, était correcte : elle trouve les 114 balises sur le dépôt à jour. Le problème était la source, pas la méthode.)

**Sémantique — `README.md` fait foi :**

| Balise | Portée |
|---|---|
| `[P]` | **Public** — tous les peuples |
| `[C]` | **Caste** — les Astreli / les Abyssari |
| `[T]` | **Trônes** — souverains en fonction, Rhodaliens gardiens, Observateurs |
| `[R]` | **Cercle restreint** — organe collégial du sommet concerné |
| `[X]` | **Singulier** — un seul être le sait |

**Quatre règles d'emploi, qui contraignent directement le rendu :**

1. **Une affirmation non balisée est un fait du monde** → **aucune pastille par défaut**, jamais de `[P]` implicite.
2. `[P]` ne veut pas dire « vrai », mais « cru par tous ». Façade et vérité peuvent coexister, chacune balisée → le rendu ne doit pas suggérer que la pastille valide l'affirmation.
3. **Asymétrie entre empires** : Hodolin porte `[P] [C] [T] [R]`, Galombar `[P] [C] [T]` seulement → une légende ne peut pas présenter les cinq comme une échelle universelle.
4. **Ce n'est PAS une échelle croissante** : « à Hodolin, `[R]` contient `[T]` » → **interdit de coder les cinq en dégradé d'intensité** (plus foncé = plus secret). Cinq pastilles distinctes, pas une rampe. C'est le piège de rendu le plus facile à commettre.

**Emploi réel mesuré — 114 balises :**

| | | |
|---|---|---|
| `[X]` 33 · `[P]` 32 · `[R]` 25 · `[C]` 14 · `[T]` 10 | **Fichiers** : `chronologie.md` 31 · `cadre/trones.md` 28 · `README.md` 15 *(la définition elle-même)* · `cadre/observateurs.md` 7 · `codex.md` 5 · … | **24** dans des cellules de tableau |

**Spécification de parsing — les quatre formes constatées :**

Les balises sont **entourées de backticks**, donc du *code inline* markdown (101 sur 114 ; le reste est du multi-balise dans un seul span). Un convertisseur standard les rendra en `<code>[P]</code>` : le pipeline doit intercepter ces spans.

| Forme | Occurrences | Exemple |
|---|---|---|
| Balise simple | 98 | `` `[P]` `` |
| Balise + précision après tiret cadratin | 3 | `` `[X — la Première seule]` ``, `` `[X — l'Immobile seul]` `` |
| Balise + précision sans tiret | 1 | `` `[P] chez eux` `` |
| Plusieurs balises dans un seul span | 3 | `` `[P] [C] [T] [R] [X]` `` *(usages de légende)* |

**Position : n'importe où dans la ligne** — 67 en milieu, 22 en début, 12 en fin. Le README annonce « en fin de phrase ou de bloc », mais le corpus ne s'y tient pas : le rendu ne peut pas reposer sur une règle de suffixe.

**À exclure du wiki** : `ROADMAP.md` (5 balises) et `claude/review_*.md` (3) sont des documents de travail, pas du lore ; les 15 de `README.md` sont la définition, à rendre comme légende.

### ✅ ~~Le lore local est périmé~~ → RÉSOLU

Je travaille désormais sur le dépôt cloné à jour (`acfe5e0`). **12 fichiers manquaient** au paquet du 24/07 : `cadre/trones.md`, `cadre/alliance.md`, `cadre/empire.md`, `cadre/guerre.md`, `cadre/figures.md`, `magie/magie.md`, `magie/celeste.md`, `magie/elementaire.md`, `magie/ecoles.md`, `ROADMAP.md`, `claude/review_2026-08-11.md`, `claude/review_2026-08-15.md`.

**Règle actée : le build lit le dépôt, jamais le dossier local.** L'accès git direct fonctionne sans authentification particulière.

### 🟠 Les comptes de lieux divergent — trois chiffres

| Source | Compte |
|---|---|
| `geographie/README.md` §1 (lore) | **4 235** |
| même document, §3.1 | **4 234** |
| GeoPackage QGIS | **4 234** |
| `web/data/lieux.js` | **4 233** |

Le document de lore se contredit lui-même. L'écart gpkg → web (1 entité) est probablement le lieu sans géométrie, mais je ne l'ai pas prouvé. Le brief annonce 4 235 : c'est le chiffre du lore, pas celui des données. À réconcilier avant de bâtir un index qui prétend être exhaustif.

### 🟡 Cinq couches ne portent aucun attribut

`rivieres_1/2/3`, `courants`, `provinces` (contours) n'ont **aucune** propriété : impossible de cliquer dessus pour identifier quoi que ce soit. Cohérent avec le constat I1 de l'audit précédent (interactions incohérentes entre couches). Si les fiches doivent couvrir ces objets, il faut aussi les ré-exporter avec un identifiant.

### 🟡 Poids

`lieux.js` fait **2,35 Mo** et se charge au démarrage. L'index de recherche s'y ajoutera. Objectif à tenir : rester fluide sur mobile (critère d'acceptation §11).

---

## 5. Architecture de fichiers proposée

```
web/
  index.html              ← structure seule (~120 lignes)
  css/
    tokens.css            ← variables des 2 thèmes (Nocturne / Grimoire)
    atlas.css             ← carte, contrôles Leaflet refondus, légendes
    panel.css             ← panneau de fiche + wiki
  js/
    core.js               ← INARAMA.load, constantes monde, c2ll
    layers.js             ← les 8 surcouches (code actuel déplacé tel quel)
    legend.js             ← légende contextuelle (déjà écrite)
    search.js             ← recherche client
    panel.js              ← panneau de fiche + rendu d'article
    theme.js              ← bascule + mémorisation
  data/
    …                     ← existant, + id/prov réintroduits
    liens_lore.js         ← table de raccordement écrite à la main (Phase C)
    search_index.js       ← généré au build (Phase D)
  wiki/
    articles/*.html       ← généré depuis le lore (Phase B)
    index.json
  tools/
    build-wiki.mjs        ← build Node hors ligne, idempotent
```

Chargement direct par `<link>` et `<script>`, aucun bundling — conforme au brief §1. Le découpage suit les frontières réelles du code actuel, pas une abstraction inventée.

**Ordre d'exécution proposé** — je place la correction de l'export **avant** tout le reste, sinon les phases B à F bâtissent sur du sable :

0. **Ré-export QGIS** avec `id` et `prov` *(nouveau, préalable)*
1. Phase B — pipeline lore → wiki
2. Phase C — table de raccordement
3. Phase D — recherche
4. Phase E — panneau de fiche
5. Phase F — filtres et index
6. Phase G — identité visuelle *(les deux thèmes)*
7. Phase H — routage URL *(optionnel)*

---

## 6. Ce que je n'ai pas pu faire, et pourquoi

- **Confronter les valeurs de `e` (terres sauvages) à `magie/affinites.md`** : lecture non faite, je ne voulais pas affirmer un raccordement que je n'ai pas vérifié.
- **Vérifier l'écart 4 234 → 4 233** : demande une comparaison entité par entité, pas faite.
- **Lire les 12 fichiers nouvellement récupérés** : j'ai relevé leur existence et leur balisage, pas leur contenu. `cadre/trones.md`, `cadre/alliance.md` et `cadre/empire.md` porteront vraisemblablement des raccordements utiles (Empires, castes) à examiner en Phase C.

## 6 bis. Erreur commise dans la première version de ce rapport

J'ai annoncé que les balises d'échelon **n'existaient pas**, et proposé de retirer la clause du brief. C'était faux : elles sont définies dans `README.md` et employées 114 fois. J'auditais un export daté du 24/07, antérieur à leur introduction, tout en ayant moi-même signalé plus haut dans ce même rapport que cet export était périmé — sans en tirer la conséquence avant d'affirmer une absence. **Une absence constatée sur une source périmée n'est pas une absence.**

---

## 7. Deux remarques sur le brief lui-même

1. **Le brief autorise un build Node ; `PRODUCT.md` interdisait toute étape de build.** C'est un changement de vérité produit, pas une contradiction à contourner : je mettrai `PRODUCT.md` à jour (build hors ligne autorisé, sortie statique uniquement) une fois cette phase validée.
2. **Le brief épingle l'identité visuelle** (Nocturne + Grimoire, couleurs nommées, IM Fell). J'avais engagé une dérivation de direction visuelle par tirage : elle est **abandonnée**, un brief explicite prime. Ta description de *Nocturne* — « la base actuelle, resserrée… sobre, pas décoratif » — vise nettement moins loin que la refonte que tu réclamais il y a une heure ; l'essentiel du changement visuel viendra donc de *Grimoire* et de la refonte des contrôles Leaflet, des légendes et du bloc de marque en un seul système. Si tu attendais davantage sur *Nocturne*, c'est le moment de le dire.
