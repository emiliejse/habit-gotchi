/* ============================================================
   app.js — Données, save/load, logique métier, chargement fichiers
   RÔLE : C'est le "Cerveau" de l'application. Gère la sauvegarde, 
   les mathématiques (XP, pétales), le temps, et l'humeur.
   ============================================================ */

   /* ============================================================
   UTILITAIRES (déclarés en premier — utilisés partout)
   ============================================================ */
const today  = () => new Date().toISOString().split('T')[0];
const todayFr = () => new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const hr = () => window._forceHour ?? new Date().getHours();
const clamp  = (v,a,b) => Math.max(a, Math.min(b, v));

/* ─── SYSTÈME 7 : INGÉNIERIE & ARCHITECTURE GLOBALE ────────────── */

/* ============================================================
   VARIABLES GLOBALES PARTAGÉES (window.X pour tous les fichiers)
   ============================================================ */
window.D            = null;   // données utilisateur (LocalStorage)
window.PROPS_LIB    = [];     // catalogue (data/props.json)
window.PROPS_LOCAL  = [];     // objets générés par l'IA (session)
window.PERSONALITY  = null;   // data/personality.json
window.AI_CONTEXTS  = null;   // prompts/ai_contexts.json
window.AI_SYSTEM    = null;   // prompts/ai_system.json

// Variables partagées avec render.js pour l'affichage
window.celebQueue = [];
window.shakeTimer = 0;
window.meteoData  = null;
window._gotchiActif = true;


// VERSION À CHANGER
window.APP_VERSION = 'v2.45'; // // ⚠️ SYNC → sw.js ligne 1 : CACHE_VERSION

// Limites journal (S6 — Introspection)
window.JOURNAL_MAX_PER_DAY = 5;
window.JOURNAL_MAX_CHARS   = 600;

/* ============================================================
   CHARGEMENT FICHIERS DATA + PROMPTS
   ============================================================ */
// Charge de manière asynchrone tous les JSON nécessaires au démarrage
async function loadDataFiles() {
  const base = 'data/';
  const promptsBase = 'prompts/';
  try {
    const results = await Promise.allSettled([
      fetch(base + 'props.json').then(r => r.json()),              // 0
      fetch(base + 'personality.json').then(r => r.json()),        // 1
      fetch(promptsBase + 'ai_contexts.json').then(r => r.json()), // 2
      fetch(promptsBase + 'ai_system.json').then(r => r.json()),   // 3
    ]);

    // Initialisation du catalogue d'objets
    if (results[0].status === 'fulfilled') {
      window.PROPS_LIB = results[0].value.catalogue || [];
      window.PROPS_LIB.forEach(prop => {
        // Ajoute automatiquement les objets gratuits (cout = 0) à l'inventaire
        if (prop.cout === 0 && window.D && !window.D.g.props.find(p => p.id === prop.id)) {
          D.g.props.push({ id: prop.id, nom: prop.nom, type: prop.type, emoji: prop.emoji, actif: false });
        }
      });
      save(); renderProps(); updBadgeBoutique();
    }
    if (results[1].status === 'fulfilled') window.PERSONALITY = results[1].value;
    if (results[2].status === 'fulfilled') window.AI_CONTEXTS = results[2].value;
    if (results[3].status === 'fulfilled') window.AI_SYSTEM   = results[3].value;

    console.log('✿ Data chargée:', window.PROPS_LIB.length, 'props');
  } catch(e) { console.log('Mode local (fichiers data absents)'); }
}

/* ─── SYSTÈME 4 : MOTEUR DE ROUTINE & PROGRESSION ──────────────── */

/* ============================================================
   CONSTANTES MÉTIER
   ============================================================ */
const SK = 'hg4'; // Clé du LocalStorage (HabitGotchi v4)

const CATS = [
  {id:'sport',   icon:'🏋️', label:'Sport',       def:'Bouger → énergie pour nous deux'},
  {id:'nutri',   icon:'🍎', label:'Nutrition',    def:'Bien manger → je grandis avec toi'},
  {id:'hydra',   icon:'💧', label:'Hydratation',  def:'S\'hydrater → je reste en forme'},
  {id:'hygiene', icon:'🪞', label:'Hygiène',      def:'Prendre soin de toi → je rayonne'},
  {id:'intel',   icon:'📚', label:'Intellectuel', def:'Apprendre → mon monde s\'agrandit'},
  {id:'serene',  icon:'🕯️', label:'Sérénité',     def:'Souffler → on se calme ensemble'},
];

// Paliers d'évolution (Xp -> Stade visuel -> Titre)
const STG = [
  {k:'egg',   l:'Œuf',        th:0},
  {k:'baby',  l:'Apprentie', th:90},
  {k:'teen',  l:'Initiée',   th:240},
  {k:'adult', l:'Adepte',     th:500},
  {k:'adult', l:'Experte',   th:900},
  {k:'adult', l:'Girl Boss', th:1500},
  {k:'adult', l:'Légende',    th:2500},
  {k:'adult', l:'Déesse',   th:4000},
];

