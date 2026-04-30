/* ============================================================
   sw.js — Service Worker HabitGotchi
   ⚠️ RÈGLE : incrémenter CACHE_VERSION à chaque mise à jour
   pour forcer le rechargement chez tous les utilisateurs.
   ============================================================ */

const CACHE_VERSION = 'v4.7';  // ⚠️ SYNC → app.js ligne 1 : window.APP_VERSION

const ASSETS = [
  './',
  './index.html', 
  './manifest.json',
  './icon-192.png',
  './icon-512.png',

  // Styles
  './css/style.css',
  './css/animate.min.css',

  // Scripts
  './js/debug.js',
  './data/config.js',
  './js/app.js',
  './js/render.js',
  './js/envs.js',
  './js/render-sprites.js',
  './js/ui-core.js',
  './js/ui-habs.js',
  './js/ui-shop.js',
  './js/ui-ai.js',
  './js/ui-journal.js',
  './js/ui-settings.js',
  './js/ui-agenda.js',
  './js/ui-nav.js',

  // Data (JSON — les plus importants à versionner)
  './data/props.json',
  './prompts/ai_contexts.json',
  './prompts/ai_system.json',
];

// ── Installation : mise en cache de tous les assets ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())  // active immédiatement sans attendre
  );
});

// ── Activation : supprime les anciens caches ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_VERSION)  // garde uniquement la version actuelle
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())  // prend le contrôle de tous les onglets ouverts
  );
});

// ── Fetch : cache d'abord, réseau en fallback ──
self.addEventListener('fetch', e => {
  // Ne pas intercepter les appels API externes (Anthropic, météo...)
  if (!e.request.url.startsWith(self.location.origin)) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request).then(response => {
        // RÔLE : Ne mettre en cache que les réponses valides (200 OK)
        // POURQUOI : Sans ce guard, une erreur 404/500 serait mise en cache
        //            et servirait indéfiniment jusqu'au prochain CACHE_VERSION bump.
        if (!response.ok) return response;

        // Met en cache les nouvelles ressources rencontrées
        const clone = response.clone();
        caches.open(CACHE_VERSION)
          .then(cache => cache.put(e.request, clone))
          .catch(err => console.warn('SW cache error', err)); // STYLE : log si écriture cache échoue
        return response;
      });
    })
  );
});