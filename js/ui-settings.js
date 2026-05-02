/* ============================================================
   ui-settings.js — HUD, personnalisation, progression,
                    réglages, tablette, bienvenue, états (S5, S6, S7)
   RÔLE : Tout ce qui concerne l'apparence (perso), les données
          utilisatrice (réglages, export/import), le HUD de
          progression, la tablette rétro, et l'écran de bienvenue.
          Contient aussi ouvrirSnack() (repas) et les modales d'états
          (sliders énergie/bonheur).
   Dépend de : app.js (window.D, save, today, hr, getSt, nxtTh,
                        addXp, getSt, SCHEMA_VERSION, bootstrap)
               ui-core.js (toast, toastModal, openModal, clModal,
                            chevron, chevronNav, animEl,
                            lockScroll, unlockScroll, showTDAH,
                            showCycle, showRDV)
               ui-journal.js (getWkDates — utilisée par renderProg)
               ui-ai.js (genSoutien, checkBilanReset, wOff, mOff)
   ============================================================

   CONTENU :
   §1  REPAS                     — ouvrirSnack()
   §2  HUD & FLEURS              — updThoughtFlowers, updBilanFlowers,
                                   updJournalFlowers, updUI,
                                   testApiKey, updBadgeBoutique
   §3  PERSONNALISATION          — renderPerso, applyUIPalette,
                                   applyGotchiColor, applyEnvTheme,
                                   restorePerso
   §4  PROGRESSION               — calColor, renderProg, showDayDetail
   §5  RÉGLAGES                  — saveName, saveApi, savePin,
                                   exportD, importD, confirmReset
   §6  TABLETTE RÉTRO            — openTablet, closeTablet, updTabletBadge
   §7  BIENVENUE & MESSAGES      — checkWelcome, _prenom, _pick,
                                   getMorningTitle..getNightMsg,
                                   showWelcomeModal, confirmWelcome,
                                   applyCheatCode
   §8  MODAL ÉTATS               — ouvrirModalEtats, fermerModalEtats
   §9  INIT UI                   — window.initUI
   ============================================================ */


/* ============================================================
   REPAS
   ============================================================ */
function ouvrirSnack() {
  // RÔLE : Ouvre la modale repas selon le contexte horaire (nuit / hors fenêtre / déjà mangé / choix)
  // POURQUOI : Tous les cas passent désormais par openModal() — lockScroll, ✕ auto et inert
  //            sont garantis sans avoir à les gérer manuellement dans chaque branche.
  const h = hr();

  // Cas 1 : Nuit — le Gotchi dort à partir de 23h30
  // RÔLE : Affiche le popup "dort" uniquement quand le Gotchi est vraiment endormi.
  // POURQUOI : Aligné sur le seuil sleeping de render.js (23h30, pas 22h).
  const _mSnack = new Date().getMinutes();
  const _sleepingSnack = (h === 23 && _mSnack >= 30) || (h >= 0 && h < 7);
  if (_sleepingSnack) {
    openModal(`
      <div style="text-align:center;padding:10px">
        <div style="font-size:48px;margin-bottom:var(--sp-sm)">🌙</div>
        <p style="font-size:var(--fs-sm);margin-bottom:var(--sp-md)">
          ${escape(window.D.g.name)} dort... reviens demain 💜
        </p>
        <button class="btn btn-p" onclick="clModal()" style="width:100%">OK</button>
      </div>`);
    return;
  }

  // Cas 2 : Hors fenêtre repas → message "pas l'heure"
  const meal = getCurrentMealWindow();
  if (!meal) {
    openModal(`
      <div style="text-align:center;padding:10px">
        <div style="font-size:48px;margin-bottom:var(--sp-sm)">⏰</div>
        <p style="font-size:var(--fs-sm);margin-bottom:var(--sp-md)">
          Ce n'est pas encore l'heure du repas...<br>
          <span style="color:var(--text2);font-size:var(--fs-xs)">
            Matin 7h-11h • Midi 11h-15h<br>Goûter 15h-17h 🍪 • Soir 18h-23h30
          </span>
        </p>
        <button class="btn btn-p" onclick="clModal()" style="width:100%">OK</button>
      </div>`);
    return;
  }

  // Cas 3 : Repas déjà pris sur cette fenêtre
  const meals = ensureMealsToday();
  if (meals[meal]) {
    const w = MEAL_WINDOWS[meal];
    openModal(`
      <div style="text-align:center;padding:10px">
        <div style="font-size:48px;margin-bottom:var(--sp-sm)">${w.icon}</div>
        <p style="font-size:var(--fs-sm);margin-bottom:var(--sp-md)">
          ${escape(window.D.g.name)} a déjà mangé ce ${w.label.toLowerCase()} 💜<br>
          <span style="color:var(--text2);font-size:var(--fs-xs)">Reviens à la prochaine fenêtre repas</span>
        </p>
        <button class="btn btn-p" onclick="clModal()" style="width:100%">OK</button>
      </div>`);
    return;
  }

  // Cas 4 : Fenêtre dispo → popup choix de snack
  const snacks = pickThreeSnacks();
  const w = MEAL_WINDOWS[meal];

  // Boutons snack : emojis internes (trusted) — pas d'escape nécessaire
  const snackButtons = snacks.map(emoji => `
    <button class="btn btn-snack"
            onclick="giveSnack('${emoji}');clModal();"
            style="flex:1;font-size:32px;padding:var(--sp-md) 4px;background:var(--card);border:2px solid var(--border);border-radius:var(--r-md);cursor:pointer;transition:transform .15s">
      ${emoji}
    </button>
  `).join('');

  openModal(`
    <div style="text-align:center;padding:10px">
      <div style="font-size:24px;margin-bottom:4px">${w.icon}</div>
      <p style="font-size:var(--fs-sm);margin-bottom:4px;font-weight:bold">
        Repas du ${w.label.toLowerCase()}
      </p>
      <p style="font-size:var(--fs-xs);color:var(--text2);margin-bottom:var(--sp-md)">
        Que veux-tu donner à ${escape(window.D.g.name)} ?
      </p>
      <div style="display:flex;gap:6px;margin-bottom:var(--sp-md)">
        ${snackButtons}
      </div>
      <button class="btn btn-s" onclick="clModal()" style="width:100%">Annuler</button>
    </div>`);
}

/* ─── SYSTÈME 7 : INGÉNIERIE (Mise à jour des Data dans le DOM) ── */

/**
 * RÔLE : Met à jour les fleurs de quota dans #thought-count
 * POURQUOI : Remplace l'affichage textuel "(0/3)" par 3 ✿ visuelles qui s'estompent
 */


/**
 * RÔLE : Met à jour les fleurs de quota dans #thought-count
 * POURQUOI : Remplace l'affichage textuel "(0/3)" par 3 ✿ visuelles qui s'estompent
 */
function updThoughtFlowers() {
  const tc = document.getElementById('thought-count');
  if (!tc) return;
  const used = window.D.thoughtCount || 0;
  const total = 5; // RÔLE : quota journalier de pensées (modifié 2026-05-02 : 3 → 5)
  tc.innerHTML = Array.from({ length: total }, (_, i) =>
    `<span class="${i < (total - used) ? 'flower-on' : 'flower-off'}">✿</span>`
  ).join('');
}

/**
 * RÔLE : Met à jour les fleurs de quota dans #soutien-flowers (post-it menu)
 * POURQUOI : Rend visible la limite de 3 sessions/jour directement sur le bouton,
 *            avant même de cliquer — même pattern que updThoughtFlowers()
 */
function updSoutienFlowers() {
  const sf = document.getElementById('soutien-flowers');
  if (!sf) return;
  const used  = window.D.soutienCount || 0;
  const total = 3;
  sf.innerHTML = Array.from({ length: total }, (_, i) =>
    `<span class="${i < (total - used) ? 'flower-on' : 'flower-off'}">✿</span>`
  ).join('');
}
window.updSoutienFlowers = updSoutienFlowers;

/**
 * RÔLE : Met à jour le post-it agenda avec les icônes RDV du jour + la phase cycle en cours
 * POURQUOI : Donne un aperçu rapide de la journée sans ouvrir l'agenda —
 *            visible directement sur le post-it dans le menu
 */
function updAgendaPostit() {
  const el = document.getElementById('agenda-postit-info');
  if (!el) return;

  const D  = window.D;
  const td = today(); // "YYYY-MM-DD"

  // ── RDV du jour : on extrait l'emoji de chaque label ──
  // POURQUOI : l'emoji est préfixé dans r.label ("🩺 Kiné") — on prend le 1er segment Unicode
  const rdvAujourdhui = (D.rdv || []).filter(r => r.date === td);
  let rdvPart = '';

  if (rdvAujourdhui.length === 0) {
    // POURQUOI : feedback explicite — pas de RDV ≠ oubli d'ouvrir l'agenda
    rdvPart = `<span style="font-size:var(--fs-xs);opacity:0.5">Pas de RDV</span>`;
  } else {
    // POURQUOI : chaque emoji est un <span> autonome pour que le flex-wrap de .agenda-postit-info
    //            puisse faire passer les emojis à la ligne quand il y en a plusieurs
    const icones = rdvAujourdhui.map(r => {
      // RÔLE : extrait le premier cluster graphème du label (emoji complet, variation selector inclus)
      // POURQUOI : [...str][0] découpe en points de code — ça coupe ✈️ en [✈, FE0F] et on perd le FE0F.
      //            Intl.Segmenter (API moderne) itère par cluster graphème complet.
      //            Fallback regex : \p{Emoji_Presentation}️?|\p{Emoji}️ capture le caractère + son VS-16.
      let emoji = '🗓️';
      const label = r.label || '';
      if (label) {
        if (typeof Intl?.Segmenter === 'function') {
          // Chemin moderne — segmentation par cluster graphème
          const seg = new Intl.Segmenter('fr', { granularity: 'grapheme' });
          const premier = [...seg.segment(label)][0]?.segment || '';
          if (premier.codePointAt(0) > 127) emoji = premier;
        } else {
          // Chemin fallback — regex Unicode qui capture l'emoji + variation selector FE0F éventuel
          const m = label.match(/\p{Emoji_Presentation}️?|\p{Emoji}️/u);
          if (m) emoji = m[0];
        }
      }
      return `<span style="line-height:1">${emoji}</span>`;
    });
    rdvPart = `<span style="display:flex;flex-wrap:wrap;gap:2px;justify-content:center">${icones.join('')}</span>`;
  }

  // ── Phase cycle (si feature activée et données disponibles) ──
  // POURQUOI : showCycle() respecte la config user — ne pas afficher si désactivé
  let cyclePart = '';
  if (typeof showCycle === 'function' && showCycle()) {
    const phase = typeof getCyclePhase === 'function' ? getCyclePhase(td) : null;
    if (phase) {
      // POURQUOI : white-space:nowrap sur le conteneur garantit que le badge ●, le label et le JX
      //            restent toujours sur la même ligne — white-space:nowrap ne gêne pas le layout
      //            car le post-it est lui-même flex avec wrap désactivé sur cette ligne.
      cyclePart = `<span style="white-space:nowrap"><span style="color:${phase.couleur};font-size:10px">●</span>&nbsp;<span style="font-size:var(--fs-xs);opacity:0.75">${phase.label}&nbsp;J${phase.j}</span></span>`;
    }
  }

  // ── Assemblage ──
  // POURQUOI : &nbsp;·&nbsp; empêche le point médian de se retrouver seul en début de ligne
  //            si les deux parts tiennent sur des largeurs différentes.
  const separator = rdvPart && cyclePart ? '&nbsp;·&nbsp;' : '';
  el.innerHTML = rdvPart + separator + cyclePart;
}
window.updAgendaPostit = updAgendaPostit;

