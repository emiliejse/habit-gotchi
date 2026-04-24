/* ============================================================
   render.js — Moteur p5.js : dessin pixel art, animations, Gotchi
   
   RÔLE : Ce fichier est le "pinceau". Il ne contient PAS de logique
   métier (XP, stats) — il se contente de LIRE window.D et de dessiner.
   
   DÉPENDANCES (doivent être chargées AVANT dans index.html) :
     - config.js  → GOTCHI_COLORS, ENV_THEMES (palettes par thème)
     - app.js     → window.D (données), window.PROPS_LIB, hr(),
                    window.meteoData, window.shakeTimer, window.celebQueue
     - envs.js    → drawActiveEnv() (chargé APRÈS render.js)
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
  const gc = GOTCHI_COLORS.find(x => x.id === id) || GOTCHI_COLORS[0];
  return { body: gc.body, bodyLt: gc.bodyLt, bodyDk: gc.bodyDk };
}

function getEnvC() {
  const id = window.D.g.envTheme || 'pastel';
  const et = ENV_THEMES.find(x => x.id === id) || ENV_THEMES[0];
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

  if (skyPhase === 'jour' && ha <= 40) {
    const blend = ha / 40;
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
    p.fill(p.color(255, 255, 200, Math.round(starAlpha)));
    [[20,10],[60,25],[110,8],[155,22],[185,12],[40,40],[130,35]].forEach(s => {
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
  const showClouds = ha > 40 && (
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


/* ─── SYSTÈME 1 : MÉTABOLISME & CYCLE DE VIE ────────────────────── */


// DITHERING : damier semi-transparent "état critique" style Gameboy
function drawDither(p, x, y, w, h, color) {
  const col = p.color(color);
  col.setAlpha(100);
  p.fill(col);
  p.noStroke();
  for (let row = 0; row < h; row += PX * 2) {
    for (let col2 = (row / PX % 2 === 0 ? 0 : PX); col2 < w; col2 += PX * 2) {
      px(p, x + col2, y + row, PX, PX);
    }
  }
}

function drawEgg(p, cx, cy) {
  const x = cx - PX * 3, y = cy; 
  p.noStroke();
  p.fill(C.egg); 
  px(p,x+PX*2,y,PX*3,PX); px(p,x+PX,y+PX,PX*5,PX); px(p,x,y+PX*2,PX*7,PX*3); px(p,x+PX,y+PX*5,PX*5,PX); px(p,x+PX*2,y+PX*6,PX*3,PX);
  p.fill(C.eggSp); px(p,x+PX*2,y+PX*2,PX,PX); px(p,x+PX*4,y+PX*3,PX*2,PX); px(p,x+PX*3,y+PX*5,PX,PX);
  const totalXp = window.D.g.totalXp;
if (totalXp > 45) {
  const intensity = totalXp >= 75 ? 2 : 1;
  const wobble = Math.sin(Date.now() * 0.015) * intensity;
  p.fill(C.eggCr);
  px(p, x + PX*3 + wobble, y + PX,   PX, PX);
  px(p, x + PX*4 + wobble, y + PX*2, PX, PX);
  px(p, x + PX*3 + wobble, y + PX*3, PX, PX);
}
  return { topY: y, eyeY: y + PX * 2, neckY: y + PX * 4 };
}

