// =========================================
// RUTINA DE BUENOS DÍAS — Therapheye
// Aparece si el usuario abre la app antes de las 10am
// y no ha completado nada aún hoy
// =========================================

import { useState } from 'react';
import { X, Sun, ChevronRight, Zap } from 'lucide-react';

const BD_KEY = 'therapheye_buenos_dias';    // last shown date (YYYY-MM-DD)
const BD_DONE_KEY = 'therapheye_last_exercise';

interface Props {
  onStartExercise: (id: string) => void;
  onNavigate: (page: string) => void;
}

const EJERCICIOS_MANANA = [
  { id: 'palming',    nombre: 'Palming',           emoji: '🤲', duracion: '2 min', desc: 'Relajación profunda para empezar el día' },
  { id: 'seguimiento', nombre: 'Seguimiento',       emoji: '👁',  duracion: '3 min', desc: 'Activa los músculos oculares suavemente' },
  { id: 'enfoque',    nombre: 'Cambio de Enfoque',  emoji: '🔭',  duracion: '2 min', desc: 'Acomoda tus ojos antes de ver pantallas' },
];

const FRASES = [
  'Tus ojos trabajaron mucho ayer. Dale 2 minutos para arrancar bien el día.',
  'Antes de mirar pantallas, da a tus ojos un calentamiento suave.',
  'Buenos hábitos matutinos = ojos más sanos a lo largo del día.',
  'Son solo 2 minutos. Tu salud visual lo vale.',
];

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function shouldShowBuenosDias(): boolean {
  try {
    const hour = new Date().getHours();
    if (hour >= 10) return false;  // Solo antes de las 10am

    const today = getTodayKey();
    const lastShown = localStorage.getItem(BD_KEY);
    if (lastShown === today) return false;  // Ya se mostró hoy

    // Verificar si ya hizo algo hoy
    const lastEx = Number(localStorage.getItem(BD_DONE_KEY) ?? 0);
    if (lastEx > 0 && new Date(lastEx).toISOString().slice(0, 10) === today) return false;

    return true;
  } catch { return false; }
}

export function markBuenosDiasSeen() {
  try { localStorage.setItem(BD_KEY, getTodayKey()); } catch {}
}

export default function BuenosDias({ onStartExercise, onNavigate }: Props) {
  const [visible, setVisible] = useState(true);
  const [frase] = useState(() => FRASES[new Date().getDay() % FRASES.length]);

  const hora = new Date().getHours();
  const saludo = hora < 6 ? 'Madrugador' : hora < 9 ? 'Buenos días' : 'Buen día';

  const dismiss = () => {
    markBuenosDiasSeen();
    setVisible(false);
  };

  const startEjercicio = (id: string) => {
    markBuenosDiasSeen();
    setVisible(false);
    onStartExercise(id);
  };

  const irRutinas = () => {
    markBuenosDiasSeen();
    setVisible(false);
    onNavigate('rutinas-ia');
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-3 pb-3 sm:pb-0 animate-[fadeIn_0.3s_ease]">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden animate-[slideUp_0.35s_ease]">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-400 to-orange-500 px-5 pt-5 pb-4 relative">
          <button
            onClick={dismiss}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition"
          >
            <X className="w-4 h-4"/>
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center">
              <Sun className="w-6 h-6 text-white"/>
            </div>
            <div>
              <p className="text-white/80 text-xs font-medium">{saludo}</p>
              <h2 className="text-white font-black text-lg leading-tight">Rutina Matutina</h2>
            </div>
          </div>
          <p className="text-white/80 text-sm leading-snug">{frase}</p>
        </div>

        {/* Exercises */}
        <div className="px-4 pt-4 pb-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Elige un ejercicio rápido</p>
          <div className="space-y-2">
            {EJERCICIOS_MANANA.map(ej => (
              <button
                key={ej.id}
                onClick={() => startEjercicio(ej.id)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl border border-gray-100 hover:border-amber-200 hover:bg-amber-50 transition text-left group"
              >
                <span className="text-2xl">{ej.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{ej.nombre}</p>
                  <p className="text-gray-400 text-xs">{ej.desc}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-xs text-amber-600 font-medium">{ej.duracion}</span>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-amber-500 transition"/>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer buttons */}
        <div className="px-4 py-3 flex gap-2">
          <button
            onClick={irRutinas}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-indigo-50 text-indigo-700 text-sm font-semibold hover:bg-indigo-100 transition"
          >
            <Zap className="w-4 h-4"/> Rutina IA
          </button>
          <button
            onClick={dismiss}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50 transition"
          >
            Más tarde
          </button>
        </div>
      </div>
    </div>
  );
}
