import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ArrowLeft, HeartPulse, Play, Pause, RotateCcw, Clock,
  AlarmClock, StopCircle, Calendar, TrendingUp, X,
} from 'lucide-react';
import { Eye } from 'lucide-react';

type Props = {
  onBack: () => void;
};

// ─── Configura aquí los intervalos ───────────────────────────────────────────
const WORK_MINUTES  = 1; // minutos de trabajo antes de cada descanso
const BREAK_MINUTES = 1; // minutos de descanso recomendados
// ─────────────────────────────────────────────────────────────────────────────

type PersistedTimerState = {
  isRunning: boolean;
  startTimestamp: number | null;
  accumulatedMs: number;
  nextBreakAtMs: number | null;
  sessionStartTimestamp: number | null;
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

const speakText = (text: string) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'es-MX';
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
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

const formatSessionDuration = (ms: number) => {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours   = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
};

const formatDateTime = (ts: number) =>
  new Date(ts).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

const formatHour = (ts: number) =>
  new Date(ts).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });

const loadSessions = (): SessionRecord[] => {
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const saveSessions = (sessions: SessionRecord[]) => {
  try { localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions)); }
  catch { /* noop */ }
};

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

const ScreenTimeTrendChart = ({
  data,
  onSelectDay,
  selectedDateKey,
}: {
  data: DailyAggregate[];
  onSelectDay: (dateKey: string | null) => void;
  selectedDateKey: string | null;
}) => {
  if (data.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-gray-400">
        <TrendingUp className="w-10 h-10 mb-2 opacity-30" />
        <p className="text-sm">Necesitas al menos 2 días con sesiones para ver la tendencia</p>
      </div>
    );
  }

  const W = 560, H = 180;
  const PAD = { top: 20, right: 20, bottom: 40, left: 48 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxMinutes = Math.max(...data.map(d => d.totalMinutes));
  // Redondear al siguiente múltiplo de 60 (hora completa) para escala limpia
  const ceilHour = Math.max(Math.ceil(maxMinutes / 60) * 60, 60);

  const xStep = data.length > 1 ? chartW / (data.length - 1) : chartW;
  const toX = (i: number) => PAD.left + i * xStep;
  const toY = (v: number) => PAD.top + chartH - (v / ceilHour) * chartH;

  // Línea
  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(d.totalMinutes)}`)
    .join(' ');

  // Área
  const areaPath =
    `M ${toX(0)} ${toY(data[0].totalMinutes)} ` +
    data.slice(1).map((d, i) => `L ${toX(i + 1)} ${toY(d.totalMinutes)}`).join(' ') +
    ` L ${toX(data.length - 1)} ${PAD.top + chartH} L ${toX(0)} ${PAD.top + chartH} Z`;

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
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full cursor-pointer" aria-label="Tendencia de tiempo en pantalla">
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
      {data.map((d, i) => {
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
              transform={data.length > 6 ? `rotate(-30, ${cx}, ${PAD.top + chartH + 14})` : undefined}>
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
  );
};

// ─── Panel de detalle del día seleccionado ────────────────────────────────────

const DayDetailPanel = ({ day, onClose }: { day: DailyAggregate; onClose: () => void }) => {
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
            <p className="font-bold text-gray-800">Detalle del {day.dateLabel}</p>
            <p className="text-xs text-gray-500">
              {day.sessions.length} {day.sessions.length === 1 ? 'sesión' : 'sesiones'} — Total:{' '}
              <span className="font-semibold" style={{ color }}>
                {totalH > 0 ? `${totalH} h ` : ''}{totalM} min
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
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Sesiones</p>
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
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Horarios más activos</p>
          {topHours.length === 0 ? (
            <p className="text-xs text-gray-400">Sin datos suficientes</p>
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
  const [isRunning, setIsRunning]                   = useState(false);
  const [elapsedSeconds, setElapsedSeconds]         = useState(0);
  const [nextBreakInMinutes, setNextBreakInMinutes] = useState<number | null>(null);
  const [sessions, setSessions]                     = useState<SessionRecord[]>([]);
  const [selectedDay, setSelectedDay]               = useState<string | null>(null);
  const [countdown, setCountdown]                   = useState<number | null>(null);

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

  // Cargar estado y sesiones al montar
  useEffect(() => {
    setSessions(loadSessions());
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: PersistedTimerState = JSON.parse(raw);
        const now = Date.now();
        let elapsedMs = parsed.accumulatedMs;
        if (parsed.isRunning && parsed.startTimestamp) elapsedMs += now - parsed.startTimestamp;
        setElapsedSeconds(Math.floor(elapsedMs / 1000));
        setIsRunning(parsed.isRunning);
        if (parsed.nextBreakAtMs != null) {
          const rem = parsed.nextBreakAtMs - elapsedMs;
          setNextBreakInMinutes(rem > 0 ? Math.round(rem / 60000) : 0);
        }
        stateRef.current = parsed;
      } else {
        saveState(stateRef.current);
      }
    } catch { saveState(stateRef.current); }
  }, [saveState]);

  // Intervalo
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const cur = stateRef.current;
      let ms = cur.accumulatedMs;
      if (cur.isRunning && cur.startTimestamp) ms += now - cur.startTimestamp;
      setElapsedSeconds(Math.floor(ms / 1000));

      if (cur.isRunning) {
        if (cur.nextBreakAtMs == null) {
          const nb = WORK_MINUTES * 60_000;
          saveState({ ...cur, nextBreakAtMs: nb });
          setNextBreakInMinutes(Math.round((nb - ms) / 60000));
          return;
        }
        if (ms >= cur.nextBreakAtMs) {
          playBeep();
          speakText('Es momento de tomar un descanso visual');
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

  const handleStartWithCountdown = () => {
    if (stateRef.current.isRunning || countdown !== null) return;
    let count = 3;
    const tick = () => {
      if (count > 0) {
        setCountdown(count);
        count--;
        setTimeout(tick, 1000);
      } else {
        setCountdown(null);
        const now = Date.now();
        saveState({
          ...stateRef.current,
          isRunning: true,
          startTimestamp: now,
          sessionStartTimestamp: stateRef.current.sessionStartTimestamp ?? now,
        });
        setIsRunning(true);
      }
    };
    speakText('El conteo comienza en');
    setTimeout(tick, 700);
  };

  const handlePause = () => {
    const cur = stateRef.current;
    if (!cur.isRunning) return;
    const now = Date.now();
    let ms = cur.accumulatedMs;
    if (cur.startTimestamp) ms += now - cur.startTimestamp;
    saveState({ ...cur, isRunning: false, startTimestamp: null, accumulatedMs: ms });
    setIsRunning(false);
  };

  const handleReset = () => {
    saveState({ isRunning: false, startTimestamp: null, accumulatedMs: 0, nextBreakAtMs: null, sessionStartTimestamp: null });
    setIsRunning(false);
    setElapsedSeconds(0);
    setNextBreakInMinutes(null);
  };

  const handleTerminate = () => {
    const cur = stateRef.current;
    const now = Date.now();
    let ms = cur.accumulatedMs;
    if (cur.isRunning && cur.startTimestamp) ms += now - cur.startTimestamp;

    if (ms > 0) {
      const start = cur.sessionStartTimestamp ?? (now - ms);
      const record: SessionRecord = {
        id:                String(now),
        startedAt:         formatDateTime(start),
        endedAt:           formatDateTime(now),
        durationMs:        ms,
        startTimestampRaw: start,
        endTimestampRaw:   now,
      };
      const updated = [record, ...loadSessions()];
      saveSessions(updated);
      setSessions(updated);
    }

    saveState({ isRunning: false, startTimestamp: null, accumulatedMs: 0, nextBreakAtMs: null, sessionStartTimestamp: null });
    setIsRunning(false);
    setElapsedSeconds(0);
    setNextBreakInMinutes(null);
  };

  // ── Datos derivados ─────────────────────────────────────────────────────────

  const totalHours     = elapsedSeconds / 3600;
  const dailyData      = aggregateByDay(sessions);
  const selectedDayObj = selectedDay ? dailyData.find(d => d.dateKey === selectedDay) ?? null : null;

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
          <button onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition">
            <ArrowLeft className="w-5 h-5" />
            <span>Volver al dashboard</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-8">

        {/* ── Tarjeta del cronómetro ── */}
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

          <div className="flex flex-col md:flex-row gap-8">
            {/* Reloj */}
            <div className="flex-1 flex flex-col items-center">
              <div className="w-48 h-48 rounded-full bg-gray-900 text-white flex flex-col items-center justify-center shadow-inner mb-4">
                <span className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-1">Tiempo activo</span>
                <span className="text-3xl md:text-4xl font-mono font-bold">{formatDuration(elapsedSeconds)}</span>
              </div>

              <div className="flex items-center gap-3 mb-3 flex-wrap justify-center">
                {isRunning ? (
                  <button onClick={handlePause}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-600 text-white font-semibold hover:bg-red-700 transition shadow">
                    <Pause className="w-5 h-5" /> Pausar
                  </button>
                ) : countdown !== null ? (
                  <button disabled
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-green-500 text-white font-bold shadow cursor-not-allowed min-w-[110px] justify-center">
                    <span className="text-xl leading-none">{countdown}</span>
                  </button>
                ) : (
                  <button onClick={handleStartWithCountdown}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-green-600 text-white font-semibold hover:bg-green-700 transition shadow">
                    <Play className="w-5 h-5" /> Iniciar
                  </button>
                )}
                <button onClick={handleReset} disabled={countdown !== null}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition disabled:opacity-40 disabled:cursor-not-allowed">
                  <RotateCcw className="w-5 h-5" /> Reiniciar
                </button>
                <button onClick={handleTerminate} disabled={elapsedSeconds === 0 || countdown !== null}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition shadow disabled:opacity-40 disabled:cursor-not-allowed">
                  <StopCircle className="w-5 h-5" /> Terminar
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

            {/* Info descansos */}
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
                  El cronómetro sigue contando tu tiempo activo aunque navegues por otros módulos.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Gráfica de tendencia de uso diario ── */}
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Tendencia de uso diario</h2>
              <p className="text-sm text-gray-400 mt-1">Haz clic en un punto para ver el detalle del día</p>
            </div>
            <div className="flex gap-3 text-xs flex-wrap">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> &lt; leve</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" /> Moderado</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-500 inline-block" /> Considerable</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> &gt; Grave</span>
            </div>
          </div>

          <ScreenTimeTrendChart
            data={dailyData}
            onSelectDay={setSelectedDay}
            selectedDateKey={selectedDay}
          />

          {/* Panel de detalle del día */}
          {selectedDayObj && (
            <DayDetailPanel day={selectedDayObj} onClose={() => setSelectedDay(null)} />
          )}
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
                  <div key={session.id}
                    className="flex items-center justify-between p-4 rounded-lg border-l-4 bg-indigo-50 border-indigo-400 hover:bg-indigo-100 transition">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">Sesión {sessions.length - index}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Iniciada: {session.startedAt}</p>
                        <p className="text-xs text-gray-400">Finalizada: {session.endedAt}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-200 text-indigo-800">
                        {hours > 0 ? `${hours} h${minutes > 0 ? ` ${minutes} min` : ''}` : `${minutes} min`}
                      </span>
                      <span className="text-xs text-gray-400">{formatSessionDuration(session.durationMs)}</span>
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
