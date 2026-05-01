/* ============================================================
   ui-journal.js — Système journal (S6)
   RÔLE : PIN, humeurs, saisie, affichage et export du journal.
   Dépend de : app.js (window.D, save, today, getWeekId)
               ui-core.js (toast, toastModal, openModal, clModal,
                            chevron, chevronNav, escape,
                            lockScroll, unlockScroll, animEl)
   ============================================================

   CONTENU :
   §1  Variables module          — pinBuf, pinMode, MOODS, selMood, jWeekOff
   §2  renderPin()               — affiche le pavé numérique PIN
   §3  pinSubmit()               — vérifie le PIN saisi
   §4  unlockJ()                 — déverrouille le journal
   §5  renderJ()                 — rendu du panneau journal
   §6  initMoodPicker()          — initialise le picker d'humeur
   §7  pickM()                   — sélectionne une humeur
   §8  saveJ()                   — enregistre une note
   §9  navJWeek()                — navigation semaine journal
   §10 getWkDates()              — calcule les 7 dates d'une semaine (exposé sur window)
   §11 renderJEntries()          — rendu des entrées de la semaine
   §12 toggleJDay()              — déploie/replie un jour
   §13 editJEntry()              — ouvre la modale d'édition d'une entrée
   §14 saveEditJ()               — sauvegarde l'édition
   §15 confirmDelJ()             — supprime une entrée
   §16 exportJournal()           — export texte ou JSON du journal
   ============================================================ */

/* ============================================================
   PIN & JOURNAL
   ============================================================ */
