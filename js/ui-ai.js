/* ============================================================
   ui-ai.js — Système IA : bulle, soutien, bilan (S3)
   RÔLE : Toutes les interactions avec l'API Claude Anthropic :
          bulle de pensée quotidienne (askClaude), achat d'objet IA
          (acheterPropClaude), soutien conversationnel (genSoutien),
          et bilan hebdomadaire (genBilanSemaine).
   Dépend de : app.js (window.D, save, today, hr, getSt, getWeekId,
                        getCyclePhase, addXp, addEvent)
               ui-core.js (callClaude, toast, toastModal, openModal,
                            clModal, lockScroll, unlockScroll, animEl,
                            showCycle)
               ui-shop.js (renderProps — après achat prop IA)
               ui-settings.js (renderProg — après bilan)
   ============================================================

   CONTENU :
   §1  startThinkingAnim()    — animation "..." pendant les appels IA
   §2  stopThinkingAnim()     — stoppe l'animation
   §3  getRegistre()          — registre émotionnel selon l'état
   §4  getExemples()          — exemples de pensées pour le prompt
   §5  askClaude()            — bulle de pensée quotidienne
   §6  acheterPropClaude()    — génère et achète un objet IA
   §7  toastInfo()            — modale d'info quota soutien
   §8  _showSoutienConfirm()  — modale de confirmation avant soutien
   §9  genSoutien()           — déclenche la session de soutien
   §10 _genSoutienCore()      — construit les prompts et la fenêtre
   §11 sendSoutienMsg()       — envoie un message dans le chat soutien
   §12 copierSoutien()        — copie le transcript du soutien
   §13 navW() / navM()        — navigation semaine/mois dans Progression
   §14 checkBilanReset()      — reset hebdo du compteur de bilans
   §15 genBilanSemaine()      — génère le bilan hebdomadaire via IA
   §16 copyBilanSemaine()     — copie le bilan dans le presse-papier
   ============================================================ */

// RÔLE : Animation "en train de penser" pendant un appel IA.
// POURQUOI : Donne vie au Gotchi pendant l'attente — les phrases varient selon le contexte
//            (thought, soutien, bilan, prop) pour rester cohérentes avec la situation.
//            Le paramètre `context` est optionnel — fallback sur des phrases génériques.
function startThinkingAnim(elementId, nomGotchi, context) {
  const el = document.getElementById(elementId);
  if (!el) return null;

  // RÔLE : Centrage systématique pendant l'animation.
  el.style.textAlign = 'center';

  const phrasesByContext = {
    thought: [
      `💭 ${nomGotchi} cherche ses mots`,
      `une idée germe`,
      `quelque chose me traverse`,
      `je t'observe depuis ce matin`,
    ],
    soutien: [
      `💭 ${nomGotchi} écoute`,
      `je suis là`,
      `je lis ce que tu m'as dit`,
      `je prends le temps d'y répondre`,
    ],
    bilan: [
      `💭 ${nomGotchi} repasse la semaine`,
      `je rassemble tout ça`,
      `je regarde ce qu'on a vécu`,
      `je cherche les bons mots`,
    ],
    prop: [
      `💭 ${nomGotchi} imagine quelque chose`,
      `une idée prend forme`,
      `je crée`,
      `presque prêt·e`,
    ],
  };

  const phrases = phrasesByContext[context] || [
    `💭 ${nomGotchi} réfléchit`,
    `je cherche les mots`,
    `je prépare quelque chose`,
    `je suis là`,
  ];

  // Ellipses animées en 3 temps — plus élégant que les points répétés
  const ellipses = [' ·', ' ··', ' ···'];
  let frame = 0, dot = 0;
  el.textContent = phrases[0] + ellipses[0];

  const interval = setInterval(() => {
    dot = (dot + 1) % 3;
    if (dot === 0) frame = (frame + 1) % phrases.length;
    el.textContent = phrases[frame] + ellipses[dot];
  }, 500);

  return interval;
}

function stopThinkingAnim(interval) {
  if (interval) clearInterval(interval);
}

/* ============================================================
   API CLAUDE — CADEAU / BULLE
   ============================================================ */

// RÔLE : Mémorise le dernier registre tiré pour éviter deux fois de suite le même
// POURQUOI : Variable module (hors fonction) — persiste entre les appels sans polluer window.*
let _dernierRegistre = null;

// RÔLE : Choisit un registre d'expression selon l'état du gotchi + traits de personnalité
// POURQUOI : Force la variété réelle des pensées sans dépendre du modèle seul
// POURQUOI : Le paramètre h (heure) a été retiré — les registres temporels ne sont plus utilisés.
// SIGNATURE : getRegistre(energy, happiness, traits) — traits est optionnel (tableau de strings)
function getRegistre(energy, happiness, traits = []) {
  // RÔLE : Normalise les traits en minuscules pour comparer sans souci de casse
  const t = (traits || []).map(s => s.toLowerCase());
  const aTraits = (...keys) => keys.some(k => t.includes(k));

  const registres = [];

  // ── Selon l'énergie ──
  if (energy <= 1) registres.push(
    "autodérision douce (tu es épuisé·e mais tu l'assumes avec humour)",
    "observation absurde sur le fait de survivre à une journée difficile"
  );
  if (energy >= 4) registres.push(
    "enthousiasme légèrement excessif et un peu ridicule",
    "taquin·e et complice, comme quelqu'un de trop réveillé"
  );

  // ── Selon le bonheur ──
  if (happiness <= 2) registres.push(
    "tendresse maladroite, comme quelqu'un qui cherche ses mots",
    "humour très léger sur les petits riens qui vont pas"
  );
  if (happiness >= 4) registres.push(
    "citation absurde ou légèrement philosophique détournée",
    "fierté un peu excessive pour quelque chose de minuscule"
  );

  // ── Registres conditionnels par traits de personnalité ──

  // RÔLE : Registres spécifiques au trait "pince-sans-rire" (profil Alexia)
  // POURQUOI : Un non-sequitur poétique tombe à plat pour un Gotchi sec et décalé — ces registres lui conviennent mieux
  if (aTraits('pince-sans-rire')) registres.push(
    "comparaison administrative douce (ex : vibes à jour, solde positif)",
    "constat factuel livré avec un enthousiasme parfaitement plat"
  );

  // RÔLE : Registres spécifiques au trait "absurde" (profil Émilie)
  // POURQUOI : Pousse plus loin l'absurde doux déjà présent dans le style d'Émilie
  if (aTraits('absurde')) registres.push(
    "non-sequitur botanique légèrement vexant (ex : tu es plus courageuse qu'une fougère)",
    "souvenir inventé d'un instant qui n'a probablement pas eu lieu"
  );

  // RÔLE : Registres spécifiques au trait "créatif"
  // POURQUOI : Joue sur l'imaginaire visuel, cohérent avec une illustratrice
  if (aTraits('créatif', 'creatif')) registres.push(
    "observation factuelle déguisée en haïku raté",
    "description d'une scène minuscule comme si c'était une peinture flamande"
  );

  // ── Registres universels (toujours disponibles) ──
  // POURQUOI : Le registre poétique inattendu est exclu si "pince-sans-rire" est actif — il sonnerait faux
  if (!aTraits('pince-sans-rire')) {
    registres.push("non-sequitur poétique totalement inattendu");
  }
  registres.push(
    "observation microscopique sur quelque chose d'insignifiant",
    "mini-déclaration dramatique pour un détail du quotidien",
    // RÔLE : Nouveaux registres universels (ajoutés v4.81 — §3c AUDIT_IA_PERSONNALITE.md)
    "micro-confidence chuchotée comme si c'était un secret",
    "interjection courte suivie d'un silence révélateur (trois points)"
  );

  // ── Blacklist du dernier registre tiré ──
  // POURQUOI : Évite de tomber deux fois de suite sur le même registre
  // On exclut le dernier seulement si le pool a au moins 2 options (sécurité si pool très petit)
  let pool = registres;
  if (_dernierRegistre && registres.length >= 2) {
    pool = registres.filter(r => r !== _dernierRegistre);
  }

  // Tire un registre au hasard dans le pool filtré
  const choix = pool[Math.floor(Math.random() * pool.length)];
  _dernierRegistre = choix; // mémorise pour le prochain appel
  return choix;
}

