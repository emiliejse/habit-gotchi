/* ============================================================
   ui-shop.js — Boutique, inventaire, props (S5)
   RÔLE : Rendu et gestion complète des objets/props :
          boutique catalogue, inventaire, slots d'équipement,
          mode suppression, rangement, switcher d'env inventaire.
   Dépend de : app.js (window.D, save, today)
               ui-core.js (toast, toastModal, openModal, clModal,
                           escape, escapeHtml, animEl,
                           lockScroll, unlockScroll)
   ============================================================

   CONTENU :
   §1  Variables module          — propsFilterActive, _longPressTimer
   §2  renderPropMini()          — canvas miniature d'un prop
   §3  _propCard()               — carte HTML d'un prop
   §4  _propSection()            — section HTML groupée
   §5  renderProps()             — rendu complet de l'inventaire
   §6  ouvrirBoutique()          — modale boutique catalogue
   §7  switchBoutiqueOnglet()    — navigation onglets boutique
   §8  renderBoutiqueOnglet()    — contenu d'un onglet boutique
   §9  acheterProp()             — achat d'un prop du catalogue
   §10 setPropsFilter()          — filtre de l'inventaire
   §11 toggleProp()              — équiper/déséquiper un prop
   §12 Gestion objets IA         — supprimerObjetIA, confirmerSuppressionIA,
                                   exportObjetIA, copierExportIA
   §13 Long press & mode suppr   — startLongPress, cancelLongPress, toggleModeSuppr
   §14 Slot picker               — makeSlotBtn, openSlotPicker, openSlotPickerAvecEnv,
                                   confirmSlot, confirmEnvDirect,
                                   openSlotPickerAvecRangement
   §15 Rangement                 — rangerProp, rangerTout
   §16 Switcher env inventaire   — invSetEnv, _updInvEnvSwitcher
   §17 Utilitaires debug         — debugProps, voirBulles, updBadgeBoutique
   §18 Actions reset             — cleanProps, confirmCleanProps, viderJournal, viderObjetsIA
   ============================================================ */

let propsFilterActive = 'tous';

/**
 * Dessine un aperçu d'un prop Pixel Art sur un élément Canvas (Boutique/Inventaire)
 */
function renderPropMini(canvas, def) {
  if (!canvas || !def || !def.pixels) return;
  const ctx = canvas.getContext('2d');
  const cols = def.pixels[0].length, rows = def.pixels.length;
  const px = Math.min(Math.floor(54 / Math.max(cols, rows)), 6);
  canvas.width = cols * px; canvas.height = rows * px;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ci = def.pixels[r][c]; if (ci === 0) continue;
      ctx.fillStyle = def.palette[ci];
      ctx.fillRect(c * px, r * px, px, px);
    }
  }
}

// RÔLE : Construit le HTML d'une carte d'objet dans l'inventaire.
// POURQUOI : Factorisé pour être réutilisé dans tous les groupes.
// isNew        : true si l'objet a été acquis il y a moins de 48h
// modeSuppr    : true si le mode suppression est actif (affiche ✕ sur les objets IA)
function _propCard(p, index, def, D, isNew, modeSuppr) {
  const isClaud = !!(D.propsPixels && D.propsPixels[p.id]);
  const badgeId = `mini-${p.id}`;

  // Badge "NEW" — quand présent, remplace le ✦ (redondant : la bordure lilas identifie déjà l'IA)
  // POURQUOI : ✦ + NEW ensemble encombrent le coin ; NEW suffit à signaler le statut
  const newBadge = isNew
    ? `<span style="position:absolute;top:3px;left:4px;font-size:8px;font-weight:bold;
        background:var(--coral,#f07);color:#fff;border-radius:6px;padding:1px 4px;
        letter-spacing:.5px;line-height:1.4">NEW</span>`
    : '';

  // ✦ visible seulement si PAS de badge NEW
  const etoile = (isClaud && !isNew)
    ? `<span style="position:absolute;top:3px;left:4px;font-size:14px;color:var(--lilac);">✦</span>`
    : '';

  // ✕ de suppression — visible uniquement en mode suppression, sur les objets IA uniquement
  // POURQUOI : Seuls les objets IA (propsPixels) peuvent être supprimés définitivement
  const suppressBtn = (isClaud && modeSuppr)
    ? `<span onclick="event.stopPropagation();supprimerObjetIA('${p.id}')"
        style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
        background:rgba(255,255,255,.75);border-radius:var(--r-md);
        font-size:28px;color:#e33;font-weight:bold;cursor:pointer;z-index:2;">✕</span>`
    : '';

  // Long press (500ms) → export JSON pour les objets IA
  // POURQUOI : Pas de bouton dédié sur la carte — le long press est discret et ne pollue pas l'UI
  const longPressAttrs = isClaud
    ? `onmousedown="startLongPress(event,'${p.id}')" onmouseup="cancelLongPress()" onmouseleave="cancelLongPress()"
       ontouchstart="startLongPress(event,'${p.id}')" ontouchend="cancelLongPress()" ontouchcancel="cancelLongPress()"`
    : '';

  return `<div onclick="toggleProp(${index})" ${longPressAttrs} style="
    background:${p.actif ? 'var(--mint)' : '#fff'};
    border:2px solid ${p.actif ? 'var(--mint)' : isClaud ? 'var(--lilac)' : 'var(--border)'};
    border-radius:var(--r-md);padding:6px 4px 8px;font-size:var(--fs-xs);font-weight:bold;
    cursor:pointer;display:flex;flex-direction:column;align-items:center;
    justify-content:space-between;gap:4px;transition:.2s;text-align:center;
    box-shadow:0 2px 4px rgba(0,0,0,.05);position:relative;min-height:90px;
    user-select:none;-webkit-user-select:none;">
    ${newBadge}${etoile}${suppressBtn}
    <div style="flex:1;display:flex;align-items:center;justify-content:center;">
      ${def && def.pixels
        ? `<canvas id="${badgeId}" style="image-rendering:pixelated;border-radius:3px"></canvas>`
        : `<span style="font-size:22px">${p.emoji || '🎁'}</span>`}
    </div>
    <div style="width:100%;">
      <div>${p.nom}</div>
      <div style="font-size:var(--fs-xs);text-transform:uppercase;opacity:.7;font-weight:normal;">${p.type}</div>
    </div>
  </div>`;
}

// RÔLE : Construit une section (bandeau + grille) pour un groupe d'objets.
// POURQUOI : Évite la répétition pour chaque groupe de l'inventaire.
function _propSection(titre, items) {
  if (items.length === 0) return '';
  return `
    <div style="margin-bottom:12px">
      <div style="font-size:var(--fs-xs);font-weight:bold;text-transform:uppercase;
        letter-spacing:1px;color:var(--text2);padding:4px 0 6px;
        border-bottom:1px solid var(--border);margin-bottom:6px">
        ${titre} <span style="font-weight:normal;opacity:.6">(${items.length})</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
        ${items.join('')}
      </div>
    </div>`;
}

