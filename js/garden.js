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
  //
  // DISTRIBUTION PONDÉRÉE (courbe en cloche asymétrique) :
  //   On ne tire PAS uniformément entre scaleMin et scaleMax.
  //   Formule : scalePX = scaleMin + floor(rng² × (scaleMax - scaleMin + 1))
  //   rng² écrase les grandes valeurs → beaucoup de petits éléments,
  //   quelques moyens, rares grands. Résultat visuel : jardin naturel, pas uniforme.
  //
  // RÈGLES PAR LAYER :
  //   fond         → grandes tailles autorisées (scaleMax jusqu'à 8) — derrière le Gotchi
  //   premier_plan → scaleMax plafonné à 3 — jamais plus haut que le Gotchi (y=130–155)
  //
  // RÈGLE SPRITES : la complexité visuelle augmente avec scalePX, pas la taille des blocs.
  //   s=1–2 : forme minimaliste (bouton, caillou, graine)
  //   s=3–4 : forme standard avec détails (pétales fins 1PX, points)
  //   s=5–6 : forme enrichie (double rangée, feuilles latérales)
  //   s=7–8 : forme complexe (étamines, nervures, volume)
  const SLOTS = [
    // Fleurs fond — grandes tailles pour les éléments derrière le Gotchi
    { type: 'fleur',      layer: 'fond',          count: 5,
      xMin: 10, xMax: 185, y: 118, maxAge: 7,   hauteurPX: 4,  scaleMin: 1, scaleMax: 8  },
    // Fleurs premier plan — petites, ne doivent pas cacher le Gotchi
    { type: 'fleur',      layer: 'premier_plan',  count: 3,
      xMin: 10, xMax: 185, y: 162, maxAge: 7,   hauteurPX: 2,  scaleMin: 1, scaleMax: 3  },
    // Herbes fond — peuvent être hautes derrière le Gotchi
    { type: 'herbe',      layer: 'fond',          count: 3,
      xMin: 10, xMax: 185, y: 118, maxAge: 14,  hauteurPX: 3,  scaleMin: 1, scaleMax: 7  },
    // Herbes premier plan — lisière basse, ras du sol
    { type: 'herbe',      layer: 'premier_plan',  count: 2,
      xMin: 10, xMax: 185, y: 162, maxAge: 14,  hauteurPX: 2,  scaleMin: 1, scaleMax: 3  },
    // Pierres fond — du caillou au rocher
    { type: 'pierre',     layer: 'fond',          count: 4,
      xMin: 10, xMax: 185, y: 118, maxAge: 999, hauteurPX: 2,  scaleMin: 1, scaleMax: 5  },
    // Champignons fond — petits à moyens, éphémères
    { type: 'champignon', layer: 'fond',          count: 3,
      xMin: 10, xMax: 185, y: 118, maxAge: 5,   hauteurPX: 3,  scaleMin: 1, scaleMax: 6  },
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

      // scalePX : taille réelle du sprite — distribution pondérée vers les petites valeurs.
      // FORMULE : rng² écrase les grandes valeurs.
      //   Exemple scaleMax=8 : rng=0.9 → 0.81 → scalePX≈7 (rare)
      //                        rng=0.5 → 0.25 → scalePX≈2 (fréquent)
      //                        rng=0.3 → 0.09 → scalePX≈1 (très fréquent)
      // POURQUOI pas uniforme : on veut beaucoup de petits éléments discrets,
      //   quelques moyens, et des grands comme événements visuels rares.
      const rngScale  = _gardenRng(seed, idxTotal++);
      const scalePX   = slot.scaleMin + Math.floor(rngScale * rngScale * (slot.scaleMax - slot.scaleMin + 1));
      const scaleFinal = Math.max(slot.scaleMin, Math.min(slot.scaleMax, scalePX)); // clamp défensif

      // hauteurPX effective = scalePX réel (pour la zone d'exclusion et gardenState)
      const hauteurPXEffective = scaleFinal;

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
        y:            slot.y,     // base fixe — le sprite grandit vers le haut depuis ce point
        variant,                   // forme (0–3) — recalculé depuis seed à chaque lancement
        colorVariant,              // couleur (0–7) — recalculé depuis seed
        scalePX:      scaleFinal,  // taille — recalculé depuis seed
        hauteurPX:    hauteurPXEffective,
        age:          0,           // SEULE valeur persistée — évolue avec les jours (Phase 3)
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
  // PHILOSOPHIE DE PERSISTANCE :
  //   On ne persiste que ce qui NE PEUT PAS être recalculé depuis la seed :
  //   → age uniquement (évolue avec les jours, Phase 3).
  //   variant, colorVariant, scalePX, x, y, hauteurPX sont tous déterministes
  //   depuis la seed → recalculés à chaque lancement → toute modif des sprites
  //   est immédiatement visible sans toucher à gardenState.
  if (!window.D.g.gardenState || window.D.g.gardenState.length === 0) {
    // Premier lancement : on initialise gardenState avec age=0 pour chaque élément
    window.D.g.gardenState = elements.map(() => ({ age: 0 }));
    save();
  } else {
    // Sessions suivantes : on relit uniquement l'âge.
    // POURQUOI index i : la seed garantit que l'élément i est toujours le même
    //   élément entre sessions (même type, x, y, variant) — l'index est stable.
    elements.forEach((el, i) => {
      const saved = window.D.g.gardenState[i];
      if (saved) el.age = saved.age ?? 0;
    });
    // RÔLE : Resynchronise gardenState si le nombre d'éléments a changé
    //   (ex: modification des SLOTS en Phase 3 — nouveaux types, counts différents).
    // POURQUOI : Sans ça, gardenState aurait un nombre d'entrées différent de elements
    //   après une mise à jour → indices décalés → âges appliqués aux mauvais éléments.
    if (window.D.g.gardenState.length !== elements.length) {
      window.D.g.gardenState = elements.map((el, i) => ({
        age: window.D.g.gardenState[i]?.age ?? 0
      }));
      save();
    }
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
 * RÔLE : Fleur pixel art — complexité croissante avec scalePX.
 *        s=1–2 : forme minimaliste (bouton ou brin)
 *        s=3–4 : fleur simple, pétales fins 1PX
 *        s=5–6 : fleur enrichie, double rangée ou feuilles
 *        s=7–8 : grande fleur complexe, étamines, nervures, volume
 *        variant (0–3) : famille de forme (classique / marguerite / tulipe / sauvage)
 *        colorVariant (0–7) : couleur des pétales, indépendante de la forme
 */
function drawFleur(p, x, y, variant, colorVariant, scalePX, theme, n) {
  const s = scalePX;

  // 8 couleurs de pétales — du doux au vif
  const PETALES = [
    '#f0a0b0', // rose poudré
    '#e84868', // rose-rouge vif
    '#f0d870', // jaune doux
    '#e8b020', // jaune doré
    '#c888e8', // mauve tendre
    '#7830c0', // violet profond
    '#80c8e8', // bleu ciel
    '#f8f8f8', // blanc cassé
  ];
  const colP  = PETALES[colorVariant % 8];                    // couleur pétales
  const colT  = s <= 3 ? '#58a058' : '#3a7030';              // tige : vert clair → vert sombre
  const colC  = (colorVariant % 2 === 0) ? '#f0d060' : '#e09020'; // cœur jaune ou doré
  const colFe = '#4a9840';                                    // feuilles latérales

  // ── ÉTAPE 1 : Tige (commune à toutes les formes) ─────────────────
  p.fill(tc(n, colT));
  px(p, x, y, PX, PX * s); // tige verticale de hauteur s

  // Feuilles latérales sur la tige — apparaissent à partir de s=4
  // POURQUOI s >= 4 : en dessous, la tige est trop courte pour les accueillir
  if (s >= 4) {
    p.fill(tc(n, colFe));
    px(p, x - PX*2, y - PX * Math.floor(s * 0.4), PX*2, PX); // feuille gauche (40% de la tige)
    px(p, x + PX,   y - PX * Math.floor(s * 0.6), PX*2, PX); // feuille droite (60% de la tige, décalée)
  }
  // Nervure centrale sur la tige — à partir de s=6
  if (s >= 6) {
    p.fill(tc(n, '#306828'));
    px(p, x, y - PX * Math.floor(s * 0.4), PX, PX * Math.floor(s * 0.4)); // nervure sombre
  }

  // ── ÉTAPE 2 : Tête de fleur — dispatch par variant ───────────────
  // Base de la tête : y - s×PX = sommet de la tige
  const yTop = y - PX * s; // coordonnée Y du sommet de la tige = base de la tête

  if (variant === 0) {
    // ── CLASSIQUE : 3 pétales en croix (gauche / droite / haut)
    // s=1–2 : pétales 1PX, forme minuscule
    // s=3–4 : pétales 1PX + cœur 1PX
    // s=5–6 : pétales 2PX, cœur 2PX
    // s=7–8 : pétales 2PX + pétale bas + étamines
    const ep = s >= 5 ? 2 : 1; // épaisseur des pétales en PX
    p.fill(tc(n, colP));
    px(p, x - PX*(ep+1), yTop,      PX*ep, PX*ep); // pétale gauche
    px(p, x + PX,        yTop,      PX*ep, PX*ep); // pétale droit
    px(p, x - PX*(ep-1), yTop-PX*ep, PX*ep, PX*ep);// pétale haut
    if (s >= 7) px(p, x - PX*(ep-1), yTop+PX, PX*ep, PX); // pétale bas (grande fleur)
    p.fill(tc(n, colC));
    px(p, x - PX*(ep-1), yTop, PX*ep, PX*ep); // cœur central
    // Étamines : petits points autour du cœur, s=7–8 uniquement
    if (s >= 7) {
      p.fill(tc(n, '#f8e040'));
      px(p, x - PX*2, yTop - PX, PX, PX);
      px(p, x + PX,   yTop - PX, PX, PX);
    }

  } else if (variant === 1) {
    // ── MARGUERITE : nombreux pétales fins rayonnants
    // s=1–2 : 2 pétales seulement (minuscule)
    // s=3–4 : 4 pétales fins 1PX
    // s=5–6 : 6 pétales fins + cœur proéminent
    // s=7–8 : 8 pétales fins + double cœur + étamines
    const nbPetales = s <= 2 ? 2 : s <= 4 ? 4 : s <= 6 ? 6 : 8;
    p.fill(tc(n, colP));
    // Disposition des pétales en étoile autour du centre
    // Positions hardcodées en PX pour rester sur la grille pixel art
    const OFFSETS = [
      [-2,  0], [2,  0],  // gauche, droit
      [ 0, -2], [0,  2],  // haut, bas
      [-2, -2], [2, -2],  // diagonales haut
      [-2,  2], [2,  2],  // diagonales bas
    ];
    for (let k = 0; k < nbPetales; k++) {
      const [ox, oy] = OFFSETS[k];
      px(p, x + PX*ox, yTop + PX*oy, PX, PX);
    }
    // Cœur — grossit avec la taille
    const coeurW = s >= 5 ? 2 : 1;
    p.fill(tc(n, colC));
    px(p, x - PX*(coeurW-1), yTop, PX*coeurW, PX*coeurW);
    if (s >= 7) { // étamines sur grande marguerite
      p.fill(tc(n, '#f8f040'));
      px(p, x - PX, yTop - PX, PX, PX);
      px(p, x + PX, yTop + PX, PX, PX);
    }

  } else if (variant === 2) {
    // ── TULIPE : chapeau ovale fermé, silhouette reconnaissable
    // s=1–2 : simple rectangle 2×1
    // s=3–4 : ovale 3×2 avec pointe
    // s=5–6 : ovale large + stries internes
    // s=7–8 : tulipe ouverte, pétales extérieurs visibles
    if (s <= 2) {
      p.fill(tc(n, colP));
      px(p, x - PX, yTop, PX*3, PX); // chapeau plat minuscule
    } else if (s <= 4) {
      p.fill(tc(n, colP));
      px(p, x - PX, yTop,      PX*3, PX*2); // corps ovale
      px(p, x,      yTop-PX,   PX,   PX);   // pointe centrale
      p.fill(tc(n, colC));
      px(p, x,      yTop+PX,   PX,   PX);   // base intérieure
    } else if (s <= 6) {
      p.fill(tc(n, colP));
      px(p, x - PX*2, yTop,      PX*5, PX*2); // ovale large
      px(p, x - PX,   yTop-PX,   PX*3, PX);   // dôme
      px(p, x,        yTop-PX*2, PX,   PX);   // pointe
      // Stries internes — 2 lignes plus sombres
      p.fill(tc(n, colC));
      px(p, x - PX, yTop, PX, PX*2);  // strie gauche
      px(p, x + PX, yTop, PX, PX*2);  // strie droite
    } else {
      // Tulipe ouverte — pétales extérieurs retombent
      p.fill(tc(n, colP));
      px(p, x - PX*3, yTop+PX,   PX*2, PX*2); // pétale gauche retombant
      px(p, x + PX*2, yTop+PX,   PX*2, PX*2); // pétale droit retombant
      px(p, x - PX*2, yTop,      PX*5, PX*2); // corps central
      px(p, x - PX,   yTop-PX,   PX*3, PX);   // dôme
      p.fill(tc(n, colC));
      px(p, x - PX,   yTop,      PX*3, PX);   // intérieur doré
      p.fill(tc(n, '#306828'));
      px(p, x,        yTop,      PX,   PX*2);  // strie centrale sombre
    }

  } else {
    // ── SAUVAGE : fleur irrégulière, asymétrique — la plus naturelle
    // s=1–2 : 1 pétale + 1 point (bouton sauvage)
    // s=3–4 : 3 pétales asymétriques
    // s=5–6 : 5 pétales asymétriques + feuillette calice
    // s=7–8 : grande fleur sauvage, cœur proéminent + étamines multiples
    if (s <= 2) {
      p.fill(tc(n, colP));
      px(p, x - PX, yTop, PX*2, PX); // pétale unique
      p.fill(tc(n, colC));
      px(p, x, yTop, PX, PX);        // cœur visible
    } else if (s <= 4) {
      p.fill(tc(n, colP));
      px(p, x - PX*2, yTop,      PX, PX); // pétale gauche bas
      px(p, x + PX,   yTop,      PX, PX); // pétale droit bas
      px(p, x - PX,   yTop-PX,   PX, PX); // pétale haut (décalé = asymétrie)
      p.fill(tc(n, colC));
      px(p, x,        yTop,      PX, PX); // cœur
    } else if (s <= 6) {
      p.fill(tc(n, colP));
      px(p, x - PX*3, yTop,      PX, PX*2); // pétale gauche long
      px(p, x + PX*2, yTop+PX,   PX, PX);   // pétale droit court (asymétrie)
      px(p, x - PX,   yTop-PX*2, PX, PX);   // pétale haut gauche
      px(p, x + PX,   yTop-PX,   PX, PX);   // pétale haut droit
      px(p, x - PX,   yTop+PX,   PX, PX);   // pétale bas
      p.fill(tc(n, colFe));
      px(p, x - PX*2, yTop+PX,   PX*2, PX); // calice (feuillette base)
      p.fill(tc(n, colC));
      px(p, x,        yTop,      PX*2, PX*2); // cœur proéminent
    } else {
      p.fill(tc(n, colP));
      px(p, x - PX*3, yTop,      PX,   PX*3); // pétale gauche très long
      px(p, x + PX*2, yTop+PX,   PX,   PX*2); // pétale droit moyen
      px(p, x - PX,   yTop-PX*3, PX*2, PX);   // pétale haut gauche
      px(p, x + PX,   yTop-PX*2, PX,   PX);   // pétale haut droit
      px(p, x - PX*2, yTop+PX*2, PX,   PX);   // pétale bas gauche
      px(p, x + PX,   yTop+PX,   PX,   PX);   // pétale bas droit
      p.fill(tc(n, colFe));
      px(p, x - PX*2, yTop+PX*2, PX*4, PX);   // calice large
      p.fill(tc(n, colC));
      px(p, x - PX,   yTop,      PX*3, PX*2); // gros cœur
      // Étamines multiples
      p.fill(tc(n, '#f8f040'));
      px(p, x - PX,   yTop-PX,   PX, PX);
      px(p, x + PX,   yTop-PX,   PX, PX);
      px(p, x,        yTop-PX*2, PX, PX);
    }
  }
}

/**
 * drawHerbe(p, x, y, variant, colorVariant, scalePX, n)
 * RÔLE : Dessine un brin ou une touffe d'herbe — 4 formes × 8 tons de vert × complexité croissante.
 *        variant=0 : brin unique droit / variant=1 : brin penché + courbure /
 *        variant=2 : touffe (3 brins) / variant=3 : fougère basse (rosette à palmes).
 *
 *        Complexité croissante avec scalePX :
 *        s=1–2 : minimaliste (1–2 pixels, simple silhouette)
 *        s=3–4 : forme reconnaissable, détails discrets
 *        s=5–6 : nervures, ombre portée, feuilles secondaires
 *        s=7+  : tige structurée, frondaison, reflets
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
  const colVert   = VERTS[colorVariant % 8];
  const colFonce  = VERTS[(colorVariant + 3) % 8]; // ombre / base
  const colClair  = VERTS[(colorVariant + 1) % 8]; // reflet clair pour grandes formes
  const colNervure = '#306828';                     // nervure sombre (grande fougère)

  if (variant === 0) {
    // ── BRIN DROIT : s'élance verticalement, pointe fine
    // s=1–2 : tige 1px, pas de détail
    // s=3–4 : tige 2px base, amincie en haut + légère ombre
    // s=5–6 : deux petites feuilles latérales à mi-hauteur
    // s=7+  : grande graminée avec épis en tête
    p.fill(tc(n, colVert));
    if (s <= 2) {
      px(p, x, y - PX, PX, PX); // 1 seul pixel haut
    } else if (s <= 4) {
      px(p, x, y,       PX*2, PX);    // base large
      px(p, x, y - PX,  PX,   PX*s); // tige fine vers le haut
    } else if (s <= 6) {
      px(p, x, y,       PX*2, PX);         // base
      px(p, x, y - PX,  PX,   PX*(s-1));   // tige
      // Feuilles latérales à mi-hauteur
      const mi = Math.floor(s * 0.5);
      px(p, x - PX*2, y - PX*mi, PX*2, PX);   // feuille gauche
      px(p, x + PX,   y - PX*mi, PX*2, PX);   // feuille droite
    } else {
      // Grande graminée — tige structurée + épis
      px(p, x, y,       PX*2, PX*2);           // base épaisse
      px(p, x, y - PX*2, PX,  PX*(s-2));       // tige fine
      // Feuilles à deux niveaux
      px(p, x - PX*2, y - PX*2,       PX*2, PX);
      px(p, x + PX,   y - PX*3,       PX*2, PX);
      px(p, x - PX,   y - PX*(s-1),   PX*2, PX);
      // Épis en tête (petits points)
      p.fill(tc(n, colFonce));
      px(p, x - PX, y - PX*s,     PX, PX);
      px(p, x + PX, y - PX*(s-1), PX, PX);
    }
    // Ombre de base
    p.fill(tc(n, colFonce));
    px(p, x, y, PX*2, PX);

  } else if (variant === 1) {
    // ── BRIN PENCHÉ : courbe vers la droite à mi-hauteur
    // s=1–2 : 2 pixels décalés
    // s=3–4 : courbure nette + ombre côté concave
    // s=5–6 : feuille au genou + nervure sombre
    // s=7+  : grande lame de roseau, se cintre en arc
    p.fill(tc(n, colVert));
    if (s <= 2) {
      px(p, x,      y - PX,  PX, PX);
      px(p, x + PX, y - PX*2, PX, PX); // simple diagonale
    } else if (s <= 4) {
      const mi = Math.floor(s / 2);
      for (let h = 0; h < mi; h++)  px(p, x,      y - PX*h, PX, PX); // partie basse
      for (let h = mi; h < s; h++)  px(p, x + PX,  y - PX*h, PX, PX); // partie haute décalée
      p.fill(tc(n, colFonce));
      px(p, x, y - PX*mi, PX, PX); // ombre au pli
    } else if (s <= 6) {
      const mi = Math.floor(s * 0.4);
      for (let h = 0; h < mi; h++)  px(p, x,      y - PX*h, PX*2, PX);
      for (let h = mi; h < s; h++)  px(p, x + PX*2, y - PX*h, PX, PX);
      // Nervure intérieure
      p.fill(tc(n, colFonce));
      for (let h = 1; h < mi; h++) px(p, x + PX, y - PX*h, PX, PX);
      // Feuille au genou
      p.fill(tc(n, colClair));
      px(p, x - PX, y - PX*(mi-1), PX*2, PX);
    } else {
      // Grande lame en arc
      for (let h = 0; h < 3; h++)        px(p, x,       y - PX*h, PX*2, PX);
      for (let h = 3; h < s - 2; h++)    px(p, x + PX,  y - PX*h, PX*2, PX);
      for (let h = s - 2; h < s; h++)    px(p, x + PX*3, y - PX*h, PX,  PX);
      // Nervure centrale
      p.fill(tc(n, colNervure));
      for (let h = 1; h < 3; h++)        px(p, x + PX,  y - PX*h, PX, PX);
      for (let h = 3; h < s - 2; h++)    px(p, x + PX*2, y - PX*h, PX, PX);
      // Feuilles secondaires
      p.fill(tc(n, colVert));
      px(p, x - PX*2, y - PX*2, PX*2, PX);
      px(p, x - PX,   y - PX*4, PX*2, PX);
    }
    p.fill(tc(n, colFonce));
    px(p, x, y, PX*2, PX); // ombre base

  } else if (variant === 2) {
    // ── TOUFFE : 3 brins de hauteurs différentes — s'enrichit avec la taille
    // s=1–2 : 3 petits pixels côte à côte
    // s=3–4 : 3 brins bien séparés avec hauteurs variées
    // s=5–6 : brins larges + ombre entre eux
    // s=7+  : touffe dense avec feuilles qui se chevauchent
    p.fill(tc(n, colVert));
    if (s <= 2) {
      px(p, x - PX, y - PX, PX, PX);
      px(p, x,      y - PX*s, PX, PX);
      px(p, x + PX, y - PX, PX, PX);
    } else if (s <= 4) {
      for (let h = 0; h < s-1; h++) px(p, x - PX, y - PX*h, PX, PX); // gauche s-1
      for (let h = 0; h < s;   h++) px(p, x,       y - PX*h, PX, PX); // centre s
      for (let h = 0; h < s-2; h++) px(p, x + PX,  y - PX*h, PX, PX); // droite s-2
    } else if (s <= 6) {
      // Brins larges avec ombre
      for (let h = 0; h < s-1; h++) px(p, x - PX*2, y - PX*h, PX*2, PX);
      for (let h = 0; h < s;   h++) px(p, x,         y - PX*h, PX*2, PX);
      for (let h = 0; h < s-2; h++) px(p, x + PX*2,  y - PX*h, PX*2, PX);
      p.fill(tc(n, colFonce));
      // Ombres entre les brins
      for (let h = 1; h < 3; h++) px(p, x - PX, y - PX*h, PX, PX);
      for (let h = 1; h < 3; h++) px(p, x + PX, y - PX*h, PX, PX);
    } else {
      // Touffe très dense : 5 brins + feuilles qui se croisent
      const hts = [s-2, s-1, s, s-1, s-3]; // hauteurs variées
      const xs  = [-4, -2, 0, 2, 4];
      hts.forEach((ht, i) => {
        p.fill(tc(n, i % 2 === 0 ? colVert : colClair));
        for (let h = 0; h < ht; h++) px(p, x + PX*xs[i], y - PX*h, PX*2, PX);
      });
      // Nervures sur les brins centraux
      p.fill(tc(n, colNervure));
      for (let h = 1; h < s - 2; h++) px(p, x + PX, y - PX*h, PX, PX);
    }
    p.fill(tc(n, colFonce));
    px(p, x - PX*2, y, PX*5, PX); // ombre base large

  } else {
    // ── FOUGÈRE / ROSETTE : palmes latérales qui s'étalent
    // s=1–2 : 3 points horizontaux (rosette microscopique)
    // s=3–4 : tige centrale + 2 palmes
    // s=5–6 : tige + 3 paires de palmes décalées
    // s=7+  : grande fougère, palmes courbées avec nervures
    p.fill(tc(n, colVert));
    if (s <= 2) {
      px(p, x - PX, y, PX, PX);
      px(p, x,      y - PX, PX, PX);
      px(p, x + PX, y, PX, PX);
    } else if (s <= 4) {
      px(p, x, y, PX, PX*s); // tige
      // Paire de palmes à mi-hauteur
      const mi = Math.floor(s * 0.5);
      px(p, x - PX*2, y - PX*mi, PX*2, PX);
      px(p, x + PX,   y - PX*mi, PX*2, PX);
    } else if (s <= 6) {
      px(p, x, y, PX, PX*s); // tige centrale
      // 3 paires de palmes décalées — crée l'effet fougère
      for (let k = 1; k <= 3; k++) {
        const yP = Math.floor(s * k / 4); // position régulièrement espacée sur la tige
        const lg = Math.max(1, 4 - k);    // palmes plus courtes vers le haut
        px(p, x - PX*(lg+1), y - PX*yP, PX*lg, PX);
        px(p, x + PX,        y - PX*yP, PX*lg, PX);
      }
    } else {
      // Grande fougère structurée
      px(p, x, y, PX*2, PX*s); // tige épaisse
      // 4 paires de palmes courbées
      const niveaux = [
        { k: 0.25, lg: 5 },
        { k: 0.45, lg: 6 },
        { k: 0.65, lg: 5 },
        { k: 0.82, lg: 3 },
      ];
      niveaux.forEach(({ k, lg }) => {
        const yP = Math.floor(s * k);
        p.fill(tc(n, colVert));
        px(p, x - PX*(lg+1), y - PX*yP,       PX*lg, PX); // palme gauche
        px(p, x + PX*2,      y - PX*yP,       PX*lg, PX); // palme droite
        // Courbure vers le bas en bout de palme
        px(p, x - PX*(lg+1), y - PX*yP + PX, PX*2,  PX);
        px(p, x + PX*(lg),   y - PX*yP + PX, PX*2,  PX);
        // Nervure centrale des palmes
        p.fill(tc(n, colNervure));
        px(p, x - PX*(lg),   y - PX*yP, PX, PX);
        px(p, x + PX*3,      y - PX*yP, PX, PX);
      });
    }
    p.fill(tc(n, colFonce));
    px(p, x - PX, y, PX*3, PX); // ombre base
  }
}

/**
 * drawPierre(p, x, y, variant, colorVariant, scalePX, n)
 * RÔLE : Dessine une pierre ou un rocher — 4 formes × 8 teintes × complexité croissante.
 *        variant=0 : galet arrondi / variant=1 : bloc carré avec volume /
 *        variant=2 : dalle plate affleurante / variant=3 : rocher pointu.
 *
 *        Complexité croissante avec scalePX :
 *        s=1–2 : caillou simple (1–2 blocs)
 *        s=3–4 : pierre avec ombre et reflet distinct
 *        s=5–6 : rocher avec plusieurs faces, fissures ou mousse
 *        s=7+  : gros rocher, fissures multiples, lichen, volume tridimensionnel
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
  const colCorps   = PIERRES[colorVariant % 8];
  const colDessus  = PIERRES[(colorVariant + 2) % 8]; // face supérieure éclairée
  const colOmbre   = PIERRES[(colorVariant + 4) % 8]; // face d'ombre (côté sombre)
  const colReflet  = '#e8e8e8';                        // reflet blanc (coin éclairé)
  const colLichen  = '#7a9050';                        // lichen vert (rochers ≥ s=6)
  const colFissure = PIERRES[(colorVariant + 5) % 8]; // fissure (ton encore plus sombre)

  if (variant === 0) {
    // ── GALET ARRONDI : trapèze, plus large que haut
    // s=1–2 : un simple rectangle
    // s=3–4 : trapèze avec dessus éclairé + reflet
    // s=5–6 : 3 faces + reflet + ombre portée
    // s=7+  : gros galet, fissure centrale + lichen
    if (s <= 2) {
      p.fill(tc(n, colCorps));
      px(p, x, y - PX, PX*(s+1), PX); // rectangle simple
    } else if (s <= 4) {
      p.fill(tc(n, colCorps));
      px(p, x,      y - PX,      PX*(s+2), PX*(s-1)); // corps
      px(p, x + PX, y - PX*s,   PX*s,     PX);        // dessus rétréci
      p.fill(tc(n, colDessus));
      px(p, x + PX, y - PX*s,   PX*s, PX);            // dessus éclairé
      p.fill(tc(n, colReflet));
      px(p, x + PX, y - PX*s,   PX,   PX);            // reflet coin
    } else if (s <= 6) {
      p.fill(tc(n, colCorps));
      px(p, x,        y - PX,    PX*(s+2), PX*(s-1)); // corps
      px(p, x + PX,   y - PX*s, PX*s,     PX);        // dessus
      p.fill(tc(n, colOmbre));
      px(p, x + PX*s, y - PX,   PX,       PX*(s-1)); // face d'ombre droite
      p.fill(tc(n, colDessus));
      px(p, x + PX,   y - PX*s, PX*s, PX);
      p.fill(tc(n, colReflet));
      px(p, x + PX,   y - PX*s, PX,   PX);
      // Ombre portée au sol
      p.fill(tc(n, colFissure));
      px(p, x + PX*2, y, PX*s, PX);
    } else {
      // Gros galet — 3 faces + fissure + lichen
      p.fill(tc(n, colCorps));
      px(p, x,        y - PX,    PX*(s+3), PX*(s-1));
      px(p, x + PX*2, y - PX*s, PX*(s),   PX);
      p.fill(tc(n, colOmbre));
      px(p, x + PX*(s+2), y - PX, PX*2, PX*(s-1)); // face ombre
      p.fill(tc(n, colDessus));
      px(p, x + PX*2, y - PX*s,  PX*(s),   PX);
      p.fill(tc(n, colReflet));
      px(p, x + PX*2, y - PX*s,  PX*2,     PX);
      // Fissure diagonale
      p.fill(tc(n, colFissure));
      px(p, x + PX*3, y - PX*2,  PX, PX);
      px(p, x + PX*4, y - PX*3,  PX, PX);
      // Lichen
      p.fill(tc(n, colLichen));
      px(p, x + PX*2, y - PX*(s-1), PX*2, PX);
    }

  } else if (variant === 1) {
    // ── BLOC CARRÉ : forme cubique, volume simulé
    // s=1–2 : carré plat
    // s=3–4 : cube 3 faces (dessus + face avant + ombre droite)
    // s=5–6 : cube grand + fissure + reflet
    // s=7+  : bloc massif + lichen + ombre profonde + gravure
    if (s <= 2) {
      p.fill(tc(n, colCorps));
      px(p, x, y - PX*(s-1), PX*s, PX*s);
    } else if (s <= 4) {
      p.fill(tc(n, colCorps));
      px(p, x,      y - PX*(s-1), PX*s, PX*s);          // face avant
      p.fill(tc(n, colDessus));
      px(p, x,      y - PX*(s-1) - PX, PX*s, PX);       // dessus
      p.fill(tc(n, colReflet));
      px(p, x,      y - PX*(s-1) - PX, PX,   PX);       // reflet
      p.fill(tc(n, colOmbre));
      px(p, x + PX*(s-1), y - PX*(s-1), PX, PX*(s-1)); // ombre côté droit
    } else if (s <= 6) {
      p.fill(tc(n, colCorps));
      px(p, x,      y - PX*(s-1), PX*s, PX*s);
      p.fill(tc(n, colDessus));
      px(p, x,      y - PX*s, PX*s, PX);
      p.fill(tc(n, colOmbre));
      px(p, x + PX*(s-1), y - PX*(s-1), PX, PX*s);
      p.fill(tc(n, colReflet));
      px(p, x, y - PX*s, PX, PX);
      // Fissure verticale sur la face avant
      p.fill(tc(n, colFissure));
      px(p, x + PX*2, y - PX*(s-1), PX, PX*(s-2));
    } else {
      // Gros bloc — lichen sur le dessus + ombre profonde
      p.fill(tc(n, colCorps));
      px(p, x, y - PX*(s-1), PX*(s+1), PX*s);
      p.fill(tc(n, colDessus));
      px(p, x, y - PX*s, PX*(s+1), PX);
      p.fill(tc(n, colOmbre));
      px(p, x + PX*s, y - PX*(s-1), PX, PX*s);
      p.fill(tc(n, colReflet));
      px(p, x, y - PX*s, PX, PX);
      // Fissures sur les deux faces
      p.fill(tc(n, colFissure));
      px(p, x + PX*2, y - PX*(s-1),  PX, PX*(s-1));
      px(p, x + PX*5, y - PX*(s-2),  PX, PX*(s-3));
      // Lichen sur le dessus
      p.fill(tc(n, colLichen));
      px(p, x + PX,   y - PX*s,      PX*2, PX);
      px(p, x + PX*4, y - PX*s,      PX,   PX);
    }

  } else if (variant === 2) {
    // ── DALLE PLATE : très large, affleurante au sol
    // s=1–2 : dalle fine 1px
    // s=3–4 : dalle avec bord relevé + ombre
    // s=5–6 : dalle large avec fissure + lichen
    // s=7+  : pavé avec joints apparents
    if (s <= 2) {
      p.fill(tc(n, colCorps));
      px(p, x, y, PX*(s*2+1), PX);
    } else if (s <= 4) {
      p.fill(tc(n, colCorps));
      px(p, x,      y,         PX*(s*2), PX);      // plateau
      px(p, x,      y - PX,   PX*(s*2), PX);      // bord relevé
      p.fill(tc(n, colDessus));
      px(p, x,      y - PX,   PX*s,     PX);      // côté éclairé
      p.fill(tc(n, colReflet));
      px(p, x,      y - PX,   PX,       PX);
    } else if (s <= 6) {
      p.fill(tc(n, colCorps));
      px(p, x,      y,         PX*(s*2+2), PX*2);  // dalle épaisse
      p.fill(tc(n, colDessus));
      px(p, x,      y - PX,   PX*(s*2+2), PX);    // dessus éclairé
      p.fill(tc(n, colReflet));
      px(p, x,      y - PX,   PX*2,       PX);
      // Fissure transversale
      p.fill(tc(n, colFissure));
      px(p, x + PX*s, y - PX, PX, PX*2);
      // Lichen en coin
      p.fill(tc(n, colLichen));
      px(p, x + PX*(s+2), y - PX, PX*2, PX);
    } else {
      // Grand pavé avec joints
      p.fill(tc(n, colCorps));
      px(p, x, y, PX*(s*2+4), PX*3);
      p.fill(tc(n, colDessus));
      px(p, x, y - PX*2, PX*(s*2+4), PX);
      p.fill(tc(n, colReflet));
      px(p, x, y - PX*2, PX*3, PX);
      // Joints (ligne médiane + verticale)
      p.fill(tc(n, colFissure));
      px(p, x, y - PX, PX*(s*2+4), PX);           // joint horizontal
      px(p, x + PX*(s+1), y - PX*2, PX, PX*3);   // joint vertical gauche
      px(p, x + PX*(s+3), y - PX*2, PX, PX*3);   // joint vertical droit
      // Lichen sur bords
      p.fill(tc(n, colLichen));
      px(p, x, y - PX*2, PX*2, PX);
      px(p, x + PX*(s*2+2), y - PX*2, PX*2, PX);
    }

  } else {
    // ── ROCHER POINTU : plus haut que large, silhouette triangulaire
    // s=1–2 : triangle 2 blocs
    // s=3–4 : rocher avec face ombre et reflet
    // s=5–6 : pic rocheux avec fissure + ombre au sol
    // s=7+  : formation rocheuse, plusieurs pics, lichen
    if (s <= 2) {
      p.fill(tc(n, colCorps));
      px(p, x, y - PX, PX*2, PX);   // base
      px(p, x, y - PX*2, PX, PX);   // pointe
    } else if (s <= 4) {
      p.fill(tc(n, colCorps));
      px(p, x,      y - PX,      PX*s,     PX*(s-1)); // base
      px(p, x + PX, y - PX*s,   PX*(s-1), PX*(s-1)); // milieu
      px(p, x + PX, y - PX*(s*2-1), PX,   PX);        // pointe
      p.fill(tc(n, colDessus));
      px(p, x + PX, y - PX*s, PX*(s-1), PX);          // face supérieure
      p.fill(tc(n, colReflet));
      px(p, x + PX, y - PX*s, PX, PX);
    } else if (s <= 6) {
      p.fill(tc(n, colCorps));
      px(p, x,        y - PX,       PX*(s+1), PX*(s-1));
      px(p, x + PX,   y - PX*s,     PX*(s-1), PX*(s-1));
      px(p, x + PX*2, y - PX*(s*2-1), PX,     PX);
      p.fill(tc(n, colOmbre));
      px(p, x + PX*s, y - PX,       PX,       PX*(s-1)); // face ombre
      p.fill(tc(n, colDessus));
      px(p, x + PX,   y - PX*s,     PX*(s-1), PX);
      p.fill(tc(n, colReflet));
      px(p, x + PX,   y - PX*s,     PX,       PX);
      // Fissure diagonale
      p.fill(tc(n, colFissure));
      px(p, x + PX*2, y - PX*2,    PX, PX);
      px(p, x + PX*3, y - PX*3,    PX, PX);
      // Ombre portée
      p.fill(tc(n, colFissure));
      px(p, x + PX*2, y,           PX*s, PX);
    } else {
      // Formation de deux pics — paysage rocheux dramatique
      // Pic principal (gauche)
      p.fill(tc(n, colCorps));
      px(p, x,        y - PX,        PX*4,    PX*(s-2));
      px(p, x + PX,   y - PX*(s-1),  PX*3,    PX*(s-3));
      px(p, x + PX*2, y - PX*(s*2-3),PX,      PX);
      // Pic secondaire (droite, plus petit)
      px(p, x + PX*4, y - PX,        PX*3,    PX*(s-4));
      px(p, x + PX*5, y - PX*(s-3),  PX*2,    PX*(s-5));
      px(p, x + PX*5, y - PX*(s*2-7),PX,      PX);
      p.fill(tc(n, colOmbre));
      px(p, x + PX*3, y - PX,        PX,      PX*(s-2));
      px(p, x + PX*6, y - PX,        PX,      PX*(s-4));
      p.fill(tc(n, colDessus));
      px(p, x + PX,   y - PX*(s-1),  PX*3, PX);
      px(p, x + PX*5, y - PX*(s-3),  PX*2, PX);
      p.fill(tc(n, colReflet));
      px(p, x + PX,   y - PX*(s-1),  PX, PX);
      // Fissures sur le pic principal
      p.fill(tc(n, colFissure));
      px(p, x + PX,   y - PX*3,      PX, PX*2);
      // Lichen en hauteur
      p.fill(tc(n, colLichen));
      px(p, x + PX*2, y - PX*(s-2),  PX*2, PX);
    }
  }
}

/**
 * drawChampignon(p, x, y, variant, colorVariant, scalePX, n)
 * RÔLE : Dessine un champignon — 4 formes × 8 couleurs × complexité croissante.
 *        variant=0 : amanite (chapeau large, points blancs) /
 *        variant=1 : bolet (chapeau bombé, pied trapu, reflets) /
 *        variant=2 : marasme (pied élancé, chapeau minuscule) /
 *        variant=3 : pleurote (asymétrique, chapeau en éventail).
 *
 *        Complexité croissante avec scalePX :
 *        s=1–2 : silhouette minuscule (bouton + tige)
 *        s=3–4 : forme reconnaissable + reflet + points
 *        s=5–6 : volume 3D simulé, lamelles ou pores, anneau
 *        s=7+  : spécimen impressionnant, ouverture du chapeau, sporée, volve
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
  const colLamelle = CHAPEAUX[(colorVariant + 4) % 8];                // lamelles (teinte contraste)
  const colOmbre   = CHAPEAUX[(colorVariant + 5) % 8];                // ombre du chapeau

  if (variant === 0) {
    // ── AMANITE : chapeau large et arrondi, points caractéristiques
    // s=1–2 : chapeau 3px + pied 1px
    // s=3–4 : chapeau large + dôme + points
    // s=5–6 : chapeau large + anneau sur le pied + points nombreux
    // s=7+  : grande amanite, chapeau bombé, volve à la base, sporée
    if (s <= 2) {
      p.fill(tc(n, colPied));
      px(p, x, y - PX, PX, PX);            // pied minuscule
      p.fill(tc(n, colChapeau));
      px(p, x - PX, y - PX*2, PX*3, PX);  // chapeau plat
    } else if (s <= 4) {
      p.fill(tc(n, colPied));
      px(p, x, y,          PX,       PX*s);              // pied fin
      p.fill(tc(n, colChapeau));
      px(p, x - PX*s, y - PX*s,  PX*(s*2+1), PX*(s+1)); // chapeau
      px(p, x - PX,   y - PX*(s+1), PX*(s+1), PX);      // dôme
      p.fill(tc(n, colPoints));
      px(p, x,        y - PX*s,    PX, PX);
      if (s >= 3) { px(p, x - PX*s + PX, y - PX*s, PX, PX); px(p, x + PX*s - PX, y - PX*s, PX, PX); }
    } else if (s <= 6) {
      p.fill(tc(n, colPied));
      px(p, x, y, PX*2, PX*s);              // pied épaissi
      // Anneau sur le pied à mi-hauteur
      p.fill(tc(n, colPoints));
      px(p, x - PX, y - PX*Math.floor(s*0.5), PX*4, PX);
      p.fill(tc(n, colChapeau));
      px(p, x - PX*s,   y - PX*s,    PX*(s*2+2), PX*(s));
      px(p, x - PX*(s-1), y - PX*(s+1), PX*(s*2),  PX);
      // Ombre sous le bord du chapeau
      p.fill(tc(n, colOmbre));
      px(p, x - PX*s,   y - PX*s,    PX*(s*2+2), PX);
      p.fill(tc(n, colPoints));
      // Points — jusqu'à 5 selon la taille
      px(p, x,        y - PX*(s-1),  PX, PX);
      px(p, x - PX*(s-2), y - PX*(s-1), PX, PX);
      px(p, x + PX*(s-2), y - PX*(s-1), PX, PX);
      px(p, x - PX*(s-1), y - PX*(s-2), PX, PX);
      px(p, x + PX*(s-1), y - PX*(s-2), PX, PX);
    } else {
      // Grande amanite imposante — volve, anneau, sporée
      p.fill(tc(n, colPied));
      px(p, x, y, PX*2, PX*s);
      // Volve à la base
      p.fill(tc(n, colOmbre));
      px(p, x - PX*2, y, PX*6, PX);
      px(p, x - PX,   y - PX, PX*4, PX);
      // Anneau
      p.fill(tc(n, colPoints));
      px(p, x - PX*2, y - PX*Math.floor(s*0.45), PX*6, PX);
      // Chapeau bombé
      p.fill(tc(n, colChapeau));
      px(p, x - PX*(s+1), y - PX*s,    PX*(s*2+4), PX*(s));
      px(p, x - PX*(s-1), y - PX*(s+1), PX*(s*2),   PX);
      px(p, x - PX*(s-3), y - PX*(s+2), PX*(s*2-2), PX);
      // Ombre portée sous bord
      p.fill(tc(n, colOmbre));
      px(p, x - PX*(s+1), y - PX*s, PX*(s*2+4), PX*2);
      // Points — 7 répartis
      p.fill(tc(n, colPoints));
      for (let k = -s+2; k <= s-2; k += 2) {
        px(p, x + PX*k, y - PX*(s-1), PX, PX);
      }
      // Sporée (fine ligne sous la jupe)
      p.fill(tc(n, colPoints));
      px(p, x - PX, y - PX*s, PX*4, PX);
    }

  } else if (variant === 1) {
    // ── BOLET : chapeau bombé, pied trapu, pas de points — réseau de pores
    // s=1–2 : forme arrondie simple
    // s=3–4 : pied trapu + chapeau bombé + reflet
    // s=5–6 : réseau de pores sous le chapeau + volume
    // s=7+  : bolet massif, hyménium visible, craquelures sur le chapeau
    if (s <= 2) {
      p.fill(tc(n, colPied));
      px(p, x, y - PX, PX*2, PX);           // pied court
      p.fill(tc(n, colChapeau));
      px(p, x - PX, y - PX*2, PX*4, PX*2); // chapeau demi-sphère
    } else if (s <= 4) {
      p.fill(tc(n, colPied));
      px(p, x - PX, y,      PX*(s+1), PX*s);
      p.fill(tc(n, colChapeau));
      px(p, x - PX*s, y - PX*s, PX*(s*2+1), PX*s);
      px(p, x,        y - PX*(s+1), PX*s,   PX);    // dôme central
      p.fill(tc(n, '#ffffff'));
      px(p, x,        y - PX*s,     PX,     PX);    // reflet
    } else if (s <= 6) {
      p.fill(tc(n, colPied));
      px(p, x - PX, y, PX*(s+2), PX*s);
      // Réseau de pores (hyménium) — rangée de petits carrés sous le bord
      p.fill(tc(n, colLamelle));
      px(p, x - PX*s, y - PX*s, PX*(s*2+2), PX);    // hyménium
      p.fill(tc(n, colChapeau));
      px(p, x - PX*s, y - PX*(s+1), PX*(s*2+2), PX*s);
      px(p, x - PX*(s-2), y - PX*(s+2), PX*(s*2-2), PX);
      p.fill(tc(n, colOmbre));
      px(p, x - PX*s, y - PX*(s+1), PX*(s*2+2), PX*2); // ombre bord
      p.fill(tc(n, '#ffffff'));
      px(p, x - PX*(s-2), y - PX*(s+1), PX*2, PX);  // reflet
    } else {
      // Bolet massif — craquelures + hyménium large
      p.fill(tc(n, colPied));
      px(p, x - PX*2, y, PX*(s+3), PX*s);
      // Hyménium (pores)
      p.fill(tc(n, colLamelle));
      px(p, x - PX*(s+1), y - PX*s, PX*(s*2+4), PX*2);
      // Chapeau large
      p.fill(tc(n, colChapeau));
      px(p, x - PX*(s+1), y - PX*(s+2), PX*(s*2+4), PX*(s));
      px(p, x - PX*(s-1), y - PX*(s+3), PX*(s*2),   PX);
      // Craquelures sur le dessus
      p.fill(tc(n, colOmbre));
      px(p, x - PX*2, y - PX*(s+3), PX, PX*2);
      px(p, x + PX*2, y - PX*(s+2), PX, PX*2);
      px(p, x + PX*5, y - PX*(s+3), PX, PX);
      // Reflets en arc
      p.fill(tc(n, '#ffffff'));
      px(p, x - PX*(s-2), y - PX*(s+2), PX*3, PX);
    }

  } else if (variant === 2) {
    // ── MARASME : pied très fin et haut, chapeau minuscule — élancé
    // s=1–2 : 1 pixel pied + 1 chapeau micro
    // s=3–4 : pied fin + chapeau plat + point
    // s=5–6 : pied coloré + chapeau en cloche + lamelles visibles
    // s=7+  : famille de marasmes (plusieurs pieds)
    if (s <= 2) {
      p.fill(tc(n, colPied));
      px(p, x, y - PX, PX, PX);            // tige
      p.fill(tc(n, colChapeau));
      px(p, x - PX, y - PX*2, PX*3, PX);  // chapeau 3px
    } else if (s <= 4) {
      p.fill(tc(n, colPied));
      px(p, x, y, PX, PX*s);               // pied fin
      p.fill(tc(n, colChapeau));
      px(p, x - PX, y - PX*s, PX*3, PX);  // chapeau
      if (s >= 3) px(p, x, y - PX*(s+1), PX, PX); // pointe
      p.fill(tc(n, colPoints));
      px(p, x, y - PX*s, PX, PX);          // point centre
    } else if (s <= 6) {
      p.fill(tc(n, colPied));
      px(p, x, y, PX, PX*s);
      // Chapeau en cloche
      p.fill(tc(n, colChapeau));
      px(p, x - PX*2, y - PX*s,    PX*5, PX*2);
      px(p, x - PX,   y - PX*(s+2), PX*3, PX);
      px(p, x,        y - PX*(s+3), PX,   PX);
      // Lamelles sous le chapeau
      p.fill(tc(n, colLamelle));
      px(p, x - PX*2, y - PX*s, PX, PX);
      px(p, x + PX*2, y - PX*s, PX, PX);
      px(p, x - PX,   y - PX*s, PX, PX);
      px(p, x + PX,   y - PX*s, PX, PX);
    } else {
      // Famille de 3 marasmes — petits, moyens, grands côte à côte
      const pieds = [
        { dx: -PX*3, ht: s - 2 },
        { dx: 0,     ht: s     },
        { dx: PX*3,  ht: s - 4 },
      ];
      pieds.forEach(({ dx, ht }) => {
        p.fill(tc(n, colPied));
        px(p, x + dx, y, PX, PX*ht);
        p.fill(tc(n, colChapeau));
        px(p, x + dx - PX*2, y - PX*ht, PX*5, PX*2);
        px(p, x + dx - PX,   y - PX*(ht+2), PX*3, PX);
        // Lamelles
        p.fill(tc(n, colLamelle));
        px(p, x + dx - PX*2, y - PX*ht, PX, PX);
        px(p, x + dx,         y - PX*ht, PX, PX);
        px(p, x + dx + PX*2,  y - PX*ht, PX, PX);
      });
    }

  } else {
    // ── PLEUROTE : chapeau en éventail asymétrique, pas de pied central
    // s=1–2 : éventail 3px posé au sol
    // s=3–4 : éventail + point + pied latéral
    // s=5–6 : éventail large + lamelles + volume
    // s=7+  : grande pleurote, lamelles saillantes, ombres profondes
    if (s <= 2) {
      p.fill(tc(n, colChapeau));
      px(p, x - PX*2, y - PX, PX*4, PX); // éventail minimal
    } else if (s <= 4) {
      p.fill(tc(n, colPied));
      px(p, x, y, PX, PX*s);              // pied latéral
      p.fill(tc(n, colChapeau));
      px(p, x - PX*s*2, y - PX*s, PX*(s*2+1), PX*(s+1));
      px(p, x - PX*s,   y - PX*(s+1), PX*s, PX);
      p.fill(tc(n, colPoints));
      if (s >= 3) px(p, x - PX*s, y - PX*s, PX, PX);
    } else if (s <= 6) {
      p.fill(tc(n, colPied));
      px(p, x, y, PX*2, PX*s);
      // Chapeau étalé
      p.fill(tc(n, colChapeau));
      px(p, x - PX*(s*2+1), y - PX*s,    PX*(s*2+3), PX*(s+1));
      px(p, x - PX*(s*2),   y - PX*(s+1), PX*(s*2),  PX);
      // Lamelles visibles sous le bord
      p.fill(tc(n, colLamelle));
      for (let k = -s*2; k <= -2; k += 2) {
        px(p, x + PX*k, y - PX*s, PX, PX*Math.floor(s*0.5));
      }
      // Volume sur le dessus
      p.fill(tc(n, colOmbre));
      px(p, x - PX*(s*2+1), y - PX*s, PX, PX*(s+1)); // bord gauche ombre
    } else {
      // Grande pleurote — lamelles saillantes et chapeau ondulé
      p.fill(tc(n, colPied));
      px(p, x, y, PX*2, PX*s);
      // Chapeau ondulé (plusieurs étages)
      p.fill(tc(n, colChapeau));
      px(p, x - PX*(s*2+2), y - PX*s,    PX*(s*2+4), PX*(s+1));
      px(p, x - PX*(s*2),   y - PX*(s+1), PX*(s*2),   PX);
      px(p, x - PX*(s*2-2), y - PX*(s+2), PX*(s*2-2), PX);
      // Ondulation du bord (valeurs différentes)
      px(p, x - PX*(s*2+2), y - PX*(s-1), PX, PX*3); // bosse gauche
      px(p, x - PX*(s+2),   y - PX*(s-1), PX, PX*2); // bosse milieu
      // Lamelles saillantes
      p.fill(tc(n, colLamelle));
      for (let k = -s*2; k <= -1; k += 2) {
        const lg = k < -s ? s : Math.floor(s * 0.5);
        px(p, x + PX*k, y - PX*s, PX, PX*lg);
      }
      // Ombre profonde sur le bord gauche
      p.fill(tc(n, colOmbre));
      px(p, x - PX*(s*2+2), y - PX*s, PX*2, PX*(s+1));
      // Reflet sur le dessus
      p.fill(tc(n, '#ffffff'));
      px(p, x - PX*(s-2), y - PX*(s+2), PX*3, PX);
    }
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
