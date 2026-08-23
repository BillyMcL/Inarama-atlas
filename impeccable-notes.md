# Revue design — Atlas Inarama (`index.html`)

Aucune modification apportée à aucun fichier du site. Ce rapport est le seul livrable.

**Méthode** : deux lectures de code indépendantes (l'une côté « directeur design » — heuristiques Nielsen, charge cognitive, personas Jordan/Casey ; l'autre côté « détail d'implémentation » — cas limites, accessibilité, cohérence entre couches, personas Riley/Sam), l'une n'a pas vu l'autre. Plus un scan mécanique déterministe (`impeccable detect`, mode dégradé — dépendances de parsing HTML absentes, donc plancher et non exhaustif). J'ai ensuite vérifié moi-même dans le code source les deux constats les plus lourds avant de les retenir comme faits plutôt que comme hypothèses (détail dans « Vérifications manuelles » ci-dessous).

**Ce qui n'a PAS été vérifié** : aucun rendu réel en navigateur (screenshot, comportement tactile réel, contraste calculé). Tout ce qui suit vient d'une lecture du code, pas d'une observation visuelle — je le signale explicitement plutôt que d'affirmer un rendu que je n'ai pas observé.

**Faux positif écarté** : le scanner mécanique a signalé le `text-shadow` crème (l.44-49, `#ece0c6`) comme un « glow décoratif à la mode IA ». Vérifié dans le code : c'est le halo de lisibilité intentionnel qui garde l'encre sépia lisible sur la texture de parchemin variable en dessous. Pas un défaut — écarté du rapport.

---

## Axe 1 — La légende

**L1. `#legend` ne couvre qu'une seule couche sur huit.**
`l.323-329` : le contenu de `#legend` (« Rareté », « Type de lieu ») est écrit une fois au chargement et documente uniquement la couche Lieux. Aucune légende n'existe pour les couleurs de remplissage Royaumes/Provinces, ni pour les 4 classes de Routes, Routes maritimes, ou Courants marins — seule « Terres sauvages » a sa propre légende (`#tlegend`, correctement liée à l'état on/off de sa couche).
→ Rendre `#legend` contextuelle par couche (comme `#tlegend`) et lui ajouter les clés manquantes.
IMPACT : **FORT** — EFFORT : **MOYEN**

**L2. Fermeture de la légende irréversible.**
`l.324` : `onclick="this.parentNode.style.display='none'"` masque `#legend` sans aucun moyen de la rouvrir avant un rechargement complet de la page.
→ Garder un état (`legendHidden`) et faire apparaître un petit bouton de réouverture résiduel.
IMPACT : **MOYEN** — EFFORT : **FAIBLE**

**L3. La légende disparaît intégralement sur mobile, sans repli.**
`l.75` : `@media(max-width:640px){#legend{display:none}...}`. En dessous de 640px, plus aucun moyen de savoir ce que signifient les couleurs (rareté) et les formes (type) des marqueurs — alors que `#tlegend`, lui, reste affiché (juste réduit) sur mobile. Incohérence de traitement entre les deux légendes.
→ Remplacer par une icône légende cliquable ouvrant un panneau plein écran temporaire, plutôt qu'un retrait pur et simple.
IMPACT : **FORT** — EFFORT : **MOYEN**

**L4. Les swatches de la légende ne correspondent pas aux icônes réelles.**
`l.322` : `shapeSwatch` utilise des glyphes Unicode texte (ex. `✷` à 6 branches pour « sanctuaire ») alors que les marqueurs réels sont des SVG générés dynamiquement (`l.229-246`, étoile à 8 branches). Aucune entrée ne documente l'icône « étoile » utilisée pour les capitales/lieux marquants (`l.235`).
→ Générer les swatches à partir de la même fonction `lieuIcon()` que les marqueurs réels ; ajouter une entrée « capitale ».
IMPACT : **MOYEN** — EFFORT : **FAIBLE**

---

## Axe 2 — Le contrôle des couches

