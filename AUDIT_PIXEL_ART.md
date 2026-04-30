# Audit pixel art HabitGotchi — rapport en lecture seule

> Ce fichier est en lecture seule. Ne pas modifier manuellement.
> Généré lors d'une session de diagnostic approfondie du rendu pixel art.

---

## 1. Bugs critiques diagnostiqués

### Bug 1 — Pupilles qui sortent de l'œil

**Localisation :** reflets/pupilles dessinés hors DSL via `p.rect()` (sub-pixel volontaire) :

- `drawBaby()` — `render-sprites.js:643-652`
- `drawTeen()` — `render-sprites.js:976-985`
- `drawAdult()` — `render-sprites.js:1417-1426`

**Calcul actuel (exemple) :**

```js
// render-sprites.js:649 (baby)
const rx = (Math.sin(Date.now() * 0.0008) * 0.5 + 0.5) * (PX * 2 - 3 - 2);
p.rect(cx - PX * 2 + 1 + rx, cy + PX * 2, 3, 3);
```

**Diagnostic :** aucun `constrain()`, aucun `clamp` explicite. La formule est calibrée sur la rangée haute large de l'iris, mais ignore que la rangée bas est plus étroite (ex. teen rangée bas droite : 5 px de large, alors que le reflet à `rx=3` atteint `cxB+13`). Conséquence visible : aux extrémités du sinus, le reflet déborde sur la rangée bas.

**Fix minimal — snap PX-grid :**

```js
// render-sprites.js:649 (drawBaby) — REMPLACER la ligne unique de calcul rx PAR :
const rxMax = PX * 2 - 3 - 2;
const rxRaw = (Math.sin(Date.now() * 0.0008) * 0.5 + 0.5) * rxMax;
const rx    = Math.floor(rxRaw / PX) * PX;
```

Idem `render-sprites.js:982` (`rxMax = PX*2-4-3`) et `render-sprites.js:1423` (`rxMax = PX*3-4-4`).

→ Le reflet ne se déplace plus que d'une case PX à la fois, reste toujours dans l'iris large.

---

### Bug 2 — Désynchronisation props/corps

**Calcul des offsets corps :**

- `bobY` flottant — `render.js:781-800` (`Math.sin(bounceT) * 3`)
- `walkX` flottant — `render.js:836` (`walkX += walkDir * speed` avec `speed ∈ {1.4, 0.7, 0.35, 0.12}`)
- `breathX` entier — `render-sprites.js:955` (teen) et `:1392` (adult)
- `cxB = cx - PX*4 - breathX` — cx flottant, donc cxB flottant

**`drawAccessoires` — `render-sprites.js:366-429` :**

- ligne 398 : `const accX = cx - (def.pixels[0].length * ps) / 2;` → flottant, pas de snap PX
- ligne 426 : `const accY = baseYraw - def.pixels.length * ps + offsetY;` → flottant

Le commentaire ligne 396-397 explique que le snap a été retiré par peur d'un glissement vertical lié à `bobY`.

**Diagnostic :**
Le sprite (corps) passe par `px()` qui `floor` sur grille PX (`envs.js:28`) → corps "saute" tous les 5 px.
Les accessoires passent par `pxFree()` qui `floor` au pixel mais pas sur grille PX → "rampent" pixel par pixel.
Désynchro franche dès qu'il y a marche ou `bobY`.

**Fix minimal :**

```js
// render-sprites.js:398 — REMPLACER
const accX = cx - (def.pixels[0].length * ps) / 2;
// PAR
const accXraw = cx - (def.pixels[0].length * ps) / 2;
const accX    = Math.floor(accXraw / PX) * PX;

// render-sprites.js:426 — REMPLACER
const accY = baseYraw - def.pixels.length * ps + offsetY;
// PAR
const accYraw = baseYraw - def.pixels.length * ps + offsetY;
const accY    = Math.floor(accYraw / PX) * PX;
```

`cxB` est déjà passé à `drawAccessoires` (cf. `:1000` et `:1439`) → l'accessoire suivra exactement les mêmes paliers PX que le corps.

---

## 2. Architecture animations — état actuel et proposition

