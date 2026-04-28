// =========================================
// JUEGOS VISUALES TERAPÉUTICOS — Therapheye
// 3 mini-juegos clínicamente basados:
// 1. Sigue el Punto   2. Sacádico   3. Enfoque Dinámico
// =========================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Trophy, Gamepad2, Star, RotateCcw, Play } from 'lucide-react';
import { sql } from '../neonCliente';
import { useUser } from '../context/UserContext';

interface Props { onBack: () => void; }

type GameId = 'sigue-punto' | 'sacadico' | 'enfoque';
type GameState = 'menu' | 'playing' | 'result';

// ─────────────────────────────────────────
// JUEGO 1: SIGUE EL PUNTO
// ─────────────────────────────────────────

function JuegoPunto({ onFinish }: { onFinish: (score: number, duration: number) => void }) {
  const GAME_SECS = 60;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const startRef = useRef(Date.now());
  const scoreRef = useRef(0);
  const [timeLeft, setTimeLeft] = useState(GAME_SECS);
  const [score, setScore] = useState(0);
  const dotRef = useRef({ x: 200, y: 200, vx: 2.5, vy: 1.8, t: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height;

    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      dotRef.current.t += dt;

      const t = dotRef.current.t;
      // Trayectoria sinusoidal
      const x = W / 2 + Math.sin(t * 0.9) * (W * 0.38);
      const y = H / 2 + Math.sin(t * 1.3) * (H * 0.38);
      dotRef.current.x = x;
      dotRef.current.y = y;

      ctx.clearRect(0, 0, W, H);
      // Fondo
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, W, H);
      // Estela
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(99,102,241,0.15)';
      ctx.fill();
      // Punto
      const pulse = 1 + 0.08 * Math.sin(t * 8);
      ctx.beginPath();
      ctx.arc(x, y, 14 * pulse, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(x - 3, y - 3, 2, x, y, 14);
      grad.addColorStop(0, '#a78bfa');
      grad.addColorStop(1, '#6366f1');
      ctx.fillStyle = grad;
      ctx.fill();

      const elapsed = (Date.now() - startRef.current) / 1000;
      const left = Math.max(0, GAME_SECS - elapsed);
      setTimeLeft(Math.ceil(left));
      if (left <= 0) { onFinish(scoreRef.current, GAME_SECS); return; }
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [onFinish]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const d = Math.hypot(mx - dotRef.current.x, my - dotRef.current.y);
    if (d < 30) {
      scoreRef.current += 10;
      setScore(s => s + 10);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-6 text-sm font-bold">
        <span className="text-purple-300">⏱ {timeLeft}s</span>
        <span className="text-yellow-300">⭐ {score} pts</span>
      </div>
      <canvas
        ref={canvasRef}
        width={500} height={350}
        onClick={handleClick}
        className="rounded-2xl cursor-crosshair w-full max-w-lg"
        style={{ touchAction: 'none' }}
      />
      <p className="text-gray-400 text-xs">Haz clic sobre el punto para sumar puntos</p>
    </div>
  );
}

// ─────────────────────────────────────────
// JUEGO 2: SACÁDICO
// ─────────────────────────────────────────

function JuegoSacadico({ onFinish }: { onFinish: (score: number, duration: number) => void }) {
  const GAME_SECS = 45;
  const TOTAL_REPS = 20;
  const [active, setActive] = useState<'left' | 'right'>('left');
  const [clicks, setClicks] = useState(0);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const lastShownRef = useRef(Date.now());
  const startRef = useRef(Date.now());
  const [timeLeft, setTimeLeft] = useState(GAME_SECS);
  const doneRef = useRef(false);

  useEffect(() => {
    const iv = setInterval(() => {
      const left = Math.max(0, GAME_SECS - (Date.now() - startRef.current) / 1000);
      setTimeLeft(Math.ceil(left));
      if (left <= 0 && !doneRef.current) {
        doneRef.current = true;
        const avgMs = reactionTimes.length ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length) : 999;
        const score = Math.max(0, Math.round(1000 - avgMs / 2) * Math.max(1, clicks));
        onFinish(Math.min(score, 9999), GAME_SECS);
      }
    }, 200);
    return () => clearInterval(iv);
  }, [reactionTimes, clicks, onFinish]);

  const handleClick = (side: 'left' | 'right') => {
    if (side !== active || doneRef.current) return;
    const rt = Date.now() - lastShownRef.current;
    setReactionTimes(prev => [...prev, rt]);
    const newClicks = clicks + 1;
    setClicks(newClicks);
    const next = active === 'left' ? 'right' : 'left';
    setActive(next);
    lastShownRef.current = Date.now();
    if (newClicks >= TOTAL_REPS && !doneRef.current) {
      doneRef.current = true;
      const avgMs = [...reactionTimes, rt].reduce((a, b) => a + b, 0) / (reactionTimes.length + 1);
      const score = Math.max(0, Math.round(1000 - avgMs / 2) * newClicks);
      onFinish(Math.min(score, 9999), Math.round((Date.now() - startRef.current) / 1000));
    }
  };

  const avgMs = reactionTimes.length ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length) : '—';

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="flex items-center gap-6 text-sm font-bold">
        <span className="text-blue-300">⏱ {timeLeft}s</span>
        <span className="text-yellow-300">✅ {clicks}/{TOTAL_REPS}</span>
        <span className="text-cyan-300">⚡ {avgMs}ms</span>
      </div>

      <div className="grid grid-cols-2 gap-6 w-full max-w-lg">
        {(['left', 'right'] as const).map(side => (
          <button
            key={side}
            onClick={() => handleClick(side)}
            className={`h-40 rounded-2xl font-black text-3xl transition-all duration-150 border-4 select-none
              ${active === side
                ? 'bg-blue-500 border-blue-300 text-white scale-105 shadow-2xl shadow-blue-500/50'
                : 'bg-gray-800 border-gray-700 text-gray-600 scale-100'}
            `}
          >
            {side === 'left' ? '◀' : '▶'}
          </button>
        ))}
      </div>

      <p className="text-gray-400 text-xs text-center">
        Alterna haciendo clic en el punto iluminado lo más rápido posible
      </p>
    </div>
  );
}

