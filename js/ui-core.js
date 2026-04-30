/* ============================================================
   ui-core.js — Primitives partagées par tous les modules UI
   RÔLE : Helper IA, utilitaires (escape, chevron, animEl),
          système de toast/modal, scroll lock, menu overlay.
   Dépend de : app.js (window.D, save, hr)
   Chargé en PREMIER parmi les fichiers ui-*.
   ============================================================

   CONTENU :
   §1  callClaude()         — Helper centralisé appels API Claude
   §2  Utilitaires config   — showTDAH, showCycle, showRDV, escape, escapeHtml
   §3  SVG helpers          — chevron(), chevronNav(), _noOrphan()
   §4  Animation            — animEl()
   §5  Toast système        — toast(), toastSnack(), toastModal()
   §6  Modale centrale      — _modalCloseBtn(), openModal(), clModal()
   §7  Scroll lock          — lockScroll(), unlockScroll()
   §8  Menu overlay         — toggleMenu(), _fermerMenuSiOuvert(), goMenu()
   §9  Dead code conservé   — toggleSliders() (vide)
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

// RÔLE : Alias de escape() pour usage dans contextes HTML (boutique, export).
// POURQUOI : escape() et escapeHtml() font exactement la même chose — escapeHtml
//            était défini en doublon dans la section boutique. On unifie ici.
function escapeHtml(str) { return escape(str); }

// RÔLE : Indique si la feature agenda/rendez-vous doit être affichée.
// POURQUOI : Émilie ne prévoit pas de s'en servir à terme.
//            Alexia oui. Cette fonction permet de masquer proprement
//            le bouton et les sections RDV selon la config.
//            Par défaut true — comportement inchangé si pas de config.
function showRDV() {
  return window.USER_CONFIG?.ui?.showRDVFeature !== false;
}

/* ============================================================
   SVG HELPERS
   ============================================================ */
// RÔLE : Génère un chevron SVG orientable (left ou right) utilisé dans toute l'app.
// POURQUOI : Placé ici en §2 pour être disponible partout dans ui.js —
//            les accordéons, l'agenda et la progression l'utilisent tous.
//            Un SVG est plus propre et cohérent que des emojis ◀▶ ou des caractères ▾.
function chevron(dir) {
  // dir = 'left' → pointe à gauche (<), 'right' → pointe à droite (>)
  //       'down'  → pointe vers le bas (∨) — accordéon ouvert
  //       'up'    → pointe vers le haut (∧) — accordéon fermé (utilisé dans le journal)
  let points;
  if      (dir === 'left')  points = '15 18 9 12 15 6';
  else if (dir === 'down')  points = '6 9 12 15 18 9';
  else if (dir === 'up')    points = '18 15 12 9 6 15';
  else                      points = '9 18 15 12 9 6'; // right par défaut
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="var(--text2)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
    style="display:block">
    <polyline points="${points}"/>
  </svg>`;
}

// RÔLE : Identique à chevron() mais avec la couleur lilac — pour les navigations principales (agenda, progression).
// POURQUOI : Les accordéons utilisent --text2 (discret), les navigations utilisent --lilac (mis en valeur).
function chevronNav(dir) {
  const points = dir === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6';
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="var(--lilac)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
    style="display:block">
    <polyline points="${points}"/>
  </svg>`;
}

// RÔLE : Évite les orphelins typographiques dans les toasts.
// POURQUOI : Un seul mot sur la dernière ligne est visuellement désagréable.
//            On colle le dernier mot et la ponctuation au précédent avec une espace insécable.
function _noOrphan(txt) {
  // Colle la ponctuation finale à son mot précédent
  txt = txt.replace(/ ([!?.:……]+)$/, ' $1');
  // Colle le dernier mot au précédent (évite 1 mot ou 2 mots isolés)
  txt = txt.replace(/ (\S+)$/, ' $1');
  return txt;
}

/* ============================================================
   ANIMATION
   ============================================================ */
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

/* ============================================================
   TOAST SYSTÈME
   ============================================================ */
let _toastTimer;

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
 * Modale standard avec bouton OK (bloquante)
 * RÔLE : Affiche un message court avec un bouton OK — passe désormais par openModal()
 * POURQUOI : Avant, toastModal() manipulait mbox.innerHTML directement sans lockScroll()
 *            ni _setInert() → le fond restait interactif pendant l'affichage du message.
 *            openModal() garantit les deux.
 */
