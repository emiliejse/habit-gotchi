/* ============================================================
   config.js — Toutes les constantes de personnalisation
   RÔLE : C'est le "Pot de Peinture" global de l'application. 
   Il centralise toutes les couleurs pour que tu n'aies jamais 
   à chercher des codes hexadécimaux éparpillés dans ton code.
   ============================================================ */

// RÔLE : Fond de carte commun à toutes les palettes — identique partout.
// POURQUOI : Factorisé ici pour éviter 6 répétitions et faciliter un futur changement global.
const CARD_BG = 'rgba(255,255,255,.88)';

/* ─── SYSTÈME 5 : PERSONNALISATION (UI) ──────────────────────────── */

/**
 * UI_PALETTES : Les couleurs de l'interface utilisateur.
 * Quand une palette est choisie (via ui.js), l'app modifie dynamiquement
 * les variables CSS globales (--bg, --lilac, --mint, --pink).
 */
// RÔLE : Palettes de couleurs de l'interface — appliquées dynamiquement via applyUIPalette()
// POURQUOI text2 foncé : les valeurs précédentes échouaient WCAG AA sur --card (ratio < 4.5:1)
// Chaque text2 est la teinte d'origine assombrie d'environ 20–25% pour atteindre ratio ≥ 5:1
const UI_PALETTES = [
  { id:'lavande', label:'Lavande', bg:'#ddd6e8', lilac:'#b090d0', mint:'#80d0a8', pink:'#e8a0bf', text:'#38304a', text2:'#6e5e8c', card:CARD_BG, border:'#ccc4d8' }, // text2 : #887ea0 → #6e5e8c
  { id:'rose',    label:'Rose',    bg:'#f0dde8', lilac:'#d080a8', mint:'#a0d8b0', pink:'#e890c0', text:'#4a3040', text2:'#7a5060', card:CARD_BG, border:'#e0c8d0' }, // text2 : #a07888 → #7a5060
  { id:'ocean',   label:'Océan',   bg:'#d0e8f0', lilac:'#6090c0', mint:'#70d0c0', pink:'#a0c8e8', text:'#203848', text2:'#405868', card:CARD_BG, border:'#b0c8d8' }, // text2 : #607888 → #405868
  { id:'foret',   label:'Forêt',   bg:'#d8e8d0', lilac:'#70a870', mint:'#90d890', pink:'#c8e0a0', text:'#283820', text2:'#405838', card:CARD_BG, border:'#b0c8a0' }, // text2 : #607858 → #405838
  { id:'corail',  label:'Corail',  bg:'#f8ddd0', lilac:'#d06050', mint:'#70c0a8', pink:'#f0a080', text:'#3a1810', text2:'#704030', card:CARD_BG, border:'#e0b8a8' }, // text2 : #906858 → #704030
  { id:'peche',   label:'Pêche',   bg:'#f0e0d0', lilac:'#c09070', mint:'#90d0a8', pink:'#e8b090', text:'#483020', text2:'#705040', card:CARD_BG, border:'#d8c0a8' }, // text2 : #907060 → #705040
];

/* ─── VARIABLES PAPIER & TERMINAL (composants hors palette) ──────── */
// RÔLE : Centraliser les couleurs des composants "papier" (.j90, .menu-book)
// et "terminal" (#tablet-box) — ils n'obéissent pas aux palettes UI mais
// doivent quand même être modifiables depuis un seul endroit.
const PAPER_THEME = {
  bg:     '#e8e0d0',  // fond beige papier (.j90)
  border: '#c8b8a0',  // contour couture
  text:   '#6a5a40',  // texte encre
  line:   '#c8b8a0',  // tirets et séparateurs
  entry:  'rgba(255,255,255,.5)', // fond entrée journal
  entryTs:'#a09880',  // timestamp (secondaire)
  entryBtn:'#f0e8d8', // fond bouton action journal

  bookBg:    '#f4edd8',  // fond carton menu-book
  bookBorder:'#c8b898',  // contour menu-book
  bookShadow:'#b8a888',  // ombre portée menu-book
  bookLine:  '#d4c4a8',  // reliure (::before)
};

