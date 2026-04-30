/* ============================================================
   render-sprites.js — Sprites pixel art du Gotchi
   RÔLE : Contient tous les sprites du Gotchi (œuf, bébé, ado, adulte)
          ainsi que les helpers de dessin (dithering, accessoires).
          C'est ici qu'on ajoute un nouveau stade ou une variante visuelle.

   DÉPENDANCES (chargé APRÈS dans index.html) :
     - config.js     → EN_CRIT, EN_WARN, HA_SAD, HA_MED, HA_HIGH,
                        HA_HAPPY_TEEN, HA_MED_ADULT, HA_ARMS_UP
     - render.js     → px(), C, PX, blink, getBreath(), getCheekPulse(),
                        getPropDef(), drawProp(), walkX, window._expr,
                        window._adultPose, window._gotchiNearPoop,
                        window._walk  (objet { x, dir, pause, target })
                        // Note : .step supprimé de _walk (variable morte, v4.5 — seul .pause est utilisé ici)

   NAVIGATION RAPIDE :
   §1  drawDither()       — effet épuisement style Gameboy
   §2  drawAccessoires()  — accessoires équipés sur le sprite
   §3  drawEgg()          — stade œuf
   §4  drawBaby()         — stade bébé
   §5  drawTeen()         — stade ado
   §6  drawAdult()        — stade adulte (avec poses idle)
   ============================================================ */

/* ─── §1 DITHERING ───────────────────────────────────────────────── */

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

/* ─── §1b DITHERING SALETÉ ──────────────────────────────────────── */

// RÔLE : Cache des masques de saleté, un entrée par combinaison stade + breathX.
// POURQUOI : Générer le masque off-screen est coûteux (lecture pixel par pixel).
//            On ne recalcule que si le stade ou le décalage de respiration change.
//            Structure : { [stage]: { key: string, pixels: [{rx, ry}] } }
//            rx/ry = positions relatives au coin haut-gauche du bounding box du sprite.
const _saleteMaskCache = {};

// RÔLE : Dimensions du bounding box off-screen pour chaque stade.
// POURQUOI : On alloue un canvas juste assez grand pour contenir le sprite complet
//            (corps + oreilles + bras + pieds), avec une petite marge.
//            ox = décalage cx → bord gauche du bounding box, en multiples de PX.
const _STAGE_BOX = {
  egg:   { w: 8,  h: 8,  ox: 4 },
  baby:  { w: 7,  h: 6,  ox: 4 },
  teen:  { w: 12, h: 13, ox: 6 }, // bras gauche + oreilles débordent
  adult: { w: 14, h: 12, ox: 7 }, // bras + oreilles débordent
};