// RÔLE : Construit les exemples de style pour le prompt IA
// POURQUOI : Extraite de askClaude pour éviter une IIFE illisible dans l'objet vars
function getExemples(journal, personality) {
  const notesUser = (journal || [])
    .slice(-15)
    .map(n => (n.text || '').trim())
    .filter(t => t.length > 15 && t.length < 200)
    .slice(-4);

  const bullesPassees = [
    ...(personality?.bulles?.idle   || []).slice(0, 1),
    ...(personality?.bulles?.triste || []).slice(0, 1),
  ];

  const tout = [...notesUser, ...bullesPassees];
  return tout.length ? tout.join(' / ') : '*bâille*, *sourit*';
}

// ─────────────────────────────────────────────────────────────────────────────
// RÔLE : Sérialise toneProfile (user_config.personality.toneProfile) en bloc
//        texte prêt à être injecté dans les prompts via {{toneBlock}}.
// POURQUOI : Le champ "style" libre ne suffit pas à discriminer Émilie vs Alexia
//            côté API — toneProfile donne des instructions explicites sur les
//            registres autorisés / interdits et les modulations par état émotionnel.
//            Retourne '' si toneProfile absent → zéro régression sur les configs
//            qui ne l'ont pas encore.
// ─────────────────────────────────────────────────────────────────────────────
function buildToneBlock(P, state) {
  const tp = P?.toneProfile;
  if (!tp) return ''; // pas de toneProfile → on n'injecte rien

  const lignes = [];

  // Registres que l'IA doit favoriser
  if (tp.registresPrefs?.length)
    lignes.push(`Registres favoris : ${tp.registresPrefs.join(', ')}.`);

  // Registres explicitement interdits
  if (tp.registresInterdits?.length)
    lignes.push(`Registres interdits : ${tp.registresInterdits.join(', ')}.`);

  // Contrainte de longueur de fragment
  if (tp.marqueurs?.longueur)
    lignes.push(`Longueur : ${tp.marqueurs.longueur}.`);

  // Modulations contextuelles selon l'état émotionnel du Gotchi
  // POURQUOI : Chaque état mérite un ton légèrement différent — explicitement
  //            écrit pour l'IA plutôt que laissé à son interprétation
  const mod = tp.modulationsParEtat || {};
  if (state.energy <= 1 && mod.fatigue)
    lignes.push(`Modulation énergie basse : ${mod.fatigue}.`);
  if (state.happiness >= 4 && mod.fierte)
    lignes.push(`Modulation bonne humeur : ${mod.fierte}.`);
  if (state.happiness <= 1 && mod.triste)
    lignes.push(`Modulation tristesse : ${mod.triste}.`);

  return lignes.join('\n');
}

/**
 * Demande à Claude une pensée personnalisée (Limité à 3x par jour).
 */
