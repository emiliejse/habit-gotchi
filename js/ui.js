/* ============================================================
   ui.js — Interactions, panneaux, modales, appels API Claude
   RÔLE : Ce fichier correspond aux "Mains" et à la "Bouche" de l'app.
   Il gère tout ce que l'utilisateur clique, lit et ouvre.
   Dépend de : app.js (window.D, save, today, hr, haptic, addXp,
               getSt, nxtTh, calcStr, toggleHab, editH, updBubbleNow,
               CATS, STG, UI_PALETTES, GOTCHI_COLORS, ENV_THEMES, SK)
   ============================================================ */

/**
 * UTILITAIRE GLOBAL (Système 7 : Ingénierie)
 * animEl() : applique une animation Animate.css sur un élément.
 * La classe est retirée automatiquement après l'animation pour pouvoir rejouer.
 */
function animEl(el, anim, dur = 600) {
  if (!el) return;
  el.style.setProperty('--animate-duration', dur + 'ms');
  el.classList.add('animate__animated', 'animate__' + anim);
  el.addEventListener('animationend', () => {
    el.classList.remove('animate__animated', 'animate__' + anim);
  }, { once: true });
}

/* ─── SYSTÈME 2 : ÉCOSYSTÈME & NAVIGATION ────────────────────── */
let journalLocked = true;
let masquerAcquis = true;

/**
 * Moteur de Routage interne (Single Page Application)
 * Affiche l'onglet ciblé et adapte l'environnement du Gotchi en fond.
 */
function syncConsoleHeight() {
  const top  = document.getElementById('console-top');
  const zone = document.getElementById('dynamic-zone');
  if (!top || !zone) return;
  
  requestAnimationFrame(() => {
    const sat = parseInt(getComputedStyle(document.documentElement)
      .getPropertyValue('--sat')) || 0;
    zone.style.paddingTop = (top.offsetHeight - sat + 8) + 'px';
  });
}

function syncDuringTransition(shell) {
  let running = true;
  
  // boucle : sync à chaque frame tant que la transition tourne
  const tick = () => {
    if (!running) return;
    syncConsoleHeight();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  
  // stop quand la transition CSS de .shrunk se termine
  const stop = () => { 
    running = false; 
    syncConsoleHeight(); // un dernier sync propre
    shell.removeEventListener('transitionend', stop);
  };
  shell.addEventListener('transitionend', stop);
  
  // filet de sécurité : stop après 600ms max (au cas où transitionend ne se déclenche pas)
  setTimeout(stop, 600);
}


function go(t) {
  window._gotchiActif = (t === 'gotchi');
  document.querySelectorAll('.pnl').forEach(p => p.classList.remove('on'));
  const targetPanel = document.getElementById('p-' + t);
  if (targetPanel) targetPanel.classList.add('on');

  const shell = document.querySelector('.tama-shell');
  if (t === 'gotchi') {
    shell.classList.remove('shrunk');
    const h = hr();
    window.D.g.activeEnv = (h >= 21 || h < 7) ? 'chambre' : 'parc';
  } else {
    shell.classList.add('shrunk');
    if      (t === 'journal')  window.D.g.activeEnv = 'chambre';
    else if (t === 'perso')    window.D.g.activeEnv = 'parc';
    else if (t === 'progress') window.D.g.activeEnv = 'montagne';
    else if (t === 'settings') window.D.g.activeEnv = 'chambre';
    else if (t === 'props')    window.D.g.activeEnv = 'parc';
  }
  save();

  if (t === 'gotchi' || t === 'settings') renderHabs();
  if (t === 'progress') renderProg();
  if (t === 'props') {
    (window.D.g.props || []).forEach(p => p.seen = true);
    save();
    renderProps();
    updBadgeBoutique();
  }
  if (t === 'perso')   renderPerso();
  if (t === 'journal') { journalLocked = true; renderJ(); }

    document.getElementById('dynamic-zone').scrollTop = 0;
  syncDuringTransition(shell);
}

function _preventScroll(e) { e.preventDefault(); }
function lockScroll() {
  document.getElementById('dynamic-zone').style.overflowY = 'hidden';
  document.addEventListener('touchmove', _preventScroll, { passive: false });
}
function unlockScroll() {
  document.getElementById('dynamic-zone').style.overflowY = '';
  document.removeEventListener('touchmove', _preventScroll);
}

function toggleMenu() {
  const ov = document.getElementById('menu-overlay');
  if (!ov.classList.contains('open')) {
    const nm = document.getElementById('menu-gotchi-name');
    if (nm) nm.textContent = window.D.g.name || 'Gotchi';
    lockScroll();
  } else {
    unlockScroll();
  }
  ov.classList.toggle('open');
}


function goMenu(t) { toggleMenu(); go(t); }

function updDate() {
  const d = new Date();
  const days = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  const mos  = ['jan','fév','mars','avr','mai','juin','juil','août','sep','oct','nov','déc'];
  document.getElementById('date-txt').textContent = `${days[d.getDay()]} ${d.getDate()} ${mos[d.getMonth()]}`;
}
updDate();

/* ─── SYSTÈME 7 : INGÉNIERIE (UI & FEEDBACK) ─────────────────── */
let _toastTimer;

function _noOrphan(txt) {
  // Colle la ponctuation finale à son mot précédent
  txt = txt.replace(/ ([!?.:…\u2026]+)$/, '\u00A0$1');
  // Colle le dernier mot au précédent (évite 1 mot ou 2 mots isolés)
  txt = txt.replace(/ (\S+)$/, '\u00A0$1');
  return txt;
}

/**
 * Toast : Notification éphémère douce en bas de l'écran (non-bloquante)
 */
function toast(m) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = _noOrphan(m);
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

/**
 * Modale standard avec bouton OK (bloquante)
 */
function toastModal(m) {
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `<p style="text-align:center;font-size:12px">${m}</p><button class="btn btn-p" onclick="clModal()" style="width:100%;margin-top:8px">OK</button>`;
  animEl(document.getElementById('mbox'), 'bounceIn');
}

/**
 * Mini-toast contextuel (ex: utilisé par l'animation du Snack)
 */
function toastSnack(msg) {
  let el = document.getElementById('snack');
  if (!el) {
    el = document.createElement('div'); el.id = 'snack';
    el.style.cssText = `position:fixed;bottom:60px;left:50%;transform:translateX(-50%);
      background:#38304a;color:#fff;padding:8px 16px;border-radius:20px;font-size:10px;
      font-family:'Courier New',monospace;z-index:500;opacity:0;transition:opacity .2s;
      pointer-events:none;white-space:nowrap;`;
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => el.style.opacity = '0', 1800);
}

/* ─── SYSTÈME 1 : MÉTABOLISME (Interactions) ─────────────────── */
let modalLocked = false; // ← true pendant le soutien

function clModal(e) {
  if (modalLocked) return;
  if (!e || e.target.id === 'modal') {
    document.getElementById('modal').style.display = 'none';
    unlockScroll();
  }
}

/**
 * Ouvre la popup de nourriture. 
 * Vérifie si c'est la nuit (bloqué) ou si déjà mangé.
 */
function ouvrirSnack() {
  const h = hr();
  if (h >= 22 || h < 7) {
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `
    <div style="text-align:center;padding:10px">
      <div style="font-size:48px;margin-bottom:8px">🌙</div>
      <p style="font-size:12px;margin-bottom:12px">
        ${window.D.g.name} dort... reviens demain 💜
      </p>
      <button class="btn btn-p" onclick="clModal()" style="width:100%">OK</button>
    </div>`;
  animEl(document.getElementById('mbox'), 'bounceIn');
  return;
  }
  const td = today();
  const emoji = getSnackOfDay();
  const dejaMange = window.D.g.snackDone === td;

  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = dejaMange
    ? `<div style="text-align:center;padding:10px">
        <div style="font-size:48px;margin-bottom:8px">${emoji}</div>
        <p style="font-size:12px;margin-bottom:12px">
          ${window.D.g.name} a déjà mangé aujourd'hui 💜
        </p>
        <button class="btn btn-p" onclick="clModal()" style="width:100%">OK</button>
      </div>`
    : `<div style="text-align:center;padding:10px">
        <div style="font-size:48px;margin-bottom:8px">${emoji}</div>
        <p style="font-size:12px;margin-bottom:12px">
          Donner ${emoji} à ${window.D.g.name} ?<br>
          <span style="color:var(--text2);font-size:10px">+2 🌸 • 1 fois par jour</span>
        </p>
        <div style="display:flex;gap:8px">
          <button class="btn btn-s" onclick="clModal()" style="flex:1">Non</button>
          <button class="btn btn-p" onclick="giveSnack();clModal();" style="flex:1">Donner !</button>
        </div>
      </div>`;
  animEl(document.getElementById('mbox'), 'bounceIn');
}

/* ─── SYSTÈME 7 : INGÉNIERIE (Mise à jour des Data dans le DOM) ── */

/**
 * Fonction centrale de mise à jour de l'interface (HUD, jauges, XP, noms).
 * Appelée dès qu'une donnée change dans app.js.
 */
function updUI() {
  const D = window.D;
  if (document.getElementById('petales-l'))
    document.getElementById('petales-l').textContent = `🌸 ${D.g.petales || 0}`;
  const g = D.g, s = getSt(g.totalXp), nt = nxtTh(g.totalXp), pt = s.th;
  
  // Calcul du % pour la barre de progression XP
  const pct = nt > pt ? ((g.totalXp - pt) / (nt - pt)) * 100 : 100;
  
  if (document.getElementById('g-name'))   document.getElementById('g-name').textContent = g.name;
  if (document.getElementById('g-stage'))  document.getElementById('g-stage').textContent = s.l;
  if (document.getElementById('xp-l'))     document.getElementById('xp-l').textContent = nt > pt ? `${g.totalXp - pt}/${nt - pt} XP` : `MAX ✿`;
  if (document.getElementById('xp-b'))     document.getElementById('xp-b').style.width = pct + '%';
  if (document.getElementById('sl-energy'))  { document.getElementById('sl-energy').value = g.energy; document.getElementById('sv-energy').textContent = g.energy; }
  if (document.getElementById('sl-happy'))   { document.getElementById('sl-happy').value = g.happiness; document.getElementById('sv-happy').textContent = g.happiness; }
  if (document.getElementById('s-xp'))    document.getElementById('s-xp').textContent = g.totalXp;
  if (document.getElementById('s-str'))   document.getElementById('s-str').textContent = calcStr();
  if (document.getElementById('s-jrn'))   document.getElementById('s-jrn').textContent = D.journal.length;
  if (document.getElementById('name-inp')) document.getElementById('name-inp').value = g.name;
  if (document.getElementById('env-sel'))  document.getElementById('env-sel').value = g.activeEnv || 'parc';
  if (document.getElementById('api-inp'))  document.getElementById('api-inp').value = D.apiKey || '';
  
  const petalesDisplay = document.getElementById('petales-wallet');
  if (petalesDisplay) petalesDisplay.textContent = `🌸 ${D.g.petales || 0}`;
  const petalesBoutique = document.getElementById('petales-wallet-boutique');
  if (petalesBoutique) petalesBoutique.textContent = `${D.g.petales || 0}`;
  
  const tc = document.getElementById('thought-count');
  if (tc) tc.textContent = `(${window.D.thoughtCount || 0}/3)`;
  const btnAsk = document.getElementById('btn-ask-claude');
  if (btnAsk) {
    btnAsk.childNodes[0].textContent = `Une pensée de ${window.D.g.name || 'le Gotchi'} `;
  }
  updBadgeBoutique();
}

/**
 * Module d'API : Teste la validité de la clé Anthropic.
 */
async function testApiKey() {
  const statusEl = document.getElementById('api-status');
  if (!statusEl) return;
  
  const key = D.apiKey;
  if (!key) { statusEl.innerHTML = '❌ <span style="color:#e57373">Aucune clé saisie</span>'; return; }
  
  statusEl.innerHTML = '⏳ Test en cours...';
  
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Réponds juste OK' }]
      })
    });
    const d = await r.json();
    
    if (d.error) {
      statusEl.innerHTML = `❌ <span style="color:#e57373">${d.error.message}</span>`;
    } else if (d.content) {
      statusEl.innerHTML = '✅ <span style="color:#81c784">Connecté</span>';
    }
  } catch(e) {
    statusEl.innerHTML = `❌ <span style="color:#e57373">${e.message}</span>`;
  }
}

/**
 * Gère l'affichage du point rouge sur le menu si de nouveaux objets sont dispos
 */
function updBadgeBoutique() {
  const badgeHdr = document.getElementById('badge-boutique-hdr');
  const badgeInv = document.getElementById('badge-boutique');
  
  // Boutique header : objet disponible à acheter
  const lib = window.PROPS_LIB || [];
  const petales = window.D.g.petales || 0;
  const aDisponible = lib.some(p => 
    !(window.D.g.props || []).find(inv => inv.id === p.id) && petales >= p.cout
  );
  if (badgeHdr) badgeHdr.style.display = aDisponible ? 'block' : 'none';

  // Inventaire menu : nouvel objet non vu
  const hasNew = (window.D.g.props || []).some(p => !p.seen);
  if (badgeInv) badgeInv.style.display = hasNew ? 'block' : 'none';
}

