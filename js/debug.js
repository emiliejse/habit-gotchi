// RÔLE : Panneau de debug PWA — capture d'erreurs + affichage console in-app.
// POURQUOI : Extrait de index.html pour éviter de polluer le <head> (inline non-cacheable).
//            Chargé conditionnellement (voir commentaire dans index.html).
//            En production, retirer la balise <script src="js/debug.js"> suffit à désactiver.
(function() {
  window._debugLogs = [];

  function showDebug(msg) {
    const stamp = new Date().toLocaleTimeString('fr-FR');
    const line = '[' + stamp + '] ' + msg;
    window._debugLogs.push(line);
    const panel = document.getElementById('debug-panel-content');
    if (panel) panel.textContent = window._debugLogs.join('\n');
  }
  window.showDebug = showDebug;

  window.addEventListener('error', function(e) {
    showDebug('❌ ERR: ' + e.message + ' @ ' + (e.filename || '?').split('/').pop() + ':' + (e.lineno || '?'));
  });
  window.addEventListener('unhandledrejection', function(e) {
    showDebug('❌ PROMISE: ' + (e.reason && e.reason.message ? e.reason.message : e.reason));
  });

  showDebug('✓ Boot | standalone=' + (window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches));
})();

// RÔLE : Ouvre/ferme le panneau de debug flottant (plein écran, fond sombre).
// POURQUOI : Déclenché depuis le bouton "Outils dév" dans les Réglages.
function toggleDebugPanel() {
  let p = document.getElementById('debug-panel');
  if (p) { p.remove(); return; }

  p = document.createElement('div');
  p.id = 'debug-panel';
  // ── Styles : safe-area iOS (encoche/Dynamic Island) + layout inversé (logs en haut, boutons en bas)
  p.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    z-index: 99999;
    background: #1a1a1a;
    color: #0f0;
    padding: calc(env(safe-area-inset-top, 0px) + 16px) 12px calc(env(safe-area-inset-bottom, 0px) + 12px) 12px;
    font: 11px monospace;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-sizing: border-box;
  `;
  p.innerHTML = `
    <pre id="debug-panel-content" style="flex:1;overflow:auto;background:#000;padding:8px;border-radius:4px;white-space:pre-wrap;margin:0;color:#0f0;font:11px monospace"></pre>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button onclick="copyDebugLogs()" style="flex:1;padding:10px;background:#0066cc;color:#fff;border:none;border-radius:4px;font:bold 12px monospace">📋 Copier</button>
      <button onclick="clearDebugLogs()" style="padding:10px 14px;background:#aa4444;color:#fff;border:none;border-radius:4px;font:bold 12px monospace">🗑️</button>
      <button onclick="toggleDebugPanel()" style="padding:10px 14px;background:#444;color:#fff;border:none;border-radius:4px;font:bold 12px monospace">✕ Fermer</button>
    </div>
  `;
  document.body.appendChild(p);
  document.getElementById('debug-panel-content').textContent = (window._debugLogs || []).join('\n');
}

// RÔLE : Copie les logs debug dans le presse-papier.
function copyDebugLogs() {
  const txt = (window._debugLogs || []).join('\n');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(
      () => { if (typeof toast === 'function') toast('✓ Copié'); },
      () => fallbackCopyDebug(txt)
    );
  } else {
    fallbackCopyDebug(txt);
  }
}

// RÔLE : Fallback clipboard pour les contextes sans navigator.clipboard (iOS PWA standalone).
function fallbackCopyDebug(txt) {
  const ta = document.createElement('textarea');
  ta.value = txt;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); if (typeof toast === 'function') toast('✓ Copié'); }
  catch(e) { alert('Impossible de copier. Sélectionne manuellement le texte.'); }
  document.body.removeChild(ta);
}

// RÔLE : Vide la liste des logs debug (sans fermer le panneau).
function clearDebugLogs() {
  window._debugLogs = [];
  const panel = document.getElementById('debug-panel-content');
  if (panel) panel.textContent = '';
}
