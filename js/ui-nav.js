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
/**
 * RÔLE : Génère un nom poétique unique pour le jardin à partir de sa seed.
 * POURQUOI déterministe : même seed → même nom à chaque lancement.
 *          On utilise _gardenRng() si disponible, sinon un modulo simple.
 *
 * Format : "Jardin [adjectif] de [nom]"
 * Exemples : "Jardin Doré de Lunette", "Jardin Brumeux de Pépin"
 */
function _gardenName(seed) {
  const adjs  = ['Doré','Brumeux','Fleuri','Sauvage','Endormi','Étrange','Moussu','Serein','Murmureux','Secret'];
  const noms  = ['Lunette','Pépin','Noisette','Brindille','Caillou','Grigri','Paquerette','Lilas','Fétu','Corolle'];
  // POURQUOI deux modulos différents : évite que adj et nom soient corrélés (même index)
  const adj = adjs[seed % adjs.length];
  const nom = noms[Math.floor(seed / adjs.length) % noms.length];
  return `${adj} de ${nom}`;
}

function _buildGardenInfo() {
  const g = window.D && window.D.g;
  if (!g) return '';

  // RÔLE : Bloc vide si l'env actif n'est pas jardin
  if (g.activeEnv !== 'jardin') return '';

  // ── Ligne 1 : Éléments vivants + états ────────────────────────────
  // RÔLE : Lit window._gardenElements (généré par initGarden()) pour qualifier le jardin.
  //        mature = age ≥ 70% maxAge · fane = age ≥ maxAge - 1
  const elements = window._gardenElements || [];
  const total    = elements.length;

  let ligneElements;
  if (total > 0) {
    const enFleur = elements.filter(e => e.age >= Math.floor((e.maxAge || 10) * 0.7)).length;
    const fanent  = elements.filter(e => e.age >= (e.maxAge || 10) - 1).length;
    ligneElements = `🌿 ${total} élément${total > 1 ? 's' : ''}`;
    if (enFleur > 0) ligneElements += ` · ${enFleur} en fleur 🌸`;
    if (fanent  > 0) ligneElements += ` · ${fanent} fane${fanent > 1 ? 'nt' : ''} 🍂`;
  } else {
    ligneElements = '🌱 Le jardin sommeille encore…';
  }

  // ── Ligne 2 : Influence météo ──────────────────────────────────────
  // RÔLE : Message météo contextuel si meteoData est disponible
  let ligneMeteo = '';
  const meteo = g.meteoData;
  if (meteo && meteo.desc) {
    const desc = (meteo.desc || '').toLowerCase();
    let icon = '🌤';
    if (desc.includes('pluie') || desc.includes('rain'))             icon = '🌧';
    if (desc.includes('neige') || desc.includes('snow'))             icon = '❄️';
    if (desc.includes('orage') || desc.includes('storm'))            icon = '⛈';
    if (desc.includes('nuage') || desc.includes('cloud'))            icon = '☁️';
    if (desc.includes('soleil') || desc.includes('sun') || desc.includes('clear')) icon = '☀️';
    if (desc.includes('brouil') || desc.includes('fog'))             icon = '🌫';
    ligneMeteo = meteo.rain > 0
      ? `${icon} Pluie récente — les champignons poussent`
      : `${icon} ${escape(meteo.desc)}`;
  }

  // ── Ligne 3 : Influence habitudes ─────────────────────────────────
  // RÔLE : Compte les catégories cochées aujourd'hui dans D.log[today()]
  // POURQUOI D.log[td] est un tableau de catIds (strings) — .length = nb de coches du jour
  // POURQUOI on soustrait les catégories "hors-habitudes" : D.log peut contenir des entrées
  //          autres (meals, etc.) selon l'usage — on filtre sur D.habits pour être précis.
  let ligneHabs = '';
  const todayKey  = typeof today === 'function' ? today() : null;
  const logToday  = (todayKey && window.D.log && window.D.log[todayKey]) ? window.D.log[todayKey] : [];
  // RÔLE : Ne compte que les IDs présents dans D.habits (catId réels de l'utilisatrice)
  const habCatIds = (window.D.habits || []).map(h => h.catId);
  const habsDone  = logToday.filter(id => habCatIds.includes(id)).length;
  const habsTotal = habCatIds.length;

  if (habsDone >= habsTotal && habsTotal > 0) {
    ligneHabs = `✨ Toutes les intentions cochées — le jardin rayonne`;
  } else if (habsDone >= 4) {
    ligneHabs = `✿ ${habsDone} intentions cochées aujourd'hui`;
  } else if (habsDone > 0) {
    ligneHabs = `✿ ${habsDone} intention${habsDone > 1 ? 's' : ''} cochée${habsDone > 1 ? 's' : ''} aujourd'hui`;
  }
  // POURQUOI silence si 0 : pas de culpabilisation

  // ── Ligne 4 : Identité du jardin ──────────────────────────────────
  // RÔLE : Nom poétique généré depuis la seed + date de naissance propre au jardin.
  // POURQUOI gardenBorn (D.g) et pas firstLaunch : chaque regénération (resetGarden)
  //          pose une nouvelle gardenBorn dans initGarden() — la date reflète
  //          la vraie naissance de CE jardin, pas de la save globale.
  let ligneIdentite = '';
  const seed = g.gardenSeed;
  if (seed != null) {
    const nom  = _gardenName(seed);
    const born = g.gardenBorn
      ? new Date(g.gardenBorn).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      : null;
    ligneIdentite = born ? `🪴 Jardin ${nom} · né le ${born}` : `🪴 Jardin ${nom}`;
  }

  // ── Assemblage HTML en étiquettes séparées ────────────────────────
  // RÔLE : Chaque ligne devient un <span class="garden-info-tag"> pour le style étiquette
  // POURQUOI escape() : les strings peuvent contenir des données utilisateur (desc météo)
  const tags = [ligneElements, ligneMeteo, ligneHabs, ligneIdentite]
    .filter(Boolean)
    .map(l => `<span class="garden-info-tag">${escape(l)}</span>`)
    .join('');

  return tags;
}

