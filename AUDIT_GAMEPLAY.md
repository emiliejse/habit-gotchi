# AUDIT GAMEPLAY — HabitGotchi
> Généré par Claude Opus — 2026-05-01
> Version auditée : **v4.81** (`js/app.js:60`)
> Mise à jour mécaniques faible effort — 2026-05-01

---

## Résumé exécutif

L'économie pétales est lisible et stable, mais elle est **trop linéaire et trop maigre** : +2 pétales par habitude validée, +2 par snack (4 si préféré), +2 par crotte nettoyée — aucune mécanique de streak, aucun pic de récompense, aucune montée en intensité. Pour un public TDAH, **le shoot dopaminergique est trop plat** et la rétention repose presque entièrement sur la curiosité (IA, évolution).

Côté états, le gotchi expose `energy` et `happiness` (0-5), plus `salete` (0-10), mais **aucun état "faim" indépendant** : le repas ne nourrit qu'une fenêtre horaire, pas une jauge. Le système est sous-exploité visuellement. Les transitions de stade (8 paliers de XP, jusqu'à 4000) sont solides mais probablement **trop longues à atteindre** sans micro-paliers visibles.

Trois priorités d'action :
1. **Ajouter une jauge ou un compteur de streak** par habitude avec récompense escalante.
2. **Reset explicite de `salete`** lors du nettoyage (actuellement la jauge ne redescend jamais → dette critique).
3. **Densifier le feedback visuel** à chaque gain de pétale (toast, particule, son court).

---

## Dette gameplay (triée par criticité)

| Priorité | Système | Problème | Fichier / ligne |
|----------|---------|----------|-----------------|
| ✅ FIXÉ | S5 Saleté | `D.g.salete = 0` ajouté dans `cleanPoops()` — reset après nettoyage (2026-05-01) | `js/app.js:683` |
| ✅ FIXÉ | S5 Saleté | Seuil dithering abaissé 5→2, ratio recalibré `(salete-2)/8` — saleté visible dès 1-2 crottes (2026-05-01) | `js/render-sprites.js:330,373` |
| ✅ FIXÉ | S5 Saleté | Effet taches organiques : distribution random fixe (hash déterministe), tailles variables (PX/1.5/2), opacité par pixel — remplace le damier uniforme (2026-05-01) | `js/render-sprites.js:261-416` |
| ✅ FIXÉ | S5 Saleté | Crotte garantie au bootstrap si `poopCount === 0` pour le jour courant — engagement assuré (2026-05-01) | `js/app.js:512-520` (dans `checkSalete`) |
| ✅ FIXÉ | S2 Habitudes | Streaks par habitude implémentés — `computeStreaks()` relit `D.log`, bonus pétales +N (cap 7), badge 🔥×N dans `renderHabs()`, recalcul au daily reset (2026-05-01) | `js/app.js:760-800`, `js/ui-habs.js:39-55` |
| ✅ FIXÉ | S2 Habitudes | Pénalité XP implémentée — `checkMissedHabits()` au bootstrap : −5 XP par habitude manquée la veille (cap −20), bulle douce pool ×3, log dans `eventLog`. `happiness` et `energy` non modifiés (auto-report uniquement). Guard `lastMissedPenalty` (migration m7) — une seule fois par jour. (2026-05-01) | `js/app.js:bootstrap`, `defs()`, `MIGRATIONS` |
| ✅ FIXÉ | S3 États | Jauge `hunger` (0-3) implémentée — monte si fenêtre repas manquée, reset à 0 dès un repas pris, bulle "j'ai faim" si `hunger >= 2`, priorité 2 dans `updBubbleNow()`. `energy` et `happiness` non touchés (auto-report utilisatrice uniquement). Migration m8 ajoutée. (2026-05-01) | `js/app.js:194` (defs), `js/app.js:532-580` (checkHunger), `js/app.js:651-656` (giveSnack reset), `js/app.js:1229-1246` (updBubbleNow) |
| ✅ FIXÉ | S1 Progression | Micro-paliers adultes implémentés — `getMicroPalier(xp)` retourne un indice 0-9 tous les 200 XP à partir de 500. Suffixe romain intégré directement dans le label de stade (`#g-stage`) : "Adepte" → "Adepte II" → "Adepte III"… Aucune modification de STG ni migration. (2026-05-01) | `js/app.js:458-462` (getMicroPalier), `js/ui-settings.js:208-214` (updUI) |
| ✅ FIXÉ | S6 IA | Limites quotidiennes strictes (3 pensées + 3 soutien + 1 objet) sans compensation visible côté UI — **Fixé 2026-05-01** : fleurs ✿ soutien ajoutées sur le post-it menu (`#soutien-flowers`, même pattern que `#thought-count`) ; infos RDV du jour (icônes extraites du label) + phase cycle (`● Label Jn`) ajoutées sur le post-it agenda (`#agenda-postit-info`, `updAgendaPostit()`). L'objet IA n'a pas de limite — freiné par les pétales. | `js/ui-ai.js:189, 597` · `index.html:486-496` · `js/ui-settings.js:updSoutienFlowers, updAgendaPostit` · `css/style.css:.agenda-postit-info, #soutien-flowers` |
| ✅ FIXÉ | S4 Snacks | ~~Pas de `lockScroll()` sur la fenêtre snack~~ — les 4 branches de `ouvrirSnack()` passent par `openModal()`, lockScroll unifié. (2026-05-01) | `js/ui-settings.js:43-122` |
| ✅ FIXÉ | S1 Économie | Bonus "journée complète" +2 pétales quand toutes les habitudes du jour sont cochées — guard `__journee_complete__` dans `petalesEarned`, 1×/jour, bulle dédiée si bonus disponible. Maintient les multiples de 2 de l'économie. (2026-05-01) | `js/app.js` — `toggleHab()` ~L1046 |
| ✅ FIXÉ | S5 Crottes | Probabilité de spawn modulée par état du Gotchi : 25% si faim≥2 / 35% si énergie≤3 / 80% si bien nourri / 60% normal — remplace le 65% fixe (2026-05-01) | `js/app.js:maybeSpawnPoop` |
| ✅ FIXÉ | S3 États | Bulle dédiée `salete >= 7` sans crottes visibles — Priorité 1b dans `updBubbleNow()`, 5 variantes diurnes ("ça commence à sentir le renard", "*se renifle*", etc.) (2026-05-01) | `js/app.js` (dans `updBubbleNow()`) |
| 🟢 BAS | S8 Notifications | Aucune notification native (Notification API jamais appelée) — **session dédiée à planifier** | — |
| 🚫 SKIP | S7 Inventaire | Seuls 2 paliers de prix (0 ou 6) → pas de hiérarchie d'objets désirables — **prix du catalogue non modifiés (décision 2026-05-01)** | `data/props.json` |

