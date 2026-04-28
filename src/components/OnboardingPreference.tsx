// =========================================
// ONBOARDING PREFERENCE — Therapheye
// Después del onboarding, pregunta la preocupación principal
// para personalizar el orden del dashboard
// =========================================

import { useState } from 'react';

const PREF_KEY = 'therapheye_user_focus';

export type UserFocus = 'fatiga' | 'ojo-seco' | 'clinica' | 'curiosidad';

const OPTIONS: { id: UserFocus; emoji: string; title: string; desc: string }[] = [
  { id: 'fatiga',     emoji: '💻', title: 'Fatiga digital',        desc: 'Paso mucho tiempo frente a pantallas y quiero reducir el cansancio visual.' },
  { id: 'ojo-seco',   emoji: '💧', title: 'Ojo seco / irritación', desc: 'Siento sequedad, ardor o irritación frecuente en los ojos.' },
  { id: 'clinica',    emoji: '🏥', title: 'Revisión clínica',      desc: 'Quiero hacer seguimiento clínico de mi salud visual con tests y reportes.' },
  { id: 'curiosidad', emoji: '🔍', title: 'Curiosidad general',    desc: 'Solo quiero explorar y aprender sobre salud visual.' },
];

interface Props {
  onDone: () => void;
}

export function getUserFocus(): UserFocus | null {
  try { return localStorage.getItem(PREF_KEY) as UserFocus | null; } catch { return null; }
}

export function isPreferenceDone(): boolean {
  try { return localStorage.getItem(PREF_KEY) !== null; } catch { return true; }
}

export default function OnboardingPreference({ onDone }: Props) {
  const [selected, setSelected] = useState<UserFocus | null>(null);

  const finish = () => {
    if (!selected) return;
    try { localStorage.setItem(PREF_KEY, selected); } catch {}
    onDone();
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-3xl">🎯</span>
          </div>
          <h2 className="text-xl font-black text-white mb-1">¿Cuál es tu enfoque principal?</h2>
          <p className="text-white/70 text-sm">Esto nos ayuda a personalizar tu experiencia</p>
        </div>

        {/* Options */}
        <div className="px-5 py-4 space-y-2.5">
          {OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setSelected(opt.id)}
              className={`w-full text-left rounded-xl p-3.5 border-2 transition-all ${
                selected === opt.id
                  ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                  : 'border-gray-100 bg-gray-50/50 hover:border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl flex-shrink-0">{opt.emoji}</span>
                <div>
                  <p className={`text-sm font-bold ${selected === opt.id ? 'text-indigo-700' : 'text-gray-800'}`}>{opt.title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{opt.desc}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Action */}
        <div className="px-5 pb-5">
          <button
            onClick={finish}
            disabled={!selected}
            className={`w-full py-3 rounded-xl text-sm font-bold text-white transition ${
              selected
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-90'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            Continuar
          </button>
          <button
            onClick={() => { try { localStorage.setItem(PREF_KEY, 'curiosidad'); } catch {} onDone(); }}
            className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition mt-2 py-1"
          >
            Saltar
          </button>
        </div>
      </div>
    </div>
  );
}
