// =========================================
// TEST DE ACOMODACIÓN — Therapheye
// Mide el punto próximo de acomodación (PPA)
// El usuario acerca un texto hasta que se pone borroso
// =========================================

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, AlertCircle, Eye } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { sql } from '../neonCliente';

interface Props { onBack: () => void; }

type Phase = 'instrucciones' | 'calibracion' | 'test' | 'resultado';
type Ojo = 'ambos' | 'derecho' | 'izquierdo';

const TEXTO_TEST = 'El rápido zorro marrón salta sobre el perro perezoso. AaBbCcDdEe 1234567890';

function getPPALabel(cm: number): { label: string; color: string; desc: string; edad: string } {
  if (cm <= 7)  return { label: 'Excelente', color: 'emerald', desc: 'Acomodación joven y flexible. Punto próximo muy cerca.', edad: 'Típico de menores de 25 años' };
  if (cm <= 12) return { label: 'Normal', color: 'blue', desc: 'Acomodación dentro del rango normal.', edad: 'Típico de 25-40 años' };
  if (cm <= 20) return { label: 'Reducida', color: 'amber', desc: 'Acomodación ligeramente reducida. Puede indicar inicio de presbicia.', edad: 'Típico de 40-50 años' };
  if (cm <= 35) return { label: 'Presbicia moderada', color: 'orange', desc: 'Reducción significativa de la acomodación. Puede necesitar lentes de lectura.', edad: 'Típico de 50-60 años' };
  return { label: 'Presbicia avanzada', color: 'red', desc: 'Acomodación muy limitada. Típica en adultos mayores.', edad: 'Típico de mayores de 60 años' };
}