---

## Section 1 — Progression & Économie

### 1a. Diagnostic

**Constantes (`data/config.js:204-212`)**
```
XP_HABITUDE     = 15
XP_NOTE         = 15
XP_MAX          = 1200
PETALES_SNACK   = 2
```

**Stades de vie (`js/app.js:142-151`)**
8 paliers : `egg(0) → baby(90) → teen(240) → adult(500, 900, 1500, 2500, 4000)`.
La fonction `addXp(n)` (`js/app.js:437-456`) gère la transition de stade ; `getSt(xp)` retourne le stade courant.

**Sources de pétales**
| Source | Gain | Référence |
|---|---|---|
| Cocher une habitude (1×/jour/hab) | +2 | `js/app.js:771` |
| Bonus streak habitude (cap 7j) | +N | `js/app.js:926` |
| Snack basique | +2 | `js/app.js:624` (`gain = 2`) |
| Snack préféré de la semaine | +4 | `js/app.js:624` (`isFav ? 4 : 2`) |
| Nettoyer une crotte | +2/crotte | `js/app.js:673` |
| Bain complet (salete → 0) | +2 | `js/render.js:1845` |
| ✅ Toutes habitudes cochées (1×/jour) | +2 | `js/app.js:toggleHab()` ~L1046 — guard `__journee_complete__` |

**Dépenses de pétales**
| Sortie | Coût | Référence |
|---|---|---|
| Objet boutique | 0 ou 6 | `data/props.json` |
| Génération d'objet IA | 10 | `js/ui-ai.js:301-304` |

**XP** : +15 par habitude validée, +15 par note de journal. Cap à 1200 — **incohérent avec les seuils adulte qui montent à 4000** (`js/app.js:142-151`). Le cap empêche la transition naturelle vers les stades adultes supérieurs si appliqué strictement.

### 1b. Évaluation TDAH

