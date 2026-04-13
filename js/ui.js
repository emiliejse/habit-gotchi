/* ============================================================
   ui.js — Interactions, panneaux, modales, appels API Claude
   Dépend de : app.js (window.D, save, today, hr, haptic, addXp,
               getSt, nxtTh, calcStr, toggleHab, editH, updBubbleNow,
               CATS, STG, UI_PALETTES, GOTCHI_COLORS, ENV_THEMES, SK)
   ============================================================ */

// ── animEl() : applique une animation Animate.css sur un élément ──
// Pense à ça comme une télécommande d'animation :
//   el  → l'élément DOM à animer (ex: document.getElementById('modal'))
//   anim → le nom de l'animation sans préfixe (ex: 'bounceIn', 'tada')
//   dur  → durée en ms (optionnel, défaut 600)
// ⚠️ La classe est retirée automatiquement après l'animation
//    pour pouvoir rejouer l'animation plus tard.
function animEl(el, anim, dur = 600) {
  if (!el) return;
  el.style.setProperty('--animate-duration', dur + 'ms');
  el.classList.add('animate__animated', 'animate__' + anim);
  el.addEventListener('animationend', () => {
    el.classList.remove('animate__animated', 'animate__' + anim);
  }, { once: true });
}
/* ============================================================
   NAVIGATION
   ============================================================ */
let journalLocked = true;
let masquerAcquis = true;

