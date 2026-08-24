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

  /* Fond derriere la carte. Il depend du FOND DE CARTE, jamais du theme :
     Nocturne et Grimoire n'ont rien a voir la-dedans.

     Ces textures ne sont pas fabriquees, elles sont PRELEVEES.

       terrain, satellite : bloc de 8x8 tuiles du zoom 7 (2048 px) pris dans
         l'abysse le plus uniforme du monde — trouve en balayant le zoom 4, ou
         une tuile couvre exactement le bloc cherche. C'est la matiere que la
         carte affiche, pas une imitation.
       parchemin : le fichier source fond_parchemin.png, a l'echelle ou la
         carte l'emploie (x2.5), donc le meme papier.

     Rendues raccordables par decomposition periodique + lisse (Moisan) : on
     retire la seule composante qui ne boucle pas, et rien d'autre. Ni miroir
     ni fondu — les deux fabriquaient un motif visible. Coutures mesurees a
     0.67 / 0.31 / 0.31 niveau pour des grains de 2.24 / 1.00 / 5.39.

     Couleurs et grains cales sur le MODE de l'histogramme a la lisiere du
     monde. Le mode, pas un percentile : sur le parchemin, filtrer le bas de la
     distribution ne retenait pas le papier mais l'encre du decor, ce qui
     m'avait fait poser un fond trop sombre et deux fois trop lisse.

       terrain   #040317  mode 12  grain 2.24
       satellite #05122e  mode 23  grain 1.00
       parchemin #d5b78a  mode 181 grain 5.39

     Taille d'affichage : la taille native, 2048 px. Pas de mise a l'echelle au
     zoom — mesure faite sur les tuiles, le grain de la carte est constant en
     pixels d'ecran (parchemin 2.85 au zoom 2 contre 2.22 au zoom 7). C'est du
     bruit de pixel, pas de la matiere du monde. */
  const TUILE = 2048;
  const FOND_CARTE = {
    Parchemin: ['#d5b78a', 'parchemin'],
    Satellite: ['#05122e', 'satellite'],
    Terrain:   ['#040317', 'terrain'],
  };
  let baseCourante = 'Terrain';

  function majFondCarte(nomFond) {
    const cle = Object.keys(FOND_CARTE).find(k => new RegExp(k).test(nomFond || ''));
    if (cle) baseCourante = cle;
    const c = document.querySelector('.leaflet-container');
    if (!c) return;
    const [col, nom] = FOND_CARTE[baseCourante];
    // le fichier change de contenu sans changer de nom : on le versionne,
    // sinon un visiteur deja venu garde l'ancienne texture en cache
    const v = window.INARAMA_BUILD ? '?v=' + window.INARAMA_BUILD : '';
    c.style.backgroundColor = col;
    c.style.backgroundImage = "url('img/fond-" + nom + ".jpg" + v + "')";
    c.style.backgroundRepeat = 'repeat';
    c.style.backgroundSize = TUILE + 'px ' + TUILE + 'px';
    caleFond();
  }

  /* La carte GLISSE quand on la deplace. Sans ca, elle defilerait devant une
     texture immobile et la jonction se verrait au moindre deplacement. */
  function caleFond() {
    const c = document.querySelector('.leaflet-container'); if (!c) return;
    const m = window.map; if (!m) return;
    const o = L.DomUtil.getPosition(m.getPane('mapPane'));
    c.style.backgroundPosition = o ? (o.x % TUILE) + 'px ' + (o.y % TUILE) + 'px' : '';
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
