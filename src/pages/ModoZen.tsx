// =========================================
// MODO ZEN — Therapheye
// Ejercicios visuales guiados solo por audio
// Sin pantalla, ojos cerrados, Web Speech API
// =========================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Play, Square, Volume2, VolumeX, EarOff, Check } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { sql } from '../neonCliente';
import { markExerciseDone } from '../components/PresenceDetector';

interface Props { onBack: () => void; }

interface Rutina {
  id: string;
  nombre: string;
  duracion: number; // segundos
  descripcion: string;
  pasos: { texto: string; duracion: number }[];
}

const RUTINAS: Rutina[] = [
  {
    id: 'relajacion',
    nombre: 'Relajación Profunda',
    duracion: 180,
    descripcion: 'Cierra los ojos y relaja toda tensión ocular con palming y respiración.',
    pasos: [
      { texto: 'Siéntate cómodamente y cierra los ojos suavemente.', duracion: 8 },
      { texto: 'Frota las palmas de tus manos durante 10 segundos para calentarlas.', duracion: 12 },
      { texto: 'Coloca las palmas sobre tus ojos cerrados sin presionar. Siente el calor.', duracion: 8 },
      { texto: 'Respira profundamente. Inhala en 4 tiempos... sostén 4... exhala en 6.', duracion: 20 },
      { texto: 'Repite la respiración. Con cada exhalación, siente cómo los músculos de tus ojos se aflojan.', duracion: 20 },
      { texto: 'Mantén las palmas sobre tus ojos. Visualiza oscuridad total, perfecta y relajante.', duracion: 25 },
      { texto: 'Ahora visualiza un punto de luz azul suave en la distancia. Solo observa sin esfuerzo.', duracion: 20 },
      { texto: 'Deja ir ese punto. Siente el peso de tus párpados, completamente relajados.', duracion: 20 },
      { texto: 'Respira una vez más profundo. Inhala... y exhala lentamente.', duracion: 15 },
      { texto: 'Baja las manos suavemente. Mantén los ojos cerrados un momento más.', duracion: 10 },
      { texto: 'Parpadea suavemente varias veces antes de abrir los ojos. Ejercicio completado.', duracion: 10 },
    ],
  },
  {
    id: 'movimientos',
    nombre: 'Movimientos Oculares',
    duracion: 240,
    descripcion: 'Guía de movimientos oculares completos sin mirar ninguna pantalla.',
    pasos: [
      { texto: 'Cierra los ojos y tómate un momento para relajarte.', duracion: 8 },
      { texto: 'Manteniendo los ojos cerrados, muévelos lentamente hacia arriba... y luego hacia abajo. Repite 5 veces.', duracion: 20 },
      { texto: 'Ahora mueve los ojos hacia la izquierda... y hacia la derecha. Repite 5 veces.', duracion: 20 },
      { texto: 'Mueve los ojos en diagonal: arriba-derecha... abajo-izquierda. Repite 5 veces.', duracion: 20 },
      { texto: 'Diagonal opuesta: arriba-izquierda... abajo-derecha. Repite 5 veces.', duracion: 20 },
      { texto: 'Ahora realiza círculos lentos con los ojos cerrados. Gira en sentido horario 5 veces.', duracion: 25 },
      { texto: 'Gira en sentido antihorario 5 veces, lentamente.', duracion: 25 },
      { texto: 'Centra los ojos al frente y descansa. Respira profundo.', duracion: 15 },
      { texto: 'Ahora enfoca cerca: imagina tu dedo a 20 centímetros. Luego enfoca lejos: imagina el horizonte.', duracion: 30 },
      { texto: 'Repite ese cambio de enfoque: cerca... lejos... cerca... lejos. Cinco veces.', duracion: 30 },
      { texto: 'Parpadea 10 veces rápido para lubricar. Relaja. Ejercicio completado.', duracion: 15 },
    ],
  },
  {
    id: 'acomodacion',
    nombre: 'Acomodación Visual',
    duracion: 200,
    descripcion: 'Entrena el músculo ciliar alternando enfoque cercano y lejano.',
    pasos: [
      { texto: 'Siéntate derecho. Cierra los ojos y respira.', duracion: 8 },
      { texto: 'Abre los ojos y extiende el pulgar a unos 30 centímetros. Enfócalo claramente.', duracion: 10 },
      { texto: 'Ahora mira un punto en la pared más lejana. Deja que el pulgar se vuelva borroso.', duracion: 10 },
      { texto: 'Vuelve al pulgar. Enfócalo bien. Luego de nuevo a la pared lejana.', duracion: 15 },
      { texto: 'Repite ese cambio 5 veces lentamente. Cercano... lejano...', duracion: 30 },
      { texto: 'Cierra los ojos 10 segundos para descansar el músculo ciliar.', duracion: 12 },
      { texto: 'Abre los ojos. Ahora mueve el pulgar lentamente hacia tu nariz mientras lo enfocas.', duracion: 20 },
      { texto: 'Para antes de que se vea doble. Luego aleja el pulgar de vuelta, manteniéndolo enfocado.', duracion: 20 },
      { texto: 'Repite esa operación 5 veces. Acerca... aleja...', duracion: 30 },
      { texto: 'Cierra los ojos. Parpadea suavemente varias veces. Descansa.', duracion: 15 },
      { texto: 'Ejercicio de acomodación completado. Tus músculos oculares están fortalecidos.', duracion: 10 },
    ],
  },
];

