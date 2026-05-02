/* ============================================================
   ui-game.js — Hub mini-jeux (overlay plein écran)
   RÔLE : Ouvre/ferme l'overlay #game-overlay, orchestre la
          navigation entre le hub (liste des jeux) et le canvas
          actif d'un jeu lancé. Ne contient aucune logique de jeu.

   Dépend de : ui-core.js (lockScroll, unlockScroll, _fermerMenuSiOuvert)
               app.js     (window.D — lecture seule si besoin futur)
   Dépendances en aval : js/games/ui-cristaux.js (et futurs jeux)
                         → chaque jeu expose window.lancerXxx()

   Ordre de chargement : après ui-atelier.js, avant js/games/*, avant ui-nav.js
   ============================================================

   CONTENU :
   §1  ouvrirGameHub()   — ouvre l'overlay et affiche le hub
   §2  fermerGameHub()   — ferme l'overlay, détruit le jeu actif si besoin
   §3  renderGameHub()   — met à jour les scores dans les cartes du hub
   §4  lancerCristaux()  — swap hub → canvas (délègue à ui-cristaux.js au sprint 2)
   §5  retourGameHub()   — swap canvas → hub, détruit l'instance p5 si présente
   ============================================================ */

/* ─── §1 : OUVRIR ─────────────────────────────────────────── */

/**
 * RÔLE : Ouvre l'overlay plein écran du hub de jeux.
 * POURQUOI : Même pattern que ouvrirAtelier() — overlay display:flex + lockScroll.
 *            Appelé par le sticker 🎮 dans .menu-stickers.
 */
function ouvrirGameHub() {
  const overlay = document.getElementById('game-overlay');
  if (!overlay) return;

  // RÔLE : Afficher l'overlay en flex column (le display:none devient flex)
  overlay.style.display = 'flex';

  // RÔLE : S'assurer que le hub est visible et le canvas caché à l'ouverture
  renderGameHub();

  // RÔLE : Bloquer le scroll de la page derrière l'overlay (iOS fix)
  // POURQUOI : Sans lockScroll, le fond scrolle derrière l'overlay sur Safari mobile.
  //
  // ROBUSTESSE IOS (sprint 3) :
  //   lockScroll() pose un listener touchmove+preventDefault (passive:false) sur document.
  //   Il RESTE actif pendant tout le jeu — lancerCristaux() et retourGameHub() ne
  //   l'annulent jamais (ils n'appellent pas unlockScroll). unlockScroll() n'est appelé
  //   que dans fermerGameHub() quand l'overlay est vraiment fermé.
  //
  //   Le sketch p5 retourne false dans touchStarted/touchMoved/touchEnded, ce qui
  //   appelle preventDefault() à l'intérieur du canvas p5 — ce double-appel est
  //   inoffensif (idempotent). Aucun conflit avec render.js car render.js écoute sur
  //   le canvas principal (#defaultCanvas0), pas sur le canvas du jeu (#game-canvas-container).
  //   ⚠️ DETTE : si render.js écoute jamais sur document (touchstart global), vérifier
  //   que le guard "if target is inside #game-overlay → skip" est en place.
  lockScroll();

  // RÔLE : Fermer le menu si ouvert — l'overlay prend toute la place
  if (typeof _fermerMenuSiOuvert === 'function') _fermerMenuSiOuvert();
}

window.ouvrirGameHub = ouvrirGameHub;

/* ─── §2 : FERMER ─────────────────────────────────────────── */

/**
 * RÔLE : Ferme l'overlay et nettoie le jeu actif si besoin.
 * POURQUOI : Appelé par le bouton ✕ du header de l'overlay.
 *            Détruit l'instance p5 si un jeu tourne encore.
 */
function fermerGameHub() {
  // RÔLE : Détruire l'instance p5 active avant de fermer — libère mémoire et boucle de rendu
  // POURQUOI window._cristalSketch?.remove() : l'instance sera créée dans ui-cristaux.js (sprint 2)
  //           Le guard ?. évite un crash si aucun jeu n'a encore été lancé
  if (window._cristalSketch) {
    window._cristalSketch.remove();
    window._cristalSketch = null;
  }

  // RÔLE : Vider le container canvas — évite les doublons si on rouvre puis relance
  const container = document.getElementById('game-canvas-container');
  if (container) container.innerHTML = '';

  // RÔLE : Masquer l'overlay
  const overlay = document.getElementById('game-overlay');
  if (overlay) overlay.style.display = 'none';

  // RÔLE : Remettre le hub en état propre pour la prochaine ouverture
  _resetGameZone();

  unlockScroll();
}

window.fermerGameHub = fermerGameHub;

/* ─── §3 : RENDER HUB ─────────────────────────────────────── */

/**
 * RÔLE : Met à jour les scores dans les cartes du hub et s'assure
 *        que la vue hub est visible (canvas et bouton retour cachés).
 * POURQUOI : Appelé à chaque ouverture de l'overlay ET au retour depuis un jeu —
 *            relit localStorage pour afficher le score le plus récent.
 */
