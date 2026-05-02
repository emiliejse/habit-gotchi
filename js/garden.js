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

  const MAX_ATTEMPTS = 12; // max retentatives avant de skipper — augmenté pour réduire les skips

  // RÔLE : Vérifie si la position x empiète horizontalement sur un élément déjà placé.
  // POURQUOI uniquement horizontal : Y est fixe par layer (même ligne de sol) — pas de superposition verticale.
  // MARGE HORIZONTALE : PX*3 = 15px fixes — assez pour éviter les sprites qui se touchent,
  //   pas trop pour laisser la place à 20 éléments sur 175px de large.
  //   (175px / 20 éléments ≈ 8px d'espacement moyen — on autorise jusqu'à 15px de zone morte)
  function _estBloque(x, y, layer, placed) {
    const MARGE = PX * 3; // 15px de chaque côté — empreinte fixe, indépendante de la taille
    for (const el of placed) {
      if (el.layer !== layer) continue; // pas de collision entre layers différents (y différents)
      if (Math.abs(x - el.x) < MARGE) return true; // trop proche horizontalement
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

        // RÔLE : Vérifie si cette position X empiète sur un élément déjà placé du même layer.
        if (!_estBloque(x, slot.y, slot.layer, elements)) {
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
  // CONVENTION : y = base du sprite (ligne de sol). La tige monte vers le HAUT.
  // px() dessine depuis le coin supérieur gauche → yHaut = y - PX*s, hauteur PX*s.
  p.fill(tc(n, colT));
  px(p, x, y - PX*s, PX, PX * s); // tige : part du sommet (y - s×PX) et descend jusqu'à y

  // Feuilles latérales sur la tige — apparaissent à partir de s=4
  if (s >= 4) {
    p.fill(tc(n, colFe));
    px(p, x - PX*2, y - PX * Math.floor(s * 0.4), PX*2, PX); // feuille gauche à 40% de la hauteur
    px(p, x + PX,   y - PX * Math.floor(s * 0.6), PX*2, PX); // feuille droite à 60% (décalée)
  }
  // Nervure centrale sur la tige — à partir de s=6
  if (s >= 6) {
    p.fill(tc(n, '#306828'));
    // Nervure du milieu de la tige vers le haut : de y-s×PX jusqu'à y-0.4×s×PX
    px(p, x, y - PX*s, PX, PX * Math.floor(s * 0.6)); // portion haute de la tige plus sombre
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
 * RÔLE : Dessine un brin ou une touffe d'herbe — 4 formes × 8 tons × complexité croissante.
 *
 * CONVENTION : y = base du sprite (ligne de sol). Tout monte VERS LE HAUT.
 *   → rangée h (0=base, 1=au-dessus…) = px(p, x, y - PX*(h+1), largeur, PX)
 *   → colonne de hauteur H = px(p, x, y - PX*H, largeur, PX*H)
 */
function drawHerbe(p, x, y, variant, colorVariant, scalePX, n) {
  const s = scalePX;

  const VERTS = [
    '#90d060', '#70b858', '#509040', '#a8d870',
    '#c8e060', '#304828', '#78c848', '#b0d890',
  ];
  const colV = VERTS[colorVariant % 8];
  const colD = VERTS[(colorVariant + 3) % 8]; // ton sombre
  const colC = VERTS[(colorVariant + 1) % 8]; // ton clair

  if (variant === 0) {
    // ── BRIN DROIT
    p.fill(tc(n, colV));
    if (s <= 2) {
      px(p, x, y - PX,   PX,   PX);   // 1 rangée
      if (s === 2) px(p, x, y - PX*2, PX, PX);
    } else if (s <= 4) {
      px(p, x,      y - PX*s, PX,   PX*s);  // tige fine (sommet→base)
      px(p, x - PX, y - PX,   PX,   PX);    // petit épaulement gauche base
    } else if (s <= 6) {
      px(p, x,      y - PX*s,          PX,   PX*s);  // tige
      px(p, x - PX*2, y - PX*Math.floor(s*0.5), PX*2, PX); // feuille gauche
      px(p, x + PX,   y - PX*Math.floor(s*0.6), PX*2, PX); // feuille droite
    } else {
      px(p, x, y - PX*s, PX*2, PX*3);  // base épaisse (3 rangées basses)
      px(p, x, y - PX*s, PX,   PX*s);  // tige fine complète par-dessus
      px(p, x - PX*2, y - PX*3,       PX*2, PX);
      px(p, x + PX,   y - PX*4,       PX*2, PX);
      px(p, x - PX,   y - PX*(s-1),   PX*2, PX);
      p.fill(tc(n, colD));
      px(p, x - PX, y - PX*s,     PX, PX); // épi gauche
      px(p, x + PX, y - PX*(s-1), PX, PX); // épi droit
    }
    p.fill(tc(n, colD));
    px(p, x - PX, y - PX, PX*3, PX); // ombre au sol

  } else if (variant === 1) {
    // ── BRIN PENCHÉ (courbe vers la droite)
    p.fill(tc(n, colV));
    if (s <= 2) {
      px(p, x,      y - PX,   PX, PX);
      px(p, x + PX, y - PX*2, PX, PX);
    } else if (s <= 4) {
      const mi = Math.floor(s / 2);
      // bas : centré sur x
      px(p, x, y - PX*mi, PX, PX*mi);
      // haut : décalé d'un PX à droite
      px(p, x + PX, y - PX*s, PX, PX*(s - mi));
      p.fill(tc(n, colD));
      px(p, x, y - PX*mi, PX, PX); // ombre au pli
    } else if (s <= 6) {
      const mi = Math.floor(s * 0.45);
      px(p, x,      y - PX*mi, PX*2, PX*mi);          // partie basse large
      px(p, x + PX*2, y - PX*s, PX, PX*(s - mi));     // partie haute fine décalée
      p.fill(tc(n, colD));
      px(p, x + PX, y - PX*mi, PX, PX);               // nervure au pli
      p.fill(tc(n, colC));
      px(p, x - PX, y - PX*(mi-1), PX*2, PX);         // feuille au genou
    } else {
      // Lame large qui s'arc-boute
      px(p, x,        y - PX*3,     PX*2, PX*3);   // base
      px(p, x + PX,   y - PX*(s-2), PX*2, PX*(s-3));
      px(p, x + PX*3, y - PX*s,     PX,   PX*2);
      p.fill(tc(n, colD));
      px(p, x + PX,   y - PX*3,     PX,   PX);     // nervure basse
      px(p, x + PX*2, y - PX*(s-2), PX,   PX);     // nervure haute
      p.fill(tc(n, colV));
      px(p, x - PX*2, y - PX*2, PX*2, PX);         // feuille sortante
      px(p, x - PX,   y - PX*4, PX*2, PX);
    }
    p.fill(tc(n, colD));
    px(p, x - PX, y - PX, PX*3, PX);

  } else if (variant === 2) {
    // ── TOUFFE (3 brins de hauteurs variées)
    p.fill(tc(n, colV));
    if (s <= 2) {
      px(p, x - PX, y - PX,   PX, PX);
      px(p, x,      y - PX*s, PX, PX*s);
      px(p, x + PX, y - PX,   PX, PX);
    } else if (s <= 4) {
      px(p, x - PX, y - PX*(s-1), PX, PX*(s-1)); // brin gauche
      px(p, x,      y - PX*s,     PX, PX*s);      // brin central
      px(p, x + PX, y - PX*(s-2), PX, PX*(s-2)); // brin droit
    } else if (s <= 6) {
      px(p, x - PX*2, y - PX*(s-1), PX*2, PX*(s-1));
      px(p, x,        y - PX*s,     PX*2, PX*s);
      px(p, x + PX*2, y - PX*(s-2), PX*2, PX*(s-2));
      p.fill(tc(n, colD));
      px(p, x - PX,   y - PX*2, PX, PX*2); // ombre entre brins
      px(p, x + PX,   y - PX*2, PX, PX*2);
    } else {
      // 5 brins — alternance vert/clair
      const hts = [s-2, s-1, s, s-1, s-3];
      const dx  = [-4, -2, 0, 2, 4];
      hts.forEach((ht, i) => {
        p.fill(tc(n, i % 2 === 0 ? colV : colC));
        px(p, x + PX*dx[i], y - PX*ht, PX*2, PX*ht);
      });
      p.fill(tc(n, colD));
      px(p, x + PX, y - PX*(s-2), PX, PX*(s-2)); // nervure centrale
    }
    p.fill(tc(n, colD));
    px(p, x - PX*2, y - PX, PX*6, PX); // ombre base

  } else {
    // ── FOUGÈRE (palmes latérales)
    p.fill(tc(n, colV));
    if (s <= 2) {
      px(p, x - PX, y - PX,   PX, PX);
      px(p, x,      y - PX*2, PX, PX);
      px(p, x + PX, y - PX,   PX, PX);
    } else if (s <= 4) {
      px(p, x, y - PX*s, PX, PX*s); // tige
      const mi = Math.floor(s * 0.55);
      px(p, x - PX*2, y - PX*mi, PX*2, PX); // palme gauche
      px(p, x + PX,   y - PX*mi, PX*2, PX); // palme droite
    } else if (s <= 6) {
      px(p, x, y - PX*s, PX, PX*s); // tige
      // 3 paires de palmes, espacées régulièrement
      for (let k = 1; k <= 3; k++) {
        const yP = Math.floor(s * k / 4);
        const lg = Math.max(1, 4 - k);
        px(p, x - PX*(lg+1), y - PX*yP, PX*lg, PX);
        px(p, x + PX,        y - PX*yP, PX*lg, PX);
      }
    } else {
      // Grande fougère — 4 niveaux de palmes
      px(p, x, y - PX*s, PX*2, PX*s); // tige épaisse
      const niveaux = [
        { f: 0.25, lg: 5 }, { f: 0.45, lg: 6 },
        { f: 0.65, lg: 5 }, { f: 0.82, lg: 3 },
      ];
      niveaux.forEach(({ f, lg }) => {
        const yP = Math.floor(s * f);
        p.fill(tc(n, colV));
        px(p, x - PX*(lg+1), y - PX*yP, PX*lg, PX); // palme gauche
        px(p, x + PX*2,      y - PX*yP, PX*lg, PX); // palme droite
        // Bout de palme courbé vers le bas
        px(p, x - PX*(lg+1), y - PX*yP + PX, PX*2, PX);
        px(p, x + PX*(lg+1), y - PX*yP + PX, PX*2, PX);
        // Nervure
        p.fill(tc(n, '#306828'));
        px(p, x - PX*lg, y - PX*yP, PX, PX);
        px(p, x + PX*3,  y - PX*yP, PX, PX);
      });
    }
    p.fill(tc(n, colD));
    px(p, x - PX, y - PX, PX*3, PX);
  }
}

/**
 * drawPierre(p, x, y, variant, colorVariant, scalePX, n)
 * RÔLE : Dessine une pierre — 4 formes × 8 teintes × complexité croissante.
 *
 * CONVENTION : y = base. Tout monte vers le HAUT.
 *   Corps de hauteur H = px(p, x, y - PX*H, largeur, PX*H)
 *   Dessus à y - PX*H = px(p, x, y - PX*H, largeur, PX)
 */
function drawPierre(p, x, y, variant, colorVariant, scalePX, n) {
  const s = scalePX;

  const PIERRES = [
    '#b0b0b0', '#909090', '#c8b898', '#a89880',
    '#787878', '#c0c8d0', '#686058', '#d0c8b8',
  ];
  const colC  = PIERRES[colorVariant % 8];          // corps
  const colD  = PIERRES[(colorVariant + 2) % 8];    // dessus éclairé
  const colO  = PIERRES[(colorVariant + 4) % 8];    // ombre côté
  const colF  = PIERRES[(colorVariant + 5) % 8];    // fissure sombre
  const colR  = '#e8e8e8';                           // reflet blanc
  const colL  = '#7a9050';                           // lichen

  if (variant === 0) {
    // ── GALET : large et bas, corps = hauteur s, largeur s+2
    p.fill(tc(n, colC));
    px(p, x,      y - PX*s,    PX*(s+2), PX*s);  // corps
    if (s >= 3) {
      p.fill(tc(n, colD));
      px(p, x + PX, y - PX*s,  PX*s,     PX);    // dessus éclairé
      p.fill(tc(n, colR));
      px(p, x + PX, y - PX*s,  PX,       PX);    // reflet coin
    }
    if (s >= 5) {
      p.fill(tc(n, colO));
      px(p, x + PX*(s+1), y - PX*(s-1), PX, PX*(s-1)); // face ombre droite
      p.fill(tc(n, colF));
      px(p, x + PX*3, y - PX*2, PX, PX);  // fissure 1
      px(p, x + PX*4, y - PX*3, PX, PX);  // fissure 2
    }
    if (s >= 7) {
      p.fill(tc(n, colL));
      px(p, x + PX*2, y - PX*s, PX*2, PX); // lichen sur dessus
    }

  } else if (variant === 1) {
    // ── BLOC CARRÉ : cube, corps = carré s×s
    p.fill(tc(n, colC));
    px(p, x, y - PX*s, PX*s, PX*s);         // face avant
    if (s >= 2) {
      p.fill(tc(n, colD));
      px(p, x, y - PX*s, PX*s, PX);         // dessus
      p.fill(tc(n, colR));
      px(p, x, y - PX*s, PX,   PX);         // reflet coin
    }
    if (s >= 4) {
      p.fill(tc(n, colO));
      px(p, x + PX*(s-1), y - PX*(s-1), PX, PX*(s-1)); // face ombre
    }
    if (s >= 5) {
      p.fill(tc(n, colF));
      px(p, x + PX*2, y - PX*(s-1), PX, PX*(s-2)); // fissure verticale
    }
    if (s >= 7) {
      p.fill(tc(n, colL));
      px(p, x + PX,   y - PX*s, PX*2, PX);
      px(p, x + PX*4, y - PX*s, PX,   PX);
    }

  } else if (variant === 2) {
    // ── DALLE PLATE : très large (s×2), seulement 1–2 rangées de hauteur
    const h = Math.min(s, 3); // hauteur plafonnée à 3 PX-units
    p.fill(tc(n, colC));
    px(p, x, y - PX*h, PX*(s*2+1), PX*h);   // dalle
    if (s >= 2) {
      p.fill(tc(n, colD));
      px(p, x, y - PX*h, PX*(s+1), PX);     // moitié gauche éclairée
      p.fill(tc(n, colR));
      px(p, x, y - PX*h, PX,       PX);     // reflet
    }
    if (s >= 5) {
      p.fill(tc(n, colF));
      px(p, x + PX*s, y - PX*h, PX, PX*h); // fissure verticale
    }
    if (s >= 7) {
      // Joints
      p.fill(tc(n, colF));
      px(p, x + PX*(s+2), y - PX*h, PX, PX*h);
      p.fill(tc(n, colL));
      px(p, x, y - PX*h, PX*2, PX);
    }

  } else {
    // ── ROCHER POINTU : plus haut que large, silhouette pyramidale
    p.fill(tc(n, colC));
    if (s <= 2) {
      px(p, x, y - PX*2, PX*2, PX);  // base
      px(p, x, y - PX*3, PX,   PX);  // pointe
    } else if (s <= 4) {
      px(p, x,      y - PX*s,     PX*(s+1),  PX*(s-1)); // base large
      px(p, x + PX, y - PX*(s*2-1), PX*(s-1), PX*(s-1)); // milieu
      px(p, x + PX, y - PX*(s*2),   PX,       PX);       // pointe
      p.fill(tc(n, colD));
      px(p, x + PX, y - PX*(s*2-1), PX*(s-1), PX);
    } else if (s <= 6) {
      // Un seul pic clair
      px(p, x,      y - PX*s,     PX*(s+1), PX*(s-1));
      px(p, x + PX, y - PX*(s+s-1), PX*(s-1), PX*(s-1));
      px(p, x + PX, y - PX*(s*2),   PX, PX);
      p.fill(tc(n, colO));
      px(p, x + PX*s, y - PX*(s-1), PX, PX*(s-1)); // ombre droite
      p.fill(tc(n, colD));
      px(p, x + PX,   y - PX*(s+s-1), PX*(s-1), PX);
      p.fill(tc(n, colF));
      px(p, x + PX*2, y - PX*2, PX, PX); // fissure basse
      px(p, x + PX*3, y - PX*3, PX, PX);
    } else {
      // Double pic dramatique
      // Pic gauche (principal, plus haut)
      px(p, x,      y - PX*s,     PX*4, PX*(s-2));
      px(p, x + PX, y - PX*(s*2-2), PX*3, PX*(s-2));
      px(p, x + PX, y - PX*(s*2), PX,   PX);
      // Pic droit (plus petit)
      px(p, x + PX*5, y - PX*(s-2), PX*3, PX*(s-4));
      px(p, x + PX*5, y - PX*(s*2-4), PX*2, PX*(s-4));
      p.fill(tc(n, colO));
      px(p, x + PX*3, y - PX*(s-2), PX, PX*(s-2)); // ombre entre les pics
      p.fill(tc(n, colD));
      px(p, x + PX,   y - PX*(s*2-2), PX*3, PX); // dessus pic gauche
      px(p, x + PX*5, y - PX*(s*2-4), PX*2, PX); // dessus pic droit
      p.fill(tc(n, colF));
      px(p, x + PX*2, y - PX*3, PX, PX*2); // fissure pic gauche
      p.fill(tc(n, colL));
      px(p, x + PX*2, y - PX*(s-1), PX*2, PX); // lichen
    }
  }
}

/**
 * drawChampignon(p, x, y, variant, colorVariant, scalePX, n)
 * RÔLE : Dessine un champignon — 4 formes × 8 couleurs × complexité croissante.
 *
 * CONVENTION : y = base. Pied monte de y vers le haut.
 *   Pied de hauteur Hp = px(p, x, y - PX*Hp, largeur, PX*Hp)
 *   Chapeau posé sur le pied : yChap = y - PX*Hp
 *   Chapeau de hauteur Hc au-dessus de yChap = px(p, x, yChap - PX*Hc, largeur, PX*Hc)
 */
function drawChampignon(p, x, y, variant, colorVariant, scalePX, n) {
  const s = scalePX;

  const CHAPEAUX = [
    '#d04040', '#e06820', '#806040', '#8040a0',
    '#d0c030', '#40a060', '#c08050', '#f0f0d0',
  ];
  const colCh = CHAPEAUX[colorVariant % 8];
  const colPi = colorVariant % 3 === 0 ? '#e8e0d0' : '#c8b898';
  const colPt = colorVariant % 2 === 0 ? '#ffffff' : '#fff8d0';
  const colLa = CHAPEAUX[(colorVariant + 4) % 8]; // lamelles
  const colOm = CHAPEAUX[(colorVariant + 5) % 8]; // ombre chapeau

  // Hauteur du pied = moitié de s (arrondi), au moins 1
  const hp = Math.max(1, Math.floor(s * 0.45));
  // Hauteur du chapeau = reste
  const hc = Math.max(1, s - hp);

  const yPied   = y - PX*hp;      // sommet du pied = base du chapeau
  const yChap   = yPied - PX*hc;  // sommet du chapeau

  if (variant === 0) {
    // ── AMANITE : chapeau large, points blancs
    // Pied
    p.fill(tc(n, colPi));
    const wPied = s <= 2 ? 1 : 2;
    px(p, x, yPied, PX*wPied, PX*hp);

    if (s >= 5) {
      // Anneau sur le pied
      p.fill(tc(n, colPt));
      px(p, x - PX, yPied + PX*Math.floor(hp*0.5), PX*(wPied+2), PX);
    }
    if (s >= 7) {
      // Volve (base renflée)
      p.fill(tc(n, colOm));
      px(p, x - PX*2, y - PX, PX*(wPied+4), PX);
    }

    // Chapeau — s'élargit avec la taille
    const wCh = s <= 2 ? 3 : s <= 4 ? s*2+1 : s*2+3;
    p.fill(tc(n, colCh));
    px(p, x - PX*Math.floor(wCh/2), yChap, PX*wCh, PX*hc);
    // Dôme sur le dessus
    if (hc >= 2) {
      const wDome = Math.max(1, wCh - 2);
      px(p, x - PX*Math.floor(wDome/2), yChap - PX, PX*wDome, PX);
    }
    // Ombre bord inférieur
    if (s >= 3) {
      p.fill(tc(n, colOm));
      px(p, x - PX*Math.floor(wCh/2), yChap + PX*(hc-1), PX*wCh, PX);
    }
    // Points blancs
    p.fill(tc(n, colPt));
    px(p, x, yChap + PX, PX, PX);
    if (s >= 3) px(p, x - PX*Math.floor(wCh/2) + PX, yChap + PX, PX, PX);
    if (s >= 3) px(p, x + PX*Math.floor(wCh/2) - PX, yChap + PX, PX, PX);
    if (s >= 5) {
      px(p, x - PX*Math.floor(wCh/2) + PX, yChap + PX*2, PX, PX);
      px(p, x + PX*Math.floor(wCh/2) - PX, yChap + PX*2, PX, PX);
    }

  } else if (variant === 1) {
    // ── BOLET : pied trapu large, chapeau bombé sans points
    p.fill(tc(n, colPi));
    const wPied = Math.max(2, Math.floor(s * 0.6));
    px(p, x - PX, yPied, PX*(wPied+1), PX*hp);

    const wCh = s <= 2 ? 4 : s*2+1;
    // Hyménium (pores) sous le bord
    if (s >= 4) {
      p.fill(tc(n, colLa));
      px(p, x - PX*Math.floor(wCh/2), yChap + PX*(hc-1), PX*wCh, PX);
    }
    p.fill(tc(n, colCh));
    px(p, x - PX*Math.floor(wCh/2), yChap, PX*wCh, PX*hc);
    if (hc >= 2) {
      const wD = Math.max(1, wCh - 2);
      px(p, x - PX*Math.floor(wD/2), yChap - PX, PX*wD, PX);
    }
    // Reflet
    p.fill(tc(n, '#ffffff'));
    px(p, x, yChap, PX, PX);
    // Craquelures sur grand bolet
    if (s >= 6) {
      p.fill(tc(n, colOm));
      px(p, x - PX, yChap + PX, PX, PX);
      px(p, x + PX*2, yChap, PX, PX);
    }

  } else if (variant === 2) {
    // ── MARASME : pied très fin, chapeau minuscule
    p.fill(tc(n, colPi));
    px(p, x, yPied, PX, PX*hp); // pied fin = 1 unité large

    // Chapeau
    const wCh = Math.min(5, s + 1);
    p.fill(tc(n, colCh));
    px(p, x - PX*Math.floor(wCh/2), yChap, PX*wCh, PX*hc);
    if (hc >= 2) px(p, x - PX, yChap - PX, PX*3, PX); // pointe
    // Lamelles
    if (s >= 4) {
      p.fill(tc(n, colLa));
      for (let k = -Math.floor(wCh/2); k < Math.floor(wCh/2); k += 2) {
        px(p, x + PX*k, yChap + PX*(hc-1), PX, PX);
      }
    }
    // Sur s >= 7 : famille de 3 (un grand + deux petits)
    if (s >= 7) {
      const off = [{ dx: -PX*3, sc: s-3 }, { dx: PX*3, sc: s-4 }];
      off.forEach(({ dx, sc }) => {
        if (sc < 1) return;
        const hp2 = Math.max(1, Math.floor(sc * 0.45));
        const hc2 = Math.max(1, sc - hp2);
        const yP2 = y - PX*hp2;
        const yC2 = yP2 - PX*hc2;
        p.fill(tc(n, colPi));
        px(p, x + dx, yP2, PX, PX*hp2);
        p.fill(tc(n, colCh));
        px(p, x + dx - PX, yC2, PX*(Math.min(4, sc+1)), PX*hc2);
      });
    }

  } else {
    // ── PLEUROTE : asymétrique, chapeau en éventail vers la gauche
    p.fill(tc(n, colPi));
    px(p, x, yPied, PX, PX*hp); // pied court et fin

    // Chapeau en éventail — s'étale vers la gauche
    const wCh = s <= 2 ? 3 : s <= 4 ? s+2 : s*2;
    p.fill(tc(n, colCh));
    px(p, x - PX*wCh, yChap, PX*(wCh+1), PX*hc);
    if (hc >= 2) {
      px(p, x - PX*(wCh-1), yChap - PX, PX*(wCh-1), PX); // bord arrondi dessus
    }
    // Lamelles sous le bord — vers la gauche uniquement
    if (s >= 4) {
      p.fill(tc(n, colLa));
      const nb = Math.floor(wCh / 2);
      for (let k = 0; k < nb; k++) {
        px(p, x - PX*(wCh - k*2), yChap + PX*(hc-1), PX, PX);
      }
    }
    // Ombre bord gauche
    if (s >= 4) {
      p.fill(tc(n, colOm));
      px(p, x - PX*wCh, yChap, PX, PX*hc);
    }
    // Reflet dessus droit
    if (s >= 4) {
      p.fill(tc(n, '#ffffff'));
      px(p, x - PX*2, yChap, PX, PX);
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
