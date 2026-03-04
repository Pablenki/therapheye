import { useState } from 'react';
import { ArrowLeft, CheckCircle, Eye, Droplets, Brain, Zap, Play, ListOrdered } from 'lucide-react';
import { sql } from '../neonCliente';
import { useUser } from '../context/UserContext';

interface Question {
  id: number;
  text: string;
  hint: string;
  category: 'visual' | 'comfort' | 'pain' | 'fatigue';
}

// ─── Mapa de síntomas enriquecido ──────────────────────────────────────────────
const SYMPTOM_INFO: Record<string, {
  label: string;
  description: string;
  clinical: string;
  color: string;
  bg: string;
  border: string;
  iconBg: string;
  Icon: typeof Eye;
  exercises: Array<{ id: string; title: string; duration: string; reason: string; clinicalBasis: string }>;
}> = {
  visual: {
    label: 'Disfunción de acomodación',
    description: 'Presentas dificultad para enfocar y episodios de visión borrosa o doble.',
    clinical: 'El trabajo prolongado en pantalla obliga al músculo ciliar a mantenerse en estado de contracción sostenida (espasmo de acomodación). Esto reduce la amplitud de acomodación y puede provocar miopía pseudoprogresiva. La alternancia entre distancias cercanas y lejanas es el tratamiento de elección para restaurar la flexibilidad del cristalino.',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    iconBg: 'bg-blue-100',
    Icon: Eye,
    exercises: [
      {
        id: 'focus',
        title: 'Enfoque cercano-lejano',
        duration: '5 min',
        reason: 'Entrena y relaja los músculos de acomodación',
        clinicalBasis: 'Ejercita activamente el músculo ciliar en ambas direcciones, previniendo el espasmo y mejorando la amplitud de acomodación en 2–4 semanas de práctica regular.',
      },
      {
        id: 'near-far',
        title: 'Simulación cerca/lejos',
        duration: '3 min',
        reason: 'Ejercita la flexibilidad del cristalino',
        clinicalBasis: 'Estimula la respuesta vergencial y acomodativa sincrónica mediante un estímulo visual controlado, sin requerir movimiento físico del paciente.',
      },
      {
        id: '20-20-20',
        title: 'Regla 20-20-20',
        duration: '20 seg',
        reason: 'Rompe el ciclo de enfoque fijo cada 20 minutos',
        clinicalBasis: 'Basada en las guías de la American Optometric Association. Permite que el músculo ciliar alcance su punto de reposo (punto remoto) y reduce la fatiga acumulada.',
      },
    ],
  },
  comfort: {
    label: 'Síndrome de ojo seco digital',
    description: 'Presentas sequedad, sensación arenosa e irritación ocular.',
    clinical: 'La frecuencia de parpadeo disminuye un 60 % durante el uso de pantallas (de 15–20 a 5–7 veces por minuto). Esto reduce la distribución de la película lagrimal, acelera su evaporación y genera inestabilidad del film precorneal. El calor húmedo de las palmas estimula las glándulas de Meibomio, mejorando la capa lipídica de la lágrima.',
    color: 'text-teal-700',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    iconBg: 'bg-teal-100',
    Icon: Droplets,
    exercises: [
      {
        id: 'palming',
        title: 'Palming',
        duration: '3 min',
        reason: 'El calor relaja y estimula la lubricación natural',
        clinicalBasis: 'El calor generado por las palmas (≈36 °C) incrementa la secreción de las glándulas de Meibomio, mejorando la estabilidad de la capa lipídica de la lágrima hasta por 45 min.',
      },
      {
        id: '20-20-20',
        title: 'Regla 20-20-20',
        duration: '20 seg',
        reason: 'Obliga a parpadear y rehidratar la córnea',
        clinicalBasis: 'Al alejar la vista, el estímulo de convergencia disminuye y la frecuencia de parpadeo se normaliza, redistribuyendo la película lagrimal sobre la superficie ocular.',
      },
      {
        id: 'circles',
        title: 'Círculos oculares',
        duration: '4 min',
        reason: 'Activa las glándulas de Meibomio mediante movimiento',
        clinicalBasis: 'Los movimientos de versión estimulan mecánicamente las glándulas de Meibomio ubicadas en el margen palpebral, favoreciendo la secreción lipídica sin necesidad de compresas calientes externas.',
      },
    ],
  },
  pain: {
    label: 'Cefalea tensional digital',
    description: 'Presentas dolores de cabeza frecuentes asociados al uso de pantallas.',
    clinical: 'La tensión sostenida de los músculos extraoculares, el músculo frontal y el trapecio superior genera cefalea de tipo tensional en el 60 % de los trabajadores que usan pantallas más de 4 horas diarias. El umbral de dolor disminuye con la acumulación de metabolitos (lactato, adenosina) en los músculos fatigados. La relajación activa revierte este proceso.',
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    iconBg: 'bg-purple-100',
    Icon: Brain,
    exercises: [
      {
        id: 'palming',
        title: 'Palming',
        duration: '3 min',
        reason: 'Reduce la tensión ocular y de cuello',
        clinicalBasis: 'La oscuridad total elimina el estímulo visual y permite la relajación refleja de los músculos extraoculares, el orbicular y el frontal, reduciendo la tensión miofascial asociada a la cefalea.',
      },
      {
        id: 'circles',
        title: 'Círculos oculares',
        duration: '4 min',
        reason: 'Relaja los músculos extraoculares',
        clinicalBasis: 'Los movimientos circulares lentos actúan como estiramiento excéntrico de los seis músculos extraoculares, disipando la acumulación de metabolitos y aliviando la tensión miofascial periocular.',
      },
      {
        id: 'focus',
        title: 'Enfoque cercano-lejano',
        duration: '5 min',
        reason: 'Descomprime la musculatura ciliar',
        clinicalBasis: 'La relajación intermitente del músculo ciliar interrumpe el ciclo de isquemia tisular → acumulación de lactato → dolor, que es el mecanismo fisiopatológico de la cefalea tensional digital.',
      },
    ],
  },
  fatigue: {
    label: 'Astenopia digital severa',
    description: 'Presentas fatiga visual acumulada con empeoramiento progresivo durante el día.',
    clinical: 'La astenopia digital (Computer Vision Syndrome) afecta al 90 % de usuarios que pasan más de 3 h/día frente a pantallas. La combinación de parpadeo reducido, brillo excesivo, reflejos en pantalla y postura inadecuada sobrecarga el sistema visual. Las pausas activas estructuradas con ejercicios específicos reducen los síntomas en un 68 % según estudios de la AOA.',
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    iconBg: 'bg-orange-100',
    Icon: Zap,
    exercises: [
      {
        id: '20-20-20',
        title: 'Regla 20-20-20',
        duration: '20 seg',
        reason: 'Pausa activa cada 20 min para recuperar',
        clinicalBasis: 'Las microdescansos programados son más efectivos que los descansos prolongados ocasionales. La AOA estima que aplicar esta regla reduce los síntomas de astenopia en un 40 % en la primera semana.',
      },
      {
        id: 'palming',
        title: 'Palming',
        duration: '3 min',
        reason: 'Restablece el nivel de energía ocular',
        clinicalBasis: 'La privación sensorial visual total (oscuridad completa) activa el sistema parasimpático, reduce la carga cognitiva visual y permite la recuperación funcional del córtex visual occipital.',
      },
      {
        id: 'near-far',
        title: 'Simulación cerca/lejos',
        duration: '3 min',
        reason: 'Previene el espasmo de acomodación crónico',
        clinicalBasis: 'El espasmo de acomodación es la principal causa de pseudomiopía progresiva en adultos jóvenes que trabajan en pantallas. Este ejercicio actúa como profilaxis cuando se realiza al inicio de la jornada.',
      },
    ],
  },
};

