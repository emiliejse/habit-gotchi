/* ============================================================
   js/games/ui-cristaux.js — Mini-jeu "Tri de Cristaux"
   RÔLE : Contient toute la logique du jeu Tri de Cristaux.
          L'utilisatrice glisse des cristaux qui tombent vers
          la zone colorée correspondante. 2 minutes, vagues
          progressives, meilleur score en localStorage.

   Dépend de : ui-game.js  (lancerCristaux, retourGameHub, window._cristalSketch)
               p5.js        (mode instance — new p5(sketch, container))
               app.js       (window.D.habits, window.D.log, window.meteoData — lecture seule)

   Convention d'interface avec ui-game.js :
     - window._demarrerCristaux(container) : point d'entrée appelé par lancerCristaux()
     - window._cristalSketch               : instance p5 active (ou null)
     - Score sauvegardé dans localStorage, clé : hg_game_crystals_best

   Ordre de chargement : après ui-game.js, avant ui-nav.js
   ============================================================ */

/* ─── CONSTANTES DU JEU ─────────────────────────────────────── */
// POURQUOI : définies au niveau module (pas dans la fonction) — immuables,
//            partagées entre _demarrerCristaux et les helpers de boutons.

// RÔLE : Durée par défaut — utilisée uniquement si _demarrerCristaux() est appelé
//         sans argument (cas défensif). La durée réelle est passée depuis ui-game.js
//         via _cx_demarrerAvecDuree() → _demarrerCristaux(container, dureeMs).
const _CX_DUREE_MS_DEFAUT = 120_000; // 2 minutes (fallback)
const _CX_TAILLE_VAGUE    = 9;       // cristaux par vague (était 7)
const _CX_VITESSE_INIT    = 2.2;     // px/frame au départ
const _CX_VITESSE_MAX     = 8;       // plafond vitesse
const _CX_FACTEUR_VIT     = 1.15;    // multiplicateur de vitesse par vague
const _CX_SPAWN_INIT_MS   = 1400;    // intervalle spawn vague 1 (ms)
const _CX_SPAWN_MIN_MS    = 600;     // plancher intervalle spawn (ms)
const _CX_FACTEUR_SPAWN   = 0.88;    // réduction de l'intervalle par vague
const _CX_HAUTEUR_ZONES   = 70;      // px — hauteur des zones de tri (était 60 — plus visibles)
const _CX_HITBOX          = 40;      // px — rayon de la hitbox tactile (Manhattan)
const _CX_FLASH_ZONE      = 18;      // frames du flash de validation (était 8 — bien plus visible)
const _CX_FLASH_PERDU     = 22;      // frames du flash rouge cristal perdu (était 2 — imperceptible)
const _CX_PAUSE_VAGUE_MS  = 700;     // pause entre deux vagues (était 1500ms — beaucoup plus court)
const _CX_SCALE_ACTIF     = 1.15;    // agrandissement du cristal glissé (feedback tactile)

// ── Types de cristaux ────────────────────────────────────────
// POURQUOI : tableau ordonné — l'index détermine la zone de tri (zone 0 = violet, etc.)
//
// PATTERN CSS VARIABLES → p5 :
//   p5 ne lit pas les variables CSS nativement (pas d'accès au CSSOM dans le sketch).
//   On lit les variables via getComputedStyle(document.documentElement) au moment
//   de setup() et on surcharge les couleurs hardcodées si les variables existent.
//   Les couleurs ci-dessous sont les valeurs de fallback utilisées si les variables
//   CSS ne sont pas définies (environnement sans style.css chargé, tests, etc.).
const _CX_TYPES_BASE = [
  { id: 'violet', couleur: '#b090d0', cssVar: '--cx-violet', label: 'violet' },
  { id: 'rose',   couleur: '#f0a0c0', cssVar: '--cx-rose',   label: 'rose'   },
  { id: 'bleu',   couleur: '#90c0f0', cssVar: '--cx-bleu',   label: 'bleu'   },
  { id: 'vert',   couleur: '#90d0b0', cssVar: '--cx-vert',   label: 'vert'   },
];
const _CX_TYPE_DORE = { id: 'dore', couleur: '#f0d060', cssVar: '--cx-dore', label: 'doré' };

// RÔLE : Durée de la session courante — fixée par _demarrerCristaux(container, dureeMs)
//         avant chaque lancement. Lue par le sketch p5 dans draw() et _cx_terminerPartie().
// POURQUOI variable module et non paramètre du sketch : p5 mode instance ne permet pas
//           de passer des arguments directement à la fonction sketch — on passe par
//           une variable module accessible en closure.
let _cxDureeSession = _CX_DUREE_MS_DEFAUT;

/* ─── POINT D'ENTRÉE ─────────────────────────────────────────── */

/**
 * RÔLE : Point d'entrée du jeu — appelé par lancerCristaux() dans ui-game.js.
 * POURQUOI _demarrerCristaux et non lancerCristaux directement :
 *   ui-game.js reste coordinateur (swap hub↔canvas, lockScroll, etc.).
 *   Ce fichier contient la logique pure du jeu, indépendante de la navigation.
 *
 * @param {HTMLElement} container — le div #game-canvas-container dans lequel injecter le canvas
 */
