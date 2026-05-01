# AUDIT HabitGotchi v4.5 — 2026-04-30

> Audit complet sur la branche `main`, version `v4.5`. Lecture intégrale de `data/config.js` (243 l), `js/app.js` (1241 l), `js/render.js` (1173 l), `js/render-sprites.js` (620 l), `js/envs.js` (438 l), `js/ui.js` (5192 l), `index.html` (635 l), `sw.js` (69 l). Parcours rapide de `prompts/ai_contexts.json`, `prompts/ai_system.json`, `data/props.json`. Ancien `AUDIT.md` (v3.02) consulté uniquement comme référence de format.
>
> **Session refactoring 2026-04-30** : `ui.js` (5192 l) découpé en 8 modules — voir section "Historique des sessions" en fin de fichier. `sw.js` mis à jour (ajout `render-sprites.js` + 8 modules ui, retrait `ui.js`). `index.html` mis à jour (ordre de chargement). `getWeekId` doublon confirmé absent (déjà supprimé). `escapeHtml` unifié sur `escape` dans `ui-core.js`.
>
> **Session quick wins 2026-04-30** : 3 quick wins résolus — `getStageBaseY()` dans `render.js` (déduplication ternaire `by`), `clearInterval` + handles module-level dans `app.js` (intervals nettoyés), `window._modalCloseBtn(onclick)` exposé depuis `ui-core.js` et appliqué dans 5 modales (`ui-shop.js` ×4, `ui-agenda.js` ×1, `ui-ai.js` ×1).
>
> **Session refactoring render.js + fix slider 2026-04-30** : `p.draw()` (~570 l) découpé en 4 sous-fonctions locales (`drawPropsLayer`, `drawHUD`, `drawBadges`, `drawEnvSelector`) — orchestrateur réduit à ~310 l. Fix bug `lockScroll` : `_touchmoveBlocker` dans `ui-core.js` bloquait les `touchmove` sur `input[type=range]` (pas d'ancêtre scrollable → `preventDefault()` annulait le drag du thumb sur iOS/WebKit). Correction : garde `if (e.target.type === 'range') return` ajoutée en tête du blocker.
>
> **Session bugs mineurs render.js 2026-04-30** : 3 bugs mineurs résolus dans `render.js` — `_lastTapTime` encapsulé dans `window._tapState { lastTime }`, tableau étoiles extrait en `const STARS` (~L178), commentaire `darkAlpha` reformulé (overlay dessiné AVANT le HUD, pas le contraire).
>
> **Session nettoyage render.js 2026-04-30** : 5 corrections dans `render.js` — (1) `_envSelectorHits` mis en cache : tableau reconstruit uniquement quand `activeEnv` ou `_envSelectorOpen` change (`window._envSelectorCache` ajouté) ; (2) magic numbers hitbox remplacés par `const GOTCHI_HITBOX = { rX:26, rY:35, centerOffsetY:30 }` ; (3) commentaires RÔLE/POURQUOI ajoutés pour justifier ternaire vs if/else dans le bloc marche ; (4) code mort supprimé : `window._bounceT` (jamais lu, remplacé par commentaire explicatif), `walkStep` (incrémenté mais jamais lu — variable + `window._walk.step` supprimés), `window._lastPetTime` (écrit mais jamais relu — ligne supprimée, commentaire en place).
>
> **Session bugs mineurs render-sprites.js 2026-04-30** : 2 bugs mineurs résolus dans `render-sprites.js` — (1) `dejaDessines` : `new Set()` par frame remplacé par `_dejaDessinesObj = {}` module-level, réinitialisé manuellement à chaque appel (`for...in delete`) — plus d'allocation Set × 12 fps ; (2) `isMood(name)` : helper ajouté en §4b, centralise le test `moodTimer > 0 && lastMood === name` — les ~8 occurrences dupliquées dans `drawTeen` et `drawAdult` remplacées par des appels `isMood('joie')`, `isMood('faim')`, `isMood('surprise')`.
>
> **Vérification version** : `window.APP_VERSION = 'v4.5'` ([app.js L54](js/app.js#L54)) — ⚠️ la consigne mentionnait `'hg-v4.5'` mais le code stocke uniquement `'v4.5'`. Le `CACHE_VERSION` de `sw.js` ([L7](sw.js#L7)) est aligné `'v4.5'`. Cohérence OK entre les deux fichiers, mais préfixe `hg-` non utilisé.
>
> **Session bugs mineurs envs.js 2026-04-30** : 5 corrections dans `envs.js` — (1) `drawActiveEnv` découpé en `drawParc`, `drawChambre`, `drawMontagne` + dispatcher `switch` (130 lignes → orchestrateur ~8 lignes + 3 fonctions lisibles) ; (2) magic numbers `drawFog` remplacés par `FOG_LAYERS_GROUND = 5` et `FOG_LAYERS_HIGH = 4` ; (3) `tc()` : fallback `Number(n)` ajouté + valeur par défaut `n=0` pour rétrocompat booléen ; (4) couleur hardcodée `'#304028'` dans `drawTreeTheme` remplacée par `tc(n, colLeaf)` / `tc(n, colLeaf2)` — cohérent avec le reste du système nuit ; (5) convention `p.rect` vs `px()` documentée dans un bloc commentaire au-dessus du dispatcher.
>
> **Session bugs modales 2026-04-30** : vérification des 5 bugs signalés — état réel constaté et traité. (1) `ouvrirSnack()` dans `ui-settings.js` : 4 ouvertures directes `modal.style.display + mbox.innerHTML` migrées vers `openModal()`. (2) `ouvrirAgenda()` dans `ui-agenda.js` : migré vers `openModalRaw()`, classes CSS `shop-open`/`agenda-open` conservées et appliquées après. (3) `modalLocked` documenté comme partiellement résolu (reset uniquement via ✕ soutien — risque résiduel crash documenté). (4) Escape sur `USER_CONFIG` documenté comme trusted. (5) `go()` : logique commentée, `getEffectiveEnv()` reporté Phase 2.
>
> **Session bugs index.html 2026-04-30** : 4 corrections dans `index.html` et fichiers associés — (1) Debug panel inline (~85 l) extrait dans `js/debug.js`, remplacé par `<script src="js/debug.js">` dans `<head>`, ajouté dans `ASSETS` de `sw.js` ; (2) SRI hash sha384 ajouté sur p5.js CDN + `crossorigin="anonymous"` (hash vérifié par curl/openssl) ; (3) masquage `#btn-menu-agenda` déplacé de `DOMContentLoaded` inline vers `initUI()` dans `ui-settings.js` — guard `typeof` ajouté ; (4) `class="modal"` retiré de `#modal` dans `index.html`, sélecteur `.modal` → `#modal` dans `style.css`.
>
> **Session bugs sw.js 2026-04-30** : 3 corrections dans `sw.js` et `index.html` — (1) Guard `response.ok` ajouté avant `cache.put()` dans le handler `fetch` ([L77]) : les réponses 404/500/redirections ne sont plus mises en cache ; (2) Bandeau `#update-banner` ajouté dans `index.html` (élément DOM + CSS déjà en place, z-index 999) + listener `controllerchange` ajouté dans le bloc d'enregistrement SW ([index.html L558-L574]) — l'utilisatrice voit un bandeau cliquable dès qu'un nouveau SW prend le contrôle ; (3) `.catch(err => console.warn('SW cache error', err))` ajouté sur `cache.put()` — erreurs d'écriture cache désormais visibles dans la console. Note : `theme_color` dans `manifest.json` déjà aligné sur `index.html` L21 (`#ddd6e8`) — aucune correction nécessaire. Note : `manifest.json` contient un JSON invalide (virgule manquante après `start_url`) — signalé, hors scope de cette session.
>
> **Session fix pupilles 2026-04-30** : 1 bug corrigé dans `render-sprites.js` — Reflets blancs flottants des yeux (`drawTeen` L983–984, `drawAdult` L1424–1425) : hauteur réduite de **4px → 3px** et amplitude recalculée. Cause : le reflet à 4px de haut descendait dans la rangée basse de l'iris (plus étroite que la rangée haute), créant un débordement visible du blanc hors du noir → pupilles "qui sortent" de l'œil. À 3px de haut, le reflet reste confiné dans la rangée haute (5px d'espace vertical). Teen : amplitude `PX*2 - 4 - 3 = 3` → `PX*2 - 3 - 2 = 5`. Adult : amplitude `PX*3 - 4 - 4 = 7` → `PX*3 - 3 - 2 = 10`.
>
> **Session fix rendu flou mobile 2026-04-30** : 1 correction dans `render.js` — `p.setup()` : `pixelDensity(1)` remplacé par `pixelDensity(window.devicePixelRatio || 1)` appelé AVANT `createCanvas()`. Sur iPhone/Android Retina (dpr=2 ou 3), le canvas interne est maintenant créé à CS×dpr pixels → affiché à la même taille CSS (100% du conteneur, inchangé) mais sans upscaling navigateur → rendu net. `noSmooth()` conservé.
>
> **Session crottes + bain 2026-04-30** : 4 corrections. (1) Messages non-binaires bain : "frais et pimpant" → "léger·e et propre", "je sens si bon" → "quelle bonne odeur" + autres reformulations neutres. (2) Spawn crottes matinal : `catchUpPoops()` refactorisé — déduit maintenant les heures de sommeil (22h–7h = 9h) du delta d'inactivité + plafonne à 2 crottes max au bootstrap (les autres via interval). (3) `maybeSpawnPoop()` : guard ajouté, ne spawne plus entre 22h et 7h. (4) `initApp()` : guard `isSleepTime` ajouté sur le spawn au bootstrap.
>
> **Session amélioration bain 2026-04-30** : 3 améliorations dans `render.js:touchMoved`. (1) Moteur particules (`render.js:581`) : champ optionnel `pt.r` ajouté — la taille est `pt.r || PX`, rétrocompat totale. (2) Bulles de bain : 5 → 12 par tick, mélange grandes (r=PX*2=10px, life=22, 60%) + petites (r=PX=5px, life=14), vitesse ascendante douce, zone ±40px, 3 teintes (bleu clair / blanc / bleu pâle). (3) Gain `happiness` : +1 par point de saleté retiré (plafonné 100) — feedback immédiat pendant le frottement, en plus du gain de pétales à la fin.
>
> **Session déclencheurs étirement + bâillement 2026-05-01** : 2 améliorations comportementales. (1) Étirement matinal : déplacé de `p.draw()` (h===7 dans la boucle de rendu, souvent manqué) vers `app.js:bootstrap()` — `triggerEtirementMatin()` exposée sur `window` depuis `render.js`, appelée avec `setTimeout 1500ms` si `hNow >= 7 && hNow < 12` au premier chargement. `flashBubble()` modifiée : détecte `*s'étire*` dans le message → `triggerEtirementMatin(force=true)` (bypass verrou), et `*sautille*`/`*saute*`/`*fait des bonds*` → `triggerGotchiBounce()` — synchronisation geste/animation sur toutes les bulles matin du streak. (2) Bâillement : seuil `YAWN_THRESHOLD` rendu dynamique — `YAWN_THRESHOLD_NORMAL = 2160f` (~3 min) si énergie > 30, `YAWN_THRESHOLD_LOW = 720f` (~1 min) si énergie ≤ 30 ; bâillement au bootstrap : 15% de probabilité (hors egg), montée à 35% si énergie ≤ 30, déclenché à `setTimeout 2800ms` pour ne pas chevaucher l'étirement. `node --check` : ✅ syntaxe OK (render.js + app.js).
>
> **Session réglages animations 2026-05-01** : 4 animations ajustées après test visuel. (1) `saut_joie` : duration `20→12f`, amplitude `22→28px` — saut plus vif et punchy. (2) `etirement_t1` : duration `12→30f` + `yFn` montée corps `0→-PX*2` sur 30f (illusion allongement) — bras restent visibles ~2.5s ; setTimeout t2 `(30/12)*1000ms`, t3 `(42/12)*1000ms` — synchronisé dans déclencheur auto ET `__hg.etirement()`. (3) `frisson` : amplitude `±PX (5px)→±2px canvas` avec flag `noSnapX: true` + alternance chaque frame (pas toutes les 2f) — tremblotement fin au lieu d'un déplacement ; `resolve()` lit `noSnapX/noSnapY` pour bypasser le `Math.floor(val/PX)*PX` sur l'axe concerné ; duration `18→22f`. (4) `hochement` : ANIM_DEF supprimé — effet pas lisible à cette résolution ; dispatch `app.js` habReactions `'nod'` remplacé par `triggerGotchiBounce()` ; `__hg.hochement()` conservé dans l'objet debug mais n'appelle plus rien d'utile — à nettoyer. `node --check` : ✅ syntaxe OK (render.js + app.js).
>
> **Session animations Frisson + Hochement 2026-04-30** : 2 animations implémentées. (1) `frisson` : ANIM_DEF `bodyOffset.xFn` oscillation ±PX alternée toutes les 2f sur 18f — déclencheur dans `p.draw()` via `window.meteoData.temperature<5` ou `weathercode≥61 && temp<10` avec cooldown 72f (`_frissonCooldown`) + déclencheur bain dans `render.js:touchMoved` quand `D.g.salete===0`. (2) `hochement` : ANIM_DEF `bodyOffset.yFn` `elapsed%8<4 ? PX : 0` sur 16f (teen/adult) — dispatché dans `app.js` habReactions via `body:'nod'` sur les catégories `intel` et `serene` (auparavant `body:'shake'` et `body:'bounce'`), dispatch `window.animator?.trigger('hochement')` à côté des lignes `bounce`/`shake` existantes.
>
> **Session fix bulle → dynamic-zone 2026-05-01** : 1 correction dans `ui-nav.js`. Problème : quand la bulle (#bubble) s'étire sur 2 lignes (texte IA long), `#console-top` grandit mais `#dynamic-zone` ne se repositionnait pas — la bulle recouvrait le haut de la zone dynamique. Cause : `syncConsoleHeight()` n'était appelée qu'à la navigation et pendant les transitions CSS, pas lors d'un simple changement de texte dans la bulle. Solution : ajout d'un `ResizeObserver` IIFE `_watchConsoleResize()` à la fin du §1 de `ui-nav.js` — observe `#console-top` en continu et rappelle `syncConsoleHeight()` à chaque changement de hauteur. Aucun timer, aucun impact sur les performances (RAF interne à `syncConsoleHeight()`). Compatible iOS 13.4+.

> **Session fix désynchronisation props/corps 2026-04-30 (v2)** : Bug 2 de `AUDIT_PIXEL_ART.md` résolu dans `render-sprites.js:drawAccessoires`. Diagnostic final : `cx` (= `cxB` pour teen/adult) est flottant car `walkX` accumule des vitesses non-entières (1.4, 0.7, 0.35…). Snapper `accXraw` ou `accYraw` en milieu de calcul ne suffit pas — le corps, lui, est snappé depuis ce même `cx` flottant via `px()` dans `renderSprite`, ce qui peut produire un palier PX différent. Fix : snap de `cx` et des trois ancres Y (`topY`, `eyeY`, `neckY`) **à l'entrée** de `drawAccessoires` (`Math.floor(cx/PX)*PX`) — tous les calculs `accX`/`accY` qui suivent héritent automatiquement du même palier PX que le corps. Les snaps intermédiaires introduits en première tentative supprimés (redondants). Décalage d'1px fluctuant visible sur tous les stades à la marche et au bob résolu.

---

## 0. Résumé exécutif

### Tableau santé

| Fichier | Score | Justification (1 phrase) |
|---|---|---|
| `data/config.js` | **A** | Constantes pures, namespace `window.HG_CONFIG` propre, palettes documentées. `HG_CONFIG.GAMEPLAY` expose désormais toutes les constantes gameplay (XP, EN, HA, POOP, cycle). |
| `js/app.js` | **B+** | Bien commenté, migrations versionnées, mais bootstrap éparpillé, `addEvent` mixe deux signatures, et plusieurs `setInterval` non clearables. |
| `js/render.js` | **B** | `p.draw()` découpé en 4 sous-fonctions extraites (2026-04-30) — orchestrateur ~85 lignes. Reste : helpers de hitbox dupliqués entre `touchStarted` et `touchMoved`, `walkX`/`walkPause` implicitement partagés avec `render-sprites.js`. |
| `js/render-sprites.js` | **A** | Sprites bien isolés, `drawSaleteDither` utilise désormais un masque off-screen (auto-synchronisé avec les sprites), code lisible et autonome. |
| `js/envs.js` | **A** | `drawActiveEnv` découpé en 3 fonctions + dispatcher (2026-04-30). `tc()` robuste, magic numbers nommés, couleur nuit unifiée via `shadeN`. |
| `js/ui-*.js` (8 modules) | **B+** | `ui.js` splitté en 8 modules (2026-04-30). `ouvrirSnack()` et `ouvrirAgenda()` migrés vers `openModal()`/`openModalRaw()` — lockScroll unifié. `_getEffectiveEnv()` extrait dans `ui-nav.js` — source de vérité unique pour `activeEnv` (2026-04-30). `modalLocked` : guard bootstrap ajouté (2026-04-30). Reste : overlays séparés intentionnels documentés. |
| `index.html` | **A-** | Debug panel extrait dans `js/debug.js` (2026-04-30). SRI sha384 ajouté sur p5.js CDN (2026-04-30). Masquage agenda déplacé dans `initUI()` (2026-04-30). `class="modal"` retiré — `#modal` CSS unifié. Reste : pas de CSP (Phase 3). |
| `sw.js` | **B** | ✅ `render-sprites.js` ajouté dans `ASSETS` (2026-04-30). ✅ Guard `response.ok` ajouté (2026-04-30). ✅ Bandeau mise à jour + `controllerchange` côté client (2026-04-30). ✅ Logging erreurs `cache.put` (2026-04-30). Reste : pas de stratégie network-first pour les JSON dynamiques. |

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

#### ✅ RÉSOLU — Indentation incohérente dans `defs()` (2026-04-30)
- Lignes : [L175-L222]
- Description : Reformatage complet de `defs()`. Chaque champ est désormais sur sa propre ligne, indenté à 6 espaces pour `g:{}` et 4 espaces pour la racine. Alignement des valeurs sur une colonne commune (style "colonnes") pour faciliter la lecture. Commentaires inline conservés.

#### ✅ RÉSOLU — Numérotation `§` du header désynchronisée (2026-04-30)
- Lignes : [L6-L24]
- Description : Toutes les ancres `§1`–`§17` recalculées sur les vraies lignes actuelles du fichier. Correction notable : `§16 INIT QUOTIDIENNE` était annoncé `~973` — réel : `~1134`. `§17 CONFIG UTILISATEUR` était `~1045` — réel : `~1204`. `haptic()` retiré du §1 (fonction inexistante dans ce fichier), remplacé par `clamp()`.

#### ✅ RÉSOLU — S1 Économie : aucune source régulière > 4 pétales/event (2026-05-01)
- Fichier : `js/app.js` — bloc "Confettis" dans `toggleHab()` (~L1046)
- Description : Le catalogue boutique était binaire `cout:0` (gratuit) / `cout:6` (premium), sans source de pétales couvrant l'écart. Une journée standard (3 habitudes sans streak + 1 snack + 1 bain) donnait ~10 pétales, rendant les objets premium accessibles mais serrés.
- Fix : Bonus "journée complète" +2 pétales quand **toutes** les habitudes du jour sont cochées. Guard `'__journee_complete__'` dans `petalesEarned[td]` — 1 seul gain par jour même si l'utilisatrice décoche et recoche. La bulle change selon si le bonus est déjà acquis ou non. Aucune migration nécessaire (utilise `petalesEarned` existant). Maintient les multiples de 2 de l'économie.
- Résultat : journée complète = +2 pétales supplémentaires → économie ~12 pétales/jour au lieu de 10 pour une journée parfaite.

#### ✅ RÉSOLU — Aucune rétro-action si habitude manquée (2026-05-01)
- Lignes : `app.js` — `bootstrap()` + `defs()` + `MIGRATIONS`
- Description : Ajout d'un check `checkMissedHabits()` dans `bootstrap()`, déclenché au chargement. Si des habitudes n'ont pas été cochées la veille, une pénalité XP est appliquée (−5 par habitude manquée, plafonnée à −20) et une bulle douce du gotchi s'affiche après 1500ms. Le déclencheur est gardé par `D.lastMissedPenalty` (nouvelle clé racine, migration m7) pour ne s'exécuter qu'une seule fois par jour manqué. `happiness` et `energy` ne sont pas touchées — ces variables restent auto-reportées uniquement par l'utilisatrice.

### 2.4 Code mort / redondances
- ✅ `MSG` ([L160-L167]) : documenté comme fallback défensif intentionnel (session 2026-04-30) — conservé.
- `forceUpdate()` `toast()` sans guard `typeof` ([L402]) : `toast()` est défini dans `ui-core.js`, chargé après `app.js` — pas de risque en prod. En dev isolé (app.js seul), `toast` serait undefined. Risque négligeable, guard non ajouté pour ne pas surcharger une fonction déjà courte.
- `_lat`/`_lng` sur `D` : nettoyés via migration `m1` ([L337-L350]) — OK.

### 2.5 Dette technique
- ✅ `bootstrap()` : chargement + initialisation + timers désormais mieux séparés (session 2026-04-30 — `setInterval` déplacés derrière la promesse `loadDataFiles().then()`). La séparation complète en couches resterait un chantier Phase 3.
- Pas de couche "service" entre data et UI : `app.js` appelle directement `updUI`, `renderProps`, `updBadgeBoutique` (couplage fort avec les modules `ui-*.js`). Documenté — non traité, refactoring Phase 3.

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

#### ✅ RÉSOLU — `p.draw()` monolithique (~570 lignes)
- Résolu le 2026-04-30.
- 4 sous-fonctions extraites, locales au module (pas d'exposition `window.*`) :
  - `drawPropsLayer(p, g, envActif, mode)` — mode ∈ `'ambiance'|'fond'|'sol'|'fg'` — remplace 4 blocs `.filter().forEach()` quasi-identiques
  - `drawHUD(p, g, h)` — bandeau translucide : pétales / icônes d'action / météo
  - `drawBadges(p, g)` — capsules ⚡/✿ + triangle ▲ + exposition `window._badgeHitZone`
  - `drawEnvSelector(p, g, nightRatio)` — cercle env actif + cercles flottants + `window._envLocked` / `window._envSelectorHits`
- `p.draw()` réduit à un orchestrateur ~85 lignes. Les sous-fonctions sont insérées juste avant `p5s()`, commentaires RÔLE/POURQUOI/JSDoc présents sur chacune.

#### ✅ RÉSOLU — `getBaseY(stage)` dupliqué 3 fois (2026-04-30)
- Lignes d'origine : [L522, L1031-L1034, L1092-L1095]
- Solution : Fonction `getStageBaseY(stage)` créée (~L107). Les 3 occurrences inline remplacées par un appel centralisé. Aucune désync possible : une seule source de vérité.
- État actuel : 3 appels à `getStageBaseY()` (draw L802, touchStarted L1091, touchMoved L1149). Mapping dans la fonction unique.

#### ✅ RÉSOLU — `walkX`/`walkDir`/`walkStep` en variables module non exposées (2026-04-30)
- Lignes d'origine : [L49-L53]
- Solution : `window._walk = { x: walkX, dir: walkDir, pause: walkPause, step: walkStep, target: walkTarget }` ajouté juste après la boucle de marche (~L799), avant `window._gotchiX`. `window._gotchiX` conservé pour rétrocompatibilité (hitbox touch).
- `render-sprites.js` [L595] mis à jour : `typeof walkPause !== 'undefined' && walkPause === 0` → `window._walk ? window._walk.pause === 0 : false`. Dépendance documentée en en-tête du fichier.
- Risque résiduel : `window._walk` est mis à jour une fois par frame dans `draw()` — cohérence garantie si `drawGotchi()` est appelé dans la même frame.

#### ✅ RÉSOLU — `_lastTapTime` global non protégé (2026-04-30)
- Lignes d'origine : [L949-L950]
- Solution : Variable remplacée par `window._tapState = { lastTime: 0 }`. Initialisée au premier appel (lazy init). Accès via `window._tapState.lastTime`. Plus de risque d'écrasement accidentel depuis un autre module.

#### ✅ RÉSOLU — Étoiles hardcodées en tableau littéral énorme (2026-04-30)
- Lignes d'origine : [L219-L228]
- Solution : Tableau extrait en `const STARS = [...]` juste avant `drawSky()` (~L178). Les 21 coordonnées `[x, y]` sont désormais regroupées avec des commentaires de zone (haute/médiane/basse). `drawSky()` utilise simplement `STARS.forEach(s => ...)`. Modification visuelle possible sans chercher dans la boucle.

#### ✅ RÉSOLU — Commentaire `darkAlpha` trompeur (2026-04-30)
- Lignes d'origine : [L362-L365, L660-L664]
- Solution : Commentaire reformulé. Le texte "épargne le HUD" (qui laissait entendre que l'overlay évitait le HUD) est remplacé par une explication claire : l'overlay est dessiné AVANT le HUD, donc le HUD est rendu par-dessus et reste lumineux. Aucune modification de logique — comportement inchangé.

#### ✅ RÉSOLU — `_envSelectorHits` reconstruit chaque frame (2026-04-30)
- Lignes d'origine : [L843, L860, L885]
- Solution : `window._envSelectorCache = { env: null, open: null }` ajouté en init. Dans `drawEnvSelector()`, guard `cacheHit` calculé avant le reset du tableau — si `activeEnv` et `_envSelectorOpen` sont identiques à la frame précédente, on réutilise `_envSelectorHits` tel quel. Les `.push()` sont protégés par `if (!cacheHit)` pour éviter les doublons en mode cache valide.

#### ✅ RÉSOLU — Hitbox magic numbers `±26`, `±35`, `gotchiCenterY = by + 30` (2026-04-30)
- Lignes d'origine : [L1037-L1039]
- Solution : `const GOTCHI_HITBOX = { rX: 26, rY: 35, centerOffsetY: 30 }` ajouté juste après `GOTCHI_OFFSET_Y` en tête de fichier, avec commentaire RÔLE/POURQUOI. `touchStarted` utilise désormais `GOTCHI_HITBOX.rX`, `GOTCHI_HITBOX.rY`, `GOTCHI_HITBOX.centerOffsetY`.

#### ✅ RÉSOLU — Mélange `if (...)` et chaînes ternaires sans cohérence (2026-04-30)
- Lignes d'origine : [L494-L497]
- Solution : Commentaires RÔLE/POURQUOI ajoutés sur les deux blocs pour justifier le choix de style : ternaire pour `speed` (sélection d'une valeur parmi N cas sans effets de bord), `if/else` pour `walkPause` (bloc multi-instructions avec mutations). Pas de réécriture — les deux idiomes sont intentionnels et désormais documentés.

### 3.4 Code mort / redondances
- ✅ `window._bounceT = 0` ([L46]) : SUPPRIMÉ (2026-04-30) — jamais lu, `bounceT` local utilisé à la place. Remplacé par un commentaire explicatif en place.
- ✅ `_lastPetTime` ([L1056]) : SUPPRIMÉ (2026-04-30) — écrit mais jamais relu. Le timing des caresses est géré via `_petResetTimer` (setTimeout 2s). Ligne retirée, commentaire en place.
- ✅ `walkStep` ([L51, L493]) : SUPPRIMÉ (2026-04-30) — variable déclarée + incrémentée mais jamais lue. Variable retirée, `walkStep++` retiré de la boucle, `window._walk.step` retiré de l'objet partagé. Commentaires en place.

### 3.5 Dette technique
- `p.draw` à découper. ✅ Partiellement résolu (2026-04-30) : découpé en 4 sous-fonctions (`drawPropsLayer`, `drawHUD`, `drawBadges`, `drawEnvSelector`).
- ✅ Couplage implicite avec `render-sprites.js` via variables module — RÉSOLU (2026-04-30) : `window._walk` exposé explicitement.

### 3.6 Évolutions souhaitées

#### 💡 FEATURE — Exagérer l'effet de respiration pour rendre le Gotchi plus vivant
- Fichiers : `render.js` (~L100), `render-sprites.js` (~L99, L116, L274, L414)
- Contexte : `getBreath(p, speed = 0.025)` produit une oscillation 0→1 via `Math.sin(frameCount * speed)`. Dans les sprites, cette valeur est réduite à `breathX = Math.floor(breath * 3) - 1` soit ±1 pixel uniquement — effet très subtil. (formule corrigée 2026-04-30 : `Math.round` biaisé → `Math.floor` équitable)
- `_expr.breathPhase` est déclaré dans `window._expr` mais jamais utilisé — champ prévu initialement pour moduler la vitesse selon l'état émotionnel, non implémenté (dette résiduelle).
- Pistes d'implémentation :
  - Augmenter l'amplitude : `breath * 4 - 2` → ±2px au lieu de ±1px (changement minimal, effet immédiat)
  - Varier la vitesse selon l'état : `speed` plus élevée si fatigué·e ou excité·e (utiliser `_expr.breathPhase` enfin)
  - Ajouter un léger gonflement vertical en plus du latéral (modifier `cy` d'un pixel sur le cycle)
  - Différencier sommeil (respiration lente, ample) vs éveil actif (rapide, petite)

---

## 4. `js/render-sprites.js`

### 4.1 Vue d'ensemble
1409 lignes. Sprites pixel art : `drawDither` (épuisement), `drawSaleteDither` (boue), `drawAccessoires` (pixel-perfect), `drawEgg`, `drawBaby`, `drawTeen`, `drawAdult` (avec poses idle alternées). Moteur DSL `renderSprite()` ajouté (session 2026-04-30) — tous les sprites migrent vers des définitions déclaratives `LAYERS_*`.

### 4.2 Points forts
- Documentation très soignée des paramètres.
- Sprites paramétrés (cx, cy, sl, en, ha) → interfaces externes inchangées.
- `_adultPose` : système de poses idle conservé hors-DSL, machine d'état exécutée dans `drawAdult()` avant `renderSprite()`.
- Retour `{ topY, eyeY, neckY }` exposé pour `drawAccessoires` — anchoring propre, inchangé.
- **DSL micro-moteur `renderSprite()` (§0)** : nouveau Gotchi ou stade = nouvelle définition `LAYERS_*`, zéro duplication de logique de dessin. Thème saisonnier = palette alternative passée en paramètre.

### 4.3 Problèmes

#### ✅ RÉSOLU — `drawSaleteDither` reproduit à la main les silhouettes des sprites (2026-04-30)
- Solution : masque alpha généré off-screen via `p.createGraphics()` — `_drawSilhouetteOffscreen` + `_getSaleteMask`. Inchangé après migration DSL : la silhouette off-screen utilise ses propres coordonnées absolues, indépendantes de `cxB`.

#### ✅ RÉSOLU — `dejaDessines` Set créé à chaque frame dans `drawAccessoires` (2026-04-30)
- Solution : `_dejaDessinesObj = {}` module-level, réinitialisé manuellement.

#### ✅ RÉSOLU — `expr.moodTimer > 0 && expr.lastMood === 'X'` répété ~7 fois (2026-04-30)
- Solution : helper `isMood(name)` en §4b, utilisé dans les `when` des calques DSL.

#### ✅ RÉSOLU — `walkPause` lu par référence implicite (2026-04-30)
- Solution : `window._walk.pause` utilisé à la place.

#### ✅ RÉSOLU — Sprites écrits manuellement en px() sans DSL (2026-04-30)
- Solution : migration DSL complète — voir session ci-dessous.

#### ✅ RÉSOLU — Indentation alternée 2/4 espaces (2026-04-30)
- Résolu par réécriture des blocs `drawTeen`/`drawAdult` dans le DSL.

#### ✅ RÉSOLU — Reflets yeux baby/teen/adult fixes au coin supérieur-gauche (2026-04-30)
- Problème : `rawDx:0, rawDy:0` → reflet statique au coin, regard "mort".
- Solution : `rawDxFn` avec `Math.sin(Date.now() * 0.0008)` → reflet mobile dans l'œil.
  - Baby : œil élargi à 2×1 PX + reflet 2×2 px qui balaye 8px horizontalement.
  - Teen : œil amande 2×2 PX (inchangé) + reflet 4×4 px qui balaye 5px horizontalement.
  - Adult : œil amande 3×2 PX (inchangé) + reflet 4×4 px qui balaye 10px horizontalement.

#### ✅ RÉSOLU — Accessoires teen/adult dans le vide à droite du gotchi (2026-04-30)
- Problème : `drawAccessoires(p, cx, ...)` passait le centre de marche brut `cx`.
  Mais le sprite teen est centré sur `cxB = cx - PX*4 - breathX` et le sprite adult
  sur `cxB = cx - PX*5 - breathX` — décalage de 4 ou 5 PX (20–25px) vers la droite.
- Solution : passer `cxB` à `drawAccessoires` pour teen et adult.
  Baby inchangé (sprite centré directement sur `cx`, pas de `cxB`).

### 4.4 Code mort / redondances
- Aucune fonction morte détectée.

### 4.5 Dette technique
- `_drawSilhouetteOffscreen` doit être maintenue à jour si la géométrie corps/oreilles/bras change dans un `LAYERS_*`. La vérification est documentée en session ci-dessous.
- Les calques `when` des bouches répètent `!isMood('joie') && !isMood('faim') && !isMood('surprise')` — factorisation possible en helper `isNormalMood()` si de nouvelles humeurs sont ajoutées.

### 4.6 Évolutions souhaitées (débloquées par le DSL)

#### 💡 FEATURE — Nouveau Gotchi alternatif (forme différente)
- Fichier : nouveau `js/render-sprites-alt.js` ou entrée dans `render-sprites.js`
- Contexte : Le DSL permet de définir un Gotchi avec une géométrie totalement différente (ex. plus anguleux, oreilles pointues, corps allongé) sans toucher au moteur ni aux fonctions existantes.
- Implémentation : Créer `LAYERS_MON_GOTCHI_*` par stade, exposer `drawMonGotchi*(p, cx, cy, sl, en, ha)` qui appelle `renderSprite()` avec ces calques. `_drawSilhouetteOffscreen` devra être étendue pour le nouveau stade si la saleté doit le couvrir.
- Effort : M par stade (S si formes proches du Gotchi actuel).

#### 💡 FEATURE — Thème saisonnier / palette alternative (Halloween, Noël, printemps...)
- Fichier : `data/config.js` (nouvelles palettes) + appel dans `render.js`
- Contexte : `renderSprite()` accepte un 6e argument `palette` qui remplace `C`. Aucune modification des `LAYERS_*` nécessaire — seules les couleurs changent.
- Implémentation : Ajouter `PALETTE_HALLOWEEN = { body: '#ff6a00', eye: '#1a0033', ... }` dans `config.js`. Dans `render.js`, détecter la date ou un flag `D.g.theme` et passer la palette à `drawTeen`/`drawAdult` etc. qui la transmettent à `renderSprite()`.
- Effort : S (palette) + S (détection et transmission dans render.js).

#### 💡 FEATURE — Nouvelle humeur visuelle (ex. amoureux, endormi debout, concentré)
- Fichier : `js/render-sprites.js` (`LAYERS_TEEN`, `LAYERS_ADULT`), `js/render.js` (`triggerExpr`)
- Contexte : Ajouter une humeur = ajouter des calques `when: (pm) => isMood('amoureux')` dans les définitions existantes (yeux en cœur, bouche spéciale, joues très roses). Le moteur gère le reste.
- Implémentation : (1) Ajouter `'amoureux'` dans `triggerExpr()` de `render.js`. (2) Ajouter les calques yeux/bouche/joues dans `LAYERS_TEEN` et `LAYERS_ADULT`. (3) Ajouter `isNormalMood()` helper pour alléger les `when` existants.
- Effort : S.

#### 💡 FEATURE — Nouveau stade de croissance (ex. stade "senior" ou stade intermédiaire)
- Fichier : `js/render-sprites.js`, `js/render.js`, `js/app.js`
- Contexte : Le DSL rend l'ajout d'un stade très peu coûteux en termes de logique : créer `LAYERS_SENIOR`, écrire `drawSenior()` qui appelle `renderSprite()`, ajouter le stade dans `getSt()` de `app.js` et dans `_drawSilhouetteOffscreen`.
- Implémentation : (1) Définir `LAYERS_SENIOR` (peut réutiliser des calques de `LAYERS_ADULT` avec `spread`). (2) Étendre `_STAGE_BOX` et `_drawSilhouetteOffscreen`. (3) Ajouter le seuil XP dans `app.js`.
- Effort : M.

#### 💡 FEATURE — Personnalisation de la forme du Gotchi par l'utilisatrice
- Fichiers : `data/config.js`, `js/ui-settings.js`, `js/render-sprites.js`, `window.D`
- Contexte : Permettre de choisir parmi plusieurs "morphologies" de Gotchi (ex. rond, allongé, avec chapeau intégré) via un sélecteur dans les réglages. Chaque morphologie = un set de `LAYERS_*` alternatifs.
- Implémentation : (1) Stocker `D.g.gotchiShape = 'default' | 'slim' | 'fluffy'` dans la structure de données. (2) Dans `render.js`, sélectionner le bon set de `LAYERS_*` selon `D.g.gotchiShape` avant d'appeler `drawTeen`/`drawAdult`. (3) UI dans `ui-settings.js` (sélecteur morphologie). Nécessite une migration `SCHEMA_VERSION`.
- Effort : L.

#### 💡 FEATURE — Accessoire intégré au sprite (tatouage, marque, motif permanent)
- Fichier : `js/render-sprites.js`
- Contexte : Contrairement aux accessoires de `drawAccessoires()` (qui flottent au-dessus), un motif intégré au corps (ex. étoile sur le ventre, tache de naissance) peut être modélisé comme un calque DSL toujours actif avec une couleur dérivée (`C.bodyDk` légèrement modifié).
- Implémentation : Ajouter un calque `{ id: 'marque', fill: 'C.bodyDk', rects: [...] }` dans le `LAYERS_*` concerné. Peut être conditionnel à `D.g.gotchiShape` ou à un item acheté en boutique.
- Effort : S.

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

#### ✅ RÉSOLU — `drawActiveEnv` mélange parc/chambre/montagne en if/else if/else if
- Résolu le 2026-04-30.
- `drawActiveEnv` (130 lignes) découpé en `drawParc`, `drawChambre`, `drawMontagne` + dispatcher `switch`. L'orchestrateur final fait ~8 lignes. Chaque biome est autonome et lisible. Pour ajouter un biome : créer `drawMonEnv(p, theme, n)` + ajouter un `case` dans le switch.

#### ✅ RÉSOLU — `drawFog` : magic numbers
- Résolu le 2026-04-30.
- `for (let i = 0; i < 5; ...)` → `FOG_LAYERS_GROUND = 5` et `for (let i = 0; i < 4; ...)` → `FOG_LAYERS_HIGH = 4`. Constantes déclarées juste avant `drawFog` avec commentaires RÔLE/POURQUOI.

#### ✅ RÉSOLU — `tc(n, col)` sans rétrocompat booléen explicite
- Résolu le 2026-04-30.
- `tc(n = 0, col)` avec `const ratio = Number(n)` en tête. `tc(true, '#fff')` → ratio=1 (nuit pleine), `tc(false, '#fff')` → ratio=0 (couleur inchangée). Commentaire JSDoc mis à jour.

#### ✅ RÉSOLU — Mix `p.rect` direct et `px(p, ...)` non documenté
- Résolu le 2026-04-30.
- Convention documentée dans un bloc commentaire `// ── CONVENTION DE DESSIN` au-dessus du dispatcher : `p.rect` = aplats larges et réguliers, `px()` = éléments pixel art sur grille.

### 5.4 Code mort / redondances
- Aucune fonction morte détectée.

### 5.5 Dette technique
- ✅ RÉSOLU (2026-04-30) — Couleurs nuit forcées `'#304028'` dans `drawTreeTheme` remplacées par `tc(n, colLeaf)` et `tc(n, colLeaf2)`. Le feuillage des arbres suit désormais `shadeN()` comme tous les autres éléments — cohérent avec les thèmes pastel, automne, hiver.

---

## 6. `js/ui-*.js` (8 modules — ex-`ui.js`)

> ⚠️ `ui.js` (5192 l) a été découpé en 8 modules lors de la session 2026-04-30. Cette section documente l'état post-split. `ui.js` est conservé dans le repo pour compatibilité mais n'est plus chargé par `index.html`.

### 6.1 Vue d'ensemble
8 modules : `ui-core.js` (helpers, modales, scroll, callClaude), `ui-habs.js` (habitudes), `ui-shop.js` (boutique, inventaire, env switcher), `ui-ai.js` (soutien IA, bilan, cadeau), `ui-journal.js` (journal, PIN, mood, export), `ui-agenda.js` (agenda jour/mois/cycle), `ui-settings.js` (réglages, perso, progression, tablette, snack, initUI), `ui-nav.js` (go(), syncConsoleHeight, updDate — chargé en dernier).

### 6.2 Points forts
- Header de navigation maintenu dans chaque module (`§` numérotés).
- `callClaude()` (`ui-core.js` [L37-L63]) centralise les headers/URL — bonne pratique.
- `escape()` ([L89-L97]) protège contre XSS — appliqué sur la plupart des strings utilisateur.
- `lockScroll()` / `unlockScroll()` ([L274-L279]) — minimaliste et propre.
- `openModal()` ([L395-L409]) : pattern centralisé propre, force reflow pour rejouer l'animation.

### 6.3 Problèmes

#### ✅ RÉSOLU — Cinq mécanismes différents pour ouvrir une "modale" (2026-04-30)
- Architecture : `openModal()` / `openModalRaw()` dans `ui-core.js` = voie centralisée (lockScroll + ✕ auto + inert).
- `ouvrirSnack()` (`ui-settings.js`) : 4 ouvertures directes migrées vers `openModal()`. Variables locales `modal` / `mbox` supprimées de la fonction.
- `ouvrirAgenda()` (`ui-agenda.js`) : migré vers `openModalRaw()` (son propre ✕ via `fermerAgenda()`). Les classes CSS `shop-open` / `agenda-open` appliquées juste après, ce qui est correct (openModalRaw fait son reflow interne avant).
- Overlays séparés intentionnels et documentés :
  - `#etats-overlay` (z-index 1000) — overlay états Gotchi, géré via `openEtatsOverlay()` dans `ui-settings.js`.
  - `#tablet-overlay` (z-index 400) — tablette rétro, gérée via `openTablet()`.
  - `#menu-overlay` (z-index 200) — navigation latérale, gérée via `.open` class.
  - Ces trois overlays vivent volontairement hors du système modal (z-index distincts, comportements propres).

#### ✅ RÉSOLU — `modalLocked` : guard de dernier recours ajouté dans `bootstrap()` (2026-04-30)
- Fichiers : `ui-core.js` [L225], `ui-ai.js` [L617, L622], `app.js` [`bootstrap()`]
- Description : `modalLocked = false` défini dans `ui-core.js`. Set à `true` dans `_genSoutienCore()`. Reset via le bouton ✕ standardisé (`modalLocked=false;clModal()`). Patch temporaire sur `window.clModal` dans `_showSoutienConfirm()` conservé (nettoyage mini p5 zombie, logique correcte).
- Fix appliqué : `if (typeof modalLocked !== 'undefined') modalLocked = false;` ajouté dans `bootstrap()` avant `initApp()`. Garantit que même si une session soutien crashe avant fermeture de la modale, `modalLocked` est remis à `false` au prochain chargement.

#### ✅ RÉSOLU — Boutons `✕` répliqués inline (2026-04-30)
- `window._modalCloseBtn()` exposé dans `ui-core.js` et utilisé dans `ui-shop.js`, `ui-agenda.js`, `ui-ai.js`.
- Cas résiduel documenté : `ui-shop.js` [L84] — croix rouge overlay "mode suppression objet IA" sur les cartes inventaire. Ce n'est pas un bouton de fermeture de modale — comportement distinct (`supprimerObjetIA()`), style intentionnellement différent (rouge, 28px, pleine carte). Conservé tel quel.

#### ✅ RÉSOLU — `mbox.innerHTML` et escape (2026-04-30)
- Règle documentée : `escape()` (de `ui-core.js`) appliqué sur toutes les strings issues de `D.g` (nom du Gotchi, etc.).
- `USER_CONFIG` (`data/user_config.json`) est trusted — pas d'escape systématique sur ses valeurs. Documenté dans le skill `habitgotchi-dev`.
- `snackButtons` dans `ouvrirSnack()` : emojis internes issus de `config.js` (pool SNACK_POOL) — trusted, commentaire ajouté en code.

#### ✅ RÉSOLU — `go()` : source de vérité unique `_getEffectiveEnv()` (2026-04-30)
- Fichier : `ui-nav.js` [L85-L139]
- Fix appliqué : Extraction de `_getEffectiveEnv(tab, h)` — fonction pure, interne à `ui-nav.js`. Retourne l'env cible selon l'onglet et l'heure, ou `null` si l'env doit rester inchangé (cas `props`). `go()` appelle `_getEffectiveEnv()` et n'applique que si résultat non-null. Reset de `_invEnvForced` séparé du calcul d'env — géré explicitement dans `go()` avant l'appel.
- Pour ajouter un onglet : mettre à jour uniquement `_getEffectiveEnv()`, pas `go()`.

#### ✅ RÉSOLU — `tabletLastSeenDate` persisté dans `D` (2026-04-30)
- Fichier : `ui-settings.js`
- Description : La variable module-level `let tabletLastSeenDate` a été supprimée. La valeur est désormais lue et écrite dans `D.tabletLastSeenDate` (persisté en localStorage via `save()`). `updTabletBadge()` compare contre `window.D?.tabletLastSeenDate`. Le badge ne se rallume plus à tort après un rechargement.

#### ✅ RÉSOLU — `journalLocked` exposé sur `window.journalLocked` (2026-04-30)
- Fichiers : `ui-journal.js`, `ui-nav.js`
- Description : `let journalLocked` remplacé par `window.journalLocked`. Toutes les lectures/écritures mises à jour dans `ui-journal.js` (`unlockJ`, `renderJ`) et `ui-nav.js` (`go()`).

#### ✅ RÉSOLU — `_agendaJour` / `_invEnvForced` — cohérence vérifiée (2026-04-30)
- Description : `_invEnvForced` est bien préfixé `window._invEnvForced` dans tous les fichiers (`ui-shop.js`, `ui-nav.js`, `render.js`, `ui.js`). `_agendaJour` initialisé via `window._agendaJour` dans `ui-agenda.js` — les lectures sans préfixe dans le même fichier sont du JS standard (résolution implicite). Pas d'incohérence réelle.

#### ✅ RÉSOLU — `confirmReset()` — chaîne JS inline extraite en `doReset()` (2026-04-30)
- Fichier : `ui-settings.js`
- Description : Fonction `doReset()` créée — exécute `localStorage.removeItem(SK); location.reload()`. Le bouton "Oui" appelle désormais `onclick="doReset()"` au lieu d'une chaîne JS inline fragile.

#### 🟡 MINEUR — `setEnergy` / `setHappy` modifient `el.textContent` puis appellent `saveDebounced`
- Lignes : `app.js` [L827-L838]
- Description : OK fonctionnellement, mais les anciens IDs `#sv-energy` ne sont plus utilisés que dans la modale dynamique.
- Suggestion : RAS.

#### 🔵 STYLE — Inline styles massifs (`style="..."`)
- Lignes : passim — quasiment chaque template string injecte 5-10 styles inline.
- Description : Difficile à thématiser, à overrider, à debugger.
- Suggestion : Migrer progressivement vers des classes CSS (`.btn-snack`, `.modal-header`, etc).

### 6.4 Code mort / redondances
- `toggleSliders()` : présente dans `ui-core.js` [L403] — conservée vide intentionnellement pour ne pas casser d'éventuels appels résiduels. Code mort assumé, documenté en §9 du header de `ui-core.js`.
- `floatXP` ([app.js L717]) : définie et utilisée une seule fois ([L763]). Usage unique intentionnel — animation flottante +XP sur la carte habitude cochée. Pas du code mort, mais extraction inutile pour une seule occurrence.
- `onclick="event.stopPropagation()"` : **une seule occurrence** dans `ui-shop.js` [L81] — croix rouge overlay "mode suppression objet IA" sur les cartes inventaire. Comportement intentionnel (empêche la propagation au parent qui activerait l'objet). Déjà documenté dans 6.3.

### 6.5 Dette technique
- ✅ RÉSOLU (2026-04-30) — `ui.js` 5192 lignes découpé en 8 modules `ui-*.js`. Chaque module est autonome par feature. Voir section "Historique des sessions" pour le détail du split.
- Templates string de 80+ lignes injectés en innerHTML : dette connue, documentée. Migration progressive vers classes CSS (`.btn-snack`, `.modal-header`, etc.) à prévoir en Phase 3 — voir item STYLE section 6.3.
- Fonctions globales `window.*` : convention maintenue. ~70 fonctions exposées — aucun namespace UI ajouté volontairement (overhead inutile pour une SPA de cette taille). Documenté comme acceptable.

---

## 7. `index.html`

### 7.1 Vue d'ensemble
~560 lignes. Squelette PWA : meta tags, `<script src="js/debug.js">` (1 ligne), structure DOM (#console-top, #dynamic-zone, panneaux), menu-overlay, modal, toast, tablet-overlay, scripts. Inclut `data/config.js` puis 8 modules `js/ui-*.js`, puis enregistrement SW.

### 7.2 Points forts
- Meta PWA complets ([L7-L114]) : viewport, theme-color, apple-touch-icon, splash, manifest.
- Ordre des scripts respecté — `render-sprites.js` après `envs.js`, `ui-nav.js` en dernier.
- Structure DOM commentée par "SYSTEM" ([L137, L186, L294]).
- p5.js CDN protégé par SRI hash sha384 + `crossorigin="anonymous"` (2026-04-30).
- debug-panel extrait dans `js/debug.js` (2026-04-30) — HTML allégé, script cacheable.

### 7.3 Problèmes

#### ✅ RÉSOLU — Debug panel inline (~85 lignes) dans `<head>`
- Résolu le 2026-04-30.
- Extrait dans `js/debug.js`. Remplacé par `<script src="js/debug.js"></script>` (1 ligne).
- `js/debug.js` ajouté dans `ASSETS` de `sw.js` — désormais mis en cache.
- Pour désactiver en prod : retirer la balise `<script src="js/debug.js">` suffit.

#### ✅ RÉSOLU — p5.js CDN sans `integrity` ni `crossorigin`
- Résolu le 2026-04-30.
- Hash SRI sha384 ajouté : `integrity="sha384-OLBgp1GsljhM2TJ+sbHjaiH9txEUvgdDTAzHv2P24donTt6/529l+9Ua0vFImLlb"`.
- `crossorigin="anonymous"` ajouté. Hash vérifié via `curl | openssl dgst -sha384 -binary | base64`.

#### ✅ RÉSOLU — Masquage features dans script séparé en bas
- Résolu le 2026-04-30.
- Le `DOMContentLoaded` inline qui masquait `#btn-menu-agenda` si `!showCycle && !showRDV` a été déplacé dans `initUI()` (`ui-settings.js`, fin de fonction). Guard `typeof` ajouté sur `showCycle`/`showRDV`.
- Le script inline dans `index.html` remplacé par un commentaire explicatif.

#### ✅ RÉSOLU — `id="modal"` mais classe `class="modal"` — l'ID est suffisant
- Résolu le 2026-04-30.
- `class="modal"` retiré de l'élément `#modal` dans `index.html`.
- Sélecteur CSS `.modal` remplacé par `#modal` dans `style.css` (une seule occurrence — L1145).
- Commentaire ajouté dans le CSS pour expliquer le choix.

#### 🔵 STYLE — Beaucoup d'`id` à valeur unique (`#g-name`, `#xp-l`, etc.)
- Description : OK pour une SPA mono-instance.

### 7.4 Code mort / redondances
- `<input type="file" id="import-file">` : `importD()` existe dans `ui-settings.js` — non mort.

### 7.5 Dette technique
- ✅ Inline scripts dans le head : réduit à zéro (debug extrait, masquage agenda déplacé dans initUI).
- Reste : pas de Content-Security-Policy. CSP compatible SRI nécessiterait de lister p5.js + toutes les fonts Google dans l'en-tête HTTP — chantier Phase 3 (hors scope HTML seul).

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

#### ✅ RÉSOLU — Cache-first sans vérifier `response.ok`
- Résolu le 2026-04-30.
- Guard `if (!response.ok) return response;` ajouté avant `cache.put()` dans le handler `fetch` ([sw.js L77]).
- Les réponses 404, 500 et redirections ne sont plus jamais mises en cache.

#### ✅ RÉSOLU — Pas de message de mise à jour côté client
- Résolu le 2026-04-30.
- `#update-banner` ajouté dans `index.html` (après `#toast`) — élément cliquable (`onclick="location.reload()"`), masqué par défaut via CSS déjà en place.
- Listener `controllerchange` ajouté dans le bloc d'enregistrement SW (`index.html`) : `banner.style.display = 'block'` déclenché quand le nouveau SW prend le contrôle.
- Commentaires RÔLE/POURQUOI ajoutés sur les deux blocs.

#### ✅ RÉSOLU — `manifest.json` JSON invalide
- Résolu le 2026-04-30.
- Virgule manquante après `start_url` [L5] ajoutée — JSON valide.
- `theme_color: "#ddd6e8"` déjà aligné sur `index.html` [L21] — aucune correction nécessaire.

#### ✅ RÉSOLU — Pas de logging des erreurs cache.put
- Résolu le 2026-04-30.
- `.catch(err => console.warn('SW cache error', err))` ajouté sur la chaîne `cache.put()` ([sw.js L80]).

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
- ~~`ouvrirSnack()` (4 cas) n'appelle pas `lockScroll()`~~ ✅ résolu 2026-05-01 — les 4 branches passent par `openModal()`, lockScroll unifié.
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
| 2 | ✅ Vérifier `response.ok` avant `cache.put` | `sw.js` [L77] — FAIT 2026-04-30 | S | Évite les 404 cachés |
| 3 | ✅ Fix modale non-bloquante — scroll iOS bloqué | `css/style.css`, `index.html`, `js/ui-core.js`, `js/ui-settings.js` | M | Fix bug critique UX |
| 4 | Bumper sync `APP_VERSION` à `'hg-v4.5'` si convention | `js/app.js` [L54] + `sw.js` [L7] | S | Cohérence |
| 5 | ✅ Supprimer signature legacy de `addEvent` | `js/app.js` [L648-L659] | S | API unifiée — FAIT 2026-04-30 |

### Phase 2 — Stabilisation (dette technique, doublons)

| N° | Titre | Fichiers | Effort | Bénéfice |
|---|---|---|---|---|
| 6 | Centraliser les 14+ ouvertures directes sous `openModal()`/`openModalRaw()` | modules `ui-*.js` | M | Cohérence UX — scroll iOS déjà bloqué via lockScroll(), reste à unifier l'animation et le ✕ |
| 7 | Extraire `getStageBaseY()` (déduplication 3×) | `js/render.js` | S | Lisibilité |
| 8 | ~~Extraire `getEffectiveEnv()`~~ ✅ résolu 2026-04-30 | `js/ui-nav.js` | M | Source de vérité unique |
| 9 | ~~Étendre `HG_CONFIG` aux constantes XP/EN/HA/POOP~~ ✅ résolu 2026-04-30 | `data/config.js` | S | Hygiène globale |
| 10 | ~~Persister `tabletLastSeenDate` dans D + exposer `journalLocked` sur `window`~~ ✅ résolu 2026-04-30 | `js/ui-settings.js`, `js/ui-journal.js`, `js/ui-nav.js` | S | Robustesse PWA |
| 11 | Supprimer code mort `_bounceT`, `_lastPetTime`, `walkStep` | `js/render.js` | S | Lisibilité |
| 12 | ✅ Extraire le debug-panel inline dans `js/debug.js` | `index.html` — FAIT 2026-04-30 | S | Allègement HTML — ajouté au cache SW |
| 13 | ✅ Ajouter SRI sur p5.js CDN | `index.html` — FAIT 2026-04-30 | S | Sécurité supply chain — hash sha384 vérifié |
| 14 | ✅ Notifier l'utilisatrice quand un nouveau SW est dispo | `sw.js` + `index.html` — FAIT 2026-04-30 | M | UX update |

### Phase 3 — Amélioration structurelle (découpage, centralisation, tests)

| N° | Titre | Fichiers | Effort | Bénéfice |
|---|---|---|---|---|
| 15 | ✅ Découper `p.draw()` en sous-fonctions thématiques | `js/render.js` — `drawPropsLayer`, `drawHUD`, `drawBadges`, `drawEnvSelector` extraits (2026-04-30) | L | Maintenabilité |
| 16 | ✅ Découper `ui.js` (5192 l) en modules par feature | `js/ui-core.js` (300 l), `js/ui-nav.js` (155 l), `js/ui-habs.js` (179 l), `js/ui-shop.js` (1047 l), `js/ui-ai.js` (918 l), `js/ui-journal.js` (342 l), `js/ui-agenda.js` (1204 l), `js/ui-settings.js` (1307 l) | L | Maintenabilité |
| 17 | Migrer les inline-styles vers classes CSS | `js/ui-*.js` + `css/style.css` | L | Thématisation |
| 18 | ✅ Extraire `drawParc/Chambre/Montagne` de `drawActiveEnv` | `js/envs.js` — `drawParc`, `drawChambre`, `drawMontagne` + dispatcher `switch` (2026-04-30) | M | Lisibilité |
| 19 | Découpler `render-sprites.js` de `render.js` (variables module) | les deux | M | Modularité |
| 20 | Ajouter une suite de tests automatisés (Jest/Vitest) | nouveau `tests/` | L | Régressions |
| 21 | Implémenter focus trap + Escape close pour toutes modales | modules `ui-*.js` | M | Accessibilité — Escape déjà ajouté sur tablet-overlay et etats-overlay, reste #modal et autres |
| 22 | Ajouter Content-Security-Policy en meta | `index.html` | S | Sécurité |

---


### Session — 2026-04-30 : Refactoring DSL render-sprites.js

**Objectif** : Remplacer les sprites écrits manuellement en `px()` par un micro-DSL objet, pour permettre l'ajout facile de nouveaux stades, variantes visuelles et thèmes de couleur.

**Fichier modifié** : `js/render-sprites.js`

**Ce qui a été fait** :

**§0 — Moteur `renderSprite(p, layers, cx, cy, params, palette)`**
- `_resolveFill(p, fillKey, palette)` : résout les clés `'C.xxx'` vers la palette courante, ou passe les hex littérales directement. Palette remplaçable pour les thèmes saisonniers.
- `renderSprite()` : itère les calques, évalue `layer.when(params)`, applique `layer.alpha` via `globalAlpha`, résout la couleur (`fill` ou `fillFn`), dessine les rects via `px()`.
- Extensions successives du moteur : `rawDxFn/rawDyFn` (offsets dynamiques temporels), `rawW/rawH` (dimensions sub-PX), `fillFn` (couleurs dynamiques type `lerpColor`), `yFn` (positions Y dynamiques type `mouthBaseY`).
- `window.renderSprite` exposé sur `window` — convention projet.

**Définitions DSL ajoutées** :
- `LAYERS_EGG` : 3 calques — corps, reflets, craquelures (wobble temporal via `rawDxFn`).
- `LAYERS_BABY` : 12 calques — corps, highlights, yeux (2 états), reflets yeux, joues, poop, bouche (3 états), pieds, bras tombés.
- `LAYERS_TEEN` : 20 calques — corps, highlights, oreilles (2), yeux (4 états), reflets (2), poop, joues (2), 7 états de bouche, bras (2 poses), pieds.
- `LAYERS_ADULT` : 27 calques — corps, highlights, oreilles (2), yeux (4 états), reflets (2), poop, joues (2), 7 états de bouche, bras tombés, bras levés, 5 poses idle, 3 états pieds.

**Fonctions réécrites** (interfaces externes inchangées) :
- `drawEgg(p, cx, cy)` — délègue à `renderSprite(LAYERS_EGG, ...)`.
- `drawBaby(p, cx, cy, sl, en, ha)` — délègue à `renderSprite(LAYERS_BABY, ...)`.
- `drawTeen(p, cx, cy, sl, en, ha)` — calcule `cxB` (cx effectif avec breathX), `mouthBaseY`, `pulse`, puis délègue.
- `drawAdult(p, cx, cy, sl, en, ha)` — exécute la machine d'état pose idle, calcule `cxB`, `stepPhase`, `mouthBaseY`, `pulse`, puis délègue.

**Hors-DSL conservés** :
- `drawDither()` (damier épuisement), `drawAccessoires()`, `drawSaleteDither()` — interfaces inchangées.
- Machine d'état `_adultPose` (timer/cooldown/tirage aléatoire) — exécutée dans `drawAdult()` avant `renderSprite()`.

**`_drawSilhouetteOffscreen`** : non modifiée — vérification §6 confirme que les coordonnées absolues silhouette sont indépendantes de `cxB`. Aucune désynchronisation possible avec la boue.

**Bénéfice** : Nouveau Gotchi = nouveau fichier `LAYERS_*` + appel à `renderSprite()`. Thème = palette alternative passée en 6e argument. Variante visuelle = nouveau calque avec `when`. Zéro duplication de logique de dessin.

---

### Session — 2026-04-30 : Fix drawSaleteDither — masque off-screen

**Objectif** : Résoudre le 🟠 IMPORTANT sur `render-sprites.js` — `drawSaleteDither` reproduisait manuellement les silhouettes via `ditherRect`, sans suivre automatiquement les modifications des sprites.

**Fichier modifié** : `js/render-sprites.js`

**Solution retenue** : Option (b) — masque alpha généré à partir d'un canvas off-screen.

**Ce qui a été fait** :

- `_saleteMaskCache` : objet module-level pour mettre en cache les masques par clé `stage_breathX`.
- `_STAGE_BOX` : constante des dimensions de bounding box off-screen par stade (évite les recalculs).
- `_drawSilhouetteOffscreen(g, stage, breathX)` : dessine la silhouette du stade sur un `p5.Graphics` off-screen avec une couleur unie opaque. Reproduit la géométrie de `drawEgg/Baby/Teen/Adult` — à mettre à jour en même temps que les sprites.
- `_getSaleteMask(p, stage, breathX)` : crée le canvas off-screen via `p.createGraphics()`, appelle `loadPixels()`, extrait les positions `{rx, ry}` des macro-pixels non-vides (grille PX×PX), libère le canvas via `g.remove()`, met le résultat en cache. Au plus 3 entrées par stade (breathX ∈ {-1, 0, 1}).
- `drawSaleteDither` : signature inchangée — itère le masque et applique le damier `(row + col) % stride` sur les positions réelles du sprite.
- `ditherRect` et les blocs `if/else` manuels par stade : supprimés.

**Bénéfice** : Si un sprite est modifié, mettre à jour `_drawSilhouetteOffscreen` suffit. Plus de risque de bug visuel silencieux après refonte des sprites.

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

### `js/ui-*.js` (8 modules — ex-`ui.js`)
| Fonction | Rôle | Module | Appelée par | Appelle |
|---|---|---|---|---|
| `callClaude({...})` | wrapper API Anthropic | `ui-core.js` | askClaude, soutien, bilan, cadeau | `fetch` |
| `escape(s)` | XSS-sanitize | `ui-core.js` | partout | — |
| `lockScroll`/`unlockScroll` | scroll body | `ui-core.js` | openModal, toggleMenu | — |
| `openModal(html)` / `clModal(e)` / `toastModal(m)` | modales | `ui-core.js` | UI | `_modalCloseBtn`, `_fermerMenuSiOuvert`, `unlockScroll` |
| `go(t)` / `goMenu(t)` / `toggleMenu` | navigation | `ui-nav.js` | UI | `renderHabs`, `renderProg`, `renderProps`, `renderPerso`, `renderJ`, `syncDuringTransition` |
| `updUI()` | refresh HUD | `ui-settings.js` | métier | `getSt`, `nxtTh`, `calcStr`, `updThoughtFlowers`, `updJournalFlowers`, `updBadgeBoutique` |
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
  - `lockScroll()` renforcé : `body.overflow:hidden` + `#dynamic-zone overflowY:hidden + touchAction:none` + `_setInert(true)` + **listener `touchmove` avec `preventDefault()` sur `document`** (passive:false) — seul mécanisme efficace contre le rubber-band iOS/Safari. Le listener inspecte la chaîne de parents pour laisser passer les `touchmove` ciblant un élément scrollable de la modale. **Exception ajoutée (2026-04-30)** : `if (e.target.type === 'range') return` — les `input[type=range]` ne sont pas des éléments scrollables, sans cette garde le drag du thumb était annulé par `preventDefault()` sur iOS/WebKit (bug confirmé sur la modale `ouvrirModalEtats`).
  - `unlockScroll()` : retire tous les mécanismes + `removeEventListener` du `touchmoveBlocker`.
- `js/ui-settings.js` :
  - `openTablet()` : `lockScroll()` + listener `Escape` ajoutés.
  - `closeTablet()` : `unlockScroll()` ajouté.
  - `ouvrirModalEtats()` : `pointer-events:auto` inline + `lockScroll()` + listener `Escape`.
  - `fermerModalEtats()` : `unlockScroll()` ajouté.

**Résultat** : scroll iOS bloqué derrière toutes les modales qui appellent `lockScroll()`. Vérifié sur navigateur desktop (DevTools) et iPhone.

**Reste à faire (non urgent)** :
- ~~`ouvrirSnack()` (4 cas) n'appelle pas `lockScroll()`~~ ✅ résolu 2026-05-01 — les 4 branches passent par `openModal()`, lockScroll unifié.
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

### Session — 2026-04-30 : Fix 2 items 🔵 STYLE + mise à jour 2.4/2.5 app.js

**Objectif** : Clore les deux items de style restants sur `app.js` et mettre à jour les sections code mort / dette technique.

**Fichiers modifiés** : `js/app.js`, `AUDIT.md`

**Corrections appliquées** :

**1. `defs()` — reformatage indentation (🔵 → ✅)**
- Chaque champ de `g:{}` et de la racine de l'objet retourné est désormais sur sa propre ligne.
- Indentation uniforme : 6 espaces pour les champs de `g`, 4 espaces pour la racine.
- Valeurs alignées en colonne pour la lisibilité.
- Aucun changement de valeur ou de logique — reformatage pur.

**2. Header `§` — resynchronisation (🔵 → ✅)**
- Toutes les ancres §1–§17 recalculées sur les vraies lignes du fichier post-refactoring.
- Écarts corrigés : §16 (était ~973, réel ~1134), §17 (était ~1045, réel ~1204), et plusieurs autres.
- `haptic()` retiré du §1 (n'existe pas dans `app.js`), remplacé par `clamp()`.

**3. Sections 2.4 / 2.5 — mise à jour documentaire**
- `MSG` marqué résolu (fallback défensif documenté).
- `bootstrap()` dette technique partiellement résorbée (timers déplacés) — reste un chantier Phase 3.
- Couplage `app.js` ↔ `ui-*.js` documenté comme dette Phase 3 connue.

---

### Session — 2026-04-30 : Qualité code pixel art (dette technique #3 et #4)

**Objectif** : Corriger les Math.round biaisés sur la géométrie des sprites et ajouter pixelDensity(1) pour les écrans Retina.

**Fichiers modifiés** : `js/render-sprites.js`, `js/render.js`, `AUDIT.md`

**Corrections appliquées** :

**Fix #3 — Math.round → Math.floor sur la géométrie des sprites (✅)**

5 occurrences remplacées dans `render-sprites.js` :

| Ligne (avant) | Localisation | Changement |
|---|---|---|
| ~342 | `drawSaleteDither` — breathX boue | `Math.round(getBreath(p)*2-1)` → `Math.floor(getBreath(p)*3)-1` |
| ~1020 | `drawTeen` — breathX | `Math.round(breath*2-1)` → `Math.floor(breath*3)-1` |
| ~1026 | `drawTeen` — mouthBaseY | `Math.round(breath*2)` → `Math.floor(breath*3)` |
| ~1483 | `drawAdult` — breathX | `Math.round(breath*2-1)` → `Math.floor(breath*3)-1` |
| ~1491 | `drawAdult` — mouthBaseY | `Math.round(breath*2)` → `Math.floor(breath*3)` |

Raison : `Math.round(x*2-1)` sur x∈[0,1] produit {-1,0,1} mais 0 est 2× plus probable que ±1 (biais central). `Math.floor(x*3)-1` donne une distribution réellement équitable.

Cohérence garantie : `drawSaleteDither` utilise désormais exactement la même formule que `drawTeen`/`drawAdult` — le masque de boue reste aligné sur la silhouette.

**Fix #4 — pixelDensity(1) sur le canvas principal (✅)**

- `render.js` ~L844 : `p.pixelDensity(1)` ajouté avant `p.noSmooth()`
- Corrige le flou retina potentiel sur iPhone et Mac avec écran HiDPI
- Complète la chaîne de rendu pixel art : `pixelDensity(1)` + `noSmooth()` + `image-rendering:pixelated` (CSS)
- `pixelDensity(1)` était déjà présent sur les canvas off-screen dans `render-sprites.js:285` — désormais cohérent sur l'ensemble du pipeline

**État du récapitulatif fixes prioritaires (audit_pixel_art) :**

| # | Fix | État |
|---|---|---|
| 1 | Snap PX reflets pupille | ⏳ Reste à faire |
| 2 | Snap PX accessoires | ⏳ Reste à faire |
| 3 | Math.round → Math.floor géométrie | ✅ FAIT 2026-04-30 |
| 4 | pixelDensity(1) retina | ✅ FAIT 2026-04-30 |
| 5 | Architecture animator | ✅ FAIT 2026-04-30 (session précédente) |

---

### Session — 2026-05-01 : Fix pénalité habitudes manquées (S2 / S4)

**Objectif** : Ajouter une rétro-action visible quand des habitudes n'ont pas été cochées la veille — sans toucher `happiness` ni `energy` (auto-reportés par l'utilisatrice uniquement).

**Fichiers modifiés** : `js/app.js`, `AUDIT.md`

**Corrections appliquées** :

**1. `defs()` — nouveau champ `lastMissedPenalty`**
- Champ `lastMissedPenalty: null` ajouté à la racine de `D`.
- Stocke la date AAAA-MM-JJ de la dernière pénalité XP appliquée — guard anti-doublon.

**2. `MIGRATIONS` — m7 ajoutée**
- `d.lastMissedPenalty = d.lastMissedPenalty ?? null` — les sauvegardes existantes reçoivent `null` à la mise à jour.
- ⚠️ `SCHEMA_VERSION` à incrémenter manuellement (6 → 7) dans `app.js` et `sw.js`.

**3. `bootstrap()` — `checkMissedHabits()` IIFE**
- Déclenché après `catchUpPoops()`, avant `initApp()`.
- Calcule les habitudes non cochées la veille (`D.log[hierStr]` vs `D.habits`).
- Pénalité : −5 XP par habitude manquée, plafonnée à −20. Appliquée via `addXp()`.
- Bulle gotchi après 1500ms (pool de 3 messages doux, non-culpabilisants, pool aléatoire).
- Expression `triggerExpr('neutre', 80)` — pas de joie, ton posé.
- Log dans `eventLog` : `{ type: 'habitude', subtype: 'manquee', valeur: -N, label: '...' }`.
- `happiness` et `energy` non modifiées — contrainte respectée.

---

*Fin de l'audit v4.5 — 2026-04-30 / dernière session 2026-05-01*
