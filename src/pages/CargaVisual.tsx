// =========================================
// CALCULADORA DE CARGA VISUAL — Therapheye
// Calcula la carga visual diaria basada en
// horas de pantalla, condiciones, hábitos
// =========================================

import { useState } from 'react';
import { ArrowLeft, Monitor, AlertCircle, CheckCircle } from 'lucide-react';

interface Props { onBack: () => void; }

interface Pregunta {
  id: string;
  texto: string;
  opciones: { label: string; valor: number; icon: string }[];
}

const PREGUNTAS: Pregunta[] = [
  {
    id: 'horas_pantalla',
    texto: '¿Cuántas horas miras pantallas al día?',
    opciones: [
      { label: 'Menos de 2h', valor: 0, icon: '😌' },
      { label: '2 a 4h', valor: 20, icon: '🙂' },
      { label: '4 a 8h', valor: 50, icon: '😐' },
      { label: 'Más de 8h', valor: 85, icon: '😓' },
    ],
  },
  {
    id: 'pausas',
    texto: '¿Con qué frecuencia haces pausas visuales?',
    opciones: [
      { label: 'Cada 20 min', valor: 0, icon: '✅' },
      { label: 'Cada hora', valor: 20, icon: '🕐' },
      { label: 'Muy poco', valor: 45, icon: '😔' },
      { label: 'Nunca', valor: 70, icon: '❌' },
    ],
  },
  {
    id: 'iluminacion',
    texto: '¿Cómo es la iluminación donde trabajas?',
    opciones: [
      { label: 'Excelente (luz natural)', valor: 0, icon: '☀️' },
      { label: 'Buena (difusa)', valor: 15, icon: '💡' },
      { label: 'Regular (reflejos)', valor: 35, icon: '🪟' },
      { label: 'Oscura/pobre', valor: 60, icon: '🌑' },
    ],
  },
  {
    id: 'distancia',
    texto: '¿A qué distancia sueles tener la pantalla?',
    opciones: [
      { label: 'Más de 60cm', valor: 0, icon: '✅' },
      { label: '40-60cm', valor: 15, icon: '🙂' },
      { label: '20-40cm', valor: 40, icon: '⚠️' },
      { label: 'Muy cerca (<20cm)', valor: 70, icon: '😨' },
    ],
  },
  {
    id: 'humedad',
    texto: '¿Tienes ojo seco o sensación de arenilla?',
    opciones: [
      { label: 'Nunca', valor: 0, icon: '💧' },
      { label: 'Raramente', valor: 15, icon: '🙂' },
      { label: 'A veces', valor: 35, icon: '😐' },
      { label: 'Frecuentemente', valor: 60, icon: '🔥' },
    ],
  },
  {
    id: 'sueño',
    texto: '¿Cuántas horas dormiste anoche?',
    opciones: [
      { label: 'Más de 8h', valor: 0, icon: '😴' },
      { label: '7-8h', valor: 10, icon: '🌙' },
      { label: '5-6h', valor: 35, icon: '⚠️' },
      { label: 'Menos de 5h', valor: 65, icon: '😵' },
    ],
  },
  {
    id: 'dolor',
    texto: '¿Tienes dolor de cabeza o tensión ocular ahora?',
    opciones: [
      { label: 'No', valor: 0, icon: '✅' },
      { label: 'Leve', valor: 25, icon: '🤔' },
      { label: 'Moderado', valor: 50, icon: '😣' },
      { label: 'Intenso', valor: 80, icon: '🤯' },
    ],
  },
];

function getCargaResult(score: number): {
  nivel: string; color: string; gradiente: string;
  recomendaciones: string[];
} {
  if (score < 15) return {
    nivel: 'Carga mínima', color: 'emerald',
    gradiente: 'from-emerald-500 to-teal-500',
    recomendaciones: [
      'Tus hábitos visuales son excelentes.',
      'Mantén el ritmo de pausas de 20-20-20.',
      'Sigue durmiendo bien — la noche repara la retina.',
    ],
  };
  if (score < 35) return {
    nivel: 'Carga moderada', color: 'blue',
    gradiente: 'from-blue-500 to-indigo-500',
    recomendaciones: [
      'Tu carga visual es manejable pero puede mejorar.',
      'Intenta añadir más pausas de 20 segundos cada 20 minutos.',
      'Revisa la iluminación y posición de tu pantalla.',
      'Realiza el ejercicio de palming por 2 minutos hoy.',
    ],
  };
  if (score < 60) return {
    nivel: 'Carga alta', color: 'amber',
    gradiente: 'from-amber-500 to-orange-500',
    recomendaciones: [
      'Tu carga visual es alta. Los síntomas de fatiga pueden aparecer pronto.',
      'Toma una pausa de 10 minutos ahora mismo.',
      'Reduce el brillo de la pantalla un 20%.',
      'Usa el modo nocturno si no lo tienes activado.',
      'Hidrata tus ojos parpadeando conscientemente.',
      'Considera ejercicios de relajación (palming, enfoque).',
    ],
  };
  return {
    nivel: 'Carga crítica', color: 'red',
    gradiente: 'from-red-500 to-rose-600',
    recomendaciones: [
      '⚠️ Tu carga visual es crítica. Detente y descansa ahora.',
      'Cierra los ojos 10-15 minutos en ambiente oscuro.',
      'Aplica compresas frías si tienes inflamación.',
      'Bebe agua — la deshidratación agrava el ojo seco.',
      'No uses pantallas al menos 1 hora.',
      'Si el dolor persiste, consulta a un oftalmólogo.',
    ],
  };
}

