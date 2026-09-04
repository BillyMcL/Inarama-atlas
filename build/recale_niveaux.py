# -*- coding: utf-8 -*-
"""Recale les niveaux du decor entre eux, par decalage ENTIER de pixels.

Le probleme, mesure sur les tuiles livrees. Chaque niveau de zoom du decor vient
d'un palier de rendu different : les zooms 1-2 du palier A, le 3 du palier B, le
4 (et au-dela) du palier C. Or ces paliers ne sont pas cales entre eux :

    niveau 3 contre niveau 2 : +2,49 / +0,84 px du zoom 3  =  +40 / +13 px monde
    niveau 4 contre niveau 3 : -0,38 / -0,06 px          =   -6 /  -1 px monde

Les ornements sautent donc VERS LA DROITE quand le decor quitte la vue
d'ensemble pour le niveau 3, et ne rebougent plus ensuite. C'est exactement ce
qui se voit : bien place en dezoome, decale des qu'on approche.

Le palier A fait reference — c'est la vue d'ensemble, celle qui est jugee bonne.
On recale donc les niveaux 3 et 4 sur lui.

Les rendus source ayant ete effaces, on ne peut pas refabriquer les mosaiques :
on decale directement les tuiles. Le decalage tombe a moins d'un demi-pixel d'un
nombre entier, on procede donc par RECOPIE de pixels — aucun reechantillonnage,
aucune perte de nettete. Le residu est de 8 px monde au niveau 3, 2 au niveau 4 :
sous le pixel a l'ecran.

  python recale_niveaux.py
"""
import os, sys
from PIL import Image

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TUILES = os.path.join(RACINE, 'tiles', 'decor')
T = 256

# decalage a appliquer au CONTENU de chaque niveau, en pixels de ce niveau
DECALAGE = {3: (-2, -1), 4: (-4, -1)}
FOND = (12, 8, 4)


def grille(z):
    """{(x,y): chemin} des tuiles existantes"""
    d = os.path.join(TUILES, str(z)); g = {}
    for sx in os.listdir(d):
        for f in os.listdir(os.path.join(d, sx)):
            g[(int(sx), int(f.split('.')[0]))] = os.path.join(d, sx, f)
    return g


def main():
    for z, (dx, dy) in DECALAGE.items():
        g = grille(z)
        cache = {}
        def tuile(x, y):
            if (x, y) not in cache:
                p = g.get((x, y))
                cache[(x, y)] = Image.open(p).convert('RGB') if p else Image.new('RGB', (T, T), FOND)
            return cache[(x, y)]
        sortie = {}
        for (tx, ty) in g:
            # le contenu voulu est celui qui se trouve dx,dy plus loin
            gx, gy = tx*T + dx, ty*T + dy
            bloc = Image.new('RGB', (T, T), FOND)
            x0, y0 = gx // T, gy // T
            for j in (0, 1):
                for i in (0, 1):
                    src = tuile(x0+i, y0+j)
                    bloc.paste(src, ((x0+i)*T - gx, (y0+j)*T - gy))
            sortie[(tx, ty)] = bloc
        for (tx, ty), im in sortie.items():
            im.save(g[(tx, ty)], quality=84, optimize=True)
        print('niveau %d : %d tuiles decalees de (%+d,%+d) px' % (z, len(sortie), dx, dy))


if __name__ == '__main__':
    main()