/* ─── SYSTÈME 4 : MOTEUR DE ROUTINE & HABITUDES ──────────────────── */
function renderHabs() {
  const D = window.D;
  const td = today(), log = D.log[td] || [], done = log.length;

  // --- Page d'accueil : liste des habitudes ---
  const habHome = document.getElementById('hab-home');
  if (habHome) {
habHome.innerHTML = D.habits.map((h, i) => {
  const c = CATS.find(c => c.id === h.catId);
  const d = log.includes(h.catId);
  const libelle = (h.label !== c?.label) ? h.label : (c?.def || h.label);
  return `
    <div class="hab ${d ? 'done' : ''}" style="position:relative">
      <div class="ck" onclick="toggleHab('${h.catId}')">${d ? '✓' : ''}</div>
      <span id="hab-label-${h.catId}" style="flex:1;font-size:12px;cursor:pointer"
  onclick="toggleHab('${h.catId}')">${libelle}</span>
      <span style="font-size:16px">${c.icon}</span>
      <span style="width:1px;background:var(--border);height:14px;margin:0 4px"></span>
      <span style="font-size:11px;color:var(--text2);cursor:pointer;padding:0 2px"
        onclick="editHabInline('${h.catId}', ${i})">✏️</span>
    </div>`;
}).join('') + `<p style="font-size:10px;color:var(--text2);text-align:center;margin-top:6px;opacity:0.7">
  ✏️ Appuie sur le crayon pour personnaliser tes habitudes
</p>`;
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

/* ─── SYSTÈME 5 : ÉCONOMIE, INVENTAIRE & BOUTIQUE ────────────────── */
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

function renderProps() {
  const D = window.D;
  const allDefs = [...(window.PROPS_LIB || []), ...(window.PROPS_LOCAL || [])];
  const cats = {
    'tous':       { label: '✿ Tous' },
    'decor':      { label: '🪑 Décor' },
    'accessoire': { label: '🎀 Accessoires' },
    'ambiance':   { label: '🌈 Ambiances' },
    'claude':     { label: '✨ Créations' },
  };
  const filterEl = document.getElementById('props-filters');
  if (filterEl) {
    filterEl.innerHTML = Object.entries(cats).map(([key, cat]) =>
      `<button onclick="setPropsFilter('${key}')" style="padding:4px 10px;border-radius:20px;border:2px solid var(--border);font:bold 10px 'Courier New',monospace;cursor:pointer;background:${propsFilterActive===key?'var(--lilac)':'#fff'};color:${propsFilterActive===key?'#fff':'var(--text2)'};transition:.15s;">${cat.label}</button>`
    ).join('');
  }
  const btnTout = document.getElementById('btn-ranger-tout');
if (btnTout) {
  const aDesActifs = D.g.props.some(p => p.actif);
  btnTout.style.display = aDesActifs ? 'block' : 'none';
}
  const listEl = document.getElementById('props-list');
  if (!listEl) return;
  if (!D.g.props || D.g.props.length === 0) {
    listEl.innerHTML = '<p style="font-size:10px;color:var(--text2);text-align:center;padding:12px">Ton sac est vide. Reviens plus tard ! ✿</p>';
    return;
  }
  const filtered = D.g.props
    .map((p, index) => ({ p, index, def: allDefs.find(l => l.id === p.id) }))
.filter(({ p }) => {
    if (propsFilterActive === 'tous') return true;
    if (propsFilterActive === 'claude') return !!(D.propsPixels && D.propsPixels[p.id]);
    return p.type === propsFilterActive;
  })
  .sort((a, b) => {
    // Actifs en premier, puis ordre alphabétique dans chaque groupe
    if (b.p.actif !== a.p.actif) return b.p.actif ? 1 : -1;
    return a.p.nom.localeCompare(b.p.nom, 'fr');
  });
  listEl.innerHTML = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">` +
    filtered.map(({ p, index, def }) => {
      const isClaud = !!(D.propsPixels && D.propsPixels[p.id]);
      const badgeId = `mini-${p.id}`;
      return `<div onclick="toggleProp(${index})" style="background:${p.actif?'var(--mint)':'#fff'};border:2px solid ${p.actif?'var(--mint)':isClaud?'var(--lilac)':'var(--border)'};border-radius:10px;padding:6px 4px 8px;font-size:10px;font-weight:bold;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:space-between;gap:4px;transition:.2s;text-align:center;box-shadow:0 2px 4px rgba(0,0,0,.05);position:relative;min-height:90px;">
        ${isClaud ? `
  <span style="position:absolute;top:3px;left:4px;font-size:14px;color:var(--lilac);">✦</span>
  <span onclick="event.stopPropagation();supprimerObjetIA('${p.id}')" style="position:absolute;top:2px;right:4px;font-size:13px;cursor:pointer;opacity:.6">🗑️</span>
` : ''}
        <div style="flex:1;display:flex;align-items:center;justify-content:center;">
          ${def && def.pixels ? `<canvas id="${badgeId}" style="image-rendering:pixelated;border-radius:3px"></canvas>` : `<span style="font-size:22px">${p.emoji||'🎁'}</span>`}
        </div>
        <div style="width:100%;">
          <div>${p.nom}</div>
          <div style="font-size:8px;text-transform:uppercase;opacity:.7;font-weight:normal;">${p.type}</div>
        </div>
      </div>`;
    }).join('') + `</div>`;
  filtered.forEach(({ p, def }) => {
    if (def && def.pixels) renderPropMini(document.getElementById(`mini-${p.id}`), def);
  });
  const wallet   = document.getElementById('xp-wallet');
  if (wallet)  wallet.textContent = `💜 ${D.g.totalXp} XP disponibles`;
}

function ouvrirBoutique() {
  const onglet = window._boutiqueOnglet || 'catalogue';
  document.getElementById('modal').style.display = 'flex';
  lockScroll();
  document.getElementById('mbox').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <h3 style="font-size:13px;color:var(--lilac);">🛍️ Boutique</h3>
<button onclick="clModal()" style="background:none;border:none;font-size:16px;cursor:pointer;color:var(--text2)">✕</button>    </div>

    <div style="text-align:center;margin-bottom:16px">
      <p style="font-size:11px;color:var(--text2);text-align:center">
  🌸 <b style="font-size:15px;color:var(--lilac)">${D.g.petales || 0}</b> pétales disponibles
</p>
    </div>

    <div style="display:flex;gap:6px;margin-bottom:14px;background:rgba(0,0,0,0.05);border-radius:20px;padding:3px;margin-right:2px">
      <button onclick="switchBoutiqueOnglet('catalogue')"
        style="flex:1;padding:7px;border-radius:16px;border:none;font-size:10px;cursor:pointer;font-weight:bold;font-family:'Courier New',monospace;
        background:${onglet==='catalogue'?'#fff':'transparent'};
        color:${onglet==='catalogue'?'var(--lilac)':'var(--text2)'};
        box-shadow:${onglet==='catalogue'?'0 1px 4px rgba(0,0,0,.1)':'none'};
        transition:.15s">
        🌸 Catalogue
      </button>
      <button onclick="switchBoutiqueOnglet('claude')"
        style="flex:1;padding:7px;border-radius:16px;border:none;font-size:10px;cursor:pointer;font-weight:bold;font-family:'Courier New',monospace;
        background:${onglet==='claude'?'#fff':'transparent'};
        color:${onglet==='claude'?'var(--lilac)':'var(--text2)'};
        box-shadow:${onglet==='claude'?'0 1px 4px rgba(0,0,0,.1)':'none'};
        transition:.15s">
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
    const lib = window.PROPS_LIB || [];
    const libFiltree = lib.filter(prop => !(D.g.props || []).find(p => p.id === prop.id))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

    el.innerHTML = libFiltree.map(prop => {
      const peutAcheter = (D.g.petales || 0) >= prop.cout;
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px 8px 10px;border:2px solid var(--border);border-radius:10px;margin-bottom:6px;background:#fff">
          <span style="font-size:18px">${prop.emoji}</span>
          <span style="font-size:10px;font-weight:bold;flex:1;margin:0 8px">${prop.nom}</span>
          <button onclick="acheterProp('${prop.id}')"
            style="padding:5px 12px;border-radius:20px;border:none;font-size:9px;font-weight:bold;font-family:'Courier New',monospace;
            cursor:${peutAcheter?'pointer':'not-allowed'};
            background:${peutAcheter?'linear-gradient(135deg,var(--lilac),var(--pink))':'#ddd'};
            color:${peutAcheter?'#fff':'#aaa'};
            border-bottom:${peutAcheter?'2px solid rgba(0,0,0,0.15)':'2px solid transparent'}">
            ${prop.cout === 0 ? 'Prendre 🎁' : `🌸 ${prop.cout}`}
          </button>
        </div>`;
    }).join('');

  } else {
// Onglet IA
    const peutGenerer = (D.g.petales || 0) >= 10;
    const derniersProps = Object.values(window.D.propsPixels || {});
    const dernierObj = derniersProps.length ? derniersProps[derniersProps.length - 1] : null; 

    el.innerHTML = `
      <p style="font-size:10px;color:var(--text2);text-align:center;margin-bottom:16px;line-height:1.6">
        ${window.D.g.name} invente un objet unique<br>rien que pour toi ✨
      </p>
      <div style="text-align:center">
        <button onclick="acheterPropClaude()"
          style="padding:12px 28px;border-radius:999px;border:none;font-size:11px;font-weight:bold;font-family:'Courier New',monospace;
          cursor:${peutGenerer?'pointer':'not-allowed'};
          background:${peutGenerer?'linear-gradient(135deg,var(--lilac),var(--pink))':'#ddd'};
          color:${peutGenerer?'#fff':'#aaa'};
          border-bottom:${peutGenerer?'3px solid rgba(0,0,0,0.15)':'3px solid transparent'};
          letter-spacing:.5px">
          ${peutGenerer ? `✨ Demander à ${window.D.g.name} — 🌸 10` : '🌸 Il te faut 10 pétales'}
        </button>
      </div>
      ${dernierObj ? `
  <div style="margin-top:20px;text-align:center;border-top:1px solid var(--border);padding-top:16px">
    <div style="font-size:9px;color:var(--text2);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px">dernière création</div>
    <canvas id="apercu-dernier-prop" style="image-rendering:pixelated;border-radius:6px;border:2px solid var(--border)"></canvas>
    <div style="font-size:10px;font-weight:bold;margin-top:6px">${dernierObj.emoji} ${dernierObj.nom}</div>
    <div style="font-size:8px;color:var(--text2);text-transform:uppercase;margin-top:2px">${dernierObj.type}</div>
  </div>` : `
  <div style="margin-top:20px;text-align:center;border-top:1px solid var(--border);padding-top:16px;opacity:.5">
    <div style="font-size:28px;margin-bottom:6px">🌱</div>
    <div style="font-size:9px;color:var(--text2);line-height:1.6">Pas encore de création...<br>demande à ${window.D.g.name} d'inventer quelque chose ✨</div>
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

function toggleMasquerAcquis() {
  masquerAcquis = !masquerAcquis;
  renderBoutiqueOnglet('catalogue');
}

function acheterProp(propId) {
  const prop = (window.PROPS_LIB || []).find(p => p.id === propId);
  if (!prop) return;
  if ((D.g.petales || 0) < prop.cout) { toast(`Pas assez de pétales 🌸`); return; }
  
  D.g.petales = (D.g.petales || 0) - prop.cout;
  if (!D.g.props) D.g.props = [];
  D.g.props.push({ id: prop.id, nom: prop.nom, type: prop.type, emoji: prop.emoji, actif: false, pxSize:  prop.pxSize  || null, seen: false });
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
function setPropsFilter(cat) { propsFilterActive = cat; renderProps(); }

/**
 * Gère le clic sur un objet dans l'inventaire.
 * Active les accessoires directs, ou ouvre le sélecteur de position (Slots) pour les décors.
 */
function toggleProp(index) {
  const prop = D.g.props[index];

  // --- Désactiver si déjà actif ---
  if (prop.actif) {
    if (prop.type === 'decor') {
      openSlotPickerAvecRangement(index);
    } else {
      prop.actif = false;
      prop.slot = null;
      save();
      renderProps();
      toast(`📦 ${prop.nom} rangé`);
      flashBubble(`*au revoir ${prop.nom}* 👋`, 2500);
    }
    return;
  }

  // --- Objets non-décor : activer direct ---
  if (prop.type !== 'decor') {

    // Désactiver ambiance avec même motion
    if (prop.type === 'ambiance') {
      const def = getPropDef(prop.id);
      const motion = def?.motion || 'drift';
      D.g.props.forEach(p => {
        if (p !== prop && p.actif && p.type === 'ambiance') {
          const pDef = getPropDef(p.id);
          if ((pDef?.motion || 'drift') === motion) {
            p.actif = false;
            toast(`↩ ${p.nom} remplacé`);
          }
        }
      });
    }

    // Désactiver accessoire avec même ancrage
    if (prop.type === 'accessoire') {
      const def = getPropDef(prop.id);
      const ancrage = def?.ancrage || 'top';
      D.g.props.forEach(p => {
        if (p !== prop && p.actif && p.type === 'accessoire') {
          const pDef = getPropDef(p.id);
          if ((pDef?.ancrage || 'top') === ancrage) {
            p.actif = false;
            toast(`↩ ${p.nom} remplacé`);
          }
        }
      });
    }

    prop.actif = true;
    save();
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
    return;
  }

  // --- Objet décor : ouvrir le picker de slot ---
  openSlotPicker(index);
}

function supprimerObjetIA(propId) {
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `
    <p style="text-align:center;font-size:12px;margin-bottom:12px">Supprimer cet objet définitivement ?</p>
    <button class="btn btn-d" onclick="confirmerSuppressionIA('${propId}')" style="width:100%;margin-bottom:6px;font-size:10px">🗑️ Supprimer</button>
    <button class="btn btn-s" onclick="clModal()" style="width:100%;font-size:10px">Annuler</button>
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

function makeSlotBtn(propIndex, slotId, label, arrow, occupied, currentSlot) {
  const taken = occupied[slotId];
  const isCurrent = currentSlot === slotId;
  return `<div onclick="confirmSlot(${propIndex},'${slotId}')" style="
    border:2px solid ${isCurrent ? 'var(--lilac)' : 'var(--border)'}; 
    border-radius:8px; padding:8px 4px;
    cursor:pointer; text-align:center; font-size:10px; font-weight:bold;
    background:${isCurrent ? 'rgba(176,144,208,.15)' : taken ? '#fff8f0' : '#fff'}; 
    transition:.15s;"
    onmouseover="this.style.borderColor='var(--mint)'"
    onmouseout="this.style.borderColor='${isCurrent ? 'var(--lilac)' : 'var(--border)'}'">
    <div style="font-size:14px">${arrow}</div>
    <div>${label}</div>
    ${isCurrent ? `<div style="font-size:8px;color:var(--lilac);font-weight:bold">● ici</div>` : ''}
    ${taken && !isCurrent ? `<div style="font-size:8px;color:var(--coral)">⚠ ${taken}</div>` : ''}
  </div>`;
}

/**
 * Modale permettant de choisir visuellement la couche (Z-index) et la position du décor.
 */
function openSlotPicker(propIndex) {
  const prop = D.g.props[propIndex];

  // Qui occupe quoi en ce moment ?
  const occupied = {};
  D.g.props.forEach(p => {
    if (p.actif && p.slot) occupied[p.slot] = p.nom;
  });

const slots = [
  { id: 'A',   label: 'Fond gauche',   desc: '↖ Arrière-plan' },
  { id: 'B',   label: 'Fond droit',    desc: '↗ Arrière-plan' },
  { id: 'C',   label: 'Devant gauche', desc: '↙ Premier plan' },
  { id: 'SOL', label: 'Centre',        desc: '⬇ Devant Gotchi' },
  { id: 'D',   label: 'Devant droit',  desc: '↘ Premier plan' },
];

  const slotHTML = slots.map(s => {
    const taken = occupied[s.id];
    const takenBadge = taken
      ? `<span style="font-size:8px;color:var(--lilac);display:block">⚠ ${taken}</span>`
      : '';
    return `
      <div onclick="confirmSlot(${propIndex},'${s.id}')" style="
        border:2px solid var(--border); border-radius:8px; padding:8px 6px;
        cursor:pointer; text-align:center; font-size:10px; font-weight:bold;
        background:${taken ? '#fff8f0' : '#fff'};
        transition:.15s;" onmouseover="this.style.borderColor='var(--mint)'"
        onmouseout="this.style.borderColor='var(--border)'">
        <div style="font-size:16px">📍</div>
        <div>${s.label}</div>
        <div style="font-size:8px;opacity:.6;font-weight:normal">${s.desc}</div>
        ${takenBadge}
      </div>`;
  }).join('');

  document.getElementById('modal').style.display = 'flex';
document.getElementById('mbox').innerHTML = `
  <h3 style="font-size:13px;margin-bottom:10px;color:var(--lilac)">
    📍 Où placer ${prop.emoji || '🎁'} ${prop.nom} ?
  </h3>

  <div style="font-size:9px;opacity:.5;margin-bottom:4px;text-transform:uppercase">Fond</div>
  <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:8px">
    ${makeSlotBtn(propIndex, 'A', 'Gauche',  '↖', occupied)}
    ${makeSlotBtn(propIndex, 'B', 'Droite',  '↗', occupied)}
  </div>

  <div style="font-size:9px;opacity:.5;margin-bottom:4px;text-transform:uppercase">Devant</div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px">
    ${makeSlotBtn(propIndex, 'C',   'Gauche', '↙', occupied)}
    ${makeSlotBtn(propIndex, 'SOL', 'Centre', '⬇', occupied)}
    ${makeSlotBtn(propIndex, 'D',   'Droite', '↘', occupied)}
  </div>

  <button class="btn btn-s" onclick="clModal()" style="width:100%;font-size:10px">Annuler</button>
`;
animEl(document.getElementById('mbox'), 'bounceIn');
}

function confirmSlot(propIndex, slotId) {
  const prop = D.g.props[propIndex];

  // Désactiver l'éventuel occupant actuel du slot
  D.g.props.forEach(p => {
    if (p.actif && p.slot === slotId && p !== prop) {
      p.actif = false;
      p.slot = null;
      toast(`↩ ${p.nom} déplacé`);
    }
  });

  prop.actif = true;
  prop.slot = slotId;
  save();
  clModal();
  renderProps();
  toast(`✨ ${prop.nom} placé (${slotId}) !`);
  flashBubble(`Oh ! ${prop.nom} ! J'adore ! 💜`, 2500);
  // Confettis au moment du choix du slot
  const gx = window._gotchiX || 100;
  const gy = window._gotchiY || 100;
  for (let i = 0; i < 15; i++) {
    window.spawnP?.(gx + (Math.random() - 0.5) * 40, gy - 10,
      ['#c8a0e8','#f0c0d8','#fff8b0','#88c8f0','#b0e8b0'][Math.floor(Math.random()*5)]);
  }
  window.triggerGotchiBounce?.();
}

function openSlotPickerAvecRangement(propIndex) {
  const prop = D.g.props[propIndex];
  const occupied = {};
  D.g.props.forEach(p => { if (p.actif && p.slot) occupied[p.slot] = p.nom; });

  // Réutilise makeSlotBtn existant
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `
    <h3 style="font-size:13px;margin-bottom:6px;color:var(--lilac)">
      📍 ${prop.emoji || '🎁'} ${prop.nom}
    </h3>
    <p style="font-size:10px;opacity:.6;margin-bottom:10px">
      Changer d'emplacement ?
    </p>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:8px">
      ${makeSlotBtn(propIndex, 'A',   'Gauche', '↖', occupied, prop.slot)}
      ${makeSlotBtn(propIndex, 'B',   'Droite', '↗', occupied, prop.slot)}
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px">
      ${makeSlotBtn(propIndex, 'C',   'Gauche', '↙', occupied, prop.slot)}
      ${makeSlotBtn(propIndex, 'SOL', 'Centre', '⬇', occupied, prop.slot)}
      ${makeSlotBtn(propIndex, 'D',   'Droite', '↘', occupied, prop.slot)}
    </div>
    <button class="btn btn-d" onclick="rangerProp(${propIndex})" style="width:100%;font-size:10px;margin-bottom:6px">
      📦 Ranger
    </button>
    <button class="btn btn-s" onclick="clModal()" style="width:100%;font-size:10px">Annuler</button>
  `;
  animEl(document.getElementById('mbox'), 'bounceIn');
}

function rangerProp(propIndex) {
  const prop = D.g.props[propIndex];
  prop.actif = false;
  prop.slot = null;
  save();
  clModal();
  renderProps();
  toast(`📦 ${prop.nom} rangé`);
}

function rangerTout(type = 'all') {
  if (!confirm('📦 Ranger tous les objets actifs ?')) return;
  const D = window.D;
  let count = 0;
  D.g.props.forEach(p => {
    if (!p.actif) return;
    if (type === 'all' || p.type === type) {
      p.actif = false;
      p.slot = null;
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
  r += (lib.length > 0 ? '✅' : '❌') + ' props.json\n';
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
      <button onclick="clModal()" style="background:none;border:none;font-size:16px;cursor:pointer">✕</button>
    </div>
    <pre id="debug-contenu" style="font-size:10px;line-height:1.6;white-space:pre-wrap;color:var(--text2);margin:0 0 10px 0">${r}</pre>
    <button onclick="navigator.clipboard.writeText(document.getElementById('debug-contenu').textContent).then(()=>toast('Copié ✓'))"
      style="width:100%;padding:8px;border-radius:12px;border:2px solid var(--border);font-size:10px;cursor:pointer;background:transparent;color:var(--text2);margin-bottom:6px">
      📋 Copier
    </button>
    <button onclick="clModal();setTimeout(voirBulles,150)"
  style="width:100%;padding:8px;border-radius:12px;border:2px solid var(--border);font-size:10px;cursor:pointer;background:transparent;color:var(--text2);margin-bottom:6px">
  💬 Voir les bulles perso
</button>
    <button onclick="viderJournal()"
      style="width:100%;padding:8px;border-radius:12px;border:none;font-size:10px;cursor:pointer;background:transparent;color:#e57373;border:2px solid #e57373;margin-bottom:6px">
      🗑️ Vider le journal
    </button>
    <button onclick="viderObjetsIA()"
      style="width:100%;padding:8px;border-radius:12px;border:none;font-size:10px;cursor:pointer;background:transparent;color:#e57373;border:2px solid #e57373">
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

  const contenu = etats.map(etat => {
    const phrases = cb[etat].map(p => `  • ${p}`).join('\n');
    return `${etat}\n${phrases}`;
  }).join('\n\n');

  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <h3 style="font-size:13px;color:var(--lilac);">💬 Bulles personnalisées</h3>
      <button onclick="clModal()" style="background:none;border:none;font-size:16px;cursor:pointer">✕</button>
    </div>
    <pre style="font-size:10px;line-height:1.8;white-space:pre-wrap;color:var(--text2);margin:0 0 10px;max-height:60vh;overflow-y:auto">${contenu}</pre>
    <button onclick="clModal()" class="btn btn-s" style="width:100%;font-size:10px">Fermer</button>
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
    <p style="font-size:11px;color:var(--text2);margin:6px 0">Ces props n'ont plus de données associées :</p>
    <div style="font-size:11px;margin:8px 0;line-height:1.8">${liste}</div>
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

/* ── Animation de chargement IA (réutilisable) ── */
function startThinkingAnim(elementId, nomGotchi) {
  const el = document.getElementById(elementId);
  if (!el) return null;

  const phrases = [
    `💭 ${nomGotchi} réfléchit`,
    `✨ ${nomGotchi} cherche les mots`,
    `🌱 ${nomGotchi} prépare quelque chose`,
    `💜 ${nomGotchi} est là`,
  ];
  let frame = 0, dots = 0;
  el.textContent = phrases[0] + '...';

  const interval = setInterval(() => {
    dots = (dots + 1) % 4;
    if (dots === 0) frame = (frame + 1) % phrases.length;
    el.textContent = phrases[frame] + '.'.repeat(dots || 3);
  }, 400);

  return interval; // stocker pour pouvoir l'arrêter
}

function stopThinkingAnim(interval) {
  if (interval) clearInterval(interval);
}

/* ============================================================
   API CLAUDE — CADEAU / BULLE
   ============================================================ */
/**
 * Demande à Claude une pensée personnalisée (Limité à 3x par jour).
 */
async function askClaude() {
  const key = D.apiKey;
  if (!key) { toast(`*chuchote* J'ai besoin de ma clé API dans les Réglages 🔑`); return; }

  const g = D.g, td = today();
  const msgEl = document.getElementById('claude-msg');

  /* ── Mode nuit ── */
  if (hr() >= 22 || hr() < 7) {
    const msgs = [
      "Zzz... je dors 🌙",
      "Chut ! Il est tard... 😴",
      "Laisse-moi tranquille, vas dormir ! 🌛",
      "...zzzZZZ... 💤",
      "Le Gotchi ronfle doucement. Reviens demain ✿"
    ];
    if (msgEl) msgEl.textContent = msgs[Math.floor(Math.random() * msgs.length)];
    return;
  }

  /* ── Limite 3 pensées par jour ── */
  if (window.D.lastThoughtDate !== td) {
    window.D.lastThoughtDate = td;
    window.D.thoughtCount    = 0;
  }
  if (window.D.thoughtCount >= 3) {
    toast("Le Gotchi a besoin de calme… Reviens demain 🌙");
    return;
  }

  /* ── Animation de chargement ── */
  const animThought = startThinkingAnim('claude-msg', g.name);

  /* ── Construction du prompt ── */
  const P   = window.PERSONALITY;
  const CTX = window.AI_CONTEXTS?.askClaude;

  const notesRecentes = D.journal
    .slice(-3)
    .map(j => {
      const d = j.date ? j.date.split('T')[0] : 'date inconnue';
      return `[${d}] ${j.text.slice(0, 40)}`;
    })
    .filter(t => t.length > 0)
    .join(' / ');

  const vars = {
    nameGotchi:           D.g.name      || P?.nom    || 'Petit·e Gotchi',
    userName:      D.g.userName  || D.userName || 'ton utilisatrice',
    diminutif:     D.g.userNickname || D.g.userName || D.userName || 'toi',
    style:         P?.style      || 'Phrases courtes, onomatopées entre astérisques, bienveillant.',
    traits:        P?.traits?.join(', ') || 'doux, joueur, curieux',
    energy:        g.energy,
    happiness:     g.happiness,
    heure:         new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    date:          todayFr(),
    notesRecentes: notesRecentes
      ? `Aujourd'hui : ${todayFr()}. Ambiance récente : ${notesRecentes}`
      : `Aujourd'hui : ${todayFr()}.`,
    exemples: [
  ...(P?.bulles?.idle   || []).slice(0, 2),
  ...(P?.bulles?.triste || []).slice(0, 1),
  ...(P?.bulles?.matin  || []).slice(0, 1),
  ...(P?.bulles?.soir   || []).slice(0, 1),
].join(', ') || '*bâille*, *sourit*',
    nomsExistants: [...new Set([
      ...(D.g.props || []).map(p => `${p.nom} (${p.type})`),
      ...(window.PROPS_LIB || []).map(p => `${p.nom} (${p.type})`)
    ])].join(', ') || 'aucun',
    timestamp:     Date.now(),
  };

  function fillVars(template) {
    return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
  }

  /* ── Règle cadeau : 1 tous les 3 jours ── */
  const giveGift = !D.lastGiftDate ||
    Math.floor((new Date() - new Date(D.lastGiftDate)) / 86400000) >= 3;

  const prompt = CTX
    ? fillVars(CTX.base) + '\n\n' + fillVars(giveGift ? CTX.withGift : CTX.withoutGift)
    : `Fallback : réponds en JSON {"message":"...","bulles":{"idle":"..."}}`;

  /* ── Appel API ── */
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({ model:'claude-sonnet-4-5', max_tokens:500, messages:[{ role:'user', content:prompt }] })
    });
    const d       = await r.json();
    const rawText = d.content[0].text;
    const match   = rawText.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('JSON introuvable dans la réponse IA');
    const data = JSON.parse(match[0]);

    stopThinkingAnim(animThought);

    /* ── Message affiché ── */
    if (msgEl) msgEl.textContent = data.message;

    /* ── Bulles enrichies (pool glissant 4 max) ── */
    if (data.bulles && typeof data.bulles === 'object') {
      if (!D.g.customBubbles || Array.isArray(D.g.customBubbles))
        D.g.customBubbles = {};
      Object.entries(data.bulles).forEach(([etat, phrase]) => {
        if (!phrase || typeof phrase !== 'string') return;
        if (!D.g.customBubbles[etat]) D.g.customBubbles[etat] = [];
        D.g.customBubbles[etat].unshift(phrase);
        D.g.customBubbles[etat] = D.g.customBubbles[etat].slice(0, 4);
      });
    }

    /* ── Cadeau ── */
    if (giveGift && data.cadeau) {
      if (!D.g.props) D.g.props = [];
      if (!D.g.props.find(p => p.id === data.cadeau.id)) {
        D.g.props.push({ id:data.cadeau.id, nom:data.cadeau.nom, type:data.cadeau.type, actif:false, pxSize: data.cadeau.pxSize || null, seen:false });
        D.propsPixels                = D.propsPixels || {};
        D.propsPixels[data.cadeau.id] = data.cadeau;
        window.PROPS_LOCAL           = Object.values(D.propsPixels);
        D.lastGiftDate               = td;

        const poolCadeau = ["Oh ! Un cadeau ! 🎁", "*yeux brillants* ✨", `${data.cadeau.emoji} Pour moi ?! 💜`, "J'adore ! 🌸"];
        const bulleCadeau = poolCadeau[Math.floor(Math.random() * poolCadeau.length)];
        flashBubble(bulleCadeau.replace('{{nom}}', D.g.name || 'toi'), 3000);
        toast(`🎁 Nouveau cadeau : ${data.cadeau.nom} !`);
        addEvent({ type:'cadeau', subtype:'ia', valeur:0, label:`${data.cadeau.nom} reçu en cadeau !` });
        updBadgeBoutique();
      }
    }

    /* ── Compteur ── */
    window.D.thoughtCount++;
    const tc = document.getElementById('thought-count');
    if (tc) tc.textContent = `(${window.D.thoughtCount}/3)`;

    save(); renderProps(); updBubbleNow();

  } catch(e) {
    stopThinkingAnim(animThought);
    if (msgEl) msgEl.textContent = '*soupir* Je n\'arrive pas à me connecter... ✿';
    console.error('Erreur askClaude :', e);
  }
}

/**
 * Demande à Claude de générer un Pixel Art via la Boutique.
 */
async function acheterPropClaude() {
  if ((D.g.petales || 0) < 10) { toast(`Pas assez de pétales 🌸`); return; }
  if (!D.apiKey) { toast(`*chuchote* J'ai besoin de ma clé API dans les Réglages 🔑`); return; }

  D.g.petales -= 10;
  save();

  /* ── Animation de chargement ── */
  const el = document.getElementById('boutique-contenu');
  if (el) el.innerHTML = `<p style="text-align:center;font-size:11px;padding:20px" id="prop-loading">💭</p>`;
  const animProp = startThinkingAnim('prop-loading', window.D.g.name);

  /* ── Construction du prompt ── */
  const nomsInventaire = (D.g.props || []).map(p => `${p.nom} (${p.type})`);
  const nomsCatalogue  = (window.PROPS_LIB || []).map(p => `${p.nom} (${p.type})`);
  const nomsExistants = [...new Set([
  ...(D.g.props || []).map(p => `${p.nom} (${p.type})`),
  ...(window.PROPS_LIB || []).map(p => `${p.nom} (${p.type})`)
])].join(', ') || 'aucun';
  const themes = ['nature','cosmos','magie','cuisine','musique','voyage','océan','forêt','météo','jardin','minéral','rêve'];
  const theme  = themes[Math.floor(Math.random() * themes.length)];
  const ctx    = window.AI_CONTEXTS;

  const prompt = ctx
    ? ctx.buyProp
        .replace('{{theme}}',         theme)
        .replace('{{existingNames}}', nomsExistants)
        .replace('{{timestamp}}',     Date.now())
    : (() => { toast(`*inquiet* Mes fichiers de mémoire sont manquants... 💜`); return null; })();

  if (!prompt) { stopThinkingAnim(animProp); return; }

  /* ── Appel API ── */
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': D.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({ model:'claude-sonnet-4-5', max_tokens:500, temperature:1, messages:[{ role:'user', content:prompt }] })
    });
    const data  = await r.json();
    const match = data.content[0].text.match(/\{[\s\S]*\}/);

    stopThinkingAnim(animProp);

    if (match) {
      const obj = JSON.parse(match[0]);
      D.g.props.push({
        id:      obj.id,
        nom:     obj.nom,
        type:    obj.type,
        emoji:   obj.emoji  || '🎁',
        actif:   false,
        slot:    obj.slot   || 'A',
        motion:  obj.motion || 'drift',
        ancrage: obj.ancrage || null,
        seen:    false
      });
      D.propsPixels         = D.propsPixels || {};
      D.propsPixels[obj.id] = obj;
      window.PROPS_LOCAL    = Object.values(D.propsPixels);
      save(); renderProps(); updUI();
      addEvent({
  type: 'cadeau',
  subtype: 'ia',
  valeur: 0,
  emoji: obj.emoji || '✨',
  label: `${obj.nom} créé par ${D.g.name} !`
});
      updTabletBadge();

      toast(`${obj.emoji || '✨'} ${obj.nom} ajouté à ton inventaire !`);
      const iaMsgs = [
    `${obj.emoji} Je l'ai fait pour toi ! 💜`,
    "*fier·e* C'est mon œuvre ! ✨",
    `${obj.emoji} J'ai tout imaginé ! 🌸`,
    "*souffle sur ses pattes* ✿",
    "Je savais que tu aimerais ! 💜"
      ];
      flashBubble(iaMsgs[Math.floor(Math.random() * iaMsgs.length)], 2500);
      ouvrirBoutique();
    }

  } catch(e) {
    stopThinkingAnim(animProp);
    D.g.petales = (D.g.petales || 0) + 16;
    save();
    toast(`*soupir* Je n'ai pas pu créer l'objet... pétales remboursés 🌸`);
    console.error('Erreur création prop IA :', e);
    ouvrirBoutique();
  }
}

/* ============================================================
   API CLAUDE — SOUTIEN
   ============================================================ */
function toastInfo() {
  toastModal("💬 Le Gotchi peut te partager une pensée jusqu'à 3 fois par jour.\n\n✍️ Si tu écris des notes dans ton journal, ses réponses seront personnalisées selon ton humeur du jour 💜");
}

/**
 * Lance le chat d'urgence (limité à 6 messages non sauvegardés)
 */
function genSoutien() {
  const D = window.D, td = today();

  // ✦ PAS DE CLÉ API : popup simplifié
  if (!D.apiKey) {
    document.getElementById('modal').style.display = 'flex';
    document.getElementById('mbox').innerHTML = `
      <div style="text-align:center;padding:10px">
        <div style="font-size:40px;margin-bottom:8px">🔑</div>
        <p style="font-size:12px;margin-bottom:4px;color:var(--lilac);font-weight:bold">
          Clé API manquante
        </p>
        <p style="font-size:11px;color:var(--text2);margin-bottom:12px">
          Pour accéder au soutien du Gotchi,<br>ajoute ta clé API dans les Réglages.
        </p>
        <button class="btn btn-p" onclick="clModal(); go('settings')" style="width:100%">
        Aller dans les Réglages ⚙️
        </button>
      </div>
    `;
    animEl(document.getElementById('mbox'), 'bounceIn');
    return;
  }

  // ✦ LIMITE 3 SESSIONS PAR JOUR
  if (D.lastSoutienDate !== td) {
    D.lastSoutienDate = td;
    D.soutienCount = 0;
  }
  if (D.soutienCount >= 3) {
    toast("Le Gotchi a besoin de se reposer… Reviens demain 🌙");
    return;
  }
  D.soutienCount++;
  save();

  const habsDuJour  = D.habits.map(h => ({ label:h.label, faite:(D.log[td]||[]).includes(h.catId) }));
  const notesDuJour = D.journal.filter(j => j.date.startsWith(td)).map(j => ({ humeur:j.mood, texte:j.text }));
  const ctx = window.AI_CONTEXTS;
  const P = window.PERSONALITY;
  const promptInit = ctx
  ? ctx.genSoutien
      .replace('{{nameGotchi}}',          D.g.name || P?.nom || 'Gotchi')
      .replace('{{userName}}',     D.g.userName || D.userName || 'toi')
      .replace('{{style}}',        P?.style || 'Phrases courtes, bienveillant.')
      .replace('{{traits}}',       P?.traits?.join(', ') || 'doux, curieux')
      .replace('{{heure}}',        new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
      .replace('{{date}}',         todayFr())
      .replace('{{energy}}',       `${D.g.energy}/5`)
      .replace('{{happiness}}',    `${D.g.happiness}/5`)
      .replace('{{habitsDone}}',   habsDuJour.filter(h=>h.faite).map(h=>h.label).join(', ') || 'aucune')
      .replace('{{habitsUndone}}', habsDuJour.filter(h=>!h.faite).map(h=>h.label).join(', ') || 'toutes faites !')
      .replace('{{notes}}',        notesDuJour.length ? notesDuJour.map(n=>`[${n.humeur}] ${n.texte}`).join(' | ') : 'aucune note')
  : `Tu es le Gotchi, compagnon bienveillant de ${D.g.userName || 'toi'}.\nIl est ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}, énergie ${D.g.energy}/5, humeur ${D.g.happiness}/5.\nCommence par une phrase qui montre que tu as lu son état. Pose UNE question ouverte. Ton doux, jamais de jugement.`;

window._soutienHistory = [];
  window._soutienCount = 0;
  modalLocked = true;
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <h3 style="font-size:13px;color:var(--lilac);">💜 Besoin de soutien</h3>
<button onclick="modalLocked=false;clModal()" style="background:none;border:none;font-size:16px;cursor:pointer;color:var(--text2)">✕</button>
    </div>
    <div class="soutien-chat" id="soutien-chat">
      <div class="soutien-chat" id="soutien-chat"></div>
    </div>
    <div style="display:flex;gap:6px;margin-top:8px">
      <input type="text" id="soutien-inp" class="inp" placeholder="Réponds ici..." style="font-size:11px"
        onkeydown="if(event.key==='Enter')sendSoutienMsg()">
      <button class="btn btn-p" onclick="sendSoutienMsg()" style="flex-shrink:0;padding:8px 12px">→</button>
    </div>
    <p id="soutien-count" style="font-size:9px;opacity:0.6;text-align:center;margin-top:4px">6 messages restants · session ${D.soutienCount}/3 aujourd'hui</p>
    <button id="btn-copier-soutien" class="btn btn-s" onclick="copierSoutien()" style="width:100%;font-size:10px;margin-top:6px">Copier la conversation</button>
`;
animEl(document.getElementById('mbox'), 'bounceIn');
  sendSoutienMsg(promptInit, true);
}

async function sendSoutienMsg(systemPrompt, isInit = false) {
  const key  = window.D.apiKey;
  const chat = document.getElementById('soutien-chat');

  /* ── Limite 6 messages par session ── */
  if (!isInit) {
    if (window._soutienCount >= 6) {
      chat.innerHTML += `<div class="chat-bubble-system">Tu as atteint la limite de 6 messages pour cette session. Prends soin de toi 💜</div>`;
      chat.scrollTop = chat.scrollHeight;
      document.getElementById('soutien-inp').disabled = true;
      document.querySelector('#mbox .btn-p').disabled  = true;
      return;
    }
    window._soutienCount++;
    const restants = 6 - window._soutienCount;
    const countEl  = document.getElementById('soutien-count');
    if (countEl) countEl.textContent = `${restants} message${restants > 1 ? 's' : ''} restant${restants > 1 ? 's' : ''} · conversation non sauvegardée`;
  }

  if (!key) { toast(`*chuchote* J'ai besoin de ma clé API dans les Réglages 🔑`); return; }

  /* ── Message utilisatrice ── */
  if (!isInit) {
    const inp      = document.getElementById('soutien-inp');
    const userText = inp ? inp.value.trim() : '';
    if (!userText) return;
    chat.innerHTML += `<div class="chat-bubble-user">${userText}</div>`;
    inp.value = '';
    window._soutienHistory.push({ role:'user', content:userText });
  }

  /* ── Animation de chargement ── */
  const bubbleId   = 'typing-' + Date.now();
  chat.innerHTML  += `<div class="chat-bubble-system" id="${bubbleId}">💭</div>`;
  const animSoutien = startThinkingAnim(bubbleId, window.D.g.name);
  chat.scrollTop   = chat.scrollHeight;

  /* ── Construction du contexte ── */
  const messages = isInit ? [{ role:'user', content:systemPrompt }] : [...window._soutienHistory.slice(-6)];

  const D  = window.D;
  const P  = window.PERSONALITY;
  const td = today();

  const notesJour = D.journal
    .filter(j => j.date.startsWith(td))
    .slice(-3)
    .map(j => `[${j.mood}] ${j.text}`)
    .join(' | ') || 'aucune note';

  const habsDone = (D.log[td] || [])
    .map(catId => { const h = D.habits.find(h => h.catId === catId); return h ? h.label : null; })
    .filter(Boolean)
    .join(', ') || 'aucune';

  const contexte = (window.AI_SYSTEM?.soutien_contexte || '')
    .replace('{{nameGotchi}}',              D.g.name || P?.nom || 'Gotchi')
    .replace('{{userName}}',         D.g.userName || D.userName || 'toi')
    .replace('{{style}}',            P?.style || 'Phrases courtes, bienveillant.')
    .replace('{{traits}}',           P?.traits?.join(', ') || 'doux, curieux')
    .replace('{{heure}}',            new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
    .replace('{{date}}',             td)
    .replace('{{energy}}',           D.g.energy)
    .replace('{{happiness}}',        D.g.happiness)
    .replace('{{habsDone}}',         habsDone)
    .replace('{{notes}}',            notesJour)
    .replace('{{messages_restants}}', 6 - window._soutienCount);

  const sysPrompt = (window.AI_SYSTEM?.soutien || '')
    .replace('{{nameGotchi}}',      D.g.name || P?.nom || 'Gotchi')
    .replace('{{userName}}', D.g.userName || D.userName || 'toi')
    .replace('{{style}}',    P?.style || 'Phrases courtes, bienveillant.')
    .replace('{{traits}}',   P?.traits?.join(', ') || 'doux, curieux')
    .concat(' ', contexte)
    .trim();

  /* ── Appel API ── */
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({ model:'claude-sonnet-4-5', max_tokens:500, system:sysPrompt, messages })
    });
    const d     = await r.json();
    const reply = d.content?.[0]?.text || 'Je suis là. 💜';

    stopThinkingAnim(animSoutien);
    document.getElementById(bubbleId)?.remove();
    chat.innerHTML += `<div class="chat-bubble-claude">${reply}</div>`;
    chat.scrollTop  = chat.scrollHeight;

    if (isInit) window._soutienHistory.push({ role:'user', content:systemPrompt });
    window._soutienHistory.push({ role:'assistant', content:reply });

  } catch(e) {
    stopThinkingAnim(animSoutien);
    document.getElementById(bubbleId)?.remove();
    chat.innerHTML += `<div class="chat-bubble-system">*soupir* Je n'arrive plus à te répondre... Vérifie ta clé API 💜</div>`;
    console.error('Erreur soutien IA :', e);
  }
}

function copierSoutien() {
  const chat = document.getElementById('soutien-chat');
  if (!chat) return;
  const D = window.D;
  const lignes = [];
  chat.querySelectorAll('.chat-bubble-user, .chat-bubble-claude').forEach(msg => {
    const auteur = msg.classList.contains('chat-bubble-user')
      ? (D.g.userName || D.userName || 'Toi')
      : (D.g.name || 'Gotchi');
    lignes.push(`${auteur} : ${msg.innerText.trim()}`);
  });
  if (!lignes.length) return;
  const texte = lignes.join('\n\n');
  const btn = document.getElementById('btn-copier-soutien');
  if (!navigator.clipboard) return; // fallback silencieux (contexte non sécurisé)
  navigator.clipboard.writeText(texte).then(() => {
    if (btn) { btn.textContent = '✓ Copié !'; setTimeout(() => btn.textContent = 'Copier la conversation', 2000); }
  }).catch(() => {});
}

/* ─── SYSTÈME 6 : INTROSPECTION & MÉMOIRE (Bilan IA) ─────────────── */

/* ============================================================
   API CLAUDE — BILAN SEMAINE
   ============================================================ */
let wOff = 0, mOff = 0;
function navW(d) {
  wOff += d;
  // Calcule le mois majoritaire de la semaine affichée
  const wd = getWkDates(wOff);
  const mois = wd.map(ds => new Date(ds + 'T12:00').getMonth());
  const majoritaire = mois.sort((a,b) =>
    mois.filter(m => m===b).length - mois.filter(m => m===a).length
  )[0];
  const annee = new Date(wd[3] + 'T12:00').getFullYear(); // mercredi = pivot fiable
  const now = new Date();
  mOff = (annee - now.getFullYear()) * 12 + (majoritaire - now.getMonth());
  renderProg();
}
function navM(d) { mOff += d; renderProg(); }

/* ── Utilitaire : identifiant semaine (ex: "2026-W15") ── */
function getWeekId() {
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const week = Math.ceil(((now - jan4) / 86400000 + jan4.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/* ── Reset du compteur si nouvelle semaine ── */
function checkBilanReset() {
  const currentWeek = getWeekId();
  if (window.D.g.bilanWeek !== currentWeek) {
    window.D.g.bilanWeek  = currentWeek;
    window.D.g.bilanCount = 0;
    save();
  }
}

async function genBilanSemaine() {
  const D = window.D, key = D.apiKey;
  const summaryEl = document.getElementById('claude-summary');
  const wd = getWkDates(wOff);
  const g = D.g, s = getSt(g.totalXp);
  const habitudes = D.habits.map(h => ({ habitude:h.label, jours_faits:wd.filter(d=>(D.log[d]||[]).includes(h.catId)).length, sur:7 }));
  const notes = D.journal.filter(j=>wd.includes(j.date.split('T')[0])).map(j=>({humeur:j.mood,texte:j.text,date:j.date.split('T')[0]}));
  const totalHabDays = wd.reduce((acc,d)=>acc+(D.log[d]||[]).length, 0);

  /* ── Vérification quota ── */
  checkBilanReset();
  if ((window.D.g.bilanCount || 0) >= 3) {
    summaryEl.textContent = 'Tu as déjà généré 3 bilans cette semaine 💜 Reviens vendredi prochain !';
    return;
  }

  /* ── Semaine en cours ou passée ? ── */
  const semaineEnCours  = wOff === 0;
  const jourSemaine     = new Date().getDay();
  let noteIA = '';
if (semaineEnCours) {
  if (jourSemaine === 5)      noteIA = 'Note : il reste encore 2 jours à cette semaine (samedi et dimanche). Génère un bilan d\'étape encourageant.';
  else if (jourSemaine === 6) noteIA = 'Note : il reste encore 1 jour à cette semaine (dimanche). Génère un bilan d\'étape encourageant.';
}

  /* ── Sans clé API ── */
  if (!key) {
    const lignes = habitudes.map(h=>`• ${h.habitude} : ${h.jours_faits}/7 jours`).join('\n');
    summaryEl.textContent = `Semaine du ${wd[0]} au ${wd[6]}\n\n${lignes}\n\n${notes.length} note(s) de journal.\n\nAjoute ta clé API pour un bilan personnalisé ✿`;
    document.getElementById('btn-copy-bilan').style.display = 'block';
    document.getElementById('bil-txt-hidden').value = summaryEl.textContent;
    window.D.g.bilanText = summaryEl.textContent;
    save();
    return;
  }

  const animBilan = startThinkingAnim('claude-summary', g.name);

  /* ── Construction du prompt ── */
  const ctx = window.AI_CONTEXTS;
  const prompt = ctx
    ? ctx.genBilanSemaine
        .replaceAll('{{nameGotchi}}',   g.name)
        .replaceAll('{{userName}}',     D.g.userName || D.userName || 'ton utilisatrice')
        .replace('{{weekStart}}',    wd[0])
        .replace('{{weekEnd}}',      wd[6])
        .replace('{{stage}}',        s.l)
        .replace('{{energy}}',       g.energy)
        .replace('{{happiness}}',    g.happiness)
        .replace('{{habitudes}}',    habitudes.map(h=>`- ${h.habitude} : ${h.jours_faits}/7 jours`).join('\n'))
        .replace('{{totalHabDays}}', totalHabDays)
        .replace('{{notesCount}}',   notes.length)
        .replace('{{notes}}',        notes.length ? notes.map(n=>`[${n.date}/${n.humeur}] ${n.texte}`).join('\n') : 'aucune note cette semaine')
        .replace('{{bilanNote}}',    noteIA)
    : `Tu es le Gotchi. Bilan semaine ${wd[0]}→${wd[6]} pour ${g.name} (${s.l}). Énergie ${g.energy}/5, Bonheur ${g.happiness}/5. ${totalHabDays} habitudes cochées. ${notes.length} notes. Bilan chaleureux en 3 paragraphes courts. Ton doux, pas de bullet points. ${noteIA}`;

/* ── Appel API ── */
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({ model:'claude-sonnet-4-5', max_tokens:500, messages:[{role:'user',content:prompt}] })
    });
    const d = await r.json();
    const bilan = (d.content?.[0]?.text || 'Je n\'ai pas pu générer le bilan.')
      .replaceAll('{{nameGotchi}}', g.name)
      .replaceAll('{{userName}}',   D.g.userName || D.userName || 'toi');

    stopThinkingAnim(animBilan);
    summaryEl.textContent = bilan;
    document.getElementById('bil-txt-hidden').value = bilan;
    document.getElementById('btn-copy-bilan').style.display = 'block';
    window.D.g.bilanCount = (window.D.g.bilanCount || 0) + 1;
    window.D.g.bilanText  = bilan;
    save();
    renderProg(); // rafraîchit l'état du bouton

  } catch(e) {
    stopThinkingAnim(animBilan);
    summaryEl.textContent = '❌ Une erreur est survenue, réessaie plus tard 💜';
    console.error('Erreur bilan IA :', e);
  }
}

function copyBilanSemaine() {
  const hid = document.getElementById('bil-txt-hidden'); if (!hid) return;
  navigator.clipboard.writeText(hid.value).then(() => {
    const b = document.getElementById('btn-copy-bilan');
    if (b) { b.textContent = '✓ Copié !'; setTimeout(() => b.textContent = '📋 Copier le bilan', 1500); }
  });
}
function resetBilan() {
  // On garde le compteur intact — juste le texte est effacé
  const el = document.getElementById('claude-summary');
  if (el) el.textContent = 'Ton bilan de la semaine apparaîtra ici...';
  document.getElementById('btn-copy-bilan').style.display = 'none';
  window.D.g.bilanText = '';
  save();
  renderProg();
  toast(_noOrphan('Bilan effacé 🌸'));
}

/* ─── SYSTÈME 5 : INVENTAIRE & PERSONNALISATION (Esthétique) ────── */

/* ============================================================
   PERSONNALISATION
   ============================================================ */
function renderPerso() {
  const D = window.D;
  const pg = document.getElementById('palette-grid');
  if (pg) {
    const current = D.g.uiPalette || 'lavande';
    pg.innerHTML = UI_PALETTES.map(p => `
      <div onclick="applyUIPalette('${p.id}')" style="padding:8px;border-radius:10px;cursor:pointer;text-align:center;border:3px solid ${current===p.id?p.lilac:'transparent'};background:${p.bg};transition:.2s;">
        <div style="display:flex;gap:4px;justify-content:center;margin-bottom:4px">
          <div style="width:14px;height:14px;border-radius:50%;background:${p.lilac}"></div>
          <div style="width:14px;height:14px;border-radius:50%;background:${p.mint}"></div>
          <div style="width:14px;height:14px;border-radius:50%;background:${p.pink}"></div>
        </div>
        <div style="font-size:9px;font-weight:bold;color:${p.text || '#38304a'}">${p.label}</div>
      </div>`).join('');
  }
  const gc = document.getElementById('gotchi-colors');
  if (gc) {
    const current = D.g.gotchiColor || 'vert';
    gc.innerHTML = GOTCHI_COLORS.map(c => `
  <div onclick="applyGotchiColor('${c.id}')" style="
    border-radius:10px;cursor:pointer;
    background:${c.body};
    border:3px solid ${current===c.id ? 'var(--lilac)' : 'transparent'};
    padding:6px 4px;
    display:flex;flex-direction:column;align-items:center;gap:3px;
    transition:.2s;box-shadow:0 2px 6px rgba(0,0,0,.1);">
    <div style="width:20px;height:20px;border-radius:50%;background:${c.bodyLt};border:2px solid ${c.bodyDk}"></div>
    <div style="font-size:8px;font-weight:bold;color:${c.bodyDk};text-align:center">${c.label}</div>
  </div>`).join('');
  }
  const et = document.getElementById('env-themes');
  if (et) {
    const current = D.g.envTheme || 'pastel';
et.innerHTML = ENV_THEMES.map(t => `
  <div onclick="applyEnvTheme('${t.id}')" style="
    padding:12px 8px;border-radius:10px;cursor:pointer;
    background:linear-gradient(135deg,${t.sky1},${t.gnd});
    border:3px solid ${current===t.id?'var(--lilac)':'transparent'};
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:4px;transition:.2s;">
    <div style="font-size:24px;line-height:1">${t.icon}</div>
    <div style="font-size:10px;font-weight:bold;color:#fff;text-align:center;text-shadow:0 1px 3px rgba(0,0,0,.4)">${t.label}</div>
  </div>`).join('');
  }
} // ← ferme renderPerso()

function applyUIPalette(id, silent = false) {
  const p = UI_PALETTES.find(x => x.id === id); if (!p) return;
  document.documentElement.style.setProperty('--bg',    p.bg);
  document.documentElement.style.setProperty('--lilac', p.lilac);
  document.documentElement.style.setProperty('--mint',  p.mint);
  document.documentElement.style.setProperty('--pink',  p.pink);
  document.documentElement.style.setProperty('--text',  p.text  || '#38304a');
  document.documentElement.style.setProperty('--text2', p.text2 || '#887ea0');
  document.documentElement.style.setProperty('--card',   p.card   || 'rgba(255,255,255,.88)');
document.documentElement.style.setProperty('--border', p.border || '#ccc4d8');
  window.D.g.uiPalette = id; save(); renderPerso();
  if (!silent) toast(`Palette ${p.label} appliquée ✿`);
}
function applyGotchiColor(id, silent = false) {
  const c = GOTCHI_COLORS.find(x => x.id === id); if (!c) return;
  window.D.g.gotchiColor = id; save(); renderPerso();
  if (!silent) toast(`Couleur ${c.label} appliquée ✿`);
}
function applyEnvTheme(id, silent = false) {
  const t = ENV_THEMES.find(x => x.id === id); if (!t) return;
  window.D.g.envTheme = id; save(); renderPerso();
  if (!silent) toast(`Ambiance ${t.label} appliquée ✿`);
}
function restorePerso() {
  if (window.D.g.uiPalette)   applyUIPalette(window.D.g.uiPalette, true);
  if (window.D.g.gotchiColor) applyGotchiColor(window.D.g.gotchiColor, true);
  if (window.D.g.envTheme)    applyEnvTheme(window.D.g.envTheme, true);
}

/* ─── SYSTÈME 6 : INTROSPECTION & MÉMOIRE (Le Journal Intime) ────── */

/* ============================================================
   PIN & JOURNAL
   ============================================================ */
let pinBuf = '', pinMode = 'check';

function renderPin() {
  const dots = document.getElementById('pin-dots'); if (!dots) return;
  dots.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const d = document.createElement('div');
    d.className = 'pin-dot' + (i < pinBuf.length ? ' f' : '');
    dots.appendChild(d);
  }
  const pad = document.getElementById('pin-pad');
  pad.innerHTML = '';
  for (let n = 1; n <= 9; n++) {
    const b = document.createElement('button');
    b.className = 'pin-k'; b.textContent = n;
    b.onclick = () => { pinBuf += n; renderPin(); if (pinBuf.length === 4) pinSubmit(); };
    pad.appendChild(b);
  }
  let bd = document.createElement('button'); bd.className = 'pin-k'; bd.textContent = '←';
  bd.onclick = () => { pinBuf = pinBuf.slice(0,-1); renderPin(); };
  pad.appendChild(bd);
  let b0 = document.createElement('button'); b0.className = 'pin-k'; b0.textContent = '0';
  b0.onclick = () => { pinBuf += '0'; renderPin(); if (pinBuf.length === 4) pinSubmit(); };
  pad.appendChild(b0);
  let bc = document.createElement('button'); bc.className = 'pin-k'; bc.textContent = '✕';
  bc.style.color = 'var(--coral)';
  bc.onclick = () => { pinBuf = ''; renderPin(); };
  pad.appendChild(bc);
}
function pinSubmit() {
  const msg = document.getElementById('pin-msg');
  if (pinMode === 'setup') { window.D.pin = pinBuf; save(); msg.textContent = 'PIN créé ✿'; setTimeout(unlockJ, 400); }
  else { if (pinBuf === window.D.pin) unlockJ(); else { msg.textContent = 'Incorrect.'; pinBuf = ''; renderPin(); } }
}
function unlockJ() {
  journalLocked = false;
  document.getElementById('pin-gate').style.display = 'none';
  document.getElementById('j-inner').style.display = 'block';
  renderJEntries();
}
function renderJ() {
  if (!journalLocked) { document.getElementById('pin-gate').style.display='none'; document.getElementById('j-inner').style.display='block'; renderJEntries(); return; }
  document.getElementById('j-inner').style.display = 'none';
  document.getElementById('pin-gate').style.display = 'block';
  pinBuf = '';
  if (!window.D.pin) { pinMode = 'setup'; document.getElementById('pin-msg').textContent = 'Choisis un code'; }
  else { pinMode = 'check'; document.getElementById('pin-msg').textContent = 'Entre ton code'; }
  renderPin();
}

const MOODS = [{id:'dur',e:'🌧️'},{id:'bof',e:'😔'},{id:'ok',e:'😐'},{id:'bien',e:'😊'},{id:'super',e:'🌟'}];
let selMood = null;

function initMoodPicker() {
  // Compteur de caractères du journal
const jText = document.getElementById('j-text');
const vStatus = document.getElementById('v-status');
if (jText && vStatus) {
  jText.addEventListener('input', () => {
    const len = jText.value.length;
    const max = window.JOURNAL_MAX_CHARS;
    const restant = max - len;
    vStatus.textContent = restant >= 0
      ? `${len}/${max} caractères`
      : `✂️ Trop long de ${Math.abs(restant)} caractères`;
    vStatus.style.color = restant < 30 ? '#e07060' : '#a09880';
  });
}
  const mp = document.getElementById('mood-pick');
  if (mp) mp.innerHTML = MOODS.map(m => `<button class="mood-b" data-m="${m.id}" onclick="pickM('${m.id}')">${m.e}</button>`).join('');
}
function pickM(id) {
  selMood = id;
  document.querySelectorAll('.mood-b').forEach(b => b.classList.toggle('sel', b.dataset.m === id));
}
function saveJ() {
  const t = document.getElementById('j-text').value.trim();
    // ── Garde : humeur obligatoire
  if (!selMood) {
    const mp = document.getElementById('mood-pick');
    if (mp) { mp.classList.add('mood-required'); setTimeout(() => mp.classList.remove('mood-required'), 800); }
    toast(_noOrphan('Choisis une humeur avant de sauvegarder ✿'));
    return;
  }

  // ── Garde : limite de caractères
  if (t.length > window.JOURNAL_MAX_CHARS) {
    toast(`✂️ Note trop longue (max ${window.JOURNAL_MAX_CHARS} caractères)`);
    return;
  }

  // ── Garde : limite quotidienne
  const todayStr = today(); // fonction existante dans app.js
  const notesAujourdHui = window.D.journal.filter(n => n.date.startsWith(todayStr));
  if (notesAujourdHui.length >= window.JOURNAL_MAX_PER_DAY) {
    toast(`📓 ${window.JOURNAL_MAX_PER_DAY} notes max par jour — reviens demain ✿`);
    return;
  }
  if (!selMood) {
    const mp = document.getElementById('mood-pick');
    if (mp) { mp.classList.add('mood-required'); setTimeout(() => mp.classList.remove('mood-required'), 800); }
    toast(_noOrphan('Choisis une humeur avant de sauvegarder ✿'));
    return;
  }
  window.D.journal.push({ date: new Date().toISOString(), mood: selMood, text: t });
  addXp(15);
  addEvent('note', 15, 'Note enregistrée  +15 XP');  // ← nouveau
  toast(`+15 XP 📓`);                                         // ← nouveau
  save();
  document.getElementById('j-text').value = '';
  selMood = null;
  document.querySelectorAll('.mood-b').forEach(b => b.classList.remove('sel'));
  renderJEntries();
  const srcJ = window.PERSONALITY ? window.PERSONALITY.bulles : MSG;
  const poolJ = srcJ.journal || ["Je t'écoute ✿"];
  const el = document.getElementById('bubble');
  if (el) {
    let bulle = poolJ[Math.floor(Math.random() * poolJ.length)];
    bulle = bulle.replace('{{diminutif}}', D.g.userNickname || D.userName || 'toi');
    el.textContent = bulle;
  }
}

let jWeekOff = 0;
function navJWeek(d) { jWeekOff += d; renderJEntries(); }
function getWkDates(off) {
  const t = new Date(); t.setDate(t.getDate() + off * 7);
  const day = (t.getDay() + 6) % 7, mon = new Date(t);
  mon.setDate(t.getDate() - day);
  const dates = [];
  for (let i = 0; i < 7; i++) { const d = new Date(mon); d.setDate(mon.getDate()+i); dates.push(d.toISOString().split('T')[0]); }
  return dates;
}
function renderJEntries() {
  const todayStr = today();
const countToday = window.D.journal.filter(n => n.date.startsWith(todayStr)).length;
const vStatus = document.getElementById('v-status');
if (vStatus && !document.getElementById('j-text').value) {
  const reste = window.JOURNAL_MAX_PER_DAY - countToday;
  vStatus.textContent = reste > 0
    ? `${countToday}/${window.JOURNAL_MAX_PER_DAY} notes aujourd'hui`
    : `Quota du jour atteint ✿ — à demain !`;
  vStatus.style.color = reste === 0 ? '#e07060' : '#a09880';
}
  const D = window.D;
  const wd = getWkDates(jWeekOff), wt = document.getElementById('j-week-title');
  if (jWeekOff === 0) { if (wt) wt.textContent = 'Cette semaine'; }
  else { const a=new Date(wd[0]),b=new Date(wd[6]); if(wt) wt.textContent=`${a.getDate()}/${a.getMonth()+1} — ${b.getDate()}/${b.getMonth()+1}`; }
  const entries = D.journal.filter(j=>wd.includes(j.date.split('T')[0])).reverse();
  const c = document.getElementById('j-entries');
  const me = {super:'🌟',bien:'😊',ok:'😐',bof:'😔',dur:'🌧️'};
  if (!c) return;
  if (!entries.length) { c.innerHTML = '<p style="font-size:11px;color:#a09880;text-align:center">Aucune entrée</p>'; return; }
  c.innerHTML = entries.map(e => {
    const d = new Date(e.date), gi = D.journal.indexOf(e);
    return `<div class="j-entry"><div style="display:flex;justify-content:space-between"><span class="j-date">${d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})} ${d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</span><span style="font-size:16px">${me[e.mood]||'😐'}</span></div><div style="font-size:11px;margin-top:3px">${e.text||'—'}</div><div class="j-actions"><button onclick="editJEntry(${gi})">✏️</button><button onclick="delJEntry(${gi})">🗑️</button></div></div>`;
  }).join('');
}
function editJEntry(i) {
  const e = window.D.journal[i]; if (!e) return;
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `
  <h3>Modifier</h3>
  <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-bottom:8px" id="edit-mood-pick">
    ${MOODS.map(m => `<button class="mood-b${e.mood===m.id?' sel':''}" data-m="${m.id}" onclick="this.parentNode.querySelectorAll('.mood-b').forEach(b=>b.classList.toggle('sel',b===this));window._editMood='${m.id}'">${m.e}</button>`).join('')}
  </div>
  <textarea id="edit-j-txt" class="inp" rows="5" style="font-size:12px">${e.text||''}</textarea>
  <div style="display:flex;gap:6px;margin-top:8px">
    <button class="btn btn-s" onclick="clModal()" style="flex:1">Annuler</button>
    <button class="btn btn-p" onclick="saveEditJ(${i})" style="flex:1">OK</button>
  </div>`;
window._editMood = e.mood;
  animEl(document.getElementById('mbox'), 'bounceIn');
}
function saveEditJ(i) {
  window.D.journal[i].text = document.getElementById('edit-j-txt').value.trim();
  if (window._editMood) window.D.journal[i].mood = window._editMood;
  window._editMood = null;
  save(); clModal(); renderJEntries();
}function delJEntry(i) {
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `<p>Supprimer ?</p><div style="display:flex;gap:6px;margin-top:10px"><button class="btn btn-s" onclick="clModal()" style="flex:1">Non</button><button class="btn btn-d" onclick="confirmDelJ(${i})" style="flex:1">Oui</button></div>`;
  animEl(document.getElementById('mbox'), 'bounceIn');
}
function confirmDelJ(i) { window.D.journal.splice(i, 1); save(); clModal(); renderJEntries(); updUI(); }

/* ─── SYSTÈME 6 : EXPORT JOURNAL ─────────────────────────────────── */
function exportJournal(mode) {
  const D = window.D;
  const me = { super: '🌟', bien: '😊', ok: '😐', bof: '😔', dur: '🌧️' };
  let entries, nomFichier;

  if (mode === 'semaine') {
    const wd = getWkDates(jWeekOff);
    entries = D.journal.filter(j => wd.includes(j.date.split('T')[0]));
    const a = new Date(wd[0]), b = new Date(wd[6]);
    nomFichier = `journal_${wd[0]}_${wd[6]}.txt`;
  } else {
    entries = [...D.journal];
    nomFichier = `journal_complet_${new Date().toISOString().split('T')[0]}.txt`;
  }

  if (!entries.length) {
    alert('Aucune entrée à exporter 🌿');
    return;
  }

  // Trier du plus ancien au plus récent
  entries.sort((a, b) => new Date(a.date) - new Date(b.date));

  const lignes = entries.map(e => {
    const d = new Date(e.date);
    const dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const heureStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const humeur = me[e.mood] || '—';
    return `${dateStr} à ${heureStr} ${humeur}\n${e.text || '—'}\n`;
  });

  const header = `Journal de ${D.g.userName || 'Habitgotchi'}\nExporté le ${new Date().toLocaleDateString('fr-FR')}\n${'─'.repeat(40)}\n\n`;
  const contenu = header + lignes.join('\n');

  // Téléchargement
  const blob = new Blob([contenu], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nomFichier;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── SYSTÈME 6 : INTROSPECTION & MÉMOIRE (Calendrier) ───────────── */

/* ============================================================
   PROGRESS
   ============================================================ */
/* Helper couleur — utilisé par hebdo ET mensuel */
function calColor(count, total, isToday) {
  const r   = total > 0 ? count / total : 0;

  // ── même dégradé que l'agenda/mois ──
  const g      = Math.round(180 + r * 60);
  const alpha  = r > 0 ? 0.15 + r * 0.6 : 0;
  let   bg     = r > 0 ? `rgba(80,${g},120,${alpha})` : 'rgba(0,0,0,0.03)';
  let   border = 'none';

  // Couronne lilac si 100%
  if (r >= 1) border = '2px solid var(--lilac)';
  // Contour lilac aujourd'hui même si vide
  if (isToday && count === 0) border = '2px solid var(--lilac)';

  return { bg, border };
}

function renderProg() {
  const D  = window.D;
  const wd = getWkDates(wOff);
  const wt = document.getElementById('w-title');
  if (!wt) return;

  /* ── Titre semaine ── */
  if (wOff === 0) {
    wt.textContent = 'Cette semaine';
  } else {
    const a = new Date(wd[0]), b = new Date(wd[6]);
    wt.textContent = `${a.getDate()}/${a.getMonth()+1} — ${b.getDate()}/${b.getMonth()+1}`;
  }

  /* ── Calendrier hebdomadaire ── */
  const total = D.habits.length || 6;

  document.getElementById('w-view').innerHTML = wd.map(ds => {
    const log   = D.log[ds] || [];
    const isT   = ds === today();
    const { bg, border } = calColor(log.length, total, isT);
    const day   = new Date(ds + 'T12:00').getDate();

    return `<div class="cal-c" style="background:${bg};border:${border};cursor:pointer" onclick="showDayDetail('${ds}')">${day}</div>`;
  }).join('');

  /* ── Calendrier mensuel ── */
  const now = new Date();
  now.setMonth(now.getMonth() + mOff);

  const y     = now.getFullYear();
  const m     = now.getMonth();
  const first = new Date(y, m, 1);
  const last  = new Date(y, m + 1, 0);
  const off   = (first.getDay() + 6) % 7; // décalage lundi = 0

  const moisLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
document.getElementById('m-title').textContent =
  moisLabel.charAt(0).toUpperCase() + moisLabel.slice(1);

  let cells = '';

  // Cases vides pour aligner le 1er jour
  for (let i = 0; i < off; i++) {
    cells += '<div class="cal-c cal-c-mini"></div>';
  }

  // Jours du mois
  for (let d = 1; d <= last.getDate(); d++) {
    const ds  = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const log = D.log[ds] || [];
    const isT = ds === today();
    const { bg, border } = calColor(log.length, total, isT);
    const weight = isT ? 'font-weight:bold;' : '';

    cells += `<div class="cal-c cal-c-mini" style="background:${bg};border:${border}"></div>`;
  }

  document.getElementById('m-view').innerHTML = cells;

    /* ── Titre bilan ── */
  const bilanTitre = document.getElementById('bilan-titre');
  if (bilanTitre) {
    const debut = new Date(wd[0] + 'T12:00');
    const fin   = new Date(wd[6] + 'T12:00');
    const fmt   = d => `${d.getDate()} ${d.toLocaleDateString('fr-FR', { month: 'short' })}`;
    const prenom = D.g.userName || D.userName || 'toi';
    bilanTitre.innerHTML = `🌼 Bilan pour ${prenom}<br><span style="font-size:9px;font-weight:normal;color:var(--text2)">semaine du ${fmt(debut)} au ${fmt(fin)}</span>`;
  }

  /* ── Restauration bilan persisté ── */
  const savedBilan = window.D.g.bilanText || '';
  const summaryRestore = document.getElementById('claude-summary');
  if (summaryRestore && savedBilan) {
    summaryRestore.textContent = savedBilan;
    const hidRestore = document.getElementById('bil-txt-hidden');
    if (hidRestore) hidRestore.value = savedBilan;
    document.getElementById('btn-copy-bilan').style.display = 'block';
  }

  /* ── État bouton bilan ── */
checkBilanReset();
const btnBilan  = document.querySelector('[onclick="genBilanSemaine()"]');
if (btnBilan) {
  const jourSemaine = new Date().getDay(); // 0=dim, 5=ven, 6=sam
  const estFinSemaine = wOff < 0 || jourSemaine === 0 || jourSemaine === 5 || jourSemaine === 6;
  const quotaOk = (window.D.g.bilanCount || 0) < 3;

  if (!estFinSemaine) {
    btnBilan.disabled = true;
    btnBilan.textContent = '⏳ Disponible vendredi';
    btnBilan.style.opacity = '0.5';
  } else if (!quotaOk) {
    btnBilan.disabled = true;
    btnBilan.textContent = '✓ 3 bilans générés cette semaine';
    btnBilan.style.opacity = '0.5';
  } else {
    btnBilan.disabled = false;
    btnBilan.textContent = `✿ Générer le bilan (${window.D.g.bilanCount}/3)`;
    btnBilan.style.opacity = '1';
  }
}

  updUI();
}

function showDayDetail(ds) {
  ouvrirAgenda(ds);
}

/* ─── SYSTÈME 7 : INGÉNIERIE (Paramètres et Sauvegardes) ─────────── */

/* ============================================================
   RÉGLAGES
   ============================================================ */
function saveName() {
  const n = document.getElementById('name-inp').value.trim();
  if (n) { window.D.g.name = n; save(); updUI(); }
}
function saveApi() {
  const v = document.getElementById('api-inp').value.trim();
  window.D.apiKey = v; save();
  if (v) toast(`Je me souviens de ta clé, promis 🔑 ✿`); else toast(`Clé oubliée... *soupir* ✿`);
}
function savePin() {
  const ancien = document.getElementById('pin-ancien').value.trim();
  const nouveau = document.getElementById('pin-inp').value.trim();

  if (!window.D.pin && nouveau.length === 4 && /^\d+$/.test(nouveau)) {
    // Cas : pas encore de PIN défini
    window.D.pin = nouveau; save();
    document.getElementById('pin-ancien').value = '';
    document.getElementById('pin-inp').value = '';
    toast('PIN créé ✿'); return;
  }

  if (ancien !== window.D.pin) { toast('Ancien PIN incorrect ✕'); return; }
  if (nouveau.length !== 4 || !/^\d+$/.test(nouveau)) { toast('4 chiffres requis'); return; }

  window.D.pin = nouveau; save();
  document.getElementById('pin-ancien').value = '';
  document.getElementById('pin-inp').value = '';
  toast('PIN mis à jour ✿');
}
function exportD() {
  const b = new Blob([JSON.stringify(window.D, null, 2)], {type:'application/json'});
  const u = URL.createObjectURL(b), a = document.createElement('a');
  a.href = u; a.download = `habitgotchi_${today()}.json`; a.click();
  URL.revokeObjectURL(u);
}
function importD(event) {
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      window.D = { ...defs(), ...imported, g:{ ...defs().g, ...imported.g } };
      save(); toast(`Bienvenue de retour ${window.D.g.name} ! ✿`);
      setTimeout(() => location.reload(), 800);
    } catch(err) { toast(`*perplexe* Ce fichier me semble bizarre... 💜`); }
  };
  reader.readAsText(file);
}

function confirmReset() {
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `<h3>Tout supprimer ?</h3><div style="display:flex;gap:6px;margin-top:10px"><button class="btn btn-s" onclick="clModal()" style="flex:1">Non</button><button class="btn btn-d" onclick="localStorage.removeItem('${SK}');location.reload()" style="flex:1">Oui</button></div>`;
animEl(document.getElementById('mbox'), 'bounceIn');
}

/* ─── SYSTÈME 6 : INTROSPECTION & MÉMOIRE (Le Terminal) ──────────── */

/* ============================================================
   TABLETTE RÉTRO
   ============================================================ */
let tabletLastSeenDate = null; // ISO date du dernier événement vu à la dernière ouverture

function openTablet() {
  const D = window.D;
  const log = D.eventLog || [];
  
  // Icône choisie selon le type + signe de la valeur (gain/perte XP)
  const getIcon = (ev) => {
  // Le subtype prime sur le type s'il existe
  if (ev.subtype === 'snack') return '🍽️';
  if (ev.subtype === 'poop')  return '💩';
  if (ev.subtype === 'stade') return '🌱';
  
  // Sinon, fallback sur le type
  if (ev.type === 'xp')       return (ev.valeur < 0) ? '💤' : '⭐';
  if (ev.type === 'cadeau') return ev.emoji || '🎁';
  if (ev.type === 'habitude') return '✅';
  if (ev.type === 'note')     return '📓';
  return '•';
};
  
  const lines = document.getElementById('tablet-lines');

  if (!log.length) {
    lines.innerHTML = '<div class="tablet-line" style="color:#007a1f">// aucun événement enregistré</div>';
  } else {
    lines.innerHTML = log.map(ev => {
      const d = new Date(ev.date);
      const heure = d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
      const jour  = d.toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
      return `<div class="tablet-line">
        <span class="tl-time">${jour} à ${heure}</span>
        <span class="tl-icon">${getIcon(ev)}</span>${ev.label || ev.valeur}
      </div>`;
    }).join('');
  }

  // Masquer le badge + mémoriser la date du plus récent événement
  tabletLastSeenDate = log.length ? log[0].date : null;
  document.getElementById('tablet-badge').style.display = 'none';

  document.getElementById('tablet-overlay').classList.add('open');
}

function closeTablet(e) {
  // Ferme seulement si on clique sur le fond, pas sur la tablette
  if (e.target === document.getElementById('tablet-overlay')) {
    document.getElementById('tablet-overlay').classList.remove('open');
  }
}

function updTabletBadge() {
  const log = (window.D?.eventLog || []);
  const badge = document.getElementById('tablet-badge');
  if (!badge) return;
  
  // Badge visible si un événement est plus récent que la dernière ouverture
  const plusRecent = log[0]?.date;
  if (plusRecent && plusRecent !== tabletLastSeenDate) {
    badge.style.display = 'block';
  }
}

/* ─── SYSTÈME 7 : INGÉNIERIE (Déclencheurs d'Ouverture / Cheats) ─── */

/* ============================================================
   MODALE DE BIENVENUE
   ============================================================ */
function checkWelcome() {
  const D  = window.D;
  const td = today();
  const h  = hr();

  // 1. Premier lancement — priorité absolue
  if (!D.firstLaunch || D.g.name === 'Petit·e Gotchi') {
    D.firstLaunch = D.firstLaunch || new Date().toISOString();
    save();
    showWelcomeModal();
    return;
  }

  // 2. Garde anti-répétition : une seule fois par créneau
  const créneau = h < 12 ? 'matin' : h < 18 ? 'aprem' : h < 21 ? 'soir' : 'nuit';
  const done = (D.log[td] || []).length;
  const etatActuel = `${td}-${créneau}-${done}`;
  if (D.lastWelcomeState === etatActuel) return;

  // 3. Calcul jours d'absence (avant de mettre à jour lastActive)
  let joursAbsence = 0;
  if (D.lastActive) {
    const diff = Date.now() - new Date(D.lastActive);
    joursAbsence = Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  // 4. Cadeaux-IA reçus depuis la dernière visite (achats boutique exclus)
  const derniereVisite = D.lastActive || td;
  const nouveauxCadeaux = (D.eventLog || []).filter(ev =>
    ev.type === 'cadeau' &&
    ev.subtype === 'ia' &&
    new Date(ev.date) > new Date(derniereVisite)
  ).length;

  // 5. Mise à jour de la session
  D.lastWelcomeState = etatActuel;
  D.lastActive = new Date().toISOString();
  save();

  // ❌ SUPPRIMÉ : ancien `if (!D.firstLaunch…)` dupliqué — code mort

  // 6. Contenu selon contexte
  let titre, corps, extra = '';

  // ✏️ UNIFIÉ : pénalité unique pour toute absence ≥ 1 jour (-15 XP × jours)
  if (joursAbsence >= 1) {
    const xpPerdu = joursAbsence * 15;
    addXp(-xpPerdu);
    addEvent('xp', -xpPerdu, `${joursAbsence} jour${joursAbsence > 1 ? 's' : ''} d'absence — -${xpPerdu} XP`);

    // Message doux pour 1 jour, plus marqué au-delà
    if (joursAbsence === 1) {
      titre = `Bienvenue 🌸`;
      corps = `Tu as perdu <strong>15 XP</strong> hier — pas d'habitudes cochées.`;
      flashBubble("Tu m'avais oubliée... 💜", 3000);
    } else {
      titre = `Ça fait ${joursAbsence} jours... 💜`;
      corps = `${D.g.name} t'a attendue. Tu as perdu <strong>${xpPerdu} XP</strong> pendant ton absence.`;
    }
  } else if (h >= 22 || h < 7) {
    titre = `*chuchote* 🌙`;
    corps = getNightMsg();
  } else if (h < 12) {
    titre = `Bon matin ☀️`;
    corps = getMorningMsg();
  } else if (h < 18) {
    titre = `Bon après-midi ✿`;
    corps = getAfternoonMsg();
  } else {
    titre = `Bonne soirée 🌙`;
    corps = getEveningMsg();
  }

  if (nouveauxCadeaux > 0) {
    extra = `<p style="margin-top:8px;font-size:12px;text-align:center">🎁 ${nouveauxCadeaux} nouveau${nouveauxCadeaux > 1 ? 'x cadeaux' : ' cadeau'} depuis ta dernière visite !</p>`;
  }

  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `
    <div style="text-align:center">
      <h3>${titre}</h3>
      <p style="font-size:12px;margin:8px 0">${corps}</p>
      ${extra}
      <button class="btn btn-p" style="width:100%;margin-top:10px" onclick="clModal()">C'est parti ✿</button>
    </div>
  `;
  animEl(document.getElementById('mbox'), 'bounceIn');
}

function getMorningMsg() {
  const D = window.D;
  const str = calcStr();
  const name = D.g.name;
  if (str >= 7) return `*s'étire* ${str} jours de suite... tu m'impressionnes 🔥`;
  if (str >= 3) return `${str} jours d'affilée ! On continue ? 💜`;
  return `Coucou ${D.g.userNickname || D.userName || 'toi'} ! Je t'attendais 🌸`;
}

function getAfternoonMsg() {
  const D = window.D;
  const done = (D.log[today()] || []).length;
  const name = D.g.name;
  if (done >= 4) return `${done} habitudes déjà ! Je suis fier·e de toi 🌟`;
  if (done >= 1) return `${done} cochée${done > 1 ? 's' : ''} — tu avances bien ✿`;
  return `*te regarde* Il reste encore du temps pour aujourd'hui 💜`;
}

function getEveningMsg() {
  const D = window.D;
  const done = (D.log[today()] || []).length;
  const ha = D.g.happiness;
  if (done === 6) return `6/6 !! Tu as tout fait aujourd'hui, je suis aux anges 🎉`;
  if (ha <= 2) return `*câlin pixel* Tu sembles fatiguée ce soir. Prends soin de toi 💜`;
  if (done === 0) return `*te regarde doucement* Pas d'habitudes aujourd'hui... c'est ok. Demain ✿`;
  return `${done}/6 aujourd'hui. Pose-toi maintenant 💜`;
}

function getNightMsg() {
  const D = window.D;
  const done = (D.log[today()] || []).length;
  if (done === 6) return `*ronronne* Journée parfaite... dors bien 🌙`;
  if (done >= 3) return `*bâille* Bonne nuit ${D.g.userNickname || D.userName || 'toi'}... à demain 💜`;
  return `*murmure* Je veille. Dors bien 🌙`;
}

function showWelcomeModal() {
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `
    <h3 style="text-align:center">Bienvenue ✿</h3>
    <p style="font-size:12px;text-align:center;margin:8px 0">Comment s'appelle ton compagnon ?</p>
    <input id="welcome-name" class="inp" placeholder="Petit·e Gotchi" maxlength="20" style="text-align:center" autocomplete="off">
    <button class="btn btn-p" style="width:100%;margin-top:10px" onclick="confirmWelcome()">C'est parti 🌟</button>
  `;
  animEl(document.getElementById('mbox'), 'bounceIn');
  setTimeout(() => document.getElementById('welcome-name')?.focus(), 100);
}

function confirmWelcome() {
  const val = document.getElementById('welcome-name')?.value.trim();
  if (val) window.D.g.name = val;
  save();
  updUI();
  clModal();
}

/**
 * Console Développeur cachée : "Cheat Codes" pour tester l'application
 */
function applyCheatCode() {
  const input = document.getElementById('cheat-input');
  if (!input) return;
  const code = input.value.trim().toLowerCase();
  input.value = '';

  const codes = {
    'petales50':  () => { D.g.petales = (D.g.petales || 0) + 50; toast('🌸 +50 pétales !'); },
    'petales200': () => { D.g.petales = (D.g.petales || 0) + 200; toast('🌸 +200 pétales !'); },
    'egg':        () => { D.g.totalXp = 0;   D.g.stage = 'egg';   toast('🥚 Stade → Œuf'); },
    'baby':       () => { D.g.totalXp = 90;  D.g.stage = 'baby';  toast('🌱 Stade → Pousse'); },
    'teen':       () => { D.g.totalXp = 240; D.g.stage = 'teen';  toast('🌿 Stade → Bouton'); },
    'adult':      () => { D.g.totalXp = 500; D.g.stage = 'adult'; toast('🌸 Stade → Fleur'); },
    'vent':       () => { window.meteoData = { windspeed: 50 }; toast('🌬️ Vent activé !'); },
    'calme':      () => { window.meteoData = { windspeed: 5 };  toast('☀️ Vent désactivé'); },
    'happy5':     () => { D.g.happiness = 5; toast('😊 Bonheur → 5'); },
    'happy1':     () => { D.g.happiness = 1; toast('😔 Bonheur → 1'); },
    'energy5':    () => { D.g.energy = 5;    toast('⚡ Énergie → 5'); },
    'reset3':     () => { D.thoughtCount = 0; toast('💭 Compteur pensées → 0'); },
    'caca3':    () => { D.g.poops = [...(D.g.poops || []), {x:80,y:120}, {x:110,y:130}, {x:140,y:115}]; toast('💩 +3 cacas !'); },
    'resetfood':() => { D.g.snackDone = ''; D.g.snackEmoji = ''; toast('🍎 Nourriture remise à zéro'); },
    'resetcaca':() => { D.g.poopCount = 0; D.g.poopDay = ''; D.g.poops = []; toast('💩 Quota caca remis à zéro'); },
    'nuit':   () => { window._forceHour = 23; toast('🌙 Heure forcée → 23h'); },
    'jour':   () => { window._forceHour = null; toast('☀️ Heure réelle restaurée'); },
    'resetpin': () => { D.pin = null; toast('🔓 Code PIN supprimé'); },
    'resetbilan':   () => { D.g.bilanCount = 0; D.g.bilanWeek = ''; toast('📊 Quota bilan → 0/3'); },
    'resetsoutien': () => { D.soutienCount = 0; D.lastSoutienDate = null; toast('💜 Quota soutien → 0/3'); },
    'resetmsg3':     () => { D.thoughtCount = 0; D.lastThoughtDate = null; toast('💬 Quota pensées → 0/3'); },
  };

  if (codes[code]) {
    codes[code]();
    save(); updUI();
  } else {
    toast('❓ Code inconnu');
  }
}

/* ============================================================
   MODALE AGENDA
   ============================================================ */

let _agendaJour = null; // date string "2025-04-24" du jour affiché

function ouvrirAgenda(dateStr) {
  _agendaJour = dateStr || today();

  const mbox = document.getElementById('mbox');
  const modal = document.getElementById('modal');

  // 1. Nettoie les classes d'un éventuel précédent affichage
  mbox.classList.remove('shop-open', 'shop-catalogue', 'agenda-open');

  // 2. Prépare le contenu
  mbox.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <h3 style="font-size:13px;color:var(--lilac)">🗓️ Mon Agenda</h3>
      <button onclick="fermerAgenda()" style="background:none;border:none;font-size:16px;cursor:pointer;color:var(--text2)">✕</button>
    </div>
    <div style="display:flex;gap:6px;margin-bottom:14px;background:rgba(0,0,0,0.05);border-radius:20px;padding:3px">
      <button onclick="switchAgenda('jour')" id="atab-jour"
        style="flex:1;padding:7px;border-radius:16px;border:none;font-size:10px;
        cursor:pointer;font-weight:bold;font-family:'Courier New',monospace;transition:.15s">
        📅 Jour
      </button>
      <button onclick="switchAgenda('mois')" id="atab-mois"
        style="flex:1;padding:7px;border-radius:16px;border:none;font-size:10px;
        cursor:pointer;font-weight:bold;font-family:'Courier New',monospace;transition:.15s">
        🗓️ Mois
      </button>
      <button onclick="switchAgenda('cycle')" id="atab-cycle"
        style="flex:1;padding:7px;border-radius:16px;border:none;font-size:10px;
        cursor:pointer;font-weight:bold;font-family:'Courier New',monospace;transition:.15s">
        🌸 Cycle
      </button>
    </div>
    <div id="agenda-contenu"></div>
  `;

  // 3. Force un reflow pour redéclencher l'animation shopOpen
  void mbox.offsetWidth;

  // 4. Applique les classes (anime + scroll interne)
  mbox.classList.add('shop-open', 'agenda-open');

// 5. Affiche la modale
lockScroll();
modal.style.display = 'flex';
animEl(mbox, 'bounceIn');
switchAgenda('jour');
}


function fermerAgenda() {
  document.getElementById('dynamic-zone').style.overflowY = '';
  clModal();
}

function chevron(dir) {
  // Points du chevron : "droite" pointe vers la droite (>), "gauche" pointe vers la gauche (<)
  const points = dir === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6';
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="var(--lilac)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
    style="display:block">
    <polyline points="${points}"/>
  </svg>`;
}

function switchAgenda(onglet) {
  ['jour','mois','cycle'].forEach(o => {
    const btn = document.getElementById('atab-' + o);
    if (!btn) return;
    btn.style.background  = o === onglet ? '#fff' : 'transparent';
    btn.style.color       = o === onglet ? 'var(--lilac)' : 'var(--text2)';
    btn.style.boxShadow   = o === onglet ? '0 1px 4px rgba(0,0,0,.1)' : 'none';
  });

  const el = document.getElementById('agenda-contenu');
  if (!el) return;
  if (onglet === 'jour')  renderAgendaJour(el);
  if (onglet === 'mois')  renderAgendaMois(el);
  if (onglet === 'cycle') renderAgendaCycle(el);
}

/* ─── PANNEAU 1 : JOUR ─────────────────────────────────────── */


function getRdvDuJour(ds) {
  return (window.D.rdv || []).filter(r => {
    // RDV simple ou sans récurrence
    if (!r.recurrence || r.recurrence === 'aucune') {
      return r.date === ds;
    }
    // RDV récurrent : ds doit être >= date de début
    if (ds < r.date) return false;
    // Vérifie la date de fin si elle existe
    if (r.duree && ds > r.duree) return false;

    const debut = new Date(r.date + 'T12:00');
    const cible = new Date(ds  + 'T12:00');

    if (r.recurrence === 'hebdo') {
      const diffJ = Math.round((cible - debut) / 86400000);
      return diffJ % 7 === 0;
    }
    if (r.recurrence === 'mensuelle') {
      return debut.getDate() === cible.getDate()
          && (cible.getFullYear() * 12 + cible.getMonth())
           > (debut.getFullYear()  * 12 + debut.getMonth() - 1);
    }
    if (r.recurrence === 'annuelle') {
      return debut.getDate()  === cible.getDate()
          && debut.getMonth() === cible.getMonth()
          && cible.getFullYear() >= debut.getFullYear();
    }
    return false;
  });
}

function renderAgendaJour(el) {
  const D     = window.D;
  const ds    = _agendaJour;
  const date  = new Date(ds + 'T12:00');
  const jours = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  const mois  = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  const titre = `${jours[date.getDay()]} ${date.getDate()} ${mois[date.getMonth()]} ${date.getFullYear()}`;

  // Phase cycle
  const phase = getCyclePhase(ds);
  const phaseHtml = phase
    ? `<div style="display:inline-block;padding:4px 10px;border-radius:20px;font-size:10px;
        font-weight:bold;background:${phase.couleur}22;color:${phase.couleur};
        border:1px solid ${phase.couleur}55;margin-bottom:16px">
        ${phase.label} · J${phase.j}
       </div>`
    : '';

  // Habitudes
  const log = D.log[ds] || [];
  const habsHtml = log.length
    ? log.map(catId => {
        const hab = D.habits.find(h => h.catId === catId);
        return hab
          ? `<div style="padding:8px 10px;border-radius:8px;font-size:11px;
              background:rgba(255,255,255,0.7);border:1px solid var(--border);
              margin-bottom:5px">✅ ${hab.label}</div>`
          : '';
      }).join('')
    : `<div style="font-size:11px;color:var(--text2);font-style:italic;padding:6px 0">Aucune habitude ce jour</div>`;

  // Note journal
  const note = (D.journal || []).find(n => n.date && n.date.startsWith(ds));
  const noteHtml = note
    ? `<button onclick="ouvrirJournalAuJour('${ds}')"
        style="width:100%;text-align:left;padding:10px 12px;border-radius:10px;
        border:1.5px solid var(--lilac);background:rgba(var(--lilac-rgb, 180,160,230),0.07);
        font-size:11px;cursor:pointer;color:var(--lilac);font-family:'Courier New',monospace;
        display:flex;align-items:center;justify-content:space-between">
        <span>📓 Voir la note du journal</span>
        <span style="opacity:.6">→</span>
       </button>`
    : `<div style="font-size:11px;color:var(--text2);font-style:italic;padding:6px 0">Aucune note ce jour</div>`;

  // Rendez-vous
  const rdvDuJour = getRdvDuJour(ds).sort((a,b) => (a.heure||'') > (b.heure||'') ? 1 : -1);
  const rdvHtml = rdvDuJour.map(r => `
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding:8px 10px;border-radius:8px;background:#fff;
      border:1px solid var(--border);margin-bottom:5px">
      <span style="font-size:11px">${r.heure ? `<b>${r.heure}</b> · ` : '🗓️ Journée entière · '}${r.label}</span>
      <div style="display:flex;gap:6px">
        <button onclick="editerRdv('${r.id}')" style="background:none;border:none;cursor:pointer;font-size:13px">✏️</button>
        <button onclick="confirmerSuppressionRdv('${r.id}')" style="background:none;border:none;cursor:pointer;font-size:13px">🗑️</button>
      </div>
    </div>`).join('');

  el.innerHTML = `
    <!-- Navigation date -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <button onclick="navAgendaJour(-1)"
        style="background:none;border:none;cursor:pointer;padding:4px;display:flex;align-items:center">
        ${chevron('left')}
      </button>
      <span style="font-size:12px;font-weight:bold;font-family:'Courier New',monospace;
        text-align:center;color:var(--lilac);flex:1">
        ${titre}
      </span>
      <button onclick="navAgendaJour(1)"
        style="background:none;border:none;cursor:pointer;padding:4px;display:flex;align-items:center">
        ${chevron('right')}
      </button>
    </div>

    ${phaseHtml}

    <!-- Habitudes -->
    <div style="margin-bottom:20px">
      <h3 style="font-size:10px;color:var(--text2);letter-spacing:1.5px;margin-bottom:8px;text-transform:uppercase">Habitudes</h3>
      ${habsHtml}
    </div>

    <!-- Note journal -->
    <div style="margin-bottom:20px">
      <h3 style="font-size:10px;color:var(--text2);letter-spacing:1.5px;margin-bottom:8px;text-transform:uppercase">Journal</h3>
      ${noteHtml}
    </div>

    <!-- Rendez-vous -->
    <div style="margin-bottom:12px">
      <h3 style="font-size:10px;color:var(--text2);letter-spacing:1.5px;margin-bottom:8px;text-transform:uppercase">Rendez-vous</h3>
      ${rdvHtml}
      <button onclick="afficherFormulaireRdv()" id="btn-add-rdv"
        style="width:100%;padding:9px;border-radius:10px;
        border:1.5px solid var(--lilac);background:transparent;
        font-size:11px;cursor:pointer;color:var(--lilac);
        font-family:'Courier New',monospace;margin-top:4px;
        opacity:0.75;transition:opacity .15s"
        onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='.75'">
        + Ajouter un rendez-vous
      </button>
      <div id="form-rdv" style="display:none"></div>
    </div>
  `;
}

function navAgendaJour(dir) {
  const d = new Date(_agendaJour + 'T12:00');
  d.setDate(d.getDate() + dir);
  _agendaJour = d.toISOString().split('T')[0];
  const el = document.getElementById('agenda-contenu');
  renderAgendaJour(el);
}

function afficherFormulaireRdv() {
  document.getElementById('btn-add-rdv').style.display = 'none';

  const overlay = document.createElement('div');
  overlay.id = 'rdv-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:1000;
    background:rgba(0,0,0,0.35);
    display:flex;align-items:flex-end;justify-content:center;
  `;

  const emojis = [
    {e:'🩺',l:'Médecin'}, {e:'🦷',l:'Dentiste'}, {e:'👁️',l:'Ophtalmo'},
    {e:'💆',l:'Kiné'}, {e:'🧠',l:'Psy'}, {e:'🩸',l:'Analyse'},
    {e:'💉',l:'Vaccin'}, {e:'🤰',l:'Gynéco'}, {e:'🐾',l:'Véto'},
    {e:'🎂',l:'Anniversaire'}, {e:'🎬',l:'Cinéma'}, {e:'🍽️',l:'Restaurant'},
    {e:'✈️',l:'Voyage'}, {e:'📋',l:'Admin'}, {e:'🏃',l:'Sport'},
    {e:'💛',l:'Perso'}, {e:'🎉',l:'Fête'}, {e:'📚',l:'Formation'}
  ];

  overlay.innerHTML = `
    <div id="rdv-sheet" style="
      background:var(--bg,#fff);border-radius:16px 16px 0 0;
      padding:20px 16px 32px;width:100%;max-width:420px;
      animation:slideUp .25s ease-out;
    ">
      <div style="width:36px;height:4px;background:var(--border);
        border-radius:2px;margin:0 auto 16px;opacity:.5"></div>
      <h3 style="font-size:12px;color:var(--lilac);margin-bottom:14px;
        font-family:'Courier New',monospace">📅 Nouveau rendez-vous</h3>

      <!-- Emojis sur 2 lignes -->
      <div style="display:grid;grid-template-columns:repeat(9,1fr);gap:5px;margin-bottom:12px">
        ${emojis.map(({e,l}) => `
          <button onclick="selectionnerEmoji('${e}', this)"
            title="${l}"
            style="aspect-ratio:1;border-radius:8px;border:1.5px solid var(--border);
            background:#fff;font-size:15px;cursor:pointer;transition:.15s;
            display:flex;align-items:center;justify-content:center"
            data-emoji="${e}">${e}</button>
        `).join('')}
      </div>

      <!-- Label -->
      <input id="rdv-label" class="inp" placeholder="Libellé du rendez-vous..." style="margin-bottom:8px">

      <!-- Heure -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <input type="time" id="rdv-heure" class="inp" style="flex:1">
        <label style="display:flex;align-items:center;gap:4px;font-size:10px;
          color:var(--text2);white-space:nowrap;cursor:pointer">
          <input type="checkbox" id="rdv-journee" onchange="toggleJourneeEntiere(this.checked)">
          Journée entière
        </label>
      </div>

<!-- Récurrence -->
<div style="margin-bottom:8px">
  <div style="font-size:10px;color:var(--text2);letter-spacing:1px;
    text-transform:uppercase;margin-bottom:6px">Récurrence</div>
  <div style="display:flex;gap:6px">
    ${[
      {v:'aucune',    l:'1×'},
      {v:'hebdo',     l:'🔁 Hebdo'},
      {v:'mensuelle', l:'🔁 Mensuel'},
      {v:'annuelle',  l:'🔁 Annuel'}
    ].map(r => `
      <button onclick="selectionnerRecurrence('${r.v}', this)"
        data-rec="${r.v}"
        style="flex:1;padding:7px;border-radius:8px;font-size:10px;
        font-family:'Courier New',monospace;cursor:pointer;transition:.15s;
        border:1.5px solid var(--border);background:#fff;color:var(--text2)">
        ${r.l}
      </button>
    `).join('')}
  </div>
</div>

      <!-- Durée (masquée si aucune récurrence) -->
      <div id="rdv-duree-wrap" style="display:none;margin-bottom:14px">
        <div style="font-size:10px;color:var(--text2);letter-spacing:1px;
          text-transform:uppercase;margin-bottom:6px">Pendant</div>
        <div style="display:flex;gap:6px">
          ${[
{e:'Sans fin', v:'infini'},
{e:'3 mois',  v:'3'},
{e:'6 mois',  v:'6'},
{e:'1 an',    v:'12'},
{e:'2 ans',   v:'24'}
          ].map(d => `
            <button onclick="selectionnerDuree('${d.v}', this)"
              data-duree="${d.v}"
              style="flex:1;padding:7px;border-radius:8px;font-size:10px;
              font-family:'Courier New',monospace;cursor:pointer;transition:.15s;
              border:1.5px solid var(--border);background:#fff;color:var(--text2)">
              ${d.l}
            </button>
          `).join('')}
        </div>
      </div>

      <div style="display:flex;gap:8px">
        <button class="btn btn-s" onclick="annulerFormulaireRdv()" style="flex:1">Annuler</button>
        <button class="btn btn-p" onclick="sauvegarderRdv()" style="flex:1">Enregistrer</button>
      </div>
    </div>
  `;

  overlay.addEventListener('click', e => {
    if (e.target === overlay) annulerFormulaireRdv();
  });

  document.body.appendChild(overlay);
  selectionnerRecurrence('aucune', overlay.querySelector('[data-rec="aucune"]'));
}

function selectionnerEmoji(e, btn) {
  // Désélectionne tous
  document.querySelectorAll('#rdv-sheet [data-emoji]').forEach(b => {
    b.style.background = '#fff';
    b.style.borderColor = 'var(--border)';
  });
  // Sélectionne celui cliqué
  btn.style.background = 'var(--lilac)22';
  btn.style.borderColor = 'var(--lilac)';
  window._rdvEmoji = e;
}

function selectionnerRecurrence(r, btn) {
  document.querySelectorAll('#rdv-sheet [data-rec]').forEach(b => {
    b.style.background   = '#fff';
    b.style.borderColor  = 'var(--border)';
    b.style.color        = 'var(--text2)';
  });
  btn.style.background  = 'var(--lilac)22';
  btn.style.borderColor = 'var(--lilac)';
  btn.style.color       = 'var(--lilac)';
  window._rdvRecurrence = r;

  // Affiche/masque le sélecteur de durée
  const dureeWrap = document.getElementById('rdv-duree-wrap');
  if (dureeWrap) {
    dureeWrap.style.display = r === 'aucune' ? 'none' : 'block';
    // Sélectionne 6 mois par défaut
    if (r !== 'aucune' && !window._rdvDuree) {
      const btnSansFin = dureeWrap.querySelector('[data-duree="infini"]');
if (btnSansFin) selectionnerDuree('infini', btnSansFin);
if (btnSansFin) selectionnerDuree('null', btnSansFin);
    }
  }
}

function selectionnerDuree(v, btn) {
  document.querySelectorAll('#rdv-sheet [data-duree]').forEach(b => {
    b.style.background  = '#fff';
    b.style.borderColor = 'var(--border)';
    b.style.color       = 'var(--text2)';
  });
  btn.style.background  = 'var(--lilac)22';
  btn.style.borderColor = 'var(--lilac)';
  btn.style.color       = 'var(--lilac)';
  window._rdvDuree = v; // 'infini', '3', '6', '12', '24' — juste la string
}

function annulerFormulaireRdv() {
  document.getElementById('rdv-overlay')?.remove();
  const btn = document.getElementById('btn-add-rdv');
  if (btn) btn.style.display = 'block';
}

function sauvegarderRdv() {
  const label      = document.getElementById('rdv-label').value.trim();
  if (!label) return;
  const heure      = document.getElementById('rdv-heure').value || null;
  const emoji      = window._rdvEmoji || null;
  const recurrence = window._rdvRecurrence || 'aucune';
  const dureeBrute = window._rdvDuree;
let duree = null;
if (dureeBrute && dureeBrute !== 'infini') {
  const fin = new Date(_agendaJour + 'T12:00');
  fin.setMonth(fin.getMonth() + parseInt(dureeBrute));
  duree = fin.toISOString().split('T')[0];
}
  const labelFinal = emoji ? `${emoji} ${label}` : label;

  window.D.rdv = window.D.rdv || [];
  window.D.rdv.push({
    id: Date.now().toString(),
    date: _agendaJour,
    label: labelFinal,
    heure,
    recurrence,
    duree // null = infini
  });

  window._rdvEmoji      = null;
  window._rdvRecurrence = 'aucune';
  window._rdvDuree      = null;

  save();
  annulerFormulaireRdv();
  renderAgendaJour(document.getElementById('agenda-contenu'));
}

function toggleJourneeEntiere(checked) {
  const heureInput = document.getElementById('rdv-heure');
  if (!heureInput) return;
  heureInput.disabled = checked;
  heureInput.style.opacity = checked ? '0.4' : '1';
  if (checked) heureInput.value = '';
}

function confirmerSuppressionRdv(id) {
  const el  = document.getElementById('agenda-contenu');
  const rdv = (window.D.rdv || []).find(r => r.id === id);
  if (!rdv) return;

  // AVANT : !!rdv.groupId
  // APRÈS : on détecte la récurrence directement
  const isRecurrent = rdv.recurrence && rdv.recurrence !== 'aucune';

  el.insertAdjacentHTML('afterbegin', `
    <div id="confirm-inline" style="position:sticky;top:0;z-index:10;
      background:#fff;border:2px solid var(--coral);border-radius:10px;
      padding:10px;margin-bottom:10px;text-align:center">
      <div style="font-size:11px;margin-bottom:8px">
        Supprimer <b>${rdv.label}</b> ?
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-s" onclick="fermerConfirmInline()" style="flex:1">Annuler</button>
        <button class="btn btn-d" onclick="supprimerRdv('${id}');fermerConfirmInline()" style="flex:1">
          ${isRecurrent ? 'Ce rendez-vous' : 'Supprimer'}
        </button>
        ${isRecurrent ? `
        <button class="btn btn-d" onclick="supprimerRdvSuivants('${id}');fermerConfirmInline()" style="flex:1;white-space:nowrap">
          Celui-ci et les suivants
        </button>` : ''}
      </div>
    </div>`);
}

function supprimerRdvSuivants(id) {
  const idx = (window.D.rdv || []).findIndex(r => r.id === id);
  if (idx === -1) return;
  // La date de fin = la veille du jour affiché
  const veille = new Date(_agendaJour + 'T12:00');
  veille.setDate(veille.getDate() - 1);
  window.D.rdv[idx].duree = veille.toISOString().split('T')[0];
  save();
  renderAgendaJour(document.getElementById('agenda-contenu'));
}

function confirmerSuppressionCycle(ds) {
  // 🔒 Ferme une éventuelle confirmation déjà ouverte
  document.getElementById('confirm-inline')?.remove();

  const el = document.getElementById('agenda-contenu');
  const date = new Date(ds + 'T12:00');
  const fmt  = date.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
  el.insertAdjacentHTML('afterbegin', `
    <div id="confirm-inline" style="position:sticky;top:0;z-index:10;
      background:#fff;border:2px solid var(--coral);border-radius:10px;
      padding:10px;margin-bottom:10px;text-align:center">
      <div style="font-size:11px;margin-bottom:8px">
        Supprimer le cycle du <b>${fmt}</b> ?
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-s" onclick="fermerConfirmInline()" style="flex:1">Annuler</button>
        <button class="btn btn-d" onclick="supprimerCycle('${ds}');fermerConfirmInline()" style="flex:1">Supprimer</button>
      </div>
    </div>`);
}

function fermerConfirmInline() {
  document.getElementById('confirm-inline')?.remove();
}

function editerRdv(id) {
  const rdv = (window.D.rdv || []).find(r => r.id === id);
  if (!rdv) return;
  document.getElementById('form-rdv').style.display = 'block';
  document.getElementById('btn-add-rdv').style.display = 'none';
  document.getElementById('rdv-label').value = rdv.label;
  document.getElementById('rdv-heure').value = rdv.heure || '';
  // Remplace sauvegarderRdv temporairement pour édition
  window._editRdvId = id;
  document.querySelector('[onclick="sauvegarderRdv()"]').setAttribute('onclick', 'sauvegarderRdvEdit()');
}

function sauvegarderRdvEdit() {
  const label = document.getElementById('rdv-label').value.trim();
  if (!label) return;
  const heure = document.getElementById('rdv-heure').value || null;
  const idx = (window.D.rdv || []).findIndex(r => r.id === window._editRdvId);
  if (idx !== -1) { window.D.rdv[idx].label = label; window.D.rdv[idx].heure = heure; }
  save();
  document.querySelector('[onclick="sauvegarderRdvEdit()"]').setAttribute('onclick', 'sauvegarderRdv()');
  window._editRdvId = null;
  annulerFormulaireRdv();
  renderAgendaJour(document.getElementById('agenda-contenu'));
}

function declarerRegles(ds) {
  const D = window.D;
  // Évite les doublons sur le même jour
  const existe = (D.cycle || []).find(e => e.date === ds && e.type === 'regles');
  if (existe) { toast('Déjà enregistré pour ce jour 🩸'); return; }
  D.cycle = D.cycle || [];
  D.cycle.push({ date: ds, type: 'regles' });
  D.cycle.sort((a,b) => a.date > b.date ? -1 : 1);
  save();
  toast('Début de cycle enregistré 🩸');
  renderAgendaJour(document.getElementById('agenda-contenu'));
}

function ouvrirJournalAuJour(ds) {
  fermerAgenda();
  const cible      = new Date(ds + 'T12:00');
  const maintenant = new Date(today() + 'T12:00');
  const diffJours  = Math.round((cible - maintenant) / 86400000);
  window._journalWOff = Math.trunc(diffJours / 7);
  document.getElementById('menu-overlay')?.classList.remove('open');
  go('journal'); // ← go() directement, sans toggleMenu
}

/* ─── PANNEAU 2 : MOIS ─────────────────────────────────────── */

let _agendaMoisOffset = 0; // 0 = mois actuel, -1 = mois précédent...

function renderAgendaMois(el) {
  const D      = window.D;
  const now    = new Date();
  const annee  = new Date(now.getFullYear(), now.getMonth() + _agendaMoisOffset, 1);
  const moisNom = annee.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  // Premier jour du mois et nb de jours
  const premierJour = new Date(annee.getFullYear(), annee.getMonth(), 1);
  const nbJours     = new Date(annee.getFullYear(), annee.getMonth() + 1, 0).getDate();

  // Décalage lundi=0
  let depart = premierJour.getDay() - 1;
  if (depart < 0) depart = 6;

  // Précalcul des données du mois
  const cycleEntries = D.cycle || [];
  const rdvEntries   = D.rdv   || [];
  const duree        = D.g.cycleDuree || 28;

  // Trouve tous les J1 pour calculer ovulation + prédiction
  const j1Dates = cycleEntries
    .filter(e => e.type === 'regles')
    .map(e => e.date)
    .sort().reverse();

  // Génère les cellules
  let cells = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-top:8px">';

  // En-têtes
  ['L','M','M','J','V','S','D'].forEach(j => {
    cells += `<div style="text-align:center;font-size:9px;color:var(--text2);padding:2px 0">${j}</div>`;
  });

  // Cases vides avant le 1er
  for (let i = 0; i < depart; i++) {
    cells += '<div></div>';
  }

  for (let d = 1; d <= nbJours; d++) {
    const ds      = `${annee.getFullYear()}-${String(annee.getMonth()+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const estAujourd = ds === today();
    const log     = D.log[ds] || [];
    const total   = D.habits.length;
    const pct     = total > 0 ? log.length / total : 0;

    // Couleur habitudes : transparent → vert
    const g       = Math.round(180 + pct * 60);
    const alpha   = pct > 0 ? 0.15 + pct * 0.6 : 0;
    const bgColor = pct > 0 ? `rgba(80,${g},120,${alpha})` : 'rgba(0,0,0,0.03)';

    // Indicateurs cycle
    const estJ1      = j1Dates.includes(ds);
    let   estOvul    = false;
    let   estPredic  = false;

    j1Dates.forEach(j1 => {
      const diff = Math.round((new Date(ds+'T12:00') - new Date(j1+'T12:00')) / 86400000);
      if (diff >= 12 && diff <= 16) estOvul   = true;
      if (diff >= 25 && diff <= 30) estPredic = true;
    });
    // Prédiction depuis le dernier J1 connu
    if (j1Dates.length) {
      const diff = Math.round((new Date(ds+'T12:00') - new Date(j1Dates[0]+'T12:00')) / 86400000);
      if (diff >= 25 && diff <= 30) estPredic = true;
    }

    // Icônes
    const aRdv  = rdvEntries.some(r => r.date === ds);
    const aNote = (D.journal || []).some(n => n.date && n.date.startsWith(ds));

    // Bordure aujourd'hui
    const border = estAujourd ? '2px solid var(--lilac)' : '1px solid transparent';

    cells += `
  <div onclick="clickJourMois('${ds}')"
    style="position:relative;aspect-ratio:1;border-radius:6px;cursor:pointer;
    background:${bgColor};border:${border};
    display:flex;flex-direction:column;align-items:center;
    justify-content:space-between;padding:2px 1px">

    ${estOvul ? `<div style="position:absolute;inset:1px;border-radius:5px;
      border:2px solid #80b8e066;pointer-events:none"></div>` : ''}
    ${estJ1 ? `<div style="position:absolute;top:2px;right:2px;width:6px;height:6px;
      border-radius:50%;background:#e07080"></div>` : ''}
    ${estPredic && !estJ1 ? `<div style="position:absolute;inset:1px;border-radius:5px;
      border:2px dashed #e0708066;pointer-events:none"></div>` : ''}

    <span style="font-size:10px;font-weight:${estAujourd?'bold':'normal'};
      color:${estAujourd?'var(--lilac)':'var(--text)'};margin-top:2px">${d}</span>

    <div style="display:flex;gap:1px;font-size:8px;line-height:1;margin-bottom:1px">
      ${aRdv  ? '📌' : ''}
      ${aNote ? '📓' : ''}
    </div>
  </div>`;
  }

  cells += '</div>';

  el.innerHTML = `
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
  <button onclick="navAgendaMois(-1)"
    style="background:none;border:none;cursor:pointer;padding:4px;display:flex;align-items:center">
    ${chevron('left')}
  </button>
  <span style="font-size:12px;font-weight:bold;font-family:'Courier New',monospace;
    text-transform:capitalize;text-align:center;flex:1">
    ${moisNom}
  </span>
  <button onclick="navAgendaMois(1)"
    style="background:none;border:none;cursor:pointer;padding:4px;display:flex;align-items:center">
    ${chevron('right')}
  </button>
</div>

<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;
  align-items:center;justify-content:center">
  <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--text2)">
    <span style="display:inline-block;width:16px;height:10px;border-radius:3px;
      background:linear-gradient(to right,rgba(80,180,120,0.1),rgba(80,180,120,0.9))"></span>
    Habitudes
  </span>
  <span style="font-size:11px;color:#e07080">● Règles</span>
  <span style="font-size:11px;color:#80b8e0">◻ Ovulation</span>
  <span style="font-size:11px;color:#e07080">⬚ Prédiction</span>
  <span style="font-size:11px;color:var(--text2)">📌 Rdv &nbsp; 📓 Note</span>
</div>

    ${cells}
  `;
}

function navAgendaMois(dir) {
  _agendaMoisOffset += dir;
  renderAgendaMois(document.getElementById('agenda-contenu'));
}

function clickJourMois(ds) {
  _agendaJour = ds;
  switchAgenda('jour');
}

/* ─── PANNEAU 3 : CYCLE ─────────────────────────────────────── */

function renderAgendaCycle(el) {
  const D = window.D;
  const cycles = (D.cycle || [])
    .filter(e => e.type === 'regles')
    .map(e => e.date)
    .sort().reverse();

  const duree = cycles.length >= 2
    ? Math.round((new Date(cycles[0]+'T12:00') - new Date(cycles[1]+'T12:00')) / 86400000)
    : (D.g.cycleDuree || 28);

  // Phase actuelle
  const phaseAujourd = getCyclePhase(today());

  // Descriptions des phases
  const descriptions = {
    menstruelle:  'Le corps se renouvelle. Énergie souvent basse, besoin de repos et de douceur.',
    folliculaire: 'Énergie en hausse, clarté mentale. Bon moment pour démarrer de nouveaux projets.',
    ovulation:    'Pic d\'énergie et de sociabilité. Concentration et communication facilitées.',
    lutéale:      'Retour vers l\'intérieur. Possible fatigue ou sensibilité émotionnelle en fin de phase.'
  };

// Frise des phases
const phases = [
  { id: 'menstruelle',  label: 'Règles',      labelShort: 'Règles', jours: '1–5',   pct: 5/duree,  couleur: '#e07080' },
  { id: 'folliculaire', label: 'Folliculaire', labelShort: 'Follic.', jours: '6–13',  pct: 8/duree,  couleur: '#80b8e0' },
  { id: 'ovulation',    label: 'Ovulation',    labelShort: 'Ovul.',  jours: '14–16', pct: 3/duree,  couleur: '#60c8a0' },
  { id: 'lutéale',      label: 'Lutéale',      labelShort: 'Lutéale', jours: '17–'+duree, pct: (duree-16)/duree, couleur: '#b090d0' },
];

const friseHtml = `
  <div style="border-radius:10px;overflow:hidden;display:flex;height:28px;margin-bottom:6px">
    ${phases.map(p => {
      const isActive = phaseAujourd?.phase === p.id;
      return `
        <div style="flex:${p.pct};background:${p.couleur}${isActive?'':'88'};
          display:flex;align-items:center;justify-content:center;
          font-size:10px;color:#fff;font-weight:bold;position:relative;
          transition:background .3s">
          ${isActive ? '▼' : ''}
        </div>`;
    }).join('')}
  </div>
  <div style="display:flex;margin-bottom:12px;gap:2px">
    ${phases.map(p => {
      const isActive = phaseAujourd?.phase === p.id;
      return `
        <div style="flex:${p.pct};text-align:center;overflow:hidden;min-width:0;padding:0 2px;box-sizing:border-box">
          <div style="font-size:9px;color:${p.couleur};font-weight:${isActive ? 'bold' : 'normal'};line-height:1.1;word-break:break-word">${p.labelShort}</div>
          <div style="font-size:8px;color:var(--text2);line-height:1.1;white-space:nowrap">J${p.jours}</div>
        </div>`;
    }).join('')}
  </div>
`;

  // Description phase active
  const descHtml = phaseAujourd
    ? `<div style="padding:10px 12px;border-radius:10px;margin-bottom:16px;
        background:${phaseAujourd.couleur}18;border:1px solid ${phaseAujourd.couleur}44">
        <div style="font-size:11px;font-weight:bold;color:${phaseAujourd.couleur};margin-bottom:4px">
          ${phaseAujourd.label} · J${phaseAujourd.j}
        </div>
        <div style="font-size:11px;color:var(--text);line-height:1.5">
          ${descriptions[phaseAujourd.phase]}
        </div>
      </div>`
    : `<div style="font-size:11px;color:var(--text2);font-style:italic;margin-bottom:16px">
        Aucun cycle enregistré — déclare ton premier jour de règles ci-dessous.
      </div>`;

  // Saisie J1
  const saisieHtml = `
    <div style="margin-bottom:16px">
      <h3 style="font-size:11px;color:var(--text2);letter-spacing:1px;margin-bottom:8px">
        DÉCLARER UN DÉBUT DE CYCLE
      </h3>
      <div style="display:flex;gap:6px;align-items:center">
        <input type="date" id="cycle-date-input" class="inp"
          value="${today()}"
          style="flex:1">
        <button class="btn btn-p" onclick="declarerReglesCycle()"
          style="white-space:nowrap;font-size:10px">
          🩸 Enregistrer
        </button>
      </div>
    </div>
  `;

// Historique des cycles
  let historiqueHtml = '';
  if (cycles.length >= 1) {
    const lignes = [];
    for (let i = 0; i < cycles.length - 1; i++) {
      const d1  = new Date(cycles[i+1] + 'T12:00');
      const d2  = new Date(cycles[i]   + 'T12:00');
      const nb  = Math.round((d2 - d1) / 86400000);
      const fmt = d => `${d.getDate()} ${d.toLocaleDateString('fr-FR',{month:'short',year:'numeric'})}`;
      lignes.push({ debut: cycles[i+1], fin: cycles[i], nb, label: `${fmt(d1)} → ${fmt(d2)} · ${nb} jours` });
    }

    // Liste de tous les J1 individuels pour suppression/modification
    const MAX_VISIBLE = 3;
const j1Html = cycles.map((ds, i) => {
  const d   = new Date(ds + 'T12:00');
  const fmt = `${d.getDate()} ${d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}`;
  const cache = i >= MAX_VISIBLE;
  return `
    <div class="j1-ligne" style="display:${cache ? 'none' : 'flex'};align-items:center;
      justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:11px;color:var(--text)">🩸 ${fmt}</span>
      <div style="display:flex;gap:4px">
        <input type="date" id="edit-j1-${i}"
          style="position:absolute;opacity:0;pointer-events:none;width:0;height:0"
          value="${ds}" onchange="modifierCycle('${ds}', this.value)">
        <button onclick="document.getElementById('edit-j1-${i}').showPicker()"
          style="background:none;border:none;cursor:pointer;font-size:13px">✏️</button>
        <button onclick="confirmerSuppressionCycle('${ds}')"
          style="background:none;border:none;cursor:pointer;font-size:13px;color:var(--text2)">🗑️</button>
      </div>
    </div>`;
}).join('');

const voirToutHtml = cycles.length > MAX_VISIBLE ? `
  <div id="j1-voir-tout" style="max-height:0;overflow:hidden;transition:max-height .3s ease">
    ${cycles.slice(MAX_VISIBLE).map((ds, i) => {
      const idx = i + MAX_VISIBLE;
      const d   = new Date(ds + 'T12:00');
      const fmt = `${d.getDate()} ${d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}`;
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;
          padding:6px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:11px;color:var(--text)">🩸 ${fmt}</span>
          <div style="display:flex;gap:4px">
            <input type="date" id="edit-j1-${idx}"
              style="position:absolute;opacity:0;pointer-events:none;width:0;height:0"
              value="${ds}" onchange="modifierCycle('${ds}', this.value)">
            <button onclick="document.getElementById('edit-j1-${idx}').showPicker()"
              style="background:none;border:none;cursor:pointer;font-size:13px">✏️</button>
            <button onclick="confirmerSuppressionCycle('${ds}')"
              style="background:none;border:none;cursor:pointer;font-size:13px;color:var(--text2)">🗑️</button>
          </div>
        </div>`;
    }).join('')}
  </div>
  <button onclick="toggleJ1Liste()" id="btn-voir-tout-j1"
    style="width:100%;margin-top:6px;padding:6px;border-radius:8px;
    border:1px solid var(--border);background:transparent;
    font-size:10px;cursor:pointer;color:var(--lilac);
    font-family:'Courier New',monospace">
    Voir tout (${cycles.length - MAX_VISIBLE} de plus) ▾
  </button>` : '';

    historiqueHtml = `
  <div style="margin-bottom:12px">
    <h3 style="font-size:11px;color:var(--text2);letter-spacing:1px;margin-bottom:8px">
      JOURS DE RÈGLES ENREGISTRÉS
    </h3>
    ${j1Html}
    ${voirToutHtml}

    ${lignes.length >= 1 ? `
      <h3 style="font-size:11px;color:var(--text2);letter-spacing:1px;margin:12px 0 8px">
        DERNIERS CYCLES
      </h3>
      ${lignes.slice(0, 2).map(l => `
        <div style="padding:6px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:11px;color:var(--text)">${l.label}</span>
        </div>`).join('')}
    ` : ''}

    <button onclick="exporterCycles()"
      style="width:100%;margin-top:10px;padding:8px;border-radius:10px;
      border:2px dashed var(--border);background:transparent;
      font-size:11px;cursor:pointer;color:var(--text2);
      font-family:'Courier New',monospace">
      ⬇️ Exporter l'historique (.txt)
    </button>
  </div>
`;
  }

  el.innerHTML = `
    <h3 style="font-size:11px;color:var(--text2);letter-spacing:1px;margin-bottom:10px">
      FRISE DU CYCLE
    </h3>
    ${friseHtml}
    ${descHtml}
    ${saisieHtml}
    ${historiqueHtml}
  `;
}

function toggleJ1Liste() {
  const liste = document.getElementById('j1-voir-tout');
  const btn   = document.getElementById('btn-voir-tout-j1');
  if (!liste) return;
  const ouvert = liste.style.maxHeight !== '0px' && liste.style.maxHeight !== '';
  liste.style.maxHeight = ouvert ? '0' : '400px';
  liste.style.overflowY = ouvert ? 'hidden' : 'auto';
  btn.textContent = ouvert
    ? `Voir tout (${liste.querySelectorAll('[style*="flex"]').length} de plus) ▾`
    : 'Réduire ▴';
}

function modifierCycle(ancienneDate, nouvelleDate) {
  if (!nouvelleDate || ancienneDate === nouvelleDate) return;
  const D = window.D;

  // Vérifie pas de doublon
  const doublon = (D.cycle || []).find(e => e.date === nouvelleDate && e.type === 'regles');
  if (doublon) { toast('Un cycle existe déjà à cette date'); return; }

  // Remplace la date
  const idx = (D.cycle || []).findIndex(e => e.date === ancienneDate && e.type === 'regles');
  if (idx !== -1) {
    D.cycle[idx].date = nouvelleDate;
    // Retrie par date décroissante
    D.cycle.sort((a, b) => a.date > b.date ? -1 : 1);
  }
  save();
  toast('Cycle mis à jour ✓');
  // Recalcul automatique — tout se base sur D.cycle donc juste re-render
  renderAgendaCycle(document.getElementById('agenda-contenu'));
}
function declarerReglesCycle() {
  const ds = document.getElementById('cycle-date-input').value;
  if (!ds) return;
  declarerRegles(ds); // réutilise la fonction du panneau 1
  renderAgendaCycle(document.getElementById('agenda-contenu'));
}

function supprimerCycle(ds) {
  window.D.cycle = (window.D.cycle || []).filter(e => !(e.date === ds && e.type === 'regles'));
  save();
  renderAgendaCycle(document.getElementById('agenda-contenu'));
}

function exporterCycles() {
  const D      = window.D;
  const cycles = (D.cycle || [])
    .filter(e => e.type === 'regles')
    .map(e => e.date)
    .sort().reverse();

  if (cycles.length < 2) { toast('Pas assez de données à exporter'); return; }

  let txt = 'Historique des cycles — HabitGotchi\n';
  txt += '=====================================\n\n';

  for (let i = 0; i < cycles.length - 1; i++) {
    const d1  = new Date(cycles[i+1] + 'T12:00');
    const d2  = new Date(cycles[i]   + 'T12:00');
    const nb  = Math.round((d2 - d1) / 86400000);
    const fmt = d => d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' });
    txt += `Cycle ${cycles.length - 1 - i} : ${fmt(d1)} → ${fmt(d2)} (${nb} jours)\n`;
  }

  txt += `\nDurée de cycle paramétrée : ${D.g.cycleDuree || 28} jours\n`;
  txt += `Exporté le ${new Date().toLocaleDateString('fr-FR')}\n`;

  const blob = new Blob([txt], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'cycles-habitgotchi.txt';
  a.click();
  URL.revokeObjectURL(url);
  toast('Export téléchargé ✓');
}

/* ============================================================
   INIT UI — Appelée par bootstrap() dans app.js
   (plus de DOMContentLoaded : incompatible PWA iOS standalone)
   ============================================================ */
window.initUI = function() {
  // Garde-fou : D doit exister (bootstrap charge D en async)
  if (!window.D || !window.D.g) {
    console.warn('initUI appelée avant que D soit prêt');
    return;
  }

    // ── Feedback export journal ──
  const lastExp = window.D.lastJournalExport;
  const info = document.getElementById('last-journal-export');
  if (info) info.textContent = lastExp
    ? `📓 Journal exporté le ${lastExp}`
    : '📓 Aucun export automatique encore';

  const h = hr();
  window.D.g.activeEnv = (h >= 21 || h < 7) ? 'chambre' : 'parc';

  updUI();
  syncConsoleHeight();
  renderHabs();
  renderProps();
  restorePerso();
  initMoodPicker();
  checkWelcome();
  updBubbleNow();

  const vEl = document.getElementById('APP_VERSION');
  if (vEl) vEl.textContent = window.APP_VERSION || '';
  // Tap sur le tama depuis un autre onglet → retour accueil
  document.querySelector('.tama-screen')?.addEventListener('pointerdown', function() {
  const modalEl = document.getElementById('modal');
  const modalOuverte = modalEl && getComputedStyle(modalEl).display !== 'none';
  if (!window._gotchiActif && !modalOuverte && typeof go === 'function') go('gotchi');
});
};