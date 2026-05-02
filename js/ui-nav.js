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

  // RÔLE : Onglet jeux — même env que le parc (extérieur, lumière, espace de jeu)
  // POURQUOI 'parc' : ambiance légère et ouverte, cohérente avec l'idée de jouer dehors
  if (tab === 'game')    return 'parc';

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
    // RÔLE : Label compact affiché en haut quand l'onglet jeux est actif
    game:     '✿ Jeux cosy',
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

  // RÔLE : Onglet jeux — affiche le hub (liste des jeux disponibles)
  // POURQUOI renderGameHub() et non un render inline : la logique d'affichage est dans ui-game.js
  if (t === 'game') renderGameHub();

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
 * Format : "[adjectif] de [nom]" — ex : "Doré de Lunette", "Brumeux de Fétu"
 */
function _gardenName(seed) {
  const adjs = ['Doré','Brumeux','Fleuri','Sauvage','Endormi','Moussu','Serein','Murmureux','Secret','Vif'];
  const noms  = ['Lunette','Pépin','Noisette','Brindille','Caillou','Pâquerette','Lilas','Fétu','Corolle','Grigri'];
  return adjs[seed % adjs.length] + ' de ' + noms[Math.floor(seed / adjs.length) % noms.length];
}

/**
 * RÔLE : Construit le HTML de l'étiquette de jardinage plein écran.
 * Retourne une chaîne HTML à injecter dans .canvas-fs-info (enfant de #console-top).
 *
 * Structure HTML :
 *   .garden-label           — carte rectangulaire principale
 *   .garden-label-title     — nom + date de naissance du jardin
 *   .garden-label-divider   — trait horizontal décoratif
 *   .garden-label-grid      — liste de lignes icône + valeur
 *   .gli                    — icône de chaque ligne
 *   .garden-label-footer    — barre de vitalité + état textuel
 */
