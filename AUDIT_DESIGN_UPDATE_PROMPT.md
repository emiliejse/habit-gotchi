# MISE À JOUR AUDIT_DESIGN.md — HabitGotchi

> **Usage :** Coller ce prompt dans Claude Code (modèle Opus) à la racine du repo `habit-gotchi`.
> Opus lira les fichiers lui-même. Le fichier `AUDIT_DESIGN.md` existant doit être mis à jour, pas remplacé.
> **Fichier de sortie :** réécrire `AUDIT_DESIGN.md` à la racine du repo en conservant les sections valides et en ajoutant les nouvelles.

---

## Contexte & périmètre

Tu mets à jour l'audit design de HabitGotchi, une PWA mobile de bien-être gamifiée (style Tamagotchi pixel art), destinée à des personnes TDAH.

**Ce qui a changé depuis le dernier audit (2026-04-30) :**
- La structure JS a été refactorisée : `ui.js` a été découpé en modules (`ui-core.js`, `ui-habs.js`, `ui-shop.js`, `ui-ai.js`, `ui-journal.js`, `ui-agenda.js`, `ui-settings.js`, `ui-nav.js`). Toutes les références à `js/ui.js` dans l'ancien audit sont probablement obsolètes.
- Un `AUDIT.md` général a été produit depuis — le lire pour connaître l'état actuel avant de commencer.
- Des fichiers render ont également évolué : `render.js` et `render-sprites.js`.

**Fichiers à lire avant tout :**
- `AUDIT.md` → état général actuel du projet
- `AUDIT_DESIGN.md` → audit existant à mettre à jour (ne pas perdre ce qui est encore valide)
- `css/style.css` → source de vérité CSS
- `index.html` → structure DOM complète
- `js/ui-core.js`, `js/ui-habs.js`, `js/ui-shop.js`, `js/ui-ai.js`, `js/ui-journal.js`, `js/ui-agenda.js`, `js/ui-settings.js`, `js/ui-nav.js` → HTML inline et styles inline dans chaque module
- `data/config.js` → `UI_PALETTES`, constantes visuelles
- `data/props.json` → catalogue objets (pour la section icônes/assets)

**Principes impératifs :**
- Ne jamais réécrire un fichier entier — cibler les blocs concernés avec numéros de ligne exacts
- Langue de réponse : français
- Toute variable CSS nouvelle doit respecter la convention de nommage existante (`--fs-*`, `--sp-*`, `--c-*`)
- L'ADN pixel art est non négociable — moderniser sans trahir

---

## ÉTAPE 0 — Mise à jour du référentiel existant

Avant d'ajouter du contenu, mettre à jour l'audit existant :

