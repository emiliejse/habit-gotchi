# Audit système USER_CONFIG — HabitGotchi

> Document de référence mis à jour le **26 avril 2026** après le chantier complet USER_CONFIG.
> Ce fichier décrit l'état actuel du code et ce qui reste à faire.

---

## 1. Architecture actuelle (état au 26 avril 2026)

### Principe général

Chaque utilisatrice a un fichier `data/user_config.json` personnel, non commité (protégé par `.gitignore`).
Ce fichier est chargé au démarrage avant tout le reste, et expose `window.USER_CONFIG` à toute l'app.
Le code est identique dans les deux repos — seul `user_config.json` diffère.

### Fichiers du système USER_CONFIG

| Fichier | Statut | Rôle |
|---|---|---|
| `data/user_config.json` | ❌ non commité (.gitignore) | Config perso de chaque utilisatrice |
| `data/user_config.ALEXIA.json` | ✅ commité | Template de référence pour Alexia |
| `data/props.ALEXIA.json` | ✅ commité | Catalogue d'objets exclusifs Alexia |
| `.gitignore` | ✅ présent | Protège `user_config.json` |

### Fichiers identiques entre les deux repos

Tous les fichiers de code sont maintenant identiques et peuvent être copiés librement :
`js/app.js`, `js/ui.js`, `js/render.js`, `js/envs.js`, `data/config.js`, `index.html`, `sw.js`, `data/props.json`, `prompts/ai_contexts.json`, `prompts/ai_system.json`

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
    "traits": ["curieux", "doux", "absurde", "créatif", "rigolo"],
    "style": "...",
    "bulles": { ... }
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
- `userName` → prénom affiché dans l'UI et les prompts IA
- `userNickname` → surnom utilisé dans les bulles via `{{diminutif}}`
- `gotchiName` → nom du gotchi affiché dans le HUD

**`meteo`**
- `lat` / `lon` → coordonnées GPS pour l'API météo (Open-Meteo) et les phases solaires
- `city` → nom de la ville, pour la lisibilité du fichier uniquement

**`birthday`**
- `month` / `day` → mois et jour (entiers). Si `null` → aucun popup, aucun badge, aucun code cheat
- `message` → texte affiché dans la modale anniversaire
- `cheatCode` → mot secret à taper dans la console de cheat
- `petalesBonus` → pétales offerts lors de l'utilisation du code cheat

**`personality`**
- `source` → toujours `"config"` désormais (`personality.json` supprimé)
- `traits` → liste d'adjectifs injectés dans les prompts IA
- `style` → phrase décrivant le ton d'écriture du gotchi
- `bulles` → objet avec 17 états de bulles (matin, aprem, soir, **soirTardif**, nuit, triste, fatigue, fierte, max, idle, vent, chaud, froid, peu, cadeau, journal, custom)
  - `soirTardif` → bulles affichées entre 22h30 et 23h30 (Gotchi dans sa chambre, pas encore endormi — veut de la tranquillité). Fallback intégré dans le code si absent.

