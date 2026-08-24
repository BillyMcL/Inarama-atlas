/* Thème — Phase G.
 * Deux mondes : « nocturne » (l'instrument) et « grimoire » (le parchemin).
 * Commutable à la main, mémorisé, et basculé d'office quand on choisit le
 * fond Parchemin — mais un choix manuel postérieur reprend la main.
 */
(function () {
  'use strict';

  const CLE = 'inarama.theme';
  const THEMES = { nocturne: { lib: 'Nocturne', ic: '◐' }, grimoire: { lib: 'Grimoire', ic: '❦' } };
  let courant = 'nocturne';
  let choixManuel = false;      // une fois vrai, le fond de carte n'impose plus rien
  let btn;

  function applique(t, memorise) {
    courant = THEMES[t] ? t : 'nocturne';
    document.body.classList.toggle('grimoire', courant === 'grimoire');
    document.body.classList.toggle('nocturne', courant === 'nocturne');
    if (btn) btn.innerHTML = '<span class="ic">' + THEMES[courant].ic + '</span>'
                           + '<span class="lib">' + THEMES[courant].lib + '</span>';
    if (memorise) { try { localStorage.setItem(CLE, courant); } catch (e) { /* mode privé */ } }
    document.dispatchEvent(new CustomEvent('inarama:theme', { detail: courant }));
  }

  function bascule() {
    choixManuel = true;
    applique(courant === 'grimoire' ? 'nocturne' : 'grimoire', true);
  }

  /* Fond derrière la carte. Il dépend du FOND DE CARTE, jamais du thème :
     Nocturne/Grimoire n'ont rien à voir là-dedans. Un aplat ne pouvait pas
     se raccorder — les trois fonds ont du grain.

     Terrain et Satellite : grain preleve sur les tuiles au zoom 7, la ou le
     detail est maximal. Parchemin : regenere procedurement, parce que
     l'echantillon preleve attrapait les vaguelettes de l'ocean et les
     etirait en stries.

     Deux couches, parce qu'une seule ne peut pas tenir les deux exigences.

     1. Le GRAIN, a l'echelle de la carte, pour que la jonction ne se voie pas.
        Il est passe-haut au-dessus de ~24 px : tout ce qui etait plus grand a
        ete efface. Une tuile repetee ne peut porter aucune grande structure
        sans se trahir — l'oeil ne repere pas une periode, il repere une FORME
        qui revient. Residu mesure a 0.04 / 0.06 / 0.01 niveau de gris.

     2. Les MOUCHETURES, qui redonnent la matiere que le grain seul ne porte
        pas. Elles echappent a la repetition par un autre moyen : leur periode
        est plus grande que la fenetre, donc on n'en voit jamais deux copies a
        la fois. Amplitudes 1.74 / 4.43 / 4.16 niveaux de gris, mesurees apres
        composition alpha, calees sur ce que les tuiles portent reellement.

     Troisieme valeur = largeur du grain en pixels du zoom 7, c'est-a-dire en
     pixels du raster d'origine. C'est elle qui permet de suivre l'echelle. */
  const MAXZ = 7;
  const FOND_CARTE = {
    Parchemin: ['#d5b88c', 'parchemin', 256],
    Satellite: ['#03142e', 'satellite', 256],
    Terrain:   ['#040417', 'terrain',   256],
  };
  let baseCourante = 'Terrain';

  /* Periode des mouchetures : toujours plus large que la diagonale de la
     fenetre. C'est toute l'astuce — la nappe se repete, mais jamais dans le
     champ de vision. */
  function pasNappe() {
    return Math.max(2600, Math.round(1.3 * Math.hypot(innerWidth, innerHeight)));
  }

  function majFondCarte(nomFond) {
    const cle = Object.keys(FOND_CARTE).find(k => new RegExp(k).test(nomFond || ''));
    if (cle) baseCourante = cle;
    const c = document.querySelector('.leaflet-container');
    if (!c) return;
    const [col, nom] = FOND_CARTE[baseCourante];
    // les fichiers changent de contenu sans changer de nom : on les versionne,
    // sinon un visiteur deja venu garde l'ancienne texture en cache
    const v = window.INARAMA_BUILD ? '?v=' + window.INARAMA_BUILD : '';
    c.style.backgroundColor = col;
    // la premiere listee est AU-DESSUS : les mouchetures par-dessus le grain
    c.style.backgroundImage = "url('img/nappe-" + nom + ".png" + v + "'),"
                            + "url('img/fond-"  + nom + ".jpg" + v + "')";
    c.style.backgroundRepeat = 'repeat';
    caleFond();
  }

  /* La texture de la carte GRANDIT avec le zoom et GLISSE quand on deplace.
     Un fond fige en pixels d'ecran ne peut donc coller qu'a un seul zoom :
     d'ou la couture qui reapparaissait des qu'on zoomait. Le grain suit
     l'echelle de la carte ; les mouchetures gardent leur pas, mais les deux
     suivent le meme decalage que le volet des tuiles. */
  function caleFond() {
    const c = document.querySelector('.leaflet-container'); if (!c) return;
    const m = window.map; if (!m) return;
    // plancher a 32 px : plus bas, reduire une tuile de 512 px fabrique du
    // moire, et de toute facon le grain de la carte n'est plus lisible la-bas
    const g = Math.max(32, Math.min(8192,
      FOND_CARTE[baseCourante][2] * Math.pow(2, m.getZoom() - MAXZ)));
    const n = pasNappe();
    c.style.backgroundSize = n + 'px ' + n + 'px,' + g.toFixed(2) + 'px ' + g.toFixed(2) + 'px';
    const o = L.DomUtil.getPosition(m.getPane('mapPane'));
    if (!o) { c.style.backgroundPosition = ''; return; }
    c.style.backgroundPosition = (o.x % n) + 'px ' + (o.y % n) + 'px,'
                               + (o.x % g) + 'px ' + (o.y % g) + 'px';
  }

  /* Le remplissage NOIR est cuit dans les tuiles JPEG (la grille est carrée, le
     monde est un rectangle portrait). On ne peut pas l'effacer, mais on peut
     rogner la couche de tuiles aux limites exactes du monde. Les coordonnées
     sont en « layer points », le repère propre du volet : elles ne bougent pas
     au déplacement, seulement au zoom. */
  function rogneTuiles() {
    const m = window.map; if (!m || !window.bounds) return;
    const p = m.getPane('tilePane'); if (!p) return;
    const a = m.latLngToLayerPoint(window.bounds.getNorthWest());
    const b = m.latLngToLayerPoint(window.bounds.getSouthEast());
    p.style.clipPath = 'polygon(' + a.x + 'px ' + a.y + 'px,' + b.x + 'px ' + a.y + 'px,'
                     + b.x + 'px ' + b.y + 'px,' + a.x + 'px ' + b.y + 'px)';
  }

  /* Le panneau des terres sauvages passait SOUS le sélecteur de couches, qui est
     haut et toujours déplié en desktop. On le place juste dessous, à la mesure. */
  function placeTlegend() {
    const t = document.getElementById('tlegend');
    const c = document.querySelector('.leaflet-top.leaflet-right');
    if (!t || !c || window.innerWidth <= 640) { if (t) t.style.top = ''; return; }
    const b = c.getBoundingClientRect();
    t.style.top = (b.bottom > 0 ? Math.round(b.bottom) + 12 : 60) + 'px';
    t.style.maxHeight = '';           // top + bottom suffisent à le borner
  }

  /* Le fond Parchemin propose Grimoire — il ne l'impose pas si l'utilisateur
     a déjà tranché lui-même pendant la session. */
  function surFond(nomFond) {
    majFondCarte(nomFond);
    if (choixManuel) return;
    applique(/Parchemin/.test(nomFond) ? 'grimoire' : 'nocturne', false);
  }

  function init() {
    btn = document.createElement('button');
    btn.id = 'themeBtn'; btn.type = 'button';
    btn.title = 'Changer de thème';
    btn.setAttribute('aria-label', 'Changer de thème');
    document.body.appendChild(btn);
    btn.addEventListener('click', bascule);

    let memo = null;
    try { memo = localStorage.getItem(CLE); } catch (e) { /* mode privé */ }
    if (memo && THEMES[memo]) { choixManuel = true; applique(memo, false); }
    else applique('nocturne', false);

    // le fond actif au chargement compte aussi
    if (window.map) {
      window.map.on('baselayerchange', e => surFond(e.name));
      if (!choixManuel && document.body.classList.contains('parch')) applique('grimoire', false);
      // baselayerchange ne se déclenche pas au chargement : on pose le fond actif
      majFondCarte(document.body.classList.contains('parch') ? 'Parchemin' : 'Terrain');
      window.map.on('overlayadd overlayremove', () => setTimeout(placeTlegend, 30));
      // le rognage suit le zoom ; le fond aussi (Parchemin change au seuil du décor)
      window.map.on('zoomend', () => { rogneTuiles(); caleFond(); });
      window.map.on('viewreset', () => { rogneTuiles(); caleFond(); });
      // le fond suit le glissement de la carte : sans ca, la carte defile
      // devant une texture immobile et la jonction se voit au moindre deplacement
      window.map.on('move zoom', caleFond);
      rogneTuiles();
    }
    placeTlegend();
    addEventListener('resize', () => { caleFond(); setTimeout(placeTlegend, 60); });
    // le sélecteur de couches change de hauteur quand on le déplie
    const ctl = document.querySelector('.leaflet-control-layers');
    if (ctl) ['mouseenter', 'click'].forEach(ev =>
      ctl.addEventListener(ev, () => setTimeout(placeTlegend, 40)));
  }

  window.INARAMA_theme = { get: () => courant, set: t => { choixManuel = true; applique(t, true); }, bascule };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
