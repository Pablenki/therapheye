// =========================================
// TEST DE REACCIÓN VISUAL — Therapheye
// Mide tiempo de reacción ante estímulos visuales
// 10 intentos, estadísticas completas
// =========================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Zap, AlertCircle } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { sql } from '../neonCliente';

interface Props { onBack: () => void; }

type Phase = 'instrucciones' | 'espera' | 'estimulo' | 'muy-rapido' | 'resultado';

const TOTAL_ROUNDS = 10;
const MIN_WAIT_MS = 1500;
const MAX_WAIT_MS = 5000;

const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

function getRatingLabel(avg: number): { label: string; color: string; desc: string } {
  if (avg < 180) return { label: 'Excepcional', color: 'violet', desc: 'Tiempo de reacción de atleta de élite. Muy raro.' };
  if (avg < 220) return { label: 'Excelente', color: 'emerald', desc: 'Por encima del promedio. Reflejos visuales muy agudos.' };
  if (avg < 270) return { label: 'Normal', color: 'blue', desc: 'Dentro del rango normal para adultos sanos (200-270ms).' };
  if (avg < 350) return { label: 'Lento', color: 'amber', desc: 'Puede indicar fatiga visual o falta de atención. Descansa.' };
  return { label: 'Muy lento', color: 'red', desc: 'Puede indicar fatiga severa o distractores. Intenta más tarde.' };
}

