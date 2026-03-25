import { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, Monitor, AlarmClock, X } from 'lucide-react';
import { useLanguage } from '../i18n';
import { useUser } from '../context/UserContext';
import { sql } from '../neonCliente';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Page =
  | 'login'
  | 'register'
  | 'verify-email'
  | 'dashboard'
  | 'questionnaire'
  | 'exercises'
  | 'exercise-session'
  | 'history'
  | 'image-capture'
  | 'vision-test'
  | 'visual-health';

type Props = {
  currentPage: Page;
  onNavigate: (page: Page) => void;
};

type PersistedTimerState = {
  isRunning: boolean;
  startTimestamp: number | null;
  accumulatedMs: number;
  nextBreakAtMs: number | null;
  sessionStartTimestamp: number | null;
  /** true = user explicitly clicked "Finalizar" today; timer should NOT auto-start */
  finalized: boolean;
  /** YYYY-MM-DD of the day this state belongs to — used to detect day change */
  stateDate: string | null;
};

// ─── Constantes (deben coincidir con VisualHealth.tsx) ────────────────────────

const STORAGE_KEY    = 'therapeye_visual_health_timer';
const WORK_MINUTES   = 20;
const MAX_SESSION_MS = 16 * 60 * 60 * 1000;

// ─── Preferencias del timer ───────────────────────────────────────────────────

const PREFS_KEY = 'therapeye_timer_prefs';

type TimerPrefs = {
  /** El usuario activó "preguntarme al iniciar sesión" */
  notifyOnLogin: boolean;
  /** El usuario ya completó el onboarding de Visual Health */
  onboardingCompleted: boolean;
};

const DEFAULT_PREFS: TimerPrefs = { notifyOnLogin: false, onboardingCompleted: false };

export const loadTimerPrefs = (): TimerPrefs => {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch { return { ...DEFAULT_PREFS }; }
};

export const saveTimerPrefs = (prefs: TimerPrefs, userId?: string) => {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); }
  catch { /* noop */ }
  // Sincronizar a BD si tenemos userId
  if (userId) {
    sql`
      INSERT INTO user_preferences (user_id, notify_on_login, onboarding_completed, updated_at)
      VALUES (${userId}, ${prefs.notifyOnLogin}, ${prefs.onboardingCompleted}, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        notify_on_login = ${prefs.notifyOnLogin},
        onboarding_completed = ${prefs.onboardingCompleted},
        updated_at = NOW()
    `.catch(err => console.warn('[TimerPrefs] Error syncing prefs to DB:', err));
  }
};

// Páginas donde el widget NO se muestra visualmente
const HIDDEN_PAGES: Page[] = ['login', 'register', 'verify-email', 'visual-health'];
// Páginas de auth donde el timer SÍ se pausa/resetea (no incluye visual-health)
const AUTH_ONLY_PAGES: Page[] = ['login', 'register', 'verify-email'];

const todayLocalDate = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const DEFAULT_STATE: PersistedTimerState = {
  isRunning: false,
  startTimestamp: null,
  accumulatedMs: 0,
  nextBreakAtMs: null,
  sessionStartTimestamp: null,
  finalized: false,
  stateDate: todayLocalDate(),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const loadState = (): PersistedTimerState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE, stateDate: todayLocalDate() };
    const parsed = JSON.parse(raw) as PersistedTimerState;
    // Migrate: add missing fields for backward compatibility
    if (parsed.finalized === undefined) parsed.finalized = false;
    if (!parsed.stateDate) parsed.stateDate = todayLocalDate();
    // Day change detection: if stateDate != today, reset accumulated time for the new day
    if (parsed.stateDate !== todayLocalDate()) {
      return {
        ...DEFAULT_STATE,
        stateDate: todayLocalDate(),
        // New day → not finalized, fresh accumulated
      };
    }
    return parsed;
  } catch { return { ...DEFAULT_STATE, stateDate: todayLocalDate() }; }
};

const persistState = (state: PersistedTimerState) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { /* noop */ }
};

const calcElapsedMs = (state: PersistedTimerState): number => {
  const now = Date.now();
  let ms = state.accumulatedMs;
  if (state.isRunning && state.startTimestamp) {
    const delta = now - state.startTimestamp;
    if (delta > 0 && delta < MAX_SESSION_MS) ms += delta;
  }
  return Math.max(0, Math.min(ms, MAX_SESSION_MS));
};

