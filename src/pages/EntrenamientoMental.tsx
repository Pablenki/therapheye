// =========================================
// ENTRENAMIENTO VISUAL-COGNITIVO — Therapheye
// Ejercicios que combinan atención visual
// con procesamiento cognitivo (Stroop, span, etc.)
// =========================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Brain } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { sql } from '../neonCliente';
import { markExerciseDone } from '../components/PresenceDetector';

interface Props { onBack: () => void; }

type GameType = 'menu' | 'stroop' | 'span' | 'trail' | 'result';

// ── STROOP TEST ─────────────────────────────────────────────────────────────

const STROOP_COLORS = [
  { name: 'ROJO',    hex: '#ef4444' },
  { name: 'AZUL',    hex: '#3b82f6' },
  { name: 'VERDE',   hex: '#10b981' },
  { name: 'AMARILLO',hex: '#f59e0b' },
];

interface StroopTrial {
  word: string;
  wordColor: string;
  inkColor: string;
  congruent: boolean;
}

function generateStroopTrial(): StroopTrial {
  const wordIdx = Math.floor(Math.random() * STROOP_COLORS.length);
  const inkIdx = Math.random() < 0.4
    ? wordIdx  // 40% congruent
    : (wordIdx + 1 + Math.floor(Math.random() * (STROOP_COLORS.length - 1))) % STROOP_COLORS.length;
  return {
    word: STROOP_COLORS[wordIdx].name,
    wordColor: STROOP_COLORS[wordIdx].hex,
    inkColor: STROOP_COLORS[inkIdx].hex,
    congruent: wordIdx === inkIdx,
  };
}

