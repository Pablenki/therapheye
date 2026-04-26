// =========================================
// TEST DE SENSIBILIDAD AL CONTRASTE — Therapheye
// Letras que van de alto contraste a bajo
// El usuario presiona espacio cuando ya no puede leer
// =========================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Eye, AlertCircle, Check } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { sql } from '../neonCliente';

interface Props { onBack: () => void; }

// Letras del test Pelli-Robson (ojo: cada fila 3 letras)
const LETRAS_TEST = [
  ['H', 'S', 'D'],  // Nivel 1 — 100% contraste
  ['N', 'C', 'K'],  // Nivel 2 — 85%
  ['R', 'O', 'Z'],  // Nivel 3 — 70%
  ['V', 'S', 'R'],  // Nivel 4 — 55%
  ['H', 'N', 'D'],  // Nivel 5 — 40%
  ['C', 'O', 'V'],  // Nivel 6 — 27%
  ['K', 'Z', 'S'],  // Nivel 7 — 17%
  ['D', 'H', 'N'],  // Nivel 8 — 10%
  ['R', 'V', 'C'],  // Nivel 9 — 6%
  ['O', 'K', 'Z'],  // Nivel 10 — 3%
];

// Contraste como opacidad del texto sobre blanco
const CONTRAST_LEVELS = [1.0, 0.85, 0.70, 0.55, 0.40, 0.28, 0.18, 0.11, 0.07, 0.035];

type Phase = 'instrucciones' | 'test' | 'resultado';

function getContrastLabel(nivelFinal: number): { label: string; color: string; desc: string } {
  if (nivelFinal >= 8) return { label: 'Excelente', color: 'emerald', desc: 'Sensibilidad al contraste superior. Detallas bien en condiciones de poca luz.' };
  if (nivelFinal >= 6) return { label: 'Normal', color: 'blue', desc: 'Sensibilidad al contraste dentro del rango normal para su edad.' };
  if (nivelFinal >= 4) return { label: 'Reducida', color: 'amber', desc: 'Puede tener dificultad con detalles de poco contraste. Se recomienda evaluación.' };
  return { label: 'Baja', color: 'red', desc: 'Sensibilidad al contraste significativamente reducida. Consulta a un especialista.' };
}

