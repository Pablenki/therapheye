import { useState, useEffect, useRef, useCallback } from 'react';
import DistanceMonitor from '../components/DistanceMonitor';
import CommandPalette from '../components/CommandPalette';
import ReminderConfig, { scheduleReminders } from '../components/ReminderConfig';
import {
  Home, Activity, Camera, Glasses, History, HeartPulse,
  ScanEye, ClipboardList, LogOut, Eye, BookOpen,
  KeyRound, Menu, X, ChevronLeft, ChevronDown, ScanFace, BookOpenCheck, MessageCircleHeart, Bell, MapPin, Gamepad2,
  Sparkles, BookMarked, MoreHorizontal, EarOff, Contrast,
  Timer, Orbit, BarChart2, ClipboardCheck, Palette, FlaskConical,
  Focus, ScrollText, TriangleAlert, ImageIcon, BrainCircuit, AreaChart,
  Crown, HelpCircle, Wind, Dot, Settings, Moon, LineChart,
} from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../i18n';

const GOALS_CONFIG_KEY = 'therapheye_daily_goals_config';
const AUTO_DARK_KEY    = 'therapheye_auto_dark';

const GOAL_OPTIONS = [
  { id: 'timer',       label: 'Tiempo en pantalla (>5 min)', labelEn: 'Screen time (>5 min)',    emoji: '⏱️' },
  { id: 'ejercicio',   label: 'Ejercicio terapéutico',       labelEn: 'Therapeutic exercise',    emoji: '💪' },
  { id: 'cuestionario',label: 'Cuestionario diario',         labelEn: 'Daily questionnaire',     emoji: '📋' },
  { id: 'vision',      label: 'Test de visión',              labelEn: 'Vision test',             emoji: '👓' },
  { id: 'respiracion', label: 'Respiración 4-7-8',           labelEn: '4-7-8 Breathing',         emoji: '💨' },
  { id: 'chat',        label: 'Chat IA',                     labelEn: 'AI Chat',                 emoji: '💬' },
  { id: 'diario',      label: 'Diario visual',               labelEn: 'Visual journal',          emoji: '📓' },
] as const;

type GoalId = typeof GOAL_OPTIONS[number]['id'];
const DEFAULT_GOALS: GoalId[] = ['timer', 'ejercicio', 'cuestionario'];

