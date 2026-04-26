# AUDIT HabitGotchi — 2026-04-26

> Audit de référence sur la branche `Annotation`, version `v3.02`. Lecture intégrale de `config.js`, `app.js`, `envs.js`, `render.js`, `sw.js`, `index.html`, `prompts/*.json`. Lecture quasi-intégrale de `ui.js` (3735 lignes — 100% des fonctions principales lues, quelques sections de rendu d'agenda parcourues). `data/props.json` et `data/personality.json` parcourus comme données pures (pas d'analyse de code).

---

## 0. Résumé exécutif

### Score de santé global

| Fichier | Score | Justification courte |
|---|---|---|
| `data/config.js` | **A** | Pure data, bien commentée, 156 lignes. |
| `js/app.js` | **B** | Bien commentée, mais double API `addEvent`, doubles écouteurs `visibilitychange`, `getWeekId` doublonné avec ui.js. |
| `js/render.js` | **C** | 1189 lignes monolithiques. `p.draw()` mélange état métier + rendu. Logique pluie dupliquée. |
| `js/envs.js` | **B** | Bien découpé. Doublons dans `drawFrameMotif` (4 branches identiques) et `drawActiveEnv` (montagne dessinée 2×). |
| `js/ui.js` | **D** | 3735 lignes, 5 occurrences `claude-sonnet-4-5` hardcodées, modèle UI mélangé avec API IA, fonction `getWeekId` redéfinie qui shadow celle d'app.js, HTML dans des template strings (XSS-prone), `_agendaJour` accédé en bare globals. |
| `index.html` | **B** | 593 lignes, JS inline (debug panel ~80 lignes) qui devrait migrer dans un fichier. Sinon structure claire. |
| `sw.js` | **A** | 70 lignes, stratégie cache-first claire. Versionné. Petit bémol : caching aveugle des fetchs cross-fingers. |
| `style.css` | non audité (643 lignes) | hors scope JS. |
| `prompts/*.json` | **A** | Concis et structurés. |

### Les 3 problèmes les plus urgents