// RÔLE : Verrou du journal — true = PIN requis pour accéder aux entrées.
// POURQUOI : Remis à true à chaque navigation vers l'onglet journal (go() dans ui-nav.js)
//            pour que le verrou se réengage dès qu'on quitte et revient.
//            Exposé sur window pour être accessible depuis ui-nav.js et ui-agenda.js
//            sans dépendance d'ordre de chargement. (remplace l'ancienne `let journalLocked`)
window.journalLocked = true;

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
  window.journalLocked = false; // POURQUOI : doit être visible par ui-nav.js qui le remet à true
  document.getElementById('pin-gate').style.display = 'none';
  document.getElementById('j-inner').style.display = 'block';
  renderJEntries();
  // RÔLE : Affiche une bulle d'accueil du pool "journal" à l'ouverture de la vue journal
  // POURQUOI : unlockJ() est le seul point d'entrée commun — appelé après validation du PIN
  //            ET appelé directement par renderJ() si le journal n'est pas verrouillé.
  //            Les 6 bulles du pool (user_config.json) ne s'affichaient jamais à l'ouverture.
  //            Délai 400ms pour laisser l'UI se monter avant l'animation de la bulle.
  setTimeout(() => {
    const srcJ  = window.PERSONALITY ? window.PERSONALITY.bulles : {};
    const poolJ = srcJ.journal?.length ? srcJ.journal : ["Je t'écoute ✿"];
    const idx   = Math.floor(Math.random() * poolJ.length);
    const bulle = poolJ[idx].replace('{{diminutif}}', D.g.userNickname || D.userName || 'toi');
    flashBubble(bulle, 3500);
  }, 400);
}
function renderJ() {
  if (!window.journalLocked) { document.getElementById('pin-gate').style.display='none'; document.getElementById('j-inner').style.display='block'; renderJEntries(); return; }
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
  window.D.journal.push({ date: new Date().toISOString(), mood: selMood, text: t });
  addXp(15);
  addEvent({ type: 'note', subtype: 'journal', valeur: XP_NOTE, label: `Note enregistrée  +${XP_NOTE} XP` });
  toast(`+${XP_NOTE} XP 📓`);
  save();
  document.getElementById('j-text').value = '';
  selMood = null;
  document.querySelectorAll('.mood-b').forEach(b => b.classList.remove('sel'));
  renderJEntries();
  // RÔLE : Affiche une bulle du pool "journal" après l'enregistrement d'une note
  // POURQUOI : Passe par flashBubble() pour l'animation et le timer (3s)
  //            L'écriture directe dans el.textContent figeait la bulle indéfiniment
  const srcJ  = window.PERSONALITY ? window.PERSONALITY.bulles : {};
  const poolJ = srcJ.journal?.length ? srcJ.journal : ["Je t'écoute ✿"];
  const idx   = Math.floor(Math.random() * poolJ.length);
  const bulle = poolJ[idx].replace('{{diminutif}}', D.g.userNickname || D.userName || 'toi');
  flashBubble(bulle, 3000);
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
  // ── Mise à jour du statut / fleurs de quota journal du jour
  const todayStr = today();
  const countToday = window.D.journal.filter(n => n.date.startsWith(todayStr)).length;
  const vStatus = document.getElementById('v-status');
  if (vStatus && !document.getElementById('j-text').value) {
    const reste = window.JOURNAL_MAX_PER_DAY - countToday;
    // RÔLE : Message de quota — remplacé visuellement par les fleurs, mais conservé en fallback texte
    vStatus.textContent = reste === 0 ? `Quota du jour atteint ✿ — à demain !` : '';
    vStatus.style.color = '#e07060';
  }
  // RÔLE : Synchroniser les fleurs de quota journal à chaque rendu
  updJournalFlowers();

  const D = window.D;
  const wd = getWkDates(jWeekOff);
  const wt = document.getElementById('j-week-title');
  const wc = document.getElementById('j-week-count'); // compteur de notes de la semaine

  // ── Titre de navigation semaine
  if (jWeekOff === 0) {
    if (wt) wt.textContent = 'Cette semaine';
  } else {
    const a = new Date(wd[0]), b = new Date(wd[6]);
    if (wt) wt.textContent = `${a.getDate()}/${a.getMonth()+1} — ${b.getDate()}/${b.getMonth()+1}`;
  }

  // ── Entrées de la semaine filtrées (du plus récent au plus ancien)
  const entries = D.journal.filter(j => wd.includes(j.date.split('T')[0])).reverse();

  // RÔLE : Afficher le nombre de notes de la semaine sous le titre de navigation
  if (wc) {
    wc.textContent = entries.length > 0 ? `${entries.length} note${entries.length > 1 ? 's' : ''} cette semaine` : '';
  }

  const c = document.getElementById('j-entries');
  const me = { super: '🌟', bien: '😊', ok: '😐', bof: '😔', dur: '🌧️' };
  if (!c) return;
  if (!entries.length) {
    c.innerHTML = '<p style="font-size:var(--fs-sm);color:#a09880;text-align:center">Aucune entrée</p>';
    return;
  }

  // RÔLE : Regrouper les entrées par jour dans un objet { dateKey → [entrées] }
  // POURQUOI : On génère ensuite un accordéon par jour — ouvert pour aujourd'hui, fermé pour les autres
  const groups = {}; // { "YYYY-MM-DD": [ { entry, globalIndex } ] }
  entries.forEach(e => {
    const dateKey = e.date.split('T')[0];
    const gi      = D.journal.indexOf(e);
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push({ e, gi });
  });

  // RÔLE : Générer le HTML de l'accordéon — un bloc par jour, avec header cliquable
  let html = '';
  Object.keys(groups).forEach(dateKey => {
    const group    = groups[dateKey];
    const estAujd  = dateKey === todayStr;
    const ouvert   = estAujd; // aujourd'hui ouvert par défaut, autres jours fermés
    const d0       = new Date(group[0].e.date);
    const labelDate = estAujd
      ? `Aujourd'hui`
      : d0.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const nb       = group.length;
    const nbLabel  = nb > 1 ? `${nb} notes` : `1 note`;

    // Header accordéon : label date + compteur + chevron
    html += `<div class="j-day-sep j-day-toggle" onclick="toggleJDay('${dateKey}')" style="cursor:pointer;user-select:none">
      <span style="flex:1;text-align:left;padding-left:2px">${labelDate}</span>
      <span style="font-size:10px;color:var(--text2);margin-right:4px">${nbLabel}</span>
      <span id="j-chv-${dateKey}" style="display:flex;align-items:center">${chevron(ouvert ? 'down' : 'up')}</span>
    </div>`;

    // Groupe d'entrées — masqué par défaut sauf aujourd'hui
    html += `<div id="j-group-${dateKey}" style="display:${ouvert ? 'block' : 'none'}">`;
    group.forEach(({ e, gi }) => {
      const d = new Date(e.date);
      html += `<div class="j-entry mood-${e.mood || 'ok'}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="j-date">${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
          <span style="font-size:16px">${me[e.mood] || '😐'}</span>
        </div>
        <div class="j-text-content" style="font-size:var(--fs-sm);margin-top:3px">${e.text || '—'}</div>
        <div class="j-actions">
          <button onclick="editJEntry(${gi})">✏️</button>
          <button onclick="delJEntry(${gi})">🗑️</button>
        </div>
      </div>`;
    });
    html += `</div>`; // fin j-group
  });
  c.innerHTML = html;
}
// RÔLE : Ouvre ou ferme un groupe de notes dans l'accordéon du journal
// POURQUOI : Appelé au clic sur le header de date — bascule display et tourne le chevron
function toggleJDay(dateKey) {
  const group = document.getElementById(`j-group-${dateKey}`);
  const chv   = document.getElementById(`j-chv-${dateKey}`);
  if (!group || !chv) return;
  const ouvert = group.style.display !== 'none';
  group.style.display = ouvert ? 'none' : 'block';
  // ouvert → on va fermer → montrer 'up' (replié) ; fermé → on va ouvrir → montrer 'down' (déplié)
  chv.innerHTML = chevron(ouvert ? 'up' : 'down');
}

function editJEntry(i) {
  const e = window.D.journal[i]; if (!e) return;
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `
  <h3>Modifier</h3>
  <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-bottom:var(--sp-sm)" id="edit-mood-pick">
    ${MOODS.map(m => `<button class="mood-b${e.mood===m.id?' sel':''}" data-m="${m.id}" onclick="this.parentNode.querySelectorAll('.mood-b').forEach(b=>b.classList.toggle('sel',b===this));window._editMood='${m.id}'">${m.e}</button>`).join('')}
  </div>
  <textarea id="edit-j-txt" class="inp" rows="5" style="font-size:12px">${escape(e.text||'')}</textarea>
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
}

function delJEntry(i) {
  openModal(`<p>Supprimer ?</p><div style="display:flex;gap:6px;margin-top:10px"><button class="btn btn-s" onclick="clModal()" style="flex:1">Non</button><button class="btn btn-d" onclick="confirmDelJ(${i})" style="flex:1">Oui</button></div>`);
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

