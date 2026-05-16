// =========================================
// TOUR GUIDE — Therapheye
// Tour interactivo con spotlight por pasos
// Triggered: primera vez tras onboarding + botón "¿Cómo usar esto?"
// =========================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronRight, ChevronLeft, X } from 'lucide-react';
import { useSwipe } from '../hooks/useSwipe';

const TOUR_KEY = 'therapheye_tour_done';

export function isTourDone(): boolean {
  try { return localStorage.getItem(TOUR_KEY) === '1'; } catch { return true; }
}

interface Step {
  targetId: string | null;
  needsSidebar: boolean;
  title: string;
  desc: string;
  emoji: string;
}

const STEPS: Step[] = [
  {
    targetId: null,
    needsSidebar: false,
    emoji: '👋',
    title: '¡Tour de Therapheye!',
    desc: 'Te mostramos las funciones principales en unos pasos rápidos. Puedes saltarte el tour cuando quieras.',
  },
  {
    targetId: 'tour-nav',
    needsSidebar: true,
    emoji: '🗂️',
    title: 'Menú de navegación',
    desc: 'Aquí tienes más de 35 herramientas de salud visual. Desplázate para explorarlas todas.',
  },
  {
    targetId: 'tour-progress',
    needsSidebar: true,
    emoji: '📊',
    title: 'Tu progreso diario',
    desc: 'Rastrea tus 3 metas del día: tiempo activo, ejercicio realizado y cuestionario completado.',
  },
  {
    targetId: 'tour-exercises',
    needsSidebar: true,
    emoji: '🏃',
    title: 'Ejercicios terapéuticos',
    desc: 'Rutinas de 2-5 minutos basadas en evidencia clínica para reducir la fatiga digital.',
  },
  {
    targetId: 'tour-questionnaire',
    needsSidebar: true,
    emoji: '🤖',
    title: 'Cuestionario con IA',
    desc: 'Empieza aquí: la IA analiza tus síntomas y genera una rutina personalizada solo para ti.',
  },
  {
    targetId: 'tour-chat',
    needsSidebar: true,
    emoji: '💬',
    title: 'Chat Visual con IA',
    desc: 'Cuéntale tus molestias oculares a Claude AI y recibe orientación inmediata.',
  },
  {
    targetId: 'tour-diagnostico',
    needsSidebar: true,
    emoji: '🔬',
    title: 'Diagnóstico completo',
    desc: 'Tests clínicos: campo visual, contraste, cromatismo, vergencia y mucho más.',
  },
  {
    targetId: 'tour-history',
    needsSidebar: true,
    emoji: '📁',
    title: 'Historial y reportes',
    desc: 'Revisa tu progreso, genera reportes PDF y compártelos con tu oftalmólogo.',
  },
  {
    targetId: 'tour-help',
    needsSidebar: true,
    emoji: '✅',
    title: '¿Quieres repetir el tour?',
    desc: 'Con este botón puedes volver a ver esta guía cuando quieras. ¡Ya eres un experto!',
  },
];

interface Props {
  active: boolean;
  onClose: () => void;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8;

export default function TourGuide({ active, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<TargetRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const updateRect = useCallback(() => {
    const s = STEPS[step];
    if (!s.targetId) { setRect(null); return; }

    const el = document.querySelector<HTMLElement>(`[data-tour="${s.targetId}"]`);
    if (!el) { setRect(null); return; }

    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    setTimeout(() => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }, 120);
  }, [step]);

  useEffect(() => {
    if (!active) { setStep(0); setRect(null); return; }

    const s = STEPS[step];
    if (s.needsSidebar) {
      window.dispatchEvent(new CustomEvent('therapheye-open-sidebar'));
    }

    const t = setTimeout(updateRect, s.needsSidebar ? 380 : 50);
    return () => clearTimeout(t);
  }, [active, step, updateRect]);

  // Recalculate on resize
  useEffect(() => {
    if (!active) return;
    const handler = () => updateRect();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [active, updateRect]);

  // Keyboard navigation
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step]);

  const finish = () => {
    try { localStorage.setItem(TOUR_KEY, '1'); } catch {}
    setStep(0);
    setRect(null);
    onClose();
  };

  const goNext = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else finish();
  };

  const goPrev = () => {
    if (step > 0) setStep(s => s - 1);
  };

  const swipe = useSwipe(goNext, goPrev);

  if (!active) return null;

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isCenter = !rect;

  // Tooltip position logic
  const getTooltipStyle = (): React.CSSProperties => {
    if (isCenter || !rect) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: 340,
        width: 'calc(100vw - 32px)',
      };
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tooltipW = Math.min(280, vw - 32);
    const rightSpace = vw - (rect.left + rect.width + PAD);

    if (rightSpace >= tooltipW + 20) {
      // Right side
      const top = Math.max(12, Math.min(
        rect.top + rect.height / 2 - 100,
        vh - 260
      ));
      return {
        position: 'fixed',
        top,
        left: rect.left + rect.width + PAD + 14,
        width: tooltipW,
      };
    }

    // Below element (fallback)
    const topPos = Math.min(rect.top + rect.height + PAD + 14, vh - 260);
    return {
      position: 'fixed',
      top: Math.max(topPos, 12),
      left: '50%',
      transform: 'translateX(-50%)',
      width: tooltipW,
    };
  };

  return (
    <>
      {/* Click shield — prevent interacting with app behind */}
      <div className="fixed inset-0 z-[99990]" onClick={(e) => e.stopPropagation()} />

      {/* Spotlight box */}
      {rect && (
        <div
          className="fixed z-[99991] rounded-xl pointer-events-none"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.62)',
            border: '2px solid rgba(99,102,241,0.85)',
            transition: 'top 0.3s ease, left 0.3s ease, width 0.3s ease, height 0.3s ease',
          }}
        />
      )}

      {/* Full overlay for center steps */}
      {isCenter && (
        <div className="fixed inset-0 z-[99991] bg-black/62" />
      )}

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        className="fixed z-[99999] bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{ ...getTooltipStyle(), touchAction: 'pan-y' }}
        {...swipe}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 flex items-center justify-between">
          <span className="text-white/80 text-xs font-semibold tracking-wide uppercase">
            Paso {step + 1} / {STEPS.length}
          </span>
          <button
            onClick={finish}
            className="text-white/70 hover:text-white transition rounded-lg p-0.5"
            title="Cerrar tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none mt-0.5 flex-shrink-0">{s.emoji}</span>
            <div>
              <h3 className="text-gray-900 font-bold text-[15px] leading-snug mb-1">{s.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
            </div>
          </div>
        </div>

        {/* Progress dots */}
        <div className="px-4 pt-3 pb-1 flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === step ? 20 : 6,
                height: 6,
                background: i === step ? '#6366f1' : '#e5e7eb',
              }}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="px-4 pb-4 pt-2 flex gap-2">
          {step > 0 && (
            <button
              onClick={goPrev}
              className="flex items-center gap-1 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition flex-shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={goNext}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-90 transition"
          >
            {isLast
              ? '¡Listo! 🎉'
              : <> Siguiente <ChevronRight className="w-4 h-4" /></>
            }
          </button>
        </div>

        {step === 0 && (
          <button
            onClick={finish}
            className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition pb-3.5"
          >
            Saltar tour
          </button>
        )}
      </div>
    </>
  );
}