// RÔLE : Affiche et met à jour l'onglet inventaire complet.
// POURQUOI : Appelé après chaque action sur les props (activer, ranger, acheter, etc.)
function renderProps() {
  const D       = window.D;
  const allDefs = [...(window.PROPS_LIB || []), ...(window.PROPS_LOCAL || [])];
  const envActif = D.g.activeEnv || 'parc'; // env actuellement affiché dans le switcher
  const now48h   = Date.now() - 48 * 60 * 60 * 1000; // seuil "nouveau" = 48h

  // ── Filtres par catégorie — style distinct des boutons d'action ──
  // POURQUOI : Forme carrée avec coins légèrement arrondis vs boutons d'action pill-shape,
  //            pour distinguer visuellement les deux types de contrôles.
  const cats = [
    { key: 'tous',       label: '🗂️ Tous' },
    { key: 'decor',      label: '🪑 Décor' },
    { key: 'accessoire', label: '🎀 Accessoires' },
    { key: 'ambiance',   label: '🌈 Ambiances' },
    { key: 'claude',     label: '✨ Créations' },
  ];
  const filterEl = document.getElementById('props-filters');
  if (filterEl) {
    // RÔLE : Filtres en cercles — alignés sur toute la largeur comme le switcher env au-dessus
    filterEl.style.cssText = 'display:flex;justify-content:center;gap:12px;align-items:center;width:100%;margin:8px 0 10px';
    filterEl.innerHTML = cats.map(({ key, label }) => {
      const active = propsFilterActive === key;
      // RÔLE : extrait le premier caractère du label comme icône du bouton rond.
      // POURQUOI : Le suffixe ︎ (variation selector-15 "text") force le rendu en glyphe texte
      //            et évite que ✿ s'affiche en bleu (rendu emoji couleur) sur iOS/Safari.
      const icon = [...label][0] + '︎';
      const nom  = label.replace(/^\S+\s*/, '');
      // RÔLE : enveloppe bouton + label dans un conteneur flex-column pour afficher le nom sous le rond.
      // POURQUOI : l'icône seule dans title= était invisible sans survol — ajouter le label en dessous
      //            améliore la lisibilité sans toucher à la cible tactile (52×52 sur le bouton lui-même).
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex-shrink:0;">
        <button onclick="setPropsFilter('${key}')"
          aria-label="${nom}"
          style="width:52px;height:52px;border-radius:50%;padding:0;
          border:2px solid ${active ? 'var(--lilac)' : 'var(--border)'};
          font-size:22px;cursor:pointer;
          background:${active ? 'var(--lilac)' : 'rgba(0,0,0,.03)'};
          transition:.15s;">${icon}</button>
        <span style="font-size:9px;font-family:var(--font-body);color:${active ? 'var(--lilac)' : 'var(--text2)'};
          font-weight:${active ? 'bold' : 'normal'};letter-spacing:.3px;transition:.15s;">${nom}</span>
      </div>`;
    }).join('');
  }

  // ── Masquer l'ancien conteneur du header (plus utilisé) ──
  const btnTout = document.getElementById('btn-ranger-tout');
  if (btnTout) btnTout.style.display = 'none';

  const listEl = document.getElementById('props-list');
  if (!listEl) return;

  // ── Inventaire vide ───────────────────────────────────────
  if (!D.g.props || D.g.props.length === 0) {
    listEl.innerHTML = '<p style="font-size:var(--fs-sm);color:var(--text2);text-align:center;padding:var(--sp-md)">Ton sac est vide. Reviens plus tard ! ✿</p>';
    return;
  }

  // ── Filtre de catégorie ───────────────────────────────────
  const filtered = D.g.props
    .map((p, index) => ({ p, index, def: allDefs.find(l => l.id === p.id) }))
    .filter(({ p }) => {
      if (propsFilterActive === 'tous')   return true;
      if (propsFilterActive === 'claude') return !!(D.propsPixels && D.propsPixels[p.id]);
      return p.type === propsFilterActive;
    });

  // ── Groupe "actifs dans l'env courant" (seulement cet env) ──
  // POURQUOI : On ne montre que ce qui est actif dans l'environnement actuellement sélectionné
  const sortAlpha  = arr => [...arr].sort((a, b) => a.p.nom.localeCompare(b.p.nom, 'fr'));
  const groupActifs = sortAlpha(filtered.filter(({ p }) => p.actif && (p.env === envActif || !p.env)));

  // ── Groupe "rangés" — récents en tête ────────────────────
  // POURQUOI : Les nouveaux objets (< 48h) remontent pour être visibles sans scroller
  const ranges = filtered.filter(({ p }) => !p.actif);
  const rangesNew   = [...ranges].filter(({ p }) => (p.acquis || 0) > now48h)
                                 .sort((a, b) => (b.p.acquis || 0) - (a.p.acquis || 0));
  const rangesOld   = sortAlpha(ranges.filter(({ p }) => (p.acquis || 0) <= now48h));

  // ── Mode suppression — flag global ───────────────────────
  // POURQUOI : Quand actif, les cartes IA affichent un ✕ de suppression.
  //            Le flag est remis à false à chaque appel de renderProps (hors clic bouton).
  const modeSuppr = !!window._propsModeSuppr;

  // ── Génération des cartes ─────────────────────────────────
  const toCards = (arr, markNew = false) =>
    arr.map(({ p, index, def }) =>
      _propCard(p, index, def, D, markNew && (p.acquis || 0) > now48h, modeSuppr));

  const aDesActifs = groupActifs.length > 0;

  // ── Bandeau de section avec bouton d'action à droite ─────
  // POURQUOI : "Tout ranger" à droite de l'env actif, "Supprimer" à droite de Rangés.
  //            Homogène et contextuel — chaque action est au niveau de sa section.
  const envTitres = { parc: '🌳 Parc', chambre: '🛏️ Chambre', montagne: '⛰️ Montagne' };
  const titreActif = envTitres[envActif] || '✨ Actifs';

  // Style partagé pour les boutons d'action de bandeau (pill-shape, distinct des filtres carrés)
  const btnActionStyle = `border-radius:var(--r-md);border:1.5px solid var(--border);
    font-size:var(--fs-xs);font-weight:bold;font-family:var(--font-body);cursor:pointer;padding:3px 10px;
    background:#fff;color:var(--text2);transition:.15s;white-space:nowrap;`;

  // Bandeau section env actif — avec "Tout ranger" à droite
  const bandeauActif = `
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding:4px 0 6px;border-bottom:1px solid var(--border);margin-bottom:6px">
      <span style="font-size:var(--fs-xs);font-weight:bold;text-transform:uppercase;
        letter-spacing:1px;color:var(--text2)">
        ${titreActif} <span style="font-weight:normal;opacity:.6">(${groupActifs.length})</span>
      </span>
      <button onclick="rangerTout('${envActif}')"
        style="${btnActionStyle}opacity:${aDesActifs ? '1' : '0.35'};
        pointer-events:${aDesActifs ? 'auto' : 'none'};">
        📦 Tout ranger
      </button>
    </div>`;

  // Bandeau section Rangés — avec "Supprimer" à droite (toggle mode suppression)
  const hasIA = ranges.some(({ p }) => !!(D.propsPixels && D.propsPixels[p.id]));
  const bandeauRanges = `
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding:4px 0 6px;border-bottom:1px solid var(--border);margin-bottom:6px">
      <span style="font-size:var(--fs-xs);font-weight:bold;text-transform:uppercase;
        letter-spacing:1px;color:var(--text2)">
        📦 Rangés <span style="font-weight:normal;opacity:.6">(${ranges.length})</span>
      </span>
      <button onclick="toggleModeSuppr()"
        style="${btnActionStyle}${modeSuppr ? 'background:var(--coral,#f55);color:#fff;border-color:var(--coral,#f55);' : ''}
        opacity:${hasIA ? '1' : '0.35'};pointer-events:${hasIA ? 'auto' : 'none'};">
        ${modeSuppr ? '✓ Terminer' : '🗑️ Supprimer'}
      </button>
    </div>`;

  // ── Section active (vide → message indicatif) ─────────────
  const sectionActiveHTML = `
    <div style="margin-bottom:12px">
      ${bandeauActif}
      ${aDesActifs
        ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">${toCards(groupActifs).join('')}</div>`
        : `<p style="font-size:var(--fs-xs);color:var(--text2);text-align:center;padding:10px 0;opacity:.6">
             Aucun objet dans cet univers ✿</p>`}
    </div>`;

  // ── Section Rangés ────────────────────────────────────────
  const cardesRanges = toCards(rangesNew, true).concat(toCards(rangesOld));
  const sectionRangesHTML = `
    <div style="margin-bottom:12px">
      ${bandeauRanges}
      ${cardesRanges.length
        ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">${cardesRanges.join('')}</div>`
        : `<p style="font-size:var(--fs-xs);color:var(--text2);text-align:center;padding:10px 0;opacity:.6">
             Rien ici pour l'instant ✿</p>`}
    </div>`;

  listEl.innerHTML = sectionActiveHTML + sectionRangesHTML;

  // ── Dessiner les mini-sprites pixel art ──────────────────
  filtered.forEach(({ p, def }) => {
    if (def && def.pixels) renderPropMini(document.getElementById(`mini-${p.id}`), def);
  });

  const wallet = document.getElementById('xp-wallet');
  if (wallet) wallet.textContent = `💜 ${D.g.totalXp} XP disponibles`;
}

function ouvrirBoutique() {
  const onglet = window._boutiqueOnglet || 'catalogue';
  _fermerMenuSiOuvert(); // ferme le menu-overlay s'il était ouvert
  document.getElementById('modal').style.display = 'flex';
  lockScroll();
  document.getElementById('mbox').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <h2 style="color:var(--text);">🛍️ Boutique</h2>
      ${window._modalCloseBtn()} <!-- RÔLE : bouton ✕ standardisé via ui-core.js -->
    </div>

    <div style="text-align:center;margin-bottom:16px">
      <p style="font-size:var(--fs-sm);color:var(--text2);text-align:center">
  🌸 <b style="font-size:var(--fs-lg);color:var(--lilac)">${D.g.petales || 0}</b> pétales disponibles
</p>
    </div>

    <div style="display:flex;gap:6px;margin-bottom:14px;background:rgba(0,0,0,0.05);border-radius:20px;padding:3px;margin-right:2px">
      <button onclick="switchBoutiqueOnglet('catalogue')" class="tab-switcher-btn"
        style="background:${onglet==='catalogue'?'#fff':'transparent'};
        color:${onglet==='catalogue'?'var(--lilac)':'var(--text2)'};
        box-shadow:${onglet==='catalogue'?'0 1px 4px rgba(0,0,0,.1)':'none'}">
        🌸 Catalogue
      </button>
      <button onclick="switchBoutiqueOnglet('claude')" class="tab-switcher-btn"
        style="background:${onglet==='claude'?'#fff':'transparent'};
        color:${onglet==='claude'?'var(--lilac)':'var(--text2)'};
        box-shadow:${onglet==='claude'?'0 1px 4px rgba(0,0,0,.1)':'none'}">
        ✨ Créations
      </button>
    </div>

    <div id="boutique-contenu"></div>
  `;
  animEl(document.getElementById('mbox'), 'bounceIn');

  const mbox = document.getElementById('mbox');
  mbox.classList.remove('shop-open');
  void mbox.offsetWidth;
  mbox.classList.add('shop-open');
  if (onglet === 'catalogue') {
  mbox.classList.add('shop-catalogue');
  } else {
  mbox.classList.remove('shop-catalogue');
  }
  renderBoutiqueOnglet(onglet);
}

function switchBoutiqueOnglet(onglet) {
  window._boutiqueOnglet = onglet;
  ouvrirBoutique();
}

function renderBoutiqueOnglet(onglet) {
  const el = document.getElementById('boutique-contenu');
  if (!el) return;

  if (onglet === 'catalogue') {
    // RÔLE : Afficher uniquement les objets achetables en boutique (cout > 0, pas encore acquis).
    // POURQUOI : Avant, il fallait filtrer categorie:"pack" car les packs vivaient dans props.json.
    //            Maintenant les objets de pack sont dans props_packs.json — ils ont cout:0 et
    //            ne s'achètent qu'en pack. Filtrer sur cout > 0 suffit pour les exclure du catalogue,
    //            tout en gardant les objets de base (cout:0) acquis automatiquement hors de la liste.
    const lib = window.PROPS_LIB || [];
    const libFiltree = lib
      .filter(prop => prop.cout > 0)
      .filter(prop => !(D.g.props || []).find(p => p.id === prop.id))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

    // ── Section Packs thématiques ──────────────────────────────────
    // RÔLE : Affiche les packs groupés en haut du catalogue si au moins 1 est disponible.
    // POURQUOI : Les packs disparaissent si tous les objets du pack sont déjà acquis.
    const packs = window.HG_CONFIG?.SHOP_PACKS || [];
    const packsDispos = packs.filter(pack =>
      // Un pack est disponible si au moins 1 objet de ses propIds n'est pas encore dans l'inventaire
      pack.propIds.some(id => !(D.g.props || []).find(p => p.id === id))
    );

    const packsHtml = packsDispos.length ? `
      <div style="font-family:var(--font-title);font-size:var(--fs-lg);font-weight:700;color:var(--text);margin-bottom:6px;margin-top:4px">✨ Packs</div>
      ${packsDispos.map(pack => {
        const peutAcheter = (D.g.petales || 0) >= pack.cout;
        // Compte les objets du pack déjà acquis pour ajuster l'affichage
        const dejaAcquis = pack.propIds.filter(id => (D.g.props || []).find(p => p.id === id)).length;
        const label = dejaAcquis > 0 ? `${dejaAcquis}/${pack.propIds.length} déjà acquis` : `${pack.propIds.length} objets`;
        return `
          <div style="padding:10px 12px;border:2px solid var(--border);border-radius:var(--r-md);margin-bottom:8px;background:rgba(245,158,11,.04)">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
              <span style="font-size:18px">${pack.emoji}</span>
              <span style="font-size:var(--fs-sm);font-weight:bold;flex:1;margin:0 8px">${escape(pack.label)}</span>
              <button onclick="acheterPack('${pack.id}')"
                style="padding:5px 12px;border-radius:var(--r-md);border:none;font-size:var(--fs-xs);font-weight:bold;font-family:var(--font-body);
                cursor:${peutAcheter?'pointer':'not-allowed'};
                background:${peutAcheter?'linear-gradient(135deg,#f59e0b,#fb923c)':'#ddd'};
                color:${peutAcheter?'#fff':'#aaa'};
                border-bottom:${peutAcheter?'2px solid rgba(0,0,0,0.15)':'2px solid transparent'}">
                🌸 ${pack.cout}
              </button>
            </div>
            <div style="font-size:var(--fs-xs);color:var(--text2)">${escape(pack.description)}</div>
            <div style="font-size:var(--fs-xs);color:var(--amber,#f59e0b);margin-top:2px">${label}</div>
          </div>`;
      }).join('')}
      <div style="font-family:var(--font-title);font-size:var(--fs-lg);font-weight:700;color:var(--text);margin:8px 0 6px">Catalogue</div>
    ` : '';

    el.innerHTML = packsHtml + libFiltree.map(prop => {
      const peutAcheter = (D.g.petales || 0) >= prop.cout;
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--sp-sm) 12px 8px 10px;border:2px solid var(--border);border-radius:var(--r-md);margin-bottom:6px;background:#fff">
          <span style="font-size:18px">${prop.emoji}</span>
          <span style="font-size:var(--fs-sm);font-weight:bold;flex:1;margin:0 8px">${escape(prop.nom)}</span>
          <button onclick="acheterProp('${prop.id}')"
            style="padding:5px 12px;border-radius:var(--r-md);border:none;font-size:var(--fs-xs);font-weight:bold;font-family:var(--font-body);
            cursor:${peutAcheter?'pointer':'not-allowed'};
            background:${peutAcheter?'linear-gradient(135deg,var(--lilac),var(--pink))':'#ddd'};
            color:${peutAcheter?'#fff':'#aaa'};
            border-bottom:${peutAcheter?'2px solid rgba(0,0,0,0.15)':'2px solid transparent'}">
            ${prop.cout === 0 ? 'Prendre 🎁' : `🌸 ${prop.cout}`}
          </button>
        </div>`;
    }).join('');

  } else {
// Onglet création IA
    const peutGenerer = (D.g.petales || 0) >= 10;
    const derniersProps = Object.values(window.D.propsPixels || {});
    const dernierObj = derniersProps.length ? derniersProps[derniersProps.length - 1] : null;

    // RÔLE : Construit l'affichage des mots d'inspiration — met en valeur le dernier tiré.
    const themes = (D.g.propThemes && D.g.propThemes.length) ? D.g.propThemes : ['nature','cosmos','magie','cuisine','musique','voyage','océan','forêt','météo','jardin','minéral','rêve'];
    const lastTheme = window._lastPropTheme || null;
    const themesHtml = themes.map(t => {
      const isLast = t === lastTheme;
      return `<span style="
        display:inline-block;padding:3px 9px;border-radius:20px;
        font-size:var(--fs-xs);font-weight:${isLast ? 'bold' : 'normal'};
        background:${isLast ? 'var(--lilac)' : 'var(--card)'};
        color:${isLast ? '#fff' : 'var(--text2)'};
        border:1.5px solid ${isLast ? 'var(--lilac)' : 'var(--border)'};
        transition:.2s">${escape(t)}</span>`;
    }).join('');

    el.innerHTML = `
      <p style="font-size:var(--fs-sm);color:var(--text2);text-align:center;margin-bottom:16px;line-height:1.6">
        ${escape(window.D.g.name)} invente un objet unique<br>rien que pour toi ✨
      </p>
      <div style="text-align:center">
        <button onclick="acheterPropClaude()"
          style="padding:var(--sp-md) 28px;border-radius:var(--r-md);border:none;font-size:var(--fs-sm);font-weight:bold;font-family:var(--font-body);
          cursor:${peutGenerer?'pointer':'not-allowed'};
          background:${peutGenerer?'linear-gradient(135deg,var(--lilac),var(--pink))':'#ddd'};
          color:${peutGenerer?'#fff':'#aaa'};
          border-bottom:${peutGenerer?'3px solid rgba(0,0,0,0.15)':'3px solid transparent'};
          letter-spacing:.5px">
          ${peutGenerer ? `✨ Demander à ${escape(window.D.g.name)} — 🌸 10` : '🌸 Il te faut 10 pétales'}
        </button>
      </div>
      <div style="margin-top:16px;padding:10px 12px;border-radius:var(--r-md);background:var(--card);border:1px solid var(--border);text-align:center">
        <div style="font-size:var(--fs-xs);color:var(--text2);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px">
          ${lastTheme ? `✨ dernier mot pioché : <strong style="color:var(--lilac)">${escape(lastTheme)}</strong>` : 'mots d\'inspiration'}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center">${themesHtml}</div>
      </div>
      ${dernierObj ? `
  <div style="margin-top:20px;text-align:center;border-top:1px solid var(--border);padding-top:16px">
    <div style="font-size:var(--fs-xs);color:var(--text2);margin-bottom:var(--sp-sm);text-transform:uppercase;letter-spacing:1px">dernière création</div>
    <canvas id="apercu-dernier-prop" style="image-rendering:pixelated;border-radius:6px;border:2px solid var(--border)"></canvas>
    <div style="font-size:var(--fs-sm);font-weight:bold;margin-top:6px">${dernierObj.emoji} ${dernierObj.nom}</div>
    <div style="font-size:var(--fs-xs);color:var(--text2);text-transform:uppercase;margin-top:2px">${dernierObj.type}</div>
  </div>` : `
  <div style="margin-top:20px;text-align:center;border-top:1px solid var(--border);padding-top:16px;opacity:.5">
    <div style="font-size:28px;margin-bottom:6px">🌱</div>
    <div style="font-size:var(--fs-xs);color:var(--text2);line-height:1.6">Pas encore de création...<br>demande à ${escape(window.D.g.name)} d'inventer quelque chose ✨</div>
  </div>`}
    `;

  if (dernierObj) {
  const canvas = document.getElementById('apercu-dernier-prop');
  if (canvas && dernierObj.pixels) {
    const ctx = canvas.getContext('2d');
    const cols = dernierObj.pixels[0].length;
    const rows = dernierObj.pixels.length;
    const px = Math.min(Math.floor(96 / Math.max(cols, rows)), 10); // ← 54→96, 6→10
    canvas.width  = cols * px;
    canvas.height = rows * px;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ci = dernierObj.pixels[r][c];
        if (ci === 0) continue;
        ctx.fillStyle = dernierObj.palette[ci];
        ctx.fillRect(c * px, r * px, px, px);
      }
    }
    canvas.style.width  = canvas.width  + 'px';
    canvas.style.height = canvas.height + 'px';
  }
}
  }
}

