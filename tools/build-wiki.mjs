#!/usr/bin/env node
/**
 * build-wiki.mjs — lore markdown → wiki HTML statique.
 *
 * Lit les .md du dépôt Inarama-lore, écrit UNIQUEMENT dans le dépôt atlas
 * (web/wiki/). Idempotent : même commit de lore en entrée → sortie identique
 * à l'octet près (aucun horodatage d'exécution n'est inscrit ; on n'inscrit
 * que la date du commit source).
 *
 * Usage :
 *   node build-wiki.mjs --lore <chemin/vers/Inarama-lore> [--out <chemin/web>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import MarkdownIt from 'markdown-it';

/* ─────────────────────────── configuration ─────────────────────────── */

// Documents de travail internes : ce n'est pas du contenu d'univers.
const EXCLUS = [/^ROADMAP\.md$/i, /^claude\//i];

// Échelons de connaissance — sémantique fixée par README.md du lore.
// ATTENTION : ce n'est PAS une échelle croissante (« à Hodolin, [R] contient
// [T] »). Cinq identités distinctes, jamais un dégradé d'intensité.
const ECHELONS = {
  P: 'Public — tous les peuples',
  C: 'Caste — les Astreli / les Abyssari',
  T: 'Trônes — souverains en fonction, Rhodaliens gardiens, Observateurs',
  R: 'Cercle restreint — organe collégial du sommet concerné',
  X: 'Singulier — un seul être le sait',
};

// Les quatre formes réellement constatées dans le corpus (114 balises).
const RE_MULTI = /^\s*\[[PCTRX]\](?:\s*\[[PCTRX]\])+\s*$/;      // `[P] [C] [T]`
const RE_QUAL  = /^\s*\[([PCTRX])\s*[—–-]\s*([^\]]+)\]\s*$/;     // `[X — la Première seule]`
const RE_ONE   = /^\s*\[([PCTRX])\]\s*$/;                        // `[P]`
const RE_TRAIL = /^\s*\[([PCTRX])\]\s+(.+?)\s*$/;                // `[P] chez eux`

/* ─────────────────────────── utilitaires ─────────────────────────── */

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };

// fileURLToPath, pas .pathname : ce dernier laisse les espaces encodés en %20
// et fabriquerait un dossier « claude%20qgis ».
const ICI  = path.dirname(fileURLToPath(import.meta.url));
const WEB  = path.resolve(opt('out', path.join(ICI, '..')));
const LORE = path.resolve(opt('lore', ''));

if (!LORE || !fs.existsSync(LORE)) {
  console.error('ERREUR : chemin du dépôt lore introuvable.\n  node build-wiki.mjs --lore <chemin>');
  process.exit(1);
}

const echappe = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Slug stable, sans accents — sert d'identifiant de fichier et d'ancre. */
function slugifie(s) {
  return s.toLowerCase()
    // ligatures : non décomposables par NFD, sinon « cœur » devient « c-ur »
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'sans-titre';
}

/** Liste récursive des .md, chemins relatifs en POSIX. */
function listeMd(racine, base = '') {
  const out = [];
  for (const e of fs.readdirSync(path.join(racine, base), { withFileTypes: true })) {
    if (e.name === '.git') continue;
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...listeMd(racine, rel));
    else if (e.name.endsWith('.md')) out.push(rel);
  }
  return out.sort();
}

/** Provenance : commit + date du lore. Le build reste idempotent (pas de now()). */
function provenance(dir) {
  try {
    const g = a => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).trim();
    return { commit: g(['rev-parse', 'HEAD']), commitCourt: g(['rev-parse', '--short', 'HEAD']),
             date: g(['log', '-1', '--format=%cI']) };
  } catch {
    return { commit: null, commitCourt: null, date: null, note: 'git indisponible' };
  }
}

/* ─────────────────────── rendu des balises d'échelon ─────────────────────── */

let compteEchelons = {};   // par article
let fichierCourant = '';   // source en cours, pour résoudre les références relatives
let refsResolues = 0, refsNonResolues = [];