const TERMINAL_THEME = {
  box:    '#1a1a1a',  // fond boîte tablette
  border: '#444',     // contour
  screen: '#0a0a0a',  // fond écran intérieur
  screenBorder: '#333',
  text:   '#00ff41',  // vert phosphore
  textDim:'#007a1f',  // timestamp (secondaire)
  lineDiv:'#0f2a0f',  // séparateur ligne
};

/* ─── SYSTÈME 5 : PERSONNALISATION (Sprite) ──────────────────────── */

/**
 * GOTCHI_COLORS : La "peau" du Gotchi.
 * Utilisé par `render.js` pour colorier la matrice de pixels du personnage.
 * Nécessite 3 tons pour donner du volume : base (body), lumière (bodyLt), ombre (bodyDk).
 */
const GOTCHI_COLORS = [
  { id:'vert',   label:'Vert',   body:'#c8d8c0', bodyLt:'#e0ece0', bodyDk:'#a0b898' },
  { id:'lilas',  label:'Lilas',  body:'#d0c0e0', bodyLt:'#e8e0f0', bodyDk:'#a898c0' },
  { id:'peche',  label:'Pêche',  body:'#e8d0b8', bodyLt:'#f0e4d0', bodyDk:'#c0a888' },
  { id:'bleu',   label:'Bleu',   body:'#b8d0e8', bodyLt:'#d0e4f4', bodyDk:'#90a8c8' },
  { id:'rose',   label:'Rose',   body:'#e8c0d0', bodyLt:'#f4d8e4', bodyDk:'#c098a8' },
  { id:'jaune',  label:'Jaune',  body:'#e8e0a8', bodyLt:'#f4ecc8', bodyDk:'#c0b878' },
];

/* ─── SYSTÈME 5 : PERSONNALISATION (Style du haut de la tête) ────── */

// RÔLE : Styles disponibles pour le haut de la tête du Gotchi (oreilles, antennes, ailes).
// POURQUOI : Centralisé ici comme les autres palettes — ajout d'un style = une entrée.
//            Applicable uniquement aux stades teen et adult (baby n'a pas d'oreilles).
//            La valeur 'id' est lue dans render-sprites.js via D.g.headStyle.
const HEAD_STYLES = [
  { id: 'lapin',       label: 'Lapin',        icon: '🐰' },
  { id: 'ourson',      label: 'Ourson',        icon: '🐻' },
  { id: 'chat',        label: 'Chat',          icon: '🐱' },
  { id: 'insecte',     label: 'Insecte',       icon: '🐛' },
  { id: 'chauve-souris', label: 'Chauve-souris', icon: '🦇' },
];

/* ─── SYSTÈME 5 : PERSONNALISATION (Couleur des extrémités) ─────── */

// RÔLE : Couleurs disponibles pour les bras et pieds du Gotchi (C.limb dans le DSL sprites).
// POURQUOI : Couleur plate indépendante du corps — 8 teintes douces couvrant chaud/froid/neutre.
//            Par défaut 'auto' = fallback sur C.bodyDk (comportement original pré-feature).
const LIMB_COLORS = [
  { id:'auto',   label:'Auto',   hex:null       },  // défaut — suit la couleur du corps (bodyDk)
  { id:'brun',   label:'Brun',   hex:'#b07848' },
  { id:'corail', label:'Corail', hex:'#d07060' },
  { id:'olive',  label:'Olive',  hex:'#7a9848' },
  { id:'nuit',   label:'Nuit',   hex:'#3a4870' },
  { id:'ciel',   label:'Ciel',   hex:'#60a0c8' },
  { id:'lilas',  label:'Lilas',  hex:'#9070c0' },
  { id:'noir',   label:'Noir',   hex:'#3a3048' },
];

/* ─── SYSTÈME 5 : PERSONNALISATION (Reflets des yeux) ────────────── */

// RÔLE : Couleurs disponibles pour les reflets/pupilles du Gotchi (petits points lumineux dans les yeux).
// POURQUOI : Centralisé ici comme les autres palettes — ajout d'une option = une ligne.
//            La valeur 'hex' est utilisée directement dans render-sprites.js via D.g.pupilColor.
const PUPIL_COLORS = [
  { id:'blanc',   label:'Blanc',   hex:'#ffffff' },
  { id:'creme',   label:'Crème',   hex:'#fff3d6' },
  { id:'rose',    label:'Rose',    hex:'#ffb3d1' },
  { id:'lilas',   label:'Lilas',   hex:'#d4b8f0' },
  { id:'bleu',    label:'Bleu',    hex:'#b8d8ff' },
  { id:'menthe',  label:'Menthe',  hex:'#b8f0d8' },
  { id:'peche',   label:'Pêche',   hex:'#ffd4b8' },
  { id:'dore',    label:'Doré',    hex:'#ffd97a' },
];

