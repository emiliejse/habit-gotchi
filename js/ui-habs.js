/* ============================================================
   ui-habs.js — Système des habitudes (S4)
   RÔLE : Rendu, édition inline et modale de personnalisation
          des habitudes dans l'onglet Gotchi et Settings.
   Dépend de : app.js (window.D, save, today, toggleHab, CATS)
               ui-core.js (openModal, clModal, escape)
   ============================================================

   CONTENU :
   §1  renderHabs()               — rendu de la liste des habitudes
   §2  editHabInline()            — édition inline d'un label
   §3  saveHabInline()            — sauvegarde l'édition inline
   §4  deplacerHab()              — réordonne les habitudes dans la modale
   §5  ouvrirEditionHabitudes()   — modale de renommage + réordonnancement
   §6  sauvegarderToutesHabitudes() — valide et sauvegarde la modale
   ============================================================ */

function renderHabs() {
  const D = window.D;
  const td = today(), log = D.log[td] || [], done = log.length;

  // --- Page d'accueil : liste des habitudes ---
  const habHome = document.getElementById('hab-home');
  if (habHome) {
    // RÔLE : Identifier la première habitude non-cochée pour la mettre en avant
    // POURQUOI : Offrir un point d'entrée immédiat → réduit le coût décisionnel au démarrage
    const firstUndoneIndex = D.habits.findIndex(h => !log.includes(h.catId));

// RÔLE : Mini-bar visuelle — 6 badges ronds avec icône, verts si l'habitude est cochée
    // POURQUOI : Vue d'ensemble instantanée en haut du bloc, non-cliquable (lecture seule)
    const miniBar = `<div class="hab-mini-bar">
      ${D.habits.map(h => {
        const c = CATS.find(c => c.id === h.catId);
        const isDone = log.includes(h.catId);
        return `<div class="hab-mini ${isDone ? 'done' : ''}" title="${h.label || c?.label || ''}">${c?.icon || '✿'}</div>`;
      }).join('')}
    </div>`;
    habHome.innerHTML = miniBar;
    habHome.innerHTML += D.habits.map((h, i) => {
  const c = CATS.find(c => c.id === h.catId);
  const d = log.includes(h.catId);
  const libelle = (h.label !== c?.label) ? h.label : (c?.def || h.label);
  // Ajoute .hab--next uniquement sur la première habitude non-cochée (si toutes pas finies)
  const isNext = !d && i === firstUndoneIndex && done < D.habits.length;

  // RÔLE : Affiche le badge streak 🔥×N à droite du label si streak ≥ 2.
  // POURQUOI : Visible seulement à partir de 2 jours pour ne pas polluer la vue
  //            dès le premier cochage — le feedback commence à la régularité.
  const streak = (D.streaks || {})[h.catId] || 0;
  const streakBadge = streak >= 2
    ? `<span class="streak-badge" title="${streak} jours d'affilée" style="font-size:10px;opacity:0.85;margin-right:4px;color:var(--amber,#f59e0b)">🔥×${streak}</span>`
    : '';

  return `
    <div class="hab ${d ? 'done' : ''} ${isNext ? 'hab--next' : ''}" style="position:relative">
      <div class="ck" onclick="toggleHab('${h.catId}')">${d ? '✓' : ''}</div>
      <span id="hab-label-${h.catId}" style="flex:1;font-size:12px;cursor:pointer"
        onclick="toggleHab('${h.catId}')">${libelle}</span>
      ${streakBadge}
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

