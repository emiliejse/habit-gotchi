# AUDIT_DESIGN.md — HabitGotchi v4.5

Audit design / CSS / accessibilité — **lecture seule**.
Périmètre : `css/style.css`, `index.html`, parties HTML de `js/ui.js`.
Hors périmètre : `render.js`, `envs.js`, logique JS pure.

Date de l'audit : 2026-04-30.

---

## SECTION 0 — Résumé exécutif

### Tableau de scores

| # | Catégorie | Note | Justification |
|---|---|:---:|---|
| 1 | Hiérarchie visuelle | **B** | Tokens typographiques cohérents (`--fs-*`), titres `--font-title` bien posés, mais beaucoup d'inline `font-size:12px / 13px / 11px` court-circuitent l'échelle. |
| 2 | Navigation & orientation | **B+** | Menu cahier original et lisible, état `active` clair, post-its séparés. Pas de breadcrumb sur les modales empilées (boutique → IA → confirmation). |
| 3 | Cohérence graphique | **C+** | 7 variables CSS définies mais **jamais utilisées** (`--success`, `--warning`, `--info`, `--focus-ring`, `--fs-xl`, `--sp-xl`, `--paper-book-line`) + 2 variables **utilisées mais non définies** (`--c-border`, `--c-txt2`) → règles CSS silencieusement cassées. Hardcoded colors fréquents en JS. |
| 4 | Lisibilité & typographie | **B** | Échelle 11→22 px solide, italics gotchi distinctifs, mais résidus `font-size:12px` et `font-size:9px` historiques en plusieurs endroits. |
| 5 | Feedback & états interactifs | **B** | `:active` partout, `:focus-visible` global, `.btn:disabled` traité. `:hover` rare (mobile-first assumé), pas d'état `loading` standardisé, animations correctes. |
| 6 | Accessibilité mobile | **C** | `aria-label` présent sur les boutons sans texte. Mais cibles tactiles **sous 44 px** dans : `.mood-b` (42×42), j-actions (✏️/🗑️ ~24 px), `.inv-env-btn` (~30 px de haut), `.btn-export` (~26 px). |
| 7 | Adaptation TDAH | **A−** | Mini-bar habitudes, `.hab--next`, fleurs de quota visibles, `prefers-reduced-motion` respecté, settings collapsibles, animations < 400 ms. Très bien pour un projet personnel. Quelques modales empilées posent encore une légère charge. |

### Top 3 problèmes urgents

