/* ============================================================
   ui-agenda.js — Agenda RDV, vues jour/mois/cycle (S6)
   RÔLE : Gestion complète de l'agenda : rendez-vous ponctuels
          et récurrents, cycle menstruel, vues jour/mois/cycle.
   Dépend de : app.js (window.D, save, today, getCyclePhase)
               ui-core.js (toast, toastModal, openModal, clModal,
                            chevron, chevronNav, escape,
                            lockScroll, unlockScroll, showCycle, showRDV)
               ui-journal.js (ouvrirJournalAuJour — depuis agenda)
   ============================================================

   CONTENU :
   §1  Variables module          — window._agendaJour, _agendaMoisOffset
   §2  ouvrirAgenda()            — ouvre la modale agenda
   §3  fermerAgenda()            — ferme la modale agenda
   §4  switchAgenda()            — navigation onglets jour/mois/cycle
   §5  getRdvDuJour()            — liste les RDV d'un jour
   §6  renderAgendaJour()        — rendu vue journalière
   §7  navAgendaJour()           — navigation jour précédent/suivant
   §8  afficherFormulaireRdv()   — formulaire création RDV
   §9  selectionnerEmoji()       — choix emoji RDV
   §10 selectionnerRecurrence()  — choix récurrence
   §11 selectionnerDuree()       — choix durée
   §12 annulerFormulaireRdv()    — annule le formulaire
   §13 sauvegarderRdv()          — sauvegarde un RDV
   §14 toggleJourneeEntiere()    — bascule journée entière
   §15 supprimerRdv()            — déclenche suppression RDV
   §16 confirmerSuppressionRdv() — confirmation suppression
   §17 supprimerRdvSuivants()    — supprime les occurrences suivantes
   §18 confirmerSuppressionCycle() — confirmation suppression cycle
   §19 fermerConfirmInline()     — ferme la confirmation inline
   §20 editerRdv()               — ouvre édition RDV
   §21 confirmerEditRdv()        — valide l'édition
   §22 declarerRegles()          — déclare J1 du cycle
   §23 ouvrirJournalAuJour()     — lien vers journal au jour cliqué
   §24 revenirAujourdhuiMois()   — reset offset mois
   §25 renderAgendaMois()        — rendu vue mensuelle
   §26 navAgendaMois()           — navigation mois
   §27 clickJourMois()           — clic sur un jour en vue mois
   §28 renderAgendaCycle()       — rendu vue cycle menstruel
   §29 toggleAccordeon()         — accordéon générique
   §30 toggleJ1Liste()           — déploie/replie la liste J1
   §31 modifierCycle()           — modifie une date de cycle
   §32 declarerReglesCycle()     — déclare règles depuis input
   §33 supprimerCycle()          — supprime une entrée cycle
   §34 copierCycles()            — copie l'historique des cycles
   ============================================================ */

/* ============================================================
   MODALE AGENDA
   ============================================================ */

window._agendaJour = null;

