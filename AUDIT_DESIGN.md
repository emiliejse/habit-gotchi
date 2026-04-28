# AUDIT DESIGN HabitGotchi — mis à jour 2026-04-28

> Audit initial réalisé en v3.02. Document mis à jour en v3.15 (sessions D1–D7), puis re-vérifié sur le code actuel le 2026-04-28. Les items ✅ sont résolus et confirmés dans le code. Les items ⚠️ étaient marqués résolus mais sont partiellement ou incorrectement soldés. Les items ouverts (🔴 🟠 🟡) restent actifs.

---

## 0. Résumé exécutif

### Score par catégorie (état actuel — re-vérifié 2026-04-28)

| Catégorie | Note initiale | Note v3.15 | Note actuelle | Delta |
|---|---|---|---|---|
| Hiérarchie visuelle | C | B− | B− | = |
| Navigation & orientation | B− | B | B | = |
| Cohérence graphique | C | C+ | B− | ↑ `.j90` + `.menu-book` câblés sur `--paper-*` confirmé |
| Lisibilité & typographie | D | B− | B− | = |
| Feedback & états interactifs | B− | B | B+ | ↑ Confettis all-done déjà en place |
| Accessibilité mobile | C | B− | B− | = |
| Adaptation TDAH | C+ | B | B | = |

### 🔴 Top problèmes restants (priorité)

1. **Compteur quota IA anxiogène** — `(0/3)` visible en permanence sur le bouton. Confirmé dans `index.html` ligne 224 et `ui.js` lignes 456–457.
2. **Haptic feedback absent** — `haptic()` est déclarée dans `app.js` (§1) mais n'est **pas appelée** dans `toggleHab()`. Quick win non fait malgré la roadmap.
3. **2 couleurs encore hardcodées** — `border: 3px solid #c8b8a0` (languette, `style.css` ~275) et `background: #fde8f0` (bouton agenda inline, `style.css` ~446).

### 🟢 Top quick wins restants

1. **Haptic dans `toggleHab()`** — ajouter `if (navigator.vibrate) navigator.vibrate(10);` après le cochage. 2 lignes, `app.js` ~ligne 648.
2. **Reformuler le compteur quota** — masquer `#thought-count` tant que `thoughtCount < 2`. `ui.js` fonction `updThoughtCount()` ~ligne 456.
3. **`autocomplete="off"` sur `#api-inp`** — `index.html` ligne 425. 1 attribut.

### ✅ Points résolus depuis v3.15 (confirmés dans le code actuel)

- `.j90` et `.menu-book` utilisent bien les variables `--paper-*` (confirmé `style.css` lignes 306–358 et 662–679)
- `--terminal-*` définis et utilisés dans `#tablet-box` (confirmé `style.css` lignes 82–88 et 867–874)
- Couleurs hardcodées du tableau 3.3 v3.15 majoritairement migrées (restent 2 exceptions — voir 🔴 ci-dessus)
- Confettis "toutes habitudes cochées" **déjà implémentés** dans `toggleHab()` (app.js lignes 706–723, 3 vagues de 40 particules + `flashBubble`)
- `#fde8f0` / `#e0a0c0` inline dans `index.html` — supprimés (plus aucune occurrence)
- `slideUp` — **pas code mort** : utilisée dans `ui.js` lignes 2974 et 3254 (tooltips/popups inline) → à conserver

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

#### ✅ RÉSOLU — Trois langages graphiques concurrents (confirmé dans le code)
`.j90` et `.menu-book` utilisent bien les variables `--paper-*` (`style.css` lignes 306–358 et 662–679). `#tablet-box` utilise `--terminal-*` (lignes 82–88). Les couleurs hardcodées du tableau 3.3 ont été majoritairement migrées. **Deux résidus subsistent** — voir section 3.3 mise à jour.

#### ⚠️ PARTIELLEMENT RÉSOLU — Palettes UI partiellement appliquées
`.j90` et `.menu-book` utilisent désormais les variables `--paper-*` définies dans `:root`. **Mais** ces variables sont fixes (non modifiées par `applyUIPalette()`) — changer de palette ne change toujours pas le journal ni le menu. La structure est prête, il manque le câblage dans `config.js` → `UI_PALETTES`.
- **Reste à faire :** Ajouter `paperBg`, `paperLine`, `paperText` dans chaque entrée de `UI_PALETTES` dans `config.js`, et faire lire ces valeurs par `applyUIPalette()` pour qu'elles écrasent les variables `--paper-*`.

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
Toutes les occurrences 8/9/10/11px remplacées par `var(--fs-xs)` ou `var(--fs-sm)` dans `style.css`, `index.html` et `ui.js`. Plancher 11px pour les timestamps, 13px pour tout le reste.

#### ✅ RÉSOLU — Contraste `--text2` sous WCAG AA
Voir 2.3 — toutes les palettes corrigées.

