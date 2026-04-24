---
name: habitgotchi-dev
description: >
  Skill spécialisé pour le développement de HabitGotchi, une PWA de bien-être
  pixel art pour le TDAH. À utiliser dès qu'Émilie travaille sur HabitGotchi :
  correction de bug, ajout de feature, modification de fichier, mise à jour des
  deux repos (main / alexia), ou documentation des patches dans Notion.
  Déclencher pour toute mention de "HabitGotchi", "habitgotchi", "le gotchi",
  "render.js", "ui.js", "app.js", "envs.js", "sw.js", "ai_contexts.json",
  "props.json", "personality.json", ou quand Émilie parle de "patch", "fix",
  "feature gotchi", "mise à jour du gotchi", "branche feature", "repo alexia".
  Ce skill contient toutes les conventions, règles impératives et le format
  de patch-note — ne jamais travailler sur HabitGotchi sans l'avoir lu.
---

# HabitGotchi — Skill de développement

## Contexte projet
HabitGotchi est une PWA mobile (p5.js + LocalStorage + API Claude Anthropic).
Deux repos GitHub séparés :
- `habit-gotchi` → repo personnel d'Émilie (repo principal de développement)
- `habit-gotchi-alexia` → repo de sa sœur (synchronisation manuelle après tests)

Documentation de référence : espace Notion "Habit-Gotchi" → sous-page "⚙️ Les 7 Systèmes".

---

## Stack & fichiers

```
/
├── index.html          (DOM split-view : #console-top + #dynamic-zone)
├── manifest.json       (PWA)
├── sw.js               (Service Worker — cache-first)
├── style.css
├── data/
│   ├── config.js       (UI_PALETTES, GOTCHI_COLORS, ENV_THEMES, CATS)
│   ├── props.json      (catalogue objets pixel art)
│   └── personality.json (bulles par état + style + traits)
├── prompts/
│   ├── ai_contexts.json (templates prompts Claude — syntaxe {{double accolades}})
│   └── ai_system.json   (system prompts soutien)
└── js/
    ├── app.js    → cerveau : data, save/load, XP, météo, habitudes
    ├── render.js → Gotchi, ciel, animations, Prop Engine, HUD canvas
    ├── envs.js   → biomes, météo, effets climatiques
    └── ui.js     → DOM, modales, boutique, journal, IA
```

**Ordre de chargement impératif :** `config.js` → `app.js` → `render.js` → `envs.js` → `ui.js` → (enregistrement `sw.js`)

**Source de vérité :** `window.D` (sérialisée dans `localStorage`, clé `hg4`)

---

## Règles impératives — à respecter ABSOLUMENT

### 1. Ne jamais réécrire un fichier entier
Toujours proposer des blocs ciblés avec `// ... reste du code inchangé`.

### 2. Versioning synchronisé à chaque modification
```
app.js    ligne ~24 : window.APP_VERSION = 'hg-vX.X'
sw.js     ligne   1 : const CACHE_VERSION = 'hg-vX.X'
```
⚠️ Ces deux valeurs doivent toujours être **identiques**.
Après chaque modification de fichier → incrémenter les deux + commit + push.

### 3. Annotations Alexia obligatoires
Toute ligne spécifique au repo d'Alexia doit être annotée :
```js
// 🌸 ALEXIA — [raison courte]
```
Toute feature non portée chez Alexia doit être annotée :
```js
// ❌ NON PORTÉ — [raison]
```

### 4. Syntaxe des prompts IA
Toujours `{{double accolades}}` — jamais `{simple}`.
Variables standard : `{{nameGotchi}}`, `{{userName}}`, `{{heure}}`, `{{date}}`,
`{{energy}}`, `{{happiness}}`, `{{habsDone}}`, `{{style}}`, `{{traits}}`, `{{exemples}}`

### 5. Conventions de code
- `addEvent()` → forme objet privilégiée : `{ type, subtype, valeur, label }`
- Jamais d'emoji en début de `label` (icône auto via `getIcon()`)
- `save()` appelé une seule fois en fin de fonction qui mute `window.D`
- Toute nouvelle globale → exposée sur `window.*` + documentée dans S7