function ouvrirAgenda(dateStr) {
  window._agendaJour = dateStr || today();
  _fermerMenuSiOuvert(); // ferme le menu-overlay s'il était ouvert

  const mbox = document.getElementById('mbox');
  const modal = document.getElementById('modal');

  // 1. Nettoie les classes d'un éventuel précédent affichage
  mbox.classList.remove('shop-open', 'shop-catalogue', 'agenda-open');

  // 2. Prépare le contenu
mbox.innerHTML = `
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
    <h2 style="color:var(--text)">🗓️ Mon Agenda</h2>
      <button onclick="fermerAgenda()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text2);min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;border-radius:50%;flex-shrink:0">✕</button>
  </div>
  <div style="display:flex;gap:6px;margin-bottom:14px;background:rgba(0,0,0,0.05);border-radius:20px;padding:3px">
    <button onclick="switchAgenda('jour')" id="atab-jour"
      style="flex:1;padding:7px;border-radius:999px;border:none;font-size:var(--fs-sm);
      cursor:pointer;font-weight:bold;font-family:var(--font-body);transition:.15s">
      📅 Jour
    </button>
    <button onclick="switchAgenda('mois')" id="atab-mois"
      style="flex:1;padding:7px;border-radius:999px;border:none;font-size:var(--fs-sm);
      cursor:pointer;font-weight:bold;font-family:var(--font-body);transition:.15s">
      🗓️ Mois
    </button>
    ${showCycle() ? `
    <button onclick="switchAgenda('cycle')" id="atab-cycle"
      style="flex:1;padding:7px;border-radius:999px;border:none;font-size:var(--fs-sm);
      cursor:pointer;font-weight:bold;font-family:var(--font-body);transition:.15s">
      🌸 Cycle
    </button>` : ''}
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
  // POURQUOI : On passe par clModal() qui appelle unlockScroll() — pas de manipulation directe.
  clModal();
}

// chevron() et chevronNav() sont définis en §2 (utilitaires) — déplacés pour être disponibles partout.

function switchAgenda(onglet) {
  ['jour','mois', ...(showCycle() ? ['cycle'] : [])].forEach(o => {
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
    if (!r.recurrence || r.recurrence === 'aucune') {
      return r.date === ds;
    }
    if (ds < r.date) return false;
    if (r.exceptions && r.exceptions.includes(ds)) return false; // ← ajouté
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
    ? `<div style="display:inline-block;padding:4px 10px;border-radius:20px;font-size:var(--fs-sm);
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
          ? `<div style="padding:var(--sp-sm) 10px;border-radius:var(--r-sm);font-size:var(--fs-sm);
              background:rgba(255,255,255,0.7);border:1px solid var(--border);
              margin-bottom:5px">✅ ${hab.label}</div>`
          : '';
      }).join('')
    : `<div style="font-size:var(--fs-sm);color:var(--text2);font-style:italic;padding:6px 0">Aucune habitude ce jour</div>`;

  // Note journal
  const note = (D.journal || []).find(n => n.date && n.date.startsWith(ds));
  const noteHtml = note
    ? `<button onclick="ouvrirJournalAuJour('${ds}')"
        style="width:100%;text-align:left;padding:10px 12px;border-radius:var(--r-md);
        border:1.5px solid var(--lilac);background:rgba(var(--lilac-rgb, 180,160,230),0.07);
        font-size:var(--fs-sm);cursor:pointer;color:var(--lilac);font-family:var(--font-body);
        display:flex;align-items:center;justify-content:space-between">
        <span>📓 Voir la note du journal</span>
        <span style="opacity:.6">→</span>
       </button>`
    : `<div style="font-size:var(--fs-sm);color:var(--text2);font-style:italic;padding:6px 0">Aucune note ce jour</div>`;

  // Rendez-vous
  const rdvDuJour = getRdvDuJour(ds).sort((a,b) => (a.heure||'') > (b.heure||'') ? 1 : -1);
  const rdvHtml = rdvDuJour.map(r => `
    <div id="rdv-item-${r.id}" style="display:flex;align-items:center;justify-content:space-between;
      padding:var(--sp-sm) 10px;border-radius:var(--r-sm);background:#fff;
      border:1px solid var(--border);margin-bottom:5px">
      <span style="font-size:var(--fs-sm);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px;display:inline-block">${r.heure ? `<b>${escape(r.heure)}</b> · ` : '🗓️ Journée · '}${escape(r.label)}</span>
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
        ${chevronNav('left')}
      </button>
      <span style="font-size:var(--fs-lg);font-weight:bold;font-family:var(--font-body);
        text-align:center;color:var(--lilac);flex:1;line-height:1.2">
        ${titre}
      </span>
      <button onclick="navAgendaJour(1)"
        style="background:none;border:none;cursor:pointer;padding:4px;display:flex;align-items:center">
        ${chevronNav('right')}
      </button>
    </div>

    ${phaseHtml}

    <!-- Habitudes -->
    <div style="margin-bottom:16px">
      <h3 style="font-size:var(--fs-sm);color:var(--text2);letter-spacing:1.5px;margin-bottom:var(--sp-sm);text-transform:uppercase">Habitudes</h3>
      ${habsHtml}
    </div>

    <!-- Séparateur Habitudes / Journal -->
    <hr style="border:none;border-top:1px solid var(--border);margin:0 0 16px 0;opacity:0.6">

    <!-- Note journal -->
    <div style="margin-bottom:16px">
      <h3 style="font-size:var(--fs-sm);color:var(--text2);letter-spacing:1.5px;margin-bottom:var(--sp-sm);text-transform:uppercase">Journal</h3>
      ${noteHtml}
    </div>

    <!-- Séparateur Journal / Rendez-vous -->
    <hr style="border:none;border-top:1px solid var(--border);margin:0 0 16px 0;opacity:0.6">

    <!-- Rendez-vous -->
    <div style="margin-bottom:var(--sp-md)">
      <h3 style="font-size:var(--fs-sm);color:var(--text2);letter-spacing:1.5px;margin-bottom:var(--sp-sm);text-transform:uppercase">Rendez-vous</h3>
      ${rdvHtml}
      <button onclick="afficherFormulaireRdv()" id="btn-add-rdv"
        style="width:100%;padding:9px;border-radius:var(--r-md);
        border:1.5px solid var(--lilac);background:transparent;
        font-size:var(--fs-sm);cursor:pointer;color:var(--lilac);
        font-family:var(--font-body);margin-top:4px;
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

  // 🔁 Synchro vue Mois
  const now = new Date();
  _agendaMoisOffset = (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());

  renderAgendaJour(document.getElementById('agenda-contenu'));
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
      background:var(--bg,#fff);border-radius:var(--r-lg) 16px 0 0;
      padding:20px 16px 32px;width:100%;max-width:420px;
      animation:slideUp .25s ease-out;
    ">
      <div style="width:36px;height:4px;background:var(--border);
        border-radius:2px;margin:0 auto 16px;opacity:.5"></div>
      <h3 style="font-size:12px;color:var(--lilac);margin-bottom:14px;
        font-family:var(--font-body)">📅 Nouveau rendez-vous</h3>

      <!-- Emojis sur 2 lignes -->
      <div style="display:grid;grid-template-columns:repeat(9,1fr);gap:5px;margin-bottom:var(--sp-md)">
        ${emojis.map(({e,l}) => `
          <button onclick="selectionnerEmoji('${e}', this)"
            title="${l}"
            style="aspect-ratio:1;border-radius:var(--r-sm);border:1.5px solid var(--border);
            background:#fff;font-size:15px;cursor:pointer;transition:.15s;
            display:flex;align-items:center;justify-content:center"
            data-emoji="${e}">${e}</button>
        `).join('')}
      </div>

      <!-- Label -->
      <input id="rdv-label" class="inp" placeholder="Libellé du rendez-vous..." style="margin-bottom:var(--sp-sm)">

      <!-- Heure -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:var(--sp-sm)">
        <input type="time" id="rdv-heure" class="inp" style="flex:1">
        <label style="display:flex;align-items:center;gap:4px;font-size:var(--fs-sm);
          color:var(--text2);white-space:nowrap;cursor:pointer">
          <input type="checkbox" id="rdv-journee" onchange="toggleJourneeEntiere(this.checked)">
          Journée entière
        </label>
      </div>

<!-- Récurrence -->
<div style="margin-bottom:var(--sp-sm)">
  <div style="font-size:var(--fs-sm);color:var(--text2);letter-spacing:1px;
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
        style="flex:1;padding:7px;border-radius:var(--r-sm);font-size:var(--fs-sm);
        font-family:var(--font-body);cursor:pointer;transition:.15s;
        border:1.5px solid var(--border);background:#fff;color:var(--text2)">
        ${r.l}
      </button>
    `).join('')}
  </div>
