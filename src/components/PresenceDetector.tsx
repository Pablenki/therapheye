// =========================================
// PRESENCE DETECTOR — Therapheye
// Detecta si el usuario sigue en la pantalla
// usando visibilitychange + actividad + cámara opcional
// Lanza alertas si lleva mucho tiempo sin pausa
// =========================================

import { useEffect, useRef, useState, useCallback } from 'react';
import { AlertCircle, X } from 'lucide-react';

const INACTIVITY_ALERT_MS  = 45 * 60 * 1000; // 45 min sin ejercicio → alerta suave
const IDLE_TIMEOUT_MS      = 5  * 60 * 1000; // 5 min sin actividad → user inactive
const PRESENCE_KEY         = 'therapheye_last_exercise';
// Timestamp de cuando esta sesión/pestaña inició — no alertar antes de que pasen
// los 45 min desde que se abrió la app (evita falsos positivos al re-abrir)
const SESSION_START        = Date.now();

interface Alert {
  id: string;
  msg: string;
  type: 'warning' | 'info';
}

export default function PresenceDetector() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const lastActivityRef    = useRef<number>(Date.now());
  const lastExerciseRef    = useRef<number>((() => {
    try { return Number(localStorage.getItem(PRESENCE_KEY) ?? 0); } catch { return 0; }
  })());
  const isActiveRef        = useRef(true);
  const intervalRef        = useRef<ReturnType<typeof setInterval> | null>(null);

  const addAlert = useCallback((id: string, msg: string, type: Alert['type'] = 'warning') => {
    setAlerts(prev => {
      if (prev.find(a => a.id === id)) return prev; // no duplicar
      return [...prev, { id, msg, type }];
    });
    // Auto-dismiss después de 12 segundos
    setTimeout(() => dismissAlert(id), 12_000);
  }, []);

  const dismissAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  // Registrar actividad del mouse/teclado
  const onActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (!isActiveRef.current) isActiveRef.current = true;
  }, []);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    return () => events.forEach(e => window.removeEventListener(e, onActivity));
  }, [onActivity]);

  // visibilitychange — pausar/reanudar
  useEffect(() => {
    const handler = () => {
      isActiveRef.current = document.visibilityState === 'visible';
      if (isActiveRef.current) lastActivityRef.current = Date.now();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // Actualizar timestamp del último ejercicio desde localStorage
  useEffect(() => {
    const sync = () => {
      try {
        const v = Number(localStorage.getItem(PRESENCE_KEY) ?? 0);
        lastExerciseRef.current = v;
      } catch {}
    };
    window.addEventListener('therapheye-exercise-done', sync);
    return () => window.removeEventListener('therapheye-exercise-done', sync);
  }, []);

  // Checker periódico cada 5 minutos
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (!isActiveRef.current) return;
      if (document.visibilityState !== 'visible') return;

      const now = Date.now();
      const idleMs = now - lastActivityRef.current;

      // Usar como referencia el máximo entre el último ejercicio y el inicio de
      // la sesión actual — así evitamos alertas inmediatas al abrir la app
      const baselineTs = Math.max(lastExerciseRef.current || 0, SESSION_START);
      const sinEjercicioMs = now - baselineTs;

      // Usuario idle → no molestar
      if (idleMs > IDLE_TIMEOUT_MS) return;

      // Lleva 45+ min activo sin ejercicio
      if (sinEjercicioMs > INACTIVITY_ALERT_MS) {
        const hrs = Math.floor(sinEjercicioMs / 3600000);
        const min = Math.floor((sinEjercicioMs % 3600000) / 60000);
        const label = hrs > 0 ? `${hrs}h ${min}min` : `${min} min`;
        addAlert(
          'no-exercise',
          `Llevas ${label} sin hacer ejercicios oculares. Tus ojos lo agradecerán 👁`,
          'warning'
        );
      }

      // Son las 8pm+ y no ha hecho ejercicio hoy
      const hour = new Date().getHours();
      if (hour >= 20 && sinEjercicioMs > 3 * 60 * 60 * 1000) {
        addAlert(
          'evening-reminder',
          'Son las 8pm — todavía puedes hacer un ejercicio rápido antes de terminar el día 🌙',
          'info'
        );
      }
    }, 5 * 60 * 1000);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [addAlert]);

  if (alerts.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-4 z-[8000] space-y-2 max-w-xs w-full pointer-events-none">
      {alerts.map(alert => (
        <div
          key={alert.id}
          className={`
            pointer-events-auto flex items-start gap-3 rounded-2xl px-4 py-3 shadow-lg border
            animate-[slideInRight_0.3s_ease]
            ${alert.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'}
          `}
        >
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p className="text-xs leading-relaxed flex-1">{alert.msg}</p>
          <button
            onClick={() => dismissAlert(alert.id)}
            className="text-current opacity-50 hover:opacity-100 transition flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Llamar al completar un ejercicio para resetear el contador */
export function markExerciseDone() {
  try {
    localStorage.setItem(PRESENCE_KEY, String(Date.now()));
    window.dispatchEvent(new Event('therapheye-exercise-done'));
  } catch {}
}
