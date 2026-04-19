/* ============================================================
   envs.js — Décors, Météo et Moteur de Pixel
   RÔLE : Ce fichier est le "Chef Décorateur". Il dessine le fond
   de la scène (Parc, Chambre, Montagne) et les effets climatiques.
   ============================================================ */

/* ─── SYSTÈME 7 : INGÉNIERIE (Moteur de Rendu) ───────────────────── */

/**
 * px() : LA brique élémentaire de tout le pixel art
 * Pense à px() comme à un tampon encreur : chaque appel pose
 * un rectangle de taille PX×PX (5×5 pixels réels à l'écran).
 * Le Math.floor(x/PX)*PX arrondit la position à la grille PX,
 * pour qu'aucun objet ne soit jamais "entre deux pixels".
 * * @param {Object} p - L'instance p5.js
 * @param {number} x, y - Coin supérieur gauche (coordonnées canvas 0–200)
 * @param {number} w, h - Largeur/hauteur SOUHAITÉE (arrondies au PX supérieur)
 * ⚠️ Toujours appeler p.fill() AVANT px() — px() ne set pas la couleur.
 */
function px(p, x, y, w, h) {
  p.rect(Math.floor(x/PX)*PX, Math.floor(y/PX)*PX, Math.max(PX,Math.floor(w/PX)*PX), Math.max(PX,Math.floor(h/PX)*PX));
}

function pxFree(p, x, y, w, h) {
  p.rect(Math.floor(x), Math.floor(y), Math.max(1, Math.floor(w)), Math.max(1, Math.floor(h)));
}

/* ─── SYSTÈME 2 : ÉCOSYSTÈME & TOPOGRAPHIE (Météo & Nuit) ────────── */

/**
 * Raccourci Thème Color (tc) : Gère le mode Nuit
 * Retourne la couleur assombrie si n=true (nuit), sinon la couleur normale
 */
function tc(n, col) { return n ? shadeN(col) : col; }

/**
 * Dessine des bourrasques de vent (Lignes horizontales mouvantes)
 */
function drawWind(p) {
  p.noStroke();
  for (let i = 0; i < 8; i++) {
    const speed = 4 + (i % 3) * 2;
    const x = CS - ((p.frameCount * speed + i * 28) % (CS + 20));
    const y = 15 + i * 22 + Math.sin(p.frameCount * .08 + i) * 6;
    const len = 20 + (i % 3) * 10;
    p.fill('#d8d8e8');
    for (let d = 0; d < len; d += PX) {
      px(p,x + d, y, PX, PX);
    }
  } 
}

    function drawFog(p) {
  p.noStroke();
  
  // Nappes au sol
  for (let i = 0; i < 5; i++) {
    const speed = 0.3 + i * 0.15;
    const xOffset = (p.frameCount * speed + i * 45) % (CS + 60) - 30;
    const y = 108 + i * 8;
    const w = 60 + i * 20;
    p.fill(p.color(255, 255, 255, 120 - i * 20));
    for (let dx = 0; dx < w; dx += PX) {
      px(p, xOffset + dx, y, PX, PX * 2);
    }
  }
  // Nuages flottants par-dessus le Gotchi et les objets
  for (let i = 0; i < 4; i++) {
    const speed = 0.2 + i * 0.1;
    const xOffset = (p.frameCount * speed + i * 55) % (CS + 80) - 40;
    const y = 70 + i * 15;
    const w = 40 + i * 15;
    p.fill(p.color(255, 255, 255, 35 - i * 6));
    for (let dx = 0; dx < w; dx += PX) {
      px(p, xOffset + dx, y, PX, PX * 3);
    }
  }
}

/**
 * Dessine un arc-en-ciel géométrique (Bonheur Max)
 */
