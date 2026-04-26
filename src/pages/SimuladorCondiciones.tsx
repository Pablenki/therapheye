// =========================================
// SIMULADOR DE CONDICIONES VISUALES — Therapheye
// Simula cómo ve una persona con miopía,
// hipermetropía, astigmatismo, cataratas, etc.
// Usando filtros CSS y canvas
// =========================================

import { useState } from 'react';
import { ArrowLeft, Eye, Info } from 'lucide-react';

interface Props { onBack: () => void; }

interface Condicion {
  id: string;
  nombre: string;
  descripcion: string;
  prevalencia: string;
  filtro: string;          // CSS filter
  transform?: string;
  extraStyle?: React.CSSProperties;
  icon: string;
}

const CONDICIONES: Condicion[] = [
  {
    id: 'normal',
    nombre: 'Visión normal 20/20',
    descripcion: 'Visión sin defectos refractivos significativos. La imagen se enfoca perfectamente en la retina.',
    prevalencia: 'Aprox. 35% de adultos',
    filtro: 'none',
    icon: '✅',
  },
  {
    id: 'miopia',
    nombre: 'Miopía (visión lejana borrosa)',
    descripcion: 'El globo ocular es demasiado largo o la córnea muy curva. Las imágenes distantes se enfocan delante de la retina. Afecta más del 30% de la población mundial.',
    prevalencia: '~30% de la población',
    filtro: 'blur(3px)',
    icon: '🔭',
  },
  {
    id: 'miopia-severa',
    nombre: 'Miopía severa (>-6D)',
    descripcion: 'Miopía de alta graduación. Solo se puede ver con nitidez a pocos centímetros. Alta prevalencia en Asia Oriental (hasta 80% en Singapur).',
    prevalencia: '~10% de miopes',
    filtro: 'blur(7px)',
    icon: '🌫️',
  },
  {
    id: 'hipermetropia',
    nombre: 'Hipermetropía (visión cercana borrosa)',
    descripcion: 'El globo ocular es demasiado corto. Los objetos cercanos se enfocan detrás de la retina. Muy común en niños, muchos lo compensan con acomodación.',
    prevalencia: '~25% de adultos',
    filtro: 'blur(2px) brightness(1.05)',
    icon: '📖',
  },
  {
    id: 'astigmatismo',
    nombre: 'Astigmatismo',
    descripcion: 'La córnea tiene curvatura irregular (como un balón de rugby). Produce visión distorsionada en todas las distancias, con "halos" o estiramiento de imágenes.',
    prevalencia: '~40% de la población',
    filtro: 'blur(1.5px)',
    extraStyle: { transform: 'scaleX(1.04) scaleY(0.97)' },
    icon: '🌀',
  },
  {
    id: 'cataratas',
    nombre: 'Cataratas',
    descripcion: 'El cristalino se vuelve opaco, generalmente por envejecimiento. La visión se vuelve nublada, con reducción del contraste y sensibilidad a la luz brillante.',
    prevalencia: '>50% de mayores de 65 años',
    filtro: 'blur(1px) brightness(1.3) saturate(0.4) contrast(0.7)',
    icon: '☁️',
  },
  {
    id: 'glaucoma',
    nombre: 'Glaucoma (visión tubular)',
    descripcion: 'La presión intraocular daña el nervio óptico. Se pierde el campo visual periférico progresivamente. Segunda causa de ceguera en el mundo.',
    prevalencia: '~2% de mayores de 40',
    filtro: 'none',
    extraStyle: {
      maskImage: 'radial-gradient(ellipse 45% 45% at 50% 50%, black 100%, transparent 100%)',
      WebkitMaskImage: 'radial-gradient(ellipse 45% 45% at 50% 50%, black 100%, transparent 100%)',
    },
    icon: '🔵',
  },
  {
    id: 'retinitis',
    nombre: 'Retinitis Pigmentosa',
    descripcion: 'Enfermedad hereditaria que destruye los fotorreceptores periféricos (bastones). Visión tubular progresiva, dificultad en oscuridad, pérdida de visión nocturna.',
    prevalencia: '1 en 4,000 personas',
    filtro: 'brightness(0.6) saturate(0.5)',
    extraStyle: {
      maskImage: 'radial-gradient(ellipse 30% 30% at 50% 50%, black 100%, transparent 100%)',
      WebkitMaskImage: 'radial-gradient(ellipse 30% 30% at 50% 50%, black 100%, transparent 100%)',
    },
    icon: '🌑',
  },
  {
    id: 'daltonismo',
    nombre: 'Daltonismo (rojo-verde)',
    descripcion: 'Deficiencia en los conos que perciben rojo o verde. Los colores se perciben con menos saturación y pueden confundirse. 8% de hombres, 0.5% de mujeres.',
    prevalencia: '8% de hombres',
    filtro: 'saturate(0.3) hue-rotate(30deg)',
    icon: '🎨',
  },
  {
    id: 'amd',
    nombre: 'Degeneración Macular AMD',
    descripcion: 'Deterioro de la mácula central. Se pierde la visión central nítida necesaria para leer y reconocer caras. La periférica permanece. Primera causa de ceguera >65 años.',
    prevalencia: '~10% de mayores de 65',
    filtro: 'blur(0.5px)',
    extraStyle: {
      maskImage: 'radial-gradient(ellipse 20% 20% at 50% 50%, transparent 100%, black 100%)',
      WebkitMaskImage: 'radial-gradient(ellipse 20% 20% at 50% 50%, transparent 100%, black 100%)',
    },
    icon: '🕳️',
  },
];

