/* ============================================================
   garden.js — Biome Jardin (Environnement procédural — Phase 2 : génératif)
   RÔLE : Dessine l'environnement "Jardin" en deux passes distinctes :
          • drawJardinFond()        → arrière-plan (sol, éléments derrière le Gotchi)
          • drawJardinPremierPlan() → premier plan (éléments devant le Gotchi)
   POURQUOI deux passes : render.js appelle drawJardinFond() AVANT le Gotchi
          et drawJardinPremierPlan() APRÈS — ce séquencement donne la profondeur visuelle.

   RÈGLE ABSOLUE (Phase 2) :
          Aucun Math.random() ni calcul de position dans les fonctions draw().
          Tout est calculé UNE SEULE FOIS dans initGarden(), stocké dans
          window._gardenElements, et draw() ne fait que lire ce tableau.

   NAVIGATION RAPIDE :
   §0  ~20   PRNG             _gardenRng(seed, index)
   §1  ~50   FOND             drawJardin() + drawJardinFond()
   §2  ~80   PREMIER PLAN     drawJardinPremierPlan()
   ============================================================ */

/* ─── §0 : PRNG DÉTERMINISTE ─────────────────────────────────────── */

/**
 * _gardenRng(seed, index) — Générateur de nombres pseudo-aléatoires déterministe
 *
 * RÔLE : Retourne un nombre flottant entre 0 (inclus) et 1 (exclus),
 *        comme Math.random() — mais entièrement déterminé par seed + index.
 *        Même seed + même index → toujours le même résultat.
 *
 * POURQUOI un LCG (Linear Congruential Generator) :
 *        C'est l'algorithme le plus simple et le plus léger pour un PRNG.
 *        Pas besoin de bibliothèque, pas de state global — une seule formule.
 *        Suffisant pour distribuer ~20 éléments visuels sans biais visible.
 *
 * FORMULE LCG standard (paramètres de Numerical Recipes) :
 *        state = (state × 1664525 + 1013904223) mod 2³²
 *        Les constantes 1664525 et 1013904223 sont reconnues pour leur
 *        bonne distribution sur toute la plage 32 bits.
 *
 * USAGE :
 *        _gardenRng(42, 0)  → ~0.73   (position X du 1er élément)
 *        _gardenRng(42, 1)  → ~0.12   (type du 2e élément)
 *        _gardenRng(42, 0)  → ~0.73   (identique — déterministe)
 *
 * @param {number} seed  - Entier positif, tiré une fois pour la save (D.g.gardenSeed)
 * @param {number} index - Entier positif, différent pour chaque usage dans initGarden()
 * @returns {number} Flottant dans [0, 1[
 */
function _gardenRng(seed, index) {
  // RÔLE : Combine seed et index pour créer un état initial unique à ce tirage.
  // POURQUOI : Sans combiner les deux, _gardenRng(seed, 0) et _gardenRng(seed, 1)
  //            partiraient du même état et donneraient des valeurs trop proches.
  //            L'addition simple seed + index × 2654435761 (nombre premier proche de 2³²/φ)
  //            garantit que chaque index part d'un état vraiment différent.
  let state = (seed + index * 2654435761) >>> 0; // >>> 0 = forcer en entier non signé 32 bits

  // RÔLE : Applique un cycle LCG pour "mélanger" l'état initial.
  // POURQUOI : L'état initial (seed+index) est trop prévisible sans au moins un cycle.
  //            Un seul cycle suffit ici — on ne fait pas de cryptographie.
  state = Math.imul(state, 1664525) + 1013904223 | 0;
  // Math.imul = multiplication entière 32 bits (évite les erreurs de précision flottante)
  // | 0 = conversion forcée en entier signé 32 bits (tronque les bits au-delà de 32)

  // RÔLE : Convertit l'entier 32 bits en flottant [0, 1[.
  // POURQUOI : >>> 0 repasse en non signé (évite les valeurs négatives),
  //            puis on divise par 2³² = 4294967296 pour obtenir un ratio.
  return (state >>> 0) / 4294967296;
}
// Exposée globalement pour pouvoir être testée dans la console
window._gardenRng = _gardenRng;

