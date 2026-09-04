# -*- coding: utf-8 -*-
"""Recompose EXACTEMENT ce que la page affiche aujourd'hui (build 2026-08-27i).

Empilement reel, dans l'ordre :
  1. les tuiles du decor ;
  2. les tuiles de la carte, bornees au seul RECTANGLE DU MONDE (l'ouverture ne
     les borne plus depuis le 27h), teintees par la chaine de filtres ;
  3. les memes tuiles du decor, bornees au COMPLEMENTAIRE de l'ouverture, par
     dessus — c'est elles qui masquent ce que la carte deborde.

  python apercu27.py <zoom> <largeur> <hauteur> [cx cy]
"""
import os, sys
from PIL import Image, ImageDraw
Image.MAX_IMAGE_PIXELS = None
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from apercu import colle, MX0, MY0, SX, SY

def sommets_fenetre():
    """depuis data/fenetre.js, qui est ce que la page charge vraiment"""
    import re
    t = open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                          'data', 'fenetre.js'), encoding='utf-8').read()
    return [(float(a), float(b)) for a, b in
            re.findall(r'\[(-?[\d.]+),(-?[\d.]+)\]', t)]

W_MONDE, H_MONDE = 18764, 26784
SORTIE = os.environ.get('INARAMA_INTER', '.')


def teinte(im):
    """la chaine CSS du 27i, avec l'ecretage que fait le navigateur a chaque etape"""
    I = np.eye(3)
    SEP = np.array([[0.393, 0.769, 0.189], [0.349, 0.686, 0.168], [0.272, 0.534, 0.131]])
    def sat(s):
        return np.array([[0.213+0.787*s, 0.715-0.715*s, 0.072-0.072*s],
                         [0.213-0.213*s, 0.715+0.285*s, 0.072-0.072*s],
                         [0.213-0.213*s, 0.715-0.715*s, 0.072+0.928*s]])
    def hue(h):
        co, si = np.cos(np.radians(h)), np.sin(np.radians(h))
        return np.array([
            [0.213+co*0.787-si*0.213, 0.715-co*0.715-si*0.715, 0.072-co*0.072+si*0.928],
            [0.213-co*0.213+si*0.143, 0.715+co*0.285+si*0.140, 0.072-co*0.072-si*0.283],
            [0.213-co*0.213-si*0.787, 0.715-co*0.715+si*0.715, 0.072+co*0.928+si*0.072]])
    X = np.asarray(im, dtype=np.float32) / 255.0
    for M in (I*0+ (0*I+SEP), sat(2.087), hue(-9.9)):
        X = np.clip(X @ M.T, 0, 1)
    X = np.clip(X * 0.457, 0, 1)
    X = np.clip(X * 1.177 + (0.5 - 0.5*1.177), 0, 1)
    return Image.fromarray((X*255).astype(np.uint8))


def vue(zoom, W, H, cx=None, cy=None):
    s = 2.0 ** (zoom - 7)
    if cx is None: cx = MX0 + 8857*SX/2
    if cy is None: cy = MY0 + 8925*SY/2
    X0 = int(round(cx*s - W/2)); Y0 = int(round(cy*s - H/2))

    decor = colle('decor', zoom, X0, Y0, W, H, 'jpg')
    carte = teinte(colle('tolkien', zoom, X0, Y0, W, H, 'jpg'))

    # 2. la carte, bornee au seul rectangle du monde
    rect = Image.new('L', (W, H), 0)
    ImageDraw.Draw(rect).rectangle([0-X0, 0-Y0, W_MONDE*s-X0, H_MONDE*s-Y0], fill=255)
    im = decor.copy()
    im.paste(carte, (0, 0), rect)

    # 3. l'anneau : le decor borne au complementaire de l'ouverture
    Q = [((MX0 + x*SX)*s - X0, (MY0 + y*SY)*s - Y0) for x, y in sommets_fenetre()]
    trou = Image.new('L', (W, H), 0)
    ImageDraw.Draw(trou).polygon(Q, fill=255)
    dehors = Image.fromarray(255 - np.asarray(trou))
    im.paste(decor, (0, 0), dehors)

    p = os.path.join(SORTIE, 'apercu27_z%s.png' % str(zoom).replace('.', '_'))
    im.save(p)
    print('ECRIT', p, '(%dx%d, zoom %s)' % (W, H, zoom))
    # ou tombe le bord haut du monde, et celui de l'ouverture ?
    print('   bord HAUT du monde     a y=%.0f px' % (0*s - Y0))
    print('   bord HAUT de l ouverture a y=%.0f px' % (min(q[1] for q in Q)))
    return p


if __name__ == '__main__':
    z = float(sys.argv[1]); W = int(sys.argv[2]); H = int(sys.argv[3])
    cx = float(sys.argv[4]) if len(sys.argv) > 4 else None
    cy = float(sys.argv[5]) if len(sys.argv) > 5 else None
    vue(int(z), W, H, cx, cy)
