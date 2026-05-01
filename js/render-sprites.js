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
   §0  renderSprite()     — moteur DSL générique (calques → px())
   §1  drawDither()       — effet épuisement style Gameboy
   §2  drawAccessoires()  — accessoires équipés sur le sprite
   §3  drawEgg()          — stade œuf
   §4  drawBaby()         — stade bébé
   §5  drawTeen()         — stade ado
   §6  drawAdult()        — stade adulte (avec poses idle)
   ============================================================ */

/* ─── §0 MOTEUR DSL ─────────────────────────────────────────────── */

// RÔLE : Résoudre une couleur DSL vers une valeur p5 utilisable par p.fill().
// POURQUOI : Les calques stockent des clés comme 'C.body' ou des hex littérales '#fff'.
//            Cette fonction fait le pont entre la définition déclarative et le moteur p5.
//            Centraliser ici permet de changer la résolution (thème saisonnier, palette
//            alternative) sans toucher aux définitions de sprites.
// @param {Object} p         - Instance p5
// @param {string} fillKey   - Clé de palette ('C.body', 'C.eye', etc.) ou hex littérale
// @param {Object} palette   - Objet de couleurs courant (C par défaut, remplaçable pour les thèmes)
// @returns {p5.Color}
function _resolveFill(p, fillKey, palette) {
  // RÔLE : Supporter les clés 'C.xxx' (couleur du Gotchi) et les hex littérales.
  // POURQUOI : 'C.body' → palette['body'] ; '#fff' → passé tel quel à p.color().
  //            Si la clé est inconnue, on retourne un magenta visible pour déboguer.
  if (typeof fillKey !== 'string') return p.color('#ff00ff');
  if (fillKey.startsWith('C.')) {
    const key = fillKey.slice(2); // retire le préfixe 'C.'
    return p.color(palette[key] || '#ff00ff');
  }
  return p.color(fillKey);
}

// RÔLE : Moteur générique qui itère les calques d'une définition sprite et appelle px().
// POURQUOI : Remplace les suites px() manuelles par des données déclaratives (tableaux de calques).
//            Un nouveau Gotchi ou un nouveau stade = une nouvelle définition d'objet,
//            sans dupliquer la logique de dessin.
//            Un thème saisonnier = une palette alternative passée en paramètre.
//
// Structure d'un calque (layer) :
//   {
//     id:      string,              // identifiant lisible (debug, variantes)
//     fill:    string,              // clé 'C.xxx' ou hex littérale '#rrggbb'
//     alpha:   number (opt),        // opacité globale 0.0–1.0, défaut 1.0
//     when:    function (opt),      // (params) => bool — calque affiché uniquement si true
//     rects:   [                    // liste de rectangles
//       { x, y, w, h,              //   coordonnées en multiples de PX, relatifs à cx/cy
//         rawDx, rawDy }           //   décalages sub-pixel optionnels (défaut 0)
//     ]
//   }
//
// @param {Object}   p          - Instance p5
// @param {Array}    layers     - Tableau de calques (définition du sprite)
// @param {number}   cx         - Centre X du Gotchi (pixels canvas)
// @param {number}   cy         - Y haut du Gotchi (pixels canvas)
// @param {Object}   params     - État courant transmis aux fonctions `when` et aux offsets dynamiques :
//                                { sl, en, ha, breath, breathX, blink, expr, pose, walkX, isMoving, totalXp }
// @param {Object}   palette    - Palette de couleurs courante (C de render.js par défaut)
function renderSprite(p, layers, cx, cy, params, palette) {
  // RÔLE : Utiliser C (l'objet global de render.js) si aucune palette alternative n'est fournie.
  // POURQUOI : En usage normal, C est défini globalement — pas besoin de le passer à chaque appel.
  //            Pour un thème alternatif, on passe une palette custom qui remplace C.
  const pal = palette || C;

  p.noStroke();

  // RÔLE : Lire les overrides d'animation calculés ce frame par animator.resolve().
  // POURQUOI : window._animOverrides est recalculé une seule fois par frame dans p.draw()
  //            (après animator.tick()) et exposé ici en lecture seule.
  //            On utilise un objet vide par défaut pour que renderSprite() reste
  //            utilisable même si animator n'a pas encore tourné (ex. premier frame).
  const aov = window._animOverrides || { hidden: new Set(), visible: new Set(), dx: 0, dy: 0 };

  for (const layer of layers) {
    // RÔLE : Évaluer la condition du calque avant de dessiner.
    // POURQUOI : `when` est une fonction pure (params) => bool.
    //            Si absent, le calque est toujours affiché.
    //
    // Priorité des overrides d'animation :
    //   1. aov.hidden  → forcer le calque à ne PAS être dessiné (ignore `when`)
    //   2. aov.visible → forcer le calque à être dessiné (ignore `when`)
    //   3. Comportement normal via `when`
    if (layer.id && aov.hidden.has(layer.id)) continue;          // animation masque ce calque
    const forceVisible = layer.id && aov.visible.has(layer.id);  // animation force ce calque
    if (!forceVisible && layer.when && !layer.when(params)) continue;

    // RÔLE : Appliquer l'opacité globale du calque si définie.
    // POURQUOI : Certains calques (joues débordantes joie) ont une transparence partielle.
    //            On utilise globalAlpha plutôt que setAlpha() pour rester cohérent avec le code existant.
    const hasAlpha = typeof layer.alpha === 'number' && layer.alpha !== 1.0;
    if (hasAlpha) p.drawingContext.globalAlpha = layer.alpha;

    // RÔLE : Résoudre la couleur et l'appliquer.
    // POURQUOI : fillFn est une fonction (params, p) => p5.Color pour les couleurs dynamiques
    //            (ex. joues pulsantes via lerpColor). Prioritaire sur fill si définie.
    if (layer.fillFn) {
      p.fill(layer.fillFn(params, p));
    } else {
      p.fill(_resolveFill(p, layer.fill, pal));
    }

    // RÔLE : Dessiner chaque rectangle du calque.
    // POURQUOI : x/y sont en multiples de PX, relatifs à cx/cy.
    //            rawDx/rawDy portent les décalages sub-pixel statiques (ex. +2 dans les oreilles).
    //            rawDxFn/rawDyFn sont des fonctions (params) => number pour les offsets dynamiques
    //            (ex. wobble temporel des craquelures de l'œuf via Math.sin(Date.now()...)).
    //            rawW/rawH permettent des dimensions non-multiples de PX (ex. reflets 2×2 px).
    //            yFn est une fonction (params) => number pour les positions Y dynamiques
    //            (ex. mouthY qui descend avec la respiration).
    //            aov.dy : NON appliqué ici — absorbé sur drawY dans p.draw() pour décaler
    //                     le Gotchi entier (corps + accessoires + dithering + reflets).
    //            aov.dx : réservé pour usage futur (Temps 3+) — non appliqué ici pour éviter
    //                     tout décalage inattendu sur les sprites qui calculent leur propre cxB.
    for (const r of layer.rects) {
      const rx = cx + r.x * PX + (r.rawDx || 0) + (r.rawDxFn ? r.rawDxFn(params) : 0);
      const baseY = r.yFn ? r.yFn(params) : cy + r.y * PX;
      const ry = baseY + (r.rawDy || 0) + (r.rawDyFn ? r.rawDyFn(params) : 0);
      const rw = r.rawW !== undefined ? r.rawW : r.w * PX;
      const rh = r.rawH !== undefined ? r.rawH : r.h * PX;
      px(p, rx, ry, rw, rh);
    }

    // RÔLE : Restaurer l'opacité normale après un calque semi-transparent.
    if (hasAlpha) p.drawingContext.globalAlpha = 1.0;
  }
}

// RÔLE : Exposer renderSprite sur window pour permettre l'accès depuis d'autres modules.
// POURQUOI : Cohérent avec la convention du projet (toute nouvelle globale → window.*).
//            Permet à un futur module de définir ses propres sprites sans modifier ce fichier.
window.renderSprite = renderSprite;

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

// RÔLE : Hash pseudo-aléatoire déterministe à partir de deux entiers.
// POURQUOI : Permet de générer des valeurs "aléatoires" stables par position (rx, ry)
//            sans seed externe — le même pixel donne toujours le même résultat,
//            garantissant des taches fixes entre les frames sans stocker d'état supplémentaire.
function _hashPx(rx, ry) {
  let h = ((rx * 73856093) ^ (ry * 19349663)) >>> 0; // XOR de deux produits premiers
  h = ((h ^ (h >>> 16)) * 0x45d9f3b) >>> 0;
  h = ((h ^ (h >>> 16)) * 0x45d9f3b) >>> 0;
  return (h >>> 0) / 0xffffffff; // valeur dans [0, 1]
}