1. **🔴 Variables CSS fantômes utilisées dans `ui.js`**
   `js/ui.js:808-815` (`deplacerHab` — boutons ↑/↓ de la modale d'édition des habitudes) utilise `var(--c-border)` et `var(--c-txt2)` qui ne sont **définies nulle part** dans `:root`. Résultat : la bordure et la couleur de texte tombent sur la valeur par défaut du navigateur (`currentColor` / `transparent`) → boutons quasi invisibles selon palette.
   *Impact TDAH :* contrôles de réordonnancement illisibles → frustration sur une action déjà secondaire.
   *Suggestion :* remplacer par `var(--border)` et `var(--text2)`.

2. **🔴 Bulle de pensée verrouillée en blanc, ignore les palettes**
   `css/style.css:300-339` (`.bubble`, `.bubble::before`) impose `background:#fff` et un `border-bottom:8px solid #fff` pour la flèche. Les palettes claires ou éventuelles palettes sombres futures perdent toute hiérarchie tama / bulle.
   *Impact TDAH :* texte du gotchi peut devenir gris pâle sur blanc selon la palette ; `chat-bubble-claude` (`#f0e8ff`) est cohérent avec `--lilac`, mais la bulle principale ne respecte plus le système de tokens.
   *Suggestion :* `background:var(--solid)` (ou nouvelle var `--bubble-bg`), même chose dans `::before`.

3. **🟠 Cibles tactiles sous 44 px sur des actions fréquentes**
   - `.mood-b` (`css/style.css:1094`) : 42×42 px → 5 boutons d'humeur tapotés à chaque entrée de journal.
   - `.j-entry .j-actions button` (`css/style.css:979`) : `padding:2px 8px; font-size:var(--fs-xs)` → ✏️ et 🗑️ font ~24 px de haut, à côté l'un de l'autre, gap 4 px → erreurs de tap garanties.
   - `.btn-export` (`css/style.css:1003`) : `padding:5px 14px` → ~26 px de haut.
   - `.inv-env-btn` (inline, `index.html:366-368`) : `padding:5px 4px; font-size:var(--fs-xs)` → ~30 px.
   *Impact TDAH :* taps ratés = re-tap = perte de focus et frustration.
   *Suggestion :* normaliser `.mood-b` à 44×44, doubler la zone de tap des `.j-actions` (44 px de haut, gap 8 px).

### Top 3 quick wins design

1. **🟢 Supprimer ou utiliser les variables sémantiques mortes**
   `--success`, `--warning`, `--info`, `--focus-ring` (`css/style.css:32-36`) ne sont référencées nulle part. Soit les câbler (ex. `.btn-m` → `--success`, focus-ring de `:focus-visible` → `--focus-ring` au lieu de `--lilac` hardcodée), soit les retirer pour ne pas mentir au lecteur·ice.
   *Effort : S — Impact maintenance : élevé.*

2. **🟢 Centraliser le bouton ✕ de fermeture des modales**
   `ouvrirBoutique()` et `ouvrirAgenda()` (lignes 1110-1114 et 3998-4002 de `ui.js`) recodent un `✕` inline avec `min-width:44px;min-height:44px` au lieu d'utiliser `_modalCloseBtn()` + `.modal-close` du CSS. Trois implémentations divergentes coexistent.
   *Effort : S — Impact cohérence : élevé.*

3. **🟢 Remplacer `#a09880`, `#e07080`, `#e07060`, `#38304a` par des tokens**
   Couleurs paper / cycle / texte hardcodées 4-8 fois en HTML inline + ui.js (cf. tableau §3.3). Une variable `--cycle-red` / `--paper-text-soft` éviterait les divergences quand on change de palette.
   *Effort : S/M — Impact cohérence : élevé.*

---

## SECTION 1 — Inventaire de l'interface

### 1.1 Panneaux principaux (onglets `.pnl`)

| ID | Déclencheur | Contenu | Actions disponibles |
|---|---|---|---|
| `#p-gotchi` | défaut + menu Accueil | Carte état (nom/stade/XP) + zone Claude (pensée IA, fleurs quota) + carte habitudes (mini-bar 6 ronds + liste) | Cocher habitude, demander pensée, info quota, personnaliser habitudes |
| `#p-progress` | menu Progrès | Stats 3 cellules (série/XP/journal) + calendrier hebdo + bilan IA | Naviguer semaines, ouvrir détail jour, générer/copier bilan |
| `#p-journal` | menu Journal | PIN gate ou contenu (mood picker, textarea, fleurs quota, accordéon entrées) | Saisir PIN, choisir humeur, écrire, sauver, naviguer semaines, exporter, éditer/supprimer entrée |
| `#p-props` | menu Inventaire | Switcher env (3 boutons) + filtres ronds + section actifs + section rangés | Filtrer, activer/ranger objet, tout ranger, supprimer IA, long-press export |
| `#p-perso` | menu Perso | 3 cartes : palette UI / couleur gotchi / ambiance env | Sélectionner palette/couleur/ambiance |
| `#p-settings` | menu Réglages | 3 `<details>` collapsibles : Compte / Données / Avancé | Saisir nom, clé API, PIN, code, exporter, importer, MAJ, reset, debug |

### 1.2 Modales

Trois mécanismes coexistent — point de friction architectural mineur.

| Nom | Déclencheur | Contenu | Mécanisme |
|---|---|---|---|
| Modale info / confirm générique | `toastModal()`, `openModal()` | Texte + boutons OK/Annuler | `#modal` + `#mbox.innerHTML` (centralisé) |
| Boutique | tap 🛍️ | Onglets Catalogue / Créations IA, liste pétales | `#mbox.innerHTML` direct (non `openModal()`) + classes `.shop-open .shop-catalogue` |
| Agenda | tap titre `#hdr-title` ou post-it menu | Onglets Jour / Mois / Cycle | `#mbox.innerHTML` direct + classes `.shop-open .agenda-open` |
| Édition habitudes | bouton "✏️ Personnaliser" | Liste inputs + ↑/↓ | `openModal()` |
| Confirmation soutien | bouton 💜 du menu | Mini canvas p5 + 2 boutons | `#mbox.innerHTML` direct |
| Chat soutien IA | confirmation OK | Bulles user/Claude/system | `#mbox.innerHTML` direct |
| Sliders énergie/bonheur | tap canvas badges | Bottom sheet `slideUp` | overlay séparé `#etats-overlay` créé dynamiquement |
| Tablette terminal | tap 📟 | Liste événements `tablet-line` | overlay séparé `#tablet-overlay` |
| Menu | tap ☰ | Cahier d'ado | overlay dédié `#menu-overlay` |

Le système est fragmenté : `openModal()` + 6 appels directs `mbox.innerHTML = ...` + 3 overlays séparés. Conséquence : `_modalCloseBtn()` n'est appliqué que par `openModal()`, donc tous les autres recodent leur ✕ à la main → code dupliqué + variations.

### 1.3 HUD canvas (zone p5.js)

Dans `.tama-screen` (`#cbox`), 1:1, bordure 3 px lilas, dithering pixel art. Les badges énergie/bonheur sont **dessinés dans le canvas** (cf. commentaire `index.html:143`), avec interaction tap → `ouvrirModalEtats()`. Hors périmètre design détaillé, mais les sliders qu'il ouvre sont stylés dans `style.css:874-924`.

### 1.4 Navigation

- **Languette** `.menu-languette` fixed bottom : ouvre le `#menu-overlay`. Pas d'état "open/closed" visible sur la languette — petit accroc UX, mais l'animation `bookSlideUp` du cahier compense.
- **Cahier** : 6 lignes en quinconce (`.menu-line` / `.menu-line--indent`) + 2 post-its (Agenda, Soutien). Pas de bouton `Fermer` — clic à côté ferme. Lisible.
- **État actif** : `.menu-line.active` (lilas + surlignage stabilo) — cohérent.
- **Pas de bouton "retour" sur les modales empilées** (boutique → confirmation → résultat). Seul ✕ ferme tout.

---

## SECTION 2 — Audit par catégorie

### 2.1 Hiérarchie visuelle

#### 🟠 IMPORTANT — `font-size` inline qui contournent l'échelle
`js/ui.js` contient ~40 occurrences de `font-size:12px`, `font-size:13px`, `font-size:11px`, `font-size:10px` inline, alors que `--fs-xs/sm/md/lg` couvrent ces tailles. Exemples : `index.html:194` (nom du gotchi en `font-size:16px` inline alors que `#g-name` est défini par `--font-title`), `index.html:261` (textarea journal `font-size:12px`), `js/ui.js:717` (label habitude `font-size:12px`). La plupart datent d'avant la création de l'échelle.
*Impact :* quand `--fs-sm` est ajusté, ces occurrences ne suivent pas → dérive silencieuse.
*Suggestion :* remplacer toutes les valeurs px directes des polices par `var(--fs-*)`.

#### 🟡 MINEUR — Doublon de règle `.modal-box`
`css/style.css:1135` et `css/style.css:1303` redéfinissent `.modal-box`. Le second bloc (word-break) a été ajouté plus tard ; comme indiqué dans le commentaire ligne 1302, les deux propriétés flottaient hors règle. Aujourd'hui c'est OK mais lecture confuse.
*Suggestion :* fusionner dans le bloc principal.

#### ✅ RÉSOLU — Échelle typographique
`--fs-xs/sm/md/lg/xl` introduits avec un commentaire clair sur le plancher de lisibilité. Adoption partielle mais réelle dans le CSS principal.

### 2.2 Navigation & orientation

#### 🟠 IMPORTANT — Pas d'indicateur d'onglet courant en dehors du menu
`#p-gotchi.on` etc. n'ont pas de retour visuel hors du menu. Quand le menu est fermé, rien ne signale "tu es sur Progrès". Pour TDAH ouvrant l'app après notification, perte de contexte possible.
*Suggestion :* persistant léger (titre dans header `compact` ou subtle indicateur sous la languette).

#### 🟡 MINEUR — Languette muette
`.menu-languette` n'a pas d'état "ouvert" (rotation, changement d'icône). Pas critique mais symbolique — la languette est la même qu'on ait ou non le menu ouvert.

### 2.3 Cohérence graphique

#### 🔴 CRITIQUE — Variables CSS utilisées mais **non définies**
`js/ui.js:808-815` utilise `var(--c-border)` et `var(--c-txt2)`. Aucun `:root` ne les déclare. Les boutons de réordonnancement de la modale "✏️ Mes habitudes" perdent bordure et couleur de texte selon la palette.
*Suggestion :* `var(--border)` + `var(--text2)`.

#### 🟠 IMPORTANT — Variables CSS sémantiques **définies mais jamais utilisées**
`--success`, `--warning`, `--info`, `--focus-ring` (`css/style.css:32-36`), `--fs-xl`, `--sp-xl`, `--paper-book-line`. Trompe le lecteur·ice : on croit que `--focus-ring` pilote `:focus-visible` mais c'est `--lilac` en dur (`css/style.css:739`).
*Suggestion :* (a) câbler `--focus-ring` dans `:focus-visible`, (b) utiliser `--success` dans `.btn-m` ou pour les états validés (mini-bar `.done`), (c) supprimer `--fs-xl`/`--sp-xl` si vraiment non nécessaires.

#### 🟠 IMPORTANT — Couleurs hardcodées dans le HTML inline JS
Très étalé. Cf. §3.3.

#### 🟡 MINEUR — Trois mécanismes d'ouverture de modale
`openModal()` / `mbox.innerHTML = ...` / overlays séparés (`#etats-overlay`, `#tablet-overlay`). Chaque variante recode son ✕, son `lockScroll`, son `animEl`. Pas critique aujourd'hui mais source de divergences (ex : seul `openModal` injecte `_modalCloseBtn()`).

### 2.4 Lisibilité & typographie

#### 🟡 MINEUR — Italic 300 sur certaines polices d'OS
`var(--font-gotchi)` → Nunito 300 italic est demandé dans Google Fonts (`index.html:121`). OK. Mais sur les `.chat-bubble-system` (`style.css:363-366`) la classe utilise `font-style:italic` sans préciser le poids → tombera sur 400 ; cohérent avec un message système secondaire mais à confirmer comme intentionnel.

#### 🟡 MINEUR — Police de la `bubble` figée
La bulle principale est en italic 300, ce qui marche très bien. Mais aucune option d'augmentation de taille — utile si malvoyance / fatigue. Pas urgent.

#### ✅ RÉSOLU — Reset typographique des `<input>`/`<button>`
`css/style.css:114-116` force `font-family:inherit` — résout l'héritage de Courier System par défaut sur iOS. Excellente prise en compte.

### 2.5 Feedback & états interactifs

#### 🟠 IMPORTANT — Pas d'état `loading` standardisé
Plusieurs requêtes API (Claude pensée, soutien, bilan) affichent `💭` (`js/ui.js:2100`) ou `⏳` (`js/ui.js:651`) ad hoc. Pas de spinner, pas de classe `.is-loading` réutilisable, pas de `aria-busy`.
*Impact TDAH :* pendant un appel IA lent, l'utilisatrice ignore si le tap a été pris en compte → re-clic → erreur.
*Suggestion :* ajouter une classe `.btn.is-loading` avec un pseudo-élément `::after` rotatif et désactivation du `pointer-events`.

#### 🟡 MINEUR — `:hover` quasi inexistant
Choisi (mobile first), mais sur Chrome desktop / iPad pointer, ça donne une sensation "froide". `.modal-close:hover` existe (style.css:1163), `.btn-info-discret:hover` aussi — pas le reste.

#### ✅ RÉSOLU — `:focus-visible` global
`css/style.css:732-741` couvre `.btn`, `.menu-btn`, `.menu-circle`, `.nav-a`, `.pin-k`, `.inp`, `.mood-b`. Bonne base d'accessibilité clavier.

#### ✅ RÉSOLU — `.btn:disabled`
`css/style.css:749-753` : opacité 0.45 + `cursor:not-allowed` + `transform:none !important` désactive l'animation `:active`. Critère TDAH satisfait.

### 2.6 Accessibilité mobile

#### 🔴 CRITIQUE — Cibles tactiles sous 44 px sur des actions fréquentes
| Élément | Taille effective | Fichier | Action |
|---|---|---|---|
| `.mood-b` | 42×42 px | `css/style.css:1094` | Choisir humeur (chaque entrée journal) |
| `.j-entry .j-actions button` | ~24 px haut | `css/style.css:979-982` | Éditer/supprimer une note |
| `.btn-export` | ~26 px haut | `css/style.css:1003` | Exporter journal |
| `.inv-env-btn` | ~30 px haut | inline `index.html:366-368` | Switcher d'environnement (3 boutons) |
| Filtres ronds inventaire | 52×52 px ✓ | `js/ui.js:977` | OK |
| `.menu-btn`, `.modal-close`, `.nav-a` | 44×44 px ✓ | style.css | OK |

*Suggestion :* normaliser à 44×44 px (ou 40 px **avec** zone de tap virtuelle via `padding`).

#### 🟠 IMPORTANT — Safe area inset bottom seulement partielle
`--sab` est défini à `0px` en dur dans `:root` (`style.css:40`) puis utilisé dans `padding-bottom` du `.menu-languette`, `#dynamic-zone`, `#toast`. Or `--sab` lui-même **n'est jamais réécrit avec `env()`** — seul `--sat` l'est (`style.css:39`). Donc tout le code qui fait `var(--sab)` recevra toujours 0 → la home indicator iPhone peut chevaucher la languette.
*Suggestion :* `--sab: env(safe-area-inset-bottom, 0px);` dans `:root` (cohérent avec `--sat`). Idem pour `--sal`/`--sar` (mode paysage).

#### 🟠 IMPORTANT — `aria-live` absent sur les zones IA
`#claude-msg`, `#bubble`, `#claude-summary` se mettent à jour de manière asynchrone (réponses Claude) sans `aria-live="polite"`. Lecteur d'écran silencieux.
*Suggestion :* ajouter `aria-live="polite"` sur `#claude-msg` et `#bubble`.

#### 🟡 MINEUR — `<input type="text" id="cheat-input">` sans `inputmode`
`index.html:448` — pas de `inputmode` → clavier QWERTY complet sur iOS, alors que les codes sont alphanumériques courts. Mineur.

### 2.7 Adaptation TDAH

#### 🟠 IMPORTANT — Empilement de modales sans breadcrumb
Boutique → tap "✨ Demander à X" → modale de loading → modale résultat IA. Chaque modale écrase `#mbox.innerHTML`. Un retour en arrière n'est pas possible — seul ✕ ferme tout.
*Impact :* perte de contexte, surtout si la requête échoue.
*Suggestion :* à terme, garder une stack légère ou un `data-back="boutique"` pour proposer "← Retour à la boutique".

#### 🟡 MINEUR — Densité visuelle de l'inventaire
Switcher env (3 boutons) + filtres ronds (5 boutons) + bandeau actif + bandeau rangés + grille 3 colonnes : c'est beaucoup d'information en haut d'écran. Aujourd'hui ça reste lisible grâce aux séparateurs, mais c'est limite.

#### ✅ RÉSOLU — `prefers-reduced-motion`
`css/style.css:1334-1339` désactive proprement animations et transitions. Critique pour TDAH/troubles vestibulaires.

#### ✅ RÉSOLU — `.hab--next` (Prochaine habitude)
Glow + label "Prochaine" — réduit le coût décisionnel au démarrage. Implémentation propre (`css/style.css:843-867`).

#### ✅ RÉSOLU — Mini-bar visuelle des habitudes
6 ronds en haut de la carte habitudes — vue d'ensemble instantanée non-cliquable. Excellent pour TDAH.

#### ✅ RÉSOLU — Settings collapsibles
`<details class="settings-section">` — ferme la surcharge décisionnelle.

#### ✅ RÉSOLU — Fleurs de quota
`#thought-count`, `#bilan-flowers`, `#journal-flowers` — feedback visuel immédiat sur ce qui reste, sans chiffres anxiogènes.

---

## SECTION 3 — Variables CSS

### 3.1 Tokens définis dans `:root` (`css/style.css:9-100`)

| Groupe | Variables |
|---|---|
| **Palette** | `--bg`, `--card`, `--solid`, `--pink`, `--lilac`, `--mint`, `--peach`, `--sky`, `--coral`, `--gold`, `--tama` |
| **Texte / structure** | `--text`, `--text2`, `--border`, `--shadow` |
| **Sémantiques** | `--success`, `--danger`, `--warning`, `--info`, `--focus-ring` |
| **Safe areas** | `--sat`, `--sab`, `--sal`, `--sar` |
| **Polices** | `--font-terminal`, `--font-title`, `--font-gotchi`, `--font-body` |
| **Échelle typo** | `--fs-xs` (11), `--fs-sm` (13), `--fs-md` (15), `--fs-lg` (18), `--fs-xl` (22) |
| **Espacements** | `--sp-xs` (4), `--sp-sm` (8), `--sp-md` (12), `--sp-lg` (16), `--sp-xl` (24), `--app-gutter` (14) |
| **Border radius** | `--r-sm` (6), `--r-md` (10), `--r-lg` (14), `--r-xl` (20) |
| **Thème papier** | `--paper-bg`, `--paper-border`, `--paper-text`, `--paper-entry`, `--paper-entry-ts`, `--paper-entry-btn`, `--paper-book-bg`, `--paper-book-border`, `--paper-book-shadow`, `--paper-book-line` |
| **Thème terminal** | `--terminal-box`, `--terminal-border`, `--terminal-screen`, `--terminal-screen-border`, `--terminal-text`, `--terminal-text-dim`, `--terminal-line-div` |

### 3.2 Variables peu utilisées ou orphelines

| Variable | Statut | Détail |
|---|---|---|
| `--success` | 🔴 Définie, jamais utilisée | À câbler (`.btn-m`, mini-bar `.done`) ou supprimer |
| `--warning` | 🔴 Définie, jamais utilisée | À câbler ou supprimer |
| `--info` | 🔴 Définie, jamais utilisée | À câbler ou supprimer |
| `--focus-ring` | 🔴 Définie, jamais utilisée | `:focus-visible` utilise `--lilac` en dur — à corriger |
| `--fs-xl` | 🟠 Définie, jamais utilisée | Aucun titre de panneau ne l'applique vraiment |
| `--sp-xl` | 🟠 Définie, jamais utilisée | Marges entre blocs majeurs : à utiliser ou retirer |
| `--paper-book-line` | 🟠 Définie, jamais utilisée | Probablement supplantée par le `repeating-linear-gradient` du cahier |
| `--c-border` | 🔴 **Utilisée mais non définie** | `js/ui.js:808, 814` |
| `--c-txt2` | 🔴 **Utilisée mais non définie** | `js/ui.js:809, 815` |
| `--lilac-rgb` | 🟡 Référencée avec fallback | `js/ui.js:4126` `rgba(var(--lilac-rgb, 180,160,230),0.07)` — non définie, fallback systématique |

### 3.3 Couleurs encore hardcodées

| Fichier | Couleur | Sélecteur / contexte | Variable cible recommandée |
|---|---|---|---|
| `css/style.css:424` | `#c8d8f0` | `.menu-book` lignes du cahier | nouveau token `--paper-rule` |
| `css/style.css:436` | `#e09090` | `.menu-book::before` reliure rouge | nouveau token ou `--coral` |
| `css/style.css:446` | `#d4c4a8` | trous de reliure | `--paper-border` ou nouveau token |
| `css/style.css:552` | `#f9c8dc`, `#7a2848` | `.menu-postit--rose` | tokens `--postit-rose-bg/-fg` |
| `css/style.css:558` | `#d8bef5`, `#3d1f6e` | `.menu-postit--lilac` | tokens `--postit-lilac-bg/-fg` |
| `index.html:50, 60-62` | `#1a1a1a`, `#0f0`, `#0066cc`, `#aa4444` | panneau debug PWA inline | acceptable (debug only) |
| `index.html:204` | `rgba(0,0,0,0.06)` | `#xp-b` background | `--border` ou nouveau `--track-bg` |
| `index.html:245, 265` | `#a09880` | `pin-msg`, `v-status` | `--paper-entry-ts` (déjà = `#a09880`) |
| `index.html:261` | `#faf6f0`, `#c8b8a0` | `#j-text` textarea inline | `--paper-entry`, `--paper-border` |
| `index.html:340` | `rgba(176,144,208,.07)` | `#claude-summary` | nouveau `--lilac-soft` |
| `js/ui.js:366` | `#38304a`, `#fff` | `toastSnack` background | `--text` foncé / `--solid` |
| `js/ui.js:659` | `#81c784` | message API "Connecté" | `--success` (à câbler) |
| `js/ui.js:883` | `#f07` (fallback de `--coral`) | badge NEW | OK avec fallback |
| `js/ui.js:898` | `#e33` | ✕ suppression IA | `--danger` |
| `js/ui.js:1067` | `#f55` (fallback de `--coral`) | bouton "Supprimer" actif | OK |
| `js/ui.js:2223` | `#ffffff` | mini canvas soutien | `--solid` |
| `js/ui.js:2895, 2966` | `#e07060` | warnings / quota dépassé | `--coral` ou nouveau `--cycle-red` |
| `js/ui.js:2996` | `#a09880` | message "aucune entrée" | `--paper-entry-ts` |
| `js/ui.js:3199` | `rgba(80,${g},120,${alpha})` | gradient calendrier hebdo | acceptable (calcul dynamique) |
| `js/ui.js:3233, 4747, 4800` | `#e07080` | indicateur cycle J1 | nouveau token `--cycle-red` |
| `js/ui.js:3457` | `#007a1f` | terminal dim | `--terminal-text-dim` (existe !) |
| `js/ui.js:4463, 4506` | `#fff8f8` | confirm-inline danger bg | nouveau `--danger-soft` |
| `index.html:103` | `#ddd6e8` | `<meta theme-color>` | impossible à variabiliser, mais à synchroniser avec `--bg` par défaut |

### 3.4 Animations

| Nom | Durée | État | Note |
|---|---|---|---|
| `popBounce` (`.hab.done .ck`) | 0.4s | ✅ OK | Bounce satisfaisant, `cubic-bezier` propre |
| `fu` (`.pnl`) | 0.2s | ✅ OK | Fade up discret |
| `modalPop` | 0.22s | ✅ OK | Évite le clipping `scale + overflow` (commentaire l'explique bien) |
| `bookSlideUp` | 0.35s | ✅ OK | Cohérent avec l'esthétique cahier |
| `shopOpen` | 0.35s | ✅ OK | |
| `tabletOpen` | 0.2s (référencée style.css:1209) | 🟡 À revoir | Aucune `@keyframes tabletOpen` détectée dans `style.css` — animation silencieuse |
| `tamaSway` / `tamaSwayStrong` | 1.4s / 0.9s | ✅ OK | |
| `jEntryFadeIn` | 0.25s | ✅ OK | |
| `shakeRow` | 0.4s | ✅ OK | Feedback humeur requise |
| `slideUp` (etats sheet) | 0.25s | ✅ OK | |

`@media (prefers-reduced-motion: reduce)` neutralise tout (✅ `style.css:1334-1339`).

---

## SECTION 4 — Layout

### 4.1 Structure globale

```
<body> (flex column, padding-top:--sat)
├── #console-top (fixed top, z:50, padding latéral --app-gutter)
│   ├── .hdr (boutique | titre | tablette)
│   └── #tama-bubble-wrap
│       ├── .tama-shell #tama-shell-main (canvas p5)
│       └── .bubble
├── #dynamic-zone (flex:1, scroll, max-width:460, centré)
│   └── 6 panneaux .pnl (un seul .on à la fois)
├── .menu-languette (fixed bottom, z:150)
├── #menu-overlay (fixed, z:200)
├── #modal (fixed, z:300)
├── #toast (fixed, z:500)
├── #tablet-overlay (fixed, z:400)
└── overlay etats créé dynamiquement (z:1000)
```

`#console-top.compact` (déclenché quand on quitte l'accueil) cache le `#hdr-title`, recompacte le tama (220 px max), garde les boutons. Bien pensé.

### 4.2 Scroll

- `#dynamic-zone` : zone scrollable principale, `padding-top:320px` fallback avant `syncConsoleHeight()` JS — risque de FOUC ~100 ms au boot. Acceptable.
- `.modal-box` : `max-height:85dvh; overflow-y:auto; touch-action:pan-y` — bon réflexe pour ne pas bloquer le scroll mobile.
- `#boutique-contenu` et `#agenda-contenu` : scrollbar masquée (`scrollbar-width:none; ::-webkit-scrollbar{display:none}`) — esthétique mais perte d'indication "il y a plus à voir". Compensé par `touch-action:pan-y` ; sur desktop on perd tout signal.
- `.soutien-chat` : `max-height:50vh; overflow-y:auto` — OK.
- `#tablet-screen` : `overflow-y:auto` — OK.

### 4.3 Safe areas

| Inset | État | Détail |
|---|---|---|
| `--sat` | ✅ OK | Défini avec `env(safe-area-inset-top, 0px)`, utilisé dans `body`, `#console-top`, `#update-banner`, `#tablet-overlay` |
| `--sab` | 🟠 À corriger | **Défini en dur à `0px`**, jamais avec `env()` → tout `var(--sab)` retourne 0. Cf. §2.6. Utilisé dans `#dynamic-zone`, `.menu-languette`, `#toast` — perd l'inset bottom des iPhones avec home indicator. |
| `--sal` | 🟡 Stub | Défini à 0 px. Utilisé dans `body padding-left`. Pas grave en portrait, mais en paysage iPhone l'encoche latérale n'est pas absorbée. |
| `--sar` | 🟡 Stub | Idem. |

**Fix prioritaire :** `--sab: env(safe-area-inset-bottom, 0px);` (et idéalement `--sal`/`--sar` aussi).

---

## SECTION 5 — Roadmap design priorisée

### Priorité haute

**A. Réparer les variables CSS cassées**
Fichiers : `js/ui.js:808-815`, `css/style.css:40` (`--sab`)
Effort : **S**
Impact TDAH : moyen (boutons réordo invisibles, safe area iPhone perdue)
Détail : remplacer `--c-border`/`--c-txt2` par `--border`/`--text2`, et passer `--sab` à `env(safe-area-inset-bottom, 0px)`. Définir aussi `--sal`/`--sar` avec `env()`.

**B. Conformité tactile 44 px**
Fichiers : `css/style.css:1094` (`.mood-b`), `css/style.css:979-982` (`.j-actions button`), `css/style.css:1003` (`.btn-export`), `index.html:366-368` (`.inv-env-btn` inline)
Effort : **S**
Impact TDAH : élevé (taps ratés sur actions quotidiennes)

**C. Corriger / câbler les variables sémantiques**
Fichiers : `css/style.css:32-36`, `css/style.css:739`
Effort : **S**
Impact TDAH : faible direct, élevé en maintenance
Détail : faire pointer `:focus-visible` vers `--focus-ring`, brancher `--success` sur `.btn-m` et l'état "Connecté", supprimer `--warning`/`--info` si vraiment inutiles ou les utiliser pour les warnings cycle / quotas.

### Priorité moyenne

**D. Bulle de pensée tokenisée**
Fichiers : `css/style.css:300-339`
Effort : **S**
Impact TDAH : moyen (cohérence palette)
Détail : `--bubble-bg` (default `var(--solid)`), appliqué à `.bubble` et `.bubble::before`.

**E. Centraliser l'ouverture des modales lourdes**
Fichiers : `js/ui.js:1110-1142` (`ouvrirBoutique`), `js/ui.js:3998-4022` (`ouvrirAgenda`)
Effort : **M**
Impact : cohérence + maintenabilité
Détail : passer ces deux modales par `openModal()` ou créer `openShopModal()` qui injecte le ✕ standard et retire le ✕ inline dupliqué.

**F. Remplacer les `font-size:Xpx` inline par les tokens `--fs-*`**
Fichiers : `js/ui.js` (~40 occurrences), `index.html` (résidus)
Effort : **M**
Impact : cohérence typo

**G. État `loading` standardisé**
Fichiers : `css/style.css` (nouvelle classe `.btn.is-loading`), `js/ui.js` (toutes les fonctions IA)
Effort : **M**
Impact TDAH : élevé (anxiété pendant requête lente)

### Priorité basse

**H. Tokeniser les couleurs cycle/post-it/papier hardcodées** (cf. §3.3)
Effort : **M** | Impact : maintenance

**I. `aria-live="polite"` sur les zones IA**
Fichiers : `index.html:172` (`#bubble`), `index.html:219` (`#claude-msg`), `index.html:340` (`#claude-summary`)
Effort : **S** | Impact : a11y screen readers

**J. Indicateur d'onglet courant en mode `compact`**
Effort : **S** | Impact TDAH : moyen

**K. Stack de retour pour les modales empilées (boutique → IA)**
Effort : **L** | Impact TDAH : moyen

**L. Vérifier / supprimer la référence à `tabletOpen`** (animation manquante)
Effort : **S** | Impact : visuel (animation silencieuse)

**M. Supprimer `#hab-count` du HTML**
`index.html:227`, `css/style.css:625-633` — l'élément existe mais a `display:none !important`. Code mort.
Effort : **S** | Impact : propreté

---

## SECTION 6 — Wishlist UX (inspirations)

Items non priorisés, pour référence future. **À ne pas implémenter sans demande explicite.**

- **Finch** — État "fatigué" du compagnon qui suggère une mini-pause respirée plutôt que de cocher l'habitude. Pourrait remplacer le label `.hab--next` par un message empathique selon `D.g.energy`.
- **Bearable** — Vue "corrélations douces" : afficher un toast doux ("Tes meilleures journées contiennent souvent de la marche ✿") quand le bilan IA détecte un pattern. Pourrait s'intégrer en bas du `card-bilan`.
- **Streaks** — Visualisation "anneau de fin de journée" qui se remplit progressivement. Pourrait remplacer la barre XP plate par un anneau autour du tama dans le canvas.
- **Daylio** — Tag d'activités optionnelles à cocher après une humeur. Pourrait enrichir le mood picker du journal sans charger l'écran principal.
- **Headspace / Calm** — Sliders énergie/bonheur avec courbes hebdomadaires en `<svg>` léger dans la page Progrès, à la place ou en plus du calendrier hebdo.
- **Noom** — Confirmation par card swipe (gauche/droite) pour cocher une habitude — alternative au tap, pour les jours de fatigue motrice.
- **Habitica** — "Snooze" doux d'une habitude pour la repousser de 24 h sans casser la série. Compatible avec le pattern TDAH.

---

*Fin de l'audit. Aucun fichier de code modifié.*
