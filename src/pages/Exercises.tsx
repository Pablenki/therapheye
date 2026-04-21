import { useState, useRef } from 'react';
import { Eye, Focus, Maximize2, RotateCw, ZoomIn, ChevronLeft, ChevronRight, Clock, Play, Lightbulb } from 'lucide-react';
import { useLanguage } from '../i18n';

interface Exercise {
  id: string;
  title: string;
  description: string;
  duration: string;
  icon: React.ElementType;
  gradient: string;
  accent: string;
  tips: string;
}

const Exercises = ({ onStartExercise }: { onBack: () => void; onStartExercise: (id: string) => void }) => {
  const { t } = useLanguage();
  const [current, setCurrent] = useState(0);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const exercises: Exercise[] = [
    {
      id: 'palming',
      title: t('exercises', 'palming'),
      description: t('exercises', 'palmingDesc'),
      duration: '1–5 min',
      icon: Eye,
      gradient: 'from-blue-500 to-indigo-600',
      accent: 'bg-blue-500',
      tips: 'Cúbrete los ojos con las palmas de las manos sin presionar. El calor natural relaja los músculos oculares.',
    },
    {
      id: 'focus',
      title: t('exercises', 'focus'),
      description: t('exercises', 'focusDesc'),
      duration: '1–5 min',
      icon: Focus,
      gradient: 'from-emerald-500 to-teal-600',
      accent: 'bg-emerald-500',
      tips: 'Alterna la mirada entre un objeto cercano (20 cm) y uno lejano (6+ m). Ideal para combatir el cansancio digital.',
    },
    {
      id: '20-20-20',
      title: t('exercises', 'rule202020'),
      description: t('exercises', 'rule202020Desc'),
      duration: '20 seg',
      icon: Maximize2,
      gradient: 'from-violet-500 to-purple-600',
      accent: 'bg-violet-500',
      tips: 'Cada 20 minutos, mira a 6 metros de distancia durante 20 segundos. Reduce la fatiga por pantallas.',
    },
    {
      id: 'circles',
      title: t('exercises', 'circles'),
      description: t('exercises', 'circlesDesc'),
      duration: '1–5 min',
      icon: RotateCw,
      gradient: 'from-orange-500 to-amber-500',
      accent: 'bg-orange-500',
      tips: 'Mueve los ojos lentamente en círculos, primero en sentido horario y luego antihorario. Mantén la cabeza fija.',
    },
    {
      id: 'near-far',
      title: t('exercises', 'nearFar'),
      description: t('exercises', 'nearFarDesc'),
      duration: '1–5 min',
      icon: ZoomIn,
      gradient: 'from-teal-500 to-cyan-600',
      accent: 'bg-teal-500',
      tips: 'Extiende el pulgar y enfócalo. Luego enfoca algo lejano. Repite 10 veces. Mejora la acomodación visual.',
    },
  ];

  const total = exercises.length;
  const prev  = () => setCurrent(i => (i - 1 + total) % total);
  const next  = () => setCurrent(i => (i + 1) % total);

  // Swipe / drag support
  const onPointerDown = (e: React.PointerEvent) => setDragStart(e.clientX);
  const onPointerUp   = (e: React.PointerEvent) => {
    if (dragStart === null) return;
    const delta = e.clientX - dragStart;
    if (Math.abs(delta) > 50) delta < 0 ? next() : prev();
    setDragStart(null);
  };

  const ex = exercises[current];
  const Icon = ex.icon;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex-shrink-0">
        <h1 className="text-xl font-bold text-gray-800">Ejercicios visuales</h1>
        <p className="text-xs text-gray-400 mt-0.5">Selecciona y realiza ejercicios para cuidar tu vista</p>
      </div>

      {/* ── Carousel area ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-6">

        {/* Counter */}
        <p className="text-xs font-semibold text-gray-400 tracking-widest uppercase">
          {current + 1} / {total}
        </p>

        {/* Card + arrows row */}
        <div className="w-full max-w-2xl flex items-center gap-3">

          {/* Prev arrow */}
          <button
            onClick={prev}
            className="flex-shrink-0 w-10 h-10 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center text-gray-500 hover:text-indigo-600 hover:border-indigo-300 transition"
          >
            <ChevronLeft className="w-5 h-5"/>
          </button>

          {/* Card */}
          <div
            ref={trackRef}
            className="flex-1 select-none"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            style={{ touchAction: 'pan-y' }}
          >
            <div className={`bg-gradient-to-br ${ex.gradient} rounded-3xl p-6 shadow-xl text-white relative overflow-hidden`}>
              {/* Decorative blobs */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full"/>
              <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-white/10 rounded-full"/>

              {/* Top row: icon + duration */}
              <div className="flex items-start justify-between mb-5 relative">
                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <Icon className="w-8 h-8 text-white"/>
                </div>
                <div className="flex items-center gap-1.5 bg-white/20 rounded-xl px-3 py-1.5 backdrop-blur-sm">
                  <Clock className="w-3.5 h-3.5"/>
                  <span className="text-sm font-semibold">{ex.duration}</span>
                </div>
              </div>

              {/* Title + description */}
              <h2 className="text-2xl font-black mb-2 relative">{ex.title}</h2>
              <p className="text-white/85 text-sm leading-relaxed mb-5 relative">{ex.description}</p>

              {/* Tip box */}
              <div className="bg-white/15 rounded-xl p-3 flex gap-2.5 mb-5 relative">
                <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5 text-yellow-200"/>
                <p className="text-xs text-white/90 leading-relaxed">{ex.tips}</p>
              </div>

              {/* CTA */}
              <button
                onClick={() => onStartExercise(ex.id)}
                className="w-full bg-white text-gray-800 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:bg-white/90 transition shadow-lg relative"
              >
                <Play className="w-4 h-4 text-indigo-600" style={{fill:'currentColor'}}/>
                Iniciar ejercicio
              </button>
            </div>
          </div>

          {/* Next arrow */}
          <button
            onClick={next}
            className="flex-shrink-0 w-10 h-10 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center text-gray-500 hover:text-indigo-600 hover:border-indigo-300 transition"
          >
            <ChevronRight className="w-5 h-5"/>
          </button>
        </div>

        {/* Dot indicators */}
        <div className="flex items-center gap-2">
          {exercises.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`rounded-full transition-all duration-300 ${
                i === current ? 'w-6 h-2.5 bg-indigo-600' : 'w-2.5 h-2.5 bg-gray-300 hover:bg-gray-400'
              }`}
            />
          ))}
        </div>

        {/* Mini exercise selector — quick jump */}
        <div className="w-full max-w-2xl grid grid-cols-5 gap-2">
          {exercises.map((e, i) => {
            const Ic = e.icon;
            return (
              <button
                key={e.id}
                onClick={() => setCurrent(i)}
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border transition-all text-center ${
                  i === current
                    ? 'border-indigo-400 bg-indigo-50 text-indigo-700 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                }`}
              >
                <Ic className="w-4 h-4"/>
                <span className="text-[10px] font-medium leading-tight line-clamp-2">{e.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tips section ── */}
      <div className="px-6 pb-8 max-w-2xl mx-auto w-full">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500"/> Consejos generales
          </h3>
          <ul className="space-y-2 text-xs text-gray-600">
            <li className="flex items-start gap-2"><span className="text-indigo-500 font-bold mt-0.5">•</span><span>{t('exercises', 'tip1')}</span></li>
            <li className="flex items-start gap-2"><span className="text-indigo-500 font-bold mt-0.5">•</span><span>{t('exercises', 'tip2')}</span></li>
            <li className="flex items-start gap-2"><span className="text-indigo-500 font-bold mt-0.5">•</span><span>{t('exercises', 'tip3')}</span></li>
            <li className="flex items-start gap-2"><span className="text-indigo-500 font-bold mt-0.5">•</span><span>{t('exercises', 'tip4')}</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Exercises;
