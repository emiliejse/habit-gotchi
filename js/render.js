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
    // POURQUOI : Avant, les 7 étoiles étaient toutes dans les 40px du haut.
    // On en ajoute pour couvrir la zone basse du ciel, visible notamment
    // à travers la fenêtre de la chambre.
    // Chaque étoile : [x, y] — scintillement décalé via (frameCount + x) % cycle
    p.fill(p.color(255, 255, 200, Math.round(starAlpha)));
    [
      // Zone haute (y 5–40) — étoiles d'origine
      [20,10],[60,25],[110,8],[155,22],[185,12],[40,40],[130,35],
      // Zone médiane (y 45–80) — nouvelles
      [15,50],[75,55],[100,48],[145,62],[175,58],[35,72],[160,75],
      // Zone basse (y 82–115) — visibles par la fenêtre de la chambre
      [50,85],[90,92],[135,88],[170,98],[25,105],[120,112],[80,100],
    ].forEach(s => {
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
    if (g.props) {
      g.props.filter(pr => pr.actif && pr.type === 'ambiance' && (pr.env === envActif || !pr.env)).forEach(prop => {
        const def = getPropDef(prop.id);
        if (def && def.pixels) {
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
        }
      });
    }

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
if (D.g.props) {
  D.g.props.filter(pr => pr.actif && pr.type === 'decor' && (pr.slot === 'A' || pr.slot === 'B') && (pr.env === envActif || !pr.env)).forEach(prop => {
    const def = getPropDef(prop.id);
    if (def?.pixels) { const slot = PROP_SLOTS[prop.slot]; if (slot) drawProp(p, def, slot.x, slot.y); }
  });
}

// 5. Props Décor — SOL (devant le décor, DERRIÈRE le Gotchi) — filtrées par env
if (D.g.props) {
  D.g.props.filter(pr => pr.actif && pr.type === 'decor' && pr.slot === 'SOL' && (pr.env === envActif || !pr.env)).forEach(prop => {
    const def = getPropDef(prop.id);
    if (def?.pixels) { const slot = PROP_SLOTS['SOL']; if (slot) drawProp(p, def, slot.x, slot.y); }
  });
}

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
window._gotchiX = walkX; // ← exposition de la position réelle

const cx = walkX;
const by = g.stage==='egg'?115 : g.stage==='baby'?108 : g.stage==='teen'?98 : 85;
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
if (D.g.props) {
  D.g.props.filter(pr => pr.actif && pr.type === 'decor' && (pr.slot === 'C' || pr.slot === 'D') && (pr.env === envActif || !pr.env)).forEach(prop => {
    const def = getPropDef(prop.id);
    if (def?.pixels) { const slot = PROP_SLOTS[prop.slot]; if (slot) drawProp(p, def, slot.x, slot.y); }
  });
}

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

    // Surcouche nuit — couvre env, props, Gotchi ; épargne le HUD
    if (darkAlpha > 0) {
      p.noStroke();
      p.fill(0, 0, 0, darkAlpha);
      p.rect(0, 0, p.width, p.height);
    }

    // 12. HUD (Bandeau supérieur)
    // RÔLE : Bandeau translucide en haut du canvas avec 3 zones : pétales | actions | météo
    // POURQUOI : Répartition symétrique sur 200px — chaque zone a son espace dédié.
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

    // ── ZONE CENTRE : 3 icônes d'action réparties sur 200px ───────
    // Positions : 🧹 x=88  🛁 x=108  🍽️ x=128  (espacement de 20px)
    // POURQUOI : Les icônes sont centrées ensemble dans la zone entre pétales et météo.
    //            Chaque icône a une opacité qui indique si l'action est disponible ou non :
    //            - opaque (1.0) = action disponible / nécessaire
    //            - estompée (0.25) = rien à faire pour l'instant
    p.textSize(14);
    p.textAlign(p.CENTER, p.TOP);

    // 🧹 Balai : opaque si des crottes sont présentes
    const hasPoops = (window.D.g.poops || []).length > 0;
    p.drawingContext.globalAlpha = hasPoops ? 1.0 : 0.25;
    p.text('🧹', 88, 4);

    // 🛁 Bain : opaque si le Gotchi est sale (salete >= 5), estompé sinon
    // POURQUOI : Toujours visible pour que l'utilisatrice sache que ça existe,
    //            mais discret quand le Gotchi est propre.
    const salete = window.D?.g?.salete || 0;
    p.drawingContext.globalAlpha = salete >= 5 ? 1.0 : 0.25;
    p.text('🛁', 108, 4);

    // 🍽️ Assiette : opaque si un repas est disponible dans la fenêtre active
    const mealWin = (typeof getCurrentMealWindow === 'function') ? getCurrentMealWindow() : null;
    const meals   = (typeof ensureMealsToday === 'function') ? ensureMealsToday() : null;
    const mealAvailable = mealWin && meals && !meals[mealWin];
    p.drawingContext.globalAlpha = mealAvailable ? 1.0 : 0.25;
    p.text('🍽️', 128, 4);

    p.drawingContext.globalAlpha = 1.0;

    if (window._cleanPositions && window._cleanPositions.length) {
      window._cleanPositions.forEach(pos => {
        for (let i = 0; i < 6; i++) {
          spawnP(pos.x + (Math.random() - 0.5) * 20, pos.y + (Math.random() - 0.5) * 10, C.star);
        }
      });
      window._cleanPositions = null;
    }

    // 13. BADGES ÉNERGIE + BONHEUR (bas-gauche du canvas)
    // RÔLE : Affiche deux capsules compactes ⚡N et ✿N en bas à gauche,
    //        toujours visibles, cliquables pour ouvrir la modale d'état.
    // POURQUOI : Dessinés dans le canvas pour suivre le rétrécissement/agitation du tama.
    {
      const en = g.energy;
      const ha = g.happiness;
      const badgeY = CS - 18;       // position verticale : 18px du bas
      const badgeH = 13;            // hauteur de la capsule
      const badgeR = 3;             // rayon des coins arrondis
      const badgePadX = 4;          // padding interne horizontal

      p.noStroke();
      p.textStyle(p.NORMAL);
      p.textSize(9);

      // POURQUOI : largeur fixe identique pour les deux badges + icône/chiffre positionnés
      //            séparément avec gap fixe, pour que ⚡ et ✿ n'affectent pas l'alignement.
      const badgeW   = 30;           // largeur fixe identique pour les deux badges
      const iconW    = 10;           // zone réservée à l'icône
      const gap      = 3;            // espace fixe entre icône et chiffre
      const gap2     = 3;            // espace entre les deux badges
      // Centre vertical du badge — textAlign CENTER sur Y centre le texte dans la capsule
      // POURQUOI : p.CENTER sur Y + midY évite le décalage manuel qui variait selon textSize
      const midY     = badgeY - 1 + badgeH / 2;

      // ── Badge ⚡ (énergie) ──
      const enX = 4;
      p.fill(0, 0, 0, 50);          // même alpha que le bandeau HUD supérieur
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

    const now = Date.now();
    if (now - (window._lastTapTime || 0) < 200) return false;
    window._lastTapTime = now;

    const mx = p.touches[0]?.x ?? p.mouseX;
    const my = p.touches[0]?.y ?? p.mouseY;

    // 🧹 Balai (x=88) — nettoyer les crottes
    if (Math.abs(mx - 88) < 14 && my < 26) {
      setTimeout(() => cleanPoops(), 0); return false;
    }
    // 🛁 Bain (x=108) — tap = petit rappel si propre, rien si sale (le frottement fait le nettoyage)
    if (Math.abs(mx - 108) < 14 && my < 26) {
      if ((window.D?.g?.salete || 0) >= 5) {
        // Signal visuel : expression surprise pour indiquer "frotte-moi !"
        if (typeof window.triggerExpr === 'function') window.triggerExpr('surprise', 40);
      }
      return false;
    }
    // 🍽️ Assiette (x=128) — ouvrir le snack
    if (Math.abs(mx - 128) < 14 && my < 26) {
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

    const h = hr();
    // Position du Gotchi à l'écran = by + bobY (le bobY contient déjà GOTCHI_OFFSET_Y)
    // On recalcule donc by seul, SANS ajouter OFFSET_Y (il est déjà dans bobY côté rendu).
    // Puis on centre la hitbox sur le CORPS entier du Gotchi, pas juste la tête.
    const by = window.D.g.stage === 'egg'  ? 115
             : window.D.g.stage === 'baby' ? 108
             : window.D.g.stage === 'teen' ? 98
             :                               85;
    
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
    const by = window.D.g.stage === 'egg'  ? 115
             : window.D.g.stage === 'baby' ? 108
             : window.D.g.stage === 'teen' ? 98
             :                               85;
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
            addEvent({ type: 'soin', subtype: 'bain', valeur: 2, label: 'Bain donné — Gotchi tout propre ✿' });
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