// RÔLE : Dessine la silhouette d'un stade (couleur unie opaque) sur un p5.Graphics
//        off-screen, pour en extraire le masque alpha pixel par pixel.
// POURQUOI : En dessinant avec une couleur pleine, puis en lisant les pixels non-vides,
//            on obtient un masque fidèle au sprite réel. Si un sprite est modifié dans
//            drawBaby/drawTeen/drawAdult, il suffit de mettre à jour cette fonction —
//            drawSaleteDither suit automatiquement.
// @param {Object} g       - Instance p5.Graphics (canvas off-screen, déjà créé)
// @param {string} stage   - 'egg' | 'baby' | 'teen' | 'adult'
// @param {number} breathX - Décalage horizontal de respiration (0 ou ±1)
function _drawSilhouetteOffscreen(g, stage, breathX) {
  const box = _STAGE_BOX[stage];
  // EAR_PAD : marge haute en PX pour que les oreilles (teen/adult) ne débordent pas du canvas.
  const EAR_PAD = (stage === 'teen' || stage === 'adult') ? 3 : 0;
  const ox = box.ox * PX;  // décalage horizontal du "cx virtuel" dans le canvas off-screen
  const oy = EAR_PAD * PX; // décalage vertical pour absorber les oreilles

  g.background(0, 0, 0, 0); // fond transparent
  g.fill(255);               // blanc opaque — seule la forme compte
  g.noStroke();

  // Fonction locale calquée sur px() mais qui dessine sur g (canvas off-screen)
  function gpx(x, y, w, h) { g.rect(ox + x, oy + y, w, h); }

  if (stage === 'egg') {
    // Même géométrie que drawEgg() — origine relative cx=-3*PX
    const x = -PX * 3;
    gpx(x+PX*2, 0,     PX*3, PX);
    gpx(x+PX,   PX,    PX*5, PX);
    gpx(x,      PX*2,  PX*7, PX*3);
    gpx(x+PX,   PX*5,  PX*5, PX);
    gpx(x+PX*2, PX*6,  PX*3, PX);

  } else if (stage === 'baby') {
    // Même géométrie que drawBaby() — origine relative cx=-3*PX
    const x = -PX * 3;
    gpx(x+PX,  0,     PX*4, PX);
    gpx(x,     PX,    PX*6, PX*3);
    gpx(x+PX,  PX*4,  PX*4, PX);

  } else if (stage === 'teen') {
    // Même géométrie que drawTeen() — origine relative cx=-4*PX-breathX
    const x = -PX * 4 - breathX;
    gpx(x+PX*2,    0,     PX*4, PX);
    gpx(x+PX,      PX,    PX*6, PX);
    gpx(x,         PX*2,  PX*8, PX*4);
    gpx(x+PX,      PX*6,  PX*6, PX);
    gpx(x+PX*2,    PX*7,  PX*4, PX);
    // Oreilles
    gpx(x+PX,      -PX,   PX*2, PX*2);
    gpx(x+PX*5,    -PX,   PX*2, PX*2);
    gpx(x+PX+2,    -PX*2, PX,   PX);
    gpx(x+PX*5+2,  -PX*2, PX,   PX);
    // Bras
    gpx(x-PX,      PX*4,  PX,   PX*2);
    gpx(x+PX*8,    PX*4,  PX,   PX*2);
    // Pieds
    gpx(x+PX*2,    PX*8,  PX,   PX);
    gpx(x+PX*5,    PX*8,  PX,   PX);

  } else if (stage === 'adult') {
    // Même géométrie que drawAdult() — origine relative cx=-5*PX-breathX
    const x = -PX * 5 - breathX;
    gpx(x+PX*3,    0,     PX*4,  PX);
    gpx(x+PX*2,    PX,    PX*6,  PX);
    gpx(x+PX,      PX*2,  PX*8,  PX);
    gpx(x,         PX*3,  PX*10, PX*4);
    gpx(x+PX,      PX*7,  PX*8,  PX);
    gpx(x+PX*2,    PX*8,  PX*6,  PX);
    gpx(x+PX*3,    PX*9,  PX*4,  PX);
    // Oreilles
    gpx(x+PX*2,    -PX,   PX*2, PX*2);
    gpx(x+PX*6,    -PX,   PX*2, PX*2);
    // Bras (poses idle : on couvre toutes les positions possibles)
    gpx(x-PX,      PX*4,  PX,   PX*2);
    gpx(x+PX*10,   PX*4,  PX,   PX*2);
  }
}

// RÔLE : Construit (ou réutilise depuis le cache) le masque de silhouette pour le dither.
// POURQUOI : L'appel à loadPixels() est coûteux. On ne régénère le masque que lorsque
//            la clé stade+breathX change (au plus 3 clés possibles : -1, 0, +1).
// @param {Object} p       - Instance p5 principale
// @param {string} stage   - 'egg' | 'baby' | 'teen' | 'adult'
// @param {number} breathX - Décalage de respiration (0 ou ±1)
// @returns {Array<{rx:number, ry:number}>} positions relatives au coin haut-gauche du sprite
function _getSaleteMask(p, stage, breathX) {
  const key = stage + '_' + breathX;

  // RÔLE : Retourner le masque mis en cache si la clé n'a pas changé.
  if (_saleteMaskCache[stage] && _saleteMaskCache[stage].key === key) {
    return _saleteMaskCache[stage].pixels;
  }

  const box = _STAGE_BOX[stage];
  const EAR_PAD = (stage === 'teen' || stage === 'adult') ? 3 : 0;
  const cW = (box.w + 2) * PX; // largeur canvas off-screen (marge 1 PX de chaque côté)
  const cH = (box.h + EAR_PAD + 1) * PX; // hauteur avec marge oreilles + bas

  // RÔLE : Créer un canvas off-screen temporaire pour rendre la silhouette.
  // POURQUOI : p.createGraphics() alloue un canvas WebGL/2D isolé — jamais affiché.
  //            pixelDensity(1) évite le doublement des pixels sur écrans retina.
  const g = p.createGraphics(cW, cH);
  g.pixelDensity(1);

  _drawSilhouetteOffscreen(g, stage, breathX);

  // RÔLE : Lire les pixels du canvas off-screen pour extraire la silhouette.
  // POURQUOI : g.pixels[] est un tableau RGBA linéaire. On retient les positions
  //            dont l'alpha (indice +3) est non nul = partie visible du sprite.
  g.loadPixels();
  const pixels = [];
  const ox = box.ox * PX;
  const oy = EAR_PAD * PX;

  for (let ry = 0; ry < cH; ry += PX) {
    for (let rx = 0; rx < cW; rx += PX) {
      // RÔLE : Lire l'alpha du premier pixel de chaque macro-pixel PX×PX.
      // POURQUOI : On travaille en grille PX — lire un seul pixel par case suffit.
      const idx = (ry * cW + rx) * 4;
      if (g.pixels[idx + 3] > 0) {
        // Stocker la position relative au cx/cy du sprite (origine = coin haut-gauche)
        pixels.push({ rx: rx - ox, ry: ry - oy });
      }
    }
  }

  // RÔLE : Libérer le canvas off-screen après lecture.
  // POURQUOI : p.createGraphics() alloue de la mémoire GPU — g.remove() la libère.
  g.remove();

  _saleteMaskCache[stage] = { key, pixels };
  return pixels;
}