#### 🟠 OUVERT — Police monospace partout
`'Courier New', monospace` pour TOUT le texte. Cohérent avec l'univers rétro mais moins lisible qu'une police pixel dédiée ou une sans-serif sur petit écran.
- **Suggestion :** Charger une police pixel (`VT323`, `Press Start 2P`) uniquement pour les titres de panneau (`--fs-xl`), garder Courier pour le corps. Ou assumer le full-Courier — avec les tailles actuelles, c'est acceptable.

#### 🔴 OUVERT — Compteur quota anxiogène
`(0/3)` affiché en permanence sur le bouton "Une pensée de Gotchi". Voir 2.7 pour le détail.

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

#### ✅ RÉSOLU — Pas de micro-récompense globale (confirmé dans le code)
Confettis "toutes habitudes cochées" **déjà implémentés** dans `toggleHab()` (`app.js` lignes 706–723) : 3 vagues de 40 particules arc-en-ciel + `flashBubble("Tu as tout fait ! Je suis trop heureuse 🎉")` + `triggerGotchiBounce`. Haptic **non implémenté** — voir 2.7.

#### 🟠 OUVERT — Loading IA sans skeleton standardisé
`startThinkingAnim()` anime du texte mais aucun skeleton/spinner CSS structuré. Utilisée en 4 endroits dans `ui.js` (lignes ~1397, ~1510, ~1734, ~1894).
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
`word-break` et `overflow-wrap` enveloppés proprement dans `.modal-box {}`. `word-break: keep-all` corrigé en `break-word`.

#### 🟠 OUVERT — Inputs clé API
`#api-inp` a `autocomplete="new-password"` (`index.html` ligne 425) — suggère un mot de passe à enregistrer dans le trousseau iOS. Risque : la clé API Anthropic enregistrée dans le trousseau iCloud.
- **Action :** Remplacer par `autocomplete="off"` strict. 1 attribut, `index.html` ligne 425.

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
`checkWelcome()` ne teste plus `D.g.name === 'Petit·e Gotchi'` — seul `!D.firstLaunch` déclenche le wizard.

#### ✅ RÉSOLU — Pas de confettis globaux (confirmé dans le code)
Voir 2.5 — les 3 vagues de particules + message sont implémentées dans `toggleHab()`. Il manque uniquement le haptic pattern `[10, 50, 10]`.

#### 🔴 OUVERT — Compteur quota IA anxiogène
`(0/3)` visible en permanence (`index.html` ligne 224, `ui.js` lignes 456–457 et 1485–1486). Pour TDAH, ça ressemble à une jauge à remplir sous pression.
- **Suggestion A :** N'afficher `#thought-count` qu'à partir de 2/3 utilisés — avant, afficher rien ou juste "✿". Modifier `updThoughtCount()` dans `ui.js` ~ligne 456.
- **Suggestion B :** Déplacer l'info dans `toastInfo()` uniquement — "Il te reste X pensées aujourd'hui".

#### 🔴 OUVERT — Haptic feedback absent dans `toggleHab()`
`haptic()` est **déclarée** dans `app.js` (§1, ligne ~7) mais n'est **pas appelée** dans `toggleHab()`. Quick win manqué.
- **Action :** Ajouter après la ligne 648 (`addXp(15)`) dans `app.js` : `if (navigator.vibrate) navigator.vibrate(10);`
- Pour les confettis all-done, ajouter ligne ~722 : `if (navigator.vibrate) navigator.vibrate([10, 50, 10]);`

#### 🟠 OUVERT — Sliders énergie/bonheur ambigus
L'utilisatrice peut modifier elle-même ses valeurs d'énergie/bonheur. Est-ce un capteur d'humeur ou un contrôle de jeu ? La sémantique reste floue.
- **Suggestion :** Ajouter un sous-titre explicite sous les sliders : "Glisse pour dire au Gotchi comment tu te sens".

#### 🟡 OUVERT — Bouton reset trop accessible
La zone est maintenant cachée dans le collapsible "Avancé" ✅, mais la confirmation reste un `confirm()` natif.
- **Suggestion :** Modal stylée avec saisie du nom du Gotchi pour confirmer (friction émotionnelle + technique).

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
| Thème papier | `--paper-bg`, `--paper-border`, `--paper-text`, `--paper-entry`, `--paper-entry-ts`, `--paper-entry-btn`, `--paper-book-bg`, `--paper-book-border`, `--paper-book-shadow`, `--paper-book-line` | ✅ Définis dans `:root`, utilisés par `.j90` et `.menu-book` — mais fixes (non liés aux palettes `UI_PALETTES`) |
| Thème terminal | `--terminal-box`, `--terminal-border`, `--terminal-screen`, `--terminal-screen-border`, `--terminal-text`, `--terminal-text-dim`, `--terminal-line-div` | ✅ Définis dans `:root`, utilisés par `#tablet-overlay` — fixes assumées |