function acheterProp(propId) {
  const prop = (window.PROPS_LIB || []).find(p => p.id === propId);
  if (!prop) return;
  if ((D.g.petales || 0) < prop.cout) { toast(`Pas assez de pétales 🌸`); return; }
  
  D.g.petales = (D.g.petales || 0) - prop.cout;
  if (!D.g.props) D.g.props = [];
  D.g.props.push({ id: prop.id, nom: prop.nom, type: prop.type, emoji: prop.emoji, actif: false, pxSize: prop.pxSize || null, seen: false, acquis: Date.now() });
addEvent({
  type: 'cadeau',
  subtype: 'achat',
  valeur: prop.cout,
  emoji: prop.emoji || '🛍️',
  label: `${prop.nom}  débloqué`
});
  save();
  toast(`${prop.emoji || '🛍️'} ${prop.nom} ajouté à ton inventaire !`);
  const buyMsgs = [`${prop.emoji} Pour moi ?! 💜`, `*yeux brillants* ✨`, `${prop.emoji} J'adore ! 🌸`, `*saute de joie* ✿`, `${prop.emoji} Trop beau ! ✿`];
  flashBubble(buyMsgs[Math.floor(Math.random() * buyMsgs.length)], 2500);
  renderProps();
  updUI();
  updBadgeBoutique();
  ouvrirBoutique();
}
// RÔLE : Achète un pack thématique (3 objets cohérents à prix groupé).
// POURQUOI : Offre une alternative économique à l'achat unitaire.
//            Seuls les objets non encore acquis sont ajoutés (pas de doublon).
//            Si tous les objets du pack sont déjà dans l'inventaire → toast d'info.
function acheterPack(packId) {
  const pack = (window.HG_CONFIG?.SHOP_PACKS || []).find(p => p.id === packId);
  if (!pack) return;
  if ((D.g.petales || 0) < pack.cout) { toast(`Pas assez de pétales 🌸 (il faut ${pack.cout})`); return; }

  const props = window.PROPS_LIB || [];
  const ajouts = [];
  pack.propIds.forEach(id => {
    if ((D.g.props || []).find(p => p.id === id)) return; // déjà acquis
    const def = props.find(p => p.id === id);
    if (!def) return;
    D.g.props.push({
      id: def.id, nom: def.nom, type: def.type,
      emoji: def.emoji || '🎁', actif: false,
      acquis: Date.now()
    });
    ajouts.push(def.nom);
  });

  if (ajouts.length === 0) {
    toast(`Tu as déjà tous les objets de ce pack 💜`);
    return;
  }

  D.g.petales = (D.g.petales || 0) - pack.cout;
  addEvent({
    type: 'note', subtype: 'achat',
    valeur: pack.cout,
    label: `Pack ${pack.label} — ${ajouts.join(', ')}  -${pack.cout} 🌸`
  });
  save();
  toast(`${pack.emoji} Pack "${pack.label}" débloqué ! ${ajouts.length} objets ajoutés`);
  flashBubble(`${pack.emoji} Un pack entier ? *yeux qui brillent* 💜`, 2800);
  renderProps();
  updUI();
  updBadgeBoutique();
  ouvrirBoutique();
}
window.acheterPack = acheterPack;

