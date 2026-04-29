/**
 * debug-salete.js — Test du système de saleté HabitGotchi
 * =========================================================
 * UTILISATION :
 *   1. Ouvre l'app dans Chrome/Safari
 *   2. F12 → onglet Console
 *   3. Copie-colle TOUT ce fichier d'un coup (Ctrl+A puis Ctrl+C)
 *   4. Colle dans la console (Ctrl+V) et appuie sur Entrée
 *   5. Les commandes sont maintenant disponibles dans la console
 *
 * COMMANDES :
 *   set(5)        → force salete à 5/10 (seuil — 🛁 devient opaque)
 *   max()         → salete à 10/10 (boue maximale)
 *   clean()       → salete à 0 (Gotchi propre, 🛁 estompé)
 *   status()      → affiche le niveau actuel
 *   simulPoop()   → +1 crotte apparue (+1 salete)
 *   simulTime(12) → simule 12h d'absence (+2 salete)
 *   demo()        → boucle 0→10→0 pour voir la progression visuelle
 *   stopDemo()    → arrête la démo
 */

var _dbgTimer = null;

function set(val) {
  if (!window.D?.g) { console.warn('window.D non disponible'); return; }
  window.D.g.salete = Math.max(0, Math.min(10, val));
  if (typeof save === 'function') save();
  status();
}

function max() { set(10); }
function clean() { set(0); }

function status() {
  var s = window.D?.g?.salete ?? '?';
  console.log('🛁 salete = ' + s + '/10 | ' + (s >= 5 ? 'ICÔNE OPAQUE + dithering actif' : 'icône estompée, Gotchi propre'));
}

function simulPoop() {
  if (!window.D?.g) return;
  window.D.g.salete = Math.min(10, (window.D.g.salete || 0) + 1);
  if (typeof save === 'function') save();
  console.log('💩 +1 crotte → salete = ' + window.D.g.salete + '/10');
}

function simulTime(heures) {
  if (!window.D?.g) return;
  var points = Math.floor(heures / 6);
  window.D.g.salete = Math.min(10, (window.D.g.salete || 0) + points);
  if (typeof save === 'function') save();
  console.log(heures + 'h d\'absence → +' + points + ' pts → salete = ' + window.D.g.salete + '/10');
}

function demo() {
  if (_dbgTimer) { console.log('Démo déjà en cours. Appelle stopDemo() d\'abord.'); return; }
  var val = 0, dir = 1;
  console.log('▶ Démo lancée : 0 → 10 → 0, toutes les 700ms. Regarde le Gotchi !');
  _dbgTimer = setInterval(function() {
    set(val);
    val += dir;
    if (val > 10) { dir = -1; val = 9; }
    if (val < 0)  { dir =  1; val = 1; }
  }, 700);
}

function stopDemo() {
  clearInterval(_dbgTimer);
  _dbgTimer = null;
  console.log('⏹ Démo arrêtée. salete = ' + (window.D?.g?.salete ?? '?'));
}

console.log([
  '',
  '🛁 HabitGotchi — Debug Saleté chargé !',
  '─────────────────────────────────────',
  '  set(5)         → force salete à 5',
  '  max()          → salete 10/10',
  '  clean()        → salete 0 (propre)',
  '  status()       → état actuel',
  '  simulPoop()    → +1 saleté (crotte)',
  '  simulTime(12)  → simule 12h d\'absence',
  '  demo()         → boucle visuelle 0→10→0',
  '  stopDemo()     → arrête la démo',
  '',
].join('\n'));

status();
