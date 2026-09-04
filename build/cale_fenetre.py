# -*- coding: utf-8 -*-
"""Recale l'ouverture sur l'ENCRE reellement dessinee, sommet par sommet.

Le probleme. Le trace `Ornement-1` du master passe en retrait de l'encre des
ornements : 72 px monde de mediane, 244 au 90e centile. La carte s'arrete donc
avant que l'ornement ne commence, et il reste entre les deux une bande de
parchemin nu. Cet ecart est CONSTANT en unites monde : invisible a la vue
d'ensemble (2 px), il devient criant en s'approchant (61 px au zoom 5). D'ou un
defaut qui « revient quand on se rapproche ».

La correction. Pour chaque sommet, on marche vers l'exterieur jusqu'a rencontrer
l'encre, et on deplace le sommet d'autant, plus une marge : la carte passe alors
SOUS l'ornement, qui recouvre le raccord. Les distances sont lissees le long du
contour, sinon le trace tremblerait au gre du grain de l'encre.

On mesure sur les tuiles du decor — c'est ce que l'ecran montre, pas ce que le
master pretend.

  python cale_fenetre.py [marge_px_monde]
"""
import os, sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from apercu import colle, MX0, MY0, SX, SY

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SORTIE = os.path.join(RACINE, 'data', 'fenetre.js')
ZOOM = 4                    # le niveau natif le plus fin du decor
MARGE = 48.0                # px monde dont la carte passe SOUS l'encre
LISSAGE = 9                 # sommets, pour ne pas suivre le grain


def sommets():
    import re
    t = open(SORTIE, encoding='utf-8').read()
    return [(float(a), float(b)) for a, b in re.findall(r'\[(-?[\d.]+),(-?[\d.]+)\]', t)]


def main(marge=MARGE):
    s = 2.0 ** (ZOOM - 7)
    F = sommets()
    xs = [MX0 + x*SX for x, y in F]; ys = [MY0 + y*SY for x, y in F]
    X0 = int(min(xs)*s) - 60; Y0 = int(min(ys)*s) - 60
    W = int((max(xs)-min(xs))*s) + 120; H = int((max(ys)-min(ys))*s) + 120
    # DENSITE d'encre, et non premier pixel noir : l'ornement est grave en
    # hachures, pas en aplat. Marcher jusqu'au premier trait tombe sur une
    # hachure isolee et s'arrete trop tot ; on cherche donc l'endroit ou le
    # dessin devient DENSE, ce qui est la vraie lisiere visuelle.
    from PIL import ImageFilter
    gris = colle('decor', ZOOM, X0, Y0, W, H, 'jpg').convert('L')
    brut = Image.fromarray(((np.asarray(gris, dtype=float) < 70) * 255).astype(np.uint8))
    dens = np.asarray(brut.filter(ImageFilter.BoxBlur(14)), dtype=float) / 255.0
    encre = dens > 0.06

    Q = np.array([[(MX0 + x*SX)*s - X0, (MY0 + y*SY)*s - Y0] for x, y in F])
    C = Q.mean(axis=0)
    n = len(Q)

    # normale exterieure et distance a l'encre, pour chaque sommet
    N = np.zeros((n, 2)); D = np.full(n, np.nan)
    for i in range(n):
        t = Q[(i+1) % n] - Q[i-1]
        v = np.array([t[1], -t[0]]); L = np.hypot(*v)
        if L < 1e-6: v = Q[i] - C; L = max(np.hypot(*v), 1e-6)
        v = v / L
        if np.dot(v, Q[i] - C) < 0: v = -v
        N[i] = v
        for k in range(0, 90):
            q = (Q[i] + v*k).round().astype(int)
            if not (0 <= q[0] < W and 0 <= q[1] < H): break
            if encre[q[1], q[0]]: D[i] = k; break

    trouves = np.isfinite(D)
    print('encre trouvee pour %d sommets sur %d' % (trouves.sum(), n))
    # les sommets sans encre heritent de leurs voisins
    idx = np.arange(n)
    D[~trouves] = np.interp(idx[~trouves], idx[trouves], D[trouves], period=n)
    # lissage circulaire : le trace ne doit pas suivre le grain du dessin
    k = np.ones(LISSAGE) / LISSAGE
    D = np.convolve(np.concatenate([D, D, D]), k, mode='same')[n:2*n]

    dep = D + marge*s
    print('deplacement : mediane %.1f px  (%.0f px monde), max %.1f px'
          % (np.median(dep), np.median(dep)/s, dep.max()))
    Q2 = Q + N * dep[:, None]

    # retour en coordonnees master
    F2 = [(((q[0] + X0)/s - MX0)/SX, ((q[1] + Y0)/s - MY0)/SY) for q in Q2]
    corps = ','.join('[%.1f,%.1f]' % p for p in F2)
    txt = ("/* Ouverture des ornements, RECALEE SUR L'ENCRE des tuiles du decor.\n"
           "   Le trace du master passait en retrait : la carte s'arretait avant\n"
           "   l'ornement et laissait une bande de parchemin nu, d'autant plus\n"
           "   visible qu'on s'approchait. Chaque sommet a ete deplace vers\n"
           "   l'exterieur jusqu'a l'encre, plus %.0f px monde de marge, pour que la\n"
           "   carte passe SOUS l'ornement. Genere par web/build/cale_fenetre.py. */\n"
           "window.INARAMA_FENETRE=[%s];\n") % (marge, corps)
    open(SORTIE, 'w', encoding='utf-8').write(txt)
    print('ECRIT %s  %.1f Ko' % (SORTIE, os.path.getsize(SORTIE)/1024))


if __name__ == '__main__':
    main(float(sys.argv[1]) if len(sys.argv) > 1 else MARGE)
