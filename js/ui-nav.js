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

/**
 * RÔLE : Observe en continu la hauteur de #console-top et resynchronise #dynamic-zone dès qu'elle change.
 * POURQUOI : La bulle (#bubble) peut s'étirer sur 1 ou 2 lignes selon le texte reçu de l'IA.
 *            syncConsoleHeight() est appelée à la navigation et pendant les transitions, mais pas
 *            lors d'un simple changement de texte dans la bulle — ce ResizeObserver comble ce vide.
 *            Résultat : #dynamic-zone se repositionne automatiquement quelle que soit la hauteur
 *            de la console, sans aucun timer ni calcul manuel supplémentaire.
 */
(function _watchConsoleResize() {
  const top = document.getElementById('console-top');
  if (!top || typeof ResizeObserver === 'undefined') return;

  // POURQUOI : ResizeObserver est natif sur tous les navigateurs modernes (iOS 13.4+, Chrome 64+).
  //            Il observe les changements de taille de la boîte de rendu, pas du contenu seul.
  //            Parfait ici : la bulle gonfle → #console-top grandit → callback déclenché immédiatement.
  const ro = new ResizeObserver(() => {
    // POURQUOI : pas de debounce — syncConsoleHeight() utilise déjà un requestAnimationFrame interne.
    //            Le RAF garantit qu'on lit offsetHeight après le reflow, sans pile de callbacks.
    syncConsoleHeight();
  });

  ro.observe(top); // surveille #console-top dans son ensemble
})();

/* ─── ROUTEUR SPA ─────────────────────────────────────────── */

/**
 * RÔLE : Source de vérité unique pour le calcul de l'env actif selon l'onglet et l'heure.
 * POURQUOI : Remplace les 3 sources de vérité dispersées dans go() (logique heure,
 *            forçage par onglet, flag _invEnvForced). Tout futur onglet doit être
 *            ajouté ICI — go() n'a plus à connaître la logique d'env.
 *
 * @param {string} tab  — identifiant de l'onglet cible (ex. 'gotchi', 'journal'…)
 * @param {number} h    — heure courante 0-23 (passée en paramètre pour rester testable)
 * @returns {string|null} — nom de l'env à appliquer, ou null si l'env doit rester inchangé
 *
 * Règle null : tab 'props' conserve l'env courant (le switcher inventaire gère lui-même).
 */
function _getEffectiveEnv(tab, h) {
  // RÔLE : Onglet gotchi — env selon l'heure (nuit = chambre, jour = parc)
  if (tab === 'gotchi')   return (h >= 21 || h < 6) ? 'chambre' : 'parc';

  // RÔLE : Onglet inventaire — on ne touche pas à l'env pour que le switcher reste cohérent
  if (tab === 'props')    return null;

  // RÔLE : Onglets avec env fixe — chaque onglet impose son ambiance narrative
  if (tab === 'journal')  return 'chambre';   // introspection → espace intime
  if (tab === 'perso')    return 'parc';      // profil → extérieur apaisé
  if (tab === 'progress') return 'montagne';  // progression → vue en hauteur
  if (tab === 'settings') return 'chambre';   // réglages → espace intime

  // RÔLE : Onglet inconnu — on ne touche pas à l'env (sécurité si nouvel onglet ajouté sans mise à jour)
  return null;
}

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
  } else {
    consoleTop.classList.add('compact');
  }

  // RÔLE : Met à jour le label d'onglet visible en mode compact (remplace #hdr-title masqué).
  // POURQUOI : Sans repère visuel, l'utilisatrice ne sait plus sur quel onglet elle est.
  const TAB_LABELS = {
    progress: '✿ Progrès',
    journal:  '✿ Journal',
    props:    '✿ Inventaire',
    perso:    '✿ Personnalisation',
    settings: '✿ Réglages',
  };
  const labelEl = document.getElementById('compact-tab-label');
  if (labelEl) labelEl.textContent = TAB_LABELS[t] || '';

  // RÔLE : Reset du flag preview inventaire — toujours remis à false en changeant d'onglet.
  // POURQUOI : _invEnvForced n'est actif que pendant la navigation dans l'inventaire.
  //            Dès qu'on quitte props (ou qu'on y revient en navigation normale), on repart
  //            de l'env standard — le switcher se synchronise sur l'env réel.
  window._invEnvForced = false;

  // RÔLE : Applique l'env calculé par _getEffectiveEnv() — source de vérité unique.
  // POURQUOI : null signifie "env inchangé" (cas props) — on n'écrase pas l'env courant.
  const envCible = _getEffectiveEnv(t, hr());
  if (envCible !== null) window.D.g.activeEnv = envCible;
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
  if (t === 'journal') { window.journalLocked = true; renderJ(); } // POURQUOI : window.journalLocked partagé avec ui-journal.js

  // RÔLE : Remettre la zone de contenu en haut à chaque changement d'onglet.
  // POURQUOI : Le scroll immédiat n'est pas suffisant — le render (renderHabs, renderProps…)
  //            et la transition CSS de compact peuvent décaler le contenu après ce point.
  //            On force donc le retour en haut : une fois immédiatement, et une fois
  //            après la fin de la transition (via setTimeout calé sur la durée de la transition).
  const dz = document.getElementById('dynamic-zone');
  dz.scrollTop = 0;
  setTimeout(() => { dz.scrollTop = 0; }, 420); // 420ms > durée transition compact (400ms)

  const wrap = document.getElementById('tama-bubble-wrap');
  syncDuringTransition(wrap);
}