// ─────────────────────────────────────────
// JUEGO 3: ENFOQUE DINÁMICO
// ─────────────────────────────────────────

const LETTERS = ['E', 'F', 'T', 'O', 'Z', 'P', 'L', 'C', 'D'];

function JuegoEnfoque({ onFinish }: { onFinish: (score: number, duration: number) => void }) {
  const GAME_SECS = 60;
  const TARGET_LETTER = 'F';
  const [size, setSize] = useState(12);
  const [growing, setGrowing] = useState(true);
  const [currentLetter, setCurrentLetter] = useState(TARGET_LETTER);
  const [score, setScore] = useState(0);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_SECS);
  const startRef = useRef(Date.now());
  const doneRef = useRef(false);
  const scoreRef = useRef(0);
  const hitsRef = useRef(0);
  const missesRef = useRef(0);
  const lastPressRef = useRef(0);

  // Ciclo de tamaño
  useEffect(() => {
    const iv = setInterval(() => {
      setSize(s => {
        let ns = growing ? s + 1.5 : s - 1.5;
        if (ns >= 72) { setGrowing(false); ns = 72; }
        if (ns <= 10) { setGrowing(true); ns = 10;
          // Cambiar letra al llegar al mínimo
          setCurrentLetter(LETTERS[Math.floor(Math.random() * LETTERS.length)]);
        }
        return ns;
      });
    }, 80);
    return () => clearInterval(iv);
  }, [growing]);

  // Timer
  useEffect(() => {
    const iv = setInterval(() => {
      const left = Math.max(0, GAME_SECS - (Date.now() - startRef.current) / 1000);
      setTimeLeft(Math.ceil(left));
      if (left <= 0 && !doneRef.current) {
        doneRef.current = true;
        onFinish(scoreRef.current, GAME_SECS);
      }
    }, 200);
    return () => clearInterval(iv);
  }, [onFinish]);

  const handlePress = useCallback(() => {
    if (doneRef.current) return;
    const now = Date.now();
    if (now - lastPressRef.current < 300) return; // debounce
    lastPressRef.current = now;

    if (currentLetter === TARGET_LETTER) {
      const pts = Math.round(10 + (growing ? size * 0.3 : (72 - size) * 0.5));
      scoreRef.current += pts;
      hitsRef.current++;
      setScore(scoreRef.current);
      setHits(hitsRef.current);
    } else {
      scoreRef.current = Math.max(0, scoreRef.current - 5);
      missesRef.current++;
      setScore(scoreRef.current);
      setMisses(missesRef.current);
    }
  }, [currentLetter, growing, size]);

  // Tecla espacio
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); handlePress(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [handlePress]);

  const isTarget = currentLetter === TARGET_LETTER;

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="flex items-center gap-6 text-sm font-bold">
        <span className="text-green-300">⏱ {timeLeft}s</span>
        <span className="text-yellow-300">⭐ {score} pts</span>
        <span className="text-cyan-300">✅ {hits} hits</span>
        <span className="text-red-400">❌ {misses}</span>
      </div>

      <div
        className={`w-full max-w-lg h-52 rounded-2xl flex flex-col items-center justify-center cursor-pointer select-none transition-colors ${isTarget ? 'bg-gray-900' : 'bg-gray-800'}`}
        onClick={handlePress}
        role="button"
        tabIndex={0}
      >
        <span
          className={`font-black transition-all duration-75 ${isTarget ? 'text-violet-300' : 'text-gray-400'}`}
          style={{ fontSize: size }}
        >
          {currentLetter}
        </span>
        <p className="text-gray-600 text-xs mt-3">
          Presiona <kbd className="bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded text-[10px]">Espacio</kbd> o toca cuando veas <span className="text-violet-300 font-bold">{TARGET_LETTER}</span>
        </p>
      </div>

      <p className="text-gray-400 text-xs text-center">
        Presiona cuando la letra <b className="text-violet-300">{TARGET_LETTER}</b> esté en su tamaño más pequeño o más enfocado — simula el ejercicio de acomodación visual
      </p>
    </div>
  );
}

