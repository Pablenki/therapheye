import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ArrowLeft, HeartPulse, Play, Pause, RotateCcw, Clock,
  AlarmClock, StopCircle, Calendar, TrendingUp, X, Settings, Trash2,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Eye } from 'lucide-react';
import { sql, localISOString } from '../neonCliente';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../i18n';
import { loadTimerPrefs, saveTimerPrefs } from '../components/GlobalTimerWidget';

// ─── Período de gráfica ───────────────────────────────────────────────────────
type ChartPeriod = '7d' | '1m' | '3m' | '1a' | 'all';
const PERIOD_MS_VH: Record<Exclude<ChartPeriod, 'all'>, number> = {
  '7d': 7 * 86_400_000,
  '1m': 30 * 86_400_000,
  '3m': 90 * 86_400_000,
  '1a': 365 * 86_400_000,
};
function vhGetWindow(period: ChartPeriod, offset: number): { from: Date | null; to: Date } {
  if (period === 'all') return { from: null, to: new Date() };
  const ms = PERIOD_MS_VH[period];
  const to = new Date(Date.now() - offset * ms);
  return { from: new Date(to.getTime() - ms), to };
}
function vhPeriodLabel(period: ChartPeriod, offset: number, lang: string): string {
  if (period === 'all') return lang === 'es' ? 'Todo el historial' : 'All history';
  const { from, to } = vhGetWindow(period, offset);
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
  const locale = lang === 'es' ? 'es-MX' : 'en-US';
  return `${from!.toLocaleDateString(locale, opts)} – ${to.toLocaleDateString(locale, opts)} ${to.getFullYear()}`;
}
const VH_PERIOD_BTNS: { key: ChartPeriod; es: string; en: string }[] = [
  { key: '7d',  es: '7D',   en: '7D'  },
  { key: '1m',  es: '1M',   en: '1M'  },
  { key: '3m',  es: '3M',   en: '3M'  },
  { key: '1a',  es: '1A',   en: '1Y'  },
  { key: 'all', es: 'Todo', en: 'All' },
];
const VH_PAGE_SIZE = 5;

type Props = {
  onBack: () => void;
};

// ─── Configura aquí los intervalos (regla 20-20-20) hola jeje──────────────────────────
const WORK_MINUTES  = 20; // minutos de trabajo antes de cada descanso
const BREAK_MINUTES = 1;  // minutos de descanso recomendados
// ─────────────────────────────────────────────────────────────────────────────

// ─── Límite de seguridad: sesión máxima de 16h (evita datos corruptos) ────────
const MAX_SESSION_MS = 16 * 60 * 60 * 1000;

type PersistedTimerState = {
  isRunning: boolean;
  startTimestamp: number | null;
  accumulatedMs: number;
  nextBreakAtMs: number | null;
  sessionStartTimestamp: number | null;
  finalized?: boolean;
  stateDate?: string | null;
};

type SessionRecord = {
  id: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  startTimestampRaw: number;
  endTimestampRaw: number;
};

type DailyAggregate = {
  dateKey: string;      // "2026-03-09"
  dateLabel: string;    // "09 mar"
  totalMinutes: number;
  sessions: { startHour: string; endHour: string; durationMs: number }[];
};

const STORAGE_KEY          = 'therapeye_visual_health_timer';
const SESSIONS_STORAGE_KEY = 'therapeye_visual_health_sessions';

// ─── Utilidades ───────────────────────────────────────────────────────────────

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

