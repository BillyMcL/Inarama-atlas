/* Bord VIVANT de la carte au parchemin.
 *
 * La carte est posee sur une table d'auberge : elle ne peut pas s'arreter sur un
 * rectangle net. Il ne s'agit PAS de la brûler — un bord noirci mange le dessin
 * et fait faux. Il s'agit de lui donner un bord qui a vecu : irregulier, un peu
 * ambre, comme un papier manipule.
 *
 * ⚠️ CONTRAINTE MESUREE. L'encre du decor court jusqu'a 1.1% du bord de la
 * planche, et la marge de papier nu est en dessous de 2% sur la moitie du tour
 * (mediane 2.2%). Une morsure uniforme mange donc l'ornement : c'est exactement
 * ce qui s'est produit avec une morsure a 10.5%. La profondeur est desormais
 * BORNEE en chaque point par la place reellement disponible, mesuree sur
 * decor_overlay.png et livree dans js/marge_decor.js.
 *
 *   1. La DECHIRURE. Le rectangle de decoupe des tuiles devient une courbe
 *      fermee continue : un rectangle aux coins arrondis, dont chaque point est
 *      recule vers l'interieur le long de sa normale, d'une profondeur bruitee.
 *      Traiter les quatre cotes separement, comme je l'avais d'abord fait,
 *      coupait les coins en biseau droit — ca lisait comme une carte a jouer
 *      rognee, pas comme du papier brule.
 *      La profondeur se mesure toujours sur le PETIT cote du monde, sinon elle
 *      s'etirerait une fois et demie plus sur la hauteur que sur la largeur.
 *
 *   2. La ROUSSISSURE. Trois passes de trait suivant le contour, du large et
 *      clair au fin et noir, d'epaisseur proportionnelle a la morsure locale :
 *      le charbon est epais la ou le feu a mange, absent la ou il a leche.
 *      Plus quelques langues de roussi qui poussent vers l'interieur, sans quoi
 *      le lisere fait un passe-partout regulier.
 *
 * Rien n'est ajoute a la cartographie : on retire de la matiere au bord et on
 * assombrit ce qui reste.
 */
