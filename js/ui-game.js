/* ============================================================
   ui-game.js — Hub mini-jeux & navigation jeux cosy
   RÔLE : Gère l'affichage du hub de jeux, le lancement d'un jeu
          et le retour au hub. Ne contient aucune logique de jeu —
          les jeux eux-mêmes seront dans des modules dédiés (sprint 2+).

   Dépend de : app.js (window.D, save)
               ui-core.js (toast — optionnel)

   Ordre de chargement : après ui-agenda.js, avant ui-nav.js
   ============================================================

   CONTENU :
   §1  renderGameHub()   — affiche le hub, met à jour les scores
   §2  lancerCristaux()  — lance le jeu Tri de Cristaux (canvas vide pour l'instant)
   §3  retourGameHub()   — détruit l'instance p5 si présente, revient au hub
   ============================================================ */

/* ─── §1 : HUB ────────────────────────────────────────────── */

/**
 * RÔLE : Affiche le hub de jeux — liste des cartes disponibles + scores.
 * POURQUOI : Appelé par go('game') dans ui-nav.js à chaque navigation vers l'onglet.
 *            Relit le meilleur score depuis localStorage à chaque ouverture pour
 *            refléter le score de la session précédente sans passer par window.D
 *            (les scores de jeu sont des données légères, hors structure D).
 */
function renderGameHub() {
  // RÔLE : Afficher le hub, cacher canvas et bouton retour
  const hub       = document.getElementById('game-hub');
  const canvas    = document.getElementById('game-canvas-container');
  const backBtn   = document.getElementById('game-back-btn');

  if (hub)     hub.style.display     = '';
  if (canvas)  canvas.style.display  = 'none';
  if (backBtn) backBtn.style.display = 'none';

  // RÔLE : Lire et afficher le meilleur score Tri de Cristaux depuis localStorage
  // POURQUOI clé hg_game_crystals_best : préfixe hg_ pour éviter collisions,
  //           clé courte et lisible, indépendante de la structure D (hg4)
  const bestScore = localStorage.getItem('hg_game_crystals_best');
  const scoreEl   = document.getElementById('cristaux-best-score');
  if (scoreEl) {
    // POURQUOI parseInt : localStorage stocke des strings — on convertit pour comparer proprement
    scoreEl.textContent = bestScore !== null
      ? `Meilleur : ${parseInt(bestScore, 10)} pts`
      : 'Meilleur : —';
  }
}

// RÔLE : Exposer renderGameHub globalement pour ui-nav.js (go('game'))
window.renderGameHub = renderGameHub;

/* ─── §2 : LANCER CRISTAUX ────────────────────────────────── */

/**
 * RÔLE : Lance le jeu Tri de Cristaux — cache le hub, affiche la zone canvas.
 * POURQUOI : Séparé de renderGameHub pour que chaque jeu ait son propre point
 *            d'entrée. Le canvas reste vide au sprint 1 — la logique de jeu
 *            (instance p5, boucle, score) sera injectée au sprint 2.
 */
function lancerCristaux() {
  const hub     = document.getElementById('game-hub');
  const canvas  = document.getElementById('game-canvas-container');
  const backBtn = document.getElementById('game-back-btn');

  if (hub)     hub.style.display     = 'none';
  if (canvas)  canvas.style.display  = '';
  if (backBtn) backBtn.style.display = '';

  // RÔLE : Placeholder visuel — sera remplacé par l'init p5 au sprint 2
  // POURQUOI : Donne un retour visuel immédiat sans laisser la zone complètement vide
  if (canvas && !canvas.querySelector('.game-placeholder')) {
    const placeholder = document.createElement('div');
    placeholder.className = 'game-placeholder';
    placeholder.innerHTML = `
      <div style="text-align:center;padding:40px 20px;color:var(--text2);font-family:var(--font-title);font-size:var(--fs-lg);">
        💎 Tri de Cristaux<br>
        <span style="font-family:var(--font-body);font-size:var(--fs-sm);opacity:0.7;">
          Le jeu arrive au sprint 2 ✿
        </span>
      </div>`;
    canvas.appendChild(placeholder);
  }
}

// RÔLE : Exposer lancerCristaux globalement pour le bouton "Jouer" dans index.html
window.lancerCristaux = lancerCristaux;

/* ─── §3 : RETOUR HUB ─────────────────────────────────────── */

/**
 * RÔLE : Détruit l'instance p5 du jeu actif si elle existe, puis revient au hub.
 * POURQUOI : window._cristalSketch.remove() libère le canvas p5 et arrête la boucle
 *            de rendu — sans ça, le jeu continuerait de tourner en arrière-plan et
 *            consommerait des ressources. Le guard ?. est là car au sprint 1 le sketch
 *            n'existe pas encore.
 */
function retourGameHub() {
  // RÔLE : Détruire l'instance p5 si elle existe (sera utilisé au sprint 2)
  // POURQUOI window._cristalSketch?.remove() : l'instance p5 sera créée dans ui-cristaux.js
  //           et stockée sur window pour être accessible ici sans couplage direct
  if (window._cristalSketch) {
    window._cristalSketch.remove();
    window._cristalSketch = null;
  }

  // RÔLE : Vider le placeholder du sprint 1 pour éviter les doublons au prochain lancement
  const canvas = document.getElementById('game-canvas-container');
  if (canvas) canvas.innerHTML = '';

  // RÔLE : Revenir à la vue hub
  renderGameHub();
}

// RÔLE : Exposer retourGameHub globalement pour le bouton "← Retour" dans index.html
window.retourGameHub = retourGameHub;