/**
 * RÔLE : Met à jour les fleurs de quota dans #bilan-flowers (onglet Progrès)
 * POURQUOI : Même logique visuelle que les fleurs de pensée — 3 ✿ qui s'estompent au fil des bilans générés.
 *            Les fleurs ne s'affichent qu'à partir du vendredi (le bouton est actif).
 */
function updBilanFlowers() {
  const bf = document.getElementById('bilan-flowers');
  if (!bf) return;
  // On n'affiche les fleurs que le vendredi/samedi/dimanche (quand le bouton est actif)
  const jourSemaine   = new Date().getDay();
  const estFinSemaine = jourSemaine === 0 || jourSemaine === 5 || jourSemaine === 6;
  if (!estFinSemaine) { bf.innerHTML = ''; return; }
  const used  = window.D.g.bilanCount || 0;
  const total = 3;
  bf.innerHTML = Array.from({ length: total }, (_, i) =>
    `<span class="${i < (total - used) ? 'flower-on' : 'flower-off'}">✿</span>`
  ).join('');
}

/**
 * RÔLE : Met à jour les fleurs de quota dans #journal-flowers (onglet Journal)
 * POURQUOI : Cohérent avec thought-count et bilan-flowers — remplace le compteur texte "X/5 notes"
 *            par des ✿ visuelles qui s'estompent au fil des notes enregistrées dans la journée.
 */
