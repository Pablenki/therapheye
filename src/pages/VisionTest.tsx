import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Eye, CheckCircle, RefreshCw, Mic, MicOff, Keyboard, Home } from 'lucide-react';
import { sql } from '../neonCliente';
import { useUser } from '../context/UserContext';

// ─── Letras Snellen válidas (optotipos estándar) ───────────────────────────────
const SNELLEN_POOL = ['C', 'D', 'E', 'F', 'H', 'N', 'O', 'P', 'R', 'U', 'V', 'Z'];

// Configuración de niveles (tamaño fijo, letras aleatorias cada vez)
const ROWS_CONFIG = [
  { fontSize: 96, acuity: '20/200', level: 1,  count: 1 },
  { fontSize: 72, acuity: '20/150', level: 2,  count: 2 },
  { fontSize: 56, acuity: '20/100', level: 3,  count: 3 },
  { fontSize: 42, acuity: '20/70',  level: 4,  count: 4 },
  { fontSize: 32, acuity: '20/50',  level: 5,  count: 5 },
  { fontSize: 24, acuity: '20/40',  level: 6,  count: 6 },
  { fontSize: 18, acuity: '20/30',  level: 7,  count: 7 },
  { fontSize: 14, acuity: '20/20',  level: 8,  count: 8 },
  { fontSize: 11, acuity: '20/15',  level: 9,  count: 8 },
  { fontSize: 9,  acuity: '20/10',  level: 10, count: 8 },
];

interface RowData { label: string; fontSize: number; acuity: string; level: number; }

// Genera letras aleatorias para cada nivel, diferente cada test
const generateRandomRows = (): RowData[] =>
  ROWS_CONFIG.map(cfg => {
    const shuffled = [...SNELLEN_POOL].sort(() => Math.random() - 0.5);
    const letters  = shuffled.slice(0, cfg.count);
    return { fontSize: cfg.fontSize, acuity: cfg.acuity, level: cfg.level, label: letters.join(' ') };
  });

// ─── Mapas fonéticos: sonido → letra ──────────────────────────────────────────
// Español: cómo se pronuncia cada letra del abecedario (más variantes posibles)
const LETTER_MAP_ES: Record<string, string> = {
  // A
  'a': 'A',
  // B
  'b': 'B', 'be': 'B', 'bé': 'B', 've corta': 'B',
  // C
  'c': 'C', 'ce': 'C', 'cé': 'C', 'se': 'C',
  // D
  'd': 'D', 'de': 'D', 'dé': 'D',
  // E
  'e': 'E', 'eh': 'E', 'ee': 'E',
  // F
  'f': 'F', 'efe': 'F', 'ef': 'F',
  // G
  'g': 'G', 'ge': 'G', 'gé': 'G',
  // H
  'h': 'H', 'hache': 'H', 'ache': 'H',
  // I
  'i': 'I',
  // J
  'j': 'J', 'jota': 'J',
  // K
  'k': 'K', 'ka': 'K',
  // L
  'l': 'L', 'ele': 'L', 'el': 'L',
  // M
  'm': 'M', 'eme': 'M', 'em': 'M',
  // N
  'n': 'N', 'ene': 'N', 'en': 'N',
  // O
  'o': 'O', 'oh': 'O', 'oo': 'O',
  // P
  'p': 'P', 'pe': 'P', 'pé': 'P',
  // Q
  'q': 'Q', 'cu': 'Q',
  // R
  'r': 'R', 'erre': 'R', 're': 'R',
  // S
  's': 'S', 'ese': 'S',
  // T
  't': 'T', 'te': 'T', 'té': 'T',
  // U
  'u': 'U', 'uu': 'U',
  // V
  'v': 'V', 've': 'V', 'uve': 'V',
  // W
  'w': 'W', 'doble ve': 'W', 'doble uve': 'W', 'doble u': 'W',
  // X
  'x': 'X', 'equis': 'X', 'ex': 'X',
  // Y
  'y': 'Y', 'ye': 'Y', 'i griega': 'Y',
  // Z
  'z': 'Z', 'zeta': 'Z', 'ceta': 'Z', 'seta': 'Z',
};

// Inglés: fonética estándar
const LETTER_MAP_EN: Record<string, string> = {
  'a': 'A', 'ay': 'A',
  'b': 'B', 'bee': 'B',
  'c': 'C', 'see': 'C', 'sea': 'C',
  'd': 'D', 'dee': 'D',
  'e': 'E', 'ee': 'E', 'eh': 'E',
  'f': 'F', 'ef': 'F', 'eff': 'F',
  'g': 'G', 'gee': 'G',
  'h': 'H', 'aitch': 'H',
  'i': 'I', 'eye': 'I',
  'j': 'J', 'jay': 'J',
  'k': 'K', 'kay': 'K',
  'l': 'L', 'el': 'L',
  'm': 'M', 'em': 'M',
  'n': 'N', 'en': 'N',
  'o': 'O', 'oh': 'O',
  'p': 'P', 'pee': 'P',
  'q': 'Q', 'cue': 'Q',
  'r': 'R', 'ar': 'R',
  's': 'S', 'ess': 'S',
  't': 'T', 'tee': 'T',
  'u': 'U', 'you': 'U',
  'v': 'V', 'vee': 'V',
  'w': 'W', 'double you': 'W',
  'x': 'X', 'ex': 'X',
  'y': 'Y', 'why': 'Y',
  'z': 'Z', 'zee': 'Z', 'zed': 'Z',
};