**C1. Race condition confirmée : toggle rapide → calques fantômes non retirables.**
Vérifié dans le code (mécanisme exact, pas une hypothèse) : le motif de garde contre le rechargement (`built` dans `tieredLine` l.119-123, `rivL[t]` l.138, `lieuxData`, `provLayer`, `tzLayer` l.358) est posé **à l'intérieur du callback asynchrone**, pas avant l'appel à `INARAMA.load()`. `INARAMA.load` (l.87-90) dédoublonne bien l'injection du script (`_inj[n]`), mais **pas** la file de callbacks (`_cb[n]`, l.88) : si l'utilisateur décoche puis recoche une couche avant que ses données aient fini de charger, le même callback `build`/`lieuxBuild`/etc. est mis en file deux fois et s'exécute deux fois à l'arrivée des données. Pour `tieredLine` (Routes, Routes maritimes) : `build()` réassigne `p.layer` à un nouvel objet à chaque exécution sans jamais retirer l'ancien du `map` — la première instance reste accrochée à la carte, sans qu'aucune référence JS ne la suive plus, donc **plus jamais retirable via la case à cocher**. Touche Lieux, Provinces, Routes, Routes maritimes, Rivières, et le survol Terres sauvages.
Contre-exemple sain dans le même fichier : `simpleLayer` (Royaumes, Courants — `l.161-162`) pose son flag `sBuilt[name]=1` **de façon synchrone, avant** `INARAMA.load` → couches immunisées à ce bug précis (mais voir C2).
→ Poser un flag `xxxLoading` synchrone avant chaque `INARAMA.load`, sur le modèle de `simpleLayer`.
IMPACT : **FORT** — EFFORT : **MOYEN**

**C2. ~~Décocher « Royaumes » ou « Courants marins » ne fait rien.~~ → CONSTAT ERRONÉ, RETIRÉ.**
J'avais signalé le `remove(){}` vide de `simpleLayer` (`l.162`) comme un bug et l'avais classé **n° 1** du top 5. **C'était faux.**
Vérification : `simpleLayer` ajoute réellement ses enfants **dans** le `L.layerGroup` (`.addTo(g)` — `l.176`, `l.179`, `l.217`), et c'est ce groupe qui est enregistré auprès de `L.control.layers`. Or `_onInputClick` (leaflet.js) fait `this._map.removeLayer(...)` sur la couche décochée, ce qui retire le groupe **et tous ses enfants**. Le `remove(){}` vide est donc **correct** — il n'a rien à faire de plus.
Test navigateur : décocher « Royaumes » fait passer les libellés de **47 → 0** et retire 96 calques ; recocher restaure à l'identique. Aucun bug.
Ce qui reste vrai : les couches dont le `group` est un **leurre vide** (Lieux, Provinces, Rivières, Routes — cf. C9) ont, elles, réellement besoin de leur `remove()` personnalisé, et elles l'ont. C'est cette asymétrie que j'ai mal lue.

**C3. Liste plate de 8 couches, aucun regroupement sémantique.**
`l.292-297` : `overlayDefs` mélange sans hiérarchie les couches « peuplement » (Lieux, Royaumes, Provinces) et « physique/réseau » (Rivières, Routes, Routes maritimes, Courants marins, Terres sauvages). Rien n'aide un nouveau visiteur à savoir quoi activer en premier.
→ Sous-titres visuels dans le contrôle, ou deux `L.control.layers` distincts.
IMPACT : **MOYEN** — EFFORT : **MOYEN**

**C4. Activer « Terres sauvages » ouvre un second panneau sans prévenir.**
`l.294` : cocher cette seule case fait apparaître `#tlegend` (~40 entrées) à l'opposé de l'écran, sans indice dans le libellé du contrôle.
→ Petit indicateur visuel à côté du libellé.
IMPACT : **FAIBLE** — EFFORT : **FAIBLE**

