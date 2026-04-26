# AUDIT DESIGN HabitGotchi — mis à jour 2026-04-26

> Audit initial réalisé en v3.02. Document mis à jour en v3.15 pour refléter les améliorations apportées lors des sessions D1–D7 et les correctifs post-test. Les items ✅ sont résolus. Les items ouverts restent actifs.

---

## 0. Résumé exécutif

### Score par catégorie (état actuel v3.15)

| Catégorie | Note initiale | Note actuelle | Delta |
|---|---|---|---|
| Hiérarchie visuelle | C | B− | ↑ Échelle typo + `.hab--next` |
| Navigation & orientation | B− | B | ↑ `.menu-circle.active` + ✕ modales |
| Cohérence graphique | C | C+ | ↑ Variables sémantiques ; universel carnet/terminal non unifié |
| Lisibilité & typographie | D | B− | ↑ Plancher 13px, variables `--fs-*`, `--text2` foncé |
| Feedback & états interactifs | B− | B | ↑ `:focus-visible`, `.btn:disabled`, `.hab--next` |
| Accessibilité mobile | C | B− | ↑ Cibles 44px, `aria-label`, safe-area languette |
| Adaptation TDAH | C+ | B | ↑ "Prochain ✿", settings collapsibles, wizard non re-déclenché |

### 🔴 Top problèmes restants (priorité)

1. **Trois langages graphiques encore concurrents** — `.j90` (journal), `.menu-book` (menu), `#tablet-box` (tablette) utilisent toujours des couleurs hardcodées qui ne réagissent pas aux palettes `UI_PALETTES`. Changer de palette ne teint pas le journal ni le menu.
2. **Compteur quota IA anxiogène** — `(0/3)` toujours visible en permanence sur le bouton. Pour un public TDAH, ça ressemble à une jauge à remplir sous pression.
3. **Pas de confetti / micro-récompense globale** quand toutes les habitudes du jour sont validées — la récompense s'arrête à l'animation de la checkbox individuelle.

### 🟢 Top quick wins restants

1. **Câbler `.j90` et `.menu-book` sur les variables de palette** — ajouter `--paper-bg`, `--paper-line`, `--paper-text` dans `UI_PALETTES` et les utiliser dans les sélecteurs concernés. Impact : cohérence visuelle complète.
2. **Reformuler le compteur quota** — afficher uniquement quand on approche de la limite (ex: n'apparaît qu'à partir de 2/3), ou le déplacer dans le `toastInfo`.
3. **Haptic feedback** sur validation d'habitude — `navigator.vibrate(10)` à ajouter dans `toggleHab()`. 3 lignes de code, impact sensoriel immédiat.

---

## 1. Inventaire de l'interface

### 1.1 Panneaux principaux

Tous les panneaux vivent dans `#dynamic-zone` et utilisent la classe `.pnl` (un seul porte `.on` à la fois).

| ID | Déclencheur | Contenu | Actions |
|---|---|---|---|
| `#p-gotchi` | `go('gotchi')` ou défaut | Carte état (nom + stade + barre XP), carte "Une pensée de Gotchi" (IA), carte "Mes intentions du jour" + badge `0/6` | Ask Claude, toast info, cocher habitudes |
| `#p-journal` | `go('journal')` | Sas PIN (`#pin-gate`) → contenu (`#j-inner`) avec mood picker, textarea, navigation hebdo, exports | Saisir PIN, écrire/sauver, naviguer, exporter |
| `#p-progress` | `go('progress')` | Carte Stats (série/XP/journal), Carte Bilan Hebdo IA, Calendrier 7 jours `.cal` | Générer/copier bilan, navW(±1) |
| `#p-props` | `go('props')` | Filtres + liste inventaire | Filtrer, équiper/ranger, supprimer objet IA |
| `#p-perso` | `go('perso')` | 3 cartes : couleurs UI, couleur Gotchi, ambiance environnements | Sélectionner palette/couleur/thème |
| `#p-settings` | `go('settings')` | 3 sections collapsibles : Compte, Données, Avancé/danger | Toutes actions admin |

**Constat :** pas de panneau "Agenda" ni "Soutien" — ce sont des modales (`ouvrirAgenda`, `genSoutien`) lancées depuis le menu (boutons `.menu-soutien`).

### 1.2 Modales

