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
  // IMPORTANT : toutes les valeurs Y doivent être des multiples de PX=5.
  // px() arrondit les coordonnées sur la grille PX — si y n'est pas multiple de 5,
  // le snap crée un décalage entre y calculé et y réel → espaces entre les pixels des sprites.
  // ORDRE IMPÉRATIF : les grands éléments (arbustes) sont placés EN PREMIER,
  // pendant que le jardin est encore vide → garantit qu'ils trouvent toujours une place.
  // Les petits éléments (herbes, fleurs) se glissent ensuite dans les espaces restants.
  const SLOTS = [
    // Arbustes fond — EN PREMIER : grands éléments dominants, placés avant tout
    { type: 'arbuste',    layer: 'fond',          count: 2,
      xMin: 15, xMax: 175, y: 120, maxAge: 20,  hauteurPX: 10, scaleMin: 5, scaleMax: 14 },
    // Fleurs fond — grandes tailles pour les éléments derrière le Gotchi
    { type: 'fleur',      layer: 'fond',          count: 5,
      xMin: 10, xMax: 185, y: 120, maxAge: 7,   hauteurPX: 4,  scaleMin: 1, scaleMax: 8  },
    // Herbes fond — peuvent être hautes derrière le Gotchi
    { type: 'herbe',      layer: 'fond',          count: 3,
      xMin: 10, xMax: 185, y: 120, maxAge: 14,  hauteurPX: 3,  scaleMin: 1, scaleMax: 7  },
    // Pierres fond — du caillou au rocher
    { type: 'pierre',     layer: 'fond',          count: 4,
      xMin: 10, xMax: 185, y: 120, maxAge: 999, hauteurPX: 2,  scaleMin: 1, scaleMax: 5  },
    // Champignons fond — petits à moyens, éphémères
    { type: 'champignon', layer: 'fond',          count: 3,
      xMin: 10, xMax: 185, y: 120, maxAge: 5,   hauteurPX: 3,  scaleMin: 1, scaleMax: 6  },
    // Fleurs premier plan — petites, ne doivent pas cacher le Gotchi
    { type: 'fleur',      layer: 'premier_plan',  count: 3,
      xMin: 10, xMax: 185, y: 160, maxAge: 7,   hauteurPX: 2,  scaleMin: 1, scaleMax: 3  },
    // Herbes premier plan — lisière basse, ras du sol
    { type: 'herbe',      layer: 'premier_plan',  count: 2,
      xMin: 10, xMax: 185, y: 160, maxAge: 14,  hauteurPX: 2,  scaleMin: 1, scaleMax: 3  },
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
  // POURQUOI uniquement horizontal : Y est fixe par layer (même ligne de sol).
  //
  // MARGE ADAPTATIVE : la marge dépend du plus grand des deux éléments (candidat ou existant).
  //   Formule : max(scalePX_A, scalePX_B) × PX × 0.6
  //   Exemples :
  //     herbe s=2 vs herbe s=2  → max(2,2) × 5 × 0.6 = 6px   (petits éléments, serrés)
  //     fleur s=5 vs herbe s=2  → max(5,2) × 5 × 0.6 = 15px  (fleur moyenne, espace raisonnable)
  //     arbuste s=10 vs tout    → max(10,x) × 5 × 0.6 = 30px (grand élément, espace suffisant)
  //   POURQUOI 0.6 : les sprites ne remplissent pas tout leur scalePX en largeur —
  //   une fougère s=7 fait ~4 colonnes de large. 0.6 donne une marge honnête sans être
  //   trop agressive sur les petits éléments.
  //
  // scalePX du candidat est passé en paramètre pour le calcul.
  function _estBloque(x, layer, scalePXCandidat, placed) {
    for (const el of placed) {
      if (el.layer !== layer) continue;
      const marge = Math.max(scalePXCandidat, el.scalePX) * PX * 0.4;
      if (Math.abs(x - el.x) < marge) return true;
    }
    return false;
  }

  const elements = [];
  let idxTotal = 0; // index global — monotone croissant sur tous les tirages

  SLOTS.forEach(slot => {
    for (let i = 0; i < slot.count; i++) {

      // RÔLE : On tire scalePX EN PREMIER pour que la marge de collision soit
      //        proportionnelle à la taille de l'élément candidat dès le premier essai.
      // POURQUOI avant les positions X : _estBloque() a besoin de scalePX pour calculer
      //   la marge adaptative — on ne peut pas tirer X avant de connaître la taille.

      // variant : tiré avant le placement (détermine aussi des comportements de marge future)
      const variant      = Math.floor(_gardenRng(seed, idxTotal++) * 4);
      const colorVariant = Math.floor(_gardenRng(seed, idxTotal++) * 8);

      // scalePX : distribution pondérée rng² → beaucoup de petits, rares grands.
      const rngScale  = _gardenRng(seed, idxTotal++);
      const scalePX   = slot.scaleMin + Math.floor(rngScale * rngScale * (slot.scaleMax - slot.scaleMin + 1));
      const scaleFinal = Math.max(slot.scaleMin, Math.min(slot.scaleMax, scalePX));

      let x, placed = false;

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        // Position X : tirage dans la plage du slot, aligné sur la grille PX.
        const xRaw = slot.xMin + _gardenRng(seed, idxTotal++) * (slot.xMax - slot.xMin);
        x = Math.floor(xRaw / PX) * PX;

        // RÔLE : Vérifie collision avec marge proportionnelle à la taille du candidat.
        if (!_estBloque(x, slot.layer, scaleFinal, elements)) {
          placed = true;
          break;
        }
      }

      // hauteurPX effective = scalePX réel (pour la zone d'exclusion et gardenState)
      const hauteurPXEffective = scaleFinal;

      // RÔLE : Si aucune position libre après MAX_ATTEMPTS → skip silencieux.
      // POURQUOI : Mieux avoir 18 éléments bien placés que 20 avec chevauchements.
      if (!placed) {
        console.log(`[Garden] skip ${slot.type} #${i} — aucune position libre après ${MAX_ATTEMPTS} tentatives`);
        continue;
      }

      // maxAge individuel : tiré depuis la seed dans la plage [slot.maxAge * 0.5, slot.maxAge * 1.5]
      // POURQUOI varier : si tous les éléments d'un même type avaient le même maxAge,
      // ils vieilliraient et mourraient tous en même temps → transitions brutales.
      // Variation ±50% autour du maxAge du slot → mort progressive et naturelle.
      // Pour les pierres (maxAge=999), on garde 999 (immuables).
      let elMaxAge = slot.maxAge;
      if (slot.maxAge < 500) {
        const rngAge = _gardenRng(seed, idxTotal++);
        const ageMin = Math.max(3, Math.round(slot.maxAge * 0.6));
        const ageMax = Math.round(slot.maxAge * 1.4);
        elMaxAge = ageMin + Math.floor(rngAge * (ageMax - ageMin + 1));
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
        age:          0,           // évolue avec les jours (Phase 3) — persisté dans gardenState
        maxAge:       elMaxAge,    // durée de vie individuelle — persistée dans gardenState
      });
    }
  });

  // ── 4b. Tri par Y puis par scalePX décroissant ──────────────────
  // RÔLE : Double tri pour garantir la profondeur visuelle correcte.
  //
  // Clé 1 — Y croissant : sépare les deux layers.
  //   fond (y=120) est dessiné avant premier_plan (y=160) →
  //   les éléments de premier plan passent toujours devant. ✓
  //
  // Clé 2 — scalePX décroissant (à Y égal) : dans un même layer,
  //   les grands éléments sont dessinés EN PREMIER → visuellement
  //   derrière les petits. Les petits, dessinés après, passent devant.
  //
  // POURQUOI ne pas trier par X : les positions X sont aléatoires —
  //   trier par X ne produirait pas un effet de profondeur cohérent.
  //   scalePX est la seule valeur qui reflète la "présence" d'un élément.
  //
  // EXEMPLE : fond avec une grande fougère (s=7) et un petit caillou (s=1).
  //   Sans ce tri → ordre aléatoire → caillou peut passer devant la fougère.
  //   Avec ce tri → fougère dessinée avant → caillou passe devant. ✓
  elements.sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;      // layer fond (120) avant premier_plan (160)
    return b.scalePX - a.scalePX;           // grand d'abord → visuellement derrière
  });

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
    // Premier lancement : on initialise gardenState avec age=0 et maxAge tiré de l'élément
    // POURQUOI persister maxAge : il est tiré via _gardenRng dans la boucle idxTotal —
    //   si on le recalcule à chaque session, idxTotal doit rester identique, ce qui est
    //   garanti. Mais le persister évite tout risque de désynchronisation si les SLOTS
    //   changent de count entre versions — l'élément conserve son maxAge d'origine.
    window.D.g.gardenState = elements.map(el => ({ age: 0, maxAge: el.maxAge }));
    save();
  } else {
    // Sessions suivantes : on relit age ET maxAge sauvegardés.
    // POURQUOI index i : la seed garantit que l'élément i est toujours le même
    //   élément entre sessions (même type, x, y, variant) — l'index est stable.
    elements.forEach((el, i) => {
      const saved = window.D.g.gardenState[i];
      if (saved) {
        el.age    = saved.age    ?? 0;
        // RÔLE : Si maxAge était déjà persisté, on le restaure (Phase 3+).
        //        Si l'ancien gardenState ne contient pas encore maxAge
        //        (upgrade depuis une version antérieure), on garde le maxAge calculé.
        if (saved.maxAge !== undefined) el.maxAge = saved.maxAge;
      }
    });
    // RÔLE : Resynchronise gardenState si le nombre d'éléments a changé
    //   (ex: modification des SLOTS — nouveaux types, counts différents).
    if (window.D.g.gardenState.length !== elements.length) {
      window.D.g.gardenState = elements.map((el, i) => ({
        age:    window.D.g.gardenState[i]?.age    ?? 0,
        maxAge: window.D.g.gardenState[i]?.maxAge ?? el.maxAge,
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

/* ─── §0c : CYCLE DE VIE DU JARDIN ──────────────────────────────────── */

/**
 * _ageGarden() — Vieillissement quotidien du jardin
 *
 * RÔLE : Incrémente l'âge de chaque élément de +1 jour, retire les éléments
 *        morts (age >= maxAge), et fait germer 1–2 nouveaux éléments à des
 *        positions libres pour maintenir la densité du jardin.
 *
 * APPELÉE PAR : handleDailyReset() dans app.js — une seule fois par jour.
 *
 * APRÈS APPEL : app.js appelle save() puis initGarden() pour que
 *               window._gardenElements reflète le nouvel état.
 *
 * RÈGLE MAX 20 éléments : on ne germe jamais au-delà de 20 éléments au total.
 * RÈGLE ESPACEMENT : les nouveaux germes respectent une distance min de 15px
 *                   entre éléments du même layer.
 */
function _ageGarden() {
  // ── Garde : D.g.gardenState doit exister ──────────────────────────
  if (!window.D || !window.D.g || !window.D.g.gardenState) {
    console.warn('[Garden] _ageGarden() appelée sans gardenState — ignorée');
    return;
  }
  // ── Garde : _gardenElements doit être peuplé ───────────────────────
  // POURQUOI : _gardenElements porte la position x et le layer de chaque élément.
  //            Sans lui, on ne peut pas vérifier les collisions pour les germes.
  if (!window._gardenElements || window._gardenElements.length === 0) {
    console.warn('[Garden] _ageGarden() appelée sans _gardenElements — ignorée');
    return;
  }

  const state    = window.D.g.gardenState;
  const elements = window._gardenElements;
  const seed     = window.D.g.gardenSeed;

  // ── 1. Vieillissement : +1 à chaque élément vivant ────────────────
  // RÔLE : Incrémente l'âge de chaque entrée de gardenState.
  // POURQUOI : On mutate directement state[i].age — c'est la valeur persistée
  //            dans LocalStorage. window._gardenElements.age sera mis à jour
  //            au prochain appel de initGarden(), on ne le touche pas ici.
  state.forEach(s => {
    if (s.age < s.maxAge) s.age += 1;
  });

  // ── 2. Mort douce : repérer les éléments arrivés à maxAge ─────────
  // RÔLE : Collecter les indices des éléments dont age >= maxAge.
  // POURQUOI : On ne les retire pas dès age === maxAge - 1 : les fonctions
  //            draw*() les rendent déjà "fanés" visuellement à cet âge.
  //            Ils disparaissent ici au tick suivant (age === maxAge).
  const indiceMorts = [];
  state.forEach((s, i) => {
    if (s.age >= s.maxAge) indiceMorts.push(i);
  });

  // ── 3. Suppression des morts ───────────────────────────────────────
  // RÔLE : Retire les éléments morts de gardenState.
  // POURQUOI décroissant : splice() décale les indices suivants — en partant
  //   du plus grand index vers le plus petit, les indices déjà traités restent stables.
  //   Ex : indices morts [2, 5] → splice(5) d'abord, puis splice(2). ✓
  [...indiceMorts].sort((a, b) => b - a).forEach(i => {
    state.splice(i, 1);
  });

  // ── 4. Liste des survivants (positions pour calcul espacement) ─────
  // RÔLE : Construire une image des éléments encore vivants après suppression.
  // POURQUOI utiliser _gardenElements pour les positions (pas state) :
  //   gardenState ne stocke que age + maxAge. Les positions x/layer sont dans
  //   _gardenElements, indexées de façon identique à gardenState.
  //   On filtre les indices qui ne sont PAS dans indiceMorts.
  const survivants = elements.filter((_, i) => !indiceMorts.includes(i));

  // ── 5. Germination : 1–2 nouveaux éléments si sous le seuil ──────
  // RÔLE : Compenser les morts par de nouveaux germes (age=0).
  // RÈGLE : on germe au maximum autant que d'éléments morts, dans la limite de 20 total.
  //         Si nbMorts === 0 → pas de germination (jardin plein et sain).
  const MAX_ELEMENTS = 20;
  const nbMorts      = indiceMorts.length;
  const nbApresSuppr = survivants.length;
  const nbGermer     = Math.min(nbMorts, MAX_ELEMENTS - nbApresSuppr, 2);

  // RÔLE : Seed de germination dérivée de la seed principale XOR la date du jour.
  // POURQUOI XOR avec la date : la seed principale produit toujours les mêmes positions.
  //   En mélangeant avec le jour courant (transformé en entier), chaque journée de
  //   germination produit des positions différentes → le jardin se renouvelle vraiment.
  const daySeed = (seed ^ (today().replace(/-/g, '') | 0)) >>> 0;

  // Catalogue de slots disponibles pour les germes
  // POURQUOI exclure les pierres (maxAge=999) : elles ne meurent jamais → jamais remplacées.
  // POURQUOI exclure les arbustes : leur maxAge long les rend rarissimes à mourir — le
  //   catalogue SLOTS complet dans initGarden() gère leur présence initiale.
  const GERME_SLOTS = [
    { type: 'fleur',      layer: 'fond',         y: 120, xMin: 10, xMax: 185, maxAge: 7,  scaleMin: 1, scaleMax: 8 },
    { type: 'herbe',      layer: 'fond',         y: 120, xMin: 10, xMax: 185, maxAge: 14, scaleMin: 1, scaleMax: 7 },
    { type: 'champignon', layer: 'fond',         y: 120, xMin: 10, xMax: 185, maxAge: 5,  scaleMin: 1, scaleMax: 6 },
    { type: 'fleur',      layer: 'premier_plan', y: 160, xMin: 10, xMax: 185, maxAge: 7,  scaleMin: 1, scaleMax: 3 },
    { type: 'herbe',      layer: 'premier_plan', y: 160, xMin: 10, xMax: 185, maxAge: 14, scaleMin: 1, scaleMax: 3 },
  ];

  const MIN_ECART = 15; // distance minimale en px entre un germe et tout voisin du même layer

  // RÔLE : Vérifie si une position x est trop proche d'un voisin du même layer.
  function _tropProche(x, layer, vivants) {
    return vivants.some(el => el.layer === layer && Math.abs(el.x - x) < MIN_ECART);
  }

  const germes = []; // éléments germés ce tick — sert à éviter les collisions entre germes

  for (let g = 0; g < nbGermer; g++) {
    // Choisir un type de slot au hasard (déterministe via daySeed)
    const slotIdx = Math.floor(_gardenRng(daySeed, g * 10) * GERME_SLOTS.length);
    const slot    = GERME_SLOTS[slotIdx];

    // Tirer les propriétés du germe depuis la seed du jour
    const variant      = Math.floor(_gardenRng(daySeed, g * 10 + 1) * 4);
    const colorVariant = Math.floor(_gardenRng(daySeed, g * 10 + 2) * 8);
    const rngScale     = _gardenRng(daySeed, g * 10 + 3);
    const scalePX      = slot.scaleMin + Math.floor(rngScale * rngScale * (slot.scaleMax - slot.scaleMin + 1));
    const scaleFinal   = Math.max(slot.scaleMin, Math.min(slot.scaleMax, scalePX));

    // maxAge individuel ±40% autour du maxAge du slot
    const rngAge   = _gardenRng(daySeed, g * 10 + 4);
    const ageMin   = Math.max(3, Math.round(slot.maxAge * 0.6));
    const ageMax   = Math.round(slot.maxAge * 1.4);
    const elMaxAge = ageMin + Math.floor(rngAge * (ageMax - ageMin + 1));

    // Chercher une position x libre (12 tentatives max)
    let x      = null;
    let placed = false;
    const vivants = [...survivants, ...germes]; // tous les éléments vivants à ce tick

    for (let attempt = 0; attempt < 12; attempt++) {
      const xRaw  = slot.xMin + _gardenRng(daySeed, g * 10 + 5 + attempt) * (slot.xMax - slot.xMin);
      const xSnap = Math.floor(xRaw / PX) * PX;
      if (!_tropProche(xSnap, slot.layer, vivants)) {
        x = xSnap;
        placed = true;
        break;
      }
    }

    if (!placed) {
      console.log(`[Garden] germe ${slot.type} #${g} — aucune position libre après 12 tentatives, skip`);
      continue;
    }

    // RÔLE : Enregistrer le germe dans gardenState (persisté) ET dans germes (anti-collision).
    // POURQUOI state.push() maintenant : _ageGarden() mutate gardenState directement.
    //   initGarden() sera appelé juste après (par app.js) et reconstruira
    //   _gardenElements en intégrant ces nouveaux éléments.
    const germe = {
      type:        slot.type,
      layer:       slot.layer,
      x,
      y:           slot.y,
      variant,
      colorVariant,
      scalePX:     scaleFinal,
      hauteurPX:   scaleFinal,
      age:         0,        // vient de germer — jeune par définition
      maxAge:      elMaxAge,
    };
    germes.push(germe);                       // pour _tropProche() dans les germes suivants
    state.push({ age: 0, maxAge: elMaxAge }); // persisté dans D.g.gardenState
  }

  // ── 6. Mise à jour de gardenDay ───────────────────────────────────
  // RÔLE : Enregistre la date de ce vieillissement dans D.g.gardenDay.
  // POURQUOI : Permet à handleDailyReset() de vérifier si _ageGarden() a déjà
  //            tourné aujourd'hui — protection contre un double-appel accidentel.
  window.D.g.gardenDay = today();

  console.log(`[Garden] _ageGarden() — ${nbMorts} mort(s), ${germes.length} germe(s), ${state.length} éléments au total`);
}

// Exposée globalement pour être appelée depuis handleDailyReset() dans app.js
window._ageGarden = _ageGarden;

/* ─── §0d : SPRITES PIXEL ART ────────────────────────────────────── */

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
/**
 * drawFleur(p, x, y, variant, colorVariant, scalePX, theme, n, age, maxAge)
 *
 * RÔLE : Fleur pixel art — complexité pilotée par l'âge, taille par scalePX.
 *
 * CONVENTION ABSOLUE : y = base du sprite (ligne de sol).
 *   Tout dessin monte vers le HAUT depuis y.
 *   Rangée 0 (base)   → px(p, x, y - PX,     w, PX)
 *   Rangée 1           → px(p, x, y - PX*2,   w, PX)
 *   Colonne h rangées  → px(p, x, y - PX*h,   w, PX*h)
 *   ⚠️ Jamais de px() dont le coin Y est en-dessous de y (pas de y + PX*k).
 *   ⚠️ Chaque rectangle doit toucher au moins un autre rectangle du sprite.
 *
 * MATURITÉ :
 *   m = age / maxAge  (0.0 = vient de germer, 1.0 = va mourir)
 *   jeune  : m < 0.2  → bouton fermé sur tige courte
 *   épanoui: 0.2–0.85 → forme complète selon variant + taille
 *   vieux  : m > 0.85 → même forme mais opacité réduite + tige penchée
 *
 * variant 0 = classique | 1 = marguerite | 2 = tulipe | 3 = sauvage
 */
function drawFleur(p, x, y, variant, colorVariant, scalePX, theme, n, age, maxAge) {
  const s  = scalePX;
  const ag = age    ?? 0;
  const ma = maxAge ?? 7;
  const m  = ag / ma; // ratio maturité 0→1

  const PETALES = [
    '#f0a0b0', '#e84868', '#f0d870', '#e8b020',
    '#c888e8', '#7830c0', '#80c8e8', '#f8f8f8',
  ];
  const colP = PETALES[colorVariant % 8];
  const colT = '#4a8840';  // tige verte
  const colC = (colorVariant % 2 === 0) ? '#f0d060' : '#e09020'; // cœur
  const colF = '#3a7030';  // feuilles

  // ── Tige ─────────────────────────────────────────────────────────
  // Hauteur de tige : s rangées. Vieux → tige décalée d'1 PX à droite.
  const dx = m > 0.85 ? PX : 0; // tige penchée si vieux
  p.fill(tc(n, colT));
  px(p, x + dx, y - PX*s, PX, PX*s); // colonne pleine de s rangées

  // Feuilles sur la tige — apparaissent à l'âge épanoui (m >= 0.2), taille >= 3
  if (m >= 0.2 && s >= 3) {
    p.fill(tc(n, colF));
    // Feuille gauche : rangée à 40% de la hauteur, collée à la tige
    px(p, x + dx - PX, y - PX*Math.max(1, Math.round(s * 0.4)), PX*2, PX);
    // Feuille droite : rangée à 65% de la hauteur, collée à la tige (côté droit)
    if (s >= 4) {
      px(p, x + dx,     y - PX*Math.max(1, Math.round(s * 0.65)), PX*2, PX);
    }
  }

  // ── Tête de fleur ────────────────────────────────────────────────
  // yT = coordonnée du bas de la tête (= sommet de la tige)
  const yT = y - PX*s;

  if (m < 0.2) {
    // ── JEUNE : bouton fermé — cube compact posé sur la tige ─────
    // Toutes les formes : bouton 2×2 (ou 1×1 si s=1), couleur pétale
    p.fill(tc(n, colP));
    const bw = s >= 2 ? 2 : 1;
    // bouton centré sur x, posé directement sur le sommet de la tige
    // rangée 0 du bouton = rangée 0 au-dessus de la tige → yT - PX*bw .. yT
    px(p, x + dx - PX*(bw-1), yT - PX*bw, PX*(bw*2-1), PX*bw);

  } else {
    // ── ÉPANOUI / VIEUX : forme complète selon variant ──────────
    // Opacité réduite si vieux — on ne peut pas faire d'alpha avec p5 fill directement,
    // on utilise une teinte plus sombre/terne via tc() avec n légèrement forcé.
    const nFleur = m > 0.85 ? Math.min(1, n + 0.35) : n;

    if (variant === 0) {
      // ── CLASSIQUE : croix de 3 pétales + cœur central
      // Forme de base : 3 blocs en croix autour du cœur
      //   [P]      rangée +1 (pétale haut)
      // [P][C][P]  rangée 0  (pétales gauche/droit + cœur)
      // Tous connectés au cœur → aucun pixel isolé.
      p.fill(tc(nFleur, colP));
      px(p, x + dx - PX, yT - PX,   PX, PX); // pétale gauche — touche le cœur à droite
      px(p, x + dx + PX, yT - PX,   PX, PX); // pétale droit  — touche le cœur à gauche
      px(p, x + dx,      yT - PX*2, PX, PX); // pétale haut   — touche le cœur en dessous
      p.fill(tc(nFleur, colC));
      px(p, x + dx,      yT - PX,   PX, PX); // cœur central  — touche les 3 pétales
      // Pétale bas + étamines : apparaissent à taille >= 4 et âge épanoui
      if (s >= 4) {
        p.fill(tc(nFleur, colP));
        px(p, x + dx, yT, PX, PX); // pétale bas — posé sur la tige (yT), touche le cœur au-dessus
        if (s >= 6) {
          // 2e rangée de pétales : pétales gauche/droit sur la rangée du pétale haut
          px(p, x + dx - PX*2, yT - PX*2, PX, PX); // touche le pétale gauche à droite
          px(p, x + dx + PX*2, yT - PX*2, PX, PX); // touche le pétale droit à gauche
        }
      }

    } else if (variant === 1) {
      // ── MARGUERITE : disque central + pétales rayonnants
      // Disque 3×3 (ou 1×1 jeune) avec pétales sur le pourtour.
      // Tous les pétales touchent le disque → connectés.
      const r = s >= 4 ? 2 : 1; // rayon du disque central en PX-units
      // Disque central
      p.fill(tc(nFleur, colC));
      px(p, x + dx - PX*(r-1), yT - PX*(r*2-1), PX*(r*2-1), PX*(r*2-1));
      // Pétales : haut / bas / gauche / droit — chacun adjacent au disque
      p.fill(tc(nFleur, colP));
      // gauche : rangée du milieu du disque, à gauche
      px(p, x + dx - PX*(r+1), yT - PX*r,        PX, PX*(r*2-1));
      // droit
      px(p, x + dx + PX*r,     yT - PX*r,        PX, PX*(r*2-1));
      // haut
      px(p, x + dx - PX*(r-1), yT - PX*(r*2),    PX*(r*2-1), PX);
      // bas — touche le bas du disque (= yT) et la tige en-dessous
      px(p, x + dx - PX*(r-1), yT,                PX*(r*2-1), PX);
      // Pétales diagonaux — uniquement si épanoui et grande taille
      if (s >= 5) {
        px(p, x + dx - PX*r,     yT - PX*(r*2),  PX, PX); // diag haut-gauche — touche pétale haut
        px(p, x + dx + PX*(r-1), yT - PX*(r*2),  PX, PX); // diag haut-droit
        px(p, x + dx - PX*r,     yT,              PX, PX); // diag bas-gauche — touche pétale bas
        px(p, x + dx + PX*(r-1), yT,              PX, PX); // diag bas-droit
      }

    } else if (variant === 2) {
      // ── TULIPE : silhouette fermée arrondie
      // Forme :  [P]     ← pointe (rangée top)
      //         [PPP]    ← dôme
      //         [PPP]    ← corps
      // Toutes les rangées se touchent → bloc solide.
      p.fill(tc(nFleur, colP));
      px(p, x + dx - PX,  yT - PX*3, PX*3, PX); // corps bas   (3 large, 1 haut)
      px(p, x + dx - PX,  yT - PX*4, PX*3, PX); // corps haut  (idem — adjacent)
      px(p, x + dx,       yT - PX*5, PX,   PX); // pointe      (1 large, adjacent au corps haut)
      // Stries internes (couleur cœur) — uniquement si épanoui, taille >= 3
      if (s >= 3) {
        p.fill(tc(nFleur, colC));
        // 2 stries verticales dans le corps — touchent les rangées corps
        px(p, x + dx,     yT - PX*3, PX, PX*2); // strie centrale (2 rangées = corps bas + haut)
      }
      // Tulipe ouverte — pétales qui s'écartent, taille >= 5
      if (s >= 5) {
        p.fill(tc(nFleur, colP));
        // Pétale gauche écarté — adjacent au corps bas gauche
        px(p, x + dx - PX*2, yT - PX*2, PX, PX*2);
        // Pétale droit écarté — adjacent au corps bas droit
        px(p, x + dx + PX*2, yT - PX*2, PX, PX*2);
      }

    } else {
      // ── SAUVAGE : fleur asymétrique, pétales irréguliers
      // Forme de base : bloc central + extensions asymétriques.
      // Chaque extension touche le bloc central → aucun isolé.
      p.fill(tc(nFleur, colP));
      // Bloc central 2×2
      px(p, x + dx,      yT - PX*2, PX*2, PX*2);
      // Pétale gauche — touche le bloc central (bord gauche du bloc = x+dx)
      px(p, x + dx - PX, yT - PX*2, PX,   PX*2);
      // Pétale haut droit — touche le bloc (bord supérieur)
      px(p, x + dx + PX, yT - PX*3, PX,   PX);
      // Pétale bas gauche — touche le bloc (bord inférieur gauche)
      px(p, x + dx - PX, yT - PX,   PX,   PX);
      // Cœur par-dessus
      p.fill(tc(nFleur, colC));
      px(p, x + dx,      yT - PX*2, PX,   PX);
      // 2e rang de pétales — épanoui + taille >= 4
      if (s >= 4) {
        p.fill(tc(nFleur, colP));
        // Pétale gauche long — touche le pétale gauche existant
        px(p, x + dx - PX*2, yT - PX*2, PX, PX);
        // Pétale haut — touche le pétale haut droit
        px(p, x + dx,        yT - PX*4, PX, PX*2); // bande verticale, touche le bloc haut
      }
    }
  }
}

/**
 * drawHerbe(p, x, y, variant, colorVariant, scalePX, n, age, maxAge)
 *
 * RÔLE : Herbe pixel art — complexité pilotée par l'âge, taille par scalePX.
 *
 * CONVENTION ABSOLUE : y = base du sprite (ligne de sol). Tout monte vers le HAUT.
 *   Colonne de hauteur H = px(p, x, y - PX*H, largeur, PX*H)
 *   ⚠️ Aucun pixel isolé — chaque rectangle touche au moins un autre par une face.
 *
 * MATURITÉ : m = age / maxAge
 *   m < 0.2  → pousse : minuscule, forme à peine visible
 *   0.2–0.85 → épanoui : forme complète selon variant + enrichissement avec s
 *   m > 0.85 → fané : même forme, tige penchée (dx=PX), ton plus sombre
 *
 * variant 0 = graminée | 1 = jonc | 2 = touffe | 3 = fougère
 */
function drawHerbe(p, x, y, variant, colorVariant, scalePX, n, age, maxAge) {
  const s  = scalePX;
  const ag = age    ?? 0;
  const ma = maxAge ?? 14;
  const m  = ag / ma;

  const VERTS = [
    '#90d060', '#70b858', '#509040', '#a8d870',
    '#c8e060', '#304828', '#78c848', '#b0d890',
  ];
  const colV = VERTS[colorVariant % 8];
  const colD = VERTS[(colorVariant + 3) % 8]; // ton sombre
  const colC = VERTS[(colorVariant + 1) % 8]; // ton clair

  // Tige penchée si vieille (m > 0.85)
  const dx   = m > 0.85 ? PX : 0;
  // Teinte fanée : légèrement assombrie
  const nH   = m > 0.85 ? Math.min(1, n + 0.3) : n;

  if (m < 0.2) {
    // ── POUSSE : 1–2 pixels, forme minimale mais identifiable ────────
    // Toutes les variantes partagent la même pousse : 1 ou 2 rangées collées.
    p.fill(tc(nH, colV));
    px(p, x, y - PX, PX, PX); // rangée base — posée sur le sol
    if (s >= 3) px(p, x, y - PX*2, PX, PX); // rangée 2 — collée à la base

  } else if (variant === 0) {
    // ── GRAMINÉE : tige droite qui s'épaissit avec l'âge ────────────
    // s=1–2 : brin fin, 1 rangée de base large
    // s=3–4 : tige + étalement bas
    // s=5–6 : tige + 2 feuilles latérales collées à la tige
    // s=7+  : tige épaisse + feuilles + épis au sommet
    p.fill(tc(nH, colV));
    if (s <= 2) {
      // Tige fine, 1 colonne + rangée base
      px(p, x + dx, y - PX*s, PX, PX*s);
      px(p, x + dx - PX, y - PX, PX*3, PX); // pied étalé — touche la tige
    } else if (s <= 4) {
      px(p, x + dx,     y - PX*s, PX, PX*s); // tige
      px(p, x + dx - PX, y - PX,  PX*3, PX); // pied étalé
    } else if (s <= 6) {
      px(p, x + dx,       y - PX*s, PX, PX*s); // tige
      // Feuille gauche : collée à la tige (partage bord gauche de la tige)
      px(p, x + dx - PX*2, y - PX*Math.round(s*0.45), PX*2, PX);
      // Feuille droite : collée à la tige (partage bord droit)
      px(p, x + dx + PX,   y - PX*Math.round(s*0.65), PX*2, PX);
      px(p, x + dx - PX,   y - PX, PX*3, PX); // pied
    } else {
      // Grande graminée : tige épaisse + feuilles + épis
      px(p, x + dx,       y - PX*s, PX*2, PX*s); // tige épaisse (2 col)
      px(p, x + dx - PX*2, y - PX*Math.round(s*0.3), PX*2, PX); // feuille basse gauche
      px(p, x + dx + PX*2, y - PX*Math.round(s*0.5), PX*2, PX); // feuille haute droite
      px(p, x + dx - PX,   y - PX, PX*4, PX); // pied large
      // Épis au sommet (collés à la tige)
      p.fill(tc(nH, colD));
      px(p, x + dx - PX, y - PX*s,     PX, PX*2); // épi gauche — touche la tige
      px(p, x + dx + PX*2, y - PX*(s-1), PX, PX*2); // épi droit
    }

  } else if (variant === 1) {
    // ── JONC : tige qui s'arc-boute vers la droite ───────────────────
    // Principe : moitié basse droite, moitié haute décalée d'1 PX à droite.
    // Les deux morceaux se touchent au point de courbure → aucun pixel isolé.
    // s=1–2 : 2 pixels en escalier
    // s=3–4 : bas + haut collés au pli
    // s=5–6 : large + fin collés + feuille au genou
    // s=7+  : lame large avec nervure
    p.fill(tc(nH, colV));
    if (s <= 2) {
      // Deux pixels en escalier — se touchent par le coin (1 face commune)
      px(p, x + dx,      y - PX,   PX, PX); // base
      px(p, x + dx + PX, y - PX*2, PX, PX); // sommet — touche la base par la face
    } else if (s <= 4) {
      const mi = Math.floor(s * 0.5);
      px(p, x + dx,      y - PX*mi, PX, PX*mi);       // bas : centré sur x
      px(p, x + dx + PX, y - PX*s,  PX, PX*(s - mi)); // haut : décalé +1 — touche le bas
      p.fill(tc(nH, colD));
      px(p, x + dx,      y - PX*mi, PX, PX);           // ombre au pli
    } else if (s <= 6) {
      const mi = Math.floor(s * 0.45);
      px(p, x + dx,       y - PX*mi, PX*2, PX*mi);         // partie basse large
      px(p, x + dx + PX*2, y - PX*s, PX,   PX*(s - mi));   // partie haute fine — touche la basse
      // Feuille au genou : collée à la jonction (y - PX*mi)
      p.fill(tc(nH, colC));
      px(p, x + dx - PX,   y - PX*(mi+1), PX*2, PX); // feuille gauche — touche la tige
      p.fill(tc(nH, colD));
      px(p, x + dx + PX,   y - PX*mi,     PX, PX);   // ombre au pli
    } else {
      // Lame de roseau : 3 segments collés
      px(p, x + dx,        y - PX*3,       PX*2, PX*3);        // base large (3 rangées)
      px(p, x + dx + PX,   y - PX*(s - 1), PX*2, PX*(s - 3)); // milieu — touche la base
      px(p, x + dx + PX*3, y - PX*s,       PX,   PX*2);        // pointe — touche le milieu
      p.fill(tc(nH, colD));
      px(p, x + dx + PX,   y - PX*3,       PX,   PX);   // nervure basse — dans la base
      px(p, x + dx + PX*2, y - PX*(s - 1), PX,   PX);   // nervure haute — dans le milieu
      p.fill(tc(nH, colC));
      px(p, x + dx - PX,   y - PX*2,       PX*2, PX);   // feuille sortante gauche
    }

  } else if (variant === 2) {
    // ── TOUFFE : brins serrés de hauteurs variées ────────────────────
    // Les brins partagent leur base (y - PX) → connectés au sol.
    // s=1–2 : 3 pixels côte à côte
    // s=3–4 : 3 brins de largeur 1
    // s=5–6 : 3 brins de largeur 2 + ombres entre eux
    // s=7+  : 5 brins alternés vert/clair + nervure
    p.fill(tc(nH, colV));
    if (s <= 2) {
      // 3 pixels en V : gauche bas, centre haut, droit bas — tous collés à la base
      px(p, x + dx - PX, y - PX,   PX, PX);   // brin gauche
      px(p, x + dx,      y - PX*s, PX, PX*s); // brin central — touche les deux côtés
      px(p, x + dx + PX, y - PX,   PX, PX);   // brin droit
    } else if (s <= 4) {
      // 3 brins fins — se touchent à la base (même y de départ)
      px(p, x + dx - PX, y - PX*(s - 1), PX, PX*(s - 1)); // gauche — court
      px(p, x + dx,      y - PX*s,       PX, PX*s);        // central — haut
      px(p, x + dx + PX, y - PX*(s - 2), PX, PX*(s - 2)); // droit — très court
    } else if (s <= 6) {
      // 3 brins larges (2 col chacun) — se touchent à la base
      px(p, x + dx - PX*2, y - PX*(s - 1), PX*2, PX*(s - 1));
      px(p, x + dx,        y - PX*s,       PX*2, PX*s);
      px(p, x + dx + PX*2, y - PX*(s - 2), PX*2, PX*(s - 2));
      // Ombres entre brins — dans l'espace partagé à la base
      p.fill(tc(nH, colD));
      px(p, x + dx - PX, y - PX*2, PX, PX*2);
      px(p, x + dx + PX, y - PX*2, PX, PX*2);
    } else {
      // 5 brins — alternance vert/clair, tous reliés par la base commune
      const hts = [s - 2, s - 1, s, s - 1, s - 3];
      const dxs = [-4, -2, 0, 2, 4];
      hts.forEach((ht, i) => {
        p.fill(tc(nH, i % 2 === 0 ? colV : colC));
        px(p, x + dx + PX * dxs[i], y - PX * ht, PX * 2, PX * ht);
      });
      p.fill(tc(nH, colD));
      px(p, x + dx + PX, y - PX * (s - 2), PX, PX * (s - 2)); // nervure centrale
    }

  } else {
    // ── FOUGÈRE : tige centrale + palmes latérales ───────────────────
    // Les palmes sont toujours collées à la tige (partagent 1 colonne avec elle).
    // s=1–2 : tige + 1 palme centrale
    // s=3–4 : tige + 1 paire de palmes
    // s=5–6 : tige + 2 paires de palmes
    // s=7+  : tige + 3 paires étagées, palmes longues
    p.fill(tc(nH, colV));
    if (s <= 2) {
      // Tige 1 col + palme unique collée à mi-hauteur
      px(p, x + dx,      y - PX*s, PX,   PX*s); // tige
      px(p, x + dx - PX, y - PX*Math.round(s * 0.6), PX*2, PX); // palme gauche — touche la tige
    } else if (s <= 4) {
      px(p, x + dx,      y - PX*s, PX, PX*s); // tige
      const mi = Math.round(s * 0.55);
      px(p, x + dx - PX*2, y - PX*mi, PX*2, PX); // palme gauche — touche la tige
      px(p, x + dx + PX,   y - PX*mi, PX*2, PX); // palme droite — touche la tige
    } else if (s <= 6) {
      px(p, x + dx, y - PX*s, PX, PX*s); // tige
      // 2 paires de palmes — chacune collée à la tige (partage 1 col)
      const y1 = Math.round(s * 0.35);
      const y2 = Math.round(s * 0.65);
      px(p, x + dx - PX*3, y - PX*y1, PX*3, PX); // paire basse gauche
      px(p, x + dx + PX,   y - PX*y1, PX*3, PX); // paire basse droite
      px(p, x + dx - PX*2, y - PX*y2, PX*2, PX); // paire haute gauche
      px(p, x + dx + PX,   y - PX*y2, PX*2, PX); // paire haute droite
    } else {
      // Grande fougère : tige épaisse + 3 paires étagées
      px(p, x + dx, y - PX*s, PX*2, PX*s); // tige épaisse
      const paires = [
        { f: 0.25, lg: 3 },
        { f: 0.50, lg: 4 },
        { f: 0.75, lg: 3 },
      ];
      paires.forEach(({ f, lg }) => {
        const yP = Math.round(s * f);
        p.fill(tc(nH, colV));
        // Palme gauche — touche la tige (bord gauche tige = x+dx)
        px(p, x + dx - PX*lg, y - PX*yP, PX*lg, PX);
        // Palme droite — touche la tige (bord droit tige = x+dx+PX*2)
        px(p, x + dx + PX*2,  y - PX*yP, PX*lg, PX);
        // Bout recourbé : 1 pixel sous la palme, collé à son extrémité
        p.fill(tc(nH, colD));
        px(p, x + dx - PX*lg, y - PX*(yP - 1), PX, PX); // bout gauche
        px(p, x + dx + PX*(lg + 1), y - PX*(yP - 1), PX, PX); // bout droit
      });
    }
  }
}

/**
 * drawPierre(p, x, y, variant, colorVariant, scalePX, n, age, maxAge)
 *
 * RÔLE : Pierre pixel art — 4 formes, complexité pilotée par l'âge.
 *
 * CONVENTION ABSOLUE : y = base du sprite. Tout monte vers le HAUT.
 *   ⚠️ Aucun pixel isolé — chaque rectangle touche au moins un autre par une face.
 *
 * MATURITÉ : m = age / maxAge  (les pierres ont maxAge très long → vieillissent lentement)
 *   m < 0.2  → brute : anguleuse, pas de détails
 *   0.2–0.85 → arrondie : facette éclairée, fissures apparaissent avec s
 *   m > 0.85 → recouverte : lichen dense, légèrement enfoncée (y + PX)
 *
 * variant 0 = galet | 1 = bloc | 2 = dalle | 3 = rocher pointu
 */
function drawPierre(p, x, y, variant, colorVariant, scalePX, n, age, maxAge) {
  const s  = scalePX;
  const ag = age    ?? 0;
  const ma = maxAge ?? 999;
  const m  = ag / ma;

  const PIERRES = [
    '#b0b0b0', '#909090', '#c8b898', '#a89880',
    '#787878', '#c0c8d0', '#686058', '#d0c8b8',
  ];
  const colC = PIERRES[colorVariant % 8];
  const colD = PIERRES[(colorVariant + 2) % 8]; // dessus éclairé
  const colO = PIERRES[(colorVariant + 4) % 8]; // ombre côté
  const colF = PIERRES[(colorVariant + 5) % 8]; // fissure
  const colR = '#e8e8e8';                        // reflet
  const colL = '#7a9050';                        // lichen vert
  const colM = '#5a7838';                        // lichen foncé

  // Enfoncée dans le sol si très vieille (m > 0.85)
  // POURQUOI + PX : décale la base vers le bas → la pierre semble enterrée
  const yBase = m > 0.85 ? y + PX : y;

  if (variant === 0) {
    // ── GALET : large et bas (largeur s+2, hauteur s)
    p.fill(tc(n, colC));
    px(p, x, yBase - PX*s, PX*(s + 2), PX*s); // corps principal

    if (m >= 0.2) {
      // Arrondi : facette éclairée + reflet sur le dessus
      p.fill(tc(n, colD));
      px(p, x + PX, yBase - PX*s, PX*s, PX);   // dessus éclairé — touche le corps
      if (s >= 3) {
        p.fill(tc(n, colR));
        px(p, x + PX, yBase - PX*s, PX, PX);   // reflet coin — dans le dessus
      }
      if (s >= 5) {
        p.fill(tc(n, colO));
        px(p, x + PX*(s+1), yBase - PX*(s-1), PX, PX*(s-1)); // ombre droite — touche le corps
        p.fill(tc(n, colF));
        // Fissures dans le corps — connectées entre elles (cascade de pixels adjacents)
        px(p, x + PX*Math.round(s*0.5), yBase - PX*2, PX, PX);
        px(p, x + PX*Math.round(s*0.5) + PX, yBase - PX*3, PX, PX); // touche la fissure basse
      }
    }
    if (m > 0.85) {
      // Lichen : taches sur le dessus et le corps
      p.fill(tc(n, colL));
      px(p, x + PX*2, yBase - PX*s,     PX*2, PX);  // touche le dessus
      px(p, x + PX,   yBase - PX*(s-1), PX,   PX);  // flanc gauche
      if (s >= 4) {
        p.fill(tc(n, colM));
        px(p, x + PX*3, yBase - PX*s,     PX, PX);  // lichen foncé — touche le lichen clair
        px(p, x + PX*2, yBase - PX*(s-1), PX, PX);
      }
    }

  } else if (variant === 1) {
    // ── BLOC : cube s×s, angles droits
    p.fill(tc(n, colC));
    px(p, x, yBase - PX*s, PX*s, PX*s); // face avant

    if (m >= 0.2) {
      p.fill(tc(n, colD));
      px(p, x, yBase - PX*s, PX*s, PX);   // dessus — touche le corps
      if (s >= 2) {
        p.fill(tc(n, colR));
        px(p, x, yBase - PX*s, PX, PX);   // reflet coin — dans le dessus
      }
      if (s >= 4) {
        p.fill(tc(n, colO));
        px(p, x + PX*(s-1), yBase - PX*(s-1), PX, PX*(s-1)); // face ombre droite
      }
      if (s >= 5) {
        p.fill(tc(n, colF));
        // Fissure verticale dans le corps
        px(p, x + PX*2, yBase - PX*(s-1), PX, PX*(s-2)); // touche le dessus en haut
      }
    }
    if (m > 0.85) {
      p.fill(tc(n, colL));
      px(p, x + PX,   yBase - PX*s, PX*2, PX); // lichen sur dessus
      px(p, x,        yBase - PX*2, PX,   PX*2); // lichen bas gauche — touche le dessus
      if (s >= 4) {
        p.fill(tc(n, colM));
        px(p, x + PX*2, yBase - PX*s, PX, PX);   // lichen foncé — adjacent au clair
      }
    }

  } else if (variant === 2) {
    // ── DALLE PLATE : très large (s×2), hauteur plafonnée à 3
    const h = Math.min(s, 3);
    p.fill(tc(n, colC));
    px(p, x, yBase - PX*h, PX*(s*2+1), PX*h); // dalle principale

    if (m >= 0.2) {
      p.fill(tc(n, colD));
      px(p, x, yBase - PX*h, PX*(s+1), PX);   // moitié gauche éclairée — touche la dalle
      if (s >= 2) {
        p.fill(tc(n, colR));
        px(p, x, yBase - PX*h, PX, PX);        // reflet
      }
      if (s >= 4) {
        p.fill(tc(n, colF));
        px(p, x + PX*s, yBase - PX*h, PX, PX*h); // fissure verticale — dans la dalle
      }
    }
    if (m > 0.85) {
      // Lichen sur tout le bord de la dalle
      p.fill(tc(n, colL));
      px(p, x,            yBase - PX*h, PX*2, PX); // lichen bord gauche
      px(p, x + PX*(s+2), yBase - PX*h, PX*2, PX); // lichen bord droit — touche la dalle
      p.fill(tc(n, colM));
      px(p, x + PX,       yBase - PX*h, PX,   PX); // lichen foncé — entre les clairs
    }

  } else {
    // ── ROCHER POINTU : silhouette pyramidale, plus haut que large
    p.fill(tc(n, colC));
    if (s <= 2) {
      // Forme minimale : base + pointe adjacente
      px(p, x, yBase - PX,   PX*2, PX); // base
      px(p, x, yBase - PX*2, PX,   PX); // pointe — collée à la base
    } else if (s <= 4) {
      // Base évasée + corps + pointe
      px(p, x,      yBase - PX*(s - 1), PX*(s + 1), PX*(s - 1)); // base
      px(p, x + PX, yBase - PX*s,       PX*(s - 1), PX);         // pointe — collée à la base
    } else {
      // Rocher avec volume : base + corps effilé + pointe
      const w = s + 1; // largeur de la base
      px(p, x,      yBase - PX*(s - 2), PX*w, PX*(s - 2));   // base large
      px(p, x + PX, yBase - PX*s,       PX*(w - 2), PX*2);   // corps effilé — touche la base
      px(p, x + PX, yBase - PX*s,       PX, PX);              // pointe (déjà incluse dans le bloc ci-dessus)
      if (m >= 0.2) {
        p.fill(tc(n, colD));
        px(p, x + PX, yBase - PX*s, PX*(w - 2), PX);          // facette dessus effilé
        p.fill(tc(n, colO));
        px(p, x + PX*(w - 1), yBase - PX*(s - 3), PX, PX*(s - 3)); // ombre droite
        if (s >= 5) {
          p.fill(tc(n, colF));
          // Fissures diagonales dans la base (pixels adjacents en escalier)
          px(p, x + PX*2, yBase - PX*2, PX, PX);
          px(p, x + PX*3, yBase - PX*3, PX, PX); // touche la fissure basse
        }
      }
      if (m > 0.85) {
        p.fill(tc(n, colL));
        // Lichen dans les recoins de la base
        px(p, x,            yBase - PX*(s - 2), PX,   PX*2); // flanc gauche
        px(p, x + PX*(w-1), yBase - PX*2,       PX,   PX);   // flanc droit bas
        p.fill(tc(n, colM));
        px(p, x + PX,       yBase - PX*(s - 2), PX,   PX);   // lichen foncé haut gauche
      }
    }
  }
}

/**
 * drawChampignon(p, x, y, variant, colorVariant, scalePX, n, age, maxAge)
 *
 * RÔLE : Champignon pixel art — complexité pilotée par l'âge, taille par scalePX.
 *
 * CONVENTION ABSOLUE : y = base du sprite. Tout monte vers le HAUT.
 *   Pied : px(p, x, y - PX*hp, largeur, PX*hp)   → base du chapeau = y - PX*hp
 *   Chapeau : px(p, x, yPied - PX*hc, largeur, PX*hc)
 *   ⚠️ Aucun pixel isolé — pied et chapeau toujours adjacents.
 *
 * MATURITÉ : m = age / maxAge
 *   m < 0.2  → primordium : bouton minuscule, chapeau collé au pied (pas encore ouvert)
 *   0.2–0.85 → épanoui : pied + chapeau ouvert, détails selon s
 *   m > 0.85 → vieux : chapeau déformé (dx=PX, penche), ton terne
 *
 * variant 0 = amanite | 1 = bolet | 2 = marasme | 3 = pleurote
 */
function drawChampignon(p, x, y, variant, colorVariant, scalePX, n, age, maxAge) {
  const s  = scalePX;
  const ag = age    ?? 0;
  const ma = maxAge ?? 5;
  const m  = ag / ma;

  const CHAPEAUX = [
    '#d04040', '#e06820', '#806040', '#8040a0',
    '#d0c030', '#40a060', '#c08050', '#f0f0d0',
  ];
  const colCh = CHAPEAUX[colorVariant % 8];
  const colPi = colorVariant % 3 === 0 ? '#e8e0d0' : '#c8b898';
  const colPt = colorVariant % 2 === 0 ? '#ffffff' : '#fff8d0';
  const colLa = CHAPEAUX[(colorVariant + 4) % 8]; // lamelles
  const colOm = CHAPEAUX[(colorVariant + 5) % 8]; // ombre chapeau

  // Chapeau penché si vieux
  const dx  = m > 0.85 ? PX : 0;
  const nCh = m > 0.85 ? Math.min(1, n + 0.3) : n;

  // Hauteur du pied (≥1), chapeau = reste
  const hp   = Math.max(1, Math.floor(s * 0.45));
  const hc   = Math.max(1, s - hp);
  const yPied = y - PX * hp;       // base du chapeau (= sommet du pied)
  const yChap = yPied - PX * hc;   // sommet du chapeau

  if (m < 0.2) {
    // ── PRIMORDIUM : bouton fermé — petit bloc compact ────────────────
    // Le pied et le chapeau forment un seul bloc 1×s ou 2×s.
    // Toutes les variantes partagent la même forme de primordium.
    p.fill(tc(nCh, colPi));
    px(p, x, y - PX * s, PX, PX * s); // colonne pleine = pied + ébauche chapeau
    if (s >= 2) {
      p.fill(tc(nCh, colCh));
      px(p, x - PX, y - PX * s, PX * 3, PX); // coiffe collée au sommet de la colonne
    }

  } else if (variant === 0) {
    // ── AMANITE : chapeau large + points blancs ───────────────────────
    // Pied
    p.fill(tc(nCh, colPi));
    const wPied = s <= 2 ? 1 : 2;
    px(p, x, yPied, PX * wPied, PX * hp);
    // Anneau sur le pied (s >= 5)
    if (s >= 5) {
      p.fill(tc(nCh, colPt));
      // Anneau : 1 rangée plus large que le pied, à mi-hauteur — touche le pied
      px(p, x - PX, y - PX * Math.round(hp * 0.55), PX * (wPied + 2), PX);
    }

    // Chapeau — largeur croissante avec s, centré sur x + dx
    const wCh = s <= 2 ? 3 : s <= 4 ? s * 2 + 1 : s * 2 + 3;
    const cx  = x + dx;
    p.fill(tc(nCh, colCh));
    px(p, cx - PX * Math.floor(wCh / 2), yChap,      PX * wCh, PX * hc); // corps chapeau
    // Dôme arrondi au-dessus : largeur wCh-2, collé au corps
    if (hc >= 2) {
      const wD = Math.max(1, wCh - 2);
      px(p, cx - PX * Math.floor(wD / 2), yChap - PX, PX * wD, PX);
    }
    // Ombre bord inférieur — dans le corps (dernière rangée)
    if (s >= 3) {
      p.fill(tc(nCh, colOm));
      px(p, cx - PX * Math.floor(wCh / 2), yChap + PX * (hc - 1), PX * wCh, PX);
    }
    // Points blancs : pixel central + latéraux — tous dans le corps
    p.fill(tc(nCh, colPt));
    px(p, cx, yChap + PX, PX, PX); // point central
    if (s >= 3) {
      px(p, cx - PX * Math.floor(wCh / 2) + PX, yChap + PX, PX, PX); // point gauche
      px(p, cx + PX * Math.floor(wCh / 2) - PX, yChap + PX, PX, PX); // point droit
    }
    if (s >= 5) {
      // 2e rangée de points — collés au-dessus des premiers
      px(p, cx - PX * Math.floor(wCh / 2) + PX, yChap + PX * 2, PX, PX);
      px(p, cx + PX * Math.floor(wCh / 2) - PX, yChap + PX * 2, PX, PX);
    }

  } else if (variant === 1) {
    // ── BOLET : pied trapu, chapeau bombé, hyménium (pores) visible ──
    p.fill(tc(nCh, colPi));
    const wPied = Math.max(2, Math.floor(s * 0.6));
    px(p, x, yPied, PX * wPied, PX * hp); // pied large

    const wCh = s <= 2 ? 4 : s * 2 + 1;
    const cx  = x + dx - PX; // décalage naturel du bolet (pied décentré)
    // Hyménium : rangée de pores sous le bord du chapeau — collée au corps
    if (s >= 4) {
      p.fill(tc(nCh, colLa));
      px(p, cx - PX * Math.floor(wCh / 2), yChap + PX * (hc - 1), PX * wCh, PX);
    }
    p.fill(tc(nCh, colCh));
    px(p, cx - PX * Math.floor(wCh / 2), yChap, PX * wCh, PX * hc);
    if (hc >= 2) {
      const wD = Math.max(1, wCh - 2);
      px(p, cx - PX * Math.floor(wD / 2), yChap - PX, PX * wD, PX); // dôme
    }
    // Reflet — pixel unique dans le corps
    p.fill(tc(nCh, '#ffffff'));
    px(p, cx + PX, yChap, PX, PX);
    // Craquelures (vieux bolet) — dans le corps
    if (s >= 5 && m > 0.5) {
      p.fill(tc(nCh, colOm));
      px(p, cx,        yChap + PX, PX, PX);
      px(p, cx + PX*2, yChap,      PX, PX); // touche le reflet par la face
    }

  } else if (variant === 2) {
    // ── MARASME : pied fin, petit chapeau, peut pousser en famille ───
    p.fill(tc(nCh, colPi));
    px(p, x, yPied, PX, PX * hp); // pied fin = 1 col

    const wCh = Math.min(5, s + 1);
    const cx  = x + dx;
    p.fill(tc(nCh, colCh));
    px(p, cx - PX * Math.floor(wCh / 2), yChap, PX * wCh, PX * hc);
    if (hc >= 2) {
      // Pointe : bloc 3 large, collé au-dessus du corps
      px(p, cx - PX, yChap - PX, PX * 3, PX);
    }
    // Lamelles : pixels sous le bord, espacés — tous dans le corps
    if (s >= 4) {
      p.fill(tc(nCh, colLa));
      for (let k = -Math.floor(wCh / 2); k < Math.floor(wCh / 2); k += 2) {
        px(p, cx + PX * k, yChap + PX * (hc - 1), PX, PX);
      }
    }
    // Famille de petits (s >= 6, épanoui) — marasmes collés au principal
    if (s >= 6 && m >= 0.2) {
      const famille = [{ offX: -PX * 3, sc: s - 3 }, { offX: PX * 3, sc: s - 4 }];
      famille.forEach(({ offX, sc }) => {
        if (sc < 1) return;
        const hp2 = Math.max(1, Math.floor(sc * 0.45));
        const hc2 = Math.max(1, sc - hp2);
        const yP2 = y - PX * hp2;
        const yC2 = yP2 - PX * hc2;
        p.fill(tc(nCh, colPi));
        px(p, cx + offX, yP2, PX, PX * hp2);
        p.fill(tc(nCh, colCh));
        px(p, cx + offX - PX, yC2, PX * Math.min(4, sc + 1), PX * hc2);
      });
    }

  } else {
    // ── PLEUROTE : chapeau en éventail asymétrique vers la gauche ────
    p.fill(tc(nCh, colPi));
    px(p, x, yPied, PX, PX * hp); // pied fin

    const wCh = s <= 2 ? 3 : s <= 4 ? s + 2 : s * 2;
    const cx  = x + dx;
    p.fill(tc(nCh, colCh));
    px(p, cx - PX * wCh, yChap, PX * (wCh + 1), PX * hc); // éventail vers la gauche
    if (hc >= 2) {
      // Bord arrondi supérieur — collé au corps
      px(p, cx - PX * (wCh - 1), yChap - PX, PX * (wCh - 1), PX);
    }
    // Lamelles : pixels dans la dernière rangée du corps
    if (s >= 4) {
      p.fill(tc(nCh, colLa));
      const nb = Math.floor(wCh / 2);
      for (let k = 0; k < nb; k++) {
        px(p, cx - PX * (wCh - k * 2), yChap + PX * (hc - 1), PX, PX);
      }
    }
    // Ombre bord gauche — colonne dans le corps
    if (s >= 4) {
      p.fill(tc(nCh, colOm));
      px(p, cx - PX * wCh, yChap, PX, PX * hc);
    }
    // Reflet — pixel unique dans le corps
    if (s >= 4) {
      p.fill(tc(nCh, '#ffffff'));
      px(p, cx - PX * 2, yChap, PX, PX);
    }
  }
}

/**
 * drawArbuste(p, x, y, variant, colorVariant, scalePX, n, age, maxAge)
 *
 * RÔLE : Arbuste pixel art — élément dominant du jardin, toujours en fond.
 *        scaleMin=5, scaleMax=14 → monte jusqu'à 70px (y=50 depuis y=120).
 *
 * CONVENTION ABSOLUE : y = base du sprite. Tout monte vers le HAUT.
 *   ⚠️ Aucun pixel isolé — chaque rectangle touche au moins un autre par une face.
 *
 * MATURITÉ : m = age / maxAge
 *   m < 0.2  → pousse compacte : petit bloc de feuilles collé à la tige
 *   0.2–0.85 → épanoui : forme complète selon variant
 *   m > 0.85 → vieux : feuillage clairsemé, branches apparentes, ton terne
 *
 * variant 0 = buisson rond | 1 = arbuste à tiges | 2 = conifère | 3 = arbuste fleuri
 */
function drawArbuste(p, x, y, variant, colorVariant, scalePX, n, age, maxAge) {
  const s  = scalePX;
  const ag = age    ?? 0;
  const ma = maxAge ?? 10;
  const m  = ag / ma;

  // Palettes feuillage — 8 tons de vert/foncé
  const FEUILLAGES = [
    '#508040', '#406830', '#60a050', '#385828',
    '#70a848', '#284820', '#88c060', '#4a7038',
  ];
  const colF  = FEUILLAGES[colorVariant % 8];          // feuillage principal
  const colFD = FEUILLAGES[(colorVariant + 3) % 8];    // feuillage sombre (ombre)
  const colFC = FEUILLAGES[(colorVariant + 1) % 8];    // feuillage clair (reflets)
  const colT  = '#4a3020';                              // tronc/tiges brun
  const colTD = '#382818';                              // tronc ombre

  // Vieux : feuillage terne + légèrement penché
  const dx  = m > 0.85 ? PX : 0;
  const nA  = m > 0.85 ? Math.min(1, n + 0.25) : n;

  // Dimensions de base calculées depuis s
  const wTronc = Math.max(1, Math.round(s * 0.15)); // largeur tronc en PX-units (1–2)
  const hTronc = Math.max(1, Math.round(s * 0.25)); // hauteur tronc (visible sous le feuillage)
  const yTronc = y - PX * hTronc;                   // base du feuillage = sommet tronc

  if (m < 0.2) {
    // ── POUSSE : petit bloc compact, forme universelle ─────────────
    // Tronc fin + boule de feuilles collée au sommet
    p.fill(tc(nA, colT));
    px(p, x, y - PX * Math.max(2, Math.round(s * 0.4)), PX, PX * Math.max(2, Math.round(s * 0.4)));
    p.fill(tc(nA, colF));
    // Boule de feuilles : bloc 3×2 collé au sommet du tronc
    px(p, x - PX, y - PX * Math.max(2, Math.round(s * 0.4)) - PX * 2, PX * 3, PX * 2);

  } else if (variant === 0) {
    // ── BUISSON ROND : masse en dôme, feuillage dense ──────────────
    // Structure : tronc + 3 rangées de feuillage en pyramide inversée (large en haut)
    // Toutes les rangées se touchent verticalement → bloc solide.

    // Tronc
    p.fill(tc(nA, colT));
    px(p, x + dx, y - PX * hTronc, PX * wTronc, PX * hTronc);

    // Feuillage : 3 couches empilées, chaque couche plus large que la suivante vers le haut
    // couche basse  : largeur s,   hauteur s/3
    // couche milieu : largeur s+2, hauteur s/3, collée à la basse
    // couche haute  : largeur s+4, hauteur s/3, collée au milieu (dôme)
    const hCouche = Math.max(1, Math.round(s / 3));
    const yBas    = yTronc - PX * hCouche;       // base couche basse = sommet tronc - hCouche
    const yMid    = yBas   - PX * hCouche;
    const yHaut   = yMid   - PX * hCouche;

    p.fill(tc(nA, colFD));
    px(p, x + dx - PX * Math.floor(s / 2),       yBas,  PX * s,       PX * hCouche); // basse
    p.fill(tc(nA, colF));
    px(p, x + dx - PX * Math.floor((s + 2) / 2), yMid,  PX * (s + 2), PX * hCouche); // milieu
    p.fill(tc(nA, colFC));
    px(p, x + dx - PX * Math.floor((s + 4) / 2), yHaut, PX * (s + 4), PX * hCouche); // haute (dôme)

    // Vieux : troues dans le feuillage (branches qui ressortent)
    if (m > 0.85 && s >= 7) {
      p.fill(tc(nA, colT));
      // Branche gauche — dans la couche basse, collée au tronc
      px(p, x + dx - PX * Math.floor(s / 2), yBas + PX, PX * 2, PX);
      // Branche droite
      px(p, x + dx + PX * Math.floor(s / 2) - PX * 2, yBas + PX, PX * 2, PX);
    }

  } else if (variant === 1) {
    // ── ARBUSTE À TIGES : 3 tiges depuis la base, feuillage aux extrémités ──
    // Les tiges partagent leur base (même y de départ) → connectées au sol.
    // Chaque touffe de feuilles est collée au sommet de sa tige.

    const hTige  = Math.round(s * 0.6);                // hauteur des tiges
    const hTouffe = Math.max(2, s - hTige);             // hauteur des touffes
    const wTouffe = Math.max(3, Math.round(s * 0.5));   // largeur des touffes

    // 3 tiges : gauche penchée, centrale droite, droite penchée
    // Décalages X des tiges : -s/3, 0, +s/3
    const offsets = [
      { ox: -Math.round(s * 0.35), ht: hTige - 1 },
      { ox: 0,                     ht: hTige     },
      { ox:  Math.round(s * 0.35), ht: hTige - 2 },
    ];

    offsets.forEach(({ ox, ht }) => {
      // Tige
      p.fill(tc(nA, colT));
      px(p, x + dx + PX * ox, y - PX * ht, PX, PX * ht);
      // Touffe au sommet — collée à la tige (même X centre)
      p.fill(tc(nA, colF));
      px(p, x + dx + PX * ox - PX * Math.floor(wTouffe / 2),
         y - PX * ht - PX * hTouffe,
         PX * wTouffe, PX * hTouffe);
      // Reflet sur la touffe
      p.fill(tc(nA, colFC));
      px(p, x + dx + PX * ox - PX * Math.floor(wTouffe / 2) + PX,
         y - PX * ht - PX * hTouffe,
         PX * Math.max(1, wTouffe - 2), PX);
    });

    // Tronc commun en base — relie toutes les tiges
    p.fill(tc(nA, colTD));
    px(p, x + dx - PX * Math.round(s * 0.35), y - PX * 2,
       PX * (Math.round(s * 0.35) * 2 + 1), PX * 2);

    // Vieux : touffes réduites (feuilles clairsemées)
    if (m > 0.85) {
      offsets.forEach(({ ox, ht }) => {
        // Petite branche nue qui dépasse — collée au sommet de la tige
        p.fill(tc(nA, colT));
        px(p, x + dx + PX * ox, y - PX * (ht + hTouffe + 1), PX, PX);
      });
    }

  } else if (variant === 2) {
    // ── CONIFÈRE : silhouette triangulaire, étages de branches ────
    // Principe : n étages horizontaux de largeur décroissante vers le haut.
    // Chaque étage est collé à celui du dessous → triangle solide.
    // Tronc fin qui dépasse légèrement sous les branches.

    // Tronc
    p.fill(tc(nA, colT));
    px(p, x + dx, y - PX * hTronc, PX, PX * hTronc);

    // Nombre d'étages proportionnel à s, minimum 3
    const nEtages  = Math.max(3, Math.round(s * 0.55));
    const hEtage   = Math.max(1, Math.round((s - hTronc) / nEtages));
    // Largeur max (base) et réduction par étage
    const wMax     = s + 2;

    for (let e = 0; e < nEtages; e++) {
      // e=0 = étage bas (le plus large), e=nEtages-1 = pointe
      const wEtage  = Math.max(1, wMax - e * 2);
      const yEtage  = yTronc - PX * hEtage * (e + 1);
      // Alternance foncé/normal pour donner du volume
      p.fill(tc(nA, e % 2 === 0 ? colF : colFD));
      px(p, x + dx - PX * Math.floor(wEtage / 2), yEtage, PX * wEtage, PX * hEtage);
      // Reflet sur le dessus de chaque étage (1 rangée plus claire)
      if (hEtage >= 2) {
        p.fill(tc(nA, colFC));
        px(p, x + dx - PX * Math.floor(wEtage / 2), yEtage, PX * wEtage, PX);
      }
    }
    // Pointe finale : 1 pixel au sommet, collé au dernier étage
    const yPointe = yTronc - PX * hEtage * nEtages - PX;
    p.fill(tc(nA, colFC));
    px(p, x + dx, yPointe, PX, PX);

    // Vieux : quelques "trous" sombres dans le feuillage (branches mortes)
    if (m > 0.85 && s >= 7) {
      p.fill(tc(nA, colTD));
      px(p, x + dx - PX * Math.floor(wMax * 0.3), yTronc - PX * hEtage * 2, PX, PX);
      px(p, x + dx + PX * Math.floor(wMax * 0.2), yTronc - PX * hEtage * 3, PX, PX);
    }

  } else {
    // ── ARBUSTE FLEURI : masse feuillue + petits points de couleur ──
    // Même structure que le buisson rond (3 couches) mais avec des fleurs
    // parsemées dans le feuillage.

    const FLEURS_COL = [
      '#f0a0b0', '#f0d870', '#c888e8', '#80c8e8',
      '#e84868', '#e8b020', '#f8f8f8', '#f87840',
    ];
    const colFleur = FLEURS_COL[colorVariant % 8];

    // Tronc
    p.fill(tc(nA, colT));
    px(p, x + dx, y - PX * hTronc, PX * wTronc, PX * hTronc);

    // Feuillage : 2 couches (buisson légèrement moins haut que v0)
    const hCouche = Math.max(2, Math.round(s * 0.45));
    const yBas    = yTronc - PX * hCouche;
    const yHaut   = yBas   - PX * hCouche;

    p.fill(tc(nA, colFD));
    px(p, x + dx - PX * Math.floor(s / 2),       yBas,  PX * s,       PX * hCouche);
    p.fill(tc(nA, colF));
    px(p, x + dx - PX * Math.floor((s + 2) / 2), yHaut, PX * (s + 2), PX * hCouche);

    // Fleurs : 4–6 points parsemés dans le feuillage, tous dans les couches
    p.fill(tc(nA, colFleur));
    // Fleurs basse — dans la couche basse, positions fixes relatives à x
    px(p, x + dx - PX * Math.floor(s / 2) + PX,            yBas + PX,  PX, PX);
    px(p, x + dx,                                           yBas,       PX, PX);
    px(p, x + dx + PX * Math.floor(s / 2) - PX * 2,        yBas + PX,  PX, PX);
    // Fleurs haute — dans la couche haute
    px(p, x + dx - PX * Math.floor((s + 2) / 2) + PX,      yHaut + PX, PX, PX);
    px(p, x + dx + PX,                                      yHaut,      PX, PX);
    if (s >= 8) {
      px(p, x + dx + PX * Math.floor((s + 2) / 2) - PX * 2, yHaut + PX, PX, PX);
    }

    // Vieux : fleurs disparaissent, feuillage terne (déjà géré par nA)
    // Les fleurs sont dessinées avec nA → elles aussi s'assombrissent
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
        drawFleur(p, el.x, el.y, el.variant, el.colorVariant ?? el.variant, el.scalePX ?? 3, theme, n, el.age ?? 0, el.maxAge ?? 7);
        break;
      case 'herbe':
        drawHerbe(p, el.x, el.y, el.variant, el.colorVariant ?? el.variant, el.scalePX ?? 2, n, el.age ?? 0, el.maxAge ?? 14);
        break;
      case 'pierre':
        drawPierre(p, el.x, el.y, el.variant, el.colorVariant ?? el.variant, el.scalePX ?? 2, n, el.age ?? 0, el.maxAge ?? 999);
        break;
      case 'champignon':
        drawChampignon(p, el.x, el.y, el.variant, el.colorVariant ?? el.variant, el.scalePX ?? 4, n, el.age ?? 0, el.maxAge ?? 5);
        break;
      case 'arbuste':
        drawArbuste(p, el.x, el.y, el.variant, el.colorVariant ?? el.variant, el.scalePX ?? 8, n, el.age ?? 0, el.maxAge ?? 20);
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
        drawFleur(p, el.x, el.y, el.variant, el.colorVariant ?? el.variant, el.scalePX ?? 3, theme, n, el.age ?? 0, el.maxAge ?? 7);
        break;
      case 'herbe':
        drawHerbe(p, el.x, el.y, el.variant, el.colorVariant ?? el.variant, el.scalePX ?? 2, n, el.age ?? 0, el.maxAge ?? 14);
        break;
      case 'pierre':
        drawPierre(p, el.x, el.y, el.variant, el.colorVariant ?? el.variant, el.scalePX ?? 2, n, el.age ?? 0, el.maxAge ?? 999);
        break;
      case 'champignon':
        drawChampignon(p, el.x, el.y, el.variant, el.colorVariant ?? el.variant, el.scalePX ?? 4, n, el.age ?? 0, el.maxAge ?? 5);
        break;
      case 'arbuste':
        drawArbuste(p, el.x, el.y, el.variant, el.colorVariant ?? el.variant, el.scalePX ?? 8, n, el.age ?? 0, el.maxAge ?? 20);
        break;
    }
  });
}
window.drawJardinPremierPlan = drawJardinPremierPlan;
