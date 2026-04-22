import { useEffect, useState, useRef } from 'react';
import {
  Flame, TrendingDown, TrendingUp, Minus, Bell,
  ChevronRight, ChevronLeft, Play, Pause, BookOpen, Clock,
  Activity, Camera, Glasses, HeartPulse, ScanEye,
} from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../i18n';
import { sql } from '../neonCliente';
import { ARTICLES, CATEGORY_META } from '../data/articles';

type Page =
  | 'login' | 'register' | 'dashboard' | 'questionnaire' | 'exercises'
  | 'exercise-session' | 'history' | 'image-capture' | 'vision-test'
  | 'visual-health' | 'profile' | 'diagnostico-completo' | 'learn';

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
const Dashboard = ({ onNavigate }: { onNavigate: (page: Page) => void }) => {
  const { user } = useUser();
  const { lang } = useLanguage();

  const [stats, setStats] = useState<Stats>({
    evaluaciones: 0, ejercicios: 0, racha: 0,
    tendencia: null, ultimoPuntaje: null, penultimoPuntaje: null,
  });
  const [weekData, setWeekData]     = useState<WeekDay[]>([]);
  const [diagList, setDiagList]     = useState<DiagEntry[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [screenTimeMs, setScreenTimeMs]     = useState(0);
  const [screenTimeRunning, setScreenTimeRunning] = useState(false);
  const [articleIdx, setArticleIdx] = useState(() => Math.floor(Math.random() * ARTICLES.length));
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

  // Rotar artículo cada 60 segundos
  useEffect(() => {
    const iv = setInterval(() => setArticleIdx(i => (i + 1) % ARTICLES.length), 60_000);
    return () => clearInterval(iv);
  }, []);

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
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">

        {/* Top bar */}
        <header className="bg-white border-b border-gray-100 px-6 py-3.5 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-gray-800">
              {es ? `¡Bienvenido de nuevo, ${user?.nombre?.split(' ')[0]}! 👋` : `Welcome back, ${user?.nombre?.split(' ')[0]}! 👋`}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">{es ? 'Cuida tu vista, mejora tu día a día.' : 'Take care of your vision, improve your day.'}</p>
          </div>
          <div className="flex items-center gap-3">
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
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-50">
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

          {/* ── Fila 1: Estado de fatiga + Racha + Recomendación ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Tarjeta fatiga — ocupa 1.5 columnas */}
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
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                  {es ? 'Racha de cuidado' : 'Care streak'} <Flame className="w-4 h-4 text-orange-500"/>
                </p>
              </div>
              <div>
                <p className="text-4xl font-black text-gray-800">{stats.racha} <span className="text-base font-semibold text-gray-400">{es ? 'días' : 'days'}</span></p>
                <p className="text-xs text-green-600 font-semibold mt-0.5">
                  {stats.racha === 0 ? (es ? '¡Empieza hoy!' : 'Start today!') : stats.racha < 3 ? (es ? '¡Sigue así!' : 'Keep it up!') : stats.racha < 7 ? (es ? '¡Vas muy bien!' : 'Going great!') : (es ? '¡Increíble consistencia!' : 'Incredible consistency!')}
                </p>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                {rachaWeek.map((d, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                      ${d.active ? 'bg-green-500 border-green-500 text-white' : d.today ? 'border-indigo-400 text-indigo-500 bg-indigo-50' : 'bg-gray-100 border-gray-200 text-gray-400'}`}>
                      {d.d}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Próxima recomendación */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between">
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">{es ? 'Próxima recomendación' : 'Next recommendation'}</p>
                <p className="text-lg font-bold text-gray-800 leading-snug">{rec.titulo}</p>
                <p className="text-xs text-gray-400 mt-1">{rec.desc}</p>
              </div>
              <button
                onClick={()=>onNavigate(rec.page)}
                className="mt-4 flex items-center justify-between px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-sm font-semibold transition"
              >
                <span className="flex items-center gap-2"><span className="text-lg">{rec.icon}</span> {es ? 'Ir ahora' : 'Go now'}</span>
                <ChevronRight className="w-4 h-4"/>
              </button>
            </div>
          </div>

          {/* ── Acciones rápidas ── */}
          <div>
            <p className="text-sm font-bold text-gray-700 mb-3">{es ? 'Acciones rápidas' : 'Quick actions'}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: Activity,   color: 'bg-violet-100', iconColor: 'text-violet-600', title: es ? 'Ejercicios visuales' : 'Visual exercises',  desc: es ? 'Reduce la fatiga con ejercicios guiados' : 'Reduce fatigue with guided exercises', page: 'exercises' as Page },
                { icon: Camera,     color: 'bg-rose-100',   iconColor: 'text-rose-600',   title: es ? 'Captura de imagen' : 'Image capture',    desc: es ? 'Toma una imagen para análisis visual' : 'Take an image for visual analysis', page: 'image-capture' as Page },
                { icon: Glasses,    color: 'bg-teal-100',   iconColor: 'text-teal-600',   title: es ? 'Prueba de visión' : 'Vision test',     desc: es ? 'Valida tu agudeza visual con Snellen' : 'Validate your visual acuity with Snellen', page: 'vision-test' as Page },
                { icon: HeartPulse, color: 'bg-amber-100',  iconColor: 'text-amber-600',  title: es ? 'Salud Visual' : 'Visual Health',         desc: es ? 'Monitorea tu tiempo en pantalla' : 'Monitor your screen time', page: 'visual-health' as Page },
              ].map((item) => (
                <button
                  key={item.title}
                  onClick={()=>onNavigate(item.page)}
                  className="bg-white rounded-xl p-4 text-left shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all group"
                >
                  <div className={`w-10 h-10 ${item.color} rounded-xl flex items-center justify-center mb-3`}>
                    <item.icon className={`w-5 h-5 ${item.iconColor}`}/>
                  </div>
                  <p className="text-sm font-bold text-gray-800 leading-tight">{item.title}</p>
                  <p className="text-xs text-gray-400 mt-1 leading-snug">{item.desc}</p>
                  <div className="flex items-center gap-1 mt-2 text-indigo-500 text-xs font-semibold group-hover:gap-2 transition-all">
                    {es ? 'Ir' : 'Go'} <ChevronRight className="w-3 h-3"/>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Fila 3: Progreso semanal + Últimos diagnósticos ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Progreso semanal */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-bold text-gray-800">{es ? 'Tu progreso semanal' : 'Your weekly progress'}</p>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  {stats.tendencia === 'mejorando'  && <><TrendingDown className="w-3.5 h-3.5 text-green-500"/> {es ? 'Mejorando' : 'Improving'}</>}
                  {stats.tendencia === 'empeorando' && <><TrendingUp   className="w-3.5 h-3.5 text-red-500"/>   {es ? 'Empeorando' : 'Worsening'}</>}
                  {stats.tendencia === 'estable'    && <><Minus         className="w-3.5 h-3.5 text-yellow-500"/> {es ? 'Estable' : 'Stable'}</>}
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-3">{es ? 'Nivel de fatiga diario (cuestionario)' : 'Daily fatigue level (questionnaire)'}</p>
              {loadingStats
                ? <div className="h-24 flex items-center justify-center"><div className="animate-spin w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent"/></div>
                : <WeeklyChart data={weekData}/>}
            </div>

            {/* Últimos diagnósticos */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col">
              <p className="text-sm font-bold text-gray-800 mb-3">{es ? 'Últimos diagnósticos' : 'Latest diagnostics'}</p>
              {loadingStats
                ? <div className="flex-1 flex items-center justify-center"><div className="animate-spin w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent"/></div>
                : diagList.length === 0
                  ? <div className="flex-1 flex flex-col items-center justify-center text-gray-300 text-sm gap-2">
                      <ScanEye className="w-8 h-8 opacity-40"/>
                      <span>{es ? 'Sin diagnósticos registrados' : 'No diagnostics recorded'}</span>
                    </div>
                  : <div className="space-y-2 flex-1">
                      {diagList.map((d, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                          <div>
                            <p className="text-xs font-semibold text-gray-700">{d.fecha}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold ${d.color}`}>{d.nivel}</span>
                            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getDiagColor(d.score).dot}`}/>
                          </div>
                        </div>
                      ))}
                    </div>}
              <button
                onClick={()=>onNavigate('history')}
                className="mt-3 text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1 self-end"
              >
                {es ? 'Ver historial completo' : 'View full history'} <ChevronRight className="w-3 h-3"/>
              </button>
            </div>
          </div>

          {/* ── Timer pantalla (compacto) ── */}
          <div
            onClick={()=>onNavigate('visual-health')}
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer hover:shadow-md transition"
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${screenTimeRunning ? 'bg-green-100' : 'bg-gray-100'}`}>
                <span className={`w-3 h-3 rounded-full ${screenTimeRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}/>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">{es ? 'Tiempo en pantalla hoy' : 'Screen time today'}</p>
                <p className="text-xs text-gray-400">{screenTimeRunning ? (es ? 'Cronómetro activo' : 'Timer running') : (es ? 'Cronómetro pausado' : 'Timer paused')} · {es ? 'Toca para ver detalles' : 'Tap to view details'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-2xl font-black text-gray-700 font-mono tabular-nums">{screenHH}:{screenMM}:{screenSS}</p>
              <button
                onClick={handleTimerToggle}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-lg transition ${screenTimeRunning ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'}`}
              >
                {screenTimeRunning ? <><Pause className="w-3.5 h-3.5"/> {es ? 'Pausar' : 'Pause'}</> : <><Play className="w-3.5 h-3.5"/> {es ? 'Iniciar' : 'Start'}</>}
              </button>
            </div>
          </div>

          {/* ── Artículo del día ── */}
          {(() => {
            const article = ARTICLES[articleIdx];
            const catMeta = CATEGORY_META[article.category];
            const title   = es ? article.titleEs   : article.titleEn;
            const summary = es ? article.summaryEs : article.summaryEn;
            return (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-50">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-500"/>
                    <p className="text-sm font-bold text-gray-800">{es ? 'Artículo del día' : 'Article of the day'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setArticleIdx(i => (i - 1 + ARTICLES.length) % ARTICLES.length)}
                      className="p-1 rounded-lg hover:bg-gray-100 transition text-gray-400 hover:text-gray-700"
                    >
                      <ChevronLeft className="w-4 h-4"/>
                    </button>
                    <span className="text-[10px] text-gray-400 font-medium tabular-nums">{articleIdx + 1}/{ARTICLES.length}</span>
                    <button
                      onClick={() => setArticleIdx(i => (i + 1) % ARTICLES.length)}
                      className="p-1 rounded-lg hover:bg-gray-100 transition text-gray-400 hover:text-gray-700"
                    >
                      <ChevronRight className="w-4 h-4"/>
                    </button>
                  </div>
                </div>
                <div className="flex gap-0">
                  {/* Barra de acento */}
                  <div className={`w-1 bg-gradient-to-b ${article.accentFrom} ${article.accentTo} flex-shrink-0`}/>
                  <div className="flex flex-1 gap-4 px-5 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${catMeta.bg} ${catMeta.color}`}>
                          {es ? catMeta.labelEs : catMeta.labelEn}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-gray-400">
                          <Clock className="w-3 h-3"/>
                          {article.readMinutes} min
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-gray-800 leading-snug mb-1 line-clamp-2">{title}</h3>
                      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{summary}</p>
                      <button
                        onClick={() => onNavigate('learn')}
                        className="mt-3 flex items-center gap-1 text-indigo-600 text-xs font-semibold hover:gap-2 transition-all"
                      >
                        {es ? 'Leer artículo' : 'Read article'} <ChevronRight className="w-3.5 h-3.5"/>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

        </main>
    </div>
  );
};

export default Dashboard;
