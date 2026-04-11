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
    drawActiveEnv(p, envActif, n);

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
    let bobY = sleeping ? Math.sin(bounceT) : Math.sin(bounceT) * 3;
    let amplitude = 15, vitesse = 0.02;

    if (!sleeping && ha >= 80 && en >= 80) {
      amplitude = 40; vitesse = 0.06;
      if (p.frameCount % 20 < 10) bobY -= PX;
    } else if (!sleeping && ha >= 60 && en >= 60) {
      amplitude = 25; vitesse = 0.04;
    }

    let moveX = sleeping ? 0 : Math.sin(p.frameCount * vitesse) * amplitude;
    const cx = CS / 2 + moveX;
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
              : def.ancrage==='cou'  ? PX*4
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

  function drawActiveEnv(p, env, n) {
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

    else if (env === 'chambre') {
      if (theme === 'automne') {
        p.fill('#c0a078'); p.rect(0, 60, CS, 60);
        p.fill('#a08058'); p.rect(0, 120, CS, 80);
        p.fill('#805030'); p.rect(20, 140, 160, 40, 10);
        p.fill('#e8b850'); p.rect(20, 70, 40, 40);
        p.fill('#e8e8f0'); p.rect(38, 70, 4, 40); p.rect(20, 88, 40, 4);
      }
      else if (theme === 'hiver') {
        p.fill('#d0d8e8'); p.rect(0, 60, CS, 60);
        p.fill('#b0b8c8'); p.rect(0, 120, CS, 80);
        p.fill('#8090b0'); p.rect(20, 140, 160, 40, 10);
        p.fill('#e0f0ff'); p.rect(20, 70, 40, 40);
        p.fill('#e8e8f0'); p.rect(38, 70, 4, 40); p.rect(20, 88, 40, 4);
        p.fill('#f0f8ff'); px(20, 108, 40, PX);
      }
      else if (theme === 'desert') {
        p.fill('#d4b880'); p.rect(0, 60, CS, 60);
        p.fill('#c09850'); p.rect(0, 120, CS, 80);
        p.fill('#a06828'); p.rect(20, 140, 160, 40, 10);
        p.fill('#f0c850'); p.rect(20, 70, 40, 40);
        p.fill('#e8e8f0'); p.rect(38, 70, 4, 40); p.rect(20, 88, 40, 4);
      }
      else {
        p.fill(n ? '#a090a8' : C.wallIn); p.rect(0, 60, CS, 60);
        p.fill(n ? '#807080' : C.floorIn); p.rect(0, 120, CS, 80);
        p.fill(n ? '#605070' : C.rug); p.rect(20, 140, 160, 40, 10);
        p.fill(n ? C.skyN1 : C.skyD1); p.rect(20, 70, 40, 40);
        p.fill('#e8e8f0'); p.rect(38, 70, 4, 40); p.rect(20, 88, 40, 4);
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