// Para el hint de instrucciones (letra → cómo pronunciarla)
const PRONOUNCE_ES: Record<string, string> = {
  C: 'ce', D: 'de', E: 'e', F: 'efe', H: 'hache',
  N: 'ene', O: 'o', P: 'pe', R: 'erre', U: 'u', V: 've', Z: 'zeta',
};

// ─── Convierte transcripción a letras ─────────────────────────────────────────
// Estrategia multicapa para maximizar detección de letras individuales
const speechToLetters = (
  transcript: string,
  lang: 'es' | 'en',
  expectedLetters?: string[],   // letras que esperamos (para priorizar)
): string => {
  const map  = lang === 'es' ? LETTER_MAP_ES : LETTER_MAP_EN;
  // También probar el mapa opuesto como fallback (alguien puede decir "ef" en modo español)
  const map2 = lang === 'es' ? LETTER_MAP_EN : LETTER_MAP_ES;
  const lower = transcript.toLowerCase().trim();
  const words = lower.split(/\s+/).filter(Boolean);

  const mapWord = (word: string): string | null => {
    if (map[word])  return map[word];   // mapa primario
    if (map2[word]) return map2[word];  // mapa secundario (cross-lang)
    if (word.length === 1 && /[a-z]/.test(word)) return word.toUpperCase(); // letra suelta
    return null;
  };

  // Estrategia 1: mapear cada palabra
  const mapped = words.map(mapWord);
  if (mapped.length > 0 && mapped.every(l => l !== null)) return mapped.join('');

  // Estrategia 2: palabras no mapeadas → primera letra de esa palabra
  // Ej: "hola" → "H", "pato" → "P"
  const fallback = mapped.map((l, i) => l ?? words[i][0]?.toUpperCase() ?? '').join('');

  // Estrategia 3: Si esperamos letras específicas, verificar si el fallback contiene alguna
  if (expectedLetters && expectedLetters.length === 1) {
    const exp = expectedLetters[0];
    // Si el transcript empieza con el sonido de la letra esperada, aceptarla
    if (lower.startsWith(exp.toLowerCase())) return exp;
    // Si la primera letra del fallback coincide con lo esperado, aceptarla
    if (fallback[0] === exp) return exp;
  }

  return fallback;
};

// ─── Detectar SpeechRecognition (Chrome, Opera, Edge, Safari) ─────────────────
const SpeechRecognitionAPI: any =
  (window as any).SpeechRecognition ||
  (window as any).webkitSpeechRecognition ||
  (window as any).mozSpeechRecognition ||
  (window as any).msSpeechRecognition;
const SpeechGrammarListAPI: any =
  (window as any).SpeechGrammarList ||
  (window as any).webkitSpeechGrammarList;
const hasSpeechSupport = Boolean(SpeechRecognitionAPI);

// Opera usa Chromium pero NO tiene el servicio de Google Speech API integrado.
// El mic se solicita pero no devuelve resultados. → Redirigir a Chrome.
const isOpera = /OPR\/|Opera/.test(navigator.userAgent);

type Phase = 'instructions' | 'test' | 'result';
type VoiceStatus = 'idle' | 'listening' | 'heard' | 'error';

interface RowResult { level: number; acuity: string; canRead: boolean; userInput: string; }

