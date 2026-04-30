# Audit pixel art HabitGotchi — rapport en lecture seule

> Ce fichier est en lecture seule. Ne pas modifier manuellement.
> Généré lors d'une session de diagnostic approfondie du rendu pixel art.

---

## 1. Bugs critiques diagnostiqués

### Bug 1 — Pupilles qui sortent de l'œil ✅ RÉSOLU 2026-04-30

**Localisation :** reflets/pupilles dessinés hors DSL via `p.rect()` (sub-pixel volontaire) :

- `drawBaby()` — `render-sprites.js:643-652`
- `drawTeen()` — `render-sprites.js:976-985`
- `drawAdult()` — `render-sprites.js:1417-1426`

**Calcul avant fix :**

```js
// render-sprites.js:649 (baby)
const rx = (Math.sin(Date.now() * 0.0008) * 0.5 + 0.5) * (PX * 2 - 3 - 2);
p.rect(cx - PX * 2 + 1 + rx, cy + PX * 2, 3, 3);
```

**Diagnostic :** aucun `constrain()`, aucun `clamp` explicite. La formule était calibrée sur la rangée haute large de l'iris, mais ignorait que la rangée bas est plus étroite → le reflet débordait aux extrémités du sinus.

**Fix appliqué — snap PX-grid (3 sites) :**

```js
// drawBaby — rxMax = PX*2-3-2
// drawTeen  — rxMax = PX*2-4-3
// drawAdult — rxMax = PX*3-4-4
const rxRaw = (Math.sin(Date.now() * 0.0008) * 0.5 + 0.5) * rxMax;
const rx    = Math.floor(rxRaw / PX) * PX;
```

→ Le reflet ne se déplace plus que d'une case PX à la fois, reste toujours dans l'iris large.

---

### Bug 2 — Désynchronisation props/corps ✅ RÉSOLU 2026-04-30

**Calcul des offsets corps :**

- `bobY` flottant — `render.js:781-800` (`Math.sin(bounceT) * 3`)
- `walkX` flottant — `render.js:836` (`walkX += walkDir * speed` avec `speed ∈ {1.4, 0.7, 0.35, 0.12}`)
- `breathX` entier — `render-sprites.js:955` (teen) et `:1392` (adult)
- `cxB = cx - PX*4 - breathX` — cx flottant, donc cxB flottant

**`drawAccessoires` — `render-sprites.js:366-429` :**

- ligne 398 : `const accX = cx - (def.pixels[0].length * ps) / 2;` → flottant, pas de snap PX
- ligne 426 : `const accY = baseYraw - def.pixels.length * ps + offsetY;` → flottant

**Diagnostic :** Le sprite (corps) passait par `px()` qui `floor` sur grille PX → corps "saute" tous les 5 px. Les accessoires passaient par `pxFree()` → "rampaient" pixel par pixel. Désynchro franche dès qu'il y avait marche ou `bobY`.

**Fix appliqué :**

```js
// render-sprites.js:398
const accXraw = cx - (def.pixels[0].length * ps) / 2;
const accX    = Math.floor(accXraw / PX) * PX;

// render-sprites.js:426
const accYraw = baseYraw - def.pixels.length * ps + offsetY;
const accY    = Math.floor(accYraw / PX) * PX;
```

→ Les accessoires suivent exactement les mêmes paliers PX que le corps.

---

## 2. Architecture animations — état actuel (après migration Temps 1–3)

### ✅ Implémenté — moteur animator déclaratif

Architecture en 3 couches, sans dépendance externe, opérationnelle depuis la session du 2026-04-30.

**`ANIM_DEFS`** — catalogue déclaratif dans `render.js` :

```js
// Chaque entrée décrit une animation : stades, durée, poses de calques, offset corps.
// stages: '*' = tous stades ; stages: ['adult'] = adulte uniquement.
// poses: { [layerId]: { hidden?, visible? } } → pilote aov.hidden / aov.visible dans renderSprite().
// bodyOffset.yFn(elapsed) → offset Y snappé PX, appliqué sur drawY dans p.draw().
```

