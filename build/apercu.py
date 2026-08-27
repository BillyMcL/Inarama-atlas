# -*- coding: utf-8 -*-
"""Recompose hors navigateur ce que la page affiche, pour pouvoir le REGARDER.

La fenetre du navigateur pilotee ici ne composite pas d'images : impossible d'en
tirer une capture. On refait donc le meme empilement a partir des memes fichiers
— tuiles du decor, tuiles de la carte, decoupe sur le trace de l'ouverture — ce
qui verifie du meme coup que la geometrie tombe juste.

  python apercu.py <zoom> <largeur> <hauteur> [cx cy]
"""
import os
from PIL import Image, ImageDraw
Image.MAX_IMAGE_PIXELS = None
import re, os, sys, xml.etree.ElementTree as ET

RACINE = r'D:\Desktop\claude qgis'
WEB    = os.path.join(RACINE, 'web')
# Les mosaiques intermediaires (une quarantaine de Mo) restent HORS du depot :
# elles se refabriquent depuis les rendus, il n'y a pas a les versionner.
INTER = os.environ.get('INARAMA_INTER', os.path.join(os.environ.get('TEMP', '.'), 'inarama'))
TUILE  = 256
SX = 18764 / (3000 * 1.141732); SY = 26784 / (4280 * 1.141732)
MX0 = -2653.172283 * SX; MY0 = -2019.192913 * SY


def colle(dossier, zoom, X0, Y0, W, H, ext):
    """assemble les tuiles couvrant [X0,X0+W]x[Y0,Y0+H] en px de ce zoom"""
    im = Image.new('RGB', (W, H), (12, 8, 4))
    for tx in range(X0 // TUILE, (X0 + W) // TUILE + 1):
        for ty in range(Y0 // TUILE, (Y0 + H) // TUILE + 1):
            p = os.path.join(WEB, 'tiles', dossier, str(zoom), str(tx), '%d.%s' % (ty, ext))
            if not os.path.exists(p): continue
            im.paste(Image.open(p).convert('RGB'), (tx * TUILE - X0, ty * TUILE - Y0))
    return im


def sommets_fenetre():
    d = ET.parse(os.path.join(WEB, 'svg', 'fenetre.svg')).getroot()
    dd = d.find('.//{http://www.w3.org/2000/svg}path').get('d')
    jet = re.findall(r'([MmLlHhVvCcSsZz])([^MmLlHhVvCcSsZz]*)', dd)
    def nums(s): return [float(x) for x in re.findall(r'-?\d*\.?\d+(?:[eE][-+]?\d+)?', s)]
    def cub(p0, p1, p2, p3, n=16):
        for i in range(1, n + 1):
            t = i / n; u = 1 - t
            yield (u**3*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t**3*p3[0],
                   u**3*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t**3*p3[1])
    P = []; cur = (0, 0); st = (0, 0); pc = None
    for c, a in jet:
        v = nums(a); rel = c.islower(); C = c.upper()
        if C == 'M':
            for i in range(0, len(v), 2):
                p = (v[i] + (cur[0] if rel else 0), v[i+1] + (cur[1] if rel else 0))
                if i == 0: st = p
                P.append(p); cur = p
            pc = None
        elif C == 'L':
            for i in range(0, len(v), 2):
                cur = (v[i] + (cur[0] if rel else 0), v[i+1] + (cur[1] if rel else 0)); P.append(cur)
            pc = None
        elif C == 'C':
            for i in range(0, len(v), 6):
                b = cur if rel else (0, 0)
                p1 = (v[i]+b[0], v[i+1]+b[1]); p2 = (v[i+2]+b[0], v[i+3]+b[1]); p3 = (v[i+4]+b[0], v[i+5]+b[1])
                P.extend(cub(cur, p1, p2, p3)); cur = p3; pc = p2
        elif C == 'S':
            for i in range(0, len(v), 4):
                b = cur if rel else (0, 0)
                p1 = (2*cur[0]-pc[0], 2*cur[1]-pc[1]) if pc else cur
                p2 = (v[i]+b[0], v[i+1]+b[1]); p3 = (v[i+2]+b[0], v[i+3]+b[1])
                P.extend(cub(cur, p1, p2, p3)); cur = p3; pc = p2
        elif C == 'Z':
            P.append(st); cur = st; pc = None
    return P


if __name__ == '__main__':
    zoom = int(sys.argv[1]); W = int(sys.argv[2]); H = int(sys.argv[3])
    cx = float(sys.argv[4]) if len(sys.argv) > 4 else MX0 + 8857 * SX / 2
    cy = float(sys.argv[5]) if len(sys.argv) > 5 else MY0 + 8925 * SY / 2
    s = 2.0 ** (zoom - 7)
    X0 = int(round(cx * s - W / 2)); Y0 = int(round(cy * s - H / 2))

    vue = colle('decor', zoom, X0, Y0, W, H, 'jpg')
    carte = colle('tolkien', zoom, X0, Y0, W, H, 'jpg')
    # meme etalonnage que le site (feColorMatrix #tonCarte)
    import numpy as np
    carte = Image.fromarray(np.clip(np.asarray(carte, float) * np.array([0.845, 0.663, 0.442])
                                    + np.array([-42.3, -28.9, -14.7]), 0, 255).astype('uint8'))

    masque = Image.new('L', (W, H), 0)
    # meme correction de calage que le site : le trou du master tombe a 64,3
    # unites master de l'encre reellement rendue (mesure, voir index.html)
    DX, DY = 64.3, 5.8
    Q = [((MX0 + (x + DX) * SX) * s - X0, (MY0 + (y + DY) * SY) * s - Y0)
         for x, y in sommets_fenetre()]
    ImageDraw.Draw(masque).polygon(Q, fill=255)
    vue.paste(carte, (0, 0), masque)

    p = os.path.join(INTER, 'apercu_z%d.png' % zoom)
    vue.save(p)
    print('ECRIT %s  (%dx%d, zoom %d)' % (p, W, H, zoom))