Toutes utilisent `#modal` + `.modal-box` sauf indication contraire. Toutes ont désormais un bouton ✕ `.modal-close` persistant.

| Modale | Déclencheur | Contenu |
|---|---|---|
| Boutique | `ouvrirBoutique()` (header) | Onglets (catalogue / acquis), grille de props, achat |
| Agenda & cycle | `ouvrirAgenda()` (menu) | Calendrier mensuel, événements, cycle menstruel |
| Soutien IA | `genSoutien()` | Chat IA avec bulles `.chat-bubble-user/claude/system` |
| Slot picker | `openSlotPicker()` | Choix d'emplacement pour un objet équipé |
| Confirmations | `confirmReset()`, `confirmCleanProps()`, `confirmerSuppressionIA()` | Texte + 2 boutons |
| Tablette terminal | `openTablet()` (header) | `#tablet-overlay` séparé — terminal vert sur fond noir |
| Menu | `toggleMenu()` | `#menu-overlay` séparé — design "carnet/livre" |
| Toast | `toast()` | `#toast` éphémère bas écran |

**Constat :** 3 systèmes de modale différents (`#modal`, `#tablet-overlay`, `#menu-overlay`) avec animations, ombres et structures distinctes — toujours actif, voir section 2.3.

### 1.3 HUD canvas (zone p5.js)

Rendu dans `.tama-screen`. Le tap sur le canvas renvoie au panneau Gotchi si un autre panneau est actif. Aucun indicateur visuel HTML ne signale encore qu'il est interactif.

### 1.4 Navigation

- **Menu principal** : languette `☰` fixée en `bottom: 0`, ouvre un overlay "carnet" centré.
- **`.menu-circle.active`** : panneau actif maintenant visuellement marqué (bordure lilac + fond léger). ✅
- **Labels menu masqués** : les cercles n'affichent plus que les icônes (`.mc-label { display: none }`). ✅
- **Boutons `.menu-soutien`** réduits en `var(--fs-xs)` + `white-space: nowrap` pour tenir sur une ligne. ✅
- Pas de tab bar persistante — le retour se fait via réouverture du menu.

---

## 2. Audit par catégorie

### 2.1 Hiérarchie visuelle

#### ✅ RÉSOLU — Tailles de titre écrasées
Échelle typographique définie dans `:root` : `--fs-xs:11px / --fs-sm:13px / --fs-md:15px / --fs-lg:18px / --fs-xl:22px`. Toutes les valeurs 8/9/10/11px remplacées par les variables dans `style.css`, `index.html` et `ui.js`.

#### ✅ RÉSOLU — Bulle de pensée trop discrète
`.bubble` passe à `font-size: var(--fs-sm)`, `padding: 8px 14px`, `min-height: 44px`, `line-height: 1.4`.

#### ✅ RÉSOLU — Pas de "next action" dans `#p-gotchi`
`.hab--next` mis en place : première habitude non cochée surlignée (bordure lilac, label "Prochain ✿" flottant au-dessus, fond légèrement teinté). Implémenté dans `renderHabs()`.

#### 🟠 OUVERT — Cartes "égales" dans `#p-gotchi`
Les 3 cartes (état, ask Claude, habitudes) ont toujours le même fond, même bordure, même poids visuel. La carte habitudes n'est pas visuellement dominante malgré son rôle prioritaire.
- **Suggestion :** Donner à la carte habitudes un `box-shadow` plus fort ou un `border-color: var(--lilac)` doux en permanence pour la distinguer des deux autres.

#### 🟡 OUVERT — Cartes Stats avec 3 fonds différents
`#p-progress` — les 3 chiffres (série/XP/journal) ont chacun un fond de couleur différente sans cohérence sémantique claire.
- **Suggestion :** Unifier le fond, garder uniquement la couleur du chiffre comme accent.

---

### 2.2 Navigation & orientation

#### ✅ RÉSOLU — Aucun indicateur de panneau actif
`.menu-circle.active` ajouté avec bordure lilac + halo + fond teinté. `go(t)` toggle la classe automatiquement.

#### ✅ RÉSOLU — Pas de retour depuis les modales
Bouton `.modal-close` (✕, 32×32px, `position: absolute; top: 10px; right: 10px`) ajouté structurellement dans `_modalCloseBtn()` et injecté dans toutes les modales via `openModal()` et `toastModal()`.