Animations cataloguées :

| id | stages | durée | mécanisme |
|---|---|---|---|
| `saut_joie` | `'*'` | 20f | `bodyOffset.yFn` — cloche sin × 22px |
| `pose_hanche_g` | `['adult']` | 60f + aléa | `poses` hidden/visible |
| `pose_hanche_d` | `['adult']` | 60f + aléa | `poses` hidden/visible |
| `pose_croises` | `['adult']` | 72f + aléa | `poses` hidden/visible |
| `pose_salut` | `['adult']` | 12f + aléa | `poses` hidden/visible |

**`animator`** — `render.js`, exposé sur `window.animator` :
- `trigger(id, options?)` — empile une animation ; `options.duration` surcharge la durée catalogue
- `tick()` — décrémente les timers, purge les terminées ; appelé une fois par frame dans `p.draw()`
- `resolve(stage)` — retourne `{ hidden: Set, visible: Set, dx, dy }` ; calculé une fois par frame, exposé sur `window._animOverrides`

**`renderSprite()`** — `render-sprites.js:74` :
- Lit `window._animOverrides` en début de fonction
- `aov.hidden.has(layer.id)` → skip le calque
- `aov.visible.has(layer.id)` → force le calque (ignore `when`)
- `aov.dy` absorbé sur `drawY` dans `p.draw()` (décale le Gotchi entier)

### État des mécanismes après migration

| Mécanisme | Avant | Après |
|---|---|---|
| `_jumpTimer` | timer inline dans `p.draw()` | → `animator.trigger('saut_joie')` via `triggerGotchiBounce()` |
| `_adultPose` | machine d'état + `pm.pose` dans `params` | → scheduler pur (cooldown/random) + `animator.trigger('pose_*')` |
| Calques bras idle | `when: pm.pose === '...'` | → `when: () => false` + `aov.visible` |
| `bras-normal` | `when: pm.pose === 'normal'` | → `when: énergie/humeur/sommeil` + masqué par `aov.hidden` |
| `bounceT`, `bobY` | global + sinus | inchangé (locomotion continue, hors animator) |
| `walkX`, `walkPause` | machine d'état inline | inchangé (locomotion continue, hors animator) |
| `shakeTimer` | timer inline | inchangé (candidat futur migration) |
| `eatAnim` | objet ad hoc | inchangé (candidat futur migration) |
| `_evoAnim` | objet ad hoc | inchangé (candidat futur migration) |
| `_expr` | objet `{ mood, timer }` | inchangé (candidat futur migration) |
| `touchReactions` | tableau de timers | inchangé (candidat futur migration) |

---

## 3. Inventaire animations existantes

| Animation | Stade(s) | Déclencheur | Durée | Fichier:ligne |
|---|---|---|---|---|
| Respiration `bobY` | tous | continu | infinie | `render.js:780-782` |
| Marche `walkX` | tous (sauf egg) | éveillé + non pause | 30–120f de pause | `render.js:824-838` |
| Sommeil Zzz | baby/teen/adult | h≥22 ou h<7 | continu | `render.js:897` |
| Clignement | tous animés | timer aléa 40–120f | 3–6f | `render.js:961-973` |
| Saut `saut_joie` | tous | habitude validée, achat boutique | 20f | `animator` — `render.js ANIM_DEFS` |
| Shake | tous | tap canvas | 8–12f | `render.js:343, 866` |
| Snack `eatAnim` | tous | `ouvrirSnack()` | 50f | `render.js:943-959` |
| Évolution chrysalide | transition | `triggerEvoAnim()` | 45f | `render.js:871-890` |
| Touch reactions | tous | tap | 35f | `render.js:910-938` |
| Particules `spawnP` | tous | nettoyage, célébration | 16f | `render.js:172-180` |
| Étoile filante | ciel | aléa nuit | 12f | `render.js:262-278` |
| Respiration sub-pixel `breathX` | teen/adult | continu | infinie | `render-sprites.js:955, 1392` |
| Pulsation joues | teen/adult | continu | infinie | `render-sprites.js:967, 1406` |
| Pose hanche_g/d/croisés/salut | adult | scheduler cooldown dans `drawAdult` | 60–96f | `animator` — `render.js ANIM_DEFS` + scheduler `render-sprites.js:drawAdult` |
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

