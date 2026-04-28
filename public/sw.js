// =========================================
// SERVICE WORKER — Therapheye
// Network-first + cache offline mejorado
// Background sync queue para datos offline
// =========================================

const APP_NAME = 'Therapheye';
const DEFAULT_ICON = '/therapheye-icon.svg';
const CACHE_STATIC  = 'therapheye-static-v2';
const CACHE_DYNAMIC = 'therapheye-dynamic-v2';
const CACHE_API     = 'therapheye-api-v1';
const MAX_DYNAMIC   = 80;

// Assets que siempre deben estar disponibles offline
const PRECACHE = [
  '/',
  '/therapheye-icon.svg',
  '/manifest.json',
];

// Rutas de API que NO se deben cachear (datos sensibles, mutaciones)
const NO_CACHE_PATTERNS = [
  '/.netlify/functions/',
  '/api/',
];

// ── Install: precachear assets críticos ─────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: limpiar caches viejos ─────────────────────────────────────────
self.addEventListener('activate', e => {
  const validCaches = [CACHE_STATIC, CACHE_DYNAMIC, CACHE_API];
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !validCaches.includes(k)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: estrategia por tipo de recurso ───────────────────────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // No cachear requests a otros orígenes (APIs externas como Anthropic, Neon)
  if (url.origin !== self.location.origin) return;

  // No cachear Netlify Functions ni API routes
  if (NO_CACHE_PATTERNS.some(p => url.pathname.startsWith(p))) return;

  // Assets estáticos (JS, CSS, imágenes, fuentes) — Cache-first
  if (isStaticAsset(url.pathname)) {
    e.respondWith(cacheFirst(e.request, CACHE_STATIC));
    return;
  }

  // Navegación y HTML — Network-first con fallback
  e.respondWith(networkFirst(e.request, CACHE_DYNAMIC));
});

function isStaticAsset(path) {
  return /\.(js|css|woff2?|ttf|otf|eot|png|jpg|jpeg|gif|webp|avif|svg|ico)(\?.*)?$/.test(path);
}

// Cache-first: ideal para assets con hash en el nombre
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

// Network-first: ideal para HTML y datos dinámicos
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
      // Limpiar cache dinámico si crece mucho
      trimCache(cacheName, MAX_DYNAMIC);
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Fallback a index.html para SPA routing
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/');
      if (fallback) return fallback;
    }
    return new Response('Offline', { status: 503 });
  }
}

async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
    trimCache(cacheName, maxItems);
  }
}

// ── Background Sync: cola de datos offline ──────────────────────────────────
// El frontend guarda pendientes en IndexedDB bajo 'therapheye-sync-queue'
// Cuando vuelve la conexión, el SW procesa la cola

self.addEventListener('sync', event => {
  if (event.tag === 'therapheye-sync') {
    event.waitUntil(processSyncQueue());
  }
});

async function processSyncQueue() {
  try {
    const db = await openSyncDB();
    const tx = db.transaction('queue', 'readwrite');
    const store = tx.objectStore('queue');
    const items = await getAllFromStore(store);

    for (const item of items) {
      try {
        await fetch(item.url, {
          method: item.method || 'POST',
          headers: item.headers || { 'Content-Type': 'application/json' },
          body: item.body,
        });
        // Éxito: eliminar de la cola
        const deleteTx = db.transaction('queue', 'readwrite');
        deleteTx.objectStore('queue').delete(item.id);
      } catch {
        // Fallo: dejar en la cola para el próximo sync
        break;
      }
    }
  } catch (e) {
    console.error('[SW] Sync queue error:', e);
  }
}

function openSyncDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('therapheye-sync', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllFromStore(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Push handler ──────────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;

  let data;
  try { data = event.data.json(); }
  catch { data = { title: APP_NAME, body: event.data.text() }; }

  const options = {
    body: data.body || '',
    icon: data.icon || DEFAULT_ICON,
    badge: DEFAULT_ICON,
    tag: data.tag || 'therapheye-notif',
    renotify: true,
    requireInteraction: false,
    data: { url: data.url || '/' },
    actions: data.actions || [],
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || APP_NAME, options)
  );
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        for (const client of windowClients) {
          if ('focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      })
  );
});