/* ─── SYSTÈME 5 : PERSONNALISATION (Couleur des yeux) ────────────── */

// RÔLE : Couleurs disponibles pour l'iris du Gotchi (le remplissage principal des yeux).
// POURQUOI : C.eye est mis à jour à chaque frame dans render.js via D.g.eyeColor —
//            même pattern que C.body. Teintes allant du sombre au pastel doux.
const EYE_COLORS = [
  { id:'noir',    label:'Noir',    hex:'#38304a' },
  { id:'brun',    label:'Brun',    hex:'#6b4226' },
  { id:'marine',  label:'Marine',  hex:'#2a4a6b' },
  { id:'vert',    label:'Vert',    hex:'#2d5a3d' },
  { id:'violet',  label:'Violet',  hex:'#5a3878' },
  { id:'rose',    label:'Rose',    hex:'#c05878' },
  { id:'bleu',    label:'Bleu',    hex:'#5890c8' },
  { id:'menthe',  label:'Menthe',  hex:'#4aaa80' },
];

/* ─── SYSTÈME 5 : PERSONNALISATION (Couleur des joues) ───────────── */

// RÔLE : Couleurs disponibles pour les joues du Gotchi (C.cheek dans le DSL sprites).
// POURQUOI : C.cheek est mis à jour à chaque frame dans render.js via D.g.cheekColor —
//            même pattern que C.eye et C.mouth. Teintes douces centrées sur le rose/pêche/naturel.
const CHEEK_COLORS = [
  { id:'rose',   label:'Rose',   hex:'#f0a0b0' },  // défaut — valeur initiale de C.cheek
  { id:'peche',  label:'Pêche',  hex:'#f0b898' },
  { id:'corail', label:'Corail', hex:'#f09080' },
  { id:'lilas',  label:'Lilas',  hex:'#c8a8e0' },
  { id:'bleu',   label:'Bleu',   hex:'#a8c8f0' },
  { id:'menthe', label:'Menthe', hex:'#98dcc0' },
  { id:'dore',   label:'Doré',   hex:'#f0d080' },
  { id:'nude',   label:'Nude',   hex:'#d4aa90' },
];

/* ─── SYSTÈME 5 : PERSONNALISATION (Couleur de la bouche) ────────── */

// RÔLE : Couleurs disponibles pour la bouche du Gotchi (C.mouth dans le DSL sprites).
// POURQUOI : C.mouth est mis à jour à chaque frame dans render.js via D.g.mouthColor —
//            même pattern que C.eye. Teintes allant du sombre au rose vif.
const MOUTH_COLORS = [
  { id:'noir',    label:'Noir',    hex:'#38304a' },
  { id:'brun',    label:'Brun',    hex:'#6b4226' },
  { id:'rose',    label:'Rose',    hex:'#e0608a' },
  { id:'corail',  label:'Corail',  hex:'#e07858' },
  { id:'rouge',   label:'Rouge',   hex:'#c03848' },
  { id:'lilas',   label:'Lilas',   hex:'#9870c0' },
  { id:'peche',   label:'Pêche',   hex:'#e0a880' },
  { id:'fuchsia', label:'Fuchsia', hex:'#d040a0' },
];

/* ─── SYSTÈME 2 : ÉCOSYSTÈME (Décors & Biomes) ───────────────────── */

/**
 * ENV_THEMES : Dictionnaire massif des environnements.
 * Utilisé par `envs.js` pour dessiner les décors (Parc, Chambre, Montagne).
 * Chaque thème doit impérativement posséder TOUTES ces clés pour que
 * le moteur de rendu ne plante pas ("Cannot read properties of undefined").
 */
