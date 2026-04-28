# TESTING.md — Scénarios de test manuel HabitGotchi

> À parcourir après chaque session de modification.
> Pas besoin de tout tester à chaque fois — suis les sections marquées ⚠️ en priorité.
> Coche mentalement chaque point, note les bugs dans AUDIT.md.

---

## 0. Vérifications préalables (toujours)

- [ ] La console navigateur est vide (aucune erreur rouge)
- [ ] `APP_VERSION` affiché dans les réglages correspond à `sw.js CACHE_VERSION`
- [ ] L'app charge sans écran blanc ni freeze

---

## 1. Chargement & migration ⚠️

> Tester après toute modification de `defs()`, `load()`, `migrate()` ou `SCHEMA_VERSION`.

- [ ] Première ouverture (LocalStorage vide) → Gotchi en stade egg, valeurs par défaut correctes
- [ ] Rechargement avec sauvegarde existante → données conservées (XP, habitudes, journal)
- [ ] Ouvrir les DevTools → Application → LocalStorage → vérifier que `schemaVersion` est présent et correct
- [ ] Simuler une ancienne sauvegarde sans `schemaVersion` : supprimer le champ manuellement dans DevTools, recharger → migration appliquée sans erreur

---

## 2. Jauges énergie & bonheur ⚠️

> Tester après toute modification de `config.js` (constantes EN_*/HA_*) ou `render.js`.

Modifier les jauges directement en console : `D.g.energy = X; D.g.happiness = X; save()`

| État | Énergie | Bonheur | Ce qu'on doit voir |
|---|---|---|---|
| Épuisement | 1 | — | Dithering (effet pixels sombres) sur le corps |
| Bras tombés | 2 | — | Bras pendants vers le bas |
| Normal | 3 | 3 | Bras normaux, marche fluide |
| Triste | — | 1 | Bouche tournée vers le bas |
| Content | — | 3 | Sourire neutre |
| Très heureux | — | 4 | Grand sourire, animation vive |
| Bras levés (adulte) | — | 4 | Bras en l'air (stade adulte uniquement) |
| Pluie | — | 0 ou 1 | Gouttes animées dans le ciel |
| Soleil | — | 4 | Soleil dans le coin (le jour) |
| Arc-en-ciel | — | 5 | Arc-en-ciel (le jour) |
| Ciel gris | — | 0 ou 1 | Ciel grisâtre au lieu du bleu |

- [ ] Vérifier les 3 stades : `D.g.stage = 'baby'`, `'teen'`, `'adult'`
- [ ] Tilt (balancement) visible si `energy ≤ 2` et Gotchi non endormi

---

## 3. Habitudes ⚠️

> Tester après toute modification de `toggleHab()`, `renderHabs()`, `addEvent()`.

- [ ] Cocher une habitude → `+15 XP` affiché en flottant
- [ ] Décocher la même habitude → XP retiré, pas de doublon dans l'eventLog
- [ ] Recharger → état des cases conservé (cochées/décochées)
- [ ] Changer le label d'une habitude inline → sauvegardé après rechargement

---

## 4. Repas & snacks

> Tester après toute modification de `giveSnack()`, `ouvrirSnack()`, `ensureMealsToday()`.

- [ ] Ouvrir le repas → 3 emojis proposés (dont 1 préféré de la semaine)
- [ ] Manger un snack → énergie ou bonheur augmente, pétales +2
- [ ] Hors fenêtre horaire → message d'indisponibilité (pas de crash)
- [ ] Repas déjà pris aujourd'hui → bouton désactivé ou message

---

## 5. Boutique & objets IA

> Tester après toute modification de `ouvrirBoutique()`, `acheterProp()`, `callClaude()`.

- [ ] Ouvrir la boutique → objets catalogue affichés correctement
- [ ] Acheter un objet catalogue → XP déduit, objet dans l'inventaire
- [ ] Générer un objet IA → appel Claude, objet affiché en pixel art
- [ ] Supprimer un objet IA → disparaît de l'inventaire sans erreur
- [ ] Équiper/déséquiper un objet → position correcte sur le Gotchi

---

## 6. IA & soutien

> Tester après toute modification de `callClaude()` ou des prompts dans `ai_contexts.json`.

- [ ] Tester la clé API dans les réglages → feedback ✅ ou ❌ clair
- [ ] Générer une pensée (bulle) → réponse cohérente avec l'état du Gotchi
- [ ] Ouvrir le soutien → conversation démarre sans erreur
- [ ] Envoyer un message → réponse dans la bonne langue, ton correct
- [ ] Générer le bilan hebdo → texte affiché, bouton Copier fonctionnel

---

## 7. Journal

> Tester après toute modification de `saveJ()`, `renderJournal()`, `exportJournal()`.

- [ ] Écrire une note → `+15 XP`, note sauvegardée
- [ ] Relire les notes → affichage chronologique correct
- [ ] Tenter d'écrire une 6e note dans la journée → bloqué (max 5)
- [ ] Dépasser 600 caractères → compteur rouge, sauvegarde bloquée
- [ ] Exporter le journal → fichier `.txt` téléchargé avec toutes les notes

---

## 8. Agenda & RDV

- [ ] Ajouter un RDV → sauvegardé, affiché dans la liste
- [ ] Modifier un RDV → changement conservé après rechargement
- [ ] Supprimer un RDV → disparaît sans erreur

---

## 9. Crottes ⚠️

> Tester après toute modification de `maybeSpawnPoop()`, `spawnPoop()`, `cleanPoops()`.

- [ ] En console : `maybeSpawnPoop()` → crotte spawne (ou non selon le délai)
- [ ] Cliquer sur une crotte → disparaît, réaction du Gotchi
- [ ] `setInterval` actif : vérifier dans DevTools → aucune erreur, pas de double intervalle

---

## 10. Service Worker & cache ⚠️

> Tester après toute modification de `sw.js` ou incrément de version.

- [ ] Après un rechargement forcé (Ctrl+Shift+R) → nouvelle version chargée
- [ ] Dans DevTools → Application → Service Workers → version active = `hg-vX.XX`
- [ ] Ancien cache supprimé (aucune version précédente dans Cache Storage)

---

## 11. Responsive mobile

- [ ] Ouvrir sur mobile (ou DevTools mode mobile) → pas de débordement horizontal
- [ ] Canvas Gotchi centré et lisible
- [ ] Modales accessibles et fermables au tap

---

## Raccourcis console utiles

```js
// Forcer un état pour tester visuellement
D.g.energy = 1; D.g.happiness = 1; save(); location.reload();

// Vider le LocalStorage (repart de zéro)
localStorage.clear(); location.reload();

// Vérifier la version de schéma
console.log(D.schemaVersion);

// Spawner une crotte immédiatement
D.g.lastPoopSpawn = 0; maybeSpawnPoop();

// Simuler une absence de 3 jours
D.lastActive = new Date(Date.now() - 3 * 86400000).toISOString(); save(); location.reload();
```
