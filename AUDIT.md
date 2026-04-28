# AUDIT HabitGotchi — 2026-04-26
## Mis à jour le 2026-04-28 — Sessions 1 à 9 complétées ✅

> Audit de référence sur la branche `Annotation`, version `v3.02`. Lecture intégrale de `config.js`, `app.js`, `envs.js`, `render.js`, `sw.js`, `index.html`, `prompts/*.json`. Lecture quasi-intégrale de `ui.js` (3735 lignes — 100% des fonctions principales lues, quelques sections de rendu d'agenda parcourues). `data/props.json` et `data/personality.json` parcourus comme données pures (pas d'analyse de code).
>
> **Version courante : `hg-v3.28`** (bumped en session 5 — `app.js` + `sw.js` synchronisés).

---

## 0. Résumé exécutif

### Score de santé global

| Fichier | Score | Justification courte |
|---|---|---|
| `data/config.js` | **A** ✅ | Pure data, bien commentée. `AI_MODEL` ajouté (session 3). Constantes GAMEPLAY + SEUILS VISUELS centralisées (sessions 7–8). |
| `js/app.js` | **A-** ✅ | `addEvent` unifié, `visibilitychange` fusionné, `reload(true)` corrigé, chemins morts supprimés, debounce sliders, constantes GAMEPLAY migrées, typo `maybySpawnPoop` corrigé, sommaire §1-§17 ajouté, SCHEMA_VERSION ajouté. |
| `js/render.js` | **B** ✅ | Double pluie supprimée, `wcMeteo` renommé, seuils EN_*/HA_* centralisés, échelle 0-5 native (×20 supprimé), sommaire §1-§9 ajouté, sprites extraits dans `render-sprites.js`. Reste : `p.draw()` monolithique. |
| `js/render-sprites.js` | **A** ✅ | Nouveau fichier (session 9). Contient drawDither, drawAccessoires, drawEgg, drawBaby, drawTeen, drawAdult. Sommaire §1-§6. |
| `js/envs.js` | **B+** ✅ | `drawFrameMotif` simplifié, triangle doublonné supprimé, `drawRain` formula mise à jour (échelle 0-5), sommaire §1-§5 ajouté. |
| `js/ui.js` | **B-** ✅ | `getWeekId` doublonnée supprimée, `AI_MODEL` centralisé, bug +16 corrigé, `addEvent` unifié, XSS sanitisé, code mort supprimé, `callClaude()` helper ajouté (session 6), constantes XP_NOTE/XP_HABITUDE utilisées, sommaire §1-§18 ajouté. Reste : globales agenda, refactoring modules. |
| `index.html` | **B** | Script tag `render-sprites.js` ajouté (session 9) dans le bon ordre. Commentaire d'ordre chargement mis à jour. |
| `sw.js` | **A** | Version synchronisée à `hg-v3.28` (session 5). Stratégie cache-first. |
| `TESTING.md` | **nouveau** ✅ | Checklist manuelle 11 sections + raccourcis console (session 9). |
| `style.css` | non audité (643 lignes) | hors scope JS. |
| `prompts/*.json` | **A** | Concis et structurés. |

### Les 3 problèmes les plus urgents

1. ✅ **Modèle Claude `claude-sonnet-4-5` hardcodé en 5 endroits** — résolu en session 3. Constante `AI_MODEL` dans `config.js`, 5 occurrences remplacées dans `ui.js`.
2. ✅ **Doublon de `getWeekId`** — résolu en session 1. Version approximative supprimée de `ui.js`, version ISO d'`app.js` fait foi.
3. ✅ **API `addEvent` double** — résolu en session 4. Les 3 appels en ancienne API migrés vers la forme objet (`app.js:589`, `ui.js:2136`, `ui.js:2561`).

### Les 3 quick wins les plus faciles

1. ✅ **Pluie dessinée 2×** — résolu en session 2. Double appel `drawRain` supprimé.
2. ✅ **`drawFrameMotif` 4 branches identiques** — résolu en session 2. Réduit à un seul bloc.
3. ✅ **Double `visibilitychange`** — résolu en session 1. Fusionné en un seul handler.

---

## 1. data/config.js

### 1.1 Vue d'ensemble
156 lignes. Constantes pures : palettes UI, couleurs Gotchi, thèmes d'environnements, fenêtres repas, pool de snacks. Aucune logique. Complexité minimale.

### 1.2 Points forts
- Commentaires d'intention (RÔLE, métaphores) très bien rédigés.
- Index `id` cohérent à travers `UI_PALETTES`, `GOTCHI_COLORS`, `ENV_THEMES` (pivot stable pour le reste du code).
- `MEAL_WINDOWS` : structure simple, exploitable directement par `Object.entries`.

### 1.3 Problèmes identifiés

#### ✅ STYLE — résolu (2026-04-28)
**Constantes globales sans namespace**
- `UI_PALETTES`, `GOTCHI_COLORS`, `ENV_THEMES`, `MEAL_WINDOWS`, `SNACKS_POOL` exposées sous `window.HG_CONFIG` à la fin de `config.js`. Les 15 occurrences dans `app.js`, `render.js`, `ui.js` migrées vers `window.HG_CONFIG.*`.

#### ✅ MINEUR — résolu (2026-04-28)
**Palette `card` non documentée et répétée**
- Factorisée dans la constante `CARD_BG = 'rgba(255,255,255,.88)'`, référencée dans les 6 entrées de `UI_PALETTES`.

### 1.4 Code mort / redondances
- Aucune fonction. Quelques entrées `card` strictement identiques (cf. ci-dessus).

### 1.5 Annotations manquantes
- RAS — la documentation est en place.

---

## 2. js/app.js

### 2.1 Vue d'ensemble
1003 lignes. Centralise : utilitaires temps, structure `D` initiale, save/load, XP, métabolisme (poops, repas, snack préféré), météo, phases solaires, journal d'événements, bootstrap PWA. Complexité moyenne mais le fichier touche 6 des 7 systèmes.

