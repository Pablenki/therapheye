import { useEffect, useState, useRef, useCallback } from 'react';
import { THEMES, DEFAULT_THEME } from '../themes';
import type { Theme } from '../themes';
import {
  Flame, TrendingDown, TrendingUp, Minus, Bell,
  ChevronRight, ChevronLeft, Play, Pause, BookOpen, Clock,
  Activity, Camera, Glasses, HeartPulse, ScanEye, Zap, ChevronDown, Search, HelpCircle, Accessibility,
} from 'lucide-react';

// ─── Secciones colapsables ───────────────────────────────────────────────────
const COLLAPSE_KEY = 'therapheye_dashboard_collapsed';

type SectionId = 'fatiga' | 'acciones' | 'coach' | 'reto' | 'progreso' | 'timer' | 'predictor' | 'articulo' | 'tips' | 'herramientas';

const loadCollapsed = (): Record<string, boolean> => {
  const defaults: Record<string, boolean> = { herramientas: true };
  try {
    const stored = JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '{}');
    return { ...defaults, ...stored };
  } catch { return defaults; }
};

const toggleCollapsed = (id: SectionId, collapsed: Record<string, boolean>, set: (v: Record<string, boolean>) => void) => {
  const next = { ...collapsed, [id]: !collapsed[id] };
  localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next));
  set(next);
};

const SectionHeader = ({ id, label, collapsed, onToggle }: { id: SectionId; label: string; collapsed: Record<string, boolean>; onToggle: (id: SectionId) => void }) => (
  <button
    onClick={() => onToggle(id)}
    className="w-full flex items-center justify-between py-1.5 group"
  >
    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest group-hover:text-gray-600 transition">{label}</span>
    <ChevronDown className={`w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-transform duration-200 ${collapsed[id] ? '-rotate-90' : ''}`} />
  </button>
);
import { useUser } from '../context/UserContext';
import { useLanguage } from '../i18n';
import { sql } from '../neonCliente';
import { ARTICLES, CATEGORY_META } from '../data/articles';
import CoachVisualSemanal from '../components/CoachVisualSemanal';
import RetoSemanal from '../components/RetoSemanal';
import FatigaPredictor from '../components/FatigaPredictor';
import AmbientLightDetector from '../components/AmbientLightDetector';
import QuickCheck from '../components/QuickCheck';
import { getUserFocus } from '../components/OnboardingPreference';
import { useSwipe } from '../hooks/useSwipe';

const OJOS_DEL_DIA = [
  { emoji: '👁️', dato: 'El ojo humano puede distinguir hasta 10 millones de colores diferentes.' },
  { emoji: '⚡', dato: 'Un parpadeo dura entre 100 y 400 milisegundos. Parpadeamos 15-20 veces por minuto.' },
  { emoji: '🌙', dato: 'Los ojos son los órganos más activos del cuerpo. Están en movimiento incluso mientras duermes.' },
  { emoji: '🔬', dato: 'La retina tiene más de 120 millones de fotorreceptores para detectar luz y color.' },
  { emoji: '🦅', dato: 'Los ojos de un águila son 4-8 veces más potentes que los humanos. Pueden ver a 3 km de distancia.' },
  { emoji: '💤', dato: 'Durante el sueño REM, los ojos se mueven porque el cerebro está procesando sueños visualmente.' },
  { emoji: '🌊', dato: 'Las lágrimas tienen 3 capas: lipídica, acuosa y mucosa. Cada una tiene una función diferente.' },
  { emoji: '🧬', dato: 'El iris tiene más de 200 características únicas, más del doble que una huella dactilar.' },
  { emoji: '📐', dato: 'El punto ciego existe donde el nervio óptico sale del ojo. Tu cerebro lo "rellena" automáticamente.' },
  { emoji: '🎨', dato: 'Los daltonismos afectan al 8% de los hombres y al 0.5% de las mujeres a nivel mundial.' },
  { emoji: '🔭', dato: 'El ojo puede detectar una vela a 48 km de distancia en completa oscuridad.' },
  { emoji: '💊', dato: 'Las zanahorias realmente ayudan: contienen betacaroteno que el cuerpo convierte en vitamina A.' },
  { emoji: '🖥️', dato: 'La fatiga digital (CVS) afecta al 90% de las personas que trabajan frente a pantallas más de 3h.' },
  { emoji: '🏃', dato: 'Los músculos oculares son los más activos del cuerpo, con 100,000 movimientos por día.' },
  { emoji: '🌿', dato: 'La luteína, presente en espinacas y huevo, actúa como filtro solar natural para la retina.' },
];

const TIPS_DEL_DIA = [
  { emoji: '💧', tip: 'Parpadea conscientemente cada 20 segundos. La pantalla reduce la tasa de parpadeo a la mitad.' },
  { emoji: '📏', tip: 'Mantén la pantalla a 50-70 cm de tus ojos. Si la acercas, tus músculos oculares trabajan el doble.' },
  { emoji: '☀️', tip: 'Ajusta el brillo de la pantalla para que sea similar al del entorno. Demasiado contraste fatiga.' },
  { emoji: '🌿', tip: 'La regla 20-20-20: cada 20 min, mira algo a 6 metros por 20 segundos.' },
  { emoji: '💤', tip: 'Dormir 7-8 horas permite que tus ojos se recuperen y se hidraten naturalmente.' },
  { emoji: '🥤', tip: 'La deshidratación causa ojo seco. Toma agua regularmente durante el día.' },
  { emoji: '🌙', tip: 'Activa el modo oscuro/nocturno en tu pantalla después de las 6pm para reducir la luz azul.' },
  { emoji: '🏃', tip: 'Ejercicio cardiovascular mejora la circulación ocular. 30 min diarios hacen diferencia.' },
  { emoji: '🥦', tip: 'La luteína y zeaxantina (en verduras verdes) protegen la mácula de la luz azul.' },
  { emoji: '👁', tip: 'Los ojos también necesitan "calentamiento". Los ejercicios oculares mejoran la acomodación.' },
];

const TIPS_DEL_DIA_EN = [
  { emoji: '💧', tip: 'Blink consciously every 20 seconds. Screens reduce your blink rate by half.' },
  { emoji: '📏', tip: 'Keep the screen 50–70 cm from your eyes. Closer means your eye muscles work twice as hard.' },
  { emoji: '☀️', tip: 'Adjust screen brightness to match your surroundings. Too much contrast causes fatigue.' },
  { emoji: '🌿', tip: 'The 20-20-20 rule: every 20 min, look at something 6 meters away for 20 seconds.' },
  { emoji: '💤', tip: 'Sleeping 7–8 hours lets your eyes recover and stay naturally hydrated.' },
  { emoji: '🥤', tip: 'Dehydration causes dry eye. Drink water regularly throughout the day.' },
  { emoji: '🌙', tip: 'Enable dark/night mode on your screen after 6pm to reduce blue light exposure.' },
  { emoji: '🏃', tip: 'Cardiovascular exercise improves ocular circulation. 30 minutes a day makes a difference.' },
  { emoji: '🥦', tip: 'Lutein and zeaxanthin (in green vegetables) protect the macula from blue light.' },
  { emoji: '👁', tip: 'Eyes need a "warm-up" too. Eye exercises improve accommodation and reduce strain.' },
];

const OJOS_DEL_DIA_EN = [
  { emoji: '👁️', dato: 'The human eye can distinguish up to 10 million different colors.' },
  { emoji: '⚡', dato: 'A blink lasts between 100 and 400 milliseconds. We blink 15–20 times per minute.' },
  { emoji: '🌙', dato: 'Eyes are the most active organs in the body — they move even while you sleep.' },
  { emoji: '🔬', dato: 'The retina has over 120 million photoreceptors to detect light and color.' },
  { emoji: '🦅', dato: "An eagle's eyes are 4–8× more powerful than ours. They can see up to 3 km away." },
  { emoji: '💤', dato: 'During REM sleep, your eyes move because the brain is processing dreams visually.' },
  { emoji: '🌊', dato: 'Tears have 3 layers: lipid, aqueous, and mucin. Each one has a different function.' },
  { emoji: '🧬', dato: 'The iris has over 200 unique features — more than twice as many as a fingerprint.' },
  { emoji: '📐', dato: 'The blind spot is where the optic nerve exits the eye. Your brain automatically "fills it in".' },
  { emoji: '🎨', dato: 'Color blindness affects 8% of men and 0.5% of women worldwide.' },
  { emoji: '🔭', dato: 'The eye can detect a candle flame from 48 km away in complete darkness.' },
  { emoji: '💊', dato: 'Carrots really do help: they contain beta-carotene that the body converts to vitamin A.' },
  { emoji: '🖥️', dato: 'Digital eye strain (CVS) affects 90% of people who work in front of screens for more than 3 hours.' },
  { emoji: '🏃', dato: 'Eye muscles are the most active in the body, making 100,000 movements per day.' },
  { emoji: '🌿', dato: 'Lutein, found in spinach and eggs, acts as a natural sunscreen for your retina.' },
];

