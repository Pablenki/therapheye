import { useEffect, useState } from 'react';
import { ArrowLeft, Calendar, TrendingUp, Eye } from 'lucide-react';
import { sql } from '../neonCliente';
import { useUser } from '../context/UserContext';

interface Evaluation {
  id: string;
  created_at: string;
  puntaje_fatiga: number;
  level: string;
  color: string;
  bg: string;
}

interface Exercise {
  created_at: string;
  tipo_ejercicio: string;
  duracion: number;
}

const History = ({ onBack }: { onBack: () => void }) => {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { user } = useUser();

  useEffect(() => {
    loadHistoryData();
  }, []);

  const loadHistoryData = async () => {
    try {
      // Cargar evaluaciones
      const evaluationsResult = await sql`
        SELECT id, created_at, puntaje_fatiga, respuestas_json
        FROM respuestas_cuestionario
        WHERE user_id = ${user?.id}
        ORDER BY created_at DESC
      `;

      const formattedEvaluations = evaluationsResult.map((evaluation: any) => {
        const scoreData = getScoreData(evaluation.puntaje_fatiga);
        return {
          id: evaluation.id,
          created_at: new Date(evaluation.created_at).toLocaleDateString('es-MX', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric' 
          }),
          puntaje_fatiga: evaluation.puntaje_fatiga,
          ...scoreData
        };
      });

      // Cargar ejercicios
      const exercisesResult = await sql`
        SELECT created_at, tipo_ejercicio, duracion
        FROM historial_ejercicios
        WHERE user_id = ${user?.id}
        ORDER BY created_at DESC
        LIMIT 10
      `;

      const formattedExercises = exercisesResult.map((ex: any) => ({
        created_at: new Date(ex.created_at).toLocaleDateString('es-MX', { 
          day: '2-digit', 
          month: 'short', 
          year: 'numeric' 
        }),
        tipo_ejercicio: ex.tipo_ejercicio,
        duracion: ex.duracion
      }));

      setEvaluations(formattedEvaluations);
      setExercises(formattedExercises);
    } catch (error) {
      console.error('Error al cargar historial:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreData = (score: number) => {
    if (score < 25) return { level: 'Leve', color: 'text-green-600', bg: 'bg-green-50' };
    if (score < 50) return { level: 'Moderada', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    if (score < 75) return { level: 'Considerable', color: 'text-orange-600', bg: 'bg-orange-50' };
    return { level: 'Severa', color: 'text-red-600', bg: 'bg-red-50' };
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds} seg`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes} min`;
  };

  const getTrend = () => {
    if (evaluations.length < 2) return null;
    const latest = evaluations[0].puntaje_fatiga;
    const previous = evaluations[1].puntaje_fatiga;
    if (latest < previous) return { text: '↓ Mejorando', color: 'text-green-600' };
    if (latest > previous) return { text: '↑ Empeorando', color: 'text-red-600' };
    return { text: '→ Estable', color: 'text-gray-600' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando historial...</p>
        </div>
      </div>
    );
  }

  const trend = getTrend();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-700 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver al Dashboard
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Historial de {user?.nombre}
          </h1>
          <p className="text-gray-600">
            Revisa tu progreso y evaluaciones anteriores
          </p>
        </div>

        {/* Stats Overview */}
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
            {trend ? (
              <p className={`text-3xl font-bold ${trend.color}`}>{trend.text}</p>
            ) : (
              <p className="text-xl text-gray-500">Sin datos suficientes</p>
            )}
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
        </div>

        {/* Evaluations History */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            Evaluaciones de Fatiga Visual
          </h2>
          
          {evaluations.length === 0 ? (
            <div className="text-center py-12">
              <Eye className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                Aún no has realizado ninguna evaluación
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {evaluations.map((evaluation) => (
                <div
                  key={evaluation.id}
                  className="border-2 border-gray-100 rounded-lg p-4 hover:border-indigo-200 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`${evaluation.bg} w-16 h-16 rounded-lg flex items-center justify-center`}>
                        <span className={`text-2xl font-bold ${evaluation.color}`}>
                          {evaluation.puntaje_fatiga}%
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">
                          Fatiga visual {evaluation.level.toLowerCase()}
                        </p>
                        <p className="text-sm text-gray-500">{evaluation.created_at}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Exercise History */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            Ejercicios Realizados
          </h2>
          
          {exercises.length === 0 ? (
            <div className="text-center py-12">
              <Eye className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                Aún no has realizado ningún ejercicio
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {exercises.map((exercise, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                >
                  <div>
                    <p className="font-semibold text-gray-800">{exercise.tipo_ejercicio}</p>
                    <p className="text-sm text-gray-500">{exercise.created_at}</p>
                  </div>
                  <span className="text-sm font-medium text-indigo-600">
                    {formatDuration(exercise.duracion)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default History;