export default function TestAcomodacion({ onBack }: Props) {
  const { user } = useUser();
  const [phase, setPhase] = useState<Phase>('instrucciones');
  const [ojo, setOjo] = useState<Ojo>('ambos');
  const [distanciaEstimada, setDistanciaEstimada] = useState(30); // cm
  const [, setBorroso] = useState(false);
  const [resultado, setResultado] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  // Animated "approaching" text
  const [scale, setScale] = useState(1);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scaleRef = useRef(1);

  const startApproach = () => {
    scaleRef.current = 1;
    setScale(1);
    setDistanciaEstimada(40);
    setPhase('test');
    animRef.current = setInterval(() => {
      scaleRef.current = Math.min(scaleRef.current + 0.012, 2.8);
      setScale(scaleRef.current);
      // Estimate distance based on scale (40cm at scale 1, ~8cm at scale 2.8)
      const dist = Math.round(40 / scaleRef.current);
      setDistanciaEstimada(dist);
    }, 100);
  };

  const markBorroso = () => {
    if (animRef.current) clearInterval(animRef.current);
    const dist = Math.round(40 / scaleRef.current);
    setResultado(dist);
    setBorroso(true);
    setPhase('resultado');

    if (user?.id) {
      sql`INSERT INTO test_acomodacion (user_id, ojo, ppa_cm, created_at)
          VALUES (${user.id}, ${ojo}, ${dist}, NOW())`
        .then(() => setSaved(true)).catch(() => {});
    }
  };

  useEffect(() => () => { if (animRef.current) clearInterval(animRef.current); }, []);

  const res = resultado !== null ? getPPALabel(resultado) : null;

  // ── Instrucciones ──────────────────────────────────────────────────────────
  if (phase === 'instrucciones') {
    return (
      <div className="min-h-screen bg-white">
        <div className="bg-gradient-to-r from-cyan-600 to-teal-700 px-4 pt-10 pb-8 text-white">
          <button onClick={onBack} className="flex items-center gap-2 text-white/70 hover:text-white text-sm mb-6 transition">
            <ArrowLeft className="w-4 h-4"/> Volver
          </button>
          <div className="flex items-center gap-3">
            <Eye className="w-6 h-6 text-cyan-100"/>
            <div>
              <h1 className="text-2xl font-black">Test de Acomodación</h1>
              <p className="text-cyan-100 text-sm">Punto Próximo de Acomodación (PPA)</p>
            </div>
          </div>
        </div>

        <div className="p-4 max-w-md mx-auto">
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5 mb-4">
            <h2 className="font-bold text-gray-900 mb-3">¿Qué mide este test?</h2>
            <p className="text-sm text-gray-600 mb-3 leading-relaxed">
              El <strong>Punto Próximo de Acomodación</strong> es la distancia más corta a la que puedes enfocar
              un objeto con nitidez. Con la edad, el cristalino pierde flexibilidad (presbicia) y este punto se aleja.
            </p>
            <div className="space-y-2 text-sm text-gray-600">
              <p>1. Colócate a <strong>40cm</strong> de la pantalla con buena iluminación.</p>
              <p>2. Cubre el ojo que no vas a probar (o prueba con ambos abiertos).</p>
              <p>3. El texto se "acercará" lentamente. Cuando se ponga <strong>borroso o doble</strong>, toca el botón rojo.</p>
              <p>4. Usa corrección óptica si la tienes (gafas o lentes de contacto).</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-5 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5"/>
            <p className="text-xs text-amber-700">El resultado depende de la distancia real a la pantalla. Intenta estar a aproximadamente 40cm para obtener una estimación más precisa.</p>
          </div>

          <p className="text-sm font-bold text-gray-700 mb-2">Ojo a probar:</p>
          <div className="flex gap-2 mb-5">
            {([['ambos', 'Ambos ojos'], ['derecho', 'Ojo derecho'], ['izquierdo', 'Ojo izquierdo']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setOjo(v)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition border-2 ${ojo === v ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                {l}
              </button>
            ))}
          </div>

          <button onClick={startApproach} className="w-full py-4 rounded-2xl bg-cyan-600 text-white font-bold hover:bg-cyan-700 transition">
            Comenzar test
          </button>
        </div>
      </div>
    );
  }

  // ── Test activo ────────────────────────────────────────────────────────────
  if (phase === 'test') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
        <p className="text-gray-400 text-sm mb-2">Distancia estimada: ~{distanciaEstimada}cm</p>
        <p className="text-gray-300 text-xs mb-8">Toca el botón cuando el texto se ponga borroso</p>

        {/* Animated approaching text */}
        <div
          className="max-w-[280px] text-gray-800 font-serif leading-relaxed text-center transition-none select-none"
          style={{ fontSize: `${14 * scale}px`, transform: `scale(${Math.min(scale, 1.5)})` }}
        >
          {TEXTO_TEST}
        </div>

        <div className="mt-16 space-y-3 w-full max-w-xs">
          <button
            onClick={markBorroso}
            className="w-full py-5 rounded-2xl bg-red-500 text-white font-black text-lg hover:bg-red-600 transition active:scale-95 shadow-lg shadow-red-200"
          >
            ¡Ya se ve borroso!
          </button>
          <button
            onClick={() => { if (animRef.current) clearInterval(animRef.current); setPhase('instrucciones'); }}
            className="w-full py-2 text-gray-400 text-sm hover:text-gray-600 transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  // ── Resultado ─────────────────────────────────────────────────────────────
  const colorBg: Record<string, string> = {
    emerald: 'from-emerald-500 to-teal-500',
    blue: 'from-blue-500 to-cyan-500',
    amber: 'from-amber-500 to-yellow-500',
    orange: 'from-orange-500 to-amber-600',
    red: 'from-red-500 to-rose-600',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-cyan-600 to-teal-700 px-4 pt-10 pb-8 text-white">
        <button onClick={onBack} className="flex items-center gap-2 text-white/70 hover:text-white text-sm mb-4 transition">
          <ArrowLeft className="w-4 h-4"/> Volver
        </button>
        <h1 className="text-2xl font-black">Resultado</h1>
      </div>

      <div className="p-4 max-w-md mx-auto">
        <div className={`bg-gradient-to-br ${colorBg[res!.color]} text-white rounded-3xl p-6 text-center mb-4 animate-[bounceIn_0.5s_ease]`}>
          <p className="text-white/70 text-sm mb-1">Punto Próximo de Acomodación</p>
          <p className="text-5xl font-black mb-1">~{resultado}<span className="text-2xl font-normal ml-1">cm</span></p>
          <p className="text-lg font-bold">{res!.label}</p>
          <p className="text-white/70 text-xs mt-1">{res!.edad}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
          <p className="text-sm text-gray-700 leading-relaxed mb-3">{res!.desc}</p>
          <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500">
            <p className="font-semibold text-gray-700 mb-1">Valores de referencia:</p>
            <div className="space-y-0.5">
              <p>• &lt;7cm → Menores de 25 años</p>
              <p>• 7-12cm → 25-40 años</p>
              <p>• 12-20cm → 40-50 años (inicio presbicia)</p>
              <p>• &gt;20cm → Más de 50 años (presbicia)</p>
            </div>
          </div>
        </div>

        <div className="bg-cyan-50 border border-cyan-100 rounded-2xl p-4 mb-4 text-xs text-cyan-700">
          <strong>Nota:</strong> Este test depende de tu distancia real a la pantalla. Para una medición precisa, usa la regla de tu dedo meñique (distancia al mentón ≈ la de la pantalla).
        </div>

        {saved && <p className="text-center text-xs text-emerald-600 mb-3">✓ Guardado en tu historial</p>}

        <div className="flex gap-3">
          <button onClick={() => { setPhase('instrucciones'); setResultado(null); setSaved(false); setBorroso(false); }}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
            Repetir
          </button>
          <button onClick={onBack} className="flex-1 py-3 rounded-xl bg-cyan-600 text-white text-sm font-bold hover:bg-cyan-700 transition">
            Volver
          </button>
        </div>
      </div>
    </div>
  );
}
