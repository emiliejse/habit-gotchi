/* ============================================================
   render.js — Moteur p5.js, dessin, animations
   Dépend de : app.js (window.D, window.PROPS_LIB, window.GOTCHI_COLORS,
               window.ENV_THEMES, window.meteoData, window.shakeTimer,
               window.celebQueue, hr())
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

// Slots fixes pour les props décor
const PROP_SLOTS = {
  A:   { x: 38,  y: 108  },  // fond gauche
  B:   { x: 132, y: 108  },  // fond droit
  C:   { x: 32,  y: 138 },  // sol gauche
  D:   { x: 138, y: 138 },  // sol droit
  SOL: { x: 90,  y: 148 },  // sol centre
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
let walkX = 100;        // Position X courante
let walkDir = 1;        // Direction : 1 = droite, -1 = gauche
let walkSpeed = 0.4;    // Vitesse de base (pixels par frame)
let walkStep = 0;       // Compteur pour l'animation de pas

const p5s = (p) => {
  p.setup = function() {
    p.createCanvas(CS, CS).parent('cbox');
    p.noSmooth();
    p.frameRate(12);
  };

  p.draw = function() {
    const g = window.D.g, h = hr(), sleeping = (h >= 22 || h < 7);

    // Applique les couleurs personnalisées
    const gc = getGotchiC();
    C.body = gc.body; C.bodyLt = gc.bodyLt; C.bodyDk = gc.bodyDk;
    const ec = getEnvC();
    C.gnd = ec.gnd; C.gndDk = ec.gndDk; C.skyD1 = ec.sky1; C.skyD2 = ec.sky2;

    const en = g.energy * 20, ha = g.happiness * 20;
    const n = (h >= 21 || h < 6);

    if (window.shakeTimer > 0) { window.shakeTimer--; p.translate(Math.sin(p.frameCount * 2) * 2, 0); }

    drawSky(p, h, ha);

    // Ciel thématique désert
    if ((window.D.g.envTheme || 'pastel') === 'desert' && h >= 7 && h < 20) {
      for (let y = 0; y < 120; y += PX) {
        p.fill(p.lerpColor(p.color('#f0b850'), p.color('#f8d888'), y / 120));
        p.rect(0, y, CS, PX);
      }
      return;
    }

    if (window.meteoData && window.meteoData.windspeed > 30) drawWind(p);

    let envActif = g.activeEnv || 'parc';
    drawActiveEnv(p, envActif, n, h);

// --- Props DÉCOR fond (A, B) — dessinés EN PREMIER = derrière ---
if (D.g.props) {
  D.g.props.filter(pr => pr.actif && pr.type === 'decor' && (pr.slot === 'A' || pr.slot === 'B')).forEach(prop => {
    const def = (window.PROPS_LIB || []).find(l => l.id === prop.id)
             || (D.propsPixels || []).find(l => l.id === prop.id);
    if (def && def.pixels) {
      const slot = PROP_SLOTS[prop.slot] || PROP_SLOTS[def.slot] || PROP_SLOTS['SOL'];
      drawProp(p, def, slot.x, slot.y);
    }
  });
}
// --- Props DÉCOR devant (C, D, SOL) — dessinés EN DERNIER = devant ---
if (D.g.props) {
  D.g.props.filter(pr => pr.actif && pr.type === 'decor' && pr.slot !== 'A' && pr.slot !== 'B').forEach(prop => {
    const def = (window.PROPS_LIB || []).find(l => l.id === prop.id)
             || (D.propsPixels || []).find(l => l.id === prop.id);
    if (def && def.pixels) {
      const slot = PROP_SLOTS[prop.slot] || PROP_SLOTS[def.slot] || PROP_SLOTS['SOL'];
      drawProp(p, def, slot.x, slot.y);
    }
  });
}
    // --- Ambiances ---
    if (g.props) {
      g.props.filter(pr => pr.actif && pr.type === 'ambiance').forEach(prop => {
        const def = (window.PROPS_LIB || []).find(l => l.id === prop.id)
                 || (window.D.propsPixels || []).find(l => l.id === prop.id);
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
    // --- Gotchi ---
    bounceT += sleeping ? 0.04 : 0.12;
    if (!sleeping) walkStep++;
    const walkBob = sleeping ? 0 : Math.sin(walkStep * 0.4) * 2;
let bobY = (sleeping ? Math.sin(bounceT) : Math.sin(bounceT)*3) + walkBob;
    let amplitude = 15, vitesse = 0.02;

    if (!sleeping && ha >= 80 && en >= 80) {
      amplitude = 40; vitesse = 0.06;
      if (p.frameCount % 20 < 10) bobY -= PX;
    } else if (!sleeping && ha >= 60 && en >= 60) {
      amplitude = 25; vitesse = 0.04;
    }

// --- Locomotion directionnelle ---
if (!sleeping) {
  walkStep++;
  const speed = (ha >= 80 && en >= 80) ? 1.2 : (ha >= 50) ? 0.6 : 0.3;
  walkX += walkDir * speed;
  
  // Demi-tour aux bords (marge de 20px)
  if (walkX > CS - 25) { walkX = CS - 25; walkDir = -1; }
  if (walkX < 25)       { walkX = 25;      walkDir = 1;  }
} else {
  // En dormant : légère dérive lente
  walkX += walkDir * 0.05;
  if (walkX > CS - 30 || walkX < 30) walkDir *= -1;
}
const cx = walkX;
    const by = g.stage==='egg'?115 : g.stage==='baby'?108 : g.stage==='teen'?98 : 85;

let gotchiInfo;
if      (g.stage === 'egg')   gotchiInfo = drawEgg(p, cx, by + bobY);
else if (g.stage === 'baby')  gotchiInfo = drawBaby(p, cx, by + bobY, sleeping, en, ha);
else if (g.stage === 'teen')  gotchiInfo = drawTeen(p, cx, by + bobY, sleeping, en, ha);
else                          gotchiInfo = drawAdult(p, cx, by + bobY, sleeping, en, ha);

// --- Props ACCESSOIRE (sur la tête du gotchi) ---
if (D.g.props) {
  D.g.props.filter(pr => pr.actif && pr.type === 'accessoire').forEach(prop => {
    const def = (window.PROPS_LIB || []).find(l => l.id === prop.id) || (D.propsPixels || []).find(l => l.id === prop.id);
    if (def && def.pixels) {
      const accX = cx - Math.floor(def.pixels[0].length / 2) * PX;
      
      // ✨ Ancrage dynamique selon le type d'accessoire
      const baseY = def.ancrage==='yeux' ? gotchiInfo.eyeY
                  : def.ancrage==='cou'  ? gotchiInfo.neckY
                  : gotchiInfo.topY;
      const offsetY = def.ancrage==='yeux' ? PX*2
              : def.ancrage==='cou'  ? PX*3
              : PX; // tete
const accY = baseY - def.pixels.length * PX + offsetY;
      
      drawProp(p, def, accX, accY);
    }
  });
}

    if (sleeping && g.stage !== 'egg') drawZzz(p, cx + 16, by - 10);
    if (ha >= 100 && !sleeping) drawRainbow(p);

    updateParts(p);

    // --- Pétales (coin sup. gauche) ---
    p.fill(255); p.noStroke();
    p.textSize(12); p.textFont('Courier New');
    p.textAlign(p.LEFT, p.TOP);
    p.text('🌸 ' + (g.petales || 0), 6, 8);

    // --- Météo (coin sup. droit) ---
    if (window.meteoData && window.meteoData.temperature) {
      p.fill(255); p.noStroke();
      p.textSize(12); p.textFont('Courier New');
      p.textAlign(p.RIGHT, p.TOP);
      p.text(Math.round(window.meteoData.temperature) + '°C', CS - 8, 8);
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
  };

  /* ---- Helpers internes p5s ---- */

  function px(x, y, w, h) {
    p.rect(Math.floor(x/PX)*PX, Math.floor(y/PX)*PX, Math.max(PX,Math.floor(w/PX)*PX), Math.max(PX,Math.floor(h/PX)*PX));
  }

  function drawActiveEnv(p, env, n, h) {
    const theme = window.D.g.envTheme || 'pastel';
    p.noStroke();

    if (env === 'parc') {
      if (theme === 'automne') {
        p.fill('#c89858'); p.rect(0, 120, CS, 80);
        p.fill('#a87838'); p.rect(0, 120, CS, PX*2);
        p.fill('#e07828'); px(20,132,PX,PX); px(60,128,PX,PX); px(140,130,PX,PX); px(175,126,PX,PX);
        p.fill('#d05818'); px(35,130,PX,PX); px(95,125,PX,PX); px(160,132,PX,PX);
        drawTreeTheme(p, 8, 86, n, '#c04818', '#e06028', '#8b4513');
        drawTreeTheme(p, 160, 90, n, '#d05020', '#e87838', '#8b4513');
        const ft = p.frameCount;
        p.fill('#e07828');
        px((ft*2+10)%CS, 60+Math.sin(ft*.1)*20, PX, PX);
        px((ft*2+70)%CS, 40+Math.sin(ft*.12)*25, PX, PX);
        p.fill('#d05818');
        px((ft*2+130)%CS, 55+Math.sin(ft*.09)*18, PX, PX);
      }
      else if (theme === 'hiver') {
        p.fill('#e8f0f8'); p.rect(0, 120, CS, 80);
        p.fill('#c8d8e8'); p.rect(0, 120, CS, PX*2);
        drawTreeTheme(p, 8, 86, n, '#e8f0f8', '#d8e8f0', '#806050');
        drawTreeTheme(p, 160, 90, n, '#e8f0f8', '#d8e8f0', '#806050');
        const ft = p.frameCount;
        p.fill('#e0eef8');
        [[15,20],[55,10],[95,35],[145,18],[175,28],[30,50],[120,45],[165,55]].forEach((s,i) => {
          const fy = ((ft + s[1]*3 + i*20) % 120);
          const fx = s[0] + Math.sin(ft*.05 + i)*5;
          px(fx, fy, PX, PX);
        });
      }
      else if (theme === 'desert') {
        p.fill('#e8d098'); p.rect(0, 120, CS, 80);
        p.fill('#c8a858'); p.rect(0, 120, CS, PX*2);
        p.fill('#d8c080');
        px(0, 122, PX*8, PX*2); px(140, 124, PX*10, PX*2);
        drawCactus(p, 18, 90);
        drawCactus(p, 168, 94);
        p.fill('#c0a050'); px(70,136,PX*2,PX); px(110,130,PX,PX); px(150,138,PX*2,PX);
      }
      else {
        p.fill(n ? C.gndN : C.gnd); p.rect(0, 120, CS, 80);
        p.fill(n ? '#305028' : C.gndDk); p.rect(0, 120, CS, PX*2);
        if (!n) { drawFl(p, 14, 126, C.flPk); drawFl(p, 186, 128, C.flYl); }
        drawTree(p, 8, 86, n); drawTree(p, 160, 90, n);
      }
    }

// ============================================================
// CHAMBRE — 4 thèmes : automne / hiver / desert / pastel
// Structure identique pour chaque thème :
//   1. Mur
//   2. Fenêtre (ciel animé + cadre + croisillons + rebord)
//   3. Rideaux + tringle
//   4. Plinthe
//   5. Cadre mural (motif unique par thème)
//   6. Sol parquet
//   7. Tapis
//   8. Bureau (pieds → plateau → lampe)
// ============================================================
else if (env === 'chambre') {

if (theme === 'automne') {

  // 1. MUR — bois chaud
  p.fill('#c0956a'); p.rect(0, 60, CS, 60);

  // 2. FENÊTRE — ciel doré automne (ou nuit)
  let skyA = (h>=20||h<6) ? C.skyN1 : '#e8c068';
  p.fill(skyA); p.rect(20, 68, 42, 42);         // vitre
  p.fill('#a07848');                              // couleur cadre bois foncé
  p.rect(18, 66, 46, 3); p.rect(18, 107, 46, 3); // bords haut/bas
  p.rect(18, 66, 3, 44); p.rect(62, 66, 3, 44);  // bords gauche/droite
  p.rect(40, 68, 3, 42); p.rect(20, 88, 42, 3);  // croisillons
  p.fill('#b08858'); p.rect(16, 108, 50, PX);     // rebord fenêtre

  // 3. RIDEAUX — orange automne
  p.fill('#d07030'); p.rect(10, 63, 12, 52);      // rideau gauche
  p.fill('#b05820'); p.rect(14, 63, 3, 52); p.rect(20, 63, 2, 52); // plis gauche
  p.fill('#d07030'); p.rect(62, 63, 12, 52);      // rideau droit
  p.fill('#b05820'); p.rect(65, 63, 3, 52); p.rect(70, 63, 2, 52); // plis droit
  p.fill('#906040'); p.rect(8, 62, 68, 3);         // tringle

  // 4. PLINTHE — séparation mur/sol
  p.fill('#a07848'); p.rect(0, 118, CS, PX);

// 5. CADRE MURAL — feuille simplifiée
  p.fill('#a07848'); p.rect(88, 68, 28, 28);      // cadre extérieur
  p.fill('#f0e8d8'); p.rect(91, 71, 22, 22);      // fond
  p.fill('#e08830'); px(94, 73, PX*3, PX*5);      // corps gauche de la feuille
  p.fill('#d07020'); px(99, 71, PX*3, PX*5);      // corps droit
  p.fill('#c86028'); px(100, 76, PX, PX*4);       // tige centrale

  // 6. SOL PARQUET — teinte bois chaud
  p.fill('#a07848'); p.rect(0, 120, CS, 80);
  p.fill('#886030');
  for (let ly = 130; ly < 200; ly += 13) { p.rect(0, ly, CS, 1); } // lames horizontales

  // 7. TAPIS — bordeaux
  p.fill('#6a2030'); p.rect(18, 138, 164, 62);    // bordure tapis
  p.fill('#8a3040'); p.rect(22, 141, 156, 59);    // centre tapis

  // 8. BUREAU
  let bxA = 138;                                   // position x du bureau
  p.fill('#906040');                               // couleur pieds
  p.rect(bxA+4, 108, PX, 18); p.rect(bxA+46, 108, PX, 18); // pieds (dessinés avant le plateau)
  p.fill('#c09060'); p.rect(bxA, 100, 58, PX*2); // plateau dessus
  p.fill('#a07040'); p.rect(bxA, 108, 58, PX);   // ombre sous le plateau
  p.fill('#f0d870'); px(bxA+38, 90, PX, PX*2);   // tige de la lampe
  p.fill('#e8b830'); px(bxA+33, 88, PX*3, PX);   // abat-jour

}
else if (theme === 'hiver') {

  // 1. MUR — bleu glacier
  p.fill('#b8cce0'); p.rect(0, 60, CS, 60);

  // 2. FENÊTRE — ciel hivernal (ou nuit)
  let skyH = (h>=20||h<6) ? C.skyN1 : '#c8d8e8';
  p.fill(skyH); p.rect(20, 68, 42, 42);           // vitre
  p.fill('#8899aa');                               // couleur cadre gris bleuté
  p.rect(18, 66, 46, 3); p.rect(18, 107, 46, 3);
  p.rect(18, 66, 3, 44); p.rect(62, 66, 3, 44);
  p.rect(40, 68, 3, 42); p.rect(20, 88, 42, 3);
  p.fill('#e8f4ff'); p.rect(16, 108, 50, PX);     // rebord enneigé

  // 3. RIDEAUX — blanc neige
  p.fill('#e8f0f8'); p.rect(10, 63, 12, 52);      // rideau gauche
  p.fill('#c8d8e8'); p.rect(14, 63, 3, 52); p.rect(20, 63, 2, 52); // plis gauche
  p.fill('#e8f0f8'); p.rect(62, 63, 12, 52);      // rideau droit
  p.fill('#c8d8e8'); p.rect(65, 63, 3, 52); p.rect(70, 63, 2, 52); // plis droit
  p.fill('#a0b0c0'); p.rect(8, 62, 68, 3);         // tringle

  // 4. PLINTHE
  p.fill('#a0b8cc'); p.rect(0, 118, CS, PX);

// 5. CADRE MURAL — flocon croix simple
  p.fill('#8899aa'); p.rect(88, 68, 28, 28);      // cadre extérieur
  p.fill('#eef4ff'); p.rect(91, 71, 22, 22);      // fond
  p.fill('#a8c0d8');
  px(100, 72, PX, PX*8);                          // barre verticale
  px(95, 77, PX*11, PX);                          // barre horizontale
  px(96, 73, PX, PX); px(104, 73, PX, PX);       // pointes diagonales haut
  px(96, 79, PX, PX); px(104, 79, PX, PX);       // pointes diagonales bas

  // 6. SOL — gris bleuté hivernal
  p.fill('#d0dce8'); p.rect(0, 120, CS, 80);
  p.fill('#b0bcc8');
  for (let ly = 130; ly < 200; ly += 13) { p.rect(0, ly, CS, 1); }

  // 7. TAPIS — bleu nuit
  p.fill('#203050'); p.rect(18, 138, 164, 62);    // bordure
  p.fill('#304060'); p.rect(22, 141, 156, 59);    // centre

  // 8. BUREAU
  let bxH = 138;
  p.fill('#8090a0');
  p.rect(bxH+4, 108, PX, 18); p.rect(bxH+46, 108, PX, 18); // pieds
  p.fill('#a8b8c8'); p.rect(bxH, 100, 58, PX*2); // plateau
  p.fill('#8898a8'); p.rect(bxH, 108, 58, PX);   // ombre plateau
  p.fill('#f0f0d0'); px(bxH+38, 90, PX, PX*2);   // tige lampe
  p.fill('#e0e0a0'); px(bxH+33, 88, PX*3, PX);   // abat-jour

}
else if (theme === 'desert') {

  // 1. MUR — adobe beige
  p.fill('#d4b48c'); p.rect(0, 60, CS, 60);

  // 2. FENÊTRE — ciel ocre désert (ou nuit)
  let skyD = (h>=20||h<6) ? C.skyN1 : '#f0c878';
  p.fill(skyD); p.rect(20, 68, 42, 42);           // vitre
  p.fill('#b08c60');                               // couleur cadre sable foncé
  p.rect(18, 66, 46, 3); p.rect(18, 107, 46, 3);
  p.rect(18, 66, 3, 44); p.rect(62, 66, 3, 44);
  p.rect(40, 68, 3, 42); p.rect(20, 88, 42, 3);
  p.fill('#c8a070'); p.rect(16, 108, 50, PX);     // rebord

  // 3. RIDEAUX — sable
  p.fill('#e0c888'); p.rect(10, 63, 12, 52);      // rideau gauche
  p.fill('#c0a860'); p.rect(14, 63, 3, 52); p.rect(20, 63, 2, 52); // plis gauche
  p.fill('#e0c888'); p.rect(62, 63, 12, 52);      // rideau droit
  p.fill('#c0a860'); p.rect(65, 63, 3, 52); p.rect(70, 63, 2, 52); // plis droit
  p.fill('#a88848'); p.rect(8, 62, 68, 3);         // tringle

  // 4. PLINTHE
  p.fill('#b89060'); p.rect(0, 118, CS, PX);

// 5. CADRE MURAL — losange géométrique
  p.fill('#b08c60'); p.rect(88, 68, 28, 28);      // cadre extérieur
  p.fill('#fdf0d0'); p.rect(91, 71, 22, 22);      // fond
  p.fill('#e8a020');
  px(100, 72, PX, PX);                            // sommet
  px(98, 74, PX*3, PX);                           // rang 2
  px(96, 76, PX*5, PX);                           // rang 3 (milieu)
  px(98, 78, PX*3, PX);                           // rang 4
  px(100, 80, PX, PX);                            // bas
  p.fill('#f0c030');
  px(100, 74, PX, PX); px(100, 78, PX, PX);      // détails intérieurs

  // 6. SOL — terre sable
  p.fill('#c8a870'); p.rect(0, 120, CS, 80);
  p.fill('#a88850');
  for (let ly = 130; ly < 200; ly += 13) { p.rect(0, ly, CS, 1); }

  // 7. TAPIS — terracotta
  p.fill('#8a3820'); p.rect(18, 138, 164, 62);    // bordure
  p.fill('#a84830'); p.rect(22, 141, 156, 59);    // centre

  // 8. BUREAU
  let bxD = 138;
  p.fill('#a07840');
  p.rect(bxD+4, 108, PX, 18); p.rect(bxD+46, 108, PX, 18); // pieds
  p.fill('#c8a060'); p.rect(bxD, 100, 58, PX*2); // plateau
  p.fill('#a88040'); p.rect(bxD, 108, 58, PX);   // ombre plateau
  p.fill('#f8e060'); px(bxD+38, 90, PX, PX*2);   // tige lampe
  p.fill('#f0c820'); px(bxD+33, 88, PX*3, PX);   // abat-jour

}
else {
  // ---- THÈME PASTEL (défaut) ----

  // 1. MUR — gris lilas doux (s'assombrit la nuit)
  p.fill(n ? '#a090a8' : C.wallIn); p.rect(0, 60, CS, 60);

  // 2. FENÊTRE — ciel qui suit vraiment l'heure
  let skyP = (h>=20||h<6) ? C.skyN1 : (h>=17) ? C.skyK1 : (h>=7) ? C.skyD1 : C.skyA1;
  p.fill(skyP); p.rect(20, 68, 42, 42);           // vitre
  p.fill(n ? '#706060' : '#c8baa8');              // cadre (plus sombre la nuit)
  p.rect(18, 66, 46, 3); p.rect(18, 107, 46, 3);
  p.rect(18, 66, 3, 44); p.rect(62, 66, 3, 44);
  p.rect(40, 68, 3, 42); p.rect(20, 88, 42, 3);  // croisillons
  p.fill(n ? '#807070' : '#d8c8b8'); p.rect(16, 108, 50, PX); // rebord

  // 3. RIDEAUX — lilas pastel
  let rideauP   = n ? '#705878' : '#c8a8d8';
  let rideauDkP = n ? '#504060' : '#a888c0';
  p.fill(rideauP);   p.rect(10, 63, 12, 52);
  p.fill(rideauDkP); p.rect(14, 63, 3, 52); p.rect(20, 63, 2, 52); // plis gauche
  p.fill(rideauP);   p.rect(62, 63, 12, 52);
  p.fill(rideauDkP); p.rect(65, 63, 3, 52); p.rect(70, 63, 2, 52); // plis droit
  p.fill(n ? '#907080' : '#b8a090'); p.rect(8, 62, 68, 3); // tringle

  // 4. PLINTHE
  p.fill(n ? '#705868' : '#d0c0b0'); p.rect(0, 118, CS, PX);

  // 5. CADRE MURAL — motif géométrique abstrait
  p.fill(n ? '#706060' : '#c8a880'); p.rect(88, 68, 28, 28);  // cadre extérieur
  p.fill(n ? '#504050' : '#f0ece4'); p.rect(91, 71, 22, 22);  // fond
  p.fill(n ? '#907080' : '#c8a8d0');
  px(96, 76, PX*2, PX*2);   // carré haut gauche
  px(104, 84, PX*2, PX*2);  // carré bas droite
  p.fill(n ? '#708090' : '#a8c8d0');
  px(104, 76, PX, PX*3);    // ligne verticale
  px(96, 84, PX*3, PX);     // ligne horizontale

  // 6. SOL PARQUET
  p.fill(n ? '#807080' : C.floorIn); p.rect(0, 120, CS, 80);
  p.fill(n ? '#706070' : '#b8a898');
  for (let ly = 130; ly < 200; ly += 13) { p.rect(0, ly, CS, 1); } // lames

  // 7. TAPIS — lilas
  p.fill(n ? '#504060' : '#c0a8e8'); p.rect(18, 138, 164, 62); // bordure
  p.fill(n ? '#605070' : C.rug);     p.rect(22, 141, 156, 59); // centre

  // 8. BUREAU
  let bxP = 138;
  p.fill(n ? '#806868' : '#b89870');
  p.rect(bxP+4, 108, PX, 18); p.rect(bxP+46, 108, PX, 18);   // pieds
  p.fill(n ? '#907878' : '#c8a880'); p.rect(bxP, 100, 58, PX*2); // plateau
  p.fill(n ? '#706060' : '#a88860'); p.rect(bxP, 108, 58, PX);   // ombre plateau
  p.fill(n ? '#f0d870' : '#f0e898'); px(bxP+38, 90, PX, PX*2);   // tige lampe
  p.fill(n ? '#e8b830' : '#f8d858'); px(bxP+33, 88, PX*3, PX);   // abat-jour
}
}
    else if (env === 'montagne') {
      if (theme === 'automne') {
        p.fill('#b07840'); p.rect(0, 120, CS, 80);
        p.fill('#906028'); p.rect(0, 120, CS, PX*2);
        p.fill('#c09050'); p.triangle(40, 120, 100, 50, 160, 120);
        p.fill('#e8c878'); p.triangle(100, 50, 83, 70, 117, 70);
      }
      else if (theme === 'hiver') {
        p.fill('#c8d8e8'); p.rect(0, 120, CS, 80);
        p.fill('#a8b8c8'); p.rect(0, 120, CS, PX*2);
        p.fill('#d8e0e8'); p.triangle(40, 120, 100, 50, 160, 120);
        p.fill('#f0f8ff'); p.triangle(100, 50, 83, 70, 117, 70);
      }
      else if (theme === 'desert') {
        p.fill('#d4a850'); p.rect(0, 120, CS, 80);
        p.fill('#b88830'); p.rect(0, 120, CS, PX*2);
        p.fill('#e8c870'); p.triangle(40, 120, 100, 55, 160, 120);
        p.fill('#f0d890'); p.triangle(100, 55, 88, 75, 112, 75);
        p.fill('#c8a840');
        px(88, 95, 24, PX); px(76, 108, 48, PX);
      }
      else {
        p.fill(n ? '#404858' : C.mnt1); p.rect(0, 120, CS, 80);
        p.fill(n ? '#202838' : C.mnt2); p.rect(0, 120, CS, PX*2);
        p.fill(n ? '#505868' : '#b0b8c8'); p.triangle(40, 120, 100, 50, 160, 120);
        p.fill(n ? '#c0c0d0' : C.snow); p.triangle(100, 50, 83, 70, 117, 70);
      }
    }
  }

  function drawSky(p, h, ha) {
    p.noStroke(); let c1, c2;
    if(ha<=20&&h>=7&&h<21)     { c1=C.skyGray1; c2=C.skyGray2; }
    else if(h>=7&&h<17)        { c1=C.skyD1;    c2=C.skyD2;    }
    else if(h>=17&&h<20)       { c1=C.skyK1;    c2=C.skyK2;    }
    else if(h>=20||h<5)        { c1=C.skyN1;    c2=C.skyN2;    }
    else                       { c1=C.skyA1;    c2=C.skyA2;    }
    for(let y=0;y<120;y+=PX) { p.fill(p.lerpColor(p.color(c1),p.color(c2),y/120)); p.rect(0,y,CS,PX); }
    if(h>=20||h<6) { p.fill(C.star); [[20,10],[60,25],[110,8],[155,22],[185,12],[40,40],[130,35]].forEach(s=>{if((p.frameCount+s[0])%35<25)px(s[0],s[1],PX,PX)}); }
    if(h>=6&&h<21&&ha>20) { drawCl(p,40+Math.sin(p.frameCount*.014)*8,20); drawCl(p,150+Math.cos(p.frameCount*.011)*6,35); }
    if(ha<=20&&h>=7&&h<21) { p.fill('#8888a0'); for(let i=0;i<5;i++){const rx=((p.frameCount*3+i*40)%CS);const ry=((p.frameCount*4+i*30)%80)+40;px(rx,ry,PX,PX*2);} }
  }

  function drawCl(p,x,y)  { p.fill(C.cloud); px(x,y,PX*5,PX*2); px(x+PX,y-PX,PX*3,PX); }