// RÔLE : Construit (ou réutilise depuis le cache) le masque de silhouette pour le dither.
// POURQUOI : L'appel à loadPixels() est coûteux. On ne régénère le masque que lorsque
//            la clé stade+breathX change (au plus 3 clés possibles : -1, 0, +1).
//            Chaque pixel du masque embarque des propriétés aléatoires fixes (draw, size, alphaBase)
//            calculées une seule fois et réutilisées à chaque frame — effet taches organiques stable.
// @param {Object} p       - Instance p5 principale
// @param {string} stage   - 'egg' | 'baby' | 'teen' | 'adult'
// @param {number} breathX - Décalage de respiration (0 ou ±1)
// @returns {Array<{rx, ry, draw, size, alphaBase}>} pixels de la silhouette avec propriétés fixes
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
        const relRx = rx - ox;
        const relRy = ry - oy;

        // RÔLE : Générer des propriétés visuelles fixes pour ce pixel via hash déterministe.
        // POURQUOI : Les 3 valeurs h1/h2/h3 indépendantes donnent distribution, taille et opacité
        //            stables à chaque frame — les taches ne bougent pas.
        const h1 = _hashPx(relRx,     relRy);      // décide si ce pixel est dessiné
        const h2 = _hashPx(relRx + 1, relRy);      // décide la taille
        const h3 = _hashPx(relRx,     relRy + 1);  // décide l'opacité de base

        // draw : ~50% des pixels retenus, avec légère surreprésentation des zones basses
        // (les pieds/ventre sont plus sales que la tête — facteur y progressif)
        const yBias = 0.1 * (relRy / (cH * 0.8)); // légèrement plus dense vers le bas
        const draw = h1 < (0.48 + yBias);

        // size : 60% petits (PX), 30% moyens (PX*1.5), 10% grosses taches (PX*2)
        // POURQUOI : mélange de tailles = effet organique vs damier uniforme
        const size = h2 < 0.60 ? PX
                   : h2 < 0.90 ? PX * 1.5
                   :              PX * 2;

        // alphaBase : opacité de base dans [25, 160] — modulée ensuite par ratio global
        const alphaBase = Math.round(25 + h3 * 135);

        pixels.push({ rx: relRx, ry: relRy, draw, size, alphaBase });
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
  if (!salete || salete < 2) return;

  // RÔLE : Calculer l'intensité visuelle selon le niveau de saleté.
  // POURQUOI : ratio va de 0.0 (saleté=2) à 1.0 (saleté=10) — progression douce.
  //            Seuil abaissé de 5 → 2 : l'échelle 0-4 était entièrement invisible,
  //            ce qui rendait la saleté imperceptible après 1-2 crottes. Désormais
  //            dithering léger dès salete=2, plein à salete=10.
  const ratio  = Math.max(0, Math.min(1, (salete - 2) / 8)); // 0 → 1

  // RÔLE : breathX doit correspondre exactement à celui utilisé dans le sprite.
  // POURQUOI : Le masque est mis en cache par breathX — s'il diverge,
  //            la boue sera décalée d'un pixel par rapport au corps.
  // RÔLE : Calculer breathX avec floor pour une distribution équitable des positions.
  // POURQUOI : Math.round(x*2-1) biaisait vers 0 — Math.floor(x*3)-1 donne {-1,0,1} équitable.
  //            Doit correspondre exactement au breathX utilisé dans drawTeen/drawAdult.
  const breathX = (stage === 'teen' || stage === 'adult')
    ? (sl ? 0 : Math.floor(getBreath(p) * 3) - 1) // ∈ {-1, 0, 1} — distribution équitable
    : 0;

  // Récupérer (ou construire) le masque de silhouette
  const mask = _getSaleteMask(p, stage, breathX);

  // RÔLE : Dessiner les taches organiques — distribution random fixe + opacité variable par pixel.
  // POURQUOI : Chaque pixel du masque embarque draw/size/alphaBase calculés une seule fois
  //            au build du cache. Le ratio global module la densité (seuil draw) et l'alpha max
  //            sans recalculer le cache — les taches restent fixes, leur intensité monte avec salete.
  p.noStroke();

  // density : à ratio=0 on affiche ~30% des pixels "draw", à ratio=1 on en affiche ~100%
  // POURQUOI : les taches apparaissent progressivement plutôt que d'un coup
  const densityThreshold = 0.30 + ratio * 0.70;

  // alphaMax : plafond d'opacité modulé par ratio — taches légères au début, opaques à salete=10
  const alphaMax = Math.round(60 + ratio * 140);

  for (const { rx, ry, draw, size, alphaBase } of mask) {
    if (!draw) continue; // pixel non retenu par la distribution de base

    // RÔLE : Seuil de densité progressif — à faible ratio, seuls les pixels les plus "forts" passent.
    // POURQUOI : _hashPx(rx+2, ry) donne une valeur stable différente de h1, pour une sélection
    //            indépendante de celle qui a décidé draw au build du cache.
    const densityVal = _hashPx(rx + 2, ry);
    if (densityVal > densityThreshold) continue;

    // Opacité finale : alphaBase individuel plafonné par alphaMax global
    const a = Math.min(alphaBase, alphaMax);

    p.fill(101, 67, 33, a); // couleur boue, opacité variable
    p.rect(cx + rx, cy + ry, size, size);
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

  // RÔLE : Snapper cx sur la grille PX dès l'entrée dans drawAccessoires.
  // POURQUOI : cx (= walkX, centre de marche) est flottant car walkX accumule des vitesses
  //            non-entières (1.4, 0.7, 0.35…). Dans renderSprite, chaque rect du corps
  //            est snappé par px() depuis ce même cx flottant — résultat : le premier
  //            pixel du corps tombe sur Math.floor(cx + r.x*PX / PX)*PX.
  //            Pour que l'accessoire soit synchronisé, il faut qu'il parte du même cx
  //            snappé que le corps. On snappe une seule fois ici → tous les calculs
  //            accX/accY qui suivent héritent automatiquement de ce snap.
  cx = Math.floor(cx / PX) * PX;

  // RÔLE : Snapper également les ancres Y sur la grille PX.
  // POURQUOI : anchors.eyeY, neckY, topY proviennent de cy + n*PX — cy est transmis
  //            depuis render.js via bobY (flottant). Même problème qu'en X.
  anchors = {
    topY:  Math.floor(anchors.topY  / PX) * PX,
    eyeY:  Math.floor(anchors.eyeY  / PX) * PX,
    neckY: Math.floor(anchors.neckY / PX) * PX,
  };

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

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 🎯 POSITION HORIZONTALE (gauche ↔ droite)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // accX = coin gauche de l'accessoire, calculé pour le centrer sur le Gotchi.
      //
      // Pour décaler l'accessoire à DROITE  → ajouter  + PX  (ou + PX*2 pour plus)
      // Pour décaler l'accessoire à GAUCHE  → ajouter  - PX
      //
      // Exemple : const accX = cx - (def.pixels[0].length * ps) / 2 + PX;
      //                                                              ^^^
      //                                              ← modifier ici
      const accX = cx - (def.pixels[0].length * ps) / 2;

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 🎯 POINT D'ANCRAGE VERTICAL (quel repère Y on utilise)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // Selon def.ancrage dans props.json, on part d'un repère différent :
      //   'yeux' → hauteur des yeux du Gotchi  (lunettes, masques…)
      //   'cou'  → hauteur du cou              (colliers, écharpes…)
      //   autre  → sommet de la tête           (chapeaux, antennes…)
      //
      // Tu peux modifier la valeur de baseYraw ici pour décaler le point
      // de départ vertical d'un accessoire, mais c'est rare — préfère offsetY ci-dessous.
      let baseYraw;
      if (def.ancrage === 'yeux') {
        const sleepShift = sl && (stage === 'teen' || stage === 'adult') ? PX : 0;
        baseYraw = anchors.eyeY + sleepShift;
      } else if (def.ancrage === 'cou') {
        baseYraw = anchors.neckY;
      } else {
        baseYraw = anchors.topY;
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 🎯 DÉCALAGE VERTICAL FIN (haut ↕ bas) — C'EST ICI QU'ON AJUSTE
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // offsetY = combien de px on remonte l'accessoire depuis le repère de base.
      // La valeur est en multiples de ps (= taille d'un pixel art, généralement 5px).
      //
      // Pour monter l'accessoire  → augmenter la valeur  (ex: ps*4 au lieu de ps*3)
      // Pour descendre            → diminuer la valeur   (ex: ps*2 au lieu de ps*3)
      //
      // Valeurs actuelles par ancrage × stade :
      //   'yeux'  → teen : ps*3 │ adult : ps*3 │ baby : ps*2
      //   'cou'   → baby : ps*3 │ teen/adult : ps*5
      //   'tete'  → tous stades : ps*1
      //                                          ↓ modifier ici
      const offsetY = def.ancrage === 'yeux'
                    ? (stage === 'teen'  ? ps * 3   // ← lunettes teen  : monter = +1, descendre = -1
                     : stage === 'adult' ? ps * 3   // ← lunettes adult
                     :                    ps * 2)   // ← lunettes baby
                    : def.ancrage === 'cou'
                    ? (stage === 'baby'  ? ps * 2   // ← collier baby
                     :                    ps * 6)   // ← collier teen/adult
                    :                    ps * 1;    // ← chapeau (tous stades)

      // accY = position Y finale du coin haut-gauche de l'accessoire.
      // (baseYraw - hauteur de l'accessoire + offsetY)
      // → Tu n'as normalement pas besoin de toucher cette ligne.
      const accY = baseYraw - def.pixels.length * ps + offsetY;
      drawProp(p, def, accX, accY);
    });
}

/* ─── §3 STADE ŒUF ──────────────────────────────────────────────── */

// RÔLE : Définition DSL du sprite Œuf — tableau de calques pour renderSprite().
// POURQUOI : Remplace les px() manuels de l'ancienne drawEgg().
//            Coordonnées en multiples de PX, relatives à cx/cy (origin = cx - 3*PX).
//            Ajouter un nouveau détail visuel = ajouter un calque ici, sans toucher au moteur.
//
// Repère : x DSL = (offset_canvas - cx) / PX = offset_depuis_x_original + (-3)
//          ex. x+PX*2 dans l'ancien code → x_dsl = 2 + (-3) = -1
const LAYERS_EGG = [

  // ── Corps principal (forme ovoïde 7×7 PX) ──────────────────────
  {
    id: 'corps',
    fill: 'C.egg',
    rects: [
      { x: -1, y: 0, w: 3, h: 1 },   // arrondi haut
      { x: -2, y: 1, w: 5, h: 1 },
      { x: -3, y: 2, w: 7, h: 3 },   // ventre large
      { x: -2, y: 5, w: 5, h: 1 },
      { x: -1, y: 6, w: 3, h: 1 },   // arrondi bas
    ]
  },

  // ── Reflets brillants (taches claires) ─────────────────────────
  {
    id: 'reflets',
    fill: 'C.eggSp',
    rects: [
      { x: -1, y: 2, w: 1, h: 1 },   // reflet haut-gauche
      { x:  1, y: 3, w: 2, h: 1 },   // reflet milieu-droit
      { x:  0, y: 5, w: 1, h: 1 },   // reflet bas
    ]
  },

  // ── Craquelures (apparaissent si totalXp > 45, s'intensifient ≥ 75) ──
  // POURQUOI : Le wobble est temporel (Math.sin(Date.now())) — il ne peut pas être
  //            une constante statique. rawDxFn est une fonction (params) => number
  //            évaluée à chaque frame par renderSprite().
  {
    id: 'craquelures',
    fill: 'C.eggCr',
    when: (pm) => pm.totalXp > 45,
    rects: [
      { x: 0, y: 1, w: 1, h: 1, rawDxFn: (pm) => Math.sin(Date.now() * 0.015) * (pm.totalXp >= 75 ? 2 : 1) },
      { x: 1, y: 2, w: 1, h: 1, rawDxFn: (pm) => Math.sin(Date.now() * 0.015) * (pm.totalXp >= 75 ? 2 : 1) },
      { x: 0, y: 3, w: 1, h: 1, rawDxFn: (pm) => Math.sin(Date.now() * 0.015) * (pm.totalXp >= 75 ? 2 : 1) },
    ]
  },
];