1. **Modèle Claude `claude-sonnet-4-5` hardcodé en 5 endroits** ([ui.js:358](js/ui.js#L358), [1267](js/ui.js#L1267), [1380](js/ui.js#L1380), [1628](js/ui.js#L1628), [1774](js/ui.js#L1774)) → toute migration de modèle (4.5 → 4.6 → 4.7) demande 5 modifications synchronisées, oubli probable. À extraire en constante.
2. **Doublon de `getWeekId`** ([app.js:324](js/app.js#L324) ISO + [ui.js:1691](js/ui.js#L1691) approximatif). La 2e définition shadow la première dans le scope global ; selon l'ordre de chargement, `ensureSnackPref` peut piocher un nouvel emoji "préféré" à un moment incohérent avec l'identifiant utilisé par `checkBilanReset`. Risque silencieux : snack préféré mal aligné aux bornes de semaine.
3. **API `addEvent(type, valeur, label)` ancienne ET nouvelle utilisées en parallèle** ([app.js:479](js/app.js#L479) accepte les deux ; appels mélangés à [app.js:562](js/app.js#L562), [ui.js:2006](js/ui.js#L2006), [ui.js:2409](js/ui.js#L2409) en ancienne ; [app.js:261](js/app.js#L261), [421](js/app.js#L421), [468](js/app.js#L468), [ui.js:688](js/ui.js#L688), [1301](js/ui.js#L1301), [1404](js/ui.js#L1404) en nouvelle). Le rendu de la tablette ([ui.js:2300](js/ui.js#L2300)) accède à `ev.subtype` et `ev.emoji` qui n'existent pas dans l'ancienne forme → événements affichés sans icône fine. À unifier sur la nouvelle API objet.

### Les 3 quick wins les plus faciles

1. **Pluie dessinée 2× quand `ha < 40`** ([render.js:776](js/render.js#L776) puis [render.js:781](js/render.js#L781)). Supprimer le 2e bloc → +5–10% de FPS sur cas pluvieux.
2. **`drawFrameMotif`** ([envs.js:278](js/envs.js#L278)) a 4 branches `if/else if` strictement identiques. Remplacer par un seul appel.
3. **Double `visibilitychange`** ([app.js:907](js/app.js#L907) + [app.js:1000](js/app.js#L1000)). Fusionner en un seul handler — actuellement le 2e appelle `initApp()` mais le 1er ne sait pas qu'il est doublé, on persiste `lastTick` inutilement.

---

## 1. data/config.js

### 1.1 Vue d'ensemble
156 lignes. Constantes pures : palettes UI, couleurs Gotchi, thèmes d'environnements, fenêtres repas, pool de snacks. Aucune logique. Complexité minimale.

### 1.2 Points forts
- Commentaires d'intention (RÔLE, métaphores) très bien rédigés.
- Index `id` cohérent à travers `UI_PALETTES`, `GOTCHI_COLORS`, `ENV_THEMES` (pivot stable pour le reste du code).
- `MEAL_WINDOWS` : structure simple, exploitable directement par `Object.entries`.

### 1.3 Problèmes identifiés

#### 🔵 STYLE
**Constantes globales sans namespace**
- Lignes : `15`, `31`, `48`, `128`, `140`
- Description : `UI_PALETTES`, `GOTCHI_COLORS`, `ENV_THEMES`, `MEAL_WINDOWS`, `SNACKS_POOL` polluent l'espace global. Acceptable pour un projet vanilla, mais collision possible si un `<script>` tiers est ajouté.
- Risque : faible aujourd'hui, augmente si on monte un éditeur (`editor.html` existe déjà et déclare probablement les mêmes noms).
- Suggestion : envelopper dans un `window.HG_CONFIG = { palettes, gotchiColors, envThemes, meals, snacks }` à terme.

#### 🟡 MINEUR
**Pas de `const` figée — palette `card` non documentée**
- Lignes : `16-21`
- Description : la clé `card` (`rgba(255,255,255,.88)`) est identique pour toutes les palettes. Soit factoriser, soit documenter pourquoi elle est répétée (extensibilité future ?).

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

#### 🔴 CRITIQUE
**Double API `addEvent` — incohérence d'événements en log**
- Lignes : `479-491`
- Description : la fonction accepte `addEvent(typeObj)` OU `addEvent(type, valeur, label)`. Les appels en ancienne API ([L562](js/app.js#L562), [ui.js:2006](js/ui.js#L2006), [ui.js:2409](js/ui.js#L2409)) ne posent pas de `subtype`/`emoji`, donc l'icône calculée par `getIcon()` ([ui.js:2300](js/ui.js#L2300)) tombe sur un fallback générique.
- Risque : tablette rétro affiche des icônes incohérentes selon l'origine de l'événement. Pas de crash.
- Suggestion : choisir la forme objet, faire un sweep et migrer les 3 appels restants.

#### 🟠 IMPORTANT
**Double `visibilitychange`**
- Lignes : `907-909` et `1000-1004`
- Description : 2 listeners distincts. Le 1er persiste `lastTick`, le 2e relance `initApp()`. Aujourd'hui ils ne se contredisent pas, mais ils ouvrent la porte à un double-trigger si plus tard `initApp` modifie `lastTick`.
- Risque : effets de bord cumulatifs si la logique change.
- Suggestion : un seul handler qui fait les deux.

#### 🟠 IMPORTANT
**`getWeekId` ISO redéfini en non-ISO dans ui.js**
- Lignes : `324-332`
- Description : version ISO correcte (jeudi pivot). `ui.js:1691` la redéfinit en algo approximatif. Comme les deux sont des `function` au scope global, **le second écrase le premier au moment du parse de ui.js**.
- Risque : `ensureSnackPref` ([L364](js/app.js#L364)) et `checkBilanReset` ([ui.js:1699](js/ui.js#L1699)) utilisent désormais la version approximative — divergence possible en début/fin d'année (semaines 52/53/1).
- Suggestion : supprimer la définition d'ui.js et laisser celle d'app.js (ISO).

#### 🟡 MINEUR
**`forceUpdate()` utilise `location.reload(true)` déprécié**
- Lignes : `231`
- Description : l'argument booléen de `reload()` est ignoré sur tous les navigateurs modernes.
- Risque : nul (juste mort), mais induit en erreur la lecture du code.
- Suggestion : `location.reload()`.

#### 🟡 MINEUR
**`MSG` fallback ([L106](js/app.js#L106)) sans clés `chaud`, `froid`, `journal`**
- Lignes : `106-113`
- Description : `updBubbleNow` ([L838-840](js/app.js#L838)) tente d'ajouter `src.chaud`, `src.froid` ; `saveJ` ([ui.js:2014](js/ui.js#L2014)) lit `src.journal`. Si `personality.json` ne charge pas, ces clés sont `undefined` et `ajouter()` court-circuite — silencieux mais incomplet.
- Risque : fallback dégradé sans message visible.
- Suggestion : compléter MSG ou logger un warning quand on tombe sur ce fallback.

#### 🟡 MINEUR
**`save()` swallow silencieux**
- Lignes : `200-202`
- Description : `try/catch` qui avale toute exception — plein localStorage Safari privé, quota, etc. → utilisateur ne sait pas que ses données ne sont plus sauvegardées.
- Risque : perte de données silencieuse.
- Suggestion : au minimum `console.warn`, idéalement un toast une seule fois par session.

#### 🟡 MINEUR
**`addXp(-15)` au décochage : pas de downgrade visuel**
- Lignes : `253-272`
- Description : la comparaison `ancienStade !== nouveauStade` détecte uniquement les level-up car `triggerEvoAnim` est appelée seulement si `n > 0`. Cohérent avec l'intention (ne pas spammer une régression), mais le `stage` peut bel et bien régresser en arrière-plan.
- Risque : sprite redessiné à un stade inférieur sans animation explicite. Voulu ? À expliciter.
- Suggestion : ajouter un commentaire ou un `addEvent` informatif quand on régresse.

#### 🟡 MINEUR
**`calcStr()` : sécurité `s>999`**
- Lignes : `502`
- Description : OK, mais utiliser `for (let i=0; i<999; i++)` serait plus lisible que `while(true)` + break.

#### 🟡 MINEUR
**Coordonnées Toulouse hardcodées par défaut**
- Lignes : `133-134`, `682-683`
- Description : `lat: 43.6047, lng: 1.4442` (Toulouse) sans constante nommée. Lisible si on connaît la ville, opaque sinon.

### 2.4 Code mort / redondances
- `D.userName` est lu à plusieurs endroits ([L209](js/app.js#L209), [ui.js:1212](js/ui.js#L1212)) mais n'est **jamais écrit** — `defs()` ne le contient pas. C'est une « ancien path » : la valeur réelle vit dans `D.g.userName`. À nettoyer (chaque `D.userName ||` est mort).
- `MSG` ([L106](js/app.js#L106)) : si `personality.json` charge correctement (cas standard), MSG n'est jamais utilisé.
- `D.lat` / `D.lng` à la racine — inutilisés (les coords vivent dans `D.g.lat/lng`).

### 2.5 Annotations manquantes
- `defs()` ([L121](js/app.js#L121)) : pas de docstring listant les sous-champs (et il y en a beaucoup).
- `addXp()` : pas de doc sur le fait que `n` peut être négatif.
- `floatXP()` ([L509](js/app.js#L509)) : pas de doc.

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

#### 🔴 CRITIQUE
**Pluie dessinée 2× quand `ha < 40`**
- Lignes : `776` (dans le `if (!sleeping)` block) et `781` (en dehors)
- Description : `drawRain(p, ha)` est appelée deux fois consécutives quand `ha < 40` ; quand `ha === 40`, idem `drawRain(p, 35)` deux fois.
- Risque : double densité de gouttes + double coût CPU dans la boucle de dessin (12fps mais quand même).
- Suggestion : supprimer les deux lignes 781-782 — la branche du dessus couvre déjà.

#### 🟠 IMPORTANT
**`p.draw()` est un bloc de 340+ lignes**
- Lignes : `749-1092`
- Description : 12 sections numérotées en commentaires, sans découpage en sous-fonctions. Chaque modification touche une fonction de 340 lignes.
- Risque : refactor risqué, lecture fastidieuse, conflits de merge fréquents.
- Suggestion : extraire `drawHud(p, g)`, `drawProps(p, layer)`, `updateLocomotion(p)`, `drawTouchReactions(p)`, `drawNightOverlay(p, darkAlpha)`. Garder `p.draw()` comme orchestrateur de 30-40 lignes.

#### 🟠 IMPORTANT
**`p.touchStarted` dans `p5s` accède à des coordonnées de hitbox basées sur des constantes magiques**
- Lignes : `1132-1151`
- Description : hitbox `±26` x `±35`, `mx-72`, `mx-128`, `my < 26`. Aucune constante nommée, copiée pour les boutons HUD (poop @ x=72, snack @ x=128).
- Risque : si tu déplaces un emoji de HUD dans `p.draw()` (lignes 1074, 1081), tu casses la hitbox sans warning.
- Suggestion : `const HUD_BTN_POOP_X = 72;` etc. au sommet du fichier.

#### 🟠 IMPORTANT
**Mutation directe de `window.shakeTimer` depuis 4+ endroits**
- Lignes : `44`, `730`, `908`, `916-917`
- Description : variable globale décrémentée dans `p.draw()` mais initialisée et lue à plusieurs endroits sans contrat clair (qui peut écrire ?).
- Risque : si une nouvelle réaction d'animation oublie d'incrémenter sans vérifier l'état précédent, le shake se cumule mal.
- Suggestion : `window.triggerShake(duration)` qui prend `Math.max(current, duration)`.

#### 🟡 MINEUR
**`updateParts` parse la couleur à chaque particule à chaque frame**
- Lignes : `256`
- Description : `p.color(pt.c)._array.slice(...)` à chaque tick pour chaque particule. Avec ~40 particules après confettis ça reste OK à 12fps mais c'est inutile : pourquoi ne pas pré-stocker `[r,g,b]` au moment du `spawnP`.
- Suggestion : stocker `pt.rgb = [r,g,b]` au spawn.

#### 🟡 MINEUR
**Seuil dithering `en < 10` dans 3 fonctions**
- Lignes : `366`, `501`, `709`
- Description : seuil identique mais hardcodé. La consigne mentionnait `en < 40` ; c'est le seuil **tilt** ([L906](js/render.js#L906)) — différent du dithering. À ne pas confondre.
- Suggestion : `const ENERGY_DITHER_THRESHOLD = 10` et `const ENERGY_TILT_THRESHOLD = 40` au sommet.

#### 🟡 MINEUR
**Variable `wc` redéclarée dans `p.draw`**
- Lignes : `952` (`const wc = window.meteoData?.weathercode`) puis `1060` (`const wc = ...`)
- Description : deux `const wc` dans la même fonction `p.draw` — JS le tolère car portées de blocs différentes (si elles sont dans des `if`/sous-blocs), mais ici ils sont dans la même portée (`p.draw`).
- Risque : SyntaxError potentielle selon strict mode. Aujourd'hui ça passe car L1060 est dans `if (window.meteoData?.temperature)`.
- Suggestion : renommer le second `wcMeteo` ou réutiliser.

#### 🟡 MINEUR
**`window._evoAnim` initialisé deux fois ([L49](js/render.js#L49) + via `triggerEvoAnim` [L51](js/render.js#L51))**
- OK fonctionnellement.

#### 🔵 STYLE
**Mélange de tabs/spaces et indentation inconsistante**
- Lignes : `826-839`, `956-961` notamment
- Suggestion : passer Prettier une fois.

### 3.4 Code mort / redondances
- `window._bounceT = 0` ([L34](js/render.js#L34)) jamais lu/écrit ailleurs (la vraie variable est `bounceT` locale au module).
- `window.celebQueue` est shifté ([L1033](js/render.js#L1033)) mais **jamais alimenté** dans le code lu — sans doute mort.
- `window._lastPetTime` ([L1168](js/render.js#L1168)) écrit, jamais lu.
- `window._petResetTimer` (pareil — utilisé localement, OK).
- `window.shadeN` n'existe pas (`shadeN` est dans envs.js, jamais exposée). `tc()` l'utilise correctement mais `tc` est aussi seulement local — pas un bug, juste trompeur.

### 3.5 Annotations manquantes
- `drawSky` ([L144](js/render.js#L144)) : pas de doc sur les paramètres (`h`, `ha`).
- `drawBaby` / `drawTeen` / `drawAdult` : pas de doc sur les retours `{topY, eyeY, neckY}`. `drawAccessoires` en dépend, ça mérite un commentaire.
- `p.draw` : aucun docstring pour ce bloc de 340 lignes.

---

## 4. js/envs.js

### 4.1 Vue d'ensemble
432 lignes. Décors par biome, météo (vent/brouillard/pluie/soleil/arc-en-ciel), helpers `tc/shadeN`, `drawTreeTheme`, `drawCactus`, `drawFl`. Complexité moyenne, bien découpée.

### 4.2 Points forts
- `shadeN()` ([L389](js/envs.js#L389)) : conversion HSL propre et commentée.
- Découpage par biome lisible (`drawActiveEnv` reste compréhensible).
- `pxFree()` vs `px()` bien différenciés et utiles.

### 4.3 Problèmes identifiés

#### 🟠 IMPORTANT
**`drawFrameMotif` : 4 branches identiques**
- Lignes : `278-303`
- Description : `automne`, `hiver`, `desert`, `else (pastel)` exécutent **exactement les mêmes appels `px`** avec les mêmes constantes — seul `theme.frameAccent1/2` change, mais ces clés sont déjà dans `theme`.
- Risque : nul mais maintenance onéreuse pour 0 valeur ajoutée.
- Suggestion : remplacer par un seul bloc qui lit `theme.frameAccent1/2`.

#### 🟠 IMPORTANT
**Pic de montagne dessiné 2×**
- Lignes : `240` puis `243`
- Description : `p.fill(tc(n, theme.mntPeak)); p.triangle(40, 120, 100, 50, 160, 120);` exécuté une fois inconditionnellement (L240) puis re-dessiné dans `if (theme.id !== 'desert')` (L243).
- Risque : surcoût marginal, pas de bug visuel (même triangle).
- Suggestion : supprimer la 1re occurrence et garder uniquement la branche conditionnelle.

#### 🟡 MINEUR
**`drawWind` particule blanche fixe `#d8d8e8`**
- Lignes : `46`
- Description : pas de variation selon le mode nuit. Visible ?
- Suggestion : passer dans `tc(n, '#d8d8e8')` si le test visuel le confirme.

#### 🟡 MINEUR
**`drawRain` aphalpha hardcodé**
- Lignes : `116`
- Description : alpha 200. Lecture aurait gagné à constanter.

### 4.4 Code mort / redondances
- Les 3 branches identiques de `drawFrameMotif` (cf. ci-dessus).
- Triangle de pic redondant.

### 4.5 Annotations manquantes
- `drawFrameMotif` : pas de docstring expliquant pourquoi chaque thème devrait avoir son motif (puisque concrètement, ils n'en ont pas).

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

#### 🔴 CRITIQUE
**`claude-sonnet-4-5` hardcodé en 5 endroits**
- Lignes : `358`, `1267`, `1380`, `1628`, `1774`
- Description : aucune constante. Migration ou A/B test = 5 modifs synchronisées.
- Risque : oubli garanti tôt ou tard.
- Suggestion : `const CLAUDE_MODEL = 'claude-sonnet-4-5'` au sommet (idéalement en config.js avec les autres constantes), ou même un wrapper `callClaude({model, max_tokens, prompt, system?})` qui factorise les 5 appels (ils ont 90% de code en commun : URL, headers, parsing JSON, gestion erreur).

#### 🔴 CRITIQUE
**Fonction `getWeekId` redéfinie**
- Lignes : `1691-1696`
- Description : redéfinit ce qui existe déjà dans app.js avec un algo plus simple mais moins exact (formule `((now - jan4)/86400000 + jan4.getDay()+1)/7`).
- Risque : décalage en semaines 52/53/1 — bilan hebdo et `snackPref` peuvent désaligner.
- Suggestion : supprimer la version de ui.js, garder celle d'app.js.

#### 🔴 CRITIQUE
**Injection HTML brute via `innerHTML` avec données utilisateur**
- Lignes : exemples : `262-266` (modal repas, interpole `D.g.name`), `860` (`prop.nom`), `2055` (`e.text`), `2418`, `2456`, `2716` (`r.label`), etc.
- Description : `D.g.name`, `prop.nom`, `journal.text`, `rdv.label` sont injectés dans des template strings et passés à `innerHTML`. Si l'utilisatrice met `<img onerror=...>` dans le nom du Gotchi ou une note de journal, c'est exécuté.
- Risque : XSS local. Pas exploitable à distance (pas de partage), mais si `acheterPropClaude` retourne une réponse mal parsée et que l'IA glisse du HTML dans `obj.nom`, ça s'exécute.
- Suggestion : passer par `textContent` quand c'est possible, ou échapper systématiquement (`String(x).replace(/[<>&"']/g, …)`). Au minimum sanitiser sur les données IA.

#### 🟠 IMPORTANT
**Variables d'état globales pour formulaire RDV**
- Lignes : `2909` (`window._rdvEmoji`), `2921` (`window._rdvRecurrence`), `2944` (`window._rdvDuree`), `3074` (`window._editRdvId`)
- Description : 4 globales partagées entre create/edit, jamais explicitement reset si on annule au mauvais moment.
- Risque : si tu ouvres le modal RDV, choisis un emoji, fermes sans sauvegarder, puis ré-ouvres : l'emoji reste sélectionné en mémoire mais pas visuellement.
- Suggestion : un objet `_rdvDraft = { emoji, recurrence, duree, editId }` réinitialisé à chaque `afficherFormulaireRdv()` et `editerRdv()`.

#### 🟠 IMPORTANT
**`voirBulles()` : test incohérent array/object**
- Lignes : `1048-1057`
- Description : `cb = D.g.customBubbles`. `Object.keys(cb)` puis `cb.map(...)`. Si `cb` est un array (cas standard), `Object.keys` retourne les indices. La condition `if (!etats.length)` fonctionne, mais c'est fragile : `defs()` initialise en `[]`, mais `debugProps()` ([ui.js:1003](js/ui.js#L1003)) sait gérer les deux formes — donc historiquement c'était un objet.
- Risque : si une vieille sauvegarde est restée en objet, `cb.map` crashe.
- Suggestion : forcer la normalisation en array au load (déjà partiellement fait dans `askClaude` L1282).

#### 🟠 IMPORTANT
**`renderProg()` cible des boutons par sélecteur attribut**
- Lignes : `2200`
- Description : `document.querySelector('[onclick="genBilanSemaine()"]')` — couplage fort entre HTML inline `onclick` et JS.
- Risque : si on migre vers `addEventListener`, ce sélecteur casse silencieusement.
- Suggestion : donner un `id="btn-bilan"` au bouton.

#### 🟠 IMPORTANT
**`saveJ()` a une garde dupliquée**
- Lignes : `1978-1983` puis `1998-2003`
- Description : la garde `if (!selMood)` est écrite deux fois. Code mort.
- Suggestion : supprimer la 2e occurrence.

#### 🟠 IMPORTANT
**`_agendaJour` et `_agendaMoisOffset` accédés sans `window.` dans certaines fonctions**
- Lignes : `2668` (`const ds = _agendaJour;`), `2773`, `2779`, `2963`, `2974`, `3037`, `3156`, `3162`, etc.
- Description : se reposent sur le fait que `var/let` au top-level deviennent globaux en mode non-strict. `_agendaJour` est défini avec `window._agendaJour = null;` (L2551) puis lu en bare. Ça marche **uniquement** parce que script non-module. Si jamais le fichier est passé en `<script type="module">`, tout casse.
- Risque : limite la marge de manœuvre future ; aujourd'hui : aucune.
- Suggestion : aligner sur `window._agendaJour` partout, ou déclarer `let _agendaJour = null` proprement et virer le `window.`.

#### 🟠 IMPORTANT
**`sauvegarderRdvEdit()` mort**
- Lignes : `3186-3197`
- Description : fonction définie, jamais appelée (l'édition passe par `confirmerEditRdv`). Réf. orpheline `document.querySelector('[onclick="sauvegarderRdvEdit()"]')`.
- Suggestion : supprimer.

#### 🟡 MINEUR
**Numéros de version visibles dans 5 fichiers**
- Description : `v3.02` dans app.js + sw.js + (probablement) commits. Le commentaire `⚠️ SYNC` est bien là.
- Suggestion : un script de release qui fait le bump.

#### 🟡 MINEUR
**`_soutienHistory` global et `D.apiKey` lus avec mélange `D` / `window.D`**
- Lignes : un peu partout
- Description : ce fichier alterne `D.g.x` et `window.D.g.x`. `D` est `window.D` dans le même scope, mais c'est confus à lire.
- Suggestion : choisir une seule convention (préférer `window.D` partout, plus explicite).

#### 🟡 MINEUR
**`navigator.clipboard.writeText` sans détection cohérente**
- Lignes : `1664`, `1799`, `3693`
- Description : `copierSoutien` détecte avec un fallback silencieux, `copyBilanSemaine` non, `copierCycles` détecte. Comportement incohérent.
- Suggestion : helper unique `copyToClipboard(text, successMsg)` qui gère tous les cas.

#### 🟡 MINEUR
**`acheterPropClaude` : remboursement de `+16` pour un coût de `10`**
- Lignes : `1327` (déduction `-10`) et `1427` (remboursement `+16`)
- Description : si l'API échoue, tu **gagnes 6 pétales**. Bug net.
- Risque : exploit involontaire — si l'API échoue souvent, l'utilisatrice voit ses pétales monter.
- Suggestion : changer `+ 16` en `+ 10`.

#### 🟡 MINEUR
**`exportJournal('semaine')` calcule `a` et `b` ([L2095](js/ui.js#L2095)) mais ne les utilise pas**
- Suggestion : supprimer.

#### 🟡 MINEUR
**`renderPin()` : event handlers nommés `b.onclick = …` (réécriture à chaque appel)**
- Lignes : `1915-1927`
- Description : à chaque clic le pad est recréé entièrement. OK mais inefficace.

### 5.4 Code mort / redondances
- `getWeekId` redéfinie ([L1691](js/ui.js#L1691)).
- `sauvegarderRdvEdit` ([L3186](js/ui.js#L3186)) jamais appelée.
- `toggleMasquerAcquis` ([L675](js/ui.js#L675)) — la variable `masquerAcquis` est définie ([L26](js/ui.js#L26)) mais aucune branche ne la lit. Mort.
- `cleanProps` / `confirmCleanProps` — accessibles depuis le panneau debug, OK mais peuvent doublonner avec `viderObjetsIA`.
- `tabletLastSeenDate` ([L2293](js/ui.js#L2293)) : `let` au top-level, jamais persisté. Si l'app se ferme, le badge réapparaît.
- Garde `if (!selMood)` dupliquée dans `saveJ`.
- Variables `a, b` calculées et inutilisées dans `exportJournal`.

### 5.5 Annotations manquantes
- `genSoutien`, `sendSoutienMsg`, `genBilanSemaine`, `acheterPropClaude` : aucun docstring sur le format de réponse attendu.
- `confirmerEditRdv` ([L3139](js/ui.js#L3139)) : les 3 modes (`simple`/`ce`/`suivants`) mériteraient un commentaire.
- `getCyclePhase` (app.js) commentée mais pas la logique des seuils J5/J13/J16.
- `applyCheatCode` ([L2509](js/ui.js#L2509)) : pas de liste documentée des codes (cf. table `codes`).

---

## 6. index.html

### 6.1 Vue d'ensemble
593 lignes. Structure : meta PWA + script debug inline (~85 lignes) + skeleton 5 panneaux + menu overlay + modale + tablette + scripts en fin.

### 6.2 Points forts
- Ordre de chargement explicite et commenté (config.js → app.js → render.js → envs.js → ui.js).
- Service Worker registré proprement.
- Commentaires « SYSTEM X » qui mappent les blocs aux modules JS.

### 6.3 Problèmes identifiés

#### 🟠 IMPORTANT
**Script de debug PWA inline (~85 lignes)**
- Lignes : `14-98`
- Description : capteur d'erreurs + panneau debug définis directement dans index.html. Cohabite avec `toggleDebugPanel` global utilisé dans le panneau Outils dev.
- Risque : non versionné par le SW (le HTML est cached, OK), mais difficile à tester unitairement.
- Suggestion : déplacer dans `js/debug.js` et charger en premier.

#### 🟠 IMPORTANT
**Tous les `onclick` sont inline**
- Description : couplage fort avec les noms de fonctions globales JS. Tout refactor JS doit grep `onclick="`.
- Risque : casse silencieuse, et CSP stricte impossible (si tu veux ajouter une politique de sécurité, `unsafe-inline` reste obligatoire).
- Suggestion : à long terme, `addEventListener` + délégation.

#### 🟡 MINEUR
**p5.js chargé via CDN sans SRI**
- Lignes : `124`
- Description : pas de `integrity=` ni `crossorigin`.
- Risque : compromise de la CDN = injection arbitraire.
- Suggestion : ajouter `integrity="sha384-..." crossorigin="anonymous"`.

#### 🟡 MINEUR
**`autocomplete="new-password"` sur la clé API**
- Lignes : `420`
- Description : OK pour ne pas auto-fill. Bonne pratique.

### 6.4 Code mort / redondances
- Les commentaires « SYSTEM X » sont parfois doublés sur le même bloc.

### 6.5 Annotations manquantes
- `manifest.json` n'a pas été lu — vérifier qu'il pointe les bonnes icônes.

---

## 7. sw.js

### 7.1 Vue d'ensemble
70 lignes. Cache-first strategy, version-based invalidation. Très lisible.

### 7.2 Points forts
- `skipWaiting()` + `clients.claim()` : nouveau SW prend le relais immédiatement.
- Filtre cross-origin propre (Anthropic/météo non interceptées).
- Liste explicite des assets.

### 7.3 Problèmes identifiés

#### 🟡 MINEUR
**Mise en cache aveugle des fetchs runtime**
- Lignes : `62-67`
- Description : tout fetch same-origin est cached, y compris les réponses 404 ou les éventuels endpoints futurs.
- Risque : faible aujourd'hui (pas d'API same-origin), mais à surveiller si ajout d'API locale.
- Suggestion : tester `response.ok` avant de cacher.

#### 🟡 MINEUR
**Pas de retry/timeout sur la promesse `cache.addAll(ASSETS)`**
- Description : si un asset 404 à l'install, l'install échoue et le SW reste en attente.
- Suggestion : OK pour l'instant (les assets sont locaux), mais documentaire.

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

#### 🟡 MINEUR
**Variables non documentées centralement**
- Description : `{{nameGotchi}}, {{userName}}, {{style}}, {{traits}}, {{cycleInfo}}, {{rdvAujourdhui}}, {{messages_restants}}, {{habsDone}}, {{habitudes}}, {{notes}}, {{exemples}}, {{nomsExistants}}, {{timestamp}}, {{theme}}, {{existingNames}}, {{typeImpose}}, {{weekStart}}, {{weekEnd}}, …`
- Risque : ajouter/renommer une variable côté JS sans la pousser ici (ou vice-versa) = silencieux.
- Suggestion : un README dans `prompts/` listant les variables et leur source.

---

## 9. Analyse transversale

### 9.1 Architecture globale

```
index.html
  └─ <script src=> (ordre):
       data/config.js   (constantes pures)
       js/app.js        (état D, save/load, métabolisme, météo, bootstrap)
         ↓ déclare window.D, window.PROPS_LIB, hr(), today(), addEvent, save, …
       js/render.js     (p5 instance, sprites, draw loop, HUD, taps)
         ↓ lit window.D, expose window.spawnP, window.triggerExpr, …
       js/envs.js       (décors, météo visuelle, shadeN, tc, drawActiveEnv)
         ↓ utilisé par render.js (via globals)
       js/ui.js         (interactions, modales, IA, agenda, init UI)
         ↓ expose window.initUI, appelé par bootstrap d'app.js
       sw.js            (cache PWA)
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

**API IA** : aucun debounce. `askClaude` est limité à 3/jour côté code, mais rien n'empêche de spammer le bouton avant que la première requête revienne (le compteur n'est incrémenté qu'**après** réponse [L1307](js/ui.js#L1307)).
- Risque : 4-5 requêtes parallèles si l'utilisatrice double-clique pendant le `thinking`.
- Suggestion : `btn.disabled = true` au début, `false` au catch/then.

**Polling fetchMeteo** : `setInterval(fetchMeteo, 1800000)` (30 min). OK. Mais aucun `clearInterval` à l'unload — fuite si ré-init.

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

**TODO/FIXME existants** : grep rapide ne trouve rien d'explicite (`TODO|FIXME|XXX|HACK`) — bon point. Mais le code contient plusieurs commentaires « ❌ SUPPRIMÉ » ([ui.js:2400](js/ui.js#L2400)) qui mériteraient une vraie suppression de commentaire (info historique, plus actuelle).

### 9.6 Dette technique connue à vérifier

| Item | Status réel | Détails |
|---|---|---|
| `render.js` monolithique | ✅ confirmé | 1189 lignes, `p.draw` = 340 lignes. Responsabilités enchevêtrées : sprites, env, props, locomotion, HUD, tap, FX. |
| `toggleHab()` ancienne API `addEvent(type, valeur, label)` | ✅ confirmé | [app.js:562](js/app.js#L562). |
| `saveJ()` ancienne API | ✅ confirmé | [ui.js:2006](js/ui.js#L2006). Aussi présente dans `checkWelcome` [ui.js:2409](js/ui.js#L2409). |
| `claude-sonnet-4-5` hardcodé | ✅ confirmé | **5 occurrences** : ui.js lignes 358, 1267, 1380, 1628, 1774. |
| Variables `window.*` globales | ✅ confirmé | ~40 globales. Liste résumée : `D, PROPS_LIB, PROPS_LOCAL, PERSONALITY, AI_CONTEXTS, AI_SYSTEM, celebQueue, shakeTimer, meteoData, _gotchiActif, APP_VERSION, JOURNAL_MAX_PER_DAY, JOURNAL_MAX_CHARS, getCyclePhase, getSolarPhase, particles, touchReactions, eatAnim, triggerGotchiBounce, triggerGotchiShake, spawnP, _nextBlinkAt, _blinkDuration, _evoAnim, triggerEvoAnim, _adultPose, _expr, triggerExpr, _starTrail, _gotchiNearPoop, _gotchiX, _gotchiY, _cleanPositions, _lastTapTime, _lastTapX, _petCount, _lastPetTime, _petResetTimer, _bubbleTimer, _derniereBulle, _forceHour, _bounceT, _jumpTimer, initUI, rangerTout, _boutiqueOnglet, _soutienHistory, _soutienCount, _editMood, _agendaJour, _rdvEmoji, _rdvRecurrence, _rdvDuree, _editRdvId, _journalWOff, _debugLogs, showDebug`. Risques de collision : avec p5 (`p5`), avec un futur module éditeur (`editor.html` n'a pas été audité — vérifier). |
| Seuil dithering `en < 40` | ⚠️ partiellement | Le seuil **40** correspond au **tilt** ([render.js:906](js/render.js#L906)), pas au dithering. Le dithering est `en < 10` (3 occurrences : [render.js:366](js/render.js#L366), [501](js/render.js#L501), [709](js/render.js#L709)). Bras tombés : `en < 25` (baby/teen), `en < 20` (adult). À aligner ou documenter. |

---

## 10. Plan de refactoring recommandé

### Phase 1 — Corrections critiques (à faire en priorité)

1. **`ui.js` — supprimer la redéfinition de `getWeekId`** ([L1691](js/ui.js#L1691)). Action : supprimer les lignes 1691-1696. Tester `genBilanSemaine` et `ensureSnackPref` autour d'un changement de semaine.
2. **`ui.js` — extraire `claude-sonnet-4-5` en constante**. Action : déclarer `const CLAUDE_MODEL = 'claude-sonnet-4-5'` au sommet d'ui.js (ou dans config.js), remplacer les 5 occurrences. Tester la connexion via `testApiKey`.
3. **`ui.js` — bug remboursement `acheterPropClaude`** ([L1427](js/ui.js#L1427)) : changer `+ 16` en `+ 10`.
4. **`render.js` — supprimer la double pluie** : retirer les lignes 781-782.
5. **`app.js` — fusionner les deux `visibilitychange`** : un seul handler à la fin du fichier, qui fait les deux.
6. **`ui.js` — sanitiser les données utilisateur dans `innerHTML`** : minimum vital — un helper `escapeHTML(s)` appliqué à `D.g.name`, `prop.nom`, `journal.text`, `rdv.label`, et **toutes les valeurs venant de réponses IA**.

### Phase 2 — Nettoyage (quick wins)

1. **`ui.js`** — supprimer `sauvegarderRdvEdit` (mort, [L3186](js/ui.js#L3186)).
2. **`ui.js`** — supprimer la variable `masquerAcquis` et la fonction `toggleMasquerAcquis` ([L26](js/ui.js#L26), [L675](js/ui.js#L675)).
3. **`ui.js`** — supprimer la 2e garde `if (!selMood)` dans `saveJ` ([L1998-2003](js/ui.js#L1998)).
4. **`ui.js`** — supprimer `a, b` inutilisés dans `exportJournal('semaine')` ([L2095](js/ui.js#L2095)).
5. **`envs.js`** — réduire `drawFrameMotif` à un seul bloc.
6. **`envs.js`** — supprimer la duplication du triangle de pic montagne ([L240](js/envs.js#L240)).
7. **`render.js`** — renommer le 2e `wc` ([L1060](js/render.js#L1060)) pour éviter le shadowing apparent.
8. **`app.js`** — `forceUpdate` : supprimer l'argument `true` de `reload()`.
9. **`app.js`** — supprimer `D.userName`, `D.lat`, `D.lng` à la racine (les `||` qui les utilisent comme fallback peuvent partir).
10. **`app.js`** — passer la sauvegarde des sliders (`setEnergy`/`setHappy`) en debounce 300ms.
11. **`ui.js`** — uniformiser `addEvent` : migrer les 3 derniers appels en API objet.

### Phase 3 — Amélioration structurelle (moyen terme)

1. **Découper `render.js`** en modules clairs :
   - `render-core.js` (boucle p5, locomotion, draw orchestrateur)
   - `render-sprites.js` (drawEgg/Baby/Teen/Adult/drawAccessoires)
   - `render-fx.js` (particules, touchReactions, eatAnim, evoAnim)
   - `render-hud.js` (overlay haut + tap zones)
2. **Découper `ui.js`** en au moins :
   - `ui-core.js` (toast, modal, animEl, go, navigation)
   - `ui-shop.js` (boutique, props)
   - `ui-ai.js` (askClaude, sendSoutienMsg, genBilanSemaine, acheterPropClaude — avec un helper `callClaude` commun)
   - `ui-journal.js` (PIN, journal, exports)
   - `ui-agenda.js` (agenda, RDV, cycle)
   - `ui-perso.js` (palettes, couleurs Gotchi, thèmes env)
   - `ui-settings.js` (réglages, cheats, debug)
3. **Centraliser les constantes magiques** (XP, limites, seuils, slots, tailles canvas) dans `config.js`.
4. **Helper unique `callClaude({mode, prompt, system?, model?})`** qui gère URL, headers, parsing JSON, gestion erreur — utilisé par les 5 sites d'appel.
5. **Schéma de migration `D`** explicite : un `MIGRATIONS = { 'v3.02': fn, 'v3.01': fn }` dans `load()` qui transforme les anciennes formes (par exemple `D.userName` → `D.g.userName`).
6. **Tests manuels documentés** dans un `TESTING.md` : checklist des 10 chemins critiques (cocher habitude, snack, poop, achat boutique, IA pensée, IA cadeau, IA bilan, soutien, RDV récurrent, cycle).

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
| `drawDither` | Damier état critique | `drawBaby/Teen/Adult` | — |
| `drawAccessoires` | Accessoires sur sprite | `drawBaby/Teen/Adult` | `getPropDef`, `drawProp` |
| `drawEgg` / `drawBaby` / `drawTeen` / `drawAdult` | Sprites par stade | `p.draw` | `px`, `getBreath`, `getCheekPulse`, `drawDither`, `drawAccessoires` |
| `triggerTouchReaction` | FX au tap | `p.draw` (eatAnim), `p.touchStarted` | `flashBubble` |
| `p.draw` | Boucle principale (340 lignes) | p5 framework | tout ce qui est ci-dessus |
| `p.touchStarted` | Gestion taps | p5 framework | `cleanPoops`, `ouvrirSnack`, `triggerTouchReaction`, `triggerExpr` |

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
