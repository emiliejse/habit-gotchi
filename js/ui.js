/* ============================================================
   ui.js — Interactions, panneaux, modales, appels API Claude
   RÔLE : Ce fichier correspond aux "Mains" et à la "Bouche" de l'app.
   Il gère tout ce que l'utilisateur clique, lit et ouvre.
   Dépend de : app.js (window.D, save, today, hr, haptic, addXp,
               getSt, nxtTh, calcStr, toggleHab, editH, updBubbleNow,
               CATS, STG, window.HG_CONFIG, SK)

   NAVIGATION RAPIDE (Ctrl+G dans VS Code → numéro de ligne) :
   §1  ~17    HELPER IA         callClaude()
   §2  ~45    UTILITAIRES       showTDAH, showCycle, escape, animEl, toast, modal
   §3  ~109   NAVIGATION        go(), goMenu(), syncConsoleHeight()
   §4  ~211   HUD & DATE        updDate(), updUI(), updBadgeBoutique()
   §5  ~315   REPAS             ouvrirSnack(), giveSnack()
   §6  ~519   HABITUDES         renderHabs(), editHabInline(), saveHabInline()
   §7  ~584   BOUTIQUE          ouvrirBoutique(), acheterProp(), toggleProp()
   §8  ~1280  IA BULLE/CADEAU   askClaude(), acheterPropClaude()
   §9  ~1582  IA SOUTIEN        genSoutien(), sendSoutienMsg()
   §10 ~1808  IA BILAN          genBilanSemaine(), copyBilanSemaine()
   §11 ~1937  PERSONNALISATION  renderPerso(), applyUIPalette()
   §12 ~2017  PIN & JOURNAL     saveJ(), renderJ(), exportJournal()
   §13 ~2243  PROGRESSION       renderProg(), showDayDetail()
   §14 ~2341  RÉGLAGES          saveName(), saveApi(), exportD(), confirmReset()
   §15 ~2399  TABLETTE RÉTRO    openTablet(), updTabletBadge()
   §16 ~2467  BIENVENUE         checkWelcome(), showWelcomeModal()
   §17 ~2696  AGENDA            ouvrirAgenda(), sauvegarderRdv(), renderAgendaMois()
   §18 ~3831  INIT UI           window.initUI()
   ============================================================ */

// ─────────────────────────────────────────────────────────────
// RÔLE  : Helper centralisé pour tous les appels API Claude.
// POURQUOI : Évite de répéter les headers, l'URL et le try/catch
//            dans chaque fonction qui appelle l'IA (x5 dans ui.js).
// USAGE : const data = await callClaude({ messages, max_tokens, system, temperature });
//         Retourne le JSON Anthropic brut, ou lance une Error si échec.
// ─────────────────────────────────────────────────────────────
async function callClaude({ messages, max_tokens = 500, system, temperature }) {
  const key = D.apiKey;
  if (!key) throw new Error('Clé API manquante — vérifie les réglages');

  // Construit le body : on n'inclut system et temperature que s'ils sont fournis
  const body = { model: AI_MODEL, max_tokens, messages };
  if (system      !== undefined) body.system      = system;
  if (temperature !== undefined) body.temperature = temperature;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify(body)
  });

  const d = await r.json();

  // Si l'API renvoie une erreur structurée, on la propage proprement
  if (d.error) throw new Error(d.error.message);

  return d; // le try/catch reste dans chaque fonction appelante
}

/* ============================================================
   UTILITAIRES USER_CONFIG
   ============================================================ */
// RÔLE : Indique si les mentions TDAH doivent être affichées.
// POURQUOI : Alexia ne veut pas voir ces mentions. Cette fonction
//            centralise la vérification pour tout le fichier.
//            Par défaut true — comportement inchangé si pas de config.
function showTDAH() {
  return window.USER_CONFIG?.ui?.showTDAHMention !== false;
}

// RÔLE : Indique si la feature cycle menstruel doit être affichée.
// POURQUOI : Même logique que showTDAH() — on pose les deux ici
//            pour les avoir au même endroit.
//            Par défaut true — comportement inchangé si pas de config.
function showCycle() {
  return window.USER_CONFIG?.ui?.showCycleFeature !== false;
}

// RÔLE : Protège l'app contre les injections HTML (XSS).
// POURQUOI : D.g.name, les noms de props et les textes IA peuvent contenir
//            des caractères spéciaux (<, >, &, ", ') qui, injectés directement
//            dans innerHTML, permettraient d'exécuter du code malveillant.
//            Cette fonction les remplace par leurs équivalents HTML inoffensifs.
function escape(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')   // & → &amp; (en premier, sinon les autres sont re-encodés)
    .replace(/</g, '&lt;')    // < → &lt;
    .replace(/>/g, '&gt;')    // > → &gt;
    .replace(/"/g, '&quot;')  // " → &quot;
    .replace(/'/g, '&#39;');  // ' → &#39;
}

// RÔLE : Indique si la feature agenda/rendez-vous doit être affichée.
// POURQUOI : Émilie ne prévoit pas de s'en servir à terme.
//            Alexia oui. Cette fonction permet de masquer proprement
//            le bouton et les sections RDV selon la config.
//            Par défaut true — comportement inchangé si pas de config.
function showRDV() {
  return window.USER_CONFIG?.ui?.showRDVFeature !== false;
}

/**
 * UTILITAIRE GLOBAL (Système 7 : Ingénierie)
 * animEl() : applique une animation Animate.css sur un élément.
 * La classe est retirée automatiquement après l'animation pour pouvoir rejouer.
 */
function animEl(el, anim, dur = 600) {
  if (!el) return;
  el.style.setProperty('--animate-duration', dur + 'ms');
  el.classList.add('animate__animated', 'animate__' + anim);
  el.addEventListener('animationend', () => {
    el.classList.remove('animate__animated', 'animate__' + anim);
  }, { once: true });
}

/* ─── SYSTÈME 2 : ÉCOSYSTÈME & NAVIGATION ────────────────────── */
let journalLocked = true;

/**
 * Moteur de Routage interne (Single Page Application)
 * Affiche l'onglet ciblé et adapte l'environnement du Gotchi en fond.
 */
function syncConsoleHeight() {
  const top  = document.getElementById('console-top');
  const zone = document.getElementById('dynamic-zone');
  if (!top || !zone) return;

  requestAnimationFrame(() => {
    // RÔLE : Mesure la hauteur réelle de #console-top pour décaler la zone scrollable en dessous.
    // POURQUOI : offsetHeight = hauteur visuelle réelle du bloc fixe, indépendante du scroll
    //            et de la position dans le viewport. Plus fiable que getBoundingClientRect().bottom
    //            qui variait selon les plateformes (safe area iOS, zoom navigateur...).
    const h = top.offsetHeight;
    // POURQUOI : on soustrait --sat car offsetHeight l'inclut dans le padding de #console-top,
    //            mais la dynamic-zone est déjà décalée par le layout — sinon double-comptage sur iOS
    const sat = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0;
    zone.style.paddingTop = (h - sat + 6) + 'px';
  });
}

function syncDuringTransition(shell) {
  let running = true;
  
  // boucle : sync à chaque frame tant que la transition tourne
  const tick = () => {
    if (!running) return;
    syncConsoleHeight();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  
  // stop quand la transition CSS de .shrunk se termine
  const stop = () => { 
    running = false; 
    syncConsoleHeight(); // un dernier sync propre
    shell.removeEventListener('transitionend', stop);
  };
  shell.addEventListener('transitionend', stop);
  
  // filet de sécurité : stop après 600ms max (au cas où transitionend ne se déclenche pas)
  setTimeout(stop, 600);
}


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
  // RÔLE : Sync frame par frame pendant toute la durée de la transition
  // POURQUOI : margin-top de #tama-bubble-wrap s'anime sur 400ms — la dynamic-zone
  //            doit suivre en continu, pas juste au début/fin.
  const wrap = document.getElementById('tama-bubble-wrap');
  syncDuringTransition(wrap);
}

function _preventScroll(e) { e.preventDefault(); }
function lockScroll() {
  document.getElementById('dynamic-zone').style.overflowY = 'hidden';
  document.addEventListener('touchmove', _preventScroll, { passive: false });
}
function unlockScroll() {
  document.getElementById('dynamic-zone').style.overflowY = '';
  document.removeEventListener('touchmove', _preventScroll);
}

function toggleMenu() {
  const ov = document.getElementById('menu-overlay');
  if (!ov.classList.contains('open')) {
    const nm = document.getElementById('menu-gotchi-name');
    if (nm) nm.textContent = window.D.g.name || 'Gotchi';
    lockScroll();
  } else {
    unlockScroll();
  }
  ov.classList.toggle('open');
}


function goMenu(t) { toggleMenu(); go(t); }

/**
 * RÔLE : Déplier / replier le bloc sliders (énergie + bonheur).
 * POURQUOI : Les sliders sont masqués par défaut pour économiser la hauteur du #console-top.
 *            Un tap sur la barre résumée les révèle. Un second tap les masque à nouveau.
 */
function toggleSliders() {
  const btn  = document.getElementById('sliders-toggle');
  const body = document.getElementById('sliders-body');
  const wrap = document.getElementById('sliders-wrap');
  if (!btn || !body || !wrap) return;

  const isOpen = btn.getAttribute('aria-expanded') === 'true';

  if (isOpen) {
    // RÔLE : Replier — masquer le corps, retirer la classe open (masque le hint)
    body.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    wrap.classList.remove('open');
  } else {
    // RÔLE : Déplier — afficher le corps, ajouter la classe open (affiche le hint)
    body.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    wrap.classList.add('open');
  }

  // RÔLE : Recalculer la hauteur du #console-top après le changement de taille
  syncConsoleHeight();
}

function updDate() {
  const d = new Date();
  const days = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  const mos  = ['jan','fév','mars','avr','mai','juin','juil','août','sep','oct','nov','déc'];
  document.getElementById('date-txt').textContent = `${days[d.getDay()]} ${d.getDate()} ${mos[d.getMonth()]}`;
}
updDate();

/* ─── SYSTÈME 7 : INGÉNIERIE (UI & FEEDBACK) ─────────────────── */
let _toastTimer;

function _noOrphan(txt) {
  // Colle la ponctuation finale à son mot précédent
  txt = txt.replace(/ ([!?.:…\u2026]+)$/, '\u00A0$1');
  // Colle le dernier mot au précédent (évite 1 mot ou 2 mots isolés)
  txt = txt.replace(/ (\S+)$/, '\u00A0$1');
  return txt;
}

/**
 * Toast : Notification éphémère douce en bas de l'écran (non-bloquante)
 */
function toast(m) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = _noOrphan(m);
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

/**
 * RÔLE : Génère le bouton ✕ de fermeture persistant pour toutes les modales
 * POURQUOI : Sans bouton explicite, l'utilisatrice doit deviner qu'il faut taper à côté
 *            pour fermer — source de frustration sur mobile, surtout avec TDAH
 */
function _modalCloseBtn() {
  return `<button class="modal-close" onclick="clModal()" aria-label="Fermer">✕</button>`;
}

/**
 * Modale standard avec bouton OK (bloquante)
 */
function toastModal(m) {
  document.getElementById('modal').style.display = 'flex';
  // POURQUOI padding-top:36px sur le <p> : le bouton .modal-close est positionné à top:10px avec ~24px de hauteur
  // Sans ce padding, le texte commence sous la croix et se superpose visuellement
  document.getElementById('mbox').innerHTML = `${_modalCloseBtn()}<p style="text-align:center;font-size:var(--fs-sm);padding-top:36px;line-height:1.5">${m}</p><button class="btn btn-p" onclick="clModal()" style="width:100%;margin-top:8px">OK</button>`;
  animEl(document.getElementById('mbox'), 'bounceIn');
}

/**
 * Mini-toast contextuel (ex: utilisé par l'animation du Snack)
 */
function toastSnack(msg) {
  let el = document.getElementById('snack');
  if (!el) {
    el = document.createElement('div'); el.id = 'snack';
    el.style.cssText = `position:fixed;bottom:60px;left:50%;transform:translateX(-50%);
      background:#38304a;color:#fff;padding:var(--sp-sm) 16px;border-radius:20px;font-size:var(--fs-sm);
      font-family:'Courier New',monospace;z-index:500;opacity:0;transition:opacity .2s;
      pointer-events:none;white-space:nowrap;`;
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => el.style.opacity = '0', 1800);
}

/* ─── SYSTÈME 1 : MÉTABOLISME (Interactions) ─────────────────── */
let modalLocked = false; // ← true pendant le soutien

function clModal(e) {
  if (modalLocked) return;
  // POURQUOI : on ferme si : (a) clic direct sur le fond #modal, (b) appel sans event (depuis bouton OK/Annuler), (c) bouton .modal-close
  if (!e || e.target.id === 'modal' || e.currentTarget?.classList?.contains('modal-close')) {
    document.getElementById('modal').style.display = 'none';
    unlockScroll();
  }
}

/**
 * RÔLE : Ouvre la modale avec contenu HTML et injecte automatiquement le bouton ✕
 * POURQUOI : Centralise l'ouverture pour éviter de modifier les 20+ appels mbox.innerHTML
 *            Le ✕ apparaît sur toutes les modales sans avoir à y penser à chaque fois
 * USAGE : openModal(`<h3>Titre</h3><p>Contenu</p>`)
 */
function openModal(html) {
  const modal = document.getElementById('modal');
  const mbox  = document.getElementById('mbox');
  modal.style.display = 'flex';
  lockScroll();
  // RÔLE : Retire la classe avant d'injecter le contenu, force le reflow, puis remet la classe
  // POURQUOI : L'ordre est critique — si on injecte le HTML après le remove/add, le navigateur
  //            batchera les mutations DOM et ignorera le reflow entre les deux, cassant l'animation
  //            à la deuxième ouverture. Retirer d'abord garantit un cycle d'animation propre.
  mbox.classList.remove('modal-pop');
  void mbox.offsetWidth; // force reflow — le navigateur recalcule avant d'appliquer la classe
  mbox.innerHTML = `${_modalCloseBtn()}${html}`;
  mbox.classList.add('modal-pop');
}

/**
 * Ouvre la popup de nourriture.
 * Comportement :
 *  - Hors fenêtre repas (entre 11h-15h, etc.) → message "pas l'heure"
 *  - Repas déjà fait sur cette fenêtre → message "déjà mangé"
 *  - Fenêtre dispo → popup avec 3 snacks aléatoires (dont 1 préféré caché)
 */
function ouvrirSnack() {
  const modal = document.getElementById('modal');
  const mbox  = document.getElementById('mbox');
  const h = hr();
  
  // Cas 1 : Nuit (avant 7h ou après 22h) → reprend le message existant
  if (h >= 22 || h < 7) {
    modal.style.display = 'flex';
    mbox.innerHTML = `
      <div style="text-align:center;padding:10px">
        <div style="font-size:48px;margin-bottom:var(--sp-sm)">🌙</div>
        <p style="font-size:12px;margin-bottom:var(--sp-md)">
          ${escape(window.D.g.name)} dort... reviens demain 💜
        </p>
        <button class="btn btn-p" onclick="clModal()" style="width:100%">OK</button>
      </div>`;
    animEl(mbox, 'bounceIn');
    return;
  }
  
  // Cas 2 : Hors fenêtre repas (15h-18h) → message "pas l'heure"
  const meal = getCurrentMealWindow();
  if (!meal) {
    modal.style.display = 'flex';
    mbox.innerHTML = `
      <div style="text-align:center;padding:10px">
        <div style="font-size:48px;margin-bottom:var(--sp-sm)">⏰</div>
        <p style="font-size:var(--fs-sm);margin-bottom:var(--sp-md)">
          Ce n'est pas encore l'heure du repas...<br>
          <span style="color:var(--text2);font-size:var(--fs-xs)">
            Matin 7h-11h • Midi 11h-15h • Soir 18h-22h
          </span>
        </p>
        <button class="btn btn-p" onclick="clModal()" style="width:100%">OK</button>
      </div>`;
    animEl(mbox, 'bounceIn');
    return;
  }
  
  // Cas 3 : Repas déjà pris sur cette fenêtre
  const meals = ensureMealsToday();
  if (meals[meal]) {
    const w = MEAL_WINDOWS[meal];
    modal.style.display = 'flex';
    mbox.innerHTML = `
      <div style="text-align:center;padding:10px">
        <div style="font-size:48px;margin-bottom:var(--sp-sm)">${w.icon}</div>
        <p style="font-size:var(--fs-sm);margin-bottom:var(--sp-md)">
          ${escape(window.D.g.name)} a déjà mangé ce ${w.label.toLowerCase()} 💜<br>
          <span style="color:var(--text2);font-size:var(--fs-xs)">Reviens à la prochaine fenêtre repas</span>
        </p>
        <button class="btn btn-p" onclick="clModal()" style="width:100%">OK</button>
      </div>`;
    animEl(mbox, 'bounceIn');
    return;
  }
  
  // Cas 4 : Fenêtre dispo → popup choix de snack
  const snacks = pickThreeSnacks();
  const w = MEAL_WINDOWS[meal];
  
  // Boutons snack : on échappe l'emoji pour passer en argument à giveSnack()
  const snackButtons = snacks.map(emoji => `
    <button class="btn btn-snack" 
            onclick="giveSnack('${emoji}');clModal();" 
            style="flex:1;font-size:32px;padding:var(--sp-md) 4px;background:var(--card);border:2px solid var(--border);border-radius:var(--r-md);cursor:pointer;transition:transform .15s">
      ${emoji}
    </button>
  `).join('');
  
  modal.style.display = 'flex';
  mbox.innerHTML = `
    <div style="text-align:center;padding:10px">
      <div style="font-size:24px;margin-bottom:4px">${w.icon}</div>
      <p style="font-size:var(--fs-sm);margin-bottom:4px;font-weight:bold">
        Repas du ${w.label.toLowerCase()}
      </p>
      <p style="font-size:var(--fs-xs);color:var(--text2);margin-bottom:var(--sp-md)">
        Que veux-tu donner à ${escape(window.D.g.name)} ?
      </p>
      <div style="display:flex;gap:6px;margin-bottom:var(--sp-md)">
        ${snackButtons}
      </div>
      <button class="btn btn-s" onclick="clModal()" style="width:100%">Annuler</button>
    </div>`;
  animEl(mbox, 'bounceIn');
}

/* ─── SYSTÈME 7 : INGÉNIERIE (Mise à jour des Data dans le DOM) ── */

/**
 * RÔLE : Met à jour les fleurs de quota dans #thought-count
 * POURQUOI : Remplace l'affichage textuel "(0/3)" par 3 ✿ visuelles qui s'estompent
 */
function updThoughtFlowers() {
  const tc = document.getElementById('thought-count');
  if (!tc) return;
  const used = window.D.thoughtCount || 0;
  const total = 3;
  tc.innerHTML = Array.from({ length: total }, (_, i) =>
    `<span class="${i < (total - used) ? 'flower-on' : 'flower-off'}">✿</span>`
  ).join('');
}

/**
 * RÔLE : Met à jour les fleurs de quota dans #bilan-flowers (onglet Progrès)
 * POURQUOI : Même logique visuelle que les fleurs de pensée — 3 ✿ qui s'estompent au fil des bilans générés.
 *            N'affiche les fleurs que si on est sur la semaine en cours et en fin de semaine.
 */
/**
 * RÔLE : Met à jour les fleurs de quota dans #bilan-flowers (onglet Progrès)
 * POURQUOI : Même logique visuelle que les fleurs de pensée — 3 ✿ qui s'estompent au fil des bilans générés.
 *            Les fleurs ne s'affichent qu'à partir du vendredi (le bouton est actif).
 */
function updBilanFlowers() {
  const bf = document.getElementById('bilan-flowers');
  if (!bf) return;
  // On n'affiche les fleurs que le vendredi/samedi/dimanche (quand le bouton est actif)
  const jourSemaine   = new Date().getDay();
  const estFinSemaine = jourSemaine === 0 || jourSemaine === 5 || jourSemaine === 6;
  if (!estFinSemaine) { bf.innerHTML = ''; return; }
  const used  = window.D.g.bilanCount || 0;
  const total = 3;
  bf.innerHTML = Array.from({ length: total }, (_, i) =>
    `<span class="${i < (total - used) ? 'flower-on' : 'flower-off'}">✿</span>`
  ).join('');
}

/**
 * RÔLE : Met à jour les fleurs de quota dans #journal-flowers (onglet Journal)
 * POURQUOI : Cohérent avec thought-count et bilan-flowers — remplace le compteur texte "X/5 notes"
 *            par des ✿ visuelles qui s'estompent au fil des notes enregistrées dans la journée.
 */
function updJournalFlowers() {
  const jf = document.getElementById('journal-flowers');
  if (!jf) return;
  const todayStr = today(); // fonction app.js — retourne "YYYY-MM-DD"
  const used  = window.D.journal.filter(n => n.date.startsWith(todayStr)).length;
  const total = window.JOURNAL_MAX_PER_DAY || 5;
  jf.innerHTML = Array.from({ length: total }, (_, i) =>
    // Les fleurs restantes (non utilisées) sont allumées, les utilisées s'éteignent
    `<span class="${i < (total - used) ? 'flower-on' : 'flower-off'}">✿</span>`
  ).join('');
}

/**
 * Fonction centrale de mise à jour de l'interface (HUD, jauges, XP, noms).
 * Appelée dès qu'une donnée change dans app.js.
 */
function updUI() {
  const D = window.D;
  if (document.getElementById('petales-l'))
    document.getElementById('petales-l').textContent = `🌸 ${D.g.petales || 0}`;
  const g = D.g, s = getSt(g.totalXp), nt = nxtTh(g.totalXp), pt = s.th;
  
  // Calcul du % pour la barre de progression XP
  const pct = nt > pt ? ((g.totalXp - pt) / (nt - pt)) * 100 : 100;
  
  if (document.getElementById('g-name'))   document.getElementById('g-name').textContent = g.name;
  if (document.getElementById('g-stage'))  document.getElementById('g-stage').textContent = s.l;
  if (document.getElementById('xp-l'))     document.getElementById('xp-l').textContent = nt > pt ? `${g.totalXp - pt}/${nt - pt} XP` : `MAX ✿`;
  if (document.getElementById('xp-b'))     document.getElementById('xp-b').style.width = pct + '%';
  if (document.getElementById('sl-energy'))  { document.getElementById('sl-energy').value = g.energy; document.getElementById('sv-energy').textContent = g.energy; }
  if (document.getElementById('sl-happy'))   { document.getElementById('sl-happy').value = g.happiness; document.getElementById('sv-happy').textContent = g.happiness; }
  // RÔLE : Mettre à jour les valeurs résumées dans la barre compacte du toggle
  if (document.getElementById('sv-energy-compact')) document.getElementById('sv-energy-compact').textContent = g.energy;
  if (document.getElementById('sv-happy-compact'))  document.getElementById('sv-happy-compact').textContent  = g.happiness;
  if (document.getElementById('s-xp'))    document.getElementById('s-xp').textContent = g.totalXp;
  if (document.getElementById('s-str'))   document.getElementById('s-str').textContent = calcStr();
  if (document.getElementById('s-jrn'))   document.getElementById('s-jrn').textContent = D.journal.length;
  if (document.getElementById('name-inp')) document.getElementById('name-inp').value = g.name;
  if (document.getElementById('env-sel'))  document.getElementById('env-sel').value = g.activeEnv || 'parc';
  if (document.getElementById('api-inp'))  document.getElementById('api-inp').value = D.apiKey || '';
  
  const petalesDisplay = document.getElementById('petales-wallet');
  if (petalesDisplay) petalesDisplay.textContent = `🌸 ${D.g.petales || 0}`;
  const petalesBoutique = document.getElementById('petales-wallet-boutique');
  if (petalesBoutique) petalesBoutique.textContent = `${D.g.petales || 0}`;
  
  updThoughtFlowers();
  // RÔLE : Synchroniser les fleurs de quota journal à chaque mise à jour globale de l'UI
  updJournalFlowers();
  // RÔLE : Met à jour le label du bouton avec le nom du Gotchi
  // POURQUOI : Le span #btn-ask-label est la seule source du texte — plus de nœud texte brut dans le HTML
  const btnAskLabel = document.getElementById('btn-ask-label');
  if (btnAskLabel) {
    btnAskLabel.textContent = `Demander une pensée`;
  }
  // RÔLE : Affiche ou masque le badge 🎂 selon la date du jour et la config anniversaire.
  // POURQUOI : Le badge est cliquable pour rouvrir la modale — il reste visible toute la journée.
  //            Si birthday.month est null → jamais affiché.
  const bdgEl = document.getElementById('birthday-badge');
  if (bdgEl) {
    const bday = window.USER_CONFIG?.birthday;
    const now  = new Date();
    const showBd = !!(bday?.month &&
      now.getMonth() + 1 === bday.month &&
      now.getDate()      === bday.day);
    bdgEl.style.display = showBd ? 'inline' : 'none';
    if (showBd) {
      bdgEl.onclick = () => {
        document.getElementById('modal').style.display = 'flex';
        document.getElementById('mbox').innerHTML = `
          <div style="text-align:center;padding:var(--sp-sm)">
            <div style="font-size:40px">🎂</div>
            <p style="font-size:12px;color:var(--text);margin:12px 0;line-height:1.6;white-space:pre-line">${bday.message || 'Joyeux anniversaire 💜'}</p>
            <button class="btn btn-p" onclick="clModal()" style="margin-top:8px;width:100%">Merci 💜</button>
          </div>
        `;
        animEl(document.getElementById('mbox'), 'bounceIn');
      };
    }
  }

  updBadgeBoutique();
}

/**
 * Module d'API : Teste la validité de la clé Anthropic.
 */
async function testApiKey() {
  const statusEl = document.getElementById('api-status');
  if (!statusEl) return;
  
  const key = D.apiKey;
  if (!key) { statusEl.innerHTML = '❌ <span style="color:var(--danger)">Aucune clé saisie</span>'; return; } // était #e57373 hardcodé
  
  statusEl.innerHTML = '⏳ Test en cours...';
  
  try {
    const d = await callClaude({ messages:[{ role:'user', content:'Test de connexion.' }], max_tokens:10 });
    
    if (d.error) {
      statusEl.innerHTML = `❌ <span style="color:var(--danger)">${d.error.message}</span>`; // était #e57373 hardcodé
    } else if (d.content) {
      statusEl.innerHTML = '✅ <span style="color:#81c784">Connecté</span>';
    }
  } catch(e) {
    statusEl.innerHTML = `❌ <span style="color:var(--danger)">${e.message}</span>`; // était #e57373 hardcodé
  }
}

/**
 * Gère l'affichage du point rouge sur le menu si de nouveaux objets sont dispos
 */
function updBadgeBoutique() {
  const badgeHdr = document.getElementById('badge-boutique-hdr');
  const badgeInv = document.getElementById('badge-boutique');
  
  // Boutique header : objet disponible à acheter
  const lib = window.PROPS_LIB || [];
  const petales = window.D.g.petales || 0;
  const aDisponible = lib.some(p => 
    !(window.D.g.props || []).find(inv => inv.id === p.id) && petales >= p.cout
  );
  if (badgeHdr) badgeHdr.style.display = aDisponible ? 'block' : 'none';

  // Inventaire menu : nouvel objet non vu
  const hasNew = (window.D.g.props || []).some(p => !p.seen);
  if (badgeInv) badgeInv.style.display = hasNew ? 'block' : 'none';
}

/* ─── SYSTÈME 4 : MOTEUR DE ROUTINE & HABITUDES ──────────────────── */
function renderHabs() {
  const D = window.D;
  const td = today(), log = D.log[td] || [], done = log.length;

  // --- Page d'accueil : liste des habitudes ---
  const habHome = document.getElementById('hab-home');
  if (habHome) {
    // RÔLE : Identifier la première habitude non-cochée pour la mettre en avant
    // POURQUOI : Offrir un point d'entrée immédiat → réduit le coût décisionnel au démarrage
    const firstUndoneIndex = D.habits.findIndex(h => !log.includes(h.catId));

habHome.innerHTML = D.habits.map((h, i) => {
  const c = CATS.find(c => c.id === h.catId);
  const d = log.includes(h.catId);
  const libelle = (h.label !== c?.label) ? h.label : (c?.def || h.label);
  // Ajoute .hab--next uniquement sur la première habitude non-cochée (si toutes pas finies)
  const isNext = !d && i === firstUndoneIndex && done < D.habits.length;
  return `
    <div class="hab ${d ? 'done' : ''} ${isNext ? 'hab--next' : ''}" style="position:relative">
      <div class="ck" onclick="toggleHab('${h.catId}')">${d ? '✓' : ''}</div>
      <span id="hab-label-${h.catId}" style="flex:1;font-size:12px;cursor:pointer"
        onclick="toggleHab('${h.catId}')">${libelle}</span>
      <span style="font-size:16px">${c.icon}</span>
    </div>`;
}).join('') + `
  <div style="text-align:center;margin-top:12px">
    <button class="btn btn-s" style="font-size:var(--fs-xs);padding:6px 14px;opacity:0.7"
      onclick="ouvrirEditionHabitudes()">✏️ Personnaliser mes habitudes</button>
  </div>`;
  }

  // --- Compteur d'habitudes ---
  const hc = document.getElementById('hab-count');
  if (hc) hc.textContent = `${done}/6`;
}

function editHabInline(catId, i) {
  const span = document.getElementById('hab-label-' + catId);
  if (!span) return;
  const current = span.textContent;
  span.outerHTML = `
    <input id="hab-input-${catId}"
      class="inp" value="${current}"
      style="flex:1;font-size:12px;padding:2px 6px"
      onblur="saveHabInline('${catId}', ${i}, this.value)"
      onkeydown="if(event.key==='Enter') this.blur()">`;
  document.getElementById('hab-input-' + catId)?.focus();
}

function saveHabInline(catId, i, value) {
  const trimmed = value.trim();
  if (trimmed) {
    window.D.habits[i].label = trimmed;
    save();
  }
  renderHabs();
}

/**
 * RÔLE : Déplace une habitude vers le haut ou le bas dans D.habits, puis recharge la modale
 * POURQUOI : Permet de réordonner sans drag-and-drop (plus fiable sur mobile)
 */
function deplacerHab(index, direction) {
  const D = window.D;
  const cible = index + direction; // direction : -1 (monter) ou +1 (descendre)

  // Sécurité : on ne sort pas du tableau
  if (cible < 0 || cible >= D.habits.length) return;

  // Lecture des labels saisis avant de réordonner (pour ne pas perdre les modifications en cours)
  D.habits.forEach((h, i) => {
    const input = document.getElementById('hab-edit-' + h.catId);
    if (input) {
      const trimmed = input.value.trim();
      if (trimmed) D.habits[i].label = trimmed;
    }
  });

  // Échange les deux éléments dans le tableau
  const tmp = D.habits[index];
  D.habits[index] = D.habits[cible];
  D.habits[cible] = tmp;

  // Recharge la modale avec le nouvel ordre (pas de save() encore — l'utilisatrice valide d'abord)
  ouvrirEditionHabitudes();
}

/**
 * RÔLE : Ouvre une modale centralisée pour renommer et réordonner les habitudes
 * POURQUOI : Remplace les crayons individuels — une seule action, moins de bruit visuel
 */
function ouvrirEditionHabitudes() {
  const D = window.D;
  const total = D.habits.length;
  const champs = D.habits.map((h, i) => {
    const c = CATS.find(c => c.id === h.catId);
    const libelle = (h.label !== c?.label) ? h.label : (c?.def || h.label);
    // Désactive ← en première position, → en dernière
    const peutMonter = i > 0;
    const peutDescendre = i < total - 1;
    return `
      <div style="margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span style="font-size:18px;width:24px;text-align:center">${c.icon}</span>
          <input class="inp" id="hab-edit-${h.catId}"
            value="${libelle}"
            style="flex:1;font-size:var(--fs-sm);padding:6px 10px"
            onkeydown="if(event.key==='Enter') document.getElementById('hab-save-btn').click()">
        </div>
        <div style="display:flex;gap:6px;padding-left:32px">
          <button onclick="deplacerHab(${i}, -1)"
            style="flex:1;padding:5px 0;font-size:13px;border:1px solid var(--c-border);
                   border-radius:6px;background:transparent;color:var(--c-txt2);
                   cursor:${peutMonter ? 'pointer' : 'default'};
                   opacity:${peutMonter ? '0.6' : '0.2'}"
            ${peutMonter ? '' : 'disabled'}>↑</button>
          <button onclick="deplacerHab(${i}, 1)"
            style="flex:1;padding:5px 0;font-size:13px;border:1px solid var(--c-border);
                   border-radius:6px;background:transparent;color:var(--c-txt2);
                   cursor:${peutDescendre ? 'pointer' : 'default'};
                   opacity:${peutDescendre ? '0.6' : '0.2'}"
            ${peutDescendre ? '' : 'disabled'}>↓</button>
        </div>
      </div>`;
  }).join('');
  // POURQUOI : openModal() standard — même animation que toutes les autres modales
  openModal(`
    <h3 style="margin-bottom:14px;font-size:var(--fs-md)">✏️ Mes habitudes</h3>
    ${champs}
    <div style="display:flex;gap:8px;margin-top:4px">
      <button class="btn btn-s" onclick="clModal()" style="flex:1">Annuler</button>
      <button id="hab-save-btn" class="btn btn-p" onclick="sauvegarderToutesHabitudes()" style="flex:1">Enregistrer</button>
    </div>
  `);
}

/**
 * RÔLE : Lit tous les champs de la modale d'édition et sauvegarde les labels + l'ordre modifiés
 */
function sauvegarderToutesHabitudes() {
  const D = window.D;
  D.habits.forEach((h, i) => {
    const input = document.getElementById('hab-edit-' + h.catId);
    if (!input) return;
    const trimmed = input.value.trim();
    if (trimmed) D.habits[i].label = trimmed;
  });
  save(); // Sauvegarde l'ordre ET les labels dans D.habits
  clModal();
  renderHabs();
}

/* ─── SYSTÈME 5 : ÉCONOMIE, INVENTAIRE & BOUTIQUE ────────────────── */
let propsFilterActive = 'tous';

/**
 * Dessine un aperçu d'un prop Pixel Art sur un élément Canvas (Boutique/Inventaire)
 */
function renderPropMini(canvas, def) {
  if (!canvas || !def || !def.pixels) return;
  const ctx = canvas.getContext('2d');
  const cols = def.pixels[0].length, rows = def.pixels.length;
  const px = Math.min(Math.floor(54 / Math.max(cols, rows)), 6);
  canvas.width = cols * px; canvas.height = rows * px;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ci = def.pixels[r][c]; if (ci === 0) continue;
      ctx.fillStyle = def.palette[ci];
      ctx.fillRect(c * px, r * px, px, px);
    }
  }
}

