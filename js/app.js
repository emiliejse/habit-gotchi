/* ============================================================
   app.js — Données, save/load, logique métier, chargement fichiers
   RÔLE : C'est le "Cerveau" de l'application. Gère la sauvegarde, 
   les mathématiques (XP, pétales), le temps, et l'humeur.
   ============================================================ */

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


// VERSION À CHANGER
const APP_VERSION = 'v1.0';

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

// Les 6 piliers de la routine
const CATS = [
  {id:'sport',   icon:'🏋️', label:'Sport',        def:'30 min mouvement'},
  {id:'nutri',   icon:'🍎', label:'Nutrition',     def:'Repas fait maison'},
  {id:'hydra',   icon:'💧', label:'Hydratation',   def:'1,5L d\'eau'},
  {id:'hygiene', icon:'🪞', label:'Hygiène',       def:'Routine soin'},
  {id:'intel',   icon:'📚', label:'Intellectuel',  def:'20 min lecture'},
  {id:'serene',  icon:'🕯️', label:'Sérénité',      def:'10 min calme'},
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
      name:'Petit·e Gotchi', userName: 'Émilie', totalXp:0, stage:'egg', energy:3, happiness:3,
      envLv:0, moodDay:null, activeEnv:'parc', petales:0,poops: [], poopDay: '',    // date du dernier comptage
poopCount: 0,  // nb de cacas spawné aujourd'hui
snackDone: '', snackEmoji: '',
      props:[], customBubbles:[]
    },
    habits: CATS.map(c => ({catId:c.id, label:c.label})),
    log:{}, journal:[], pin:null, apiKey:null,
    lastThoughtDate: null,
thoughtCount: 0,
eventLog: [],        // historique (max 50)
firstLaunch: null,   // sera rempli au 1er lancement
lastActive: null,    // mis à jour à chaque ouverture
  };
}

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

// Initialisation au démarrage
window.D = load();

// Restaure les pixels des props générés par Claude (Évite de faire appel à l'IA à chaque F5)
if (window.D.propsPixels && Object.keys(window.D.propsPixels).length) {
  window.PROPS_LOCAL = Object.values(window.D.propsPixels);
}

/* ============================================================
   UTILITAIRES
   ============================================================ */
const today  = () => new Date().toISOString().split('T')[0];
const hr     = () => new Date().getHours();
const clamp  = (v,a,b) => Math.max(a, Math.min(b, v));

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
  // Limites : Max 5 cacas par jour, Max 5 affichés simultanément
  if (window.D.g.poopCount >= 5) return;
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

// Probabilité d'apparition : 35% de chance quand appelée
function maybeSpawnPoop() {
  if (Math.random() < 0.35) spawnPoop();
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
  window.D.g.snackDone = td;
  window.D.g.petales = (window.D.g.petales || 0) + 2; // Récompense : 2 pétales
  save();
  
  addEvent({
  type: 'note',
  subtype: 'snack',
  label: `${window.D.g.snackEmoji} donné à ${window.D.g.name}  +2 🌸`
});
  const snackMsgs = ["Miam ! 💜", "Délicieux ! ✿", "*mange goulûment* 😋", "Encore ! 🌸", "C'était bon ça ! 💜"];
  flashBubble(snackMsgs[Math.floor(Math.random() * snackMsgs.length)], 2500);
  
  // Envoie l'info à render.js pour l'animation
  window.eatAnim = { active: true, timer: 50, emoji: window.D.g.snackEmoji, jumped: false };
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

/* ============================================================
   LOGIQUE HABITUDES
   ============================================================ */
function toggleHab(catId) {
  const td = today();
  if (!window.D.log[td]) window.D.log[td] = [];
  const idx = window.D.log[td].indexOf(catId);
  const hab = window.D.habits.find(h => h.catId === catId);
  
  // DÉCOCHAGE : Retire 15 XP et 2 pétales
  if (idx >= 0) {
    window.D.log[td].splice(idx, 1);
    addXp(-15);
    window.D.g.petales = Math.max(0, (window.D.g.petales || 0) - 2);
    flashBubble("Oh... pas grave 💜", 2000);
  } 
// COCHAGE : Ajoute 15 XP et 2 pétales
  else {
    window.D.log[td].push(catId);
    addXp(15);
    window.D.g.petales = (window.D.g.petales || 0) + 2;
    addEvent('habitude', `${hab?.label || catId} ✓  +15 XP, +2 🌸`);

    const gx = window._gotchiX || 100;
    const gy = window._gotchiY || 100;

    const habReactions = {
      sport:   { msg: "Tu bouges… je sens l'énergie monter ! 💪",       anim: 'spin',    body: 'shake'  },
      nutri:   { msg: "Miam ! Tu te nourris bien, moi aussi 🍎",        anim: 'heart',   body: 'bounce' },
      hydra: { msg: "Merci pour l'eau ! Je grandis grâce à toi 🌱", anim: 'jump', body: 'bounce',
  spawn: () => { for (let i=0;i<12;i++) window.spawnP?.(gx+(Math.random()-.5)*30, 5+Math.random()*15, i%3===0?'#4ab0f0':'#88c8f0'); }
},
hygiene: { msg: "Tu prends soin de toi… ça me rend joyeux·se ✨", anim: 'sparkle', body: 'bounce',
  spawn: () => { for (let i=0;i<12;i++) { const a=(i/12)*Math.PI*2; window.spawnP?.(gx+Math.cos(a)*25, gy+Math.sin(a)*25, i%2===0?'#fff8b0':'#ffe0f0'); } }
},
intel: { msg: "Tu apprends… je sens mon monde s'agrandir 📚", anim: 'flower', body: 'shake',
  spawn: () => { for (let i=0;i<10;i++) window.particles?.push({x:gx+(Math.random()-.5)*40,y:gy,vx:(Math.random()-.5)*.4,vy:-1.2-Math.random()*.8,life:40,c:i%2===0?'#e8d088':'#fff8b0'}); }
},
serene: { msg: "Tu as médité… je me sens plus calme aussi 💜", anim: 'sparkle', body: 'bounce',
  spawn: () => { for (let i=0;i<14;i++) window.particles?.push({x:gx+Math.sin(i*.6)*20,y:gy+i*2,vx:Math.sin(i)*.3,vy:-0.5-i*.06,life:45,c:i%3===0?'#c8a0e8':i%3===1?'#f0c0d8':'#e8d8ff'}); }
},
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
  }
 // ✅ UN SEUL save() ici, après toutes les mutations d'état
  save();
  if (typeof updUI === 'function') updUI();
  if (typeof renderHabs === 'function') renderHabs();
}

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
    const METEO_LAT = 43.6047;  // Toulouse
    const METEO_LON = 1.4442;
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
    // Icônes vent dans la date
    const windLeft = document.getElementById('wind-left');
    const windRight = document.getElementById('wind-right');
    if (windLeft) windLeft.style.display = wind > 20 ? 'inline' : 'none';
    if (windRight) windRight.style.display = wind > 20 ? 'inline' : 'none';

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
  } catch(e) {}
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
    bulle = bulle.replace('{{nom}}', D.userName || 'toi');
    el.textContent = bulle;
    window._derniereBulle = bulle; // mémorise pour anti-répétition
  }
}