function drawBaby(p, cx, cy, sl, en, ha) {
    const x = cx - PX * 3, y = cy; p.noStroke();
    p.fill(C.body); px(p,x+PX,y,PX*4,PX); px(p,x,y+PX,PX*6,PX*3); px(p,x+PX,y+PX*4,PX*4,PX);
    p.fill(C.bodyLt); px(p,x+PX,y+PX,PX,PX); px(p,x+PX*2,y,PX,PX);
    
    if(sl || blink) { 
      p.fill(C.eye); px(p,x+PX,y+PX*2,PX*2,PX); px(p,x+PX*3,y+PX*2,PX*2,PX); 
    } else { 
      p.fill(C.eye); px(p,x+PX,y+PX*2,PX,PX); px(p,x+PX*4,y+PX*2,PX,PX); 
      p.fill('#fff'); p.rect(x+PX,y+PX*2,2,2); p.rect(x+PX*4,y+PX*2,2,2); 
    }
    
    p.fill(C.cheek); px(p,x,y+PX*3,PX,PX); px(p,x+PX*5,y+PX*3,PX,PX);
    if (window._gotchiNearPoop && !sl) {
      p.fill(C.eye); px(p, x+PX*2, y+PX*2, PX*2, PX); px(p, x+PX*5, y+PX*2, PX*2, PX);
    }
    
    p.fill(C.mouth);
    if(!sl) { 
      if(ha > 60) px(p,x+PX*2,y+PX*3,PX*2,PX); 
      else if(ha < 25) px(p,x+PX*2,y+PX*3+2,PX*2,PX); 
      else px(p,x+PX*2,y+PX*3,PX,PX); 
    }
    
    p.fill(C.bodyDk); px(p,x+PX,y+PX*5,PX,PX); px(p,x+PX*4,y+PX*5,PX,PX);
    if(en < 25 && !sl) { px(p,x+PX*2,y+PX*5,PX*2,PX); } 
    if (en < 10 && !sl) drawDither(p, x + PX, y + PX * 3, PX * 4, PX * 3, C.bodyDk);
    return { topY: y, eyeY: y + PX * 2, neckY: y + PX * 4 };
}