- ❌ **Rétroaction trop faible** : +2 pétales par habitude n'est pas un événement émotionnel.
- ❌ **Aucun streak / combo** : la régularité n'est pas valorisée alors que c'est exactement ce qui manque structurellement aux profils TDAH.
- ❌ **Sauts de stade rares** : entre teen (240 XP) et adult-2 (900 XP) il faut ~44 habitudes — au-delà du seuil "j'oublie pourquoi je le fais".
- ✅ La logique de gain est **immédiate** (synchrone, sans cooldown).

### 1c. Propositions

1. **Streaks cumulatifs** : une habitude cochée N jours d'affilée donne +N pétales bonus (cap 7).
2. **Micro-paliers visuels** dans les stades adulte (frame de fond, halo, accessoire automatique tous les +200 XP).
3. **Burst visuel** à chaque gain de pétale (particule + bobY court sur le gotchi).
4. ✅ **`XP_MAX` aligné à 4000** — `data/config.js:206`. "MAX ✿" s'affiche désormais uniquement au dernier stade (Déesse). L'accumulation d'XP au-delà de 4000 reste illimitée dans `addXp()`. (2026-05-01)

---

## Section 2 — Habitudes

### 2a. Diagnostic

**Catégories** (`js/app.js:132-139`) — 6 fixes : `sport, nutri, hydra, hygiene, intel, serene`. Définies en dur, non extensibles côté UI.

**Cycle d'une habitude** (`js/app.js:750-831`)
1. `toggleHab()` ajoute l'entrée dans `D.log[today]`.
2. +15 XP via `addXp()`.
3. +2 pétales **une seule fois par jour par habitude** (garde via `petalesEarned` ligne 772-776).
4. Bulle de réaction du gotchi.
5. `save()`.

**Reset quotidien** : implicite — `D.log[td]` est créé vide chaque jour (`js/app.js:752`). Aucune trace conservée du fait qu'une habitude a été manquée la veille.

**Streaks** : ✅ implémentés — `computeStreaks()` + bonus pétales + jalons 3/7/14j (2026-05-01).
**Pénalités habitudes manquées** : ✅ implémentées — `checkMissedHabits()` au bootstrap, −5 XP/habitude manquée la veille (cap −20), bulle douce, `happiness`/`energy` non touchés (2026-05-01).

### 2b. Évaluation TDAH

- ✅ Cycle simple, pas de friction de configuration (catégories prédéfinies).
- ❌ **Aucune mémoire émotionnelle** entre les jours. Pour un profil TDAH, c'est la régularité qui mérite la récompense la plus forte — précisément ce qui manque ici.
- ⚠️ Risque de **désengagement passif** : on coche, on encaisse +2, on referme. Pas de "ça vaut le coup d'y revenir demain".

### 2c. Propositions

1. ✅ **Compteur de streak par habitude** affiché à côté de la case (🔥×N). Reset si jour sauté. — implémenté 2026-05-01
2. ✅ **Bulle spéciale du gotchi** aux jalons 3/7/14 jours — 3 variantes par jalon, délai 1.2s, bounce + particules. — implémenté 2026-05-01
3. ✅ **Pénalité XP si habitude manquée** — `checkMissedHabits()` au bootstrap, −5 XP/hab (cap −20), bulle douce. `happiness` non touché (auto-report uniquement). (2026-05-01)
4. **Habitude contextuelle simple** : 1 catégorie tirée au sort le matin = "habitude vedette du jour" qui rapporte +4 au lieu de +2.

---

## Section 3 — États & Visuels

### 3a. Diagnostic

**États tracés** (`js/app.js:183-194`)
```
energy: 3      (échelle 0-5) — auto-report utilisatrice uniquement
happiness: 3   (échelle 0-5) — auto-report utilisatrice uniquement
salete: 0      (échelle 0-10)
hunger: 0      (échelle 0-3) — ✅ IMPLÉMENTÉ 2026-05-01
```

**hunger** : monte d'1 par fenêtre repas manquée (fin de créneau passée sans repas pris), plafonné à 3. Reset à 0 dans `giveSnack()`. Bulle dédiée au bootstrap si `hunger >= 2`. `energy` et `happiness` ne sont jamais modifiés automatiquement.

**Seuils visuels** (`data/config.js:221-233`)
```
EN_CRIT=1, EN_WARN=2, EN_TILT=2     → dithering, bras tombants, balancement
HA_SAD=1, HA_MED=2, HA_MED_ADULT=3, HA_HIGH=4   → bouches, nuages, sourires
```

