# AUDIT GAMEPLAY — HabitGotchi

> **Fichier de sortie attendu :** `AUDIT_GAMEPLAY.md` à la racine du repo.

---

## Contexte

Tu audites HabitGotchi, une PWA mobile de bien-être gamifiée (style Tamagotchi) construite avec p5.js.

**Stack :** p5.js (canvas), LocalStorage (`window.D`, clé `hg4`), API Claude Anthropic (pensées IA, soutien, génération d'objets), GitHub Pages.

**Public cible :** personnes TDAH. Ce critère est un axe d'évaluation central — chaque système doit être analysé sous l'angle de la charge cognitive, de la friction, et de la qualité des boucles de récompense.

**Fichiers principaux à lire avant de commencer :**
- `js/app.js` → métabolisme : XP, pétales, états, habitudes, repas, save/load
- `js/render.js` + `js/render-sprites.js` → rendu canvas, animations, états visuels
- `js/ui-habs.js` → système habitudes
- `js/ui-shop.js` → boutique, inventaire, personnalisation
- `js/ui-ai.js` → interactions IA (pensées, soutien, génération d'objets)
- `js/ui-settings.js` → repas/snacks (`ouvrirSnack`)
- `data/config.js` → constantes gameplay (seuils, multiplicateurs, durées)
- `data/props.json` → catalogue objets
- `data/personality.json` → bulles d'état
- `prompts/ai_contexts.json` → templates prompts IA

**Principe impératif :** ne jamais réécrire un fichier entier. Toujours cibler les blocs concernés avec numéros de ligne exacts. Langue de réponse : français.

---

## SECTION 1 — PROGRESSION & ÉCONOMIE (XP, pétales, montée en âge)

### 1a. Diagnostic
→ Lire la logique XP et pétales dans `app.js`
→ Identifier les sources de gain de pétales (habitudes, repas, interactions, IA…) et leurs valeurs
→ Identifier les sources de dépense (boutique, génération d'objets IA, snacks…)
→ Vérifier la cohérence de l'économie : est-il possible de stagner indéfiniment ? De progresser trop vite ?
→ Documenter les seuils de montée en âge (egg → baby → teen → adult) et leurs conditions exactes

### 1b. Évaluation TDAH
→ Les récompenses sont-elles suffisamment immédiates et visibles ?
→ Y a-t-il un feedback clair à chaque gain de pétale ?
→ La courbe de progression est-elle lisible sans effort cognitif ?

### 1c. Propositions
→ Proposer des ajustements d'équilibre si nécessaire (valeurs, fréquences)
→ Proposer des mécaniques de progression supplémentaires si pertinent (streaks, bonus, paliers visuels…)

---

## SECTION 2 — HABITUDES (déclencheurs, récompenses, cohérence)

### 2a. Diagnostic
→ Lire `ui-habs.js` et la partie habitudes dans `app.js`
→ Documenter le cycle complet d'une habitude : création → validation → récompense → reset
→ Identifier les catégories disponibles (`CATS` dans `config.js`) et leur logique
→ Vérifier la cohérence entre le tick d'une habitude et son impact sur les états du gotchi
→ Y a-t-il des habitudes récurrentes ? Des habitudes manquées qui ont un effet ?

### 2b. Évaluation TDAH
→ Le système est-il trop complexe à configurer ?
→ Le feedback visuel après validation d'une habitude est-il satisfaisant et immédiat ?
→ Y a-t-il un risque de "doom scroll" dans la liste des habitudes ?

### 2c. Propositions
→ Proposer des améliorations du cycle de récompense (animations, sons, effets)
→ Proposer des mécaniques manquantes : habitudes manquées, séries (streaks), habitudes contextuelles (heure, météo)

---

## SECTION 3 — ÉTATS DU GOTCHI & EFFETS VISUELS (énergie, bonheur, faim)

### 3a. Diagnostic
→ Identifier tous les états du gotchi et leurs valeurs dans `app.js` / `config.js`
→ Vérifier comment chaque état influence le rendu visuel (`render.js`, `render-sprites.js`, `personality.json`)
→ Les états sont-ils tous représentés visuellement ? De manière lisible sur mobile (<64px) ?
→ Y a-t-il des états orphelins (définis mais sans effet visuel, ou visuels sans état associé) ?

### 3b. Évaluation TDAH
→ L'état du gotchi est-il lisible d'un coup d'œil sans lire de chiffres ?
→ Les transitions d'état sont-elles fluides ou abruptes ?

### 3c. Propositions
→ Proposer des états manquants ou sous-exploités
→ Proposer des effets visuels supplémentaires pour renforcer la lisibilité émotionnelle du gotchi

---

## SECTION 4 — SYSTÈME DE REPAS & SNACKS

### 4a. Diagnostic
→ Lire `ouvrirSnack()` dans `ui-settings.js` et la logique repas dans `app.js`
→ Documenter les fenêtres horaires (matin, midi, soir), le snack préféré rotatif, les bonus pétales
→ Vérifier les 4 états UI de la fenêtre snack et leur cohérence
→ Identifier les bugs connus ou incohérences (ex : créditation des pétales, fenêtres qui se chevauchent)

### 4b. Évaluation TDAH
→ Le système de repas crée-t-il une routine saine ou une friction supplémentaire ?
→ Le feedback du repas est-il suffisamment gratifiant ?

### 4c. Propositions
→ Proposer des mécaniques pour enrichir le système repas (effets du gotchi après manger, animations, variété)

---

## SECTION 5 — APPARITION CROTTES, SALETÉ, REPAS (événements passifs)

### 5a. Diagnostic
→ Identifier dans `app.js` et `render.js` la logique d'apparition des crottes (`poops`, `lastPoopSpawn`)
→ Identifier la logique d'accumulation de saleté et son rendu (`drawSaleteDither` dans `render-sprites.js`)
→ Ces systèmes sont-ils liés aux états du gotchi (faim → plus de crottes, etc.) ?
→ Y a-t-il une logique de nettoyage (balai) ? Est-elle cohérente ?

### 5b. Évaluation TDAH
→ Ces systèmes passifs créent-ils une charge de surveillance agréable ou anxiogène ?

### 5c. Propositions
→ Proposer des ajustements de fréquence ou des mécaniques liées (mini-récompense pour nettoyer, effet sur le bonheur…)

---

## SECTION 6 — INTERACTIONS IA (pensées, soutien, création d'objets)

### 6a. Diagnostic
→ Lire `ui-ai.js` et `prompts/ai_contexts.json`
→ Documenter toutes les interactions IA disponibles : pensée quotidienne (`askClaude`), soutien (`genSoutien`), bilan semaine (`genBilanSemaine`), création d'objet (`acheterPropClaude`)
→ Vérifier les compteurs (`thoughtCount`, `soutienCount`) et leurs limites
→ Les templates de prompts sont-ils cohérents avec les variables disponibles dans `window.D` ?
→ La création d'objet IA est-elle intégrée dans l'économie pétales de manière cohérente ?

### 6b. Évaluation TDAH
→ Les retours IA sont-ils trop longs, trop courts, trop fréquents ?
→ Le délai de réponse est-il géré avec un feedback visuel (loader, animation…) ?
→ L'interaction IA renforce-t-elle l'attachement au gotchi ou le dilue-t-il ?

### 6c. Propositions
→ Proposer de nouvelles interactions IA cohérentes avec la stack existante
→ Proposer des améliorations du prompt de création d'objet pour plus de variété et de cohérence pixel art

---

## SECTION 7 — INVENTAIRE & PERSONNALISATION (objets, accessoires, environnements)

### 7a. Diagnostic
→ Lire `ui-shop.js` et `data/props.json`
→ Documenter la structure d'un objet (champs, types, slots)
→ Vérifier la cohérence entre l'inventaire stocké dans `window.D` et le rendu des accessoires dans `render-sprites.js`
→ Le système de slots est-il clair ? (combien de slots, quels types, conflits possibles ?)
→ Le switcher d'environnement est-il bien intégré dans la boucle de jeu ?

### 7b. Évaluation TDAH
→ La boutique est-elle trop chargée visuellement ou cognitivement ?
→ La personnalisation donne-t-elle un sentiment de progression et d'attachement ?

### 7c. Propositions
→ Proposer des catégories d'objets manquantes
→ Proposer des mécaniques de personnalisation supplémentaires (objets saisonniers, objets débloqués par milestone…)

---

## SECTION 8 — BOUCLE DE JEU QUOTIDIENNE (rétention, motivation, routine)

### 8a. Diagnostic
→ Reconstituer la boucle de jeu complète d'une journée type : qu'est-ce que l'utilisateur·rice fait, dans quel ordre, avec quels feedbacks ?
→ Identifier les points d'entrée quotidiens (ouverture de l'app, notification, pensée IA…)
→ Y a-t-il un système de notification ou de rappel ?
→ Le reset quotidien est-il bien géré (habitudes, repas, états) ?

### 8b. Évaluation TDAH
→ La boucle est-elle trop longue pour être complétée en une session ?
→ Y a-t-il suffisamment de micro-récompenses pour maintenir l'engagement sur 5 minutes ?
→ L'app est-elle utilisable en mode "quick check" (30 secondes) sans frustration ?

### 8c. Propositions
→ Proposer des mécaniques de rétention adaptées au TDAH (streak visuel, événement quotidien surprise, récompense de présence…)
→ Proposer des mécaniques nouvelles à fort impact émotionnel et faible friction : événements aléatoires, mini-interactions, surprises saisonnières…

---

## LIVRABLES ATTENDUS

Générer le fichier `AUDIT_GAMEPLAY.md` à la racine du repo avec la structure suivante :

```markdown
# AUDIT GAMEPLAY — HabitGotchi
> Généré par Claude Opus — [date]
> Version auditée : [lire APP_VERSION dans app.js]

## Résumé exécutif
[3-5 phrases : état général du gameplay, priorités d'action]

## Dette gameplay (liste triée par criticité)
| Priorité | Système | Problème | Fichier / ligne |
|----------|---------|----------|-----------------|

## Section 1 — Progression & Économie
[diagnostic + évaluation TDAH + propositions]

## Section 2 — Habitudes
[...]

## Section 3 — États & Visuels
[...]

## Section 4 — Repas & Snacks
[...]

## Section 5 — Événements Passifs
[...]

## Section 6 — Interactions IA
[...]

## Section 7 — Inventaire & Personnalisation
[...]

## Section 8 — Boucle Quotidienne
[...]

## Propositions de nouvelles mécaniques
| Nom | Système concerné | Description courte | Effort | Impact TDAH |
|-----|-----------------|-------------------|--------|-------------|

## Prochaines étapes recommandées
[Liste ordonnée des actions prioritaires]
```

**Format :** Markdown structuré, blocs de code avec numéros de ligne quand possible.
**Langue :** français.
**Principe :** ne jamais réécrire un fichier entier — cibler les blocs concernés.
