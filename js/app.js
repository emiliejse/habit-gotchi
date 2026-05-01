/* ============================================================
   app.js — Données, save/load, logique métier, chargement fichiers
   RÔLE : C'est le "Cerveau" de l'application. Gère la sauvegarde,
   les mathématiques (XP, pétales), le temps, et l'humeur.

   NAVIGATION RAPIDE (Ctrl+G dans VS Code → numéro de ligne) :
   §1  ~29    UTILITAIRES GLOBAUX  today(), hr(), clamp()
   §2  ~36    VARIABLES GLOBALES   window.D, window.PROPS_LIB, etc.
   §3  ~70    CHARGEMENT JSON      loadDataFiles()
   §4  ~130   CONSTANTES MÉTIER    SK, STG, CATS
   §5  ~175   STRUCTURE D          defs(), getCyclePhase()
   §6  ~337   SAVE / LOAD          migrate(), load(), save(), computeNickname()
   §7  ~402   UTILITAIRES          forceUpdate()
   §8  ~433   XP & STADES          getSt(), nxtTh(), addXp()
   §9  ~464   CROTTES              spawnPoop(), maybeSpawnPoop(), cleanPoops()
   §10 ~533   SEMAINE & REPAS      getWeekId(), getCurrentMealWindow(), giveSnack()
   §11 ~702   HABITUDES            calcStr(), toggleHab(), editH()
   §12 ~857   SAVE DEBOUNCED       saveDebounced(), setEnergy(), setHappy()
   §13 ~891   INIT PROPS           initBaseProps()
   §14 ~918   MÉTÉO                fetchMeteo(), fetchSolarPhases(), getSolarPhase()
   §15 ~1017  BULLE DE DIALOGUE    flashBubble(), updBubbleNow()
   §16 ~1134  INIT QUOTIDIENNE     handleDailyReset(), catchUpPoops()
   §17 ~1204  CONFIG UTILISATEUR   loadUserConfig(), bootstrap()
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
window.PERSONALITY  = null;   // chargé depuis user_config.json (personality.source = "config")
window.AI_CONTEXTS  = null;   // prompts/ai_contexts.json
window.AI_SYSTEM    = null;   // prompts/ai_system.json

// Variables partagées avec render.js pour l'affichage
window.celebQueue = [];
window.shakeTimer = 0;
window.meteoData  = null;
window._gotchiActif = true;


// RÔLE : Handles des setInterval récurrents — stockés pour pouvoir les annuler avant recréation.
// POURQUOI : bootstrap() peut être appelée plusieurs fois (pageshow/visibilitychange).
//            Sans clearInterval préalable, chaque appel empilerait un nouvel interval en doublon.
let _meteoIntervalId = null;
let _poopIntervalId  = null;

// VERSION À CHANGER
window.APP_VERSION = 'v4.86'; // // ⚠️ SYNC → sw.js ligne 1 : CACHE_VERSION

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
    // RÔLE : Charge les 3 fichiers props + les prompts IA en parallèle.
    // POURQUOI : props.json est remplacé par 3 fichiers distincts —
    //   props_base.json  → objets gratuits offerts au premier lancement
    //   props_shop.json  → objets payants achetables en boutique
    //   props_packs.json → objets exclusifs achetables uniquement en pack
    //   Cette séparation permet à chaque objet pack d'avoir son vrai type/categorie
    //   métier (ex: "tete", "nature") sans hack via categorie:"pack".
    const results = await Promise.allSettled([
      fetch(base + 'props_base.json').then(r => r.json()),          // 0
      fetch(base + 'props_shop.json').then(r => r.json()),          // 1
      fetch(base + 'props_packs.json').then(r => r.json()),         // 2
      Promise.resolve(null),              // 3 — personality supprimé, chargé via user_config
      fetch(promptsBase + 'ai_contexts.json').then(r => r.json()),  // 4
      fetch(promptsBase + 'ai_system.json').then(r => r.json()),    // 5
    ]);

    // RÔLE : Concatène les 3 catalogues en une seule liste unifiée dans PROPS_LIB.
    // POURQUOI : Tout le code existant (IA, inventaire, debug) lit window.PROPS_LIB —
    //            garder cette globale unique évite de propager le changement partout.
    const base_   = results[0].status === 'fulfilled' ? results[0].value.catalogue || [] : [];
    const shop_   = results[1].status === 'fulfilled' ? results[1].value.catalogue || [] : [];
    const packs_  = results[2].status === 'fulfilled' ? results[2].value.catalogue || [] : [];
    window.PROPS_LIB = [...base_, ...shop_, ...packs_];

    // RÔLE : Charge un catalogue d'objets exclusifs si user_config définit extraPropsFile.
    // POURQUOI : Permet à Alexia d'avoir ses propres objets sans polluer le catalogue commun.
    //            Chez Émilie, extraPropsFile est absent → ce bloc est ignoré.
    if (window.USER_CONFIG?.extraPropsFile) {
      try {
        const r = await fetch(window.USER_CONFIG.extraPropsFile);
        if (r.ok) {
          const extra = await r.json();
          window.PROPS_LIB = window.PROPS_LIB.concat(extra.catalogue || []);
        }
      } catch(e) { console.log('extraPropsFile introuvable — ignoré'); }
    }

    // RÔLE : Ajoute automatiquement les objets de props_base.json à l'inventaire.
    // POURQUOI : Tous les objets de base ont cout:0 — plus besoin de filtrer par
    //            categorie:"pack" (ce hack n'existe plus dans les nouveaux fichiers).
    if (window.D) {
      base_.forEach(prop => {
        if (!window.D.g.props.find(p => p.id === prop.id)) {
          D.g.props.push({ id: prop.id, nom: prop.nom, type: prop.type, emoji: prop.emoji, actif: false });
        }
      });
      save(); renderProps(); updBadgeBoutique();
    }

    // RÔLE : Charge la personnalité depuis user_config.json directement.
    // POURQUOI : personality.json est supprimé — toute la personnalité
    //            est maintenant dans user_config.json pour les deux repos.
    if (window.USER_CONFIG?.personality?.source === 'config') {
      const p = window.USER_CONFIG.personality;
      window.PERSONALITY = {
        nom:    window.USER_CONFIG?.identity?.gotchiName ?? 'Petit·e Gotchi',
        traits: p.traits,
        style:  p.style,
        bulles: p.bulles
      };
    }
    if (results[4].status === 'fulfilled') window.AI_CONTEXTS = results[4].value;
    if (results[5].status === 'fulfilled') window.AI_SYSTEM   = results[5].value;

    console.log('✿ Data chargée:', window.PROPS_LIB.length, 'props (' + base_.length + ' base, ' + shop_.length + ' shop, ' + packs_.length + ' packs)');
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

// RÔLE : Fallback défensif utilisé uniquement si personality.json n'a pas encore été chargé.
// POURQUOI : loadDataFiles() charge personality.json de manière asynchrone — dans les rares cas
//            où updBubbleNow() s'exécute avant la fin du fetch (ex : 1er lancement hors-ligne),
//            window.PERSONALITY serait null. MSG évite un crash silencieux.
//            En usage normal, ce fallback n'est jamais affiché.
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
      name:            'Petit·e Gotchi',
      userName:        'Émilie',
      userNickname:    window.USER_CONFIG?.identity?.userNickname ?? '',
      totalXp:         0,
      stage:           'egg',
      energy:          3,
      happiness:       3,
      envLv:           0,
      activeEnv:       'parc',
      petales:         0,
      poops:           [],
      poopDay:         '',    // date du dernier comptage
      poopCount:       0,     // nb de cacas spawné aujourd'hui
      snackDone:       '',
      snackEmoji:      '',
      salete:          0,     // niveau de saleté du Gotchi — 0 (propre) à 10 (très sale)
      hunger:          0,     // niveau de faim — 0 (rassasié·e) à 3 (très faim)
      props:           [],
      customBubbles:   [],
      bilanCount:      0,
      bilanWeek:       '',
      bilanText:       '',
      lastTick:        Date.now(),
      solarPhases:     null,
      cycleDuree:      CYCLE_DEFAULT_DURATION, // durée du cycle en jours (défaut = 28)
      birthdayShown:   false, // true une fois la modale anniversaire affichée ce jour-là
      birthdayCodeUsed: false, // true une fois le code cheat anniversaire utilisé
    },
    habits:           CATS.map(c => ({catId:c.id, label:c.label})),
    log:              {},
    journal:          [],
    pin:              null,
    apiKey:           null,
    propsPixels:      {},     // objets achetés en boutique IA (clé = id prop)
    lastThoughtDate:  null,
    thoughtCount:     0,
    lastSoutienDate:  null,
    lastJournalExport: null,
    soutienCount:     0,
    eventLog:         [],     // historique (max 50)
    firstLaunch:      null,   // sera rempli au 1er lancement
    lastActive:       null,   // mis à jour à chaque ouverture
    cycle:            [],     // { date: "2025-04-10", type: "regles" }
    rdv:              [],     // { id, date, label, heure? }
    streaks:          {},     // { catId: nombreDeJoursConsécutifs } — recalculé à chaque ouverture
    lastMissedPenalty: null, // date AAAA-MM-JJ de la dernière pénalité XP pour habitudes manquées
    presenceStreak:   0,     // jours consécutifs d'ouverture de l'app
    lastPresenceDate: null,  // date AAAA-MM-JJ de la dernière ouverture (pour calcul presenceStreak)
    catVedetteDate:   null,  // date AAAA-MM-JJ où la catégorie vedette a été tirée
    catVedette:       null,  // catId de l'habitude vedette du jour (+4 pétales au lieu de +2)
    milestoneProps:   [],    // ids des objets milestone déjà offerts (évite les doublons)
  };
}

// Calcul de la phase du cycle pour une date donnée
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
  let duree = window.D.g.cycleDuree || CYCLE_DEFAULT_DURATION;
if (cycles.length >= 2) {
  let total = 0;
  for (let i = 0; i < cycles.length - 1; i++)
    total += Math.round((new Date(cycles[i]+'T12:00') - new Date(cycles[i+1]+'T12:00')) / 86400000);
  duree = Math.round(total / (cycles.length - 1));
}
  const j     = ((diff % duree) + duree) % duree + 1; // J1 à J28

  if (j <= 5)          return { phase: 'menstruelle',  j, label: 'Règles',       couleur: '#e07080' };
  if (j <= 13)         return { phase: 'folliculaire', j, label: 'Folliculaire', couleur: '#80b8e0' };
  if (j <= 16)         return { phase: 'ovulation',    j, label: 'Ovulation',    couleur: '#60c8a0' };
  return               { phase: 'lutéale',             j, label: 'Lutéale',      couleur: '#b090d0' };
}
window.getCyclePhase = getCyclePhase; // exposée globalement

// ─────────────────────────────────────────────────────────────
// RÔLE  : Système de migrations de la structure D.
// POURQUOI : Quand la structure de D évolue (nouveau champ, champ renommé,
//            champ supprimé), les utilisatrices avec une ancienne sauvegarde
//            en LocalStorage peuvent avoir des bugs silencieux.
//            migrate() met à jour D vers la version courante au chargement.
// USAGE : Ajouter une entrée dans MIGRATIONS pour chaque changement de structure.
//         Ne jamais supprimer une migration existante.
// ─────────────────────────────────────────────────────────────
const SCHEMA_VERSION = 9; // ⚠️ incrémenter à chaque ajout de migration

const MIGRATIONS = [
  // Migration 0→1 : nettoyage D.lat / D.lng (supprimés en session 5)
  // et ajout des champs manquants dans D.g
  function m1(d) {
    delete d.lat;   // supprimé en session 5
    delete d.lng;   // supprimé en session 5
    // Garantit que les nouveaux champs de D.g existent
    d.g.bilanCount     = d.g.bilanCount     ?? 0;
    d.g.bilanWeek      = d.g.bilanWeek      ?? '';
    d.g.bilanText      = d.g.bilanText      ?? '';
    d.g.cycleDuree     = d.g.cycleDuree     ?? CYCLE_DEFAULT_DURATION;
    d.g.birthdayShown  = d.g.birthdayShown  ?? false;
    d.g.birthdayCodeUsed = d.g.birthdayCodeUsed ?? false;
    d.g.poopDay        = d.g.poopDay        ?? '';
    d.g.poopCount      = d.g.poopCount      ?? 0;
    return d;
  },
  // Migration 1→2 : ajout propsPixels à la racine de D
  function m2(d) {
    d.propsPixels = d.propsPixels ?? {};
    return d;
  },
  // Migration 2→3 : recalage Y des crottes sauvegardées
  // RÔLE : Les crottes existantes en LocalStorage ont un Y=118 (ancien spawn).
  // POURQUOI : Le nouveau Y cible 150–158 pour coller aux pieds du gotchi.
  //            Sans cette migration, les vieilles crottes restent trop hautes jusqu'au prochain nettoyage.
  function m3(d) {
    if (Array.isArray(d.g.poops)) {
      d.g.poops = d.g.poops.map(poop => ({
        ...poop,
        y: (poop.y < 140) ? 150 + Math.floor(Math.random() * 8) : poop.y
      }));
    }
    return d;
  },
  // Migration 3→4 : ajout du champ env sur les props actives
  // RÔLE : Chaque objet actif peut maintenant appartenir à un environnement spécifique
  //        (parc, chambre, montagne). Les objets déjà actifs sans env reçoivent
  //        l'environnement par défaut 'parc' pour ne pas disparaître.
  // POURQUOI : Nouvelle feature — objets différents selon l'environnement.
  function m4(d) {
    if (Array.isArray(d.g.props)) {
      d.g.props = d.g.props.map(p => ({
        ...p,
        // Si l'objet était actif sans env défini → on lui assigne 'parc' par défaut
        env: p.env ?? (p.actif ? 'parc' : null)
      }));
    }
    return d;
  },
  // Migration 4→5 : ajout du timestamp d'acquisition sur chaque prop
  // RÔLE : Permet d'identifier les objets récents (< 48h) pour les afficher en tête de liste.
  // POURQUOI : Les objets existants reçoivent 0 → ils ne seront jamais considérés comme "nouveaux".
  function m5(d) {
    if (Array.isArray(d.g.props)) {
      d.g.props = d.g.props.map(p => ({
        ...p,
        acquis: p.acquis ?? 0  // 0 = objet antérieur à la feature, jamais "new"
      }));
    }
    return d;
  },
  // Migration 5→6 : ajout du champ salete
  // RÔLE : Niveau de saleté du Gotchi (0 = propre, 10 = très sale).
  // POURQUOI : Nouvelle feature — saleté passive + nettoyage par frottement.
  //            Les utilisatrices existantes démarrent propres (salete = 0).
  function m6(d) {
    d.g.salete = d.g.salete ?? 0;
    return d;
  },
  // Migration 6→7 : ajout lastMissedPenalty à la racine de D
  // RÔLE : Mémorise la date de la dernière pénalité XP pour habitudes non cochées.
  // POURQUOI : Sans ce flag, la pénalité se redéclencherait à chaque ouverture de l'app.
  function m7(d) {
    d.lastMissedPenalty = d.lastMissedPenalty ?? null;
    return d;
  },
  // Migration 7→8 : ajout du champ hunger dans D.g
  // RÔLE : Jauge de faim du Gotchi (0 = rassasié·e, 3 = très faim).
  // POURQUOI : Nouvelle feature — hunger descend si une fenêtre repas est manquée.
  //            Les utilisatrices existantes démarrent rassasiées (hunger = 0).
  function m8(d) {
    d.g.hunger = d.g.hunger ?? 0;
    return d;
  },
  // Migration 8→9 : ajout streak de présence global + habitude vedette du jour + milestone props
  // RÔLE : Trois nouvelles mécaniques faible-effort ajoutées en session 2026-05-01.
  //        presenceStreak/lastPresenceDate : jours consécutifs d'ouverture.
  //        catVedette/catVedetteDate       : catégorie bonus du jour (+4 pétales).
  //        milestoneProps                  : objets offerts aux transitions de stade.
  // POURQUOI : Les utilisatrices existantes démarrent avec streak=0 (normal) et
  //            aucune vedette ni milestone enregistré.
  function m9(d) {
    d.presenceStreak   = d.presenceStreak   ?? 0;
    d.lastPresenceDate = d.lastPresenceDate ?? null;
    d.catVedetteDate   = d.catVedetteDate   ?? null;
    d.catVedette       = d.catVedette       ?? null;
    d.milestoneProps   = d.milestoneProps   ?? [];
    return d;
  }
];

// RÔLE : Applique toutes les migrations manquantes sur D chargé depuis LocalStorage.
function migrate(d) {
  const from = d.schemaVersion ?? 0; // 0 = sauvegarde sans version (ancienne)
  for (let i = from; i < MIGRATIONS.length; i++) {
    d = MIGRATIONS[i](d);
  }
  d.schemaVersion = SCHEMA_VERSION; // marque la version atteinte
  return d;
}

// Chargement avec fusion (Spread Operator) pour éviter de casser les anciennes sauvegardes
function load() {
  try {
    const r = localStorage.getItem(SK);
    if (r) {
      let d = JSON.parse(r);
      d = migrate(d);
      if (d.habits) d.habits = d.habits.map(h => {
        const cat = CATS.find(c => c.id === h.catId);
        const isBrut = cat && h.label === h.catId;
        return isBrut ? {...h, label: cat.label} : h;
      });
      return {...defs(), ...d, g:{...defs().g, ...d.g}, habits:d.habits||defs().habits};
    }
  } catch(e) { console.warn('[HabitGotchi] load() échoué :', e); }
  return defs();
}

// Sauvegarde synchrone dans le LocalStorage
// RÔLE : Sérialise window.D dans localStorage sous la clé SK.
// POURQUOI : Le catch loggue l'erreur au lieu de l'avaler — utile si
//            le localStorage est plein (Safari privé, quota dépassé).
function save() {
  try {
    localStorage.setItem(SK, JSON.stringify(window.D));
  } catch(e) {
    console.warn('[HabitGotchi] save() échoué :', e);
  }
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
// RÔLE : Vide tous les caches PWA, désinstalle le Service Worker, puis recharge la page.
// POURQUOI : location.reload() seul ne suffit pas — le SW déjà installé peut resservir
//            l'ancienne version depuis son propre cache avant que les caches soient repeuplés.
//            On attend que tous les cache.delete() soient finis (await Promise.all)
//            avant de recharger, pour éviter un timing race avec un cache encore en cours.
async function forceUpdate() {
  toast(`Mise à jour en cours... ✿`);

  // Étape 1 : désinstaller le Service Worker actif (empêche de resservir l'ancienne version)
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));
  }

  // Étape 2 : vider tous les caches (on attend la fin avant de recharger)
  if ('caches' in window) {
    const names = await caches.keys();
    await Promise.all(names.map(n => caches.delete(n)));
  }

  // Étape 3 : rechargement — tous les caches sont vides, le SW est désinstallé
  window.location.reload();
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
function nxtTh(xp)  { for(const s of STG) if(xp<s.th) return s.th; return XP_MAX; }

// RÔLE : Retourne le numéro de micro-palier adulte (0 à 9) tous les 200 XP à partir de 500
// POURQUOI : Les 5 stades adultes (500→4000) sont trop espacés pour donner un feedback régulier.
//            Un micro-palier tous les 200 XP fournit un "ding" visuel sans toucher à la logique STG.
//            Retourne null si le gotchi n'est pas encore adulte.
function getMicroPalier(xp) {
  if (xp < 500) return null;                          // pas encore au stade adulte
  return Math.min(9, Math.floor((xp - 500) / 200));  // palier 0 (500 XP) → palier 9 (2300 XP+)
}
window.getMicroPalier = getMicroPalier;

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

    // RÔLE : Offre un objet cadeau à chaque transition de stade (milestone).
    // POURQUOI : Récompense tangible au level-up — rend l'événement mémorable.
    //            offrirPropMilestone() gère les doublons via D.milestoneProps.
    //            Guard n > 0 : pas de cadeau si la pénalité XP fait rétrograder.
    if (n > 0 && typeof offrirPropMilestone === 'function') {
      offrirPropMilestone(nouveauStade);
    }
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
    // RÔLE : Y positionné au niveau du sol où marchent les pieds du gotchi
    // POURQUOI : Les pieds des sprites (adult: y+PX*10=50px, with by=85+bobY≈20 → drawY≈105 → pieds à ~155)
    //            → on cible 150–158 pour coller à la zone de marche réelle, quel que soit le stade.
    y = 150 + Math.floor(Math.random() * 8);
    tooClose = (window.D.g.poops || []).some(p => Math.abs(p.x - x) < 28);
    attempts++;
  } while (tooClose && attempts < 20);
  
  window.D.g.poops.push({ id: Date.now(), x, y });
  window.D.g.poopCount++;
  window.D.g.lastPoopSpawn = Date.now();
  // RÔLE : Chaque nouvelle crotte ajoute 1 point de saleté (plafonné à 10)
  // POURQUOI : La saleté est liée aux poops — cohérent avec le comportement du Gotchi
  window.D.g.salete = Math.min(10, (window.D.g.salete || 0) + 1);
  save();
  if (typeof updUI === 'function') updUI();
}

/* ─── SALETÉ PASSIVE ──────────────────────────────────────────────── */
// RÔLE : Calcule la saleté accumulée par le temps depuis la dernière visite.
// POURQUOI : Appelée au bootstrap, comme la pénalité d'absence.
//            +1 point toutes les 6h d'absence (plafonné à 10).
//            La saleté liée aux poops est gérée dans spawnPoop().
window.checkSalete = function checkSalete() {
  const D = window.D;
  if (!D.lastActive) return; // premier lancement : rien à calculer
  const heuresAbsence = (Date.now() - new Date(D.lastActive)) / (1000 * 60 * 60);
  const pointsTemps   = Math.floor(heuresAbsence / 6); // +1 par tranche de 6h
  if (pointsTemps > 0) {
    D.g.salete = Math.min(10, (D.g.salete || 0) + pointsTemps);
    // pas de save() ici — le bootstrap appellera save() après checkWelcome()
  }

  // RÔLE : Garantit au moins 1 crotte par jour au bootstrap si aucune n'a spawné aujourd'hui.
  // POURQUOI : Si l'app est ouverte très peu (2-3 min), l'interval 30 min ne tourne pas assez
  //            pour que le spawn aléatoire se déclenche. Sans cette garde, le gotchi peut passer
  //            une journée entière sans crotte → saleté invisible → pas de boucle d'engagement.
  const td = today();
  const poopAujourdhui = D.g.poopDay === td && (D.g.poopCount || 0) > 0;
  if (!poopAujourdhui && (D.g.poops || []).length < 5) {
    spawnPoop(); // 1 crotte garantie au premier lancement du jour
  }
};