function go(t) {
  document.querySelectorAll('.pnl').forEach(p => p.classList.remove('on'));
  const targetPanel = document.getElementById('p-' + t);
  if (targetPanel) targetPanel.classList.add('on');

  const shell = document.querySelector('.tama-shell');
  if (t === 'gotchi') {
    shell.classList.remove('shrunk');
    const h = hr();
    window.D.g.activeEnv = (h >= 22 || h < 7) ? 'chambre' : 'parc';
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
  if (t === 'perso')    renderPerso();
  if (t === 'journal')  { journalLocked = true; renderJ(); }

  document.getElementById('dynamic-zone').scrollTop = 0;
}

function toggleMenu() {
  const ov = document.getElementById('menu-overlay');
  if (!ov.classList.contains('open')) {
    const nm = document.getElementById('menu-gotchi-name');
    if (nm) nm.textContent = window.D.g.name || 'Gotchi';
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

/* ============================================================
   TOAST & FEEDBACK
   ============================================================ */
let _toastTimer;
function toast(m) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = m;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

function toastModal(m) {
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `<p style="text-align:center;font-size:12px">${m}</p><button class="btn btn-p" onclick="clModal()" style="width:100%;margin-top:8px">OK</button>`;
  animEl(document.getElementById('mbox'), 'bounceIn');
}

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

/* ============================================================
   MODAL
   ============================================================ */
function clModal(e) {
  if (!e || e.target.id === 'modal') document.getElementById('modal').style.display = 'none';
}

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

/* ============================================================
   UI PRINCIPALE
   ============================================================ */
function updUI() {
  const D = window.D;
  if (document.getElementById('petales-l'))
    document.getElementById('petales-l').textContent = `🌸 ${D.g.petales || 0}`;
  const g = D.g, s = getSt(g.totalXp), nt = nxtTh(g.totalXp), pt = s.th;
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
    btnAsk.childNodes[0].textContent = `Interroger ${window.D.g.name || 'le Gotchi'} `;
  }
  updBadgeBoutique();
}

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

/* ============================================================
   HABITUDES
   ============================================================ */
function renderHabs() {
  const D = window.D;
  const td = today(), log = D.log[td] || [], done = log.length;
  const habHome = document.getElementById('hab-home');
  if (habHome) {
    habHome.innerHTML = D.habits.map(h => {
      const c = CATS.find(c => c.id === h.catId), d = log.includes(h.catId);
      return `<div class="hab ${d?'done':''}" onclick="toggleHab('${h.catId}')"><div class="ck">${d?'✓':''}</div><span style="flex:1;font-size:12px">${CATS.find(c => c.id === h.catId)?.def || h.label}</span><span style="font-size:16px">${c.icon}</span></div>`;
    }).join('');
  }
  const hc = document.getElementById('hab-count');
  if (hc) hc.textContent = `${done}/6`;
  const edit = document.getElementById('hab-edit');
  if (edit) edit.innerHTML = D.habits.map((h, i) => {
    const c = CATS.find(c => c.id === h.catId);
    return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><span style="font-size:20px;width:28px;text-align:center">${c.icon}</span><input class="inp" value="${h.label}" onchange="editH(${i},this.value)" style="flex:1;font-size:12px"></div>`;
  }).join('');
}

/* ============================================================
   PROPS & INVENTAIRE
   ============================================================ */
let propsFilterActive = 'tous';

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
    'decor':      { label: '🌿 Décor' },
    'accessoire': { label: '👒 Accessoires' },
    'ambiance':   { label: '✨ Ambiances' },
    'claude':     { label: '✦ IA' },
  };
  const filterEl = document.getElementById('props-filters');
  if (filterEl) {
    filterEl.innerHTML = Object.entries(cats).map(([key, cat]) =>
      `<button onclick="setPropsFilter('${key}')" style="padding:4px 10px;border-radius:20px;border:2px solid var(--border);font:bold 10px 'Courier New',monospace;cursor:pointer;background:${propsFilterActive===key?'var(--lilac)':'#fff'};color:${propsFilterActive===key?'#fff':'var(--text2)'};transition:.15s;">${cat.label}</button>`
    ).join('');
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
    });
  listEl.innerHTML = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">` +
    filtered.map(({ p, index, def }) => {
      const isClaud = !!(D.propsPixels && D.propsPixels[p.id]);
      const badgeId = `mini-${p.id}`;
      return `<div onclick="toggleProp(${index})" style="background:${p.actif?'var(--mint)':'#fff'};border:2px solid ${p.actif?'var(--mint)':isClaud?'var(--lilac)':'var(--border)'};border-radius:10px;padding:6px 4px 8px;font-size:10px;font-weight:bold;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:space-between;gap:4px;transition:.2s;text-align:center;box-shadow:0 2px 4px rgba(0,0,0,.05);position:relative;min-height:90px;">
        ${isClaud ? `
  <span style="position:absolute;top:4px;left:4px;font-size:9px;color:var(--lilac);">✦</span>
  <span onclick="event.stopPropagation();supprimerObjetIA('${p.id}')" style="position:absolute;top:2px;right:4px;font-size:13px;cursor:pointer;opacity:.6">🗑️</span>
` : ''}
        <div style="flex:1;display:flex;align-items:center;justify-content:center;">
          ${def && def.pixels ? `<canvas id="${badgeId}" style="image-rendering:pixelated;border-radius:3px"></canvas>` : `<span style="font-size:22px">${p.emoji||'🎁'}</span>`}
        </div>
        <div style="width:100%;">
          <div>${p.nom}</div>
          <div style="font-size:8px;text-transform:uppercase;opacity:.7;font-weight:normal;">${p.type}</div>
          ${p.actif
  ? `<div style="font-size:8px;background:var(--mint);border-radius:6px;padding:2px 4px;margin-top:2px;color:#fff;font-weight:bold">
       ✓ actif${p.slot ? ' · ' + p.slot : ''}
     </div>`
  : `<div style="font-size:8px;opacity:.4;margin-top:2px">inactif</div>`
}
        </div>
      </div>`;
    }).join('') + `</div>`;
  filtered.forEach(({ p, def }) => {
    if (def && def.pixels) renderPropMini(document.getElementById(`mini-${p.id}`), def);
  });
  const wallet   = document.getElementById('xp-wallet');
  if (wallet)   wallet.textContent = `💜 ${D.g.totalXp} XP disponibles`;
}
function ouvrirBoutique() {
  const onglet = window._boutiqueOnglet || 'catalogue';

  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <h3 style="font-size:13px;color:var(--lilac);">🛍️ Boutique</h3>
<button onclick="clModal()" style="background:none;border:none;font-size:16px;cursor:pointer;color:var(--text2)">✕</button>    </div>

    <div style="text-align:center;margin-bottom:16px">
      <p style="font-size:11px;color:var(--text2);text-align:center">
  🌸 <b style="font-size:15px;color:var(--lilac)">${D.g.petales || 0}</b> pétales disponibles
</p>
    </div>

    <div style="display:flex;gap:6px;margin-bottom:14px;background:rgba(0,0,0,0.05);border-radius:20px;padding:3px">
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
    const libFiltree = lib.filter(prop => !(D.g.props || []).find(p => p.id === prop.id));

    el.innerHTML = libFiltree.map(prop => {
      const peutAcheter = (D.g.petales || 0) >= prop.cout;
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px;border:2px solid var(--border);border-radius:10px;margin-bottom:6px;background:#fff">
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
    const peutGenerer = (D.g.petales || 0) >= 16;
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
          ${peutGenerer ? `✨ Demander à ${window.D.g.name} — 🌸 16` : '🌸 Il te faut 16 pétales'}
        </button>
      </div>
    `;
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
  D.g.props.push({ id: prop.id, nom: prop.nom, type: prop.type, emoji: prop.emoji, actif: false, seen: false });
  addEvent('cadeau', prop.cout, `${prop.emoji || '🎁'} ${prop.nom}`);
  save();
  toast(`🎁 ${prop.nom} ajouté à ton inventaire !`);
renderProps();
updUI();
updBadgeBoutique();
ouvrirBoutique();
}
function setPropsFilter(cat) { propsFilterActive = cat; renderProps(); }

function toggleProp(index) {
  const prop = D.g.props[index];

  // --- Désactiver si déjà actif ---
if (prop.actif) {
  if (prop.type === 'decor') {
    // Décor actif → proposer de déplacer ou ranger
    openSlotPickerAvecRangement(index);
  } else {
    prop.actif = false;
    prop.slot = null;
    save();
    renderProps();
    toast(`📦 ${prop.nom} rangé`);
  }
  return;
}

  // --- Objets non-décor : activer direct (pas de slot à choisir) ---
  if (prop.type !== 'decor') {
    prop.actif = true;
    save();
    renderProps();
    toast(`✨ ${prop.nom} activé !`);
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

function makeSlotBtn(propIndex, slotId, label, arrow, occupied) {
  const taken = occupied[slotId];
  return `<div onclick="confirmSlot(${propIndex},'${slotId}')" style="
    border:2px solid var(--border); border-radius:8px; padding:8px 4px;
    cursor:pointer; text-align:center; font-size:10px; font-weight:bold;
    background:${taken ? '#fff8f0' : '#fff'}; transition:.15s;"
    onmouseover="this.style.borderColor='var(--mint)'"
    onmouseout="this.style.borderColor='var(--border)'">
    <div style="font-size:14px">${arrow}</div>
    <div>${label}</div>
    ${taken ? `<div style="font-size:8px;color:var(--lilac)">⚠ ${taken}</div>` : ''}
  </div>`;
}
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
      Actuellement en slot <b>${prop.slot}</b> — changer d'emplacement ?
    </p>
    <div style="font-size:9px;opacity:.5;margin-bottom:4px;text-transform:uppercase">Fond</div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:8px">
      ${makeSlotBtn(propIndex, 'A', 'Gauche', '↖', occupied)}
      ${makeSlotBtn(propIndex, 'B', 'Droite', '↗', occupied)}
    </div>
    <div style="font-size:9px;opacity:.5;margin-bottom:4px;text-transform:uppercase">Devant</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px">
      ${makeSlotBtn(propIndex, 'C',   'Gauche', '↙', occupied)}
      ${makeSlotBtn(propIndex, 'SOL', 'Centre', '⬇', occupied)}
      ${makeSlotBtn(propIndex, 'D',   'Droite', '↘', occupied)}
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
  r += `😶 Humeur du jour: ${g.mood}\n`;
  r += `🌍 Thème: ${g.envTheme || 'pastel'}\n\n`;

  r += `📋 Habitudes\n`;
  r += `${D.habits.length} configurées · ${habitsCochés} cochées aujourd'hui\n\n`;

  r += `🎒 Objets\n`;
  r += `Catalogue: ${lib.length} · Inventaire: ${(D.g.props||[]).length} (${actifs.length} actifs)\n`;
  r += `Objets IA: ${Object.keys(D.propsPixels || {}).length}\n\n`;

  r += `📓 Journal\n`;
  r += `${(D.journal||[]).length} entrées · ${(g.customBubbles||[]).length} bulles perso\n\n`;

  r += `📁 Fichiers data\n`;
  r += (lib.length > 0 ? '✅' : '❌') + ' props.json\n';
  r += (window.PERSONALITY ? '✅' : '❌') + ' personality.json\n';
  r += (window.AI_CONTEXTS ? '✅' : '❌') + ' ai_contexts.json\n';
  r += (window.AI_SYSTEM ? '✅' : '❌') + ' ai_system.json\n\n';

    r += `🗺️ Météo\n`;
  r += `LAT: ${D.meteoLat || '—'} | LON: ${D.meteoLon || '—'}\n\n`;

  r += `💩 Crottes: ${(g.poops||[]).length}\n\n`;

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

/* ============================================================
   API CLAUDE — CADEAU / BULLE
   ============================================================ */
async function askClaude() {
  const key = D.apiKey;
  if (!key) { toast(`*chuchote* J'ai besoin de ma clé API dans les Réglages 🔑`); return; }

  const g = D.g, td = today();
if (hr() >= 22 || hr() < 7) {
  const msgs = [
    "Zzz... je dors 🌙",
    "Chut ! Il est tard... 😴",
    "Laisse-moi tranquille, vas dormir ! 🌛",
    "...zzzZZZ... 💤",
    "Le Gotchi ronfle doucement. Reviens demain ✿"
  ];
  const el = document.getElementById('claude-msg');
  if (el) el.textContent = msgs[Math.floor(Math.random() * msgs.length)];
  return;
}
    // ✦ LIMITE 3 PENSÉES PAR JOUR
  if (window.D.lastThoughtDate !== td) {
    window.D.lastThoughtDate = td;
    window.D.thoughtCount = 0;
  }
  if (window.D.thoughtCount >= 3) {
    toast("Le Gotchi a besoin de calme… Reviens demain 🌙");
    return;
  }
  const P = window.PERSONALITY; 
  const CTX = window.AI_CONTEXTS?.askClaude;

  // --- Remplacement des variables dans le prompt base ---
const notesRecentes = D.journal
  .slice(-3)
  .map(j => {
    const d = j.date ? j.date.split('T')[0] : 'date inconnue';
    return `[${d}] ${j.text.slice(0, 40)}`;
  })
  .filter(t => t.length > 0)
  .join(' / ');

  const vars = {
  nom: D.g.name || P?.nom || 'Petit·e Gotchi',
  userName: D.userName || 'ton utilisatrice',
  style:         P?.style || 'Phrases courtes, onomatopées entre astérisques, bienveillant.',
  traits:        P?.traits?.join(', ') || 'doux, joueur, curieux',
  energy:        g.energy,
  happiness:     g.happiness,
  heure: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  notesRecentes: notesRecentes
    ? `Aujourd'hui : ${today()}. Ambiance récente : ${notesRecentes}`
    : `Aujourd'hui : ${today()}.`,
  exemples:      (P?.bulles?.idle || []).slice(0, 3).join(', ') || '*bâille*, *sourit*',
  existingNames: (D.g.props || []).map(p => p.nom).join(', ') || 'aucun',
  timestamp:     Date.now(),
};

  function fillVars(template) {
    return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
  }

  // --- Règle cadeau : 1 tous les 3 jours ---
  const giveGift = !D.lastGiftDate ||
    Math.floor((new Date() - new Date(D.lastGiftDate)) / 86400000) >= 3;

  const prompt = CTX
    ? fillVars(CTX.base) + '\n\n' + fillVars(giveGift ? CTX.withGift : CTX.withoutGift)
    : `Fallback : réponds en JSON {"message":"...","bulles":{"idle":"..."}}`;

  if (document.getElementById('claude-msg'))
    document.getElementById('claude-msg').textContent = 'Je réfléchis... 💭';

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
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const d = await r.json();
    const match = d.content[0].text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('JSON introuvable');
    const data = JSON.parse(match[0]);

    // --- Message affiché ---
    if (document.getElementById('claude-msg'))
      document.getElementById('claude-msg').textContent = data.message;

    // --- Bulles enrichies par état (pool glissant 4 max) ---
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

    // --- Cadeau ---
    if (giveGift && data.cadeau) {
      if (!D.g.props) D.g.props = [];
      if (!D.g.props.find(p => p.id === data.cadeau.id)) {
        D.g.props.push({ id: data.cadeau.id, nom: data.cadeau.nom, type: data.cadeau.type, actif: false, seen: false });
        if (!D.propsPixels) D.propsPixels = {};
D.propsPixels[data.cadeau.id] = data.cadeau;
window.PROPS_LOCAL = Object.values(D.propsPixels);
        D.lastGiftDate = td;
        const poolCadeau = src.cadeau || ["Oh ! Un cadeau ! 🎁"];
const bulleCadeau = poolCadeau[Math.floor(Math.random() * poolCadeau.length)];
document.getElementById('bubble').textContent = bulleCadeau.replace('{{nom}}', D.g.name || 'toi');
        toast(`🎁 Nouveau cadeau : ${data.cadeau.nom} !`);
        addEvent('cadeau', 0, `🎁 ${data.cadeau.nom} reçu en cadeau !`);
        updBadgeBoutique();
      }
    }

    window.D.thoughtCount++;
  const tc = document.getElementById('thought-count');
  if (tc) tc.textContent = `(${window.D.thoughtCount}/3)`;
    
    save(); renderProps(); updBubbleNow();

  } catch(e) {
    if (document.getElementById('claude-msg'))
      document.getElementById('claude-msg').textContent = '*soupir* Je n\'arrive pas à me connecter... ✿';
  }
}

async function acheterPropClaude() {
  if ((D.g.petales || 0) < 16) { toast(`Pas assez de pétales 🌸`); return; }
  if (!D.apiKey) { toast(`*chuchote* J'ai besoin de ma clé API dans les Réglages 🔑`); return; }

  D.g.petales -= 16; save();

  const el = document.getElementById('boutique-contenu');
  if (el) el.innerHTML = `<p style="text-align:center;font-size:11px;padding:20px">${window.D.g.name} crée ton objet... 💭</p>`;

  const nomsExistants = (D.g.props || []).map(p => `${p.nom} (${p.type})`).join(', ') || 'aucun';
  const themes = ['nature','cosmos','magie','cuisine','musique','voyage','océan','forêt','météo','jardin','minéral','rêve'];
  const theme = themes[Math.floor(Math.random() * themes.length)];
  const ctx = window.AI_CONTEXTS;
  const prompt = ctx
    ? ctx.buyProp.replace('{{theme}}', theme).replace('{{existingNames}}', nomsExistants).replace('{{timestamp}}', Date.now())
    : (() => { toast(`*inquiet* Mes fichiers de mémoire sont manquants... 💜`); return null; })();
  
if (!prompt) return;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type':'application/json','x-api-key':D.apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true' },
      body: JSON.stringify({ model:'claude-sonnet-4-5', max_tokens:300, temperature:1, messages:[{role:'user',content:prompt}] })
    });
    const data = await r.json();
    const match = data.content[0].text.match(/\{[\s\S]*\}/);
    if (match) {
      const obj = JSON.parse(match[0]);
      D.g.props.push({ id:obj.id, nom:obj.nom, type:obj.type, emoji:obj.emoji||'🎁', actif:false, slot:obj.slot||'A', motion:obj.motion||'drift', ancrage:obj.ancrage||null, seen: false });
      D.propsPixels = D.propsPixels || {};
D.propsPixels[obj.id] = obj;
window.PROPS_LOCAL = Object.values(D.propsPixels);
      save(); renderProps(); updUI();
      toast(`🎁 ${obj.nom} ajouté à ton inventaire !`);
      ouvrirBoutique();
    }
  } catch(e) {
    D.g.petales = (D.g.petales || 0) + 16; save();
    toast(`*soupir* Je n'ai pas pu créer l'objet... pétales remboursés 🌸`);
    ouvrirBoutique();
  }
}

/* ============================================================
   API CLAUDE — SOUTIEN
   ============================================================ */
function toastInfo() {
  toastModal("💬 Le Gotchi peut te partager une pensée jusqu'à 3 fois par jour.\n\n✍️ Si tu écris des notes dans ton journal, ses réponses seront personnalisées selon ton humeur du jour 💜");
}

   function genSoutien() {
  const D = window.D, td = today();
  const habsDuJour  = D.habits.map(h => ({ label:h.label, faite:(D.log[td]||[]).includes(h.catId) }));
  const notesDuJour = D.journal.filter(j => j.date.startsWith(td)).map(j => ({ humeur:j.mood, texte:j.text }));
  const ctx = window.AI_CONTEXTS;
  const promptInit = ctx
    ? ctx.genSoutien
        .replace('{{energy}}',      `${D.g.energy}/5`)
        .replace('{{happiness}}',   `${D.g.happiness}/5`)
        .replace('{{habitsDone}}',  habsDuJour.filter(h=>h.faite).map(h=>h.label).join(', ')||'aucune')
        .replace('{{habitsUndone}}',habsDuJour.filter(h=>!h.faite).map(h=>h.label).join(', ')||'toutes faites !')
        .replace('{{notes}}',       notesDuJour.length ? notesDuJour.map(n=>`[${n.humeur}] ${n.texte}`).join(' | ') : 'aucune note')
    : `Tu es le Gotchi, un compagnon bienveillant pour le bien-être mental et le TDAH.\nL'utilisateur a besoin de soutien. Énergie: ${D.g.energy}/5, Bonheur: ${D.g.happiness}/5.\nCommence par une phrase douce. Pose UNE question ouverte. Ton doux, jamais de jugement.`;

  window._soutienHistory = [];
  window._soutienCount = 0;
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <h3 style="font-size:13px;color:var(--lilac);">💜 Besoin de soutien</h3>
      <button onclick="clModal()" style="background:none;border:none;font-size:16px;cursor:pointer;color:var(--text2)">✕</button>
    </div>
    <div class="soutien-chat" id="soutien-chat">
      <div class="chat-bubble-system">Je consulte ton état du jour...</div>
    </div>
    <div style="display:flex;gap:6px;margin-top:8px">
      <input type="text" id="soutien-inp" class="inp" placeholder="Réponds ici..." style="font-size:11px"
        onkeydown="if(event.key==='Enter')sendSoutienMsg()">
      <button class="btn btn-p" onclick="sendSoutienMsg()" style="flex-shrink:0;padding:8px 12px">→</button>
    </div>
    <p style="font-size:8px;color:var(--text2);text-align:center;margin-top:4px">6 messages max · conversation non sauvegardée</p>
`;
animEl(document.getElementById('mbox'), 'bounceIn');
  sendSoutienMsg(promptInit, true);
}

async function sendSoutienMsg(systemPrompt, isInit = false) {
  const key = window.D.apiKey;
  const chat = document.getElementById('soutien-chat');
  if (!isInit) {
  if (window._soutienCount >= 6) {
    chat.innerHTML += `<div class="chat-bubble-system">Tu as atteint la limite de 6 messages pour cette session. Prends soin de toi 💜</div>`;
    chat.scrollTop = chat.scrollHeight;
    document.getElementById('soutien-inp').disabled = true;
    document.querySelector('#mbox .btn-p').disabled = true;
    return;
  }
  window._soutienCount++;
}
  if (!key) { toast(`*chuchote* J'ai besoin de ma clé API dans les Réglages 🔑`); return; }
  const inp  = document.getElementById('soutien-inp');
  let userText = '';
  if (!isInit) {
    userText = inp ? inp.value.trim() : ''; if (!userText) return;
    chat.innerHTML += `<div class="chat-bubble-user">${userText}</div>`;
    inp.value = '';
    window._soutienHistory.push({ role:'user', content:userText });
  }
  const typingId = 'typing-' + Date.now();
  chat.innerHTML += `<div class="chat-bubble-system" id="${typingId}">Gotchi réfléchit... 💭</div>`;
  chat.scrollTop = chat.scrollHeight;
  const messages = isInit ? [{ role:'user', content:systemPrompt }] : [...window._soutienHistory.slice(-6)];
const notesJour = window.D.journal
  .filter(j => j.date.startsWith(today()))
  .slice(-3)
  .map(j => `[${j.mood}] ${j.text}`)
  .join(' | ') || 'aucune note';

const habsDone = (window.D.log[today()] || [])
  .map(catId => {
    const h = window.D.habits.find(h => h.catId === catId);
    return h ? h.label : catId;
  })
  .join(', ') || 'aucune';

const contexte = (window.AI_SYSTEM?.soutien_contexte || '')
  .replace('{energie}', window.D.g.energy)
  .replace('{bonheur}', window.D.g.happiness)
  .replace('{habitesDone}', habsDone)
  .replace('{notes}', notesJour)
  .replace('{messages_restants}', 6 - window._soutienCount);

const sysPrompt = `${window.AI_SYSTEM?.soutien || ''} ${contexte}`.trim();
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true' },
      body: JSON.stringify({ model:'claude-sonnet-4-5', max_tokens:300, system:sysPrompt, messages })
    });
    const d = await r.json();
    const reply = d.content?.[0]?.text || 'Je suis là. 💜';
    document.getElementById(typingId)?.remove();
    chat.innerHTML += `<div class="chat-bubble-claude">${reply}</div>`;
    chat.scrollTop = chat.scrollHeight;
    if (isInit) window._soutienHistory.push({ role:'user', content:systemPrompt });
    window._soutienHistory.push({ role:'assistant', content:reply });
  } catch(e) {
    document.getElementById(typingId)?.remove();
    chat.innerHTML += `<div class="chat-bubble-system">*soupir* Je n'arrive plus à te répondre... Vérifie ta clé API 💜</div>`;
  }
}

