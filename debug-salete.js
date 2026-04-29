/**
 * debug-salete.js — Outil de test du système de saleté HabitGotchi
 * ================================================================
 * À coller dans la console du navigateur (F12 → Console) pendant que
 * l'app est ouverte. Fonctionne en live sans recharger la page.
 *
 * COMMANDES DISPONIBLES après avoir collé ce code :
 *   dbgSalete.set(7)      → force la saleté à 7/10 (teste l'effet visuel)
 *   dbgSalete.max()       → saleté à 10/10 (boue maximale)
 *   dbgSalete.clean()     → remet à 0 (Gotchi propre)
 *   dbgSalete.status()    → affiche le niveau actuel
 *   dbgSalete.simulPoop() → simule une crotte apparue (+1 saleté)
 *   dbgSalete.simulTime(h)→ simule h heures d'absence (ex: 18h = +3)
 *   dbgSalete.demo()      → boucle auto 0→10→0 pour voir la progression
 *   dbgSalete.stopDemo()  → arrête la boucle de démo
 */

window.dbgSalete = (() => {
  let _demoTimer = null;

  function _apply(val) {
    if (!window.D?.g) { console.warn('[dbgSalete] window.D non disponible'); return; }
    window.D.g.salete = Math.max(0, Math.min(10, val));
    if (typeof save === 'function') save();
    console.log(`[dbgSalete] salete → ${window.D.g.salete}/10`);
  }

  return {
    set(val) {
      _apply(val);
    },

    max() {
      _apply(10);
      console.log('[dbgSalete] Gotchi au max de saleté — tu devrais voir le dithering brun.');
    },

    clean() {
      _apply(0);
      console.log('[dbgSalete] Gotchi propre — 🛁 doit être estompé dans le HUD.');
    },

    status() {
      const s = window.D?.g?.salete ?? '?';
      const hudIcon = s >= 5 ? '🛁 VISIBLE (opaque)' : '🛁 estompé (0.25)';
      const dither  = s >= 5 ? '🟤 dithering actif' : '✨ pas de dithering';
      console.log(`[dbgSalete] Niveau : ${s}/10 | ${hudIcon} | ${dither}`);
      return s;
    },

    simulPoop() {
      if (!window.D?.g) return;
      window.D.g.salete = Math.min(10, (window.D.g.salete || 0) + 1);
      if (typeof save === 'function') save();
      console.log(`[dbgSalete] +1 crotte → salete = ${window.D.g.salete}/10`);
    },

    simulTime(heures) {
      if (!window.D?.g) return;
      const points = Math.floor(heures / 6);
      window.D.g.salete = Math.min(10, (window.D.g.salete || 0) + points);
      if (typeof save === 'function') save();
      console.log(`[dbgSalete] ${heures}h d'absence → +${points} pts → salete = ${window.D.g.salete}/10`);
    },

    demo() {
      if (_demoTimer) { console.log('[dbgSalete] Démo déjà en cours. Appelle stopDemo() d\'abord.'); return; }
      let val = 0;
      let dir = 1;
      console.log('[dbgSalete] Démo lancée : progression 0→10→0, toutes les 600ms.');
      _demoTimer = setInterval(() => {
        _apply(val);
        val += dir;
        if (val > 10) { dir = -1; val = 9; }
        if (val < 0)  { dir = 1;  val = 1; }
      }, 600);
    },

    stopDemo() {
      clearInterval(_demoTimer);
      _demoTimer = null;
      console.log('[dbgSalete] Démo arrêtée.');
    }
  };
})();

// Affiche le guide au chargement
console.log(`
╔══════════════════════════════════════════╗
║  🛁  HabitGotchi — Debug Saleté          ║
╠══════════════════════════════════════════╣
║  dbgSalete.status()      → état actuel   ║
║  dbgSalete.set(5)        → forcer à 5    ║
║  dbgSalete.max()         → max (10)      ║
║  dbgSalete.clean()       → remet à 0     ║
║  dbgSalete.simulPoop()   → +1 crotte     ║
║  dbgSalete.simulTime(12) → 12h d'absence ║
║  dbgSalete.demo()        → boucle visuelle║
║  dbgSalete.stopDemo()    → stop           ║
╚══════════════════════════════════════════╝
`);

dbgSalete.status();