function drawRainbow(p) {
  const cx = CS + 20;  // ← centre hors écran à droite
  const cy = 140;
  const bands = C.rainbow;
  const rInner = 60;
  const bandW = PX * 2;

  for (let i = 0; i < bands.length; i++) {
    const rMin = rInner + i * bandW;
    const rMax = rMin + bandW;
    p.fill(bands[i]);
    for (let gx = 0; gx <= CS; gx += PX) {
      for (let gy = 0; gy < cy; gy += PX) {
        const dist = Math.sqrt((gx - cx) ** 2 + (gy - cy) ** 2);
        if (dist >= rMin && dist < rMax) {
          px(p, gx, gy, PX, PX);
        }
      }
    }
  }
}

/**
 * Dessine la pluie (Intensité inversement proportionnelle au bonheur)
 */
function drawRain(p, ha) {
  p.noStroke();
  // Plus ha est bas, plus il y a de gouttes (20 à 80)
  const count = Math.floor(80 - ha * 1.5);
  for (let i = 0; i < count; i++) {
    const speed = 7 + (i % 3) * 2;
    const x = (i * 31 + p.frameCount) % CS;
    const y = (p.frameCount * speed + i * 19) % (CS + 20) - 10;
    p.fill(p.color(220, 225, 235, 200));
    p.rect(x, y, 1, 4);
  }
}

/**
 * Dessine un soleil tournoyant
 */
function drawSun(p) {
  const cx = CS - 30, cy = 25;
  // Rayons (Rotation basée sur frameCount)
  p.fill('#f0e070');
  for (let a = 0; a < 8; a++) {
    const angle = (a / 8) * Math.PI * 2 + p.frameCount * 0.01;
    const rx = cx + Math.cos(angle) * 14;
    const ry = cy + Math.sin(angle) * 14;
    px(p, rx, ry, PX, PX);
  }
  // Corps
  p.fill('#f8d840');
  px(p, cx - 8, cy - 8, 16, 16);
  p.fill('#fce860');
  px(p, cx - 5, cy - 5, 10, 10);
}

/* ─── SYSTÈME 2 : ÉCOSYSTÈME & TOPOGRAPHIE (Les Biomes) ──────────── */

/**
 * drawActiveEnv() : dessine l'environnement actif (Le Fond)
 * @param {Object} p - Instance p5
 * @param {string} env - 'parc' | 'chambre' | 'montagne' (vient de D.g.activeEnv)
 * @param {boolean} n - true = mode nuit (h≥21 ou h<6)
 * @param {number} h - heure (0–23), utilisé pour la vitre de la fenêtre
 * * POUR AJOUTER UN ENVIRONNEMENT :
 * 1. Ajoute un objet { id:'monenv', ... } dans ENV_THEMES (config.js)
 * 2. Ajoute un bloc `else if (env === 'monenv') { ... }` ici.
 * 3. Wrap chaque couleur avec `tc(n, theme.X)` pour le mode nuit.
 */
