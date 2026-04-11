/* ============================================================
   app.js — Données, save/load, logique métier, chargement fichiers
   ============================================================ */

/* ============================================================
   VARIABLES GLOBALES PARTAGÉES (window.X pour tous les fichiers)
   ============================================================ */
window.D            = null;   // données utilisateur (chargé plus bas)
window.PROPS_LIB    = [];     // catalogue props (data/props.json)
window.PROPS_LOCAL  = [];     // props générés par Claude (session)
window.PERSONALITY  = null;   // data/personality.json
window.ENVIRONMENTS = null;   // data/environments.json
window.STYLES       = null;   // data/styles.json
window.PROMPTS      = null;   // prompts/ (bubbles, aiSystem, aiContexts)

// Variables partagées avec render.js
window.celebQueue = [];
window.shakeTimer = 0;
window.meteoData  = null;

/* ============================================================
   CHARGEMENT FICHIERS DATA + PROMPTS
   ============================================================ */
async function loadDataFiles() {
  const base = 'data/';
  try {
    const results = await Promise.allSettled([
      fetch(base + 'props.json').then(r => r.json()),
      fetch(base + 'personality.json').then(r => r.json()),
      fetch(base + 'environments.json').then(r => r.json()),
      fetch(base + 'styles.json').then(r => r.json())
    ]);
    // Ajoute automatiquement les props gratuits si pas encore dans l'inventaire
if (results[0].status === 'fulfilled') {
  window.PROPS_LIB = results[0].value.catalogue || [];
  renderProps();
  updBadgeBoutique();
}
  window.PROPS_LIB.forEach(prop => {
    if (prop.cout === 0 && !D.g.props.find(p => p.id === prop.id)) {
      D.g.props.push({
        id: prop.id,
        nom: prop.nom,
        type: prop.type,
        emoji: prop.emoji,
        actif: false
      });
    }
  });
  save();
  renderProps();
}
    if (results[1].status === 'fulfilled') window.PERSONALITY = results[1].value;
    if (results[2].status === 'fulfilled') window.ENVIRONMENTS = results[2].value;
    if (results[3].status === 'fulfilled') window.STYLES = results[3].value;
    console.log('✿ Data chargée:', window.PROPS_LIB.length, 'props');
  } catch(e) { console.log('Mode local (fichiers data absents)'); }

  // Chargement des prompts/
  try {
    const pResults = await Promise.allSettled([
      fetch('prompts/bubbles.json').then(r => r.json()),
      fetch('prompts/ai_system.json').then(r => r.json()),
      fetch('prompts/ai_contexts.json').then(r => r.json())
    ]);
    window.PROMPTS = {
      bubbles:    pResults[0].status === 'fulfilled' ? pResults[0].value : null,
      aiSystem:   pResults[1].status === 'fulfilled' ? pResults[1].value : null,
      aiContexts: pResults[2].status === 'fulfilled' ? pResults[2].value : null,
    };
    console.log('✿ Prompts chargés');
  } catch(e) { console.log('Prompts absents, fallback local'); }
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
  {k:'egg',   l:'Œuf',   th:0},
  {k:'baby',  l:'Bébé',  th:60},
  {k:'teen',  l:'Ado',   th:240},
  {k:'adult', l:'Adulte',th:600}
];

// Palettes interface
const UI_PALETTES = [
  { id:'lavande', label:'Lavande', bg:'#ddd6e8', lilac:'#b090d0', mint:'#80d0a8', pink:'#e8a0bf' },
  { id:'rose',    label:'Rose',    bg:'#f0dde8', lilac:'#d080a8', mint:'#a0d8b0', pink:'#e890c0' },
  { id:'ocean',   label:'Océan',   bg:'#d0e8f0', lilac:'#6090c0', mint:'#70d0c0', pink:'#a0c8e8' },
  { id:'foret',   label:'Forêt',   bg:'#d8e8d0', lilac:'#70a870', mint:'#90d890', pink:'#c8e0a0' },
  { id:'nuit',    label:'Nuit',    bg:'#2a2438', lilac:'#9070c0', mint:'#50c890', pink:'#c07090' },
  { id:'peche',   label:'Pêche',   bg:'#f0e0d0', lilac:'#c09070', mint:'#90d0a8', pink:'#e8b090' },
];

