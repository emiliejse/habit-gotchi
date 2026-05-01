# AUDIT_DESIGN.md — HabitGotchi v4.5

Audit design / CSS / HTML / assets — mise à jour **2026-05-01** (modif. joues 2026-05-01).
Périmètre : `css/style.css`, `index.html`, `js/ui-*.js` (HTML & styles inline).
Hors périmètre : `js/render.js`, `js/envs.js`, `js/render-sprites.js`, logique JS pure (`app.js`).

> **Note de version.** L'audit précédent (2026-04-30) ciblait un fichier `js/ui.js` monolithique. Depuis, le code a été refactorisé en 8 modules `ui-*.js` chargés dans l'ordre déclaré dans `index.html:541-561`. Toutes les références ont été mises à jour. Les sections valides de l'ancien audit sont conservées.

---

## SECTION 0 — Résumé exécutif

### 0.1 Tableau de scores (mis à jour)

| # | Catégorie | Note | Justification |
|---|---|:---:|---|
| 1 | Hiérarchie visuelle | **B** | Tokens typographiques `--fs-*` solides et désormais utilisés pour l'essentiel du CSS. Reste ~20 occurrences inline `font-size:12px / 13px / 16px` dans `index.html` (`#g-name` ligne 119, `#j-text` ligne 185, `#claude-summary`…) et dans `ui-habs.js:48-49` (label habitude), `ui-shop.js:498-500`, `ui-ai.js:577-579`, `ui-agenda.js:312-313`. |
| 2 | Navigation & orientation | **B+** | Menu cahier inchangé, état `.menu-line.active` propre (`ui-nav.js:117`). Toujours pas d'indicateur "onglet courant" en mode `compact` ni de breadcrumb sur les modales empilées. |
| 3 | Cohérence graphique | **B−** | Refactorisation en modules a permis de consolider `_modalCloseBtn()` (`ui-core.js:249`) — désormais utilisé par boutique, agenda, debug, soutien. Mais bugs de variables fantômes persistent (`--c-border` / `--c-txt2` dans `ui-habs.js:139-149`, `--lilac-rgb` dans `ui-agenda.js:197`). Couleurs hardcodées encore présentes (#e07060, #e07080, #80b8e0, #e0708066…). |
| 4 | Lisibilité & typographie | **B+** | Excellente échelle `--fs-xs/sm/md/lg/xl`. Polices Caveat / Nunito bien typées. Échelle adoptée à ~85 % dans le CSS, mais incohérence sur les titres de modales (`h3 font-size:13px` hardcodé partout). |
| 5 | Feedback & états interactifs | **B** | `:focus-visible` global, `.btn:disabled` ok, `prefers-reduced-motion` ok. Toujours pas d'état `.is-loading` standardisé — chaque module IA gère son `startThinkingAnim()` ad hoc (`ui-ai.js:39-92`). |
| 6 | Accessibilité mobile | **C+** | Cibles tactiles toujours sous 44 px sur `.mood-b` (42×42), `.j-actions button` (~24 px), `.btn-export` (~26 px), `.inv-env-btn` (~30 px). `--sab` est défini en dur à `0px` (`style.css:40`) au lieu de `env(safe-area-inset-bottom, 0px)`. Pas de `aria-live` sur `#bubble`, `#claude-msg`, `#claude-summary`. |
| 7 | Adaptation TDAH | **A−** | Mini-bar habitudes (`ui-habs.js:31-37`), `.hab--next` (`style.css:863`), fleurs de quota (3×), settings collapsibles, sliders en bottom sheet (`ui-settings.js:1177-1274`). Excellent. Reste : pas de breadcrumb sur les modales empilées. |

### 0.2 Top 3 problèmes urgents

1. ~~**🔴 Variables CSS fantômes utilisées dans `ui-habs.js`**~~
   ✅ **RÉSOLU 2026-05-01** — `--c-border` et `--c-txt2` remplacées par `--border` et `--text2` dans `js/ui-habs.js` (boutons ↑/↓ de la modale "✏️ Mes habitudes", 4 occurrences).

2. ~~**🔴 `--sab` figé à `0px` au lieu de `env(safe-area-inset-bottom, 0px)`**~~
   ✅ **RÉSOLU 2026-05-01** — `style.css:40-42` : `--sab`, `--sal`, `--sar` utilisent désormais `env(safe-area-inset-*, 0px)`.

3. ~~**🟠 Cibles tactiles sous 44 px sur des actions fréquentes**~~
   ✅ **RÉSOLU 2026-05-01**
   - `.mood-b` → 44×44 px (`style.css`).
   - `.j-entry .j-actions button` → `min-height: 44px` (`style.css`).
   - `.btn-export` → `min-height: 44px` + `display:inline-flex` pour centrage vertical (`style.css`).
   - `.inv-env-btn` → externalisé dans `style.css` + `min-height: 44px` (styles inline retirés de `index.html:303-305`).

### 0.3 Top 3 quick wins

1. **🟢 `lockScroll()` manquant dans `ouvrirSnack()`**
   `ui-settings.js:43-122` ouvre 4 modales différentes via `openModal()` qui appelle bien `lockScroll()`. ✅ RÉSOLU. **Mais** `ouvrirSnack()` lui-même (en tant que helper appelé depuis un bouton canvas) ne déclenche pas `lockScroll()` au-delà de ce que fait `openModal`. À vérifier en cas de doute. *(Connaissance préalable du brief)* — confirmer.

2. ~~**🟢 Câbler `--focus-ring` sur `:focus-visible`**~~
   ✅ **RÉSOLU 2026-05-01** — `:focus-visible` utilise désormais `var(--focus-ring)` au lieu de `var(--lilac)` en dur (`style.css`).
   **Reste ouvert :** câbler `--success` sur `.btn-m` et `--warning` sur les warnings cycle — effort M.

3. ~~**🟢 Définir `--lilac-rgb` ou retirer le fallback systématique**~~
   ✅ **RÉSOLU 2026-05-01** — `--lilac-rgb: 176, 144, 208` ajouté dans `:root` (`style.css`). La note d'agenda épouse maintenant la palette par défaut. Note : `applyUIPalette()` ne recalcule pas encore `--lilac-rgb` dynamiquement (à compléter si les palettes personnalisées doivent en bénéficier).

---

## SECTION 1 — Inventaire de l'interface (mis à jour)

### 1.1 Panneaux principaux (`.pnl`)

| ID | Déclencheur | Contenu | Module rendu | Actions |
|---|---|---|---|---|
| `#p-gotchi` | défaut + menu Accueil | Carte état (nom/stade/XP) + zone Claude (pensée IA, fleurs quota) + carte habitudes (mini-bar 6 ronds + liste) | `ui-habs.js` (`renderHabs()`) + `ui-ai.js` (`askClaude()`) | Cocher habitude, demander pensée, info quota, personnaliser habitudes |
| `#p-progress` | menu Progrès | Stats 3 cellules + calendrier hebdo enrichi (cycle, RDV, journal) + bilan IA | `ui-settings.js` (`renderProg()`) + `ui-ai.js` (`genBilanSemaine()`) | Naviguer semaines, ouvrir détail jour, générer/copier bilan |
| `#p-journal` | menu Journal | PIN gate ou contenu (mood picker, textarea, fleurs quota, accordéon entrées par jour) | `ui-journal.js` (`renderJ()`) | Saisir PIN, choisir humeur, écrire, sauver, naviguer semaines, exporter, éditer/supprimer |
| `#p-props` | menu Inventaire | Switcher env (3 boutons) + filtres ronds (5) + section actifs + section rangés + mode suppr | `ui-shop.js` (`renderProps()`) | Filtrer, activer/ranger objet, tout ranger, supprimer IA, long-press export |
| `#p-perso` | menu Perso | 3 cartes : palette UI / couleur gotchi / ambiance env | `ui-settings.js` (`renderPerso()`) | Sélectionner palette/couleur/ambiance |
| `#p-settings` | menu Réglages | 3 `<details>` collapsibles : Compte / Données / Avancé | HTML statique + `ui-settings.js` | Saisir nom, clé API, PIN, code, exporter, importer, MAJ, reset, debug |

### 1.2 Modales (cartographie consolidée)

| Nom | Déclencheur | Mécanisme | Bouton ✕ | ✅ depuis refacto |
|---|---|---|---|---|
| Modale info / confirm générique | `toastModal()`, `openModal()` | `ui-core.js:271` `openModal` (✕ auto) | ✅ standardisé | — |
| Boutique | tap 🛍️ | `ui-shop.js:291` (manipulation directe `mbox.innerHTML`) | ✅ utilise `window._modalCloseBtn()` | OUI |
| Agenda | tap titre `#hdr-title` ou post-it | `ui-agenda.js:55` via `openModalRaw()` | ✅ utilise `window._modalCloseBtn('fermerAgenda()')` | OUI |
| Édition habitudes | bouton "✏️ Personnaliser" | `ui-habs.js:154` via `openModal()` | ✅ auto | — |
| Confirmation soutien | bouton 💜 du menu | `ui-ai.js:415` (`_showSoutienConfirm`, manipulation `mbox`) | ❌ pas de ✕ — boutons "Annuler" / "Parler" uniquement | OUVERT |
| Chat soutien IA | confirmation OK | `ui-ai.js:613` `_genSoutienCore` | ✅ via `_modalCloseBtn('modalLocked=false;clModal()')` | OUI |
| Sliders énergie/bonheur | tap canvas badges | `ui-settings.js:1177` overlay séparé `#etats-overlay` | ❌ pas de ✕ — bouton ✓ Enregistrer + tap fond | acceptable (BS) |
| Tablette terminal | tap 📟 | `ui-settings.js:709` overlay `#tablet-overlay` | ❌ pas de ✕ — clic fond | acceptable (BS) |
| Menu cahier | tap ☰ | `ui-core.js:379` `toggleMenu()` overlay `#menu-overlay` | ❌ pas de ✕ — clic à côté | acceptable |
| Snack repas | tap canvas | `ui-settings.js:43` via `openModal()` | ✅ auto | OUI |
| Formulaire RDV | bouton "Ajouter rdv" | `ui-agenda.js:284` overlay séparé `#rdv-overlay` | ❌ — boutons "Annuler/Enregistrer" | acceptable (BS) |

**Conclusion :** la centralisation par `_modalCloseBtn()` (`ui-core.js:249`, exposé sur `window` ligne 254) a résolu la duplication de l'audit précédent. Reste : la confirmation soutien pourrait recevoir un ✕ pour cohérence ; les overlays bottom-sheet (RDV, états, tablette) sont volontairement sans ✕ (poignée + tap fond).

### 1.3 HUD canvas (`.tama-screen` / `#cbox`)

Inchangé. Les badges énergie/bonheur sont dessinés dans le canvas p5 (commentaire `index.html:67-68`), tap → `ouvrirModalEtats()` (`ui-settings.js:1177`). La bottom sheet est stylée par `style.css:894-944`.

### 1.4 Navigation

- **Languette** `.menu-languette` — refactorisée 2026-05-01 en **ruban diagonal** ancré en bas à gauche (coin triangle `clip-path`). Icône ☰ via `::after` (✕ quand ouverte). État `.is-open` → monte de 10 px (`translateY(-10px)`) + ombre renforcée. `--sab` remis à `0px` (pas de home indicator sur l'appareil cible).
- **Cahier** : 6 lignes en quinconce (`style.css:494-530`) + 2 post-its (Agenda rose, Soutien lilas). Pas de ✕ — clic à côté ferme.
- **État actif** : `.menu-line.active` (`style.css:523-527`) — ciblé via `ui-nav.js:115-117`.
- **Mode compact** (`#console-top.compact`) : `#hdr-title` se replie (`style.css:209-214`), tama réduit à 220 px (`style.css:260-267`). Pas d'indicateur de l'onglet courant en mode compact.

---

## SECTION 2 — Audit CSS

### 2.1 Inventaire complet des variables CSS (`:root`, `style.css:9-100`)

| Groupe | Variables | Statut global |
|---|---|---|
| Palette de base | `--bg`, `--card`, `--solid`, `--pink`, `--lilac`, `--mint`, `--peach`, `--sky`, `--coral`, `--gold`, `--tama` | ✅ utilisées partout |
| Texte / structure | `--text`, `--text2`, `--border`, `--shadow` | ✅ utilisées |
| Sémantiques | `--success`, `--danger`, `--warning`, `--info`, `--focus-ring` | ⚠️ seul `--danger` utilisé (`style.css:1081-1082`, `ui-shop.js:956-961`, `ui-settings.js:273`). Les 4 autres sont **mortes**. |
| Safe areas | `--sat`, `--sab`, `--sal`, `--sar` | ⚠️ seul `--sat` est défini avec `env()`, les 3 autres sont à `0px` en dur |
| Polices | `--font-terminal`, `--font-title`, `--font-gotchi`, `--font-body` | ✅ utilisées |
| Échelle typo | `--fs-xs` (11), `--fs-sm` (13), `--fs-md` (15), `--fs-lg` (18), `--fs-xl` (22) | ✅ `xs/sm/md/lg` largement adoptées ; `--fs-xl` jamais utilisée |
| Espacements | `--sp-xs` (4), `--sp-sm` (8), `--sp-md` (12), `--sp-lg` (16), `--sp-xl` (24), `--app-gutter` (14) | ✅ adoption forte ; `--sp-xl` jamais utilisée |
| Border radius | `--r-sm`, `--r-md`, `--r-lg`, `--r-xl` | ✅ utilisées |
| Thème papier | `--paper-bg`, `--paper-border`, `--paper-text`, `--paper-entry`, `--paper-entry-ts`, `--paper-entry-btn`, `--paper-book-bg`, `--paper-book-border`, `--paper-book-shadow`, `--paper-book-line` | ⚠️ `--paper-book-line` jamais utilisée (supplantée par `repeating-linear-gradient` `style.css:429-435`) |
| Thème terminal | `--terminal-box`, `--terminal-border`, `--terminal-screen`, `--terminal-screen-border`, `--terminal-text`, `--terminal-text-dim`, `--terminal-line-div` | ✅ utilisées |

#### Tableau synthèse — variables problématiques

| Variable | Définie ? | Utilisée dans | Statut |
|---|---|---|---|
| `--success` | ✅ `style.css:32` | `#toast.toast--success` | ✅ RÉSOLU 2026-05-01 — câblé sur les variantes toast |
| `--warning` | ✅ `style.css:34` | `#toast.toast--warning` | ✅ RÉSOLU 2026-05-01 — câblé sur les variantes toast |
| `--info` | ✅ `style.css:35` | nulle part | 🟠 encore morte — à câbler (warnings cycle, bilan, etc.) |
| `--focus-ring` | ✅ `style.css:36` | `:focus-visible` | ✅ RÉSOLU 2026-05-01 — remplace `--lilac` en dur |
| `--fs-xl` | ✅ `style.css:61` | nulle part | 🟠 morte |
| `--sp-xl` | ✅ `style.css:70` | nulle part | 🟠 morte |
| `--paper-book-line` | ✅ `style.css:90` | nulle part | 🟠 morte |
| `--c-border` | ❌ NON DÉFINIE | ~~`ui-habs.js:139, 145`~~ | ✅ RÉSOLU 2026-05-01 — remplacé par `--border` |
| `--c-txt2` | ❌ NON DÉFINIE | ~~`ui-habs.js:140, 146`~~ | ✅ RÉSOLU 2026-05-01 — remplacé par `--text2` |
| `--lilac-rgb` | ✅ `style.css:root` | `ui-agenda.js:197` | ✅ RÉSOLU 2026-05-01 — défini à `176, 144, 208` dans `:root` |
| `--bubble-bg` | ✅ `style.css:root` | `.bubble` + `.bubble::before` | ✅ RÉSOLU 2026-05-01 — défini à `#fff` dans `:root`, câblé dans `applyUIPalette()` (`ui-settings.js`), surchargeable via `p.bubbleBg` dans les palettes |
| `--sab` | ✅ `style.css:40` | utilisée dans `.menu-languette`, `#dynamic-zone`, `#toast` | ✅ RÉSOLU 2026-05-01 — `env(safe-area-inset-bottom, 0px)` |
| `--sal` / `--sar` | ✅ `style.css:41-42` | `body padding-left/right` `style.css:144-145` | ✅ RÉSOLU 2026-05-01 — `env(safe-area-inset-left/right, 0px)` |

### 2.2 Architecture de thèmes proposée

**Objectif :** rendre HabitGotchi facilement extensible (thèmes saisonniers via `USER_CONFIG`, mode nuit, surcharges utilisatrice).

#### Couche 1 — Primitives (palette brute, ne change jamais)

```css
:root {
  /* Lilas (primaire) */
  --color-lilac-100: #ede0f8;
  --color-lilac-200: #d8bef5;
  --color-lilac-400: #b090d0;   /* actuel --lilac */
  --color-lilac-700: #6e5e8c;   /* actuel --text2 */

  /* Rose / pink */
  --color-pink-200: #f9c8dc;
  --color-pink-400: #e8a0bf;    /* actuel --pink */

  /* Mint / vert */
  --color-mint-400: #80d0a8;    /* actuel --mint */

  /* Coral / danger */
  --color-coral-400: #e09090;   /* actuel --coral */

  /* Cycle (nouveau) */
  --color-cycle-red: #e07080;
  --color-cycle-warn: #e07060;

  /* Papier */
  --color-paper-bg: #e8e0d0;
  --color-paper-rule: #c8d8f0;  /* lignes du cahier menu */

  /* Neutres */
  --color-text-deep: #38304a;
  --color-text-soft: #5a5070;
}
```

#### Couche 2 — Tokens sémantiques (rôles)

```css
:root {
  /* Surfaces */
  --bg:           var(--color-lilac-100);   /* override par palette */
  --solid:        #ffffff;
  --card:         rgba(255,255,255,.88);
  --bubble-bg:    var(--solid);              /* nouveau — corrige .bubble */

  /* Texte */
  --text:         var(--color-text-soft);
  --text2:        var(--color-lilac-700);

  /* Bordures */
  --border:       #ccc4d8;

  /* Sémantiques */
  --primary:      var(--color-lilac-400);
  --success:      var(--color-mint-400);
  --danger:       var(--color-coral-400);
  --warning:      #e8c068;
  --info:         #88bee8;
  --focus-ring:   var(--color-lilac-400);

  /* Cycle (nouveau) */
  --cycle-j1:     var(--color-cycle-red);
  --cycle-warn:   var(--color-cycle-warn);

  /* RGB pour rgba() — nouveau */
  --lilac-rgb:    176, 144, 208;
  --primary-rgb:  var(--lilac-rgb);
}
```

#### Couche 3 — Thèmes (override)

```css
/* Saisons */
[data-theme="hiver"]   { --bg: #c8d8e8; --primary: #6090c0; }
[data-theme="automne"] { --bg: #e8c068; --primary: #c04818; }

/* Mode nuit (futur) */
[data-theme="night"] {
  --bg: #2a2440;
  --solid: #3a3258;
  --text: #e8e0f0;
  --text2: #b8a8d0;
  --border: #4a4068;
  --bubble-bg: var(--solid);
}
```

#### Articulation avec `UI_PALETTES` (`config.js`)

Aujourd'hui `applyUIPalette()` (`ui-settings.js:361-373`) écrase 8 propriétés CSS individuellement via `setProperty`. Avec l'architecture en couches, **la palette modifierait uniquement la couche 2 sémantique** :

```js
function applyUIPalette(id) {
  const p = HG_CONFIG.UI_PALETTES.find(x => x.id === id);
  const root = document.documentElement.style;
  root.setProperty('--bg',         p.bg);
  root.setProperty('--primary',    p.lilac);
  root.setProperty('--lilac',      p.lilac);   // alias rétro-compat
  root.setProperty('--success',    p.mint);    // ← nouveau câblage
  root.setProperty('--mint',       p.mint);    // alias
  root.setProperty('--pink',       p.pink);
  root.setProperty('--text',       p.text);
  root.setProperty('--text2',      p.text2);
  root.setProperty('--card',       p.card);
  root.setProperty('--border',     p.border);
  // RGB pour rgba()
  const rgb = hexToRgb(p.lilac).join(',');
  root.setProperty('--lilac-rgb', rgb);
  root.setProperty('--primary-rgb', rgb);
}
```

### 2.3 Audit des styles inline dans les modules JS

| Module | Type d'inline | Volume | Effort migration |
|---|---|---|---|
| `ui-habs.js` | `font-size:12px` × 2 (lignes 48-49, 71), `font-size:13px` × 2 (139, 145), couleurs cassées `--c-border`/`--c-txt2` | Faible | **S** |
| `ui-shop.js` | très nombreux `style="..."` dans les cartes prop, filtres ronds (52×52), boutons d'action ; couleurs ok mais répétition | Élevé (~40 blocs) | **L** — mériterait classes `.shop-card`, `.shop-filter-btn`, `.shop-action-btn` |
| `ui-ai.js` | `font-size:13px` (h3 modale soutien `ui-ai.js:577, 658`), styles inline canvas mini p5 | Moyen | **M** |
| `ui-journal.js` | `font-size:12px` (textarea edit `ligne 279`), couleurs `#a09880`, `#e07060` (lignes 104, 174-175, 205, 235) | Faible | **S/M** |
| `ui-agenda.js` | énorme : tous les boutons jour/mois/cycle, formulaires RDV/cycle, couleurs `#e07080`, `#80b8e0`, `#e0708066`, `#80b8e066`, `var(--coral)22`, `var(--lilac)22`, etc. | Très élevé (~50+ blocs) | **L** |
| `ui-settings.js` | inline modales bienvenue, debug, snack ; `font-size:12px` × 6, `#81c784` × 1 | Moyen | **M** |
| `ui-core.js` | `style.cssText` du `#snack` (ligne 204-207) — inline acceptable car élément créé dynamiquement | Très faible | — |
| `ui-nav.js` | aucun inline | — | ✅ |

**Recommandations migration :**
- **Phase 1 (S/M) :** créer `.modal-h3` (`font-size:13px;color:var(--lilac)`) → unifier ~10 occurrences.
- **Phase 2 (M) :** créer `.shop-filter-circle`, `.shop-action-pill` → réduire `ui-shop.js`.
- **Phase 3 (L) :** classer les boutons RDV/cycle (`.rdv-emoji-btn`, `.rdv-recur-btn`, `.cycle-cell`) → réduire `ui-agenda.js`.

---

## SECTION 3 — Audit HTML

### 3.1 `index.html` — propreté & maintenabilité

**Bonnes pratiques en place :**
- `aria-label` sur tous les boutons sans texte (`index.html:74, 79, 85, 138, 195, 203, 249, 253, 430`).
- `role="button"` sur `#hdr-title` cliquable (`ligne 79`).
- `inputmode="numeric"` sur les inputs PIN (`lignes 359, 362`).
- `autocomplete="off"` / `new-password` correctement posés.

**Points à corriger :**

| Problème | Localisation | Sévérité |
|---|---|---|
| `#hab-count` toujours présent mais `display:none !important` | `index.html:151`, CSS `style.css:635-643` | 🟡 code mort |
| `<input type="text" id="cheat-input">` sans `inputmode` | `index.html:372` | 🟡 mineur |
| `#g-name` `font-size:16px` inline alors que `.card-gotchi #g-name` est défini en `font-size:24px` Caveat dans CSS | `index.html:118-123` (le wrapper inline `font-size:16px` écrase visuellement) | 🟠 incohérence hiérarchie |
| `#claude-summary` `font-size:var(--fs-sm)` inline + style massif (`background:rgba(176,144,208,.07);…`) | `index.html:264` | 🟠 doit être déplacé dans `style.css` (`.claude-summary`) |
| `#j-text` `font-size:12px;background:#faf6f0;border-color:#c8b8a0` inline | `index.html:185` | 🟠 doit être tokenisé (`--fs-sm`, `--paper-entry`, `--paper-border`) |
| `#thought-count`, `#bilan-flowers`, `#journal-flowers` ont la même classe `.thought-flowers` mais des contextes différents | `index.html:142, 181, 269` | 🟢 acceptable (override CSS) |
| `<meta theme-color>` figé à `#ddd6e8` | `index.html:21` | 🟢 limitation HTML — pas variabilisable, à synchroniser manuellement avec la palette par défaut |
| Pas de `aria-live` sur les zones IA `#bubble`, `#claude-msg`, `#claude-summary` | `index.html:96, 143, 264` | 🟠 a11y — lecteur d'écran muet |
| `<sub>` utilisé pour la date dans le header (sémantique douteuse) | `index.html:81-83` | 🟡 mineur — `<small>` ou `<span>` plus propre |
| Le commentaire d'ordre des scripts mentionne encore `ui.js` | `index.html:538` | 🟡 commentaire à mettre à jour vers la liste 8-modules |

**Ordre de chargement des scripts** (`index.html:541-561`) — ✅ cohérent avec les dépendances :
```
config.js → app.js → render.js → envs.js → render-sprites.js
→ ui-core.js → ui-habs.js → ui-shop.js → ui-ai.js
→ ui-journal.js → ui-settings.js → ui-agenda.js → ui-nav.js (last)
```

### 3.2 Cartographie HTML généré dans les modules JS

#### Classes CSS effectivement définies vs utilisées

| Classe | Définie dans `style.css` | Utilisée dans HTML/JS | Statut |
|---|---|---|---|
| `.mood-b` | ✅ ligne 1114 | ✅ `ui-journal.js:108, 277` | OK |
| `.hab-mini`, `.hab-mini-bar` | ✅ lignes 793-815 | ✅ `ui-habs.js:31-37` | OK |
| `.hab--next` | ✅ ligne 863 | ✅ `ui-habs.js:46` | OK |
| `.shop-open` | ✅ ligne 1265 | ✅ `ui-shop.js:332-338`, `ui-agenda.js:99` | OK |
| `.shop-catalogue` | ✅ ligne 1269 | ✅ `ui-shop.js:336-339` | OK |
| `.agenda-open` | ✅ ligne 1297 | ✅ `ui-agenda.js:99` | OK |
| `.modal-pop` | ✅ ligne 1139 | ✅ `ui-core.js:281-284` | OK |
| `.modal-close` | ✅ ligne 1172 | ✅ injecté par `_modalCloseBtn` | OK |
| `.app-overlay` | ✅ ligne 404 | ✅ `index.html:434, 518` | OK |
| `.btn-snack` | ❌ non définie | ❌ `ui-settings.js:103` (inline-only) | 🔴 ORPHELINE — uniquement décorative dans la chaîne, le styling vient des `style="…"` inline |
| `.j-day-toggle` | ✅ lignes 1017-1019 | ✅ `ui-journal.js:233` | OK |
| `.j-day-sep` | ✅ lignes 1006-1013 | ✅ `ui-journal.js:233` | OK |
| `.tablet-line`, `.tl-time`, `.tl-icon` | ✅ lignes 1247-1249 | ✅ `ui-settings.js:738-741` | OK |
| `.soutien-chat`, `.chat-bubble-user/claude/system` | ✅ lignes 342-366 | ✅ `ui-ai.js:661-662, 691, 715, 722, 781, 801` | OK |
| `.j-entry`, `.j-actions`, `.j-text-content`, `.j-date`, `.mood-{super,bien,ok,bof,dur}` | ✅ lignes 973-995 | ✅ `ui-journal.js:243-253` | OK |
| `.btn-info-discret` | ✅ ligne 677 | ✅ `index.html:138` | OK |
| `.thought-flowers`, `.flower-on`, `.flower-off` | ✅ lignes 696-705 | ✅ `ui-settings.js:141-184` | OK |
| `.j1-ligne` | ✅ inline only | ✅ `ui-agenda.js:1049, 1149` | 🟡 à externaliser |
| `.settings-section`, `.settings-body`, `.settings-chevron` | ✅ lignes 1048-1082 | ✅ `index.html:332, 379, 394` + injection `ui-settings.js:1329-1335` | OK |

#### Animations CSS — usage

| Animation | Définie | Utilisée | Statut |
|---|---|---|---|
| `popBounce` | ✅ `style.css:854` | `.hab.done .ck` | ✅ |
| `fu` | ✅ `style.css:1128` | `.pnl` | ✅ |
| `modalPop` | ✅ `style.css:1135` | `.modal-pop` | ✅ |
| `bookSlideUp` | ✅ `style.css:575` | `.menu-overlay.open .menu-book` | ✅ |
| `shopOpen` | ✅ `style.css:1260` | `.modal-box.shop-open` | ✅ |
| `tabletOpen` | ✅ `style.css` | `#tablet-box` | ✅ RÉSOLU 2026-05-01 — `scale(0.9)+translateY(-8px)` → `scale(1)` en 0.2s, `prefers-reduced-motion` respecté |
| `tamaSway`, `tamaSwayStrong` | ✅ `style.css:1317-1328` | `.tama-wind`, `.tama-wind-strong` | ✅ |
| `jEntryFadeIn` | ✅ `style.css:986` | `.j-entry` | ✅ |
| `shakeRow` | ✅ `style.css:1120` | `#mood-pick.mood-required .mood-b` | ✅ |
| `slideUp` | ✅ `style.css:1357` | `#etats-sheet`, `#rdv-sheet` (inline) | ✅ |

### 3.3 Cohérence des nommages

**Conventions actuellement observées :**
- `.btn-*` : `btn-p`, `btn-s`, `btn-d`, `btn-m`, `btn-boutique`, `btn-info-discret`, `btn-export`, `btn-snack` — ✅ stable
- `.card-*` : `card`, `card-primary`, `card-primary-header`, `card-gotchi` — ✅ stable
- `.hab-*` : `hab`, `hab-mini`, `hab-mini-bar`, `hab--next`, `hab-count` — ✅ stable, BEM léger sur `--next`
- `.j-*` (journal) : `j90`, `j-entry`, `j-text-content`, `j-date`, `j-actions`, `j-day-sep`, `j-day-toggle`, `j-week-title`, `j-week-count` — ✅
- `.menu-*` : `menu-languette`, `menu-overlay`, `menu-book`, `menu-doodle`, `menu-line`, `menu-line--indent`, `menu-postit`, `menu-postit--rose/lilac` — ✅ BEM partiel
- `.tama-*` : `tama-shell`, `tama-screen`, `tama-wind` — ✅
- `.tablet-*` : `tablet-line`, `tl-time`, `tl-icon` — ⚠️ incohérence (`tl-` au lieu de `tablet-`)
- `.pin-*`, `.mood-*`, `.cal-*`, `.nav-*` — ✅ courts et explicites

**Anomalies identifiées :**
| Classe | Problème | Suggestion |
|---|---|---|
| `.tl-time`, `.tl-icon` | préfixe `tl-` ne respecte pas `tablet-*` | renommer `tablet-line-time`, `tablet-line-icon` |
| `.shop-open` | utilisée aussi par l'agenda → nom trompeur | renommer `modal-box--full` (BEM) ou laisser et documenter |
| `.j90` | nom obscur (référence années 90) | acceptable (signature design) ou `journal-card` |
| `.inv-env-btn` | définie inline uniquement (`index.html:290-292`) | externaliser et documenter |
| `.btn-snack` | classe utilisée mais non définie en CSS (style inline) | définir en CSS pour cohérence |

---

## SECTION 4 — Propositions de redesign UX/UI

> Contraintes : moderniser sans trahir l'ADN pixel art, tout doit être implémentable en CSS/HTML sans toucher au canvas p5.

### C1. Navigation & orientation

#### C1.1 — Languette menu : indicateur ouvert/fermé

**Problème :** `.menu-languette` (`style.css:372`) garde l'icône ☰ figée que le menu soit ouvert ou fermé.

**Proposition :**
```css
.menu-languette { transition: transform .3s; }
.menu-languette.is-open { transform: translateX(-50%) rotate(180deg); }
.menu-languette.is-open::before { content: '✕'; }  /* override */
```

```js
// ui-core.js toggleMenu()
ov.classList.toggle('open');
document.querySelector('.menu-languette').classList.toggle('is-open');
```
**Effort : S** • **Fichiers :** `style.css:372`, `ui-core.js:379`.

#### C1.2 — Indicateur d'onglet courant en mode `compact`

✅ **RÉSOLU 2026-05-01**
- `<span id="compact-tab-label">` ajouté dans `#tama-bubble-wrap` (`index.html`), positionné en `absolute` à gauche du tama.
- `display:none` par défaut ; `display:block` + `position:absolute;left:4px;top:50%` uniquement sous `#console-top.compact` (`style.css`).
- Style : `var(--font-title)`, `var(--fs-md)`, `var(--lilac)`, `opacity:0.7`, écriture verticale (`writing-mode:vertical-rl`).
- `go()` dans `ui-nav.js` met à jour le texte via `TAB_LABELS` (ex: `✿ Progrès`, `✿ Journal`…).
- `aria-live="polite"` pour les lecteurs d'écran.
- ⚠️ **Bug corrigé 2026-05-01** : en mode compact, `#tama-bubble-wrap` remontait de `-48px` et passait par-dessus `.hdr`, bloquant les clics sur `#btn-boutique-hdr` et `#btn-tablet`. **Fix** : `position:relative` + `z-index:1` ajouté sur `.hdr` (`style.css`), sans toucher au layout ni aux animations.

#### C1.3 — Modales empilées : retour navigationnel

**Problème :** boutique → "✨ Demander à X" → modale loading → résultat. Chaque étape `mbox.innerHTML = …`. Aucun retour possible.

**Proposition légère :** `data-back="boutique"` sur `#mbox`, et un `← Retour` en haut à gauche quand l'attribut est posé.
```js
function openModalWithBack(html, backFn) {
  openModal(`<button class="modal-back" onclick="${backFn}">← Retour</button>${html}`);
  document.getElementById('mbox').dataset.back = backFn;
}
```
**Effort : M** • **Fichiers :** `ui-core.js`, `ui-shop.js` (chaîne boutique→IA→résultat).

### C2. Accueil & zone gotchi

#### C2.1 — Carte d'état (nom / stade / XP) : hiérarchie visuelle

✅ **RÉSOLU 2026-05-01**

- `index.html:118-129` : wrapper inline `font-size:16px` supprimé. `#g-name` et `#g-stage` séparés sur deux lignes via `.g-name-row` (flex centré).
- `#g-stage` : 16px Caveat italique `opacity:0.85` — secondaire par rapport au nom (CSS `style.css`).
- `#birthday-badge` : `aria-label` ajouté.
- `.pbar` : hauteur 12px, fond en cubes pixel art vides (`repeating-linear-gradient`, `--lilac-rgb 0.12`).
- `.pfill` : cubes pleins gradient `var(--lilac)` 8px → `var(--pink)` 2px de gap. Styles inline `background` et `border-radius` retirés de `index.html`.

**Non implémenté :** animation `popBounce` au palier (nécessite JS dans `app.js`) — conservé comme amélioration future.

#### C2.2 — Zone pensée IA : mise en scène

✅ **RÉSOLU 2026-05-01** (version allégée — sans refonte canvas)

- `#claude-card` : fond supprimé, remplacé par `border-top: 1.5px dashed rgba(--lilac-rgb, 0.35)` — esthétique cahier.
- `@keyframes claudeMsgIn` : `opacity 0→1` + `translateY(-6px→0)` en 0.35s — apparition douce.
- `.has-msg` : classe ajoutée via JS (`ui-ai.js`) au moment du peuplement de `#claude-msg`, avec reflow forcé pour rejouer l'animation à chaque pensée.
- `#claude-msg:empty::before` : placeholder CSS discret ("Demande une pensée à ton Gotchi…") visible quand la zone est vide.
- `aria-live="polite"` ajouté sur `#claude-msg` dans `index.html` (dette a11y).

**Non implémenté :** repositionnement en bulle au-dessus du tama (touche le canvas p5 — chantier séparé).

#### C2.3 — Mini-bar habitudes : micro-animations de validation

**Problème :** quand on coche une habitude, `popBounce` joue sur la checkbox. Le badge `.hab-mini` correspondant change discrètement de fond. Pas de feedback "fête".

**Proposition (compatible `prefers-reduced-motion`) :**
```css
@keyframes pixelConfetti {
  0%   { transform: translate(-50%, -50%) scale(0); opacity: 1; }
  100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1); opacity: 0; }
}
.hab-mini.done::after {
  content: '';
  position: absolute;
  width: 4px; height: 4px;
  background: var(--mint);
  animation: pixelConfetti .6s ease-out;
  /* … 4-6 pseudo-éléments via JS pour positions aléatoires */
}
```
Et dans `ui-habs.js`, après cochage, spawner 4 micro-éléments DOM (`.confetti-px`) avec positions randomisées en CSS variable.

**Effort : M** • **Fichiers :** `style.css`, `ui-habs.js`.

#### C2.4 — Quota fleurs : visualisation pixel art SVG

**Problème :** `.thought-flowers` affiche des `✿` Unicode qui s'estompent. Joli mais peu expressif.

**Proposition :** remplacer par 3 SVG inline pixel art `<svg class="flower-icon">` qui poussent progressivement (bourgeon → fleur entière → fanée si quota dépassé). 3 états : `.flower-bloom`, `.flower-bud`, `.flower-wilt`.

**Effort : M** • **Fichiers :** `style.css:696-705`, `ui-settings.js:136-185`.

### C3. Journal & humeurs

#### C3.1 — Mood picker : faces pixel art SVG

**Problème :** `.mood-b` (`style.css:1114`) utilise des emojis système (`🌧️ 😔 😐 😊 🌟`) — rendus différents iOS / Android, taille 42×42 px.

**Proposition :**
- Remplacer chaque emoji par un SVG pixel art 16×16 dessiné main (5 expressions distinctes).
- Taille bouton **44×44 px** (corrige la cible tactile).
- Micro-animation au tap : `transform: scale(1.15)` + `popBounce` léger.

**Effort : M** (création des 5 SVG) • **Fichiers :** `style.css:1114-1120`, `ui-journal.js:89, 108, 277`.

#### C3.2 — Entrées journal : hiérarchie

✅ **RÉSOLU 2026-05-01**

- `.j-entry-header` + `.j-entry-mood` ajoutés dans `style.css` — humeur 24px à gauche, heure `--fs-xs` à droite.
- `<hr class="j-entry-divider">` : séparateur 1px dashed `--paper-border` entre humeur et texte.
- `.j-entry .j-actions` aligné à droite (`justify-content:flex-end`), boutons à `min-height/width:36px`.
- `aria-label` ajoutés sur ✏️ et 🗑️ (bonus a11y).
- `escape()` appliqué sur `e.text` dans `ui-journal.js:262` (sécurité).
- `margin-top:3px` inline supprimé du texte (géré par le séparateur).

**Note :** cibles tactiles à 36px (proche des 44px recommandés) — un palier acceptable sans refonte du layout `.j-actions`.

#### C3.3 — Export : visibilité

**Problème :** `.btn-export` (`style.css:1023`) discret, ~26 px de haut.

**Proposition :** garder l'esthétique pill mais passer à 36 px avec icône SVG download au lieu du `↓` texte. Centrer dans un bandeau dédié en bas du journal.

**Effort : S** • **Fichiers :** `style.css:1023-1031`, `index.html:209-212`.

### C4. Boutique & inventaire

#### C4.1 — Filtres ronds

✅ **RÉSOLU 2026-05-01**
- Chaque filtre est maintenant dans un `<div flex-column>` : bouton rond 52×52 (inchangé) + `<span>` 9px sous le rond.
- Label coloré en `var(--lilac)` + bold quand actif, `var(--text2)` sinon.
- `title=` remplacé par `aria-label=` (accessibilité).
- Cible tactile conservée à 52×52 sur le bouton. Fichier : `ui-shop.js`.

#### C4.2 — Carte objet : mise en scène

**Problème :** `_propCard()` (`ui-shop.js:61-113`) est minimaliste (canvas + nom + type).

**Proposition :**
```
┌──────────────────┐
│  NEW             │
│   ┌──────┐       │
│   │ 🪑   │       │  ← canvas pixel art, fond lilac très doux
│   └──────┘       │
│   Nom Objet      │  ← Caveat 14px
│   décor          │  ← uppercase 9px text2
│   ─────────      │
│   🌸 8 pétales   │  ← prix toujours visible, pas dans le bouton
└──────────────────┘
```
- Fond du canvas : `rgba(176,144,208,0.08)` au lieu de blanc pur — distingue la zone.
- Prix affiché en bas systématiquement.
- État actif : bordure mint **+ glow** (au lieu de juste bordure).

**Effort : M** • **Fichiers :** `ui-shop.js:61-113`.

#### C4.3 — Actifs vs Rangés : distinction

**Problème :** les cartes actives ont un fond mint et bordure mint ; les rangées un fond blanc et bordure border. Différence claire mais subtile.

**Proposition :**
- Actifs : bordure 3 px mint + ombre verte douce + petit badge `● ${env}` en haut à droite.
- Rangés : fond gris clair, opacité 0.85, badge "rangé" discret en bas.

**Effort : S** • **Fichiers :** `ui-shop.js:94-101`.

### C5. Progrès & stats

#### C5.1 — Calendrier hebdo : heatmap pixel art

Aujourd'hui (`renderProg()` `ui-settings.js:441-508`), le calendrier hebdo est déjà enrichi (couleur habitudes, J1, ovulation, RDV, journal). C'est très bien.

**Proposition d'amélioration :**
- Remplacer les emojis 📓 et 📌 par des **micro-icônes SVG pixel art** (8×8 px) pour cohérence visuelle.
- Ajouter une mini face d'humeur (4×4 px) si une note journal du jour a une humeur — actuellement on ne voit que "il y a une note", pas laquelle.

**Effort : M** • **Fichiers :** `ui-settings.js:475-505`, `ui-agenda.js:799-803`.

#### C5.2 — 3 cellules stats (série / XP / journal)

**Problème :** `index.html:227-243` — 3 cartes identiques avec juste une couleur de chiffre.

**Proposition (cartes stat pixel art) :**
```
┌────────┐ ┌────────┐ ┌────────┐
│  🔥    │ │  ⭐    │ │  📓    │  ← icône 24px pixel art
│  12    │ │  450   │ │  28    │  ← chiffre 28px Caveat
│ jours  │ │  XP    │ │ notes  │  ← label uppercase 11px
└────────┘ └────────┘ └────────┘
```
Chaque carte a sa propre icône SVG dédiée. Animation `popBounce` sur le chiffre quand il change.

**Effort : S/M** • **Fichiers :** `index.html:227-243`.

#### C5.3 — Bilan IA : mise en forme

**Problème :** `#claude-summary` (`index.html:264`) affiche le bilan en `white-space: pre-wrap` Nunito italique 13 px. Lisible mais bloc dense.

**Proposition :**
- Ajouter une bordure "papier déchiré" en haut (`border-top: 4px solid var(--paper-border)` + `border-image`).
- Aérer : `line-height: 1.8`, `padding: 16px 18px`.
- Si le bilan contient des paragraphes (séparés par `\n\n`), les afficher dans des `<p>` avec marge entre eux.

**Effort : S** • **Fichiers :** `index.html:264`, `ui-ai.js:930` (parser le retour).

### C6. États du gotchi & feedbacks

#### C6.1 — Bottom sheet "Comment tu te sens ?"

**Problème :** `ouvrirModalEtats()` (`ui-settings.js:1177-1274`) est correct, mais peu pixel art — 2 sliders horizontaux génériques.

**Proposition :**
- Remplacer chaque slider par une **rangée de 5 sprites pixel art** cliquables (échelle 0-5).
- Pour énergie : ⚡ vide → ⚡ plein progressif.
- Pour bonheur : visage triste → visage rayonnant, 5 états.
- Animation : sprite cliqué grossit (`scale(1.15)`) + remplit les précédents.

**Effort : M** • **Fichiers :** `style.css:894-944`, `ui-settings.js:1212-1268`.

#### C6.2 — État `loading` standardisé

✅ **RÉSOLU 2026-05-01**
- `.btn.is-loading` ajouté dans `style.css` : `pointer-events:none`, `opacity:0.65`, `::after` animé (`dotPulse` steps) en terminal.
- `prefers-reduced-motion` : animation remplacée par `' …'` statique.
- `askClaude()` : `#btn-ask-claude` reçoit `.is-loading` au départ, retiré à l'arrivée (succès + erreur).
- `genBilanSemaine()` : `id="btn-gen-bilan"` ajouté dans `index.html`, même pattern.
- `startThinkingAnim` conservé sur les zones texte — les deux mécanismes coexistent sans conflit.
- Reste ouvert : `acheterPropClaude()` (bouton boutique, moins prioritaire) et `aria-busy="true"` (accessibilité lecteur d'écran).

**Fichiers modifiés :** `style.css`, `ui-ai.js`, `index.html`.

#### C6.3 — Toasts : variantes typées

✅ **RÉSOLU** (déjà en place) — CSS `toast--success / --danger / --warning` dans `style.css`, API `toast(msg, type)` dans `ui-core.js:177`.

---

## SECTION 5 — Icônes, émojis & assets visuels (NOUVEAU)

### 5.1 Inventaire des emojis fonctionnels

| Emoji | Contexte | Fichier / ligne | Rôle | Candidat remplacement |
|---|---|---|---|---|
| 🛍️ | Bouton boutique header | `index.html:75` | Navigation | **OUI** — PNG/SVG pixel art |
| 📟 | Bouton tablette header | `index.html:86` | Navigation | **OUI** — PNG/SVG pixel art |
| ☰ | Bouton languette menu | `index.html:430` | Navigation | **OUI** — SVG inline |
| ✕ | Fermeture modale | `ui-core.js:250` | Action | Non — texte unicode acceptable |
| ✿ | Marqueur décoratif (omniprésent) | partout | Branding | **NON** — c'est l'ADN visuel du gotchi |
| 🏠 📊 📓 🎒 🎨 ⚙️ | Lignes du menu cahier | `index.html:456-481` | Navigation | **OUI** — PNG pixel art (priorité haute) |
| 🗓️ 💜 | Post-its du menu | `index.html:489, 493` | Navigation | **OUI** (pour 🗓️), garder 💜 (charge émotionnelle) |
| 🌳 🛏️ ⛰️ | Switcher d'env inventaire | `index.html:290-292` | Navigation contextuelle | **OUI** — PNG pixel art (priorité haute) |
| 💭 ✨ 🎁 ✦ | Bulles, badges IA | `ui-ai.js`, `ui-shop.js` | État/personnalité | **NON** — langage du gotchi |
| 🌟 😊 😐 😔 🌧️ | Mood picker | `ui-journal.js:89` | Action critique | **OUI** — SVG pixel art (5 faces dédiées) |
| 🌧️ 😊 😐 😔 🌟 | Affichage humeur entrées | `ui-journal.js:202` | Affichage | **OUI** (mêmes assets) |
| 🌸 ✿ | Compteur pétales / fleurs quota | `ui-shop.js:304`, `ui-settings.js:141-184` | Compteur | Non — branding |
| ⏳ 💭 🤔 😴 🌙 💤 | Messages d'attente / nuit | `ui-ai.js`, `ui-settings.js` | Personnalité | **NON** |
| 📋 📦 🗑️ ✏️ 📥 🔄 🔌 | Boutons d'action settings/inventaire | `index.html:386-404`, `ui-shop.js`, `ui-journal.js:250-251` | Action | **OUI** (priorité moyenne) — PNG pixel art |
| 🛁 🍽️ 💩 🌱 ⭐ 💤 ✅ 📓 🎁 | Icônes événements tablette | `ui-settings.js:715-727` | Affichage timeline | **OUI** (priorité basse) — PNG pixel art |
| 🪑 🎀 🌈 ✨ | Icônes filtres inventaire | `ui-shop.js:144-148` | Navigation | **OUI** — SVG pixel art |
| 🎂 | Badge anniversaire | `index.html:122` | Événement | Non — célébration |
| 🩺 🦷 👁️ 💆 🧠 🩸 💉 🤰 🐾 🎬 🍽️ ✈️ 📋 🏃 💛 🎉 📚 | Sélecteur emoji RDV agenda | `ui-agenda.js:295-302` | Catégorisation | **NON** — choix utilisateur, doit rester emoji système |
| ↑ ↓ ← → | Navigation modale habitudes / agenda | `ui-habs.js`, `ui-agenda.js:692, 692` | Action directionnelle | Non — texte acceptable |

**Résumé chiffré :**
- Emojis fonctionnels candidats au remplacement : **~25**
- Emojis "langage du gotchi" à conserver : **~30**
- Emojis "choix utilisateur" (RDV, snacks) : à conserver

### 5.2 Plan de remplacement par assets custom

#### Format cible recommandé : **PNG pixel art** (priorité haute) + **SVG inline** (priorité basse)

| Type d'icône | Format | Taille | Justification |
|---|---|---|---|
| Navigation principale (menu cahier, boutique, tablette) | PNG pixel art 24×24 @1x + 48×48 @2x | 24×24 px display | Cohérent avec le canvas p5 (image-rendering: pixelated) ; PNG gère mieux les couleurs mortes du pixel art |
| Mood picker (5 faces) | SVG inline | 24×24 px display | Permet `currentColor` pour épouser la palette utilisatrice |
| Filtres inventaire | SVG inline | 22×22 px | Réactive au thème |
| Stats cards (🔥 ⭐ 📓) | PNG pixel art 32×32 | 32×32 px | Plus expressif, animation possible |
| Événements tablette | SVG inline ou PNG 16×16 | 14×14 px | Petit, dense — SVG plus net |
| Switcher env | PNG pixel art 24×24 | 24×24 px | Doit reprendre l'esthétique des décors p5 |

#### Structure de dossier proposée

```
assets/
└── icons/
    ├── nav/                      ← navigation principale
    │   ├── menu.png              (24×24)
    │   ├── menu@2x.png           (48×48)
    │   ├── shop.png
    │   ├── tablet.png
    │   └── back.svg
    ├── menu/                     ← lignes du cahier
    │   ├── home.png
    │   ├── progress.png
    │   ├── journal.png
    │   ├── inventory.png
    │   ├── perso.png
    │   └── settings.png
    ├── env/                      ← switcher environnement
    │   ├── parc.png
    │   ├── chambre.png
    │   └── montagne.png
    ├── mood/                     ← humeurs (SVG)
    │   ├── super.svg
    │   ├── bien.svg
    │   ├── ok.svg
    │   ├── bof.svg
    │   └── dur.svg
    ├── filter/                   ← filtres inventaire (SVG)
    │   ├── all.svg
    │   ├── decor.svg
    │   ├── accessory.svg
    │   ├── ambiance.svg
    │   └── ai-creation.svg
    ├── stats/                    ← cartes stats accueil progrès
    │   ├── streak.png
    │   ├── xp.png
    │   └── journal.png
    └── action/                   ← actions secondaires (PNG 16)
        ├── edit.png
        ├── delete.png
        ├── export.png
        ├── copy.png
        └── refresh.png
```

**Convention de nommage :**
- `kebab-case` pour les fichiers
- Suffixe `@2x` pour rétina/HiDPI uniquement quand nécessaire
- Suffixe d'état dans le nom : `-active`, `-disabled` si variantes (`shop-active.png`)

### 5.3 Système d'icônes pixel art proposé

#### Comparatif des 3 options

| Option | Avantages | Inconvénients | Adapté HabitGotchi ? |
|---|---|---|---|
| **A — Sprite sheet PNG + `background-position`** | 1 seul fichier réseau, perf max | Pénible à maintenir, pas de teinte CSS, Source de vérité distante | ⚠️ Trop rigide pour une app évolutive |
| **B — SVG inline avec `currentColor`** | Hérite de la couleur, pixel-perfect avec `shape-rendering:crispEdges`, accessible | Verbeux dans le HTML/JS, gestion des fichiers (read + inject) | ✅ Idéal pour mood, filtres, actions |
| **C — `<img src="…png">` avec `image-rendering: pixelated`** | Simple, cache-friendly, mêmes assets pour ailleurs (export, doc) | Pas de teinte CSS, requête réseau par icône (mitigée par SW cache) | ✅ Idéal pour navigation et stats |

#### Recommandation

**Approche hybride C + B :**
- **PNG `<img>`** pour les icônes de **navigation** et **affichage** (menu, switcher env, stats, événements tablette). Mises en cache par le service worker au premier load.
- **SVG inline** pour les icônes **interactives à teinte dynamique** (mood picker, filtres, actions edit/delete).

**Pourquoi pas de bundler :** la stack actuelle (HTML/CSS/JS vanilla, scripts en série) ne permet pas un bundling SVG type Vite. Les SVG seront donc inlinés à la main dans des helpers JS de type `iconMood('super')` retournant la chaîne SVG.

#### CSS commun à ajouter

```css
/* Dans :root */
:root { --icon-size: 20px; }

/* Dans le bloc des composants */
.icon {
  display: inline-block;
  width: var(--icon-size);
  height: var(--icon-size);
  vertical-align: middle;
  flex-shrink: 0;
}
.icon--png {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
.icon--svg {
  fill: currentColor;
  shape-rendering: crispEdges;
}
.icon--lg { --icon-size: 32px; }
.icon--sm { --icon-size: 14px; }
```

### 5.4 Top 8 icônes prioritaires à créer

Ordre par impact visuel × fréquence d'utilisation :

| # | Icône | Format | Taille | Pourquoi prioritaire |
|---|---|---|---|---|
| 1 | **Menu cahier (6 icônes)** : home, progress, journal, inventory, perso, settings | PNG 24×24 @1x+@2x | 24 px | Vu à chaque ouverture de menu, premier point de contact navigation |
| 2 | **Mood picker (5 faces)** | SVG inline | 24 px | Action quotidienne critique, emoji système incohérent iOS/Android |
| 3 | **Switcher env (3 icônes)** : parc, chambre, montagne | PNG 24×24 | 24 px | Doit cohabiter avec décors p5, emoji actuel rompt l'esthétique |
| 4 | **Boutique (🛍️) + Tablette (📟)** header | PNG 24×24 | 24 px | Boutons de navigation persistants, premier coup d'œil |
| 5 | **Filtres inventaire (5 icônes)** | SVG inline | 22 px | Aujourd'hui caractères Unicode mal contrôlés (✿, 🪑, 🎀…) |
| 6 | **Stats cards (🔥 série, ⭐ XP, 📓 journal)** | PNG 32×32 | 32 px | 3 visualisations majeures de la page Progrès |
| 7 | **Actions edit/delete (✏️/🗑️)** | SVG inline | 16 px | Cibles tactiles agrandies, présentes dans journal+agenda+inventaire |
| 8 | **Languette menu (☰ → ✕)** | SVG inline | 22 px | Animation rotation + état clair |

### 5.5 Emojis à conserver (langage du gotchi)

Liste exhaustive **à NE PAS remplacer** par des assets techniques :

- `✿` ✦ — marqueurs floraux décoratifs (branding)
- `💭 ✨ 🌟 💜 🌸 🎁` — bulles de pensée et expressions du gotchi
- `🌙 ☀️ 🌅 🌛 🌷 🌱` — temporalité narrative (matin/nuit/saison)
- `*action*` — gestuelles entre astérisques (ex: `*bâille*`, `*sourit*`)
- `🎂` — anniversaire utilisateur (événement intime)
- Tous les emojis du **sélecteur RDV** (`ui-agenda.js:295-302`) — choix utilisatrice
- Tous les emojis du **SNACKS_POOL** (`config.js:177-193`) — choix gotchi
- Tous les emojis des **CATS** (catégories d'habitudes) — personnalisation utilisatrice

**Règle d'or :** un emoji est candidat au remplacement si ses 3 conditions sont remplies :
1. Il joue un rôle de **navigation** ou d'**action UI**
2. Il est **figé** (pas un choix utilisateur)
3. Il apparaît au moins à **2 endroits différents** de l'app

---

## SECTION 6 — Accessibilité & mobile (mis à jour)

### 6.1 Cibles tactiles (état actualisé)

| Élément | Taille effective | Fichier | Action | Statut |
|---|---|---|---|---|
| `.menu-btn` (header) | 44×44 ✓ | `style.css:218-222` | Boutique / tablette | ✅ |
| `.modal-close` | 44×44 ✓ | `style.css:1172-1191` | Fermeture modale | ✅ |
| `.nav-a` (◀▶ semaine) | 44×44 ✓ | `style.css:1105-1110` | Nav semaine | ✅ |
| `.menu-line` | 56 px haut | `style.css:495-511` | Menu | ✅ |
| `.menu-postit` | ~46 px haut | `style.css:544-558` | Agenda/Soutien | ✅ |
| Filtres ronds inventaire | 52×52 ✓ | `ui-shop.js:163` | Filtre catégorie | ✅ |
| `.mood-b` | ~~42×42~~ → **44×44** ✓ | `style.css` | Picker humeur | ✅ RÉSOLU 2026-05-01 |
| `.j-entry .j-actions button` | ~~~24 px~~ → **min 44px** ✓ | `style.css` | Édition note | ✅ RÉSOLU 2026-05-01 |
| `.btn-export` | ~~~26 px~~ → **min 44px** ✓ | `style.css` | Export journal | ✅ RÉSOLU 2026-05-01 |
| `.inv-env-btn` | ~~~30 px~~ → **min 44px** ✓ | `style.css` (externalisé) | Switcher env | ✅ RÉSOLU 2026-05-01 |
| Boutons emoji RDV (formulaire) | aspect-ratio:1, ~36 px | `ui-agenda.js:319-323` | Choix emoji | 🟠 limite |
| Chevrons SVG nav journal | padding 8 px → ~34 px | `index.html:195, 203` | Nav semaine journal | 🟠 limite |
| Boutons rdv ✏️/🗑️ | ~~font 13px~~ → **min 44×44px** ✓ | `style.css` + `ui-agenda.js:212-213` | Édit/suppr RDV | ✅ RÉSOLU 2026-05-01 |

**Toutes les cibles tactiles critiques sont résolues.** Reste : boutons emoji RDV (~36px) et chevrons journal (~34px) — limites acceptables.

### 6.2 Safe areas

| Inset | Définition actuelle | Problème |
|---|---|---|
| `--sat` | `env(safe-area-inset-top, 0px)` | ✅ correct |
| `--sab` | `0px` (en dur) | 🔴 home indicator iPhone non absorbée |
| `--sal` | `0px` (en dur) | 🟡 paysage iPhone — encoche latérale gauche |
| `--sar` | `0px` (en dur) | 🟡 idem droite |

**Fix recommandé :**
```css
:root {
  --sat: env(safe-area-inset-top, 0px);
  --sab: env(safe-area-inset-bottom, 0px);
  --sal: env(safe-area-inset-left, 0px);
  --sar: env(safe-area-inset-right, 0px);
}
```

### 6.3 `aria-live` sur les zones IA

| Élément | Mise à jour async | `aria-live` actuel | À ajouter |
|---|---|---|---|
| `#bubble` | `flashBubble()`, `updBubbleNow()`, `askClaude` | ❌ | `aria-live="polite"` |
| `#claude-msg` | `askClaude()` `ui-ai.js:256` | ❌ | `aria-live="polite"` |
| `#claude-summary` | `genBilanSemaine()` `ui-ai.js:930` | ❌ | `aria-live="polite"` |
| `#toast` | `toast()` | ❌ | `role="status"` + `aria-live="polite"` |
| `#api-status` | `testApiKey()` | ❌ | `aria-live="polite"` |

### 6.4 Comportement paysage

`body padding-left: var(--sal)` et `padding-right: var(--sar)` (`style.css:144-145`) sont câblés mais inopérants car les variables sont à 0. En paysage iPhone X+, l'encoche latérale gauche peut chevaucher la languette ou la modale. Fix : voir 6.2.

### 6.5 Parcours TDAH "cocher une habitude"

Test mental étape par étape (utilisatrice TDAH) :

1. **Ouverture app (PWA installée)** → splash icon-512 → boot ~300 ms → `#p-gotchi` affiché. ✅ rapide.
2. **Lecture du gotchi** → carte `card-gotchi` claire, nom + stade visibles, fleurs quota indiquent le quota IA restant. ✅
3. **Repérage de la prochaine habitude** → `.hab--next` glow lilac + label "Prochaine" → visible immédiatement. ✅ excellent.
4. **Tap sur la checkbox** → `.hab .ck` 24×24 (sous 44 px en cible directe, mais `.hab` entière est cliquable et fait ~44 px de haut). 🟡 OK en pratique.
5. **Animation `popBounce`** sur la `.ck` + classe `.done` ajoutée → feedback immédiat. ✅
6. **Mise à jour de la mini-bar** → le badge correspondant passe en mint. 🟡 mais pas d'animation sur le badge mini — feedback faible.
7. **Notification XP** → `toast(+15 XP)` + bulle gotchi joyeuse. ✅
8. **Quota fleurs** : ne change pas (concerne la pensée IA pas l'habitude). 🟡 pas de "récompense visuelle" pour le streak.

**Friction restante :** étape 6 (mini-bar non animée) et absence de "fête" sur compléments majeurs (3/6, 6/6). Cf. propositions C2.3 et C2.4.

---

## SECTION 7 — Roadmap design priorisée

### 7.1 Items de l'ancienne roadmap — statut actualisé

| Ancien ID | Description | Référence | Statut au 2026-05-01 |
|---|---|---|---|
| **A** | Réparer variables CSS cassées (`--c-border`, `--c-txt2`, `--sab`) | ancien `js/ui.js:808-815` → maintenant `js/ui-habs.js:139-149` ; `style.css:40` | 🔴 **TOUJOURS OUVERT** — variables fantômes inchangées, `--sab` toujours à 0px |
| **B** | Conformité tactile 44 px (.mood-b, .j-actions, .btn-export, .inv-env-btn) | `style.css:1114, 999, 1023`, `index.html:290-292` | 🔴 **TOUJOURS OUVERT** — aucun changement |
| **C** | Câbler variables sémantiques (`--success`, `--warning`, `--info`, `--focus-ring`) | `style.css:32-36, 752` | 🔄 **PARTIELLEMENT** — `--danger` câblé (`style.css:1081`, `ui-shop.js:956-961`, `ui-settings.js:273`), les 4 autres toujours mortes |
| **D** | Bulle de pensée tokenisée (`--bubble-bg`) | `style.css:300-339` | 🔴 **TOUJOURS OUVERT** — `.bubble` reste `background:#fff` hardcodé, flèche idem |
| **E** | Centraliser ouverture des modales lourdes (boutique, agenda) | ancien `ui.js:1110, 3998` → `ui-shop.js:291`, `ui-agenda.js:55` | ✅ **RÉSOLU** — `_modalCloseBtn()` exposé sur `window` (`ui-core.js:254`), utilisé par boutique/agenda/debug/voirBulles/exportObjetIA/soutien. `openModalRaw()` créé pour les cas sans ✕ auto |
| **F** | Remplacer `font-size:Xpx` inline par `--fs-*` | `js/ui.js` (~40) | 🔄 **PARTIELLEMENT** — gros nettoyage dans le CSS et la plupart des modules. Reste ~20 occurrences (ex `ui-habs.js:48,71`, `ui-ai.js:577,658`, `ui-agenda.js:312,615`, plusieurs h3 modales `font-size:13px`, `index.html:118,185`) |
| **G** | État `loading` standardisé `.btn.is-loading` | nouveau CSS + `ui-ai.js` | 🔴 **TOUJOURS OUVERT** — chaque appel IA continue avec `startThinkingAnim()` ad hoc (`ui-ai.js:39-92`) |
| **H** | Tokeniser couleurs cycle/post-it/papier hardcodées | §3.3 ancien audit | 🔴 **TOUJOURS OUVERT** — `#e07060`, `#e07080`, `#80b8e0`, `#e0708066` etc. présents dans `ui-agenda.js`, `ui-journal.js:104, 174, 205`, `ui-settings.js`. Variables `--postit-rose-bg/-fg`, `--postit-lilac-bg/-fg`, `--cycle-red`, `--paper-rule` toujours absentes |
| **I** | `aria-live="polite"` zones IA | `index.html:96, 143, 264` | 🔴 **TOUJOURS OUVERT** |
| **J** | Indicateur d'onglet courant en mode `compact` | `style.css:209-214`, `ui-nav.js:108-128` | 🔴 **TOUJOURS OUVERT** |
| **K** | Stack de retour pour modales empilées (boutique → IA) | `ui-shop.js`, `ui-ai.js` | 🔴 **TOUJOURS OUVERT** |
| **L** | Vérifier / supprimer référence à `tabletOpen` (animation manquante) | `style.css:1240` | 🔴 **TOUJOURS OUVERT** — `tabletOpen` est référencée mais aucune `@keyframes tabletOpen` n'existe |
| **M** | Supprimer `#hab-count` du HTML (display:none !important) | `index.html:151`, `style.css:635-643` | 🔴 **TOUJOURS OUVERT** — l'élément est inchangé |

### 7.2 Roadmap consolidée 2026-05-01

| Priorité | ID | Description | Fichiers | Effort | Impact TDAH |
|---|---|---|---|---|---|
| 🔴 Haute | A1 | `--c-border` / `--c-txt2` → `--border` / `--text2` | `ui-habs.js:139, 140, 145, 146` | S | Moyen (boutons réordo invisibles) |
| 🔴 Haute | A2 | `--sab: env(safe-area-inset-bottom, 0px)` (+ sal/sar) | `style.css:40-42` | S | Élevé (home indicator iPhone) |
| 🔴 Haute | B | Cibles tactiles 44 px (`.mood-b`, `.j-actions`, `.btn-export`, `.inv-env-btn`) | `style.css:1114, 999, 1023`, `index.html:290-292` | S | Élevé |
| 🔴 Haute | C-bis | `:focus-visible` → `--focus-ring` ; câbler `--success`, `--warning`, `--info` | `style.css:32-36, 752`, `ui-shop.js`, `ui-journal.js` (cycle warnings) | S | Faible (maintenance) |
| 🔴 Haute | D | Bulle pensée tokenisée `--bubble-bg` | `style.css:300, 336` | S | Moyen (cohérence palette) |
| 🔴 Haute | I | `aria-live="polite"` sur `#bubble`, `#claude-msg`, `#claude-summary` ; `role="status"` sur `#toast` | `index.html:96, 143, 264, 505` | S | Élevé (a11y screen readers) |
| 🟠 Moyenne | F | Remplacer ~20 derniers `font-size:Xpx` inline restants | `ui-habs.js:48,71`, `ui-ai.js:577,658`, `ui-agenda.js:312,615`, `index.html:118,185,…` | M | Faible (cohérence) |
| 🟠 Moyenne | G | `.btn.is-loading` standard + `aria-busy` | `style.css` (nouveau), `ui-ai.js:165-295, 300-401, 858-943` | M | Élevé (anxiété requêtes lentes) |
| 🟠 Moyenne | H1 | Tokeniser cycle : `--cycle-j1` (#e07080), `--cycle-warn` (#e07060), `--cycle-ovul` (#80b8e0) | `style.css` (nouveau), `ui-agenda.js:781-820`, `ui-journal.js:104, 174, 205`, `ui-settings.js:485-505` | M | Faible (maintenance) |
| 🟠 Moyenne | H2 | Tokeniser post-its (`--postit-rose-*`, `--postit-lilac-*`) et papier (`--paper-rule`) | `style.css:434, 446, 562, 569` | S | Faible |
| 🟠 Moyenne | J | Indicateur onglet courant en mode compact (label minuscule sous le tama) | `index.html`, `style.css`, `ui-nav.js:108-128` | S | Moyen |
| 🟠 Moyenne | M-new | Définir `--lilac-rgb` (et l'écraser dans `applyUIPalette`) ; ou retirer le fallback dans `ui-agenda.js:197` | `style.css:9-42`, `ui-settings.js:361-373` | S | Faible |
| 🟠 Moyenne | C1.1 | Languette : indicateur ouvert/fermé (rotation ☰ → ✕) | `style.css:372-396`, `ui-core.js:379-389` | S | Moyen |
| 🟠 Moyenne | C2.3 | Micro-animations validation habitude (mini-confettis pixel) | `style.css`, `ui-habs.js` | M | Élevé (récompense) |
| 🟢 Basse | C1.3 | Stack retour modales empilées | `ui-core.js`, `ui-shop.js` | L | Moyen |
| 🟢 Basse | C3.1 | Mood picker : faces SVG pixel art (lié à §5.4 prio 2) | `style.css:1114`, `ui-journal.js:89` | M | Élevé (cohérence iOS/Android) |
| 🟢 Basse | C2.1 | Carte état : nom Caveat 28px + barre XP pixel art | `index.html:117-130`, `style.css:947` | M | Faible |
| 🟢 Basse | C5.2 | 3 cartes stats avec icônes dédiées | `index.html:227-243` | S/M | Faible |
| 🟢 Basse | C6.1 | Bottom sheet états : 5 sprites pixel art au lieu de sliders | `style.css:894-944`, `ui-settings.js:1212-1268` | M | Moyen |
| 🟢 Basse | C6.3 | Toasts typés (`--success`, `--danger`, `--warning`) | `style.css:1202`, `ui-core.js:174` | S | Faible |
| 🟢 Basse | L | Supprimer / définir `@keyframes tabletOpen` | `style.css:1240` | S | Faible |
| 🟢 Basse | M | Supprimer `#hab-count` du HTML | `index.html:151`, `style.css:635-643` | S | Faible (propreté) |
| 🟢 Basse | 5.4 | Production assets icônes (8 prioritaires) | `assets/icons/` (nouveau) | L | Élevé (esthétique) |
| 🟢 Basse | E-suite | Centraliser confirmations soutien sous `_modalCloseBtn()` | `ui-ai.js:415-454` | S | Faible (cohérence) |

**Légende effort :** S < 1 h, M = 1-3 h, L > 3 h.

---

## SECTION 8 — Guide de nommage CSS (NOUVEAU)

> À ajouter en tête de `css/style.css` (juste après le commentaire de fichier).

```css
/* ============================================================
   CONVENTIONS DE NOMMAGE — HabitGotchi
   ------------------------------------------------------------
   1. VARIABLES CSS
      - --fs-*       : font-size (xs/sm/md/lg/xl)
      - --sp-*       : spacing/padding (xs/sm/md/lg/xl)
      - --r-*        : border-radius (sm/md/lg/xl)
      - --c-*        : NE PAS UTILISER — préférer le rôle direct
                       (--text, --text2, --border, --primary…)
      - --color-*    : primitives (palette brute, ne change pas)
      - --paper-*    : tokens du thème papier (journal, menu cahier)
      - --terminal-* : tokens du thème terminal (tablette)
      - --cycle-*    : tokens du cycle menstruel (j1, ovul, warn)
      - --sat/sab/sal/sar : safe-area-inset (toujours via env())

   2. CLASSES
      - .btn-{p|s|d|m}     : variantes de bouton (primary/secondary/danger/mint)
      - .btn-{role}        : boutons spécialisés (.btn-boutique, .btn-export)
      - .card / .card-*    : conteneurs cartes
      - .hab / .hab-*      : système habitudes
      - .hab--{etat}       : modificateurs BEM (.hab--next, .hab--done si nécessaire)
      - .menu-*            : éléments du menu (.menu-line, .menu-postit, .menu-book)
      - .menu-*--{variant} : modificateurs (.menu-line--indent, .menu-postit--rose)
      - .j-*               : système journal (.j-entry, .j-actions, .j-day-sep)
      - .mood-*            : humeurs (.mood-b, .mood-super, .mood-required)
      - .pin-*             : composants PIN (.pin-pad, .pin-dots, .pin-k)
      - .nav-*             : éléments de navigation (.nav-r, .nav-a)
      - .cal-*             : calendrier (.cal, .cal-c)
      - .icon              : préfixe partagé pour les icônes (.icon, .icon--lg, .icon--sm)

   3. IDENTIFIANTS DOM
      - Préfère un id seulement quand l'élément est UNIQUE et référencé en JS.
      - id = camelCase ou kebab-case court (ex: #cbox, #mbox, #hdr-title).

   4. STYLES INLINE
      - Interdits sauf cas exceptionnel (élément créé dynamiquement).
      - Toute couleur, taille, marge inline doit pointer une variable :
        style="font-size:var(--fs-sm);color:var(--text2)"
        plutôt que "font-size:13px;color:#7a5060".

   5. SAFE AREAS
      - Toujours utiliser var(--sat/sab/sal/sar) pour padding/positionnement
        des éléments fixed/sticky proches des bords.

   6. PALETTE & THÈMES
      - Une nouvelle palette UI = override des tokens couche 2 (--primary, --bg, --text…)
        pas des primitives couche 1 (--color-lilac-400…).
      - Un nouveau thème (saison, nuit) = bloc [data-theme="X"] qui override
        uniquement la couche 2 sémantique.

   7. NOMMAGE D'UNE NOUVELLE FONCTION/UTILITAIRE
      - Helper UI réutilisable : préfixé par _ s'il est interne à un module
        (_modalCloseBtn, _setInert, _fermerMenuSiOuvert).
      - Helper exposé : sans underscore (openModal, lockScroll, toast).

   8. EMOJIS vs ICÔNES
      - Emoji conservé : voix/personnalité du gotchi, choix utilisateur,
        célébration ponctuelle (anniversaire).
      - Icône custom (PNG/SVG) : navigation, action UI, mood picker, filtres.

   9. ANIMATIONS
      - @keyframes en kebab-case (popBounce → pop-bounce à terme).
      - Toujours respecter @media (prefers-reduced-motion: reduce).
      - Durée < 400 ms pour les feedbacks d'action ; < 600 ms pour les transitions de panneau.

  10. ACCESSIBILITÉ
      - Tout bouton sans texte : aria-label="…".
      - Toute zone à mise à jour async (IA, toast) : aria-live="polite".
      - Toute cible tactile : minimum 44×44 px (Apple HIG).
   ============================================================ */
```

---

## SECTION 9 — Wishlist UX

Items non priorisés, pour référence future. **À ne pas implémenter sans demande explicite.**

### Inspirations conservées de l'ancien audit

- **Finch** — État "fatigué" du compagnon qui suggère une mini-pause respirée plutôt que de cocher l'habitude. Pourrait remplacer le label `.hab--next` par un message empathique selon `D.g.energy`.
- **Bearable** — Vue "corrélations douces" : afficher un toast doux ("Tes meilleures journées contiennent souvent de la marche ✿") quand le bilan IA détecte un pattern. Pourrait s'intégrer en bas du `card-bilan`.
- **Streaks** — Visualisation "anneau de fin de journée" qui se remplit progressivement. Pourrait remplacer la barre XP plate par un anneau autour du tama dans le canvas.
- **Daylio** — Tag d'activités optionnelles à cocher après une humeur. Pourrait enrichir le mood picker du journal sans charger l'écran principal.
- **Headspace / Calm** — Sliders énergie/bonheur avec courbes hebdomadaires en `<svg>` léger dans la page Progrès, à la place ou en plus du calendrier hebdo.
- **Noom** — Confirmation par card swipe (gauche/droite) pour cocher une habitude — alternative au tap, pour les jours de fatigue motrice.
- **Habitica** — "Snooze" doux d'une habitude pour la repousser de 24 h sans casser la série. Compatible avec le pattern TDAH.

### Nouveaux items issus de cet audit

- **Mode nuit (dark theme)** — bloc `[data-theme="night"]` activable via Réglages, avec couche 2 sémantique override. Cohérent avec l'usage en soirée.
- **Thèmes saisonniers automatiques** — synchroniser `data-theme` sur la saison réelle (printemps lilas, été mint, automne corail, hiver bleu) avec opt-out dans Réglages.
- **Onboarding pixel art guidé** — au premier lancement, séquence de 3 cartes pixel art (le gotchi te présente l'app) avant le wizard nom. Plus chaleureux que la modale "Comment s'appelle ton compagnon ?".
- **Achievement micro-celebrations** — quand 7/7 jours d'une habitude dans la semaine, une animation pixel-art douce (1×) sur la carte habitudes.
- **Picker d'icône de filtre inventaire personnalisable** — ajouter ses propres tags d'objets si on en accumule beaucoup (ex: "Cadeaux d'amis", "Souvenirs vacances").
- **Réorganisation drag-and-drop des habitudes (avec feedback haptic)** — une fois les cibles tactiles 44 px en place, remplacer ↑/↓ par un drag tactile fluide. Important : conserver l'option boutons pour accessibilité motrice.
- **Bulle de pensée multi-ligne avec hiérarchie** — quand Claude renvoie un message long, afficher la première phrase en grand + les suivantes en plus petit, comme une carte de tarot.
- **Vue "Année" dans l'agenda** — heatmap 365 jours type GitHub contributions, avec couleur selon le score habitudes. Pour percevoir les patterns saisonniers.

---

*Fin de l'audit. Aucun fichier de code n'a été modifié — ce document est la source de vérité pour la prochaine itération design.*