/* ============================================================
   API CLAUDE — BILAN SEMAINE
   ============================================================ */
let wOff = 0, mOff = 0;
function navW(d) { wOff += d; renderProg(); }
function navM(d) { mOff += d; renderProg(); }

async function genBilanSemaine() {
  const D = window.D, key = D.apiKey;
  const summaryEl = document.getElementById('claude-summary');
  const wd = getWkDates(wOff);
  const g = D.g, s = getSt(g.totalXp);
  const habitudes = D.habits.map(h => ({ habitude:h.label, jours_faits:wd.filter(d=>(D.log[d]||[]).includes(h.catId)).length, sur:7 }));
  const notes = D.journal.filter(j=>wd.includes(j.date.split('T')[0])).map(j=>({humeur:j.mood,texte:j.text,date:j.date.split('T')[0]}));
  const totalHabDays = wd.reduce((acc,d)=>acc+(D.log[d]||[]).length, 0);
  if (!key) {
    const lignes = habitudes.map(h=>`• ${h.habitude} : ${h.jours_faits}/7 jours`).join('\n');
    summaryEl.textContent = `Semaine du ${wd[0]} au ${wd[6]}\n\n${lignes}\n\n${notes.length} note(s) de journal.\n\nAjoute ta clé API pour un bilan personnalisé par ton Gotchi ✿`;
    document.getElementById('btn-copy-bilan').style.display = 'block';
    document.getElementById('bil-txt-hidden').value = summaryEl.textContent;
    return;
  }
  summaryEl.textContent = '💭 ${window.D.g.name} réfléchit à ta semaine...';
  const ctx = window.AI_CONTEXTS;
  const prompt = ctx
    ? ctx.genBilanSemaine
        .replace('{{weekStart}}',   wd[0])
        .replace('{{weekEnd}}',     wd[6])
        .replace('{{name}}',        g.name)
        .replace('{{stage}}',       s.l)
        .replace('{{energy}}',      g.energy)
        .replace('{{happiness}}',   g.happiness)
        .replace('{{habitudes}}',   habitudes.map(h=>`- ${h.habitude} : ${h.jours_faits}/7 jours`).join('\n'))
        .replace('{{totalHabDays}}',totalHabDays)
        .replace('{{notesCount}}',  notes.length)
        .replace('{{notes}}',       notes.length ? notes.map(n=>`[${n.date}/${n.humeur}] ${n.texte}`).join('\n') : 'aucune note cette semaine')
    : `Tu es le Gotchi. Bilan semaine ${wd[0]}→${wd[6]} pour ${g.name} (${s.l}). Énergie ${g.energy}/5, Bonheur ${g.happiness}/5. ${totalHabDays} habitudes cochées. ${notes.length} notes. Bilan chaleureux en 3 paragraphes courts. Ton doux, pas de bullet points.`;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true' },
      body: JSON.stringify({ model:'claude-sonnet-4-5', max_tokens:400, messages:[{role:'user',content:prompt}] })
    });
    const d = await r.json();
    const bilan = d.content?.[0]?.text || 'Je n\'ai pas pu générer le bilan.';
    summaryEl.textContent = bilan;
    document.getElementById('bil-txt-hidden').value = bilan;
    document.getElementById('btn-copy-bilan').style.display = 'block';
    save();
  } catch(e) { summaryEl.textContent = 'Erreur : ' + (e.message || JSON.stringify(e)); }
}