/* ─── SYSTÈME 3 : COGNITION & IA ───────────────────────────────── */

// Fallback minimal si personality.json absent (Phrases d'urgence)
const MSG = {
  matin:   ["Bon matin ☀️"], aprem: ["On avance ✿"],
  soir:    ["On se pose ✿"], nuit:  ["Zzz... 🌙"],
  peu:     ["Je suis là ✿"], fierte: ["Tu déchires !! 🌟"],
  max:     ["PARFAIT !! 🎉"], triste: ["Tout doux 🌸"],
  fatigue: ["Repos = productif ✿"], vent: ["Ça souffle ! 🌬️"],
  idle:    ["*sourit*"],
};

/* ─── SYSTÈME 7 : INGÉNIERIE (Suite) ───────────────────────────── */

/* ============================================================
   DONNÉES & SAVE / LOAD
   ============================================================ */
// Structure JSON de base (si nouvel utilisateur)
function defs() {
  return {
    g: {
      name:'Petit·e Gotchi', userName: 'Émilie', userNickname: '', totalXp:0, stage:'egg', energy:3, happiness:3,
envLv:0, activeEnv:'parc', petales:0,poops: [], poopDay: '',    // date du dernier comptage
poopCount: 0,  // nb de cacas spawné aujourd'hui
snackDone: '', snackEmoji: '',
      props:[], customBubbles:[],
      bilanCount: 0,
      bilanWeek: '',
      bilanText: '',
      lastTick: Date.now(),
      lat: 43.6047,
      lng: 1.4442,
      solarPhases: null,
      cycleDuree: 28,// durée du cycle en jours
    },
    habits: CATS.map(c => ({catId:c.id, label:c.label})),
    log:{}, journal:[], pin:null, apiKey:null,
    lastThoughtDate: null,
thoughtCount: 0,
lastSoutienDate: null,
lastJournalExport: null,
soutienCount: 0,
eventLog: [],        // historique (max 50)
firstLaunch: null,   // sera rempli au 1er lancement
lastActive: null,    // mis à jour à chaque ouverture
cycle: [], // { date: "2025-04-10", type: "regles" }
rdv:   [], // { id, date, label, heure? }
  };
}

// 🌸 Calcul de la phase du cycle pour une date donnée
function getCyclePhase(dateStr) {
  const cycles = (window.D.cycle || [])
    .filter(e => e.type === 'regles')
    .map(e => e.date)
    .sort()
    .reverse();

  if (!cycles.length) return null;

  const j1    = new Date(cycles[0] + 'T12:00');
  const cible = new Date((dateStr || today()) + 'T12:00');
  const diff  = Math.floor((cible - j1) / 86400000);
  const duree = window.D.g.cycleDuree || 28;
  const j     = ((diff % duree) + duree) % duree + 1; // J1 à J28

  if (j <= 5)          return { phase: 'menstruelle',  j, label: 'Règles',       couleur: '#e07080' };
  if (j <= 13)         return { phase: 'folliculaire', j, label: 'Folliculaire', couleur: '#80b8e0' };
  if (j <= 16)         return { phase: 'ovulation',    j, label: 'Ovulation',    couleur: '#60c8a0' };
  return               { phase: 'lutéale',             j, label: 'Lutéale',      couleur: '#b090d0' };
}
window.getCyclePhase = getCyclePhase; // exposée globalement

// Chargement avec fusion (Spread Operator) pour éviter de casser les anciennes sauvegardes
function load() {
  try {
    const r = localStorage.getItem(SK);
    if (r) {
      const d = JSON.parse(r);
      if (d.habits) d.habits = d.habits.map(h => {
        const cat = CATS.find(c => c.id === h.catId);
        const isBrut = cat && h.label === h.catId;
        return isBrut ? {...h, label: cat.label} : h;
      });
      return {...defs(), ...d, g:{...defs().g, ...d.g}, habits:d.habits||defs().habits};
    }
  } catch(e) {}
  return defs();
}

// Sauvegarde synchrone dans le LocalStorage
function save() {
  try { localStorage.setItem(SK, JSON.stringify(window.D)); } catch(e) {}
}

// Dérive le diminutif du prénom (premier mot, accents conservés)
function computeNickname(full) {
  return (full || '').trim().split(/\s+/)[0] || 'toi';
}

// Initialisation au démarrage
window.D = load();
// Calcul runtime : ne remplace un userNickname explicitement défini que s'il est vide
if (!window.D.g.userNickname) {
  window.D.g.userNickname = computeNickname(window.D.g.userName);
}

// Restaure les pixels des props générés par Claude (Évite de faire appel à l'IA à chaque F5)
if (window.D.propsPixels && Object.keys(window.D.propsPixels).length) {
  window.PROPS_LOCAL = Object.values(window.D.propsPixels);
}