/* ─── §0b : INIT JARDIN ──────────────────────────────────────────── */

/**
 * initGarden() — Initialise les éléments du jardin depuis la seed de la save
 *
 * RÔLE : Calcule UNE SEULE FOIS la liste de tous les éléments visuels du jardin
 *        (fleurs, herbes, pierres, champignons) et la stocke dans window._gardenElements.
 *        Les fonctions draw() ne font que lire ce tableau — elles n'appellent jamais
 *        Math.random() ni ne calculent de positions.
 *
 * APPELÉE PAR : bootstrap() dans app.js, après loadDataFiles().
 *
 * SEED :
 *        Si D.g.gardenSeed est null (premier lancement), on tire une seed via
 *        Math.random() — c'est le SEUL endroit autorisé à utiliser Math.random()
 *        dans tout le système jardin. On la sauvegarde immédiatement.
 *        Aux lancements suivants, on relit la seed sauvegardée → jardin identique.
 *
 * GARDENSTATE :
 *        D.g.gardenState mémorise l'âge et le variant de chaque élément entre sessions.
 *        Si gardenState est vide (premier lancement ou reset), on le peuple ici.
 *        Si gardenState existe déjà, on le respecte (âges conservés).
 *
 * STRUCTURE d'un élément dans window._gardenElements :
 *        {
 *          type:    string   — 'fleur' | 'herbe' | 'pierre' | 'champignon'
 *          x:       number   — position X sur le canvas (0–195, multiple de PX)
 *          y:       number   — position Y : fond (120–135) ou premier plan (155–170)
 *          layer:   string   — 'fond' | 'premier_plan'
 *          variant: number   — entier 0–3, détermine le style de dessin
 *          age:     number   — jours de vie (0 = nouveau, maxAge = mature)
 *          maxAge:  number   — durée de vie max en jours avant "remplacement"
 *        }
 */
