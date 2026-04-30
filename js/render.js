/* ============================================================
   render.js — Moteur p5.js : dessin pixel art, animations, Gotchi

   RÔLE : Ce fichier est le "pinceau". Il ne contient PAS de logique
   métier (XP, stats) — il se contente de LIRE window.D et de dessiner.

   DÉPENDANCES (doivent être chargées AVANT dans index.html) :
     - config.js  → GOTCHI_COLORS, ENV_THEMES, EN_xx/HA_xx (seuils visuels)
     - app.js     → window.D (données), window.PROPS_LIB, hr(),
                    window.meteoData, window.shakeTimer, window.celebQueue
     - envs.js    → drawActiveEnv() (chargé APRÈS render.js)

   NAVIGATION RAPIDE (Ctrl+G dans VS Code → numéro de ligne) :
   §1  ~14    GLOBALS & ÉTATS    C, PX, walkX, _expr, _adultPose, triggerExpr
   §2  ~68    HELPERS VISUELS    getBreath(), getCheekPulse(), getGotchiC()
   §3  ~96    PROPS & SLOTS      PROP_SLOTS, getPropDef(), drawProp()
   §4  ~128   PARTICULES         spawnP(), updateParts()
   §5  ~139   ÉCOSYSTÈME         drawSky(), drawCl(), drawZzz(), drawDither()
   §6  ~263   SPRITES GOTCHI     drawEgg(), drawBaby(), drawTeen(), drawAdult()
   §7  ~717   INTERACTIONS       triggerTouchReaction()
   §8  ~740   BOUCLE p5.js       p5s() — setup, draw, events tactiles
   §9  ~1094  OVERLAY & TOUCHES  isOverlayActive(), gestion touch/click canvas
   ============================================================ */

/* ─── SYSTÈME 7 : INGÉNIERIE (CONFIGURATIONS & GLOBALES) ────────── */

const C = {
  body:'#d8b8e8', bodyDk:'#c0a0d0', bodyLt:'#ecd8f8',
  eye:'#38304a', cheek:'#f0a0b0', mouth:'#38304a',
  egg:'#f4e6d0', eggSp:'#e4d2b8', eggCr:'#d4bfa0',
  skyD1:'#b8d4f0', skyD2:'#d8e8f0', skyK1:'#d0a8c0', skyK2:'#f0d0c0',
  skyN1:'#28203c', skyN2:'#3c3058', skyA1:'#d8c0d0', skyA2:'#f0e4d0',
  skyGray1:'#a0a0a8', skyGray2:'#c0c0c8',
  gnd:'#a8d498', gndDk:'#90c480', gndN:'#3c6030',
  cloud:'#ece8f4', trunk:'#b09068', leaf:'#78c488', leafN:'#406848',
  wallIn:'#e0d8c8', floorIn:'#c8b8a8', rug:'#b898d4',
  mnt1:'#a0a8b8', mnt2:'#808898', snow:'#e8e8f0',
  water:'#88c0d8', star:'#f0e498', flPk:'#e898b8', flYl:'#f0d878',
  rainbow:['#e8a0a0','#e8c8a0','#e8e0a0','#a0d8a0','#a0b8e0','#c0a0d8'],
};

const PX = 5, CS = 200;
const GOTCHI_OFFSET_Y = 20;
let bounceT = 0, blinkT = 0, blink = false;
window._bounceT = 0;
window.particles = [];
window.touchReactions = []; 
window.eatAnim = { active: false, timer: 0, emoji: '' };
let walkX = 100;      
let walkDir = 1;        
let walkStep = 0; 
let walkTarget = 100;   // destination en X
let walkPause  = 0;     // frames d'attente avant le prochain déplacement  
window.triggerGotchiBounce = function() { window._jumpTimer = 20; };
window.triggerGotchiShake  = function() { window.shakeTimer = 12; }; 
window.spawnP = spawnP;
window._nextBlinkAt = 60;
window._blinkDuration = 4;
// Animation d'évolution (chrysalide)
window._evoAnim = { active: false, timer: 0, fromStage: '', toStage: '' };
window.triggerEvoAnim = function(from, to) {
  window._evoAnim = { active: true, timer: 45, fromStage: from, toStage: to };
};

// ─── Sélecteur d'environnement canvas ───
// RÔLE : Permet de changer d'environnement directement depuis l'écran Gotchi,
//        sans passer par l'inventaire. Dessiné dans p.draw(), géré dans touchStarted.
// POURQUOI : Accès rapide et intuitif, cohérent avec le style pixel art du canvas.
window._envSelectorOpen  = false;  // true = les 2 cercles flottants sont visibles
window._envFadeState     = null;   // { from:'parc', to:'chambre', frames:0 } pendant le fondu
window._envSelectorHits  = [];     // zones de tap calculées à chaque frame (tableau d'objets {env,cx,cy,r})

// Variations de bras de l'adulte (animations idle)
window._adultPose = {
  current: 'normal',     // 'normal' | 'hanche_g' (étape A) | (à enrichir étape B)
  timer: 0,              // frames restantes dans la pose actuelle
  cooldown: 240          // frames avant la prochaine variation (240 frames = 20 sec à 12 fps)
};
// ─── Animation : variables d'expressivité ───
window._expr = {
  lastMood: null,      // 'faim', 'surprise', 'joie', null
  moodTimer: 0,        // frames restantes de la réaction
  breathPhase: 0
};

// Helper : calcule la phase de respiration (0 → 1 → 0 → 1…)
function getBreath(p, speed = 0.025) {
  return (Math.sin(p.frameCount * speed) + 1) / 2; // 0 à 1
}

// Helper : pulsation joues (décalée pour pas synchro avec respiration)
function getCheekPulse(p) {
  return (Math.sin(p.frameCount * 0.04 + Math.PI/3) + 1) / 2;
}

// Déclenche une micro-réaction (à appeler depuis app.js ou render)
window.triggerExpr = function(mood, duration = 60) {
  window._expr.lastMood = mood;
  window._expr.moodTimer = duration;
};

/**
 * RÔLE : Retourne la position Y de base du Gotchi en fonction de son stade de développement.
 * POURQUOI : Ce ternaire était copié-collé 3 fois (draw, touchStarted, touchMoved) —
 *            une seule fonction évite les désynchronisations si les valeurs changent.
 */
function getStageBaseY(stage) {
  if (stage === 'egg')  return 115;
  if (stage === 'baby') return 108;
  if (stage === 'teen') return 98;
  return 85; // adult (valeur par défaut)
}

function getGotchiC() {
  const id = window.D.g.gotchiColor || 'vert';
  const gc = window.HG_CONFIG.GOTCHI_COLORS.find(x => x.id === id) || window.HG_CONFIG.GOTCHI_COLORS[0];
  return { body: gc.body, bodyLt: gc.bodyLt, bodyDk: gc.bodyDk };
}

function getEnvC() {
  const id = window.D.g.envTheme || 'pastel';
  const et = window.HG_CONFIG.ENV_THEMES.find(x => x.id === id) || window.HG_CONFIG.ENV_THEMES[0];
  return et;
}


/* ─── SYSTÈME 5 : INVENTAIRE & PERSONNALISATION ─────────────────── */

const PROP_SLOTS = {
  A:   { x: 38,  y: 108 },  // fond gauche
  B:   { x: 132, y: 108 },  // fond droit
  C:   { x: 28,  y: 140 },  // sol gauche
  D:   { x: 148, y: 140 },  // sol droit
  SOL: { x: 88,  y: 152 },  // sol centre
};