const TEXTO_DEMO = `El rápido zorro marrón salta sobre el perro perezoso.
Therapheye te ayuda a monitorear tu salud visual.

AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz

Columna A    Columna B    Columna C
Línea 1      Texto 1      Datos 1
Línea 2      Texto 2      Datos 2

1234567890   !@#$%^&*()   Números y símbolos`;

export default function SimuladorCondiciones({ onBack }: Props) {
  const [condicion, setCondicion] = useState<Condicion>(CONDICIONES[0]);
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 px-4 pt-10 pb-4 flex-shrink-0">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition">
          <ArrowLeft className="w-4 h-4"/> Volver
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5 text-indigo-400"/>
            <h1 className="text-white font-black text-lg">Simulador Visual</h1>
          </div>
          <button
            onClick={() => setShowInfo(v => !v)}
            className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center hover:bg-gray-600 transition"
          >
            <Info className="w-4 h-4 text-gray-300"/>
          </button>
        </div>
      </div>

      {/* Info panel */}
      {showInfo && (
        <div className="mx-4 bg-indigo-900/40 border border-indigo-700/40 rounded-2xl p-4 animate-[fadeInUp_0.2s_ease]">
          <h3 className="text-indigo-300 font-bold text-sm mb-1">{condicion.nombre}</h3>
          <p className="text-indigo-200 text-xs leading-relaxed mb-1">{condicion.descripcion}</p>
          <p className="text-indigo-400 text-xs">Prevalencia: {condicion.prevalencia}</p>
        </div>
      )}

      {/* Demo area */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <div className="w-full max-w-lg">
          <p className="text-gray-600 text-xs text-center mb-2">{condicion.icon} {condicion.nombre}</p>
          <div
            className="bg-white rounded-2xl p-5 transition-all duration-500"
            style={{
              filter: condicion.filtro,
              ...condicion.extraStyle,
            }}
          >
            <h2 className="text-gray-900 font-black text-xl mb-3">Vista previa</h2>
            <pre className="text-gray-700 text-sm font-sans whitespace-pre-wrap leading-relaxed">
              {TEXTO_DEMO}
            </pre>
            <div className="mt-4 flex gap-3">
              <div className="w-8 h-8 rounded-full bg-red-500"/>
              <div className="w-8 h-8 rounded-full bg-green-500"/>
              <div className="w-8 h-8 rounded-full bg-blue-500"/>
              <div className="w-8 h-8 rounded-full bg-yellow-400"/>
              <div className="w-8 h-8 rounded-full bg-orange-500"/>
              <div className="w-8 h-8 rounded-full" style={{ background: '#8B4513' }}/>
            </div>
          </div>
        </div>
      </div>

      {/* Condition selector */}
      <div className="bg-gray-800 border-t border-gray-700 p-3 flex-shrink-0">
        <p className="text-gray-500 text-xs mb-2 px-1">Selecciona condición:</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CONDICIONES.map(c => (
            <button
              key={c.id}
              onClick={() => setCondicion(c)}
              className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition text-center ${
                condicion.id === c.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <span className="text-lg">{c.icon}</span>
              <span className="text-[9px] font-medium leading-tight max-w-[56px]">
                {c.nombre.split('(')[0].trim().split(' ').slice(0, 2).join(' ')}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