function initGarden() {
  // ── Garde : window.D doit exister ───────────────────────────────
  // POURQUOI : bootstrap() charge D avant d'appeler initGarden(),
  //            mais on vérifie défensivement au cas où l'ordre changerait.
  if (!window.D || !window.D.g) {
    console.warn('[Garden] initGarden() appelée avant que D soit prêt — ignorée');
    return;
  }

  // ── 1. Seed ──────────────────────────────────────────────────────
  // RÔLE : Garantit qu'une seed existe. Si null → premier lancement → on tire
  //        un entier entre 1 et 999999 via Math.random() (seul usage autorisé).
  // POURQUOI : Math.floor évite les flottants, +1 évite la seed=0 (LCG dégénéré avec state=0).
  if (window.D.g.gardenSeed === null || window.D.g.gardenSeed === undefined) {
    window.D.g.gardenSeed = Math.floor(Math.random() * 999999) + 1;
    save(); // RÔLE : Persiste la seed immédiatement — si l'app crashe avant la fin de bootstrap(),
            //        on ne re-tire pas une nouvelle seed au prochain lancement.
  }
  const seed = window.D.g.gardenSeed;

  // ── 2. Mise à jour du gardenDay ──────────────────────────────────
  // RÔLE : Note la date du jour pour le système de cycles de vie.
  // POURQUOI : Lors d'une future Phase 3, on pourra comparer gardenDay à today()
  //            pour incrémenter les âges. Ici on l'initialise simplement.
  if (!window.D.g.gardenDay) {
    window.D.g.gardenDay = today();
    save();
  }

  // ── 3. Définition des slots d'éléments ──────────────────────────
  // RÔLE : Détermine combien d'éléments de chaque type peupleront le jardin.
  // POURQUOI : 20 éléments max pour rester léger mobile.
  //            Répartition : 5 fleurs fond + 3 fleurs pp + 3 herbes fond + 2 herbes pp
  //                        + 4 pierres + 3 champignons = 20.
  //
  // Convention Y (base de l'élément — les sprites grandissent vers le HAUT) :
  //   fond         → y ≈ 118  (lisière sol, base des sprites de fond)
  //   premier_plan → y ≈ 162  (lisière basse du canvas, base des sprites devant)
  //
  // POURQUOI une seule valeur Y par slot :
  //   Tous les éléments d'un même slot partagent la même ligne de sol — c'est
  //   le principe de la perspective 2D. La hauteur (hauteurPX) pousse vers le
  //   haut depuis cette base. Un arbuste de 16PX planté à y=118 monte jusqu'à
  //   y = 118 - 16×5 = 38, juste sous la barre HUD (y=26). ✓
  //
  // hauteurPX : hauteur du sprite en unités PX (1 PX = 5px réels).
  //   Utilisé par la zone d'exclusion pour éviter que les grands éléments
  //   cachent les petits. Propagé sur chaque élément pour la Phase 3.
  //   Valeurs de référence :
  //     herbe      →  3 PX  (15px)    champignon →  5 PX  (25px)
  //     fleur      →  4 PX  (20px)    fougère*   → 10 PX  (50px)
  //     pierre     →  2 PX  (10px)    arbuste*   → 16 PX  (80px)
  //   (* types Phase 3, pas encore de fonction draw — la structure les supporte déjà)

  const SLOTS = [
    // Fleurs — fond : 5 fleurs réparties sur la largeur, base au sol
    { type: 'fleur',      layer: 'fond',          count: 5,
      xMin: 10, xMax: 185, y: 118, maxAge: 7,   hauteurPX: 4  },
    // Fleurs — premier plan : 3 fleurs en lisière basse
    { type: 'fleur',      layer: 'premier_plan',  count: 3,
      xMin: 10, xMax: 185, y: 162, maxAge: 7,   hauteurPX: 4  },
    // Herbes — fond : 3 brins discrets dans la pelouse
    { type: 'herbe',      layer: 'fond',          count: 3,
      xMin: 10, xMax: 185, y: 118, maxAge: 14,  hauteurPX: 3  },
    // Herbes — premier plan : 2 brins en lisière basse
    { type: 'herbe',      layer: 'premier_plan',  count: 2,
      xMin: 10, xMax: 185, y: 162, maxAge: 14,  hauteurPX: 3  },
    // Pierres — fond uniquement : 4 pierres dispersées, permanentes
    { type: 'pierre',     layer: 'fond',          count: 4,
      xMin: 10, xMax: 185, y: 118, maxAge: 999, hauteurPX: 2  },
    // Champignons — fond uniquement : 3 champignons éphémères
    { type: 'champignon', layer: 'fond',          count: 3,
      xMin: 10, xMax: 185, y: 118, maxAge: 5,   hauteurPX: 5  },
  ];

  // ── 4. Génération de la liste d'éléments avec zone d'exclusion ──
  //
  // RÈGLE ABSOLUE : aucun Math.random() ici — uniquement _gardenRng(seed, idxTotal).
  // idxTotal est monotone croissant sur TOUS les tirages du jardin, pour garantir
  // qu'aucun deux tirages n'utilisent le même index → pas de collision de valeurs.
  //
  // ZONE D'EXCLUSION :
  //   Chaque élément placé "protège" une zone proportionnelle à sa hauteur.
  //   Un nouvel élément ne peut pas être placé dans la zone protégée d'un existant.
  //   Formule de la zone protégée de l'élément déjà placé (el) :
  //     xMin protégé = el.x - el.hauteurPX × PX × 1.2
  //     xMax protégé = el.x + el.hauteurPX × PX × 1.2
  //     yMin protégé = el.y - el.hauteurPX × PX        (sommet du sprite)
  //     yMax protégé = el.y + PX                       (légèrement sous la base)
  //   POURQUOI 1.2 en horizontal : un grand sprite déborde légèrement de son x de base.
  //   Un petit élément (herbe, 3PX) a une empreinte très étroite → ne bloque presque rien.
  //   Un grand élément (arbuste, 16PX) protège 80px × 96px → empêche tout chevauchement.
  //
  // RETENTATIVES :
  //   Si une position est dans une zone protégée, on retente jusqu'à MAX_ATTEMPTS fois
  //   en décalant idxTotal (tirage différent à chaque essai, toujours déterministe).
  //   Au-delà → skip silencieux (le jardin aura moins de 20 éléments, c'est OK).

  const MAX_ATTEMPTS = 8; // max retentatives avant de skipper un élément

  // RÔLE : Vérifie si (x, y, hauteurPX) empiète sur un élément déjà placé dans `placed`.
  // POURQUOI fonction inline : utilisée uniquement ici, pas besoin de l'exposer globalement.
  function _estBloque(x, y, hauteurPX, placed) {
    for (const el of placed) {
      const margeH = el.hauteurPX * PX * 1.2; // empreinte horizontale de l'élément existant
      const xOk = x < el.x - margeH || x > el.x + margeH;
      if (xOk) continue; // hors empreinte horizontale → pas de conflit possible
      // Dans l'empreinte horizontale → on vérifie la verticale
      const yTopEl = el.y - el.hauteurPX * PX; // sommet du sprite existant
      const yOk    = y > el.y + PX || y < yTopEl - hauteurPX * PX;
      if (!yOk) return true; // chevauchement confirmé
    }
    return false;
  }

  const elements = [];
  let idxTotal = 0; // index global — monotone croissant sur tous les tirages

  SLOTS.forEach(slot => {
    for (let i = 0; i < slot.count; i++) {

      let x, placed = false;

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        // Position X : tirage dans la plage du slot, aligné sur la grille PX
        // POURQUOI on retente uniquement sur X : Y est fixe par slot (ligne de sol unique).
        // Un nouvel index à chaque tentative → valeur différente mais toujours déterministe.
        const xRaw = slot.xMin + _gardenRng(seed, idxTotal++) * (slot.xMax - slot.xMin);
        x = Math.floor(xRaw / PX) * PX;

        // RÔLE : Vérifie si cette position X/Y empiète sur un élément déjà placé.
        if (!_estBloque(x, slot.y, slot.hauteurPX, elements)) {
          placed = true;
          break; // position libre trouvée → on sort de la boucle de tentatives
        }
        // Position bloquée → on continue avec un nouvel idxTotal (prochain _gardenRng)
      }

      // RÔLE : Tirage du variant — toujours après les tentatives pour ne pas perturber idxTotal.
      const variant = Math.floor(_gardenRng(seed, idxTotal++) * 4);

      // RÔLE : Si aucune position libre après MAX_ATTEMPTS → skip silencieux.
      // POURQUOI : Mieux avoir 18 éléments bien placés que 20 avec chevauchements.
      if (!placed) {
        console.log(`[Garden] skip ${slot.type} #${i} — aucune position libre après ${MAX_ATTEMPTS} tentatives`);
        continue;
      }

      elements.push({
        type:      slot.type,
        layer:     slot.layer,
        x,
        y:         slot.y,     // base fixe — le sprite grandit vers le haut depuis ce point
        variant,
        hauteurPX: slot.hauteurPX,
        age:       0,           // incrémenté par le système de cycles (Phase 3)
        maxAge:    slot.maxAge,
      });
    }
  });

  // ── 4b. Tri par Y croissant ──────────────────────────────────────
  // RÔLE : Trie les éléments du plus lointain (y petit = haut de scène) au plus proche
  //        (y grand = bas de scène). Les fonctions draw* itèrent dans cet ordre →
  //        les éléments proches sont dessinés EN DERNIER et passent visuellement devant.
  // POURQUOI indispensable avec des grands éléments : un arbuste planté à y=118 monte
  //   jusqu'à y=38. Sans tri, une herbe dessinée après pourrait passer devant l'arbuste
  //   alors qu'elle est censée être "derrière" (même y de base, mais taille différente).
  elements.sort((a, b) => a.y - b.y);

  // ── 5. Persistance dans gardenState ─────────────────────────────
  // RÔLE : Si gardenState est vide, on le remplit avec les éléments générés.
  //        Si gardenState existe déjà, on relit les âges sauvegardés et on les
  //        réapplique à la liste recalculée depuis la seed.
  // POURQUOI : La seed garantit que x/y/variant/hauteurPX sont identiques entre sessions.
  //            Seul l'âge évolue — c'est la seule chose qu'on persiste vraiment.
  if (!window.D.g.gardenState || window.D.g.gardenState.length === 0) {
    // Premier lancement : gardenState vide → on persiste les éléments générés
    window.D.g.gardenState = elements.map(el => ({
      age:       el.age,
      maxAge:    el.maxAge,
      hauteurPX: el.hauteurPX, // persisté pour la Phase 3 (cycles de vie par taille)
    }));
    save();
  } else {
    // Sessions suivantes : réapplique les données sauvegardées sur la liste recalculée
    // POURQUOI : On ne persiste que l'âge et hauteurPX (index = position dans le tableau).
    //            x/y/variant sont toujours recalculés depuis la seed → pas de dérive.
    elements.forEach((el, i) => {
      const saved = window.D.g.gardenState[i];
      if (saved) {
        el.age       = saved.age       ?? 0;
        el.maxAge    = saved.maxAge    ?? el.maxAge;
        el.hauteurPX = saved.hauteurPX ?? el.hauteurPX;
      }
    });
  }

  // ── 6. Exposition sur window ─────────────────────────────────────
  // RÔLE : Stocke la liste finale dans window._gardenElements.
  // POURQUOI : Les fonctions draw* lisent directement window._gardenElements —
  //            pas besoin de passer le tableau en paramètre à chaque frame.
  window._gardenElements = elements;
  console.log(`[Garden] initGarden() — seed=${seed}, ${elements.length} éléments générés`);
}
// Exposée globalement pour être appelée depuis bootstrap() dans app.js
window.initGarden = initGarden;

