// =========================================
// TEST CROMÁTICO — Therapheye
// Test simplificado de visión cromática
// Inspirado en Ishihara pero sin placas originales
// Genera puntos con SVG en tiempo real
// =========================================

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Eye, AlertCircle } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { sql } from '../neonCliente';

interface Props { onBack: () => void; }

type DeficiencyType = 'normal' | 'protan' | 'deutan' | 'tritan' | 'acromato';
type Phase = 'instrucciones' | 'test' | 'resultado';

interface Placa {
  id: number;
  numero: number | null; // null = placa de "nada visible"
  colorFondo: string[];
  colorFigura: string[];
  deficiencia: DeficiencyType; // quien NO puede verla
}

// Colores en formato [r,g,b]
// Generamos pseudo-Ishihara: números escritos con puntos de diferente color
// Los que ven normal: ven el número. Daltónicos: no pueden.
const PLACAS: Placa[] = [
  { id: 1, numero: 12, colorFigura: ['#e53e3e','#c53030','#fc8181'], colorFondo: ['#68d391','#38a169','#9ae6b4'], deficiencia: 'deutan' },
  { id: 2, numero: 8,  colorFigura: ['#ed8936','#dd6b20','#fbd38d'], colorFondo: ['#68d391','#48bb78','#9ae6b4'], deficiencia: 'protan' },
  { id: 3, numero: 6,  colorFigura: ['#9f7aea','#805ad5','#d6bcfa'], colorFondo: ['#fc8181','#f56565','#fed7d7'], deficiencia: 'tritan' },
  { id: 4, numero: 29, colorFigura: ['#fc8181','#f56565','#fbb6ce'], colorFondo: ['#68d391','#48bb78','#a0aec0'], deficiencia: 'deutan' },
  { id: 5, numero: 45, colorFigura: ['#ed8936','#e53e3e','#f6ad55'], colorFondo: ['#9ae6b4','#68d391','#4fd1c5'], deficiencia: 'protan' },
  { id: 6, numero: 5,  colorFigura: ['#9f7aea','#6b46c1','#e9d8fd'], colorFondo: ['#fc8181','#e53e3e','#fed7d7'], deficiencia: 'tritan' },
  { id: 7, numero: 3,  colorFigura: ['#e53e3e','#c53030','#fc8181'], colorFondo: ['#a0aec0','#718096','#e2e8f0'], deficiencia: 'normal' }, // todos la ven
];