const formatDuration = (totalSeconds: number) => {
  // Guard: nunca mostrar valores negativos (protección contra cambio de reloj del sistema)
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

// ─── Calcular ms transcurridos con protección anti-clock-change ───────────────
const calcElapsedMs = (state: PersistedTimerState): number => {
  const now = Date.now();
  let ms = state.accumulatedMs;
  if (state.isRunning && state.startTimestamp) {
    const delta = now - state.startTimestamp;
    // Si el reloj se movió hacia atrás → delta negativo → ignorar esa diferencia
    // Si el delta es absurdamente grande (> 16h) → probablemente cambio de fecha para testing
    if (delta > 0 && delta < MAX_SESSION_MS) {
      ms += delta;
    } else if (delta <= 0) {
      // Reloj atrasado: resetear startTimestamp al "ahora" para no acumular negativos
      // (se corrige en el siguiente guardado)
    }
  }
  return Math.max(0, Math.min(ms, MAX_SESSION_MS));
};

const formatSessionDuration = (ms: number) => {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours   = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
};

const formatDateTime = (ts: number, lang: 'es' | 'en' = 'es') =>
  new Date(ts).toLocaleString(lang === 'en' ? 'en-US' : 'es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

const formatHour = (ts: number, lang: 'es' | 'en' = 'es') =>
  new Date(ts).toLocaleString(lang === 'en' ? 'en-US' : 'es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });

// Sessions are now loaded/saved via DB (loadSessionsFromDB in the component)

// ─── Agrupar sesiones por día ─────────────────────────────────────────────────

const aggregateByDay = (sessions: SessionRecord[]): DailyAggregate[] => {
  const map = new Map<string, DailyAggregate>();

  for (const s of sessions) {
    // Fallback: si no tiene startTimestampRaw (sesiones guardadas antes del campo),
    // intentamos usar el id que se construyó como String(Date.now())
    const ts = s.startTimestampRaw || parseInt(s.id, 10) || 0;
    if (!ts) continue;
    const d = new Date(ts);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dateLabel = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });

    if (!map.has(dateKey)) {
      map.set(dateKey, { dateKey, dateLabel, totalMinutes: 0, sessions: [] });
    }
    const agg = map.get(dateKey)!;
    agg.totalMinutes += s.durationMs / 60_000;
    const startTs = s.startTimestampRaw || parseInt(s.id, 10) || 0;
    const endTs   = s.endTimestampRaw   || (startTs + s.durationMs);
    agg.sessions.push({
      startHour:  formatHour(startTs),
      endHour:    formatHour(endTs),
      durationMs: s.durationMs,
    });
  }

  return Array.from(map.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
};

// ─── Colores de nivel (4 niveles como History.tsx) ────────────────────────────
// < 2 h → verde (uso ligero)
// 2-4 h → amarillo (uso moderado)
// 4-6 h → naranja (uso considerable)
// > 6 h → rojo   (uso excesivo)

const dotColor = (minutes: number) => {
  if (minutes < 120) return '#16a34a';
  if (minutes < 240) return '#ca8a04';
  if (minutes < 360) return '#ea580c';
  return '#dc2626';
};

// ─── Gráfica SVG de tendencia (estilo History.tsx) ────────────────────────────
// Cambios clave respecto al comportamiento anterior:
//   · Acepta totalSessions para habilitar el render desde 2+ sesiones en total
//     (antes requería 2+ días distintos → con 2 sesiones en el mismo día no dibujaba).
//   · Si solo hay 1 día agregado, se muestra un punto único (no líneas).
//   · Añade tooltip *en hover* sobre cada punto con resumen de horas y picos.

const ScreenTimeTrendChart = ({
  data,
  onSelectDay,
  selectedDateKey,
  totalSessions,
  t,
  lang,
}: {
  data: DailyAggregate[];
  onSelectDay: (dateKey: string | null) => void;
  selectedDateKey: string | null;
  totalSessions: number;
  t: any;
  lang: string;
}) => {
  const [period, setPeriod] = useState<ChartPeriod>('1m');
  const [offset, setOffset] = useState(0);

  // Filtrar data por período
  const { from, to } = vhGetWindow(period, offset);
  const filteredData = data.filter(d => {
    const day = new Date(d.dateKey);
    if (from && day < from) return false;
    if (day > to) return false;
    return true;
  });

  // Barra de período
  const PNav = () => (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <div className="flex gap-1 flex-wrap">
        {VH_PERIOD_BTNS.map(b => (
          <button key={b.key} onClick={() => { setPeriod(b.key); setOffset(0); }}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition
              ${period === b.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {lang === 'es' ? b.es : b.en}
          </button>
        ))}
      </div>
      {period !== 'all' && (
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => setOffset(o => o + 1)}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-500 min-w-[150px] text-center font-medium">
            {vhPeriodLabel(period, offset, lang)}
          </span>
          <button onClick={() => setOffset(o => Math.max(0, o - 1))} disabled={offset === 0}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-30 transition">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );

  // Permitimos pintar la gráfica desde que haya ≥ 2 registros (sesiones) totales,
  // aun cuando ambos caigan el mismo día (se mostrará un único punto).
  const insufficient = data.length === 0 || totalSessions < 2;
  if (insufficient) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-gray-400">
        <TrendingUp className="w-10 h-10 mb-2 opacity-30" />
        <p className="text-sm">{t('visualHealth', 'needMoreDays')}</p>
      </div>
    );
  }

  if (filteredData.length === 0) {
    return (
      <>
        <PNav />
        <div className="flex flex-col items-center justify-center h-40 text-gray-400">
          <TrendingUp className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">{lang === 'es' ? 'Sin datos en este período' : 'No data in this period'}</p>
        </div>
      </>
    );
  }

  const W = 560, H = 180;
  const PAD = { top: 20, right: 20, bottom: 40, left: 48 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const chartData = filteredData;
  const maxMinutes = chartData.length > 0 ? Math.max(...chartData.map(d => d.totalMinutes)) : 60;
  // Redondear al siguiente múltiplo de 60 (hora completa) para escala limpia
  const ceilHour = Math.max(Math.ceil(maxMinutes / 60) * 60, 60);

  const xStep = chartData.length > 1 ? chartW / (chartData.length - 1) : chartW;
  const toX = (i: number) => PAD.left + i * xStep;
  const toY = (v: number) => PAD.top + chartH - (v / ceilHour) * chartH;

  // Línea
  const linePath = chartData
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(d.totalMinutes)}`)
    .join(' ');

  // Área
  const areaPath = chartData.length > 0
    ? `M ${toX(0)} ${toY(chartData[0].totalMinutes)} ` +
      chartData.slice(1).map((d, i) => `L ${toX(i + 1)} ${toY(d.totalMinutes)}`).join(' ') +
      ` L ${toX(chartData.length - 1)} ${PAD.top + chartH} L ${toX(0)} ${PAD.top + chartH} Z`
    : '';

  // Etiquetas Y (horas)
  const ySteps: number[] = [];
  const hourStep = Math.max(1, Math.ceil(ceilHour / 60 / 4));
  for (let h = 0; h * 60 <= ceilHour; h += hourStep) ySteps.push(h * 60);

  // Zonas de color — proporcionales al ceil
  const zones = [
    { from: 0, to: Math.min(120, ceilHour), fill: '#bbf7d0' },
    { from: 120, to: Math.min(240, ceilHour), fill: '#fef08a' },
    { from: 240, to: Math.min(360, ceilHour), fill: '#fed7aa' },
    { from: 360, to: ceilHour, fill: '#fecaca' },
  ].filter(z => z.from < ceilHour);

  return (
    <>
    <PNav />
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full cursor-pointer" aria-label={t('visualHealth', 'trendTitle')}>
      <defs>
        <linearGradient id="screenAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#6366f1" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
        </linearGradient>
        <clipPath id="screenChartClip">
          <rect x={PAD.left} y={PAD.top} width={chartW} height={chartH} />
        </clipPath>
      </defs>

      {/* Zonas de color */}
      <g clipPath="url(#screenChartClip)">
        {zones.map((z, i) => (
          <rect key={i}
            x={PAD.left} y={toY(z.to)} width={chartW}
            height={toY(z.from) - toY(z.to)} fill={z.fill} opacity="0.3"
          />
        ))}
      </g>

      {/* Grid + etiquetas Y */}
      {ySteps.map(v => (
        <g key={v}>
          <line x1={PAD.left} y1={toY(v)} x2={PAD.left + chartW} y2={toY(v)}
            stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 3" />
          <text x={PAD.left - 6} y={toY(v) + 4} textAnchor="end" fontSize="9" fill="#9ca3af">
            {v < 60 ? `${v}m` : `${v / 60}h`}
          </text>
        </g>
      ))}

      {/* Área */}
      <path d={areaPath} fill="url(#screenAreaGrad)" />

      {/* Línea */}
      <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" />

      {/* Puntos interactivos */}
      {chartData.map((d, i) => {
        const isSelected = d.dateKey === selectedDateKey;
        const cx = toX(i), cy = toY(d.totalMinutes);
        const color = dotColor(d.totalMinutes);
        const hours = Math.floor(d.totalMinutes / 60);
        const mins  = Math.round(d.totalMinutes % 60);
        const label = hours > 0 ? `${hours}h${mins > 0 ? `${mins}m` : ''}` : `${mins}m`;

        return (
          <g key={d.dateKey} onClick={() => onSelectDay(isSelected ? null : d.dateKey)}
            style={{ cursor: 'pointer' }}>
            {/* Línea vertical */}
            <line x1={cx} y1={PAD.top} x2={cx} y2={PAD.top + chartH}
              stroke="#6366f1" strokeWidth="1" strokeDasharray="3 3" opacity={isSelected ? 0.5 : 0.2} />
            {/* Halo */}
            <circle cx={cx} cy={cy} r={isSelected ? 10 : 7} fill={color} opacity={isSelected ? 0.35 : 0.2} />
            {/* Punto */}
            <circle cx={cx} cy={cy} r={isSelected ? 6 : 4.5} fill={color}
              stroke="white" strokeWidth={isSelected ? 2 : 1.5} />
            {/* Valor */}
            <text x={cx} y={cy - 12} textAnchor="middle" fontSize="9" fontWeight="bold" fill={color}>
              {label}
            </text>
            {/* Fecha */}
            <text x={cx} y={PAD.top + chartH + 14} textAnchor="middle" fontSize="8" fill="#6b7280"
              transform={chartData.length > 6 ? `rotate(-30, ${cx}, ${PAD.top + chartH + 14})` : undefined}>
              {d.dateLabel}
            </text>
          </g>
        );
      })}

      {/* Ejes */}
      <line x1={PAD.left} y1={PAD.top + chartH} x2={PAD.left + chartW} y2={PAD.top + chartH}
        stroke="#d1d5db" strokeWidth="1" />
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + chartH}
        stroke="#d1d5db" strokeWidth="1" />
    </svg>
    </>
  );
};

// ─── Panel de detalle del día seleccionado ────────────────────────────────────

const DayDetailPanel = ({ day, onClose, t }: { day: DailyAggregate; onClose: () => void; t: any }) => {
  // Calcular las horas del día donde más se usó (buckets de 1h: 0-23)
  // Usamos las sesiones con su hora de inicio para llenar los buckets
  const hourBuckets: number[] = new Array(24).fill(0);
  for (const s of day.sessions) {
    // Parsear hora de inicio "HH:MM"
    const parts = s.startHour.split(':');
    const h = parseInt(parts[0], 10);
    if (!isNaN(h)) hourBuckets[h] += s.durationMs / 60_000;
  }
  const maxBucket = Math.max(...hourBuckets);

  // Top horas más activas (hasta 3)
  const topHours = hourBuckets
    .map((min, h) => ({ h, min }))
    .filter(x => x.min > 0)
    .sort((a, b) => b.min - a.min)
    .slice(0, 3);

  const totalH  = Math.floor(day.totalMinutes / 60);
  const totalM  = Math.round(day.totalMinutes % 60);
  const color   = dotColor(day.totalMinutes);

  return (
    <div className="bg-white border border-indigo-200 rounded-xl shadow-lg p-5 mt-4 animate-in fade-in">
      {/* Cabecera */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: color + '20' }}>
            <Calendar className="w-5 h-5" style={{ color }} />
          </div>
          <div>
            <p className="font-bold text-gray-800">{t('visualHealth', 'dayDetail')} {day.dateLabel}</p>
            <p className="text-xs text-gray-500">
              {day.sessions.length} {day.sessions.length === 1 ? t('common', 'session') : t('common', 'sessions')} — {t('common', 'total')}:{' '}
              <span className="font-semibold" style={{ color }}>
                {totalH > 0 ? `${totalH} ${t('common', 'hours')} ` : ''}{totalM} {t('common', 'min')}
              </span>
            </p>
          </div>
        </div>
        <button onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Sesiones del día */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">{t('visualHealth', 'sessionsHistory')}</p>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {day.sessions.map((s, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-xs text-gray-700 font-medium">{s.startHour} — {s.endHour}</span>
                </div>
                <span className="text-xs font-bold text-indigo-600">
                  {formatSessionDuration(s.durationMs)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Horas pico */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">{t('visualHealth', 'peakHours')}</p>
          {topHours.length === 0 ? (
            <p className="text-xs text-gray-400">{t('visualHealth', 'noSufficientData')}</p>
          ) : (
            <div className="space-y-2">
              {topHours.map(({ h, min }) => {
                const pct = maxBucket > 0 ? (min / maxBucket) * 100 : 0;
                return (
                  <div key={h}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-medium text-gray-700">
                        {String(h).padStart(2, '0')}:00 — {String(h + 1).padStart(2, '0')}:00
                      </span>
                      <span className="text-xs font-bold text-indigo-600">{Math.round(min)} min</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: dotColor(min * (480 / 60)) }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────

const VisualHealth = ({ onBack }: Props) => {
  const { user } = useUser();
  const { t, lang } = useLanguage();
  const [isRunning, setIsRunning]                   = useState(false);
  const [elapsedSeconds, setElapsedSeconds]         = useState(0);
  const [nextBreakInMinutes, setNextBreakInMinutes] = useState<number | null>(null);
  const [sessions, setSessions]                     = useState<SessionRecord[]>([]);
  const [sessionPage, setSessionPage]               = useState(0);
  const [selectedDay, setSelectedDay]               = useState<string | null>(null);
  const [countdown, setCountdown]                   = useState<number | null>(null);

  // ── Preferencias / onboarding ──────────────────────────────────────────────
  const [notifyOnLogin, setNotifyOnLogin]           = useState(() => loadTimerPrefs().notifyOnLogin);
  const [showOnboarding, setShowOnboarding]         = useState(() => !loadTimerPrefs().onboardingCompleted);

  // ── Modales de confirmación ────────────────────────────────────────────────
  type ConfirmAction = 'reset' | 'terminate' | null;
  const [confirmAction, setConfirmAction]           = useState<ConfirmAction>(null);
  const [deleteSessionId, setDeleteSessionId]       = useState<string | null>(null);

  const stateRef = useRef<PersistedTimerState>({
    isRunning: false,
    startTimestamp: null,
    accumulatedMs: 0,
    nextBreakAtMs: null,
    sessionStartTimestamp: null,
  });

  const saveState = useCallback((state: PersistedTimerState) => {
    stateRef.current = state;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { /* noop */ }
  }, []);

  // Cargar sesiones SOLO desde BD — localStorage ya no es fuente de verdad para sesiones
  const loadSessionsFromDB = useCallback(async () => {
    // Sin usuario autenticado → historial vacío (no mostrar datos locales obsoletos)
    if (!user?.id) {
      setSessions([]);
      return;
    }

    try {
      // Crear tabla si no existe (idempotente)
      await sql`
        CREATE TABLE IF NOT EXISTS sesiones_salud_visual (
          id          SERIAL PRIMARY KEY,
          user_id     TEXT        NOT NULL,
          started_at  TIMESTAMPTZ NOT NULL,
          ended_at    TIMESTAMPTZ NOT NULL,
          duration_ms BIGINT      NOT NULL,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      const rows = await sql`
        SELECT id, started_at, ended_at, duration_ms
        FROM   sesiones_salud_visual
        WHERE  user_id = ${user.id}
        ORDER  BY started_at DESC
        LIMIT  200
      `;

      // Siempre usar el resultado de BD (aunque sea vacío), borrando cualquier dato local obsoleto
      const dbSessions: SessionRecord[] = rows.map((r: Record<string, unknown>) => {
        const startTs = new Date(String(r.started_at)).getTime();
        const endTs   = new Date(String(r.ended_at)).getTime();
        return {
          id:                String(r.id),
          startedAt:         formatDateTime(startTs, lang),
          endedAt:           formatDateTime(endTs, lang),
          durationMs:        Number(r.duration_ms),
          startTimestampRaw: startTs,
          endTimestampRaw:   endTs,
        };
      });
      setSessions(dbSessions);
      // Limpiar localStorage de sesiones para que no queden datos huérfanos
      try { localStorage.removeItem(SESSIONS_STORAGE_KEY); } catch { /* noop */ }
    } catch (err) {
      console.warn('[VisualHealth] Error cargando sesiones de BD:', err);
      // En caso de fallo de red → mostrar vacío en lugar de datos locales obsoletos
      setSessions([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Cargar estado y sesiones al montar
  useEffect(() => {
    loadSessionsFromDB();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: PersistedTimerState = JSON.parse(raw);
        const elapsedMs = calcElapsedMs(parsed);
        setElapsedSeconds(Math.floor(elapsedMs / 1000));
        setIsRunning(parsed.isRunning);
        if (parsed.nextBreakAtMs != null) {
          const rem = parsed.nextBreakAtMs - elapsedMs;
          setNextBreakInMinutes(rem > 0 ? Math.round(rem / 60000) : 0);
        }
        // Si el reloj fue manipulado y tenemos un startTimestamp inválido, corregirlo
        if (parsed.isRunning && parsed.startTimestamp) {
          const delta = Date.now() - parsed.startTimestamp;
          if (delta < 0 || delta > MAX_SESSION_MS) {
            // Resetear startTimestamp al ahora con los ms acumulados correctos
            saveState({ ...parsed, startTimestamp: Date.now(), accumulatedMs: elapsedMs });
            return;
          }
        }
        stateRef.current = parsed;
      } else {
        saveState(stateRef.current);
      }
    } catch { saveState(stateRef.current); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Intervalo — con protección anti-clock-change y detección de sleep/suspend
  useEffect(() => {
    let lastTickTs = Date.now();
    const SLEEP_THRESHOLD_MS = 30_000;

    const interval = setInterval(() => {
      const now = Date.now();
      const gap = now - lastTickTs;
      lastTickTs = now;
      const cur = stateRef.current;

      // ═══ Detección de sleep/suspend ═══
      if (gap > SLEEP_THRESHOLD_MS && cur.isRunning) {
        const msBeforeSleep = cur.accumulatedMs + (cur.startTimestamp ? (now - gap + 1000 - cur.startTimestamp) : 0);
        const safeMsBeforeSleep = Math.max(0, Math.min(msBeforeSleep, MAX_SESSION_MS));
        saveState({
          ...cur,
          isRunning: false,
          startTimestamp: null,
          accumulatedMs: safeMsBeforeSleep,
        });
        setIsRunning(false);
        setElapsedSeconds(Math.floor(safeMsBeforeSleep / 1000));
        setNextBreakInMinutes(null);
        return;
      }

      const ms  = calcElapsedMs(cur);
      setElapsedSeconds(Math.floor(ms / 1000));

      // Detectar salto de reloj: si delta entre ticks > 5s, corregir startTimestamp
      if (cur.isRunning && cur.startTimestamp) {
        const delta = now - cur.startTimestamp;
        if (delta < 0 || delta > MAX_SESSION_MS) {
          saveState({ ...cur, startTimestamp: now, accumulatedMs: ms });
          return;
        }
      }

      if (cur.isRunning) {
        if (cur.nextBreakAtMs == null) {
          const nb = WORK_MINUTES * 60_000;
          saveState({ ...cur, nextBreakAtMs: nb });
          setNextBreakInMinutes(Math.round((nb - ms) / 60000));
          return;
        }
        if (ms >= cur.nextBreakAtMs) {
          playBeep();
          // lang from useLanguage destructuring
          speakText(t('visualHealth', 'takeBreakVoice'), lang);
          const nb = cur.nextBreakAtMs + WORK_MINUTES * 60_000;
          saveState({ ...cur, nextBreakAtMs: nb });
          setNextBreakInMinutes(Math.max(0, Math.round((nb - ms) / 60000)));
        } else {
          setNextBreakInMinutes(Math.max(0, Math.round((cur.nextBreakAtMs - ms) / 60000)));
        }
      } else {
        setNextBreakInMinutes(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [saveState]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const doStart = () => {
    const now = Date.now();
    saveState({
      ...stateRef.current,
      isRunning: true,
      startTimestamp: now,
      sessionStartTimestamp: stateRef.current.sessionStartTimestamp ?? now,
      finalized: false,
      stateDate: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })(),
    });
    setIsRunning(true);
  };

  const handleStartOrResume = () => {
    if (stateRef.current.isRunning || countdown !== null) return;

    // Si ya tiene tiempo acumulado → reanudar directo, sin conteo
    if (stateRef.current.accumulatedMs > 0) {
      doStart();
      return;
    }

    // Primera vez (0:00) → conteo 3-2-1
    let count = 3;
    const tick = () => {
      if (count > 0) {
        setCountdown(count);
        count--;
        setTimeout(tick, 1000);
      } else {
        setCountdown(null);
        doStart();
      }
    };
    speakText(t('visualHealth', 'countdownStarts'), lang);
    setTimeout(tick, 700);
  };

  const handlePause = () => {
    const cur = stateRef.current;
    if (!cur.isRunning) return;
    const ms = calcElapsedMs(cur);
    saveState({ ...cur, isRunning: false, startTimestamp: null, accumulatedMs: ms });
    setIsRunning(false);
  };

  const handleReset = () => setConfirmAction('reset');

  const doReset = () => {
    const todayDate = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
    const resetState: PersistedTimerState = { isRunning: false, startTimestamp: null, accumulatedMs: 0, nextBreakAtMs: null, sessionStartTimestamp: null, finalized: false, stateDate: todayDate };
    saveState(resetState);
    // Sincronizar a BD inmediatamente (no esperar el debounce de 30s)
    if (user?.id) {
      sql`
        INSERT INTO timer_state (user_id, fecha, accumulated_ms, is_running, last_start_ts, session_start_ts, next_break_at_ms, finalized, updated_at)
        VALUES (${user.id}, ${todayDate}, 0, false, NULL, NULL, NULL, false, NOW())
        ON CONFLICT (user_id, fecha)
        DO UPDATE SET
          accumulated_ms   = 0,
          is_running       = false,
          last_start_ts    = NULL,
          session_start_ts = NULL,
          next_break_at_ms = NULL,
          finalized        = false,
          updated_at       = NOW()
      `.catch(err => console.warn('[VisualHealth] Error syncing reset to DB:', err));
    }
    setIsRunning(false);
    setElapsedSeconds(0);
    setNextBreakInMinutes(null);
    setConfirmAction(null);
  };

  // ── Toggle preferencia notifyOnLogin ──────────────────────────────────────
  const handleToggleNotifyOnLogin = () => {
    const prefs = loadTimerPrefs();
    const next = !prefs.notifyOnLogin;
    saveTimerPrefs({ ...prefs, notifyOnLogin: next }, user?.id);
    setNotifyOnLogin(next);
  };

  // ── Completar onboarding ───────────────────────────────────────────────────
  const handleOnboardingActivate = () => {
    const prefs = loadTimerPrefs();
    saveTimerPrefs({ ...prefs, onboardingCompleted: true, notifyOnLogin: true }, user?.id);
    setNotifyOnLogin(true);
    setShowOnboarding(false);
  };

  const handleOnboardingSkip = () => {
    const prefs = loadTimerPrefs();
    saveTimerPrefs({ ...prefs, onboardingCompleted: true }, user?.id);
    setShowOnboarding(false);
  };

  const terminatingRef = useRef(false);

  const handleTerminate = () => setConfirmAction('terminate');

  const doTerminate = async () => {
    setConfirmAction(null);
    await executeTerminate();
  };

  const executeTerminate = async () => {
    // Guard against double-fire
    if (terminatingRef.current) return;
    terminatingRef.current = true;

    const cur = stateRef.current;
    const now = Date.now();
    const ms  = calcElapsedMs(cur);
    // lang from useLanguage() destructuring

    // Solo guardar si la sesión duró al menos 3 minutos (evita ruido en el historial)
    if (ms > 3 * 60_000 && cur.sessionStartTimestamp) {
      const start = cur.sessionStartTimestamp ?? (now - ms);
      const record: SessionRecord = {
        id:                String(now),
        startedAt:         formatDateTime(start, lang),
        endedAt:           formatDateTime(now, lang),
        durationMs:        ms,
        startTimestampRaw: start,
        endTimestampRaw:   now,
      };

      // Guardar solo en BD — localStorage ya no es fuente de verdad para sesiones
      if (user?.id) {
        try {
          await sql`
            INSERT INTO sesiones_salud_visual
              (user_id, started_at, ended_at, duration_ms, created_at)
            VALUES (
              ${user.id},
              ${localISOString(new Date(start))},
              ${localISOString(new Date(now))},
              ${ms},
              NOW()
            )
          `;
          // Actualizar estado local con la sesión recién guardada
          setSessions(prev => [record, ...prev]);
        } catch (err) {
          console.warn('[VisualHealth] No se pudo guardar sesión en BD:', err);
        }
      }
    }

    // Finalizar: resetear el timer a cero y marcarlo como finalizado
    const todayDate = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
    saveState({
      isRunning: false,
      startTimestamp: null,
      accumulatedMs: 0,           // Reset a 0 — la sesión ya quedó guardada en historial
      nextBreakAtMs: null,
      sessionStartTimestamp: null,
      finalized: true,            // Prevents auto-start on next login
      stateDate: todayDate,
    });
    // Sincronizar a BD inmediatamente
    if (user?.id) {
      sql`
        INSERT INTO timer_state (user_id, fecha, accumulated_ms, is_running, last_start_ts, session_start_ts, next_break_at_ms, finalized, updated_at)
        VALUES (${user.id}, ${todayDate}, 0, false, NULL, NULL, NULL, true, NOW())
        ON CONFLICT (user_id, fecha)
        DO UPDATE SET
          accumulated_ms   = 0,
          is_running       = false,
          last_start_ts    = NULL,
          session_start_ts = NULL,
          next_break_at_ms = NULL,
          finalized        = true,
          updated_at       = NOW()
      `.catch(err => console.warn('[VisualHealth] Error syncing terminate to DB:', err));
    }
    setIsRunning(false);
    setElapsedSeconds(0);         // Mostrar 0 en todos lados
    setNextBreakInMinutes(null);
    terminatingRef.current = false;
  };

  // ── Eliminar sesión del historial ─────────────────────────────────────────
  const handleDeleteSession = async (sessionId: string) => {
    setDeleteSessionId(null);
    if (user?.id) {
      try {
        await sql`DELETE FROM sesiones_salud_visual WHERE id = ${sessionId} AND user_id = ${user.id}`;
      } catch (err) {
        console.warn('[VisualHealth] Error eliminando sesión:', err);
      }
    }
    setSessions(prev => prev.filter(s => s.id !== sessionId));
  };

  // ── Datos derivados ─────────────────────────────────────────────────────────

  const totalHours     = elapsedSeconds / 3600;
  const dailyData      = aggregateByDay(sessions);
  const selectedDayObj = selectedDay ? dailyData.find(d => d.dateKey === selectedDay) ?? null : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">

      {/* ── Modal de confirmación: Reiniciar / Finalizar ── */}
      {(confirmAction === 'reset' || confirmAction === 'terminate') && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-7 max-w-sm w-full mx-4 flex flex-col gap-4">
            <h2 className="text-lg font-bold text-gray-800">
              {confirmAction === 'reset' ? t('visualHealth', 'confirmResetTitle') : t('visualHealth', 'confirmTerminateTitle')}
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              {confirmAction === 'reset' ? t('visualHealth', 'confirmResetMsg') : t('visualHealth', 'confirmTerminateMsg')}
            </p>
            <div className="flex gap-3 justify-end mt-1">
              <button onClick={() => setConfirmAction(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition">
                {t('visualHealth', 'confirmNo')}
              </button>
              <button
                onClick={confirmAction === 'reset' ? doReset : doTerminate}
                className={`px-5 py-2 rounded-xl text-sm font-semibold text-white transition shadow ${
                  confirmAction === 'reset' ? 'bg-red-600 hover:bg-red-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {confirmAction === 'reset' ? t('visualHealth', 'confirmYesReset') : t('visualHealth', 'confirmYesTerminate')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de confirmación: Eliminar sesión ── */}
      {deleteSessionId && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-7 max-w-sm w-full mx-4 flex flex-col gap-4">
            <h2 className="text-lg font-bold text-gray-800">{t('visualHealth', 'confirmDeleteTitle')}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{t('visualHealth', 'confirmDeleteMsg')}</p>
            <div className="flex gap-3 justify-end mt-1">
              <button onClick={() => setDeleteSessionId(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition">
                {t('visualHealth', 'confirmNo')}
              </button>
              <button onClick={() => handleDeleteSession(deleteSessionId)}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition shadow">
                {t('visualHealth', 'confirmYesDelete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de onboarding (primera vez) ── */}
      {showOnboarding && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <HeartPulse className="w-6 h-6 text-indigo-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">{t('visualHealth', 'onboardingTitle')}</h2>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{t('visualHealth', 'onboardingDesc')}</p>
            <div className="bg-indigo-50 rounded-xl p-4 text-sm text-indigo-900 space-y-1.5 border border-indigo-100">
              <p className="font-semibold flex items-center gap-2"><AlarmClock className="w-4 h-4 text-indigo-500" /> {t('visualHealth', 'breakReminders')}</p>
              <p className="text-xs text-indigo-700">{t('visualHealth', 'breakMsg1')} <strong>{WORK_MINUTES}</strong> {t('visualHealth', 'breakMsg2')} <strong>{BREAK_MINUTES}</strong> {t('visualHealth', 'breakMsg3')}</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleOnboardingSkip}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-100 transition"
              >
                {t('visualHealth', 'onboardingSkip')}
              </button>
              <button
                onClick={handleOnboardingActivate}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow"
              >
                {t('visualHealth', 'onboardingActivate')}
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
          <button onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition">
            <ArrowLeft className="w-5 h-5" />
            <span>{t('common', 'backToDashboard')}</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-10 pb-24 space-y-8">

        {/* ── Tarjeta del cronómetro ── */}
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center">
                <HeartPulse className="w-7 h-7 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">{t('visualHealth', 'title')}</h2>
                <p className="text-gray-500 text-sm">{t('visualHealth', 'subtitle')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              <span>
                {t('visualHealth', 'screenTimeToday')}{' '}
                <span className="font-semibold text-gray-800">{totalHours.toFixed(1)} {t('common', 'hours')}</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-8">
            {/* Reloj */}
            <div className="flex-1 flex flex-col items-center">
              <div className="w-48 h-48 rounded-full bg-gray-900 text-white flex flex-col items-center justify-center shadow-inner mb-4">
                <span className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-1">{t('visualHealth', 'activeTime')}</span>
                <span className="text-3xl md:text-4xl font-mono font-bold">{formatDuration(elapsedSeconds)}</span>
              </div>

              <div className="flex items-center gap-3 mb-3 flex-wrap justify-center">
                {isRunning ? (
                  <button onClick={handlePause}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-600 text-white font-semibold hover:bg-red-700 transition shadow">
                    <Pause className="w-5 h-5" /> {t('common', 'pause')}
                  </button>
                ) : countdown !== null ? (
                  <button disabled
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-green-500 text-white font-bold shadow cursor-not-allowed min-w-[110px] justify-center">
                    <span className="text-xl leading-none">{countdown}</span>
                  </button>
                ) : (
                  <button onClick={handleStartOrResume}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-green-600 text-white font-semibold hover:bg-green-700 transition shadow">
                    <Play className="w-5 h-5" /> {t('common', 'start')}
                  </button>
                )}
                <button onClick={handleReset} disabled={countdown !== null || elapsedSeconds === 0}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition disabled:opacity-40 disabled:cursor-not-allowed">
                  <RotateCcw className="w-5 h-5" /> {t('common', 'reset')}
                </button>
                <button onClick={handleTerminate} disabled={elapsedSeconds === 0 || countdown !== null}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition shadow disabled:opacity-40 disabled:cursor-not-allowed">
                  <StopCircle className="w-5 h-5" /> {t('visualHealth', 'terminate')}
                </button>
              </div>

              {nextBreakInMinutes != null && isRunning && (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                  <AlarmClock className="w-3 h-3" />
                  <span>
                    {t('visualHealth', 'nextBreak')}{' '}
                    <span className="font-semibold">
                      {nextBreakInMinutes <= 1 ? t('visualHealth', 'lessThan1Min') : `${nextBreakInMinutes} ${t('common', 'min')}`}
                    </span>
                  </span>
                </div>
              )}
            </div>

            {/* Info descansos + Configuración */}
            <div className="flex-1 space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <AlarmClock className="w-5 h-5 text-indigo-500" />
                {t('visualHealth', 'breakReminders')}
              </h3>
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-900 space-y-2">
                <p className="font-semibold">{t('visualHealth', 'activeBreak')}</p>
                <p>
                  {t('visualHealth', 'breakMsg1')} <span className="font-bold">{WORK_MINUTES}</span> {t('visualHealth', 'breakMsg2')}
                  <span className="font-bold">{BREAK_MINUTES}</span> {t('visualHealth', 'breakMsg3')}
                </p>
                <p className="text-xs text-indigo-700 mt-1">
                  {t('visualHealth', 'timerNote')}
                </p>
              </div>

              {/* ── Configuración inline ── */}
              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
                  <Settings className="w-4 h-4 text-gray-400" />
                  {t('visualHealth', 'settingsTitle')}
                </h3>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-700">{t('visualHealth', 'notifyOnLoginLabel')}</p>
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{t('visualHealth', 'notifyOnLoginDesc')}</p>
                    <p className={`text-xs font-medium mt-1.5 ${notifyOnLogin ? 'text-indigo-600' : 'text-gray-400'}`}>
                      {notifyOnLogin ? t('visualHealth', 'featureActive') : t('visualHealth', 'featureInactive')}
                    </p>
                  </div>
                  <button
                    onClick={handleToggleNotifyOnLogin}
                    role="switch"
                    aria-checked={notifyOnLogin}
                    className={`relative flex-shrink-0 mt-0.5 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                      notifyOnLogin ? 'bg-indigo-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${
                        notifyOnLogin ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Gráfica de tendencia de uso diario ── */}
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{t('visualHealth', 'trendTitle')}</h2>
              <p className="text-sm text-gray-400 mt-1">{t('visualHealth', 'trendHint')}</p>
            </div>
            <div className="flex gap-3 text-xs flex-wrap">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> &lt; {t('visualHealth', 'mild')}</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" /> {t('visualHealth', 'moderateUse')}</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-500 inline-block" /> {t('visualHealth', 'considerableUse')}</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> &gt; {t('visualHealth', 'severeUse')}</span>
            </div>
          </div>

          <ScreenTimeTrendChart
            data={dailyData}
            onSelectDay={setSelectedDay}
            selectedDateKey={selectedDay}
            totalSessions={sessions.length}
            t={t}
            lang={lang}
          />

          {/* Panel de detalle del día */}
          {selectedDayObj && (
            <DayDetailPanel day={selectedDayObj} onClose={() => setSelectedDay(null)} t={t} />
          )}
        </div>

        {/* ── Historial de sesiones ── */}
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800">{t('visualHealth', 'sessionsHistory')}</h2>
            <p className="text-sm text-gray-400 mt-1">{t('visualHealth', 'sessionsHistoryHint')}</p>
          </div>

          {sessions.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-400">{t('visualHealth', 'noSessions')}</p>
              <p className="text-xs text-gray-300 mt-1">
                {t('visualHealth', 'startTimerHint')} <span className="font-semibold">{t('visualHealth', 'terminate')}</span> {t('visualHealth', 'toSaveSession')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.slice(sessionPage * VH_PAGE_SIZE, (sessionPage + 1) * VH_PAGE_SIZE).map((session, index) => {
                const globalIndex = sessionPage * VH_PAGE_SIZE + index;
                const totalMin = Math.floor(session.durationMs / 60_000);
                const hours    = Math.floor(totalMin / 60);
                const minutes  = totalMin % 60;

                return (
                  <div key={session.id}
                    className="flex items-center justify-between p-4 rounded-lg border-l-4 bg-indigo-50 border-indigo-400 hover:bg-indigo-100 transition">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{t('visualHealth', 'sessionNum')} {sessions.length - globalIndex}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{t('visualHealth', 'startedAt')} {session.startedAt}</p>
                        <p className="text-xs text-gray-400">{t('visualHealth', 'endedAt')} {session.endedAt}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-200 text-indigo-800">
                        {hours > 0 ? `${hours} h${minutes > 0 ? ` ${minutes} min` : ''}` : `${minutes} min`}
                      </span>
                      <span className="text-xs text-gray-400">{formatSessionDuration(session.durationMs)}</span>
                      <button
                        onClick={() => setDeleteSessionId(session.id)}
                        className="mt-1 flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition"
                        title={t('visualHealth', 'deleteSession')}
                      >
                        <Trash2 className="w-3 h-3" />
                        {t('visualHealth', 'deleteSession')}
                      </button>
                    </div>
                  </div>
                );
              })}
              {/* Paginador de sesiones */}
              {Math.ceil(sessions.length / VH_PAGE_SIZE) > 1 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                  <button onClick={() => setSessionPage(p => p - 1)} disabled={sessionPage === 0}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-30 transition">
                    <ChevronLeft className="w-4 h-4" />
                    {lang === 'es' ? 'Anterior' : 'Previous'}
                  </button>
                  <span className="text-xs text-gray-400">
                    {lang === 'es'
                      ? `Pág. ${sessionPage + 1} / ${Math.ceil(sessions.length / VH_PAGE_SIZE)}`
                      : `Page ${sessionPage + 1} / ${Math.ceil(sessions.length / VH_PAGE_SIZE)}`}
                  </span>
                  <button onClick={() => setSessionPage(p => p + 1)}
                    disabled={sessionPage >= Math.ceil(sessions.length / VH_PAGE_SIZE) - 1}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-30 transition">
                    {lang === 'es' ? 'Siguiente' : 'Next'}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      </main>
    </div>
  );
};

export default VisualHealth;
