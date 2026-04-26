// =========================================
// ENTRENAMIENTO DE VERGENCIA — Therapheye
// Ejercicios de convergencia y divergencia ocular
// Punto de convergencia + animaciones sin librerías
// =========================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Play, Square } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { sql } from '../neonCliente';
import { markExerciseDone } from '../components/PresenceDetector';

interface Props { onBack: () => void; }

interface Ejercicio {
  id: string;
  nombre: string;
  desc: string;
  duracion: number; // segundos
  tipo: 'convergencia' | 'divergencia' | 'pencil-pushup' | 'jump';
}

const EJERCICIOS: Ejercicio[] = [
  {
    id: 'convergencia-punto',
    nombre: 'Convergencia con punto',
    desc: 'Un punto se acerca lentamente. Mantenlo enfocado con ambos ojos hasta que veas doble.',
    duracion: 60,
    tipo: 'convergencia',
  },
  {
    id: 'divergencia-punto',
    nombre: 'Divergencia suave',
    desc: 'El punto se aleja. Relaja los ojos y sigue el punto mientras se aleja.',
    duracion: 60,
    tipo: 'divergencia',
  },
  {
    id: 'pencil-pushup',
    nombre: 'Pencil Push-up',
    desc: 'El clásico ejercicio de convergencia: un punto se acerca a tu nariz y vuelve. Mantén fusión binocular.',
    duracion: 90,
    tipo: 'pencil-pushup',
  },
  {
    id: 'jump-vergence',
    nombre: 'Vergencia en salto',
    desc: 'El punto salta entre cerca y lejos. Reactiva la vergencia rápidamente en cada salto.',
    duracion: 90,
    tipo: 'jump',
  },
];

