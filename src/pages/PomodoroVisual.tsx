// =========================================
// MODO POMODORO VISUAL — Therapheye
// Timer Pomodoro con intervalos configurables,
// barra de progreso visual y ejercicios recomendados
// =========================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Play, Pause, RotateCcw, Settings, Eye, Coffee, Zap, SkipForward } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { sql, localISOString } from '../neonCliente';

interface Props {
  onBack: () => void;
  onStartExercise?: (id: string) => void;
}

type Mode = 'work' | 'break';

interface Config {
  workMin: number;
  breakMin: number;
}

const PRESETS: { label: string; workMin: number; breakMin: number }[] = [
  { label: '25 / 5', workMin: 25, breakMin: 5 },
  { label: '50 / 10', workMin: 50, breakMin: 10 },
  { label: '15 / 3', workMin: 15, breakMin: 3 },
  { label: '45 / 15', workMin: 45, breakMin: 15 },
];

// Ejercicios recomendados según tiempo de trabajo acumulado
const EXERCISE_FOR_ROUND: Record<number, { id: string; nombre: string; descripcion: string }> = {
  1: { id: '20-20-20', nombre: 'Regla 20-20-20', descripcion: 'Mira algo a 6m por 20 segundos' },
  2: { id: 'palming', nombre: 'Palming', descripcion: 'Tapa los ojos con las palmas y relaja' },
  3: { id: 'circles', nombre: 'Círculos oculares', descripcion: 'Gira los ojos lentamente' },
  4: { id: 'focus', nombre: 'Enfoque cercano-lejano', descripcion: 'Alterna el foco entre cerca y lejos' },
  5: { id: 'near-far', nombre: 'Simulación cerca/lejos', descripcion: 'Ejercita la acomodación visual' },
};

