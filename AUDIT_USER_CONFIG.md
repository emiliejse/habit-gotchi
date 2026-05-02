# Audit système USER_CONFIG — HabitGotchi

> Document de référence mis à jour le **2 mai 2026** — version d'app auditée : **v5.41**.
> Refonte complète : les références à `js/ui.js` (fichier supprimé) et `data/props.json` (split en 3 fichiers) ont été corrigées.

---

## 1. Architecture actuelle

### Principe général

Chaque utilisatrice a un fichier `data/user_config.json` personnel, **non commité** (protégé par `.gitignore`).
Ce fichier est chargé au démarrage avant tout le reste, et expose `window.USER_CONFIG` à toute l'app.
Le code est identique dans les deux repos — seul `user_config.json` diffère.

### Fichiers du système USER_CONFIG

| Fichier | Statut | Rôle |
|---|---|---|
| `data/user_config.json` | ❌ non commité (.gitignore) | Config perso de chaque utilisatrice |
| `data/user_config.ALEXIA.json` | ✅ commité (283 lignes) | Template de référence pour Alexia |
| `data/props.ALEXIA.json` | ⚠️ **non trouvé dans le repo** — à vérifier (mentionné historiquement comme commité, mais introuvable au 2 mai 2026) | Catalogue d'objets exclusifs Alexia (si utilisé via `extraPropsFile`) |
| `.gitignore` | ✅ présent | Protège `user_config.json` |

### Modules de code identiques entre les deux repos

Tous les fichiers de code sont identiques et peuvent être copiés librement :

```
data/config.js
data/props_base.json
data/props_shop.json
data/props_packs.json
prompts/ai_contexts.json
prompts/ai_system.json
js/app.js
js/render.js
js/render-sprites.js
js/envs.js
js/garden.js
js/debug.js
js/ui-core.js
js/ui-habs.js
js/ui-shop.js
js/ui-ai.js
js/ui-journal.js
js/ui-settings.js
js/ui-agenda.js
js/ui-atelier.js
js/ui-game.js
js/games/ui-cristaux.js
js/ui-nav.js
sw.js
index.html
```

> ⚠️ Note 2026-05-02 : le fichier `js/ui.js` historique a été **scindé en 9 modules `ui-*.js`** lors de la session 2026-04-30. Le fichier monolithique n'existe plus. Le fichier `data/props.json` a également été **scindé en 3** (`props_base.json`, `props_shop.json`, `props_packs.json`) — le fichier monolithique n'existe plus.

### Fichiers à ne jamais écraser chez Alexia

| Fichier | Raison |
|---|---|
| `data/user_config.json` | Sa config perso — protégée par .gitignore, jamais dans le repo |
| `manifest.json` | Son nom d'app est différent |
| `README.md` | Son README perso |

---

## 2. Schéma de `user_config.json`

```json
{
  "_comment": "Fichier personnel — ne jamais commiter (protégé par .gitignore).",

  "identity": {
    "userName": "Émilie",
    "userNickname": "mimi",
    "gotchiName": "Petit·e Gotchi"
  },

  "meteo": {
    "lat": 43.6047,
    "lon": 1.4442,
    "city": "Toulouse"
  },

  "birthday": {
    "month": null,
    "day": null,
    "message": "",
    "cheatCode": "joyeuxanniversaire",
    "petalesBonus": 50
  },

  "personality": {
    "source": "config",
    "traits": [...],
    "style": "...",
    "toneProfile": {
      "registresPrefs": [...],
      "registresInterdits": [...],
      "marqueurs": { "ouverture": "...", "ponctuation": "...", "longueur": "..." },
      "modulationsParEtat": { "fatigue": "...", "fierte": "...", "triste": "..." }
    },
    "bulles": { ...22 catégories... }
  },

  "ui": {
    "appTitle": "HabitGotchi",
    "showTDAHMention": true,
    "showCycleFeature": true,
    "showRDVFeature": true
  },

  "startProps": [],
  "extraPropsFile": null,

  "ai": {
    "systemPromptOverride": null,
    "contexteOverride": null
  }
}
```