function drawEgg(p, cx, cy) {
  // RÔLE : Construire les params DSL et déléguer le rendu à renderSprite().
  // POURQUOI : drawEgg() reste le point d'entrée appelé par render.js — son interface
  //            (p, cx, cy) est inchangée. Le DSL est interne à ce fichier.
  const params = {
    totalXp: window.D?.g?.totalXp || 0,
  };

  renderSprite(p, LAYERS_EGG, cx, cy, params);

  // Couche de saleté par-dessus le sprite (si salete >= 5) — interface inchangée
  drawSaleteDither(p, 'egg', cx, cy, window.D?.g?.salete || 0, false);

  // Retourner les anchors pour drawAccessoires — valeurs identiques à l'ancienne version
  return { topY: cy, eyeY: cy + PX * 2, neckY: cy + PX * 4 };
}

/* ─── §4 STADE BÉBÉ ─────────────────────────────────────────────── */

// RÔLE : Définition DSL du sprite Bébé — tableau de calques pour renderSprite().
// POURQUOI : Remplace les px() manuels de l'ancienne drawBaby().
//            Coordonnées en multiples de PX, relatives à cx/cy (origin = cx - 3*PX).
//
// Repère : x DSL = offset_depuis_x_original + (-3)
//          ex. x+PX dans l'ancien code → x_dsl = 1 + (-3) = -2
const LAYERS_BABY = [

  // ── Corps (6×5 PX arrondi) ─────────────────────────────────────
  {
    id: 'corps',
    fill: 'C.body',
    rects: [
      { x: -2, y: 0, w: 4, h: 1 },   // arrondi haut
      { x: -3, y: 1, w: 6, h: 3 },   // ventre large
      { x: -2, y: 4, w: 4, h: 1 },   // arrondi bas
    ]
  },

  // ── Highlights (reflets clairs coin haut-gauche) ────────────────
  {
    id: 'highlights',
    fill: 'C.bodyLt',
    rects: [
      { x: -2, y: 1, w: 1, h: 1 },
      { x: -1, y: 0, w: 1, h: 1 },
    ]
  },

  // ── Yeux fermés (sommeil, clignotement, ou bâillement) ──────────
  // RÔLE : Barres fermées alignées avec les yeux ouverts (x:-2,w:2 et x:1,w:2).
  // POURQUOI : isMood('baillement') → yeux mi-clos pendant la durée du bâillement
  //            (même rendu que le clignotement — ligne horizontale = paupières baissées).
  {
    id: 'yeux-fermes',
    fill: 'C.eye',
    when: (pm) => pm.sl || pm.blink || isMood('baillement'),
    rects: [
      { x: -2, y: 2, w: 2, h: 1 },   // œil gauche fermé (barre, aligné avec œil ouvert)
      { x:  1, y: 2, w: 2, h: 1 },   // œil droit fermé  (barre, aligné avec œil ouvert)
    ]
  },

  // ── Yeux ouverts (éveillé, sans clignotement, sans bâillement) ──
  // RÔLE : Œil 2×1 PX (large) pour un look mignon, cohérent avec la bouche à y:3.
  // POURQUOI : Un œil 1×1 PX (5×5px) laissait trop peu de place pour un reflet vivant.
  //            Un œil 2×1 PX (10×5px) donne plus d'espace horizontal pour que le reflet
  //            se balade de gauche à droite — sans empiéter sur la bouche (y:3) ni les joues.
  //            Symétrique : gauche de x=-2 à x=0, droit de x=1 à x=3.
  //            Corps : x=-3 à x+3 — les joues à x=-3 et x=2 ne sont pas touchées
  //            car l'œil droit s'arrête à x=3 (hors corps, case des joues = x=2 est libre).
  {
    id: 'yeux-ouverts',
    fill: 'C.eye',
    when: (pm) => !pm.sl && !pm.blink && !isMood('baillement'),
    rects: [
      { x: -2, y: 2, w: 2, h: 1 },   // œil gauche (2×1 PX — plus large, même hauteur)
      { x:  1, y: 2, w: 2, h: 1 },   // œil droit  (2×1 PX)
    ]
  },

  // ── Joues roses ────────────────────────────────────────────────
  // NOTE : Le calque 'reflets-yeux' a été retiré du DSL.
  // Les reflets blancs sont désormais dessinés directement via p.rect() dans drawBaby()
  // pour obtenir un mouvement sub-pixel flottant (pas de snap via px()).
  {
    id: 'joues',
    fill: 'C.cheek',
    rects: [
      { x: -3, y: 3, w: 1, h: 1 },   // joue gauche
      { x:  2, y: 3, w: 1, h: 1 },   // joue droite
    ]
  },

  // ── Dégoût poop (yeux en croix, par-dessus les yeux normaux) ───
  // POURQUOI : Affiché uniquement si le Gotchi est proche d'un poop et éveillé.
  //            Ces rects écrasent visuellement les yeux normaux (même position, plus large).
  {
    id: 'yeux-poop',
    fill: 'C.eye',
    when: (pm) => !!window._gotchiNearPoop && !pm.sl,
    rects: [
      { x: -1, y: 2, w: 2, h: 1 },   // œil gauche écarquillé
      { x:  2, y: 2, w: 2, h: 1 },   // œil droit écarquillé
    ]
  },

  // ── Bouche bâillement (priorité max — écrase toute autre bouche) ──
  // RÔLE : Bouche "O" ouverte pendant la durée de l'expression 'baillement'.
  // POURQUOI : Calque en tête de liste → s'affiche en premier, mais les autres
  //            bouches ont leur propre `when` — seul ce calque répond à isMood('baillement').
  //            Forme : 2×2px noir centré = ouverture ronde minimaliste pixel art.
  {
    id: 'bouche-baillement',
    fill: 'C.mouth',
    when: (pm) => !pm.sl && isMood('baillement'),
    rects: [{ x: 0, y: 3, w: 2, h: 2 }]  // carré 2×2 PX = bouche "O"
  },

  // ── Bouche sourire (ha élevé) ───────────────────────────────────
  // POURQUOI : x:0 centre la bouche entre les deux yeux (gauche x:-2, droit x:1 → centre ~x:0).
  {
    id: 'bouche-sourire',
    fill: 'C.mouth',
    when: (pm) => !pm.sl && !isMood('baillement') && pm.ha > HA_HIGH,
    rects: [{ x: 0, y: 3, w: 2, h: 1 }]
  },

  // ── Bouche triste (ha bas) — rawDy:2 pour l'offset sub-pixel ───
  {
    id: 'bouche-triste',
    fill: 'C.mouth',
    when: (pm) => !pm.sl && !isMood('baillement') && pm.ha < HA_SAD,
    rects: [{ x: 0, y: 3, w: 2, h: 1, rawDy: 2 }]
  },

  // ── Bouche neutre (état par défaut) ────────────────────────────
  {
    id: 'bouche-neutre',
    fill: 'C.mouth',
    when: (pm) => !pm.sl && !isMood('baillement') && pm.ha >= HA_SAD && pm.ha <= HA_HIGH,
    rects: [{ x: 0, y: 3, w: 1, h: 1 }]
  },

  // ── Pieds / membres inférieurs (toujours visibles) ─────────────
  {
    id: 'pieds',
    fill: 'C.bodyDk',
    rects: [
      { x: -2, y: 5, w: 1, h: 1 },   // pied gauche
      { x:  1, y: 5, w: 1, h: 1 },   // pied droit
    ]
  },

  // ── Bras tombés (énergie faible, éveillé) ──────────────────────
  // POURQUOI : Quand en < EN_WARN, les bras s'élargissent vers le bas plutôt que
  //            les côtés — même couleur que les pieds (bodyDk), calque séparé.
  {
    id: 'bras-tombes',
    fill: 'C.bodyDk',
    when: (pm) => pm.en < EN_WARN && !pm.sl,
    rects: [{ x: -1, y: 5, w: 2, h: 1 }]
  },
];