function setPropsFilter(cat) { propsFilterActive = cat; renderProps(); }

// RÔLE : Gère le clic sur un objet dans l'inventaire.
// POURQUOI : Point d'entrée unique pour activer, désactiver ou reconfigurer un objet.
//            L'environnement est automatiquement celui du switcher — plus de choix à faire.
function toggleProp(index) {
  const prop    = window.D.g.props[index];
  const envActif = window.D.g.activeEnv || 'parc'; // env du switcher = env cible

  // --- Désactiver / modifier si déjà actif ---
  if (prop.actif) {
    if (prop.type === 'decor') {
      // Décor actif → modale de repositionnement (slot + ranger, env déjà fixé)
      openSlotPickerAvecRangement(index);
    } else {
      // Accessoire ou ambiance → ranger directement (un clic = on range)
      prop.actif = false;
      prop.slot  = null;
      prop.env   = null;
      save();
      renderProps();
      toast(`📦 ${prop.nom} rangé`);
      flashBubble(`*au revoir ${prop.nom}* 👋`, 2500);
    }
    return;
  }

  // --- Pas encore actif → activer dans l'env du switcher, sans modale ─────
  if (prop.type === 'decor') {
    // Les décors ont besoin d'un slot → modale de slot uniquement (env déjà connu)
    openSlotPicker(index);
  } else {
    // Accessoires et ambiances : activation directe dans l'env actif
    confirmEnvDirect(index, envActif);
  }
}