### État actuel

Aucune couche d'abstraction. Chaque animation = (1) variable module, (2) bloc impératif dans `p.draw()`, (3) parfois calque DSL conditionnel. Sources éparpillées :

| Mécanisme | Localisation | Type |
|---|---|---|
| `bounceT`, `bobY` | `render.js:51, 781-782` | global + sinus |
| `walkX`, `walkPause` | `render.js:57-62, 824-843` | machine d'état inline |
| `_jumpTimer` | `render.js:63, 796-800` | timer inline |
| `shakeTimer` | `render.js:64, 866-867` | timer inline |
| `eatAnim` (snack) | `render.js:56, 943-959` | objet ad hoc |
| `_evoAnim` (chrysalide) | `render.js:69-72, 871-890` | objet ad hoc |
| `_adultPose` | `render.js:87-91, render-sprites.js:1362-1388` | machine rudimentaire |
| `_expr` (humeurs) | `render.js:93-113` | objet `{ mood, timer }` |
| `touchReactions` | `render.js:55, 910-938` | tableau de timers |

### Proposition (pseudo-code, sans dépendance externe)

```js
// 1. CATALOGUE — déclaratif, JSON-extensible
const ANIM_DEFS = {
  bras_hanche_g: {
    stages: ['adult'],
    duration: 72,
    cooldown: [60, 120],
    triggers: ['idle'],
    poses: {
      'bras-normal':   { hidden: true },
      'bras-hanche-g': { visible: true }
    }
  },
  saut_joie: {
    stages: ['baby','teen','adult'],
    duration: 20,
    triggers: ['habit_done','xp_gain'],
    bodyOffset: {
      yFn: (t) => -Math.floor(Math.sin(t/20 * Math.PI) * 22 / PX) * PX
    }
  },
};

// 2. ANIMATOR — pile légère, snap PX
const animator = {
  active: [],
  trigger(id, def = ANIM_DEFS[id]) {
    if (!def) return;
    this.active.push({ id, t: def.duration, def });
  },
  tick() { this.active = this.active.filter(a => --a.t > 0); },
  resolve(stage) {
    const out = { hidden: new Set(), visible: new Set(), dx: 0, dy: 0 };
    for (const a of this.active) {
      if (!a.def.stages.includes(stage)) continue;
      const elapsed = a.def.duration - a.t;
      if (a.def.poses) {
        for (const [layerId, ov] of Object.entries(a.def.poses)) {
          if (ov.hidden)  out.hidden.add(layerId);
          if (ov.visible) out.visible.add(layerId);
        }
      }
      if (a.def.bodyOffset?.yFn)
        out.dy += Math.floor(a.def.bodyOffset.yFn(elapsed) / PX) * PX;
      if (a.def.bodyOffset?.xFn)
        out.dx += Math.floor(a.def.bodyOffset.xFn(elapsed) / PX) * PX;
    }
    return out;
  }
};

// 3. INTÉGRATION — dans renderSprite() (render-sprites.js:82)
//    pour chaque layer : skip si overrides.hidden.has(layer.id)
//                       force draw si overrides.visible.has(layer.id)
//    appliquer dx,dy snappés à cx,cy avant les rects

// 4. DÉCLENCHEMENT — depuis app.js (gameplay)
//    toggleHab() → animator.trigger('saut_joie')
//    poseScheduler.tick() → idle long → animator.trigger('bras_hanique_g')
```

**Avantages :** 0 dépendance externe, snap PX systématique, format JSON-extensible (`data/anims.json` à terme), réutilise les id de calques DSL existants. Migration progressive : `_adultPose` devient un trigger.

---

## 3. Inventaire animations existantes