/* ─── §0c : SPRITES PIXEL ART ────────────────────────────────────── */

/*
   Convention commune à tous les sprites ci-dessous :
   • p.fill() est toujours appelé AVANT px() — px() ne set pas la couleur.
   • px(p, x, y, w, h) aligne sur la grille PX=5 (voir envs.js §1).
   • tc(n, couleur) applique l'assombrissement nuit — à utiliser sur toutes
     les couleurs de végétation/décor pour rester cohérent avec le reste de la scène.
   • x, y = coin supérieur gauche du sprite (coordonnées canvas 0–200).
   • variant = entier 0–3 tiré par initGarden() — détermine variante de forme ou couleur.
   • n = ratio nuit 0 (jour) → 1 (nuit pleine), passé depuis draw*().
*/

/**
 * drawFleur(p, x, y, variant, theme, n)
 * RÔLE : Dessine une fleur pixel art en 4 variantes de couleur.
 *        Reprend la structure de drawFl() (envs.js) — tige + pétales + cœur —
 *        mais avec 4 palettes différentes selon variant.
 * POURQUOI 4 variantes : donne de la diversité visuelle sans complexifier la forme.
 *        La forme reste identique (3 pétales en croix) pour garder la cohérence avec drawFl().
 *
 * @param {Object} p       - Instance p5.js
 * @param {number} x       - Position X (coin sup. gauche)
 * @param {number} y       - Position Y (base de la tige)
 * @param {number} variant - 0–3 : couleur des pétales
 * @param {Object} theme   - Thème actif (pour le cœur en couleur thème)
 * @param {number} n       - Ratio nuit 0–1
 */
