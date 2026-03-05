import { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowLeft, HeartPulse, Play, Pause, RotateCcw, Clock, AlarmClock, StopCircle, Calendar } from 'lucide-react';
import { Eye } from 'lucide-react';

type Props = {
  onBack: () => void;
};

// ─── Configura aquí los intervalos ───────────────────────────────────────────
// Modifica estos valores directamente en el código y se aplicarán automáticamente.
const WORK_MINUTES = 1; // minutos de trabajo antes de cada descanso
const BREAK_MINUTES = 1; // minutos de descanso recomendados
// ─────────────────────────────────────────────────────────────────────────────

type PersistedTimerState = {
  isRunning: boolean;
  startTimestamp: number | null;        // ms UNIX del inicio de la tanda actual
  accumulatedMs: number;                // ms acumulados antes de la tanda actual
  nextBreakAtMs: number | null;         // umbral en ms para el próximo descanso
  sessionStartTimestamp: number | null; // ms UNIX del inicio de la sesión completa
};

type SessionRecord = {
  id: string;
  startedAt: string;   // Fecha/hora formateada de inicio
  endedAt: string;     // Fecha/hora formateada de fin
  durationMs: number;  // Duración total en ms
};

const STORAGE_KEY          = 'therapeye_visual_health_timer';
const SESSIONS_STORAGE_KEY = 'therapeye_visual_health_sessions';

// ─── Utilidades ───────────────────────────────────────────────────────────────

const speakText = (text: string) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-MX';
  utterance.rate = 1.2;
  window.speechSynthesis.speak(utterance);
};

const playBeep = () => {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.55);
  } catch {
    // Sin AudioContext disponible
  }
};

const formatDuration = (totalSeconds: number) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

const formatSessionDuration = (ms: number) => {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours        = Math.floor(totalMinutes / 60);
  const minutes      = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
};

const formatDateTime = (ts: number) =>
  new Date(ts).toLocaleString('es-MX', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: false,
  });