| Animation | Stade(s) | Déclencheur | Durée | Fichier:ligne |
|---|---|---|---|---|
| Respiration `bobY` | tous | continu | infinie | `render.js:780-782` |
| Marche `walkX` | tous (sauf egg) | éveillé + non pause | 30–120f de pause | `render.js:824-838` |
| Sommeil Zzz | baby/teen/adult | h≥22 ou h<7 | continu | `render.js:897` |
| Clignement | tous animés | timer aléa 40–120f | 3–6f | `render.js:961-973` |
| Saut `_jumpTimer` | tous | habitude validée | 20f | `render.js:796-800` |
| Shake | tous | tap canvas | 8–12f | `render.js:343, 866` |
| Snack `eatAnim` | tous | `ouvrirSnack()` | 50f | `render.js:943-959` |
| Évolution chrysalide | transition | `triggerEvoAnim()` | 45f | `render.js:871-890` |
| Touch reactions | tous | tap | 35f | `render.js:910-938` |
| Particules `spawnP` | tous | nettoyage, célébration | 16f | `render.js:172-180` |
| Étoile filante | ciel | aléa nuit | 12f | `render.js:262-278` |
| Respiration sub-pixel `breathX` | teen/adult | continu | infinie | `render-sprites.js:955, 1392` |
| Pulsation joues | teen/adult | continu | infinie | `render-sprites.js:967, 1406` |
| Pose hanche_g/d/croisés/salut | adult | timer cooldown | 60–96f | `render-sprites.js:1380-1383` |
| Marche pieds `stepPhase` | adult | en mouvement | continu | `render-sprites.js:1396-1398` |
| Bras tombés (en faible) | baby/teen/adult | énergie | continu | `render-sprites.js:627, 931, 1242` |
| Bras levés joie | adult | bonheur | continu | `render-sprites.js:1253` |
| Yeux surprise | teen/adult | `triggerExpr('surprise')` | 30–50f | `render-sprites.js:761, 1086` |
| Bouche faim/joie/surprise | teen/adult | `triggerExpr(...)` | 30–80f | `render-sprites.js:836-868, 1157-1189` |
| Yeux poop écarquillés | tous | `_gotchiNearPoop` | continu | `render-sprites.js:579, 799, 1124` |
| Reflet pupille flottant | tous | continu | infinie | `render-sprites.js:649, 982, 1423` |
| Wobble craquelures œuf | egg | continu | infinie | `render-sprites.js:475-477` |
| Dither épuisement | baby/teen/adult | `en<EN_CRIT` | continu | `render-sprites.js:656, 989, 1430` |
| Dither saleté (boue) | tous | `salete≥5` | continu | `render-sprites.js:311-344` |
| Tilt balancement | tous | énergie faible | continu | `render.js:856` |

---

## 4. Propositions de nouvelles animations (par effort croissant)

| Nom | Stade | Déclencheur | Description visuelle | Effort | Dépendances |
|---|---|---|---|---|---|
| Bâillement | baby/teen/adult | idle prolongé / 21h | bouche "O" 3f, yeux mi-clos 6f | faible | calque bouche-baillement |
| Frisson | tous | temperature<5 ou bain | oscille ±1px X tous les 2f, 18f | faible | nouveau shiverX |
| Hochement de tête | teen/adult | habitude validée | `cy +PX` puis 0, 2 cycles 16f | faible | `bodyOffset.yFn` |
| Sourcil interrogatif | teen/adult | nouvelle prop équipée | 1px noir au-dessus œil + "?" 18f | faible | calque conditionnel |
| Regard latéral suivi crotte | tous | `_gotchiNearPoop` | iris décale 1 PX vers la crotte | faible | lecture `poop.x - cx` |
| Petits pas tap-tap | baby | en mouvement | alterne calques pieds toutes les 3f | faible | dupliquer pattern teen/adult |
| Étirement matinal | adult | h===7 | bras-levés 12f → croisés 12f → normal | moyen | séquentiel animator (0 calque neuf) |
| Pulsation œuf prêt à éclore | egg | `totalXp ≥ 100` | corps plus clair + 1px wobble Y / 8f | moyen | calque corps-pulse |
| Danse joie 3 temps | teen/adult | `triggerExpr('joie')` haute | hanche_g → hanche_d → bras-levés (3×16f) | moyen | animator séquentiel |
| Penche-tête curiosité | baby/teen | tap 1× journée | rotate 5° + cy −PX, 12f | moyen | extension du tilt existant |
| Respiration profonde sommeil | tous (sommeil) | `sleeping=true` | amplitude `bobY` ×2 toutes les 60f / 12f | moyen | modulation `bounceT` |
| Câlin à l'accessoire cou | baby/teen/adult | prop cou actif + tap | bras vers poitrine (calque bras-cuddle) 24f | élevé | 1 sprite/stade + coord `drawAccessoires` |
| Pleurs (larmes pixel) | tous | `ha===0 && en===0` | 2px bleu clair / 8f, bouche-triste | élevé | particle "tear" + calque |
| Course (panique) | teen/adult | `crottes≥3` | `walkX` vitesse ×2, `stepPhase` chaque frame | élevé | refacto speed (`render.js:816`) |
| Endormissement progressif | tous | h===21 | clignements 1→4f sur 60s, puis Zzz | élevé | séquence animator |