function drawTeen(p, cx, cy, sl, en, ha) {
    // ─── Respiration : étire légèrement la largeur (±1 pixel) ───
    const breath = getBreath(p);
    const breathX = sl ? 0 : Math.round(breath * 2 - 1);
    const x = cx - PX * 4 - breathX, y = cy;
    p.noStroke();

    /* ─── CORPS ROND FUSIONNÉ (8×8 PX) ─── */
    p.fill(C.body);
    px(p, x+PX*2, y,        PX*4, PX);      // arrondi haut
    px(p, x+PX,   y+PX,     PX*6, PX);
    px(p, x,      y+PX*2,   PX*8, PX*4);    // milieu large (visage+corps)
    px(p, x+PX,   y+PX*6,   PX*6, PX);
    px(p, x+PX*2, y+PX*7,   PX*4, PX);      // arrondi bas

    /* ─── HIGHLIGHTS ─── */
    p.fill(C.bodyLt);
    px(p, x+PX*2, y+PX,   PX*2, PX);
    px(p, x+PX,   y+PX*2, PX*2, PX);

    /* ─── OREILLES D'OURSON (demi-cercles) ─── */
p.fill(C.body);
// oreille gauche
px(p, x+PX,   y-PX,   PX*2, PX);   // base large
px(p, x+PX,   y-PX*2, PX*2, PX);   // milieu
px(p, x+PX*1+2, y-PX*3, PX, PX);   // sommet arrondi
// oreille droite (miroir)
px(p, x+PX*5, y-PX,   PX*2, PX);
px(p, x+PX*5, y-PX*2, PX*2, PX);
px(p, x+PX*5+2, y-PX*3, PX, PX);

// Intérieur d'oreille rose (creux)
p.fill(C.cheek);
px(p, x+PX+2,   y-PX,   PX, PX);
px(p, x+PX*5+2, y-PX,   PX, PX);

    /* ─── YEUX (grands, amande) ─── */
    const expr = window._expr;
    const isSurprise = expr.moodTimer > 0 && expr.lastMood === 'surprise';

    if (sl || blink) {
      p.fill(C.eye);
      px(p, x+PX,   y+PX*3, PX*2, PX);
      px(p, x+PX*5, y+PX*3, PX*2, PX);
    } else if (isSurprise) {
      // Yeux grands ouverts : carrés pleins
      p.fill(C.eye);
      px(p, x+PX,   y+PX*2, PX*2, PX*2);
      px(p, x+PX*5, y+PX*2, PX*2, PX*2);
      p.fill('#fff');
      p.rect(x+PX+1,   y+PX*2+1, 4, 4);
      p.rect(x+PX*5+1, y+PX*2+1, 4, 4);
    } else {
      p.fill(C.eye);
      px(p, x+PX,   y+PX*2, PX*2, PX);      // œil gauche haut large
      px(p, x+PX*2, y+PX*3, PX,   PX);      // œil gauche bas étroit
      px(p, x+PX*5, y+PX*2, PX*2, PX);      // œil droit miroir
      px(p, x+PX*5, y+PX*3, PX,   PX);
      p.fill('#fff');
      p.rect(x+PX+1,   y+PX*2+1, 4, 4);
      p.rect(x+PX*5+1, y+PX*2+1, 4, 4);
    }

    /* ─── POOP DISGUST ─── */
    if (window._gotchiNearPoop && !sl) {
      p.fill(C.eye);
      px(p, x+PX,   y+PX*2, PX*2, PX);
      px(p, x+PX*5, y+PX*2, PX*2, PX);
    }

    /* ─── JOUES ROSES (pulsantes, centrées) ─── */
    const pulse = getCheekPulse(p);
    p.fill(p.lerpColor(p.color(C.cheek), p.color('#e88098'), pulse));
    px(p, x+PX,   y+PX*4, PX, PX);
    px(p, x+PX*6, y+PX*4, PX, PX);

    // Joues débordantes si joie active
    if (expr.moodTimer > 0 && expr.lastMood === 'joie') {
      p.drawingContext.globalAlpha = 0.7;
      px(p, x,      y+PX*4, PX, PX);
      px(p, x+PX*7, y+PX*4, PX, PX);
      p.drawingContext.globalAlpha = 1.0;
    }

    /* ─── BOUCHE ─── */
    p.fill(C.mouth);
    if (!sl) {
      // Respiration bouche : descend de 0-2 px sur le cycle
      const mouthY = y + PX*5 + Math.round(breath * 2);

      if (expr.moodTimer > 0 && expr.lastMood === 'joie') {
        // Grand sourire : barre principale en bas, coins relevés
        px(p, x+PX*2, mouthY+PX, PX*4, PX);   // ligne principale
        px(p, x+PX,   mouthY,    PX,   PX);   // coin gauche relevé
        px(p, x+PX*6, mouthY,    PX,   PX);   // coin droit relevé
      } else if (expr.moodTimer > 0 && expr.lastMood === 'faim') {
        // Bouche baveuse (ouverte + goutte bleue)
        px(p, x+PX*3, mouthY, PX*2, PX*2);
        p.fill('#88c0e0');
        px(p, x+PX*3, mouthY+PX*2, PX, PX);
        p.fill(C.mouth);
      } else if (expr.moodTimer > 0 && expr.lastMood === 'surprise') {
        // Petit "o" de surprise
        px(p, x+PX*3, mouthY, PX*2, PX*2);
      } else {
        // Humeurs normales
        if      (ha > 70) { px(p,x+PX*3,mouthY,PX*2,PX); px(p,x+PX*2,mouthY,PX,PX); px(p,x+PX*5,mouthY,PX,PX); }
        else if (ha > 40)   px(p,x+PX*3,mouthY,PX*2,PX);
        else if (ha < 20)   px(p,x+PX*3,mouthY+2,PX*2,PX);
        else                px(p,x+PX*3,mouthY,PX,PX);
      }
    }

    /* ─── PETITS BRAS SUR LES CÔTÉS ─── */
    p.fill(C.bodyDk);
    if (en < 25 && !sl) {
      px(p, x-PX,   y+PX*5, PX, PX);        // bras tombés
      px(p, x+PX*8, y+PX*5, PX, PX);
    } else {
      px(p, x-PX,   y+PX*4, PX, PX*2);      // bras normaux
      px(p, x+PX*8, y+PX*4, PX, PX*2);
    }

    /* ─── PETITS PIEDS ─── */
    px(p, x+PX*2, y+PX*8, PX, PX);
    px(p, x+PX*5, y+PX*8, PX, PX);
    
    if (en < 10 && !sl) drawDither(p, x, y + PX * 4, PX * 8, PX * 5, C.bodyDk);
    return { topY: y, eyeY: y+PX*2, neckY: y+PX*5 };
}