/**
 * @param {HTMLElement} container — div #game-canvas-container dans lequel injecter le canvas
 * @param {number} [dureeMs]     — durée de la session en ms (défaut : _CX_DUREE_MS_DEFAUT)
 */
function _demarrerCristaux(container, dureeMs) {
  // ── Guard "double instance" ──────────────────────────────────────────────
  // RÔLE : Nettoyer toute instance précédente avant d'en créer une nouvelle
  // POURQUOI : "Rejouer" appelle _cx_demarrerAvecDuree() qui rappelle _demarrerCristaux() —
  //            sans nettoyage on empilerait des instances p5 et des boutons en doublon.
  //
  // CONFIRMATION NETTOYAGE (sprint 3) :
  //   ✅ window._cristalSketch = null  garanti ici ET dans retourGameHub() ET fermerGameHub()
  //      → toute fermeture de l'overlay (croix ou bouton retour) remet bien null.
  //   ✅ Timer p5.millis() : géré dans la boucle draw() — il s'arrête AUTOMATIQUEMENT
  //      à la destruction de l'instance via p5.remove(). Pas besoin de clearInterval.
  //   ✅ Listener resize : retiré via p.remove() surchargé ci-dessous → pas de fuite mémoire.
  if (window._cristalSketch) {
    window._cristalSketch.remove();
    window._cristalSketch = null;
  }
  if (container) container.innerHTML = '';
  _cx_nettoyerBoutons();

  // RÔLE : Stocker la durée de session choisie pour que le sketch puisse y accéder
  // POURQUOI variable module (pas constante) : la durée change à chaque session selon le choix
  _cxDureeSession = (typeof dureeMs === 'number' && dureeMs > 0)
    ? dureeMs
    : _CX_DUREE_MS_DEFAUT;

  // RÔLE : Créer l'instance p5 en mode instance et l'attacher au container
  // POURQUOI new p5(sketch, container) : mode instance obligatoire (règle skill)
  window._cristalSketch = new p5(_cx_sketch, container);
}

window._demarrerCristaux = _demarrerCristaux;

/* ─── SKETCH P5 ──────────────────────────────────────────────── */

/**
 * RÔLE : Définition complète du sketch p5 (mode instance).
 *        Passé comme premier argument à new p5(sketch, container).
 * POURQUOI fonction nommée (pas anonyme) : plus lisible dans les stack traces.
 *
 * @param {Object} p — instance p5 injectée automatiquement
 */
