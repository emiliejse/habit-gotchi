/* ============================================================
   render.js — Moteur p5.js : dessin pixel art, animations, Gotchi

   RÔLE : Ce fichier est le "pinceau". Il ne contient PAS de logique
   métier (XP, stats) — il se contente de LIRE window.D et de dessiner.

   DÉPENDANCES (doivent être chargées AVANT dans index.html) :
     - config.js  → GOTCHI_COLORS, ENV_THEMES, EN_xx/HA_xx (seuils visuels)
     - app.js     → window.D (données), window.PROPS_LIB, hr(),
                    window.meteoData, window.shakeTimer, window.celebQueue
     - envs.js    → drawActiveEnv() (chargé APRÈS render.js)

   NAVIGATION RAPIDE (Ctrl+G dans VS Code → numéro de ligne) :
   §1  ~14    GLOBALS & ÉTATS    C, PX, walkX, _expr, _adultPose, triggerExpr
   §2  ~68    HELPERS VISUELS    getBreath(), getCheekPulse(), getGotchiC()
   §3  ~96    PROPS & SLOTS      PROP_SLOTS, getPropDef(), drawProp()
   §4  ~128   PARTICULES         spawnP(), updateParts()
   §5  ~139   ÉCOSYSTÈME         drawSky(), drawCl(), drawZzz(), drawDither()
   §6  ~263   SPRITES GOTCHI     drawEgg(), drawBaby(), drawTeen(), drawAdult()
   §7  ~717   INTERACTIONS       triggerTouchReaction()
   §8  ~740   BOUCLE p5.js       p5s() — setup, draw, events tactiles
   §9  ~1094  OVERLAY & TOUCHES  isOverlayActive(), gestion touch/click canvas
   ============================================================ */

/* ─── SYSTÈME 7 : INGÉNIERIE (CONFIGURATIONS & GLOBALES) ────────── */

const C = {
  body:'#d8b8e8', bodyDk:'#c0a0d0', bodyLt:'#ecd8f8',
  eye:'#38304a', cheek:'#f0a0b0', mouth:'#38304a',
  egg:'#f4e6d0', eggSp:'#e4d2b8', eggCr:'#d4bfa0',
  skyD1:'#b8d4f0', skyD2:'#d8e8f0', skyK1:'#d0a8c0', skyK2:'#f0d0c0',
  skyN1:'#28203c', skyN2:'#3c3058', skyA1:'#d8c0d0', skyA2:'#f0e4d0',
  skyGray1:'#a0a0a8', skyGray2:'#c0c0c8',
  gnd:'#a8d498', gndDk:'#90c480', gndN:'#3c6030',
  cloud:'#ece8f4', trunk:'#b09068', leaf:'#78c488', leafN:'#406848',
  wallIn:'#e0d8c8', floorIn:'#c8b8a8', rug:'#b898d4',
  mnt1:'#a0a8b8', mnt2:'#808898', snow:'#e8e8f0',
  water:'#88c0d8', star:'#f0e498', flPk:'#e898b8', flYl:'#f0d878',
  rainbow:['#e8a0a0','#e8c8a0','#e8e0a0','#a0d8a0','#a0b8e0','#c0a0d8'],
};

const PX = 5, CS = 200;
const GOTCHI_OFFSET_Y = 20;
// RÔLE : Dimensions de la zone de tap du Gotchi (hitbox tactile).
// POURQUOI : Ces valeurs étaient écrites en dur dans touchStarted sous forme de nombres magiques
//            (±26, ±35, +30). Les regrouper ici les rend lisibles et modifiables en un seul endroit.
//   rX           → demi-largeur horizontale de la hitbox (couvre le corps)
//   rY           → demi-hauteur verticale (tête + corps, pas les pattes)
//   centerOffsetY → décalage Y du centre de la hitbox par rapport à la base du sprite
const GOTCHI_HITBOX = { rX: 26, rY: 35, centerOffsetY: 30 };
let bounceT = 0, blinkT = 0, blink = false;
// window._bounceT = 0  ← SUPPRIMÉ (code mort identifié v3.02 et v4.5) :
//   La variable globale _bounceT n'était jamais lue — c'est bounceT (local) qui est utilisé partout.
window.particles = [];
window.touchReactions = [];
window.eatAnim = { active: false, timer: 0, emoji: '' };

// RÔLE : Valeurs d'affichage lissées pour energy et happiness (easing transitions états).
// POURQUOI : Sans lerp, tout changement de jauge (slider, setEnergy/setHappy) bascule
//            frame-à-frame → abrupt visuellement. On suit la valeur réelle à vitesse constante
//            (pas 0.12 ≈ 1 unité en ~8 frames à 12fps = ~0.7s) pour une transition douce.
//            _dispEnergy/_dispHappy sont initialisés au premier p.draw() depuis D.g.
let _dispEnergy  = null; // valeur affichée de energy (float, suit D.g.energy en lerp)
let _dispHappy   = null; // valeur affichée de happiness (float, suit D.g.happiness en lerp)
let walkX = 100;
let walkDir = 1;
// let walkStep = 0  ← SUPPRIMÉ (code mort identifié v4.5) :
//   walkStep était incrémenté dans la boucle de marche mais jamais lu nulle part.
let walkTarget = 100;   // destination en X
let walkPause  = 0;     // frames d'attente avant le prochain déplacement  
// RÔLE : Déclencher le saut de joie du Gotchi depuis n'importe quel module.
// POURQUOI : Remplace l'ancienne approche window._jumpTimer = 20 (Temps 2).
//            L'interface publique (triggerGotchiBounce) est inchangée — app.js,
//            ui-shop.js et ui.js n'ont pas besoin d'être modifiés.
window.triggerGotchiBounce = function() { animator.trigger('saut_joie'); };
// Note : window._jumpTimer conservé à 0 pour éviter toute erreur si du code
//        externe lirait encore cette variable (rétrocompatibilité défensive).
window._jumpTimer = 0;
// RÔLE : Déclencher le tremblement du Gotchi après un tap (migré vers animator).
// POURQUOI : Remplace window.shakeTimer = 12 — plus de variable globale ad hoc.
//            window.shakeTimer conservé à 0 pour rétrocompatibilité défensive
//            si du code externe le lirait encore.
window.triggerGotchiShake  = function() { animator.trigger('shake'); };
window.shakeTimer = 0; // rétrocompatibilité — ne plus écrire dessus
window.spawnP = spawnP;
window._nextBlinkAt = 60;
window._blinkDuration = 4;
// Animation d'évolution (chrysalide)
window._evoAnim = { active: false, timer: 0, fromStage: '', toStage: '' };
window.triggerEvoAnim = function(from, to) {
  window._evoAnim = { active: true, timer: 45, fromStage: from, toStage: to };
};

// ─── Sélecteur d'environnement canvas ───
// RÔLE : Permet de changer d'environnement directement depuis l'écran Gotchi,
//        sans passer par l'inventaire. Dessiné dans p.draw(), géré dans touchStarted.
// POURQUOI : Accès rapide et intuitif, cohérent avec le style pixel art du canvas.
window._envSelectorOpen  = false;  // true = les 2 cercles flottants sont visibles
window._envFadeState     = null;   // { from:'parc', to:'chambre', frames:0 } pendant le fondu
// RÔLE : Empêche le flash de transition "nuit → chambre" de se rejouer à chaque frame.
// POURQUOI : Le flash est déclenché une seule fois à 22h30 — ce verrou est remis à false le matin.
window._nightFlashDone   = false;
window._envSelectorHits  = [];     // zones de tap calculées uniquement quand l'état change
// RÔLE : Valeurs mémorisées pour éviter de reconstruire _envSelectorHits à chaque frame.
// POURQUOI : Quand le sélecteur est fermé ET que l'env n'a pas changé, le tableau est déjà
//            valide — on peut le réutiliser directement (économie GC ~12 allocs/s).
window._envSelectorCache = { env: null, open: null }; // dernière combinaison calculée

// RÔLE : Couleur du flash thématique par environnement de destination.
// POURQUOI : Chaque biome a une teinte évocatrice — le flash donne une sensation
//            de "passage" vers un nouveau lieu, plutôt qu'un cut brutal.
//            Clé = id de l'env (tel que stocké dans D.g.activeEnv).
const ENV_FLASH_COLOR = {
  parc:     '#c8f0a8', // vert herbe printanier
  chambre:  '#f0d8a8', // orangé chaud, lumière intérieure
  montagne: '#e8f0f8', // blanc neige, air pur
  plage:    '#a8e8f0', // bleu aqua, écume
  jardin:   '#c8a870', // brun terre, sol de jardin
};

// Variations de bras de l'adulte (animations idle + célébration ha=5)
window._adultPose = {
  current: 'normal',     // 'normal' | 'hanche_g' (étape A) | (à enrichir étape B)
  timer: 0,              // frames restantes dans la pose actuelle
  cooldown: 240          // frames avant la prochaine variation (240 frames = 20 sec à 12 fps)
};

// RÔLE : Scheduler de poses pour le teen — même mécanique que _adultPose.
// POURQUOI : Le teen n'avait pas de poses idle. On lui en ajoute uniquement
//            pour le niveau bonheur 5 (poses célébration bras en l'air).
window._teenPose = {
  cooldown: 240 // frames avant la première pose célébration
};

// RÔLE : Scheduler de micro-expressions spontanées de la bouche (teen + adult).
// POURQUOI : Sans ça, la bouche ne change que sur interaction utilisateur.
//            Ce scheduler déclenche des expressions courtes à intervalle irrégulier
//            pour donner l'impression que le Gotchi vit vraiment.
//            Cooldown de départ décalé (~300f) par rapport aux poses de bras (~240f)
//            pour éviter que bras et bouche changent en même temps.
window._mouthSched = {
  cooldown: 60 // frames avant le premier déclenchement (~5 sec à 12fps)
};
// ─── Animation : variables d'expressivité ───
window._expr = {
  lastMood: null,      // 'faim', 'surprise', 'joie', 'baillement', null
  moodTimer: 0,        // frames restantes de la réaction
  breathPhase: 0
};

// RÔLE : Timer d'inactivité pour déclencher le bâillement automatique.
// POURQUOI : Compte les frames depuis la dernière interaction (tap, validation habitude, achat).
//            Quand il dépasse le seuil, triggerExpr('baillement') est appelé.
//            Remis à 0 par toute interaction (voir triggerExpr et les handlers tap).
window._idleFrames = 0;
const YAWN_THRESHOLD_NORMAL = 12 * 60 * 3; // ~3 min à 12fps = 2160 frames (énergie normale)
const YAWN_THRESHOLD_LOW    = 12 * 60 * 1; // ~1 min à 12fps = 720 frames (énergie ≤ 30)
const YAWN_COOLDOWN         = 12 * 60 * 5; // ~5 min entre deux bâillements

// Helper : calcule la phase de respiration (0 → 1 → 0 → 1…)
function getBreath(p, speed = 0.025) {
  return (Math.sin(p.frameCount * speed) + 1) / 2; // 0 à 1
}

// Helper : pulsation joues (décalée pour pas synchro avec respiration)
function getCheekPulse(p) {
  return (Math.sin(p.frameCount * 0.04 + Math.PI/3) + 1) / 2;
}

// Déclenche une micro-réaction (à appeler depuis app.js ou render)
window.triggerExpr = function(mood, duration = 60) {
  window._expr.lastMood = mood;
  window._expr.moodTimer = duration;
  // RÔLE : Toute expression autre que le bâillement lui-même remet le timer idle à 0.
  // POURQUOI : Une interaction vient de se produire → pas besoin de bâiller de suite.
  if (mood !== 'baillement') window._idleFrames = 0;
};

