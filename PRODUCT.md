# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Utilisateur principal : l'auteur du monde, seul.** L'atlas est d'abord son instrument de travail personnel — il connaît la carte par cœur, n'a besoin d'aucune pédagogie, et y revient constamment en parallèle de QGIS pour vérifier, situer, relire une description.

**Scène qui compte pour la conception : la démonstration.** Le moment où l'atlas est *montré* à quelqu'un — par-dessus l'épaule ou via un lien. C'est la situation que l'auteur a désignée comme déterminante pour l'interface, même si elle n'est pas la plus fréquente. Le visiteur y découvre Inarama de zéro.

Ces deux faits se tiennent : l'interface doit servir un habitué (efficacité, aucune explication superflue) tout en soutenant le regard d'un nouveau venu. Le dépôt est techniquement public (GitHub Pages) mais n'est pas conçu pour un public large.

## Product Purpose

Afficher la cartographie achevée d'**Inarama**, monde de fiction, sous forme d'atlas interactif consultable. L'atlas ne produit rien : il **restitue** un travail cartographique fait ailleurs. Réussite = pouvoir atteindre n'importe quel point du monde et lire ce qu'on en sait, sans friction.

## Positioning

La géographie d'Inarama n'est pas dessinée, elle est **simulée physiquement** : modèle numérique de terrain (relief, érosion hydraulique, fosses), réseau hydrographique dérivé des écoulements réels, climat et biomes calculés, courants marins, routes tracées par coût de déplacement. Chaque trait a une cause.

Sa seconde singularité est cosmologique : le monde est une **coquille creuse fissurée**, sans tectonique des plaques, faite de **deux hémisphères en miroir** (Hodolin au nord, Galombar au sud) séparés par un **Bandeau** océanique équatorial, avec deux perforations polaires aux capitales impériales. Le climat n'est pas latitudinal — il va du chaud central (Rhodalia) au froid des bords (Nobunaga). **La carte se lit verticalement**, comme un mandala, pas comme un globe.

## Operating Context

- **QGIS est l'espace de travail autoritaire.** L'atlas web ne fait qu'*afficher* un travail validé ailleurs. On ne crée ni ne corrige de donnée depuis le web.
- Le dépôt **Inarama-lore** (GitHub) est la source de vérité des textes : noms et descriptions des lieux, provinces et royaumes. Toute correction éditoriale s'y fait à la source, puis redescend dans le GeoPackage puis dans l'export web.
- Chaîne : `Inarama_monde.gpkg` (QGIS) → export → `web/data/*.js` → GitHub Pages.
- Un site compagnon distinct existe pour le jeu (`Inarama-quest`) ; il ne partage pas cette interface.

## Capabilities and Constraints

- **Aucune étape de build.** Un seul fichier `index.html` (~400 lignes), Leaflet 1.1.1 en local, JavaScript sans framework. Toute solution doit tenir dans cette contrainte.
- **Fonctionne hors ligne** : les données vectorielles sont livrées en `.js` (pas de `fetch`), les polices et la bibliothèque sont auto-hébergées.
- Projection **`L.CRS.Simple`** en coordonnées pixel — pas de système géographique réel. Monde 18764 × 26784 px à 2 km/pixel, soit 37 528 × 53 568 km. Zoom 1 à 8.
- **3 fonds tuilés** : Terrain, Satellite, Parchemin (~310 Mo de tuiles au total).
- **8 surcouches vectorielles** : lieux, royaumes, provinces, terres sauvages, rivières, routes, routes maritimes, courants marins. Plusieurs se révèlent progressivement au zoom.
- Volumétrie réelle : **4 234 lieux, 476 provinces, 47 royaumes**.
- Décision non tranchée : le fond affiché au chargement est **Terrain** ; sa pertinence pour la scène de démonstration reste ouverte.

## Brand Commitments

Engagements durables confirmés par l'auteur, qu'aucune refonte ne peut remettre en cause :

- **La topologie et les fonds de carte déjà construits.** Rien de ce qui a été établi dans QGIS n'est modifiable depuis ce projet.
- **Le système de marqueurs** : forme par type de lieu (civil, arène, académie, guilde, sanctuaire), couleur par rareté. Hérité du SVG maître, aligné sur la symbologie QGIS.
- **Les couleurs de royaume** : 47 teintes issues du SVG maître, conformes à la carte politique de référence.
- **Le nom** « Inarama / Atlas du monde » et **le décor gravé** dessiné par l'auteur (cadre, cartouches d'hémisphères, roses des vents) affiché sur le fond Parchemin.

Non engagés, donc ouverts : la typographie de l'interface (les polices IM Fell ne concernent que les libellés portés *par la carte*), les panneaux, les contrôles, les popups.

## Evidence on Hand

Tout le contenu est réel, aucun remplissage :

- `web/data/lieux.js` — 4 234 lieux, chacun nommé et décrit (descriptions rédigées, issues du dépôt lore).
- `web/data/royaumes.js` — 47 royaumes nommés, décrits, avec couleur et point d'ancrage.
- `web/data/prov_labels.js`, `provinces.js` — 476 provinces nommées et décrites.
- `rivieres_1..3.js`, `routes.js`, `routes_mer.js`, `courants.js`, `terres_zones.js` — réseaux vectoriels réels dérivés du DEM.
- `web/tiles/{terrain,satellite,tolkien,terres}/` — tuiles rendues depuis QGIS.
- `web/decor_overlay.png` — décor gravé de l'auteur, calé sur les coordonnées monde.
- Polices IM Fell English (OFL) auto-hébergées dans `web/fonts/`.

Rien à inventer : noms, descriptions et géométries existent tous.

## Product Principles

1. **La carte est le sujet ; l'interface l'entoure sans jamais la recouvrir.** Périmètre absolu : ce qui est *sur* la carte (tuiles, décor, libellés, marqueurs) est hors d'atteinte de tout travail d'interface.
2. **Servir un habitué, pas un débutant.** Aucun tutoriel, aucune explication de l'évidence ; en revanche, tout doit être atteignable vite.
3. **Restituer, jamais réinterpréter.** Ce que montre l'atlas doit correspondre exactement à ce qui a été validé dans QGIS et écrit dans le lore.
4. **Révélation progressive.** La densité d'information suit le zoom (lieux par rareté, routes par classe, royaumes par superficie) — c'est la grammaire déjà en place, à respecter.
5. **Rester sans build et hors ligne.** Toute proposition qui exige une chaîne de compilation ou un accès réseau est disqualifiée.

## Accessibility & Inclusion

Aucune exigence produit spécifique n'a été établie. Constat technique à ne pas confondre avec une décision : le contenu cartographique n'est aujourd'hui pas atteignable au clavier, et rareté comme éléments sont véhiculés par la couleur seule.
