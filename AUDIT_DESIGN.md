# AUDIT DESIGN HabitGotchi — 2026-04-26

> Audit visuel et UX réalisé sur `index.html` et `css/style.css` (avec contexte de `data/config.js` et `js/ui.js`). Aucun fichier n'a été modifié. Document de référence pour piloter une amélioration progressive du design.

---

## 0. Résumé exécutif

### Score par catégorie

| Catégorie | Note | Commentaire synthétique |
|---|---|---|
| Hiérarchie visuelle | **C** | Hiérarchie portée surtout par la couleur/gradient ; tailles de texte écrasées (8–11px partout). |
| Navigation & orientation | **B−** | Menu en languette astucieux, mais aucun indicateur de panneau actif ni de fil d'Ariane. |
| Cohérence graphique | **C** | Trois langages visuels en conflit (carte pastel, carnet `j90`, livre `menu-book`) + tablette terminal vert. |
| Lisibilité & typographie | **D** | Police monospace partout, tailles ≤ 11px omniprésentes, contrastes `--text2` limites WCAG. |
| Feedback & états interactifs | **B−** | `:active` bien traité ; `:hover` / `:focus` absents ; pas de loading skeleton ni d'état désactivé visuel. |
| Accessibilité mobile | **C** | Plusieurs cibles tactiles < 44px (`.nav-a`, `.menu-btn`, `.pin-dot`, badges), pas d'`aria-label`. |
| Adaptation TDAH | **C+** | Animation `popBounce` satisfaisante ; mais surcharge d'options dans Réglages, pas de "next action" claire à l'ouverture. |

### 🔴 Top 3 problèmes les plus urgents

1. **Tailles de texte sous le seuil mobile** — 8/9/10/11px utilisés massivement dans `.hdr h1`, `.hdr sub`, `.bubble`, `.slbl`, `.cal-c`, badges, labels boutons. Sur iPhone, ces tailles forcent un effort de lecture incompatible avec la fatigue cognitive TDAH. Le minimum WCAG/Apple HIG est 12pt (≈16px) pour le corps et 14px pour les contrôles.
2. **Trois univers graphiques concurrents** — `.card` (pastel arrondi moderne), `.j90` (carnet beige années 90), `.menu-book` (livre cuir). Aucun système commun de bordure / radius / ombre. L'œil doit ré-apprendre l'interface à chaque panneau.
3. **CSS orphelin / cassé ligne 619–621 de `css/style.css`** — `word-break: keep-all; overflow-wrap: break-word;` flottent **hors de toute règle CSS**. Soit le sélecteur a été supprimé, soit jamais ajouté. Le navigateur ignore ces lignes silencieusement → certaines modales débordent peut-être sans qu'on le voie.

### 🟢 Top 3 quick wins visuels

1. **Augmenter le minimum de corps à 13px** (et 11px → 12px partout sauf labels secondaires). Coût : 30 min de remplacement, impact lisibilité immédiat.
2. **Ajouter un état actif au menu** (panneau ouvert visuellement marqué) — soit en surlignant le `.menu-circle` correspondant à `.pnl.on`, soit avec un fil d'Ariane sous le titre `.hdr h1`.
3. **Définir 4 variables CSS sémantiques manquantes** (`--success`, `--danger`, `--warning`, `--info`) et purger les `#e57373`, `#c8b8a0`, `#6a5a40`, `#00ff41` hardcodés en 30+ endroits.

---

## 1. Inventaire de l'interface

### 1.1 Panneaux principaux

Tous les panneaux vivent dans `#dynamic-zone` et utilisent la classe `.pnl` (un seul porte `.on` à la fois).

| ID | Déclencheur | Contenu | Actions |
|---|---|---|---|
| `#p-gotchi` | `goMenu('gotchi')` ou défaut | Carte état (nom + stade + barre XP), carte "Une pensée de Gotchi" (IA), carte "Mes intentions du jour" + badge `0/6` | Ask Claude, toast info, cocher habitudes |
| `#p-journal` | `goMenu('journal')` | Sas PIN (`#pin-gate`) → contenu (`#j-inner`) avec mood picker, textarea, navigation hebdo, exports | Saisir PIN, écrire/sauver, naviguer, exporter |
| `#p-progress` | `goMenu('progress')` | Carte Stats (série/XP/journal), Carte Bilan Hebdo IA, Calendrier 7 jours `.cal` | Générer/copier bilan, navW(±1) |
| `#p-props` | `goMenu('props')` | Filtres + liste inventaire | Filtrer, équiper/ranger, supprimer objet IA |
| `#p-perso` | `goMenu('perso')` | 3 cartes : couleurs UI, couleur Gotchi, ambiance environnements | Sélectionner palette/couleur/thème |
| `#p-settings` | `goMenu('settings')` | Réglages (nom, API, PIN, cheat code), Mes données (export/import/update), Danger (reset), version, outils dev | Toutes actions admin |

**Constat :** pas de panneau "Agenda" ni "Soutien" — ce sont des modales (`ouvrirAgenda`, `genSoutien`) lancées depuis le menu (boutons `.menu-soutien`).

### 1.2 Modales