/* ─── SYSTÈME D'ANIMATION DÉCLARATIF ────────────────────────────────── */
// RÔLE : Catalogue des animations déclenchables — format déclaratif, extensible vers JSON.
// POURQUOI : Remplace les variables ad hoc (_jumpTimer, shakeTimer, _adultPose…) par un
//            langage commun. Chaque entrée décrit UNE animation, ses effets visuels (poses
//            de calques, offset dx/dy) et ses conditions de déclenchement.
//            Le catalogue reste en JS pour l'instant ; à terme il pourra être chargé depuis
//            data/anims.json sans changer le moteur.
//
// Structure d'une définition :
//   stages   : ['baby','teen','adult'] | ['*']  — stades concernés ('*' = tous)
//   duration : number                           — durée en frames
//   poses    : { [layerId]: { hidden?: bool, visible?: bool } }  — overrides de calques DSL
//   bodyOffset : {
//     yFn?: (elapsed) => number,   — décalage Y en pixels canvas (snappé à PX dans resolve)
//     xFn?: (elapsed) => number    — décalage X en pixels canvas (snappé à PX dans resolve)
//   }
//
// Note : les layerIds dans `poses` doivent correspondre exactement aux `id` définis
//        dans les tableaux LAYERS_* de render-sprites.js.
const ANIM_DEFS = {
  // Saut de joie — déclenché par toggleHab, allHabsDone, achat boutique.
  // Remplace window._jumpTimer (Temps 2).
  // POURQUOI yFn : sin(0→π) produit une cloche 0→1→0 sur la durée.
  //   × 22 = amplitude max en px canvas, identique à l'ancienne valeur _jumpTimer.
  //   Le résultat est négatif (montée = Y décroissant sur canvas).
  //   Pas de snap ici : bobY est déjà en px canvas, le snap est dans resolve().
  saut_joie: {
    stages: '*',
    duration: 12, // réduit de 20→12 : saut plus vif, moins planant — ressemble à un vrai bond
    bodyOffset: {
      // RÔLE : Cloche sin 0→π sur 12f, amplitude 28px — montée rapide, retombée nette.
      // POURQUOI : Durée courte + amplitude haute = impression de vivacité pixel art.
      yFn: (elapsed) => -(Math.sin(elapsed / 12 * Math.PI) * 28)
    }
  },

  // ── Poses idle adulte — déclenchées par le scheduler _adultPose ──
  // POURQUOI : Chaque pose masque 'bras-normal' (calque par défaut)
  //            et rend visible son propre calque. Les durées sont
  //            passées en override depuis le scheduler qui tire au sort.
  pose_hanche_g: {
    stages: ['adult'],
    duration: 60, // valeur par défaut — le scheduler passe la vraie durée en override
    poses: {
      'bras-normal':   { hidden: true },
      'bras-hanche-g': { visible: true }
    }
  },
  pose_hanche_d: {
    stages: ['adult'],
    duration: 60,
    poses: {
      'bras-normal':   { hidden: true },
      'bras-hanche-d': { visible: true }
    }
  },
  pose_croises: {
    stages: ['adult'],
    duration: 72,
    poses: {
      'bras-normal':  { hidden: true },
      'bras-croises': { visible: true }
    }
  },
  pose_salut: {
    stages: ['adult'],
    duration: 12,
    poses: {
      'bras-normal': { hidden: true },
      'bras-salut':  { visible: true }
    }
  },

  // ── Poses célébration adulte (ha=5) — bras en l'air, déclenchées par le scheduler ──
  // POURQUOI : Identiques aux poses idle en structure (masquent bras-normal, rendent visible
  //            leur calque). Durée courte (~1.5–3s) pour un effet joyeux et dynamique.
  //            Le scheduler les pioche avec 50% de chances quand ha > HA_ARMS_UP.
  pose_bras_g_leve: {
    stages: ['adult'],
    duration: 18,
    poses: {
      'bras-normal': { hidden: true },
      'bras-g-leve': { visible: true }
    }
  },
  pose_bras_d_leve: {
    stages: ['adult'],
    duration: 18,
    poses: {
      'bras-normal': { hidden: true },
      'bras-d-leve': { visible: true }
    }
  },
  pose_bras_2_leves: {
    stages: ['adult'],
    duration: 24,
    poses: {
      'bras-normal':  { hidden: true },
      'bras-2-leves': { visible: true }
    }
  },

  // ── Poses célébration ado (ha=5) — bras en l'air, déclenchées par le scheduler ──
  // POURQUOI : Le teen n'avait pas de scheduler — ces poses sont pilotées par
  //            _teenPose (même mécanique que _adultPose), initialisé dans render.js.
  teen_pose_bras_g_leve: {
    stages: ['teen'],
    duration: 18,
    poses: {
      'bras-normaux':     { hidden: true },
      'teen-bras-g-leve': { visible: true }
    }
  },
  teen_pose_bras_d_leve: {
    stages: ['teen'],
    duration: 18,
    poses: {
      'bras-normaux':     { hidden: true },
      'teen-bras-d-leve': { visible: true }
    }
  },
  teen_pose_bras_2_leves: {
    stages: ['teen'],
    duration: 24,
    poses: {
      'bras-normaux':      { hidden: true },
      'teen-bras-2-leves': { visible: true }
    }
  },

  // ── Étirement matinal — séquence 3 temps (déclenché à h===7 une fois par jour) ──
  // RÔLE : Simule un réveil/étirement du Gotchi : bras levés → croisés → repos.
  // POURQUOI : t1 dure 30f (~2.5s) pour que les bras restent bien visibles en l'air.
  //            yFn en t1 monte le corps de 0 → -PX*2 progressivement (illusion d'allongement).
  //            t2 et t3 restent à 12f. Zéro nouveau calque.
  //            Ne s'applique qu'à l'adulte — teen et baby n'ont pas les calques bras DSL.
  etirement_t1: {
    stages: ['adult'],
    duration: 30, // augmenté de 12→30 : bras restent en l'air ~2.5s au lieu de 1s
    poses: {
      'bras-normal':  { hidden: true },
      'bras-2-leves': { visible: true } // renommé depuis bras-leves → pose temporaire partagée avec célébration
    },
    bodyOffset: {
      // RÔLE : Monte le corps progressivement de 0 à -PX*2 sur les 30f.
      // POURQUOI : Simule l'allongement du corps pendant l'étirement — lerp discret snappé PX.
      //            elapsed/30 normalise sur 0→1, ×2 donne 0→2 PX, floor snappe à 0 ou PX.
      yFn: (elapsed) => -(Math.floor(elapsed / 30 * 2) * PX)
    }
  },
  etirement_t2: {
    stages: ['adult'],
    duration: 12,
    poses: {
      'bras-normal':  { hidden: true },
      'bras-croises': { visible: true } // bras croisés = étirement retour
    }
  },
  etirement_t3: {
    stages: ['adult'],
    duration: 12,
    // t3 : retour au repos — bras-normal reprend naturellement (aucun calque masqué)
  },

  // ── Shake — tremblements après tap ──────────────────────────────
  // RÔLE : Remplace window.shakeTimer (variable ad hoc) par l'animator.
  // POURQUOI : shakeTimer produisait un offset sinusoïdal appliqué manuellement dans p.draw().
  //            Migrer ici centralise la logique et supprime la variable globale.
  //            xFn : sinus rapide (×3) pour vibration horizontale.
  //            yFn : sinus plus lent (×2) pour vibration verticale légère.
  //            elapsed/12 normalise sur 0→1 — amplitude 5px X et 3px Y, snappés PX.
  shake: {
    stages: '*',
    duration: 12,
    bodyOffset: {
      xFn: (elapsed) => Math.sin(elapsed * 3) * 5,
      yFn: (elapsed) => Math.sin(elapsed * 2) * 3,
    }
  },

  // ── Snack — saut discret au moment où l'emoji arrive au Gotchi ──
  // RÔLE : Remplace le bobY direct dans le bloc eatAnim.jumped (variable ad hoc).
  // POURQUOI : L'emoji en vol est conservé dans eatAnim (hors animator — dessin emoji).
  //            Seul le corps-bond est migré ici : même courbe sin que saut_joie mais
  //            amplitude réduite (18px vs 22px) et durée courte (8f vs 20f).
  snack_bond: {
    stages: '*',
    duration: 8,
    bodyOffset: {
      yFn: (elapsed) => -(Math.sin(elapsed / 8 * Math.PI) * 18)
    }
  },

  // ── Frisson — tremblement froid déclenché par température < 5°C ou fin de bain ──
  // RÔLE : Le Gotchi frissonne : micro-oscillation ±2px canvas (sous la grille PX).
  // POURQUOI : L'ancienne amplitude ±PX (5px) donnait l'impression d'un déplacement latéral.
  //            noSnapX: true bypass le Math.floor(val/PX)*PX dans resolve() pour ce seul axe —
  //            le tremblement reste sub-pixel (2px), lisible comme une vibration fine.
  //            Alternance toutes les frames (pas toutes les 2f) pour un tremblotement rapide.
  frisson: {
    stages: '*',
    duration: 22, // allongé légèrement pour compenser la discrétion de l'amplitude fine
    noSnapX: true, // RÔLE : désactive le snap PX sur dx — permet l'amplitude sub-PX (2px)
    bodyOffset: {
      // RÔLE : Alterne +2 et -2 px canvas à chaque frame — tremblotement fin, pas un déplacement.
      // POURQUOI : 2px sub-PX sans snap = micro-vibration visible mais non intrusive.
      xFn: (elapsed) => (elapsed % 2 === 0 ? 2 : -2),
    }
  },

  // hochement supprimé — l'effet descendant n'était pas lisible comme un hochement de tête.
  // Le dispatch habReactions 'nod' dans app.js utilise désormais saut_joie à la place.
};

// RÔLE : Moteur léger qui gère la pile des animations actives.
// POURQUOI : Séparer la logique d'animation (trigger / tick / resolve) du rendu (p.draw)
//            permet de déclencher des animations depuis n'importe quel module (app.js,
//            ui-habs.js…) sans toucher à render.js.
const animator = {
  // Pile des animations en cours : [{ id, t, def }, …]
  // t = frames restantes ; décrémenté à chaque tick().
  active: [],

  // RÔLE : Déclencher une animation par son id (clé dans ANIM_DEFS).
  // POURQUOI : Cherche d'abord dans ANIM_DEFS, puis merge les options optionnelles.
  //            options peut contenir { duration } pour surcharger la durée catalogue —
  //            utile quand le scheduler tire une durée aléatoire (ex. poses idle adulte).
  //            options peut aussi être une def complète pour les cas one-shot non catalogués.
  trigger(id, options) {
    const base = ANIM_DEFS[id];
    if (!base && !options) return; // id inconnu sans fallback → silencieux
    // RÔLE : Merger la def catalogue avec les options passées.
    // POURQUOI : Object.assign crée une copie — on ne mute pas la def catalogue,
    //            ce qui permet de déclencher la même animation plusieurs fois avec
    //            des durées différentes sans effet de bord.
    const def = options ? Object.assign({}, base || options, options) : base;
    this.active.push({ id, t: def.duration, def });
  },

  // RÔLE : Décrémenter tous les timers et retirer les animations terminées.
  // POURQUOI : Appelé une fois par frame dans p.draw(), avant resolve().
  tick() {
    this.active = this.active.filter(a => --a.t > 0);
  },

  // RÔLE : Calculer le diff visuel à appliquer ce frame, pour un stade donné.
  // POURQUOI : Retourne un objet plat { hidden, visible, dx, dy } que renderSprite()
  //            peut lire sans connaître le système d'animation.
  //            Toutes les animations actives sont cumulées : un saut + une pose idle
  //            peuvent coexister.
  // @param {string} stage - 'egg' | 'baby' | 'teen' | 'adult'
  // @returns {{ hidden: Set<string>, visible: Set<string>, dx: number, dy: number }}
  resolve(stage) {
    const out = { hidden: new Set(), visible: new Set(), dx: 0, dy: 0 };

    for (const a of this.active) {
      const { stages, duration, poses, bodyOffset } = a.def;

      // RÔLE : Filtrer les animations non applicables au stade courant.
      // POURQUOI : stages peut être la string '*' (wildcard) ou un tableau de stades.
      //            ['*'].includes(stage) retournerait false — on teste donc stages === '*'
      //            en premier pour couvrir le cas wildcard correctement.
      const isWildcard = stages === '*' || (Array.isArray(stages) && stages[0] === '*');
      if (!isWildcard && !stages.includes(stage)) continue;

      // RÔLE : Calculer le nombre de frames écoulées depuis le début de l'animation.
      // POURQUOI : elapsed va de 0 (début) à duration-1 (fin) — utilisé par yFn/xFn
      //            pour les courbes (sin, lerp…).
      const elapsed = duration - a.t;

      // RÔLE : Appliquer les overrides de calques (visibilité).
      if (poses) {
        for (const [layerId, ov] of Object.entries(poses)) {
          if (ov.hidden)  out.hidden.add(layerId);
          if (ov.visible) out.visible.add(layerId);
        }
      }

      // RÔLE : Cumuler les offsets de position, snappés à la grille PX.
      // POURQUOI : Le snap est obligatoire pour le pixel art — un offset flottant produit
      //            des positions sub-pixel qui floutent le sprite.
      //            Exception : noSnapX/noSnapY permettent à une animation (ex. frisson)
      //            de travailler en amplitude sub-PX sans être ramenée à 0 par le floor.
      if (bodyOffset?.yFn) {
        const rawY = bodyOffset.yFn(elapsed);
        out.dy += a.def.noSnapY ? rawY : Math.floor(rawY / PX) * PX;
      }
      if (bodyOffset?.xFn) {
        const rawX = bodyOffset.xFn(elapsed);
        out.dx += a.def.noSnapX ? rawX : Math.floor(rawX / PX) * PX;
      }
    }

    return out;
  }
};

// RÔLE : Exposer animator sur window pour que app.js et les modules ui-* puissent
//        déclencher des animations sans importer render.js.
// POURQUOI : Convention du projet — toute globale partagée passe par window.*.
window.animator = animator;

// RÔLE : Déclenche la séquence d'étirement matinal si les conditions sont remplies.
// POURQUOI : Déplacé hors de p.draw() pour être appelé à l'ouverture de l'app (bootstrap)
//            plutôt que d'attendre que h===7 passe dans la boucle de rendu.
//            Peut aussi être appelé quand une bulle "*s'étire*" est affichée.
// CONDITIONS : stade adult, heure entre 7h et 11h, non endormi, verrou journalier.
// @param {boolean} force — si true, ignore le verrou (pour les bulles *s'étire*)
window.triggerEtirementMatin = function(force = false) {
  const g = window.D?.g;
  if (!g || g.stage !== 'adult') return; // calques bras inexistants sur baby/teen
  const h = typeof hr === 'function' ? hr() : new Date().getHours();
  // RÔLE : même seuil que dans p.draw() — le gotchi dort à partir de 23h30.
  const minsEtir = new Date().getMinutes();
  const sleeping = (h === 23 && minsEtir >= 30) || (h >= 0 && h < 7);
  if (sleeping) return;
  const todayStr = new Date().toDateString();
  if (!force && window._etirementLastDay === todayStr) return; // déjà fait aujourd'hui
  window._etirementLastDay = todayStr;
  // Légère temporisation pour laisser l'UI finir de se monter avant l'animation
  setTimeout(() => {
    window.animator.trigger('etirement_t1');
    setTimeout(() => window.animator.trigger('etirement_t2'), (30 / 12) * 1000); // ~2.5s
    setTimeout(() => window.animator.trigger('etirement_t3'), (42 / 12) * 1000); // ~3.5s
  }, 800);
};

// RÔLE : Initialiser _animOverrides à vide au démarrage.
// POURQUOI : renderSprite() y accède dès le premier frame — on garantit que l'objet
//            existe même avant le premier tick().
window._animOverrides = { hidden: new Set(), visible: new Set(), dx: 0, dy: 0 };