// RÔLE : Dessine un effet de saleté (taches de boue) par-dessus le sprite du Gotchi.
// POURQUOI : Utilise un masque alpha généré off-screen à partir du sprite réel.
//            La boue épouse exactement la silhouette — même après modification du sprite.
//            Si un sprite change, mettre à jour _drawSilhouetteOffscreen suffit.
//            La densité des taches augmente avec le niveau de saleté (5 → 10).
//
// @param {Object} p       - Instance p5
// @param {string} stage   - 'egg' | 'baby' | 'teen' | 'adult'
// @param {number} cx      - Centre X du Gotchi (même valeur que drawBaby/Teen/Adult)
// @param {number} cy      - Y haut du Gotchi (même valeur que draw*)
// @param {number} salete  - Niveau de saleté 0-10 (rien dessiné si < 5)
// @param {boolean} sl     - true si le Gotchi dort (breathX forcé à 0)
function drawSaleteDither(p, stage, cx, cy, salete, sl) {
  if (!salete || salete < 5) return;

  // RÔLE : Calculer l'intensité visuelle selon le niveau de saleté.
  // POURQUOI : ratio va de 0.0 (saleté=5) à 1.0 (saleté=10) — progression douce.
  const ratio  = (salete - 5) / 5;            // 0 → 1
  const alpha  = Math.round(40 + ratio * 120); // opacité 40 → 160
  const stride = ratio < 0.5 ? 3 : 2;         // pas du damier : 1 case / 3 puis 1 / 2

  // RÔLE : breathX doit correspondre exactement à celui utilisé dans le sprite.
  // POURQUOI : Le masque est mis en cache par breathX — s'il diverge,
  //            la boue sera décalée d'un pixel par rapport au corps.
  const breathX = (stage === 'teen' || stage === 'adult')
    ? (sl ? 0 : Math.round(getBreath(p) * 2 - 1))
    : 0;

  // Récupérer (ou construire) le masque de silhouette
  const mask = _getSaleteMask(p, stage, breathX);

  // Couleur boue
  const boue = p.color(101, 67, 33, alpha);
  p.fill(boue);
  p.noStroke();

  // RÔLE : Appliquer le damier sur chaque macro-pixel de la silhouette.
  // POURQUOI : On ne dessine qu'1 case sur stride — effet damier échiquier progressif.
  //            (row + col) % stride reproduit l'alternance de l'ancienne ditherRect.
  for (const { rx, ry } of mask) {
    const row = Math.round(ry / PX);
    const col = Math.round(rx / PX);
    if ((row + col) % stride !== 0) continue;
    p.rect(cx + rx, cy + ry, PX, PX);
  }
}

/* ─── §2 ACCESSOIRES ─────────────────────────────────────────────── */

// RÔLE : Objet de déduplication réutilisable entre les appels à drawAccessoires.
// POURQUOI : Évite d'allouer un new Set() à chaque frame (12 fps = 720 allocs/min).
//            On utilise un objet plat (clé = ancrage, valeur = true) — réinitialisé
//            manuellement en début de fonction via une boucle de nettoyage O(n ancrages).
//            Les ancrages possibles sont 3 au maximum (tete, yeux, cou) — coût négligeable.
const _dejaDessinesObj = {};