### Explication des clés

**`identity`**
- `userName` → prénom affiché dans l'UI et les prompts IA (variable `{{userName}}`)
- `userNickname` → surnom utilisé dans les bulles via `{{diminutif}}` (et désormais aussi dans les prompts IA depuis 2026-05-01)
- `gotchiName` → nom du gotchi affiché dans le HUD (variable `{{nameGotchi}}`)

**`meteo`**
- `lat` / `lon` → coordonnées GPS pour l'API météo (Open-Meteo) et les phases solaires
- `city` → nom de la ville, pour la lisibilité du fichier uniquement (jamais lu côté code)

**`birthday`**
- `month` / `day` → mois et jour (entiers). Si `null` → aucun popup, aucun badge, aucun code cheat
- `message` → texte affiché dans la modale anniversaire
- `cheatCode` → mot secret à taper dans la console de cheat (Réglages → Code spécial)
- `petalesBonus` → pétales offerts lors de l'utilisation du code cheat

**`personality`**
- `source` → toujours `"config"` désormais (`personality.json` historique supprimé, code de chargement met `Promise.resolve(null)` à sa place dans `loadDataFiles()`)
- `traits` → liste d'adjectifs injectés dans les prompts IA via `{{traits}}`
- `style` → phrase décrivant le ton d'écriture du gotchi (`{{style}}`)
- `toneProfile` → bloc structuré sérialisé par `buildToneBlock()` et injecté via `{{toneBlock}}` dans `askClaude.base` (ajouté 2026-05-01)
- `bulles` → objet avec 22 états de bulles : `matin`, `aprem`, `soir`, `soirTardif`, `nuit`, `triste`, `fatigue`, `fierte`, `max`, `idle`, `vent`, `chaud`, `froid`, `peu`, `cadeau`, `journal`, `custom`, `repas`, `retour`, `pluie`, `bain`, `cycle_regles`, plus l'objet `changeEnv` (parc/chambre/montagne/jardin)
  - `soirTardif` → bulles affichées entre 22h30 et 23h30 (Gotchi dans sa chambre, pas encore endormi). Fallback intégré dans le code si absent

