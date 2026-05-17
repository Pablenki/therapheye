// =========================================
// ONBOARDING — Therapheye
// Se muestra a usuarios nuevos (primera vez)
// 4 pantallas animadas con slide
// =========================================

import { useState } from 'react';
import { ChevronRight, CheckCircle2 } from 'lucide-react';
import { useSwipe } from '../hooks/useSwipe';

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

  const swipe = useSwipe(
    () => { if (slide < SLIDES.length - 1) goTo(slide + 1, 'fwd'); else finish(); },
    () => { if (slide > 0) goTo(slide - 1, 'back'); },
  );

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
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden" {...swipe} style={{ touchAction: 'pan-y' }}>

        {/* Slide content — altura fija para que el botón "Siguiente" no se mueva */}
        <div className={`bg-gradient-to-br ${s.gradient} px-8 pt-8 pb-6 flex flex-col items-center text-center min-h-[230px] justify-center transition-all duration-280 ${slideClass}`}>
          <div className="w-20 h-20 rounded-3xl bg-white/20 flex items-center justify-center mb-4 shadow-lg flex-shrink-0">
            <span className="text-4xl">{s.emoji}</span>
          </div>
          <h2 className="text-xl font-black text-white leading-tight mb-1">{s.titulo}</h2>
          <p className="text-white/80 text-sm font-medium mb-2">{s.subtitulo}</p>
          <p className="text-white/70 text-xs leading-relaxed line-clamp-3">{s.desc}</p>
        </div>

        {/* Sección inferior con altura siempre fija */}
        <div className={`px-6 pt-4 pb-5 transition-all duration-280 ${slideClass}`}>
          {/* Tip — siempre ocupa espacio (invisible cuando no hay tip) */}
          <div
            className={`rounded-xl px-3 py-2.5 mb-4 text-xs leading-relaxed transition-opacity duration-200 ${
              s.tip
                ? 'bg-indigo-50 border border-indigo-100 text-indigo-700 opacity-100'
                : 'opacity-0 pointer-events-none'
            }`}
            style={{ minHeight: '48px' }}
          >
            {s.tip ?? '\u00A0'}
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-4">
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
            {/* Botón atrás — siempre ocupa espacio para mantener ancho del botón siguiente */}
            <button
              onClick={prev}
              className={`flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition ${
                slide > 0 ? 'visible' : 'invisible pointer-events-none'
              }`}
            >
              Atrás
            </button>
            <button
              onClick={next}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-90"
            >
              {slide < SLIDES.length - 1 ? (
                <>Siguiente <ChevronRight className="w-4 h-4" /></>
              ) : (
                <><CheckCircle2 className="w-4 h-4" /> ¡Empezar!</>
              )}
            </button>
          </div>

          {/* Saltar — visible en todas las slides excepto la última */}
          <button
            onClick={finish}
            className={`w-full text-center text-sm text-gray-500 hover:text-gray-800 font-medium transition mt-3 py-1.5 rounded-xl hover:bg-gray-50 ${
              slide < SLIDES.length - 1 ? 'visible' : 'invisible pointer-events-none'
            }`}
          >
            Saltar presentación →
          </button>
        </div>
      </div>
    </div>
  );
}