/* ─── PLEIN ÉCRAN CANVAS ──────────────────────────────────── */

/**
 * RÔLE : Calcule le facteur scale pour que le canvas remplisse au mieux le viewport.
 * POURQUOI : Le canvas p5 a une taille CSS fixe (généralement = CS*PX pixels).
 *            On veut l'agrandir au maximum sans dépasser l'écran, en gardant le ratio carré.
 *            On prend le min de (largeur / tailleCanvas) et (hauteur / tailleCanvas).
 */
function _calcCanvasScale(canvasEl) {
  // Taille CSS réelle du canvas tel qu'il est rendu dans .tama-screen
  const rect = canvasEl.getBoundingClientRect();
  const size = Math.min(rect.width, rect.height); // carré → les deux sont identiques normalement

  // Viewport disponible (on laisse 16px de marge de chaque côté)
  const vw = window.innerWidth  - 32;
  const vh = window.innerHeight - 32;

  // POURQUOI Math.min : on veut que le canvas tienne EN ENTIER dans les deux dimensions
  return Math.min(vw / size, vh / size);
}

/**
 * RÔLE : Ouvre le canvas p5 en mode plein écran.
 * POURQUOI : Permet de voir le gotchi agrandi sans recalculer la boucle p5.
 *            L'agrandissement est purement CSS (transform:scale) — le canvas reste à sa taille logique.
 *
 * Séquence :
 * 1. Récupère le canvas p5 dans .tama-screen
 * 2. Calcule le scale optimal
 * 3. Applique .canvas-fullscreen sur le canvas + le scale en style inline
 * 4. Ouvre l'overlay de fond
 * 5. Injecte le bouton ✕ dans le DOM
 * 6. Bloque le scroll iOS (lockScroll)
 */
function openCanvasFullscreen() {
  const canvas = document.querySelector('.tama-screen canvas');
  if (!canvas) return; // sécurité si p5 n'a pas encore créé le canvas

  const overlay = document.getElementById('canvas-overlay');
  if (!overlay) return;

  // RÔLE : Calcule et applique le scale CSS
  const scale = _calcCanvasScale(canvas);
  canvas.classList.add('canvas-fullscreen', 'open');
  canvas.style.transform = `translate(-50%, -50%) scale(${scale})`;

  // RÔLE : Affiche le fond noir
  overlay.classList.add('open');

  // RÔLE : Injecte le bouton ✕ (retiré à la fermeture — pas de doublon possible)
  const closeBtn = document.createElement('button');
  closeBtn.className   = 'canvas-close-btn';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'Fermer le plein écran');
  closeBtn.id          = 'canvas-close-btn';
  closeBtn.onclick     = closeCanvasFullscreen;
  document.body.appendChild(closeBtn);

  // RÔLE : Ferme aussi si on tape sur le fond noir
  overlay.onclick = closeCanvasFullscreen;

  // RÔLE : Bloque le scroll iOS pendant le plein écran
  lockScroll();

  // RÔLE : Ferme le menu s'il était ouvert (évite deux overlays empilés)
  if (typeof _fermerMenuSiOuvert === 'function') _fermerMenuSiOuvert();
}

/**
 * RÔLE : Ferme le mode plein écran canvas et restaure l'état normal.
 * POURQUOI : Retire les classes CSS + le style inline + le bouton ✕ injecté.
 *            unlockScroll() restitue le scroll iOS.
 */
function closeCanvasFullscreen() {
  const canvas = document.querySelector('.tama-screen canvas');
  const overlay = document.getElementById('canvas-overlay');
  const closeBtn = document.getElementById('canvas-close-btn');

  if (canvas) {
    canvas.classList.remove('canvas-fullscreen', 'open');
    // POURQUOI : on retire le style inline — le canvas reprend son transform natif (.tama-screen canvas)
    canvas.style.transform = '';
  }

  if (overlay) {
    overlay.classList.remove('open');
    overlay.onclick = null; // nettoyage du listener
  }

  // RÔLE : Retire le bouton ✕ injecté à l'ouverture
  if (closeBtn) closeBtn.remove();

  // RÔLE : Restitue le scroll iOS
  unlockScroll();
}

// RÔLE : Exposer les deux fonctions globalement pour les appels depuis le menu HTML
window.openCanvasFullscreen  = openCanvasFullscreen;
window.closeCanvasFullscreen = closeCanvasFullscreen;

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
