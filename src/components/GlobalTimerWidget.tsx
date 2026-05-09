import { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, Monitor, AlarmClock, X, GripHorizontal } from 'lucide-react';
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
  | 'visual-health'
  | 'profile'
  | 'diagnostico-completo'
  | 'learn'
  | 'blink-detector'
  | 'reading-test'
  | 'chat-sintomas'
  | 'mapa-oftalmologos'
  | 'juegos-visuales'
  | 'rutinas-ia'
  | 'diario-visual'

  | 'campo-visual'
  | 'modo-zen'
  | 'contrast-test'
  | 'reaccion-visual'
  | 'vergencia'
  | 'carga-visual'
  | 'notas-medicas'
  | 'simulador'
  | 'test-cromatico'
  | 'test-acomodacion'
  | 'ejercicios-avanzados'
  | 'historial-ocular'
  | 'analizador-sintomas'
  | 'entrenamiento-mental'
  | 'estadisticas-avanzadas'
  | 'plan-premium'
  | 'dominancia-ocular'
  | 'respiracion-478'
  | 'evolucion-tests';

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
  /** user_id that owns this timer state — used to detect account switches */
  userId: string | null;
};

// ─── Constantes (deben coincidir con VisualHealth.tsx) ────────────────────────

const STORAGE_KEY    = 'therapeye_visual_health_timer';
const WORK_MINUTES   = 20;
const MAX_SESSION_MS = 16 * 60 * 60 * 1000;

// ─── Preferencias del timer ───────────────────────────────────────────────────

const PREFS_KEY = 'therapeye_timer_prefs';
const TIMER_DISMISSED_KEY = 'therapeye_timer_widget_dismissed';

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

/** Carga preferencias desde BD y las escribe en localStorage.
 *  Si el usuario no tiene registro (cuenta nueva) → defaults (notifyOnLogin=false).
 *  Retorna las prefs cargadas. */
const syncPrefsFromDB = async (userId: string): Promise<TimerPrefs> => {
  try {
    const rows = await sql`
      SELECT notify_on_login, onboarding_completed
      FROM user_preferences
      WHERE user_id = ${userId}
      LIMIT 1
    `;
    const prefs: TimerPrefs = rows.length > 0
      ? { notifyOnLogin: Boolean(rows[0].notify_on_login), onboardingCompleted: Boolean(rows[0].onboarding_completed) }
      : { ...DEFAULT_PREFS };
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* noop */ }
    return prefs;
  } catch {
    return loadTimerPrefs(); // si falla la BD, usar lo que haya en localStorage
  }
};

// Páginas donde el widget NO se muestra visualmente
const HIDDEN_PAGES: Page[] = ['login', 'register', 'verify-email'];
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
  userId: null,
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
      const fresh = {
        ...DEFAULT_STATE,
        stateDate: todayLocalDate(),
        // New day → not finalized, fresh accumulated
      };
      // Persist immediately so other components (VisualHealth) read the reset state
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh)); } catch { /* noop */ }
      return fresh;
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
const DB_POLL_INTERVAL_MS = 5_000; // Poll BD cada 5s para detectar cambios de la extensión

// ─── Detección de inactividad ─────────────────────────────────────────────────
// Si pasan >30s entre ticks del setInterval → la máquina estuvo dormida (sleep detection)
// Si el timer monta con startTimestamp viejo (browser restart) → mismo umbral
const SLEEP_THRESHOLD_MS   = 30_000;         // 30s gap → sleep/restart
const INACTIVITY_WARN_MS   = 5 * 60_000;     // 5 min sin actividad → push warning
const INACTIVITY_STOP_MS   = 7 * 60_000;     // 7 min sin actividad → pausar + push "detenido"

// ─── Posición del widget flotante ────────────────────────────────────────────
const WIDGET_POS_KEY = 'therapeye_timer_widget_pos';
type WidgetPos = { x: number; y: number };
const DEFAULT_WIDGET_POS = (): WidgetPos => ({
  x: window.innerWidth  - 280,
  y: window.innerHeight - 70,
});
const loadWidgetPos = (): WidgetPos => {
  try {
    const raw = localStorage.getItem(WIDGET_POS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as WidgetPos;
      // Clamp to viewport
      return {
        x: Math.max(0, Math.min(p.x, window.innerWidth  - 200)),
        y: Math.max(0, Math.min(p.y, window.innerHeight - 50)),
      };
    }
  } catch { /* noop */ }
  return DEFAULT_WIDGET_POS();
};