### 3.2 Variables peu utilisées ou orphelines

- `--gold` : **0 occurrence** dans `style.css` — à utiliser (ex: accent récompense XP, `--warning`, étoile streak) ou supprimer.
- `--peach`, `--sky` : 1–2 occurrences (gradients sliders) → peu intégrées dans les palettes `UI_PALETTES`.
- `--solid` : défini mais `#fff` apparaît encore quelques fois en hardcodé (ex: `.pin-k` ligne ~687).

### 3.3 Couleurs encore hardcodées (résidus — état 2026-04-28)

Le tableau v3.15 est largement soldé. Il reste 2 résidus confirmés :

| Fichier | Ligne | Couleur | Contexte | Devrait être |
|---|---|---|---|---|
| `style.css` | ~275 | `#c8b8a0` | `.menu-languette` border | `var(--paper-border)` |
| `style.css` | ~446 | `#fde8f0` | Bouton agenda (inline style ou règle orpheline) | `var(--pink)` ou `var(--card)` |

### 3.4 Animations — état actuel (re-vérifié 2026-04-28)

| Nom | Durée | État | Note |
|---|---|---|---|
| `popBounce` | 0.4s overshoot | ✅ OK | Habitude validée — récompense |
| `bookSlideUp` | 0.35s overshoot | 🟡 Voir note | Menu = structurel, overshoot excessif |
| `shopOpen` | 0.35s overshoot | 🟡 Voir note | Modale = structurel, idem |
| `tabletOpen` | 0.2s ease-out | ✅ OK | |
| `fu` | 0.2s ease | ✅ OK | Changement de panneau — discret |
| `tamaSway` / `tamaSwayStrong` | 1.4s / 0.9s infini | 🟡 OK en usage court | Peut être stressant en vent fort prolongé |
| `shakeRow` | 0.4s | ✅ OK | Feedback validation |
| `slideUp` | défini `style.css` ~977 | ✅ Utilisée | Référencée dans `ui.js` lignes ~2974 et ~3254 — pas code mort |
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

### Priorité haute (impact fort, effort minimal)

**A. Haptic feedback dans `toggleHab()`** (`js/app.js` ~ligne 648)
- `if (navigator.vibrate) navigator.vibrate(10);` après le cochage
- `if (navigator.vibrate) navigator.vibrate([10, 50, 10]);` dans le bloc confettis all-done (~ligne 722)
- 2 ajouts de 1 ligne chacun

**B. Reformuler le compteur quota IA** (`js/ui.js` ~ligne 456 + `index.html` ligne 224)
- Masquer `#thought-count` tant que `thoughtCount < 2`, afficher juste "✿" ou rien
- Impact : supprime la pression de quota TDAH

**C. `autocomplete="off"` sur `#api-inp`** (`index.html` ligne 425)
- Remplacer `autocomplete="new-password"` par `autocomplete="off"`
- Empêche l'enregistrement de la clé dans le trousseau iOS

**D. Câbler `UI_PALETTES` sur les variables `--paper-*`** (`data/config.js` + `js/ui.js`)
- Ajouter `paperBg`, `paperBorder`, `paperText` dans chaque entrée de `UI_PALETTES`
- Faire lire ces valeurs par `applyUIPalette()` pour qu'elles écrasent les variables `:root`
- Impact : changer de palette teinte enfin le journal ET le menu

### Priorité moyenne

**E. Loading IA standardisé** (`css/style.css` + `js/ui.js`)
- Classe `.thinking` avec 3 points CSS animés (fade séquentiel)
- Remplacer `startThinkingAnim()` textuel dans les 4 appelants (`ui.js` ~1397, ~1510, ~1734, ~1894)

**F. Friction sur reset** (`js/ui.js` dans `confirmReset()`)
- Modal stylée avec saisie du nom du Gotchi pour confirmer

**G. Corriger les 2 résidus hardcodés** (`css/style.css` lignes ~275 et ~446)
- `#c8b8a0` → `var(--paper-border)`
- `#fde8f0` → `var(--pink)` ou `var(--card)`

### Priorité basse / refonte

**H. Repenser le menu** — tester une tab bar bottom persistante (1 tap au lieu de 2)

**I. Police pixel pour les titres** — `VT323` ou `Press Start 2P` sur `--fs-xl` uniquement

**J. Sliders énergie/bonheur** — ajouter un sous-titre explicatif : "Glisse pour dire au Gotchi comment tu te sens"

**K. `--gold`** — utiliser comme accent récompense (XP, streak) ou supprimer

**L. Ordre du menu** — tester Gotchi / Progrès / Journal / Inventaire / Perso / Réglages

**M. Bouton Soutien en 1 tap** — icône cœur 💜 dans le header, hors du menu

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

*Audit initial : 2026-04-26 v3.02 — Mis à jour v3.15 : 2026-04-26 — Re-vérifié sur code : 2026-04-28*
