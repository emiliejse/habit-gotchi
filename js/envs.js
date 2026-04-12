// envs.js — Dessin des environnements pixel art
// Dépend de : config.js (ENV_THEMES), render.js (PX, px, getEnvC)

function drawActiveEnv(p, env, n, h) {
  const theme = getEnvC();
  p.noStroke();

  if (env === 'parc') {
    // Sol
    p.fill(theme.gnd);   p.rect(0, 120, CS, 80);
    p.fill(theme.gndDk); p.rect(0, 120, CS, PX*2);

    // Arbres
    drawTreeTheme(p, 8,   86, n, theme.leaf1, theme.leaf2, theme.trunk);
    drawTreeTheme(p, 160, 90, n, theme.leaf1, theme.leaf2, theme.trunk);

    // Éléments spéciaux selon thème
    drawThemeAccents(p, theme);
  }

  // ... autres envs (chambre, montagne) restent inchangés pour l'instant
}

function drawThemeAccents(p, theme) {
  const ft = p.frameCount;

  if (theme.id === 'automne') {
    // Feuilles qui tombent
    p.fill(theme.accent);
    px((ft*2+10)%CS, 60+Math.sin(ft*.1)*20,  PX, PX);
    px((ft*2+70)%CS, 40+Math.sin(ft*.12)*25, PX, PX);
    p.fill(theme.leaf1);
    px((ft*2+130)%CS, 55+Math.sin(ft*.09)*18, PX, PX);
  }

  else if (theme.id === 'hiver') {
    // Flocons
    [[15,20],[55,10],[95,35],[145,18],[175,28],[30,50],[120,45],[165,55]]
    .forEach((s, i) => {
      const fy = ((ft + s[1]*3 + i*20) % 120);
      const fx = s[0] + Math.sin(ft*.05 + i)*5;
      p.fill(theme.accent);
      px(fx, fy, PX, PX);
    });
  }

  else if (theme.id === 'desert') {
    // Cactus + détails sol
    drawCactus(p, 18, 90);
    drawCactus(p, 168, 94);
    p.fill(theme.accent);
    px(70,136,PX*2,PX); px(110,130,PX,PX); px(150,138,PX*2,PX);
  }

  // pastel : rien de spécial, les fleurs sont gérées ailleurs
}

function drawTreeTheme(p, x, y, n, colLeaf, colLeaf2, colTrunk) {
  p.fill(colTrunk);
  px(x+PX*2, y+PX*4, PX*2, PX*5);
  p.fill(n ? '#304028' : colLeaf);
  px(x, y+PX, PX*6, PX*3);
  px(x+PX, y-PX, PX*4, PX*2);
  p.fill(n ? '#304028' : colLeaf2);
  px(x+PX*2, y-PX*2, PX*2, PX);
}

function drawCactus(p, x, y) {
  p.fill('#70a858');
  px(x+PX,   y,      PX*2, PX*7);
  px(x-PX,   y+PX*2, PX*2, PX*2);
  px(x-PX,   y+PX,   PX,   PX);
  px(x+PX*3, y+PX*3, PX*2, PX*2);
  px(x+PX*4, y+PX*2, PX,   PX);
  p.fill('#508840');
  px(x,      y+PX*2, PX,   PX);
  px(x+PX*3, y+PX*3, PX,   PX);
}