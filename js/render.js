/* ============================================================
   render.js — Moteur p5.js : dessin pixel art, animations, Gotchi
   
   RÔLE : Ce fichier est le "pinceau". Il ne contient PAS de logique
   métier (XP, stats) — il se contente de LIRE window.D et de dessiner.
   
   DÉPENDANCES (doivent être chargées AVANT dans index.html) :
     - config.js  → GOTCHI_COLORS, ENV_THEMES (palettes par thème)
     - app.js     → window.D (données), window.PROPS_LIB, hr(),
                    window.meteoData, window.shakeTimer, window.celebQueue
     - envs.js    → drawActiveEnv() (chargé APRÈS render.js)
   
   ORDRE DE DESSIN dans p.draw() — comme des calques Photoshop :
     1. Ciel          drawSky()         ← fond, toujours en premier
     2. Vent          drawWind()        ← si vent fort (météo)
     3. Arc-en-ciel   drawRainbow()     ← si bonheur = 100%
     4. Environnement drawActiveEnv()   ← parc / chambre / montagne
     5. Props décor fond  (slots A, B)  ← derrière le Gotchi
     6. Props ambiance    (drift/fall…) ← effets flottants
     7. Gotchi        draw*()           ← personnage principal
     8. Props accessoire  (sur la tête) ← devant le Gotchi
     9. Props décor sol   (slots C,D,SOL)
    10. Particules    updateParts()     ← confettis de célébration
    11. HUD           pétales + météo   ← interface, toujours au-dessus
   ============================================================ */

/* ============================================================
   PALETTE COULEURS
   ============================================================ */
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

/* ============================================================
   CONSTANTES RENDER
   ============================================================ */
const PX = 5, CS = 200;
let bounceT = 0, blinkT = 0, blink = false;
let particles = [];

// Trouve la définition pixel d'un prop (catalogue ou généré par IA)
function getPropDef(id) {
  return (window.PROPS_LIB || []).find(l => l.id === id)
      || (window.D.propsPixels && window.D.propsPixels[id]);
}

// ── PROP_SLOTS : les 5 emplacements fixes pour les props décor ──
// Imagine le canvas (200×200) comme une scène de théâtre vue de face.
// Chaque slot est un point d'ancrage (coin supérieur gauche du prop).
//
//   A (38, 108)  → fond gauche  : derrière le Gotchi, niveau "taille"
//   B (132, 108) → fond droit   : idem, côté droit
//   C (28, 140)  → sol gauche   : devant, au premier plan
//   D (148, 140) → sol droit    : devant, côté droit
//   SOL (88, 152)→ sol centre   : juste devant le Gotchi
//
// A et B sont dessinés AVANT le Gotchi (donc derrière lui).
// C, D et SOL sont dessinés APRÈS (donc devant lui).
//
// POUR DÉPLACER UN SLOT : change x et/ou y ici.
// ⚠️ y=120 = ligne de sol. Au-dessus = fond, en-dessous = sol visible.
const PROP_SLOTS = {
  A:   { x: 38,  y: 108 },  // fond gauche
  B:   { x: 132, y: 108 },  // fond droit
  C:   { x: 28,  y: 140 },  // sol gauche
  D:   { x: 148, y: 140 },  // sol droit
  SOL: { x: 88,  y: 152 },  // sol centre
};

/* ============================================================
   HELPERS COULEURS PERSONNALISÉES
   ============================================================ */
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

/* ============================================================
   MOTEUR p5.js
   ============================================================ */
   // Variables de locomotion du Gotchi
window.touchReactions = []; // tableau de réactions simultanées
window.eatAnim = { active: false, timer: 0, emoji: '' };
let walkX = 100;        // Position X courante
let walkDir = 1;        // Direction : 1 = droite, -1 = gauche
let walkStep = 0;       // Compteur pour l'animation de pas

