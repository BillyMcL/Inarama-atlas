# -*- coding: utf-8 -*-
"""Decoupe le master en trois calques SVG, tels quels.

Le master svg_vielle_carte_final.svg fait autorite. On n'y redessine rien : on
en extrait trois groupes, on remplace le parchemin en base64 par un fichier
externe (meme image, cadree 1:1 sur le viewBox), et on jette l'apercu de carte
qui n'est qu'un emplacement — les vraies tuiles viennent s'y inscrire.

  feuille.svg    la feuille, remplie de parchemin, sous les tuiles
  grille.svg     le graticule, au-dessus des tuiles
  ornements.svg  l'anneau d'ornements, qui masque ce qui n'est pas cartographie

Les trois partagent le viewBox du master : superposes aux memes bornes, ils se
recalent exactement, sans calcul de ma part.
"""
import os, re, xml.etree.ElementTree as ET
from PIL import Image

SVG = 'http://www.w3.org/2000/svg'
ET.register_namespace('', SVG)
RACINE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MASTER = os.path.join(RACINE, 'svg_vielle_carte_final.svg')
SORTIE = os.path.join(RACINE, 'web', 'svg')
VB = '0 0 8857 8925'
FIN = 0.42          # les traits du master sont calibres pour l'impression

r = ET.parse(MASTER).getroot()
def q(n): return '{%s}%s' % (SVG, n)
def par_id(i, tag='*'):
    for e in r.iter():
        if e.get('id') == i: return e
    raise SystemExit('introuvable : ' + i)

# couleur de secours : la teinte dominante du parchemin, le temps qu'il charge
im = Image.open(os.path.join(RACINE, 'web', 'img', 'parchemin.jpg')).resize((64, 64))
px = list(im.getdata()); n = len(px)
SECOURS = '#%02x%02x%02x' % tuple(sum(c[k] for c in px) // n for k in range(3))

def racine_svg():
    s = ET.Element(q('svg'))
    s.set('viewBox', VB); s.set('preserveAspectRatio', 'none')
    return s

def parchemin(parent, cle, chemin_d):
    """Le parchemin, decoupe par un trace, exactement comme dans le master."""
    d = ET.SubElement(parent, q('defs'))
    cp = ET.SubElement(d, q('clipPath')); cp.set('id', cle)
    ET.SubElement(cp, q('path')).set('d', chemin_d)
    g = ET.SubElement(parent, q('g')); g.set('clip-path', 'url(#%s)' % cle)
    im = ET.SubElement(g, q('image'))
    im.set('href', 'img/parchemin.jpg')
    im.set('x', '0'); im.set('y', '0'); im.set('width', '8857'); im.set('height', '8925')
    im.set('preserveAspectRatio', 'none')
    return g

def ecrire(nom, elem, note):
    txt = ET.tostring(elem, encoding='unicode')
    txt = '<!-- %s — extrait de svg_vielle_carte_final.svg, ne pas editer a la main -->\n%s' % (note, txt)
    p = os.path.join(SORTIE, nom)
    open(p, 'w', encoding='utf-8').write(txt)
    return p, len(txt)

# ── 1. la feuille ────────────────────────────────────────────────────────────
s = racine_svg()
f = ET.SubElement(s, q('path'))
f.set('d', par_id('Feuille-').get('d')); f.set('fill', SECOURS)
parchemin(s, 'clipFeuille', par_id('Feuille-1').get('d'))
print('%-16s %6d o' % ecrire('feuille.svg', s, 'La feuille')[::-1][:1] + ('feuille.svg',) if False else '%s %d o' % ecrire('feuille.svg', s, 'La feuille'))

# ── 2. la grille ─────────────────────────────────────────────────────────────
s = racine_svg()
g = par_id('grille')
s.append(g)
traits = 0
for e in s.iter():
    st = e.get('style')
    if not st or 'stroke-width' not in st: continue
    st = re.sub(r'stroke-width:([0-9.]+)px', lambda m: 'stroke-width:%.3fpx' % (float(m.group(1)) * FIN), st)
    st = re.sub(r'stroke:\s*black', 'stroke:#2a2118', st)
    # l'epaisseur cesse de suivre l'echelle : un trait de carte garde sa finesse
    # a tous les zooms, ce qu'aucun reglage de Leaflet ne sait faire.
    e.set('style', st + ';vector-effect:non-scaling-stroke')
    traits += 1
print('%s %d o  (%d traits)' % (ecrire('grille.svg', s, 'Le graticule') + (traits,)))

# ── 3. les ornements ─────────────────────────────────────────────────────────
s = racine_svg()
o = par_id('Ornement')
fond = par_id('Ornement-')
p = ET.SubElement(s, q('path')); p.set('d', fond.get('d')); p.set('fill', SECOURS)
p.set('fill-rule', 'evenodd')     # l'anneau a un trou : la carte
parchemin(s, 'clipOrnement', par_id('Ornement-1').get('d'))
gardes = 0
for enf in list(o):
    if enf.get('id') in ('nuages', 'contour', 'cadres', 'ROSES'):
        s.append(enf); gardes += 1
print('%s %d o  (%d groupes)' % (ecrire('ornements.svg', s, 'Les ornements') + (gardes,)))
print('secours', SECOURS)