const getResultInfo = (bestLevel: number) => {
  if (bestLevel >= 9)  return { label: 'Visión excepcional (20/15 – 20/10)', detail: 'Tu agudeza visual está por encima del promedio normal.', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', recommendation: 'Mantén tus hábitos visuales y descansa la vista cada 20 minutos.' };
  if (bestLevel >= 8)  return { label: 'Visión normal (20/20)', detail: 'Tu agudeza visual es óptima para la distancia de pantalla.', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', recommendation: 'Mantén buenos hábitos visuales. Realiza ejercicios de prevención.' };
  if (bestLevel >= 6)  return { label: 'Visión buena (20/30 – 20/40)', detail: 'Ligera dificultad en líneas pequeñas. Puede ser cansancio acumulado.', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', recommendation: 'Realiza el ejercicio de enfoque cercano-lejano y aplica la regla 20-20-20.' };
  if (bestLevel >= 4)  return { label: 'Visión reducida (20/50 – 20/70)', detail: 'Dificultad notable en caracteres medianos. Posible fatiga acumulada.', color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200', recommendation: 'Practica palming y regla 20-20-20. Si persiste, consulta a un optometrista.' };
  return { label: 'Visión limitada (20/100 o menos)', detail: 'Solo puedes leer caracteres grandes. Se recomienda evaluación profesional.', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', recommendation: 'Consulta a un optometrista. Evita pantallas prolongadas sin descanso.' };
};

const normalize = (s: string) => s.replace(/\s+/g, '').toUpperCase();
const isMatch   = (input: string, label: string) => normalize(input) === normalize(label);

// ─── Barras de onda animadas ───────────────────────────────────────────────────
const SoundWaveBars = ({ active }: { active: boolean }) => (
  <div className="flex items-end gap-0.5 h-5">
    {[1, 3, 2, 4, 2, 3, 1].map((h, i) => (
      <div
        key={i}
        className={`w-1 rounded-full ${active ? 'bg-white' : 'bg-white/30'}`}
        style={{
          height: active ? `${h * 4 + 2}px` : '3px',
          animation: active ? `soundBar ${0.4 + i * 0.06}s ease-in-out infinite alternate` : 'none',
          animationDelay: `${i * 0.07}s`,
        }}
      />
    ))}
  </div>
);

// ─── Componente principal ──────────────────────────────────────────────────────
const VisionTest = ({ onBack }: { onBack: () => void }) => {
  const [phase, setPhase]           = useState<Phase>('instructions');
  const [currentRow, setCurrentRow] = useState(0);
  const [results, setResults]       = useState<RowResult[]>([]);
  const [input, setInput]           = useState('');
  const [shake, setShake]           = useState(false);
  const [isSaving, setIsSaving]     = useState(false);
  const [distance, setDistance]     = useState<'40' | '60' | '80'>('60');
  const [language, setLanguage]     = useState<'es' | 'en'>('es');

  // Filas de test con letras aleatorias — se regeneran al reiniciar
  const [testRows, setTestRows] = useState<RowData[]>(() => generateRandomRows());

  // Reintentos por fila y clave de reset de efecto
  const [rowAttempts, setRowAttempts] = useState(0);
  const [rowResetKey, setRowResetKey] = useState(0);   // trigger para reactivar mic/TTS

  // Modo voz
  const [voiceMode, setVoiceMode]             = useState(hasSpeechSupport);
  const [voiceStatus, setVoiceStatus]         = useState<VoiceStatus>('idle');
  const [heardText, setHeardText]             = useState('');
  const [heardLetters, setHeardLetters]       = useState('');
  const [interimText, setInterimText]         = useState('');
  const [autoConfirmSecs, setAutoConfirmSecs] = useState<number | null>(null);

  const inputRef    = useRef<HTMLInputElement>(null);
  const recognRef   = useRef<any>(null);
  const autoConfRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultsRef  = useRef<RowResult[]>([]);
  resultsRef.current = results;

  // ── Refs para callbacks sin stale closures ───────────────────────────────────
  const voiceStatusRef    = useRef<VoiceStatus>('idle');
  const currentRowRef     = useRef(currentRow);
  const languageRef       = useRef(language);
  const testRowsRef       = useRef(testRows);
  const rowAttemptsRef    = useRef(rowAttempts);
  const isActiveRef       = useRef(false);   // ¿Debe el mic seguir escuchando?
  const isSubmittingRef   = useRef(false);   // ¿Procesando resultado?
  // Acumulación de letras entre frases dentro de la misma fila
  const accumulatedRef    = useRef('');      // letras acumuladas en esta fila

  useEffect(() => { currentRowRef.current  = currentRow;   }, [currentRow]);
  useEffect(() => { languageRef.current    = language;     }, [language]);
  useEffect(() => { testRowsRef.current    = testRows;     }, [testRows]);
  useEffect(() => { rowAttemptsRef.current = rowAttempts;  }, [rowAttempts]);

  const { user } = useUser();
  const distanceScale: Record<string, number> = { '40': 0.75, '60': 1, '80': 1.3 };
  const scale = distanceScale[distance];

  // ── setVoiceStatus + ref en sincronía ────────────────────────────────────────
  const setVS = useCallback((s: VoiceStatus) => {
    voiceStatusRef.current = s;
    setVoiceStatus(s);
  }, []);

  // ── Limpiar auto-confirmar ───────────────────────────────────────────────────
  const clearAutoConfirm = useCallback(() => {
    if (autoConfRef.current) { clearInterval(autoConfRef.current); autoConfRef.current = null; }
    setAutoConfirmSecs(null);
  }, []);

  // ── Detener recognition completamente ───────────────────────────────────────
  const stopMic = useCallback(() => {
    isActiveRef.current = false;
    if (recognRef.current) {
      try { recognRef.current.abort(); } catch { /* noop */ }
      recognRef.current = null;
    }
    setVS('idle');
    clearAutoConfirm();
    setInterimText('');
  }, [setVS, clearAutoConfirm]);

  // ── TTS (síntesis de voz) ────────────────────────────────────────────────────
  const speakPrompt = useCallback((text: string, onEnd?: () => void) => {
    if (!('speechSynthesis' in window)) { onEnd?.(); return; }
    window.speechSynthesis.cancel();
    const utt   = new SpeechSynthesisUtterance(text);
    utt.lang    = 'es-MX';
    utt.rate    = 1.1;
    utt.pitch   = 1.0;
    utt.volume  = 1.0;

    // Intentar voz en español
    const loadVoice = () => {
      const voces = window.speechSynthesis.getVoices();
      const voz   = voces.find(v => v.lang === 'es-MX')
                 || voces.find(v => v.lang === 'es-US')
                 || voces.find(v => v.lang.startsWith('es'));
      if (voz) utt.voice = voz;
    };

    if (window.speechSynthesis.getVoices().length > 0) {
      loadVoice();
    } else {
      window.speechSynthesis.addEventListener('voiceschanged', loadVoice, { once: true });
    }

    let fired = false;
    const done = () => { if (!fired) { fired = true; setTimeout(() => onEnd?.(), 150); } };
    const fallback = setTimeout(done, 2500); // máx 2.5s por frase
    utt.onend = () => { clearTimeout(fallback); done(); };
    utt.onerror = () => { clearTimeout(fallback); done(); };
    window.speechSynthesis.speak(utt);
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────────────
  const MAX_RETRIES = 2; // máx 2 reintentos por fila (3 intentos en total)

  const submitInput = useCallback(async (value: string) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    isActiveRef.current = false;
    clearAutoConfirm();
    if (recognRef.current) { try { recognRef.current.abort(); } catch { /**/ } recognRef.current = null; }

    const rowIdx = currentRowRef.current;
    const row    = testRowsRef.current[rowIdx];
    const matched = isMatch(value, row.label);

    if (!matched) {
      setShake(true);
      setTimeout(() => {
        setShake(false);

        if (rowAttemptsRef.current < MAX_RETRIES) {
          // ── Reintento: nuevas letras para el mismo nivel ──────────────
          const nextAttempt = rowAttemptsRef.current + 1;
          setRowAttempts(nextAttempt);
          // Regenerar letras de esta fila
          setTestRows(prev => {
            const newRows = [...prev];
            const cfg     = ROWS_CONFIG[rowIdx];
            const shuffled = [...SNELLEN_POOL].sort(() => Math.random() - 0.5);
            newRows[rowIdx] = { ...newRows[rowIdx], label: shuffled.slice(0, cfg.count).join(' ') };
            return newRows;
          });
          accumulatedRef.current = '';
          isSubmittingRef.current = false;
          setRowResetKey(k => k + 1); // re-dispara el useEffect → TTS + mic
        } else {
          // ── Después de 2 reintentos → saltar al siguiente nivel ───────
          setRowAttempts(0);
          isSubmittingRef.current = false;
          accumulatedRef.current = '';
          if (rowIdx < testRowsRef.current.length - 1) {
            setCurrentRow(prev => prev + 1);
          } else {
            saveResult(resultsRef.current).then(() => setPhase('result'));
          }
        }
      }, 600);
      return;
    }

    // Correcto → avanzar y resetear intentos
    setRowAttempts(0);
    accumulatedRef.current = '';
    isSubmittingRef.current = false;
    if (rowIdx < testRowsRef.current.length - 1) {
      setCurrentRow(prev => prev + 1);
    } else {
      await saveResult(resultsRef.current);
      setPhase('result');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearAutoConfirm]);

  // ── Procesar resultado de voz ─────────────────────────────────────────────────
  // precomputedLetters: si ya se calculó en spawnRecognition, evitar hacerlo dos veces
  //
  // Acumulación: con continuous=true, el usuario puede decir letras en varias frases.
  // Ej: dice "O" → "C" → acumulamos "OC" antes de autoconfirmar.
  // El mic se mantiene activo (isActiveRef = true) para capturar frases adicionales.
  const handleFinalResult = useCallback((transcript: string, precomputedLetters?: string) => {
    const row      = testRowsRef.current[currentRowRef.current];
    const expected = row.label.split(' ');
    const expectedCount = normalize(row.label).length; // letras esperadas sin espacios

    const newLetters = precomputedLetters ?? speechToLetters(transcript, languageRef.current, expected);

    // ── Lógica de acumulación inteligente ──────────────────────────────────
    // Si las nuevas letras ya contienen suficientes o las mismas que lo esperado,
    // REEMPLAZAR en vez de acumular (evita duplicados como "FCFC" cuando dicen "FC" 2 veces)
    let displayLetters: string;

    if (newLetters.length >= expectedCount) {
      // El usuario dijo todas las letras de una vez → reemplazar
      displayLetters = newLetters.slice(0, expectedCount);
      accumulatedRef.current = displayLetters;
    } else if (accumulatedRef.current.length > 0 &&
               newLetters === accumulatedRef.current.slice(-newLetters.length)) {
      // El usuario repitió exactamente lo mismo → NO acumular, mantener lo anterior
      displayLetters = accumulatedRef.current;
    } else {
      // El usuario dijo letras nuevas/diferentes → acumular
      const accumulated = accumulatedRef.current + newLetters;
      displayLetters = accumulated.slice(0, expectedCount); // limitar al máximo esperado
      accumulatedRef.current = displayLetters;
    }

    setInterimText('');
    setVS('heard');
    setHeardText(transcript);
    setHeardLetters(displayLetters);
    setInput(displayLetters);

    // Si coincide exactamente → autoconfirmar rápido (1.5s)
    // Si no coincide → dar más tiempo (3s) para que siga hablando
    const matchesExpected = isMatch(displayLetters, row.label);
    const confirmTime = matchesExpected ? 1.5 : 3;

    clearAutoConfirm();
    let secs = confirmTime;
    setAutoConfirmSecs(Math.ceil(secs));
    autoConfRef.current = setInterval(() => {
      secs -= 1;
      setAutoConfirmSecs(Math.ceil(secs));
      if (secs <= 0) {
        clearInterval(autoConfRef.current!);
        autoConfRef.current = null;
        setAutoConfirmSecs(null);
        submitInput(displayLetters);
      }
    }, 1000);
  }, [setVS, submitInput, clearAutoConfirm]);

  // ── Lanzar recognition (siempre instancia nueva) ─────────────────────────────
  const spawnRecognition = useCallback(() => {
    if (!hasSpeechSupport || !isActiveRef.current) return;

    const row      = testRowsRef.current[currentRowRef.current];
    const letters  = row.label.split(' ');
    const lang     = languageRef.current;

    const recognition = new SpeechRecognitionAPI();
    recognition.lang             = lang === 'es' ? 'es-MX' : 'en-US';
    recognition.interimResults   = true;    // feedback en tiempo real
    recognition.maxAlternatives  = 8;
    // continuous: true → NO hace timeout por silencio; el usuario puede
    // intentar varias veces sin tocar el botón. Funciona mejor en Opera/Chrome
    recognition.continuous       = true;

    // Gramáticas (pista al motor de lo que esperamos) — opcional pero ayuda
    if (SpeechGrammarListAPI) {
      try {
        const gl = new SpeechGrammarListAPI();
        // Incluir todas las variantes fonéticas de las letras esperadas
        const variants = letters.flatMap(l => {
          const esVars = Object.entries(LETTER_MAP_ES).filter(([, v]) => v === l).map(([k]) => k);
          const enVars = Object.entries(LETTER_MAP_EN).filter(([, v]) => v === l).map(([k]) => k);
          return [...new Set([...esVars, ...enVars, l.toLowerCase()])];
        });
        const grammar = `#JSGF V1.0; grammar letters; public <letter> = ${variants.join(' | ')};`;
        gl.addFromString(grammar, 1);
        recognition.grammars = gl;
      } catch { /* silenciar si el navegador no lo soporta */ }
    }

    recognition.onstart = () => {
      setVS('listening');
      setInterimText('');
    };

    recognition.onresult = (event: any) => {
      // Con continuous=true procesamos desde resultIndex
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];

        if (!result.isFinal) {
          // Mostrar lo que se va captando en tiempo real
          setInterimText(result[0].transcript);
          continue;
        }

        // Resultado final: buscar la mejor alternativa
        let bestTranscript = result[0].transcript;
        let bestLetters    = speechToLetters(bestTranscript, lang, letters);

        for (let alt = 1; alt < result.length; alt++) {
          const altT = result[alt].transcript;
          const altL = speechToLetters(altT, lang, letters);
          if (isMatch(altL, row.label)) {
            bestTranscript = altT;
            bestLetters    = altL;
            break;
          }
        }

        handleFinalResult(bestTranscript.trim(), bestLetters);
        // Solo tomamos el primer resultado final de esta sesión
        return;
      }
    };

    recognition.onerror = (ev: any) => {
      console.warn('[VisionTest] error:', ev.error);
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        isActiveRef.current = false;
        setVS('error');
        setHeardText('Sin permiso de micrófono. Revisa la configuración del navegador.');
      }
      // Para otros errores (no-speech, network, etc.) dejamos que onend reintente
      setInterimText('');
    };

    recognition.onend = () => {
      recognRef.current = null;
      if (isActiveRef.current && voiceStatusRef.current !== 'heard') {
        // Reiniciar con nueva instancia después de pequeña pausa
        setTimeout(() => { if (isActiveRef.current) spawnRecognition(); }, 250);
      } else if (voiceStatusRef.current !== 'heard') {
        setVS('idle');
      }
    };

    recognRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.error('[VisionTest] start failed:', e);
      recognRef.current       = null;
      isActiveRef.current     = false;
      setVS('error');
    }
  // spawnRecognition no depende de estados de React, solo de refs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setVS, handleFinalResult]);

  // ── Iniciar escucha ──────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!hasSpeechSupport) return;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (recognRef.current) { try { recognRef.current.abort(); } catch {/**/ } recognRef.current = null; }
    clearAutoConfirm();
    setHeardText('');
    setHeardLetters('');
    setInterimText('');
    isActiveRef.current = true;
    spawnRecognition();
  }, [spawnRecognition, clearAutoConfirm]);

  // ── Al entrar a cada fila (o reintento): TTS prompt → luego abrir mic ───────
  useEffect(() => {
    if (phase !== 'test') return;

    // Limpiar estado previo
    isActiveRef.current = false;
    if (recognRef.current) { try { recognRef.current.abort(); } catch {/**/ } recognRef.current = null; }
    clearAutoConfirm();
    setInput('');
    setHeardText('');
    setHeardLetters('');
    setInterimText('');
    setVS('idle');
    accumulatedRef.current = '';    // resetear acumulación para esta fila
    isSubmittingRef.current = false;

    if (voiceMode) {
      const row    = testRows[currentRow];
      const prompt = row.label.split(' ').length === 1 ? '¿Qué letra ves?' : '¿Qué letras ves?';
      const t = setTimeout(() => {
        speakPrompt(prompt, () => {
          if (phase === 'test') startListening();
        });
      }, 400);
      return () => clearTimeout(t);
    } else {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRow, phase, voiceMode, rowResetKey]); // rowResetKey dispara reintento

  // ── Limpiar al desmontar ──────────────────────────────────────────────────────
  useEffect(() => () => {
    isActiveRef.current = false;
    if (recognRef.current) { try { recognRef.current.abort(); } catch {/**/ } }
    clearAutoConfirm();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, [clearAutoConfirm]);

  const saveResult = async (finalResults: RowResult[]) => {
    setIsSaving(true);
    try {
      const bestLevel  = finalResults.filter(r => r.canRead).reduce((max, r) => Math.max(max, r.level), 0);
      const bestAcuity = testRows.find(r => r.level === bestLevel)?.acuity ?? 'N/A';
      await sql`
        INSERT INTO historial_vision_test (user_id, mejor_nivel, agudeza, distancia_cm, resultados_json, created_at)
        VALUES (${user?.id}, ${bestLevel}, ${bestAcuity}, ${parseInt(distance)}, ${JSON.stringify(finalResults)}, NOW())
      `;
    } catch (err) { console.error('Error al guardar:', err); }
    finally { setIsSaving(false); }
  };

  const handleRestart = () => {
    stopMic();
    setTestRows(generateRandomRows()); // ← Nuevas letras aleatorias
    setPhase('instructions');
    setCurrentRow(0);
    setResults([]);
    setInput('');
    setHeardText('');
    setHeardLetters('');
    setInterimText('');
  };

  const bestLevel  = results.filter(r => r.canRead).reduce((max, r) => Math.max(max, r.level), 0);
  const resultInfo = getResultInfo(bestLevel);

  // Hint de cómo pronunciar las letras de la fila actual
  const pronunciationHint = useMemo(() => {
    if (phase !== 'test' || !testRows[currentRow]) return '';
    return testRows[currentRow].label
      .split(' ')
      .map(l => language === 'es' ? (PRONOUNCE_ES[l] ?? l.toLowerCase()) : l.toLowerCase())
      .join(', ');
  }, [phase, currentRow, testRows, language]);

  // ─── INSTRUCCIONES ──────────────────────────────────────────────────────────
  if (phase === 'instructions') {
    return (
      <div className="vision-test-root min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
            <ArrowLeft className="w-4 h-4" /> Volver
          </button>

          {/* Banner Opera: redirigir a Chrome para reconocimiento de voz */}
          {isOpera && voiceMode && (
            <div className="bg-orange-50 border border-orange-300 rounded-xl p-4 mb-5 flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-orange-800">Reconocimiento de voz no disponible en Opera</p>
                <p className="text-xs text-orange-700 mt-1">
                  Opera no incluye el servicio de Google Speech API. Para usar el micrófono, abre esta página en <strong>Google Chrome</strong>.
                </p>
                <button
                  onClick={() => { navigator.clipboard?.writeText(window.location.href).catch(() => {}); }}
                  className="mt-2 text-xs bg-orange-200 hover:bg-orange-300 text-orange-900 px-3 py-1 rounded-lg transition font-semibold"
                >
                  📋 Copiar URL para Chrome
                </button>
              </div>
            </div>
          )}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Eye className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-1">Prueba de Agudeza Visual</h1>
            <p className="text-gray-400 text-sm">10 niveles · Carta tipo Snellen · Letras aleatorias</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-sm text-amber-800">
            ⚠️ Esta prueba es orientativa y <strong>no sustituye</strong> una evaluación optométrica profesional.
          </div>

          {voiceMode ? (
            <div className="space-y-2 mb-5 text-sm text-gray-700">
              <p className="flex gap-2"><span className="font-bold text-indigo-600">1.</span> Colócate a la distancia indicada y cubre un ojo.</p>
              <p className="flex gap-2"><span className="font-bold text-indigo-600">2.</span> Escucharás <strong>"¿Qué letra ves?"</strong> y el micrófono se abrirá solo.</p>
              <p className="flex gap-2"><span className="font-bold text-indigo-600">3.</span> Di las letras en voz alta y claro. Si el mic no abre, tócalo manualmente.</p>
              <p className="flex gap-2"><span className="font-bold text-indigo-600">4.</span> Se confirma automáticamente en 2 s. Puedes reintentar antes si quieres.</p>
              <p className="text-gray-400 text-xs mt-1">Consejo: pronuncia con calma, por ej. <em>"cé"</em>, <em>"de"</em>, <em>"ene"</em> en lugar de la letra suelta.</p>
            </div>
          ) : (
            <div className="space-y-2 mb-5 text-sm text-gray-700">
              <p className="flex gap-2"><span className="font-bold text-indigo-600">1.</span> Colócate a la distancia indicada y cubre un ojo.</p>
              <p className="flex gap-2"><span className="font-bold text-indigo-600">2.</span> Escribe las letras que veas y presiona <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Enter</kbd>.</p>
            </div>
          )}

          <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-3">
            <p className="text-sm font-semibold text-gray-700">Modo de entrada:</p>
            <div className="flex gap-2">
              <button onClick={() => setVoiceMode(true)} disabled={!hasSpeechSupport}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 text-sm font-semibold transition
                  ${voiceMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-600 border-indigo-300 hover:border-indigo-600'}
                  ${!hasSpeechSupport ? 'opacity-40 cursor-not-allowed' : ''}`}>
                <Mic className="w-4 h-4" /> Voz {!hasSpeechSupport && '(no disponible)'}
              </button>
              <button onClick={() => setVoiceMode(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 text-sm font-semibold transition
                  ${!voiceMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-600 border-indigo-300 hover:border-indigo-600'}`}>
                <Keyboard className="w-4 h-4" /> Teclado
              </button>
            </div>

            {voiceMode && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Idioma:</p>
                <div className="flex gap-2">
                  {(['es', 'en'] as const).map(lang => (
                    <button key={lang} onClick={() => setLanguage(lang)}
                      className={`flex-1 py-2 rounded-lg border-2 text-sm font-semibold transition
                        ${language === lang ? 'bg-indigo-100 text-indigo-700 border-indigo-400' : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'}`}>
                      {lang === 'es' ? '🇲🇽 Español' : '🇺🇸 English'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mb-6">
            <p className="text-sm font-semibold text-gray-700 mb-2">¿A qué distancia está tu pantalla?</p>
            <div className="flex gap-2">
              {(['40', '60', '80'] as const).map(d => (
                <button key={d} onClick={() => setDistance(d)}
                  className={`flex-1 py-2 rounded-lg border-2 text-sm font-semibold transition
                    ${distance === d ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-600 border-indigo-300 hover:border-indigo-600'}`}>
                  {d} cm
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => {
            if (voiceMode && hasSpeechSupport) {
              navigator.mediaDevices?.getUserMedia({ audio: true })
                .then(stream => { stream.getTracks().forEach(t => t.stop()); setPhase('test'); })
                .catch(() => setPhase('test'));
            } else {
              setPhase('test');
            }
          }} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition">
            Comenzar prueba
          </button>
        </div>
      </div>
    );
  }

  // ─── PRUEBA ─────────────────────────────────────────────────────────────────
  if (phase === 'test') {
    const row        = testRows[currentRow];
    const progress   = (currentRow / testRows.length) * 100;
    const listening  = voiceStatus === 'listening';

    return (
      <>
        <style>{`
          @keyframes soundBar {
            from { transform: scaleY(0.35); opacity: 0.7; }
            to   { transform: scaleY(1.0);  opacity: 1;   }
          }
        `}</style>
        <div className="vision-test-root min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">

          {/* Banner Opera inline (pequeño) */}
          {isOpera && voiceMode && (
            <div className="w-full max-w-2xl mb-3 bg-orange-900/80 border border-orange-500/50 rounded-xl px-4 py-2 flex items-center gap-3">
              <span className="text-lg">⚠️</span>
              <p className="text-xs text-orange-200 flex-1">
                Opera no soporta reconocimiento de voz. Usa <strong>Google Chrome</strong> para esta función.
              </p>
              <button
                onClick={() => navigator.clipboard?.writeText(window.location.href).catch(() => {})}
                className="text-xs bg-orange-600 hover:bg-orange-500 text-white px-2 py-1 rounded-lg transition whitespace-nowrap"
              >
                📋 Copiar URL
              </button>
            </div>
          )}

          {/* Header */}
          <div className="w-full max-w-2xl mb-5 flex items-end gap-4">
            <button onClick={() => { stopMic(); if ('speechSynthesis' in window) window.speechSynthesis.cancel(); onBack(); }}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-400">
              <Home className="w-3.5 h-3.5" /> Salir
            </button>
            <div className="flex-1">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Nivel {currentRow + 1} de {testRows.length}</span>
                <span>Agudeza objetivo: <span className="font-bold text-indigo-400">{row.acuity}</span></span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <button onClick={() => { stopMic(); if ('speechSynthesis' in window) window.speechSynthesis.cancel(); setVoiceMode(v => !v); }}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-400">
              {voiceMode ? <><MicOff className="w-3.5 h-3.5" /> Usar teclado</> : <><Mic className="w-3.5 h-3.5" /> Usar voz</>}
            </button>
          </div>

          {/* Carta Snellen */}
          <div
            className={`bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-10 mb-6 flex flex-col items-center transition-all duration-200
              ${shake ? 'ring-4 ring-red-500 scale-[0.98]' : ''}`}
            style={{ minHeight: '180px' }}
          >
            <p className="font-mono font-black tracking-[0.3em] text-black text-center select-none"
               style={{ fontSize: `${Math.round(row.fontSize * scale)}px`, lineHeight: 1.1 }}>
              {row.label}
            </p>
          </div>

          {/* ── Modo voz ── */}
          {voiceMode ? (
            <div className="w-full max-w-2xl flex flex-col items-center gap-3">

              {/* Botón micrófono */}
              <div className="relative flex items-center justify-center">
                {/* Anillos de onda */}
                {listening && (
                  <>
                    <div className="absolute w-36 h-36 rounded-full border-2 border-red-400/30 animate-ping"
                         style={{ animationDuration: '1.1s' }} />
                    <div className="absolute w-30 h-30 rounded-full border-2 border-red-400/20 animate-ping"
                         style={{ animationDuration: '1.5s', animationDelay: '0.4s' }} />
                  </>
                )}
                <button
                  onClick={() => {
                    if (voiceStatus === 'heard') {
                      clearAutoConfirm();
                      setInput(''); setHeardText(''); setHeardLetters('');
                      startListening();
                    } else if (listening) {
                      stopMic();
                    } else {
                      startListening();
                    }
                  }}
                  className={`relative w-24 h-24 rounded-full flex flex-col items-center justify-center gap-2 z-10 transition-all shadow-xl
                    ${listening
                      ? 'bg-red-500 text-white scale-110 shadow-red-500/50 shadow-2xl'
                      : voiceStatus === 'heard'
                      ? 'bg-green-500 text-white'
                      : voiceStatus === 'error'
                      ? 'bg-red-400 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-105'}`}
                >
                  {listening ? (
                    <><SoundWaveBars active={true} /><span className="text-xs font-semibold leading-none">Habla</span></>
                  ) : voiceStatus === 'heard' ? (
                    <><CheckCircle className="w-9 h-9" /><span className="text-xs font-semibold leading-none">OK</span></>
                  ) : voiceStatus === 'error' ? (
                    <><MicOff className="w-9 h-9" /><span className="text-xs font-semibold leading-none">Error</span></>
                  ) : (
                    <><Mic className="w-9 h-9" /><span className="text-xs font-semibold leading-none">Habla</span></>
                  )}
                </button>
              </div>

              {/* Texto en tiempo real mientras habla */}
              {listening && interimText && (
                <p className="text-indigo-300 font-mono text-xl tracking-widest animate-pulse">{interimText}</p>
              )}
              {listening && !interimText && (
                <p className="text-gray-400 text-sm">Di {row.label.split(' ').length === 1 ? 'la letra' : 'las letras'} en voz alta…</p>
              )}

              {/* Resultado capturado */}
              {voiceStatus === 'heard' && (
                <div className="text-center">
                  <p className="text-gray-400 text-xs mb-1">
                    Escuché: <span className="text-white font-mono">"{heardText}"</span>
                  </p>
                  <p className="text-indigo-300 font-mono font-bold text-2xl tracking-widest">{heardLetters}</p>
                  <div className="flex gap-3 mt-3">
                    <button onClick={() => { clearAutoConfirm(); setInput(''); setHeardText(''); setHeardLetters(''); startListening(); }}
                      className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm transition">
                      🔄 Reintentar
                    </button>
                    <button onClick={() => submitInput(heardLetters)}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition">
                      ✓ Confirmar {autoConfirmSecs !== null && `(${autoConfirmSecs}s)`}
                    </button>
                  </div>
                </div>
              )}

              {/* Idle: hint de pronunciación */}
              {voiceStatus === 'idle' && (
                <p className="text-gray-500 text-xs text-center">
                  {language === 'es'
                    ? `Di: "${pronunciationHint}"`
                    : `Say: "${pronunciationHint}"`}
                </p>
              )}

              {/* Error */}
              {voiceStatus === 'error' && (
                <p className="text-red-400 text-sm text-center">
                  {heardText || 'Error de micrófono. Toca el botón o cambia a teclado.'}
                </p>
              )}
            </div>
          ) : (
            /* ── Modo teclado ── */
            <div className="w-full max-w-2xl">
              <div className="flex gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value.toUpperCase())}
                  onKeyDown={e => { if (e.key === 'Enter' && input.trim()) submitInput(input); }}
                  placeholder="Escribe las letras que ves…"
                  maxLength={20}
                  className="flex-1 px-4 py-3 rounded-xl bg-gray-800 text-white text-lg font-mono tracking-widest border-2 border-gray-600 focus:border-indigo-500 focus:outline-none placeholder-gray-500"
                  autoComplete="off" autoCapitalize="characters" spellCheck={false}
                />
                <button onClick={() => submitInput(input)} disabled={!input.trim()}
                  className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold transition">
                  ↵ Confirmar
                </button>
              </div>
              <p className="text-gray-500 text-xs mt-2 text-center">Sin espacios o con espacios · {distance} cm</p>
            </div>
          )}

          {/* Historial de filas */}
          {results.length > 0 && (
            <div className="w-full max-w-2xl flex flex-wrap gap-2 justify-center mt-4">
              {results.map((r, i) => (
                <span key={i} className={`text-xs px-2 py-1 rounded-full font-mono font-bold
                  ${r.canRead ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                  {r.acuity} {r.canRead ? '✓' : '✗'}
                </span>
              ))}
            </div>
          )}
        </div>
      </>
    );
  }

  // ─── RESULTADO ──────────────────────────────────────────────────────────────
  return (
    <div className="vision-test-root min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8">
        <div className="text-center mb-6">
          <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-gray-800">Prueba completada</h2>
          {isSaving && <p className="text-xs text-gray-400 mt-1">Guardando resultado...</p>}
        </div>

        <div className={`${resultInfo.bg} border ${resultInfo.border} rounded-xl p-5 mb-5`}>
          <p className={`text-xl font-bold ${resultInfo.color} mb-1`}>{resultInfo.label}</p>
          <p className="text-sm text-gray-600">{resultInfo.detail}</p>
        </div>

        <div className="mb-5">
          <p className="text-sm font-semibold text-gray-700 mb-2">Detalle por nivel:</p>
          <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
            {results.map((res, i) => (
              <div key={i} className="flex items-center justify-between text-sm px-3 py-1.5 rounded-lg bg-gray-50">
                <span className="text-gray-400 font-mono w-14">{res.acuity}</span>
                <span className="font-mono text-gray-600 tracking-widest text-xs flex-1 text-center">{testRows[i]?.label}</span>
                <span className="font-mono text-xs text-gray-400 italic w-24 text-right truncate">"{res.userInput}"</span>
                <span className={`ml-2 font-bold w-4 ${res.canRead ? 'text-green-600' : 'text-red-500'}`}>
                  {res.canRead ? '✓' : '✗'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6 text-sm text-indigo-800">
          💡 {resultInfo.recommendation}
        </div>

        <div className="flex gap-3">
          <button onClick={handleRestart}
            className="flex items-center justify-center gap-2 flex-1 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold transition">
            <RefreshCw className="w-4 h-4" /> Repetir
          </button>
          <button onClick={onBack}
            className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition">
            Volver al Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default VisionTest;