/**
 * Dessine les accessoires équipés DIRECTEMENT sur le sprite du Gotchi.
 * À appeler depuis drawBaby/drawTeen/drawAdult, avec les coordonnées internes du sprite.
 * Garantit que l'accessoire suit pixel-perfect le corps (mêmes arrondis, mêmes décalages).
 *
 * @param {Object} p - Instance p5
 * @param {number} cx - Centre X du Gotchi (= cx reçu par drawBaby/Teen/Adult)
 * @param {Object} anchors - { topY, eyeY, neckY } en coordonnées locales du sprite
 * @param {string} stage - 'baby' | 'teen' | 'adult' (pour calculer les offsets verticaux)
 * @param {boolean} sl - true si le Gotchi dort (sleeping), pour ajuster la position des yeux fermés
 */
function drawAccessoires(p, cx, anchors, stage, sl) {
  if (!window.D?.g?.props) return;

  // RÔLE : Filtrer les accessoires par environnement actif.
  // POURQUOI : Feature multi-env v3.49 — chaque env peut avoir ses propres accessoires.
  //            Rétrocompat : si prop.env non défini (ancienne sauvegarde), on affiche quand même.
  const envActif = window.D.g.activeEnv || 'parc';

  // RÔLE : Réinitialiser l'objet de déduplication avant chaque appel.
  // POURQUOI : On réutilise _dejaDessinesObj (déclaré une seule fois au niveau module)
  //            pour éviter d'allouer un new Set() à chaque frame.
  //            On efface uniquement les clés présentes — pas de recréation d'objet.
  for (const k in _dejaDessinesObj) delete _dejaDessinesObj[k];

  window.D.g.props
    .filter(pr => pr.actif && pr.type === 'accessoire' && (pr.env === envActif || !pr.env))
    .forEach(prop => {
      const def = getPropDef(prop.id);
      if (!def || !def.pixels) return;

      const ancrage = def.ancrage || 'tete';

      // RÔLE : Si un accessoire sur ce slot a déjà été dessiné, on ignore celui-ci.
      // POURQUOI : Évite la superposition visuelle si deux props actifs partagent le même ancrage.
      if (_dejaDessinesObj[ancrage]) return;
      _dejaDessinesObj[ancrage] = true;

      const ps = def.pxSize || PX;

      // RÔLE : Centrer l'accessoire sur cx sans snap grille — drawProp gère le rendu pixel.
      // POURQUOI : Le snap Math.floor(cx/PX)*PX désynchronisait l'accessoire du corps quand
      //            le Gotchi respirait (breathX) ou rebondissait (bobY flottant) → glissement visible.
      const accX = cx - (def.pixels[0].length * ps) / 2;

      // RÔLE : Choisir l'ancrage Y selon le slot, en tenant compte des yeux fermés (sl).
      // POURQUOI : La nuit, les yeux fermés sont dessinés 1 rangée plus bas que les yeux ouverts
      //            sur teen et adult. Sans cette correction, les lunettes/accessoires yeux
      //            apparaissaient 1px trop haut.
      let baseYraw;
      if (def.ancrage === 'yeux') {
        // Décalage +PX si sleeping sur teen et adult (yeux fermés = une rangée plus bas)
        const sleepShift = sl && (stage === 'teen' || stage === 'adult') ? PX : 0;
        baseYraw = anchors.eyeY + sleepShift;
      } else if (def.ancrage === 'cou') {
        baseYraw = anchors.neckY;
      } else {
        baseYraw = anchors.topY;
      }

      // RÔLE : Pas de snap grille sur Y non plus — on utilise la valeur flottante directement.
      // POURQUOI : Math.floor(baseYraw/PX)*PX faisait "sauter" l'accessoire d'une case entière
      //            quand bobY franchissait un palier de 5px → glissement vertical le jour.
      const offsetY = def.ancrage === 'yeux'
                    ? (stage === 'teen' ? ps * 3
                     : stage === 'adult' ? ps * 3
                     : ps * 2)
                    : def.ancrage === 'cou'
                    ? (stage === 'baby' ? ps * 3 : ps * 5)
                    : ps;

      const accY = baseYraw - def.pixels.length * ps + offsetY;
      drawProp(p, def, accX, accY);
    });
}

