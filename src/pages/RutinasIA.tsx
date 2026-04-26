// =========================================
// RUTINAS PERSONALIZADAS CON IA — Therapheye
// Claude Haiku genera rutina semanal basada en síntomas/metas del usuario
// =========================================

import { useState, useEffect } from 'react';
import { ArrowLeft, Sparkles, RefreshCw, Calendar, Clock, CheckCircle2, ChevronDown, ChevronUp, Play, Loader2 } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { sql, localISOString } from '../neonCliente';

interface Props {
  onBack: () => void;
  onStartExercise?: (id: string) => void;
}

interface DayPlan {
  dia: string;
  ejercicios: { nombre: string; duracion: string; id: string; descripcion: string }[];
  notas: string;
}

interface Rutina {
  id?: number;
  objetivo: string;
  rutina_semanal: DayPlan[];
  consejos: string[];
  created_at?: string;
}

const EXERCISE_IDS: Record<string, string> = {
  'Palming': 'palming',
  'Enfoque cercano-lejano': 'focus',
  'Regla 20-20-20': '20-20-20',
  'Círculos oculares': 'circles',
  'Simulación cerca/lejos': 'near-far',
};

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const SYSTEM_PROMPT = `Eres un especialista en salud visual que crea rutinas personalizadas de ejercicios oculares.

El usuario te describirá sus síntomas o metas visuales. Debes crear una rutina semanal de 7 días con ejercicios oculares terapéuticos.

Los ejercicios disponibles son ÚNICAMENTE estos (usa exactamente estos nombres):
- Palming (relajación ocular, 2-5 min)
- Enfoque cercano-lejano (acomodación, 3-5 min)
- Regla 20-20-20 (descanso digital, 1-2 min)
- Círculos oculares (movilidad, 2-3 min)
- Simulación cerca/lejos (flexibilidad, 3-5 min)

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta:
{
  "objetivo": "descripción corta del objetivo de la rutina",
  "rutina_semanal": [
    {
      "dia": "Lunes",
      "ejercicios": [
        { "nombre": "Palming", "duracion": "5 min", "id": "palming", "descripcion": "Para iniciar el día relajado" }
      ],
      "notas": "consejo específico para este día"
    }
  ],
  "consejos": ["consejo general 1", "consejo general 2", "consejo general 3"]
}

Adapta la intensidad y tipo de ejercicios según los síntomas. Los fines de semana pueden ser más livianos. Sé específico y clínico pero accesible.`;