function getPropDef(id) {
  return (window.PROPS_LIB || []).find(l => l.id === id)
      || (window.D.propsPixels && window.D.propsPixels[id]);
}

/**
 * Moteur de rendu d'objets (Prop Engine). Traduit le JSON en Pixel Art.
 */
function drawProp(p, prop, offsetX, offsetY) {
  if (!prop.pixels || !prop.palette) return;
  const ps = prop.pxSize || PX;  // ← taille pixel du prop (défaut = PX global)
  p.noStroke();
  for(let row=0; row<prop.pixels.length; row++) {
    for(let col=0; col<prop.pixels[row].length; col++) {
      const ci = prop.pixels[row][col];
      if(ci === 0) continue;
      p.fill(prop.palette[ci]);
      pxFree(p, offsetX + col*ps, offsetY + row*ps, ps, ps); // ← pxFree
    }
  }
}

function spawnP(x, y, c) {
  window.particles.push({
    x, y, 
    vx: (Math.random() - 0.5) * 4, 
    vy: -Math.random() * 3 - 1.5, 
    life: 16, 
    c
  });
}


/* ─── SYSTÈME 2 : ÉCOSYSTÈME & TOPOGRAPHIE ──────────────────────── */

// RÔLE : Coordonnées [x, y] des étoiles fixes du ciel (en pixels canvas).
// POURQUOI : Extraites ici plutôt qu'en tableau littéral dans drawSky()
//            pour faciliter les ajustements visuels sans chercher dans la boucle.
//            Zone haute (y 5–40) : étoiles d'origine.
//            Zone médiane (y 45–80) + basse (y 82–115) : ajoutées pour couvrir
//            la fenêtre de la chambre visible dans le biome intérieur.
const STARS = [
  // Zone haute (y 5–40)
  [20,10],[60,25],[110,8],[155,22],[185,12],[40,40],[130,35],
  // Zone médiane (y 45–80)
  [15,50],[75,55],[100,48],[145,62],[175,58],[35,72],[160,75],
  // Zone basse (y 82–115)
  [50,85],[90,92],[135,88],[170,98],[25,105],[120,112],[80,100],
];

/**
 * Dessine le ciel avec un gradient dynamique et des éléments célestes.
 */
function drawSky(p, h, ha) {
  p.noStroke();
  let c1, c2;

  const sol = window.getSolarPhase ? window.getSolarPhase() : { phase: 'jour', t: 0.5 };
  const skyPhase = sol.phase, skyT = sol.t;

  if (skyPhase === 'jour' && ha <= HA_MED) { // ciel gris si ha ≤ 2
    const blend = ha / HA_MED; // 0 = gris total, 1 = ciel normal
    c1 = p.lerpColor(p.color('#4a4a5c'), p.color(C.skyGray1), blend);
    c2 = p.lerpColor(p.color('#5a5a6c'), p.color(C.skyGray2), blend);
  } else if (skyPhase === 'jour') {
    c1 = C.skyD1; c2 = C.skyD2;
  } else if (skyPhase === 'aube') {
    if (skyT < 0.5) {
      const lt = skyT * 2;
      c1 = p.lerpColor(p.color(C.skyN1), p.color(C.skyA1), lt);
      c2 = p.lerpColor(p.color(C.skyN2), p.color(C.skyA2), lt);
    } else {
      const lt = (skyT - 0.5) * 2;
      c1 = p.lerpColor(p.color(C.skyA1), p.color(C.skyD1), lt);
      c2 = p.lerpColor(p.color(C.skyA2), p.color(C.skyD2), lt);
    }
  } else if (skyPhase === 'crepuscule') {
    if (skyT < 0.5) {
      const lt = skyT * 2;
      c1 = p.lerpColor(p.color(C.skyD1), p.color(C.skyK1), lt);
      c2 = p.lerpColor(p.color(C.skyD2), p.color(C.skyK2), lt);
    } else {
      const lt = (skyT - 0.5) * 2;
      c1 = p.lerpColor(p.color(C.skyK1), p.color(C.skyN1), lt);
      c2 = p.lerpColor(p.color(C.skyK2), p.color(C.skyN2), lt);
    }
  } else {
    c1 = C.skyN1; c2 = C.skyN2;
  }

  for (let y = 0; y < 120; y += PX) {
    p.fill(p.lerpColor(p.color(c1), p.color(c2), y / 120));
    p.rect(0, y, CS, PX);
  }

  // Étoiles : nuit pleine + fondu en entrée/sortie de crépuscule/aube
  const showStars = skyPhase === 'nuit'
    || (skyPhase === 'aube'       && skyT < 0.25)
    || (skyPhase === 'crepuscule' && skyT > 0.75);
  if (showStars) {
    const starAlpha = skyPhase === 'nuit'        ? 255
      : skyPhase === 'aube'                      ? (1 - skyT / 0.25) * 255
      : ((skyT - 0.75) / 0.25) * 255;
    // RÔLE : Dessine les étoiles réparties sur toute la hauteur du ciel (0–115px).
    // POURQUOI : Coordonnées centralisées dans const STARS (haut du fichier) —
    //            plus besoin de chercher dans la boucle pour ajuster une étoile.
    // Chaque étoile : [x, y] — scintillement décalé via (frameCount + x) % cycle
    p.fill(p.color(255, 255, 200, Math.round(starAlpha)));
    STARS.forEach(s => {
      if ((p.frameCount + s[0]) % 35 < 25) px(p, s[0], s[1], PX, PX);
    });

    if (skyPhase === 'nuit') {
      const trailCycle = 60, trailPhase = p.frameCount % trailCycle;
      if (trailPhase === 0) {
        window._starTrail = {
          startX: Math.random() * 80 + 5, startY: Math.random() * 20 + 3,
          lenX:   60 + Math.random() * 80, lenY:  25 + Math.random() * 45,
        };
      }
      if (trailPhase < 12 && window._starTrail) {
        const progress = trailPhase / 12;
        const sx = window._starTrail.startX + progress * window._starTrail.lenX;
        const sy = window._starTrail.startY + progress * window._starTrail.lenY;
        for (let ti = 0; ti < 3; ti++) {
          p.fill(p.color(255, 255, 200, ti === 0 ? 230 : 120 - ti * 40));
          px(p, sx - ti * PX * 2, sy - ti * PX, PX, PX);
        }
      }
    }
  }

  // Nuages : jour, fin d'aube, début de crépuscule — et bonne humeur
  const showClouds = ha > HA_MED && ( // nuages seulement si ha > 2
    skyPhase === 'jour'
    || (skyPhase === 'aube'       && skyT > 0.5)
    || (skyPhase === 'crepuscule' && skyT < 0.5)
  );
  if (showClouds) {
    drawCl(p, 40 + Math.sin(p.frameCount * .014) * 8, 20);
    drawCl(p, 150 + Math.cos(p.frameCount * .011) * 6, 35);
  }
}

function drawCl(p, x, y) { 
  p.fill(C.cloud); 
  p.rect(x, y, PX * 5, PX * 2); 
  p.rect(x + PX, y - PX, PX * 3, PX); 
}

function drawZzz(p, x, y) {
  for(let i = 0; i < 3; i++) {
    const fy = y - i * 15 - (p.frameCount % 50) * 0.4;
    const fx = x + i * 10 + Math.sin(p.frameCount * .1 + i) * 3;
    const sz = PX;
    p.fill(p.color(176, 144, 208, 200 - i * 50));
    px(p, fx, fy, sz * 4, sz);          
    px(p, fx + sz * 2, fy + sz, sz, sz); 
    px(p, fx + sz, fy + sz * 2, sz, sz); 
    px(p, fx, fy + sz * 3, sz * 4, sz);  
  }
}