function pastille(lettre, precision) {
  const t = ECHELONS[lettre];
  compteEchelons[lettre] = (compteEchelons[lettre] || 0) + 1;
  const titre = precision ? `${t} — ${precision}` : t;
  return `<span class="ech ech-${lettre}" data-ech="${lettre}" title="${echappe(titre)}">`
       + `<span class="ech-l">${lettre}</span>`
       // espace littéral : sans lui, un copier-coller colle « Xla Première seule »
       + (precision ? ` <span class="ech-q">${echappe(precision)}</span>` : '')
       + `</span>`;
}

/** Un span de code inline est-il une (ou plusieurs) balise(s) ? Sinon : code normal. */
function rendEchelon(contenu) {
  let m;
  if (RE_MULTI.test(contenu))
    return contenu.match(/\[([PCTRX])\]/g).map(t => pastille(t[1])).join(' ');
  if ((m = RE_QUAL.exec(contenu)))  return pastille(m[1], m[2].trim());
  if ((m = RE_ONE.exec(contenu)))   return pastille(m[1]);
  if ((m = RE_TRAIL.exec(contenu))) return pastille(m[1], m[2].trim());
  return null;
}

/* ──────────── références croisées entre documents du lore ────────────
   Le lore n'emploie AUCUN lien markdown : il cite ses documents frères en
   code inline (`codex.md`, `cadre/trones.md`…) — 598 occurrences. C'est sa
   navigation réelle ; on la rend cliquable sans toucher au texte. */

let slugDe = new Map();   // chemin source → slug (rempli plus bas)

