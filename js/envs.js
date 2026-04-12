// ── px() : LA brique élémentaire de tout le pixel art ───────
// Pense à px() comme à un tampon encreur : chaque appel pose
// un rectangle de taille PX×PX (5×5 pixels réels à l'écran).
// Le Math.floor(x/PX)*PX arrondit la position à la grille PX,
// pour qu'aucun objet ne soit jamais "entre deux pixels".
//   p  → l'instance p5.js (toujours passer `p`)
//   x,y → coin supérieur gauche (coordonnées canvas 0–200)
//   w,h → largeur/hauteur SOUHAITÉE — arrondies au PX supérieur
// ⚠️ Toujours appeler p.fill() AVANT px() — px() ne set pas la couleur.
function px(p, x, y, w, h) {
  p.rect(Math.floor(x/PX)*PX, Math.floor(y/PX)*PX, Math.max(PX,Math.floor(w/PX)*PX), Math.max(PX,Math.floor(h/PX)*PX));
}
// Raccourci nuit : retourne la couleur assombrie si n=true, sinon la couleur normale
// "tc" = "theme color"
function tc(n, col) { return n ? shadeN(col) : col; }

// ── drawActiveEnv() : dessine l'environnement actif ─────────
// `env`   → string : 'parc' | 'chambre' | 'montagne' (vient de D.g.activeEnv)
// `n`     → booléen : true = mode nuit (h≥21 ou h<6)
// `h`     → heure (0–23), utilisé pour la vitre de la fenêtre chambre
// `theme` → objet de couleurs issu de getEnvC() → config.js/ENV_THEMES
//
// POUR AJOUTER UN ENVIRONNEMENT :
//   1. Ajoute un objet { id:'monenv', ... } dans ENV_THEMES (config.js)
//      avec toutes les clés de couleur dont tu auras besoin.
//   2. Ajoute un bloc `else if (env === 'monenv') { ... }` ici.
//   3. Pour le mode nuit : wrape chaque fill() avec `tc(n, theme..X) : theme.X`
//      (shadeN assombrit de 35% — voir en bas du fichier)
//
// POUR MODIFIER UNE COULEUR D'UN ENV EXISTANT :
//   → Va dans config.js, trouve l'objet du thème, change la valeur hex.
//   → Ne modifie RIEN dans ce fichier sauf si tu changes la structure.