/**
 * RÔLE : Ouvre un overlay plein écran PAR-DESSUS le canvas sans le déplacer.
 * POURQUOI : Le canvas a width/height:100% liés à .tama-screen — le déplacer
 *            casse ses dimensions et masque le rendu p5 (HUD énergie, env…).
 *            L'overlay est un fond noir transparent z-index 800 qui recouvre tout,
 *            avec un trou "pointer-events:none" au niveau du canvas pour que p5
 *            reste visible et interactif. Le bloc infos jardin est positionné
 *            en bas en position fixe, sous le canvas.
 *
 * Séquence :
 * 1. Crée l'overlay .canvas-fullscreen-overlay (fond noir, inset:0)
 * 2. Injecte bouton ✕ + bloc infos jardin dans l'overlay
 * 3. Le canvas reste dans #cbox — rien ne bouge dans le DOM
 * 4. Bloque le scroll iOS (lockScroll)
 */
function openCanvasFullscreen() {
  // RÔLE : Évite d'ouvrir deux overlays si déjà ouvert
  if (document.getElementById('canvas-fs-overlay')) return;

  // ── Création de l'overlay ────────────────────────────────────────
  const overlay     = document.createElement('div');
  overlay.id        = 'canvas-fs-overlay';
  overlay.className = 'canvas-fullscreen-overlay';

  // RÔLE : Bouton ✕ en position fixed (z:851) — toujours cliquable au-dessus du canvas
  const closeBtn = document.createElement('button');
  closeBtn.className   = 'canvas-fs-close';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'Fermer le plein écran');
  closeBtn.onclick     = closeCanvasFullscreen;

  // RÔLE : Mémorise l'env actif + l'état compact avant de modifier quoi que ce soit.
  // POURQUOI : closeCanvasFullscreen() restaure les deux pour ne rien laisser cassé.
  window._canvasFs_prevEnv    = (window.D && window.D.g) ? window.D.g.activeEnv : null;
  const consoleEl = document.getElementById('console-top');
  window._canvasFs_wasCompact = consoleEl ? consoleEl.classList.contains('compact') : false;

  // RÔLE : Retire compact si présent — en plein écran jardin le tama doit être pleine taille.
  // POURQUOI : compact réduit .tama-shell à ~110px — incompatible avec le mode plein écran.
  if (consoleEl) consoleEl.classList.remove('compact');

  // RÔLE : Force l'env jardin — le sticker 🌱 amène toujours au jardin, peu importe l'env actif.
  // POURQUOI on mute D.g.activeEnv avant _buildGardenInfo() : cette fonction lit activeEnv
  //          pour décider si elle retourne du contenu ou une chaîne vide.
  // POURQUOI save() : persiste le changement d'env pour que p5 render.js le lise au prochain frame.
  if (window.D && window.D.g) {
    window.D.g.activeEnv = 'jardin';
    save();
  }

  // ── Bloc infos jardin ────────────────────────────────────────────
  // RÔLE : Infos contextuelles sous le canvas — env jardin garanti par la ligne ci-dessus.
  const infoHTML = _buildGardenInfo();
  const infoEl   = document.createElement('div');
  infoEl.className = 'canvas-fs-info';
  infoEl.innerHTML = infoHTML;
  // RÔLE : Cache le bloc si toujours vide (données jardin absentes — premier lancement)
  if (!infoHTML) infoEl.style.display = 'none';

  // ── Assemblage et injection ──────────────────────────────────────
  // POURQUOI closeBtn dans l'overlay : le bouton ✕ est en position:fixed, pas affecté
  //          par le contexte de stacking de l'overlay.
  overlay.appendChild(closeBtn);
  document.body.appendChild(overlay);

  // RÔLE : Active la classe sur body — masque l'UI et reconfigure #console-top (z:850)
  document.body.classList.add('garden-fullscreen');

  // RÔLE : Injecte infoEl dans #console-top (z:850) et non dans l'overlay (z:800).
  // POURQUOI : #console-top avec bottom:0 couvre tout le viewport et masque tout ce qui
  //            est derrière lui (z < 850), y compris les éléments en position:fixed z:802.
  //            En injectant infoEl directement dans #console-top, il partage son contexte
  //            de stacking et s'affiche au-dessus du fond de l'overlay, sous le canvas.
  const consoleTop = document.getElementById('console-top');
  if (consoleTop) consoleTop.appendChild(infoEl);

  // RÔLE : Double RAF — laisse le reflow CSS s'appliquer avant de déclencher la transition
  requestAnimationFrame(() => {
    requestAnimationFrame(() => overlay.classList.add('open'));
  });

  // RÔLE : Tap sur le fond de l'overlay (hors bouton et infos) ferme le plein écran
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeCanvasFullscreen();
  });

  lockScroll();
  if (typeof _fermerMenuSiOuvert === 'function') _fermerMenuSiOuvert();
}

