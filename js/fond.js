/* Fond de page adaptatif.
 *
 * Huit tentatives a calibrer des textures hors ligne ont echoue pour une raison
 * de fond : la matiere de la carte a sa lisiere ne se laisse pas resumer par une
 * valeur fixe. Elle change avec le zoom (les tuiles des zooms bas sont des
 * reductions, donc plus lisses), elle change avec l'endroit (l'anneau d'iles
 * touche le rectangle du monde), et elle change avec le fond choisi.
 *
 * Donc on ne la devine plus : on la LIT. A chaque arret, on echantillonne les
 * pixels de la carte juste a l'interieur de sa lisiere, on en tire la matiere
 * dominante, et on peint le fond avec. Le fond suit la carte au lieu de tenter
 * de la rattraper.
 */
(function () {
  'use strict';

  const PAS = 256;          // cote du motif de grain
  const POINTS = 96;        // points d'echantillonnage le long de la lisiere
  const SEUIL = 1.5;        // on ne refait le motif que si la matiere a bouge d'autant

  let cv, ctx, motif, dernier = null, enAttente = false, actif = true;
  const cache = new WeakMap();

  /* ---- lecture des pixels de la carte, juste a l'interieur de la lisiere ---- */
  function lisMatiere() {
    const m = window.map, B = window.bounds;
    if (!m || !B) return null;
    const cont = m.getContainer().getBoundingClientRect();
    const a = m.latLngToContainerPoint(B.getNorthWest());
    const b = m.latLngToContainerPoint(B.getSouthEast());
    const tuiles = [];
    document.querySelectorAll('.leaflet-tile-loaded').forEach(function (i) {
      if (i.complete && i.naturalWidth) tuiles.push(i);
    });
    if (!tuiles.length) return null;

    function lis(img, px, py) {
      let d = cache.get(img);
      if (!d) {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(img, 0, 0);
        try { d = g.getImageData(0, 0, c.width, c.height); }
        catch (e) { return null; }              // canvas teinte : on renonce
        cache.set(img, d);
      }
      const x = Math.max(0, Math.min(d.width - 1, px | 0));
      const y = Math.max(0, Math.min(d.height - 1, py | 0));
      const i = (y * d.width + x) * 4;
      return [d.data[i], d.data[i + 1], d.data[i + 2]];
    }

    // on n'echantillonne que la lisiere VISIBLE : ailleurs les tuiles ne sont
    // pas chargees, et une lisiere hors ecran ne touche aucun fond de toute facon
    const x0 = Math.max(a.x, 0), x1 = Math.min(b.x, cont.width);
    const y0 = Math.max(a.y, 0), y1 = Math.min(b.y, cont.height);
    if (x1 - x0 < 8 || y1 - y0 < 8) return null;
    const pts = [], D = 4;
    for (let k = 0; k < POINTS; k++) {
      const t = k / (POINTS - 1);
      if (a.x >= 0)           pts.push([a.x + D, y0 + t * (y1 - y0)]);
      if (b.x <= cont.width)  pts.push([b.x - D, y0 + t * (y1 - y0)]);
      if (a.y >= 0)           pts.push([x0 + t * (x1 - x0), a.y + D]);
      if (b.y <= cont.height) pts.push([x0 + t * (x1 - x0), b.y - D]);
    }
    if (!pts.length) return null;

    const ech = [];
    for (let n = 0; n < pts.length; n++) {
      const sx = cont.left + pts[n][0], sy = cont.top + pts[n][1];
      let img = null;
      for (let j = 0; j < tuiles.length; j++) {
        const r = tuiles[j].getBoundingClientRect();
        if (sx >= r.left && sx < r.right && sy >= r.top && sy < r.bottom) { img = tuiles[j]; break; }
      }
      if (!img) continue;
      const r = img.getBoundingClientRect();
      const p = lis(img, (sx - r.left) * img.naturalWidth / r.width,
                         (sy - r.top) * img.naturalHeight / r.height);
      if (p && p[0] + p[1] + p[2] > 6) ech.push(p);        // hors remplissage noir
    }
    if (ech.length < 12) return null;

    // MODE, pas moyenne ni percentile. La lisiere alterne abysse et terre ; et sur
    // le parchemin, filtrer le bas de la distribution ne retient pas le papier
    // mais l'encre du decor — c'est l'erreur qui m'a fait poser un fond trop
    // sombre pendant plusieurs essais.
    const lum = ech.map(function (p) { return (p[0] + p[1] + p[2]) / 3; });
    const h = new Uint16Array(256);
    lum.forEach(function (v) { h[Math.round(v)]++; });
    let pic = 0, best = -1;
    for (let i = 0; i < 256; i++) {                        // pic lisse sur +-4
      let s = 0;
      for (let j = Math.max(0, i - 4); j <= Math.min(255, i + 4); j++) s += h[j];
      if (s > best) { best = s; pic = i; }
    }
    const proche = ech.filter(function (p, i) { return Math.abs(lum[i] - pic) <= 10; });
    if (proche.length < 8) return null;
    const col = [0, 1, 2].map(function (k) {
      return proche.reduce(function (s, p) { return s + p[k]; }, 0) / proche.length;
    });
    const pl = proche.map(function (p) { return (p[0] + p[1] + p[2]) / 3; });
    const mo = pl.reduce(function (s, v) { return s + v; }, 0) / pl.length;
    const grain = Math.sqrt(pl.reduce(function (s, v) { return s + (v - mo) * (v - mo); }, 0) / pl.length);
    return { col: col, grain: Math.max(0.4, Math.min(6, grain)) };
  }

  /* ---- motif : la teinte lue, plus un grain de meme amplitude ---- */
  function faisMotif(col, grain) {
    const c = document.createElement('canvas'); c.width = c.height = PAS;
    const g = c.getContext('2d');
    const d = g.createImageData(PAS, PAS);
    // bruit blanc pur. A cette amplitude (moins de 6 niveaux) toute structure plus
    // large finirait par se voir se repeter ; du grain seul reste illisible.
    let s = 1;
    function al() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff - 0.5; }
    for (let i = 0; i < PAS * PAS; i++) {
      const n = (al() + al() + al()) * 1.15 * grain;       // somme -> loi ~normale
      d.data[i * 4]     = Math.max(0, Math.min(255, col[0] + n));
      d.data[i * 4 + 1] = Math.max(0, Math.min(255, col[1] + n));
      d.data[i * 4 + 2] = Math.max(0, Math.min(255, col[2] + n));
      d.data[i * 4 + 3] = 255;
    }
    g.putImageData(d, 0, 0);
    return ctx.createPattern(c, 'repeat');
  }

  /* ---- peinture : appelee a chaque image du deplacement, doit rester triviale ---- */
  function peins() {
    if (!ctx || !motif) return;
    if (!actif) { cv.style.display = 'none'; return; }
    cv.style.display = '';
    const m = window.map, c = m.getContainer();
    const w = c.clientWidth, h = c.clientHeight, r = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(w * r) || cv.height !== Math.round(h * r)) {
      cv.width = Math.round(w * r); cv.height = Math.round(h * r);
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
    }
    ctx.setTransform(r, 0, 0, r, 0, 0);
    const o = L.DomUtil.getPosition(m.getPane('mapPane')) || { x: 0, y: 0 };
    ctx.save();
    ctx.translate(o.x % PAS, o.y % PAS);          // le grain glisse avec la carte
    ctx.fillStyle = motif;
    ctx.fillRect(-PAS, -PAS, w + 2 * PAS, h + 2 * PAS);
    ctx.restore();
  }

  /* ---- reechantillonnage : a l'arret seulement, et seulement si utile ---- */
  function reevalue() {
    if (enAttente) return;
    enAttente = true;
    // setTimeout et non requestAnimationFrame : l'echantillonnage n'a pas besoin
    // d'etre synchrone avec une image, et rAF ne se declenche pas dans un onglet
    // qui ne compose pas — le fond resterait alors a sa couleur de depart
    setTimeout(function () {
      enAttente = false;
      const v = lisMatiere();
      if (!v) return;
      const bouge = !dernier || Math.max(
        Math.abs(v.col[0] - dernier.col[0]), Math.abs(v.col[1] - dernier.col[1]),
        Math.abs(v.col[2] - dernier.col[2]), Math.abs(v.grain - dernier.grain)) > SEUIL;
      if (!bouge) return;
      dernier = v;
      motif = faisMotif(v.col, v.grain);
      const hx = function (n) { return Math.round(n).toString(16).padStart(2, '0'); };
      const hex = '#' + hx(v.col[0]) + hx(v.col[1]) + hx(v.col[2]);
      window.INARAMA_fondCourant = { hex: hex, grain: +v.grain.toFixed(2) };
      document.dispatchEvent(new CustomEvent('inarama:fond', { detail: hex }));
      peins();
    }, 0);
  }

  function init() {
    const m = window.map; if (!m) return;
    const c = m.getContainer();
    cv = document.createElement('canvas');
    cv.id = 'fondCanvas';
    cv.style.cssText = 'position:absolute;left:0;top:0;z-index:0;pointer-events:none';
    ctx = cv.getContext('2d');
    c.insertBefore(cv, c.firstChild);            // sous tous les volets Leaflet
    motif = faisMotif([10, 10, 26], 1.5);        // provisoire, le temps du 1er echantillon
    peins();
    m.on('move zoom', peins);
    m.on('moveend zoomend viewreset', function () { peins(); reevalue(); });
    m.on('baselayerchange', function () { dernier = null; setTimeout(reevalue, 500); });
    window.addEventListener('resize', function () { peins(); reevalue(); });
    // les tuiles arrivent apres coup : on reevalue au fil des chargements, sans exces
    let t = null;
    m.on('layeradd', function () { clearTimeout(t); t = setTimeout(reevalue, 400); });
    setTimeout(reevalue, 900);
    setTimeout(reevalue, 2500);
  }

  window.INARAMA_fond = {
    // le fond adaptatif ne convient pas a tous les fonds de carte : le relief a
    // sa texture prelevee, le parchemin repose sur une table. On l'active donc
    // au cas par cas, depuis theme.js.
    actif: function (v) { actif = !!v; if (!v && cv) cv.style.display = 'none'; else { dernier = null; peins(); reevalue(); } },
    relis: function () { dernier = null; reevalue(); },
  };
  window.INARAMA_fondRelis = function () { window.INARAMA_fond.relis(); };

  if (window.map) init();
  else document.addEventListener('DOMContentLoaded', init);
})();
