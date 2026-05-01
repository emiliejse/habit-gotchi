# AUDIT IA & PERSONNALITÉ — HabitGotchi

> **Usage :** Coller ce prompt dans Claude Code (modèle Opus) à la racine du repo `habit-gotchi`.
> Opus lira les fichiers lui-même. Chaque section est indépendante — tu peux les envoyer une par une.
> **Fichier de sortie attendu :** `AUDIT_IA_PERSONNALITE.md` à la racine du repo.

---

## Contexte

Tu audites le système de langage et de personnalité de HabitGotchi — une PWA mobile de bien-être gamifiée (style Tamagotchi) construite avec p5.js, destinée à des personnes TDAH.

Le gotchi est un compagnon IA. Sa voix, ses réactions et ses messages sont le cœur de l'attachement émotionnel. L'objectif de cet audit est de s'assurer que :
1. Chaque échange (API ou bulle statique) sonne juste, varié et cohérent
2. Le ton s'adapte dynamiquement à l'état du gotchi ET à la personnalité configurée
3. Le système `user_config` permet réellement de personnaliser la voix du gotchi pour un autre utilisateur (Alexia)
4. Des propositions concrètes (nouveaux templates, nouvelles bulles) sont fournies

**Fichiers à lire avant de commencer :**
- `prompts/ai_contexts.json` → templates de prompts Claude (pensées, soutien, bilan, création d'objet)
- `prompts/ai_system.json` → system prompts
- `data/personality.json` → bulles statiques par état + style + traits
- `js/ui-ai.js` → `askClaude()`, `genSoutien()`, `genBilanSemaine()`, `acheterPropClaude()`
- `js/app.js` → construction des variables injectées dans les prompts (`window.D`, états, habitudes)
- `data/user_config.json` (si présent) → personnalisation utilisateur (nom, personnalité, préférences)
- `data/config.js` → constantes liées aux états et aux personnalités disponibles

**Syntaxe des prompts :** toujours `{{double accolades}}`.
**Variables standard connues :** `{{nameGotchi}}`, `{{userName}}`, `{{heure}}`, `{{date}}`, `{{energy}}`, `{{happiness}}`, `{{habsDone}}`, `{{style}}`, `{{traits}}`, `{{exemples}}`, `{{registre}}`.

**Principe impératif :** ne jamais réécrire un fichier entier. Cibler les blocs concernés avec numéros de ligne exacts. Langue de réponse : français.

---

## SECTION 1 — INVENTAIRE COMPLET DES ÉCHANGES IA

### 1a. Cartographie des appels API
→ Lire `ui-ai.js` en entier
→ Lister tous les appels à `callClaude()` / `askClaude()` avec pour chacun :
  - Nom de la fonction déclenchante
  - Template de prompt utilisé (clé dans `ai_contexts.json`)
  - Variables injectées dans le prompt
  - Déclencheur utilisateur (bouton, timer, événement gameplay)
  - Limite de fréquence éventuelle (`thoughtCount`, `soutienCount`…)
  - Longueur de réponse attendue (max_tokens)

Format tableau :

| Fonction | Template | Variables injectées | Déclencheur | Limite | max_tokens |
|----------|----------|-------------------|-------------|--------|------------|

### 1b. Cartographie des bulles statiques
→ Lire `personality.json` en entier
→ Lister toutes les catégories de bulles (états, événements, réactions…)
→ Pour chaque catégorie : nombre de variantes disponibles, ton observé, déclencheur

---

## SECTION 2 — QUALITÉ DES TEMPLATES DE PROMPTS (ai_contexts.json)

Pour chaque template identifié en Section 1a :

### 2a. Analyse structurelle
→ Le prompt est-il clair sur le rôle joué par le gotchi ?
→ Les variables injectées sont-elles toutes définies et non nulles au moment de l'appel ?
→ Y a-t-il des variables déclarées dans le template mais jamais peuplées (risque de `{{undefined}}`) ?
→ Le format de réponse attendu est-il explicite (longueur, ton, structure) ?

### 2b. Analyse du ton
→ Le ton demandé est-il cohérent avec la personnalité définie dans `personality.json` ?
→ Le prompt interdit-il explicitement les comportements indésirables (questions directes, conseils non sollicités, ton condescendant) ?
→ Le registre (`{{registre}}`) est-il correctement exploité pour varier le ton ?

### 2c. Analyse de la contextualisation
→ Le prompt exploite-t-il suffisamment les données disponibles dans `window.D` ?
→ Des données pertinentes sont-elles disponibles mais NON injectées dans le prompt (opportunités manquées) ?
→ Les notes récentes du journal sont-elles utilisées ? Les habitudes du jour ? La météo ? L'heure ?

### 2d. Propositions d'amélioration
Pour chaque template qui présente un problème :
→ Proposer une version améliorée du template (extrait ciblé, pas réécriture complète)
→ Identifier les variables manquantes à ajouter et comment les construire dans `ui-ai.js`

---

## SECTION 3 — VARIÉTÉ & RÉPÉTITIVITÉ

### 3a. Diagnostic variété des prompts
→ Les prompts incluent-ils un mécanisme explicite pour éviter la répétition (exemples de formulations à éviter, instruction "ne pas répéter les messages précédents"…) ?
→ `{{exemples}}` est-il utilisé efficacement pour injecter des formulations de référence variées ?
→ `{{registre}}` couvre-t-il suffisamment de registres tonaux différents ?

### 3b. Diagnostic variété des bulles statiques
→ Combien de variantes par état dans `personality.json` ?
→ Y a-t-il des états avec une seule bulle (risque de répétition immédiate) ?
→ Le tirage aléatoire entre variantes est-il bien implémenté dans le code ?

### 3c. Propositions
→ Pour les états avec moins de 3 variantes : proposer 2-3 nouvelles bulles dans le ton et le style existants
→ Proposer un mécanisme d'anti-répétition si absent (ex : historique des N derniers messages, blacklist temporaire)
→ Proposer de nouveaux registres pour `getRegistre()` si le spectre actuel est trop étroit

---

## SECTION 4 — SYSTÈME DE TON DYNAMIQUE (vision cible)

L'objectif à terme est un système de ton dynamique complet où le registre du gotchi varie selon :
- **L'état courant** (joyeux ≠ fatigué ≠ malade ≠ en colère)
- **La personnalité configurée** (via `user_config` : traits, style, registres favoris)
- **Le contexte temporel** (matin ≠ soir, jour de semaine ≠ week-end)
- **L'historique récent** (habitudes réussies, journal positif, série de jours actifs)

### 4a. État actuel
→ Identifier ce qui module déjà le ton aujourd'hui (variables injectées, conditions dans `ui-ai.js`)
→ Identifier ce qui est défini dans `personality.json` mais pas encore connecté aux prompts API
→ Identifier les données disponibles dans `window.D` qui pourraient alimenter le ton mais ne le font pas encore

### 4b. Architecture cible proposée
→ Proposer une architecture légère pour un système de ton dynamique :
  - Comment structurer les "profils de ton" (objet JS ou JSON externe ?)
  - Comment sélectionner le bon profil au moment de l'appel API
  - Comment injecter ce profil dans le prompt sans alourdir le template
→ Contrainte : rester compatible avec la syntaxe `{{double accolades}}` existante
→ Contrainte : ne pas casser les appels API existants — migration progressive possible

### 4c. Exemple concret
→ Produire un exemple complet pour UN template (au choix, le plus emblématique) montrant :
  - Le template actuel
  - Le template amélioré avec ton dynamique
  - Les variables supplémentaires à construire dans `ui-ai.js`

---

## SECTION 5 — BULLES STATIQUES & PERSONNALITÉ (personality.json)

### 5a. Couverture des états
→ Lister tous les états du gotchi définis dans `config.js` / `app.js`
→ Vérifier que chaque état a des bulles associées dans `personality.json`
→ Identifier les états sans bulles (silences non intentionnels)
→ Identifier les bulles dont le ton ne correspond pas à l'état décrit

### 5b. Cohérence ton / personnalité
→ Le fichier `personality.json` définit-il des traits de personnalité globaux ?
→ Ces traits sont-ils cohérents avec le ton observé dans les bulles ?
→ Y a-t-il des bulles qui "cassent" la personnalité (trop froides, trop génériques, trop moralisatrices) ?

### 5c. Propositions de contenu
→ Pour chaque état sans bulle : proposer 2-3 bulles dans le style existant
→ Pour les bulles jugées faibles : proposer une reformulation
→ Proposer 3-5 nouvelles catégories de bulles manquantes (ex : réaction à une habitude spécifique, bulle de météo, bulle de retour après absence…)

---

## SECTION 6 — PERSONNALISATION VIA user_config

### 6a. Diagnostic de l'existant
→ Lire `data/user_config.json` (si présent) et identifier tous les champs liés à la personnalité du gotchi
→ Lire `js/app.js` pour voir comment `user_config` est chargé et appliqué
→ Vérifier quels champs de `user_config` sont effectivement injectés dans les prompts API
→ Vérifier quels champs de `user_config` influencent les bulles statiques de `personality.json`

### 6b. Identification des lacunes
→ Y a-t-il des aspects de personnalité configurables dans `user_config` mais jamais utilisés dans les prompts ?
→ Y a-t-il des aspects du ton/personnalité hardcodés dans les templates qui devraient être dans `user_config` ?
→ Un autre utilisateur (Alexia) peut-il obtenir un gotchi avec une personnalité réellement différente en changeant uniquement `user_config` ?

### 6c. Propositions
→ Proposer les champs `user_config` manquants pour couvrir la personnalisation de ton dynamique (Section 4)
→ Proposer comment connecter ces nouveaux champs aux templates existants sans refactoring massif
→ Identifier les lignes exactes dans `ui-ai.js` et `app.js` où injecter ces nouvelles variables

---

## SECTION 7 — COHÉRENCE GLOBALE VOIX / PERSONNALITÉ

### 7a. Audit de cohérence transversale
→ Est-ce que la voix du gotchi dans les bulles statiques (`personality.json`) et dans les réponses API (`ai_contexts.json`) sonne comme le même personnage ?
→ Y a-t-il des contradictions de ton entre les deux systèmes ?
→ Le nom du gotchi (`{{nameGotchi}}`) est-il utilisé de manière cohérente partout ?

### 7b. Évaluation TDAH
→ Les messages sont-ils trop longs pour une lecture rapide sur mobile ?
→ Les bulles créent-elles un sentiment d'attachement ou restent-elles génériques ?
→ Les retours positifs (validation d'habitude, streaks) sont-ils suffisamment chaleureux et immédiats ?

### 7c. Proposition de charte de voix
→ Rédiger une "charte de voix du gotchi" courte (10-15 lignes) qui documente :
  - Le registre de base
  - Ce que le gotchi dit / ne dit jamais
  - Comment son ton évolue selon les états
  - Les marqueurs stylistiques caractéristiques (ponctuation, longueur, formules récurrentes)

Cette charte servira de référence pour toutes les futures contributions au contenu.

---

## LIVRABLES ATTENDUS

Générer le fichier `AUDIT_IA_PERSONNALITE.md` à la racine du repo avec la structure suivante :

```markdown
# AUDIT IA & PERSONNALITÉ — HabitGotchi
> Généré par Claude Opus — [date]
> Version auditée : [lire APP_VERSION dans app.js]

## Résumé exécutif
[3-5 phrases : état général du système de voix, priorités d'action]

## Cartographie des échanges IA
[Tableau Section 1a + résumé bulles statiques]

## Dette voix & personnalité (triée par criticité)
| Priorité | Système | Problème | Fichier / ligne |
|----------|---------|----------|-----------------|

## Section 2 — Qualité des templates
[diagnostic + propositions d'extraits améliorés]

## Section 3 — Variété & anti-répétition
[diagnostic + nouvelles bulles proposées]

## Section 4 — Architecture ton dynamique
[état actuel + architecture cible + exemple concret]

## Section 5 — Bulles statiques
[couverture + propositions de contenu]

## Section 6 — user_config & personnalisation
[lacunes + propositions de champs + lignes exactes à modifier]

## Section 7 — Cohérence globale
[audit transversal + charte de voix du gotchi]

## Prochaines étapes recommandées
[Liste ordonnée des actions prioritaires]
```

**Format :** Markdown structuré, blocs de code avec numéros de ligne quand possible.
**Langue :** français.
**Principe :** ne jamais réécrire un fichier entier — cibler les blocs concernés.
**Pour le contenu proposé (bulles, extraits de prompts) :** respecter scrupuleusement le ton et le style existants dans `personality.json` avant de proposer des variations.