// ─────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────

const GAME_META: Record<GameId, { title: string; desc: string; clinical: string; color: string; gradient: string; icon: string }> = {
  'sigue-punto': {
    title: 'Sigue el Punto',
    desc: 'Sigue un punto en movimiento y haz clic sobre él',
    clinical: 'Entrena seguimiento suave (smooth pursuit)',
    color: 'from-violet-600 to-purple-700',
    gradient: 'bg-violet-900',
    icon: '🔵',
  },
  'sacadico': {
    title: 'Sacádico',
    desc: 'Alterna entre dos puntos lo más rápido posible',
    clinical: 'Entrena movimientos sacádicos y tiempo de reacción',
    color: 'from-blue-600 to-cyan-700',
    gradient: 'bg-blue-900',
    icon: '⚡',
  },
  'enfoque': {
    title: 'Enfoque Dinámico',
    desc: 'Presiona cuando veas la letra objetivo más pequeña',
    clinical: 'Entrena acomodación y enfoque visual',
    color: 'from-emerald-600 to-teal-700',
    gradient: 'bg-emerald-900',
    icon: '🎯',
  },
};

export default function JuegosVisuales({ onBack }: Props) {
  const { user } = useUser();
  const [gameState, setGameState] = useState<GameState>('menu');
  const [selectedGame, setSelectedGame] = useState<GameId | null>(null);
  const [lastScore, setLastScore] = useState(0);
  const [lastDuration, setLastDuration] = useState(0);
  const [records, setRecords] = useState<Record<GameId, number>>({ 'sigue-punto': 0, 'sacadico': 0, 'enfoque': 0 });
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [saving, setSaving] = useState(false);

  // Cargar récords
  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      try {
        const rows = await sql`
          SELECT game_id, MAX(score) as best
          FROM minijuegos_scores
          WHERE user_id = ${user.id}
          GROUP BY game_id
        `.catch(() => []) as any[];

        const rec: Record<GameId, number> = { 'sigue-punto': 0, 'sacadico': 0, 'enfoque': 0 };
        rows.forEach((r: any) => { rec[r.game_id as GameId] = Number(r.best); });
        setRecords(rec);
      } catch { /* ignore */ }
      setLoadingRecords(false);
    };
    load();
  }, [user?.id]);

  const handleGameFinish = useCallback(async (score: number, duration: number) => {
    setLastScore(score);
    setLastDuration(duration);
    setGameState('result');

    if (!user?.id || !selectedGame) return;
    setSaving(true);
    try {
      await sql`INSERT INTO minijuegos_scores (user_id, game_id, score, duration)
                VALUES (${user.id}, ${selectedGame}, ${score}, ${duration})`;
      if (score > records[selectedGame]) {
        setRecords(prev => ({ ...prev, [selectedGame]: score }));
      }
    } catch (e) { console.error('[JuegosVisuales] save score', e); }
    setSaving(false);
  }, [user?.id, selectedGame, records]);

  const startGame = (id: GameId) => {
    setSelectedGame(id);
    setGameState('playing');
  };

  const meta = selectedGame ? GAME_META[selectedGame] : null;
  const isNewRecord = selectedGame && lastScore > 0 && lastScore >= records[selectedGame];

  return (
    <div className="flex flex-col h-screen bg-[#0a0f1e] text-white">

      {/* Header */}
      <header className="px-5 py-4 flex items-center justify-between border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={gameState === 'menu' ? onBack : () => setGameState('menu')}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition text-white">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-lg font-black flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-violet-400" /> Juegos Visuales
            </h1>
            <p className="text-xs text-gray-400">Ejercicios terapéuticos gamificados</p>
          </div>
        </div>
        {gameState === 'playing' && meta && (
          <div className="text-right">
            <p className="text-xs font-bold text-white">{meta.title}</p>
            <p className="text-[10px] text-gray-400">{meta.icon} En progreso</p>
          </div>
        )}
      </header>

      {/* Contenido */}
      <main className="flex-1 overflow-y-auto p-5">

        {/* ── MENÚ ── */}
        {gameState === 'menu' && (
          <div className="max-w-2xl mx-auto space-y-4">
            <p className="text-gray-400 text-sm text-center mb-6">
              Entrena tu sistema visual con juegos diseñados clínicamente.<br/>
              Los resultados se guardan automáticamente.
            </p>

            {(Object.entries(GAME_META) as [GameId, typeof GAME_META[GameId]][]).map(([id, g]) => (
              <div key={id}
                className={`rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-r ${g.color} cursor-pointer hover:scale-[1.01] transition-all`}
                onClick={() => startGame(id)}
              >
                <div className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-4xl">{g.icon}</span>
                    <div>
                      <p className="text-white font-black text-lg">{g.title}</p>
                      <p className="text-white/80 text-xs mt-0.5">{g.desc}</p>
                      <p className="text-white/60 text-[10px] mt-1 italic">🩺 {g.clinical}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    {!loadingRecords && (
                      <div className="flex items-center gap-1.5 bg-black/30 rounded-xl px-3 py-2">
                        <Trophy className="w-3.5 h-3.5 text-yellow-400" />
                        <span className="text-yellow-300 text-sm font-black">{records[id]}</span>
                      </div>
                    )}
                    <button className="mt-2 flex items-center gap-1 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-xl text-xs font-bold transition">
                      <Play className="w-3 h-3" /> Jugar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── JUGANDO ── */}
        {gameState === 'playing' && selectedGame && (
          <div className="max-w-2xl mx-auto">
            {selectedGame === 'sigue-punto' && <JuegoPunto onFinish={handleGameFinish} />}
            {selectedGame === 'sacadico' && <JuegoSacadico onFinish={handleGameFinish} />}
            {selectedGame === 'enfoque' && <JuegoEnfoque onFinish={handleGameFinish} />}
          </div>
        )}

        {/* ── RESULTADO ── */}
        {gameState === 'result' && selectedGame && meta && (
          <div className="max-w-md mx-auto text-center space-y-6">
            {/* Animación de resultado */}
            <div className={`w-32 h-32 mx-auto rounded-full bg-gradient-to-br ${meta.color} flex items-center justify-center shadow-2xl`}>
              <span className="text-5xl">{isNewRecord ? '🏆' : meta.icon}</span>
            </div>

            <div>
              <p className="text-gray-400 text-sm">{meta.title}</p>
              <p className="text-5xl font-black text-white mt-1">{lastScore}</p>
              <p className="text-gray-400 text-xs mt-1">puntos · {lastDuration}s</p>
            </div>

            {isNewRecord && (
              <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/40 rounded-2xl p-4 flex items-center gap-3 justify-center">
                <Star className="w-5 h-5 text-yellow-400" />
                <div className="text-left">
                  <p className="text-yellow-300 font-bold text-sm">¡Nuevo récord personal!</p>
                  <p className="text-yellow-300/70 text-xs">Antes: {records[selectedGame]} pts</p>
                </div>
              </div>
            )}

            {saving && <p className="text-gray-500 text-xs">Guardando resultado...</p>}

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => startGame(selectedGame)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r ${meta.color} text-white hover:opacity-90 transition`}
              >
                <RotateCcw className="w-4 h-4" /> Jugar de nuevo
              </button>
              <button
                onClick={() => setGameState('menu')}
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-white/10 hover:bg-white/20 text-white transition"
              >
                Menú
              </button>
            </div>

            {/* Récords de todos los juegos */}
            <div className="bg-white/5 rounded-2xl p-4 mt-2">
              <p className="text-gray-400 text-xs font-bold uppercase tracking-wide mb-3">Tus récords</p>
              {(Object.entries(GAME_META) as [GameId, typeof GAME_META[GameId]][]).map(([id, g]) => (
                <div key={id} className="flex items-center justify-between py-1.5 border-b border-white/10 last:border-0">
                  <span className="text-gray-300 text-xs">{g.icon} {g.title}</span>
                  <div className="flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-yellow-400" />
                    <span className="text-yellow-300 text-xs font-bold">{records[id]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
