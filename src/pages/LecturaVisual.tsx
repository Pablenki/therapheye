// =========================================
// PRUEBA DE LECTURA VISUAL — Therapheye
// Test de agudeza lectora con reconocimiento de voz
// Inspirado en pruebas optométricas reales
// =========================================

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ArrowLeft, Mic, MicOff, ChevronRight,
  Eye, CheckCircle2, XCircle,
  Info, Save, Loader2, Award,
} from 'lucide-react';
import { sql } from '../neonCliente';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../i18n';
import { useExerciseValidator } from '../hooks/useExerciseValidator';

interface Props { onBack: () => void }

// ─── Textos de prueba en español e inglés ────────────────────────────────────

const LEVELS_ES = [
  {
    level: 1, size: 48, label: 'Nivel 1 — Muy grande',
    text: 'Cuida tu visión cada día.',
    description: '~20/200 — visible con agudeza muy reducida',
  },
  {
    level: 2, size: 34, label: 'Nivel 2 — Grande',
    text: 'El parpadeo frecuente lubrica y protege tus ojos.',
    description: '~20/100 — lectura básica funcional',
  },
  {
    level: 3, size: 24, label: 'Nivel 3 — Mediano',
    text: 'Realiza pausas visuales cada veinte minutos para descansar la vista y reducir la fatiga.',
    description: '~20/50 — lectura cómoda para adultos',
  },
  {
    level: 4, size: 17, label: 'Nivel 4 — Pequeño',
    text: 'La fatiga ocular puede causar visión borrosa, dolores de cabeza y dificultad para concentrarse durante el trabajo.',
    description: '~20/25 — lectura de texto de periódico',
  },
  {
    level: 5, size: 13, label: 'Nivel 5 — Muy pequeño',
    text: 'La miopía, hipermetropía y astigmatismo son los defectos refractivos más frecuentes y se corrigen con lentes graduadas o cirugía refractiva láser.',
    description: '~20/20 — agudeza visual óptima',
  },
];

const LEVELS_EN = [
  {
    level: 1, size: 48, label: 'Level 1 — Very large',
    text: 'Take care of your vision every day.',
    description: '~20/200 — visible with very reduced acuity',
  },
  {
    level: 2, size: 34, label: 'Level 2 — Large',
    text: 'Frequent blinking keeps your eyes lubricated and protected.',
    description: '~20/100 — basic functional reading',
  },
  {
    level: 3, size: 24, label: 'Level 3 — Medium',
    text: 'Take visual breaks every twenty minutes to rest your eyes and reduce fatigue.',
    description: '~20/50 — comfortable reading for adults',
  },
  {
    level: 4, size: 17, label: 'Level 4 — Small',
    text: 'Eye strain can cause blurred vision, headaches and difficulty concentrating during work.',
    description: '~20/25 — newspaper text reading',
  },
  {
    level: 5, size: 13, label: 'Level 5 — Very small',
    text: 'Myopia, hyperopia and astigmatism are the most common refractive defects and are corrected with prescription lenses or refractive laser surgery.',
    description: '~20/20 — optimal visual acuity',
  },
];

// ─── Algoritmo de comparación ─────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '').trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i || j)
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

function wordsMatch(a: string, b: string): boolean {
  const na = normalize(a), nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const tol = Math.floor(Math.min(na.length, nb.length) / 4);
  return tol > 0 && levenshtein(na, nb) <= tol;
}

interface WordResult { word: string; matched: boolean }

