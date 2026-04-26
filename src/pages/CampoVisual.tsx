// =========================================
// TEST DE CAMPO VISUAL PERIFÉRICO — Therapheye
// Detecta zonas ciegas o limitadas en el campo visual
// Un punto fijo en el centro, destellos en la periferia
// El usuario presiona ESPACIO cuando detecta el destello
// =========================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Eye, Play, RotateCcw, CheckCircle2, Info } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { sql, localISOString } from '../neonCliente';

interface Props { onBack: () => void }

type Phase = 'instrucciones' | 'calibracion' | 'test' | 'resultado';

interface Destello {
  x: number; // % from left
  y: number; // % from top
  detected: boolean;
  reactionMs: number | null;
  angulo: number; // grados desde el centro
  cuadrante: 'sup-izq' | 'sup-der' | 'inf-izq' | 'inf-der';
}

const TOTAL_DESTELLOS = 40;
const DESTELLO_DURATION_MS = 300;
const INTER_STIMULUS_MS = 900; // pausa entre destellos
const MAX_REACTION_MS = 1000; // si no responde en 1s, no detectado

const getCuadrante = (x: number, y: number): Destello['cuadrante'] => {
  if (x < 50 && y < 50) return 'sup-izq';
  if (x >= 50 && y < 50) return 'sup-der';
  if (x < 50 && y >= 50) return 'inf-izq';
  return 'inf-der';
};

const calcAngulo = (x: number, y: number) => {
  const dx = x - 50, dy = y - 50;
  return Math.sqrt(dx * dx + dy * dy) * 0.9; // aprox en grados
};

const generarDestellos = (): Omit<Destello, 'detected' | 'reactionMs'>[] => {
  const list: Omit<Destello, 'detected' | 'reactionMs'>[] = [];
  // Distribuir uniformemente en la periferia
  for (let i = 0; i < TOTAL_DESTELLOS; i++) {
    // Radio entre 25% y 48% del centro (periferia real)
    const radio = 25 + Math.random() * 23;
    const angRad = (Math.random() * 360) * (Math.PI / 180);
    const x = 50 + radio * Math.cos(angRad);
    const y = 50 + radio * Math.sin(angRad) * 0.7; // ajuste aspect ratio
    list.push({
      x: Math.max(5, Math.min(95, x)),
      y: Math.max(5, Math.min(95, y)),
      angulo: calcAngulo(x, y),
      cuadrante: getCuadrante(x, y),
    });
  }
  // Shuffle
  return list.sort(() => Math.random() - 0.5);
};

const CUADRANTE_LABEL: Record<Destello['cuadrante'], string> = {
  'sup-izq': 'Superior izquierdo',
  'sup-der': 'Superior derecho',
  'inf-izq': 'Inferior izquierdo',
  'inf-der': 'Inferior derecho',
};