(function () {
  'use strict';

  const N = 640;            // points du contour
  const MORSURE = 0.045;    // profondeur VOULUE, avant bornage par la marge
  const GARDE   = 0.60;     // on n'entame jamais plus que 60% de la place libre
  const RAYON = 0.028;      // arrondi des coins, meme unite
  let cv, ctx, profil = null, langues = null, actif = false;

  /* ---- bruit periodique : somme de sinus, donc il se referme exactement ---- */
  function ondes(graine, pente) {
    let s = graine;
    function alea() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }
    const F = [4, 7, 11, 17, 26, 40, 61, 95], A = [], P = [];
    for (let i = 0; i < F.length; i++) { A.push(1 / Math.pow(F[i], pente)); P.push(alea() * 6.283); }
    const norme = A.reduce(function (x, y) { return x + y; }, 0);
    return function (t) {
      let v = 0;
      for (let i = 0; i < F.length; i++) v += A[i] * Math.sin(6.283 * F[i] * t + P[i]);
      return v / norme;
    };
  }

  /* ---- profondeur mordue en chaque point du tour ---- */
  function faisProfil() {
    // pente forte sur o1 : les basses frequences dominent, donc de GRANDS
    // festons plutot qu'une fine dentelle. o2, plus plate, ajoute le dechire.
    const o1 = ondes(20260824, 1.02), o2 = ondes(97531, 0.50);
    const d = [];
    for (let i = 0; i < N; i++) {
      const t = i / N;
      const n = (0.66 * o1(t) + 0.34 * o2(t) + 1) / 2;
      // exposant eleve : l'essentiel du bord est a peine roussi, quelques
      // endroits sont profondement manges. Un papier brule par morsures.
      let v = MORSURE * (0.04 + 0.96 * Math.pow(Math.max(0, Math.min(1, n)), 1.6));
      // bornage : la ou l'ornement s'approche du bord, on n'entame presque rien
      const m = window.INARAMA_margeDecor;
      if (m && m.length === N) v = Math.min(v, GARDE * m[i]);
      d.push(v);
    }
    return d;
  }

  /* ---- quelques langues de roussi qui poussent vers l'interieur ---- */
  function faisLangues() {
    let s = 424242;
    function alea() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }
    const l = [];
    for (let i = 0; i < 14; i++)
      l.push({ t: alea(), r: 0.9 + alea() * 2.6, a: 0.10 + alea() * 0.16 });
    return l;
  }

  /* ---- le contour : rectangle aux coins arrondis, recule le long des normales ---- */
  function points(a, b) {
    if (!profil) { profil = faisProfil(); langues = faisLangues(); }
    const w = b.x - a.x, h = b.y - a.y, k = Math.min(w, h);
    const R = Math.min(RAYON * k, Math.min(w, h) / 2.2);
    const dx = w - 2 * R, dy = h - 2 * R, arc = Math.PI * R / 2;
    // 8 troncons : 4 droits, 4 arcs, parcourus dans le sens horaire
    const seg = [
      { l: dx,  f: function (u) { return [a.x + R + u * dx, a.y,           0,  1]; } },
      { l: arc, f: function (u) { const g = -Math.PI/2 + u*Math.PI/2, c = Math.cos(g), s2 = Math.sin(g);
                                  return [b.x - R + R*c, a.y + R + R*s2, -c, -s2]; } },
      { l: dy,  f: function (u) { return [b.x,           a.y + R + u * dy, -1, 0]; } },
      { l: arc, f: function (u) { const g = u*Math.PI/2, c = Math.cos(g), s2 = Math.sin(g);
                                  return [b.x - R + R*c, b.y - R + R*s2, -c, -s2]; } },
      { l: dx,  f: function (u) { return [b.x - R - u * dx, b.y,           0, -1]; } },
      { l: arc, f: function (u) { const g = Math.PI/2 + u*Math.PI/2, c = Math.cos(g), s2 = Math.sin(g);
                                  return [a.x + R + R*c, b.y - R + R*s2, -c, -s2]; } },
      { l: dy,  f: function (u) { return [a.x,           b.y - R - u * dy, 1, 0]; } },
      { l: arc, f: function (u) { const g = Math.PI + u*Math.PI/2, c = Math.cos(g), s2 = Math.sin(g);
                                  return [a.x + R + R*c, a.y + R + R*s2, -c, -s2]; } },
    ];
    let L = 0;
    for (let i = 0; i < seg.length; i++) L += seg[i].l;
    const out = [];
    for (let i = 0; i < N; i++) {
      let s = (i / N) * L, j = 0;
      while (j < seg.length - 1 && s > seg[j].l) { s -= seg[j].l; j++; }
      const p = seg[j].f(Math.max(0, Math.min(1, s / seg[j].l)));
      const d = profil[i] * k;
      out.push([p[0] + p[2] * d, p[1] + p[3] * d]);   // recule le long de la normale
    }
    return out;
  }

  /* Quel est le bord VISIBLE de la carte ? Au parchemin dezoomé, ce n'est pas le
     rectangle des tuiles : c'est la PLANCHE de decor (decor_overlay.png), une
     feuille opaque percee en son centre, par le trou de laquelle les tuiles
     apparaissent. Le rectangle des tuiles passe derriere elle, invisible.
     Au-dela du seuil de zoom la planche disparait, et le bord des tuiles
     redevient le bord de la carte. */
  function cible() {
    const m = window.map, d = window.parchDecor;
    if (d && m && m.hasLayer(d) && d.getElement())
      return { b: d.getBounds(), el: d.getElement() };
    return { b: window.bounds, el: null };
  }

  function polygone(a, b) {
    // quand la planche est la, c'est ELLE qu'on decoupe, pas les tuiles
    if (!actif || cible().el) return null;
    const p = points(a, b), s = [];
    for (let i = 0; i < p.length; i++)
      s.push(Math.round(p[i][0]) + 'px ' + Math.round(p[i][1]) + 'px');
    return 'polygon(' + s.join(',') + ')';
  }

  function peins() {
    if (!cv) return;
    const m = window.map;
    const ci = m ? cible() : null, B = ci && ci.b;
    if (!actif || !m || !B) {
      cv.style.display = 'none';
      if (ci && ci.el) ci.el.style.clipPath = '';
      return;
    }
    cv.style.display = '';
    const c = m.getContainer();
    const w = c.clientWidth, h = c.clientHeight, r = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(w * r) || cv.height !== Math.round(h * r)) {
      cv.width = Math.round(w * r); cv.height = Math.round(h * r);
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
    }
    // le canvas vit dans un volet, donc il subit la translation de la carte ;
    // on la compense pour dessiner en coordonnees de la fenetre
    const o = L.DomUtil.getPosition(m.getPane('mapPane')) || { x: 0, y: 0 };
    cv.style.left = (-o.x) + 'px';
    cv.style.top = (-o.y) + 'px';
    ctx.setTransform(r, 0, 0, r, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const a = m.latLngToContainerPoint(B.getNorthWest());
    const b = m.latLngToContainerPoint(B.getSouthEast());
    if (b.x - a.x < 24 || b.y - a.y < 24) return;
    const p = points(a, b), k = Math.min(b.x - a.x, b.y - a.y);
    // la planche se decoupe dans SON propre repere, pas dans celui de la fenetre
    if (ci.el) {
      const q = points({ x: 0, y: 0 }, { x: b.x - a.x, y: b.y - a.y }), t = [];
      for (let i = 0; i < q.length; i++)
        t.push(Math.round(q[i][0]) + 'px ' + Math.round(q[i][1]) + 'px');
      ci.el.style.clipPath = 'polygon(' + t.join(',') + ')';
    }

    ctx.beginPath();
    for (let i = 0; i < p.length; i++) {
      if (i === 0) ctx.moveTo(p[i][0], p[i][1]); else ctx.lineTo(p[i][0], p[i][1]);
    }
    ctx.closePath();
    ctx.save();
    ctx.clip();                                  // tout reste a l'INTERIEUR du papier

    // Pas de charbon : un ambre discret, comme un papier jauni par le bord.
    // Il se mesure sur la morsure REELLE, donc il reste mince partout ou
    // l'ornement approche — il ne peut pas deborder sur le dessin.
    const e = Math.max(1.5, Math.min(60, 0.55 * MORSURE * k));
    const couches = [
      [e * 1.6, 'rgba(150, 112, 66, 0.26)', e * 0.60],   // ambre, qui s'estompe
      [e * 0.7, 'rgba(104, 72, 36, 0.38)',  e * 0.28],   // brun doux
      [e * 0.25, 'rgba(62, 40, 18, 0.55)',  e * 0.08],   // arete du papier
    ];
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (let i = 0; i < couches.length; i++) {
      ctx.strokeStyle = couches[i][1];
      ctx.filter = 'blur(' + couches[i][2].toFixed(1) + 'px)';
      for (let j = 0; j < p.length; j++) {
        const q = (j + 1) % p.length;
        const f = 0.22 + 1.78 * (profil[j] / MORSURE);   // epais la ou ca a mange
        ctx.lineWidth = couches[i][0] * 2 * f;
        ctx.beginPath();
        ctx.moveTo(p[j][0], p[j][1]);
        ctx.lineTo(p[q][0], p[q][1]);
        ctx.stroke();
      }
    }
    // langues de roussi vers l'interieur : sans elles, le lisere fait un cadre
    ctx.filter = 'none';
    for (let i = 0; i < langues.length; i++) {
      const g = langues[i], j = Math.floor(g.t * p.length) % p.length;
      const R2 = g.r * e * 2.2;
      const grad = ctx.createRadialGradient(p[j][0], p[j][1], 0, p[j][0], p[j][1], R2);
      grad.addColorStop(0, 'rgba(112, 72, 34, ' + g.a.toFixed(2) + ')');
      grad.addColorStop(1, 'rgba(112, 72, 34, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(p[j][0], p[j][1], R2, 0, 6.284); ctx.fill();
    }
    ctx.restore();
  }

  function init() {
    const m = window.map; if (!m) return;
    if (!m.getPane('brulure')) {
      m.createPane('brulure');
      m.getPane('brulure').style.zIndex = 690;   // au-dessus de la planche de decor (680)
      m.getPane('brulure').style.pointerEvents = 'none';
    }
    cv = document.createElement('canvas');
    cv.id = 'brulureCanvas';
    cv.style.cssText = 'position:absolute;pointer-events:none';
    m.getPane('brulure').appendChild(cv);
    ctx = cv.getContext('2d');
    m.on('move zoom moveend zoomend viewreset', peins);
    window.addEventListener('resize', peins);
    peins();
  }

  window.INARAMA_brulure = {
    polygone: polygone,
    actif: function (v) {
      if (v === undefined) return actif;
      actif = !!v;
      if (!actif) {
        const d = window.parchDecor;
        if (d && d.getElement()) d.getElement().style.clipPath = '';
      }
      peins();
      return actif;
    },
    // appele quand la planche apparait ou disparait au seuil de zoom
    rafraichis: function () { setTimeout(peins, 0); },
  };

  if (window.map) init();
  else document.addEventListener('DOMContentLoaded', init);
})();
