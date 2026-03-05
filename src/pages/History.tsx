import { useEffect, useState } from 'react';
import { ArrowLeft, Calendar, TrendingUp, Eye, CheckCircle2, XCircle, ChevronDown, ChevronUp, Play } from 'lucide-react';

// Mapa de nombre de ejercicio (guardado en DB) → ID de ejercicio en ExerciseSession
const EXERCISE_NAME_TO_ID: Record<string, string> = {
  'Palming':                  'palming',
  'Enfoque cercano-lejano':   'focus',
  'Regla 20-20-20':           '20-20-20',
  'Círculos oculares':        'circles',
  'Simulación cerca/lejos':   'near-far',
};
import { sql } from '../neonCliente';
import { useUser } from '../context/UserContext';

// ─── Banco de preguntas (sincronizado con Questionnaire.tsx) ─────────────────
const QUESTION_LABELS: Record<number, string> = {
  1:  '¿Con qué frecuencia ves borroso al leer texto en pantalla?',
  2:  '¿Sientes sequedad, arenilla o picazón en los ojos?',
  3:  '¿Presentas dolores de cabeza que aparecen o empeoran al usar pantallas?',
  4:  '¿Tienes molestia o ardor ante luces brillantes o el resplandor de pantallas?',
  5:  '¿Te cuesta enfocar cuando cambias la mirada de cerca (pantalla) a lejos (ventana)?',
  6:  '¿Observas que tus ojos se enrojecen después de usar pantallas?',
  7:  '¿Sientes los ojos "pesados" o cansados conforme avanza el día de trabajo?',
  8:  '¿Ves doble (dos imágenes superpuestas) de manera temporal?',
  9:  '¿Notas que parpadeas menos de lo normal o que debes recordarte parpadear?',
  10: '¿Sientes tensión en los músculos de la cara, ojos o cuello al trabajar en pantallas?',
};

const ANSWER_LABELS: Record<number, { label: string; color: string; dot: string }> = {
  0: { label: 'Nunca',          color: 'text-green-700  bg-green-100',  dot: 'bg-green-500'  },
  1: { label: 'Rara vez',       color: 'text-blue-700   bg-blue-100',   dot: 'bg-blue-500'   },
  2: { label: 'A veces',        color: 'text-yellow-700 bg-yellow-100', dot: 'bg-yellow-500' },
  3: { label: 'Frecuentemente', color: 'text-orange-700 bg-orange-100', dot: 'bg-orange-500' },
  4: { label: 'Siempre',        color: 'text-red-700    bg-red-100',    dot: 'bg-red-500'    },
};

