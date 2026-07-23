# Atlas Inarama — guide d'utilisation & de mise en ligne

Ce dossier `web/` est **autonome** : il contient toute la carte interactive (fonds tuilés,
couches vectorielles, moteur Leaflet embarqué). Aucune connexion internet n'est nécessaire
pour l'ouvrir, et rien ne dépend de QGIS.

## Contenu

| Élément | Rôle |
|---|---|
| `index.html` | La carte elle-même (à ouvrir dans un navigateur) |
| `lib/` | Leaflet (moteur cartographique) embarqué, pour l'usage hors-ligne |
| `tiles/terrain/` | Fond **Terrain** (satellite + relief marqué : texture + reliefs lisibles) |
| `tiles/satellite/` | Fond satellite d'origine (photoréaliste, 2 km) |
| `tiles/terres/` | Couche Terres sauvages (taches radiales par élément) |
| `data/*.js` | Les couches vectorielles activables : lieux, royaumes, provinces, rivières, routes, routes maritimes, courants |

---

## A. Ouvrir la carte sur ton ordinateur (hors-ligne)

**Le plus simple :** double-clique sur `index.html`. Elle s'ouvre dans ton navigateur, tout
fonctionne sans internet.

> Si jamais un navigateur bloque le chargement des données en double-clic (rare), lance un
> mini-serveur local depuis ce dossier :
> ```
> python -m http.server 8000
> ```
> puis ouvre `http://localhost:8000` dans le navigateur.

**Utilisation :**
- Bouton en haut à droite (☰) = liste des couches.
- **Fonds** (rond) : Terrain / Satellite — un seul à la fois.
- **Couches** (cases) : à cocher/décocher librement.
- **Zoom** : la molette ou les boutons +/−. Plus tu zoomes, plus de détails apparaissent :
  les lieux se dévoilent du plus rare au plus commun, les rivières et routes du plus
  important au plus secondaire, les provinces au-delà d'un certain niveau de zoom.
- **Lieux** : forme = type (cercle civil, anneau arène, triangle académie, losange guilde,
  étoile 8 branches sanctuaire), couleur = rareté (vert→bleu→violet→or→rouge).
- **Clique un lieu** → sa fiche (nom, type, royaume, province, race, description…).
  Survole-le (ordi) ou tape-le (mobile) pour voir son nom.

---

## B. Mettre la carte en ligne sur GitHub Pages (gratuit, accessible partout)

Une fois en ligne, tu auras une adresse du type
`https://TONPSEUDO.github.io/inarama/` ouvrable sur téléphone comme sur ordi.

### 1. Créer un compte / se connecter
Va sur https://github.com et connecte-toi (crée un compte si besoin).

### 2. Créer un dépôt (repository)
- Clique sur **+** (en haut à droite) → **New repository**.
- **Repository name** : `inarama` (ou ce que tu veux).
- Laisse **Public** coché.
- Clique **Create repository**.

### 3. Envoyer le contenu du dossier `web/`
La méthode sans ligne de commande :
- Sur la page du dépôt, clique **uploading an existing file**.
- Ouvre ce dossier `web/` sur ton ordi, **sélectionne tout ce qu'il contient**
  (`index.html`, `lib`, `tiles`, `data`) et **glisse-dépose** le tout dans la page GitHub.
  ⚠️ Envoie le *contenu* de `web/`, pas le dossier `web/` lui-même.
- Attends la fin de l'envoi (c'est ~158 Mo, ça peut prendre quelques minutes).
- Clique **Commit changes**.

### 4. Activer GitHub Pages
- Dans le dépôt : **Settings** → **Pages** (menu de gauche).
- Sous **Source**, choisis **Deploy from a branch**.
- **Branch** : `main`, dossier `/ (root)` → **Save**.
- Attends 1-2 min : l'adresse de ta carte s'affiche en haut de cette page Pages.

### 5. C'est en ligne
Ouvre l'adresse `https://TONPSEUDO.github.io/inarama/` sur n'importe quel appareil.

---

## Mettre à jour la carte plus tard
Si on régénère des couches, il suffit de **remplacer les fichiers correspondants**
(`data/…` ou un dossier `tiles/…`) dans le dépôt GitHub (bouton *Add file → Upload files*),
puis *Commit*. Le site se met à jour tout seul en 1-2 min.

---

*Poids total ≈ 158 Mo — très en dessous de la limite GitHub Pages (1 Go).*