async function askClaude() {
  const key = D.apiKey;
  if (!key) { toast(`*chuchote* J'ai besoin de ma clé API dans les Réglages 🔑`); return; }

  const g = D.g, td = today();
  const msgEl = document.getElementById('claude-msg');

  /* ── Mode nuit ── */
  if (hr() >= 22 || hr() < 7) {
    const msgs = [
      "Zzz... je dors 🌙",
      "Chut ! Il est tard... 😴",
      "Laisse-moi tranquille, vas dormir ! 🌛",
      "...zzzZZZ... 💤",
      "Le Gotchi ronfle doucement. Reviens demain ✿"
    ];
    if (msgEl) {
      msgEl.textContent = msgs[Math.floor(Math.random() * msgs.length)];
      // RÔLE : déclenche l'animation d'entrée CSS (claudeMsgIn)
      msgEl.classList.remove('has-msg');
      void msgEl.offsetWidth; // force reflow pour rejouer l'animation si déjà présente
      msgEl.classList.add('has-msg');
    }
    return;
  }

  /* ── Limite 3 pensées par jour ── */
  if (window.D.lastThoughtDate !== td) {
    window.D.lastThoughtDate = td;
    window.D.thoughtCount    = 0;
  }
  if (window.D.thoughtCount >= 3) {
    toast("Le Gotchi a besoin de calme… Reviens demain 🌙");
    return;
  }

  /* ── Animation de chargement ── */
  const animThought = startThinkingAnim('claude-msg', g.name, 'thought');
  // RÔLE : bloque le bouton pendant l'appel IA et indique visuellement l'attente (.is-loading)
  const btnAsk = document.getElementById('btn-ask-claude');
  if (btnAsk) btnAsk.classList.add('is-loading');

  /* ── Construction du prompt ── */
  const P   = window.PERSONALITY;
  const CTX = window.AI_CONTEXTS?.askClaude;

  // RÔLE : Contexte cycle menstruel (si activé dans user_config)
  // POURQUOI : Déjà utilisé dans genSoutien — cohérence de la voix du Gotchi entre les deux modes IA
  const cycleDataAsk  = showCycle() ? getCyclePhase(td) : null;
  const cycleInfoAsk  = cycleDataAsk ? `${cycleDataAsk.label} (J${cycleDataAsk.j})` : null;

  // RÔLE : RDV du jour (si présents dans D.rdv)
  // POURQUOI : Un RDV stressant ou important peut colorer la voix du Gotchi sans le nommer explicitement
  const rdvAujourdhuiAsk = (D.rdv || [])
    .filter(r => r.date === td)
    .map(r => r.heure ? `${r.heure} ${r.label}` : r.label)
    .join(', ') || null;

  // RÔLE : Résumé sensoriel du moment (météo + état du Gotchi)
  // POURQUOI : Données déjà disponibles dans window.D et window.meteoData — les injecter ici
  //            permet au Gotchi de faire des références concrètes à l'environnement sans les nommer
  const m = window.meteoData || {};
  const partsCtx = [];
  if (m.temperature !== undefined) partsCtx.push(`${Math.round(m.temperature)}°C`);
  if (m.windspeed > 40)            partsCtx.push('vent fort');
  if (m.weathercode >= 61 && m.weathercode <= 67) partsCtx.push('pluie');
  if (D.g.poops?.length)           partsCtx.push(`${D.g.poops.length} crotte${D.g.poops.length > 1 ? 's' : ''} au sol`);
  const contextSensoriel = partsCtx.length ? partsCtx.join(', ') : null;

  // RÔLE : Notes écrites dans les dernières 24h (fenêtre glissante, pas uniquement le jour calendaire)
  // POURQUOI : Une note écrite à 23h hier est encore pertinente à 10h ce matin — le filtre par date coupait ce contexte
  // NOTE : j.date est une string ISO complète (ex: "2026-04-28T23:45:00.000Z") → new Date(j.date).getTime() pour comparer
  const cutoff24h = Date.now() - 24 * 60 * 60 * 1000; // timestamp il y a 24h
  const notesRecentes = D.journal
    .filter(j => j.date && new Date(j.date).getTime() >= cutoff24h)
    .map(j => j.text.slice(0, 40))
    .filter(t => t.length > 0)
    .join(' / ');

  const vars = {
    nameGotchi:    D.g.name         || P?.nom    || 'Petit·e Gotchi',
    userName:      D.g.userName     || D.userName || 'ton utilisatrice',
    diminutif:     D.g.userNickname || D.g.userName || D.userName || 'toi',
    // RÔLE : Passe les traits de personnalité à getRegistre pour activer les registres conditionnels
    // POURQUOI : Permet au pool de s'adapter au profil (Émilie ≠ Alexia) sans changer le template
    registre:      getRegistre(g.energy, g.happiness, P?.traits),
    style:         P?.style         || 'Phrases courtes, onomatopées entre astérisques, bienveillant.',
    traits:        P?.traits?.join(', ') || 'doux, joueur, curieux',
    energy:        g.energy,
    happiness:     g.happiness,
    // POURQUOI : heure et date retirées — les bulles sont rejouées n'importe quand,
    // une référence temporelle précise les rendrait incohérentes.
    notesRecentes: notesRecentes
      ? `Ambiance récente : ${notesRecentes}`
      : '',
    exemples:          getExemples(D.journal, P),
    // RÔLE : bloc contexte du moment — météo, cycle, RDV — rendu vide si rien à signaler
    // POURQUOI : Une seule variable {{contextSensoriel}} suffit dans le template pour éviter les lignes vides
    contextSensoriel: [
      contextSensoriel  ? `Contexte : ${contextSensoriel}.`  : '',
      cycleInfoAsk      ? `Cycle : ${cycleInfoAsk}.`          : '',
      rdvAujourdhuiAsk  ? `RDV du jour : ${rdvAujourdhuiAsk}.` : '',
    ].filter(Boolean).join(' ') || '',
    nomsExistants: [...new Set([
      ...(D.g.props || []).map(p => `${p.nom} (${p.type})`),
      ...(window.PROPS_LIB || []).map(p => `${p.nom} (${p.type})`)
    ])].join(', ') || 'aucun',
    timestamp:     Date.now(),
    // RÔLE : Injecte les 6 derniers fragments envoyés à Claude pour éviter les répétitions inter-appels
    // POURQUOI : Sans ça, l'IA ne sait pas ce qu'elle a écrit hier et peut reproduire la même structure.
    //            customBubbles stocke les bulles générées par l'IA (ajoutées dans app.js:1101-1107).
    //            On prend les 6 premières (les plus récentes sont en tête du tableau).
    fragmentsEvites: (D.g.customBubbles || []).slice(0, 6).join(' / ') || 'aucun',
    // RÔLE : Bloc ton dynamique construit depuis toneProfile (user_config.personality.toneProfile)
    // POURQUOI : Permet à Claude de connaître les registres autorisés/interdits et les modulations
    //            selon l'état émotionnel du moment — va bien au-delà du champ "style" libre.
    //            Rendu '' si toneProfile absent → rétrocompatible, zéro régression.
    toneBlock: buildToneBlock(P, { energy: g.energy, happiness: g.happiness }),
  };

  function fillVars(template) {
    return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
  }

  /* ── Règle cadeau : 1 tous les 3 jours ── */
  const giveGift = !D.lastGiftDate ||
    Math.floor((new Date() - new Date(D.lastGiftDate)) / 86400000) >= 3;

  const prompt = CTX
    ? fillVars(CTX.base) + '\n\n' + fillVars(giveGift ? CTX.withGift : CTX.withoutGift)
    : `Fallback : réponds en JSON {"message":"...","bulles":{"idle":"..."}}`;

  /* ── Appel API ── */
  try {
    const d = await callClaude({ messages:[{ role:'user', content:prompt }] });
    const rawText = d.content[0].text;
    const match   = rawText.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('JSON introuvable dans la réponse IA');
    const data = JSON.parse(match[0]);

    stopThinkingAnim(animThought);
    if (btnAsk) btnAsk.classList.remove('is-loading');

    /* ── Message affiché ── */
    if (msgEl) {
      msgEl.textContent = data.message;
      // RÔLE : déclenche l'animation d'entrée CSS (claudeMsgIn) à chaque nouvelle pensée
      msgEl.classList.remove('has-msg');
      void msgEl.offsetWidth; // force reflow pour rejouer l'animation
      msgEl.classList.add('has-msg');
    }

 /* ── Bulles enrichies (pool glissant 20 max) ── */
if (Array.isArray(data.bulles) && data.bulles.length) {
  if (!Array.isArray(D.g.customBubbles)) D.g.customBubbles = [];
  D.g.customBubbles.unshift(...data.bulles);
  D.g.customBubbles = D.g.customBubbles.slice(0, 20);
}

    /* ── Cadeau ── */
    if (giveGift && data.cadeau) {
      if (!D.g.props) D.g.props = [];
      if (!D.g.props.find(p => p.id === data.cadeau.id)) {
        D.g.props.push({ id:data.cadeau.id, nom:data.cadeau.nom, type:data.cadeau.type, actif:false, pxSize: data.cadeau.pxSize || null, seen:false, acquis: Date.now() });
        D.propsPixels                = D.propsPixels || {};
        D.propsPixels[data.cadeau.id] = data.cadeau;
        window.PROPS_LOCAL           = Object.values(D.propsPixels);
        D.lastGiftDate               = td;

        // RÔLE : Tire la bulle cadeau depuis le pool user_config (personality.bulles.cadeau)
        // POURQUOI : Le pool était redéfini en dur ici — user_config.json était ignoré,
        //            Émilie et Alexia avaient donc la même réaction cadeau, identité perdue.
        //            Fallback sur 4 bulles neutres si le pool user_config est absent.
        const P_bulles    = window.PERSONALITY ? window.PERSONALITY.bulles : {};
        const poolCadeau  = P_bulles.cadeau?.length
          ? P_bulles.cadeau
          : ["Oh ! Un cadeau ! 🎁", "*yeux brillants* ✨", `${data.cadeau.emoji} Pour moi ?! 💜`, "J'adore ! 🌸"];
        const bulleCadeau = poolCadeau[Math.floor(Math.random() * poolCadeau.length)]
          .replace('{{nom}}',       D.g.name           || 'toi')
          .replace('{{diminutif}}', D.g.userNickname   || D.userName || 'toi');
        flashBubble(bulleCadeau, 3000);
        toast(`🎁 Nouveau cadeau : ${data.cadeau.nom} !`);
        addEvent({ type:'cadeau', subtype:'ia', valeur:0, label:`${data.cadeau.nom} reçu en cadeau !` });
        updBadgeBoutique();
      }
    }

    /* ── Compteur ── */
    window.D.thoughtCount++;
    updThoughtFlowers();

    save(); renderProps(); updBubbleNow();

  } catch(e) {
    stopThinkingAnim(animThought);
    if (btnAsk) btnAsk.classList.remove('is-loading');
    if (msgEl) msgEl.textContent = '*soupir* Je n\'arrive pas à me connecter... ✿';
    console.error('Erreur askClaude :', e);
  }
}