interface QuestionnaireProps {
  onBack: () => void;
  onStartRoutine?: (exerciseIds: string[]) => void;
}

const Questionnaire = ({ onBack, onStartRoutine }: QuestionnaireProps) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [isComplete, setIsComplete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);

  const { user } = useUser();

  const questions: Question[] = [
    {
      id: 1,
      text: '¿Con qué frecuencia ves borroso al leer texto en pantalla?',
      hint: 'Incluye momentos en que necesitas enfocar varias veces para ver con claridad.',
      category: 'visual',
    },
    {
      id: 2,
      text: '¿Sientes sequedad, arenilla o picazón en los ojos?',
      hint: 'Especialmente tras periodos prolongados frente a la pantalla.',
      category: 'comfort',
    },
    {
      id: 3,
      text: '¿Presentas dolores de cabeza que aparecen o empeoran al usar pantallas?',
      hint: 'Puede ser presión en la frente, sienes o parte posterior de la cabeza.',
      category: 'pain',
    },
    {
      id: 4,
      text: '¿Tienes molestia o ardor ante luces brillantes o el resplandor de pantallas?',
      hint: 'Fotofobia o sensación de que la pantalla "lastima" los ojos.',
      category: 'comfort',
    },
    {
      id: 5,
      text: '¿Te cuesta enfocar cuando cambias la mirada de cerca (pantalla) a lejos (ventana)?',
      hint: 'Tardar más de 2–3 segundos en re-enfocar es un signo relevante.',
      category: 'visual',
    },
    {
      id: 6,
      text: '¿Observas que tus ojos se enrojecen después de usar pantallas?',
      hint: 'Enrojecimiento visible en la esclerótica (parte blanca del ojo).',
      category: 'comfort',
    },
    {
      id: 7,
      text: '¿Sientes los ojos "pesados" o cansados conforme avanza el día de trabajo?',
      hint: 'Fatiga que se acumula progresivamente y puede mejorar con el descanso nocturno.',
      category: 'fatigue',
    },
    {
      id: 8,
      text: '¿Ves doble (dos imágenes superpuestas) de manera temporal?',
      hint: 'Puede ocurrir al final del día o tras lectura prolongada.',
      category: 'visual',
    },
    {
      id: 9,
      text: '¿Notas que parpadeas menos de lo normal o que debes recordarte parpadear?',
      hint: 'Al concentrarse en pantallas la frecuencia de parpadeo puede caer hasta 5 veces/min.',
      category: 'comfort',
    },
    {
      id: 10,
      text: '¿Sientes tensión en los músculos de la cara, ojos o cuello al trabajar en pantallas?',
      hint: 'Tensión que puede acompañar a la cefalea o presentarse de forma aislada.',
      category: 'pain',
    },
  ];

  const options = [
    { value: 0, label: 'Nunca',          desc: 'No me ocurre',                  color: 'bg-green-500'  },
    { value: 1, label: 'Rara vez',       desc: 'Una vez a la semana o menos',   color: 'bg-blue-500'   },
    { value: 2, label: 'A veces',        desc: 'Varios días a la semana',        color: 'bg-yellow-500' },
    { value: 3, label: 'Frecuentemente', desc: 'Casi todos los días',            color: 'bg-orange-500' },
    { value: 4, label: 'Siempre',        desc: 'A diario, de manera intensa',   color: 'bg-red-500'    },
  ];

  // ─── Puntaje general ────────────────────────────────────────────────────────
  const calculateScore = (finalAnswers: Record<number, number>) => {
    const total = Object.values(finalAnswers).reduce((sum, val) => sum + val, 0);
    const max = questions.length * 4;
    return Math.round((total / max) * 100);
  };

  // ─── Síntoma dominante ──────────────────────────────────────────────────────
  const getDominantSymptom = (finalAnswers: Record<number, number>): string => {
    const categoryScores: Record<string, { total: number; count: number }> = {
      visual:  { total: 0, count: 0 },
      comfort: { total: 0, count: 0 },
      pain:    { total: 0, count: 0 },
      fatigue: { total: 0, count: 0 },
    };
    questions.forEach((q) => {
      const val = finalAnswers[q.id] ?? 0;
      categoryScores[q.category].total += val;
      categoryScores[q.category].count += 1;
    });
    let dominant = 'fatigue';
    let maxAvg = -1;
    Object.entries(categoryScores).forEach(([cat, { total, count }]) => {
      const avg = count > 0 ? total / count : 0;
      if (avg > maxAvg) { maxAvg = avg; dominant = cat; }
    });
    return dominant;
  };

  const getScoreMessage = (score: number) => {
    if (score < 25) return { text: 'Fatiga visual leve',         color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200'  };
    if (score < 50) return { text: 'Fatiga visual moderada',     color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' };
    if (score < 75) return { text: 'Fatiga visual considerable', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' };
    return             { text: 'Fatiga visual severa',           color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200'    };
  };

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const handleAnswer = async (value: number) => {
    const newAnswers = { ...answers, [questions[currentQuestion].id]: value };
    setAnswers(newAnswers);

    if (currentQuestion < questions.length - 1) {
      setTimeout(() => setCurrentQuestion(currentQuestion + 1), 250);
    } else {
      setIsSaving(true);
      await saveToDatabase(newAnswers);
      setTimeout(() => setIsComplete(true), 300);
    }
  };

  const saveToDatabase = async (finalAnswers: Record<number, number>) => {
    try {
      const score    = calculateScore(finalAnswers);
      const dominant = getDominantSymptom(finalAnswers);
      await sql`
        INSERT INTO respuestas_cuestionario (user_id, respuestas_json, puntaje_fatiga, sintoma_dominante, created_at)
        VALUES (${user?.id}, ${JSON.stringify(finalAnswers)}, ${score}, ${dominant}, NOW())
      `;
    } catch (error) {
      console.error('Error al guardar respuestas:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Pantalla de resultados ─────────────────────────────────────────────────
  if (isComplete) {
    const score       = calculateScore(answers);
    const scoreMsg    = getScoreMessage(score);
    const dominant    = getDominantSymptom(answers);
    const symptomInfo = SYMPTOM_INFO[dominant];
    const { Icon }    = symptomInfo;
    const exerciseIds = symptomInfo.exercises.map(e => e.id);

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8">

          {/* Encabezado */}
          <div className="text-center mb-6">
            <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-3" />
            <h2 className="text-2xl font-bold text-gray-800">¡Evaluación completada!</h2>
            <p className="text-sm text-gray-500 mt-1">
              Analizamos tus {questions.length} respuestas para personalizar tu plan
            </p>
          </div>

          {/* Puntaje general */}
          <div className={`${scoreMsg.bg} border ${scoreMsg.border} rounded-xl p-4 mb-4 flex items-center justify-between`}>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-0.5">
                Nivel de fatiga visual
              </p>
              <p className={`text-lg font-bold ${scoreMsg.color}`}>{scoreMsg.text}</p>
            </div>
            <p className={`text-4xl font-extrabold ${scoreMsg.color}`}>{score}%</p>
          </div>

          {/* Síntoma dominante */}
          <div className={`${symptomInfo.bg} border ${symptomInfo.border} rounded-xl p-5 mb-4`}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg ${symptomInfo.iconBg}`}>
                <Icon className={`w-5 h-5 ${symptomInfo.color}`} />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">
                  Síntoma dominante
                </p>
                <p className={`font-bold ${symptomInfo.color}`}>{symptomInfo.label}</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-3">{symptomInfo.description}</p>
            <div className="bg-white/70 rounded-lg p-3 text-xs text-gray-600 leading-relaxed border border-white">
              <span className="font-semibold text-gray-700">¿Por qué ocurre? </span>
              {symptomInfo.clinical}
            </div>
          </div>

          {/* Ejercicios recomendados */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 mb-5">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
              <span className="text-indigo-500">★</span>
              Rutina personalizada — 3 ejercicios
            </h3>
            <div className="space-y-2">
              {symptomInfo.exercises.map((ex, i) => (
                <div key={ex.id} className="bg-white rounded-xl border border-indigo-100 shadow-sm overflow-hidden">
                  {/* Cabecera del ejercicio */}
                  <div className="flex items-center gap-3 p-3">
                    <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm leading-tight">{ex.title}</p>
                      <p className="text-xs text-gray-400">{ex.duration} · {ex.reason}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Botón info clínica */}
                      <button
                        onClick={() => setExpandedExercise(expandedExercise === ex.id ? null : ex.id)}
                        className="text-xs text-indigo-500 hover:text-indigo-700 underline underline-offset-2"
                      >
                        {expandedExercise === ex.id ? 'Menos' : '¿Por qué?'}
                      </button>
                      {/* Botón ejercicio individual */}
                      {onStartRoutine && (
                        <button
                          onClick={() => onStartRoutine([ex.id])}
                          className="flex items-center gap-1 text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-2 py-1 rounded-lg transition font-semibold"
                        >
                          <Play className="w-3 h-3" /> Hacer
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Base clínica expandible */}
                  {expandedExercise === ex.id && (
                    <div className="px-4 pb-3 pt-0">
                      <p className="text-xs text-gray-600 bg-indigo-50 rounded-lg p-2.5 leading-relaxed border border-indigo-100">
                        {ex.clinicalBasis}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex flex-col gap-3">
            {onStartRoutine && (
              <button
                onClick={() => onStartRoutine(exerciseIds)}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition shadow-md"
              >
                <ListOrdered className="w-5 h-5" />
                Empezar rutina completa (3 ejercicios seguidos)
              </button>
            )}
            <button
              onClick={onBack}
              className="w-full py-3 rounded-xl border-2 border-indigo-200 text-indigo-600 font-semibold hover:bg-indigo-50 transition"
            >
              Volver al Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Cuestionario ───────────────────────────────────────────────────────────
  const currentQ = questions[currentQuestion];
  const categoryColors: Record<string, string> = {
    visual: 'bg-blue-500', comfort: 'bg-teal-500', pain: 'bg-purple-500', fatigue: 'bg-orange-500',
  };
  const categoryNames: Record<string, string> = {
    visual: 'Enfoque visual', comfort: 'Confort ocular', pain: 'Dolor', fatigue: 'Fatiga',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto pt-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-700 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" /> Volver
        </button>

        {/* Barra de progreso */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span className="font-medium">Pregunta {currentQuestion + 1} / {questions.length}</span>
            <span className={`px-2 py-0.5 rounded-full text-white text-xs font-semibold ${categoryColors[currentQ.category]}`}>
              {categoryNames[currentQ.category]}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-2 text-center">
            {currentQ.text}
          </h2>
          <p className="text-xs text-gray-400 text-center mb-7 leading-relaxed">
            💡 {currentQ.hint}
          </p>

          <div className="space-y-2.5">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => handleAnswer(option.value)}
                disabled={isSaving}
                className={`w-full p-4 rounded-xl border-2 transition-all duration-150 flex items-center gap-4 text-left
                  ${answers[currentQ.id] === option.value
                    ? 'border-indigo-600 bg-indigo-50 shadow-sm'
                    : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                  } ${isSaving ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.99]'}`}
              >
                <div className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${option.color}`} />
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{option.label}</p>
                  <p className="text-xs text-gray-400">{option.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {isSaving && (
            <p className="text-center text-gray-500 text-sm mt-5">Guardando evaluación…</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Questionnaire;
