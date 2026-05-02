/* ============================================================
   ui-atelier.js — Éditeur pixel art "Atelier"
   RÔLE : Permet à l'utilisatrice de peindre des tableaux pixel art
          (16×12 cellules) qui s'affichent dans la chambre du gotchi.
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
// POURQUOI : 16×12 donne un ratio 4:3 proche du cadre de tableau dans la chambre.
const ATELIER_COLS = 16; // nombre de colonnes
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

// ─────────────────────────────────────────────────────────────
// RÔLE : Retourne le canvas et son contexte 2D — crée une erreur lisible si absent.
// POURQUOI : Évite un crash silencieux si l'overlay n'est pas dans le DOM.
// ─────────────────────────────────────────────────────────────
function _atelierGetCtx() {
  const canvas = document.getElementById('atelier-canvas');
  if (!canvas) return null;
  return canvas.getContext('2d');
}

// ─────────────────────────────────────────────────────────────
// RÔLE : Redessine entièrement le canvas à partir des données du tableau courant.
// POURQUOI : Appelé après chaque coup de pinceau et à l'ouverture de l'atelier.
// ─────────────────────────────────────────────────────────────
function _atelierRenderCanvas() {
  const canvas = document.getElementById('atelier-canvas');
  if (!canvas) return;

  // Dimensionner le canvas (en pixels physiques = pixels CSS ici, devicePixelRatio ignoré intentionnellement)
  canvas.width  = ATELIER_COLS * ATELIER_CELL; // 256px
  canvas.height = ATELIER_ROWS * ATELIER_CELL; // 192px

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ── Fond blanc ──
  // POURQUOI : Donne un fond neutre avant de dessiner la grille et les pixels colorés.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // ── Pixels colorés ──
  const tb = window.D.atelier.tableaux.find(t => t.id === _atelierEditId);
  if (tb) {
    for (let row = 0; row < ATELIER_ROWS; row++) {
      for (let col = 0; col < ATELIER_COLS; col++) {
        const couleur = tb.pixels[row][col];
        if (couleur) {
          // POURQUOI : On dessine d'abord les couleurs, PUIS la grille par-dessus,
          //            pour que les lignes de grille restent toujours visibles.
          ctx.fillStyle = couleur;
          ctx.fillRect(col * ATELIER_CELL, row * ATELIER_CELL, ATELIER_CELL, ATELIER_CELL);
        }
      }
    }
  }

  // ── Grille ──
  // POURQUOI : La grille aide l'utilisatrice à viser les cellules précisément.
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth   = 0.5;
  for (let col = 0; col <= ATELIER_COLS; col++) {
    ctx.beginPath();
    ctx.moveTo(col * ATELIER_CELL, 0);
    ctx.lineTo(col * ATELIER_CELL, canvas.height);
    ctx.stroke();
  }
  for (let row = 0; row <= ATELIER_ROWS; row++) {
    ctx.beginPath();
    ctx.moveTo(0, row * ATELIER_CELL);
    ctx.lineTo(canvas.width, row * ATELIER_CELL);
    ctx.stroke();
  }
}

// ─────────────────────────────────────────────────────────────
// RÔLE : Calcule la cellule (col, row) touchée à partir d'un événement pointer.
// POURQUOI : `offsetX/offsetY` est relatif au canvas — on divise par ATELIER_CELL
//            et on clamp pour éviter de sortir de la grille en cas de dépassement.
// ─────────────────────────────────────────────────────────────
function _atelierCellFromEvent(e) {
  const canvas = document.getElementById('atelier-canvas');
  // POURQUOI : Sur mobile, offsetX/offsetY n'est pas toujours fiable après un pointer
  //            capture — on recalcule depuis getBoundingClientRect si nécessaire.
  let x = e.offsetX;
  let y = e.offsetY;
  if (x === undefined || isNaN(x)) {
    const rect = canvas.getBoundingClientRect();
    x = e.clientX - rect.left;
    y = e.clientY - rect.top;
  }
  const col = Math.max(0, Math.min(ATELIER_COLS - 1, Math.floor(x / ATELIER_CELL)));
  const row = Math.max(0, Math.min(ATELIER_ROWS - 1, Math.floor(y / ATELIER_CELL)));
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
  // POURQUOI : save() est volontairement absent ici — il n'est appelé que dans
  //            fermerAtelier() et _atelierSetActif() pour ne pas spammer localStorage.
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

  let html = '';

  // ── 8 boutons colorés ──
  couleurs.forEach((hex, i) => {
    // POURQUOI : outline offset négatif + 3px blanc entre couleur et contour = ring visible
    //            sur n'importe quelle couleur sans avoir besoin d'une couleur de contraste calculée.
    const actif = (_atelierColor === hex);
    const ring  = actif
      ? 'outline:3px solid var(--text);outline-offset:2px;'
      : 'outline:2px solid rgba(0,0,0,0.15);outline-offset:1px;';
    html += `<button
      onclick="window._atelierChoisirCouleur('${hex}')"
      aria-label="Couleur ${i + 1}"
      style="
        width:32px;height:32px;border-radius:50%;border:none;cursor:pointer;
        background:${hex};
        ${ring}
        flex-shrink:0;
      "></button>`;
  });

  // ── Bouton gomme ──
  const gommeActif = (_atelierColor === null);
  const gommeRing  = gommeActif
    ? 'outline:3px solid var(--text);outline-offset:2px;'
    : 'outline:2px solid rgba(0,0,0,0.15);outline-offset:1px;';
  html += `<button
    onclick="window._atelierChoisirCouleur(null)"
    aria-label="Gomme"
    title="Gomme"
    style="
      width:32px;height:32px;border-radius:50%;border:none;cursor:pointer;
      background:var(--bg);font-size:16px;line-height:32px;text-align:center;
      ${gommeRing}
      flex-shrink:0;
    ">🧹</button>`;

  container.innerHTML = html;
}

/* ============================================================
   §6  RENDU GALERIE
   ============================================================ */

