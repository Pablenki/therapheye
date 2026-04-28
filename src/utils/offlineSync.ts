// =========================================
// OFFLINE SYNC QUEUE — Therapheye
// Encola requests cuando no hay conexión
// El SW los procesa cuando vuelve internet
// =========================================

interface QueueItem {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

function openSyncDB(): Promise<IDBDatabase> {
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

export async function enqueueOffline(item: QueueItem): Promise<void> {
  try {
    const db = await openSyncDB();
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').add(item);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Registrar sync si Background Sync está disponible
    if ('serviceWorker' in navigator && 'sync' in (navigator.serviceWorker as any)) {
      const reg = await navigator.serviceWorker.ready;
      await (reg as any).sync.register('therapheye-sync');
    }
  } catch (e) {
    console.error('[OfflineSync] Error queueing:', e);
  }
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export async function fetchWithOfflineFallback(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  if (isOnline()) {
    try {
      return await fetch(url, options);
    } catch {
      // Network error despite navigator.onLine = true
    }
  }

  // Offline: encolar para sync posterior
  await enqueueOffline({
    url,
    method: options.method || 'POST',
    headers: options.headers as Record<string, string>,
    body: options.body as string,
  });

  // Retornar una respuesta fake para que el frontend no crashee
  return new Response(JSON.stringify({ queued: true }), {
    status: 202,
    headers: { 'Content-Type': 'application/json' },
  });
}