// RÔLE : Construit le HTML d'une carte d'objet dans l'inventaire.
// POURQUOI : Factorisé pour être réutilisé dans tous les groupes.
// isNew        : true si l'objet a été acquis il y a moins de 48h
// modeSuppr    : true si le mode suppression est actif (affiche ✕ sur les objets IA)
function _propCard(p, index, def, D, isNew, modeSuppr) {
  const isClaud = !!(D.propsPixels && D.propsPixels[p.id]);
  const badgeId = `mini-${p.id}`;

  // Badge "NEW" — quand présent, remplace le ✦ (redondant : la bordure lilas identifie déjà l'IA)
  // POURQUOI : ✦ + NEW ensemble encombrent le coin ; NEW suffit à signaler le statut
  const newBadge = isNew
    ? `<span style="position:absolute;top:3px;left:4px;font-size:8px;font-weight:bold;
        background:var(--coral,#f07);color:#fff;border-radius:6px;padding:1px 4px;
        letter-spacing:.5px;line-height:1.4">NEW</span>`
    : '';

  // ✦ visible seulement si PAS de badge NEW
  const etoile = (isClaud && !isNew)
    ? `<span style="position:absolute;top:3px;left:4px;font-size:14px;color:var(--lilac);">✦</span>`
    : '';

  // ✕ de suppression — visible uniquement en mode suppression, sur les objets IA uniquement
  // POURQUOI : Seuls les objets IA (propsPixels) peuvent être supprimés définitivement
  const suppressBtn = (isClaud && modeSuppr)
    ? `<span onclick="event.stopPropagation();supprimerObjetIA('${p.id}')"
        style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
        background:rgba(255,255,255,.75);border-radius:var(--r-md);
        font-size:28px;color:#e33;font-weight:bold;cursor:pointer;z-index:2;">✕</span>`
    : '';

  // Long press (500ms) → export JSON pour les objets IA
  // POURQUOI : Pas de bouton dédié sur la carte — le long press est discret et ne pollue pas l'UI
  const longPressAttrs = isClaud
    ? `onmousedown="startLongPress(event,'${p.id}')" onmouseup="cancelLongPress()" onmouseleave="cancelLongPress()"
       ontouchstart="startLongPress(event,'${p.id}')" ontouchend="cancelLongPress()" ontouchcancel="cancelLongPress()"`
    : '';

  return `<div onclick="toggleProp(${index})" ${longPressAttrs} style="
    background:${p.actif ? 'var(--mint)' : '#fff'};
    border:2px solid ${p.actif ? 'var(--mint)' : isClaud ? 'var(--lilac)' : 'var(--border)'};
    border-radius:var(--r-md);padding:6px 4px 8px;font-size:var(--fs-xs);font-weight:bold;
    cursor:pointer;display:flex;flex-direction:column;align-items:center;
    justify-content:space-between;gap:4px;transition:.2s;text-align:center;
    box-shadow:0 2px 4px rgba(0,0,0,.05);position:relative;min-height:90px;
    user-select:none;-webkit-user-select:none;">
    ${newBadge}${etoile}${suppressBtn}
    <div style="flex:1;display:flex;align-items:center;justify-content:center;">
      ${def && def.pixels
        ? `<canvas id="${badgeId}" style="image-rendering:pixelated;border-radius:3px"></canvas>`
        : `<span style="font-size:22px">${p.emoji || '🎁'}</span>`}
    </div>
    <div style="width:100%;">
      <div>${p.nom}</div>
      <div style="font-size:var(--fs-xs);text-transform:uppercase;opacity:.7;font-weight:normal;">${p.type}</div>
    </div>
  </div>`;
}

// RÔLE : Construit une section (bandeau + grille) pour un groupe d'objets.
// POURQUOI : Évite la répétition pour chaque groupe de l'inventaire.
function _propSection(titre, items) {
  if (items.length === 0) return '';
  return `
    <div style="margin-bottom:12px">
      <div style="font-size:var(--fs-xs);font-weight:bold;text-transform:uppercase;
        letter-spacing:1px;color:var(--text2);padding:4px 0 6px;
        border-bottom:1px solid var(--border);margin-bottom:6px">
        ${titre} <span style="font-weight:normal;opacity:.6">(${items.length})</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
        ${items.join('')}
      </div>
    </div>`;
}

// RÔLE : Affiche et met à jour l'onglet inventaire complet.
// POURQUOI : Appelé après chaque action sur les props (activer, ranger, acheter, etc.)
function renderProps() {
  const D       = window.D;
  const allDefs = [...(window.PROPS_LIB || []), ...(window.PROPS_LOCAL || [])];
  const envActif = D.g.activeEnv || 'parc'; // env actuellement affiché dans le switcher
  const now48h   = Date.now() - 48 * 60 * 60 * 1000; // seuil "nouveau" = 48h

  // ── Filtres par catégorie — style distinct des boutons d'action ──
  // POURQUOI : Forme carrée avec coins légèrement arrondis vs boutons d'action pill-shape,
  //            pour distinguer visuellement les deux types de contrôles.
  const cats = [
    { key: 'tous',       label: '✿ Tous' },
    { key: 'decor',      label: '🪑 Décor' },
    { key: 'accessoire', label: '🎀 Accessoires' },
    { key: 'ambiance',   label: '🌈 Ambiances' },
    { key: 'claude',     label: '✨ Créations' },
  ];
  const filterEl = document.getElementById('props-filters');
  if (filterEl) {
    filterEl.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:8px 0';
    filterEl.innerHTML = cats.map(({ key, label }) => {
      const active = propsFilterActive === key;
      return `<button onclick="setPropsFilter('${key}')"
        style="padding:5px 2px;border-radius:999px;
        border:2px solid ${active ? 'var(--lilac)' : 'var(--border)'};
        font:bold 9px 'Courier New',monospace;cursor:pointer;width:100%;
        background:${active ? 'var(--lilac)' : 'rgba(0,0,0,.03)'};
        color:${active ? '#fff' : 'var(--text2)'};
        transition:.15s;">${label}</button>`;
    }).join('');
  }

  // ── Masquer l'ancien conteneur du header (plus utilisé) ──
  const btnTout = document.getElementById('btn-ranger-tout');
  if (btnTout) btnTout.style.display = 'none';

  const listEl = document.getElementById('props-list');
  if (!listEl) return;

  // ── Inventaire vide ───────────────────────────────────────
  if (!D.g.props || D.g.props.length === 0) {
    listEl.innerHTML = '<p style="font-size:var(--fs-sm);color:var(--text2);text-align:center;padding:var(--sp-md)">Ton sac est vide. Reviens plus tard ! ✿</p>';
    return;
  }

  // ── Filtre de catégorie ───────────────────────────────────
  const filtered = D.g.props
    .map((p, index) => ({ p, index, def: allDefs.find(l => l.id === p.id) }))
    .filter(({ p }) => {
      if (propsFilterActive === 'tous')   return true;
      if (propsFilterActive === 'claude') return !!(D.propsPixels && D.propsPixels[p.id]);
      return p.type === propsFilterActive;
    });

  // ── Groupe "actifs dans l'env courant" (seulement cet env) ──
  // POURQUOI : On ne montre que ce qui est actif dans l'environnement actuellement sélectionné
  const sortAlpha  = arr => [...arr].sort((a, b) => a.p.nom.localeCompare(b.p.nom, 'fr'));
  const groupActifs = sortAlpha(filtered.filter(({ p }) => p.actif && (p.env === envActif || !p.env)));

  // ── Groupe "rangés" — récents en tête ────────────────────
  // POURQUOI : Les nouveaux objets (< 48h) remontent pour être visibles sans scroller
  const ranges = filtered.filter(({ p }) => !p.actif);
  const rangesNew   = [...ranges].filter(({ p }) => (p.acquis || 0) > now48h)
                                 .sort((a, b) => (b.p.acquis || 0) - (a.p.acquis || 0));
  const rangesOld   = sortAlpha(ranges.filter(({ p }) => (p.acquis || 0) <= now48h));

  // ── Mode suppression — flag global ───────────────────────
  // POURQUOI : Quand actif, les cartes IA affichent un ✕ de suppression.
  //            Le flag est remis à false à chaque appel de renderProps (hors clic bouton).
  const modeSuppr = !!window._propsModeSuppr;

  // ── Génération des cartes ─────────────────────────────────
  const toCards = (arr, markNew = false) =>
    arr.map(({ p, index, def }) =>
      _propCard(p, index, def, D, markNew && (p.acquis || 0) > now48h, modeSuppr));

  const aDesActifs = groupActifs.length > 0;

  // ── Bandeau de section avec bouton d'action à droite ─────
  // POURQUOI : "Tout ranger" à droite de l'env actif, "Supprimer" à droite de Rangés.
  //            Homogène et contextuel — chaque action est au niveau de sa section.
  const envTitres = { parc: '🌳 Parc', chambre: '🛏️ Chambre', montagne: '⛰️ Montagne' };
  const titreActif = envTitres[envActif] || '✨ Actifs';

  // Style partagé pour les boutons d'action de bandeau (pill-shape, distinct des filtres carrés)
  const btnActionStyle = `border-radius:999px;border:1.5px solid var(--border);
    font:bold 9px 'Courier New',monospace;cursor:pointer;padding:3px 10px;
    background:#fff;color:var(--text2);transition:.15s;white-space:nowrap;`;

  // Bandeau section env actif — avec "Tout ranger" à droite
  const bandeauActif = `
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding:4px 0 6px;border-bottom:1px solid var(--border);margin-bottom:6px">
      <span style="font-size:var(--fs-xs);font-weight:bold;text-transform:uppercase;
        letter-spacing:1px;color:var(--text2)">
        ${titreActif} <span style="font-weight:normal;opacity:.6">(${groupActifs.length})</span>
      </span>
      <button onclick="rangerTout('${envActif}')"
        style="${btnActionStyle}opacity:${aDesActifs ? '1' : '0.35'};
        pointer-events:${aDesActifs ? 'auto' : 'none'};">
        📦 Tout ranger
      </button>
    </div>`;

  // Bandeau section Rangés — avec "Supprimer" à droite (toggle mode suppression)
  const hasIA = ranges.some(({ p }) => !!(D.propsPixels && D.propsPixels[p.id]));
  const bandeauRanges = `
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding:4px 0 6px;border-bottom:1px solid var(--border);margin-bottom:6px">
      <span style="font-size:var(--fs-xs);font-weight:bold;text-transform:uppercase;
        letter-spacing:1px;color:var(--text2)">
        📦 Rangés <span style="font-weight:normal;opacity:.6">(${ranges.length})</span>
      </span>
      <button onclick="toggleModeSuppr()"
        style="${btnActionStyle}${modeSuppr ? 'background:var(--coral,#f55);color:#fff;border-color:var(--coral,#f55);' : ''}
        opacity:${hasIA ? '1' : '0.35'};pointer-events:${hasIA ? 'auto' : 'none'};">
        ${modeSuppr ? '✓ Terminer' : '🗑️ Supprimer'}
      </button>
    </div>`;

  // ── Section active (vide → message indicatif) ─────────────
  const sectionActiveHTML = `
    <div style="margin-bottom:12px">
      ${bandeauActif}
      ${aDesActifs
        ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">${toCards(groupActifs).join('')}</div>`
        : `<p style="font-size:var(--fs-xs);color:var(--text2);text-align:center;padding:10px 0;opacity:.6">
             Aucun objet dans cet univers ✿</p>`}
    </div>`;

  // ── Section Rangés ────────────────────────────────────────
  const cardesRanges = toCards(rangesNew, true).concat(toCards(rangesOld));
  const sectionRangesHTML = `
    <div style="margin-bottom:12px">
      ${bandeauRanges}
      ${cardesRanges.length
        ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">${cardesRanges.join('')}</div>`
        : `<p style="font-size:var(--fs-xs);color:var(--text2);text-align:center;padding:10px 0;opacity:.6">
             Rien ici pour l'instant ✿</p>`}
    </div>`;

  listEl.innerHTML = sectionActiveHTML + sectionRangesHTML;

  // ── Dessiner les mini-sprites pixel art ──────────────────
  filtered.forEach(({ p, def }) => {
    if (def && def.pixels) renderPropMini(document.getElementById(`mini-${p.id}`), def);
  });

  const wallet = document.getElementById('xp-wallet');
  if (wallet) wallet.textContent = `💜 ${D.g.totalXp} XP disponibles`;
}

function ouvrirBoutique() {
  const onglet = window._boutiqueOnglet || 'catalogue';
  document.getElementById('modal').style.display = 'flex';
  lockScroll();
  document.getElementById('mbox').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <h3 style="font-size:13px;color:var(--lilac);">🛍️ Boutique</h3>
<button onclick="clModal()" style="background:none;border:none;font-size:16px;cursor:pointer;color:var(--text2)">✕</button>    </div>

    <div style="text-align:center;margin-bottom:16px">
      <p style="font-size:var(--fs-sm);color:var(--text2);text-align:center">
  🌸 <b style="font-size:var(--fs-lg);color:var(--lilac)">${D.g.petales || 0}</b> pétales disponibles
</p>
    </div>

    <div style="display:flex;gap:6px;margin-bottom:14px;background:rgba(0,0,0,0.05);border-radius:20px;padding:3px;margin-right:2px">
      <button onclick="switchBoutiqueOnglet('catalogue')"
        style="flex:1;padding:7px;border-radius:var(--r-xl);border:none;font-size:var(--fs-xs);cursor:pointer;font-weight:bold;font-family:'Courier New',monospace;
        background:${onglet==='catalogue'?'#fff':'transparent'};
        color:${onglet==='catalogue'?'var(--lilac)':'var(--text2)'};
        box-shadow:${onglet==='catalogue'?'0 1px 4px rgba(0,0,0,.1)':'none'};
        transition:.15s">
        🌸 Catalogue
      </button>
      <button onclick="switchBoutiqueOnglet('claude')"
        style="flex:1;padding:7px;border-radius:var(--r-xl);border:none;font-size:var(--fs-xs);cursor:pointer;font-weight:bold;font-family:'Courier New',monospace;
        background:${onglet==='claude'?'#fff':'transparent'};
        color:${onglet==='claude'?'var(--lilac)':'var(--text2)'};
        box-shadow:${onglet==='claude'?'0 1px 4px rgba(0,0,0,.1)':'none'};
        transition:.15s">
        ✨ Créations
      </button>
    </div>

    <div id="boutique-contenu"></div>
  `;
  animEl(document.getElementById('mbox'), 'bounceIn');

  const mbox = document.getElementById('mbox');
  mbox.classList.remove('shop-open');
  void mbox.offsetWidth;
  mbox.classList.add('shop-open');
  if (onglet === 'catalogue') {
  mbox.classList.add('shop-catalogue');
  } else {
  mbox.classList.remove('shop-catalogue');
  }
  renderBoutiqueOnglet(onglet);
}

function switchBoutiqueOnglet(onglet) {
  window._boutiqueOnglet = onglet;
  ouvrirBoutique();
}