### Occurrences `Math.round` ✅ TOUTES RÉSOLUES 2026-04-30

| Fichier:ligne | Code | Verdict |
|---|---|---|
| `render.js:257, 457, 718-719` | alphas, températures | ✅ OK — hors géométrie |
| `render-sprites.js:317` | alpha boue | ✅ OK |
| `render-sprites.js:~342` | `drawSaleteDither` breathX boue | ✅ CONVERTI → `Math.floor(getBreath(p)*3)-1` |
| `render-sprites.js:339-340` | `Math.round(ry/PX)` lecture pixel | ✅ Laisser `round` — robustesse face aux erreurs flottantes `loadPixels` |
| `render-sprites.js:~1020` | `breathX` teen | ✅ CONVERTI → `Math.floor(breath*3)-1` |
| `render-sprites.js:~1026` | `mouthBaseY` teen | ✅ CONVERTI → `Math.floor(breath*3)` |
| `render-sprites.js:~1483` | `breathX` adult | ✅ CONVERTI → `Math.floor(breath*3)-1` |
| `render-sprites.js:~1491` | `mouthBaseY` adult | ✅ CONVERTI → `Math.floor(breath*3)` |

Distribution corrigée : `Math.floor(x*3)-1` donne {-1, 0, 1} équitable ; `Math.floor(x*3)` donne {0, 1, 2} équitable. Plus aucun biais vers le centre.

---

### Configuration canvas

- `noSmooth()` ✅ — `render.js:845`
- `image-rendering: pixelated` ✅ — `css/style.css:290-291`
- `pixelDensity(1)` ✅ AJOUTÉ 2026-04-30 — `render.js:849`, avant `noSmooth()` et `createCanvas()`

Chaîne anti-flou pixel art complète : `pixelDensity(1)` + `noSmooth()` + `image-rendering: pixelated`. Cohérent avec les canvas off-screen (`render-sprites.js:285`).

---

### Coordonnées flottantes non snappées — synthèse ✅ RÉSOLU 2026-04-30

~~Seules vraies fuites non maîtrisées : accessoires (Bug 2) et reflets pupille (Bug 1).~~

Plus aucune fuite non maîtrisée. Le reste est soit snappé via `px()`, soit volontairement sub-pixel (pluie, gouttes, wobble œuf).

---

## Récapitulatif fixes prioritaires — TOUS RÉSOLUS ✅

| # | Fix | Fichier:ligne | État |
|---|---|---|---|
| 1 | Snap PX reflets pupille | `render-sprites.js:649, 982, 1423` | ✅ FAIT 2026-04-30 |
| 2 | Snap PX accessoires | `render-sprites.js:398, 426` | ✅ FAIT 2026-04-30 |
| 3 | `Math.round` → `Math.floor` géométrie | `render-sprites.js:~342, ~1020, ~1026, ~1483, ~1491` | ✅ FAIT 2026-04-30 |
| 4 | `pixelDensity(1)` retina | `render.js:849` | ✅ FAIT 2026-04-30 |
| 5 | Architecture animator | `_adultPose` et `_jumpTimer` migrés | ✅ FAIT 2026-04-30 |

**Prochains chantiers candidats (cf. §2 — tableau état animations) :**
`shakeTimer`, `eatAnim`, `_evoAnim`, `_expr` — migration vers `animator` quand pertinent.
