import { useEffect, useState, useRef, useCallback } from 'react';
import { THEMES, DEFAULT_THEME } from '../themes';
import type { Theme } from '../themes';
import {
  Flame, TrendingDown, TrendingUp, Minus, Bell,
  ChevronRight, ChevronLeft, Play, Pause, BookOpen, Clock,
  Activity, Camera, Glasses, HeartPulse, ScanEye, Zap,
} from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../i18n';
import { sql } from '../neonCliente';
import { ARTICLES, CATEGORY_META } from '../data/articles';
import CoachVisualSemanal from '../components/CoachVisualSemanal';
import FatigaPredictor from '../components/FatigaPredictor';
import AmbientLightDetector from '../components/AmbientLightDetector';
import QuickCheck from '../components/QuickCheck';

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

type Page =
  | 'login' | 'register' | 'dashboard' | 'questionnaire' | 'exercises'
  | 'exercise-session' | 'history' | 'image-capture' | 'vision-test'
  | 'visual-health' | 'profile' | 'diagnostico-completo' | 'learn'
  | 'blink-detector' | 'reading-test' | 'chat-sintomas' | 'mapa-oftalmologos' | 'juegos-visuales'
  | 'rutinas-ia' | 'diario-visual' | 'pomodoro-visual'
  | 'campo-visual' | 'modo-zen' | 'contrast-test'
  | 'reaccion-visual' | 'vergencia' | 'carga-visual'
  | 'notas-medicas' | 'simulador' | 'test-cromatico';

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
const getFatigaInfo = (score: number | null) => {
  if (score === null) return { label: 'Sin datos', color: '#6366f1', bg: 'from-indigo-400 to-violet-500', textClass: 'text-gray-400' };
  if (score < 25)  return { label: 'Leve',        color: '#16a34a', bg: 'from-emerald-400 to-teal-500',   textClass: 'text-emerald-600' };
  if (score < 50)  return { label: 'Moderada',    color: '#ca8a04', bg: 'from-amber-400 to-orange-500',   textClass: 'text-amber-600'   };
  if (score < 75)  return { label: 'Considerable',color: '#ea580c', bg: 'from-orange-500 to-red-500',     textClass: 'text-orange-600'  };
  return             { label: 'Severa',           color: '#dc2626', bg: 'from-red-500 to-rose-600',       textClass: 'text-red-600'     };
};

const getDiagColor = (score: number) => {
  if (score < 25)  return { dot: 'bg-emerald-400', text: 'text-emerald-600', label: 'Fatiga leve' };
  if (score < 50)  return { dot: 'bg-amber-400',   text: 'text-amber-600',   label: 'Fatiga moderada' };
  if (score < 75)  return { dot: 'bg-orange-500',  text: 'text-orange-600',  label: 'Fatiga alta' };
  return             { dot: 'bg-red-500',    text: 'text-red-600',     label: 'Fatiga severa' };
};

