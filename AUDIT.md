# AUDIT HabitGotchi v4.5 — 2026-04-30

> Audit complet sur la branche `main`, version `v4.5`. Lecture intégrale de `data/config.js` (243 l), `js/app.js` (1241 l), `js/render.js` (1173 l), `js/render-sprites.js` (620 l), `js/envs.js` (438 l), `js/ui.js` (5192 l), `index.html` (635 l), `sw.js` (69 l). Parcours rapide de `prompts/ai_contexts.json`, `prompts/ai_system.json`, `data/props.json`. Ancien `AUDIT.md` (v3.02) consulté uniquement comme référence de format.
>
> **Session refactoring 2026-04-30** : `ui.js` (5192 l) découpé en 8 modules — voir section "Historique des sessions" en fin de fichier. `sw.js` mis à jour (ajout `render-sprites.js` + 8 modules ui, retrait `ui.js`). `index.html` mis à jour (ordre de chargement). `getWeekId` doublon confirmé absent (déjà supprimé). `escapeHtml` unifié sur `escape` dans `ui-core.js`.
>
> **Session quick wins 2026-04-30** : 3 quick wins résolus — `getStageBaseY()` dans `render.js` (déduplication ternaire `by`), `clearInterval` + handles module-level dans `app.js` (intervals nettoyés), `window._modalCloseBtn(onclick)` exposé depuis `ui-core.js` et appliqué dans 5 modales (`ui-shop.js` ×4, `ui-agenda.js` ×1, `ui-ai.js` ×1).
>
> **Vérification version** : `window.APP_VERSION = 'v4.5'` ([app.js L54](js/app.js#L54)) — ⚠️ la consigne mentionnait `'hg-v4.5'` mais le code stocke uniquement `'v4.5'`. Le `CACHE_VERSION` de `sw.js` ([L7](sw.js#L7)) est aligné `'v4.5'`. Cohérence OK entre les deux fichiers, mais préfixe `hg-` non utilisé.

---

## 0. Résumé exécutif

### Tableau santé

| Fichier | Score | Justification (1 phrase) |
|---|---|---|
| `data/config.js` | **A** | Constantes pures, namespace `window.HG_CONFIG` propre, palettes documentées. `HG_CONFIG.GAMEPLAY` expose désormais toutes les constantes gameplay (XP, EN, HA, POOP, cycle). |
| `js/app.js` | **B+** | Bien commenté, migrations versionnées, mais bootstrap éparpillé, `addEvent` mixe deux signatures, et plusieurs `setInterval` non clearables. |
| `js/render.js` | **B-** | `p.draw()` monolithique de ~570 lignes, mélange logique métier (locomotion, badges, env selector) et rendu, helpers de hitbox dupliqués entre `touchStarted` et `touchMoved`. |
| `js/render-sprites.js` | **A-** | Sprites bien isolés, `drawSaleteDither` reproduit manuellement les silhouettes (dette fragile mais documentée), code lisible et autonome. |
| `js/envs.js` | **B+** | Cohérent et factorisé (`tc`, `shadeN`), seul reproche : `drawActiveEnv` mélange parc/chambre/montagne dans une seule fonction de 130 lignes. |
| `js/ui.js` | **C+** | 5192 lignes, 5 manières différentes d'ouvrir une modale (`openModal`, accès direct `mbox.innerHTML`, `etats-overlay` créé en JS, `tablet-overlay` HTML, agenda `shop-open`), code dupliqué massif sur les en-têtes de modales, gestion scroll-lock incohérente. |
| `index.html` | **B** | Ordre des scripts correct, debug-panel inline volumineux (~85 l), p5.js CDN sans `integrity`, masquage features RDV/Cycle dans script séparé en bas. |
| `sw.js` | **C+** | ✅ `render-sprites.js` ajouté dans `ASSETS` (fix session 2026-04-30). Reste : stratégie cache-first sans `response.ok` (cache des 404), pas de gestion des updates côté client. |

### Top 3 problèmes critiques

1. ✅ **`render-sprites.js` absent du Service Worker** — RÉSOLU (session split ui.js, 2026-04-30)
   - Fichier : `sw.js` [L25]
   - `'./js/render-sprites.js'` ajouté dans `ASSETS`. Vérifié présent.

2. ✅ **Modale non-bloquante : interactions passent à travers** — RÉSOLU (2026-04-30)
   - Cf. section spéciale "Bug modale non-bloquante" plus bas pour le détail complet.

3. ✅ **`addEvent` accepte deux signatures incompatibles** — RÉSOLU (2026-04-30)
   - Fichier : `js/app.js` [L648-L659]
   - La branche legacy `else` a été supprimée. `addEvent` n'accepte désormais qu'un objet `{ type, subtype, valeur, label }`.
   - Tous les appelants vérifiés : 0 appel legacy dans l'ensemble du codebase (app.js, ui-*.js, render.js).
   - Signature finale : `function addEvent(ev)` — horodatage automatique + spread.

### Top 3 quick wins

1. ✅ **Dédupliquer le calcul `by` (Y du sprite par stade)** — RÉSOLU (2026-04-30)
   - Fichier : `js/render.js`
   - Solution : Fonction `getStageBaseY(stage)` ajoutée (~L102, juste avant `getGotchiC()`). Les 3 occurrences du ternaire inline (draw, touchStarted, touchMoved) remplacées par un appel à cette fonction.

2. ✅ **Éviter `setInterval` non nettoyés** — RÉSOLU (2026-04-30)
   - Fichier : `js/app.js`
   - Solution : Variables module-level `_meteoIntervalId` et `_poopIntervalId` ajoutées (~L57). Dans `bootstrap()`, `clearInterval()` appelé sur chaque handle avant recréation — sans effet si `null`, sûr dans tous les cas.

3. ✅ **Centraliser le bouton ✕ des modales agenda/boutique** — RÉSOLU (2026-04-30)
   - Fichiers : `js/ui-core.js`, `js/ui-shop.js`, `js/ui-agenda.js`, `js/ui-ai.js`
   - Solution : `_modalCloseBtn(onclick)` rendu paramétrable + exposé sur `window._modalCloseBtn`. Les 5 boutons ✕ inline remplacés par `${window._modalCloseBtn()}` (ou avec onclick personnalisé pour agenda : `fermerAgenda()`, et soutien IA : `modalLocked=false;clModal()`).

---

## 1. `data/config.js`

### 1.1 Vue d'ensemble
243 lignes. Constantes pures : palettes UI (6), couleurs Gotchi (6), thèmes d'environnements (4), fenêtres repas (3), pool de snacks (~140 emojis), constantes gameplay (XP, poops, seuils visuels). Aucune logique exécutable. Complexité minimale.

### 1.2 Points forts
- Commentaires "RÔLE" / "POURQUOI" très bien tenus ([L19], [L34], [L60]).
- `CARD_BG` factorisé ([L10]) → un seul point de modification pour le fond des cartes.
- Justifications WCAG documentées sur `text2` ([L20-L28]).
- Namespace `window.HG_CONFIG` ([L238+]) — bonne pratique conservée depuis la v3.02. Les constantes gameplay sont désormais regroupées dans `HG_CONFIG.GAMEPLAY`.

### 1.3 Problèmes

#### ✅ RÉSOLU — Constantes XP/EN/HA non exposées dans `HG_CONFIG`
- Résolu le 2026-04-30.
- `AI_MODEL`, `XP_*`, `PETALES_SNACK`, `POOP_*`, `EN_*`, `HA_*`, `CYCLE_DEFAULT_DURATION` sont maintenant exposées dans `window.HG_CONFIG.GAMEPLAY` (sous-objet dédié). Les constantes UI restent à la racine de `HG_CONFIG`.

#### 🟡 MINEUR — Quatre thèmes seulement (`pastel`, `automne`, `hiver`, `desert`)
- Lignes : [L84-L155]
- Description : Le code cible un sélecteur visible dans `index.html` ("Ambiance des univers") qui implique potentiellement plus d'options. Pas un bug — juste à noter.
- Suggestion : RAS, simple constat documentaire.

#### ✅ RÉSOLU — Magic number `28` pour cycle par défaut éparpillé
- Résolu le 2026-04-30.
- Constante `CYCLE_DEFAULT_DURATION = 28` ajoutée dans `config.js` et exposée dans `HG_CONFIG.GAMEPLAY`. Les trois occurrences dans `app.js` (defs, getCyclePhase, migration m1) ont été remplacées.

### 1.4 Code mort / redondances
- Aucune fonction. Le `card` répété 6× dans `UI_PALETTES` est déjà factorisé via `CARD_BG`.

### 1.5 Dette technique
- Très faible. Le namespace `HG_CONFIG.GAMEPLAY` est désormais complet. Seul point d'attention résiduel : `config.js` fait 286 lignes — en cas d'ajout futur de constantes, envisager de séparer les constantes visuelles (`UI_PALETTES`, `GOTCHI_COLORS`, `ENV_THEMES`) des constantes gameplay dans deux fichiers distincts.

---

## 2. `js/app.js`

### 2.1 Vue d'ensemble
1241 lignes. Cerveau de l'application : utilitaires temps, structure `D`, save/load + migrations, logique métier (XP, stades, poops, salete, repas, snack préféré, météo, phases solaires, bulles, journal d'événements), bootstrap PWA. Complexité moyenne, le fichier touche 6 systèmes sur 7.

### 2.2 Points forts
- Header de navigation très clair ([L6-L24]).
- `MIGRATIONS` versionnées ([L237-L309]) — modèle exemplaire pour faire évoluer le schéma sans casser les anciennes sauvegardes.
- `bootstrap()` ([L1175-L1209]) gère explicitement les 3 voies d'entrée (1er load, `pageshow` bfcache, `visibilitychange`).
- `getCyclePhase()` ([L200-L226]) calcule la durée moyenne sur tous les cycles connus.
- `saveDebounced()` ([L817-L821]) — bonne pratique anti-rafale pour les sliders.

### 2.3 Problèmes

#### ✅ RÉSOLU — `addEvent` double signature (2026-04-30)
- Lignes : [L648-L659]
- Description : Branche legacy supprimée. Signature unique : `function addEvent(ev)` — ev est toujours un objet `{ type, subtype, valeur, label }`. Horodatage et spread automatiques. Zéro appel legacy confirmé dans l'ensemble du codebase.

#### ✅ RÉSOLU — `bootstrap()` non idempotent face aux `setInterval` (2026-04-30)
- Lignes : [L1195-L1236]
- Description : `fetchMeteo()`, `fetchSolarPhases()` et les deux `setInterval` déplacés à l'intérieur du `.then()`, juste avant `_appInitialized = true`. Ils ne s'exécutent plus qu'une seule fois, sous la garde implicite de la promesse de chargement. `clearInterval` conservés (no-op si null, sûrs dans tous les cas).

#### ✅ RÉSOLU — `forceUpdate()` ne gère pas le service worker (2026-04-30)
- Lignes : [L383-L400]
- Description : Fonction réécrite en `async`. Elle désinstalle d'abord tous les SW enregistrés (`navigator.serviceWorker.getRegistrations()` + `r.unregister()`), vide tous les caches avec `await Promise.all(names.map(n => caches.delete(n)))`, puis appelle `window.location.reload()`. Le `setTimeout` arbitraire 500 ms supprimé — le rechargement ne se déclenche qu'une fois les deux étapes async terminées.

#### ✅ RÉSOLU — `forceUpdate()` ne fait pas un vrai hard reload (2026-04-30)
- Lignes : [L398]
- Description : `setTimeout 500ms` supprimé. `await Promise.all(...)` garantit que tous les `cache.delete()` sont terminés avant le reload — pas de race condition possible.

#### ✅ RÉSOLU — `flashBubble()` modifie directement `el.textContent` (2026-04-30)
- Lignes : [L998-L1003]
- Description : `textContent` est XSS-safe par nature — aucun escape supplémentaire nécessaire. Aucune modification de code requise. Item clos.

#### ✅ RÉSOLU — `updBubbleNow()` pool non-escapé (2026-04-30)
- Lignes : [L1071-L1102]
- Description : L'affichage final passe par `el.textContent` — XSS-safe même si les bulles IA contiennent du HTML. Aucune modification de code requise. Item clos.

#### ✅ RÉSOLU — `MSG` fallback non documenté (2026-04-30)
- Lignes : [L155-L167]
- Description : Commentaire "RÔLE / POURQUOI" ajouté : `MSG` est un fallback défensif, jamais affiché en usage normal, déclenché uniquement si `updBubbleNow()` s'exécute avant la fin du fetch async de `personality.json` (1er lancement hors-ligne). Conservé intentionnellement.

#### ✅ RÉSOLU — `floatXP` taille hardcodée `11px` (2026-04-30)
- Lignes : [L711]
- Description : `font-size:11px` remplacé par `font-size:var(--fs-xs)` dans le `cssText`. `font-weight:bold` conservé tel quel — c'est la convention dans tout le codebase (pas de variable `--fw-*` définie). `var(--lilac)` était déjà en place.

#### 🔵 STYLE — Indentation incohérente dans `defs()`
- Lignes : [L165-L196]
- Description : Mélange de 2 espaces et de tabs, alignement aléatoire des virgules.
- Suggestion : Passage à Prettier.

#### 🔵 STYLE — Numérotation `§` du header ne correspond plus aux lignes
- Lignes : [L6-L24]
- Description : Le header annonce `§16 ~973 INIT QUOTIDIENNE` mais `handleDailyReset()` est en réalité [L1095].
- Suggestion : Recalculer les ancres ou utiliser des `// §16` inline.

### 2.4 Code mort / redondances
- `MSG` ([L150-L157]) en pratique jamais lu (cf. ci-dessus).
- `forceUpdate()` toast() suppose `toast` existe — protection `typeof` manquante (mais `ui.js` est chargé après).
- `_lat`/`_lng` sur `D` : nettoyés via migration `m1` ([L242-L255]) — OK.

### 2.5 Dette technique
- `bootstrap` mélange chargement + initialisation + démarrage timers.
- Pas de couche "service" entre data et UI : `app.js` appelle directement `updUI`, `renderProps`, `updBadgeBoutique` (couplage fort avec `ui.js`).

---

## 3. `js/render.js`

### 3.1 Vue d'ensemble
1173 lignes. Moteur p5.js. Globals visuels, sprites cycliques (œuf/bébé/ado/adulte → délégués à `render-sprites.js`), particules, écosystème (sky, clouds, zzz), props ambiants/décor, locomotion gotchi, HUD, badges, sélecteur d'env in-canvas, gestion touch (`touchStarted`, `touchMoved`, `touchEnded`).

### 3.2 Points forts
- Constantes graphiques `C` ([L27-L40]) bien isolées en haut.
- `getBreath` / `getCheekPulse` ([L87-L94]) : helpers réutilisables.
- Système d'expression `_expr` ([L80-L100]) cohérent entre stades.
- GARDES de `touchStarted` ([L908-L946]) bien documentées et stratifiées.

### 3.3 Problèmes

#### 🟠 IMPORTANT — `p.draw()` monolithique (~570 lignes)
- Lignes : [L330-L896]
- Description : Une seule fonction qui : initialise les couleurs, calcule la nuit, dessine ciel/env/props/poops/gotchi/HUD/badges/env-selector. Les sections sont commentées (`// 1.`, `// 2.`...) mais aucune extraction.
- Risque : Modifier une zone (ex: HUD) impose de relire 500 lignes. Rendu forcément couplé à la frame courante (pas de cache).
- Suggestion : Extraire `drawHUD(p)`, `drawBadges(p)`, `drawEnvSelector(p)`, `drawPropsLayer(p, slotFilter)` — réduire `p.draw` à un orchestrateur ~80 lignes.

#### 🟠 IMPORTANT — `getBaseY(stage)` dupliqué 3 fois
- Lignes : [L522, L1031-L1034, L1092-L1095]
- Description : Le mapping stage→baseY est répété (cf. quick win #1).
- Risque : Désync si un seul des 3 endroits est modifié → hitbox décalée.

#### 🟠 IMPORTANT — `walkX`/`walkDir`/`walkStep` en variables module non exposées
- Lignes : [L49-L53]
- Description : `walkX` est exposé via `window._gotchiX = walkX` ([L519]) mais `walkPause`, `walkTarget` restent privés. `render-sprites.js` ([L595]) référence `walkPause` directement → ce n'est possible que parce que le `let` est hissé dans la même scope script (les deux fichiers partagent le contexte global).
- Risque : Couplage implicite entre `render.js` et `render-sprites.js` ; tout passage en module ES casserait le code.
- Suggestion : Exposer explicitement `window._walk = { x, dir, pause, ... }` ou exporter via un objet partagé.

#### 🟡 MINEUR — `_lastTapTime` global non protégé
- Lignes : [L949-L950]
- Suggestion : Encapsuler dans un objet `_tapState`.

#### 🟡 MINEUR — Étoiles hardcodées en tableau littéral énorme
- Lignes : [L219-L228]
- Description : 21 coordonnées `[x, y]` en dur. Difficile à modifier visuellement.
- Suggestion : Extraire en `const STARS = [...]` au top du fichier.

#### 🟡 MINEUR — `darkAlpha` calculé mais utilisé seulement après le HUD
- Lignes : [L362-L365, L660-L664]
- Description : Calcul correct mais l'overlay nuit recouvre déjà les badges canvas (badges dessinés ensuite via `if (!isCompact)`). Le commentaire ([L659]) dit "épargne le HUD" mais en réalité le HUD est dessiné APRÈS l'overlay → le HUD n'est pas assombri (correct), mais c'est l'inverse de ce que dit le commentaire.
- Suggestion : Reformuler le commentaire — l'overlay nuit est dessiné AVANT le HUD donc le HUD reste lumineux.

#### 🟡 MINEUR — `_envSelectorHits` reconstruit chaque frame
- Lignes : [L843, L860, L885]
- Description : Un tableau alloué et rempli à chaque draw même quand le sélecteur est fermé → léger churn GC.
- Suggestion : Recalculer uniquement quand `D.g.activeEnv` ou `_envSelectorOpen` change.

#### 🟡 MINEUR — Hitbox magic numbers `±26`, `±35`, `gotchiCenterY = by + 30`
- Lignes : [L1037-L1039]
- Suggestion : `const GOTCHI_HITBOX = { rX:26, rY:35, centerOffsetY:30 }`.

#### 🔵 STYLE — Mélange `if (...)` et chaînes ternaires sans cohérence
- Lignes : [L494-L497]
- Description : Cascade de ternaires pour `speed` puis `if/else` pour walkPause juste après.

### 3.4 Code mort / redondances
- `window._bounceT = 0` ([L46]) : déclaré globalement mais le code utilise `bounceT` local ([L44]) — `_bounceT` est mort (déjà identifié en v3.02, **non résolu**).
- `_lastPetTime` ([L1056]) : écrit mais jamais lu. Dette mineure (déjà identifié en v3.02, **non résolu**).
- `walkStep` ([L51, L493]) : incrémenté mais jamais lu — code mort.

### 3.5 Dette technique
- `p.draw` à découper.
- Couplage implicite avec `render-sprites.js` via variables module.

---

## 4. `js/render-sprites.js`

### 4.1 Vue d'ensemble
620 lignes. Sprites pixel art : `drawDither` (épuisement), `drawSaleteDither` (boue), `drawAccessoires` (pixel-perfect), `drawEgg`, `drawBaby`, `drawTeen`, `drawAdult` (avec poses idle alternées).

### 4.2 Points forts
- Documentation très soignée des paramètres ([L40-L51]).
- Sprites paramétrés (cx, cy, sl, en, ha) → réutilisables.
- `_adultPose` ([L539-L591]) : système de poses idle élégant, pondéré.
- Retour `{ topY, eyeY, neckY }` exposé pour `drawAccessoires` — anchoring propre.

### 4.3 Problèmes

#### 🟠 IMPORTANT — `drawSaleteDither` reproduit à la main les silhouettes des sprites
- Lignes : [L82-L128]
- Description : Pour chaque stade, le code redessine grossièrement le contour du sprite via `ditherRect`. Si le sprite change (`drawBaby` modifié dans une future feature), `drawSaleteDither` ne suit pas automatiquement → la boue n'épousera plus la silhouette.
- Risque : Bug visuel silencieux après refonte des sprites.
- Suggestion : Soit (a) accepter que c'est une approximation et le documenter en gros (déjà fait [L42-L46]), soit (b) générer un masque alpha à partir d'un canvas off-screen une seule fois.

#### 🟡 MINEUR — `dejaDessines` Set créé à chaque frame dans `drawAccessoires`
- Lignes : [L155]
- Description : Allocation Set par frame × 12 fps = 720 allocs/min. Faible impact mais évitable.
- Suggestion : Utiliser un objet réutilisable ou un tableau small.

#### 🟡 MINEUR — `expr.moodTimer > 0 && expr.lastMood === 'X'` répété ~7 fois
- Lignes : [L309, L348, L361, L366, L372, L491, L504, L509, L515]
- Suggestion : Helper `function isMood(name) { return _expr.moodTimer > 0 && _expr.lastMood === name; }`.

#### 🟡 MINEUR — `walkPause` lu par référence implicite
- Lignes : [L595]
- Description : Cf. render.js — couplage cross-fichier.

#### 🔵 STYLE — Indentation alternée 2/4 espaces
- Lignes : passim — `drawTeen`/`drawAdult` mélangent les deux.

### 4.4 Code mort / redondances
- Aucune fonction morte détectée.

### 4.5 Dette technique
- Les sprites sont écrits "manuellement" en suite de `px()` — si on voulait introduire de nouvelles variantes, il faudrait dupliquer toute la fonction. Pas de DSL ni de format pixel.

---

## 5. `js/envs.js`

### 5.1 Vue d'ensemble
438 lignes. Décors d'arrière-plan : moteur pixel (`px`, `pxFree`), météo (`drawWind`, `drawRain`, `drawRainbow`, `drawSun`, `drawFog`), biomes (parc/chambre/montagne+désert), helpers (`drawTreeTheme`, `drawCactus`, `drawFl`), conversion de couleur jour→nuit (`shadeN`).

### 5.2 Points forts
- `px()` ([L27-L29]) brique élémentaire bien isolée et bien documentée.
- `tc()` ([L43]) : accès thème + jour/nuit en une ligne.
- `shadeN()` ([L391-L438]) implémente HSL → manipulation luminosité/saturation propre.
- Commentaire stratégique pour la fenêtre de la chambre ([L186-L206]).

### 5.3 Problèmes

#### 🟡 MINEUR — `drawActiveEnv` mélange parc/chambre/montagne en if/else if/else if
- Lignes : [L164-L294]
- Description : 130 lignes pour 3 biomes — `chambre` à elle seule fait ~75 lignes.
- Suggestion : Extraire `drawParc`, `drawChambre`, `drawMontagne` et faire un dispatcher.

#### 🟡 MINEUR — `drawFog` : magic numbers
- Lignes : [L62-L87]
- Description : `for (let i = 0; i < 5; i++)` puis `for (let i = 0; i < 4; i++)` — pourquoi 5 et 4 ? Suggestion d'extraire `FOG_LAYERS_GROUND = 5`.

#### 🟡 MINEUR — `tc(n, col)` n'accepte qu'un seul paramètre `n` numeric mais le commentaire mentionne "anciennement booléen"
- Lignes : [L37-L43]
- Description : Le typage transitoire est documenté mais peut surprendre si on appelle `tc(true, ...)` (rétrocompat possible mais non assurée).
- Suggestion : `tc(n=0, col)` avec fallback explicite.

#### 🔵 STYLE — Mix `p.rect` direct et `px(p, ...)`
- Lignes : passim — par exemple [L170-L171] utilisent `p.rect`, [L174-L175] utilisent les helpers `drawTreeTheme`. Choix légitime (rect plein vs grille) mais un commentaire briefait les conventions aiderait.

### 5.4 Code mort / redondances
- Aucune fonction morte détectée.

### 5.5 Dette technique
- Les couleurs nuit forcées (`'#304028'` dans `drawTreeTheme` [L358]) sont hardcodées hors thème — incohérent avec `tc(n, ...)` utilisé ailleurs.

---

## 6. `js/ui.js`

### 6.1 Vue d'ensemble
5192 lignes. Le poids lourd : helpers IA, navigation onglets, modales, repas, habitudes, boutique, IA bulle/cadeau, IA soutien, IA bilan, perso, journal, progression, réglages, tablette rétro, bienvenue, agenda (jour/mois/cycle), init UI. Mélange massif de génération de HTML par templates string et de logique métier.

### 6.2 Points forts
- Header de navigation ([L9-L28]) maintenu.
- `callClaude()` ([L37-L63]) centralise les headers/URL — bonne pratique.
- `escape()` ([L89-L97]) protège contre XSS — appliqué sur la plupart des strings utilisateur.
- `lockScroll()` / `unlockScroll()` ([L274-L279]) — minimaliste et propre.
- `openModal()` ([L395-L409]) : pattern centralisé propre, force reflow pour rejouer l'animation.

### 6.3 Problèmes

#### 🔴 CRITIQUE — Cinq mécanismes différents pour ouvrir une "modale"
- Lignes : 
  1. `openModal()` ([L395]) — la voie centralisée.
  2. Manipulation directe `modal.style.display = 'flex'` + `mbox.innerHTML = ...` ([L351, L425, L488, L625, L1108, L1311, L1364, L1502, L1754, L1792, L1816, L2211, L3527, L4029] — au moins 14 occurrences).
  3. `etats-overlay` créé en JS ([L3893-L3967]) avec son propre z-index 1000 et son propre handler de fermeture.
  4. `tablet-overlay` HTML statique avec `.open` class ([L3434-L3482]).
  5. `menu-overlay` HTML statique avec `.open` class ([L281-L298]).
- Risque : Le scroll-lock, le focus management, la fermeture par Escape, la gestion des modales empilées sont tous incohérents. Le bug "modale non-bloquante" vient en partie de cette fragmentation. Cf. section spéciale plus bas.
- Suggestion : Unifier sous `openModal()` (cas 1 et 2). Pour `etats-overlay`, soit l'aligner sur `.modal` (z-index 300, mêmes classes), soit documenter qu'il vit volontairement à part. Idem pour `tablet-overlay` et `menu-overlay`.

#### 🟠 IMPORTANT — `modalLocked` global jamais documenté
- Lignes : [L378, L381]
- Description : Un boolean global qui empêche `clModal()` de fermer. Mis à `true` "pendant le soutien" d'après le commentaire mais aucune trace claire de son set/reset dans le fichier (à vérifier au-delà de mes lectures partielles).
- Risque : Si un crash empêche le reset, la modale reste bloquée définitivement.
- Suggestion : Préférer un attribut `data-locked` sur la modale ou un flag local au flow soutien.

#### 🟠 IMPORTANT — Boutons `✕` répliqués inline
- Lignes : [L1113, L1369, L4001]
- Description : Cf. quick win #3.
- Risque : Style divergent au fil du temps.

#### 🟠 IMPORTANT — `mbox.innerHTML = ...` injecte sans toujours passer par `escape()`
- Lignes : passim — par exemple [L466] utilise `escape(D.g.name)` ✅, mais [L630] interpole `${bday.message || ...}` sans escape (mais issue de USER_CONFIG → assumé safe).
- Risque : Si `USER_CONFIG` est manipulable (importé via `data/user_config.json`), un message contenant `<script>` pourrait s'exécuter.
- Suggestion : Soit escape systématique, soit documenter que `USER_CONFIG` est trusted.

#### 🟠 IMPORTANT — `go()` change `D.g.activeEnv` mais garde un environnement logique distinct
- Lignes : [L218-L246]
- Description : Quand on quitte l'onglet Gotchi pour Journal, le code force `chambre`. Quand on revient, il calcule selon `hr()`. Mais `_invEnvForced` est un flag séparé pour la preview inventaire. Trois sources de vérité (heure, onglet, preview).
- Risque : Bugs de cohérence (déjà arrivé : "à 21h sur l'inventaire montagne, ça repassait chambre").
- Suggestion : Centraliser dans `getEffectiveEnv(state)`.

#### 🟡 MINEUR — `tabletLastSeenDate` non préfixé `window.` (déjà identifié en v3.02, **non résolu**)
- Lignes : [L3432]
- Description : Variable module-level. Si la PWA recharge sans relire ce fichier, le badge se rallume à tort.
- Suggestion : Persister dans `D.tabletLastSeenDate`.

#### 🟡 MINEUR — `journalLocked` global ([L154]) — même problème
- Suggestion : Idem.

#### 🟡 MINEUR — `_agendaJour` exposé sur `window` mais `_invEnvForced` non
- Lignes : [L3985] vs [L223, L233, L237]
- Suggestion : Cohérence — préfixer ou non, mais pas mélangé.

#### 🟡 MINEUR — `confirmReset()` exécute `localStorage.removeItem` puis `location.reload()` inline
- Lignes : [L3424]
- Description : Le code fait `onclick="localStorage.removeItem('${SK}');location.reload()"` — chaîne JS dans un attribut HTML. Fragile (si `SK` contient un quote, casse).
- Suggestion : Wrapper dans une fonction nommée.

#### 🟡 MINEUR — `setEnergy` / `setHappy` modifient `el.textContent` puis appellent `saveDebounced`
- Lignes : `app.js` [L827-L838]
- Description : OK fonctionnellement, mais les anciens IDs `#sv-energy` ne sont plus utilisés que dans la modale dynamique.
- Suggestion : RAS.

#### 🔵 STYLE — Inline styles massifs (`style="..."`)
- Lignes : passim — quasiment chaque template string injecte 5-10 styles inline.
- Description : Difficile à thématiser, à overrider, à debugger.
- Suggestion : Migrer progressivement vers des classes CSS (`.btn-snack`, `.modal-header`, etc).

### 6.4 Code mort / redondances
- `toggleSliders()` ([L305]) : "supprimée — conservée vide" — code mort assumé.
- `floatXP` ([app.js L678]) défini mais utilisé une fois ([L724]).
- Plusieurs handlers `onclick="event.stopPropagation()"` sans documentation.

### 6.5 Dette technique
- 5192 lignes monolithiques. Aucune extraction par feature.
- Templates string de 80+ lignes injectés en innerHTML — illisibles, non testables.
- Le fichier exporte ~70 fonctions globales (`function X() { ... }`) sans aucun namespace UI.

---

## 7. `index.html`

### 7.1 Vue d'ensemble
635 lignes. Squelette PWA : meta tags, debug-panel inline (~85 l), structure DOM (#console-top, #dynamic-zone, panneaux), menu-overlay, modal, toast, tablet-overlay, scripts. Inclut un script `data/config.js` puis 4 JS dans `js/`, puis ui.js, puis enregistrement SW.

### 7.2 Points forts
- Meta PWA complets ([L7-L114]) : viewport, theme-color, apple-touch-icon, splash, manifest.
- Ordre des scripts respecté ([L606-L611]) — `render-sprites.js` après `envs.js`, `ui.js` en dernier.
- Structure DOM commentée par "SYSTEM" ([L137, L186, L294]).

### 7.3 Problèmes

#### 🟠 IMPORTANT — Debug panel inline (~85 lignes) dans `<head>`
- Lignes : [L13-L98]
- Description : Le code de capture d'erreurs et d'affichage du panneau debug est inline. Pas chargé en cache, présent en prod.
- Risque : Pollution du HTML, hooking d'erreurs qui peut masquer des erreurs réelles si toggle activé en prod.
- Suggestion : Extraire en `js/debug.js` — chargé conditionnellement.

#### 🟠 IMPORTANT — p5.js CDN sans `integrity` ni `crossorigin`
- Lignes : [L131]
- Description : `<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>` sans SRI hash.
- Risque : Si CDN compromis, exécution de JS arbitraire avec accès à la clé API Anthropic.
- Suggestion : Ajouter `integrity="sha384-..."` `crossorigin="anonymous"`.

#### 🟡 MINEUR — Masquage features dans script séparé en bas
- Lignes : [L614-L624]
- Description : Le DOMContentLoaded en bas masque le bouton agenda si `!showCycle && !showRDV`. Logique métier qui devrait être dans `ui.js`.
- Suggestion : Déplacer dans `initUI()`.

#### 🟡 MINEUR — `id="modal"` mais classe `class="modal"` — l'ID est suffisant
- Lignes : [L575]
- Suggestion : Choisir l'un ou l'autre, pas les deux.

#### 🔵 STYLE — Beaucoup d'`id` à valeur unique (`#g-name`, `#xp-l`, etc.)
- Description : OK pour une SPA mono-instance.

### 7.4 Code mort / redondances
- `<input type="file" id="import-file">` ([L463]) : `importD()` doit exister dans ui.js (non lu intégralement).

### 7.5 Dette technique
- Inline scripts dans le head, pas de Content-Security-Policy.

---

## 8. `sw.js`

### 8.1 Vue d'ensemble
69 lignes. Service Worker simple : install (cache-first des assets), activate (clean old caches), fetch (cache-first puis fallback réseau, mise en cache des nouvelles ressources locales).

### 8.2 Points forts
- Convention `CACHE_VERSION` claire ([L7]) avec sync app.js documentée.
- `skipWaiting()` ([L38]) + `clients.claim()` ([L51]) — bon pattern d'activation rapide.
- Bypass des appels externes ([L58]) — évite de mettre Anthropic API en cache.

### 8.3 Problèmes

#### ✅ RÉSOLU — `render-sprites.js` absent de `ASSETS`
- Lignes : [L25]
- Description : Ajouté lors du split ui.js (session 2026-04-30). Présent dans `ASSETS`.

#### 🟠 IMPORTANT — Cache-first sans vérifier `response.ok`
- Lignes : [L62-L66]
- Description : `fetch(e.request).then(response => { ...cache.put(e.request, clone)... })` met en cache même les 404, 500, redirections. Si un asset échoue la première fois, l'erreur reste en cache jusqu'au prochain `CACHE_VERSION` bump.
- Risque : PWA qui sert un HTML 404 indéfiniment.
- Suggestion : `if (response.ok) cache.put(...)`.

#### 🟠 IMPORTANT — Pas de message de mise à jour côté client
- Lignes : tout le fichier
- Description : Quand un nouveau SW est installé, l'utilisatrice ne sait pas qu'elle doit recharger. `skipWaiting` force l'activation mais les clients déjà ouverts ne sont pas notifiés.
- Suggestion : Écouter `navigator.serviceWorker.controllerchange` côté client + afficher un toast "Nouvelle version disponible".

#### 🟡 MINEUR — `manifest.json` a 502 octets non audité
- Description : Pas dans le scope, mais `theme_color` doit s'aligner sur `index.html` [L103].

#### 🔵 STYLE — Pas de logging des erreurs cache.put
- Suggestion : `.catch(e => console.warn('SW cache error', e))`.

### 8.4 Code mort / redondances
- Aucun.

### 8.5 Dette technique
- Pas de stratégie différenciée (network-first pour les JSON dynamiques par exemple).

---

## ✅ Section spéciale — Bug "modale non-bloquante" — RÉSOLU (2026-04-30)

### Cause racine (synthèse)

Trois facteurs cumulés causaient le bug :

1. **Pas de `pointer-events:auto` explicite** sur `.modal`, `.menu-overlay`, `#tablet-overlay`, `#etats-overlay` → les taps pouvaient traverser vers les éléments derrière.
2. **`lockScroll()` absent de la majorité des ouvertures** (14+/20) → `#dynamic-zone` restait scrollable derrière toute modale ouverte directement.
3. **Scroll natif iOS/Safari** (`rubber-band` / momentum) : même avec `overflow-y:hidden` et `touch-action:none`, WebKit continue de propager les gestes de scroll aux éléments sous la modale — contournable uniquement via `preventDefault()` sur `touchmove` au niveau `document`.

### Fixes appliqués

#### `css/style.css`
- `.app-overlay` créée : `position:fixed; inset:0; pointer-events:auto` — classe partagée pour tous les overlays.
- `.modal` : `pointer-events:auto` ajouté explicitement.
- `.menu-overlay` : `position`/`inset` délégués à `.app-overlay`.
- `#tablet-overlay` : idem.

#### `index.html`
- `#menu-overlay` : classe `app-overlay` ajoutée.
- `#tablet-overlay` : classe `app-overlay` ajoutée.

#### `js/ui-core.js`
- **Convention documentée** en tête du bloc MODALE CENTRALE.
- **`_setInert(active)`** ajoutée : active/désactive `inert` sur `#console-top` et `#dynamic-zone`.
- **`openModal()`** : appelle `lockScroll()` (qui gère inert automatiquement).
- **`clModal()`** : appelle `unlockScroll()` (retire inert).
- **`openModalRaw(html)`** ajoutée : même chose sans ✕ auto (pour boutique/agenda/soutien).
- **`toastModal()`** : passe désormais par `openModal()`.
- **`lockScroll()`** — trois mécanismes combinés :
  1. `body.overflow = 'hidden'`
  2. `#dynamic-zone : overflowY = 'hidden'` + `touchAction = 'none'`
  3. `_setInert(true)` sur `#console-top` et `#dynamic-zone`
  4. **Listener `touchmove` avec `preventDefault()`** sur `document` (passive:false) — seul mécanisme efficace contre le scroll natif iOS/Safari. Le listener laisse passer les `touchmove` ciblant un élément scrollable de la modale (modal-box, boutique-contenu, etc.) et bloque uniquement ceux qui atteignent le fond.
- **`unlockScroll()`** : retire les trois mécanismes + supprime le listener `touchmove`.
- **`_touchmoveBlocker`** : référence module-level au listener actif, pour retrait propre.

#### `js/ui-settings.js`
- **`openTablet()`** : `lockScroll()` + listener `Escape` ajoutés.
- **`closeTablet()`** : `unlockScroll()` ajouté.
- **`ouvrirModalEtats()`** : `pointer-events:auto` sur le style inline + `lockScroll()` + listener `Escape`.
- **`fermerModalEtats()`** : `unlockScroll()` ajouté.

### État résiduel (non bloquant)

- Les 14+ ouvertures directes de `#modal` (ouvrirSnack, confirmerSuppressionIA, voirBulles, etc.) **bypassent encore `openModal()`** mais appellent toutes `lockScroll()` via la chaîne → le scroll iOS est bloqué partout. La centralisation complète vers `openModal()`/`openModalRaw()` reste souhaitable pour la cohérence (item #6 Phase 2) mais n'est plus urgente.
- `ouvrirSnack()` (4 cas) n'appelle pas `lockScroll()` → scroll encore possible pendant l'affichage snack. À corriger en Phase 2.
- Focus trap et `aria-hidden` non implémentés — accessibilité clavier encore partielle (item #21 Phase 3).

### Z-index hiérarchie (inchangée)
- `.menu-languette` : 150
- `.menu-overlay` : 200 + `.app-overlay`
- `.modal` : 300
- `#tablet-overlay` : 400 + `.app-overlay`
- `#toast` : 500
- `#update-banner` : 999
- `#etats-overlay` (créé en JS) : 1000

---

## Section finale — Plan de refactoring priorisé

### Phase 1 — Corrections urgentes (bugs actifs, perte données)

| N° | Titre | Fichiers | Effort | Bénéfice |
|---|---|---|---|---|
| 1 | ✅ Ajouter `render-sprites.js` à `ASSETS` du SW | `sw.js` [L25] | S | Fix critique offline |
| 2 | Vérifier `response.ok` avant `cache.put` | `sw.js` [L62-L66] | S | Évite les 404 cachés |
| 3 | ✅ Fix modale non-bloquante — scroll iOS bloqué | `css/style.css`, `index.html`, `js/ui-core.js`, `js/ui-settings.js` | M | Fix bug critique UX |
| 4 | Bumper sync `APP_VERSION` à `'hg-v4.5'` si convention | `js/app.js` [L54] + `sw.js` [L7] | S | Cohérence |
| 5 | ✅ Supprimer signature legacy de `addEvent` | `js/app.js` [L648-L659] | S | API unifiée — FAIT 2026-04-30 |

### Phase 2 — Stabilisation (dette technique, doublons)

| N° | Titre | Fichiers | Effort | Bénéfice |
|---|---|---|---|---|
| 6 | Centraliser les 14+ ouvertures directes sous `openModal()`/`openModalRaw()` | modules `ui-*.js` | M | Cohérence UX — scroll iOS déjà bloqué via lockScroll(), reste à unifier l'animation et le ✕ |
| 7 | Extraire `getStageBaseY()` (déduplication 3×) | `js/render.js` | S | Lisibilité |
| 8 | Extraire `getEffectiveEnv()` | `js/ui.js` go() + `js/app.js` | M | Source de vérité unique |
| 9 | ~~Étendre `HG_CONFIG` aux constantes XP/EN/HA/POOP~~ ✅ résolu 2026-04-30 | `data/config.js` | S | Hygiène globale |
| 10 | Persister `tabletLastSeenDate` et `journalLocked` dans D | `js/ui.js` | S | Robustesse PWA |
| 11 | Supprimer code mort `_bounceT`, `_lastPetTime`, `walkStep` | `js/render.js` | S | Lisibilité |
| 12 | Extraire le debug-panel inline dans `js/debug.js` | `index.html` [L13-L98] | S | Allègement HTML |
| 13 | Ajouter SRI sur p5.js CDN | `index.html` [L131] | S | Sécurité supply chain |
| 14 | Notifier l'utilisatrice quand un nouveau SW est dispo | `sw.js` + `index.html` | M | UX update |

### Phase 3 — Amélioration structurelle (découpage, centralisation, tests)

| N° | Titre | Fichiers | Effort | Bénéfice |
|---|---|---|---|---|
| 15 | Découper `p.draw()` en sous-fonctions thématiques | `js/render.js` [L330-L896] | L | Maintenabilité |
| 16 | ✅ Découper `ui.js` (5192 l) en modules par feature | `js/ui-core.js` (300 l), `js/ui-nav.js` (155 l), `js/ui-habs.js` (179 l), `js/ui-shop.js` (1047 l), `js/ui-ai.js` (918 l), `js/ui-journal.js` (342 l), `js/ui-agenda.js` (1204 l), `js/ui-settings.js` (1307 l) | L | Maintenabilité |
| 17 | Migrer les inline-styles vers classes CSS | `js/ui.js` + `css/style.css` | L | Thématisation |
| 18 | Extraire `drawParc/Chambre/Montagne` de `drawActiveEnv` | `js/envs.js` | M | Lisibilité |
| 19 | Découpler `render-sprites.js` de `render.js` (variables module) | les deux | M | Modularité |
| 20 | Ajouter une suite de tests automatisés (Jest/Vitest) | nouveau `tests/` | L | Régressions |
| 21 | Implémenter focus trap + Escape close pour toutes modales | modules `ui-*.js` | M | Accessibilité — Escape déjà ajouté sur tablet-overlay et etats-overlay, reste #modal et autres |
| 22 | Ajouter Content-Security-Policy en meta | `index.html` | S | Sécurité |

---

## Glossaire des fonctions clés

### `data/config.js`
| Fonction | Rôle | Appelée par | Appelle |
|---|---|---|---|
| (aucune) | constantes pures | — | — |

### `js/app.js`
| Fonction | Rôle | Appelée par | Appelle |
|---|---|---|---|
| `today()` / `todayFr()` / `hr()` | utilitaires temps | partout | — |
| `loadDataFiles()` | charge JSON props/contexts/system | `bootstrap()` | `fetch`, `save`, `renderProps`, `updBadgeBoutique` |
| `defs()` | structure D par défaut | `load()`, `migrate()` | — |
| `getCyclePhase()` | calcule phase menstruelle | UI agenda | — |
| `migrate(d)` | applique MIGRATIONS | `load()` | les `mN()` |
| `load()` / `save()` | LocalStorage | bootstrap, partout | `migrate`, `JSON` |
| `addXp(n)` | +/- XP, animation stade | `toggleHab`, cheats | `getSt`, `triggerEvoAnim`, `addEvent`, `flashBubble`, `save`, `updUI` |
| `spawnPoop` / `maybeSpawnPoop` / `cleanPoops` / `catchUpPoops` | gestion crottes | `bootstrap`, intervals, render touch | `save`, `updUI`, `toast`, `flashBubble`, `addEvent` |
| `giveSnack(emoji)` | nourriture +XP | UI snack | `triggerExpr`, `save`, `addEvent`, `flashBubble`, `updUI` |
| `toggleHab(catId)` | check/uncheck habitude | UI | `addXp`, `addEvent`, `floatXP`, `flashBubble`, `triggerExpr`, `save`, `updUI`, `renderHabs` |
| `addEvent(...)` | log événement | métier | `updTabletBadge` |
| `flashBubble` / `updBubbleNow` | dialogue gotchi | partout | — |
| `fetchMeteo` / `fetchSolarPhases` / `getSolarPhase` | API météo | bootstrap, intervals | `fetch`, `save`, `updMeteoIcons`, `animEl` |
| `bootstrap()` | point d'entrée | `load`/`pageshow` | tout |

### `js/render.js`
| Fonction | Rôle | Appelée par | Appelle |
|---|---|---|---|
| `getBreath` / `getCheekPulse` | helpers anim | sprites | — |
| `triggerExpr(mood,d)` | déclenche expression | app.js, render touch | — |
| `getGotchiC` / `getEnvC` | résout couleurs depuis HG_CONFIG | `p.draw` | — |
| `drawProp(p, prop, x, y)` | rendu pixel art prop | `p.draw`, `drawAccessoires` | `pxFree` |
| `spawnP(x,y,c)` | particule | toggleHab, render | — |
| `drawSky` / `drawCl` / `drawZzz` / `updateParts` | écosystème | `p.draw` | `getSolarPhase`, `px` |
| `triggerTouchReaction(sleep)` | réaction tactile | touch | `flashBubble` |
| `p.setup` / `p.draw` | boucle p5 | p5 lib | tout le rendu |
| `p.touchStarted` / `p.touchMoved` / `p.touchEnded` | gestion tactile canvas | p5 | `cleanPoops`, `ouvrirSnack`, `ouvrirModalEtats`, `triggerExpr`, `changeEnv`, `triggerTouchReaction`, `spawnP`, `addEvent`, `save` |

### `js/render-sprites.js`
| Fonction | Rôle | Appelée par | Appelle |
|---|---|---|---|
| `drawDither(p,x,y,w,h,c)` | damier épuisement | sprites | `px` |
| `drawSaleteDither(p,stage,cx,cy,salete,sl)` | boue par silhouette | sprites | (interne) |
| `drawAccessoires(p,cx,anchors,stage,sl)` | accessoires anchor | sprites | `getPropDef`, `drawProp` |
| `drawEgg/Baby/Teen/Adult` | sprites par stade | `p.draw` | helpers ci-dessus |

### `js/envs.js`
| Fonction | Rôle | Appelée par | Appelle |
|---|---|---|---|
| `px` / `pxFree` | brique élémentaire | partout | `p.rect` |
| `tc(n,col)` / `shadeN(hex,r)` | jour/nuit | partout | — |
| `drawWind` / `drawRain` / `drawRainbow` / `drawSun` / `drawFog` | météo | `p.draw` | `px` |
| `drawActiveEnv(p,env,n,h)` | dispatcher biomes | `p.draw` | `tc`, `drawTreeTheme`, `drawCactus`, `drawFrameMotif`, `drawThemeAccents` |
| `drawTreeTheme/Cactus/Fl` | helpers décor | drawActiveEnv | `px` |

### `js/ui.js`
| Fonction | Rôle | Appelée par | Appelle |
|---|---|---|---|
| `callClaude({...})` | wrapper API Anthropic | askClaude, soutien, bilan, cadeau | `fetch` |
| `escape(s)` | XSS-sanitize | partout | — |
| `lockScroll`/`unlockScroll` | scroll body | openModal, toggleMenu | — |
| `openModal(html)` / `clModal(e)` / `toastModal(m)` | modales | UI | `_modalCloseBtn`, `_fermerMenuSiOuvert`, `unlockScroll` |
| `go(t)` / `goMenu(t)` / `toggleMenu` | navigation | UI | `renderHabs`, `renderProg`, `renderProps`, `renderPerso`, `renderJ`, `syncDuringTransition` |
| `updUI()` | refresh HUD | métier | `getSt`, `nxtTh`, `calcStr`, `updThoughtFlowers`, `updJournalFlowers`, `updBadgeBoutique` |
| `ouvrirSnack` | popup snack | render touch, HUD | `getCurrentMealWindow`, `ensureMealsToday`, `pickThreeSnacks`, `giveSnack` |
| `ouvrirEditionHabitudes` / `sauvegarderToutesHabitudes` | renommer/réordonner | UI | `openModal`, `save`, `renderHabs` |
| `ouvrirBoutique` / `acheterProp` / `toggleProp` / `openSlotPicker*` | boutique | UI | `addEvent`, `save`, `renderProps`, `updBadgeBoutique` |
| `askClaude` / `genSoutien` / `sendSoutienMsg` / `genBilanSemaine` | IA | UI | `callClaude`, `flashBubble`, `addEvent` |
| `openTablet` / `closeTablet` / `updTabletBadge` | tablette rétro | UI | — |
| `checkWelcome` / `showWelcomeModal` | wizard 1er lancement | bootstrap | `openModal`, `save` |
| `ouvrirAgenda` / `switchAgenda` / `renderAgendaJour/Mois/Cycle` | agenda | UI | `getCyclePhase`, `save` |
| `ouvrirModalEtats` / `fermerModalEtats` | bottom sheet | render touch | `setEnergy`, `setHappy` |
| `confirmReset` | reset total | UI | `openModal`, `localStorage.removeItem` |
| `initUI()` | init complète UI | `bootstrap()` (app.js) | `updUI`, `syncConsoleHeight`, `renderHabs`, `renderProps`, `restorePerso`, `initMoodPicker`, `checkWelcome`, `updBubbleNow` |

---

## Historique des sessions de refactoring

### Session — 2026-04-30 : Split ui.js + fix SW

**Objectif** : Découper `ui.js` (5192 l) en 8 modules par feature (item #16 du plan Phase 3).

**Fichiers créés** :

| Fichier | Lignes | Contenu |
|---|---|---|
| `js/ui-core.js` | 300 | callClaude, escape/escapeHtml (unifiés), chevron, animEl, toast/modal/scroll, menu overlay |
| `js/ui-nav.js` | 155 | go(), syncConsoleHeight(), syncDuringTransition(), updDate() |
| `js/ui-habs.js` | 179 | renderHabs, editHabInline, saveHabInline, deplacerHab, ouvrirEditionHabitudes, sauvegarderToutesHabitudes |
| `js/ui-shop.js` | 1047 | Boutique, props, inventaire, slots, long press, rangement, switcher env, debugProps, viderObjetsIA |
| `js/ui-ai.js` | 918 | startThinkingAnim, getRegistre, getExemples, askClaude, acheterPropClaude, toastInfo, genSoutien, sendSoutienMsg, genBilanSemaine, navW, navM |
| `js/ui-journal.js` | 342 | journalLocked (déclaré ici), renderPin, renderJ, initMoodPicker, saveJ, renderJEntries, getWkDates, exportJournal |
| `js/ui-agenda.js` | 1204 | ouvrirAgenda, renderAgendaJour/Mois/Cycle, sauvegarderRdv, supprimerRdv, declarerRegles, modifierCycle, copierCycles |
| `js/ui-settings.js` | 1307 | ouvrirSnack, updUI/updThoughtFlowers/updBilanFlowers/updJournalFlowers, renderPerso, renderProg, saveName/saveApi/savePin/exportD/importD, openTablet, checkWelcome, ouvrirModalEtats, window.initUI |

**Ordre de chargement dans `index.html`** :
`config.js` → `app.js` → `render.js` → `envs.js` → `render-sprites.js` → `ui-core.js` → `ui-habs.js` → `ui-shop.js` → `ui-ai.js` → `ui-journal.js` → `ui-settings.js` → `ui-agenda.js` → `ui-nav.js` *(en dernier car go() dépend de toutes les render*)*

**sw.js mis à jour** : `render-sprites.js` ajouté (fix item #1), `ui.js` remplacé par les 8 modules dans `ASSETS`.

**Corrections additionnelles** :
- `journalLocked` : variable déplacée de la section navigation vers `ui-journal.js` où elle est gérée
- `escapeHtml` : alias unifié sur `escape()` dans `ui-core.js` (suppression doublon)
- `toastInfo()` : bien déclarée dans `ui-ai.js` (modale d'info quota soutien) — ne pas confondre avec toast()
- `delJEntry` : formatage corrigé (collage `}function` dans l'original)
- `getWeekId` doublon : confirmé absent de ui.js (déjà résolu en session antérieure — item Session 1 audit clos)

**`ui.js` original** : conservé intact, non supprimé. À archiver ou supprimer manuellement après validation en prod.

---

### Session — 2026-04-30 : Fix bug "modale non-bloquante" (item #3 Phase 1)

**Objectif** : Empêcher les interactions avec le contenu derrière les modales, en particulier le scroll sur iOS/Safari.

**Fichiers modifiés** : `css/style.css`, `index.html`, `js/ui-core.js`, `js/ui-settings.js`, `AUDIT.md`

**Ce qui a été fait** :

- `css/style.css` : classe `.app-overlay` créée (`position:fixed;inset:0;pointer-events:auto`) ; `pointer-events:auto` ajouté sur `.modal` ; `position`/`inset` de `.menu-overlay` et `#tablet-overlay` délégués à `.app-overlay`.
- `index.html` : classe `app-overlay` ajoutée sur `#menu-overlay` et `#tablet-overlay`.
- `js/ui-core.js` :
  - `_setInert(active)` ajoutée — active/désactive `inert` sur `#console-top` et `#dynamic-zone`.
  - `openModal()` et `clModal()` : appellent `lockScroll()`/`unlockScroll()` (qui gèrent inert).
  - `openModalRaw(html)` ajoutée — variante sans ✕ auto pour boutique/agenda/soutien.
  - `toastModal()` : passe désormais par `openModal()`.
  - `lockScroll()` renforcé : `body.overflow:hidden` + `#dynamic-zone overflowY:hidden + touchAction:none` + `_setInert(true)` + **listener `touchmove` avec `preventDefault()` sur `document`** (passive:false) — seul mécanisme efficace contre le rubber-band iOS/Safari. Le listener inspecte la chaîne de parents pour laisser passer les `touchmove` ciblant un élément scrollable de la modale.
  - `unlockScroll()` : retire tous les mécanismes + `removeEventListener` du `touchmoveBlocker`.
- `js/ui-settings.js` :
  - `openTablet()` : `lockScroll()` + listener `Escape` ajoutés.
  - `closeTablet()` : `unlockScroll()` ajouté.
  - `ouvrirModalEtats()` : `pointer-events:auto` inline + `lockScroll()` + listener `Escape`.
  - `fermerModalEtats()` : `unlockScroll()` ajouté.

**Résultat** : scroll iOS bloqué derrière toutes les modales qui appellent `lockScroll()`. Vérifié sur navigateur desktop (DevTools) et iPhone.

**Reste à faire (non urgent)** :
- `ouvrirSnack()` (4 cas) n'appelle pas `lockScroll()` → scroll encore possible pendant le snack → item #6 Phase 2.
- Centralisation complète des 14+ ouvertures directes vers `openModal()`/`openModalRaw()` → item #6 Phase 2.
- Focus trap et `aria-hidden` → item #21 Phase 3.

---

### Session — 2026-04-30 : Résolution des 3 problèmes critiques restants

**Objectif** : Clore les 3 🔴 du Top 3 issues (bugs 1, 2, 3).

**État constaté à l'entrée de session** :
- Bug 1 (`render-sprites.js` absent SW) : **déjà corrigé** lors du split ui.js — présent à `sw.js` [L25].
- Bug 2 (modale non-bloquante) : **déjà corrigé** lors de la session précédente — section spéciale présente et complète.
- Bug 3 (`addEvent` double signature) : **en attente** — branche legacy toujours présente.

**Correction appliquée** :

**`js/app.js` [L648-L659]** — `addEvent` :
- Signature `function addEvent(type, valeur, label)` remplacée par `function addEvent(ev)`.
- La branche ternaire `(typeof type === 'object') ? ... : ...` supprimée.
- La fonction n'accepte désormais qu'un objet `{ type, subtype, valeur, label }`.
- Horodatage et spread dans `entry` conservés, logique simplifiée.
- Vérification préalable : 0 appel legacy détecté dans l'ensemble du codebase (app.js, ui-ai.js, ui-journal.js, ui-settings.js, render.js, ui-shop.js).

**Mise à jour AUDIT.md** :
- Top 3 : tous marqués ✅.
- Tableau santé `sw.js` : C → C+ (render-sprites.js confirmé présent).
- Section 2.3 `app.js` : bug addEvent marqué résolu.
- Section 8.3 `sw.js` : bug render-sprites.js marqué résolu.
- Plan Phase 1 item 5 : marqué ✅.

---

### Session — 2026-04-30 : Fix 3 bugs bootstrap / forceUpdate

**Objectif** : Résoudre les deux 🟠 IMPORTANT et le 🟡 MINEUR signalés sur `app.js`.

**Fichier modifié** : `js/app.js`

**Corrections appliquées** :

**1. `bootstrap()` — `setInterval` derrière la garde (🟠 → ✅)**
- `fetchMeteo()`, `fetchSolarPhases()` et les deux `setInterval` déplacés à l'intérieur du `.then()` de `loadDataFiles()`, juste avant `_appInitialized = true`.
- Résultat : impossible d'empiler des timers même si `bootstrap()` est appelée plusieurs fois — les timers ne s'initialisent qu'une seule fois, sous la condition implicite que la promesse de chargement s'est résolue.
- `clearInterval` conservés pour la sécurité (no-op si null).

**2. `forceUpdate()` — gestion SW + await (🟠 + 🟡 → ✅)**
- Fonction réécrite en `async`.
- Étape 1 : `navigator.serviceWorker.getRegistrations()` + `await Promise.all(regs.map(r => r.unregister()))` — désinstalle tous les SW avant rechargement.
- Étape 2 : `await caches.keys()` + `await Promise.all(names.map(n => caches.delete(n)))` — vide tous les caches en attendant la fin réelle de chaque suppression.
- Étape 3 : `window.location.reload()` — déclenché seulement une fois les deux étapes async terminées.
- `setTimeout(500ms)` supprimé — plus de race condition possible.

---

### Session — 2026-04-30 : Résolution des 4 items 🟡 MINEUR app.js (S3/S4)

**Objectif** : Traiter les 4 items mineurs signalés sur `app.js` (bulles, MSG fallback, floatXP).

**Fichier modifié** : `js/app.js`

**Items traités** :

**1. `flashBubble()` + `updBubbleNow()` — XSS (🟡 × 2 → ✅ sans modification code)**
- `el.textContent` est XSS-safe par construction — aucun risque d'injection. Items clos sans toucher au code.

**2. `MSG` fallback — documentation (🟡 → ✅)**
- Commentaire "RÔLE / POURQUOI" ajouté au-dessus de `const MSG`. Précise que c'est un fallback défensif (1er lancement hors-ligne / race async), jamais affiché en usage normal. Conservé intentionnellement.

**3. `floatXP` — `font-size` tokenisé (🟡 → ✅)**
- `font-size:11px` → `font-size:var(--fs-xs)` dans le `cssText` de `floatXP()`. Valeur identique (11px = `--fs-xs`), mais désormais liée au système de design.
- `font-weight:bold` conservé — pas de variable `--fw-*` dans le projet, `bold` hardcodé est la convention partout.

---

*Fin de l'audit v4.5 — 2026-04-30*