const formatDuration = (totalSeconds: number): string => {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

const speakText = (text: string, lang: 'es' | 'en' = 'es') => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === 'en' ? 'en-US' : 'es-MX';
  u.rate = 1.2;
  window.speechSynthesis.speak(u);
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
  } catch { /* noop */ }
};

// ─── DB sync helpers ─────────────────────────────────────────────────────────
const DB_SYNC_INTERVAL_MS = 30_000;

const loadTimerFromDB = async (userId: string): Promise<PersistedTimerState | null> => {
  try {
    const rows = await sql`
      SELECT accumulated_ms, is_running, last_start_ts, session_start_ts, next_break_at_ms, finalized
      FROM timer_state
      WHERE user_id = ${userId} AND fecha = ${todayLocalDate()}
      LIMIT 1
    `;
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      accumulatedMs: Number(r.accumulated_ms) || 0,
      isRunning: Boolean(r.is_running),
      startTimestamp: r.last_start_ts ? Number(r.last_start_ts) : null,
      sessionStartTimestamp: r.session_start_ts ? Number(r.session_start_ts) : null,
      nextBreakAtMs: r.next_break_at_ms ? Number(r.next_break_at_ms) : null,
      finalized: r.finalized !== undefined ? Boolean(r.finalized) : false,
      stateDate: todayLocalDate(),
    };
  } catch (err) {
    console.warn('[TimerWidget] Error cargando timer de BD:', err);
    return null;
  }
};

const saveTimerToDB = async (userId: string, state: PersistedTimerState) => {
  try {
    const fecha = todayLocalDate();
    await sql`
      INSERT INTO timer_state (user_id, fecha, accumulated_ms, is_running, last_start_ts, session_start_ts, next_break_at_ms, finalized, updated_at)
      VALUES (${userId}, ${fecha}, ${state.accumulatedMs}, ${state.isRunning}, ${state.startTimestamp}, ${state.sessionStartTimestamp}, ${state.nextBreakAtMs}, ${state.finalized}, NOW())
      ON CONFLICT (user_id, fecha)
      DO UPDATE SET
        accumulated_ms   = ${state.accumulatedMs},
        is_running       = ${state.isRunning},
        last_start_ts    = ${state.startTimestamp},
        session_start_ts = ${state.sessionStartTimestamp},
        next_break_at_ms = ${state.nextBreakAtMs},
        finalized        = ${state.finalized},
        updated_at       = NOW()
    `;
  } catch (err) {
    console.warn('[TimerWidget] Error guardando timer en BD:', err);
  }
};

// ─── Componente ───────────────────────────────────────────────────────────────