**C5. Aucun retour visuel pendant le chargement, aucune gestion d'erreur réseau.**
`l.87-90` : l'injection de script différée n'a ni indicateur de chargement ni `s.onerror`. Sur réseau mobile lent, cocher une couche peut sembler n'avoir aucun effet pendant 1-2s ; en cas d'échec réseau, la couche reste silencieusement vide pour toujours.
→ Classe CSS « loading » temporaire sur le contrôle + `s.onerror` affichant un état d'erreur minimal.
IMPACT : **MOYEN** — EFFORT : **FAIBLE**

**C6. Aucune icône cohérente sur les 8 surcouches.**
`l.108-110` vs `l.292-297` : les 3 fonds ont un emoji, aucune des 8 surcouches n'en a.
→ Ajouter un pictogramme cohérent par surcouche.
IMPACT : **FAIBLE** — EFFORT : **FAIBLE**

**C7. Le contrôle de couches ne se recollapse jamais au redimensionnement de fenêtre.**
`l.300` : `collapsed:window.innerWidth<900` n'est évalué qu'au chargement initial, jamais sur `resize`.
→ Listener `resize` (débounced) rappelant l'état déplié/replié.
IMPACT : **MOYEN** — EFFORT : **FAIBLE**

**C8. Les Rivières ont une sémantique de chargement différente et moins bonne que les Routes.**
`l.136-142` vs `l.117-131` : `tieredLine` (Routes) charge tout le jeu de données dès l'activation puis affiche/masque par zoom. Rivières charge par palier, uniquement au premier franchissement du seuil — activer « Rivières » à faible zoom ne déclenche rien de visible, peut sembler cassé.
→ Réutiliser `tieredLine` pour les rivières, ou précharger les 3 fichiers dès `add()`.
IMPACT : **MOYEN** — EFFORT : **MOYEN**

**C9. Trois implémentations structurelles différentes pour 8 cases visuellement identiques.**
`simpleLayer` (vrai `L.layerGroup` rempli), flag manuel + groupe leurre en permanence vide (Lieux, Provinces, Rivières, Routes, Routes maritimes), et `L.tileLayer` brut utilisé comme « groupe » (Terres sauvages). Aucun bug visible aujourd'hui, mais dette technique silencieuse — tout futur code qui inspecterait `overlays['Lieux'].getBounds()` trouverait un groupe vide.
→ Signalé pour complétude ; pas d'urgence tant que rien n'en dépend.
IMPACT : **FAIBLE** — EFFORT : n/a

---

## Axe 3 — L'étiquetage des lieux

**E1. Cibles tactiles des marqueurs très en-dessous du minimum mobile.**
`l.225` : à zoom bas, l'icône visuelle fait 11-13px ; `l.232`, le padding de zone de clic (`pad=3`) ne porte la cible réelle qu'à ~17-19px — loin des ~44px recommandés pour le tactile. À contraster avec les labels texte royaume/province (`l.34/38`) qui ont un padding généreux (14-18px) : traitement incohérent entre labels et icônes.
→ Agrandir la zone de hit invisible (iconSize ou marqueur transparent superposé) sans changer la taille visuelle.
IMPACT : **FORT** — EFFORT : **MOYEN**

**E2. Révélation par paliers de zoom sans détection de collision réelle.**
`l.259-260, 277, 285` : `lblRevZoom(f.niv)` ouvre/ferme les tooltips (`permanent:true`) par palier de rareté, uniforme sur toute la carte, sans notion de densité locale. Leaflet ne fait aucune détection de collision entre tooltips permanents — un cluster de lieux de même rareté peut afficher du texte qui se chevauche d'un coup, sans transition.
→ Court terme : resserrer les seuils pour les basses raretés (FAIBLE effort). Complet : passe de décluttering au zoomend/moveend par bounding-box (FORT effort, pas de plugin en vanilla JS).
IMPACT : **FORT** — EFFORT : **FORT** (atténuation rapide possible en FAIBLE)