**Saleté visuelle** (`js/render-sprites.js:330,373`) — ✅ seuil dithering abaissé 5→2, ratio recalibré `(salete-2)/8` — saleté visible dès 1-2 crottes (2026-05-01). Effet taches organiques (distribution hash déterministe, tailles variables PX/1.5/2, opacité par pixel) remplace l'ancien damier uniforme.

**États orphelins / dette**
- ✅ `salete` : bulle dédiée ajoutée dans `updBubbleNow()` (Priorité 1b, seuil >= 7) — 2026-05-01.
- `energy` et `happiness` n'ont pas de transition animée — changement abrupt frame à frame.

### 3b. Évaluation TDAH

- ✅ Lisibilité d'un coup d'œil correcte : posture + expression visage.
- ❌ **Transitions abruptes** d'état (pas d'easing).
- ✅ Saleté visible dès 1-2 crottes — seuil et rendu recalibrés (2026-05-01).

### 3c. Propositions

1. ✅ **Recalibrer `salete`** : seuil dithering abaissé à 2, ratio recalibré, taches organiques — dès la 1re-2e crotte. (2026-05-01)
2. ✅ **Jauge `hunger`** (0-3) implémentée — monte si fenêtre manquée, reset au repas, bulle dédiée. `happiness` non touché (auto-report uniquement). (2026-05-01)
3. **Easing 1s** sur les changements d'energy/happiness (lerp côté render).
4. ✅ Bulle dédiée dans `updBubbleNow()` quand `salete >= 7` (Priorité 1b, 5 variantes diurnes). (2026-05-01)

---

## Section 4 — Repas & Snacks

### 4a. Diagnostic

**Fenêtres horaires** (`data/config.js:164-168`)
```
Matin : 7-11    Midi : 11-15    Soir : 18-22
```

**Logique `ouvrirSnack()`** (`js/ui-settings.js:43-122`) — 4 états UI :
1. **Nuit** (`>= 22h || < 7h`) : modale "le gotchi dort" (l. 50)
2. **Hors fenêtre** (entre les créneaux) : modale "ce n'est pas l'heure" (l. 64)
3. **Déjà mangé** : modale "tu as déjà mangé ce matin/midi/soir" (l. 81)
4. **Choix** : 3 emojis tirés via `pickThreeSnacks()`, dont 1 toujours préféré (l. 96)

**Snack préféré rotatif** (`js/app.js:580-587, 594-604`) : 1 emoji tiré par semaine ISO, persisté dans `D.snackPref`. `pickThreeSnacks()` garantit que le préféré est l'un des 3 proposés.

**Bonus pétales** (`js/app.js:624-633`) : `gain = isFav ? 4 : 2`, créditation atomique.

**Fenêtre 15h-18h non couverte** : le goûter n'existe pas → trou conscient ou dette ?

### 4b. Évaluation TDAH

- ✅ Routine cadrée, peu d'options → faible charge cognitive.
- ✅ Bonus snack préféré = mini-quête de la semaine.
- ❌ Le feedback est sec (toast + pétales) — manque un effet "manger" sur le gotchi (chew, sourire +1s).
- ✅ `lockScroll()` sur la fenêtre snack — résolu 2026-05-01 via `openModal()`.

### 4c. Propositions

1. **Animation manger** : 1.5s avant créditation (chew + emoji du snack qui descend dans le gotchi).
2. **Effet sur happiness** : +1 happiness temporaire (1h) après un repas pris dans la fenêtre.
3. **Goûter optionnel 15h-17h** : fenêtre bonus, +1 pétale seulement, ouverte 1×/jour.
4. **Bulle "j'ai faim"** déclenchée 30 min avant la fenêtre suivante.

---

## Section 5 — Événements Passifs (crottes & saleté)

### 5a. Diagnostic

**Spawn crottes** (`js/app.js:maybeSpawnPoop`)
- Délai min entre spawns : 8 min
- Probabilité par tick : ✅ **modulée par état** (25% si faim≥2 / 35% si énergie≤3 / 80% si bien nourri / 60% normal) — remplace le 65% fixe (2026-05-01)
- Crotte garantie au bootstrap si `poopCount === 0` pour le jour courant — engagement assuré (2026-05-01)
- Pas de spawn entre 22h et 7h
- Max 5 crottes visibles
- `lastPoopSpawn` stocké dans `D.g`