export default function CampoVisual({ onBack }: Props) {
  const { user } = useUser();
  const [phase, setPhase] = useState<Phase>('instrucciones');
  const [destellos, setDestellos] = useState<Omit<Destello, 'detected' | 'reactionMs'>[]>([]);
  const [resultados, setResultados] = useState<Destello[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showDestello, setShowDestello] = useState(false);
  const [waitingResponse, setWaitingResponse] = useState(false);
  const [destelloStart, setDestelloStart] = useState(0);
  const [showFixation, setShowFixation] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [ojoActivo, setOjoActivo] = useState<'ambos' | 'izquierdo' | 'derecho'>('ambos');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const clearTimer = () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };

  const registrarRespuesta = useCallback((detected: boolean, reactionMs: number | null) => {
    clearTimer();
    setShowDestello(false);
    setWaitingResponse(false);
    setResultados(prev => [...prev, {
      ...destellos[currentIdx],
      detected,
      reactionMs,
    }]);
    setProgreso(Math.round(((currentIdx + 1) / destellos.length) * 100));
    setCurrentIdx(prev => prev + 1);
  }, [currentIdx, destellos]);

  // Avanzar al siguiente destello
  useEffect(() => {
    if (phase !== 'test') return;
    if (currentIdx >= destellos.length) {
      setPhase('resultado');
      guardarResultado();
      return;
    }
    const timer = setTimeout(() => {
      setShowDestello(true);
      setWaitingResponse(true);
      setDestelloStart(Date.now());
      // Timeout si no responde
      timeoutRef.current = setTimeout(() => {
        registrarRespuesta(false, null);
      }, DESTELLO_DURATION_MS + MAX_REACTION_MS);
      // Ocultar destello después de su duración
      setTimeout(() => setShowDestello(false), DESTELLO_DURATION_MS);
    }, INTER_STIMULUS_MS);
    return () => clearTimeout(timer);
  }, [currentIdx, phase, destellos.length]);

  // Tecla espacio para responder
  useEffect(() => {
    if (phase !== 'test') return;
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' && waitingResponse) {
        e.preventDefault();
        registrarRespuesta(true, Date.now() - destelloStart);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, waitingResponse, destelloStart, registrarRespuesta]);

  const iniciarTest = () => {
    const d = generarDestellos();
    setDestellos(d);
    setResultados([]);
    setCurrentIdx(0);
    setProgreso(0);
    setShowFixation(true);
    setPhase('test');
  };

  const guardarResultado = async () => {
    if (!user?.id) return;
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS campo_visual_tests (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          ojo TEXT NOT NULL,
          total_destellos INT,
          detectados INT,
          tasa_deteccion FLOAT,
          tiempo_reaccion_avg FLOAT,
          resultados_json JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
    } catch {}
    try {
      const detectados = resultados.filter(r => r.detected).length + 1; // +1 por el último que aún no se contó
      const tiempos = resultados.filter(r => r.reactionMs !== null).map(r => r.reactionMs!);
      const avgReaction = tiempos.length > 0 ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : 0;
      await sql`
        INSERT INTO campo_visual_tests (user_id, ojo, total_destellos, detectados, tasa_deteccion, tiempo_reaccion_avg, resultados_json, created_at)
        VALUES (${user.id}, ${ojoActivo}, ${TOTAL_DESTELLOS}, ${detectados}, ${detectados / TOTAL_DESTELLOS}, ${Math.round(avgReaction)}, ${JSON.stringify(resultados)}, ${localISOString()})
      `;
    } catch (e) { console.warn('Error guardando campo visual:', e); }
  };

  // ── Cálculo de resultados ──────────────────────────────────────────────────
  const getAnalisis = () => {
    const total = resultados.length;
    const detectados = resultados.filter(r => r.detected).length;
    const tasa = total > 0 ? detectados / total : 0;
    const tiempos = resultados.filter(r => r.reactionMs !== null).map(r => r.reactionMs!);
    const avgReaction = tiempos.length > 0 ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length) : 0;

    // Por cuadrante
    const byCuadrante: Record<string, { total: number; detectados: number }> = {};
    resultados.forEach(r => {
      if (!byCuadrante[r.cuadrante]) byCuadrante[r.cuadrante] = { total: 0, detectados: 0 };
      byCuadrante[r.cuadrante].total++;
      if (r.detected) byCuadrante[r.cuadrante].detectados++;
    });

    // Detectar zonas problemáticas (< 60% detección)
    const zonasProblem = Object.entries(byCuadrante)
      .filter(([, v]) => v.total > 0 && v.detectados / v.total < 0.6)
      .map(([k]) => CUADRANTE_LABEL[k as Destello['cuadrante']]);

    let nivel: 'normal' | 'leve' | 'moderado' | 'severo';
    let color: string;
    if (tasa >= 0.85) { nivel = 'normal'; color = 'text-emerald-600'; }
    else if (tasa >= 0.70) { nivel = 'leve'; color = 'text-amber-600'; }
    else if (tasa >= 0.55) { nivel = 'moderado'; color = 'text-orange-600'; }
    else { nivel = 'severo'; color = 'text-red-600'; }

    return { total, detectados, tasa, avgReaction, byCuadrante, zonasProblem, nivel, color };
  };

  if (phase === 'instrucciones') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-xl transition"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center"><Eye className="w-5 h-5 text-white" /></div>
            <div><h1 className="text-lg font-bold text-gray-900">Campo Visual</h1><p className="text-xs text-gray-500">Test periférico</p></div>
          </div>
        </div>
        <div className="max-w-md mx-auto px-4 py-8 flex flex-col gap-5">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
            <h2 className="font-bold text-blue-800 mb-2 flex items-center gap-2"><Info className="w-4 h-4" /> ¿Qué es este test?</h2>
            <p className="text-sm text-blue-700 leading-relaxed">Evalúa tu campo visual periférico detectando si hay zonas donde tu visión es limitada. No reemplaza un examen clínico, pero puede alertarte sobre áreas a revisar.</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h3 className="font-semibold text-gray-800">Instrucciones</h3>
            {[
              '1. Siéntate frente a la pantalla a ~50cm de distancia.',
              '2. Mantén la mirada FIJA en el punto central durante todo el test.',
              '3. Cuando veas un destello en cualquier parte de la pantalla, presiona ESPACIO (o toca la pantalla en móvil).',
              '4. NO muevas los ojos para buscar el destello — solo usa tu visión periférica.',
              '5. El test dura aproximadamente 2-3 minutos.',
            ].map((s, i) => <p key={i} className="text-sm text-gray-600">{s}</p>)}
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">¿Con qué ojo?</p>
            <div className="flex gap-2">
              {(['ambos', 'izquierdo', 'derecho'] as const).map(o => (
                <button key={o} onClick={() => setOjoActivo(o)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition capitalize ${ojoActivo === o ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
                >{o}</button>
              ))}
            </div>
          </div>
          <button onClick={iniciarTest}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-2xl py-4 hover:opacity-90 transition shadow-lg">
            <Play className="w-5 h-5" /> Comenzar test
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'test') {
    const d = destellos[currentIdx];
    return (
      <div
        ref={containerRef}
        className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center cursor-none select-none"
        onClick={() => waitingResponse && registrarRespuesta(true, Date.now() - destelloStart)}
      >
        {/* Barra de progreso */}
        <div className="fixed top-0 left-0 right-0 h-1 bg-gray-700">
          <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${progreso}%` }} />
        </div>
        <p className="fixed top-4 right-4 text-gray-500 text-xs">{currentIdx}/{destellos.length}</p>
        <p className="fixed top-4 left-1/2 -translate-x-1/2 text-gray-500 text-xs">ESPACIO o toca para responder</p>

        {/* Punto de fijación central */}
        {showFixation && (
          <div className="relative z-10">
            <div className="w-4 h-4 rounded-full border-2 border-white flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
            </div>
          </div>
        )}

        {/* Destello periférico */}
        {showDestello && d && (
          <div
            className="fixed w-5 h-5 rounded-full bg-white"
            style={{
              left: `${d.x}%`,
              top: `${d.y}%`,
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 0 12px 4px rgba(255,255,255,0.6)',
            }}
          />
        )}
      </div>
    );
  }

  if (phase === 'resultado') {
    const analisis = getAnalisis();
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-xl transition"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
          <h1 className="text-lg font-bold text-gray-900">Resultado — Campo Visual</h1>
        </div>
        <div className="max-w-md mx-auto px-4 py-6 space-y-4">

          {/* Score principal */}
          <div className={`rounded-2xl p-5 text-center ${analisis.nivel === 'normal' ? 'bg-emerald-50 border border-emerald-200' : analisis.nivel === 'leve' ? 'bg-amber-50 border border-amber-200' : 'bg-red-50 border border-red-200'}`}>
            <p className="text-5xl font-black mb-1">{Math.round(analisis.tasa * 100)}%</p>
            <p className={`text-lg font-bold capitalize ${analisis.color}`}>
              {analisis.nivel === 'normal' ? 'Campo visual normal' : analisis.nivel === 'leve' ? 'Reducción leve' : analisis.nivel === 'moderado' ? 'Reducción moderada' : 'Reducción significativa'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {analisis.detectados} de {analisis.total} destellos detectados · {analisis.avgReaction}ms promedio
            </p>
          </div>

          {/* Por cuadrante */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="font-semibold text-gray-700 mb-3">Por cuadrante</h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(analisis.byCuadrante).map(([k, v]) => {
                const pct = v.total > 0 ? Math.round((v.detectados / v.total) * 100) : 0;
                const color = pct >= 80 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : pct >= 60 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-red-50 border-red-200 text-red-700';
                return (
                  <div key={k} className={`rounded-xl border p-3 ${color}`}>
                    <p className="text-xs font-semibold">{CUADRANTE_LABEL[k as Destello['cuadrante']]}</p>
                    <p className="text-xl font-black">{pct}%</p>
                    <p className="text-[10px]">{v.detectados}/{v.total}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Zonas problemáticas */}
          {analisis.zonasProblem.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="font-semibold text-amber-800 mb-1">⚠️ Zonas a revisar</p>
              {analisis.zonasProblem.map(z => <p key={z} className="text-sm text-amber-700">· {z}</p>)}
              <p className="text-xs text-amber-600 mt-2">Considera mencionarlo en tu próxima consulta oftalmológica.</p>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
            <p className="text-xs text-blue-700 leading-relaxed">
              ⚠️ Este test es orientativo y no reemplaza un examen de campo visual clínico (perimetría). Si tienes resultados preocupantes, consulta a un oftalmólogo.
            </p>
          </div>

          <div className="flex gap-2">
            <button onClick={iniciarTest} className="flex-1 flex items-center justify-center gap-2 border border-gray-200 text-gray-700 font-semibold rounded-xl py-3 hover:bg-gray-50 transition">
              <RotateCcw className="w-4 h-4" /> Repetir
            </button>
            <button onClick={onBack} className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white font-semibold rounded-xl py-3 hover:bg-indigo-700 transition">
              <CheckCircle2 className="w-4 h-4" /> Listo
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
