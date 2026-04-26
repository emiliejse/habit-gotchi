# Audit système USER_CONFIG — HabitGotchi

> Document de travail pour mener l'audit et les modifications du système `USER_CONFIG` de HabitGotchi, étape par étape, avec Claude Chat.
>
> **Usage :** Uploader ce fichier dans Claude Chat (avec accès aux fichiers du repo `habit-gotchi`) et lui demander de commencer par la **Partie 1 — État des lieux**.

---

## 0. Posture attendue de Claude

Tu es un expert en architecture de code pour HabitGotchi, une PWA mobile de bien-être pixel art (p5.js + LocalStorage + API Claude Anthropic).

**Je ne sais pas coder.** Tu vas m'aider à comprendre la situation actuelle et à définir un plan de modifications que je ferai moi-même dans VS Code, étape par étape, avec ton aide dans la conversation.

**Règles strictes :**

- Tu ne proposes **pas** de blocs de code complets.
- Tu expliques **QUOI** modifier, **OÙ**, et **POURQUOI** — en langage simple, avec des analogies si besoin.
- Si tu ne trouves pas quelque chose dans le code → dis-le clairement, ne suppose pas.
- Signale explicitement si une modification présente un risque de casser quelque chose.
- Commence **toujours** par la Partie 1 (état des lieux) avant tout le reste.

---

## 1. Contexte projet

### Deux repos quasi-identiques