**Catch-up au réveil** (`js/app.js:1194-1197`) : 1 crotte par 50 min d'absence active, max 2.

**Saleté** (`js/app.js:193, 492, 502-510`)
- Init 0
- +1 lors de chaque spawn de crotte
- +1 par tranche de 6h d'inactivité (`checkSalete()`)
- Max 10
- **JAMAIS remise à 0**

**Nettoyage** (`js/app.js:683`) : ✅ `cleanPoops()` vide `D.g.poops` + remet `D.g.salete = 0` après nettoyage — reset confirmé (2026-05-01). +2 pétales par crotte, bulle de feedback.

### 5b. Évaluation TDAH

- ✅ Système passif léger, peu anxiogène (max 5 crottes).
- ✅ Saleté remise à 0 lors du nettoyage — charge invisible supprimée (2026-05-01).
- ✅ Lien crottes ↔ états (faim + énergie) — probabilité de spawn modulée (2026-05-01).

### 5c. Propositions

1. ✅ **Fix critique** : `D.g.salete = 0` ajouté dans `cleanPoops()` — reset après nettoyage. (2026-05-01)
2. ✅ **Lien hunger → spawn** : probabilité modulée par faim + énergie dans `maybeSpawnPoop`. (2026-05-01)
3. **Mini-récompense ponctuelle** au 5e nettoyage cumulé (badge ou +1 happiness).
4. **Bulle de remerciement** distincte selon le nombre de crottes nettoyées (déjà partiellement présent — étendre à 5+).

---

## Section 6 — Interactions IA

### 6a. Diagnostic

**4 interactions IA** (`js/ui-ai.js`)

| Interaction | Limite | Coût | Référence |
|---|---|---|---|
| Pensée quotidienne (`askClaude`) | 3/jour | 0 | l. 164-295 |
| Soutien (`genSoutien`) | 3/jour, 6 messages/session | 0 | l. 568-605, 690 |
| Bilan semaine (`genBilanSemaine`) | implicite ven/sam/dim | 0 | l. 858-952 |
| Création d'objet (`acheterPropClaude`) | 1 sur fond pétales | 10 pétales | l. 300-399 |

**Reset quotidien** : `handleDailyReset()` (`js/app.js:1145-1160`) compare `lastThoughtDate` / `lastSoutienDate` à `today()` et réinitialise les compteurs.

**Variables prompt** (`prompts/ai_contexts.json`) — bien synchronisées avec `window.D` : `nameGotchi, userName, energy, happiness, notesRecentes, traits, style, exemples, heure, date, habitsDone, habitsUndone, cycleInfo, rdvAujourdhui, weekStart, weekEnd, totalHabDays`.

**Loading** : `startThinkingAnim()` / `stopThinkingAnim()` (`js/ui-ai.js:195-310`) anime "💭" pendant le fetch — feedback OK.

**Coût objet IA** : 10 pétales = ~5 habitudes ou ~5 snacks. **Ratio honnête** mais pas excitant ; aucun upsell.

### 6b. Évaluation TDAH

- ✅ Limites quotidiennes protègent du surmenage et du shoot compulsif.
- ✅ Loader animé, pas de freeze visuel.
- ⚠️ **3 pensées/jour** est asymétrique avec 6 catégories d'habitudes — sentiment de rareté.
- ✅ Fleurs ✿ soutien affichées sur le post-it menu (`#soutien-flowers`) — compteur visible calqué sur `#thought-count` (2026-05-01).
- ✅ Infos RDV du jour + phase cycle ajoutées sur le post-it agenda (`#agenda-postit-info`, `updAgendaPostit()`) — compensation visuelle des limites IA (2026-05-01).

### 6c. Propositions

