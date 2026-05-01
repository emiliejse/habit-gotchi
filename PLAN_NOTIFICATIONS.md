# Plan d'implémentation — Notifications Push
*Rédigé le 2026-05-01 — à exécuter en plusieurs sessions*

**Objectif :** Notifications fiables (app fermée, iPhone + Xiaomi) pour :
- Rappel d'habitudes non cochées le soir
- Rappel de RDV (délai configurable, configurable par RDV)

**Architecture choisie :** Web Push VAPID via Cloudflare Worker (gratuit) + Notification API dans le SW.

---

## Vue d'ensemble

```
[app] → subscribe() → [Cloudflare Worker /subscribe]
[app] → sauvegarderRdv() → [Cloudflare Worker /rdv]
[Cloudflare cron, toutes les heures] → vérifie RDV + habitudes → [push navigateur]
[sw.js listener 'push'] → affiche notification
[sw.js listener 'notificationclick'] → focus app
```

---

## Étape 1 — Cloudflare Worker (backend)

> Prérequis : compte Cloudflare gratuit + `npm install -g wrangler`

### 1.1 Créer le projet Worker

```bash
mkdir habitgotchi-push-worker && cd habitgotchi-push-worker
wrangler init
```

### 1.2 Générer les clés VAPID

```bash
npx web-push generate-vapid-keys
```

Copier les deux clés (`VAPID_PUBLIC_KEY` et `VAPID_PRIVATE_KEY`).  
Les stocker comme secrets Cloudflare :

```bash
wrangler secret put VAPID_PRIVATE_KEY
wrangler secret put VAPID_SUBJECT   # → "mailto:emilie.josse@protonmail.com"
```

La clé publique sera copiée dans `app.js` (constante `VAPID_PUBLIC_KEY`).

### 1.3 Créer le KV namespace (stockage subscriptions + RDV)

```bash
wrangler kv namespace create "HG_STORE"
```

Copier l'`id` retourné dans `wrangler.toml` :

```toml
[[kv_namespaces]]
binding = "HG_STORE"
id = "COLLER_L_ID_ICI"
```

### 1.4 Code du Worker (`src/index.js`)

Le Worker expose 3 routes et 1 cron :

```js
// ============================================================
// habitgotchi-push-worker/src/index.js
// RÔLE : Backend minimal pour les notifications push HabitGotchi
// ROUTES :
//   POST /subscribe    → enregistre une subscription push + userId
//   DELETE /subscribe  → supprime une subscription
//   POST /rdv          → enregistre un RDV à notifier
//   DELETE /rdv        → supprime un RDV (annulation)
// CRON : toutes les heures → vérifie les RDV à venir
// ============================================================

import webpush from 'web-push';

export default {

  // ── Requêtes HTTP ──
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS — autorise l'app HabitGotchi
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers });

    // POST /subscribe — enregistre la subscription
    if (url.pathname === '/subscribe' && request.method === 'POST') {
      const { userId, subscription } = await request.json();
      if (!userId || !subscription) return new Response('Missing data', { status: 400, headers });
      await env.HG_STORE.put(`sub:${userId}`, JSON.stringify(subscription));
      return new Response('OK', { headers });
    }

    // DELETE /subscribe — désabonnement
    if (url.pathname === '/subscribe' && request.method === 'DELETE') {
      const { userId } = await request.json();
      await env.HG_STORE.delete(`sub:${userId}`);
      return new Response('OK', { headers });
    }

    // POST /rdv — enregistre un RDV avec son heure de rappel
    // Body attendu : { userId, rdvId, label, isoDateTime, minutesAvant }
    if (url.pathname === '/rdv' && request.method === 'POST') {
      const data = await request.json();
      if (!data.userId || !data.rdvId || !data.isoDateTime) {
        return new Response('Missing data', { status: 400, headers });
      }
      // Calcul du timestamp de déclenchement
      const triggerMs = new Date(data.isoDateTime).getTime() - (data.minutesAvant || 30) * 60000;
      const rdv = { ...data, triggerMs };
      await env.HG_STORE.put(`rdv:${data.userId}:${data.rdvId}`, JSON.stringify(rdv));
      return new Response('OK', { headers });
    }

    // DELETE /rdv — supprime un RDV
    if (url.pathname === '/rdv' && request.method === 'DELETE') {
      const { userId, rdvId } = await request.json();
      await env.HG_STORE.delete(`rdv:${userId}:${rdvId}`);
      return new Response('OK', { headers });
    }

    return new Response('Not found', { status: 404, headers });
  },

  // ── Cron toutes les heures ──
  // RÔLE : Parcourt tous les RDV en attente, envoie les notifs dont l'heure est passée
  async scheduled(event, env, ctx) {
    const now = Date.now();
    const WINDOW_MS = 65 * 60 * 1000; // 65 min (légère tolérance pour le cron)

    // Liste tous les RDV stockés
    const list = await env.HG_STORE.list({ prefix: 'rdv:' });

    for (const key of list.keys) {
      const raw = await env.HG_STORE.get(key.name);
      if (!raw) continue;
      const rdv = JSON.parse(raw);

      // Déclencher si dans la fenêtre [maintenant - 65min, maintenant]
      if (rdv.triggerMs <= now && rdv.triggerMs >= now - WINDOW_MS) {
        const subRaw = await env.HG_STORE.get(`sub:${rdv.userId}`);
        if (!subRaw) continue;
        const subscription = JSON.parse(subRaw);

        webpush.setVapidDetails(
          env.VAPID_SUBJECT,
          env.VAPID_PUBLIC_KEY,     // passée en variable d'environnement non-secrète (wrangler.toml vars)
          env.VAPID_PRIVATE_KEY,
        );

        const payload = JSON.stringify({
          type: 'rdv',
          title: `Rappel · ${rdv.label}`,
          body: `Dans ${rdv.minutesAvant} min`,
          rdvId: rdv.rdvId,
        });

        await webpush.sendNotification(subscription, payload).catch(err => {
          console.error('Push failed:', err);
          // Si subscription expirée (410), supprimer
          if (err.statusCode === 410) env.HG_STORE.delete(`sub:${rdv.userId}`);
        });

        // Supprimer le RDV envoyé pour ne pas le renvoyer
        await env.HG_STORE.delete(key.name);
      }
    }
  },
};
```

