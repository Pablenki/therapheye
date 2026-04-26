// =========================================
// ONBOARDING — Therapheye
// Se muestra a usuarios nuevos (primera vez)
// 4 pantallas animadas con slide
// =========================================

import { useState } from 'react';
import { ChevronRight, CheckCircle2 } from 'lucide-react';

const ONBOARDING_KEY = 'therapheye_onboarding_done';

interface Props {
  onDone: () => void;
}

const SLIDES = [
  {
    gradient: 'from-indigo-600 to-violet-700',
    emoji: '👁',
    titulo: 'Bienvenido a Therapheye',
    subtitulo: 'Tu asistente de salud visual personal',
    desc: 'Monitorea, entrena y mejora tu salud ocular con tecnología de inteligencia artificial — todo desde tu navegador.',
    tip: null,
  },
  {
    gradient: 'from-emerald-600 to-teal-700',
    emoji: '🏃',
    titulo: 'Ejercicios terapéuticos',
    subtitulo: 'Basados en evidencia clínica',
    desc: 'Rutinas de 2-5 minutos diseñadas para reducir fatiga digital, mejorar acomodación y entrenar movimientos oculares.',
    tip: '💡 Empieza con el Cuestionario para que la IA arme tu rutina personalizada',
  },
  {
    gradient: 'from-violet-600 to-indigo-700',
    emoji: '🤖',
    titulo: 'IA que te cuida',
    subtitulo: 'Análisis inteligente en tiempo real',
    desc: 'Claude AI analiza tus síntomas, predice fatiga, genera rutinas personalizadas y revisa capturas de tu ojo con visión computacional.',
    tip: '💡 Prueba el Chat Visual para orientación inmediata sobre cualquier molestia',
  },
  {
    gradient: 'from-amber-600 to-orange-600',
    emoji: '📊',
    titulo: 'Seguimiento completo',
    subtitulo: 'Todo tu historial en un lugar',
    desc: 'Gráficas de progreso, heatmap semanal de actividad, comparativa mes a mes y reportes PDF para tu oftalmólogo.',
    tip: '💡 Usa el Pomodoro Visual para recordar hacer pausas mientras trabajas',
  },
];

export function isOnboardingDone(): boolean {
  try { return localStorage.getItem(ONBOARDING_KEY) === '1'; } catch { return true; }
}

export default function Onboarding({ onDone }: Props) {
  const [slide, setSlide] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd');

  const goTo = (next: number, direction: 'fwd' | 'back' = 'fwd') => {
    if (animating) return;
    setDir(direction);
    setAnimating(true);
    setTimeout(() => {
      setSlide(next);
      setAnimating(false);
    }, 280);
  };

  const next = () => {
    if (slide < SLIDES.length - 1) goTo(slide + 1, 'fwd');
    else finish();
  };

  const prev = () => {
    if (slide > 0) goTo(slide - 1, 'back');
  };

  const finish = () => {
    try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch {}
    onDone();
  };

  const s = SLIDES[slide];

  const slideClass = animating
    ? dir === 'fwd' ? 'opacity-0 translate-x-6' : 'opacity-0 -translate-x-6'
    : 'opacity-100 translate-x-0';

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden">

        {/* Slide content */}
        <div className={`bg-gradient-to-br ${s.gradient} p-8 flex flex-col items-center text-center transition-all duration-280 ${slideClass}`}>
          <div className="w-20 h-20 rounded-3xl bg-white/20 flex items-center justify-center mb-5 shadow-lg">
            <span className="text-4xl">{s.emoji}</span>
          </div>
          <h2 className="text-2xl font-black text-white leading-tight mb-1">{s.titulo}</h2>
          <p className="text-white/80 text-sm font-medium mb-3">{s.subtitulo}</p>
          <p className="text-white/70 text-sm leading-relaxed">{s.desc}</p>
        </div>

        <div className={`px-6 py-5 transition-all duration-280 ${slideClass}`}>
          {s.tip && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5 mb-4 text-xs text-indigo-700 leading-relaxed">
              {s.tip}
            </div>
          )}

          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i, i > slide ? 'fwd' : 'back')}
                className={`rounded-full transition-all duration-300 ${
                  i === slide ? 'w-6 h-2 bg-indigo-600' : 'w-2 h-2 bg-gray-200'
                }`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {slide > 0 && (
              <button
                onClick={prev}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
              >
                Atrás
              </button>
            )}
            <button
              onClick={next}
              className={`py-3 rounded-xl text-sm font-bold text-white transition flex items-center justify-center gap-2 ${
                slide > 0 ? 'flex-1' : 'w-full'
              } bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-90`}
            >
              {slide < SLIDES.length - 1 ? (
                <>Siguiente <ChevronRight className="w-4 h-4" /></>
              ) : (
                <><CheckCircle2 className="w-4 h-4" /> ¡Empezar!</>
              )}
            </button>
          </div>

          {slide < SLIDES.length - 1 && (
            <button
              onClick={finish}
              className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition mt-3 py-1"
            >
              Saltar introducción
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
