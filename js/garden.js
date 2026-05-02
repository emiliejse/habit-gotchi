/* ============================================================
   garden.js — Biome Jardin (Environnement procédural — Phase 1 : fondations)
   RÔLE : Dessine l'environnement "Jardin" en deux passes distinctes :
          • drawJardinFond()        → arrière-plan (sol, éléments derrière le Gotchi)
          • drawJardinPremierPlan() → premier plan (éléments devant le Gotchi)
   POURQUOI deux passes : render.js appelle drawJardinFond() AVANT le Gotchi
          et drawJardinPremierPlan() APRÈS — ce séquencement donne la profondeur visuelle.

   NAVIGATION RAPIDE :
   §1  ~30   FOND             drawJardin() + drawJardinFond()
   §2  ~60   PREMIER PLAN     drawJardinPremierPlan()
   ============================================================ */

/* ─── §1 : FOND ──────────────────────────────────────────────────── */

/**
 * drawJardin() : point d'entrée appelé par drawActiveEnv() dans envs.js
 * RÔLE : Délègue au fond du jardin — la passe premier plan est gérée
 *        séparément dans p.draw() (render.js) après le dessin du Gotchi.
 * @param {Object} p     - Instance p5.js
 * @param {Object} theme - Thème actif (depuis getEnvC() dans envs.js)
 * @param {number} n     - Ratio nuit 0 (jour) → 1 (nuit pleine)
 */
function drawJardin(p, theme, n) {
  // RÔLE : Appelle uniquement la passe de fond depuis le dispatcher.
  // POURQUOI : drawJardinPremierPlan() sera appelée APRÈS le Gotchi dans p.draw()
  //            — elle ne doit pas passer ici pour maintenir l'ordre z correct.
  drawJardinFond(p, theme, n);
}
window.drawJardin = drawJardin;

/**
 * drawJardinFond() : passe arrière-plan du Jardin
 * RÔLE : Dessine tout ce qui doit apparaître DERRIÈRE le Gotchi.
 *        Phase 1 : sol herbeux basique uniquement.
 *        Phase 2+ : herbes hautes, buissons de fond, chemins, etc.
 * @param {Object} p     - Instance p5.js
 * @param {Object} theme - Thème actif (couleurs depuis config.js → ENV_THEMES 'jardin')
 * @param {number} n     - Ratio nuit 0 (jour) → 1 (nuit pleine)
 */
function drawJardinFond(p, theme, n) {
  p.noStroke();

  // Sol — aplat herbeux en deux tons pour simuler l'épaisseur de la pelouse.
  // POURQUOI p.rect et non px() : même convention que drawParc/drawMontagne —
  //          les grands aplats de sol utilisent p.rect (coordonnées libres),
  //          les détails pixel art utiliseront px() en Phase 2.
  p.fill(tc(n, theme.gnd));    p.rect(0, 120, CS, 80); // herbe principale
  p.fill(tc(n, theme.gndDk));  p.rect(0, 120, CS, PX * 2); // lisière sombre (2 pixels)

  // Phase 2 : ajouter ici herbes hautes de fond, buissons, chemins de terre…
}
window.drawJardinFond = drawJardinFond;

/* ─── §2 : PREMIER PLAN ──────────────────────────────────────────── */

/**
 * drawJardinPremierPlan() : passe premier plan du Jardin
 * RÔLE : Dessine tout ce qui doit apparaître DEVANT le Gotchi.
 *        Phase 1 : vide — placeholder pour la Phase 2 (herbes courtes, fleurs au bord…).
 * @param {Object} p     - Instance p5.js
 * @param {Object} theme - Thème actif
 * @param {number} n     - Ratio nuit 0 (jour) → 1 (nuit pleine)
 */
function drawJardinPremierPlan(p, theme, n) {
  // Phase 1 : intentionnellement vide.
  // Phase 2 : ajouter ici brins d'herbe courts au bas du canvas, fleurs de bord, insectes…
}
window.drawJardinPremierPlan = drawJardinPremierPlan;
