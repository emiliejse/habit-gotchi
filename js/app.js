/* ============================================================
   app.js — Données, save/load, logique métier, chargement fichiers
   ============================================================ */

/* ============================================================
   VARIABLES GLOBALES PARTAGÉES (window.X pour tous les fichiers)
   ============================================================ */
window.D            = null;   // données utilisateur
window.PROPS_LIB    = [];     // catalogue (data/props.json)
window.PROPS_LOCAL  = [];     // objets générés par l'IA (session)
window.PERSONALITY  = null;   // data/personality.json
window.AI_CONTEXTS  = null;   // prompts/ai_contexts.json
window.AI_SYSTEM    = null;   // prompts/ai_system.json

// Variables partagées avec render.js
window.celebQueue = [];
window.shakeTimer = 0;
window.meteoData  = null;

/* ============================================================
   CHARGEMENT FICHIERS DATA + PROMPTS
   ============================================================ */
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

    if (results[0].status === 'fulfilled') {
      window.PROPS_LIB = results[0].value.catalogue || [];
      window.PROPS_LIB.forEach(prop => {
        if (prop.cout === 0 && !D.g.props.find(p => p.id === prop.id)) {
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
/* ============================================================
   CONSTANTES MÉTIER
   ============================================================ */
const SK = 'hg4';

const CATS = [
  {id:'sport',   icon:'🏋️', label:'Sport',        def:'30 min mouvement'},
  {id:'nutri',   icon:'🍎', label:'Nutrition',     def:'Repas fait maison'},
  {id:'hydra',   icon:'💧', label:'Hydratation',   def:'1,5L d\'eau'},
  {id:'hygiene', icon:'🪞', label:'Hygiène',       def:'Routine soin'},
  {id:'intel',   icon:'📚', label:'Intellectuel',  def:'20 min lecture'},
  {id:'serene',  icon:'🕯️', label:'Sérénité',      def:'10 min calme'},
];

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

// Fallback minimal si personality.json absent
const MSG = {
  matin:   ["Bon matin ☀️"], aprem: ["On avance ✿"],
  soir:    ["On se pose ✿"], nuit:  ["Zzz... 🌙"],
  peu:     ["Je suis là ✿"], fierte: ["Tu déchires !! 🌟"],
  max:     ["PARFAIT !! 🎉"], triste: ["Tout doux 🌸"],
  fatigue: ["Repos = productif ✿"], vent: ["Ça souffle ! 🌬️"],
  idle:    ["*sourit*"],
};

/* ============================================================
   DONNÉES & SAVE / LOAD
   ============================================================ */
function defs() {
  return {
    g: {
      name:'Petit·e Gotchi', totalXp:0, stage:'egg', energy:3, happiness:3,
      envLv:0, moodDay:null, activeEnv:'parc', petales:0,
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

function save() {
  try { localStorage.setItem(SK, JSON.stringify(window.D)); } catch(e) {}
}

// Initialisation
window.D = load();

// Restaure les pixels des props générés par Claude
if (window.D.propsPixels && Object.keys(window.D.propsPixels).length) {
  window.PROPS_LOCAL = Object.values(window.D.propsPixels);
}

/* ============================================================
   UTILITAIRES
   ============================================================ */
const today  = () => new Date().toISOString().split('T')[0];
const hr     = () => new Date().getHours();
const clamp  = (v,a,b) => Math.max(a, Math.min(b, v));

function forceUpdate() {
  if ('caches' in window) {
    caches.keys().then(names => { names.forEach(name => caches.delete(name)); });
  }
  toast('Mise à jour en cours... ✿');
  setTimeout(() => window.location.reload(true), 500);
}

// Vérifie les mises à jour Service Worker au démarrage
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(reg => reg.update());
  });
}

/* ============================================================
   LOGIQUE XP & STADES
   ============================================================ */
function getSt(xp)  { let s=STG[0]; for(const st of STG) if(xp>=st.th) s=st; return s; }
function nxtTh(xp)  { for(const s of STG) if(xp<s.th) return s.th; return 1200; }
function addXp(n) {
  const ancienStade = getSt(window.D.g.totalXp).l; // ← stade avant
  window.D.g.totalXp = Math.max(0, window.D.g.totalXp + n);
  window.D.g.stage   = getSt(window.D.g.totalXp).k;
  window.D.g.envLv   = Math.min(10, Math.floor(window.D.g.totalXp / 60));
  const nouveauStade = getSt(window.D.g.totalXp).l; // ← stade après
  if (ancienStade !== nouveauStade) {
    addEvent('xp', window.D.g.totalXp, `⭐ Nouveau stade : ${nouveauStade}`);
  }
  save(); if (typeof updUI === 'function') updUI();
}
function addEvent(type, valeur, label) {
  if (!window.D.eventLog) window.D.eventLog = [];
  window.D.eventLog.unshift({
    date: new Date().toISOString(),
    type,   // 'xp' | 'cadeau' | 'note' | 'habitude'
    valeur,
    label
  });
  // FIFO : max 50 entrées
  if (window.D.eventLog.length > 20) window.D.eventLog.length = 20;
  if (typeof updTabletBadge === 'function') updTabletBadge();
}
function calcStr() {
  let s=0, d=new Date();
  while(true) {
    const ds=d.toISOString().split('T')[0];
    const l=window.D.log[ds]||[];
    if(l.length>0) s++;
    else if(ds!==today()) break;
    d.setDate(d.getDate()-1);
    if(s>999) break;
  }
  return s;
}

/* ============================================================
   LOGIQUE HABITUDES
   ============================================================ */
function toggleHab(catId) {
  const td = today();
  if (!window.D.log[td]) window.D.log[td] = [];
  const idx = window.D.log[td].indexOf(catId);
  const hab = window.D.habits.find(h => h.catId === catId); // ← définir hab ici
  if (idx >= 0) {
    window.D.log[td].splice(idx, 1);
    addXp(-15);
    window.D.g.petales = Math.max(0, (window.D.g.petales || 0) - 2);
    save();
  } else {
    window.D.log[td].push(catId);
    addXp(15);
    addEvent('habitude', 15, hab?.label || catId); // ← déplacé ici
    window.D.g.petales = (window.D.g.petales || 0) + 2;
    save();
    window.celebQueue.push(catId);
    window.shakeTimer = 8;
  }
  save(); renderHabs(); updUI(); updBubbleNow(); updBadgeBoutique();
}

function editH(i, v) {
  window.D.habits[i].label = v.trim() || window.D.habits[i].label;
  save();
}

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
function changeEnv(v) { window.D.g.activeEnv = v; save(); }

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
    const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=43.6047&longitude=1.4442&current_weather=true&timezone=Europe/Paris');
    const d = await r.json();
    window.meteoData = d.current_weather;
    window.D.meteo   = window.meteoData;
    save();
    const wind = window.meteoData.windspeed || 0, temp = window.meteoData.temperature || 0;
    let badge = `${Math.round(temp)}°C`;
    if (wind > 40) badge += ` · 🌬️ Vent d'Autan !`;
    else if (wind > 20) badge += ` · 💨 Venteux`;
    if (document.getElementById('meteo-badge')) document.getElementById('meteo-badge').textContent = badge;
  } catch(e) {}
}

/* ============================================================
   BULLE DE DIALOGUE
   ============================================================ */
function updBubbleNow() {
  const h = hr(), ha = D.g.happiness, en = D.g.energy;
  const src = window.PERSONALITY ? window.PERSONALITY.bulles : MSG;

  let pool;
  if (h >= 22 || h < 7) {
    pool = src.nuit || src.night || ["Zzz... 🌙", "*ronfle* 💤", "...zzZZ... 🌛", "Dors bien ✿"];
    const el = document.getElementById('bubble');
    if (el) el.textContent = pool[0];
    return;
  }
  else if (ha <= 1)                               pool = src.triste  || src.sad;
  else if (en <= 1)                               pool = src.fatigue || src.tired;
  else if ((D.log[today()]||[]).length === 6)     pool = src.max     || src.full;
  else if ((D.log[today()]||[]).length >= 4)      pool = src.fierte  || src.high;
  else if ((D.log[today()]||[]).length === 0)     pool = src.peu     || src.low;
  else if (meteoData && meteoData.windspeed > 40) pool = src.vent    || src.wind;
  else if (meteoData && meteoData.temperature >= 30) pool = src.chaud   || src.hot;
else if (meteoData && meteoData.temperature <= 10)  pool = src.froid   || src.cold;
  else if (h < 12)                                pool = src.matin   || src.morning;
  else if (h < 18)                                pool = src.aprem   || src.afternoon;
  else                                            pool = src.soir    || src.evening;

  if (Math.random() < 0.25) {
    const cb = D.g.customBubbles;
    let etatKey = 'idle';
    if (ha <= 1) etatKey = 'triste';
    else if (en <= 1) etatKey = 'fatigue';
    const customPool = (cb && typeof cb === 'object' && !Array.isArray(cb))
      ? (cb[etatKey] || cb['idle'] || [])
      : [];
    const extras = (src.idle || []).concat(customPool);
    if (extras.length) pool = extras;
  }

  if (!pool || !pool.length) pool = ["✿"];
  const el = document.getElementById('bubble');
  if (el) {
  let bulle = pool[Math.floor(Math.random() * pool.length)];
  bulle = bulle.replace('{{nom}}', window.D.g.name || 'toi');
  el.textContent = bulle;
}
}

/* ============================================================
   INIT QUOTIDIENNE (IIFE)
   ============================================================ */
(function() {
  const td = today();
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

/* ============================================================
   LANCEMENT
   ============================================================ */
loadDataFiles().then(() => {
  initBaseProps();
  if (typeof updBadgeBoutique === 'function') updBadgeBoutique();
});
fetchMeteo();
setInterval(fetchMeteo, 1800000);
