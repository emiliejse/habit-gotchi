/* ============================================================
   config.js — Toutes les constantes de personnalisation
   RÔLE : C'est le "Pot de Peinture" global de l'application. 
   Il centralise toutes les couleurs pour que tu n'aies jamais 
   à chercher des codes hexadécimaux éparpillés dans ton code.
   ============================================================ */

/* ─── SYSTÈME 5 : PERSONNALISATION (UI) ──────────────────────────── */

/**
 * UI_PALETTES : Les couleurs de l'interface utilisateur.
 * Quand une palette est choisie (via ui.js), l'app modifie dynamiquement
 * les variables CSS globales (--bg, --lilac, --mint, --pink).
 */
const UI_PALETTES = [
  { id:'lavande', label:'Lavande', bg:'#ddd6e8', lilac:'#b090d0', mint:'#80d0a8', pink:'#e8a0bf' },
  { id:'rose',    label:'Rose',    bg:'#f0dde8', lilac:'#d080a8', mint:'#a0d8b0', pink:'#e890c0' },
  { id:'ocean',   label:'Océan',   bg:'#d0e8f0', lilac:'#6090c0', mint:'#70d0c0', pink:'#a0c8e8' },
  { id:'foret',   label:'Forêt',   bg:'#d8e8d0', lilac:'#70a870', mint:'#90d890', pink:'#c8e0a0' },
  { id:'nuit',    label:'Nuit',    bg:'#2a2438', lilac:'#9070c0', mint:'#50c890', pink:'#c07090' },
  { id:'peche',   label:'Pêche',   bg:'#f0e0d0', lilac:'#c09070', mint:'#90d0a8', pink:'#e8b090' },
];

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

/* ─── SYSTÈME 2 : ÉCOSYSTÈME (Décors & Biomes) ───────────────────── */

/**
 * ENV_THEMES : Dictionnaire massif des environnements.
 * Utilisé par `envs.js` pour dessiner les décors (Parc, Chambre, Montagne).
 * Chaque thème doit impérativement posséder TOUTES ces clés pour que
 * le moteur de rendu ne plante pas ("Cannot read properties of undefined").
 */
const ENV_THEMES = [
  { id:'pastel', label:'Pastel ✿',
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

  { id:'automne', label:'Automne 🍂',
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

  { id:'hiver', label:'Hiver ❄️',
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

  { id:'desert', label:'Désert 🏜️',
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