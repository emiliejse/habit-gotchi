/* ============================================================
   js/games/ui-cristaux.js — Mini-jeu "Tri de Cristaux"
   RÔLE : Contient toute la logique du jeu Tri de Cristaux.
          Squelette sprint 1 — le jeu sera implémenté au sprint 2.

   Dépend de : ui-game.js (retourGameHub, window._cristalSketch)
               p5.js      (instance p5 en mode instance — new p5(sketch, container))

   Convention d'interface avec ui-game.js :
     - window._demarrerCristaux(container) : point d'entrée appelé par lancerCristaux()
     - window._cristalSketch               : instance p5 active (ou null)
     - Score sauvegardé dans localStorage, clé : hg_game_crystals_best

   Ordre de chargement : après ui-game.js, avant ui-nav.js
   ============================================================ */

/**
 * RÔLE : Point d'entrée du jeu — appelé par lancerCristaux() dans ui-game.js.
 * POURQUOI _demarrerCristaux et non lancerCristaux directement :
 *   ui-game.js garde lancerCristaux() comme coordinateur (swap hub↔canvas).
 *   _demarrerCristaux est la logique pure du jeu, indépendante de la navigation.
 *
 * @param {HTMLElement} container — le div #game-canvas-container dans lequel injecter le canvas
 */
function _demarrerCristaux(container) {
  // SPRINT 2 : instancier l'objet p5 ici en mode instance
  // Exemple de structure attendue :
  //
  //   const sketch = (p) => {
  //     p.setup = () => { ... };
  //     p.draw  = () => { ... };
  //   };
  //   window._cristalSketch = new p5(sketch, container);
  //
  // Pour l'instant : rien — ui-game.js affiche le placeholder sprint 1 en fallback.
}

// RÔLE : Exposer le point d'entrée globalement pour ui-game.js
window._demarrerCristaux = _demarrerCristaux;

/**
 * RÔLE : Sauvegarde un nouveau score si meilleur que l'actuel.
 * POURQUOI helper exposé ici : le jeu gère lui-même son scoring,
 *   ui-game.js relit juste la clé localStorage pour l'afficher dans le hub.
 *
 * @param {number} score — score à sauvegarder
 */
function _sauvegarderScoreCristaux(score) {
  const current = parseInt(localStorage.getItem('hg_game_crystals_best') || '0', 10);
  if (score > current) {
    localStorage.setItem('hg_game_crystals_best', String(score));
  }
}

// RÔLE : Exposer pour pouvoir l'appeler depuis la boucle de jeu au sprint 2
window._sauvegarderScoreCristaux = _sauvegarderScoreCristaux;
