// =========================================
// FEATURE SHOWCASE — Therapheye
// Slide automático de TODAS las funciones
// 8 categorías · 3.5s por slide · pause on hover
// =========================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSwipe } from '../hooks/useSwipe';
import {
  Activity, Camera, Glasses, History, HeartPulse, ScanEye,
  ClipboardList, ScanFace, BookOpenCheck, MessageCircleHeart,
  MapPin, Gamepad2, Sparkles, BookMarked, Contrast,
  Timer, Orbit, BarChart2, ClipboardCheck, FlaskConical, Focus,
  Microscope, ScrollText, TriangleAlert, ImageIcon, BrainCircuit,
  AreaChart, Scan, QrCode, MessageCircle, Crown, BookOpen, HeartHandshake,
  X, ChevronLeft, ChevronRight, Pause, Play,
} from 'lucide-react';

const SHOWCASE_KEY = 'therapheye_showcase_done';
const SLIDE_MS = 3800;

export function isShowcaseDone(): boolean {
  try { return localStorage.getItem(SHOWCASE_KEY) === '1'; } catch { return true; }
}

interface Feature {
  icon: React.ElementType;
  name: string;
  desc: string;
  color: string;
  bg: string;
}

interface Slide {
  category: string;
  emoji: string;
  from: string;
  to: string;
  features: Feature[];
}