function useAnimatedValue(running: boolean, _duration: number, tipo: Ejercicio['tipo']) {
  const [t, setT] = useState(0); // 0–1 cycle progress
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const lastJumpRef = useRef<number>(0);
  const jumpStateRef = useRef<'near' | 'far'>('far');

  const [jumpState, setJumpState] = useState<'near' | 'far'>('far');

  const animate = useCallback((now: number) => {
    if (startRef.current === 0) startRef.current = now;
    const elapsed = (now - startRef.current) / 1000;

    if (tipo === 'jump') {
      if (now - lastJumpRef.current > 2000) {
        lastJumpRef.current = now;
        jumpStateRef.current = jumpStateRef.current === 'far' ? 'near' : 'far';
        setJumpState(jumpStateRef.current);
      }
    } else {
      const cycleMs = tipo === 'pencil-pushup' ? 4000 : 6000;
      const cyc = (elapsed % (cycleMs / 1000)) / (cycleMs / 1000);
      // Triangle wave: 0→1→0
      setT(cyc < 0.5 ? cyc * 2 : (1 - cyc) * 2);
    }

    frameRef.current = requestAnimationFrame(animate);
  }, [tipo]);

  useEffect(() => {
    if (!running) {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      startRef.current = 0;
      setT(0);
      return;
    }
    frameRef.current = requestAnimationFrame(animate);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [running, animate]);

  return { t, jumpState };
}

export default function VergenciaTraining({ onBack }: Props) {
  const { user } = useUser();
  const [selected, setSelected] = useState<Ejercicio | null>(null);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { t, jumpState } = useAnimatedValue(running, selected?.duracion ?? 60, selected?.tipo ?? 'convergencia');

  const startEjercicio = (ej: Ejercicio) => {
    setSelected(ej);
    setElapsed(0);
    setDone(false);
    setRunning(true);

    if (user?.id) {
      sql`CREATE TABLE IF NOT EXISTS vergencia_sessions (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        ejercicio_id TEXT NOT NULL,
        duracion_seg INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`.catch(() => {});
    }

    const startMs = Date.now();
    intervalRef.current = setInterval(() => {
      const sec = Math.floor((Date.now() - startMs) / 1000);
      setElapsed(sec);
      if (sec >= ej.duracion) {
        clearInterval(intervalRef.current!);
        setRunning(false);
        setDone(true);
        markExerciseDone();
        if (user?.id) {
          sql`INSERT INTO vergencia_sessions (user_id, ejercicio_id, duracion_seg, created_at)
              VALUES (${user.id}, ${ej.id}, ${ej.duracion}, NOW())`.catch(() => {});
        }
      }
    }, 200);
  };

  const stop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
  };

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  // Compute dot position based on exercise type
  const getDotSize = () => {
    if (!selected) return 24;
    switch (selected.tipo) {
      case 'convergencia': return 24 + t * 16;
      case 'divergencia': return 40 - t * 16;
      case 'pencil-pushup': return 20 + t * 20;
      case 'jump': return jumpState === 'near' ? 36 : 18;
      default: return 24;
    }
  };

  const getDotOffset = () => {
    if (!selected) return 0;
    switch (selected.tipo) {
      case 'convergencia': return -t * 40; // moves toward viewer (grows)
      case 'divergencia': return t * 30;
      case 'pencil-pushup': return -t * 50;
      case 'jump': return jumpState === 'near' ? -30 : 20;
      default: return 0;
    }
  };

  const dotSize = getDotSize();
  const progress = selected ? Math.min(elapsed / selected.duracion, 1) : 0;
  const remaining = selected ? Math.max(selected.duracion - elapsed, 0) : 0;

  // ── Selection ──────────────────────────────────────────────────────────────
  if (!selected || done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50">
        <div className="bg-gradient-to-r from-teal-700 to-cyan-700 px-4 pt-10 pb-8 text-white">
          <button onClick={onBack} className="flex items-center gap-2 text-white/70 hover:text-white text-sm mb-6 transition">
            <ArrowLeft className="w-4 h-4"/> Volver
          </button>
          <h1 className="text-2xl font-black">Entrenamiento de Vergencia</h1>
          <p className="text-teal-100 text-sm mt-1">Ejercicios de convergencia y divergencia ocular</p>
        </div>

        {done && selected && (
          <div className="mx-4 mt-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center animate-[bounceIn_0.4s_ease]">
            <p className="text-2xl mb-1">✓</p>
            <p className="font-bold text-emerald-700">{selected.nombre} completado</p>
            <p className="text-emerald-600 text-sm">{selected.duracion} segundos de entrenamiento</p>
          </div>
        )}

        <div className="p-4 max-w-lg mx-auto">
          <div className="bg-teal-50 border border-teal-200 rounded-2xl px-4 py-3 mb-4 text-xs text-teal-700">
            <strong>¿Para qué sirve?</strong> La insuficiencia de convergencia afecta al 5% de la población.
            Estos ejercicios mejoran la fatiga al leer, los dolores de cabeza y la visión doble.
          </div>

          <div className="space-y-3">
            {EJERCICIOS.map(ej => (
              <button
                key={ej.id}
                onClick={() => startEjercicio(ej)}
                className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-left hover:border-teal-300 hover:shadow-md transition group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-bold text-gray-900">{ej.nombre}</p>
                    <p className="text-gray-500 text-sm mt-0.5 leading-snug">{ej.desc}</p>
                    <span className="mt-2 inline-block text-xs text-teal-600 font-medium bg-teal-50 px-2 py-0.5 rounded-full">
                      {ej.duracion}s
                    </span>
                  </div>
                  <Play className="w-5 h-5 text-teal-500 group-hover:text-teal-700 transition mt-0.5 flex-shrink-0"/>
                </div>
              </button>
            ))}
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            Si sientes dolor o visión doble persistente, detén el ejercicio.
          </p>
        </div>
      </div>
    );
  }

  // ── Exercise running ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900">
        <button onClick={stop} className="text-gray-500 hover:text-gray-300 transition">
          <Square className="w-5 h-5"/>
        </button>
        <p className="text-white text-sm font-semibold">{selected.nombre}</p>
        <span className="text-gray-400 text-sm font-mono">{remaining}s</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-800">
        <div
          className="h-full bg-teal-500 transition-all duration-300"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Animation area */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Instruction */}
        <p className="text-gray-400 text-sm mb-12 px-6 text-center">
          {selected.tipo === 'convergencia' && 'Mantén ambos ojos enfocados en el punto mientras se acerca'}
          {selected.tipo === 'divergencia' && 'Relaja los ojos y sigue el punto mientras se aleja'}
          {selected.tipo === 'pencil-pushup' && 'Mantén la imagen única — detente si ves doble'}
          {selected.tipo === 'jump' && 'Cada vez que salte, enfócalo rápidamente'}
        </p>

        {/* Dot animation */}
        <div
          className="rounded-full transition-all"
          style={{
            width: dotSize,
            height: dotSize,
            background: selected.tipo === 'convergencia' ? '#0d9488'
              : selected.tipo === 'divergencia' ? '#7c3aed'
              : selected.tipo === 'pencil-pushup' ? '#dc2626'
              : '#f59e0b',
            boxShadow: `0 0 ${dotSize}px ${dotSize / 2}px ${
              selected.tipo === 'convergencia' ? '#0d948844'
              : selected.tipo === 'divergencia' ? '#7c3aed44'
              : selected.tipo === 'pencil-pushup' ? '#dc262644'
              : '#f59e0b44'
            }`,
            transform: `translateY(${getDotOffset()}px)`,
            transition: selected.tipo === 'jump' ? 'all 0.3s ease' : 'all 0.1s linear',
          }}
        />

        {/* Fixation cross (far reference) */}
        {(selected.tipo === 'convergencia' || selected.tipo === 'pencil-pushup') && (
          <div className="mt-20 w-6 h-6 relative opacity-20">
            <div className="absolute inset-y-0 left-1/2 w-px bg-white -translate-x-1/2"/>
            <div className="absolute inset-x-0 top-1/2 h-px bg-white -translate-y-1/2"/>
          </div>
        )}

        <p className="mt-12 text-gray-700 text-xs">
          {selected.tipo === 'jump'
            ? jumpState === 'near' ? 'Cerca — Converge' : 'Lejos — Diverge'
            : `Ciclo: ${Math.round(t * 100)}%`
          }
        </p>
      </div>

      {/* Stop button */}
      <div className="p-4 pb-8">
        <button
          onClick={stop}
          className="w-full py-3 rounded-2xl border border-gray-700 text-gray-400 text-sm font-medium hover:border-red-500 hover:text-red-400 transition flex items-center justify-center gap-2"
        >
          <Square className="w-4 h-4"/> Detener ejercicio
        </button>
      </div>
    </div>
  );
}
