# AUDIT IA & PERSONNALITÉ — HabitGotchi

> Généré par Claude Opus — 2026-05-01
> Version auditée : **v4.81** (`js/app.js:60`)

---

## Résumé exécutif

Le système de voix de HabitGotchi repose désormais entièrement sur `data/user_config.json` (le fichier `data/personality.json` historique a été supprimé et n'existe plus dans le repo — le code de chargement le confirme : `js/app.js:76` met un `Promise.resolve(null)` à sa place et `js/app.js:109-117` reconstitue `window.PERSONALITY` à partir de `USER_CONFIG.personality`). C'est une bonne unification, mais elle laisse des angles morts : les **traits** et le **style** définis pour Émilie / Alexia ne sont pas forcément cohérents entre eux ni avec ce que les prompts attendent (`getRegistre()` dans `js/ui-ai.js:105-141` injecte des registres écrits "en dur" qui peuvent contredire le `style` user_config).

Côté API, 4 templates actifs (`askClaude.base + withGift|withoutGift`, `buyProp`, `genSoutien`, `genBilanSemaine`) sont bien construits mais sous-exploitent le contexte disponible (météo et phases solaires existent dans `window.D` mais ne sont injectées dans **aucun** prompt API), et la variable `{{registre}}` n'est utilisée que par `askClaude.base`. Côté bulles statiques, 17 catégories sont bien couvertes (entre 5 et 10 variantes chacune), avec un anti-répétition basique présent (`js/app.js:1119-1123`).

**Trois priorités** : (1) brancher la météo et le RDV/cycle dans `askClaude` (déjà disponibles côté JS) ; (2) introduire un objet `tone profile` dans `user_config.personality` pour qu'Alexia obtienne un ton vraiment différent au-delà du `style` libre ; (3) ajouter des catégories de bulles manquantes (`hygiene`, `repas`, `meteo_pluie`, `retour`) qui correspondent à des moments forts du gameplay aujourd'hui muets.

---

## Cartographie des échanges IA

### 1a — Appels API

| Fonction | Template (`prompts/ai_contexts.json`) | Variables injectées | Déclencheur | Limite | max_tokens |
|---|---|---|---|---|---|
| `askClaude()` (`ui-ai.js:164`) | `askClaude.base` + `askClaude.withGift` ou `askClaude.withoutGift` | `nameGotchi`, `userName`, `diminutif`, `registre`, `style`, `traits`, `energy`, `happiness`, `notesRecentes`, `exemples`, `nomsExistants` (déclarée mais NON utilisée dans le template), `timestamp`, `existingNames` (dans `withGift` mais jamais peuplée — bug, voir §2) | Bouton bulle de pensée du jour | 3 / jour (`thoughtCount`) + bloqué 22h–7h | défaut `callClaude` |
| `acheterPropClaude()` (`ui-ai.js:300`) | `buyProp` | `theme` (random), `existingNames`, `typeImpose` (calculé JS), `timestamp` | Bouton boutique IA (10 pétales) | coût pétales | défaut |
| `genSoutien()` → `_genSoutienCore()` (`ui-ai.js:613`) | `genSoutien` | `nameGotchi`, `userName`, `style`, `traits`, `heure`, `date`, `energy`, `happiness`, `habitsDone`, `habitsUndone`, `notes`, `cycleInfo`, `rdvAujourdhui` | Bouton "Besoin de soutien" | 3 sessions/jour, 6 messages/session | défaut |
| `sendSoutienMsg()` (`ui-ai.js:680`) | `ai_system.json` → `soutien` (system prompt) + `soutien_contexte` (system, concaténé) | `nameGotchi`, `userName`, `style`, `traits`, `heure`, `date`, `energy`, `happiness`, `habsDone`, `notes`, `cycleInfo`, `rdvAujourdhui`, `messages_restants` | Envoi message dans chat soutien | héritée de la session | défaut |
| `genBilanSemaine()` (`ui-ai.js:858`) | `genBilanSemaine` | `nameGotchi`, `userName`, `weekStart`, `weekEnd`, `stage`, `energy`, `happiness`, `habitudes`, `totalHabDays`, `notesCount`, `notes`, `bilanNote` | Bouton bilan dans Progression | 3 / semaine (`bilanCount`), uniquement semaine en cours | défaut |

### 1b — Bulles statiques (`data/user_config.json`, bloc `personality.bulles`)

22 catégories au total dans le fichier d'Émilie et le template Alexia :

| Catégorie | Variantes Émilie | Variantes Alexia | Déclencheur (`updBubbleNow()` / `flashBubble()`) |
|---|---|---|---|
| `matin` | 8 | 8 | `h < 12` (poids 2) |
| `aprem` | 8 | 8 | `12 ≤ h < 18` (poids 2) |
| `soir` | 8 | 8 | `h ≥ 18` (poids 2) |
| `nuit` | 7 | 7 | `h ≥ 22 || h < 7` (priorité 2, exclusive) |
| `triste` | 8 | 8 | `happiness ≤ 1` (poids 3) ou mood `dur` |
| `fatigue` | 8 | 8 | `energy ≤ 1` (poids 3) ou mood `bof` |
| `fierte` | 10 | 10 | `done ≥ 4` (poids 3) ou mood positif |
| `max` | 8 | 8 | `done === 6` (poids 3) |
| `idle` | 10 | 10 | Fallback si pool < 5 |
| `vent` | 5 | 5 | `meteoData.windspeed > 40` |
| `chaud` | 6 | 6 | `temperature ≥ 30` |
| `froid` | 5 | 5 | `temperature ≤ 10` |
| `peu` | 8 | 8 | `done === 0` (poids 2) |
| `cadeau` | 6 | 6 | Pas de déclencheur automatique observé — pool `cadeau` non utilisé par `updBubbleNow()` (utilisé uniquement dans `askClaude` pour `flashBubble` ad hoc, lignes 275-277) |
| `journal` | 6 | 6 | Aucun déclencheur observé — voir §5 (catégorie morte) |
| `custom` | 0 | 0 | Réservé extensions |
| `cb` (customBubbles dynamiques) | runtime | runtime | Pool 50% injecté par `askClaude` (`app.js:1101-1107`) |
| ✅ `repas` | 5 | 5 | **AJOUTÉ 2026-05-01** — Priorité 2b dans `updBubbleNow()` : pool `src.repas` lu depuis user_config (fallback contextuel label/icon si absent). Couvre fenêtre repas ouverte non prise (Cas A) et anticipation 30 min avant (Cas B). |
| ✅ `retour` | 5 | 5 | **AJOUTÉ 2026-05-01** — `bootstrap()` : `flashBubble` à 3.5s si `(Date.now() - D.lastActive) > 86400000` (>24h). Conditionné à pool non vide. Ne se déclenche qu'une fois à l'ouverture. |
| ✅ `pluie` | 5 | 5 | **AJOUTÉ 2026-05-01** — Priorité 4 dans `updBubbleNow()` : `meteoData.weathercode ∈ [61,62,63,65,66,67,80,81,82]` (poids 1, symétrique à `vent/chaud/froid`). |
| ✅ `bain` | 5 | 5 | **AJOUTÉ 2026-05-01** — Priorité 1b dans `updBubbleNow()` : pool `src.bain` lu depuis user_config (fallback pool en dur si absent). Seuil `salete >= 7`, diurne uniquement. |
| ✅ `cycle_regles` | 5 | 5 | **AJOUTÉ 2026-05-01** — Double déclenchement : (1) Priorité 4 `updBubbleNow()` si phase menstruelle (poids 2) ; (2) `bootstrap()` : `flashBubble` à 5s si phase menstruelle. Conditionné à `ui.showCycleFeature`. |

---

## Dette voix & personnalité (triée par criticité)

| Priorité | Système | Problème | Fichier / ligne |
|---|---|---|---|
| ✅ ~~🔴 P0~~ | Prompt `askClaude.withGift` | ~~Variable `{{existingNames}}` jamais remplacée~~ **CORRIGÉ 2026-05-01** — `{{existingNames}}` renommé en `{{nomsExistants}}` dans `ai_contexts.json:5` pour matcher la variable injectée par `ui-ai.js:226` | `prompts/ai_contexts.json:5` |
| ✅ ~~🔴 P0~~ | Personnalité multi-utilisateur | ~~Aucun mécanisme ne distingue le ton d'Émilie de celui d'Alexia côté API au-delà du champ `style` libre~~ **CORRIGÉ 2026-05-01** — `toneProfile` ajouté dans les deux user_config. `buildToneBlock()` sérialise registresPrefs/Interdits + modulations par état. `{{toneBlock}}` injecté dans `askClaude.base` après `{{traits}}`. | `js/ui-ai.js`, `data/user_config.json:27-42`, `data/user_config.ALEXIA.json:27-42`, `prompts/ai_contexts.json:3` |
| ✅ ~~🟠 P1~~ | `askClaude.base` | ~~`{{notesRecentes}}` est injectée mais aucune météo, RDV ou phase de cycle~~ **CORRIGÉ 2026-05-01** — `{{contextSensoriel}}` ajouté dans le template et construit dans `ui-ai.js` (météo, pluie, vent, crottes, cycle, RDV) — rendu vide si rien à signaler, zéro régression | `prompts/ai_contexts.json:3`, `js/ui-ai.js:201-255` |
| 🟠 P1 | Cohérence bulles ↔ API | Les bulles utilisent `{{diminutif}}` (résolu dans `app.js:1129`) mais les prompts API utilisent `{{userName}}` ou `diminutif` (`ui-ai.js:214`). Deux variables coexistent pour la même intention, risque de drift | `js/app.js:1129` ↔ `js/ui-ai.js:213-214` |
| ✅ ~~🟠 P1~~ | Catégorie `journal` câblée | **CORRIGÉ 2026-05-01** — (1) `saveJ()` (`ui-journal.js:146`) : écriture directe `el.textContent` remplacée par `flashBubble(bulle, 3000)` → animation + timer correctement déclenchés. (2) `unlockJ()` (`ui-journal.js:73`) : `setTimeout(..., 400)` ajouté pour déclencher une bulle du pool `journal` à chaque ouverture de la vue (avec ou sans PIN). | `js/ui-journal.js:73`, `js/ui-journal.js:146` |
| ✅ ~~🟠 P1~~ | Catégorie `cadeau` câblée | **CORRIGÉ 2026-05-01** — `askClaude()` (`ui-ai.js:356`) : pool en dur remplacé par `window.PERSONALITY.bulles.cadeau` avec fallback sur les 4 bulles neutres si le champ est absent. `.replace('{{diminutif}}', ...)` ajouté au passage. | `js/ui-ai.js:356` |
| ✅ ~~🟡 P2~~ | `getRegistre()` | ~~Ne mixe jamais 2 registres ; pas de blacklist du dernier registre tiré~~ **CORRIGÉ 2026-05-01** — Blacklist du dernier registre (`_dernierRegistre`), filtrage par `traits` (registres conditionnels pour `pince-sans-rire` / `absurde` / `créatif`), 2 nouveaux registres universels, `non-sequitur poétique` exclu si `pince-sans-rire`. Signature étendue : `getRegistre(energy, happiness, traits = [])` | `js/ui-ai.js:102-185` |
| 🟡 P2 | Bulle nuit fallback | `app.js:1056` redéfinit un pool nuit en dur si `src.nuit` est absent — duplique l'info avec `MSG.nuit` (`app.js:160-167`) | `js/app.js:1054-1066` |
| ✅ ~~🟡 P2~~ | Anti-répétition API | ~~Aucune mémoire des N derniers fragments envoyés à Claude~~ **CORRIGÉ 2026-05-01** — `{{fragmentsEvites}}` ajouté dans `askClaude.base` (fin de l'Action 2) + construit dans `vars` depuis `D.g.customBubbles.slice(0,6)`. L'IA reçoit les 6 derniers fragments et ne doit ni les reproduire ni les paraphraser. | `prompts/ai_contexts.json:3`, `js/ui-ai.js:vars` |
| 🟢 P3 | `MSG` (`app.js:160-167`) | Fallback obsolète depuis suppression de `personality.json` — il ne sera plus jamais atteint si `USER_CONFIG.personality` est présent | `js/app.js:155-167` |
| ✅ ~~🟢 P3~~ | `genBilanSemaine` | ~~`{{traits}}`, `{{style}}` non injectés~~  **CORRIGÉ 2026-05-01** — `{{style}}` + `Traits : {{traits}}.` ajoutés dans `ai_contexts.json:13` + `.replace()` correspondants dans `ui-ai.js:909-910` | `prompts/ai_contexts.json:13`, `js/ui-ai.js:909` |

---

## Section 2 — Qualité des templates

### 2a — `askClaude.base` + `withGift` / `withoutGift`

**Constats :**
- `{{nameGotchi}}`, `{{userName}}`, `{{style}}`, `{{traits}}`, `{{energy}}`, `{{happiness}}` : OK, toutes peuplées (`ui-ai.js:212-219`).
- `{{notesRecentes}}` : OK, calcul fenêtre glissante 24h propre (`ui-ai.js:204-209`).
- `{{registre}}` : OK mais voir §3a (variété limitée).
- `{{exemples}}` : OK (`getExemples` ligne 145).
- ✅ **`{{existingNames}}` (dans `withGift`)** : **CORRIGÉ 2026-05-01** — renommé en `{{nomsExistants}}` dans `ai_contexts.json:5` pour s'aligner sur la variable injectée côté JS.
- `{{timestamp}}` : utilisée seulement dans le JSON de sortie pour générer un `id`, OK.

### 2b — `genSoutien`

- Toutes les variables sont peuplées correctement (`ui-ai.js:635-650`).
- Le prompt interdit explicitement le jugement et impose UNE seule question : excellent.
- ✅ **CORRIGÉ 2026-05-01** — `Traits : {{traits}}.` ajouté dans le template `ai_contexts.json:12`. Le `.replace()` existait déjà côté JS (`ui-ai.js:642`) — c'était le template qui ne l'utilisait pas.

### 2c — `genBilanSemaine`

- ✅ **CORRIGÉ 2026-05-01** — `{{style}}` + `Traits : {{traits}}.` ajoutés dans le template `ai_contexts.json:13` et les `.replace()` correspondants dans `ui-ai.js:909-910`. Le bilan hebdomadaire connaît maintenant la personnalité de l'utilisatrice.

### 2d — `buyProp`

Très propre, contrôles explicites avant réponse, instructions de format strict. RAS sur la structure. Ne contient volontairement aucune référence personnalité (objet ≠ voix), c'est cohérent.

### 2d bis — Données disponibles non injectées

| Donnée | Présente dans | Utilisée dans prompts ? |
|---|---|---|
| `meteoData.temperature` / `windspeed` / `weathercode` | `app.js` (global) | ✅ **ajouté dans `askClaude` via `{{contextSensoriel}}` (2026-05-01)** — `genSoutien` non modifié (météo pas encore dans son contexte, à faire si besoin) |
| `D.g.solarPhases` | `D.g` | ❌ jamais |
| `D.g.salete` | `D.g` | ❌ jamais — pourrait moduler le ton |
| `D.g.poops.length` | `D.g` | ✅ **ajouté dans `askClaude` via `{{contextSensoriel}}` (2026-05-01)** |
| `D.g.stage` (egg/baby/teen/adult) | `D.g` | ✅ uniquement `genBilanSemaine` |
| `getCyclePhase()` | global | ✅ `genSoutien` + **`askClaude` via `{{contextSensoriel}}` (2026-05-01)** |
| `D.rdv` | `D.g` | ✅ `genSoutien` + **`askClaude` via `{{contextSensoriel}}` (2026-05-01)** |

---

## Section 3 — Variété & anti-répétition

### 3a — Prompts API

- ✅ `askClaude.base` interdit explicitement « JAMAIS deux pensées avec la même structure » et « JAMAIS deux fragments avec le même verbe ou la même structure ».
- ✅ `{{exemples}}` injecte 4 notes journal + 2 bulles passées → bon ancrage stylistique.
- 🟠 `{{registre}}` ne tire qu'**un seul** registre par appel — pas de combinaison. Le pool de registres pertinents pour `energy=3, happiness=3` (cas le plus fréquent) tombe à 3 entrées seulement (les 3 universels en bas de `getRegistre`).
- 🟠 Aucune mémoire inter-appels : Claude ne sait pas ce qu'il a écrit hier.

**Proposition mécanisme anti-répétition** (`js/ui-ai.js`, à ajouter dans `vars` autour de la ligne 224) :

```js
// Mémorise les 6 derniers fragments envoyés
const dernieresPensees = (D.g.customBubbles || []).slice(0, 6).join(' / ');
// puis dans vars :
fragmentsEvites: dernieresPensees || 'aucun',
```

Et dans `prompts/ai_contexts.json:3` (fin de `askClaude.base`), ajouter :

```text
… Fragments récents à NE PAS reproduire ni paraphraser : {{fragmentsEvites}}.
```

### 3b — Bulles statiques

Couverture par catégorie (Émilie / Alexia) — toutes ≥ 5 variantes. Aucun risque de répétition immédiate.

✅ Anti-répétition runtime : `app.js:1119-1123` filtre la dernière bulle affichée. Mécanisme correct mais ne mémorise qu'**une** bulle. Sur petits pools (5 entrées de `vent`), reste suffisant.

### 3c — Propositions

**Nouveaux registres pour `getRegistre()`** (à ajouter dans la liste universelle, `js/ui-ai.js:133-137`) :

```js
"micro-confidence chuchotée comme un secret",
"observation factuelle déguisée en haïku raté",
"interjection courte suivie d'un silence (3 points)",
"souvenir inventé d'un instant qui n'a pas eu lieu",
```

**Registres conditionnels au profil de personnalité** (Section 4) :

```js
// Injecté seulement si traits inclut "pince-sans-rire"
"comparaison administrative douce (ex : tu es à jour sur tes vibes)",
// Injecté seulement si traits inclut "absurde"
"non-sequitur botanique légèrement vexant",
```

---

## Section 4 — Architecture ton dynamique

### 4a — État actuel

**Ce qui module déjà le ton :**
- `getRegistre(energy, happiness)` (`ui-ai.js:105`) → 1 registre tiré au hasard parmi des pools conditionnels
- `{{style}}` et `{{traits}}` injectés depuis `USER_CONFIG.personality` (`ui-ai.js:216-217`)
- `{{notesRecentes}}` (24h glissantes)
- `{{cycleInfo}}` et `{{rdvAujourdhui}}` (uniquement `genSoutien`)

**Défini mais pas connecté aux prompts API :**
- `personality.bulles.*` → uniquement consommé par `updBubbleNow()` ; aucune injection des **bulles** comme exemples de ton dans les prompts API (`getExemples` n'en prend que 2 : `idle` et `triste`)
- Toutes les phases de cycle, RDV → ignorées par `askClaude`

**Disponible côté `window.D` mais jamais exploité par les prompts :**
- `meteoData.*`, `D.g.solarPhases`, `D.g.salete`, `D.g.poops`, `D.g.stage`, série de jours actifs (calculable via `D.log`)

### 4b — Architecture cible proposée

**Principe :** introduire un objet `toneProfile` dans `user_config.personality`, sélectionné côté JS au moment de l'appel, sérialisé en bloc texte injecté via une nouvelle variable `{{toneBlock}}`.

**Structure proposée dans `data/user_config.json`** (à ajouter dans `personality`, autour de la ligne 27) :

```jsonc
"toneProfile": {
  "registresPrefs": ["poétique", "tendre", "absurde doux"],
  "registresInterdits": ["sarcastique", "moralisateur"],
  "marqueurs": {
    "ouverture": "*…* en début de phrase autorisé",
    "ponctuation": "✿ 🌸 💜 autorisés, jamais !!",
    "longueur": "court — 8 mots max par fragment"
  },
  "modulationsParEtat": {
    "fatigue": "phrases plus courtes, onomatopées plus douces (*bâille*)",
    "fierte":  "exclamations autorisées sans excès",
    "triste":  "uniquement présence, jamais de question"
  }
}
```

**Sélection au moment de l'appel** (à ajouter dans `js/ui-ai.js`, juste avant `vars` ligne 211) :

```js
function buildToneBlock(P, state) {
  const tp = P?.toneProfile;
  if (!tp) return '';
  const lignes = [];
  if (tp.registresPrefs?.length)   lignes.push(`Registres préférés : ${tp.registresPrefs.join(', ')}.`);
  if (tp.registresInterdits?.length) lignes.push(`Registres interdits : ${tp.registresInterdits.join(', ')}.`);
  if (tp.marqueurs?.longueur)      lignes.push(`Longueur : ${tp.marqueurs.longueur}.`);
  // Modulations contextuelles
  const mod = tp.modulationsParEtat || {};
  if (state.energy <= 1 && mod.fatigue) lignes.push(`Modulation : ${mod.fatigue}`);
  if (state.happiness <= 1 && mod.triste) lignes.push(`Modulation : ${mod.triste}`);
  return lignes.join('\n');
}
```

**Injection dans le template** (`prompts/ai_contexts.json:3`, ligne `Tu es {{nameGotchi}}…`) :

```text
Tu es {{nameGotchi}}, compagnon numérique de {{userName}}.
{{style}}
Traits : {{traits}}.
{{toneBlock}}
Énergie {{energy}}/5, Humeur {{happiness}}/5.
…
```

**Compatibilité :** `{{toneBlock}}` rendu vide si absent → migration zéro-régression. Rétrocompatible avec `user_config.json` qui n'a pas encore le champ.

### 4c — Exemple concret : `askClaude.base`

**Template actuel** (`prompts/ai_contexts.json:3`, extrait) :

```text
Tu es {{nameGotchi}}, compagnon numérique de {{userName}}.
{{style}}
Traits : {{traits}}.
Énergie {{energy}}/5, Humeur {{happiness}}/5.
{{notesRecentes}}

Action 1 : Une pensée complice pour {{userName}} (2 phrases max).
Registre imposé pour cette pensée : {{registre}}.
…
```

**Template amélioré** :

```text
Tu es {{nameGotchi}}, compagnon numérique de {{userName}}.
{{style}}
Traits : {{traits}}.
{{toneBlock}}
Énergie {{energy}}/5, Humeur {{happiness}}/5.
Contexte du jour : {{contextSensoriel}}
{{notesRecentes}}
Fragments récents à éviter : {{fragmentsEvites}}.

Action 1 : Une pensée complice pour {{userName}} (2 phrases max).
Registre imposé : {{registre}}.
…
```

**Variables à construire dans `js/ui-ai.js`** (autour de la ligne 211) :

```js
// Météo + heure résumées en une ligne sensorielle
const m = window.meteoData || {};
const partsCtx = [];
if (m.temperature !== undefined) partsCtx.push(`${Math.round(m.temperature)}°C`);
if (m.windspeed > 40)            partsCtx.push('vent fort');
if (D.g.poops?.length)           partsCtx.push(`${D.g.poops.length} crotte${D.g.poops.length>1?'s':''} au sol`);
const contextSensoriel = partsCtx.join(', ') || 'rien à signaler';

// Bloc ton dynamique
const toneBlock = buildToneBlock(P, { energy: g.energy, happiness: g.happiness });

// Anti-répétition (cf. §3a)
const fragmentsEvites = (D.g.customBubbles || []).slice(0, 6).join(' / ') || 'aucun';
```

À ajouter ensuite dans l'objet `vars` lignes 211-231.

---

## Section 5 — Bulles statiques

### 5a — Couverture des états

Les états du Gotchi proviennent de :
- `D.g.stage` : `egg`, `baby`, `teen`, `adult` (`app.js:142-151`)
- `D.g.energy` (0–5), `D.g.happiness` (0–5) avec seuils `EN_CRIT/WARN/TILT` et `HA_SAD/MED/...` (`config.js:221-234`)
- `D.g.poops`, `D.g.salete`, mood journal, météo

| État / déclencheur | Bulle dédiée ? | Remarque |
|---|---|---|
| Œuf (avant éclosion) | ❌ | Pas de pool `egg` — silence d'un Gotchi qui ne parle pas encore : intentionnel ou oubli ? |
| Bébé / Ado / Adulte | ❌ | Aucune modulation par stade dans `updBubbleNow()` |
| `salete >= 5` (sale) | ✅ **CORRIGÉ 2026-05-01** | Pool `bain` ajouté dans user_config + lu depuis Priorité 1b (`salete >= 7`, fallback pool en dur) |
| `poops >= 1` (mais < 3) | ❌ | Le pool "porcherie" ne se déclenche qu'à `>= 3` (`app.js:1041`) |
| Snack mangé | partiellement | `flashBubble` ad hoc dans `app.js:646-649`, pas de pool dans `personality.bulles` |
| Repas manqué (fenêtre passée) | ✅ **CORRIGÉ 2026-05-01** | Pool `repas` ajouté dans user_config + lu depuis Priorité 2b (remplace les bulles en dur, fallback contextuel conservé) |
| Habitude cochée (réussite isolée) | partiellement | `app.js:811` `flashBubble(reaction.msg)` — `reaction` hardcodée hors `personality.bulles` |
| Retour après absence (`lastActive` ancien) | ✅ **CORRIGÉ 2026-05-01** | Pool `retour` ajouté dans user_config + déclenché dans `bootstrap()` à 3.5s si absence > 24h |
| Pluie / Beau temps stable | ✅ **CORRIGÉ 2026-05-01** | Pool `pluie` ajouté dans user_config + déclenché dans Priorité 4 si `weathercode ∈ [61–67, 80–82]` |
| Phase cycle (règles, ovulation) | ✅ **CORRIGÉ 2026-05-01** | Pool `cycle_regles` ajouté dans user_config + déclenché dans Priorité 4 (poids 2) ET au boot à 5s si phase menstruelle |
| Niveau XP atteint / changement de stade | partiellement | Hardcodé dans `app.js:456` (`stageMsgs`) |
| Pool `journal` | défini, **non câblé** | 6 bulles mortes par profil |
| Pool `cadeau` | défini, **non câblé** par `updBubbleNow` | Lu uniquement par `askClaude` qui réécrit son propre pool |

### 5b — Cohérence ton / personnalité

- ✅ Profil **Émilie** : bulles cohérentes avec traits "curieux, doux, absurde, créatif, rigolo" — onomatopées, ponctuation `✿ 🌸 💜`, jamais de !!.
- ✅ Profil **Alexia** : bulles cohérentes avec traits "direct, attachant, pince-sans-rire" — vocabulaire jeu vidéo (`*level up*`, `*boot en cours*`, `*calibration*`, `Iris`), métaphores comptables (`Bilan : excellent`, `Solde positif`).
- 🟠 Risque léger : la bulle Émilie `*câlin pixel tout doux* 💜` (`triste`) pourrait être dissonante chez Alexia si la répartition n'était pas séparée — la séparation par fichier `user_config.*` règle bien ce point.
- 🟢 Aucune bulle ne casse la personnalité (pas de moralisation, pas de conseil).

### 5c — Propositions de contenu

**Nouvelle catégorie `repas` (Émilie)** — 5 variantes proposées dans le ton existant (à ajouter dans `data/user_config.json` sous `bulles`, après `cadeau` autour de la ligne 161) :

```json
"repas": [
  "Miam ?? 🌸",
  "*renifle* sent bon ✿",
  "On grignote ensemble 💜",
  "*tend une assiette pixel*",
  "Une bouchée pour {{diminutif}} ✿"
]
```

**Même catégorie pour Alexia** (à ajouter dans `data/user_config.ALEXIA.json` même endroit) :

```json
"repas": [
  "Inventaire stomacal : 0 😋",
  "*regarde l'assiette* validé",
  "Iris veut goûter aussi 🐱",
  "Carburant niveau bas ✿",
  "Pause ravito méritée 💜"
]
```

**Catégorie `retour` (après > 24h d'absence)** — Émilie :

```json
"retour": [
  "*revient en sautillant* 🌸",
  "Tu m'as manquée {{diminutif}} 💜",
  "*sort de sa cachette* ✿",
  "On reprend doucement 🌸",
  "Pas grave d'être partie ✿"
]
```

**Catégorie `pluie`** (déclencher si `meteoData.weathercode` ∈ pluie) — Émilie :

```json
"pluie": [
  "*écoute la pluie* 🌧️",
  "Plic ploc plic ✿",
  "Café et pluie 💜",
  "*colle le nez à la fenêtre*",
  "Le ciel pleure un peu 🌸"
]
```

**Reformulation suggérée** — la bulle `journal` `"Les mots libèrent {{diminutif}} ✿"` est un poil moralisatrice / coach. Proposer :

```
"*lit par-dessus ton épaule* ✿"
```
plus dans l'observation discrète, conforme au style "jamais d'injonction".

**Nouvelles catégories à créer (5 manquantes prioritaires) :**

1. `repas` — déclenchée à la fenêtre repas non encore consommée
2. `retour` — déclenchée si `(Date.now() - D.lastActive) > 24h`
3. `pluie` — analogue de `vent / chaud / froid`
4. `bain` — déclenchée si `salete >= 5`
5. `cycle_regles` — déclenchée pendant phase menstruelle (déjà calculée par `getCyclePhase`)

---

## Section 6 — user_config & personnalisation

### 6a — Diagnostic de l'existant

**Champs liés à la personnalité dans `data/user_config.json`** :

```jsonc
// data/user_config.json:24-28
"personality": {
  "source": "config",
  "traits":  [ … ],
  "style":   "…",
  "bulles":  { … }
}
// data/user_config.json:184-187
"ai": {
  "systemPromptOverride": null,
  "contexteOverride": null
}
```

**Chargement** : `js/app.js:109-117` reconstitue `window.PERSONALITY = { nom, traits, style, bulles }`.

**Champs effectivement injectés** :

| Champ user_config | Injection prompt API ? | Bulles statiques ? |
|---|---|---|
| `identity.gotchiName` | ✅ via `D.g.name` (toutes fonctions) | ✅ |
| `identity.userName` | ✅ (toutes) | ❌ (utilise `{{diminutif}}`) |
| `identity.userNickname` | ❌ — utilisé uniquement comme `{{diminutif}}` dans bulles statiques | ✅ |
| `personality.style` | ✅ `askClaude`, `genSoutien`, `soutien` (system) | implicite (style des bulles écrites) |
| `personality.traits` | ✅ `askClaude`, `soutien` (system). ❌ `genSoutien` initial, ❌ `genBilanSemaine` | implicite |
| `personality.bulles` | ❌ (sauf 2 entrées via `getExemples`) | ✅ |
| `meteo.lat/lon/city` | ❌ ville pas injectée dans prompts | indirect (via `meteoData`) |
| `birthday.*` | ❌ jamais dans prompts | ❌ |
| `ui.showCycleFeature` / `showRDVFeature` | ✅ filtre l'affichage | ✅ filtre `getCyclePhase` |
| `ai.systemPromptOverride` | ✅ **ACTIVÉ 2026-05-01** — lu dans `sendSoutienMsg()` : `USER_CONFIG.ai.systemPromptOverride \|\| AI_SYSTEM.soutien` | — |
| `ai.contexteOverride` | ✅ **ACTIVÉ 2026-05-01** — lu dans `sendSoutienMsg()` : `USER_CONFIG.ai.contexteOverride \|\| AI_SYSTEM.soutien_contexte` | — |

### 6b — Lacunes

1. **`ai.systemPromptOverride` / `ai.contexteOverride` : champs morts.** Promesse non tenue de personnalisation profonde par utilisateur. À implémenter ou supprimer.
2. **`personality.traits` non injectés dans `genBilanSemaine` ni `genSoutien` initial** → un autre utilisateur ne peut pas avoir un *bilan* qui sonne différemment.
3. **Aucun champ `toneProfile`** (cf. §4) → impossible d'aller au-delà du `style` libre pour discriminer Émilie vs Alexia côté API.
4. **`identity.userName` vs `D.g.userName`** : `D.g.userName` est forcé depuis `USER_CONFIG.identity.userName` à chaque démarrage (`app.js:1271`), donc OK, mais le defs() (`app.js:179`) garde `'Émilie'` en dur — fragile pour un fork "vierge".
5. **Pas de champ `meteo.cityDisplay` ni `personality.lieu`** : la bulle Alexia `"Bourg-en-Bresse en mode chaos 🌬️"` est codée en dur dans le pool `vent` au lieu d'être paramétrée par `meteo.city`.

### 6c — Propositions

**Nouveaux champs dans `data/user_config.json`** (sous `personality`) :

```jsonc
"personality": {
  "source": "config",
  "traits":  [ … ],
  "style":   "…",
  "lieu":    "{{meteo.city}}",
  "toneProfile": { /* cf. §4b */ },
  "bulles":  { … }
}
```

**Activer enfin `ai.systemPromptOverride`** (ajout `js/ui-ai.js`, ligne 766 dans `sysPrompt`) :

```js
// js/ui-ai.js:766 — autour de la construction de sysPrompt
const baseSys = window.USER_CONFIG?.ai?.systemPromptOverride
  ?? window.AI_SYSTEM?.soutien
  ?? '';
const sysPrompt = baseSys
  .replace('{{nameGotchi}}', …)
  …
```

**Injecter `traits` dans `genBilanSemaine`** :

```js
// js/ui-ai.js:907 — chaîne de .replace de genBilanSemaine
.replace('{{style}}',  P?.style  || '')
.replace('{{traits}}', P?.traits?.join(', ') || '')
```

avec un ajustement du template (`prompts/ai_contexts.json:13`).

**Construire `toneBlock`** : voir §4b — fonction `buildToneBlock()` à ajouter dans `js/ui-ai.js` (entre lignes 159 et 161, juste avant `askClaude`).

**Lignes exactes à modifier (récapitulatif) :**

| Fichier | Ligne(s) | Action |
|---|---|---|
| `prompts/ai_contexts.json` | 3 | Ajouter `{{toneBlock}}`, `{{contextSensoriel}}`, `{{fragmentsEvites}}` |
| `prompts/ai_contexts.json` | 5 | Renommer `{{existingNames}}` → `{{nomsExistants}}` |
| `prompts/ai_contexts.json` | 12 | Ajouter ligne `Traits : {{traits}}.` |
| `prompts/ai_contexts.json` | 13 | Ajouter `{{style}}` + `Traits : {{traits}}.` après ligne 1 |
| `js/ui-ai.js` | 159–161 | Insérer `function buildToneBlock(...)` |
| `js/ui-ai.js` | 211–231 | Étendre `vars` (toneBlock, contextSensoriel, fragmentsEvites) |
| `js/ui-ai.js` | 639–650 | Ajouter `.replace('{{traits}}', …)` dans `genSoutien` |
| `js/ui-ai.js` | 766–772 | Lire `USER_CONFIG.ai.systemPromptOverride` en priorité |
| `js/ui-ai.js` | 907–919 | Ajouter `.replace('{{style}}', …)` et `{{traits}}` dans `genBilanSemaine` |
| `js/app.js` | 1099 (après) | Brancher pools `repas`, `retour`, `pluie`, `bain`, `cycle_regles` (cf. §5) |
| `data/user_config.json` | 27 | Ajouter `"toneProfile": { … }` et nouvelles catégories de bulles |
| `data/user_config.ALEXIA.json` | 27 | Idem profil Alexia |

---

## Section 7 — Cohérence globale

### 7a — Audit transversal

- ✅ Le nom du Gotchi (`{{nameGotchi}}` ↔ `D.g.name`) est cohérent partout.
- 🟠 `{{userName}}` (API) vs `{{diminutif}}` (bulles) : deux conventions pour désigner l'utilisatrice. Le surnom `mimi` n'est jamais utilisé en API → l'IA dit "Émilie" alors que les bulles disent "mimi" → léger flottement de proximité.
- ✅ Style des bulles statiques très cohérent avec ce que les prompts demandent (`Phrases courtes, onomatopées entre astérisques`).
- 🟠 Décalage de registre entre `getRegistre()` (qui suggère des registres parfois excentriques comme "non-sequitur poétique totalement inattendu") et le `style` Alexia (`pince-sans-rire, jamais cucul`). Sur 2 appels sur 5, le ton API d'Alexia risque de sonner faux.

### 7b — Évaluation TDAH

- ✅ Bulles statiques : 3-7 mots, lecture immédiate. Parfait sur mobile.
- 🟢 Réponses API `askClaude` : 2 phrases + 3-5 fragments courts, OK.
- 🟠 `genSoutien` : pas de contrainte de longueur explicite ("Phrases courtes" mais sans plafond chiffré) → risque de pavé sur mobile. Ajouter `Maximum 50 mots, 3 phrases.` dans `prompts/ai_contexts.json:12`.
- 🟠 `genBilanSemaine` : 3 paragraphes — long mais accepté par l'usage (lu une fois par semaine au calme).
- ✅ Validation d'habitude (`flashBubble` `app.js:811`) : immédiate, chaleureuse.
- 🟠 Streaks / séries de jours actifs : aucune bulle ni prompt n'y fait référence. Manque émotionnel.

### 7c — Charte de voix du Gotchi

```text
CHARTE DE VOIX — Le Gotchi (HabitGotchi v4.81)

REGISTRE DE BASE
- Compagnon présent, jamais coach. Témoin, jamais juge.
- Phrases courtes (3-8 mots pour les bulles, 2 phrases max pour les pensées API).
- Onomatopées entre astérisques (*bâille*, *s'étire*, *renifle*) en marqueur signature.

CE QUE LE GOTCHI DIT
- "Je te vois", "On reste là", "Pas de pression", "Je suis là de toute façon".
- Observe le détail (le corps, la lumière, un mot du journal) plutôt que le résultat.
- Tutoie. Utilise le surnom (`{{diminutif}}`) plus souvent que le prénom complet.

CE QU'IL NE DIT JAMAIS
- "Tu devrais", "Il faut", "Allez courage", "Demain sera meilleur".
- Pas de question directe non sollicitée (sauf dans `genSoutien`, et UNE seule).
- Pas de conseil. Pas de moralisation. Pas de "!!" (sauf moments `fierte` / `max`).
- Pas de chiffres ni de scoring (sauf bilan IA explicitement demandé).

ÉVOLUTION SELON L'ÉTAT
- energy ≤ 1   → mots plus lents, onomatopées plus douces (*bâille*, *soupir*).
- happiness ≤ 1 → présence pure, jamais de question, contact (*s'assoit tout près*).
- done = 6     → exclamations, étoiles, célébration franche mais courte.
- nuit         → silence, ronflements, pas de relance.
- crottes ≥ 3  → ton dégradé assumé, sans drama (humour grognon).

MARQUEURS STYLISTIQUES
- Ponctuation : ✿ 🌸 💜 🌟 (réservés aux moments tendres / fierté).
- Jamais "!!" sauf `fierte/max`. Préférer "." ou rien.
- Action entre astérisques en début ou fin (*ronronne*).
- Phrases incomplètes bienvenues. Trois points autorisés (...).

COHÉRENCE PERSONNALITÉ
- Le `style` et les `traits` de `user_config.personality` sont la source unique de vérité.
- Tout nouveau prompt API doit injecter `{{style}}` ET `{{traits}}` (et bientôt `{{toneBlock}}`).
- Toute nouvelle bulle doit pouvoir tenir dans le pool de l'utilisatrice cible sans réécriture.
```

---

## Prochaines étapes recommandées

1. ✅ **~~🔴 Bug fix `{{existingNames}}`~~** — **FAIT 2026-05-01.** `{{existingNames}}` → `{{nomsExistants}}` dans `prompts/ai_contexts.json:5`.
2. ✅ **~~🔴 Injecter `{{traits}}` dans `genSoutien` et `genBilanSemaine`~~** — **FAIT 2026-05-01.** Template `ai_contexts.json:12` + `13` mis à jour. `.replace()` ajoutés dans `ui-ai.js:909-910` pour `genBilanSemaine` (déjà présent ligne 642 pour `genSoutien`).
3. ✅ **~~🟠 Brancher la météo, le cycle et les RDV dans `askClaude`~~** — **FAIT 2026-05-01.** `{{contextSensoriel}}` ajouté dans `ai_contexts.json:3` (template `askClaude.base`) + construit dans `ui-ai.js` (météo temp/vent/pluie, crottes, cycle, RDV). Rendu vide si rien à signaler — rétrocompatible.
4. ✅ **~~🟠 Activer `ai.systemPromptOverride`~~** — **FAIT 2026-05-01.** `sourceSys` lit `USER_CONFIG.ai.systemPromptOverride` en priorité sur `AI_SYSTEM.soutien`. Idem `sourceContexte` pour `ai.contexteOverride`. Les `.replace()` et la concaténation du contexte s'appliquent dans tous les cas — zéro régression si les deux champs restent `null`.
5. ✅ **~~🟠 Câbler les bulles `journal` et `cadeau`~~** — **FAIT 2026-05-01.** Pool `journal` : `saveJ()` passe par `flashBubble()` (timer 3s) + déclencheur à l'ouverture dans `unlockJ()` (délai 400ms). Pool `cadeau` : `askClaude()` lit `PERSONALITY.bulles.cadeau` avec fallback neutre.
6. ✅ **~~🟡 Introduire `toneProfile`~~** — **FAIT 2026-05-01.** `toneProfile` ajouté dans `data/user_config.json` (profil Émilie) et `data/user_config.ALEXIA.json` (profil Alexia) sous `personality`. Fonction `buildToneBlock(P, state)` ajoutée dans `js/ui-ai.js` (juste avant `askClaude`) — sérialise registresPrefs, registresInterdits, longueur, et modulations par état (fatigue/fierte/triste). Variable `toneBlock` construite dans `vars` via `buildToneBlock(P, { energy, happiness })`. `{{toneBlock}}` injecté dans `prompts/ai_contexts.json:3` (`askClaude.base`), après `Traits : {{traits}}.`. Retourne `''` si `toneProfile` absent → zéro régression.
7. ✅ **~~🟡 Anti-répétition API~~** — **FAIT 2026-05-01.** `{{fragmentsEvites}}` injecté en fin d'Action 2 dans `askClaude.base` + construit dans `vars` (`D.g.customBubbles.slice(0,6).join(' / ')`). Fallback `'aucun'` si le tableau est vide.
8. ✅ **~~🟡 Étendre `getRegistre()`~~** — **FAIT 2026-05-01.** Filtrage par `traits`, blacklist du dernier registre, 2 nouveaux registres universels, registres conditionnels pour `pince-sans-rire` / `absurde` / `créatif`, exclusion `non-sequitur poétique` si `pince-sans-rire` actif.
9. ✅ **~~🟢 Ajouter les 5 catégories de bulles manquantes~~** — **FAIT 2026-05-01.** `repas`, `retour`, `pluie`, `bain`, `cycle_regles` ajoutés dans `data/user_config.json` et `data/user_config.ALEXIA.json`. Déclencheurs câblés dans `app.js` : `bain` (Priorité 1b → `src.bain`), `repas` (Priorité 2b → `src.repas`), `pluie` (Priorité 4, poids 1), `cycle_regles` (Priorité 4, poids 2 + boot à 5s), `retour` (boot à 3.5s si absence > 24h).
10. ✅ **~~🟢 Plafond explicite de longueur~~** — **FAIT 2026-05-01** — `Maximum 50 mots, 3 phrases.` ajouté dans `prompts/ai_contexts.json:12` (template `genSoutien`), avant `Jamais de jugement.`.

> Toutes les modifications proposées sont **additives** ou **localisées** : aucun fichier à réécrire entièrement, aucun appel API existant cassé.