type Page =
  | 'login' | 'register' | 'dashboard' | 'questionnaire' | 'exercises'
  | 'exercise-session' | 'history' | 'image-capture' | 'vision-test'
  | 'visual-health' | 'profile' | 'diagnostico-completo' | 'learn'
  | 'blink-detector' | 'reading-test' | 'chat-sintomas' | 'mapa-oftalmologos' | 'juegos-visuales'
  | 'rutinas-ia' | 'diario-visual'
  | 'campo-visual' | 'modo-zen' | 'contrast-test'
  | 'reaccion-visual' | 'vergencia' | 'carga-visual'
  | 'notas-medicas' | 'simulador' | 'test-cromatico'
  | 'test-acomodacion' | 'ejercicios-avanzados' | 'historial-ocular'
  | 'analizador-sintomas' | 'entrenamiento-mental' | 'estadisticas-avanzadas'
  | 'plan-premium'
  | 'dominancia-ocular' | 'respiracion-478' | 'evolucion-tests';

interface Stats {
  evaluaciones: number;
  ejercicios: number;
  racha: number;
  tendencia: 'mejorando' | 'empeorando' | 'estable' | null;
  ultimoPuntaje: number | null;
  penultimoPuntaje: number | null;
}

interface WeekDay {
  label: string;
  score: number | null;
  active: boolean;
  dateKey: string;
}

interface DiagEntry {
  fecha: string;
  nivel: string;
  score: number;
  color: string;
}

// ─── Racha ────────────────────────────────────────────────────────────────────
const calcularRacha = (fechas: string[]): number => {
  if (fechas.length === 0) return 0;
  const diasUnicos = [...new Set(
    fechas.map(f => {
      const d = new Date(f.includes('Z') || f.includes('+') ? f : f.replace(' ', 'T') + 'Z');
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    })
  )].sort().reverse();
  if (diasUnicos.length === 0) return 0;
  const hoy = new Date();
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const hoyKey  = key(hoy);
  const ayer    = new Date(hoy); ayer.setDate(ayer.getDate()-1);
  const ayerKey = key(ayer);
  if (diasUnicos[0] !== hoyKey && diasUnicos[0] !== ayerKey) return 0;
  let racha = 0, esperado = diasUnicos[0];
  for (const dia of diasUnicos) {
    if (dia === esperado) {
      racha++;
      const p = new Date(esperado); p.setDate(p.getDate()-1);
      esperado = key(p);
    } else break;
  }
  return racha;
};

// ─── Nivel de fatiga ──────────────────────────────────────────────────────────
const getFatigaInfo = (score: number | null, lang: string) => {
  const en = lang === 'en';
  if (score === null) return { label: en ? 'No data'      : 'Sin datos',    color: '#6366f1', bg: 'from-indigo-400 to-violet-500', textClass: 'text-gray-400' };
  if (score < 25)  return { label: en ? 'Mild'           : 'Leve',          color: '#16a34a', bg: 'from-emerald-400 to-teal-500',   textClass: 'text-emerald-600' };
  if (score < 50)  return { label: en ? 'Moderate'       : 'Moderada',      color: '#ca8a04', bg: 'from-amber-400 to-orange-500',   textClass: 'text-amber-600'   };
  if (score < 75)  return { label: en ? 'Considerable'   : 'Considerable',  color: '#ea580c', bg: 'from-orange-500 to-red-500',     textClass: 'text-orange-600'  };
  return             { label: en ? 'Severe'             : 'Severa',         color: '#dc2626', bg: 'from-red-500 to-rose-600',       textClass: 'text-red-600'     };
};

const getDiagColor = (score: number, lang: string) => {
  const en = lang === 'en';
  if (score < 25)  return { dot: 'bg-emerald-400', text: 'text-emerald-600', label: en ? 'Mild fatigue'         : 'Fatiga leve'       };
  if (score < 50)  return { dot: 'bg-amber-400',   text: 'text-amber-600',   label: en ? 'Moderate fatigue'    : 'Fatiga moderada'   };
  if (score < 75)  return { dot: 'bg-orange-500',  text: 'text-orange-600',  label: en ? 'High fatigue'        : 'Fatiga alta'       };
  return             { dot: 'bg-red-500',    text: 'text-red-600',     label: en ? 'Severe fatigue'      : 'Fatiga severa'    };
};

// ─── Mini gráfica semanal SVG (estilo mercado con tooltip) ───────────────────
const WeeklyChart = ({ data }: { data: WeekDay[] }) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const W = 400, H = 100;
  const PAD = { top: 12, right: 12, bottom: 20, left: 12 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const points = data.filter(d => d.score !== null);
  if (points.length < 2) return (
    <div className="flex items-center justify-center h-24 text-gray-300 text-sm">Sin datos esta semana</div>
  );
  const toX = (i: number) => PAD.left + (i / (data.length - 1)) * cW;
  const toY = (v: number) => PAD.top + cH - (v / 100) * cH;
  const dotColor = (v: number) => v < 25 ? '#16a34a' : v < 50 ? '#ca8a04' : v < 75 ? '#ea580c' : '#dc2626';

  const linePts = data.map((d, i) => d.score !== null ? { x: toX(i), y: toY(d.score), score: d.score, label: d.label } : null).filter(Boolean) as {x:number;y:number;score:number;label:string}[];
  // Smooth path using cubic bezier
  const smoothPath = linePts.map((p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = linePts[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `C ${cx} ${prev.y} ${cx} ${p.y} ${p.x} ${p.y}`;
  }).join(' ');
  const areaPath = linePts.length > 0
    ? `${smoothPath} L ${linePts[linePts.length-1].x} ${PAD.top+cH} L ${linePts[0].x} ${PAD.top+cH} Z`
    : '';

  const hoveredPoint = hovered !== null ? linePts[hovered] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="wkGrad2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.18"/>
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.01"/>
          </linearGradient>
        </defs>
        {/* Subtle horizontal grid — sin labels */}
        {[25,50,75].map(v => (
          <line key={v} x1={PAD.left} y1={toY(v)} x2={PAD.left+cW} y2={toY(v)} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3"/>
        ))}
        <path d={areaPath} fill="url(#wkGrad2)"/>
        <path d={smoothPath} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        {/* Hover line */}
        {hoveredPoint && (
          <line x1={hoveredPoint.x} y1={PAD.top} x2={hoveredPoint.x} y2={PAD.top+cH} stroke="#6366f1" strokeWidth="1" strokeDasharray="3 3" opacity="0.5"/>
        )}
        {/* Day labels */}
        {data.map((d, i) => (
          <text key={i} x={toX(i)} y={H - 4} textAnchor="middle" fontSize="8" fill={hovered === i ? '#6366f1' : '#cbd5e1'} fontWeight={hovered === i ? 'bold' : 'normal'}>
            {d.label}
          </text>
        ))}
        {/* Hit areas + dots */}
        {data.map((d, i) => {
          if (d.score === null) return null;
          const x = toX(i), y = toY(d.score);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={hovered === i ? 6 : 4} fill={dotColor(d.score)} stroke="white" strokeWidth={hovered === i ? 2 : 1.5} style={{ transition: 'r 0.15s' }}/>
              {/* Invisible large hit area */}
              <circle cx={x} cy={y} r={18} fill="transparent"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onTouchStart={() => setHovered(i)}
                onTouchEnd={() => setHovered(null)}
                style={{ cursor: 'crosshair' }}
              />
            </g>
          );
        })}
      </svg>
      {/* Tooltip */}
      {hoveredPoint && (
        <div
          className="absolute pointer-events-none z-10 bg-gray-900/90 text-white text-xs rounded-lg px-2.5 py-1.5 shadow-lg"
          style={{
            left: `${(hoveredPoint.x / W) * 100}%`,
            top: `${(hoveredPoint.y / H) * 100}%`,
            transform: 'translate(-50%, -130%)',
            whiteSpace: 'nowrap',
          }}
        >
          <span className="font-bold">{hoveredPoint.label}</span>
          <span className="mx-1.5 text-gray-400">·</span>
          <span style={{ color: dotColor(hoveredPoint.score) }}>{hoveredPoint.score}% fatiga</span>
        </div>
      )}
    </div>
  );
};

