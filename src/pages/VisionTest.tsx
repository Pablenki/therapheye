import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Eye, CheckCircle, RefreshCw, Mic, MicOff, Keyboard, Home, X } from 'lucide-react';
import { sql, localISOString } from '../neonCliente';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../i18n';

// ─── Letras Snellen válidas ──────────────────────────────────────────────────
// Solo letras con nombre de ≥2 sílabas en español para mejor reconocimiento de voz:
// efe, hache, jota, ele, eme, ene, erre, ese, zeta
// Excluidas D (de), K (ka), T (te) — monosilábicas, el reconocedor las falla frecuentemente
const SNELLEN_POOL = ['F', 'H', 'J', 'L', 'M', 'N', 'R', 'S', 'Z'];

// ─── Configuración de niveles — 1 letra por nivel, 3 intentos con letra diferente si falla
const ROWS_CONFIG = [
  { fontSize: 96, acuity: '20/200', level: 1,  count: 1 },
  { fontSize: 72, acuity: '20/150', level: 2,  count: 1 },
  { fontSize: 56, acuity: '20/100', level: 3,  count: 1 },
  { fontSize: 42, acuity: '20/70',  level: 4,  count: 1 },
  { fontSize: 32, acuity: '20/50',  level: 5,  count: 1 },
  { fontSize: 24, acuity: '20/40',  level: 6,  count: 1 },
  { fontSize: 18, acuity: '20/30',  level: 7,  count: 1 },
  { fontSize: 14, acuity: '20/20',  level: 8,  count: 1 },
  { fontSize: 11, acuity: '20/15',  level: 9,  count: 1 },
  { fontSize: 9,  acuity: '20/10',  level: 10, count: 1 },
];

interface RowData { label: string; fontSize: number; acuity: string; level: number; }

const generateRandomRows = (): RowData[] =>
  ROWS_CONFIG.map(cfg => {
    const shuffled = [...SNELLEN_POOL].sort(() => Math.random() - 0.5);
    return {
      fontSize: cfg.fontSize,
      acuity: cfg.acuity,
      level: cfg.level,
      label: shuffled.slice(0, cfg.count).join(' '),
    };
  });

// ─── Mapas fonéticos ───────────────────────────────────────────────────────────
const LETTER_MAP_ES: Record<string, string> = {
  'a': 'A', 'ah': 'A', 'ha': 'A',
  'b': 'B', 'be': 'B', 'bé': 'B', 've corta': 'B', 'bbe': 'B',
  'c': 'C', 'ce': 'C', 'cé': 'C', 'se': 'C', 'si': 'C', 'see': 'C', 'sé': 'C', 'le ce': 'C', 'la ce': 'C', 'sea': 'C', 'ze': 'C',
  'd': 'D', 'de': 'D', 'dé': 'D', 'the': 'D', 'le de': 'D', 'la de': 'D',
  'e': 'E', 'eh': 'E', 'ee': 'E', 'le e': 'E', 'la e': 'E', 'hee': 'E', 'le': 'E', 'é': 'E',
  'f': 'F', 'efe': 'F', 'ef': 'F', 'fe': 'F',
  'g': 'G', 'ge': 'G', 'gé': 'G', 'je': 'G', 'jé': 'G',
  'h': 'H', 'hache': 'H', 'ache': 'H', 'hachey': 'H', 'la hache': 'H', 'ach': 'H',
  'i': 'I', 'hi': 'I', 'la i': 'I',
  'j': 'J', 'jota': 'J', 'jo': 'J',
  'k': 'K', 'ka': 'K',
  'l': 'L', 'ele': 'L', 'el': 'L', 'la ele': 'L',
  'm': 'M', 'eme': 'M', 'em': 'M', 'la eme': 'M',
  'n': 'N', 'ene': 'N', 'en': 'N', 'la ene': 'N',
  'o': 'O', 'oh': 'O', 'oo': 'O', 'ho': 'O',
  'p': 'P', 'pe': 'P', 'pé': 'P', 'la pe': 'P',
  'q': 'Q', 'cu': 'Q',
  'r': 'R', 'erre': 'R', 're': 'R', 'la erre': 'R', 'ere': 'R',
  's': 'S', 'ese': 'S', 'la ese': 'S', 'es': 'S',
  't': 'T', 'te': 'T', 'té': 'T', 'la te': 'T',
  'u': 'U', 'uu': 'U', 'hu': 'U', 'la u': 'U',
  'v': 'V', 've': 'V', 'uve': 'V', 'la ve': 'V', 'la uve': 'V', 'be chica': 'V',
  'w': 'W', 'doble ve': 'W', 'doble uve': 'W', 'doble u': 'W',
  'x': 'X', 'equis': 'X', 'ex': 'X',
  'y': 'Y', 'ye': 'Y', 'i griega': 'Y',
  'z': 'Z', 'zeta': 'Z', 'ceta': 'Z', 'seta': 'Z', 'ceda': 'Z', 'la zeta': 'Z', 'zed': 'Z',
};