Toutes utilisent `#modal` + `.modal-box` sauf indication contraire.

| Modale | Déclencheur | Contenu |
|---|---|---|
| Boutique | `ouvrirBoutique()` (header) | Onglets (catalogue / acquis), grille de props, achat |
| Agenda & cycle | `ouvrirAgenda()` (menu) | Calendrier mensuel, événements, cycle menstruel |
| Soutien IA | `genSoutien()` → `ouvrirSnack()` | Chat IA avec bulles `.chat-bubble-user/claude/system` |
| Slot picker | `openSlotPicker()` | Choix d'emplacement pour un objet équipé |
| Confirmations | `confirmReset()`, `confirmCleanProps()`, `confirmerSuppressionIA()` | Texte + 2 boutons |
| Tablette terminal | `openTablet()` (header) | `#tablet-overlay` séparé — terminal vert sur fond noir |
| Menu | `toggleMenu()` | `#menu-overlay` séparé — design "carnet/livre" |
| Toast | `toast()` | `#toast` éphémère bas écran |

**Constat :** **3 systèmes de modale différents** (`#modal`, `#tablet-overlay`, `#menu-overlay`) avec animations, ombres et structures distinctes.

### 1.3 HUD canvas (zone p5.js)

Rendu dans `.tama-screen` (aspect 1:1, bordure lilac, fond `--tama`). Le canvas affiche le Gotchi, le décor (envs.js), les props, la météo. L'utilisatrice peut tap sur le canvas (touch-action: manipulation) — mais aucun indicateur visuel HTML ne signale qu'il est interactif.

### 1.4 Navigation

- **Menu principal** : languette `☰` fixée au bas de l'écran (`.menu-languette`), ouvre un overlay "carnet" centré.
- **Pas de tab bar persistante** ni de bouton retour : le retour se fait via réouverture du menu.
- **Transitions** : `.pnl` fade-in avec `@keyframes fu` (200ms).
- **Header** : 2 boutons fixes (boutique gauche, tablette droite) + titre central.

**Constat :** L'utilisatrice doit **2 taps minimum** pour changer de panneau (languette → cercle), et n'a **aucun indicateur** de l'endroit où elle se trouve dans l'app.

---

## 2. Audit par catégorie

### 2.1 Hiérarchie visuelle

#### 🔴 CRITIQUE — Tailles de titre écrasées
- **Écran/composant :** `.hdr h1` (12px), `.card h2` (13px), `.j90 h2` (13px), `.menu-book h2` (13px)
- **Observation :** Les titres ne dépassent jamais 13px ; le corps est à 10–11px ; les labels à 8–9px. Le ratio titre/corps est ≈ 1.2 alors qu'une hiérarchie lisible vise 1.5–2.
- **Impact TDAH :** L'œil ne trouve pas d'ancrage prioritaire, il scanne tout au même niveau → fatigue immédiate.
- **Suggestion :** Définir une échelle typographique en variables CSS : `--fs-xs:11px / --fs-sm:13px / --fs-md:15px / --fs-lg:18px / --fs-xl:22px`. Réserver `--fs-xl` aux titres de panneau.

#### 🟠 IMPORTANT — Bulle de pensée trop discrète
- **Écran/composant :** `.bubble` (font-size:10px, min-height:24px)
- **Observation :** C'est l'un des éléments les plus chargés de sens (parole du Gotchi, donc cœur émotionnel) mais visuellement le plus petit.
- **Impact TDAH :** Le retour affectif se perd ; la récompense émotionnelle n'a pas son poids visuel.
- **Suggestion :** Passer à 13px minimum, augmenter `padding` et `min-height`, considérer un fond légèrement contrasté.

#### 🟠 IMPORTANT — Cartes "égales" en `#p-gotchi`
- **Observation :** Les 3 cartes (état, ask Claude, habitudes) ont le même fond `var(--card)`, même bordure, même radius. Aucune ne se détache.
- **Impact TDAH :** Pas de "next action" évidente quand on ouvre l'app.
- **Suggestion :** Marquer la carte "intentions du jour" comme la prioritaire (ombre plus forte, accent coloré ou label "Aujourd'hui" plus gros). Diminuer visuellement les 2 autres.

#### 🟡 MINEUR — Cartes Stats avec 3 fonds différents
- **Écran/composant :** `#p-progress` carte Stats — chacun des 3 chiffres a son propre fond (lilac, mint, sky transparent à 7%)
- **Observation :** Cohérent en intention, mais ces 3 couleurs n'ont pas la même charge sémantique (série ≠ XP ≠ journal).
- **Suggestion :** Unifier le fond, garder uniquement la couleur du chiffre comme accent.

---

### 2.2 Navigation & orientation

#### 🔴 CRITIQUE — Aucun indicateur de panneau actif
- **Observation :** Quand le menu est ouvert, les 6 `.menu-circle` sont strictement identiques. Rien n'indique le panneau actuellement affiché.
- **Impact TDAH :** Perte de repère si on revient au menu pour vérifier où on est.
- **Suggestion :** Ajouter une classe `.menu-circle.active` avec bordure lilac + cocarde, lue depuis l'état courant.

#### 🟠 IMPORTANT — Pas de retour explicite depuis les modales
- **Observation :** `.modal-box` n'a pas de bouton ✕ structurel — la fermeture se fait par tap sur l'arrière-plan (`clModal(event)`). Sur mobile, c'est risqué quand le contenu remplit l'écran.
- **Impact TDAH :** Cul-de-sac perçu : "comment je sors d'ici ?".
- **Suggestion :** Ajouter un ✕ persistant en haut à droite de `.modal-box` (au moins 44×44px), même si le tap-outside reste actif.

#### 🟠 IMPORTANT — Languette en bas masquée par la barre iOS
- **Écran/composant :** `.menu-languette` (`bottom: 0`, pas de `padding-bottom: var(--sab)`)
- **Observation :** Sur iPhone X+, la barre d'accueil iOS recouvre partiellement la languette.
- **Impact TDAH :** Bouton de navigation principal partiellement caché.
- **Suggestion :** Ajouter `padding-bottom: calc(8px + var(--sab))` à `.menu-languette` ou translater son positionnement.

#### 🟡 MINEUR — Ordre du menu peu logique
- **Observation :** Ordre actuel : Gotchi / Journal / Inventaire / Progrès / Perso / Réglages. Le journal (action quotidienne secondaire) est en 2e, alors que Progrès (motivationnel) est en 4e.
- **Suggestion :** Tester l'ordre Gotchi / Progrès / Journal / Inventaire / Perso / Réglages — actions fréquentes en haut.

#### 🟡 MINEUR — Soutien et Agenda enterrés
- **Observation :** Les 2 boutons les plus chargés émotionnellement (`💜 Besoin de soutien`, `🗓️ Mon agenda & cycle`) sont sous la grille du menu, en typographie plus petite.
- **Suggestion :** Pour le soutien notamment, envisager une icône cœur dans le header (toujours accessible en 1 tap).

---

### 2.3 Cohérence graphique