/* ============================================================
   UTILITAIRES
   ============================================================ */
// Hard reset : vide le cache du navigateur pour forcer les updates PWA
function forceUpdate() {
  if ('caches' in window) {
    caches.keys().then(names => { names.forEach(name => caches.delete(name)); });
  }
  toast(`Mise à jour en cours... ✿`);
  setTimeout(() => window.location.reload(true), 500);
}

// Vérifie les mises à jour Service Worker au démarrage
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(reg => reg.update());
  });
}

/* ─── SYSTÈME 4 : MOTEUR DE ROUTINE & PROGRESSION (Suite) ──────── */

/* ============================================================
   LOGIQUE XP & STADES
   ============================================================ */
function getSt(xp)  { let s=STG[0]; for(const st of STG) if(xp>=st.th) s=st; return s; }
function nxtTh(xp)  { for(const s of STG) if(xp<s.th) return s.th; return 1200; }

// Ajout d'expérience et vérification des niveaux (Level Up)
function addXp(n) {
  const ancienStade = getSt(window.D.g.totalXp).l; // ← stade avant
  window.D.g.totalXp = Math.max(0, window.D.g.totalXp + n);
  window.D.g.stage   = getSt(window.D.g.totalXp).k;
  window.D.g.envLv   = Math.min(10, Math.floor(window.D.g.totalXp / 60));
  const nouveauStade = getSt(window.D.g.totalXp).l; // ← stade après
  
  if (ancienStade !== nouveauStade) {
    if (window.triggerEvoAnim && n > 0) {
      window.triggerEvoAnim(ancienStade, nouveauStade);
    }
    addEvent({
  type: 'xp',
  subtype: 'stade',
  valeur: window.D.g.totalXp,
  label: `Nouveau stade : ${nouveauStade}`
});
    animEl(document.querySelector('#p-gotchi .card'), 'flipInX', 800);
    const stageMsgs = ["Je grandis ! ⭐", "*transformation* ✨", "Je suis plus forte ! 💜", "Nouveau stade ! 🌸", "*brillante* ✿"];
    flashBubble(stageMsgs[Math.floor(Math.random() * stageMsgs.length)], 3000);
  }
  save(); if (typeof updUI === 'function') updUI();
}

/* ─── SYSTÈME 1 : MÉTABOLISME & CYCLE DE VIE ───────────────────── */

// Gère l'apparition d'une crotte aléatoire sur l'écran
function spawnPoop() {
  const td = today();
  // Réinitialise le compteur quotidien si on change de jour
  if (window.D.g.poopDay !== td) {
    window.D.g.poopDay = td;
    window.D.g.poopCount = 0;
  }
  // Limites : Max 10 cacas par jour, Max 5 affichés simultanément
  if (window.D.g.poopCount >= 10) return;
  if ((window.D.g.poops || []).length >= 5) return;
  
  // Placement : Évite de superposer 2 cacas
  let x, y, attempts = 0, tooClose;
  do {
    x = 20 + Math.floor(Math.random() * 150);
    y = 118 + Math.floor(Math.random() * 8);
    tooClose = (window.D.g.poops || []).some(p => Math.abs(p.x - x) < 28);
    attempts++;
  } while (tooClose && attempts < 20);
  
  window.D.g.poops.push({ id: Date.now(), x, y });
  window.D.g.poopCount++;
  window.D.g.lastPoopSpawn = Date.now();
  save();
  if (typeof updUI === 'function') updUI();
}

// Probabilité d'apparition
function maybeSpawnPoop() {
  const now = Date.now();
  window.D.g.lastTick = now; // heartbeat — persisté au prochain save() normal
  const last = window.D.g.lastPoopSpawn || 0;
  const minDelay = 8 * 60 * 1000; // 8 minutes minimum entre 2 crottes

  if (now - last < minDelay) return;
  if (Math.random() < 0.65) spawnPoop();
}

// Mécanique de Nourriture (Snack)
const SNACKS = ['🍎','🍓','🍒','🍑','🍋','🍪','🍩','🧁','🍫','🍬','🍭','🧃','🍵','🧇','🍡'];

function getSnackOfDay() {
  const td = today();
  if (window.D.g.snackDone === td) return window.D.g.snackEmoji;
  // Génère un emoji aléatoire pour aujourd'hui
  const emoji = SNACKS[Math.floor(Math.random() * SNACKS.length)];
  window.D.g.snackEmoji = emoji;
  save();
  return emoji;
}