function drawFleur(p, x, y, variant, theme, n) {
  // Palette des pétales selon variant (4 teintes douces, jardin)
  const PETALES = ['#e87878', '#e8c878', '#c878e8', '#78c8e8']; // rose, jaune, mauve, bleu ciel
  const colPetale = PETALES[variant % 4];

  // Tige — vert herbe, même couleur que drawFl()
  p.fill(tc(n, '#58a058'));
  px(p, x, y, PX, PX * 2); // tige : 1×2 PX

  // Pétales en croix (gauche + droite + haut) — identique à drawFl()
  p.fill(tc(n, colPetale));
  px(p, x - PX, y - PX,  PX, PX); // pétale gauche
  px(p, x + PX, y - PX,  PX, PX); // pétale droit
  px(p, x,      y - PX*2, PX, PX); // pétale haut

  // Cœur central — couleur jaune chaude, légèrement assombrie la nuit
  p.fill(tc(n, '#f0d878'));
  px(p, x, y - PX, PX, PX);
}

/**
 * drawHerbe(p, x, y, variant, n)
 * RÔLE : Dessine un brin d'herbe pixel art en 4 silhouettes.
 *        Discret — max 3 PX de haut — pour ne pas concurrencer les fleurs.
 * POURQUOI 4 variants de FORME (pas de couleur) :
 *        L'herbe gagne en naturel avec des silhouettes légèrement différentes
 *        (brin droit, brin penché gauche, brin penché droit, brin court).
 *
 * @param {Object} p       - Instance p5.js
 * @param {number} x       - Position X
 * @param {number} y       - Position Y (base du brin)
 * @param {number} variant - 0–3 : silhouette du brin
 * @param {number} n       - Ratio nuit 0–1
 */