function _cx_sketch(p) {

  /* ── État du jeu ─────────────────────────────────── */
  // POURQUOI : variables de let (mutables) — réinitialisées à chaque session via setup()
  let cristaux             = [];      // tableau de tous les objets cristal
  let cristalActif         = null;    // cristal en cours de drag (ou null)
  let touchOffsetX         = 0;       // décalage doigt → centre cristal (axe X)
  let touchOffsetY         = 0;       // décalage doigt → centre cristal (axe Y)
  let score                = 0;       // cristaux rangés dans cette session
  let vague                = 1;       // numéro de vague courante (commence à 1)
  let vitesse              = _CX_VITESSE_INIT;
  let spawnInterval        = _CX_SPAWN_INIT_MS;
  let partieTerminee       = false;

  // ── Timers internes (millisecondes p5) ─────────────
  let debutSession         = 0;       // timestamp du début (p.millis())
  let dernierSpawn         = 0;       // timestamp du dernier cristal spawné
  let cristalVague         = 0;       // nb de cristaux spawné dans la vague courante
  let cristalVagueTermines = 0;       // nb de cristaux rangés ou perdus dans la vague
  let enPauseVague         = false;   // true = on est dans la pause inter-vague
  let debutPauseVague      = 0;       // timestamp du début de la pause
  let scintillement        = false;   // true = phase de scintillement inter-vague
  let flashesZone          = {};      // { idZone: framesRestantes } — flash de validation

  // ── Dimensions canvas ──────────────────────────────
  let CW, CH;

  // ── Pool de types disponibles (avec ou sans doré) ──
  let typesDisponibles = [];

  // RÔLE : Référence vers le container DOM — utilisée dans setup() et dans le listener resize
  // POURQUOI : stockée ici (pas dans setup) pour être accessible au listener sans re-querySelector
  let _cxContainer = null;

  // RÔLE : Référence vers le listener resize pour pouvoir le retirer au remove()
  // POURQUOI : évite une fuite mémoire si l'instance p5 est détruite (retourGameHub,
  //            fermerGameHub) mais que le listener continue de s'exécuter sur window
  let _cxResizeListener = null;

  /* ── setup() ────────────────────────────────────── */
  p.setup = function() {
    // RÔLE : Mesurer le container pour adapter le canvas à l'écran réel
    // POURQUOI : le container CSS occupe toute la hauteur disponible de l'overlay —
    //            on lit clientWidth/clientHeight plutôt que d'imposer des valeurs fixes
    _cxContainer = document.getElementById('game-canvas-container');
    CW = (_cxContainer ? _cxContainer.clientWidth  : 0) || 400;
    CH = (_cxContainer ? _cxContainer.clientHeight : 0) || 600;

    const cnv = p.createCanvas(CW, CH);
    cnv.elt.style.display = 'block'; // POURQUOI : évite le gap inline-block sous le canvas

    p.noStroke();
    p.textFont('monospace');

    // ── Lecture des couleurs CSS (pattern CSS variables → p5) ────────────
    // RÔLE : Surcharger les couleurs hardcodées par les variables CSS si elles existent.
    // POURQUOI : p5 ne lit pas les var(--...) nativement. On lit getComputedStyle une
    //            seule fois ici (setup) — pas dans draw() pour ne pas pénaliser les perfs.
    //            Les variables --cx-* peuvent être définies dans style.css pour thématiser
    //            les cristaux. Si elles ne sont pas définies, trim() renvoie '' → fallback.
    const rootStyle = getComputedStyle(document.documentElement);
    _CX_TYPES_BASE.forEach(type => {
      const val = rootStyle.getPropertyValue(type.cssVar).trim();
      if (val) type.couleur = val; // POURQUOI : on mute l'objet — c'est intentionnel (setup unique)
    });
    const valDore = rootStyle.getPropertyValue(_CX_TYPE_DORE.cssVar).trim();
    if (valDore) _CX_TYPE_DORE.couleur = valDore;

    // RÔLE : Construire le pool de types selon les conditions du jeu
    // POURQUOI cristal doré : apparaît uniquement si soleil ET > 50% habitudes cochées
    typesDisponibles = _cx_estDoréDisponible()
      ? [..._CX_TYPES_BASE, _CX_TYPE_DORE]
      : [..._CX_TYPES_BASE];

    // RÔLE : Initialiser les compteurs de flash par zone à 0
    _CX_TYPES_BASE.forEach(t => { flashesZone[t.id] = 0; });
    flashesZone['dore'] = 0;

    debutSession = p.millis();
    dernierSpawn = p.millis();

    // ── Listener resize (orientation portrait ↔ paysage) ────────────────
    // RÔLE : Redimensionner le canvas si l'orientation de l'écran change.
    // POURQUOI : sur iOS, tourner le téléphone change innerWidth/innerHeight —
    //            sans resize le canvas reste à ses dimensions initiales (letterbox).
    _cxResizeListener = function() {
      if (!_cxContainer) return;
      const newW = _cxContainer.clientWidth  || 400;
      const newH = _cxContainer.clientHeight || 600;

      // RÔLE : Recalculer les positions des cristaux en vol proportionnellement
      // POURQUOI : on normalise par l'ancien CW/CH puis on multiplie par le nouveau —
      //            les cristaux restent aux mêmes positions relatives sur le canvas
      if (CW > 0 && CH > 0) {
        const ratioX = newW / CW;
        const ratioY = newH / CH;
        cristaux.forEach(c => {
          c.x = c.x * ratioX;
          c.y = c.y * ratioY;
        });
      }

      CW = newW;
      CH = newH;
      p.resizeCanvas(CW, CH); // RÔLE : adapter le canvas p5 aux nouvelles dimensions
    };
    window.addEventListener('resize', _cxResizeListener);
  };

  // RÔLE : Nettoyer le listener resize quand l'instance p5 est détruite
  // POURQUOI : p5 appelle remove() → p.remove est déclenché → on retire le listener —
  //            sans ça le listener continuerait à s'exécuter sur l'ancien CW/CH figé
  p.remove = (function(originalRemove) {
    return function() {
      if (_cxResizeListener) {
        window.removeEventListener('resize', _cxResizeListener);
        _cxResizeListener = null;
      }
      if (originalRemove) originalRemove.call(p); // POURQUOI : chaîner le remove natif p5
    };
  })(p.remove);

  /* ── draw() ─────────────────────────────────────── */
  p.draw = function() {
    // RÔLE : Ne rien faire si la partie est terminée — l'écran de fin reste figé
    if (partieTerminee) return;

    const maintenant   = p.millis();
    const tempsEcoule  = maintenant - debutSession;

    // ── Fin de session : timer 2 minutes ─────────────
    if (tempsEcoule >= _cxDureeSession) {
      _cx_terminerPartie();
      return;
    }

    // ── Fond dégradé ──────────────────────────────────
    _cx_dessinerFond();

    // ── Zones de tri ───────────────────────────────────
    _cx_dessinerZones();

    // ── Gestion des vagues ─────────────────────────────
    if (!enPauseVague) {
      // RÔLE : Spawner un cristal si l'intervalle est écoulé et la vague pas complète
      if (cristalVague < _CX_TAILLE_VAGUE && maintenant - dernierSpawn >= spawnInterval) {
        _cx_spawnerCristal();
        dernierSpawn = maintenant;
        cristalVague++;
      }

      // RÔLE : Tous les cristaux de la vague sont traités → pause inter-vague
      if (cristalVague >= _CX_TAILLE_VAGUE && cristalVagueTermines >= _CX_TAILLE_VAGUE) {
        enPauseVague    = true;
        scintillement   = true;
        debutPauseVague = maintenant;
      }
    } else {
      // ── Phase de pause inter-vague ────────────────
      const ecoulePause = maintenant - debutPauseVague;
      // RÔLE : Scintillement : alterner l'opacité des cristaux en vol (effet "clignotement")
      // POURQUOI : signal visuel que la vague est terminée et qu'une nouvelle arrive
      scintillement = ecoulePause < (_CX_PAUSE_VAGUE_MS * 0.5) && (p.frameCount % 6) < 3;

      // RÔLE : Lancer la vague suivante après la pause
      if (ecoulePause >= _CX_PAUSE_VAGUE_MS) {
        _cx_demarrerVagueSuivante();
      }
    }

    // ── Mise à jour et dessin des cristaux ─────────────
    _cx_mettreAJourCristaux();

    // ── HUD (timer + score + vague) ────────────────────
    _cx_dessinerHUD(tempsEcoule);
  };

  /* ── Fond dégradé ────────────────────────────────── */
  // RÔLE : Dégradé du haut (clair) vers le bas (sombre) — pas de background blanc plat
  // POURQUOI : donne de la profondeur à la scène sans alourdir le rendu
  function _cx_dessinerFond() {
    const hFond = CH - _CX_HAUTEUR_ZONES;
    for (let y = 0; y < hFond; y++) {
      const ratio = y / hFond;
      p.stroke(
        p.lerp(240, 210, ratio),
        p.lerp(235, 205, ratio),
        p.lerp(255, 230, ratio)
      );
      p.line(0, y, CW, y);
    }
    p.noStroke();
    // RÔLE : Fond uni plus sombre pour la zone des bacs de tri
    p.fill(195, 185, 220);
    p.rect(0, CH - _CX_HAUTEUR_ZONES, CW, _CX_HAUTEUR_ZONES);
  }

  /* ── Zones de tri ────────────────────────────────── */
  // RÔLE : 4 bandes colorées en bas — une par type de base (le doré est joker, pas de zone dédiée)
  function _cx_dessinerZones() {
    const zoneW = CW / 4;
    const zy    = CH - _CX_HAUTEUR_ZONES;

    _CX_TYPES_BASE.forEach((type, i) => {
      const zx      = i * zoneW;
      const flash   = flashesZone[type.id] > 0;
      // RÔLE : ratio 0→1 pendant la durée du flash — pour animer l'intensité
      const flashRatio = flash ? flashesZone[type.id] / _CX_FLASH_ZONE : 0;

      // ── Fond de zone ─────────────────────────────────
      // RÔLE : Au repos = 80/255 (≈30%, bien lisible). En flash = 220/255 (≈86%, très vif).
      // POURQUOI : l'ancien 38/255 était trop discret — les zones devaient être immédiatement
      //            identifiables même sans flash.
      const col = p.color(type.couleur);
      col.setAlpha(flash ? p.lerp(160, 220, flashRatio) : 80);
      p.fill(col);
      p.noStroke();
      p.rect(zx, zy, zoneW, _CX_HAUTEUR_ZONES);

      // ── Bordure supérieure de la zone ────────────────
      // RÔLE : Trait plein épais au repos, encore plus épais en flash
      p.stroke(type.couleur);
      p.strokeWeight(flash ? 4 : 2);
      p.line(zx, zy, zx + zoneW, zy);

      // RÔLE : Séparateurs verticaux entre les zones (sauf bord gauche)
      p.strokeWeight(1);
      if (i > 0) p.line(zx, zy, zx, CH);
      p.noStroke();

      // ── Halo de flash (anneau lumineux sur toute la zone) ─
      // RÔLE : Quand un cristal est bien rangé, la zone s'illumine d'un halo blanc
      // POURQUOI : rend le feedback de validation immédiat et satisfaisant
      if (flash) {
        const halo = p.color(255, 255, 255);
        halo.setAlpha(flashRatio * 60); // halo blanc léger qui s'estompe
        p.fill(halo);
        p.rect(zx, zy, zoneW, _CX_HAUTEUR_ZONES);
      }

      // RÔLE : Décrémenter le flash de cette zone d'une frame
      if (flash) flashesZone[type.id]--;

      // ── Étiquette de couleur ──────────────────────────
      // RÔLE : Nom de la couleur centré dans la zone — plus grand et en gras lors du flash
      p.fill(flash ? '#fff' : type.couleur);
      p.textSize(flash ? 14 : 11); // POURQUOI : plus lisible au repos (était 10) et mise en valeur au flash
      p.textAlign(p.CENTER, p.CENTER);
      p.text(type.label, zx + zoneW / 2, zy + _CX_HAUTEUR_ZONES / 2);
    });
    p.noStroke();
  }

  /* ── Spawn d'un cristal ──────────────────────────── */
  // RÔLE : Créer un nouveau cristal en haut du canvas avec un type aléatoire
  function _cx_spawnerCristal() {
    const type   = typesDisponibles[Math.floor(p.random(typesDisponibles.length))];
    const taille = 20; // demi-taille du losange (px canvas)
    cristaux.push({
      id:         Date.now() + Math.random(), // identifiant unique (pour debug)
      type:       type,
      x:          p.random(taille + 10, CW - taille - 10), // position X aléatoire
      y:          -taille,                                   // hors écran en haut
      vy:         vitesse,                                   // vitesse de chute initiale
      taille:     taille,
      actif:      false,    // true = en cours de drag par le doigt
      range:      false,    // true = rangé avec succès dans sa zone
      perdu:      false,    // true = sorti par le bas sans être rangé
      flashBlanc: 0,        // frames restantes du flash blanc (cristal perdu)
    });
  }

  /* ── Mise à jour + dessin de tous les cristaux ───── */
  function _cx_mettreAJourCristaux() {
    const aSupprimer = []; // indices des cristaux à supprimer à la fin du tour

    cristaux.forEach((c, idx) => {

      // ── Cristal perdu — animation rouge + chute rapide puis suppression ──
      if (c.perdu) {
        if (c.flashBlanc > 0) {
          // RÔLE : ratio d'avancement de l'animation (1.0 au début → 0.0 à la fin)
          const t = c.flashBlanc / _CX_FLASH_PERDU;

          // RÔLE : Le cristal continue de tomber rapidement pendant l'animation
          // POURQUOI : renforce le sentiment de "raté" — le cristal s'échappe vers le bas
          c.y += 4;

          // RÔLE : Flash rouge vif qui s'estompe — bien plus lisible que le blanc
          // POURQUOI rouge : couleur universelle d'erreur, contraste fort sur tous les fonds
          p.fill(255, 60, 60, p.lerp(0, 220, t));
          _cx_losange(c.x, c.y, c.taille * p.lerp(0.8, 1.3, t)); // léger agrandissement au début
          c.flashBlanc--;
        } else {
          aSupprimer.push(idx);
          _cx_incTermines(); // RÔLE : comptabiliser comme "traité" pour la fin de vague
        }
        return;
      }

      // ── Cristal rangé — marquer pour suppression ─────
      if (c.range) {
        aSupprimer.push(idx);
        return;
      }

      // ── Mouvement vertical (seulement si pas en drag) ─
      if (!c.actif) {
        // RÔLE : scintillement inter-vague — dessin semi-transparent
        if (scintillement && (p.frameCount % 6) < 3) {
          const colS = p.color(c.type.couleur);
          colS.setAlpha(100);
          p.fill(colS);
          _cx_losange(c.x, c.y, c.taille);
          return; // POURQUOI : on ne fait pas tomber pendant le scintillement
        }
        c.y += c.vy; // RÔLE : chute d'une frame
      }

      // ── Cristal sorti par le bas → flash blanc ────────
      if (c.y - c.taille > CH && !c.actif) {
        c.perdu      = true;
        c.flashBlanc = _CX_FLASH_PERDU;
        return;
      }

      // ── Dessin du cristal ─────────────────────────────
      const echelle = c.actif ? _CX_SCALE_ACTIF : 1; // POURQUOI : agrandi si glissé
      p.fill(c.type.couleur);
      _cx_losange(c.x, c.y, c.taille * echelle);

      // RÔLE : Reflet clair dans le coin supérieur — effet gemme pixel art
      p.fill(255, 255, 255, 80);
      _cx_losangeReflet(c.x, c.y, c.taille * echelle);
    });

    // RÔLE : Supprimer les cristaux traités en partant de la fin pour ne pas décaler les index
    for (let i = aSupprimer.length - 1; i >= 0; i--) {
      cristaux.splice(aSupprimer[i], 1);
    }
  }

  /* ── Dessin d'un losange (forme cristal) ─────────── */
  // RÔLE : Dessiner un losange centré en (cx, cy) avec demi-taille `taille`
  function _cx_losange(cx, cy, taille) {
    p.beginShape();
    p.vertex(cx,          cy - taille); // pointe haute
    p.vertex(cx + taille, cy);          // pointe droite
    p.vertex(cx,          cy + taille); // pointe basse
    p.vertex(cx - taille, cy);          // pointe gauche
    p.endShape(p.CLOSE);
  }

  // RÔLE : Petit triangle de reflet dans le quart supérieur-gauche du losange
  // POURQUOI : simule la brillance d'une gemme en pixel art sans shader ni texture
  function _cx_losangeReflet(cx, cy, taille) {
    p.beginShape();
    p.vertex(cx,                  cy - taille);
    p.vertex(cx + taille * 0.35,  cy - taille * 0.2);
    p.vertex(cx - taille * 0.05,  cy - taille * 0.1);
    p.endShape(p.CLOSE);
  }

  /* ── HUD ─────────────────────────────────────────── */
  // RÔLE : Afficher timer, score et numéro de vague dans une barre en haut du canvas
  function _cx_dessinerHUD(tempsEcoule) {
    const restant  = Math.ceil((_cxDureeSession - tempsEcoule) / 1000);
    const minutes  = Math.floor(restant / 60);
    const secondes = String(restant % 60).padStart(2, '0');

    // RÔLE : Fond sombre pour la lisibilité du texte
    p.fill(0, 0, 0, 60);
    p.noStroke();
    p.rect(0, 0, CW, 32);

    p.fill(255);
    p.textSize(13);

    p.textAlign(p.LEFT, p.CENTER);
    p.text(`${minutes}:${secondes}`, 10, 16);

    p.textAlign(p.CENTER, p.CENTER);
    p.text(`Vague ${vague}`, CW / 2, 16);

    p.textAlign(p.RIGHT, p.CENTER);
    p.text(`\u{1F48E} ${score}`, CW - 10, 16); // 💎 en unicode échappé (robustesse encodage)
  }

  /* ── Vague suivante ──────────────────────────────── */
  // RÔLE : Incrementer la vague, accélérer les cristaux, réinitialiser les compteurs
  function _cx_demarrerVagueSuivante() {
    vague++;
    vitesse       = Math.min(vitesse * _CX_FACTEUR_VIT,   _CX_VITESSE_MAX);
    spawnInterval = Math.max(spawnInterval * _CX_FACTEUR_SPAWN, _CX_SPAWN_MIN_MS);
    cristalVague          = 0;
    cristalVagueTermines  = 0;
    enPauseVague          = false;
    scintillement         = false;
    dernierSpawn          = p.millis(); // POURQUOI : reset le chrono de spawn pour la nouvelle vague
    // RÔLE : Mettre à jour la vitesse de tous les cristaux encore en vol
    cristaux.forEach(c => { if (!c.actif) c.vy = vitesse; });
  }

  /* ── Compteur de cristaux terminés ──────────────── */
  // RÔLE : Incrémenter le compteur (rangé OU perdu) pour déclencher la fin de vague
  function _cx_incTermines() {
    cristalVagueTermines++;
  }

  /* ── Vérification de zone ────────────────────────── */
  // RÔLE : Retourne true si le cristal est lâché dans la bonne zone (ou joker doré)
  // POURQUOI : appelé dans touchEnded() — détermine rangement ou reprise de chute
  function _cx_verifierZone(c) {
    const zoneW = CW / 4;
    const zoneY = CH - _CX_HAUTEUR_ZONES;
    if (c.y < zoneY) return false; // POURQUOI : pas encore dans la zone de tri

    const zoneIdx = Math.floor(c.x / zoneW); // index 0–3
    if (zoneIdx < 0 || zoneIdx > 3) return false;

    const typeZone  = _CX_TYPES_BASE[zoneIdx];
    const estDoré   = c.type.id === 'dore';
    const bonneZone = estDoré || c.type.id === typeZone.id;

    if (bonneZone) {
      flashesZone[typeZone.id] = _CX_FLASH_ZONE; // RÔLE : déclencher le flash de validation
      return true;
    }
    return false;
  }

  /* ── touchStarted ────────────────────────────────── */
  // RÔLE : Sélectionner le cristal le plus proche du toucher (hitbox Manhattan ~40px)
  // POURQUOI : un seul cristal actif à la fois — priorité au plus proche du doigt
  p.touchStarted = function() {
    // POURQUOI return true et non false : quand la partie est terminée, les boutons
    // "Rejouer" et "Retour" sont des éléments DOM par-dessus le canvas. Retourner false
    // appellerait preventDefault() et bloquerait leurs événements click. On rend la main
    // au DOM pour que les boutons soient cliquables.
    if (partieTerminee) return true;
    const tx = p.mouseX; // POURQUOI : p5 mappe le premier touch sur mouseX/mouseY
    const ty = p.mouseY;

    let plusProche = null;
    let distMin    = Infinity;

    cristaux.forEach(c => {
      if (c.perdu || c.range) return; // POURQUOI : cristaux traités non sélectionnables
      const dist = Math.abs(tx - c.x) + Math.abs(ty - c.y);
      if (dist < _CX_HITBOX && dist < distMin) {
        distMin    = dist;
        plusProche = c;
      }
    });

    if (plusProche) {
      cristalActif       = plusProche;
      cristalActif.actif = true;
      touchOffsetX       = cristalActif.x - tx; // RÔLE : conserver le décalage initial
      touchOffsetY       = cristalActif.y - ty; //        pour éviter un saut au toucher
    }

    return false; // POURQUOI : empêche le scroll de la page derrière le canvas
  };

  /* ── touchMoved ──────────────────────────────────── */
  // RÔLE : Faire suivre le cristal actif au doigt
  p.touchMoved = function() {
    // POURQUOI return true : même raison que touchStarted — ne pas bloquer le DOM en fin de partie.
    if (partieTerminee || !cristalActif) return true;
    cristalActif.x = p.mouseX + touchOffsetX;
    cristalActif.y = p.mouseY + touchOffsetY;
    return false; // POURQUOI : empêche le scroll
  };

  /* ── touchEnded ──────────────────────────────────── */
  // RÔLE : Relâchement — vérifier la zone, ranger ou relâcher le cristal
  p.touchEnded = function() {
    // POURQUOI return true : même raison que touchStarted — ne pas bloquer le DOM en fin de partie.
    if (partieTerminee || !cristalActif) return true;

    const c  = cristalActif;
    c.actif  = false;

    if (_cx_verifierZone(c)) {
      // ── Bonne zone → rangé ──────────────────────────
      c.range = true;
      score++;
      _cx_incTermines();
    } else {
      // ── Mauvaise zone ou trop haut → reprend la chute ──
      // POURQUOI : pas de pénalité score — on relâche juste le cristal
      c.vy = vitesse;
    }

    cristalActif = null;
    touchOffsetX = 0;
    touchOffsetY = 0;

    return false;
  };

  /* ── Terminer la partie ──────────────────────────── */
  // RÔLE : Fin du timer — figer le jeu, afficher les résultats, sauvegarder le best score
  function _cx_terminerPartie() {
    partieTerminee = true;
    cristaux       = []; // RÔLE : nettoyer les cristaux en vol

    // ── Fond sombre semi-transparent ─────────────────
    p.fill(0, 0, 0, 160);
    p.rect(0, 0, CW, CH);

    // ── Meilleur score ────────────────────────────────
    // RÔLE : Lire l'ancien best et mettre à jour si le score actuel est meilleur
    const bestAvant     = parseInt(localStorage.getItem('hg_game_crystals_best') || '0', 10);
    const nouveauRecord = score > bestAvant;
    if (nouveauRecord) {
      localStorage.setItem('hg_game_crystals_best', String(score));
    }
    const bestAfin = nouveauRecord ? score : bestAvant;

    // ── Textes résultats ──────────────────────────────
    p.textAlign(p.CENTER, p.CENTER);

    // Titre
    p.fill(255, 220, 80);
    p.textSize(22);
    p.text('Fin de session !', CW / 2, CH / 2 - 90);

    // Score principal
    p.fill(255);
    p.textSize(36);
    p.text(`\u{1F48E} ${score}`, CW / 2, CH / 2 - 45);

    // Sous-titre
    p.textSize(13);
    p.fill(200, 200, 255);
    p.text(`cristaux rangés — vague ${vague}`, CW / 2, CH / 2 - 5);

    // Meilleur score
    p.fill(180, 180, 180);
    p.textSize(12);
    p.text(`Meilleur : ${bestAfin} \u{1F48E}`, CW / 2, CH / 2 + 25);

    // Nouveau record
    if (nouveauRecord) {
      p.fill(255, 220, 80);
      p.textSize(16);
      p.text('✨ Nouveau record !', CW / 2, CH / 2 + 55);
    }

    // ── Boutons HTML par-dessus le canvas ─────────────
    // POURQUOI éléments HTML et non p5 : les éléments p5 ont des comportements
    // tactiles non fiables sur iOS Safari — les boutons HTML sont plus robustes
    _cx_afficherBoutons(score);
  }

} // ── fin du sketch ──────────────────────────────────────────