function toastModal(m) {
  // POURQUOI padding-top:36px sur le <p> : le bouton .modal-close est positionné à top:10px avec ~24px de hauteur
  // Sans ce padding, le texte commence sous la croix et se superpose visuellement
  openModal(`<p style="text-align:center;font-size:var(--fs-sm);padding-top:36px;line-height:1.5">${m}</p><button class="btn btn-p" onclick="clModal()" style="width:100%;margin-top:8px">OK</button>`);
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
      font-family:var(--font-body);z-index:500;opacity:0;transition:opacity .2s;
      pointer-events:none;white-space:nowrap;`;
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => el.style.opacity = '0', 1800);
}

/* ============================================================
   MODALE CENTRALE
   CONVENTION : Toute modale DOIT passer par openModal() ou openModalRaw().
   - openModal(html)    → injecte automatiquement le bouton ✕, lockScroll, inert
   - openModalRaw(html) → sans ✕ auto (boutique/agenda qui gèrent leur propre bouton)
   - clModal(e)         → ferme, unlockScroll, retire inert
   Les overlays séparés (tablet-overlay, etats-overlay) doivent appeler
   lockScroll() à l'ouverture (il gère inert automatiquement) et unlockScroll() à la fermeture.
   ============================================================ */
let modalLocked = false; // ← true pendant le soutien IA (empêche la fermeture accidentelle)

/**
 * RÔLE : Active ou désactive l'attribut `inert` sur les zones de contenu derrière les modales.
 * POURQUOI : `inert` désactive complètement les pointer-events ET le focus sur tout le sous-arbre
 *            — y compris les listeners p5.js attachés au document. C'est la protection la plus
 *            robuste contre les "clics qui passent à travers" une modale.
 *            Quand inert=true : #console-top et #dynamic-zone deviennent inertes.
 *            Quand inert=false : ils redeviennent interactifs.
 */
function _setInert(active) {
  const zones = ['console-top', 'dynamic-zone'];
  zones.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.inert = active;
  });
}

/**
 * RÔLE : Génère le bouton ✕ de fermeture persistant pour toutes les modales
 * POURQUOI : Sans bouton explicite, l'utilisatrice doit deviner qu'il faut taper à côté
 *            pour fermer — source de frustration sur mobile, surtout avec TDAH
 */
function _modalCloseBtn() {
  return `<button class="modal-close" onclick="clModal()" aria-label="Fermer">✕</button>`;
}

function clModal(e) {
  if (modalLocked) return;
  // POURQUOI : on ferme si : (a) clic direct sur le fond #modal, (b) appel sans event (depuis bouton OK/Annuler), (c) bouton .modal-close
  if (!e || e.target.id === 'modal' || e.currentTarget?.classList?.contains('modal-close')) {
    document.getElementById('modal').style.display = 'none';
    unlockScroll(); // RÔLE : retire aussi inert via unlockScroll (cf. scroll lock section)
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
  _fermerMenuSiOuvert(); // ferme le menu-overlay s'il était ouvert (évite qu'il capte les clics sous la modale)
  modal.style.display = 'flex';
  lockScroll(); // RÔLE : bloque scroll + inert sur les zones derrière (cf. scroll lock section)
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
 * RÔLE : Variante de openModal() sans injection automatique du bouton ✕
 * POURQUOI : Boutique, agenda et soutien gèrent leur propre bouton de fermeture
 *            (avec des styles ou des comportements spécifiques). openModalRaw() leur
 *            garantit quand même lockScroll() et inert sans imposer le ✕ standard.
 * USAGE : openModalRaw(`<button onclick="clModal()">✕</button><div>contenu...</div>`)
 */
function openModalRaw(html) {
  const modal = document.getElementById('modal');
  const mbox  = document.getElementById('mbox');
  _fermerMenuSiOuvert();
  modal.style.display = 'flex';
  lockScroll(); // RÔLE : bloque scroll + inert sur les zones derrière (cf. scroll lock section)
  mbox.classList.remove('modal-pop');
  void mbox.offsetWidth;
  mbox.innerHTML = html; // pas de ✕ injecté automatiquement
  mbox.classList.add('modal-pop');
}

/* ============================================================
   SCROLL LOCK
   ============================================================ */
// RÔLE : Bloque le scroll du fond ET les interactions derrière, pour toute modale ou overlay.
// POURQUOI : On centralise _setInert() ici plutôt que dans chaque fonction d'ouverture,
//            parce que toutes les ouvertures qui bypassent openModal() appellent quand même
//            lockScroll() (boutique, agenda, tablet, etats-overlay...). En couplant inert
//            à lockScroll, on couvre tous les cas en un seul endroit sans modifier
//            les 14+ fonctions d'ouverture individuellement.
//            unlockScroll() retire systématiquement inert — safe car _fermerMenuSiOuvert()
//            garantit qu'on ne superpose jamais menu + modale.
function lockScroll() {
  document.body.style.overflow = 'hidden';
  _setInert(true); // RÔLE : rend #console-top et #dynamic-zone inertes (plus de scroll ni de tap derrière)
}
function unlockScroll() {
  document.body.style.overflow = '';
  _setInert(false); // RÔLE : restitue l'interactivité des zones derrière
}

/* ============================================================
   MENU OVERLAY
   ============================================================ */
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

// RÔLE : Ferme silencieusement le menu-overlay s'il est ouvert, sans appeler unlockScroll()
// POURQUOI : Quand une modale s'ouvre par-dessus, le menu-overlay (z-index:200) reste dans le DOM
//            et capte les clics sur le fond même si la modale (z-index:300) est visuellement au-dessus.
//            On retire juste la classe .open — lockScroll() reste géré par la modale qui s'ouvre.
function _fermerMenuSiOuvert() {
  document.getElementById('menu-overlay')?.classList.remove('open');
}

function goMenu(t) { toggleMenu(); go(t); }

// RÔLE : toggleSliders() supprimée — les sliders sont désormais dans la bottom sheet ouvrirModalEtats()
// POURQUOI : Le bloc #sliders-wrap du #console-top a été supprimé (badges dessinés dans le canvas).
function toggleSliders() { /* supprimée — conservée vide pour ne pas casser d'éventuels appels résiduels */ }
