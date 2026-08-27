#!/usr/bin/env node
/**
 * build-search.mjs — index de recherche client.
 *
 * Lit les données déjà exportées (data/*.js) + wiki/index.json, écrit
 * data/search_index.js. Idempotent : mêmes entrées → même sortie.
 *
 * Format volontairement COMPACT : des tableaux positionnels plutôt que des
 * objets, pour ne pas répéter les noms de champs ~4 800 fois. Le schéma est
 * inscrit dans le fichier lui-même.
 *
 * La recherche plein texte dans les descriptions est hors v1 : l'index ne
 * porte donc aucune description, mais le champ `d` du schéma lui est réservé.
 *
 * Usage : node build-search.mjs [--out <chemin/web>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const ICI = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(opt('out', path.join(ICI, '..')));

const litJs = (nom, cle) => {
  const t = fs.readFileSync(path.join(WEB, 'data', nom), 'utf8');
  return JSON.parse(t.slice(t.indexOf(`INARAMA.reg('${cle}',`) + `INARAMA.reg('${cle}',`.length,
                           t.lastIndexOf(');')));
};

/* ─── lieux ───
   `type` (5 valeurs) et `royaume` (48) se répètent des milliers de fois :
   on les interne dans deux dictionnaires et on ne stocke que l'indice. */
const dicoType = [], dicoRoy = [''];
const idx = (dico, v) => { let i = dico.indexOf(v); return i < 0 ? dico.push(v) - 1 : i; };

const lieux = litJs('lieux.js', 'lieux').features.map(f => {
  const p = f.properties, [x, y] = f.geometry.coordinates;
  // rang : ce qui doit remonter en tête. Capitale et étoile priment sur le niveau.
  const rang = (p.capitale === 1 || p.etoile5 === 1) ? 6 : (p.niveau || 0);
  return [p.id, p.nom, idx(dicoType, p.type), idx(dicoRoy, p.royaume || ''), x, y, rang];
});

/* ─── provinces ─── */
const provinces = litJs('prov_labels.js', 'prov_labels')
  .map(o => [o.prov, o.n, o.p[0], o.p[1]]);

/* ─── royaumes ─── (celui sans polygone garde son point d'ancrage) */
const royaumes = litJs('royaumes.js', 'royaumes').features
  .filter(f => f.properties.lp)
  .map(f => { const p = f.properties; return [p.np || p.n, p.n, p.lp[0], p.lp[1]]; });

/* ─── articles du wiki ─── */
const wiki = JSON.parse(fs.readFileSync(path.join(WEB, 'wiki', 'index.json'), 'utf8'));
const articles = wiki.articles.map(a => [a.slug, a.titre, a.section]);

const sortie = {
  schema: {
    L: 'lieu      [id, nom, iType, iRoyaume, x, y, rang]  — iType/iRoyaume = indices dans dicoType/dicoRoy',
    P: 'province  [prov, nom, x, y]',
    R: 'royaume   [nom affiché, clé royaume, x, y]',
    A: 'article   [slug, titre, section]',
    note: 'le plein texte (champ d) est hors v1 — schéma prévu, non peuplé',
  },
  loreCommit: wiki.meta.lore.commitCourt,
  dicoType, dicoRoy,
  L: lieux, P: provinces, R: royaumes, A: articles,
};

// separators compacts : le fichier est lu par la machine, pas relu à la main
const js = `INARAMA.reg('search_index',${JSON.stringify(sortie)});\n`;
const dest = path.join(WEB, 'data', 'search_index.js');
fs.writeFileSync(dest, js, 'utf8');

const ko = n => (n / 1024).toFixed(0) + ' Ko';
console.log(`entrées   : ${lieux.length} lieux · ${provinces.length} provinces · `
          + `${royaumes.length} royaumes · ${articles.length} articles `
          + `= ${lieux.length + provinces.length + royaumes.length + articles.length}`);
console.log(`sortie    : data/search_index.js — ${ko(Buffer.byteLength(js))}`);
console.log(`rappel    : lieux.js pèse ${ko(fs.statSync(path.join(WEB, 'data', 'lieux.js')).size)}`);