export default function ContrastTest({ onBack }: Props) {
  const { user } = useUser();
  const [phase, setPhase] = useState<Phase>('instrucciones');
  const [nivelActual, setNivelActual] = useState(0);   // 0–9
  const [nivelFinal, setNivelFinal] = useState(0);
  const [showing, setShowing] = useState(true);        // show/hide letter row
  const [letraIdx, setLetraIdx] = useState(0);         // which letter in the row (0-2)
  const [, setRespuestas] = useState<boolean[]>([]);
  const [savedOk, setSavedOk] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => { if (timerRef.current) clearTimeout(timerRef.current); };

  // Start the test
  const startTest = () => {
    setNivelActual(0);
    setLetraIdx(0);
    setRespuestas([]);
    setShowing(true);
    setPhase('test');
  };

  // User says "can still read" → advance to next letter / next level
  const canRead = useCallback(() => {
    setRespuestas(prev => [...prev, true]);
    if (letraIdx < 2) {
      setLetraIdx(l => l + 1);
    } else {
      // Move to next contrast level
      const next = nivelActual + 1;
      if (next >= CONTRAST_LEVELS.length) {
        // Passed all levels!
        finishTest(nivelActual);
      } else {
        setNivelActual(next);
        setLetraIdx(0);
        setShowing(false);
        timerRef.current = setTimeout(() => setShowing(true), 400);
      }
    }
  }, [letraIdx, nivelActual]);

  // User says "cannot read" → test ends
  const cannotRead = useCallback(() => {
    setRespuestas(prev => [...prev, false]);
    finishTest(nivelActual > 0 ? nivelActual - 1 : 0);
  }, [nivelActual]);

  const finishTest = (nivel: number) => {
    clearTimer();
    setNivelFinal(nivel);
    setPhase('resultado');

    if (user?.id) {
      sql`CREATE TABLE IF NOT EXISTS contrast_tests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        nivel_final INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`.catch(() => {});
      sql`INSERT INTO contrast_tests (user_id, nivel_final, created_at)
          VALUES (${user.id}, ${nivel}, NOW())`.then(() => setSavedOk(true)).catch(() => {});
    }
  };

  // Keyboard handler during test
  useEffect(() => {
    if (phase !== 'test') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); cannotRead(); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); canRead(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, canRead, cannotRead]);

  // Cleanup
  useEffect(() => () => clearTimer(), []);

  const contrastOpacity = CONTRAST_LEVELS[nivelActual];
  const letrasNivel = LETRAS_TEST[nivelActual];
  const letraActual = letrasNivel[letraIdx];

  // ── Instrucciones ──────────────────────────────────────────────────────────
  if (phase === 'instrucciones') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-slate-800 to-gray-900 px-4 pt-10 pb-8 text-white">
          <button onClick={onBack} className="flex items-center gap-2 text-white/70 hover:text-white text-sm mb-6 transition">
            <ArrowLeft className="w-4 h-4"/> Volver
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
              <Eye className="w-6 h-6 text-gray-200"/>
            </div>
            <div>
              <h1 className="text-2xl font-black">Test de Contraste</h1>
              <p className="text-gray-300 text-sm">Sensibilidad al contraste visual</p>
            </div>
          </div>
        </div>

        <div className="p-4 max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
            <h2 className="font-bold text-gray-900 mb-3">Instrucciones</h2>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                <p>Colócate a unos <strong>50-60 cm</strong> de la pantalla, con buena iluminación ambiental.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                <p>Se mostrará <strong>una letra a la vez</strong>. El contraste irá disminuyendo progresivamente.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                <p>Si puedes leer la letra, presiona <strong>→ (flecha derecha)</strong> o el botón "Sí, la veo".</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                <p>Cuando ya <strong>no puedas identificar</strong> la letra, presiona <strong>Espacio</strong> o "No la veo".</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">5</span>
                <p>No fuerces la vista. Se honesto: si adivinas, el resultado no será útil.</p>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-5 flex items-start gap-2 text-xs text-amber-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/>
            <p>Este test es orientativo. No reemplaza un examen de contraste clínico con tabla Pelli-Robson. Usa corrección óptica si la tienes.</p>
          </div>

          {/* Preview card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-5 text-center">
            <p className="text-xs text-gray-500 mb-2">Vista previa del test:</p>
            <div className="flex justify-center gap-4">
              {CONTRAST_LEVELS.slice(0, 5).map((op, i) => (
                <span key={i} className="text-4xl font-bold font-mono" style={{ color: `rgba(0,0,0,${op})` }}>
                  {LETRAS_TEST[i][0]}
                </span>
              ))}
            </div>
          </div>

          <button
            onClick={startTest}
            className="w-full py-4 rounded-2xl bg-gray-900 text-white font-bold text-base hover:bg-gray-800 transition shadow-lg"
          >
            Comenzar test
          </button>
        </div>
      </div>
    );
  }

  // ── Test ───────────────────────────────────────────────────────────────────
  if (phase === 'test') {
    const pctDone = (nivelActual * 3 + letraIdx) / (LETRAS_TEST.length * 3);

    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <button onClick={() => setPhase('instrucciones')} className="text-gray-500 hover:text-gray-700 transition">
            <ArrowLeft className="w-5 h-5"/>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Contraste:</span>
            <div className="flex gap-1">
              {CONTRAST_LEVELS.map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full ${i < nivelActual ? 'bg-indigo-300' : i === nivelActual ? 'bg-indigo-600' : 'bg-gray-100'}`}/>
              ))}
            </div>
          </div>
          <span className="text-xs text-gray-400">{Math.round(pctDone * 100)}%</span>
        </div>

        {/* Letter display */}
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div
            className="transition-opacity duration-500 select-none"
            style={{ opacity: showing ? 1 : 0 }}
          >
            <span
              className="font-mono font-black leading-none"
              style={{
                fontSize: 'clamp(80px, 20vw, 180px)',
                color: `rgba(0, 0, 0, ${contrastOpacity})`,
              }}
            >
              {letraActual}
            </span>
          </div>

          <p className="mt-4 text-gray-400 text-sm">
            Letra {letraIdx + 1} de 3 — Nivel {nivelActual + 1}
          </p>
        </div>

        {/* Controls */}
        <div className="p-4 pb-8 max-w-sm mx-auto w-full">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <button
              onClick={canRead}
              className="py-4 rounded-2xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 transition active:scale-95 flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5"/> Sí, la veo
            </button>
            <button
              onClick={cannotRead}
              className="py-4 rounded-2xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition active:scale-95 flex items-center justify-center gap-2"
            >
              <Eye className="w-5 h-5 opacity-50"/> No la veo
            </button>
          </div>
          <p className="text-center text-xs text-gray-400">
            Teclado: <kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">→</kbd> la veo &nbsp;·&nbsp;
            <kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">Espacio</kbd> no la veo
          </p>
        </div>
      </div>
    );
  }

  // ── Resultado ─────────────────────────────────────────────────────────────
  const { label, color, desc } = getContrastLabel(nivelFinal);
  const colorMap: Record<string, string> = {
    emerald: 'from-emerald-50 to-teal-50 border-emerald-200',
    blue: 'from-blue-50 to-indigo-50 border-blue-200',
    amber: 'from-amber-50 to-orange-50 border-amber-200',
    red: 'from-red-50 to-rose-50 border-red-200',
  };
  const textMap: Record<string, string> = {
    emerald: 'text-emerald-700', blue: 'text-blue-700', amber: 'text-amber-700', red: 'text-red-700',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-slate-800 to-gray-900 px-4 pt-10 pb-8 text-white">
        <button onClick={onBack} className="flex items-center gap-2 text-white/70 hover:text-white text-sm mb-6 transition">
          <ArrowLeft className="w-4 h-4"/> Volver
        </button>
        <h1 className="text-2xl font-black">Resultado del Test</h1>
        <p className="text-gray-300 text-sm mt-1">Sensibilidad al contraste</p>
      </div>

      <div className="p-4 max-w-md mx-auto">
        {/* Main result card */}
        <div className={`bg-gradient-to-br ${colorMap[color]} border rounded-3xl p-6 mb-4 text-center animate-[bounceIn_0.5s_ease]`}>
          <p className="text-sm font-medium text-gray-600 mb-1">Sensibilidad al contraste</p>
          <p className={`text-4xl font-black mb-1 ${textMap[color]}`}>{label}</p>
          <p className="text-sm text-gray-600">Nivel {nivelFinal + 1} de {LETRAS_TEST.length}</p>
          <div className="mt-4 flex justify-center gap-1">
            {LETRAS_TEST.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full ${i <= nivelFinal ? `bg-${color}-400` : 'bg-gray-200'}`}
                style={{ width: `${80 / LETRAS_TEST.length}%` }}
              />
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
          <p className="text-sm text-gray-700 leading-relaxed">{desc}</p>
        </div>

        {/* What is contrast sensitivity */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 mb-4">
          <h3 className="font-bold text-indigo-900 text-sm mb-2">¿Qué significa esto?</h3>
          <p className="text-xs text-indigo-700 leading-relaxed">
            La sensibilidad al contraste mide tu capacidad para distinguir objetos de su fondo cuando tienen
            un contraste similar. Es diferente a la agudeza visual (tabla de Snellen). Puede verse afectada
            por cataratas, glaucoma, neuritis óptica, o simple fatiga visual.
          </p>
        </div>

        {savedOk && (
          <p className="text-center text-xs text-emerald-600 mb-3">✓ Resultado guardado en tu historial</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={startTest}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
          >
            Repetir test
          </button>
          <button
            onClick={onBack}
            className="flex-1 py-3 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
}
