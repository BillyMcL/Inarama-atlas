# -*- coding: utf-8 -*-
"""Construit la pyramide de tuiles du DECOR, dans le repere de la carte.

Le decor, ce sont les rendus 3D assembles par mosaique.py : table, feuille,
ornements, objets, bougies. La carte viendra se poser dans la fenetre laissee
vide au centre.

Un niveau par zoom, empile du plus grossier au plus fin :
  A (vue d'ensemble) sert de fond partout — c'est le seul palier qui va jusqu'au
  bord de la table ; B puis C viennent le recouvrir la ou ils portent, c'est-a-
  dire au centre. On ne voit donc jamais de trou : au pire du flou, et seulement
  dans les marges ou l'on ne s'attarde pas.

Les tuiles sont calees sur la grille de la carte : la tuile (z,x,y) couvre le
monde [x*256/s, (x+1)*256/s]. Leaflet les superpose alors sans un pixel d'ecart.
"""
import os
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
import numpy as np, json, sys

# Les mosaiques intermediaires (une quarantaine de Mo) restent HORS du depot :
# elles se refabriquent depuis les rendus, il n'y a pas a les versionner.
INTER = os.environ.get('INARAMA_INTER', os.path.join(os.environ.get('TEMP', '.'), 'inarama'))
RACINE  = r'D:\Desktop\claude qgis'
SORTIE  = os.path.join(RACINE, 'web', 'tiles', 'decor')
TUILE   = 256
ECRAN   = (2560, 1440)      # ecran de reference pour dimensionner les marges

W_MONDE, H_MONDE = 18764, 26784
SX = W_MONDE / (3000 * 1.141732); SY = H_MONDE / (4280 * 1.141732)
FEUILLE = (-2653.172283 * SX, -2019.192913 * SY,
           -2653.172283 * SX + 8857 * SX, -2019.192913 * SY + 8925 * SY)


def charge(p):
    im = Image.open(os.path.join(INTER, 'mosaique_%s.png' % p))
    cal = json.load(open(os.path.join(INTER, 'mosaique_%s.json' % p)))
    return im, cal


def niveau(zoom, paliers):
    """Canvas du niveau et son origine, en px de ce zoom."""
    s = 2.0 ** (zoom - 7)
    fx0, fy0, fx1, fy1 = FEUILLE
    mx, my = ECRAN[0] / 2 / s, ECRAN[1] / 2 / s        # demi-ecran, en px monde
    X0 = (fx0 - mx) * s; X1 = (fx1 + mx) * s
    Y0 = (fy0 - my) * s; Y1 = (fy1 + my) * s
    # borne par ce que le palier le plus large sait couvrir
    im, cal = charge(paliers[0]); k = s / (2.0 ** (cal['zoom'] - 7))
    X0 = max(X0, cal['x0'] * k); X1 = min(X1, (cal['x0'] + cal['w']) * k)
    Y0 = max(Y0, cal['y0'] * k); Y1 = min(Y1, (cal['y0'] + cal['h']) * k)
    # calage sur la grille de tuiles
    X0 = np.floor(X0 / TUILE) * TUILE; Y0 = np.floor(Y0 / TUILE) * TUILE
    W = int(np.ceil((X1 - X0) / TUILE) * TUILE)
    H = int(np.ceil((Y1 - Y0) / TUILE) * TUILE)
    canvas = Image.new('RGB', (W, H), (12, 8, 4))
    for p in paliers:
        im, cal = charge(p)
        k = s / (2.0 ** (cal['zoom'] - 7))
        w, h = int(round(cal['w'] * k)), int(round(cal['h'] * k))
        r = im.resize((w, h), Image.LANCZOS if k < 1 else Image.BICUBIC)
        canvas.paste(r, (int(round(cal['x0'] * k - X0)), int(round(cal['y0'] * k - Y0))))
        print('   %s : %dx%d colle en (%d,%d)'
              % (p, w, h, cal['x0'] * k - X0, cal['y0'] * k - Y0))
    return canvas, int(X0), int(Y0)


def decoupe(canvas, X0, Y0, zoom):
    n = 0
    for ty in range(canvas.size[1] // TUILE):
        for tx in range(canvas.size[0] // TUILE):
            t = canvas.crop((tx * TUILE, ty * TUILE, (tx + 1) * TUILE, (ty + 1) * TUILE))
            gx = X0 // TUILE + tx; gy = Y0 // TUILE + ty
            d = os.path.join(SORTIE, str(zoom), str(gx))
            os.makedirs(d, exist_ok=True)
            t.save(os.path.join(d, '%d.jpg' % gy), quality=84, optimize=True)
            n += 1
    return n


if __name__ == '__main__':
    plan = {1: ['A'], 2: ['A'], 3: ['A', 'B'], 4: ['A', 'B', 'C']}
    for z in [int(a) for a in sys.argv[1:]]:
        print('niveau %d' % z)
        c, X0, Y0 = niveau(z, plan[z])
        print('   canvas %dx%d, origine (%d,%d)' % (c.size[0], c.size[1], X0, Y0))
        print('   %d tuiles' % decoupe(c, X0, Y0, z))