function updJournalFlowers() {
  const jf = document.getElementById('journal-flowers');
  if (!jf) return;
  const todayStr = today(); // fonction app.js — retourne "YYYY-MM-DD"
  const used  = window.D.journal.filter(n => n.date.startsWith(todayStr)).length;
  const total = window.JOURNAL_MAX_PER_DAY || 5;
  jf.innerHTML = Array.from({ length: total }, (_, i) =>
    // Les fleurs restantes (non utilisées) sont allumées, les utilisées s'éteignent
    `<span class="${i < (total - used) ? 'flower-on' : 'flower-off'}">✿</span>`
  ).join('');
}

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
  if (document.getElementById('xp-l'))     document.getElementById('xp-l').textContent = nt > pt ? `${g.totalXp - pt}/${nt - pt} XP` : `MAX ✿`;
  if (document.getElementById('xp-b'))     document.getElementById('xp-b').style.width = pct + '%';
  // RÔLE : Enrichir le label de stade avec un suffixe romain en zone adulte (ex : "Adepte III")
  // POURQUOI : Les 5 stades adultes (500→4000) sont trop espacés — un sous-niveau affiché
  //            directement dans le titre donne un repère lisible sans effort cognitif,
  //            comme les niveaux classiques dans les jeux. Au palier 0 (entrée dans le stade),
  //            pas de suffixe — "Adepte" tout court, puis "Adepte II" à 700 XP, etc.
  if (document.getElementById('g-stage')) {
    const mp = getMicroPalier(g.totalXp);
    const ROMAINS = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX'];
    const suffixe = mp !== null && mp > 0 ? ROMAINS[mp] || ` ${mp + 1}` : '';
    document.getElementById('g-stage').textContent = s.l + suffixe;
  }
  // RÔLE : Synchroniser les sliders de la modale d'états si elle est ouverte
  // POURQUOI : Les sliders sont dans une bottom sheet dynamique, pas dans le DOM permanent.
  //            On met à jour les inputs s'ils existent au moment de updateUI().
  if (document.getElementById('modal-sl-energy')) {
    document.getElementById('modal-sl-energy').value = g.energy;
    document.getElementById('modal-sv-energy').textContent = g.energy;
  }
  if (document.getElementById('modal-sl-happy')) {
    document.getElementById('modal-sl-happy').value = g.happiness;
    document.getElementById('modal-sv-happy').textContent = g.happiness;
  }
  if (document.getElementById('s-xp'))       document.getElementById('s-xp').textContent = g.totalXp;
  if (document.getElementById('s-str'))      document.getElementById('s-str').textContent = calcStr();
  if (document.getElementById('s-jrn'))      document.getElementById('s-jrn').textContent = D.journal.length;
  // RÔLE : Affiche le streak de présence global (jours consécutifs d'ouverture).
  if (document.getElementById('s-presence')) document.getElementById('s-presence').textContent = D.presenceStreak || 0;
  if (document.getElementById('name-inp')) document.getElementById('name-inp').value = g.name;
  if (document.getElementById('env-sel'))  document.getElementById('env-sel').value = g.activeEnv || 'parc';
  if (document.getElementById('api-inp'))  document.getElementById('api-inp').value = D.apiKey || '';
  
  const petalesDisplay = document.getElementById('petales-wallet');
  if (petalesDisplay) petalesDisplay.textContent = `🌸 ${D.g.petales || 0}`;
  const petalesBoutique = document.getElementById('petales-wallet-boutique');
  if (petalesBoutique) petalesBoutique.textContent = `${D.g.petales || 0}`;
  
  updThoughtFlowers();
  // RÔLE : Synchroniser les fleurs de quota soutien sur le post-it menu
  updSoutienFlowers();
  // RÔLE : Mettre à jour les infos RDV + cycle sur le post-it agenda
  updAgendaPostit();
  // RÔLE : Synchroniser les fleurs de quota journal à chaque mise à jour globale de l'UI
  updJournalFlowers();
  // RÔLE : Met à jour le label du bouton avec le nom du Gotchi
  // POURQUOI : Le span #btn-ask-label est la seule source du texte — plus de nœud texte brut dans le HTML
  const btnAskLabel = document.getElementById('btn-ask-label');
  if (btnAskLabel) {
    btnAskLabel.textContent = `Demander une pensée`;
  }
  // RÔLE : Affiche ou masque le badge 🎂 selon la date du jour et la config anniversaire.
  // POURQUOI : Le badge est cliquable pour rouvrir la modale — il reste visible toute la journée.
  //            Si birthday.month est null → jamais affiché.
  const bdgEl = document.getElementById('birthday-badge');
  if (bdgEl) {
    const bday = window.USER_CONFIG?.birthday;
    const now  = new Date();
    const showBd = !!(bday?.month &&
      now.getMonth() + 1 === bday.month &&
      now.getDate()      === bday.day);
    bdgEl.style.display = showBd ? 'inline' : 'none';
    if (showBd) {
      bdgEl.onclick = () => {
        document.getElementById('modal').style.display = 'flex';
        document.getElementById('mbox').innerHTML = `
          <div style="text-align:center;padding:var(--sp-sm)">
            <div style="font-size:40px">🎂</div>
            <p style="font-size:12px;color:var(--text);margin:12px 0;line-height:1.6;white-space:pre-line">${bday.message || 'Joyeux anniversaire 💜'}</p>
            <button class="btn btn-p" onclick="clModal()" style="margin-top:8px;width:100%">Merci 💜</button>
          </div>
        `;
        animEl(document.getElementById('mbox'), 'bounceIn');
      };
    }
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
  if (!key) { statusEl.innerHTML = '❌ <span style="color:var(--danger)">Aucune clé saisie</span>'; return; } // était #e57373 hardcodé
  
  statusEl.innerHTML = '⏳ Test en cours...';
  
  try {
    const d = await callClaude({ messages:[{ role:'user', content:'Test de connexion.' }], max_tokens:10 });
    
    if (d.error) {
      statusEl.innerHTML = `❌ <span style="color:var(--danger)">${d.error.message}</span>`; // était #e57373 hardcodé
    } else if (d.content) {
      statusEl.innerHTML = '✅ <span style="color:#81c784">Connecté</span>';
    }
  } catch(e) {
    statusEl.innerHTML = `❌ <span style="color:var(--danger)">${e.message}</span>`; // était #e57373 hardcodé
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

/* ============================================================
   PERSONNALISATION
   ============================================================ */
function renderPerso() {
  const D = window.D;
  const pg = document.getElementById('palette-grid');
  if (pg) {
    const current = D.g.uiPalette || 'lavande';
    pg.innerHTML = window.HG_CONFIG.UI_PALETTES.map(p => `
      <div onclick="applyUIPalette('${p.id}')" style="padding:var(--sp-sm);border-radius:var(--r-md);cursor:pointer;text-align:center;border:3px solid ${current===p.id?p.lilac:'transparent'};background:${p.bg};transition:.2s;">
        <div style="display:flex;gap:4px;justify-content:center;margin-bottom:4px">
          <div style="width:14px;height:14px;border-radius:50%;background:${p.lilac}"></div>
          <div style="width:14px;height:14px;border-radius:50%;background:${p.mint}"></div>
          <div style="width:14px;height:14px;border-radius:50%;background:${p.pink}"></div>
        </div>
        <div style="font-size:var(--fs-xs);font-weight:bold;color:${p.text || '#38304a'}">${p.label}</div>
      </div>`).join('');
  }
  const gc = document.getElementById('gotchi-colors');
  if (gc) {
    const current = D.g.gotchiColor || 'vert';
    gc.innerHTML = window.HG_CONFIG.GOTCHI_COLORS.map(c => `
  <div onclick="applyGotchiColor('${c.id}')" style="
    border-radius:var(--r-md);cursor:pointer;
    background:${c.body};
    border:3px solid ${current===c.id ? 'var(--lilac)' : 'transparent'};
    padding:6px 4px;
    display:flex;flex-direction:column;align-items:center;gap:3px;
    transition:.2s;box-shadow:0 2px 6px rgba(0,0,0,.1);">
    <div style="width:20px;height:20px;border-radius:50%;background:${c.bodyLt};border:2px solid ${c.bodyDk}"></div>
    <div style="font-size:var(--fs-xs);font-weight:bold;color:${c.bodyDk};text-align:center">${c.label}</div>
  </div>`).join('');
  }
  // ── Couleur des extrémités (bras + pieds) ───────────────────────
  // RÔLE : Afficher le sélecteur de couleur des bras et pieds du Gotchi.
  // POURQUOI : C.limb est mis à jour à chaque frame dans render.js via D.g.limbColor —
  //            'auto' = fallback bodyDk (comportement original). Même pattern que les autres.
  const limbGrid = document.getElementById('limb-colors');
  if (limbGrid) {
    const currentLimb = D.g.limbColor || 'auto';
    // POURQUOI : 'auto' affiche un swatch bicolore (body + bodyDk) pour signaler que la couleur
    //            suit automatiquement celle du corps.
    const currentBodyDk = (window.HG_CONFIG.GOTCHI_COLORS.find(x => x.id === (D.g.gotchiColor || 'vert')) || window.HG_CONFIG.GOTCHI_COLORS[0]).bodyDk;
    limbGrid.innerHTML = window.HG_CONFIG.LIMB_COLORS.map(c => {
      const swatchBg = c.hex ? c.hex : `linear-gradient(135deg, ${currentBodyDk} 50%, ${currentBodyDk}88 50%)`;
      const swatchBorder = c.hex ? 'rgba(0,0,0,.12)' : 'rgba(0,0,0,.2)';
      return `
      <div onclick="applyLimbColor('${c.id}')" style="
        border-radius:var(--r-md);cursor:pointer;
        background:var(--card);
        border:3px solid ${currentLimb === c.id ? 'var(--lilac)' : 'transparent'};
        padding:6px 4px;
        display:flex;flex-direction:column;align-items:center;gap:3px;
        transition:.2s;box-shadow:0 2px 6px rgba(0,0,0,.1);">
        <div style="width:20px;height:20px;border-radius:50%;background:${swatchBg};border:1.5px solid ${swatchBorder}"></div>
        <div style="font-size:var(--fs-xs);font-weight:bold;color:var(--text);text-align:center">${c.label}</div>
      </div>`;
    }).join('');
  }

  // ── Couleur des yeux (iris) ──────────────────────────────────────
  // RÔLE : Afficher le sélecteur de couleur de l'iris du Gotchi.
  // POURQUOI : C.eye est mis à jour à chaque frame dans render.js via D.g.eyeColor —
  //            le sélecteur suit le même pattern que gotchi-colors et pupil-colors.
  const eyeGrid = document.getElementById('eye-colors');
  if (eyeGrid) {
    const currentEye = D.g.eyeColor || 'noir';
    eyeGrid.innerHTML = window.HG_CONFIG.EYE_COLORS.map(c => `
      <div onclick="applyEyeColor('${c.id}')" style="
        border-radius:var(--r-md);cursor:pointer;
        background:var(--card);
        border:3px solid ${currentEye === c.id ? 'var(--lilac)' : 'transparent'};
        padding:6px 4px;
        display:flex;flex-direction:column;align-items:center;gap:3px;
        transition:.2s;box-shadow:0 2px 6px rgba(0,0,0,.1);">
        <div style="width:20px;height:20px;border-radius:50%;background:${c.hex};border:1.5px solid rgba(0,0,0,.12)"></div>
        <div style="font-size:var(--fs-xs);font-weight:bold;color:var(--text);text-align:center">${c.label}</div>
      </div>`).join('');
  }

  // ── Couleur de la bouche ─────────────────────────────────────────
  // RÔLE : Afficher le sélecteur de couleur de la bouche du Gotchi.
  // POURQUOI : C.mouth est mis à jour à chaque frame via getGotchiC() — même pattern que C.eye.
  const mouthGrid = document.getElementById('mouth-colors');
  if (mouthGrid) {
    const currentMouth = D.g.mouthColor || 'noir';
    mouthGrid.innerHTML = window.HG_CONFIG.MOUTH_COLORS.map(c => `
      <div onclick="applyMouthColor('${c.id}')" style="
        border-radius:var(--r-md);cursor:pointer;
        background:var(--card);
        border:3px solid ${currentMouth === c.id ? 'var(--lilac)' : 'transparent'};
        padding:6px 4px;
        display:flex;flex-direction:column;align-items:center;gap:3px;
        transition:.2s;box-shadow:0 2px 6px rgba(0,0,0,.1);">
        <div style="width:20px;height:20px;border-radius:50%;background:${c.hex};border:1.5px solid rgba(0,0,0,.12)"></div>
        <div style="font-size:var(--fs-xs);font-weight:bold;color:var(--text);text-align:center">${c.label}</div>
      </div>`).join('');
  }

  // ── Reflets des yeux (pupilles) ─────────────────────────────────
  // RÔLE : Afficher le sélecteur de couleur des petits points lumineux dans les yeux du Gotchi.
  // POURQUOI : Identique en structure aux autres grilles de personnalisation —
  //            un clic → applyPupilColor() → sauvegarde + re-render.
  const pupilGrid = document.getElementById('pupil-colors');
  if (pupilGrid) {
    const currentPupil = D.g.pupilColor || 'blanc';
    pupilGrid.innerHTML = window.HG_CONFIG.PUPIL_COLORS.map(c => `
      <div onclick="applyPupilColor('${c.id}')" style="
        border-radius:var(--r-md);cursor:pointer;
        background:var(--card);
        border:3px solid ${currentPupil === c.id ? 'var(--lilac)' : 'transparent'};
        padding:6px 4px;
        display:flex;flex-direction:column;align-items:center;gap:3px;
        transition:.2s;box-shadow:0 2px 6px rgba(0,0,0,.1);">
        <div style="width:20px;height:20px;border-radius:50%;background:${c.hex};border:1.5px solid rgba(0,0,0,.12)"></div>
        <div style="font-size:var(--fs-xs);font-weight:bold;color:var(--text);text-align:center">${c.label}</div>
      </div>`).join('');
  }

  // ── Couleur des joues ────────────────────────────────────────────
  // RÔLE : Afficher le sélecteur de couleur des joues du Gotchi.
  // POURQUOI : C.cheek est mis à jour à chaque frame dans render.js via D.g.cheekColor —
  //            même pattern que C.eye et C.mouth.
  const cheekGrid = document.getElementById('cheek-colors');
  if (cheekGrid) {
    const currentCheek = D.g.cheekColor || 'rose';
    cheekGrid.innerHTML = window.HG_CONFIG.CHEEK_COLORS.map(c => `
      <div onclick="applyCheekColor('${c.id}')" style="
        border-radius:var(--r-md);cursor:pointer;
        background:var(--card);
        border:3px solid ${currentCheek === c.id ? 'var(--lilac)' : 'transparent'};
        padding:6px 4px;
        display:flex;flex-direction:column;align-items:center;gap:3px;
        transition:.2s;box-shadow:0 2px 6px rgba(0,0,0,.1);">
        <div style="width:20px;height:20px;border-radius:50%;background:${c.hex};border:1.5px solid rgba(0,0,0,.12)"></div>
        <div style="font-size:var(--fs-xs);font-weight:bold;color:var(--text);text-align:center">${c.label}</div>
      </div>`).join('');
  }

  // ── Style du haut de la tête (oreilles, antennes, ailes) ────────
  // RÔLE : Afficher le picker d'icônes pour choisir le style d'oreilles du Gotchi.
  // POURQUOI : Même pattern que les autres sélecteurs — un clic → applyHeadStyle() → sauvegarde.
  //            Visible uniquement aux stades teen et adult (baby n'a pas d'oreilles).
  const headStyleGrid = document.getElementById('head-styles');
  if (headStyleGrid) {
    const currentHead = D.g.headStyle || 'lapin';
    headStyleGrid.innerHTML = window.HG_CONFIG.HEAD_STYLES.map(s => `
      <div onclick="applyHeadStyle('${s.id}')" style="
        border-radius:var(--r-md);cursor:pointer;
        background:var(--card);
        border:3px solid ${currentHead === s.id ? 'var(--lilac)' : 'transparent'};
        padding:6px 4px;
        display:flex;flex-direction:column;align-items:center;gap:3px;
        transition:.2s;box-shadow:0 2px 6px rgba(0,0,0,.1);">
        <div style="font-size:24px;line-height:1">${s.icon}</div>
        <div style="font-size:var(--fs-xs);font-weight:bold;color:var(--text);text-align:center">${s.label}</div>
      </div>`).join('');
  }

  const et = document.getElementById('env-themes');
  if (et) {
    const current = D.g.envTheme || 'pastel';
et.innerHTML = window.HG_CONFIG.ENV_THEMES.map(t => `
  <div onclick="applyEnvTheme('${t.id}')" style="
    padding:var(--sp-md) 8px;border-radius:var(--r-md);cursor:pointer;
    background:linear-gradient(135deg,${t.sky1},${t.gnd});
    border:3px solid ${current===t.id?'var(--lilac)':'transparent'};
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:4px;transition:.2s;">
    <div style="font-size:24px;line-height:1">${t.icon}</div>
    <div style="font-size:var(--fs-sm);font-weight:bold;color:#fff;text-align:center;text-shadow:0 1px 3px rgba(0,0,0,.4)">${t.label}</div>
  </div>`).join('');
  }
} // ← ferme renderPerso()

/* ─── THÈMES IA ──────────────────────────────────────────────────────────── */
// RÔLE : Liste de mots d'inspiration par défaut pour la génération de props IA.
// POURQUOI : Centralisée ici pour être partagée entre renderPropThemes() et resetPropThemes().
const PROP_THEMES_DEFAULT = ['nature','cosmos','magie','cuisine','musique','voyage','océan','forêt','météo','jardin','minéral','rêve'];

/**
 * RÔLE : Affiche les tags de thèmes IA dans la section Réglages.
 * POURQUOI : Appelée à l'init et après chaque ajout/suppression pour refléter D.g.propThemes.
 */
function renderPropThemes() {
  const el = document.getElementById('prop-themes-tags');
  if (!el) return;
  // RÔLE : Met à jour le nom du Gotchi dans le titre du <summary>.
  const summaryEl = document.getElementById('inspiration-summary');
  if (summaryEl) summaryEl.textContent = `✨ Inspiration de ${window.D.g.name || 'ton Gotchi'}`;
  const themes = window.D.g.propThemes || PROP_THEMES_DEFAULT;
  el.innerHTML = themes.map((t, i) => `
    <span onclick="removePropTheme(${i})" style="
      display:inline-flex;align-items:center;gap:4px;
      background:var(--lilac);color:#fff;
      font-size:var(--fs-xs);font-weight:bold;
      padding:4px 8px;border-radius:20px;cursor:pointer;
      transition:.15s;user-select:none;" title="Supprimer">
      ${escape(t)} <span style="opacity:.7;font-size:10px">✕</span>
    </span>`).join('');
}

/**
 * RÔLE : Ajoute un mot à la liste d'inspiration du Gotchi.
 * POURQUOI : Valide qu'il s'agit d'un seul mot sans caractères spéciaux,
 *            non dupliqué, et que la liste ne dépasse pas 20 entrées.
 */
function addPropTheme() {
  const inp = document.getElementById('prop-theme-inp');
  if (!inp) return;
  const val = inp.value.trim().toLowerCase();
  if (!val) return;

  // RÔLE : Un seul mot (pas d'espace), lettres/chiffres/accents uniquement.
  if (/\s/.test(val)) { toast('Un seul mot à la fois 🌸'); inp.value = ''; return; }
  if (!/^[\p{L}\p{N}]+$/u.test(val)) { toast('Lettres et chiffres uniquement 🌸'); inp.value = ''; return; }

  if (!window.D.g.propThemes) window.D.g.propThemes = [...PROP_THEMES_DEFAULT];

  // RÔLE : Maximum 20 tags pour garder la liste lisible.
  if (window.D.g.propThemes.length >= 20) { toast('20 mots maximum 🌸'); return; }
  if (window.D.g.propThemes.includes(val)) { toast(`"${escape(val)}" est déjà là 🌸`); return; }

  window.D.g.propThemes.push(val);
  save();
  inp.value = '';
  renderPropThemes();
}

/**
 * RÔLE : Supprime un thème par son index dans la liste.
 * POURQUOI : Le clic sur un tag passe son index — on splice et on re-render.
 */
function removePropTheme(i) {
  if (!window.D.g.propThemes) window.D.g.propThemes = [...PROP_THEMES_DEFAULT];
  if (window.D.g.propThemes.length <= 1) { toast('Il faut au moins un thème !'); return; }
  window.D.g.propThemes.splice(i, 1);
  save();
  renderPropThemes();
}

/**
 * RÔLE : Restaure la liste de thèmes par défaut.
 * POURQUOI : Permet de repartir de zéro si la liste personnalisée ne convient plus.
 */
function resetPropThemes() {
  window.D.g.propThemes = [...PROP_THEMES_DEFAULT];
  save();
  renderPropThemes();
  toast('Thèmes restaurés 🎨');
}

// Exposer sur window pour les onclick HTML
window.addPropTheme    = addPropTheme;
window.removePropTheme = removePropTheme;
window.resetPropThemes = resetPropThemes;

function applyUIPalette(id, silent = false) {
  const p = window.HG_CONFIG.UI_PALETTES.find(x => x.id === id); if (!p) return;
  document.documentElement.style.setProperty('--bg',        p.bg);
  document.documentElement.style.setProperty('--lilac',     p.lilac);
  document.documentElement.style.setProperty('--mint',      p.mint);
  document.documentElement.style.setProperty('--pink',      p.pink);
  document.documentElement.style.setProperty('--text',      p.text      || '#38304a');
  document.documentElement.style.setProperty('--text2',     p.text2     || '#887ea0');
  document.documentElement.style.setProperty('--card',      p.card      || 'rgba(255,255,255,.88)');
  document.documentElement.style.setProperty('--border',    p.border    || '#ccc4d8');
  // RÔLE : --bubble-bg suit la palette — fond de la bulle de pensée du Gotchi.
  // POURQUOI : Était #fff hardcodé dans le CSS, la bulle ne suivait pas les palettes.
  //            Fallback sur #fff si la palette ne définit pas de bubbleBg.
  document.documentElement.style.setProperty('--bubble-bg', p.bubbleBg  || '#fff');
  window.D.g.uiPalette = id; save(); renderPerso();
  if (!silent) toast(`Palette ${p.label} appliquée ✿`);
}
function applyGotchiColor(id, silent = false) {
  const c = window.HG_CONFIG.GOTCHI_COLORS.find(x => x.id === id); if (!c) return;
  window.D.g.gotchiColor = id; save(); renderPerso();
  if (!silent) toast(`Couleur ${c.label} appliquée ✿`);
}
// RÔLE : Sauvegarder la couleur de reflet choisie et rafraîchir l'UI.
// POURQUOI : Même pattern que applyGotchiColor() — la valeur est lue à chaque frame
//            dans render-sprites.js via D.g.pupilColor. Pas de CSS variable à modifier.
function applyPupilColor(id, silent = false) {
  const c = window.HG_CONFIG.PUPIL_COLORS.find(x => x.id === id); if (!c) return;
  window.D.g.pupilColor = id; save(); renderPerso();
  if (!silent) toast(`Reflets ${c.label} appliqués ✿`);
}

// RÔLE : Sauvegarder la couleur d'iris choisie et rafraîchir l'UI.
// POURQUOI : C.eye est mis à jour à chaque frame dans render.js via getGotchiC() —
//            il suffit de sauvegarder D.g.eyeColor, le rendu suit automatiquement.
function applyEyeColor(id, silent = false) {
  const c = window.HG_CONFIG.EYE_COLORS.find(x => x.id === id); if (!c) return;
  window.D.g.eyeColor = id; save(); renderPerso();
  if (!silent) toast(`Yeux ${c.label} appliqués ✿`);
}

// RÔLE : Sauvegarder la couleur de bouche choisie et rafraîchir l'UI.
// POURQUOI : C.mouth est mis à jour à chaque frame dans render.js via getGotchiC() —
//            il suffit de sauvegarder D.g.mouthColor, le rendu suit automatiquement.
function applyMouthColor(id, silent = false) {
  const c = window.HG_CONFIG.MOUTH_COLORS.find(x => x.id === id); if (!c) return;
  window.D.g.mouthColor = id; save(); renderPerso();
  if (!silent) toast(`Bouche ${c.label} appliquée ✿`);
}

// RÔLE : Sauvegarder la couleur des extrémités choisie et rafraîchir l'UI.
// POURQUOI : C.limb est mis à jour à chaque frame via getGotchiC() — même pattern que les autres.
//            'auto' remet le fallback sur C.bodyDk (comportement original).
function applyLimbColor(id, silent = false) {
  const c = window.HG_CONFIG.LIMB_COLORS.find(x => x.id === id); if (!c) return;
  window.D.g.limbColor = id; save(); renderPerso();
  if (!silent) toast(id === 'auto' ? `Extrémités : couleur automatique ✿` : `Extrémités ${c.label} appliquées ✿`);
}

// RÔLE : Sauvegarder le style de haut de tête choisi et rafraîchir l'UI.
// POURQUOI : D.g.headStyle est lu à chaque frame dans render-sprites.js via params.headStyle —
//            il suffit de sauvegarder, le rendu suit automatiquement au prochain frame.
function applyHeadStyle(id, silent = false) {
  const s = window.HG_CONFIG.HEAD_STYLES.find(x => x.id === id); if (!s) return;
  window.D.g.headStyle = id; save(); renderPerso();
  if (!silent) toast(`Style ${s.label} appliqué ✿`);
}

// RÔLE : Sauvegarder la couleur de joues choisie et rafraîchir l'UI.
// POURQUOI : C.cheek est mis à jour à chaque frame dans render.js via getGotchiC() —
//            il suffit de sauvegarder D.g.cheekColor, le rendu suit automatiquement.
function applyCheekColor(id, silent = false) {
  const c = window.HG_CONFIG.CHEEK_COLORS.find(x => x.id === id); if (!c) return;
  window.D.g.cheekColor = id; save(); renderPerso();
  if (!silent) toast(`Joues ${c.label} appliquées ✿`);
}

function applyEnvTheme(id, silent = false) {
  const t = window.HG_CONFIG.ENV_THEMES.find(x => x.id === id); if (!t) return;
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

  /* ── Calendrier hebdomadaire — rendu enrichi identique à agenda/mois ── */
  // RÔLE : Chaque case affiche le jour, la couleur habitudes, les indicateurs cycle et les icônes RDV/journal
  // POURQUOI : Cohérence visuelle avec la vue agenda/mois — même police, même structure par case
  const total = D.habits.length || 6;

  // Données cycle — même logique que renderAgendaMois
  const cycleEntries = D.cycle || [];
  const j1Dates = cycleEntries
    .filter(e => e.type === 'regles')
    .map(e => e.date)
    .sort().reverse();

  // En-têtes L M M J V S D
  let wHtml = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:3px">';
  ['L','M','M','J','V','S','D'].forEach(j => {
    wHtml += `<div style="text-align:center;font-size:var(--fs-xs);color:var(--text2);
      font-weight:bold;font-family:var(--font-body);padding:2px 0">${j}</div>`;
  });
  wHtml += '</div>';

  // Cases des 7 jours
  wHtml += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">';
  wd.forEach(ds => {
    const log    = D.log[ds] || [];
    const isT    = ds === today();
    const pct    = total > 0 ? log.length / total : 0;
    const day    = new Date(ds + 'T12:00').getDate();

    // Fond couleur habitudes — même calcul que renderAgendaMois
    const g       = Math.round(180 + pct * 60);
    const alpha   = pct > 0 ? 0.15 + pct * 0.6 : 0;
    const bgColor = pct > 0 ? `rgba(80,${g},120,${alpha})` : 'rgba(0,0,0,0.03)';
    const border  = isT ? '2px solid var(--lilac)' : '1px solid transparent';

    // Indicateurs cycle
    const estJ1     = j1Dates.includes(ds);
    let   estOvul   = false;
    let   estPredic = false;
    j1Dates.forEach(j1 => {
      const diff = Math.round((new Date(ds+'T12:00') - new Date(j1+'T12:00')) / 86400000);
      if (diff >= 12 && diff <= 16) estOvul   = true;
      if (diff >= 25 && diff <= 30) estPredic = true;
    });

    // RDV du jour (récurrents inclus) + note journal
    const rdvDuJour = getRdvDuJour(ds);
    const aNote     = (D.journal || []).some(n => n.date && n.date.startsWith(ds));
    let rdvEmoji = '';
    if (rdvDuJour.length) {
      const match = rdvDuJour[0].label.match(/^\p{Emoji}/u);
      rdvEmoji = match ? match[0] : '📌';
      // RÔLE : Badge "+X" quand plusieurs RDV le même jour — pill coloré lisible sur mobile.
      // POURQUOI : L'ancien font-size:7px + vertical-align:super était trop petit pour être lisible.
      if (rdvDuJour.length > 1) rdvEmoji += `<span style="display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-family:var(--font-body);line-height:1;background:var(--lilac);color:#fff;border-radius:4px;padding:1px 3px;margin-left:1px;vertical-align:middle">+${rdvDuJour.length - 1}</span>`;
    }

    wHtml += `
      <button onclick="showDayDetail('${ds}')"
        style="position:relative;aspect-ratio:1;border-radius:6px;cursor:pointer;
        background:${bgColor};border:${border};
        display:flex;flex-direction:column;align-items:center;
        justify-content:space-between;padding:2px 1px;
        font-family:var(--font-body)">

        ${estOvul ? `<div style="position:absolute;inset:1px;border-radius:5px;
          border:2px solid #80b8e066;pointer-events:none"></div>` : ''}
        ${estJ1 ? `<div style="position:absolute;top:2px;right:2px;width:6px;height:6px;
          border-radius:50%;background:#e07080"></div>` : ''}
        ${estPredic && !estJ1 ? `<div style="position:absolute;inset:1px;border-radius:5px;
          border:2px dashed #e0708066;pointer-events:none"></div>` : ''}

        <span style="font-size:var(--fs-sm);font-weight:${isT?'bold':'normal'};
          color:${isT?'var(--lilac)':'var(--text)'};margin-top:2px">${day}</span>

        <div style="display:flex;gap:1px;font-size:var(--fs-xs);line-height:1;margin-bottom:1px">
          ${rdvEmoji}
          ${aNote ? '📓' : ''}
        </div>
      </button>`;
  });
  wHtml += '</div>';

  document.getElementById('w-view').innerHTML = wHtml;

  /* ── Titre bilan ── */
  const bilanTitre = document.getElementById('bilan-titre');
  if (bilanTitre) {
    const debut  = new Date(wd[0] + 'T12:00');
    const fin    = new Date(wd[6] + 'T12:00');
    const fmt    = d => `${d.getDate()} ${d.toLocaleDateString('fr-FR', { month: 'short' })}`;
    const prenom = D.g.userName || D.userName || 'toi';
    bilanTitre.innerHTML = `🌼 Bilan pour ${prenom}<br><span style="font-size:11px;font-weight:400;font-family:var(--font-body);color:var(--text2)">semaine du ${fmt(debut)} au ${fmt(fin)}</span>`;
  }

  /* ── Gestion de la card bilan selon la semaine (passée / en cours / future) ──
     RÔLE : Adapte le contenu et l'état du bouton selon le contexte temporel.
     POURQUOI : Trois états distincts remplacent l'ancien display:none brutal sur les semaines passées.
       wOff < 0  → semaine passée   : bilan archivé affiché en lecture seule, bouton désactivé
       wOff = 0  → semaine en cours : comportement normal (génération possible selon quota/jour)
       wOff > 0  → semaine future   : placeholder "pas encore disponible", bouton désactivé
  ── */
  const cardBilan    = document.getElementById('card-bilan');
  const summaryEl    = document.getElementById('claude-summary');
  const hidEl        = document.getElementById('bil-txt-hidden');
  const btnCopier    = document.getElementById('btn-copy-bilan');
  const btnBilan     = document.querySelector('[onclick="genBilanSemaine()"]');
  const lblBilan     = document.getElementById('bilan-btn-label');
  const bilanFlowers = document.getElementById('bilan-flowers');

  if (!cardBilan) { updUI(); return; }
  cardBilan.style.display = ''; // toujours visible, peu importe la semaine

  // RÔLE : Calcule la clé weekId de la semaine affichée pour retrouver son bilan dans D.g.bilans.
  // POURQUOI : On indexe les bilans par semaine — le mercredi (wd[3]) est le pivot ISO le plus fiable.
  const weekIdActuel = getWeekId(new Date(wd[3] + 'T12:00'));
  const bilansDico   = window.D.g.bilans ?? {};
  // RÔLE : Cherche le bilan de la semaine affichée ; se rabat sur bilanText si c'est la semaine en cours (rétrocompat).
  const savedBilan   = bilansDico[weekIdActuel] || (wOff === 0 ? window.D.g.bilanText || '' : '');

  // RÔLE : Reset systématique de l'opacity du texte bilan — elle ne doit jamais rester grisée entre navigations.
  if (summaryEl) summaryEl.style.opacity = '1';

  if (wOff > 0) {
    // ── Semaine future : section visible mais désactivée
    if (summaryEl) summaryEl.textContent = 'Pas encore disponible ✿';
    if (btnCopier) btnCopier.style.display = 'none';
    if (btnBilan)  { btnBilan.disabled = true; btnBilan.style.opacity = '0.4'; }
    if (lblBilan)  lblBilan.textContent = '⏳ Pas encore disponible';
    if (bilanFlowers) bilanFlowers.innerHTML = '';

  } else if (wOff < 0) {
    // ── Semaine passée : afficher le bilan archivé de CETTE semaine en lecture seule
    if (summaryEl) {
      summaryEl.textContent = savedBilan || 'Aucun bilan généré pour cette semaine ✿';
    }
    if (hidEl) hidEl.value = savedBilan;
    if (btnCopier) btnCopier.style.display = savedBilan ? 'block' : 'none';
    if (btnBilan)  { btnBilan.disabled = true; btnBilan.style.opacity = '0.4'; }
    if (lblBilan)  lblBilan.textContent = '📁 Bilan archivé';
    if (bilanFlowers) bilanFlowers.innerHTML = '';

  } else {
    // ── Semaine en cours : comportement normal
    if (summaryEl && savedBilan) {
      summaryEl.textContent = savedBilan;
      if (hidEl) hidEl.value = savedBilan;
      if (btnCopier) btnCopier.style.display = 'block';
    } else if (summaryEl && !summaryEl.textContent.trim()) {
      summaryEl.textContent = 'Ton bilan de la semaine apparaîtra ici...';
    }

    // RÔLE : Met à jour le label et l'état du bouton bilan selon le quota et le jour de la semaine.
    // POURQUOI : Le bouton n'est actif que le vendredi, samedi ou dimanche.
    checkBilanReset();
    if (btnBilan && lblBilan) {
      const jourSemaine   = new Date().getDay();
      const estFinSemaine = jourSemaine === 0 || jourSemaine === 5 || jourSemaine === 6;
      const quotaOk       = (window.D.g.bilanCount || 0) < 3;

      if (!estFinSemaine) {
        btnBilan.disabled      = true;
        lblBilan.textContent   = '⏳ Disponible vendredi';
        btnBilan.style.opacity = '0.5';
      } else if (!quotaOk) {
        btnBilan.disabled      = true;
        lblBilan.textContent   = '✓ 3 bilans générés cette semaine';
        btnBilan.style.opacity = '0.5';
      } else {
        btnBilan.disabled      = false;
        lblBilan.textContent   = 'Générer le bilan';
        btnBilan.style.opacity = '1';
      }
    }
    updBilanFlowers(); // met à jour les 3 fleurs de quota
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

      // RÔLE : détecte si c'est un export journal partiel ou une sauvegarde complète
      // POURQUOI : exportJournal() produit { exportDate, journal } — pas un D complet
      const isJournalOnly = imported.exportDate && imported.journal && !imported.g;

      if (isJournalOnly) {
        // Fusion du journal uniquement — ne touche pas au reste de D
        const existing = window.D.journal || [];
        const merged = [...imported.journal];
        existing.forEach(e => {
          if (!merged.find(j => j.date === e.date)) merged.push(e);
        });
        window.D.journal = merged.sort((a, b) => b.date.localeCompare(a.date));
        save();
        toast(`Journal restauré (${imported.journal.length} entrées) ✿`);
        setTimeout(() => location.reload(), 800);
      } else {
        // Sauvegarde complète
        window.D = { ...defs(), ...imported, g: { ...defs().g, ...imported.g } };
        save();
        toast(`Bienvenue de retour ${window.D.g.name} ! ✿`);
        setTimeout(() => location.reload(), 800);
      }
    } catch(err) {
      console.warn('[HabitGotchi] importD() échoué :', err);
      toast(`*perplexe* Ce fichier me semble bizarre... 💜`);
    }
  };
  reader.readAsText(file);
}

// RÔLE : Exécute la suppression réelle des données après confirmation.
// POURQUOI : Extrait de l'attribut onclick inline pour éviter les problèmes de quote
//            si SK contenait un guillemet, et pour garder la logique dans le JS plutôt que dans le HTML.
function doReset() {
  localStorage.removeItem(SK);
  location.reload();
}

function confirmReset() {
  // POURQUOI : on appelle doReset() par nom de fonction — plus robuste qu'une chaîne JS inline
  openModal(`<h3>Tout supprimer ?</h3><div style="display:flex;gap:6px;margin-top:10px"><button class="btn btn-s" onclick="clModal()" style="flex:1">Non</button><button class="btn btn-d" onclick="doReset()" style="flex:1">Oui</button></div>`);
}

/* ─── SYSTÈME 6 : INTROSPECTION & MÉMOIRE (Le Terminal) ──────────── */


/* ============================================================
   TABLETTE RÉTRO
   ============================================================ */
// RÔLE : Date du dernier événement vu dans la tablette, persistée dans D pour survivre à un rechargement.
// POURQUOI : Une variable module-level est perdue si la PWA recharge sans relire ce fichier →
//            le badge se rallumait à tort. En lisant/écrivant dans D (sauvegardé en localStorage),
//            la valeur est toujours disponible après reload.
// (remplace l'ancienne `let tabletLastSeenDate = null`)

function openTablet() {
  const D = window.D;
  const log = D.eventLog || [];

  // Icône choisie selon le type + signe de la valeur (gain/perte XP)
  const getIcon = (ev) => {
  // Le subtype prime sur le type s'il existe
  if (ev.subtype === 'snack') return '🍽️';
  if (ev.subtype === 'poop')  return '💩';
  if (ev.subtype === 'stade') return '🌱';
  if (ev.subtype === 'bain')  return '🛁';

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

  // Masquer le badge + mémoriser la date du plus récent événement (persistée dans D)
  D.tabletLastSeenDate = log.length ? log[0].date : null;
  save(); // POURQUOI : persiste tabletLastSeenDate en localStorage pour survivre à un reload
  document.getElementById('tablet-badge').style.display = 'none';

  document.getElementById('tablet-overlay').classList.add('open');

  // RÔLE : Bloque scroll + inert sur les zones derrière (lockScroll gère les deux — cf. ui-core.js)
  // POURQUOI : #tablet-overlay est à z-index:400 — au-dessus de .modal (300).
  //            Sans lockScroll, le fond reste scrollable et les éléments de #console-top
  //            restent cliquables sous la zone de padding en haut de l'overlay.
  lockScroll();

  // RÔLE : Fermeture par la touche Escape (accessibilité clavier + cohérence avec les modales)
  // POURQUOI : Les modales standards se ferment sur Escape via le navigateur — la tablette doit
  //            se comporter de la même façon. Le listener se retire lui-même après usage.
  function _onEscTablet(ev) {
    if (ev.key === 'Escape') { closeTablet({ target: document.getElementById('tablet-overlay') }); document.removeEventListener('keydown', _onEscTablet); }
  }
  document.addEventListener('keydown', _onEscTablet);
}

function closeTablet(e) {
  // Ferme seulement si on clique sur le fond, pas sur la tablette
  if (e.target === document.getElementById('tablet-overlay')) {
    document.getElementById('tablet-overlay').classList.remove('open');
    unlockScroll(); // RÔLE : restitue scroll + inert via unlockScroll (cf. ui-core.js)
  }
}

function updTabletBadge() {
  const log = (window.D?.eventLog || []);
  const badge = document.getElementById('tablet-badge');
  if (!badge) return;
  
  // Badge visible si un événement est plus récent que la dernière ouverture
  // POURQUOI : on lit dans D (persisté) et non plus dans une variable module-level volatile
  const plusRecent = log[0]?.date;
  if (plusRecent && plusRecent !== (window.D?.tabletLastSeenDate ?? null)) {
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
  // POURQUOI : on ne teste QUE !D.firstLaunch, pas le nom.
  // Tester D.g.name === 'Petit·e Gotchi' re-déclenchait le wizard après une mise à jour
  // si le localStorage avait été vidé ou si le merge avec defs() ramenait la valeur par défaut.
  if (!D.firstLaunch) {
    D.firstLaunch = new Date().toISOString();
    save();
    showWelcomeModal();
    return;
  }

  // 2. Anniversaire — affiché une fois par jour si USER_CONFIG le définit
  // RÔLE : Affiche une modale surprise le jour de l'anniversaire.
  // POURQUOI : La date et le message viennent de user_config.json — rien n'est hardcodé.
  //            Si birthday.month est null → ce bloc est ignoré entièrement.
  const bday = window.USER_CONFIG?.birthday;
  if (bday?.month && !D.g.birthdayShown) {
    const now = new Date();
    if (now.getMonth() + 1 === bday.month && now.getDate() === bday.day) {
      D.g.birthdayShown = true;
      save();
      document.getElementById('modal').style.display = 'flex';
      document.getElementById('mbox').innerHTML = `
        <div style="text-align:center;padding:var(--sp-sm)">
          <div style="font-size:40px">🎂</div>
          <p style="font-size:12px;color:var(--text);margin:12px 0;line-height:1.6;white-space:pre-line">${bday.message || 'Joyeux anniversaire 💜'}</p>
          <button class="btn btn-p" onclick="clModal()" style="margin-top:8px;width:100%">Merci 💜</button>
        </div>
      `;
      animEl(document.getElementById('mbox'), 'bounceIn');
      return;
    }
  }

  // 3. Garde anti-répétition : une seule fois par créneau
  const créneau = h < 12 ? 'matin' : h < 18 ? 'aprem' : h < 21 ? 'soir' : 'nuit';
  const done = (D.log[td] || []).length;
  const etatActuel = `${td}-${créneau}-${done}`;
  if (D.lastWelcomeState === etatActuel) return;

  // 4. Calcul jours d'absence (avant de mettre à jour lastActive)
  let joursAbsence = 0;
  if (D.lastActive) {
    const diff = Date.now() - new Date(D.lastActive);
    joursAbsence = Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  // 5. Cadeaux-IA reçus depuis la dernière visite (achats boutique exclus)
  const derniereVisite = D.lastActive || td;
  const nouveauxCadeaux = (D.eventLog || []).filter(ev =>
    ev.type === 'cadeau' &&
    ev.subtype === 'ia' &&
    new Date(ev.date) > new Date(derniereVisite)
  ).length;

  // 6. Mise à jour de la session
  D.lastWelcomeState = etatActuel;
  D.lastActive = new Date().toISOString();
  save();

  // ❌ SUPPRIMÉ : ancien `if (!D.firstLaunch…)` dupliqué — code mort

  // 7. Contenu selon contexte
  let titre, corps, extra = '';

  // ✏️ UNIFIÉ : pénalité unique pour toute absence ≥ 1 jour (-15 XP × jours)
  if (joursAbsence >= 1) {
    const xpPerdu = joursAbsence * XP_HABITUDE; // même valeur que l'XP d'une habitude
    addXp(-xpPerdu);
    addEvent({ type: 'xp', subtype: 'absence', valeur: -xpPerdu, label: `${joursAbsence} jour${joursAbsence > 1 ? 's' : ''} d'absence — -${xpPerdu} XP` });

    // Message doux pour 1 jour, plus marqué au-delà
    if (joursAbsence === 1) {
      titre = `Bienvenue 🌸`;
      corps = `Tu as perdu <strong>${XP_HABITUDE} XP</strong> hier — pas d'habitudes cochées.`;
      flashBubble("Tu m'avais oubliée... 💜", 3000);
    } else {
      titre = `Ça fait ${joursAbsence} jours... 💜`;
      corps = `${D.g.name} t'a attendue. Tu as perdu <strong>${xpPerdu} XP</strong> pendant ton absence.`;
    }
  } else if ((h === 22 && new Date().getMinutes() >= 30) || h === 23) {
    // RÔLE : Soir tardif (22h30–23h29) — le Gotchi est dans sa chambre mais pas encore endormi.
    // POURQUOI : Cohérent avec le pool soirTardif des bulles et le flash chambre à 22h30.
    titre = `*bâille* 🌙`;
    corps = getEveningMsg(); // on réutilise les messages de soirée — ton déjà calme
  } else if ((h === 23 && new Date().getMinutes() >= 30) || (h >= 0 && h < 7)) {
    // RÔLE : Nuit vraie (23h30–7h) — le Gotchi dort.
    titre = `*chuchote* 🌙`;
    corps = getNightMsg();
  } else if (h < 12) {
    titre = getMorningTitle();
    corps = getMorningMsg();
  } else if (h < 14) {
    // RÔLE : Créneau midi (12h–14h) — message distinct du reste de l'après-midi
    titre = getMidiTitle();
    corps = getMidiMsg();
  } else if (h < 18) {
    titre = getAfternoonTitle();
    corps = getAfternoonMsg();
  } else {
    titre = `Bonne soirée 🌙`;
    corps = getEveningMsg();
  }

  if (nouveauxCadeaux > 0) {
    extra = `<p style="margin-top:8px;font-size:12px;text-align:center">🎁 ${nouveauxCadeaux} nouveau${nouveauxCadeaux > 1 ? 'x cadeaux' : ' cadeau'} depuis ta dernière visite !</p>`;
  }

  // RÔLE : Les messages du Gotchi (corps en italique) sont stylés différemment des messages système
  // POURQUOI : Quand c'est le Gotchi qui parle, on enveloppe le corps dans <em> pour l'italique
  //            Tous les corps de message retournent déjà du texte — l'italique est appliqué ici globalement
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `
    <div style="text-align:center">
      <h3>${titre}</h3>
      <p style="font-size:12px;margin:8px 0;font-style:italic;font-family:var(--font-gotchi);line-height:1.6">${corps}</p>
      ${extra}
      <button class="btn btn-p" style="width:100%;margin-top:10px" onclick="clModal()">C'est parti ✿</button>
    </div>
  `;
  animEl(document.getElementById('mbox'), 'bounceIn');
}

// ── Utilitaire interne : prénom de l'utilisatrice ou fallback
// POURQUOI : Mutualisé pour éviter la répétition dans chaque fonction de message
function _prenom() {
  const D = window.D;
  return D.g.userNickname || D.g.userName || D.userName || 'toi';
}

// ── Utilitaire interne : pioche aléatoirement dans un tableau
function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/* ─── TITRES des modales welcome ─────────────────────────────────── */
// RÔLE : Retourne le titre de la modale selon le créneau — peut varier selon le jour
// POURQUOI : Séparé du corps pour pouvoir évoluer indépendamment (emoji, ton)

function getMorningTitle() {
  const jour = new Date().getDay(); // 0=dim, 1=lun, …, 5=ven, 6=sam
  if (jour === 1) return `Bon lundi ☀️`;  // lundi spécial
  if (jour === 5) return `Bon vendredi ✨`;
  if (jour === 0 || jour === 6) return `Bonne matinée 🌸`;
  return `Bon matin ☀️`;
}

function getMidiTitle() {
  return _pick([`C'est l'heure du midi 🍵`, `Pause déjeuner ✿`, `Midi déjà ☀️`]);
}

function getAfternoonTitle() {
  const jour = new Date().getDay();
  if (jour === 3) return `Milieu de semaine ✿`; // mercredi
  if (jour === 5) return `Vendredi après-midi 🎉`;
  return `Bon après-midi ✿`;
}

/* ─── CORPS des modales welcome ──────────────────────────────────── */
// RÔLE : Retourne le message du Gotchi selon l'heure, le jour, le streak, les habitudes
// CONVENTION : Les textes en *astérisques* sont les actions du Gotchi (gestuelles, sons)

function getMorningMsg() {
  const D   = window.D;
  const str = calcStr();
  const prenom = _prenom();
  const jour   = new Date().getDay();
  const done   = (D.log[today()] || []).length;
  const name   = D.g.name;

  // Streak élevé — priorité sur tout
  if (str >= 10) return `${str} jours d'affilée, ${prenom}... *fait des bonds* On est inarrêtables 🔥`;
  if (str >= 7)  return `*s'étire* ${str} jours de suite. Tu m'impressionnes vraiment 💜`;
  if (str >= 3)  return `${str} jours d'affilée ! On continue ? *agite les pattes* ✿`;

  // Lundi matin — message motivant pour la semaine
  if (jour === 1) return _pick([
    `*saute sur place* Nouvelle semaine, ${prenom} ! On repart à zéro 🌱`,
    `*frotte les yeux* Lundi... mais avec toi c'est pas si dur 💜`
  ]);

  // Vendredi matin — on sent la fin de semaine
  if (jour === 5) return _pick([
    `*chante* Vendredi ! Plus qu'une journée, ${prenom} 🎉`,
    `Dernier effort, ${prenom} — le week-end est tout proche ✿`
  ]);

  // Week-end
  if (jour === 0 || jour === 6) return _pick([
    `*bâille doucement* Week-end ! Prends soin de toi aujourd'hui 🌸`,
    `${name} est content·e de te voir ce ${jour === 6 ? 'samedi' : 'dimanche'} ✿`
  ]);

  // Déjà des habitudes cochées ce matin
  if (done >= 1) return `*sautille* ${done} déjà cochée${done > 1 ? 's' : ''} ce matin — tu démarres fort 🌟`;

  // Fallback varié
  return _pick([
    `*s'étire* Coucou ${prenom} ! Je t'attendais 🌸`,
    `${name} est réveillé·e et prêt·e — et toi ? ☀️`,
    `*bâille* Bonjour ${prenom}... on va bien commencer cette journée 💜`
  ]);
}

function getMidiMsg() {
  // RÔLE : Messages spécifiques au créneau midi (12h–14h)
  const D    = window.D;
  const done = (D.log[today()] || []).length;
  const prenom = _prenom();
  const name   = D.g.name;
  const ha     = D.g.happiness;

  if (done >= 4) return `*admire* ${done} habitudes avant midi, ${prenom} ! ${name} est très fier·e 🌟`;
  if (done >= 2) return `*approuve* ${done} de cochées ce matin — pause méritée ✿`;
  if (done === 1) return `1 habitude ce matin, c'est un début ! *encourage* L'après-midi est encore là 💜`;
  if (ha <= 2)  return `*te regarde avec douceur* Tu sembles peu en forme ce midi... prends une vraie pause 💜`;
  return _pick([
    `*renifle* Ça sent le repas de midi... tu prends soin de toi ? 🍵`,
    `Coucou ${prenom} ! ${name} surveille que tu manges bien à midi 🌸`,
    `*s'installe confortablement* Profite de ta pause — l'après-midi arrive vite ✿`
  ]);
}

function getAfternoonMsg() {
  const D    = window.D;
  const done = (D.log[today()] || []).length;
  const prenom = _prenom();
  const name   = D.g.name;
  const jour   = new Date().getDay();
  const total  = D.habits.length || 6;

  // Mercredi après-midi — milieu de semaine
  if (jour === 3) return _pick([
    `*souffle* Milieu de semaine... tu gères vraiment bien, ${prenom} 💜`,
    `Mercredi déjà ! ${done}/${total} aujourd'hui — continue comme ça ✿`
  ]);

  // Vendredi après-midi — fin de semaine imminente
  if (jour === 5) return _pick([
    `*trépigne* Presque le week-end, ${prenom} ! ${done}/${total} aujourd'hui 🎉`,
    `Vendredi après-midi — ${name} est fier·e de cette semaine 💜`
  ]);

  if (done >= total) return `*danse* Tu as tout coché aujourd'hui, ${prenom} ! Je suis aux anges 🌟`;
  if (done >= 4)     return `${done} habitudes déjà ! *applaudit* Je suis fier·e de toi ✿`;
  if (done >= 1)     return `${done} cochée${done > 1 ? 's' : ''} — tu avances bien, ${prenom} ✿`;
  return _pick([
    `*te regarde* Il reste encore du temps pour aujourd'hui 💜`,
    `${name} croit en toi — l'après-midi est encore longue ✿`,
    `*pointe les habitudes* Allez ${prenom}, on peut encore en cocher quelques-unes 🌱`
  ]);
}

function getEveningMsg() {
  const D    = window.D;
  const done = (D.log[today()] || []).length;
  const prenom = _prenom();
  const name   = D.g.name;
  const ha     = D.g.happiness;
  const jour   = new Date().getDay();
  const total  = D.habits.length || 6;

  // Dimanche soir — fin de semaine
  if (jour === 0) return _pick([
    `*soupire doucement* Dimanche soir déjà... tu as bien géré cette semaine, ${prenom} 💜`,
    `Fin de semaine. ${done}/${total} aujourd'hui. ${name} est content·e de t'avoir eu·e 🌸`
  ]);

  if (done >= total) return `*rayonne* ${total}/${total} aujourd'hui !! Tu as tout fait, je suis aux anges 🎉`;
  if (ha <= 2)       return `*câlin pixel* Tu sembles fatiguée ce soir, ${prenom}. Prends soin de toi 💜`;
  if (done === 0)    return _pick([
    `*te regarde doucement* Pas d'habitudes aujourd'hui... c'est ok. Demain ✿`,
    `0 aujourd'hui — et c'est pas grave. ${name} t'aime quand même 💜`
  ]);
  return _pick([
    `${done}/${total} aujourd'hui. Bien joué, ${prenom} — pose-toi maintenant 💜`,
    `*s'étire* Belle soirée, ${prenom}. Tu as fait de ton mieux ✿`,
    `${done} cochées — ${name} est fier·e. Repose-toi bien 🌙`
  ]);
}

function getNightMsg() {
  const D    = window.D;
  const done = (D.log[today()] || []).length;
  const prenom = _prenom();
  const name   = D.g.name;
  const total  = D.habits.length || 6;

  if (done >= total) return `*ronronne* Journée parfaite, ${prenom}... dors bien 🌙`;
  if (done >= 3)     return _pick([
    `*bâille* Bonne nuit ${prenom}... à demain 💜`,
    `*éteint une bougie* ${done}/${total} aujourd'hui. Dors bien 🌙`,
    `*chuchote* ${name} veille. Bonne nuit 💜`
  ]);
  return _pick([
    `*murmure* Je veille. Dors bien 🌙`,
    `*chuchote* C'est tard, ${prenom}... repose-toi 💜`,
    `*s'allonge* Bonne nuit. Demain sera une nouvelle journée ✿`
  ]);
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
    'sale10':     () => { D.g.salete = 10; toast('🛁 Gotchi tout sale ! (salete → 10)'); },
    'petales50':  () => { D.g.petales = (D.g.petales || 0) + 50; toast('🌸 +50 pétales !'); },
    'petales200': () => { D.g.petales = (D.g.petales || 0) + 200; toast('🌸 +200 pétales !'); },
    'egg':        () => { D.g.totalXp = 0;   D.g.stage = 'egg';   toast('🥚 Stade → Œuf'); },
    'baby':       () => { D.g.totalXp = 90;  D.g.stage = 'baby';  toast('🌱 Stade → Baby'); },
    'teen':       () => { D.g.totalXp = 240; D.g.stage = 'teen';  toast('🌿 Stade → Teen'); },
    'adult':      () => { D.g.totalXp = 500; D.g.stage = 'adult'; toast('🌸 Stade → Adulte'); },
    'vent':       () => { window.meteoData = { ...(window.meteoData || {}), windspeed: 50 }; toast('🌬️ Vent activé !'); },
    'calme':      () => { window.meteoData = { ...(window.meteoData || {}), windspeed: 5 };  toast('☀️ Vent désactivé'); },
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
    'resetmsg3':    () => { D.thoughtCount = 0; D.lastThoughtDate = null; toast('💬 Quota pensées → 0/5'); },
    // RÔLE : Vide l'inventaire et remet uniquement les objets de départ (props_base).
    // POURQUOI : Permet de tester l'état "nouveau joueur·se" sans réinitialiser toute la save.
    //            On utilise window.PROPS_BASE (exposé dans app.js au chargement) qui contient
    //            exclusivement le catalogue props_base.json — sans shop ni packs.
    'resetinv': () => {
      const base = window.PROPS_BASE || [];
      // Reconstruit l'inventaire proprement : seulement les props_base, tous inactifs
      D.g.props = base.map(p => ({ id: p.id, nom: p.nom, type: p.type, emoji: p.emoji, actif: false }));
      toast('🗑️ Inventaire remis à zéro (objets de départ uniquement)');
    },
    // RÔLE : Code cheat anniversaire — offre des pétales et remet les compteurs à zéro.
    // POURQUOI : Le mot de passe et le bonus viennent de user_config.json.
    //            Si birthday.month est null → le code n'existe pas, toast "Code inconnu".
    [window.USER_CONFIG?.birthday?.cheatCode]: window.USER_CONFIG?.birthday?.month
      ? () => {
          if (D.g.birthdayCodeUsed) { toast('Ce code a déjà été utilisé 🌸'); return; }
          D.g.birthdayCodeUsed = true;
          D.g.petales = (D.g.petales || 0) + (window.USER_CONFIG.birthday.petalesBonus || 50);
          D.g.snackDone = ''; D.g.snackEmoji = '';
          D.g.poops = []; D.g.poopCount = 0; D.g.poopDay = '';
          window.D.lastThoughtDate = null; window.D.thoughtCount = 0;
          toast(`🎂 Cadeau activé ! +${window.USER_CONFIG.birthday.petalesBonus || 50} pétales 🌸`);
        }
      : undefined,
  };

  if (codes[code]) {
    codes[code]();
    save(); updUI();
  } else {
    toast('❓ Code inconnu');
  }
}


/* ============================================================
   BOTTOM SHEET — "COMMENT TU TE SENS ?"
   RÔLE : Ouvre une bottom sheet (même style que le formulaire RDV) permettant
          de régler l'énergie et le bonheur via deux sliders ronds.
   POURQUOI : Remplace le bloc #sliders-wrap supprimé du #console-top.
              Accessible uniquement depuis l'écran d'accueil (tap sur les badges canvas).
   ============================================================ */

function ouvrirModalEtats() {
  // RÔLE : Sécurité — ne s'ouvre que si on est sur l'onglet Gotchi (écran d'accueil)
  if (!window._gotchiActif) return;

  // RÔLE : Empêche l'ouverture en doublon si la sheet est déjà visible
  if (document.getElementById('etats-overlay')) return;

  const g = window.D.g;

  // RÔLE : Crée l'overlay semi-transparent qui capture les taps extérieurs pour fermer
  const overlay = document.createElement('div');
  overlay.id = 'etats-overlay';
  // POURQUOI pointer-events:auto : même logique que .app-overlay — garantit que l'overlay
  // créé dynamiquement capte bien les taps sur sa zone semi-transparente.
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:1000;
    background:rgba(0,0,0,0.35);
    display:flex;align-items:flex-end;justify-content:center;
    pointer-events:auto;
  `;

  // RÔLE : Ferme la sheet si on tape sur l'overlay (hors de la sheet)
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) fermerModalEtats();
  });

  // RÔLE : Fermeture par Escape — cohérence avec openTablet() et les modales standards
  function _onEscEtats(ev) {
    if (ev.key === 'Escape') { fermerModalEtats(); document.removeEventListener('keydown', _onEscEtats); }
  }
  document.addEventListener('keydown', _onEscEtats);

  // RÔLE : Contenu de la bottom sheet
  // POURQUOI : Les inputs n'ont pas de style inline — tout le rendu du slider est géré par
  //            #etats-sheet input[type=range] dans style.css pour éviter les conflits webkit.
  overlay.innerHTML = `
    <div id="etats-sheet" style="
      background:var(--bg,#fff);
      border-radius:16px 16px 0 0;
      padding:20px 20px 40px;
      width:100%;max-width:420px;
      animation:slideUp .25s ease-out;
      box-sizing:border-box;
    ">
      <!-- Poignée décorative -->
      <div style="width:36px;height:4px;background:var(--border);
        border-radius:2px;margin:0 auto 18px;opacity:.5"></div>

      <!-- Titre principal — Caveat, plus grand que les labels énergie/bonheur -->
      <h3 style="font-size:26px;color:var(--lilac);margin-bottom:24px;
        font-family:var(--font-title);font-weight:700;text-align:center;letter-spacing:0.3px">
        Comment tu te sens là ?
      </h3>

      <!-- Slider Énergie -->
      <div style="margin-bottom:28px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <!-- POURQUOI : --fs-sm (13px) < titre (16px) — hiérarchie titre > labels maintenue -->
          <!-- POURQUOI : l'emoji est dans un span séparé sans color/text-transform pour rester en couleur native -->
          <span style="font-size:var(--fs-sm);font-weight:bold;color:var(--text2)">
            <span style="font-size:var(--fs-sm)">⚡</span>
            <span style="text-transform:uppercase;letter-spacing:0.5px"> Énergie</span>
          </span>
          <span id="modal-sv-energy" style="font-size:var(--fs-sm);font-weight:bold;
            color:var(--lilac);min-width:20px;text-align:right">${g.energy}</span>
        </div>
        <!-- POURQUOI : pas de style inline sur l'input — géré entièrement par #etats-sheet input[type=range] -->
        <input type="range" id="modal-sl-energy"
          min="0" max="5" step="1" value="${g.energy}"
          oninput="setEnergy(this.value)">
      </div>

      <!-- Slider Bonheur -->
      <div style="margin-bottom:28px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <span style="font-size:var(--fs-sm);font-weight:bold;text-transform:uppercase;
            letter-spacing:0.5px;color:var(--text2)">✿ Bonheur</span>
          <span id="modal-sv-happy" style="font-size:var(--fs-sm);font-weight:bold;
            color:var(--lilac);min-width:20px;text-align:right">${g.happiness}</span>
        </div>
        <input type="range" id="modal-sl-happy"
          min="0" max="5" step="1" value="${g.happiness}"
          oninput="setHappy(this.value)">
      </div>

      <!-- Bouton fermeture -->
      <button onclick="fermerModalEtats()" class="btn btn-p"
        style="width:100%;font-size:var(--fs-sm)">
        ✓ Enregistrer
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  // RÔLE : Bloque scroll + inert sur les zones derrière (lockScroll gère les deux — cf. ui-core.js)
  lockScroll();
}

// RÔLE : Ferme et supprime la bottom sheet des états
function fermerModalEtats() {
  const overlay = document.getElementById('etats-overlay');
  if (overlay) overlay.remove();
  unlockScroll(); // RÔLE : restitue scroll + inert via unlockScroll (cf. ui-core.js)
}

// RÔLE : Expose les fonctions pour y accéder depuis render.js (tap canvas)
window.ouvrirModalEtats  = ouvrirModalEtats;
window.fermerModalEtats  = fermerModalEtats;



/* ─── resetGarden() ────────────────────────────────────────── */

/**
 * resetGarden()
 * RÔLE : Régénère un jardin entièrement nouveau en effaçant la seed et gardenState.
 *        La prochaine exécution d'initGarden() tirera une nouvelle seed → jardin différent.
 *
 * POURQUOI ce comportement :
 *   - gardenSeed = null → initGarden() tirera une nouvelle seed aléatoire
 *   - gardenState = []  → tous les âges seront remis à 0
 *   - save() → persiste immédiatement avant d'appeler initGarden()
 *   - initGarden() recalcule window._gardenElements depuis la nouvelle seed
 *
 * APPELÉE PAR : le bouton "🌱 Régénérer le jardin" dans les réglages (index.html).
 */
function resetGarden() {
  if (!window.D || !window.D.g) return; // garde-fou

  // RÔLE : Confirme l'action — le jardin actuel sera perdu (âges remis à 0).
  // POURQUOI confirm() : action irréversible sur la save — même convention que confirmReset().
  if (!confirm('Régénérer le jardin ? Le jardin actuel sera perdu (nouveau dessin, âges remis à zéro).')) return;

  // RÔLE : Efface seed et état — initGarden() recalculera tout depuis zéro.
  window.D.g.gardenSeed  = null;
  window.D.g.gardenState = [];
  save(); // RÔLE : Persiste l'effacement avant initGarden() pour éviter de perdre la mise à zéro si l'app crashe.

  // RÔLE : Recalcule immédiatement le jardin avec une nouvelle seed.
  if (typeof window.initGarden === 'function') window.initGarden();

  toast('🌱 Nouveau jardin généré !');
}
window.resetGarden = resetGarden;

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

  const h = hr();
  window.D.g.activeEnv = (h >= 21 || h < 7) ? 'chambre' : 'parc';

  updUI();
  syncConsoleHeight();
  renderHabs();
  renderProps();
  restorePerso();
  renderPropThemes(); // RÔLE : Initialise les tags de thèmes IA dans les Réglages
  initMoodPicker();
  checkWelcome();
  updBubbleNow();

  const vEl = document.getElementById('APP_VERSION');
  if (vEl) vEl.textContent = window.APP_VERSION || '';

  // RÔLE : Injecte le SVG chevron dans les boutons .nav-a (◀▶ journal + progression)
  // POURQUOI : Ces boutons sont dans le HTML statique (index.html) — on ne peut pas appeler
  //            chevronNav() directement dans le template. On remplace le contenu à l'init,
  //            ce qui garantit la cohérence même si de nouveaux .nav-a apparaissent plus tard.
  document.querySelectorAll('.nav-a').forEach(btn => {
    if (btn.querySelector('svg')) return; // déjà injecté
    const label = btn.getAttribute('aria-label') || '';
    const isLeft = label.toLowerCase().includes('précédente') || label.toLowerCase().includes('gauche');
    btn.innerHTML = isLeft ? chevronNav('left') : chevronNav('right');
  });

  // RÔLE : Injecte le SVG chevron dans les <summary> des sections Réglages
  // POURQUOI : Le ::after CSS a été remplacé par du SVG pour harmoniser avec le reste.
  //            On ajoute un <span class="settings-chevron"> à la fin de chaque summary.
  document.querySelectorAll('details.settings-section > summary').forEach(summary => {
    if (summary.querySelector('.settings-chevron')) return; // ← garde-fou anti-doublon
    const span = document.createElement('span');
    span.className = 'settings-chevron';
    span.innerHTML = chevron('down');
    summary.appendChild(span);
  });

  // Tap sur le tama depuis un autre onglet → retour accueil
  document.querySelector('.tama-screen')?.addEventListener('pointerdown', function() {
    const modalEl = document.getElementById('modal');
    const modalOuverte = modalEl && getComputedStyle(modalEl).display !== 'none';
    if (!window._gotchiActif && !modalOuverte && typeof go === 'function') go('gotchi');
  });

  // RÔLE : Masque le bouton agenda si showRDV et showCycle sont tous les deux false.
  // POURQUOI : Logique métier liée à USER_CONFIG — centralisée ici plutôt qu'en inline dans
  //            index.html. Le bouton ouvre un agenda qui contient RDV et Cycle — si les deux
  //            sont désactivés, il n'a plus de raison d'être affiché.
  if (typeof showCycle === 'function' && typeof showRDV === 'function') {
    if (!showCycle() && !showRDV()) {
      const btn = document.getElementById('btn-menu-agenda');
      if (btn) btn.style.display = 'none';
    }
  }
}; // ferme window.initUI = function()
// FIN ui.js