**`ui`**
- `appTitle` → ⚠️ **champ jamais lu** dans le code (grep = 0). Soit à brancher (`<title>` + `<h1>`), soit à supprimer du schéma
- `showTDAHMention` → si `false`, masque les mentions TDAH (infrastructure posée via `showTDAH()` dans `ui-core.js`, mais aucun appel actif aujourd'hui)
- `showCycleFeature` → si `false`, masque l'onglet cycle de l'agenda, l'injection de phase dans les prompts IA, et la bulle `cycle_regles`
- `showRDVFeature` → si `false`, masque le post-it agenda dans le menu (combiné avec `showCycle`). Branché 2026-05-01 dans `initUI()`

**`startProps`**
- Liste d'IDs d'objets à débloquer dans `PROPS_LIB` au premier lancement (en plus des `cout: 0`)
- Réservé pour usage futur — laisser `[]`

**`extraPropsFile`**
- Chemin vers un catalogue JSON supplémentaire (ex: `"data/props.ALEXIA.json"`)
- Si `null` ou absent → ignoré
- Chez Émilie : `null`. Chez Alexia : `"data/props.ALEXIA.json"` (à confirmer — fichier introuvable dans le repo principal au 2 mai 2026)

**`ai`**
- `systemPromptOverride` → ✅ **branché 2026-05-01** : lu en priorité dans `sendSoutienMsg()` ([ui-ai.js:945](js/ui-ai.js#L945)) — fallback sur `AI_SYSTEM.soutien`
- `contexteOverride` → ✅ **branché 2026-05-01** : lu en priorité dans `sendSoutienMsg()` ([ui-ai.js:924](js/ui-ai.js#L924)) — fallback sur `AI_SYSTEM.soutien_contexte`

---

## 3. Où USER_CONFIG est branché dans le code

### `js/app.js`

| Fonction | Ligne | Ce qui est lu |
|---|---|---|
| `loadUserConfig()` | [2091](js/app.js#L2091) | Charge `data/user_config.json` → `window.USER_CONFIG` |
| `bootstrap()` | [2108](js/app.js#L2108) | `await loadUserConfig()` en tout premier (fonction async) |
| `bootstrap()` | [2114-2119](js/app.js#L2114) | Force `identity.userName/userNickname` à chaque démarrage. `gotchiName` n'écrase que si `D.g.name === 'Petit·e Gotchi'` (préserve le rename utilisateur) |
| `defs()` | [207](js/app.js#L207) | `identity.userNickname` pour initialiser au 1er lancement |
| `loadDataFiles()` | [86](js/app.js#L86) | `personality.source` → vérifie que la source est bien `"config"` |
| `loadDataFiles()` | [106-113](js/app.js#L106) | `extraPropsFile` → fetch et fusion dans `PROPS_LIB` |
| `loadDataFiles()` | [131-134](js/app.js#L131) | `personality.source/traits/style/bulles` → remplit `window.PERSONALITY` (incluant `nom` depuis `identity.gotchiName`) |
| `fetchMeteo()` | [1518-1519](js/app.js#L1518) | `meteo.lat` / `meteo.lon` avec fallback Toulouse hardcodé |
| `fetchSolarPhases()` | [1554-1555](js/app.js#L1554) | `meteo.lat` / `meteo.lon` avec fallback `D.g.lat/lng` |
| `initBaseProps()` | [1501](js/app.js#L1501) | `startProps` → débloque des objets supplémentaires (usage futur) |
| `updBubbleNow()` (cycle) | [1891](js/app.js#L1891), [2264](js/app.js#L2264) | Conditionne l'injection de la bulle `cycle_regles` à `ui.showCycleFeature` |

### `js/ui-core.js`

| Fonction | Ligne | Rôle |
|---|---|---|
| `showTDAH()` | [63](js/ui-core.js#L63) | Lit `ui.showTDAHMention !== false` |
| `showCycle()` | [71](js/ui-core.js#L71) | Lit `ui.showCycleFeature !== false` |
| `showRDV()` | [100](js/ui-core.js#L100) | Lit `ui.showRDVFeature !== false` |

### `js/ui-settings.js`

| Fonction | Ligne | Ce qui est lu |
|---|---|---|
| `checkWelcome()` | [1185](js/ui-settings.js#L1185) | `birthday.month/day/message` → modale anniversaire |
| `updUI()` | [340](js/ui-settings.js#L340) | `birthday.month/day` → badge 🎂 |
| `applyCheatCode()` | [1534-1542](js/ui-settings.js#L1534) | `birthday.cheatCode/petalesBonus` → code cheat anniversaire |
| `initUI()` | [1770-1774](js/ui-settings.js#L1770) | Masque `#btn-menu-agenda` si `!showCycle() && !showRDV()` |

### `js/ui-ai.js`

| Fonction | Ligne | Ce qui est lu |
|---|---|---|
| `askClaude()` | [300](js/ui-ai.js#L300) | Phase de cycle injectée si `showCycle()` true |
| `_genSoutienCore()` | [800](js/ui-ai.js#L800) | Idem pour le soutien |
| `genBilanSemaine()` | [915](js/ui-ai.js#L915) | Idem pour le bilan |
| `sendSoutienMsg()` | [924](js/ui-ai.js#L924) | `ai.contexteOverride` (fallback `AI_SYSTEM.soutien_contexte`) |
| `sendSoutienMsg()` | [945](js/ui-ai.js#L945) | `ai.systemPromptOverride` (fallback `AI_SYSTEM.soutien`) |

### `js/ui-agenda.js`

| Fonction | Ligne | Rôle |
|---|---|---|
| `ouvrirAgenda()` | [82, 106](js/ui-agenda.js#L82) | Affiche/masque l'onglet "cycle" selon `showCycle()` |

### `js/ui-journal.js`

| Fonction | Ligne | Rôle |
|---|---|---|
| `unlockJ()` / `saveJ()` | [87, 164](js/ui-journal.js#L87) | Lit `userNickname` pour `{{diminutif}}` dans les bulles `journal` |

### `index.html`

| Élément | Ligne | Rôle |
|---|---|---|
| `#birthday-badge` | [136](index.html#L136) | Badge 🎂 affiché le jour de l'anniversaire (visibilité gérée par `updUI`) |
| `#btn-menu-agenda` | [582-585](index.html#L582) | Bouton masqué dynamiquement par `initUI()` selon `showCycle()` + `showRDV()` |

> Note 2026-05-02 : il n'y a **plus aucun bloc `<script>` inline** dans `index.html` pour appliquer les conditions USER_CONFIG. Toute la logique de masquage est centralisée dans `initUI()` (`ui-settings.js`).

---

## 4. État des marqueurs `// 🌸 ALEXIA`

🆕 **Tous les marqueurs `// 🌸 ALEXIA` ont disparu du code** (grep = 0 résultat au 2 mai 2026). La distinction entre les deux profils repose désormais **exclusivement** sur les valeurs de `data/user_config.json`.

→ La convention "blocs `// 🌸 ALEXIA` à synchroniser" mentionnée dans le skill `habitgotchi-dev.skill` et dans le prompt initial est **obsolète** et doit être retirée.

---

## 5. Ce qui n'est PAS encore branché

| Clé | Statut | Notes |
|---|---|---|
| `ui.appTitle` | ❌ Jamais lue | Champ mort. Soit le brancher (`<title>` + `<h1>`), soit le supprimer du schéma |
| `ui.showTDAHMention` | ⏸️ Fonction posée, rien à conditionner | Infrastructure prête, aucun appel actif dans le code |
| `startProps` | ⏸️ Code présent, non utilisé | Usage futur |

---

## 6. Logique de priorité LocalStorage vs `user_config.json`

✅ **Implémentée** dans `bootstrap()` à [app.js:2114-2119](js/app.js#L2114) :

| Champ | Comportement au démarrage |
|---|---|
| `gotchiName` | Écrase `D.g.name` **uniquement si** la valeur actuelle est encore `'Petit·e Gotchi'` (= jamais personnalisé). Préserve le rename utilisateur. ✅ |
| `userName` | Écrase **toujours** `D.g.userName`. ⚠️ Si l'utilisatrice change son nom dans Réglages, il sera réinitialisé au reload. À confirmer si intentionnel. |
| `userNickname` | Écrase **toujours** `D.g.userNickname`. ⚠️ Même dette que `userName`. |

→ **Décision à prendre** : ces deux écrasements sont-ils intentionnels (la config est la source de vérité, l'UI Réglages devient cosmétique pour ces champs) ou s'agit-il d'un bug à corriger en alignant le comportement sur `gotchiName` ?

---

## 7. Protocole de mise à jour du repo d'Alexia

### Ce qu'Émilie envoie à Alexia

Copier ces fichiers depuis `habit-gotchi` vers `habit-gotchi-alexia` :

```
js/app.js
js/render.js
js/render-sprites.js
js/envs.js
js/garden.js
js/debug.js
js/ui-core.js
js/ui-habs.js
js/ui-shop.js
js/ui-ai.js
js/ui-journal.js
js/ui-settings.js
js/ui-agenda.js
js/ui-atelier.js
js/ui-game.js
js/games/ui-cristaux.js
js/ui-nav.js
data/config.js
data/props_base.json
data/props_shop.json
data/props_packs.json
data/props.ALEXIA.json   ← si utilisé via extraPropsFile (à confirmer)
prompts/ai_contexts.json
prompts/ai_system.json
sw.js
index.html
```

### Ce qu'Alexia installe une seule fois

Copier `data/user_config.ALEXIA.json` → renommer en `data/user_config.json` dans son dossier.
Ne jamais le commiter (il sera ignoré par `.gitignore`).

### Ce qu'Alexia ne touche jamais

```
data/user_config.json    ← sa config perso, jamais écrasée
manifest.json             ← son nom d'app est différent
README.md                 ← son README perso
```

---

## 8. Sessions réalisées

- [x] **Session A** — `user_config.json` créé + `.gitignore`
- [x] **Session B** — Surnom `mimi` branché, infrastructure personnalité
- [x] **Session C** — Utilitaires `showTDAH()` / `showCycle()` / `showRDV()` posés dans `ui-core.js`
- [x] **Session D** — Feature cycle conditionnelle (onglet, bouton menu, prompts IA)
- [x] **Session E** — Anniversaire externalisé (badge, modale, code cheat)
- [x] **Session F** — Template `user_config.ALEXIA.json` créé avec personnalité intégrée
- [x] **Session G** — Page Notion ALEXIA_DIFF mise à jour
- [x] **Session H** — `personality.json` supprimé, personnalité migrée dans `user_config.json`
- [x] **Session I** — `extraPropsFile` branché dans `loadDataFiles()`
- [x] **Session J (2026-05-01)** — `toneProfile` ajouté dans les deux user_config + `buildToneBlock()` injecté dans `askClaude.base`
- [x] **Session K (2026-05-01)** — `ai.systemPromptOverride` et `ai.contexteOverride` activés dans `sendSoutienMsg()`
- [x] **Session L (2026-05-01)** — 5 nouvelles catégories de bulles ajoutées (`repas`, `retour`, `pluie`, `bain`, `cycle_regles`) et câblées
- [x] **Session M (2026-05-01)** — Marqueurs `// 🌸 ALEXIA` retirés du code, tout passe par USER_CONFIG
- [x] **Session N (2026-05-01)** — `showRDV()` partiellement branché : masquage du post-it agenda

## 9. Sessions restantes / dettes ouvertes

- [ ] **Vérifier `data/props.ALEXIA.json`** — fichier introuvable dans le repo principal au 2 mai 2026, alors qu'il est référencé dans le protocole et probablement dans `extraPropsFile` côté Alexia. Risque de catalogue manquant pour Alexia.
- [ ] **Décider de la priorité userName/userNickname** — confirmer si l'écrasement systématique au démarrage est intentionnel (cf. §6) ou à fixer.
- [ ] **`ui.appTitle`** — brancher ou supprimer.
- [ ] **`ui.showTDAHMention`** — infrastructure posée mais aucun usage ; identifier les éléments TDAH visibles à conditionner si besoin.
- [ ] **Mettre à jour le skill `habitgotchi-dev.skill`** — retirer la convention obsolète des marqueurs `// 🌸 ALEXIA`.
- [ ] **Coordonnées GPS de fallback Toulouse** — externaliser dans `data/config.js` plutôt que hardcodées dans `app.js:1518` et `:1554`.

---

## 10. Règles de travail

- Toujours proposer une structure ou un plan et **attendre la validation** avant d'exécuter une action sur des fichiers.
- Ne jamais déplacer, renommer ou supprimer un fichier sans confirmation explicite.
- Décomposer les tâches longues en étapes courtes et validables une par une.
- Signaler clairement ce qui est **fait / en attente / nécessite une action**.
- Français · écriture inclusive (point médian) · ton professionnel, clair, humain.
- Contexte TDAH : privilégier les approches qui donnent des résultats rapides et visibles, découper systématiquement, éviter les listes interminables sans priorité.
