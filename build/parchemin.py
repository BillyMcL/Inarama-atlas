# -*- coding: utf-8 -*-
"""Cuit la lumiere des bougies dans la texture de parchemin.

Pourquoi cuire plutot que superposer : la nappe de lumiere est SOLIDAIRE de la
feuille (meme scene 3D, meme cadrage), et elle n'a que des basses frequences.
Cuite dans la texture, elle zoome avec elle sans jamais se pixelliser, et sans
mode de fusion — donc sans recomposition de toute la pile a chaque image.

Entrees : "fond parchemin.jpg" (8857x8925, cadre 1:1 sur le viewBox du master)
          3d/table/lumiere_feuille.png (rendu, feuille en blanc pur)
Sortie  : web/img/parchemin.jpg
"""
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
import numpy as np, os

RACINE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LARGE = 4096                       # la feuille depasse rarement 6000 px a l'ecran
CADRE = (735, 171, 1825, 1269)     # la feuille dans le rendu 2560x1440

parch = Image.open(os.path.join(RACINE, 'fond parchemin.jpg')).convert('RGB')
haut = round(LARGE * parch.size[1] / parch.size[0])
parch = parch.resize((LARGE, haut), Image.LANCZOS)

lum = Image.open(os.path.join(RACINE, '3d', 'table', 'lumiere_feuille.png')).convert('RGB')
lum = lum.crop(CADRE).resize((LARGE, haut), Image.LANCZOS)

p = np.asarray(parch, dtype=np.float32)
l = np.asarray(lum,   dtype=np.float32)

# On garde la FORME de la nappe, pas son niveau absolu : sinon le papier tombe
# a 87 de moyenne et on retombe sur la carte illisible de la semaine derniere.
# Reference = 75e centile et exposant 0,6 : les coins tombent a 42 %% au lieu
# de 20 %%, la fenetre de la carte reste a 83 %% de son niveau d'origine.
ref = float(np.percentile(l.mean(axis=2), 75))
EXPO = 0.6   # on garde la FORME de la nappe, on en comprime la profondeur
g = np.power(np.clip(l / ref, 0, None), EXPO)
out = np.clip(p * g, 0, 255)

print('parchemin  moyenne %.0f -> %.0f' % (p.mean(), out.mean()))
print('lumiere    min %.0f  max %.0f  ref(88e) %.0f' % (l.min(), l.max(), ref))
print('sature     %.2f %% des pixels' % (100 * (p * g > 255).mean()))

s = os.path.join(RACINE, 'web', 'img', 'parchemin.jpg')
Image.fromarray(out.astype(np.uint8)).save(s, quality=86, subsampling=1, optimize=True)
print('ECRIT', s, '%.2f Mo' % (os.path.getsize(s) / 1048576))