/* ─── FAIM PASSIVE ────────────────────────────────────────────────── */
// RÔLE : Calcule la faim accumulée depuis la dernière session.
//        Pour chaque fenêtre repas passée dans la journée sans repas pris,
//        hunger monte d'1 point (plafonné à 3).
//        Si hunger >= 2 au bootstrap → bulle "j'ai faim" déclenchée 1.5s après l'ouverture.
// POURQUOI : Pas de timer interne — le check se fait à l'ouverture de l'app (bootstrap)
//            et à chaque retour foreground via initApp() → cohérent avec checkSalete().
//            energy et happiness ne sont JAMAIS modifiés automatiquement (auto-report utilisatrice).
window.checkHunger = function checkHunger() {
  const D = window.D;
  const h = hr(); // heure courante (entier 0–23)
  const meals = ensureMealsToday();

  // RÔLE : Liste les fenêtres repas dont la fin est déjà passée aujourd'hui.
  // POURQUOI : Une fenêtre manquée = le créneau est fermé ET le repas n'a pas été pris.
  const windows = window.HG_CONFIG?.MEAL_WINDOWS ?? {
    matin: { start: 7,  end: 11 },
    midi:  { start: 11, end: 15 },
    soir:  { start: 18, end: 22 },
  };

  let fenetresManquees = 0;
  for (const [key, w] of Object.entries(windows)) {
    // La fenêtre est "passée" si l'heure actuelle dépasse sa fermeture ET que le repas n'a pas été pris
    if (h >= w.end && !meals[key]) {
      fenetresManquees++;
    }
  }

  // RÔLE : hunger = nombre de fenêtres manquées, plafonné à 3.
  // POURQUOI : Chaque repas raté = +1 faim. 3 repas ratés = faim max.
  //            On prend le max entre la valeur courante et le calcul,
  //            pour ne pas faire redescendre hunger si l'utilisatrice a ouvert l'app en cours de journée.
  const nouvelleHunger = Math.min(3, fenetresManquees);
  D.g.hunger = Math.max(D.g.hunger ?? 0, nouvelleHunger);

  // RÔLE : Bulle "j'ai faim" si hunger >= 2 au bootstrap.
  // POURQUOI : Signal expressif sans modifier energy ni happiness (auto-report uniquement).
  //            Délai 1.5s pour laisser l'UI se monter correctement avant d'afficher la bulle.
  if (D.g.hunger >= 2) {
    const bullesFaim = [
      "J'ai le ventre qui gargouille… 🍽️",
      "*regardes de ton côté* Tu as oublié mon repas ? 🥺",
      "Un peu de nourriture ça serait pas de refus… 🌸",
      "J'ai faim ! Est-ce que tu as mangé toi aussi ? 🍎",
      "*grommelle* Mon estomac me parle… 😮‍💨",
    ];
    setTimeout(() => {
      flashBubble(bullesFaim[Math.floor(Math.random() * bullesFaim.length)], 3500);
      if (typeof window.triggerExpr === 'function') {
        window.triggerExpr('faim', 60); // expression bouche ouverte
      }
    }, 1500);
  }
};