function loadGoalsConfig(): GoalId[] {
  try {
    const raw = localStorage.getItem(GOALS_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GoalId[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* noop */ }
  return DEFAULT_GOALS;
}

function checkGoalDone(id: GoalId, today: string): boolean {
  try {
    switch (id) {
      case 'timer': {
        const raw = localStorage.getItem('therapeye_visual_health_timer');
        if (!raw) return false;
        const s = JSON.parse(raw);
        return s.accumulatedMs > 5 * 60 * 1000;
      }
      case 'ejercicio': {
        const lastEx = Number(localStorage.getItem('therapheye_last_exercise') ?? 0);
        return lastEx > 0 && new Date(lastEx).toISOString().slice(0, 10) === today;
      }
      case 'cuestionario':
        return !!localStorage.getItem(`therapheye_questionnaire_${today}`);
      case 'vision':
        return !!localStorage.getItem(`therapheye_vision_test_${today}`);
      case 'respiracion': {
        // getWeekKey equivalent
        const d = new Date();
        const jan1 = new Date(d.getFullYear(), 0, 1);
        const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
        const wk = `${d.getFullYear()}-W${week}`;
        return Number(localStorage.getItem(`therapheye_respiracion_week_${wk}`) ?? 0) > 0;
      }
      case 'chat': {
        const d = new Date();
        const jan1 = new Date(d.getFullYear(), 0, 1);
        const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
        const wk = `${d.getFullYear()}-W${week}`;
        return Number(localStorage.getItem(`therapheye_chat_week_${wk}`) ?? 0) > 0;
      }
      case 'diario':
        return !!localStorage.getItem(`therapheye_diario_${today}`);
      default:
        return false;
    }
  } catch { return false; }
}

const PUSH_BANNER_KEY = 'therapheye_push_banner_dismissed';

type Page =
  | 'login' | 'register' | 'dashboard' | 'questionnaire' | 'exercises'
  | 'exercise-session' | 'history' | 'image-capture' | 'vision-test'
  | 'visual-health' | 'profile' | 'diagnostico-completo' | 'verify-email' | 'learn'
  | 'blink-detector' | 'reading-test' | 'chat-sintomas' | 'mapa-oftalmologos' | 'juegos-visuales'
  | 'rutinas-ia' | 'diario-visual'
  | 'campo-visual' | 'modo-zen' | 'contrast-test'
  | 'reaccion-visual' | 'vergencia' | 'carga-visual'
  | 'notas-medicas' | 'simulador' | 'test-cromatico'
  | 'test-acomodacion' | 'ejercicios-avanzados' | 'historial-ocular'
  | 'analizador-sintomas' | 'galeria-captures' | 'entrenamiento-mental' | 'estadisticas-avanzadas'
  | 'plan-premium'
  | 'dominancia-ocular' | 'respiracion-478' | 'evolucion-tests';

interface Props {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  onStartTour?: () => void;
  children: React.ReactNode;
}

type NavItem = { icon: React.ElementType; label: string; labelEn?: string; page: Page; tourId?: string };

const MAIN_NAV_ITEMS: NavItem[] = [
  { icon: Home,               label: 'Inicio',             labelEn: 'Home',             page: 'dashboard'                                 },
  { icon: Activity,           label: 'Ejercicios',          labelEn: 'Exercises',        page: 'exercises',            tourId: 'tour-exercises'    },
  { icon: Camera,             label: 'Captura de imagen',   labelEn: 'Image Capture',    page: 'image-capture'                            },
  { icon: Glasses,            label: 'Prueba de visión',    labelEn: 'Vision Test',      page: 'vision-test'                              },
  { icon: History,            label: 'Historial',           labelEn: 'History',          page: 'history',              tourId: 'tour-history'      },
  { icon: HeartPulse,         label: 'Salud Visual',        labelEn: 'Visual Health',    page: 'visual-health'                            },
  { icon: ScanEye,            label: 'Diagnóstico',         labelEn: 'Diagnostics',      page: 'diagnostico-completo', tourId: 'tour-diagnostico'  },
  { icon: ClipboardList,      label: 'Cuestionario',        labelEn: 'Questionnaire',    page: 'questionnaire',        tourId: 'tour-questionnaire'},
  { icon: MessageCircleHeart, label: 'Asistente IA',        labelEn: 'AI Assistant',     page: 'chat-sintomas',        tourId: 'tour-chat'         },
  { icon: BookOpen,           label: 'Aprende',             labelEn: 'Learn',            page: 'learn'                                    },
  { icon: ScanFace,           label: 'Parpadeo',            labelEn: 'Blink Detector',   page: 'blink-detector'                           },
];

// Feature flag: ocultar Premium de la UI
const PREMIUM_ENABLED = false;

const ADVANCED_NAV_ITEMS: NavItem[] = [
  { icon: BookOpenCheck,      label: 'Lectura Visual',      labelEn: 'Visual Reading',      page: 'reading-test'          },
  { icon: MapPin,             label: 'Oftalmólogos',        labelEn: 'Ophthalmologists',    page: 'mapa-oftalmologos'     },
  { icon: Gamepad2,           label: 'Juegos Visuales',     labelEn: 'Visual Games',        page: 'juegos-visuales'       },
  { icon: Sparkles,           label: 'Rutinas con IA',      labelEn: 'AI Routines',         page: 'rutinas-ia'            },
  { icon: BookMarked,         label: 'Diario Visual',       labelEn: 'Visual Journal',      page: 'diario-visual'         },
  // { icon: Crosshair,          label: 'Campo Visual',        labelEn: 'Visual Field',        page: 'campo-visual'          }, // HIDDEN - access disabled
  { icon: EarOff,             label: 'Modo Zen',            labelEn: 'Zen Mode',            page: 'modo-zen'              },
  { icon: Contrast,           label: 'Test Contraste',      labelEn: 'Contrast Test',       page: 'contrast-test'         },
  { icon: Timer,              label: 'Reacción Visual',     labelEn: 'Visual Reaction',     page: 'reaccion-visual'       },
  { icon: Orbit,              label: 'Vergencia',           labelEn: 'Vergence',            page: 'vergencia'             },
  { icon: BarChart2,          label: 'Carga Visual',        labelEn: 'Visual Load',         page: 'carga-visual'          },
  { icon: ClipboardCheck,     label: 'Notas Médicas',       labelEn: 'Medical Notes',       page: 'notas-medicas'         },
  { icon: Palette,            label: 'Simulador Visual',    labelEn: 'Visual Simulator',    page: 'simulador'             },
  { icon: FlaskConical,       label: 'Test Cromático',      labelEn: 'Chromatic Test',      page: 'test-cromatico'        },
  { icon: Focus,              label: 'Test Acomodación',    labelEn: 'Accommodation Test',  page: 'test-acomodacion'      },
  // { icon: Microscope,         label: 'Ejerc. Avanzados',    labelEn: 'Adv. Exercises',      page: 'ejercicios-avanzados'  }, // HIDDEN - access disabled
  { icon: ScrollText,         label: 'Historial Ocular',    labelEn: 'Ocular History',      page: 'historial-ocular'      },
  { icon: TriangleAlert,      label: 'Analizador Síntomas', labelEn: 'Symptom Analyzer',    page: 'analizador-sintomas'   },
  { icon: ImageIcon,          label: 'Galería Capturas',    labelEn: 'Capture Gallery',     page: 'galeria-captures'      },
  { icon: BrainCircuit,       label: 'Entrena. Mental',     labelEn: 'Mental Training',     page: 'entrenamiento-mental'  },
  { icon: AreaChart,          label: 'Stats Avanzadas',     labelEn: 'Advanced Stats',      page: 'estadisticas-avanzadas'},
  ...(PREMIUM_ENABLED ? [{ icon: Crown, label: 'Premium', labelEn: 'Premium', page: 'plan-premium' as Page }] : []),
  { icon: Dot,                label: 'Dom. Ocular',         labelEn: 'Eye Dominance',       page: 'dominancia-ocular'     },
  { icon: Wind,               label: 'Respiración 4-7-8',   labelEn: '4-7-8 Breathing',     page: 'respiracion-478'       },
  { icon: LineChart,          label: 'Evolución Tests',     labelEn: 'Test Evolution',      page: 'evolucion-tests'       },
];

const ADVANCED_SIDEBAR_KEY = 'therapheye_sidebar_advanced_open';

const SIDEBAR_W  = 240; // px — expanded
const ICON_W     = 64;  // px — collapsed (desktop only)

export default function AppShell({ currentPage, onNavigate, onLogout, onStartTour, children }: Props) {
  const { user, logout } = useUser();
  const { t, lang } = useLanguage();

  // Desktop: expanded by default; mobile: closed by default
  const [open, setOpen]         = useState(() => window.innerWidth >= 768);
  const [collapsed, setCollapsed] = useState(false); // desktop icon-only mode
  const [showLogout, setShowLogout] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showGoalsConfig, setShowGoalsConfig] = useState(false);
  const [showReminders, setShowReminders] = useState(false);
  const [goalsConfig, setGoalsConfig] = useState<GoalId[]>(loadGoalsConfig);
  const [autoDark, setAutoDark] = useState(() => localStorage.getItem(AUTO_DARK_KEY) === '1');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(() => {
    // Auto-expand if current page is in the advanced section
    if (ADVANCED_NAV_ITEMS.some(i => i.page === currentPage)) return true;
    try { return localStorage.getItem(ADVANCED_SIDEBAR_KEY) === '1'; } catch { return false; }
  });
  const overlayRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Daily progress (% of daily goals completed)
  const [dailyProgress, setDailyProgress] = useState(0);
  useEffect(() => {
    const calc = () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const cfg = loadGoalsConfig();
        const done = cfg.filter(id => checkGoalDone(id, today)).length;
        setDailyProgress(Math.round((done / Math.max(cfg.length, 1)) * 100));
      } catch { setDailyProgress(0); }
    };
    calc();
    const iv = setInterval(calc, 30_000);
    return () => clearInterval(iv);
  }, [goalsConfig]);

  // Modo oscuro automático (7pm–7am)
  useEffect(() => {
    if (!autoDark) return;
    const apply = () => {
      const h = new Date().getHours();
      const dark = h >= 19 || h < 7;
      const current = document.documentElement.getAttribute('data-theme') ?? '';
      if (dark && current !== 'oscuro') {
        document.documentElement.setAttribute('data-theme', 'oscuro');
        window.dispatchEvent(new CustomEvent('therapheye-theme-changed', { detail: { theme: 'oscuro' } }));
      } else if (!dark && current === 'oscuro') {
        document.documentElement.removeAttribute('data-theme');
        window.dispatchEvent(new CustomEvent('therapheye-theme-changed', { detail: { theme: 'default' } }));
      }
    };
    apply();
    const iv = setInterval(apply, 60_000);
    return () => clearInterval(iv);
  }, [autoDark]);

  // Schedule reminders on mount
  useEffect(() => { scheduleReminders(); }, []);

  // Cmd+K / Ctrl+K → Command Palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowPalette(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Distance monitor
  const [distanceMonitorActive, setDistanceMonitorActive] = useState(() => {
    try { return localStorage.getItem('therapheye_distance_monitor') === '1'; } catch { return false; }
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ active: boolean }>;
      setDistanceMonitorActive(ev.detail.active);
    };
    window.addEventListener('therapheye-distance-monitor-changed', handler);
    return () => window.removeEventListener('therapheye-distance-monitor-changed', handler);
  }, []);

  const handleCloseDistanceMonitor = useCallback(() => {
    localStorage.setItem('therapheye_distance_monitor', '0');
    setDistanceMonitorActive(false);
  }, []);

  // Push notification banner
  const [showPushBanner, setShowPushBanner] = useState(false);
  useEffect(() => {
    const dismissed = localStorage.getItem(PUSH_BANNER_KEY);
    if (dismissed) return;
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (!supported) return;
    if (Notification.permission === 'granted') return;
    // Show after 3 seconds so the page settles first
    const t = setTimeout(() => setShowPushBanner(true), 3000);
    return () => clearTimeout(t);
  }, []);

  const dismissBanner = (permanent: boolean) => {
    if (permanent) localStorage.setItem(PUSH_BANNER_KEY, '1');
    setShowPushBanner(false);
  };

  // Listen for tour requests to open sidebar
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('therapheye-open-sidebar', handler);
    return () => window.removeEventListener('therapheye-open-sidebar', handler);
  }, []);

  // Open command palette from header search button
  useEffect(() => {
    const handler = () => setShowPalette(true);
    window.addEventListener('therapheye-open-search', handler);
    return () => window.removeEventListener('therapheye-open-search', handler);
  }, []);

  // Start tour from header ? button
  useEffect(() => {
    const handler = () => onStartTour?.();
    window.addEventListener('therapheye-start-tour', handler);
    return () => window.removeEventListener('therapheye-start-tour', handler);
  }, [onStartTour]);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Track viewport for responsive behaviour
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setOpen(true); // always open sidebar when going desktop
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Auto-expand advanced section when navigating to an advanced page
  useEffect(() => {
    if (ADVANCED_NAV_ITEMS.some(i => i.page === currentPage)) {
      setShowAdvanced(true);
    }
  }, [currentPage]);

  // Close overlay on mobile when navigating
  const handleNav = (page: Page) => {
    onNavigate(page);
    if (isMobile) setOpen(false);
  };

  const toggleAdvanced = () => {
    setShowAdvanced(v => {
      const next = !v;
      try { localStorage.setItem(ADVANCED_SIDEBAR_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  };

  // Derived sidebar width
  const sideW = isMobile ? SIDEBAR_W : (collapsed ? ICON_W : SIDEBAR_W);
  const showLabels = !collapsed || isMobile;

  const confirmLogout = () => {
    setShowLogout(false);
    logout();
    onLogout();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/* ── Mobile overlay backdrop ─────────────────────────────────────── */}
      {isMobile && open && (
        <div
          ref={overlayRef}
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ══════════════════ SIDEBAR ══════════════════ */}
      <aside
        style={{ width: sideW, backgroundColor: 'var(--sidebar-bg, #0e1f47)' }}
        className={`
          fixed top-0 left-0 h-screen z-40 flex flex-col
          transition-all duration-300 ease-in-out flex-shrink-0
          ${isMobile ? (open ? 'translate-x-0 shadow-2xl' : '-translate-x-full') : 'translate-x-0'}
        `}
      >
        {/* Logo row */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 bg-indigo-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <Eye className="w-5 h-5 text-white"/>
            </div>
            {showLabels && (
              <span className="text-white font-bold text-sm leading-tight truncate">Salud Visual</span>
            )}
          </div>

          {/* Close button: mobile → X, desktop → collapse arrow */}
          {isMobile ? (
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-white transition ml-1 flex-shrink-0"
            >
              <X className="w-5 h-5"/>
            </button>
          ) : (
            <button
              onClick={() => setCollapsed(v => !v)}
              className="text-gray-400 hover:text-white transition ml-1 flex-shrink-0"
              title={collapsed ? 'Expandir' : 'Colapsar'}
            >
              <ChevronLeft
                className="w-4 h-4 transition-transform duration-300"
                style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </button>
          )}
        </div>

        {/* Daily progress bar */}
        {showLabels && (
          <div data-tour="tour-progress" className="px-4 pb-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-white/50 font-medium uppercase tracking-wide">{lang === 'en' ? "Today's progress" : 'Progreso hoy'}</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-white/70 font-bold">{dailyProgress}%</span>
                <button
                  onClick={() => setShowGoalsConfig(true)}
                  title="Configurar metas diarias"
                  className="text-white/40 hover:text-white/80 transition ml-0.5"
                >
                  <Settings className="w-3 h-3"/>
                </button>
              </div>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${dailyProgress}%`,
                  background: dailyProgress >= 100 ? '#10b981' : dailyProgress >= 50 ? '#f59e0b' : '#6366f1'
                }}
              />
            </div>
          </div>
        )}

        {/* Nav */}
        <nav data-tour="tour-nav" className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
          {/* ── Ítems principales ── */}
          {MAIN_NAV_ITEMS.map(({ icon: Icon, label, labelEn, page, tourId }) => {
            const active = currentPage === page;
            const displayLabel = lang === 'en' && labelEn ? labelEn : label;
            return (
              <button
                key={page}
                data-tour={tourId}
                onClick={() => handleNav(page)}
                title={collapsed && !isMobile ? displayLabel : undefined}
                className={`
                  w-full flex items-center gap-3 rounded-xl text-sm font-medium transition-all
                  ${collapsed && !isMobile ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'}
                  ${active
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40'
                    : 'text-gray-400 hover:bg-white/10 hover:text-white'}
                `}
              >
                <Icon style={{ width: 18, height: 18 }} className="flex-shrink-0"/>
                {showLabels && <span className="truncate">{displayLabel}</span>}
              </button>
            );
          })}

          {/* ── Toggle "Herramientas avanzadas" (solo en modo expandido) ── */}
          {showLabels && (
            <button
              onClick={toggleAdvanced}
              className="w-full flex items-center gap-2 px-3 py-2 mt-1 rounded-xl text-[11px] font-semibold uppercase tracking-widest text-gray-500 hover:bg-white/10 hover:text-gray-300 transition-all select-none"
            >
              <ChevronDown
                className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${showAdvanced ? '' : '-rotate-90'}`}
              />
              <span className="truncate">{lang === 'en' ? 'Advanced tools' : 'Herramientas avanzadas'}</span>
            </button>
          )}

          {/* ── Ítems avanzados (colapsables en expanded; siempre visibles en icon-only) ── */}
          {(showAdvanced || (!showLabels)) && ADVANCED_NAV_ITEMS.map(({ icon: Icon, label, labelEn, page, tourId }) => {
            const active = currentPage === page;
            const displayLabel = lang === 'en' && labelEn ? labelEn : label;
            return (
              <button
                key={page}
                data-tour={tourId}
                onClick={() => handleNav(page)}
                title={collapsed && !isMobile ? displayLabel : undefined}
                className={`
                  w-full flex items-center gap-3 rounded-xl text-sm font-medium transition-all
                  ${collapsed && !isMobile ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'}
                  ${active
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40'
                    : 'text-gray-400 hover:bg-white/10 hover:text-white'}
                `}
              >
                <Icon style={{ width: 18, height: 18 }} className="flex-shrink-0"/>
                {showLabels && <span className="truncate">{displayLabel}</span>}
              </button>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/10 px-2 py-3 flex-shrink-0">
          {showLabels ? (
            <>
              {/* Profile button with dropdown */}
              <div ref={profileMenuRef} className="relative">
                <button
                  onClick={() => setShowProfileMenu(v => !v)}
                  className="w-full flex items-center gap-3 hover:bg-white/10 rounded-xl px-2 py-2 transition"
                >
                  <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
                    {user?.foto_perfil
                      ? <img src={user.foto_perfil} alt="avatar" className="w-full h-full object-cover"/>
                      : <span>{user?.nombre?.charAt(0).toUpperCase() ?? '?'}</span>}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-white text-sm font-semibold truncate">
                      {user?.nombre?.split(' ').slice(0, 2).join(' ')}
                    </p>
                    <p className="text-gray-400 text-xs flex items-center gap-1">
                      <KeyRound className="w-3 h-3"/> {lang === 'en' ? 'My account' : 'Mi cuenta'}
                    </p>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${showProfileMenu ? 'rotate-180' : ''}`}
                  />
                </button>

                {/* Dropdown menu */}
                {showProfileMenu && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#1a2f5e] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-10">
                    <button
                      onClick={() => { handleNav('profile'); setShowProfileMenu(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-gray-300 hover:bg-white/10 hover:text-white transition text-left"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-indigo-400"/> {lang === 'en' ? 'View profile' : 'Ver perfil'}
                    </button>
                    <button
                      onClick={() => { setShowReminders(true); setShowProfileMenu(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-gray-300 hover:bg-white/10 hover:text-white transition text-left"
                    >
                      <Bell className="w-3.5 h-3.5 text-indigo-400"/> {lang === 'en' ? 'Reminders' : 'Recordatorios'}
                    </button>
                    <button
                      onClick={() => {
                        const next = !autoDark;
                        setAutoDark(next);
                        localStorage.setItem(AUTO_DARK_KEY, next ? '1' : '0');
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs transition text-left ${
                        autoDark ? 'text-amber-400 hover:bg-amber-500/10' : 'text-gray-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5"/> {lang === 'en' ? `Auto dark mode${autoDark ? ' (active)' : ''}` : `Modo oscuro auto${autoDark ? ' (activo)' : ''}`}
                    </button>
                    {onStartTour && (
                      <button
                        data-tour="tour-help"
                        onClick={() => { onStartTour?.(); setShowProfileMenu(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-gray-300 hover:bg-white/10 hover:text-white transition text-left"
                      >
                        <HelpCircle className="w-3.5 h-3.5 text-indigo-400"/> {lang === 'en' ? 'How to use this?' : '¿Cómo usar esto?'}
                      </button>
                    )}
                    <div className="border-t border-white/10 mx-2"/>
                    <button
                      onClick={() => { setShowLogout(true); setShowProfileMenu(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 transition text-left"
                    >
                      <LogOut className="w-3.5 h-3.5"/> {lang === 'en' ? 'Log out' : 'Cerrar sesión'}
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Collapsed: just avatar + logout icon */
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => handleNav('profile')}
                className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold overflow-hidden hover:ring-2 hover:ring-indigo-300 transition"
                title="Mi cuenta"
              >
                {user?.foto_perfil
                  ? <img src={user.foto_perfil} alt="avatar" className="w-full h-full object-cover"/>
                  : <span>{user?.nombre?.charAt(0).toUpperCase() ?? '?'}</span>}
              </button>
              <button
                onClick={() => setShowLogout(true)}
                className="text-red-400 hover:text-red-300 transition"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4"/>
              </button>
            </div>
          )}

          {/* Privacy link */}
          {showLabels && (
            <div className="px-2 pt-2 pb-1">
              <a
                href="/privacy.html"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-[10px] text-gray-500 hover:text-gray-300 transition truncate"
              >
                Política de Privacidad · © {new Date().getFullYear()} Therapheye
              </a>
            </div>
          )}
        </div>
      </aside>

      {/* ══════════════════ MAIN CONTENT ══════════════════ */}
      <div
        style={{ marginLeft: isMobile ? 0 : sideW }}
        className="flex-1 flex flex-col min-w-0 overflow-y-auto transition-all duration-300 bg-transparent"
      >
        {/* Mobile hamburger — fixed so it's always accessible */}
        {isMobile && !open && (
          <button
            onClick={() => setOpen(true)}
            className="fixed top-3 left-3 z-50 w-9 h-9 bg-[#0e1f47] rounded-xl flex items-center justify-center text-white shadow-lg"
          >
            <Menu className="w-5 h-5"/>
          </button>
        )}

        <div className={isMobile ? 'pb-16' : ''}>
          {children}
        </div>
      </div>

      {/* ── Push notification banner ────────────────────────────────────── */}
      {showPushBanner && (
        <div className="fixed top-4 right-4 z-[9999] max-w-xs w-full animate-[slideInRight_0.4s_ease]">
          <div className="bg-white rounded-2xl shadow-2xl border border-indigo-100 overflow-hidden">
            <div className="bg-indigo-600 px-4 py-2 flex items-center gap-2">
              <Bell className="w-4 h-4 text-white animate-[pulse_2s_infinite]"/>
              <span className="text-white text-xs font-semibold">{lang === 'en' ? 'Keep your visual health up to date' : 'Mantén tu salud visual al día'}</span>
            </div>
            <div className="px-4 py-3">
              <p className="text-gray-700 text-sm leading-snug">
                {lang === 'en'
                  ? <>Enable <b>push notifications</b> to receive exercise reminders and streak tracking.</>
                  : <>Activa las <b>notificaciones push</b> para recibir recordatorios de ejercicios y seguimiento de tu racha.</>}
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => { onNavigate('profile'); dismissBanner(false); }}
                  className="flex-1 bg-indigo-600 text-white text-xs font-semibold rounded-xl py-1.5 hover:bg-indigo-700 transition"
                >
                  {lang === 'en' ? 'Enable now' : 'Activar ahora'}
                </button>
                <button
                  onClick={() => dismissBanner(false)}
                  className="px-3 text-xs text-gray-500 hover:text-gray-700 transition"
                >
                  {lang === 'en' ? 'Later' : 'Luego'}
                </button>
                <button
                  onClick={() => dismissBanner(true)}
                  className="text-gray-400 hover:text-gray-600 transition"
                  title="No mostrar de nuevo"
                >
                  <X className="w-4 h-4"/>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Distance Monitor widget ────────────────────────────────────── */}
      <DistanceMonitor active={distanceMonitorActive} onClose={handleCloseDistanceMonitor} />

      {/* ══════════════════ MOBILE BOTTOM NAV ══════════════════ */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-[9000] bg-white border-t border-gray-200 flex items-center justify-around px-1 py-1 safe-area-pb shadow-[0_-2px_12px_rgba(0,0,0,0.08)]">
          {[
            { icon: Home,          page: 'dashboard'    as Page, label: lang === 'en' ? 'Home'       : 'Inicio'     },
            { icon: Activity,      page: 'exercises'    as Page, label: lang === 'en' ? 'Exercises'  : 'Ejercicios' },
            { icon: ClipboardList, page: 'questionnaire'as Page, label: 'Check'                                     },
            { icon: History,       page: 'history'      as Page, label: lang === 'en' ? 'History'    : 'Historial'  },
            { icon: MoreHorizontal,page: null           as any,  label: lang === 'en' ? 'More'       : 'Más'        },
          ].map(({ icon: Icon, page, label }) => {
            const isActive = page ? currentPage === page : false;
            const isMore = page === null;
            return (
              <button
                key={label}
                onClick={() => isMore ? setOpen(true) : (page && handleNav(page))}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[52px] ${
                  isActive
                    ? 'text-indigo-600 bg-indigo-50'
                    : isMore && open
                    ? 'text-indigo-600 bg-indigo-50'
                    : 'text-gray-500 hover:text-indigo-500'
                }`}
              >
                <Icon style={{ width: 20, height: 20 }} className="flex-shrink-0" />
                <span className="text-[9px] font-semibold leading-none">{label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* ── Command Palette ─────────────────────────────────────────────── */}
      <CommandPalette
        open={showPalette}
        onClose={() => setShowPalette(false)}
        onNavigate={(page) => { onNavigate(page as Page); if (isMobile) setOpen(false); }}
      />

      {/* ── Goals Config Modal ──────────────────────────────────────────── */}
      {showGoalsConfig && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <Settings className="w-5 h-5 text-indigo-600"/>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800">{lang === 'en' ? 'Daily goals' : 'Metas diarias'}</h3>
                  <p className="text-[11px] text-gray-400">{lang === 'en' ? 'Choose which activities count' : 'Elige qué actividades cuentan'}</p>
                </div>
              </div>
              <button onClick={() => setShowGoalsConfig(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X className="w-5 h-5"/>
              </button>
            </div>
            <div className="space-y-2 mb-4">
              {GOAL_OPTIONS.map((option) => {
                const { id, label, emoji } = option;
                const checked = goalsConfig.includes(id);
                return (
                  <button
                    key={id}
                    onClick={() => {
                      const next = checked
                        ? goalsConfig.filter(g => g !== id)
                        : [...goalsConfig, id];
                      if (next.length === 0) return; // at least 1
                      setGoalsConfig(next);
                      localStorage.setItem(GOALS_CONFIG_KEY, JSON.stringify(next));
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition text-left ${
                      checked ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 hover:border-indigo-200'
                    }`}
                  >
                    <span className="text-lg leading-none">{emoji}</span>
                    <span className={`text-sm font-medium flex-1 ${checked ? 'text-indigo-700' : 'text-gray-700'}`}>{lang === 'en' ? option.labelEn : label}</span>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      checked ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'
                    }`}>
                      {checked && <svg viewBox="0 0 10 10" className="w-2.5 h-2.5"><path d="M1.5 5l2.5 2.5L8.5 2.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-400 text-center">{lang === 'en' ? 'Progress updates every 30 seconds · Select at least 1' : 'El progreso se actualiza cada 30 segundos · Selecciona al menos 1'}</p>
          </div>
        </div>
      )}

      {/* ── Reminder Config Modal ──────────────────────────────────────── */}
      <ReminderConfig open={showReminders} onClose={() => setShowReminders(false)} />

      {/* ── Logout confirm modal ────────────────────────────────────────── */}
      {showLogout && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-7 max-w-sm w-full mx-4 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <LogOut className="w-5 h-5 text-red-600"/>
              </div>
              <h2 className="text-lg font-bold text-gray-800">{t('common','confirmLogoutTitle')}</h2>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{t('common','confirmLogoutMsg')}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowLogout(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
              >
                {t('common', 'cancel')}
              </button>
              <button
                onClick={confirmLogout}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition shadow"
              >
                {t('common', 'logout')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
