/* ============================================================
   ui-atelier.js — Éditeur pixel art "Atelier"
   RÔLE : Permet à l'utilisatrice de peindre des tableaux pixel art
          (12×12 cellules, grille carrée) qui s'affichent dans la chambre du gotchi.
   SYSTÈME : S5 (UI & Design)
   Dépend de : app.js (window.D, save), ui-core.js (lockScroll, unlockScroll, toast)
   Chargé après ui-agenda.js, avant ui-nav.js.
   ============================================================

   CONTENU :
   §1  Constantes
   §2  État interne du module
   §3  Helpers internes (getEnvTheme, _atelierCrêerTableau, _atelierSelectTableau)
   §4  Logique canvas (rendu + events pointer)
   §5  Rendu palette
   §6  Rendu galerie
   §7  API publique (ouvrirAtelier, fermerAtelier, renderAtelier, _atelierSetActif)
   ============================================================ */

/* ============================================================
   §1  CONSTANTES
   ============================================================ */

// RÔLE : Dimensions de la grille de dessin.
// POURQUOI : 12×12 = grille carrée → les cellules de l'éditeur ont le même ratio
//            que la zone du cadre mural dans la scène (30×30 px scène), ce qui
//            évite toute déformation à l'affichage dans la chambre.
const ATELIER_COLS = 12; // nombre de colonnes
const ATELIER_ROWS = 12; // nombre de lignes
// RÔLE : Taille d'une cellule en pixels CSS dans l'éditeur (canvas affiché 256×192px).
// POURQUOI : 16px par cellule = lisible sur mobile sans occuper tout l'écran.
const ATELIER_CELL = 16;
// RÔLE : Nombre maximal de tableaux dans la galerie personnelle.
// POURQUOI : Limite la complexité de la galerie et évite une surcharge de données.
const ATELIER_MAX  = 3;

/* ============================================================
   §2  ÉTAT INTERNE DU MODULE
   Ces variables ne sont pas exposées — elles sont privées au module.
   ============================================================ */

// RÔLE : ID du tableau actuellement en cours d'édition dans l'éditeur.
let _atelierEditId   = null;

// RÔLE : Couleur active pour le pinceau (hex string) ou null si l'outil actif est la gomme.
let _atelierColor    = null;

// RÔLE : Indique si le doigt / la souris est actuellement posé sur le canvas.
// POURQUOI : Permet à pointermove de dessiner uniquement pendant un drag, pas au survol.
let _atelierPainting = false;

/* ============================================================
   §3  HELPERS INTERNES
   ============================================================ */

// ─────────────────────────────────────────────────────────────
// RÔLE : Retourne l'entrée ENV_THEMES correspondant à un id de thème.
// POURQUOI : Centralise l'accès pour ne pas dupliquer le find() partout.
// ─────────────────────────────────────────────────────────────
function getEnvTheme(id) {
  // ENV_THEMES est défini dans data/config.js
  return ENV_THEMES.find(t => t.id === id) ?? ENV_THEMES[0];
}

// ─────────────────────────────────────────────────────────────
// RÔLE : Crée un nouveau tableau vierge avec les métadonnées initiales.
// POURQUOI : Centralise la construction pour garantir la cohérence de structure.
// ─────────────────────────────────────────────────────────────
function _atelierCréerTableau() {
  const themeId  = window.D.g.envTheme ?? 'pastel';
  const thème    = getEnvTheme(themeId);
  return {
    id:              'tb_' + Date.now(),
    createdAt:       Date.now(),
    updatedAt:       Date.now(),
    themeId:         themeId,
    // POURQUOI : On fait une copie du tableau (spread) pour éviter qu'une mutation
    //            du tableau en cours d'édition ne modifie la constante ENV_THEMES.
    paletteSnapshot: [...thème.paintPalette],
    // POURQUOI : Array.from avec fill(null) — chaque ligne est un tableau indépendant.
    //            Si on faisait Array(ROWS).fill(Array(COLS).fill(null)), toutes les lignes
    //            partageraient la même référence et un seul pixel colorerait toute la colonne.
    pixels: Array.from({ length: ATELIER_ROWS }, () => Array(ATELIER_COLS).fill(null))
  };
}