function updateParts(p) {
    p.noStroke();
    window.particles = window.particles.filter(pt => {
      pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.12; pt.life--;
      if (pt.life <= 0) return false;
      const a = pt.life / 16;
      p.fill(p.color(...p.color(pt.c)._array.slice(0,3).map(x=>x*255), a * 255));
      px(p, pt.x, pt.y, PX, PX);
      return true;
    });
}


/* ─── SYSTÈME 1 : SPRITES → voir render-sprites.js ──────────────── */
// drawDither, drawAccessoires, drawEgg, drawBaby, drawTeen, drawAdult
// sont définis dans render-sprites.js (chargé après render.js dans index.html)

function triggerTouchReaction(sleeping) {
  const awakeTypes = ['heart', 'heart', 'sparkle', 'jump', 'spin', 'star', 'note', 'flower'];
  const sleepTypes = ['zzz', 'moon', 'angry'];
  const types = sleeping ? sleepTypes : awakeTypes;
  const type = types[Math.floor(Math.random() * types.length)];
  
  window.touchReactions.push({
    timer: 35, 
    type,      
    cx: (window._lastTapX || 100) + (Math.random() - 0.5) * 40,
  });

  if (window.touchReactions.length > 8) window.touchReactions.shift();
  window.shakeTimer = 8;

  const touchMsgs = sleeping
    ? ['*grogne* 😤', 'Laisse-moi dormir ! 🌙', '...zzz... 💤']
    : ['*hehe* ✿', 'Coucou ! 💜', '*giggle* 🌸', 'Encore ! ✿'];
  
  flashBubble(touchMsgs[Math.floor(Math.random() * touchMsgs.length)], 2000);
}


/* ─── SYSTÈME 7 : L'INGÉNIERIE & LA BOUCLE PRINCIPALE p5.js ─────── */

/* ──────────────────────────────────────────────────────────────────
   SOUS-FONCTIONS DE RENDU — extraites de p.draw() pour lisibilité
   Toutes locales au module : aucune exposition window.* nécessaire
   car elles ne sont appelées que depuis p.draw().
   ────────────────────────────────────────────────────────────────── */

/**
 * RÔLE : Dessine les props filtrées par type de slot.
 * POURQUOI : Remplace 4 blocs .filter().forEach() quasi-identiques dans p.draw().
 *            Un seul endroit à lire/modifier si la logique de filtrage évolue.
 *
 * @param {object} p         - instance p5.js
 * @param {object} g         - window.D.g (état du gotchi)
 * @param {string} envActif  - identifiant de l'env courant ('parc', 'chambre', 'montagne')
 * @param {string} mode      - 'ambiance' | 'fond' | 'sol' | 'fg'
 *   • 'ambiance' → type=ambiance, tous slots, animation drift/fall/float/sparkle
 *   • 'fond'     → type=decor, slots A et B
 *   • 'sol'      → type=decor, slot SOL
 *   • 'fg'       → type=decor, slots C et D (premier plan, devant le Gotchi)
 */
function drawPropsLayer(p, g, envActif, mode) {
  if (!g.props) return; // aucune prop à dessiner — sortie rapide

  if (mode === 'ambiance') {
    // RÔLE : Props flottantes (nuages, bulles, feuilles…) — animées et répétées 3×
    g.props
      .filter(pr => pr.actif && pr.type === 'ambiance' && (pr.env === envActif || !pr.env))
      .forEach(prop => {
        const def = getPropDef(prop.id);
        if (!def?.pixels) return;
        const motion = def.motion || 'drift';
        for (let i = 0; i < 3; i++) {
          let ax, ay;
          if (motion === 'drift') {
            ax = CS - ((p.frameCount * 2 + i * 70) % (CS + 20));
            ay = 20 + i * 35 + Math.sin(p.frameCount * .05 + i) * 8;
          } else if (motion === 'fall') {
            ax = 20 + i * 70 + Math.sin(p.frameCount * .04 + i) * 5;
            ay = (p.frameCount * 2 + i * 40) % 130;
          } else if (motion === 'float') {
            ax = 30 + i * 65 + Math.sin(p.frameCount * .06 + i) * 6;
            ay = 110 - ((p.frameCount + i * 45) % 120);
          } else if (motion === 'sparkle') {
            if ((p.frameCount + i * 13) % 20 < 10) continue;
            ax = 15 + i * 75 + Math.sin(p.frameCount * .1 + i) * 10;
            ay = 15 + i * 35 + Math.cos(p.frameCount * .08 + i) * 8;
          }
          drawProp(p, def, ax, ay);
        }
      });

  } else {
    // RÔLE : Props de décor fixes — positionnées sur un slot PROP_SLOTS défini
    // POURQUOI : 'fond' (A,B), 'sol' (SOL), 'fg' (C,D) partagent exactement la même
    //            logique de dessin — seul le filtre sur pr.slot change.
    const slotWhitelist = mode === 'fond' ? ['A', 'B']
                        : mode === 'sol'  ? ['SOL']
                        :                  ['C', 'D']; // fg

    g.props
      .filter(pr =>
        pr.actif &&
        pr.type === 'decor' &&
        slotWhitelist.includes(pr.slot) &&
        (pr.env === envActif || !pr.env)
      )
      .forEach(prop => {
        const def = getPropDef(prop.id);
        if (!def?.pixels) return;
        const slot = PROP_SLOTS[prop.slot];
        if (slot) drawProp(p, def, slot.x, slot.y);
      });
  }
}

/**
 * RÔLE : Dessine le bandeau HUD en haut du canvas.
 * POURQUOI : Isoler cette zone (~65 lignes) permet de modifier l'affichage
 *            des pétales, météo ou icônes d'action sans parcourir tout p.draw().
 *
 * @param {object} p - instance p5.js
 * @param {object} g - window.D.g
 * @param {number} h - heure courante (0–23)
 */