---

## Index des 7 Systèmes (référence rapide)

| # | Système | Fichiers | Mots-clés |
|---|---|---|---|
| S1 | Métabolisme | app.js | XP, pétales, STG, poops, lastPoopSpawn, save/load |
| S2 | Écosystème | envs.js, app.js | meteoData, biome, estJour, drawFog, tc() |
| S3 | Cognition & IA | ui.js, app.js, ai_contexts.json, ai_system.json, personality.json | askClaude(), genSoutien(), thoughtCount, soutienCount, {{nameGotchi}} |
| S4 | Habitudes | app.js, ui.js, config.js | CATS, toggleHab(), habReactions, today() |
| S5 | UI & Design | render.js, envs.js, ui.js, config.js, props.json | pxSize, pxFree, staticInfo, bobY, boutique, renderPropMini |
| S6 | Introspection | ui.js | journal, PIN, bilan, tabletLastSeenDate, MOODS, getWeekId |
| S7 | Ingénierie | app.js, index.html, manifest.json, sw.js | CACHE_VERSION, APP_VERSION, SK, bootstrap(), forceUpdate, cleanProps |

Pour plus de détail sur un système → consulter la page Notion "⚙️ Les 7 Systèmes".

---

## Workflow de développement

### Session standard (une feature / un bug)

**Étape 1 — Amorce de session Claude Code**
```
Tu travailles sur HabitGotchi (PWA p5.js/LocalStorage/API Claude).
Branche active : feature/[nom]
Fichiers à modifier : [liste]

RÈGLES :
- Ne jamais réécrire un fichier entier, blocs ciblés uniquement
- Annoter // 🌸 ALEXIA si spécifique au repo d'Alexia
- Synchroniser APP_VERSION (app.js) + CACHE_VERSION (sw.js) après modif
- À la fin, produire un patch-note au format ci-dessous

FORMAT PATCH-NOTE ATTENDU :
`fichier.js`
`section ou fonction`
* Modification 1
* Modification 2
```

**Étape 2 — Tester sur `habit-gotchi` (branche feature → main)**

**Étape 3 — Porter sur `habit-gotchi-alexia`**
```
Voici le patch-note de la feature [nom] :
[colle le patch-note]

Applique les mêmes changements sur ce repo en vérifiant :
1. Les lignes // 🌸 ALEXIA déjà présentes → ne pas écraser
2. Si feature absente ici → annoter avec // ❌ NON PORTÉ — [raison]
3. Produire un patch-note de ce qui a été fait / ignoré
```

**Étape 4 — Documenter dans Notion**
Coller le patch-note dans "Patch (v.2.0)🌸 Mise à jour HabitGotchi",
puis mettre à jour "⚙️ Les 7 Systèmes" via le MCP Notion en fournissant :
- Le patch-note
- L'index des 7 systèmes (ci-dessus) pour que Claude identifie les sections à modifier

---

## Format patch-note (référence)

```
`fichier.js`
`nom_de_la_fonction` ou `section`
* Description courte du changement
* Autre changement dans la même section

`autre_fichier.json`
`clé_concernée`
* Ce qui a changé
```

Règles du patch-note :
- Un bloc par fichier
- Un sous-bloc par fonction/section modifiée
- Bullet points concis, sans jargon superflu
- Si spécifique Alexia → noter `(🌸 ALEXIA only)`

---

## Points de vigilance (dette technique connue)

- `render.js` est monolithique → ne pas proposer de split sans demande explicite
- `toggleHab()` et `saveJ()` utilisent encore l'ancienne API `addEvent(type, valeur, label)` → fonctionnel, ne pas migrer sans demande
- Nom du modèle `claude-sonnet-4-5` hardcodé dans 3 endroits (ui.js) → à centraliser un jour
- Variables `window.*` globales → surveiller les conflits de noms
- Seuil dithering basse énergie : `en < 40` (= g.energy ≤ 1/5) dans drawBaby/drawTeen/drawAdult
- Bilan hebdo accessible le dimanche (`jourSemaine === 0`) — comportement assumé, non documenté initialement