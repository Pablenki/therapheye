import { useState } from 'react';
import { ArrowLeft, CheckCircle, Eye, Droplets, Brain, Zap, Play, ListOrdered } from 'lucide-react';
import { sql, localISOString } from '../neonCliente';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../i18n';

interface Question {
  id: number;
  text: string;
  hint: string;
  category: 'visual' | 'comfort' | 'pain' | 'fatigue';
}

// ─── Mapa de síntomas enriquecido ──────────────────────────────────────────────
const SYMPTOM_INFO: Record<string, {
  label: { es: string; en: string };
  description: { es: string; en: string };
  clinical: { es: string; en: string };
  color: string;
  bg: string;
  border: string;
  iconBg: string;
  Icon: typeof Eye;
  exercises: Array<{ id: string; title: { es: string; en: string }; duration: string; reason: { es: string; en: string }; clinicalBasis: { es: string; en: string } }>;
}> = {
  visual: {
    label: { es: 'Disfunción de acomodación', en: 'Accommodation dysfunction' },
    description: { es: 'Presentas dificultad para enfocar y episodios de visión borrosa o doble.', en: 'You have difficulty focusing and episodes of blurry or double vision.' },
    clinical: { es: 'El trabajo prolongado en pantalla obliga al músculo ciliar a mantenerse en estado de contracción sostenida (espasmo de acomodación). Esto reduce la amplitud de acomodación y puede provocar miopía pseudoprogresiva. La alternancia entre distancias cercanas y lejanas es el tratamiento de elección para restaurar la flexibilidad del cristalino.', en: 'Prolonged screen work forces the ciliary muscle to maintain sustained contraction (accommodation spasm). This reduces accommodation amplitude and can cause pseudo-progressive myopia. Alternating between near and far distances is the treatment of choice to restore crystalline lens flexibility.' },
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    iconBg: 'bg-blue-100',
    Icon: Eye,
    exercises: [
      {
        id: 'focus',
        title: { es: 'Enfoque cercano-lejano', en: 'Near-Far Focus' },
        duration: '5 min',
        reason: { es: 'Entrena y relaja los músculos de acomodación', en: 'Trains and relaxes accommodation muscles' },
        clinicalBasis: { es: 'Ejercita activamente el músculo ciliar en ambas direcciones, previniendo el espasmo y mejorando la amplitud de acomodación en 2–4 semanas de práctica regular.', en: 'Actively exercises the ciliary muscle in both directions, preventing spasm and improving accommodation amplitude within 2-4 weeks of regular practice.' },
      },
      {
        id: 'near-far',
        title: { es: 'Simulación cerca/lejos', en: 'Near/Far Simulation' },
        duration: '3 min',
        reason: { es: 'Ejercita la flexibilidad del cristalino', en: 'Exercises crystalline lens flexibility' },
        clinicalBasis: { es: 'Estimula la respuesta vergencial y acomodativa sincrónica mediante un estímulo visual controlado, sin requerir movimiento físico del paciente.', en: 'Stimulates synchronized vergence and accommodation response through controlled visual stimulus, without requiring physical patient movement.' },
      },
      {
        id: '20-20-20',
        title: { es: 'Regla 20-20-20', en: '20-20-20 Rule' },
        duration: '20 seg',
        reason: { es: 'Rompe el ciclo de enfoque fijo cada 20 minutos', en: 'Breaks the fixed focus cycle every 20 minutes' },
        clinicalBasis: { es: 'Basada en las guías de la American Optometric Association. Permite que el músculo ciliar alcance su punto de reposo (punto remoto) y reduce la fatiga acumulada.', en: 'Based on American Optometric Association guidelines. Allows the ciliary muscle to reach its resting point (far point) and reduces accumulated fatigue.' },
      },
    ],
  },
  comfort: {
    label: { es: 'Síndrome de ojo seco digital', en: 'Digital dry eye syndrome' },
    description: { es: 'Presentas sequedad, sensación arenosa e irritación ocular.', en: 'You experience dryness, grittiness, and eye irritation.' },
    clinical: { es: 'La frecuencia de parpadeo disminuye un 60 % durante el uso de pantallas (de 15–20 a 5–7 veces por minuto). Esto reduce la distribución de la película lagrimal, acelera su evaporación y genera inestabilidad del film precorneal. El calor húmedo de las palmas estimula las glándulas de Meibomio, mejorando la capa lipídica de la lágrima.', en: 'Blink frequency decreases by 60% during screen use (from 15-20 to 5-7 times per minute). This reduces tear film distribution, accelerates evaporation, and causes precorneal film instability. The warm, moist heat from the palms stimulates Meibomian glands, improving the lipid layer of tears.' },
    color: 'text-teal-700',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    iconBg: 'bg-teal-100',
    Icon: Droplets,
    exercises: [
      {
        id: 'palming',
        title: { es: 'Palming', en: 'Palming' },
        duration: '3 min',
        reason: { es: 'El calor relaja y estimula la lubricación natural', en: 'Heat relaxes and stimulates natural lubrication' },
        clinicalBasis: { es: 'El calor generado por las palmas (≈36 °C) incrementa la secreción de las glándulas de Meibomio, mejorando la estabilidad de la capa lipídica de la lágrima hasta por 45 min.', en: 'The heat generated by the palms (≈36°C) increases Meibomian gland secretion, improving tear lipid layer stability for up to 45 minutes.' },
      },
      {
        id: '20-20-20',
        title: { es: 'Regla 20-20-20', en: '20-20-20 Rule' },
        duration: '20 seg',
        reason: { es: 'Obliga a parpadear y rehidratar la córnea', en: 'Forces blinking and rehydrates cornea' },
        clinicalBasis: { es: 'Al alejar la vista, el estímulo de convergencia disminuye y la frecuencia de parpadeo se normaliza, redistribuyendo la película lagrimal sobre la superficie ocular.', en: 'As gaze is redirected away, convergence stimulus decreases and blink frequency normalizes, redistributing tear film over the ocular surface.' },
      },
      {
        id: 'circles',
        title: { es: 'Círculos oculares', en: 'Eye Circles' },
        duration: '4 min',
        reason: { es: 'Activa las glándulas de Meibomio mediante movimiento', en: 'Activates Meibomian glands through movement' },
        clinicalBasis: { es: 'Los movimientos de versión estimulan mecánicamente las glándulas de Meibomio ubicadas en el margen palpebral, favoreciendo la secreción lipídica sin necesidad de compresas calientes externas.', en: 'Versional movements mechanically stimulate Meibomian glands located at the eyelid margin, promoting lipid secretion without external warm compress need.' },
      },
    ],
  },
  pain: {
    label: { es: 'Cefalea tensional digital', en: 'Digital tension headache' },
    description: { es: 'Presentas dolores de cabeza frecuentes asociados al uso de pantallas.', en: 'You experience frequent headaches associated with screen use.' },
    clinical: { es: 'La tensión sostenida de los músculos extraoculares, el músculo frontal y el trapecio superior genera cefalea de tipo tensional en el 60 % de los trabajadores que usan pantallas más de 4 horas diarias. El umbral de dolor disminuye con la acumulación de metabolitos (lactato, adenosina) en los músculos fatigados. La relajación activa revierte este proceso.', en: 'Sustained tension in extraocular muscles, frontal muscle, and upper trapezius causes tension-type headache in 60% of workers using screens over 4 hours daily. Pain threshold decreases with metabolite accumulation (lactate, adenosine) in fatigued muscles. Active relaxation reverses this process.' },
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    iconBg: 'bg-purple-100',
    Icon: Brain,
    exercises: [
      {
        id: 'palming',
        title: { es: 'Palming', en: 'Palming' },
        duration: '3 min',
        reason: { es: 'Reduce la tensión ocular y de cuello', en: 'Reduces eye and neck tension' },
        clinicalBasis: { es: 'La oscuridad total elimina el estímulo visual y permite la relajación refleja de los músculos extraoculares, el orbicular y el frontal, reduciendo la tensión miofascial asociada a la cefalea.', en: 'Total darkness eliminates visual stimulus and allows reflex relaxation of extraocular, orbicular, and frontal muscles, reducing headache-associated myofascial tension.' },
      },
      {
        id: 'circles',
        title: { es: 'Círculos oculares', en: 'Eye Circles' },
        duration: '4 min',
        reason: { es: 'Relaja los músculos extraoculares', en: 'Relaxes extraocular muscles' },
        clinicalBasis: { es: 'Los movimientos circulares lentos actúan como estiramiento excéntrico de los seis músculos extraoculares, disipando la acumulación de metabolitos y aliviando la tensión miofascial periocular.', en: 'Slow circular movements act as eccentric stretch of six extraocular muscles, dissipating metabolite accumulation and relieving periocular myofascial tension.' },
      },
      {
        id: 'focus',
        title: { es: 'Enfoque cercano-lejano', en: 'Near-Far Focus' },
        duration: '5 min',
        reason: { es: 'Descomprime la musculatura ciliar', en: 'Decompresses ciliary muscles' },
        clinicalBasis: { es: 'La relajación intermitente del músculo ciliar interrumpe el ciclo de isquemia tisular → acumulación de lactato → dolor, que es el mecanismo fisiopatológico de la cefalea tensional digital.', en: 'Intermittent ciliary muscle relaxation breaks the tissue ischemia → lactate accumulation → pain cycle, which is the pathophysiologic mechanism of digital tension headache.' },
      },
    ],
  },
  fatigue: {
    label: { es: 'Astenopia digital severa', en: 'Severe digital asthenopia' },
    description: { es: 'Presentas fatiga visual acumulada con empeoramiento progresivo durante el día.', en: 'You experience accumulated visual fatigue with progressive worsening during the day.' },
    clinical: { es: 'La astenopia digital (Computer Vision Syndrome) afecta al 90 % de usuarios que pasan más de 3 h/día frente a pantallas. La combinación de parpadeo reducido, brillo excesivo, reflejos en pantalla y postura inadecuada sobrecarga el sistema visual. Las pausas activas estructuradas con ejercicios específicos reducen los síntomas en un 68 % según estudios de la AOA.', en: 'Digital asthenopia (Computer Vision Syndrome) affects 90% of users spending over 3h/day on screens. The combination of reduced blinking, excessive brightness, screen glare, and poor posture overloads the visual system. Structured active breaks with specific exercises reduce symptoms by 68% according to AOA studies.' },
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    iconBg: 'bg-orange-100',
    Icon: Zap,
    exercises: [
      {
        id: '20-20-20',
        title: { es: 'Regla 20-20-20', en: '20-20-20 Rule' },
        duration: '20 seg',
        reason: { es: 'Pausa activa cada 20 min para recuperar', en: 'Active break every 20 min to recover' },
        clinicalBasis: { es: 'Las microdescansos programados son más efectivos que los descansos prolongados ocasionales. La AOA estima que aplicar esta regla reduce los síntomas de astenopia en un 40 % en la primera semana.', en: 'Programmed microbreaks are more effective than occasional prolonged breaks. AOA estimates that applying this rule reduces asthenopia symptoms by 40% in the first week.' },
      },
      {
        id: 'palming',
        title: { es: 'Palming', en: 'Palming' },
        duration: '3 min',
        reason: { es: 'Restablece el nivel de energía ocular', en: 'Restores eye energy levels' },
        clinicalBasis: { es: 'La privación sensorial visual total (oscuridad completa) activa el sistema parasimpático, reduce la carga cognitiva visual y permite la recuperación funcional del córtex visual occipital.', en: 'Total visual sensory deprivation (complete darkness) activates the parasympathetic system, reduces visual cognitive load, and enables functional recovery of the occipital visual cortex.' },
      },
      {
        id: 'near-far',
        title: { es: 'Simulación cerca/lejos', en: 'Near/Far Simulation' },
        duration: '3 min',
        reason: { es: 'Previene el espasmo de acomodación crónico', en: 'Prevents chronic accommodation spasm' },
        clinicalBasis: { es: 'El espasmo de acomodación es la principal causa de pseudomiopía progresiva en adultos jóvenes que trabajan en pantallas. Este ejercicio actúa como profilaxis cuando se realiza al inicio de la jornada.', en: 'Accommodation spasm is the main cause of progressive pseudo-myopia in young adults working on screens. This exercise acts as prophylaxis when performed at the start of the workday.' },
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
  const { t, lang } = useLanguage();

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
    { value: 0, label: 'never',          descKey: 'neverDesc',          color: 'bg-green-500'  },
    { value: 1, label: 'rarely',         descKey: 'rarelyDesc',         color: 'bg-blue-500'   },
    { value: 2, label: 'sometimes',      descKey: 'sometimesDesc',       color: 'bg-yellow-500' },
    { value: 3, label: 'frequently',     descKey: 'frequentlyDesc',     color: 'bg-orange-500' },
    { value: 4, label: 'always',         descKey: 'alwaysDesc',         color: 'bg-red-500'    },
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
    if (score < 25) return { text: t('questionnaire', 'fatigueMild'),         color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200'  };
    if (score < 50) return { text: t('questionnaire', 'fatigueModerate'),     color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' };
    if (score < 75) return { text: t('questionnaire', 'fatigueConsiderable'), color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' };
    return             { text: t('questionnaire', 'fatigueSevere'),           color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200'    };
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
        VALUES (${user?.id}, ${JSON.stringify(finalAnswers)}, ${score}, ${dominant}, ${localISOString()})
      `;
      // Marcar cuestionario del día para progreso del sidebar
      try {
        const today = new Date().toISOString().slice(0, 10);
        localStorage.setItem(`therapheye_questionnaire_${today}`, '1');
      } catch {}
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
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8">

          {/* Encabezado */}
          <div className="text-center mb-6">
            <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-3" />
            <h2 className="text-2xl font-bold text-gray-800">{t('questionnaire', 'evalComplete')}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {t('questionnaire', 'analyzeMsg')} {questions.length} {t('questionnaire', 'analyzeMsgSuffix')}
            </p>
          </div>

          {/* Puntaje general */}
          <div className={`${scoreMsg.bg} border ${scoreMsg.border} rounded-xl p-4 mb-4 flex items-center justify-between`}>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-0.5">
                {t('questionnaire', 'fatigueLevel')}
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
                  {t('questionnaire', 'dominantSymptom')}
                </p>
                <p className={`font-bold ${symptomInfo.color}`}>{symptomInfo.label[lang]}</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-3">{symptomInfo.description[lang]}</p>
            <div className="bg-white/70 rounded-lg p-3 text-xs text-gray-600 leading-relaxed border border-white">
              <span className="font-semibold text-gray-700">{t('questionnaire', 'whyHappens')} </span>
              {symptomInfo.clinical[lang]}
            </div>
          </div>

          {/* Ejercicios recomendados */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 mb-5">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
              <span className="text-indigo-500">★</span>
              {t('questionnaire', 'personalRoutine')}
            </h3>
            <div className="space-y-2">
              {symptomInfo.exercises.map((ex, i) => (
                <div key={ex.id} className="bg-white rounded-xl border border-indigo-100 shadow-sm overflow-hidden">
                  {/* Cabecera del ejercicio */}
                  <div className="flex items-start gap-3 p-3">
                    <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm leading-tight">{ex.title[lang]}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{ex.duration} · {ex.reason[lang]}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {/* Botón info clínica */}
                        <button
                          onClick={() => setExpandedExercise(expandedExercise === ex.id ? null : ex.id)}
                          className="text-xs text-indigo-500 hover:text-indigo-700 underline underline-offset-2"
                        >
                          {expandedExercise === ex.id ? t('questionnaire', 'lessBtn') : t('questionnaire', 'whyBtn')}
                        </button>
                        {/* Botón ejercicio individual */}
                        {onStartRoutine && (
                          <button
                            onClick={() => onStartRoutine([ex.id])}
                            className="flex items-center gap-1 text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-2 py-1 rounded-lg transition font-semibold"
                          >
                            <Play className="w-3 h-3" /> {t('questionnaire', 'doBtn')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Base clínica expandible */}
                  {expandedExercise === ex.id && (
                    <div className="px-4 pb-3 pt-0">
                      <p className="text-xs text-gray-600 bg-indigo-50 rounded-lg p-2.5 leading-relaxed border border-indigo-100">
                        {ex.clinicalBasis[lang]}
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
                {t('questionnaire', 'startFullRoutine')}
              </button>
            )}
            <button
              onClick={onBack}
              className="w-full py-3 rounded-xl border-2 border-indigo-200 text-indigo-600 font-semibold hover:bg-indigo-50 transition"
            >
              {t('common', 'backToDashboard')}
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
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-2xl mx-auto pt-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-700 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" /> {t('common', 'back')}
        </button>

        {/* Barra de progreso */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span className="font-medium">{t('questionnaire', 'questionOf')} {currentQuestion + 1} {t('questionnaire', 'of')} {questions.length}</span>
            <span className={`px-2 py-0.5 rounded-full text-white text-xs font-semibold ${categoryColors[currentQ.category]}`}>
              {lang === 'en' ? t('questionnaire', `cat${currentQ.category.charAt(0).toUpperCase() + currentQ.category.slice(1)}`) : categoryNames[currentQ.category]}
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
            {t('questionnaire', `q${currentQ.id}`)}
          </h2>
          <p className="text-xs text-gray-400 text-center mb-7 leading-relaxed">
            💡 {t('questionnaire', `q${currentQ.id}hint`)}
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
                  <p className="font-semibold text-gray-800 text-sm">{t('questionnaire', option.label)}</p>
                  <p className="text-xs text-gray-400">{t('questionnaire', option.descKey)}</p>
                </div>
              </button>
            ))}
          </div>

          {isSaving && (
            <p className="text-center text-gray-500 text-sm mt-5">{t('questionnaire', 'saving')}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Questionnaire;