// ─── Gauge circular ────────────────────────────────────────────────────────────
const FatigaGauge = ({ score }: { score: number }) => {
  const r = 36, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score < 25 ? '#16a34a' : score < 50 ? '#f59e0b' : score < 75 ? '#ea580c' : '#dc2626';
  return (
    <div className="relative w-24 h-24 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="rgba(255,255,255,0.15)" strokeWidth="8" stroke="rgba(255,255,255,0.2)"/>
        <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{filter:'drop-shadow(0 0 6px rgba(255,255,255,0.5))'}}/>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-white text-xl font-black leading-none">{score}%</span>
        <span className="text-white/70 text-[9px] font-medium leading-none mt-0.5">Nivel</span>
      </div>
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────
// ── Hook local: lee el tema desde localStorage y se actualiza al cambiar ──────
const useTheme = () => {
  const read = useCallback((): Theme => {
    try {
      const s = localStorage.getItem('therapeye_accessibility_settings');
      return s ? (JSON.parse(s).theme as Theme) || DEFAULT_THEME : DEFAULT_THEME;
    } catch { return DEFAULT_THEME; }
  }, []);

  const [theme, setTheme] = useState<Theme>(read);

  useEffect(() => {
    const handler = () => setTheme(read());
    window.addEventListener('therapheye-theme-changed', handler);
    return () => window.removeEventListener('therapheye-theme-changed', handler);
  }, [read]);

  return THEMES[theme] ?? THEMES[DEFAULT_THEME];
};

const Dashboard = ({ onNavigate }: { onNavigate: (page: Page) => void }) => {
  const { user } = useUser();
  const { lang } = useLanguage();
  const tc = useTheme(); // theme config

  const [stats, setStats] = useState<Stats>({
    evaluaciones: 0, ejercicios: 0, racha: 0,
    tendencia: null, ultimoPuntaje: null, penultimoPuntaje: null,
  });
  const [weekData, setWeekData]     = useState<WeekDay[]>([]);
  const [diagList, setDiagList]     = useState<DiagEntry[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [showQuickCheck, setShowQuickCheck] = useState(false);
  const [showStreakCelebration, setShowStreakCelebration] = useState(false);
  const [tipIndex] = useState(() => new Date().getDate() % TIPS_DEL_DIA.length);
  const [screenTimeMs, setScreenTimeMs]     = useState(0);
  const [screenTimeRunning, setScreenTimeRunning] = useState(false);
  const [articleIdx, setArticleIdx]     = useState(() => Math.floor(Math.random() * ARTICLES.length));
  const [articleFading, setArticleFading] = useState(false);
  const articleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [extensionInstalled, setExtensionInstalled] = useState(false);
  const [timerSource, setTimerSource] = useState<'ext' | 'web'>('web');
  const extensionDismissed = localStorage.getItem('therapheye_ext_banner_dismissed') === 'true';
  const [pwaPrompt, setPwaPrompt] = useState<Event & { prompt?: () => void } | null>(null);
  const [pwaInstalled, setPwaInstalled] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [showNotif, setShowNotif] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed);
  const handleToggle = useCallback((id: SectionId) => toggleCollapsed(id, collapsed, setCollapsed), [collapsed]);

  // ── Herramientas avanzadas carousel ───────────────────────────────────────
  const [toolIdx, setToolIdx] = useState(0);
  const toolTouchX = useRef(0);
  const TOOLS_COUNT = 9; // fixed — matches allTools array below
  // autoplayKey: bump para reiniciar el interval; autoplayDelay: delay del siguiente cambio
  const [toolAutoKey, setToolAutoKey] = useState(0);
  const [toolAutoDelay, setToolAutoDelay] = useState(4000);
  useEffect(() => {
    if (collapsed['herramientas']) return;
    const id = setInterval(() => {
      setToolIdx(i => (i + 1) % TOOLS_COUNT);
      setToolAutoDelay(4000); // volver a intervalo normal después del auto-avance
    }, toolAutoDelay);
    return () => clearInterval(id);
  }, [collapsed, toolAutoKey, toolAutoDelay]);

  const extensionUrl = 'https://chromewebstore.google.com/detail/therapheye-%E2%80%93-screen-time/lephmmimjeeeknpgdmnhpjkbbnmplcal';

  // Detectar extensión
  useEffect(() => {
    const EXT_ID = 'lephmmimjeeeknpgdmnhpjkbbnmplcal';
    // Método 1: localStorage seteado por content.js (más confiable)
    if (localStorage.getItem('therapheye_ext_installed') === '1') { setExtensionInstalled(true); return; }
    // Método 2: atributo en el HTML
    if (document.documentElement.hasAttribute('data-therapheye-ext')) { setExtensionInstalled(true); return; }
    // Método 3: cargar recurso de la extensión
    const img = new Image();
    img.onload = () => setExtensionInstalled(true);
    img.src = `chrome-extension://${EXT_ID}/icons/icon16.png`;
    // Método 4: escuchar el evento de sync del content script
    const onSync = () => setExtensionInstalled(true);
    window.addEventListener('therapheye-ext-sync', onSync);
    const obs = new MutationObserver(() => {
      if (document.documentElement.hasAttribute('data-therapheye-ext')) { setExtensionInstalled(true); obs.disconnect(); }
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-therapheye-ext'] });
    return () => { obs.disconnect(); img.onload = null; window.removeEventListener('therapheye-ext-sync', onSync); };
  }, []);

  // PWA install prompt
  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setPwaPrompt(e as any); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setPwaInstalled(true));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Cerrar notif al click fuera
  useEffect(() => {
    const h = (e: MouseEvent) => { if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ── Timer ──────────────────────────────────────────────────────────────────
  const TIMER_STORAGE_KEY = 'therapeye_visual_health_timer';
  const TIMER_MAX_MS      = 16 * 60 * 60 * 1000;
  const TIMER_WORK_MINUTES = 20;
  type DashTimerState = { isRunning: boolean; startTimestamp: number | null; accumulatedMs: number; nextBreakAtMs: number | null; sessionStartTimestamp: number | null; finalized?: boolean; stateDate?: string | null };
  const readTimerState = (): DashTimerState => { try { const r = localStorage.getItem(TIMER_STORAGE_KEY); return r ? JSON.parse(r) : { isRunning: false, startTimestamp: null, accumulatedMs: 0, nextBreakAtMs: null, sessionStartTimestamp: null }; } catch { return { isRunning: false, startTimestamp: null, accumulatedMs: 0, nextBreakAtMs: null, sessionStartTimestamp: null }; } };
  const calcTimerMs = (s: DashTimerState) => { let ms = s.accumulatedMs; if (s.isRunning && s.startTimestamp) { const d = Date.now()-s.startTimestamp; if (d>0&&d<TIMER_MAX_MS) ms+=d; } return Math.max(0,Math.min(ms,TIMER_MAX_MS)); };

  const handleTimerToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const st = readTimerState(), now = Date.now();
    const d = new Date(), today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    let ns: DashTimerState;
    if (st.isRunning) {
      ns = { ...st, isRunning: false, startTimestamp: null, accumulatedMs: calcTimerMs(st) };
    } else {
      const ms = st.accumulatedMs;
      ns = { ...st, isRunning: true, startTimestamp: now, accumulatedMs: ms, sessionStartTimestamp: st.sessionStartTimestamp ?? now, nextBreakAtMs: ms + TIMER_WORK_MINUTES*60_000, finalized: false, stateDate: today };
    }
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(ns));
    if (user?.id) {
      sql`INSERT INTO timer_state (user_id,fecha,accumulated_ms,is_running,last_start_ts,session_start_ts,next_break_at_ms,finalized,updated_at) VALUES (${user.id},${today},${ns.accumulatedMs},${ns.isRunning},${ns.startTimestamp},${ns.sessionStartTimestamp},${ns.nextBreakAtMs},${ns.finalized??false},NOW()) ON CONFLICT (user_id,fecha) DO UPDATE SET accumulated_ms=${ns.accumulatedMs},is_running=${ns.isRunning},last_start_ts=${ns.startTimestamp},session_start_ts=${ns.sessionStartTimestamp},next_break_at_ms=${ns.nextBreakAtMs},finalized=${ns.finalized??false},updated_at=NOW()`.catch(()=>{});
    }
  };

  useEffect(() => {
    const load = () => {
      // Priorizar extensión si está instalada y tiene datos de hoy
      const extInstalled = localStorage.getItem('therapheye_ext_installed') === '1';
      if (extInstalled) {
        try {
          const raw = localStorage.getItem('therapeye_ext_timer');
          if (raw) {
            const ext = JSON.parse(raw);
            const _d = new Date();
            const today = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`;
            if (ext.stateDate === today) {
              let ms = Number(ext.accumulatedMs) || 0;
              if (ext.isRunning && ext.startTimestamp) {
                const delta = Date.now() - Number(ext.startTimestamp);
                if (delta > 0 && delta < TIMER_MAX_MS) ms += delta;
              }
              setScreenTimeMs(Math.max(0, Math.min(ms, TIMER_MAX_MS)));
              setScreenTimeRunning(ext.isRunning === true);
              setTimerSource('ext');
              return;
            }
          }
        } catch {}
      }
      // Fallback: timer web
      const s = readTimerState();
      setScreenTimeMs(calcTimerMs(s));
      setScreenTimeRunning(s.isRunning);
      setTimerSource('web');
    };
    load(); const iv = setInterval(load, 1000); return () => clearInterval(iv);
  }, []);

  // Rotar artículo cada 25 segundos con fade
  const goToArticle = (idx: number) => {
    setArticleFading(true);
    setTimeout(() => { setArticleIdx(idx); setArticleFading(false); }, 320);
  };
  const nextArticle = () => goToArticle((articleIdx + 1) % ARTICLES.length);
  const prevArticle = () => goToArticle((articleIdx - 1 + ARTICLES.length) % ARTICLES.length);
  const articleSwipe = useSwipe(nextArticle, prevArticle);

  useEffect(() => {
    articleIntervalRef.current = setInterval(nextArticle, 18_000);
    return () => { if (articleIntervalRef.current) clearInterval(articleIntervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleIdx]);

  // ── Stats + datos semanales + últimos diagnósticos ─────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const fetch = async () => {
      setLoadingStats(true);
      try {
        const [evalRows, exRows, actRows, weekRows, diagRows, exWeekRows] = await Promise.all([
          sql`SELECT puntaje_fatiga, created_at FROM respuestas_cuestionario WHERE user_id=${user.id} ORDER BY created_at DESC LIMIT 2`,
          sql`SELECT COUNT(*) AS total FROM historial_ejercicios WHERE user_id=${user.id} AND status='completed'`,
          sql`SELECT created_at FROM historial_ejercicios WHERE user_id=${user.id} UNION ALL SELECT created_at FROM respuestas_cuestionario WHERE user_id=${user.id}`,
          sql`SELECT DATE(created_at AT TIME ZONE 'America/Mexico_City') as dia, AVG(puntaje_fatiga) as avg_score FROM respuestas_cuestionario WHERE user_id=${user.id} AND created_at >= NOW()-INTERVAL '7 days' GROUP BY dia ORDER BY dia`,
          sql`SELECT score_final, nivel, created_at FROM diagnostico_completo WHERE user_id=${user.id} ORDER BY created_at DESC LIMIT 3`.catch(()=>[]),
          sql`SELECT DATE(created_at AT TIME ZONE 'America/Mexico_City') as dia FROM historial_ejercicios WHERE user_id=${user.id} AND status='completed' AND created_at >= NOW()-INTERVAL '7 days' GROUP BY dia`,
        ]);

        const evaluaciones = evalRows.length;
        const ejercicios   = Number(exRows[0]?.total ?? 0);
        const racha        = calcularRacha(actRows.map((r:any)=>String(r.created_at)));
        let tendencia: Stats['tendencia'] = null, ultimoPuntaje: number|null = null, penultimoPuntaje: number|null = null;
        if (evalRows.length >= 2) {
          ultimoPuntaje = Number(evalRows[0].puntaje_fatiga); penultimoPuntaje = Number(evalRows[1].puntaje_fatiga);
          const diff = ultimoPuntaje - penultimoPuntaje;
          tendencia = diff <= -5 ? 'mejorando' : diff >= 5 ? 'empeorando' : 'estable';
        } else if (evalRows.length === 1) { ultimoPuntaje = Number(evalRows[0].puntaje_fatiga); }
        setStats({ evaluaciones, ejercicios, racha, tendencia, ultimoPuntaje, penultimoPuntaje });
        // Celebrar hitos de racha
        const milestones = [3, 7, 14, 30, 60, 100];
        const lastCelebrated = Number(localStorage.getItem('therapheye_last_celebrated_racha') ?? 0);
        if (milestones.includes(racha) && racha !== lastCelebrated) {
          localStorage.setItem('therapheye_last_celebrated_racha', String(racha));
          setTimeout(() => { setShowStreakCelebration(true); setTimeout(() => setShowStreakCelebration(false), 5000); }, 800);
        }

        // Semana: Lun-Dom
        const diasLabels = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
        const scoreMap: Record<string,number> = {};
        weekRows.forEach((r:any) => { scoreMap[String(r.dia).slice(0,10)] = Math.round(Number(r.avg_score)); });
        const exWeekSet = new Set((exWeekRows as any[]).map((r:any) => String(r.dia).slice(0,10)));
        const today = new Date();
        const week: WeekDay[] = diasLabels.map((label, i) => {
          const d = new Date(today); d.setDate(d.getDate() - (today.getDay()===0?6:today.getDay()-1) + i);
          const dk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          const score = scoreMap[dk] ?? null;
          return { label, score, active: score !== null || exWeekSet.has(dk), dateKey: dk };
        });
        setWeekData(week);

        // Últimos diagnósticos
        const diags: DiagEntry[] = (diagRows as any[]).map((r:any) => {
          const d = new Date(r.created_at);
          const score = Math.round(Number(r.score_final));
          const info  = getDiagColor(score, lang);
          return {
            fecha: d.toLocaleString('es-MX',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}),
            nivel: info.label, score, color: info.text,
          };
        });
        if (diags.length === 0 && evalRows.length > 0) {
          // Fallback: usar últimas evaluaciones del cuestionario
          const fb = await sql`SELECT puntaje_fatiga, created_at FROM respuestas_cuestionario WHERE user_id=${user.id} ORDER BY created_at DESC LIMIT 3`;
          fb.forEach((r:any) => {
            const d = new Date(r.created_at), score = Math.round(Number(r.puntaje_fatiga));
            const info = getDiagColor(score, lang);
            diags.push({ fecha: d.toLocaleString('es-MX',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}), nivel: info.label, score, color: info.text });
          });
        }
        setDiagList(diags);
      } catch(e) { console.error('[Dashboard]',e); }
      finally { setLoadingStats(false); }
    };
    fetch();
  }, [user?.id]);


  const fatiga      = getFatigaInfo(stats.ultimoPuntaje, lang);
  const screenHH    = String(Math.floor(screenTimeMs/3600000)).padStart(2,'0');
  const screenMM    = String(Math.floor((screenTimeMs%3600000)/60000)).padStart(2,'0');
  const screenSS    = String(Math.floor((screenTimeMs%60000)/1000)).padStart(2,'0');

  const es = lang === 'es';
  const userFocus = getUserFocus();

  // Recomendación basada en nivel de fatiga
  const getRecomendacion = () => {
    const s = stats.ultimoPuntaje;
    if (s === null) return { titulo: es ? 'Completa tu primera evaluación' : 'Complete your first assessment', desc: es ? 'Responde el cuestionario para comenzar el seguimiento' : 'Answer the questionnaire to start tracking', icon:'📋', page:'questionnaire' as Page };
    if (s < 25)    return { titulo: es ? '¡Excelente! Mantén el ritmo' : 'Excellent! Keep it up',    desc: es ? 'Continúa con tus ejercicios visuales diarios' : 'Continue with your daily visual exercises', icon:'🌟', page:'exercises' as Page };
    if (s < 50)    return { titulo: es ? 'Ejercicios de relajación' : 'Relaxation exercises',        desc: es ? 'Ideal para reducir la fatiga acumulada' : 'Ideal to reduce accumulated fatigue', icon:'🧘', page:'exercises' as Page };
    if (s < 75)    return { titulo: es ? 'Realiza el diagnóstico completo' : 'Run the full diagnostic', desc: es ? 'Tu nivel de fatiga requiere atención pronto' : 'Your fatigue level requires attention soon', icon:'🔍', page:'diagnostico-completo' as Page };
    return           { titulo: es ? 'Consulta urgente recomendada' : 'Urgent consultation recommended',          desc: es ? 'Nivel severo — considera ver a un especialista' : 'Severe level — consider seeing a specialist', icon:'⚠️', page:'diagnostico-completo' as Page };
  };
  const rec = getRecomendacion();

  // Días de la semana para la racha
  const rachaWeek = (() => {
    const dias = es ? ['L','M','M','J','V','S','D'] : ['M','T','W','T','F','S','S'];
    return dias.map((d, i) => {
      const date = new Date(); date.setDate(date.getDate() - (date.getDay()===0?6:date.getDay()-1) + i);
      const dk = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
      const active = weekData.find(w=>w.dateKey===dk)?.active ?? false;
      return { d, active, today: dk === new Date().toISOString().slice(0,10) };
    });
  })();

  return (
    <>
    <div className={`flex flex-col h-screen overflow-hidden bg-gradient-to-br ${tc.dashBg}`}>

        {/* Top bar */}
        <header className={`${tc.headerBg} px-6 py-3.5 flex items-center justify-between flex-shrink-0`}>
          <div>
            <h1 className={`text-xl font-bold ${tc.headerText}`}>
              {es ? `¡Bienvenido de nuevo, ${user?.nombre?.split(' ')[0]}! 👋` : `Welcome back, ${user?.nombre?.split(' ')[0]}! 👋`}
            </h1>
            <p className={`text-xs mt-0.5 ${tc.headerSubtext}`}>{es ? 'Cuida tu vista, mejora tu día a día.' : 'Take care of your vision, improve your day.'}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Quick Check button */}
            <button
              onClick={() => setShowQuickCheck(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition shadow-sm"
            >
              <Zap className="w-3.5 h-3.5" /> Check rápido
            </button>
            {/* Ambient light detector badge */}
            <AmbientLightDetector />
            {/* PWA install badge */}
            {pwaPrompt && !pwaInstalled && (
              <button
                onClick={async () => { (pwaPrompt as any).prompt?.(); setPwaPrompt(null); }}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 hover:bg-emerald-100 transition"
              >
                📲 {es ? 'Instalar app' : 'Install app'}
              </button>
            )}
            {/* Extensión badge */}
            {!extensionInstalled && !extensionDismissed && (
              <a href={extensionUrl} target="_blank" rel="noopener noreferrer"
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-lg border border-indigo-200 hover:bg-indigo-100 transition">
                🧩 {es ? 'Agregar extensión' : 'Add extension'}
              </a>
            )}
            {/* Help icon with tooltip */}
            <div className="relative group">
              <button
                onClick={() => window.dispatchEvent(new Event('therapheye-start-tour'))}
                className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition"
              >
                <HelpCircle style={{ width: 18, height: 18 }} className="text-gray-500"/>
              </button>
              <span className="absolute right-0 top-full mt-1.5 bg-gray-800 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-50 shadow-lg">
                {es ? '¿Cómo usar esto?' : 'How to use this?'}
              </span>
            </div>

            {/* Accessibility button */}
            <div className="relative group">
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('therapheye-open-accessibility'))}
                className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition"
              >
                <Accessibility style={{ width: 18, height: 18 }} className="text-gray-500"/>
              </button>
              <span className="absolute right-0 top-full mt-1.5 bg-gray-800 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-50 shadow-lg">
                {es ? 'Accesibilidad' : 'Accessibility'}
              </span>
            </div>

            {/* Search button */}
            <button
              onClick={() => window.dispatchEvent(new Event('therapheye-open-search'))}
              className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition"
              title={es ? 'Buscar herramienta' : 'Search tool'}
            >
              <Search style={{ width: 18, height: 18 }} className="text-gray-500"/>
            </button>

            {/* Bell */}
            <div className="relative" ref={notifRef}>
              <button onClick={()=>setShowNotif(v=>!v)}
                className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition relative">
                <Bell className="w-4.5 h-4.5 text-gray-500" style={{width:'18px',height:'18px'}}/>
                {stats.ultimoPuntaje !== null && stats.ultimoPuntaje >= 50 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500"/>
                )}
              </button>
              {showNotif && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-blue-100 p-4 z-50">
                  <p className="text-sm font-bold text-gray-800 mb-3">{es ? 'Notificaciones' : 'Notifications'}</p>
                  {stats.ultimoPuntaje !== null && stats.ultimoPuntaje >= 50
                    ? <div className="flex gap-2 text-sm text-orange-700 bg-orange-50 rounded-lg p-3">
                        <span>⚠️</span>
                        <span>{es ? `Tu nivel de fatiga es alto (${stats.ultimoPuntaje}%). Considera hacer ejercicios visuales.` : `Your fatigue level is high (${stats.ultimoPuntaje}%). Consider doing visual exercises.`}</span>
                      </div>
                    : <p className="text-xs text-gray-400 text-center py-4">{es ? 'Sin notificaciones nuevas' : 'No new notifications'}</p>}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable body */}
        <main className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── Helpers de variante ── */}
          {(() => {
            const isFlat  = tc.cardVariant === 'flat';
            const isGlass = tc.cardVariant === 'glass';

            // Wrapper de card según variante
            const cardCls = (grad: string, flat = '') =>
              isFlat  ? `bg-white rounded-2xl shadow-md ${flat}`
              : isGlass ? `bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-xl`
              : `bg-gradient-to-br ${grad} rounded-2xl shadow-lg relative overflow-hidden`;

            // Decoración circular (solo en gradient/glass/dark)
            const Deco = () => isFlat ? null : <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8 pointer-events-none"/>;

            // Dots de racha
            const dotCls = (d: { active: boolean; today: boolean }) =>
              d.active  ? (isFlat ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white/30 border-white text-white')
              : d.today ? (isFlat ? 'border-indigo-400 text-indigo-500 bg-indigo-50' : 'border-white/60 text-white bg-white/20')
                        : (isFlat ? 'bg-gray-100 border-gray-200 text-gray-400' : 'bg-white/10 border-white/20 text-white/60');

            // Spinner
            const spinCls = isFlat ? 'border-indigo-500' : 'border-white';

            return (<>

          {/* ── Módulos principales (flujo lógico) ── */}
          <div className="mb-1">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{es ? 'Tu flujo diario' : 'Your daily flow'}</p>
            <div className="grid grid-cols-5 gap-2">
              {([
                { page: 'questionnaire' as Page,        emoji: '📋', label: es ? 'Evaluación' : 'Assessment',  color: 'from-indigo-500 to-violet-600' },
                { page: 'exercises' as Page,            emoji: '💪', label: es ? 'Ejercicios' : 'Exercises',   color: 'from-emerald-500 to-teal-600'  },
                { page: 'diagnostico-completo' as Page, emoji: '🔬', label: es ? 'Diagnóstico' : 'Diagnosis',  color: 'from-blue-500 to-cyan-600'     },
                { page: 'chat-sintomas' as Page,        emoji: '💬', label: es ? 'Chat IA' : 'AI Chat',       color: 'from-purple-500 to-pink-600'   },
                { page: 'rutinas-ia' as Page,           emoji: '✨', label: es ? 'Rutinas IA' : 'AI Routines', color: 'from-amber-500 to-orange-500'  },
              ] as const).map(item => (
                <button
                  key={item.page}
                  onClick={() => onNavigate(item.page)}
                  className={`bg-gradient-to-br ${item.color} rounded-xl p-2.5 flex flex-col items-center gap-1 hover:opacity-90 transition active:scale-95 shadow-sm`}
                >
                  <span className="text-xl">{item.emoji}</span>
                  <span className="text-white text-[10px] font-bold leading-tight text-center">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Fila 1: Estado de fatiga + Racha + Recomendación ── */}
          <SectionHeader id="fatiga" label={es ? 'Estado y racha' : 'Status & streak'} collapsed={collapsed} onToggle={handleToggle} />
          {!collapsed['fatiga'] && <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Tarjeta fatiga — siempre con gradiente propio (color de fatiga) */}
            <div className={`lg:col-span-1 bg-gradient-to-br ${fatiga.bg} rounded-2xl p-5 flex flex-col justify-between min-h-[160px] shadow-lg relative overflow-hidden`}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8"/>
              <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-6 -translate-x-6"/>
              <div>
                <p className="text-white/80 text-xs font-semibold uppercase tracking-wide mb-1">{es ? 'Estado actual de tu fatiga visual' : 'Current visual fatigue status'}</p>
                <p className="text-white text-2xl font-black">{fatiga.label}</p>
                <p className="text-white/70 text-xs mt-1 leading-snug">
                  {stats.ultimoPuntaje === null
                    ? (es ? 'Aún no tienes evaluaciones registradas.' : 'No assessments recorded yet.')
                    : stats.ultimoPuntaje < 25 ? (es ? 'Tu vista muestra signos de bienestar.' : 'Your eyes show signs of wellness.')
                    : stats.ultimoPuntaje < 50 ? (es ? 'Tu vista muestra signos de cansancio. Es buen momento para descansar.' : 'Your eyes show fatigue signs. A good time to rest.')
                    : stats.ultimoPuntaje < 75 ? (es ? 'Fatiga considerable detectada. Toma acción pronto.' : 'Considerable fatigue detected. Take action soon.')
                    : (es ? 'Fatiga severa. Tu salud visual requiere atención.' : 'Severe fatigue. Your eye health needs attention.')}
                </p>
              </div>
              <div className="flex items-center justify-between mt-3">
                <button
                  onClick={()=>onNavigate('questionnaire')}
                  className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition backdrop-blur-sm"
                >
                  {es ? 'Iniciar diagnóstico' : 'Start assessment'} <ChevronRight className="w-3.5 h-3.5"/>
                </button>
                {stats.ultimoPuntaje !== null && <FatigaGauge score={stats.ultimoPuntaje}/>}
              </div>
            </div>

            {/* Racha */}
            <div className={`${cardCls(tc.racha, `p-5 flex flex-col gap-3 ${tc.flatBorders.racha}`)} flex flex-col gap-3 p-5`}>
              <Deco/>
              <div className="flex items-center justify-between">
                <p className={`text-sm font-bold ${tc.cardText} flex items-center gap-1.5`}>
                  {es ? 'Racha de cuidado' : 'Care streak'} <Flame className="w-4 h-4 text-orange-400"/>
                </p>
              </div>
              <div>
                <p className={`text-4xl font-black ${tc.cardText}`}>{stats.racha} <span className={`text-base font-semibold ${tc.cardSubtext}`}>{es ? 'días' : 'days'}</span></p>
                <p className={`text-xs font-semibold mt-0.5 ${isFlat ? 'text-green-600' : 'text-white/80'}`}>
                  {stats.racha === 0 ? (es ? '¡Empieza hoy!' : 'Start today!') : stats.racha < 3 ? (es ? '¡Sigue así!' : 'Keep it up!') : stats.racha < 7 ? (es ? '¡Vas muy bien!' : 'Going great!') : (es ? '¡Increíble consistencia!' : 'Incredible consistency!')}
                </p>
                {stats.racha === 0 && (
                  <p className={`text-[10px] mt-1 leading-snug ${isFlat ? 'text-gray-500' : 'text-white/60'}`}>
                    {es
                      ? 'Haz un ejercicio o responde el cuestionario para comenzar'
                      : 'Do an exercise or fill in the questionnaire to start'}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                {rachaWeek.map((d, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${dotCls(d)}`}>{d.d}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Próxima recomendación */}
            <div className={`${cardCls(tc.recomendacion, `p-5 flex flex-col justify-between ${tc.flatBorders.rec}`)} flex flex-col justify-between p-5`}>
              <Deco/>
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${tc.cardSubtext}`}>{es ? 'Próxima recomendación' : 'Next recommendation'}</p>
                <p className={`text-lg font-bold leading-snug ${tc.cardText}`}>{rec.titulo}</p>
                <p className={`text-xs mt-1 ${tc.cardSubtext}`}>{rec.desc}</p>
              </div>
              <button
                onClick={()=>onNavigate(rec.page)}
                className={`mt-4 flex items-center justify-between px-4 py-2.5 ${tc.cardBtnBg} ${tc.cardBtnText} rounded-xl text-sm font-semibold transition backdrop-blur-sm`}
              >
                <span className="flex items-center gap-2"><span className="text-lg">{rec.icon}</span> {es ? 'Ir ahora' : 'Go now'}</span>
                <ChevronRight className="w-4 h-4"/>
              </button>
            </div>
          </div>}

          {/* ── Acciones rápidas ── */}
          <SectionHeader id="acciones" label={es ? 'Acciones rápidas' : 'Quick actions'} collapsed={collapsed} onToggle={handleToggle} />
          {!collapsed['acciones'] && <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {([
                { icon: Activity,   idx: 0, title: es ? 'Ejercicios visuales' : 'Visual exercises',  desc: es ? 'Reduce la fatiga con ejercicios guiados' : 'Reduce fatigue with guided exercises', page: 'exercises' as Page },
                { icon: Camera,     idx: 1, title: es ? 'Captura de imagen' : 'Image capture',       desc: es ? 'Toma una imagen para análisis visual' : 'Take an image for visual analysis', page: 'image-capture' as Page },
                { icon: Glasses,    idx: 2, title: es ? 'Prueba de visión' : 'Vision test',          desc: es ? 'Valida tu agudeza visual con Snellen' : 'Validate your visual acuity with Snellen', page: 'vision-test' as Page },
                { icon: HeartPulse, idx: 3, title: es ? 'Salud Visual' : 'Visual Health',            desc: es ? 'Monitorea tu tiempo en pantalla' : 'Monitor your screen time', page: 'visual-health' as Page },
              ] as const).map((item) => {
                const iconStyle = tc.qaIcons[item.idx];
                const flatBorder = tc.flatBorders.qa[item.idx];
                return (
                  <button
                    key={item.title}
                    onClick={()=>onNavigate(item.page)}
                    className={`${cardCls(tc.quickActionGrads[item.idx], `p-4 text-left ${flatBorder}`)} p-4 text-left hover:shadow-xl hover:-translate-y-0.5 transition-all group`}
                  >
                    {!isFlat && <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-6 translate-x-6 pointer-events-none"/>}
                    <div className={`w-10 h-10 ${iconStyle.iconBg} rounded-xl flex items-center justify-center mb-3`}>
                      <item.icon className={`w-5 h-5 ${iconStyle.iconColor}`}/>
                    </div>
                    <p className={`text-sm font-bold leading-tight ${tc.cardText}`}>{item.title}</p>
                    <p className={`text-xs mt-1 leading-snug ${tc.cardSubtext}`}>{item.desc}</p>
                    <div className={`flex items-center gap-1 mt-2 text-xs font-semibold group-hover:gap-2 transition-all ${isFlat ? 'text-indigo-500' : 'text-white/90'}`}>
                      {es ? 'Ir' : 'Go'} <ChevronRight className="w-3 h-3"/>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>}

          {/* ── Coach Visual Semanal ── */}
          <SectionHeader id="coach" label={es ? 'Coach semanal' : 'Weekly coach'} collapsed={collapsed} onToggle={handleToggle} />
          {!collapsed['coach'] && <CoachVisualSemanal />}

          {/* ── Reto Semanal ── */}
          <SectionHeader id="reto" label={es ? 'Reto semanal' : 'Weekly challenge'} collapsed={collapsed} onToggle={handleToggle} />
          {!collapsed['reto'] && <RetoSemanal onNavigate={(p) => onNavigate(p as Page)} />}

          {/* ── Fila 3: Progreso semanal + Últimos diagnósticos ── */}
          <SectionHeader id="progreso" label={es ? 'Progreso y diagnósticos' : 'Progress & diagnostics'} collapsed={collapsed} onToggle={handleToggle} />
          {!collapsed['progreso'] && <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Progreso semanal */}
            <div className={`${cardCls(tc.progreso, `p-5 ${tc.flatBorders.prog}`)} p-5`}>
              <Deco/>
              <div className="flex items-center justify-between mb-1">
                <p className={`text-sm font-bold ${tc.cardText}`}>{es ? 'Tu progreso semanal' : 'Your weekly progress'}</p>
                <div className={`flex items-center gap-1.5 text-xs ${tc.cardSubtext}`}>
                  {stats.tendencia === 'mejorando'  && <><TrendingDown className="w-3.5 h-3.5 text-green-400"/> {es ? 'Mejorando' : 'Improving'}</>}
                  {stats.tendencia === 'empeorando' && <><TrendingUp   className="w-3.5 h-3.5 text-red-400"/>   {es ? 'Empeorando' : 'Worsening'}</>}
                  {stats.tendencia === 'estable'    && <><Minus         className="w-3.5 h-3.5 text-yellow-400"/> {es ? 'Estable' : 'Stable'}</>}
                </div>
              </div>
              <p className={`text-xs mb-3 ${tc.cardSubtext}`}>{es ? 'Nivel de fatiga diario (cuestionario)' : 'Daily fatigue level (questionnaire)'}</p>
              {loadingStats
                ? <div className="h-24 flex items-center justify-center"><div className={`animate-spin w-5 h-5 rounded-full border-2 ${spinCls} border-t-transparent`}/></div>
                : <WeeklyChart data={weekData}/>}
            </div>

            {/* Últimos diagnósticos */}
            <div className={`${cardCls(tc.diagnosticos, `p-5 ${tc.flatBorders.diag}`)} p-5 flex flex-col`}>
              <Deco/>
              <p className={`text-sm font-bold mb-3 ${tc.cardText}`}>{es ? 'Últimos diagnósticos' : 'Latest diagnostics'}</p>
              {loadingStats
                ? <div className="flex-1 flex items-center justify-center"><div className={`animate-spin w-5 h-5 rounded-full border-2 ${spinCls} border-t-transparent`}/></div>
                : diagList.length === 0
                  ? <div className={`flex-1 flex flex-col items-center justify-center text-sm gap-2 ${tc.cardSubtext}`}>
                      <ScanEye className="w-8 h-8 opacity-40"/>
                      <span>{es ? 'Sin diagnósticos registrados' : 'No diagnostics recorded'}</span>
                    </div>
                  : <div className="space-y-2 flex-1">
                      {diagList.map((d, i) => (
                        <div key={i} className={`flex items-center justify-between py-2 border-b last:border-0 ${isFlat ? 'border-gray-100' : 'border-white/20'}`}>
                          <p className={`text-xs font-semibold ${tc.cardText}`}>{d.fecha}</p>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold ${isFlat ? d.color : 'text-white/80'}`}>{d.nivel}</span>
                            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getDiagColor(d.score, lang).dot}`}/>
                          </div>
                        </div>
                      ))}
                    </div>}
              <button
                onClick={()=>onNavigate('history')}
                className={`mt-3 text-xs font-semibold flex items-center gap-1 self-end transition ${isFlat ? 'text-indigo-600 hover:text-indigo-800' : 'text-white/80 hover:text-white'}`}
              >
                {es ? 'Ver historial completo' : 'View full history'} <ChevronRight className="w-3 h-3"/>
              </button>
            </div>
          </div>}

          {/* ── Timer pantalla (compacto) ── */}
          <SectionHeader id="timer" label={es ? 'Tiempo en pantalla' : 'Screen time'} collapsed={collapsed} onToggle={handleToggle} />
          {!collapsed['timer'] && <div
            onClick={()=>onNavigate('visual-health')}
            className={`${cardCls(tc.timer, `p-4 ${tc.flatBorders.timer}`)} p-4 flex flex-col gap-3 cursor-pointer hover:shadow-xl hover:-translate-y-0.5 transition-all`}
          >
            <Deco/>
            {/* Fila superior: ícono + texto */}
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${isFlat ? (screenTimeRunning ? 'bg-teal-100' : 'bg-gray-100') : (screenTimeRunning ? 'bg-white/30' : 'bg-white/20')}`}>
                <span className={`w-3 h-3 rounded-full ${isFlat ? (screenTimeRunning ? 'bg-teal-500 animate-pulse' : 'bg-gray-400') : (screenTimeRunning ? 'bg-white animate-pulse' : 'bg-white/60')}`}/>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-sm font-bold ${tc.cardText}`}>{es ? 'Tiempo en pantalla hoy' : 'Screen time today'}</p>
                  {timerSource === 'ext'
                    ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">🧩 Ext</span>
                    : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">🌐 Web</span>
                  }
                </div>
                <p className={`text-xs ${tc.cardSubtext}`}>
                  {screenTimeRunning ? (es ? 'Activo' : 'Running') : (es ? 'Pausado' : 'Paused')}
                  {timerSource === 'ext' ? (es ? ' · Controlado desde la extensión' : ' · Controlled by extension') : (es ? ' · Toca para detalles' : ' · Tap for details')}
                </p>
              </div>
            </div>
            {/* Fila inferior: timer + botón */}
            <div className="flex items-center justify-between gap-2">
              <p className={`text-3xl font-black font-mono tabular-nums ${tc.cardText}`}>{screenHH}:{screenMM}:{screenSS}</p>
              {timerSource === 'ext' ? (
                <span className="text-xs text-indigo-500 font-semibold">{es ? 'Usa la extensión' : 'Use extension'}</span>
              ) : (
                <button
                  onClick={handleTimerToggle}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 text-white text-sm font-semibold rounded-xl transition ${screenTimeRunning ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'}`}
                >
                  {screenTimeRunning ? <><Pause className="w-4 h-4"/> {es ? 'Pausar' : 'Pause'}</> : <><Play className="w-4 h-4"/> {es ? 'Iniciar' : 'Start'}</>}
                </button>
              )}
            </div>
          </div>}

            {/* ── Predictor de Fatiga ── */}
            <SectionHeader id="predictor" label={es ? 'Predictor de fatiga' : 'Fatigue predictor'} collapsed={collapsed} onToggle={handleToggle} />
            {!collapsed['predictor'] && <FatigaPredictor />}

            </>);
          })()}

          {/* ── Artículo del día ── */}
          <SectionHeader id="articulo" label={es ? 'Artículo del día' : 'Article of the day'} collapsed={collapsed} onToggle={handleToggle} />
          {!collapsed['articulo'] && (() => {
            const article = ARTICLES[articleIdx];
            const catMeta = CATEGORY_META[article.category];
            const title   = es ? article.titleEs   : article.titleEn;
            const summary = es ? article.summaryEs : article.summaryEn;
            return (
              <div className="rounded-2xl overflow-hidden shadow-md" {...articleSwipe} style={{ touchAction: 'pan-y' }}>
                {/* Encabezado */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-white border border-b-0 border-blue-100 rounded-t-2xl">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-500"/>
                    <p className="text-sm font-bold text-gray-800">{es ? 'Artículo del día' : 'Article of the day'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={prevArticle} className="p-1 rounded-lg hover:bg-gray-100 transition text-gray-400 hover:text-gray-700">
                      <ChevronLeft className="w-4 h-4"/>
                    </button>
                    <span className="text-[10px] text-gray-400 font-medium tabular-nums">{articleIdx + 1}/{ARTICLES.length}</span>
                    <button onClick={nextArticle} className="p-1 rounded-lg hover:bg-gray-100 transition text-gray-400 hover:text-gray-700">
                      <ChevronRight className="w-4 h-4"/>
                    </button>
                  </div>
                </div>

                {/* Tarjeta visual */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    try { localStorage.setItem('therapheye_open_article', article.id); } catch {}
                    onNavigate('learn');
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      try { localStorage.setItem('therapheye_open_article', article.id); } catch {}
                      onNavigate('learn');
                    }
                  }}
                  className={`relative h-52 bg-gradient-to-br ${article.accentFrom} ${article.accentTo} cursor-pointer transition-opacity duration-300 ${articleFading ? 'opacity-0' : 'opacity-100'}`}
                >
                  {/* Fondo decorativo */}
                  <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none" viewBox="0 0 420 208" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                    <circle cx="370" cy="-20" r="110" fill="white"/>
                    <circle cx="30"  cy="210" r="90"  fill="white"/>
                    <circle cx="210" cy="104" r="55"  fill="white" opacity="0.5"/>
                    <ellipse cx="210" cy="104" rx="140" ry="88" fill="none" stroke="white" strokeWidth="2.5"/>
                    <circle  cx="210" cy="104" r="30"  fill="none" stroke="white" strokeWidth="2"/>
                    <circle  cx="210" cy="104" r="12"  fill="white" opacity="0.8"/>
                  </svg>

                  {/* Contenido sobre el gradiente */}
                  <div className="absolute inset-0 flex flex-col justify-end p-5">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white/25 text-white backdrop-blur-sm mb-2 w-fit">
                      {es ? catMeta.labelEs : catMeta.labelEn}
                    </span>
                    <h3 className="text-white font-black text-lg leading-tight mb-1.5 line-clamp-2 drop-shadow">
                      {title}
                    </h3>
                    <p className="text-white/80 text-xs leading-relaxed line-clamp-2 mb-4">
                      {summary}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-white/70 text-xs">
                        <Clock className="w-3 h-3"/>
                        {article.readMinutes} min
                      </span>
                      <span className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm border border-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-white/30 transition">
                        {es ? 'Leer artículo' : 'Read article'} <ChevronRight className="w-3.5 h-3.5"/>
                      </span>
                    </div>
                  </div>

                  {/* Barra de progreso auto-slide */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 overflow-hidden">
                    <div
                      key={articleIdx}
                      className="h-full bg-white/70 origin-left"
                      style={{ animation: 'articleBarProgress 18s linear forwards' }}
                    />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Tip del Día + Ojo del Día ── */}
          <SectionHeader id="tips" label={es ? 'Tips y datos' : 'Tips & facts'} collapsed={collapsed} onToggle={handleToggle} />
          {!collapsed['tips'] && (() => {
            const tipsList = es ? TIPS_DEL_DIA : TIPS_DEL_DIA_EN;
            const ojosList = es ? OJOS_DEL_DIA : OJOS_DEL_DIA_EN;
            const tip = tipsList[tipIndex % tipsList.length];
            const ojo = ojosList[new Date().getDate() % ojosList.length];
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-indigo-100 rounded-2xl px-4 py-3 flex items-center gap-3">
                  <span className="text-2xl flex-shrink-0">{tip.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wide mb-0.5">
                      {es ? 'Tip del día' : 'Tip of the day'}
                    </p>
                    <p className="text-xs text-gray-700 leading-relaxed">{tip.tip}</p>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100 rounded-2xl px-4 py-3 flex items-center gap-3">
                  <span className="text-2xl flex-shrink-0">{ojo.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wide mb-0.5">
                      {es ? '¿Sabías que…?' : 'Did you know…?'}
                    </p>
                    <p className="text-xs text-gray-700 leading-relaxed">{ojo.dato}</p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Panel acceso rápido features avanzadas — Carousel ── */}
          <SectionHeader id="herramientas" label={es ? 'Herramientas avanzadas' : 'Advanced tools'} collapsed={collapsed} onToggle={handleToggle} />
          {!collapsed['herramientas'] && (() => {
            const allToolsEs = [
              { page: 'reaccion-visual',  label: 'Reacción Visual',                    emoji: '⚡', color: 'from-violet-500 to-purple-600', desc: 'Pon a prueba qué tan rápido reaccionan tus ojos ante estímulos luminosos.', detail: 'Registra tu tiempo de respuesta, detecta asimetrías entre ojos y monitorea tu progreso sesión a sesión.' },
              { page: 'campo-visual',     label: 'Campo Visual\n(Visión Periférica)',   emoji: '🔭', color: 'from-indigo-500 to-blue-600',   desc: 'Mapea los límites de tu campo de visión periférica y detecta posibles puntos ciegos.', detail: 'Ejercicio rápido que imita pruebas clínicas básicas de perimetría. Ideal para detectar cambios tempranos.' },
              { page: 'contrast-test',    label: 'Test de Contraste',                  emoji: '⬛', color: 'from-gray-600 to-slate-700',    desc: 'Evalúa qué tan bien distingues diferencias sutiles de brillo y contraste.', detail: 'Útil para detectar fatiga visual, problemas de córnea o inicio de cataratas. Recomendado en entornos de pantalla prolongada.' },
              { page: 'test-cromatico',   label: 'Percepción del Color\n(Test Cromático)', emoji: '🎨', color: 'from-rose-500 to-pink-600', desc: 'Detecta alteraciones en tu percepción del color y posible daltonismo o deficiencias cromáticas.', detail: 'Basado en principios de la prueba Ishihara. Identifica dificultades para distinguir rojo-verde o azul-amarillo.' },
              { page: 'modo-zen',         label: 'Modo Zen',                           emoji: '🧘', color: 'from-emerald-500 to-green-600', desc: 'Sesión guiada de relajación ocular con ejercicios suaves, respiración y sonidos binaurales.', detail: 'Reduce la fatiga acumulada, hidrata el ojo con técnica de palming y reinicia tu enfoque mental.' },
              { page: 'simulador',        label: 'Simulador Visual',                   emoji: '👓', color: 'from-slate-500 to-gray-600',    desc: 'Experimenta en tiempo real cómo perciben el mundo personas con distintas condiciones visuales.', detail: 'Simula miopía, hipermetropía, astigmatismo, glaucoma y más. Genera empatía y conciencia visual.' },
              { page: 'notas-medicas',    label: 'Notas Médicas',                      emoji: '📋', color: 'from-orange-500 to-amber-600',  desc: 'Lleva un registro organizado de consultas, recetas, graduación y evolución con tu oftalmólogo.', detail: 'Centraliza toda tu información clínica en un solo lugar, segura y accesible cuando la necesitas.' },
              { page: 'respiracion-478',  label: 'Respiración 4-7-8',                 emoji: '💨', color: 'from-sky-500 to-cyan-600',      desc: 'Técnica de respiración guiada que reduce la tensión ocular, el estrés digital y la fatiga general.', detail: 'Inhala 4 seg, retén 7 seg, exhala 8 seg. Activa el sistema nervioso parasimpático y relaja los músculos oculares.' },
              { page: 'evolucion-tests',  label: 'Evolución de Tests',                emoji: '📈', color: 'from-violet-600 to-purple-700', desc: 'Visualiza tus resultados históricos y tendencias en todos los tests que has realizado.', detail: 'Gráficas interactivas por fecha y categoría. Detecta mejoras o retrocesos y compártelos con tu especialista.' },
            ] as { page: Page; label: string; emoji: string; color: string; desc: string; detail: string }[];

            const allToolsEn = [
              { page: 'reaccion-visual',  label: 'Visual Reaction',                       emoji: '⚡', color: 'from-violet-500 to-purple-600', desc: 'Test how fast your eyes react to light stimuli in real time.', detail: 'Tracks response time, detects asymmetries between eyes, and monitors your progress over sessions.' },
              { page: 'campo-visual',     label: 'Visual Field\n(Peripheral Vision)',      emoji: '🔭', color: 'from-indigo-500 to-blue-600',   desc: 'Map the boundaries of your peripheral vision and detect potential blind spots.', detail: 'Quick exercise inspired by basic clinical perimetry tests. Great for spotting early visual changes.' },
              { page: 'contrast-test',    label: 'Contrast Test',                         emoji: '⬛', color: 'from-gray-600 to-slate-700',    desc: 'Evaluate how well you distinguish subtle differences in brightness and contrast.', detail: 'Useful for detecting eye fatigue, corneal issues, or early cataracts. Recommended for heavy screen users.' },
              { page: 'test-cromatico',   label: 'Color Perception\n(Chromatic Test)',    emoji: '🎨', color: 'from-rose-500 to-pink-600',     desc: 'Detect color perception issues and possible color blindness or chromatic deficiencies.', detail: 'Based on Ishihara test principles. Identifies difficulty distinguishing red-green or blue-yellow.' },
              { page: 'modo-zen',         label: 'Zen Mode',                              emoji: '🧘', color: 'from-emerald-500 to-green-600', desc: 'Guided eye relaxation session with gentle exercises, breathing, and binaural sounds.', detail: 'Reduces accumulated fatigue, hydrates the eye with palming technique, and resets your mental focus.' },
              { page: 'simulador',        label: 'Vision Simulator',                      emoji: '👓', color: 'from-slate-500 to-gray-600',    desc: 'Experience in real time how people with different visual conditions perceive the world.', detail: 'Simulates myopia, hyperopia, astigmatism, glaucoma and more. Build visual empathy and awareness.' },
              { page: 'notas-medicas',    label: 'Medical Notes',                         emoji: '📋', color: 'from-orange-500 to-amber-600',  desc: 'Keep an organized log of appointments, prescriptions, prescriptions and eye evolution.', detail: 'Centralize all your clinical information in one place, safe and accessible whenever you need it.' },
              { page: 'respiracion-478',  label: '4-7-8 Breathing',                       emoji: '💨', color: 'from-sky-500 to-cyan-600',      desc: 'Guided breathing technique that reduces eye tension, digital stress, and general fatigue.', detail: 'Inhale 4s, hold 7s, exhale 8s. Activates the parasympathetic nervous system and relaxes eye muscles.' },
              { page: 'evolucion-tests',  label: 'Test Evolution',                        emoji: '📈', color: 'from-violet-600 to-purple-700', desc: 'Visualize your historical results and trends across all completed tests.', detail: 'Interactive charts by date and category. Spot improvements or regressions and share them with your specialist.' },
            ] as { page: Page; label: string; emoji: string; color: string; desc: string; detail: string }[];

            const allTools = es ? allToolsEs : allToolsEn;
            const focusPriority: Record<string, string[]> = {
              'fatiga':     ['modo-zen', 'respiracion-478', 'evolucion-tests'],
              'ojo-seco':   ['modo-zen', 'respiracion-478', 'notas-medicas'],
              'clinica':    ['campo-visual', 'contrast-test', 'test-cromatico', 'evolucion-tests', 'notas-medicas'],
              'curiosidad': [],
            };
            const priority = userFocus ? focusPriority[userFocus] ?? [] : [];
            const sorted = priority.length > 0
              ? [...allTools.filter(t => priority.includes(t.page)), ...allTools.filter(t => !priority.includes(t.page))]
              : allTools;
            const n = sorted.length;
            const curr = toolIdx % n;

            return (
              <div className="mt-2 max-w-2xl mx-auto">
                {/* Carousel con flechas externas */}
                <div className="flex items-center gap-2">
                  {/* Prev */}
                  <button
                    onClick={() => {
                      setToolIdx(i => (i - 1 + n) % n);
                      setToolAutoDelay(8000); // duplicar tiempo antes del siguiente auto-avance
                      setToolAutoKey(k => k + 1); // reiniciar timer
                    }}
                    className="flex-shrink-0 w-9 h-9 bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all rounded-xl flex items-center justify-center shadow-md text-white"
                  >
                    <ChevronLeft className="w-5 h-5"/>
                  </button>

                  {/* Slide track */}
                  <div
                    className="flex-1 overflow-hidden rounded-2xl select-none shadow-lg"
                    onTouchStart={e => { toolTouchX.current = e.touches[0].clientX; }}
                    onTouchEnd={e => {
                      const dx = e.changedTouches[0].clientX - toolTouchX.current;
                      if (dx < -40) { setToolIdx(i => (i + 1) % n); setToolAutoDelay(8000); setToolAutoKey(k => k + 1); }
                      else if (dx > 40) { setToolIdx(i => (i - 1 + n) % n); setToolAutoDelay(8000); setToolAutoKey(k => k + 1); }
                    }}
                  >
                    <div
                      className="flex transition-transform duration-350 ease-in-out"
                      style={{ transform: `translateX(-${curr * 100}%)` }}
                    >
                      {sorted.map(item => (
                        <div key={item.page} className="w-full flex-none">
                          <button
                            onClick={() => onNavigate(item.page)}
                            className={`w-full min-h-[340px] bg-gradient-to-br ${item.color} text-white px-8 py-8 flex flex-col items-center text-center hover:brightness-110 transition-all active:scale-[0.98]`}
                          >
                            <span className="text-7xl leading-none drop-shadow">{item.emoji}</span>
                            <span className="text-xl font-black leading-tight mt-3 whitespace-pre-line">{item.label}</span>
                            <span className="text-sm text-white/90 leading-relaxed max-w-lg mt-2">{item.desc}</span>
                            {'detail' in item && (
                              <span className="text-xs text-white/65 leading-relaxed max-w-lg mt-1">{(item as { detail: string }).detail}</span>
                            )}
                            <span className="mt-auto pt-4 px-5 py-2 bg-white/20 hover:bg-white/30 rounded-full text-sm font-bold tracking-wide uppercase transition-colors">
                              {es ? 'Abrir herramienta →' : 'Open tool →'}
                            </span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Next */}
                  <button
                    onClick={() => {
                      setToolIdx(i => (i + 1) % n);
                      setToolAutoDelay(8000); // duplicar tiempo antes del siguiente auto-avance
                      setToolAutoKey(k => k + 1); // reiniciar timer
                    }}
                    className="flex-shrink-0 w-9 h-9 bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all rounded-xl flex items-center justify-center shadow-md text-white"
                  >
                    <ChevronRight className="w-5 h-5"/>
                  </button>
                </div>

                {/* Progress indicator */}
                <div className="flex items-center gap-2 mt-2.5 px-0.5">
                  <span className="text-[11px] text-gray-400 tabular-nums w-9 flex-shrink-0">{curr + 1}/{n}</span>
                  <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                      style={{ width: `${((curr + 1) / n) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Quick check flotante (mobile) ── */}
          <button
            onClick={() => setShowQuickCheck(true)}
            className="sm:hidden fixed bottom-20 right-4 z-[7999] w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-lg flex items-center justify-center transition active:scale-95"
            title="Check rápido"
          >
            <Zap className="w-6 h-6" />
          </button>

        </main>
    </div>

    {/* ── Streak celebration ── */}
    {showStreakCelebration && (
      <div className="fixed inset-0 z-[20000] flex items-center justify-center pointer-events-none">
        <div className="bg-gradient-to-br from-orange-400 to-pink-500 text-white rounded-3xl shadow-2xl px-8 py-6 text-center animate-[bounceIn_0.5s_ease] max-w-xs mx-4 pointer-events-auto">
          <p className="text-5xl mb-2">🔥</p>
          <p className="text-2xl font-black mb-1">{stats.racha} días seguidos</p>
          <p className="text-sm text-white/80 leading-relaxed">¡Increíble racha! Tus ojos te lo agradecen.</p>
          <button
            onClick={() => setShowStreakCelebration(false)}
            className="mt-4 px-5 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold transition"
          >
            ¡Gracias!
          </button>
        </div>
      </div>
    )}

    {/* ── Quick Check modal ── */}
    {showQuickCheck && (
      <QuickCheck onClose={() => setShowQuickCheck(false)} />
    )}
    </>
  );
};

export default Dashboard;