function drawHerbe(p, x, y, variant, n) {
  // Deux tons de vert pour donner un peu de volume
  const VERT_CLAIR = '#70b858';
  const VERT_FONCE = '#509040';

  p.fill(tc(n, VERT_CLAIR));

  if (variant === 0) {
    // Brin droit : 1 pixel large, 3 PX de haut
    px(p, x, y,        PX, PX); // base
    px(p, x, y - PX,   PX, PX); // milieu
    px(p, x, y - PX*2, PX, PX); // pointe
  } else if (variant === 1) {
    // Brin penché gauche : décale la pointe d'1 PX vers la gauche
    px(p, x,      y,        PX, PX); // base
    px(p, x,      y - PX,   PX, PX); // milieu
    px(p, x - PX, y - PX*2, PX, PX); // pointe décalée gauche
  } else if (variant === 2) {
    // Brin penché droit : décale la pointe d'1 PX vers la droite
    px(p, x,      y,        PX, PX); // base
    px(p, x,      y - PX,   PX, PX); // milieu
    px(p, x + PX, y - PX*2, PX, PX); // pointe décalée droite
  } else {
    // Brin court épais : 2 PX de large, 2 PX de haut (touffe basse)
    px(p, x, y,      PX*2, PX); // base large
    px(p, x, y - PX, PX,   PX); // pointe simple
  }

  // Ombre à la base — ton foncé pour ancrer le brin au sol
  p.fill(tc(n, VERT_FONCE));
  px(p, x, y, PX, PX); // repasse sur la base en plus sombre
}

/**
 * drawPierre(p, x, y, variant, n)
 * RÔLE : Dessine une pierre pixel art en 4 tailles/formes.
 *        Les pierres sont des éléments permanents (maxAge:999) — elles structurent
 *        visuellement le jardin comme des repères stables.
 * POURQUOI 4 variants de TAILLE :
 *        Petite, moyenne, large, plate — donne de la profondeur sans surcharger.
 *
 * @param {Object} p       - Instance p5.js
 * @param {number} x       - Position X
 * @param {number} y       - Position Y (base de la pierre)
 * @param {number} variant - 0–3 : taille et forme
 * @param {number} n       - Ratio nuit 0–1
 */
function drawPierre(p, x, y, variant, n) {
  const GRIS_CLAIR  = '#b0b0b0';
  const GRIS_FONCE  = '#808080';
  const BLANC_REFLET = '#d8d8d8'; // reflet de lumière sur le dessus

  if (variant === 0) {
    // Petite pierre ronde : 2×2 PX, reflet sur le coin haut-gauche
    p.fill(tc(n, GRIS_FONCE));
    px(p, x,      y,      PX*2, PX*2); // corps
    p.fill(tc(n, BLANC_REFLET));
    px(p, x,      y,      PX,   PX);   // reflet haut-gauche

  } else if (variant === 1) {
    // Pierre moyenne arrondie : 3×2 PX
    p.fill(tc(n, GRIS_FONCE));
    px(p, x,      y,       PX*3, PX*2); // corps
    p.fill(tc(n, GRIS_CLAIR));
    px(p, x,      y,       PX*2, PX);   // dessus plus clair
    p.fill(tc(n, BLANC_REFLET));
    px(p, x,      y,       PX,   PX);   // reflet coin

  } else if (variant === 2) {
    // Pierre large plate : 4×1 PX — très plate, rase le sol
    p.fill(tc(n, GRIS_FONCE));
    px(p, x,      y,      PX*4, PX);   // corps plat
    p.fill(tc(n, BLANC_REFLET));
    px(p, x,      y,      PX*2, PX);   // dessus lumineux (moitié gauche)

  } else {
    // Pierre anguleuse : 2×3 PX — plus haute que large, forme de rocher
    p.fill(tc(n, GRIS_FONCE));
    px(p, x,      y,       PX*2, PX*3); // corps haut
    p.fill(tc(n, GRIS_CLAIR));
    px(p, x,      y,       PX*2, PX);   // dessus clair
    p.fill(tc(n, BLANC_REFLET));
    px(p, x,      y,       PX,   PX);   // reflet coin
  }
}