/* ─── §3 STADE ŒUF ──────────────────────────────────────────────── */

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
  // Couche de saleté par-dessus le sprite (si salete >= 5)
  drawSaleteDither(p, 'egg', cx, cy, window.D?.g?.salete || 0, false);
  return { topY: y, eyeY: y + PX * 2, neckY: y + PX * 4 };
}

/* ─── §4 STADE BÉBÉ ─────────────────────────────────────────────── */

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
      if(ha > HA_HIGH) px(p,x+PX*2,y+PX*3,PX*2,PX);       // sourire bébé (ha > 4)
      else if(ha < HA_SAD) px(p,x+PX*2,y+PX*3+2,PX*2,PX); // bouche triste (ha < 1)
      else px(p,x+PX*2,y+PX*3,PX,PX);
    }

    p.fill(C.bodyDk); px(p,x+PX,y+PX*5,PX,PX); px(p,x+PX*4,y+PX*5,PX,PX);
    if(en < EN_WARN && !sl) { px(p,x+PX*2,y+PX*5,PX*2,PX); }       // bras tombés (en < 2)
    if (en < EN_CRIT && !sl) drawDither(p, x + PX, y + PX * 3, PX * 4, PX * 3, C.bodyDk); // épuisement (en < 1)

    // ✨ Accessoires dessinés en interne (pixel-perfect avec le corps)
    drawAccessoires(p, cx, { topY: y, eyeY: y + PX * 2, neckY: y + PX * 4 }, 'baby', sl);

    // Couche de saleté par-dessus le sprite (si salete >= 5)
    drawSaleteDither(p, 'baby', cx, cy, window.D?.g?.salete || 0, sl);

    return { topY: y, eyeY: y + PX * 2, neckY: y + PX * 4 };
}

/* ─── §4b HELPER EXPRESSION ──────────────────────────────────────── */

// RÔLE : Vérifier si une humeur nommée est active sur le Gotchi.
// POURQUOI : La condition `expr.moodTimer > 0 && expr.lastMood === 'X'` était répétée
//            ~7 fois dans drawTeen et drawAdult — source d'erreur si la logique change.
//            Ce helper centralise le test : modifier ici suffit pour tous les sprites.
// @param {string} name - Nom de la humeur : 'joie' | 'faim' | 'surprise' | etc.
// @returns {boolean}
function isMood(name) {
  const expr = window._expr;
  return expr && expr.moodTimer > 0 && expr.lastMood === name;
}

/* ─── §5 STADE ADO ──────────────────────────────────────────────── */

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
    const isSurprise = isMood('surprise'); // helper centralisé §4b

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
    if (isMood('joie')) {
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

      if (isMood('joie')) {
        // Grand sourire : barre principale en bas, coins relevés
        px(p, x+PX*2, mouthY+PX, PX*4, PX);   // ligne principale
        px(p, x+PX,   mouthY,    PX,   PX);   // coin gauche relevé
        px(p, x+PX*6, mouthY,    PX,   PX);   // coin droit relevé
      } else if (isMood('faim')) {
        // Bouche baveuse (ouverte + goutte bleue)
        px(p, x+PX*3, mouthY, PX*2, PX*2);
        p.fill('#88c0e0');
        px(p, x+PX*3, mouthY+PX*2, PX, PX);
        p.fill(C.mouth);
      } else if (isMood('surprise')) {
        // Petit "o" de surprise
        px(p, x+PX*3, mouthY, PX*2, PX*2);
      } else {
        // Humeurs normales
        if      (ha > HA_HAPPY_TEEN) { px(p,x+PX*3,mouthY,PX*2,PX); px(p,x+PX*2,mouthY,PX,PX); px(p,x+PX*5,mouthY,PX,PX); } // grand sourire (ha > 4)
        else if (ha > HA_MED)         px(p,x+PX*3,mouthY,PX*2,PX);   // sourire neutre (ha > 2)
        else if (ha < HA_SAD)         px(p,x+PX*3,mouthY+2,PX*2,PX); // bouche triste (ha < 1)
        else                px(p,x+PX*3,mouthY,PX,PX);
      }
    }

    /* ─── PETITS BRAS SUR LES CÔTÉS ─── */
    p.fill(C.bodyDk);
    if (en < EN_WARN && !sl) {
      px(p, x-PX,   y+PX*5, PX, PX);        // bras tombés (en < 2)
      px(p, x+PX*8, y+PX*5, PX, PX);
    } else {
      px(p, x-PX,   y+PX*4, PX, PX*2);      // bras normaux
      px(p, x+PX*8, y+PX*4, PX, PX*2);
    }

    /* ─── PETITS PIEDS ─── */
    px(p, x+PX*2, y+PX*8, PX, PX);
    px(p, x+PX*5, y+PX*8, PX, PX);

    if (en < EN_CRIT && !sl) drawDither(p, x, y + PX * 4, PX * 8, PX * 5, C.bodyDk); // épuisement (en < 1)

    // ✨ Accessoires dessinés en interne (pixel-perfect avec le corps)
    drawAccessoires(p, cx, { topY: y, eyeY: y + PX*2, neckY: y + PX*5 }, 'teen', sl);

    // Couche de saleté par-dessus le sprite (si salete >= 5)
    drawSaleteDither(p, 'teen', cx, cy, window.D?.g?.salete || 0, sl);

    return { topY: y, eyeY: y+PX*2, neckY: y+PX*5 };
}