// RÔLE : Modale pour modifier l'env d'un accessoire/ambiance déjà actif, ou le ranger.
// POURQUOI : Les non-décors n'ont pas de slot, donc pas besoin de l'étape 2 slots.
function supprimerObjetIA(propId) {
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `
    <p style="text-align:center;font-size:12px;margin-bottom:var(--sp-md)">Supprimer cet objet définitivement ?</p>
    <button class="btn btn-d" onclick="confirmerSuppressionIA('${propId}')" style="width:100%;margin-bottom:6px;font-size:var(--fs-sm)">🗑️ Supprimer</button>
    <button class="btn btn-s" onclick="clModal()" style="width:100%;font-size:var(--fs-sm)">Annuler</button>
  `;
  animEl(document.getElementById('mbox'), 'bounceIn');
}

function confirmerSuppressionIA(propId) {
  D.g.props = D.g.props.filter(p => p.id !== propId);
  if (D.propsPixels) delete D.propsPixels[propId];
  save();
  clModal();
  renderProps();
  toast(`🗑️ Objet supprimé`);
}

// RÔLE : Affiche le JSON d'un objet IA formaté pour props.json, prêt à copier-coller.
// POURQUOI : Permet d'exporter un objet généré par l'IA vers le catalogue permanent,
//            ou de l'envoyer à quelqu'un d'autre pour qu'iel l'intègre dans son catalogue.
function exportObjetIA(propId) {
  const src = (window.D.propsPixels || {})[propId];
  const inv = (window.D.g.props || []).find(p => p.id === propId);
  if (!src) { toast('Objet introuvable 🤔'); return; }

  // RÔLE : Construire le JSON au format exact du catalogue props.json
  // POURQUOI : Prêt à coller dans "catalogue": [...] sans aucune retouche (sauf cout et categorie)
  const entry = {
    id:       src.id      || propId,
    nom:      src.nom     || inv?.nom || '?',
    type:     src.type    || inv?.type || 'decor',
    emoji:    src.emoji   || inv?.emoji || '🎁',
    categorie: src.type === 'accessoire' ? (src.ancrage || 'tete') : 'ia',
    cout:     0,
    ...(src.ancrage ? { ancrage: src.ancrage } : {}),
    ...(src.slot    ? { slot:    src.slot    } : {}),
    ...(src.motion  ? { motion:  src.motion  } : {}),
    pxSize:   src.pxSize  || 3,
    palette:  src.palette || [],
    pixels:   src.pixels  || [],
  };

  // RÔLE : Sérialise avec pixels compactés (une ligne par rangée) pour lisibilité
  // POURQUOI : JSON.stringify met chaque chiffre sur sa propre ligne — illisible pour les grilles pixel art
  const pixels = entry.pixels;
  const cloneEntry = { ...entry };
  delete cloneEntry.pixels;
  let jsonBase = JSON.stringify(cloneEntry, null, 2);
  jsonBase = jsonBase.slice(0, jsonBase.lastIndexOf('}')).trimEnd() + ',\n';
  const pixelRows = pixels.map(row => '    [' + row.join(',') + ']');
  const json = jsonBase + '  "pixels": [\n' + pixelRows.join(',\n') + '\n  ]\n}';

  document.getElementById('modal').style.display = 'flex';
  lockScroll();
  document.getElementById('mbox').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <h3 style="font-size:13px;color:var(--lilac);margin:0">✦ ${escapeHtml(entry.nom)}</h3>
      ${window._modalCloseBtn()} <!-- RÔLE : bouton ✕ standardisé via ui-core.js -->
    </div>
    <p style="font-size:var(--fs-xs);color:var(--text2);margin-bottom:10px;line-height:1.6">
      📜 <strong>Notice de fabrication</strong><br>
      Ce code contient la recette complète de cet objet — ses couleurs, sa forme, ses propriétés.
      Tu peux le garder précieusement, ou l'envoyer à quelqu'un·e pour qu'iel l'ajoute à son jeu 🌸
    </p>
    <pre id="export-json" style="
      font-size:9px;line-height:1.5;background:rgba(0,0,0,.04);
      border:1px solid var(--border);border-radius:var(--r-sm);
      padding:8px;overflow-x:auto;white-space:pre;
      max-height:220px;overflow-y:auto;
      touch-action:pan-y;
      font-family:'Courier New',monospace;
      user-select:all;cursor:text;">${escapeHtml(json)}</pre>
    <button onclick="copierExportIA()" class="btn btn-p"
      style="width:100%;margin-top:10px;font-size:var(--fs-sm)" id="btn-copier-export">
      📋 Copier le code
    </button>
  `;
  animEl(document.getElementById('mbox'), 'bounceIn');

  // Stocker le JSON à copier dans une variable accessible depuis le bouton
  window._exportJsonToCopy = json;
}

// RÔLE : Copie le JSON exporté dans le presse-papier et confirme visuellement.
function copierExportIA() {
  const json = window._exportJsonToCopy;
  if (!json) return;
  navigator.clipboard.writeText(json).then(() => {
    const btn = document.getElementById('btn-copier-export');
    if (btn) { btn.textContent = '✓ Copié !'; btn.style.background = 'var(--mint)'; }
    setTimeout(() => {
      if (btn) { btn.textContent = '📋 Copier le JSON'; btn.style.background = ''; }
    }, 2000);
  }).catch(() => {
    // Fallback si clipboard API non disponible (contexte non sécurisé)
    toast('Sélectionne le texte manuellement et copie-le ✿');
  });
}

// RÔLE : Échappe les caractères HTML dans une chaîne pour affichage sécurisé dans innerHTML.
// POURQUOI : Le JSON peut contenir des < > & qui casseraient le rendu HTML.
function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── Long press & mode suppression ───────────────────────────────────────────

// RÔLE : Démarre un timer de 900ms pour déclencher l'export d'un objet IA via appui long.
// POURQUOI : 500ms se déclenchait trop facilement en scrollant l'inventaire — 900ms force un geste intentionnel.
let _longPressTimer = null;
function startLongPress(event, propId) {
  // Annuler tout timer précédent (sécurité si deux events se chevauchent)
  cancelLongPress();
  _longPressTimer = setTimeout(() => {
    _longPressTimer = null;
    exportObjetIA(propId);
  }, 900); // 900ms : intentionnel sans être inconfortable
}

// RÔLE : Annule le timer d'appui long si le doigt/curseur est relâché ou quitte la carte.
// POURQUOI : Empêche l'export de se déclencher sur un simple tap ou un glissement.
function cancelLongPress() {
  if (_longPressTimer !== null) {
    clearTimeout(_longPressTimer);
    _longPressTimer = null;
  }
}

// RÔLE : Bascule le mode suppression (affiche/masque les ✕ sur les objets IA rangés).
// POURQUOI : Permet de supprimer des objets IA sans risquer de supprimer accidentellement
//            depuis une interface permanente — le mode doit être activé explicitement.
function toggleModeSuppr() {
  window._propsModeSuppr = !window._propsModeSuppr;
  renderProps(); // Rafraîchit l'affichage pour montrer/masquer les ✕
}

// ─────────────────────────────────────────────────────────────────────────────

// RÔLE : Génère un bouton de slot (position dans l'environnement).
// POURQUOI : Réutilisé dans openSlotPickerAvecEnv.
// envChoisi : transmis pour que confirmSlot sache dans quel env on place.
function makeSlotBtn(propIndex, slotId, label, arrow, occupied, currentSlot, envChoisi) {
  const taken     = occupied[slotId];
  const isCurrent = currentSlot === slotId;
  // On stocke envChoisi dans _pendingPropEnv via le onclick (confirmSlot le lira)
  const onclick   = envChoisi
    ? `window._pendingPropEnv='${envChoisi}';confirmSlot(${propIndex},'${slotId}')`
    : `confirmSlot(${propIndex},'${slotId}')`;
  return `<div onclick="${onclick}" style="
    border:2px solid ${isCurrent ? 'var(--lilac)' : 'var(--border)'};
    border-radius:var(--r-sm); padding:var(--sp-sm) 4px;
    cursor:pointer; text-align:center; font-size:var(--fs-sm); font-weight:bold;
    background:${isCurrent ? 'rgba(176,144,208,.15)' : taken ? '#fff8f0' : '#fff'};
    transition:.15s;"
    onmouseover="this.style.borderColor='var(--mint)'"
    onmouseout="this.style.borderColor='${isCurrent ? 'var(--lilac)' : 'var(--border)'}'">
    <div style="font-size:14px">${arrow}</div>
    <div>${label}</div>
    ${isCurrent ? `<div style="font-size:var(--fs-xs);color:var(--lilac);font-weight:bold">● ici</div>` : ''}
    ${taken && !isCurrent ? `<div style="font-size:var(--fs-xs);color:var(--coral)">⚠ ${taken}</div>` : ''}
  </div>`;
}

/**
 * Modale de placement d'un décor — slot seulement, env = activeEnv (pas de choix).
 * RÔLE : Ouvre directement le choix de slot dans l'env actif du switcher.
 * POURQUOI : L'env est déjà connu via le switcher — inutile de le redemander.
 */
function openSlotPicker(propIndex) {
  // L'env cible = l'env actuellement sélectionné dans le switcher de l'inventaire
  const envChoisi = window.D.g.activeEnv || 'parc';
  openSlotPickerAvecEnv(propIndex, envChoisi, false);
}

/**
 * Modale de sélection du slot pour un décor dans un environnement donné.
 * RÔLE : Affiche les 5 slots de position dans l'env envChoisi.
 * avecRangement : true si on est en train de modifier un décor déjà placé (affiche bouton Ranger).
 */
function openSlotPickerAvecEnv(propIndex, envChoisi, avecRangement) {
  const prop = window.D.g.props[propIndex];

  // Qui occupe quoi dans CET environnement ?
  const occupied = {};
  window.D.g.props.forEach(p => {
    if (p.actif && p.slot && p.env === envChoisi) occupied[p.slot] = p.nom;
  });

  const envLabel = { parc: '🌳 Parc', chambre: '🛏️ Chambre', montagne: '⛰️ Montagne' };

  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <button onclick="${avecRangement ? `openSlotPickerAvecRangement(${propIndex})` : `openSlotPicker(${propIndex})`}"
        style="background:none;border:none;font-size:16px;cursor:pointer;color:var(--text2);padding:0">←</button>
      <h3 style="font-size:13px;color:var(--lilac);margin:0">
        📍 Emplacement — ${envLabel[envChoisi] || envChoisi}
      </h3>
    </div>
    <p style="font-size:var(--fs-xs);opacity:.5;margin-bottom:8px">
      ${prop.emoji || '🎁'} ${escape(prop.nom)}
    </p>

    <div style="font-size:var(--fs-xs);opacity:.5;margin-bottom:4px;text-transform:uppercase">Fond</div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:var(--sp-sm)">
      ${makeSlotBtn(propIndex, 'A', 'Gauche', '↖', occupied, avecRangement ? prop.slot : null, envChoisi)}
      ${makeSlotBtn(propIndex, 'B', 'Droite', '↗', occupied, avecRangement ? prop.slot : null, envChoisi)}
    </div>

    <div style="font-size:var(--fs-xs);opacity:.5;margin-bottom:4px;text-transform:uppercase">Devant</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px">
      ${makeSlotBtn(propIndex, 'C',   'Gauche', '↙', occupied, avecRangement ? prop.slot : null, envChoisi)}
      ${makeSlotBtn(propIndex, 'SOL', 'Centre', '⬇', occupied, avecRangement ? prop.slot : null, envChoisi)}
      ${makeSlotBtn(propIndex, 'D',   'Droite', '↘', occupied, avecRangement ? prop.slot : null, envChoisi)}
    </div>

    ${avecRangement ? `
      <button class="btn btn-d" onclick="rangerProp(${propIndex})"
        style="width:100%;font-size:var(--fs-sm);margin-bottom:6px">📦 Ranger</button>
    ` : ''}
    <button class="btn btn-s" onclick="clModal()" style="width:100%;font-size:var(--fs-sm)">Annuler</button>
  `;
  animEl(document.getElementById('mbox'), 'bounceIn');

  // Stocker l'env choisi temporairement pour que confirmSlot puisse le lire
  window._pendingPropEnv = envChoisi;
}