/**
 * drawChampignon(p, x, y, variant, n)
 * RÔLE : Dessine un champignon pixel art en 4 variantes de couleur de chapeau.
 *        Structure fixe : pied blanc + chapeau coloré avec points blancs.
 *        Les champignons sont éphémères (maxAge:5) — ils apparaissent et disparaissent.
 * POURQUOI des points blancs : signature visuelle immédiatement lisible
 *        même à 5×5px logiques (amanite, référence universelle).
 *
 * @param {Object} p       - Instance p5.js
 * @param {number} x       - Position X
 * @param {number} y       - Position Y (base du pied)
 * @param {number} variant - 0–3 : couleur du chapeau
 * @param {number} n       - Ratio nuit 0–1
 */
function drawChampignon(p, x, y, variant, n) {
  // Palette des chapeaux : rouge, orange, brun, violet
  const CHAPEAUX = ['#d04040', '#d08030', '#806040', '#8040a0'];
  const colChapeau = CHAPEAUX[variant % 4];

  // Pied — blanc cassé, 1×2 PX
  p.fill(tc(n, '#e8e0d0'));
  px(p, x, y,      PX,   PX);    // base du pied
  px(p, x, y - PX, PX,   PX);    // haut du pied

  // Chapeau — 3×2 PX, déborde d'1 PX de chaque côté du pied
  p.fill(tc(n, colChapeau));
  px(p, x - PX, y - PX*2, PX*3, PX*2); // corps du chapeau (large)
  px(p, x,      y - PX*3, PX,   PX);   // dôme central (1 PX plus haut)

  // Points blancs — 1 sur le dôme, 1 sur le bord gauche du chapeau
  p.fill(tc(n, '#ffffff'));
  px(p, x,      y - PX*3, PX, PX); // point dôme (par-dessus le chapeau)
  p.fill(tc(n, '#f0f0f0')); // légèrement grisé pour les points sur le bord
  px(p, x - PX, y - PX*2, PX, PX); // point bord gauche
}

/* ─── §1 : FOND ──────────────────────────────────────────────────── */

/**
 * drawJardin() : point d'entrée appelé par drawActiveEnv() dans envs.js
 * RÔLE : Délègue au fond du jardin — la passe premier plan est gérée
 *        séparément dans p.draw() (render.js) après le dessin du Gotchi.
 * @param {Object} p     - Instance p5.js
 * @param {Object} theme - Palette active (depuis getEnvC() — ENV_THEMES, pas ENV_BIOMES)
 * @param {number} n     - Ratio nuit 0 (jour) → 1 (nuit pleine)
 */
function drawJardin(p, theme, n) {
  // RÔLE : Appelle uniquement la passe de fond depuis le dispatcher.
  // POURQUOI : drawJardinPremierPlan() sera appelée APRÈS le Gotchi dans p.draw()
  //            — elle ne doit pas passer ici pour maintenir l'ordre z correct.
  drawJardinFond(p, theme, n);
}
window.drawJardin = drawJardin;

/**
 * drawJardinFond() : passe arrière-plan du Jardin
 * RÔLE : Dessine tout ce qui doit apparaître DERRIÈRE le Gotchi.
 *        Sol herbeux + tous les éléments de window._gardenElements dont layer === 'fond'.
 * @param {Object} p     - Instance p5.js
 * @param {Object} theme - Palette active (couleurs depuis config.js → ENV_THEMES, ex: 'pastel')
 * @param {number} n     - Ratio nuit 0 (jour) → 1 (nuit pleine)
 */