// Probabilité d'apparition
function maybeSpawnPoop() {
  const now = Date.now();
  window.D.g.lastTick = now; // heartbeat — persisté au prochain save() normal

  // RÔLE : Pas de crotte pendant le sommeil (22h–7h).
  // POURQUOI : Le Gotchi est au repos — visuellement et logiquement incohérent de spawner.
  //            Le rattrapage au réveil est géré par catchUpPoops() avec plafond de 2.
  const hNow = hr();
  if (hNow >= 22 || hNow < 7) return;

  const last = window.D.g.lastPoopSpawn || 0;
  const minDelay = POOP_MIN_DELAY_MS; // 8 minutes minimum entre 2 crottes

  if (now - last < minDelay) return;

  // RÔLE : Probabilité de spawn modulée par l'état du Gotchi.
  // POURQUOI : Rend les crottes cohérentes avec le système de jeu —
  //            un gotchi affamé ou épuisé a un métabolisme ralenti,
  //            un gotchi bien nourri digère activement.
  const hunger = window.D.g.hunger || 0;
  const energy = window.D.g.energy ?? 5;

  let spawnChance;
  if (hunger >= 2) {
    spawnChance = 0.25;       // affamé → système digestif en souffrance
  } else if (energy <= 3) {
    spawnChance = 0.35;       // épuisé → métabolisme ralenti
  } else if (hunger === 0) {
    spawnChance = 0.80;       // bien nourri → digestion active
  } else {
    spawnChance = 0.60;       // état normal
  }

  if (Math.random() < spawnChance) spawnPoop();
}

/* ─── SYSTÈME 1 : Repas (Fenêtres + Snack préféré hebdo) ─────────── */

/**
 * Renvoie un identifiant ISO de semaine (ex: "2026-W17").
 * Sert à détecter le changement de semaine pour rouler le snack préféré.
 * 
 * Métaphore : c'est l'horloge interne du Gotchi pour savoir 
 * "tiens, on est lundi, je change mon goût préféré".
 */
