// =========================================
// RESPIRACIÓN 4-7-8 — Therapheye
// Técnica de relajación ocular con animación
// =========================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Wind, RotateCcw, Play } from 'lucide-react';

interface Props { onBack: () => void }

type Phase = 'idle' | 'inhale' | 'hold' | 'exhale' | 'done';

const PHASES: { phase: Phase; label: string; duration: number; color: string; bg: string }[] = [
  { phase: 'inhale', label: 'Inhala',   duration: 4, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  { phase: 'hold',   label: 'Mantén',   duration: 7, color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  { phase: 'exhale', label: 'Exhala',   duration: 8, color: '#14b8a6', bg: 'rgba(20,184,166,0.12)' },
];

const TOTAL_ROUNDS = 4;

export default function Respiracion478({ onBack }: Props) {
  const [round, setRound] = useState(1);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const current = PHASES[phaseIdx];
  const progress = elapsed / current.duration;

  const nextStep = useCallback(() => {
    setElapsed(0);
    if (phaseIdx < PHASES.length - 1) {
      setPhaseIdx(p => p + 1);
    } else if (round < TOTAL_ROUNDS) {
      setPhaseIdx(0);
      setRound(r => r + 1);
    } else {
      setRunning(false);
      setDone(true);
    }
  }, [phaseIdx, round]);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setElapsed(e => {
        if (e + 1 >= current.duration) { nextStep(); return 0; }
        return e + 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, current.duration, nextStep]);

  const start = () => {
    setDone(false); setRound(1); setPhaseIdx(0); setElapsed(0); setRunning(true);
  };

  const reset = () => {
    setRunning(false); setDone(false); setRound(1); setPhaseIdx(0); setElapsed(0);
  };

  // Circle size: grows on inhale, stays big on hold, shrinks on exhale
  const circleScale = current.phase === 'inhale'
    ? 0.6 + progress * 0.4
    : current.phase === 'hold'
    ? 1.0
    : 1.0 - progress * 0.4;

  const remaining = current.duration - elapsed;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition">
          <ArrowLeft className="w-5 h-5"/>
        </button>
        <div>
          <h1 className="text-white font-bold text-lg leading-tight">Respiración 4-7-8</h1>
          <p className="text-white/50 text-xs">Relajación ocular · {TOTAL_ROUNDS} ciclos</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
        {done ? (
          /* Completion screen */
          <div className="text-center">
            <div className="text-6xl mb-4">✨</div>
            <h2 className="text-white text-2xl font-black mb-2">¡Excelente!</h2>
            <p className="text-white/60 text-sm leading-relaxed mb-8 max-w-xs mx-auto">
              Completaste {TOTAL_ROUNDS} ciclos de respiración. Tus ojos y mente están más relajados.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={reset} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 text-white text-sm font-semibold hover:bg-white/20 transition">
                <RotateCcw className="w-4 h-4"/> Repetir
              </button>
              <button onClick={onBack} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-500 text-white text-sm font-semibold hover:bg-teal-400 transition">
                Terminar
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Round counter */}
            <div className="flex gap-2">
              {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-all duration-500 ${i < round - 1 ? 'bg-teal-400' : i === round - 1 ? 'bg-white scale-125' : 'bg-white/20'}`} />
              ))}
            </div>

            {/* Animated circle */}
            <div className="relative flex items-center justify-center" style={{ width: 240, height: 240 }}>
              {/* Outer glow ring */}
              <div
                className="absolute rounded-full transition-all duration-1000"
                style={{
                  width: 240, height: 240,
                  background: `radial-gradient(circle, ${current.color}22 0%, transparent 70%)`,
                  transform: `scale(${running ? circleScale * 1.3 : 0.8})`,
                }}
              />
              {/* Main circle */}
              <div
                className="absolute rounded-full transition-all duration-1000 flex items-center justify-center"
                style={{
                  width: 200, height: 200,
                  background: running ? current.bg : 'rgba(255,255,255,0.05)',
                  border: `3px solid ${running ? current.color : 'rgba(255,255,255,0.15)'}`,
                  transform: `scale(${running ? circleScale : 0.85})`,
                  boxShadow: running ? `0 0 40px ${current.color}44` : 'none',
                }}
              >
                <div className="text-center">
                  <div className="text-5xl font-black text-white leading-none">
                    {running ? remaining : <Wind className="w-12 h-12 text-white/30 mx-auto"/>}
                  </div>
                  {running && (
                    <p className="text-sm font-semibold mt-1" style={{ color: current.color }}>
                      {current.label}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Phase label + description */}
            <div className="text-center">
              {running ? (
                <>
                  <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Ciclo {round} / {TOTAL_ROUNDS}</p>
                  <p className="text-white/70 text-sm">
                    {current.phase === 'inhale' && 'Inhala lentamente por la nariz'}
                    {current.phase === 'hold'   && 'Mantén el aire con suavidad'}
                    {current.phase === 'exhale' && 'Exhala despacio por la boca'}
                  </p>
                </>
              ) : (
                <p className="text-white/40 text-sm max-w-xs text-center">
                  Siéntate cómodo, cierra los ojos si puedes, y sigue el ritmo del círculo.
                </p>
              )}
            </div>

            {/* Start / reset */}
            {!running && (
              <button onClick={start} className="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-blue-500 text-white font-bold text-base hover:bg-blue-400 transition shadow-lg shadow-blue-900/40">
                <Play className="w-5 h-5"/> Comenzar
              </button>
            )}
          </>
        )}
      </div>

      {/* Phase guide */}
      {!done && (
        <div className="flex justify-center gap-4 px-6 pb-8">
          {PHASES.map(p => (
            <div key={p.phase} className="text-center">
              <div className="text-xs font-bold mb-0.5" style={{ color: running && current.phase === p.phase ? p.color : 'rgba(255,255,255,0.3)' }}>
                {p.label}
              </div>
              <div className="text-[10px] text-white/20">{p.duration}s</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
