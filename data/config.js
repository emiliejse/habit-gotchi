// data/config.js — Toutes les constantes de personnalisation

const UI_PALETTES = [
  { id:'lavande', label:'Lavande', bg:'#ddd6e8', lilac:'#b090d0', mint:'#80d0a8', pink:'#e8a0bf' },
  { id:'rose',    label:'Rose',    bg:'#f0dde8', lilac:'#d080a8', mint:'#a0d8b0', pink:'#e890c0' },
  { id:'ocean',   label:'Océan',   bg:'#d0e8f0', lilac:'#6090c0', mint:'#70d0c0', pink:'#a0c8e8' },
  { id:'foret',   label:'Forêt',   bg:'#d8e8d0', lilac:'#70a870', mint:'#90d890', pink:'#c8e0a0' },
  { id:'nuit',    label:'Nuit',    bg:'#2a2438', lilac:'#9070c0', mint:'#50c890', pink:'#c07090' },
  { id:'peche',   label:'Pêche',   bg:'#f0e0d0', lilac:'#c09070', mint:'#90d0a8', pink:'#e8b090' },
];

const GOTCHI_COLORS = [
  { id:'vert',   label:'Vert',   body:'#c8d8c0', bodyLt:'#e0ece0', bodyDk:'#a0b898' },
  { id:'lilas',  label:'Lilas',  body:'#d0c0e0', bodyLt:'#e8e0f0', bodyDk:'#a898c0' },
  { id:'peche',  label:'Pêche',  body:'#e8d0b8', bodyLt:'#f0e4d0', bodyDk:'#c0a888' },
  { id:'bleu',   label:'Bleu',   body:'#b8d0e8', bodyLt:'#d0e4f4', bodyDk:'#90a8c8' },
  { id:'rose',   label:'Rose',   body:'#e8c0d0', bodyLt:'#f4d8e4', bodyDk:'#c098a8' },
  { id:'jaune',  label:'Jaune',  body:'#e8e0a8', bodyLt:'#f4ecc8', bodyDk:'#c0b878' },
];

const ENV_THEMES = [
  { id:'pastel',  label:'Pastel ✿',
    sky1:'#b8d4f0', sky2:'#d8e8f8',
    gnd:'#a8d898',  gndDk:'#90c480',
    leaf1:'#78c488', leaf2:'#90d870', trunk:'#b09068',
    accent:'#e898b8' },

  { id:'automne', label:'Automne 🍂',
    sky1:'#e8c068', sky2:'#f0d898',
    gnd:'#c89858',  gndDk:'#a87838',
    leaf1:'#c04818', leaf2:'#e06028', trunk:'#8b4513',
    accent:'#e07828' },

  { id:'hiver',   label:'Hiver ❄️',
    sky1:'#c8d8e8', sky2:'#e8f0f8',
    gnd:'#e8f0f8',  gndDk:'#c8d8e8',
    leaf1:'#e8f0f8', leaf2:'#d8e8f0', trunk:'#806050',
    accent:'#e0eef8' },

  { id:'desert',  label:'Désert 🏜️',
    sky1:'#f0c878', sky2:'#f8e0a8',
    gnd:'#e8d098',  gndDk:'#c8a858',
    leaf1:'#70a858', leaf2:'#508840', trunk:'#c8a858',
    accent:'#c0a050' },
];