function drawActiveEnv(p, env, n, h) {
  const theme = getEnvC();
  p.noStroke();

  // ── 1. BIOME : PARC ────────────────────────────────────────────────
  if (env === 'parc') {
    p.fill(theme.gnd);   p.rect(0, 120, CS, 80);
    p.fill(theme.gndDk); p.rect(0, 120, CS, PX*2);

    if (theme.id !== 'desert') {
      drawTreeTheme(p, 8,   86, n, theme.leaf1, theme.leaf2, theme.trunk);
      drawTreeTheme(p, 160, 90, n, theme.leaf1, theme.leaf2, theme.trunk);
    }

    drawThemeAccents(p, theme, n);
  }

  // ── 2. BIOME : CHAMBRE ─────────────────────────────────────────────
  // Structure : 1.Mur 2.Fenêtre 3.Rideaux 4.Plinthe 5.Cadre 6.Sol 7.Tapis 8.Bureau
  else if (env === 'chambre') {
    const bx = 138; // position x du bureau

    // 1. MUR
    p.fill(tc(n, theme.wall));
    p.rect(0, 60, CS, 60);

    // 2. FENÊTRE — vitre suit l'heure réelle (aube/jour/couchant/nuit)
    let skyCol;
    skyCol = (h>=20||h<6) ? C.skyN1 : (h>=17) ? C.skyK1 : (h>=7) ? C.skyD1 : C.skyA1;
    p.fill(skyCol); p.rect(20, 68, 42, 42);
    p.fill(tc(n, theme.windowFrame));
    p.rect(18, 66, 46, 3); p.rect(18, 107, 46, 3);
    p.rect(18, 66, 3, 44); p.rect(62, 66, 3, 44);
    p.rect(40, 68, 3, 42); p.rect(20, 88, 42, 3);
    p.fill(tc(n, theme.windowSill));
    p.rect(16, 108, 50, PX);

    // 3. RIDEAUX + TRINGLE
    p.fill(tc(n, theme.curtain));
    p.rect(10, 63, 12, 52); p.rect(62, 63, 12, 52);
    p.fill(tc(n, theme.curtainDk));
    p.rect(14, 63, 3, 52); p.rect(20, 63, 2, 52);
    p.rect(65, 63, 3, 52); p.rect(70, 63, 2, 52);
    p.fill(tc(n, theme.curtainRod));
    p.rect(8, 62, 68, 3);

    // 4. PLINTHE
    p.fill(tc(n, theme.baseboard));
    p.rect(0, 118, CS, PX);

    // 5. CADRE MURAL — agrandi 36×36
    p.fill(tc(n, theme.frameOuter));
    p.rect(85, 65, 36, 36);
    p.fill(tc(n, theme.frameBg));
    p.rect(88, 68, 30, 30);
    drawFrameMotif(p, theme, n);

    // 6. SOL PARQUET
    p.fill(tc(n, theme.floor));
    p.rect(0, 120, CS, 80);
    p.fill(tc(n, theme.floorLine));
    for (let ly = 130; ly < 200; ly += 13) { p.rect(0, ly, CS, 1); }

    // 7. TAPIS
    p.fill(tc(n, theme.rug));
    p.rect(18, 138, 164, 62);
    p.fill(tc(n, theme.rugCenter));
    p.rect(22, 141, 156, 59);

    // 8. BUREAU
    p.fill(tc(n, theme.desk));
    p.rect(bx+4, 108, PX, 18); p.rect(bx+46, 108, PX, 18);
    p.fill(tc(n, theme.deskTop));
    p.rect(bx, 100, 58, PX*2);
    p.fill(tc(n, theme.deskShadow));
    p.rect(bx, 108, 58, PX);
    p.fill(tc(n, theme.lamp));
    px(p, bx+38, 90, PX, PX*2);
    p.fill(tc(n, theme.lampShade));
    px(p, bx+33, 88, PX*3, PX);
  }

  // ── 3. BIOME : MONTAGNE / DÉSERT ─────────────────────────────────────────
  else if (env === 'montagne') {
   p.fill(tc(n, theme.mntGnd));   p.rect(0, 120, CS, 80);
    p.fill(tc(n, theme.mntGndDk)); p.rect(0, 120, CS, PX*2);
    p.fill(tc(n, theme.mntPeak));  p.triangle(40, 120, 100, 50, 160, 120);
    
    if (theme.id !== 'desert') {
      p.fill(tc(n, theme.mntPeak));  p.triangle(40, 120, 100, 50, 160, 120);
      p.fill(tc(n, theme.mntSnow));  p.triangle(100, 50, 83, 70, 117, 70);
    }

    if (theme.id === 'pastel') {
      // buissons sur la ligne du sol
      p.fill('#78c488');
      px(p, 10,  115, PX*4, PX*2);
      px(p, 50,  116, PX*3, PX*2);
      px(p, 140, 115, PX*4, PX*2);
      px(p, 175, 116, PX*3, PX);
    }
    
    // Sous-biome : Désert (remplace la montagne par une pyramide)
    if (theme.id === 'desert') {
      // Face claire (gauche)
      p.fill(tc(n, theme.mntPeak));
      p.triangle(55, 120, 100, 55, 145, 120);
      // Face ombragée (droite)
      p.fill(tc(n, theme.mntGndDk));
      p.triangle(100, 55, 100, 120, 145, 120);
      // Entrée
      p.fill('#6b3a1f');
      px(p, 96, 108, PX*2, PX*3);
      // Stries horizontales
      p.fill(tc(n, theme.mntSnow));
      px(p, 62, 102, 34, PX);
    }
  }
}