// Couleurs corps du Gotchi
const GOTCHI_COLORS = [
  { id:'vert',   label:'Vert',   body:'#c8d8c0', bodyLt:'#e0ece0', bodyDk:'#a0b898' },
  { id:'lilas',  label:'Lilas',  body:'#d0c0e0', bodyLt:'#e8e0f0', bodyDk:'#a898c0' },
  { id:'peche',  label:'Pêche',  body:'#e8d0b8', bodyLt:'#f0e4d0', bodyDk:'#c0a888' },
  { id:'bleu',   label:'Bleu',   body:'#b8d0e8', bodyLt:'#d0e4f4', bodyDk:'#90a8c8' },
  { id:'rose',   label:'Rose',   body:'#e8c0d0', bodyLt:'#f4d8e4', bodyDk:'#c098a8' },
  { id:'jaune',  label:'Jaune',  body:'#e8e0a8', bodyLt:'#f4ecc8', bodyDk:'#c0b878' },
];

// Thèmes environnements
const ENV_THEMES = [
  { id:'pastel',  label:'Pastel ✿',   gnd:'#a8d898', gndDk:'#90c480', sky1:'#b8d4f0', sky2:'#d8e8f8' },
  { id:'automne', label:'Automne 🍂', gnd:'#c89858', gndDk:'#a87838', sky1:'#e8c068', sky2:'#f0d898' },
  { id:'hiver',   label:'Hiver ❄️',   gnd:'#e8f0f8', gndDk:'#c8d8e8', sky1:'#c8d8e8', sky2:'#e8f0f8' },
  { id:'desert',  label:'Désert 🏜️',  gnd:'#e8d098', gndDk:'#c8a858', sky1:'#f0c878', sky2:'#f8e0a8' },
];