#### 🔴 CRITIQUE — Trois langages visuels concurrents
- **Composants :** `.card` (pastel, radius 14px, bordure 2px), `.j90` (beige #e8e0d0, radius 4px, bordure 3px), `.menu-book` (carton #f4edd8, radius 6px, bordure 4px), `#tablet-box` (noir #1a1a1a, radius 12px).
- **Observation :** 4 systèmes distincts cohabitent sans transition visuelle. Le journal (`j90`) et le menu (`menu-book`) utilisent des **couleurs hardcodées** (`#c8b8a0`, `#6a5a40`, `#f4edd8`) qui ne réagissent pas aux palettes `UI_PALETTES`.
- **Impact TDAH :** Chaque ouverture de panneau = nouveau code visuel à décoder.
- **Suggestion :** Soit assumer 2 univers max (UI quotidienne `.card` + univers introspectif unifié), soit câbler `j90` et `menu-book` sur les variables de palette pour qu'ils se teintent.

#### 🟠 IMPORTANT — Palettes UI partiellement appliquées
- **Observation :** `UI_PALETTES` (config.js) modifie `--bg`, `--lilac`, `--mint`, `--pink`, `--text`, `--text2`, `--card`, `--border` via `applyUIPalette()`. Mais les couleurs hardcodées du carnet (`#f4edd8`, `#c8b898`) et du journal (`#e8e0d0`, `#c8b8a0`) **ne se mettent jamais à jour** quand on change de palette.
- **Impact TDAH :** Changer de palette donne une UI incohérente (panneau gotchi rose, journal toujours beige).
- **Suggestion :** Ajouter `--paper`, `--paper-line`, `--paper-text` dans chaque palette `UI_PALETTES`, puis les utiliser dans `.j90` et `.menu-book`.

#### 🟠 IMPORTANT — Variables `--peach`, `--gold`, `--sky` peu utilisées
- **Observation :** Définies dans `:root` mais utilisées dans 1–2 endroits (gradient slider, fond stat). Aucune palette de `UI_PALETTES` ne les redéfinit.
- **Suggestion :** Soit les supprimer de `:root` et les inliner où elles servent, soit les utiliser comme couleurs sémantiques (`--gold` = succès XP, `--peach` = warning, `--sky` = info).

#### 🟡 MINEUR — Boutons : 4 variantes, 0 documentation
- **Composants :** `.btn-p`, `.btn-s`, `.btn-d`, `.btn-m`, `.btn-boutique`, `.menu-soutien`, `.menu-btn`, `.nav-a`, `.pin-k`
- **Observation :** 9 styles de bouton coexistent avec radius/borders/ombres différents.
- **Suggestion :** Réduire à 4 variantes documentées : `primary`, `secondary`, `danger`, `ghost`. Tout le reste devient une instance avec utility-classes.

#### 🟡 MINEUR — Gradients abondants
- **Observation :** Gradients dans `.btn-boutique`, carte état (`#p-gotchi`), `.hab.done`, barre XP, sliders, badges. Empile beaucoup de stimulation visuelle.
- **Impact TDAH :** Saturation possible.
- **Suggestion :** Limiter les gradients à 2 emplacements de récompense (XP + habitude validée).

---

### 2.4 Lisibilité & typographie

#### 🔴 CRITIQUE — Polices < 12px omniprésentes
- **Compteur indicatif (style.css + index.html) :**
  - `font-size: 8px` : `.hdr sub`, `.menu-circle .mc-label`, `.cal-c-mini`, badges header (`#badge-boutique-hdr`, `#tablet-badge`)
  - `font-size: 9px` : `.slbl`, `.cal-c`, `.j-entry .j-date`, `.tablet-line .tl-time`, version footer, plein de `style="font-size:9px"` inline
  - `font-size: 10px` : `.bubble`, `.btn-s`, beaucoup de boutons via inline
  - `font-size: 11px` : `.btn`, `.card-h2` indirectement, toasts
- **Impact TDAH :** Effort cognitif constant pour décoder. Apple HIG recommande 17pt body / 12pt minimum SF Pro. Ici on est à l'équivalent de 6–7pt.
- **Suggestion :** Audit complet des `font-size`. Plancher proposé : 12px pour tout texte secondaire, 14px pour le corps, 11px maximum réservé aux time-stamps.

#### 🔴 CRITIQUE — Contraste `--text2` sur `--card` limite
- **Couleurs :** `--text2: #887ea0` sur `--card: rgba(255,255,255,0.88)` rendu sur `--bg: #ddd6e8`
- **Observation :** Ratio estimé ≈ 4.0:1 → **échoue WCAG AA** pour le texte normal (4.5:1 requis).
- **Impact TDAH :** Texte secondaire (dates, labels) flou, illisible en plein soleil.
- **Suggestion :** Foncer `--text2` à `#6e5e8c` ou plus (ratio > 5:1). Vérifier toutes les palettes.

#### 🟠 IMPORTANT — Police monospace partout
- **Observation :** `'Courier New', monospace` est utilisée pour TOUT le texte (titres, corps, boutons). Choix esthétique cohérent avec l'univers tamagotchi rétro, mais Courier en monospace est **moins lisible** qu'une police pixel ou qu'une sans-serif standard sur petit écran.
- **Impact TDAH :** Contre-intuitif — la cohérence pixel-art passerait mieux par une police pixel dédiée que par Courier (qui n'est ni pixel ni moderne).
- **Suggestion :** Soit charger une police pixel art (PressStart2P, VT323) **uniquement pour les titres** + une sans-serif moderne (system-ui) pour le corps, soit garder Courier mais agrandir.

#### 🟡 MINEUR — Labels boutons longs et répétitifs
- **Observation :** `"✿ Une pensée de Gotchi (0/3)"`, `"📋 Copier le bilan"`, `"📥 Restaurer une sauvegarde"` — beaucoup d'emojis + texte long.
- **Suggestion :** Garder soit l'emoji, soit le texte court ("Pensée • 0/3"). Réserver les `✿` aux moments de récompense, pas aux boutons utilitaires.

---

### 2.5 Feedback & états interactifs

#### 🔴 CRITIQUE — `:hover` et `:focus` absents partout
- **Observation :** Tous les boutons définissent uniquement `:active`. Pas un seul `:hover`, `:focus`, ou `:focus-visible` dans `style.css`.
- **Impact TDAH :** Sur tablette/desktop PWA, aucune anticipation possible. Pour navigation au clavier (assistive), aucun anneau de focus visible.
- **Suggestion :** Ajouter `:focus-visible` avec un anneau lilac de 2px sur tous les `.btn`, `.menu-btn`, `.menu-circle`, `.nav-a`, `.pin-k`. Ajouter `:hover` léger (translucide) sur desktop.

#### 🟠 IMPORTANT — Pas d'état désactivé
- **Observation :** Aucun `:disabled` style défini. Ex : `#btn-ask-claude` quand quota atteint (3/3) — visuellement identique.
- **Impact TDAH :** Ambiguïté : "ça a marché ? c'est cassé ? je n'ai plus le droit ?".
- **Suggestion :** Style `.btn:disabled` avec opacity 0.5 + cursor not-allowed + pas d'animation `:active`.

#### 🟠 IMPORTANT — Loading IA sans skeleton
- **Composant :** `#claude-msg`, `#claude-summary`
- **Observation :** `startThinkingAnim()` (ui.js:1130) anime du texte mais aucun skeleton/spinner CSS structuré.
- **Suggestion :** Ajouter une classe `.thinking` avec animation de points pulsés (3 dots fade) standardisée.

#### 🟡 MINEUR — Toast caché par la languette
- **Observation :** `#toast` est positionné à `bottom: calc(70px + var(--sab))`, la languette à `bottom: 0` avec hauteur ~50px → presque collés. Sur petit écran, le toast peut chevaucher la languette.
- **Suggestion :** Augmenter à `calc(90px + var(--sab))` ou repositionner en haut.

#### 🟡 MINEUR — Animations identiques pour tous les feedbacks
- **Observation :** `popBounce` (habitude), `bookSlideUp` (menu), `shopOpen` (modale) — toutes utilisent `cubic-bezier(0.34, 1.56, 0.64, 1)` (overshoot). Cohérent mais peut devenir agressif si plusieurs s'enchaînent.
- **Suggestion :** Garder l'overshoot pour les moments de récompense (habitude validée, achat boutique). Utiliser une courbe plus calme (`ease-out`) pour les transitions structurelles.

---

### 2.6 Accessibilité mobile

#### 🔴 CRITIQUE — Cibles tactiles sous 44×44px
- **Composants concernés :**
  - `.nav-a` : 28×28px (boutons ◀▶ navigation semaine)
  - `.menu-btn` : 36×36px (header boutique/tablette)
  - `.pin-dot` : 14×14px (indicateurs PIN — non cliquables, mais voisins serrés)
  - badges `#badge-boutique-hdr`, `#tablet-badge` : 12×12px
  - `.hdr .menu-btn:active` reduce → encore plus petit
- **Recommandation Apple :** 44×44pt minimum.
- **Impact TDAH/moteur :** Fausses touches fréquentes → frustration.
- **Suggestion :** Passer `.nav-a` à 36×36px minimum (avec hit area étendue via `padding`). Idem `.menu-btn` à 44×44px.

#### 🟠 IMPORTANT — Pas d'`aria-label` sur boutons icône
- **Observation :** Boutons `🛍️`, `📟`, `☰`, `◀`, `▶`, `🔄`, `ℹ️` n'ont aucun `aria-label`. Lecteur d'écran lit "emoji shopping bags" etc.
- **Suggestion :** Ajouter `aria-label="Boutique"` etc. sur tous les boutons icône.

#### 🟠 IMPORTANT — Inputs PIN/API
- **Observation :** `#pin-inp`, `#pin-ancien` ont bien `inputmode="numeric"` ✓. Mais `#api-inp` n'a pas `autocomplete="off"` clair (a `new-password` qui suggère un mot de passe à enregistrer). `#name-inp` a juste `autocomplete="off"`.
- **Suggestion :** Vérifier que la clé API est marquée `autocomplete="off"` strict pour éviter l'enregistrement dans le trousseau.

#### 🟡 MINEUR — Scroll modal
- **Observation :** `.modal-box` a `max-width: 340px` mais aucune limite de hauteur ; `.modal-box.shop-open:not(.shop-catalogue)` a `max-height: 90dvh; overflow-y: auto`. Bien. Mais `.modal-box` par défaut **n'a pas de `max-height`** → risque de débordement.
- **Suggestion :** Ajouter `max-height: 85dvh; overflow-y: auto` au `.modal-box` de base.

#### 🟡 MINEUR — Pas de `-webkit-overflow-scrolling: touch`
- **Observation :** Les zones scrollables (`#dynamic-zone`, `#boutique-contenu`, `#agenda-contenu`) ne déclarent pas le momentum iOS.
- **Suggestion :** Ajouter `-webkit-overflow-scrolling: touch;` (sécurité, même si Safari moderne le fait par défaut).

---

### 2.7 Adaptation TDAH spécifique

#### 🔴 CRITIQUE — Pas de "next action" claire à l'ouverture
- **Observation :** Quand on ouvre l'app sur `#p-gotchi`, on voit : nom, stade, XP, bouton IA, habitudes du jour. **Rien ne crie "fais ça maintenant"**. La prochaine habitude à cocher n'est ni surlignée ni proposée.
- **Impact TDAH :** Le coût de démarrage est entier, alors que l'app pourrait l'offrir en cadeau.
- **Suggestion :** Mettre en évidence la première habitude non-cochée (anneau lilac, label "À faire maintenant"), ou placer en haut de la liste un encart "Ta prochaine intention : [habitude]".

#### 🟠 IMPORTANT — Sliders énergie/bonheur ambigus
- **Composant :** `#sl-energy`, `#sl-happy` (sliders interactifs `oninput=setEnergy/setHappy`)
- **Observation :** L'utilisatrice peut **mettre elle-même** son énergie/bonheur à n'importe quelle valeur. Est-ce un capteur ? Un contrôle de jeu ? La sémantique est floue.
- **Impact TDAH :** Confusion sur le rôle (dois-je mentir au Gotchi ? dois-je l'écouter ?).
- **Suggestion :** Soit clarifier (label "Comment je me sens ?" → mood-tracker), soit verrouiller en lecture seule si c'est calculé. Si ça reste interactif, ajouter un sous-titre explicite : "Glisser pour dire au Gotchi comment tu te sens".

#### 🟠 IMPORTANT — Réglages = panneau panier-cadeau
- **Observation :** `#p-settings` mélange : nom, API, PIN, cheat code, données, danger zone, version, outils dev. **8 cartes** dans un seul écran.
- **Impact TDAH :** Surcharge décisionnelle quand on cherche juste à changer son nom.
- **Suggestion :** Sectionner avec collapsibles : "Compte" (nom, PIN, API) / "Données" / "Avancé" (cheat, dev, reset). Cacher le bloc dev par défaut (déjà fait — bien) et déplacer "reset" tout en bas avec friction visuelle.

#### 🟠 IMPORTANT — Compteur "(0/3)" anxiogène
- **Composant :** `#thought-count` dans `#btn-ask-claude` ("Une pensée de Gotchi (0/3)")
- **Observation :** Compteur de quota visible en permanence. Pour un public TDAH, voir "0/3" ressemble à une jauge à remplir → pression de consommer.
- **Suggestion :** Afficher uniquement quand on approche de la limite, ou reformuler "encore 3 pensées disponibles aujourd'hui" en survol/info.

#### 🟡 MINEUR — Bouton "🗑️ Tout réinitialiser" trop accessible
- **Observation :** Bouton danger en bas du panneau réglages, simple `confirm()` natif via `confirmReset()`.
- **Suggestion :** Ajouter une friction supplémentaire : modal stylée avec saisie du nom du Gotchi pour confirmer.

#### 🟡 MINEUR — Animations potentiellement stressantes
- **Composants :** `tamaSwayStrong` (1.5° à 0.9s — vent fort), `shakeRow` (mood-required), animations cumulées au reload.
- **Suggestion :** Audit des durées + respect de `prefers-reduced-motion` (voir 3.4).

---

## 3. Audit des variables CSS

### 3.1 Variables définies (`:root` dans style.css)

| Variable | Valeur | Rôle supposé |
|---|---|---|
| `--bg` | `#ddd6e8` | Fond global |
| `--card` | `rgba(255,255,255,0.88)` | Fond des cartes |
| `--solid` | `#fff` | Fond solide (boutons header, inputs) |
| `--pink` | `#e8a0bf` | Accent rose |
| `--lilac` | `#b090d0` | Accent principal (primary) |
| `--mint` | `#80d0a8` | Accent vert (succès implicite) |
| `--peach` | `#e8c4a0` | Accent secondaire (peu utilisé) |
| `--sky` | `#88bee8` | Accent secondaire (peu utilisé) |
| `--coral` | `#e09090` | Accent danger (utilisé pour `--btn-d`) |
| `--gold` | `#e8d088` | Inutilisé |
| `--tama` | `#c8d8c0` | Fond écran tamagotchi |
| `--text` | `#38304a` | Texte principal |
| `--text2` | `#887ea0` | Texte secondaire |
| `--border` | `#ccc4d8` | Bordures |
| `--shadow` | `rgba(56,48,74,0.08)` | Ombres |
| `--sat / --sab / --sal / --sar` | `env(safe-area-inset-*)` | Safe areas iOS |

### 3.2 Variables incohérentes ou hardcodées

#### Variables définies mais peu/pas utilisées
- `--gold` : **0 occurrence** dans style.css (gaspillage).
- `--peach`, `--sky` : 1–2 occurrences (gradients sliders).
- `--solid` : 0 occurrence directe en variable, alors que `#fff` apparaît 6 fois en hardcoded.

#### Couleurs hardcodées qui devraient être des variables
| Fichier | Couleur | Occurrences | Devrait être |
|---|---|---|---|
| style.css | `#c8b8a0`, `#c8b898`, `#b8a888` | menu-book, j90, j-entry | `--paper-line` |
| style.css | `#f4edd8`, `#fff8ee`, `#e8e0d0` | menu-book, menu-circle, j90 | `--paper-bg` |
| style.css | `#6a5a40`, `#a09880` | titres carnet, dates journal | `--paper-text` |
| style.css | `#1a1a1a`, `#0a0a0a`, `#00ff41`, `#007a1f`, `#0f2a0f` | tablette terminal | `--terminal-*` |
| style.css | `#e57373` | Bordure danger card, mood shake | `--danger` (à créer) |
| index.html | `#fde8f0`, `#e0a0c0`, `#c07090`, `#904060` | bouton agenda inline | À déplacer en CSS |

#### Couleurs sémantiques manquantes
Aucune variable claire pour : succès, erreur, warning, info, focus. Toutes les "intentions" passent par les couleurs déco (`--mint`, `--coral`).

**Suggestion :** Créer une couche sémantique :
```
--success: var(--mint)
--danger: var(--coral)
--warning: #e8c068
--info: var(--sky)
--focus-ring: var(--lilac)
```

### 3.3 Système de couleurs

- **Palette limitée** : oui (8 accents max). ✓
- **Sémantique** : faible (cf. ci-dessus).
- **Application des `UI_PALETTES`** : partielle. Les modules `j90`, `menu-book` et `tablet-box` ne respectent pas la palette → discordance.

### 3.4 Animations & transitions

#### Inventaire
| Nom | Durée | Easing | Usage |
|---|---|---|---|
| `popBounce` | 0.4s | overshoot | Habitude validée ✿ |
| `bookSlideUp` | 0.35s | overshoot | Ouverture menu |
| `shopOpen` | 0.35s | overshoot | Ouverture modale boutique/agenda |
| `tabletOpen` | 0.2s | ease-out | Ouverture tablette |
| `fu` | 0.2s | ease | Changement de panneau |
| `tamaSway` / `tamaSwayStrong` | 1.4s / 0.9s | ease-in-out infinite | Vent sur Gotchi |
| `shakeRow` | 0.4s | ease | Mood requis (validation) |
| `slideUp` | défini (l.641) | unused ? | À vérifier |

#### Problèmes
- **Pas de `prefers-reduced-motion`** dans tout le CSS. **Critique pour TDAH/troubles vestibulaires.**
- `tamaSwayStrong` à 0.9s en infini : peut être stressant si l'utilisatrice reste longtemps en "vent fort".
- `slideUp` (l.641) défini mais jamais référencé → probablement code mort.

**Suggestion :** Ajouter en fin de fichier :
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 4. Audit du layout

### 4.1 Structure globale

- `#console-top` est en `position: fixed` (haut), `#dynamic-zone` est `flex:1; overflow-y: auto` avec `padding-top: calc(var(--console-height, 320px) + 8px)`.
- La hauteur de la console est **calculée en JS** (`syncConsoleHeight` dans ui.js:32) et injectée dans `--console-height`. Si le JS plante avant cet appel, le padding par défaut (320px) peut couper le contenu.
- `max-width: 460px` sur `#dynamic-zone` ✓ (évite l'étirement sur tablette).
- Pas de `min-width` testée → sur iPhone SE (320px), risque de débordement de `.tama-shell` (max-width 340px).

#### 🟠 IMPORTANT — Layout dépendant du JS
- **Fichier :** `style.css` + `ui.js`
- **Suggestion :** Ajouter un fallback CSS `min-height` sur `#console-top` ou utiliser CSS pure (calc + viewport).

### 4.2 Scroll

- `#dynamic-zone` scroll vertical ✓.
- `#boutique-contenu` et `#agenda-contenu` : `scrollbar-width: none` + masque webkit. **Bien pour l'esthétique mais retire le retour visuel "il y a plus à scroller"**. Pour TDAH, ce signal manque.
- `-webkit-overflow-scrolling: touch` absent (cf. 2.6).

#### 🟡 MINEUR — Indicateur de scroll absent
- **Suggestion :** Garder une scrollbar fine (style `::-webkit-scrollbar { width: 2px }`) sur les modales pour signaler la possibilité de scroller.

### 4.3 Safe areas

- `--sat`, `--sab`, `--sal`, `--sar` bien définies dans `:root` ✓.
- Appliquées : `#console-top` (top), `#dynamic-zone` (bottom), `#toast` (bottom), `body` (top + sides).
- **Manquant :** `.menu-languette` (bottom 0 sans `--sab`), `#tablet-overlay` (top OK, mais pas bottom), `#update-banner` (top OK).

#### 🟠 IMPORTANT — Languette ignore safe-area-bottom (cf. 2.2)

---

## 5. Propositions d'amélioration prioritaires

### Phase 1 — Corrections critiques (impact fort, effort raisonnable)

**1.1 Corriger le CSS orphelin lignes 619–621**
- Fichier : `css/style.css`
- Problème : 2 propriétés CSS (`word-break`, `overflow-wrap`) flottent hors de toute règle.
- Solution : Identifier le sélecteur attendu (probablement `.modal-box` ou `#mbox`) et envelopper proprement.
- Impact : empêche un débordement texte non géré.

**1.2 Plancher typographique 12px → 13px**
- Fichier : `css/style.css` + `index.html` (font-size inline)
- Solution : Créer `--fs-xs:11px` (réservé timestamps), `--fs-sm:13px`, `--fs-md:15px`, `--fs-lg:18px`. Remplacer toutes les valeurs `font-size: 8px/9px/10px` par les variables.
- Impact : lisibilité immédiate sur iPhone, baisse de fatigue cognitive.

**1.3 Ajouter `prefers-reduced-motion`**
- Fichier : `css/style.css`
- Solution : Bloc media query en fin de fichier.
- Impact : accessibilité essentielle, respect des réglages iOS.

**1.4 Cibles tactiles 44×44**
- Fichier : `css/style.css`
- Cibles : `.nav-a`, `.menu-btn`, badges header.
- Solution : `min-width: 44px; min-height: 44px` ou `padding: 12px` + repositionnement.
- Impact : moins de fausses touches.

**1.5 Bouton ✕ persistant sur `.modal-box`**
- Fichier : `index.html` (dans le template `#mbox` injecté par ui.js) + `css/style.css`
- Solution : Ajouter un `.modal-close` absolute en haut à droite, 44×44.
- Impact : élimine la sensation de cul-de-sac.

**1.6 Indicateur de panneau actif dans le menu**
- Fichier : `js/ui.js` (function `goMenu`) + `css/style.css`
- Solution : Toggler une classe `.active` sur `.menu-circle` correspondant à `.pnl.on`.
- Impact : repère permanent.

### Phase 2 — Quick wins visuels

**2.1 Variables sémantiques `--success / --danger / --warning / --info / --focus-ring`**
- Fichier : `css/style.css` (`:root`)
- Solution : Ajouter les 5 variables, remplacer les `#e57373` etc.
- Impact : code plus propre, palette future plus simple à modifier.

**2.2 États `:focus-visible` sur tous les contrôles**
- Fichier : `css/style.css`
- Solution : `outline: 3px solid var(--focus-ring); outline-offset: 2px` sur `.btn`, `.menu-btn`, `.menu-circle`, `.nav-a`, `.pin-k`, `.inp`.
- Impact : accessibilité clavier.

**2.3 État `:disabled` standardisé sur `.btn`**
- Fichier : `css/style.css`
- Solution : `.btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }`
- Impact : feedback clair quand quota IA atteint.

**2.4 Foncer `--text2`**
- Fichier : `css/style.css` + `data/config.js` (toutes les palettes)
- Solution : Tester `#6e5e8c` (lavande), assombrir tous les `text2` des palettes.
- Impact : passage WCAG AA.

**2.5 Languette respect safe-area**
- Fichier : `css/style.css` (`.menu-languette`)
- Solution : `padding-bottom: calc(8px + var(--sab));` + `bottom: var(--sab)`.
- Impact : plus de bouton caché par la barre iOS.

**2.6 ARIA labels sur boutons icône**
- Fichier : `index.html`
- Solution : Ajouter `aria-label="Ouvrir la boutique"` etc. sur les ~8 boutons icônes.
- Impact : accessibilité lecteur d'écran.

### Phase 3 — Refontes plus ambitieuses

**3.1 Unifier les 3 langages graphiques**
- Fichiers : `css/style.css` + `data/config.js`
- Solution : Étendre `UI_PALETTES` avec `paperBg`, `paperLine`, `paperText`, `terminalBg`, `terminalText`. Refactoriser `.j90`, `.menu-book`, `#tablet-box` pour les utiliser.
- Impact : changer de palette teinte VRAIMENT toute l'app.

**3.2 "Next action" highlight sur `#p-gotchi`**
- Fichier : `js/ui.js` (`renderHabs`) + `css/style.css`
- Solution : Identifier la première `.hab:not(.done)` et lui appliquer `.hab--next` (anneau lilac, label "À faire maintenant").
- Impact : démarre la session sans coût décisionnel.

**3.3 Sectionner `#p-settings` en collapsibles**
- Fichier : `index.html` + `css/style.css`
- Solution : 3 sections (Compte / Données / Avancé) avec `<details>` ou collapsibles maison.
- Impact : moins d'overload, danger zone moins exposée.

**3.4 Système de typographie + design tokens**
- Fichier : `css/style.css`
- Solution : Bloc `:root` avec tokens (`--fs-*`, `--space-*`, `--radius-*`, `--shadow-*`), refactoring progressif.
- Impact : maintenance + cohérence à long terme.

**3.5 Repenser le menu sans languette ?**
- Fichier : `index.html` + `css/style.css` + `js/ui.js`
- Solution : Tester une **tab bar bottom** persistante (Gotchi / Progrès / Journal / Inventaire / Plus) à la place de la languette. Pattern iOS standard.
- Impact : 1 tap pour changer de panneau, repère constant. ⚠️ Casse l'identité "carnet/livre" — à valider esthétiquement.

---

## 6. Wishlist UX

### Patterns d'apps bien-être à explorer

- **Finch** : "next action" toujours visible, micro-récompense à chaque tap, animations très douces (pas d'overshoot agressif). À tester sur la barre XP.
- **Bearable** : tracker symptômes/humeur ; sliders avec retour instantané + label émotionnel ("aujourd'hui, ça va ✿"). À adapter au mood-picker journal.
- **Streaks** (iOS) : carte du jour avec une seule habitude mise en avant en gros, le reste dans le scroll. Réduit la charge.
- **Headspace** : utilise des transitions de couleur du fond pour signaler l'état (jour/nuit/calme/énergique). À explorer avec `ENV_THEMES`.
- **Daylio** : journal entry en 3 taps max (mood → tag → note). Vérifier que le flow journal HabitGotchi tient en 3 actions.

### Micro-interactions manquantes

- **Confettis discrets** quand toutes les habitudes du jour sont validées (jamais bloquant, fade rapide).
- **Pulse subtil** sur la barre XP quand elle gagne des points (≠ animation déjà présente, plutôt un glow).
- **Haptic feedback** (`navigator.vibrate(10)`) au tap d'une habitude validée — déjà supporté en PWA.
- **Pull-to-refresh** sur `#p-progress` pour regénérer les stats — mobile-natif.
- **Long-press** sur une habitude pour accès rapide (édition, suppression) au lieu d'un menu séparé.

### Onboarding

- Aucun onboarding détecté dans l'inventaire. À vérifier dans `app.js`.
- **Suggestion :** Première ouverture → 3 écrans très courts (1 phrase chacun) : "1. Choisis le nom du Gotchi" / "2. Voici tes intentions du jour" / "3. La languette en bas, c'est ton menu". Skip-able.

### Raccourcis quotidiens

- **Widget iOS PWA** ? Limité techniquement, mais une raccourci-icône iOS "Cocher l'habitude X" via shortcuts pourrait être documenté.
- **Notification quotidienne** rappel doux à heure choisie (déjà possible via Notification API).

---

## RÈGLES UTILISÉES POUR CET AUDIT

- ✅ Aucun fichier modifié.
- ✅ Chaque problème cite une classe ou un id concret.
- ✅ Chaque problème mentionne l'impact TDAH.
- ✅ Aucune solution n'est livrée en code complet — uniquement des pistes.
- ✅ Le fichier est à la racine du projet sous le nom `AUDIT_DESIGN.md`.

---

*Audit produit le 2026-04-26 pour la branche `Annotation` / version `hg-v3.02`.*