// ─────────────────────────────────────────────────────────────
// RÔLE : Sélectionne un tableau existant comme tableau courant d'édition.
// POURQUOI : Met à jour l'état interne et rafraîchit toute l'UI de l'atelier.
// ─────────────────────────────────────────────────────────────
function _atelierSelectTableau(id) {
  _atelierEditId = id;
  // Sélectionne la première couleur de la palette du tableau chargé comme couleur par défaut
  const tb = window.D.atelier.tableaux.find(t => t.id === id);
  if (tb && tb.paletteSnapshot.length > 0) {
    _atelierColor = tb.paletteSnapshot[0];
  }
  renderAtelier(); // redessine tout
}

/* ============================================================
   §4  LOGIQUE CANVAS
   ============================================================ */

// RÔLE : Taille de cellule courante en pixels CSS, calculée dynamiquement par _atelierFitCanvas().
// POURQUOI : Le canvas occupe toute la zone disponible — la taille de cellule varie selon l'écran.
//            On stocke la valeur ici pour la partager entre _atelierRenderCanvas() et _atelierCellFromEvent().
let _atelierCellPx = ATELIER_CELL; // valeur par défaut (16px), écrasée à l'ouverture

// ─────────────────────────────────────────────────────────────
// RÔLE : Calcule la taille de cellule optimale pour que le canvas remplisse
//        au maximum la zone #atelier-canvas-zone sans déborder.
// POURQUOI : L'overlay est plein écran — on veut que la toile soit aussi grande que possible.
//            On prend le minimum entre (largeur zone / COLS) et (hauteur zone / ROWS),
//            puis on arrondit à l'entier inférieur pour conserver des cellules entières
//            (évite les artefacts de sous-pixel sur le rendu pixelated).
// ─────────────────────────────────────────────────────────────
function _atelierFitCanvas() {
  const zone = document.getElementById('atelier-canvas-zone');
  if (!zone) { _atelierCellPx = ATELIER_CELL; return; }

  // POURQUOI : on soustrait les paddings latéraux (16px × 2) et verticaux (8px × 2)
  //            ajoutés sur #atelier-canvas-zone pour aligner le canvas avec le footer.
  const zoneW = zone.clientWidth  - 32;
  const zoneH = zone.clientHeight - 16;

  const cellParLargeur = Math.floor(zoneW / ATELIER_COLS);
  const cellParHauteur  = Math.floor(zoneH / ATELIER_ROWS);

  // Le facteur limitant est la dimension la plus contrainte
  _atelierCellPx = Math.max(4, Math.min(cellParLargeur, cellParHauteur));
}