/**
 * Demande à Claude de générer un Pixel Art via la Boutique.
 */
async function acheterPropClaude() {
  if ((D.g.petales || 0) < 10) { toast(`Pas assez de pétales 🌸`); return; }
  if (!D.apiKey) { toast(`*chuchote* J'ai besoin de ma clé API dans les Réglages 🔑`); return; }

  D.g.petales -= 10;
  save();

  /* ── Animation de chargement ── */
  const el = document.getElementById('boutique-contenu');
  if (el) el.innerHTML = `<p style="text-align:center;font-size:var(--fs-sm);padding:20px" id="prop-loading">💭</p>`;
  const animProp = startThinkingAnim('prop-loading', window.D.g.name, 'prop');

  /* ── Construction du prompt ── */
  const nomsInventaire = (D.g.props || []).map(p => `${p.nom} (${p.type})`);
  const nomsCatalogue  = (window.PROPS_LIB || []).map(p => `${p.nom} (${p.type})`);
  const nomsExistants = [...new Set([
  ...(D.g.props || []).map(p => `${p.nom} (${p.type})`),
  ...(window.PROPS_LIB || []).map(p => `${p.nom} (${p.type})`)
])].join(', ') || 'aucun';
  const themes = ['nature','cosmos','magie','cuisine','musique','voyage','océan','forêt','météo','jardin','minéral','rêve'];
  const theme  = themes[Math.floor(Math.random() * themes.length)];
  const ctx    = window.AI_CONTEXTS;

  /* ── Calcul du type le moins représenté (côté JS, fiable) ── */
  const allProps = [...(D.g.props || []), ...(window.PROPS_LIB || [])];
  const counts = { decor: 0, accessoire: 0, ambiance: 0 };
  allProps.forEach(p => { if (counts[p.type] !== undefined) counts[p.type]++; });

  // Tri : moins représenté en premier, égalité → ambiance > accessoire > decor
  const priorite = { ambiance: 3, accessoire: 2, decor: 1 };
  const typeImpose = Object.keys(counts).sort((a, b) => {
    if (counts[a] !== counts[b]) return counts[a] - counts[b];
    return priorite[b] - priorite[a];
  })[0];

  console.log('[buyProp] Comptage:', counts, '→ type imposé:', typeImpose);

  const prompt = ctx
    ? ctx.buyProp
        .replace('{{theme}}',         theme)
        .replace('{{existingNames}}', nomsExistants)
        .replace('{{typeImpose}}',    typeImpose)   // 🆕 nouvelle ligne
        .replace('{{timestamp}}',     Date.now())
    : (() => { toast(`*inquiet* Mes fichiers de mémoire sont manquants... 💜`); return null; })();

  if (!prompt) { stopThinkingAnim(animProp); return; }

  /* ── Appel API ── */
  try {
    const d = await callClaude({ messages:[{ role:'user', content:prompt }] });
    const match = d.content[0].text.match(/\{[\s\S]*\}/);

    stopThinkingAnim(animProp);

    if (match) {
      const obj = JSON.parse(match[0]);
      D.g.props.push({
        id:      obj.id,
        nom:     obj.nom,
        type:    obj.type,
        emoji:   obj.emoji  || '🎁',
        actif:   false,
        slot:    obj.slot   || 'A',
        motion:  obj.motion || 'drift',
        ancrage: obj.ancrage || null,
        seen:    false,
        acquis:  Date.now()  // timestamp pour badge "nouveau"
      });
      D.propsPixels         = D.propsPixels || {};
      D.propsPixels[obj.id] = obj;
      window.PROPS_LOCAL    = Object.values(D.propsPixels);
      save(); renderProps(); updUI();
      addEvent({
  type: 'cadeau',
  subtype: 'ia',
  valeur: 0,
  emoji: obj.emoji || '✨',
  label: `${obj.nom} créé par ${D.g.name} !`
});
      updTabletBadge();

      toast(`${obj.emoji || '✨'} ${obj.nom} ajouté à ton inventaire !`);
      const iaMsgs = [
    `${obj.emoji} Je l'ai fait pour toi ! 💜`,
    "*fier·e* C'est mon œuvre ! ✨",
    `${obj.emoji} J'ai tout imaginé ! 🌸`,
    "*souffle sur ses pattes* ✿",
    "Je savais que tu aimerais ! 💜"
      ];
      flashBubble(iaMsgs[Math.floor(Math.random() * iaMsgs.length)], 2500);
      ouvrirBoutique();
    }

  } catch(e) {
    stopThinkingAnim(animProp);
    D.g.petales = (D.g.petales || 0) + 10;
    save();
    toast(`*soupir* Je n'ai pas pu créer l'objet... pétales remboursés 🌸`);
    console.error('Erreur création prop IA :', e);
    ouvrirBoutique();
  }
}

/* ============================================================
   API CLAUDE — SOUTIEN
   ============================================================ */
function toastInfo() {
  toastModal("💬 Le Gotchi peut te partager une pensée jusqu'à 3 fois par jour.\n\n✍️ Si tu écris des notes dans ton journal, ses réponses seront personnalisées selon ton humeur du jour 💜");
}

