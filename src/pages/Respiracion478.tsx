// =========================================
// RESPIRACIÓN 4-7-8 — Therapheye
// Técnica de relajación ocular con animación y guía por voz
// =========================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Wind, RotateCcw, Play, Volume2, VolumeX, Info, X } from 'lucide-react';

interface Props { onBack: () => void }

type Phase = 'idle' | 'inhale' | 'hold' | 'exhale' | 'done';

const PHASES: { phase: Phase; label: string; voiceEs: string; duration: number; color: string; bg: string }[] = [
  { phase: 'inhale', label: 'Inhala',  voiceEs: 'Inhala lentamente por la nariz',   duration: 4, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  { phase: 'hold',   label: 'Mantén',  voiceEs: 'Mantén el aire con suavidad',       duration: 7, color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  { phase: 'exhale', label: 'Exhala',  voiceEs: 'Exhala despacio por la boca',       duration: 8, color: '#14b8a6', bg: 'rgba(20,184,166,0.12)' },
];

const TOTAL_ROUNDS = 4;

function speakText(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = 'es-MX';
  utt.rate = 0.9;
  utt.pitch = 1.0;
  utt.volume = 1.0;
  const voices = window.speechSynthesis.getVoices();
  const voz = voices.find(v => v.lang === 'es-MX') ||
              voices.find(v => v.lang === 'es-US') ||
              voices.find(v => v.lang.startsWith('es'));
  if (voz) utt.voice = voz;
  window.speechSynthesis.speak(utt);
}

export default function Respiracion478({ onBack }: Props) {
  const [round, setRound] = useState(1);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevPhaseRef = useRef(-1);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

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
      if (!mutedRef.current) speakText('¡Excelente! Completaste todos los ciclos. Tus ojos y mente están más relajados.');
    }
  }, [phaseIdx, round]);

  // Voz al cambiar de fase
  useEffect(() => {
    if (!running) return;
    if (prevPhaseRef.current !== phaseIdx) {
      prevPhaseRef.current = phaseIdx;
      if (!mutedRef.current) {
        speakText(PHASES[phaseIdx].voiceEs);
      }
    }
  }, [phaseIdx, running]);

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
    prevPhaseRef.current = -1;
    setDone(false); setRound(1); setPhaseIdx(0); setElapsed(0); setRunning(true);
  };

  const reset = () => {
    window.speechSynthesis?.cancel();
    setRunning(false); setDone(false); setRound(1); setPhaseIdx(0); setElapsed(0);
    prevPhaseRef.current = -1;
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
        <div className="flex-1">
          <h1 className="text-white font-bold text-lg leading-tight">Respiración 4-7-8</h1>
          <p className="text-white/50 text-xs">Relajación ocular · {TOTAL_ROUNDS} ciclos</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTutorial(true)}
            className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition"
            title="Cómo funciona"
          >
            <Info className="w-5 h-5"/>
          </button>
          <button
            onClick={() => { setMuted(v => !v); if (!muted) window.speechSynthesis?.cancel(); }}
            className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition"
            title={muted ? 'Activar voz' : 'Silenciar voz'}
          >
            {muted ? <VolumeX className="w-5 h-5"/> : <Volume2 className="w-5 h-5"/>}
          </button>
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
                  <p className="text-white/70 text-sm">{current.voiceEs}</p>
                  {!muted && (
                    <p className="text-white/30 text-xs mt-1 flex items-center justify-center gap-1">
                      <Volume2 className="w-3 h-3"/> Guía por voz activa
                    </p>
                  )}
                </>
              ) : (
                <p className="text-white/40 text-sm max-w-xs text-center">
                  Siéntate cómodo, cierra los ojos si puedes, y sigue el ritmo del círculo.
                </p>
              )}
            </div>

            {/* Start / reset */}
            {!running && (
              <div className="flex flex-col items-center gap-3">
                <button onClick={start} className="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-blue-500 text-white font-bold text-base hover:bg-blue-400 transition shadow-lg shadow-blue-900/40">
                  <Play className="w-5 h-5"/> Comenzar
                </button>
                <button
                  onClick={() => setShowTutorial(true)}
                  className="text-white/40 text-xs hover:text-white/60 transition underline underline-offset-2"
                >
                  ¿Cómo funciona la técnica 4-7-8?
                </button>
              </div>
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

      {/* Tutorial modal */}
      {showTutorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h2 className="text-white font-bold text-base flex items-center gap-2">
                <Wind className="w-5 h-5 text-blue-400"/> Técnica de Respiración 4-7-8
              </h2>
              <button onClick={() => setShowTutorial(false)} className="text-white/50 hover:text-white transition">
                <X className="w-5 h-5"/>
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <p className="text-white/70 text-sm leading-relaxed">
                Desarrollada por el Dr. Andrew Weil, esta técnica activa el sistema nervioso parasimpático, reduce la ansiedad y relaja los músculos oculares.
              </p>
              <div className="space-y-3">
                {[
                  { n: '4', color: '#3b82f6', title: 'Inhala', desc: 'Respira lentamente por la nariz durante 4 segundos.' },
                  { n: '7', color: '#8b5cf6', title: 'Mantén', desc: 'Retén el aire suavemente durante 7 segundos.' },
                  { n: '8', color: '#14b8a6', title: 'Exhala', desc: 'Suelta el aire por la boca durante 8 segundos.' },
                ].map(s => (
                  <div key={s.n} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-black text-sm" style={{ background: s.color + '33', color: s.color }}>{s.n}</div>
                    <div>
                      <p className="text-white text-sm font-semibold">{s.title}</p>
                      <p className="text-white/50 text-xs">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-white/5 rounded-xl px-4 py-3">
                <p className="text-white/60 text-xs leading-relaxed">
                  <span className="text-blue-400 font-semibold">Beneficio visual:</span> Al reducir la tensión general del cuerpo, los músculos ciliares que controlan el enfoque se relajan, aliviando la fatiga visual y el ojo seco.
                </p>
              </div>
              <button
                onClick={() => { setShowTutorial(false); if (!running) start(); }}
                className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-xl transition text-sm"
              >
                Entendido — Empezar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
