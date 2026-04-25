import { useState, useEffect, useRef } from 'react';
import {
  Home, Activity, Camera, Glasses, History, HeartPulse,
  ScanEye, ClipboardList, LogOut, Eye, BookOpen,
  KeyRound, Menu, X, ChevronLeft, ScanFace, BookOpenCheck, MessageCircleHeart, Bell,
} from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../i18n';

const PUSH_BANNER_KEY = 'therapheye_push_banner_dismissed';

type Page =
  | 'login' | 'register' | 'dashboard' | 'questionnaire' | 'exercises'
  | 'exercise-session' | 'history' | 'image-capture' | 'vision-test'
  | 'visual-health' | 'profile' | 'diagnostico-completo' | 'verify-email' | 'learn'
  | 'blink-detector' | 'reading-test' | 'chat-sintomas';

interface Props {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

const NAV_ITEMS: { icon: React.ElementType; label: string; page: Page }[] = [
  { icon: Home,          label: 'Inicio',           page: 'dashboard'           },
  { icon: Activity,      label: 'Ejercicios',        page: 'exercises'           },
  { icon: Camera,        label: 'Captura de imagen', page: 'image-capture'       },
  { icon: Glasses,       label: 'Prueba de visión',  page: 'vision-test'         },
  { icon: History,       label: 'Historial',         page: 'history'             },
  { icon: HeartPulse,    label: 'Salud Visual',      page: 'visual-health'       },
  { icon: ScanEye,       label: 'Diagnóstico',       page: 'diagnostico-completo'},
  { icon: ClipboardList, label: 'Cuestionario',      page: 'questionnaire'       },
  { icon: BookOpen,      label: 'Aprende',           page: 'learn'               },
  { icon: ScanFace,      label: 'Parpadeo',          page: 'blink-detector'      },
  { icon: BookOpenCheck,      label: 'Lectura Visual',    page: 'reading-test'        },
  { icon: MessageCircleHeart, label: 'Chat Visual',       page: 'chat-sintomas'       },
];

const SIDEBAR_W  = 240; // px — expanded
const ICON_W     = 64;  // px — collapsed (desktop only)

export default function AppShell({ currentPage, onNavigate, onLogout, children }: Props) {
  const { user, logout } = useUser();
  const { t } = useLanguage();

  // Desktop: expanded by default; mobile: closed by default
  const [open, setOpen]         = useState(() => window.innerWidth >= 768);
  const [collapsed, setCollapsed] = useState(false); // desktop icon-only mode
  const [showLogout, setShowLogout] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

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

  // Close overlay on mobile when navigating
  const handleNav = (page: Page) => {
    onNavigate(page);
    if (isMobile) setOpen(false);
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

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
          {NAV_ITEMS.map(({ icon: Icon, label, page }) => {
            const active = currentPage === page;
            return (
              <button
                key={page}
                onClick={() => handleNav(page)}
                title={collapsed && !isMobile ? label : undefined}
                className={`
                  w-full flex items-center gap-3 rounded-xl text-sm font-medium transition-all
                  ${collapsed && !isMobile ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'}
                  ${active
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40'
                    : 'text-gray-400 hover:bg-white/10 hover:text-white'}
                `}
              >
                <Icon style={{ width: 18, height: 18 }} className="flex-shrink-0"/>
                {showLabels && <span className="truncate">{label}</span>}
              </button>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/10 px-2 py-3 flex-shrink-0">
          {showLabels ? (
            <>
              <button
                onClick={() => handleNav('profile')}
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
                    <KeyRound className="w-3 h-3"/> Ver perfil
                  </p>
                </div>
              </button>
              <button
                onClick={() => setShowLogout(true)}
                className="w-full mt-1 flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 transition"
              >
                <LogOut className="w-3.5 h-3.5"/> Cerrar sesión
              </button>
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

        {children}
      </div>

      {/* ── Push notification banner ────────────────────────────────────── */}
      {showPushBanner && (
        <div className="fixed top-4 right-4 z-[9999] max-w-xs w-full animate-[slideInRight_0.4s_ease]">
          <div className="bg-white rounded-2xl shadow-2xl border border-indigo-100 overflow-hidden">
            <div className="bg-indigo-600 px-4 py-2 flex items-center gap-2">
              <Bell className="w-4 h-4 text-white animate-[pulse_2s_infinite]"/>
              <span className="text-white text-xs font-semibold">Mantén tu salud visual al día</span>
            </div>
            <div className="px-4 py-3">
              <p className="text-gray-700 text-sm leading-snug">
                Activa las <b>notificaciones push</b> para recibir recordatorios de ejercicios y seguimiento de tu racha.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => { onNavigate('profile'); dismissBanner(false); }}
                  className="flex-1 bg-indigo-600 text-white text-xs font-semibold rounded-xl py-1.5 hover:bg-indigo-700 transition"
                >
                  Activar ahora
                </button>
                <button
                  onClick={() => dismissBanner(false)}
                  className="px-3 text-xs text-gray-500 hover:text-gray-700 transition"
                >
                  Luego
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
                Cancelar
              </button>
              <button
                onClick={confirmLogout}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition shadow"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