// RÔLE : Confirme la position d'un décor dans un slot ET un environnement.
// POURQUOI : Remplace l'ancienne confirmSlot qui ne gérait pas l'env.
function confirmSlot(propIndex, slotId) {
  const prop     = window.D.g.props[propIndex];
  const envCible = window._pendingPropEnv || prop.env || window.D.g.activeEnv || 'parc';

  // Désactiver tout occupant actuel de ce slot dans le même environnement
  window.D.g.props.forEach(p => {
    if (p.actif && p.slot === slotId && p.env === envCible && p !== prop) {
      p.actif = false;
      p.slot  = null;
      p.env   = null;
      toast(`↩ ${p.nom} déplacé`);
    }
  });

  prop.actif = true;
  prop.slot  = slotId;
  prop.env   = envCible;
  window._pendingPropEnv = null; // nettoyer le temporaire
  save();
  clModal();
  renderProps();
  toast(`✨ ${prop.nom} placé !`);
  flashBubble(`Oh ! ${prop.nom} ! J'adore ! 💜`, 2500);
  const gx = window._gotchiX || 100;
  const gy = window._gotchiY || 100;
  for (let i = 0; i < 15; i++) {
    window.spawnP?.(gx + (Math.random() - 0.5) * 40, gy - 10,
      ['#c8a0e8','#f0c0d8','#fff8b0','#88c8f0','#b0e8b0'][Math.floor(Math.random()*5)]);
  }
  window.triggerGotchiBounce?.();
}

