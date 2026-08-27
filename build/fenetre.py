# -*- coding: utf-8 -*-
"""Aplatit l'ouverture des ornements en une liste de sommets, pour le site.

Pourquoi ne plus servir un clipPath SVG. La page decoupait ses couches avec
`clip-path: url(#...)`, qui renvoie a un <clipPath> injecte dans le document.
Chrome le suit ; le Safari des iPhone l'ignore. Et quand il l'ignore, le calque
d'ornement — qui est le decor entier prive de son ouverture — n'est plus decoupe
du tout : il recouvre l'ecran, et il ne reste que le decor. C'est exactement ce
qu'on voyait sur telephone.

`clip-path: polygon(...)` n'a pas ce defaut : il ne reference rien, et tous les
navigateurs qui connaissent clip-path le connaissent. Il lui faut des sommets,
d'ou ce script.

Sortie : web/data/fenetre.js, dans les coordonnees du master (8857x8925).
"""
import os, re, sys, xml.etree.ElementTree as ET

RACINE = r'D:\Desktop\claude qgis'
MASTER = os.path.join(RACINE, 'svg_vielle_carte_final.svg')
SORTIE = os.path.join(RACINE, 'web', 'data', 'fenetre.js')

# Tolerance : l'ouverture ne se voit plus au-dela du zoom 4,1 environ, ou elle
# fait 6000 px de large a l'ecran. Une unite master y vaut 0,68 px : a 1,5 unite
# on reste sous le pixel, la courbe ne peut pas se lire comme brisee.
TOLERANCE = 1.5


def sommets(d):
    jet = re.findall(r'([MmLlHhVvCcSsZz])([^MmLlHhVvCcSsZz]*)', d)
    def nums(s): return [float(x) for x in re.findall(r'-?\d*\.?\d+(?:[eE][-+]?\d+)?', s)]
    def cub(p0, p1, p2, p3, n=20):
        for i in range(1, n + 1):
            t = i / n; u = 1 - t
            yield (u**3*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t**3*p3[0],
                   u**3*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t**3*p3[1])
    S = []; cur = (0.0, 0.0); st = (0.0, 0.0); pc = None; sous = []
    for c, a in jet:
        v = nums(a); rel = c.islower(); C = c.upper()
        if C == 'M':
            if sous: S.append(sous); sous = []
            for i in range(0, len(v), 2):
                p = (v[i] + (cur[0] if rel else 0), v[i+1] + (cur[1] if rel else 0))
                if i == 0: st = p
                sous.append(p); cur = p
            pc = None
        elif C == 'L':
            for i in range(0, len(v), 2):
                cur = (v[i] + (cur[0] if rel else 0), v[i+1] + (cur[1] if rel else 0)); sous.append(cur)
            pc = None
        elif C == 'H':
            for x in v: cur = (x + (cur[0] if rel else 0), cur[1]); sous.append(cur)
            pc = None
        elif C == 'V':
            for y in v: cur = (cur[0], y + (cur[1] if rel else 0)); sous.append(cur)
            pc = None
        elif C == 'C':
            for i in range(0, len(v), 6):
                b = cur if rel else (0, 0)
                p1 = (v[i]+b[0], v[i+1]+b[1]); p2 = (v[i+2]+b[0], v[i+3]+b[1]); p3 = (v[i+4]+b[0], v[i+5]+b[1])
                sous.extend(cub(cur, p1, p2, p3)); cur = p3; pc = p2
        elif C == 'S':
            for i in range(0, len(v), 4):
                b = cur if rel else (0, 0)
                p1 = (2*cur[0]-pc[0], 2*cur[1]-pc[1]) if pc else cur
                p2 = (v[i]+b[0], v[i+1]+b[1]); p3 = (v[i+2]+b[0], v[i+3]+b[1])
                sous.extend(cub(cur, p1, p2, p3)); cur = p3; pc = p2
        elif C == 'Z':
            sous.append(st); cur = st; pc = None
    if sous: S.append(sous)
    return S


def simplifie(pts, tol):
    """Douglas-Peucker, iteratif : la recursion deborde sur 30 000 sommets."""
    if len(pts) < 3: return pts[:]
    garde = [False] * len(pts); garde[0] = garde[-1] = True
    pile = [(0, len(pts) - 1)]
    while pile:
        i, j = pile.pop()
        if j <= i + 1: continue
        ax, ay = pts[i]; bx, by = pts[j]
        dx, dy = bx - ax, by - ay
        n = (dx * dx + dy * dy) ** 0.5
        pire, k = -1.0, -1
        for m in range(i + 1, j):
            px, py = pts[m]
            e = abs(dy * px - dx * py + bx * ay - by * ax) / n if n else \
                ((px - ax) ** 2 + (py - ay) ** 2) ** 0.5
            if e > pire: pire, k = e, m
        if pire > tol:
            garde[k] = True; pile.append((i, k)); pile.append((k, j))
    return [p for p, g in zip(pts, garde) if g]


def main():
    r = ET.parse(MASTER).getroot()
    d = r.find(".//{http://www.w3.org/2000/svg}path[@id='Ornement-1']").get('d')
    trou = sommets(d)[1]                       # le second sous-chemin = l'ouverture
    reduit = simplifie(trou, TOLERANCE)
    xs = [p[0] for p in reduit]; ys = [p[1] for p in reduit]
    print('ouverture : %d sommets -> %d (tolerance %.1f unite master)'
          % (len(trou), len(reduit), TOLERANCE))
    print('   emprise x[%.0f %.0f] y[%.0f %.0f]' % (min(xs), max(xs), min(ys), max(ys)))
    corps = ','.join('[%.1f,%.1f]' % p for p in reduit)
    txt = ('/* Ouverture des ornements, aplatie depuis le master (%d sommets,\n'
           '   tolerance %.1f unite master, soit moins d\'un pixel au zoom le plus\n'
           '   profond ou elle se voit). Genere par web/build/fenetre.py. */\n'
           'window.INARAMA_FENETRE=[%s];\n') % (len(reduit), TOLERANCE, corps)
    os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
    open(SORTIE, 'w', encoding='utf-8').write(txt)
    print('ECRIT %s  %.1f Ko' % (SORTIE, os.path.getsize(SORTIE) / 1024))


if __name__ == '__main__':
    main()