### 1.5 `wrangler.toml` — config cron + clé publique

```toml
name = "habitgotchi-push-worker"
main = "src/index.js"
compatibility_date = "2024-01-01"

[triggers]
crons = ["0 * * * *"]   # toutes les heures pile

[vars]
VAPID_PUBLIC_KEY = "COLLER_LA_CLE_PUBLIQUE_ICI"
```

### 1.6 Dépendance

```bash
npm install web-push
```

### 1.7 Deploy

```bash
wrangler deploy
```

Noter l'URL du Worker déployé (ex : `https://habitgotchi-push-worker.MON_COMPTE.workers.dev`).

---

## Étape 2 — app.js

### 2.1 Nouvelle constante en haut de fichier (après `APP_VERSION`)

```js
// RÔLE : Clé publique VAPID pour l'abonnement push — doit correspondre à la clé du Worker.
// POURQUOI : La Notification API a besoin de cette clé pour chiffrer la subscription.
const VAPID_PUBLIC_KEY = 'COLLER_LA_CLE_PUBLIQUE_ICI';
const PUSH_WORKER_URL  = 'https://habitgotchi-push-worker.MON_COMPTE.workers.dev';
```

### 2.2 Nouvelle clé dans `defs()` → `D.g`

Ajouter dans le bloc `g: { ... }` de `defs()` :

```js
notif: {
  enabled:      false,  // notifications activées par l'utilisatrice
  habReminder:  true,   // rappel habitudes non cochées
  habHeure:     '20:00', // heure du rappel habitudes
  rdvDefault:   30,      // délai rappel RDV par défaut (minutes avant)
},
```

⚠️ **Migration requise** — signaler à Émilie d'incrémenter `SCHEMA_VERSION`.

Ajouter dans le tableau `MIGRATIONS` :

```js
function m_notif(d) {
  // RÔLE : Initialise les préférences de notification pour les sauvegardes existantes.
  d.g.notif = d.g.notif ?? {
    enabled: false,
    habReminder: true,
    habHeure: '20:00',
    rdvDefault: 30,
  };
  return d;
}
// → ajouter m_notif dans le tableau MIGRATIONS
```

### 2.3 Nouvelle fonction `initNotifications()` — à appeler depuis `bootstrap()`