const ENV_THEMES = [
  { id:'pastel', label:'Pastel', icon:'🌸',
    // parc
    sky1:'#b8d4f0', sky2:'#d8e8f8',
    gnd:'#a8d898',  gndDk:'#90c480',
    leaf1:'#78c488', leaf2:'#90d870', trunk:'#b09068',
    accent:'#e878a8',
    // chambre
    wall:'#e0d8c8',
    windowFrame:'#c8baa8', windowSill:'#d8c8b8',
    curtain:'#c8a8d8', curtainDk:'#a888c0', curtainRod:'#b8a090',
    baseboard:'#d0c0b0',
    frameOuter:'#c8a880', frameBg:'#f0ece4', frameAccent1:'#c8a8d0', frameAccent2:'#a8c8d0',
    floor:'#c8b8a8', floorLine:'#b8a898',
    rug:'#d8c0f0', rugCenter:'#c8aee8',
    desk:'#b89870', deskTop:'#c8a880', deskShadow:'#a88860',
    lamp:'#f0e898', lampShade:'#f8d858',
    // montagne
    mntGnd:'#88b870', mntGndDk:'#6a9858', mntPeak:'#a0c888', mntSnow:'#e8f0e0',
  },

  { id:'automne', label:'Automne', icon:'🍂',
    sky1:'#e8c068', sky2:'#f0d898',
    gnd:'#c89858',  gndDk:'#a87838',
    leaf1:'#c04818', leaf2:'#e06028', trunk:'#8b4513',
    accent:'#e07828',
    wall:'#c0956a',
    windowFrame:'#a07848', windowSill:'#b08858',
    curtain:'#c86828', curtainDk:'#a05020', curtainRod:'#906040',
    baseboard:'#a07848',
    frameOuter:'#a07848', frameBg:'#f0e8d8', frameAccent1:'#e08830', frameAccent2:'#d07020',
    floor:'#a07848', floorLine:'#886030',
    rug:'#7a3020', rugCenter:'#9a4830',
    desk:'#906040', deskTop:'#d8b880', deskShadow:'#a07040',
    lamp:'#f4e090', lampShade:'#e8c050',
    mntGnd:'#b07840', mntGndDk:'#906028', mntPeak:'#c09050', mntSnow:'#e8c878',
  },

  { id:'hiver', label:'Hiver', icon:'❄️',
    sky1:'#c8d8e8', sky2:'#e8f0f8',
    gnd:'#e8f0f8',  gndDk:'#c8d8e8',
    leaf1:'#e8f0f8', leaf2:'#d8e8f0', trunk:'#806050',
    accent:'#e0eef8',
    wall:'#c8d8e8',
    windowFrame:'#8899aa', windowSill:'#e8f4ff',
    curtain:'#c8d8f0', curtainDk:'#a0b8d8', curtainRod:'#8090a8',
    baseboard:'#a0b8cc',
    frameOuter:'#8899aa', frameBg:'#eef4ff', frameAccent1:'#a8c0d8', frameAccent2:'#a8c0d8',
    floor:'#d0dce8', floorLine:'#b0bcc8',
    rug:'#2c4870', rugCenter:'#3a5888',
    desk:'#8090a0', deskTop:'#a8b8c8', deskShadow:'#8898a8',
    lamp:'#fffde8', lampShade:'#f4e8a0',
    mntGnd:'#c8d8e8', mntGndDk:'#a8b8c8', mntPeak:'#d8e0e8', mntSnow:'#f0f8ff',
  },

  { id:'desert', label:'Désert', icon:'🏜️',
    sky1:'#f0c878', sky2:'#f8e0a8',
    gnd:'#e8d098',  gndDk:'#c8a858',
    leaf1:'#70a858', leaf2:'#508840', trunk:'#c8a858',
    accent:'#c0a050',
    wall:'#d8b888',
    windowFrame:'#b08c60', windowSill:'#c8a070',
    curtain:'#e0c888', curtainDk:'#c0a860', curtainRod:'#a88848',
    baseboard:'#b89060',
    frameOuter:'#b08c60', frameBg:'#fdf0d0', frameAccent1:'#e8a020', frameAccent2:'#f0c030',
    floor:'#c0a060', floorLine:'#a07840',
    rug:'#8a3820', rugCenter:'#a84830',
    desk:'#a07840', deskTop:'#c8a060', deskShadow:'#a88040',
    lamp:'#f8e060', lampShade:'#f0c820',
    mntGnd:'#d8a848', mntGndDk:'#b88028', mntPeak:'#e8c870', mntSnow:'#f0d890',
  },
];