// ─────────────────────────────────────────────────────────────
// RÔLE : Redessine entièrement le canvas à partir des données du tableau courant.
// POURQUOI : Appelé après chaque coup de pinceau et à l'ouverture de l'atelier.
//            Utilise _atelierCellPx (calculé par _atelierFitCanvas) pour la taille des cellules.
// ─────────────────────────────────────────────────────────────
function _atelierRenderCanvas() {
  const canvas = document.getElementById('atelier-canvas');
  if (!canvas) return;

  const cell = _atelierCellPx;

  // Dimensionner le canvas en pixels CSS (1:1 avec les pixels écran — devicePixelRatio ignoré
  // intentionnellement pour conserver le rendu pixelisé natif sans upscaling)
  canvas.width  = ATELIER_COLS * cell;
  canvas.height = ATELIER_ROWS * cell;
  // Appliquer la même taille en CSS pour éviter que le navigateur ne re-stretche le canvas
  canvas.style.width  = (ATELIER_COLS * cell) + 'px';
  canvas.style.height = (ATELIER_ROWS * cell) + 'px';

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ── Fond blanc ──
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // ── Pixels colorés ──
  const tb = window.D.atelier.tableaux.find(t => t.id === _atelierEditId);
  if (tb) {
    for (let row = 0; row < ATELIER_ROWS; row++) {
      for (let col = 0; col < ATELIER_COLS; col++) {
        const couleur = tb.pixels[row][col];
        if (couleur) {
          // POURQUOI : Couleurs d'abord, grille par-dessus → les lignes restent toujours visibles
          ctx.fillStyle = couleur;
          ctx.fillRect(col * cell, row * cell, cell, cell);
        }
      }
    }
  }

  // ── Grille ──
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth   = 0.5;
  for (let col = 0; col <= ATELIER_COLS; col++) {
    ctx.beginPath();
    ctx.moveTo(col * cell, 0);
    ctx.lineTo(col * cell, canvas.height);
    ctx.stroke();
  }
  for (let row = 0; row <= ATELIER_ROWS; row++) {
    ctx.beginPath();
    ctx.moveTo(0, row * cell);
    ctx.lineTo(canvas.width, row * cell);
    ctx.stroke();
  }
}

// ─────────────────────────────────────────────────────────────
// RÔLE : Calcule la cellule (col, row) touchée à partir d'un événement pointer.
// POURQUOI : On divise par _atelierCellPx (taille réelle) et on clamp pour ne pas
//            sortir de la grille en cas de dépassement en bord de canvas.
// ─────────────────────────────────────────────────────────────
function _atelierCellFromEvent(e) {
  const canvas = document.getElementById('atelier-canvas');
  // POURQUOI : Sur mobile, offsetX/offsetY n'est pas toujours fiable après pointer capture
  //            — on recalcule depuis getBoundingClientRect si nécessaire.
  let x = e.offsetX;
  let y = e.offsetY;
  if (x === undefined || isNaN(x)) {
    const rect = canvas.getBoundingClientRect();
    x = e.clientX - rect.left;
    y = e.clientY - rect.top;
  }
  const cell = _atelierCellPx;
  const col = Math.max(0, Math.min(ATELIER_COLS - 1, Math.floor(x / cell)));
  const row = Math.max(0, Math.min(ATELIER_ROWS - 1, Math.floor(y / cell)));
  return { col, row };
}

// ─────────────────────────────────────────────────────────────
// RÔLE : Peint (ou efface) la cellule sous le pointeur.
// POURQUOI : Factorisé pour éviter de dupliquer la logique entre pointerdown et pointermove.
// ─────────────────────────────────────────────────────────────
function _atelierPeindreCell(e) {
  const tb = window.D.atelier.tableaux.find(t => t.id === _atelierEditId);
  if (!tb) return;
  const { col, row } = _atelierCellFromEvent(e);
  // POURQUOI : _atelierColor = null signifie "gomme" → on remet la cellule à null (transparente).
  tb.pixels[row][col] = _atelierColor;
  tb.updatedAt = Date.now();
  // POURQUOI : On ne redessine que le canvas (pas toute l'UI) pour ne pas
  //            scintiller la palette et la galerie à chaque pixel.
  _atelierRenderCanvas();
  // RÔLE : Sauvegarde différée après chaque coup de pinceau.
  // POURQUOI : save() direct serait trop fréquent pendant un tracé (plusieurs appels/seconde).
  //            saveDebounced() attend ~2s d'inactivité avant d'écrire — bon compromis entre
  //            sécurité des données et performance. Évite la perte de pixels si l'app est
  //            quittée sans fermer l'atelier proprement (iOS, mise en veille).
  saveDebounced();
}