export default function RutinasIA({ onBack, onStartExercise }: Props) {
  const { user } = useUser();
  const [sintomas, setSintomas] = useState('');
  const [rutina, setRutina] = useState<Rutina | null>(null);
  const [historial, setHistorial] = useState<Rutina[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>('Lunes');
  const [activeTab, setActiveTab] = useState<'nueva' | 'historial'>('nueva');

  useEffect(() => {
    cargarHistorial();
  }, [user?.id]);

  const cargarHistorial = async () => {
    if (!user?.id) return;
    setLoadingHistory(true);
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS rutinas_personalizadas (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          objetivo TEXT NOT NULL,
          rutina_json JSONB NOT NULL,
          consejos JSONB NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      const rows = await sql`
        SELECT id, objetivo, rutina_json, consejos, created_at
        FROM rutinas_personalizadas
        WHERE user_id = ${user.id}
        ORDER BY created_at DESC
        LIMIT 5
      `;
      const parsed: Rutina[] = rows.map((r: any) => ({
        id: r.id,
        objetivo: r.objetivo,
        rutina_semanal: typeof r.rutina_json === 'string' ? JSON.parse(r.rutina_json) : r.rutina_json,
        consejos: typeof r.consejos === 'string' ? JSON.parse(r.consejos) : r.consejos,
        created_at: r.created_at,
      }));
      setHistorial(parsed);
      if (parsed.length > 0 && !rutina) setRutina(parsed[0]);
    } catch (e) {
      console.error('Error cargando historial rutinas:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const generarRutina = async () => {
    if (!sintomas.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: sintomas }],
        }),
      });
      if (!resp.ok) throw new Error('Error al contactar la IA');
      const data = await resp.json();
      const text = data.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Respuesta de IA inválida');
      const parsed = JSON.parse(jsonMatch[0]) as Rutina;

      // Guardar en BD
      if (user?.id) {
        await sql`
          INSERT INTO rutinas_personalizadas (user_id, objetivo, rutina_json, consejos, created_at)
          VALUES (${user.id}, ${parsed.objetivo}, ${JSON.stringify(parsed.rutina_semanal)}, ${JSON.stringify(parsed.consejos)}, ${localISOString()})
        `;
      }
      setRutina(parsed);
      setActiveTab('nueva');
      await cargarHistorial();
    } catch (e: any) {
      setError(e.message ?? 'Error al generar la rutina');
    } finally {
      setLoading(false);
    }
  };

  const getDiaActual = () => DIAS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-xl transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Rutinas con IA</h1>
            <p className="text-xs text-gray-500">Plan semanal personalizado</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Input de síntomas */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-1">¿Cuáles son tus síntomas o metas?</h2>
          <p className="text-xs text-gray-500 mb-3">Describe cómo se sienten tus ojos, qué actividades haces frente a pantalla, o qué quieres mejorar.</p>
          <textarea
            value={sintomas}
            onChange={e => setSintomas(e.target.value)}
            rows={4}
            placeholder="Ej: Me duelen los ojos al final del día después de 8 horas frente a la computadora. Tengo los ojos secos y me cuesta enfocar objetos lejanos..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          <button
            onClick={generarRutina}
            disabled={loading || !sintomas.trim()}
            className="mt-3 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-xl py-3 hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Generando rutina...' : 'Generar mi rutina semanal'}
          </button>
        </div>

        {/* Tabs */}
        {(rutina || historial.length > 0) && (
          <div className="flex gap-2">
            {['nueva', 'historial'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${activeTab === tab ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
              >
                {tab === 'nueva' ? 'Rutina actual' : `Historial (${historial.length})`}
              </button>
            ))}
          </div>
        )}

        {/* Rutina actual */}
        {activeTab === 'nueva' && rutina && (
          <div className="space-y-4">
            {/* Objetivo */}
            <div className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-2xl border border-indigo-100 p-4">
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">Objetivo</p>
              <p className="text-sm text-gray-700 leading-relaxed">{rutina.objetivo}</p>
            </div>

            {/* Días */}
            <div className="space-y-2">
              {rutina.rutina_semanal.map(day => {
                const isHoy = day.dia === getDiaActual();
                const isExpanded = expandedDay === day.dia;
                return (
                  <div
                    key={day.dia}
                    className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${isHoy ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-gray-100'}`}
                  >
                    <button
                      onClick={() => setExpandedDay(isExpanded ? null : day.dia)}
                      className="w-full flex items-center justify-between px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isHoy ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                          {day.dia.substring(0, 2)}
                        </div>
                        <div className="text-left">
                          <p className={`text-sm font-semibold ${isHoy ? 'text-indigo-700' : 'text-gray-800'}`}>
                            {day.dia} {isHoy && <span className="text-xs bg-indigo-100 text-indigo-600 rounded-full px-2 py-0.5 ml-1">Hoy</span>}
                          </p>
                          <p className="text-xs text-gray-500">{day.ejercicios.length} ejercicio{day.ejercicios.length !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-2 border-t border-gray-50">
                        {day.notas && (
                          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-2">{day.notas}</p>
                        )}
                        {day.ejercicios.map((ej, i) => (
                          <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800">{ej.nombre}</p>
                              <p className="text-xs text-gray-500">{ej.descripcion}</p>
                            </div>
                            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />{ej.duracion}
                              </span>
                              {onStartExercise && EXERCISE_IDS[ej.nombre] && (
                                <button
                                  onClick={() => onStartExercise(EXERCISE_IDS[ej.nombre])}
                                  className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                                  title="Iniciar ejercicio"
                                >
                                  <Play className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Consejos generales */}
            {rutina.consejos.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Consejos generales
                </h3>
                <ul className="space-y-2">
                  {rutina.consejos.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                      <span className="w-4 h-4 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Historial de rutinas */}
        {activeTab === 'historial' && (
          <div className="space-y-3">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              </div>
            ) : historial.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Aún no tienes rutinas guardadas</p>
              </div>
            ) : (
              historial.map(r => (
                <button
                  key={r.id}
                  onClick={() => { setRutina(r); setActiveTab('nueva'); setExpandedDay(getDiaActual()); }}
                  className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:border-indigo-200 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-800 leading-snug">{r.objetivo}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {r.created_at ? new Date(r.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                      </p>
                    </div>
                    <RefreshCw className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" />
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* Estado vacío inicial */}
        {!rutina && !loading && historial.length === 0 && !loadingHistory && (
          <div className="text-center py-10">
            <div className="w-16 h-16 bg-gradient-to-br from-violet-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-8 h-8 text-indigo-400" />
            </div>
            <p className="text-gray-500 text-sm max-w-xs mx-auto">
              Describe tus síntomas o metas y la IA creará un plan semanal de ejercicios visuales adaptado para ti.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