function renderBoutiqueOnglet(onglet) {
  const el = document.getElementById('boutique-contenu');
  if (!el) return;

  if (onglet === 'catalogue') {
    const lib = window.PROPS_LIB || [];
    const libFiltree = lib.filter(prop => !(D.g.props || []).find(p => p.id === prop.id))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

    el.innerHTML = libFiltree.map(prop => {
      const peutAcheter = (D.g.petales || 0) >= prop.cout;
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--sp-sm) 12px 8px 10px;border:2px solid var(--border);border-radius:var(--r-md);margin-bottom:6px;background:#fff">
          <span style="font-size:18px">${prop.emoji}</span>
          <span style="font-size:var(--fs-sm);font-weight:bold;flex:1;margin:0 8px">${escape(prop.nom)}</span>
          <button onclick="acheterProp('${prop.id}')"
            style="padding:5px 12px;border-radius:20px;border:none;font-size:var(--fs-xs);font-weight:bold;font-family:'Courier New',monospace;
            cursor:${peutAcheter?'pointer':'not-allowed'};
            background:${peutAcheter?'linear-gradient(135deg,var(--lilac),var(--pink))':'#ddd'};
            color:${peutAcheter?'#fff':'#aaa'};
            border-bottom:${peutAcheter?'2px solid rgba(0,0,0,0.15)':'2px solid transparent'}">
            ${prop.cout === 0 ? 'Prendre 🎁' : `🌸 ${prop.cout}`}
          </button>
        </div>`;
    }).join('');

  } else {
// Onglet IA
    const peutGenerer = (D.g.petales || 0) >= 10;
    const derniersProps = Object.values(window.D.propsPixels || {});
    const dernierObj = derniersProps.length ? derniersProps[derniersProps.length - 1] : null; 

    el.innerHTML = `
      <p style="font-size:var(--fs-sm);color:var(--text2);text-align:center;margin-bottom:16px;line-height:1.6">
        ${escape(window.D.g.name)} invente un objet unique<br>rien que pour toi ✨
      </p>
      <div style="text-align:center">
        <button onclick="acheterPropClaude()"
          style="padding:var(--sp-md) 28px;border-radius:999px;border:none;font-size:var(--fs-sm);font-weight:bold;font-family:'Courier New',monospace;
          cursor:${peutGenerer?'pointer':'not-allowed'};
          background:${peutGenerer?'linear-gradient(135deg,var(--lilac),var(--pink))':'#ddd'};
          color:${peutGenerer?'#fff':'#aaa'};
          border-bottom:${peutGenerer?'3px solid rgba(0,0,0,0.15)':'3px solid transparent'};
          letter-spacing:.5px">
          ${peutGenerer ? `✨ Demander à ${escape(window.D.g.name)} — 🌸 10` : '🌸 Il te faut 10 pétales'}
        </button>
      </div>
      ${dernierObj ? `
  <div style="margin-top:20px;text-align:center;border-top:1px solid var(--border);padding-top:16px">
    <div style="font-size:var(--fs-xs);color:var(--text2);margin-bottom:var(--sp-sm);text-transform:uppercase;letter-spacing:1px">dernière création</div>
    <canvas id="apercu-dernier-prop" style="image-rendering:pixelated;border-radius:6px;border:2px solid var(--border)"></canvas>
    <div style="font-size:var(--fs-sm);font-weight:bold;margin-top:6px">${dernierObj.emoji} ${dernierObj.nom}</div>
    <div style="font-size:var(--fs-xs);color:var(--text2);text-transform:uppercase;margin-top:2px">${dernierObj.type}</div>
  </div>` : `
  <div style="margin-top:20px;text-align:center;border-top:1px solid var(--border);padding-top:16px;opacity:.5">
    <div style="font-size:28px;margin-bottom:6px">🌱</div>
    <div style="font-size:var(--fs-xs);color:var(--text2);line-height:1.6">Pas encore de création...<br>demande à ${escape(window.D.g.name)} d'inventer quelque chose ✨</div>
  </div>`}
    `;

  if (dernierObj) {
  const canvas = document.getElementById('apercu-dernier-prop');
  if (canvas && dernierObj.pixels) {
    const ctx = canvas.getContext('2d');
    const cols = dernierObj.pixels[0].length;
    const rows = dernierObj.pixels.length;
    const px = Math.min(Math.floor(96 / Math.max(cols, rows)), 10); // ← 54→96, 6→10
    canvas.width  = cols * px;
    canvas.height = rows * px;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ci = dernierObj.pixels[r][c];
        if (ci === 0) continue;
        ctx.fillStyle = dernierObj.palette[ci];
        ctx.fillRect(c * px, r * px, px, px);
      }
    }
    canvas.style.width  = canvas.width  + 'px';
    canvas.style.height = canvas.height + 'px';
  }
}
  }
}

function acheterProp(propId) {
  const prop = (window.PROPS_LIB || []).find(p => p.id === propId);
  if (!prop) return;
  if ((D.g.petales || 0) < prop.cout) { toast(`Pas assez de pétales 🌸`); return; }
  
  D.g.petales = (D.g.petales || 0) - prop.cout;
  if (!D.g.props) D.g.props = [];
  D.g.props.push({ id: prop.id, nom: prop.nom, type: prop.type, emoji: prop.emoji, actif: false, pxSize: prop.pxSize || null, seen: false, acquis: Date.now() });
addEvent({
  type: 'cadeau',
  subtype: 'achat',
  valeur: prop.cout,
  emoji: prop.emoji || '🛍️',
  label: `${prop.nom}  débloqué`
});
  save();
  toast(`${prop.emoji || '🛍️'} ${prop.nom} ajouté à ton inventaire !`);
  const buyMsgs = [`${prop.emoji} Pour moi ?! 💜`, `*yeux brillants* ✨`, `${prop.emoji} J'adore ! 🌸`, `*saute de joie* ✿`, `${prop.emoji} Trop beau ! ✿`];
  flashBubble(buyMsgs[Math.floor(Math.random() * buyMsgs.length)], 2500);
  renderProps();
  updUI();
  updBadgeBoutique();
  ouvrirBoutique();
}
function setPropsFilter(cat) { propsFilterActive = cat; renderProps(); }

// RÔLE : Gère le clic sur un objet dans l'inventaire.
// POURQUOI : Point d'entrée unique pour activer, désactiver ou reconfigurer un objet.
//            L'environnement est automatiquement celui du switcher — plus de choix à faire.
function toggleProp(index) {
  const prop    = window.D.g.props[index];
  const envActif = window.D.g.activeEnv || 'parc'; // env du switcher = env cible

  // --- Désactiver / modifier si déjà actif ---
  if (prop.actif) {
    if (prop.type === 'decor') {
      // Décor actif → modale de repositionnement (slot + ranger, env déjà fixé)
      openSlotPickerAvecRangement(index);
    } else {
      // Accessoire ou ambiance → ranger directement (un clic = on range)
      prop.actif = false;
      prop.slot  = null;
      prop.env   = null;
      save();
      renderProps();
      toast(`📦 ${prop.nom} rangé`);
      flashBubble(`*au revoir ${prop.nom}* 👋`, 2500);
    }
    return;
  }

  // --- Pas encore actif → activer dans l'env du switcher, sans modale ─────
  if (prop.type === 'decor') {
    // Les décors ont besoin d'un slot → modale de slot uniquement (env déjà connu)
    openSlotPicker(index);
  } else {
    // Accessoires et ambiances : activation directe dans l'env actif
    confirmEnvDirect(index, envActif);
  }
}

// RÔLE : Modale pour modifier l'env d'un accessoire/ambiance déjà actif, ou le ranger.
// POURQUOI : Les non-décors n'ont pas de slot, donc pas besoin de l'étape 2 slots.
function supprimerObjetIA(propId) {
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `
    <p style="text-align:center;font-size:12px;margin-bottom:var(--sp-md)">Supprimer cet objet définitivement ?</p>
    <button class="btn btn-d" onclick="confirmerSuppressionIA('${propId}')" style="width:100%;margin-bottom:6px;font-size:var(--fs-sm)">🗑️ Supprimer</button>
    <button class="btn btn-s" onclick="clModal()" style="width:100%;font-size:var(--fs-sm)">Annuler</button>
  `;
  animEl(document.getElementById('mbox'), 'bounceIn');
}

function confirmerSuppressionIA(propId) {
  D.g.props = D.g.props.filter(p => p.id !== propId);
  if (D.propsPixels) delete D.propsPixels[propId];
  save();
  clModal();
  renderProps();
  toast(`🗑️ Objet supprimé`);
}

// RÔLE : Affiche le JSON d'un objet IA formaté pour props.json, prêt à copier-coller.
// POURQUOI : Permet d'exporter un objet généré par l'IA vers le catalogue permanent,
//            ou de l'envoyer à quelqu'un d'autre pour qu'iel l'intègre dans son catalogue.
function exportObjetIA(propId) {
  const src = (window.D.propsPixels || {})[propId];
  const inv = (window.D.g.props || []).find(p => p.id === propId);
  if (!src) { toast('Objet introuvable 🤔'); return; }

  // RÔLE : Construire le JSON au format exact du catalogue props.json
  // POURQUOI : Prêt à coller dans "catalogue": [...] sans aucune retouche (sauf cout et categorie)
  const entry = {
    id:       src.id      || propId,
    nom:      src.nom     || inv?.nom || '?',
    type:     src.type    || inv?.type || 'decor',
    emoji:    src.emoji   || inv?.emoji || '🎁',
    categorie: src.type === 'accessoire' ? (src.ancrage || 'tete') : 'ia',
    cout:     0,
    ...(src.ancrage ? { ancrage: src.ancrage } : {}),
    ...(src.slot    ? { slot:    src.slot    } : {}),
    ...(src.motion  ? { motion:  src.motion  } : {}),
    pxSize:   src.pxSize  || 3,
    palette:  src.palette || [],
    pixels:   src.pixels  || [],
  };

  const json = JSON.stringify(entry, null, 2);

  document.getElementById('modal').style.display = 'flex';
  lockScroll();
  document.getElementById('mbox').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <h3 style="font-size:13px;color:var(--lilac);margin:0">✦ ${escapeHtml(entry.nom)}</h3>
      <button onclick="clModal()" style="background:none;border:none;font-size:16px;cursor:pointer;color:var(--text2)">✕</button>
    </div>
    <p style="font-size:var(--fs-xs);color:var(--text2);margin-bottom:10px;line-height:1.6">
      Copie ce code et envoie-le — l'autre personne pourra l'ajouter à son jeu pour avoir cet objet dans son inventaire aussi 🌸
    </p>
    <pre id="export-json" style="
      font-size:9px;line-height:1.5;background:rgba(0,0,0,.04);
      border:1px solid var(--border);border-radius:var(--r-sm);
      padding:8px;overflow-x:auto;white-space:pre;
      max-height:200px;overflow-y:auto;
      font-family:'Courier New',monospace;
      user-select:all;cursor:text;">${escapeHtml(json)}</pre>
    <button onclick="copierExportIA()" class="btn btn-p"
      style="width:100%;margin-top:10px;font-size:var(--fs-sm)" id="btn-copier-export">
      📋 Copier le code
    </button>
  `;
  animEl(document.getElementById('mbox'), 'bounceIn');

  // Stocker le JSON à copier dans une variable accessible depuis le bouton
  window._exportJsonToCopy = json;
}

// RÔLE : Copie le JSON exporté dans le presse-papier et confirme visuellement.
function copierExportIA() {
  const json = window._exportJsonToCopy;
  if (!json) return;
  navigator.clipboard.writeText(json).then(() => {
    const btn = document.getElementById('btn-copier-export');
    if (btn) { btn.textContent = '✓ Copié !'; btn.style.background = 'var(--mint)'; }
    setTimeout(() => {
      if (btn) { btn.textContent = '📋 Copier le JSON'; btn.style.background = ''; }
    }, 2000);
  }).catch(() => {
    // Fallback si clipboard API non disponible (contexte non sécurisé)
    toast('Sélectionne le texte manuellement et copie-le ✿');
  });
}

// RÔLE : Échappe les caractères HTML dans une chaîne pour affichage sécurisé dans innerHTML.
// POURQUOI : Le JSON peut contenir des < > & qui casseraient le rendu HTML.
function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── Long press & mode suppression ───────────────────────────────────────────

// RÔLE : Démarre un timer de 500ms pour déclencher l'export d'un objet IA via appui long.
// POURQUOI : Évite d'encombrer les cartes avec un bouton export — le geste est naturel sur mobile.
let _longPressTimer = null;
function startLongPress(event, propId) {
  // Annuler tout timer précédent (sécurité si deux events se chevauchent)
  cancelLongPress();
  _longPressTimer = setTimeout(() => {
    _longPressTimer = null;
    exportObjetIA(propId);
  }, 500); // 500ms = durée standard d'un appui long
}

// RÔLE : Annule le timer d'appui long si le doigt/curseur est relâché ou quitte la carte.
// POURQUOI : Empêche l'export de se déclencher sur un simple tap ou un glissement.
function cancelLongPress() {
  if (_longPressTimer !== null) {
    clearTimeout(_longPressTimer);
    _longPressTimer = null;
  }
}

// RÔLE : Bascule le mode suppression (affiche/masque les ✕ sur les objets IA rangés).
// POURQUOI : Permet de supprimer des objets IA sans risquer de supprimer accidentellement
//            depuis une interface permanente — le mode doit être activé explicitement.
function toggleModeSuppr() {
  window._propsModeSuppr = !window._propsModeSuppr;
  renderProps(); // Rafraîchit l'affichage pour montrer/masquer les ✕
}

// ─────────────────────────────────────────────────────────────────────────────

// RÔLE : Génère un bouton de slot (position dans l'environnement).
// POURQUOI : Réutilisé dans openSlotPickerAvecEnv.
// envChoisi : transmis pour que confirmSlot sache dans quel env on place.
function makeSlotBtn(propIndex, slotId, label, arrow, occupied, currentSlot, envChoisi) {
  const taken     = occupied[slotId];
  const isCurrent = currentSlot === slotId;
  // On stocke envChoisi dans _pendingPropEnv via le onclick (confirmSlot le lira)
  const onclick   = envChoisi
    ? `window._pendingPropEnv='${envChoisi}';confirmSlot(${propIndex},'${slotId}')`
    : `confirmSlot(${propIndex},'${slotId}')`;
  return `<div onclick="${onclick}" style="
    border:2px solid ${isCurrent ? 'var(--lilac)' : 'var(--border)'};
    border-radius:var(--r-sm); padding:var(--sp-sm) 4px;
    cursor:pointer; text-align:center; font-size:var(--fs-sm); font-weight:bold;
    background:${isCurrent ? 'rgba(176,144,208,.15)' : taken ? '#fff8f0' : '#fff'};
    transition:.15s;"
    onmouseover="this.style.borderColor='var(--mint)'"
    onmouseout="this.style.borderColor='${isCurrent ? 'var(--lilac)' : 'var(--border)'}'">
    <div style="font-size:14px">${arrow}</div>
    <div>${label}</div>
    ${isCurrent ? `<div style="font-size:var(--fs-xs);color:var(--lilac);font-weight:bold">● ici</div>` : ''}
    ${taken && !isCurrent ? `<div style="font-size:var(--fs-xs);color:var(--coral)">⚠ ${taken}</div>` : ''}
  </div>`;
}

/**
 * Modale de placement d'un décor — slot seulement, env = activeEnv (pas de choix).
 * RÔLE : Ouvre directement le choix de slot dans l'env actif du switcher.
 * POURQUOI : L'env est déjà connu via le switcher — inutile de le redemander.
 */
function openSlotPicker(propIndex) {
  // L'env cible = l'env actuellement sélectionné dans le switcher de l'inventaire
  const envChoisi = window.D.g.activeEnv || 'parc';
  openSlotPickerAvecEnv(propIndex, envChoisi, false);
}

/**
 * Modale de sélection du slot pour un décor dans un environnement donné.
 * RÔLE : Affiche les 5 slots de position dans l'env envChoisi.
 * avecRangement : true si on est en train de modifier un décor déjà placé (affiche bouton Ranger).
 */
function openSlotPickerAvecEnv(propIndex, envChoisi, avecRangement) {
  const prop = window.D.g.props[propIndex];

  // Qui occupe quoi dans CET environnement ?
  const occupied = {};
  window.D.g.props.forEach(p => {
    if (p.actif && p.slot && p.env === envChoisi) occupied[p.slot] = p.nom;
  });

  const envLabel = { parc: '🌳 Parc', chambre: '🛏️ Chambre', montagne: '⛰️ Montagne' };

  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <button onclick="${avecRangement ? `openSlotPickerAvecRangement(${propIndex})` : `openSlotPicker(${propIndex})`}"
        style="background:none;border:none;font-size:16px;cursor:pointer;color:var(--text2);padding:0">←</button>
      <h3 style="font-size:13px;color:var(--lilac);margin:0">
        📍 Emplacement — ${envLabel[envChoisi] || envChoisi}
      </h3>
    </div>
    <p style="font-size:var(--fs-xs);opacity:.5;margin-bottom:8px">
      ${prop.emoji || '🎁'} ${escape(prop.nom)}
    </p>

    <div style="font-size:var(--fs-xs);opacity:.5;margin-bottom:4px;text-transform:uppercase">Fond</div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:var(--sp-sm)">
      ${makeSlotBtn(propIndex, 'A', 'Gauche', '↖', occupied, avecRangement ? prop.slot : null, envChoisi)}
      ${makeSlotBtn(propIndex, 'B', 'Droite', '↗', occupied, avecRangement ? prop.slot : null, envChoisi)}
    </div>

    <div style="font-size:var(--fs-xs);opacity:.5;margin-bottom:4px;text-transform:uppercase">Devant</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px">
      ${makeSlotBtn(propIndex, 'C',   'Gauche', '↙', occupied, avecRangement ? prop.slot : null, envChoisi)}
      ${makeSlotBtn(propIndex, 'SOL', 'Centre', '⬇', occupied, avecRangement ? prop.slot : null, envChoisi)}
      ${makeSlotBtn(propIndex, 'D',   'Droite', '↘', occupied, avecRangement ? prop.slot : null, envChoisi)}
    </div>

    ${avecRangement ? `
      <button class="btn btn-d" onclick="rangerProp(${propIndex})"
        style="width:100%;font-size:var(--fs-sm);margin-bottom:6px">📦 Ranger</button>
    ` : ''}
    <button class="btn btn-s" onclick="clModal()" style="width:100%;font-size:var(--fs-sm)">Annuler</button>
  `;
  animEl(document.getElementById('mbox'), 'bounceIn');

  // Stocker l'env choisi temporairement pour que confirmSlot puisse le lire
  window._pendingPropEnv = envChoisi;
}

// RÔLE : Confirme la position d'un décor dans un slot ET un environnement.
// POURQUOI : Remplace l'ancienne confirmSlot qui ne gérait pas l'env.
function confirmSlot(propIndex, slotId) {
  const prop     = window.D.g.props[propIndex];
  const envCible = window._pendingPropEnv || prop.env || window.D.g.activeEnv || 'parc';

  // Désactiver tout occupant actuel de ce slot dans le même environnement
  window.D.g.props.forEach(p => {
    if (p.actif && p.slot === slotId && p.env === envCible && p !== prop) {
      p.actif = false;
      p.slot  = null;
      p.env   = null;
      toast(`↩ ${p.nom} déplacé`);
    }
  });

  prop.actif = true;
  prop.slot  = slotId;
  prop.env   = envCible;
  window._pendingPropEnv = null; // nettoyer le temporaire
  save();
  clModal();
  renderProps();
  toast(`✨ ${prop.nom} placé !`);
  flashBubble(`Oh ! ${prop.nom} ! J'adore ! 💜`, 2500);
  const gx = window._gotchiX || 100;
  const gy = window._gotchiY || 100;
  for (let i = 0; i < 15; i++) {
    window.spawnP?.(gx + (Math.random() - 0.5) * 40, gy - 10,
      ['#c8a0e8','#f0c0d8','#fff8b0','#88c8f0','#b0e8b0'][Math.floor(Math.random()*5)]);
  }
  window.triggerGotchiBounce?.();
}

// RÔLE : Active directement un objet non-décor dans un environnement donné.
// POURQUOI : Les accessoires et ambiances n'ont pas de slot — juste un env.
function confirmEnvDirect(propIndex, envChoisi) {
  const prop = window.D.g.props[propIndex];
  const def  = window.PROPS_LIB?.find(p => p.id === prop.id);

  // Désactiver les concurrents (même ancrage ou même motion) dans le même env
  if (prop.type === 'ambiance') {
    const motion = def?.motion || 'drift';
    window.D.g.props.forEach(p => {
      if (p !== prop && p.actif && p.type === 'ambiance' && p.env === envChoisi) {
        const pDef = window.PROPS_LIB?.find(l => l.id === p.id);
        if ((pDef?.motion || 'drift') === motion) { p.actif = false; p.env = null; toast(`↩ ${p.nom} remplacé`); }
      }
    });
  }
  if (prop.type === 'accessoire') {
    const ancrage = def?.ancrage || 'top';
    window.D.g.props.forEach(p => {
      if (p !== prop && p.actif && p.type === 'accessoire' && p.env === envChoisi) {
        const pDef = window.PROPS_LIB?.find(l => l.id === p.id);
        if ((pDef?.ancrage || 'top') === ancrage) { p.actif = false; p.env = null; toast(`↩ ${p.nom} remplacé`); }
      }
    });
  }

  prop.actif = true;
  prop.env   = envChoisi;
  save();
  clModal();
  renderProps();
  toast(`✨ ${prop.nom} activé !`);
  flashBubble(`Oh ! ${prop.nom} ! J'adore ! 💜`, 2500);
  const gx = window._gotchiX || 100;
  const gy = window._gotchiY || 100;
  for (let i = 0; i < 15; i++) {
    window.spawnP?.(gx + (Math.random() - 0.5) * 40, gy - 10,
      ['#c8a0e8','#f0c0d8','#fff8b0','#88c8f0','#b0e8b0'][Math.floor(Math.random()*5)]);
  }
  window.triggerGotchiBounce?.();
}

/**
 * Modale de modification — décor déjà actif, repositionner dans le même env ou ranger.
 * RÔLE : Ouvre directement les slots de l'env actif de la prop (pas de choix d'env).
 * POURQUOI : Un décor actif est dans un env fixé — on repositionne dans ce même env.
 *            Pour le déplacer vers un autre env, il faut d'abord le ranger puis le replacer.
 */
function openSlotPickerAvecRangement(propIndex) {
  // Ouvre la modale de slots directement dans l'env de la prop (avec bouton Ranger)
  openSlotPickerAvecEnv(propIndex, window.D.g.props[propIndex].env || window.D.g.activeEnv || 'parc', true);
}

// RÔLE : Range un objet (désactive + efface env et slot).
function rangerProp(propIndex) {
  const prop = window.D.g.props[propIndex];
  prop.actif = false;
  prop.slot  = null;
  prop.env   = null;
  save();
  clModal();
  renderProps();
  toast(`📦 ${prop.nom} rangé`);
}

// RÔLE : Range tous les objets actifs d'un environnement donné (ou tous si env = 'all').
// POURQUOI : Le bouton "Tout ranger" ne range que l'env actuellement sélectionné dans le switcher.
function rangerTout(env = 'all') {
  const envLabel = { parc: 'du Parc', chambre: 'de la Chambre', montagne: 'de la Montagne', all: '' };
  const label = envLabel[env] || '';
  if (!confirm(`📦 Ranger tous les objets actifs ${label} ?`.trim())) return;
  const D = window.D;
  let count = 0;
  D.g.props.forEach(p => {
    if (!p.actif) return;
    // Filtre par env : si env = 'all' on range tout, sinon seulement l'env ciblé
    // Rétrocompat : un objet sans .env est traité comme 'parc'
    const propEnv = p.env || 'parc';
    if (env === 'all' || propEnv === env) {
      p.actif = false;
      p.slot  = null;
      p.env   = null;
      count++;
    }
  });
  if (count === 0) {
    toast('Rien à ranger 😴');
    return;
  }
  save();
  renderProps();
  flashBubble(`*soupir de soulagement* Merci ! 🧹`, 2500);
  toast(`📦 ${count} objet${count > 1 ? 's' : ''} rangé${count > 1 ? 's' : ''}`);
}
window.rangerTout = rangerTout;

// ── SWITCHER D'ENV DEPUIS L'INVENTAIRE ────────────────────────────────

// RÔLE : Change l'environnement du tama depuis l'onglet inventaire (preview en direct).
// POURQUOI : Permet de visualiser les objets placés dans chaque univers sans quitter l'inventaire.
//            Le changement est temporaire — quand on quitte l'onglet, la logique
//            heure/onglet reprend (voir navTo dans ui.js).
function invSetEnv(env) {
  window.D.g.activeEnv = env;
  window._invEnvForced = true; // flag : on est en mode preview inventaire
  save();
  _updInvEnvSwitcher(); // met à jour les boutons du switcher
  renderProps();         // recharge la liste pour afficher les objets du bon env
}
window.invSetEnv = invSetEnv;

// RÔLE : Met à jour l'apparence visuelle des 3 boutons du switcher.
// POURQUOI : Surligne l'environnement actuellement actif.
function _updInvEnvSwitcher() {
  const activeEnv = window.D.g.activeEnv || 'parc';
  ['parc', 'chambre', 'montagne'].forEach(env => {
    const btn = document.getElementById(`inv-env-${env}`);
    if (!btn) return;
    const isActive = activeEnv === env;
    btn.style.background    = isActive ? '#fff' : 'transparent';
    btn.style.color          = isActive ? 'var(--lilac)' : 'var(--text2)';
    btn.style.boxShadow      = isActive ? '0 1px 4px rgba(0,0,0,.1)' : 'none';
  });
}
window._updInvEnvSwitcher = _updInvEnvSwitcher;

/* ─── SYSTÈME 7 : INGÉNIERIE (Salle des Machines / Debug) ────────── */
 function debugProps() {
  const D = window.D, lib = window.PROPS_LIB || [];
  const actifs = (D.g.props || []).filter(p => p.actif);
  const g = D.g;
  const s = getSt(g.totalXp);

  // Habits cochés aujourd'hui
  const today = new Date().toISOString().slice(0, 10);
  const habitsCochés = D.habits.filter(h => (D.log[today] || []).includes(h.catId)).length;

  // Taille localStorage
  const lsSize = new Blob([JSON.stringify(localStorage)]).size;
  const lsKo = (lsSize / 1024).toFixed(1);

  let r = '';
  r += `👾 ${g.name} — ${s.l} (${g.totalXp} XP)\n`;
  r += `⚡ Énergie: ${g.energy}/5 · 💜 Bonheur: ${g.happiness}/5\n`;
  r += `🌸 Pétales: ${g.petales || 0}\n`;
  r += `🌍 Thème: ${g.envTheme || 'pastel'}\n\n`;

  r += `📋 Habitudes\n`;
  r += `${D.habits.length} configurées · ${habitsCochés} cochées aujourd'hui\n\n`;

  r += `🎒 Objets\n`;
  r += `Catalogue: ${lib.length} · Inventaire: ${(D.g.props||[]).length} (${actifs.length} actifs)\n`;
  r += `Objets IA: ${Object.keys(D.propsPixels || {}).length}\n\n`;

  r += `📓 Journal\n`;
  const nbBulles = Array.isArray(g.customBubbles)
  ? g.customBubbles.length
  : Object.values(g.customBubbles || {}).reduce((acc, arr) => acc + arr.length, 0);
r += `${(D.journal||[]).length} entrées · ${nbBulles} bulles perso\n\n`;

  r += `📁 Fichiers data\n`;
  r += (lib.length > 0 ? '✅' : '❌') + ' props.json\n';
  r += (window.PERSONALITY ? '✅' : '❌') + ' personality.json\n';
  r += (window.AI_CONTEXTS ? '✅' : '❌') + ' ai_contexts.json\n';
  r += (window.AI_SYSTEM ? '✅' : '❌') + ' ai_system.json\n\n';

    r += `🗺️ Météo\n`;
  const meteo = window.meteoData || D.meteo;
r += `🌡️ ${meteo ? `${meteo.temperature}°C · vent ${meteo.windspeed} km/h` : 'aucune donnée'}\n\n`;

  r += `💩 Crottes ramassées aujourd'hui: ${g.poopCount || 0}/10\n\n`;

  r += `💾 LocalStorage: ${lsKo} Ko`;

  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <h3 style="font-size:13px;color:var(--lilac);">🔍 État système</h3>
      <button onclick="clModal()" style="background:none;border:none;font-size:16px;cursor:pointer">✕</button>
    </div>
    <pre id="debug-contenu" style="font-size:var(--fs-sm);line-height:1.6;white-space:pre-wrap;color:var(--text2);margin:0 0 10px 0">${r}</pre>
    <button onclick="navigator.clipboard.writeText(document.getElementById('debug-contenu').textContent).then(()=>toast('Copié ✓'))"
      style="width:100%;padding:var(--sp-sm);border-radius:var(--r-md);border:2px solid var(--border);font-size:var(--fs-sm);cursor:pointer;background:transparent;color:var(--text2);margin-bottom:6px">
      📋 Copier
    </button>
    <button onclick="clModal();setTimeout(voirBulles,150)"
  style="width:100%;padding:var(--sp-sm);border-radius:var(--r-md);border:2px solid var(--border);font-size:var(--fs-sm);cursor:pointer;background:transparent;color:var(--text2);margin-bottom:6px">
  💬 Voir les bulles perso
</button>
    <button onclick="viderJournal()"
      style="width:100%;padding:var(--sp-sm);border-radius:var(--r-md);border:none;font-size:var(--fs-sm);cursor:pointer;background:transparent;color:var(--danger);border:2px solid var(--danger);margin-bottom:6px"> <!-- #e57373 → var(--danger), font-size → var(--fs-sm) -->
      🗑️ Vider le journal
    </button>
    <button onclick="viderObjetsIA()"
      style="width:100%;padding:var(--sp-sm);border-radius:var(--r-md);border:none;font-size:var(--fs-sm);cursor:pointer;background:transparent;color:var(--danger);border:2px solid var(--danger)"> <!-- #e57373 → var(--danger), font-size → var(--fs-sm) -->
      🗑️ Vider les objets IA
    </button>
  `;
  animEl(document.getElementById('mbox'), 'bounceIn');
}

function voirBulles() {
  const cb = window.D.g.customBubbles || {};
  const etats = Object.keys(cb);
  
  if (!etats.length) {
    toast('Aucune bulle personnalisée pour l\'instant ✿');
    return;
  }

const contenu = cb.map((p, i) => `  ${i + 1}. ${p}`).join('\n');

  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <h3 style="font-size:13px;color:var(--lilac);">💬 Bulles personnalisées</h3>
      <button onclick="clModal()" style="background:none;border:none;font-size:16px;cursor:pointer">✕</button>
    </div>
    <pre style="font-size:var(--fs-sm);line-height:1.8;white-space:pre-wrap;color:var(--text2);margin:0 0 10px;max-height:60vh;overflow-y:auto">${contenu}</pre>
    <button onclick="clModal()" class="btn btn-s" style="width:100%;font-size:var(--fs-sm)">Fermer</button>
  `;
  animEl(document.getElementById('mbox'), 'bounceIn');
}

function cleanProps() {
  const orphelins = window.D.g.props.filter(p => {
    return !(window.PROPS_LIB || []).find(l => l.id === p.id) 
        && (window.D.propsPixels || {})[p.id] === undefined;
  });

  if (!orphelins.length) {
    toast(`Aucun prop orphelin trouvé ✿`);
    return;
  }

  const liste = orphelins.map(p => `• ${p.emoji || '?'} ${p.nom}`).join('<br>');
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `
    <h3>Props orphelins (${orphelins.length})</h3>
    <p style="font-size:var(--fs-sm);color:var(--text2);margin:6px 0">Ces props n'ont plus de données associées :</p>
    <div style="font-size:var(--fs-sm);margin:8px 0;line-height:1.8">${liste}</div>
    <div style="display:flex;gap:6px;margin-top:10px">
      <button class="btn btn-s" onclick="clModal()" style="flex:1">Annuler</button>
      <button class="btn btn-d" onclick="confirmCleanProps()" style="flex:1">Supprimer</button>
    </div>
  `;
  animEl(document.getElementById('mbox'), 'bounceIn');
}

function confirmCleanProps() {
  const before = window.D.g.props.length;
  window.D.g.props = window.D.g.props.filter(p => {
    return (window.PROPS_LIB || []).find(l => l.id === p.id)
        || (window.D.propsPixels || {})[p.id] !== undefined;
  });
  save();
  clModal();
  toast(`${before - window.D.g.props.length} props supprimés ✿`);
  setTimeout(() => location.reload(), 800);
}

function viderJournal() {
  if (!confirm('Supprimer toutes les notes du journal ? La progression du Gotchi n\'est pas affectée.')) return;
  D.journal = [];
  save();
  toast(`Journal vidé ✿`);
  debugProps();
}

function viderObjetsIA() {
  if (!confirm('Supprimer tous les objets générés par le Gotchi ? Les objets du catalogue restent intacts.')) return;
  D.propsPixels = {};
  D.g.props = (D.g.props || []).filter(p => {
    return (window.PROPS_LIB || []).find(l => l.id === p.id);
  });
  save();
  toast(`Objets du Gotchi supprimés ✿`);
  debugProps();
}

/* ─── SYSTÈME 3 : COGNITION & IA (Interaction avec Claude) ───────── */

/* ── Animation de chargement IA (réutilisable) ── */
function startThinkingAnim(elementId, nomGotchi) {
  const el = document.getElementById(elementId);
  if (!el) return null;

  const phrases = [
    `💭 ${nomGotchi} réfléchit`,
    `✨ ${nomGotchi} cherche les mots`,
    `🌱 ${nomGotchi} prépare quelque chose`,
    `💜 ${nomGotchi} est là`,
  ];
  let frame = 0, dots = 0;
  el.textContent = phrases[0] + '...';

  const interval = setInterval(() => {
    dots = (dots + 1) % 4;
    if (dots === 0) frame = (frame + 1) % phrases.length;
    el.textContent = phrases[frame] + '.'.repeat(dots || 3);
  }, 400);

  return interval; // stocker pour pouvoir l'arrêter
}

function stopThinkingAnim(interval) {
  if (interval) clearInterval(interval);
}

/* ============================================================
   API CLAUDE — CADEAU / BULLE
   ============================================================ */

// RÔLE : Choisit un registre d'expression selon l'état du gotchi + aléatoire
// POURQUOI : Force la variété réelle des pensées sans dépendre du modèle seul
function getRegistre(energy, happiness, h) {
  const registres = [];

  // Selon l'énergie
  if (energy <= 1) registres.push(
    "autodérision douce (tu es épuisé·e mais tu l'assumes avec humour)",
    "observation absurde sur le fait de survivre à une journée difficile"
  );
  if (energy >= 4) registres.push(
    "enthousiasme légèrement excessif et un peu ridicule",
    "taquin·e et complice, comme quelqu'un de trop réveillé"
  );

  // Selon le bonheur
  if (happiness <= 2) registres.push(
    "tendresse maladroite, comme quelqu'un qui cherche ses mots",
    "humour très léger sur les petits riens qui vont pas"
  );
  if (happiness >= 4) registres.push(
    "citation absurde ou légèrement philosophique détournée",
    "fierté un peu excessive pour quelque chose de minuscule"
  );

  // Selon l'heure
  if (h >= 7  && h < 11) registres.push("optimisme du matin légèrement naïf");
  if (h >= 13 && h < 16) registres.push("constat un peu blasé mais affectueux sur l'après-midi");
  if (h >= 21)           registres.push("pensée flottante, un peu philosophique, légèrement fatiguée");

  // Registres universels (toujours disponibles)
  registres.push(
    "non-sequitur poétique totalement inattendu",
    "observation microscopique sur quelque chose d'insignifiant",
    "mini-déclaration dramatique pour un détail du quotidien"
  );

  // Tire un registre au hasard dans ce qui est pertinent
  return registres[Math.floor(Math.random() * registres.length)];
}

// RÔLE : Construit les exemples de style pour le prompt IA
// POURQUOI : Extraite de askClaude pour éviter une IIFE illisible dans l'objet vars
function getExemples(journal, personality) {
  const notesUser = (journal || [])
    .slice(-15)
    .map(n => (n.text || '').trim())
    .filter(t => t.length > 15 && t.length < 200)
    .slice(-4);

  const bullesPassees = [
    ...(personality?.bulles?.idle   || []).slice(0, 1),
    ...(personality?.bulles?.triste || []).slice(0, 1),
  ];

  const tout = [...notesUser, ...bullesPassees];
  return tout.length ? tout.join(' / ') : '*bâille*, *sourit*';
}

/**
 * Demande à Claude une pensée personnalisée (Limité à 3x par jour).
 */
async function askClaude() {
  const key = D.apiKey;
  if (!key) { toast(`*chuchote* J'ai besoin de ma clé API dans les Réglages 🔑`); return; }

  const g = D.g, td = today();
  const msgEl = document.getElementById('claude-msg');

  /* ── Mode nuit ── */
  if (hr() >= 22 || hr() < 7) {
    const msgs = [
      "Zzz... je dors 🌙",
      "Chut ! Il est tard... 😴",
      "Laisse-moi tranquille, vas dormir ! 🌛",
      "...zzzZZZ... 💤",
      "Le Gotchi ronfle doucement. Reviens demain ✿"
    ];
    if (msgEl) msgEl.textContent = msgs[Math.floor(Math.random() * msgs.length)];
    return;
  }

  /* ── Limite 3 pensées par jour ── */
  if (window.D.lastThoughtDate !== td) {
    window.D.lastThoughtDate = td;
    window.D.thoughtCount    = 0;
  }
  if (window.D.thoughtCount >= 3) {
    toast("Le Gotchi a besoin de calme… Reviens demain 🌙");
    return;
  }

  /* ── Animation de chargement ── */
  const animThought = startThinkingAnim('claude-msg', g.name);

  /* ── Construction du prompt ── */
  const P   = window.PERSONALITY;
  const CTX = window.AI_CONTEXTS?.askClaude;

  // RÔLE : Notes écrites aujourd'hui uniquement
  const notesRecentes = D.journal
    .filter(j => j.date && j.date.startsWith(td))
    .map(j => j.text.slice(0, 40))
    .filter(t => t.length > 0)
    .join(' / ');

  const vars = {
    nameGotchi:    D.g.name         || P?.nom    || 'Petit·e Gotchi',
    userName:      D.g.userName     || D.userName || 'ton utilisatrice',
    diminutif:     D.g.userNickname || D.g.userName || D.userName || 'toi',
    registre:      getRegistre(g.energy, g.happiness, hr()),
    style:         P?.style         || 'Phrases courtes, onomatopées entre astérisques, bienveillant.',
    traits:        P?.traits?.join(', ') || 'doux, joueur, curieux',
    energy:        g.energy,
    happiness:     g.happiness,
    heure:         new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    date:          todayFr(),
    notesRecentes: notesRecentes
      ? `Aujourd'hui : ${todayFr()}. Ambiance récente : ${notesRecentes}`
      : `Aujourd'hui : ${todayFr()}.`,
    exemples:      getExemples(D.journal, P),
    nomsExistants: [...new Set([
      ...(D.g.props || []).map(p => `${p.nom} (${p.type})`),
      ...(window.PROPS_LIB || []).map(p => `${p.nom} (${p.type})`)
    ])].join(', ') || 'aucun',
    timestamp:     Date.now(),
  };

  function fillVars(template) {
    return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
  }

  /* ── Règle cadeau : 1 tous les 3 jours ── */
  const giveGift = !D.lastGiftDate ||
    Math.floor((new Date() - new Date(D.lastGiftDate)) / 86400000) >= 3;

  const prompt = CTX
    ? fillVars(CTX.base) + '\n\n' + fillVars(giveGift ? CTX.withGift : CTX.withoutGift)
    : `Fallback : réponds en JSON {"message":"...","bulles":{"idle":"..."}}`;

  /* ── Appel API ── */
  try {
    const d = await callClaude({ messages:[{ role:'user', content:prompt }] });
    const rawText = d.content[0].text;
    const match   = rawText.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('JSON introuvable dans la réponse IA');
    const data = JSON.parse(match[0]);

    stopThinkingAnim(animThought);

    /* ── Message affiché ── */
    if (msgEl) msgEl.textContent = data.message;

 /* ── Bulles enrichies (pool glissant 20 max) ── */
if (Array.isArray(data.bulles) && data.bulles.length) {
  if (!Array.isArray(D.g.customBubbles)) D.g.customBubbles = [];
  D.g.customBubbles.unshift(...data.bulles);
  D.g.customBubbles = D.g.customBubbles.slice(0, 20);
}

    /* ── Cadeau ── */
    if (giveGift && data.cadeau) {
      if (!D.g.props) D.g.props = [];
      if (!D.g.props.find(p => p.id === data.cadeau.id)) {
        D.g.props.push({ id:data.cadeau.id, nom:data.cadeau.nom, type:data.cadeau.type, actif:false, pxSize: data.cadeau.pxSize || null, seen:false, acquis: Date.now() });
        D.propsPixels                = D.propsPixels || {};
        D.propsPixels[data.cadeau.id] = data.cadeau;
        window.PROPS_LOCAL           = Object.values(D.propsPixels);
        D.lastGiftDate               = td;

        const poolCadeau = ["Oh ! Un cadeau ! 🎁", "*yeux brillants* ✨", `${data.cadeau.emoji} Pour moi ?! 💜`, "J'adore ! 🌸"];
        const bulleCadeau = poolCadeau[Math.floor(Math.random() * poolCadeau.length)];
        flashBubble(bulleCadeau.replace('{{nom}}', D.g.name || 'toi'), 3000);
        toast(`🎁 Nouveau cadeau : ${data.cadeau.nom} !`);
        addEvent({ type:'cadeau', subtype:'ia', valeur:0, label:`${data.cadeau.nom} reçu en cadeau !` });
        updBadgeBoutique();
      }
    }

    /* ── Compteur ── */
    window.D.thoughtCount++;
    updThoughtFlowers();

    save(); renderProps(); updBubbleNow();

  } catch(e) {
    stopThinkingAnim(animThought);
    if (msgEl) msgEl.textContent = '*soupir* Je n\'arrive pas à me connecter... ✿';
    console.error('Erreur askClaude :', e);
  }
}

/**
 * Demande à Claude de générer un Pixel Art via la Boutique.
 */
async function acheterPropClaude() {
  if ((D.g.petales || 0) < 10) { toast(`Pas assez de pétales 🌸`); return; }
  if (!D.apiKey) { toast(`*chuchote* J'ai besoin de ma clé API dans les Réglages 🔑`); return; }

  D.g.petales -= 10;
  save();

  /* ── Animation de chargement ── */
  const el = document.getElementById('boutique-contenu');
  if (el) el.innerHTML = `<p style="text-align:center;font-size:var(--fs-sm);padding:20px" id="prop-loading">💭</p>`;
  const animProp = startThinkingAnim('prop-loading', window.D.g.name);

  /* ── Construction du prompt ── */
  const nomsInventaire = (D.g.props || []).map(p => `${p.nom} (${p.type})`);
  const nomsCatalogue  = (window.PROPS_LIB || []).map(p => `${p.nom} (${p.type})`);
  const nomsExistants = [...new Set([
  ...(D.g.props || []).map(p => `${p.nom} (${p.type})`),
  ...(window.PROPS_LIB || []).map(p => `${p.nom} (${p.type})`)
])].join(', ') || 'aucun';
  const themes = ['nature','cosmos','magie','cuisine','musique','voyage','océan','forêt','météo','jardin','minéral','rêve'];
  const theme  = themes[Math.floor(Math.random() * themes.length)];
  const ctx    = window.AI_CONTEXTS;

  /* ── Calcul du type le moins représenté (côté JS, fiable) ── */
  const allProps = [...(D.g.props || []), ...(window.PROPS_LIB || [])];
  const counts = { decor: 0, accessoire: 0, ambiance: 0 };
  allProps.forEach(p => { if (counts[p.type] !== undefined) counts[p.type]++; });

  // Tri : moins représenté en premier, égalité → ambiance > accessoire > decor
  const priorite = { ambiance: 3, accessoire: 2, decor: 1 };
  const typeImpose = Object.keys(counts).sort((a, b) => {
    if (counts[a] !== counts[b]) return counts[a] - counts[b];
    return priorite[b] - priorite[a];
  })[0];

  console.log('[buyProp] Comptage:', counts, '→ type imposé:', typeImpose);

  const prompt = ctx
    ? ctx.buyProp
        .replace('{{theme}}',         theme)
        .replace('{{existingNames}}', nomsExistants)
        .replace('{{typeImpose}}',    typeImpose)   // 🆕 nouvelle ligne
        .replace('{{timestamp}}',     Date.now())
    : (() => { toast(`*inquiet* Mes fichiers de mémoire sont manquants... 💜`); return null; })();

  if (!prompt) { stopThinkingAnim(animProp); return; }

  /* ── Appel API ── */
  try {
    const d = await callClaude({ messages:[{ role:'user', content:prompt }] });
    const match = d.content[0].text.match(/\{[\s\S]*\}/);

    stopThinkingAnim(animProp);

    if (match) {
      const obj = JSON.parse(match[0]);
      D.g.props.push({
        id:      obj.id,
        nom:     obj.nom,
        type:    obj.type,
        emoji:   obj.emoji  || '🎁',
        actif:   false,
        slot:    obj.slot   || 'A',
        motion:  obj.motion || 'drift',
        ancrage: obj.ancrage || null,
        seen:    false,
        acquis:  Date.now()  // timestamp pour badge "nouveau"
      });
      D.propsPixels         = D.propsPixels || {};
      D.propsPixels[obj.id] = obj;
      window.PROPS_LOCAL    = Object.values(D.propsPixels);
      save(); renderProps(); updUI();
      addEvent({
  type: 'cadeau',
  subtype: 'ia',
  valeur: 0,
  emoji: obj.emoji || '✨',
  label: `${obj.nom} créé par ${D.g.name} !`
});
      updTabletBadge();

      toast(`${obj.emoji || '✨'} ${obj.nom} ajouté à ton inventaire !`);
      const iaMsgs = [
    `${obj.emoji} Je l'ai fait pour toi ! 💜`,
    "*fier·e* C'est mon œuvre ! ✨",
    `${obj.emoji} J'ai tout imaginé ! 🌸`,
    "*souffle sur ses pattes* ✿",
    "Je savais que tu aimerais ! 💜"
      ];
      flashBubble(iaMsgs[Math.floor(Math.random() * iaMsgs.length)], 2500);
      ouvrirBoutique();
    }

  } catch(e) {
    stopThinkingAnim(animProp);
    D.g.petales = (D.g.petales || 0) + 10;
    save();
    toast(`*soupir* Je n'ai pas pu créer l'objet... pétales remboursés 🌸`);
    console.error('Erreur création prop IA :', e);
    ouvrirBoutique();
  }
}

/* ============================================================
   API CLAUDE — SOUTIEN
   ============================================================ */
function toastInfo() {
  toastModal("💬 Le Gotchi peut te partager une pensée jusqu'à 3 fois par jour.\n\n✍️ Si tu écris des notes dans ton journal, ses réponses seront personnalisées selon ton humeur du jour 💜");
}

// ─────────────────────────────────────────────────────────────────
// RÔLE : Affiche une modale de confirmation avant d'ouvrir le chat
//        de soutien. Gotchi animé sur fond blanc + état + 2 boutons.
// POURQUOI : Évite de consommer 1/3 session par accident.
// ─────────────────────────────────────────────────────────────────
function _showSoutienConfirm(onConfirm) {
  const D = window.D;
  const g = D.g;

  // ── Ouvre la modale avec le contenu de confirmation ──
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `
    <div style="text-align:center;padding:12px 8px 8px">

      <p style="font-size:var(--fs-sm);color:var(--lilac);font-weight:bold;margin-bottom:10px;text-align:left">
        💜 Besoin de soutien
      </p>

      <!-- RÔLE : Zone du mini canvas p5 — fond blanc, coins arrondis -->
      <!-- Hauteur 90px : assez pour adult (oreilles -10px + corps 50px + marge 30px) -->
      <div id="soutien-confirm-canvas"
           style="width:160px;height:90px;margin:0 auto 12px;
                  border-radius:12px;overflow:hidden;background:#ffffff">
      </div>

      <!-- RÔLE : Indique les sessions restantes dans la journée -->
      <!-- D.soutienCount est déjà incrémenté APRÈS confirmation — ici on affiche l'état actuel -->
      <p style="font-size:var(--fs-xs);opacity:0.6;margin-bottom:10px;line-height:1.5">
        ${3 - D.soutienCount} conversation${3 - D.soutienCount > 1 ? 's' : ''} restante${3 - D.soutienCount > 1 ? 's' : ''} aujourd'hui
      </p>

      <div style="display:flex;flex-direction:column;gap:6px">
        <button id="btn-confirm-soutien" class="btn btn-p"
                style="width:100%;font-size:var(--fs-sm)">
          Parler à ${g.name || 'Gotchi'}
        </button>
        <button class="btn btn-s"
                onclick="clModal()"
                style="width:100%;font-size:var(--fs-sm)">
          Annuler
        </button>
      </div>
    </div>
  `;
  animEl(document.getElementById('mbox'), 'bounceIn');

  // ── Mini canvas p5 : Gotchi animé sur fond blanc, sans décor ──
  // RÔLE : Instance p5 temporaire, détruite dès que la modale se ferme
  // POURQUOI : drawBaby/drawTeen/drawAdult sont des fonctions globales
  //            qui acceptent une instance p en paramètre → réutilisables ici
  let _miniP5 = null;

  const W = 160, H = 90;    // Dimensions du canvas (= la div ci-dessus, 160×90)

  // RÔLE : CY = Y du haut du sprite pour que le bas soit posé sur le "sol"
  // Baby  : corps PX*6 = 30px, pas d'oreilles  → cy = H - 30 - 8 = 52
  // Teen  : corps PX*8 = 40px, oreilles 10px   → cy = H - 40 - 8 = 42
  // Adult : corps PX*10= 50px, oreilles 10px   → cy = H - 50 - 8 = 32
  const MARGE_BAS = 8;
  const corpH = { egg: 25, baby: 30, teen: 40, adult: 50 };
  const CY = H - (corpH[g.stage] || 50) - MARGE_BAS;

  let miniX    = W / 2;     // Position X courante du Gotchi
  let miniDir  = 1;          // Direction : 1 = droite, -1 = gauche
  const XMIN_M = 28;         // Marge gauche (demi-largeur adult = PX*5=25 + 3px)
  const XMAX_M = W - 28;    // Marge droite
  const SPEED  = 0.5;        // Vitesse de déplacement (px/frame)
  let miniBlink = false;     // État clignotement local (indépendant du canvas principal)
  let miniBlinkT = 0;        // Compteur avant prochain clignotement
  let miniBlinkD = 0;        // Durée du clignotement en cours

  const miniSketch = (p) => {
    p.setup = () => {
      // RÔLE : Crée le canvas dans la div dédiée, fond blanc, pixel art net
      p.createCanvas(W, H).parent('soutien-confirm-canvas');
      p.noSmooth();   // Rendu pixel art sans antialiasing
      p.frameRate(12); // 12 fps : fluide pour un sprite, économe en CPU
      miniBlinkT = 40 + Math.floor(Math.random() * 80);
    };

    p.draw = () => {
      const gd = window.D.g;
      const en = gd.energy;
      const ha = gd.happiness;

      // Fond blanc pur
      p.background(255);

      // ── Déplacement horizontal ──
      // RÔLE : Gotchi se balade de gauche à droite en rebondissant sur les marges
      miniX += miniDir * SPEED;
      if (miniX >= XMAX_M) { miniX = XMAX_M; miniDir = -1; }
      if (miniX <= XMIN_M) { miniX = XMIN_M; miniDir  =  1; }

      // ── Clignotement local (copie du comportement de render.js) ──
      miniBlinkT--;
      if (!miniBlink && miniBlinkT <= 0) {
        miniBlink = true;
        miniBlinkD = 3 + Math.floor(Math.random() * 4);
      }
      if (miniBlink) {
        miniBlinkD--;
        if (miniBlinkD <= 0) {
          miniBlink = false;
          miniBlinkT = 40 + Math.floor(Math.random() * 80);
        }
      }

      // ── Injection temporaire de blink dans le scope global ──
      // RÔLE : drawBaby/drawTeen/drawAdult lisent la variable globale `blink`
      //        depuis render.js — on la surcharge temporairement pour ce frame
      // POURQUOI : On ne peut pas modifier render.js pour exposer blink,
      //            mais on peut écrire dessus le temps d'un draw()
      const prevBlink = window._miniBlink_backup;
      window.blink = miniBlink; // override temporaire

      // ── Dessin du sprite via les fonctions globales de render-sprites.js ──
      // `false` = sleeping:false (le Gotchi est éveillé dans la modale)
      p.push(); // Isole les transformations
      p.noStroke();
      if      (gd.stage === 'egg')   drawEgg   && drawEgg(p, miniX, CY);
      else if (gd.stage === 'baby')  drawBaby  && drawBaby(p, miniX, CY, false, en, ha);
      else if (gd.stage === 'teen')  drawTeen  && drawTeen(p, miniX, CY, false, en, ha);
      else                           drawAdult && drawAdult(p, miniX, CY, false, en, ha);
      p.pop();

      // Restaure blink pour que render.js ne soit pas perturbé
      window.blink = window._blink_main ?? false;
    };
  };

  // RÔLE : Sauvegarde la valeur courante de blink du canvas principal
  //        pour pouvoir la restaurer après chaque frame du mini canvas
  window._blink_main = window.blink ?? false;

  _miniP5 = new p5(miniSketch);

  // ── "Parler à [nom]" : détruit le mini p5 et lance le vrai chat ──
  document.getElementById('btn-confirm-soutien').addEventListener('click', () => {
    if (_miniP5) { _miniP5.remove(); _miniP5 = null; }
    onConfirm();
  });

  // ── Patch clModal : nettoie le mini p5 si on ferme avec ✕ ou Annuler ──
  // RÔLE : Évite une instance p5 zombie qui continue à tourner en arrière-plan
  const _origClModal = window.clModal;
  window.clModal = function() {
    if (_miniP5) { _miniP5.remove(); _miniP5 = null; }
    window.clModal = _origClModal; // Restaure clModal immédiatement après usage
    _origClModal();
  };
}

/**
 * Lance le chat d'urgence (limité à 6 messages non sauvegardés)
 * RÔLE : Vérifie les gardes (clé API, limite journalière), puis
 *        affiche la modale de confirmation avant d'ouvrir le chat.
 */
function genSoutien() {
  const D = window.D, td = today();

  // ✦ PAS DE CLÉ API : popup simplifié
  if (!D.apiKey) {
    document.getElementById('modal').style.display = 'flex';
    document.getElementById('mbox').innerHTML = `
      <div style="text-align:center;padding:10px">
        <div style="font-size:40px;margin-bottom:var(--sp-sm)">🔑</div>
        <p style="font-size:12px;margin-bottom:4px;color:var(--lilac);font-weight:bold">
          Clé API manquante
        </p>
        <p style="font-size:var(--fs-sm);color:var(--text2);margin-bottom:var(--sp-md)">
          Pour accéder au soutien du Gotchi,<br>ajoute ta clé API dans les Réglages.
        </p>
        <button class="btn btn-p" onclick="clModal(); go('settings')" style="width:100%">
        Aller dans les Réglages ⚙️
        </button>
      </div>
    `;
    animEl(document.getElementById('mbox'), 'bounceIn');
    return;
  }

  // ✦ LIMITE 3 SESSIONS PAR JOUR
  if (D.lastSoutienDate !== td) {
    D.lastSoutienDate = td;
    D.soutienCount = 0;
  }
  if (D.soutienCount >= 3) {
    toast("Le Gotchi a besoin de se reposer… Reviens demain 🌙");
    return;
  }

  // RÔLE : Affiche la confirmation AVANT de décompter — si l'utilisatrice
  //        annule, la session n'est pas consommée
  _showSoutienConfirm(() => _genSoutienCore(D, td));
}

/**
 * RÔLE : Cœur du lancement du chat — appelé uniquement après confirmation.
 *        Construit le prompt, ouvre la modale de chat, lance le 1er message IA.
 * POURQUOI : Séparé de genSoutien() pour que la modale de confirmation
 *            reste propre et indépendante.
 */
function _genSoutienCore(D, td) {
  // RÔLE : Décompte la session ici, APRÈS confirmation de l'utilisatrice
  D.soutienCount++;
  save();

  const habsDuJour  = D.habits.map(h => ({ label:h.label, faite:(D.log[td]||[]).includes(h.catId) }));
  const notesDuJour = D.journal.filter(j => j.date.startsWith(td)).map(j => ({ humeur:j.mood, texte:j.text }));
  
  const ctx = window.AI_CONTEXTS;
const P = window.PERSONALITY;
const cycleData  = showCycle() ? getCyclePhase(td) : null;
const cycleInfo  = cycleData ? `${cycleData.label} (J${cycleData.j})` : 'non renseignée';
const rdvDuJour  = (D.rdv || [])
  .filter(r => r.date === td)
  .map(r => r.heure ? `${r.heure} ${r.label}` : r.label)
  .join(', ') || 'aucun';
const promptInit = ctx
  ? ctx.genSoutien
      .replace('{{nameGotchi}}',          D.g.name || P?.nom || 'Gotchi')
      .replace('{{userName}}',     D.g.userName || D.userName || 'toi')
      .replace('{{style}}',        P?.style || 'Phrases courtes, bienveillant.')
      .replace('{{traits}}',       P?.traits?.join(', ') || 'doux, curieux')
      .replace('{{heure}}',        new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
      .replace('{{date}}',         todayFr())
      .replace('{{energy}}',       `${D.g.energy}/5`)
      .replace('{{happiness}}',    `${D.g.happiness}/5`)
      .replace('{{habitsDone}}',   habsDuJour.filter(h=>h.faite).map(h=>h.label).join(', ') || 'aucune')
      .replace('{{habitsUndone}}', habsDuJour.filter(h=>!h.faite).map(h=>h.label).join(', ') || 'toutes faites !')
      .replace('{{notes}}',        notesDuJour.length ? notesDuJour.map(n=>`[${n.humeur}] ${n.texte}`).join(' | ') : 'aucune note')
      .replace('{{cycleInfo}}',      cycleInfo)
      .replace('{{rdvAujourdhui}}',  rdvDuJour)
  : `Tu es le Gotchi, compagnon bienveillant de ${D.g.userName || 'toi'}.\nIl est ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}, énergie ${D.g.energy}/5, humeur ${D.g.happiness}/5.\nCommence par une phrase qui montre que tu as lu son état. Pose UNE question ouverte. Ton doux, jamais de jugement.`;

window._soutienHistory = [];
  window._soutienCount = 0;
  modalLocked = true;
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <h3 style="font-size:13px;color:var(--lilac);">💜 Besoin de soutien</h3>
<button onclick="modalLocked=false;clModal()" style="background:none;border:none;font-size:16px;cursor:pointer;color:var(--text2)">✕</button>
    </div>
    <div class="soutien-chat" id="soutien-chat">
      <div class="soutien-chat" id="soutien-chat"></div>
    </div>
    <div style="display:flex;gap:6px;margin-top:8px">
      <input type="text" id="soutien-inp" class="inp" placeholder="Réponds ici..." style="font-size:var(--fs-sm)"
        onkeydown="if(event.key==='Enter')sendSoutienMsg()">
      <button class="btn btn-p" onclick="sendSoutienMsg()" style="flex-shrink:0;padding:var(--sp-sm) 12px">→</button>
    </div>
    <p id="soutien-count" style="font-size:var(--fs-xs);opacity:0.6;text-align:center;margin-top:4px;line-height:1.6">6 messages restants<br>conversation non sauvegardée</p>
    <button id="btn-copier-soutien" class="btn btn-s" onclick="copierSoutien()"
            style="width:100%;font-size:var(--fs-sm);margin-top:6px;
                   display:none;opacity:0;transition:opacity 0.5s ease">
      Copier la conversation
    </button>
`;
animEl(document.getElementById('mbox'), 'bounceIn');
  sendSoutienMsg(promptInit, true);
}

async function sendSoutienMsg(systemPrompt, isInit = false) {
  const key  = window.D.apiKey;
  const chat = document.getElementById('soutien-chat');

  /* ── Limite 6 messages par session ── */
  if (!isInit) {
    // RÔLE : Incrémente AVANT l'appel API — le 6ème message est le dernier accepté
    window._soutienCount++;

    // RÔLE : Bloque si le quota était déjà atteint (7ème tentative et au-delà)
    if (window._soutienCount > 6) {
      chat.innerHTML += `<div class="chat-bubble-system">Tu as atteint la limite de 6 messages pour cette session. Prends soin de toi 💜</div>`;
      chat.scrollTop = chat.scrollHeight;
      document.getElementById('soutien-inp').disabled = true;
      document.querySelector('#mbox .btn-p').disabled  = true;
      return;
    }

    // RÔLE : Met à jour le compteur affiché sur deux lignes
    const restants = 6 - window._soutienCount;
    const countEl  = document.getElementById('soutien-count');
    if (countEl) {
      countEl.innerHTML = restants <= 0
        ? `Dernier message<br>conversation non sauvegardée`
        : `${restants} message${restants > 1 ? 's' : ''} restant${restants > 1 ? 's' : ''}<br>conversation non sauvegardée`;
    }
  }

  if (!key) { toast(`*chuchote* J'ai besoin de ma clé API dans les Réglages 🔑`); return; }

  /* ── Message utilisatrice ── */
  if (!isInit) {
    const inp      = document.getElementById('soutien-inp');
    const userText = inp ? inp.value.trim() : '';
    if (!userText) return;
    chat.innerHTML += `<div class="chat-bubble-user">${userText}</div>`;
    inp.value = '';
    window._soutienHistory.push({ role:'user', content:userText });
  }

  /* ── Animation de chargement ── */
  const bubbleId   = 'typing-' + Date.now();
  chat.innerHTML  += `<div class="chat-bubble-system" id="${bubbleId}">💭</div>`;
  const animSoutien = startThinkingAnim(bubbleId, window.D.g.name);
  chat.scrollTop   = chat.scrollHeight;

  /* ── Construction du contexte ── */
  const messages = isInit ? [{ role:'user', content:systemPrompt }] : [...window._soutienHistory.slice(-6)];

  const D  = window.D;
  const P  = window.PERSONALITY;
  const td = today();

  const notesJour = D.journal
    .filter(j => j.date.startsWith(td))
    .slice(-3)
    .map(j => `[${j.mood}] ${j.text}`)
    .join(' | ') || 'aucune note';

  const habsDone = (D.log[td] || [])
    .map(catId => { const h = D.habits.find(h => h.catId === catId); return h ? h.label : null; })
    .filter(Boolean)
    .join(', ') || 'aucune';

  const cycleData  = showCycle() ? getCyclePhase(td) : null;
  const cycleInfo  = cycleData ? `${cycleData.label} (J${cycleData.j})` : 'non renseignée';
  const rdvDuJour  = (D.rdv || [])
  .filter(r => r.date === td)
  .map(r => r.heure ? `${r.heure} ${r.label}` : r.label)
  .join(', ') || 'aucun';

  const contexte = (window.AI_SYSTEM?.soutien_contexte || '')
    .replace('{{nameGotchi}}',              D.g.name || P?.nom || 'Gotchi')
    .replace('{{userName}}',         D.g.userName || D.userName || 'toi')
    .replace('{{style}}',            P?.style || 'Phrases courtes, bienveillant.')
    .replace('{{traits}}',           P?.traits?.join(', ') || 'doux, curieux')
    .replace('{{heure}}',            new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
    .replace('{{date}}',             td)
    .replace('{{energy}}',           D.g.energy)
    .replace('{{happiness}}',        D.g.happiness)
    .replace('{{habsDone}}',         habsDone)
    .replace('{{notes}}',            notesJour)
    .replace('{{cycleInfo}}',     cycleInfo)
    .replace('{{rdvAujourdhui}}', rdvDuJour)
    .replace('{{messages_restants}}', 6 - window._soutienCount);

  const sysPrompt = (window.AI_SYSTEM?.soutien || '')
    .replace('{{nameGotchi}}',      D.g.name || P?.nom || 'Gotchi')
    .replace('{{userName}}', D.g.userName || D.userName || 'toi')
    .replace('{{style}}',    P?.style || 'Phrases courtes, bienveillant.')
    .replace('{{traits}}',   P?.traits?.join(', ') || 'doux, curieux')
    .concat(' ', contexte)
    .trim();

  /* ── Appel API ── */
  try {
    const d = await callClaude({ messages, system: sysPrompt });
    const reply = d.content?.[0]?.text || 'Je suis là. 💜';
    // NOTE : _soutienCount++ est fait AVANT l'appel API (dans le bloc limite ci-dessus)
    stopThinkingAnim(animSoutien);
    document.getElementById(bubbleId)?.remove();
    chat.innerHTML += `<div class="chat-bubble-claude">${reply}</div>`;
    chat.scrollTop  = chat.scrollHeight;

    if (isInit) window._soutienHistory.push({ role:'user', content:systemPrompt });
    window._soutienHistory.push({ role:'assistant', content:reply });

    // RÔLE : Révèle le bouton "Copier" et bloque l'input après le 6ème message reçu
    if (window._soutienCount >= 6) {
      document.getElementById('soutien-inp').disabled = true;
      document.querySelector('#mbox .btn-p').disabled  = true;
      const btnCopier = document.getElementById('btn-copier-soutien');
      if (btnCopier) {
        btnCopier.style.display = 'block';
        requestAnimationFrame(() => { btnCopier.style.opacity = '1'; });
      }
    }

  } catch(e) {
    stopThinkingAnim(animSoutien);
    document.getElementById(bubbleId)?.remove();
    chat.innerHTML += `<div class="chat-bubble-system">*soupir* Je n'arrive plus à te répondre... Vérifie ta clé API 💜</div>`;
    console.error('Erreur soutien IA :', e);
  }
}

function copierSoutien() {
  const chat = document.getElementById('soutien-chat');
  if (!chat) return;
  const D = window.D;
  const lignes = [];
  chat.querySelectorAll('.chat-bubble-user, .chat-bubble-claude').forEach(msg => {
    const auteur = msg.classList.contains('chat-bubble-user')
      ? (D.g.userName || D.userName || 'Toi')
      : (D.g.name || 'Gotchi');
    lignes.push(`${auteur} : ${msg.innerText.trim()}`);
  });
  if (!lignes.length) return;
  const texte = lignes.join('\n\n');
  const btn = document.getElementById('btn-copier-soutien');
  if (!navigator.clipboard) return; // fallback silencieux (contexte non sécurisé)
  navigator.clipboard.writeText(texte).then(() => {
    if (btn) { btn.textContent = '✓ Copié !'; setTimeout(() => btn.textContent = 'Copier la conversation', 2000); }
  }).catch(() => {});
}

/* ─── SYSTÈME 6 : INTROSPECTION & MÉMOIRE (Bilan IA) ─────────────── */

/* ============================================================
   API CLAUDE — BILAN SEMAINE
   ============================================================ */
let wOff = 0, mOff = 0;
function navW(d) {
  wOff += d;
  // Calcule le mois majoritaire de la semaine affichée
  const wd = getWkDates(wOff);
  const mois = wd.map(ds => new Date(ds + 'T12:00').getMonth());
  const majoritaire = mois.sort((a,b) =>
    mois.filter(m => m===b).length - mois.filter(m => m===a).length
  )[0];
  const annee = new Date(wd[3] + 'T12:00').getFullYear(); // mercredi = pivot fiable
  const now = new Date();
  mOff = (annee - now.getFullYear()) * 12 + (majoritaire - now.getMonth());
  renderProg();
}
function navM(d) { mOff += d; renderProg(); }


/* ── Reset du compteur si nouvelle semaine ── */
function checkBilanReset() {
  const currentWeek = getWeekId();
  if (window.D.g.bilanWeek !== currentWeek) {
    window.D.g.bilanWeek  = currentWeek;
    window.D.g.bilanCount = 0;
    save();
  }
}

async function genBilanSemaine() {
  const D = window.D, key = D.apiKey;
  const summaryEl = document.getElementById('claude-summary');
  const wd = getWkDates(wOff);
  const g = D.g, s = getSt(g.totalXp);
  const habitudes = D.habits.map(h => ({ habitude:h.label, jours_faits:wd.filter(d=>(D.log[d]||[]).includes(h.catId)).length, sur:7 }));
  const notes = D.journal.filter(j=>wd.includes(j.date.split('T')[0])).map(j=>({humeur:j.mood,texte:j.text,date:j.date.split('T')[0]}));
  const totalHabDays = wd.reduce((acc,d)=>acc+(D.log[d]||[]).length, 0);

  /* ── Vérification quota ── */
  checkBilanReset();
  if ((window.D.g.bilanCount || 0) >= 3) {
    summaryEl.textContent = 'Tu as déjà généré 3 bilans cette semaine 💜 Reviens vendredi prochain !';
    return;
  }

  /* ── Semaine en cours uniquement ── */
  // RÔLE : Empêche la génération d'un bilan sur une semaine passée même si le bouton est contourné.
  // POURQUOI : Le bilan est pensé comme un outil de la semaine active, pas un retour en arrière.
  if (wOff !== 0) {
    summaryEl.textContent = 'Le bilan ne peut être généré que pour la semaine en cours 💜';
    return;
  }

  /* ── Semaine en cours ou passée ? ── */
  const semaineEnCours  = wOff === 0;
  const jourSemaine     = new Date().getDay();
  let noteIA = '';
if (semaineEnCours) {
  if (jourSemaine === 5)      noteIA = 'Note : il reste encore 2 jours à cette semaine (samedi et dimanche). Génère un bilan d\'étape encourageant.';
  else if (jourSemaine === 6) noteIA = 'Note : il reste encore 1 jour à cette semaine (dimanche). Génère un bilan d\'étape encourageant.';
}

  /* ── Sans clé API ── */
  if (!key) {
    const lignes = habitudes.map(h=>`• ${h.habitude} : ${h.jours_faits}/7 jours`).join('\n');
    summaryEl.textContent = `Semaine du ${wd[0]} au ${wd[6]}\n\n${lignes}\n\n${notes.length} note(s) de journal.\n\nAjoute ta clé API pour un bilan personnalisé ✿`;
    document.getElementById('btn-copy-bilan').style.display = 'block';
    document.getElementById('bil-txt-hidden').value = summaryEl.textContent;
    window.D.g.bilanText = summaryEl.textContent;
    save();
    return;
  }

  const animBilan = startThinkingAnim('claude-summary', g.name);

  /* ── Construction du prompt ── */
  const ctx = window.AI_CONTEXTS;
  const prompt = ctx
    ? ctx.genBilanSemaine
        .replaceAll('{{nameGotchi}}',   g.name)
        .replaceAll('{{userName}}',     D.g.userName || D.userName || 'ton utilisatrice')
        .replace('{{weekStart}}',    wd[0])
        .replace('{{weekEnd}}',      wd[6])
        .replace('{{stage}}',        s.l)
        .replace('{{energy}}',       g.energy)
        .replace('{{happiness}}',    g.happiness)
        .replace('{{habitudes}}',    habitudes.map(h=>`- ${h.habitude} : ${h.jours_faits}/7 jours`).join('\n'))
        .replace('{{totalHabDays}}', totalHabDays)
        .replace('{{notesCount}}',   notes.length)
        .replace('{{notes}}',        notes.length ? notes.map(n=>`[${n.date}/${n.humeur}] ${n.texte}`).join('\n') : 'aucune note cette semaine')
        .replace('{{bilanNote}}',    noteIA)
    : `Tu es le Gotchi. Bilan semaine ${wd[0]}→${wd[6]} pour ${g.name} (${s.l}). Énergie ${g.energy}/5, Bonheur ${g.happiness}/5. ${totalHabDays} habitudes cochées. ${notes.length} notes. Bilan chaleureux en 3 paragraphes courts. Ton doux, pas de bullet points. ${noteIA}`;

/* ── Appel API ── */
  try {
    const d = await callClaude({ messages:[{ role:'user', content:prompt }] });
    const bilan = (d.content?.[0]?.text || 'Je n\'ai pas pu générer le bilan.')
      .replaceAll('{{nameGotchi}}', g.name)
      .replaceAll('{{userName}}',   D.g.userName || D.userName || 'toi');

    stopThinkingAnim(animBilan);
    summaryEl.textContent = bilan;
    document.getElementById('bil-txt-hidden').value = bilan;
    document.getElementById('btn-copy-bilan').style.display = 'block';
    window.D.g.bilanCount = (window.D.g.bilanCount || 0) + 1;
    window.D.g.bilanText  = bilan;
    save();
    renderProg(); // rafraîchit l'état du bouton

  } catch(e) {
    stopThinkingAnim(animBilan);
    summaryEl.textContent = '❌ Une erreur est survenue, réessaie plus tard 💜';
    console.error('Erreur bilan IA :', e);
  }
}

function copyBilanSemaine() {
  const hid = document.getElementById('bil-txt-hidden'); if (!hid) return;
  navigator.clipboard.writeText(hid.value).then(() => {
    const b = document.getElementById('btn-copy-bilan');
    if (b) { b.textContent = '✓ Copié !'; setTimeout(() => b.textContent = '📋 Copier le bilan', 1500); }
  });
}
function resetBilan() {
  // On garde le compteur intact — juste le texte est effacé
  const el = document.getElementById('claude-summary');
  if (el) el.textContent = 'Ton bilan de la semaine apparaîtra ici...';
  document.getElementById('btn-copy-bilan').style.display = 'none';
  window.D.g.bilanText = '';
  save();
  renderProg();
  toast(_noOrphan('Bilan effacé 🌸'));
}

/* ─── SYSTÈME 5 : INVENTAIRE & PERSONNALISATION (Esthétique) ────── */

/* ============================================================
   PERSONNALISATION
   ============================================================ */
function renderPerso() {
  const D = window.D;
  const pg = document.getElementById('palette-grid');
  if (pg) {
    const current = D.g.uiPalette || 'lavande';
    pg.innerHTML = window.HG_CONFIG.UI_PALETTES.map(p => `
      <div onclick="applyUIPalette('${p.id}')" style="padding:var(--sp-sm);border-radius:var(--r-md);cursor:pointer;text-align:center;border:3px solid ${current===p.id?p.lilac:'transparent'};background:${p.bg};transition:.2s;">
        <div style="display:flex;gap:4px;justify-content:center;margin-bottom:4px">
          <div style="width:14px;height:14px;border-radius:50%;background:${p.lilac}"></div>
          <div style="width:14px;height:14px;border-radius:50%;background:${p.mint}"></div>
          <div style="width:14px;height:14px;border-radius:50%;background:${p.pink}"></div>
        </div>
        <div style="font-size:var(--fs-xs);font-weight:bold;color:${p.text || '#38304a'}">${p.label}</div>
      </div>`).join('');
  }
  const gc = document.getElementById('gotchi-colors');
  if (gc) {
    const current = D.g.gotchiColor || 'vert';
    gc.innerHTML = window.HG_CONFIG.GOTCHI_COLORS.map(c => `
  <div onclick="applyGotchiColor('${c.id}')" style="
    border-radius:var(--r-md);cursor:pointer;
    background:${c.body};
    border:3px solid ${current===c.id ? 'var(--lilac)' : 'transparent'};
    padding:6px 4px;
    display:flex;flex-direction:column;align-items:center;gap:3px;
    transition:.2s;box-shadow:0 2px 6px rgba(0,0,0,.1);">
    <div style="width:20px;height:20px;border-radius:50%;background:${c.bodyLt};border:2px solid ${c.bodyDk}"></div>
    <div style="font-size:var(--fs-xs);font-weight:bold;color:${c.bodyDk};text-align:center">${c.label}</div>
  </div>`).join('');
  }
  const et = document.getElementById('env-themes');
  if (et) {
    const current = D.g.envTheme || 'pastel';
et.innerHTML = window.HG_CONFIG.ENV_THEMES.map(t => `
  <div onclick="applyEnvTheme('${t.id}')" style="
    padding:var(--sp-md) 8px;border-radius:var(--r-md);cursor:pointer;
    background:linear-gradient(135deg,${t.sky1},${t.gnd});
    border:3px solid ${current===t.id?'var(--lilac)':'transparent'};
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:4px;transition:.2s;">
    <div style="font-size:24px;line-height:1">${t.icon}</div>
    <div style="font-size:var(--fs-sm);font-weight:bold;color:#fff;text-align:center;text-shadow:0 1px 3px rgba(0,0,0,.4)">${t.label}</div>
  </div>`).join('');
  }
} // ← ferme renderPerso()

function applyUIPalette(id, silent = false) {
  const p = window.HG_CONFIG.UI_PALETTES.find(x => x.id === id); if (!p) return;
  document.documentElement.style.setProperty('--bg',    p.bg);
  document.documentElement.style.setProperty('--lilac', p.lilac);
  document.documentElement.style.setProperty('--mint',  p.mint);
  document.documentElement.style.setProperty('--pink',  p.pink);
  document.documentElement.style.setProperty('--text',  p.text  || '#38304a');
  document.documentElement.style.setProperty('--text2', p.text2 || '#887ea0');
  document.documentElement.style.setProperty('--card',   p.card   || 'rgba(255,255,255,.88)');
document.documentElement.style.setProperty('--border', p.border || '#ccc4d8');
  window.D.g.uiPalette = id; save(); renderPerso();
  if (!silent) toast(`Palette ${p.label} appliquée ✿`);
}
function applyGotchiColor(id, silent = false) {
  const c = window.HG_CONFIG.GOTCHI_COLORS.find(x => x.id === id); if (!c) return;
  window.D.g.gotchiColor = id; save(); renderPerso();
  if (!silent) toast(`Couleur ${c.label} appliquée ✿`);
}
function applyEnvTheme(id, silent = false) {
  const t = window.HG_CONFIG.ENV_THEMES.find(x => x.id === id); if (!t) return;
  window.D.g.envTheme = id; save(); renderPerso();
  if (!silent) toast(`Ambiance ${t.label} appliquée ✿`);
}
function restorePerso() {
  if (window.D.g.uiPalette)   applyUIPalette(window.D.g.uiPalette, true);
  if (window.D.g.gotchiColor) applyGotchiColor(window.D.g.gotchiColor, true);
  if (window.D.g.envTheme)    applyEnvTheme(window.D.g.envTheme, true);
}

/* ─── SYSTÈME 6 : INTROSPECTION & MÉMOIRE (Le Journal Intime) ────── */

/* ============================================================
   PIN & JOURNAL
   ============================================================ */
let pinBuf = '', pinMode = 'check';

function renderPin() {
  const dots = document.getElementById('pin-dots'); if (!dots) return;
  dots.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const d = document.createElement('div');
    d.className = 'pin-dot' + (i < pinBuf.length ? ' f' : '');
    dots.appendChild(d);
  }
  const pad = document.getElementById('pin-pad');
  pad.innerHTML = '';
  for (let n = 1; n <= 9; n++) {
    const b = document.createElement('button');
    b.className = 'pin-k'; b.textContent = n;
    b.onclick = () => { pinBuf += n; renderPin(); if (pinBuf.length === 4) pinSubmit(); };
    pad.appendChild(b);
  }
  let bd = document.createElement('button'); bd.className = 'pin-k'; bd.textContent = '←';
  bd.onclick = () => { pinBuf = pinBuf.slice(0,-1); renderPin(); };
  pad.appendChild(bd);
  let b0 = document.createElement('button'); b0.className = 'pin-k'; b0.textContent = '0';
  b0.onclick = () => { pinBuf += '0'; renderPin(); if (pinBuf.length === 4) pinSubmit(); };
  pad.appendChild(b0);
  let bc = document.createElement('button'); bc.className = 'pin-k'; bc.textContent = '✕';
  bc.style.color = 'var(--coral)';
  bc.onclick = () => { pinBuf = ''; renderPin(); };
  pad.appendChild(bc);
}
function pinSubmit() {
  const msg = document.getElementById('pin-msg');
  if (pinMode === 'setup') { window.D.pin = pinBuf; save(); msg.textContent = 'PIN créé ✿'; setTimeout(unlockJ, 400); }
  else { if (pinBuf === window.D.pin) unlockJ(); else { msg.textContent = 'Incorrect.'; pinBuf = ''; renderPin(); } }
}
function unlockJ() {
  journalLocked = false;
  document.getElementById('pin-gate').style.display = 'none';
  document.getElementById('j-inner').style.display = 'block';
  renderJEntries();
}
function renderJ() {
  if (!journalLocked) { document.getElementById('pin-gate').style.display='none'; document.getElementById('j-inner').style.display='block'; renderJEntries(); return; }
  document.getElementById('j-inner').style.display = 'none';
  document.getElementById('pin-gate').style.display = 'block';
  pinBuf = '';
  if (!window.D.pin) { pinMode = 'setup'; document.getElementById('pin-msg').textContent = 'Choisis un code'; }
  else { pinMode = 'check'; document.getElementById('pin-msg').textContent = 'Entre ton code'; }
  renderPin();
}

const MOODS = [{id:'dur',e:'🌧️'},{id:'bof',e:'😔'},{id:'ok',e:'😐'},{id:'bien',e:'😊'},{id:'super',e:'🌟'}];
let selMood = null;

function initMoodPicker() {
  // Compteur de caractères du journal
const jText = document.getElementById('j-text');
const vStatus = document.getElementById('v-status');
if (jText && vStatus) {
  jText.addEventListener('input', () => {
    const len = jText.value.length;
    const max = window.JOURNAL_MAX_CHARS;
    const restant = max - len;
    vStatus.textContent = restant >= 0
      ? `${len}/${max} caractères`
      : `✂️ Trop long de ${Math.abs(restant)} caractères`;
    vStatus.style.color = restant < 30 ? '#e07060' : '#a09880';
  });
}
  const mp = document.getElementById('mood-pick');
  if (mp) mp.innerHTML = MOODS.map(m => `<button class="mood-b" data-m="${m.id}" onclick="pickM('${m.id}')">${m.e}</button>`).join('');
}
function pickM(id) {
  selMood = id;
  document.querySelectorAll('.mood-b').forEach(b => b.classList.toggle('sel', b.dataset.m === id));
}
function saveJ() {
  const t = document.getElementById('j-text').value.trim();
    // ── Garde : humeur obligatoire
  if (!selMood) {
    const mp = document.getElementById('mood-pick');
    if (mp) { mp.classList.add('mood-required'); setTimeout(() => mp.classList.remove('mood-required'), 800); }
    toast(_noOrphan('Choisis une humeur avant de sauvegarder ✿'));
    return;
  }

  // ── Garde : limite de caractères
  if (t.length > window.JOURNAL_MAX_CHARS) {
    toast(`✂️ Note trop longue (max ${window.JOURNAL_MAX_CHARS} caractères)`);
    return;
  }

  // ── Garde : limite quotidienne
  const todayStr = today(); // fonction existante dans app.js
  const notesAujourdHui = window.D.journal.filter(n => n.date.startsWith(todayStr));
  if (notesAujourdHui.length >= window.JOURNAL_MAX_PER_DAY) {
    toast(`📓 ${window.JOURNAL_MAX_PER_DAY} notes max par jour — reviens demain ✿`);
    return;
  }
  window.D.journal.push({ date: new Date().toISOString(), mood: selMood, text: t });
  addXp(15);
  addEvent({ type: 'note', subtype: 'journal', valeur: XP_NOTE, label: `Note enregistrée  +${XP_NOTE} XP` });
  toast(`+${XP_NOTE} XP 📓`);
  save();
  document.getElementById('j-text').value = '';
  selMood = null;
  document.querySelectorAll('.mood-b').forEach(b => b.classList.remove('sel'));
  renderJEntries();
  const srcJ = window.PERSONALITY ? window.PERSONALITY.bulles : MSG;
  const poolJ = srcJ.journal || ["Je t'écoute ✿"];
  const el = document.getElementById('bubble');
  if (el) {
    let bulle = poolJ[Math.floor(Math.random() * poolJ.length)];
    bulle = bulle.replace('{{diminutif}}', D.g.userNickname || D.userName || 'toi');
    el.textContent = bulle;
  }
}

let jWeekOff = 0;
function navJWeek(d) { jWeekOff += d; renderJEntries(); }
function getWkDates(off) {
  const t = new Date(); t.setDate(t.getDate() + off * 7);
  const day = (t.getDay() + 6) % 7, mon = new Date(t);
  mon.setDate(t.getDate() - day);
  const dates = [];
  for (let i = 0; i < 7; i++) { const d = new Date(mon); d.setDate(mon.getDate()+i); dates.push(d.toISOString().split('T')[0]); }
  return dates;
}
function renderJEntries() {
  // ── Mise à jour du statut / fleurs de quota journal du jour
  const todayStr = today();
  const countToday = window.D.journal.filter(n => n.date.startsWith(todayStr)).length;
  const vStatus = document.getElementById('v-status');
  if (vStatus && !document.getElementById('j-text').value) {
    const reste = window.JOURNAL_MAX_PER_DAY - countToday;
    // RÔLE : Message de quota — remplacé visuellement par les fleurs, mais conservé en fallback texte
    vStatus.textContent = reste === 0 ? `Quota du jour atteint ✿ — à demain !` : '';
    vStatus.style.color = '#e07060';
  }
  // RÔLE : Synchroniser les fleurs de quota journal à chaque rendu
  updJournalFlowers();

  const D = window.D;
  const wd = getWkDates(jWeekOff);
  const wt = document.getElementById('j-week-title');
  const wc = document.getElementById('j-week-count'); // compteur de notes de la semaine

  // ── Titre de navigation semaine
  if (jWeekOff === 0) {
    if (wt) wt.textContent = 'Cette semaine';
  } else {
    const a = new Date(wd[0]), b = new Date(wd[6]);
    if (wt) wt.textContent = `${a.getDate()}/${a.getMonth()+1} — ${b.getDate()}/${b.getMonth()+1}`;
  }

  // ── Entrées de la semaine filtrées (du plus récent au plus ancien)
  const entries = D.journal.filter(j => wd.includes(j.date.split('T')[0])).reverse();

  // RÔLE : Afficher le nombre de notes de la semaine sous le titre de navigation
  if (wc) {
    wc.textContent = entries.length > 0 ? `${entries.length} note${entries.length > 1 ? 's' : ''} cette semaine` : '';
  }

  const c = document.getElementById('j-entries');
  const me = { super: '🌟', bien: '😊', ok: '😐', bof: '😔', dur: '🌧️' };
  if (!c) return;
  if (!entries.length) {
    c.innerHTML = '<p style="font-size:var(--fs-sm);color:#a09880;text-align:center">Aucune entrée</p>';
    return;
  }

  // RÔLE : Générer les entrées avec séparateurs de date entre chaque groupe du même jour
  // POURQUOI : Plusieurs notes le même jour s'enchaînaient sans repère visuel
  let html = '';
  let lastDate = '';
  entries.forEach(e => {
    const d   = new Date(e.date);
    const gi  = D.journal.indexOf(e);
    const dateKey = e.date.split('T')[0]; // "YYYY-MM-DD" — clé de groupement

    // ── Insérer un séparateur si on change de jour
    if (dateKey !== lastDate) {
      lastDate = dateKey;
      // Format : "Lundi 28 avril" (ou "aujourd'hui" si c'est le jour courant)
      const estAujd = dateKey === todayStr;
      const labelDate = estAujd
        ? `Aujourd'hui`
        : d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      html += `<div class="j-day-sep">${labelDate}</div>`;
    }

    // ── Carte de note avec teinte d'humeur et heure seulement (la date est dans le séparateur)
    html += `<div class="j-entry mood-${e.mood || 'ok'}">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="j-date">${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
        <span style="font-size:16px">${me[e.mood] || '😐'}</span>
      </div>
      <div style="font-size:var(--fs-sm);margin-top:3px">${e.text || '—'}</div>
      <div class="j-actions">
        <button onclick="editJEntry(${gi})">✏️</button>
        <button onclick="delJEntry(${gi})">🗑️</button>
      </div>
    </div>`;
  });
  c.innerHTML = html;
}
function editJEntry(i) {
  const e = window.D.journal[i]; if (!e) return;
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `
  <h3>Modifier</h3>
  <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-bottom:var(--sp-sm)" id="edit-mood-pick">
    ${MOODS.map(m => `<button class="mood-b${e.mood===m.id?' sel':''}" data-m="${m.id}" onclick="this.parentNode.querySelectorAll('.mood-b').forEach(b=>b.classList.toggle('sel',b===this));window._editMood='${m.id}'">${m.e}</button>`).join('')}
  </div>
  <textarea id="edit-j-txt" class="inp" rows="5" style="font-size:12px">${escape(e.text||'')}</textarea>
  <div style="display:flex;gap:6px;margin-top:8px">
    <button class="btn btn-s" onclick="clModal()" style="flex:1">Annuler</button>
    <button class="btn btn-p" onclick="saveEditJ(${i})" style="flex:1">OK</button>
  </div>`;
window._editMood = e.mood;
  animEl(document.getElementById('mbox'), 'bounceIn');
}
function saveEditJ(i) {
  window.D.journal[i].text = document.getElementById('edit-j-txt').value.trim();
  if (window._editMood) window.D.journal[i].mood = window._editMood;
  window._editMood = null;
  save(); clModal(); renderJEntries();
}function delJEntry(i) {
  openModal(`<p>Supprimer ?</p><div style="display:flex;gap:6px;margin-top:10px"><button class="btn btn-s" onclick="clModal()" style="flex:1">Non</button><button class="btn btn-d" onclick="confirmDelJ(${i})" style="flex:1">Oui</button></div>`);
}
function confirmDelJ(i) { window.D.journal.splice(i, 1); save(); clModal(); renderJEntries(); updUI(); }

/* ─── SYSTÈME 6 : EXPORT JOURNAL ─────────────────────────────────── */
function exportJournal(mode) {
  const D = window.D;
  const me = { super: '🌟', bien: '😊', ok: '😐', bof: '😔', dur: '🌧️' };
  let entries, nomFichier;

  if (mode === 'semaine') {
    const wd = getWkDates(jWeekOff);
    entries = D.journal.filter(j => wd.includes(j.date.split('T')[0]));
    nomFichier = `journal_${wd[0]}_${wd[6]}.txt`;
  } else {
    entries = [...D.journal];
    nomFichier = `journal_complet_${new Date().toISOString().split('T')[0]}.txt`;
  }

  if (!entries.length) {
    alert('Aucune entrée à exporter 🌿');
    return;
  }

  // Trier du plus ancien au plus récent
  entries.sort((a, b) => new Date(a.date) - new Date(b.date));

  const lignes = entries.map(e => {
    const d = new Date(e.date);
    const dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const heureStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const humeur = me[e.mood] || '—';
    return `${dateStr} à ${heureStr} ${humeur}\n${e.text || '—'}\n`;
  });

  const header = `Journal de ${D.g.userName || 'Habitgotchi'}\nExporté le ${new Date().toLocaleDateString('fr-FR')}\n${'─'.repeat(40)}\n\n`;
  const contenu = header + lignes.join('\n');

  // Téléchargement
  const blob = new Blob([contenu], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nomFichier;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── SYSTÈME 6 : INTROSPECTION & MÉMOIRE (Calendrier) ───────────── */

/* ============================================================
   PROGRESS
   ============================================================ */
/* Helper couleur — utilisé par hebdo ET mensuel */
function calColor(count, total, isToday) {
  const r   = total > 0 ? count / total : 0;

  // ── même dégradé que l'agenda/mois ──
  const g      = Math.round(180 + r * 60);
  const alpha  = r > 0 ? 0.15 + r * 0.6 : 0;
  let   bg     = r > 0 ? `rgba(80,${g},120,${alpha})` : 'rgba(0,0,0,0.03)';
  let   border = 'none';

  // Couronne lilac si 100%
  if (r >= 1) border = '2px solid var(--lilac)';
  // Contour lilac aujourd'hui même si vide
  if (isToday && count === 0) border = '2px solid var(--lilac)';

  return { bg, border };
}

function renderProg() {
  const D  = window.D;
  const wd = getWkDates(wOff);
  const wt = document.getElementById('w-title');
  if (!wt) return;

  /* ── Titre semaine ── */
  if (wOff === 0) {
    wt.textContent = 'Cette semaine';
  } else {
    const a = new Date(wd[0]), b = new Date(wd[6]);
    wt.textContent = `${a.getDate()}/${a.getMonth()+1} — ${b.getDate()}/${b.getMonth()+1}`;
  }

  /* ── Calendrier hebdomadaire ── */
  const total = D.habits.length || 6;

  document.getElementById('w-view').innerHTML = wd.map(ds => {
    const log   = D.log[ds] || [];
    const isT   = ds === today();
    const { bg, border } = calColor(log.length, total, isT);
    const day   = new Date(ds + 'T12:00').getDate();
    return `<div class="cal-c" style="background:${bg};border:${border};cursor:pointer" onclick="showDayDetail('${ds}')">${day}</div>`;
  }).join('');

  /* ── Visibilité de la card bilan selon la semaine ── */
  // RÔLE : Cache toute la zone bilan IA quand on consulte une semaine passée.
  // POURQUOI : Le bilan ne concerne que la semaine en cours — afficher la zone sur les
  //            semaines passées est trompeur et inutile.
  const cardBilan = document.getElementById('card-bilan');
  if (cardBilan) cardBilan.style.display = wOff === 0 ? '' : 'none';

  /* ── Titre bilan ── */
  const bilanTitre = document.getElementById('bilan-titre');
  if (bilanTitre) {
    const debut = new Date(wd[0] + 'T12:00');
    const fin   = new Date(wd[6] + 'T12:00');
    const fmt   = d => `${d.getDate()} ${d.toLocaleDateString('fr-FR', { month: 'short' })}`;
    const prenom = D.g.userName || D.userName || 'toi';
    bilanTitre.innerHTML = `🌼 Bilan pour ${prenom}<br><span style="font-size:var(--fs-xs);font-weight:normal;color:var(--text2)">semaine du ${fmt(debut)} au ${fmt(fin)}</span>`;
  }

  /* ── Restauration bilan persisté ── */
  const savedBilan = window.D.g.bilanText || '';
  const summaryRestore = document.getElementById('claude-summary');
  if (summaryRestore && savedBilan) {
    summaryRestore.textContent = savedBilan;
    const hidRestore = document.getElementById('bil-txt-hidden');
    if (hidRestore) hidRestore.value = savedBilan;
    document.getElementById('btn-copy-bilan').style.display = 'block';
  }

  /* ── État bouton bilan ── */
  // RÔLE : Met à jour le label et l'état du bouton bilan selon la semaine et le quota.
  // POURQUOI : Le bouton utilise deux spans (#bilan-btn-label + #bilan-flowers) pour séparer
  //            le texte des fleurs — on ne touche jamais à textContent du bouton entier.
  checkBilanReset();
  const btnBilan   = document.querySelector('[onclick="genBilanSemaine()"]');
  const lblBilan   = document.getElementById('bilan-btn-label');
  // La card bilan est masquée sur les semaines passées (voir ci-dessus),
  // donc on arrive ici uniquement quand wOff === 0.
  if (btnBilan && lblBilan) {
    const jourSemaine   = new Date().getDay();
    const estFinSemaine = jourSemaine === 0 || jourSemaine === 5 || jourSemaine === 6;
    const quotaOk       = (window.D.g.bilanCount || 0) < 3;

    if (!estFinSemaine) {
      btnBilan.disabled      = true;
      lblBilan.textContent   = '⏳ Disponible vendredi';
      btnBilan.style.opacity = '0.5';
    } else if (!quotaOk) {
      btnBilan.disabled      = true;
      lblBilan.textContent   = '✓ 3 bilans générés cette semaine';
      btnBilan.style.opacity = '0.5';
    } else {
      btnBilan.disabled      = false;
      lblBilan.textContent   = '✿ Générer le bilan';
      btnBilan.style.opacity = '1';
    }
  }
  updBilanFlowers(); // met à jour les 3 fleurs de quota

  updUI();
}

function showDayDetail(ds) {
  ouvrirAgenda(ds);
}

/* ─── SYSTÈME 7 : INGÉNIERIE (Paramètres et Sauvegardes) ─────────── */

/* ============================================================
   RÉGLAGES
   ============================================================ */
function saveName() {
  const n = document.getElementById('name-inp').value.trim();
  if (n) { window.D.g.name = n; save(); updUI(); }
}
function saveApi() {
  const v = document.getElementById('api-inp').value.trim();
  window.D.apiKey = v; save();
  if (v) toast(`Je me souviens de ta clé, promis 🔑 ✿`); else toast(`Clé oubliée... *soupir* ✿`);
}
function savePin() {
  const ancien = document.getElementById('pin-ancien').value.trim();
  const nouveau = document.getElementById('pin-inp').value.trim();

  if (!window.D.pin && nouveau.length === 4 && /^\d+$/.test(nouveau)) {
    // Cas : pas encore de PIN défini
    window.D.pin = nouveau; save();
    document.getElementById('pin-ancien').value = '';
    document.getElementById('pin-inp').value = '';
    toast('PIN créé ✿'); return;
  }

  if (ancien !== window.D.pin) { toast('Ancien PIN incorrect ✕'); return; }
  if (nouveau.length !== 4 || !/^\d+$/.test(nouveau)) { toast('4 chiffres requis'); return; }

  window.D.pin = nouveau; save();
  document.getElementById('pin-ancien').value = '';
  document.getElementById('pin-inp').value = '';
  toast('PIN mis à jour ✿');
}
function exportD() {
  const b = new Blob([JSON.stringify(window.D, null, 2)], {type:'application/json'});
  const u = URL.createObjectURL(b), a = document.createElement('a');
  a.href = u; a.download = `habitgotchi_${today()}.json`; a.click();
  URL.revokeObjectURL(u);
}
function importD(event) {
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);

      // RÔLE : détecte si c'est un export journal partiel ou une sauvegarde complète
      // POURQUOI : exportJournal() produit { exportDate, journal } — pas un D complet
      const isJournalOnly = imported.exportDate && imported.journal && !imported.g;

      if (isJournalOnly) {
        // Fusion du journal uniquement — ne touche pas au reste de D
        const existing = window.D.journal || [];
        const merged = [...imported.journal];
        existing.forEach(e => {
          if (!merged.find(j => j.date === e.date)) merged.push(e);
        });
        window.D.journal = merged.sort((a, b) => b.date.localeCompare(a.date));
        save();
        toast(`Journal restauré (${imported.journal.length} entrées) ✿`);
        setTimeout(() => location.reload(), 800);
      } else {
        // Sauvegarde complète
        window.D = { ...defs(), ...imported, g: { ...defs().g, ...imported.g } };
        save();
        toast(`Bienvenue de retour ${window.D.g.name} ! ✿`);
        setTimeout(() => location.reload(), 800);
      }
    } catch(err) {
      console.warn('[HabitGotchi] importD() échoué :', err);
      toast(`*perplexe* Ce fichier me semble bizarre... 💜`);
    }
  };
  reader.readAsText(file);
}

function confirmReset() {
  openModal(`<h3>Tout supprimer ?</h3><div style="display:flex;gap:6px;margin-top:10px"><button class="btn btn-s" onclick="clModal()" style="flex:1">Non</button><button class="btn btn-d" onclick="localStorage.removeItem('${SK}');location.reload()" style="flex:1">Oui</button></div>`);
}

/* ─── SYSTÈME 6 : INTROSPECTION & MÉMOIRE (Le Terminal) ──────────── */

/* ============================================================
   TABLETTE RÉTRO
   ============================================================ */
let tabletLastSeenDate = null; // ISO date du dernier événement vu à la dernière ouverture

function openTablet() {
  const D = window.D;
  const log = D.eventLog || [];
  
  // Icône choisie selon le type + signe de la valeur (gain/perte XP)
  const getIcon = (ev) => {
  // Le subtype prime sur le type s'il existe
  if (ev.subtype === 'snack') return '🍽️';
  if (ev.subtype === 'poop')  return '💩';
  if (ev.subtype === 'stade') return '🌱';
  
  // Sinon, fallback sur le type
  if (ev.type === 'xp')       return (ev.valeur < 0) ? '💤' : '⭐';
  if (ev.type === 'cadeau') return ev.emoji || '🎁';
  if (ev.type === 'habitude') return '✅';
  if (ev.type === 'note')     return '📓';
  return '•';
};
  
  const lines = document.getElementById('tablet-lines');

  if (!log.length) {
    lines.innerHTML = '<div class="tablet-line" style="color:#007a1f">// aucun événement enregistré</div>';
  } else {
    lines.innerHTML = log.map(ev => {
      const d = new Date(ev.date);
      const heure = d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
      const jour  = d.toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
      return `<div class="tablet-line">
        <span class="tl-time">${jour} à ${heure}</span>
        <span class="tl-icon">${getIcon(ev)}</span>${ev.label || ev.valeur}
      </div>`;
    }).join('');
  }

  // Masquer le badge + mémoriser la date du plus récent événement
  tabletLastSeenDate = log.length ? log[0].date : null;
  document.getElementById('tablet-badge').style.display = 'none';

  document.getElementById('tablet-overlay').classList.add('open');
}

function closeTablet(e) {
  // Ferme seulement si on clique sur le fond, pas sur la tablette
  if (e.target === document.getElementById('tablet-overlay')) {
    document.getElementById('tablet-overlay').classList.remove('open');
  }
}

function updTabletBadge() {
  const log = (window.D?.eventLog || []);
  const badge = document.getElementById('tablet-badge');
  if (!badge) return;
  
  // Badge visible si un événement est plus récent que la dernière ouverture
  const plusRecent = log[0]?.date;
  if (plusRecent && plusRecent !== tabletLastSeenDate) {
    badge.style.display = 'block';
  }
}

/* ─── SYSTÈME 7 : INGÉNIERIE (Déclencheurs d'Ouverture / Cheats) ─── */

/* ============================================================
   MODALE DE BIENVENUE
   ============================================================ */
function checkWelcome() {
  const D  = window.D;
  const td = today();
  const h  = hr();

  // 1. Premier lancement — priorité absolue
  // POURQUOI : on ne teste QUE !D.firstLaunch, pas le nom.
  // Tester D.g.name === 'Petit·e Gotchi' re-déclenchait le wizard après une mise à jour
  // si le localStorage avait été vidé ou si le merge avec defs() ramenait la valeur par défaut.
  if (!D.firstLaunch) {
    D.firstLaunch = new Date().toISOString();
    save();
    showWelcomeModal();
    return;
  }

  // 2. Anniversaire — affiché une fois par jour si USER_CONFIG le définit
  // RÔLE : Affiche une modale surprise le jour de l'anniversaire.
  // POURQUOI : La date et le message viennent de user_config.json — rien n'est hardcodé.
  //            Si birthday.month est null → ce bloc est ignoré entièrement.
  const bday = window.USER_CONFIG?.birthday;
  if (bday?.month && !D.g.birthdayShown) {
    const now = new Date();
    if (now.getMonth() + 1 === bday.month && now.getDate() === bday.day) {
      D.g.birthdayShown = true;
      save();
      document.getElementById('modal').style.display = 'flex';
      document.getElementById('mbox').innerHTML = `
        <div style="text-align:center;padding:var(--sp-sm)">
          <div style="font-size:40px">🎂</div>
          <p style="font-size:12px;color:var(--text);margin:12px 0;line-height:1.6;white-space:pre-line">${bday.message || 'Joyeux anniversaire 💜'}</p>
          <button class="btn btn-p" onclick="clModal()" style="margin-top:8px;width:100%">Merci 💜</button>
        </div>
      `;
      animEl(document.getElementById('mbox'), 'bounceIn');
      return;
    }
  }

  // 3. Garde anti-répétition : une seule fois par créneau
  const créneau = h < 12 ? 'matin' : h < 18 ? 'aprem' : h < 21 ? 'soir' : 'nuit';
  const done = (D.log[td] || []).length;
  const etatActuel = `${td}-${créneau}-${done}`;
  if (D.lastWelcomeState === etatActuel) return;

  // 4. Calcul jours d'absence (avant de mettre à jour lastActive)
  let joursAbsence = 0;
  if (D.lastActive) {
    const diff = Date.now() - new Date(D.lastActive);
    joursAbsence = Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  // 5. Cadeaux-IA reçus depuis la dernière visite (achats boutique exclus)
  const derniereVisite = D.lastActive || td;
  const nouveauxCadeaux = (D.eventLog || []).filter(ev =>
    ev.type === 'cadeau' &&
    ev.subtype === 'ia' &&
    new Date(ev.date) > new Date(derniereVisite)
  ).length;

  // 6. Mise à jour de la session
  D.lastWelcomeState = etatActuel;
  D.lastActive = new Date().toISOString();
  save();

  // ❌ SUPPRIMÉ : ancien `if (!D.firstLaunch…)` dupliqué — code mort

  // 7. Contenu selon contexte
  let titre, corps, extra = '';

  // ✏️ UNIFIÉ : pénalité unique pour toute absence ≥ 1 jour (-15 XP × jours)
  if (joursAbsence >= 1) {
    const xpPerdu = joursAbsence * XP_HABITUDE; // même valeur que l'XP d'une habitude
    addXp(-xpPerdu);
    addEvent({ type: 'xp', subtype: 'absence', valeur: -xpPerdu, label: `${joursAbsence} jour${joursAbsence > 1 ? 's' : ''} d'absence — -${xpPerdu} XP` });

    // Message doux pour 1 jour, plus marqué au-delà
    if (joursAbsence === 1) {
      titre = `Bienvenue 🌸`;
      corps = `Tu as perdu <strong>${XP_HABITUDE} XP</strong> hier — pas d'habitudes cochées.`;
      flashBubble("Tu m'avais oubliée... 💜", 3000);
    } else {
      titre = `Ça fait ${joursAbsence} jours... 💜`;
      corps = `${D.g.name} t'a attendue. Tu as perdu <strong>${xpPerdu} XP</strong> pendant ton absence.`;
    }
  } else if (h >= 22 || h < 7) {
    titre = `*chuchote* 🌙`;
    corps = getNightMsg();
  } else if (h < 12) {
    titre = `Bon matin ☀️`;
    corps = getMorningMsg();
  } else if (h < 18) {
    titre = `Bon après-midi ✿`;
    corps = getAfternoonMsg();
  } else {
    titre = `Bonne soirée 🌙`;
    corps = getEveningMsg();
  }

  if (nouveauxCadeaux > 0) {
    extra = `<p style="margin-top:8px;font-size:12px;text-align:center">🎁 ${nouveauxCadeaux} nouveau${nouveauxCadeaux > 1 ? 'x cadeaux' : ' cadeau'} depuis ta dernière visite !</p>`;
  }

  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `
    <div style="text-align:center">
      <h3>${titre}</h3>
      <p style="font-size:12px;margin:8px 0">${corps}</p>
      ${extra}
      <button class="btn btn-p" style="width:100%;margin-top:10px" onclick="clModal()">C'est parti ✿</button>
    </div>
  `;
  animEl(document.getElementById('mbox'), 'bounceIn');
}

function getMorningMsg() {
  const D = window.D;
  const str = calcStr();
  const name = D.g.name;
  if (str >= 7) return `*s'étire* ${str} jours de suite... tu m'impressionnes 🔥`;
  if (str >= 3) return `${str} jours d'affilée ! On continue ? 💜`;
  return `Coucou ${D.g.userNickname || D.userName || 'toi'} ! Je t'attendais 🌸`;
}

function getAfternoonMsg() {
  const D = window.D;
  const done = (D.log[today()] || []).length;
  const name = D.g.name;
  if (done >= 4) return `${done} habitudes déjà ! Je suis fier·e de toi 🌟`;
  if (done >= 1) return `${done} cochée${done > 1 ? 's' : ''} — tu avances bien ✿`;
  return `*te regarde* Il reste encore du temps pour aujourd'hui 💜`;
}

function getEveningMsg() {
  const D = window.D;
  const done = (D.log[today()] || []).length;
  const ha = D.g.happiness;
  if (done === 6) return `6/6 !! Tu as tout fait aujourd'hui, je suis aux anges 🎉`;
  if (ha <= 2) return `*câlin pixel* Tu sembles fatiguée ce soir. Prends soin de toi 💜`;
  if (done === 0) return `*te regarde doucement* Pas d'habitudes aujourd'hui... c'est ok. Demain ✿`;
  return `${done}/6 aujourd'hui. Pose-toi maintenant 💜`;
}

function getNightMsg() {
  const D = window.D;
  const done = (D.log[today()] || []).length;
  if (done === 6) return `*ronronne* Journée parfaite... dors bien 🌙`;
  if (done >= 3) return `*bâille* Bonne nuit ${D.g.userNickname || D.userName || 'toi'}... à demain 💜`;
  return `*murmure* Je veille. Dors bien 🌙`;
}

function showWelcomeModal() {
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `
    <h3 style="text-align:center">Bienvenue ✿</h3>
    <p style="font-size:12px;text-align:center;margin:8px 0">Comment s'appelle ton compagnon ?</p>
    <input id="welcome-name" class="inp" placeholder="Petit·e Gotchi" maxlength="20" style="text-align:center" autocomplete="off">
    <button class="btn btn-p" style="width:100%;margin-top:10px" onclick="confirmWelcome()">C'est parti 🌟</button>
  `;
  animEl(document.getElementById('mbox'), 'bounceIn');
  setTimeout(() => document.getElementById('welcome-name')?.focus(), 100);
}

function confirmWelcome() {
  const val = document.getElementById('welcome-name')?.value.trim();
  if (val) window.D.g.name = val;
  save();
  updUI();
  clModal();
}

/**
 * Console Développeur cachée : "Cheat Codes" pour tester l'application
 */
function applyCheatCode() {
  const input = document.getElementById('cheat-input');
  if (!input) return;
  const code = input.value.trim().toLowerCase();
  input.value = '';

  const codes = {
    'petales50':  () => { D.g.petales = (D.g.petales || 0) + 50; toast('🌸 +50 pétales !'); },
    'petales200': () => { D.g.petales = (D.g.petales || 0) + 200; toast('🌸 +200 pétales !'); },
    'egg':        () => { D.g.totalXp = 0;   D.g.stage = 'egg';   toast('🥚 Stade → Œuf'); },
    'baby':       () => { D.g.totalXp = 90;  D.g.stage = 'baby';  toast('🌱 Stade → Baby'); },
    'teen':       () => { D.g.totalXp = 240; D.g.stage = 'teen';  toast('🌿 Stade → Teen'); },
    'adult':      () => { D.g.totalXp = 500; D.g.stage = 'adult'; toast('🌸 Stade → Adulte'); },
    'vent':       () => { window.meteoData = { windspeed: 50 }; toast('🌬️ Vent activé !'); },
    'calme':      () => { window.meteoData = { windspeed: 5 };  toast('☀️ Vent désactivé'); },
    'happy5':     () => { D.g.happiness = 5; toast('😊 Bonheur → 5'); },
    'happy1':     () => { D.g.happiness = 1; toast('😔 Bonheur → 1'); },
    'energy5':    () => { D.g.energy = 5;    toast('⚡ Énergie → 5'); },
    'reset3':     () => { D.thoughtCount = 0; toast('💭 Compteur pensées → 0'); },
    'caca3':    () => { D.g.poops = [...(D.g.poops || []), {x:80,y:120}, {x:110,y:130}, {x:140,y:115}]; toast('💩 +3 cacas !'); },
    'resetfood':() => { D.g.snackDone = ''; D.g.snackEmoji = ''; toast('🍎 Nourriture remise à zéro'); },
    'resetcaca':() => { D.g.poopCount = 0; D.g.poopDay = ''; D.g.poops = []; toast('💩 Quota caca remis à zéro'); },
    'nuit':   () => { window._forceHour = 23; toast('🌙 Heure forcée → 23h'); },
    'jour':   () => { window._forceHour = null; toast('☀️ Heure réelle restaurée'); },
    'resetpin': () => { D.pin = null; toast('🔓 Code PIN supprimé'); },
    'resetbilan':   () => { D.g.bilanCount = 0; D.g.bilanWeek = ''; toast('📊 Quota bilan → 0/3'); },
    'resetsoutien': () => { D.soutienCount = 0; D.lastSoutienDate = null; toast('💜 Quota soutien → 0/3'); },
    'resetmsg3':    () => { D.thoughtCount = 0; D.lastThoughtDate = null; toast('💬 Quota pensées → 0/3'); },
    // RÔLE : Code cheat anniversaire — offre des pétales et remet les compteurs à zéro.
    // POURQUOI : Le mot de passe et le bonus viennent de user_config.json.
    //            Si birthday.month est null → le code n'existe pas, toast "Code inconnu".
    [window.USER_CONFIG?.birthday?.cheatCode]: window.USER_CONFIG?.birthday?.month
      ? () => {
          if (D.g.birthdayCodeUsed) { toast('Ce code a déjà été utilisé 🌸'); return; }
          D.g.birthdayCodeUsed = true;
          D.g.petales = (D.g.petales || 0) + (window.USER_CONFIG.birthday.petalesBonus || 50);
          D.g.snackDone = ''; D.g.snackEmoji = '';
          D.g.poops = []; D.g.poopCount = 0; D.g.poopDay = '';
          window.D.lastThoughtDate = null; window.D.thoughtCount = 0;
          toast(`🎂 Cadeau activé ! +${window.USER_CONFIG.birthday.petalesBonus || 50} pétales 🌸`);
        }
      : undefined,
  };

  if (codes[code]) {
    codes[code]();
    save(); updUI();
  } else {
    toast('❓ Code inconnu');
  }
}

/* ============================================================
   MODALE AGENDA
   ============================================================ */

window._agendaJour = null;

function ouvrirAgenda(dateStr) {
  window._agendaJour = dateStr || today();

  const mbox = document.getElementById('mbox');
  const modal = document.getElementById('modal');

  // 1. Nettoie les classes d'un éventuel précédent affichage
  mbox.classList.remove('shop-open', 'shop-catalogue', 'agenda-open');

  // 2. Prépare le contenu
mbox.innerHTML = `
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
    <h3 style="font-size:13px;color:var(--lilac)">🗓️ Mon Agenda</h3>
    <button onclick="fermerAgenda()" style="background:none;border:none;font-size:16px;cursor:pointer;color:var(--text2)">✕</button>
  </div>
  <div style="display:flex;gap:6px;margin-bottom:14px;background:rgba(0,0,0,0.05);border-radius:20px;padding:3px">
    <button onclick="switchAgenda('jour')" id="atab-jour"
      style="flex:1;padding:7px;border-radius:var(--r-lg);border:none;font-size:var(--fs-sm);
      cursor:pointer;font-weight:bold;font-family:'Courier New',monospace;transition:.15s">
      📅 Jour
    </button>
    <button onclick="switchAgenda('mois')" id="atab-mois"
      style="flex:1;padding:7px;border-radius:var(--r-lg);border:none;font-size:var(--fs-sm);
      cursor:pointer;font-weight:bold;font-family:'Courier New',monospace;transition:.15s">
      🗓️ Mois
    </button>
    ${showCycle() ? `
    <button onclick="switchAgenda('cycle')" id="atab-cycle"
      style="flex:1;padding:7px;border-radius:var(--r-lg);border:none;font-size:var(--fs-sm);
      cursor:pointer;font-weight:bold;font-family:'Courier New',monospace;transition:.15s">
      🌸 Cycle
    </button>` : ''}
  </div>
  <div id="agenda-contenu"></div>
`;
// 3. Force un reflow pour redéclencher l'animation shopOpen
void mbox.offsetWidth;
// 4. Applique les classes (anime + scroll interne)
mbox.classList.add('shop-open', 'agenda-open');
// 5. Affiche la modale
lockScroll();
modal.style.display = 'flex';
animEl(mbox, 'bounceIn');
switchAgenda('jour');
}

function fermerAgenda() {
  document.getElementById('dynamic-zone').style.overflowY = '';
  clModal();
}

function chevron(dir) {
  // Points du chevron : "droite" pointe vers la droite (>), "gauche" pointe vers la gauche (<)
  const points = dir === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6';
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="var(--lilac)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
    style="display:block">
    <polyline points="${points}"/>
  </svg>`;
}

function switchAgenda(onglet) {
  ['jour','mois', ...(showCycle() ? ['cycle'] : [])].forEach(o => {
    const btn = document.getElementById('atab-' + o);
    if (!btn) return;
    btn.style.background  = o === onglet ? '#fff' : 'transparent';
    btn.style.color       = o === onglet ? 'var(--lilac)' : 'var(--text2)';
    btn.style.boxShadow   = o === onglet ? '0 1px 4px rgba(0,0,0,.1)' : 'none';
  });

  const el = document.getElementById('agenda-contenu');
  if (!el) return;
  if (onglet === 'jour')  renderAgendaJour(el);
  if (onglet === 'mois')  renderAgendaMois(el);
  if (onglet === 'cycle') renderAgendaCycle(el);
}

/* ─── PANNEAU 1 : JOUR ─────────────────────────────────────── */


function getRdvDuJour(ds) {
  return (window.D.rdv || []).filter(r => {
    if (!r.recurrence || r.recurrence === 'aucune') {
      return r.date === ds;
    }
    if (ds < r.date) return false;
    if (r.exceptions && r.exceptions.includes(ds)) return false; // ← ajouté
    if (r.duree && ds > r.duree) return false;

    const debut = new Date(r.date + 'T12:00');
    const cible = new Date(ds  + 'T12:00');

    if (r.recurrence === 'hebdo') {
      const diffJ = Math.round((cible - debut) / 86400000);
      return diffJ % 7 === 0;
    }
    if (r.recurrence === 'mensuelle') {
      return debut.getDate() === cible.getDate()
          && (cible.getFullYear() * 12 + cible.getMonth())
           > (debut.getFullYear()  * 12 + debut.getMonth() - 1);
    }
    if (r.recurrence === 'annuelle') {
      return debut.getDate()  === cible.getDate()
          && debut.getMonth() === cible.getMonth()
          && cible.getFullYear() >= debut.getFullYear();
    }
    return false;
  });
}

function renderAgendaJour(el) {
  const D     = window.D;
  const ds    = _agendaJour;
  const date  = new Date(ds + 'T12:00');
  const jours = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  const mois  = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  const titre = `${jours[date.getDay()]} ${date.getDate()} ${mois[date.getMonth()]} ${date.getFullYear()}`;

  // Phase cycle
  const phase = getCyclePhase(ds);
  const phaseHtml = phase
    ? `<div style="display:inline-block;padding:4px 10px;border-radius:20px;font-size:var(--fs-sm);
        font-weight:bold;background:${phase.couleur}22;color:${phase.couleur};
        border:1px solid ${phase.couleur}55;margin-bottom:16px">
        ${phase.label} · J${phase.j}
       </div>`
    : '';

  // Habitudes
  const log = D.log[ds] || [];
  const habsHtml = log.length
    ? log.map(catId => {
        const hab = D.habits.find(h => h.catId === catId);
        return hab
          ? `<div style="padding:var(--sp-sm) 10px;border-radius:var(--r-sm);font-size:var(--fs-sm);
              background:rgba(255,255,255,0.7);border:1px solid var(--border);
              margin-bottom:5px">✅ ${hab.label}</div>`
          : '';
      }).join('')
    : `<div style="font-size:var(--fs-sm);color:var(--text2);font-style:italic;padding:6px 0">Aucune habitude ce jour</div>`;

  // Note journal
  const note = (D.journal || []).find(n => n.date && n.date.startsWith(ds));
  const noteHtml = note
    ? `<button onclick="ouvrirJournalAuJour('${ds}')"
        style="width:100%;text-align:left;padding:10px 12px;border-radius:var(--r-md);
        border:1.5px solid var(--lilac);background:rgba(var(--lilac-rgb, 180,160,230),0.07);
        font-size:var(--fs-sm);cursor:pointer;color:var(--lilac);font-family:'Courier New',monospace;
        display:flex;align-items:center;justify-content:space-between">
        <span>📓 Voir la note du journal</span>
        <span style="opacity:.6">→</span>
       </button>`
    : `<div style="font-size:var(--fs-sm);color:var(--text2);font-style:italic;padding:6px 0">Aucune note ce jour</div>`;

  // Rendez-vous
  const rdvDuJour = getRdvDuJour(ds).sort((a,b) => (a.heure||'') > (b.heure||'') ? 1 : -1);
  const rdvHtml = rdvDuJour.map(r => `
    <div id="rdv-item-${r.id}" style="display:flex;align-items:center;justify-content:space-between;
      padding:var(--sp-sm) 10px;border-radius:var(--r-sm);background:#fff;
      border:1px solid var(--border);margin-bottom:5px">
      <span style="font-size:var(--fs-sm);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px;display:inline-block">${r.heure ? `<b>${escape(r.heure)}</b> · ` : '🗓️ Journée · '}${escape(r.label)}</span>
      <div style="display:flex;gap:6px">
        <button onclick="editerRdv('${r.id}')" style="background:none;border:none;cursor:pointer;font-size:13px">✏️</button>
        <button onclick="confirmerSuppressionRdv('${r.id}')" style="background:none;border:none;cursor:pointer;font-size:13px">🗑️</button>
      </div>
    </div>`).join('');

  el.innerHTML = `
    <!-- Navigation date -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <button onclick="navAgendaJour(-1)"
        style="background:none;border:none;cursor:pointer;padding:4px;display:flex;align-items:center">
        ${chevron('left')}
      </button>
      <span style="font-size:12px;font-weight:bold;font-family:'Courier New',monospace;
        text-align:center;color:var(--lilac);flex:1">
        ${titre}
      </span>
      <button onclick="navAgendaJour(1)"
        style="background:none;border:none;cursor:pointer;padding:4px;display:flex;align-items:center">
        ${chevron('right')}
      </button>
    </div>

    ${phaseHtml}

    <!-- Habitudes -->
    <div style="margin-bottom:20px">
      <h3 style="font-size:var(--fs-sm);color:var(--text2);letter-spacing:1.5px;margin-bottom:var(--sp-sm);text-transform:uppercase">Habitudes</h3>
      ${habsHtml}
    </div>

    <!-- Note journal -->
    <div style="margin-bottom:20px">
      <h3 style="font-size:var(--fs-sm);color:var(--text2);letter-spacing:1.5px;margin-bottom:var(--sp-sm);text-transform:uppercase">Journal</h3>
      ${noteHtml}
    </div>

    <!-- Rendez-vous -->
    <div style="margin-bottom:var(--sp-md)">
      <h3 style="font-size:var(--fs-sm);color:var(--text2);letter-spacing:1.5px;margin-bottom:var(--sp-sm);text-transform:uppercase">Rendez-vous</h3>
      ${rdvHtml}
      <button onclick="afficherFormulaireRdv()" id="btn-add-rdv"
        style="width:100%;padding:9px;border-radius:var(--r-md);
        border:1.5px solid var(--lilac);background:transparent;
        font-size:var(--fs-sm);cursor:pointer;color:var(--lilac);
        font-family:'Courier New',monospace;margin-top:4px;
        opacity:0.75;transition:opacity .15s"
        onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='.75'">
        + Ajouter un rendez-vous
      </button>
      <div id="form-rdv" style="display:none"></div>
    </div>
  `;
}

function navAgendaJour(dir) {
  const d = new Date(_agendaJour + 'T12:00');
  d.setDate(d.getDate() + dir);
  _agendaJour = d.toISOString().split('T')[0];

  // 🔁 Synchro vue Mois
  const now = new Date();
  _agendaMoisOffset = (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());

  renderAgendaJour(document.getElementById('agenda-contenu'));
}

function afficherFormulaireRdv() {
  document.getElementById('btn-add-rdv').style.display = 'none';

  const overlay = document.createElement('div');
  overlay.id = 'rdv-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:1000;
    background:rgba(0,0,0,0.35);
    display:flex;align-items:flex-end;justify-content:center;
  `;

  const emojis = [
    {e:'🩺',l:'Médecin'}, {e:'🦷',l:'Dentiste'}, {e:'👁️',l:'Ophtalmo'},
    {e:'💆',l:'Kiné'}, {e:'🧠',l:'Psy'}, {e:'🩸',l:'Analyse'},
    {e:'💉',l:'Vaccin'}, {e:'🤰',l:'Gynéco'}, {e:'🐾',l:'Véto'},
    {e:'🎂',l:'Anniversaire'}, {e:'🎬',l:'Cinéma'}, {e:'🍽️',l:'Restaurant'},
    {e:'✈️',l:'Voyage'}, {e:'📋',l:'Admin'}, {e:'🏃',l:'Sport'},
    {e:'💛',l:'Perso'}, {e:'🎉',l:'Fête'}, {e:'📚',l:'Formation'}
  ];

  overlay.innerHTML = `
    <div id="rdv-sheet" style="
      background:var(--bg,#fff);border-radius:var(--r-lg) 16px 0 0;
      padding:20px 16px 32px;width:100%;max-width:420px;
      animation:slideUp .25s ease-out;
    ">
      <div style="width:36px;height:4px;background:var(--border);
        border-radius:2px;margin:0 auto 16px;opacity:.5"></div>
      <h3 style="font-size:12px;color:var(--lilac);margin-bottom:14px;
        font-family:'Courier New',monospace">📅 Nouveau rendez-vous</h3>

      <!-- Emojis sur 2 lignes -->
      <div style="display:grid;grid-template-columns:repeat(9,1fr);gap:5px;margin-bottom:var(--sp-md)">
        ${emojis.map(({e,l}) => `
          <button onclick="selectionnerEmoji('${e}', this)"
            title="${l}"
            style="aspect-ratio:1;border-radius:var(--r-sm);border:1.5px solid var(--border);
            background:#fff;font-size:15px;cursor:pointer;transition:.15s;
            display:flex;align-items:center;justify-content:center"
            data-emoji="${e}">${e}</button>
        `).join('')}
      </div>

      <!-- Label -->
      <input id="rdv-label" class="inp" placeholder="Libellé du rendez-vous..." style="margin-bottom:var(--sp-sm)">

      <!-- Heure -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:var(--sp-sm)">
        <input type="time" id="rdv-heure" class="inp" style="flex:1">
        <label style="display:flex;align-items:center;gap:4px;font-size:var(--fs-sm);
          color:var(--text2);white-space:nowrap;cursor:pointer">
          <input type="checkbox" id="rdv-journee" onchange="toggleJourneeEntiere(this.checked)">
          Journée entière
        </label>
      </div>

<!-- Récurrence -->
<div style="margin-bottom:var(--sp-sm)">
  <div style="font-size:var(--fs-sm);color:var(--text2);letter-spacing:1px;
    text-transform:uppercase;margin-bottom:6px">Récurrence</div>
  <div style="display:flex;gap:6px">
    ${[
      {v:'aucune',    l:'1×'},
      {v:'hebdo',     l:'🔁 Hebdo'},
      {v:'mensuelle', l:'🔁 Mensuel'},
      {v:'annuelle',  l:'🔁 Annuel'}
    ].map(r => `
      <button onclick="selectionnerRecurrence('${r.v}', this)"
        data-rec="${r.v}"
        style="flex:1;padding:7px;border-radius:var(--r-sm);font-size:var(--fs-sm);
        font-family:'Courier New',monospace;cursor:pointer;transition:.15s;
        border:1.5px solid var(--border);background:#fff;color:var(--text2)">
        ${r.l}
      </button>
    `).join('')}
  </div>
</div>

      <!-- Durée (masquée si aucune récurrence) -->
      <div id="rdv-duree-wrap" style="display:none;margin-bottom:14px">
        <div style="font-size:var(--fs-sm);color:var(--text2);letter-spacing:1px;
          text-transform:uppercase;margin-bottom:6px">Pendant</div>
        <div style="display:flex;gap:6px">
          ${[
{l:'Sans fin', v:'infini'},
{l:'3 mois',  v:'3'},
{l:'6 mois',  v:'6'},
{l:'1 an',    v:'12'},
{l:'2 ans',   v:'24'}
          ].map(d => `
            <button onclick="selectionnerDuree('${d.v}', this)"
              data-duree="${d.v}"
              style="flex:1;padding:7px;border-radius:var(--r-sm);font-size:var(--fs-sm);
              font-family:'Courier New',monospace;cursor:pointer;transition:.15s;
              border:1.5px solid var(--border);background:#fff;color:var(--text2)">
              ${d.l}
            </button>
          `).join('')}
        </div>
      </div>

      <div style="display:flex;gap:8px">
        <button class="btn btn-s" onclick="annulerFormulaireRdv()" style="flex:1">Annuler</button>
        <button class="btn btn-p" onclick="sauvegarderRdv()" style="flex:1">Enregistrer</button>
      </div>
    </div>
  `;

  overlay.addEventListener('click', e => {
    if (e.target === overlay) annulerFormulaireRdv();
  });

  document.body.appendChild(overlay);
  selectionnerRecurrence('aucune', overlay.querySelector('[data-rec="aucune"]'));
}

function selectionnerEmoji(e, btn) {
  // Désélectionne tous
  document.querySelectorAll('#rdv-sheet [data-emoji]').forEach(b => {
    b.style.background = '#fff';
    b.style.borderColor = 'var(--border)';
  });
  // Sélectionne celui cliqué
  btn.style.background = 'var(--lilac)22';
  btn.style.borderColor = 'var(--lilac)';
  window._rdvEmoji = e;
}

function selectionnerRecurrence(r, btn) {
  document.querySelectorAll('#rdv-sheet [data-rec]').forEach(b => {
    b.style.background   = '#fff';
    b.style.borderColor  = 'var(--border)';
    b.style.color        = 'var(--text2)';
  });
  btn.style.background  = 'var(--lilac)22';
  btn.style.borderColor = 'var(--lilac)';
  btn.style.color       = 'var(--lilac)';
  window._rdvRecurrence = r;

  // Affiche/masque le sélecteur de durée
  const dureeWrap = document.getElementById('rdv-duree-wrap');
  if (dureeWrap) {
    dureeWrap.style.display = r === 'aucune' ? 'none' : 'block';
    // Sélectionne 6 mois par défaut
    if (r !== 'aucune' && !window._rdvDuree) {
      const btnSansFin = dureeWrap.querySelector('[data-duree="infini"]');
if (btnSansFin) selectionnerDuree('infini', btnSansFin);
    }
  }
}

function selectionnerDuree(v, btn) {
  document.querySelectorAll('#rdv-sheet [data-duree]').forEach(b => {
    b.style.background  = '#fff';
    b.style.borderColor = 'var(--border)';
    b.style.color       = 'var(--text2)';
  });
  btn.style.background  = 'var(--lilac)22';
  btn.style.borderColor = 'var(--lilac)';
  btn.style.color       = 'var(--lilac)';
  window._rdvDuree = v; // 'infini', '3', '6', '12', '24' — juste la string
}

function annulerFormulaireRdv() {
  document.getElementById('rdv-overlay')?.remove();
  const btn = document.getElementById('btn-add-rdv');
  if (btn) btn.style.display = 'block';
}

function sauvegarderRdv() {
  const labelInput = document.getElementById('rdv-label');
  const label      = labelInput.value.trim();
  if (!label) {
    // RÔLE : Signale visuellement que le champ titre est obligatoire
    labelInput.style.borderColor = 'var(--coral)';
    labelInput.placeholder = 'Obligatoire ✦';
    labelInput.focus();
    // POURQUOI : reset après 2s pour ne pas laisser l'erreur affichée indéfiniment
    setTimeout(() => {
      labelInput.style.borderColor = '';
      labelInput.placeholder = 'Libellé du rendez-vous...';
    }, 2000);
    return;
  }
  // POURQUOI : reset la bordure si la validation passe après une erreur
  labelInput.style.borderColor = '';
  const heure      = document.getElementById('rdv-heure').value || null;
  const emoji      = window._rdvEmoji || null;
  const recurrence = window._rdvRecurrence || 'aucune';
  const dureeBrute = window._rdvDuree;

  let duree = null;
  if (dureeBrute && dureeBrute !== 'infini') {
    const fin = new Date(_agendaJour + 'T12:00');
    console.log('agendaJour:', _agendaJour, '| fin valide?', !isNaN(fin), '| dureeBrute:', dureeBrute, '| parseInt:', parseInt(dureeBrute));
    fin.setMonth(fin.getMonth() + parseInt(dureeBrute));
    duree = fin.toISOString().split('T')[0];
  }

  const labelFinal = (emoji ? `${emoji} ${label}` : label).slice(0, 40);

  window.D.rdv = window.D.rdv || [];
  window.D.rdv.push({
    id: Date.now().toString(),
    date: _agendaJour,
    label: labelFinal,
    heure,
    recurrence,
    duree
  });

  window._rdvEmoji      = null;
  window._rdvRecurrence = 'aucune';
  window._rdvDuree      = null;

  save();
  annulerFormulaireRdv();
  renderAgendaJour(document.getElementById('agenda-contenu'));
}

function toggleJourneeEntiere(checked) {
  const heureInput = document.getElementById('rdv-heure');
  if (!heureInput) return;
  heureInput.disabled = checked;
  heureInput.style.opacity = checked ? '0.4' : '1';
  if (checked) heureInput.value = '';
}

function supprimerRdv(id) {
  window.D.rdv = (window.D.rdv || []).filter(r => r.id !== id);
  save();
  renderAgendaJour(document.getElementById('agenda-contenu'));
}

function confirmerSuppressionRdv(id) {
  // RÔLE : Ferme une confirmation déjà ouverte avant d'en ouvrir une nouvelle
  document.getElementById('confirm-inline')?.remove();

  const rdv = (window.D.rdv || []).find(r => r.id === id);
  if (!rdv) return;
  const isRecurrent = rdv.recurrence && rdv.recurrence !== 'aucune';

  // RÔLE : Insère la confirmation juste sous le bloc du RDV concerné
  // POURQUOI : insertAdjacentHTML afterend = juste après l'élément, pas en haut de la liste
  const anchor = document.getElementById(`rdv-item-${id}`);
  const target = anchor || document.getElementById('agenda-contenu');
  const method = anchor ? 'afterend' : 'afterbegin';

  target.insertAdjacentHTML(method, `
    <div id="confirm-inline" style="background:#fff8f8;border:2px solid var(--coral);
      border-radius:var(--r-md);padding:10px;margin-bottom:6px;text-align:center">
      <div style="font-size:var(--fs-sm);margin-bottom:var(--sp-sm)">
        Supprimer <b>${rdv.label}</b> ?
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-s" onclick="fermerConfirmInline()" style="flex:1">Annuler</button>
        <button class="btn btn-d" onclick="supprimerRdv('${id}');fermerConfirmInline()" style="flex:1">
          ${isRecurrent ? 'Ce rendez-vous' : 'Supprimer'}
        </button>
        ${isRecurrent ? `
        <button class="btn btn-d" onclick="supprimerRdvSuivants('${id}');fermerConfirmInline()" style="flex:1;white-space:nowrap">
          Celui-ci et les suivants
        </button>` : ''}
      </div>
    </div>`);
}

function supprimerRdvSuivants(id) {
  const idx = (window.D.rdv || []).findIndex(r => r.id === id);
  if (idx === -1) return;
  // La date de fin = la veille du jour affiché
  const veille = new Date(_agendaJour + 'T12:00');
  veille.setDate(veille.getDate() - 1);
  window.D.rdv[idx].duree = veille.toISOString().split('T')[0];
  save();
  renderAgendaJour(document.getElementById('agenda-contenu'));
}

function confirmerSuppressionCycle(ds, btn) {
  // RÔLE : Ferme une confirmation déjà ouverte avant d'en ouvrir une nouvelle
  document.getElementById('confirm-inline')?.remove();

  const date = new Date(ds + 'T12:00');
  const fmt  = date.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });

  // RÔLE : Insère la confirmation juste sous la ligne du cycle concerné
  // POURQUOI : on remonte au parent de la ligne (.j1-ligne) via closest ou parentElement
  const anchor = btn?.closest('[style*="border-bottom"]') || btn?.parentElement?.parentElement;
  const target = anchor || document.getElementById('agenda-contenu');
  const method = anchor ? 'afterend' : 'afterbegin';

  target.insertAdjacentHTML(method, `
    <div id="confirm-inline" style="background:#fff8f8;border:2px solid var(--coral);
      border-radius:var(--r-md);padding:10px;margin-bottom:6px;text-align:center">
      <div style="font-size:var(--fs-sm);margin-bottom:var(--sp-sm)">
        Supprimer le cycle du <b>${fmt}</b> ?
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-s" onclick="fermerConfirmInline()" style="flex:1">Annuler</button>
        <button class="btn btn-d" onclick="supprimerCycle('${ds}');fermerConfirmInline()" style="flex:1">Supprimer</button>
      </div>
    </div>`);
}

function fermerConfirmInline() {
  document.getElementById('confirm-inline')?.remove();
}

function editerRdv(id) {
  const rdv = (window.D.rdv || []).find(r => r.id === id);
  if (!rdv) return;

  const isRecurrent = rdv.recurrence && rdv.recurrence !== 'aucune';
  window._editRdvId = id;

  const overlay = document.createElement('div');
  overlay.id = 'rdv-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:1000;
    background:rgba(0,0,0,0.35);
    display:flex;align-items:flex-end;justify-content:center;
  `;

  overlay.innerHTML = `
    <div id="rdv-sheet" style="
      background:var(--bg,#fff);border-radius:var(--r-lg) 16px 0 0;
      padding:20px 16px 32px;width:100%;max-width:420px;
      animation:slideUp .25s ease-out;
    ">
      <div style="width:36px;height:4px;background:var(--border);
        border-radius:2px;margin:0 auto 16px;opacity:.5"></div>
      <h3 style="font-size:12px;color:var(--lilac);margin-bottom:14px;
        font-family:'Courier New',monospace">✏️ Modifier le rendez-vous</h3>

      <input id="rdv-label" class="inp"
        value="${rdv.label}"
        placeholder="Libellé..." style="margin-bottom:var(--sp-sm)">

      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
        <input type="time" id="rdv-heure" class="inp"
          value="${rdv.heure || ''}" style="flex:1">
        <label style="display:flex;align-items:center;gap:4px;font-size:var(--fs-sm);
          color:var(--text2);white-space:nowrap;cursor:pointer">
          <input type="checkbox" id="rdv-journee"
            ${!rdv.heure ? 'checked' : ''}
            onchange="toggleJourneeEntiere(this.checked)">
          Journée entière
        </label>
      </div>

      <div style="display:flex;gap:8px">
        <button class="btn btn-s" onclick="annulerFormulaireRdv()" style="flex:1">Annuler</button>
        ${isRecurrent ? `
          <button class="btn btn-p" onclick="confirmerEditRdv('ce')" style="flex:1">
            Ce rendez-vous
          </button>
          <button class="btn btn-p" onclick="confirmerEditRdv('suivants')" style="flex:1">
            Celui-ci et les suivants
          </button>
        ` : `
          <button class="btn btn-p" onclick="confirmerEditRdv('simple')" style="flex:1">
            Enregistrer
          </button>
        `}
      </div>
    </div>
  `;

  overlay.addEventListener('click', e => {
    if (e.target === overlay) annulerFormulaireRdv();
  });

  document.body.appendChild(overlay);

  // Initialise l'état journée entière
  if (!rdv.heure) toggleJourneeEntiere(true);
}

function confirmerEditRdv(mode) {
  const label = document.getElementById('rdv-label').value.trim();
  if (!label) return;
  const heure = document.getElementById('rdv-heure').value || null;
  const id    = window._editRdvId;
  const rdv   = (window.D.rdv || []).find(r => r.id === id);
  if (!rdv) return;

  if (mode === 'simple') {
    // RDV ponctuel — modifie directement
    rdv.label = label;
    rdv.heure = heure;

  } else if (mode === 'ce') {
    // Crée une exception pour ce jour uniquement
    window.D.rdv.push({
      id: Date.now().toString(),
      date: _agendaJour,
      label, heure,
      recurrence: 'aucune'
    });
    // Ajoute ce jour dans les exceptions de l'entrée maîtresse
    rdv.exceptions = rdv.exceptions || [];
    rdv.exceptions.push(_agendaJour);

  } else if (mode === 'suivants') {
    // Coupe la récurrence d'origine à la veille
    const veille = new Date(_agendaJour + 'T12:00');
    veille.setDate(veille.getDate() - 1);
    rdv.duree = veille.toISOString().split('T')[0];

    // Crée une nouvelle récurrence à partir d'aujourd'hui
    window.D.rdv.push({
      id: Date.now().toString(),
      date: _agendaJour,
      label, heure,
      recurrence: rdv.recurrence,
      duree: rdv.duree_originale || null // hérite la durée d'origine si elle existe
    });
  }

  window._editRdvId = null;
  save();
  annulerFormulaireRdv();
  renderAgendaJour(document.getElementById('agenda-contenu'));
}

function declarerRegles(ds) {
  const D = window.D;
  // Évite les doublons sur le même jour
  const existe = (D.cycle || []).find(e => e.date === ds && e.type === 'regles');
  if (existe) { toast('Déjà enregistré pour ce jour 🩸'); return; }
  D.cycle = D.cycle || [];
  D.cycle.push({ date: ds, type: 'regles' });
  D.cycle.sort((a,b) => a.date > b.date ? -1 : 1);
  save();
  toast('Début de cycle enregistré 🩸');
  renderAgendaJour(document.getElementById('agenda-contenu'));
}

function ouvrirJournalAuJour(ds) {
  fermerAgenda();
  const cible      = new Date(ds + 'T12:00');
  const maintenant = new Date(today() + 'T12:00');
  const diffJours  = Math.round((cible - maintenant) / 86400000);
  window._journalWOff = Math.trunc(diffJours / 7);
  document.getElementById('menu-overlay')?.classList.remove('open');
  go('journal'); // ← go() directement, sans toggleMenu
}

/* ─── PANNEAU 2 : MOIS ─────────────────────────────────────── */

let _agendaMoisOffset = 0; // 0 = mois actuel, -1 = mois précédent...

function revenirAujourdhuiMois() {
  _agendaMoisOffset = 0;
  renderAgendaMois(document.getElementById('agenda-contenu'));
}

function renderAgendaMois(el) {
  const D      = window.D;
  const now    = new Date();
  const annee  = new Date(now.getFullYear(), now.getMonth() + _agendaMoisOffset, 1);
  const moisNom = annee.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const premierJour = new Date(annee.getFullYear(), annee.getMonth(), 1);
  const nbJours     = new Date(annee.getFullYear(), annee.getMonth() + 1, 0).getDate();

  let depart = premierJour.getDay() - 1;
  if (depart < 0) depart = 6;

  const cycleEntries = D.cycle || [];
  const duree        = D.g.cycleDuree || 28;

  const j1Dates = cycleEntries
    .filter(e => e.type === 'regles')
    .map(e => e.date)
    .sort().reverse();

  // En-têtes jours
  let cells = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-top:8px">';
  ['L','M','M','J','V','S','D'].forEach(j => {
    cells += `<div style="text-align:center;font-size:var(--fs-xs);color:var(--text2);
      padding:3px 0;font-weight:bold">${j}</div>`;
  });

  // Cases vides
  for (let i = 0; i < depart; i++) cells += '<div></div>';

  for (let d = 1; d <= nbJours; d++) {
    const ds = `${annee.getFullYear()}-${String(annee.getMonth()+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const estAujourd = ds === today();
    const log   = D.log[ds] || [];
    const total = D.habits.length;
    const pct   = total > 0 ? log.length / total : 0;

    const g       = Math.round(180 + pct * 60);
    const alpha   = pct > 0 ? 0.15 + pct * 0.6 : 0;
    const bgColor = pct > 0 ? `rgba(80,${g},120,${alpha})` : 'rgba(0,0,0,0.03)';

    // Cycle
    const estJ1     = j1Dates.includes(ds);
    let   estOvul   = false;
    let   estPredic = false;
    j1Dates.forEach(j1 => {
      const diff = Math.round((new Date(ds+'T12:00') - new Date(j1+'T12:00')) / 86400000);
      if (diff >= 12 && diff <= 16) estOvul   = true;
      if (diff >= 25 && diff <= 30) estPredic = true;
    });

    // ← RDV via getRdvDuJour (récurrents inclus)
    const rdvDuJour = getRdvDuJour(ds);
    const aNote     = (D.journal || []).some(n => n.date && n.date.startsWith(ds));

    // Emoji à afficher : premier emoji trouvé dans le label, sinon 📌
    let rdvEmoji = '';
    if (rdvDuJour.length) {
      const match = rdvDuJour[0].label.match(/^\p{Emoji}/u);
      rdvEmoji = match ? match[0] : '📌';
      // Si plusieurs RDV, affiche un + discret
      if (rdvDuJour.length > 1) rdvEmoji += `<span style="font-size:7px;vertical-align:super">+${rdvDuJour.length - 1}</span>`;
    }

    const border = estAujourd ? '2px solid var(--lilac)' : '1px solid transparent';

    cells += `
      <button onclick="clickJourMois('${ds}')"
        style="position:relative;aspect-ratio:1;border-radius:6px;cursor:pointer;
        background:${bgColor};border:${border};
        display:flex;flex-direction:column;align-items:center;
        justify-content:space-between;padding:2px 1px">

        ${estOvul ? `<div style="position:absolute;inset:1px;border-radius:5px;
          border:2px solid #80b8e066;pointer-events:none"></div>` : ''}
        ${estJ1 ? `<div style="position:absolute;top:2px;right:2px;width:6px;height:6px;
          border-radius:50%;background:#e07080"></div>` : ''}
        ${estPredic && !estJ1 ? `<div style="position:absolute;inset:1px;border-radius:5px;
          border:2px dashed #e0708066;pointer-events:none"></div>` : ''}

        <span style="font-size:var(--fs-sm);font-weight:${estAujourd?'bold':'normal'};
          color:${estAujourd?'var(--lilac)':'var(--text)'};margin-top:2px">${d}</span>

        <div style="display:flex;gap:1px;font-size:var(--fs-xs);line-height:1;margin-bottom:1px">
          ${rdvEmoji}
          ${aNote ? '📓' : ''}
        </div>
      </button>`;
  }

  cells += '</div>';

el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <button onclick="navAgendaMois(-1)"
        style="background:none;border:none;cursor:pointer;padding:4px;display:flex;align-items:center">
        ${chevron('left')}
      </button>
      <div style="display:flex;flex-direction:column;align-items:center;flex:1;gap:4px">
        <span style="font-size:12px;font-weight:bold;font-family:'Courier New',monospace;
          text-transform:capitalize;text-align:center;color:var(--lilac)">
          ${moisNom}
        </span>
        ${_agendaMoisOffset !== 0 ? `
          <button onclick="revenirAujourdhuiMois()"
            style="padding:2px 12px;border-radius:20px;border:none;
            background:var(--lilac);color:#fff;font-size:var(--fs-xs);cursor:pointer;
            font-family:'Courier New',monospace;font-weight:bold">
            ↩ Aujourd'hui
          </button>` : ''}
      </div>
      <button onclick="navAgendaMois(1)"
        style="background:none;border:none;cursor:pointer;padding:4px;display:flex;align-items:center">
        ${chevron('right')}
      </button>
    </div>

    ${cells}

    <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:6px 20px;
      margin-top:14px;padding:10px 14px;border-radius:var(--r-md);
      background:rgba(0,0,0,0.03);border:1px solid rgba(0,0,0,0.05)">
      <div style="display:flex;align-items:center;gap:6px;font-size:var(--fs-sm);color:var(--text2)">
        <span style="display:inline-block;width:24px;height:8px;border-radius:3px;flex-shrink:0;
          background:linear-gradient(to right,rgba(80,180,120,0.1),rgba(80,180,120,0.85))"></span>
        Habitudes
      </div>
      <div style="display:flex;align-items:center;gap:6px;font-size:var(--fs-sm);color:var(--text2)">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;flex-shrink:0;
          background:#e07080"></span>
        Règles (J1)
      </div>
      <div style="display:flex;align-items:center;gap:6px;font-size:var(--fs-sm);color:var(--text2)">
        <span style="display:inline-block;width:8px;height:8px;border-radius:3px;flex-shrink:0;
          border:1.5px solid #80b8e0"></span>
        Ovulation
      </div>
      <div style="display:flex;align-items:center;gap:6px;font-size:var(--fs-sm);color:var(--text2)">
        <span style="display:inline-block;width:8px;height:8px;border-radius:3px;flex-shrink:0;
          border:1px dashed #e07080"></span>
        Prédiction
      </div>
    </div>
  `;
}

function navAgendaMois(dir) {
  _agendaMoisOffset += dir;
  renderAgendaMois(document.getElementById('agenda-contenu'));
}

function clickJourMois(ds) {
  _agendaJour = ds;
  switchAgenda('jour');
}

/* ─── PANNEAU 3 : CYCLE ─────────────────────────────────────── */

function renderAgendaCycle(el) {
  const D = window.D;
  const cycles = (D.cycle || [])
    .filter(e => e.type === 'regles')
    .map(e => e.date)
    .sort().reverse();

  // Durée moyenne sur TOUS les cycles connus (plus fiable que juste les 2 derniers)
  let duree = D.g.cycleDuree || 28;
  if (cycles.length >= 2) {
    let total = 0;
    for (let i = 0; i < cycles.length - 1; i++) {
      total += Math.round(
        (new Date(cycles[i] + 'T12:00') - new Date(cycles[i+1] + 'T12:00')) / 86400000
      );
    }
    duree = Math.round(total / (cycles.length - 1));
  }

  const phaseAujourd = getCyclePhase(today());
  const aDesDonnees  = cycles.length >= 1;

  // ── Détection nudge : phase menstruelle probable mais pas de J1 récent ──
  // On affiche le nudge si : phase détectée = menstruelle ET le dernier J1
  // date de plus de (duree - 3) jours (= on est probablement dans un nouveau cycle)
  let afficherNudge = false;
  if (phaseAujourd?.phase === 'menstruelle' && aDesDonnees) {
    const dernierJ1  = new Date(cycles[0] + 'T12:00');
    const joursDepuis = Math.round((new Date(today() + 'T12:00') - dernierJ1) / 86400000);
    afficherNudge = joursDepuis > (duree - 3);
  }

const descriptions = {
  menstruelle:  'Ton corps fait un gros travail en ce moment. C\'est une période pour ralentir sans culpabilité — le repos est productif lui aussi.',
  folliculaire: 'L\'énergie revient doucement. Ta tête est plus disponible, c\'est souvent le bon moment pour reprendre des projets en attente ou en lancer de nouveaux.',
  ovulation:    'Tu es probablement à un pic d\'énergie et de clarté. Profites-en pour les tâches qui demandent de la concentration ou du lien avec les autres.',
  lutéale:      'Le corps commence à se préparer. La fatigue, l\'irritabilité ou la sensibilité émotionnelle qui arrivent parfois — c\'est physiologique, pas un problème à corriger.'
};

  // ── Hero card ──
  let heroHtml;
  if (phaseAujourd && aDesDonnees) {
    const nudgeHtml = afficherNudge ? `
      <div onclick="toggleAccordeon('acc-saisie')"
        style="margin-top:10px;padding:var(--sp-sm) 12px;border-radius:var(--r-sm);
        background:rgba(255,255,255,0.35);cursor:pointer;
        display:flex;align-items:center;gap:8px">
        <span style="font-size:14px">🩸</span>
        <span style="font-size:var(--fs-sm);color:${phaseAujourd.couleur};font-weight:bold;line-height:1.3">
          Tu as tes règles en ce moment ?<br>
          <span style="font-weight:normal;color:var(--text)">Pense à enregistrer ton J1 ↓</span>
        </span>
      </div>` : '';

    heroHtml = `
      <div style="padding:16px;border-radius:14px;margin-bottom:14px;
        background:${phaseAujourd.couleur}20;border:1px solid ${phaseAujourd.couleur}44">
        <div style="font-size:13px;font-weight:bold;color:${phaseAujourd.couleur};margin-bottom:6px">
          ${phaseAujourd.label} · Jour ${phaseAujourd.j}
        </div>
        <div style="font-size:var(--fs-sm);color:var(--text);line-height:1.6">
          ${descriptions[phaseAujourd.phase]}
        </div>
        ${nudgeHtml}
      </div>`;
  } else {
    // Pas de données — état d'accueil bienveillant
    heroHtml = `
      <div style="padding:16px;border-radius:14px;margin-bottom:14px;
        background:var(--card);border:1px dashed var(--border);text-align:center">
        <div style="font-size:22px;margin-bottom:var(--sp-sm)">🌙</div>
        <div style="font-size:12px;font-weight:bold;color:var(--text);margin-bottom:6px">
          Commence à suivre ton cycle
        </div>
        <div style="font-size:var(--fs-sm);color:var(--text2);line-height:1.5">
          Enregistre ton premier jour de règles ci-dessous.<br>
          L'app calculera ta phase au fil du temps.
        </div>
      </div>`;
  }

  // ── Frise compacte (sans labels dessous) ──
  const phases = [
    { id: 'menstruelle',  label: 'Règles',      jours: '1–5',          pct: 5/duree,           couleur: '#e07080' },
    { id: 'folliculaire', label: 'Folliculaire', jours: '6–13',         pct: 8/duree,           couleur: '#80b8e0' },
    { id: 'ovulation',    label: 'Ovulation',    jours: '14–16',        pct: 3/duree,           couleur: '#60c8a0' },
    { id: 'lutéale',      label: 'Lutéale',      jours: '17–'+duree,    pct: (duree-16)/duree,  couleur: '#b090d0' },
  ];

  let friseHtml = '';
  if (aDesDonnees) {
    friseHtml = `
      <div style="margin-bottom:14px">
        <div style="border-radius:var(--r-md);overflow:hidden;display:flex;height:24px">
          ${phases.map(p => {
            const isActive = phaseAujourd?.phase === p.id;
            return `<div title="${p.label} (J${p.jours})"
              style="flex:${p.pct};background:${p.couleur}${isActive ? '' : '55'};
              display:flex;align-items:center;justify-content:center;
              font-size:var(--fs-xs);color:#fff;font-weight:bold;transition:background .3s">
              ${isActive ? '▼' : ''}
            </div>`;
          }).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:4px;padding:0 2px">
          <span style="font-size:var(--fs-xs);color:var(--text2)">J1</span>
          <span style="font-size:var(--fs-xs);color:var(--text2)">J${duree}</span>
        </div>
      </div>`;
  }

  // ── Accordéon saisie ──
  const saisieHtml = `
    <div style="margin-bottom:var(--sp-sm);border-radius:var(--r-md);overflow:hidden;
      border:1px solid var(--border)">
      <button onclick="toggleAccordeon('acc-saisie')"
        style="width:100%;padding:var(--sp-md) 14px;background:var(--card);border:none;
        cursor:pointer;display:flex;align-items:center;justify-content:space-between;
        font-family:'Courier New',monospace;font-size:var(--fs-sm);color:var(--text)">
        <span>🩸 Déclarer un début de cycle</span>
        <span id="acc-saisie-chevron" style="color:var(--text2);transition:transform .2s">▾</span>
      </button>
      <div id="acc-saisie" style="max-height:0;overflow:hidden;transition:max-height .3s ease">
        <div style="padding:var(--sp-md) 14px;border-top:1px solid var(--border)">
          <div style="display:flex;gap:6px;align-items:center">
            <input type="date" id="cycle-date-input" class="inp"
              value="${today()}" style="flex:1">
            <button class="btn btn-p" onclick="declarerReglesCycle()"
              style="white-space:nowrap;font-size:var(--fs-sm)">
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>`;

  // ── Accordéon historique ──
  let historiqueContenu = `
    <div style="font-size:var(--fs-sm);color:var(--text2);font-style:italic;padding:var(--sp-md) 14px">
      Aucun cycle enregistré pour l'instant.
    </div>`;

  if (aDesDonnees) {
    const MAX_VISIBLE = 3;

const lignesJ1 = cycles.map((ds, i) => {
  const d     = new Date(ds + 'T12:00');
  const fmt   = `${d.getDate()} ${d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
  const cache = i >= MAX_VISIBLE;
  return `
    <div class="j1-ligne" style="display:${cache ? 'none' : 'flex'};align-items:center;
      justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:var(--fs-sm);color:var(--text)">🩸 ${fmt}</span>
      <div style="display:flex;gap:4px">
        <button onclick="confirmerSuppressionCycle('${ds}', this)"
          style="background:none;border:none;cursor:pointer;font-size:13px">🗑️</button>
      </div>
    </div>`;
}).join('');

    const voirToutBtn = cycles.length > MAX_VISIBLE ? `
      <button onclick="toggleJ1Liste()" id="btn-voir-tout-j1"
        style="width:100%;margin-top:6px;padding:6px;border-radius:var(--r-sm);
        border:1px solid var(--border);background:transparent;
        font-size:var(--fs-sm);cursor:pointer;color:var(--lilac);
        font-family:'Courier New',monospace">
        Voir tout (${cycles.length - MAX_VISIBLE} de plus) ▾
      </button>
      <div id="j1-voir-tout" style="max-height:0;overflow:hidden;transition:max-height .3s ease">
        ${cycles.slice(MAX_VISIBLE).map((ds, i) => {
          const idx = i + MAX_VISIBLE;
          const d   = new Date(ds + 'T12:00');
          const fmt = `${d.getDate()} ${d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
          return `
            <div style="display:flex;align-items:center;justify-content:space-between;
              padding:7px 0;border-bottom:1px solid var(--border)">
              <span style="font-size:var(--fs-sm);color:var(--text)">🩸 ${fmt}</span>
              <div style="display:flex;gap:4px">
                <input type="date" id="edit-j1-${idx}"
                  style="position:absolute;opacity:0;pointer-events:none;width:0;height:0"
                  value="${ds}" onchange="modifierCycle('${ds}', this.value)">
                <button onclick="confirmerSuppressionCycle('${ds}', this)"
                  style="background:none;border:none;cursor:pointer;font-size:13px">🗑️</button>
              </div>
            </div>`;
        }).join('')}
      </div>` : '';

    // Durée moyenne affichée
    const moyenneHtml = cycles.length >= 2
      ? `<div style="margin-top:10px;padding:var(--sp-sm) 10px;border-radius:var(--r-sm);
          background:var(--bg);font-size:var(--fs-sm);color:var(--text2)">
          Durée moyenne de tes cycles : <strong style="color:var(--text)">${duree} jours</strong>
          <span style="font-size:var(--fs-sm)"> (sur ${cycles.length - 1} cycle${cycles.length > 2 ? 's' : ''})</span>
        </div>` : '';

    historiqueContenu = `
      <div style="padding:var(--sp-md) 14px;border-top:1px solid var(--border)">
        ${lignesJ1}
        ${voirToutBtn}
        ${moyenneHtml}
        <button onclick="copierCycles()"
  style="width:100%;margin-top:12px;padding:var(--sp-sm);border-radius:var(--r-md);
  border:1px solid var(--border);background:transparent;
  font-size:var(--fs-sm);cursor:pointer;color:var(--text2);
  font-family:'Courier New',monospace">
  📋 Copier l'historique
</button>
      </div>`;
  }

  const historiqueHtml = `
    <div style="margin-bottom:var(--sp-sm);border-radius:var(--r-md);overflow:hidden;
      border:1px solid var(--border)">
      <button onclick="toggleAccordeon('acc-historique')"
        style="width:100%;padding:var(--sp-md) 14px;background:var(--card);border:none;
        cursor:pointer;display:flex;align-items:center;justify-content:space-between;
        font-family:'Courier New',monospace;font-size:var(--fs-sm);color:var(--text)">
        <span>📋 Historique (${cycles.length} J1 enregistré${cycles.length > 1 ? 's' : ''})</span>
        <span id="acc-historique-chevron" style="color:var(--text2);transition:transform .2s">▾</span>
      </button>
      <div id="acc-historique" style="max-height:0;overflow:hidden;transition:max-height .3s ease">
        ${historiqueContenu}
      </div>
    </div>`;

  el.innerHTML = heroHtml + friseHtml + saisieHtml + historiqueHtml;

  // Auto-ouvre l'accordéon saisie si pas encore de données
  if (!aDesDonnees) toggleAccordeon('acc-saisie');
}

// ── Accordéon générique ──
function toggleAccordeon(id) {
  const panel   = document.getElementById(id);
  const chevron = document.getElementById(id + '-chevron');
  if (!panel) return;
  const ouvert = panel.style.maxHeight && panel.style.maxHeight !== '0px';
  panel.style.maxHeight = ouvert ? '0px' : '600px';
  if (chevron) chevron.style.transform = ouvert ? '' : 'rotate(180deg)';
}

function toggleJ1Liste() {
  const liste = document.getElementById('j1-voir-tout');
  const btn   = document.getElementById('btn-voir-tout-j1');
  if (!liste) return;
  const ouvert = liste.style.maxHeight !== '0px' && liste.style.maxHeight !== '';
  liste.style.maxHeight = ouvert ? '0' : '400px';
  liste.style.overflowY = ouvert ? 'hidden' : 'auto';
  btn.textContent = ouvert
    ? `Voir tout (${document.querySelectorAll('#j1-voir-tout .j1-ligne, #j1-voir-tout [style*="flex"]').length} de plus) ▾`
    : 'Réduire ▴';
}

function modifierCycle(ancienneDate, nouvelleDate) {
  if (!nouvelleDate || ancienneDate === nouvelleDate) return;
  const D      = window.D;
  const doublon = (D.cycle || []).find(e => e.date === nouvelleDate && e.type === 'regles');
  if (doublon) { toast('Un cycle existe déjà à cette date'); return; }
  const idx = (D.cycle || []).findIndex(e => e.date === ancienneDate && e.type === 'regles');
  if (idx !== -1) {
    D.cycle[idx].date = nouvelleDate;
    D.cycle.sort((a, b) => a.date > b.date ? -1 : 1);
  }
  save();
  toast('Cycle mis à jour ✓');
  renderAgendaCycle(document.getElementById('agenda-contenu'));
}

function declarerReglesCycle() {
  const ds = document.getElementById('cycle-date-input').value;
  if (!ds) return;
  declarerRegles(ds);
  renderAgendaCycle(document.getElementById('agenda-contenu'));
}

function supprimerCycle(ds) {
  window.D.cycle = (window.D.cycle || []).filter(e => !(e.date === ds && e.type === 'regles'));
  save();
  renderAgendaCycle(document.getElementById('agenda-contenu'));
}

function copierCycles() {
  const D      = window.D;
  const cycles = (D.cycle || [])
    .filter(e => e.type === 'regles')
    .map(e => e.date)
    .sort().reverse();

  if (cycles.length < 1) { toast('Aucun cycle à copier'); return; }

  let txt = 'Historique des cycles — HabitGotchi\n\n';
  for (let i = 0; i < cycles.length - 1; i++) {
    const d1  = new Date(cycles[i+1] + 'T12:00');
    const d2  = new Date(cycles[i]   + 'T12:00');
    const nb  = Math.round((d2 - d1) / 86400000);
    const fmt = d => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    txt += `Cycle ${cycles.length - 1 - i} : ${fmt(d1)} → ${fmt(d2)} (${nb} jours)\n`;
  }
  if (cycles.length === 1) {
    const d = new Date(cycles[0] + 'T12:00');
    txt += `J1 enregistré : ${d.toLocaleDateString('fr-FR')}\n`;
  }

  navigator.clipboard.writeText(txt)
    .then(() => toast('Historique copié ✓'))
    .catch(() => toast('Copie non disponible sur cet appareil'));
}

/* ============================================================
   INIT UI — Appelée par bootstrap() dans app.js
   (plus de DOMContentLoaded : incompatible PWA iOS standalone)
   ============================================================ */
window.initUI = function() {
  // Garde-fou : D doit exister (bootstrap charge D en async)
  if (!window.D || !window.D.g) {
    console.warn('initUI appelée avant que D soit prêt');
    return;
  }

  const h = hr();
  window.D.g.activeEnv = (h >= 21 || h < 7) ? 'chambre' : 'parc';

  updUI();
  syncConsoleHeight();
  renderHabs();
  renderProps();
  restorePerso();
  initMoodPicker();
  checkWelcome();
  updBubbleNow();

  const vEl = document.getElementById('APP_VERSION');
  if (vEl) vEl.textContent = window.APP_VERSION || '';
  // Tap sur le tama depuis un autre onglet → retour accueil
  document.querySelector('.tama-screen')?.addEventListener('pointerdown', function() {
    const modalEl = document.getElementById('modal');
    const modalOuverte = modalEl && getComputedStyle(modalEl).display !== 'none';
    if (!window._gotchiActif && !modalOuverte && typeof go === 'function') go('gotchi');
  });
}; // ferme window.initUI = function()
// FIN ui.js