function giveSnack() {
  const td = today();
  if (window.D.g.snackDone === td) return;
  
  // ✨ Réaction gourmande : déclenchée AVANT l'animation
  // pour que le Gotchi bave en voyant la nourriture descendre
  if (typeof window.triggerExpr === 'function') {
    window.triggerExpr('faim', 60);  // bave pendant toute la descente
  }
  
  window.D.g.snackDone = td;
  window.D.g.petales = (window.D.g.petales || 0) + 2;
  save();
  
  addEvent({
    type: 'note',
    subtype: 'snack',
    label: `${window.D.g.snackEmoji} donné à ${window.D.g.name}  +2 🌸`
  });
  
  const snackMsgs = ["Miam ! 💜", "Délicieux ! ✿", "*mange goulûment* 😋", "Encore ! 🌸", "C'était bon ça ! 💜"];
  flashBubble(snackMsgs[Math.floor(Math.random() * snackMsgs.length)], 2500);
  
  window.eatAnim = { active: true, timer: 50, emoji: window.D.g.snackEmoji, jumped: false };
  
  // ✨ Réaction joie : déclenchée APRÈS la dégustation
  // Le délai laisse le temps à la bave de disparaître avant la joie
  setTimeout(() => {
    if (typeof window.triggerExpr === 'function') {
      window.triggerExpr('joie', 80);
    }
  }, 1500);
  
  if (typeof updUI === 'function') updUI();
}

function cleanPoops() {
  const count = (window.D.g.poops || []).length;
  if (count === 0) return;
  
  // Sauvegarde les positions pour l'animation d'étoiles (render.js)
  window._cleanPositions = [...window.D.g.poops];
  
  window.D.g.poops = [];
  window.D.g.petales = (window.D.g.petales || 0) + (count * 2); // 2 pétales par crotte
  if (typeof toast === 'function') toast(`Propre ! +${count * 2} 🌸`);
  
  const poopMsgs = count >= 4
  ? ["*horreur* C'était quoi ce carnage 💩💩💩", "Je vais avoir besoin d'un bain après ça...", "ON APPELLE LES SECOURS 🚨💩"]
  : count >= 2
  ? ["Ahh beaucoup mieux ! ✿", "*respire* Enfin propre 🌸", "Tu aurais pu venir plus tôt hein 👀"]
  : ["Merci ! ✿", "Oh une crotte, ça arrive 💜", "*soupir de soulagement* ✿"];
  flashBubble(poopMsgs[Math.floor(Math.random() * poopMsgs.length)], 3000);
  
  save();
  addEvent({
  type: 'note',
  subtype: 'poop',
  label: `Crotte ramassée  +${count * 2} 🌸`
});
  if (typeof updUI === 'function') updUI();
}

/* ─── SYSTÈME 6 : INTROSPECTION & MÉMOIRE ──────────────────────── */

// Journal des événements (Terminal) avec file FIFO (max 40)
function addEvent(type, valeur, label) {
  if (!window.D.eventLog) window.D.eventLog = [];
  
  // Si le premier argument est un objet, on l'utilise tel quel (nouvelle API)
  // Sinon, on construit l'event à partir des arguments classiques (ancienne API)
  const ev = (typeof type === 'object' && type !== null)
    ? { date: new Date().toISOString(), ...type }
    : { date: new Date().toISOString(), type, valeur, label };
  
  window.D.eventLog.unshift(ev);
  if (window.D.eventLog.length > 40) window.D.eventLog.length = 40;
  if (typeof updTabletBadge === 'function') updTabletBadge();
}

// Calcule la série (Streak) d'habitudes continues
function calcStr() {
  let s=0, d=new Date();
  while(true) {
    const ds=d.toISOString().split('T')[0];
    const l=window.D.log[ds]||[];
    if(l.length>0) s++;
    else if(ds!==today()) break; // Streak cassé
    d.setDate(d.getDate()-1);
    if(s>999) break; // Sécurité anti-boucle infinie
  }
  return s;
}

/* ─── SYSTÈME 4 : MOTEUR DE ROUTINE (Suite) ────────────────────── */

  function floatXP(el, text = '+15 XP') {
  const rect = el.getBoundingClientRect();
  const div = document.createElement('div');
  div.textContent = text;
  div.style.cssText = `
    position:fixed;
    left:${rect.left + rect.width / 2}px;
    top:${rect.top}px;
    transform:translateX(-50%);
    font:bold 11px 'Courier New',monospace;
    color:var(--lilac);
    pointer-events:none;
    z-index:9999;
    transition:transform 0.8s ease, opacity 0.8s ease;
  `;
  document.body.appendChild(div);
  requestAnimationFrame(() => {
    div.style.transform = 'translateX(-50%) translateY(-30px)';
    div.style.opacity = '0';
  });
  setTimeout(() => div.remove(), 800);
}

/* ============================================================
   LOGIQUE HABITUDES
   ============================================================ */