// ─────────────────────────────────────────────────────────────────
// RÔLE : Affiche une modale de confirmation avant d'ouvrir le chat
//        de soutien. Gotchi animé sur fond blanc + état + 2 boutons.
// POURQUOI : Évite de consommer 1/3 session par accident.
// ─────────────────────────────────────────────────────────────────
function _showSoutienConfirm(onConfirm) {
  const D = window.D;
  const g = D.g;

  // ── Ouvre la modale avec le contenu de confirmation ──
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `
    <div style="text-align:center;padding:12px 8px 8px">

      <p style="font-size:var(--fs-sm);color:var(--lilac);font-weight:bold;margin-bottom:10px;text-align:left">
        💜 Besoin de soutien
      </p>

      <!-- RÔLE : Zone du mini canvas p5 — fond blanc, coins arrondis -->
      <!-- Hauteur 90px : assez pour adult (oreilles -10px + corps 50px + marge 30px) -->
      <div id="soutien-confirm-canvas"
           style="width:160px;height:90px;margin:0 auto 12px;
                  border-radius:12px;overflow:hidden;background:#ffffff">
      </div>

      <!-- RÔLE : Indique les sessions restantes dans la journée -->
      <!-- D.soutienCount est déjà incrémenté APRÈS confirmation — ici on affiche l'état actuel -->
      <p style="font-size:var(--fs-xs);opacity:0.6;margin-bottom:10px;line-height:1.5">
        ${3 - D.soutienCount} conversation${3 - D.soutienCount > 1 ? 's' : ''} restante${3 - D.soutienCount > 1 ? 's' : ''} aujourd'hui
      </p>

      <div style="display:flex;flex-direction:column;gap:6px">
        <button id="btn-confirm-soutien" class="btn btn-p"
                style="width:100%;font-size:var(--fs-sm)">
          Parler à ${g.name || 'Gotchi'}
        </button>
        <button class="btn btn-s"
                onclick="clModal()"
                style="width:100%;font-size:var(--fs-sm)">
          Annuler
        </button>
      </div>
    </div>
  `;
  animEl(document.getElementById('mbox'), 'bounceIn');

  // ── Mini canvas p5 : Gotchi animé sur fond blanc, sans décor ──
  // RÔLE : Instance p5 temporaire, détruite dès que la modale se ferme
  // POURQUOI : drawBaby/drawTeen/drawAdult sont des fonctions globales
  //            qui acceptent une instance p en paramètre → réutilisables ici
  let _miniP5 = null;

  const W = 160, H = 90;    // Dimensions du canvas (= la div ci-dessus, 160×90)

  // RÔLE : CY = Y du haut du sprite pour que le bas soit posé sur le "sol"
  // Baby  : corps PX*6 = 30px, pas d'oreilles  → cy = H - 30 - 8 = 52
  // Teen  : corps PX*8 = 40px, oreilles 10px   → cy = H - 40 - 8 = 42
  // Adult : corps PX*10= 50px, oreilles 10px   → cy = H - 50 - 8 = 32
  const MARGE_BAS = 8;
  const corpH = { egg: 25, baby: 30, teen: 40, adult: 50 };
  const CY = H - (corpH[g.stage] || 50) - MARGE_BAS;

  let miniX    = W / 2;     // Position X courante du Gotchi
  let miniDir  = 1;          // Direction : 1 = droite, -1 = gauche
  const XMIN_M = 28;         // Marge gauche (demi-largeur adult = PX*5=25 + 3px)
  const XMAX_M = W - 28;    // Marge droite
  const SPEED  = 0.5;        // Vitesse de déplacement (px/frame)
  let miniBlink = false;     // État clignotement local (indépendant du canvas principal)
  let miniBlinkT = 0;        // Compteur avant prochain clignotement
  let miniBlinkD = 0;        // Durée du clignotement en cours

  const miniSketch = (p) => {
    p.setup = () => {
      // RÔLE : Crée le canvas dans la div dédiée, fond blanc, pixel art net
      p.createCanvas(W, H).parent('soutien-confirm-canvas');
      p.noSmooth();   // Rendu pixel art sans antialiasing
      p.frameRate(12); // 12 fps : fluide pour un sprite, économe en CPU
      miniBlinkT = 40 + Math.floor(Math.random() * 80);
    };

    p.draw = () => {
      const gd = window.D.g;
      const en = gd.energy;
      const ha = gd.happiness;

      // Fond blanc pur
      p.background(255);

      // ── Déplacement horizontal ──
      // RÔLE : Gotchi se balade de gauche à droite en rebondissant sur les marges
      miniX += miniDir * SPEED;
      if (miniX >= XMAX_M) { miniX = XMAX_M; miniDir = -1; }
      if (miniX <= XMIN_M) { miniX = XMIN_M; miniDir  =  1; }

      // ── Clignotement local (copie du comportement de render.js) ──
      miniBlinkT--;
      if (!miniBlink && miniBlinkT <= 0) {
        miniBlink = true;
        miniBlinkD = 3 + Math.floor(Math.random() * 4);
      }
      if (miniBlink) {
        miniBlinkD--;
        if (miniBlinkD <= 0) {
          miniBlink = false;
          miniBlinkT = 40 + Math.floor(Math.random() * 80);
        }
      }

      // ── Injection temporaire de blink dans le scope global ──
      // RÔLE : drawBaby/drawTeen/drawAdult lisent la variable globale `blink`
      //        depuis render.js — on la surcharge temporairement pour ce frame
      // POURQUOI : On ne peut pas modifier render.js pour exposer blink,
      //            mais on peut écrire dessus le temps d'un draw()
      const prevBlink = window._miniBlink_backup;
      window.blink = miniBlink; // override temporaire

      // ── Dessin du sprite via les fonctions globales de render-sprites.js ──
      // `false` = sleeping:false (le Gotchi est éveillé dans la modale)
      p.push(); // Isole les transformations
      p.noStroke();
      if      (gd.stage === 'egg')   drawEgg   && drawEgg(p, miniX, CY);
      else if (gd.stage === 'baby')  drawBaby  && drawBaby(p, miniX, CY, false, en, ha);
      else if (gd.stage === 'teen')  drawTeen  && drawTeen(p, miniX, CY, false, en, ha);
      else                           drawAdult && drawAdult(p, miniX, CY, false, en, ha);
      p.pop();

      // Restaure blink pour que render.js ne soit pas perturbé
      window.blink = window._blink_main ?? false;
    };
  };

  // RÔLE : Sauvegarde la valeur courante de blink du canvas principal
  //        pour pouvoir la restaurer après chaque frame du mini canvas
  window._blink_main = window.blink ?? false;

  _miniP5 = new p5(miniSketch);

  // ── "Parler à [nom]" : détruit le mini p5 et lance le vrai chat ──
  document.getElementById('btn-confirm-soutien').addEventListener('click', () => {
    if (_miniP5) { _miniP5.remove(); _miniP5 = null; }
    onConfirm();
  });

  // ── Patch clModal : nettoie le mini p5 si on ferme avec ✕ ou Annuler ──
  // RÔLE : Évite une instance p5 zombie qui continue à tourner en arrière-plan
  const _origClModal = window.clModal;
  window.clModal = function() {
    if (_miniP5) { _miniP5.remove(); _miniP5 = null; }
    window.clModal = _origClModal; // Restaure clModal immédiatement après usage
    _origClModal();
  };
}

/**
 * Lance le chat d'urgence (limité à 6 messages non sauvegardés)
 * RÔLE : Vérifie les gardes (clé API, limite journalière), puis
 *        affiche la modale de confirmation avant d'ouvrir le chat.
 */
function genSoutien() {
  const D = window.D, td = today();

  // ✦ PAS DE CLÉ API : popup simplifié
  if (!D.apiKey) {
    document.getElementById('modal').style.display = 'flex';
    document.getElementById('mbox').innerHTML = `
      <div style="text-align:center;padding:10px">
        <div style="font-size:40px;margin-bottom:var(--sp-sm)">🔑</div>
        <p style="font-size:12px;margin-bottom:4px;color:var(--lilac);font-weight:bold">
          Clé API manquante
        </p>
        <p style="font-size:var(--fs-sm);color:var(--text2);margin-bottom:var(--sp-md)">
          Pour accéder au soutien du Gotchi,<br>ajoute ta clé API dans les Réglages.
        </p>
        <button class="btn btn-p" onclick="clModal(); go('settings')" style="width:100%">
        Aller dans les Réglages ⚙️
        </button>
      </div>
    `;
    animEl(document.getElementById('mbox'), 'bounceIn');
    return;
  }

  // ✦ LIMITE 3 SESSIONS PAR JOUR
  if (D.lastSoutienDate !== td) {
    D.lastSoutienDate = td;
    D.soutienCount = 0;
  }
  if (D.soutienCount >= 3) {
    toast("Le Gotchi a besoin de se reposer… Reviens demain 🌙");
    return;
  }

  // RÔLE : Affiche la confirmation AVANT de décompter — si l'utilisatrice
  //        annule, la session n'est pas consommée
  _showSoutienConfirm(() => _genSoutienCore(D, td));
}