### 2.2 Points forts
- Header de chaque fonction = mini-docstring explicite.
- `load()` ([L183](js/app.js#L183)) fusionne via spread avec `defs()` — robuste aux ajouts de champs sans casser les sauvegardes.
- `bootstrap()` ([L956](js/app.js#L956)) gère explicitement les 3 entrées : `load`, `pageshow` bfcache, `visibilitychange`.
- `getCyclePhase()` ([L154](js/app.js#L154)) calcule la durée moyenne sur tous les cycles connus, fiable.

### 2.3 Problèmes identifiés

#### ✅ CRITIQUE — résolu (session 4)
**Double API `addEvent` — incohérence d'événements en log**
- Les 3 appels en ancienne API migrés vers la forme objet. `addEvent` n'accepte plus que `{ type, subtype, valeur, label }`.

#### ✅ IMPORTANT — résolu (session 1)
**Double `visibilitychange`**
- Fusionné en un seul handler : `hidden` → persiste `lastTick` ; `visible` → relance `initApp()`.

#### ✅ IMPORTANT — résolu (session 1)
**`getWeekId` ISO redéfini en non-ISO dans ui.js**
- Définition approximative supprimée de `ui.js`. Seule la version ISO d'`app.js` fait foi.

#### ✅ MINEUR — résolu (session 1)
**`forceUpdate()` utilise `location.reload(true)` déprécié**
- Corrigé en `location.reload()`.

#### ✅ MINEUR — résolu (2026-04-28)
**`save()` swallow silencieux**
- `catch(e) {}` remplacé par `console.warn('[HabitGotchi] save() échoué :', e)`.

#### ✅ MINEUR — résolu (session 4 / annotation)
**`addXp(-15)` au décochage : pas de downgrade visuel**
- Comportement assumé et documenté dans le code : régression de stade sans animation volontaire.

#### ✅ MINEUR — résolu
**`calcStr()` : `while(true)` peu lisible**
- Remplacé par une boucle `for`.

#### ✅ MINEUR — résolu (session 7)
**Coordonnées Toulouse hardcodées par défaut**
- Les coords passent désormais par `USER_CONFIG?.meteo?.lat/lon` avec fallback `D.g.lat/lng`. Les valeurs Toulouse (43.6047, 1.4442) restent en dernier fallback documenté dans `fetchMeteo()`.

### 2.4 Code mort / redondances
- ✅ `D.userName` nettoyé — lectures mortes supprimées, la valeur réelle vit dans `D.g.userName`.
- ✅ `D.lat` / `D.lng` racine supprimés — coords vivent dans `D.g.lat/lng` et `USER_CONFIG`.
- `MSG` ([L106](js/app.js#L106)) : fallback toujours présent mais `personality.json` se charge via `user_config` désormais — MSG n'est jamais atteint en fonctionnement normal. Peut être supprimé à terme.

### 2.5 Annotations manquantes
- ✅ `defs()` : docstring et sommaire §1-§17 ajoutés (session 5).
- ✅ `addXp()` : doc sur valeurs négatives ajoutée.
- ✅ `floatXP()` : annotée.

---

## 3. js/render.js

### 3.1 Vue d'ensemble
1189 lignes, **monolithique**. Mélange : globales (palette `C`, particules), helpers (`getBreath`, `getCheekPulse`, `shadeN`-non-non, `shadeN` est dans envs.js), sprites (`drawEgg`, `drawBaby`, `drawTeen`, `drawAdult`), boucle p5 `p.draw()` qui contient la quasi-totalité du moteur visuel + le HUD + la gestion des taps. Complexité **élevée** : `p.draw()` fait à elle seule ~340 lignes.

### 3.2 Points forts
- Commentaire d'en-tête explicite sur les dépendances entre fichiers.
- `drawAccessoires()` ([L289](js/render.js#L289)) bien isolé, snap pixel-perfect documenté.
- Système `_expr` (mood/timer) propre et réutilisable.
- `drawDither()` ([L267](js/render.js#L267)) factorise correctement le damier.

### 3.3 Problèmes identifiés

#### ✅ CRITIQUE — résolu (session 2)
**Pluie dessinée 2×**
- `drawRain` n'apparaît plus qu'une fois (L339), conditionné par `HA_MED`.

#### ⚠️ IMPORTANT — ouvert
**`p.draw()` est un bloc monolithique**
- Lignes : toujours ~340 lignes non découpées.
- Suggestion : extraire `drawHud`, `drawProps`, `updateLocomotion`, `drawTouchReactions`, `drawNightOverlay`. À traiter en session dédiée.

#### ⚠️ IMPORTANT — ouvert
**`p.touchStarted` : hitbox avec constantes magiques**
- Lignes : `692-695` — `72`, `128`, `14`, `26` hardcodés sans constante nommée.
- Risque : si un bouton HUD est déplacé dans `p.draw`, la hitbox se désynchronise sans warning.
- Suggestion : `const HUD_BTN_POOP_X = 72; const HUD_BTN_SNACK_X = 128;` etc. au sommet du fichier.

#### ✅ IMPORTANT — résolu (session 2)
**Mutation directe de `window.shakeTimer`**
- Encapsulé dans `window.triggerGotchiShake()` (L55). Un seul point d'écriture.

#### ⚠️ MINEUR — ouvert
**`updateParts` parse la couleur à chaque frame**
- Ligne : `267` — `p.color(pt.c)._array.slice(...)` toujours présent.
- Suggestion : stocker `pt.rgb = [r,g,b]` au `spawnP`.

#### ✅ MINEUR — résolu (sessions 7-8)
**Seuils dithering hardcodés**
- Remplacés par les constantes `HA_MED`, `HA_HIGH`, `EN_LOW`, etc. centralisées dans `config.js`.

#### ✅ MINEUR — résolu (session 2)
**Variable `wc` redéclarée dans `p.draw`**
- Renommée `wcMeteo` (L620).

#### ✅ MINEUR — OK
**`window._evoAnim` initialisé deux fois**
- Comportement voulu : L60 init statique à l'état `inactive`, L62 dans `triggerEvoAnim` pour l'activer.

#### 🔵 STYLE — non traité
**Indentation inconsistante (tabs/spaces)**
- À passer Prettier une fois en session dédiée.

### 3.4 Code mort / redondances
- ⚠️ `window._bounceT = 0` (L45) — toujours présent, jamais lu ailleurs. À supprimer.
- ✅ `window.celebQueue` — initialisé dans `app.js:47`, consommé dans render. Pas mort.
- ⚠️ `window._lastPetTime` (L728) — écrit, jamais lu. À supprimer ou à exploiter.
- ✅ `window.shadeN` — `shadeN` est locale à `envs.js`, utilisée correctement via `tc()`. Non exposée globalement, pas un bug.

### 3.5 Annotations manquantes
- ✅ `drawBaby` / `drawTeen` / `drawAdult` — extraits dans `render-sprites.js` (session 9), annotés.
- ✅ `p.draw` — sommaire §1-§9 ajouté (session 9).
- ⚠️ `drawSky` — pas de doc sur les paramètres `h` et `ha`.

---

## 4. js/envs.js

### 4.1 Vue d'ensemble
432 lignes. Décors par biome, météo (vent/brouillard/pluie/soleil/arc-en-ciel), helpers `tc/shadeN`, `drawTreeTheme`, `drawCactus`, `drawFl`. Complexité moyenne, bien découpée.

### 4.2 Points forts
- `shadeN()` ([L389](js/envs.js#L389)) : conversion HSL propre et commentée.
- Découpage par biome lisible (`drawActiveEnv` reste compréhensible).
- `pxFree()` vs `px()` bien différenciés et utiles.

### 4.3 Problèmes identifiés

#### ✅ IMPORTANT — résolu (session 2)
**`drawFrameMotif` : 4 branches identiques**
- Réduit à un seul bloc qui lit `theme.frameAccent1/2` (L285-290).

#### ✅ IMPORTANT — résolu (session 2)
**Pic de montagne dessiné 2×**
- Occurrence inconditionnelle supprimée. Seule la branche `if (theme.id !== 'desert')` (L249) reste.

#### 🟡 MINEUR — ouvert
**`drawWind` couleur fixe `#d8d8e8`**
- Ligne : `53` — pas de variation selon le mode nuit.
- Suggestion : `tc(n, '#d8d8e8')` si le test visuel confirme que c'est visible la nuit.

#### 🟡 MINEUR — ouvert
**`drawRain` alpha hardcodé**
- Ligne : `124` — `200` hardcodé dans `p.fill(p.color(220, 225, 235, 200))`.
- Faible impact, mais à constanter si d'autres réglages de pluie sont ajoutés.

### 4.4 Code mort / redondances
- ✅ Branches identiques `drawFrameMotif` supprimées.
- ✅ Triangle de pic redondant supprimé.

### 4.5 Annotations manquantes
- ✅ `drawFrameMotif` — docstring ajouté (L282).

---

## 5. js/ui.js

### 5.1 Vue d'ensemble
**3735 lignes** — fichier le plus problématique. Couvre : navigation, modales, boutique, props, IA (4 fonctions API), bilans, journal, PIN, agenda, cycle menstruel, cheats, init UI. Complexité **très élevée**. Quasiment tout passe par `innerHTML` avec template strings inline (CSS dans le HTML, comportements onclick=).

### 5.2 Points forts
- Sections par bandeau (`/* ─── SYSTÈME X ─── */`) qui aident la navigation.
- `startThinkingAnim` / `stopThinkingAnim` ([L1130](js/ui.js#L1130)) : factorisation propre.
- Animation `flashBubble` + bulles aléatoires avec anti-répétition ([app.js:863](js/app.js#L863)).
- Gardes anti-double-tap, gardes `modal/menu visible` dans `p.touchStarted` (render.js).

### 5.3 Problèmes identifiés

#### ✅ CRITIQUE — résolu (session 3)
**`claude-sonnet-4-5` hardcodé en 5 endroits**
- Constante `AI_MODEL` ajoutée dans `config.js`. Helper `callClaude()` ajouté dans `ui.js` (session 6). Les 5 occurrences remplacées.

#### ✅ CRITIQUE — résolu (session 1)
**Fonction `getWeekId` redéfinie**
- Définition approximative supprimée de `ui.js`. Version ISO d'`app.js` fait foi.

#### ✅ CRITIQUE — résolu (session 4)
**Injection HTML brute via `innerHTML` (XSS local)**
- Données utilisateur sanitisées. Données IA échappées.

#### ⚠️ IMPORTANT — ouvert
**Variables d'état globales pour formulaire RDV**
- `window._rdvEmoji` (L3075) et `window._rdvRecurrence` (L3087) toujours présents. Reset manuel en L3147-3148 après confirmation, mais pas de réinitialisation à l'ouverture du formulaire.
- Risque : emoji ou récurrence d'un RDV précédent peut persister si on annule sans sauvegarder.
- Suggestion : réinitialiser ces variables au début de `afficherFormulaireRdv()` et `editerRdv()`.

#### ✅ IMPORTANT — résolu (session 4)
**`voirBulles()` : test incohérent array/object**
- `customBubbles` normalisé en array au load (L1459). `Array.isArray` check en L1146.

#### ✅ IMPORTANT — résolu
**`renderProg()` sélecteur fragile `[onclick="..."]`**
- Sélecteur supprimé. `renderProg` n'opère plus par ciblage de bouton via attribut `onclick`.

#### ✅ IMPORTANT — résolu (session 4)
**`saveJ()` garde dupliquée**
- Une seule garde `if (!selMood)` en L2118.

#### ⚠️ IMPORTANT — ouvert
**`_agendaJour` accédé sans `window.` dans plusieurs fonctions**
- Initialisé `window._agendaJour` (L2720) mais lu en bare aux L2834, L2939, L3129, L3140, L3203, L3322, L3536, etc.
- Risque : aucun aujourd'hui (script non-module), bloquant si migration vers `<script type="module">`.
- Suggestion : aligner en `window._agendaJour` partout, ou déclarer `let _agendaJour` proprement.

#### ✅ IMPORTANT — résolu
**`sauvegarderRdvEdit()` morte**
- Fonction supprimée. L'édition passe uniquement par `confirmerEditRdv`.

#### 🟡 MINEUR — ouvert (faible impact)
**`navigator.clipboard` incohérent entre 3 fonctions**
- `copierSoutien` (L1806), `copyBilanSemaine` (L1937), `copierCycles` (L3824) gèrent chacune leur propre fallback.
- Suggestion : helper unique `copyToClipboard(text, successMsg)`.

#### ✅ MINEUR — résolu (session 4)
**`acheterPropClaude` remboursement `+16` pour un coût de `10`**
- Corrigé.

#### ✅ MINEUR — résolu
**`exportJournal` variables `a, b` inutilisées**
- Supprimées.

#### 🟡 MINEUR — ouvert (faible impact)
**`renderPin()` recrée les handlers à chaque appel**
- `b.onclick = …` réécrit à chaque clic. Sans conséquence visible aujourd'hui.

#### ⚠️ MINEUR — ouvert
**`tabletLastSeenDate` non persisté**
- L2422 : `let` top-level, réinitialisé à chaque session. Le badge "nouveau" réapparaît à chaque rechargement.
- Suggestion : persister dans `D.g.tabletLastSeenDate`.

### 5.4 Code mort / redondances
- ✅ `getWeekId` redéfinie → supprimée.
- ✅ `sauvegarderRdvEdit` → supprimée.
- ✅ `toggleMasquerAcquis` / `masquerAcquis` → supprimés.
- ✅ Garde `if (!selMood)` dupliquée → supprimée.
- ✅ Variables `a, b` dans `exportJournal` → supprimées.
- ⚠️ `tabletLastSeenDate` — toujours non persisté (cf. 5.3).

### 5.5 Annotations manquantes
- ✅ `acheterPropClaude` — format de réponse documenté (session 6).
- ✅ `confirmerEditRdv` — les 3 modes (`simple`/`ce`/`suivants`) commentés.
- ⚠️ `genSoutien`, `sendSoutienMsg`, `genBilanSemaine` — pas de docstring sur le format de réponse attendu.
- ⚠️ `applyCheatCode` — liste des codes non documentée dans le code.

---

## 6. index.html

### 6.1 Vue d'ensemble
593 lignes. Structure : meta PWA + script debug inline (~85 lignes) + skeleton 5 panneaux + menu overlay + modale + tablette + scripts en fin.

### 6.2 Points forts
- Ordre de chargement explicite et commenté (config.js → app.js → render.js → envs.js → ui.js).
- Service Worker registré proprement.
- Commentaires « SYSTEM X » qui mappent les blocs aux modules JS.

### 6.3 Problèmes identifiés

#### ⚠️ IMPORTANT — ouvert
**Script de debug PWA inline (~85 lignes)**
- Lignes : `14-98` — `toggleDebugPanel` toujours défini dans index.html.
- Risque : difficile à tester unitairement, mais sans impact fonctionnel.
- Suggestion : déplacer dans `js/debug.js` en session dédiée.

#### ⚠️ IMPORTANT — ouvert (décision architecturale)
**Tous les `onclick` sont inline**
- Comportement assumé du projet vanilla. Migration vers `addEventListener` = refactoring massif sans gain immédiat.
- À reconsidérer uniquement si une CSP stricte devient nécessaire.

#### ⚠️ MINEUR — ouvert
**p5.js CDN sans SRI**
- Ligne : `124` — pas d'`integrity=` ni `crossorigin`.
- Risque : faible (CDN de confiance), mais bonne pratique à ajouter.
- Suggestion : `integrity="sha384-..." crossorigin="anonymous"`.

#### ✅ MINEUR — OK
**`autocomplete="new-password"` sur la clé API**
- Bonne pratique confirmée.

#### ✅ session 9
**`render-sprites.js` ajouté dans le bon ordre**
- L613, après `envs.js`, avant `ui.js`. Commentaire d'ordre mis à jour.

### 6.4 Code mort / redondances
- ✅ Commentaires « SYSTEM X » dédoublonnés.

### 6.5 Annotations manquantes
- ✅ `manifest.json` vérifié — icônes correctement pointées.

---

## 7. sw.js

### 7.1 Vue d'ensemble
70 lignes. Cache-first strategy, version-based invalidation. Très lisible.

### 7.2 Points forts
- `skipWaiting()` + `clients.claim()` : nouveau SW prend le relais immédiatement.
- Filtre cross-origin propre (Anthropic/météo non interceptées).
- Liste explicite des assets.

### 7.3 Problèmes identifiés

#### ⚠️ MINEUR — ouvert
**Mise en cache aveugle sans `response.ok`**
- Ligne : `65` — les réponses 404 ou erreurs sont cachées sans vérification.
- Risque : faible (pas d'API same-origin), à surveiller si ajout d'endpoint local.
- Suggestion : `if (response.ok) caches.open(...).then(cache => cache.put(...))`.

#### 🟡 MINEUR — documentaire
**Pas de retry sur `cache.addAll(ASSETS)`**
- Un asset 404 à l'install fait échouer le SW silencieusement.
- Risque : nul (assets locaux stables), mais à noter si un asset est renommé sans mettre à jour la liste.

### 7.4 Code mort / redondances
- RAS.

### 7.5 Annotations manquantes
- RAS, fichier court et bien commenté.

---

## 8. prompts/ai_contexts.json + ai_system.json

### 8.1 Vue d'ensemble
13 + 4 lignes. Templates de prompts pour Claude. Variables `{{xxx}}`.

### 8.2 Points forts
- Concision, prompts engineered (règles strictes, format JSON imposé).
- Séparation `system` / `contexte` bien pensée.

### 8.3 Problèmes identifiés

#### ⚠️ MINEUR — ouvert
**Variables `{{}}` non documentées centralement**
- Pas de README dans `prompts/`. Variables utilisées : `{{nameGotchi}}`, `{{userName}}`, `{{style}}`, `{{traits}}`, `{{cycleInfo}}`, `{{rdvAujourdhui}}`, `{{messages_restants}}`, `{{habsDone}}`, `{{habitudes}}`, `{{notes}}`, `{{exemples}}`, `{{nomsExistants}}`, `{{timestamp}}`, `{{theme}}`, `{{existingNames}}`, `{{typeImpose}}`, `{{weekStart}}`, `{{weekEnd}}`, etc.
- Risque : renommer une variable côté JS sans mettre à jour le prompt = silencieux.
- Suggestion : créer `prompts/README.md` listant les variables et leur source JS.

---

## 9. Analyse transversale

### 9.1 Architecture globale

```
index.html
  └─ <script src=> (ordre):
       data/config.js        (constantes pures : AI_MODEL, GAMEPLAY, SEUILS VISUELS, palettes)
       js/app.js             (état D, save/load, métabolisme, météo, bootstrap)
         ↓ déclare window.D, window.PROPS_LIB, hr(), today(), addEvent, save, …
       js/render.js          (p5 instance, boucle draw, helpers visuels, HUD, taps)
         ↓ lit window.D, expose window.spawnP, window.triggerExpr, …
       js/envs.js            (décors, météo visuelle, shadeN, tc, pxFree, drawActiveEnv)
         ↓ utilisé par render.js et render-sprites.js (via globals)
       js/render-sprites.js  (sprites : drawEgg, drawBaby, drawTeen, drawAdult, drawDither, drawAccessoires)
         ↓ dépend de render.js (px, C, PX, getBreath…) ET envs.js (pxFree)
       js/ui.js              (interactions, modales, IA via callClaude(), agenda, init UI)
         ↓ expose window.initUI, appelé par bootstrap d'app.js
       sw.js                 (cache PWA, version hg-v3.28)
```

**Couplage** : entièrement via `window.*`. Aucun module ESM. C'est cohérent pour vanilla JS sans bundler, mais fragile dès qu'un nom est répété (`getWeekId`, `defs`, `today`).

**Risques liés aux variables globales `window.*`** :
- Ordre de chargement = ordre de définition. Si tu charges ui.js avant app.js, tout casse silencieusement.
- Aucune protection contre redéfinition (cas `getWeekId`).
- IDE / linter ne signalent rien.

### 9.2 Gestion d'état

**Cohérence de `window.D`** : globalement bonne. Source unique sérialisée via `save()` ([L200](js/app.js#L200)). Toutes les mutations passent par `D.g.*`. Quelques exceptions :
- `D.userName` (sans `.g`) lu mais jamais écrit — résidu d'une ancienne migration.
- `D.lat`/`D.lng` à la racine — orphelins.
- `D.lastWelcomeState`, `D.lastJournalExport`, `D.lastGiftDate` à la racine de `D` (pas dans `D.g`) — incohérent avec le reste.
- `D.propsPixels` à la racine de `D` (et pas `D.g.propsPixels`) — incohérent.

**Appels `save()`** : très nombreux (~50 occurrences au total). Beaucoup sont placés correctement (après chaque mutation), mais certains sont redondants : `toggleHab` ([app.js:633](js/app.js#L633)) note explicitement « ✅ UN SEUL save() ici » — preuve qu'il y avait du double avant.
- `applyUIPalette/Color/EnvTheme` ([ui.js:1876-1887](js/ui.js#L1876)) : 3 fonctions qui font `save()` puis `renderPerso()`. Si l'utilisatrice change les 3 d'affilée, 3 saves. Acceptable.
- `setEnergy` / `setHappy` : save à chaque tick du slider — peut spammer le LocalStorage.

**Risques de mutation non intentionnelle** :
- Aucune copie défensive. `[...D.g.poops]` est utilisé une fois ([app.js:454](js/app.js#L454)) ; sinon les arrays/objets sont passés par référence.
- `window.PROPS_LOCAL = Object.values(D.propsPixels)` ([app.js:218](js/app.js#L218), [ui.js:1294](js/ui.js#L1294), [1402](js/ui.js#L1402)) crée un array mais dont les éléments restent des refs vers `D.propsPixels[id]`. Mutation indirecte possible.

### 9.3 Performance

**Boucle `p.draw()` à 12fps** :
- ~15 sections, dont plusieurs filtres `Array.prototype.filter` à chaque frame sur `D.g.props` (sections 2, 4, 5, 9). 4 itérations de `D.g.props` par frame.
- À 12fps × ~10 props max, ce n'est pas catastrophique mais une pré-classification (`propsByLayer = {ambiance, bgDecor, fgDecor, accessoire}` recalculée seulement quand `D.g.props` change) gagnerait 30-40% de la boucle de dessin.

**Particules** : `updateParts` parse la couleur à chaque frame pour chaque particule (`p.color(pt.c)._array`). Cf. §3.3.

**API IA** : `btnBilan.disabled` géré (L2338-2346). `askClaude` (bouton pensée) : le bouton est `disabled = true` pendant la requête (L1710). ✅ partiellement résolu.

**Polling fetchMeteo** : `setInterval(fetchMeteo, 1800000)` (30 min, app.js:L1116). ⚠️ Aucun `clearInterval` à l'unload — fuite potentielle si `bootstrap()` est rappelé.

**Localstorage** : `setEnergy`/`setHappy` → save à chaque cran. Pour 5 paliers × 2 sliders, OK ; mais sur un drag long, le slider envoie chaque step → spam.

### 9.4 Sécurité & robustesse

- **API key dans LocalStorage en clair** : compromis acceptable pour une PWA personnelle, mais à documenter.
- **Header `anthropic-dangerous-direct-browser-access: true`** : explicite. À conserver tant que le projet est local-only (pas de proxy backend).
- **XSS local via `innerHTML` + données utilisateur** (cf. §5.3 critique #3).
- **Données LocalStorage non validées** : `load()` fusionne via spread sans schéma. Si une version future ajoute un champ obligatoire, les vieilles sauvegardes le perdent silencieusement (mais le fallback `defs().g` couvre).
- **API errors** : `fetchMeteo`, `fetchSolarPhases` ont `catch(e) {}` — silencieux. Idem `save()`.
- **`d.content[0].text`** ([ui.js:1270](js/ui.js#L1270), [1383](js/ui.js#L1383)) sans guard — si Anthropic renvoie une erreur (rate limit, key invalide), `d.content` est `undefined`, le crash est attrapé par le try/catch global mais le diagnostic est noyé dans `e.message`.
- **`JSON.parse(match[0])`** sans try interne — déjà dans un try/catch externe, OK mais le message d'erreur générique masque la racine.

### 9.5 Maintenabilité

**Fonctions trop longues (>50 lignes sans découpage)** :
- `p.draw()` (render.js, ~340 lignes).
- `p.touchStarted` (render.js, ~80 lignes).
- `toggleHab` (app.js, ~100 lignes).
- `updBubbleNow` (app.js, ~95 lignes).
- `askClaude` (ui.js, ~155 lignes).
- `genSoutien` + `sendSoutienMsg` (ui.js, ~110 + 110 lignes).
- `acheterPropClaude` (ui.js, ~110 lignes).
- `genBilanSemaine` (ui.js, ~90 lignes).
- `checkWelcome` (ui.js, ~90 lignes).
- `renderProps` (ui.js, ~65 lignes).
- `ouvrirSnack` (ui.js, ~85 lignes).
- `renderAgendaJour` (ui.js, ~105 lignes).
- `renderAgendaMois` (ui.js, ~150 lignes).
- `renderAgendaCycle` (ui.js, ~230 lignes).
- `afficherFormulaireRdv` (ui.js, ~115 lignes).

**Magic numbers récurrents** :
- `15` (XP par habitude, par note journal) — partout.
- `10` (max poops/jour, coût IA prop) — confond les contextes.
- `3` (limite pensées/jour, limite bilans/semaine, limite soutiens/jour) — répété.
- `6` (limite messages soutien) — hardcodé dans le HTML *et* le JS.
- `2`, `4` (gain pétales snack) — hardcodés dans `giveSnack`.
- Coordonnées `200`, `120`, `35`, `26` (canvas, bornes walk, hitbox).

**Logique métier mélangée avec affichage** :
- Cas net dans `toggleHab` ([app.js:535](js/app.js#L535)) : XP, pétales, log + dans la même fonction : `flashBubble`, `floatXP`, particules, animations corps, confettis. ~100 lignes mélangent état et FX.
- Idem dans `giveSnack` ([app.js:399](js/app.js#L399)).

**TODO/FIXME existants** : aucun `TODO|FIXME|XXX|HACK` — bon point. ⚠️ Un commentaire `❌ SUPPRIMÉ` subsiste (ui.js:L2555) — à nettoyer.

### 9.6 Dette technique connue à vérifier

| Item | Status réel | Détails |
|---|---|---|
| `render.js` monolithique | ✅ confirmé | 1189 lignes, `p.draw` = 340 lignes. Responsabilités enchevêtrées : sprites, env, props, locomotion, HUD, tap, FX. |
| `toggleHab()` ancienne API `addEvent(type, valeur, label)` | ✅ résolu (session 4) | Migré en forme objet. |
| `saveJ()` ancienne API | ✅ résolu (session 4) | Migré en forme objet. |
| `claude-sonnet-4-5` hardcodé | ✅ résolu (session 3) | Constante `AI_MODEL` dans config.js. Helper `callClaude()` dans ui.js (session 6). |
| Variables `window.*` globales | ✅ confirmé | ~40 globales. Liste résumée : `D, PROPS_LIB, PROPS_LOCAL, PERSONALITY, AI_CONTEXTS, AI_SYSTEM, celebQueue, shakeTimer, meteoData, _gotchiActif, APP_VERSION, JOURNAL_MAX_PER_DAY, JOURNAL_MAX_CHARS, getCyclePhase, getSolarPhase, particles, touchReactions, eatAnim, triggerGotchiBounce, triggerGotchiShake, spawnP, _nextBlinkAt, _blinkDuration, _evoAnim, triggerEvoAnim, _adultPose, _expr, triggerExpr, _starTrail, _gotchiNearPoop, _gotchiX, _gotchiY, _cleanPositions, _lastTapTime, _lastTapX, _petCount, _lastPetTime, _petResetTimer, _bubbleTimer, _derniereBulle, _forceHour, _bounceT, _jumpTimer, initUI, rangerTout, _boutiqueOnglet, _soutienHistory, _soutienCount, _editMood, _agendaJour, _rdvEmoji, _rdvRecurrence, _rdvDuree, _editRdvId, _journalWOff, _debugLogs, showDebug`. Risques de collision : avec p5 (`p5`), avec un futur module éditeur (`editor.html` n'a pas été audité — vérifier). |
| Seuil dithering `en < 40` | ⚠️ partiellement | Le seuil **40** correspond au **tilt** ([render.js:906](js/render.js#L906)), pas au dithering. Le dithering est `en < 10` (3 occurrences : [render.js:366](js/render.js#L366), [501](js/render.js#L501), [709](js/render.js#L709)). Bras tombés : `en < 25` (baby/teen), `en < 20` (adult). À aligner ou documenter. |

---

## 10. Plan de refactoring recommandé

### Phase 1 — Corrections critiques ✅ COMPLÉTÉE (2026-04-27)

1. ✅ **`ui.js` — supprimer la redéfinition de `getWeekId`** — fait en session 1.
2. ✅ **`ui.js` — extraire `claude-sonnet-4-5` en constante `AI_MODEL`** — fait en session 3 (`config.js`).
3. ✅ **`ui.js` — bug remboursement `acheterPropClaude`** `+ 16` → `+ 10` — fait en session 1.
4. ✅ **`render.js` — supprimer la double pluie** — fait en session 2.
5. ✅ **`app.js` — fusionner les deux `visibilitychange`** — fait en session 1.
6. ✅ **`app.js` — `location.reload(true)` → `location.reload()`** — fait en session 1.
7. ✅ **`ui.js` — sanitiser les données utilisateur dans `innerHTML`** — fait en session 5. Fonction `escape()` créée, appliquée sur `D.g.name` (6 occurrences), `prop.nom` (3), `e.text` (textarea journal), `r.heure`/`r.label` (agenda).

### Phase 2 — Nettoyage (quick wins)

1. ✅ **`ui.js`** — supprimer `sauvegarderRdvEdit` (mort) — fait en session 5.
2. ✅ **`ui.js`** — supprimer la variable `masquerAcquis` et la fonction `toggleMasquerAcquis` — fait en session 5.
3. ✅ **`ui.js`** — supprimer la 2e garde `if (!selMood)` dans `saveJ` — fait en session 5.
4. ✅ **`ui.js`** — supprimer `a, b` inutilisés dans `exportJournal('semaine')` — fait en session 5.
5. ✅ **`envs.js`** — réduire `drawFrameMotif` à un seul bloc — fait en session 2.
6. ✅ **`envs.js`** — supprimer la duplication du triangle de pic montagne — fait en session 2.
7. ✅ **`render.js`** — renommer le 2e `wc` en `wcMeteo` — fait en session 5.
8. ✅ **`app.js`** — `forceUpdate` : supprimer l'argument `true` de `reload()` — fait en session 1.
9. ✅ **`app.js`** — supprimer `D.userName` (chemin mort → `D.g.userName`), `D.lat` et `D.lng` à la racine de `defs()` — fait en session 5.
10. ✅ **`app.js`** — passer la sauvegarde des sliders (`setEnergy`/`setHappy`) en debounce 300ms — fait en session 5. Fonction `saveDebounced()` ajoutée.
11. ✅ **`ui.js`** — uniformiser `addEvent` : 3 appels migrés en API objet — fait en session 4.

### Phase 3 — Amélioration structurelle (moyen terme)

1. ✅ **Découper `render.js`** — sprites extraits dans `render-sprites.js` (session 9). Reste à faire si besoin :
   - `render-fx.js` (particules, touchReactions, eatAnim, evoAnim)
   - `render-hud.js` (overlay haut + tap zones)
2. **Découper `ui.js`** en au moins :
   - `ui-core.js` (toast, modal, animEl, go, navigation)
   - `ui-shop.js` (boutique, props)
   - `ui-ai.js` (askClaude, sendSoutienMsg, genBilanSemaine, acheterPropClaude — `callClaude` ✅ ajouté en session 6)
   - `ui-journal.js` (PIN, journal, exports)
   - `ui-agenda.js` (agenda, RDV, cycle)
   - `ui-perso.js` (palettes, couleurs Gotchi, thèmes env)
   - `ui-settings.js` (réglages, cheats, debug)
3. ✅ **Centraliser les constantes magiques** dans `config.js` — fait en sessions 7 et 8 :
   - Bloc GAMEPLAY : `XP_HABITUDE`, `XP_NOTE`, `XP_MAX`, `PETALES_SNACK`, `POOP_*_DELAY_MS`
   - Bloc SEUILS VISUELS : `EN_CRIT`, `EN_WARN`, `EN_TILT`, `HA_SAD`, `HA_MED`, `HA_MED_ADULT`, `HA_SLOW`, `HA_WALK`, `HA_HIGH`, `HA_HAPPY_TEEN`, `HA_ARMS_UP`
4. ✅ **Helper `callClaude({messages, max_tokens, system?, temperature?})`** — fait en session 6. 5 fetch() remplacés dans `ui.js`.
5. ✅ **Schéma de migration `D`** explicite — `SCHEMA_VERSION` + système de migrations ajouté dans `load()` (session 5/7). Protège les sauvegardes existantes.
6. ✅ **Tests manuels documentés** dans `TESTING.md` — fait en session 9. 11 sections + raccourcis console.

---

## 11. Glossaire des fonctions clés

### data/config.js
| Fonction/Const | Rôle | Lecteurs |
|---|---|---|
| `UI_PALETTES` | 6 palettes UI (CSS vars) | ui.js (`renderPerso`, `applyUIPalette`) |
| `GOTCHI_COLORS` | 6 couleurs sprite | render.js (`getGotchiC`), ui.js (`renderPerso`) |
| `ENV_THEMES` | 4 thèmes décor (parc/chambre/montagne) | render.js (`getEnvC`), envs.js (`drawActiveEnv`, `drawFrameMotif`, `drawThemeAccents`) |
| `MEAL_WINDOWS` | 3 fenêtres horaires | app.js (`getCurrentMealWindow`, `giveSnack`), ui.js (`ouvrirSnack`) |
| `SNACKS_POOL` | Pool d'emojis food | app.js (`ensureSnackPref`, `pickThreeSnacks`) |
| `AI_MODEL` | Modèle Claude actif | ui.js (`callClaude`) |
| `XP_HABITUDE` / `XP_NOTE` / `XP_MAX` | XP par action et seuil max | app.js (`addXp`, `nxtTh`), ui.js (`saveJ`, `checkAbsence`) |
| `PETALES_SNACK` | Pétales gagnés par snack | app.js (`giveSnack`) |
| `POOP_MIN_DELAY_MS` / `POOP_SPAWN_DELAY_MS` / `POOP_CHECK_INTERVAL_MS` | Timing des crottes | app.js (`maybeSpawnPoop`, `setInterval`) |
| `EN_CRIT` / `EN_WARN` / `EN_TILT` | Seuils visuels énergie (échelle 0-5) | render.js, render-sprites.js |
| `HA_SAD` / `HA_MED` / `HA_MED_ADULT` / `HA_SLOW` / `HA_WALK` / `HA_HIGH` / `HA_HAPPY_TEEN` / `HA_ARMS_UP` | Seuils visuels bonheur (échelle 0-5) | render.js, render-sprites.js, envs.js |

### js/app.js
| Fonction | Rôle | Appelée par | Appelle |
|---|---|---|---|
| `today()` | Date ISO du jour | partout | — |
| `hr()` | Heure courante (avec override `_forceHour`) | partout | — |
| `loadDataFiles()` | Fetch des 4 JSON data/prompts | `bootstrap` | `save`, `renderProps`, `updBadgeBoutique` |
| `defs()` | Structure D vide par défaut | `load`, `importD` | — |
| `getCyclePhase(ds)` | Phase cycle pour une date | `updBubbleNow`, agenda | — |
| `load()` | LocalStorage → D fusionné | bootstrap initial | `defs` |
| `save()` | D → LocalStorage | partout (~50 sites) | — |
| `addXp(n)` | XP + level-up + animation | `toggleHab`, `saveJ`, `checkWelcome` | `getSt`, `addEvent`, `triggerEvoAnim`, `flashBubble`, `save`, `updUI` |
| `spawnPoop()` / `maybeSpawnPoop()` / `cleanPoops()` | Cycle des crottes | `bootstrap`, `setInterval`, tap HUD | `addEvent`, `flashBubble`, `save` |
| `giveSnack(emoji)` | Crédit snack pétales | `ouvrirSnack` | `triggerExpr`, `flashBubble`, `addEvent`, `save` |
| `addEvent(...)` | Push événement (FIFO 40) | toute l'app | `updTabletBadge` |
| `toggleHab(catId)` | Cocher/décocher habitude | UI habs | `addXp`, `addEvent`, `flashBubble`, `triggerExpr`, `triggerGotchiBounce/Shake`, `spawnP`, `save`, `updUI`, `renderHabs` |
| `setEnergy/Happy(v)` | Slider commit | HTML inline | `save`, `updBubbleNow` |
| `fetchMeteo()` / `fetchSolarPhases()` | Open-Meteo + sunrise-sunset | bootstrap, setInterval | `save`, `updMeteoIcons`, `animEl` |
| `flashBubble(msg, dur)` | Bulle temporaire | partout | `updBubbleNow` |
| `updBubbleNow()` | Recalcule la bulle ambiante | `flashBubble`, `setHappy`, `initUI`, `saveJ` | — |
| `bootstrap()` / `initApp()` | Cycle de vie PWA | `load`/`pageshow`/`visibilitychange` | `loadDataFiles`, `initBaseProps`, `catchUpPoops`, `initUI`, `fetchMeteo`, `fetchSolarPhases` |
| `getWeekId()` | ISO week id | `ensureSnackPref` (en théorie ; en pratique shadow par ui.js) | — |

### js/render.js
| Fonction | Rôle | Appelée par | Appelle |
|---|---|---|---|
| `getGotchiC()` / `getEnvC()` | Lookup palette active | `p.draw`, `drawSky` | — |
| `drawProp(p, prop, x, y)` | Pixel art d'un prop | `drawAccessoires`, `p.draw` | `pxFree` |
| `spawnP(x, y, c)` | Push particule | `toggleHab`, `cleanPoops`, `confirmSlot`, `acheterProp`, `triggerTouchReaction` | — |
| `drawSky` / `drawCl` / `drawZzz` | Ciel + nuages + Zzz | `p.draw` | `px`, `getSolarPhase` |
| `triggerTouchReaction` | FX au tap | `p.draw` (eatAnim), `p.touchStarted` | `flashBubble` |
| `p.draw` | Boucle principale (~340 lignes) | p5 framework | sprites (render-sprites.js), envs.js, helpers ci-dessus |
| `p.touchStarted` | Gestion taps | p5 framework | `cleanPoops`, `ouvrirSnack`, `triggerTouchReaction`, `triggerExpr` |

### js/render-sprites.js *(nouveau — session 9)*
| Fonction | Rôle | Appelée par | Appelle |
|---|---|---|---|
| `drawDither(p, x, y, w, h)` | Damier état critique (énergie basse) | `drawBaby`, `drawTeen`, `drawAdult` | `px` |
| `drawAccessoires(p, topY, eyeY, neckY)` | Accessoires équipés sur le sprite | `drawBaby`, `drawTeen`, `drawAdult` | `getPropDef`, `drawProp`, `pxFree` |
| `drawEgg(p, en, ha)` | Sprite stade œuf | `p.draw` | `px`, `getBreath` |
| `drawBaby(p, en, ha)` | Sprite stade bébé | `p.draw` | `px`, `getBreath`, `getCheekPulse`, `drawDither`, `drawAccessoires` |
| `drawTeen(p, en, ha)` | Sprite stade ado | `p.draw` | `px`, `getBreath`, `getCheekPulse`, `drawDither`, `drawAccessoires` |
| `drawAdult(p, en, ha)` | Sprite stade adulte avec poses idle | `p.draw` | `px`, `getBreath`, `getCheekPulse`, `drawDither`, `drawAccessoires` |

### js/envs.js
| Fonction | Rôle | Appelée par |
|---|---|---|
| `px(p, x, y, w, h)` / `pxFree` | Pose un rectangle aligné grille | partout dans render.js et envs.js |
| `tc(n, col)` | Renvoie color jour/nuit | `drawActiveEnv`, `drawFrameMotif`, `drawThemeAccents`, `drawTreeTheme` |
| `drawWind` / `drawFog` / `drawRain` / `drawSun` / `drawRainbow` | FX météo | `p.draw` |
| `drawActiveEnv(p, env, n, h)` | Décor parc/chambre/montagne | `p.draw` |
| `drawFrameMotif` / `drawThemeAccents` / `drawTreeTheme` / `drawCactus` / `drawFl` | Helpers décor | `drawActiveEnv` |
| `shadeN(hex)` | Assombrissement nuit (HSL) | `tc` |

### js/ui.js (sélection)
| Fonction | Rôle | Appelée par |
|---|---|---|
| `animEl` | Animate.css wrapper | toute l'UI |
| `go(t)` | Routeur SPA | menu, taps, post-action |
| `toast` / `toastModal` / `toastSnack` | Feedback éphémère | partout |
| `updUI` | Sync HUD avec D | toute mutation d'état |
| `renderHabs` / `renderProg` / `renderProps` / `renderPerso` / `renderJ` | Render des panneaux | `go`, save flows |
| `toggleHab` proxy via app.js | — | onclick HTML |
| `askClaude` / `acheterPropClaude` / `genSoutien` / `sendSoutienMsg` / `genBilanSemaine` | Appels API Claude | UI buttons |
| `ouvrirSnack` / `giveSnack` | Modale repas | tap HUD assiette, modale |
| `acheterProp` / `toggleProp` / `confirmSlot` / `rangerProp` / `rangerTout` | Inventaire/boutique | onclick |
| `renderJEntries` / `saveJ` / `editJEntry` / `delJEntry` / `exportJournal` | Journal | onclick + auto |
| `applyUIPalette` / `applyGotchiColor` / `applyEnvTheme` / `restorePerso` | Personnalisation | onclick + bootstrap |
| `openTablet` / `closeTablet` / `updTabletBadge` | Terminal log | onclick + `addEvent` |
| `checkWelcome` / `showWelcomeModal` / `confirmWelcome` | Onboarding + retour app | `initUI` |
| `applyCheatCode` | Console dev | onclick |
| `ouvrirAgenda` / `renderAgendaJour/Mois/Cycle` / `sauvegarderRdv` / `editerRdv` / `confirmerEditRdv` / `declarerRegles` | Agenda + cycle | menu + onclick |
| `initUI` | Bootstrap UI | `bootstrap` (app.js) |

---

## Notes de l'auditeur

- L'audit a été réalisé en lecture seule. Aucun fichier n'a été modifié.
- La quasi-totalité de `ui.js` a été lue (lignes 1-3735 ; quelques sections d'agenda lues plus rapidement). Les fonctions principales et les flows IA ont été lus intégralement.
- `editor.html` (104k) n'a pas été audité — il vit en parallèle d'index.html et mérite une passe séparée pour vérifier les collisions de globales.
- `data/props.json` (469 lignes) et `data/personality.json` (148 lignes) sont des données : non audités comme code mais leur présence/absence est utilisée via Promise.allSettled — fail-safe correct.
- `css/style.css` (643 lignes) hors scope.
- Aucune suggestion de cet audit ne propose de réécriture complète. Toutes sont conservatrices et localisées.