function toggleHab(catId) {
  const td = today();
  if (!window.D.log[td]) window.D.log[td] = [];
  const idx = window.D.log[td].indexOf(catId);
  const hab = window.D.habits.find(h => h.catId === catId);

  if (!window.D.petalesEarned) window.D.petalesEarned = {};
  if (!window.D.petalesEarned[td]) window.D.petalesEarned[td] = [];

  // DÉCOCHAGE
  if (idx >= 0) {
    window.D.log[td].splice(idx, 1);
    addXp(-15);
    // Pétales acquis définitivement, on ne les retire pas
    flashBubble("Oh... pas grave 💜", 2000);
  }
  // COCHAGE
  else {
    window.D.log[td].push(catId);
    const habEl = document.querySelector(`[onclick="toggleHab('${catId}')"]`);
if (habEl) floatXP(habEl.closest('.hab'));
    addXp(15);
    const dejaGagne = window.D.petalesEarned[td].includes(catId);
    if (!dejaGagne) {
      window.D.g.petales = (window.D.g.petales || 0) + 2;
      window.D.petalesEarned[td].push(catId);
    }
    addEvent('habitude', `${hab?.label || catId} ✓  +15 XP${dejaGagne ? '' : ', +2 🌸'}`);

    const gx = window._gotchiX || 100;
    const gy = window._gotchiY || 100;

    const habReactions = {
      sport:   { msg: "Tu bouges… je sens l'énergie monter ! 💪",       anim: 'spin',    body: 'shake'  },
      nutri:   { msg: "Miam ! Tu te nourris bien, moi aussi 🍎",        anim: 'heart',   body: 'bounce' },
      hydra: { msg: "Merci pour l'eau ! Je grandis grâce à toi 🌱", anim: 'jump', body: 'bounce',
  spawn: () => { for (let i=0;i<12;i++) window.spawnP?.(gx+(Math.random()-.5)*30, gy-20, i%3===0?'#4ab0f0':'#88c8f0'); }
},
hygiene: { msg: "Tu prends soin de toi… ça me rend joyeux·se ✨", anim: 'sparkle', body: 'bounce',
  spawn: () => { for (let i=0;i<12;i++) { const a=(i/12)*Math.PI*2; window.spawnP?.(gx+Math.cos(a)*25, gy+Math.sin(a)*25, i%2===0?'#fff8b0':'#ffe0f0'); } }
},
intel: { msg: "Tu apprends… je sens mon monde s'agrandir 📚", anim: 'flower', body: 'shake',
  spawn: () => {
    for (let i=0;i<12;i++) window.particles?.push({
      x: gx+(Math.random()-.5)*50,
      y: gy,
      vx: (Math.random()-.5)*2,
      vy: -2.5-Math.random()*1.5,
      life: 35,
      c: ['#e8d088','#fff8b0','#f0e0a0','#ffe0f0'][Math.floor(Math.random()*4)]
    });
  }
},
serene: { msg: "Tu as médité… je me sens plus calme aussi 💜", anim: 'sparkle', body: 'bounce',
  spawn: () => { for (let i=0;i<14;i++) window.particles?.push({x:gx+Math.sin(i*.6)*20,y:gy+i*2,vx:Math.sin(i)*.3,vy:-0.5-i*.06,life:45,c:i%3===0?'#c8a0e8':i%3===1?'#f0c0d8':'#e8d8ff'}); }
},
    };

    // ← la ligne manquante !
    const reaction = habReactions[catId] || { msg: "Trop bien ! 🌸", anim: 'heart', body: 'bounce' };

    flashBubble(reaction.msg, 3000);
    window.touchReactions = window.touchReactions || [];
    window.touchReactions.push({
      timer: 35,
      type: reaction.anim,
      cx: gx + (Math.random() - 0.5) * 40,
    });
    if (reaction.body === 'bounce') window.triggerGotchiBounce?.();
    if (reaction.body === 'shake')  window.triggerGotchiShake?.();
    reaction.spawn?.(); //
    // ✨ Réaction d'expression : sourire large + joues rouges
if (typeof window.triggerExpr === 'function') {
  // Le mood dépend du bonheur actuel : si déjà heureux, grande joie
  const mood = window.D.g.happiness > 60 ? 'joie' : 'surprise';
  window.triggerExpr(mood, 90);  // ~1.5s de réaction
}
  }

  // Confettis si toutes les habitudes sont cochées
const totalDone = (window.D.log[td] || []).length;
if (totalDone === window.D.habits.length) {
  const vague = () => {
    for (let i = 0; i < 40; i++) {
      window.spawnP?.(
        Math.random() * 200,
        Math.random() * 80,
        C.rainbow[Math.floor(Math.random() * C.rainbow.length)]
      );
    }
  };
  vague();
  setTimeout(vague, 400);
  setTimeout(vague, 800);
  flashBubble("Tu as tout fait ! Je suis trop heureuse 🎉", 3000);
  window.triggerGotchiBounce?.();
} 

 // ✅ UN SEUL save() ici
  save();
  if (typeof updUI === 'function') updUI();
  if (typeof renderHabs === 'function') renderHabs();
} // ← fermeture toggleHab