// ─────────────────────────────────────────────────────────────
// RÔLE : Dessine une vignette miniature d'un tableau (48×36px) dans un canvas temporaire.
// POURQUOI : Permet de prévisualiser chaque tableau dans la galerie sans charger l'éditeur.
// Retourne un data URL PNG.
// ─────────────────────────────────────────────────────────────
function _atelierVignette(tb) {
  const W = 48, H = 36;
  const cellW = W / ATELIER_COLS; // 3px par cellule
  const cellH = H / ATELIER_ROWS; // 3px par cellule

  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Fond blanc
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Pixels
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

  let html = `<p style="margin:0 0 8px;font-family:var(--font-title);font-size:var(--fs-sm);color:var(--text2)">Mes tableaux</p>`;
  html += `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-bottom:8px">`;

  tableaux.forEach(tb => {
    const imgSrc  = _atelierVignette(tb);
    const estActif = (tb.id === _atelierEditId);
    const estChambre = (tb.id === activeId);

    // POURQUOI : Bordure bleue = tableau sélectionné dans l'éditeur.
    //            Badge ★ = tableau affiché dans la chambre.
    const bordure = estActif
      ? 'border:3px solid var(--text);'
      : 'border:2px solid var(--border);';

    html += `<div style="position:relative;cursor:pointer" onclick="_atelierSelectTableau('${tb.id}')">
      <img src="${imgSrc}" width="48" height="36"
        style="display:block;border-radius:4px;image-rendering:pixelated;${bordure}" />
      ${estChambre ? `<span style="position:absolute;top:-6px;right:-4px;font-size:12px">★</span>` : ''}
    </div>`;
  });

  // ── Bouton "+ Nouveau" ──
  const peutCrêer = (tableaux.length < ATELIER_MAX);
  if (peutCrêer) {
    html += `<button onclick="_atelierNouveauTableau()"
      style="
        width:48px;height:36px;border-radius:4px;border:2px dashed var(--border);
        background:none;cursor:pointer;color:var(--text2);font-size:18px;line-height:36px;
      ">+</button>`;
  }

  html += `</div>`;
  container.innerHTML = html;
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
  // POURQUOI : On ne sauvegarde pas ici — save() sera appelé à la fermeture.
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
    // Galerie vide → crée un premier tableau sans déclencher le toast de limite
    const nouveau = _atelierCréerTableau();
    window.D.atelier.tableaux.push(nouveau);
    _atelierEditId = nouveau.id;
    _atelierColor  = nouveau.paletteSnapshot[0] ?? null;
  } else {
    // Sélectionne le tableau actif (affiché dans la chambre) s'il existe,
    // sinon le premier de la galerie.
    const cible = tableaux.find(t => t.id === activeId) ?? tableaux[0];
    _atelierEditId = cible.id;
    _atelierColor  = cible.paletteSnapshot[0] ?? null;
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
  _atelierRenderCanvas();
  // POURQUOI : _atelierBindCanvas() est idempotent grâce au flag data-atelier-bound.
  //            On l'appelle ici pour s'assurer que les listeners sont attachés même
  //            si le canvas a été recréé par une modification du DOM.
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