const p5s = (p) => {
  p.setup = function() {
    p.createCanvas(CS, CS).parent('cbox');
    p.noSmooth();
    p.frameRate(12);
  };

  p.draw = function() {
    if (!window.D) return;
const g = window.D.g, h = hr(), sleeping = (h >= 22 || h < 7);

    // Applique les couleurs personnalisées
    const gc = getGotchiC();
    C.body = gc.body; C.bodyLt = gc.bodyLt; C.bodyDk = gc.bodyDk;
    const ec = getEnvC();
    C.gnd = ec.gnd; C.gndDk = ec.gndDk; C.skyD1 = ec.sky1; C.skyD2 = ec.sky2;

    const en = g.energy * 20, ha = g.happiness * 20;
    const n = (h >= 21 || h < 6);

    if (window.shakeTimer > 0) { window.shakeTimer--; p.translate(Math.sin(p.frameCount * 2) * 2, 0); }


    // ── drawSky() : le ciel change selon l'HEURE (h) et le BONHEUR (ha) ──
// LOGIQUE : comme un filtre couleur qui s'applique sur tout le fond.
//
// Pour modifier une couleur de ciel, change la valeur dans C{} en haut
// du fichier (ex: C.skyD1 pour le bleu du jour).
//
// Tableau de décision :
//   ha ≤ 20 + jour (7h–21h)  → gris (C.skyGray1/2)   ← Gotchi triste
//   h 7–17                   → bleu jour (skyD1/D2)
//   h 17–20                  → rose couchant (skyK1/K2)
//   h 20–5                   → nuit (skyN1/N2) + étoiles
//   h 5–7                    → aube (skyA1/A2)
//
// POUR AJOUTER UNE CONDITION : copie un bloc if/else if existant
// et change la condition + les variables c1/c2.
// Le dégradé est fait par la boucle for (lerpColor = mélange deux couleurs).

    drawSky(p, h, ha);

    if (window.meteoData && window.meteoData.windspeed > 30) drawWind(p);

    let envActif = g.activeEnv || 'parc';
    if (ha >= 100 && !sleeping) drawRainbow(p);
    drawActiveEnv(p, envActif, n, h);


// --- Ambiances ---
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

    // --- Cacas ---
    const poops = window.D.g.poops || [];
    let gotchiNearPoop = false;
    poops.forEach(poop => {
      if (Math.abs(poop.x - walkX) < 25) gotchiNearPoop = true;
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(20);
      p.text('💩', poop.x, poop.y);
    });
    window._gotchiNearPoop = gotchiNearPoop;

// --- Props DÉCOR fond (A, B) ---
    if (D.g.props) {
      D.g.props.filter(pr => pr.actif && pr.type === 'decor' && (pr.slot === 'A' || pr.slot === 'B')).forEach(prop => {
        const def = getPropDef(prop.id);
        if (def && def.pixels) {
          const slot = PROP_SLOTS[prop.slot];
          if (!slot) return;
          drawProp(p, def, slot.x, slot.y);
        }
      });
    }

    // --- Locomotion ---
    bounceT += sleeping ? 0.04 : 0.12;
    let bobY = sleeping ? Math.sin(bounceT) : Math.sin(bounceT)*3;
    // Saut snack : appliqué directement sur bobY
if (window.eatAnim?.active) {
  const progress = 1 - (window.eatAnim.timer / 50);
  if (progress > 0.7 && !window.eatAnim.jumped) {
    window.eatAnim.jumped = true;
  }
  if (window.eatAnim.jumped) {
    const t = 1 - (window.eatAnim.timer / (50 * 0.15)); // 0→1 sur les 15 derniers %
    bobY -= Math.sin(t * Math.PI) * 18; // arc de saut
  }
}
    let amplitude = 15, vitesse = 0.02;
    if (!sleeping && ha >= 80 && en >= 80) {
      amplitude = 40; vitesse = 0.06;
      if (p.frameCount % 20 < 10) bobY -= PX;
    } else if (!sleeping && ha >= 60 && en >= 60) {
      amplitude = 25; vitesse = 0.04;
    }
    if (!sleeping) {
      walkStep++;
      const speed = (ha >= 80 && en >= 80) ? 1.2 : (ha >= 50) ? 0.6 : 0.3;
      walkX += walkDir * speed;
      if (walkX > CS - 25) { walkX = CS - 25; walkDir = -1; }
      if (walkX < 25)       { walkX = 25;      walkDir = 1;  }
    } else {
      walkX += walkDir * 0.05;
      if (walkX > CS - 30 || walkX < 30) walkDir *= -1;
    }
    const cx = walkX;
    const by = g.stage==='egg'?115 : g.stage==='baby'?108 : g.stage==='teen'?98 : 85;
    
    // --- Props DÉCOR devant (C, D, SOL) ---
    if (D.g.props) {
      D.g.props.filter(pr => pr.actif && pr.type === 'decor' && pr.slot !== 'A' && pr.slot !== 'B').forEach(prop => {
        const def = getPropDef(prop.id);
        if (def && def.pixels) {
          const slot = PROP_SLOTS[prop.slot];
          if (!slot) return;
          drawProp(p, def, slot.x, slot.y);
        }
      });
    }

    // --- Dessin Gotchi ---
    let gotchiInfo;
    if      (g.stage === 'egg')   gotchiInfo = drawEgg(p, cx, by + bobY);
    else if (g.stage === 'baby')  gotchiInfo = drawBaby(p, cx, by + bobY, sleeping, en, ha);
    else if (g.stage === 'teen')  gotchiInfo = drawTeen(p, cx, by + bobY, sleeping, en, ha);
    else                          gotchiInfo = drawAdult(p, cx, by + bobY, sleeping, en, ha);
    if (sleeping && g.stage !== 'egg') drawZzz(p, cx + 16, by - 10);

    // --- Props ACCESSOIRE ---
    if (D.g.props) {
      D.g.props.filter(pr => pr.actif && pr.type === 'accessoire').forEach(prop => {
        const def = getPropDef(prop.id);
        if (def && def.pixels) {
          const accX = cx - Math.floor(def.pixels[0].length / 2) * PX;
          const baseY = def.ancrage==='yeux' ? gotchiInfo.eyeY
                      : def.ancrage==='cou'  ? gotchiInfo.neckY
                      : gotchiInfo.topY;
          const offsetY = def.ancrage==='yeux' ? PX*2
                        : def.ancrage==='cou'  ? PX*3
                        : PX;
          const accY = baseY - def.pixels.length * PX + offsetY;
          drawProp(p, def, accX, accY);
        }
      });
    }

// --- Réactions au toucher ---
    p.drawingContext.globalAlpha = 1.0; // ← ajoute cette ligne
    window.touchReactions = (window.touchReactions || []).filter(tr => tr.timer > 0);
    window.touchReactions.forEach(tr => {
      const progress = 1 - (tr.timer / 35); // 0→1
      const fy = (by - 15) - progress * 45; // monte plus haut
      const fx = tr.cx + Math.sin(progress * Math.PI * 3) * 10;

      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(16);
      // Opacité : plein pendant 70% du trajet, puis s'estompe
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

    // --- Animation snack ---
    if (window.eatAnim?.active) {
      const ea = window.eatAnim;
      const progress = 1 - (ea.timer / 50); // 0→1
      // Part du haut du canvas, descend vers la bouche du Gotchi
      const fy = 20 + progress * (by - 30);
      const fx = cx;
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(20);
      p.drawingContext.globalAlpha = 1.0;
p.text(ea.emoji, fx, fy);
            // Saut quand la friandise arrive près de la bouche
      if (progress > 0.7 && !ea.jumped) {
        triggerTouchReaction(false);
        ea.jumped = true;
      }
      ea.timer--;
      if (ea.timer <= 0) ea.active = false;
    }

    // --- Clignement ---
    blinkT++;
    if (blinkT > 45 + Math.random() * 35) {
      blink = true;
      if (blinkT > 49 + Math.random() * 4) { blink = false; blinkT = 0; }
    }

    // --- Célébration ---
    while (window.celebQueue.length) {
      window.celebQueue.shift();
      for (let i = 0; i < 15; i++) {
        spawnP(cx + (Math.random() - .5) * 40, by - 10, C.rainbow[Math.floor(Math.random() * C.rainbow.length)]);
      }
      bounceT = Math.PI * 1.5;
    }

// --- HUD ---
    p.noStroke();
    p.textStyle(p.NORMAL);

    // Bande semi-transparente sur toute la largeur
    p.fill(0, 0, 0, 50);
    p.rect(0, 0, CS, 26);

    // Pétales (gauche)
    p.fill(255);
    p.textSize(11);
    p.textAlign(p.LEFT, p.TOP);
    p.text('🌸 ' + (g.petales || 0), 6, 6);

    // Température (droite)
    if (window.meteoData?.temperature) {
      p.textAlign(p.RIGHT, p.TOP);
      p.text(Math.round(window.meteoData.temperature) + '°C', CS - 6, 6);
    }

    // Balai — opaque si cacas, sinon discret
    const hasPoops = (window.D.g.poops || []).length > 0;
    p.textSize(16);
    p.textAlign(p.CENTER, p.TOP);
    p.drawingContext.globalAlpha = hasPoops ? 1.0 : 0.3;
    p.text('🧹', 72, 3);

    const snackDone = window.D.g.snackDone === today();
p.drawingContext.globalAlpha = snackDone ? 0.35 : 1.0;
p.text('🍽️', 128, 3);
p.drawingContext.globalAlpha = 1.0;

    // Remet l'alpha à 1 pour le reste
    p.drawingContext.globalAlpha = 1.0;
// --- Animation nettoyage ---
    if (window._cleanPositions && window._cleanPositions.length) {
      window._cleanPositions.forEach(pos => {
        for (let i = 0; i < 6; i++) {
          spawnP(
            pos.x + (Math.random() - 0.5) * 20,
            pos.y + (Math.random() - 0.5) * 10,
            C.star
          );
        }
      });
      window._cleanPositions = null;
    }
  }; // ← fin p.draw()

  function drawSky(p, h, ha) {
    p.noStroke(); let c1, c2;
    if(ha<=20&&h>=7&&h<21)     { c1=C.skyGray1; c2=C.skyGray2; }
    else if(h>=7&&h<17)        { c1=C.skyD1;    c2=C.skyD2;    }
    else if(h>=17&&h<20)       { c1=C.skyK1;    c2=C.skyK2;    }
    else if(h>=20||h<5)        { c1=C.skyN1;    c2=C.skyN2;    }
    else                       { c1=C.skyA1;    c2=C.skyA2;    }
    for(let y=0;y<120;y+=PX) { p.fill(p.lerpColor(p.color(c1),p.color(c2),y/120)); p.rect(0,y,CS,PX); }
    if(h>=20||h<6) { p.fill(C.star); [[20,10],[60,25],[110,8],[155,22],[185,12],[40,40],[130,35]].forEach(s=>{if((p.frameCount+s[0])%35<25)px(p,s[0],s[1],PX,PX)}); }
    if(h>=6&&h<21&&ha>20) { drawCl(p,40+Math.sin(p.frameCount*.014)*8,20); drawCl(p,150+Math.cos(p.frameCount*.011)*6,35); }
    if(ha<=20&&h>=7&&h<21) { p.fill('#8888a0'); for(let i=0;i<5;i++){const rx=((p.frameCount*3+i*40)%CS);const ry=((p.frameCount*4+i*30)%80)+40;px(p,rx,ry,PX,PX*2);} }
  }

  function drawCl(p,x,y) { p.fill(C.cloud); p.rect(x,y,PX*5,PX*2); p.rect(x+PX,y-PX,PX*3,PX); }

  function drawZzz(p, x, y) {
    for(let i=0; i<3; i++) {
      const fy = y - i*15 - (p.frameCount%50)*0.4;
      const fx = x + i*10 + Math.sin(p.frameCount*.1+i)*3;
      const sz = PX;
      p.fill(p.color(176, 144, 208, 200-i*50));
      px(p,fx, fy, sz*4, sz);
      px(p,fx+sz*2, fy+sz, sz, sz);
      px(p,fx+sz, fy+sz*2, sz, sz);
      px(p,fx, fy+sz*3, sz*4, sz);
    }
  }

  // ── drawProp() : dessine un objet pixel art depuis ses données JSON ──
// Un prop = un objet avec deux tableaux :
//   prop.pixels  → grille 2D d'indices : [[0,1,2,1,0], [0,2,2,2,0], ...]
//                  0 = transparent (skippé), 1/2/3... = index dans palette
//   prop.palette → tableau de couleurs hex : ['', '#e8a0a0', '#c87060', ...]
//                  index 0 est toujours vide (= transparent)
//
// EXEMPLE : si pixels[2][3] = 2, on dessine prop.palette[2] en position
//   x = offsetX + 3*PX, y = offsetY + 2*PX
//
// POUR MODIFIER UN PROP EXISTANT :
//   → Couleur : change la valeur hex dans prop.palette[N] dans props.json
//   → Forme : change un indice dans prop.pixels (0 = efface, N = recolore)
//
// offsetX, offsetY → coin supérieur gauche où commence le dessin
//   (pour les décors : vient de PROP_SLOTS ; pour les ambiances : calculé dynamiquement)

  function drawProp(p, prop, offsetX, offsetY) {
    if (!prop.pixels || !prop.palette) return;
    p.noStroke();
    for(let row=0; row<prop.pixels.length; row++) {
      for(let col=0; col<prop.pixels[row].length; col++) {
        const ci = prop.pixels[row][col];
        if(ci === 0) continue;
        p.fill(prop.palette[ci]);
        px(p,offsetX + col*PX, offsetY + row*PX, PX, PX);
      }
    }
  }

  function spawnP(x, y, c) {
    particles.push({x, y, vx:(Math.random()-.5)*4, vy:-Math.random()*3-1.5, life:16, c});
  }

function updateParts(p) {
    p.noStroke();
    particles = particles.filter(pt => {
      pt.x+=pt.vx; pt.y+=pt.vy; pt.vy+=.12; pt.life--;
      const a = Math.floor(pt.life / 16 * 255);
      const col = p.color(pt.c);
      col.setAlpha(a);
      p.fill(col);
      px(p,pt.x, pt.y, PX, PX);
      return pt.life > 0;
    });
  }

  p.touchStarted = function() {
    // ── GARDE : laisser passer les taps qui sont HORS du canvas ──
  // Le canvas fait 200×200 dans #cbox. Si le tap tombe en dehors
  // (= sur un input HTML), on ne bloque pas l'événement.
  const rect = p.canvas.getBoundingClientRect();
  const touch = p.touches[0] || { x: p.mouseX, y: p.mouseY };
  const clientX = (typeof TouchEvent !== 'undefined' && window.event instanceof TouchEvent)
    ? window.event.touches[0]?.clientX 
    : null;
  const clientY = (typeof TouchEvent !== 'undefined' && window.event instanceof TouchEvent)
    ? window.event.touches[0]?.clientY 
    : null;

  // Si on a les coordonnées écran et qu'elles sont hors du canvas → laisser passer
  if (clientX !== null && clientY !== null) {
    if (clientX < rect.left || clientX > rect.right || 
        clientY < rect.top  || clientY > rect.bottom) {
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
    const by = window.D.g.stage==='egg'?115 : window.D.g.stage==='baby'?108 
             : window.D.g.stage==='teen'?98 : 85;
    const hit = Math.abs(mx - walkX) < 22 && Math.abs(my - (by - 10)) < 28;
    if (hit) {
      window._lastTapX = walkX + (Math.random() - 0.5) * 20;
      triggerTouchReaction(h >= 22 || h < 7);
      return false;
    }
  };

}; // fin p5s

function drawEgg(p, cx, cy) {
  const x=cx-PX*3, y=cy; p.noStroke();
  p.fill(C.egg); px(p,x+PX*2,y,PX*3,PX); px(p,x+PX,y+PX,PX*5,PX); px(p,x,y+PX*2,PX*7,PX*3); px(p,x+PX,y+PX*5,PX*5,PX); px(p,x+PX*2,y+PX*6,PX*3,PX);
  p.fill(C.eggSp); px(p,x+PX*2,y+PX*2,PX,PX); px(p,x+PX*4,y+PX*3,PX*2,PX); px(p,x+PX*3,y+PX*5,PX,PX);
  if(window.D.g.totalXp>30) { p.fill(C.eggCr); px(p,x+PX*3,y+PX,PX,PX); px(p,x+PX*4,y+PX*2,PX,PX); px(p,x+PX*3,y+PX*3,PX,PX); }
  return { topY: y, eyeY: y+PX*2, neckY: y+PX*4 };
}

// ── Sprites Gotchi : baby / teen / adult ────────────────────
// PARAMÈTRES communs :
//   cx, cy  → centre bas du sprite (position X locomotion + bobY)
//   sl      → sleeping : true = yeux fermés, bouche absente
//   en      → énergie (0–5) : < 25 = bras tombants / jambes fatiguées
//   ha      → bonheur (0–5) : pilote l'expression de la bouche
//
// LIRE UN SPRITE :
//   Chaque px(p, x+PX*N, y+PX*M, PX*L, PX*H) est un rectangle de pixels.
//   x et y sont les coins supérieur-gauche du sprite.
//   Pense à une grille millimétrique :
//     PX*0 = colonne 0, PX*1 = colonne 1, PX*2 = colonne 2…
//   Pour visualiser, dessine la grille sur papier quadrillé.
//
// MODIFIER LE CORPS :
//   → Couleur : change C.body, C.bodyLt, C.bodyDk dans la palette C{}
//     (en haut de render.js) — s'applique à TOUS les stades.
//   → Forme : modifie les coordonnées px() du bloc `p.fill(C.body)`
//
// MODIFIER L'EXPRESSION :
//   → Bouche : trouve le bloc `p.fill(C.mouth)` + ses conditions ha > X
//     Exemple baby : ha>60 = sourire, ha<25 = grimace, sinon neutre.
//   → Yeux ouverts : bloc `else { p.fill(C.eye)... p.fill('#fff')... }`
//   → Yeux fermés (nuit/blink) : bloc `if(sl||blink) { p.fill(C.eye)... }`
//
// VALEUR DE RETOUR : { topY, eyeY, neckY }
//   → Utilisé pour positionner les accessoires (chapeau = topY, lunettes = eyeY)

  function drawBaby(p, cx, cy, sl, en, ha) {
    const x=cx-PX*3, y=cy; p.noStroke();
    p.fill(C.body); px(p,x+PX,y,PX*4,PX); px(p,x,y+PX,PX*6,PX*3); px(p,x+PX,y+PX*4,PX*4,PX);
    p.fill(C.bodyLt); px(p,x+PX,y+PX,PX,PX); px(p,x+PX*2,y,PX,PX);
    if(sl||blink) { p.fill(C.eye); px(p,x+PX,y+PX*2,PX*2,PX); px(p,x+PX*3,y+PX*2,PX*2,PX); }
    else { p.fill(C.eye); px(p,x+PX,y+PX*2,PX,PX); px(p,x+PX*4,y+PX*2,PX,PX); p.fill('#fff'); p.rect(x+PX,y+PX*2,2,2); p.rect(x+PX*4,y+PX*2,2,2); }
    p.fill(C.cheek); px(p,x,y+PX*3,PX,PX); px(p,x+PX*5,y+PX*3,PX,PX);
    // Sourcils froncés si caca proche
if (window._gotchiNearPoop && !sl) {
  p.fill(C.eye);
  px(p, x+PX*2, y+PX*2, PX*2, PX);
  px(p, x+PX*5, y+PX*2, PX*2, PX);
}
    p.fill(C.mouth);
    if(!sl) { if(ha>60)px(p,x+PX*2,y+PX*3,PX*2,PX); else if(ha<25)px(p,x+PX*2,y+PX*3+2,PX*2,PX); else px(p,x+PX*2,y+PX*3,PX,PX); }
    p.fill(C.bodyDk); px(p,x+PX,y+PX*5,PX,PX); px(p,x+PX*4,y+PX*5,PX,PX);
    if(en<25&&!sl) { px(p,x+PX*2,y+PX*5,PX*2,PX); }
     return { topY: y, eyeY: y+PX*2, neckY: y+PX*4 };
  }

  function drawTeen(p, cx, cy, sl, en, ha) {
    const x=cx-PX*4, y=cy; p.noStroke();
    p.fill(C.body); px(p,x+PX*2,y,PX*4,PX); px(p,x+PX,y+PX,PX*6,PX); px(p,x,y+PX*2,PX*8,PX*4); px(p,x+PX,y+PX*6,PX*6,PX*2); px(p,x+PX*2,y+PX*8,PX*4,PX);
    p.fill(C.bodyLt); px(p,x+PX*2,y+PX,PX*2,PX); px(p,x+PX,y+PX*2,PX*2,PX);
    if(sl||blink) { p.fill(C.eye); px(p,x+PX*2,y+PX*3,PX*2,PX); px(p,x+PX*4,y+PX*3,PX*2,PX); }
    else { p.fill(C.eye); px(p,x+PX*2,y+PX*3,PX,PX*2); px(p,x+PX*5,y+PX*3,PX,PX*2); p.fill('#fff'); p.rect(x+PX*2,y+PX*3,2,2); p.rect(x+PX*5,y+PX*3,2,2); }
    p.fill(C.cheek); px(p,x+PX,y+PX*5,PX,PX); px(p,x+PX*6,y+PX*5,PX,PX);
    // Sourcils froncés si caca proche
if (window._gotchiNearPoop && !sl) {
  p.fill(C.eye);
  px(p, x+PX*2, y+PX*2, PX*2, PX);
  px(p, x+PX*5, y+PX*2, PX*2, PX);
}
    p.fill(C.mouth);
    if(!sl) { if(ha>70){px(p,x+PX*3,y+PX*5,PX*2,PX);px(p,x+PX*2,y+PX*5,PX,PX);px(p,x+PX*5,y+PX*5,PX,PX);} else if(ha>40)px(p,x+PX*3,y+PX*5,PX*2,PX); else if(ha<20)px(p,x+PX*3,y+PX*6,PX*2,PX); else px(p,x+PX*3,y+PX*5,PX,PX); }
    p.fill(C.bodyDk);
    if(en<25&&!sl){px(p,x-PX,y+PX*4,PX,PX);px(p,x+PX*8,y+PX*4,PX,PX);}else{px(p,x-PX,y+PX*3,PX,PX*2);px(p,x+PX*8,y+PX*3,PX,PX*2);}
    px(p,x+PX*2,y+PX*9,PX*2,PX); px(p,x+PX*5,y+PX*9,PX*2,PX);
     return { topY: y, eyeY: y+PX*3, neckY: y+PX*6 };
  }

  function drawAdult(p, cx, cy, sl, en, ha) {
    const x=cx-PX*5, y=cy; p.noStroke();
    p.fill(C.body); px(p,x+PX*3,y,PX*4,PX); px(p,x+PX*2,y+PX,PX*6,PX); px(p,x+PX,y+PX*2,PX*8,PX);
    px(p,x,y+PX*3,PX*10,PX*4); px(p,x+PX,y+PX*7,PX*8,PX*2); px(p,x+PX*2,y+PX*9,PX*6,PX); px(p,x+PX*3,y+PX*10,PX*4,PX);
    p.fill(C.bodyLt); px(p,x+PX*3,y+PX,PX*2,PX); px(p,x+PX*2,y+PX*2,PX*2,PX); px(p,x+PX,y+PX*3,PX*2,PX);
    if(sl||blink) { p.fill(C.eye); px(p,x+PX*2,y+PX*5,PX*2,PX); px(p,x+PX*6,y+PX*5,PX*2,PX); }
    else { p.fill(C.eye); px(p,x+PX*2,y+PX*4,PX*2,PX*2); px(p,x+PX*6,y+PX*4,PX*2,PX*2); p.fill('#fff'); px(p,x+PX*2,y+PX*4,PX,PX); px(p,x+PX*6,y+PX*4,PX,PX); }
    p.fill(C.cheek); px(p,x+PX,y+PX*6,PX,PX); px(p,x+PX*8,y+PX*6,PX,PX);
    // Sourcils froncés si caca proche
if (window._gotchiNearPoop && !sl) {
  p.fill(C.eye);
  px(p, x+PX*2, y+PX*2, PX*2, PX);
  px(p, x+PX*5, y+PX*2, PX*2, PX);
}
    p.fill(C.mouth);
    if(!sl) { if(ha>80){px(p,x+PX*3,y+PX*7,PX*4,PX);px(p,x+PX*3,y+PX*6,PX,PX);px(p,x+PX*6,y+PX*6,PX,PX);} else if(ha>50)px(p,x+PX*4,y+PX*7,PX*2,PX); else if(ha<20){px(p,x+PX*4,y+PX*8,PX*2,PX);px(p,x+PX*3,y+PX*7,PX,PX);} else px(p,x+PX*4,y+PX*7,PX,PX); }
    p.fill(C.bodyDk);
    if(en<20&&!sl){px(p,x-PX,y+PX*5,PX,PX*3);px(p,x+PX*10,y+PX*5,PX,PX*3);}
    else if(ha>85&&!sl){px(p,x-PX,y+PX*2,PX,PX*2);px(p,x+PX*10,y+PX*2,PX,PX*2);px(p,x-PX*2,y+PX,PX,PX);px(p,x+PX*11,y+PX,PX,PX);}
    else{px(p,x-PX,y+PX*4,PX,PX*3);px(p,x+PX*10,y+PX*4,PX,PX*3);}
    px(p,x+PX*2,y+PX*11,PX*2,PX); px(p,x+PX*6,y+PX*11,PX*2,PX);
    if(en<25&&!sl) px(p,x+PX*3,y+PX*11,PX,PX);
     return { topY: y, eyeY: y+PX*4, neckY: y+PX*7 };
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
  animEl(document.querySelector('.tama-screen'), sleeping ? 'shakeX' : 'rubberBand', 400);
}


new p5(p5s);