function drawWind(p) {
  p.noStroke();
  for (let i = 0; i < 8; i++) {
    const speed = 4 + (i % 3) * 2;
    const x = CS - ((p.frameCount * speed + i * 28) % (CS + 20));
    const y = 15 + i * 22 + Math.sin(p.frameCount * .08 + i) * 6;
    const len = 20 + (i % 3) * 10;
    p.fill('#d8d8e8');
    for (let d = 0; d < len; d += PX) {
      px(x + d, y, PX, PX);
    }
  } 
}
  function drawRainbow(p)  { C.rainbow.forEach((c,i)=>{p.fill(c);px(CS/2-PX*(7-i),10+i*PX,PX*(14-i*2),PX);}); }
  function drawFl(p,x,y,c) { p.fill('#58a058');px(x,y,PX,PX*2);p.fill(c);px(x-PX,y-PX,PX,PX);px(x+PX,y-PX,PX,PX);px(x,y-PX*2,PX,PX);p.fill('#f0d878');px(x,y-PX,PX,PX); }
  function drawTree(p,x,y,n) { p.fill(C.trunk);px(x+PX*2,y+PX*4,PX*2,PX*5);p.fill(n?C.leafN:C.leaf);px(x,y+PX,PX*6,PX*3);px(x+PX,y-PX,PX*4,PX*2);px(x+PX*2,y-PX*2,PX*2,PX); }

  function drawTreeTheme(p, x, y, n, colLeaf, colLeaf2, colTrunk) {
    p.fill(colTrunk); px(x+PX*2, y+PX*4, PX*2, PX*5);
    p.fill(n ? '#304028' : colLeaf); px(x, y+PX, PX*6, PX*3); px(x+PX, y-PX, PX*4, PX*2);
    p.fill(n ? '#304028' : colLeaf2); px(x+PX*2, y-PX*2, PX*2, PX);
  }

  function drawCactus(p, x, y) {
    p.fill('#70a858');
    px(x+PX, y, PX*2, PX*7);
    px(x-PX, y+PX*2, PX*2, PX*2); px(x-PX, y+PX, PX, PX);
    px(x+PX*3, y+PX*3, PX*2, PX*2); px(x+PX*4, y+PX*2, PX, PX);
    p.fill('#508840');
    px(x, y+PX*2, PX, PX); px(x+PX*3, y+PX*3, PX, PX);
    return { topY: y, eyeY: y+PX*3, neckY: y+PX*5 };
  }

  function drawEgg(p, cx, cy) {
    const x=cx-PX*3, y=cy; p.noStroke();
    p.fill(C.egg); px(x+PX*2,y,PX*3,PX); px(x+PX,y+PX,PX*5,PX); px(x,y+PX*2,PX*7,PX*3); px(x+PX,y+PX*5,PX*5,PX); px(x+PX*2,y+PX*6,PX*3,PX);
    p.fill(C.eggSp); px(x+PX*2,y+PX*2,PX,PX); px(x+PX*4,y+PX*3,PX*2,PX); px(x+PX*3,y+PX*5,PX,PX);
    if(window.D.g.totalXp>30) { p.fill(C.eggCr); px(x+PX*3,y+PX,PX,PX); px(x+PX*4,y+PX*2,PX,PX); px(x+PX*3,y+PX*3,PX,PX); }
  }

  function drawBaby(p, cx, cy, sl, en, ha) {
    const x=cx-PX*3, y=cy; p.noStroke();
    p.fill(C.body); px(x+PX,y,PX*4,PX); px(x,y+PX,PX*6,PX*3); px(x+PX,y+PX*4,PX*4,PX);
    p.fill(C.bodyLt); px(x+PX,y+PX,PX,PX); px(x+PX*2,y,PX,PX);
    if(sl||blink) { p.fill(C.eye); px(x+PX,y+PX*2,PX*2,PX); px(x+PX*3,y+PX*2,PX*2,PX); }
    else { p.fill(C.eye); px(x+PX,y+PX*2,PX,PX); px(x+PX*4,y+PX*2,PX,PX); p.fill('#fff'); p.rect(x+PX,y+PX*2,2,2); p.rect(x+PX*4,y+PX*2,2,2); }
    p.fill(C.cheek); px(x,y+PX*3,PX,PX); px(x+PX*5,y+PX*3,PX,PX);
    p.fill(C.mouth);
    if(!sl) { if(ha>60)px(x+PX*2,y+PX*3,PX*2,PX); else if(ha<25)px(x+PX*2,y+PX*3+2,PX*2,PX); else px(x+PX*2,y+PX*3,PX,PX); }
    p.fill(C.bodyDk); px(x+PX,y+PX*5,PX,PX); px(x+PX*4,y+PX*5,PX,PX);
    if(en<25&&!sl) { px(x+PX*2,y+PX*5,PX*2,PX); }
     return { topY: y, eyeY: y+PX*2, neckY: y+PX*4 };
  }

  function drawTeen(p, cx, cy, sl, en, ha) {
    const x=cx-PX*4, y=cy; p.noStroke();
    p.fill(C.body); px(x+PX*2,y,PX*4,PX); px(x+PX,y+PX,PX*6,PX); px(x,y+PX*2,PX*8,PX*4); px(x+PX,y+PX*6,PX*6,PX*2); px(x+PX*2,y+PX*8,PX*4,PX);
    p.fill(C.bodyLt); px(x+PX*2,y+PX,PX*2,PX); px(x+PX,y+PX*2,PX*2,PX);
    if(sl||blink) { p.fill(C.eye); px(x+PX*2,y+PX*3,PX*2,PX); px(x+PX*4,y+PX*3,PX*2,PX); }
    else { p.fill(C.eye); px(x+PX*2,y+PX*3,PX,PX*2); px(x+PX*5,y+PX*3,PX,PX*2); p.fill('#fff'); p.rect(x+PX*2,y+PX*3,2,2); p.rect(x+PX*5,y+PX*3,2,2); }
    p.fill(C.cheek); px(x+PX,y+PX*5,PX,PX); px(x+PX*6,y+PX*5,PX,PX);
    p.fill(C.mouth);
    if(!sl) { if(ha>70){px(x+PX*3,y+PX*5,PX*2,PX);px(x+PX*2,y+PX*5,PX,PX);px(x+PX*5,y+PX*5,PX,PX);} else if(ha>40)px(x+PX*3,y+PX*5,PX*2,PX); else if(ha<20)px(x+PX*3,y+PX*6,PX*2,PX); else px(x+PX*3,y+PX*5,PX,PX); }
    p.fill(C.bodyDk);
    if(en<25&&!sl){px(x-PX,y+PX*4,PX,PX);px(x+PX*8,y+PX*4,PX,PX);}else{px(x-PX,y+PX*3,PX,PX*2);px(x+PX*8,y+PX*3,PX,PX*2);}
    px(x+PX*2,y+PX*9,PX*2,PX); px(x+PX*5,y+PX*9,PX*2,PX);
     return { topY: y, eyeY: y+PX*3, neckY: y+PX*6 };
  }

  function drawAdult(p, cx, cy, sl, en, ha) {
    const x=cx-PX*5, y=cy; p.noStroke();
    p.fill(C.body); px(x+PX*3,y,PX*4,PX); px(x+PX*2,y+PX,PX*6,PX); px(x+PX,y+PX*2,PX*8,PX);
    px(x,y+PX*3,PX*10,PX*4); px(x+PX,y+PX*7,PX*8,PX*2); px(x+PX*2,y+PX*9,PX*6,PX); px(x+PX*3,y+PX*10,PX*4,PX);
    p.fill(C.bodyLt); px(x+PX*3,y+PX,PX*2,PX); px(x+PX*2,y+PX*2,PX*2,PX); px(x+PX,y+PX*3,PX*2,PX);
    if(sl||blink) { p.fill(C.eye); px(x+PX*2,y+PX*5,PX*2,PX); px(x+PX*6,y+PX*5,PX*2,PX); }
    else { p.fill(C.eye); px(x+PX*2,y+PX*4,PX*2,PX*2); px(x+PX*6,y+PX*4,PX*2,PX*2); p.fill('#fff'); px(x+PX*2,y+PX*4,PX,PX); px(x+PX*6,y+PX*4,PX,PX); }
    p.fill(C.cheek); px(x+PX,y+PX*6,PX,PX); px(x+PX*8,y+PX*6,PX,PX);
    p.fill(C.mouth);
    if(!sl) { if(ha>80){px(x+PX*3,y+PX*7,PX*4,PX);px(x+PX*3,y+PX*6,PX,PX);px(x+PX*6,y+PX*6,PX,PX);} else if(ha>50)px(x+PX*4,y+PX*7,PX*2,PX); else if(ha<20){px(x+PX*4,y+PX*8,PX*2,PX);px(x+PX*3,y+PX*7,PX,PX);} else px(x+PX*4,y+PX*7,PX,PX); }
    p.fill(C.bodyDk);
    if(en<20&&!sl){px(x-PX,y+PX*5,PX,PX*3);px(x+PX*10,y+PX*5,PX,PX*3);}
    else if(ha>85&&!sl){px(x-PX,y+PX*2,PX,PX*2);px(x+PX*10,y+PX*2,PX,PX*2);px(x-PX*2,y+PX,PX,PX);px(x+PX*11,y+PX,PX,PX);}
    else{px(x-PX,y+PX*4,PX,PX*3);px(x+PX*10,y+PX*4,PX,PX*3);}
    px(x+PX*2,y+PX*11,PX*2,PX); px(x+PX*6,y+PX*11,PX*2,PX);
    if(en<25&&!sl) px(x+PX*3,y+PX*11,PX,PX);
     return { topY: y, eyeY: y+PX*4, neckY: y+PX*7 };
  }

  function drawZzz(p, x, y) {
    for(let i=0; i<3; i++) {
      const fy = y - i*15 - (p.frameCount%50)*0.4;
      const fx = x + i*10 + Math.sin(p.frameCount*.1+i)*3;
      const sz = PX;
      p.fill(p.color(176, 144, 208, 200-i*50));
      px(fx, fy, sz*4, sz);
      px(fx+sz*2, fy+sz, sz, sz);
      px(fx+sz, fy+sz*2, sz, sz);
      px(fx, fy+sz*3, sz*4, sz);
    }
  }

  function drawProp(p, prop, offsetX, offsetY) {
    if (!prop.pixels || !prop.palette) return;
    p.noStroke();
    for(let row=0; row<prop.pixels.length; row++) {
      for(let col=0; col<prop.pixels[row].length; col++) {
        const ci = prop.pixels[row][col];
        if(ci === 0) continue;
        p.fill(prop.palette[ci]);
        px(offsetX + col*PX, offsetY + row*PX, PX, PX);
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
// p.color() avec hex + canal alpha séparé — compatible p5.js 1.9+
const col = p.color(pt.c);
col.setAlpha(a);
p.fill(col);
      px(pt.x, pt.y, PX, PX);
      return pt.life > 0;
    });
  }

}; // fin p5s

new p5(p5s);