// RÔLE : Active directement un objet non-décor dans un environnement donné.
// POURQUOI : Les accessoires et ambiances n'ont pas de slot — juste un env.
function confirmEnvDirect(propIndex, envChoisi) {
  const prop = window.D.g.props[propIndex];
  // RÔLE : getPropDef cherche dans le catalogue ET dans D.propsPixels (objets IA).
  // POURQUOI : window.PROPS_LIB?.find() manquait les objets générés par l'IA, ce qui
  //            empêchait la déduplication par ancrage pour ces objets.
  const def  = getPropDef(prop.id);

  // RÔLE : Désactiver les concurrents (même ancrage ou même motion) dans le même env.
  // POURQUOI : On utilise getPropDef() au lieu de window.PROPS_LIB?.find() pour couvrir
  //            aussi les objets générés par l'IA (stockés dans D.propsPixels, pas dans PROPS_LIB).
  //            Sans ça, deux accessoires IA sur le même ancrage pouvaient rester actifs simultanément.
  if (prop.type === 'ambiance') {
    const motion = def?.motion || 'drift';
    window.D.g.props.forEach(p => {
      if (p !== prop && p.actif && p.type === 'ambiance' && p.env === envChoisi) {
        const pDef = getPropDef(p.id); // couvre catalogue ET objets IA
        if ((pDef?.motion || 'drift') === motion) { p.actif = false; p.env = null; toast(`↩ ${p.nom} remplacé`); }
      }
    });
  }
  if (prop.type === 'accessoire') {
    const ancrage = def?.ancrage || 'tete';
    window.D.g.props.forEach(p => {
      if (p !== prop && p.actif && p.type === 'accessoire' && p.env === envChoisi) {
        const pDef = getPropDef(p.id); // couvre catalogue ET objets IA
        if ((pDef?.ancrage || 'tete') === ancrage) { p.actif = false; p.env = null; toast(`↩ ${p.nom} remplacé`); }
      }
    });
  }

  prop.actif = true;
  prop.env   = envChoisi;
  save();
  clModal();
  renderProps();
  toast(`✨ ${prop.nom} activé !`);
  flashBubble(`Oh ! ${prop.nom} ! J'adore ! 💜`, 2500);
  const gx = window._gotchiX || 100;
  const gy = window._gotchiY || 100;
  for (let i = 0; i < 15; i++) {
    window.spawnP?.(gx + (Math.random() - 0.5) * 40, gy - 10,
      ['#c8a0e8','#f0c0d8','#fff8b0','#88c8f0','#b0e8b0'][Math.floor(Math.random()*5)]);
  }
  window.triggerGotchiBounce?.();
}

/**
 * Modale de modification — décor déjà actif, repositionner dans le même env ou ranger.
 * RÔLE : Ouvre directement les slots de l'env actif de la prop (pas de choix d'env).
 * POURQUOI : Un décor actif est dans un env fixé — on repositionne dans ce même env.
 *            Pour le déplacer vers un autre env, il faut d'abord le ranger puis le replacer.
 */
function openSlotPickerAvecRangement(propIndex) {
  // Ouvre la modale de slots directement dans l'env de la prop (avec bouton Ranger)
  openSlotPickerAvecEnv(propIndex, window.D.g.props[propIndex].env || window.D.g.activeEnv || 'parc', true);
}

// RÔLE : Range un objet (désactive + efface env et slot).
function rangerProp(propIndex) {
  const prop = window.D.g.props[propIndex];
  prop.actif = false;
  prop.slot  = null;
  prop.env   = null;
  save();
  clModal();
  renderProps();
  toast(`📦 ${prop.nom} rangé`);
}

// RÔLE : Range tous les objets actifs d'un environnement donné (ou tous si env = 'all').
// POURQUOI : Le bouton "Tout ranger" ne range que l'env actuellement sélectionné dans le switcher.
function rangerTout(env = 'all') {
  const envLabel = { parc: 'du Parc', chambre: 'de la Chambre', montagne: 'de la Montagne', all: '' };
  const label = envLabel[env] || '';
  if (!confirm(`📦 Ranger tous les objets actifs ${label} ?`.trim())) return;
  const D = window.D;
  let count = 0;
  D.g.props.forEach(p => {
    if (!p.actif) return;
    // Filtre par env : si env = 'all' on range tout, sinon seulement l'env ciblé
    // Rétrocompat : un objet sans .env est traité comme 'parc'
    const propEnv = p.env || 'parc';
    if (env === 'all' || propEnv === env) {
      p.actif = false;
      p.slot  = null;
      p.env   = null;
      count++;
    }
  });
  if (count === 0) {
    toast('Rien à ranger 😴');
    return;
  }
  save();
  renderProps();
  flashBubble(`*soupir de soulagement* Merci ! 🧹`, 2500);
  toast(`📦 ${count} objet${count > 1 ? 's' : ''} rangé${count > 1 ? 's' : ''}`);
}
window.rangerTout = rangerTout;

// ── SWITCHER D'ENV DEPUIS L'INVENTAIRE ────────────────────────────────

// RÔLE : Change l'environnement du tama depuis l'onglet inventaire (preview en direct).
// POURQUOI : Permet de visualiser les objets placés dans chaque univers sans quitter l'inventaire.
//            Le changement est temporaire — quand on quitte l'onglet, la logique
//            heure/onglet reprend (voir navTo dans ui.js).
function invSetEnv(env) {
  window.D.g.activeEnv = env;
  window._invEnvForced = true; // flag : on est en mode preview inventaire
  save();
  _updInvEnvSwitcher(); // met à jour les boutons du switcher
  renderProps();         // recharge la liste pour afficher les objets du bon env
}
window.invSetEnv = invSetEnv;

// RÔLE : Met à jour l'apparence visuelle des boutons du switcher d'env dans l'inventaire.
// POURQUOI : Surligne l'environnement actuellement actif.
//            Seuls les biomes avec hasInventory:true ont un bouton dans le DOM —
//            le jardin est exclu (espace procédural sans objets placés).
//            Avant : ['parc', 'chambre', 'montagne'] hardcodé.
function _updInvEnvSwitcher() {
  const activeEnv = window.D.g.activeEnv || 'parc';
  // RÔLE : On filtre sur hasInventory:true — le jardin n'a pas de bouton dans le HTML.
  // POURQUOI : Évite de chercher un #inv-env-jardin qui n'existe pas dans le DOM.
  const envIds = (window.HG_CONFIG?.ENV_BIOMES || [])
    .filter(t => t.hasInventory)
    .map(t => t.id);
  envIds.forEach(env => {
    const btn = document.getElementById(`inv-env-${env}`);
    if (!btn) return; // sécurité — bouton absent du DOM → ignoré silencieusement
    const isActive = activeEnv === env;
    btn.style.background = isActive ? '#fff' : 'transparent';
    btn.style.color       = isActive ? 'var(--lilac)' : 'var(--text2)';
    btn.style.boxShadow   = isActive ? '0 1px 4px rgba(0,0,0,.1)' : 'none';
  });
}
window._updInvEnvSwitcher = _updInvEnvSwitcher;