export default function CargaVisual({ onBack }: Props) {
  const [paso, setPaso] = useState(0);
  const [respuestas, setRespuestas] = useState<Record<string, number>>({});
  const [mostrandoResultado, setMostrandoResultado] = useState(false);

  const pregunta = PREGUNTAS[paso];

  const responder = (valor: number) => {
    const nuevas = { ...respuestas, [pregunta.id]: valor };
    setRespuestas(nuevas);
    if (paso < PREGUNTAS.length - 1) {
      setPaso(paso + 1);
    } else {
      setMostrandoResultado(true);
    }
  };

  const score = Object.values(respuestas).reduce((a, b) => a + b, 0) / PREGUNTAS.length;
  const resultado = getCargaResult(score);

  // ── Resultado ─────────────────────────────────────────────────────────────
  if (mostrandoResultado) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-slate-700 to-gray-800 px-4 pt-10 pb-8 text-white">
          <button onClick={onBack} className="flex items-center gap-2 text-white/60 hover:text-white text-sm mb-4 transition">
            <ArrowLeft className="w-4 h-4"/> Volver
          </button>
          <h1 className="text-xl font-black">Tu Carga Visual Hoy</h1>
        </div>

        <div className="p-4 max-w-md mx-auto">
          {/* Score card */}
          <div className={`bg-gradient-to-br ${resultado.gradiente} text-white rounded-3xl p-6 text-center mb-4 animate-[bounceIn_0.5s_ease]`}>
            <p className="text-white/80 text-sm mb-2">Índice de carga visual</p>
            <div className="text-6xl font-black mb-2">{Math.round(score)}</div>
            <p className="text-lg font-bold">{resultado.nivel}</p>
            {/* Score bar */}
            <div className="mt-4 h-2 bg-white/30 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full" style={{ width: `${Math.min(score, 100)}%` }}/>
            </div>
            <div className="flex justify-between text-[10px] text-white/60 mt-1">
              <span>Mínima</span><span>Moderada</span><span>Alta</span><span>Crítica</span>
            </div>
          </div>

          {/* Breakdown */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50 mb-4">
            {PREGUNTAS.map(p => {
              const val = respuestas[p.id] ?? 0;
              const opcion = p.opciones.find(o => o.valor === val);
              return (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-lg flex-shrink-0">{opcion?.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 leading-tight">{p.texto}</p>
                    <p className="text-sm font-semibold text-gray-800">{opcion?.label}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: val === 0 ? '#d1fae5' : val < 30 ? '#dbeafe' : val < 55 ? '#fef3c7' : '#fee2e2' }}>
                    <span className="text-xs font-bold" style={{ color: val === 0 ? '#065f46' : val < 30 ? '#1e40af' : val < 55 ? '#92400e' : '#991b1b' }}>
                      {val}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recommendations */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500"/> Recomendaciones
            </h3>
            <div className="space-y-2">
              {resultado.recomendaciones.map((r, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0"/>
                  <p className="text-sm text-gray-600">{r}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setPaso(0); setRespuestas({}); setMostrandoResultado(false); }}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              Repetir
            </button>
            <button onClick={onBack} className="flex-1 py-3 rounded-xl bg-gray-800 text-white text-sm font-bold hover:bg-gray-900 transition">
              Volver
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Cuestionario ──────────────────────────────────────────────────────────
  const progressPct = (paso / PREGUNTAS.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-700 to-gray-800 px-4 pt-10 pb-6 text-white">
        <button onClick={onBack} className="flex items-center gap-2 text-white/60 hover:text-white text-sm mb-4 transition">
          <ArrowLeft className="w-4 h-4"/> Volver
        </button>
        <div className="flex items-center gap-3 mb-1">
          <Monitor className="w-5 h-5 text-gray-300"/>
          <h1 className="text-xl font-black">Carga Visual</h1>
        </div>
        <div className="h-1.5 bg-white/20 rounded-full mt-3 overflow-hidden">
          <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }}/>
        </div>
        <p className="text-white/50 text-xs mt-1">{paso + 1} de {PREGUNTAS.length}</p>
      </div>

      <div className="p-4 max-w-md mx-auto pt-8">
        <h2 className="text-lg font-black text-gray-900 mb-6 leading-snug animate-[fadeInUp_0.3s_ease]">
          {pregunta.texto}
        </h2>

        <div className="space-y-3 animate-[fadeInUp_0.35s_ease]">
          {pregunta.opciones.map(op => (
            <button
              key={op.label}
              onClick={() => responder(op.valor)}
              className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 hover:border-indigo-300 hover:bg-indigo-50 transition text-left shadow-sm active:scale-98"
            >
              <span className="text-2xl flex-shrink-0">{op.icon}</span>
              <span className="text-base font-medium text-gray-800">{op.label}</span>
            </button>
          ))}
        </div>

        {paso > 0 && (
          <button
            onClick={() => setPaso(paso - 1)}
            className="mt-4 w-full text-center text-xs text-gray-400 hover:text-gray-600 transition py-2"
          >
            ← Pregunta anterior
          </button>
        )}
      </div>
    </div>
  );
}