const SYMPTOM_LABELS: Record<string, string> = {
  visual:  'Disfunción de acomodación',
  comfort: 'Ojo seco digital',
  pain:    'Cefalea tensional digital',
  fatigue: 'Astenopia digital',
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

// ─── Gráfica de tendencia SVG ─────────────────────────────────────────────────
const TrendChart = ({ evaluations }: { evaluations: Evaluation[] }) => {
  if (evaluations.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-gray-400">
        <TrendingUp className="w-10 h-10 mb-2 opacity-30" />
        <p className="text-sm">Necesitas al menos 2 evaluaciones para ver la tendencia</p>
      </div>
    );
  }

  // Los datos vienen ORDER BY DESC → invertimos para cronológico
  const data = [...evaluations].reverse();

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

  // Línea principal
  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(d.puntaje_fatiga)}`)
    .join(' ');

  // Área rellena bajo la línea
  const areaPath =
    `M ${toX(0)} ${toY(data[0].puntaje_fatiga)} ` +
    data.slice(1).map((d, i) => `L ${toX(i + 1)} ${toY(d.puntaje_fatiga)}`).join(' ') +
    ` L ${toX(data.length - 1)} ${PAD.top + chartH} L ${toX(0)} ${PAD.top + chartH} Z`;

  // Color de cada punto según nivel
  const dotColor = (score: number) => {
    if (score < 25) return '#16a34a';
    if (score < 50) return '#ca8a04';
    if (score < 75) return '#ea580c';
    return '#dc2626';
  };

  // Etiquetas eje Y
  const yLabels = [0, 25, 50, 75, 100];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      aria-label="Gráfica de tendencia de fatiga visual"
    >
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#6366f1" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
        </linearGradient>
        {/* Zonas de color de fondo */}
        <clipPath id="chartClip">
          <rect x={PAD.left} y={PAD.top} width={chartW} height={chartH} />
        </clipPath>
      </defs>

      {/* Zonas de severidad */}
      <g clipPath="url(#chartClip)">
        <rect x={PAD.left} y={toY(100)} width={chartW} height={toY(75) - toY(100)} fill="#fecaca" opacity="0.3" />
        <rect x={PAD.left} y={toY(75)}  width={chartW} height={toY(50) - toY(75)}  fill="#fed7aa" opacity="0.3" />
        <rect x={PAD.left} y={toY(50)}  width={chartW} height={toY(25) - toY(50)}  fill="#fef08a" opacity="0.3" />
        <rect x={PAD.left} y={toY(25)}  width={chartW} height={toY(0)  - toY(25)}  fill="#bbf7d0" opacity="0.3" />
      </g>

      {/* Grid horizontal */}
      {yLabels.map((v) => (
        <g key={v}>
          <line
            x1={PAD.left} y1={toY(v)} x2={PAD.left + chartW} y2={toY(v)}
            stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 3"
          />
          <text x={PAD.left - 6} y={toY(v) + 4} textAnchor="end" fontSize="9" fill="#9ca3af">
            {v}%
          </text>
        </g>
      ))}

      {/* Área rellena */}
      <path d={areaPath} fill="url(#areaGrad)" />

      {/* Línea de tendencia */}
      <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Puntos + tooltips */}
      {data.map((d, i) => (
        <g key={d.id}>
          {/* Línea vertical al hover */}
          <line
            x1={toX(i)} y1={PAD.top} x2={toX(i)} y2={PAD.top + chartH}
            stroke="#6366f1" strokeWidth="1" strokeDasharray="3 3" opacity="0.3"
          />
          {/* Punto exterior (halo) */}
          <circle cx={toX(i)} cy={toY(d.puntaje_fatiga)} r="7" fill={dotColor(d.puntaje_fatiga)} opacity="0.2" />
          {/* Punto */}
          <circle cx={toX(i)} cy={toY(d.puntaje_fatiga)} r="4.5" fill={dotColor(d.puntaje_fatiga)} stroke="white" strokeWidth="1.5" />
          {/* Valor sobre el punto */}
          <text
            x={toX(i)} y={toY(d.puntaje_fatiga) - 10}
            textAnchor="middle" fontSize="9" fontWeight="bold"
            fill={dotColor(d.puntaje_fatiga)}
          >
            {d.puntaje_fatiga}%
          </text>
          {/* Fecha bajo el eje */}
          <text
            x={toX(i)} y={PAD.top + chartH + 14}
            textAnchor="middle" fontSize="8" fill="#6b7280"
            transform={data.length > 5 ? `rotate(-30, ${toX(i)}, ${PAD.top + chartH + 14})` : undefined}
          >
            {d.created_at}
          </text>
        </g>
      ))}

      {/* Eje X */}
      <line x1={PAD.left} y1={PAD.top + chartH} x2={PAD.left + chartW} y2={PAD.top + chartH}
        stroke="#d1d5db" strokeWidth="1" />
      {/* Eje Y */}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + chartH}
        stroke="#d1d5db" strokeWidth="1" />
    </svg>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────
interface HistoryProps {
  onBack: () => void;
  onStartExercise?: (exerciseId: string) => void;
}

const History = ({ onBack, onStartExercise }: HistoryProps) => {
  const [evaluations, setEvaluations]         = useState<Evaluation[]>([]);
  const [exercises, setExercises]             = useState<Exercise[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [expandedEvalId, setExpandedEvalId]   = useState<string | null>(null);

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
        const createdDate = new Date(ev.created_at);
        return {
          id: ev.id,
          raw_date: createdDate,
          created_at: createdDate.toLocaleString('es-MX', {
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
        LIMIT 10
      `;

      const formattedExercises = exercisesResult.map((ex: any) => {
        const createdDate = new Date(ex.created_at);
        return {
          created_at: createdDate.toLocaleString('es-MX', {
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

      setEvaluations(formattedEvaluations);
      setExercises(formattedExercises);
    } catch (error) {
      console.error('Error al cargar historial:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreData = (score: number) => {
    if (score < 25) return { level: 'Leve',         color: 'text-green-600',  bg: 'bg-green-50'  };
    if (score < 50) return { level: 'Moderada',     color: 'text-yellow-600', bg: 'bg-yellow-50' };
    if (score < 75) return { level: 'Considerable', color: 'text-orange-600', bg: 'bg-orange-50' };
    return             { level: 'Severa',            color: 'text-red-600',    bg: 'bg-red-50'    };
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds} seg`;
    return `${Math.floor(seconds / 60)} min`;
  };

  const getTrend = () => {
    if (evaluations.length < 2) return null;
    const diff = evaluations[0].puntaje_fatiga - evaluations[1].puntaje_fatiga;
    if (diff < 0) return { text: '↓ Mejorando',  color: 'text-green-600' };
    if (diff > 0) return { text: '↑ Empeorando', color: 'text-red-600'   };
    return           { text: '→ Estable',         color: 'text-gray-600'  };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Cargando historial...</p>
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
          Volver al Dashboard
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-1">Historial de {user?.nombre}</h1>
          <p className="text-gray-600">Revisa tu progreso y evaluaciones anteriores</p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-8 h-8 text-blue-600" />
              <h3 className="font-semibold text-gray-800">Total Evaluaciones</h3>
            </div>
            <p className="text-3xl font-bold text-gray-800">{evaluations.length}</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-8 h-8 text-green-600" />
              <h3 className="font-semibold text-gray-800">Tendencia</h3>
            </div>
            {trend
              ? <p className={`text-3xl font-bold ${trend.color}`}>{trend.text}</p>
              : <p className="text-xl text-gray-500">Sin datos suficientes</p>}
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <Eye className="w-8 h-8 text-purple-600" />
              <h3 className="font-semibold text-gray-800">Última Evaluación</h3>
            </div>
            <p className="text-3xl font-bold text-gray-800">
              {evaluations.length > 0 ? `${evaluations[0].puntaje_fatiga}%` : 'N/A'}
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg md:col-span-3">
            <h3 className="font-semibold text-gray-800 mb-3">Ejercicios (últimos 10)</h3>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span className="text-2xl font-bold text-green-600">
                  {exercises.filter(e => e.status !== 'incomplete').length}
                </span>
                <span className="text-sm text-gray-500">Completados</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-400" />
                <span className="text-2xl font-bold text-red-500">
                  {exercises.filter(e => e.status === 'incomplete').length}
                </span>
                <span className="text-sm text-gray-500">Incompletos</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Gráfica de tendencia ── */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-800">Evolución de Fatiga Visual</h2>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-400 inline-block" /> Leve</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" /> Moderada</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block" /> Considerable</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Severa</span>
            </div>
          </div>
          <TrendChart evaluations={evaluations} />
        </div>

        {/* Evaluaciones en lista — clickables */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-1">Evaluaciones de Fatiga Visual</h2>
          <p className="text-sm text-gray-400 mb-6">Haz clic en una evaluación para ver tus respuestas</p>
          {evaluations.length === 0 ? (
            <div className="text-center py-12">
              <Eye className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Aún no has realizado ninguna evaluación</p>
            </div>
          ) : (
            <div className="space-y-3">
              {evaluations.map((evaluation) => {
                const isExpanded = expandedEvalId === evaluation.id;
                const answers    = evaluation.respuestas_json ?? {};
                const qIds       = Object.keys(QUESTION_LABELS).map(Number).filter(k => k in answers);

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
                          Fatiga visual {evaluation.level.toLowerCase()}
                        </p>
                        {evaluation.sintoma_dominante && (
                          <p className="text-xs text-indigo-600 font-medium">
                            {SYMPTOM_LABELS[evaluation.sintoma_dominante] ?? evaluation.sintoma_dominante}
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
                          Respuestas de esta evaluación
                        </p>
                        <div className="space-y-2">
                          {qIds.length === 0
                            ? <p className="text-xs text-gray-400 italic">No hay respuestas guardadas para esta evaluación.</p>
                            : qIds.map((qId) => {
                              const val     = answers[qId];
                              const ansInfo = ANSWER_LABELS[val] ?? ANSWER_LABELS[0];
                              return (
                                <div key={qId} className="flex items-start gap-3 bg-white rounded-lg p-3 shadow-sm">
                                  <span className="text-xs font-bold text-indigo-400 w-5 flex-shrink-0 mt-0.5">
                                    {qId}.
                                  </span>
                                  <p className="flex-1 text-xs text-gray-700 leading-relaxed">
                                    {QUESTION_LABELS[qId]}
                                  </p>
                                  <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${ansInfo.color}`}>
                                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${ansInfo.dot} mr-1`} />
                                    {ansInfo.label}
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
            </div>
          )}
        </div>

        {/* Ejercicios realizados */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-1">Ejercicios Realizados</h2>
          {onStartExercise && (
            <p className="text-sm text-gray-400 mb-5">
              Los ejercicios incompletos se pueden retomar desde aquí
            </p>
          )}
          {exercises.length === 0 ? (
            <div className="text-center py-12">
              <Eye className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Aún no has realizado ningún ejercicio</p>
            </div>
          ) : (
            <div className="space-y-3">
              {exercises.map((exercise, index) => {
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
                        <p className="font-semibold text-gray-800">{exercise.tipo_ejercicio}</p>
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
                          <Play className="w-3 h-3" /> Retomar
                        </button>
                      )}
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                          ${isComplete ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-700'}`}>
                          {isComplete ? 'Completado' : 'Incompleto'}
                        </span>
                        <span className="text-xs text-gray-500">{formatDuration(exercise.duracion)}</span>
                      </div>
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

export default History;