**`ui`**
- `showTDAHMention` → si `false`, masque toute mention TDAH (infrastructure posée, rien à masquer aujourd'hui)
- `showCycleFeature` → si `false`, masque l'onglet cycle, le bouton menu agenda, et l'injection de phase dans les prompts IA
- `showRDVFeature` → si `false`, masque la feature agenda/RDV (⏸️ non encore implémenté dans le code)

**`startProps`**
- Liste d'IDs d'objets à débloquer via `PROPS_LIB` au premier lancement (en plus des `cout: 0`)
- Réservé pour usage futur — laisser `[]`

**`extraPropsFile`**
- Chemin vers un catalogue JSON supplémentaire (ex: `"data/props.ALEXIA.json"`)
- Si `null` ou absent → ignoré. Chez Émilie : `null`. Chez Alexia : `"data/props.ALEXIA.json"`

**`ai`**
- `systemPromptOverride` / `contexteOverride` → réservés pour usage futur, laisser `null`

---

## 3. Où est branché USER_CONFIG dans le code

### `js/app.js`

| Fonction | Ce qui est lu |
|---|---|
| `loadUserConfig()` | Charge `data/user_config.json` → `window.USER_CONFIG` |
| `bootstrap()` | `await loadUserConfig()` en tout premier (fonction async) |
| `defs()` | `identity.userNickname` pour initialiser `userNickname` au 1er lancement |
| `bootstrap() → loadDataFiles()` | Force `identity.userName/userNickname/gotchiName` à chaque démarrage |
| `loadDataFiles()` | `personality.source/traits/style/bulles` → remplit `window.PERSONALITY` |
| `loadDataFiles()` | `extraPropsFile` → charge et fusionne un catalogue d'objets supplémentaire |
| `fetchMeteo()` | `meteo.lat` / `meteo.lon` avec fallback Toulouse |
| `fetchSolarPhases()` | `meteo.lat` / `meteo.lon` avec fallback `D.g.lat/lng` |
| `initBaseProps()` | `startProps` → débloque des objets supplémentaires (usage futur) |

### `js/ui.js`

| Fonction | Ce qui est lu |
|---|---|
| `showTDAH()` | `ui.showTDAHMention` |
| `showCycle()` | `ui.showCycleFeature` |
| `showRDV()` | `ui.showRDVFeature` |
| `checkWelcome()` | `birthday.month/day/message` → modale anniversaire |
| `updUI()` | `birthday.month/day/message` → badge 🎂 |
| `applyCheatCode()` | `birthday.cheatCode/petalesBonus` → code cheat anniversaire |
| Construction prompts IA (×2) | `showCycle()` conditionne `getCyclePhase()` |

### `index.html`

| Élément | Rôle |
|---|---|
| `#birthday-badge` | Badge 🎂 affiché le jour de l'anniversaire |
| `#btn-menu-agenda` | Bouton masqué si `!showCycle() && !showRDV()` |
| Bloc `<script>` USER_CONFIG | Conditions d'affichage appliquées après chargement de `ui.js` |

---

## 4. Ce qui n'est PAS encore branché

| Clé | Statut | Notes |
|---|---|---|
| `ui.showRDVFeature` | ⏸️ Fonction posée, UI non conditionnée | Session RDV à faire |
| `ui.showTDAHMention` | ⏸️ Fonction posée, rien à conditionner aujourd'hui | Infrastructure prête |
| `startProps` | ⏸️ Code présent, non utilisé en pratique | Usage futur |
| `ai.systemPromptOverride` | ⏸️ Non branché | Réservé |
| `ai.contexteOverride` | ⏸️ Non branché | Réservé |
| `ui.appTitle` | ⏸️ Non branché | Peu prioritaire |

---

## 5. Protocole de mise à jour du repo d'Alexia

### Ce qu'Émilie envoie à Alexia

Copier ces fichiers depuis `habit-gotchi` vers `habit-gotchi-alexia` :

```
js/app.js
js/ui.js
js/render.js
js/envs.js
data/config.js
data/props.json
data/props.ALEXIA.json   ← nouveau
index.html
sw.js
```

### Ce qu'Alexia installe une seule fois

Copier `data/user_config.ALEXIA.json` → renommer en `data/user_config.json` dans son dossier.
Ne jamais le commiter (il sera ignoré par `.gitignore`).

### Ce qu'Alexia ne touche jamais

```
data/user_config.json    ← sa config perso, jamais écrasée
manifest.json
README.md
data/personality.json    ← peut être supprimé (ignoré par le code)
```

---

## 6. Sessions réalisées

- [x] **Session A** — `user_config.json` créé + `.gitignore`
- [x] **Session B** — Surnom `mimi` branché, infrastructure personnalité
- [x] **Session C** — Utilitaires `showTDAH()` / `showCycle()` / `showRDV()` posés
- [x] **Session D** — Feature cycle conditionnelle (onglet, bouton menu, prompts IA)
- [x] **Session E** — Anniversaire externalisé (badge, modale, code cheat)
- [x] **Session F** — Template `user_config.ALEXIA.json` créé avec personnalité intégrée
- [x] **Session G** — Page Notion ALEXIA_DIFF mise à jour
- [x] **Session H** — `personality.json` supprimé, personnalité migrée dans `user_config.json`
- [x] **Session I** — `props.ALEXIA.json` créé, `extraPropsFile` branché dans `loadDataFiles()`

## 7. Sessions restantes

- [ ] **Session RDV** — Conditionner la feature agenda/rendez-vous avec `showRDV()`
  - Fichiers : `js/ui.js`, `index.html`
  - Dépendances : aucune
  - Risque : moyen (feature étendue dans `ui.js`)

---

## 8. Règles de travail

- Toujours proposer une structure ou un plan et **attendre la validation** avant d'exécuter une action sur des fichiers.
- Ne jamais déplacer, renommer ou supprimer un fichier sans confirmation explicite.
- Décomposer les tâches longues en étapes courtes et validables une par une.
- Signaler clairement ce qui est **fait / en attente / nécessite une action**.
- Français · écriture inclusive (point médian) · ton professionnel, clair, humain.
- Contexte TDAH : privilégier les approches qui donnent des résultats rapides et visibles, découper systématiquement, éviter les listes interminables sans priorité.