function resolRef(ref) {
  const r = ref.trim().replace(/^\.\//, '');
  if (slugDe.has(r)) return slugDe.get(r);
  // relatif au document citant — lève l'ambiguïté des deux README.md
  const rel = path.posix.normalize(path.posix.join(path.posix.dirname(fichierCourant), r))
                  .replace(/^\.\//, '');
  if (slugDe.has(rel)) return slugDe.get(rel);
  // nom de base, si unique dans le corpus
  const base = r.split('/').pop();
  const c = [...slugDe.keys()].filter(k => k.split('/').pop() === base);
  return c.length === 1 ? slugDe.get(c[0]) : null;
}

/* ─────────────────────────── conversion ─────────────────────────── */

const md = new MarkdownIt({ html: false, linkify: false, typographer: false });

// 1. Balises d'échelon : on intercepte le code inline AVANT le rendu par défaut,
//    ce qui évite d'abîmer les vrais spans de code (`codex.md`, `id`, `nom`…).
md.renderer.rules.code_inline = (tokens, idx, _o, _e, self) => {
  const c = tokens[idx].content;
  const pastilles = rendEchelon(c);
  if (pastilles) return pastilles;
  // référence croisée vers un autre document du lore → lien, apparence conservée
  if (/\.md$/.test(c.trim())) {
    const s = resolRef(c);
    if (s) { refsResolues++;
      return `<a class="wiki-ref" href="${s}.html"><code>${echappe(c)}</code></a>`; }
    refsNonResolues.push({ depuis: fichierCourant, ref: c });
  }
  return `<code${self.renderAttrs(tokens[idx])}>${echappe(c)}</code>`;
};

// 2. Ancres sur les titres + collecte des niveaux 2.
function poseAncres(tokens, ancres) {
  const vus = new Map();
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type !== 'heading_open') continue;
    const texte = tokens[i + 1].content.replace(/[*_`]/g, '').trim();
    let id = slugifie(texte);
    if (vus.has(id)) { const n = vus.get(id) + 1; vus.set(id, n); id = `${id}-${n}`; }
    else vus.set(id, 1);
    t.attrSet('id', id);
    if (t.tag === 'h2') ancres.push({ id, texte });
  }
}

/* ─────────────────────────── exécution ─────────────────────────── */

const prov = provenance(LORE);
const fichiers = listeMd(LORE).filter(f => !EXCLUS.some(r => r.test(f)));

// Table chemin-source → slug, nécessaire pour résoudre les références croisées.
for (const f of fichiers) slugDe.set(f, slugifie(f.replace(/\.md$/, '')));

const DOSSIER = path.join(WEB, 'wiki', 'articles');
fs.mkdirSync(DOSSIER, { recursive: true });

const index = [];
const liensMorts = [];
let totalEchelons = 0;

for (const rel of fichiers) {
  const brut = fs.readFileSync(path.join(LORE, rel), 'utf8');
  compteEchelons = {};
  fichierCourant = rel;

  const tokens = md.parse(brut, {});
  const ancres = [];
  poseAncres(tokens, ancres);

  // 3. Réécriture des liens internes *.md → article du wiki.
  for (const t of tokens) {
    const enfants = t.children || (t.type === 'inline' ? t.children : null);
    for (const c of (enfants || [])) {
      if (c.type !== 'link_open') continue;
      const href = c.attrGet('href') || '';
      if (/^(https?:|mailto:|#)/.test(href) || !href.includes('.md')) continue;
      const [cible, ancre] = href.split('#');
      const resolu = path.posix.normalize(path.posix.join(path.posix.dirname(rel), cible))
                         .replace(/^\.\//, '');
      const s = slugDe.get(resolu);
      if (s) c.attrSet('href', `${s}.html${ancre ? '#' + ancre : ''}`);
      else { liensMorts.push({ depuis: rel, href }); c.attrSet('data-lien-mort', '1'); }
    }
  }

  const corps = md.renderer.render(tokens, md.options, {});
  const titre = (brut.match(/^#\s+(.+)$/m)?.[1] || path.basename(rel, '.md')).replace(/[*`]/g, '').trim();
  const section = rel.includes('/') ? rel.split('/')[0] : 'racine';
  const slug = slugDe.get(rel);

  const n = Object.values(compteEchelons).reduce((a, b) => a + b, 0);
  totalEchelons += n;

  // Fragment autonome : pas de <html>, il s'injecte dans le panneau de l'atlas.
  const html =
`<!-- Inarama wiki — généré par tools/build-wiki.mjs
     source : ${rel}
     lore   : ${prov.commit || 'inconnu'} (${prov.date || 'date inconnue'}) -->
<article class="wiki-art" data-slug="${slug}" data-section="${section}">
${corps}</article>
`;
  fs.writeFileSync(path.join(DOSSIER, `${slug}.html`), html, 'utf8');

  index.push({ slug, titre, section, source: rel, ancres,
               echelons: compteEchelons, octets: Buffer.byteLength(html) });
}

const meta = {
  genereePar: 'tools/build-wiki.mjs',
  lore: { depot: 'BillyMcL/Inarama-lore', commit: prov.commit, commitCourt: prov.commitCourt, date: prov.date },
  articles: index.length,
  echelonsTotal: totalEchelons,
  exclus: EXCLUS.map(String),
};
fs.writeFileSync(path.join(WEB, 'wiki', 'index.json'),
  JSON.stringify({ meta, articles: index }, null, 1), 'utf8');

/* ─────────────────────────── rapport ─────────────────────────── */

const ko = n => (n / 1024).toFixed(0) + ' Ko';
console.log(`lore      : ${prov.commitCourt || '?'} (${prov.date || 'date inconnue'})`);
console.log(`articles  : ${index.length} écrits dans wiki/articles/`);
console.log(`échelons  : ${totalEchelons} balises rendues en pastilles`);
const parSection = {};
for (const a of index) parSection[a.section] = (parSection[a.section] || 0) + 1;
console.log(`sections  : ${Object.entries(parSection).map(([s, n]) => `${s}(${n})`).join(' ')}`);
console.log(`poids     : ${ko(index.reduce((a, b) => a + b.octets, 0))} au total, `
          + `plus gros ${ko(Math.max(...index.map(a => a.octets)))}`);
console.log(`ancres H2 : ${index.reduce((a, b) => a + b.ancres.length, 0)}`);
console.log(`renvois   : ${refsResolues} références croisées rendues cliquables`);
if (liensMorts.length) {
  console.log(`⚠ liens markdown non résolus : ${liensMorts.length}`);
  for (const l of liensMorts.slice(0, 10)) console.log(`   ${l.depuis} → ${l.href}`);
}
if (refsNonResolues.length) {
  console.log(`⚠ références .md non résolues : ${refsNonResolues.length}`);
  for (const l of refsNonResolues.slice(0, 10)) console.log(`   ${l.depuis} → ${l.ref}`);
}
