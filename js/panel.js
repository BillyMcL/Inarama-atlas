/* Panneau de fiche — Phase E.
 * Remplace les popups Leaflet. Une fiche par lieu / province / royaume, et les
 * articles du lore rendus dans le même panneau avec sommaire et retour.
 *
 * Rien n'est inventé : un champ absent est masqué, jamais comblé.
 */
(function () {
  'use strict';

  const MAX_ENFANTS = 40;   // au-delà, on annonce le reste sans le dérouler
  let el, corps, tete, pile = [];   // pile = fil d'Ariane (fiche -> article -> …)

  const ech = s => String(s == null ? '' : s).replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ─────────── accès aux données, chargées à la demande ─────────── */
  const D = {};
  function avec(cles, cb) {
    let reste = cles.filter(k => !D[k]);
    if (!reste.length) return cb();
    reste.forEach(k => INARAMA.loadOnce(k, d => {
      D[k] = d;
      if (cles.every(c => D[c])) cb();
    }));
  }
  const lieux = () => D.lieux.features.map(f => f.properties);

  /* ─────────── ouverture / fermeture ─────────── */
  function ouvre() { el.classList.add('on'); }
  function ferme() { el.classList.remove('on'); pile = []; }

  function rends(html, sansEmpiler) {
    if (!sansEmpiler) corps.scrollTop = 0;
    corps.innerHTML = html;
    ouvre();
    corps.querySelectorAll('[data-go]').forEach(b =>
      b.addEventListener('click', () => {
        const [k, v] = b.dataset.go.split(':');
        ({ L: fLieu, P: fProvince, R: fRoyaume, A: fArticle })[k](v, true);
      }));
    corps.querySelectorAll('a.wiki-ref').forEach(a =>
      a.addEventListener('click', ev => {
        ev.preventDefault();
        fArticle(a.getAttribute('href').replace('.html', ''), true);
      }));
    corps.querySelectorAll('.som a').forEach(a =>
      a.addEventListener('click', ev => {
        ev.preventDefault();
        const c = corps.querySelector('#' + CSS.escape(a.dataset.anc));
        if (c) corps.scrollTop = c.offsetTop - 8;
      }));
  }

  function entete(titre, sous, retour) {
    return '<div class="tete">'
      + (retour ? '<button class="retour" data-go="' + retour.go + '">← ' + ech(retour.txt) + '</button>' : '')
      + '<button class="fermer" aria-label="Fermer">×</button>'
      + '<h3>' + ech(titre) + '</h3>'
      + (sous ? '<div class="sous">' + sous + '</div>' : '')
      + '</div>';
  }

  function poseTete(html) {
    tete.innerHTML = html;
    tete.querySelector('.fermer').addEventListener('click', ferme);
    const r = tete.querySelector('.retour');
    if (r) r.addEventListener('click', () => {
      const [k, v] = r.dataset.go.split(':');
      ({ L: fLieu, P: fProvince, R: fRoyaume, A: fArticle })[k](v);
    });
  }

  /* ─────────── liens vers le lore ─────────── */
  function liensLore(o) {
    const LL = D.liens_lore; if (!LL) return '';
    const out = [];
    const pousse = (cible, txt) => { if (cible) out.push({ cible, txt }); };
    if (o.royaume && LL.royaumes[o.royaume]) pousse(LL.royaumes[o.royaume], 'Le royaume : ' + o.royaume);
    if (o.type && LL.types[o.type]) pousse(LL.types[o.type], 'Ce que « ' + o.type + ' » recouvre');
    if (o.elem) {
      const e = LL.elements[o.elem];
      if (e && e.affinites) pousse(e.affinites, 'L\'élément : ' + o.elem);
      else if (LL.elements._couverts.indexOf(o.elem) >= 0)
        pousse(LL.elements._defaut.affinites, 'L\'élément : ' + o.elem);
    }
    if (!out.length) return '';
    return '<h4>Dans le lore</h4><div class="liens">'
      + out.map(l => '<button class="lien" data-go="A:' + l.cible.split('#')[0]
        + '"><span>' + ech(l.txt) + '</span><span class="fl">→</span></button>').join('')
      + '</div>';
  }

  /* ─────────── fiche LIEU ─────────── */
  function fLieu(id, empile) {
    avec(['lieux', 'liens_lore'], () => {
      const p = lieux().find(x => x.id === id);
      if (!p) return rends('<p class="vide">Lieu introuvable.</p>');
      const rar = window.RAR && window.RAR[p.niveau] ? window.RAR[p.niveau] : '#9aa0a6';
      const tags = [];
      if (p.royaume) tags.push(['R:' + p.royaume, p.royaume, 'fort']);
      if (p.prov && p.prov_nom) tags.push(['P:' + p.prov, p.prov_nom, 'fort']);
      const plats = [];
      if (p.race) plats.push(p.race);
      if (p.elem) plats.push(p.elem);
      if (p.stat) plats.push(p.stat);
      if (p.ecole) plats.push('École : ' + p.ecole);
      if (p.capitale === 1) plats.push('capitale');
      if (p.etoile5 === 1) plats.push('★ étoile');
      if (p.ruine === 1) plats.push('ruine');

      poseTete(entete(p.nom || 'Sans nom',
        '<span style="color:' + rar + '">●</span> ' + ech(p.type)
        + (p.niveau ? ' · niveau ' + p.niveau : '')
        + ' · <code>' + ech(p.id) + '</code>',
        empile && pile.length ? pile[pile.length - 1] : null));

      rends(
        '<div class="tags">'
        + tags.map(t => '<button class="tag ' + t[2] + '" data-go="' + t[0] + '">' + ech(t[1]) + '</button>').join('')
        + plats.map(t => '<span class="tag">' + ech(t) + '</span>').join('')
        + '</div>'
        + (p.desc ? '<div class="desc">' + ech(p.desc) + '</div>' : '<p class="vide">Aucune description.</p>')
        + liensLore(p));
      pile = [{ go: 'L:' + id, txt: p.nom }];
    });
  }

  /* ─────────── fiche PROVINCE ─────────── */
  function fProvince(prov, empile) {
    avec(['lieux', 'prov_labels', 'liens_lore'], () => {
      const o = D.prov_labels.find(x => x.prov === prov);
      if (!o) return rends('<p class="vide">Province introuvable.</p>');
      const enf = lieux().filter(l => l.prov === prov)
        .sort((a, b) => (b.niveau || 0) - (a.niveau || 0) || a.nom.localeCompare(b.nom));
      poseTete(entete(o.n, 'Province · <code>' + ech(prov) + '</code>'
        + (o.zone ? ' · ' + ech(o.zone) : ''),
        empile && pile.length ? pile[pile.length - 1] : null));
      rends(
        (o.royaume ? '<div class="tags"><button class="tag fort" data-go="R:' + ech(o.royaume) + '">'
          + ech(o.royaume) + '</button></div>' : '')
        + (o.d ? '<div class="desc">' + ech(o.d) + '</div>' : '')
        + '<h4>' + enf.length + ' lieu' + (enf.length > 1 ? 'x' : '') + '</h4>'
        + listeLieux(enf)
        + liensLore({ royaume: o.royaume }));
      pile = [{ go: 'P:' + prov, txt: o.n }];
    });
  }

  /* ─────────── fiche ROYAUME ─────────── */
  function fRoyaume(nom, empile) {
    avec(['lieux', 'prov_labels', 'royaumes', 'liens_lore'], () => {
      const f = D.royaumes.features.find(x => x.properties.n === nom
        || x.properties.np === nom);
      const p = f ? f.properties : null;
      if (!p) return rends('<p class="vide">Royaume introuvable.</p>');
      const provs = D.prov_labels.filter(x => x.royaume === p.n)
        .sort((a, b) => a.n.localeCompare(b.n));
      const nLieux = lieux().filter(l => l.royaume === p.n).length;
      poseTete(entete(p.np || p.n,
        'Royaume' + (p.np ? ' · anciennement « ' + ech(p.n) + ' »' : ''),
        empile && pile.length ? pile[pile.length - 1] : null));
      rends(
        '<div class="tags"><span class="tag">' + provs.length + ' province'
        + (provs.length > 1 ? 's' : '') + '</span><span class="tag">' + nLieux + ' lieu'
        + (nLieux > 1 ? 'x' : '') + '</span></div>'
        + (p.d ? '<div class="desc">' + ech(p.d) + '</div>' : '')
        + (provs.length ? '<h4>Provinces</h4><div class="enfants">'
          + provs.slice(0, MAX_ENFANTS).map(x =>
            '<button class="enf" data-go="P:' + ech(x.prov) + '"><span class="n">'
            + ech(x.n) + '</span><span class="c">' + ech(x.prov) + '</span></button>').join('')
          + (provs.length > MAX_ENFANTS ? '<div class="plus">et ' + (provs.length - MAX_ENFANTS)
            + ' autres…</div>' : '') + '</div>'
          : '<p class="vide">Aucune province rattachée.</p>')
        + liensLore({ royaume: p.n }));
      pile = [{ go: 'R:' + nom, txt: p.np || p.n }];
    });
  }

  function listeLieux(arr) {
    if (!arr.length) return '<p class="vide">Aucun lieu.</p>';
    return '<div class="enfants">'
      + arr.slice(0, MAX_ENFANTS).map(l =>
        '<button class="enf" data-go="L:' + ech(l.id) + '">'
        + '<span class="pip" style="background:' + ((window.RAR && window.RAR[l.niveau]) || '#9aa0a6') + '"></span>'
        + '<span class="n">' + ech(l.nom) + '</span>'
        + '<span class="c">' + ech(l.type) + '</span></button>').join('')
      + (arr.length > MAX_ENFANTS ? '<div class="plus">et ' + (arr.length - MAX_ENFANTS)
        + ' autres…</div>' : '')
      + '</div>';
  }

  /* ─────────── ARTICLE de lore ─────────── */
  const cacheArt = {};
  let indexWiki = null;

  function fArticle(slug, empile) {
    const retour = empile && pile.length ? pile[pile.length - 1] : null;
    const pose = html => {
      const meta = indexWiki && indexWiki.articles.find(a => a.slug === slug);
      poseTete(entete(meta ? meta.titre : slug,
        meta ? 'Article du lore · ' + ech(meta.section) : 'Article du lore', retour));
      const som = meta && meta.ancres.length
        ? '<div class="som">' + meta.ancres.map(a =>
            '<a data-anc="' + ech(a.id) + '">' + ech(a.texte) + '</a>').join('') + '</div>'
        : '';
      rends(som + '<div class="art">' + html + '</div>');
    };
    const charge = () => {
      if (cacheArt[slug]) return pose(cacheArt[slug]);
      rends('<p class="vide">Chargement…</p>');
      fetch('wiki/articles/' + slug + '.html')
        .then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(t => { cacheArt[slug] = t; pose(t); })
        .catch(() => rends('<p class="vide">Article indisponible.</p>'));
    };
    if (indexWiki) charge();
    else fetch('wiki/index.json').then(r => r.json())
      .then(j => { indexWiki = j; charge(); })
      .catch(charge);
  }

  /* ─────────── API publique ─────────── */
  window.INARAMA_fiche = {
    lieu: id => fLieu(id), province: p => fProvince(p),
    royaume: n => fRoyaume(n), article: s => fArticle(s), ferme,
  };
  // remplace l'ouverture provisoire de la Phase D
  window.INARAMA_ouvrirArticle = slug => fArticle(slug);

  function init() {
    el = document.createElement('div');
    el.id = 'fiche';
    el.innerHTML = '<div class="poignee"></div><div class="tete"></div><div class="corps"></div>';
    document.body.appendChild(el);
    tete = el.querySelector('.tete');
    corps = el.querySelector('.corps');
    document.addEventListener('keydown', ev => {
      if (ev.key === 'Escape' && el.classList.contains('on')) ferme();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
