/* Explorateur — Phase F : index du monde + filtres.
 * Les filtres agissent sur le rendu de la carte ET sur la recherche.
 * L'arbre est construit à la demande : 4 233 lieux ne sont jamais tous rendus.
 */
(function () {
  'use strict';

  const MAX_FEUILLES = 60;   // au-delà, on annonce le reste sans le dérouler
  const TYPES = ['civil', 'sanctuaire', 'academie', 'guilde', 'arene'];
  const NIVEAUX = [[5, 'légendaire'], [4, 'très rare'], [3, 'rare'], [2, 'peu commun'], [1, 'commun']];

  let el, btn, corps, actifs, onglet = 'index';
  const D = {};
  const F = { royaume: '', types: new Set(), niveaux: new Set(), elem: '' };

  const ech = s => String(s == null ? '' : s).replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lieux = () => D.lieux.features.map(f => f.properties);

  function avec(cles, cb) {
    const reste = cles.filter(k => !D[k]);
    if (!reste.length) return cb();
    reste.forEach(k => INARAMA.loadOnce(k, d => { D[k] = d; if (cles.every(c => D[c])) cb(); }));
  }

  /* ─────────── filtres ─────────── */
  function actif() {
    return !!(F.royaume || F.types.size || F.niveaux.size || F.elem);
  }
  function passe(p) {
    if (F.royaume && p.royaume !== F.royaume) return false;
    if (F.types.size && !F.types.has(p.type)) return false;
    if (F.niveaux.size && !F.niveaux.has(p.niveau || 0)) return false;
    if (F.elem && p.elem !== F.elem) return false;
    return true;
  }

  // L'index de recherche ne porte PAS `elem` (hors v1) : le prédicat qu'on lui
  // donne ignore donc ce critère. Conséquence assumée et visible : un filtre par
  // élément restreint la carte, pas la recherche.
  function passeRech(p) {
    if (F.royaume && p.royaume !== F.royaume) return false;
    if (F.types.size && !F.types.has(p.type)) return false;
    if (F.niveaux.size && !F.niveaux.has(p.niveau || 0)) return false;
    return true;
  }

  function applique() {
    window.INARAMA_filtre = actif() ? passe : null;
    window.INARAMA_rechF = actif() ? passeRech : null;
    if (window.lieuxSync) window.lieuxSync();
    majActifs();
    majBouton();
    if (onglet === 'index') rendIndex();      // les compteurs suivent les filtres
  }

  function majBouton() {
    const n = actif() ? lieux().filter(passe).length : 0;
    btn.innerHTML = '⌗ Explorer' + (actif() ? '<span class="nb">' + n + '</span>' : '');
  }

  function majActifs() {
    const p = [];
    if (F.royaume) p.push(['royaume', F.royaume, 'royaume']);
    F.types.forEach(t => p.push(['type', t, 'types:' + t]));
    F.niveaux.forEach(n => p.push(['niveau', n, 'niveaux:' + n]));
    if (F.elem) p.push(['élément', F.elem, 'elem']);
    actifs.classList.toggle('on', !!p.length);
    if (!p.length) return;
    actifs.innerHTML = p.map(x =>
      '<span class="puce"><b>' + x[0] + '</b> ' + ech(x[1])
      + '<button data-off="' + ech(x[2]) + '" aria-label="Retirer">×</button></span>').join('')
      + '<button class="vider">Tout effacer</button>';
    actifs.querySelectorAll('[data-off]').forEach(b => b.addEventListener('click', () => {
      const [k, v] = b.dataset.off.split(':');
      if (k === 'types' || k === 'niveaux') F[k].delete(k === 'niveaux' ? +v : v);
      else F[k] = '';
      applique(); if (onglet === 'filtres') rendFiltres();
    }));
    actifs.querySelector('.vider').addEventListener('click', vider);
  }

  function vider() {
    F.royaume = ''; F.elem = ''; F.types.clear(); F.niveaux.clear();
    applique(); if (onglet === 'filtres') rendFiltres();
  }

  /* ─────────── onglet FILTRES ─────────── */
  function rendFiltres() {
    avec(['lieux', 'royaumes'], () => {
      const roys = D.royaumes.features.map(f => f.properties)
        .sort((a, b) => (a.np || a.n).localeCompare(b.np || b.n));
      const elems = [...new Set(lieux().map(p => p.elem).filter(Boolean))].sort();
      corps.innerHTML =
        '<div class="grp"><b>Royaume</b><select id="fRoy"><option value="">— tous —</option>'
        + roys.map(r => '<option value="' + ech(r.n) + '"' + (F.royaume === r.n ? ' selected' : '')
          + '>' + ech(r.np || r.n) + '</option>').join('') + '</select></div>'

        + '<div class="grp"><b>Type de lieu</b><div class="chx">'
        + TYPES.map(t => '<label><input type="checkbox" data-t="' + t + '"'
          + (F.types.has(t) ? ' checked' : '') + '><span>' + t + '</span></label>').join('')
        + '</div></div>'

        + '<div class="grp"><b>Rareté</b><div class="chx">'
        + NIVEAUX.map(([n, lib]) => '<label><input type="checkbox" data-n="' + n + '"'
          + (F.niveaux.has(n) ? ' checked' : '')
          + '><span class="pip" style="background:' + ((window.RAR && window.RAR[n]) || '#9aa0a6')
          + '"></span><span>' + n + ' — ' + lib + '</span></label>').join('')
        + '</div></div>'

        + '<div class="grp"><b>Élément</b><select id="fElem"><option value="">— tous —</option>'
        + elems.map(e => '<option value="' + ech(e) + '"' + (F.elem === e ? ' selected' : '')
          + '>' + ech(e) + '</option>').join('') + '</select></div>';

      corps.querySelector('#fRoy').addEventListener('change', e => { F.royaume = e.target.value; applique(); });
      corps.querySelector('#fElem').addEventListener('change', e => { F.elem = e.target.value; applique(); });
      corps.querySelectorAll('[data-t]').forEach(c => c.addEventListener('change', () => {
        c.checked ? F.types.add(c.dataset.t) : F.types.delete(c.dataset.t); applique();
      }));
      corps.querySelectorAll('[data-n]').forEach(c => c.addEventListener('change', () => {
        const n = +c.dataset.n; c.checked ? F.niveaux.add(n) : F.niveaux.delete(n); applique();
      }));
    });
  }

  /* ─────────── onglet INDEX ─────────── */
  const ouverts = new Set();

  function rendIndex() {
    avec(['lieux', 'prov_labels', 'royaumes'], () => {
      const L = lieux().filter(p => !actif() || passe(p));
      const parRoy = {}, parProv = {};
      for (const p of L) {
        if (p.royaume) (parRoy[p.royaume] ||= []).push(p);
        if (p.prov) (parProv[p.prov] ||= []).push(p);
      }
      const provsDe = {};
      for (const o of D.prov_labels) if (o.royaume) (provsDe[o.royaume] ||= []).push(o);

      const roys = D.royaumes.features.map(f => f.properties)
        .filter(r => (parRoy[r.n] || []).length || !actif())
        .sort((a, b) => (a.np || a.n).localeCompare(b.np || b.n));
      if (!roys.length) { corps.innerHTML = '<div class="vide">Aucun royaume ne correspond.</div>'; return; }

      corps.innerHTML = roys.map(r => {
        const nl = (parRoy[r.n] || []).length, np = (provsDe[r.n] || []).length;
        const ouv = ouverts.has('R:' + r.n);
        return '<div class="noeud' + (ouv ? ' ouv' : '') + '" data-k="R:' + ech(r.n) + '">'
          + '<button class="lg"><span class="fl">▸</span><span class="n">' + ech(r.np || r.n)
          + '</span><span class="c">' + np + ' prov · ' + nl + ' lieux</span>'
          + '<span class="cadrer" data-cadre="R:' + ech(r.n) + '" title="Cadrer">⛶</span></button>'
          + '<div class="enfants">' + (ouv ? sousProv(r.n, provsDe, parProv) : '') + '</div></div>';
      }).join('');
      branche(provsDe, parProv);
    });
  }

  function sousProv(roy, provsDe, parProv) {
    const ps = (provsDe[roy] || []).slice().sort((a, b) => a.n.localeCompare(b.n));
    if (!ps.length) return '<div class="vide">Aucune province rattachée.</div>';
    return ps.map(o => {
      const n = (parProv[o.prov] || []).length;
      const ouv = ouverts.has('P:' + o.prov);
      return '<div class="noeud' + (ouv ? ' ouv' : '') + '" data-k="P:' + ech(o.prov) + '">'
        + '<button class="lg"><span class="fl">▸</span><span class="n">' + ech(o.n)
        + '</span><span class="c">' + n + '</span>'
        + '<span class="cadrer" data-cadre="P:' + ech(o.prov) + '" title="Cadrer">⛶</span></button>'
        + '<div class="enfants">' + (ouv ? feuilles(parProv[o.prov] || []) : '') + '</div></div>';
    }).join('');
  }

  function feuilles(arr) {
    if (!arr.length) return '<div class="vide">Aucun lieu.</div>';
    const t = arr.slice().sort((a, b) => (b.niveau || 0) - (a.niveau || 0) || a.nom.localeCompare(b.nom));
    return t.slice(0, MAX_FEUILLES).map(p =>
      '<button class="lg" data-lieu="' + ech(p.id) + '"><span class="fl"></span>'
      + '<span class="pip" style="background:' + ((window.RAR && window.RAR[p.niveau]) || '#9aa0a6') + '"></span>'
      + '<span class="n">' + ech(p.nom) + '</span><span class="c">' + ech(p.type) + '</span></button>').join('')
      + (t.length > MAX_FEUILLES ? '<div class="plus">et ' + (t.length - MAX_FEUILLES) + ' autres…</div>' : '');
  }

  function branche(provsDe, parProv) {
    corps.querySelectorAll('.noeud > .lg').forEach(b => b.addEventListener('click', ev => {
      if (ev.target.dataset.cadre) return;          // le bouton « cadrer » ne plie pas
      const nd = b.parentElement, k = nd.dataset.k;
      if (ouverts.has(k)) ouverts.delete(k); else ouverts.add(k);
      rendIndex();
    }));
    corps.querySelectorAll('[data-lieu]').forEach(b => b.addEventListener('click', () => {
      window.INARAMA_fiche.lieu(b.dataset.lieu);
      const p = lieux().find(x => x.id === b.dataset.lieu);
      if (p) cadreLieu(p);
    }));
    corps.querySelectorAll('[data-cadre]').forEach(b => b.addEventListener('click', ev => {
      ev.stopPropagation();
      const [k, v] = b.dataset.cadre.split(':');
      if (k === 'R') cadreRoyaume(v); else cadreProvince(v);
    }));
  }

  /* ─────────── onglet LORE : accès direct au wiki ───────────
     Sans lui, les articles n'étaient atteignables qu'en passant par un lieu
     ou par la recherche. */
  let indexWiki = null;
  const SECTIONS = { racine: 'Fondations', cadre: 'Le cadre', geographie: 'Géographie',
                     peuples: 'Les peuples', magie: 'La magie', mythologie: 'Mythologie' };

  function rendLore() {
    if (!indexWiki) {
      corps.innerHTML = '<div class="vide">Chargement du lore…</div>';
      return fetch('wiki/index.json').then(r => r.json())
        .then(j => { indexWiki = j; rendLore(); })
        .catch(() => { corps.innerHTML = '<div class="vide">Wiki indisponible.</div>'; });
    }
    const parSec = {};
    for (const a of indexWiki.articles) (parSec[a.section] ||= []).push(a);
    const ordre = Object.keys(SECTIONS).filter(s => parSec[s])
      .concat(Object.keys(parSec).filter(s => !SECTIONS[s]));
    corps.innerHTML = ordre.map(s =>
      '<div class="grp"><b>' + ech(SECTIONS[s] || s) + '</b>'
      + parSec[s].sort((a, b) => a.titre.localeCompare(b.titre)).map(a =>
        '<button class="lg" data-art="' + ech(a.slug) + '">'
        + '<span class="fl"></span><span class="n">' + ech(a.titre) + '</span>'
        + '<span class="c">' + a.ancres.length + '</span></button>').join('')
      + '</div>').join('')
      + '<div class="plus">Lore ' + ech(indexWiki.meta.lore.commitCourt) + ' · '
      + indexWiki.articles.length + ' articles</div>';
    corps.querySelectorAll('[data-art]').forEach(b =>
      b.addEventListener('click', () => window.INARAMA_fiche.article(b.dataset.art)));
  }

  /* ─────────── cadrage ─────────── */
  function cadreRoyaume(nom) {
    const f = D.royaumes.features.find(x => x.properties.n === nom);
    if (!f || !f.geometry) return;
    const pts = [];
    const parcours = c => Array.isArray(c[0]) ? c.forEach(parcours) : pts.push(window.c2ll(c));
    parcours(f.geometry.coordinates);
    if (pts.length) window.map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 5 });
  }
  function cadreProvince(prov) {
    const o = D.prov_labels.find(x => x.prov === prov);
    if (o) window.map.setView(window.c2ll(o.p), 4.5);
  }
  function cadreLieu(p) {
    const f = D.lieux.features.find(x => x.properties.id === p.id);
    if (f) window.map.setView(window.c2ll(f.geometry.coordinates), 5.5);
  }

  /* ─────────── coquille ─────────── */
  function montre(quel) {
    onglet = quel;
    el.querySelectorAll('.onglets button').forEach(b =>
      b.classList.toggle('act', b.dataset.o === quel));
    corps.scrollTop = 0;
    ({ index: rendIndex, filtres: rendFiltres, lore: rendLore })[quel]();
  }
  function ouvre() { el.classList.add('on'); document.body.classList.add('explo-on'); montre(onglet); }
  function ferme() { el.classList.remove('on'); document.body.classList.remove('explo-on'); }

  function init() {
    btn = document.createElement('button');
    btn.id = 'exploBtn'; btn.type = 'button'; btn.innerHTML = '⌗ Explorer';
    document.body.appendChild(btn);

    el = document.createElement('div');
    el.id = 'explo';
    el.innerHTML = '<div class="poignee"></div>'
      + '<div class="onglets"><button data-o="index" class="act">Index</button>'
      + '<button data-o="lore">Lore</button>'
      + '<button data-o="filtres">Filtres</button>'
      + '<button class="fermer" aria-label="Fermer">×</button></div>'
      + '<div class="actifs"></div><div class="corps"></div>';
    document.body.appendChild(el);
    corps = el.querySelector('.corps');
    actifs = el.querySelector('.actifs');

    btn.addEventListener('click', () => el.classList.contains('on') ? ferme() : ouvre());
    el.querySelector('.fermer').addEventListener('click', ferme);
    el.querySelectorAll('.onglets button[data-o]').forEach(b =>
      b.addEventListener('click', () => montre(b.dataset.o)));
    document.addEventListener('keydown', ev => {
      if (ev.key === 'Escape' && el.classList.contains('on')) ferme();
    });
  }

  window.INARAMA_explo = { ouvre, ferme, vider, filtreActif: actif };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