/* ─── SYSTÈME 1 : MÉTABOLISME (Repas) ────────────────────────────── */

/**
 * MEAL_WINDOWS : Les 3 fenêtres horaires pour nourrir le Gotchi.
 * Le Gotchi peut être nourri une fois par fenêtre par jour.
 * `start` inclus, `end` exclu (ex: matin = 7h, 8h, 9h, 10h).
 */
const MEAL_WINDOWS = {
  matin:  { start: 7,  end: 11, label: 'Matin',   icon: '🌅' },
  midi:   { start: 11, end: 15, label: 'Midi',    icon: '☀️' },
  gouter: { start: 15, end: 17, label: 'Goûter',  icon: '🍪', bonus: true }, // fenêtre bonus +1 🌸 uniquement
  soir:   { start: 18, end: 22, label: 'Soir',    icon: '🌙' },
};

/**
 * SNACKS_POOL : Pool d'emojis food utilisés pour les repas.
 * Volontairement filtré : pas d'alcool (🍷🍺🥃🍸🍹🥂🍶), pas de tabac.
 * Le Gotchi pioche 3 emojis aléatoires à chaque ouverture du repas.
 * Un de ces emojis est le "préféré de la semaine" → +2 bonus.
 */
const SNACKS_POOL = [
  // Fruits
  '🍇','🍈','🍉','🍊','🍋','🍌','🍍','🥭','🍎','🍏','🍐','🍑','🍒','🍓','🫐','🥝',
  // Légumes
  '🍅','🫒','🥥','🥑','🍆','🥔','🥕','🌽','🌶️','🫑','🥒','🥬','🥦','🧄','🧅',
  // Préparé / pains / céréales
  '🍄','🥜','🫘','🌰','🍞','🥐','🥖','🫓','🥨','🥯','🥞','🧇','🧀',
  // Plats salés
  '🍖','🍗','🥩','🥓','🍔','🍟','🍕','🌭','🥪','🌮','🌯','🫔','🥙','🧆','🥚',
  '🍳','🥘','🍲','🫕','🥣','🥗','🍿','🧈','🧂','🥫',
  // Asiatique
  '🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮','🍡',
  '🥟','🥠','🥡',
  // Desserts / sucré
  '🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍮','🍯',
  // Boissons (sans alcool)
  '🍼','🥛','☕','🫖','🍵','🧃','🥤','🧋','🧉','🥢',
];

// Modèle Claude utilisé pour tous les appels IA — changer ici suffit pour tout mettre à jour
const AI_MODEL = 'claude-sonnet-4-5';

/* ─── SYSTÈME 1 : CONSTANTES GAMEPLAY ────────────────────────────── */
// RÔLE : Centralise toutes les valeurs numériques métier.
// POURQUOI : Évite les "magic numbers" éparpillés dans app.js et ui.js —
//            un seul endroit à modifier si on rééquilibre le jeu.

// XP
const XP_HABITUDE   = 15;   // XP gagné en cochant une habitude (aussi = pénalité absence / jour)
const XP_NOTE       = 15;   // XP gagné en écrivant une note journal
const XP_MAX        = 4000; // XP du dernier seuil adulte (Déesse) — nxtTh() retourne cette valeur une fois tous les paliers dépassés, affiche "MAX ✿"
const PETALES_SNACK = 2;    // Pétales bonus accordés pour tout snack mangé

// Crottes
const POOP_MIN_DELAY_MS      = 8  * 60 * 1000; // 8 min minimum entre deux spawns de crotte
const POOP_SPAWN_DELAY_MS    = 10 * 60 * 1000; // délai avant apparition d'une crotte
const POOP_CHECK_INTERVAL_MS = 30 * 60 * 1000; // intervalle de vérification périodique

/* ─── SYSTÈME 2 : SEUILS VISUELS (échelle 0–5) ───────────────────── */
// RÔLE : Seuils d'énergie et de bonheur qui déclenchent les changements
//        d'apparence du Gotchi (bras, bouche, dithering, animation, météo).
// ⚠️ Ces valeurs s'appliquent directement sur g.energy / g.happiness (0–5).
//    render.js ne fait PLUS de ×20 — raisonner toujours en "jauge visible".