function speak(texto: string, rate = 0.9, pitch = 1): void {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = 'es-ES';
  u.rate = rate;
  u.pitch = pitch;
  u.volume = 1;
  window.speechSynthesis.speak(u);
}

function playBeep(ctx: AudioContext, freq = 440, dur = 0.15, vol = 0.3): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = freq;
  osc.type = 'sine';
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + dur);
}

export default function ModoZen({ onBack }: Props) {
  const { user } = useUser();
  const [selected, setSelected] = useState<Rutina | null>(null);
  const [running, setRunning] = useState(false);
  const [pasoIdx, setPasoIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [done, setDone] = useState(false);
  const [screenOff, setScreenOff] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mutedRef = useRef(muted);

  useEffect(() => { mutedRef.current = muted; }, [muted]);

  const clearTimers = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
  };

  const getAudioCtx = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    return audioCtxRef.current;
  };

  const announceStep = useCallback((paso: { texto: string; duracion: number }) => {
    if (!mutedRef.current) speak(paso.texto);
  }, []);

  const runStep = useCallback((rutina: Rutina, idx: number) => {
    if (idx >= rutina.pasos.length) {
      // Done
      clearTimers();
      setRunning(false);
      setDone(true);
      setScreenOff(false);
      if (!mutedRef.current) {
        setTimeout(() => speak('¡Felicitaciones! Ejercicio completado. Tus ojos están relajados.'), 300);
        setTimeout(() => playBeep(getAudioCtx(), 523, 0.3, 0.4), 100);
        setTimeout(() => playBeep(getAudioCtx(), 659, 0.3, 0.4), 400);
        setTimeout(() => playBeep(getAudioCtx(), 784, 0.4, 0.4), 700);
      }
      // Save to DB
      if (user?.id) {
        sql`INSERT INTO modo_zen_sessions (user_id, rutina_id, rutina_nombre, created_at)
            VALUES (${user.id}, ${rutina.id}, ${rutina.nombre}, NOW())`.catch(() => {});
      }
      markExerciseDone();
      return;
    }

    const paso = rutina.pasos[idx];
    setPasoIdx(idx);
    if (!mutedRef.current) {
      playBeep(getAudioCtx(), 660, 0.12, 0.25);
    }
    announceStep(paso);

    stepTimerRef.current = setTimeout(() => {
      runStep(rutina, idx + 1);
    }, paso.duracion * 1000);
  }, [announceStep, user]);

  const startRutina = (rutina: Rutina) => {
    setSelected(rutina);
    setPasoIdx(0);
    setElapsed(0);
    setDone(false);
    setRunning(true);
    setScreenOff(true);

    // Countdown beep + announce
    if (!mutedRef.current) {
      speak(`Comenzando ${rutina.nombre}. Cierra los ojos y escucha las instrucciones.`);
    }

    // Start global elapsed timer
    const startMs = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startMs) / 1000));
    }, 1000);

    // Begin first step after intro
    stepTimerRef.current = setTimeout(() => {
      runStep(rutina, 0);
    }, 3500);
  };

  const stopRutina = () => {
    clearTimers();
    window.speechSynthesis.cancel();
    setRunning(false);
    setScreenOff(false);
    setDone(false);
    setSelected(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
      window.speechSynthesis.cancel();
    };
  }, []);

  // ─── Screen-off mode: full black overlay ─────────────────────────────────
  if (screenOff && running && selected) {
    const paso = selected.pasos[pasoIdx] ?? selected.pasos[selected.pasos.length - 1];
    const progress = pasoIdx / selected.pasos.length;

    return (
      <div
        className="fixed inset-0 z-[99999] bg-gray-950 flex flex-col items-center justify-center text-center px-8"
        style={{ touchAction: 'none' }}
      >
        {/* Minimal progress ring */}
        <svg width="120" height="120" className="mb-8 opacity-30">
          <circle cx="60" cy="60" r="50" fill="none" stroke="#374151" strokeWidth="6"/>
          <circle
            cx="60" cy="60" r="50" fill="none" stroke="#6366f1" strokeWidth="6"
            strokeDasharray={`${2 * Math.PI * 50}`}
            strokeDashoffset={`${2 * Math.PI * 50 * (1 - progress)}`}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>

        <p className="text-gray-300 text-sm mb-2 font-medium opacity-60">
          Paso {pasoIdx + 1} / {selected.pasos.length}
        </p>
        <p className="text-white text-xl font-medium leading-relaxed max-w-sm opacity-80">
          {paso.texto}
        </p>

        <div className="mt-12 flex gap-4">
          <button
            onClick={() => setMuted(v => !v)}
            className="px-5 py-2.5 rounded-2xl bg-white/10 text-white/70 text-sm flex items-center gap-2 hover:bg-white/20 transition"
          >
            {muted ? <VolumeX className="w-4 h-4"/> : <Volume2 className="w-4 h-4"/>}
            {muted ? 'Activar voz' : 'Silenciar'}
          </button>
          <button
            onClick={stopRutina}
            className="px-5 py-2.5 rounded-2xl bg-red-500/20 text-red-300 text-sm flex items-center gap-2 hover:bg-red-500/30 transition"
          >
            <Square className="w-4 h-4"/> Detener
          </button>
        </div>

        <p className="mt-6 text-gray-600 text-xs">
          {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} transcurrido
        </p>
      </div>
    );
  }

  // ─── Completion screen ────────────────────────────────────────────────────
  if (done && selected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full text-center animate-[bounceIn_0.5s_ease]">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <Check className="w-10 h-10 text-emerald-600"/>
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">¡Zen completado!</h2>
          <p className="text-gray-500 text-sm mb-1">{selected.nombre}</p>
          <p className="text-gray-400 text-xs mb-6">
            {Math.floor(elapsed / 60)} min {elapsed % 60} seg de relajación ocular
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => { setDone(false); setSelected(null); }}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              Otra rutina
            </button>
            <button
              onClick={onBack}
              className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition"
            >
              Volver
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Selection screen ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-900 to-violet-900 px-4 pt-10 pb-8 text-white">
        <button onClick={onBack} className="flex items-center gap-2 text-white/70 hover:text-white text-sm mb-6 transition">
          <ArrowLeft className="w-4 h-4"/> Volver
        </button>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
            <EarOff className="w-6 h-6 text-indigo-200"/>
          </div>
          <div>
            <h1 className="text-2xl font-black">Modo Zen</h1>
            <p className="text-indigo-200 text-sm">Ejercicios solo por audio — sin mirar pantalla</p>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {/* Info card */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-5 text-xs text-amber-700 leading-relaxed">
          <strong>Cómo funciona:</strong> Elige una rutina, coloca el teléfono/computadora de lado y cierra los ojos.
          La pantalla se oscurecerá y una voz te guiará paso a paso. Puedes silenciar la voz y activar solo los pitidos.
        </div>

        {/* Mute toggle */}
        <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 mb-5">
          <div className="flex items-center gap-2">
            {muted ? <VolumeX className="w-5 h-5 text-gray-400"/> : <Volume2 className="w-5 h-5 text-indigo-500"/>}
            <span className="text-sm font-medium text-gray-700">{muted ? 'Voz desactivada' : 'Guía por voz activada'}</span>
          </div>
          <button
            onClick={() => setMuted(v => !v)}
            className={`w-12 h-6 rounded-full transition-colors relative ${muted ? 'bg-gray-200' : 'bg-indigo-500'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${muted ? 'left-0.5' : 'left-6'}`}/>
          </button>
        </div>

        {/* Rutinas */}
        <h2 className="text-base font-bold text-gray-900 mb-3">Elige tu rutina</h2>
        <div className="space-y-3">
          {RUTINAS.map(rutina => (
            <div
              key={rutina.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-base">{rutina.nombre}</h3>
                    <p className="text-gray-500 text-sm mt-0.5 leading-snug">{rutina.descripcion}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded-full">
                        {Math.floor(rutina.duracion / 60)} min
                      </span>
                      <span className="text-xs text-gray-400">
                        {rutina.pasos.length} pasos
                      </span>
                    </div>
                  </div>
                </div>

                {/* Steps preview */}
                <div className="mt-3 space-y-1">
                  {rutina.pasos.slice(0, 2).map((p, i) => (
                    <p key={i} className="text-xs text-gray-400 flex items-start gap-1.5">
                      <span className="mt-0.5 w-3.5 h-3.5 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                        {i + 1}
                      </span>
                      {p.texto.slice(0, 60)}...
                    </p>
                  ))}
                </div>

                <button
                  onClick={() => startRutina(rutina)}
                  className="mt-4 w-full bg-indigo-600 text-white py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-indigo-700 transition"
                >
                  <Play className="w-4 h-4"/> Iniciar en modo oscuro
                </button>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6 mb-8">
          No se graba audio. La guía de voz usa la síntesis local del dispositivo.
        </p>
      </div>
    </div>
  );
}