function copyBilanSemaine() {
  const hid = document.getElementById('bil-txt-hidden'); if (!hid) return;
  navigator.clipboard.writeText(hid.value).then(() => {
    const b = document.getElementById('btn-copy-bilan');
    if (b) { b.textContent = '✓ Copié !'; setTimeout(() => b.textContent = '📋 Copier le bilan', 1500); }
  });
}
function resetBilan() {
  if (confirm('Effacer le bilan ?')) {
    if (document.getElementById('claude-summary')) document.getElementById('claude-summary').textContent = 'Ton bilan apparaîtra ici...';
  }
}

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
        <div style="font-size:9px;font-weight:bold;color:#38304a">${p.label}</div>
      </div>`).join('');
  }
  const gc = document.getElementById('gotchi-colors');
  if (gc) {
    const current = D.g.gotchiColor || 'vert';
    gc.innerHTML = GOTCHI_COLORS.map(c => `
      <div onclick="applyGotchiColor('${c.id}')" style="width:48px;height:48px;border-radius:12px;cursor:pointer;background:${c.body};border:3px solid ${current===c.id?'#b090d0':'transparent'};display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:bold;color:#38304a;transition:.2s;box-shadow:0 2px 6px rgba(0,0,0,.1);">${c.label}</div>`).join('');
  }
  const et = document.getElementById('env-themes');
  if (et) {
    const current = D.g.envTheme || 'pastel';
    et.innerHTML = ENV_THEMES.map(t => `
      <div onclick="applyEnvTheme('${t.id}')" style="padding:8px 12px;border-radius:10px;cursor:pointer;background:linear-gradient(135deg,${t.sky1},${t.gnd});border:3px solid ${current===t.id?'#b090d0':'transparent'};font-size:10px;font-weight:bold;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.3);transition:.2s;">${t.label}</div>`).join('');
  }
}

function applyUIPalette(id, silent = false) {
  const p = UI_PALETTES.find(x => x.id === id); if (!p) return;
  document.documentElement.style.setProperty('--bg', p.bg);
  document.documentElement.style.setProperty('--lilac', p.lilac);
  document.documentElement.style.setProperty('--mint', p.mint);
  document.documentElement.style.setProperty('--pink', p.pink);
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
}

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

const MOODS = [{id:'super',e:'🌟'},{id:'bien',e:'😊'},{id:'ok',e:'😐'},{id:'bof',e:'😔'},{id:'dur',e:'🌧️'}];
let selMood = null;

function initMoodPicker() {
  const mp = document.getElementById('mood-pick');
  if (mp) mp.innerHTML = MOODS.map(m => `<button class="mood-b" data-m="${m.id}" onclick="pickM('${m.id}')">${m.e}</button>`).join('');
}
function pickM(id) {
  selMood = id;
  document.querySelectorAll('.mood-b').forEach(b => b.classList.toggle('sel', b.dataset.m === id));
}
function saveJ() {
  const t = document.getElementById('j-text').value.trim();
  if (!t && !selMood) return;
  window.D.journal.push({ date: new Date().toISOString(), mood: selMood || 'ok', text: t });
  addXp(15);
  addEvent('note', 15, t.slice(0, 30) || 'Note sans texte');  // ← nouveau
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
    bulle = bulle.replace('{{nom}}', D.userName || 'toi');
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
  document.getElementById('mbox').innerHTML = `<h3>Modifier</h3><textarea id="edit-j-txt" class="inp" rows="3">${e.text||''}</textarea><div style="display:flex;gap:6px;margin-top:8px"><button class="btn btn-s" onclick="clModal()" style="flex:1">Annuler</button><button class="btn btn-p" onclick="saveEditJ(${i})" style="flex:1">OK</button></div>`;
  animEl(document.getElementById('mbox'), 'bounceIn');
}
function saveEditJ(i) { window.D.journal[i].text = document.getElementById('edit-j-txt').value.trim(); save(); clModal(); renderJEntries(); }
function delJEntry(i) {
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `<p>Supprimer ?</p><div style="display:flex;gap:6px;margin-top:10px"><button class="btn btn-s" onclick="clModal()" style="flex:1">Non</button><button class="btn btn-d" onclick="confirmDelJ(${i})" style="flex:1">Oui</button></div>`;
  animEl(document.getElementById('mbox'), 'bounceIn');
}
function confirmDelJ(i) { window.D.journal.splice(i, 1); save(); clModal(); renderJEntries(); updUI(); }

/* ============================================================
   PROGRESS
   ============================================================ */
function renderProg() {
  const D = window.D;
  const wd = getWkDates(wOff), wt = document.getElementById('w-title');
  if (!wt) return;
  if (wOff === 0) wt.textContent = 'Cette semaine';
  else { const a=new Date(wd[0]),b=new Date(wd[6]); wt.textContent=`${a.getDate()}/${a.getMonth()+1} — ${b.getDate()}/${b.getMonth()+1}`; }
  document.getElementById('w-view').innerHTML = wd.map(ds => {
    const l=D.log[ds]||[],r=l.length/6,isT=ds===today();
    let bg='var(--border)';
    if(r>.8)bg='var(--mint)';else if(r>.5)bg='var(--sky)';else if(r>0)bg='var(--peach)';
    return `<div class="cal-c" style="background:${bg};${isT?'border:2px solid var(--lilac)':''}">${new Date(ds+'T12:00').getDate()}</div>`;
  }).join('');
  const now = new Date(); now.setMonth(now.getMonth() + mOff);
  const y = now.getFullYear(), m = now.getMonth();
  document.getElementById('m-title').textContent = now.toLocaleDateString('fr-FR', {month:'long',year:'numeric'});
  const first=new Date(y,m,1), last=new Date(y,m+1,0), off=(first.getDay()+6)%7;
  let cells = '';
  for (let i=0;i<off;i++) cells += '<div class="cal-c"></div>';
  for (let d=1;d<=last.getDate();d++) {
    const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const l=D.log[ds]||[],r=l.length/6,isT=ds===today();
    let bg='rgba(204,196,216,.15)';
    if(r>.8)bg='var(--mint)';else if(r>.5)bg='var(--sky)';else if(r>0)bg='rgba(232,196,160,.3)';
    cells += `<div class="cal-c" style="background:${bg};${isT?'border:2px solid var(--lilac);font-weight:bold':''}">${d}</div>`;
  }
  document.getElementById('m-view').innerHTML = cells;
  updUI();
}

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
  const v = document.getElementById('pin-inp').value.trim();
  if (v.length === 4 && /^\d+$/.test(v)) { window.D.pin = v; save(); document.getElementById('pin-inp').value = ''; toast(`PIN mis à jour ✿`); }
  else toast(`4 chiffres requis`);
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

/* ============================================================
   TABLETTE RÉTRO
   ============================================================ */
let tabletSeen = 0; // nb d'entrées vues à la dernière ouverture

function openTablet() {
  const D = window.D;
  const log = D.eventLog || [];
  const icons = { xp:'⭐', cadeau:'🎁', note:'📓', habitude:'✅' };
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
        <span class="tl-icon">${icons[ev.type] || '•'}</span>${ev.label || ev.valeur}
      </div>`;
    }).join('');
  }

  // Masquer le badge
  tabletSeen = log.length;
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
  if (log.length > tabletSeen) {
    badge.style.display = 'block';
  }
}