// ─── Mini gráfica semanal SVG ─────────────────────────────────────────────────
const WeeklyChart = ({ data }: { data: WeekDay[] }) => {
  const W = 400, H = 110;
  const PAD = { top: 16, right: 12, bottom: 28, left: 32 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const points = data.filter(d => d.score !== null);
  if (points.length < 2) return (
    <div className="flex items-center justify-center h-24 text-gray-300 text-sm">Sin datos esta semana</div>
  );
  const toX = (i: number) => PAD.left + (i / (data.length - 1)) * cW;
  const toY = (v: number) => PAD.top + cH - (v / 100) * cH;
  const dotColor = (v: number) => v < 25 ? '#16a34a' : v < 50 ? '#ca8a04' : v < 75 ? '#ea580c' : '#dc2626';

  const linePts = data.map((d, i) => d.score !== null ? { x: toX(i), y: toY(d.score) } : null).filter(Boolean) as {x:number;y:number}[];
  const linePath = linePts.map((p,i) => `${i===0?'M':'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = linePts.length > 0
    ? `${linePath} L ${linePts[linePts.length-1].x} ${PAD.top+cH} L ${linePts[0].x} ${PAD.top+cH} Z`
    : '';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs>
        <linearGradient id="wkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25"/>
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02"/>
        </linearGradient>
      </defs>
      {[0,25,50,75,100].map(v => (
        <g key={v}>
          <line x1={PAD.left} y1={toY(v)} x2={PAD.left+cW} y2={toY(v)} stroke="#f3f4f6" strokeWidth="1"/>
          <text x={PAD.left-4} y={toY(v)+4} textAnchor="end" fontSize="8" fill="#d1d5db">{v}%</text>
        </g>
      ))}
      <path d={areaPath} fill="url(#wkGrad)"/>
      <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {data.map((d, i) => {
        if (d.score === null) return null;
        const x = toX(i), y = toY(d.score);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={4} fill={dotColor(d.score)} stroke="white" strokeWidth="1.5"/>
          </g>
        );
      })}
      {data.map((d, i) => (
        <text key={i} x={toX(i)} y={PAD.top+cH+14} textAnchor="middle" fontSize="8" fill="#9ca3af">
          {d.label}
        </text>
      ))}
    </svg>
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
  const extensionDismissed = localStorage.getItem('therapheye_ext_banner_dismissed') === 'true';
  const notifRef = useRef<HTMLDivElement>(null);
  const [showNotif, setShowNotif] = useState(false);

  const extensionUrl = 'https://chromewebstore.google.com/detail/therapheye-%E2%80%93-screen-time/lephmmimjeeeknpgdmnhpjkbbnmplcal';

  // Detectar extensión
  useEffect(() => {
    const EXT_ID = 'lephmmimjeeeknpgdmnhpjkbbnmplcal';
    if (document.documentElement.hasAttribute('data-therapheye-ext')) { setExtensionInstalled(true); return; }
    const img = new Image();
    img.onload = () => setExtensionInstalled(true);
    img.src = `chrome-extension://${EXT_ID}/icons/icon16.png`;
    const obs = new MutationObserver(() => {
      if (document.documentElement.hasAttribute('data-therapheye-ext')) { setExtensionInstalled(true); obs.disconnect(); }
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-therapheye-ext'] });
    return () => { obs.disconnect(); img.onload = null; };
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
    const load = () => { const s = readTimerState(); setScreenTimeMs(calcTimerMs(s)); setScreenTimeRunning(s.isRunning); };
    load(); const iv = setInterval(load, 1000); return () => clearInterval(iv);
  }, []);

  // Rotar artículo cada 25 segundos con fade
  const goToArticle = (idx: number) => {
    setArticleFading(true);
    setTimeout(() => { setArticleIdx(idx); setArticleFading(false); }, 320);
  };
  const nextArticle = () => goToArticle((articleIdx + 1) % ARTICLES.length);
  const prevArticle = () => goToArticle((articleIdx - 1 + ARTICLES.length) % ARTICLES.length);

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
        const [evalRows, exRows, actRows, weekRows, diagRows] = await Promise.all([
          sql`SELECT puntaje_fatiga, created_at FROM respuestas_cuestionario WHERE user_id=${user.id} ORDER BY created_at DESC LIMIT 2`,
          sql`SELECT COUNT(*) AS total FROM historial_ejercicios WHERE user_id=${user.id} AND status='completed'`,
          sql`SELECT created_at FROM historial_ejercicios WHERE user_id=${user.id} UNION ALL SELECT created_at FROM respuestas_cuestionario WHERE user_id=${user.id}`,
          sql`SELECT DATE(created_at AT TIME ZONE 'America/Mexico_City') as dia, AVG(puntaje_fatiga) as avg_score FROM respuestas_cuestionario WHERE user_id=${user.id} AND created_at >= NOW()-INTERVAL '7 days' GROUP BY dia ORDER BY dia`,
          sql`SELECT score_final, nivel, created_at FROM diagnostico_completo WHERE user_id=${user.id} ORDER BY created_at DESC LIMIT 3`.catch(()=>[]),
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
        const today = new Date();
        const week: WeekDay[] = diasLabels.map((label, i) => {
          const d = new Date(today); d.setDate(d.getDate() - (today.getDay()===0?6:today.getDay()-1) + i);
          const dk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          const score = scoreMap[dk] ?? null;
          return { label, score, active: score !== null, dateKey: dk };
        });
        setWeekData(week);

        // Últimos diagnósticos
        const diags: DiagEntry[] = (diagRows as any[]).map((r:any) => {
          const d = new Date(r.created_at);
          const score = Math.round(Number(r.score_final));
          const info  = getDiagColor(score);
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
            const info = getDiagColor(score);
            diags.push({ fecha: d.toLocaleString('es-MX',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}), nivel: info.label, score, color: info.text });
          });
        }
        setDiagList(diags);
      } catch(e) { console.error('[Dashboard]',e); }
      finally { setLoadingStats(false); }
    };
    fetch();
  }, [user?.id]);


  const fatiga      = getFatigaInfo(stats.ultimoPuntaje);
  const screenHH    = String(Math.floor(screenTimeMs/3600000)).padStart(2,'0');
  const screenMM    = String(Math.floor((screenTimeMs%3600000)/60000)).padStart(2,'0');
  const screenSS    = String(Math.floor((screenTimeMs%60000)/1000)).padStart(2,'0');

  const es = lang === 'es';

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
            {/* Extensión badge */}
            {!extensionInstalled && !extensionDismissed && (
              <a href={extensionUrl} target="_blank" rel="noopener noreferrer"
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-lg border border-indigo-200 hover:bg-indigo-100 transition">
                🧩 {es ? 'Agregar extensión' : 'Add extension'}
              </a>
            )}
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

          {/* ── Fila 1: Estado de fatiga + Racha + Recomendación ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

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
          </div>

          {/* ── Acciones rápidas ── */}
          <div>
            <p className={`text-sm font-bold mb-3 ${tc.sectionLabel}`}>{es ? 'Acciones rápidas' : 'Quick actions'}</p>
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
          </div>

          {/* ── Coach Visual Semanal ── */}
          <CoachVisualSemanal />

          {/* ── Fila 3: Progreso semanal + Últimos diagnósticos ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

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
                            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getDiagColor(d.score).dot}`}/>
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
          </div>

          {/* ── Timer pantalla (compacto) ── */}
          <div
            onClick={()=>onNavigate('visual-health')}
            className={`${cardCls(tc.timer, `p-4 ${tc.flatBorders.timer}`)} p-4 flex items-center justify-between cursor-pointer hover:shadow-xl hover:-translate-y-0.5 transition-all`}
          >
            <Deco/>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isFlat ? (screenTimeRunning ? 'bg-teal-100' : 'bg-gray-100') : (screenTimeRunning ? 'bg-white/30' : 'bg-white/20')}`}>
                <span className={`w-3 h-3 rounded-full ${isFlat ? (screenTimeRunning ? 'bg-teal-500 animate-pulse' : 'bg-gray-400') : (screenTimeRunning ? 'bg-white animate-pulse' : 'bg-white/60')}`}/>
              </div>
              <div>
                <p className={`text-sm font-bold ${tc.cardText}`}>{es ? 'Tiempo en pantalla hoy' : 'Screen time today'}</p>
                <p className={`text-xs ${tc.cardSubtext}`}>{screenTimeRunning ? (es ? 'Cronómetro activo' : 'Timer running') : (es ? 'Cronómetro pausado' : 'Timer paused')} · {es ? 'Toca para ver detalles' : 'Tap to view details'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <p className={`text-2xl font-black font-mono tabular-nums ${tc.cardText}`}>{screenHH}:{screenMM}:{screenSS}</p>
              <button
                onClick={handleTimerToggle}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-lg transition ${screenTimeRunning ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'}`}
              >
                {screenTimeRunning ? <><Pause className="w-3.5 h-3.5"/> {es ? 'Pausar' : 'Pause'}</> : <><Play className="w-3.5 h-3.5"/> {es ? 'Iniciar' : 'Start'}</>}
              </button>
            </div>
          </div>

            {/* ── Predictor de Fatiga ── */}
            <FatigaPredictor />

            </>);
          })()}

          {/* ── Artículo del día ── */}
          {(() => {
            const article = ARTICLES[articleIdx];
            const catMeta = CATEGORY_META[article.category];
            const title   = es ? article.titleEs   : article.titleEn;
            const summary = es ? article.summaryEs : article.summaryEn;
            return (
              <div className="rounded-2xl overflow-hidden shadow-md">
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
                  onClick={() => onNavigate('learn')}
                  onKeyDown={e => e.key === 'Enter' && onNavigate('learn')}
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

          {/* ── Tip del Día ── */}
          {(() => {
            const tip = TIPS_DEL_DIA[tipIndex];
            return (
              <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-indigo-100 rounded-2xl px-4 py-3 flex items-center gap-3">
                <span className="text-2xl flex-shrink-0">{tip.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wide mb-0.5">Tip del día</p>
                  <p className="text-xs text-gray-700 leading-relaxed">{tip.tip}</p>
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