- `habit-gotchi` → mon repo principal (repo de développement, c'est le mien).
- `habit-gotchi-alexia` → le repo de ma sœur Alexia (synchronisé manuellement).

Les différences entre les deux sont **uniquement** des éléments personnels :

- son prénom,
- son gotchi,
- ses coordonnées GPS pour la météo,
- sa personnalité de gotchi,
- ses bulles ambiantes,
- son popup d'anniversaire,
- ses objets débloqués au démarrage,
- le fait qu'elle ne veut pas voir les mentions TDAH ni la feature cycle menstruel.

### Ce qui existe déjà dans le repo d'Alexia (et pas dans le mien)

- Un fichier `data/user_config.json` qui centralise ses données personnelles.
- Une fonction `loadUserConfig()` dans `app.js` qui le charge au démarrage.
- `window.USER_CONFIG` qui expose la config à toute l'app.
- Les coordonnées météo, nom du gotchi, anniversaire, objets débloqués sont déjà branchés sur USER_CONFIG dans son code.

### Ce qui n'est pas encore systématisé

- Mon repo principal n'a **pas** de `user_config.json` du tout.
- La personnalité du gotchi (traits, style, bulles) est dans `personality.json` → un fichier entier différent entre les deux repos, difficile à maintenir.
- Les mentions TDAH et la feature cycle ne sont **pas** conditionnelles.
- Le code cheat d'anniversaire (`joyeuxanniversaire`) est hardcodé dans `ui.js`.
- Aucun `.gitignore` ne protège `user_config.json` pour l'instant.

### Le problème concret

À chaque modification sur mon repo, je dois la reporter manuellement sur celui d'Alexia en vérifiant chaque ligne pour ne pas écraser ses personnalisations. C'est long, risqué, et je me trompe parfois.

### L'objectif

Qu'Alexia puisse faire un simple `git pull` depuis mon repo sans jamais écraser son `user_config.json` personnel. **Plus aucun portage manuel fichier par fichier.**

---

## 2. Fichiers à lire (dans cet ordre)

1. `data/user_config.json` — si existant dans MON repo
2. `js/app.js` — chercher : `USER_CONFIG`, `loadUserConfig`, `fetchMeteo`, `defs()`, `initBaseProps`, `bootstrap`
3. `js/ui.js` — chercher : `USER_CONFIG`, `birthdayShown`, `birthdayCodeUsed`, `birthdayCode`, `joyeuxanniversaire`, `TDAH`, `cycle`, `checkWelcome`, `updUI`, `handleCheatCode`, `confirmWelcome`
4. `data/personality.json` — structure complète
5. `prompts/ai_contexts.json` — pour voir si TDAH est mentionné
6. `index.html` — chercher : `birthday-badge`, `cycle`
7. `.gitignore` — si existant

> **Pas besoin** de lire `render.js` ni `envs.js` pour cet audit.

---

## 3. Ce que tu dois produire

### PARTIE 1 — État des lieux (audit)

Pour chaque point ci-dessous, dire ce que tu trouves dans le code.

**1.1 — Où est branché USER_CONFIG aujourd'hui dans MON repo ?**
Liste chaque endroit où `window.USER_CONFIG` est lu ou utilisé. Si ce n'est nulle part → dire clairement.

**1.2 — Quels fichiers sont différents entre les deux repos ?**
Sur la base du code actuel de MON repo et de ce que je t'ai dit sur le repo d'Alexia, liste les fichiers qui devront rester différents vs ceux qui pourraient être unifiés.

**1.3 — Où sont les mentions TDAH dans le code ?**
Liste tous les endroits (fichier + contexte) où le mot "TDAH" ou "trouble" apparaît dans un texte visible par l'utilisatrice ou dans un prompt envoyé à l'IA.

**1.4 — Où est la feature cycle menstruel dans le code ?**
Identifie les éléments UI (boutons, sections, onglets) liés au cycle dans `index.html` et `ui.js` qui pourraient être masqués/affichés selon une config.

**1.5 — Où est le code cheat anniversaire ?**
Trouve la chaîne `joyeuxanniversaire` (ou équivalent) dans `ui.js` et décris comment elle est gérée aujourd'hui.

**1.6 — Comment est structurée `personality.json` ?**
Décris les clés principales (traits, style, bulles par moment de journée) pour qu'on sache quoi mettre dans `user_config.json`.

**1.7 — Le `.gitignore` protège-t-il déjà `user_config.json` ?**
Vérifie et dis-moi ce que tu trouves.

---

### PARTIE 2 — Schéma cible de `user_config.json`

Sur la base de ton audit, propose le **schéma JSON complet** que devrait avoir `data/user_config.json` pour couvrir TOUTES les différences entre les deux repos.

Pour chaque clé, explique en une phrase simple ce qu'elle fait.

Le schéma doit couvrir au minimum :

- **Identité** (nom gotchi, prénom utilisatrice, surnom)
- **Localisation météo** (lat, lon, nom de la ville)
- **Anniversaire** (mois, jour, message, code cheat, nombre de pétales)
- **Personnalité** (traits, style, bulles par état)
- **Options UI** (afficher/masquer TDAH, afficher/masquer cycle, titre app)
- **Objets débloqués au démarrage**
- **Options IA** (override system prompt, override contexte)

Indique pour chaque clé : **valeur par défaut pour MOI**, et **valeur recommandée pour Alexia** (sur la base de ce que tu connais d'elle via le code d'Alexia si tu y as accès, sinon laisse vide).

---

### PARTIE 3 — Plan de modifications

Découpe le travail en sessions indépendantes, du plus simple au plus complexe. Chaque session doit être faisable en **30-60 minutes**.

Pour chaque session :

- **Titre** : ce qu'on accomplit
- **Fichiers touchés** : liste exacte
- **Risque** : est-ce que ça peut casser quelque chose ?
- **Dépendances** : est-ce que cette session doit être faite avant une autre ?
- **Étapes** : liste des actions concrètes (sans code complet)

#### Sessions à couvrir (dans cet ordre)

**Session A — Créer `user_config.json` dans MON repo**
Créer le fichier avec les valeurs pour moi. L'ajouter au `.gitignore`. Vérifier que ça ne casse rien si le fichier est absent (fail-safe).

**Session B — Brancher la personnalité et les bulles sur USER_CONFIG**
Faire en sorte que si USER_CONFIG définit des traits/style/bulles, ils remplacent `personality.json` pour ces états. Si null → `personality.json` fait foi. Aucun changement visible pour moi, mais Alexia n'aura plus besoin d'un `personality.json` séparé.

**Session C — Conditionner les mentions TDAH**
Tous les textes UI et prompts IA qui mentionnent TDAH doivent être conditionnés à `USER_CONFIG?.ui?.showTDAHMention !== false`.

**Session D — Conditionner la feature cycle**
Les éléments UI du cycle menstruel (boutons, onglets, sections) doivent être masquables via `USER_CONFIG?.ui?.showCycleFeature !== false`.

**Session E — Sortir le code cheat anniversaire du code dur**
Le string `joyeuxanniversaire` et le nombre de pétales offerts doivent venir de USER_CONFIG, pas être hardcodés.

**Session F — Créer `user_config.ALEXIA.json` (template de référence)**
Un fichier commité dans le repo qui sert de modèle pour Alexia. Elle copie ce fichier → le renomme en `user_config.json` → et c'est tout. Quand je fais un `git pull` chez elle, seul ce template est mis à jour, jamais son `user_config.json` personnel.

**Session G — Mettre à jour ALEXIA_DIFF (Notion)**
Documenter les changements dans la page Notion ALEXIA_DIFF pour qu'elle reste à jour avec la nouvelle organisation.

---

### PARTIE 4 — Ce que je dois vérifier avant de commencer

Avant qu'on attaque la Session A, pose-moi les questions dont tu as besoin pour être sûr de ne pas inventer des choses sur mon code actuel.

**Maximum 3 questions, les plus utiles en priorité.**

---

## 4. Règles de travail (à garder en tête tout au long)

- Toujours proposer une structure ou un plan et **attendre ma validation** avant d'exécuter une action sur des fichiers.
- Ne jamais déplacer, renommer ou supprimer un fichier sans confirmation explicite.
- Décomposer les tâches longues en étapes courtes et validables une par une.
- Signaler clairement ce qui est **fait / en attente / nécessite mon action**.
- Conventions de nommage : `AAAA_CLIENT_NomProjet_v0.ext`, underscores uniquement.
- Français · écriture inclusive (point médian) · ton professionnel, clair, humain.
- Contexte TDAH : privilégier les approches qui donnent des résultats rapides et visibles, découper systématiquement, éviter les listes interminables sans priorité.

---

## 5. Suivi des sessions

> Cocher au fur et à mesure pour garder une trace de l'avancement.

- [ ] **Partie 1** — État des lieux complet
- [ ] **Partie 2** — Schéma cible validé
- [ ] **Partie 3** — Plan de sessions validé
- [ ] **Partie 4** — Questions préalables traitées
- [ ] **Session A** — `user_config.json` créé + `.gitignore`
- [ ] **Session B** — Personnalité branchée sur USER_CONFIG
- [ ] **Session C** — Mentions TDAH conditionnelles
- [ ] **Session D** — Feature cycle conditionnelle
- [ ] **Session E** — Code cheat anniversaire externalisé
- [ ] **Session F** — Template `user_config.ALEXIA.json` créé
- [ ] **Session G** — Page Notion ALEXIA_DIFF mise à jour