// Bulles statiques fallback (si prompts/bubbles.json absent)
const MSG = {
  morning:   ["Bon matin ☀️","Coucou ! Prête ?","*bâille* Salut 💜","Belle journée ✿"],
  afternoon: ["On avance bien ✿","Un pas à la fois 💜","Pause méritée ?","Créer c'est vivre 🎨"],
  evening:   ["On se pose ? ✿","Le soir c'est doux 💜","Tu as fait assez.","Débranche..."],
  night:     ["Zzz... 🌙","*ronronne*","Bonne nuit ✿","Chut... repos 💤"],
  low:       ["Hé, viens me voir 🥺","Une habitude ?","Je suis là ✿","Pas de pression 💜"],
  high:      ["Tu déchires !! 🌟","Si fière ! ✿","Regarde tout ça !","Quelle équipe 💜"],
  full:      ["PARFAIT !! 🎉","6/6 !! ✿✿✿","JE BRILLE !! 🌟","Combo MAXXX !!"],
  sad:       ["Ça va aller... 💜","Je suis là ✿","Respire...","Tout doux 🌸"],
  tired:     ["On fait doucement...","Repos = productif ✿","Écoute ton corps 💜","Rien à prouver"],
  wind:      ["Ouh, le vent d'Autan ! 🌬️","Ça souffle dehors !","Reste au chaud ✿"],
  idle:      ["*regarde autour*","♪ la la ♪","*sourit*","*boing*"],
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
    log:{}, journal:[], pin:null, apiKey:null
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
if (window.D.propsPixels && window.D.propsPixels.length) {
  window.PROPS_LOCAL = window.D.propsPixels;
}

/* ============================================================
   UTILITAIRES
   ============================================================ */
const today  = () => new Date().toISOString().split('T')[0];
const hr     = () => new Date().getHours();
const clamp  = (v,a,b) => Math.max(a, Math.min(b, v));

function haptic() {
  try { if (navigator.vibrate) navigator.vibrate([50]); } catch(e) {}
}

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
function addXp(n)   {
  window.D.g.totalXp = Math.max(0, window.D.g.totalXp + n);
  window.D.g.stage   = getSt(window.D.g.totalXp).k;
  window.D.g.envLv   = Math.min(10, Math.floor(window.D.g.totalXp / 60));
  save(); updUI();
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
  haptic();
  const td = today();
  if (!window.D.log[td]) window.D.log[td] = [];
  const idx = window.D.log[td].indexOf(catId);
  if (idx >= 0) {
    window.D.log[td].splice(idx, 1);
    addXp(-15);
    window.D.g.petales = Math.max(0, (window.D.g.petales || 0) - 2);
    save();
  } else {
    window.D.log[td].push(catId);
    addXp(15);
    window.D.g.petales = (window.D.g.petales || 0) + 2;
    save();
    window.celebQueue.push(catId);
    window.shakeTimer = 8;
  }
  save(); renderHabs(); updUI(); updBubbleNow();
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
function changeEnv(v) { window.D.g.activeEnv = v; save(); haptic(); }

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
function getBubble() {
  const src = (window.PROMPTS && window.PROMPTS.bubbles) ? window.PROMPTS.bubbles : MSG;
  const h=hr(), log=window.D.log[today()]||[], done=log.length, en=window.D.g.energy, ha=window.D.g.happiness;
  let pool;
  if(h>=22||h<7)       pool=src.night;
  else if(done===6)    pool=src.full;
  else if(ha<=1)       pool=src.sad;
  else if(en<=1)       pool=src.tired;
  else if(window.meteoData&&window.meteoData.windspeed>40) pool=src.wind;
  else if(done>=4)     pool=src.high;
  else if(done===0)    pool=src.low;
  else if(h<12)        pool=src.morning;
  else if(h<18)        pool=src.afternoon;
  else                 pool=src.evening;
  if(Math.random()<.15&&done>0&&done<6) pool=src.idle;
  return pool[Math.floor(Math.random()*pool.length)];
}

function updBubbleNow() {
  const h=hr(), ha=window.D.g.happiness, en=window.D.g.energy;
  const P   = window.PERSONALITY;
  const src = P ? P.bulles : ((window.PROMPTS && window.PROMPTS.bubbles) || MSG);
  let pool;

  if(h>=22||h<7)       pool = src.nuit      || src.night;
  else if(ha<=1)       pool = src.triste    || src.sad;
  else if(en<=1)       pool = src.fatigue   || src.tired;
  else if((window.D.log[today()]||[]).length===6) pool = src.max || src.full;
  else if((window.D.log[today()]||[]).length>=4)  pool = src.fierte || src.high;
  else if(window.meteoData&&window.meteoData.windspeed>40) pool = src.vent || src.wind;
  else if(h<12)        pool = src.matin     || src.morning;
  else if(h<18)        pool = src.aprem     || src.afternoon;
  else                 pool = src.soir      || src.evening;

  let extras = (src.idle || MSG.idle).concat(window.D.g.customBubbles || []);
  if (P && P.bulles.custom) extras = extras.concat(P.bulles.custom);
  if (Math.random() < 0.15 && extras.length) pool = extras;

  if (!pool || !pool.length) pool = ["✿"];
  const el = document.getElementById('bubble');
  if (el) el.textContent = pool[Math.floor(Math.random() * pool.length)];
}

/* ============================================================
   INIT QUOTIDIENNE (IIFE)
   ============================================================ */
(function() {
  const td = today();
  if (window.D.lastActive && window.D.lastActive !== td) {
    window.D.g.energy    = clamp(window.D.g.energy - 1, 0, 5);
    window.D.g.happiness = clamp(window.D.g.happiness - 1, 0, 5);
  }
  if (window.D.g.moodDay !== td) {
    const ms = ['happy','chill','sleepy','playful','curious'];
    window.D.g.mood    = ms[Math.floor(Math.random() * ms.length)];
    window.D.g.moodDay = td;
  }
  window.D.lastActive = td;
  save();
})();

/* ============================================================
   LANCEMENT
   ============================================================ */
loadDataFiles().then(initBaseProps);
fetchMeteo();
setInterval(fetchMeteo, 1800000);