/**
 * RÔLE : Ferme le mode plein écran — retire l'overlay injecté, restitue le scroll.
 * POURQUOI : Le canvas n'a jamais bougé — il n'y a rien à restaurer côté DOM,
 *            juste supprimer l'overlay et déverrouiller le scroll.
 */
function closeCanvasFullscreen() {
  const overlay = document.getElementById('canvas-fs-overlay');
  if (overlay) overlay.remove();
  // RÔLE : Retire infoEl de #console-top — injecté là par openCanvasFullscreen()
  const infoEl = document.querySelector('.canvas-fs-info');
  if (infoEl) infoEl.remove();
  // RÔLE : Retire la classe garden-fullscreen — l'UI normale reprend son layout
  document.body.classList.remove('garden-fullscreen');
  // RÔLE : Restaure compact si le tama était réduit avant l'ouverture
  const consoleEl = document.getElementById('console-top');
  if (consoleEl && window._canvasFs_wasCompact) consoleEl.classList.add('compact');
  window._canvasFs_wasCompact = false;
  // RÔLE : Restaure l'env qui était actif avant l'ouverture du plein écran.
  if (window.D && window.D.g && window._canvasFs_prevEnv) {
    window.D.g.activeEnv = window._canvasFs_prevEnv;
    save();
  }
  window._canvasFs_prevEnv = null;
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