#### ✅ RÉSOLU — Languette masquée par la barre iOS
`.menu-languette` passe à `bottom: 0` + `padding-bottom: var(--sab)` pour absorber la safe area correctement. Le contenu (icône ☰) reste visible au-dessus de la barre d'accueil.

#### ✅ RÉSOLU — Languette trop haute / trop large
Padding réduit à `6px 18px var(--sab)` — la languette ne montre plus que l'icône sans espace blanc superflu.

#### 🟡 OUVERT — Ordre du menu peu logique
Ordre actuel : Gotchi / Journal / Inventaire / Progrès / Perso / Réglages. Le progrès (motivationnel) arrive en 4e.
- **Suggestion :** Tester Gotchi / Progrès / Journal / Inventaire / Perso / Réglages.

#### 🟡 OUVERT — Soutien et Agenda peu accessibles
Les 2 boutons `.menu-soutien` sont en bas du menu, accessibles en 2 taps. Pour le Soutien notamment, 2 taps c'est déjà trop en crise émotionnelle.
- **Suggestion :** Icône cœur 💜 dans le header, toujours en 1 tap.

---

### 2.3 Cohérence graphique

#### ✅ RÉSOLU — Trois langages graphiques concurrents
`.card` (pastel, radius 14px), `.j90` (beige #e8e0d0, radius 4px), `.menu-book` (carton #f4edd8, radius 6px), `#tablet-box` (noir #1a1a1a) cohabitent. Les deux derniers utilisent des couleurs hardcodées qui **ne réagissent pas aux palettes `UI_PALETTES`**.
- **Impact TDAH :** Chaque panneau = nouveau code visuel à décoder.
- **Suggestion :** Ajouter dans `UI_PALETTES` : `paperBg`, `paperLine`, `paperText`. Utiliser ces variables dans `.j90` et `.menu-book`. Pour la tablette, créer `--terminal-bg`, `--terminal-text` dans `:root` (fixes, assumées).

#### 🟠 OUVERT — Palettes UI partiellement appliquées
`applyUIPalette()` met à jour `--bg`, `--lilac`, `--mint`, `--pink`, `--text`, `--text2`, `--card`, `--border`. Mais `.j90` et `.menu-book` gardent leurs couleurs hardcodées → journal toujours beige quelle que soit la palette choisie.

#### ✅ RÉSOLU — Variables sémantiques manquantes
`--success`, `--danger`, `--warning`, `--info`, `--focus-ring` créées dans `:root`. `#e57373` remplacé par `var(--danger)`.

#### ✅ RÉSOLU — `--text2` en dessous de WCAG AA
Toutes les palettes ont été assombries (~20-25%) pour atteindre un ratio ≥ 5:1 sur `--card`. Nouvelle valeur lavande : `#6e5e8c`.

#### 🟡 OUVERT — Boutons : 9 variantes non documentées
`.btn-p`, `.btn-s`, `.btn-d`, `.btn-m`, `.btn-boutique`, `.menu-soutien`, `.menu-btn`, `.nav-a`, `.pin-k` coexistent sans documentation.
- **Suggestion :** Réduire à 4 variantes documentées : `primary`, `secondary`, `danger`, `ghost`.

#### 🟡 OUVERT — Gradients abondants
Présents dans `.btn-boutique`, carte état, `.hab.done`, barre XP, sliders, badges. Peut saturer visuellement.
- **Suggestion :** Limiter les gradients aux 2 moments de récompense : XP + habitude validée.

---

### 2.4 Lisibilité & typographie

#### ✅ RÉSOLU — Polices < 12px omniprésentes
Toutes les occurrences 8/9/10/11px remplacées par `var(--fs-xs)` ou `var(--fs-sm)` dans `style.css`, `index.html` et `ui.js` (via sed global en D7). Plancher 11px pour les timestamps, 13px pour tout le reste.

#### ✅ RÉSOLU — Contraste `--text2` sous WCAG AA
Voir 2.3 — toutes les palettes corrigées.

#### 🟠 OUVERT — Police monospace partout
`'Courier New', monospace` pour TOUT le texte. Cohérent avec l'univers rétro mais moins lisible qu'une police pixel dédiée ou une sans-serif sur petit écran.
- **Suggestion :** Charger une police pixel (`VT323`, `Press Start 2P`) uniquement pour les titres de panneau (`--fs-xl`), garder Courier pour le corps. Ou assumer le full-Courier mais avec les tailles actuelles, c'est acceptable.

#### 🟡 OUVERT — Compteur quota anxiogène
`(0/3)` affiché en permanence sur le bouton "Une pensée de Gotchi". Voir 2.7.

---

### 2.5 Feedback & états interactifs

#### ✅ RÉSOLU — `:focus-visible` absent
Anneau `3px solid var(--focus-ring)` défini sur `.btn`, `.menu-btn`, `.menu-circle`, `.nav-a`, `.pin-k`, `.inp`.

#### ✅ RÉSOLU — Pas d'état `:disabled`
`.btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }` ajouté.

#### ✅ RÉSOLU — `prefers-reduced-motion` absent
Bloc media query ajouté en fin de `style.css` — coupe toutes les animations en 0.01ms si l'utilisatrice a activé ce réglage iOS/système.

#### ✅ RÉSOLU — `.hab--next` : première habitude mise en évidence
Voir 2.1. `margin-bottom: var(--sp-md)` sur `.hab` pour l'espacement. Label "Prochain ✿" avec fond `var(--card)` pour la lisibilité sur toutes les palettes.

#### 🟠 OUVERT — Loading IA sans skeleton standardisé
`startThinkingAnim()` anime du texte mais aucun skeleton/spinner CSS structuré.
- **Suggestion :** Classe `.thinking` avec 3 points pulsés en CSS pur (animation `fade` séquentielle sur 3 spans).

#### 🟡 OUVERT — Toast potentiellement caché par la languette
`#toast` est à `bottom: calc(70px + var(--sab))`. La languette est maintenant à `bottom: 0` avec padding ~6+34px = ~40px. Sur petit écran le toast peut encore être proche.
- **Suggestion :** Passer à `calc(80px + var(--sab))` pour garantir l'espace.

#### 🟡 OUVERT — Animations identiques pour tous les feedbacks
`cubic-bezier(0.34, 1.56, 0.64, 1)` (overshoot) utilisé pour les transitions structurelles ET les récompenses. Peut devenir agressif si plusieurs s'enchaînent.
- **Suggestion :** Réserver l'overshoot aux moments de récompense (habitude validée, achat). `ease-out` pour les transitions structurelles (ouverture menu, changement de panneau).

---

### 2.6 Accessibilité mobile

#### ✅ RÉSOLU — Cibles tactiles sous 44×44px
`.nav-a` : `min-width: 44px; min-height: 44px`. `.menu-btn` en header agrandi. `.modal-close` : 32×32 avec padding suffisant.

#### ✅ RÉSOLU — Pas d'`aria-label` sur boutons icône
`aria-label` ajouté sur : `btn-boutique-hdr`, `btn-tablet`, les 4 flèches de navigation, `resetBilan`, `menu-languette`.

#### ✅ RÉSOLU — `.modal-box` sans `max-height`
`max-height: 85dvh; overflow-y: auto` ajouté sur `.modal-box` de base.

#### ✅ RÉSOLU — CSS orphelin lignes 619–621
`word-break` et `overflow-wrap` enveloppés proprement dans `.modal-box {}`. `word-break: keep-all` corrigé en `break-word` (keep-all ne s'applique qu'aux langues CJK).

#### 🟠 OUVERT — Inputs clé API
`#api-inp` a `autocomplete="new-password"` — suggère un mot de passe à enregistrer dans le trousseau. À vérifier si ce comportement est souhaité ou risqué pour la clé API.
- **Suggestion :** Passer à `autocomplete="off"` strict.

#### 🟡 OUVERT — Indicateur de scroll absent dans les modales
`scrollbar-width: none` masque la scrollbar dans `#boutique-contenu` et `#agenda-contenu` — pas de signal visuel qu'il y a plus à scroller.
- **Suggestion :** `::-webkit-scrollbar { width: 2px }` pour garder une trace fine.

---

### 2.7 Adaptation TDAH

#### ✅ RÉSOLU — Pas de "next action" claire
`.hab--next` implémenté. Voir 2.1.

#### ✅ RÉSOLU — `#p-settings` = panneau surcharge
Restructuré en 3 blocs `<details class="settings-section">` : "Compte" (ouvert), "Données" (fermé), "Avancé/Danger" (fermé). La zone de reset n'est plus exposée par défaut.

#### ✅ RÉSOLU — Wizard re-déclenché après mise à jour
`checkWelcome()` ne teste plus `D.g.name === 'Petit·e Gotchi'` — seul `!D.firstLaunch` déclenche le wizard. Empêche la re-demande du nom après une mise à jour PWA.

#### 🔴 OUVERT — Compteur quota IA anxiogène
`(0/3)` visible en permanence sur le bouton. Pour TDAH, ça ressemble à une jauge à remplir sous pression plutôt qu'une information utile.
- **Suggestion A :** N'afficher le compteur qu'à partir de 2/3 (presque épuisé) — afficher rien ou juste "✿" avant.
- **Suggestion B :** Déplacer l'info dans `toastInfo()` uniquement — "Il te reste X pensées aujourd'hui".

#### 🟠 OUVERT — Sliders énergie/bonheur ambigus
L'utilisatrice peut modifier elle-même ses valeurs d'énergie/bonheur. Est-ce un capteur d'humeur ou un contrôle de jeu ? La sémantique reste floue.
- **Suggestion :** Ajouter un sous-titre explicite sous les sliders : "Glisse pour dire au Gotchi comment tu te sens".

#### 🟡 OUVERT — Bouton reset trop accessible
Simple friction via `confirmReset()`. La zone est maintenant cachée dans le collapsible "Avancé" ✅, mais la confirmation reste un `confirm()` natif.
- **Suggestion :** Modal stylée avec saisie du nom du Gotchi pour confirmer (friction émotionnelle + technique).

#### 🟡 OUVERT — Pas de micro-récompense globale
Quand toutes les habitudes du jour sont validées, rien ne le célèbre à l'échelle de la session.
- **Suggestion :** Confettis discrets (fade rapide, non bloquants) via Canvas ou CSS + haptic `navigator.vibrate([10, 50, 10])`.

---

## 3. Variables CSS — état actuel

### 3.1 Tokens définis dans `:root`

| Groupe | Variables | État |
|---|---|---|
| Palette déco | `--bg`, `--card`, `--solid`, `--pink`, `--lilac`, `--mint`, `--peach`, `--sky`, `--coral`, `--gold`, `--tama` | ✅ En place |
| Texte & bordures | `--text`, `--text2` (corrigé WCAG), `--border`, `--shadow` | ✅ En place |
| Sémantiques | `--success`, `--danger`, `--warning`, `--info`, `--focus-ring` | ✅ Ajoutés en D4 |
| Safe areas | `--sat`, `--sab`, `--sal`, `--sar` | ✅ En place |
| Typographie | `--fs-xs` à `--fs-xl` | ✅ Ajoutés en D2 |
| Espacements | `--sp-xs` à `--sp-xl` | ✅ Ajoutés en D7 |
| Border radius | `--r-sm` à `--r-xl` | ✅ Ajoutés en D7 |

### 3.2 Variables peu utilisées ou orphelines

- `--gold` : **0 occurrence** dans `style.css` → à utiliser (ex: récompense XP) ou supprimer.
- `--peach`, `--sky` : 1–2 occurrences (gradients sliders) → peu intégrées dans les palettes `UI_PALETTES`.
- `--solid` : défini mais `#fff` apparaît encore quelques fois en hardcodé.

### 3.3 Couleurs encore hardcodées à câbler

| Fichier | Couleur | Occurrences | Devrait être |
|---|---|---|---|
| `style.css` | `#c8b8a0`, `#c8b898`, `#b8a888` | `.menu-book`, `.j90`, `.j-entry` | `--paper-line` |
| `style.css` | `#f4edd8`, `#fff8ee`, `#e8e0d0` | `.menu-book`, `.menu-circle`, `.j90` | `--paper-bg` |
| `style.css` | `#6a5a40`, `#a09880` | Titres carnet, dates journal | `--paper-text` |
| `style.css` | `#1a1a1a`, `#0a0a0a`, `#00ff41` | `#tablet-box` | `--terminal-bg`, `--terminal-text` |
| `index.html` | `#fde8f0`, `#e0a0c0` | Bouton agenda inline | À déplacer en CSS |

### 3.4 Animations — état actuel

| Nom | Durée | État | Note |
|---|---|---|---|
| `popBounce` | 0.4s overshoot | ✅ OK | Habitude validée — récompense |
| `bookSlideUp` | 0.35s overshoot | 🟡 Voir note | Menu = structurel, overshoot excessif |
| `shopOpen` | 0.35s overshoot | 🟡 Voir note | Modale = structurel, idem |
| `tabletOpen` | 0.2s ease-out | ✅ OK | |
| `fu` | 0.2s ease | ✅ OK | Changement de panneau — discret |
| `tamaSway` / `tamaSwayStrong` | 1.4s / 0.9s infini | 🟡 OK en usage court | Peut être stressant en vent fort prolongé |
| `shakeRow` | 0.4s | ✅ OK | Feedback validation |
| `slideUp` | défini | ❓ À vérifier | Jamais référencé → probablement code mort |
| `prefers-reduced-motion` | — | ✅ Ajouté en D3 | Coupe tout à 0.01ms |

---

## 4. Layout — état actuel

### 4.1 Structure globale

- `#console-top` fixed en haut ✅, `#dynamic-zone` flex:1 scroll ✅.
- `max-width: 460px` sur `#dynamic-zone` ✅.
- Safe areas appliquées : header, dynamic-zone, toast, languette ✅.
- `--console-height` calculé en JS (`syncConsoleHeight`) → si JS plante avant cet appel, le fallback 320px peut couper le contenu. **Toujours ouvert.**

### 4.2 Scroll

- `#dynamic-zone` scroll vertical ✅.
- `#boutique-contenu` et `#agenda-contenu` : `scrollbar-width: none` → pas de signal de scroll visible. Voir 2.6.

### 4.3 Safe areas

- Appliquées partout sauf potentiellement `#tablet-overlay` bottom. À vérifier.

---

## 5. Roadmap des améliorations restantes

### Priorité haute (impact fort, effort modéré)

**A. Unifier les langages graphiques** (`css/style.css` + `data/config.js`)
- Ajouter `paperBg`, `paperLine`, `paperText` dans chaque palette `UI_PALETTES`
- Refactoriser `.j90` et `.menu-book` pour les utiliser
- Impact : changer de palette teinte enfin toute l'app

**B. Reformuler le compteur quota IA** (`index.html` + `js/ui.js`)
- N'afficher `#thought-count` qu'à partir de 2/3 utilisés
- Impact : supprime la pression de quota

**C. Haptic feedback sur validation habitude** (`js/app.js` dans `toggleHab()`)
- `if (navigator.vibrate) navigator.vibrate(10);`
- 2 lignes, impact sensoriel immédiat

### Priorité moyenne

**D. Micro-récompense globale fin de journée** (`js/ui.js` dans `renderHabs()`)
- Détecter quand toutes les `.hab` sont `.done`
- Déclencher confettis CSS légers + haptic `[10, 50, 10]`

**E. Loading IA standardisé** (`css/style.css` + `js/ui.js`)
- Classe `.thinking` avec 3 points CSS animés (fade séquentiel)
- Remplacer `startThinkingAnim()` textuel

**F. Friction sur reset** (`js/ui.js` dans `confirmReset()`)
- Modal stylée avec saisie du nom du Gotchi pour confirmer

**G. `autocomplete="off"` strict sur `#api-inp`** (`index.html`)
- Empêche l'enregistrement de la clé dans le trousseau iOS

### Priorité basse / refonte

**H. Repenser le menu** — tester une tab bar bottom persistante (1 tap au lieu de 2)

**I. Police pixel pour les titres** — `VT323` ou `Press Start 2P` sur `--fs-xl` uniquement

**J. Sliders énergie/bonheur** — ajouter un sous-titre explicatif

**K. `--gold` et `--solid`** — utiliser ou supprimer

**L. `slideUp`** — vérifier si l'animation est encore référencée, supprimer si code mort

---

## 6. Wishlist UX (inchangée, non priorisée)

- **Finch** : micro-récompense à chaque tap, animations douces. À adapter sur la barre XP.
- **Bearable** : sliders avec retour émotionnel instantané ("aujourd'hui, ça va ✿").
- **Streaks** : une seule habitude en avant-plan gros, le reste dans le scroll.
- **Daylio** : journal en 3 taps max — vérifier que le flow HabitGotchi tient en 3 actions.
- **Pull-to-refresh** sur `#p-progress`.
- **Long-press** sur habitude pour accès rapide (édition/suppression).
- **Notification quotidienne** rappel doux via Notification API.

---

*Audit initial : 2026-04-26 v3.02 — Mis à jour : 2026-04-26 v3.15*
