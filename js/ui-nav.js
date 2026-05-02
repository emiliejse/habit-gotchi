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
 * RÔLE : Construit le HTML du bloc d'infos contextuelles jardin pour l'overlay plein écran.
 * POURQUOI : Centralisé ici plutôt qu'inline dans openCanvasFullscreen() pour rester lisible
 *            et pouvoir évoluer indépendamment (nouvelles métriques, nouveaux envs…).
 *
 * Sources de données :
 *   window._gardenElements — tableau des éléments visuels (type, age, maxAge)
 *   window.D.g.gardenState — état persisté (age, maxAge) par index
 *   window.D.g.gardenSeed  — seed unique du jardin
 *   window.D.firstLaunch   — date du premier lancement (racine de D)
 *   window.D.log           — historique habitudes (racine de D, tableau d'IDs par date)
 *   window.D.g.meteoData   — données météo du jour
 *
 * @returns {string} HTML à injecter dans .canvas-fs-info,
 *                   ou chaîne vide si l'env actif n'est pas 'jardin'.
 */
function _buildGardenInfo() {
  const g = window.D && window.D.g;
  if (!g) return '';

  // RÔLE : Bloc vide si l'env actif n'est pas jardin — la feature plein écran reste
  //        fonctionnelle dans tous les envs, mais les infos ne sont affichées que pour jardin.
  if (g.activeEnv !== 'jardin') return '';

  const lines = [];

  // ── Ligne 1 : Éléments vivants + états ────────────────────────────
  // RÔLE : Lit window._gardenElements (tableau généré par initGarden()) pour compter
  //        et qualifier les éléments. L'état se dérive de age/maxAge car il n'y a pas
  //        de champ .state — mature = age ≥ 70% de maxAge, jeune = age < 3 jours.
  const elements = window._gardenElements || [];
  const total    = elements.length;

  if (total > 0) {
    // RÔLE : Compte les éléments en fleur (matures) et ceux qui fanent (très vieux)
    const enFleur = elements.filter(e => e.age >= Math.floor((e.maxAge || 10) * 0.7)).length;
    const fanent  = elements.filter(e => e.age >= (e.maxAge || 10) - 1).length;

    let ligne = `${total} élément${total > 1 ? 's' : ''} vivant${total > 1 ? 's' : ''}`;
    if (enFleur > 0) ligne += ` · ${enFleur} en fleur`;
    if (fanent  > 0) ligne += ` · ${fanent} fane${fanent > 1 ? 'nt' : ''}`;
    lines.push(ligne);
  } else {
    lines.push('Le jardin sommeille encore…');
  }

  // ── Ligne 2 : Influence météo ──────────────────────────────────────
  // RÔLE : Affiche un message météo si meteoData est disponible dans D.g
  // POURQUOI : meteoData est renseigné par app.js via fetchMeteo() — peut être null
  const meteo = g.meteoData;
  if (meteo && meteo.desc) {
    const desc = (meteo.desc || '').toLowerCase();
    let icon = '🌤';
    if (desc.includes('pluie') || desc.includes('rain'))    icon = '🌧';
    if (desc.includes('neige') || desc.includes('snow'))    icon = '❄️';
    if (desc.includes('orage') || desc.includes('storm'))   icon = '⛈';
    if (desc.includes('nuage') || desc.includes('cloud'))   icon = '☁️';
    if (desc.includes('soleil') || desc.includes('sun') || desc.includes('clear')) icon = '☀️';
    if (desc.includes('brouil') || desc.includes('fog'))    icon = '🌫';

    // RÔLE : Message d'influence — sobre, contextuel, pas de liste
    // POURQUOI rain > 0 : meteoData.rain est le cumul de pluie mm sur 24h (API météo)
    const msgMeteo = meteo.rain > 0
      ? `${icon} Pluie récente · les champignons poussent`
      : `${icon} ${escape(meteo.desc)}`;
    lines.push(msgMeteo);
  }

  // ── Ligne 3 : Influence habitudes ─────────────────────────────────
  // RÔLE : Compte les habitudes cochées aujourd'hui depuis D.log (racine de D, pas D.g)
  // POURQUOI D.log[td] est un tableau d'IDs (strings) — .length donne le nombre de coches
  const todayKey = typeof today === 'function' ? today() : null;
  const habsDone = todayKey && window.D.log && window.D.log[todayKey]
    ? window.D.log[todayKey].length
    : 0;

  if (habsDone >= 4) {
    lines.push(`Tu as coché ${habsDone} intentions · le jardin est épanoui`);
  } else if (habsDone > 0) {
    lines.push(`${habsDone} intention${habsDone > 1 ? 's' : ''} cochée${habsDone > 1 ? 's' : ''} aujourd'hui`);
  }
  // POURQUOI silence si 0 : pas de culpabilisation

  // ── Ligne 4 : Identité du jardin ──────────────────────────────────
  // RÔLE : Seed + date de première session — donne une identité unique et permanente au jardin
  // POURQUOI firstLaunch est à la racine de D (pas D.g) — vérifié dans app.js defs()
  const seed = g.gardenSeed != null ? g.gardenSeed % 9999 : null;
  const born = window.D.firstLaunch
    ? new Date(window.D.firstLaunch).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  if (seed != null && born) {
    lines.push(`Jardin nº${seed} · né le ${born}`);
  }

  // RÔLE : Assemble les lignes en HTML séparées par <br> — pas de liste à puces
  // POURQUOI escape() sur chaque ligne : les strings peuvent contenir des données utilisateur
  return lines.map(l => escape(l)).join('<br>');
}

/**
 * RÔLE : Ouvre le canvas p5 en mode plein écran via un overlay vertical injecté dynamiquement.
 * POURQUOI : Permet de voir le gotchi agrandi sans recalculer la boucle p5.
 *            L'agrandissement est purement CSS (transform:scale) — le canvas reste à CS logiques.
 *
 * Séquence :
 * 1. Crée l'overlay .canvas-fullscreen-overlay et l'injecte dans <body>
 * 2. Déplace le canvas p5 dans le wrapper .canvas-fs-wrap de l'overlay
 *    (déplacement DOM — pas clone — pour que p5 continue de dessiner sur le même élément)
 * 3. Calcule et applique le scale CSS optimal
 * 4. Génère le bloc infos jardin via _buildGardenInfo() (vide si env != jardin)
 * 5. Bloque le scroll iOS (lockScroll)
 */
function openCanvasFullscreen() {
  const canvas = document.querySelector('.tama-screen canvas');
  if (!canvas) return; // sécurité si p5 n'a pas encore créé le canvas

  // RÔLE : Évite d'ouvrir deux overlays si déjà ouvert
  if (document.getElementById('canvas-fs-overlay')) return;

  // ── Création de l'overlay ────────────────────────────────────────
  const overlay     = document.createElement('div');
  overlay.id        = 'canvas-fs-overlay';
  overlay.className = 'canvas-fullscreen-overlay';

  // RÔLE : Bouton ✕ positionné en absolu dans l'overlay
  const closeBtn = document.createElement('button');
  closeBtn.className   = 'canvas-fs-close';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'Fermer le plein écran');
  closeBtn.onclick     = closeCanvasFullscreen;

  // RÔLE : Wrapper qui accueille le canvas déplacé
  const wrap     = document.createElement('div');
  wrap.className = 'canvas-fs-wrap';

  // ── Scale CSS ────────────────────────────────────────────────────
  // RÔLE : Calcule le scale pour que le canvas remplisse au mieux le viewport
  // POURQUOI getBoundingClientRect() AVANT de déplacer le canvas : une fois dans l'overlay,
  //          il n'a plus de dimensions mesurables tant que l'overlay n'est pas affiché.
  const rect  = canvas.getBoundingClientRect();
  const size  = Math.min(rect.width, rect.height); // canvas carré → identiques normalement
  const vw    = window.innerWidth  - 32; // 16px de marge de chaque côté
  const vh    = window.innerHeight - 32;
  const scale = Math.min(vw / size, vh / size);

  canvas.style.transform       = `scale(${scale})`;
  canvas.style.transformOrigin = 'top center';
  // POURQUOI style inline (pas classe CSS) : valeur calculée dynamiquement
  canvas.style.imageRendering  = 'pixelated';

  // RÔLE : Déplace le canvas dans le wrapper de l'overlay
  // POURQUOI déplacement DOM (pas clone) : p5 est lié au canvas original —
  //          un clone perdrait le contexte WebGL/2D et casserait la boucle draw
  wrap.appendChild(canvas);

  // ── Bloc infos jardin ────────────────────────────────────────────
  // RÔLE : Infos contextuelles sous le canvas — uniquement pour l'env jardin
  const infoHTML = _buildGardenInfo();
  const infoEl   = document.createElement('div');
  infoEl.className = 'canvas-fs-info';
  infoEl.innerHTML = infoHTML;
  // RÔLE : Cache le bloc si vide (env non-jardin) — l'overlay reste propre
  if (!infoHTML) infoEl.style.display = 'none';

  // ── Assemblage et injection ──────────────────────────────────────
  overlay.appendChild(closeBtn);
  overlay.appendChild(wrap);
  overlay.appendChild(infoEl);
  document.body.appendChild(overlay);

  // RÔLE : RAF pour que display:flex soit calculé avant d'ajouter .open (évite flash)
  requestAnimationFrame(() => overlay.classList.add('open'));

  // RÔLE : Tap sur le fond de l'overlay (hors canvas) ferme le plein écran
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeCanvasFullscreen();
  });

  // RÔLE : Bloque le scroll iOS pendant le plein écran
  lockScroll();

  // RÔLE : Ferme le menu s'il était ouvert (évite deux overlays empilés)
  if (typeof _fermerMenuSiOuvert === 'function') _fermerMenuSiOuvert();

  // RÔLE : Mémorise le conteneur original pour remettre le canvas à sa place à la fermeture
  window._canvasFsOriginalParent = document.getElementById('cbox');
}

/**
 * RÔLE : Ferme le mode plein écran canvas et restaure l'état normal.
 * POURQUOI : Remet le canvas dans #cbox (son parent original), retire l'overlay injecté,
 *            reset les styles inline du canvas, restitue le scroll iOS.
 */
function closeCanvasFullscreen() {
  const overlay  = document.getElementById('canvas-fs-overlay');
  const original = window._canvasFsOriginalParent || document.getElementById('cbox');

  // RÔLE : Récupère le canvas depuis l'overlay (il a été déplacé à l'ouverture)
  const canvas = overlay ? overlay.querySelector('canvas') : null;

  if (canvas && original) {
    // RÔLE : Remet le canvas dans son conteneur d'origine et nettoie les styles inline
    canvas.style.transform       = '';
    canvas.style.transformOrigin = '';
    canvas.style.imageRendering  = '';
    original.appendChild(canvas);
  }

  // RÔLE : Retire l'overlay injecté du DOM
  if (overlay) overlay.remove();

  window._canvasFsOriginalParent = null;
  unlockScroll();
}

// RÔLE : Exposer les deux fonctions globalement pour les appels depuis le HTML
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