// ── Commandes de debug console ─────────────────────────────────────────────────
// RÔLE : Objet global pour tester les animations depuis la console du navigateur
//        sans attendre les conditions de jeu (heure, météo, inactivité...).
// POURQUOI : Les 4 animations récentes ont des déclencheurs très contraints
//            (h===7, 3 min d'idle, temp<5°C, habitudes spécifiques) — impossible
//            à vérifier visuellement sans ces helpers.
// USAGE (console DevTools) :
//   __hg.etirement()    → séquence bras levés → croisés → repos (adult uniquement)
//   __hg.baillement()   → bouche O + yeux mi-clos, 18f
//   __hg.frisson()      → tremblement horizontal ±1PX, 18f
//   __hg.hochement()    → descente tête 2 cycles, 16f (teen/adult)
//   __hg.saut()         → saut joie (référence)
//   __hg.etat()         → snapshot état courant
window.__hg = {

  // RÔLE : Force l'étirement matinal — contourne h===7 et _etirementLastDay.
  // POURQUOI : L'étirement n'est déclenchable qu'une fois par jour à 7h pile —
  //            ce helper permet de le voir à tout moment en réinitialisant le verrou.
  etirement() {
    const g = window.D?.g;
    if (g?.stage !== 'adult') {
      console.warn('[__hg.etirement] Stade adulte requis — stade actuel :', g?.stage);
      return;
    }
    window._etirementLastDay = null; // reset du verrou pour pouvoir rejouer
    window.animator.trigger('etirement_t1');
    setTimeout(() => window.animator.trigger('etirement_t2'), (30 / 12) * 1000); // ~2.5s
    setTimeout(() => window.animator.trigger('etirement_t3'), (42 / 12) * 1000); // ~3.5s
    console.log('[__hg.etirement] ✅ Séquence lancée : bras-levés (2.5s) → croisés → repos');
  },

  // RÔLE : Force le bâillement — contourne les 3 min d'inactivité.
  // POURQUOI : _idleFrames doit atteindre 2160 frames en conditions normales.
  baillement() {
    const g = window.D?.g;
    if (!g || g.stage === 'egg') {
      console.warn('[__hg.baillement] Pas de bâillement pour l\'œuf');
      return;
    }
    window._idleFrames = 0;
    window.triggerExpr('baillement', 18);
    console.log('[__hg.baillement] ✅ Bâillement déclenché — bouche O + yeux mi-clos, 18f');
  },

  // RÔLE : Force le frisson — contourne la condition météo (temp < 5°C).
  // POURQUOI : Le frisson dépend de window.meteoData qui reflète la météo réelle.
  frisson() {
    window._frissonCooldown = 0; // reset cooldown
    window.animator.trigger('frisson');
    console.log('[__hg.frisson] ✅ Frisson déclenché — oscillation ±1PX, 18f');
  },

  // hochement() supprimé — la def ANIM_DEFS['hochement'] a été retirée (effet illisible).
  // Les habitudes intel/serene déclenchent désormais saut_joie via triggerGotchiBounce().

  // RÔLE : Déclenche un saut joie — animation de référence pour comparer.
  saut() {
    window.triggerGotchiBounce();
    console.log('[__hg.saut] ✅ Saut joie déclenché — 20f');
  },

  // RÔLE : Snapshot de l'état courant — pour diagnostiquer pourquoi une animation
  //        ne se déclenche pas automatiquement en conditions normales.
  etat() {
    const g = window.D?.g;
    const expr = window._expr;
    const h = new Date().getHours();
    const temp = window.meteoData?.temperature;
    const wcode = window.meteoData?.weathercode;
    console.group('[__hg.etat] ─── État animations HabitGotchi ───');
    console.log('Stade :', g?.stage ?? '⚠️ D non chargé');
    const minsDebug = new Date().getMinutes();
    console.log('Heure :', h, 'min :', minsDebug, '— sleeping :', (h === 23 && minsDebug >= 30) || (h >= 0 && h < 7));
    console.log('Météo : temp =', temp, '°C | weathercode =', wcode);
    console.log('animator.active :', window.animator.active.map(a => `${a.id}(${a.t}f)`).join(', ') || '(vide)');
    console.log('_expr :', expr ? `${expr.lastMood} (${expr.moodTimer}f restantes)` : '(vide)');
    console.log('_idleFrames :', window._idleFrames, '/ seuil bâillement :', 12 * 60 * 3);
    console.log('_frissonCooldown :', window._frissonCooldown ?? 0);
    console.log('_etirementLastDay :', window._etirementLastDay ?? '(jamais)');
    console.log('Frisson auto — isCold :', typeof temp === 'number' && temp < 5, '| isRainingCold :', typeof wcode === 'number' && wcode >= 61 && typeof temp === 'number' && temp < 10);
    console.log('Étirement auto — h===7 :', h === 7, '| verrou today :', window._etirementLastDay === new Date().toDateString());
    console.groupEnd();
  },
};

/**
 * RÔLE : Retourne la position Y de base du Gotchi en fonction de son stade de développement.
 * POURQUOI : Ce ternaire était copié-collé 3 fois (draw, touchStarted, touchMoved) —
 *            une seule fonction évite les désynchronisations si les valeurs changent.
 */
function getStageBaseY(stage) {
  if (stage === 'egg')  return 115;
  if (stage === 'baby') return 108;
  if (stage === 'teen') return 98;
  return 85; // adult (valeur par défaut)
}

function getGotchiC() {
  const id = window.D.g.gotchiColor || 'vert';
  const gc = window.HG_CONFIG.GOTCHI_COLORS.find(x => x.id === id) || window.HG_CONFIG.GOTCHI_COLORS[0];
  // RÔLE : Résoudre aussi la couleur des yeux (iris) — personnalisable via D.g.eyeColor.
  // POURQUOI : C.eye doit être mis à jour à chaque frame comme C.body/bodyLt/bodyDk —
  //            sans ça, la couleur d'œil reste figée à la valeur initiale de C (#38304a).
  const eyeId = window.D.g.eyeColor || 'noir';
  const ec = window.HG_CONFIG.EYE_COLORS.find(x => x.id === eyeId) || window.HG_CONFIG.EYE_COLORS[0];
  // RÔLE : Résoudre aussi la couleur de la bouche — personnalisable via D.g.mouthColor.
  const mouthId = window.D.g.mouthColor || 'noir';
  const mc = window.HG_CONFIG.MOUTH_COLORS.find(x => x.id === mouthId) || window.HG_CONFIG.MOUTH_COLORS[0];
  // RÔLE : Résoudre aussi la couleur des joues — personnalisable via D.g.cheekColor.
  // POURQUOI : C.cheek doit être mis à jour à chaque frame comme les autres couleurs —
  //            sans ça, la couleur de joue reste figée à la valeur initiale (#f0a0b0).
  const cheekId = window.D.g.cheekColor || 'rose';
  const chk = window.HG_CONFIG.CHEEK_COLORS.find(x => x.id === cheekId) || window.HG_CONFIG.CHEEK_COLORS[0];
  // RÔLE : Résoudre aussi la couleur des extrémités (bras + pieds) — personnalisable via D.g.limbColor.
  // POURQUOI : C.limb est une couleur plate indépendante du corps — si 'auto' ou absent,
  //            fallback sur C.bodyDk (comportement original). Mis à jour à chaque frame.
  const limbId = window.D.g.limbColor || 'auto';
  const limbEntry = window.HG_CONFIG.LIMB_COLORS.find(x => x.id === limbId);
  const limbHex = (limbEntry && limbEntry.hex) ? limbEntry.hex : gc.bodyDk;
  return { body: gc.body, bodyLt: gc.bodyLt, bodyDk: gc.bodyDk, eye: ec.hex, mouth: mc.hex, cheek: chk.hex, limb: limbHex };
}

function getEnvC() {
  const id = window.D.g.envTheme || 'pastel';
  const et = window.HG_CONFIG.ENV_THEMES.find(x => x.id === id) || window.HG_CONFIG.ENV_THEMES[0];
  return et;
}


/* ─── SYSTÈME 5 : INVENTAIRE & PERSONNALISATION ─────────────────── */

const PROP_SLOTS = {
  A:   { x: 38,  y: 108 },  // fond gauche
  B:   { x: 132, y: 108 },  // fond droit
  C:   { x: 28,  y: 140 },  // sol gauche
  D:   { x: 148, y: 140 },  // sol droit
  SOL: { x: 88,  y: 152 },  // sol centre
};

function getPropDef(id) {
  return (window.PROPS_LIB || []).find(l => l.id === id)
      || (window.D.propsPixels && window.D.propsPixels[id]);
}

/**
 * Moteur de rendu d'objets (Prop Engine). Traduit le JSON en Pixel Art.
 */
function drawProp(p, prop, offsetX, offsetY) {
  if (!prop.pixels || !prop.palette) return;
  const ps = prop.pxSize || PX;  // ← taille pixel du prop (défaut = PX global)
  p.noStroke();
  for(let row=0; row<prop.pixels.length; row++) {
    for(let col=0; col<prop.pixels[row].length; col++) {
      const ci = prop.pixels[row][col];
      if(ci === 0) continue;
      p.fill(prop.palette[ci]);
      pxFree(p, offsetX + col*ps, offsetY + row*ps, ps, ps); // ← pxFree
    }
  }
}

function spawnP(x, y, c) {
  window.particles.push({
    x, y, 
    vx: (Math.random() - 0.5) * 4, 
    vy: -Math.random() * 3 - 1.5, 
    life: 16, 
    c
  });
}


/* ─── SYSTÈME 2 : ÉCOSYSTÈME & TOPOGRAPHIE ──────────────────────── */

// RÔLE : Coordonnées [x, y] des étoiles fixes du ciel (en pixels canvas).
// POURQUOI : Extraites ici plutôt qu'en tableau littéral dans drawSky()
//            pour faciliter les ajustements visuels sans chercher dans la boucle.
//            Zone haute (y 5–40) : étoiles d'origine.
//            Zone médiane (y 45–80) + basse (y 82–115) : ajoutées pour couvrir
//            la fenêtre de la chambre visible dans le biome intérieur.
const STARS = [
  // Zone haute (y 5–40)
  [20,10],[60,25],[110,8],[155,22],[185,12],[40,40],[130,35],
  // Zone médiane (y 45–80)
  [15,50],[75,55],[100,48],[145,62],[175,58],[35,72],[160,75],
  // Zone basse (y 82–115)
  [50,85],[90,92],[135,88],[170,98],[25,105],[120,112],[80,100],
];

/**
 * Dessine le ciel avec un gradient dynamique et des éléments célestes.
 */
function drawSky(p, h, ha) {
  p.noStroke();
  let c1, c2;

  const sol = window.getSolarPhase ? window.getSolarPhase() : { phase: 'jour', t: 0.5 };
  const skyPhase = sol.phase, skyT = sol.t;

  if (skyPhase === 'jour' && ha <= HA_MED) { // ciel gris si ha ≤ 2
    const blend = ha / HA_MED; // 0 = gris total, 1 = ciel normal
    c1 = p.lerpColor(p.color('#4a4a5c'), p.color(C.skyGray1), blend);
    c2 = p.lerpColor(p.color('#5a5a6c'), p.color(C.skyGray2), blend);
  } else if (skyPhase === 'jour') {
    c1 = C.skyD1; c2 = C.skyD2;
  } else if (skyPhase === 'aube') {
    if (skyT < 0.5) {
      const lt = skyT * 2;
      c1 = p.lerpColor(p.color(C.skyN1), p.color(C.skyA1), lt);
      c2 = p.lerpColor(p.color(C.skyN2), p.color(C.skyA2), lt);
    } else {
      const lt = (skyT - 0.5) * 2;
      c1 = p.lerpColor(p.color(C.skyA1), p.color(C.skyD1), lt);
      c2 = p.lerpColor(p.color(C.skyA2), p.color(C.skyD2), lt);
    }
  } else if (skyPhase === 'crepuscule') {
    if (skyT < 0.5) {
      const lt = skyT * 2;
      c1 = p.lerpColor(p.color(C.skyD1), p.color(C.skyK1), lt);
      c2 = p.lerpColor(p.color(C.skyD2), p.color(C.skyK2), lt);
    } else {
      const lt = (skyT - 0.5) * 2;
      c1 = p.lerpColor(p.color(C.skyK1), p.color(C.skyN1), lt);
      c2 = p.lerpColor(p.color(C.skyK2), p.color(C.skyN2), lt);
    }
  } else {
    c1 = C.skyN1; c2 = C.skyN2;
  }

  for (let y = 0; y < 120; y += PX) {
    p.fill(p.lerpColor(p.color(c1), p.color(c2), y / 120));
    p.rect(0, y, CS, PX);
  }

  // Étoiles : nuit pleine + fondu en entrée/sortie de crépuscule/aube
  const showStars = skyPhase === 'nuit'
    || (skyPhase === 'aube'       && skyT < 0.25)
    || (skyPhase === 'crepuscule' && skyT > 0.75);
  if (showStars) {
    const starAlpha = skyPhase === 'nuit'        ? 255
      : skyPhase === 'aube'                      ? (1 - skyT / 0.25) * 255
      : ((skyT - 0.75) / 0.25) * 255;
    // RÔLE : Dessine les étoiles réparties sur toute la hauteur du ciel (0–115px).
    // POURQUOI : Coordonnées centralisées dans const STARS (haut du fichier) —
    //            plus besoin de chercher dans la boucle pour ajuster une étoile.
    // Chaque étoile : [x, y] — scintillement décalé via (frameCount + x) % cycle
    p.fill(p.color(255, 255, 200, Math.round(starAlpha)));
    STARS.forEach(s => {
      if ((p.frameCount + s[0]) % 35 < 25) px(p, s[0], s[1], PX, PX);
    });

    if (skyPhase === 'nuit') {
      const trailCycle = 60, trailPhase = p.frameCount % trailCycle;
      if (trailPhase === 0) {
        window._starTrail = {
          startX: Math.random() * 80 + 5, startY: Math.random() * 20 + 3,
          lenX:   60 + Math.random() * 80, lenY:  25 + Math.random() * 45,
        };
      }
      if (trailPhase < 12 && window._starTrail) {
        const progress = trailPhase / 12;
        const sx = window._starTrail.startX + progress * window._starTrail.lenX;
        const sy = window._starTrail.startY + progress * window._starTrail.lenY;
        for (let ti = 0; ti < 3; ti++) {
          p.fill(p.color(255, 255, 200, ti === 0 ? 230 : 120 - ti * 40));
          px(p, sx - ti * PX * 2, sy - ti * PX, PX, PX);
        }
      }
    }
  }

  // Nuages : jour, fin d'aube, début de crépuscule — et bonne humeur
  const showClouds = ha > HA_MED && ( // nuages seulement si ha > 2
    skyPhase === 'jour'
    || (skyPhase === 'aube'       && skyT > 0.5)
    || (skyPhase === 'crepuscule' && skyT < 0.5)
  );
  if (showClouds) {
    drawCl(p, 40 + Math.sin(p.frameCount * .014) * 8, 20);
    drawCl(p, 150 + Math.cos(p.frameCount * .011) * 6, 35);
  }
}

function drawCl(p, x, y) { 
  p.fill(C.cloud); 
  p.rect(x, y, PX * 5, PX * 2); 
  p.rect(x + PX, y - PX, PX * 3, PX); 
}

function drawZzz(p, x, y) {
  for(let i = 0; i < 3; i++) {
    const fy = y - i * 15 - (p.frameCount % 50) * 0.4;
    const fx = x + i * 10 + Math.sin(p.frameCount * .1 + i) * 3;
    const sz = PX;
    p.fill(p.color(176, 144, 208, 200 - i * 50));
    px(p, fx, fy, sz * 4, sz);          
    px(p, fx + sz * 2, fy + sz, sz, sz); 
    px(p, fx + sz, fy + sz * 2, sz, sz); 
    px(p, fx, fy + sz * 3, sz * 4, sz);  
  }
}

function updateParts(p) {
    p.noStroke();
    window.particles = window.particles.filter(pt => {
      pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.12; pt.life--;
      if (pt.life <= 0) return false;
      const a = pt.life / 16;
      // RÔLE : Taille de la particule — utilise pt.r si défini, sinon PX (5px) par défaut.
      // POURQUOI : Permet aux bulles de bain (et futures particules) d'avoir des tailles variées
      //            sans casser les particules existantes (toutes à PX par défaut).
      const sz = pt.r || PX;
      p.fill(p.color(...p.color(pt.c)._array.slice(0,3).map(x=>x*255), a * 255));
      px(p, pt.x, pt.y, sz, sz);
      return true;
    });
}


/* ─── SYSTÈME 1 : SPRITES → voir render-sprites.js ──────────────── */
// drawDither, drawAccessoires, drawEgg, drawBaby, drawTeen, drawAdult
// sont définis dans render-sprites.js (chargé après render.js dans index.html)

