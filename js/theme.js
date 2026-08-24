/* Thème — Phase G.
 * Deux mondes : « nocturne » (l'instrument) et « grimoire » (le parchemin).
 * Commutable à la main, mémorisé, et basculé d'office quand on choisit le
 * fond Parchemin — mais un choix manuel postérieur reprend la main.
 */
(function () {
  'use strict';

  const CLE = 'inarama.theme';
  const THEMES = { nocturne: { lib: 'Nocturne', ic: '◐' }, grimoire: { lib: 'Grimoire', ic: '❦' } };
  let courant = 'nocturne';
  let choixManuel = false;      // une fois vrai, le fond de carte n'impose plus rien
  let btn;

  function applique(t, memorise) {
    courant = THEMES[t] ? t : 'nocturne';
    document.body.classList.toggle('grimoire', courant === 'grimoire');
    document.body.classList.toggle('nocturne', courant === 'nocturne');
    if (btn) btn.innerHTML = '<span class="ic">' + THEMES[courant].ic + '</span>'
                           + '<span class="lib">' + THEMES[courant].lib + '</span>';
    if (memorise) { try { localStorage.setItem(CLE, courant); } catch (e) { /* mode privé */ } }
    document.dispatchEvent(new CustomEvent('inarama:theme', { detail: courant }));
  }

  function bascule() {
    choixManuel = true;
    applique(courant === 'grimoire' ? 'nocturne' : 'grimoire', true);
  }

  /* Le fond Parchemin propose Grimoire — il ne l'impose pas si l'utilisateur
     a déjà tranché lui-même pendant la session. */
  function surFond(nomFond) {
    if (choixManuel) return;
    applique(/Parchemin/.test(nomFond) ? 'grimoire' : 'nocturne', false);
  }

  function init() {
    btn = document.createElement('button');
    btn.id = 'themeBtn'; btn.type = 'button';
    btn.title = 'Changer de thème';
    btn.setAttribute('aria-label', 'Changer de thème');
    document.body.appendChild(btn);
    btn.addEventListener('click', bascule);

    let memo = null;
    try { memo = localStorage.getItem(CLE); } catch (e) { /* mode privé */ }
    if (memo && THEMES[memo]) { choixManuel = true; applique(memo, false); }
    else applique('nocturne', false);

    // le fond actif au chargement compte aussi
    if (window.map) {
      window.map.on('baselayerchange', e => surFond(e.name));
      if (!choixManuel && document.body.classList.contains('parch')) applique('grimoire', false);
    }
  }

  window.INARAMA_theme = { get: () => courant, set: t => { choixManuel = true; applique(t, true); }, bascule };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