function compareTexts(original: string, spoken: string): { words: WordResult[]; score: number } {
  const origWords = original.trim().split(/\s+/);
  const spokenWords = normalize(spoken).split(/\s+/);
  let matched = 0;
  const words: WordResult[] = origWords.map(word => {
    const m = spokenWords.some(sw => wordsMatch(word, sw));
    if (m) matched++;
    return { word, matched: m };
  });
  return { words, score: origWords.length > 0 ? Math.round((matched / origWords.length) * 100) : 0 };
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Eye = 'left' | 'right' | 'both';

interface LevelResult {
  level: number;
  score: number;
  skipped: boolean;
  words: WordResult[];
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function LecturaVisual({ onBack }: Props) {
  const { user } = useUser();
  const { lang } = useLanguage();
  const LEVELS = lang === 'en' ? LEVELS_EN : LEVELS_ES;

  const [eye, setEye] = useState<Eye>('both');
  const [currentLevel, setCurrentLevel] = useState(0);
  const [results, setResults] = useState<LevelResult[]>([]);
  const [phase, setPhase] = useState<'config' | 'test' | 'done'>('config');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [levelResult, setLevelResult] = useState<{ words: WordResult[]; score: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [noSpeech, setNoSpeech] = useState(false);

  // Camera validation (optional)
  const [useValidator, setUseValidator] = useState(false);
  const [selectedDistance, setSelectedDistance] = useState(40);
  const { state: val, start: startVal, stop: stopVal, videoRef: valVideoRef } = useExerciseValidator();

  const recognitionRef = useRef<any>(null);

  // ── Speech Recognition setup ──────────────────────────────────────────────
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const speechSupported = !!SpeechRecognition;

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognition) return;
    setTranscript('');
    setLevelResult(null);
    setNoSpeech(false);

    const recognition = new SpeechRecognition();
    recognition.lang = lang === 'en' ? 'en-US' : 'es-MX';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: any) => {
      const t = Array.from(event.results as any[])
        .map((r: any) => r[0].transcript)
        .join(' ');
      setTranscript(t);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      setTranscript(prev => {
        if (!prev.trim()) { setNoSpeech(true); return prev; }
        const cmp = compareTexts(LEVELS[currentLevel].text, prev);
        setLevelResult(cmp);
        return prev;
      });
    };

    recognition.onerror = (e: any) => {
      setIsListening(false);
      if (e.error === 'no-speech') setNoSpeech(true);
    };

    recognition.start();
  }, [SpeechRecognition, lang, currentLevel, LEVELS]);

  // Stop validator when done phase or unmount
  useEffect(() => {
    if (phase === 'done' && val.active) stopVal();
  }, [phase, val.active, stopVal]);

  // Cleanup on unmount
  useEffect(() => () => { stopListening(); stopVal(); }, [stopListening, stopVal]);

  const handleSkip = useCallback(() => {
    stopListening();
    setResults(prev => [...prev, { level: LEVELS[currentLevel].level, score: 0, skipped: true, words: [] }]);
    if (currentLevel + 1 < LEVELS.length) {
      setCurrentLevel(c => c + 1);
      setTranscript('');
      setLevelResult(null);
      setNoSpeech(false);
    } else {
      setPhase('done');
    }
  }, [currentLevel, LEVELS, stopListening]);

  const handleNext = useCallback(() => {
    const score = levelResult?.score ?? 0;
    setResults(prev => [...prev, {
      level: LEVELS[currentLevel].level,
      score,
      skipped: false,
      words: levelResult?.words ?? [],
    }]);
    if (currentLevel + 1 < LEVELS.length) {
      setCurrentLevel(c => c + 1);
      setTranscript('');
      setLevelResult(null);
      setNoSpeech(false);
    } else {
      setPhase('done');
    }
  }, [currentLevel, levelResult, LEVELS]);

  const handleSave = async () => {
    if (!user?.id || saving) return;
    setSaving(true);
    try {
      const avgScore = results.length > 0
        ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length)
        : 0;
      const lastPassed = results.filter(r => r.score >= 70).at(-1);
      const nivelMax = lastPassed?.level ?? 0;
      await sql`
        INSERT INTO historial_lectura_visual (user_id, eye_tested, nivel_maximo, score_promedio, resultados_json)
        VALUES (${user.id}, ${eye}, ${nivelMax}, ${avgScore}, ${JSON.stringify(results)})
      `;
      setSaved(true);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const avgScore = results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length)
    : 0;
  const lastPassedLevel = results.filter(r => r.score >= 70).at(-1);

  // ── Config screen ─────────────────────────────────────────────────────────
  if (phase === 'config') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 pb-24">
        <div className="max-w-2xl mx-auto px-4 pt-8">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
            <ArrowLeft className="w-5 h-5" />
            {lang === 'es' ? 'Volver al Dashboard' : 'Back to Dashboard'}
          </button>

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <Eye className="w-8 h-8 text-indigo-600" />
              {lang === 'es' ? 'Prueba de Lectura Visual' : 'Visual Reading Test'}
            </h1>
            <p className="text-gray-500 mt-1">
              {lang === 'es'
                ? 'Evalúa tu agudeza lectora en 5 niveles, como en una consulta optométrica real'
                : 'Evaluate your reading acuity across 5 levels, like in a real eye exam'}
            </p>
          </div>

          {/* Eye selector */}
          <div className="bg-white rounded-2xl shadow-md p-6 mb-5">
            <h2 className="text-base font-bold text-gray-800 mb-4">
              {lang === 'es' ? '¿Con qué ojo vas a leer?' : 'Which eye will you test?'}
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {(['left', 'right', 'both'] as Eye[]).map(e => {
                const labels = {
                  left:  { es: 'Ojo Izquierdo', en: 'Left Eye', emoji: '👁️' },
                  right: { es: 'Ojo Derecho',   en: 'Right Eye', emoji: '👁️' },
                  both:  { es: 'Ambos ojos',    en: 'Both Eyes', emoji: '👀' },
                };
                return (
                  <button
                    key={e}
                    onClick={() => setEye(e)}
                    className={`py-4 rounded-xl border-2 text-sm font-semibold transition-all flex flex-col items-center gap-2 ${
                      eye === e
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md'
                        : 'border-gray-200 text-gray-500 hover:border-indigo-300'
                    }`}
                  >
                    <span className="text-2xl">{labels[e].emoji}</span>
                    {lang === 'es' ? labels[e].es : labels[e].en}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Camera validation toggle */}
          <div className="bg-white rounded-2xl shadow-md p-5 mb-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-base font-bold text-gray-800">
                  {lang === 'es' ? 'Validación por cámara' : 'Camera validation'}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {lang === 'es'
                    ? 'Verifica que cubres el ojo correcto y estás a la distancia adecuada'
                    : 'Verifies you cover the right eye and are at the correct distance'}
                </p>
              </div>
              <button
                onClick={() => setUseValidator(v => !v)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                  useValidator ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  useValidator ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
            {useValidator && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-gray-600 mb-2">
                  {lang === 'es' ? 'Distancia de lectura' : 'Reading distance'}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {[30, 40, 50, 60, 70].map(d => (
                    <button
                      key={d}
                      onClick={() => setSelectedDistance(d)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                        selectedDistance === d
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-500 hover:border-indigo-300'
                      }`}
                    >
                      {d} cm
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* How it works */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 mb-6">
            <p className="text-sm font-bold text-indigo-700 flex items-center gap-2 mb-3">
              <Info className="w-4 h-4" />
              {lang === 'es' ? '¿Cómo funciona?' : 'How does it work?'}
            </p>
            <ul className="text-sm text-indigo-700 space-y-1.5">
              <li>1. {lang === 'es' ? 'Cubre el ojo indicado con tu mano.' : 'Cover the indicated eye with your hand.'}</li>
              <li>2. {lang === 'es' ? 'Lee cada texto en voz alta.' : 'Read each text out loud.'}</li>
              <li>3. {lang === 'es' ? 'El micrófono valida tu lectura automáticamente.' : 'The microphone validates your reading automatically.'}</li>
              <li>4. {lang === 'es' ? '5 niveles de letra, del más grande al más pequeño.' : '5 text sizes, from largest to smallest.'}</li>
            </ul>
            {!speechSupported && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mt-3">
                ⚠ {lang === 'es'
                  ? 'Tu navegador no soporta reconocimiento de voz. Puedes avanzar manualmente indicando si leíste correctamente.'
                  : 'Your browser does not support speech recognition. You can advance manually.'}
              </p>
            )}
          </div>

          <button
            onClick={() => { setPhase('test'); if (useValidator) startVal(); }}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-lg transition shadow-lg"
          >
            {lang === 'es' ? 'Comenzar prueba →' : 'Start test →'}
          </button>
        </div>
      </div>
    );
  }

  // ── Test screen ───────────────────────────────────────────────────────────
  if (phase === 'test') {
    const lv = LEVELS[currentLevel];
    const eyeInstr = {
      left:  lang === 'es' ? 'Cubre el ojo IZQUIERDO 👈' : 'Cover your LEFT eye 👈',
      right: lang === 'es' ? 'Cubre el ojo DERECHO 👉' : 'Cover your RIGHT eye 👉',
      both:  lang === 'es' ? 'Mantén ambos ojos abiertos 👀' : 'Keep both eyes open 👀',
    }[eye];

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 pb-24">
        <div className="max-w-4xl mx-auto px-4 pt-8">
          <button onClick={() => { stopListening(); stopVal(); setPhase('config'); setCurrentLevel(0); setResults([]); }}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
            <ArrowLeft className="w-5 h-5" />
            {lang === 'es' ? 'Reiniciar' : 'Restart'}
          </button>

          {/* Progress */}
          <div className="flex items-center gap-2 mb-5">
            {LEVELS.map((_, i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full transition-all ${
                  i < currentLevel ? 'bg-indigo-500' : i === currentLevel ? 'bg-indigo-300' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          {/* Level badge */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-xs font-bold text-indigo-500 uppercase tracking-wider">{lv.label}</span>
              <p className="text-xs text-gray-400">{lv.description}</p>
            </div>
            <span className="text-sm text-gray-500">
              {currentLevel + 1} / {LEVELS.length}
            </span>
          </div>

          {/* Eye instruction */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-3 text-sm font-semibold text-amber-700">
            {eyeInstr}
          </div>

          {/* Camera validator panel */}
          {useValidator && (() => {
            // Eye coverage: which eye should be closed?
            const eyeClosed = eye === 'both' ? null
              : eye === 'left' ? val.blinkLeft
              : val.blinkRight;
            const EYE_THRESHOLD = 0.65;
            const eyeOk = eye === 'both' || (eyeClosed !== null && eyeClosed > EYE_THRESHOLD);

            // Distance: ±10cm tolerance
            const distOk = val.distanceCm !== null
              && Math.abs(val.distanceCm - selectedDistance) <= 10;
            const distDiff = val.distanceCm !== null ? val.distanceCm - selectedDistance : null;

            const loading = val.loading;
            const noFace = val.active && !val.faceDetected && !loading;

            return (
              <div className="bg-white border border-gray-100 rounded-xl p-3 mb-4 shadow-sm">
                {/* Hidden video for MediaPipe */}
                <video ref={valVideoRef} className="hidden" playsInline muted />

                {loading && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {lang === 'es' ? 'Iniciando cámara…' : 'Starting camera…'}
                  </div>
                )}
                {val.error && (
                  <p className="text-xs text-red-500">{val.error}</p>
                )}
                {noFace && (
                  <p className="text-xs text-amber-600">
                    {lang === 'es' ? 'No se detecta rostro — acércate a la cámara' : 'No face detected — move closer to camera'}
                  </p>
                )}
                {val.active && val.faceDetected && (
                  <div className="flex items-center gap-4 flex-wrap">
                    {/* Distance indicator */}
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className={`w-2 h-2 rounded-full ${distOk ? 'bg-green-500' : 'bg-red-400'}`} />
                      <span className={distOk ? 'text-green-700' : 'text-red-600'}>
                        {val.distanceCm !== null ? (
                          distDiff !== null && Math.abs(distDiff) > 10
                            ? `${val.distanceCm}cm (${distDiff > 0 ? '+' : ''}${distDiff}cm)`
                            : `${val.distanceCm}cm ✓`
                        ) : '—'}
                      </span>
                      <span className="text-gray-400">{lang === 'es' ? `· meta ${selectedDistance}cm` : `· target ${selectedDistance}cm`}</span>
                    </div>
                    {/* Eye coverage (only when testing one eye) */}
                    {eye !== 'both' && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className={`w-2 h-2 rounded-full ${eyeOk ? 'bg-green-500' : 'bg-amber-400'}`} />
                        <span className={eyeOk ? 'text-green-700' : 'text-amber-700'}>
                          {eyeOk
                            ? (lang === 'es' ? 'Ojo cubierto ✓' : 'Eye covered ✓')
                            : (lang === 'es'
                              ? `Cubre el ojo ${eye === 'left' ? 'izquierdo' : 'derecho'}`
                              : `Cover your ${eye} eye`)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Text card */}
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-5 min-h-[220px] flex items-center justify-center">
            {levelResult ? (
              // Show highlighted words
              <p className="leading-relaxed text-center" style={{ fontSize: lv.size }}>
                {levelResult.words.map((w, i) => (
                  <span
                    key={i}
                    className={`${w.matched ? 'text-green-600' : 'text-red-500'} mr-1`}
                  >
                    {w.word}
                  </span>
                ))}
              </p>
            ) : (
              <p
                className="text-gray-800 leading-relaxed text-center select-none"
                style={{ fontSize: lv.size }}
              >
                {lv.text}
              </p>
            )}
          </div>

          {/* Transcript */}
          {transcript && (
            <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4 text-sm text-gray-600 italic">
              "{transcript}"
            </div>
          )}

          {/* Score badge */}
          {levelResult && (
            <div className={`flex items-center gap-2 rounded-xl px-4 py-3 mb-4 text-sm font-semibold ${
              levelResult.score >= 70
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {levelResult.score >= 70
                ? <CheckCircle2 className="w-4 h-4" />
                : <XCircle className="w-4 h-4" />}
              {lang === 'es'
                ? `${levelResult.score}% de palabras correctas`
                : `${levelResult.score}% words correct`}
            </div>
          )}

          {noSpeech && (
            <p className="text-xs text-amber-600 mb-3">
              {lang === 'es' ? 'No se detectó voz. Intenta de nuevo o salta el nivel.' : 'No speech detected. Try again or skip.'}
            </p>
          )}

          {/* Controls */}
          <div className="flex gap-3">
            {speechSupported && !levelResult && (
              <button
                onClick={isListening ? stopListening : startListening}
                className={`flex-1 py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition shadow ${
                  isListening
                    ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                {isListening
                  ? (lang === 'es' ? 'Detener' : 'Stop')
                  : (lang === 'es' ? 'Leer en voz alta' : 'Read aloud')}
              </button>
            )}

            {/* Manual buttons when no speech API */}
            {!speechSupported && !levelResult && (
              <div className="flex gap-3 flex-1">
                <button
                  onClick={() => setLevelResult({ words: LEVELS[currentLevel].text.split(' ').map(w => ({ word: w, matched: true })), score: 100 })}
                  className="flex-1 py-3.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold transition"
                >
                  ✓ {lang === 'es' ? 'Leí bien' : 'Read correctly'}
                </button>
                <button
                  onClick={() => setLevelResult({ words: LEVELS[currentLevel].text.split(' ').map(w => ({ word: w, matched: false })), score: 0 })}
                  className="flex-1 py-3.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold transition"
                >
                  ✗ {lang === 'es' ? 'No pude' : "Couldn't read"}
                </button>
              </div>
            )}

            {levelResult && (
              <button
                onClick={handleNext}
                className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition shadow"
              >
                {currentLevel + 1 < LEVELS.length
                  ? <><ChevronRight className="w-5 h-5" />{lang === 'es' ? 'Siguiente nivel' : 'Next level'}</>
                  : <><CheckCircle2 className="w-5 h-5" />{lang === 'es' ? 'Ver resultados' : 'See results'}</>
                }
              </button>
            )}

            <button
              onClick={handleSkip}
              className="px-4 py-3.5 border-2 border-gray-200 text-gray-500 rounded-xl font-semibold hover:border-gray-300 transition text-sm"
              title={lang === 'es' ? 'Saltar nivel' : 'Skip level'}
            >
              {lang === 'es' ? 'Saltar' : 'Skip'} →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Results screen ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 pb-24">
      <div className="max-w-2xl mx-auto px-4 pt-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <Award className="w-8 h-8 text-indigo-600" />
            {lang === 'es' ? 'Resultados' : 'Results'}
          </h1>
        </div>

        {/* Overall score */}
        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white mb-5 flex items-center gap-6">
          <div className="text-center flex-shrink-0">
            <div className="text-5xl font-black">{avgScore}%</div>
            <div className="text-white/70 text-xs mt-1">{lang === 'es' ? 'Precisión promedio' : 'Average accuracy'}</div>
          </div>
          <div className="flex-1">
            <div className="h-3 bg-white/20 rounded-full mb-2 overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all" style={{ width: `${avgScore}%` }} />
            </div>
            <p className="text-sm text-white/80">
              {lastPassedLevel
                ? (lang === 'es'
                  ? `Nivel mínimo alcanzado: Nivel ${lastPassedLevel.level} (${LEVELS.find(l => l.level === lastPassedLevel.level)?.size}px)`
                  : `Minimum level reached: Level ${lastPassedLevel.level} (${LEVELS.find(l => l.level === lastPassedLevel.level)?.size}px)`)
                : (lang === 'es' ? 'No se alcanzó ningún nivel con ≥70%' : 'No level reached with ≥70%')
              }
            </p>
            <p className="text-xs text-white/60 mt-1">
              {lang === 'es'
                ? `Ojo evaluado: ${eye === 'left' ? 'Izquierdo' : eye === 'right' ? 'Derecho' : 'Ambos'}`
                : `Eye tested: ${eye === 'left' ? 'Left' : eye === 'right' ? 'Right' : 'Both'}`}
            </p>
          </div>
        </div>

        {/* Per-level results */}
        <div className="bg-white rounded-2xl shadow-md p-5 mb-5">
          <h2 className="text-sm font-bold text-gray-700 mb-4">{lang === 'es' ? 'Detalle por nivel' : 'Level breakdown'}</h2>
          <div className="space-y-3">
            {LEVELS.map(lv => {
              const r = results.find(x => x.level === lv.level);
              return (
                <div key={lv.level} className="flex items-center gap-3">
                  <div className="w-20 flex-shrink-0 text-xs text-gray-500">{lv.size}px</div>
                  <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: r ? `${r.score}%` : '0%',
                        backgroundColor: !r || r.skipped ? '#d1d5db' : r.score >= 70 ? '#16a34a' : '#dc2626',
                      }}
                    />
                  </div>
                  <div className="w-14 text-right text-xs font-bold" style={{
                    color: !r || r.skipped ? '#9ca3af' : r.score >= 70 ? '#16a34a' : '#dc2626',
                  }}>
                    {r ? (r.skipped ? (lang === 'es' ? 'Saltado' : 'Skipped') : `${r.score}%`) : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recommendation */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 mb-5 text-sm text-indigo-700">
          <p className="font-semibold mb-1">
            {lang === 'es' ? '💡 Recomendación' : '💡 Recommendation'}
          </p>
          {avgScore >= 80
            ? (lang === 'es'
              ? 'Excelente agudeza lectora. Mantén tus hábitos visuales saludables.'
              : 'Excellent reading acuity. Keep up your healthy visual habits.')
            : avgScore >= 60
              ? (lang === 'es'
                ? 'Agudeza lectora moderada. Considera visitar a un optometrista para una revisión completa.'
                : 'Moderate reading acuity. Consider visiting an optometrist for a full checkup.')
              : (lang === 'es'
                ? 'Se detectó dificultad en la lectura. Se recomienda una consulta con un especialista visual.'
                : 'Reading difficulty detected. A consultation with a vision specialist is recommended.')}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {!saved && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition shadow"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? (lang === 'es' ? 'Guardando...' : 'Saving...') : (lang === 'es' ? 'Guardar resultado' : 'Save result')}
            </button>
          )}
          {saved && (
            <div className="flex-1 flex items-center gap-2 justify-center bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-semibold py-3.5">
              <CheckCircle2 className="w-4 h-4" /> {lang === 'es' ? '¡Guardado!' : 'Saved!'}
            </div>
          )}
          <button
            onClick={() => { setPhase('config'); setCurrentLevel(0); setResults([]); setTranscript(''); setLevelResult(null); setSaved(false); }}
            className="px-5 py-3.5 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold hover:border-gray-300 transition flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            {lang === 'es' ? 'Repetir' : 'Retry'}
          </button>
          <button
            onClick={onBack}
            className="px-5 py-3.5 border-2 border-indigo-200 text-indigo-600 rounded-xl font-semibold hover:border-indigo-400 transition flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            {lang === 'es' ? 'Inicio' : 'Home'}
          </button>
        </div>
      </div>
    </div>
  );
}