function editH(i, v) {
  window.D.habits[i].label = v.trim() || window.D.habits[i].label;
  save();
}

// Mise à jour des jauges vitales (0-5)
function setEnergy(v) {
  window.D.g.energy = +v;
  document.getElementById('sv-energy').textContent = v;
  save();
}
function setHappy(v) {
  window.D.g.happiness = +v;
  document.getElementById('sv-happy').textContent = v;
  save(); updBubbleNow();
}

/* ─── SYSTÈME 2 : ÉCOSYSTÈME & TOPOGRAPHIE (Suite) ───────────────── */

function changeEnv(v) { window.D.g.activeEnv = v; save(); }

/* ─── SYSTÈME 5 : INVENTAIRE & PERSONNALISATION ─────────────────── */

/* ============================================================
   INIT PROPS DE BASE
   ============================================================ */
function initBaseProps() {
  if (window.D.propsInitialized) return;
  const base = (window.PROPS_LIB || []).filter(p => p.cout === 0);
  base.forEach(b => {
    if (!window.D.g.props.find(p => p.id === b.id)) {
      window.D.g.props.push({ id:b.id, nom:b.nom, type:b.type, emoji:b.emoji||'🎁', actif:false });
    }
  });
  window.D.propsInitialized = true;
  save();
}

/* ============================================================
   MÉTÉO
   ============================================================ */
async function fetchMeteo() {
  try {
    const METEO_LAT = window.D?.g?.lat || 43.6047;
    const METEO_LON = window.D?.g?.lng || 1.4442;
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${METEO_LAT}&longitude=${METEO_LON}&current_weather=true&timezone=Europe/Paris`);
    const d = await r.json();
    window.meteoData = d.current_weather;
    window.D.meteo   = window.meteoData;
    save();
    
    // Impact visuel du vent (Classes CSS pour animer le Shell)
    const wind = window.meteoData.windspeed || 0, temp = window.meteoData.temperature || 0;
    let badge = `${Math.round(temp)}°C`;
    if (wind > 40) badge += ` · 🌬️ Vent d'Autan !`;
    else if (wind > 20) badge += ` · 💨 Venteux`;
    
    if (document.getElementById('meteo-badge')) {
      document.getElementById('meteo-badge').textContent = badge;
      document.getElementById('meteo-badge').style.display = 'block';
    }

    const shell = document.querySelector('.tama-shell');
    if (wind > 40) {
      shell.classList.add('tama-wind-strong');
      shell.classList.remove('tama-wind');
      animEl(document.querySelector('.tama-screen'), 'shakeX', 600);
    } else if (wind > 20) {
      shell.classList.add('tama-wind');
      shell.classList.remove('tama-wind-strong');
      animEl(document.querySelector('.tama-screen'), 'headShake', 600);
    } else {
      shell.classList.remove('tama-wind', 'tama-wind-strong');
    }
    updMeteoIcons();
  } catch(e) {}
}

async function fetchSolarPhases() {
  const lat = window.D?.g?.lat, lng = window.D?.g?.lng;
  if (!lat || !lng) return;
  if (window.D.g.solarPhases?.fetchedDate === today()) return;
  try {
    const r = await fetch(`https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&formatted=0`);
    const d = await r.json();
    if (d.status !== 'OK') return;
    const res = d.results;
    const toHf = iso => { const dt = new Date(iso); return dt.getHours() + dt.getMinutes() / 60; };
    const sunriseHf = toHf(res.sunrise);
    const sunsetHf  = toHf(res.sunset);
    window.D.g.solarPhases = {
      dawnStart:   toHf(res.civil_twilight_begin),
      sunriseEnd:  sunriseHf + 1,
      sunsetStart: sunsetHf  - 1,
      duskEnd:     toHf(res.civil_twilight_end),
      fetchedDate: today()
    };
    save();
  } catch(e) { console.log('Solar phases indisponibles, fallback horaire activé'); }
}

window.getSolarPhase = function() {
  const now = new Date();
  const hf  = now.getHours() + now.getMinutes() / 60;
  const sp  = window.D?.g?.solarPhases;
  // Fallback si aucune donnée solaire
  const dawn  = sp?.dawnStart   ?? 6;
  const rises = sp?.sunriseEnd  ?? 9;
  const sets  = sp?.sunsetStart ?? 20;
  const dusk  = sp?.duskEnd     ?? 22;

  if (hf >= rises && hf < sets)
    return { phase: 'jour',        t: (hf - rises) / (sets - rises) };
  if (hf >= dawn  && hf < rises)
    return { phase: 'aube',        t: (hf - dawn)  / (rises - dawn) };
  if (hf >= sets  && hf < dusk)
    return { phase: 'crepuscule',  t: (hf - sets)  / (dusk - sets) };
  // nuit
  const dur = 24 - dusk + dawn;
  const t   = hf >= dusk ? (hf - dusk) / dur : (hf + 24 - dusk) / dur;
  return { phase: 'nuit', t: Math.min(t, 1) };
};