function drawAdult(p, cx, cy, sl, en, ha) {
    // ─── Respiration : étire légèrement la largeur (±1 pixel) ───
    const breath = getBreath(p);
    const breathX = sl ? 0 : Math.round(breath * 2 - 1);
    const x = cx - PX * 5 - breathX, y = cy;
    p.noStroke();

    /* ─── CORPS ROND FUSIONNÉ (10×9 PX) ─── */
    p.fill(C.body);
    px(p, x+PX*3, y,        PX*4, PX);      // arrondi haut
    px(p, x+PX*2, y+PX,     PX*6, PX);
    px(p, x+PX,   y+PX*2,   PX*8, PX);
    px(p, x,      y+PX*3,   PX*10, PX*4);   // milieu très large
    px(p, x+PX,   y+PX*7,   PX*8, PX);
    px(p, x+PX*2, y+PX*8,   PX*6, PX);
    px(p, x+PX*3, y+PX*9,   PX*4, PX);      // arrondi bas

    /* ─── HIGHLIGHTS ─── */
    p.fill(C.bodyLt);
    px(p, x+PX*3, y+PX,   PX*2, PX);
    px(p, x+PX*2, y+PX*2, PX*2, PX);
    px(p, x+PX,   y+PX*3, PX*2, PX);

    /* ─── OREILLES D'OURSON (demi-cercles) ─── */
p.fill(C.body);
// oreille gauche
px(p, x+PX*2, y-PX,   PX*2, PX);   // base large
px(p, x+PX*2, y-PX*2, PX*2, PX);   // milieu
px(p, x+PX*2+2, y-PX*3, PX, PX);   // sommet arrondi
// oreille droite
px(p, x+PX*6, y-PX,   PX*2, PX);
px(p, x+PX*6, y-PX*2, PX*2, PX);
px(p, x+PX*6+2, y-PX*3, PX, PX);

// Intérieur d'oreille rose
p.fill(C.cheek);
px(p, x+PX*2+2, y-PX,   PX, PX);
px(p, x+PX*6+2, y-PX,   PX, PX);

    /* ─── YEUX (grands, amande) ─── */
    const expr = window._expr;
    const isSurprise = expr.moodTimer > 0 && expr.lastMood === 'surprise';
    
    if (sl || blink) {
      p.fill(C.eye);
      px(p, x+PX*2, y+PX*4, PX*3, PX);
      px(p, x+PX*6, y+PX*4, PX*3, PX);
    } else if (isSurprise) {
      // Yeux grands ouverts : carrés pleins
      p.fill(C.eye);
      px(p, x+PX*2, y+PX*3, PX*3, PX*2);
      px(p, x+PX*6, y+PX*3, PX*3, PX*2);
      p.fill('#fff');
      p.rect(x+PX*2+1, y+PX*3+1, 4, 4);
      p.rect(x+PX*6+1, y+PX*3+1, 4, 4);
    } else {
      p.fill(C.eye);
      px(p, x+PX*2, y+PX*3, PX*3, PX);      // œil gauche haut large
      px(p, x+PX*3, y+PX*4, PX*2, PX);      // œil gauche bas étroit
      px(p, x+PX*6, y+PX*3, PX*3, PX);      // œil droit miroir
      px(p, x+PX*6, y+PX*4, PX*2, PX);
      p.fill('#fff');
      p.rect(x+PX*2+1, y+PX*3+1, 4, 4);
      p.rect(x+PX*6+1, y+PX*3+1, 4, 4);
    }

    /* ─── POOP DISGUST ─── */
    if (window._gotchiNearPoop && !sl) {
      p.fill(C.eye);
      px(p, x+PX*2, y+PX*3, PX*3, PX);
      px(p, x+PX*6, y+PX*3, PX*3, PX);
    }

    /* ─── JOUES ROSES (pulsantes) ─── */
    const pulse = getCheekPulse(p);
    p.fill(p.lerpColor(p.color(C.cheek), p.color('#e88098'), pulse));
    px(p, x+PX*2, y+PX*6, PX, PX);
    px(p, x+PX*7, y+PX*6, PX, PX);
    
    // Joues débordantes si joie active
    if (expr.moodTimer > 0 && expr.lastMood === 'joie') {
      p.drawingContext.globalAlpha = 0.7;
      px(p, x+PX,   y+PX*6, PX, PX);
      px(p, x+PX*8, y+PX*6, PX, PX);
      p.drawingContext.globalAlpha = 1.0;
    }

    /* ─── BOUCHE ─── */
    p.fill(C.mouth);
    if (!sl) {
      // Respiration bouche : descend de 0-2 px sur le cycle
      const mouthY = y + PX*6 + Math.round(breath * 2);
      
      if (expr.moodTimer > 0 && expr.lastMood === 'joie') {
        // Grand sourire : barre principale en bas, coins relevés
        px(p, x+PX*3, mouthY+PX, PX*4, PX);   // ligne principale
        px(p, x+PX*2, mouthY,    PX,   PX);   // coin gauche relevé
        px(p, x+PX*7, mouthY,    PX,   PX);   // coin droit relevé
      } else if (expr.moodTimer > 0 && expr.lastMood === 'faim') {
        // Bouche baveuse (ouverte + goutte bleue)
        px(p, x+PX*4, mouthY, PX*2, PX*2);
        p.fill('#88c0e0');
        px(p, x+PX*4, mouthY+PX*2, PX, PX);
        p.fill(C.mouth);
      } else if (expr.moodTimer > 0 && expr.lastMood === 'surprise') {
        // Petit "o" de surprise
        px(p, x+PX*4, mouthY, PX*2, PX*2);
      } else {
        // Humeurs normales
        if      (ha > 80) { px(p,x+PX*3,mouthY+PX,PX*4,PX); px(p,x+PX*2,mouthY,PX,PX); px(p,x+PX*7,mouthY,PX,PX); }
        else if (ha > 50)   px(p,x+PX*4,mouthY,PX*2,PX);
        else if (ha < 20) { px(p,x+PX*4,mouthY+2,PX*2,PX); px(p,x+PX*3,mouthY,PX,PX); }
        else                px(p,x+PX*4,mouthY,PX,PX);
      }
    }

    /* ─── PETITS BRAS SUR LES CÔTÉS ─── */
    p.fill(C.bodyDk);
    if (en < 20 && !sl) {
      px(p, x-PX,    y+PX*6, PX, PX*2);     // bras tombés
      px(p, x+PX*10, y+PX*6, PX, PX*2);
    } else if (ha > 85 && !sl) {
      px(p, x-PX,    y+PX*3, PX, PX*2);     // bras levés (joie)
      px(p, x+PX*10, y+PX*3, PX, PX*2);
      px(p, x-PX*2,  y+PX*2, PX, PX);
      px(p, x+PX*11, y+PX*2, PX, PX);
    } else {
      px(p, x-PX,    y+PX*5, PX, PX*2);     // bras normaux
      px(p, x+PX*10, y+PX*5, PX, PX*2);
    }

    /* ─── PETITS PIEDS ─── */
    px(p, x+PX*3, y+PX*10, PX*2, PX);
    px(p, x+PX*6, y+PX*10, PX*2, PX);
    if (en < 10 && !sl) drawDither(p, x + PX, y + PX * 5, PX * 8, PX * 5, C.bodyDk);
    return { topY: y, eyeY: y+PX*3, neckY: y+PX*6 };
}

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

    const en = g.energy * 20, ha = g.happiness * 20;
    const n = (h >= 21 || h < 6);

    const sol = window.getSolarPhase ? window.getSolarPhase() : { phase: 'jour', t: 0 };
    const darkAlpha = sol.phase === 'nuit'       ? 100
                    : sol.phase === 'aube'        ? Math.round(100 * (1 - sol.t))
                    : sol.phase === 'crepuscule'  ? Math.round(100 * sol.t)
                    : 0;