```js
// RÔLE : Initialise le système de notifications push.
//        Demande la permission, génère la subscription, l'envoie au Worker.
// POURQUOI : Appelé une seule fois au démarrage. Sans permission, tout est silencieux.
async function initNotifications() {
  // Navigateur sans support → sortir silencieusement
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

  const notifPrefs = window.D.g.notif;
  if (!notifPrefs?.enabled) return; // désactivé par l'utilisatrice → ne pas demander

  // Demande de permission si pas encore accordée
  if (Notification.permission === 'default') {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return;
  }
  if (Notification.permission !== 'granted') return;

  // Récupère le SW enregistré
  const reg = await navigator.serviceWorker.ready;

  // Vérifie si une subscription existe déjà
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    // Crée une nouvelle subscription avec la clé publique VAPID
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  // Envoie la subscription au Worker avec l'userId
  const userId = window.D.g.userName + '_' + (window.D.firstLaunch || 'anon');
  await fetch(`${PUSH_WORKER_URL}/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, subscription: sub }),
  }).catch(err => console.warn('Push subscribe failed:', err));

  // Stocke l'userId dans D pour les futurs appels au Worker
  window._pushUserId = userId;
}

// RÔLE : Convertit une clé VAPID base64url en Uint8Array attendu par PushManager.subscribe().
// POURQUOI : L'API Web Push exige ce format binaire — le base64 url seul ne fonctionne pas.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
```

Appel dans `bootstrap()` (après `initUI()`) :

```js
initNotifications(); // pas de await — non bloquant
```

### 2.4 Nouvelle fonction `desabonnerNotifications()` — pour le toggle settings

```js
// RÔLE : Supprime la subscription push et prévient le Worker.
async function desabonnerNotifications() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();

  if (window._pushUserId) {
    await fetch(`${PUSH_WORKER_URL}/subscribe`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: window._pushUserId }),
    }).catch(() => {});
  }
}
```

---

## Étape 3 — ui-agenda.js

### 3.1 Modifier `sauvegarderRdv()` — envoyer le RDV au Worker si notifs activées

Après le `save()` dans `sauvegarderRdv()`, ajouter :

```js
// RÔLE : Si les notifications sont activées et que le RDV a une heure, l'envoyer au Worker.
// POURQUOI : Le Worker stocke le RDV pour envoyer un push à l'heure configurée,
//            même si l'app est fermée au moment du rappel.
if (window.D.g.notif?.enabled && heure && window._pushUserId) {
  const isoDateTime = `${date}T${heure}:00`;
  const minutesAvant = window.D.g.notif.rdvDefault || 30;
  const rdvId = nouveauRdv.id; // l'id vient d'être créé juste avant le save()

  fetch(`${PUSH_WORKER_URL}/rdv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: window._pushUserId,
      rdvId: String(rdvId),
      label: label,
      isoDateTime,
      minutesAvant,
    }),
  }).catch(err => console.warn('RDV push register failed:', err));
}
```

### 3.2 Modifier `supprimerRdv()` — retirer le RDV du Worker

Après le `save()` dans `supprimerRdv()`, ajouter :

```js
// RÔLE : Annule le rappel push côté Worker si le RDV est supprimé.
if (window.D.g.notif?.enabled && window._pushUserId) {
  fetch(`${PUSH_WORKER_URL}/rdv`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: window._pushUserId, rdvId: String(id) }),
  }).catch(() => {});
}
```

---

## Étape 4 — ui-settings.js

### 4.1 Ajouter un bloc "Notifications" dans `openTablet()` ou dans le panneau settings existant

```js
// RÔLE : Bloc de configuration des notifications — permission + préférences.
// POURQUOI : L'utilisatrice doit pouvoir activer/désactiver et régler l'heure de rappel habitudes.
function renderNotifSettings() {
  const prefs = window.D.g.notif || {};
  const perm  = ('Notification' in window) ? Notification.permission : 'unsupported';

  return `
    <div class="settings-section">
      <h3>Notifications</h3>

      ${perm === 'denied'
        ? `<p class="txt-sm c-warn">Notifications bloquées dans les réglages iOS/Android.
           Va dans Réglages › HabitGotchi pour les activer.</p>`
        : ''}

      <label class="toggle-row">
        <span>Activer les rappels</span>
        <input type="checkbox" id="notif-toggle"
          ${prefs.enabled ? 'checked' : ''}
          ${perm === 'denied' ? 'disabled' : ''}
          onchange="toggleNotifications(this.checked)">
      </label>

      <label class="toggle-row ${!prefs.enabled ? 'disabled' : ''}">
        <span>Rappel habitudes</span>
        <input type="time" id="notif-heure" class="inp"
          value="${prefs.habHeure || '20:00'}"
          ${!prefs.enabled ? 'disabled' : ''}
          onchange="saveNotifPref('habHeure', this.value)">
      </label>

      <label class="toggle-row ${!prefs.enabled ? 'disabled' : ''}">
        <span>Délai rappel RDV</span>
        <select id="notif-rdv-delai" class="inp"
          ${!prefs.enabled ? 'disabled' : ''}
          onchange="saveNotifPref('rdvDefault', parseInt(this.value))">
          ${[10, 15, 30, 60].map(m =>
            `<option value="${m}" ${(prefs.rdvDefault||30) === m ? 'selected' : ''}>${m} min avant</option>`
          ).join('')}
        </select>
      </label>
    </div>
  `;
}
```

### 4.2 Nouvelles fonctions helper settings

```js
// RÔLE : Active ou désactive les notifications — gère la permission et la subscription.
async function toggleNotifications(enabled) {
  window.D.g.notif.enabled = enabled;
  save();
  if (enabled) {
    await initNotifications();
  } else {
    await desabonnerNotifications();
  }
  // Re-render le bloc pour refléter l'état permission
  // (adapter selon l'endroit où renderNotifSettings() est appelée)
}

// RÔLE : Sauvegarde une préférence de notification dans D.g.notif.
function saveNotifPref(key, value) {
  window.D.g.notif[key] = value;
  save();
}
```

---

## Étape 5 — sw.js

### 5.1 Ajouter le listener `push`

À la fin de `sw.js`, après le listener `fetch` :

```js
// RÔLE : Reçoit les push envoyés par le Worker Cloudflare et affiche la notification.
// POURQUOI : Ce listener s'exécute même app fermée — c'est le cœur du système.
self.addEventListener('push', event => {
  if (!event.data) return;

  let data = {};
  try { data = event.data.json(); } catch { return; }

  const title   = data.title || 'HabitGotchi';
  const options = {
    body:  data.body  || '',
    icon:  './icon-192.png',
    badge: './icon-192.png',
    tag:   data.rdvId || 'hg-notif', // tag unique par RDV pour éviter les doublons
    data:  { type: data.type, rdvId: data.rdvId },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// RÔLE : Ramène le focus sur l'app quand l'utilisatrice tape la notification.
self.addEventListener('notificationclick', event => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Si l'app est déjà ouverte → focus
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Sinon → ouvrir
      if (clients.openWindow) return clients.openWindow('./');
    })
  );
});
```

---

## Récapitulatif des fichiers modifiés

| Fichier | Modification |
|---|---|
| `sw.js` | Listeners `push` + `notificationclick` |
| `js/app.js` | Constantes VAPID, `defs()` + migration, `initNotifications()`, `desabonnerNotifications()`, `urlBase64ToUint8Array()` |
| `js/ui-agenda.js` | `sauvegarderRdv()` → envoi Worker, `supprimerRdv()` → annulation Worker |
| `js/ui-settings.js` | `renderNotifSettings()`, `toggleNotifications()`, `saveNotifPref()` |
| `AUDIT.md` | Mettre S8 à jour après implémentation |

## Points à ne pas oublier

- **Incrémenter `SCHEMA_VERSION`** dans `app.js` (migration `D.g.notif`)
- **Incrémenter `CACHE_VERSION`** dans `sw.js` et `APP_VERSION` dans `app.js` après les modifs SW
- La clé `VAPID_PUBLIC_KEY` doit être **identique** dans `app.js` et dans `wrangler.toml`
- Sur iOS : la permission push ne peut être demandée **que sur interaction utilisatrice** (tap bouton) — ne pas appeler `Notification.requestPermission()` au chargement automatique, uniquement depuis le toggle settings
- Tester sur iPhone en mode PWA (pas depuis Safari directement) — les push ne fonctionnent pas hors PWA sur iOS
