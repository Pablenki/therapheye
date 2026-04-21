import { useEffect, useState } from 'react';
import { ArrowLeft, Calendar, TrendingUp, Eye, CheckCircle2, XCircle, ChevronDown, ChevronUp, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../i18n';
import translations from '../i18n/translations';

// ─── Parsear fecha de BD respetando timezone ─────────────────────────────────
// Los timestamps ahora se guardan con offset local (ej: "2026-03-24T16:42:00-06:00")
// Para registros viejos que vengan sin offset, asumimos UTC como fallback seguro.
const parseDbDate = (dateStr: any): Date => {
  if (!dateStr) return new Date();
  // Si ya es un Date válido, lo retornamos directo
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? new Date() : dateStr;
  const s = String(dateStr).trim();
  // Intentar parseo directo primero
  const direct = new Date(s);
  if (!isNaN(direct.getTime())) return direct;
  // Fallback para formato legacy "YYYY-MM-DD HH:MM:SS" sin offset → asumir UTC
  return new Date(s.replace(' ', 'T') + 'Z');
};

// Mapa de clave interna (guardada en DB desde ExerciseSession como titleKey.split('.')[1])
// → ID de ejercicio usado en App.tsx / exerciseData.
// Nota: la DB guarda 'palming', 'focus', 'rule202020', 'circles', 'nearFar' (por `titleKey`).
// Se incluyen también variantes legacy y los propios IDs por si se guardó directamente el id.
const EXERCISE_NAME_TO_ID: Record<string, string> = {
  // Claves canónicas actuales (tipo_ejercicio = titleKey.split('.')[1])
  'palming':    'palming',
  'focus':      'focus',
  'rule202020': '20-20-20',
  'circles':    'circles',
  'nearFar':    'near-far',
  // IDs también válidos (por si se almacenó el id directamente)
  '20-20-20':   '20-20-20',
  'near-far':   'near-far',
  // Variantes legacy / display names viejos que pudieran existir en BD
  'Palming':                'palming',
  'Enfoque cercano-lejano': 'focus',
  'Regla 20-20-20':         '20-20-20',
  'Círculos oculares':      'circles',
  'Simulación cerca/lejos': 'near-far',
  '20s':                    '20-20-20',
  'cercano-lejos':          'focus',
  'simulación':             'near-far',
};

// Mapa clave-interna-o-legacy → (es, en) para mostrar al usuario.
// Se usa para reemplazar `tipo_ejercicio` bruto por un nombre amigable.
const EXERCISE_DISPLAY_NAME: Record<string, { es: string; en: string }> = {
  palming:    { es: 'Palming',                  en: 'Palming'              },
  focus:      { es: 'Enfoque cercano-lejano',   en: 'Near-Far Focus'       },
  rule202020: { es: 'Regla 20-20-20',           en: '20-20-20 Rule'        },
  circles:    { es: 'Círculos oculares',        en: 'Eye Circles'          },
  nearFar:    { es: 'Simulación cerca/lejos',   en: 'Near/Far Simulation'  },
  '20-20-20': { es: 'Regla 20-20-20',           en: '20-20-20 Rule'        },
  'near-far': { es: 'Simulación cerca/lejos',   en: 'Near/Far Simulation'  },
  '20s':      { es: 'Regla 20-20-20',           en: '20-20-20 Rule'        },
  'cercano-lejos': { es: 'Enfoque cercano-lejano', en: 'Near-Far Focus'    },
  'simulación':    { es: 'Simulación cerca/lejos', en: 'Near/Far Simulation' },
};

const getExerciseDisplayName = (raw: string, lang: 'es' | 'en'): string => {
  if (!raw) return '';
  // Buscar match exacto
  if (EXERCISE_DISPLAY_NAME[raw]) return EXERCISE_DISPLAY_NAME[raw][lang];
  // Match case-insensitive
  const lower = raw.toLowerCase();
  for (const k of Object.keys(EXERCISE_DISPLAY_NAME)) {
    if (k.toLowerCase() === lower) return EXERCISE_DISPLAY_NAME[k][lang];
  }
  // Fallback: capitalizar primera letra del valor crudo
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};
import { sql } from '../neonCliente';
import { useUser } from '../context/UserContext';

interface ImageCaptura {
  id: string;
  sintoma: string;
  created_at: string;
}

const SINTOMA_LABELS: Record<string, { es: string; en: string; desc_es: string; desc_en: string }> = {
  ojo_sano:       { es: 'Ojo sano',             en: 'Healthy eye',          desc_es: 'No se detectaron signos de fatiga visual en la imagen. El ojo presenta un aspecto saludable.', desc_en: 'No signs of eye fatigue were detected. The eye appears healthy.' },
  enro_leve:      { es: 'Enrojecimiento leve',  en: 'Mild redness',         desc_es: 'Se observa un leve enrojecimiento en la conjuntiva. Puede deberse a exposición prolongada a pantallas o falta de sueño.', desc_en: 'Mild redness in the conjunctiva. May be caused by prolonged screen exposure or lack of sleep.' },
  piel_enro:      { es: 'Piel enrojecida',      en: 'Skin redness',         desc_es: 'Se detectó enrojecimiento en la piel alrededor del ojo. Puede indicar irritación, alergia o frotamiento frecuente.', desc_en: 'Redness detected around the eye skin. May indicate irritation, allergy, or frequent rubbing.' },
  enro_moderado:  { es: 'Enrojecimiento moderado', en: 'Moderate redness',  desc_es: 'Enrojecimiento moderado en el ojo. Esto puede relacionarse con fatiga ocular significativa o falta de hidratación.', desc_en: 'Moderate eye redness. This may relate to significant eye strain or dehydration.' },
  parpado_caido:  { es: 'Párpado caído',        en: 'Drooping eyelid',      desc_es: 'Se observa ptosis o caída del párpado superior. Puede ser señal de fatiga severa o cansancio extremo.', desc_en: 'Ptosis or drooping of the upper eyelid detected. May indicate severe fatigue or extreme tiredness.' },
  enro_grave:     { es: 'Enrojecimiento grave', en: 'Severe redness',       desc_es: 'Enrojecimiento grave en el ojo. Requiere atención; puede indicar irritación severa, infección o condición que merece evaluación médica.', desc_en: 'Severe eye redness. Requires attention; may indicate severe irritation, infection, or a condition worth medical evaluation.' },
};

interface Evaluation {
  id: string;
  created_at: string;
  raw_date: Date;
  puntaje_fatiga: number;
  level: string;
  color: string;
  bg: string;
  respuestas_json: Record<string, number>;
  sintoma_dominante: string | null;
}

interface Exercise {
  created_at: string;
  tipo_ejercicio: string;
  duracion: number;
  status: 'completed' | 'incomplete' | null;
}

interface VisionRowResult { level: number; acuity: string; canRead: boolean; userInput: string; }
interface VisionEntry {
  id: string;
  raw_date: Date;
  created_at: string;
  mejor_nivel: number;
  agudeza: string;
  distancia_cm: number;
  resultados_json: VisionRowResult[];
}

// ─── Tipos y utilidades de período ──────────────────────────────────────────────
type ChartPeriod = '7d' | '1m' | '3m' | '1a' | 'all';

const PERIOD_MS: Record<Exclude<ChartPeriod, 'all'>, number> = {
  '7d': 7 * 86_400_000,
  '1m': 30 * 86_400_000,
  '3m': 90 * 86_400_000,
  '1a': 365 * 86_400_000,
};

function getDateWindow(period: ChartPeriod, offset: number): { from: Date | null; to: Date } {
  if (period === 'all') return { from: null, to: new Date() };
  const ms = PERIOD_MS[period];
  const to = new Date(Date.now() - offset * ms);
  const from = new Date(to.getTime() - ms);
  return { from, to };
}

function periodRangeLabel(period: ChartPeriod, offset: number, lang: string): string {
  if (period === 'all') return lang === 'es' ? 'Todo el historial' : 'All history';
  const { from, to } = getDateWindow(period, offset);
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
  const locale = lang === 'es' ? 'es-MX' : 'en-US';
  return `${from!.toLocaleDateString(locale, opts)} – ${to.toLocaleDateString(locale, opts)} ${to.getFullYear()}`;
}

const PERIOD_BTNS: { key: ChartPeriod; es: string; en: string }[] = [
  { key: '7d',  es: '7D',   en: '7D'  },
  { key: '1m',  es: '1M',   en: '1M'  },
  { key: '3m',  es: '3M',   en: '3M'  },
  { key: '1a',  es: '1A',   en: '1Y'  },
  { key: 'all', es: 'Todo', en: 'All' },
];

const PeriodNav = ({
  period, setPeriod, offset, setOffset, lang,
}: {
  period: ChartPeriod;
  setPeriod: (p: ChartPeriod) => void;
  offset: number;
  setOffset: (fn: (n: number) => number) => void;
  lang: string;
}) => (
  <div className="flex flex-wrap items-center gap-2 mb-4">
    <div className="flex gap-1 flex-wrap">
      {PERIOD_BTNS.map(b => (
        <button key={b.key} onClick={() => { setPeriod(b.key); setOffset(() => 0); }}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition
            ${period === b.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          {lang === 'es' ? b.es : b.en}
        </button>
      ))}
    </div>
    {period !== 'all' && (
      <div className="flex items-center gap-1 ml-auto">
        <button onClick={() => setOffset(o => o + 1)}
          className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition" title={lang === 'es' ? 'Período anterior' : 'Previous period'}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs text-gray-500 min-w-[150px] text-center font-medium">
          {periodRangeLabel(period, offset, lang)}
        </span>
        <button onClick={() => setOffset(o => Math.max(0, o - 1))}
          disabled={offset === 0}
          className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-30 transition" title={lang === 'es' ? 'Período siguiente' : 'Next period'}>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    )}
  </div>
);

const PAGE_SIZE = 5;

const ListPager = ({
  total, page, setPage, lang,
}: {
  total: number;
  page: number;
  setPage: (fn: (p: number) => number) => void;
  lang: string;
}) => {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
      <button onClick={() => setPage(p => p - 1)} disabled={page === 0}
        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-30 transition">
        <ChevronLeft className="w-4 h-4" />
        {lang === 'es' ? 'Anterior' : 'Previous'}
      </button>
      <span className="text-xs text-gray-400">
        {lang === 'es' ? `Pág. ${page + 1} / ${totalPages}` : `Page ${page + 1} / ${totalPages}`}
      </span>
      <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}
        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-30 transition">
        {lang === 'es' ? 'Siguiente' : 'Next'}
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};

// ─── Gráfica de tendencia SVG con interactividad ────────────────────────────────
const TrendChart = ({ evaluations }: { evaluations: Evaluation[] }) => {
  const { t, lang } = useLanguage();
  const [period, setPeriod]   = useState<ChartPeriod>('1m');
  const [offset, setOffset]   = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; data: Evaluation } | null>(null);

  if (evaluations.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-gray-400">
        <TrendingUp className="w-10 h-10 mb-2 opacity-30" />
        <p className="text-sm">{t('history', 'trendChartNeedMore')}</p>
      </div>
    );
  }

  // Filtrar por período + offset
  const { from, to } = getDateWindow(period, offset);
  const filteredEvals = evaluations.filter(e => {
    if (from && e.raw_date < from) return false;
    if (e.raw_date > to) return false;
    return true;
  });

  // Los datos vienen ORDER BY DESC → invertimos para cronológico
  const data = [...filteredEvals].reverse();

  // Si no hay suficientes datos en el rango filtrado
  if (data.length < 2) {
    return (
      <div>
        <PeriodNav period={period} setPeriod={setPeriod} offset={offset} setOffset={setOffset} lang={lang} />
        <div className="flex flex-col items-center justify-center h-40 text-gray-400">
          <TrendingUp className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">{lang === 'en' ? 'Not enough data in this period' : 'Sin suficientes datos en este período'}</p>
        </div>
      </div>
    );
  }

  // Calculate summary statistics
  const avgScore = Math.round(data.reduce((sum, d) => sum + d.puntaje_fatiga, 0) / data.length);
  const bestScore = Math.min(...data.map(d => d.puntaje_fatiga));
  const worstScore = Math.max(...data.map(d => d.puntaje_fatiga));

  // Calculate 3-point moving average
  const movingAverage = data.map((_, i) => {
    if (i < 2) return null;
    const avg = Math.round((data[i - 2].puntaje_fatiga + data[i - 1].puntaje_fatiga + data[i].puntaje_fatiga) / 3);
    return avg;
  });

  const W = 560;
  const H = 160;
  const PAD = { top: 16, right: 20, bottom: 36, left: 40 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxScore = 100;
  const minScore = 0;

  const xStep = data.length > 1 ? chartW / (data.length - 1) : chartW;

  const toX = (i: number) => PAD.left + i * xStep;
  const toY = (v: number) => PAD.top + chartH - ((v - minScore) / (maxScore - minScore)) * chartH;

  // Main line path
  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(d.puntaje_fatiga)}`)
    .join(' ');

  // Moving average line (3-point)
  const maPath = data
    .map((_, i) => movingAverage[i] !== null ? `${i === 2 ? 'M' : 'L'} ${toX(i)} ${toY(movingAverage[i]!)}` : null)
    .filter(Boolean)
    .join(' ');

  // Area under the line
  const areaPath =
    `M ${toX(0)} ${toY(data[0].puntaje_fatiga)} ` +
    data.slice(1).map((d, i) => `L ${toX(i + 1)} ${toY(d.puntaje_fatiga)}`).join(' ') +
    ` L ${toX(data.length - 1)} ${PAD.top + chartH} L ${toX(0)} ${PAD.top + chartH} Z`;

  // Color function for points
  const dotColor = (score: number) => {
    if (score < 25) return '#16a34a';
    if (score < 50) return '#ca8a04';
    if (score < 75) return '#ea580c';
    return '#dc2626';
  };

  const getLevelLabel = (score: number) => {
    if (score < 25) return t('history', 'levelMild');
    if (score < 50) return t('history', 'levelModerate');
    if (score < 75) return t('history', 'levelConsiderable');
    return t('history', 'levelSevere');
  };

  // Y-axis labels
  const yLabels = [0, 25, 50, 75, 100];

  const handleChartMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const scaleX = W / rect.width;
    const x = (e.clientX - rect.left) * scaleX;

    // Find closest data point
    let closest = 0;
    let minDist = Infinity;
    for (let i = 0; i < data.length; i++) {
      const pointX = toX(i);
      const dist = Math.abs(pointX - x);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    }

    if (minDist < 30) {
      setHoveredIndex(closest);
      setTooltip({
        x: toX(closest),
        y: toY(data[closest].puntaje_fatiga),
        data: data[closest],
      });
    } else {
      setHoveredIndex(null);
      setTooltip(null);
    }
  };

  const handleChartMouseLeave = () => {
    setHoveredIndex(null);
    setTooltip(null);
  };

  return (
    <div className="space-y-4">
      {/* Summary stats bar */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3">
          <p className="text-xs text-blue-600 font-semibold uppercase">{t('history', 'avgScore')}</p>
          <p className="text-2xl font-bold text-blue-700">{avgScore}%</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3">
          <p className="text-xs text-green-600 font-semibold uppercase">{t('history', 'bestScore')}</p>
          <p className="text-2xl font-bold text-green-700">{bestScore}%</p>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-3">
          <p className="text-xs text-red-600 font-semibold uppercase">{t('history', 'worstScore')}</p>
          <p className="text-2xl font-bold text-red-700">{worstScore}%</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3">
          <p className="text-xs text-purple-600 font-semibold uppercase">{t('history', 'totalEvaluations')}</p>
          <p className="text-2xl font-bold text-purple-700">{data.length}</p>
        </div>
      </div>

      {/* Period filter + nav */}
      <PeriodNav period={period} setPeriod={setPeriod} offset={offset} setOffset={setOffset} lang={lang} />

      {/* Chart hint */}
      <p className="text-xs text-gray-400 mb-2">{t('history', 'chartTooltip')}</p>

      {/* SVG Chart */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        aria-label={t('history', 'trendChartTitle')}
        onMouseMove={handleChartMouseMove}
        onMouseLeave={handleChartMouseLeave}
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
          </linearGradient>
          <clipPath id="chartClip">
            <rect x={PAD.left} y={PAD.top} width={chartW} height={chartH} />
          </clipPath>
        </defs>

        {/* Severity zones background */}
        <g clipPath="url(#chartClip)">
          <rect x={PAD.left} y={toY(100)} width={chartW} height={toY(75) - toY(100)} fill="#fecaca" opacity="0.3" />
          <rect x={PAD.left} y={toY(75)} width={chartW} height={toY(50) - toY(75)} fill="#fed7aa" opacity="0.3" />
          <rect x={PAD.left} y={toY(50)} width={chartW} height={toY(25) - toY(50)} fill="#fef08a" opacity="0.3" />
          <rect x={PAD.left} y={toY(25)} width={chartW} height={toY(0) - toY(25)} fill="#bbf7d0" opacity="0.3" />
        </g>

        {/* Horizontal grid */}
        {yLabels.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              y1={toY(v)}
              x2={PAD.left + chartW}
              y2={toY(v)}
              stroke="#e5e7eb"
              strokeWidth="1"
              strokeDasharray="4 3"
            />
            <text x={PAD.left - 6} y={toY(v) + 4} textAnchor="end" fontSize="9" fill="#9ca3af">
              {v}%
            </text>
          </g>
        ))}

        {/* Filled area */}
        <path d={areaPath} fill="url(#areaGrad)" />

        {/* Main trend line */}
        <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Moving average line (dashed) - only if 3+ points */}
        {data.length >= 3 && maPath && (
          <path
            d={maPath}
            fill="none"
            stroke="#a78bfa"
            strokeWidth="2"
            strokeDasharray="5 5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.7"
          />
        )}

        {/* Data points and interactive areas */}
        {data.map((d, i) => (
          <g key={d.id}>
            {/* Vertical guide line on hover */}
            {hoveredIndex === i && (
              <line
                x1={toX(i)}
                y1={PAD.top}
                x2={toX(i)}
                y2={PAD.top + chartH}
                stroke="#6366f1"
                strokeWidth="2"
                strokeDasharray="3 3"
                opacity="0.5"
              />
            )}

            {/* Outer halo (larger on hover) */}
            <circle
              cx={toX(i)}
              cy={toY(d.puntaje_fatiga)}
              r={hoveredIndex === i ? 10 : 7}
              fill={dotColor(d.puntaje_fatiga)}
              opacity={hoveredIndex === i ? 0.3 : 0.2}
              className="transition-all duration-150"
            />

            {/* Main point (larger on hover) */}
            <circle
              cx={toX(i)}
              cy={toY(d.puntaje_fatiga)}
              r={hoveredIndex === i ? 6 : 4.5}
              fill={dotColor(d.puntaje_fatiga)}
              stroke="white"
              strokeWidth={hoveredIndex === i ? 2 : 1.5}
              className="transition-all duration-150 cursor-pointer"
              style={{ pointerEvents: 'auto' }}
            />

            {/* Score label above point */}
            <text
              x={toX(i)}
              y={toY(d.puntaje_fatiga) - 10}
              textAnchor="middle"
              fontSize="9"
              fontWeight="bold"
              fill={dotColor(d.puntaje_fatiga)}
            >
              {d.puntaje_fatiga}%
            </text>

            {/* Date label below axis */}
            <text
              x={toX(i)}
              y={PAD.top + chartH + 14}
              textAnchor="middle"
              fontSize="8"
              fill="#6b7280"
              transform={data.length > 5 ? `rotate(-30, ${toX(i)}, ${PAD.top + chartH + 14})` : undefined}
            >
              {d.created_at}
            </text>

            {/* Invisible hit area for hover detection */}
            <circle
              cx={toX(i)}
              cy={toY(d.puntaje_fatiga)}
              r="20"
              fill="transparent"
              style={{ pointerEvents: 'auto' }}
              onMouseEnter={() => {
                setHoveredIndex(i);
                setTooltip({
                  x: toX(i),
                  y: toY(d.puntaje_fatiga),
                  data: d,
                });
              }}
            />
          </g>
        ))}

        {/* X-axis */}
        <line
          x1={PAD.left}
          y1={PAD.top + chartH}
          x2={PAD.left + chartW}
          y2={PAD.top + chartH}
          stroke="#d1d5db"
          strokeWidth="1"
        />

        {/* Y-axis */}
        <line
          x1={PAD.left}
          y1={PAD.top}
          x2={PAD.left}
          y2={PAD.top + chartH}
          stroke="#d1d5db"
          strokeWidth="1"
        />
      </svg>

      {/* Hover tooltip */}
      {tooltip && (
        <div className="mt-4 bg-indigo-50 border border-indigo-200 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase font-semibold">{t('common', 'date')}</p>
              <p className="text-sm font-semibold text-gray-800">{tooltip.data.created_at}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-semibold">{t('history', 'fatigueLevel')}</p>
              <p className={`text-sm font-semibold ${tooltip.data.color}`}>{getLevelLabel(tooltip.data.puntaje_fatiga)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-semibold">{lang === 'en' ? 'Score' : 'Puntaje'}</p>
              <p className="text-sm font-semibold text-gray-800">{tooltip.data.puntaje_fatiga}%</p>
            </div>
            {tooltip.data.sintoma_dominante && (
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">{lang === 'en' ? 'Dominant Symptom' : 'Síntoma Dominante'}</p>
                <p className="text-sm font-semibold text-indigo-600">
                  {translations.symptomLabels[tooltip.data.sintoma_dominante]?.[lang] ?? tooltip.data.sintoma_dominante}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Gráfica de agudeza visual ───────────────────────────────────────────────
const VISION_ZONES = [
  { min: 0, max: 3,  fill: '#fef2f2', dot: '#ef4444', label_es: 'Limitada (20/100–)',     label_en: 'Limited (20/100–)'     },
  { min: 3, max: 5,  fill: '#fefce8', dot: '#eab308', label_es: 'Reducida (20/50–70)',    label_en: 'Reduced (20/50–70)'    },
  { min: 5, max: 7,  fill: '#eff6ff', dot: '#3b82f6', label_es: 'Buena (20/30–40)',       label_en: 'Good (20/30–40)'       },
  { min: 7, max: 8,  fill: '#f0fdf4', dot: '#22c55e', label_es: 'Normal (20/20)',         label_en: 'Normal (20/20)'        },
  { min: 8, max: 10, fill: '#ecfdf5', dot: '#10b981', label_es: 'Excepcional (20/15–10)', label_en: 'Exceptional (20/15–10)'},
];

const visionDotColor = (nivel: number) => {
  if (nivel >= 9) return '#10b981';
  if (nivel >= 8) return '#22c55e';
  if (nivel >= 6) return '#3b82f6';
  if (nivel >= 4) return '#eab308';
  return '#ef4444';
};

const VisionChart = ({ entries, lang }: { entries: VisionEntry[]; lang: string }) => {
  const [period, setPeriod]   = useState<ChartPeriod>('3m');
  const [offset, setOffset]   = useState(0);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; entry: VisionEntry } | null>(null);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-gray-400">
        <Eye className="w-10 h-10 mb-2 opacity-30" />
        <p className="text-sm">{lang === 'es' ? 'Aún no hay pruebas de visión registradas' : 'No vision tests recorded yet'}</p>
      </div>
    );
  }

  const { from, to } = getDateWindow(period, offset);
  const filtered = entries.filter(e => {
    if (from && e.raw_date < from) return false;
    if (e.raw_date > to) return false;
    return true;
  });

  const data = [...filtered].reverse(); // cronológico

  const Nav = () => <PeriodNav period={period} setPeriod={setPeriod} offset={offset} setOffset={setOffset} lang={lang} />;

  if (data.length === 0) {
    return (
      <>
        <Nav />
        <div className="flex flex-col items-center justify-center h-40 text-gray-400">
          <Eye className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">{lang === 'es' ? 'Sin datos en este período' : 'No data in this period'}</p>
        </div>
      </>
    );
  }

  if (data.length === 1) {
    return (
      <>
        <Nav />
        <div className="flex flex-col items-center justify-center h-40">
          <div className="text-6xl font-black" style={{ color: visionDotColor(data[0].mejor_nivel) }}>
            {data[0].mejor_nivel}<span className="text-3xl text-gray-400">/10</span>
          </div>
          <p className="text-sm text-gray-500 mt-2">{data[0].agudeza} · {data[0].created_at}</p>
        </div>
      </>
    );
  }

  const W = 560, H = 160;
  const PAD = { top: 18, right: 20, bottom: 36, left: 44 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const toX = (i: number) => PAD.left + (i / (data.length - 1)) * chartW;
  const toY = (v: number) => PAD.top + (1 - v / 10) * chartH;

  const linePath  = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(d.mejor_nivel)}`).join(' ');
  const areaPath  = `${linePath} L ${toX(data.length - 1)} ${toY(0)} L ${toX(0)} ${toY(0)} Z`;

  return (
    <>
      <Nav />
      <div className="relative overflow-visible">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id="visionAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
            </linearGradient>
            <clipPath id="visionClip">
              <rect x={PAD.left} y={PAD.top} width={chartW} height={chartH} />
            </clipPath>
          </defs>

          {/* Zonas de color */}
          {VISION_ZONES.map((z, i) => (
            <rect key={i} x={PAD.left} y={toY(z.max)} width={chartW}
              height={toY(z.min) - toY(z.max)} fill={z.fill} clipPath="url(#visionClip)" />
          ))}

          {/* Grid horizontal */}
          {[2, 4, 6, 8, 10].map(v => (
            <g key={v}>
              <line x1={PAD.left} y1={toY(v)} x2={PAD.left + chartW} y2={toY(v)}
                stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 3" />
              <text x={PAD.left - 6} y={toY(v) + 4} textAnchor="end" fontSize="9" fill="#9ca3af">{v}</text>
            </g>
          ))}

          {/* Área + línea */}
          <path d={areaPath} fill="url(#visionAreaGrad)" clipPath="url(#visionClip)" />
          <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" clipPath="url(#visionClip)" />

          {/* Ejes */}
          <line x1={PAD.left} y1={PAD.top + chartH} x2={PAD.left + chartW} y2={PAD.top + chartH} stroke="#d1d5db" strokeWidth="1" />
          <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + chartH} stroke="#d1d5db" strokeWidth="1" />

          {/* Puntos */}
          {data.map((d, i) => {
            const cx = toX(i), cy = toY(d.mejor_nivel);
            const isHovered = tooltip?.entry.id === d.id;
            return (
              <g key={d.id}>
                {isHovered && <circle cx={cx} cy={cy} r={10} fill={visionDotColor(d.mejor_nivel)} opacity="0.2" />}
                <text x={cx} y={cy - 9} textAnchor="middle" fontSize="9" fontWeight="bold"
                  fill={visionDotColor(d.mejor_nivel)}>{d.mejor_nivel}</text>
                <circle cx={cx} cy={cy} r={isHovered ? 6 : 4.5} fill={visionDotColor(d.mejor_nivel)}
                  stroke="white" strokeWidth="1.5" />
                <circle cx={cx} cy={cy} r={14} fill="transparent"
                  onMouseEnter={() => setTooltip({ x: cx, y: cy, entry: d })}
                  onMouseLeave={() => setTooltip(null)} />
                {/* Fecha eje X (solo primera, última y cada N) */}
                {(i === 0 || i === data.length - 1 || (data.length <= 6) || i % Math.ceil(data.length / 4) === 0) && (
                  <text x={cx} y={PAD.top + chartH + 14} textAnchor="middle" fontSize="8" fill="#6b7280"
                    transform={data.length > 5 ? `rotate(-25, ${cx}, ${PAD.top + chartH + 14})` : undefined}>
                    {d.created_at.split(',')[0]}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div className="absolute bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs pointer-events-none z-10"
            style={{ left: `${(tooltip.x / W) * 100}%`, top: `${(tooltip.y / H) * 100}%`, transform: 'translate(-50%, -115%)' }}>
            <p className="font-bold text-gray-700 mb-1.5">{tooltip.entry.created_at}</p>
            <div className="flex gap-4">
              <div>
                <p className="text-gray-400 uppercase font-semibold">{lang === 'es' ? 'Nivel' : 'Level'}</p>
                <p className="font-black text-lg" style={{ color: visionDotColor(tooltip.entry.mejor_nivel) }}>
                  {tooltip.entry.mejor_nivel}/10
                </p>
              </div>
              <div>
                <p className="text-gray-400 uppercase font-semibold">{lang === 'es' ? 'Agudeza' : 'Acuity'}</p>
                <p className="font-bold text-gray-800">{tooltip.entry.agudeza}</p>
              </div>
              <div>
                <p className="text-gray-400 uppercase font-semibold">{lang === 'es' ? 'Dist.' : 'Dist.'}</p>
                <p className="font-bold text-gray-800">{tooltip.entry.distancia_cm} cm</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Leyenda de zonas */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-4">
        {[...VISION_ZONES].reverse().map((z, i) => (
          <span key={i} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: z.dot }} />
            {lang === 'es' ? z.label_es : z.label_en}
          </span>
        ))}
      </div>
    </>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────
interface HistoryProps {
  onBack: () => void;
  onStartExercise?: (exerciseId: string) => void;
}

const History = ({ onBack, onStartExercise }: HistoryProps) => {
  const { t, lang } = useLanguage();
  const [evaluations, setEvaluations]         = useState<Evaluation[]>([]);
  const [exercises, setExercises]             = useState<Exercise[]>([]);
  const [visionTests, setVisionTests]         = useState<VisionEntry[]>([]);
  const [imageCapturas, setImageCapturas]     = useState<ImageCaptura[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [expandedEvalId, setExpandedEvalId]   = useState<string | null>(null);
  const [expandedVisionId, setExpandedVisionId] = useState<string | null>(null);
  const [expandedCapturaId, setExpandedCapturaId] = useState<string | null>(null);
  // Paginación de listas
  const [evalPage, setEvalPage]       = useState(0);
  const [visionPage, setVisionPage]   = useState(0);
  const [exPage, setExPage]           = useState(0);
  const [captPage, setCaptPage]       = useState(0);

  const { user } = useUser();

  useEffect(() => { loadHistoryData(); }, []);

  const loadHistoryData = async () => {
    try {
      const evaluationsResult = await sql`
        SELECT id, created_at, puntaje_fatiga, respuestas_json, sintoma_dominante
        FROM respuestas_cuestionario
        WHERE user_id = ${user?.id}
        ORDER BY created_at DESC
      `;

      const formattedEvaluations = evaluationsResult.map((ev: any) => {
        const scoreData = getScoreData(ev.puntaje_fatiga);
        const createdDate = parseDbDate(ev.created_at);
        const localeString = lang === 'en' ? 'en-US' : 'es-MX';
        return {
          id: ev.id,
          raw_date: createdDate,
          created_at: createdDate.toLocaleString(localeString, {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }),
          puntaje_fatiga: ev.puntaje_fatiga,
          respuestas_json: typeof ev.respuestas_json === 'string'
            ? JSON.parse(ev.respuestas_json)
            : (ev.respuestas_json ?? {}),
          sintoma_dominante: ev.sintoma_dominante ?? null,
          ...scoreData,
        };
      });

      const exercisesResult = await sql`
        SELECT created_at, tipo_ejercicio, duracion, status
        FROM historial_ejercicios
        WHERE user_id = ${user?.id}
        ORDER BY created_at DESC
        LIMIT 200
      `;

      const formattedExercises = exercisesResult.map((ex: any) => {
        const createdDate = parseDbDate(ex.created_at);
        const localeString = lang === 'en' ? 'en-US' : 'es-MX';
        return {
          created_at: createdDate.toLocaleString(localeString, {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }),
          tipo_ejercicio: ex.tipo_ejercicio,
          duracion:       ex.duracion,
          status:         ex.status ?? 'completed',
        };
      });

      const visionResult = await sql`
        SELECT id, created_at, mejor_nivel, agudeza, distancia_cm, resultados_json
        FROM historial_vision_test
        WHERE user_id = ${user?.id}
        ORDER BY created_at DESC
        LIMIT 30
      `;

      const localeStr = lang === 'en' ? 'en-US' : 'es-MX';
      const formattedVision: VisionEntry[] = visionResult.map((v: any) => {
        const d = parseDbDate(v.created_at);
        return {
          id:              String(v.id),
          raw_date:        d,
          created_at:      d.toLocaleString(localeStr, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }),
          mejor_nivel:     Number(v.mejor_nivel),
          agudeza:         v.agudeza ?? 'N/A',
          distancia_cm:    Number(v.distancia_cm),
          resultados_json: typeof v.resultados_json === 'string'
            ? JSON.parse(v.resultados_json)
            : (v.resultados_json ?? []),
        };
      });

      // Capturas de imagen
      let capturasResult: any[] = [];
      try {
        capturasResult = await sql`
          SELECT id, sintoma, created_at
          FROM image_capture_history
          WHERE user_id = ${user?.id}
          ORDER BY created_at DESC
          LIMIT 20
        `;
      } catch { /* tabla aún no creada */ }
      const localeCapt = lang === 'en' ? 'en-US' : 'es-MX';
      const formattedCapturas: ImageCaptura[] = capturasResult.map((c: any) => {
        const d = parseDbDate(c.created_at);
        return {
          id: String(c.id),
          sintoma: c.sintoma,
          created_at: d.toLocaleString(localeCapt, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }),
        };
      });

      setEvaluations(formattedEvaluations);
      setExercises(formattedExercises);
      setVisionTests(formattedVision);
      setImageCapturas(formattedCapturas);
    } catch (error) {
      console.error('Error al cargar historial:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreData = (score: number) => {
    const getLevelName = (levelKey: string): string => {
      return t('history', levelKey as any);
    };

    if (score < 25) return { level: getLevelName('levelMild'),         color: 'text-green-600',  bg: 'bg-green-50'  };
    if (score < 50) return { level: getLevelName('levelModerate'),     color: 'text-yellow-600', bg: 'bg-yellow-50' };
    if (score < 75) return { level: getLevelName('levelConsiderable'), color: 'text-orange-600', bg: 'bg-orange-50' };
    return             { level: getLevelName('levelSevere'),            color: 'text-red-600',    bg: 'bg-red-50'    };
  };

  // Formato preciso de duración:
  //  · < 60s  → "Ns"             (p.ej. 30 → "30 seg")
  //  · ≥ 60s  → "m:ss"           (p.ej. 60 → "1:00", 90 → "1:30")
  // Evita perder precisión al mostrar (antes 90s se mostraba como "1 min").
  const formatDuration = (seconds: number) => {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    if (total < 60) return `${total} ${t('common', 'sec')}`;
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')} ${t('common', 'min')}`;
  };

  const getTrend = () => {
    if (evaluations.length < 2) return null;
    const diff = evaluations[0].puntaje_fatiga - evaluations[1].puntaje_fatiga;
    if (diff < 0) return { text: t('history', 'improving'),  color: 'text-green-600' };
    if (diff > 0) return { text: t('history', 'worsening'), color: 'text-red-600'   };
    return           { text: t('history', 'stableText'),         color: 'text-gray-600'  };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">{t('history', 'loadingHistory')}</p>
        </div>
      </div>
    );
  }

  const trend = getTrend();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-700 hover:text-gray-900 mb-6">
          <ArrowLeft className="w-5 h-5" />
          {t('common', 'backToDashboard')}
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-1">
            {t('history', 'title')} {user?.nombre}
          </h1>
          <p className="text-gray-600">{t('history', 'subtitle')}</p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-8 h-8 text-blue-600" />
              <h3 className="font-semibold text-gray-800">{t('history', 'totalEvals')}</h3>
            </div>
            <p className="text-3xl font-bold text-gray-800">{evaluations.length}</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-8 h-8 text-green-600" />
              <h3 className="font-semibold text-gray-800">{t('history', 'trend')}</h3>
            </div>
            {trend
              ? <p className={`text-3xl font-bold ${trend.color}`}>{trend.text}</p>
              : <p className="text-xl text-gray-500">{t('history', 'noSufficientData')}</p>}
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <Eye className="w-8 h-8 text-purple-600" />
              <h3 className="font-semibold text-gray-800">{t('history', 'lastEval')}</h3>
            </div>
            <p className="text-3xl font-bold text-gray-800">
              {evaluations.length > 0 ? `${evaluations[0].puntaje_fatiga}%` : 'N/A'}
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg md:col-span-3">
            <h3 className="font-semibold text-gray-800 mb-3">{t('history', 'exercisesLast10')}</h3>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span className="text-2xl font-bold text-green-600">
                  {exercises.filter(e => e.status !== 'incomplete').length}
                </span>
                <span className="text-sm text-gray-500">{t('history', 'completed')}</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-400" />
                <span className="text-2xl font-bold text-red-500">
                  {exercises.filter(e => e.status === 'incomplete').length}
                </span>
                <span className="text-sm text-gray-500">{t('history', 'incompletos')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Gráfica de tendencia ── */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8" id="chart-fatiga">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-800">{t('history', 'trendChartTitle')}</h2>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-400 inline-block" /> {t('history', 'levelMild')}</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" /> {t('history', 'levelModerate')}</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block" /> {t('history', 'levelConsiderable')}</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> {t('history', 'levelSevere')}</span>
            </div>
          </div>
          <TrendChart evaluations={evaluations} />
        </div>

        {/* ── Agudeza Visual ── */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{lang === 'es' ? 'Agudeza Visual' : 'Visual Acuity'}</h2>
              <p className="text-sm text-gray-400">{lang === 'es' ? 'Prueba Snellen · nivel 1–10 · mayor es mejor' : 'Snellen test · level 1–10 · higher is better'}</p>
            </div>
            {visionTests.length > 0 && (
              <div className="text-right ml-4 flex-shrink-0">
                <p className="text-xs text-gray-400 mb-0.5">{lang === 'es' ? 'Último resultado' : 'Last result'}</p>
                <p className="text-3xl font-black leading-none" style={{ color: visionDotColor(visionTests[0].mejor_nivel) }}>
                  {visionTests[0].mejor_nivel}<span className="text-lg text-gray-400">/10</span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{visionTests[0].agudeza}</p>
              </div>
            )}
          </div>
          <VisionChart entries={visionTests} lang={lang} />

          {/* Lista de pruebas individuales */}
          {visionTests.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-semibold text-gray-700 mb-3">
                {lang === 'es' ? 'Historial de pruebas' : 'Test history'}
              </p>
              <div className="space-y-2">
                {visionTests.slice(visionPage * PAGE_SIZE, (visionPage + 1) * PAGE_SIZE).map(v => {
                  const isExp = expandedVisionId === v.id;
                  const dot   = visionDotColor(v.mejor_nivel);
                  const zoneLbl = VISION_ZONES.slice().reverse().find(z => v.mejor_nivel > z.min)
                    ?? VISION_ZONES[0];
                  const zoneLabel = lang === 'es' ? zoneLbl.label_es : zoneLbl.label_en;

                  return (
                    <div key={v.id}
                      className={`border-2 rounded-xl transition-all duration-200 overflow-hidden
                        ${isExp ? 'border-indigo-300 shadow-md' : 'border-gray-100 hover:border-indigo-200'}`}>
                      <button className="w-full flex items-center gap-4 p-4 text-left"
                        onClick={() => setExpandedVisionId(isExp ? null : v.id)}>
                        {/* Badge nivel */}
                        <div className="w-14 h-14 rounded-lg flex flex-col items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${dot}18` }}>
                          <span className="text-lg font-extrabold leading-none" style={{ color: dot }}>
                            {v.mejor_nivel}
                          </span>
                          <span className="text-xs font-semibold text-gray-400">/10</span>
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 text-sm">{zoneLabel}</p>
                          <p className="text-xs text-indigo-600 font-medium">{v.agudeza}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{v.created_at} · {v.distancia_cm} cm</p>
                        </div>
                        {isExp
                          ? <ChevronUp   className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                          : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />}
                      </button>

                      {/* Panel expandido — niveles del test */}
                      {isExp && (
                        <div className="px-4 pb-4 border-t border-indigo-100 bg-indigo-50/40">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mt-3 mb-2">
                            {lang === 'es' ? 'Detalle por nivel' : 'Detail by level'}
                          </p>
                          <div className="space-y-1.5">
                            {v.resultados_json.map((r, idx) => (
                              <div key={idx} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 shadow-sm">
                                <span className="text-xs font-bold text-indigo-400 w-16 flex-shrink-0">
                                  {lang === 'es' ? 'Nivel' : 'Level'} {r.level}
                                </span>
                                <span className="text-xs text-gray-500 flex-1">{r.acuity}</span>
                                {r.canRead
                                  ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                      {lang === 'es' ? 'Leyó' : 'Read'} · {r.userInput}
                                    </span>
                                  : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                                      {lang === 'es' ? 'No leyó' : 'Failed'}
                                    </span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <ListPager total={visionTests.length} page={visionPage} setPage={setVisionPage} lang={lang} />
            </div>
          )}
        </div>

        {/* Evaluaciones en lista — clickables */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-1">{t('history', 'evaluationsTitle')}</h2>
          <p className="text-sm text-gray-400 mb-6">{t('history', 'evaluationsHint')}</p>
          {evaluations.length === 0 ? (
            <div className="text-center py-12">
              <Eye className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">{t('history', 'noEvaluations')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {evaluations.slice(evalPage * PAGE_SIZE, (evalPage + 1) * PAGE_SIZE).map((evaluation: Evaluation) => {
                const isExpanded = expandedEvalId === evaluation.id;
                const answers    = evaluation.respuestas_json ?? {};
                const qIds       = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(k => k in answers);

                return (
                  <div key={evaluation.id}
                    className={`border-2 rounded-xl transition-all duration-200 overflow-hidden
                      ${isExpanded ? 'border-indigo-400 shadow-md' : 'border-gray-100 hover:border-indigo-200'}`}
                  >
                    {/* Cabecera clicable */}
                    <button
                      className="w-full flex items-center gap-4 p-4 text-left"
                      onClick={() => setExpandedEvalId(isExpanded ? null : evaluation.id)}
                    >
                      {/* Score badge */}
                      <div className={`${evaluation.bg} w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <span className={`text-xl font-extrabold ${evaluation.color}`}>{evaluation.puntaje_fatiga}%</span>
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 text-sm">
                          {t('history', 'fatigueLevel')} {evaluation.level.toLowerCase()}
                        </p>
                        {evaluation.sintoma_dominante && (
                          <p className="text-xs text-indigo-600 font-medium">
                            {translations.symptomLabels[evaluation.sintoma_dominante]?.[lang] ?? evaluation.sintoma_dominante}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">{evaluation.created_at}</p>
                      </div>
                      {/* Chevron */}
                      {isExpanded
                        ? <ChevronUp  className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                        : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />}
                    </button>

                    {/* Panel expandido con respuestas */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-indigo-100 bg-indigo-50/40">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mt-3 mb-2">
                          {t('history', 'answersTitle')}
                        </p>
                        <div className="space-y-2">
                          {qIds.length === 0
                            ? <p className="text-xs text-gray-400 italic">{t('history', 'noAnswers')}</p>
                            : qIds.map((qId) => {
                              const val     = answers[qId];
                              const ansLabel = translations.answerLabels[val]?.[lang] ?? translations.answerLabels[0][lang];
                              const questionKey = (`q${qId}` as any);
                              const questionText = t('questionnaire', questionKey);

                              // Determine color based on answer value
                              const getAnswerColor = (value: number) => {
                                switch(value) {
                                  case 0: return 'text-green-700 bg-green-100';
                                  case 1: return 'text-blue-700 bg-blue-100';
                                  case 2: return 'text-yellow-700 bg-yellow-100';
                                  case 3: return 'text-orange-700 bg-orange-100';
                                  case 4: return 'text-red-700 bg-red-100';
                                  default: return 'text-gray-700 bg-gray-100';
                                }
                              };

                              const getDotColor = (value: number) => {
                                switch(value) {
                                  case 0: return 'bg-green-500';
                                  case 1: return 'bg-blue-500';
                                  case 2: return 'bg-yellow-500';
                                  case 3: return 'bg-orange-500';
                                  case 4: return 'bg-red-500';
                                  default: return 'bg-gray-500';
                                }
                              };

                              return (
                                <div key={qId} className="flex items-start gap-3 bg-white rounded-lg p-3 shadow-sm">
                                  <span className="text-xs font-bold text-indigo-400 w-5 flex-shrink-0 mt-0.5">
                                    {qId}.
                                  </span>
                                  <p className="flex-1 text-xs text-gray-700 leading-relaxed">
                                    {questionText}
                                  </p>
                                  <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${getAnswerColor(val)}`}>
                                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${getDotColor(val)} mr-1`} />
                                    {ansLabel}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <ListPager total={evaluations.length} page={evalPage} setPage={setEvalPage} lang={lang} />
            </div>
          )}
        </div>

        {/* Capturas de imagen */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-1">
            {lang === 'es' ? 'Capturas de imagen' : 'Image Captures'}
          </h2>
          <p className="text-sm text-gray-400 mb-5">
            {lang === 'es' ? 'Historial de análisis de imagen del ojo · Clic para ver descripción' : 'Eye image analysis history · Click to see description'}
          </p>
          {imageCapturas.length === 0 ? (
            <div className="text-center py-12">
              <Eye className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {lang === 'es' ? 'Aún no hay capturas de imagen registradas' : 'No image captures recorded yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {imageCapturas.slice(captPage * PAGE_SIZE, (captPage + 1) * PAGE_SIZE).map((cap) => {
                const isExp = expandedCapturaId === cap.id;
                const label = SINTOMA_LABELS[cap.sintoma];
                const nombre = label ? (lang === 'es' ? label.es : label.en) : cap.sintoma;
                const desc   = label ? (lang === 'es' ? label.desc_es : label.desc_en) : '';
                const isSano = cap.sintoma === 'ojo_sano';
                const color  = isSano ? 'border-green-200 hover:border-green-300' : 'border-amber-200 hover:border-amber-300';
                const badge  = isSano ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700';
                const dot    = isSano ? 'bg-green-500' : 'bg-amber-500';
                return (
                  <div key={cap.id}
                    className={`border-2 rounded-xl transition-all duration-200 overflow-hidden ${isExp ? (isSano ? 'border-green-400 shadow-md' : 'border-amber-400 shadow-md') : color}`}>
                    <button
                      className="w-full flex items-center gap-4 p-4 text-left"
                      onClick={() => setExpandedCapturaId(isExp ? null : cap.id)}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${badge}`}>
                        <span className={`w-3 h-3 rounded-full ${dot}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 text-sm">{nombre}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{cap.created_at}</p>
                      </div>
                      {isExp
                        ? <ChevronUp   className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />}
                    </button>
                    {isExp && desc && (
                      <div className={`px-4 pb-4 border-t ${isSano ? 'border-green-100 bg-green-50/40' : 'border-amber-100 bg-amber-50/40'}`}>
                        <p className="text-sm text-gray-700 mt-3 leading-relaxed">{desc}</p>
                      </div>
                    )}
                  </div>
                );
              })}
              <ListPager total={imageCapturas.length} page={captPage} setPage={setCaptPage} lang={lang} />
            </div>
          )}
        </div>

        {/* Ejercicios realizados */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-1">{t('history', 'exercisesTitle')}</h2>
          {onStartExercise && (
            <p className="text-sm text-gray-400 mb-5">
              {t('history', 'incompleteRetake')}
            </p>
          )}
          {exercises.length === 0 ? (
            <div className="text-center py-12">
              <Eye className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">{t('history', 'noExercises')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {exercises.slice(exPage * PAGE_SIZE, (exPage + 1) * PAGE_SIZE).map((exercise, index) => {
                const isComplete  = exercise.status !== 'incomplete';
                const exerciseId  = EXERCISE_NAME_TO_ID[exercise.tipo_ejercicio];
                return (
                  <div key={index}
                    className={`flex items-center justify-between p-4 rounded-lg transition border-l-4
                      ${isComplete
                        ? 'bg-green-50 border-green-400 hover:bg-green-100'
                        : 'bg-red-50  border-red-400  hover:bg-red-100'}`}
                  >
                    <div className="flex items-center gap-3">
                      {isComplete
                        ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                        : <XCircle      className="w-5 h-5 text-red-400   flex-shrink-0" />}
                      <div>
                        {/* Nombre amigable: mapeamos clave interna de BD → nombre visible */}
                        <p className="font-semibold text-gray-800">
                          {getExerciseDisplayName(exercise.tipo_ejercicio, lang as 'es' | 'en')}
                        </p>
                        <p className="text-xs text-gray-500">{exercise.created_at}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Botón retomar — solo en incompletos */}
                      {!isComplete && onStartExercise && exerciseId && (
                        <button
                          onClick={() => onStartExercise(exerciseId)}
                          className="flex items-center gap-1.5 text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-semibold transition"
                        >
                          <Play className="w-3 h-3" /> {t('common', 'retry')}
                        </button>
                      )}
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                          ${isComplete ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-700'}`}>
                          {isComplete ? t('common', 'complete') : t('common', 'incomplete')}
                        </span>
                        <span className="text-xs text-gray-500">{formatDuration(exercise.duracion)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <ListPager total={exercises.length} page={exPage} setPage={setExPage} lang={lang} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default History;
