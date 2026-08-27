# -*- coding: utf-8 -*-
"""Verifie l'alignement OUVERTURE / ORNEMENTS / CARTE sur les fichiers livres.

On ne mesure pas sur les intermediaires mais sur les TUILES telles que le site
les sert : c'est le seul etat qui compte. Pour chaque niveau on cherche la
translation qui pose le trace de l'ouverture sur l'encre des ornements. Zero
signifie que les trois couches coincident.
"""
from PIL import Image, ImageDraw
Image.MAX_IMAGE_PIXELS = None
import numpy as np, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from apercu import sommets_fenetre, colle, MX0, MY0, SX, SY


def residu(zoom, W=1600, H=1200):
    s = 2.0 ** (zoom - 7)
    cx = MX0 + 8857 * SX / 2; cy = MY0 + 8925 * SY / 2
    X0 = int(round(cx * s - W / 2)); Y0 = int(round(cy * s - H / 2))
    dec = np.asarray(colle('decor', zoom, X0, Y0, W, H, 'jpg').convert('L'), dtype=float)
    encre = (dec < 70).astype(np.float32)
    Q = np.array([((MX0 + x * SX) * s - X0, (MY0 + y * SY) * s - Y0) for x, y in sommets_fenetre()])

    def masque(pts):
        m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon([tuple(p) for p in pts], fill=255)
        return np.asarray(m) > 127

    def dedans(dx, dy):
        m = masque(Q + np.array([dx, dy]))
        return float(encre[m].mean()) if m.sum() > 1000 else 9.0

    best = (dedans(0, 0), 0, 0)
    zero = best[0]
    for dx in range(-40, 41, 4):
        for dy in range(-40, 41, 4):
            v = dedans(dx, dy)
            if v < best[0]: best = (v, dx, dy)
    b = best
    for dx in range(best[1] - 3, best[1] + 4):
        for dy in range(best[2] - 3, best[2] + 4):
            v = dedans(dx, dy)
            if v < b[0]: b = (v, dx, dy)
    print('zoom %d : residu dx=%+3d dy=%+3d px  ->  %+5.0f / %+5.0f px monde'
          '   (encre dans l ouverture : %.3f %% a zero, %.3f %% au mieux)'
          % (zoom, b[1], b[2], b[1] / s, b[2] / s, 100 * zero, 100 * b[0]))
    return b[1] / s, b[2] / s


if __name__ == '__main__':
    for z in [int(a) for a in (sys.argv[1:] or ['2', '3', '4'])]:
        residu(z)