const getExerciseForRound = (round: number) => EXERCISE_FOR_ROUND[((round - 1) % 5) + 1];

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export default function PomodoroVisual({ onBack, onStartExercise }: Props) {
  const { user } = useUser();
  const [config, setConfig] = useState<Config>({ workMin: 25, breakMin: 5 });
  const [showSettings, setShowSettings] = useState(false);
  const [mode, setMode] = useState<Mode>('work');
  const [secondsLeft, setSecondsLeft] = useState(config.workMin * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [round, setRound] = useState(1);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const [showBreakAlert, setShowBreakAlert] = useState(false);
  const [totalWorkSeconds, setTotalWorkSeconds] = useState(0);
  const [sessionLog, setSessionLog] = useState<{ round: number; mode: string; completedAt: string }[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const totalSeconds = (mode === 'work' ? config.workMin : config.breakMin) * 60;
  const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100;

  const playBeep = useCallback((freq = 440, duration = 0.3) => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch { /* silent fail */ }
  }, []);

  const handleComplete = useCallback(async () => {
    setIsRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (mode === 'work') {
      playBeep(880, 0.5);
      setTimeout(() => playBeep(1100, 0.3), 600);
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      setCompletedPomodoros(p => p + 1);
      setTotalWorkSeconds(s => s + config.workMin * 60);
      const entry = { round, mode: 'trabajo', completedAt: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) };
      setSessionLog(prev => [entry, ...prev]);

      // Guardar en BD
      if (user?.id) {
        try {
          await sql`
            CREATE TABLE IF NOT EXISTS pomodoro_sessions (
              id SERIAL PRIMARY KEY,
              user_id TEXT NOT NULL,
              tipo TEXT NOT NULL,
              duracion_min INT NOT NULL,
              ronda INT NOT NULL,
              created_at TIMESTAMPTZ DEFAULT NOW()
            )
          `;
          await sql`
            INSERT INTO pomodoro_sessions (user_id, tipo, duracion_min, ronda, created_at)
            VALUES (${user.id}, 'trabajo', ${config.workMin}, ${round}, ${localISOString()})
          `;
        } catch { /* no crítico */ }
      }

      setShowBreakAlert(true);
      setMode('break');
      setSecondsLeft(config.breakMin * 60);
    } else {
      playBeep(660, 0.3);
      setMode('work');
      setRound(r => r + 1);
      setSecondsLeft(config.workMin * 60);
      setShowBreakAlert(false);
    }
  }, [mode, config, round, user, playBeep]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            handleComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, handleComplete]);

  const handleReset = () => {
    setIsRunning(false);
    setMode('work');
    setSecondsLeft(config.workMin * 60);
    setShowBreakAlert(false);
  };

  const handleSkip = () => {
    setIsRunning(false);
    if (mode === 'work') {
      setMode('break');
      setSecondsLeft(config.breakMin * 60);
    } else {
      setMode('work');
      setRound(r => r + 1);
      setSecondsLeft(config.workMin * 60);
      setShowBreakAlert(false);
    }
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setConfig({ workMin: preset.workMin, breakMin: preset.breakMin });
    setIsRunning(false);
    setMode('work');
    setSecondsLeft(preset.workMin * 60);
    setRound(1);
    setShowBreakAlert(false);
    setShowSettings(false);
  };

  const exerciseForRound = getExerciseForRound(round);

  const circumference = 2 * Math.PI * 90;
  const strokeDashoffset = circumference * (1 - progress / 100);

  const ringColor = mode === 'work'
    ? (secondsLeft < 60 ? '#ef4444' : '#6366f1')
    : '#10b981';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-xl transition">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Pomodoro Visual</h1>
              <p className="text-xs text-gray-500">Ronda {round} · {config.workMin}/{config.breakMin} min</p>
            </div>
          </div>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-gray-100 rounded-xl transition">
          <Settings className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Presets</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className={`py-2.5 px-3 rounded-xl border text-sm font-semibold transition ${
                  config.workMin === p.workMin && config.breakMin === p.breakMin
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-indigo-300'
                }`}
              >
                {p.label} min
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Trabajo (min)</label>
              <input
                type="number" min={5} max={90} value={config.workMin}
                onChange={e => { const v = Math.min(90, Math.max(5, Number(e.target.value))); setConfig(c => ({...c, workMin: v})); setSecondsLeft(v * 60); setIsRunning(false); }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Descanso (min)</label>
              <input
                type="number" min={1} max={30} value={config.breakMin}
                onChange={e => { const v = Math.min(30, Math.max(1, Number(e.target.value))); setConfig(c => ({...c, breakMin: v})); }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto px-4 py-8 space-y-6">

        {/* Estado del modo */}
        <div className={`rounded-2xl py-2 px-4 text-center text-sm font-semibold ${mode === 'work' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {mode === 'work' ? '🎯 Tiempo de trabajo — mantén la concentración' : '☕ Descansa — cuida tus ojos'}
        </div>

        {/* Timer circular */}
        <div className="flex flex-col items-center">
          <div className="relative w-56 h-56">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
              {/* Track */}
              <circle cx="100" cy="100" r="90" fill="none" stroke="#e5e7eb" strokeWidth="10" />
              {/* Progress */}
              <circle
                cx="100" cy="100" r="90"
                fill="none"
                stroke={ringColor}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
              />
            </svg>
            {/* Tiempo central */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-black tracking-tight" style={{ color: ringColor }}>
                {formatTime(secondsLeft)}
              </span>
              <span className="text-xs text-gray-400 mt-1">{mode === 'work' ? 'trabajando' : 'descansando'}</span>
            </div>
          </div>

          {/* Barra de progreso lineal */}
          <div className="w-full mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: ringColor }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">{Math.round(progress)}% completado</p>
        </div>

        {/* Controles */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handleReset}
            className="p-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
            title="Reiniciar"
          >
            <RotateCcw className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={() => setIsRunning(r => !r)}
            className={`flex items-center gap-2 px-8 py-4 rounded-2xl text-white font-bold text-lg shadow-lg transition ${
              mode === 'work' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {isRunning ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            {isRunning ? 'Pausar' : 'Iniciar'}
          </button>
          <button
            onClick={handleSkip}
            className="p-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
            title="Saltar"
          >
            <SkipForward className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Alerta de descanso con ejercicio */}
        {showBreakAlert && (
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Coffee className="w-5 h-5 text-emerald-600" />
              <p className="font-semibold text-emerald-800">¡Pomodoro {completedPomodoros} completado!</p>
            </div>
            <p className="text-sm text-emerald-700 mb-3">
              Aprovecha el descanso para hacer este ejercicio ocular:
            </p>
            <div className="bg-white rounded-xl p-3 border border-emerald-100">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{exerciseForRound.nombre}</p>
                  <p className="text-xs text-gray-500">{exerciseForRound.descripcion}</p>
                </div>
                {onStartExercise && (
                  <button
                    onClick={() => onStartExercise(exerciseForRound.id)}
                    className="flex items-center gap-1 bg-emerald-600 text-white text-xs font-semibold rounded-lg px-3 py-1.5 hover:bg-emerald-700 transition flex-shrink-0"
                  >
                    <Eye className="w-3 h-3" /> Hacer
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Estadísticas de sesión */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Ronda', value: round, icon: '🔄' },
            { label: 'Completados', value: completedPomodoros, icon: '✅' },
            { label: 'Trabajo', value: `${Math.round(totalWorkSeconds / 60)}m`, icon: '⏱' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 text-center">
              <p className="text-xl">{s.icon}</p>
              <p className="text-lg font-bold text-gray-800">{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Log de sesión */}
        {sessionLog.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">Registro de hoy</p>
            <div className="space-y-1.5">
              {sessionLog.slice(0, 5).map((entry, i) => (
                <div key={i} className="flex items-center justify-between text-xs text-gray-500">
                  <span>Ronda {entry.round} — {entry.mode}</span>
                  <span className="text-gray-400">{entry.completedAt}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
