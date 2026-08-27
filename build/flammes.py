# -*- coding: utf-8 -*-
"""Fabrique la boucle de vacillement des bougies, depuis le palier large.

Les 50 images 1-50 partagent la meme position de camera : elles ne different
que par les flammes et l'eclairage qu'elles projettent. C'est donc deja une
boucle, il n'y a qu'a la ramener a l'echelle du niveau de zoom 2 — celle de la
mosaique du meme palier, pour que video et tuiles se recouvrent au pixel pres.

Le fond est opaque : la video est decoupee cote page en complementaire de
l'ouverture, elle ne recouvre donc jamais la carte.
"""
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
import json, os, subprocess, sys, glob

INTER = os.environ.get('INARAMA_INTER', os.path.join(os.environ.get('TEMP', '.'), 'inarama'))
RACINE = r'D:\Desktop\claude qgis'
RENDUS = 'E:/anim_zoom/%04d.png'
SORTIE = os.path.join(RACINE, 'web', 'img', 'bougies.webm')
TRAVAIL = os.path.join(INTER, 'flammes')


def ffmpeg():
    for p in glob.glob(os.path.join(INTER, '**', 'ffmpeg.exe'), recursive=True):
        return p
    raise SystemExit('ffmpeg introuvable sous %s' % INTER)


def main():
    cal = json.load(open(os.path.join(INTER, 'mosaique_A.json')))
    W, H = cal['w'], cal['h']
    os.makedirs(TRAVAIL, exist_ok=True)
    for i in range(1, 51):
        im = Image.open(RENDUS % i).convert('RGB').resize((W, H), Image.LANCZOS)
        im.save(os.path.join(TRAVAIL, '%04d.png' % i))
        if i % 10 == 0: print('   %d/50' % i, flush=True)
    cmd = [ffmpeg(), '-hide_banner', '-loglevel', 'error', '-framerate', '24',
           '-i', os.path.join(TRAVAIL, '%04d.png'),
           '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p', '-b:v', '0', '-crf', '32',
           '-an', '-y', SORTIE]
    subprocess.run(cmd, check=True)
    print('ECRIT %s  %dx%d  %.2f Mo' % (SORTIE, W, H, os.path.getsize(SORTIE) / 1048576))


if __name__ == '__main__':
    main()