function drawHUD(p, g, h) {
  // ── Bandeau de fond semi-transparent ──
  p.noStroke();
  p.textStyle(p.NORMAL);
  p.fill(0, 0, 0, 50);
  p.rect(0, 0, CS, 26);

  // ── ZONE GAUCHE : pétales ──────────────────────────────────────
  p.fill(255);
  p.textSize(11);
  p.textAlign(p.LEFT, p.TOP);
  p.drawingContext.globalAlpha = 1.0;
  p.text('🌸 ' + (g.petales || 0), 5, 6);

  // ── ZONE DROITE : météo ────────────────────────────────────────
  if (window.meteoData?.temperature) {
    const wcMeteo = window.meteoData?.weathercode;
    const wind    = window.meteoData?.windspeed || 0;
    let hudMeteo  = Math.round(window.meteoData.temperature) + '°C';
    if (wcMeteo === 45 || wcMeteo === 48) hudMeteo += ' 😶‍🌫️';
    if (wind > 20) hudMeteo += ' 🌬️';
    p.textSize(hudMeteo.length > 9 ? 9 : 11);
    p.textAlign(p.RIGHT, p.TOP);
    p.drawingContext.globalAlpha = 1.0;
    p.text(hudMeteo, CS - 5, 6);
    p.textSize(11);
  }

  // ── ZONE CENTRE : 3 icônes d'action ───────────────────────────
  // Disposition : 🛁 (gauche) — 🧹 (centre exact) — 🍽️ (droite)
  // POURQUOI : Le balai (action la plus fréquente) est au centre exact du canvas.
  //            🛁 et 🍽️ sont symétriques à ±28px de ce centre.
  //            Opacité : 1.0 = action dispo, 0.25 = rien à faire (icône toujours visible).
  p.textSize(20);
  p.textAlign(p.CENTER, p.CENTER);

  // 🧹 Balai (centre exact, x=70) : opaque si des crottes sont présentes
  const hasPoops = (window.D.g.poops || []).length > 0;
  p.drawingContext.globalAlpha = hasPoops ? 1.0 : 0.25;
  p.text('🧹', 70, 14);

  // 🛁 Bain (gauche du centre, x=100) : opaque si salete >= 5, estompé si propre
  const salete = window.D?.g?.salete || 0;
  p.drawingContext.globalAlpha = salete >= 5 ? 1.0 : 0.25;
  p.text('🛁', 100, 14);

  // 🍽️ Assiette (droite du centre, x=130) : opaque si repas disponible
  const mealWin = (typeof getCurrentMealWindow === 'function') ? getCurrentMealWindow() : null;
  const meals   = (typeof ensureMealsToday === 'function') ? ensureMealsToday() : null;
  const mealAvailable = mealWin && meals && !meals[mealWin];
  p.drawingContext.globalAlpha = mealAvailable ? 1.0 : 0.25;
  p.text('🍽️', 130, 14);

  p.drawingContext.globalAlpha = 1.0;

  // RÔLE : Déclenche les particules de propreté si une crotte vient d'être nettoyée
  // POURQUOI : window._cleanPositions est posé par app.js juste après le nettoyage —
  //            on le lit ici (dans le draw) pour les faire apparaître au bon endroit.
  if (window._cleanPositions?.length) {
    window._cleanPositions.forEach(pos => {
      for (let i = 0; i < 6; i++) {
        spawnP(pos.x + (Math.random() - 0.5) * 20, pos.y + (Math.random() - 0.5) * 10, C.star);
      }
    });
    window._cleanPositions = null;
  }
}

/**
 * RÔLE : Dessine les deux badges ⚡/✿ en bas-gauche + le triangle d'interactivité.
 * POURQUOI : Les badges exposent window._badgeHitZone pour touchStarted — les isoler
 *            ici permet de changer leur taille/position sans toucher à p.draw().
 *
 * @param {object} p - instance p5.js
 * @param {object} g - window.D.g
 */
function drawBadges(p, g) {
  const en = g.energy;
  const ha = g.happiness;
  const badgeY  = CS - 18; // position verticale : 18px du bas
  const badgeH  = 13;      // hauteur de la capsule
  const badgeR  = 3;       // rayon des coins arrondis
  const badgePadX = 4;     // padding interne horizontal
  const badgeW  = 30;      // largeur fixe identique pour les deux badges
  const iconW   = 10;      // zone réservée à l'icône
  const gap     = 3;       // espace fixe entre icône et chiffre
  const gap2    = 3;       // espace entre les deux badges
  // POURQUOI : p.CENTER sur Y + midY évite le décalage manuel qui variait selon textSize
  const midY    = badgeY - 1 + badgeH / 2;

  p.noStroke();
  p.textStyle(p.NORMAL);
  p.textSize(9);

  // ── Badge ⚡ (énergie) ──
  const enX = 4;
  p.fill(0, 0, 0, 50);           // même alpha que le bandeau HUD supérieur
  p.rect(enX, badgeY - 1, badgeW, badgeH, badgeR);
  p.fill(255);
  p.textAlign(p.LEFT, p.CENTER); // CENTER sur Y = centrage vertical automatique
  p.text('⚡', enX + badgePadX, midY);
  p.text(String(en), enX + badgePadX + iconW + gap, midY);

  // ── Badge ✿ (bonheur) ──
  const haX = enX + badgeW + gap2;
  p.fill(0, 0, 0, 50);
  p.rect(haX, badgeY - 1, badgeW, badgeH, badgeR);
  p.fill(255);
  p.textAlign(p.LEFT, p.CENTER);
  p.text('✿', haX + badgePadX, midY);
  p.text(String(ha), haX + badgePadX + iconW + gap, midY);

  // ── Triangle ▲ interactivité ──
  const triX = haX + badgeW + 4;
  p.textSize(8);
  p.fill(255, 255, 255, 160);
  p.textAlign(p.LEFT, p.CENTER);
  p.text('▲', triX, midY);

  // Exposer la zone de hit pour touchStarted (en px canvas)
  // POURQUOI : calculé ici pour rester synchronisé si les badges changent de taille
  window._badgeHitZone = {
    x1: 4,
    x2: triX + 10,
    y1: badgeY - 2,
    y2: badgeY + badgeH + 2
  };

  p.textSize(11); // ← remet la taille par défaut après les badges
}

/**
 * RÔLE : Dessine le sélecteur d'environnement en bas-droite du canvas.
 * POURQUOI : Isoler ce composant (~85 lignes) permet de modifier son comportement
 *            (nouveaux envs, animation de fondu) sans parcourir tout p.draw().
 *
 * @param {object} p          - instance p5.js
 * @param {object} g          - window.D.g
 * @param {number} nightRatio - ratio nuit 0→1 (calculé dans p.draw)
 */
function drawEnvSelector(p, g, nightRatio) {
  // ── Géométrie (aligné sur le bas des badges) ──
  // POURQUOI : badgeY = CS-18, bas des badges = badgeY - 1 + badgeH = CS - 6.
  //            On aligne le bas du cercle sur ce même bas → centre = CS - 6 - envR.
  const envR  = 13;                 // rayon = badgeH (13) → diamètre 26px = 2× hauteur badge
  const envCX = CS - 4 - envR;     // centre X : margin droit 4px + rayon
  const envCY = CS - 6 - envR;     // centre Y : bas aligné sur le bas des badges (CS - 6)
  const envGap = envR * 2 + 5;     // espacement entre cercles empilés (diamètre + 5px)

  // ── Mapping emoji par env ──
  const ENV_EMOJI = { parc: '🌳', chambre: '🛏️', montagne: '⛰️' };
  const activeEnv = g.activeEnv || 'parc';

  // ── Détermination du mode nuit pour le sélecteur ──
  // RÔLE : On bloque le sélecteur dès que nightRatio === 1 (à partir de 21h),
  //        car l'env est forcé chambre et l'utilisatrice ne peut pas changer d'env.
  // POURQUOI : sleeping (>= 22h) est trop tardif — à 21h l'env est déjà verrouillé.
  const envLocked = nightRatio === 1;
  window._envLocked = envLocked; // exposé pour touchStarted (pas accès à nightRatio là-bas)

  // ── Gestion du fondu d'environnement (crossfade ~18 frames ≈ 0,3s) ──
  // RÔLE : Incrémente le compteur de fondu à chaque frame si un changement d'env est en cours.
  // POURQUOI : Transition douce — évite le saut brutal de décor.
  const FADE_FRAMES = 18;
  if (window._envFadeState) {
    window._envFadeState.frames++;
    if (window._envFadeState.frames >= FADE_FRAMES) {
      window._envFadeState = null; // fondu terminé, on nettoie
    }
  }

  // ── Réinitialise les zones de tap à chaque frame ──
  window._envSelectorHits = [];

  // ── Cercle principal (env actif, ou 💤 la nuit) ──
  p.noStroke();
  p.fill(0, 0, 0, 50);           // même fond semi-transparent que les badges
  p.circle(envCX, envCY, envR * 2);
  p.textAlign(p.CENTER, p.CENTER);
  p.textSize(14);
  p.fill(255);
  // RÔLE : Affiche 💤 dès que l'env est verrouillé (nightRatio === 1, soit dès 21h).
  const mainEmoji = envLocked ? '💤' : ENV_EMOJI[activeEnv] || '🌳';
  p.text(mainEmoji, envCX, envCY);
  p.textSize(11); // ← reset taille texte

  // ── Zone de tap : n'exposer que si pas verrouillé ──
  if (!envLocked) {
    window._envSelectorHits.push({ env: '__main__', cx: envCX, cy: envCY, r: envR });
  }

  // ── Cercles flottants (seulement si ouvert et env non verrouillé) ──
  if (window._envSelectorOpen && !envLocked) {
    // RÔLE : Affiche les 2 environnements alternatifs au-dessus du cercle principal.
    // POURQUOI : Empilés verticalement, même style, tap = changement d'env + fermeture.
    const otherEnvs = ['parc', 'chambre', 'montagne'].filter(e => e !== activeEnv);

    otherEnvs.forEach((env, i) => {
      // i=0 → juste au-dessus du principal | i=1 → encore plus haut
      const floatCY = envCY - envGap * (i + 1);

      p.fill(0, 0, 0, 65);       // légèrement plus opaque pour se distinguer
      p.circle(envCX, floatCY, envR * 2);

      p.fill(255);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(14);
      p.text(ENV_EMOJI[env] || '?', envCX, floatCY);
      p.textSize(11); // ← reset

      window._envSelectorHits.push({ env, cx: envCX, cy: floatCY, r: envR });
    });
  }
}

