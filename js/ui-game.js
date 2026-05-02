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
   §1  ouvrirGameHub()        — ouvre l'overlay et affiche le hub
   §2  fermerGameHub()        — ferme l'overlay, détruit le jeu actif si besoin
   §3  renderGameHub()        — met à jour les scores dans les cartes du hub
   §4  lancerCristaux()       — affiche le sélecteur de durée (1/2/3 min)
   §4b _cx_demarrerAvecDuree()— swap hub → canvas, démarre le jeu avec la durée choisie
   §5  retourGameHub()        — swap canvas → hub, détruit l'instance p5 si présente
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
  if (canvas) {
    canvas.style.display = 'none';
    // RÔLE : Retirer le mode plein-écran canvas au retour hub
    // POURQUOI : lancerCristaux() pose la classe, on la retire ici pour remettre
    //            le container dans le flux normal (position:relative, hauteur auto)
    canvas.classList.remove('game-canvas--fullscreen');
  }
  if (backBtn) backBtn.style.display = 'none';
}

/* ─── §4 : SÉLECTEUR DE DURÉE ─────────────────────────────── */

/**
 * RÔLE : Affiche l'écran de sélection de durée avant de lancer le jeu.
 * POURQUOI étape intermédiaire : l'utilisatrice choisit 1, 2 ou 3 minutes
 *   selon son envie et le temps disponible. Le hub reste caché, le canvas
 *   container accueille le sélecteur en HTML pur (pas de p5 à ce stade).
 *   Appelé par le bouton "Jouer" de la carte Tri de Cristaux dans le hub.
 */
function lancerCristaux() {
  const hub     = document.getElementById('game-hub');
  const canvas  = document.getElementById('game-canvas-container');
  const backBtn = document.getElementById('game-back-btn');

  if (hub)     hub.style.display = 'none';
  if (backBtn) backBtn.style.display = '';

  if (!canvas) return;

  // RÔLE : Afficher le container sans le mettre en fullscreen canvas —
  //        le sélecteur de durée est du HTML centré, pas un canvas p5.
  //        Le fullscreen sera posé dans _cx_demarrerAvecDuree() quand le sketch démarre.
  canvas.style.display  = '';
  canvas.innerHTML      = ''; // POURQUOI : nettoyage défensif

  // RÔLE : Lire la dernière durée choisie pour la pré-sélectionner (UX — mémoire du choix)
  const dernieresDuree = parseInt(localStorage.getItem('hg_game_crystals_duree') || '120', 10);

  // RÔLE : Les trois options de durée — label affiché + valeur en secondes
  const options = [
    { label: '1 min',  secondes: 60  },
    { label: '2 min',  secondes: 120 },
    { label: '3 min',  secondes: 180 },
  ];

  // RÔLE : Injecter l'écran de sélection en HTML dans le container
  // POURQUOI HTML inline et non element.createElement : plus lisible pour un bloc structuré
  canvas.innerHTML = `
    <div id="cx-duree-picker" style="
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      height:100%;min-height:260px;gap:24px;padding:32px 20px;box-sizing:border-box;
      font-family:var(--font-body);
    ">
      <div style="font-family:var(--font-title);font-size:var(--fs-xl);color:var(--text);text-align:center;">
        💎 Tri de Cristaux
      </div>
      <div style="font-size:var(--fs-sm);color:var(--text2);text-align:center;">
        Choisis la durée de ta session
      </div>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
        ${options.map(opt => `
          <button
            class="btn ${opt.secondes === dernieresDuree ? 'btn-p' : 'btn-s'} cx-duree-btn"
            data-secondes="${opt.secondes}"
            style="min-width:76px;padding:14px 12px;font-size:var(--fs-md);touch-action:manipulation;"
            aria-label="Jouer ${opt.label}"
            aria-pressed="${opt.secondes === dernieresDuree}"
          >${opt.label}</button>
        `).join('')}
      </div>
      <div style="font-size:var(--fs-xs);color:var(--text2);opacity:0.6;text-align:center;max-width:220px;">
        Le meilleur score est calculé toutes durées confondues
      </div>
    </div>`;

  // RÔLE : Brancher les boutons sur _cx_demarrerAvecDuree() avec la durée choisie
  canvas.querySelectorAll('.cx-duree-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const sec = parseInt(this.dataset.secondes, 10);
      _cx_demarrerAvecDuree(sec);
    });
  });
}

window.lancerCristaux = lancerCristaux;

/**
 * RÔLE : Swap hub → canvas plein écran et démarre le jeu avec la durée choisie.
 * POURQUOI séparé de lancerCristaux : lancerCristaux() gère le sélecteur de durée,
 *   cette fonction est le vrai point de départ du sketch p5.
 *   Aussi appelée par le bouton "Rejouer" dans ui-cristaux.js pour relancer
 *   avec la même durée sans repasser par le sélecteur.
 *
 * @param {number} secondes — durée de la session en secondes (60, 120 ou 180)
 */
function _cx_demarrerAvecDuree(secondes) {
  const canvas  = document.getElementById('game-canvas-container');
  const backBtn = document.getElementById('game-back-btn');

  // RÔLE : Mémoriser la durée choisie pour la pré-sélectionner à la prochaine ouverture
  localStorage.setItem('hg_game_crystals_duree', String(secondes));

  // RÔLE : Vider le sélecteur de durée et passer le canvas en plein écran
  // POURQUOI classe posée AVANT new p5() : setup() lit clientWidth/clientHeight —
  //           si le canvas n'est pas encore en fullscreen, les dimensions sont fausses
  if (canvas) {
    canvas.innerHTML = '';
    canvas.classList.add('game-canvas--fullscreen');
  }
  if (backBtn) backBtn.style.display = '';

  // RÔLE : Déléguer le lancement à ui-cristaux.js avec la durée en ms
  // POURQUOI guard typeof : sécurité défensive si le fichier n'est pas chargé
  if (typeof window._demarrerCristaux === 'function') {
    window._demarrerCristaux(canvas, secondes * 1000);
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

window._cx_demarrerAvecDuree = _cx_demarrerAvecDuree;

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