const loadSessions = (): SessionRecord[] => {
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveSessions = (sessions: SessionRecord[]) => {
  try {
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // ignorar
  }
};

// ─── Componente principal ─────────────────────────────────────────────────────

const VisualHealth = ({ onBack }: Props) => {
  const [isRunning, setIsRunning]                   = useState(false);
  const [elapsedSeconds, setElapsedSeconds]         = useState(0);
  const [nextBreakInMinutes, setNextBreakInMinutes] = useState<number | null>(null);
  const [sessions, setSessions]                     = useState<SessionRecord[]>([]);

  const stateRef = useRef<PersistedTimerState>({
    isRunning: false,
    startTimestamp: null,
    accumulatedMs: 0,
    nextBreakAtMs: null,
    sessionStartTimestamp: null,
  });

  const saveState = useCallback((state: PersistedTimerState) => {
    stateRef.current = state;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignorar
    }
  }, []);

  // Cargar estado y sesiones al montar
  useEffect(() => {
    setSessions(loadSessions());
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: PersistedTimerState = JSON.parse(raw);
        const now = Date.now();
        let elapsedMs = parsed.accumulatedMs;
        if (parsed.isRunning && parsed.startTimestamp) {
          elapsedMs += now - parsed.startTimestamp;
        }
        setElapsedSeconds(Math.floor(elapsedMs / 1000));
        setIsRunning(parsed.isRunning);
        if (parsed.nextBreakAtMs != null) {
          const remainingMs = parsed.nextBreakAtMs - elapsedMs;
          setNextBreakInMinutes(remainingMs > 0 ? Math.round(remainingMs / 60000) : 0);
        }
        stateRef.current = parsed;
      } else {
        saveState(stateRef.current);
      }
    } catch {
      saveState(stateRef.current);
    }
  }, [saveState]);

  // Intervalo para actualizar tiempo y disparar descansos
  useEffect(() => {
    const interval = setInterval(() => {
      const now     = Date.now();
      const current = stateRef.current;

      let elapsedMs = current.accumulatedMs;
      if (current.isRunning && current.startTimestamp) {
        elapsedMs += now - current.startTimestamp;
      }
      setElapsedSeconds(Math.floor(elapsedMs / 1000));

      if (current.isRunning) {
        if (current.nextBreakAtMs == null) {
          const nextBreakAtMs = WORK_MINUTES * 60_000;
          saveState({ ...current, nextBreakAtMs });
          const remainingMs = nextBreakAtMs - elapsedMs;
          setNextBreakInMinutes(remainingMs > 0 ? Math.round(remainingMs / 60000) : 0);
          return;
        }
        if (elapsedMs >= current.nextBreakAtMs) {
          playBeep();
          speakText('Es momento de tomar un descanso visual');
          const nextBreakAtMs = current.nextBreakAtMs + WORK_MINUTES * 60_000;
          saveState({ ...current, nextBreakAtMs });
          const remainingMs = nextBreakAtMs - elapsedMs;
          setNextBreakInMinutes(remainingMs > 0 ? Math.round(remainingMs / 60000) : 0);
        } else {
          const remainingMs = current.nextBreakAtMs - elapsedMs;
          setNextBreakInMinutes(remainingMs > 0 ? Math.round(remainingMs / 60000) : 0);
        }
      } else {
        setNextBreakInMinutes(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [saveState]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleStartWithCountdown = () => {
    const current = stateRef.current;
    if (current.isRunning) return;

    let count = 3;
    const tick = () => {
      if (count > 0) {
        speakText(`${count}`);
        count -= 1;
        setTimeout(tick, 1000);
      } else {
        const now = Date.now();
        const updated: PersistedTimerState = {
          ...stateRef.current,
          isRunning: true,
          startTimestamp: now,
          sessionStartTimestamp: stateRef.current.sessionStartTimestamp ?? now,
        };
        saveState(updated);
        setIsRunning(true);
      }
    };
    speakText('El conteo comienza en');
    setTimeout(tick, 700);
  };

  const handlePause = () => {
    const current = stateRef.current;
    if (!current.isRunning) return;
    const now = Date.now();
    let elapsedMs = current.accumulatedMs;
    if (current.startTimestamp) elapsedMs += now - current.startTimestamp;
    saveState({
      ...current,
      isRunning: false,
      startTimestamp: null,
      accumulatedMs: elapsedMs,
    });
    setIsRunning(false);
  };

  const handleReset = () => {
    saveState({
      isRunning: false,
      startTimestamp: null,
      accumulatedMs: 0,
      nextBreakAtMs: null,
      sessionStartTimestamp: null,
    });
    setIsRunning(false);
    setElapsedSeconds(0);
    setNextBreakInMinutes(null);
  };

  const handleTerminate = () => {
    const current = stateRef.current;
    const now     = Date.now();

    let elapsedMs = current.accumulatedMs;
    if (current.isRunning && current.startTimestamp) {
      elapsedMs += now - current.startTimestamp;
    }

    if (elapsedMs > 0) {
      const sessionStart = current.sessionStartTimestamp ?? (now - elapsedMs);
      const record: SessionRecord = {
        id:         String(now),
        startedAt:  formatDateTime(sessionStart),
        endedAt:    formatDateTime(now),
        durationMs: elapsedMs,
      };
      const updated = [record, ...loadSessions()];
      saveSessions(updated);
      setSessions(updated);
    }

    saveState({
      isRunning: false,
      startTimestamp: null,
      accumulatedMs: 0,
      nextBreakAtMs: null,
      sessionStartTimestamp: null,
    });
    setIsRunning(false);
    setElapsedSeconds(0);
    setNextBreakInMinutes(null);
  };

  const totalHours = elapsedSeconds / 3600;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Eye className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Therapeye</h1>
          </div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Volver al dashboard</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-8">

        {/* ── Tarjeta principal del cronómetro ── */}
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center">
                <HeartPulse className="w-7 h-7 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Salud Visual</h2>
                <p className="text-gray-500 text-sm">Gestiona tu tiempo en pantalla y programa descansos visuales.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              <span>
                Tiempo frente a pantalla hoy:{' '}
                <span className="font-semibold text-gray-800">{totalHours.toFixed(1)} h</span>
              </span>
            </div>
          </div>

          {/* Cronómetro + info */}
          <div className="flex flex-col md:flex-row gap-8">

            {/* Reloj y botones */}
            <div className="flex-1 flex flex-col items-center">
              <div className="w-48 h-48 rounded-full bg-gray-900 text-white flex flex-col items-center justify-center shadow-inner mb-4">
                <span className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-1">Tiempo activo</span>
                <span className="text-3xl md:text-4xl font-mono font-bold">
                  {formatDuration(elapsedSeconds)}
                </span>
              </div>

              {/* Botones de control */}
              <div className="flex items-center gap-3 mb-3 flex-wrap justify-center">
                {isRunning ? (
                  <button
                    onClick={handlePause}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-600 text-white font-semibold hover:bg-red-700 transition shadow"
                  >
                    <Pause className="w-5 h-5" />
                    Pausar
                  </button>
                ) : (
                  <button
                    onClick={handleStartWithCountdown}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-green-600 text-white font-semibold hover:bg-green-700 transition shadow"
                  >
                    <Play className="w-5 h-5" />
                    Iniciar
                  </button>
                )}

                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition"
                >
                  <RotateCcw className="w-5 h-5" />
                  Reiniciar
                </button>

                <button
                  onClick={handleTerminate}
                  disabled={elapsedSeconds === 0}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition shadow disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <StopCircle className="w-5 h-5" />
                  Terminar
                </button>
              </div>

              {nextBreakInMinutes != null && isRunning && (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                  <AlarmClock className="w-3 h-3" />
                  <span>
                    Próximo descanso sugerido en{' '}
                    <span className="font-semibold">
                      {nextBreakInMinutes <= 1 ? 'menos de 1 min' : `${nextBreakInMinutes} min`}
                    </span>
                  </span>
                </div>
              )}
            </div>

            {/* Info de descansos */}
            <div className="flex-1 space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <AlarmClock className="w-5 h-5 text-indigo-500" />
                Recordatorios de descanso
              </h3>
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-900 space-y-2">
                <p className="font-semibold">Descanso visual activo</p>
                <p>
                  Por cada <span className="font-bold">{WORK_MINUTES} minutos</span> de trabajo frente a la pantalla,
                  el sistema te recordará tomar un descanso visual de{' '}
                  <span className="font-bold">{BREAK_MINUTES} minutos</span>.
                </p>
                <p className="text-xs text-indigo-700 mt-1">
                  El cronómetro sigue contando tu tiempo activo aunque navegues por otros módulos. Al volver
                  a Salud Visual verás el tiempo actualizado y el próximo descanso sugerido.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Historial de sesiones ── */}
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Historial de sesiones</h2>
            <p className="text-sm text-gray-400 mt-1">Registro de tiempo frente a pantalla por sesión</p>
          </div>

          {sessions.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-400">Aún no hay sesiones registradas.</p>
              <p className="text-xs text-gray-300 mt-1">
                Inicia el cronómetro y pulsa <span className="font-semibold">Terminar</span> para guardar una sesión.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session, index) => {
                const totalMin = Math.floor(session.durationMs / 60_000);
                const hours    = Math.floor(totalMin / 60);
                const minutes  = totalMin % 60;

                return (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-4 rounded-lg border-l-4 bg-indigo-50 border-indigo-400 hover:bg-indigo-100 transition"
                  >
                    {/* Número + info */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">
                          Sesión {sessions.length - index}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Iniciada: {session.startedAt}
                        </p>
                        <p className="text-xs text-gray-400">
                          Finalizada: {session.endedAt}
                        </p>
                      </div>
                    </div>

                    {/* Duración */}
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-200 text-indigo-800">
                        {hours > 0
                          ? `${hours} h${minutes > 0 ? ` ${minutes} min` : ''}`
                          : `${minutes} min`}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatSessionDuration(session.durationMs)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </main>
    </div>
  );
};

export default VisualHealth;
