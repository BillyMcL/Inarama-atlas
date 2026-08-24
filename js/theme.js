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

  /* Le fond derriere la carte est peint par js/fond.js, sur un canvas place
     sous les volets Leaflet : il LIT la matiere de la carte a sa lisiere au
     lieu de la deviner. Ici on ne garde qu'une couleur de repli, au cas ou le
     canvas ne demarrerait pas, et le nom du fond courant pour le reste. */
  const FOND_CARTE = {
    Parchemin: ['#d5b78a', 'parchemin'],
    Satellite: ['#05122e', 'satellite'],
    Terrain:   ['#040317', 'terrain'],
  };
  let baseCourante = 'Terrain';
  function couleurFond() {
    return (window.INARAMA_fondCourant && window.INARAMA_fondCourant.hex)
        || FOND_CARTE[baseCourante][0];
  }

  function majFondCarte(nomFond) {
    const cle = Object.keys(FOND_CARTE).find(k => new RegExp(k).test(nomFond || ''));
    if (cle) baseCourante = cle;
    const c = document.querySelector('.leaflet-container');
    if (!c) return;
    c.style.backgroundColor = FOND_CARTE[baseCourante][0];   // repli seulement
    c.style.backgroundImage = 'none';
    rogneTuiles();
  }

  /* Le remplissage NOIR est cuit dans les tuiles JPEG (la grille est carrée, le
     monde est un rectangle portrait). On ne peut pas l'effacer, mais on peut
     rogner la couche de tuiles aux limites exactes du monde. Les coordonnées
     sont en « layer points », le repère propre du volet : elles ne bougent pas
     au déplacement, seulement au zoom.

     Et par-dessus le rognage, un FONDU. Mesure faite sur les tuiles : au bord
     du monde la matiere n'est pas uniforme — l'anneau d'iles touche le
     rectangle, la dispersion y est de 13 a 20 niveaux. Aucune couleur, aucune
     texture ne peut donc coincider avec ce bord : il alterne abysse et terre.
     Plutot que de faire coincider deux matieres, on supprime la discontinuite.
     Ce qui restait un trait devient un degrade, que l'oeil ne sait pas lire
     comme une limite. */
  let bordEl = null;
  const FONDU = 0.06;        // largeur du fondu, en fraction du plus petit cote du monde
  function rogneTuiles() {
    const m = window.map; if (!m || !window.bounds) return;
    const p = m.getPane('tilePane'); if (!p) return;
    const a = m.latLngToLayerPoint(window.bounds.getNorthWest());
    const b = m.latLngToLayerPoint(window.bounds.getSouthEast());
    p.style.clipPath = 'polygon(' + a.x + 'px ' + a.y + 'px,' + b.x + 'px ' + a.y + 'px,'
                     + b.x + 'px ' + b.y + 'px,' + a.x + 'px ' + b.y + 'px)';
    if (!bordEl) return;
    const w = b.x - a.x, h = b.y - a.y;
    const f = Math.max(18, Math.min(90, Math.round(FONDU * Math.min(w, h))));
    bordEl.style.left = a.x + 'px';  bordEl.style.top = a.y + 'px';
    bordEl.style.width = w + 'px';   bordEl.style.height = h + 'px';
    bordEl.style.boxShadow = 'inset 0 0 ' + f + 'px ' + couleurFond();
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
      // volet dedie : au-dessus des tuiles (200), sous les traces vectoriels (350)
      window.map.createPane('bord').style.zIndex = 250;
      window.map.getPane('bord').style.pointerEvents = 'none';
      bordEl = document.createElement('div');
      bordEl.style.position = 'absolute';
      window.map.getPane('bord').appendChild(bordEl);
      window.map.on('baselayerchange', e => surFond(e.name));
      if (!choixManuel && document.body.classList.contains('parch')) applique('grimoire', false);
      // baselayerchange ne se déclenche pas au chargement : on pose le fond actif
      majFondCarte(document.body.classList.contains('parch') ? 'Parchemin' : 'Terrain');
      window.map.on('overlayadd overlayremove', () => setTimeout(placeTlegend, 30));
      // le rognage suit le zoom ; le fond aussi (Parchemin change au seuil du décor)
      window.map.on('zoomend viewreset', rogneTuiles);
      rogneTuiles();
    }
    placeTlegend();
    addEventListener('resize', () => { rogneTuiles(); setTimeout(placeTlegend, 60); });
    // le sélecteur de couches change de hauteur quand on le déplie
    const ctl = document.querySelector('.leaflet-control-layers');
    if (ctl) ['mouseenter', 'click'].forEach(ev =>
      ctl.addEventListener(ev, () => setTimeout(placeTlegend, 40)));
  }

  document.addEventListener('inarama:fond', rogneTuiles);

  window.INARAMA_theme = { get: () => courant, set: t => { choixManuel = true; applique(t, true); }, bascule };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