**Critères respectés :** tous deltas via `Math.floor(val/PX)*PX`, pas d'antialiasing, lisibilité <64px.

---

## 5. Qualité code pixel art (dette technique)

### Occurrences `Math.round`

| Fichier:ligne | Code | Verdict |
|---|---|---|
| `render.js:257, 457, 718-719` | alphas, températures | ✅ OK — hors géométrie |
| `render-sprites.js:317` | alpha boue | ✅ OK |
| `render-sprites.js:324` | `Math.round(getBreath(p)*2-1)` | ⚠️ À convertir `floor` — distribution biaisée |
| `render-sprites.js:339-340` | `Math.round(ry/PX)` lecture pixel | ✅ Laisser `round` — robustesse face aux erreurs flottantes `loadPixels` |
| `render-sprites.js:955` | `breathX = Math.round(breath*2-1)` (teen) | ⚠️ À convertir |
| `render-sprites.js:961` | `Math.round(breath*2)` `mouthBaseY` | ⚠️ À convertir |
| `render-sprites.js:1392` | `breathX` (adult) | ⚠️ À convertir |
| `render-sprites.js:1400` | `Math.round(breath*2)` `mouthBaseY` adult | ⚠️ À convertir |

**Fix-type :**

```js
// render-sprites.js:955 — REMPLACER
const breathX = sl ? 0 : Math.round(breath * 2 - 1);
// PAR
const breathX = sl ? 0 : Math.floor(breath * 3) - 1; // ∈ {-1, 0, 1} équitable

// render-sprites.js:961 — REMPLACER
const mouthBaseY = cy + PX * 5 + Math.round(breath * 2);
// PAR
const mouthBaseY = cy + PX * 5 + Math.floor(breath * 3); // ∈ {0, 1, 2}
```

(idem `:1392` et `:1400` pour adult)

---

### Configuration canvas

- `noSmooth()` ✅ — `render.js:681`
- `image-rendering: pixelated` ✅ — `css/style.css:290-291`
- `pixelDensity(1)` ❌ manquant sur canvas principal (présent uniquement sur graphics off-screen `render-sprites.js:267`) → **flou retina possible**

```js
// render.js:681 — REMPLACER
p.noSmooth();
// PAR
p.pixelDensity(1);
p.noSmooth();
```

---

### Coordonnées flottantes non snappées — synthèse

Seules vraies fuites non maîtrisées : accessoires (Bug 2, `render-sprites.js:398, :426`) et reflets pupille (Bug 1, `:649, :982, :1423`). Le reste est soit snappé via `px()`, soit volontairement sub-pixel (pluie, gouttes, wobble œuf).

---

## Récapitulatif fixes prioritaires

| # | Fix | Fichier:ligne |
|---|---|---|
| 1 | Snap PX reflets pupille | `render-sprites.js:649, 982, 1423` |
| 2 | Snap PX accessoires | `render-sprites.js:398, 426` |
| 3 | `Math.round` → `Math.floor` géométrie | `render-sprites.js:324, 955, 961, 1392, 1400` |
| 4 | `pixelDensity(1)` retina | `render.js:681` |
| 5 | Architecture animator | Absorber `_adultPose`, `_jumpTimer`, `eatAnim`, `_evoAnim`, `_expr` dans un format déclaratif, ouvert à `data/anims.json` |
