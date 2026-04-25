// =========================================
// HOOK — usePushNotifications
// Maneja suscripción / desuscripción a Web Push
// =========================================

import { useState, useEffect, useCallback } from 'react';

export interface NotifPrefs {
  exercises: boolean;
  questionnaire: boolean;
  streak: boolean;
}

const PREFS_KEY = 'therapheye_push_prefs';
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(b64);
  const arr = new Uint8Array([...raw].map(c => c.charCodeAt(0)));
  return arr.buffer as ArrayBuffer;
}

export function usePushNotifications(userId: string | undefined) {
  const [supported,   setSupported]   = useState(false);
  const [permission,  setPermission]  = useState<NotificationPermission>('default');
  const [subscribed,  setSubscribed]  = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [swReady,     setSwReady]     = useState(false);
  const [prefs, setPrefs] = useState<NotifPrefs>(() => {
    try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); }
    catch { return { exercises: true, questionnaire: true, streak: true }; }
  });

  // ── Detectar soporte y estado inicial ────────────────────────────────────
  useEffect(() => {
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setSupported(ok);
    if (!ok) return;

    setPermission(Notification.permission);

    // Registrar SW si no está registrado
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => {
        setSwReady(true);
        return reg.pushManager.getSubscription();
      })
      .then(sub => setSubscribed(!!sub))
      .catch(console.error);
  }, []);

  // ── Suscribirse ───────────────────────────────────────────────────────────
  const subscribe = useCallback(async (newPrefs?: NotifPrefs): Promise<boolean> => {
    if (!supported || !userId || !swReady) return false;
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return false;

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const p = newPrefs ?? prefs;
      const res = await fetch('/.netlify/functions/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), userId, preferences: p }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      localStorage.setItem(PREFS_KEY, JSON.stringify(p));
      setPrefs(p);
      setSubscribed(true);
      return true;
    } catch (e) {
      console.error('Push subscribe error:', e);
      return false;
    } finally {
      setLoading(false);
    }
  }, [supported, userId, swReady, prefs]);

  // ── Desuscribirse ─────────────────────────────────────────────────────────
  const unsubscribe = useCallback(async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/.netlify/functions/push-unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (e) {
      console.error('Push unsubscribe error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Actualizar preferencias ───────────────────────────────────────────────
  const updatePrefs = useCallback(async (newPrefs: NotifPrefs) => {
    setPrefs(newPrefs);
    localStorage.setItem(PREFS_KEY, JSON.stringify(newPrefs));
    if (subscribed && userId) {
      await subscribe(newPrefs);
    }
  }, [subscribed, userId, subscribe]);

  return { supported, permission, subscribed, loading, prefs, subscribe, unsubscribe, updatePrefs };
}