/* ─── HELPERS BOUTONS FIN DE PARTIE ─────────────────────────── */

/**
 * RÔLE : Injecter les boutons "Rejouer" et "Retour" par-dessus le canvas.
 * POURQUOI : position:absolute dans #game-canvas-container (position:relative) —
 *            le canvas p5 est dessous, les boutons sont cliquables en overlay.
 *
 * @param {number} scoreFinal — score de la session (passé pour potentiel usage futur)
 */
function _cx_afficherBoutons(scoreFinal) {
  _cx_nettoyerBoutons(); // RÔLE : éviter les doublons si appelé plusieurs fois

  const container = document.getElementById('game-canvas-container');
  if (!container) return;

  // RÔLE : S'assurer que le container est en position relative
  // POURQUOI : nécessaire pour que position:absolute des boutons soit relatif au container
  container.style.position = 'relative';

  const wrapper = document.createElement('div');
  wrapper.id = 'cristaux-fin-boutons';
  wrapper.style.cssText = [
    'position:absolute',
    'bottom:80px',
    'left:0',
    'right:0',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'gap:12px',
    'pointer-events:auto',
  ].join(';');

  // ── Région accessible (lecteurs d'écran) ──────────
  // RÔLE : Annoncer le résultat de la partie aux technologies d'assistance.
  // POURQUOI : les textes de fin sont dessinés sur le canvas p5, donc invisibles
  //            pour les lecteurs d'écran. Ce div HTML en texte pur reste dans le DOM
  //            et est annoncé automatiquement grâce à aria-live="polite".
  const bestAfin = parseInt(localStorage.getItem('hg_game_crystals_best') || '0', 10);
  const ariaZone = document.createElement('div');
  ariaZone.setAttribute('aria-live', 'polite'); // POURQUOI polite : annonce après la fin de parole courante
  ariaZone.setAttribute('role', 'status');
  ariaZone.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap';
  // POURQUOI visually-hidden et non display:none : les lecteurs d'écran ignorent display:none
  ariaZone.textContent = `Fin de session. Score : ${scoreFinal} cristaux rangés. Meilleur score : ${bestAfin}.`;
  wrapper.appendChild(ariaZone);

  // ── Bouton Rejouer ────────────────────────────────
  // POURQUOI : appelle lancerCristaux() (ui-game.js) qui refera le swap hub↔canvas
  //            et rappellera _demarrerCristaux() avec une instance p5 fraîche
  const btnRejouer = document.createElement('button');
  btnRejouer.textContent = 'Rejouer';
  btnRejouer.style.cssText = _cx_styleBouton('#b090d0', '#fff');
  btnRejouer.addEventListener('click', function() {
    // RÔLE : Rejouer avec la même durée — pas besoin de repasser par le sélecteur
    // POURQUOI _cx_demarrerAvecDuree et non lancerCristaux :
    //   lancerCristaux() affiche le sélecteur de durée. Ici on veut relancer
    //   directement avec _cxDureeSession (durée de la session qui vient de se terminer).
    if (typeof window._cx_demarrerAvecDuree === 'function') {
      window._cx_demarrerAvecDuree(_cxDureeSession / 1000);
    }
  });

  // ── Bouton Retour ─────────────────────────────────
  // POURQUOI : retourGameHub() (ui-game.js) détruit _cristalSketch et revient au hub
  const btnRetour = document.createElement('button');
  btnRetour.textContent = '← Retour aux jeux'; // ← en unicode pour éviter les encodages
  btnRetour.style.cssText = _cx_styleBouton('rgba(255,255,255,0.15)', '#fff');
  btnRetour.addEventListener('click', function() {
    if (typeof retourGameHub === 'function') retourGameHub();
  });

  wrapper.appendChild(btnRejouer);
  wrapper.appendChild(btnRetour);
  container.appendChild(wrapper);
}

