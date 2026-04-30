/* ============================================================
   ui-nav.js — Navigation SPA, hauteur console, date
   RÔLE : Routeur interne go(), sync layout, updDate().
   Chargé EN DERNIER parmi les fichiers ui-* car go() appelle
   renderHabs, renderProg, renderProps, renderPerso, renderJ
   (toutes définies dans les autres modules ui-*).

   Dépend de : app.js (save, hr, window.D)
               ui-core.js (lockScroll, unlockScroll, _fermerMenuSiOuvert)
               ui-habs.js (renderHabs)
               ui-shop.js (renderProps, updBadgeBoutique, window._updInvEnvSwitcher)
               ui-settings.js (renderPerso, renderProg, updBadgeBoutique)
               ui-journal.js (renderJ, journalLocked)
   ============================================================

   CONTENU :
   §1  syncConsoleHeight()    — recalcule le padding de #dynamic-zone
   §2  syncDuringTransition() — boucle RAF pendant les transitions CSS
   §3  go()                   — routeur SPA principal
   §4  updDate()              — affiche la date dans le HUD
   ============================================================ */

/* ─── LAYOUT ─────────────────────────────────────────────── */

/**
 * RÔLE : Mesure la hauteur réelle de #console-top et décale #dynamic-zone en dessous.
 * POURQUOI : offsetHeight est indépendant du scroll et du viewport — plus fiable que
 *            getBoundingClientRect().bottom qui variait selon les plateformes (iOS, zoom...).
 */
function syncConsoleHeight() {
  const top  = document.getElementById('console-top');
  const zone = document.getElementById('dynamic-zone');
  if (!top || !zone) return;

  requestAnimationFrame(() => {
    const h = top.offsetHeight;
    // POURQUOI : on soustrait --sat car offsetHeight l'inclut dans le padding de #console-top,
    //            mais la dynamic-zone est déjà décalée par le layout — sinon double-comptage sur iOS.
    const sat = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0;
    zone.style.paddingTop = (h - sat + 6) + 'px';
  });
}

/**
 * RÔLE : Synchronise la hauteur de #dynamic-zone à chaque frame pendant la transition CSS.
 * POURQUOI : margin-top de #tama-bubble-wrap s'anime sur 400ms — la dynamic-zone
 *            doit suivre en continu, pas juste au début/fin.
 */
function syncDuringTransition(shell) {
  let running = true;

  const tick = () => {
    if (!running) return;
    syncConsoleHeight();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // Stop quand la transition CSS de .shrunk se termine
  const stop = () => {
    running = false;
    syncConsoleHeight(); // un dernier sync propre
    shell.removeEventListener('transitionend', stop);
  };
  shell.addEventListener('transitionend', stop);

  // Filet de sécurité : stop après 600ms max (au cas où transitionend ne se déclenche pas)
  setTimeout(stop, 600);
}

/* ─── ROUTEUR SPA ─────────────────────────────────────────── */

/**
 * RÔLE : Moteur de routage interne — affiche l'onglet ciblé et adapte l'environnement.
 * POURQUOI : HabitGotchi est une SPA sans URL — go('journal') remplace
 *            window.location par une manipulation de classes CSS.
 * USAGE : go('gotchi') | go('props') | go('journal') | go('progress') | go('perso') | go('settings')
 */
function go(t) {
  window._gotchiActif = (t === 'gotchi');
  document.querySelectorAll('.pnl').forEach(p => p.classList.remove('on'));
  const targetPanel = document.getElementById('p-' + t);
  if (targetPanel) targetPanel.classList.add('on');

  // RÔLE : Marquer la ligne de menu correspondant au panneau actif
  document.querySelectorAll('.menu-line').forEach(c => c.classList.remove('active'));
  const activeCircle = document.querySelector(`.menu-line[onclick*="'${t}'"]`);
  if (activeCircle) activeCircle.classList.add('active');

  const consoleTop = document.getElementById('console-top');

  // RÔLE : Mode compact — tout géré par CSS sur #console-top.compact, zéro déplacement DOM.
  // Le tama reste toujours dans #tama-shell-main. Les transitions CSS (max-width, transform)
  // donnent l'effet de glissement/rétrécissement. syncConsoleHeight recalcule après.
  if (t === 'gotchi') {
    consoleTop.classList.remove('compact');
    // RÔLE : En quittant l'onglet gotchi, on remet l'env selon l'heure.
    // POURQUOI : le flag _invEnvForced est remis à false quelle que soit son état —
    //            on sort de la preview inventaire, la logique heure reprend.
    window._invEnvForced = false;
    const h = hr();
    window.D.g.activeEnv = (h >= 21 || h < 6) ? 'chambre' : 'parc';
  } else {
    consoleTop.classList.add('compact');
    if (t === 'props') {
      // RÔLE : En arrivant dans l'inventaire, on ne force PAS d'env —
      //        on garde l'env actuel pour que le switcher soit cohérent avec ce qu'on voit.
      // POURQUOI : L'utilisatrice peut arriver depuis n'importe quel état. Le switcher
      //            se synchronise sur l'env en cours et elle peut ensuite changer.
      window._invEnvForced = false; // reset au cas où on revient dans l'onglet
      // l'env reste tel quel — le switcher affichera l'env actuel
    } else {
      // En quittant props vers un autre onglet, nettoyer le flag et reprendre la logique normale
      if (window._invEnvForced) {
        window._invEnvForced = false;
      }
      if      (t === 'journal')  window.D.g.activeEnv = 'chambre';
      else if (t === 'perso')    window.D.g.activeEnv = 'parc';
      else if (t === 'progress') window.D.g.activeEnv = 'montagne';
      else if (t === 'settings') window.D.g.activeEnv = 'chambre';
    }
  }
  save();

  if (t === 'gotchi' || t === 'settings') renderHabs();
  if (t === 'progress') renderProg();
  if (t === 'props') {
    (window.D.g.props || []).forEach(p => p.seen = true);
    save();
    renderProps();
    updBadgeBoutique();
    // RÔLE : Synchroniser le switcher sur l'env actuel après le rendu
    window._updInvEnvSwitcher?.();
  }
  if (t === 'perso')   renderPerso();
  if (t === 'journal') { journalLocked = true; renderJ(); }

  document.getElementById('dynamic-zone').scrollTop = 0;
  const wrap = document.getElementById('tama-bubble-wrap');
  syncDuringTransition(wrap);
}

/* ─── DATE ───────────────────────────────────────────────── */

/**
 * RÔLE : Met à jour l'affichage de la date dans #date-txt du HUD.
 * POURQUOI : Affiché dans #console-top — appelé à l'init puis chaque matin via handleDailyReset().
 */
function updDate() {
  const d = new Date();
  const days = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  const mos  = ['jan','fév','mars','avr','mai','juin','juil','août','sep','oct','nov','déc'];
  document.getElementById('date-txt').textContent = `${days[d.getDay()]} ${d.getDate()} ${mos[d.getMonth()]}`;
}
updDate();