const GlobalTimerWidget = ({ currentPage, onNavigate }: Props) => {
  const [elapsedSeconds, setElapsedSeconds]         = useState(0);
  const [isRunning, setIsRunning]                   = useState(false);
  const [nextBreakInMinutes, setNextBreakInMinutes] = useState<number | null>(null);
  const [dismissed, setDismissed]                   = useState(false);
  const [breakAlert, setBreakAlert]                 = useState(false);
  /** Modal "¿Deseas iniciar tu temporizador de hoy?" */
  const [showStartPrompt, setShowStartPrompt]       = useState(false);
  const { t, lang } = useLanguage();
  const { user }    = useUser();

  const prevPageRef    = useRef<Page | null>(null);
  const lastDbSyncRef  = useRef<number>(0);
  const dbLoadedRef    = useRef<boolean>(false);
  const loginHandledRef = useRef<boolean>(false);

  // isAuthPage: solo para lógica de pausa/reset — visual-health NO cuenta como auth
  const isAuthPage = AUTH_ONLY_PAGES.includes(currentPage);

  // ── Guardar en BD (debounced — no más de 1 vez cada 30s) ─────────────────
  const syncToDB = useCallback((state: PersistedTimerState) => {
    if (!user?.id) return;
    const now = Date.now();
    if (now - lastDbSyncRef.current < DB_SYNC_INTERVAL_MS) return;
    lastDbSyncRef.current = now;
    saveTimerToDB(user.id, state);
  }, [user?.id]);

  // ── Inicializar: cargar desde BD primero, luego localStorage como fallback ──
  useEffect(() => {
    if (isAuthPage) {
      setElapsedSeconds(0);
      setIsRunning(false);
      setNextBreakInMinutes(null);
      dbLoadedRef.current = false;
      loginHandledRef.current = false;
      return;
    }

    // Si acabamos de venir de login → NO cargar isRunning de localStorage.
    // handleLoginTimer (en el otro effect) se encargará de pausar y preguntar.
    const cameFromAuth = !loginHandledRef.current;

    // Cargar localStorage inmediatamente (solo para mostrar el tiempo, no para arrancar)
    const localSt = loadState();
    const localMs = calcElapsedMs(localSt);
    setElapsedSeconds(Math.floor(localMs / 1000));
    // Solo propagar isRunning si NO venimos del login — si venimos del login,
    // handleLoginTimer pausará explícitamente.
    if (!cameFromAuth) {
      setIsRunning(localSt.isRunning);
    } else {
      setIsRunning(false);
    }

    // Luego intentar cargar de BD (para sync cross-browser)
    if (user?.id && !dbLoadedRef.current) {
      dbLoadedRef.current = true;
      loadTimerFromDB(user.id).then(dbState => {
        if (!dbState) return;
        const dbMs     = calcElapsedMs(dbState);
        const localMs2 = calcElapsedMs(loadState());
        if (dbMs > localMs2) {
          persistState(dbState);
          setElapsedSeconds(Math.floor(dbMs / 1000));
          // Mismo principio: no arrancar si venimos del login
          if (!cameFromAuth) {
            setIsRunning(dbState.isRunning);
          }
          if (dbState.isRunning && dbState.nextBreakAtMs != null && !cameFromAuth) {
            const rem = dbState.nextBreakAtMs - dbMs;
            setNextBreakInMinutes(rem > 0 ? Math.round(rem / 60000) : 0);
          }
        }
      });
    }
  }, [isAuthPage, user?.id]);

  // ── Auto-start ONLY on login from auth page AND only if NOT finalized ─────
  useEffect(() => {
    const prev = prevPageRef.current;
    prevPageRef.current = currentPage;

    // Logout → SIEMPRE sincronizar localStorage → BD (captura pause/finalize de VisualHealth)
    if (AUTH_ONLY_PAGES.includes(currentPage) && prev && !AUTH_ONLY_PAGES.includes(prev)) {
      const st = loadState();
      if (st.isRunning) {
        // Timer activo → pausar y guardar
        const ms = calcElapsedMs(st);
        const paused: PersistedTimerState = {
          ...st,
          isRunning: false,
          startTimestamp: null,
          accumulatedMs: ms,
        };
        persistState(paused);
        if (user?.id) { lastDbSyncRef.current = 0; saveTimerToDB(user.id, paused); }
        setIsRunning(false);
        setNextBreakInMinutes(null);
      } else {
        // Timer ya pausado/finalizado → sincronizar estado actual a BD de todas formas
        // (cubre el caso de pause/finalize desde VisualHealth que solo escribió a localStorage)
        if (user?.id) { lastDbSyncRef.current = 0; saveTimerToDB(user.id, st); }
      }
      dbLoadedRef.current = false;
      loginHandledRef.current = false;
      return;
    }

    // Login → comportamiento según preferencia del usuario
    const fromAuth = prev === 'login' || prev === 'register' || prev === 'verify-email';
    if (currentPage === 'dashboard' && fromAuth && !loginHandledRef.current) {
      loginHandledRef.current = true;

      const handleLoginTimer = (baseState: PersistedTimerState) => {
        // ═══ SIEMPRE pausar al llegar del login ═══
        // Usar accumulatedMs directamente — NO calcElapsedMs(), porque si la BD tiene
        // un startTimestamp viejo (pause/finalize no sincronizó) sumaría tiempo fantasma.
        const accMs = baseState.accumulatedMs;
        const paused: PersistedTimerState = {
          ...baseState,
          isRunning: false,
          startTimestamp: null,
          accumulatedMs: accMs,
        };
        persistState(paused);
        setIsRunning(false);
        setElapsedSeconds(Math.floor(accMs / 1000));
        if (user?.id) { lastDbSyncRef.current = 0; saveTimerToDB(user.id, paused); }

        // Si ya finalizó hoy → no preguntar nada
        if (baseState.finalized) return;

        // Si activó "notificar al iniciar sesión" → mostrar prompt
        const prefs = loadTimerPrefs();
        if (prefs.notifyOnLogin) {
          setShowStartPrompt(true);
        }
        // Si NO activó → no preguntar, no arrancar. El usuario lo inicia manualmente.
      };

      // Cargar desde BD para sincronización cross-browser.
      // Preferir localStorage (siempre más actualizado) salvo que BD tenga
      // estrictamente MÁS tiempo acumulado (otro navegador avanzó más).
      if (user?.id) {
        loadTimerFromDB(user.id).then(dbState => {
          const localSt = loadState();
          const dbAccMs    = dbState ? dbState.accumulatedMs : 0;
          const localAccMs = localSt.accumulatedMs;

          if (dbState && dbAccMs > localAccMs) {
            persistState(dbState);
            handleLoginTimer(dbState);
          } else {
            handleLoginTimer(localSt);
          }
        }).catch(() => {
          handleLoginTimer(loadState());
        });
      } else {
        handleLoginTimer(loadState());
      }
    }
    // NOTE: No auto-start on any other page navigation! Only on login transition.
  }, [currentPage, user?.id]);

  // ── Re-mostrar widget al cambiar de página (reset dismissed) ──────────────
  useEffect(() => {
    setDismissed(false);
  }, [currentPage]);

  // ── Tick cada segundo (solo en páginas autenticadas) ──────────────────────
  useEffect(() => {
    if (isAuthPage) return;

    let lastFiredBreakAtMs: number | null = null;

    const interval = setInterval(() => {
      const st  = loadState();
      const ms  = calcElapsedMs(st);
      setElapsedSeconds(Math.floor(ms / 1000));
      setIsRunning(st.isRunning);

      // Sync periódico a BD
      if (st.isRunning) {
        const snapshotState: PersistedTimerState = {
          ...st,
          accumulatedMs: ms,
          startTimestamp: Date.now(),
        };
        syncToDB(snapshotState);
      }

      if (!st.isRunning) {
        setNextBreakInMinutes(null);
        return;
      }

      // Si VisualHealth está montado → él maneja las alertas
      if (currentPage === 'visual-health') {
        if (st.nextBreakAtMs != null) {
          const rem = st.nextBreakAtMs - ms;
          setNextBreakInMinutes(rem > 0 ? Math.max(0, Math.round(rem / 60000)) : 0);
        }
        return;
      }

      // Widget maneja las alertas
      if (st.nextBreakAtMs === null) {
        const nb = WORK_MINUTES * 60_000;
        persistState({ ...st, nextBreakAtMs: nb });
        setNextBreakInMinutes(Math.round((nb - ms) / 60000));
        return;
      }

      if (ms >= st.nextBreakAtMs) {
        if (st.nextBreakAtMs !== lastFiredBreakAtMs) {
          lastFiredBreakAtMs = st.nextBreakAtMs;
          playBeep();
          speakText(t('visualHealth', 'breakRule'), lang);
          setBreakAlert(true);
        }
        const nb = st.nextBreakAtMs + WORK_MINUTES * 60_000;
        persistState({ ...st, nextBreakAtMs: nb });
        setNextBreakInMinutes(Math.max(0, Math.round((nb - ms) / 60000)));
      } else {
        const rem = st.nextBreakAtMs - ms;
        setNextBreakInMinutes(rem > 0 ? Math.max(0, Math.round(rem / 60000)) : 0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentPage, isAuthPage, syncToDB]);

  // ── Handler del prompt de inicio al login ─────────────────────────────────

  const handlePromptStart = () => {
    setShowStartPrompt(false);
    const st = loadState();
    const now = Date.now();
    const baseMs = st.accumulatedMs;
    const started: PersistedTimerState = {
      ...st,
      isRunning: true,
      startTimestamp: now,
      accumulatedMs: baseMs,
      sessionStartTimestamp: st.sessionStartTimestamp ?? now,
      nextBreakAtMs: baseMs + WORK_MINUTES * 60_000,
      finalized: false,
      stateDate: todayLocalDate(),
    };
    persistState(started);
    setIsRunning(true);
    setElapsedSeconds(Math.floor(baseMs / 1000));
    if (user?.id) { lastDbSyncRef.current = 0; saveTimerToDB(user.id, started); }
  };

  const handlePromptSkip = () => {
    setShowStartPrompt(false);
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const st = loadState();
    if (st.isRunning) {
      // PAUSE (not finalize — just pause, keep accumulated time, keep finalized=false)
      const ms = calcElapsedMs(st);
      const paused: PersistedTimerState = {
        ...st,
        isRunning: false,
        startTimestamp: null,
        accumulatedMs: ms,
      };
      persistState(paused);
      setIsRunning(false);
      setNextBreakInMinutes(null);
      if (user?.id) { lastDbSyncRef.current = 0; saveTimerToDB(user.id, paused); }
    } else {
      // START (resume from accumulated time — even if finalized, user explicitly clicked "Iniciar")
      const now = Date.now();
      const started: PersistedTimerState = {
        ...st,
        isRunning: true,
        startTimestamp: now,
        sessionStartTimestamp: st.sessionStartTimestamp ?? now,
        finalized: false, // User is explicitly starting → clear finalized flag
        stateDate: todayLocalDate(),
      };
      persistState(started);
      setIsRunning(true);
      if (user?.id) { lastDbSyncRef.current = 0; saveTimerToDB(user.id, started); }
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (HIDDEN_PAGES.includes(currentPage) || dismissed) return null;

  const pillBg = isRunning
    ? 'bg-indigo-600 hover:bg-indigo-700'
    : 'bg-gray-700 hover:bg-gray-800';

  return (
    <>
      {/* ── Modal: ¿Iniciar temporizador al login? ── */}
      {showStartPrompt && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-7 max-w-sm w-full mx-4 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <Monitor className="w-5 h-5 text-indigo-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800">{t('visualHealth', 'timerPromptTitle')}</h2>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{t('visualHealth', 'timerPromptMsg')}</p>
            <div className="flex gap-3 justify-end mt-1">
              <button
                onClick={handlePromptSkip}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
              >
                {t('visualHealth', 'timerPromptSkip')}
              </button>
              <button
                onClick={handlePromptStart}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow"
              >
                {t('visualHealth', 'timerPromptStart')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Banner de descanso ── */}
      {breakAlert && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-5 py-3 bg-amber-400 text-amber-900 rounded-2xl shadow-2xl border border-amber-300 font-semibold text-sm">
          <AlarmClock className="w-5 h-5 flex-shrink-0" />
          <span>{t('visualHealth', 'breakAlertMsg')}</span>
          <button
            onClick={() => setBreakAlert(false)}
            className="ml-2 p-1 rounded-lg hover:bg-amber-300 transition"
            title={t('common', 'close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Widget flotante ── */}
      <div
        className={`fixed bottom-6 left-6 z-[9000] flex items-center gap-2.5 px-4 py-2.5 rounded-2xl shadow-2xl cursor-pointer transition-all duration-200 ${pillBg} text-white select-none group`}
        onClick={() => onNavigate('visual-health')}
        title={t('visualHealth', 'openVisualHealth')}
      >
        {/* Dot de estado */}
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
          }`}
        />

        {/* Ícono */}
        <Monitor className="w-4 h-4 opacity-80 flex-shrink-0" />

        {/* Tiempo */}
        <span className="font-mono font-bold text-sm tracking-widest">
          {formatDuration(elapsedSeconds)}
        </span>

        {/* Próximo descanso */}
        {isRunning && nextBreakInMinutes !== null && (
          <span className="text-xs opacity-70 hidden sm:inline whitespace-nowrap">
            | {nextBreakInMinutes <= 1 ? t('visualHealth', 'lessThan1Min') : `${nextBreakInMinutes} ${t('common', 'min')}`}
          </span>
        )}

        {/* Separador */}
        <span className="w-px h-4 bg-white/30 flex-shrink-0" />

        {/* Botón Play/Pause */}
        <button
          onClick={handleToggle}
          className="p-1 rounded-lg hover:bg-white/20 transition flex-shrink-0"
          title={isRunning ? t('common', 'pause') : t('common', 'start')}
        >
          {isRunning
            ? <Pause className="w-3.5 h-3.5" />
            : <Play  className="w-3.5 h-3.5" />
          }
        </button>

        {/* Botón cerrar */}
        <button
          onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
          className="p-1 rounded-lg hover:bg-white/20 transition opacity-50 hover:opacity-100 flex-shrink-0"
          title={t('visualHealth', 'hideWidget')}
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </>
  );
};

export default GlobalTimerWidget;