function drawJardinFond(p, theme, n) {
  p.noStroke();

  // ── Sol herbeux ──────────────────────────────────────────────────
  // POURQUOI p.rect et non px() : même convention que drawParc/drawMontagne —
  //          les grands aplats de sol utilisent p.rect (coordonnées libres).
  p.fill(tc(n, theme.gnd));    p.rect(0, 120, CS, 80); // herbe principale
  p.fill(tc(n, theme.gndDk));  p.rect(0, 120, CS, PX * 2); // lisière sombre (2 pixels)

  // ── Éléments génératifs de fond ──────────────────────────────────
  // RÔLE : Itère sur window._gardenElements et dessine uniquement les éléments
  //        dont layer === 'fond' (derrière le Gotchi).
  // POURQUOI la garde _gardenElements : initGarden() est appelée depuis bootstrap()
  //          après loadDataFiles(). Si pour une raison quelconque draw() tourne
  //          avant que initGarden() ait fini, on évite un crash silencieux.
  if (!window._gardenElements) return;

  window._gardenElements.forEach(el => {
    // RÔLE : Filtre — seul le fond est dessiné ici.
    if (el.layer !== 'fond') return;

    // RÔLE : Dispatch vers la bonne fonction de dessin selon le type.
    // POURQUOI switch plutôt que if/else : plus lisible quand les cas sont nombreux,
    //          et plus facile à étendre (Phase 3 pourrait ajouter 'buisson', 'arbre', etc.).
    switch (el.type) {
      case 'fleur':
        drawFleur(p, el.x, el.y, el.variant, theme, n);
        break;
      case 'herbe':
        drawHerbe(p, el.x, el.y, el.variant, n);
        break;
      case 'pierre':
        drawPierre(p, el.x, el.y, el.variant, n);
        break;
      case 'champignon':
        drawChampignon(p, el.x, el.y, el.variant, n);
        break;
      // default : type inconnu → on ignore silencieusement (forward-compat Phase 3)
    }
  });
}
window.drawJardinFond = drawJardinFond;

/* ─── §2 : PREMIER PLAN ──────────────────────────────────────────── */

/**
 * drawJardinPremierPlan() : passe premier plan du Jardin
 * RÔLE : Dessine tout ce qui doit apparaître DEVANT le Gotchi.
 *        Itère sur window._gardenElements dont layer === 'premier_plan'.
 * @param {Object} p     - Instance p5.js
 * @param {Object} theme - Thème actif
 * @param {number} n     - Ratio nuit 0 (jour) → 1 (nuit pleine)
 */
function drawJardinPremierPlan(p, theme, n) {
  p.noStroke();

  // ── Éléments génératifs de premier plan ─────────────────────────
  // RÔLE : Itère sur window._gardenElements et dessine uniquement les éléments
  //        dont layer === 'premier_plan' (devant le Gotchi).
  // POURQUOI cette passe est appelée APRÈS le Gotchi dans render.js :
  //          les éléments premier_plan ont un y plus bas (158–170) que le Gotchi
  //          (130–155) — les dessiner après garantit qu'ils passent visuellement
  //          devant lui, créant la sensation de profondeur.
  if (!window._gardenElements) return;

  window._gardenElements.forEach(el => {
    // RÔLE : Filtre — seul le premier plan est dessiné ici.
    if (el.layer !== 'premier_plan') return;

    switch (el.type) {
      case 'fleur':
        drawFleur(p, el.x, el.y, el.variant, theme, n);
        break;
      case 'herbe':
        drawHerbe(p, el.x, el.y, el.variant, n);
        break;
      case 'pierre':
        drawPierre(p, el.x, el.y, el.variant, n);
        break;
      case 'champignon':
        drawChampignon(p, el.x, el.y, el.variant, n);
        break;
    }
  });
}
window.drawJardinPremierPlan = drawJardinPremierPlan;