function updMeteoIcons() {
  const wind = window.meteoData?.windspeed || 0;
  const wc = window.meteoData?.weathercode;
  const windLeft = document.getElementById('wind-left');
  const windRight = document.getElementById('wind-right');
  const fogIcon = document.getElementById('fog-icon');
  if (windLeft) windLeft.style.display = wind > 20 ? 'inline' : 'none';
  if (windRight) windRight.style.display = wind > 20 ? 'inline' : 'none';
  if (fogIcon) fogIcon.style.display = (wc === 45 || wc === 48) ? 'inline' : 'none';
}

/* ─── SYSTÈME 3 : COGNITION & IA (Suite) ───────────────────────── */

/* ============================================================
   BULLE DE DIALOGUE
   ============================================================ */
function flashBubble(msg, duree = 2500) {
  const el = document.getElementById('bubble');
  if (el) el.textContent = msg;
  clearTimeout(window._bubbleTimer);
  window._bubbleTimer = setTimeout(() => updBubbleNow(), duree);
}

function updBubbleNow() {
  const h = hr(), ha = D.g.happiness, en = D.g.energy;
  const src = window.PERSONALITY ? window.PERSONALITY.bulles : MSG;
  const done = (D.log[today()] || []).length;

  // ── Priorité 1 : Cacas (urgence visuelle) ──────────────────────
  if ((D.g.poops || []).length >= 3) {
    const pool = [
      "C'est quoi cette porcherie 💩",
      "*bouche le nez* 🤢",
      "Tu vas nettoyer ou pas ??",
      "Je vis dans une décharge 💩💩",
      "*regard noir* 😤"
    ];
    const el = document.getElementById('bubble');
    if (el) el.textContent = pool[Math.floor(Math.random() * pool.length)];
    return;
  }

  // ── Priorité 2 : Nuit ──────────────────────────────────────────
  if (h >= 22 || h < 7) {
    const pool = src.nuit || ["Zzz... 🌙", "*ronfle* 💤", "...zzZZ... 🌛", "Dors bien ✿"];
    const el = document.getElementById('bubble');
    if (el) el.textContent = pool[Math.floor(Math.random() * pool.length)];
    return;
  }

  // ── Priorité 3 : Pool pondéré ──────────────────────────────────
  // Chaque état a un poids : plus le poids est élevé, plus ses phrases
  // ont de chances d'être choisies. On ajoute les phrases N fois selon le poids.

  const ajouter = (phrases, poids = 1) => {
    if (!phrases?.length) return;
    for (let i = 0; i < poids; i++) pool.push(...phrases);
  };

  let pool = [];

  // Heure (poids 2 — contexte dominant)
  if (h < 12)           ajouter(src.matin,   2);
  else if (h < 18)      ajouter(src.aprem,   2);
  else                  ajouter(src.soir,    2);

  // Objectifs du jour (poids 3 — très pertinent)
  if (done === 6)                 ajouter(src.max,    3);
  else if (done >= 4)             ajouter(src.fierte, 3);
  else if (done === 0)            ajouter(src.peu,    2);

  // États émotionnels (poids 3 — priorité si détresse)
  if (ha <= 1)                    ajouter(src.triste,  3);
  if (en <= 1)                    ajouter(src.fatigue, 3);

  // Météo (poids 1 — contexte secondaire)
  if (meteoData?.windspeed > 40)        ajouter(src.vent,   1);
  if (meteoData?.temperature >= 30)     ajouter(src.chaud,  1);
  if (meteoData?.temperature <= 10)     ajouter(src.froid,  1);

  // Idle en fallback seulement si pool trop petit
  if (pool.length < 5)            ajouter(src.idle, 1);

  // ── Bulles IA : 30% max du pool contextuel ────────────────────
  const cb = D.g.customBubbles;
  if (cb && typeof cb === 'object' && !Array.isArray(cb)) {
    const bullesIA = [];
    Object.values(cb).forEach(phrases => bullesIA.push(...phrases));
    if (bullesIA.length) {
      const maxIA = Math.max(1, Math.floor(pool.length * 0.3));
      const selection = bullesIA
        .sort(() => Math.random() - 0.5)
        .slice(0, maxIA);
      pool.push(...selection);
    }
  }
  // Humeur du journal du jour
const dernierJournal = D.journal[D.journal.length - 1];
if (dernierJournal?.date?.startsWith(today())) {
  const m = dernierJournal.mood;
  if (m === 'dur')              ajouter(src.triste,  2);
  if (m === 'bof')              ajouter(src.fatigue, 1);
  if (m === 'super' || m === 'bien') ajouter(src.fierte, 1);
}
  if (!pool.length) pool = ["✿"];

  // ── Anti-répétition ───────────────────────────────────────────
  // Retire la dernière phrase affichée du pool si d'autres options existent
  const derniere = window._derniereBulle;
  const poolFiltre = pool.filter(b => b !== derniere);
  const poolFinal = poolFiltre.length > 0 ? poolFiltre : pool;

  // ── Affichage ─────────────────────────────────────────────────
  const el = document.getElementById('bubble');
  if (el) {
    let bulle = poolFinal[Math.floor(Math.random() * poolFinal.length)];
    bulle = bulle.replace('{{diminutif}}', D.g.userNickname || D.userName || 'toi');
    el.textContent = bulle;
    window._derniereBulle = bulle; // mémorise pour anti-répétition
  }
}