/**
 * RÔLE : Cœur du lancement du chat — appelé uniquement après confirmation.
 *        Construit le prompt, ouvre la modale de chat, lance le 1er message IA.
 * POURQUOI : Séparé de genSoutien() pour que la modale de confirmation
 *            reste propre et indépendante.
 */
function _genSoutienCore(D, td) {
  // RÔLE : Décompte la session ici, APRÈS confirmation de l'utilisatrice
  D.soutienCount++;
  // RÔLE : Met à jour les fleurs sur le post-it menu immédiatement après consommation d'une session
  if (typeof updSoutienFlowers === 'function') updSoutienFlowers();
  save();

  const habsDuJour  = D.habits.map(h => ({ label:h.label, faite:(D.log[td]||[]).includes(h.catId) }));
  // RÔLE : Notes des dernières 24h (fenêtre glissante)
  // POURQUOI : Même logique que askClaude — évite de perdre le contexte d'une note écrite hier soir
  // NOTE : j.date est une string ISO complète → new Date(j.date).getTime() pour comparer au cutoff
  const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
  const notesDuJour = D.journal
    .filter(j => j.date && new Date(j.date).getTime() >= cutoff24h)
    .map(j => ({ humeur: j.mood, texte: j.text }));
  
  const ctx = window.AI_CONTEXTS;
const P = window.PERSONALITY;
const cycleData  = showCycle() ? getCyclePhase(td) : null;
const cycleInfo  = cycleData ? `${cycleData.label} (J${cycleData.j})` : 'non renseignée';
const rdvDuJour  = (D.rdv || [])
  .filter(r => r.date === td)
  .map(r => r.heure ? `${r.heure} ${r.label}` : r.label)
  .join(', ') || 'aucun';
const promptInit = ctx
  ? ctx.genSoutien
      .replace('{{nameGotchi}}',          D.g.name || P?.nom || 'Gotchi')
      .replace('{{userName}}',     D.g.userName || D.userName || 'toi')
      .replace('{{style}}',        P?.style || 'Phrases courtes, bienveillant.')
      .replace('{{traits}}',       P?.traits?.join(', ') || 'doux, curieux')
      .replace('{{heure}}',        new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
      .replace('{{date}}',         todayFr())
      .replace('{{energy}}',       `${D.g.energy}/5`)
      .replace('{{happiness}}',    `${D.g.happiness}/5`)
      .replace('{{habitsDone}}',   habsDuJour.filter(h=>h.faite).map(h=>h.label).join(', ') || 'aucune')
      .replace('{{habitsUndone}}', habsDuJour.filter(h=>!h.faite).map(h=>h.label).join(', ') || 'toutes faites !')
      .replace('{{notes}}',        notesDuJour.length ? notesDuJour.map(n=>`[${n.humeur}] ${n.texte}`).join(' | ') : 'aucune note')
      .replace('{{cycleInfo}}',      cycleInfo)
      .replace('{{rdvAujourdhui}}',  rdvDuJour)
  : `Tu es le Gotchi, compagnon bienveillant de ${D.g.userName || 'toi'}.\nIl est ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}, énergie ${D.g.energy}/5, humeur ${D.g.happiness}/5.\nCommence par une phrase qui montre que tu as lu son état. Pose UNE question ouverte. Ton doux, jamais de jugement.`;

window._soutienHistory = [];
  window._soutienCount = 0;
  modalLocked = true;
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('mbox').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <h3 style="font-size:13px;color:var(--lilac);">💜 Besoin de soutien</h3>
      ${window._modalCloseBtn('modalLocked=false;clModal()')} <!-- RÔLE : bouton ✕ standardisé — déverrouille modalLocked avant de fermer -->
    </div>
    <div class="soutien-chat" id="soutien-chat">
      <div class="soutien-chat" id="soutien-chat"></div>
    </div>
    <div style="display:flex;gap:6px;margin-top:8px">
      <input type="text" id="soutien-inp" class="inp" placeholder="Réponds ici..." style="font-size:var(--fs-sm)"
        onkeydown="if(event.key==='Enter')sendSoutienMsg()">
      <button class="btn btn-p" onclick="sendSoutienMsg()" style="flex-shrink:0;padding:var(--sp-sm) 12px">→</button>
    </div>
    <p id="soutien-count" style="font-size:var(--fs-xs);opacity:0.6;text-align:center;margin-top:4px;line-height:1.6">6 messages restants<br>conversation non sauvegardée</p>
    <button id="btn-copier-soutien" class="btn btn-s" onclick="copierSoutien()"
            style="width:100%;font-size:var(--fs-sm);margin-top:6px;
                   display:none;opacity:0;transition:opacity 0.5s ease">
      Copier la conversation
    </button>
`;
animEl(document.getElementById('mbox'), 'bounceIn');
  sendSoutienMsg(promptInit, true);
}

async function sendSoutienMsg(systemPrompt, isInit = false) {
  const key  = window.D.apiKey;
  const chat = document.getElementById('soutien-chat');

  /* ── Limite 6 messages par session ── */
  if (!isInit) {
    // RÔLE : Incrémente AVANT l'appel API — le 6ème message est le dernier accepté
    window._soutienCount++;

    // RÔLE : Bloque si le quota était déjà atteint (7ème tentative et au-delà)
    if (window._soutienCount > 6) {
      chat.innerHTML += `<div class="chat-bubble-system">Tu as atteint la limite de 6 messages pour cette session. Prends soin de toi 💜</div>`;
      chat.scrollTop = chat.scrollHeight;
      document.getElementById('soutien-inp').disabled = true;
      document.querySelector('#mbox .btn-p').disabled  = true;
      return;
    }

    // RÔLE : Met à jour le compteur affiché sur deux lignes
    const restants = 6 - window._soutienCount;
    const countEl  = document.getElementById('soutien-count');
    if (countEl) {
      countEl.innerHTML = restants <= 0
        ? `Dernier message<br>conversation non sauvegardée`
        : `${restants} message${restants > 1 ? 's' : ''} restant${restants > 1 ? 's' : ''}<br>conversation non sauvegardée`;
    }
  }

  if (!key) { toast(`*chuchote* J'ai besoin de ma clé API dans les Réglages 🔑`); return; }

  /* ── Message utilisatrice ── */
  if (!isInit) {
    const inp      = document.getElementById('soutien-inp');
    const userText = inp ? inp.value.trim() : '';
    if (!userText) return;
    chat.innerHTML += `<div class="chat-bubble-user">${userText}</div>`;
    inp.value = '';
    window._soutienHistory.push({ role:'user', content:userText });
  }

  /* ── Animation de chargement ── */
  const bubbleId   = 'typing-' + Date.now();
  chat.innerHTML  += `<div class="chat-bubble-system" id="${bubbleId}">💭</div>`;
  const animSoutien = startThinkingAnim(bubbleId, window.D.g.name, 'soutien');
  chat.scrollTop   = chat.scrollHeight;

  /* ── Construction du contexte ── */
  const messages = isInit ? [{ role:'user', content:systemPrompt }] : [...window._soutienHistory.slice(-6)];

  const D  = window.D;
  const P  = window.PERSONALITY;
  const td = today();

  const notesJour = D.journal
    .filter(j => j.date.startsWith(td))
    .slice(-3)
    .map(j => `[${j.mood}] ${j.text}`)
    .join(' | ') || 'aucune note';

  const habsDone = (D.log[td] || [])
    .map(catId => { const h = D.habits.find(h => h.catId === catId); return h ? h.label : null; })
    .filter(Boolean)
    .join(', ') || 'aucune';

  const cycleData  = showCycle() ? getCyclePhase(td) : null;
  const cycleInfo  = cycleData ? `${cycleData.label} (J${cycleData.j})` : 'non renseignée';
  const rdvDuJour  = (D.rdv || [])
  .filter(r => r.date === td)
  .map(r => r.heure ? `${r.heure} ${r.label}` : r.label)
  .join(', ') || 'aucun';

  // RÔLE : Sélectionne la source du contexte — override user_config en priorité, sinon ai_system.json
  // POURQUOI : ai.contexteOverride permet à l'utilisatrice de personnaliser le bloc contexte sans toucher au JSON système
  const sourceContexte = window.USER_CONFIG?.ai?.contexteOverride || window.AI_SYSTEM?.soutien_contexte || '';

  const contexte = sourceContexte
    .replace('{{nameGotchi}}',              D.g.name || P?.nom || 'Gotchi')
    .replace('{{userName}}',         D.g.userName || D.userName || 'toi')
    .replace('{{style}}',            P?.style || 'Phrases courtes, bienveillant.')
    .replace('{{traits}}',           P?.traits?.join(', ') || 'doux, curieux')
    .replace('{{heure}}',            new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
    .replace('{{date}}',             td)
    .replace('{{energy}}',           D.g.energy)
    .replace('{{happiness}}',        D.g.happiness)
    .replace('{{habsDone}}',         habsDone)
    .replace('{{notes}}',            notesJour)
    .replace('{{cycleInfo}}',     cycleInfo)
    .replace('{{rdvAujourdhui}}', rdvDuJour)
    .replace('{{messages_restants}}', 6 - window._soutienCount);

  // RÔLE : Sélectionne la source du system prompt — override user_config en priorité, sinon ai_system.json
  // POURQUOI : ai.systemPromptOverride permet de remplacer entièrement la voix du Gotchi en mode soutien
  //            sans modifier ai_system.json — utile pour un profil très différent (ex : Alexia, ou test de ton)
  //            Les .replace() des variables et la concaténation du contexte s'appliquent dans tous les cas.
  const sourceSys = window.USER_CONFIG?.ai?.systemPromptOverride || window.AI_SYSTEM?.soutien || '';

  const sysPrompt = sourceSys
    .replace('{{nameGotchi}}',  D.g.name || P?.nom || 'Gotchi')
    // RÔLE : {{diminutif}} = surnom de l'utilisatrice — cohérent avec les bulles statiques et les autres prompts API
    // POURQUOI : Migration 2026-05-01 — {{userName}} remplacé par {{diminutif}} dans ai_system.json
    //            pour unifier la variable de désignation (mimi vs Émilie) sur tous les canaux IA
    .replace('{{diminutif}}', D.g.userNickname || D.g.userName || D.userName || 'toi')
    .replace('{{style}}',     P?.style || 'Phrases courtes, bienveillant.')
    .replace('{{traits}}',    P?.traits?.join(', ') || 'doux, curieux')
    .concat(' ', contexte)
    .trim();

  /* ── Appel API ── */
  try {
    const d = await callClaude({ messages, system: sysPrompt });
    const reply = d.content?.[0]?.text || 'Je suis là. 💜';
    // NOTE : _soutienCount++ est fait AVANT l'appel API (dans le bloc limite ci-dessus)
    stopThinkingAnim(animSoutien);
    document.getElementById(bubbleId)?.remove();
    chat.innerHTML += `<div class="chat-bubble-claude">${reply}</div>`;
    chat.scrollTop  = chat.scrollHeight;

    if (isInit) window._soutienHistory.push({ role:'user', content:systemPrompt });
    window._soutienHistory.push({ role:'assistant', content:reply });

    // RÔLE : Révèle le bouton "Copier" et bloque l'input après le 6ème message reçu
    if (window._soutienCount >= 6) {
      document.getElementById('soutien-inp').disabled = true;
      document.querySelector('#mbox .btn-p').disabled  = true;
      const btnCopier = document.getElementById('btn-copier-soutien');
      if (btnCopier) {
        btnCopier.style.display = 'block';
        requestAnimationFrame(() => { btnCopier.style.opacity = '1'; });
      }
    }

  } catch(e) {
    stopThinkingAnim(animSoutien);
    document.getElementById(bubbleId)?.remove();
    chat.innerHTML += `<div class="chat-bubble-system">*soupir* Je n'arrive plus à te répondre... Vérifie ta clé API 💜</div>`;
    console.error('Erreur soutien IA :', e);
  }
}

function copierSoutien() {
  const chat = document.getElementById('soutien-chat');
  if (!chat) return;
  const D = window.D;
  const lignes = [];
  chat.querySelectorAll('.chat-bubble-user, .chat-bubble-claude').forEach(msg => {
    const auteur = msg.classList.contains('chat-bubble-user')
      ? (D.g.userName || D.userName || 'Toi')
      : (D.g.name || 'Gotchi');
    lignes.push(`${auteur} : ${msg.innerText.trim()}`);
  });
  if (!lignes.length) return;
  const texte = lignes.join('\n\n');
  const btn = document.getElementById('btn-copier-soutien');
  if (!navigator.clipboard) return; // fallback silencieux (contexte non sécurisé)
  navigator.clipboard.writeText(texte).then(() => {
    if (btn) { btn.textContent = '✓ Copié !'; setTimeout(() => btn.textContent = 'Copier la conversation', 2000); }
  }).catch(() => {});
}

/* ─── SYSTÈME 6 : INTROSPECTION & MÉMOIRE (Bilan IA) ─────────────── */

/* ============================================================
   API CLAUDE — BILAN SEMAINE
   ============================================================ */
let wOff = 0, mOff = 0;
function navW(d) {
  wOff += d;
  // Calcule le mois majoritaire de la semaine affichée
  const wd = getWkDates(wOff);
  const mois = wd.map(ds => new Date(ds + 'T12:00').getMonth());
  const majoritaire = mois.sort((a,b) =>
    mois.filter(m => m===b).length - mois.filter(m => m===a).length
  )[0];
  const annee = new Date(wd[3] + 'T12:00').getFullYear(); // mercredi = pivot fiable
  const now = new Date();
  mOff = (annee - now.getFullYear()) * 12 + (majoritaire - now.getMonth());
  renderProg();
}
function navM(d) { mOff += d; renderProg(); }


/* ── Reset du compteur si nouvelle semaine ── */
function checkBilanReset() {
  const currentWeek = getWeekId();
  if (window.D.g.bilanWeek !== currentWeek) {
    window.D.g.bilanWeek  = currentWeek;
    window.D.g.bilanCount = 0;
    save();
  }
}

async function genBilanSemaine() {
  const D = window.D, key = D.apiKey;
  const summaryEl = document.getElementById('claude-summary');
  const wd = getWkDates(wOff);
  const g = D.g, s = getSt(g.totalXp);
  const P = window.PERSONALITY; // RÔLE : personnalité du gotchi (style + traits) pour personnaliser le bilan
  const habitudes = D.habits.map(h => ({ habitude:h.label, jours_faits:wd.filter(d=>(D.log[d]||[]).includes(h.catId)).length, sur:7 }));
  const notes = D.journal.filter(j=>wd.includes(j.date.split('T')[0])).map(j=>({humeur:j.mood,texte:j.text,date:j.date.split('T')[0]}));
  const totalHabDays = wd.reduce((acc,d)=>acc+(D.log[d]||[]).length, 0);

  /* ── Vérification quota ── */
  checkBilanReset();
  if ((window.D.g.bilanCount || 0) >= 3) {
    summaryEl.textContent = 'Tu as déjà généré 3 bilans cette semaine 💜 Reviens vendredi prochain !';
    return;
  }

  /* ── Semaine en cours uniquement ── */
  // RÔLE : Empêche la génération d'un bilan sur une semaine passée même si le bouton est contourné.
  // POURQUOI : Le bilan est pensé comme un outil de la semaine active, pas un retour en arrière.
  if (wOff !== 0) {
    summaryEl.textContent = 'Le bilan ne peut être généré que pour la semaine en cours 💜';
    return;
  }

  /* ── Semaine en cours ou passée ? ── */
  const semaineEnCours  = wOff === 0;
  const jourSemaine     = new Date().getDay();
  let noteIA = '';
if (semaineEnCours) {
  if (jourSemaine === 5)      noteIA = 'Note : il reste encore 2 jours à cette semaine (samedi et dimanche). Génère un bilan d\'étape encourageant.';
  else if (jourSemaine === 6) noteIA = 'Note : il reste encore 1 jour à cette semaine (dimanche). Génère un bilan d\'étape encourageant.';
}

  /* ── Sans clé API ── */
  // RÔLE : Calcule l'identifiant ISO de la semaine affichée (ex: "2025-W18") pour indexer le bon bilan.
  // POURQUOI : Chaque semaine a son propre bilan dans D.g.bilans — on ne peut plus utiliser bilanText unique.
  const weekIdBilan = getWeekId(new Date(wd[3] + 'T12:00')); // mercredi = pivot ISO fiable

  if (!key) {
    const lignes = habitudes.map(h=>`• ${h.habitude} : ${h.jours_faits}/7 jours`).join('\n');
    const texte = `Semaine du ${wd[0]} au ${wd[6]}\n\n${lignes}\n\n${notes.length} note(s) de journal.\n\nAjoute ta clé API pour un bilan personnalisé ✿`;
    summaryEl.textContent = texte;
    document.getElementById('btn-copy-bilan').style.display = 'block';
    document.getElementById('bil-txt-hidden').value = texte;
    window.D.g.bilans = window.D.g.bilans ?? {};           // RÔLE : initialise l'objet d'archives si absent
    window.D.g.bilans[weekIdBilan] = texte;                // RÔLE : archive ce bilan sous la clé de sa semaine
    window.D.g.bilanText = texte;                          // RÔLE : compatibilité rétroactive
    save();
    return;
  }

  const animBilan = startThinkingAnim('claude-summary', g.name, 'bilan');
  // RÔLE : bloque le bouton pendant l'appel IA (.is-loading)
  const btnBilan = document.getElementById('btn-gen-bilan');
  if (btnBilan) btnBilan.classList.add('is-loading');

  /* ── Construction du prompt ── */
  const ctx = window.AI_CONTEXTS;
  const prompt = ctx
    ? ctx.genBilanSemaine
        .replaceAll('{{nameGotchi}}',   g.name)
        .replaceAll('{{userName}}',     D.g.userName || D.userName || 'ton utilisatrice')
        .replace('{{style}}',        P?.style  || 'Phrases courtes, bienveillant.')  // RÔLE : injecte le style de personnalité dans le bilan
        .replace('{{traits}}',       P?.traits?.join(', ') || 'doux, curieux')       // RÔLE : injecte les traits pour différencier Émilie / Alexia
        .replace('{{weekStart}}',    wd[0])
        .replace('{{weekEnd}}',      wd[6])
        .replace('{{stage}}',        s.l)
        .replace('{{energy}}',       g.energy)
        .replace('{{happiness}}',    g.happiness)
        .replace('{{habitudes}}',    habitudes.map(h=>`- ${h.habitude} : ${h.jours_faits}/7 jours`).join('\n'))
        .replace('{{totalHabDays}}', totalHabDays)
        .replace('{{notesCount}}',   notes.length)
        .replace('{{notes}}',        notes.length ? notes.map(n=>`[${n.date}/${n.humeur}] ${n.texte}`).join('\n') : 'aucune note cette semaine')
        .replace('{{bilanNote}}',    noteIA)
    : `Tu es le Gotchi. Bilan semaine ${wd[0]}→${wd[6]} pour ${g.name} (${s.l}). Énergie ${g.energy}/5, Bonheur ${g.happiness}/5. ${totalHabDays} habitudes cochées. ${notes.length} notes. Bilan chaleureux en 3 paragraphes courts. Ton doux, pas de bullet points. ${noteIA}`;

/* ── Appel API ── */
  try {
    const d = await callClaude({ messages:[{ role:'user', content:prompt }] });
    const bilan = (d.content?.[0]?.text || 'Je n\'ai pas pu générer le bilan.')
      .replaceAll('{{nameGotchi}}', g.name)
      .replaceAll('{{userName}}',   D.g.userName || D.userName || 'toi');

    stopThinkingAnim(animBilan);
    if (btnBilan) btnBilan.classList.remove('is-loading');
    summaryEl.textContent = bilan;
    document.getElementById('bil-txt-hidden').value = bilan;
    document.getElementById('btn-copy-bilan').style.display = 'block';
    window.D.g.bilanCount = (window.D.g.bilanCount || 0) + 1;
    window.D.g.bilans = window.D.g.bilans ?? {};           // RÔLE : initialise l'objet d'archives si absent
    window.D.g.bilans[weekIdBilan] = bilan;                // RÔLE : archive ce bilan sous la clé de sa semaine
    window.D.g.bilanText = bilan;                          // RÔLE : compatibilité rétroactive
    save();
    renderProg(); // rafraîchit l'état du bouton

  } catch(e) {
    stopThinkingAnim(animBilan);
    if (btnBilan) btnBilan.classList.remove('is-loading');
    summaryEl.textContent = '❌ Une erreur est survenue, réessaie plus tard 💜';
    console.error('Erreur bilan IA :', e);
  }
}

function copyBilanSemaine() {
  const hid = document.getElementById('bil-txt-hidden'); if (!hid) return;
  navigator.clipboard.writeText(hid.value).then(() => {
    const b = document.getElementById('btn-copy-bilan');
    if (b) { b.textContent = '✓ Copié !'; setTimeout(() => b.textContent = '📋 Copier le bilan', 1500); }
  });
}
// resetBilan() supprimée — un nouveau bilan écrase automatiquement l'ancien via genBilanSemaine()

/* ─── SYSTÈME 5 : INVENTAIRE & PERSONNALISATION (Esthétique) ────── */

