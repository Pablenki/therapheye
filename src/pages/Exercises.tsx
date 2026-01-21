import { ArrowLeft, Eye, Focus, Maximize2, RotateCw } from 'lucide-react';

interface Exercise {
  id: string;
  title: string;
  description: string;
  duration: string;
  icon: typeof Eye;
  color: string;
}

const Exercises = ({ onBack, onStartExercise }: { onBack: () => void; onStartExercise: (id: string) => void }) => {
  const exercises: Exercise[] = [
    {
      id: 'palming',
      title: 'Palming',
      description: 'Técnica de relajación ocular mediante el calor de las manos',
      duration: '3 min',
      icon: Eye,
      color: 'bg-blue-500'
    },
    {
      id: 'focus',
      title: 'Enfoque cercano-lejano',
      description: 'Alterna el enfoque entre objetos cercanos y lejanos',
      duration: '5 min',
      icon: Focus,
      color: 'bg-green-500'
    },
    {
      id: '20-20-20',
      title: 'Regla 20-20-20',
      description: 'Cada 20 min, mira algo a 20 pies por 20 segundos',
      duration: '20 seg',
      icon: Maximize2,
      color: 'bg-purple-500'
    },
    {
      id: 'circles',
      title: 'Círculos oculares',
      description: 'Ejercicio de movimiento circular para fortalecer músculos',
      duration: '4 min',
      icon: RotateCw,
      color: 'bg-orange-500'
    }
  ];

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
            Ejercicios Visuales
          </h1>
          <p className="text-gray-600">
            Selecciona un ejercicio para comenzar tu rutina de descanso visual
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {exercises.map((exercise) => (
            <div
              key={exercise.id}
              className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className={`${exercise.color} w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <exercise.icon className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-800 mb-1">
                    {exercise.title}
                  </h3>
                  <p className="text-sm text-gray-500 mb-2">
                    Duración: {exercise.duration}
                  </p>
                </div>
              </div>
              
              <p className="text-gray-600 mb-6">
                {exercise.description}
              </p>

              <button
                onClick={() => onStartExercise(exercise.id)}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
              >
                Iniciar ejercicio
              </button>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-white rounded-xl p-6 shadow-lg">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            Consejos para mejores resultados
          </h3>
          <ul className="space-y-3 text-gray-700">
            <li className="flex items-start gap-3">
              <span className="text-green-500 font-bold">•</span>
              <span>Realiza los ejercicios en un ambiente tranquilo y con buena iluminación</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-500 font-bold">•</span>
              <span>Practica regularmente, idealmente 2-3 veces al día</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-500 font-bold">•</span>
              <span>No fuerces la vista, si sientes molestia detente inmediatamente</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-500 font-bold">•</span>
              <span>Combina estos ejercicios con pausas activas durante tu jornada</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Exercises;