function StroopGame({ onDone }: { onDone: (score: number, total: number, avgMs: number) => void }) {
  const [trial, setTrial] = useState<StroopTrial>(generateStroopTrial);
  const [round, setRound] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const trialStart = useRef(Date.now());
  const TOTAL = 15;

  const answer = useCallback((colorHex: string) => {
    const rt = Date.now() - trialStart.current;
    const isCorrect = colorHex === trial.inkColor;
    const newCorrect = correct + (isCorrect ? 1 : 0);
    const newTimes = [...times, rt];
    const newRound = round + 1;

    if (newRound >= TOTAL) {
      const avg = Math.round(newTimes.reduce((a, b) => a + b, 0) / newTimes.length);
      onDone(newCorrect, TOTAL, avg);
    } else {
      setRound(newRound);
      setCorrect(newCorrect);
      setTimes(newTimes);
      setTrial(generateStroopTrial());
      trialStart.current = Date.now();
    }
  }, [trial, correct, times, round, onDone]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="flex gap-1 mb-6">
        {Array.from({ length: TOTAL }).map((_, i) => (
          <div key={i} className="w-2 h-2 rounded-full" style={{ background: i < round ? '#10b981' : i === round ? '#6366f1' : '#e5e7eb' }}/>
        ))}
      </div>

      <p className="text-gray-500 text-sm mb-8">Toca el color de la <strong>TINTA</strong>, no el texto</p>

      <div
        className="text-6xl font-black mb-10 select-none transition-all duration-100"
        style={{ color: trial.inkColor }}
      >
        {trial.word}
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
        {STROOP_COLORS.map(c => (
          <button
            key={c.hex}
            onClick={() => answer(c.hex)}
            className="py-4 rounded-2xl font-bold text-white text-sm active:scale-95 transition"
            style={{ background: c.hex }}
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── NUMBER SPAN ─────────────────────────────────────────────────────────────

function SpanGame({ onDone }: { onDone: (score: number, total: number, avgMs: number) => void }) {
  const [phase, setPhase] = useState<'show' | 'input'>('show');
  const [sequence, setSequence] = useState<number[]>([]);
  const [userInput, setUserInput] = useState<number[]>([]);
  const [, setShowIdx] = useState(0);
  const [level, setLevel] = useState(3);
  const [round, setRound] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [currentNum, setCurrentNum] = useState<number | null>(null);
  const TOTAL_ROUNDS = 8;
  const showIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundStart = useRef(Date.now());

  const startRound = useCallback((lvl: number) => {
    const seq = Array.from({ length: lvl }, () => Math.floor(Math.random() * 9) + 1);
    setSequence(seq);
    setUserInput([]);
    setShowIdx(0);
    setPhase('show');
    setCurrentNum(null);
    roundStart.current = Date.now();

    let i = 0;
    const showNext = () => {
      if (i >= seq.length) {
        setCurrentNum(null);
        setPhase('input');
        return;
      }
      setCurrentNum(seq[i]);
      i++;
      showIntervalRef.current = setTimeout(() => {
        setCurrentNum(null);
        setTimeout(showNext, 300);
      }, 700);
    };
    setTimeout(showNext, 500);
  }, []);

  useEffect(() => { startRound(level); return () => { if (showIntervalRef.current) clearTimeout(showIntervalRef.current); }; }, []);

  const pressNum = (n: number) => {
    if (phase !== 'input') return;
    const newInput = [...userInput, n];
    setUserInput(newInput);

    if (newInput.length === sequence.length) {
      const isCorrect = newInput.every((v, i) => v === sequence[i]);
      const newRound = round + 1;
      const newCorrect = correct + (isCorrect ? 1 : 0);
      const newLevel = isCorrect ? Math.min(level + 1, 9) : Math.max(level - 1, 2);

      if (newRound >= TOTAL_ROUNDS) {
        onDone(newCorrect, TOTAL_ROUNDS, Math.round((Date.now() - roundStart.current) / TOTAL_ROUNDS));
      } else {
        setRound(newRound);
        setCorrect(newCorrect);
        setLevel(newLevel);
        setTimeout(() => startRound(newLevel), 800);
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <p className="text-gray-500 text-sm mb-2">Ronda {round + 1}/{TOTAL_ROUNDS} · Nivel {level}</p>

      {phase === 'show' ? (
        <div className="flex flex-col items-center justify-center h-40">
          <div className="text-8xl font-black text-indigo-600 animate-[bounceIn_0.15s_ease]" key={currentNum}>
            {currentNum ?? '...'}
          </div>
        </div>
      ) : (
        <div className="flex gap-2 mb-6 h-16 items-center">
          {Array.from({ length: sequence.length }).map((_, i) => (
            <div key={i} className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold ${
              i < userInput.length ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-300'
            }`}>
              {userInput[i] ?? '_'}
            </div>
          ))}
        </div>
      )}

      {phase === 'input' && (
        <div className="grid grid-cols-3 gap-2 w-full max-w-[220px]">
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} onClick={() => pressNum(n)}
              className="h-14 rounded-2xl bg-gray-100 text-gray-800 font-bold text-xl hover:bg-indigo-100 hover:text-indigo-700 transition active:scale-95">
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

interface GameResult { game: string; score: number; total: number; avgMs: number; }

export default function EntrenamientoMental({ onBack }: Props) {
  const { user } = useUser();
  const [game, setGame] = useState<GameType>('menu');
  const [results, setResults] = useState<GameResult[]>([]);

  const handleGameDone = async (gameType: string, score: number, total: number, avgMs: number) => {
    const res: GameResult = { game: gameType, score, total, avgMs };
    setResults(prev => [...prev, res]);
    setGame('result');
    markExerciseDone();

    if (user?.id) {
      sql`CREATE TABLE IF NOT EXISTS entrenamiento_mental (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        juego TEXT NOT NULL,
        score INTEGER NOT NULL,
        total INTEGER NOT NULL,
        avg_ms INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`.catch(() => {});
      sql`INSERT INTO entrenamiento_mental (user_id, juego, score, total, avg_ms, created_at)
          VALUES (${user.id}, ${gameType}, ${score}, ${total}, ${avgMs}, NOW())`.catch(() => {});
    }
  };

  if (game === 'stroop') return (
    <div className="min-h-screen bg-white">
      <div className="bg-gray-800 px-4 pt-10 pb-4 flex items-center gap-3">
        <button onClick={() => setGame('menu')} className="text-gray-400 hover:text-white transition"><ArrowLeft className="w-5 h-5"/></button>
        <p className="text-white font-bold">Test de Stroop</p>
      </div>
      <StroopGame onDone={(s, t, ms) => handleGameDone('stroop', s, t, ms)}/>
    </div>
  );

  if (game === 'span') return (
    <div className="min-h-screen bg-white">
      <div className="bg-gray-800 px-4 pt-10 pb-4 flex items-center gap-3">
        <button onClick={() => setGame('menu')} className="text-gray-400 hover:text-white transition"><ArrowLeft className="w-5 h-5"/></button>
        <p className="text-white font-bold">Span de Dígitos</p>
      </div>
      <SpanGame onDone={(s, t, ms) => handleGameDone('span', s, t, ms)}/>
    </div>
  );

  if (game === 'result' && results.length > 0) {
    const last = results[results.length - 1];
    const pct = Math.round((last.score / last.total) * 100);
    const gameNames: Record<string, string> = { stroop: 'Test de Stroop', span: 'Span de Dígitos' };
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gray-800 px-4 pt-10 pb-6 text-white">
          <button onClick={() => setGame('menu')} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition">
            <ArrowLeft className="w-4 h-4"/> Menú
          </button>
          <h1 className="text-xl font-black">Resultado</h1>
        </div>
        <div className="p-4 max-w-md mx-auto">
          <div className={`rounded-3xl p-6 text-center text-white mb-4 animate-[bounceIn_0.5s_ease] ${
            pct >= 80 ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
            : pct >= 60 ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
            : 'bg-gradient-to-br from-amber-500 to-orange-600'
          }`}>
            <p className="text-white/80 text-sm">{gameNames[last.game]}</p>
            <p className="text-5xl font-black my-2">{last.score}/{last.total}</p>
            <p className="text-lg font-bold">{pct >= 80 ? 'Excelente' : pct >= 60 ? 'Bueno' : 'A mejorar'}</p>
            <p className="text-white/70 text-xs mt-1">Tiempo promedio: {last.avgMs}ms por ítem</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setGame('menu')} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
              Otro juego
            </button>
            <button onClick={onBack} className="flex-1 py-3 rounded-xl bg-gray-800 text-white text-sm font-bold hover:bg-gray-900 transition">
              Volver
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Menu
  const GAMES = [
    {
      id: 'stroop' as GameType,
      nombre: 'Test de Stroop',
      desc: 'Identifica el color de la tinta, no el texto. Ejercita la atención selectiva y control inhibitorio.',
      icon: '🧠',
      duracion: '2-3 min',
      dificultad: 'Moderado',
    },
    {
      id: 'span' as GameType,
      nombre: 'Span de Dígitos',
      desc: 'Memoriza y reproduce secuencias numéricas. Entrena la memoria de trabajo visual.',
      icon: '🔢',
      duracion: '3-4 min',
      dificultad: 'Adaptativo',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-gray-800 to-slate-900 px-4 pt-10 pb-8 text-white">
        <button onClick={onBack} className="flex items-center gap-2 text-white/60 hover:text-white text-sm mb-6 transition">
          <ArrowLeft className="w-4 h-4"/> Volver
        </button>
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6 text-indigo-300"/>
          <div>
            <h1 className="text-2xl font-black">Entrenamiento Visual-Cognitivo</h1>
            <p className="text-gray-400 text-sm mt-0.5">Ejercicios que combinan visión y cognición</p>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-3 mb-4 text-xs text-indigo-700">
          Estos ejercicios entrenan la conexión entre el sistema visual y el procesamiento cognitivo.
          Usados en rehabilitación neurológica y entrenamiento deportivo de alto rendimiento.
        </div>
        <div className="space-y-3">
          {GAMES.map(g => (
            <button key={g.id} onClick={() => setGame(g.id)}
              className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-left hover:border-indigo-200 hover:shadow-md transition group">
              <div className="flex items-start gap-3">
                <span className="text-3xl">{g.icon}</span>
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{g.nombre}</p>
                  <p className="text-gray-500 text-sm mt-0.5 leading-snug">{g.desc}</p>
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{g.duracion}</span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{g.dificultad}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