/**
 * RÔLE : Supprimer les boutons de fin de partie s'ils existent.
 * POURQUOI : appelé en début de _demarrerCristaux() et de _cx_afficherBoutons()
 *            pour éviter les doublons lors d'un "Rejouer".
 */
function _cx_nettoyerBoutons() {
  const el = document.getElementById('cristaux-fin-boutons');
  if (el) el.remove();
}

/**
 * RÔLE : Retourner le style CSS inline pour un bouton de fin de partie.
 * POURQUOI : factorisé pour éviter la duplication entre les deux boutons.
 *
 * @param {string} bg           — couleur de fond (hex, rgba, etc.)
 * @param {string} couleurTexte — couleur du texte
 */
function _cx_styleBouton(bg, couleurTexte) {
  return [
    `background:${bg}`,
    `color:${couleurTexte}`,
    'border:2px solid rgba(255,255,255,0.4)',
    'border-radius:24px',
    'padding:12px 32px',
    'font-family:monospace',
    'font-size:15px',
    'cursor:pointer',
    'min-width:180px',
    'touch-action:manipulation', // POURQUOI : empêche le double-tap zoom sur iOS
  ].join(';');
}

/* ─── HELPER : CRISTAL DORÉ ─────────────────────────────────── */

/**
 * RÔLE : Déterminer si le cristal doré peut apparaître dans cette session.
 * POURQUOI : condition double — météo ensoleillée ET > 50% d'habitudes cochées.
 *            window.meteoData est mis à jour par app.js (fetchMeteo).
 *            window.D.log[today()] contient les ids des habitudes cochées aujourd'hui.
 */