// ─────────────────────────────────────────────────────────────
// RÔLE : Attache les event listeners au canvas de l'éditeur.
// POURQUOI : Appelé depuis renderAtelier() chaque fois que le canvas est recréé,
//            pour éviter les listeners orphelins sur un ancien élément.
// ─────────────────────────────────────────────────────────────
function _atelierBindCanvas() {
  const canvas = document.getElementById('atelier-canvas');
  if (!canvas) return;

  // Nettoie les anciens listeners via le flag data-atelier-bound
  // POURQUOI : Si renderAtelier() est appelé plusieurs fois (ex. changement de tableau),
  //            on ne veut pas accumuler des doubles listeners.
  if (canvas.dataset.atelierBound === '1') return;
  canvas.dataset.atelierBound = '1';

  // ── Pointer events (souris + touch unifiés) ──
  canvas.addEventListener('pointerdown', function(e) {
    e.preventDefault(); // bloque le comportement navigateur par défaut (sélection de texte, etc.)
    _atelierPainting = true;
    canvas.setPointerCapture(e.pointerId); // garde le pointeur même si on sort du canvas
    _atelierPeindreCell(e);
  });

  canvas.addEventListener('pointermove', function(e) {
    if (!_atelierPainting) return; // ne dessine que pendant un drag
    e.preventDefault();
    _atelierPeindreCell(e);
  });

  canvas.addEventListener('pointerup', function(e) {
    _atelierPainting = false;
  });

  canvas.addEventListener('pointercancel', function(e) {
    // POURQUOI : pointercancel est déclenché quand le navigateur interrompt l'événement
    //            (ex. scroll iOS qui prend le contrôle). On arrête simplement le dessin.
    _atelierPainting = false;
  });

  // ── Blocage scroll iOS sur touchstart/touchmove ──
  // POURQUOI : Sur iOS, touchmove sans preventDefault fait scroller la page même avec
  //            lockScroll() actif si l'élément lui-même ne l'intercepte pas.
  //            return false équivaut à preventDefault() + stopPropagation() en inline handler,
  //            mais ici on utilise addEventListener avec { passive: false }.
  canvas.addEventListener('touchstart', function(e) { e.preventDefault(); }, { passive: false });
  canvas.addEventListener('touchmove',  function(e) { e.preventDefault(); }, { passive: false });
}

/* ============================================================
   §5  RENDU PALETTE
   ============================================================ */

