# -*- coding: utf-8 -*-
"""Assemble les rendus 3D en une mosaique, dans le repere de la CARTE.

Principe. Sur chaque palier la camera garde la meme hauteur : tous les rendus
sont donc a la MEME echelle et ne different que par une translation. Les poser
cote a cote reconstitue la scene entiere, nette, a cette echelle-la.

Choix du pixel dans les recouvrements : on prend celui du rendu dont le CENTRE
est le plus proche. Un pixel pris pres du bord d'un rendu porte le vignetage et
la parallaxe de la perspective ; pris pres du centre, il n'en porte aucun. Les
raccords tombent ainsi a mi-chemin entre deux positions de camera, la ou les
deux images se ressemblent le plus.

Sortie : une image PNG par palier, plus le calage monde qui va avec.
"""
import os
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
import numpy as np, json, os, sys

# Les mosaiques intermediaires (une quarantaine de Mo) restent HORS du depot :
# elles se refabriquent depuis les rendus, il n'y a pas a les versionner.
INTER = os.environ.get('INARAMA_INTER', os.path.join(os.environ.get('TEMP', '.'), 'inarama'))
RENDUS  = 'E:/anim_zoom/%04d.png'
CAM     = json.load(open(os.path.join(INTER, 'camera.json')))

# --- calage : repere Blender -> repere monde de la carte --------------------
# La feuille occupe le viewBox du master (8857x8925), et le master est cale sur
# le monde par le groupe "image-carte" : matrice 1.141732, decalee de
# (2653.172283, 2019.192913), pour une image de 3000x4280 qui EST la carte.
W_MONDE, H_MONDE = 18764, 26784
SX = W_MONDE / (3000 * 1.141732)          # px monde par unite de master
SY = H_MONDE / (4280 * 1.141732)
MX0 = -2653.172283 * SX                    # master (0,0) en coordonnees monde
MY0 = -2019.192913 * SY
LARG_MONDE = 8857 * SX                     # la feuille, en px monde
HAUT_MONDE = 8925 * SY

BX0, BX1, BY0, BY1, ZP = CAM['feuille']    # la feuille dans Blender
RES_X, RES_Y = CAM['res']
FOCALE, CAPTEUR = CAM['lens'], CAM['sensor']

def monde_x(bx): return MX0 + (bx - BX0) / (BX1 - BX0) * LARG_MONDE
def monde_y(by): return MY0 + (BY1 - by) / (BY1 - BY0) * HAUT_MONDE

def champ(cz):
    """largeur et hauteur du champ, en unites Blender, a la hauteur cz"""
    lg = CAPTEUR / FOCALE * (cz - ZP)
    return lg, lg * RES_Y / RES_X

PALIERS = {'A': (1, 50), 'B': (250, 550), 'C': (600, 850)}

def assemble(palier, zoom, marge_unites, sortie):
    a, b = PALIERS[palier]
    F = [x for x in CAM['frames'] if a <= x['f'] <= b]
    s = 2.0 ** (zoom - 7)                       # px ecran par px monde
    lg, ht = champ(F[0]['cz'])

    # taille d'un rendu une fois ramene a l'echelle de ce niveau
    fw = (monde_x(BX0 + lg) - monde_x(BX0)) * s
    fh = (monde_y(BY1 - ht) - monde_y(BY1)) * s
    fw_i, fh_i = int(round(fw)), int(round(fh))

    # emprise : ce que couvrent les rendus, borne par la marge utile
    cxs = [x['cx'] for x in F]; cys = [x['cy'] for x in F]
    bx_min = max(BX0 - marge_unites, min(cxs) - lg / 2)
    bx_max = min(BX1 + marge_unites, max(cxs) + lg / 2)
    by_min = max(BY0 - marge_unites, min(cys) - ht / 2)
    by_max = min(BY1 + marge_unites, max(cys) + ht / 2)
    X0 = monde_x(bx_min) * s; X1 = monde_x(bx_max) * s
    Y0 = monde_y(by_max) * s; Y1 = monde_y(by_min) * s
    MW, MH = int(round(X1 - X0)), int(round(Y1 - Y0))
    print('palier %s -> zoom %d : rendu %dx%d px, mosaique %dx%d (%.1f Mpx), %d images'
          % (palier, zoom, fw_i, fh_i, MW, MH, MW * MH / 1e6, len(F)))

    mos  = np.zeros((MH, MW, 3), np.uint8)
    cout = np.full((MH, MW), 1e9, np.float32)
    # cout d'un pixel dans son rendu : distance au centre, normalisee
    gy, gx = np.mgrid[0:fh_i, 0:fw_i]
    base = np.maximum(np.abs(gx - fw_i / 2.0) / fw_i, np.abs(gy - fh_i / 2.0) / fh_i).astype(np.float32)

    for k, fr in enumerate(F):
        im = Image.open(RENDUS % fr['f']).convert('RGB').resize((fw_i, fh_i), Image.LANCZOS)
        px = int(round(monde_x(fr['cx'] - lg / 2) * s - X0))
        py = int(round(monde_y(fr['cy'] + ht / 2) * s - Y0))
        x0, y0 = max(0, px), max(0, py)
        x1, y1 = min(MW, px + fw_i), min(MH, py + fh_i)
        if x1 <= x0 or y1 <= y0: continue
        sc = base[y0 - py:y1 - py, x0 - px:x1 - px]
        m  = sc < cout[y0:y1, x0:x1]
        if m.any():
            bloc = np.asarray(im)[y0 - py:y1 - py, x0 - px:x1 - px]
            cible = mos[y0:y1, x0:x1]; cible[m] = bloc[m]
            c2 = cout[y0:y1, x0:x1]; c2[m] = sc[m]
        if (k + 1) % 50 == 0: print('   %d/%d' % (k + 1, len(F)), flush=True)

    trous = float((cout > 1e8).mean())
    Image.fromarray(mos).save(sortie)
    calage = {'palier': palier, 'zoom': zoom, 'x0': X0, 'y0': Y0, 'w': MW, 'h': MH,
              'trous_pct': round(100 * trous, 2)}
    json.dump(calage, open(sortie.replace('.png', '.json'), 'w'), indent=1)
    print('   ECRIT %s  (%.1f Mo)  trous %.2f %%' % (sortie, os.path.getsize(sortie) / 1048576, 100 * trous))
    return calage

if __name__ == '__main__':
    palier = sys.argv[1]; zoom = int(sys.argv[2]); marge = float(sys.argv[3])
    assemble(palier, zoom, marge, os.path.join(INTER, 'mosaique_%s.png' % palier))