// RÔLE : Déclenche la réaction visuelle + bulle au tap du Gotchi selon son état.
// POURQUOI : Trois états possibles depuis la refonte des horaires :
//   - sleeping (23h30–7h) : Zzz, grogne
//   - soirTardif (22h30–23h29) : veut la paix, réaction douce mais claire
//   - éveillé : joie, particules festives
// @param {boolean} sleeping   — le Gotchi dort vraiment (23h30–7h)
// @param {boolean} soirTardif — le Gotchi est dans sa chambre mais pas encore endormi (22h30–23h29)
function triggerTouchReaction(sleeping, soirTardif = false) {
  const awakeTypes    = ['heart', 'heart', 'sparkle', 'jump', 'spin', 'star', 'note', 'flower'];
  const soirTypes     = ['moon', 'zzz'];   // particules douces — pas de angry, pas de cœurs festifs
  const sleepTypes    = ['zzz', 'moon', 'angry'];
  const types = sleeping ? sleepTypes : soirTardif ? soirTypes : awakeTypes;
  const type = types[Math.floor(Math.random() * types.length)];

  window.touchReactions.push({
    timer: 35,
    type,
    cx: (window._lastTapX || 100) + (Math.random() - 0.5) * 40,
  });

  if (window.touchReactions.length > 8) window.touchReactions.shift();
  animator.trigger('shake');

  const touchMsgs = sleeping
    ? ['*grogne* 😤', 'Laisse-moi dormir ! 🌙', '...zzz... 💤']
    : soirTardif
      ? ['Chut… 🌙', '*soupir* pas maintenant ✿', "J'ai besoin de calme… 💤", '*bâille* 🌸']
      : ['*hehe* ✿', 'Coucou ! 💜', '*giggle* 🌸', 'Encore ! ✿'];
  
  flashBubble(touchMsgs[Math.floor(Math.random() * touchMsgs.length)], 2000);
}


/* ─── SYSTÈME 7 : L'INGÉNIERIE & LA BOUCLE PRINCIPALE p5.js ─────── */

/* ──────────────────────────────────────────────────────────────────
   SOUS-FONCTIONS DE RENDU — extraites de p.draw() pour lisibilité
   Toutes locales au module : aucune exposition window.* nécessaire
   car elles ne sont appelées que depuis p.draw().
   ────────────────────────────────────────────────────────────────── */

/**
 * RÔLE : Dessine les props filtrées par type de slot.
 * POURQUOI : Remplace 4 blocs .filter().forEach() quasi-identiques dans p.draw().
 *            Un seul endroit à lire/modifier si la logique de filtrage évolue.
 *
 * @param {object} p         - instance p5.js
 * @param {object} g         - window.D.g (état du gotchi)
 * @param {string} envActif  - identifiant de l'env courant ('parc', 'chambre', 'montagne')
 * @param {string} mode      - 'ambiance' | 'fond' | 'sol' | 'fg'
 *   • 'ambiance' → type=ambiance, tous slots, animation drift/fall/float/sparkle
 *   • 'fond'     → type=decor, slots A et B
 *   • 'sol'      → type=decor, slot SOL
 *   • 'fg'       → type=decor, slots C et D (premier plan, devant le Gotchi)
 */
function drawPropsLayer(p, g, envActif, mode) {
  if (!g.props) return; // aucune prop à dessiner — sortie rapide

  if (mode === 'ambiance') {
    // RÔLE : Props flottantes animées — nombre d'instances et espacement dynamiques.
    // POURQUOI : L'ancien code répétait toujours 3× avec des offsets fixes (i*70px).
    //            Avec un paramètre `instances` dans le prop, on adapte l'espacement
    //            à la largeur du canvas pour que les particules soient toujours bien
    //            réparties : peu d'instances → grandes zones de vide, beaucoup → dense.
    g.props
      .filter(pr => pr.actif && pr.type === 'ambiance' && (pr.env === envActif || !pr.env))
      .forEach(prop => {
        const def = getPropDef(prop.id);
        if (!def?.pixels) return;
        const motion    = def.motion    || 'drift';
        const instances = def.instances || 3; // RÔLE : nombre de particules simultanées (défaut 3 pour compat)

        // RÔLE : Espacement horizontal calculé depuis CS pour couvrir tout le canvas.
        // POURQUOI : Avec des offsets fixes (i*70), 5 instances se chevauchaient.
        //            En divisant CS par instances, chaque particule a sa propre zone.
        const gapX = CS / instances;

        // RÔLE : Espacement vertical calculé depuis la hauteur utile (130px environ).
        // POURQUOI : Décaler les particules en Y évite qu'elles arrivent toutes en même temps.
        const gapY = 130 / instances;

        for (let i = 0; i < instances; i++) {
          // RÔLE : Vitesse légèrement différente par instance pour casser l'effet mécanique.
          // POURQUOI : Sans ça, toutes les particules avancent au même rythme et ça fait
          //            "train" — avec un facteur par instance, chacune a sa propre cadence.
          const speed = 1.5 + (i % 3) * 0.4; // vitesses : 1.5 / 1.9 / 2.3 en alternance

          let ax, ay;
          if (motion === 'drift') {
            // RÔLE : Glisse de gauche à droite (sens positif).
            // POURQUOI : L'ancien sens (droite→gauche) était contre-intuitif pour une brise.
            ax = ((p.frameCount * speed + i * gapX) % (CS + 20)) - 10;
            ay = 20 + i * gapY + Math.sin(p.frameCount * .05 + i) * 8;

          } else if (motion === 'fall') {
            // RÔLE : Tombe du haut vers le bas avec balancement latéral sinusoïdal.
            // POURQUOI : L'ancien fall descendait en ligne droite — le sin plus ample
            //            donne un effet feuille/pétale qui se balance dans sa chute.
            ax = (gapX * 0.5) + i * gapX + Math.sin(p.frameCount * .06 + i * 1.2) * 12;
            ay = (p.frameCount * speed + i * gapY) % 130;

          } else if (motion === 'float') {
            // RÔLE : Monte de bas en haut avec dérive latérale douce.
            ax = (gapX * 0.3) + i * gapX + Math.sin(p.frameCount * .06 + i) * 6;
            ay = 110 - ((p.frameCount * speed + i * gapY) % 120);

          } else if (motion === 'sparkle') {
            // RÔLE : Clignote à des positions fixes — apparaît/disparaît par salves.
            // POURQUOI : Le décalage par instance (i*13) évite que tout clignote ensemble.
            if ((p.frameCount + i * 13) % 20 < 10) continue;
            ax = (gapX * 0.2) + i * gapX + Math.sin(p.frameCount * .1 + i) * 10;
            ay = 15 + i * gapY + Math.cos(p.frameCount * .08 + i) * 8;
          }
          drawProp(p, def, ax, ay);
        }
      });

  } else {
    // RÔLE : Props de décor fixes — positionnées sur un slot PROP_SLOTS défini
    // POURQUOI : 'fond' (A,B), 'sol' (SOL), 'fg' (C,D) partagent exactement la même
    //            logique de dessin — seul le filtre sur pr.slot change.
    const slotWhitelist = mode === 'fond' ? ['A', 'B']
                        : mode === 'sol'  ? ['SOL']
                        :                  ['C', 'D']; // fg

    g.props
      .filter(pr =>
        pr.actif &&
        pr.type === 'decor' &&
        slotWhitelist.includes(pr.slot) &&
        (pr.env === envActif || !pr.env)
      )
      .forEach(prop => {
        const def = getPropDef(prop.id);
        if (!def?.pixels) return;
        const slot = PROP_SLOTS[prop.slot];
        if (slot) drawProp(p, def, slot.x, slot.y);
      });
  }
}

/**
 * RÔLE : Dessine le bandeau HUD en haut du canvas.
 * POURQUOI : Isoler cette zone (~65 lignes) permet de modifier l'affichage
 *            des pétales, météo ou icônes d'action sans parcourir tout p.draw().
 *
 * @param {object} p - instance p5.js
 * @param {object} g - window.D.g
 * @param {number} h - heure courante (0–23)
 */
function drawHUD(p, g, h) {
  // ── Bandeau de fond semi-transparent ──
  p.noStroke();
  p.textStyle(p.NORMAL);
  p.fill(0, 0, 0, 50);
  p.rect(0, 0, CS, 26);

  // ── ZONE GAUCHE : pétales ──────────────────────────────────────
  p.fill(255);
  p.textSize(11);
  p.textAlign(p.LEFT, p.TOP);
  p.drawingContext.globalAlpha = 1.0;
  p.text('🌸 ' + (g.petales || 0), 5, 6);

  // ── ZONE DROITE : météo ────────────────────────────────────────
  if (window.meteoData?.temperature) {
    const wcMeteo = window.meteoData?.weathercode;
    const wind    = window.meteoData?.windspeed || 0;
    let hudMeteo  = Math.round(window.meteoData.temperature) + '°C';
    if (wcMeteo === 45 || wcMeteo === 48) hudMeteo += ' 😶‍🌫️';
    if (wind > 20) hudMeteo += ' 🌬️';
    p.textSize(hudMeteo.length > 9 ? 9 : 11);
    p.textAlign(p.RIGHT, p.TOP);
    p.drawingContext.globalAlpha = 1.0;
    p.text(hudMeteo, CS - 5, 6);
    p.textSize(11);
  }

  // ── ZONE CENTRE : 3 icônes d'action ───────────────────────────
  // Disposition : 🛁 (gauche) — 🧹 (centre exact) — 🍽️ (droite)
  // POURQUOI : Le balai (action la plus fréquente) est au centre exact du canvas.
  //            🛁 et 🍽️ sont symétriques à ±28px de ce centre.
  //            Opacité : 1.0 = action dispo, 0.25 = rien à faire (icône toujours visible).
  p.textSize(20);
  p.textAlign(p.CENTER, p.CENTER);

  // 🧹 Balai (centre exact, x=70) : opaque si des crottes sont présentes
  const hasPoops = (window.D.g.poops || []).length > 0;
  p.drawingContext.globalAlpha = hasPoops ? 1.0 : 0.25;
  p.text('🧹', 70, 14);

  // 🛁 Bain (gauche du centre, x=100) : opaque si salete >= 2, estompé si propre
  // POURQUOI : seuil aligné sur celui du dithering et du frottement — l'icône s'allume
  //            exactement quand les taches apparaissent et que le frottement est disponible.
  const salete = window.D?.g?.salete || 0;
  p.drawingContext.globalAlpha = salete >= 2 ? 1.0 : 0.25;
  p.text('🛁', 100, 14);

  // 🍽️ Assiette (droite du centre, x=130) : opaque si repas disponible
  const mealWin = (typeof getCurrentMealWindow === 'function') ? getCurrentMealWindow() : null;
  const meals   = (typeof ensureMealsToday === 'function') ? ensureMealsToday() : null;
  const mealAvailable = mealWin && meals && !meals[mealWin];
  p.drawingContext.globalAlpha = mealAvailable ? 1.0 : 0.25;
  p.text('🍽️', 130, 14);

  p.drawingContext.globalAlpha = 1.0;

  // RÔLE : Déclenche les particules de propreté si une crotte vient d'être nettoyée
  // POURQUOI : window._cleanPositions est posé par app.js juste après le nettoyage —
  //            on le lit ici (dans le draw) pour les faire apparaître au bon endroit.
  if (window._cleanPositions?.length) {
    window._cleanPositions.forEach(pos => {
      for (let i = 0; i < 6; i++) {
        spawnP(pos.x + (Math.random() - 0.5) * 20, pos.y + (Math.random() - 0.5) * 10, C.star);
      }
    });
    window._cleanPositions = null;
  }
}

/**
 * RÔLE : Dessine les deux badges ⚡/✿ en bas-gauche + le triangle d'interactivité.
 * POURQUOI : Les badges exposent window._badgeHitZone pour touchStarted — les isoler
 *            ici permet de changer leur taille/position sans toucher à p.draw().
 *
 * @param {object} p - instance p5.js
 * @param {object} g - window.D.g
 */
function drawBadges(p, g) {
  const en = g.energy;
  const ha = g.happiness;
  const badgeY  = CS - 18; // position verticale : 18px du bas
  const badgeH  = 13;      // hauteur de la capsule
  const badgeR  = 3;       // rayon des coins arrondis
  const badgePadX = 4;     // padding interne horizontal
  const badgeW  = 30;      // largeur fixe identique pour les deux badges
  const iconW   = 10;      // zone réservée à l'icône
  const gap     = 3;       // espace fixe entre icône et chiffre
  const gap2    = 3;       // espace entre les deux badges
  // POURQUOI : p.CENTER sur Y + midY évite le décalage manuel qui variait selon textSize
  const midY    = badgeY - 1 + badgeH / 2;

  p.noStroke();
  p.textStyle(p.NORMAL);
  p.textSize(9);

  // ── Badge ⚡ (énergie) ──
  const enX = 4;
  p.fill(0, 0, 0, 50);           // même alpha que le bandeau HUD supérieur
  p.rect(enX, badgeY - 1, badgeW, badgeH, badgeR);
  p.fill(255);
  p.textAlign(p.LEFT, p.CENTER); // CENTER sur Y = centrage vertical automatique
  p.text('⚡', enX + badgePadX, midY);
  p.text(String(en), enX + badgePadX + iconW + gap, midY);

  // ── Badge ✿ (bonheur) ──
  const haX = enX + badgeW + gap2;
  p.fill(0, 0, 0, 50);
  p.rect(haX, badgeY - 1, badgeW, badgeH, badgeR);
  p.fill(255);
  p.textAlign(p.LEFT, p.CENTER);
  p.text('✿', haX + badgePadX, midY);
  p.text(String(ha), haX + badgePadX + iconW + gap, midY);

  // ── Triangle ▲ interactivité ──
  const triX = haX + badgeW + 4;
  p.textSize(8);
  p.fill(255, 255, 255, 160);
  p.textAlign(p.LEFT, p.CENTER);
  p.text('▲', triX, midY);

  // Exposer la zone de hit pour touchStarted (en px canvas)
  // POURQUOI : calculé ici pour rester synchronisé si les badges changent de taille
  window._badgeHitZone = {
    x1: 4,
    x2: triX + 10,
    y1: badgeY - 2,
    y2: badgeY + badgeH + 2
  };

  p.textSize(11); // ← remet la taille par défaut après les badges
}

/**
 * RÔLE : Dessine le sélecteur d'environnement en bas-droite du canvas.
 * POURQUOI : Isoler ce composant (~85 lignes) permet de modifier son comportement
 *            (nouveaux envs, animation de fondu) sans parcourir tout p.draw().
 *
 * @param {object} p          - instance p5.js
 * @param {object} g          - window.D.g
 * @param {number} nightRatio - ratio nuit 0→1 (calculé dans p.draw)
 */