function _buildGardenInfo() {
  const g = window.D && window.D.g;
  if (!g) return '';

  const elements = window._gardenElements || [];
  const seed     = g.gardenSeed;

  // ── Identité — nom + numéro de seed pour montrer que c'est unique et généré ───
  const nom  = seed != null ? _gardenName(seed) : 'Inconnu';
  const seedNum = seed != null ? String(seed).padStart(6, '0') : '------';
  const born = g.gardenBorn
    ? new Date(g.gardenBorn).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  // ── Composition par type avec détail des variantes d'âge ────────
  // RÔLE : Compte par type ET distingue jeune/adulte/fané dans chaque type
  const ICONS_TYPE  = { fleur: '🌸', herbe: '🌿', pierre: '🪨', champignon: '🍄', arbuste: '🌳' };
  const LABELS_TYPE = { fleur: 'fleur', herbe: 'herbe', pierre: 'pierre', champignon: 'champignon', arbuste: 'arbuste' };
  const PLURAL_TYPE = { fleur: 'fleurs', herbe: 'herbes', pierre: 'pierres', champignon: 'champignons', arbuste: 'arbustes' };

  // Groupe par type avec sous-stats d'âge
  const byType = {};
  elements.forEach(e => {
    if (!byType[e.type]) byType[e.type] = { total: 0, jeunes: 0, matures: 0, fanent: 0 };
    byType[e.type].total++;
    const ratio = (e.maxAge || 10) > 0 ? e.age / (e.maxAge || 10) : 0;
    if (ratio >= 0.9)       byType[e.type].fanent++;
    else if (ratio >= 0.6)  byType[e.type].matures++;
    else                    byType[e.type].jeunes++;
  });

  // Ligne par type : "🌸 3 fleurs — 1 jeune, 2 adultes"
  const compLines = Object.entries(byType)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([type, s]) => {
      const icon  = ICONS_TYPE[type] || '·';
      const label = s.total > 1 ? (PLURAL_TYPE[type] || type + 's') : (LABELS_TYPE[type] || type);
      const parts = [];
      if (s.jeunes  > 0) parts.push(`${s.jeunes} jeune${s.jeunes  > 1 ? 's' : ''}`);
      if (s.matures > 0) parts.push(`${s.matures} adulte${s.matures > 1 ? 's' : ''}`);
      if (s.fanent  > 0) parts.push(`${s.fanent} fane${s.fanent  > 1 ? 'nt' : ''}`);
      const detail = parts.length ? ` &mdash; ${parts.join(', ')}` : '';
      return `<div class="garden-label-row garden-label-row--sub"><span class="gli">${icon}</span><span>${s.total}&thinsp;${label}${detail}</span></div>`;
    }).join('');

  const total    = elements.length;
  // RÔLE : Âge brut moyen en jours — conservé pour la phrase contemplative (aproposTxt)
  const ageMoyen = total > 0
    ? Math.round(elements.reduce((s, e) => s + (e.age || 0), 0) / total)
    : 0;
  // RÔLE : Ratio age/maxAge moyen — interprète la maturité relative du jardin (0 = tout jeune, 1 = tout fané)
  // POURQUOI : un chiffre brut en jours ne dit rien — une phrase interprétée est plus vivante
  const ageMoyenRatio = total > 0
    ? elements.reduce((s, e) => s + (e.age / (e.maxAge || 10)), 0) / total
    : 0;
  const ageMoyenTxt = total === 0    ? ''
    : ageMoyenRatio < 0.25           ? 'tous viennent de germer'
    : ageMoyenRatio < 0.55           ? 'jardin en pleine croissance'
    : ageMoyenRatio < 0.80           ? 'plusieurs arrivent à maturité'
    :                                  'beaucoup vont bientôt faner';

  // ── Vitalité (même calcul que garden.js _grayT()) ────────────────
  const habCatIds = (window.D.habits || []).map(h => h.catId);
  const todayKey  = typeof today === 'function' ? today() : null;
  const logToday  = (todayKey && window.D.log?.[todayKey]) || [];
  const habsDone  = logToday.filter(id => habCatIds.includes(id)).length;
  const habsTotal = habCatIds.length;
  const habRatio  = habsTotal > 0 ? habsDone / habsTotal : 0.5;
  const vitalite  = ((g.happiness ?? 2.5) + (g.energy ?? 2.5)) / 10;
  const score     = Math.min(habRatio, vitalite);
  const nbBarres  = Math.round(score * 5);
  const barres    = '▓'.repeat(nbBarres) + '░'.repeat(5 - nbBarres);

  // RÔLE : État du jardin avec diagnostic de la cause dominante
  // POURQUOI : identifier si c'est le Gotchi ou les habitudes qui tirent le score vers le bas
  const gotchiBas  = vitalite < 0.4;
  const gotchiHaut = vitalite > 0.7;
  const habsBas    = habRatio < 0.3;
  const habsHaut   = habRatio >= 0.7;
  const etatJardin =
    score >= 0.75 ? `Épanoui &mdash; ${gotchiHaut ? 'le Gotchi rayonne' : 'énergie ok'} et ${habsHaut ? 'toutes tes routines sont là' : 'tes habitudes portent leurs fruits'}`
  : score >= 0.55 ? `En forme &mdash; ${habsHaut ? 'bonnes habitudes' : `${habsDone} routine${habsDone > 1 ? 's' : ''} honorée${habsDone > 1 ? 's' : ''}`}, croissance régulière`
  : score >= 0.35 ? `Fatigué &mdash; ${gotchiBas ? 'le Gotchi manque d\'énergie' : habsBas ? 'peu de routines aujourd\'hui' : 'rythme de pousse ralenti'}`
  : `En veille &mdash; ${gotchiBas && habsBas ? 'Gotchi à plat et peu d\'habitudes faites' : gotchiBas ? 'le Gotchi est épuisé' : 'les routines manquent aujourd\'hui'}`;

  // ── Habitudes ────────────────────────────────────────────────────
  // RÔLE : Phrase habitudes — spécifique selon le ratio réalisé/total
  // POURQUOI : messages génériques remplacés par des textes qui reflètent vraiment l'état du jour
  let habsTxt = '';
  if (habsTotal === 0) {
    habsTxt = 'Ajoute des habitudes pour voir le jardin réagir à ta journée';
  } else if (habsDone === 0) {
    habsTxt = `Aucune habitude faite aujourd'hui &mdash; le jardin est en pause, comme toi peut-être`;
  } else if (habsDone === habsTotal) {
    habsTxt = `${habsDone}/${habsTotal} &mdash; toutes tes routines honorées, le jardin rayonne et les fleurs s'ouvrent`;
  } else if (habRatio >= 0.6) {
    habsTxt = `${habsDone}/${habsTotal} faites &mdash; bonne journée, le jardin est en pleine croissance`;
  } else if (habRatio >= 0.3) {
    habsTxt = `${habsDone}/${habsTotal} faites &mdash; le jardin pousse doucement, il attend tes autres routines`;
  } else {
    habsTxt = `${habsDone}/${habsTotal} faites &mdash; peu de routines aujourd'hui, la croissance est lente`;
  }

  // ── Météo ─────────────────────────────────────────────────────────
  // POURQUOI window.meteoData et non g.meteoData :
  //   fetchMeteo() stocke dans window.meteoData (current_weather open-meteo).
  //   Le champ .desc n'existe pas — l'API renvoie weathercode + temperature + windspeed.
  const WC_LABELS = {
    0:'Ciel dégagé', 1:'Peu nuageux', 2:'Partiellement nuageux', 3:'Couvert',
    45:'Brouillard', 48:'Brouillard givrant',
    51:'Bruine légère', 53:'Bruine modérée', 55:'Bruine dense',
    61:'Pluie légère', 63:'Pluie modérée', 65:'Pluie forte',
    71:'Neige légère', 73:'Neige modérée', 75:'Neige forte',
    80:'Averses légères', 81:'Averses', 82:'Averses violentes',
    95:'Orage', 96:'Orage avec grêle', 99:'Orage violent',
  };
  const WC_ICONS = {
    0:'☀️', 1:'🌤', 2:'⛅', 3:'☁️',
    45:'🌫', 48:'🌫',
    51:'🌦', 53:'🌦', 55:'🌧',
    61:'🌧', 63:'🌧', 65:'🌧',
    71:'❄️', 73:'❄️', 75:'❄️',
    80:'🌦', 81:'🌧', 82:'⛈',
    95:'⛈', 96:'⛈', 99:'⛈',
  };
  let meteoTxt = '';
  const meteo = window.meteoData || window.D?.meteo;
  if (meteo && meteo.weathercode != null) {
    const wc    = meteo.weathercode;
    const icon  = WC_ICONS[wc]   || '🌤';
    const label = WC_LABELS[wc]  || `Code ${wc}`;
    const temp  = meteo.temperature != null ? `${Math.round(meteo.temperature)}&thinsp;°C` : '';
    // RÔLE : Catégoriser le code météo pour choisir l'effet narratif adapté
    // POURQUOI : l'ancienne version ne distinguait que pluie/pas-pluie — trop binaire
    const isClair    = [0, 1].includes(wc);
    const isPeuNuag  = [2].includes(wc);
    const isCouvert  = [3].includes(wc);
    const isBrouill  = [45, 48].includes(wc);
    const isBruine   = [51, 53, 55].includes(wc);
    const isPluieFaib= [61, 80].includes(wc);
    const isPluieMod = [63, 81].includes(wc);
    const isPluieFort= [65, 82].includes(wc);
    const isNeige    = [71, 73, 75].includes(wc);
    const isOrage    = [95, 96, 99].includes(wc);

    const effet =
      isClair     ? 'les fleurs s\'ouvrent grand, les couleurs sont vives'
    : isPeuNuag   ? 'lumière douce, les herbes poussent tranquillement'
    : isCouvert   ? 'les fleurs restent mi-closes, les herbes poussent bien'
    : isBrouill   ? 'le jardin est enveloppé de brume, tout pousse lentement'
    : isBruine    ? 'bruine légère — les champignons commencent à apparaître'
    : isPluieFaib ? 'pluie fine — les champignons prolifèrent, les pierres brillent'
    : isPluieMod  ? 'bonne pluie — les champignons envahissent doucement le jardin'
    : isPluieFort ? 'pluie forte — les tiges se courbent, les insectes se cachent'
    : isNeige     ? 'le jardin se fige sous la neige, tout est en veille'
    : isOrage     ? 'orage — les tiges ploient, les fleurs ferment leurs pétales'
    : 'influence la composition du jardin'; // fallback codes météo inconnus

    meteoTxt = `${icon}&thinsp;${label}${temp ? ` · ${temp}` : ''} &mdash; ${effet}`;
  } else {
    meteoTxt = '🌤&thinsp;Chargement en cours&hellip;';
  }

  // ── Ligne contemplative ───────────────────────────────────────────
  // RÔLE : Phrase choisie parmi 8 selon (seed + âge moyen) — varie subtilement d'un jardin à l'autre
  // POURQUOI : une phrase fixe ne reflète pas l'unicité du jardin
  const APROPOS = [
    'Ce jardin pousse entre hasard et mémoire. Tu n\'as qu\'à observer.',
    'Chaque plante ici a germé un jour où tu étais là.',
    'Le jardin ne juge pas. Il pousse à son rythme, comme toi.',
    'Certaines plantes fanent pour faire place aux suivantes. C\'est normal.',
    'Ce jardin est unique — aucun autre ne ressemblera au tien.',
    'Le désordre du vivant. Rien n\'est prévu, tout pousse quand même.',
    'Un jardin qui se souvient. Pas de toi — de la seed qui le définit.',
    'Même sans toi, il continue. Doucement.',
  ];
  const aproposTxt = APROPOS[((seed ?? 0) + ageMoyen) % APROPOS.length];

  // ── HTML ──────────────────────────────────────────────────────────
  return `<div class="garden-label">

  <div class="garden-label-section">
    <div class="garden-label-name">🪴 ${escape(nom)}</div>
    <div class="garden-label-meta">#${seedNum}${born ? ` &mdash; né le ${escape(born)}` : ''}</div>
  </div>

  <!-- RÔLE : Zone scrollable — Composition + Aujourd'hui défilent ensemble -->
  <!-- POURQUOI wrapper séparé : le nom (haut) et la vitalité/phrase (bas) restent ancrés -->
  <div class="garden-label-scroll">

    <div class="garden-label-divider"></div>

    <div class="garden-label-section">
      <div class="garden-label-section-title">Composition</div>
      ${total > 0
        ? compLines + `<div class="garden-label-row garden-label-row--total"><span class="gli">∑</span><span>${total} élément${total > 1 ? 's' : ''}${ageMoyenTxt ? ` &mdash; ${ageMoyenTxt}` : ''}</span></div>`
        : `<div class="garden-label-row"><span class="gli">·</span><span>Jardin vide &mdash; les premières plantes germent demain</span></div>`
      }
    </div>

    <div class="garden-label-divider"></div>

    <div class="garden-label-section">
      <div class="garden-label-section-title">Aujourd'hui</div>
      <div class="garden-label-row"><span class="gli">✿</span><span>${habsTxt}</span></div>
      <div class="garden-label-row"><span class="gli">☁️</span><span>${meteoTxt}</span></div>
    </div>

  </div>

  <div class="garden-label-divider"></div>

  <div class="garden-label-section garden-label-section--footer">
    <div class="garden-label-vitality">
      <span class="garden-label-bars">${barres}</span>
      <span class="garden-label-state">${etatJardin}</span>
    </div>
    <div class="garden-label-about">${aproposTxt}</div>
  </div>

</div>`;
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

  // ── Création de l'overlay (fond coloré uniquement — plus de bouton ✕ ici) ───
  // RÔLE : L'overlay apporte le fond dégradé palette app. Le bouton ✕ et le titre
  //        sont dans .hdr-garden (index.html), visible via body.garden-fullscreen CSS.
  const overlay     = document.createElement('div');
  overlay.id        = 'canvas-fs-overlay';
  overlay.className = 'canvas-fullscreen-overlay';

  // RÔLE : Mémorise l'env actif + l'état compact avant de modifier quoi que ce soit.
  // POURQUOI : closeCanvasFullscreen() restaure les deux pour ne rien laisser cassé.
  window._canvasFs_prevEnv    = (window.D && window.D.g) ? window.D.g.activeEnv : null;
  const consoleEl = document.getElementById('console-top');
  window._canvasFs_wasCompact = consoleEl ? consoleEl.classList.contains('compact') : false;

  // RÔLE : Retire compact si présent — en plein écran jardin le tama doit être pleine taille.
  // POURQUOI : compact applique margin-top:-48px sur #tama-bubble-wrap via une transition CSS 400ms.
  //            Il faut attendre la fin de cette transition avant d'ouvrir l'overlay — sinon le
  //            canvas est encore en position compacte (coin supérieur gauche) au moment du rendu.
  if (consoleEl) consoleEl.classList.remove('compact');

  // RÔLE : Force l'env jardin (sans save() ici — différé dans _doOpen pour éviter
  // un re-render prématuré qui flasherait l'onglet d'accueil pendant la transition)
  if (window.D && window.D.g) {
    window.D.g.activeEnv = 'jardin';
  }

  // ── Fonction qui fait l'ouverture effective ─────────────────────
  // POURQUOI séparée : si le tama était en mode compact, on doit attendre la fin
  // de sa transition CSS (margin-top:-48px → 0, durée 400ms) avant d'injecter
  // l'overlay — sinon le canvas se positionne encore depuis le coin supérieur gauche.
  function _doOpen() {
    // RÔLE : Persiste l'env jardin maintenant que l'UI est masquée
    if (typeof save === 'function') save();

    // Bloc infos jardin
    const infoHTML = _buildGardenInfo();
    const infoEl   = document.createElement('div');
    infoEl.className = 'canvas-fs-info';
    infoEl.innerHTML = infoHTML;
    if (!infoHTML) infoEl.style.display = 'none';

    // Injection de l'overlay AVANT #console-top
    const consoleTop = document.getElementById('console-top');
    document.body.insertBefore(overlay, consoleTop);

    // Injecte les infos dans #console-top
    if (consoleTop) consoleTop.appendChild(infoEl);

    // RÔLE : Force un reflow pour que le navigateur connaisse l'état initial
    //        (display:none + translateY(100%)) avant de déclencher la transition.
    // POURQUOI void offsetHeight : sans ce reflow forcé, le navigateur peut batcher
    //          display:none → display:block + translateY(0) en un seul paint,
    //          ce qui annule la transition CSS — le panneau apparaît sans glisser.
    void overlay.offsetHeight; // force reflow

    // POURQUOI garden-fullscreen n'est PAS posé ici :
    // Il est posé immédiatement au tap (voir ci-dessous) pour que p5 bascule en mode
    // contemplatif instantanément — le canvas ne doit pas afficher le HUD pendant la
    // transition compact. L'overlay s'ouvre une fois le layout stabilisé.

    // RÔLE : Réactive l'opacité du tama — masqué pendant la transition compact via
    //        body.garden-preparing #tama-shell-main { opacity:0 }.
    // POURQUOI transition inline : garden-preparing est déjà retiré à ce stade,
    //          donc la règle CSS opacity:0 n'est plus active — on repart de 0 vers 1
    //          avec un fondu court (200ms) pour que le tama apparaisse proprement.
    const shell = document.getElementById('tama-shell-main');
    if (shell) {
      shell.style.transition = 'opacity 0.2s ease';
      shell.style.opacity    = '1';
    }

    overlay.classList.add('open');

    lockScroll();
    // Retire inert de #console-top — lockScroll() vient de le poser, mais
    // #console-top est la zone active en mode jardin (contient le bouton ✕)
    const ct = document.getElementById('console-top');
    if (ct) ct.inert = false;
  }

  // RÔLE : Bascule immédiatement en mode jardin dès le tap — masque l'UI ET fait passer
  //        p5 en mode contemplatif (HUD + sélecteur d'env masqués) sans délai.
  // POURQUOI garden-fullscreen est posé ICI et non dans _doOpen() :
  //   - En mode compact, il y a ~400ms de transition CSS à attendre avant d'injecter
  //     l'overlay (sinon le canvas se positionne depuis le coin supérieur gauche).
  //   - Pendant ces 400ms, le canvas p5 était visible avec son ancien env (HUD, sélecteur…).
  //   - Poser garden-fullscreen maintenant fait passer p5 en mode contemplatif immédiatement :
  //     isGardenFullscreen est lu à chaque frame p5 → le jardin apparaît dès le prochain draw().
  // POURQUOI ça ne casse plus la transition CSS :
  //   - L'ancien bug venait du `margin-top: 0 !important` sur #tama-bubble-wrap (maintenant retiré).
  //   - Sans ce !important, garden-fullscreen n'interfère plus avec la transition compact.
  document.body.classList.add('garden-preparing', 'garden-fullscreen');
  document.getElementById('hdr-garden')?.removeAttribute('aria-hidden');

  // RÔLE : Attend que margin-top de #tama-bubble-wrap atteigne 0 via polling RAF,
  //        puis injecte l'overlay (canvas bien positionné).
  // POURQUOI polling RAF plutôt que transitionend : robuste si la transition est déjà
  //          terminée au moment du tap (margin-top vaut déjà 0 → passage immédiat).
  if (window._canvasFs_wasCompact) {
    const wrap = document.getElementById('tama-bubble-wrap');
    // RÔLE : Boucle RAF — vérifie à chaque frame si margin-top a atteint 0.
    // POURQUOI seuil de 1px : getComputedStyle renvoie des px avec décimales ;
    //          on accepte < 1px d'écart pour absorber les arrondis de rendu.
    function _waitForLayout() {
      const mt = wrap ? parseFloat(getComputedStyle(wrap).marginTop) : 0;
      if (Math.abs(mt) < 1) {
        // RÔLE : Verrouille opacity:0 en inline sur le shell AVANT de retirer garden-preparing.
        // POURQUOI : retirer garden-preparing supprime la règle CSS `opacity:0` — si on ne
        //            fixe pas la valeur en inline au préalable, le tama flashe à opacity:1
        //            une frame avant que _doOpen() pose la transition de fondu.
        const shell = document.getElementById('tama-shell-main');
        if (shell) shell.style.opacity = '0';
        // Layout stabilisé — retire la classe de préparation et ouvre l'overlay
        document.body.classList.remove('garden-preparing');
        _doOpen();
      } else {
        requestAnimationFrame(_waitForLayout);
      }
    }
    requestAnimationFrame(_waitForLayout);
  } else {
    // Pas de transition compact — passage direct
    document.body.classList.remove('garden-preparing');
    _doOpen();
  }

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
  // RÔLE : Remet le style inline opacity sur le tama — posé par _waitForLayout() pour
  //        éviter un flash avant le fondu d'ouverture. Sans nettoyage, la prochaine
  //        ouverture depuis l'accueil (non compact) hériterait de l'opacity:1 inline.
  const shell = document.getElementById('tama-shell-main');
  if (shell) { shell.style.opacity = ''; shell.style.transition = ''; }
  // RÔLE : Retire le focus du bouton ✕ avant de remettre aria-hidden sur son parent.
  // POURQUOI : Si le bouton garde le focus au moment où aria-hidden est posé sur .hdr-garden,
  //            le navigateur lève un warning "Blocked aria-hidden on focused element".
  document.querySelector('.hdr-garden-close')?.blur();
  // RÔLE : Remet aria-hidden sur le header jardin — masqué hors mode plein écran
  document.getElementById('hdr-garden')?.setAttribute('aria-hidden', 'true');
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