/* ============================================================
   MODALE DE BIENVENUE
   ============================================================ */
function checkWelcome() {
  const D = window.D;
  const td = today();
  const h = hr();

  // Calcul jours d'absence
  let joursAbsence = 0;
  if (D.lastActive && D.lastActive !== td) {
    const diff = Date.now() - new Date(D.lastActive);
    joursAbsence = Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  // Cadeaux reçus depuis dernière visite
  const derniereVisite = D.lastActive || td;
  const nouveauxCadeaux = (D.eventLog || []).filter(ev =>
  ev.type === 'cadeau' && new Date(ev.date) > new Date(derniereVisite)
).length;

  // Mise à jour lastActive
  if (!D.firstLaunch) D.firstLaunch = new Date().toISOString();
  D.lastActive = new Date().toISOString(); // heure complète
  save();

  // Contenu selon contexte
  let titre, corps, extra = '';

  if (!D.firstLaunch || D.g.name === 'Petit·e Gotchi') {
    // Premier lancement
    showWelcomeModal();
    return;
  }

if (joursAbsence >= 3) {
    const xpPerdu = joursAbsence * 15;
    titre = `Ça fait ${joursAbsence} jours... 💜`;
    corps = `${D.g.name} t'a attendue. Tu as perdu <strong>${xpPerdu} XP</strong> pendant ton absence.`;
  } else if (joursAbsence === 1 && !(D.log[td] || []).length) {
    titre = `Bienvenue 🌸`;
    corps = `Tu as perdu <strong>15 XP</strong> hier — pas d'habitudes cochées.`;
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
  return `Coucou ${D.userName || 'toi'} ! Je t'attendais 🌸`;
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
  return `${done} habitude${done > 1 ? 's' : ''} aujourd'hui. C'est bien ✿ Pose-toi maintenant.`;
}

function getNightMsg() {
  const D = window.D;
  const done = (D.log[today()] || []).length;
  if (done === 6) return `*ronronne* Journée parfaite... dors bien 🌙`;
  if (done >= 3) return `*bâille* Bonne nuit ${D.userName || 'toi'}... à demain 💜`;
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
    'resetmsg': () => { D.thoughtCount = 0; D.lastThoughtDate = null; toast('💬 Quota messages → 0/3'); },
    'resetcaca':() => { D.g.poopCount = 0; D.g.poopDay = ''; D.g.poops = []; toast('💩 Quota caca remis à zéro'); },
    'nuit':   () => { window._forceHour = 23; toast('🌙 Heure forcée → 23h'); },
    'jour':   () => { window._forceHour = null; toast('☀️ Heure réelle restaurée'); },
    'resetpin': () => { D.pin = null; toast('🔓 Code PIN supprimé'); },
  };

  if (codes[code]) {
    codes[code]();
    save(); updUI();
  } else {
    toast('❓ Code inconnu');
  }
}

/* ============================================================
   INIT AU CHARGEMENT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  updUI();
  renderHabs();
  renderProps();
  restorePerso();
  initMoodPicker();
  checkWelcome();
  updBubbleNow();
});
