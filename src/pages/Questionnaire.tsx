import { useState } from 'react';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { sql } from '../neonCliente';
import { useUser } from '../context/UserContext';

interface Question {
  id: number;
  text: string;
  category: string;
}

const Questionnaire = ({ onBack }: { onBack: () => void }) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [isComplete, setIsComplete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const { user } = useUser();

  const questions: Question[] = [
    { id: 1, text: '¿Con qué frecuencia experimentas visión borrosa?', category: 'visual' },
    { id: 2, text: '¿Sientes sequedad en los ojos?', category: 'comfort' },
    { id: 3, text: '¿Experimentas dolores de cabeza frecuentes?', category: 'pain' },
    { id: 4, text: '¿Tienes sensibilidad a la luz?', category: 'comfort' },
    { id: 5, text: '¿Dificultad para enfocar objetos?', category: 'visual' },
    { id: 6, text: '¿Ojos rojos o irritados?', category: 'comfort' },
    { id: 7, text: '¿Cansancio visual al final del día?', category: 'fatigue' },
    { id: 8, text: '¿Visión doble ocasional?', category: 'visual' },
  ];

  const options = [
    { value: 0, label: 'Nunca', color: 'bg-green-500' },
    { value: 1, label: 'Rara vez', color: 'bg-blue-500' },
    { value: 2, label: 'A veces', color: 'bg-yellow-500' },
    { value: 3, label: 'Frecuentemente', color: 'bg-orange-500' },
    { value: 4, label: 'Siempre', color: 'bg-red-500' },
  ];

  const handleAnswer = async (value: number) => {
    const newAnswers = { ...answers, [questions[currentQuestion].id]: value };
    setAnswers(newAnswers);
    
    if (currentQuestion < questions.length - 1) {
      setTimeout(() => setCurrentQuestion(currentQuestion + 1), 300);
    } else {
      // Última pregunta - guardar en BD
      setIsSaving(true);
      await saveToDatabase(newAnswers);
      setTimeout(() => setIsComplete(true), 300);
    }
  };

  const saveToDatabase = async (finalAnswers: Record<number, number>) => {
    try {
      const score = calculateScore(finalAnswers);
      
      await sql`
        INSERT INTO respuestas_cuestionario (user_id, respuestas_json, puntaje_fatiga, created_at)
        VALUES (${user?.id}, ${JSON.stringify(finalAnswers)}, ${score}, NOW())
      `;
      
      console.log('Respuestas guardadas exitosamente');
    } catch (error) {
      console.error('Error al guardar respuestas:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const calculateScore = (finalAnswers: Record<number, number>) => {
    const total = Object.values(finalAnswers).reduce((sum, val) => sum + val, 0);
    const max = questions.length * 4;
    return Math.round((total / max) * 100);
  };

  const getScoreMessage = (score: number) => {
    if (score < 25) return { text: 'Fatiga visual leve', color: 'text-green-600', bg: 'bg-green-50' };
    if (score < 50) return { text: 'Fatiga visual moderada', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    if (score < 75) return { text: 'Fatiga visual considerable', color: 'text-orange-600', bg: 'bg-orange-50' };
    return { text: 'Fatiga visual severa', color: 'text-red-600', bg: 'bg-red-50' };
  };

  if (isComplete) {
    const score = calculateScore(answers);
    const scoreMsg = getScoreMessage(score);

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8">
          <div className="text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              ¡Evaluación Completada!
            </h2>
            <p className="text-gray-600 mb-6">
              Hemos analizado tus respuestas y guardado tu evaluación
            </p>

            <div className={`${scoreMsg.bg} rounded-xl p-6 mb-6`}>
              <p className="text-sm text-gray-600 mb-2">Tu nivel de fatiga visual:</p>
              <p className={`text-4xl font-bold ${scoreMsg.color} mb-2`}>
                {score}%
              </p>
              <p className={`text-lg font-semibold ${scoreMsg.color}`}>
                {scoreMsg.text}
              </p>
            </div>

            <div className="bg-blue-50 rounded-xl p-6 mb-6 text-left">
              <h3 className="font-semibold text-gray-800 mb-3">Recomendaciones:</h3>
              <ul className="space-y-2 text-gray-700">
                <li>✓ Realiza ejercicios visuales regularmente</li>
                <li>✓ Toma descansos cada 20 minutos</li>
                <li>✓ Ajusta la iluminación de tu pantalla</li>
                <li>✓ Mantén una distancia adecuada del monitor</li>
              </ul>
            </div>

            <button
              onClick={onBack}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
            >
              Volver al Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-3xl mx-auto pt-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-700 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver
        </button>

        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Pregunta {currentQuestion + 1} de {questions.length}</span>
            <span>{Math.round(((currentQuestion + 1) / questions.length) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-indigo-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-8 text-center">
            {questions[currentQuestion].text}
          </h2>

          <div className="space-y-3">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => handleAnswer(option.value)}
                disabled={isSaving}
                className={`w-full p-4 rounded-lg border-2 transition-all duration-200 flex items-center gap-4
                  ${answers[questions[currentQuestion].id] === option.value
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                  } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className={`w-4 h-4 rounded-full ${option.color}`} />
                <span className="font-medium text-gray-700">{option.label}</span>
              </button>
            ))}
          </div>
          
          {isSaving && (
            <p className="text-center text-gray-600 mt-4">Guardando respuestas...</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Questionnaire;