// ─────────────────────────────────────────────────────────────
// RÔLE : Redessine la palette de couleurs du tableau courant.
// POURQUOI : 8 boutons colorés + 1 gomme. Le bouton actif a un ring visuel.
// ─────────────────────────────────────────────────────────────
function _atelierRenderPalette() {
  const container = document.getElementById('atelier-palette');
  if (!container) return;

  const tb = window.D.atelier.tableaux.find(t => t.id === _atelierEditId);
  const couleurs = tb ? tb.paletteSnapshot : [];

  // RÔLE : Calculer la taille des boutons pour que la palette occupe exactement
  //        la même largeur que la galerie (#atelier-galerie).
  // POURQUOI : 13 couleurs + 1 gomme = 14 boutons. On veut 7 colonnes × 2 rangées.
  //            On prend la largeur réelle de la galerie comme référence, et on calcule
  //            la taille de bouton qui remplit exactement cette largeur avec 7 colonnes
  //            et un gap uniforme entre elles.
  // POURQUOI : footer.clientWidth inclut les paddings (16px×2=32px) — on les soustrait
  //            pour obtenir la largeur du contenu, identique à celle de la galerie.
  //            Cascade si clientWidth vaut 0 au premier rendu.
  const footer   = document.getElementById('atelier-footer');
  const overlayW = document.getElementById('atelier-overlay')?.clientWidth;
  const rawW     = (footer?.clientWidth) || (overlayW ? overlayW : 0) || window.innerWidth || 332;
  const totalW   = rawW - 32; // soustrait padding 16px gauche + 16px droite du footer
  const N_COLS   = 7;   // 7 colonnes × 2 rangées = 14 cases (13 couleurs + 1 gomme)
  const GAP      = 8;   // gap fixe entre boutons (px)
  const btnSize  = Math.max(28, Math.floor((totalW - GAP * (N_COLS - 1)) / N_COLS));

  // POURQUOI : width explicite sur le div pour contraindre la grille à ne pas dépasser
  //            la largeur du footer — évite le débordement à droite sur petits écrans.
  let html = `<div style="display:grid;grid-template-columns:repeat(${N_COLS},${btnSize}px);gap:${GAP}px;width:${totalW}px;">`;

  // ── 13 boutons colorés ──
  couleurs.forEach((hex, i) => {
    // POURQUOI : ring outline visible sur n'importe quelle couleur sans calcul de contraste.
    const actif = (_atelierColor === hex);
    const ring  = actif
      ? 'outline:3px solid var(--text);outline-offset:3px;'
      : 'outline:1px solid rgba(0,0,0,0.18);outline-offset:1px;';
    html += `<button
      onclick="window._atelierChoisirCouleur('${hex}')"
      aria-label="Couleur ${i + 1}"
      style="width:${btnSize}px;height:${btnSize}px;border-radius:50%;border:none;cursor:pointer;
             background:${hex};${ring}flex-shrink:0;"></button>`;
  });

  // ── Bouton gomme (14e élément → col 7, rangée 2 automatique) ──
  const gommeActif = (_atelierColor === null);
  const gommeRing  = gommeActif
    ? 'outline:3px solid var(--text);outline-offset:3px;'
    : 'outline:1px solid rgba(0,0,0,0.18);outline-offset:1px;';
  html += `<button
    onclick="window._atelierChoisirCouleur(null)"
    aria-label="Gomme"
    title="Gomme"
    style="width:${btnSize}px;height:${btnSize}px;border-radius:50%;border:none;cursor:pointer;
           background:var(--bg);font-size:${Math.round(btnSize * 0.45)}px;font-weight:700;color:var(--text2);
           ${gommeRing}flex-shrink:0;display:flex;align-items:center;justify-content:center;">✕</button>`;

  html += `</div>`;
  container.innerHTML = html;
}

/* ============================================================
   §6  RENDU GALERIE
   ============================================================ */

// ─────────────────────────────────────────────────────────────
// RÔLE : Redessine la galerie des tableaux sauvegardés.
// POURQUOI : Affiche les vignettes, le badge ★ sur le tableau actif,
//            et le bouton "+ Nouveau" avec la limite ATELIER_MAX.
// ─────────────────────────────────────────────────────────────
function _atelierRenderGalerie() {
  const container = document.getElementById('atelier-galerie');
  if (!container) return;

  const tableaux = window.D.atelier.tableaux;
  const activeId = window.D.atelier.activeId;

  // RÔLE : Calculer la largeur de référence pour les vignettes.
  // POURQUOI : container.clientWidth peut valoir 0 si le layout n'est pas encore stabilisé
  //            (premier rendu, overlay qui vient d'apparaître). On remonte au footer,
  //            puis au parent overlay, puis à window.innerWidth comme dernier recours.
  //            On soustrait les paddings latéraux du footer (16px × 2 = 32px).
  const footer    = document.getElementById('atelier-footer');
  const overlayW  = document.getElementById('atelier-overlay')?.clientWidth;
  const refW      = (footer?.clientWidth) || (overlayW ? overlayW - 32 : 0) || (window.innerWidth - 32) || 300;

  const nSlots   = tableaux.length + (tableaux.length < ATELIER_MAX ? 1 : 0);
  const GAP_VIG  = 10; // gap entre les vignettes (px)
  const gapTotal = (nSlots - 1) * GAP_VIG;
  const vigW     = Math.max(40, Math.floor((refW - gapTotal) / nSlots));
  // POURQUOI : grille carrée (12×12) → ratio 1:1, hauteur = largeur
  const vigH     = vigW;

  // POURQUOI : flex:1 sur chaque slot + width:100% sur l'img → les vignettes s'étirent
  //            pour occuper exactement toute la largeur, même si vigW est approximatif.
  let html = `<div style="display:flex;gap:${GAP_VIG}px;align-items:stretch;width:100%">`;

  tableaux.forEach(tb => {
    const imgSrc     = _atelierVignette(tb, vigW, vigH);
    const estActif   = (tb.id === _atelierEditId);
    const estChambre = (tb.id === activeId);

    const bordure = estActif
      ? `border:3px solid var(--text);`
      : `border:2px solid var(--border);`;

    html += `<div style="position:relative;cursor:pointer;flex:1;min-width:0" onclick="_atelierSelectTableau('${tb.id}')">
      <img src="${imgSrc}" width="${vigW}" height="${vigH}"
        style="display:block;width:100%;height:auto;aspect-ratio:1/1;border-radius:6px;image-rendering:pixelated;${bordure}" />
      ${estChambre ? `<span style="position:absolute;top:-10px;right:-4px;font-size:20px;line-height:1">⭐️</span>` : ''}
    </div>`;
  });

  // ── Bouton "+ Nouveau" — flex:1 identique aux vignettes ──
  if (tableaux.length < ATELIER_MAX) {
    html += `<button onclick="_atelierNouveauTableau()"
      style="flex:1;min-width:0;aspect-ratio:1/1;border-radius:6px;border:2px dashed var(--border);
             background:none;cursor:pointer;color:var(--text2);font-size:22px;">+</button>`;
  }

  html += `</div>`;

  // ── Ligne d'actions secondaires sous la galerie ──
  // RÔLE : Vider le tableau courant + réafficher le motif par défaut dans la chambre
  // POURQUOI : deux actions destructives/réversibles peu fréquentes → petits boutons discrets
  //            séparés du bouton principal "Afficher dans la chambre"
  const motifActif = (activeId === null);
  html += `<div style="display:flex;gap:8px;margin-top:2px">
    <button onclick="_atelierViderTableau()"
      style="flex:1;padding:6px 0;border-radius:6px;border:1px solid var(--border);
             background:none;cursor:pointer;color:var(--text2);font-size:12px;">
      🗑 Vider le tableau</button>
    <button onclick="_atelierMotifDefaut()"
      style="flex:1;padding:6px 0;border-radius:6px;border:1px solid var(--border);
             background:none;cursor:pointer;font-size:12px;
             color:${motifActif ? 'var(--text)' : 'var(--text2)'};
             font-weight:${motifActif ? '700' : '400'};">
      ${motifActif ? '★ ' : ''}Motif par défaut</button>
  </div>`;

  container.innerHTML = html;
}

// ─────────────────────────────────────────────────────────────
// RÔLE : Génère une vignette à la taille demandée (W×H pixels).
// POURQUOI : La galerie calcule dynamiquement la taille optimale — on passe W et H
//            au lieu de valeurs fixes pour que les vignettes remplissent exactement la ligne.
// ─────────────────────────────────────────────────────────────
function _atelierVignette(tb, W, H) {
  // Valeurs par défaut si appelé sans dimensions (ex. test)
  W = W || 48;
  H = H || 36;
  const cellW = W / ATELIER_COLS;
  const cellH = H / ATELIER_ROWS;

  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  for (let row = 0; row < ATELIER_ROWS; row++) {
    for (let col = 0; col < ATELIER_COLS; col++) {
      const c = tb.pixels[row][col];
      if (c) {
        ctx.fillStyle = c;
        ctx.fillRect(
          Math.round(col * cellW),
          Math.round(row * cellH),
          Math.ceil(cellW),
          Math.ceil(cellH)
        );
      }
    }
  }

  return canvas.toDataURL('image/png');
}

/* ============================================================
   §7  API PUBLIQUE
   Toutes les fonctions exposées sur window.* sont ici.
   ============================================================ */

