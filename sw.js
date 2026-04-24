/* ============================================================
   sw.js — Service Worker HabitGotchi
   ⚠️ RÈGLE : incrémenter CACHE_VERSION à chaque mise à jour
   pour forcer le rechargement chez tous les utilisateurs.
   ============================================================ */

const CACHE_VERSION = 'hg-v2.4n';  // ⚠️ SYNC → app.js ligne 1 : window.APP_VERSION

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
  './data/config.js',
  './js/app.js',
  './js/render.js',
  './js/envs.js',
  './js/ui.js',

  // Data (JSON — les plus importants à versionner)
  './data/props.json',
  './data/personality.json',
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
        // Met en cache les nouvelles ressources rencontrées
        const clone = response.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(e.request, clone));
        return response;
      });
    })
  );
});