/* Recherche globale — Phase D.
 * Sans dépendance. Insensible aux accents et à la casse, tolérante aux fautes
 * légères. Priorité : correspondance exacte > préfixe > sous-chaîne > approché,
 * puis rang du lieu (capitale et niveau 5 en tête).
 *
 * Le plein texte dans les descriptions est hors v1 : l'index n'en porte pas.
 */
(function () {
  'use strict';

  const MAX = 8;                    // résultats visibles, imposé par le brief
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  /* ─── distance de Levenshtein bornée : on abandonne dès que ça dépasse ─── */
  function dist(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let min = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1,
                          prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < min) min = cur[j];
      }
      if (min > max) return max + 1;   // toute la ligne dépasse : inutile de continuer
      prev = cur;
    }
    return prev[b.length];
  }

  /* ─── à plat, une seule fois au chargement de l'index ─── */
  let corpus = null;
  function prepare(ix) {
    const out = [];
    for (const [id, nom, it, ir, x, y, rang] of ix.L)
      out.push({ k: 'L', id, nom, nrm: norm(nom), type: ix.dicoType[it],
                 roy: ix.dicoRoy[ir], x, y, rang });
    for (const [prov, nom, x, y] of ix.P)
      out.push({ k: 'P', id: prov, nom, nrm: norm(nom), x, y, rang: 3 });
    for (const [aff, cle, x, y] of ix.R)
      out.push({ k: 'R', id: cle, nom: aff, nrm: norm(aff), x, y, rang: 5 });
    for (const [slug, titre, section] of ix.A)
      out.push({ k: 'A', id: slug, nom: titre, nrm: norm(titre), section, rang: 2 });
    return out;
  }

  /* ─── score d'une entrée. `ctx` est calculé UNE fois par requête :
         construire la RegExp ici coûtait ~4 800 compilations par frappe. ─── */
  function score(e, ctx, approche) {
    const n = e.nrm, q = ctx.q;
    if (n === q) return 1000;
    if (n.startsWith(q)) return 850;
    // préfixe d'un mot interne : « karath » doit trouver « Ven'Karath »
    if (ctx.mot.test(n)) return 780;
    const p = n.indexOf(q);
    if (p >= 0) return 600 - Math.min(p, 20);
    if (approche && q.length >= 4) {
      const d = dist(q, n.slice(0, q.length + ctx.tol), ctx.tol);
      if (d <= ctx.tol) return 380 - d * 60;
    }
    return 0;
  }

  function cherche(q) {
    const nq = norm(q.trim());
    if (!nq || !corpus) return [];
    const ctx = {
      q: nq,
      mot: new RegExp('(^|[\\s\'\\-])' + nq.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      tol: nq.length >= 7 ? 2 : 1,
    };
    // Phase F : les filtres actifs restreignent aussi la recherche, mais
    // seulement pour les LIEUX — un filtre sur la rareté n'a pas de sens pour
    // un article de lore, et le masquer rendrait le wiki introuvable.
    const fl = window.INARAMA_rechF;
    const admis = e => !fl || e.k !== 'L' || fl({ royaume: e.roy, type: e.type,
                                                  niveau: e.rang === 6 ? 5 : e.rang });
    let res = [];
    for (const e of corpus) {
      if (!admis(e)) continue;
      const s = score(e, ctx, false);
      if (s) res.push({ e, s });
    }
    // l'approché ne sert que si l'exact ne donne pas assez : il coûte plus cher
    if (res.length < MAX) {
      const vus = new Set(res.map(r => r.e));
      for (const e of corpus) {
        if (vus.has(e) || !admis(e)) continue;
        const s = score(e, ctx, true);
        if (s) res.push({ e, s });
      }
    }
    res.sort((a, b) => (b.s - a.s) || (b.e.rang - a.e.rang) || a.e.nom.localeCompare(b.e.nom));
    return res.slice(0, MAX).map(r => r.e);
  }

  /* ─── rendu ─── */
  const LIB = { L: 'Lieux', P: 'Provinces', R: 'Royaumes', A: 'Articles du lore' };
  const ORDRE = ['L', 'R', 'P', 'A'];
  let courant = [], sel = 0;

  const ech = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function surligne(nom, q) {
    const i = norm(nom).indexOf(norm(q));
    if (i < 0) return ech(nom);
    // Les titres du lore sont longs (« LIVRE III — LES ROYAUMES · III. Draconiens ») et
    // le mot cherché est souvent à la fin : sans fenêtrage, l'ellipsis le masquerait.
    let deb = 0, pre = '';
    if (i > 24) { deb = i - 12; pre = '…'; }
    return pre + ech(nom.slice(deb, i)) + '<b>' + ech(nom.slice(i, i + q.length)) + '</b>'
         + ech(nom.slice(i + q.length));
  }

  function affiche(q) {
    const box = document.getElementById('rechRes');
    if (!courant.length) {
      box.innerHTML = '<div class="vide">Aucun résultat.</div>';
      box.classList.add('on'); return;
    }
    let h = '', n = 0;
    for (const k of ORDRE) {
      const grp = courant.filter(e => e.k === k);
      if (!grp.length) continue;
      h += '<div class="grp">' + LIB[k] + '</div>';
      for (const e of grp) {
        const meta = e.k === 'L' ? (e.roy || e.type)
                   : e.k === 'P' ? e.id
                   : e.k === 'A' ? e.section : '';
        const pip = e.k === 'L' && window.RAR ? '<span class="pip" style="background:'
                    + (window.RAR[e.rang === 6 ? 5 : e.rang] || '#9aa0a6') + '"></span>' : '';
        h += '<div class="it' + (n === sel ? ' sel' : '') + '" data-i="' + n + '">'
           + pip + '<span class="n">' + surligne(e.nom, q) + '</span>'
           + (meta ? '<span class="meta">' + ech(meta) + '</span>' : '') + '</div>';
        n++;
      }
    }
    box.innerHTML = h;
    box.classList.add('on');
    box.querySelectorAll('.it').forEach(el =>
      el.addEventListener('mousedown', ev => { ev.preventDefault(); choisir(+el.dataset.i); }));
  }

  /* ─── activation d'un résultat ─── */
  function choisir(i) {
    const e = courant[i]; if (!e) return;
    ferme();
    if (e.k === 'A') { window.INARAMA_fiche.article(e.id); return; }
    if (e.k === 'P') window.INARAMA_fiche.province(e.id);
    if (e.k === 'R') window.INARAMA_fiche.royaume(e.id);
    const ll = window.c2ll([e.x, e.y]);
    // zoom « juste » : celui où l'entité est réellement lisible
    const z = e.k === 'L' ? Math.max(window.lblRevZoom ? window.lblRevZoom(e.rang === 6 ? 5 : e.rang) : 5, 5)
            : e.k === 'P' ? 4.5 : 3;
    // flyTo divise par la taille du conteneur : si la carte n'est pas encore
    // mise en page (onglet caché, rendu différé), il produit un LatLng NaN.
    // Observé en test ; on retombe alors sur un recentrage immédiat.
    if (window.map.getSize().x > 0) window.map.flyTo(ll, z, { duration: .8 });
    else window.map.setView(ll, z, { animate: false });
    if (e.k !== 'L') return;
    // filet : si l'animation est interrompue (onglet caché, rAF suspendu),
    // moveend peut ne jamais venir — on ouvre quand même la fiche.
    let fait = false;
    const ouvrir = () => { if (!fait) { fait = true; ouvrePopupLieu(e.id); } };
    window.map.once('moveend', ouvrir);
    setTimeout(ouvrir, 1200);
  }

  // Depuis la Phase E, la fiche s'ouvre dans le panneau : plus besoin d'attendre
  // la fin du vol pour trouver le marqueur.
  function ouvrePopupLieu(id) { window.INARAMA_fiche.lieu(id); }

  /* ─── UI ─── */
  let barre, champ;
  function ouvre() {
    barre.classList.add('on'); champ.focus(); champ.select();
  }
  function ferme() {
    barre.classList.remove('on');
    document.getElementById('rechRes').classList.remove('on');
    champ.blur();
  }

  function init() {
    barre = document.getElementById('rechBar');
    champ = document.getElementById('rechInput');
    if (!barre) return;

    barre.addEventListener('click', ouvre);

    champ.addEventListener('input', () => {
      const q = champ.value;
      if (!q.trim()) { document.getElementById('rechRes').classList.remove('on'); courant = []; return; }
      courant = cherche(q); sel = 0; affiche(q);
    });

    // le clavier ne doit pas fuir vers la carte (Leaflet déplace avec les flèches)
    champ.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') { ev.stopPropagation(); ferme(); return; }
      if (!courant.length) return;
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault(); ev.stopPropagation();
        sel = (sel + (ev.key === 'ArrowDown' ? 1 : -1) + courant.length) % courant.length;
        affiche(champ.value);
      } else if (ev.key === 'Enter') {
        ev.preventDefault(); ev.stopPropagation(); choisir(sel);
      }
    });

    document.addEventListener('keydown', ev => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); ouvre(); }
    });
    document.addEventListener('click', ev => { if (!barre.contains(ev.target)) ferme(); });

    // 184 Ko : on ne les fait pas concurrencer le premier rendu de la carte.
    // Chargé dès que le navigateur est libre, donc prêt bien avant le 1er Ctrl+K.
    const charge = () => INARAMA.loadOnce('search_index', ix => { corpus = prepare(ix); });
    if (window.requestIdleCallback) requestIdleCallback(charge, { timeout: 3000 });
    else setTimeout(charge, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