function getWeekId(d = new Date()) {
  const target = new Date(d.valueOf());
  const dayNr  = (d.getDay() + 6) % 7;          // lundi = 0
  target.setDate(target.getDate() - dayNr + 3); // jeudi de la semaine ISO
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target - firstThursday;
  const week = 1 + Math.round(diff / (7 * 24 * 3600 * 1000));
  return `${target.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * Renvoie la fenêtre repas active selon l'heure courante,
 * ou `null` si on est entre deux fenêtres (ex: 16h, 23h).
 */
function getCurrentMealWindow() {
  const h = hr();
  for (const [key, w] of Object.entries(window.HG_CONFIG.MEAL_WINDOWS)) {
    if (h >= w.start && h < w.end) return key;
  }
  return null;
}

/**
 * S'assure que `D.g.meals` existe et correspond à AUJOURD'HUI.
 * Si la date a changé → reset des 3 fenêtres à `false`.
 * Renvoie l'objet meals à jour.
 */
function ensureMealsToday() {
  const td = today();
  if (!window.D.g.meals || window.D.g.meals.dateRef !== td) {
    window.D.g.meals = { matin: false, midi: false, soir: false, dateRef: td };
  }
  return window.D.g.meals;
}

/**
 * S'assure que `D.g.snackPref` existe et correspond à la SEMAINE en cours.
 * Si la semaine a changé → tire un nouvel emoji préféré dans SNACKS_POOL.
 * Renvoie l'emoji préféré.
 */
function ensureSnackPref() {
  const wk = getWeekId();
  if (!window.D.g.snackPref || window.D.g.snackPref.weekId !== wk) {
    const emoji = window.HG_CONFIG.SNACKS_POOL[Math.floor(Math.random() * window.HG_CONFIG.SNACKS_POOL.length)];
    window.D.g.snackPref = { emoji, weekId: wk };
  }
  return window.D.g.snackPref.emoji;
}

/**
 * Tire 3 emojis distincts dans SNACKS_POOL pour le repas en cours.
 * GARANTIT qu'au moins un des 3 est le snack préféré de la semaine.
 * L'ordre est mélangé pour que le préféré ne soit pas toujours en 1er.
 */
function pickThreeSnacks() {
  const pref = ensureSnackPref();
  const pool = window.HG_CONFIG.SNACKS_POOL.filter(e => e !== pref);

  // Pioche 2 emojis distincts dans le pool restant
  const shuffled = pool.sort(() => Math.random() - 0.5);
  const others = shuffled.slice(0, 2);

  // Mélange l'ordre final (préféré + 2 autres)
  return [pref, ...others].sort(() => Math.random() - 0.5);
}

/**
 * Donne un snack au Gotchi pendant la fenêtre repas active.
 * @param {string} emoji - L'emoji choisi par l'utilisatrice (parmi les 3 proposés)
 * 
 * Logique :
 * - +2 pétales pour tout snack (XP de base, comme avant)
 * - +2 pétales bonus si l'emoji = snack préféré de la semaine (total = 4)
 * - Marque la fenêtre repas comme "faite" pour aujourd'hui
 */
function giveSnack(emoji) {
  const win = getCurrentMealWindow();
  if (!win) return;                    // hors fenêtre, sécurité

  const meals = ensureMealsToday();
  if (meals[win]) return;              // déjà mangé sur cette fenêtre

  // RÔLE : Le goûter (15h-17h) est une fenêtre bonus — +2 pétales (multiple de 2 comme tout le reste).
  // POURQUOI : Fenêtre optionnelle légère, pas de snack préféré, pas de hunger reset
  //            (le gotchi n'a pas "faim" au goûter, c'est une petite douceur).
  const winDef = window.HG_CONFIG?.MEAL_WINDOWS?.[win];
  if (winDef?.bonus) {
    meals[win] = true;
    window.D.g.petales = (window.D.g.petales || 0) + 2;
    save();
    addEvent({ type: 'note', subtype: 'meal', valeur: 2,
      label: `${emoji} goûter  +2 🌸` });
    const msgs = ["Miam, une petite douceur ! 🍪", "Goûter ! 💜", "*croque*  ✿", "Un petit quelque chose ? Avec plaisir ! 🌸"];
    flashBubble(msgs[Math.floor(Math.random() * msgs.length)], 2200);
    window.eatAnim = { active: true, timer: 50, emoji: emoji, jumped: false };
    if (typeof updUI === 'function') updUI();
    return;
  }

  const pref = ensureSnackPref();
  const isFav = (emoji === pref);
  const gain = isFav ? 4 : 2;              // +2 base, +2 bonus si préféré
  
  // ✨ Réaction gourmande : déclenchée AVANT l'animation
  if (typeof window.triggerExpr === 'function') {
    window.triggerExpr('faim', 60);
  }
  
  // Marque la fenêtre + crédite les pétales
  meals[win] = true;
  window.D.g.petales = (window.D.g.petales || 0) + gain;

  // RÔLE : Manger rassasie complètement le Gotchi.
  // POURQUOI : hunger est une jauge de manque — dès qu'un repas est pris,
  //            le besoin est satisfait → reset à 0.
  window.D.g.hunger = 0;

  save();
  
  // Log dans le journal (forme objet privilégiée)
  addEvent({
    type: 'note',
    subtype: 'meal',
    valeur: gain,
    label: `${emoji} donné à ${window.D.g.name} (${window.HG_CONFIG.MEAL_WINDOWS[win].label})${isFav ? ' — préféré !' : ''}  +${gain} 🌸`
  });
  
  // Bulle adaptée : "Miam, mon préféré !" si match, sinon message normal
  if (isFav) {
    flashBubble("Miam, mon préféré ! 💜✨", 2800);
  } else {
    const msgs = ["Miam ! 💜", "Délicieux ! ✿", "*mange goulûment* 😋", "Encore ! 🌸", "C'était bon ça ! 💜"];
    flashBubble(msgs[Math.floor(Math.random() * msgs.length)], 2500);
  }
  
  // Animation pixel : descente d'emoji
  window.eatAnim = { active: true, timer: 50, emoji: emoji, jumped: false };
  
  // ✨ Réaction joie : après dégustation
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
  window.D.g.salete = 0; // RÔLE : reset complet de la jauge de saleté après nettoyage
                          // POURQUOI : sans ce reset, salete monte indéfiniment et le dithering
                          //            ne disparaît jamais même après nettoyage — bug critique
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

// RÔLE : Ajoute un événement dans le journal (Terminal), file FIFO limitée à 40 entrées.
// POURQUOI : Signature unique objet — la forme legacy (type, valeur, label) a été supprimée
// en session 5 (2026-04-30). Tous les appelants utilisent la forme { type, subtype, valeur, label }.
function addEvent(ev) {
  if (!window.D.eventLog) window.D.eventLog = [];

  // Horodatage systématique + spread des propriétés fournies
  const entry = { date: new Date().toISOString(), ...ev };

  window.D.eventLog.unshift(entry);
  if (window.D.eventLog.length > 40) window.D.eventLog.length = 40; // FIFO : garde les 40 plus récents
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
    font-size:var(--fs-xs);font-weight:bold;font-family:var(--font-body);
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
   STREAKS PAR HABITUDE
   ============================================================ */

// RÔLE : Recalcule le streak (jours consécutifs) pour chaque habitude à partir de D.log.
// POURQUOI : D.log est la source de vérité — on relit l'historique en remontant jour par jour
//            jusqu'à trouver un jour sans cochage. Le résultat est mis en cache dans D.streaks
//            pour être lu par toggleHab() et renderHabs() sans recalcul répété.
function computeStreaks() {
  if (!window.D) return;
  // Initialise ou réutilise l'objet streaks
  window.D.streaks = window.D.streaks || {};

  // On construit la liste des catégories déclarées
  const catIds = (window.D.habits || []).map(h => h.catId);

  catIds.forEach(catId => {
    let streak = 0;
    // On remonte le calendrier depuis aujourd'hui vers le passé
    // POURQUOI : on incrémente tant que la catégorie apparaît dans D.log[date]
    let d = new Date();
    for (let i = 0; i < 365; i++) {
      // Formater la date en AAAA-MM-JJ (même format que today())
      const key = d.toISOString().slice(0, 10);
      const log = window.D.log[key] || [];

      if (log.includes(catId)) {
        streak++;
        // Reculer d'un jour
        d.setDate(d.getDate() - 1);
      } else {
        // Jour manqué : on arrête le comptage
        break;
      }
    }
    window.D.streaks[catId] = streak;
  });
}

/* ============================================================
   STREAK DE PRÉSENCE GLOBAL (S8)
   ============================================================ */
// RÔLE : Met à jour le streak de jours consécutifs d'ouverture de l'app.
// POURQUOI : Chaque jour où l'utilisatrice ouvre l'app incrémente presenceStreak.
//            Si elle saute un jour, le streak repart de 1.
//            Appelée dans handleDailyReset() — une fois par session.
// JALONS : 3j → toast "3 jours de suite !" · 7j → badge + bulle · 14j → célébration
function updatePresenceStreak() {
  const D = window.D;
  const td = today();
  if (D.lastPresenceDate === td) return; // déjà compté aujourd'hui

  // Calcule si hier était le dernier jour de présence
  const hier = new Date();
  hier.setDate(hier.getDate() - 1);
  const hierStr = hier.toISOString().slice(0, 10);

  if (D.lastPresenceDate === hierStr) {
    // Journée consécutive → on incrémente
    D.presenceStreak = (D.presenceStreak || 0) + 1;
  } else {
    // Saut ou premier lancement → repart de 1
    D.presenceStreak = 1;
  }
  D.lastPresenceDate = td;

  // Jalons de célébration
  const streak = D.presenceStreak;
  const jalons = {
    3:  { msg: `3 jours de suite ! Tu reviens chaque jour 💜`, petales: 0 },
    7:  { msg: `Une semaine d'affilée ! Je suis si content·e de te voir 🌟`, petales: 3 },
    14: { msg: `14 jours consécutifs !! On est inséparables ✨🔥`, petales: 5 },
    30: { msg: `30 jours ! Tu es légendaire 👑`, petales: 10 },
  };
  if (jalons[streak]) {
    const j = jalons[streak];
    // Délai court pour laisser l'UI se charger
    setTimeout(() => {
      flashBubble(j.msg, 4500);
      if (j.petales > 0) {
        D.g.petales = (D.g.petales || 0) + j.petales;
        if (typeof toast === 'function') toast(`🎉 ${streak} jours — +${j.petales} 🌸`);
      }
      window.triggerGotchiBounce?.();
      window.triggerExpr?.('joie', 140);
      // Confettis
      const gx = window._gotchiX || 100, gy = window._gotchiY || 100;
      for (let i = 0; i < 30; i++) {
        window.spawnP?.(gx + (Math.random() - 0.5) * 80, gy - 20,
          ['#f59e0b','#c084fc','#fb7185','#34d399','#60a5fa'][i % 5]);
      }
    }, 800);
  }
  save();
}
window.updatePresenceStreak = updatePresenceStreak;