function drawEnvSelector(p, g, nightRatio) {
  // ── Géométrie (aligné sur le bas des badges) ──
  // POURQUOI : badgeY = CS-18, bas des badges = badgeY - 1 + badgeH = CS - 6.
  //            On aligne le bas du cercle sur ce même bas → centre = CS - 6 - envR.
  const envR  = 13;                 // rayon = badgeH (13) → diamètre 26px = 2× hauteur badge
  const envCX = CS - 4 - envR;     // centre X : margin droit 4px + rayon
  const envCY = CS - 6 - envR;     // centre Y : bas aligné sur le bas des badges (CS - 6)
  const envGap = envR * 2 + 5;     // espacement entre cercles empilés (diamètre + 5px)

  // ── Mapping emoji par biome — construit dynamiquement depuis ENV_BIOMES ──
  // RÔLE : Associe chaque biome (parc, chambre, montagne, jardin) à son emoji.
  // POURQUOI : ENV_BIOMES = lieux de vie du Gotchi (D.g.activeEnv).
  //            ENV_THEMES = palettes de couleurs (D.g.envTheme) — distincts.
  //            Avant : { parc:'🌳', chambre:'🛏️', montagne:'⛰️' } hardcodé.
  const ENV_EMOJI = Object.fromEntries(
    (window.HG_CONFIG?.ENV_BIOMES || []).map(t => [t.id, t.icon])
  );
  const activeEnv = g.activeEnv || 'parc';

  // ── Détermination du mode nuit pour le sélecteur ──
  // RÔLE : On bloque le sélecteur dès que nightRatio === 1 (à partir de 22h30),
  //        car l'env est forcé chambre et l'utilisatrice ne peut pas changer d'env.
  const envLocked = nightRatio === 1;
  window._envLocked = envLocked; // exposé pour touchStarted (pas accès à nightRatio là-bas)

  // ── Flash thématique de transition d'environnement — compteur uniquement ──
  // RÔLE : Incrémente le compteur de fondu ; le dessin du flash se fait après drawActiveEnv.
  // POURQUOI : Le flash doit s'afficher PAR-DESSUS le décor — pas avant qu'il soit dessiné.
  const FADE_FRAMES = 24;
  if (window._envFadeState) window._envFadeState.frames++;
  if (window._envFadeState?.frames >= FADE_FRAMES) window._envFadeState = null;

  // ── Recalcul des zones de tap uniquement si l'état a changé ──
  // RÔLE : Évite d'allouer + remplir un nouveau tableau à chaque frame (12 fois/s).
  // POURQUOI : _envSelectorHits est lu dans touchStarted — il suffit qu'il soit à jour
  //            quand activeEnv ou _envSelectorOpen change, pas à chaque draw().
  const cacheKey_env  = activeEnv;
  const cacheKey_open = window._envSelectorOpen;
  const cacheHit = window._envSelectorCache.env  === cacheKey_env
                && window._envSelectorCache.open === cacheKey_open;
  if (!cacheHit) {
    // On reconstruit le tableau depuis zéro et on mémorise la combinaison.
    window._envSelectorHits = [];
    window._envSelectorCache.env  = cacheKey_env;
    window._envSelectorCache.open = cacheKey_open;
  }
  // Si cacheHit === true, on réutilise _envSelectorHits tel quel (pas de réallocation).

  // ── Cercle principal (env actif, ou 💤 la nuit) ──
  p.noStroke();
  p.fill(0, 0, 0, 50);           // même fond semi-transparent que les badges
  p.circle(envCX, envCY, envR * 2);
  p.textAlign(p.CENTER, p.CENTER);
  p.textSize(14);
  p.fill(255);
  // RÔLE : Affiche 💤 dès que l'env est verrouillé (nightRatio === 1, soit dès 22h30).
  const mainEmoji = envLocked ? '💤' : ENV_EMOJI[activeEnv] || '🌳';
  p.text(mainEmoji, envCX, envCY);
  p.textSize(11); // ← reset taille texte

  // ── Zones de tap : calculées seulement si le cache est invalidé ──
  // RÔLE : On n'appelle .push() que lors d'un vrai changement d'état.
  //        Entre deux frames identiques, _envSelectorHits est réutilisé tel quel.
  if (!cacheHit) {
    // RÔLE : On enregistre toujours la zone du cercle principal, verrouillé ou non.
    // POURQUOI : Quand l'env est verrouillé (nuit), le tap doit afficher une bulle
    //            plutôt que de ne rien faire — le flag `locked` permet de distinguer les deux cas.
    window._envSelectorHits.push({ env: '__main__', cx: envCX, cy: envCY, r: envR, locked: envLocked });
  }

  // ── Cercles flottants (seulement si ouvert et env non verrouillé) ──
  if (window._envSelectorOpen && !envLocked) {
    // RÔLE : Affiche les biomes alternatifs au-dessus du cercle principal.
    // POURQUOI : Liste lue depuis ENV_BIOMES (lieux de vie) — distinct de ENV_THEMES (palettes).
    //            Avant : ['parc', 'chambre', 'montagne'] hardcodé.
    const otherEnvs = (window.HG_CONFIG?.ENV_BIOMES || [])
      .map(t => t.id)
      .filter(e => e !== activeEnv);

    otherEnvs.forEach((env, i) => {
      // i=0 → juste au-dessus du principal | i=1 → encore plus haut
      const floatCY = envCY - envGap * (i + 1);

      p.fill(0, 0, 0, 65);       // légèrement plus opaque pour se distinguer
      p.circle(envCX, floatCY, envR * 2);

      p.fill(255);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(14);
      p.text(ENV_EMOJI[env] || '?', envCX, floatCY);
      p.textSize(11); // ← reset

      // N'ajoute au tableau que si le cache est invalidé (évite les doublons)
      if (!cacheHit) {
        window._envSelectorHits.push({ env, cx: envCX, cy: floatCY, r: envR });
      }
    });
  }
}

/* ──────────────────────────────────────────────────────────────────
   FIN DES SOUS-FONCTIONS — p5s() commence ci-dessous
   ────────────────────────────────────────────────────────────────── */

