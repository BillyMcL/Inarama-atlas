/* liens_lore.js — table de raccordement atlas → wiki du lore.
 *
 * ÉCRITE À LA MAIN, versionnée. Dérivée des tableaux et titres EXPLICITES du
 * lore (commit acfe5e0), jamais d'une heuristique sur les noms.
 * Format des cibles : "<slug-article>#<ancre>" — voir wiki/index.json.
 *
 * Toute entrée marquée « À VALIDER » attend un arbitrage : je l'ai déduite de
 * la description que README.md donne du document, pas d'un titre qui porterait
 * le nom du royaume.
 */
INARAMA.reg('liens_lore', {

  _meta: {
    loreCommit: 'acfe5e0',
    derivéDe: [
      'peuples/*.md — un titre de niveau 3 par royaume',
      'geographie/README.md §3.1 — tableau des cinq types',
      'magie/affinites.md §2 — tableau « Index élément → peuples »',
      'README.md § État des documents — rôle de cadre/alliance.md et cadre/empire.md',
    ],
  },

  /* ───────────── 1. Royaume → sa fiche de peuple ─────────────
     45 des 48 tirés d'un titre portant exactement le nom du royaume. */
  royaumes: {
    // Draconiens — 8 clans
    "Ignar'Khan":       "peuples-draconiens#ignar-khan",
    "Thal'Drak":        "peuples-draconiens#thal-drak",
    "Gorn'Var":         "peuples-draconiens#gorn-var",
    "Ven'Karath":       "peuples-draconiens#ven-karath",
    "Ortok'Var":        "peuples-draconiens#ortok-var",
    "Sulkh'Drak":       "peuples-draconiens#sulkh-drak",
    "Borkh'Nar":        "peuples-draconiens#borkh-nar",
    "Yol'Karath":       "peuples-draconiens#yol-karath",
    // Elfes — 8 royaumes
    "Luminaris":        "peuples-elfes#luminaris",
    "Thalassorn":       "peuples-elfes#thalassorn",
    "Ignareth":         "peuples-elfes#ignareth",
    "Bathyalos":        "peuples-elfes#bathyalos",
    "Ghabarat":         "peuples-elfes#ghabarat",
    "Selvorn":          "peuples-elfes#selvorn",
    "Damaveth":         "peuples-elfes#damaveth",
    "Ashmael":          "peuples-elfes#ashmael",
    // Nains — 8 royaumes
    "Steinmark":        "peuples-nains#steinmark",
    "Gjallvik":         "peuples-nains#gjallvik",
    "Eldvarr":          "peuples-nains#eldvarr",
    "Jarnheim":         "peuples-nains#jarnheim",
    "Jarnfjord":        "peuples-nains#jarnfjord",
    "Melkarthos":       "peuples-nains#melkarthos",
    "Nebeshaat":        "peuples-nains#nebeshaat",
    "Ceomhar":          "peuples-nains#ceomhar",
    // Humains — 4 royaumes
    "Aethermonde":      "peuples-humains#aethermonde",
    "Karambar":         "peuples-humains#karambar",
    "Viranthis":        "peuples-humains#viranthis",
    "Siksik-Nunavaar":  "peuples-humains#siksik-nunavaar",
    // Orcs — 4 royaumes
    "Bukharak":         "peuples-orcs#bukharak",
    "Gorzgul":          "peuples-orcs#gorzgul",
    "Magmarak":         "peuples-orcs#magmarak",
    "Obskar":           "peuples-orcs#obskar",
    // Thieflins — 4 royaumes
    "Kazarak":          "peuples-thieflins#kazarak",
    "Ashkareth":        "peuples-thieflins#ashkareth",
    "Nepharak":         "peuples-thieflins#nepharak",
    "Rimalkhet":        "peuples-thieflins#rimalkhet",
    // Zoo — le titre porte un qualificatif de branche ou de biome
    "Vivara":           "peuples-zoo#vivara-terrestre-coeur-du-zoo-d-hodolin",
    "Guaravar":         "peuples-zoo#guaravar-est",
    "Amavara":          "peuples-zoo#amavara-sud",
    "Whanavara":        "peuples-zoo#whanavara-ouest",
    "Tupavar":          "peuples-zoo#tupavar-nord",
    "Yakuvara":         "peuples-zoo#yakuvara-zoo-aquatiques-mode-de-vie",
    "Zoo volants":      "peuples-zoo#wayravara-zoo-volants-mode-de-vie",   // nom proposé : Wayravara
    "Zoo polaires":     "peuples-zoo#ritivara-zoo-polaires-categorie-de-biome", // nom proposé : Ritivara
    // Territoire particulier
    "Carceris":         "peuples-territoires#carceris-la-geole-de-galombar",

    /* ── À VALIDER — aucun titre ne porte ces noms ── */
    // Le lore range les cités franches sous un pluriel : « Les Indépendantes ».
    "Indépendante":     "peuples-territoires#les-independantes-cites-franches",
    // Les deux Empires n'ont pas de fiche de peuple : README.md attribue
    // l'architecture politique d'Hodolin à cadre/alliance.md, celle de
    // Galombar à cadre/empire.md. Le pouvoir céleste lui-même est dans
    // cadre/trones.md, les capitales dans peuples/celestes.md.
    "Empire Hodolin":   "cadre-alliance",
    "Empire Galombar":  "cadre-empire",
  },

  /* ───────────── 2. Type de lieu → sa définition ─────────────
     Les cinq types sont définis dans UN SEUL tableau (§3.1), pas dans cinq
     sections : la cible est donc commune. */
  types: {
    civil:       "geographie-readme#3-1-le-type-cinq-categories-pas-cinq-realites",
    sanctuaire:  "geographie-readme#3-1-le-type-cinq-categories-pas-cinq-realites",
    academie:    "geographie-readme#3-1-le-type-cinq-categories-pas-cinq-realites",
    guilde:      "geographie-readme#3-1-le-type-cinq-categories-pas-cinq-realites",
    arene:       "geographie-readme#3-1-le-type-cinq-categories-pas-cinq-realites",
  },

  /* ───────────── 3. Élément de terre sauvage → affinité + biome ─────────────
     Les 34 éléments du système F-A-T-E figurent tous dans le même tableau
     « Index élément → peuples ». Un tableau markdown n'ayant pas d'ancre par
     ligne, on pointe le tableau — pas la ligne. */
  elements: {
    _defaut: {
      affinites: "magie-affinites#2-index-element-peuples",
      biomes:    "geographie-biomes#le-principe-les-terres-sauvages",
    },
    // Les 34 couverts par _defaut, énumérés pour rendre la table auditable.
    _couverts: [
      "Feu", "Éclair", "Magnétisme", "Vapeur ardente", "Foudre", "Verre", "Orage",
      "Obsidienne", "Bronze", "Geyser", "Plasma", "Fumée noire", "Ammoniac", "Acier",
      "Acide sulfurique", "Lave", "Sel gemme", "Sang", "Eau thermale", "Air",
      "Poussière", "Brume", "Sable", "Pollen", "Tempête", "Roche", "Bois", "Glace",
      "Chlore gazeux", "Terre", "Boue", "Plante", "Mercure", "Eau",
    ],

    /* ── Hors système F-A-T-E : chacun a son document propre ── */
    "Arcane":         { affinites: "magie-arcane#1-nature-de-l-arcane" },
    "Quintessence":   { affinites: "magie-celeste#8-2-la-quintessence-celeste" },
    // À VALIDER : le document ne consacre pas de section à la dualité
    // Lumière/Ombre en tant qu'éléments ; je pointe la nature de la Conjuration.
    "Astral Lumière": { affinites: "magie-celeste#1-nature-de-la-conjuration" },
    "Astral Ombre":   { affinites: "magie-celeste#1-nature-de-la-conjuration" },

    /* ── Sans cible : ce ne sont pas des éléments du lore ──
       Valeurs cartographiques des zones « non formalisées » (provinces sans
       affinité arbitrée). Ne rien afficher plutôt qu'un lien faux. */
    _sansCible: ["eau", "terre", "air", "feu", "arcane",
                 "astral_lum", "astral_ombre", "ruine", "ecole"],
  },

});