</div>

      <!-- Durée (masquée si aucune récurrence) -->
      <div id="rdv-duree-wrap" style="display:none;margin-bottom:14px">
        <div style="font-size:var(--fs-sm);color:var(--text2);letter-spacing:1px;
          text-transform:uppercase;margin-bottom:6px">Pendant</div>
        <div style="display:flex;gap:6px">
          ${[
{l:'Sans fin', v:'infini'},
{l:'3 mois',  v:'3'},
{l:'6 mois',  v:'6'},
{l:'1 an',    v:'12'},
{l:'2 ans',   v:'24'}
          ].map(d => `
            <button onclick="selectionnerDuree('${d.v}', this)"
              data-duree="${d.v}"
              style="flex:1;padding:7px;border-radius:var(--r-sm);font-size:var(--fs-sm);
              font-family:var(--font-body);cursor:pointer;transition:.15s;
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
  const labelInput = document.getElementById('rdv-label');
  const label      = labelInput.value.trim();
  if (!label) {
    // RÔLE : Signale visuellement que le champ titre est obligatoire
    labelInput.style.borderColor = 'var(--coral)';
    labelInput.placeholder = 'Obligatoire ✦';
    labelInput.focus();
    // POURQUOI : reset après 2s pour ne pas laisser l'erreur affichée indéfiniment
    setTimeout(() => {
      labelInput.style.borderColor = '';
      labelInput.placeholder = 'Libellé du rendez-vous...';
    }, 2000);
    return;
  }
  // POURQUOI : reset la bordure si la validation passe après une erreur
  labelInput.style.borderColor = '';
  const heure      = document.getElementById('rdv-heure').value || null;
  const emoji      = window._rdvEmoji || null;
  const recurrence = window._rdvRecurrence || 'aucune';
  const dureeBrute = window._rdvDuree;

  let duree = null;
  if (dureeBrute && dureeBrute !== 'infini') {
    const fin = new Date(_agendaJour + 'T12:00');
    console.log('agendaJour:', _agendaJour, '| fin valide?', !isNaN(fin), '| dureeBrute:', dureeBrute, '| parseInt:', parseInt(dureeBrute));
    fin.setMonth(fin.getMonth() + parseInt(dureeBrute));
    duree = fin.toISOString().split('T')[0];
  }

  const labelFinal = (emoji ? `${emoji} ${label}` : label).slice(0, 40);

  window.D.rdv = window.D.rdv || [];
  window.D.rdv.push({
    id: Date.now().toString(),
    date: _agendaJour,
    label: labelFinal,
    heure,
    recurrence,
    duree
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

function supprimerRdv(id) {
  window.D.rdv = (window.D.rdv || []).filter(r => r.id !== id);
  save();
  renderAgendaJour(document.getElementById('agenda-contenu'));
}

function confirmerSuppressionRdv(id) {
  // RÔLE : Ferme une confirmation déjà ouverte avant d'en ouvrir une nouvelle
  document.getElementById('confirm-inline')?.remove();

  const rdv = (window.D.rdv || []).find(r => r.id === id);
  if (!rdv) return;
  const isRecurrent = rdv.recurrence && rdv.recurrence !== 'aucune';

  // RÔLE : Insère la confirmation juste sous le bloc du RDV concerné
  // POURQUOI : insertAdjacentHTML afterend = juste après l'élément, pas en haut de la liste
  const anchor = document.getElementById(`rdv-item-${id}`);
  const target = anchor || document.getElementById('agenda-contenu');
  const method = anchor ? 'afterend' : 'afterbegin';

  target.insertAdjacentHTML(method, `
    <div id="confirm-inline" style="background:#fff8f8;border:2px solid var(--coral);
      border-radius:var(--r-md);padding:10px;margin-bottom:6px;text-align:center">
      <div style="font-size:var(--fs-sm);margin-bottom:var(--sp-sm)">
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

function confirmerSuppressionCycle(ds, btn) {
  // RÔLE : Ferme une confirmation déjà ouverte avant d'en ouvrir une nouvelle
  document.getElementById('confirm-inline')?.remove();

  const date = new Date(ds + 'T12:00');
  const fmt  = date.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });

  // RÔLE : Insère la confirmation juste sous la ligne du cycle concerné
  // POURQUOI : on remonte au parent de la ligne (.j1-ligne) via closest ou parentElement
  const anchor = btn?.closest('[style*="border-bottom"]') || btn?.parentElement?.parentElement;
  const target = anchor || document.getElementById('agenda-contenu');
  const method = anchor ? 'afterend' : 'afterbegin';

  target.insertAdjacentHTML(method, `
    <div id="confirm-inline" style="background:#fff8f8;border:2px solid var(--coral);
      border-radius:var(--r-md);padding:10px;margin-bottom:6px;text-align:center">
      <div style="font-size:var(--fs-sm);margin-bottom:var(--sp-sm)">
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

  const isRecurrent = rdv.recurrence && rdv.recurrence !== 'aucune';
  window._editRdvId = id;

  const overlay = document.createElement('div');
  overlay.id = 'rdv-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:1000;
    background:rgba(0,0,0,0.35);
    display:flex;align-items:flex-end;justify-content:center;
  `;

  overlay.innerHTML = `
    <div id="rdv-sheet" style="
      background:var(--bg,#fff);border-radius:var(--r-lg) 16px 0 0;
      padding:20px 16px 32px;width:100%;max-width:420px;
      animation:slideUp .25s ease-out;
    ">
      <div style="width:36px;height:4px;background:var(--border);
        border-radius:2px;margin:0 auto 16px;opacity:.5"></div>
      <h3 style="font-size:12px;color:var(--lilac);margin-bottom:14px;
        font-family:var(--font-body)">✏️ Modifier le rendez-vous</h3>

      <input id="rdv-label" class="inp"
        value="${rdv.label}"
        placeholder="Libellé..." style="margin-bottom:var(--sp-sm)">

      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
        <input type="time" id="rdv-heure" class="inp"
          value="${rdv.heure || ''}" style="flex:1">
        <label style="display:flex;align-items:center;gap:4px;font-size:var(--fs-sm);
          color:var(--text2);white-space:nowrap;cursor:pointer">
          <input type="checkbox" id="rdv-journee"
            ${!rdv.heure ? 'checked' : ''}
            onchange="toggleJourneeEntiere(this.checked)">
          Journée entière
        </label>
      </div>

      <div style="display:flex;gap:8px">
        <button class="btn btn-s" onclick="annulerFormulaireRdv()" style="flex:1">Annuler</button>
        ${isRecurrent ? `
          <button class="btn btn-p" onclick="confirmerEditRdv('ce')" style="flex:1">
            Ce rendez-vous
          </button>
          <button class="btn btn-p" onclick="confirmerEditRdv('suivants')" style="flex:1">
            Celui-ci et les suivants
          </button>
        ` : `
          <button class="btn btn-p" onclick="confirmerEditRdv('simple')" style="flex:1">
            Enregistrer
          </button>
        `}
      </div>
    </div>
  `;

  overlay.addEventListener('click', e => {
    if (e.target === overlay) annulerFormulaireRdv();
  });

  document.body.appendChild(overlay);

  // Initialise l'état journée entière
  if (!rdv.heure) toggleJourneeEntiere(true);
}

function confirmerEditRdv(mode) {
  const label = document.getElementById('rdv-label').value.trim();
  if (!label) return;
  const heure = document.getElementById('rdv-heure').value || null;
  const id    = window._editRdvId;
  const rdv   = (window.D.rdv || []).find(r => r.id === id);
  if (!rdv) return;

  if (mode === 'simple') {
    // RDV ponctuel — modifie directement
    rdv.label = label;
    rdv.heure = heure;

  } else if (mode === 'ce') {
    // Crée une exception pour ce jour uniquement
    window.D.rdv.push({
      id: Date.now().toString(),
      date: _agendaJour,
      label, heure,
      recurrence: 'aucune'
    });
    // Ajoute ce jour dans les exceptions de l'entrée maîtresse
    rdv.exceptions = rdv.exceptions || [];
    rdv.exceptions.push(_agendaJour);

  } else if (mode === 'suivants') {
    // Coupe la récurrence d'origine à la veille
    const veille = new Date(_agendaJour + 'T12:00');
    veille.setDate(veille.getDate() - 1);
    rdv.duree = veille.toISOString().split('T')[0];

    // Crée une nouvelle récurrence à partir d'aujourd'hui
    window.D.rdv.push({
      id: Date.now().toString(),
      date: _agendaJour,
      label, heure,
      recurrence: rdv.recurrence,
      duree: rdv.duree_originale || null // hérite la durée d'origine si elle existe
    });
  }

  window._editRdvId = null;
  save();
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

function revenirAujourdhuiMois() {
  _agendaMoisOffset = 0;
  renderAgendaMois(document.getElementById('agenda-contenu'));
}

function renderAgendaMois(el) {
  const D      = window.D;
  const now    = new Date();
  const annee  = new Date(now.getFullYear(), now.getMonth() + _agendaMoisOffset, 1);
  const moisNom = annee.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const premierJour = new Date(annee.getFullYear(), annee.getMonth(), 1);
  const nbJours     = new Date(annee.getFullYear(), annee.getMonth() + 1, 0).getDate();

  let depart = premierJour.getDay() - 1;
  if (depart < 0) depart = 6;

  const cycleEntries = D.cycle || [];
  const duree        = D.g.cycleDuree || 28;

  const j1Dates = cycleEntries
    .filter(e => e.type === 'regles')
    .map(e => e.date)
    .sort().reverse();

  // En-têtes jours
  let cells = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-top:8px">';
  ['L','M','M','J','V','S','D'].forEach(j => {
    cells += `<div style="text-align:center;font-size:var(--fs-xs);color:var(--text2);
      padding:3px 0;font-weight:bold">${j}</div>`;
  });

  // Cases vides
  for (let i = 0; i < depart; i++) cells += '<div></div>';

  for (let d = 1; d <= nbJours; d++) {
    const ds = `${annee.getFullYear()}-${String(annee.getMonth()+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const estAujourd = ds === today();
    const log   = D.log[ds] || [];
    const total = D.habits.length;
    const pct   = total > 0 ? log.length / total : 0;

    const g       = Math.round(180 + pct * 60);
    const alpha   = pct > 0 ? 0.15 + pct * 0.6 : 0;
    const bgColor = pct > 0 ? `rgba(80,${g},120,${alpha})` : 'rgba(0,0,0,0.03)';

    // Cycle
    const estJ1     = j1Dates.includes(ds);
    let   estOvul   = false;
    let   estPredic = false;
    j1Dates.forEach(j1 => {
      const diff = Math.round((new Date(ds+'T12:00') - new Date(j1+'T12:00')) / 86400000);
      if (diff >= 12 && diff <= 16) estOvul   = true;
      if (diff >= 25 && diff <= 30) estPredic = true;
    });

    // ← RDV via getRdvDuJour (récurrents inclus)
    const rdvDuJour = getRdvDuJour(ds);
    const aNote     = (D.journal || []).some(n => n.date && n.date.startsWith(ds));

    // Emoji à afficher : premier emoji trouvé dans le label, sinon 📌
    let rdvEmoji = '';
    if (rdvDuJour.length) {
      const match = rdvDuJour[0].label.match(/^\p{Emoji}/u);
      rdvEmoji = match ? match[0] : '📌';
      // Si plusieurs RDV, affiche un + discret
      if (rdvDuJour.length > 1) rdvEmoji += `<span style="font-size:7px;vertical-align:super">+${rdvDuJour.length - 1}</span>`;
    }

    const border = estAujourd ? '2px solid var(--lilac)' : '1px solid transparent';

    cells += `
      <button onclick="clickJourMois('${ds}')"
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

        <span style="font-size:var(--fs-sm);font-weight:${estAujourd?'bold':'normal'};
          color:${estAujourd?'var(--lilac)':'var(--text)'};margin-top:2px">${d}</span>

        <div style="display:flex;gap:1px;font-size:var(--fs-xs);line-height:1;margin-bottom:1px">
          ${rdvEmoji}
          ${aNote ? '📓' : ''}
        </div>
      </button>`;
  }

  cells += '</div>';

el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <button onclick="navAgendaMois(-1)"
        style="background:none;border:none;cursor:pointer;padding:4px;display:flex;align-items:center">
        ${chevronNav('left')}
      </button>
      <div style="display:flex;flex-direction:column;align-items:center;flex:1;gap:4px">
        <span style="font-size:var(--fs-lg);font-weight:bold;font-family:var(--font-body);
          text-transform:capitalize;text-align:center;color:var(--lilac);line-height:1.2">
          ${moisNom}
        </span>
        ${_agendaMoisOffset !== 0 ? `
          <button onclick="revenirAujourdhuiMois()"
            style="padding:2px 12px;border-radius:var(--r-md);border:none;
            background:var(--lilac);color:#fff;font-size:var(--fs-xs);cursor:pointer;
            font-family:var(--font-body);font-weight:bold">
            ↩ Aujourd'hui
          </button>` : ''}
      </div>
      <button onclick="navAgendaMois(1)"
        style="background:none;border:none;cursor:pointer;padding:4px;display:flex;align-items:center">
        ${chevronNav('right')}
      </button>
    </div>

    ${cells}

    <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:6px 20px;
      margin-top:14px;padding:10px 14px;border-radius:var(--r-md);
      background:rgba(0,0,0,0.03);border:1px solid rgba(0,0,0,0.05)">
      <div style="display:flex;align-items:center;gap:6px;font-size:var(--fs-sm);color:var(--text2)">
        <span style="display:inline-block;width:24px;height:8px;border-radius:3px;flex-shrink:0;
          background:linear-gradient(to right,rgba(80,180,120,0.1),rgba(80,180,120,0.85))"></span>
        Habitudes
      </div>
      <div style="display:flex;align-items:center;gap:6px;font-size:var(--fs-sm);color:var(--text2)">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;flex-shrink:0;
          background:#e07080"></span>
        Règles (J1)
      </div>
      <div style="display:flex;align-items:center;gap:6px;font-size:var(--fs-sm);color:var(--text2)">
        <span style="display:inline-block;width:8px;height:8px;border-radius:3px;flex-shrink:0;
          border:1.5px solid #80b8e0"></span>
        Ovulation
      </div>
      <div style="display:flex;align-items:center;gap:6px;font-size:var(--fs-sm);color:var(--text2)">
        <span style="display:inline-block;width:8px;height:8px;border-radius:3px;flex-shrink:0;
          border:1px dashed #e07080"></span>
        Prédiction
      </div>
    </div>
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

  // Durée moyenne sur TOUS les cycles connus (plus fiable que juste les 2 derniers)
  let duree = D.g.cycleDuree || 28;
  if (cycles.length >= 2) {
    let total = 0;
    for (let i = 0; i < cycles.length - 1; i++) {
      total += Math.round(
        (new Date(cycles[i] + 'T12:00') - new Date(cycles[i+1] + 'T12:00')) / 86400000
      );
    }
    duree = Math.round(total / (cycles.length - 1));
  }

  const phaseAujourd = getCyclePhase(today());
  const aDesDonnees  = cycles.length >= 1;

  // ── Détection nudge : phase menstruelle probable mais pas de J1 récent ──
  // On affiche le nudge si : phase détectée = menstruelle ET le dernier J1
  // date de plus de (duree - 3) jours (= on est probablement dans un nouveau cycle)
  let afficherNudge = false;
  if (phaseAujourd?.phase === 'menstruelle' && aDesDonnees) {
    const dernierJ1  = new Date(cycles[0] + 'T12:00');
    const joursDepuis = Math.round((new Date(today() + 'T12:00') - dernierJ1) / 86400000);
    afficherNudge = joursDepuis > (duree - 3);
  }

const descriptions = {
  menstruelle:  'Ton corps fait un gros travail en ce moment. C\'est une période pour ralentir sans culpabilité — le repos est productif lui aussi.',
  folliculaire: 'L\'énergie revient doucement. Ta tête est plus disponible, c\'est souvent le bon moment pour reprendre des projets en attente ou en lancer de nouveaux.',
  ovulation:    'Tu es probablement à un pic d\'énergie et de clarté. Profites-en pour les tâches qui demandent de la concentration ou du lien avec les autres.',
  lutéale:      'Le corps commence à se préparer. La fatigue, l\'irritabilité ou la sensibilité émotionnelle qui arrivent parfois — c\'est physiologique, pas un problème à corriger.'
};

  // ── Hero card ──
  let heroHtml;
  if (phaseAujourd && aDesDonnees) {
    const nudgeHtml = afficherNudge ? `
      <div onclick="toggleAccordeon('acc-saisie')"
        style="margin-top:10px;padding:var(--sp-sm) 12px;border-radius:var(--r-sm);
        background:rgba(255,255,255,0.35);cursor:pointer;
        display:flex;align-items:center;gap:8px">
        <span style="font-size:14px">🩸</span>
        <span style="font-size:var(--fs-sm);color:${phaseAujourd.couleur};font-weight:bold;line-height:1.3">
          Tu as tes règles en ce moment ?<br>
          <span style="font-weight:normal;color:var(--text)">Pense à enregistrer ton J1 ↓</span>
        </span>
      </div>` : '';

    heroHtml = `
      <div style="padding:16px;border-radius:14px;margin-bottom:14px;
        background:${phaseAujourd.couleur}20;border:1px solid ${phaseAujourd.couleur}44">
        <div style="font-size:13px;font-weight:bold;color:${phaseAujourd.couleur};margin-bottom:6px">
          ${phaseAujourd.label} · Jour ${phaseAujourd.j}
        </div>
        <div style="font-size:var(--fs-sm);color:var(--text);line-height:1.6">
          ${descriptions[phaseAujourd.phase]}
        </div>
        ${nudgeHtml}
      </div>`;
  } else {
    // Pas de données — état d'accueil bienveillant
    heroHtml = `
      <div style="padding:16px;border-radius:14px;margin-bottom:14px;
        background:var(--card);border:1px dashed var(--border);text-align:center">
        <div style="font-size:22px;margin-bottom:var(--sp-sm)">🌙</div>
        <div style="font-size:12px;font-weight:bold;color:var(--text);margin-bottom:6px">
          Commence à suivre ton cycle
        </div>
        <div style="font-size:var(--fs-sm);color:var(--text2);line-height:1.5">
          Enregistre ton premier jour de règles ci-dessous.<br>
          L'app calculera ta phase au fil du temps.
        </div>
      </div>`;
  }

  // ── Frise compacte (sans labels dessous) ──
  const phases = [
    { id: 'menstruelle',  label: 'Règles',      jours: '1–5',          pct: 5/duree,           couleur: '#e07080' },
    { id: 'folliculaire', label: 'Folliculaire', jours: '6–13',         pct: 8/duree,           couleur: '#80b8e0' },
    { id: 'ovulation',    label: 'Ovulation',    jours: '14–16',        pct: 3/duree,           couleur: '#60c8a0' },
    { id: 'lutéale',      label: 'Lutéale',      jours: '17–'+duree,    pct: (duree-16)/duree,  couleur: '#b090d0' },
  ];

  let friseHtml = '';
  if (aDesDonnees) {
    friseHtml = `
      <div style="margin-bottom:14px">
        <div style="border-radius:var(--r-md);overflow:hidden;display:flex;height:24px">
          ${phases.map(p => {
            const isActive = phaseAujourd?.phase === p.id;
            return `<div title="${p.label} (J${p.jours})"
              style="flex:${p.pct};background:${p.couleur}${isActive ? '' : '55'};
              display:flex;align-items:center;justify-content:center;
              font-size:var(--fs-xs);color:#fff;font-weight:bold;transition:background .3s">
              ${isActive ? '▼' : ''}
            </div>`;
          }).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:4px;padding:0 2px">
          <span style="font-size:var(--fs-xs);color:var(--text2)">J1</span>
          <span style="font-size:var(--fs-xs);color:var(--text2)">J${duree}</span>
        </div>
      </div>`;
  }

  // ── Accordéon saisie ──
  const saisieHtml = `
    <div style="margin-bottom:var(--sp-sm);border-radius:var(--r-md);overflow:hidden;
      border:1px solid var(--border)">
      <button onclick="toggleAccordeon('acc-saisie')"
        style="width:100%;padding:var(--sp-md) 14px;background:var(--card);border:none;
        cursor:pointer;display:flex;align-items:center;justify-content:space-between;
        font-family:var(--font-body);font-size:var(--fs-sm);color:var(--text)">
        <span>🩸 Déclarer un début de cycle</span>
        <span id="acc-saisie-chevron" style="display:flex;transition:transform .2s">${chevron('down')}</span>
      </button>
      <div id="acc-saisie" style="max-height:0;overflow:hidden;transition:max-height .3s ease">
        <div style="padding:var(--sp-md) 14px;border-top:1px solid var(--border)">
          <div style="display:flex;gap:6px;align-items:center">
            <input type="date" id="cycle-date-input" class="inp"
              value="${today()}" style="flex:1">
            <button class="btn btn-p" onclick="declarerReglesCycle()"
              style="white-space:nowrap;font-size:var(--fs-sm)">
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>`;

  // ── Accordéon historique ──
  let historiqueContenu = `
    <div style="font-size:var(--fs-sm);color:var(--text2);font-style:italic;padding:var(--sp-md) 14px">
      Aucun cycle enregistré pour l'instant.
    </div>`;

  if (aDesDonnees) {
    const MAX_VISIBLE = 3;

const lignesJ1 = cycles.map((ds, i) => {
  const d     = new Date(ds + 'T12:00');
  const fmt   = `${d.getDate()} ${d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
  const cache = i >= MAX_VISIBLE;
  return `
    <div class="j1-ligne" style="display:${cache ? 'none' : 'flex'};align-items:center;
      justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:var(--fs-sm);color:var(--text)">🩸 ${fmt}</span>
      <div style="display:flex;gap:4px">
        <button onclick="confirmerSuppressionCycle('${ds}', this)"
          style="background:none;border:none;cursor:pointer;font-size:13px">🗑️</button>
      </div>
    </div>`;
}).join('');

    const voirToutBtn = cycles.length > MAX_VISIBLE ? `
      <button onclick="toggleJ1Liste()" id="btn-voir-tout-j1"
        style="width:100%;margin-top:6px;padding:6px;border-radius:var(--r-sm);
        border:1px solid var(--border);background:transparent;
        font-size:var(--fs-sm);cursor:pointer;color:var(--lilac);
        font-family:var(--font-body)">
        Voir tout (${cycles.length - MAX_VISIBLE} de plus) ▾
      </button>
      <div id="j1-voir-tout" style="max-height:0;overflow:hidden;transition:max-height .3s ease">
        ${cycles.slice(MAX_VISIBLE).map((ds, i) => {
          const idx = i + MAX_VISIBLE;
          const d   = new Date(ds + 'T12:00');
          const fmt = `${d.getDate()} ${d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
          return `
            <div style="display:flex;align-items:center;justify-content:space-between;
              padding:7px 0;border-bottom:1px solid var(--border)">
              <span style="font-size:var(--fs-sm);color:var(--text)">🩸 ${fmt}</span>
              <div style="display:flex;gap:4px">
                <input type="date" id="edit-j1-${idx}"
                  style="position:absolute;opacity:0;pointer-events:none;width:0;height:0"
                  value="${ds}" onchange="modifierCycle('${ds}', this.value)">
                <button onclick="confirmerSuppressionCycle('${ds}', this)"
                  style="background:none;border:none;cursor:pointer;font-size:13px">🗑️</button>
              </div>
            </div>`;
        }).join('')}
      </div>` : '';

    // Durée moyenne affichée
    const moyenneHtml = cycles.length >= 2
      ? `<div style="margin-top:10px;padding:var(--sp-sm) 10px;border-radius:var(--r-sm);
          background:var(--bg);font-size:var(--fs-sm);color:var(--text2)">
          Durée moyenne de tes cycles : <strong style="color:var(--text)">${duree} jours</strong>
          <span style="font-size:var(--fs-sm)"> (sur ${cycles.length - 1} cycle${cycles.length > 2 ? 's' : ''})</span>
        </div>` : '';

    historiqueContenu = `
      <div style="padding:var(--sp-md) 14px;border-top:1px solid var(--border)">
        ${lignesJ1}
        ${voirToutBtn}
        ${moyenneHtml}
        <button onclick="copierCycles()"
  style="width:100%;margin-top:12px;padding:var(--sp-sm);border-radius:var(--r-md);
  border:1px solid var(--border);background:transparent;
  font-size:var(--fs-sm);cursor:pointer;color:var(--text2);
  font-family:var(--font-body)">
  📋 Copier l'historique
</button>
      </div>`;
  }

  const historiqueHtml = `
    <div style="margin-bottom:var(--sp-sm);border-radius:var(--r-md);overflow:hidden;
      border:1px solid var(--border)">
      <button onclick="toggleAccordeon('acc-historique')"
        style="width:100%;padding:var(--sp-md) 14px;background:var(--card);border:none;
        cursor:pointer;display:flex;align-items:center;justify-content:space-between;
        font-family:var(--font-body);font-size:var(--fs-sm);color:var(--text)">
        <span>📋 Historique (${cycles.length} J1 enregistré${cycles.length > 1 ? 's' : ''})</span>
        <span id="acc-historique-chevron" style="display:flex;transition:transform .2s">${chevron('down')}</span>
      </button>
      <div id="acc-historique" style="max-height:0;overflow:hidden;transition:max-height .3s ease">
        ${historiqueContenu}
      </div>
    </div>`;

  el.innerHTML = heroHtml + friseHtml + saisieHtml + historiqueHtml;

  // Auto-ouvre l'accordéon saisie si pas encore de données
  if (!aDesDonnees) toggleAccordeon('acc-saisie');
}

// ── Accordéon générique ──
function toggleAccordeon(id) {
  const panel      = document.getElementById(id);
  const chevronEl  = document.getElementById(id + '-chevron'); // renommé pour éviter de shadower la fonction globale chevron()
  if (!panel) return;
  const ouvert = panel.style.maxHeight && panel.style.maxHeight !== '0px';
  panel.style.maxHeight = ouvert ? '0px' : '600px';
  if (chevronEl) chevronEl.style.transform = ouvert ? '' : 'rotate(180deg)';
}

function toggleJ1Liste() {
  const liste = document.getElementById('j1-voir-tout');
  const btn   = document.getElementById('btn-voir-tout-j1');
  if (!liste) return;
  const ouvert = liste.style.maxHeight !== '0px' && liste.style.maxHeight !== '';
  liste.style.maxHeight = ouvert ? '0' : '400px';
  liste.style.overflowY = ouvert ? 'hidden' : 'auto';
  btn.textContent = ouvert
    ? `Voir tout (${document.querySelectorAll('#j1-voir-tout .j1-ligne, #j1-voir-tout [style*="flex"]').length} de plus) ▾`
    : 'Réduire ▴';
}

function modifierCycle(ancienneDate, nouvelleDate) {
  if (!nouvelleDate || ancienneDate === nouvelleDate) return;
  const D      = window.D;
  const doublon = (D.cycle || []).find(e => e.date === nouvelleDate && e.type === 'regles');
  if (doublon) { toast('Un cycle existe déjà à cette date'); return; }
  const idx = (D.cycle || []).findIndex(e => e.date === ancienneDate && e.type === 'regles');
  if (idx !== -1) {
    D.cycle[idx].date = nouvelleDate;
    D.cycle.sort((a, b) => a.date > b.date ? -1 : 1);
  }
  save();
  toast('Cycle mis à jour ✓');
  renderAgendaCycle(document.getElementById('agenda-contenu'));
}

function declarerReglesCycle() {
  const ds = document.getElementById('cycle-date-input').value;
  if (!ds) return;
  declarerRegles(ds);
  renderAgendaCycle(document.getElementById('agenda-contenu'));
}

function supprimerCycle(ds) {
  window.D.cycle = (window.D.cycle || []).filter(e => !(e.date === ds && e.type === 'regles'));
  save();
  renderAgendaCycle(document.getElementById('agenda-contenu'));
}

function copierCycles() {
  const D      = window.D;
  const cycles = (D.cycle || [])
    .filter(e => e.type === 'regles')
    .map(e => e.date)
    .sort().reverse();

  if (cycles.length < 1) { toast('Aucun cycle à copier'); return; }

  let txt = 'Historique des cycles — HabitGotchi\n\n';
  for (let i = 0; i < cycles.length - 1; i++) {
    const d1  = new Date(cycles[i+1] + 'T12:00');
    const d2  = new Date(cycles[i]   + 'T12:00');
    const nb  = Math.round((d2 - d1) / 86400000);
    const fmt = d => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    txt += `Cycle ${cycles.length - 1 - i} : ${fmt(d1)} → ${fmt(d2)} (${nb} jours)\n`;
  }
  if (cycles.length === 1) {
    const d = new Date(cycles[0] + 'T12:00');
    txt += `J1 enregistré : ${d.toLocaleDateString('fr-FR')}\n`;
  }

  navigator.clipboard.writeText(txt)
    .then(() => toast('Historique copié ✓'))
    .catch(() => toast('Copie non disponible sur cet appareil'));
}