// Generate pseudo-ishihara dot plate with SVG
function generatePlateSVG(placa: Placa, size = 280): string {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.47;
  const dots: string[] = [];
  const NDOTS = 320;

  // Number shape mask — simplified bitmaps for numbers 0-9
  const numStr = placa.numero?.toString() ?? '';
  const getInNumber = (px: number, py: number): boolean => {
    // Normalize to 0-1 in a bounding box
    const nx = (px - cx) / radius;
    const ny = (py - cy) / radius;
    return isInDigitShape(numStr, nx, ny);
  };

  for (let i = 0; i < NDOTS; i++) {
    // Random position in circle
    const angle = Math.random() * 2 * Math.PI;
    const r = Math.sqrt(Math.random()) * radius * 0.92;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    const dotR = 5 + Math.random() * 7;

    const inFig = getInNumber(x, y);
    const colorArr = inFig ? placa.colorFigura : placa.colorFondo;
    const color = colorArr[Math.floor(Math.random() * colorArr.length)];

    dots.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${dotR.toFixed(1)}" fill="${color}" opacity="0.9"/>`);
  }

  return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <defs><clipPath id="cp"><circle cx="${cx}" cy="${cy}" r="${radius}"/></clipPath></defs>
    <g clip-path="url(#cp)">${dots.join('')}</g>
    <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#e2e8f0" stroke-width="2"/>
  </svg>`;
}

// Super-simplified digit shapes (returns true if x,y is inside the digit outline)
function isInDigitShape(str: string, nx: number, ny: number): boolean {
  if (!str) return false;
  // We'll check each digit with simple geometric shapes
  const segments: Array<[number, number, number, number]> = []; // rect segments [x1,y1,x2,y2]
  const digits = str.split('').slice(0, 2);

  for (let di = 0; di < digits.length; di++) {
    const d = digits[di];
    const ox = di === 0 && digits.length > 1 ? -0.38 : (digits.length > 1 ? 0.18 : 0);
    const pushSegs = (segs: Array<[number, number, number, number]>) => {
      segs.forEach(([x1, y1, x2, y2]) => segments.push([x1 + ox, y1, x2 + ox, y2]));
    };

    const W = 0.22; const H = 0.1; const T = 0.07;
    switch (d) {
      case '0': pushSegs([[-W,-H*3.5,W,-H*2.8],[-W,H*2.8,W,H*3.5],[-W-T,-H*3.5,-W,H*3.5],[W,-H*3.5,W+T,H*3.5]]); break;
      case '1': pushSegs([[0,-H*3.5,T*1.5,H*3.5]]); break;
      case '2': pushSegs([[-W,-H*3.5,W,-H*2.8],[-W,H*2.8,W,H*3.5],[-W,-H*0.3,W,H*0.3],[W,-H*3.5,W+T,-H*0.3],[-W-T,H*0.3,-W,H*3.5]]); break;
      case '3': pushSegs([[-W,-H*3.5,W,-H*2.8],[-W,H*2.8,W,H*3.5],[-W,-H*0.3,W,H*0.3],[W,-H*3.5,W+T,H*3.5]]); break;
      case '4': pushSegs([[-W-T,-H*3.5,-W,-H*0.3],[-W,-H*0.3,W+T,H*0.3],[W,-H*3.5,W+T,H*3.5]]); break;
      case '5': pushSegs([[-W,-H*3.5,W,-H*2.8],[-W,-H*0.3,W,H*0.3],[-W,H*2.8,W,H*3.5],[-W-T,-H*3.5,-W,-H*0.3],[W,H*0.3,W+T,H*3.5]]); break;
      case '6': pushSegs([[-W,-H*3.5,W,-H*2.8],[-W,-H*0.3,W,H*0.3],[-W,H*2.8,W,H*3.5],[-W-T,-H*3.5,-W,H*3.5],[W,H*0.3,W+T,H*3.5]]); break;
      case '7': pushSegs([[-W,-H*3.5,W+T,-H*2.8],[W,-H*2.8,W+T,H*3.5]]); break;
      case '8': pushSegs([[-W,-H*3.5,W,-H*2.8],[-W,-H*0.3,W,H*0.3],[-W,H*2.8,W,H*3.5],[-W-T,-H*3.5,-W,H*3.5],[W,-H*3.5,W+T,H*3.5]]); break;
      case '9': pushSegs([[-W,-H*3.5,W,-H*2.8],[-W,-H*0.3,W,H*0.3],[-W-T,-H*3.5,-W,-H*0.3],[W,-H*3.5,W+T,H*3.5]]); break;
    }
  }

  return segments.some(([x1, y1, x2, y2]) =>
    nx >= Math.min(x1,x2) - 0.08 && nx <= Math.max(x1,x2) + 0.08 &&
    ny >= Math.min(y1,y2) - 0.08 && ny <= Math.max(y1,y2) + 0.08
  );
}

export default function TestCromatico({ onBack }: Props) {
  const { user } = useUser();
  const [phase, setPhase] = useState<Phase>('instrucciones');
  const [placaIdx, setPlacaIdx] = useState(0);
  const [respuestas, setRespuestas] = useState<Array<{ placa: Placa; dicho: string | null; correcto: boolean }>>([]);
  const [input, setInput] = useState('');
  const [saved, setSaved] = useState(false);
  const svgCache = useRef<Map<number, string>>(new Map());

  // Pre-generate SVGs
  useEffect(() => {
    PLACAS.forEach(p => {
      if (!svgCache.current.has(p.id)) {
        svgCache.current.set(p.id, generatePlateSVG(p));
      }
    });
  }, []);

  const placa = PLACAS[placaIdx];

  const responder = (val: string | null) => {
    const esperado = placa.numero?.toString() ?? null;
    const correcto = val === esperado;
    const nuevas = [...respuestas, { placa, dicho: val, correcto }];
    setRespuestas(nuevas);
    setInput('');

    if (placaIdx + 1 >= PLACAS.length) {
      // Analyze results
      setPhase('resultado');
      if (user?.id) {
        const score = nuevas.filter(r => r.correcto).length;
        sql`CREATE TABLE IF NOT EXISTS test_cromatico (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          score INTEGER NOT NULL,
          total INTEGER NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`.catch(() => {});
        sql`INSERT INTO test_cromatico (user_id, score, total, created_at)
            VALUES (${user.id}, ${score}, ${PLACAS.length}, NOW())`
          .then(() => setSaved(true)).catch(() => {});
      }
    } else {
      setPlacaIdx(p => p + 1);
    }
  };

  const correctas = respuestas.filter(r => r.correcto).length;
  const pct = PLACAS.length ? Math.round((correctas / PLACAS.length) * 100) : 0;

  const getDeficiencyAnalysis = () => {
    const errores = respuestas.filter(r => !r.correcto);
    if (errores.length === 0) return { label: 'Visión cromática normal', color: 'emerald', desc: 'No se detectaron dificultades en la discriminación de colores.' };
    const protanErrs = errores.filter(r => r.placa.deficiencia === 'protan').length;
    const deutanErrs = errores.filter(r => r.placa.deficiencia === 'deutan').length;
    const tritanErrs = errores.filter(r => r.placa.deficiencia === 'tritan').length;
    if (errores.length <= 1) return { label: 'Posible variación leve', color: 'blue', desc: 'Un error puede deberse a la pantalla o condiciones de luz. Repite en otro momento.' };
    if (deutanErrs >= 2) return { label: 'Posible deuteranomalía', color: 'amber', desc: 'Dificultad con conos verdes (más común en hombres). Consulta con un optometrista para confirmación.' };
    if (protanErrs >= 2) return { label: 'Posible protanomalía', color: 'amber', desc: 'Dificultad con conos rojos. Puede afectar la percepción de rojos y naranjas.' };
    if (tritanErrs >= 1) return { label: 'Posible tritanomalía', color: 'red', desc: 'Dificultad con conos azules (rara). Se recomienda evaluación con oftalmólogo.' };
    return { label: 'Posibles dificultades cromáticas', color: 'amber', desc: 'Múltiples errores detectados. Las pantallas pueden afectar el resultado. Repite con un especialista.' };
  };

  if (phase === 'instrucciones') {
    return (
      <div className="min-h-screen bg-white">
        <div className="bg-gradient-to-r from-violet-600 to-purple-700 px-4 pt-10 pb-8 text-white">
          <button onClick={onBack} className="flex items-center gap-2 text-white/70 hover:text-white text-sm mb-6 transition">
            <ArrowLeft className="w-4 h-4"/> Volver
          </button>
          <div className="flex items-center gap-3">
            <Eye className="w-6 h-6 text-violet-200"/>
            <div>
              <h1 className="text-2xl font-black">Test Cromático</h1>
              <p className="text-violet-200 text-sm">Detección de daltonismo simplificada</p>
            </div>
          </div>
        </div>

        <div className="p-4 max-w-md mx-auto">
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5 mb-4">
            <h2 className="font-bold text-gray-900 mb-3">Instrucciones</h2>
            <div className="space-y-2 text-sm text-gray-600">
              <p>1. Se mostrarán placas con puntos de colores. Busca el <strong>número</strong> escondido.</p>
              <p>2. Escribe el número que ves, o "no veo nada" si no distingues ninguno.</p>
              <p>3. Usa buena iluminación y sin gafas de color/filtros de pantalla.</p>
              <p>4. El test tiene {PLACAS.length} placas y toma menos de 2 minutos.</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-5 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5"/>
            <p className="text-xs text-amber-700">Este test es orientativo y generado algorítmicamente. No reemplaza las placas de Ishihara certificadas que usa un optometrista.</p>
          </div>

          <button
            onClick={() => { setPlacaIdx(0); setRespuestas([]); setPhase('test'); }}
            className="w-full py-4 rounded-2xl bg-violet-600 text-white font-bold hover:bg-violet-700 transition"
          >
            Comenzar test
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'test') {
    const svg = svgCache.current.get(placa.id) ?? generatePlateSVG(placa);
    const progress = placaIdx / PLACAS.length;

    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <button onClick={() => setPhase('instrucciones')} className="text-gray-400 hover:text-gray-600 transition">
            <ArrowLeft className="w-5 h-5"/>
          </button>
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${progress * 100}%` }}/>
          </div>
          <span className="text-xs text-gray-400">{placaIdx + 1}/{PLACAS.length}</span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-4 py-6">
          <p className="text-gray-500 text-sm mb-4">¿Qué número ves?</p>

          {/* SVG plate */}
          <div
            className="w-full max-w-[280px] rounded-full overflow-hidden shadow-lg mb-6"
            dangerouslySetInnerHTML={{ __html: svg }}
          />

          {/* Input */}
          <input
            type="number"
            placeholder="Número (o deja vacío)"
            className="border-2 border-gray-200 rounded-2xl px-4 py-3 text-center text-2xl font-bold w-32 focus:outline-none focus:border-violet-400 mb-4"
            value={input}
            onChange={e => setInput(e.target.value)}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') responder(input.trim() || null); }}
          />

          <div className="flex gap-3 w-full max-w-sm">
            <button
              onClick={() => responder(null)}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition"
            >
              No veo nada
            </button>
            <button
              onClick={() => responder(input.trim() || null)}
              className="flex-1 py-3 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 transition"
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Resultado
  const analysis = getDeficiencyAnalysis();
  const bgMap: Record<string, string> = { emerald: 'from-emerald-500 to-teal-500', blue: 'from-blue-500 to-indigo-500', amber: 'from-amber-500 to-orange-500', red: 'from-red-500 to-rose-600' };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-violet-600 to-purple-700 px-4 pt-10 pb-8 text-white">
        <button onClick={onBack} className="flex items-center gap-2 text-white/70 hover:text-white text-sm mb-4 transition">
          <ArrowLeft className="w-4 h-4"/> Volver
        </button>
        <h1 className="text-2xl font-black">Resultado</h1>
        <p className="text-violet-200 text-sm">Test cromático</p>
      </div>

      <div className="p-4 max-w-md mx-auto">
        <div className={`bg-gradient-to-br ${bgMap[analysis.color]} text-white rounded-3xl p-6 text-center mb-4 animate-[bounceIn_0.5s_ease]`}>
          <p className="text-white/80 text-sm mb-2">Resultado</p>
          <p className="text-3xl font-black mb-1">{correctas} / {PLACAS.length}</p>
          <p className="text-lg font-bold">{analysis.label}</p>
          <p className="text-white/70 text-sm mt-2">{pct}% de aciertos</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
          <p className="text-sm text-gray-700 leading-relaxed">{analysis.desc}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50 mb-4">
          {respuestas.map((r, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <span className="text-xl">{r.correcto ? '✅' : '❌'}</span>
              <div className="flex-1">
                <p className="text-sm text-gray-700">Placa {i + 1}: esperado <strong>{r.placa.numero ?? 'nada'}</strong>, dijiste <strong>{r.dicho ?? 'nada'}</strong></p>
              </div>
            </div>
          ))}
        </div>

        {saved && <p className="text-center text-xs text-emerald-600 mb-3">✓ Resultado guardado</p>}

        <div className="flex gap-3">
          <button onClick={() => { setPlacaIdx(0); setRespuestas([]); setPhase('test'); setSaved(false); }}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
            Repetir
          </button>
          <button onClick={onBack} className="flex-1 py-3 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 transition">
            Volver
          </button>
        </div>
      </div>
    </div>
  );
}