/* ============================================================
   HABITUDE VEDETTE DU JOUR (S2)
   ============================================================ */
// RÔLE : Tire au sort une catégorie d'habitude chaque matin → rapporte +4 pétales
//        au lieu de +2 ce jour-là (bonus en plus du streak existant).
// POURQUOI : Injecte un élément de surprise quotidien sans complexifier l'UI.
//            Le tirage est déterministe sur la journée (même catégorie toute la journée).
//            Appelée dans handleDailyReset() pour garantir un tirage frais chaque jour.
function refreshCatVedette() {
  const D = window.D;
  const td = today();
  if (D.catVedetteDate === td) return; // déjà tiré aujourd'hui

  // Tirage pseudo-aléatoire déterministe : hash de la date → index dans CATS
  const hash = td.split('-').reduce((acc, v) => acc + parseInt(v), 0);
  const idx  = hash % CATS.length;
  D.catVedette     = CATS[idx].id;
  D.catVedetteDate = td;
  save();
}
window.refreshCatVedette = refreshCatVedette;

/* ============================================================
   OBJET MILESTONE OFFERT (S7)
   ============================================================ */
// RÔLE : Offre un objet gratuit du catalogue à chaque transition de stade (egg→baby etc.).
// POURQUOI : Récompense tangible au level-up — rend le stade symboliquement mémorable.
//            On cible des objets non encore acquis, dans l'ordre d'un pool par stade.
//            Si tous les objets du pool sont acquis → rien (évite les doublons).
// APPELÉ par : addXp() quand ancienStade !== nouveauStade et n > 0.
// POURQUOI : Uniquement des objets à cout 6 (les cout 0 sont déjà dans l'inventaire par défaut).
//            On offre dans l'ordre du pool — le 1er non-acquis est choisi.
const MILESTONE_PROPS_POOL = {
  baby:  ['noeud01', 'champignon01', 'cactus01'],
  teen:  ['echarpe01', 'toque01', 'lampe01'],
  adult: ['couronne01', 'chapeau_sorcier01', 'nuage_reve01', 'flocon01', 'coussin01'],
};

