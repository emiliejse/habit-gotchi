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
  const ageMoyen = total > 0
    ? Math.round(elements.reduce((s, e) => s + (e.age || 0), 0) / total)
    : 0;

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

  const etatJardin = score >= 0.7 ? 'Épanoui &mdash; les plantes poussent vite ✨'
                   : score >= 0.5 ? 'En forme &mdash; croissance régulière'
                   : score >= 0.3 ? 'Fatigué &mdash; pousse ralentie'
                   : 'En veille &mdash; il attend qu\'on prenne soin de soi';

  // ── Habitudes ────────────────────────────────────────────────────
  let habsTxt = '';
  if (habsTotal > 0) {
    if (habsDone >= habsTotal)
      habsTxt = `${habsDone}/${habsTotal} cochées &mdash; le jardin rayonne`;
    else if (habsDone > 0)
      habsTxt = `${habsDone}/${habsTotal} cochées &mdash; chaque habitude nourrit la pousse`;
    else
      habsTxt = `0/${habsTotal} cochées &mdash; tes routines influencent la vitalité`;
  } else {
    habsTxt = 'Ajoute des habitudes pour voir le jardin réagir à ta journée';
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
    const isPluie = [51,53,55,61,63,65,80,81,82,95,96,99].includes(wc);
    const effet = isPluie ? 'champignons favorisés' : 'influence la composition du jardin';
    meteoTxt = `${icon}&thinsp;${label}${temp ? ` · ${temp}` : ''} &mdash; ${effet}`;
  } else {
    meteoTxt = '🌤&thinsp;Chargement en cours&hellip;';
  }

  // ── Ligne contemplative ───────────────────────────────────────────
  const aproposTxt = 'Ce jardin pousse seul, entre hasard et mémoire de tes jours. Tu n\'as qu\'à observer.';

  // ── HTML ──────────────────────────────────────────────────────────
  return `<div class="garden-label">

  <div class="garden-label-section">
    <div class="garden-label-name">🪴 ${escape(nom)}</div>
    <div class="garden-label-meta">#${seedNum}${born ? ` &mdash; né le ${escape(born)}` : ''}</div>
  </div>

  <div class="garden-label-divider"></div>

  <div class="garden-label-section">
    <div class="garden-label-section-title">Composition</div>
    ${total > 0
      ? compLines + `<div class="garden-label-row garden-label-row--total"><span class="gli">∑</span><span>${total} élément${total > 1 ? 's' : ''} &mdash; âge moyen ${ageMoyen}&thinsp;j</span></div>`
      : `<div class="garden-label-row"><span class="gli">·</span><span>Jardin vide &mdash; il naît à chaque nouvelle journée</span></div>`
    }
  </div>

  <div class="garden-label-divider"></div>

  <div class="garden-label-section">
    <div class="garden-label-section-title">Aujourd'hui</div>
    <div class="garden-label-row"><span class="gli">✿</span><span>${habsTxt}</span></div>
    <div class="garden-label-row"><span class="gli">☁️</span><span>${meteoTxt}</span></div>
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

  // ── Injection de l'overlay (fond uniquement) ────────────────────
  document.body.appendChild(overlay);

  // RÔLE : Active la classe sur body — masque l'UI et reconfigure #console-top (z:850)
  document.body.classList.add('garden-fullscreen');
  // RÔLE : Rend le header jardin accessible (aria-hidden retiré à l'ouverture)
  document.getElementById('hdr-garden')?.removeAttribute('aria-hidden');

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

  // RÔLE : Fermeture uniquement via le bouton ✕ dans .hdr-garden — pas de tap fond
  // POURQUOI : Le jardin est une vue contemplatve — on évite les fermetures accidentelles

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