→ Relire chaque item de la roadmap design (Sections A→M de l'ancien `AUDIT_DESIGN.md`)
→ Pour chaque item : marquer **✅ RÉSOLU**, **🔄 PARTIELLEMENT RÉSOLU**, ou **🔴 TOUJOURS OUVERT**
→ Mettre à jour les références de fichiers obsolètes (`js/ui.js:XXX` → nouveau module + ligne)
→ Mettre à jour le tableau de scores (Section 0) si des améliorations ont été faites
→ Conserver intégralement les sections encore valides (inventaire interface, structure DOM, etc.)

---

## SECTION A — AUDIT CSS : SYSTÈME DE VARIABLES & THÈMES

### A1. Inventaire complet des variables CSS actuelles
→ Lire `css/style.css` en entier, extraire toutes les variables définies dans `:root`
→ Pour chaque variable : nom, valeur, usages trouvés dans CSS + HTML inline + JS
→ Identifier :
  - Variables **définies mais jamais utilisées** (code mort)
  - Variables **utilisées mais non définies** (bugs silencieux)
  - Variables **hardcodées en doublon** (valeur répétée en dur alors qu'une variable existe)

Format tableau :

| Variable | Définie dans | Utilisée dans (fichiers) | Statut |
|----------|-------------|--------------------------|--------|
| `--lilac` | `:root` | style.css, ui-shop.js | ✅ OK |
| `--c-border` | ❌ non définie | ui-habs.js:XXX | 🔴 Bug |

### A2. Proposition d'un système de thèmes extensible
L'objectif est qu'HabitGotchi soit facilement personnalisable à l'avenir (thèmes saisonniers, thème nuit, thème utilisateur via `user_config`).

→ Proposer une architecture de variables CSS en couches :

```
Couche 1 — Primitives (valeurs brutes)
  --color-lilac-400: #b8a0e8;
  --color-lilac-200: #d8c8f8;

Couche 2 — Tokens sémantiques (rôles)
  --primary: var(--color-lilac-400);
  --bubble-bg: var(--color-lilac-200);
  --surface: var(--solid);

Couche 3 — Thème (overrides par data-theme="dark" etc.)
  [data-theme="night"] { --primary: ...; }
```

→ Identifier les variables actuelles qui correspondent déjà à chaque couche
→ Proposer les renommages/ajouts nécessaires pour compléter le système
→ Montrer comment `UI_PALETTES` dans `config.js` s'articulerait avec cette architecture (override JS → CSS custom properties via `document.documentElement.style.setProperty`)
→ Fournir le bloc `:root` cible complet (primitives + tokens sémantiques)

### A3. Audit des styles inline dans les modules JS
→ Parcourir tous les modules `ui-*.js`
→ Lister tous les styles inline (`style="..."`) et couleurs hardcodées dans les chaînes HTML
→ Pour chacun : proposer le token CSS correspondant ou la classe CSS à créer
→ Estimer l'effort de migration (S/M/L)

---

## SECTION B — AUDIT HTML : PROPRETÉ & MAINTENABILITÉ

### B1. Audit de `index.html`
→ Vérifier que tous les éléments ont un `id` ou une classe nommée sémantiquement
→ Identifier les éléments avec styles inline qui devraient être en CSS
→ Identifier le code mort (éléments cachés avec `display:none !important`, commentaires obsolètes)
→ Vérifier la cohérence des `aria-label`, `role`, `aria-live` sur les zones interactives et dynamiques
→ Vérifier que l'ordre de chargement des scripts correspond bien à la dépendance réelle des modules

### B2. Cartographie du HTML généré dans les modules JS
→ Pour chaque module `ui-*.js`, lister les fragments HTML injectés via `innerHTML`
→ Identifier les classes CSS utilisées dans ces fragments qui ne sont PAS définies dans `style.css` (classes orphelines → styles inactifs silencieux)
→ Identifier les classes CSS définies dans `style.css` qui ne sont JAMAIS utilisées dans le HTML (CSS mort)

Format tableau :

| Classe CSS | Définie dans style.css | Utilisée dans HTML/JS | Statut |
|------------|----------------------|----------------------|--------|
| `.mood-b` | ✅ ligne XXX | ✅ ui-journal.js:XXX | OK |
| `.shop-tag` | ❌ absente | ui-shop.js:XXX | 🔴 Orpheline |

### B3. Cohérence des nommages
→ Vérifier la cohérence des préfixes de classes (`.btn-*`, `.card-*`, `.p-*`, `.hab-*`…)
→ Identifier les classes qui ne respectent pas les conventions de nommage
→ Proposer un guide de nommage court (10-15 règles) à ajouter en tête de `style.css`

---

## SECTION C — PROPOSITIONS DE REDESIGN UX/UI

> Contrainte : moderniser en conservant l'ADN pixel art. Propositions ambitieuses mais réalisables en CSS/HTML sans refonte du canvas p5.js.

### C1. Navigation & orientation
→ **Languette menu** : proposer un indicateur visuel d'état ouvert/fermé (ex : animation de la languette, changement d'icône ☰ → ✕, badge de l'onglet actif)
→ **Mode compact** : proposer un indicateur discret de l'onglet actif quand `#console-top` est en mode compact (ex : dot coloré, label minuscule)
→ **Modales empilées** : proposer une solution légère pour le retour navigationnel (boutique → détail objet → confirmation) sans complexifier l'architecture modale actuelle
→ Pour chaque proposition : mockup textuel ASCII ou description précise, fichiers concernés, effort estimé

### C2. Accueil & zone gotchi
→ **Carte d'état** (nom / stade / XP) : proposer une hiérarchie visuelle plus forte — le stade et le nom doivent être immédiatement lisibles, la barre XP plus expressive (pixel art progress bar animée ?)
→ **Zone pensée IA** : proposer une mise en scène plus immersive de la bulle de pensée (entrée animée, relation visuelle plus claire avec le gotchi)
→ **Mini-bar habitudes** : proposer des micro-animations de validation (pixel art confetti, pétale qui tombe) compatibles avec `prefers-reduced-motion`
→ **Quota fleurs** : proposer une visualisation plus expressive (ex : fleurs qui poussent progressivement en pixel art SVG plutôt que compteur texte)

### C3. Journal & humeurs
→ **Mood picker** : proposer un redesign des boutons d'humeur — faces pixel art SVG au lieu des emojis système, taille 44px minimum, avec micro-animation au tap
→ **Entrées journal** : proposer une meilleure hiérarchie entre la date, l'humeur et le texte — actuellement plat
→ **Export** : proposer un bouton export plus visible et mieux intégré

### C4. Boutique & inventaire
→ **Filtres** : proposer un redesign des filtres ronds — trop petits, peu lisibles
→ **Carte objet** : proposer une mise en scène plus riche de la carte objet (nom, coût en pétales, aperçu pixel art) — actuellement minimaliste
→ **Objets actifs vs rangés** : proposer une distinction visuelle plus forte entre les deux états

### C5. Progrès & stats
→ **Calendrier hebdo** : proposer une visualisation plus riche (heat map pixel art, icônes humeur par jour)
→ **Statistiques** : proposer un redesign des 3 cellules (série / XP / journal) — vers des "cartes stat" pixel art avec icône dédiée
→ **Bilan IA** : proposer une mise en forme plus lisible de la réponse Claude (typographie, séparation visuelle)

### C6. États du gotchi & feedbacks
→ **Sliders énergie/bonheur** : proposer un redesign du bottom sheet — plus pixel art, plus expressif
→ **État `loading` IA** : proposer un composant standard `.btn.is-loading` avec animation pixel art (3 points qui clignotent, sprite animé…)
→ **Toasts** : proposer des variantes visuelles selon le type (succès / info / erreur) en utilisant les variables sémantiques `--success`, `--warning`

---

## SECTION D — ICÔNES, ÉMOJIS & ASSETS VISUELS

C'est une section nouvelle — non couverte dans l'ancien audit.

### D1. Inventaire des emojis & icônes actuels
→ Parcourir `index.html` et tous les modules `ui-*.js`
→ Lister tous les emojis utilisés comme icônes fonctionnelles (pas décoratifs) avec leur contexte
→ Lister tous les emojis utilisés dans les libellés de boutons, labels, titres

Format tableau :

| Emoji | Contexte | Fichier / ligne | Rôle fonctionnel | Candidat au remplacement |
|-------|----------|-----------------|-----------------|--------------------------|
| 🛍️ | Bouton boutique | index.html:XXX | Navigation | Oui — PNG pixel art |
| ✕ | Fermeture modale | ui-core.js:XXX | Action | Non — garder texte |

### D2. Plan de remplacement par des assets custom
Pour chaque emoji identifié comme candidat au remplacement :
→ Proposer le format cible : **PNG pixel art** (pour les icônes de navigation et les boutons principaux) ou **SVG inline** (pour les icônes d'état et les micro-éléments)
→ Décrire visuellement l'asset cible en style pixel art (ex : "sac à provisions 8×8px, couleur `--primary`, fond transparent, rendu crisp")
→ Indiquer la taille cible et les états nécessaires (normal / hover / active / disabled)
→ Proposer une **structure de dossier** pour les assets : `assets/icons/` avec convention de nommage

### D3. Système d'icônes pixel art proposé
→ Proposer une approche technique pour un système d'icônes cohérent :
  - Option A : sprite sheet PNG unique + `background-position` CSS
  - Option B : SVG inline avec `currentColor` pour héritage de couleur
  - Option C : `<img>` PNG individuels avec `image-rendering: pixelated`
→ Recommander l'option la plus adaptée à la stack actuelle (p5.js + LocalStorage + pas de bundler)
→ Proposer les 5-8 icônes prioritaires à créer en premier (celles qui ont le plus d'impact visuel)

### D4. Emojis à conserver
→ Identifier les emojis qui doivent rester (contenu éditorial, personnalité du gotchi, bulles) — pas les remplacer par des assets techniques
→ Distinguer clairement : emoji comme **icône UI** (à remplacer) vs emoji comme **langage du gotchi** (à conserver)

---

## SECTION E — ACCESSIBILITÉ & MOBILE (mise à jour)

→ Revérifier toutes les cibles tactiles après la refactorisation JS — les corrections de l'ancien audit ont-elles été appliquées ?
→ Vérifier `--sab` : est-il maintenant défini avec `env(safe-area-inset-bottom, 0px)` ?
→ Vérifier les `aria-live` sur les zones IA (`#bubble`, `#claude-msg`, `#claude-summary`)
→ Vérifier le comportement en mode paysage (iPhone) — `--sal`/`--sar` avec `env()`
→ Tester mentalement le parcours "cocher une habitude" de bout en bout pour un utilisateur TDAH : chaque étape crée-t-elle de la friction ou du plaisir ?

---

## LIVRABLES ATTENDUS

Réécrire `AUDIT_DESIGN.md` avec la structure suivante :

```markdown
# AUDIT_DESIGN.md — HabitGotchi [VERSION]
Audit design / CSS / HTML / assets — mise à jour [DATE]
Périmètre : css/style.css, index.html, js/ui-*.js (HTML & styles inline)
Hors périmètre : render.js, envs.js, logique JS pure

## SECTION 0 — Résumé exécutif
[Tableau de scores mis à jour + top 3 problèmes + top 3 quick wins]

## SECTION 1 — Inventaire de l'interface [mis à jour]
[Panneaux, modales, HUD, navigation — références de fichiers corrigées]

## SECTION 2 — Audit CSS
[Variables, thèmes, styles inline — Section A du prompt]

## SECTION 3 — Audit HTML
[Propreté, cartographie, cohérence — Section B du prompt]

## SECTION 4 — Propositions de redesign UX/UI
[Section C du prompt — ambitieuses mais réalistes]

## SECTION 5 — Icônes, émojis & assets visuels
[Section D du prompt — plan de remplacement + système d'icônes]

## SECTION 6 — Accessibilité & mobile [mis à jour]
[Section E du prompt]

## SECTION 7 — Roadmap design priorisée [mise à jour]
[Items anciens mis à jour (✅/🔄/🔴) + nouveaux items issus de cet audit]
| Priorité | ID | Description | Fichiers | Effort | Impact TDAH |
|----------|----|-------------|----------|--------|-------------|

## SECTION 8 — Guide de nommage CSS (nouveau)
[10-15 règles, à ajouter en tête de style.css]

## SECTION 9 — Wishlist UX [mise à jour]
[Anciens items + nouveaux issus des propositions]
```

**Format :** Markdown structuré, blocs de code avec numéros de ligne quand possible.
**Langue :** français.
**Principe :** ne jamais réécrire un fichier entier — cibler les blocs concernés.
**Pour les propositions design :** être ambitieux mais réaliste — chaque proposition doit être implémentable sans refonte du canvas p5.js.