const p5s = (p) => {
  p.setup = function() {
    // RÔLE : Adapter la résolution interne du canvas à la densité d'écran réelle.
    // POURQUOI : Sur iPhone/Android Retina (dpr=2 ou 3), le canvas est affiché à une taille CSS
    //            plus grande que CS px — le navigateur doit l'upscaler et lisse les pixels → flou.
    //            En passant pixelDensity(dpr) AVANT createCanvas(), p5 crée un canvas interne
    //            de CS×dpr pixels pour un affichage CSS de CS px → chaque pixel reste net.
    //            La taille CSS affichée (100% du conteneur) n'est pas modifiée.
    const dpr = window.devicePixelRatio || 1;
    p.pixelDensity(dpr);
    p.createCanvas(CS, CS).parent('cbox');
    p.noSmooth();
    p.frameRate(12);
  };

  p.draw = function() {
    if (!window.D) return;
    const g = window.D.g, h = hr(), mins = new Date().getMinutes();
    // RÔLE : sleeping = true à partir de 23h30 (le gotchi pose, Zzz, mouvements arrêtés).
    // POURQUOI : La chambre est forcée à 22h30 (nightRatio), mais le gotchi ne dort
    //            vraiment (pose + Zzz) qu'à 23h30 — il se prépare dans l'intervalle.
    const sleeping = (h === 23 && mins >= 30) || (h >= 0 && h < 7);

    // Initialisation des couleurs
    const gc = getGotchiC();
    C.body = gc.body; C.bodyLt = gc.bodyLt; C.bodyDk = gc.bodyDk; C.eye = gc.eye; C.mouth = gc.mouth; C.cheek = gc.cheek; C.limb = gc.limb;
    const ec = getEnvC();
    C.gnd = ec.gnd; C.gndDk = ec.gndDk; C.skyD1 = ec.sky1; C.skyD2 = ec.sky2;

    // RÔLE : Easing (lerp) sur energy et happiness — transitions visuelles douces.
    // POURQUOI : Sans lerp, le passage de 3→1 est instantané (1 frame) → trop abrupt.
    //            On initialise _dispEnergy/_dispHappy à la valeur réelle au 1er frame,
    //            puis on les approche de la cible à vitesse 0.12/frame (~0.7s à 12fps).
    // IMPORTANT : le lerp s'applique uniquement aux effets de sprite (posture, expression du gotchi).
    //             Les éléments de décor (soleil, arc-en-ciel, nuages, pluie, ciel) utilisent
    //             haReal/enReal — les vraies valeurs entières — pour éviter que les seuils
    //             de comparaison exacte (=== 4, >= 5) ne soient jamais atteints par un float.
    if (_dispEnergy === null) _dispEnergy = g.energy;
    if (_dispHappy  === null) _dispHappy  = g.happiness;
    _dispEnergy += (g.energy    - _dispEnergy) * 0.12;
    _dispHappy  += (g.happiness - _dispHappy)  * 0.12;
    const en = _dispEnergy, ha = _dispHappy;
    const enReal = g.energy;    // valeur entière réelle — pour décor/météo
    const haReal = g.happiness; // valeur entière réelle — pour décor/météo

    // RÔLE : nightRatio détermine si le gotchi est en mode nuit (chambre forcée, sélecteur verrouillé).
    //        Pas de transition progressive — le passage se fait via le flash thématique (ENV_FLASH_COLOR),
    //        exactement comme quand l'utilisatrice change d'env manuellement.
    // Chambre forcée à partir de 22h30 (soir) jusqu'à 6h00 (matin).
    const nightRatio = ((h === 22 && mins >= 30) || h >= 23 || h < 6) ? 1 : 0;

    // RÔLE : Déclenche le flash de transition chambre une seule fois à 22h30, pas à chaque frame.
    // POURQUOI : Sans ce verrou, _envFadeState serait réinitialisé à chaque draw() entre 22h30 et 23h,
    //            ce qui provoquerait un flash infini. On mémorise si le flash a déjà été joué.
    const isNightTime = nightRatio === 1;
    if (isNightTime && !window._nightFlashDone) {
      const prevEnv = g.activeEnv || 'parc';
      if (prevEnv !== 'chambre') {
        window._envFadeState = { from: prevEnv, to: 'chambre', frames: 0 };
      }
      window._nightFlashDone = true; // verrou : ne se redéclenche pas jusqu'au lendemain
    } else if (!isNightTime) {
      window._nightFlashDone = false; // reset le matin pour que le prochain soir fonctionne
    }
    const n = nightRatio; // alias court pour compatibilité avec drawActiveEnv(p, env, n, h)

    const sol = window.getSolarPhase ? window.getSolarPhase() : { phase: 'jour', t: 0 };
    const darkAlpha = sol.phase === 'nuit'       ? 100
                    : sol.phase === 'aube'        ? Math.round(100 * (1 - sol.t))
                    : sol.phase === 'crepuscule'  ? Math.round(100 * sol.t)
                    : 0;

// 1. Fond et Météo
    drawSky(p, h, haReal); // haReal = valeur entière réelle (pas le float lerp)
    if (window.meteoData && window.meteoData.windspeed > 20) drawWind(p);

    const estJour = h < 19;
    // RÔLE : Détermine l'environnement à afficher en fond.
    // La nuit, on force la chambre — SAUF si on est en preview inventaire (_invEnvForced),
    // auquel cas on respecte le choix de l'utilisatrice pour qu'elle puisse voir parc/montagne.
    const enPreviewInv = !!window._invEnvForced;
    let envActif = (!enPreviewInv && nightRatio === 1) ? 'chambre' : (g.activeEnv || 'parc');
    // RÔLE : Pendant la première moitié du flash (frames 0–8), on continue d'afficher
    //        l'ancien env (fs.from) pour que le flash "cache" vraiment le cut.
    //        À partir du pic (frame 8), le nouvel env peut apparaître sous le flash descendant.
    // POURQUOI : Sans ça, le nouvel env est visible dès le premier frame — le flash arrive trop tard.
    if (window._envFadeState && window._envFadeState.frames <= 8) {
      envActif = window._envFadeState.from;
    }
    if (!sleeping) {
      // RÔLE : haReal (entier réel) pour les seuils exacts — ha (float lerp) causerait
      //        des comparaisons === 4 ou >= 5 jamais vraies pendant la transition.
      if (haReal < HA_MED)                    drawRain(p, haReal);
      else if (haReal === HA_HIGH && estJour) drawSun(p);
      else if (haReal >= 5 && estJour)        drawRainbow(p);
    }

    drawActiveEnv(p, envActif, n, h);

    // 2. Props Ambiance — filtrées par environnement actif
    // RÔLE : N'afficher que les ambiances assignées à l'env en cours.
    // POURQUOI : Chaque univers peut avoir ses propres ambiances depuis la v3.49.
    //            Rétrocompat : si env non défini (ancienne sauvegarde), on affiche quand même.
    drawPropsLayer(p, g, envActif, 'ambiance');

    // 3. Détection crottes — regard gotchi (calcul anticipé, dessin reporté après SOL)
    // RÔLE : Déclenche le regard latéral du gotchi vers la crotte la plus proche dès qu'il y en a une.
    // POURQUOI : L'ancienne condition (< 25px) était trop restrictive — le gotchi ne passait
    //            presque jamais à moins de 25px d'une crotte fixe, donc le regard ne s'activait jamais.
    //            Désormais : dès qu'il y a au moins 1 crotte dans D.g.poops, _gotchiNearPoop = true.
    //            _poopDirection() (render-sprites.js) calcule ensuite le côté (gauche/droite) à partir
    //            de la crotte la plus proche, quelle que soit la distance — c'est lui qui pilote le reflet.
    const poops = window.D.g.poops || [];
    window._gotchiNearPoop = poops.length > 0;

    // 4. Props Décor — Fond (A, B) — filtrées par environnement actif
    // RÔLE : N'afficher que les décors de fond assignés à l'env en cours.
    // POURQUOI : Feature multi-env v3.49. Rétrocompat : env absent → toujours visible.
    drawPropsLayer(p, g, envActif, 'fond');

// 5. Props Décor — SOL (devant le décor, DERRIÈRE le Gotchi) — filtrées par env
    drawPropsLayer(p, g, envActif, 'sol');

// 5b. Dessin des Cacas — APRÈS le sol, AVANT le Gotchi
// RÔLE : Les crottes sont dessinées ici pour qu'elles apparaissent devant les objets du fond
//         (slots A, B, SOL) mais derrière le gotchi lui-même et les slots de premier plan (C, D).
// POURQUOI : Repositionner ici donne la bonne profondeur visuelle dans le tama :
//            fond → sol → crottes → gotchi → premier plan
{
  const pxSize = 20; // taille emoji crotte
  poops.forEach(poop => {
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(pxSize);
    p.text('💩', poop.x, poop.y);
  });
}

// 6. Locomotion Gotchi
bounceT += sleeping ? 0.04 : 0.12;
const staticBob = sleeping ? Math.sin(bounceT) : Math.sin(bounceT) * 3;
let bobY = staticBob + GOTCHI_OFFSET_Y;

// RÔLE : Déclencher le bond snack au bon moment (progress > 0.7) via animator.
// POURQUOI : Remplace le calcul direct bobY dans ce bloc par 'snack_bond' dans ANIM_DEFS.
//            Le dessin de l'emoji reste dans le bloc eatAnim plus bas (hors animator).
if (window.eatAnim?.active) {
  const progress = 1 - (window.eatAnim.timer / 50);
  if (progress > 0.7 && !window.eatAnim.jumped) {
    window.eatAnim.jumped = true;
    animator.trigger('snack_bond'); // remplace: bobY -= Math.sin(...) * 18
  }
}

// Note : le saut de joie était géré ici via window._jumpTimer (supprimé Temps 2).
//        Il est maintenant géré par animator ('saut_joie') → _animOverrides.dy,
//        appliqué sur drawY après resolve() ci-dessous.

let amplitude = 15, vitesse = 0.02;
if (!sleeping && ha >= HA_HIGH && en >= HA_HIGH) {  // très heureux + plein d'énergie (≥ 4)
  amplitude = 40; vitesse = 0.06;
  if (p.frameCount % 20 < 10) bobY -= PX;
} else if (!sleeping && ha >= HA_WALK && en >= HA_WALK) { // état normal (≥ 3)
  amplitude = 25; vitesse = 0.04;
}

const XMIN = 35, XMAX = CS - 35;

if (!sleeping) {
  // RÔLE : Calcule la vitesse de déplacement selon les jauges (énergie + bonheur).
  // POURQUOI : Ternaire enchaîné → sélection d'une valeur parmi N cas mutuellement exclusifs,
  //            idiome standard en JS. Lisible car chaque cas tient sur une ligne.
  const speed = (ha >= HA_HIGH && en >= HA_HIGH)  ? 1.4  // vive (≥ 4/5)
              : (ha >= HA_SLOW && en >= HA_WALK)  ? 0.7  // normale (ha≥2.5, en≥3)
              : (en >= EN_TILT)                   ? 0.35 // lente (en≥2)
              : 0.12;                                     // traîne (en < 2)

  // RÔLE : Gestion de la pause entre deux déplacements.
  // POURQUOI : if/else → logique avec effets de bord (décrémentation, mutation de walkTarget).
  //            On évite les ternaires ici car le bloc a plusieurs instructions par branche.
  if (walkPause > 0) {
    walkPause--;
    if (walkPause === 0) {
      walkTarget = XMIN + Math.random() * (XMAX - XMIN);
    }
  } else {
    const dist = walkTarget - walkX;
    walkDir = dist > 0 ? 1 : -1;
    if (Math.abs(dist) < speed + 1) {
      walkX = walkTarget;
      walkPause = 30 + Math.floor(Math.random() * 90);
    } else {
      walkX += walkDir * speed;
    }
  }

} else {
  walkX += walkDir * 0.04;
  if (walkX > XMAX || walkX < XMIN) walkDir *= -1;
}
// RÔLE : Exposer toutes les variables de marche dans un objet partagé.
// POURQUOI : render-sprites.js avait besoin de walkPause pour savoir si le Gotchi
//            est en mouvement. Avant, il accédait à walkPause directement via la scope
//            globale — couplage implicite qui casserait si on passe en modules ES.
//            Avec window._walk, la dépendance est explicite et documentée.
window._walk = { x: walkX, dir: walkDir, pause: walkPause, target: walkTarget };
// Note : walkStep supprimé de _walk — variable morte (jamais lue, v4.5).
window._gotchiX = walkX; // ← gardé pour la rétrocompatibilité (hitbox touch, etc.)

const cx = walkX;
const by = getStageBaseY(g.stage); // RÔLE : Y de base du Gotchi selon son stade — centralisé dans getStageBaseY()
window._gotchiY = by + (bobY || 0);
const tilt = (!sleeping && en < EN_TILT) ? Math.sin(p.frameCount * 0.05) * 2 : 0; // balancement si en < 2

// shakeTimer supprimé — géré par animator.tick() via l'animation 'shake'

// RÔLE : Faire avancer le moteur d'animation d'un tick, puis calculer le diff visuel
//        pour ce frame et l'exposer sur window._animOverrides.
// POURQUOI : tick() décrémente les timers et purge les animations terminées.
//            resolve() produit un objet plat { hidden, visible, dx, dy } que renderSprite()
//            consommera en lecture seule — une seule évaluation par frame, partagée par
//            tous les appels renderSprite() du frame (drawAdult, drawTeen…).
animator.tick();
window._animOverrides = animator.resolve(g.stage);

// (étirement matinal retiré de p.draw — déclenché depuis app.js via triggerEtirementMatin)

// 7. Dessin du Gotchi
    let gotchiInfo;
    p.push();
    if (tilt) p.rotate(p.radians(tilt));
    
    // shakeOffsetX/Y supprimés — l'offset shake est maintenant géré par animator ('shake')
    // et intégré dans _animOverrides.dx / .dy appliqués sur drawX/drawY ci-dessous.
    const shakeOffsetX = 0; // conservé pour ne pas casser drawX = cx + shakeOffsetX + _animOverrides.dx
    const shakeOffsetY = 0; // conservé pour ne pas casser drawY = by + bobY + shakeOffsetY + _animOverrides.dy
    // RÔLE : Appliquer l'offset vertical de l'animator (saut, futur : bond, etc.) sur drawY.
    // POURQUOI : drawY est le cy transmis à drawAdult/drawBaby/drawTeen — c'est le bon niveau
    //            pour décaler le Gotchi entier (corps + accessoires + dithering + reflets yeux).
    //            Appliquer dy ici plutôt que dans renderSprite() évite de doubler l'offset.
    const animDy = window._animOverrides?.dy || 0;
    // RÔLE : animDx intègre maintenant le shake (migré depuis shakeOffsetX ad hoc).
    // POURQUOI : animator.resolve() retourne dx calculé par bodyOffset.xFn de 'shake'.
    const animDx = window._animOverrides?.dx || 0;
    const drawX = cx + shakeOffsetX + animDx;
    const drawY = by + bobY + shakeOffsetY + animDy;

    if (window._evoAnim && window._evoAnim.active) {
  const t = window._evoAnim.timer;

  if (t > 20) {
    const alpha = p.map(t, 45, 20, 0, 255);
    p.fill(255, 255, 255, alpha);
    p.noStroke();
    px(p, drawX - PX*5, drawY, PX*10, PX*9);
  } else {
    if      (g.stage === 'baby')  gotchiInfo = drawBaby(p, drawX, drawY, sleeping, en, ha);
    else if (g.stage === 'teen')  gotchiInfo = drawTeen(p, drawX, drawY, sleeping, en, ha);
    else                          gotchiInfo = drawAdult(p, drawX, drawY, sleeping, en, ha);
    const alpha2 = p.map(t, 20, 0, 255, 0);
    p.fill(255, 255, 255, alpha2);
    p.noStroke();
    px(p, drawX - PX*5, drawY, PX*10, PX*9);
  }

  window._evoAnim.timer--;
  if (window._evoAnim.timer <= 0) window._evoAnim.active = false;

} else {
      if      (g.stage === 'egg')   gotchiInfo = drawEgg(p, drawX, drawY);
      else if (g.stage === 'baby')  gotchiInfo = drawBaby(p, drawX, drawY, sleeping, en, ha);
      else if (g.stage === 'teen')  gotchiInfo = drawTeen(p, drawX, drawY, sleeping, en, ha);
      else                          gotchiInfo = drawAdult(p, drawX, drawY, sleeping, en, ha);
      if (sleeping && g.stage !== 'egg') drawZzz(p, drawX + 16, drawY - 10);
    }

    p.pop();

    // ── Premier plan Jardin — APRÈS le Gotchi ──
    // RÔLE : Dessine les éléments du jardin qui doivent passer DEVANT le Gotchi.
    // POURQUOI : La passe de fond (drawJardinFond) est déjà appelée via drawActiveEnv →
    //            drawJardin. Ce second appel est uniquement pour le premier plan (profondeur).
    //            En Phase 1 : drawJardinPremierPlan() est vide — aucun effet visible.
    //            En Phase 2+ : herbes courtes, fleurs de bord, insectes au premier plan.
    if (envActif === 'jardin') {
      const _jardinTheme = getEnvC(); // thème courant — identique à celui utilisé par drawJardinFond
      drawJardinPremierPlan(p, _jardinTheme, n);
    }

    const wc = window.meteoData?.weathercode;
    if (wc === 45 || wc === 48) drawFog(p);

    // 9. Props Décor — Premier plan (C, D) — DEVANT le Gotchi — filtrées par env
    drawPropsLayer(p, g, envActif, 'fg');

    // 10. Réactions et Particules
    p.drawingContext.globalAlpha = 1.0; 
    window.touchReactions = (window.touchReactions || []).filter(tr => tr.timer > 0);
    window.touchReactions.forEach(tr => {
      const progress = 1 - (tr.timer / 35); 
      const fy = (by - 15) - progress * 45; 
      const fx = tr.cx + Math.sin(progress * Math.PI * 3) * 10;

      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(16);
      p.drawingContext.globalAlpha = 1.0;

      if      (tr.type === 'heart')   p.text('💜', fx, fy);
      else if (tr.type === 'sparkle') p.text('✨', fx, fy);
      else if (tr.type === 'star')    p.text('⭐', fx, fy);
      else if (tr.type === 'note')    p.text('🎵', fx, fy);
      else if (tr.type === 'flower')  p.text('🌸', fx, fy);
      else if (tr.type === 'spin') {
        const angle = progress * Math.PI * 4;
        const sx = cx + Math.cos(angle) * 22;
        const sy = (by - 15) + Math.sin(angle) * 12;
        p.text('✨', sx, sy);
      }
      else if (tr.type === 'jump')  bounceT = Math.PI * 1.5;
      else if (tr.type === 'zzz')   p.text('💤', fx, fy);
      else if (tr.type === 'moon')  p.text('🌙', fx, fy);
      else if (tr.type === 'angry') p.text('😤', fx, fy);

      p.drawingContext.globalAlpha = 1.0;
      tr.timer--;
    });

    updateParts(p);

    // 11. Animations spécifiques (Snack, Clignement, Célébration)
    // RÔLE : Dessiner l'emoji en vol + déclencher la réaction tap au bon moment.
    // POURQUOI : Le bond du corps (eatAnim.jumped) est migré vers animator('snack_bond')
    //            dans le bloc eatAnim ci-dessus (~L994). Ce bloc gère uniquement l'emoji + timer.
    if (window.eatAnim?.active) {
      const ea = window.eatAnim;
      const progress = 1 - (ea.timer / 50);
      const fy = 20 + progress * (by - 30);
      const fx = cx;
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(20);
      p.drawingContext.globalAlpha = 1.0;
      p.text(ea.emoji, fx, fy);

      if (progress > 0.7 && !ea.jumped) {
        triggerTouchReaction(false);
        ea.jumped = true;
        // Note : animator.trigger('snack_bond') déjà appelé dans le bloc ~L994
      }
      ea.timer--;
      if (ea.timer <= 0) ea.active = false;
    }

    blinkT++;
if (!blink && blinkT > window._nextBlinkAt) {
  blink = true;
  window._blinkDuration = 3 + Math.floor(Math.random() * 4); // 3-6 frames
}
if (blink) {
  window._blinkDuration--;
  if (window._blinkDuration <= 0) {
    blink = false;
    blinkT = 0;
    window._nextBlinkAt = 40 + Math.floor(Math.random() * 80); // 40-120 frames entre clignements
  }
}

// ✨ Décrémente le timer d'expression une fois par frame
if (window._expr && window._expr.moodTimer > 0) window._expr.moodTimer--;

// RÔLE : Bâillement automatique après inactivité prolongée.
// POURQUOI : Donne vie au Gotchi quand l'utilisatrice ne l'a pas touché depuis un moment.
//            Le seuil est réduit de 3 min → 1 min si l'énergie est basse (≤ 30) —
//            un Gotchi fatigué bâille plus souvent, c'est plus naturel.
//            Cooldown YAWN_COOLDOWN pour éviter que ça spamme.
{
  const g = window.D?.g;
  const h = typeof hr === 'function' ? hr() : new Date().getHours();
  const isSleeping = g && (h >= 22 || h < 7);
  const noExprActive = !window._expr || window._expr.moodTimer === 0;
  if (!isSleeping && noExprActive) {
    window._idleFrames = (window._idleFrames || 0) + 1;
    // RÔLE : Seuil dynamique selon l'énergie — fatigue = bâillements plus fréquents.
    // POURQUOI : energy ≤ 30 → seuil 3× plus bas (720f vs 2160f).
    const energieBasse = g && (g.energy ?? 100) <= 30;
    const seuil = energieBasse ? YAWN_THRESHOLD_LOW : YAWN_THRESHOLD_NORMAL;
    if (window._idleFrames >= seuil) {
      window._idleFrames = -(YAWN_COOLDOWN); // cooldown négatif → attend avant de rebâiller
      window.triggerExpr('baillement', 18);  // 18 frames ≈ 1.5 sec à 12fps
    }
  } else if (isSleeping) {
    window._idleFrames = 0; // reset au réveil
  }
}

// RÔLE : Scheduler de micro-expressions spontanées de la bouche (teen + adult uniquement).
// POURQUOI : Donne l'impression que le Gotchi vit entre les interactions.
//            Même mécanique que le scheduler de poses bras (_adultPose/_teenPose),
//            mais décalé (~300f de base) pour que bouche et bras ne changent pas en même temps.
//
//            Fréquence : cooldown 180–360f aléatoire (~15–30 sec à 12fps).
//            Expressions possibles selon haReal :
//              ha ≤ 3 : 1/3 sourire, 1/3 surprise, 1/3 neutre (rien)
//              ha = 4 : 1/2 sourire, 1/4 surprise, 1/4 neutre
//              ha = 5 : 7/10 sourire, 2/10 joie, 1/10 surprise
//            Durée : 6–10 frames (≈ 0.5–0.8 sec) — flicker discret, pas intrusif.
//            Guards : uniquement si le Gotchi est éveillé, non endormi, et qu'aucune
//            expression n'est déjà active (on ne coupe pas un bâillement ou une joie déclenchée).
{
  const g = window.D?.g;
  const stage = g?.stage;
  // RÔLE : Ne s'applique qu'au teen et à l'adulte.
  if (stage === 'teen' || stage === 'adult') {
    const h = typeof hr === 'function' ? hr() : new Date().getHours();
    const isSleeping = g && ((h === 23 && new Date().getMinutes() >= 30) || h < 7);
    // RÔLE : On ne déclenche pas si une expression est déjà en cours (bâillement, joie, etc.)
    const noExprActive = !window._expr || window._expr.moodTimer === 0;

    if (!isSleeping && noExprActive) {
      // Décrémenter le cooldown chaque frame
      window._mouthSched.cooldown--;

      if (window._mouthSched.cooldown <= 0) {
        // RÔLE : Tirer une expression au sort selon le bonheur réel (haReal = entier).
        // POURQUOI : haReal (pas ha le float lerp) — les seuils exacts 4 et 5 doivent être atteints.
        const haR = g.happiness;
        const roll = Math.random(); // 0 → 1
        let mood = null;
        // RÔLE : Durée plus longue pour être clairement visible — 14–22 frames ≈ 1–2 sec.
        // POURQUOI : 6–10f était trop discret pour remarquer le changement.
        let dur = 14 + Math.floor(Math.random() * 9); // 14–22 frames ≈ 1.2–1.8 sec

        if (haR >= 5) {
          // ha = 5 : très souvent sourire, parfois joie
          if      (roll < 0.70) mood = 'sourire-auto';
          else if (roll < 0.90) mood = 'joie';
          else                  mood = 'surprise';
        } else if (haR >= 4) {
          // ha = 4 : souvent sourire
          if      (roll < 0.50) mood = 'sourire-auto';
          else if (roll < 0.75) mood = 'surprise';
          // else → 25% rien
        } else {
          // ha ≤ 3 : mix équilibré
          if      (roll < 0.33) mood = 'sourire-auto';
          else if (roll < 0.66) mood = 'surprise';
          // else → 34% rien
        }

        // RÔLE : Déclencher l'expression si une a été tirée.
        if (mood) window.triggerExpr(mood, dur);

        // RÔLE : Remettre un cooldown plus court pour des changements plus fréquents.
        // POURQUOI : 60–150f ≈ 5–12 sec — assez fréquent pour être perceptible,
        //            assez espacé pour rester naturel et non mécanique.
        window._mouthSched.cooldown = 60 + Math.floor(Math.random() * 90);
      }
    } else if (isSleeping) {
      // RÔLE : Reset au réveil pour ne pas partir avec un cooldown trop court.
      window._mouthSched.cooldown = 300;
    }
  }
}

// RÔLE : Déclencheur frisson automatique par froid extérieur.
// POURQUOI : Si la météo indique < 5°C et que le Gotchi est éveillé, il frissonne
//            visuellement toutes les ~60 frames (≈5 sec à 12fps) avec cooldown.
//            Le frisson est aussi déclenché par la pluie froide (code météo ≥ 61).
{
  const g = window.D?.g;
  const h = typeof hr === 'function' ? hr() : new Date().getHours();
  const isSleeping = g && (h >= 22 || h < 7);
  const temp = window.meteoData?.temperature;
  const wcode = window.meteoData?.weathercode;
  const isCold = typeof temp === 'number' && temp < 5;
  const isRainingCold = typeof wcode === 'number' && wcode >= 61 && typeof temp === 'number' && temp < 10;
  window._frissonCooldown = (window._frissonCooldown || 0);
  if (!isSleeping && (isCold || isRainingCold)) {
    window._frissonCooldown--;
    if (window._frissonCooldown <= 0) {
      window._frissonCooldown = 72; // ~6 sec à 12fps avant le prochain frisson
      window.animator?.trigger('frisson');
    }
  } else {
    // Hors condition froide → on laisse le cooldown diminuer sans déclencher
    if (window._frissonCooldown > 0) window._frissonCooldown--;
  }
}

    while (window.celebQueue.length) {
      window.celebQueue.shift();
      for (let i = 0; i < 15; i++) {
        spawnP(cx + (Math.random() - .5) * 40, by - 10, C.rainbow[Math.floor(Math.random() * C.rainbow.length)]);
      }
      bounceT = Math.PI * 1.5;
    }

    // ── Flash thématique de transition d'environnement (~24 frames ≈ 0,4s) ──
    // RÔLE : Couvre env + props + Gotchi + premier plan — masque le cut brutal du décor.
    //        Montée rapide (0 → pic à la frame 8), descente douce jusqu'à la frame 24.
    // POURQUOI ici (après celebQueue, avant overlay nuit) : le flash doit être au-dessus
    //        de TOUS les éléments de scène (décor, objets, Gotchi, particules) mais
    //        sous l'overlay nuit et sous le HUD — qui s'affichent par-dessus.
    //        Ancienne position : après drawActiveEnv seulement → les props passaient
    //        par-dessus le flash. Corrigé ici.
    if (window._envFadeState) {
      const fs = window._envFadeState;

      // RÔLE : Cloche asymétrique — montée en 8f, descente en 16f.
      // POURQUOI : La montée rapide "coupe" l'ancien décor franchement ;
      //            la descente lente laisse le nouveau apparaître progressivement.
      let flashAlpha;
      if (fs.frames <= 8) {
        flashAlpha = fs.frames / 8;           // 0 → 1 sur les 8 premières frames
      } else {
        flashAlpha = 1 - (fs.frames - 8) / 16; // 1 → 0 sur les 16 frames restantes
      }

      // RÔLE : Couleur de destination, blanc par défaut si env inconnu.
      const flashCol = ENV_FLASH_COLOR[fs.to] || '#ffffff';

      // RÔLE : Décompose le hex en r/g/b pour construire un rgba() avec opacité dynamique.
      const _fr = parseInt(flashCol.slice(1, 3), 16);
      const _fg = parseInt(flashCol.slice(3, 5), 16);
      const _fb = parseInt(flashCol.slice(5, 7), 16);

      // RÔLE : Recouvre tout le canvas d'une teinte translucide.
      p.noStroke();
      p.fill(`rgba(${_fr},${_fg},${_fb},${flashAlpha.toFixed(3)})`);
      p.rect(0, 0, CS, CS);
    }

    // Surcouche nuit — couvre env, props, Gotchi.
    // POURQUOI : Dessinée AVANT le HUD → le HUD est rendu par-dessus et reste lumineux.
    //            (L'overlay ne "cache" pas le HUD : il est simplement dessiné après lui.)
    if (darkAlpha > 0) {
      p.noStroke();
      p.fill(0, 0, 0, darkAlpha);
      p.rect(0, 0, p.width, p.height);
    }

    // 12–14. HUD, Badges, Sélecteur d'environnement
    // RÔLE : Masqués en mode compact (tama réduit sur les onglets secondaires).
    // POURQUOI : En mode compact, le canvas est réduit à ~110px de large — le HUD et les
    //            badges n'ont plus assez de place et visuellement ils ne servent à rien
    //            puisque l'utilisatrice n'est pas sur l'onglet Gotchi.
    const isCompact       = document.getElementById('console-top')?.classList.contains('compact');
    // RÔLE : Masque aussi le HUD en mode jardin plein écran — on veut le canvas nu.
    // POURQUOI : body.garden-fullscreen est posé par openCanvasFullscreen() dans ui-nav.js.
    //            On vérifie document.body plutôt que #canvas-fs-overlay pour rester
    //            synchrone avec la frame p5 courante (l'overlay peut ne pas être encore injecté
    //            lors du premier draw post-ouverture).
    const isGardenFullscreen = document.body.classList.contains('garden-fullscreen');
    if (!isCompact && !isGardenFullscreen) {
      drawHUD(p, g, h);              // 12. Bandeau pétales / actions / météo
      drawBadges(p, g);              // 13. Capsules ⚡/✿ + zone de hit badges
      drawEnvSelector(p, g, n);     // 14. Cercle env actif + cercles flottants
    } else {
      // Mode compact ou jardin plein écran : désactiver la zone de tap des badges
      window._badgeHitZone = null;
    } // ← fin if (!isCompact && !isGardenFullscreen)

  }; // ← fin p.draw()

  // Vérifie si un overlay actif bloque les interactions canvas
function isOverlayActive() {
  const modal = document.getElementById('modal');
  const toast = document.getElementById('toast'); // adapte l'ID si besoin
  const modalVisible = modal && modal.style.display !== 'none';
  const toastVisible = toast && toast.style.display !== 'none';
  return modalVisible || toastVisible;
}

  // 13. Gestionnaire d'événements tactiles (Garde l'accès à "p.")
    p.touchStarted = function() {
    // 🔒 GARDE 0 : tap hors du canvas → laisser le DOM gérer (ex : #hdr-title, boutons header)
    // RÔLE : p5.js attache ses listeners touchstart sur le document entier, pas sur le canvas.
    //        Un tap sur #hdr-title déclenche donc touchStarted, qui empêche le onclick de se déclencher.
    //        On vérifie que le tap est bien dans les bounds du canvas avant d'aller plus loin.
    // POURQUOI : Résout le bug "tap sur le titre n'ouvre pas l'agenda".
    {
      // 🔒 GARDE 0a : mode plein écran jardin → toujours rendre la main au DOM
      // POURQUOI : En garden-fullscreen, l'interactivité p5 est désactivée (contemplatif).
      //            Surtout : le bouton ✕ dans .hdr-garden doit pouvoir recevoir les taps
      //            sans être intercepté, même si la recomposition clientX/clientY est approximative.
      if (document.body.classList.contains('garden-fullscreen')) return true;

      const canvasEl = document.querySelector('#cbox canvas');
      if (canvasEl) {
        const rect = canvasEl.getBoundingClientRect();
        const touch = p.touches[0];
        // p.touches[0].x/.y sont en coordonnées canvas (0→CS) — on compare avec les bounds réels
        const clientX = touch ? (rect.left + touch.x * (rect.width  / CS)) : -9999;
        const clientY = touch ? (rect.top  + touch.y * (rect.height / CS)) : -9999;
        const inCanvas = clientX >= rect.left && clientX <= rect.right
                      && clientY >= rect.top  && clientY <= rect.bottom;
        if (!inCanvas) return true; // rend la main au DOM
      }
    }

    // 🔒 GARDE 1 : menu principal ouvert
    const menuOverlay = document.getElementById('menu-overlay');
    if (menuOverlay && menuOverlay.classList.contains('open')) return true;

// 🔒 GARDE 2 : modal OU menu-overlay visibles
const modalEl = document.getElementById('modal');
const menuEl = document.getElementById('menu-overlay');
if (
  (modalEl && getComputedStyle(modalEl).display !== 'none') ||
  (menuEl && menuEl.classList.contains('open'))
) return true;

    // 🔒 GARDE 3 : l'utilisateur est focus sur un champ de saisie
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      return true;
    }
// 🔒 GARDE 4 : hors onglet Gotchi → géré par pointerdown sur .tama-screen (ui.js)
if (!window._gotchiActif) return true;

    // RÔLE : Anti-rebond tactile — ignore les taps répétés trop rapprochés (< 200ms)
    // POURQUOI : Encapsulé dans _tapState pour éviter une variable globale nue
    //            qui pouvait être écrasée accidentellement depuis un autre module.
    if (!window._tapState) window._tapState = { lastTime: 0 };
    const now = Date.now();
    if (now - window._tapState.lastTime < 200) return false;
    window._tapState.lastTime = now;

    const mx = p.touches[0]?.x ?? p.mouseX;
    const my = p.touches[0]?.y ?? p.mouseY;

    // 🌸 Pétales (zone gauche du HUD, x < 50) — bulle contextuelle selon le solde
    if (mx < 50 && my < 26) {
      const petales = window.D?.g?.petales || 0;
      const p1 = petales > 1 ? 's' : '';
      let msgs;
      if (petales === 0) {
        msgs = [
          'Pas encore de pétales… prends soin de moi ! 🌱',
          'Zéro pétale pour l\'instant — on y travaille ! 🌸',
          'Aucun pétale… mais ça peut changer ! 💪',
        ];
      } else if (petales < 10) {
        msgs = [
          `${petales} pétale${p1}, merci de prendre soin de moi 🌸`,
          `${petales} pétale${p1} ! Tu fais du bon boulot ✨`,
          `${petales} pétale${p1} en réserve 🌷`,
        ];
      } else if (petales < 20) {
        msgs = [
          `${petales} pétales… et si tu allais faire un tour à la boutique ? 🛍️`,
          `${petales} pétales ! Il y a des choses sympa en boutique 🌸`,
          `${petales} pétales — tu pourrais m'offrir quelque chose ! ✨`,
        ];
      } else {
        msgs = [
          `${petales} pétales… ça déborde ! Gâte-moi en boutique 🛍️🌸`,
          `Waouh, ${petales} pétales ! Allez, un petit cadeau ? 💜`,
          `${petales} pétales en réserve… la boutique t'attend ! 🛍️✨`,
        ];
      }
      flashBubble(msgs[Math.floor(Math.random() * msgs.length)], 2800);
      return false;
    }

    // 🌡️ Météo (zone droite du HUD, x > CS - 55) — bulle contextuelle selon la météo
    if (mx > CS - 55 && my < 26 && window.meteoData?.temperature !== undefined) {
      const temp  = Math.round(window.meteoData.temperature);
      const wind  = window.meteoData.windspeed || 0;
      const wcode = window.meteoData.weathercode;
      let msgMeteo;
      if (wcode === 45 || wcode === 48) {
        msgMeteo = 'Il y a du brouillard dehors… je reste au chaud 😶‍🌫️';
      } else if (temp <= 0) {
        msgMeteo = `${temp}°C ! Il gèle dehors, je suis bien ici 🥶`;
      } else if (temp < 10) {
        msgMeteo = `Seulement ${temp}°C… couvre-toi bien ! 🧥`;
      } else if (temp < 18) {
        msgMeteo = `${temp}°C, une belle journée fraîche ✨`;
      } else if (temp < 26) {
        msgMeteo = `${temp}°C, c'est agréable dehors ! ☀️`;
      } else if (temp < 33) {
        msgMeteo = `${temp}°C… il fait chaud ! Pense à t'hydrater 💧`;
      } else {
        msgMeteo = `${temp}°C ! Canicule… reste à l'ombre 🥵`;
      }
      if (wind > 20) msgMeteo += ` Et il y a du vent (${Math.round(wind)} km/h) 🌬️`;
      flashBubble(msgMeteo, 3000);
      return false;
    }

    // 🧹 Balai (x=70) — nettoyer les crottes au sol uniquement
    // POURQUOI : le balai = environnement. La saleté sur le gotchi se nettoie en le frottant.
    if (Math.abs(mx - 70) < 14 && my < 26) {
      const poops = window.D?.g?.poops || [];
      if (poops.length > 0) {
        setTimeout(() => cleanPoops(), 0);
      } else {
        // RÔLE : Feedback quand il n'y a rien à ramasser.
        // POURQUOI : Sans message, le tap semble bugué — rien ne se passe.
        const msgsNoCrotte = [
          'Rien à ramasser, c\'est nickel ici ! 🧹',
          'Pas de crotte en vue ! Tout est propre ✨',
          'L\'environnement est impeccable !',
          'Rien à faire, profite ! 🌱',
        ];
        flashBubble(msgsNoCrotte[Math.floor(Math.random() * msgsNoCrotte.length)], 2500);
      }
      return false;
    }

    // 🛁 Bain (x=100) — tap = bulle contextuelle selon l'état de propreté du Gotchi
    if (Math.abs(mx - 100) < 14 && my < 26) {
      const saleteTap = window.D?.g?.salete || 0;
      if (saleteTap >= 2) {
        // RÔLE : Invitation à frotter quand le Gotchi est sale.
        // POURQUOI : L'utilisatrice ne sait pas forcément qu'il faut frotter (glisser le doigt).
        //            Un message dans la bulle rend l'interaction intuitive.
        const msgsSale = [
          'Fais-moi un petit bain ! Frotte-moi doucement 🛁',
          'Je sens un peu... frotte-moi s\'il te plaît ! 🧼',
          'J\'ai besoin d\'un bain… glisse ton doigt sur moi 🫧',
          'Scrub scrub ! Frotte-moi pour me nettoyer ✨',
        ];
        flashBubble(msgsSale[Math.floor(Math.random() * msgsSale.length)], 3000);
        if (typeof window.triggerExpr === 'function') window.triggerExpr('surprise', 40);
      } else {
        // RÔLE : Message de satisfaction quand le Gotchi est déjà propre.
        // POURQUOI : Feedback positif — renforce le soin régulier.
        const msgsPropre = [
          'Je brille de propreté ! ✨',
          'Mmh, quelle bonne odeur ! 🌸',
          'Pas besoin de bain pour l\'instant, c\'est nickel !',
          'Je me sens léger·e et propre ! 💙',
        ];
        flashBubble(msgsPropre[Math.floor(Math.random() * msgsPropre.length)], 2500);
      }
      return false;
    }

    // 🍽️ Assiette (x=130) — ouvrir le snack
    if (Math.abs(mx - 130) < 14 && my < 26) {
      setTimeout(() => ouvrirSnack(), 0); return false;
    }

    // RÔLE : Tap sur les badges énergie/bonheur → ouvre la modale "Comment tu te sens ?"
    // POURQUOI : La zone de hit est calculée dynamiquement dans draw() et stockée dans _badgeHitZone.
    //            On vérifie aussi _gotchiActif pour n'ouvrir la modale que sur l'écran d'accueil.
    const bz = window._badgeHitZone;
    if (bz && mx >= bz.x1 && mx <= bz.x2 && my >= bz.y1 && my <= bz.y2 && window._gotchiActif) {
      setTimeout(() => {
        if (typeof ouvrirModalEtats === 'function') ouvrirModalEtats();
      }, 0);
      return false;
    }

    // ── Sélecteur d'environnement : détection de tap ──────────────────
    // RÔLE : Gère l'ouverture/fermeture du sélecteur et le changement d'env.
    // POURQUOI : Doit être testé AVANT la hitbox Gotchi pour ne pas la confondre.
    {
      const hits = window._envSelectorHits || [];
      let tappedEnvSelector = false;

      for (const zone of hits) {
        const dist = Math.sqrt((mx - zone.cx) ** 2 + (my - zone.cy) ** 2);
        if (dist <= zone.r + 4) { // +4px de tolérance tactile
          tappedEnvSelector = true;

          if (zone.env === '__main__') {
            // RÔLE : Tap sur le cercle principal → ouvre si env disponible, bulle si verrouillé.
            // POURQUOI : On utilise window._envLocked (calculé dans draw() via nightRatio)
            //            plutôt que h >= 22, pour être cohérent avec le vrai seuil de verrouillage (21h).
            if (!window._envLocked) {
              window._envSelectorOpen = !window._envSelectorOpen; // toggle ouvert/fermé
            } else {
              // RÔLE : Bulle contextuelle quand le sélecteur est verrouillé (nuit, dès 21h).
              // POURQUOI : Sans message, le 💤 semble figé ou bugué. La bulle explique pourquoi
              //            l'env ne peut pas changer et donne vie au Gotchi même la nuit.
              const msgsNuit = [
                'Je suis dans ma chambre pour la nuit… 💤',
                'Chut ! Je dors bientôt… 🌙',
                'On changera d\'endroit demain matin ! 😴',
                'C\'est l\'heure du dodo, on reste ici 🛏️',
              ];
              flashBubble(msgsNuit[Math.floor(Math.random() * msgsNuit.length)], 2500);
            }

          } else {
            // RÔLE : Tap sur un cercle flottant → change d'env, referme le sélecteur, déclenche le fondu.
            const prevEnv = window.D.g.activeEnv || 'parc';
            window._envFadeState = { from: prevEnv, to: zone.env, frames: 0 };
            if (typeof changeEnv === 'function') changeEnv(zone.env);
            window._envSelectorOpen = false;

            // RÔLE : Flashbubble contextuel quand l'utilisateur change d'env depuis l'accueil (tama).
            // POURQUOI : Chaque destination a son pool distinct dans personality.bulles.changeEnv.
            //            Ne se déclenche que si l'env change réellement — évite une bulle inutile
            //            si on tape deux fois la même destination.
            if (zone.env !== prevEnv) {
              const pools = window.PERSONALITY?.bulles?.changeEnv
                         || window.USER_CONFIG?.personality?.bulles?.changeEnv;
              const msgs  = pools?.[zone.env];
              if (msgs?.length) flashBubble(msgs[Math.floor(Math.random() * msgs.length)], 2500);
            }
          }
          break; // un seul hit traité par tap
        }
      }

      if (!tappedEnvSelector && window._envSelectorOpen) {
        // RÔLE : Tap ailleurs sur le canvas → referme le sélecteur automatiquement.
        // POURQUOI : Comportement attendu — on ne laisse pas le menu flotter indéfiniment.
        window._envSelectorOpen = false;
      }

      // Si on a touché le sélecteur (principal ou flottant), on stoppe la propagation
      if (tappedEnvSelector) return false;
    }
    // ── Fin sélecteur d'environnement ─────────────────────────────────

    const h = hr();
    // Position du Gotchi à l'écran = by + bobY (le bobY contient déjà GOTCHI_OFFSET_Y)
    // On recalcule donc by seul, SANS ajouter OFFSET_Y (il est déjà dans bobY côté rendu).
    // Puis on centre la hitbox sur le CORPS entier du Gotchi, pas juste la tête.
    const by = getStageBaseY(window.D.g.stage); // RÔLE : Y de base du Gotchi — centralisé dans getStageBaseY()

    // Centre du corps = by + OFFSET_Y (pour compenser le bobY) + centerOffsetY (milieu du corps)
    // Hitbox définie par GOTCHI_HITBOX (constante en haut de fichier)
    const gotchiCenterY = by + GOTCHI_OFFSET_Y + GOTCHI_HITBOX.centerOffsetY;
    const hit = Math.abs(mx - walkX) < GOTCHI_HITBOX.rX && Math.abs(my - gotchiCenterY) < GOTCHI_HITBOX.rY;


    if (hit) {
  window._lastTapX = walkX + (Math.random() - 0.5) * 20;
  // RÔLE : Calcule les trois états horaires pour le tap.
  // sleeping = dort vraiment (23h30–7h) | soirTardif = chambre mais éveillé (22h30–23h29)
  const _tapMins     = new Date().getMinutes();
  const _tapSleeping = (h === 23 && _tapMins >= 30) || (h >= 0 && h < 7);
  const _tapSoir     = !_tapSleeping && ((h === 22 && _tapMins >= 30) || h === 23);
  triggerTouchReaction(_tapSleeping, _tapSoir);

  // ✨ Expression faciale selon contexte
  if (typeof window.triggerExpr === 'function') {
    if (_tapSleeping) {
      // Dort vraiment : surprise ensommeillée
      window.triggerExpr('surprise', 50);
    } else if (_tapSoir) {
      // Soir tardif : expression neutre/lasse — pas de joie, pas de choc
      window.triggerExpr('fatigue', 40);
    } else {
      // Le jour : compteur de caresses rapprochées
      window._petCount = (window._petCount || 0) + 1;
      // window._lastPetTime ← SUPPRIMÉ (code mort v4.5) : écrit mais jamais relu nulle part.
      //   Le timing des caresses est géré via _petResetTimer (setTimeout 2s) — Date.now() inutile.

      // Reset du compteur après 2s sans caresse
      clearTimeout(window._petResetTimer);
      window._petResetTimer = setTimeout(() => { window._petCount = 0; }, 2000);
      
      // 1-2 taps : surprise douce | 3+ taps rapprochés : joie
      if (window._petCount >= 3) {
        window.triggerExpr('joie', 80);
      } else {
        window.triggerExpr('surprise', 35);
      }
    }
  }
  
  return false;
}
  };

  // ─── Frottement prolongé pour nettoyer le Gotchi (touchMoved) ───
  // RÔLE : Détecte un geste de frottement continu sur le Gotchi et décrémente sa saleté.
  // POURQUOI : Le nettoyage est progressif — il faut frotter pendant ~2 secondes par point de saleté.
  //            On utilise un timer interne (_scrubTimer) pour n'enlever 1 point que toutes les 500ms.
  p.touchMoved = function() {
    // Gardes : mêmes conditions que touchStarted
    if (!window._gotchiActif) return true;
    const modalEl = document.getElementById('modal');
    if (modalEl && getComputedStyle(modalEl).display !== 'none') return true;

    const salete = window.D?.g?.salete || 0;
    if (salete < 2) return true; // Rien à nettoyer — seuil aligné sur le seuil d'affichage du dithering

    const mx = p.touches[0]?.x ?? p.mouseX;
    const my = p.touches[0]?.y ?? p.mouseY;

    // Recalcule la hitbox Gotchi (même logique que touchStarted)
    const by = getStageBaseY(window.D.g.stage); // RÔLE : Y de base du Gotchi — centralisé dans getStageBaseY()
    const gotchiCenterY = by + GOTCHI_OFFSET_Y + 30;
    const hit = Math.abs(mx - walkX) < 26 && Math.abs(my - gotchiCenterY) < 35;

    if (!hit) {
      // Doigt sorti de la zone → on arrête le frottement
      clearInterval(window._scrubTimer);
      window._scrubTimer = null;
      return true;
    }

    // RÔLE : Démarrer le timer de frottement si ce n'est pas déjà fait.
    // POURQUOI : touchMoved est appelé à chaque frame de mouvement — on ne veut pas
    //            créer des dizaines de timers. Un seul est actif à la fois.
    if (!window._scrubTimer) {
      window._scrubTimer = setInterval(() => {
        const D = window.D;
        if (!D?.g || D.g.salete < 1) {
          clearInterval(window._scrubTimer);
          window._scrubTimer = null;
          return;
        }

        // Décrémente de 1 point de saleté
        D.g.salete = Math.max(0, D.g.salete - 1);

        // RÔLE : Bulles de savon — plus nombreuses et de tailles variées pour un effet vivant.
        // POURQUOI : 12 bulles (vs 5 avant) + taille r: PX*2 pour ~60% d'entre elles.
        //            Mélange grandes (10px) + petites (5px) = aspect mousse réaliste.
        //            Zone ±40px large pour couvrir tout le corps du Gotchi.
        for (let i = 0; i < 12; i++) {
          const isBig = Math.random() < 0.6;
          window.particles.push({
            x: walkX + (Math.random() - 0.5) * 40,
            y: by + GOTCHI_OFFSET_Y + (Math.random() * 50),
            vx: (Math.random() - 0.5) * 2.5,
            vy: -Math.random() * 2.5 - 0.8,  // monte doucement comme de la mousse
            life: isBig ? 22 : 14,            // les grandes bulles durent plus longtemps
            r: isBig ? PX * 2 : PX,           // grande bulle = 10px, petite = 5px
            c: Math.random() < 0.55 ? '#88c8e8' : Math.random() < 0.5 ? '#ffffff' : '#b8e8ff'
          });
        }

        // Expression surprise à chaque point retiré
        if (typeof window.triggerExpr === 'function') {
          window.triggerExpr('surprise', 30);
        }

        // RÔLE : Messages de progression pendant le frottement (toutes les 3 unités de saleté).
        // POURQUOI : Un message à chaque tick (500ms) serait trop fréquent — on espace à ~3 points
        //            pour que la bulle reste lisible sans spammer.
        if (D.g.salete % 3 === 0 && D.g.salete > 0) {
          const msgsEnCours = [
            'Aaaah, ça fait du bien ! 🧼',
            'Ooooh continue ! 🫧',
            'Scrub scrub scrub… 🛁',
            'Hmm, c\'est agréable !',
            'Encore un peu… ✨',
          ];
          flashBubble(msgsEnCours[Math.floor(Math.random() * msgsEnCours.length)], 1800);
        }

        // RÔLE : Récompense finale quand le Gotchi est parfaitement propre.
        // POURQUOI : Renforce le comportement : nettoyer = gratification (pétales + event).
        if (D.g.salete === 0) {
          D.g.petales = (D.g.petales || 0) + 2;
          if (typeof addEvent === 'function') {
            addEvent({ type: 'soin', subtype: 'bain', valeur: 2, label: 'Bain donné — +2 🌸' });
          }
          clearInterval(window._scrubTimer);
          window._scrubTimer = null;

          // Particules de célébration (étoiles dorées)
          for (let i = 0; i < 10; i++) {
            spawnP(
              walkX + (Math.random() - 0.5) * 40,
              gotchiCenterY + (Math.random() - 0.5) * 30,
              C.star
            );
          }

          // RÔLE : Message de soulagement/joie à la fin du bain.
          // POURQUOI : Clôture l'interaction avec une récompense émotionnelle claire.
          const msgsClean = [
            'Je me sens tellement mieux ! Merci 🌸',
            'Tout propre ! Je brille de l\'intérieur ✨',
            'Aaaaah ! Un vrai bonheur 🛁💙',
            'Mmh, je sens si bon maintenant ! 🌸',
          ];
          flashBubble(msgsClean[Math.floor(Math.random() * msgsClean.length)], 3000);

          // RÔLE : Frisson post-bain — le Gotchi vient d'être frotté avec de l'eau froide.
          // POURQUOI : Réaction physique réaliste et amusante qui donne du feedback visuel
          //            à la fin du bain. Déclenché une fois, immédiatement après propre.
          window.animator?.trigger('frisson');
        }

        save();
      }, 500); // 1 point de saleté retiré toutes les 500ms
    }

    return false; // empêche le scroll de la page pendant le frottement
  };

  // RÔLE : Nettoie le timer de frottement quand le doigt est levé.
  // POURQUOI : Sans ça, le timer continuerait à tourner en arrière-plan.
  p.touchEnded = function() {
    clearInterval(window._scrubTimer);
    window._scrubTimer = null;
    return true;
  };

}; // ← fin p5s

// DÉMARRAGE DE L'INSTANCE P5
new p5(p5s);