// ─── Web source ID (identifica esta instancia del navegador web) ──────────────
// Distinto al browserId de la extensión, que es 'ext:xxxxx'.
// Formato: 'web-xxxxxxxx'
let _webSourceId: string | null = null;
const getWebSourceId = (): string => {
  if (_webSourceId) return _webSourceId;
  const KEY = 'therapeye_web_source_id';
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = 'web-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
      localStorage.setItem(KEY, id);
    }
    _webSourceId = id;
  } catch {
    _webSourceId = 'web-' + Date.now().toString(36);
  }
  return _webSourceId!;
};

type DBTimerRow = PersistedTimerState & { _source?: string | null };

const loadTimerFromDB = async (userId: string): Promise<DBTimerRow | null> => {
  try {
    const rows = await sql`
      SELECT accumulated_ms, is_running, last_start_ts, session_start_ts, next_break_at_ms, finalized, source
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
      userId: null,
      _source: r.source ?? null,
    };
  } catch (err) {
    console.warn('[TimerWidget] Error cargando timer de BD:', err);
    return null;
  }
};

const saveTimerToDB = async (userId: string, state: PersistedTimerState, source?: string) => {
  try {
    const fecha = todayLocalDate();
    const src = source ?? null;
    await sql`
      INSERT INTO timer_state (user_id, fecha, accumulated_ms, is_running, last_start_ts, session_start_ts, next_break_at_ms, finalized, source, updated_at)
      VALUES (${userId}, ${fecha}, ${state.accumulatedMs}, ${state.isRunning}, ${state.startTimestamp}, ${state.sessionStartTimestamp}, ${state.nextBreakAtMs}, ${state.finalized}, ${src}, NOW())
      ON CONFLICT (user_id, fecha)
      DO UPDATE SET
        accumulated_ms   = ${state.accumulatedMs},
        is_running       = ${state.isRunning},
        last_start_ts    = ${state.startTimestamp},
        session_start_ts = ${state.sessionStartTimestamp},
        next_break_at_ms = ${state.nextBreakAtMs},
        finalized        = ${state.finalized},
        source           = ${src},
        updated_at       = NOW()
    `;
  } catch (err) {
    console.warn('[TimerWidget] Error guardando timer en BD:', err);
  }
};

// ─── Componente ───────────────────────────────────────────────────────────────

const isMobileDevice = () => window.innerWidth < 768;

const GlobalTimerWidget = ({ currentPage, onNavigate }: Props) => {
  const [elapsedSeconds, setElapsedSeconds]         = useState(0);
  const [isRunning, setIsRunning]                   = useState(false);
  const [nextBreakInMinutes, setNextBreakInMinutes] = useState<number | null>(null);
  const [dismissed, setDismissed]                   = useState(() => {
    try { return localStorage.getItem(TIMER_DISMISSED_KEY) === '1'; } catch { return false; }
  });
  const [breakAlert, setBreakAlert]                 = useState(false);
  /** Modal "¿Deseas iniciar tu temporizador de hoy?" */
  const [showStartPrompt, setShowStartPrompt]       = useState(false);
  /** Banner "cambiaste de cuenta" */
  const [showAccountChanged, setShowAccountChanged] = useState(false);
  const [isMobile, setIsMobile]                     = useState(isMobileDevice);
  // ── Drag ────────────────────────────────────────────────────────────────────
  const [pos, setPos]         = useState<WidgetPos>(loadWidgetPos);
  const dragRef               = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const widgetRef             = useRef<HTMLDivElement>(null);
  /** Banner "timer activo en otra ventana/extensión" */
  const [foreignSessionMs, setForeignSessionMs]     = useState<number | null>(null);
  // Persiste entre re-renders y navegación para no re-disparar la alerta de descanso
  const lastFiredBreakRef = useRef<number | null>(null);
  const foreignSessionDismissedRef                  = useRef(false);
  /** Modal: la extensión estaba corriendo al iniciar sesión */
  const [showExtActivePrompt, setShowExtActivePrompt] = useState<{ accMs: number } | null>(null);

  useEffect(() => {
    const handler = () => setIsMobile(isMobileDevice());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // ── Drag handlers ───────────────────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPosX: pos.x, startPosY: pos.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      const newX = Math.max(0, Math.min(dragRef.current.startPosX + dx, window.innerWidth  - (widgetRef.current?.offsetWidth  ?? 200)));
      const newY = Math.max(0, Math.min(dragRef.current.startPosY + dy, window.innerHeight - (widgetRef.current?.offsetHeight ?? 50)));
      setPos({ x: newX, y: newY });
    };
    const onUp = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      const newX = Math.max(0, Math.min(dragRef.current.startPosX + dx, window.innerWidth  - (widgetRef.current?.offsetWidth  ?? 200)));
      const newY = Math.max(0, Math.min(dragRef.current.startPosY + dy, window.innerHeight - (widgetRef.current?.offsetHeight ?? 50)));
      const finalPos = { x: newX, y: newY };
      setPos(finalPos);
      try { localStorage.setItem(WIDGET_POS_KEY, JSON.stringify(finalPos)); } catch { /* noop */ }
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, [pos]);

  // ── Rastrear actividad del usuario en el navegador ────────────────────────
  useEffect(() => {
    const onActivity = () => {
      lastActivityRef.current = Date.now();
      // Si el usuario vuelve después de inactividad, resetear flags
      // (el timer ya fue pausado — debe reiniciarse manualmente)
      inactivityWarnSentRef.current = false;
      inactivityStopSentRef.current = false;
    };
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    return () => events.forEach(e => window.removeEventListener(e, onActivity));
  }, []);

  const { t, lang } = useLanguage();
  const { user, wasManualLogin, clearManualLogin } = useUser();

  const prevPageRef    = useRef<Page | null>(null);
  const lastDbSyncRef   = useRef<number>(0);
  const lastDbPollRef   = useRef<number>(0);
  const dbLoadedRef     = useRef<boolean>(false);
  const loginHandledRef = useRef<boolean>(false);

  // ── Refs de inactividad ────────────────────────────────────────────────────
  const lastActivityRef         = useRef<number>(Date.now());
  const inactivityWarnSentRef   = useRef<boolean>(false);
  const inactivityStopSentRef   = useRef<boolean>(false);

  // isAuthPage: solo para lógica de pausa/reset — visual-health NO cuenta como auth
  const isAuthPage = AUTH_ONLY_PAGES.includes(currentPage);

  // ── Guardar en BD (debounced — no más de 1 vez cada 30s) ─────────────────
  // IMPORTANTE: pasar el estado RAW (st.accumulatedMs = acumulado puro, st.startTimestamp = inicio real).
  // NO pasar calcElapsedMs() ni Date.now() como startTimestamp — eso causa doble conteo cross-browser.
  const syncToDB = useCallback((state: PersistedTimerState) => {
    if (!user?.id) return;
    const now = Date.now();
    if (now - lastDbSyncRef.current < DB_SYNC_INTERVAL_MS) return;
    lastDbSyncRef.current = now;
    saveTimerToDB(user.id, state, getWebSourceId());
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

    // ── Detección de sleep en mount (browser restart / laptop abierto tras cierre) ──
    // En una SPA activa, el tick cada 1s detenta cualquier gap > 30s.
    // Si el componente monta FRESCO (browser reiniciado), no hay "tick anterior",
    // así que necesitamos detectarlo aquí: si el timer "estaba corriendo" pero
    // su startTimestamp tiene más de SLEEP_THRESHOLD_MS de antigüedad, se asume
    // que la máquina estuvo dormida y se pausa SIN contar el tiempo dormido.
    if (!cameFromAuth && localSt.isRunning && localSt.startTimestamp !== null) {
      const gapSinceStart = Date.now() - localSt.startTimestamp;
      if (gapSinceStart > SLEEP_THRESHOLD_MS) {
        const safeMsOnMount = localSt.accumulatedMs; // NO usar calcElapsedMs → no contar el sleep
        const mountPaused: PersistedTimerState = {
          ...localSt, isRunning: false, startTimestamp: null, accumulatedMs: safeMsOnMount,
        };
        persistState(mountPaused);
        setElapsedSeconds(Math.floor(safeMsOnMount / 1000));
        setIsRunning(false);
        // Sincronizar pausa a BD
        if (user?.id) {
          lastDbSyncRef.current = 0;
          saveTimerToDB(user.id, mountPaused, getWebSourceId()).catch(() => {});
        }
        return; // init completa — no continuar con lógica de "isRunning"
      }
    }

    const localMs = calcElapsedMs(localSt);
    setElapsedSeconds(Math.floor(localMs / 1000));
    // Solo propagar isRunning si NO venimos del login — si venimos del login,
    // handleLoginTimer pausará explícitamente.
    if (!cameFromAuth) {
      setIsRunning(localSt.isRunning);
    } else {
      // Pausar INMEDIATAMENTE en localStorage para que el tick no lea isRunning=true
      // y lo sobreescriba antes de que handleLoginTimer termine su carga asíncrona de BD.
      if (localSt.isRunning) {
        const pausedMs = calcElapsedMs(localSt);
        const immediatelyPaused: PersistedTimerState = {
          ...localSt, isRunning: false, startTimestamp: null, accumulatedMs: pausedMs,
        };
        persistState(immediatelyPaused);
      }
      setIsRunning(false);
    }

    // Luego intentar cargar de BD (para sync cross-browser)
    if (user?.id && !dbLoadedRef.current) {
      dbLoadedRef.current = true;
      loadTimerFromDB(user.id).then(dbState => {
        if (!dbState) return;
        // En móvil: si el timer estaba corriendo, pausarlo automáticamente
        // El timer es exclusivo de tiempo de trabajo en computadora.
        if (isMobileDevice() && dbState.isRunning) {
          const pausedMs = dbState.accumulatedMs;
          const mobilePaused: PersistedTimerState = {
            ...dbState, isRunning: false, startTimestamp: null, accumulatedMs: pausedMs,
          };
          persistState(mobilePaused);
          setElapsedSeconds(Math.floor(pausedMs / 1000));
          setIsRunning(false);
          lastDbSyncRef.current = 0;
          saveTimerToDB(user.id, mobilePaused, getWebSourceId());
          return;
        }
        // Al hacer login, BD es la fuente de verdad SIEMPRE — localStorage puede
        // tener datos viejos de otra sesión en este navegador.
        if (cameFromAuth) {
          // Pausar la versión de BD (no arrancar) y sobrescribir localStorage
          const pausedDb: PersistedTimerState = {
            ...dbState, isRunning: false, startTimestamp: null,
          };
          persistState(pausedDb);
          setElapsedSeconds(Math.floor(dbState.accumulatedMs / 1000));
        } else {
          // Navegación normal (no login) → solo sobrescribir si BD tiene más
          const dbMs     = calcElapsedMs(dbState);
          const localMs2 = calcElapsedMs(loadState());
          if (dbMs > localMs2) {
            persistState(dbState);
            setElapsedSeconds(Math.floor(dbMs / 1000));
            setIsRunning(dbState.isRunning);
            if (dbState.isRunning && dbState.nextBreakAtMs != null) {
              const rem = dbState.nextBreakAtMs - dbMs;
              setNextBreakInMinutes(rem > 0 ? Math.round(rem / 60000) : 0);
            }
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
        if (user?.id) { lastDbSyncRef.current = 0; saveTimerToDB(user.id, paused, getWebSourceId()); }
        setIsRunning(false);
        setNextBreakInMinutes(null);
      } else {
        // Timer ya pausado/finalizado → sincronizar estado actual a BD de todas formas
        // (cubre el caso de pause/finalize desde VisualHealth que solo escribió a localStorage)
        if (user?.id) { lastDbSyncRef.current = 0; saveTimerToDB(user.id, st, getWebSourceId()); }
      }
      dbLoadedRef.current = false;
      loginHandledRef.current = false;
      return;
    }

    // Login MANUAL → comportamiento según preferencia del usuario
    // Solo si el usuario hizo click en "Iniciar sesión", NO cuando se restaura la sesión automáticamente
    const fromAuth = prev === 'login' || prev === 'register' || prev === 'verify-email';
    if (currentPage === 'dashboard' && fromAuth && wasManualLogin && !loginHandledRef.current) {
      clearManualLogin();
      loginHandledRef.current = true;

      // ═══ Detección de cambio de cuenta ═══
      // Si hay datos en localStorage de OTRA cuenta, avisamos y los descartamos.
      // Los datos de la cuenta anterior ya están en su BD (la extensión y el widget los sincronizaron).
      const prevLocal = loadState();
      const accountSwitched = prevLocal.userId && user?.id && prevLocal.userId !== user.id;
      if (accountSwitched) {
        const fresh: PersistedTimerState = { ...DEFAULT_STATE, stateDate: todayLocalDate(), userId: user.id };
        persistState(fresh);
        setElapsedSeconds(0);
        setIsRunning(false);
        setShowAccountChanged(true);
        setTimeout(() => setShowAccountChanged(false), 5000);
      }

      const handleLoginTimer = (baseState: PersistedTimerState) => {
        // ═══ SIEMPRE pausar al llegar del login ═══
        // Usar accumulatedMs directamente — NO calcElapsedMs(), porque si la BD tiene
        // un startTimestamp viejo (pause/finalize no sincronizó) sumaría tiempo fantasma.
        const accMs = baseState.accumulatedMs;

        // Avanzar nextBreakAtMs si ya quedó en el pasado (el descanso ya se disparó antes
        // de este login). Así al reanudar el timer no re-dispara la alerta vieja.
        let nextBreakAtMs = baseState.nextBreakAtMs;
        if (nextBreakAtMs !== null && accMs >= nextBreakAtMs) {
          let nb = nextBreakAtMs + WORK_MINUTES * 60_000;
          while (nb <= accMs) nb += WORK_MINUTES * 60_000;
          nextBreakAtMs = nb;
        }

        const paused: PersistedTimerState = {
          ...baseState,
          isRunning: false,
          startTimestamp: null,
          accumulatedMs: accMs,
          nextBreakAtMs,
          userId: user?.id ?? null,
        };
        persistState(paused);
        setIsRunning(false);
        setElapsedSeconds(Math.floor(accMs / 1000));
        if (user?.id) { lastDbSyncRef.current = 0; saveTimerToDB(user.id, paused, getWebSourceId()); }

        // Si ya finalizó hoy → no preguntar nada
        if (baseState.finalized) return;

        // Solo preguntar si el usuario tiene activa esa preferencia
        if (user?.id) {
          syncPrefsFromDB(user.id).then(prefs => {
            if (prefs.notifyOnLogin && !isMobileDevice()) setShowStartPrompt(true);
          });
        } else {
          const localPrefs = loadTimerPrefs();
          if (localPrefs.notifyOnLogin && !isMobileDevice()) setShowStartPrompt(true);
        }
      };

      // Cargar desde BD para sincronización cross-browser.
      // Al hacer login, BD es SIEMPRE la fuente de verdad — localStorage puede
      // tener datos de una sesión vieja de ESTE navegador (días atrás).
      if (user?.id) {
        loadTimerFromDB(user.id).then(dbState => {
          if (dbState) {
            // BD tiene datos para hoy → SIEMPRE usar BD (no comparar con localStorage)
            persistState({ ...dbState, userId: user.id });

            // Extensión activa al momento del login → preguntar si adoptar en vez de "¿iniciar?"
            if (dbState._source?.startsWith('ext:') && dbState.isRunning && !dbState.finalized) {
              const pausedDb: PersistedTimerState = {
                ...dbState, isRunning: false, startTimestamp: null, userId: user!.id,
              };
              persistState(pausedDb);
              setElapsedSeconds(Math.floor(dbState.accumulatedMs / 1000));
              setIsRunning(false);
              lastDbSyncRef.current = 0;
              saveTimerToDB(user!.id, pausedDb, getWebSourceId());
              setShowExtActivePrompt({ accMs: dbState.accumulatedMs });
              return;
            }

            handleLoginTimer(dbState);
          } else {
            // No hay datos en BD para hoy → nueva sesión del día
            const fresh: PersistedTimerState = {
              ...DEFAULT_STATE,
              stateDate: todayLocalDate(),
              userId: user.id,
            };
            persistState(fresh);
            handleLoginTimer(fresh);
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

  // ── Escuchar evento de re-activación del timer (desde ajustes) ───────────
  useEffect(() => {
    const handler = () => {
      setDismissed(false);
      try { localStorage.removeItem(TIMER_DISMISSED_KEY); } catch { /* noop */ }
    };
    window.addEventListener('therapheye-timer-show', handler);
    return () => window.removeEventListener('therapheye-timer-show', handler);
  }, []);

  // ── Tick cada segundo (solo en páginas autenticadas) ──────────────────────
  useEffect(() => {
    if (isAuthPage) return;

    // Inicializar desde localStorage para sobrevivir navegación
    if (lastFiredBreakRef.current === null) {
      try {
        const stored = localStorage.getItem('therapeye_last_break_fired');
        if (stored) lastFiredBreakRef.current = Number(stored);
      } catch { /* noop */ }
    }
    let lastTickTs = Date.now();

    const interval = setInterval(() => {
      const now = Date.now();
      const gap = now - lastTickTs;
      lastTickTs = now;

      const st  = loadState();

      // ═══ Detección de sleep/suspend ═══
      // Si el gap entre ticks es >30s y el timer estaba corriendo → pausar automáticamente.
      // La máquina estuvo dormida; no es justo contar ese tiempo como pantalla activa.
      if (gap > SLEEP_THRESHOLD_MS && st.isRunning) {
        // Calcular el tiempo real ANTES del sleep (accumulatedMs + tiempo hasta el sleep)
        // Aproximamos que el sleep empezó ~1s después del último tick
        const msBeforeSleep = st.accumulatedMs + (st.startTimestamp ? (lastTickTs - gap + 1000 - st.startTimestamp) : 0);
        const safeMsBeforeSleep = Math.max(0, Math.min(msBeforeSleep, MAX_SESSION_MS));
        const paused: PersistedTimerState = {
          ...st,
          isRunning: false,
          startTimestamp: null,
          accumulatedMs: safeMsBeforeSleep,
        };
        persistState(paused);
        setIsRunning(false);
        setElapsedSeconds(Math.floor(safeMsBeforeSleep / 1000));
        setNextBreakInMinutes(null);
        if (user?.id) { lastDbSyncRef.current = 0; saveTimerToDB(user.id, paused, getWebSourceId()); }
        return;
      }

      const ms  = calcElapsedMs(st);
      setElapsedSeconds(Math.floor(ms / 1000));
      setIsRunning(st.isRunning);

      // Sync periódico a BD (write local → DB)
      // Usar st RAW: st.accumulatedMs = acumulado puro antes del run actual,
      // st.startTimestamp = timestamp real del último inicio. Así otros clientes
      // calculan correctamente: accumulated + (now - startTimestamp) sin doble conteo.
      if (st.isRunning) {
        syncToDB(st);
      }

      // Poll BD cada 5s para detectar cambios de la extensión (read DB → local)
      if (user?.id && now - lastDbPollRef.current >= DB_POLL_INTERVAL_MS) {
        lastDbPollRef.current = now;
        loadTimerFromDB(user.id).then(dbState => {
          if (!dbState) return;
          const mySource   = getWebSourceId();
          const dbSource   = dbState._source ?? null;
          const isForeign  = dbState.isRunning && dbSource && dbSource !== mySource;
          const localNow   = loadState();
          const localMs    = calcElapsedMs(localNow);
          const dbFullMs   = calcElapsedMs(dbState);

          // ── Detección de sesión externa (extensión activa en otro navegador) ──
          if (isForeign && !localNow.isRunning) {
            if (!foreignSessionDismissedRef.current) {
              setForeignSessionMs(dbFullMs);
            }
          } else {
            setForeignSessionMs(null);
            foreignSessionDismissedRef.current = false;
          }

          // Si BD tiene source='reset' → aplicar reset local también
          if (dbSource === 'reset' && localNow.accumulatedMs > 0) {
            const resetLocal: PersistedTimerState = { ...dbState, userId: localNow.userId };
            persistState(resetLocal);
            setElapsedSeconds(0);
            setIsRunning(false);
            setNextBreakInMinutes(null);
            return;
          }

          // Adoptar estado de BD solo si tiene MÁS tiempo que local (extensión adelantada)
          // o si la extensión pausó (respetar pausa explícita).
          // No adoptar sesión de fuente externa cuando la propia ya está corriendo.
          const dbAhead  = dbFullMs > localMs + 2000;
          const dbPaused = !dbState.isRunning && localNow.isRunning;
          if ((dbAhead && (!isForeign || !localNow.isRunning)) || dbPaused) {
            persistState(dbState);
            setElapsedSeconds(Math.floor(dbFullMs / 1000));
            setIsRunning(dbState.isRunning);
            if (dbState.nextBreakAtMs != null) {
              const rem = dbState.nextBreakAtMs - dbFullMs;
              setNextBreakInMinutes(rem > 0 ? Math.round(rem / 60000) : 0);
            }
          }
        }).catch(() => { /* ignore poll errors */ });
      }

      if (!st.isRunning) {
        setNextBreakInMinutes(null);
        return;
      }

      // ═══ Detección de inactividad del usuario ═══
      // Rastreo vía mousemove/keydown/click/touch/scroll (lastActivityRef).
      // 5 min sin actividad → push warning. 7 min → pausar timer + push "detenido".
      const inactiveMs = now - lastActivityRef.current;

      if (inactiveMs >= INACTIVITY_STOP_MS && !inactivityStopSentRef.current) {
        // ── 7 min → pausar timer + push "detenido" ─────────────────────────
        // Restar el tiempo inactivo medido — el usuario no estaba en pantalla
        inactivityStopSentRef.current = true;
        const pausedMs = Math.max(0, calcElapsedMs(st) - inactiveMs);
        const inactPaused: PersistedTimerState = {
          ...st, isRunning: false, startTimestamp: null, accumulatedMs: pausedMs,
        };
        persistState(inactPaused);
        setIsRunning(false);
        setNextBreakInMinutes(null);
        if (user?.id) {
          lastDbSyncRef.current = 0;
          saveTimerToDB(user.id, inactPaused, getWebSourceId()).catch(() => {});
          fetch('/.netlify/functions/push-notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              title: '⏸ Timer pausado por inactividad',
              message: 'No detectamos actividad en 7 minutos. Tu timer de pantalla fue pausado automáticamente.',
              tag: 'timer-inactivity-stop',
            }),
          }).catch(() => {});
        }
        return;
      }

      if (inactiveMs >= INACTIVITY_WARN_MS && !inactivityWarnSentRef.current) {
        // ── 5 min → push warning ────────────────────────────────────────────
        inactivityWarnSentRef.current = true;
        if (user?.id) {
          fetch('/.netlify/functions/push-notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              title: '👁 ¿Sigues usando la pantalla?',
              message: 'Llevas 5 minutos sin actividad. Si dejaste de trabajar, pausaremos el timer en 2 minutos.',
              tag: 'timer-inactivity-warn',
            }),
          }).catch(() => {});
        }
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
        if (st.nextBreakAtMs !== lastFiredBreakRef.current) {
          lastFiredBreakRef.current = st.nextBreakAtMs;
          try { localStorage.setItem('therapeye_last_break_fired', String(st.nextBreakAtMs)); } catch { /* noop */ }
          playBeep();
          speakText(t('visualHealth', 'breakRule'), lang);
          setBreakAlert(true);
        }
        let nb = st.nextBreakAtMs + WORK_MINUTES * 60_000;
        while (nb <= ms) nb += WORK_MINUTES * 60_000;
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
    lastActivityRef.current = Date.now();
    inactivityWarnSentRef.current = false;
    inactivityStopSentRef.current = false;
    if (user?.id) { lastDbSyncRef.current = 0; saveTimerToDB(user.id, started, getWebSourceId()); }
  };

  const handlePromptSkip = () => {
    setShowStartPrompt(false);
  };

  // ── Handlers para extensión activa al login ───────────────────────────────

  const handleExtActiveAdopt = () => {
    if (!showExtActivePrompt || !user?.id) { setShowExtActivePrompt(null); return; }
    const st = loadState();
    const now = Date.now();
    const started: PersistedTimerState = {
      ...st,
      isRunning: true,
      startTimestamp: now,
      sessionStartTimestamp: st.sessionStartTimestamp ?? now,
      finalized: false,
      stateDate: todayLocalDate(),
      userId: user.id,
    };
    persistState(started);
    setIsRunning(true);
    lastDbSyncRef.current = 0;
    saveTimerToDB(user.id, started, getWebSourceId());
    setShowExtActivePrompt(null);
  };

  const handleExtActiveSkip = () => {
    setShowExtActivePrompt(null);
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const st = loadState();
    if (st.isRunning) {
      // PAUSE — solo localmente, NO sincronizar a BD para que la extensión siga corriendo
      const ms = calcElapsedMs(st);
      const paused: PersistedTimerState = {
        ...st,
        isRunning: false,
        startTimestamp: null,
        accumulatedMs: ms,
        userId: user?.id ?? st.userId ?? null,
      };
      persistState(paused);
      setIsRunning(false);
      setNextBreakInMinutes(null);
      // No llamar saveTimerToDB aquí — la extensión continúa en BD
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
        userId: user?.id ?? st.userId ?? null,
      };
      persistState(started);
      setIsRunning(true);
      // Reiniciar tracking de inactividad al arrancar manualmente
      lastActivityRef.current = Date.now();
      inactivityWarnSentRef.current = false;
      inactivityStopSentRef.current = false;
      if (user?.id) { lastDbSyncRef.current = 0; saveTimerToDB(user.id, started, getWebSourceId()); }
    }
  };

  // ── Tomar control del timer externo ──────────────────────────────────────
  const handleTakeOverForeignSession = () => {
    setForeignSessionMs(null);
    foreignSessionDismissedRef.current = false;
    // Cargar el estado de BD y adoptarlo como propio
    if (!user?.id) return;
    loadTimerFromDB(user.id).then(dbState => {
      if (!dbState) return;
      const adopted: PersistedTimerState = {
        ...dbState,
        userId: user.id,
        stateDate: todayLocalDate(),
      };
      persistState(adopted);
      setElapsedSeconds(Math.floor(calcElapsedMs(adopted) / 1000));
      setIsRunning(adopted.isRunning);
      lastDbSyncRef.current = 0;
      saveTimerToDB(user.id, adopted, getWebSourceId());
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (HIDDEN_PAGES.includes(currentPage) || dismissed || isMobile) return null;

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

      {/* ── Modal: extensión activa al login ── */}
      {showExtActivePrompt !== null && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-7 max-w-sm w-full mx-4 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <Monitor className="w-5 h-5 text-indigo-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800">Timer corriendo en la extensión</h2>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Tu extensión tiene {formatDuration(Math.floor(showExtActivePrompt.accMs / 1000))} acumulados. ¿Quieres continuar desde aquí?
            </p>
            <div className="flex gap-3 justify-end mt-1">
              <button
                onClick={handleExtActiveSkip}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
              >
                No, después
              </button>
              <button
                onClick={handleExtActiveAdopt}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow"
              >
                Sí, continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Banner: timer activo en otra ventana/extensión ── */}
      {foreignSessionMs !== null && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-5 py-3 bg-indigo-600 text-white rounded-2xl shadow-2xl border border-indigo-500 font-semibold text-sm max-w-sm w-full mx-4">
          <Monitor className="w-5 h-5 flex-shrink-0" />
          <span className="flex-1">Timer activo en otra ventana ({formatDuration(Math.floor(foreignSessionMs / 1000))}). ¿Usar aquí?</span>
          <button
            onClick={handleTakeOverForeignSession}
            className="px-3 py-1 rounded-lg bg-white text-indigo-700 text-xs font-bold hover:bg-indigo-50 transition"
          >
            Sí
          </button>
          <button
            onClick={() => { setForeignSessionMs(null); foreignSessionDismissedRef.current = true; }}
            className="px-3 py-1 rounded-lg bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-400 transition"
          >
            No
          </button>
        </div>
      )}

      {/* ── Banner cambio de cuenta ── */}
      {showAccountChanged && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-5 py-3 bg-blue-600 text-white rounded-2xl shadow-2xl border border-blue-500 font-semibold text-sm">
          <Monitor className="w-5 h-5 flex-shrink-0" />
          <span>{t('visualHealth', 'accountChangedMsg')}</span>
          <button
            onClick={() => setShowAccountChanged(false)}
            className="ml-2 p-1 rounded-lg hover:bg-blue-500 transition"
            title={t('common', 'close')}
          >
            <X className="w-4 h-4" />
          </button>
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

      {/* ── Widget flotante (arrastrable) ── */}
      <div
        ref={widgetRef}
        style={{ left: pos.x, top: pos.y, position: 'fixed' }}
        className={`z-[9000] flex items-center gap-2 px-3 py-2 rounded-2xl shadow-2xl transition-colors duration-200 ${pillBg} text-white select-none`}
      >
        {/* Handle de arrastre */}
        <span
          onMouseDown={handleDragStart}
          className="cursor-grab active:cursor-grabbing p-1 -ml-1 opacity-50 hover:opacity-90 flex-shrink-0"
          title="Arrastrar"
        >
          <GripHorizontal className="w-3.5 h-3.5" />
        </span>

        {/* Dot de estado */}
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
          }`}
        />

        {/* Área clickeable → ir a visual-health */}
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => onNavigate('visual-health')}
          title={t('visualHealth', 'openVisualHealth')}
        >
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
        </div>

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
          onClick={(e) => { e.stopPropagation(); setDismissed(true); try { localStorage.setItem(TIMER_DISMISSED_KEY, '1'); } catch { /* noop */ } }}
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