**E3. Labels de royaume et marqueurs de lieux partagent le même pane sans anti-collision entre eux.**
`l.178-179` vs `l.274-278` : mêmes pane/z-index (600), aucun décalage prévu si un nom de royaume tombe près d'un marqueur de capitale.
→ Pane dédié pour les labels de royaume, z plus élevé.
IMPACT : **FAIBLE** — EFFORT : **MOYEN**

**E4. Direction de tooltip figée, pas de repli aux bords de carte.**
`l.277` : `direction:'top'` fixe (pas `'auto'`) — un lieu isolé près du bord du monde peut voir son étiquette coupée hors du viewport à fort zoom.
→ `direction:'auto'`.
IMPACT : **FAIBLE** — EFFORT : **FAIBLE**

---

## Axe 4 — Les interactions

**I1. Régime d'interaction incohérent selon la couche, sans logique apparente.**
Inventaire vérifié couche par couche :

| Couche | Légende | Survol | Clic |
|---|---|---|---|
| Lieux | Dédiée (rareté+type), mais non liée au toggle | Cosmétique (`riseOnHover`) | Popup complète |
| Royaumes | Aucune | Label texte seulement, **et seulement si `p.d` existe** | Idem — label texte, si `p.d` |
| Provinces | Aucune | Idem Royaumes (`o.d` requis) | Idem |
| Terres sauvages | Dédiée, liée au toggle | Oui, zone entière (tooltip élément) | **Aucun** |
| Rivières | Aucune | **Aucun** | **Aucun** |
| Routes | Aucune | **Aucun** | **Aucun** |
| Routes maritimes | Aucune | **Aucun** | **Aucun** |
| Courants marins | Aucune | **Aucun** | **Aucun** |

L'affordance « cliquable » sur Royaumes/Provinces (`l.35, 39`, soulignement CSS) n'apparaît qu'au survol — invisible par nature sur mobile, où il n'y a pas de survol.
→ Décider un régime minimal cohérent (au moins : indice visuel permanent pour tout élément cliquable ; envisager un `bindPopup` a minima sur Terres sauvages/Rivières/Routes).
IMPACT : **FORT** — EFFORT : **MOYEN à FORT** selon l'ampleur retenue

**I2. Zone de survol « Terres sauvages » invisible, sans curseur dédié.**
`l.359` : polygone déclencheur `fillOpacity:0`, pas de `cursor` distinct — découverte accidentelle uniquement.
→ `cursor:'help'` sur le pane `tz`, ou texte d'aide dans `#tlegend`.
IMPACT : **FAIBLE** — EFFORT : **FAIBLE**

**I3. Aucun bouton de recentrage vers la vue d'ensemble.**
Après `map.fitBounds(bounds)` (`l.101`) initial, aucun contrôle pour y revenir une fois zoomé/déplacé ailleurs.
→ Petit `L.control` custom rappelant `fitBounds`.
IMPACT : **MOYEN** — EFFORT : **FAIBLE**

**I4. Aucun chemin clavier vers le contenu cartographique.**
Marqueurs de lieux, labels royaume/province, tout est déclenché souris uniquement — hors ordre de tabulation. Les contrôles Leaflet natifs (zoom, sélecteur de couches) restent, eux, corrects et focusables.
→ Hors correctif ponctuel ; nécessiterait une refonte d'accessibilité dédiée.
IMPACT : **FORT** — EFFORT : **FORT**

**I5. Boutons de fermeture (✕) non accessibles au clavier.**
`l.324, 347` : `<span onclick=...>`, sans `tabindex`, `role`, ni `keydown`.
→ `<button>` réel, ou `tabindex="0" role="button"` + gestion `keydown`.
IMPACT : **MOYEN** — EFFORT : **FAIBLE**

---

## Axe 5 — Hiérarchie visuelle générale

**H1. Aucune échelle graphique.**
Nulle part `L.control.scale()` ou équivalent. Pour un outil dont la mission affichée est l'information géographique précise, impossible d'évaluer une distance réelle entre deux lieux.
→ `L.control.scale({imperial:false}).addTo(map)`, libellé adapté à l'échelle du monde (hex=60km).
IMPACT : **FORT** — EFFORT : **FAIBLE**