/**
 * MOTIFS CADRE MURAL (Chambre)
 * Modifie l'art abstrait dans le cadre selon la palette active
 */
function drawFrameMotif(p, theme, n) {
  if (theme.id === 'automne') {
    p.fill(tc(n, theme.frameAccent1));
    px(p, 96, 76, PX*2, PX*2); px(p, 104, 84, PX*2, PX*2);
    p.fill(tc(n, theme.frameAccent2));
    px(p, 104, 76, PX, PX*3); px(p, 96, 84, PX*3, PX);
  }
  else if (theme.id === 'hiver') {
    p.fill(tc(n, theme.frameAccent1));
    px(p, 96, 76, PX*2, PX*2); px(p, 104, 84, PX*2, PX*2);
    p.fill(tc(n, theme.frameAccent2));
    px(p, 104, 76, PX, PX*3); px(p, 96, 84, PX*3, PX);
  }
  else if (theme.id === 'desert') {
    p.fill(tc(n, theme.frameAccent1));
    px(p, 96, 76, PX*2, PX*2); px(p, 104, 84, PX*2, PX*2);
    p.fill(tc(n, theme.frameAccent2));
    px(p, 104, 76, PX, PX*3); px(p, 96, 84, PX*3, PX);
  }
  else {
    // pastel
    p.fill(tc(n, theme.frameAccent1));
    px(p, 96, 76, PX*2, PX*2); px(p, 104, 84, PX*2, PX*2);
    p.fill(tc(n, theme.frameAccent2));
    px(p, 104, 76, PX, PX*3); px(p, 96, 84, PX*3, PX);
  }
}

/**
 * ACCENTS ANIMÉS PAR THÈME (Parc)
 * Gère les particules spécifiques à l'ambiance (neige, feuilles, etc.)
 */
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
  // Fleurs au sol : décalées des arbres
  drawFl(p, 35,  120, theme.accent);
  drawFl(p, 155, 122, theme.accent);
  // Fleurs arbre gauche (feuillage : x8–38, y76–101)
  p.fill(theme.accent);
  px(p, 13, 80, PX, PX);   // haut gauche du feuillage
  px(p, 23, 84, PX, PX);   // milieu
  px(p, 18, 90, PX, PX);   // bas feuillage

  // Fleurs arbre droit (feuillage : x160–190, y80–105)
  px(p, 165, 84, PX, PX);
  px(p, 175, 88, PX, PX);
  px(p, 170, 94, PX, PX);
}
}

/* ─── SYSTÈME 2 : ÉCOSYSTÈME (Helpers de Dessin) ─────────────────── */

function drawTreeTheme(p, x, y, n, colLeaf, colLeaf2, colTrunk) {
  p.fill(colTrunk);
  px(p, x+PX*2, y+PX*4, PX*2, PX*5);
  p.fill(n ? '#304028' : colLeaf); // Force une couleur sombre si nuit
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
  p.fill('#58a058'); px(p,x,y,PX,PX*2); // Tige
  p.fill(c); px(p,x-PX,y-PX,PX,PX); px(p,x+PX,y-PX,PX,PX); px(p,x,y-PX*2,PX,PX); // Pétales
  p.fill('#f0d878'); px(p,x,y-PX,PX,PX); // Cœur
}

/* ─── SYSTÈME 7 : INGÉNIERIE (Helpers Mathématiques) ─────────────── */

/**
 * Assombrit une couleur hex pour générer le mode nuit dynamiquement.
 * @param {string} hex - Couleur au format "#RRGGBB"
 * @returns {string} - Couleur assombrie
 */
function shadeN(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  const f = 0.65; // Facteur d'assombrissement (Garde 65% de la luminosité)
  return '#' + [r,g,b].map(v => Math.round(v*f).toString(16).padStart(2,'0')).join('');
}