function drawBaby(p, cx, cy, sl, en, ha) {
  // RÔLE : Construire les params DSL et déléguer le rendu à renderSprite().
  // POURQUOI : drawBaby() reste le point d'entrée appelé par render.js — son interface
  //            (p, cx, cy, sl, en, ha) est inchangée. Le DSL est interne à ce fichier.
  const params = { sl, en, ha, blink };

  renderSprite(p, LAYERS_BABY, cx, cy, params);

  // RÔLE : Reflet snappé sur grille PX, avec regard latéral vers la crotte si proche.
  // POURQUOI : Snap PX-grid → le reflet ne sort plus de l'iris aux extrémités (Bug 1 fix).
  //            Regard crotte : si _gotchiNearPoop, le reflet est poussé du côté de la crotte
  //            la plus proche — effet "le Gotchi la regarde du coin de l'œil" sans nouveau sprite.
  //            Couleur : D.g.pupilColor (personnalisable dans l'onglet Perso) — blanc par défaut.
  //            Guard baillement : isMood('baillement') ferme les yeux (calque yeux-fermes) mais
  //            n'est pas dans params — on l'exclut explicitement pour ne pas afficher les reflets
  //            par-dessus des paupières baissées.
  if (!params.sl && !params.blink && !isMood('baillement')) {
    const _pupilEntry = window.HG_CONFIG.PUPIL_COLORS.find(c => c.id === (window.D?.g?.pupilColor ?? 'blanc'));
    p.fill(_pupilEntry ? _pupilEntry.hex : '#ffffff');
    p.noStroke();
    // Iris baby : 2×PX = 10px large. Amplitude max = 10 - 3reflet - 1margeG - 1margeD = 5px.
    const rxMax = PX * 2 - 3 - 2; // 5px
    // RÔLE : Calculer la position brute du reflet — sinus ou regard crotte.
    // POURQUOI : Si une crotte est proche, on remplace le sinus par un décalage directionnel
    //            (0 = crotte à gauche du Gotchi, rxMax = crotte à droite).
    const nearPoop = window._gotchiNearPoop;
    const poopDir  = nearPoop ? _poopDirection(cx) : null; // -1 gauche, +1 droite, null aucune
    const rxRaw    = poopDir !== null
      ? (poopDir > 0 ? rxMax : 0)                              // regard vers la crotte
      : (Math.sin(Date.now() * 0.0008) * 0.5 + 0.5) * rxMax; // oscillation normale
    // RÔLE : Snap sur grille PX pour rester dans l'iris quelle que soit la valeur flottante.
    const rx = Math.floor(rxRaw / PX) * PX;
    p.rect(cx - PX * 2 + 1 + rx, cy + PX * 2, 3, 3); // œil gauche
    p.rect(cx + PX * 1 + 1 + rx, cy + PX * 2, 3, 3); // œil droit
  }

  // Épuisement (dither) — géré en dehors du DSL car drawDither() a sa propre logique
  // de damier qui ne passe pas par px() standard.
  if (en < EN_CRIT && !sl) {
    drawDither(p, cx - PX * 2, cy + PX * 3, PX * 4, PX * 3, C.bodyDk);
  }

  // Accessoires pixel-perfect — interface inchangée
  drawAccessoires(p, cx, { topY: cy, eyeY: cy + PX * 2, neckY: cy + PX * 4 }, 'baby', sl);

  // Couche de saleté — interface inchangée
  drawSaleteDither(p, 'baby', cx, cy, window.D?.g?.salete || 0, sl);

  return { topY: cy, eyeY: cy + PX * 2, neckY: cy + PX * 4 };
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

// RÔLE : Déterminer de quel côté se trouve la crotte la plus proche du Gotchi.
// POURQUOI : Utilisé par les reflets pupille pour simuler un regard latéral vers la crotte —
//            le Gotchi "la regarde du coin de l'œil" sans nouveau sprite.
//            Retourne +1 si la crotte est à droite de cx, -1 si à gauche, null si aucune.
// @param {number} cx - Position X de référence du Gotchi (cx ou cxB selon le stade)
// @returns {-1 | +1 | null}
function _poopDirection(cx) {
  const poops = (window.D && window.D.g && window.D.g.poops) || [];
  if (!poops.length) return null;
  // Trouver la crotte la plus proche
  let nearest = null;
  let minDist  = Infinity;
  for (const poop of poops) {
    const d = Math.abs(poop.x - cx);
    if (d < minDist) { minDist = d; nearest = poop; }
  }
  if (!nearest) return null;
  return nearest.x >= cx ? 1 : -1; // +1 droite, -1 gauche
}

/* ─── §5 STADE ADO ──────────────────────────────────────────────── */

// RÔLE : Définition DSL du sprite Ado — tableau de calques pour renderSprite().
// POURQUOI : Remplace les px() manuels de l'ancienne drawTeen().
//            Coordonnées en multiples de PX, relatives à cx (centre de marche = walkX).
//            drawTeen() passe cx directement à renderSprite().
//
// Repère : x_dsl = offset_depuis_x_original + (-4)
//          (car l'ancien code faisait x = cx - PX*4, donc offset_original était relatif à x)
//          ex. x+PX*2 → 2 + (-4) = -2  |  x+PX*5 → 5 + (-4) = 1  |  x-PX → -1 + (-4) = -5
//
// Abréviations params : pm.sl=sommeil, pm.en=énergie, pm.ha=bonheur,
//   pm.blink=clignotement, pm.breath=valeur 0→1, pm.mouthBaseY=y+PX*5 (calculé avant appel)
const LAYERS_TEEN = [

  // ── Corps rond fusionné (8×8 PX) ───────────────────────────────
  {
    id: 'corps',
    fill: 'C.body',
    rects: [
      { x: -2, y:  0, w: 4, h: 1 },   // arrondi haut
      { x: -3, y:  1, w: 6, h: 1 },
      { x: -4, y:  2, w: 8, h: 4 },   // milieu large (visage + corps)
      { x: -3, y:  6, w: 6, h: 1 },
      { x: -2, y:  7, w: 4, h: 1 },   // arrondi bas
    ]
  },

  // ── Highlights ──────────────────────────────────────────────────
  {
    id: 'highlights',
    fill: 'C.bodyLt',
    rects: [
      { x: -2, y: 1, w: 2, h: 1 },
      { x: -3, y: 2, w: 2, h: 1 },
    ]
  },

  // ── Oreilles d'ourson — corps (demi-cercles, couleur body) ─────
  // POURQUOI : Dessinées AVANT les yeux dans l'original — même ordre ici.
  //            rawDx:2 sur les sommets = sub-pixel +2px (arrondi pixel art).
  {
    id: 'oreilles-corps',
    fill: 'C.body',
    rects: [
      { x: -3, y: -1, w: 2, h: 1 },           // oreille gauche base
      { x: -3, y: -2, w: 2, h: 1 },           // oreille gauche milieu
      { x: -3, y: -3, w: 1, h: 1, rawDx: 2 }, // oreille gauche sommet arrondi
      { x:  1, y: -1, w: 2, h: 1 },           // oreille droite base
      { x:  1, y: -2, w: 2, h: 1 },           // oreille droite milieu
      { x:  1, y: -3, w: 1, h: 1, rawDx: 2 }, // oreille droite sommet arrondi
    ]
  },

  // ── Oreilles — intérieur rose (creux) ──────────────────────────
  {
    id: 'oreilles-interieur',
    fill: 'C.cheek',
    rects: [
      { x: -3, y: -1, w: 1, h: 1, rawDx: 2 }, // creux gauche
      { x:  1, y: -1, w: 1, h: 1, rawDx: 2 }, // creux droit
    ]
  },

  // ── Yeux fermés — sommeil, clignotement ou bâillement ───────────
  // POURQUOI : isMood('baillement') → paupières baissées pendant le bâillement (teen).
  {
    id: 'yeux-fermes',
    fill: 'C.eye',
    when: (pm) => pm.sl || pm.blink || isMood('baillement'),
    rects: [
      { x: -3, y: 3, w: 2, h: 1 },   // œil gauche fermé
      { x:  1, y: 3, w: 2, h: 1 },   // œil droit fermé
    ]
  },

  // ── Yeux surprise (carrés pleins 2×2 PX) ───────────────────────
  {
    id: 'yeux-surprise',
    fill: 'C.eye',
    when: (pm) => !pm.sl && !pm.blink && isMood('surprise'),
    rects: [
      { x: -3, y: 2, w: 2, h: 2 },   // œil gauche carré
      { x:  1, y: 2, w: 2, h: 2 },   // œil droit carré
    ]
  },

  // NOTE : reflets-yeux-surprise supprimé — les reflets normaux (p.rect dans drawTeen)
  // restent désormais actifs pendant surprise, ce qui est plus propre et évite la superposition.

  // ── Yeux ouverts normaux (amande 2 rangées) ─────────────────────
  // POURQUOI : masqués pendant le bâillement (yeux-fermes prend le dessus).
  {
    id: 'yeux-ouverts',
    fill: 'C.eye',
    when: (pm) => !pm.sl && !pm.blink && !isMood('surprise') && !isMood('baillement'),
    rects: [
      { x: -3, y: 2, w: 2, h: 1 },   // œil gauche haut large
      { x: -2, y: 3, w: 1, h: 1 },   // œil gauche bas étroit
      { x:  1, y: 2, w: 2, h: 1 },   // œil droit haut large
      { x:  1, y: 3, w: 1, h: 1 },   // œil droit bas étroit
    ]
  },

  // ── Dégoût poop (par-dessus les yeux normaux) ───────────────────
  // NOTE : Le calque 'reflets-yeux-ouverts' a été retiré du DSL (LAYERS_TEEN).
  // Les reflets blancs sont désormais dessinés directement via p.rect() dans drawTeen()
  // pour obtenir un mouvement sub-pixel flottant (pas de snap via px()).
  {
    id: 'yeux-poop',
    fill: 'C.eye',
    when: (pm) => !!window._gotchiNearPoop && !pm.sl,
    rects: [
      { x: -3, y: 2, w: 2, h: 1 },
      { x:  1, y: 2, w: 2, h: 1 },
    ]
  },

  // ── Joues pulsantes (couleur interpolée dynamiquement) ──────────
  // POURQUOI : p.lerpColor ne peut pas être une clé statique — fillFn calcule
  //            la couleur à chaque frame à partir de getCheekPulse().
  {
    id: 'joues',
    fillFn: (pm, p) => p.lerpColor(p.color(C.cheek), p.color('#e88098'), pm.pulse),
    rects: [
      { x: -3, y: 4, w: 1, h: 1 },   // joue gauche
      { x:  2, y: 4, w: 1, h: 1 },   // joue droite
    ]
  },

  // ── Joues débordantes si joie (semi-transparentes) ──────────────
  {
    id: 'joues-joie',
    fillFn: (pm, p) => p.lerpColor(p.color(C.cheek), p.color('#e88098'), pm.pulse),
    alpha: 0.7,
    when: (pm) => isMood('joie'),
    rects: [
      { x: -4, y: 4, w: 1, h: 1 },   // débordement gauche
      { x:  3, y: 4, w: 1, h: 1 },   // débordement droit
    ]
  },

  // ── Bouche bâillement (priorité max — bouche "O" 2×2 PX) ────────
  // RÔLE : Bouche ouverte ronde pendant le bâillement. Écrase toutes les autres bouches.
  // POURQUOI : Calque placé avant bouche-joie — la condition isMood('baillement') est
  //            exclusive, les autres bouches vérifient !isMood('baillement').
  {
    id: 'bouche-baillement',
    fill: 'C.mouth',
    when: (pm) => !pm.sl && isMood('baillement'),
    rects: [
      { x: -1, y: 0, w: 2, h: 2, yFn: (pm) => pm.mouthBaseY },  // carré 2×2 = bouche "O"
    ]
  },

  // ── Bouche joie (grand sourire avec coins relevés) ───────────────
  // POURQUOI : mouthBaseY = cy + PX*5 + Math.floor(breath*3) — position Y dynamique ∈ {0,1,2}.
  //            yFn calcule la position absolue du rect à chaque frame.
  {
    id: 'bouche-joie',
    fill: 'C.mouth',
    when: (pm) => !pm.sl && isMood('joie') && !isMood('baillement'),
    rects: [
      { x: -2, y: 0, w: 4, h: 1, yFn: (pm) => pm.mouthBaseY + PX },   // ligne principale
      { x: -3, y: 0, w: 1, h: 1, yFn: (pm) => pm.mouthBaseY      },   // coin gauche relevé
      { x:  2, y: 0, w: 1, h: 1, yFn: (pm) => pm.mouthBaseY      },   // coin droit relevé
    ]
  },

  // ── Bouche faim (ouverte, baveuse) ──────────────────────────────
  {
    id: 'bouche-faim',
    fill: 'C.mouth',
    when: (pm) => !pm.sl && isMood('faim'),
    rects: [
      { x: -1, y: 0, w: 2, h: 2, yFn: (pm) => pm.mouthBaseY },   // bouche ouverte
    ]
  },

  // ── Goutte de bave (faim) — hex littérale, calque séparé ────────
  {
    id: 'bouche-faim-bave',
    fill: '#88c0e0',
    when: (pm) => !pm.sl && isMood('faim'),
    rects: [
      { x: -1, y: 0, w: 1, h: 1, yFn: (pm) => pm.mouthBaseY + PX * 2 },
    ]
  },

  // ── Bouche surprise (petit "o") ──────────────────────────────────
  {
    id: 'bouche-surprise',
    fill: 'C.mouth',
    when: (pm) => !pm.sl && isMood('surprise'),
    rects: [
      { x: -1, y: 0, w: 2, h: 2, yFn: (pm) => pm.mouthBaseY },
    ]
  },

  // ── Bouche sourire ha élevé ──────────────────────────────────────
  {
    id: 'bouche-sourire-ha',
    fill: 'C.mouth',
    when: (pm) => !pm.sl && !isMood('baillement') && !isMood('joie') && !isMood('faim') && !isMood('surprise') && pm.ha > HA_HAPPY_TEEN,
    rects: [
      { x: -1, y: 0, w: 2, h: 1, yFn: (pm) => pm.mouthBaseY },   // centre
      { x: -2, y: 0, w: 1, h: 1, yFn: (pm) => pm.mouthBaseY },   // coin gauche
      { x:  1, y: 0, w: 1, h: 1, yFn: (pm) => pm.mouthBaseY },   // coin droit
    ]
  },

  // ── Bouche sourire neutre ────────────────────────────────────────
  {
    id: 'bouche-neutre',
    fill: 'C.mouth',
    when: (pm) => !pm.sl && !isMood('baillement') && !isMood('joie') && !isMood('faim') && !isMood('surprise') && pm.ha <= HA_HAPPY_TEEN && pm.ha > HA_MED,
    rects: [
      { x: -1, y: 0, w: 2, h: 1, yFn: (pm) => pm.mouthBaseY },
    ]
  },

  // ── Bouche triste ────────────────────────────────────────────────
  {
    id: 'bouche-triste',
    fill: 'C.mouth',
    when: (pm) => !pm.sl && !isMood('baillement') && !isMood('joie') && !isMood('faim') && !isMood('surprise') && pm.ha < HA_SAD,
    rects: [
      { x: -1, y: 0, w: 2, h: 1, yFn: (pm) => pm.mouthBaseY, rawDy: 2 },
    ]
  },

  // ── Bouche par défaut (point) ────────────────────────────────────
  {
    id: 'bouche-defaut',
    fill: 'C.mouth',
    when: (pm) => !pm.sl && !isMood('baillement') && !isMood('joie') && !isMood('faim') && !isMood('surprise') && pm.ha >= HA_SAD && pm.ha <= HA_MED,
    rects: [
      { x: -1, y: 0, w: 1, h: 1, yFn: (pm) => pm.mouthBaseY },
    ]
  },

  // ── Bras normaux (énergie correcte) ────────────────────────────
  {
    id: 'bras-normaux',
    fill: 'C.bodyDk',
    when: (pm) => !pm.sl && pm.en >= EN_WARN,
    rects: [
      { x: -5, y: 4, w: 1, h: 2 },   // bras gauche
      { x:  4, y: 4, w: 1, h: 2 },   // bras droit
    ]
  },

  // ── Célébration : bras gauche levé teen (ha≥4, pose temporaire via animator) ──
  // POURQUOI : when:false → rendu uniquement via aov.visible (animator).
  //            Pixel coude x:-5,y:1 assure la liaison bras (y:2)→main (x:-6,y:1).
  {
    id: 'teen-bras-g-leve',
    fill: 'C.bodyDk',
    when: () => false,
    rects: [
      { x: -5, y: 2, w: 1, h: 2 },   // bras gauche levé (y:2→3)
      { x: -5, y: 1, w: 1, h: 1 },   // coude gauche — liaison bras→main
      { x: -6, y: 1, w: 1, h: 1 },   // main gauche (décalée à gauche)
      { x:  4, y: 4, w: 1, h: 2 },   // bras droit normal
    ]
  },

  // ── Célébration : bras droit levé teen (ha≥4, pose temporaire via animator) ──
  // POURQUOI : Pixel coude x:4,y:1 assure la liaison bras (y:2)→main (x:5,y:1).
  {
    id: 'teen-bras-d-leve',
    fill: 'C.bodyDk',
    when: () => false,
    rects: [
      { x: -5, y: 4, w: 1, h: 2 },   // bras gauche normal
      { x:  4, y: 2, w: 1, h: 2 },   // bras droit levé (y:2→3)
      { x:  4, y: 1, w: 1, h: 1 },   // coude droit — liaison bras→main
      { x:  5, y: 1, w: 1, h: 1 },   // main droite (décalée à droite)
    ]
  },

  // ── Célébration : les deux bras levés teen (ha=5, pose temporaire via animator) ──
  {
    id: 'teen-bras-2-leves',
    fill: 'C.bodyDk',
    when: () => false,
    rects: [
      { x: -5, y: 2, w: 1, h: 2 },   // bras gauche levé
      { x: -5, y: 1, w: 1, h: 1 },   // coude gauche
      { x: -6, y: 1, w: 1, h: 1 },   // main gauche
      { x:  4, y: 2, w: 1, h: 2 },   // bras droit levé
      { x:  4, y: 1, w: 1, h: 1 },   // coude droit
      { x:  5, y: 1, w: 1, h: 1 },   // main droite
    ]
  },

  // ── Bras tombés (énergie faible) ────────────────────────────────
  {
    id: 'bras-tombes',
    fill: 'C.bodyDk',
    when: (pm) => !pm.sl && pm.en < EN_WARN,
    rects: [
      { x: -5, y: 5, w: 1, h: 1 },   // bras gauche tombé
      { x:  4, y: 5, w: 1, h: 1 },   // bras droit tombé
    ]
  },

  // ── Pieds ────────────────────────────────────────────────────────
  {
    id: 'pieds',
    fill: 'C.bodyDk',
    rects: [
      { x: -2, y: 8, w: 1, h: 1 },   // pied gauche
      { x:  1, y: 8, w: 1, h: 1 },   // pied droit
    ]
  },
];

function drawTeen(p, cx, cy, sl, en, ha) {
  // RÔLE : Scheduler de poses célébration pour le teen (ha=5 uniquement).
  // POURQUOI : Le teen n'a pas de poses idle normales — ce scheduler se déclenche
  //            uniquement quand ha > HA_ARMS_UP pour lever les bras de façon dynamique.
  //            Même mécanique que le scheduler adult : cooldown puis tirage au sort.
  const teenPose = window._teenPose;
  const teenPoseIds = ['teen_pose_bras_g_leve', 'teen_pose_bras_d_leve', 'teen_pose_bras_2_leves'];
  const isTeen  = true; // garde pour clarté
  const isTJumping = window.animator?.active.some(a => a.id === 'saut_joie') ?? false;
  const isTPosing  = window.animator?.active.some(a => teenPoseIds.includes(a.id)) ?? false;
  const canTVary   = !sl && !isTJumping && !isTPosing;

  if (en >= EN_WARN && ha >= HA_ARMS_UP && canTVary) {
    // RÔLE : Décompter le cooldown puis déclencher une pose célébration au sort.
    // POURQUOI : Actif à ha=4 (HA_ARMS_UP) et ha=5 — avec un tirage plus rare à ha=4
    //            (1 chance sur 3 de déclencher une vraie pose, sinon on recharge le cooldown)
    //            pour refléter un enthousiasme modéré plutôt que de l'exubérance.
    if (teenPose.cooldown > 0) {
      teenPose.cooldown--;
    } else {
      const r = Math.random();
      if (ha > HA_ARMS_UP) {
        // ha=5 — les 3 poses à égalité
        if      (r < 0.33) { window.animator.trigger('teen_pose_bras_g_leve',  { duration: 18 + Math.floor(Math.random() * 12) }); }
        else if (r < 0.66) { window.animator.trigger('teen_pose_bras_d_leve',  { duration: 18 + Math.floor(Math.random() * 12) }); }
        else               { window.animator.trigger('teen_pose_bras_2_leves', { duration: 24 + Math.floor(Math.random() * 12) }); }
      } else {
        // ha=4 — seulement bras gauche ou droit (pas les deux levés), 67% de déclenchement
        // POURQUOI : Les deux bras levés = joie maximale, réservé au niveau 5.
        //            À ha=4 on lève un bras sur deux, et 33% du temps on ne fait rien.
        if      (r < 0.33) { window.animator.trigger('teen_pose_bras_g_leve', { duration: 18 + Math.floor(Math.random() * 12) }); }
        else if (r < 0.66) { window.animator.trigger('teen_pose_bras_d_leve', { duration: 18 + Math.floor(Math.random() * 12) }); }
        // else : 34% du temps, pas de pose — le cooldown repart quand même
      }
      teenPose.cooldown = 60 + Math.floor(Math.random() * 60); // 5–10s avant la prochaine
    }
  }

  // RÔLE : Calculer la respiration pour les reflets oculaires et le dither.
  // POURQUOI : breathX n'est pas appliqué à cx avant renderSprite() — les x DSL intègrent
  //            déjà le décalage de base (-4). breathX est conservé séparément pour les
  //            reflets (p.rect) et le dither qui utilisent cxB comme référence absolue.
  const breath  = getBreath(p);
  // RÔLE : breathX — décalage horizontal du corps selon la phase de respiration.
  // POURQUOI : Math.floor(x*3)-1 donne {-1,0,1} de façon équitable (Math.round biaisait vers 0).
  const breathX = sl ? 0 : Math.floor(breath * 3) - 1; // ∈ {-1, 0, 1} — distribution équitable
  const cxB     = cx - PX * 4 - breathX; // référence absolue pour reflets + dither uniquement

  // RÔLE : mouthBaseY est la position Y de base de la bouche, animée par la respiration.
  // POURQUOI : Les calques bouche utilisent yFn qui lit pm.mouthBaseY — calculé une seule
  //            fois ici, pas à chaque rect pour éviter les divergences.
  //            Math.floor(x*3) donne {0,1,2} équitable au lieu du {0,1,2} biaisé de Math.round.
  const mouthBaseY = cy + PX * 5 + Math.floor(breath * 3); // ∈ {0, 1, 2} — distribution équitable

  const params = {
    sl, en, ha,
    blink,
    breath,
    pulse: getCheekPulse(p),
    mouthBaseY,
  };

  // RÔLE : Passer cx (centre de marche) à renderSprite, pas cxB.
  // POURQUOI : Les x DSL dans LAYERS_TEEN sont déjà calculés avec la formule
  //            x_dsl = offset_original + (-4), ce qui intègre le décalage -4*PX.
  //            Passer cxB (= cx - PX*4) doublerait ce décalage et décalerait
  //            le sprite de 4*PX = 20px vers la gauche — c'est le bug du décalage.
  renderSprite(p, LAYERS_TEEN, cx, cy, params);

  // RÔLE : Reflet snappé sur grille PX, avec regard latéral vers la crotte si proche.
  // POURQUOI : Snap PX-grid → reste dans la rangée haute de l'iris (Bug 1 fix).
  //            Regard crotte : même logique que drawBaby — poopDir pilote la position.
  // POURQUOI : !isMood('surprise') retiré — les reflets doivent rester visibles même en
  //            mode surprise (les yeux surprise sont plus grands, les reflets y ont leur place).
  //            Les calques reflets-yeux-surprise du DSL ont été retirés pour éviter la superposition.
  //            Couleur : D.g.pupilColor (personnalisable dans l'onglet Perso) — blanc par défaut.
  //            Guard baillement : même raison que drawBaby — yeux fermés pendant bâillement.
  if (!params.sl && !params.blink && !isMood('baillement')) {
    const _pupilEntry = window.HG_CONFIG.PUPIL_COLORS.find(c => c.id === (window.D?.g?.pupilColor ?? 'blanc'));
    p.fill(_pupilEntry ? _pupilEntry.hex : '#ffffff');
    p.noStroke();
    // Iris teen rangée haute : 2×PX = 10px. Espace dispo = 10 - 3reflet - 3margeD - 1margeG = 4px (1px de moins que baby).
    const rxMax = PX * 2 - 3 - 3; // 4px
    const nearPoop = window._gotchiNearPoop;
    const poopDir  = nearPoop ? _poopDirection(cxB) : null;
    const rxRaw    = poopDir !== null
      ? (poopDir > 0 ? rxMax : 0)
      : (Math.sin(Date.now() * 0.0008) * 0.5 + 0.5) * rxMax;
    // Iris teen DSL : œil gauche à x:-3 (cx - 3*PX), œil droit à x:1 (cx + 1*PX)
    const rx = Math.floor(rxRaw / PX) * PX;
    p.rect(cx - PX * 3 + 1 + rx, cy + PX * 2 + 1, 3, 3); // œil gauche
    p.rect(cx + PX * 1 + 1 + rx, cy + PX * 2 + 1, 3, 3); // œil droit
  }

  // Épuisement dither — hors DSL (drawDither a sa propre logique de damier).
  // POURQUOI : x original = cxB (déjà décalé), y = cy + PX*4, w = 8*PX, h = 5*PX.
  if (en < EN_CRIT && !sl) {
    drawDither(p, cxB, cy + PX * 4, PX * 8, PX * 5, C.bodyDk);
  }

  // RÔLE : Passer cx (centre de marche = walkX) à drawAccessoires.
  // POURQUOI : drawAccessoires calcule accX = cx - largeur/2 pour centrer l'accessoire.
  //            Le centre visuel réel du corps teen est cxB + 4*PX = cx.
  //            Passer cx est donc correct — l'accessoire est centré sur le gotchi.
  //            (Passer cxB décalerait les accessoires de 20px vers la gauche.)
  drawAccessoires(p, cx, { topY: cy, eyeY: cy + PX * 2, neckY: cy + PX * 5 }, 'teen', sl);
  drawSaleteDither(p, 'teen', cx, cy, window.D?.g?.salete || 0, sl);

  return { topY: cy, eyeY: cy + PX * 2, neckY: cy + PX * 5 };
}

/* ─── §6 STADE ADULTE ───────────────────────────────────────────── */

// RÔLE : Définition DSL du sprite Adulte — tableau de calques pour renderSprite().
// POURQUOI : Remplace les px() manuels de l'ancienne drawAdult().
//            Coordonnées en multiples de PX, relatives à cx (centre de marche = walkX).
//            drawAdult() passe cx directement à renderSprite().
//
// Repère : x_dsl = offset_depuis_x_original + (-5)
//          (car l'ancien code faisait x = cx - PX*5, donc offset_original était relatif à x)
//          ex. x+PX*3 → -2  |  x+PX*6 → 1  |  x-PX → -6  |  x+PX*10 → 5  |  x+PX*11 → 6
//
// params spécifiques adult : pm.stepPhase (0|1|-1), pm.pulse, pm.mouthBaseY,
//   pm.sl, pm.en, pm.ha, pm.blink
// Note : pm.pose supprimé (Temps 3) — les poses idle sont pilotées par aov.hidden/visible.
const LAYERS_ADULT = [

  // ── Corps rond fusionné (10×10 PX) ─────────────────────────────
  {
    id: 'corps',
    fill: 'C.body',
    rects: [
      { x: -2, y:  0, w:  4, h: 1 },   // arrondi haut
      { x: -3, y:  1, w:  6, h: 1 },
      { x: -4, y:  2, w:  8, h: 1 },
      { x: -5, y:  3, w: 10, h: 4 },   // milieu très large
      { x: -4, y:  7, w:  8, h: 1 },
      { x: -3, y:  8, w:  6, h: 1 },
      { x: -2, y:  9, w:  4, h: 1 },   // arrondi bas
    ]
  },

  // ── Highlights ──────────────────────────────────────────────────
  {
    id: 'highlights',
    fill: 'C.bodyLt',
    rects: [
      { x: -2, y: 1, w: 2, h: 1 },
      { x: -3, y: 2, w: 2, h: 1 },
      { x: -4, y: 3, w: 2, h: 1 },
    ]
  },

  // ── Oreilles d'ourson — corps ───────────────────────────────────
  {
    id: 'oreilles-corps',
    fill: 'C.body',
    rects: [
      { x: -3, y: -1, w: 2, h: 1 },           // oreille gauche base
      { x: -3, y: -2, w: 2, h: 1 },           // oreille gauche milieu
      { x: -3, y: -3, w: 1, h: 1, rawDx: 2 }, // oreille gauche sommet
      { x:  1, y: -1, w: 2, h: 1 },           // oreille droite base
      { x:  1, y: -2, w: 2, h: 1 },           // oreille droite milieu
      { x:  1, y: -3, w: 1, h: 1, rawDx: 2 }, // oreille droite sommet
    ]
  },

  // ── Oreilles — intérieur rose ───────────────────────────────────
  {
    id: 'oreilles-interieur',
    fill: 'C.cheek',
    rects: [
      { x: -3, y: -1, w: 1, h: 1, rawDx: 2 },
      { x:  1, y: -1, w: 1, h: 1, rawDx: 2 },
    ]
  },

  // ── Yeux fermés — sommeil, clignotement ou bâillement ───────────
  // POURQUOI : isMood('baillement') → paupières baissées pendant le bâillement (adult).
  {
    id: 'yeux-fermes',
    fill: 'C.eye',
    when: (pm) => pm.sl || pm.blink || isMood('baillement'),
    rects: [
      { x: -3, y: 4, w: 3, h: 1 },   // œil gauche fermé
      { x:  1, y: 4, w: 3, h: 1 },   // œil droit fermé
    ]
  },

  // ── Yeux surprise (carrés 3×2 PX) ──────────────────────────────
  {
    id: 'yeux-surprise',
    fill: 'C.eye',
    when: (pm) => !pm.sl && !pm.blink && isMood('surprise'),
    rects: [
      { x: -3, y: 3, w: 3, h: 2 },
      { x:  1, y: 3, w: 3, h: 2 },
    ]
  },

  // NOTE : reflets-yeux-surprise supprimé — même raison que LAYERS_TEEN.

  // ── Yeux ouverts normaux (amande 2 rangées) ─────────────────────
  // POURQUOI : masqués pendant le bâillement (yeux-fermes prend le dessus).
  {
    id: 'yeux-ouverts',
    fill: 'C.eye',
    when: (pm) => !pm.sl && !pm.blink && !isMood('surprise') && !isMood('baillement'),
    rects: [
      { x: -3, y: 3, w: 3, h: 1 },   // œil gauche haut large
      { x: -2, y: 4, w: 2, h: 1 },   // œil gauche bas étroit
      { x:  1, y: 3, w: 3, h: 1 },   // œil droit haut large
      { x:  1, y: 4, w: 2, h: 1 },   // œil droit bas étroit
    ]
  },

  // ── Dégoût poop ─────────────────────────────────────────────────
  // NOTE : Le calque 'reflets-yeux-ouverts' a été retiré du DSL (LAYERS_ADULT).
  // Les reflets blancs sont désormais dessinés directement via p.rect() dans drawAdult()
  // pour obtenir un mouvement sub-pixel flottant (pas de snap via px()).
  {
    id: 'yeux-poop',
    fill: 'C.eye',
    when: (pm) => !!window._gotchiNearPoop && !pm.sl,
    rects: [
      { x: -3, y: 3, w: 3, h: 1 },
      { x:  1, y: 3, w: 3, h: 1 },
    ]
  },

  // ── Joues pulsantes ─────────────────────────────────────────────
  {
    id: 'joues',
    fillFn: (pm, p) => p.lerpColor(p.color(C.cheek), p.color('#e88098'), pm.pulse),
    rects: [
      { x: -3, y: 6, w: 1, h: 1 },
      { x:  2, y: 6, w: 1, h: 1 },
    ]
  },

  // ── Joues débordantes joie ──────────────────────────────────────
  {
    id: 'joues-joie',
    fillFn: (pm, p) => p.lerpColor(p.color(C.cheek), p.color('#e88098'), pm.pulse),
    alpha: 0.7,
    when: (pm) => isMood('joie'),
    rects: [
      { x: -4, y: 6, w: 1, h: 1 },
      { x:  3, y: 6, w: 1, h: 1 },
    ]
  },

  // ── Bouche bâillement (priorité max — bouche "O" 2×2 PX) ────────
  // RÔLE : Bouche ouverte ronde pendant le bâillement (adult).
  {
    id: 'bouche-baillement',
    fill: 'C.mouth',
    when: (pm) => !pm.sl && isMood('baillement'),
    rects: [
      { x: -1, y: 0, w: 2, h: 2, yFn: (pm) => pm.mouthBaseY },  // carré 2×2 = bouche "O"
    ]
  },

  // ── Bouche joie ─────────────────────────────────────────────────
  {
    id: 'bouche-joie',
    fill: 'C.mouth',
    when: (pm) => !pm.sl && isMood('joie') && !isMood('baillement'),
    rects: [
      { x: -2, y: 0, w: 4, h: 1, yFn: (pm) => pm.mouthBaseY + PX },   // ligne principale
      { x: -3, y: 0, w: 1, h: 1, yFn: (pm) => pm.mouthBaseY      },   // coin gauche
      { x:  2, y: 0, w: 1, h: 1, yFn: (pm) => pm.mouthBaseY      },   // coin droit
    ]
  },

  // ── Bouche faim ─────────────────────────────────────────────────
  {
    id: 'bouche-faim',
    fill: 'C.mouth',
    when: (pm) => !pm.sl && isMood('faim'),
    rects: [
      { x: -1, y: 0, w: 2, h: 2, yFn: (pm) => pm.mouthBaseY },
    ]
  },

  // ── Goutte bave (faim) ───────────────────────────────────────────
  {
    id: 'bouche-faim-bave',
    fill: '#88c0e0',
    when: (pm) => !pm.sl && isMood('faim'),
    rects: [
      { x: -1, y: 0, w: 1, h: 1, yFn: (pm) => pm.mouthBaseY + PX * 2 },
    ]
  },

  // ── Bouche surprise ──────────────────────────────────────────────
  {
    id: 'bouche-surprise',
    fill: 'C.mouth',
    when: (pm) => !pm.sl && isMood('surprise'),
    rects: [
      { x: -1, y: 0, w: 2, h: 2, yFn: (pm) => pm.mouthBaseY },
    ]
  },

  // ── Bouche grand sourire ha (ha > HA_HIGH) ───────────────────────
  {
    id: 'bouche-sourire-ha',
    fill: 'C.mouth',
    when: (pm) => !pm.sl && !isMood('baillement') && !isMood('joie') && !isMood('faim') && !isMood('surprise') && pm.ha > HA_HIGH,
    rects: [
      { x: -2, y: 0, w: 4, h: 1, yFn: (pm) => pm.mouthBaseY + PX },   // barre bas
      { x: -3, y: 0, w: 1, h: 1, yFn: (pm) => pm.mouthBaseY      },   // coin gauche
      { x:  2, y: 0, w: 1, h: 1, yFn: (pm) => pm.mouthBaseY      },   // coin droit
    ]
  },

  // ── Bouche sourire neutre (ha > HA_MED_ADULT) ───────────────────
  {
    id: 'bouche-neutre',
    fill: 'C.mouth',
    when: (pm) => !pm.sl && !isMood('baillement') && !isMood('joie') && !isMood('faim') && !isMood('surprise') && pm.ha <= HA_HIGH && pm.ha > HA_MED_ADULT,
    rects: [
      { x: -1, y: 0, w: 2, h: 1, yFn: (pm) => pm.mouthBaseY },
    ]
  },

  // ── Bouche triste (ha < HA_SAD) — coin + barre décalée +2px ─────
  {
    id: 'bouche-triste',
    fill: 'C.mouth',
    when: (pm) => !pm.sl && !isMood('baillement') && !isMood('joie') && !isMood('faim') && !isMood('surprise') && pm.ha < HA_SAD,
    rects: [
      { x: -1, y: 0, w: 2, h: 1, yFn: (pm) => pm.mouthBaseY, rawDy: 2 },   // barre décalée
      { x: -2, y: 0, w: 1, h: 1, yFn: (pm) => pm.mouthBaseY             },   // coin
    ]
  },

  // ── Bouche point (défaut) ────────────────────────────────────────
  {
    id: 'bouche-defaut',
    fill: 'C.mouth',
    when: (pm) => !pm.sl && !isMood('baillement') && !isMood('joie') && !isMood('faim') && !isMood('surprise') && pm.ha >= HA_SAD && pm.ha <= HA_MED_ADULT,
    rects: [
      { x: -1, y: 0, w: 1, h: 1, yFn: (pm) => pm.mouthBaseY },
    ]
  },

  // ── Bras tombés (énergie faible) ────────────────────────────────
  {
    id: 'bras-tombes',
    fill: 'C.bodyDk',
    when: (pm) => !pm.sl && pm.en < EN_WARN,
    rects: [
      { x: -6, y: 6, w: 1, h: 2 },
      { x:  5, y: 6, w: 1, h: 2 },
    ]
  },

  // ── Célébration : bras gauche levé (ha=5, pose temporaire via animator) ──
  // POURQUOI : when:false → rendu uniquement via aov.visible (animator).
  //            Le bras droit reste en position normale (bras-normal affiché en dessous).
  //            Pixel coude x:-6,y:2 assure la liaison entre le bras (y:3) et la main (x:-7,y:2).
  {
    id: 'bras-g-leve',
    fill: 'C.bodyDk',
    when: () => false,
    rects: [
      { x: -6, y: 3, w: 1, h: 2 },   // bras gauche levé (y:3→4)
      { x: -6, y: 2, w: 1, h: 1 },   // coude gauche — liaison bras→main
      { x: -7, y: 2, w: 1, h: 1 },   // main gauche (décalée à gauche)
      { x:  5, y: 5, w: 1, h: 2 },   // bras droit normal
    ]
  },

  // ── Célébration : bras droit levé (ha=5, pose temporaire via animator) ──
  // POURQUOI : Pixel coude x:5,y:2 assure la liaison entre le bras (y:3) et la main (x:6,y:2).
  {
    id: 'bras-d-leve',
    fill: 'C.bodyDk',
    when: () => false,
    rects: [
      { x: -6, y: 5, w: 1, h: 2 },   // bras gauche normal
      { x:  5, y: 3, w: 1, h: 2 },   // bras droit levé (y:3→4)
      { x:  5, y: 2, w: 1, h: 1 },   // coude droit — liaison bras→main
      { x:  6, y: 2, w: 1, h: 1 },   // main droite (décalée à droite)
    ]
  },

  // ── Célébration : les deux bras levés (ha=5, pose temporaire via animator) ──
  {
    id: 'bras-2-leves',
    fill: 'C.bodyDk',
    when: () => false,
    rects: [
      { x: -6, y: 3, w: 1, h: 2 },   // bras gauche levé
      { x: -6, y: 2, w: 1, h: 1 },   // coude gauche
      { x: -7, y: 2, w: 1, h: 1 },   // main gauche
      { x:  5, y: 3, w: 1, h: 2 },   // bras droit levé
      { x:  5, y: 2, w: 1, h: 1 },   // coude droit
      { x:  6, y: 2, w: 1, h: 1 },   // main droite
    ]
  },

  // ── Pose hanche gauche ───────────────────────────────────────────
  // POURQUOI : Plus de `when` — ce calque est affiché uniquement via aov.visible
  //            (déclenché par animator 'pose_hanche_g'). Sans aov.visible, il reste caché.
  {
    id: 'bras-hanche-g',
    fill: 'C.bodyDk',
    when: () => false, // caché par défaut — rendu uniquement via aov.visible
    rects: [
      { x: -4, y: 5, w: 2, h: 1 },   // avant-bras horizontal gauche
      { x: -5, y: 4, w: 1, h: 2 },   // coude gauche
      { x:  5, y: 5, w: 1, h: 2 },   // bras droit normal
    ]
  },

  // ── Pose hanche droite ───────────────────────────────────────────
  {
    id: 'bras-hanche-d',
    fill: 'C.bodyDk',
    when: () => false, // caché par défaut — rendu uniquement via aov.visible
    rects: [
      { x: -6, y: 5, w: 1, h: 2 },   // bras gauche normal
      { x:  2, y: 7, w: 2, h: 1 },   // avant-bras horizontal droit
      { x:  5, y: 6, w: 1, h: 2 },   // coude droit
    ]
  },

  // ── Pose bras croisés ────────────────────────────────────────────
  {
    id: 'bras-croises',
    fill: 'C.bodyDk',
    when: () => false, // caché par défaut — rendu uniquement via aov.visible
    rects: [
      { x: -6, y: 4, w: 1, h: 1 },   // coude gauche
      { x: -5, y: 5, w: 4, h: 1 },   // avant-bras gauche
      { x:  1, y: 5, w: 4, h: 1 },   // avant-bras droit
      { x:  5, y: 4, w: 1, h: 1 },   // coude droit
    ]
  },

  // ── Pose salut ───────────────────────────────────────────────────
  {
    id: 'bras-salut',
    fill: 'C.bodyDk',
    when: () => false, // caché par défaut — rendu uniquement via aov.visible
    rects: [
      { x: -6, y: 2, w: 1, h: 3 },   // bras gauche levé vertical
      { x: -6, y: 1, w: 1, h: 1 },   // main gauche au sommet
      { x:  5, y: 5, w: 1, h: 2 },   // bras droit normal
    ]
  },

  // ── Pose normale ─────────────────────────────────────────────────
  // POURQUOI : Affiché par défaut quand les bras sont en mode idle (éveillé, énergie ok).
  //            S'affiche aussi au niveau 5 — les poses célébration se superposent dessus
  //            via animator (aov.visible), donc bras-normal sert de fallback entre les poses.
  //            Masqué via aov.hidden quand une pose variante (idle ou célébration) est active.
  {
    id: 'bras-normal',
    fill: 'C.bodyDk',
    when: (pm) => !pm.sl && pm.en >= EN_WARN,  // plus de condition ha — actif à tous niveaux
    rects: [
      { x: -6, y: 5, w: 1, h: 2 },
      { x:  5, y: 5, w: 1, h: 2 },
    ]
  },

  // ── Pieds — immobiles (les deux au sol) ──────────────────────────
  {
    id: 'pieds-immobiles',
    fill: 'C.bodyDk',
    when: (pm) => pm.stepPhase === -1,
    rects: [
      { x: -2, y: 10, w: 2, h: 1 },
      { x:  1, y: 10, w: 2, h: 1 },
    ]
  },

  // ── Pieds — phase 0 (gauche au sol, droit levé) ─────────────────
  // POURQUOI : rawDy:-1 sur le pied levé reproduit le décalage "y+PX*10 - 1" de l'original.
  {
    id: 'pieds-phase0',
    fill: 'C.bodyDk',
    when: (pm) => pm.stepPhase === 0,
    rects: [
      { x: -2, y: 10, w: 2, h: 1           },   // gauche au sol
      { x:  1, y: 10, w: 2, h: 1, rawDy: -1},   // droit levé
    ]
  },

  // ── Pieds — phase 1 (gauche levé, droit au sol) ─────────────────
  {
    id: 'pieds-phase1',
    fill: 'C.bodyDk',
    when: (pm) => pm.stepPhase === 1,
    rects: [
      { x: -2, y: 10, w: 2, h: 1, rawDy: -1},   // gauche levé
      { x:  1, y: 10, w: 2, h: 1           },   // droit au sol
    ]
  },
];

function drawAdult(p, cx, cy, sl, en, ha) {
  // RÔLE : Scheduler des poses idle — décide QUAND et LAQUELLE déclencher.
  // POURQUOI : _adultPose ne stocke plus que le cooldown entre deux poses.
  //            La pose active est portée par animator (pile active) — c'est
  //            aov.hidden / aov.visible dans renderSprite() qui pilote les calques.
  const pose = window._adultPose;

  // RÔLE : Bloquer les poses idle pendant un saut ou pendant le sommeil.
  // POURQUOI : Pendant un saut, déclencher une pose changerait les bras au milieu
  //            de l'animation — visuellement incohérent.
  const isJumping = window.animator?.active.some(a => a.id === 'saut_joie') ?? false;
  // RÔLE : Vérifier si une pose idle est déjà en cours dans l'animator.
  // POURQUOI : Évite de déclencher une nouvelle pose avant que la précédente soit terminée.
  // RÔLE : Lister toutes les poses possibles — idle normales + célébration ha=5.
  // POURQUOI : isPosing bloque le déclenchement d'une nouvelle pose tant que la courante tourne.
  const poseIds = ['pose_hanche_g', 'pose_hanche_d', 'pose_croises', 'pose_salut',
                   'pose_bras_g_leve', 'pose_bras_d_leve', 'pose_bras_2_leves'];
  const isPosing = window.animator?.active.some(a => poseIds.includes(a.id)) ?? false;
  const canVary = !sl && !isJumping && !isPosing;

  if (en >= EN_WARN) {
    // RÔLE : Faire tourner le cooldown entre deux poses, puis tirer au sort.
    // POURQUOI : Le scheduler tourne maintenant à tous les niveaux de bonheur.
    //            Quand ha=5, les poses célébration (bras en l'air) s'ajoutent au tirage
    //            avec 50% de probabilité combinée — les poses idle normales continuent aussi.
    if (canVary) {
      if (pose.cooldown > 0) {
        pose.cooldown--;
      } else {
        // RÔLE : Tirer une pose au sort — normale ou célébration selon le niveau de bonheur.
        // POURQUOI : À ha=5 on ajoute les poses célébration (50% des cas) ;
        //            sinon on reste sur les poses idle normales (hanches, croisés, salut).
        const r = Math.random();
        if (ha > HA_ARMS_UP) {
          // ha=5 — poses célébration (50%) + poses normales (50%)
          if      (r < 0.20) { window.animator.trigger('pose_bras_g_leve',  { duration: 18 + Math.floor(Math.random() * 12) }); }
          else if (r < 0.40) { window.animator.trigger('pose_bras_d_leve',  { duration: 18 + Math.floor(Math.random() * 12) }); }
          else if (r < 0.50) { window.animator.trigger('pose_bras_2_leves', { duration: 24 + Math.floor(Math.random() * 12) }); }
          else if (r < 0.70) { window.animator.trigger('pose_hanche_g',     { duration: 60 + Math.floor(Math.random() * 24) }); }
          else if (r < 0.85) { window.animator.trigger('pose_hanche_d',     { duration: 60 + Math.floor(Math.random() * 24) }); }
          else if (r < 0.95) { window.animator.trigger('pose_croises',      { duration: 72 + Math.floor(Math.random() * 24) }); }
          else               { window.animator.trigger('pose_salut',         { duration: 12 + Math.floor(Math.random() * 6)  }); }
        } else if (ha === HA_ARMS_UP) {
          // ha=4 — poses célébration légères (25%) + poses normales (75%)
          // POURQUOI : Bonheur élevé mais pas max — quelques éclats de joie spontanés,
          //            sans l'exubérance permanente du niveau 5.
          if      (r < 0.10) { window.animator.trigger('pose_bras_g_leve',  { duration: 18 + Math.floor(Math.random() * 12) }); }
          else if (r < 0.20) { window.animator.trigger('pose_bras_d_leve',  { duration: 18 + Math.floor(Math.random() * 12) }); }
          else if (r < 0.25) { window.animator.trigger('pose_bras_2_leves', { duration: 24 + Math.floor(Math.random() * 12) }); }
          else if (r < 0.50) { window.animator.trigger('pose_hanche_g',     { duration: 60 + Math.floor(Math.random() * 24) }); }
          else if (r < 0.70) { window.animator.trigger('pose_hanche_d',     { duration: 60 + Math.floor(Math.random() * 24) }); }
          else if (r < 0.88) { window.animator.trigger('pose_croises',      { duration: 72 + Math.floor(Math.random() * 24) }); }
          else               { window.animator.trigger('pose_salut',         { duration: 12 + Math.floor(Math.random() * 6)  }); }
        } else {
          // ha < 4 — poses idle normales uniquement
          if      (r < 0.35) { window.animator.trigger('pose_hanche_g', { duration: 60 + Math.floor(Math.random() * 24) }); }
          else if (r < 0.70) { window.animator.trigger('pose_hanche_d', { duration: 60 + Math.floor(Math.random() * 24) }); }
          else if (r < 0.90) { window.animator.trigger('pose_croises',  { duration: 72 + Math.floor(Math.random() * 24) }); }
          else               { window.animator.trigger('pose_salut',    { duration: 12 + Math.floor(Math.random() * 6)  }); }
        }
        pose.cooldown = 60 + Math.floor(Math.random() * 60); // 5-10 sec avant la prochaine
      }
    }
  }

  // RÔLE : Calculer la respiration pour les reflets oculaires et le dither.
  // POURQUOI : Même logique que drawTeen — cxB sert uniquement aux p.rect() de reflets
  //            et à drawDither(), pas à renderSprite() qui reçoit cx directement.
  const breath  = getBreath(p);
  // RÔLE : breathX — décalage horizontal du corps selon la phase de respiration.
  // POURQUOI : Math.floor(x*3)-1 donne {-1,0,1} de façon équitable (Math.round biaisait vers 0).
  const breathX = sl ? 0 : Math.floor(breath * 3) - 1; // ∈ {-1, 0, 1} — distribution équitable
  const cxB     = cx - PX * 5 - breathX; // référence absolue pour reflets + dither uniquement

  // RÔLE : stepPhase pour l'animation de marche des pieds.
  // POURQUOI : window._walk.pause === 0 = en mouvement ; Math.floor(walkX/PX)%2 = phase gauche/droit.
  const isMoving  = !sl && (window._walk ? window._walk.pause === 0 : false);
  const stepPhase = isMoving ? Math.floor(walkX / PX) % 2 : -1;

  // RÔLE : mouthBaseY — position Y de base de la bouche, animée par la respiration.
  // POURQUOI : Math.floor(x*3) donne {0,1,2} équitable au lieu du {0,1,2} biaisé de Math.round.
  const mouthBaseY = cy + PX * 6 + Math.floor(breath * 3); // ∈ {0, 1, 2} — distribution équitable

  // RÔLE : Paramètres transmis aux fonctions `when` des calques DSL.
  // POURQUOI : `pose` a été retiré — les poses idle sont maintenant pilotées par
  //            aov.hidden / aov.visible (animator) et non plus par pm.pose.
  const params = {
    sl, en, ha,
    blink,
    breath,
    pulse: getCheekPulse(p),
    mouthBaseY,
    stepPhase,
  };

  // RÔLE : Passer cx (centre de marche) à renderSprite, pas cxB.
  // POURQUOI : Les x DSL dans LAYERS_ADULT sont calculés avec x_dsl = offset_original + (-5),
  //            ce qui intègre déjà le décalage -5*PX. Passer cxB (= cx - PX*5) doublerait
  //            ce décalage et décalerait le sprite de 5*PX = 25px vers la gauche.
  renderSprite(p, LAYERS_ADULT, cx, cy, params);

  // RÔLE : Reflet snappé sur grille PX, avec regard latéral vers la crotte si proche.
  // POURQUOI : Snap PX-grid → reste dans la rangée haute de l'iris (Bug 1 fix).
  //            Regard crotte : même logique que baby/teen — poopDir pilote la position.
  // POURQUOI : !isMood('surprise') retiré — même raison que drawTeen (voir ci-dessus).
  //            Couleur : D.g.pupilColor (personnalisable dans l'onglet Perso) — blanc par défaut.
  //            Guard baillement : même raison que drawBaby — yeux fermés pendant bâillement.
  if (!params.sl && !params.blink && !isMood('baillement')) {
    const _pupilEntry = window.HG_CONFIG.PUPIL_COLORS.find(c => c.id === (window.D?.g?.pupilColor ?? 'blanc'));
    p.fill(_pupilEntry ? _pupilEntry.hex : '#ffffff');
    p.noStroke();
    // Iris adult rangée haute : 3×PX = 15px. Espace dispo = 15 - 3reflet - 4margeD - 0margeG = 8px.
    const rxMax = PX * 3 - 3 - 4; // 8px
    const nearPoop = window._gotchiNearPoop;
    const poopDir  = nearPoop ? _poopDirection(cxB) : null;
    const rxRaw    = poopDir !== null
      ? (poopDir > 0 ? rxMax : 0)
      : (Math.sin(Date.now() * 0.0008) * 0.5 + 0.5) * rxMax;
    // Iris adult DSL : œil gauche à x:-3 (cx - 3*PX), œil droit à x:1 (cx + 1*PX)
    const rx = Math.floor(rxRaw / PX) * PX;
    p.rect(cx - PX * 3 + 1 + rx, cy + PX * 3 + 1, 3, 3); // œil gauche
    p.rect(cx + PX * 1 + 1 + rx, cy + PX * 3 + 1, 3, 3); // œil droit
  }

  // Épuisement dither — hors DSL.
  // POURQUOI : x = cxB + PX (soit offset +1 depuis le bord gauche du sprite).
  if (en < EN_CRIT && !sl) {
    drawDither(p, cxB + PX, cy + PX * 5, PX * 8, PX * 5, C.bodyDk);
  }

  // RÔLE : Passer cx (centre de marche = walkX) à drawAccessoires.
  // POURQUOI : Le centre visuel réel du corps adult est cxB + 5*PX = cx.
  //            drawAccessoires centre l'accessoire sur le cx reçu (accX = cx - largeur/2).
  //            Passer cx est donc correct — passer cxB décalerait les accessoires de 25px à gauche.
  drawAccessoires(p, cx, { topY: cy, eyeY: cy + PX * 3, neckY: cy + PX * 6 }, 'adult', sl);
  drawSaleteDither(p, 'adult', cx, cy, window.D?.g?.salete || 0, sl);

  return { topY: cy, eyeY: cy + PX * 3, neckY: cy + PX * 6 };
}