function _cx_estDoréDisponible() {
  // Lecture météo : icône runtime (window.meteoData) ou sauvegardée (window.D.meteo)
  const icone      = window.meteoData?.icon ?? window.D?.meteo?.icon ?? '';
  const inclusSoleil = icone.toLowerCase().includes('sun');

  // Lecture habitudes : D.habits = liste totale, D.log[today] = cochées aujourd'hui
  const dateAujourdHui = new Date().toISOString().split('T')[0];
  const total          = (window.D?.habits ?? []).length;
  const done           = (window.D?.log?.[dateAujourdHui] ?? []).length;
  const moitieAtteinte = total > 0 && done > total * 0.5;

  return inclusSoleil && moitieAtteinte;
}

// RÔLE : Exposer _cx_estDoréDisponible sur window pour que renderGameHub()
//         dans ui-game.js puisse l'interroger sans importer ce fichier.
// POURQUOI : ui-game.js est chargé AVANT ui-cristaux.js — il ne peut pas appeler
//            _cx_estDoréDisponible directement. L'exposition window.* résout cela.
window._cx_estDoréDisponible = _cx_estDoréDisponible;

/* ─── HELPER : SAUVEGARDE SCORE ─────────────────────────────── */

/**
 * RÔLE : Sauvegarde le score si meilleur que l'actuel.
 * POURQUOI exposé sur window : permet d'être appelé depuis l'extérieur si besoin futur.
 *
 * @param {number} score — score à comparer et éventuellement sauvegarder
 */
function _sauvegarderScoreCristaux(score) {
  const current = parseInt(localStorage.getItem('hg_game_crystals_best') || '0', 10);
  if (score > current) {
    localStorage.setItem('hg_game_crystals_best', String(score));
  }
}

window._sauvegarderScoreCristaux = _sauvegarderScoreCristaux;