const SLIDES: Slide[] = [
  {
    category: 'Ejercicios y Rutinas',
    emoji: '🏃',
    from: 'from-emerald-500',
    to: 'to-teal-600',
    features: [
      { icon: Activity,      name: 'Ejercicios',         desc: '5 rutinas terapéuticas para tus ojos',         color: 'text-emerald-700', bg: 'bg-emerald-100' },
      { icon: Microscope,    name: 'Ejerc. Avanzados',   desc: 'Entrenamiento ocular intensivo y progresivo',   color: 'text-teal-700',    bg: 'bg-teal-100'    },
      { icon: Sparkles,      name: 'Rutinas con IA',     desc: 'Claude genera tu rutina personalizada',         color: 'text-cyan-700',    bg: 'bg-cyan-100'    },
      { icon: ClipboardList, name: 'Cuestionario IA',    desc: 'Evalúa síntomas y crea tu plan diario',        color: 'text-green-700',   bg: 'bg-green-100'   },
    ],
  },
  {
    category: 'Tests de Visión',
    emoji: '👁️',
    from: 'from-blue-500',
    to: 'to-indigo-600',
    features: [
      { icon: Glasses,      name: 'Prueba de Visión',   desc: 'Test de agudeza visual estándar',               color: 'text-blue-700',   bg: 'bg-blue-100'   },
      { icon: Contrast,     name: 'Test Contraste',      desc: 'Sensibilidad al contraste luminoso',           color: 'text-sky-700',    bg: 'bg-sky-100'    },
      { icon: FlaskConical, name: 'Test Cromático',      desc: 'Detección de daltonismo y alteraciones',        color: 'text-violet-700', bg: 'bg-violet-100' },
      { icon: Focus,        name: 'Test Acomodación',    desc: 'Flexibilidad y rango del cristalino',           color: 'text-blue-700',   bg: 'bg-blue-50'    },
    ],
  },
  {
    category: 'Diagnóstico con IA',
    emoji: '🔬',
    from: 'from-violet-500',
    to: 'to-purple-600',
    features: [
      { icon: ScanEye,          name: 'Diagnóstico Completo', desc: 'Suite completa de tests clínicos',         color: 'text-violet-700', bg: 'bg-violet-100' },
      { icon: MessageCircleHeart, name: 'Chat Visual IA',     desc: 'Consulta síntomas con Claude AI',          color: 'text-purple-700', bg: 'bg-purple-100' },
      { icon: TriangleAlert,    name: 'Analizador Síntomas',  desc: 'Evaluación inteligente de molestias',      color: 'text-fuchsia-700',bg: 'bg-fuchsia-100'},
      { icon: Camera,           name: 'Captura de Imagen',    desc: 'IA analiza foto de tu ojo al instante',    color: 'text-pink-700',   bg: 'bg-pink-100'   },
      { icon: ScanFace,         name: 'Detector Parpadeo',    desc: 'Mide tu frecuencia de parpadeo en vivo',   color: 'text-rose-700',   bg: 'bg-rose-100'   },
    ],
  },
  {
    category: 'Seguimiento y Análisis',
    emoji: '📊',
    from: 'from-amber-500',
    to: 'to-orange-600',
    features: [
      { icon: History,    name: 'Historial',         desc: 'Todo tu progreso y sesiones registradas',          color: 'text-amber-700',  bg: 'bg-amber-100'  },
      { icon: BookMarked, name: 'Diario Visual',      desc: 'Registro diario de molestias y mejoras',          color: 'text-orange-700', bg: 'bg-orange-100' },
      { icon: ScrollText, name: 'Historial Ocular',   desc: 'Historial médico ocular completo',                color: 'text-yellow-700', bg: 'bg-yellow-100' },
      { icon: AreaChart,  name: 'Stats Avanzadas',    desc: 'Gráficas, tendencias y comparativas mensuales',   color: 'text-amber-700',  bg: 'bg-amber-50'   },
      { icon: BarChart2,  name: 'Carga Visual',       desc: 'Mide la fatiga visual acumulada en el día',       color: 'text-orange-700', bg: 'bg-orange-50'  },
    ],
  },
  {
    category: 'Bienestar Visual',
    emoji: '🧘',
    from: 'from-sky-500',
    to: 'to-cyan-600',
    features: [
      { icon: HeartHandshake,name: 'Modo Zen',             desc: 'Relajación y respiración para tus ojos',            color: 'text-cyan-700', bg: 'bg-cyan-100'  },
      { icon: BookOpenCheck, name: 'Lectura Visual',       desc: 'Entrenamiento de velocidad y comprensión lectora',  color: 'text-teal-700', bg: 'bg-teal-100'  },
      { icon: Timer,         name: 'Reacción Visual',      desc: 'Mide tu tiempo de respuesta ocular',                color: 'text-blue-700', bg: 'bg-blue-100'  },
      { icon: Orbit,         name: 'Vergencia',            desc: 'Entrenamiento binocular y convergencia',             color: 'text-sky-700',  bg: 'bg-sky-50'    },
    ],
  },
  {
    category: 'Herramientas Médicas',
    emoji: '🏥',
    from: 'from-rose-500',
    to: 'to-pink-600',
    features: [
      { icon: ClipboardCheck, name: 'Notas Médicas',    desc: 'Guarda consultas, recetas y seguimientos',     color: 'text-rose-700', bg: 'bg-rose-100'  },
      { icon: Scan,           name: 'OCR Receta',        desc: 'Digitaliza tu receta óptica con la cámara',   color: 'text-pink-700', bg: 'bg-pink-100'  },
      { icon: QrCode,         name: 'QR Informe',        desc: 'Comparte reportes PDF con un código QR',      color: 'text-red-700',  bg: 'bg-red-100'   },
      { icon: MessageCircle,  name: 'Recordatorios WA',  desc: 'Alertas de ejercicios por WhatsApp',          color: 'text-rose-700', bg: 'bg-rose-50'   },
      { icon: MapPin,         name: 'Mapa Oftalmólogos', desc: 'Encuentra especialistas cerca de ti',         color: 'text-pink-700', bg: 'bg-pink-50'   },
    ],
  },
  {
    category: 'Aprende y Juega',
    emoji: '🎮',
    from: 'from-green-500',
    to: 'to-emerald-600',
    features: [
      { icon: BookOpen,    name: 'Aprende',             desc: 'Artículos y guías de salud visual',              color: 'text-green-700',   bg: 'bg-green-100'   },
      { icon: HeartPulse,  name: 'Salud Visual',        desc: 'Consejos, hábitos y recomendaciones clínicas',   color: 'text-emerald-700', bg: 'bg-emerald-100' },
      { icon: Gamepad2,    name: 'Juegos Visuales',     desc: 'Entrena tu visión jugando mini-juegos',          color: 'text-teal-700',    bg: 'bg-teal-100'    },
      { icon: BrainCircuit,name: 'Entrena. Mental',     desc: 'Coordinación ojo-mente y memoria visual',        color: 'text-cyan-700',    bg: 'bg-cyan-100'    },
    ],
  },
  {
    category: 'Extras y Accesibilidad',
    emoji: '✨',
    from: 'from-indigo-500',
    to: 'to-violet-600',
    features: [
      { icon: ImageIcon, name: 'Galería Capturas',  desc: 'Historial de fotos oculares analizadas por IA',       color: 'text-violet-700', bg: 'bg-violet-100' },
      { icon: Crown,     name: 'Plan Premium',       desc: 'Desbloquea todas las funciones avanzadas',            color: 'text-amber-700',  bg: 'bg-amber-100'  },
      { icon: HeartHandshake, name: 'Accesibilidad', desc: 'Daltonismo, zoom, voz, idiomas y más',               color: 'text-purple-700', bg: 'bg-purple-100' },
    ],
  },
];

interface Props {
  active: boolean;
  onClose: () => void;
}

