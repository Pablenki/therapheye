import { useEffect, useState, useRef } from 'react';
import { Activity, ClipboardList, History, LogOut, Eye, Camera, Glasses, HeartPulse, Flame, TrendingUp, TrendingDown, Minus, Play, Pause, ChevronDown, KeyRound, ScanEye } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../i18n';
import { sql } from '../neonCliente';

type Page =
  | 'login'
  | 'register'
  | 'dashboard'
  | 'questionnaire'
  | 'exercises'
  | 'exercise-session'
  | 'history'
  | 'image-capture'
  | 'vision-test'
  | 'visual-health'
  | 'profile'
  | 'diagnostico-completo';

interface Stats {
  evaluaciones: number;
  ejercicios: number;
  racha: number;
  tendencia: 'mejorando' | 'empeorando' | 'estable' | null;
  ultimoPuntaje: number | null;
  penultimoPuntaje: number | null;
}

// ─── Calcular racha de días activos ──────────────────────────────────────────
// Un día se considera "activo" si tuvo al menos un ejercicio completado
// o un cuestionario respondido.
const calcularRacha = (fechas: string[]): number => {
  if (fechas.length === 0) return 0;

  // Normalizar a YYYY-MM-DD en timezone local
  const diasUnicos = [...new Set(
    fechas.map(f => {
      const d = new Date(f.includes('Z') || f.includes('+') ? f : f.replace(' ', 'T') + 'Z');
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })
  )].sort().reverse(); // más reciente primero

  if (diasUnicos.length === 0) return 0;

  const hoy     = new Date();
  const hoyKey  = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  const ayerKey = (() => {
    const a = new Date(hoy);
    a.setDate(a.getDate() - 1);
    return `${a.getFullYear()}-${String(a.getMonth() + 1).padStart(2, '0')}-${String(a.getDate()).padStart(2, '0')}`;
  })();

  // La racha solo cuenta si la actividad más reciente fue hoy o ayer
  if (diasUnicos[0] !== hoyKey && diasUnicos[0] !== ayerKey) return 0;

  let racha = 0;
  let esperado = diasUnicos[0];

  for (const dia of diasUnicos) {
    if (dia === esperado) {
      racha++;
      // Calcular el día anterior
      const prev = new Date(esperado);
      prev.setDate(prev.getDate() - 1);
      esperado = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
    } else {
      break; // Cadena rota
    }
  }

  return racha;
};