// 1. Fond et Météo
    drawSky(p, h, ha);
    if (window.meteoData && window.meteoData.windspeed > 30) drawWind(p);

    const estJour = h < 19;
    // Nuit (21h–6h) → chambre systématiquement, quelle que soit la préférence stockée
    let envActif = n ? 'chambre' : (g.activeEnv || 'parc');
    if (!sleeping) {
      if (ha < 40)                    drawRain(p, ha);
      else if (ha === 40)             drawRain(p, 35);
      else if (ha === 80 && estJour)  drawSun(p);
      else if (ha >= 100 && estJour)  drawRainbow(p);
    }
    if (ha < 40) drawRain(p, ha);
    else if (ha === 40) drawRain(p, 35);

    drawActiveEnv(p, envActif, n, h);

    // 2. Props Ambiance
    if (g.props) {
      g.props.filter(pr => pr.actif && pr.type === 'ambiance').forEach(prop => {
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

    // 3. Gestion des Cacas
    const poops = window.D.g.poops || [];
    let gotchiNearPoop = false;
    poops.forEach(poop => {
      if (Math.abs(poop.x - walkX) < 25) gotchiNearPoop = true;
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(20);
      p.text('💩', poop.x, poop.y);
    });
    window._gotchiNearPoop = gotchiNearPoop;

    // 4. Props Décor — Fond (A, B)
if (D.g.props) {
  D.g.props.filter(pr => pr.actif && pr.type === 'decor' && (pr.slot === 'A' || pr.slot === 'B')).forEach(prop => {
    const def = getPropDef(prop.id);
    if (def?.pixels) { const slot = PROP_SLOTS[prop.slot]; if (slot) drawProp(p, def, slot.x, slot.y); }
  });
}

// 5. Props Décor — SOL (devant le décor, DERRIÈRE le Gotchi)
if (D.g.props) {
  D.g.props.filter(pr => pr.actif && pr.type === 'decor' && pr.slot === 'SOL').forEach(prop => {
    const def = getPropDef(prop.id);
    if (def?.pixels) { const slot = PROP_SLOTS['SOL']; if (slot) drawProp(p, def, slot.x, slot.y); }
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
if (!sleeping && ha >= 80 && en >= 80) {
  amplitude = 40; vitesse = 0.06;
  if (p.frameCount % 20 < 10) bobY -= PX;
} else if (!sleeping && ha >= 60 && en >= 60) {
  amplitude = 25; vitesse = 0.04;
}

const XMIN = 35, XMAX = CS - 35;

if (!sleeping) {
  walkStep++;
  const speed = (ha >= 80 && en >= 80) ? 1.4
              : (ha >= 50 && en >= 60) ? 0.7
              : (en >= 40) ? 0.35
              : 0.12;

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
const tilt = (!sleeping && en < 40) ? Math.sin(p.frameCount * 0.05) * 2 : 0;

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


// Après le bloc de dessin du gotchi, recalcule gotchiInfo en statique
const staticInfo = {
  topY:  drawY,
  eyeY:  drawY + (D.g.stage === 'adult' ? PX*3 : PX*2),
  neckY: drawY + (D.g.stage === 'teen' ? PX*5 : D.g.stage === 'adult' ? PX*6 : PX*4),
};

// 8. Props Accessoire (Sur le Gotchi)
if (D.g.props) {
  D.g.props.filter(pr => pr.actif && pr.type === 'accessoire').forEach(prop => {
    const def = getPropDef(prop.id);
    if (def && def.pixels) {
      const ps = def.pxSize || PX;
      const accX = drawX - Math.floor(def.pixels[0].length * ps / 2);
      const baseY = def.ancrage === 'yeux' ? staticInfo.eyeY
            : def.ancrage === 'cou'  ? staticInfo.neckY
            : staticInfo.topY;
      const offsetY = def.ancrage === 'yeux' ? (D.g.stage === 'teen' ? ps * 3 : ps * 2)
                    : def.ancrage === 'cou'  ? (D.g.stage === 'baby' ? ps * 3 : ps * 5)
                    : ps;
      const accY = baseY - def.pixels.length * ps + offsetY;
      drawProp(p, def, accX, accY);
    }
  });
}

    p.pop();

    const wc = window.meteoData?.weathercode;
    if (wc === 45 || wc === 48) drawFog(p);

    // 9. Props Décor — Premier plan (C, D) — DEVANT le Gotchi
if (D.g.props) {
  D.g.props.filter(pr => pr.actif && pr.type === 'decor' && (pr.slot === 'C' || pr.slot === 'D')).forEach(prop => {
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
    p.noStroke();
    p.textStyle(p.NORMAL);
    p.fill(0, 0, 0, 50);
    p.rect(0, 0, CS, 26);

    p.fill(255);
    p.textSize(11);
    p.textAlign(p.LEFT, p.TOP);
    p.text('🌸 ' + (g.petales || 0), 6, 7);

    if (window.meteoData?.temperature) {
  const wc = window.meteoData?.weathercode;
  const wind = window.meteoData?.windspeed || 0;
  let hudMeteo = Math.round(window.meteoData.temperature) + '°C';
  if (wc === 45 || wc === 48) hudMeteo += ' 😶‍🌫️';
  if (wind > 20) hudMeteo += ' 🌬️';
  p.textSize(hudMeteo.length > 9 ? 9 : 11); // ← réduit si texte long
  p.textAlign(p.RIGHT, p.TOP);
  p.text(hudMeteo, CS - 6, 7);
  p.textSize(11); // ← remet la taille normale
}
    const hasPoops = (window.D.g.poops || []).length > 0;
    p.textSize(16);
    p.textAlign(p.CENTER, p.TOP);
    p.drawingContext.globalAlpha = hasPoops ? 1.0 : 0.3;
    p.text('🧹', 72, 5);

    // Fonction today() est supposée déclarée dans app.js
    const snackDone = window.D.g.snackDone === today();
    p.drawingContext.globalAlpha = snackDone ? 0.35 : 1.0;
    p.text('🍽️', 128, 5);
    p.drawingContext.globalAlpha = 1.0;

    if (window._cleanPositions && window._cleanPositions.length) {
      window._cleanPositions.forEach(pos => {
        for (let i = 0; i < 6; i++) {
          spawnP(pos.x + (Math.random() - 0.5) * 20, pos.y + (Math.random() - 0.5) * 10, C.star);
        }
      });
      window._cleanPositions = null;
    }
  }; // ← fin p.draw()

  // 13. Gestionnaire d'événements tactiles (Garde l'accès à "p.")
    p.touchStarted = function() {
    // 🔒 GARDE 1 : menu principal ouvert
    const menuOverlay = document.getElementById('menu-overlay');
    if (menuOverlay && menuOverlay.classList.contains('open')) return true;

    // 🔒 GARDE 2 : une modale est présente dans le DOM (alertes, boutique, etc.)
    const modalEl = document.getElementById('modal');
    if (modalEl && getComputedStyle(modalEl).display !== 'none') return true;

    // 🔒 GARDE 3 : l'utilisateur est focus sur un champ de saisie
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      return true;
    }
    const rect = p.canvas.getBoundingClientRect();
    const touch = p.touches[0] || { x: p.mouseX, y: p.mouseY };
    const clientX = (typeof TouchEvent !== 'undefined' && window.event instanceof TouchEvent) ? window.event.touches[0]?.clientX : null;
    const clientY = (typeof TouchEvent !== 'undefined' && window.event instanceof TouchEvent) ? window.event.touches[0]?.clientY : null;

    if (clientX !== null && clientY !== null) {
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top  || clientY > rect.bottom) {
        return true; 
      }
    }

    const now = Date.now();
    if (now - (window._lastTapTime || 0) < 200) return false;
    window._lastTapTime = now;

    const mx = p.touches[0]?.x ?? p.mouseX;
    const my = p.touches[0]?.y ?? p.mouseY;

    if (Math.abs(mx - 72) < 14 && my < 26) { 
      setTimeout(() => cleanPoops(), 0); return false; 
    }
    if (Math.abs(mx - 128) < 14 && my < 26) { 
      setTimeout(() => ouvrirSnack(), 0); return false; 
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
}; // ← fin p5s

// DÉMARRAGE DE L'INSTANCE P5
new p5(p5s);