function drawActiveEnv(p, env, n, h) {
  const theme = getEnvC();
  p.noStroke();

  // ── PARC ────────────────────────────────────────────────
  if (env === 'parc') {
    p.fill(theme.gnd);   p.rect(0, 120, CS, 80);
    p.fill(theme.gndDk); p.rect(0, 120, CS, PX*2);

    if (theme.id !== 'desert') {
      drawTreeTheme(p, 8,   86, n, theme.leaf1, theme.leaf2, theme.trunk);
      drawTreeTheme(p, 160, 90, n, theme.leaf1, theme.leaf2, theme.trunk);
    }

    drawThemeAccents(p, theme, n);
  }

  // ── CHAMBRE ─────────────────────────────────────────────
  // Structure : 1.Mur 2.Fenêtre 3.Rideaux+tringle 4.Plinthe
  //             5.Cadre mural 6.Sol 7.Tapis 8.Bureau+lampe
  else if (env === 'chambre') {
    const bx = 138; // position x du bureau

    // 1. MUR
    p.fill(tc(n, theme.wall));
    p.rect(0, 60, CS, 60);

    // 2. FENÊTRE — vitre suit l'heure pour pastel, suit sky1 pour les autres
    let skyCol;
    if (theme.id === 'pastel') {
      skyCol = (h>=20||h<6) ? C.skyN1 : (h>=17) ? C.skyK1 : (h>=7) ? C.skyD1 : C.skyA1;
    } else {
      skyCol = (h>=20||h<6) ? C.skyN1 : theme.sky1;
    }
    p.fill(skyCol); p.rect(20, 68, 42, 42);
    p.fill(tc(n, theme.windowFrame);
    p.rect(18, 66, 46, 3); p.rect(18, 107, 46, 3);
    p.rect(18, 66, 3, 44); p.rect(62, 66, 3, 44);
    p.rect(40, 68, 3, 42); p.rect(20, 88, 42, 3);
    p.fill(tc(n, theme.windowSill);
    p.rect(16, 108, 50, PX);

    // 3. RIDEAUX + TRINGLE
    p.fill(tc(n, theme.curtain);
    p.rect(10, 63, 12, 52); p.rect(62, 63, 12, 52);
    p.fill(tc(n, theme.curtainDk);
    p.rect(14, 63, 3, 52); p.rect(20, 63, 2, 52);
    p.rect(65, 63, 3, 52); p.rect(70, 63, 2, 52);
    p.fill(tc(n, theme.curtainRod);
    p.rect(8, 62, 68, 3);

    // 4. PLINTHE
    p.fill(tc(n, theme.baseboard);
    p.rect(0, 118, CS, PX);

    // 5. CADRE MURAL
    p.fill(tc(n, theme.frameOuter);
    p.rect(88, 68, 28, 28);
    p.fill(tc(n, theme.frameBg);
    p.rect(91, 71, 22, 22);
    drawFrameMotif(p, theme, n);

    // 6. SOL PARQUET
    p.fill(tc(n, theme.floor);
    p.rect(0, 120, CS, 80);
    p.fill(tc(n, theme.floorLine);
    for (let ly = 130; ly < 200; ly += 13) { p.rect(0, ly, CS, 1); }

    // 7. TAPIS
    p.fill(tc(n, theme.rug);
    p.rect(18, 138, 164, 62);
    p.fill(tc(n, theme.rugCenter);
    p.rect(22, 141, 156, 59);

    // 8. BUREAU
    p.fill(tc(n, theme.desk);
    p.rect(bx+4, 108, PX, 18); p.rect(bx+46, 108, PX, 18);
    p.fill(tc(n, theme.deskTop);
    p.rect(bx, 100, 58, PX*2);
    p.fill(tc(n, theme.deskShadow);
    p.rect(bx, 108, 58, PX);
    p.fill(tc(n, theme.lamp);
    px(p, bx+38, 90, PX, PX*2);
    p.fill(tc(n, theme.lampShade));
    px(p, bx+33, 88, PX*3, PX);
  }

  // ── MONTAGNE ────────────────────────────────────────────
  else if (env === 'montagne') {
    p.fill(tc(n, theme.mntGnd)   : theme.mntGnd);   p.rect(0, 120, CS, 80);
    p.fill(tc(n, theme.mntGndDk); p.rect(0, 120, CS, PX*2);
    p.fill(tc(n, theme.mntPeak);  p.triangle(40, 120, 100, 50, 160, 120);
    p.fill(tc(n, theme.mntSnow);  p.triangle(100, 50, 83, 70, 117, 70);

    // Désert : dune supplémentaire + stries
    if (theme.id === 'desert') {
      p.fill(theme.mntSnow); p.triangle(100, 55, 88, 75, 112, 75);
      p.fill(theme.mntGndDk);
      px(p, 88, 95, 24, PX); px(p, 76, 108, 48, PX);
    }
  }
}

// ── MOTIFS CADRE MURAL (unique par thème) ───────────────────
function drawFrameMotif(p, theme, n) {
  if (theme.id === 'automne') {
    p.fill(tc(n, theme.frameAccent1);
    px(p, 94, 73, PX*3, PX*5);
    p.fill(tc(n, theme.frameAccent2);
    px(p, 99, 71, PX*3, PX*5);
    p.fill('#c86028');
    px(p, 100, 76, PX, PX*4);
  }
  else if (theme.id === 'hiver') {
    p.fill(tc(n, theme.frameAccent1);
    px(p, 100, 72, PX, PX*8);
    px(p, 95, 77, PX*11, PX);
    px(p, 96, 73, PX, PX); px(p, 104, 73, PX, PX);
    px(p, 96, 79, PX, PX); px(p, 104, 79, PX, PX);
  }
  else if (theme.id === 'desert') {
    p.fill(tc(n, theme.frameAccent1);
    px(p, 100, 72, PX, PX); px(p, 98, 74, PX*3, PX);
    px(p, 96, 76, PX*5, PX); px(p, 98, 78, PX*3, PX);
    px(p, 100, 80, PX, PX);
    p.fill(tc(n, theme.frameAccent2);
    px(p, 100, 74, PX, PX); px(p, 100, 78, PX, PX);
  }
  else {
    // pastel
    p.fill(tc(n, theme.frameAccent1);
    px(p, 96, 76, PX*2, PX*2); px(p, 104, 84, PX*2, PX*2);
    p.fill(tc(n, theme.frameAccent2);
    px(p, 104, 76, PX, PX*3); px(p, 96, 84, PX*3, PX);
  }
}

// ── ACCENTS ANIMÉS PAR THÈME (parc) ─────────────────────────
function drawThemeAccents(p, theme, n) {
  const ft = p.frameCount;

  if (theme.id === 'automne') {
    p.fill(theme.accent);
    px(p, (ft*2+10)%CS,  60+Math.sin(ft*.1)*20,  PX, PX);
    px(p, (ft*2+70)%CS,  40+Math.sin(ft*.12)*25, PX, PX);
    p.fill(theme.leaf1);
    px(p, (ft*2+130)%CS, 55+Math.sin(ft*.09)*18, PX, PX);
  }
  else if (theme.id === 'hiver') {
    [[15,20],[55,10],[95,35],[145,18],[175,28],[30,50],[120,45],[165,55]]
    .forEach((s, i) => {
      const fy = ((ft + s[1]*3 + i*20) % 120);
      const fx = s[0] + Math.sin(ft*.05 + i)*5;
      p.fill(theme.accent);
      px(p, fx, fy, PX, PX);
    });
  }
  else if (theme.id === 'desert') {
    drawCactus(p, 18, 90);
    drawCactus(p, 168, 94);
    p.fill(theme.accent);
    px(p, 70, 136, PX*2, PX); px(p, 110, 130, PX, PX); px(p, 150, 138, PX*2, PX);
  }
  else if (theme.id === 'pastel') {
  drawFl(p, 30,  138, theme.accent);
  drawFl(p, 80,  142, theme.leaf1);
  drawFl(p, 140, 138, theme.accent);
  drawFl(p, 175, 140, theme.leaf2);
}
}

// ── HELPERS ──────────────────────────────────────────────────
function drawTreeTheme(p, x, y, n, colLeaf, colLeaf2, colTrunk) {
  p.fill(colTrunk);
  px(p, x+PX*2, y+PX*4, PX*2, PX*5);
  p.fill(n ? '#304028' : colLeaf);
  px(p, x, y+PX, PX*6, PX*3);
  px(p, x+PX, y-PX, PX*4, PX*2);
  p.fill(n ? '#304028' : colLeaf2);
  px(p, x+PX*2, y-PX*2, PX*2, PX);
}

function drawCactus(p, x, y) {
  p.fill('#70a858');
  px(p, x+PX,   y,      PX*2, PX*7);
  px(p, x-PX,   y+PX*2, PX*2, PX*2);
  px(p, x-PX,   y+PX,   PX,   PX);
  px(p, x+PX*3, y+PX*3, PX*2, PX*2);
  px(p, x+PX*4, y+PX*2, PX,   PX);
  p.fill('#508840');
  px(p, x,      y+PX*2, PX,   PX);
  px(p, x+PX*3, y+PX*3, PX,   PX);
}

function drawFl(p, x, y, c) {
  p.fill('#58a058'); px(p,x,y,PX,PX*2);
  p.fill(c); px(p,x-PX,y-PX,PX,PX); px(p,x+PX,y-PX,PX,PX); px(p,x,y-PX*2,PX,PX);
  p.fill('#f0d878'); px(p,x,y-PX,PX,PX);
}

// Assombrit une couleur hex pour le mode nuit
function shadeN(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  const f = 0.65;
  return '#' + [r,g,b].map(v => Math.round(v*f).toString(16).padStart(2,'0')).join('');
}