export default function FeatureShowcase({ active, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [animDir, setAnimDir] = useState<'fwd' | 'back'>('fwd');
  const [visible, setVisible] = useState(true);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  // Resetear al paso 1 cada vez que se abre (evita quedar en el último slide)
  useEffect(() => {
    if (active) {
      setStep(0);
      setProgress(0);
      setVisible(true);
      setPaused(false);
    }
  }, [active]);

  const finish = useCallback(() => {
    try { localStorage.setItem(SHOWCASE_KEY, '1'); } catch {}
    onClose();
  }, [onClose]);

  const goTo = useCallback((next: number, dir: 'fwd' | 'back' = 'fwd') => {
    setAnimDir(dir);
    setVisible(false);
    setTimeout(() => {
      setStep(next);
      setProgress(0);
      setVisible(true);
    }, 220);
  }, []);

  const goNext = useCallback(() => {
    if (step < SLIDES.length - 1) goTo(step + 1, 'fwd');
    else finish();
  }, [step, goTo, finish]);

  const goPrev = useCallback(() => {
    if (step > 0) goTo(step - 1, 'back');
  }, [step, goTo]);

  const swipe = useSwipe(goNext, goPrev);

  // Auto-advance + progress bar
  useEffect(() => {
    if (!active) return;
    setProgress(0);
    const startTime = Date.now();

    const iv = setInterval(() => {
      if (pausedRef.current) return;
      const elapsed = Date.now() - startTime;
      const p = Math.min((elapsed / SLIDE_MS) * 100, 100);
      setProgress(p);
      if (p >= 100) {
        clearInterval(iv);
        if (step < SLIDES.length - 1) goTo(step + 1, 'fwd');
        else finish();
      }
    }, 50);

    return () => clearInterval(iv);
  }, [active, step, goTo, finish]);

  // ESC key
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === ' ') setPaused(p => !p);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, goNext, goPrev, finish]);

  if (!active) return null;

  const s = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  const slideClass = visible
    ? 'opacity-100 translate-x-0'
    : animDir === 'fwd'
      ? 'opacity-0 translate-x-8'
      : 'opacity-0 -translate-x-8';

  return (
    <div className="fixed inset-0 z-[99990] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 py-6">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]" {...swipe} style={{ touchAction: 'pan-y' }}>

        {/* Top progress bar */}
        <div className="h-1 bg-gray-100 flex-shrink-0">
          <div
            className="h-full rounded-full transition-none"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(to right, #6366f1, #8b5cf6)`,
            }}
          />
        </div>

        {/* Slide header */}
        <div className={`bg-gradient-to-r ${s.from} ${s.to} px-5 py-4 flex items-center justify-between flex-shrink-0 transition-all duration-220 ${slideClass}`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl leading-none">{s.emoji}</span>
            <div>
              <p className="text-white/70 text-[10px] font-semibold uppercase tracking-widest">
                {step + 1} / {SLIDES.length}
              </p>
              <h2 className="text-white font-black text-lg leading-tight">{s.category}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPaused(p => !p)}
              className="text-white/70 hover:text-white transition p-1 rounded-lg"
              title={paused ? 'Reanudar' : 'Pausar'}
            >
              {paused
                ? <Play className="w-4 h-4" />
                : <Pause className="w-4 h-4" />
              }
            </button>
            <button
              onClick={finish}
              className="text-white/70 hover:text-white transition p-1 rounded-lg"
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Feature grid */}
        <div
          className={`flex-1 overflow-y-auto p-4 transition-all duration-220 ${slideClass}`}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div className="grid grid-cols-2 gap-2.5">
            {s.features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.name}
                  className="flex items-start gap-3 p-3 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className={`w-9 h-9 rounded-xl ${f.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4.5 h-4.5 ${f.color}`} style={{ width: 18, height: 18 }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-gray-900 font-semibold text-[13px] leading-tight">{f.name}</p>
                    <p className="text-gray-500 text-[11px] leading-snug mt-0.5">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Slide dots */}
        <div className="flex justify-center gap-1.5 py-2 flex-shrink-0">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i, i > step ? 'fwd' : 'back')}
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
        <div className="px-4 pb-4 flex items-center gap-2 flex-shrink-0">
          <button
            onClick={goPrev}
            disabled={step === 0}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition flex-shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            onClick={goNext}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-90 transition"
          >
            {isLast ? '¡Listo, a usar Therapheye! 🎉' : <>Siguiente categoría <ChevronRight className="w-4 h-4" /></>}
          </button>
        </div>

        {step === 0 && (
          <button
            onClick={finish}
            className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition pb-3 flex-shrink-0"
          >
            Saltar presentación
          </button>
        )}
      </div>
    </div>
  );
}