// ─────────────────────────────────────────────────────────────
// RÔLE : Choisit la couleur active du pinceau (ou null pour la gomme).
// POURQUOI : Exposée sur window pour être appelée depuis les boutons palette en HTML inline.
// ─────────────────────────────────────────────────────────────
window._atelierChoisirCouleur = function(hex) {
  _atelierColor = hex; // null = gomme
  _atelierRenderPalette(); // rafraîchit le ring visuel
};

// ─────────────────────────────────────────────────────────────
// RÔLE : Crée un nouveau tableau vierge et le sélectionne.
// POURQUOI : Exposée sur window pour être appelée depuis le bouton "+" de la galerie.
// ─────────────────────────────────────────────────────────────
window._atelierNouveauTableau = function() {
  if (window.D.atelier.tableaux.length >= ATELIER_MAX) {
    // POURQUOI : On informe sans bloquer le flux (toast non-bloquant).
    toast('3 tableaux max — supprime d\'abord un tableau');
    return;
  }
  const nouveau = _atelierCréerTableau();
  window.D.atelier.tableaux.push(nouveau);
  save(); // RÔLE : persiste immédiatement la création du tableau
          // POURQUOI : évite la perte si l'app est quittée sans fermer l'atelier.
  _atelierSelectTableau(nouveau.id);
};

// ─────────────────────────────────────────────────────────────
// RÔLE : Ouvre l'overlay Atelier et initialise l'état de l'éditeur.
// POURQUOI : Sélectionne le tableau actif, ou le premier, ou en crée un si la galerie est vide.
// ─────────────────────────────────────────────────────────────
window.ouvrirAtelier = function() {
  const overlay = document.getElementById('atelier-overlay');
  if (!overlay) return;

  overlay.style.display = 'flex';
  lockScroll(); // RÔLE : bloque le scroll iOS derrière l'overlay

  const { tableaux, activeId } = window.D.atelier;

  if (tableaux.length === 0) {
    // Galerie vide → crée un premier tableau
    const nouveau = _atelierCréerTableau();
    window.D.atelier.tableaux.push(nouveau);
    _atelierEditId = nouveau.id;
    _atelierColor  = nouveau.paletteSnapshot[0] ?? null;
    save(); // RÔLE : persiste immédiatement le nouveau tableau créé
            // POURQUOI : si l'app est quittée sans fermer l'atelier proprement
            //            (iOS, mise en veille), le tableau ne serait pas enregistré.
  } else {
    // Sélectionne le tableau actif s'il existe, sinon le premier
    const cible = tableaux.find(t => t.id === activeId) ?? tableaux[0];
    _atelierEditId = cible.id;

    // RÔLE : Met à jour la palette de TOUS les tableaux depuis le thème actif.
    // POURQUOI : Si l'utilisatrice a changé de thème depuis la dernière ouverture,
    //            toutes les paletteSnapshot seraient obsolètes — pas seulement celle
    //            du tableau courant. On rafraîchit tous les tableaux en une passe
    //            pour que la palette soit cohérente quelle que soit la vignette ouverte.
    //            Les pixels déjà peints ne sont pas affectés.
    const thèmeActuel = getEnvTheme(window.D.g.envTheme ?? 'pastel');
    tableaux.forEach(tb => {
      tb.paletteSnapshot = [...thèmeActuel.paintPalette];
    });

    // Si la couleur active n'est plus dans la nouvelle palette, on prend la première
    if (!cible.paletteSnapshot.includes(_atelierColor)) {
      _atelierColor = cible.paletteSnapshot[0] ?? null;
    }
  }

  renderAtelier();
};

// ─────────────────────────────────────────────────────────────
// RÔLE : Ferme l'overlay Atelier et sauvegarde les données.
// POURQUOI : save() est appelé ici (et uniquement ici + _atelierSetActif)
//            pour éviter d'écrire dans localStorage à chaque coup de pinceau.
// ─────────────────────────────────────────────────────────────
window.fermerAtelier = function() {
  const overlay = document.getElementById('atelier-overlay');
  if (overlay) overlay.style.display = 'none';
  unlockScroll();
  save(); // RÔLE : persiste les pixels dessinés dans localStorage
};