/* ──────────────────────────────────────────────────────────────────
   FIN DES SOUS-FONCTIONS — p5s() commence ci-dessous
   ────────────────────────────────────────────────────────────────── */

const p5s = (p) => {
  p.setup = function() {
    p.createCanvas(CS, CS).parent('cbox');
    p.noSmooth();
    p.frameRate(12);
  };

  p.draw = function() {
    if (!window.D) return;
    const g = window.D.g, h = hr(), sleeping = (h >= 22 || h < 7);

    // Initialisation des couleurs
    const gc = getGotchiC();
    C.body = gc.body; C.bodyLt = gc.bodyLt; C.bodyDk = gc.bodyDk;
    const ec = getEnvC();
    C.gnd = ec.gnd; C.gndDk = ec.gndDk; C.skyD1 = ec.sky1; C.skyD2 = ec.sky2;

    // RÔLE : on lit directement les jauges en 0–5 (plus de ×20)
    // POURQUOI : les seuils visuels sont désormais exprimés en 0–5 via les constantes EN_*/HA_* de config.js
    const en = g.energy, ha = g.happiness;

    // RÔLE : Calcule le ratio nuit (0 = jour, 1 = nuit pleine) pour une transition progressive
    // POURQUOI : remplace l'ancien booléen n = (h >= 21) qui basculait brutalement d'un coup
    // Transition soir : 20h → 21h (ratio monte de 0 à 1 sur 60 minutes)
    // Transition matin : 5h → 6h (ratio descend de 1 à 0 sur 60 minutes)
    const mins = new Date().getMinutes(); // minutes dans l'heure courante (0–59)
    let nightRatio;
    if (h === 20) {
      nightRatio = mins / 60;            // 20h00 → 0, 20h59 → ~1
    } else if (h === 5) {
      nightRatio = 1 - (mins / 60);     // 5h00 → 1, 5h59 → ~0
    } else if (h >= 21 || h < 5) {
      nightRatio = 1;                    // nuit pleine
    } else {
      nightRatio = 0;                    // plein jour
    }
    const n = nightRatio; // alias court pour compatibilité avec drawActiveEnv(p, env, n, h)

    const sol = window.getSolarPhase ? window.getSolarPhase() : { phase: 'jour', t: 0 };
    const darkAlpha = sol.phase === 'nuit'       ? 100
                    : sol.phase === 'aube'        ? Math.round(100 * (1 - sol.t))
                    : sol.phase === 'crepuscule'  ? Math.round(100 * sol.t)
                    : 0;

// 1. Fond et Météo
    drawSky(p, h, ha);
    if (window.meteoData && window.meteoData.windspeed > 20) drawWind(p);

    const estJour = h < 19;
    // RÔLE : Détermine l'environnement à afficher en fond.
    // La nuit, on force la chambre — SAUF si on est en preview inventaire (_invEnvForced),
    // auquel cas on respecte le choix de l'utilisatrice pour qu'elle puisse voir parc/montagne.
    const enPreviewInv = !!window._invEnvForced;
    let envActif = (!enPreviewInv && nightRatio === 1) ? 'chambre' : (g.activeEnv || 'parc');
    if (!sleeping) {
      if (ha < HA_MED)                    drawRain(p, ha);  // pluie si ha = 0 ou 1
      else if (ha === HA_HIGH && estJour) drawSun(p);       // soleil à ha = 4
      else if (ha >= 5 && estJour)        drawRainbow(p);   // arc-en-ciel à ha = 5 (max)
    }

    drawActiveEnv(p, envActif, n, h);

    // 2. Props Ambiance — filtrées par environnement actif
    // RÔLE : N'afficher que les ambiances assignées à l'env en cours.
    // POURQUOI : Chaque univers peut avoir ses propres ambiances depuis la v3.49.
    //            Rétrocompat : si env non défini (ancienne sauvegarde), on affiche quand même.
    drawPropsLayer(p, g, envActif, 'ambiance');

    // 3. Détection proximité Gotchi/Crotte (calcul anticipé, dessin reporté après SOL)
    // RÔLE : On calcule ici si le gotchi est près d'une crotte, mais on ne dessine PAS encore.
    // POURQUOI : Les crottes doivent être dessinées APRÈS les props de fond/sol et AVANT le gotchi,
    //            pour apparaître au même niveau visuel que lui (devant le fond, derrière le premier plan).
    const poops = window.D.g.poops || [];
    let gotchiNearPoop = false;
    poops.forEach(poop => {
      if (Math.abs(poop.x - walkX) < 25) gotchiNearPoop = true;
    });
    window._gotchiNearPoop = gotchiNearPoop;

    // 4. Props Décor — Fond (A, B) — filtrées par environnement actif
    // RÔLE : N'afficher que les décors de fond assignés à l'env en cours.
    // POURQUOI : Feature multi-env v3.49. Rétrocompat : env absent → toujours visible.
    drawPropsLayer(p, g, envActif, 'fond');

// 5. Props Décor — SOL (devant le décor, DERRIÈRE le Gotchi) — filtrées par env
    drawPropsLayer(p, g, envActif, 'sol');

// 5b. Dessin des Cacas — APRÈS le sol, AVANT le Gotchi
// RÔLE : Les crottes sont dessinées ici pour qu'elles apparaissent devant les objets du fond
//         (slots A, B, SOL) mais derrière le gotchi lui-même et les slots de premier plan (C, D).
// POURQUOI : Repositionner ici donne la bonne profondeur visuelle dans le tama :
//            fond → sol → crottes → gotchi → premier plan
{
  const pxSize = 20; // taille emoji crotte
  poops.forEach(poop => {
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(pxSize);
    p.text('💩', poop.x, poop.y);
  });
}

// 6. Locomotion Gotchi
bounceT += sleeping ? 0.04 : 0.12;
const staticBob = sleeping ? Math.sin(bounceT) : Math.sin(bounceT) * 3;
let bobY = staticBob + GOTCHI_OFFSET_Y;

if (window.eatAnim?.active) {
  const progress = 1 - (window.eatAnim.timer / 50);
  if (progress > 0.7 && !window.eatAnim.jumped) {
    window.eatAnim.jumped = true;
  }
  if (window.eatAnim.jumped) {
    const t = 1 - (window.eatAnim.timer / (50 * 0.15));
    bobY -= Math.sin(t * Math.PI) * 18;
  }
}

// Saut déclenché depuis app.js (habitudes, réactions)
if (window._jumpTimer > 0) {
  const t = window._jumpTimer / 20;
  bobY -= Math.sin(t * Math.PI) * 22;
  window._jumpTimer--;
}

let amplitude = 15, vitesse = 0.02;
if (!sleeping && ha >= HA_HIGH && en >= HA_HIGH) {  // très heureux + plein d'énergie (≥ 4)
  amplitude = 40; vitesse = 0.06;
  if (p.frameCount % 20 < 10) bobY -= PX;
} else if (!sleeping && ha >= HA_WALK && en >= HA_WALK) { // état normal (≥ 3)
  amplitude = 25; vitesse = 0.04;
}

const XMIN = 35, XMAX = CS - 35;

if (!sleeping) {
  walkStep++;
  const speed = (ha >= HA_HIGH && en >= HA_HIGH)  ? 1.4  // vive (≥ 4/5)
              : (ha >= HA_SLOW && en >= HA_WALK)  ? 0.7  // normale (ha≥2.5, en≥3)
              : (en >= EN_TILT)                   ? 0.35 // lente (en≥2)
              : 0.12;                                     // traîne (en < 2)

  if (walkPause > 0) {
    walkPause--;
    if (walkPause === 0) {
      walkTarget = XMIN + Math.random() * (XMAX - XMIN);
    }
  } else {
    const dist = walkTarget - walkX;
    walkDir = dist > 0 ? 1 : -1;
    if (Math.abs(dist) < speed + 1) {
      walkX = walkTarget;
      walkPause = 30 + Math.floor(Math.random() * 90);
    } else {
      walkX += walkDir * speed;
    }
  }

} else {
  walkX += walkDir * 0.04;
  if (walkX > XMAX || walkX < XMIN) walkDir *= -1;
}
// RÔLE : Exposer toutes les variables de marche dans un objet partagé.
// POURQUOI : render-sprites.js avait besoin de walkPause pour savoir si le Gotchi
//            est en mouvement. Avant, il accédait à walkPause directement via la scope
//            globale — couplage implicite qui casserait si on passe en modules ES.
//            Avec window._walk, la dépendance est explicite et documentée.
window._walk = { x: walkX, dir: walkDir, pause: walkPause, step: walkStep, target: walkTarget };
window._gotchiX = walkX; // ← gardé pour la rétrocompatibilité (hitbox touch, etc.)

const cx = walkX;
const by = getStageBaseY(g.stage); // RÔLE : Y de base du Gotchi selon son stade — centralisé dans getStageBaseY()
window._gotchiY = by + (bobY || 0);
const tilt = (!sleeping && en < EN_TILT) ? Math.sin(p.frameCount * 0.05) * 2 : 0; // balancement si en < 2

if (window.shakeTimer > 0) window.shakeTimer--;


// 7. Dessin du Gotchi
    let gotchiInfo;
    p.push();
    if (tilt) p.rotate(p.radians(tilt));
    
    const shakeOffsetX = (window.shakeTimer > 0) ? Math.sin(p.frameCount * 3) * 5 : 0;
    const shakeOffsetY = (window.shakeTimer > 0) ? Math.sin(p.frameCount * 2) * 3 : 0;
    const drawX = cx + shakeOffsetX;
    const drawY = by + bobY + shakeOffsetY;

    if (window._evoAnim && window._evoAnim.active) {
  const t = window._evoAnim.timer;

  if (t > 20) {
    const alpha = p.map(t, 45, 20, 0, 255);
    p.fill(255, 255, 255, alpha);
    p.noStroke();
    px(p, drawX - PX*5, drawY, PX*10, PX*9);
  } else {
    if      (g.stage === 'baby')  gotchiInfo = drawBaby(p, drawX, drawY, sleeping, en, ha);
    else if (g.stage === 'teen')  gotchiInfo = drawTeen(p, drawX, drawY, sleeping, en, ha);
    else                          gotchiInfo = drawAdult(p, drawX, drawY, sleeping, en, ha);
    const alpha2 = p.map(t, 20, 0, 255, 0);
    p.fill(255, 255, 255, alpha2);
    p.noStroke();
    px(p, drawX - PX*5, drawY, PX*10, PX*9);
  }

  window._evoAnim.timer--;
  if (window._evoAnim.timer <= 0) window._evoAnim.active = false;

} else {
      if      (g.stage === 'egg')   gotchiInfo = drawEgg(p, drawX, drawY);
      else if (g.stage === 'baby')  gotchiInfo = drawBaby(p, drawX, drawY, sleeping, en, ha);
      else if (g.stage === 'teen')  gotchiInfo = drawTeen(p, drawX, drawY, sleeping, en, ha);
      else                          gotchiInfo = drawAdult(p, drawX, drawY, sleeping, en, ha);
      if (sleeping && g.stage !== 'egg') drawZzz(p, drawX + 16, drawY - 10);
    }

    p.pop();

    const wc = window.meteoData?.weathercode;
    if (wc === 45 || wc === 48) drawFog(p);

    // 9. Props Décor — Premier plan (C, D) — DEVANT le Gotchi — filtrées par env
    drawPropsLayer(p, g, envActif, 'fg');

    // 10. Réactions et Particules
    p.drawingContext.globalAlpha = 1.0; 
    window.touchReactions = (window.touchReactions || []).filter(tr => tr.timer > 0);
    window.touchReactions.forEach(tr => {
      const progress = 1 - (tr.timer / 35); 
      const fy = (by - 15) - progress * 45; 
      const fx = tr.cx + Math.sin(progress * Math.PI * 3) * 10;

      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(16);
      p.drawingContext.globalAlpha = 1.0;

      if      (tr.type === 'heart')   p.text('💜', fx, fy);
      else if (tr.type === 'sparkle') p.text('✨', fx, fy);
      else if (tr.type === 'star')    p.text('⭐', fx, fy);
      else if (tr.type === 'note')    p.text('🎵', fx, fy);
      else if (tr.type === 'flower')  p.text('🌸', fx, fy);
      else if (tr.type === 'spin') {
        const angle = progress * Math.PI * 4;
        const sx = cx + Math.cos(angle) * 22;
        const sy = (by - 15) + Math.sin(angle) * 12;
        p.text('✨', sx, sy);
      }
      else if (tr.type === 'jump')  bounceT = Math.PI * 1.5;
      else if (tr.type === 'zzz')   p.text('💤', fx, fy);
      else if (tr.type === 'moon')  p.text('🌙', fx, fy);
      else if (tr.type === 'angry') p.text('😤', fx, fy);

      p.drawingContext.globalAlpha = 1.0;
      tr.timer--;
    });

    updateParts(p);

    // 11. Animations spécifiques (Snack, Clignement, Célébration)
    if (window.eatAnim?.active) {
      const ea = window.eatAnim;
      const progress = 1 - (ea.timer / 50); 
      const fy = 20 + progress * (by - 30);
      const fx = cx;
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(20);
      p.drawingContext.globalAlpha = 1.0;
      p.text(ea.emoji, fx, fy);
      
      if (progress > 0.7 && !ea.jumped) {
        triggerTouchReaction(false);
        ea.jumped = true;
      }
      ea.timer--;
      if (ea.timer <= 0) ea.active = false;
    }

    blinkT++;
if (!blink && blinkT > window._nextBlinkAt) {
  blink = true;
  window._blinkDuration = 3 + Math.floor(Math.random() * 4); // 3-6 frames
}
if (blink) {
  window._blinkDuration--;
  if (window._blinkDuration <= 0) {
    blink = false;
    blinkT = 0;
    window._nextBlinkAt = 40 + Math.floor(Math.random() * 80); // 40-120 frames entre clignements
  }
}

// ✨ Décrémente le timer d'expression une fois par frame
if (window._expr && window._expr.moodTimer > 0) window._expr.moodTimer--;

    while (window.celebQueue.length) {
      window.celebQueue.shift();
      for (let i = 0; i < 15; i++) {
        spawnP(cx + (Math.random() - .5) * 40, by - 10, C.rainbow[Math.floor(Math.random() * C.rainbow.length)]);
      }
      bounceT = Math.PI * 1.5;
    }

    // Surcouche nuit — couvre env, props, Gotchi.
    // POURQUOI : Dessinée AVANT le HUD → le HUD est rendu par-dessus et reste lumineux.
    //            (L'overlay ne "cache" pas le HUD : il est simplement dessiné après lui.)
    if (darkAlpha > 0) {
      p.noStroke();
      p.fill(0, 0, 0, darkAlpha);
      p.rect(0, 0, p.width, p.height);
    }

    // 12–14. HUD, Badges, Sélecteur d'environnement
    // RÔLE : Masqués en mode compact (tama réduit sur les onglets secondaires).
    // POURQUOI : En mode compact, le canvas est réduit à ~110px de large — le HUD et les
    //            badges n'ont plus assez de place et visuellement ils ne servent à rien
    //            puisque l'utilisatrice n'est pas sur l'onglet Gotchi.
    const isCompact = document.getElementById('console-top')?.classList.contains('compact');
    if (!isCompact) {
      drawHUD(p, g, h);              // 12. Bandeau pétales / actions / météo
      drawBadges(p, g);              // 13. Capsules ⚡/✿ + zone de hit badges
      drawEnvSelector(p, g, n);     // 14. Cercle env actif + cercles flottants
    } else {
      // Mode compact : désactiver la zone de tap des badges
      window._badgeHitZone = null;
    } // ← fin if (!isCompact)

  }; // ← fin p.draw()

  // Vérifie si un overlay actif bloque les interactions canvas
function isOverlayActive() {
  const modal = document.getElementById('modal');
  const toast = document.getElementById('toast'); // adapte l'ID si besoin
  const modalVisible = modal && modal.style.display !== 'none';
  const toastVisible = toast && toast.style.display !== 'none';
  return modalVisible || toastVisible;
}

  // 13. Gestionnaire d'événements tactiles (Garde l'accès à "p.")
    p.touchStarted = function() {
    // 🔒 GARDE 0 : tap hors du canvas → laisser le DOM gérer (ex : #hdr-title, boutons header)
    // RÔLE : p5.js attache ses listeners touchstart sur le document entier, pas sur le canvas.
    //        Un tap sur #hdr-title déclenche donc touchStarted, qui empêche le onclick de se déclencher.
    //        On vérifie que le tap est bien dans les bounds du canvas avant d'aller plus loin.
    // POURQUOI : Résout le bug "tap sur le titre n'ouvre pas l'agenda".
    {
      const canvasEl = document.querySelector('#cbox canvas');
      if (canvasEl) {
        const rect = canvasEl.getBoundingClientRect();
        const touch = p.touches[0];
        // p.touches[0].x/.y sont en coordonnées canvas (0→CS) — on compare avec les bounds réels
        const clientX = touch ? (rect.left + touch.x * (rect.width  / CS)) : -9999;
        const clientY = touch ? (rect.top  + touch.y * (rect.height / CS)) : -9999;
        const inCanvas = clientX >= rect.left && clientX <= rect.right
                      && clientY >= rect.top  && clientY <= rect.bottom;
        if (!inCanvas) return true; // rend la main au DOM
      }
    }

    // 🔒 GARDE 1 : menu principal ouvert
    const menuOverlay = document.getElementById('menu-overlay');
    if (menuOverlay && menuOverlay.classList.contains('open')) return true;

// 🔒 GARDE 2 : modal OU menu-overlay visibles
const modalEl = document.getElementById('modal');
const menuEl = document.getElementById('menu-overlay');
if (
  (modalEl && getComputedStyle(modalEl).display !== 'none') ||
  (menuEl && menuEl.classList.contains('open'))
) return true;

    // 🔒 GARDE 3 : l'utilisateur est focus sur un champ de saisie
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      return true;
    }
// 🔒 GARDE 4 : hors onglet Gotchi → géré par pointerdown sur .tama-screen (ui.js)
if (!window._gotchiActif) return true;

    // RÔLE : Anti-rebond tactile — ignore les taps répétés trop rapprochés (< 200ms)
    // POURQUOI : Encapsulé dans _tapState pour éviter une variable globale nue
    //            qui pouvait être écrasée accidentellement depuis un autre module.
    if (!window._tapState) window._tapState = { lastTime: 0 };
    const now = Date.now();
    if (now - window._tapState.lastTime < 200) return false;
    window._tapState.lastTime = now;

    const mx = p.touches[0]?.x ?? p.mouseX;
    const my = p.touches[0]?.y ?? p.mouseY;

    // 🧹 Balai (x=70) — nettoyer les crottes
    if (Math.abs(mx - 70) < 14 && my < 26) {
      setTimeout(() => cleanPoops(), 0); return false;
    }

    // 🛁 Bain (x=100) — tap = expression surprise si sale (rappel de frotter)
    if (Math.abs(mx - 100) < 14 && my < 26) {
      if ((window.D?.g?.salete || 0) >= 5) {
        if (typeof window.triggerExpr === 'function') window.triggerExpr('surprise', 40);
      }
      return false;
    }

    // 🍽️ Assiette (x=130) — ouvrir le snack
    if (Math.abs(mx - 130) < 14 && my < 26) {
      setTimeout(() => ouvrirSnack(), 0); return false;
    }

    // RÔLE : Tap sur les badges énergie/bonheur → ouvre la modale "Comment tu te sens ?"
    // POURQUOI : La zone de hit est calculée dynamiquement dans draw() et stockée dans _badgeHitZone.
    //            On vérifie aussi _gotchiActif pour n'ouvrir la modale que sur l'écran d'accueil.
    const bz = window._badgeHitZone;
    if (bz && mx >= bz.x1 && mx <= bz.x2 && my >= bz.y1 && my <= bz.y2 && window._gotchiActif) {
      setTimeout(() => {
        if (typeof ouvrirModalEtats === 'function') ouvrirModalEtats();
      }, 0);
      return false;
    }

    // ── Sélecteur d'environnement : détection de tap ──────────────────
    // RÔLE : Gère l'ouverture/fermeture du sélecteur et le changement d'env.
    // POURQUOI : Doit être testé AVANT la hitbox Gotchi pour ne pas la confondre.
    {
      const hits = window._envSelectorHits || [];
      let tappedEnvSelector = false;

      for (const zone of hits) {
        const dist = Math.sqrt((mx - zone.cx) ** 2 + (my - zone.cy) ** 2);
        if (dist <= zone.r + 4) { // +4px de tolérance tactile
          tappedEnvSelector = true;

          if (zone.env === '__main__') {
            // RÔLE : Tap sur le cercle principal → ouvre si env disponible, inerte si verrouillé.
            // POURQUOI : On utilise window._envLocked (calculé dans draw() via nightRatio)
            //            plutôt que h >= 22, pour être cohérent avec le vrai seuil de verrouillage (21h).
            if (!window._envLocked) {
              window._envSelectorOpen = !window._envSelectorOpen; // toggle ouvert/fermé
            }
            // Verrouillé (nuit dès 21h) : on ne fait rien

          } else {
            // RÔLE : Tap sur un cercle flottant → change d'env, referme le sélecteur, déclenche le fondu.
            const prevEnv = window.D.g.activeEnv || 'parc';
            window._envFadeState = { from: prevEnv, to: zone.env, frames: 0 };
            if (typeof changeEnv === 'function') changeEnv(zone.env);
            window._envSelectorOpen = false;
          }
          break; // un seul hit traité par tap
        }
      }

      if (!tappedEnvSelector && window._envSelectorOpen) {
        // RÔLE : Tap ailleurs sur le canvas → referme le sélecteur automatiquement.
        // POURQUOI : Comportement attendu — on ne laisse pas le menu flotter indéfiniment.
        window._envSelectorOpen = false;
      }

      // Si on a touché le sélecteur (principal ou flottant), on stoppe la propagation
      if (tappedEnvSelector) return false;
    }
    // ── Fin sélecteur d'environnement ─────────────────────────────────

    const h = hr();
    // Position du Gotchi à l'écran = by + bobY (le bobY contient déjà GOTCHI_OFFSET_Y)
    // On recalcule donc by seul, SANS ajouter OFFSET_Y (il est déjà dans bobY côté rendu).
    // Puis on centre la hitbox sur le CORPS entier du Gotchi, pas juste la tête.
    const by = getStageBaseY(window.D.g.stage); // RÔLE : Y de base du Gotchi — centralisé dans getStageBaseY()

    // Centre du corps = by + OFFSET_Y (pour compenser le bobY) + ~30px (milieu du corps)
    // Hitbox : ±26 en X (largeur corps) et ±35 en Y (tête + corps, PAS au-dessus)
    const gotchiCenterY = by + GOTCHI_OFFSET_Y + 30;
    const hit = Math.abs(mx - walkX) < 26 && Math.abs(my - gotchiCenterY) < 35;


    if (hit) {
  window._lastTapX = walkX + (Math.random() - 0.5) * 20;
  triggerTouchReaction(h >= 22 || h < 7);
  
  // ✨ Expression faciale selon contexte
  if (typeof window.triggerExpr === 'function') {
    const isNight = h >= 22 || h < 7;
    
    if (isNight) {
      // La nuit, on le réveille : surprise ensommeillée
      window.triggerExpr('surprise', 50);
    } else {
      // Le jour : compteur de caresses rapprochées
      window._petCount = (window._petCount || 0) + 1;
      window._lastPetTime = Date.now();
      
      // Reset du compteur après 2s sans caresse
      clearTimeout(window._petResetTimer);
      window._petResetTimer = setTimeout(() => { window._petCount = 0; }, 2000);
      
      // 1-2 taps : surprise douce | 3+ taps rapprochés : joie
      if (window._petCount >= 3) {
        window.triggerExpr('joie', 80);
      } else {
        window.triggerExpr('surprise', 35);
      }
    }
  }
  
  return false;
}
  };

  // ─── Frottement prolongé pour nettoyer le Gotchi (touchMoved) ───
  // RÔLE : Détecte un geste de frottement continu sur le Gotchi et décrémente sa saleté.
  // POURQUOI : Le nettoyage est progressif — il faut frotter pendant ~2 secondes par point de saleté.
  //            On utilise un timer interne (_scrubTimer) pour n'enlever 1 point que toutes les 500ms.
  p.touchMoved = function() {
    // Gardes : mêmes conditions que touchStarted
    if (!window._gotchiActif) return true;
    const modalEl = document.getElementById('modal');
    if (modalEl && getComputedStyle(modalEl).display !== 'none') return true;

    const salete = window.D?.g?.salete || 0;
    if (salete < 5) return true; // Rien à nettoyer

    const mx = p.touches[0]?.x ?? p.mouseX;
    const my = p.touches[0]?.y ?? p.mouseY;

    // Recalcule la hitbox Gotchi (même logique que touchStarted)
    const by = getStageBaseY(window.D.g.stage); // RÔLE : Y de base du Gotchi — centralisé dans getStageBaseY()
    const gotchiCenterY = by + GOTCHI_OFFSET_Y + 30;
    const hit = Math.abs(mx - walkX) < 26 && Math.abs(my - gotchiCenterY) < 35;

    if (!hit) {
      // Doigt sorti de la zone → on arrête le frottement
      clearInterval(window._scrubTimer);
      window._scrubTimer = null;
      return true;
    }

    // RÔLE : Démarrer le timer de frottement si ce n'est pas déjà fait.
    // POURQUOI : touchMoved est appelé à chaque frame de mouvement — on ne veut pas
    //            créer des dizaines de timers. Un seul est actif à la fois.
    if (!window._scrubTimer) {
      window._scrubTimer = setInterval(() => {
        const D = window.D;
        if (!D?.g || D.g.salete < 1) {
          clearInterval(window._scrubTimer);
          window._scrubTimer = null;
          return;
        }

        // Décrémente de 1 point de saleté
        D.g.salete = Math.max(0, D.g.salete - 1);

        // Particules de nettoyage (bulles bleues/blanches)
        for (let i = 0; i < 5; i++) {
          spawnP(
            walkX + (Math.random() - 0.5) * 30,
            by + GOTCHI_OFFSET_Y + (Math.random() * 40),
            Math.random() < 0.5 ? '#88c8e8' : '#ffffff'
          );
        }

        // Expression surprise à chaque point retiré
        if (typeof window.triggerExpr === 'function') {
          window.triggerExpr('surprise', 30);
        }

        // RÔLE : Récompense finale quand le Gotchi est parfaitement propre.
        // POURQUOI : Renforce le comportement : nettoyer = gratification (pétales + event).
        if (D.g.salete === 0) {
          D.g.petales = (D.g.petales || 0) + 2;
          if (typeof addEvent === 'function') {
            addEvent({ type: 'soin', subtype: 'bain', valeur: 2, label: 'Bain donné — +2 🌸' });
          }
          clearInterval(window._scrubTimer);
          window._scrubTimer = null;

          // Particules de célébration (étoiles dorées)
          for (let i = 0; i < 10; i++) {
            spawnP(
              walkX + (Math.random() - 0.5) * 40,
              gotchiCenterY + (Math.random() - 0.5) * 30,
              C.star
            );
          }
        }

        save();
      }, 500); // 1 point de saleté retiré toutes les 500ms
    }

    return false; // empêche le scroll de la page pendant le frottement
  };

  // RÔLE : Nettoie le timer de frottement quand le doigt est levé.
  // POURQUOI : Sans ça, le timer continuerait à tourner en arrière-plan.
  p.touchEnded = function() {
    clearInterval(window._scrubTimer);
    window._scrubTimer = null;
    return true;
  };

}; // ← fin p5s

// DÉMARRAGE DE L'INSTANCE P5
new p5(p5s);