**H2. Aucune fonction de recherche par nom.**
Aucune barre de recherche/filtre. Seule méthode pour trouver un lieu précis : pan/zoom à l'aveugle. C'est l'écart le plus structurant entre le besoin affiché (« chercher une info géographique ») et ce que l'outil offre.
→ Champ de recherche filtrant les données déjà en mémoire côté client, `flyTo()` sur sélection.
IMPACT : **FORT** — EFFORT : **FORT**

**H3. Pas de lien partageable vers une vue précise.**
`map.getCenter()`/`getZoom()` non synchronisés à l'URL — impossible de partager « regarde ce lieu-là » par lien direct.
→ Sync `location.hash` sur `moveend`/`zoomend`, lu à l'initialisation.
IMPACT : **MOYEN** — EFFORT : **MOYEN**

**H4. `#tlegend` hors du système de contrôles Leaflet du coin bas-droit.**
`l.59-61` : `<div>` positionné en absolu, pas intégré à l'espacement automatique Leaflet du coin — risque de chevauchement avec l'attribution (`l.99`) quand Terres sauvages est actif.
→ Remonter `#tlegend` pour dégager la barre d'attribution.
IMPACT : **FAIBLE-MOYEN** — EFFORT : **FAIBLE**

**H5. Le pane `decor` (680) dépasse aussi `tooltipPane` (650), pas seulement les marqueurs (600).**
`l.303` : le commentaire ne mentionne que « cache lieux/provinces sous le décor », mais 680 > 650 signifie qu'en mode Parchemin dézoomé, les tooltips permanents de noms peuvent aussi être masqués sans qu'aucun signal n'indique qu'un label existe dessous.
→ Vérifier contre les zones opaques réelles du PNG décor ; ajuster le z-index si besoin.
IMPACT : **MOYEN** — EFFORT : **FAIBLE**

**H6. Zone de clic des labels royaume/province partage le pane des icônes de lieux.**
`l.34/38` : le padding CSS crée une zone cliquable plus grande que le texte visible ; près d'une icône de lieu, l'ordre d'insertion DOM (non déterministe pour l'utilisateur) décide quel élément capte le clic.
→ Pane dédié pour ces labels.
IMPACT : **FAIBLE-MOYEN** — EFFORT : **MOYEN**

---

## Axe 6 — Comportement sur petit écran

**M1.** Voir **L3** — la légende disparaît intégralement sous 640px, sans repli.

**M2. `maximum-scale=6.0` plafonne le pinch-zoom natif.**
`l.5` : contraire à WCAG 1.4.4 (zoom de texte). Impact limité (le zoom carte reste disponible et agrandit les labels) mais reste une contrainte artificielle.
→ Retirer `maximum-scale`, ou le remonter à 10.
IMPACT : **FAIBLE** — EFFORT : **FAIBLE**

**M3.** Voir **E1** — cibles tactiles des marqueurs sous les 44px recommandés.

**M4. `#tlegend` et le contrôle de couches se disputent potentiellement le même coin sur mobile.**
`l.75` : `#tlegend` réduit à 132px×44vh en bas-droite ; combiné à L3 et E1, accumulation de frictions spécifiques au petit écran au même endroit de l'écran.
IMPACT : **FAIBLE** — EFFORT : **FAIBLE** (se résorbe surtout en traitant L3/E1)

**M5. Pas de `max-width` de secours sur les popups pour très petits écrans.**
`maxWidth` fixes 290/330/340px (`l.180, 206, 276`), aucun `max-width:92vw` sous 360px.
IMPACT : **FAIBLE** — EFFORT : **FAIBLE**

---

## Ce qui marche bien

