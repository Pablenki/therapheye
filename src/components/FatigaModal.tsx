// =========================================
// FatigaModal — cuestionario exprés post-ejercicio
// 3 preguntas, guarda en DB, aparece sobre la pantalla de "Ejercicio completo"
// =========================================

import { useState } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import { sql } from '../neonCliente';

interface Props {
  userId: string;
  exerciseId: string;
  onClose: () => void;
}

type Level = 0 | 1 | 2; // 0=No, 1=Un poco, 2=Sí

interface Answer {
  burning: Level | null;
  blur: Level | null;
  headache: Level | null;
}

const OPTIONS: { value: Level; label: string; emoji: string; color: string }[] = [
  { value: 0, label: 'No',     emoji: '✅', color: 'bg-green-100 border-green-400 text-green-800' },
  { value: 1, label: 'Un poco',emoji: '🟡', color: 'bg-yellow-100 border-yellow-400 text-yellow-800' },
  { value: 2, label: 'Sí',     emoji: '🔴', color: 'bg-red-100 border-red-400 text-red-800' },
];

const QUESTIONS = [
  { key: 'burning'  as const, label: '¿Sientes ardor o picazón?', icon: '🔥' },
  { key: 'blur'     as const, label: '¿Tienes visión borrosa?',   icon: '👁' },
  { key: 'headache' as const, label: '¿Dolor de cabeza?',         icon: '💢' },
];

export default function FatigaModal({ userId, exerciseId, onClose }: Props) {
  const [answers, setAnswers] = useState<Answer>({ burning: null, blur: null, headache: null });
  const [saving, setSaving]   = useState(false);
  const [done, setDone]       = useState(false);

  const allAnswered = answers.burning !== null && answers.blur !== null && answers.headache !== null;

  const handleSave = async () => {
    if (!allAnswered) return;
    setSaving(true);
    try {
      await sql`
        INSERT INTO fatiga_post_ejercicio (user_id, exercise_id, burning, blur, headache)
        VALUES (${userId}, ${exerciseId}, ${answers.burning!}, ${answers.blur!}, ${answers.headache!})
      `;
      setDone(true);
      setTimeout(onClose, 1400);
    } catch (e) {
      console.error('FatigaModal save error:', e);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden animate-[scaleIn_0.25s_ease]">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4 relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-white/70 hover:text-white transition"
          >
            <X className="w-5 h-5"/>
          </button>
          <p className="text-white font-bold text-base">¿Cómo quedaron tus ojos?</p>
          <p className="text-white/75 text-xs mt-0.5">3 preguntas rápidas para tu seguimiento</p>
        </div>

        {done ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <CheckCircle2 className="w-12 h-12 text-green-500"/>
            <p className="text-gray-700 font-semibold">¡Gracias! Registrado.</p>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-5">
            {QUESTIONS.map(q => (
              <div key={q.key}>
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  <span className="mr-1">{q.icon}</span>{q.label}
                </p>
                <div className="flex gap-2">
                  {OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setAnswers(prev => ({ ...prev, [q.key]: opt.value }))}
                      className={`flex-1 flex flex-col items-center py-2 rounded-xl border-2 text-xs font-semibold transition-all ${
                        answers[q.key] === opt.value
                          ? `${opt.color} scale-105 shadow-sm`
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-base leading-none mb-1">{opt.emoji}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <button
              onClick={handleSave}
              disabled={!allAnswered || saving}
              className="w-full bg-indigo-600 text-white font-semibold rounded-xl py-2.5 text-sm hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed mt-2"
            >
              {saving ? 'Guardando…' : 'Guardar y continuar'}
            </button>
            <button
              onClick={onClose}
              className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition pb-1"
            >
              Omitir
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