/* ─── SYSTÈME 7 : INGÉNIERIE (Salle des Machines / Debug) ────────── */
 function debugProps() {
  const D = window.D, lib = window.PROPS_LIB || [];
  const actifs = (D.g.props || []).filter(p => p.actif);
  const g = D.g;
  const s = getSt(g.totalXp);

  // Habits cochés aujourd'hui
  const today = new Date().toISOString().slice(0, 10);
  const habitsCochés = D.habits.filter(h => (D.log[today] || []).includes(h.catId)).length;

  // Taille localStorage
  const lsSize = new Blob([JSON.stringify(localStorage)]).size;
  const lsKo = (lsSize / 1024).toFixed(1);

  let r = '';
  r += `👾 ${g.name} — ${s.l} (${g.totalXp} XP)\n`;
  r += `⚡ Énergie: ${g.energy}/5 · 💜 Bonheur: ${g.happiness}/5\n`;
  r += `🌸 Pétales: ${g.petales || 0}\n`;
  r += `🌍 Thème: ${g.envTheme || 'pastel'}\n\n`;

  r += `📋 Habitudes\n`;
  r += `${D.habits.length} configurées · ${habitsCochés} cochées aujourd'hui\n\n`;

  r += `🎒 Objets\n`;
  r += `Catalogue: ${lib.length} · Inventaire: ${(D.g.props||[]).length} (${actifs.length} actifs)\n`;
  r += `Objets IA: ${Object.keys(D.propsPixels || {}).length}\n\n`;

  r += `📓 Journal\n`;
  const nbBulles = Array.isArray(g.customBubbles)
  ? g.customBubbles.length
  : Object.values(g.customBubbles || {}).reduce((acc, arr) => acc + arr.length, 0);
r += `${(D.journal||[]).length} entrées · ${nbBulles} bulles perso\n\n`;

  r += `📁 Fichiers data\n`;
  r += (lib.length > 0 ? '✅' : '❌') + ' props_base/shop/packs.json (' + lib.length + ' objets)\n';
  r += (window.PERSONALITY ? '✅' : '❌') + ' personality.json\n';
  r += (window.AI_CONTEXTS ? '✅' : '❌') + ' ai_contexts.json\n';
  r += (window.AI_SYSTEM ? '✅' : '❌') + ' ai_system.json\n\n';

    r += `🗺️ Météo\n`;
  const meteo = window.meteoData || D.meteo;
r += `🌡️ ${meteo ? `${meteo.temperature}°C · vent ${meteo.windspeed} km/h` : 'aucune donnée'}\n\n`;

  r += `💩 Crottes ramassées aujourd'hui: ${g.poopCount || 0}/10\n\n`;

  r += `💾 LocalStorage: ${lsKo} Ko`;

  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <h3 style="font-size:13px;color:var(--lilac);">🔍 État système</h3>
      ${window._modalCloseBtn()} <!-- RÔLE : bouton ✕ standardisé via ui-core.js -->
    </div>
    <pre id="debug-contenu" style="font-size:var(--fs-sm);line-height:1.6;white-space:pre-wrap;color:var(--text2);margin:0 0 10px 0">${r}</pre>
    <button onclick="navigator.clipboard.writeText(document.getElementById('debug-contenu').textContent).then(()=>toast('Copié ✓'))"
      style="width:100%;padding:var(--sp-sm);border-radius:var(--r-md);border:2px solid var(--border);font-size:var(--fs-sm);cursor:pointer;background:transparent;color:var(--text2);margin-bottom:6px">
      📋 Copier
    </button>
    <button onclick="clModal();setTimeout(voirBulles,150)"
  style="width:100%;padding:var(--sp-sm);border-radius:var(--r-md);border:2px solid var(--border);font-size:var(--fs-sm);cursor:pointer;background:transparent;color:var(--text2);margin-bottom:6px">
  💬 Voir les bulles perso
</button>
    <button onclick="viderJournal()"
      style="width:100%;padding:var(--sp-sm);border-radius:var(--r-md);border:none;font-size:var(--fs-sm);cursor:pointer;background:transparent;color:var(--danger);border:2px solid var(--danger);margin-bottom:6px"> <!-- #e57373 → var(--danger), font-size → var(--fs-sm) -->
      🗑️ Vider le journal
    </button>
    <button onclick="viderObjetsIA()"
      style="width:100%;padding:var(--sp-sm);border-radius:var(--r-md);border:none;font-size:var(--fs-sm);cursor:pointer;background:transparent;color:var(--danger);border:2px solid var(--danger)"> <!-- #e57373 → var(--danger), font-size → var(--fs-sm) -->
      🗑️ Vider les objets IA
    </button>
  `;
  animEl(document.getElementById('mbox'), 'bounceIn');
}

function voirBulles() {
  const cb = window.D.g.customBubbles || {};
  const etats = Object.keys(cb);
  
  if (!etats.length) {
    toast('Aucune bulle personnalisée pour l\'instant ✿');
    return;
  }

const contenu = cb.map((p, i) => `  ${i + 1}. ${p}`).join('\n');

  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <h3 style="font-size:13px;color:var(--lilac);">💬 Bulles personnalisées</h3>
      ${window._modalCloseBtn()} <!-- RÔLE : bouton ✕ standardisé via ui-core.js -->
    </div>
    <pre style="font-size:var(--fs-sm);line-height:1.8;white-space:pre-wrap;color:var(--text2);margin:0 0 10px;max-height:60vh;overflow-y:auto">${contenu}</pre>
    <button onclick="clModal()" class="btn btn-s" style="width:100%;font-size:var(--fs-sm)">Fermer</button>
  `;
  animEl(document.getElementById('mbox'), 'bounceIn');
}

function cleanProps() {
  const orphelins = window.D.g.props.filter(p => {
    return !(window.PROPS_LIB || []).find(l => l.id === p.id) 
        && (window.D.propsPixels || {})[p.id] === undefined;
  });

  if (!orphelins.length) {
    toast(`Aucun prop orphelin trouvé ✿`);
    return;
  }

  const liste = orphelins.map(p => `• ${p.emoji || '?'} ${p.nom}`).join('<br>');
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `
    <h3>Props orphelins (${orphelins.length})</h3>
    <p style="font-size:var(--fs-sm);color:var(--text2);margin:6px 0">Ces props n'ont plus de données associées :</p>
    <div style="font-size:var(--fs-sm);margin:8px 0;line-height:1.8">${liste}</div>
    <div style="display:flex;gap:6px;margin-top:10px">
      <button class="btn btn-s" onclick="clModal()" style="flex:1">Annuler</button>
      <button class="btn btn-d" onclick="confirmCleanProps()" style="flex:1">Supprimer</button>
    </div>
  `;
  animEl(document.getElementById('mbox'), 'bounceIn');
}

function confirmCleanProps() {
  const before = window.D.g.props.length;
  window.D.g.props = window.D.g.props.filter(p => {
    return (window.PROPS_LIB || []).find(l => l.id === p.id)
        || (window.D.propsPixels || {})[p.id] !== undefined;
  });
  save();
  clModal();
  toast(`${before - window.D.g.props.length} props supprimés ✿`);
  setTimeout(() => location.reload(), 800);
}

function viderJournal() {
  if (!confirm('Supprimer toutes les notes du journal ? La progression du Gotchi n\'est pas affectée.')) return;
  D.journal = [];
  save();
  toast(`Journal vidé ✿`);
  debugProps();
}

function viderObjetsIA() {
  if (!confirm('Supprimer tous les objets générés par le Gotchi ? Les objets du catalogue restent intacts.')) return;
  D.propsPixels = {};
  D.g.props = (D.g.props || []).filter(p => {
    return (window.PROPS_LIB || []).find(l => l.id === p.id);
  });
  save();
  toast(`Objets du Gotchi supprimés ✿`);
  debugProps();
}

/* ─── SYSTÈME 3 : COGNITION & IA (Interaction avec Claude) ───────── */