- **Révélation progressive par zoom, bien pensée dans son principe** (`l.117-131, 259-260`) : évite de noyer l'utilisateur sous toutes les données d'un coup, bon calibrage par défaut (seuls Lieux + Royaumes actifs au chargement, `l.317-319`).
- **Chrome minimal, la carte reste réellement le sujet** : pas de bandeau ni sidebar fixe, `#brand` non interactif (`pointer-events:none`, `l.12`) qui ne gêne jamais l'interaction — la contrainte « priorité à la carte » est globalement respectée dans la structure.
- **Popups bien maîtrisés** (`.lp`, `l.25-28`) : description scrollable en hauteur bornée (`max-height:180px;overflow:auto`), évite qu'une longue description de lore ne casse la mise en page.
- **`INARAMA.load` est un loader correctement conçu à la base** — le dédoublonnage de l'injection de script (`_inj[n]`, `l.89`) fonctionne bien ; le bug de C1 vient de la file de callbacks non dédupliquée, pas d'un défaut du loader lui-même. Le correctif est donc localisé, pas une refonte.

## Questions provocatrices

1. Le fichier gère 8 couches avec des seuils de zoom savamment calibrés — mais si un visiteur ne peut chercher un nom nulle part (H2) et que deux des 8 couches ne se décochent jamais vraiment (C2), tout ce travail de mise en scène sert-il l'objectif « trouver une info précise », ou surtout une belle carte à explorer sans but ?
2. La légende Terres sauvages est dynamique et liée à sa case à cocher ; la légende Lieux est statique et permanente. Choix délibéré, ou résidu de deux moments de code différents ?
3. Si Casey (mobile) est un persona pris au sérieux, la légende principale devrait-elle être le premier élément supprimé sous 640px, ou le dernier ?

---

## Top 5 si une heure disponible, classés par ratio impact/effort

*(C2 retiré du classement — constat erroné, voir ci-dessus. Liste renumérotée.)*

1. ✅ **C1 — Corriger la race condition de toggle rapide** (garde synchrone avant `INARAMA.load`). Protège Lieux/Provinces/Routes/Rivières/Terres sauvages contre des calques fantômes définitivement non retirables. **FAIT.**
2. ✅ **H1 — Ajouter l'échelle graphique**. Comble un manque fondamental pour un outil dont la mission est l'info géographique. **FAIT** (contrôle sur mesure : `L.control.scale` suppose des mètres géographiques, incompatible avec `CRS.Simple` — calcul en km réels via `RES`).
3. ✅ **C7 — Réévaluer le repli du contrôle de couches au redimensionnement**. **FAIT** (repli seulement en rétrécissant, jamais de dépliage automatique).
4. ✅ **L1 + L3 — Étendre et sécuriser la légende**. **FAIT** — légende désormais **contextuelle** (une section par couche active, 8 couches couvertes), plus jamais supprimée sur mobile (repliée + bouton de réouverture). Emporte aussi **L2** (fermeture irréversible) et **L4** (vignettes = vrais marqueurs).
5. ✅ **E1 — Agrandir la zone de clic tactile des marqueurs**. **FAIT** — boîte portée à 32 px, visuel strictement inchangé.

---

## Journal des correctifs appliqués (2026-08-18, branche `refonte-design`)

Tous vérifiés en navigateur sur serveur local, pas seulement relus.