/* ─── SYSTÈME 7 : INGÉNIERIE & DÉCLENCHEURS (Triggers) ─────────── */

/* ============================================================
   INIT QUOTIDIENNE (IIFE)
   S'exécute automatiquement au chargement du fichier
   ============================================================ */
(function() {
  const td = today();
  
  // 1. Pénalité d'inactivité (Si aucune habitude faite la veille)
  if (window.D.lastActive && window.D.lastActive.split('T')[0] !== td) {
    const hier = new Date();
    hier.setDate(hier.getDate() - 1);
    const hierStr = hier.toISOString().split('T')[0];
    const hierLog = window.D.log[hierStr] || [];

    if (hierLog.length === 0) {
      addXp(-15);
      window.D.g.petales = Math.max(0, (window.D.g.petales || 0) - 4);
    }
  }

  // 2. Calcul de l'humeur du jour basée sur l'énergie/bonheur (pour l'API IA)
  if (window.D.g.moodDay !== td) {
    const e = window.D.g.energy;
    const h = window.D.g.happiness;
    let mood;

    if (e >= 4 && h >= 4)      mood = Math.random() < 0.5 ? 'happy' : 'playful';
    else if (e <= 2)            mood = 'sleepy';
    else if (h <= 2)            mood = Math.random() < 0.5 ? 'chill' : 'curious';
    else                        mood = Math.random() < 0.5 ? 'chill' : 'playful';

    window.D.g.mood    = mood;
    window.D.g.moodDay = td;
    save();
  }
})();

// Refait le calcul si l'utilisateur met l'app en pause puis revient
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    const td = today();
    if (window.D.g.moodDay !== td) {
      const e = window.D.g.energy;
      const h = window.D.g.happiness;
      let mood;

      if (e >= 4 && h >= 4)      mood = Math.random() < 0.5 ? 'happy' : 'playful';
      else if (e <= 2)            mood = 'sleepy';
      else if (h <= 2)            mood = Math.random() < 0.5 ? 'chill' : 'curious';
      else                        mood = Math.random() < 0.5 ? 'chill' : 'playful';

      window.D.g.mood    = mood;
      window.D.g.moodDay = td;
      save();
    }
  }
});

// Triggers au chargement (DOM Load)
window.addEventListener('load', () => {
  // Env selon l'heure (Nuit -> Chambre auto)
  const h = hr();
  if (h >= 22 || h < 7) window.D.g.activeEnv = 'chambre';

  // Spawn caca avec timer de 30 minutes
  const lastSpawn = window.D.g.lastPoopSpawn || 0;
  const now = Date.now();
  if (now - lastSpawn > 30 * 60 * 1000) {
    maybeSpawnPoop();
  }
  setInterval(maybeSpawnPoop, 30 * 60 * 1000);
});

/* ============================================================
   LANCEMENT
   ============================================================ */
loadDataFiles().then(() => {
  initBaseProps();
  if (typeof updBadgeBoutique === 'function') updBadgeBoutique();
});
fetchMeteo();
setInterval(fetchMeteo, 1800000); // Update météo toutes les 30 min