export default function ReaccionVisual({ onBack }: Props) {
  const { user } = useUser();
  const [phase, setPhase] = useState<Phase>('instrucciones');
  const [ronda, setRonda] = useState(0);
  const [tiempos, setTiempos] = useState<number[]>([]);
  const [color, setColor] = useState(COLORS[0]);
  const [stimuloInicio, setStimuloInicio] = useState(0);
  const [saved, setSaved] = useState(false);

  const waitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colorIdxRef = useRef(0);

  const clearWait = () => { if (waitTimerRef.current) clearTimeout(waitTimerRef.current); };

  const nextRound = useCallback(() => {
    clearWait();
    setPhase('espera');
    const delay = MIN_WAIT_MS + Math.random() * (MAX_WAIT_MS - MIN_WAIT_MS);
    waitTimerRef.current = setTimeout(() => {
      colorIdxRef.current = (colorIdxRef.current + 1) % COLORS.length;
      setColor(COLORS[colorIdxRef.current]);
      setStimuloInicio(Date.now());
      setPhase('estimulo');
    }, delay);
  }, []);

  const handleTap = useCallback(() => {
    if (phase === 'espera') {
      // Too early
      clearWait();
      setPhase('muy-rapido');
    } else if (phase === 'estimulo') {
      const rt = Date.now() - stimuloInicio;
      const newTiempos = [...tiempos, rt];
      setTiempos(newTiempos);
      const newRonda = ronda + 1;
      setRonda(newRonda);
      if (newRonda >= TOTAL_ROUNDS) {
        setPhase('resultado');
        // Save
        const avg = Math.round(newTiempos.reduce((a, b) => a + b, 0) / newTiempos.length);
        const best = Math.min(...newTiempos);
        if (user?.id) {
          sql`INSERT INTO reaccion_visual_tests (user_id, promedio_ms, mejor_ms, tiempos_json, created_at)
              VALUES (${user.id}, ${avg}, ${best}, ${JSON.stringify(newTiempos)}, NOW())`
            .then(() => setSaved(true)).catch(() => {});
        }
      } else {
        nextRound();
      }
    }
  }, [phase, stimuloInicio, tiempos, ronda, nextRound, user]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleTap(); }
    };
    if (phase === 'espera' || phase === 'estimulo') {
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }
  }, [phase, handleTap]);

  useEffect(() => () => clearWait(), []);

  const avg = tiempos.length ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length) : 0;
  const best = tiempos.length ? Math.min(...tiempos) : 0;

  // ── Instrucciones ──────────────────────────────────────────────────────────
  if (phase === 'instrucciones') {
    return (
      <div className="min-h-screen bg-gray-900">
        <div className="bg-gray-800 px-4 pt-10 pb-8 text-white">
          <button onClick={onBack} className="flex items-center gap-2 text-white/60 hover:text-white text-sm mb-6 transition">
            <ArrowLeft className="w-4 h-4"/> Volver
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-violet-500/20 flex items-center justify-center">
              <Zap className="w-6 h-6 text-violet-300"/>
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">Reacción Visual</h1>
              <p className="text-gray-400 text-sm">Mide tu tiempo de reacción — {TOTAL_ROUNDS} intentos</p>
            </div>
          </div>
        </div>

        <div className="p-4 max-w-md mx-auto">
          <div className="bg-gray-800 rounded-2xl p-5 mb-4">
            <h2 className="font-bold text-white mb-3">Instrucciones</h2>
            <div className="space-y-2 text-sm text-gray-300">
              <p>1. Toca la pantalla (o Espacio) cuando veas el <strong className="text-white">círculo de color</strong>.</p>
              <p>2. Espera — no toques antes de que aparezca. Si lo haces antes, ese intento no cuenta.</p>
              <p>3. El tiempo promedio normal es <strong className="text-white">200–270ms</strong>. Los atletas llegan a 150ms.</p>
              <p>4. Haz el test en un ambiente sin distracciones y con buena luz.</p>
            </div>
          </div>

          <div className="bg-violet-900/30 border border-violet-700/40 rounded-2xl p-4 mb-5 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5"/>
            <p className="text-xs text-violet-300">La fatiga visual puede aumentar el tiempo de reacción hasta un 30%. Úsalo para medir tu estado a lo largo del día.</p>
          </div>

          <button
            onClick={() => { setRonda(0); setTiempos([]); nextRound(); }}
            className="w-full py-4 rounded-2xl bg-violet-600 text-white font-bold text-base hover:bg-violet-700 transition"
          >
            Comenzar
          </button>
        </div>
      </div>
    );
  }

  // ── Muy rápido ─────────────────────────────────────────────────────────────
  if (phase === 'muy-rapido') {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4 text-center">
        <div className="text-5xl mb-4">⚡</div>
        <h2 className="text-2xl font-black text-red-400 mb-2">¡Muy rápido!</h2>
        <p className="text-gray-400 text-sm mb-8">Tocaste antes de que apareciera el círculo. Ese intento no cuenta.</p>
        <button
          onClick={() => nextRound()}
          className="px-8 py-3 rounded-2xl bg-violet-600 text-white font-bold hover:bg-violet-700 transition"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // ── Test activo ────────────────────────────────────────────────────────────
  if (phase === 'espera' || phase === 'estimulo') {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center cursor-pointer select-none"
        style={{ background: phase === 'estimulo' ? '#0a0a0a' : '#111827' }}
        onClick={handleTap}
      >
        {/* Round counter */}
        <div className="absolute top-4 left-0 right-0 flex justify-center gap-2">
          {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{ background: i < ronda ? '#7c3aed' : i === ronda ? '#a78bfa' : '#374151' }}
            />
          ))}
        </div>

        {phase === 'espera' ? (
          <p className="text-gray-600 text-lg font-medium select-none">Espera...</p>
        ) : (
          <div
            className="rounded-full shadow-2xl animate-[bounceIn_0.1s_ease]"
            style={{
              width: 'min(60vw, 240px)',
              height: 'min(60vw, 240px)',
              background: color,
              boxShadow: `0 0 80px ${color}88`,
            }}
          />
        )}

        <p className="absolute bottom-8 text-gray-700 text-sm">
          {phase === 'estimulo' ? '¡Toca ahora!' : `Intento ${ronda + 1} de ${TOTAL_ROUNDS}`}
        </p>
      </div>
    );
  }

  // ── Resultado ─────────────────────────────────────────────────────────────
  const { label, color: rColor, desc } = getRatingLabel(avg);
  const bgMap: Record<string, string> = {
    violet: 'from-violet-600 to-purple-700',
    emerald: 'from-emerald-500 to-teal-600',
    blue: 'from-blue-500 to-indigo-600',
    amber: 'from-amber-500 to-orange-600',
    red: 'from-red-500 to-rose-600',
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="bg-gray-800 px-4 pt-10 pb-6 text-white">
        <button onClick={onBack} className="flex items-center gap-2 text-white/60 hover:text-white text-sm mb-4 transition">
          <ArrowLeft className="w-4 h-4"/> Volver
        </button>
        <h1 className="text-xl font-black">Resultado</h1>
      </div>

      <div className="p-4 max-w-md mx-auto">
        {/* Main result */}
        <div className={`bg-gradient-to-br ${bgMap[rColor]} rounded-3xl p-6 text-white text-center mb-4 animate-[bounceIn_0.5s_ease]`}>
          <p className="text-white/70 text-sm mb-1">Tiempo de reacción promedio</p>
          <p className="text-5xl font-black mb-1">{avg}<span className="text-2xl font-medium ml-1">ms</span></p>
          <p className="text-lg font-bold">{label}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-800 rounded-2xl p-4 text-center">
            <p className="text-gray-400 text-xs mb-1">Mejor intento</p>
            <p className="text-white text-2xl font-black">{best}<span className="text-sm font-normal ml-0.5">ms</span></p>
          </div>
          <div className="bg-gray-800 rounded-2xl p-4 text-center">
            <p className="text-gray-400 text-xs mb-1">Intentos</p>
            <p className="text-white text-2xl font-black">{tiempos.length}</p>
          </div>
        </div>

        {/* Per-round bar chart */}
        <div className="bg-gray-800 rounded-2xl p-4 mb-4">
          <p className="text-gray-400 text-xs mb-3">Por intento</p>
          <div className="flex items-end gap-1.5 h-16">
            {tiempos.map((t, i) => {
              const maxT = Math.max(...tiempos);
              const h = Math.round((t / maxT) * 100);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-sm"
                    style={{
                      height: `${h}%`,
                      background: t < 220 ? '#10b981' : t < 300 ? '#3b82f6' : t < 400 ? '#f59e0b' : '#ef4444',
                    }}
                  />
                  <span className="text-[8px] text-gray-600">{i + 1}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-gray-800 rounded-2xl p-4 mb-4">
          <p className="text-sm text-gray-300 leading-relaxed">{desc}</p>
        </div>

        {saved && <p className="text-center text-xs text-emerald-400 mb-3">✓ Guardado en tu historial</p>}

        <div className="flex gap-3">
          <button
            onClick={() => { setPhase('instrucciones'); setTiempos([]); setRonda(0); setSaved(false); }}
            className="flex-1 py-3 rounded-xl bg-gray-700 text-white text-sm font-semibold hover:bg-gray-600 transition"
          >
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