function renderGameHub() {
  _resetGameZone();

  // RÔLE : Lire et afficher le meilleur score Tri de Cristaux
  // POURQUOI clé hg_game_crystals_best : préfixe hg_ pour éviter collisions avec d'autres apps,
  //           stocké hors structure D (hg4) car les scores de jeu sont des données légères
  const best    = localStorage.getItem('hg_game_crystals_best');
  const scoreEl = document.getElementById('cristaux-best-score');
  if (scoreEl) {
    scoreEl.textContent = best !== null
      ? `Meilleur : ${parseInt(best, 10)} pts`
      : 'Meilleur : —';
  }

  // RÔLE : Afficher un indicateur ✨ discret sur la carte si le cristal doré est disponible.
  // POURQUOI window._cx_estDoréDisponible : définie dans ui-cristaux.js (chargé après) —
  //           on vérifie sa présence via typeof pour ne pas crasher si le fichier est absent.
  //           L'indicateur aide l'utilisatrice à savoir quand lancer le jeu pour le bonus.
  const indicEl = document.getElementById('cristaux-dore-indicateur');
  if (indicEl) {
    const doréDispo = typeof window._cx_estDoréDisponible === 'function'
      && window._cx_estDoréDisponible();
    // POURQUOI style.display plutôt que remove/create : évite de recréer un nœud DOM
    //           à chaque appel de renderGameHub() (appelé à chaque ouverture du hub)
    indicEl.style.display = doréDispo ? 'inline' : 'none';
  }
}

window.renderGameHub = renderGameHub;

/**
 * RÔLE : Remet la zone de jeu en état "hub visible, canvas caché".
 * POURQUOI helper privé : appelé depuis renderGameHub() ET fermerGameHub()
 *           — factorise le reset sans dupliquer le code.
 */
function _resetGameZone() {
  const hub       = document.getElementById('game-hub');
  const canvas    = document.getElementById('game-canvas-container');
  const backBtn   = document.getElementById('game-back-btn');

  if (hub)     hub.style.display     = '';
  if (canvas)  canvas.style.display  = 'none';
  if (backBtn) backBtn.style.display = 'none';
}

/* ─── §4 : LANCER CRISTAUX ────────────────────────────────── */

/**
 * RÔLE : Swap hub → canvas et démarre le jeu Tri de Cristaux.
 * POURQUOI séparé de renderGameHub : chaque jeu a son propre point d'entrée.
 *   La logique du jeu est entièrement dans js/games/ui-cristaux.js,
 *   qui expose window._demarrerCristaux(container).
 */
function lancerCristaux() {
  const hub     = document.getElementById('game-hub');
  const canvas  = document.getElementById('game-canvas-container');
  const backBtn = document.getElementById('game-back-btn');

  if (hub)     hub.style.display     = 'none';
  if (canvas)  canvas.style.display  = '';
  if (backBtn) backBtn.style.display = '';

  // RÔLE : Déléguer le lancement à ui-cristaux.js qui contient toute la logique du jeu
  // POURQUOI guard typeof : sécurité défensive si le fichier n'est pas chargé
  if (typeof window._demarrerCristaux === 'function') {
    window._demarrerCristaux(canvas);
    return;
  }

  // RÔLE : Fallback si ui-cristaux.js n'est pas chargé (ne devrait pas arriver en prod)
  if (canvas && !canvas.querySelector('.game-placeholder')) {
    const ph = document.createElement('div');
    ph.className = 'game-placeholder';
    ph.innerHTML = `
      <div style="text-align:center;padding:40px 20px;">
        <div style="font-family:var(--font-title);font-size:var(--fs-xl);color:var(--text);">
          Erreur de chargement
        </div>
        <div style="font-family:var(--font-body);font-size:var(--fs-sm);color:var(--text2);margin-top:8px;">
          ui-cristaux.js introuvable
        </div>
      </div>`;
    canvas.appendChild(ph);
  }
}

window.lancerCristaux = lancerCristaux;

/* ─── §5 : RETOUR HUB ─────────────────────────────────────── */

/**
 * RÔLE : Détruit le jeu actif et revient au hub (sans fermer l'overlay).
 * POURQUOI : Le bouton "← Retour aux jeux" reste dans l'overlay —
 *            l'utilisatrice revient à la liste sans quitter les jeux.
 */
function retourGameHub() {
  // RÔLE : Détruire l'instance p5 du jeu actif si elle existe
  if (window._cristalSketch) {
    window._cristalSketch.remove();
    window._cristalSketch = null;
  }

  // RÔLE : Vider le container pour éviter les doublons au prochain lancement
  const canvas = document.getElementById('game-canvas-container');
  if (canvas) canvas.innerHTML = '';

  // RÔLE : Revenir au hub avec les scores à jour
  renderGameHub();
}

window.retourGameHub = retourGameHub;