const LETTER_MAP_EN: Record<string, string> = {
  'a': 'A', 'ay': 'A',
  'b': 'B', 'bee': 'B',
  'c': 'C', 'see': 'C', 'sea': 'C',
  'd': 'D', 'dee': 'D',
  'e': 'E', 'ee': 'E', 'eh': 'E',
  'f': 'F', 'ef': 'F', 'eff': 'F',
  'g': 'G', 'gee': 'G',
  'h': 'H', 'aitch': 'H', 'haitch': 'H',
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


// ─── Extrae UNA sola letra de la transcripción ────────────────────────────────
// KEY FIX: si la letra esperada aparece entre las detectadas → aceptar
// Esto evita el bug de "EEE" cuando el usuario dice "E" repetido.
const extractSingleLetter = (
  transcript: string,
  lang: 'es' | 'en',
  expected?: string,
): string => {
  const map  = lang === 'es' ? LETTER_MAP_ES : LETTER_MAP_EN;
  const map2 = lang === 'es' ? LETTER_MAP_EN : LETTER_MAP_ES;
  const lower = transcript.toLowerCase().trim();
  const words = lower.split(/\s+/).filter(Boolean);

  const mapWord = (word: string): string | null => {
    if (map[word])  return map[word];
    if (map2[word]) return map2[word];
    if (word.length === 1 && /[a-z]/.test(word)) return word.toUpperCase();
    return null;
  };

  const mapped = words.map(mapWord).filter(Boolean) as string[];

  // Si la letra esperada aparece en cualquier posición → aceptar directamente
  // (cubre el caso de repetición: "EEE" cuando esperamos "E")
  if (expected && mapped.includes(expected)) return expected;

  // Intentar también con todo el texto junto (para "la ce" → map["la ce"])
  if (map[lower])  return map[lower];
  if (map2[lower]) return map2[lower];

  // Verificar si la transcripción contiene la letra esperada como carácter
  // (ej: el usuario dice "e" y la API devuelve "e" o "he" o similar)
  if (expected && lower.includes(expected.toLowerCase())) return expected;

  // Devolver la primera letra mapeada que esté en el pool Snellen
  const validMapped = mapped.find(l => SNELLEN_POOL.includes(l));
  if (validMapped) return validMapped;

  // Primera letra mapeada aunque no sea Snellen
  if (mapped.length > 0) return mapped[0];

  // Último recurso: primera letra del primer carácter (si es una letra válida)
  const firstChar = lower[0]?.toUpperCase() ?? '';
  if (firstChar && /[A-Z]/.test(firstChar)) return firstChar;
  return '';
};

// ─── Detección de SpeechRecognition ──────────────────────────────────────────
const SpeechRecognitionAPI: any =
  (window as any).SpeechRecognition ||
  (window as any).webkitSpeechRecognition ||
  (window as any).mozSpeechRecognition ||
  (window as any).msSpeechRecognition;
const SpeechGrammarListAPI: any =
  (window as any).SpeechGrammarList ||
  (window as any).webkitSpeechGrammarList;
const hasSpeechSupport = Boolean(SpeechRecognitionAPI);
// Browser detection handled by isChrome/isEdge/isFirefox below

// ─── Detección de navegador soportado para voz ──────────────────────────────
// Solo Chrome, Edge y Firefox están confirmados como funcionales con SpeechRecognition.
// Brave, Opera y otros pueden tener el API pero se traban/fallan.
const ua = navigator.userAgent;
const isChrome = /Chrome\//.test(ua) && !/OPR\/|Opera|Brave|Edg/.test(ua);
const isEdge = /Edg\//.test(ua);
const isFirefox = /Firefox\//.test(ua);
const isBrave = (navigator as any).brave !== undefined;
const isSupportedBrowser = isChrome || isEdge || isFirefox;
const voiceAvailable = hasSpeechSupport && isSupportedBrowser && !isBrave;

// ─── Traducciones completas ES / EN ──────────────────────────────────────────
type Lang = 'es' | 'en';

const UI: Record<Lang, {
  title: string; subtitle: string; warning: string;
  step1: string; step2voice: string; step3voice: string; step4voice: string;
  step2keyboard: string; step3keyboard: string;
  voiceTip: string; inputModeLabel: string;
  voiceBtn: string; keyboardBtn: string;
  langLabel: string; langEs: string; langEn: string;
  distanceLabel: string; startBtn: string; notAvailable: string;
  levelOf: string; targetAcuity: string;
  letterLabel: string; attemptLabel: string;
  speakNow: string; iHeard: string;
  retryBtn: string; confirmBtn: string;
  useKeyboard: string; useVoice: string; exitBtn: string;
  typeLetter: string; noSpaces: string;
  promptSingle: string; promptLetterOf: (n: number, t: number) => string;
  testCompleted: string; saving: string;
  detailByLevel: string; repeatBtn: string; backDashboard: string;
  operaTitle: string; operaDetail: string; copyUrl: string;
  retryOf: (n: number) => string; failedLevel: string;
}> = {
  es: {
    title: 'Prueba de Agudeza Visual',
    subtitle: '10 niveles · Carta tipo Snellen · Letras aleatorias',
    warning: 'Esta prueba es orientativa y no sustituye una evaluación optométrica profesional.',
    step1: 'Colócate a la distancia indicada y cubre un ojo.',
    step2voice: 'El micrófono se abrirá automáticamente para cada letra.',
    step3voice: 'Di la letra en voz alta. Se valida una letra a la vez.',
    step4voice: 'Si fallas, aparece una letra diferente en el mismo nivel. Tienes hasta 3 intentos por nivel.',
    step2keyboard: 'Escribe la letra que veas y presiona Enter.',
    step3keyboard: 'Una letra por nivel. Si fallas, ves una letra diferente. Hasta 3 intentos por nivel.',
    voiceTip: 'Consejo: di con calma → "efe", "hache", "jota", "ele", "eme", "ene", "erre", "ese", "zeta".',
    inputModeLabel: 'Modo de entrada:',
    voiceBtn: 'Voz',
    keyboardBtn: 'Teclado',
    langLabel: 'Idioma de reconocimiento:',
    langEs: '🇲🇽 Español',
    langEn: '🇺🇸 English',
    distanceLabel: '¿A qué distancia está tu pantalla?',
    startBtn: 'Comenzar prueba',
    notAvailable: '(no disponible)',
    levelOf: 'de',
    targetAcuity: 'Agudeza objetivo:',
    letterLabel: 'Letra',
    attemptLabel: 'Intento',
    speakNow: 'Di la letra en voz alta…',
    iHeard: 'Escuché:',
    retryBtn: '🔄 Reintentar',
    confirmBtn: 'Confirmar',
    useKeyboard: 'Usar teclado',
    useVoice: 'Usar voz',
    exitBtn: 'Salir',
    typeLetter: 'Escribe la letra que ves…',
    noSpaces: 'Solo una letra · distancia configurada',
    promptSingle: '¿Qué letra ves?',
    promptLetterOf: (_n, _t) => '¿Qué letra ves?',
    testCompleted: 'Prueba completada',
    saving: 'Guardando resultado…',
    detailByLevel: 'Detalle por nivel:',
    repeatBtn: 'Repetir',
    backDashboard: 'Volver al Dashboard',
    operaTitle: 'Reconocimiento de voz no disponible en este navegador',
    operaDetail: 'El reconocimiento de voz solo funciona en Google Chrome, Microsoft Edge o Firefox. Abre esta página en uno de esos navegadores.',
    copyUrl: '📋 Copiar URL',
    retryOf: (n) => `Intento ${n}/3`,
    failedLevel: 'Nivel fallado — prueba terminada',
  },
  en: {
    title: 'Visual Acuity Test',
    subtitle: '10 levels · Snellen chart · Random letters',
    warning: 'This test is informational and does not replace a professional optometric evaluation.',
    step1: 'Position yourself at the indicated distance and cover one eye.',
    step2voice: 'The microphone will open automatically for each letter.',
    step3voice: 'Say each letter clearly. One letter is validated at a time.',
    step4voice: 'If you fail, a different letter appears at the same level. Up to 3 attempts per level.',
    step2keyboard: 'Type the letter you see and press Enter.',
    step3keyboard: 'One letter per level. If you fail, a different letter appears. Up to 3 attempts per level.',
    voiceTip: 'Tip: speak clearly → "eff", "aitch", "jay", "el", "em", "en", "ar", "ess", "zee".',
    inputModeLabel: 'Input mode:',
    voiceBtn: 'Voice',
    keyboardBtn: 'Keyboard',
    langLabel: 'Recognition language:',
    langEs: '🇲🇽 Español',
    langEn: '🇺🇸 English',
    distanceLabel: 'How far are you from the screen?',
    startBtn: 'Start test',
    notAvailable: '(not available)',
    levelOf: 'of',
    targetAcuity: 'Target acuity:',
    letterLabel: 'Letter',
    attemptLabel: 'Attempt',
    speakNow: 'Say the letter out loud…',
    iHeard: 'I heard:',
    retryBtn: '🔄 Try again',
    confirmBtn: 'Confirm',
    useKeyboard: 'Use keyboard',
    useVoice: 'Use voice',
    exitBtn: 'Exit',
    typeLetter: 'Type the letter you see…',
    noSpaces: 'One letter only · configured distance',
    promptSingle: 'What letter do you see?',
    promptLetterOf: (_n, _t) => 'What letter do you see?',
    testCompleted: 'Test completed',
    saving: 'Saving result…',
    detailByLevel: 'Detail by level:',
    repeatBtn: 'Repeat',
    backDashboard: 'Back to Dashboard',
    operaTitle: 'Voice recognition not available in this browser',
    operaDetail: 'Voice recognition only works in Google Chrome, Microsoft Edge, or Firefox. Open this page in one of those browsers.',
    copyUrl: '📋 Copy URL',
    retryOf: (n) => `Attempt ${n}/3`,
    failedLevel: 'Level failed — test ended',
  },
};

// ─── Resultado según nivel ────────────────────────────────────────────────────
type ResultInfo = {
  label: string;
  acuityRange: string;
  detail: string;
  description: string;
  recommendations: string[];
  urgency: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  showOptometrist: boolean;
  color: string; bg: string; border: string;
  badgeColor: string;
};

const getResultInfo = (bestLevel: number, lang: Lang): ResultInfo => {
  const es = lang === 'es';

  if (bestLevel >= 9) return {
    label:        es ? 'Visión excepcional' : 'Exceptional vision',
    acuityRange:  '20/15 – 20/10',
    detail:       es ? 'Tu agudeza visual está por encima del promedio normal.' : 'Your visual acuity is above the normal average.',
    description:  es
      ? 'Tienes una capacidad visual sobresaliente. Esto significa que puedes distinguir detalles más finos de lo que la mayoría de las personas considera "normal". Es poco común y generalmente indica una excelente salud ocular. Aún así, los ojos se fatigan con el uso prolongado de pantallas, por lo que los hábitos preventivos siguen siendo importantes.'
      : 'You have outstanding visual ability. This means you can distinguish finer details than most people consider "normal". It is uncommon and generally indicates excellent eye health. Even so, eyes tire with prolonged screen use, so preventive habits are still important.',
    recommendations: es ? [
      'Continúa con la regla 20-20-20: cada 20 min descansa 20 seg mirando a 20 pies (6 m)',
      'Mantén pantallas a 50–70 cm de distancia para reducir fatiga',
      'Repite el test cada 3–6 meses para monitorear cambios',
      'Usa buena iluminación al trabajar frente a pantallas',
    ] : [
      'Keep using the 20-20-20 rule: every 20 min rest 20 sec looking 20 feet (6 m) away',
      'Keep screens 50–70 cm away to reduce fatigue',
      'Repeat the test every 3–6 months to monitor changes',
      'Use good lighting when working in front of screens',
    ],
    urgency: 'excellent', showOptometrist: false,
    color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', badgeColor: 'bg-emerald-500',
  };

  if (bestLevel >= 8) return {
    label:        es ? 'Visión normal' : 'Normal vision',
    acuityRange:  '20/20',
    detail:       es ? 'Tu agudeza visual es óptima para la distancia de pantalla.' : 'Your visual acuity is optimal for screen distance.',
    description:  es
      ? 'Tu visión se encuentra dentro del rango considerado "normal" o estándar. Esto significa que puedes leer letras a la distancia convencional sin dificultad. La visión 20/20 no es la máxima posible, pero es el punto de referencia clínico para una visión funcional y saludable en adultos.'
      : 'Your vision is within the "normal" or standard range. This means you can read letters at conventional distance without difficulty. 20/20 vision is not the maximum possible, but it is the clinical reference point for functional and healthy adult vision.',
    recommendations: es ? [
      'Aplica la regla 20-20-20 durante el uso de pantallas',
      'Realiza ejercicios de enfoque cercano-lejano para prevenir miopía digital',
      'Considera revisión anual con optometrista como medida preventiva',
      'Ajusta el brillo de la pantalla al nivel del ambiente para reducir fatiga',
    ] : [
      'Apply the 20-20-20 rule during screen use',
      'Do near-far focus exercises to prevent digital myopia',
      'Consider an annual optometrist checkup as a preventive measure',
      'Adjust screen brightness to the ambient light level to reduce fatigue',
    ],
    urgency: 'good', showOptometrist: false,
    color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', badgeColor: 'bg-green-500',
  };

  if (bestLevel >= 6) return {
    label:        es ? 'Visión buena' : 'Good vision',
    acuityRange:  '20/30 – 20/40',
    detail:       es ? 'Ligera dificultad en líneas pequeñas. Puede ser cansancio acumulado.' : 'Slight difficulty with small lines. May be accumulated fatigue.',
    description:  es
      ? 'Tu visión es funcional pero muestra una leve reducción respecto al estándar 20/20. Esto puede deberse a fatiga ocular acumulada por pantallas, iluminación inadecuada, o un inicio de miopía. La buena noticia es que en muchos casos mejora con descanso y ejercicios visuales. Si es persistente, puede indicar que necesitas corrección óptica ligera.'
      : 'Your vision is functional but shows a slight reduction from the 20/20 standard. This may be due to accumulated eye fatigue from screens, poor lighting, or early myopia. The good news is that in many cases it improves with rest and visual exercises. If persistent, it may indicate you need mild optical correction.',
    recommendations: es ? [
      'Practica el ejercicio de enfoque cercano-lejano: alterna mirar cerca y lejos durante 5 min',
      'Aplica palming: cúbrete los ojos con las palmas calientes por 2 min para relajarlos',
      'Aumenta la distancia a tu pantalla a al menos 60 cm',
      'Revisa la iluminación — evita reflejos y pantallas más brillantes que el ambiente',
      'Si la dificultad persiste más de una semana, agenda revisión con optometrista',
    ] : [
      'Practice near-far focus exercise: alternate looking near and far for 5 min',
      'Apply palming: cover your eyes with warm palms for 2 min to relax them',
      'Increase your screen distance to at least 60 cm',
      'Check lighting — avoid glare and screens brighter than the environment',
      'If difficulty persists more than a week, schedule an optometrist visit',
    ],
    urgency: 'fair', showOptometrist: false,
    color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', badgeColor: 'bg-blue-500',
  };

  if (bestLevel >= 4) return {
    label:        es ? 'Visión reducida' : 'Reduced vision',
    acuityRange:  '20/50 – 20/70',
    detail:       es ? 'Dificultad notable en caracteres medianos. Se recomienda evaluación.' : 'Notable difficulty with medium characters. Evaluation recommended.',
    description:  es
      ? 'Tu visión muestra una reducción notable que va más allá de la fatiga normal. A este nivel, es probable que ya tengas dificultades para leer texto de tamaño normal en la pantalla sin acercarte o forzar la vista. Esto puede indicar miopía moderada, astigmatismo u otro error refractivo que se puede corregir fácilmente con lentes o con tratamiento. No lo dejes pasar — tu calidad de vida mejora significativamente con la corrección adecuada.'
      : 'Your vision shows a notable reduction that goes beyond normal fatigue. At this level, you likely already have difficulty reading normal-sized text on screen without getting closer or straining. This may indicate moderate myopia, astigmatism, or other refractive error that can be easily corrected with glasses or treatment. Don\'t let it go — your quality of life improves significantly with proper correction.',
    recommendations: es ? [
      'Agenda una cita con optometrista o oftalmólogo — la corrección óptica puede cambiar tu día a día',
      'Mientras tanto: practica palming y la regla 20-20-20 para aliviar síntomas',
      'Limita el tiempo continuo frente a pantallas a máximo 45 min sin descanso',
      'Aumenta el tamaño de fuente en dispositivos y aumenta la distancia a la pantalla',
      'Evita ambientes con poca luz al usar pantallas — esto acelera la fatiga',
    ] : [
      'Schedule an appointment with an optometrist or ophthalmologist — optical correction can change your daily life',
      'Meanwhile: practice palming and the 20-20-20 rule to relieve symptoms',
      'Limit continuous screen time to a maximum of 45 min without a break',
      'Increase font size on devices and increase screen distance',
      'Avoid low-light environments when using screens — this accelerates fatigue',
    ],
    urgency: 'poor', showOptometrist: true,
    color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200', badgeColor: 'bg-yellow-500',
  };

  return {
    label:        es ? 'Visión muy limitada' : 'Very limited vision',
    acuityRange:  '20/100 o menos',
    detail:       es ? 'Solo puedes leer caracteres grandes. Se recomienda evaluación profesional urgente.' : 'You can only read large characters. Urgent professional evaluation recommended.',
    description:  es
      ? 'Tu resultado indica una dificultad visual significativa. A este nivel, las actividades cotidianas como leer, conducir o trabajar frente a pantallas pueden ser difíciles o incluso peligrosas sin corrección. Es fundamental que consultes a un profesional de la salud visual lo antes posible. La buena noticia: la mayoría de los problemas visuales a este nivel tienen solución — lentes, cirugía refractiva o tratamiento pueden restaurar tu calidad visual.'
      : 'Your result indicates significant visual difficulty. At this level, everyday activities such as reading, driving, or working in front of screens may be difficult or even dangerous without correction. It is essential that you consult a vision health professional as soon as possible. The good news: most vision problems at this level have a solution — glasses, refractive surgery, or treatment can restore your visual quality.',
    recommendations: es ? [
      '⚠️ Consulta a un optometrista u oftalmólogo lo antes posible',
      'Evita actividades de riesgo (conducir, maquinaria) hasta recibir evaluación',
      'Limita uso de pantallas a lo estrictamente necesario',
      'Lleva un registro de tus síntomas (dolores de cabeza, visión doble, etc.) para compartir con el especialista',
      'No postergues la consulta — la detección temprana mejora el pronóstico',
    ] : [
      '⚠️ Consult an optometrist or ophthalmologist as soon as possible',
      'Avoid risky activities (driving, machinery) until evaluated',
      'Limit screen use to the strictly necessary',
      'Keep a record of symptoms (headaches, double vision, etc.) to share with the specialist',
      'Don\'t delay the appointment — early detection improves the prognosis',
    ],
    urgency: 'critical', showOptometrist: true,
    color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', badgeColor: 'bg-red-500',
  };
};

// Idioma se obtiene del contexto (useLanguage) en el componente

// ─── Barras de onda animadas ──────────────────────────────────────────────────
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

type Phase = 'instructions' | 'test' | 'result';
type VoiceStatus = 'idle' | 'listening' | 'heard' | 'error';
interface RowResult { level: number; acuity: string; canRead: boolean; userInput: string; }

// ─── Animación demo: modo voz ─────────────────────────────────────────────────
const VoiceDemoAnim = () => (
  <>
    <style>{`
      @keyframes vdMicPulse { 0%,100%{transform:scale(1);opacity:.25} 50%{transform:scale(1.5);opacity:.6} }
      @keyframes vdMicPulse2{ 0%,100%{transform:scale(1);opacity:.15} 50%{transform:scale(1.9);opacity:.35} }
      @keyframes vdBubble   { 0%,100%{opacity:0;transform:translateX(-50%) translateY(4px)} 30%,70%{opacity:1;transform:translateX(-50%) translateY(0)} }
      @keyframes vdArrow    { 0%,100%{opacity:.4;transform:translateY(0)} 50%{opacity:1;transform:translateY(4px)} }
    `}</style>
    <svg viewBox="0 0 260 130" className="w-full max-w-xs mx-auto" aria-hidden="true">
      {/* carta Snellen */}
      <rect x="80" y="8" width="100" height="52" rx="8" fill="white" stroke="#e5e7eb" strokeWidth="1.5" />
      <text x="130" y="47" textAnchor="middle" fontFamily="monospace" fontWeight="900" fontSize="36" fill="#1e1b4b">F</text>
      <text x="130" y="68" textAnchor="middle" fontSize="9" fill="#9ca3af">20/40</text>

      {/* flecha */}
      <text x="130" y="84" textAnchor="middle" fontSize="14" fill="#6366f1"
        style={{ animation: 'vdArrow 1.4s ease-in-out infinite' }}>↓</text>

      {/* micrófono — ondas */}
      <circle cx="130" cy="108" r="18" fill="#6366f1" opacity="0.25"
        style={{ animation: 'vdMicPulse 1.6s ease-in-out infinite', transformOrigin: '130px 108px' }} />
      <circle cx="130" cy="108" r="26" fill="#6366f1" opacity="0.12"
        style={{ animation: 'vdMicPulse2 1.6s ease-in-out infinite 0.3s', transformOrigin: '130px 108px' }} />
      {/* mic icon */}
      <rect x="124" y="96" width="12" height="17" rx="6" fill="#6366f1" />
      <path d="M119 110 Q119 120 130 120 Q141 120 141 110" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" />
      <line x1="130" y1="120" x2="130" y2="125" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" />

      {/* burbuja de voz */}
      <g style={{ animation: 'vdBubble 2.4s ease-in-out infinite', position: 'relative' }}>
        <rect x="157" y="92" width="50" height="22" rx="8" fill="#6366f1" />
        <polygon points="157,100 150,105 157,110" fill="#6366f1" />
        <text x="182" y="107" textAnchor="middle" fontSize="11" fill="white" fontWeight="bold">efe…</text>
      </g>
    </svg>
  </>
);

// ─── Animación demo: modo teclado ─────────────────────────────────────────────
const KeyboardDemoAnim = () => (
  <>
    <style>{`
      @keyframes kdPress  { 0%,100%{transform:translateY(0);box-shadow:0 4px 0 #4338ca} 40%,60%{transform:translateY(3px);box-shadow:0 1px 0 #4338ca} }
      @keyframes kdArrowK { 0%,100%{opacity:.4;transform:translateY(0)} 50%{opacity:1;transform:translateY(4px)} }
    `}</style>
    <div className="flex flex-col items-center gap-1 py-2">
      {/* carta */}
      <div className="bg-white border border-gray-200 rounded-xl px-10 py-3 shadow-sm">
        <span className="font-mono font-black text-5xl text-indigo-900">F</span>
        <p className="text-center text-xs text-gray-400 mt-1">20/40</p>
      </div>
      {/* flecha */}
      <div className="text-indigo-500 text-xl" style={{ animation: 'kdArrowK 1.4s ease-in-out infinite' }}>↓</div>
      {/* tecla */}
      <div className="flex gap-2">
        {['F'].map(k => (
          <div key={k}
            className="w-12 h-12 bg-indigo-600 text-white rounded-lg flex items-center justify-center font-mono font-black text-xl"
            style={{ animation: 'kdPress 1.8s ease-in-out infinite', boxShadow: '0 4px 0 #4338ca' }}>
            {k}
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-1">+ Enter</p>
    </div>
  </>
);

// ─── Componente principal ─────────────────────────────────────────────────────
const VisionTest = ({ onBack }: { onBack: () => void }) => {
  const { lang: ctxLang } = useLanguage();
  const [phase, setPhase]                     = useState<Phase>('instructions');
  const [currentRow, setCurrentRow]           = useState(0);
  const [currentLetterIdx, setCurrentLetterIdx] = useState(0);
  const [letterAttempts, setLetterAttempts]   = useState(0);  // 0 = first try, 1 = retry
  const [rowLetterResults, setRowLetterResults] = useState<boolean[]>([]);
  const [results, setResults]                 = useState<RowResult[]>([]);

  const [testRows, setTestRows]               = useState<RowData[]>(() => generateRandomRows());

  const [voiceMode, setVoiceMode]             = useState(voiceAvailable);
  const [voiceStatus, setVoiceStatus]         = useState<VoiceStatus>('idle');
  const [heardText, setHeardText]             = useState('');
  const [heardLetter, setHeardLetter]         = useState('');
  const [interimText, setInterimText]         = useState('');
  const [autoConfirmSecs, setAutoConfirmSecs] = useState<number | null>(null);

  const [input, setInput]                     = useState('');
  const [shake, setShake]                     = useState(false);
  const [distance, setDistance]               = useState<'40' | '60' | '80'>('60');
  const language: Lang = (ctxLang || 'es') as Lang;  // Usa idioma de accesibilidad
  const [isSaving, setIsSaving]               = useState(false);
  const [showOptModal, setShowOptModal]       = useState(false);
  const [optMapUrl, setOptMapUrl]             = useState<string | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  const inputRef        = useRef<HTMLInputElement>(null);
  const recognRef       = useRef<any>(null);
  const autoConfRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultsRef      = useRef<RowResult[]>([]);
  const isActiveRef     = useRef(false);
  const isSubmittingRef = useRef(false);

  // Refs para evitar stale closures
  const voiceStatusRef      = useRef<VoiceStatus>('idle');
  const currentRowRef       = useRef(currentRow);
  const currentLetterIdxRef = useRef(currentLetterIdx);
  const letterAttemptsRef   = useRef(letterAttempts);
  const languageRef         = useRef(language);
  const testRowsRef         = useRef(testRows);
  const voiceModeRef        = useRef(voiceMode);
  const phaseRef            = useRef<Phase>('instructions');
  const levelAttemptsRef    = useRef(0);          // intentos usados en el nivel actual (0, 1, 2)
  const levelUsedLettersRef = useRef<string[]>([]); // letras ya mostradas en el nivel actual

  useEffect(() => { currentRowRef.current       = currentRow;       }, [currentRow]);
  useEffect(() => { currentLetterIdxRef.current = currentLetterIdx; }, [currentLetterIdx]);
  useEffect(() => { letterAttemptsRef.current   = letterAttempts;   }, [letterAttempts]);
  useEffect(() => { languageRef.current         = language;         }, [language]);
  useEffect(() => { testRowsRef.current         = testRows;         }, [testRows]);
  useEffect(() => { voiceModeRef.current        = voiceMode;        }, [voiceMode]);
  useEffect(() => { phaseRef.current            = phase;            }, [phase]);
  useEffect(() => { resultsRef.current          = results;          }, [results]);

  const { user } = useUser();
  const ui = UI[language];
  const distanceScale: Record<string, number> = { '40': 0.75, '60': 1, '80': 1.3 };
  const scale = distanceScale[distance];

  const setVS = useCallback((s: VoiceStatus) => {
    voiceStatusRef.current = s;
    setVoiceStatus(s);
  }, []);

  const clearAutoConfirm = useCallback(() => {
    if (autoConfRef.current) { clearInterval(autoConfRef.current); autoConfRef.current = null; }
    setAutoConfirmSecs(null);
  }, []);

  const stopMic = useCallback(() => {
    isActiveRef.current = false;
    if (recognRef.current) { try { recognRef.current.abort(); } catch { } recognRef.current = null; }
    setVS('idle');
    clearAutoConfirm();
    setInterimText('');
  }, [setVS, clearAutoConfirm]);

  // ── TTS con idioma correcto ───────────────────────────────────────────────────
  // Chrome bug workaround: speechSynthesis puede quedar "paused" internamente.
  // Solución: cancel() + resume() + pequeño delay antes de speak().
  const speakPrompt = useCallback((text: string, lang: Lang, onEnd?: () => void) => {
    if (!('speechSynthesis' in window)) { onEnd?.(); return; }

    // Reset completo del engine para evitar estados fantasma
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();

    const utt   = new SpeechSynthesisUtterance(text);
    utt.lang    = lang === 'es' ? 'es-MX' : 'en-US';
    utt.rate    = 1.1;
    utt.pitch   = 1.0;
    utt.volume  = 1.0;

    const loadVoice = () => {
      const voces = window.speechSynthesis.getVoices();
      const voz   = lang === 'es'
        ? (voces.find(v => v.lang === 'es-MX') || voces.find(v => v.lang.startsWith('es')))
        : (voces.find(v => v.lang === 'en-US') || voces.find(v => v.lang.startsWith('en')));
      if (voz) utt.voice = voz;
    };
    if (window.speechSynthesis.getVoices().length > 0) {
      loadVoice();
    } else {
      window.speechSynthesis.addEventListener('voiceschanged', loadVoice, { once: true });
    }

    let fired = false;
    const done = () => { if (!fired) { fired = true; setTimeout(() => onEnd?.(), 150); } };
    const fallback = setTimeout(done, 3000);
    utt.onend  = () => { clearTimeout(fallback); done(); };
    utt.onerror = () => { clearTimeout(fallback); done(); };

    // Pequeño delay para que Chrome procese el cancel()/resume() antes del speak()
    setTimeout(() => {
      try {
        window.speechSynthesis.speak(utt);
      } catch {
        done();
      }
    }, 50);
  }, []);

  // ── submitLetter — validar UNA letra ─────────────────────────────────────────
  const submitLetter = useCallback(async (detectedLetter: string) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    isActiveRef.current = false;
    clearAutoConfirm();
    if (recognRef.current) { try { recognRef.current.abort(); } catch { } recognRef.current = null; }

    const rowIdx    = currentRowRef.current;
    const letterIdx = currentLetterIdxRef.current;
    const row       = testRowsRef.current[rowIdx];
    const letters   = row.label.split(' ');
    const expected  = letters[letterIdx];
    const matched   = detectedLetter === expected;

    if (matched) {
      const isLastLetter = letterIdx >= letters.length - 1;

      if (!isLastLetter) {
        // Correcto, más letras en esta fila — avanzar al siguiente índice
        setRowLetterResults(prev => [...prev, true]);
        setCurrentLetterIdx(letterIdx + 1);
        setLetterAttempts(0);
        setHeardText(''); setHeardLetter(''); setInput('');
        setVS('idle');
        isSubmittingRef.current = false;
        // El useEffect con [currentLetterIdx, letterAttempts] reinicia el mic
      } else {
        // Todas las letras de la fila correctas — avanzar a la siguiente fila
        const newResult: RowResult = {
          level: row.level, acuity: row.acuity, canRead: true,
          userInput: letters.join(''),
        };
        const newResults = [...resultsRef.current, newResult];
        setResults(newResults);
        setRowLetterResults([]);
        setCurrentLetterIdx(0);
        setLetterAttempts(0);
        levelAttemptsRef.current = 0;
        levelUsedLettersRef.current = [];
        setHeardText(''); setHeardLetter(''); setInput('');
        setVS('idle');
        isSubmittingRef.current = false;

        if (rowIdx < testRowsRef.current.length - 1) {
          setCurrentRow(rowIdx + 1);
        } else {
          await saveResult(newResults);
          setPhase('result');
        }
      }
    } else {
      // Incorrecto — animar shake
      setShake(true);
      setTimeout(() => {
        setShake(false);

        // Registrar la letra fallada y avanzar contador de intentos del nivel
        const usedLetters = [...levelUsedLettersRef.current, expected];
        levelUsedLettersRef.current = usedLetters;
        levelAttemptsRef.current++;

        if (levelAttemptsRef.current < 3) {
          // Mostrar una letra diferente en el mismo nivel
          const available = SNELLEN_POOL.filter(l => !usedLetters.includes(l));
          const newLetter = available.length > 0
            ? available[Math.floor(Math.random() * available.length)]
            : (SNELLEN_POOL.find(l => l !== expected) ?? SNELLEN_POOL[0]);
          setTestRows(prev => prev.map((r, i) =>
            i === rowIdx ? { ...r, label: newLetter } : r
          ));
          setLetterAttempts(prev => prev + 1); // trigger useEffect → reinicia mic
          setHeardText(''); setHeardLetter(''); setInput('');
          setVS('idle');
          isSubmittingRef.current = false;
        } else {
          // 3 errores en el nivel → terminar test
          const newResult: RowResult = {
            level: row.level, acuity: row.acuity, canRead: false,
            userInput: detectedLetter,
          };
          const newResults = [...resultsRef.current, newResult];
          isSubmittingRef.current = false;
          setResults(newResults);
          saveResult(newResults).then(() => setPhase('result'));
        }
      }, 600);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearAutoConfirm, setVS]);

  // ── handleFinalResult — procesar resultado de voz ─────────────────────────────
  const handleFinalResult = useCallback((transcript: string, precomputed?: string) => {
    const row    = testRowsRef.current[currentRowRef.current];
    const letters = row.label.split(' ');
    const expected = letters[currentLetterIdxRef.current];

    const detected = precomputed ?? extractSingleLetter(transcript, languageRef.current, expected);

    clearAutoConfirm();
    setInterimText('');
    setVS('heard');
    setHeardText(transcript);
    setHeardLetter(detected);
    setInput(detected);

    // Auto-confirmar — siempre 1.5s (letra a letra es rápido)
    let secs = 1.5;
    setAutoConfirmSecs(Math.ceil(secs));
    autoConfRef.current = setInterval(() => {
      secs -= 1;
      setAutoConfirmSecs(Math.ceil(secs));
      if (secs <= 0) {
        clearInterval(autoConfRef.current!);
        autoConfRef.current = null;
        setAutoConfirmSecs(null);
        submitLetter(detected);
      }
    }, 1000);
  }, [setVS, submitLetter, clearAutoConfirm]);

  // ── spawnRecognition — siempre nueva instancia ────────────────────────────────
  const spawnRecognition = useCallback(() => {
    if (!voiceAvailable || !isActiveRef.current) return;

    const row    = testRowsRef.current[currentRowRef.current];
    const letters = row.label.split(' ');
    const expected = letters[currentLetterIdxRef.current];
    const lang   = languageRef.current;

    const recognition = new SpeechRecognitionAPI();
    recognition.lang             = lang === 'es' ? 'es-MX' : 'en-US';
    recognition.interimResults   = true;
    recognition.maxAlternatives  = 8;
    recognition.continuous       = false; // una sola emisión por letra

    // Gramáticas con variantes fonéticas de la letra esperada
    if (SpeechGrammarListAPI && expected) {
      try {
        const gl = new SpeechGrammarListAPI();
        const mapSrc = lang === 'es' ? LETTER_MAP_ES : LETTER_MAP_EN;
        const mapAlt = lang === 'es' ? LETTER_MAP_EN : LETTER_MAP_ES;
        const variants = [
          ...Object.entries(mapSrc).filter(([, v]) => v === expected).map(([k]) => k),
          ...Object.entries(mapAlt).filter(([, v]) => v === expected).map(([k]) => k),
          expected.toLowerCase(),
        ];
        const grammar = `#JSGF V1.0; grammar letters; public <letter> = ${[...new Set(variants)].join(' | ')};`;
        gl.addFromString(grammar, 1);
        recognition.grammars = gl;
      } catch { /* noop */ }
    }

    recognition.onstart = () => {
      setVS('listening');
      setInterimText('');
    };

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];

        if (!result.isFinal) {
          setInterimText(result[0].transcript);
          continue;
        }

        // Resultado final: buscar mejor alternativa (priorizar la que coincide con expected)
        let bestTranscript = result[0].transcript;
        let bestLetter     = extractSingleLetter(bestTranscript, lang, expected);

        for (let alt = 1; alt < result.length; alt++) {
          const altT = result[alt].transcript;
          const altL = extractSingleLetter(altT, lang, expected);
          if (altL === expected) {
            bestTranscript = altT;
            bestLetter     = altL;
            break;
          }
        }

        handleFinalResult(bestTranscript.trim(), bestLetter);
        return;
      }
    };

    recognition.onerror = (ev: any) => {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        isActiveRef.current = false;
        setVS('error');
        setHeardText(language === 'es'
          ? 'Sin permiso de micrófono. Revisa la configuración del navegador.'
          : 'No microphone permission. Check your browser settings.');
      }
      setInterimText('');
    };

    recognition.onend = () => {
      recognRef.current = null;
      if (isActiveRef.current && voiceStatusRef.current !== 'heard') {
        setTimeout(() => { if (isActiveRef.current) spawnRecognition(); }, 250);
      } else if (voiceStatusRef.current !== 'heard') {
        setVS('idle');
      }
    };

    recognRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      recognRef.current   = null;
      isActiveRef.current = false;
      setVS('error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setVS, handleFinalResult, language]);

  const startListening = useCallback(() => {
    if (!voiceAvailable) return;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (recognRef.current) { try { recognRef.current.abort(); } catch { } recognRef.current = null; }
    clearAutoConfirm();
    setHeardText(''); setHeardLetter(''); setInterimText('');
    isActiveRef.current = true;
    spawnRecognition();
  }, [spawnRecognition, clearAutoConfirm]);

  // ── Efecto principal: al cambiar fila, letra, o intento → reiniciar mic/TTS ──
  // Nota: letterAttempts=1 (reintento) también dispara este efecto correctamente.
  useEffect(() => {
    if (phase !== 'test') return;

    isActiveRef.current = false;
    if (recognRef.current) { try { recognRef.current.abort(); } catch { } recognRef.current = null; }
    clearAutoConfirm();
    setInput('');
    setHeardText(''); setHeardLetter(''); setInterimText('');
    setVS('idle');
    isSubmittingRef.current = false;

    if (voiceMode) {
      const row     = testRows[currentRow];
      const letters = row.label.split(' ');
      const total   = letters.length;
      const prompt  = total === 1
        ? ui.promptSingle
        : ui.promptLetterOf(currentLetterIdx + 1, total);

      const timer = setTimeout(() => {
        speakPrompt(prompt, language, () => {
          if (phaseRef.current === 'test') startListening();
        });
      }, 400);
      return () => clearTimeout(timer);
    } else {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRow, currentLetterIdx, letterAttempts, phase, voiceMode]);

  // ── Cleanup al desmontar ──────────────────────────────────────────────────────
  useEffect(() => () => {
    isActiveRef.current = false;
    if (recognRef.current) { try { recognRef.current.abort(); } catch { } }
    clearAutoConfirm();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, [clearAutoConfirm]);

  // ── Modal de oftalmólogos ────────────────────────────────────────────────────
  const handleOpenOptModal = () => {
    setShowOptModal(true);
    if (optMapUrl) return; // Ya tenemos la URL
    setGettingLocation(true);
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const query = encodeURIComponent('oftalmólogo optometrista');
        setOptMapUrl(`https://maps.google.com/maps?q=${query}&ll=${lat},${lng}&z=13&output=embed&hl=es`);
        setGettingLocation(false);
      },
      () => {
        // Sin ubicación → búsqueda genérica
        setOptMapUrl(`https://maps.google.com/maps?q=oftalmólogo+optometrista&output=embed&hl=es`);
        setGettingLocation(false);
      },
      { timeout: 6000 }
    );
  };

  // ── Guardar resultado en BD ──────────────────────────────────────────────────
  const saveResult = async (finalResults: RowResult[]) => {
    setIsSaving(true);
    try {
      const bestLevel  = finalResults.filter(r => r.canRead).reduce((max, r) => Math.max(max, r.level), 0);
      const bestAcuity = testRows.find(r => r.level === bestLevel)?.acuity ?? 'N/A';
      await sql`
        INSERT INTO historial_vision_test (user_id, mejor_nivel, agudeza, distancia_cm, resultados_json, created_at)
        VALUES (${user?.id}, ${bestLevel}, ${bestAcuity}, ${parseInt(distance)}, ${JSON.stringify(finalResults)}, ${localISOString()})
      `;
    } catch (err) { console.error('Error guardando resultado:', err); }
    finally { setIsSaving(false); }
  };

  const handleRestart = () => {
    stopMic();
    setTestRows(generateRandomRows());
    setPhase('instructions');
    setCurrentRow(0);
    setCurrentLetterIdx(0);
    setLetterAttempts(0);
    levelAttemptsRef.current = 0;
    levelUsedLettersRef.current = [];
    setRowLetterResults([]);
    setResults([]);
    setInput('');
    setHeardText(''); setHeardLetter(''); setInterimText('');
  };

  const bestLevel  = results.filter(r => r.canRead).reduce((max, r) => Math.max(max, r.level), 0);
  const resultInfo = getResultInfo(bestLevel, language);

  // ─── INSTRUCCIONES ──────────────────────────────────────────────────────────
  if (phase === 'instructions') {
    return (
      <div className="vision-test-root min-h-screen bg-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
            <ArrowLeft className="w-4 h-4" /> {language === 'es' ? 'Volver' : 'Back'}
          </button>

          {/* Banner navegador no soportado — siempre visible si voz no disponible */}
          {!voiceAvailable && (
            <div className="bg-orange-50 border border-orange-300 rounded-xl p-4 mb-5 flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-orange-800">{ui.operaTitle}</p>
                <p className="text-xs text-orange-700 mt-1">{ui.operaDetail}</p>
                <button
                  onClick={() => { navigator.clipboard?.writeText(window.location.href).catch(() => {}); }}
                  className="mt-2 text-xs bg-orange-200 hover:bg-orange-300 text-orange-900 px-3 py-1 rounded-lg transition font-semibold"
                >
                  {ui.copyUrl}
                </button>
              </div>
            </div>
          )}

          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Eye className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-1">{ui.title}</h1>
            <p className="text-gray-400 text-sm">{ui.subtitle}</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-sm text-amber-800">
            ⚠️ {ui.warning}
          </div>

          {/* Demo animada según modo de entrada */}
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-4 mb-5">
            <p className="text-xs text-center text-indigo-400 uppercase font-semibold mb-2 tracking-wider">
              {language === 'es' ? 'Así se realiza la prueba' : 'How to take the test'}
            </p>
            {voiceMode ? <VoiceDemoAnim /> : <KeyboardDemoAnim />}
          </div>

          {/* Instrucciones de uso */}
          <div className="space-y-2 mb-5 text-sm text-gray-700">
            <p className="flex gap-2"><span className="font-bold text-indigo-600">1.</span> {ui.step1}</p>
            {voiceMode ? (
              <>
                <p className="flex gap-2"><span className="font-bold text-indigo-600">2.</span> {ui.step2voice}</p>
                <p className="flex gap-2"><span className="font-bold text-indigo-600">3.</span> {ui.step3voice}</p>
                <p className="flex gap-2"><span className="font-bold text-indigo-600">4.</span> {ui.step4voice}</p>
              </>
            ) : (
              <>
                <p className="flex gap-2"><span className="font-bold text-indigo-600">2.</span> {ui.step2keyboard}</p>
                <p className="flex gap-2"><span className="font-bold text-indigo-600">3.</span> {ui.step3keyboard}</p>
              </>
            )}
          </div>

          {/* Modo de entrada */}
          <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-3">
            <p className="text-sm font-semibold text-gray-700">{ui.inputModeLabel}</p>
            <div className="flex gap-2">
              <button onClick={() => setVoiceMode(true)} disabled={!voiceAvailable}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 text-sm font-semibold transition
                  ${voiceMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-600 border-indigo-300 hover:border-indigo-600'}
                  ${!voiceAvailable ? 'opacity-40 cursor-not-allowed' : ''}`}>
                <Mic className="w-4 h-4" /> {ui.voiceBtn} {!voiceAvailable && ui.notAvailable}
              </button>
              <button onClick={() => setVoiceMode(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 text-sm font-semibold transition
                  ${!voiceMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-600 border-indigo-300 hover:border-indigo-600'}`}>
                <Keyboard className="w-4 h-4" /> {ui.keyboardBtn}
              </button>
            </div>

          </div>

          {/* Distancia */}
          <div className="mb-6">
            <p className="text-sm font-semibold text-gray-700 mb-2">{ui.distanceLabel}</p>
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

          <button
            onClick={() => {
              if (voiceMode && voiceAvailable) {
                navigator.mediaDevices?.getUserMedia({ audio: true })
                  .then(stream => { stream.getTracks().forEach(t => t.stop()); setPhase('test'); })
                  .catch(() => setPhase('test'));
              } else {
                setPhase('test');
              }
            }}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition">
            {ui.startBtn}
          </button>
        </div>
      </div>
    );
  }

  // ─── PRUEBA ─────────────────────────────────────────────────────────────────
  if (phase === 'test') {
    const row       = testRows[currentRow];
    const letters   = row.label.split(' ');
    const totalLetters = letters.length;
    const progress  = (currentRow / testRows.length) * 100;
    const listening = voiceStatus === 'listening';

    return (
      <>
        <style>{`
          @keyframes soundBar {
            from { transform: scaleY(0.35); opacity: 0.7; }
            to   { transform: scaleY(1.0);  opacity: 1;   }
          }
        `}</style>
        {/* ── Modal confirmación salir ── */}
        {showExitConfirm && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
              <Home className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-gray-800 mb-2">
                {language === 'es' ? '¿Salir de la prueba?' : 'Exit the test?'}
              </h3>
              <p className="text-sm text-gray-600 mb-5">
                {language === 'es'
                  ? 'Si sales ahora, perderás el progreso de la prueba actual.'
                  : 'If you exit now, your current test progress will be lost.'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition"
                >
                  {language === 'es' ? 'Continuar prueba' : 'Continue test'}
                </button>
                <button
                  onClick={() => { stopMic(); if ('speechSynthesis' in window) window.speechSynthesis.cancel(); onBack(); }}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition"
                >
                  {language === 'es' ? 'Sí, salir' : 'Yes, exit'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="vision-test-root min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">

          {/* Banner navegador no soportado (durante test) */}
          {!voiceAvailable && (
            <div className="w-full max-w-2xl mb-3 bg-orange-900/80 border border-orange-500/50 rounded-xl px-4 py-2 flex items-center gap-3">
              <span className="text-lg">⚠️</span>
              <p className="text-xs text-orange-200 flex-1">{ui.operaDetail}</p>
              <button onClick={() => navigator.clipboard?.writeText(window.location.href).catch(() => {})}
                className="text-xs bg-orange-600 hover:bg-orange-500 text-white px-2 py-1 rounded-lg transition whitespace-nowrap">
                {ui.copyUrl}
              </button>
            </div>
          )}

          {/* Header */}
          <div className="w-full max-w-2xl mb-4 flex items-end gap-4">
            <button onClick={() => setShowExitConfirm(true)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-400">
              <Home className="w-3.5 h-3.5" /> {ui.exitBtn}
            </button>
            <div className="flex-1">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{language === 'es' ? 'Nivel' : 'Level'} {currentRow + 1} {ui.levelOf} {testRows.length}</span>
                <span>{ui.targetAcuity} <span className="font-bold text-indigo-400">{row.acuity}</span></span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <button onClick={() => { stopMic(); if ('speechSynthesis' in window) window.speechSynthesis.cancel(); setVoiceMode(v => !v); }}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-400">
              {voiceMode ? <><MicOff className="w-3.5 h-3.5" /> {ui.useKeyboard}</> : <><Mic className="w-3.5 h-3.5" /> {ui.useVoice}</>}
            </button>
          </div>

          {/* Carta Snellen — muestra todas las letras, resalta la actual */}
          <div
            className={`bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-10 mb-4 flex flex-col items-center transition-all duration-200
              ${shake ? 'ring-4 ring-red-500 scale-[0.98]' : ''}`}
            style={{ minHeight: '180px' }}
          >
            <div className="flex items-center justify-center gap-4 flex-wrap">
              {letters.map((letter, idx) => {
                const isDone    = idx < currentLetterIdx;
                const isCurrent = idx === currentLetterIdx;
                const isFuture  = idx > currentLetterIdx;
                const wasCorrect = rowLetterResults[idx];

                return (
                  <span
                    key={idx}
                    className={`font-mono font-black select-none transition-all duration-300 ${
                      isDone
                        ? wasCorrect
                          ? 'text-green-500'
                          : 'text-red-400'
                        : isCurrent
                        ? 'text-black'
                        : isFuture
                        ? 'text-gray-300'
                        : 'text-black'
                    }`}
                    style={{
                      fontSize: isCurrent
                        ? `${Math.round(row.fontSize * scale)}px`
                        : isDone
                        ? `${Math.round(row.fontSize * scale * 0.85)}px`
                        : `${Math.round(row.fontSize * scale * 0.7)}px`,
                      lineHeight: 1.1,
                      textDecoration: isCurrent ? 'underline' : 'none',
                      textDecorationColor: '#6366f1',
                      textUnderlineOffset: '6px',
                    }}
                  >
                    {isDone ? (wasCorrect ? '✓' : '✗') : letter}
                  </span>
                );
              })}
            </div>

            {/* Indicador letra actual / intento */}
            <div className="mt-4 flex items-center gap-3">
              {totalLetters > 1 && (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                  {ui.letterLabel} {currentLetterIdx + 1} / {totalLetters}
                </span>
              )}
              {letterAttempts > 0 && (
                <span className="text-xs text-orange-600 bg-orange-50 border border-orange-200 px-2 py-1 rounded-full font-semibold">
                  ⚠ {ui.retryOf(letterAttempts + 1)}
                </span>
              )}
            </div>
          </div>

          {/* ── Modo voz ── */}
          {voiceMode ? (
            <div className="w-full max-w-2xl flex flex-col items-center gap-3">
              {/* Botón micrófono */}
              <div className="relative flex items-center justify-center">
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
                      setInput(''); setHeardText(''); setHeardLetter('');
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
                    <><SoundWaveBars active={true} /><span className="text-xs font-semibold leading-none">{language === 'es' ? 'Habla' : 'Speak'}</span></>
                  ) : voiceStatus === 'heard' ? (
                    <><CheckCircle className="w-9 h-9" /><span className="text-xs font-semibold leading-none">OK</span></>
                  ) : voiceStatus === 'error' ? (
                    <><MicOff className="w-9 h-9" /><span className="text-xs font-semibold leading-none">{language === 'es' ? 'Error' : 'Error'}</span></>
                  ) : (
                    <><Mic className="w-9 h-9" /><span className="text-xs font-semibold leading-none">{language === 'es' ? 'Habla' : 'Speak'}</span></>
                  )}
                </button>
              </div>

              {/* Texto en tiempo real */}
              {listening && interimText && (
                <p className="text-indigo-300 font-mono text-xl tracking-widest animate-pulse">{interimText}</p>
              )}
              {listening && !interimText && (
                <p className="text-gray-400 text-sm">{ui.speakNow}</p>
              )}

              {/* Resultado capturado */}
              {voiceStatus === 'heard' && (
                <div className="text-center">
                  <p className="text-gray-400 text-xs mb-1">
                    {ui.iHeard} <span className="text-white font-mono">"{heardText}"</span>
                  </p>
                  <p className="text-indigo-300 font-mono font-bold text-4xl tracking-widest">{heardLetter}</p>
                  <div className="flex gap-3 mt-3">
                    <button onClick={() => { clearAutoConfirm(); setInput(''); setHeardText(''); setHeardLetter(''); startListening(); }}
                      className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm transition">
                      {ui.retryBtn}
                    </button>
                    <button onClick={() => submitLetter(heardLetter)}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition">
                      {ui.confirmBtn} {autoConfirmSecs !== null && `(${autoConfirmSecs}s)`}
                    </button>
                  </div>
                </div>
              )}

              {/* Idle: solo indicar que escucha */}
              {voiceStatus === 'idle' && (
                <p className="text-gray-500 text-xs text-center">
                  {language === 'es' ? 'Di la letra en voz alta…' : 'Say the letter out loud…'}
                </p>
              )}

              {/* Error */}
              {voiceStatus === 'error' && (
                <p className="text-red-400 text-sm text-center">{heardText || (language === 'es' ? 'Error de micrófono.' : 'Microphone error.')}</p>
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
                  onChange={e => setInput(e.target.value.toUpperCase().slice(0, 1))}
                  onKeyDown={e => { if (e.key === 'Enter' && input.trim()) submitLetter(input.trim()); }}
                  placeholder={ui.typeLetter}
                  maxLength={1}
                  className="flex-1 px-4 py-3 rounded-xl bg-gray-800 text-white text-2xl font-mono tracking-widest border-2 border-gray-600 focus:border-indigo-500 focus:outline-none placeholder-gray-500 text-center"
                  autoComplete="off" autoCapitalize="characters" spellCheck={false}
                />
                <button onClick={() => { if (input.trim()) submitLetter(input.trim()); }} disabled={!input.trim()}
                  className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold transition">
                  ↵
                </button>
              </div>
              <p className="text-gray-500 text-xs mt-2 text-center">{ui.noSpaces} · {distance} cm</p>
            </div>
          )}

          {/* Historial de filas completadas */}
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
  const urgencyIcon: Record<ResultInfo['urgency'], string> = {
    excellent: '🌟', good: '✅', fair: '👁️', poor: '⚠️', critical: '🚨',
  };

  return (
    <div className="vision-test-root min-h-screen bg-white flex items-center justify-center p-4">

      {/* ── Modal: Buscar oftalmólogo ── */}
      {showOptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden" style={{ maxHeight: '85vh' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <h3 className="font-bold text-gray-800 text-base">
                  {language === 'es' ? 'Oftalmólogos y optometristas cerca' : 'Ophthalmologists near you'}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {language === 'es' ? 'Resultados de Google Maps · Selecciona uno para ver detalles' : 'Google Maps results · Select one for details'}
                </p>
              </div>
              <button onClick={() => setShowOptModal(false)}
                className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 relative" style={{ minHeight: 380 }}>
              {gettingLocation
                ? <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-500">
                    <div className="w-8 h-8 border-4 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                    <p className="text-sm">{language === 'es' ? 'Obteniendo ubicación…' : 'Getting location…'}</p>
                  </div>
                : optMapUrl
                  ? <iframe
                      src={optMapUrl}
                      className="w-full h-full border-0"
                      style={{ minHeight: 380 }}
                      title="Google Maps – Oftalmólogos"
                      allowFullScreen
                      loading="lazy"
                    />
                  : null
              }
            </div>
            <div className="px-5 py-3 border-t flex items-center justify-between bg-gray-50">
              <p className="text-xs text-gray-400">
                {language === 'es' ? 'Powered by Google Maps' : 'Powered by Google Maps'}
              </p>
              <a
                href={`https://www.google.com/maps/search/oftalmólogo+optometrista`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-600 hover:underline font-semibold"
              >
                {language === 'es' ? 'Abrir en Google Maps ↗' : 'Open in Google Maps ↗'}
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8">
        {/* Header */}
        <div className="text-center mb-5">
          <div className="text-5xl mb-2">{urgencyIcon[resultInfo.urgency]}</div>
          <h2 className="text-2xl font-bold text-gray-800">{ui.testCompleted}</h2>
          {isSaving && <p className="text-xs text-gray-400 mt-1">{ui.saving}</p>}
        </div>

        {/* Score bar */}
        <div className="flex items-center gap-2 mb-5">
          {[1,2,3,4,5,6,7,8,9,10].map(lvl => (
            <div key={lvl}
              className={`h-3 flex-1 rounded-full transition-all ${
                lvl <= bestLevel ? resultInfo.badgeColor : 'bg-gray-100'
              }`}
            />
          ))}
          <span className={`text-xs font-bold ml-1 whitespace-nowrap ${resultInfo.color}`}>
            {resultInfo.acuityRange}
          </span>
        </div>

        {/* Categoría + descripción */}
        <div className={`${resultInfo.bg} border ${resultInfo.border} rounded-xl p-5 mb-4`}>
          <p className={`text-lg font-bold ${resultInfo.color} mb-1`}>{resultInfo.label}</p>
          <p className="text-sm text-gray-600 mb-3">{resultInfo.detail}</p>
          <p className="text-sm text-gray-700 leading-relaxed">{resultInfo.description}</p>
        </div>

        {/* Recomendaciones */}
        <div className="mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-2">
            {language === 'es' ? '💡 Recomendaciones para ti' : '💡 Recommendations for you'}
          </p>
          <ul className="space-y-1.5">
            {resultInfo.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-indigo-400 mt-0.5 flex-shrink-0">→</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Botón buscar oftalmólogo (solo si score bajo) */}
        {resultInfo.showOptometrist && (
          <button
            onClick={handleOpenOptModal}
            className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 mb-4 transition
              ${resultInfo.urgency === 'critical'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-yellow-100 hover:bg-yellow-200 text-yellow-900 border border-yellow-300'
              }`}
          >
            <Eye className="w-4 h-4" />
            {language === 'es' ? 'Buscar oftalmólogo cerca de mí' : 'Find an ophthalmologist near me'}
          </button>
        )}

        {/* Detalle por nivel (colapsable) */}
        <details className="mb-5 group">
          <summary className="text-sm font-semibold text-gray-500 cursor-pointer hover:text-gray-700 select-none list-none flex items-center gap-1">
            <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
            {ui.detailByLevel}
          </summary>
          <div className="space-y-1 max-h-48 overflow-y-auto pr-1 mt-2">
            {results.map((res, i) => (
              <div key={i} className="flex items-center justify-between text-sm px-3 py-1.5 rounded-lg bg-gray-50">
                <span className="text-gray-400 font-mono w-14">{res.acuity}</span>
                <span className="font-mono text-gray-600 tracking-widest text-xs flex-1 text-center">{testRows[i]?.label}</span>
                <span className={`ml-2 font-bold w-4 ${res.canRead ? 'text-green-600' : 'text-red-500'}`}>
                  {res.canRead ? '✓' : '✗'}
                </span>
              </div>
            ))}
          </div>
        </details>

        {/* Acciones */}
        <div className="flex gap-3">
          <button onClick={handleRestart}
            className="flex items-center justify-center gap-2 flex-1 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold transition">
            <RefreshCw className="w-4 h-4" /> {ui.repeatBtn}
          </button>
          <button onClick={onBack}
            className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition">
            {ui.backDashboard}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VisionTest;