1. ✅ **Compteur visible** soutien sur le post-it menu (fleurs ✿). Pensées toujours affichées via `#thought-count`. (2026-05-01)
2. **Pensée matinale automatique** offerte au premier ouvrage du jour (consomme 1 sur 3, mais n'est pas "demandée").
3. **Réduire le coût objet IA à 8 pétales** + introduire une **prime "premier objet de la semaine" gratuit**.
4. **Variabilité du prompt création d'objet** : injecter un mood-tag (cosy, mystique, fun, naturel) pour éviter la répétition stylistique.

---

## Section 7 — Inventaire & Personnalisation

### 7a. Diagnostic

**Structure objet** (`data/props.json:4-25, 104-118, 348-360`)
Champs : `id, nom, type, emoji, categorie, cout, slot, pxSize, palette, pixels[2D]`.
Optionnels : `ancrage` (accessoires : "tete"), `motion` (ambiance : "fall").

**Slots décor** (`js/ui-shop.js:703-710`) : 5 zones — `A` (↖), `B` (↗), `C` (↙), `SOL` (centre bas), `D` (autre). Pas de conflit géré explicitement entre objets dans le même slot — le dernier posé écrase ?

**Environnements** (`js/ui-shop.js:137, 220-221`) : 3 fixes — `parc, chambre, montagne`. Switcher gratuit. `D.g.activeEnv`.

**Prix** : binaire, **0 ou 6 pétales** dans la boutique. Tous les accessoires premium au même tarif. ⚠️ **Prix du catalogue non modifiés — décision du 2026-05-01** (pas de refonte de la hiérarchie d'objets pour l'instant).

### 7b. Évaluation TDAH

- ✅ Catalogue lisible, peu chargé.
- ⚠️ **Pas de hiérarchie de désir** : tous les payants au même prix — choix assumé pour l'instant (refonte prix non planifiée).
- ✅ Personnalisation immédiatement visible sur le gotchi.

### 7c. Propositions

1. ~~**3 paliers de prix** (3 / 6 / 12 pétales)~~ — **non planifié** (prix du catalogue stables par décision du 2026-05-01).
2. **Objets saisonniers** débloqués selon le mois (cycle d'année).
3. **Objet "milestone"** offert à chaque transition de stade (egg→baby, baby→teen, etc.).
4. **Pack thématique** : 3 objets cohérents (ex : "set cosy" = coussin + bougie + tapis) à prix groupé.

---

## Section 8 — Boucle Quotidienne

### 8a. Diagnostic

**Reset quotidien** (`js/app.js:1145-1160`) : ne touche que `thoughtCount`, `soutienCount`, `lastActive`. Pas de reset explicite des habitudes (réimplicite via clé `D.log[today]`), pas de reset des meals (géré par `ensureMealsToday()` `js/app.js:568-572`).

**Bootstrap** (`js/app.js:1256-1294`) : `load → checkSalete → catchUpPoops → initApp`.

**Notifications natives** : ❌ aucune (`Notification` API non appelée) — **session dédiée à planifier ultérieurement**.

**Points d'entrée quotidiens** :
1. Ouverture manuelle de l'app (script parsé)
2. `visibilitychange` / `pageshow`
3. Aucune relance externe possible (pas de push)

**Boucle journée type reconstituée**
1. Ouvrir → bulle d'accueil + état du gotchi
2. (Matin 7-11) Snack matin → +2/+4 pétales
3. Cocher 1-3 habitudes au fil de la journée → +6 XP / +6 pétales max
4. (Midi 11-15) Snack midi
5. Nettoyer 1-2 crottes → +2/+4 pétales
6. (Optionnel) Pensée IA → narration
7. (Soir 18-22) Snack soir
8. (Optionnel) Note journal → +15 XP

**Durée totale** : ~5-8 min cumulées sur la journée, en 4-6 micro-sessions.

### 8b. Évaluation TDAH

- ✅ **Compatible quick-check 30s** : ouvrir, état visible, action rapide possible.
- ✅ Sessions courtes naturelles via fenêtres repas.
- ❌ Pas de relance externe → l'app dépend de l'initiative de l'utilisateur·rice (gros défaut TDAH).
- ❌ Aucun événement-surprise → la journée de J est identique à celle de J+30.

### 8c. Propositions

1. **Notifications PWA opt-in** sur les 3 fenêtres repas + 1 le soir si <2 habitudes cochées.
2. **Événement aléatoire** quotidien (1/3 chance) : papillon, météo spéciale, visiteur, mini-cadeau (+3 pétales).
3. **Streak global de présence** (jours consécutifs d'ouverture) avec récompense visible (badge progressif).
4. **"Pensée du matin" offerte** au premier lancement du jour (consomme 1 sur 3 mais ressentie comme un cadeau).

---

## Propositions de nouvelles mécaniques

| Nom | Système | Description courte | Effort | Impact TDAH |
|-----|---------|--------------------|--------|-------------|
| ~~Streaks par habitude~~ | S2 | ✅ FAIT 2026-05-01 — `computeStreaks()`, badge 🔥×N, bonus pétales cap 7 | — | 🔥🔥🔥 |
| ~~Streak de présence global~~ | S8 | ✅ FAIT 2026-05-01 — `updatePresenceStreak()`, jalons 3/7/14/30j, badge `#s-presence` dans Stats | — | 🔥🔥🔥 |
| ~~Jauge hunger~~ | S3 | ✅ FAIT 2026-05-01 — jauge 0-3, monte si fenêtre manquée, reset au repas, bulle dédiée | — | 🔥🔥 |
| ~~Reset salete au nettoyage~~ | S5 | ✅ FAIT 2026-05-01 — `D.g.salete = 0` dans `cleanPoops()` | — | 🔥🔥 |
| Notifications PWA opt-in | S8 | Rappel snack manqué, soir sans habitudes — **session dédiée à planifier** | Moyen | 🔥🔥🔥 |
| Événement aléatoire quotidien | S8 | 1/3 chance : papillon, visiteur, météo rare | Moyen | 🔥🔥🔥 |
| ~~Animation "manger"~~ | S4 | ✅ DÉJÀ PRÉSENT — `eatAnim` actif dans `giveSnack()` + `render.js` (emoji descente + bond) | — | 🔥🔥 |
| ~~Compteur IA visible~~ | S6 | ✅ FAIT 2026-05-01 — fleurs ✿ soutien sur post-it menu, infos agenda sur post-it agenda | — | 🔥🔥 |
| ~~3 paliers de prix shop~~ | S7 | 🚫 NON PLANIFIÉ — prix du catalogue stables (décision 2026-05-01) | — | 🔥 |
| ~~Objet milestone offert~~ | S7 | ✅ FAIT 2026-05-01 — `offrirPropMilestone()` dans `addXp()`, pools par stade (baby/teen/adult), guard `D.milestoneProps` | — | 🔥🔥 |
| ~~Goûter 15-17h~~ | S4 | ✅ FAIT 2026-05-01 — fenêtre `gouter` dans `MEAL_WINDOWS` (`bonus:true`), +1 pétale, branche dédiée dans `giveSnack()` | — | 🔥 |
| ~~Habitude vedette du jour~~ | S2 | ✅ FAIT 2026-05-01 — `refreshCatVedette()` tirage déterministe par date, +2 bonus pétales, badge ⭐ dans `renderHabs()`, classe `.hab--vedette` | — | 🔥🔥 |
| ~~Pack thématique boutique~~ | S7 | ✅ FAIT 2026-05-01 — `SHOP_PACKS` dans `config.js` (3 packs), `acheterPack()` dans `ui-shop.js`, section Packs dans catalogue boutique | — | 🔥 |
| ~~Bulle "j'ai faim" anticipée~~ | S4 | ✅ FAIT 2026-05-01 — Priorité 2b dans `updBubbleNow()` : 30 min avant prochaine fenêtre non encore prise | — | 🔥🔥 |
| ~~Easing transitions états~~ | S3 | ✅ FAIT 2026-05-01 — `_dispEnergy`/`_dispHappy` lerp 0.12/frame dans `p.draw()` (`render.js`) | — | 🔥 |

---

## Prochaines étapes recommandées

> Mise à jour 2026-05-01 — 13 items du tableau de dette résolus.

1. ✅ **Fix critique** : reset de `salete` dans `cleanPoops()` — **FAIT**.
2. ✅ **Cohérence XP** : `XP_MAX` aligné à 4000 — **FAIT**.
3. ✅ **Streaks par habitude** (S2) — **FAIT** (`computeStreaks()`, badge 🔥×N, bonus pétales cap 7).
4. **🟠 Streak de présence global** (S8) — relance quotidienne sans dépendre des notifs — **à faire**.
5. ✅ **Compteur IA visible** (fleurs soutien sur post-it) — **FAIT**. Animation manger — **à faire** (faible effort).
6. **🟡 Notifications PWA opt-in** — session dédiée à planifier.
7. ✅ **Jauge hunger** (S3) + recalibrage saleté — **FAITS**.
8. **🟢 Événements aléatoires quotidiens** + objets milestone — couche surprise et attachement.
9. ~~**3 paliers de prix boutique**~~ — **non planifié** (prix stables, décision 2026-05-01).
