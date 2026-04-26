// =========================================
// QUICK CHECK — Therapheye
// Evaluación rápida de 3 preguntas (< 30 seg)
// Se muestra como modal desde el Dashboard
// =========================================

import { useState } from 'react';
import { X, CheckCircle2, Loader2, Zap } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { sql, localISOString } from '../neonCliente';

interface Props {
  onClose: () => void;
  onDone?: (score: number) => void;
}

const PREGUNTAS = [
  {
    id: 'fatiga',
    texto: '¿Cómo están tus ojos ahorita?',
    opciones: [
      { label: 'Frescos y sin molestias', emoji: '😊', valor: 0 },
      { label: 'Un poco cansados', emoji: '😐', valor: 33 },
      { label: 'Bastante cansados', emoji: '😓', valor: 66 },
      { label: 'Muy irritados o dolorosos', emoji: '😖', valor: 100 },
    ],
  },
  {
    id: 'pantalla',
    texto: '¿Cuánto tiempo llevas en pantalla hoy?',
    opciones: [
      { label: 'Menos de 2 horas', emoji: '🌱', valor: 0 },
      { label: '2–4 horas', emoji: '⏱', valor: 25 },
      { label: '4–6 horas', emoji: '⚠️', valor: 50 },
      { label: 'Más de 6 horas', emoji: '🔴', valor: 100 },
    ],
  },
  {
    id: 'vision',
    texto: '¿Tu visión está clara en este momento?',
    opciones: [
      { label: 'Perfectamente clara', emoji: '🔭', valor: 0 },
      { label: 'Levemente borrosa', emoji: '🌫', valor: 33 },
      { label: 'Borrosa o con halos', emoji: '😵', valor: 66 },
      { label: 'Muy borrosa', emoji: '🚨', valor: 100 },
    ],
  },
];

const getResultado = (score: number) => {
  if (score < 25)  return { emoji: '😊', texto: '¡Tus ojos están bien!', sub: 'Sigue así. Haz una pausa preventiva en un rato.', color: 'from-emerald-500 to-teal-600' };
  if (score < 50)  return { emoji: '😐', texto: 'Fatiga leve detectada', sub: 'Haz el ejercicio 20-20-20 ahora mismo.', color: 'from-amber-500 to-orange-500' };
  if (score < 75)  return { emoji: '😓', texto: 'Tus ojos necesitan descanso', sub: 'Haz palming 5 minutos y toma agua.', color: 'from-orange-500 to-red-500' };
  return             { emoji: '😖', texto: 'Atención recomendada', sub: 'Descansa de pantallas al menos 20 min y considera ver a un especialista.', color: 'from-red-500 to-rose-700' };
};

export default function QuickCheck({ onClose, onDone }: Props) {
  const { user } = useUser();
  const [paso, setPaso] = useState(0);
  const [respuestas, setRespuestas] = useState<number[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [done, setDone] = useState(false);
  const [score, setScore] = useState(0);

  const responder = async (valor: number) => {
    const nuevas = [...respuestas, valor];
    setRespuestas(nuevas);

    if (paso < PREGUNTAS.length - 1) {
      setPaso(paso + 1);
    } else {
      // Calcular score promedio
      const avg = Math.round(nuevas.reduce((a, b) => a + b, 0) / nuevas.length);
      setScore(avg);
      setGuardando(true);
      try {
        if (user?.id) {
          await sql`
            INSERT INTO respuestas_cuestionario
              (user_id, puntaje_fatiga, sintoma_dominante, respuestas_json, created_at)
            VALUES
              (${user.id}, ${avg}, ${'quick_check'}, ${JSON.stringify({ fatiga: nuevas[0], pantalla: nuevas[1], vision: nuevas[2] })}, ${localISOString()})
          `;
        }
      } catch { /* no crítico */ }
      setGuardando(false);
      setDone(true);
      onDone?.(avg);
    }
  };

  const preg = PREGUNTAS[paso];
  const resultado = done ? getResultado(score) : null;
  const progreso = ((paso) / PREGUNTAS.length) * 100;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4 pb-4 sm:pb-0">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-[slideUp_0.3s_ease]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-800 text-sm">Check rápido</span>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!done ? (
          <>
            {/* Progress bar */}
            <div className="px-5 mb-4">
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-400"
                  style={{ width: `${progreso + (100 / PREGUNTAS.length)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">{paso + 1} de {PREGUNTAS.length}</p>
            </div>

            {/* Pregunta */}
            <div className="px-5 pb-5">
              <p className="font-semibold text-gray-800 text-base mb-4 leading-snug">{preg.texto}</p>
              <div className="space-y-2">
                {preg.opciones.map((op) => (
                  <button
                    key={op.valor}
                    onClick={() => responder(op.valor)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 text-left hover:border-indigo-300 hover:bg-indigo-50 transition group"
                  >
                    <span className="text-xl w-7 text-center flex-shrink-0">{op.emoji}</span>
                    <span className="text-sm text-gray-700 group-hover:text-indigo-700 font-medium">{op.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          /* Resultado */
          <div className="pb-5">
            {guardando ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              </div>
            ) : resultado && (
              <>
                <div className={`bg-gradient-to-br ${resultado.color} mx-5 rounded-2xl p-5 text-center mb-4`}>
                  <p className="text-5xl mb-2">{resultado.emoji}</p>
                  <p className="text-white font-bold text-lg leading-tight">{resultado.texto}</p>
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <div className="h-2 flex-1 bg-white/30 rounded-full overflow-hidden">
                      <div className="h-full bg-white rounded-full transition-all" style={{ width: `${score}%` }} />
                    </div>
                    <span className="text-white/90 text-sm font-bold">{score}%</span>
                  </div>
                </div>
                <div className="px-5">
                  <p className="text-sm text-gray-600 text-center mb-4 leading-relaxed">{resultado.sub}</p>
                  <button
                    onClick={onClose}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white font-semibold rounded-xl py-3 hover:bg-indigo-700 transition"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Listo
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
