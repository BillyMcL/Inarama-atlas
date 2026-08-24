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

     Terrain et Satellite : texture prélevée sur les tuiles au zoom 7 (détail
     maximal), rendue répétable par décalage-fondu — pas par miroir, qui
     fabriquait un motif en losange bien visible.
     Parchemin : régénéré procéduralement (base + fBm à spectre périodique),
     parce que l'échantillon prélevé attrapait les vaguelettes de l'océan et
     les transformait en stries.

     Les trois textures sont passe-haut : tout ce qui est plus grand que ~24 px
     est efface, il ne reste que le grain. C'est la seule facon de repeter une
     tuile sans que la repetition se voie — l'oeil ne repere pas une periode,
     il repere une FORME qui revient. Residu de grande echelle mesure a 0.04 /
     0.06 / 0.01 niveau de gris, soit sous le seuil d'un ecran 8 bits.
     Contrepartie assumee : le fond ne reproduit pas les grandes moucheture de
     la carte, il n'en garde que la couleur exacte et le grain.

     Troisième valeur = largeur du motif en pixels du zoom 7, c'est-à-dire en
     pixels du raster d'origine. C'est elle qui permet de suivre l'échelle. */
  const MAXZ = 7;
  const FOND_CARTE = {
    Parchemin: ['#d5b88c', 'img/fond-parchemin.jpg', 256],
    Satellite: ['#03142e', 'img/fond-satellite.jpg', 256],
    Terrain:   ['#040417', 'img/fond-terrain.jpg',   256],
  };
  let baseCourante = 'Terrain';

  function majFondCarte(nomFond) {
    const cle = Object.keys(FOND_CARTE).find(k => new RegExp(k).test(nomFond || ''));
    if (cle) baseCourante = cle;
    const c = document.querySelector('.leaflet-container');
    if (!c) return;
    const [col, img] = FOND_CARTE[baseCourante];
    // le fichier image change de contenu sans changer de nom : on le version,
    // sinon un visiteur deja venu garde l'ancienne texture en cache
    const v = window.INARAMA_BUILD ? '?v=' + window.INARAMA_BUILD : '';
    c.style.background = col + " url('" + img + v + "') repeat";  // écrase taille et position
    caleFond();
  }

  /* La texture de la carte GRANDIT avec le zoom et GLISSE quand on déplace.
     Une texture de fond figée en pixels d'écran ne peut donc coller qu'à un
     seul zoom : d'où la couture qui réapparaissait dès qu'on zoomait.
     On la met à la même échelle que la carte, et on la fait suivre le même
     décalage que le volet des tuiles. Le navigateur filtre lui-même la
     réduction, exactement comme les tuiles des zooms bas sont sous-échantillonnées. */
  function caleFond() {
    const c = document.querySelector('.leaflet-container'); if (!c) return;
    const m = window.map; if (!m) return;
    const ref = FOND_CARTE[baseCourante][2];
    // plancher a 32 px : plus bas, reduire une tuile de 512 px fabrique du
    // moire, et de toute facon le grain de la carte n'est plus lisible la-bas
    const t = Math.max(32, Math.min(8192, ref * Math.pow(2, m.getZoom() - MAXZ)));
    c.style.backgroundSize = t.toFixed(2) + 'px ' + t.toFixed(2) + 'px';
    const o = L.DomUtil.getPosition(m.getPane('mapPane'));
    c.style.backgroundPosition = o ? (o.x % t) + 'px ' + (o.y % t) + 'px' : '';
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
    addEventListener('resize', () => setTimeout(placeTlegend, 60));
    // le sélecteur de couches change de hauteur quand on le déplie
    const ctl = document.querySelector('.leaflet-control-layers');
    if (ctl) ['mouseenter', 'click'].forEach(ev =>
      ctl.addEventListener(ev, () => setTimeout(placeTlegend, 40)));
  }

  window.INARAMA_theme = { get: () => courant, set: t => { choixManuel = true; applique(t, true); }, bascule };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