const Dashboard = ({ onNavigate }: { onNavigate: (page: Page) => void }) => {
  const { user, logout } = useUser();
  const { t, lang } = useLanguage();
  const [stats, setStats]       = useState<Stats>({ evaluaciones: 0, ejercicios: 0, racha: 0, tendencia: null, ultimoPuntaje: null, penultimoPuntaje: null });
  const [loadingStats, setLoadingStats] = useState(true);
  const [screenTimeMs, setScreenTimeMs] = useState<number>(0);
  const [screenTimeRunning, setScreenTimeRunning] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showUserMenu, setShowUserMenu]           = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const [extensionDismissed, setExtensionDismissed] = useState(
    () => localStorage.getItem('therapheye_ext_banner_dismissed') === 'true'
  );
  const [extensionInstalled, setExtensionInstalled] = useState(false);

  const extensionUrl = 'https://chromewebstore.google.com/detail/therapheye-%E2%80%93-screen-time/lephmmimjeeeknpgdmnhpjkbbnmplcal';

  // ── Detectar si la extensión ya está instalada ───────────────────────────────
  useEffect(() => {
    const EXT_ID = 'lephmmimjeeeknpgdmnhpjkbbnmplcal';

    // Método 1: atributo DOM inyectado por content.js (instantáneo)
    if (document.documentElement.hasAttribute('data-therapheye-ext')) {
      setExtensionInstalled(true);
      return;
    }

    // Método 2: intentar cargar un recurso de la extensión
    // Funciona si web_accessible_resources está configurado en el manifest
    const img = new Image();
    img.onload = () => setExtensionInstalled(true);
    img.src = `chrome-extension://${EXT_ID}/icons/icon16.png`;

    // Método 3: MutationObserver por si content.js carga después del componente
    const observer = new MutationObserver(() => {
      if (document.documentElement.hasAttribute('data-therapheye-ext')) {
        setExtensionInstalled(true);
        observer.disconnect();
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-therapheye-ext'] });
    return () => { observer.disconnect(); img.onload = null; };
  }, []);

  // ── Cargar stats reales desde BD ─────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    const fetchStats = async () => {
      setLoadingStats(true);
      try {
        // 1. Contar evaluaciones y obtener últimas 2 para tendencia
        const evalRows = await sql`
          SELECT puntaje_fatiga, created_at
          FROM   respuestas_cuestionario
          WHERE  user_id = ${user.id}
          ORDER  BY created_at DESC
          LIMIT  2
        `;

        // 2. Contar ejercicios completados
        const exRows = await sql`
          SELECT COUNT(*) AS total
          FROM   historial_ejercicios
          WHERE  user_id = ${user.id}
            AND  status = 'completed'
        `;

        // 3. Todas las fechas de actividad (ejercicios + cuestionarios) para racha
        const activityRows = await sql`
          SELECT created_at FROM historial_ejercicios  WHERE user_id = ${user.id}
          UNION ALL
          SELECT created_at FROM respuestas_cuestionario WHERE user_id = ${user.id}
        `;

        const evaluaciones  = evalRows.length;
        const ejercicios    = Number(exRows[0]?.total ?? 0);
        const todasFechas   = activityRows.map((r: Record<string, unknown>) => String(r.created_at));
        const racha         = calcularRacha(todasFechas);

        // Tendencia: comparar último puntaje vs penúltimo
        let tendencia: Stats['tendencia'] = null;
        let ultimoPuntaje: number | null = null;
        let penultimoPuntaje: number | null = null;

        if (evalRows.length >= 2) {
          ultimoPuntaje     = Number(evalRows[0].puntaje_fatiga);
          penultimoPuntaje  = Number(evalRows[1].puntaje_fatiga);
          const diff = ultimoPuntaje - penultimoPuntaje;
          if (diff <= -5)       tendencia = 'mejorando';
          else if (diff >= 5)   tendencia = 'empeorando';
          else                  tendencia = 'estable';
        } else if (evalRows.length === 1) {
          ultimoPuntaje = Number(evalRows[0].puntaje_fatiga);
        }

        setStats({ evaluaciones, ejercicios, racha, tendencia, ultimoPuntaje, penultimoPuntaje });
      } catch (err) {
        console.error('[Dashboard] Error cargando stats:', err);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, [user?.id]);

  // ── Timer helpers (comparten lógica con GlobalTimerWidget) ───────────────────
  const TIMER_STORAGE_KEY  = 'therapeye_visual_health_timer';
  const TIMER_MAX_MS       = 16 * 60 * 60 * 1000;
  const TIMER_WORK_MINUTES = 20;

  type DashTimerState = {
    isRunning: boolean; startTimestamp: number | null; accumulatedMs: number;
    nextBreakAtMs: number | null; sessionStartTimestamp: number | null;
    finalized?: boolean; stateDate?: string | null;
  };

  const readTimerState = (): DashTimerState => {
    try {
      const raw = localStorage.getItem(TIMER_STORAGE_KEY);
      return raw ? JSON.parse(raw) : { isRunning: false, startTimestamp: null, accumulatedMs: 0, nextBreakAtMs: null, sessionStartTimestamp: null };
    } catch { return { isRunning: false, startTimestamp: null, accumulatedMs: 0, nextBreakAtMs: null, sessionStartTimestamp: null }; }
  };

  const calcTimerMs = (state: DashTimerState): number => {
    let ms = state.accumulatedMs;
    if (state.isRunning && state.startTimestamp) {
      const delta = Date.now() - state.startTimestamp;
      if (delta > 0 && delta < TIMER_MAX_MS) ms += delta;
    }
    return Math.max(0, Math.min(ms, TIMER_MAX_MS));
  };

  const handleTimerToggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // Evitar que el click navegue a visual-health
    const st  = readTimerState();
    const now = Date.now();
    const d   = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    let newState: DashTimerState;
    if (st.isRunning) {
      // Pausar
      const ms = calcTimerMs(st);
      newState = { ...st, isRunning: false, startTimestamp: null, accumulatedMs: ms };
    } else {
      // Iniciar
      const ms = st.accumulatedMs;
      newState = {
        ...st, isRunning: true, startTimestamp: now, accumulatedMs: ms,
        sessionStartTimestamp: st.sessionStartTimestamp ?? now,
        nextBreakAtMs: ms + TIMER_WORK_MINUTES * 60_000,
        finalized: false, stateDate: today,
      };
    }
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(newState));
    // Sincronizar a BD para evitar desincronización
    if (user?.id) {
      sql`
        INSERT INTO timer_state (user_id, fecha, accumulated_ms, is_running, last_start_ts, session_start_ts, next_break_at_ms, finalized, updated_at)
        VALUES (${user.id}, ${today}, ${newState.accumulatedMs}, ${newState.isRunning}, ${newState.startTimestamp}, ${newState.sessionStartTimestamp}, ${newState.nextBreakAtMs}, ${newState.finalized ?? false}, NOW())
        ON CONFLICT (user_id, fecha)
        DO UPDATE SET
          accumulated_ms   = ${newState.accumulatedMs},
          is_running       = ${newState.isRunning},
          last_start_ts    = ${newState.startTimestamp},
          session_start_ts = ${newState.sessionStartTimestamp},
          next_break_at_ms = ${newState.nextBreakAtMs},
          finalized        = ${newState.finalized ?? false},
          updated_at       = NOW()
      `.catch(err => console.warn('[Dashboard] Error syncing timer to DB:', err));
    }
  };

  // ── Cargar y actualizar tiempo en pantalla desde localStorage ──────────────────
  useEffect(() => {
    const loadScreenTime = () => {
      try {
        const state = readTimerState();
        setScreenTimeMs(calcTimerMs(state));
        setScreenTimeRunning(state.isRunning);
      } catch (err) {
        console.error('[Dashboard] Error loading screen time:', err);
      }
    };

    loadScreenTime();
    const interval = setInterval(loadScreenTime, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modules = [
    {
      icon: ClipboardList,
      title: t('dashboard', 'questionnaire'),
      description: t('dashboard', 'questionnaireDesc'),
      color: 'bg-blue-500',
      action: () => onNavigate('questionnaire'),
    },
    {
      icon: Activity,
      title: t('dashboard', 'exercises'),
      description: t('dashboard', 'exercisesDesc'),
      color: 'bg-green-500',
      action: () => onNavigate('exercises'),
    },
    {
      icon: History,
      title: t('dashboard', 'history'),
      description: t('dashboard', 'historyDesc'),
      color: 'bg-purple-500',
      action: () => onNavigate('history'),
    },
    {
      icon: Camera,
      title: t('dashboard', 'imageCapture'),
      description: t('dashboard', 'imageCaptureDesc'),
      color: 'bg-red-500',
      action: () => onNavigate('image-capture'),
    },
    {
      icon: Glasses,
      title: t('dashboard', 'visionTest'),
      description: t('dashboard', 'visionTestDesc'),
      color: 'bg-teal-500',
      action: () => onNavigate('vision-test'),
    },
    {
      icon: HeartPulse,
      title: t('dashboard', 'visualHealth'),
      description: t('dashboard', 'visualHealthDesc'),
      color: 'bg-orange-500',
      action: () => onNavigate('visual-health'),
    },
    {
      icon: ScanEye,
      title: 'Diagnóstico completo',
      description: 'Análisis integral de tu salud visual con score, gráfica e insights.',
      color: 'bg-violet-600',
      action: () => onNavigate('diagnostico-completo'),
    },
  ];

  // ── Íconos y colores de tendencia ─────────────────────────────────────────────
  const TrendIcon = () => {
    if (!stats.tendencia) return null;
    if (stats.tendencia === 'mejorando')   return <TrendingDown className="w-4 h-4 text-green-600" />;
    if (stats.tendencia === 'empeorando')  return <TrendingUp   className="w-4 h-4 text-red-500"   />;
    return <Minus className="w-4 h-4 text-yellow-500" />;
  };

  const getTendenciaLabel = (tendencia: string) => {
    const labelMap: Record<string, { cls: string }> = {
      mejorando:  { cls: 'text-green-600 bg-green-50 border-green-200' },
      empeorando: { cls: 'text-red-600   bg-red-50   border-red-200'   },
      estable:    { cls: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
    };
    return labelMap[tendencia] || labelMap.estable;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* ── Modal de confirmación: Cerrar sesión ── */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-7 max-w-sm w-full mx-4 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <LogOut className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800">{t('common', 'confirmLogoutTitle')}</h2>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{t('common', 'confirmLogoutMsg')}</p>
            <div className="flex gap-3 justify-end mt-1">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
              >
                {t('visualHealth', 'confirmNo')}
              </button>
              <button
                onClick={() => { setShowLogoutConfirm(false); logout(); onNavigate('login'); }}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition shadow"
              >
                {t('common', 'confirmLogoutYes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Eye className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Therapheye</h1>
          </div>

          {/* User dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(v => !v)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-100 transition"
            >
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
                {user?.foto_perfil
                  ? <img src={user.foto_perfil} alt="avatar" className="w-full h-full object-cover" />
                  : <span>{user?.nombre?.charAt(0).toUpperCase() ?? '?'}</span>
                }
              </div>
              <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[140px] truncate">
                {user?.nombre?.split(' ').slice(0, 2).join(' ')}
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown panel */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50">
                {/* Info usuario */}
                <div className="px-4 py-2 border-b border-gray-100 mb-1">
                  <p className="text-sm font-semibold text-gray-800 truncate">{user?.nombre}</p>
                  <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                </div>
                {/* Cambiar contraseña */}
                <button
                  onClick={() => { setShowUserMenu(false); onNavigate('profile'); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  <KeyRound className="w-4 h-4 text-gray-500" />
                  {lang === 'es' ? 'Mi cuenta' : 'My account'}
                </button>
                {/* Cerrar sesión */}
                <button
                  onClick={() => { setShowUserMenu(false); setShowLogoutConfirm(true); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition"
                >
                  <LogOut className="w-4 h-4" />
                  {t('common', 'logout')}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">
            {t('dashboard', 'welcome')} {user?.nombre?.split(' ').slice(0, 3).join(' ')}!
          </h2>
          <p className="text-gray-600">{t('dashboard', 'selectModule')}</p>
        </div>

        {/* Extension Banner — hidden on mobile (< md breakpoint = 768px) */}
        {!extensionDismissed && !extensionInstalled && (
          <div className="mb-6 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4 hidden md:flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-lg">🧩</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-indigo-900">{lang === 'es' ? 'Extensión de navegador' : 'Browser Extension'}</p>
                <p className="text-xs text-indigo-600 truncate">
                  {lang === 'es' ? 'Monitorea tu tiempo en pantalla sin tener la página abierta' : 'Track screen time without keeping the page open'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <a
                href={extensionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition whitespace-nowrap"
              >
                {lang === 'es' ? 'Agregar extensión' : 'Add Extension'}
              </a>
              <button
                onClick={() => { localStorage.setItem('therapheye_ext_banner_dismissed', 'true'); setExtensionDismissed(true); }}
                className="text-indigo-400 hover:text-indigo-600 text-lg leading-none"
                title="Dismiss"
              >×</button>
            </div>
          </div>
        )}

        {/* Modules Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module, index) => (
            <button
              key={index}
              onClick={module.action}
              className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-left"
            >
              <div className={`${module.color} w-14 h-14 rounded-lg flex items-center justify-center mb-4`}>
                <module.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">{module.title}</h3>
              <p className="text-gray-600">{module.description}</p>
            </button>
          ))}
        </div>

        {/* Stats Section */}
        <div className="mt-8 bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xl font-semibold text-gray-800">{t('dashboard', 'progressSummary')}</h3>
            {loadingStats && (
              <span className="text-xs text-gray-400 animate-pulse">{t('dashboard', 'loadingData')}</span>
            )}
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            {/* Evaluaciones */}
            <div className="flex flex-col items-center p-5 bg-blue-50 rounded-xl border border-blue-100">
              <p className={`text-4xl font-black text-blue-600 transition-all ${loadingStats ? 'opacity-30' : 'opacity-100'}`}>
                {stats.evaluaciones}
              </p>
              <p className="text-gray-600 mt-1 text-sm font-medium">{t('dashboard', 'evaluationsCompleted')}</p>
              {stats.tendencia && (
                <div className={`mt-2 flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-semibold ${getTendenciaLabel(stats.tendencia).cls}`}>
                  <TrendIcon />
                  {t('dashboard', stats.tendencia === 'mejorando' ? 'improving' : stats.tendencia === 'empeorando' ? 'worsening' : 'stable')}
                </div>
              )}
              {stats.ultimoPuntaje !== null && (
                <p className="text-xs text-gray-400 mt-1">
                  {t('dashboard', 'lastScore')}: <span className="font-semibold text-gray-600">{stats.ultimoPuntaje}%</span>
                  {stats.penultimoPuntaje !== null && (
                    <span> ({t('dashboard', 'before')}: {stats.penultimoPuntaje}%)</span>
                  )}
                </p>
              )}
            </div>

            {/* Ejercicios */}
            <div className="flex flex-col items-center p-5 bg-green-50 rounded-xl border border-green-100">
              <p className={`text-4xl font-black text-green-600 transition-all ${loadingStats ? 'opacity-30' : 'opacity-100'}`}>
                {stats.ejercicios}
              </p>
              <p className="text-gray-600 mt-1 text-sm font-medium">{t('dashboard', 'exercisesCompleted')}</p>
              {stats.ejercicios > 0 && (
                <p className="text-xs text-gray-400 mt-2">
                  {stats.ejercicios === 1 ? t('dashboard', 'goodStart') : stats.ejercicios < 10 ? t('dashboard', 'keepGoing') : t('dashboard', 'greatConsistency')}
                </p>
              )}
            </div>

            {/* Racha */}
            <div className="flex flex-col items-center p-5 bg-purple-50 rounded-xl border border-purple-100">
              <div className={`flex items-center gap-2 transition-all ${loadingStats ? 'opacity-30' : 'opacity-100'}`}>
                {stats.racha > 0 && <Flame className="w-7 h-7 text-orange-500" />}
                <p className="text-4xl font-black text-purple-600">{stats.racha}</p>
              </div>
              <p className="text-gray-600 mt-1 text-sm font-medium">
                {stats.racha === 1 ? t('dashboard', 'streakSingular') : t('dashboard', 'streak')}
              </p>
              <p className="text-xs text-gray-400 mt-2 text-center">
                {stats.racha === 0
                  ? t('dashboard', 'doActivityToday')
                  : stats.racha < 3
                  ? t('dashboard', 'buildStreak')
                  : stats.racha < 7
                  ? t('dashboard', 'goingWell')
                  : t('dashboard', 'incredibleConsistency')}
              </p>
            </div>

            {/* Screen Time Chronometer — clickeable para ir a Salud Visual */}
            <div
              onClick={() => onNavigate('visual-health')}
              className="flex flex-col items-center p-5 bg-orange-50 rounded-xl border border-orange-100 cursor-pointer hover:bg-orange-100 hover:shadow-md transition-all"
            >
              <div className={`flex items-center gap-2 transition-all ${loadingStats ? 'opacity-30' : 'opacity-100'}`}>
                <span
                  className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    screenTimeRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                  }`}
                />
                <p className="text-4xl font-black text-orange-600 font-mono">
                  {String(Math.floor(screenTimeMs / 3600000)).padStart(2, '0')}:
                  {String(Math.floor((screenTimeMs % 3600000) / 60000)).padStart(2, '0')}:
                  {String(Math.floor((screenTimeMs % 60000) / 1000)).padStart(2, '0')}
                </p>
              </div>
              <p className="text-gray-600 mt-1 text-sm font-medium">{t('dashboard', 'screenTimeToday')}</p>
              <p className="text-xs text-gray-400 mt-2">
                {screenTimeRunning ? t('dashboard', 'screenTimeRunning') : t('dashboard', 'screenTimePaused')}
              </p>
              <div className="flex gap-2 mt-3 flex-wrap justify-center">
                <button
                  onClick={handleTimerToggle}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-lg transition ${
                    screenTimeRunning ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {screenTimeRunning
                    ? <><Pause className="w-3.5 h-3.5" /> {t('common', 'pause')}</>
                    : <><Play  className="w-3.5 h-3.5" /> {t('common', 'start')}</>
                  }
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onNavigate('visual-health'); }}
                  className="px-3 py-1.5 bg-orange-500 text-white text-xs font-semibold rounded-lg hover:bg-orange-600 transition"
                >
                  {t('dashboard', 'goToVisualHealth')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