| # | Correctif | Vérification |
|---|---|---|
| C1 | `INARAMA.loadOnce()` — garde synchrone posée **avant** le téléchargement, appliquée aux 6 sites à risque (`tieredLine`, rivières, provinces ×2, lieux, terres_zones) | Toggle rapide pendant chargement : **1** callback en file au lieu de 2. Cycle coche/décoche ×2 : 3557 → 128 → 3557 → 128 calques, **stable, zéro orphelin** |
| H1 | Contrôle d'échelle `ScaleKm` (paliers 1/2/5 ×10ⁿ) | Largeur du monde recalculée indépendamment = **37 528 km** (exact). Cohérence label ↔ km sous la barre < 2 % aux zooms 1→8 (10 000 → 100 km) |
| C7 | Repli du contrôle de couches au `resize` (débounce 200 ms) | Passage 1014 px → 375 px : contrôle replié ✔ |
| — | `#legend` remonté de `bottom:14px` → `46px` | Aucune collision échelle/légende/attribution (18 px d'écart mesuré) |

| L1 | Légende **contextuelle** : `buildLegend()` reconstruit sur `overlayadd`/`overlayremove`, une section par couche réellement active. Les 8 couches sont couvertes (rareté, types, royaumes, provinces, rivières ×3 débits, routes ×4 classes, maritimes ×3, courants) | 2 couches actives → 3 sections ; 8 actives → 9 sections + **12 échantillons de lignes** ; 0 active → message explicite. Réactif dans les deux sens |
| L2+L3 | Légende **repliable et rouvrable** (`#legendBtn`), repliée par défaut sous 640 px au lieu d'être supprimée | Mobile : repliée au chargement, bouton **73×40 px** (cible tactile), réouverture OK, tient dans l'écran (46 % de la largeur) |
| L4 | Vignettes de la légende générées par `lieuSvg()` = **les marqueurs réels** (les glyphes texte `●▲✷` ne correspondaient pas aux SVG dessinés) | 6 vignettes rendues, formes conformes ; ligne « capitale / étoile » ajoutée (absente avant) |
| E1 | Zone de clic des marqueurs portée à **32 px** via marge transparente ; refactor `lieuSvg(type,niv,star,s,S)` partagé | Boîte 17 → 32 px (**×1,88** en largeur, ≈×3,5 en surface) ; rayon dessiné mesuré **5,8** = attendu 5,78 → **visuel strictement inchangé** |

Effet de bord favorable : l'échelle **reste visible sur mobile**, là où `#legend` était auparavant purement supprimée.

**Deux pièges rencontrés (et corrigés) pendant l'implémentation, à retenir :**
- `buildLegend()` est appelée par `overlayadd` **dès l'initialisation**, avant le bloc légende : tout `const`/arrow utilisé dedans est en **zone morte temporelle**. `legRow` a dû passer en déclaration de fonction (hoistée), et les `getElementById` être faits *dans* les fonctions. Erreur trouvée en console, pas à la relecture.
- `max-width` s'applique à la **boîte de contenu** : la légende faisait 196 px au lieu des 172 attendus (+24 px de padding/bordure). Corrigé par `box-sizing:border-box`.

Faux positif du détecteur (`dark-glow` l.45, halo de lisibilité du fond Parchemin) sanctionné explicitement via `hook-admin.mjs ignore-value dark-glow "#ece0c6"`.

### Constats nouveaux, apparus en testant (non corrigés)

**N1. Les libellés de ROYAUME n'ont aucun seuil de zoom — chevauchement massif au dézoom.**
Très visible sur mobile au zoom 1 : « Empire Hodolin », « Thalassorn », « Karambar »… se superposent en un bloc illisible. Les provinces ont pourtant un seuil (`provLabelSync`, z≥4) et les lieux aussi (`lblRevZoom`), mais les royaumes sont créés une fois dans `simpleLayer` **sans aucun filtrage par zoom** — ils s'affichent donc à tous les niveaux, y compris là où le monde entier tient dans 300 px.
→ Leur appliquer un seuil (masquer sous z≈2,5), ou réduire la taille de police au dézoom.
IMPACT : **FORT** (c'est le premier écran que voit un visiteur mobile) — EFFORT : **FAIBLE**
*Préexistant, sans lien avec les correctifs de cette passe.*

**N2. Deux 404 préexistants et sans gravité** : `lib/images/layers-2x.png` (icône rétine du sélecteur de couches, jamais livrée avec Leaflet ici) et `favicon.ico` (absent). Aucun des deux n'est référencé par `index.html`. IMPACT : **FAIBLE** — EFFORT : **FAIBLE**

Questions skipped: rapport livré tel quel par contrainte explicite du brief (« ne me demande pas de valider quoi que ce soit en cours de route »).