/* ─── §6 STADE ADULTE ───────────────────────────────────────────── */

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
    const isSurprise = isMood('surprise'); // helper centralisé §4b

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
    if (isMood('joie')) {
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

      if (isMood('joie')) {
        // Grand sourire : barre principale en bas, coins relevés
        px(p, x+PX*3, mouthY+PX, PX*4, PX);   // ligne principale
        px(p, x+PX*2, mouthY,    PX,   PX);   // coin gauche relevé
        px(p, x+PX*7, mouthY,    PX,   PX);   // coin droit relevé
      } else if (isMood('faim')) {
        // Bouche baveuse (ouverte + goutte bleue)
        px(p, x+PX*4, mouthY, PX*2, PX*2);
        p.fill('#88c0e0');
        px(p, x+PX*4, mouthY+PX*2, PX, PX);
        p.fill(C.mouth);
      } else if (isMood('surprise')) {
        // Petit "o" de surprise
        px(p, x+PX*4, mouthY, PX*2, PX*2);
      } else {
        // Humeurs normales
        if      (ha > HA_HIGH)      { px(p,x+PX*3,mouthY+PX,PX*4,PX); px(p,x+PX*2,mouthY,PX,PX); px(p,x+PX*7,mouthY,PX,PX); } // grand sourire (ha > 4)
        else if (ha > HA_MED_ADULT)   px(p,x+PX*4,mouthY,PX*2,PX);                                                               // sourire neutre (ha > 3)
        else if (ha < HA_SAD)       { px(p,x+PX*4,mouthY+2,PX*2,PX); px(p,x+PX*3,mouthY,PX,PX); }                              // bouche triste (ha < 1)
        else                px(p,x+PX*4,mouthY,PX,PX);
      }
    }