function offrirPropMilestone(stadeLabel) {
  const D = window.D;
  if (!window.PROPS_LIB || !window.PROPS_LIB.length) return; // catalogue pas encore chargé

  // Retrouve la clé de stade (baby/teen/adult) depuis le label
  const stadeKey = STG.find(s => s.l === stadeLabel)?.k || 'adult';
  const pool = MILESTONE_PROPS_POOL[stadeKey] || MILESTONE_PROPS_POOL['adult'];

  // Cherche le premier prop du pool non encore acquis
  const propId = pool.find(id =>
    !D.g.props.some(p => p.id === id) &&       // pas encore dans l'inventaire
    !D.milestoneProps.includes(id)             // pas déjà offert comme milestone
  );
  if (!propId) return; // tous déjà acquis

  const def = window.PROPS_LIB.find(p => p.id === propId);
  if (!def) return;

  // Ajoute l'objet à l'inventaire gratuitement
  D.g.props.push({
    id: def.id, nom: def.nom, type: def.type,
    emoji: def.emoji || '🎁', actif: false,
    acquis: Date.now()
  });
  D.milestoneProps.push(propId);
  save();

  // Notification visuelle
  setTimeout(() => {
    if (typeof toast === 'function') toast(`🎁 Cadeau de stade : ${def.emoji} ${def.nom} !`);
    flashBubble(`Un cadeau pour toi ! ${def.emoji} ${def.nom} est dans ton inventaire 🎁`, 4000);
    if (typeof updBadgeBoutique === 'function') updBadgeBoutique();
  }, 1500); // après l'animation de transition de stade
}
window.offrirPropMilestone = offrirPropMilestone;

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

    // ── Calcul du streak mis à jour ──
    // RÔLE : On recalcule les streaks après avoir enregistré le cochage du jour,
    //        pour que le streak courant reflète déjà aujourd'hui.
    computeStreaks();
    const streakActuel = window.D.streaks[catId] || 1; // au moins 1 (le jour courant)

    // ── Créditation pétales (1 seule fois par habitude par jour) ──
    const dejaGagne = window.D.petalesEarned[td].includes(catId);
    if (!dejaGagne) {
      // +2 pétales de base, +N bonus si streak (cap à 7 jours)
      // POURQUOI : le bonus escalant récompense la régularité sans devenir infini
      const bonusStreak = streakActuel >= 2 ? Math.min(streakActuel, 7) : 0;

      // RÔLE : Bonus vedette du jour (+2 supplémentaires si cette catégorie est la vedette).
      // POURQUOI : 1 catégorie tirée au sort chaque matin vaut +4 au lieu de +2 (avant streaks).
      //            isVedette est true uniquement si le tirage du jour correspond à cette catégorie.
      const isVedette   = (window.D.catVedette === catId && window.D.catVedetteDate === td);
      const bonusVedette = isVedette ? 2 : 0; // +2 bonus vedette (base 2 → 4)

      const gainTotal   = 2 + bonusStreak + bonusVedette;
      window.D.g.petales = (window.D.g.petales || 0) + gainTotal;
      window.D.petalesEarned[td].push(catId);

      // Toast + console vedette si c'est la catégorie du jour
      if (isVedette) {
        const cat = CATS.find(c => c.id === catId);
        // Toast discret dans la console du jeu (terminal/eventLog)
        if (typeof toast === 'function') toast(`⭐ Vedette du jour ! +${bonusVedette} 🌸 bonus`);
        setTimeout(() => {
          const el = document.querySelector(`[onclick="toggleHab('${catId}')"]`);
          if (el) floatXP(el.closest('.hab'), `⭐ Vedette — +${gainTotal} 🌸 !`);
        }, 200);
        setTimeout(() => flashBubble(`${cat?.icon || '⭐'} Habitude vedette du jour ! +${gainTotal} 🌸`, 3200), 600);
      }

      // Toast streak si la série est notable (≥2 jours)
      if (streakActuel >= 2) {
        const streakLabel = streakActuel >= 7
          ? `🔥×${streakActuel} MAX — +${gainTotal} 🌸 !`
          : `🔥×${streakActuel} — +${gainTotal} 🌸 !`;
        setTimeout(() => {
          const el = document.querySelector(`[onclick="toggleHab('${catId}')"]`);
          if (el) floatXP(el.closest('.hab'), streakLabel);
        }, isVedette ? 800 : 400); // décalé si vedette déjà affiché
      }

      addEvent({ type: 'habitude', subtype: 'check', valeur: 15,
        label: `${hab?.label || catId} ✓  +15 XP, +${gainTotal} 🌸${streakActuel >= 2 ? ` 🔥×${streakActuel}` : ''}${isVedette ? ' ⭐vedette' : ''}` });
    } else {
      addEvent({ type: 'habitude', subtype: 'check', valeur: 15,
        label: `${hab?.label || catId} ✓  +15 XP` });
    }

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
intel: { msg: "Tu apprends… je sens mon monde s'agrandir 📚", anim: 'flower', body: 'nod',
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
serene: { msg: "Tu as médité… je me sens plus calme aussi 💜", anim: 'sparkle', body: 'nod',
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
    // RÔLE : Saut court pour les catégories de réflexion/soin (intel, serene).
    // POURQUOI : Le hochement a été supprimé — effet trop peu lisible à cette résolution.
    //            On réutilise saut_joie (plus court depuis le réglage 12f) qui reste doux
    //            et cohérent avec le feedback positif attendu pour intel et serene.
    if (reaction.body === 'nod')    window.triggerGotchiBounce?.();
    reaction.spawn?.();

    // ✨ Réaction d'expression : sourire large + joues rouges
    if (typeof window.triggerExpr === 'function') {
      // Le mood dépend du bonheur actuel : si déjà heureux, grande joie
      const mood = window.D.g.happiness > 60 ? 'joie' : 'surprise';
      window.triggerExpr(mood, 90);  // ~1.5s de réaction
    }

    // ── Bulles de jalon streak ──
    // RÔLE : Si le streak atteint exactement 3, 7 ou 14 jours, remplacer la bulle
    //        de réaction par une bulle spéciale après un court délai.
    // POURQUOI : Le délai de 1.2s laisse la bulle de réaction se lire avant d'être
    //            écrasée par le message de jalon — les deux sont perceptibles.
    const JALONS_STREAK = {
      3:  [
        "3 jours d'affilée… tu es régulier·e 💜",
        "3 jours ! Je sens que quelque chose change 🌱",
        "Tu reviens chaque jour… ça compte vraiment 🔥",
      ],
      7:  [
        "Une semaine entière ! Je suis si fier·e de toi 🌟",
        "7 jours de suite… tu es en train de construire quelque chose ✨",
        "Une semaine ! Le gotchi danse de joie 🎉",
      ],
      14: [
        "14 jours ! Tu es incroyable — je grandis avec toi 💜🔥",
        "Deux semaines d'affilée… je n'oublierai jamais ça 🌸",
        "14 jours ! On forme une belle équipe, toi et moi ✨",
      ],
    };
    if (JALONS_STREAK[streakActuel]) {
      const pool = JALONS_STREAK[streakActuel];
      const msg  = pool[Math.floor(Math.random() * pool.length)];
      setTimeout(() => {
        flashBubble(msg, 4000);
        window.triggerGotchiBounce?.();
        window.triggerExpr?.('joie', 120);
        // Particules de célébration
        for (let i = 0; i < 20; i++) {
          window.spawnP?.(
            gx + (Math.random() - 0.5) * 60,
            gy - 20,
            ['#f59e0b','#c084fc','#fb7185','#34d399'][i % 4]
          );
        }
      }, 1200);
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

  // RÔLE : Bonus "journée complète" — toutes les habitudes cochées le même jour.
  // POURQUOI : Crée une source de pétales régulière plafonnée à 1×/jour.
  //            +2 maintient la cohérence avec les multiples de 2 de l'économie.
  //            Guard '__journee_complete__' dans petalesEarned empêche le double gain
  //            si l'utilisatrice décoche puis recoche une habitude.
  if (!window.D.petalesEarned[td].includes('__journee_complete__')) {
    window.D.g.petales = (window.D.g.petales || 0) + 2;
    window.D.petalesEarned[td].push('__journee_complete__');
    addEvent({ type: 'habitude', subtype: 'journee_complete', valeur: 2,
      label: 'Toutes les habitudes du jour — +2 🌸' });
    setTimeout(() => flashBubble("Tu as tout fait ! Bonus +2 🌸🎉", 3500), 200);
  } else {
    flashBubble("Tu as tout fait ! Je suis trop content.e 🎉", 3000);
  }

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

// RÔLE : Version "anti-rafale" de save() pour les sliders.
// POURQUOI : setEnergy et setHappy sont appelées à chaque pixel de déplacement
//            du slider. Sans debounce, save() écrit dans localStorage des dizaines
//            de fois par seconde. Ici on attend 300ms de calme avant d'écrire.
let _saveTimer = null;
function saveDebounced() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => save(), 300);
}

// Mise à jour des jauges vitales (0-5)
// RÔLE : Modifie D.g.energy, sauvegarde, et met à jour les labels si présents dans le DOM.
// POURQUOI : Les anciens IDs (#sv-energy, #sv-energy-compact) ont été supprimés avec le #console-top.
//            Les nouveaux IDs (#modal-sv-energy) sont dans la bottom sheet dynamique — vérification défensive.
function setEnergy(v) {
  window.D.g.energy = +v;
  const el = document.getElementById('modal-sv-energy');
  if (el) el.textContent = v;
  saveDebounced();
}
function setHappy(v) {
  window.D.g.happiness = +v;
  const el = document.getElementById('modal-sv-happy');
  if (el) el.textContent = v;
  saveDebounced(); updBubbleNow();
}

/* ─── SYSTÈME 2 : ÉCOSYSTÈME & TOPOGRAPHIE (Suite) ───────────────── */

function changeEnv(v) { window.D.g.activeEnv = v; save(); }

/* ─── SYSTÈME 5 : INVENTAIRE & PERSONNALISATION ─────────────────── */

/* ============================================================
   INIT PROPS DE BASE
   ============================================================ */
// RÔLE : Débloque les objets gratuits (cout = 0) + les objets définis dans user_config.startProps.
// POURQUOI : Les objets exclusifs d'une utilisatrice (ex: aspirateur d'Alexia) sont listés
//            dans son user_config.json et débloqués ici au premier lancement.
function initBaseProps() {
  if (window.D.propsInitialized) return;

  // 1. Objets gratuits — on filtre simplement sur cout:0 dans PROPS_LIB.
  // POURQUOI : Avant, il fallait exclure categorie:"pack" car les packs avaient cout:0
  //            dans l'ancien props.json. Maintenant props_packs.json est une source
  //            séparée et ses objets ont des catégories métier normales — le filtre
  //            categorie!=="pack" est supprimé, il n'a plus de sens.
  const base = (window.PROPS_LIB || []).filter(p => p.cout === 0);
  base.forEach(b => {
    if (!window.D.g.props.find(p => p.id === b.id)) {
      window.D.g.props.push({ id:b.id, nom:b.nom, type:b.type, emoji:b.emoji||'🎁', actif:false });
    }
  });

  // 2. Objets exclusifs via user_config.startProps
  const extra = window.USER_CONFIG?.startProps || [];
  extra.forEach(id => {
    const prop = (window.PROPS_LIB || []).find(p => p.id === id);
    if (prop && !window.D.g.props.find(p => p.id === id)) {
      window.D.g.props.push({ id:prop.id, nom:prop.nom, type:prop.type, emoji:prop.emoji||'🎁', actif:false });
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
    const METEO_LAT = window.USER_CONFIG?.meteo?.lat ?? window.D?.g?.lat ?? 43.6047;
    const METEO_LON = window.USER_CONFIG?.meteo?.lon ?? window.D?.g?.lng ?? 1.4442;
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
  const lat = window.USER_CONFIG?.meteo?.lat ?? window.D.g.lat;
  const lng = window.USER_CONFIG?.meteo?.lon ?? window.D.g.lng;
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

  // RÔLE : Déclenche l'animation d'étirement si la bulle contient "*s'étire*".
  // POURQUOI : getMorningMsg() produit des bulles avec cette action gestuelle —
  //            le Gotchi doit s'étirer visuellement en même temps que le texte l'indique.
  //            force=true : pas de verrou journalier — la bulle peut apparaître plusieurs fois
  //            (streak 7j, fallback matin…) et chaque occurrence mérite l'animation.
  if (msg.includes("*s'étire*")) {
    setTimeout(() => window.triggerEtirementMatin?.(true), 300);
  }
  // RÔLE : Saut si la bulle contient "*saute*" ou "*sautille*" ou "*fait des bonds*".
  // POURQUOI : Cohérence geste/animation pour les bulles du streak élevé.
  if (msg.includes('*sautille*') || msg.includes('*saute') || msg.includes('*fait des bonds*')) {
    setTimeout(() => window.triggerGotchiBounce?.(), 300);
  }
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

  // ── Priorité 1b : Saleté élevée sans crottes visibles ──────────
  // RÔLE : Si salete >= 7 sans que le seuil de crottes (>=3) ait été atteint,
  //        le gotchi exprime son inconfort corporel.
  // POURQUOI : La saleté peut monter par inactivité (checkSalete) sans spawn
  //            de crottes — ce cas était silencieux. Uniquement le jour
  //            pour rester cohérent avec les autres priorités diurnes.
  if (h >= 7 && h < 22 && (window.D.g.salete ?? 0) >= 7) {
    const pool = [
      "Ça commence à sentir le renard par ici… 🦊",
      "*se renifle* Mmh. J'aurais besoin d'un bain. 🛁",
      "Je me sens un peu... crade. 😬",
      "*regarde ses pattes* C'est quoi ce truc ? 🤔",
      "Un peu de propreté ça ferait pas de mal 🧼",
    ];
    const el = document.getElementById('bubble');
    if (el) el.textContent = pool[Math.floor(Math.random() * pool.length)];
    return;
  }

  // ── Priorité 2 : Faim (hunger >= 2) ───────────────────────────
  // RÔLE : Si le gotchi a faim, il le dit en priorité — mais uniquement le jour.
  // POURQUOI : hunger est un état passif (fenêtres repas manquées) qui mérite
  //            une expression dédiée, sans écraser les bulles de nuit.
  //            On ne modifie pas energy ni happiness (auto-report utilisatrice uniquement).
  if (h >= 7 && h < 22 && (window.D.g.hunger ?? 0) >= 2) {
    const pool = [
      "J'ai le ventre qui gargouille… 🍽️",
      "*regardes de ton côté* Tu as oublié mon repas ? 🥺",
      "Un peu de nourriture ça serait pas de refus… 🌸",
      "J'ai faim ! Est-ce que tu as mangé toi aussi ? 🍎",
      "*grommelle* Mon estomac me parle… 😮‍💨",
    ];
    const el = document.getElementById('bubble');
    if (el) el.textContent = pool[Math.floor(Math.random() * pool.length)];
    return;
  }

  // ── Priorité 2b : Repas oublié (fenêtre active non prise) + anticipation (30 min avant) ──
  // RÔLE : Deux cas couverts :
  //   A) On est dans une fenêtre repas ouverte et le repas n'a pas encore été pris.
  //   B) On est à moins de 30 min de l'ouverture d'une fenêtre non encore prise.
  // POURQUOI : Agit comme un rappel doux sans notification native.
  //            Uniquement si hunger < 2 (sinon la Priorité 2 a déjà géré).
  //            ensureMealsToday() est la source de vérité pour les repas du jour.
  if (h >= 7 && h < 22) {
    const mins = new Date().getMinutes();
    const hFloat = h + mins / 60;
    const meals   = typeof ensureMealsToday === 'function' ? ensureMealsToday() : {};
    const WINDOWS = window.HG_CONFIG?.MEAL_WINDOWS ?? {};

    // Cas A : fenêtre active sans repas pris (hors goûter — trop léger pour insister)
    let fenetreOubliee = null;
    for (const [key, w] of Object.entries(WINDOWS)) {
      if (w.bonus) continue; // goûter ignoré
      if (hFloat >= w.start && hFloat < w.end && !meals[key]) {
        fenetreOubliee = w;
        break;
      }
    }
    if (fenetreOubliee) {
      const pool = [
        `${fenetreOubliee.icon} C'est l'heure du ${fenetreOubliee.label.toLowerCase()}… tu n'as pas oublié ? 🍽️`,
        `Hé ! Le ${fenetreOubliee.label.toLowerCase()} c'est maintenant ! J'ai faim moi 🥺`,
        `*regarde l'heure* ${fenetreOubliee.icon} Le ${fenetreOubliee.label.toLowerCase()} t'attend… 🌸`,
      ];
      const el = document.getElementById('bubble');
      if (el) el.textContent = pool[Math.floor(Math.random() * pool.length)];
      return;
    }

    // Cas B : dans les 30 min avant l'ouverture d'une fenêtre non prise
    let prochaine = null;
    for (const [key, w] of Object.entries(WINDOWS)) {
      if (w.bonus) continue; // goûter ignoré
      const dist = w.start - hFloat;
      if (dist > 0 && dist <= 0.5 && !meals[key]) {
        prochaine = w;
        break;
      }
    }
    if (prochaine) {
      const pool = [
        `Bientôt l'heure du ${prochaine.label.toLowerCase()} ! J'ai déjà l'eau à la bouche 🍽️`,
        `${prochaine.icon} Le repas approche… tu penses à moi ? 🌸`,
        `Encore un peu de patience… l'heure du ${prochaine.label.toLowerCase()} arrive ! 😋`,
      ];
      const el = document.getElementById('bubble');
      if (el) el.textContent = pool[Math.floor(Math.random() * pool.length)];
      return;
    }
  }

  // ── Priorité 3 : Nuit ──────────────────────────────────────────
  if (h >= 22 || h < 7) {
    const pool = src.nuit || ["Zzz... 🌙", "*ronfle* 💤", "...zzZZ... 🌛", "Dors bien ✿"];
    const el = document.getElementById('bubble');
    if (el) {
      // BUGFIX : appliquer le replace {{diminutif}} comme dans le chemin principal
      // POURQUOI : sans ça, les bulles nuit contenant {{diminutif}} affichent le placeholder brut
      let bulle = pool[Math.floor(Math.random() * pool.length)];
      bulle = bulle.replace('{{diminutif}}', D.g.userNickname || D.g.userName || 'toi');
      el.textContent = bulle;
    }
    return;
  }

  // ── Priorité 4 : Pool pondéré ──────────────────────────────────
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

/* ── Bulles IA : 50% du pool ── */
const cb = D.g.customBubbles;
if (Array.isArray(cb) && cb.length) {
  const maxIA = Math.max(1, Math.floor(pool.length));
  const selection = [...cb].sort(() => Math.random() - 0.5).slice(0, maxIA);
  pool.push(...selection);
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
    bulle = bulle.replace('{{diminutif}}', D.g.userNickname || D.g.userName || 'toi');
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

  // RÔLE : Recalculer les streaks à chaque ouverture de l'app.
  // POURQUOI : Si l'utilisateur·rice n'a pas coché une habitude hier, le streak doit
  //            être remis à zéro aujourd'hui — sans attendre un cochage.
  computeStreaks();

  // RÔLE : Mise à jour du streak de présence global (jours consécutifs d'ouverture).
  // POURQUOI : Doit s'exécuter après computeStreaks() — indépendant des habitudes.
  updatePresenceStreak();

  // RÔLE : Tirage de la catégorie vedette du jour (1 catégorie = +4 pétales au lieu de +2).
  // POURQUOI : Se renouvelle chaque jour automatiquement au premier lancement.
  refreshCatVedette();

  window.D.lastActive = new Date().toISOString();
  save();
}


// RÔLE : Spawn rétrospecif des crottes accumulées pendant l'inactivité.
// POURQUOI : Évite d'afficher 5+ crottes dès le réveil (nuit = ~9h sans tick).
//            On soustrait les heures de sommeil (22h–7h) du delta, car le Gotchi
//            ne produit pas de crottes en dormant — il est au repos.
//            On plafonne aussi à 2 crottes max au bootstrap pour étaler l'apparition
//            dans la journée via l'interval normal (POOP_CHECK_INTERVAL_MS).
function catchUpPoops() {
  const last = window.D.g.lastTick || 0;
  if (!last) return;

  // Calcule la durée d'inactivité réelle en minutes
  const now = Date.now();
  const totalMin = (now - last) / 60000;
  if (totalMin < 10) return;

  // Déduit les heures de sommeil : si l'inactivité couvre la nuit (22h–7h = 9h = 540 min),
  // on retire ces 540 min du delta — le Gotchi ne produit rien en dormant.
  const lastDate   = new Date(last);
  const nowDate    = new Date(now);
  const lastH      = lastDate.getHours() + lastDate.getMinutes() / 60;
  const nowH       = nowDate.getHours() + nowDate.getMinutes() / 60;
  const SLEEP_H    = 9; // 22h → 7h = 9h de sommeil

  // Estimation simple : si on a dormi entre les deux timestamps, on retire SLEEP_H heures
  const crossedNight = (lastH > 22 || lastH < 7) // était déjà la nuit
                     || (lastH >= 7 && nowH < 7)  // a traversé une nuit complète
                     || (totalMin > 12 * 60);     // plus de 12h = forcément une nuit dedans
  const sleepMin   = crossedNight ? SLEEP_H * 60 : 0;
  const activeMin  = Math.max(0, Math.min(totalMin - sleepMin, 240)); // plafond 4h actives

  if (activeMin < 10) return;

  // 1 crotte par 50 min actives, mais max 2 au bootstrap — le reste viendra via l'interval
  const nb = Math.min(Math.floor(activeMin / 50), 2);
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

  // 3. Spawn caca si 10 min écoulées — seulement si catchUpPoops n'a pas déjà spawné
  // POURQUOI : catchUpPoops() met à jour lastPoopSpawn via spawnPoop() → si elle a spawné,
  //            lastSpawn sera récent et cette garde ne se déclenche pas. Évite le double spawn.
  const lastSpawn = window.D.g.lastPoopSpawn || 0;
  const hNow = hr();
  const isSleepTime = hNow >= 22 || hNow < 7;
  if (!isSleepTime && Date.now() - lastSpawn > POOP_SPAWN_DELAY_MS) {
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

/* ============================================================
   CONFIGURATION UTILISATEUR
   ============================================================ */
// RÔLE : Charge le fichier data/user_config.json et l'expose sur window.USER_CONFIG.
// POURQUOI : Permet de personnaliser l'app (nom, météo, anniversaire...)
//            sans modifier le code. Chaque utilisatrice a son propre fichier.
async function loadUserConfig() {
  try {
    const r = await fetch('data/user_config.json');
    if (r.ok) window.USER_CONFIG = await r.json();
  } catch(e) {
    // Si le fichier est absent ou illisible → on continue sans config perso.
    window.USER_CONFIG = null;
  }
}

async function bootstrap() {
  if (_appInitialized) {
    // Déjà init → on fait juste le refresh (retour foreground)
    initApp();
    return;
  }

  await loadUserConfig(); // Charge la config perso avant tout le reste
  loadDataFiles().then(() => {
    initBaseProps();
    // RÔLE : Force le surnom et le nom depuis user_config.json à chaque démarrage.
    // POURQUOI : defs() ne s'applique qu'au premier lancement.
    //            Sans ça, les utilisatrices existantes garderaient l'ancienne valeur vide.
    if (window.USER_CONFIG?.identity && window.D?.g) {
      if (window.USER_CONFIG.identity.userNickname) window.D.g.userNickname = window.USER_CONFIG.identity.userNickname;
      if (window.USER_CONFIG.identity.userName)     window.D.g.userName     = window.USER_CONFIG.identity.userName;
      // RÔLE : N'applique gotchiName que si l'utilisatrice n'a pas encore personnalisé le nom
      // POURQUOI : évite d'écraser le nom choisi dans le wizard à chaque mise à jour
      if (window.USER_CONFIG.identity.gotchiName && window.D.g.name === 'Petit·e Gotchi') window.D.g.name = window.USER_CONFIG.identity.gotchiName;
      save();
    }
    if (typeof updBadgeBoutique === 'function') updBadgeBoutique();
    // RÔLE : Met à jour la saleté du Gotchi selon le temps écoulé depuis la dernière session.
    // POURQUOI : La saleté augmente passivement (+1 par 6h d'absence) — on calcule le rattrapage ici.
    if (typeof window.checkSalete === 'function') window.checkSalete();

    // RÔLE : Calcule la faim accumulée depuis la dernière session.
    // POURQUOI : Symétrique à checkSalete() — vérifie les fenêtres repas manquées
    //            et déclenche la bulle "j'ai faim" si hunger >= 2.
    if (typeof window.checkHunger === 'function') window.checkHunger();

    catchUpPoops();

    // ── Pénalité habitudes manquées ──────────────────────────────────────────
    // RÔLE : Au chargement, vérifie si des habitudes n'ont pas été cochées hier.
    //        Si oui, applique une pénalité XP légère et affiche une bulle douce.
    // POURQUOI : Donne une rétro-action visible sans toucher happiness ni energy
    //            (ces deux variables sont auto-reportées par l'utilisatrice uniquement).
    // QUAND : Une seule fois par jour (lastMissedPenalty = date d'hier en AAAA-MM-JJ).
    (function checkMissedHabits() {
      if (!window.D || !window.D.habits || !window.D.habits.length) return;

      // Calcule la date d'hier en AAAA-MM-JJ (même format que today())
      const hier = new Date();
      hier.setDate(hier.getDate() - 1);
      const hierStr = hier.toISOString().slice(0, 10);

      // Guard : ne déclenche qu'une seule fois par jour manqué
      if (window.D.lastMissedPenalty === hierStr) return;

      // Habitudes cochées hier (peut être vide ou absent)
      const loggees = window.D.log[hierStr] || [];
      const toutes  = window.D.habits.map(h => h.catId);
      const manquees = toutes.filter(id => !loggees.includes(id));

      // Aucune habitude manquée → rien à faire
      if (manquees.length === 0) return;

      // Calcul de la pénalité : −5 XP par habitude manquée, plafonnée à −20
      const penalite = Math.min(manquees.length * 5, 20);

      // Application de la pénalité XP (peut rendre totalXp négatif → addXp le gère)
      addXp(-penalite);

      // Mémorise la date pour ne plus déclencher aujourd'hui
      window.D.lastMissedPenalty = hierStr;
      save();

      // Bulle gotchi — message adapté au ratio d'habitudes manquées
      // RÔLE : Distinguer "quelques habitudes manquées" (effort partiel reconnu)
      //        de "aucune habitude cochée" (journée sans) — sans culpabiliser dans les deux cas.
      // POURQUOI : Dire "tu n'as pas coché tes habitudes" quand on en a coché 4/6
      //            est inexact et démotivant. On reconnaît l'effort réel.
      const totalHabs   = toutes.length;
      const cochees     = totalHabs - manquees.length; // nb d'habitudes bien faites hier
      const ratio       = cochees / totalHabs;         // 0 = rien, 1 = toutes

      let pool;
      if (ratio === 0) {
        // Aucune habitude cochée hier
        pool = [
          "Hier tu n'étais pas là… c'est ok, ça arrive. Aujourd'hui est une nouvelle page 💜",
          "Pas d'habitudes hier ? Je t'attendais, sans jugement. On reprend ensemble 🌸",
          "Une journée sans habitudes, ça arrive. L'essentiel c'est que tu sois là ce matin 💜",
        ];
      } else if (ratio < 0.5) {
        // Moins de la moitié cochée (effort faible mais réel)
        pool = [
          `Hier tu en as fait ${cochees} sur ${totalHabs} — c'est déjà quelque chose 🌱 Aujourd'hui on continue ?`,
          `${cochees} habitude${cochees > 1 ? 's' : ''} hier, c'est pas rien. Les autres attendent aujourd'hui 💜`,
          `Tu as quand même pris soin de toi un peu hier (${cochees}/${totalHabs}). On repart de là 🌸`,
        ];
      } else {
        // La moitié ou plus cochée — effort significatif, manques mineurs
        pool = [
          `Tu en as fait ${cochees} sur ${totalHabs} hier — belle journée. Les ${manquees.length} restante${manquees.length > 1 ? 's' : ''} t'attendent 🌱`,
          `${cochees} sur ${totalHabs} hier, c'est solide. Juste ${manquees.length} petit${manquees.length > 1 ? 's' : ''} oubli${manquees.length > 1 ? 's' : ''} 💜`,
          `Tu t'es bien occupé·e de toi hier (${cochees}/${totalHabs}). On complète le tableau aujourd'hui ? 🌸`,
        ];
      }
      const msg = pool[Math.floor(Math.random() * pool.length)];

      // Légère temporisation pour laisser l'UI se monter avant d'afficher la bulle
      setTimeout(() => {
        flashBubble(msg, 4000);
        // Expression douce (pas de joie — état neutre/pensif)
        window.triggerExpr?.('neutre', 80);
      }, 1500);

      // Log dans l'historique des événements
      addEvent({
        type: 'habitude',
        subtype: 'manquee',
        valeur: -penalite,
        label: `${manquees.length} habitude${manquees.length > 1 ? 's' : ''} manquée${manquees.length > 1 ? 's' : ''} hier — −${penalite} XP`
      });
    })();
    // ── Fin pénalité habitudes manquées ─────────────────────────────────────

    // RÔLE : Guard de dernier recours — remet modalLocked à false au démarrage.
    // POURQUOI : Si une session soutien crashe avant que l'utilisatrice clique ✕,
    //            modalLocked reste true et toutes les modales restent verrouillées.
    //            bootstrap() est le seul point d'entrée garanti à chaque chargement.
    if (typeof modalLocked !== 'undefined') modalLocked = false;

    initApp();

    // RÔLE : Étirement matinal au premier chargement — si la session s'ouvre entre 7h et 11h.
    // POURQUOI : Auparavant déclenché dans p.draw() à h===7 précis (souvent manqué).
    //            Ici on détecte simplement "c'est le matin et ce n'est pas encore fait aujourd'hui".
    //            triggerEtirementMatin() gère son propre verrou (_etirementLastDay).
    {
      const hNow = hr();
      if (hNow >= 7 && hNow < 12) {
        // Délai suffisant pour que p5 soit initialisé et le Gotchi dessiné
        setTimeout(() => window.triggerEtirementMatin?.(), 1500);
      }
    }

    // RÔLE : Bâillement à l'ouverture — aléatoire, plus probable si énergie basse.
    // POURQUOI : Donne l'impression que le Gotchi "se réveille" quand on ouvre l'app,
    //            sans que ça soit systématique (sinon ça perd son naturel).
    //            Probabilité de base 15%, montée à 35% si energy ≤ 30.
    {
      const g = window.D?.g;
      if (g && g.stage !== 'egg') {
        const energieBasse = (g.energy ?? 100) <= 30;
        const proba = energieBasse ? 0.35 : 0.15;
        if (Math.random() < proba) {
          // Délai légèrement décalé par rapport à l'étirement pour ne pas se superposer
          setTimeout(() => {
            if (typeof window.triggerExpr === 'function') {
              window.triggerExpr('baillement', 18);
            }
          }, 2800);
        }
      }
    }

    // RÔLE : Lance le premier fetch météo + phases solaires, puis les intervals récurrents.
    // POURQUOI : Placé ici (derrière _appInitialized) pour garantir qu'on ne crée jamais
    //            deux séries de timers si bootstrap() est appelée plusieurs fois —
    //            clearInterval sur null est sans effet, donc le guard est sûr dans tous les cas.
    fetchMeteo();
    fetchSolarPhases();
    clearInterval(_meteoIntervalId);
    clearInterval(_poopIntervalId);
    _meteoIntervalId = setInterval(fetchMeteo, 1800000);            // météo toutes les 30 min
    _poopIntervalId  = setInterval(maybeSpawnPoop, POOP_CHECK_INTERVAL_MS); // check crottes

    // RÔLE : Supprime la barre de navigation clavier iOS (chevrons ‹ › + coche) sur iPhone.
    // POURQUOI : iOS affiche cette barre dès qu'il détecte plusieurs champs de formulaire
    //            dans le DOM. tabindex="-1" retire les champs de la séquence de focus iOS
    //            → la barre disparaît, sans empêcher le tap/focus normal sur le champ.
    //            Un MutationObserver est nécessaire car beaucoup d'inputs sont injectés
    //            dynamiquement (modales, soutien, journal…) après le chargement initial.
    //            Les input[type=range] et input[type=file] sont exclus (pas de clavier).
    function patchTabIndex(root) {
      root.querySelectorAll('input:not([type=range]):not([type=file]):not([type=checkbox]):not([type=radio]), textarea')
        .forEach(el => { if (el.tabIndex !== -1) el.tabIndex = -1; });
    }
    patchTabIndex(document.body); // champs déjà présents dans le DOM statique
    new MutationObserver(mutations => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) patchTabIndex(node); // éléments ajoutés dynamiquement
        }
      }
    }).observe(document.body, { childList: true, subtree: true });

    _appInitialized = true;
  });
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
  if (document.hidden) {
    // Arrière-plan : sauvegarde l'heure pour calculer les crottes en retard
    window.D.g.lastTick = Date.now(); save();
  } else if (document.visibilityState === 'visible' && _appInitialized) {
    // Retour au premier plan : relance l'app (filet Android)
    initApp();
  }
});