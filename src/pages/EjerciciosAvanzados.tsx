// =========================================
// EJERCICIOS AVANZADOS — Therapheye
// Colección de ejercicios especializados
// para condiciones específicas (estrabismo,
// ambliopia, nistagmo, fatiga digital)
// =========================================

import { useState } from 'react';
import { ArrowLeft, Play, Info, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  onBack: () => void;
  onStartExercise: (id: string) => void;
}

interface EjercicioAvanzado {
  id: string;
  nombre: string;
  categoria: string;
  objetivo: string;
  duracion: string;
  indicaciones: string[];
  contraindicaciones: string;
  evidencia: 'alta' | 'moderada' | 'emergente';
  icon: string;
}

const EJERCICIOS: EjercicioAvanzado[] = [
  {
    id: 'palming',
    nombre: 'Palming avanzado',
    categoria: 'Relajación',
    objetivo: 'Relajación completa del nervio óptico y músculos ciliares',
    duracion: '5-10 min',
    indicaciones: ['Fatiga digital', 'Dolor de cabeza ocular', 'Tensión muscular ocular', 'Estrés visual'],
    contraindicaciones: 'Sin contraindicaciones conocidas',
    evidencia: 'moderada',
    icon: '🤲',
  },
  {
    id: 'seguimiento',
    nombre: 'Rastreo suave (smooth pursuit)',
    categoria: 'Control oculomotor',
    objetivo: 'Mejora del control de movimientos oculares de seguimiento',
    duracion: '3-5 min',
    indicaciones: ['Dificultad de lectura', 'Mareos al seguir objetos', 'Post-concusión leve'],
    contraindicaciones: 'Consultar médico si hay historia de concusión grave',
    evidencia: 'alta',
    icon: '👁',
  },
  {
    id: 'enfoque',
    nombre: 'Flip lens accommodation',
    categoria: 'Acomodación',
    objetivo: 'Flexibilidad acomodativa y antisupresión',
    duracion: '4-6 min',
    indicaciones: ['Presbicia incipiente', 'Fatiga al leer', 'Insuficiencia de acomodación'],
    contraindicaciones: 'No recomendado con estrabismo sin guía de especialista',
    evidencia: 'alta',
    icon: '🔭',
  },
  {
    id: 'rotacion',
    nombre: 'Rotaciones oculares completas',
    categoria: 'Motilidad ocular',
    objetivo: 'Amplitud de movimiento de los 6 músculos extraoculares',
    duracion: '3-4 min',
    indicaciones: ['Tensión muscular periorbital', 'Rigidez ocular', 'Cefalea tensional'],
    contraindicaciones: 'Precaución en desprendimiento de retina previo',
    evidencia: 'moderada',
    icon: '🔄',
  },
  {
    id: 'parpadeo',
    nombre: 'Parpadeo consciente 20-20-20',
    categoria: 'Lubricación',
    objetivo: 'Distribución del film lagrimal, prevención ojo seco',
    duracion: 'Toda la jornada',
    indicaciones: ['Ojo seco', 'Fatiga digital', 'Trabajo prolongado con pantallas', 'Lentes de contacto'],
    contraindicaciones: 'Sin contraindicaciones',
    evidencia: 'alta',
    icon: '👁',
  },
  {
    id: 'figura-ocho',
    nombre: 'Figura en ocho',
    categoria: 'Coordinación',
    objetivo: 'Coordinación binocular y movimientos oculares en 8',
    duracion: '3 min',
    indicaciones: ['Coordinación ojo-mano', 'Dificultades de lectura', 'Terapia visual infantil'],
    contraindicaciones: 'Sin contraindicaciones conocidas',
    evidencia: 'moderada',
    icon: '∞',
  },
];

const CAT_COLORS: Record<string, string> = {
  'Relajación': 'bg-blue-100 text-blue-700',
  'Control oculomotor': 'bg-violet-100 text-violet-700',
  'Acomodación': 'bg-teal-100 text-teal-700',
  'Motilidad ocular': 'bg-indigo-100 text-indigo-700',
  'Lubricación': 'bg-cyan-100 text-cyan-700',
  'Coordinación': 'bg-purple-100 text-purple-700',
};

const EVD_COLORS: Record<string, string> = {
  alta: 'text-emerald-600 bg-emerald-50',
  moderada: 'text-amber-600 bg-amber-50',
  emergente: 'text-blue-600 bg-blue-50',
};

export default function EjerciciosAvanzados({ onBack, onStartExercise }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<string>('Todos');

  const categorias = ['Todos', ...Array.from(new Set(EJERCICIOS.map(e => e.categoria)))];
  const filtrados = filterCat === 'Todos' ? EJERCICIOS : EJERCICIOS.filter(e => e.categoria === filterCat);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-700 to-violet-800 px-4 pt-10 pb-8 text-white">
        <button onClick={onBack} className="flex items-center gap-2 text-white/70 hover:text-white text-sm mb-6 transition">
          <ArrowLeft className="w-4 h-4"/> Volver
        </button>
        <h1 className="text-2xl font-black">Ejercicios Avanzados</h1>
        <p className="text-indigo-200 text-sm mt-1">Protocolos de terapia visual basados en evidencia</p>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-3 mb-4 flex items-start gap-2 text-xs text-indigo-700">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5"/>
          <p>Estos ejercicios están basados en literatura de optometría y visión clínica. Para condiciones específicas, consulta a un especialista en terapia visual.</p>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
          {categorias.map(cat => (
            <button key={cat} onClick={() => setFilterCat(cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                filterCat === cat ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-500'
              }`}>
              {cat}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filtrados.map(ej => {
            const isExp = expandedId === ej.id;
            return (
              <div key={ej.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExp ? null : ej.id)}
                  className="w-full flex items-center gap-3 p-4 text-left"
                >
                  <span className="text-2xl flex-shrink-0">{ej.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-bold text-gray-900 text-sm">{ej.nombre}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${EVD_COLORS[ej.evidencia]}`}>
                        EV {ej.evidencia}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CAT_COLORS[ej.categoria] ?? 'bg-gray-100 text-gray-600'}`}>
                        {ej.categoria}
                      </span>
                      <span className="text-xs text-gray-400">{ej.duracion}</span>
                    </div>
                  </div>
                  {isExp ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0"/> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0"/>}
                </button>

                {isExp && (
                  <div className="px-4 pb-4 animate-[fadeInUp_0.2s_ease]">
                    <p className="text-sm text-gray-700 mb-3 leading-relaxed">{ej.objetivo}</p>

                    <div className="mb-3">
                      <p className="text-xs font-bold text-gray-500 mb-1.5">Indicado para:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {ej.indicaciones.map(ind => (
                          <span key={ind} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                            {ind}
                          </span>
                        ))}
                      </div>
                    </div>

                    <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2 mb-3">
                      ⚠️ {ej.contraindicaciones}
                    </p>

                    <button
                      onClick={() => { onStartExercise(ej.id); }}
                      className="w-full py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4"/> Iniciar ejercicio
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6 mb-8">
          Evidencia: Alta = múltiples ensayos clínicos · Moderada = series de casos · Emergente = evidencia preliminar
        </p>
      </div>
    </div>
  );
}