/* ─── PETITS BRAS SUR LES CÔTÉS ─── */
    p.fill(C.bodyDk);
    if (en < EN_WARN && !sl) {
      px(p, x-PX,    y+PX*6, PX, PX*2);     // bras tombés (en < 2)
      px(p, x+PX*10, y+PX*6, PX, PX*2);
    } else if (ha > HA_ARMS_UP && !sl) {     // bras levés joie (ha > 4)
      px(p, x-PX,    y+PX*3, PX, PX*2);     // bras levés (joie)
      px(p, x+PX*10, y+PX*3, PX, PX*2);
      px(p, x-PX*2,  y+PX*2, PX, PX);
      px(p, x+PX*11, y+PX*2, PX, PX);
    } else {
      // ─── Cycle des variations idle ───
      const pose = window._adultPose;
      const canVary = !sl && !window._jumpTimer;

      if (canVary) {
        if (pose.timer > 0) {
          pose.timer--;
          if (pose.timer === 0) {
            pose.current = 'normal';
            pose.cooldown = 60 + Math.floor(Math.random() * 60); // 5-10 sec
          }
        } else if (pose.cooldown > 0) {
          pose.cooldown--;
        } else {
          // Tirage aléatoire pondéré entre les 4 variations
          const r = Math.random();
          if      (r < 0.35) { pose.current = 'hanche_g';   pose.timer = 60  + Math.floor(Math.random() * 24); }   // 5-7 sec
          else if (r < 0.70) { pose.current = 'hanche_d';   pose.timer = 60  + Math.floor(Math.random() * 24); }   // 5-7 sec
          else if (r < 0.90) { pose.current = 'croises';    pose.timer = 72  + Math.floor(Math.random() * 24); }   // 6-8 sec
          else               { pose.current = 'salut';      pose.timer = 12  + Math.floor(Math.random() * 6);  }   // 1-1.5 sec
        }
      } else {
        pose.current = 'normal';
      }

      // ─── Dessin selon la pose courante ───
      if (pose.current === 'hanche_g') {
        // Bras gauche plié sur hanche
        px(p, x+PX,    y+PX*5, PX*2, PX);    // avant-bras horizontal
        px(p, x,       y+PX*4, PX,   PX*2);  // coude qui dépasse à gauche
        px(p, x+PX*10, y+PX*5, PX,   PX*2);  // bras droit normal
      } else if (pose.current === 'hanche_d') {
        // Bras droit plié sur hanche (miroir de hanche_g)
        px(p, x-PX,    y+PX*5, PX,   PX*2);  // bras gauche normal
        px(p, x+PX*7,  y+PX*7, PX*2, PX);    // avant-bras horizontal droit (bas du corps)
        px(p, x+PX*10, y+PX*6, PX,   PX*2);  // coude qui dépasse à droite
      } else if (pose.current === 'croises') {
        // Bras croisés devant le ventre — légèrement plus haut, débordants
        p.fill(C.bodyDk);
        px(p, x-PX,    y+PX*4, PX,   PX);    // coude gauche qui dépasse
        px(p, x,       y+PX*5, PX*4, PX);    // avant-bras gauche (traverse vers la droite)
        px(p, x+PX*6,  y+PX*5, PX*4, PX);    // avant-bras droit (traverse vers la gauche)
        px(p, x+PX*10, y+PX*4, PX,   PX);    // coude droit qui dépasse
      } else if (pose.current === 'salut') {
        // Bras gauche levé en l'air (coucou)
        px(p, x-PX,   y+PX*2, PX, PX*3);     // bras vertical levé
        px(p, x-PX,   y+PX,   PX, PX);       // main au sommet
        px(p, x+PX*10,y+PX*5, PX, PX*2);     // bras droit normal
      } else {
        // Pose normale (bras le long du corps)
        px(p, x-PX,    y+PX*5, PX, PX*2);
        px(p, x+PX*10, y+PX*5, PX, PX*2);
      }
    }

/* ─── PETITS PIEDS — légère levée alternée pendant la marche ─── */
    // Compteur de pas basé sur la distance parcourue : 1 alternance tous les PX pixels
    // RÔLE : Détecter si le Gotchi est en mouvement pour alterner les pieds.
    // POURQUOI : On lit window._walk.pause au lieu de walkPause directement.
    //            L'accès direct à walkPause fonctionnait uniquement grâce à la scope globale
    //            partagée entre render.js et render-sprites.js — couplage implicite fragile.
    //            window._walk est mis à jour dans render.js juste avant l'appel au sprite.
    const isMoving = !sl && (window._walk ? window._walk.pause === 0 : false);
    const stepPhase = isMoving ? Math.floor(walkX / PX) % 2 : -1;

    if (stepPhase === 0) {
      // Pied gauche au sol, pied droit légèrement levé
      px(p, x+PX*3, y+PX*10, PX*2, PX);          // pied gauche normal
      px(p, x+PX*6, y+PX*10 - 1, PX*2, PX);      // pied droit levé d'1px
    } else if (stepPhase === 1) {
      // Pied gauche légèrement levé, pied droit au sol
      px(p, x+PX*3, y+PX*10 - 1, PX*2, PX);      // pied gauche levé d'1px
      px(p, x+PX*6, y+PX*10, PX*2, PX);          // pied droit normal
    } else {
      // Immobile : les deux pieds au sol
      px(p, x+PX*3, y+PX*10, PX*2, PX);
      px(p, x+PX*6, y+PX*10, PX*2, PX);
    }
    if (en < EN_CRIT && !sl) drawDither(p, x + PX, y + PX * 5, PX * 8, PX * 5, C.bodyDk); // épuisement (en < 1)

    // ✨ Accessoires dessinés en interne (pixel-perfect avec le corps)
    drawAccessoires(p, cx, { topY: y, eyeY: y + PX*3, neckY: y + PX*6 }, 'adult', sl);

    // Couche de saleté par-dessus le sprite (si salete >= 5)
    drawSaleteDither(p, 'adult', cx, cy, window.D?.g?.salete || 0, sl);

    return { topY: y, eyeY: y+PX*3, neckY: y+PX*6 };
}