// Énergie (valeurs entières — la jauge va de 0 à 5)
const EN_CRIT = 1; // dithering corps (épuisement total) — tous stades
const EN_WARN = 2; // bras tombés — tous stades (unifié)
const EN_TILT = 2; // balancement + vitesse d'animation minimale

// Bonheur (valeurs entières — la jauge va de 0 à 5)
const HA_SAD        = 1; // bouche triste — tous stades (unifié)
const HA_MED        = 2; // nuages + pluie + seuil ciel gris
const HA_MED_ADULT  = 3; // sourire neutre adulte
const HA_SLOW       = 3; // vitesse marche lente
const HA_WALK       = 3; // animation marche normale
const HA_HIGH       = 4; // grand sourire bébé + animation vive + soleil
const HA_HAPPY_TEEN = 4; // grand sourire ado
const HA_ARMS_UP    = 4; // bras levés adulte (joie intense)

// Durée par défaut d'un cycle menstruel en jours — utilisée si aucun historique de règles
// ne permet de calculer une durée personnalisée.
const CYCLE_DEFAULT_DURATION = 28;

// RÔLE : Expose toutes les constantes sous un namespace global unique.
// POURQUOI : Évite la pollution de window et les collisions de noms
//            si un autre script déclare les mêmes identifiants.
//            Les constantes gameplay (XP, EN, HA, POOP…) sont regroupées
//            dans le sous-objet HG_CONFIG.GAMEPLAY pour les distinguer
//            des constantes visuelles/UI sans créer un second namespace.
/* ─── PACKS THÉMATIQUES BOUTIQUE (S7) ───────────────────────────── */
// RÔLE : Packs d'objets EXCLUSIFS vendus uniquement en pack — absents du catalogue normal.
// POURQUOI : Les objets de pack vivent dans data/props_packs.json (cout:0, champ pack:"id_pack").
//            Le catalogue boutique filtre sur cout>0, ce qui les exclut naturellement.
//            Ils ne peuvent être obtenus qu'ici via acheterPack().
//            Chaque pack = 5 objets pixel art dédiés au thème, prix unique 20 🌸.
// RÈGLE : propIds doivent tous exister dans data/props_packs.json pour rester exclusifs.
const SHOP_PACKS = [
  {
    id: 'pack_printemps',
    label: 'Pack Printemps',
    emoji: '🌸',
    description: 'Branche de Cerisier • Petite Coccinelle • Couronne de Fleurs • Pluie de Printemps • Petit Nid Douillet',
    propIds: [
      'pack_printemps_cerisier',
      'pack_printemps_coccinelle',
      'pack_printemps_couronne_fleurs',
      'pack_printemps_pluie_douce',
      'pack_printemps_nid',
    ],
    cout: 20,
  },
];

window.HG_CONFIG = {
  // ── UI & thèmes ────────────────────────────────────────────────
  UI_PALETTES,
  GOTCHI_COLORS,
  PUPIL_COLORS,
  EYE_COLORS,
  LIMB_COLORS,
  CHEEK_COLORS,
  MOUTH_COLORS,
  HEAD_STYLES,
  ENV_THEMES,
  MEAL_WINDOWS,
  SNACKS_POOL,
  SHOP_PACKS,

  // ── Gameplay : toutes les valeurs numériques métier ────────────
  GAMEPLAY: {
    // Modèle IA
    AI_MODEL,

    // XP
    XP_HABITUDE,
    XP_NOTE,
    XP_MAX,
    PETALES_SNACK,

    // Cycle menstruel
    CYCLE_DEFAULT_DURATION,

    // Crottes
    POOP_MIN_DELAY_MS,
    POOP_SPAWN_DELAY_MS,
    POOP_CHECK_INTERVAL_MS,

    // Seuils énergie
    EN_CRIT,
    EN_WARN,
    EN_TILT,

    // Seuils bonheur
    HA_SAD,
    HA_MED,
    HA_MED_ADULT,
    HA_SLOW,
    HA_WALK,
    HA_HIGH,
    HA_HAPPY_TEEN,
    HA_ARMS_UP,
  },
};