/* ─── SYSTÈME 7 : INGÉNIERIE & DÉCLENCHEURS (Triggers) ─────────── */

/* ============================================================
   INIT QUOTIDIENNE (IIFE)
   S'exécute automatiquement au chargement du fichier
   ============================================================ */
/* ============================================================
   RESET QUOTIDIEN + CYCLE DE VIE PWA
   ============================================================ */

function handleDailyReset() {
  const td = today();

    // ── Reset compteurs quotidiens ──
  if (window.D.lastThoughtDate !== td) {
    window.D.lastThoughtDate = td;
    window.D.thoughtCount    = 0;
  }
  if (window.D.lastSoutienDate !== td) {
    window.D.lastSoutienDate = td;
    window.D.soutienCount    = 0;
  }

    // ── Export journal auto ──
  exportJournalAuto();

  window.D.lastActive = new Date().toISOString();
  save();
}

// Sauvegarde lastTick quand l'app passe en arrière-plan
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { window.D.g.lastTick = Date.now(); save(); }
});

// Spawn rétrospecif des crottes accumulées pendant l'inactivité
function catchUpPoops() {
  const last = window.D.g.lastTick || 0;
  if (!last) return;
  const deltMin = Math.min((Date.now() - last) / 60000, 480); // plafond 8h
  if (deltMin < 10) return;
  const nb = Math.floor(deltMin / 50); // 1 crotte / 50 min hors-session
  for (let i = 0; i < nb; i++) spawnPoop();
}

// Flag pour éviter les doubles inits
let _appInitialized = false;

/**
 * Init unique : tourne au 1er lancement ET au retour foreground.
 * Idempotente = on peut l'appeler 10 fois, elle fait le bon truc.
 */
function initApp() {
  // 1. Reset quotidien (toujours sûr à appeler)
  handleDailyReset();

  // 2. Env — la boucle draw calcule dynamiquement chambre/parc selon hr()
  const h = hr();

  // 3. Spawn caca si 10 min écoulées
  const lastSpawn = window.D.g.lastPoopSpawn || 0;
  if (Date.now() - lastSpawn > 10 * 60 * 1000) {
    maybeSpawnPoop();
  }

  // 4. Init UI complète (remplace l'ancien DOMContentLoaded de ui.js)
  if (typeof window.initUI === 'function') {
    window.initUI();
  } else {
    // Fallback : ui.js pas encore parsé (ne devrait pas arriver en prod)
    if (typeof updUI === 'function')      updUI();
    if (typeof renderHabs === 'function') renderHabs();
    if (typeof renderProg === 'function') renderProg();
  }
}

/**
 * Point d'entrée principal : charge les données PUIS initialise.
 * L'ordre est critique : pas d'UI avant que D soit prêt.
 */
function bootstrap() {
  if (_appInitialized) {
    // Déjà init → on fait juste le refresh (retour foreground)
    initApp();
    return;
  }

  loadDataFiles().then(() => {
    initBaseProps();
    if (typeof updBadgeBoutique === 'function') updBadgeBoutique();
    catchUpPoops();
    initApp();
    _appInitialized = true;
  });

  fetchMeteo();
  fetchSolarPhases();
  setInterval(fetchMeteo, 1800000);
  setInterval(maybeSpawnPoop, 30 * 60 * 1000);
}

/* ---------- Déclencheurs ---------- */

// 1er lancement : `load` se déclenche partout (desktop + PWA iOS + Android)
// On utilise `load` et pas `DOMContentLoaded` car `load` attend que tous
// les scripts (ui.js en dernier) soient parsés.
if (document.readyState === 'complete') {
  // Cas rare : script chargé après `load` → on boot direct
  bootstrap();
} else {
  window.addEventListener('load', bootstrap);
}

// Retour foreground : `pageshow` se déclenche au 1er load ET aux retours bfcache.
// On NE filtre PAS sur `e.persisted` : bootstrap() gère lui-même le cas déjà-init.
window.addEventListener('pageshow', (e) => {
  if (e.persisted) {
    // Retour depuis bfcache (iOS typique) → refresh sans re-bootstrap
    initApp();
  }
});

// Filet de sécurité Android : visibilitychange attrape les cas où
// pageshow ne se redéclenche pas (switch d'app sans unload complet)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && _appInitialized) {
    initApp();
  }
});