// ─────────────────────────────────────────────────────────────
// RÔLE : Redessine entièrement l'interface de l'atelier (canvas + palette + galerie + bouton).
// POURQUOI : Appelé à l'ouverture et après chaque changement de tableau actif.
// ─────────────────────────────────────────────────────────────
window.renderAtelier = function() {
  // POURQUOI : _atelierFitCanvas() DOIT être appelé avant _atelierRenderCanvas()
  //            pour que _atelierCellPx soit à jour avec la taille réelle de la zone.
  //            Si l'overlay vient d'être rendu visible (display:flex), le layout
  //            est déjà calculé par le navigateur à ce stade — clientWidth/Height sont fiables.
  _atelierFitCanvas();
  _atelierRenderCanvas();
  // POURQUOI : _atelierBindCanvas() est idempotent grâce au flag data-atelier-bound.
  _atelierBindCanvas();
  _atelierRenderPalette();
  _atelierRenderGalerie();
  _atelierMajBoutonActiver();
};

// ─────────────────────────────────────────────────────────────
// RÔLE : Définit le tableau courant comme tableau affiché dans la chambre.
// POURQUOI : Met à jour D.atelier.activeId et sauvegarde immédiatement.
// ─────────────────────────────────────────────────────────────
window._atelierSetActif = function() {
  if (!_atelierEditId) return;
  window.D.atelier.activeId = _atelierEditId;
  save(); // RÔLE : persiste le choix dans localStorage
  _atelierMajBoutonActiver();
  _atelierRenderGalerie(); // rafraîchit le badge ★
  toast('Tableau affiché dans la chambre ✓');
};

// ─────────────────────────────────────────────────────────────
// RÔLE : Efface tous les pixels du tableau en cours d'édition.
// POURQUOI : Permet de repartir d'une toile vierge sans recréer un nouveau tableau.
// ─────────────────────────────────────────────────────────────
window._atelierViderTableau = function() {
  const tb = window.D.atelier.tableaux.find(t => t.id === _atelierEditId);
  if (!tb) return;
  // Remet toutes les cellules à null (transparent = fond frameBg visible)
  tb.pixels = Array.from({ length: ATELIER_ROWS }, () => Array(ATELIER_COLS).fill(null));
  tb.updatedAt = Date.now();
  save();
  _atelierRenderCanvas();
  _atelierRenderGalerie(); // met à jour la vignette
};

// ─────────────────────────────────────────────────────────────
// RÔLE : Désactive le tableau actif → le motif abstrait par défaut réapparaît dans la chambre.
// POURQUOI : activeId=null → drawAtelierFrame() replie sur drawFrameMotif().
// ─────────────────────────────────────────────────────────────
window._atelierMotifDefaut = function() {
  window.D.atelier.activeId = null;
  save();
  _atelierMajBoutonActiver();
  _atelierRenderGalerie(); // retire le badge ⭐️ de toutes les vignettes
  toast('Motif par défaut restauré dans la chambre');
};

// ─────────────────────────────────────────────────────────────
// RÔLE : Met à jour le texte du bouton "Afficher dans la chambre" selon l'état courant.
// POURQUOI : Indique à l'utilisatrice si le tableau en cours d'édition est déjà l'actif.
// ─────────────────────────────────────────────────────────────
function _atelierMajBoutonActiver() {
  const btn = document.getElementById('btn-atelier-activer');
  if (!btn) return;
  const estDejàActif = (_atelierEditId === window.D.atelier.activeId);
  btn.textContent = estDejàActif ? '★ Affiché dans la chambre' : 'Afficher dans la chambre';
  btn.style.opacity = estDejàActif ? '0.6' : '1';
}
