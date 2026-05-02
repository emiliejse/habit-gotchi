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

  // scaleMin / scaleMax : plage de taille en unités PX.
  // POURQUOI des plages larges et asymétriques :
  //   La plupart des éléments seront petits (scaleMin bas) mais quelques-uns
  //   pourront être dramatiquement grands (scaleMax élevé) — jardins sauvages.
  //   Ex: fleur scaleMin=1 (bouton minuscule) → scaleMax=8 (grande fleur imposante).
  //   hauteurPX reste la valeur "base" pour la zone d'exclusion initiale —
  //   scalePX réel la remplace ensuite.
  const SLOTS = [
    // Fleurs — fond : 5 fleurs réparties sur la largeur, base au sol
    // scaleMin=1 (bouton fermé) → scaleMax=8 (grande fleur estivale)
    { type: 'fleur',      layer: 'fond',          count: 5,
      xMin: 10, xMax: 185, y: 118, maxAge: 7,   hauteurPX: 4,  scaleMin: 1, scaleMax: 8  },
    // Fleurs — premier plan : 3 fleurs en lisière basse
    { type: 'fleur',      layer: 'premier_plan',  count: 3,
      xMin: 10, xMax: 185, y: 162, maxAge: 7,   hauteurPX: 4,  scaleMin: 1, scaleMax: 8  },
    // Herbes — fond : 3 brins discrets dans la pelouse
    // scaleMin=1 (ras du sol) → scaleMax=6 (herbe haute qui dépasse)
    { type: 'herbe',      layer: 'fond',          count: 3,
      xMin: 10, xMax: 185, y: 118, maxAge: 14,  hauteurPX: 3,  scaleMin: 1, scaleMax: 6  },
    // Herbes — premier plan : 2 brins en lisière basse
    { type: 'herbe',      layer: 'premier_plan',  count: 2,
      xMin: 10, xMax: 185, y: 162, maxAge: 14,  hauteurPX: 3,  scaleMin: 1, scaleMax: 6  },
    // Pierres — fond uniquement : 4 pierres dispersées, permanentes
    // scaleMin=1 (caillou) → scaleMax=5 (rocher notable)
    { type: 'pierre',     layer: 'fond',          count: 4,
      xMin: 10, xMax: 185, y: 118, maxAge: 999, hauteurPX: 2,  scaleMin: 1, scaleMax: 5  },
    // Champignons — fond uniquement : 3 champignons éphémères
    // scaleMin=1 (microscopique) → scaleMax=9 (champignon géant improbable)
    { type: 'champignon', layer: 'fond',          count: 3,
      xMin: 10, xMax: 185, y: 118, maxAge: 5,   hauteurPX: 5,  scaleMin: 1, scaleMax: 9  },
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

      // RÔLE : Tirages déterministes post-placement — toujours après les tentatives
      //        pour ne pas perturber la séquence d'idxTotal des positions X.

      // variant : forme du sprite (0–3) — détermine la silhouette, indépendant de la couleur
      const variant = Math.floor(_gardenRng(seed, idxTotal++) * 4);

      // colorVariant : couleur du sprite (0–7) — palette large, indépendante de la forme.
      // POURQUOI séparer forme et couleur : variant=0 + colorVariant=3 ≠ variant=0 + colorVariant=5
      // → 4 formes × 8 couleurs = 32 combinaisons par type, sans compter la taille.
      const colorVariant = Math.floor(_gardenRng(seed, idxTotal++) * 8);

      // scalePX : taille réelle du sprite en unités PX — tirée dans une plage large.
      // POURQUOI une plage aussi large : on veut des jardins vraiment variés,
      //   avec des éléments minuscules (1PX) côtoyant des éléments imposants (max du slot).
      //   La plage [scaleMin, scaleMax] est définie dans le slot.
      //   scaleMin peut être 1 (un seul pixel — un bouton, une graine).
      //   scaleMax peut aller jusqu'à 3× la hauteurPX de base pour les grands éléments.
      const scaleRaw = slot.scaleMin + _gardenRng(seed, idxTotal++) * (slot.scaleMax - slot.scaleMin);
      const scalePX  = Math.max(1, Math.round(scaleRaw)); // entier, minimum 1

      // hauteurPX effective : la zone d'exclusion a déjà utilisé slot.hauteurPX (base),
      // mais on met à jour avec scalePX réel pour que gardenState soit exact en Phase 3.
      const hauteurPXEffective = scalePX;

      // RÔLE : Si aucune position libre après MAX_ATTEMPTS → skip silencieux.
      // POURQUOI : Mieux avoir 18 éléments bien placés que 20 avec chevauchements.
      if (!placed) {
        console.log(`[Garden] skip ${slot.type} #${i} — aucune position libre après ${MAX_ATTEMPTS} tentatives`);
        continue;
      }

      elements.push({
        type:         slot.type,
        layer:        slot.layer,
        x,
        y:            slot.y,          // base fixe — le sprite grandit vers le haut depuis ce point
        variant,                        // forme (0–3)
        colorVariant,                   // couleur (0–7), indépendante de la forme
        scalePX,                        // taille réelle en unités PX
        hauteurPX:    hauteurPXEffective,
        age:          0,                // incrémenté par le système de cycles (Phase 3)
        maxAge:       slot.maxAge,
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
      age:          el.age,
      maxAge:       el.maxAge,
      hauteurPX:    el.hauteurPX,    // taille effective — pour les cycles de vie Phase 3
      scalePX:      el.scalePX,      // persisté pour éviter une variation au rechargement
      colorVariant: el.colorVariant, // persisté — la couleur d'un élément ne change pas entre sessions
    }));
    save();
  } else {
    // Sessions suivantes : réapplique les données sauvegardées sur la liste recalculée.
    // POURQUOI : x/y/variant sont recalculés depuis la seed (identiques).
    //            scalePX et colorVariant aussi — mais on relit gardenState par précaution
    //            au cas où une Phase 3 les aurait fait évoluer (ex: plante qui grandit).
    elements.forEach((el, i) => {
      const saved = window.D.g.gardenState[i];
      if (saved) {
        el.age          = saved.age          ?? 0;
        el.maxAge       = saved.maxAge       ?? el.maxAge;
        el.hauteurPX    = saved.hauteurPX    ?? el.hauteurPX;
        el.scalePX      = saved.scalePX      ?? el.scalePX;
        el.colorVariant = saved.colorVariant ?? el.colorVariant;
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

/*
   CONVENTION SPRITES v2 (procéduraux) :
   Chaque fonction reçoit maintenant scalePX et colorVariant en plus de variant.
   • s = scalePX    — taille de l'élément en unités PX (entier ≥ 1)
   • cv = colorVariant — entier 0–7, palette large (8 couleurs par type)
   • variant (0–3)  — détermine la FORME du sprite (silhouette)
   Toutes les dimensions sont exprimées en multiples de s×PX ou de PX seul
   pour que la forme s'étire proportionnellement à la taille.
   Règle : les éléments de taille s=1 sont des formes minuscules (1–2 pixels),
           les éléments s=8–9 sont des formes imposantes qui montent haut dans le ciel.
*/

/**
 * drawFleur(p, x, y, variant, colorVariant, scalePX, theme, n)
 * RÔLE : Dessine une fleur pixel art — 4 formes × 8 couleurs × taille variable.
 *        variant=0 : bouton fermé / variant=1 : 3 pétales en croix /
 *        variant=2 : marguerite ronde (4 pétales) / variant=3 : tulipe allongée.
 */
function drawFleur(p, x, y, variant, colorVariant, scalePX, theme, n) {
  const s = scalePX; // alias court — utilisé partout ci-dessous

  // 8 couleurs de pétales — palette jardin sauvage, de douce à vive
  const PETALES = [
    '#e87878', // rose pâle
    '#e84848', // rouge vif
    '#e8c878', // jaune doux
    '#f0e020', // jaune citron
    '#c878e8', // mauve
    '#8840d0', // violet profond
    '#78c8e8', // bleu ciel
    '#ffffff', // blanc pur
  ];
  const colPetale = PETALES[colorVariant % 8];
  const colTige   = s <= 2 ? '#58a058' : '#3a8038'; // tige plus foncée sur les grandes fleurs
  const colCoeur  = colorVariant % 2 === 0 ? '#f0d878' : '#f09030'; // cœur jaune ou orangé

  if (variant === 0) {
    // ── Bouton fermé : tige + petite boule (minimaliste, s=1 → 1 pixel)
    p.fill(tc(n, colTige));
    px(p, x, y, PX, PX * s);                         // tige de hauteur s
    p.fill(tc(n, colPetale));
    px(p, x - PX, y - PX*s,       PX*3, PX*2);       // bouton ovale
    p.fill(tc(n, colCoeur));
    px(p, x,      y - PX*s - PX,  PX,   PX);         // pointe du bouton

  } else if (variant === 1) {
    // ── 3 pétales en croix : forme classique, tige proportionnelle
    p.fill(tc(n, colTige));
    px(p, x, y, PX, PX * s);                         // tige
    p.fill(tc(n, colPetale));
    px(p, x - PX*s, y - PX*s,     PX*s, PX*s);      // pétale gauche
    px(p, x + PX*s, y - PX*s,     PX*s, PX*s);      // pétale droit
    px(p, x,        y - PX*s*2,   PX*s, PX*s);      // pétale haut
    p.fill(tc(n, colCoeur));
    px(p, x,        y - PX*s,     PX*s, PX*s);      // cœur central

  } else if (variant === 2) {
    // ── Marguerite : 4 pétales en diagonale + cœur large
    p.fill(tc(n, colTige));
    px(p, x, y, PX, PX * s);                          // tige
    p.fill(tc(n, colPetale));
    // 4 pétales disposés en X (diagonales)
    px(p, x - PX*s,     y - PX*s,     PX*s, PX*s);   // bas-gauche
    px(p, x + PX,       y - PX*s,     PX*s, PX*s);   // bas-droit
    px(p, x - PX*s,     y - PX*s*2,   PX*s, PX*s);   // haut-gauche
    px(p, x + PX,       y - PX*s*2,   PX*s, PX*s);   // haut-droit
    p.fill(tc(n, colCoeur));
    px(p, x,            y - PX*s,     PX*s, PX*s);   // cœur large au centre

  } else {
    // ── Tulipe allongée : tige haute + chapeau arrondi caractéristique
    p.fill(tc(n, colTige));
    px(p, x, y, PX, PX * s);                          // tige longue
    // Feuilles latérales sur le bas de la tige (si assez grande)
    if (s >= 3) {
      px(p, x - PX*2, y - PX,     PX*2, PX);         // feuille gauche
      px(p, x + PX,   y - PX*2,   PX*2, PX);         // feuille droite (décalée)
    }
    p.fill(tc(n, colPetale));
    px(p, x - PX,    y - PX*s,    PX*3, PX*2);       // chapeau tulipe (ovale)
    p.fill(tc(n, colCoeur));
    px(p, x,         y - PX*s - PX, PX, PX);         // pointe du pétale intérieur
  }
}

/**
 * drawHerbe(p, x, y, variant, colorVariant, scalePX, n)
 * RÔLE : Dessine un brin ou une touffe d'herbe — 4 formes × 8 tons de vert × taille variable.
 *        variant=0 : brin unique droit / variant=1 : brin penché /
 *        variant=2 : touffe (3 brins) / variant=3 : rosette basse.
 */
function drawHerbe(p, x, y, variant, colorVariant, scalePX, n) {
  const s = scalePX;

  // 8 tons de vert — du vert tendre au vert sombre automnal
  const VERTS = [
    '#90d060', // vert tendre printanier
    '#70b858', // vert herbe standard
    '#509040', // vert foncé
    '#a8d870', // vert jauni (fin d'été)
    '#c8e060', // vert-jaune vif
    '#304828', // vert très sombre (à l'ombre)
    '#78c848', // vert pomme
    '#b0d890', // vert pâle (herbe sèche)
  ];
  const colVert  = VERTS[colorVariant % 8];
  const colFonce = VERTS[(colorVariant + 3) % 8]; // ton plus sombre pour l'ombre de base

  if (variant === 0) {
    // ── Brin unique droit — s'élance vers le haut, pointe fine
    p.fill(tc(n, colVert));
    for (let h = 0; h < s; h++) {
      // Largeur décroissante vers la pointe : large à la base, 1px au sommet
      const w = h < s / 2 ? 2 : 1;
      px(p, x, y - PX*h, PX*w, PX);
    }

  } else if (variant === 1) {
    // ── Brin penché — courbe vers la droite à mi-hauteur
    p.fill(tc(n, colVert));
    const mi = Math.floor(s / 2);
    for (let h = 0; h < s; h++) {
      const dx = h >= mi ? PX : 0; // décalage droit sur la moitié haute
      px(p, x + dx, y - PX*h, PX, PX);
    }

  } else if (variant === 2) {
    // ── Touffe : 3 brins de hauteurs légèrement différentes
    p.fill(tc(n, colVert));
    // Brin gauche (s-1), central (s), droit (s-2) — asymétrie naturelle
    for (let h = 0; h < s - 1; h++) px(p, x - PX, y - PX*h, PX, PX); // gauche
    for (let h = 0; h < s;     h++) px(p, x,       y - PX*h, PX, PX); // central
    for (let h = 0; h < s - 2; h++) px(p, x + PX,  y - PX*h, PX, PX); // droit

  } else {
    // ── Rosette basse : s'étale horizontalement plutôt que verticalement
    // Utile pour les petites herbes ras du sol (s=1–2)
    p.fill(tc(n, colVert));
    const demi = Math.max(1, Math.floor(s / 2));
    px(p, x - PX*demi, y,       PX*(demi*2+1), PX);   // étalement horizontal
    if (s >= 2) px(p, x - PX, y - PX, PX*3, PX);      // deuxième rang si assez grande
  }

  // Ombre commune à toutes les formes — ancre le brin au sol
  p.fill(tc(n, colFonce));
  px(p, x, y, PX*Math.min(2, s), PX);
}

/**
 * drawPierre(p, x, y, variant, colorVariant, scalePX, n)
 * RÔLE : Dessine une pierre ou un rocher — 4 formes × 8 teintes × taille variable.
 *        variant=0 : galet arrondi / variant=1 : bloc carré /
 *        variant=2 : dalle plate / variant=3 : rocher pointu.
 */
function drawPierre(p, x, y, variant, colorVariant, scalePX, n) {
  const s = scalePX;

  // 8 teintes de pierre — du gris clair au gris chaud en passant par des tons terreux
  const PIERRES = [
    '#b0b0b0', // gris neutre
    '#909090', // gris foncé
    '#c8b898', // grès beige
    '#a89880', // grès brun
    '#787878', // ardoise foncée
    '#c0c8d0', // calcaire clair
    '#686058', // brun rocheux
    '#d0c8b8', // calcaire chaud
  ];
  const colCorps  = PIERRES[colorVariant % 8];
  const colDessus = PIERRES[(colorVariant + 2) % 8]; // ton plus clair pour le dessus éclairé
  const colReflet = '#e8e8e8';                        // reflet blanc fixe

  if (variant === 0) {
    // ── Galet arrondi : forme trapézoïdale (plus large que haute)
    p.fill(tc(n, colCorps));
    px(p, x,      y,         PX*(s+1), PX*s);         // corps principal
    px(p, x + PX, y - PX*s, PX*(s-1), PX);            // dessus rétréci (arrondi simulé)
    p.fill(tc(n, colDessus));
    px(p, x + PX, y - PX*s, PX*s,     PX);            // dessus éclairé
    p.fill(tc(n, colReflet));
    px(p, x + PX, y - PX*s, PX,       PX);            // reflet coin

  } else if (variant === 1) {
    // ── Bloc carré : forme cubique simple
    p.fill(tc(n, colCorps));
    px(p, x,      y,         PX*s, PX*s);             // corps carré
    p.fill(tc(n, colDessus));
    px(p, x,      y - PX*(s-1), PX*s, PX);           // tranche du dessus
    p.fill(tc(n, colReflet));
    px(p, x,      y - PX*(s-1), PX,   PX);           // reflet coin gauche

  } else if (variant === 2) {
    // ── Dalle plate : très large, 1 seul PX de haut quelle que soit la taille
    // POURQUOI s'étale en X : simule une pierre plate au sol, comme un chemin
    p.fill(tc(n, colCorps));
    px(p, x,      y,         PX*(s*2), PX);           // très large et plate
    p.fill(tc(n, colDessus));
    px(p, x,      y,         PX*s,     PX);           // moitié gauche éclairée
    p.fill(tc(n, colReflet));
    px(p, x,      y,         PX,       PX);           // reflet extrême gauche

  } else {
    // ── Rocher pointu : plus haut que large, forme triangulaire
    p.fill(tc(n, colCorps));
    px(p, x,        y,         PX*s,         PX*s);   // base large
    px(p, x + PX,   y - PX*s, PX*(s-1),     PX*s);   // milieu rétréci
    if (s >= 2) px(p, x + PX, y - PX*s*2,   PX,  PX); // pointe (si assez grand)
    p.fill(tc(n, colDessus));
    px(p, x + PX,   y - PX*s, PX*(s-1),     PX);     // face éclairée du milieu
    p.fill(tc(n, colReflet));
    px(p, x + PX,   y - PX*s, PX,           PX);     // reflet pointe
  }
}

/**
 * drawChampignon(p, x, y, variant, colorVariant, scalePX, n)
 * RÔLE : Dessine un champignon — 4 formes × 8 couleurs × taille variable.
 *        variant=0 : amanite (chapeau large arrondi) /
 *        variant=1 : bolet (chapeau bombé, pied épais) /
 *        variant=2 : marasme (tout petit, pied fin) /
 *        variant=3 : pleurote (asymétrique, chapeau en éventail).
 */
function drawChampignon(p, x, y, variant, colorVariant, scalePX, n) {
  const s = scalePX;

  // 8 couleurs de chapeau — du rouge vif au brun discret
  const CHAPEAUX = [
    '#d04040', // rouge amanite
    '#e06820', // orange vif
    '#806040', // brun noisette
    '#8040a0', // violet mystérieux
    '#d0c030', // jaune ocre
    '#40a060', // vert mousse (champignon toxique ?)
    '#c08050', // fauve-roux
    '#f0f0d0', // blanc crème (champignon de Paris)
  ];
  const colChapeau = CHAPEAUX[colorVariant % 8];
  const colPied    = colorVariant % 3 === 0 ? '#e8e0d0' : '#c8b898'; // pied blanc ou beige
  const colPoints  = colorVariant % 2 === 0 ? '#ffffff' : '#fff8d0';  // points blancs ou ivoire

  if (variant === 0) {
    // ── Amanite : chapeau large et arrondi, points caractéristiques
    p.fill(tc(n, colPied));
    px(p, x, y,           PX*s,     PX*s);              // pied haut
    p.fill(tc(n, colChapeau));
    px(p, x - PX*s, y - PX*s,  PX*(s*2+1), PX*(s+1));  // chapeau très large
    px(p, x - PX,   y - PX*s*2, PX*(s+1),  PX);        // dôme supérieur
    // Points blancs — nombre proportionnel à la taille
    p.fill(tc(n, colPoints));
    px(p, x,        y - PX*s,    PX, PX);               // point central
    if (s >= 2) px(p, x - PX*s + PX, y - PX*s, PX, PX); // point gauche
    if (s >= 3) px(p, x + PX*s - PX, y - PX*s, PX, PX); // point droit

  } else if (variant === 1) {
    // ── Bolet : chapeau bombé, pied trapu et épais
    p.fill(tc(n, colPied));
    px(p, x - PX, y,      PX*(s+1), PX*s);              // pied trapu (large)
    p.fill(tc(n, colChapeau));
    px(p, x - PX*s, y - PX*s, PX*(s*2+1), PX*s);        // chapeau bombé
    px(p, x,        y - PX*s*2, PX*s,     PX);          // dôme central
    // Pas de points — les bolets n'en ont pas
    // Reflet sur le chapeau pour le volume
    p.fill(tc(n, '#ffffff'));
    px(p, x,        y - PX*s,   PX,       PX);          // reflet léger

  } else if (variant === 2) {
    // ── Marasme : très petit, pied fin et haut, chapeau minuscule
    // Intéressant sur s=1–2, devient très élancé sur s=4+
    p.fill(tc(n, colPied));
    px(p, x, y,           PX,       PX*s);              // pied fin (1px de large)
    p.fill(tc(n, colChapeau));
    px(p, x - PX, y - PX*s,  PX*3, PX);                // chapeau plat minuscule
    if (s >= 3) px(p, x,     y - PX*s - PX, PX, PX);  // pointe si assez grand
    p.fill(tc(n, colPoints));
    px(p, x,      y - PX*s,  PX,    PX);               // point unique au centre

  } else {
    // ── Pleurote : asymétrique, chapeau en éventail partant d'un côté
    p.fill(tc(n, colPied));
    px(p, x, y,           PX,       PX*s);              // pied court et latéral
    p.fill(tc(n, colChapeau));
    // Chapeau qui s'étale vers la gauche uniquement (asymétrique)
    px(p, x - PX*s*2, y - PX*s, PX*(s*2+1), PX*(s+1)); // éventail
    px(p, x - PX*s,   y - PX*s*2, PX*s,     PX);       // bord du dessus arrondi
    p.fill(tc(n, colPoints));
    if (s >= 2) px(p, x - PX*s, y - PX*s, PX, PX);    // point asymétrique
  }
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
    // RÔLE : Dispatch avec les nouveaux paramètres procéduraux (colorVariant, scalePX).
    // POURQUOI el.colorVariant ?? el.variant : gardenState anciens (Phase 1) n'ont pas
    //          colorVariant → fallback sur variant pour éviter un undefined silencieux.
    switch (el.type) {
      case 'fleur':
        drawFleur(p, el.x, el.y, el.variant, el.colorVariant ?? el.variant, el.scalePX ?? 3, theme, n);
        break;
      case 'herbe':
        drawHerbe(p, el.x, el.y, el.variant, el.colorVariant ?? el.variant, el.scalePX ?? 2, n);
        break;
      case 'pierre':
        drawPierre(p, el.x, el.y, el.variant, el.colorVariant ?? el.variant, el.scalePX ?? 2, n);
        break;
      case 'champignon':
        drawChampignon(p, el.x, el.y, el.variant, el.colorVariant ?? el.variant, el.scalePX ?? 4, n);
        break;
      // default : type inconnu → ignoré silencieusement (forward-compat Phase 3)
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
        drawFleur(p, el.x, el.y, el.variant, el.colorVariant ?? el.variant, el.scalePX ?? 3, theme, n);
        break;
      case 'herbe':
        drawHerbe(p, el.x, el.y, el.variant, el.colorVariant ?? el.variant, el.scalePX ?? 2, n);
        break;
      case 'pierre':
        drawPierre(p, el.x, el.y, el.variant, el.colorVariant ?? el.variant, el.scalePX ?? 2, n);
        break;
      case 'champignon':
        drawChampignon(p, el.x, el.y, el.variant, el.colorVariant ?? el.variant, el.scalePX ?? 4, n);
        break;
    }
  });
}
window.drawJardinPremierPlan = drawJardinPremierPlan;
