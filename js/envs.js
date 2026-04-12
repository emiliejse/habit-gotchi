// envs.js — Dessin des environnements pixel art
// Dépend de : config.js (ENV_THEMES), render.js (PX, px, getEnvC)

// envs.js
// px est défini localement ici, miroir de celui dans p5s
function px(p, x, y, w, h) {
  p.rect(Math.floor(x/PX)*PX, Math.floor(y/PX)*PX, Math.max(PX,Math.floor(w/PX)*PX), Math.max(PX,Math.floor(h/PX)*PX));
}

function drawActiveEnv(p, env, n, h) {
  const theme = getEnvC();
  p.noStroke();

if (env === 'parc') {
    p.fill(theme.gnd);   p.rect(0, 120, CS, 80);
    p.fill(theme.gndDk); p.rect(0, 120, CS, PX*2);

    if (theme.id !== 'desert') {
      drawTreeTheme(p, 8,   86, n, theme.leaf1, theme.leaf2, theme.trunk);
      drawTreeTheme(p, 160, 90, n, theme.leaf1, theme.leaf2, theme.trunk);
    }

    drawThemeAccents(p, theme);
  }

// ============================================================
// CHAMBRE - Structure identique pour chaque thème :
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
  p.fill('#e08830'); px(p,94, 73, PX*3, PX*5);      // corps gauche de la feuille
  p.fill('#d07020'); px(p,99, 71, PX*3, PX*5);      // corps droit
  p.fill('#c86028'); px(p,100, 76, PX, PX*4);       // tige centrale

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
  p.fill('#f0d870'); px(p,bxA+38, 90, PX, PX*2);   // tige de la lampe
  p.fill('#e8b830'); px(p,bxA+33, 88, PX*3, PX);   // abat-jour

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
  px(p,100, 72, PX, PX*8);                          // barre verticale
  px(p,95, 77, PX*11, PX);                          // barre horizontale
  px(p,96, 73, PX, PX); px(p,104, 73, PX, PX);       // pointes diagonales haut
  px(p,96, 79, PX, PX); px(p,104, 79, PX, PX);       // pointes diagonales bas

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
  p.fill('#f0f0d0'); px(p,bxH+38, 90, PX, PX*2);   // tige lampe
  p.fill('#e0e0a0'); px(p,bxH+33, 88, PX*3, PX);   // abat-jour

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
  px(p,100, 72, PX, PX);                            // sommet
  px(p,98, 74, PX*3, PX);                           // rang 2
  px(p,96, 76, PX*5, PX);                           // rang 3 (milieu)
  px(p,98, 78, PX*3, PX);                           // rang 4
  px(p,100, 80, PX, PX);                            // bas
  p.fill('#f0c030');
  px(p,100, 74, PX, PX); px(p,100, 78, PX, PX);      // détails intérieurs

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
  p.fill('#f8e060'); px(p,bxD+38, 90, PX, PX*2);   // tige lampe
  p.fill('#f0c820'); px(p,bxD+33, 88, PX*3, PX);   // abat-jour

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
  px(p,96, 76, PX*2, PX*2);   // carré haut gauche
  px(p,104, 84, PX*2, PX*2);  // carré bas droite
  p.fill(n ? '#708090' : '#a8c8d0');
  px(p,104, 76, PX, PX*3);    // ligne verticale
  px(p,96, 84, PX*3, PX);     // ligne horizontale

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
  p.fill(n ? '#f0d870' : '#f0e898'); px(p,bxP+38, 90, PX, PX*2);   // tige lampe
  p.fill(n ? '#e8b830' : '#f8d858'); px(p,bxP+33, 88, PX*3, PX);   // abat-jour
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
        px(p,88, 95, 24, PX); px(p,76, 108, 48, PX);
      }
      else {
        p.fill(n ? '#404858' : C.mnt1); p.rect(0, 120, CS, 80);
        p.fill(n ? '#202838' : C.mnt2); p.rect(0, 120, CS, PX*2);
        p.fill(n ? '#505868' : '#b0b8c8'); p.triangle(40, 120, 100, 50, 160, 120);
        p.fill(n ? '#c0c0d0' : C.snow); p.triangle(100, 50, 83, 70, 117, 70);
      }
  }
}

function drawThemeAccents(p, theme) {
  const ft = p.frameCount;

  if (theme.id === 'automne') {
    // Feuilles qui tombent
    p.fill(theme.accent);
    px(p,(ft*2+10)%CS, 60+Math.sin(ft*.1)*20,  PX, PX);
    px(p,(ft*2+70)%CS, 40+Math.sin(ft*.12)*25, PX, PX);
    p.fill(theme.leaf1);
    px(p,(ft*2+130)%CS, 55+Math.sin(ft*.09)*18, PX, PX);
  }

  else if (theme.id === 'hiver') {
    // Flocons
    [[15,20],[55,10],[95,35],[145,18],[175,28],[30,50],[120,45],[165,55]]
    .forEach((s, i) => {
      const fy = ((ft + s[1]*3 + i*20) % 120);
      const fx = s[0] + Math.sin(ft*.05 + i)*5;
      p.fill(theme.accent);
      px(p,fx, fy, PX, PX);
    });
  }

  else if (theme.id === 'desert') {
    // Cactus + détails sol
    drawCactus(p, 18, 90);
    drawCactus(p, 168, 94);
    p.fill(theme.accent);
    px(p,70,136,PX*2,PX); px(p,110,130,PX,PX); px(p,150,138,PX*2,PX);
  }

  // pastel : rien de spécial, les fleurs sont gérées ailleurs
}

function drawTreeTheme(p, x, y, n, colLeaf, colLeaf2, colTrunk) {
  p.fill(colTrunk);
  px(p, x+PX*2, y+PX*4, PX*2, PX*5);
  p.fill(n ? '#304028' : colLeaf);
  px(p,x, y+PX, PX*6, PX*3);
  px(p,x+PX, y-PX, PX*4, PX*2);
  p.fill(n ? '#304028' : colLeaf2);
  px(p, x+PX*2, y-PX*2, PX*2, PX);
}

function drawCactus(p, x, y) {
  p.fill('#70a858');
  px(p,x+PX,   y,      PX*2, PX*7);
  px(p,x-PX,   y+PX*2, PX*2, PX*2);
  px(p,x-PX,   y+PX,   PX,   PX);
  px(p,x+PX*3, y+PX*3, PX*2, PX*2);
  px(p,x+PX*4, y+PX*2, PX,   PX);
  p.fill('#508840');
  px(p,x,      y+PX*2, PX,   PX);
  px(p,x+PX*3, y+PX*3, PX,   PX);
}