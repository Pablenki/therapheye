import { useState, useEffect } from 'react';
import { ArrowLeft, Play, Pause, RotateCcw } from 'lucide-react';
import { sql } from '../neonCliente';
import { useUser } from '../context/UserContext';

const ExerciseSession = ({ exerciseId, onBack }: { exerciseId: string; onBack: () => void }) => {
  const [timeLeft, setTimeLeft] = useState(180); // 3 minutos por defecto
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const { user } = useUser();

  const exercises: Record<string, { title: string; duration: number; steps: string[] }> = {
    'palming': {
      title: 'Palming',
      duration: 180,
      steps: [
        'Frota tus manos vigorosamente para generar calor',
        'Coloca las palmas sobre tus ojos cerrados sin presionar',
        'Mantén esta posición y respira profundamente',
        'Visualiza oscuridad completa y relájate',
        'Retira las manos lentamente después de 3 minutos'
      ]
    },
    'focus': {
      title: 'Enfoque cercano-lejano',
      duration: 300,
      steps: [
        'Sostén tu pulgar a 25cm de tu cara',
        'Enfoca tu vista en el pulgar durante 5 segundos',
        'Cambia el enfoque a un objeto lejano (3-6 metros)',
        'Mantén el enfoque en el objeto lejano por 5 segundos',
        'Repite el ciclo durante 5 minutos'
      ]
    },
    '20-20-20': {
      title: 'Regla 20-20-20',
      duration: 20,
      steps: [
        'Detén tu trabajo actual',
        'Mira un objeto a 20 pies de distancia (6 metros)',
        'Mantén la mirada por 20 segundos',
        'Parpadea varias veces',
        'Regresa a tu trabajo'
      ]
    },
    'circles': {
      title: 'Círculos oculares',
      duration: 240,
      steps: [
        'Siéntate cómodamente con la espalda recta',
        'Mira hacia arriba tanto como puedas',
        'Mueve lentamente los ojos en círculos (sentido horario)',
        'Completa 10 círculos, luego cambia de dirección',
        'Parpadea varias veces al finalizar'
      ]
    }
  };

  const currentExercise = exercises[exerciseId] || exercises['palming'];

  useEffect(() => {
    setTimeLeft(currentExercise.duration);
  }, [exerciseId, currentExercise.duration]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            saveExerciseToDatabase();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  const saveExerciseToDatabase = async () => {
    setIsSaving(true);
    try {
      await sql`
        INSERT INTO historial_ejercicios (user_id, tipo_ejercicio, duracion, created_at)
        VALUES (${user?.id}, ${currentExercise.title}, ${currentExercise.duration}, NOW())
      `;
      
      console.log('Ejercicio guardado exitosamente');
      setIsComplete(true);
    } catch (error) {
      console.error('Error al guardar ejercicio:', error);
      setIsComplete(true); // Igual marcamos como completo aunque falle el guardado
    } finally {
      setIsSaving(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleReset = () => {
    setTimeLeft(currentExercise.duration);
    setIsRunning(false);
    setIsComplete(false);
  };

  if (isComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8 text-center">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">✓</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            ¡Ejercicio Completado!
          </h2>
          <p className="text-gray-600 mb-2">
            Has completado el ejercicio "{currentExercise.title}" exitosamente
          </p>
          {isSaving && (
            <p className="text-sm text-gray-500 mb-6">Guardando en tu historial...</p>
          )}
          {!isSaving && (
            <p className="text-sm text-green-600 mb-6">✓ Guardado en tu historial</p>
          )}
          <div className="flex gap-4">
            <button
              onClick={handleReset}
              className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
            >
              Repetir ejercicio
            </button>
            <button
              onClick={onBack}
              className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
            >
              Finalizar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-700 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver
        </button>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2 text-center">
            {currentExercise.title}
          </h1>
          <p className="text-gray-600 text-center mb-8">
            Duración: {Math.floor(currentExercise.duration / 60)} minutos
          </p>

          {/* Timer */}
          <div className="mb-8">
            <div className="w-48 h-48 mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl">
              <span className="text-6xl font-bold text-white">
                {formatTime(timeLeft)}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-4 mb-8">
            <button
              onClick={() => setIsRunning(!isRunning)}
              className="bg-indigo-600 text-white p-4 rounded-full hover:bg-indigo-700 transition shadow-lg"
            >
              {isRunning ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8" />}
            </button>
            <button
              onClick={handleReset}
              className="bg-gray-200 text-gray-800 p-4 rounded-full hover:bg-gray-300 transition shadow-lg"
            >
              <RotateCcw className="w-8 h-8" />
            </button>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 rounded-xl p-6">
            <h3 className="font-semibold text-gray-800 mb-4 text-lg">
              Pasos a seguir:
            </h3>
            <ol className="space-y-3">
              {currentExercise.steps.map((step, index) => (
                <li key={index} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </span>
                  <span className="text-gray-700">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExerciseSession;