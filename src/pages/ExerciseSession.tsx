import { useState, useEffect, useRef, useCallback, type ReactElement } from 'react';
import { ArrowLeft, Play, Pause, RotateCcw, Volume2, VolumeX, SkipForward } from 'lucide-react';
import { sql, localISOString } from '../neonCliente';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../i18n';

// ─── Utilidad de audio via Web Audio API ─────────────────────────────────────
const playTone = (
  frequency: number,
  duration: number,
  volume = 0.25,
  type: OscillatorType = 'sine',
  delay = 0
) => {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.05);
  } catch { /* noop si no hay AudioContext */ }
};

const playComplete = () => {
  playTone(523, 0.15); playTone(659, 0.15, 0.25, 'sine', 0.18);
  playTone(784, 0.2, 0.25, 'sine', 0.36); playTone(1047, 0.35, 0.3, 'sine', 0.55);
};

// ─── Utilidad de voz (Text-to-Speech) ────────────────────────────────────────
const speakText = (text: string, lang: 'es' | 'en' = 'es', onEnd?: () => void) => {
  if (!('speechSynthesis' in window)) { onEnd?.(); return; }
  const utt = new SpeechSynthesisUtterance(text);
  const langCode = lang === 'es' ? 'es-MX' : 'en-US';
  utt.lang = langCode;
  utt.rate = 1.2;
  utt.pitch = 1.0;
  utt.volume = 1.0;
  const voces = window.speechSynthesis.getVoices();
  let voz: SpeechSynthesisVoice | undefined;
  if (lang === 'es') {
    voz = voces.find(v => v.lang === 'es-MX') ||
          voces.find(v => v.lang === 'es-US') ||
          voces.find(v => v.lang.startsWith('es'));
  } else {
    voz = voces.find(v => v.lang === 'en-US') ||
          voces.find(v => v.lang.startsWith('en'));
  }
  if (voz) utt.voice = voz;
  if (onEnd) {
    let fired = false;
    const done = () => { if (!fired) { fired = true; onEnd(); } };
    utt.onend = done;
    utt.onerror = done;
    setTimeout(done, 3000); // safety fallback
  }
  window.speechSynthesis.speak(utt);
};

// ─── Música ambiental relajante (generada con Web Audio API) ─────────────────
class AmbientMusic {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private oscillators: OscillatorNode[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isPlaying = false;

  start(volume = 0.06) {
    if (this.isPlaying) return;
    try {
      this.ctx = new AudioContext();
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
      this.gainNode.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + 2);
      this.gainNode.connect(this.ctx.destination);

      // Pad base: acordes suaves que cambian lentamente
      const baseFreqs = [174.61, 220, 261.63]; // F3, A3, C4 (F major)
      baseFreqs.forEach(freq => {
        const osc = this.ctx!.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const oscGain = this.ctx!.createGain();
        oscGain.gain.value = 0.3;
        osc.connect(oscGain);
        oscGain.connect(this.gainNode!);
        osc.start();
        this.oscillators.push(osc);
      });

      // Melodía suave: notas aleatorias pentatónicas cada 4 segundos
      const pentatonic = [261.63, 293.66, 329.63, 392, 440, 523.25]; // C D E G A C5
      this.intervalId = setInterval(() => {
        if (!this.ctx || !this.gainNode) return;
        const freq = pentatonic[Math.floor(Math.random() * pentatonic.length)];
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const noteGain = this.ctx.createGain();
        noteGain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        noteGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 3.5);
        osc.connect(noteGain);
        noteGain.connect(this.gainNode);
        osc.start();
        osc.stop(this.ctx.currentTime + 4);
      }, 4000);

      this.isPlaying = true;
    } catch { /* noop */ }
  }

  stop() {
    if (!this.isPlaying) return;
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1);
    }
    setTimeout(() => {
      this.oscillators.forEach(o => { try { o.stop(); } catch {/**/} });
      this.oscillators = [];
      if (this.ctx) { try { this.ctx.close(); } catch {/**/} }
      this.ctx = null;
      this.gainNode = null;
    }, 1200);
    this.isPlaying = false;
  }
}

const ambientMusic = new AmbientMusic();

// ─── Animación: Palming ───────────────────────────────────────────────────────
const PalmingTextContent = () => {
  const { t } = useLanguage();
  return <text x="100" y="148" textAnchor="middle" fontSize="11" fill="#6b7280">{t('exerciseSession', 'animPalmingText')}</text>;
};

const PalmingAnimation = () => (
  <svg viewBox="0 0 200 160" className="w-full max-w-xs mx-auto" aria-label="Animación de palming">
    <defs>
      <radialGradient id="warmGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#f97316" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
      </radialGradient>
    </defs>
    {/* Calor irradiando */}
    <ellipse cx="100" cy="80" rx="55" ry="45" fill="url(#warmGlow)">
      <animate attributeName="rx" values="50;60;50" dur="2s" repeatCount="indefinite" />
      <animate attributeName="ry" values="40;52;40" dur="2s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
    </ellipse>
    {/* Palma izquierda */}
    <g>
      <rect x="28" y="58" width="42" height="52" rx="10" fill="#f9a8d4" stroke="#ec4899" strokeWidth="1.5" />
      <rect x="30" y="48" width="8" height="22" rx="4" fill="#f9a8d4" stroke="#ec4899" strokeWidth="1.5" />
      <rect x="41" y="44" width="8" height="26" rx="4" fill="#f9a8d4" stroke="#ec4899" strokeWidth="1.5" />
      <rect x="52" y="46" width="8" height="24" rx="4" fill="#f9a8d4" stroke="#ec4899" strokeWidth="1.5" />
      <rect x="63" y="50" width="7" height="20" rx="4" fill="#f9a8d4" stroke="#ec4899" strokeWidth="1.5" />
      <animateTransform attributeName="transform" type="translate"
        values="0,0; 0,-4; 0,0" dur="2s" repeatCount="indefinite" />
    </g>
    {/* Palma derecha (espejo) */}
    <g>
      <rect x="130" y="58" width="42" height="52" rx="10" fill="#f9a8d4" stroke="#ec4899" strokeWidth="1.5" />
      <rect x="162" y="48" width="8" height="22" rx="4" fill="#f9a8d4" stroke="#ec4899" strokeWidth="1.5" />
      <rect x="151" y="44" width="8" height="26" rx="4" fill="#f9a8d4" stroke="#ec4899" strokeWidth="1.5" />
      <rect x="140" y="46" width="8" height="24" rx="4" fill="#f9a8d4" stroke="#ec4899" strokeWidth="1.5" />
      <rect x="130" y="50" width="7" height="20" rx="4" fill="#f9a8d4" stroke="#ec4899" strokeWidth="1.5" />
      <animateTransform attributeName="transform" type="translate"
        values="0,0; 0,-4; 0,0" dur="2s" repeatCount="indefinite" />
    </g>
    {/* Ojos cubiertos */}
    <ellipse cx="100" cy="82" rx="22" ry="14" fill="#1e1b4b" opacity="0.85" />
    <PalmingTextContent />
  </svg>
);

// ─── Animación: Enfoque cercano-lejano ───────────────────────────────────────
const FocusDistantLabel = () => {
  const { t } = useLanguage();
  return <text x="101" y="62" textAnchor="middle" fontSize="9" fill="#6b7280">{t('exerciseSession', 'animFocusFar')}</text>;
};

const FocusNearLabel = () => {
  const { t } = useLanguage();
  return <text x="103" y="148" textAnchor="middle" fontSize="9" fill="#6b7280">{t('exerciseSession', 'animFocusNear')}</text>;
};

const FocusAnimation = () => (
  <svg viewBox="0 0 220 160" className="w-full max-w-xs mx-auto" aria-label="Animación enfoque cercano-lejano">
    {/* Objeto LEJANO — árbol */}
    <g>
      <rect x="98" y="30" width="6" height="22" fill="#92400e" />
      <circle cx="101" cy="26" r="14" fill="#16a34a" />
      <animate attributeName="opacity" values="0.35;1;0.35" dur="4s" repeatCount="indefinite" begin="2s" />
    </g>
    <FocusDistantLabel />

    {/* Pulgar CERCANO */}
    <g>
      <rect x="96" y="100" width="14" height="36" rx="7" fill="#fcd34d" stroke="#f59e0b" strokeWidth="1.5" />
      <ellipse cx="103" cy="98" rx="8" ry="10" fill="#fcd34d" stroke="#f59e0b" strokeWidth="1.5" />
      <animate attributeName="opacity" values="1;0.35;1" dur="4s" repeatCount="indefinite" begin="2s" />
    </g>
    <FocusNearLabel />

    {/* Ojo que mira arriba/abajo */}
    <g transform="translate(168, 75)">
      <ellipse cx="0" cy="0" rx="18" ry="12" fill="white" stroke="#94a3b8" strokeWidth="1.5" />
      <circle cx="0" cy="0" r="7" fill="#3b82f6">
        <animate attributeName="cy" values="-3;3;-3" dur="4s" repeatCount="indefinite" begin="2s" />
      </circle>
      <circle cx="2" cy="-2" r="2.5" fill="#1e3a8a">
        <animate attributeName="cy" values="-5;1;-5" dur="4s" repeatCount="indefinite" begin="2s" />
      </circle>
      <circle cx="3" cy="-3" r="1" fill="white">
        <animate attributeName="cy" values="-6;0;-6" dur="4s" repeatCount="indefinite" begin="2s" />
      </circle>
    </g>

    {/* Línea indicadora */}
    <line x1="148" y1="80" x2="120" y2="80" stroke="#6366f1" strokeWidth="1.5">
      <animate attributeName="x2" values="120;106;120" dur="4s" repeatCount="indefinite" begin="2s" />
      <animate attributeName="y2" values="80;130;80" dur="4s" repeatCount="indefinite" begin="2s" />
    </line>
  </svg>
);

// ─── Animación: 20-20-20 ─────────────────────────────────────────────────────
const Rule202020TextContent = () => {
  const { t } = useLanguage();
  return <text x="100" y="150" textAnchor="middle" fontSize="10" fill="#6b7280">{t('exerciseSession', 'animRule202020')}</text>;
};

const Rule202020Animation = () => (
  <svg viewBox="0 0 200 160" className="w-full max-w-xs mx-auto" aria-label="Animación regla 20-20-20">
    {/* Monitor */}
    <rect x="10" y="20" width="70" height="50" rx="6" fill="#1e293b" stroke="#475569" strokeWidth="2" />
    <rect x="15" y="25" width="60" height="38" rx="3" fill="#0f172a" />
    <rect x="19" y="30" width="40" height="3" rx="1" fill="#38bdf8" opacity="0.7" />
    <rect x="19" y="37" width="30" height="3" rx="1" fill="#38bdf8" opacity="0.5" />
    <rect x="19" y="44" width="35" height="3" rx="1" fill="#38bdf8" opacity="0.5" />
    <rect x="38" y="74" width="14" height="6" rx="2" fill="#475569" />
    <rect x="25" y="80" width="40" height="4" rx="2" fill="#475569" />

    {/* Ventana lejana */}
    <rect x="138" y="20" width="50" height="55" rx="4" fill="#bae6fd" stroke="#7dd3fc" strokeWidth="1.5" />
    <line x1="163" y1="20" x2="163" y2="75" stroke="#7dd3fc" strokeWidth="1" />
    <line x1="138" y1="47" x2="188" y2="47" stroke="#7dd3fc" strokeWidth="1" />
    <circle cx="158" cy="35" r="8" fill="#fde68a" />
    <ellipse cx="175" cy="33" rx="7" ry="4" fill="white" opacity="0.9" />
    <ellipse cx="180" cy="31" rx="5" ry="3.5" fill="white" opacity="0.9" />
    <rect x="138" y="62" width="50" height="13" rx="2" fill="#86efac" />

    {/* Ojo con parpadeo */}
    <g transform="translate(97, 72)">
      <ellipse cx="0" cy="0" rx="16" ry="11" fill="white" stroke="#94a3b8" strokeWidth="1.5" />
      <circle cx="0" cy="0" r="6" fill="#3b82f6">
        <animate attributeName="r" values="6;0;6" dur="3s" repeatCount="indefinite" keyTimes="0;0.9;1" />
      </circle>
      <circle cx="2" cy="-2" r="2" fill="#1e3a8a">
        <animate attributeName="r" values="2;0;2" dur="3s" repeatCount="indefinite" keyTimes="0;0.9;1" />
      </circle>
    </g>

    {/* Flecha */}
    <line x1="83" y1="72" x2="136" y2="50" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="4 3">
      <animate attributeName="opacity" values="0.3;1;0.3" dur="3s" repeatCount="indefinite" />
    </line>

    <Rule202020TextContent />
  </svg>
);

// ─── Animación: Círculos oculares ────────────────────────────────────────────
const CirclesTextContent = () => {
  const { t } = useLanguage();
  return <text x="100" y="172" textAnchor="middle" fontSize="10" fill="#6b7280">{t('exerciseSession', 'animCircles')}</text>;
};

const CirclesAnimation = () => (
  <svg viewBox="0 0 200 180" className="w-full max-w-xs mx-auto" aria-label="Animación círculos oculares">
    {/* Cara estilizada */}
    <ellipse cx="100" cy="90" rx="60" ry="70" fill="#fef3c7" stroke="#fbbf24" strokeWidth="1.5" />
    <path d="M68 58 Q80 52 92 58" stroke="#92400e" strokeWidth="2" fill="none" strokeLinecap="round" />
    <path d="M108 58 Q120 52 132 58" stroke="#92400e" strokeWidth="2" fill="none" strokeLinecap="round" />
    <path d="M84 128 Q100 140 116 128" stroke="#92400e" strokeWidth="2" fill="none" strokeLinecap="round" />

    {/* Ojo izquierdo */}
    <ellipse cx="78" cy="88" rx="16" ry="11" fill="white" stroke="#94a3b8" strokeWidth="1.5" />
    <circle r="5" fill="#1e3a8a">
      <animateMotion dur="2.8s" repeatCount="indefinite"
        path="M78,88 m-6,0 a6,6 0 1,1 12,0 a6,6 0 1,1 -12,0" />
    </circle>
    <circle r="1.5" fill="white">
      <animateMotion dur="2.8s" repeatCount="indefinite"
        path="M78,88 m-6,0 a6,6 0 1,1 12,0 a6,6 0 1,1 -12,0" />
    </circle>
    <ellipse cx="78" cy="88" rx="7" ry="7" fill="none" stroke="#6366f1" strokeWidth="1"
      strokeDasharray="3 3" opacity="0.5" />

    {/* Ojo derecho */}
    <ellipse cx="122" cy="88" rx="16" ry="11" fill="white" stroke="#94a3b8" strokeWidth="1.5" />
    <circle r="5" fill="#1e3a8a">
      <animateMotion dur="2.8s" repeatCount="indefinite"
        path="M122,88 m-6,0 a6,6 0 1,1 12,0 a6,6 0 1,1 -12,0" />
    </circle>
    <circle r="1.5" fill="white">
      <animateMotion dur="2.8s" repeatCount="indefinite"
        path="M122,88 m-6,0 a6,6 0 1,1 12,0 a6,6 0 1,1 -12,0" />
    </circle>
    <ellipse cx="122" cy="88" rx="7" ry="7" fill="none" stroke="#6366f1" strokeWidth="1"
      strokeDasharray="3 3" opacity="0.5" />

    <CirclesTextContent />
  </svg>
);

// ─── Animación: Simulación cerca/lejos ───────────────────────────────────────
const NearFarLabels = () => {
  const { t } = useLanguage();
  return (
    <>
      <text x="30" y="170" fontSize="9" fill="#1e40af" opacity="0.8">{t('exerciseSession', 'animNearFarFar')}</text>
      <text x="162" y="170" fontSize="9" fill="#1e40af" opacity="0.8">{t('exerciseSession', 'animNearFarNear')}</text>
      <text x="110" y="170" textAnchor="middle" fontSize="9" fill="#6b7280">{t('exerciseSession', 'animNearFarText')}</text>
    </>
  );
};

const NearFarSimulation = () => (
  <svg viewBox="0 0 220 180" className="w-full max-w-xs mx-auto" aria-label="Simulación objeto cerca y lejos">
    <defs>
      <radialGradient id="depthGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#e0f2fe" />
        <stop offset="100%" stopColor="#bfdbfe" />
      </radialGradient>
    </defs>
    <rect width="220" height="180" fill="url(#depthGrad)" rx="12" />
    {/* Perspectiva */}
    <line x1="110" y1="90" x2="0" y2="180" stroke="#93c5fd" strokeWidth="0.8" opacity="0.5" />
    <line x1="110" y1="90" x2="220" y2="180" stroke="#93c5fd" strokeWidth="0.8" opacity="0.5" />
    <line x1="110" y1="90" x2="0" y2="0" stroke="#93c5fd" strokeWidth="0.8" opacity="0.5" />
    <line x1="110" y1="90" x2="220" y2="0" stroke="#93c5fd" strokeWidth="0.8" opacity="0.5" />

    {/* Letra E que se acerca y aleja */}
    <text x="110" y="105" textAnchor="middle" fontFamily="serif" fontWeight="bold" fill="#1e3a8a">
      <animate attributeName="font-size" values="12;52;12" dur="4s" repeatCount="indefinite"
        calcMode="spline" keySplines="0.4 0 0.6 1; 0.4 0 0.6 1" />
      <animate attributeName="opacity" values="0.4;1;0.4" dur="4s" repeatCount="indefinite" />
      E
    </text>

    {/* Anillo de desenfoque */}
    <circle cx="110" cy="90" r="5" fill="none" stroke="#6366f1" strokeWidth="1.5" opacity="0.4">
      <animate attributeName="r" values="5;38;5" dur="4s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.6;0;0.6" dur="4s" repeatCount="indefinite" />
    </circle>

    <NearFarLabels />
  </svg>
);

// ─── Datos de ejercicios ──────────────────────────────────────────────────────
type ExerciseDef = {
  titleKey: string;
  defaultDuration: number;
  minDuration?: number;
  maxDuration?: number;
  stepsKey: string;
  AnimationComponent: () => ReactElement;
};

const exerciseData: Record<string, ExerciseDef> = {
  palming: {
    titleKey: 'exercises.palming',
    defaultDuration: 180,
    minDuration: 60,
    maxDuration: 300,
    stepsKey: 'exerciseSession.palmingSteps',
    AnimationComponent: PalmingAnimation,
  },
  focus: {
    titleKey: 'exercises.focus',
    defaultDuration: 300,
    minDuration: 60,
    maxDuration: 300,
    stepsKey: 'exerciseSession.focusSteps',
    AnimationComponent: FocusAnimation,
  },
  '20-20-20': {
    titleKey: 'exercises.rule202020',
    defaultDuration: 20,
    stepsKey: 'exerciseSession.rule202020Steps',
    AnimationComponent: Rule202020Animation,
  },
  circles: {
    titleKey: 'exercises.circles',
    defaultDuration: 240,
    minDuration: 60,
    maxDuration: 300,
    stepsKey: 'exerciseSession.circlesSteps',
    AnimationComponent: CirclesAnimation,
  },
  'near-far': {
    titleKey: 'exercises.nearFar',
    defaultDuration: 180,
    minDuration: 60,
    maxDuration: 300,
    stepsKey: 'exerciseSession.nearFarSteps',
    AnimationComponent: NearFarSimulation,
  },
};

// ─── Componente principal ─────────────────────────────────────────────────────
interface ExerciseSessionProps {
  exerciseId: string;
  onBack: () => void;
  onComplete?: () => void;   // Avanza a siguiente en cola (o vuelve al dashboard)
  queueRemaining?: number;   // Cuántos ejercicios faltan en la rutina
}

const ExerciseSession = ({ exerciseId, onBack, onComplete, queueRemaining = 0 }: ExerciseSessionProps) => {
  const { user } = useUser();
  const { t, tArray, lang } = useLanguage();

  // Ejercicio actual y animación asociada
  const currentExercise = exerciseData[exerciseId] ?? exerciseData['palming'];
  const { AnimationComponent } = currentExercise;

  // El tiempo inicial se iguala desde el principio a la duración del ejercicio
  // para evitar que el timer “salte” en el primer render.
  const [selectedDuration, setSelectedDuration] = useState(currentExercise.defaultDuration);
  const [timeLeft, setTimeLeft]     = useState(currentExercise.defaultDuration);
  const [isRunning, setIsRunning]   = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isSaving, setIsSaving]     = useState(false);
  const [muted, setMuted]           = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);

  // Ref para silencio — disponible dentro del intervalo sin stale closure
  const mutedRef     = useRef(muted);
  const timeLeftRef  = useRef(timeLeft);
  mutedRef.current   = muted;
  timeLeftRef.current = timeLeft;

  const speakIfUnmuted = useCallback((text: string, spkLang: 'es' | 'en' = 'es', onEnd?: () => void) => {
    if (!mutedRef.current) speakText(text, spkLang, onEnd);
    else onEnd?.();
  }, []);

  const playIfUnmuted = useCallback((fn: () => void) => {
    if (!mutedRef.current) fn();
  }, []);

  // Prevent double execution
  const isCountingDownRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSpokenCountdownRef = useRef<number | null>(null);
  const completionSpokenRef = useRef(false);

  useEffect(() => {
    setSelectedDuration(currentExercise.defaultDuration);
    setTimeLeft(currentExercise.defaultDuration);
    setIsRunning(false);
    setIsComplete(false);
    setShowSkipConfirm(false);
    lastSpokenCountdownRef.current = null;
    completionSpokenRef.current = false;
    isCountingDownRef.current = false;
    // Cancel any ongoing speech & music
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    ambientMusic.stop();
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, [exerciseId, currentExercise.defaultDuration]);

  // ── Quartile milestones pre-computed ──────────────────────────────────────
  const milestones = useRef(new Set<number>());
  useEffect(() => {
    const d = selectedDuration;
    const m = new Set<number>();
    // 25%, 50%, 75% marks (as seconds remaining)
    if (d > 20) {
      m.add(Math.floor(d * 0.75)); // 25% elapsed = 75% remaining
      m.add(Math.floor(d * 0.50)); // 50% elapsed = 50% remaining (halfway)
      m.add(Math.floor(d * 0.25)); // 75% elapsed = 25% remaining
    }
    milestones.current = m;
  }, [selectedDuration]);

  useEffect(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }

    if (isRunning && timeLeft > 0) {
      // Start ambient music
      if (!mutedRef.current) ambientMusic.start(0.06);

      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          const next = prev - 1;
          const d    = selectedDuration;
          const elapsed = d - next;

          // ── Voice announcements ──────────────────────────────────────────
          // Every full minute elapsed
          if (next > 0 && elapsed > 0 && elapsed % 60 === 0) {
            const mins = Math.floor(elapsed / 60);
            const minStr = lang === 'es' ? 'minuto' : 'minute';
            const minPluralStr = lang === 'es' ? 'minutos' : 'minutes';
            speakIfUnmuted(`${mins} ${mins > 1 ? minPluralStr : minStr}`, lang);
          }

          // Quartile milestones
          if (milestones.current.has(next) && next > 5) {
            const pct = Math.round(((d - next) / d) * 100);
            if (pct === 25) speakIfUnmuted(t('exerciseSession', 'voice25'), lang);
            else if (pct === 50) speakIfUnmuted(t('exerciseSession', 'voice50'), lang);
            else if (pct === 75) speakIfUnmuted(t('exerciseSession', 'voice75'), lang);
          }

          // 30 seconds remaining (only for exercises > 60s)
          if (next === 30 && d > 60) {
            speakIfUnmuted(t('exerciseSession', 'voice30sec'), lang);
          }

          // Last 5 seconds countdown (evitar repetir el mismo número dos veces)
          if (next <= 5 && next > 0) {
            if (lastSpokenCountdownRef.current !== next) {
              lastSpokenCountdownRef.current = next;
              speakIfUnmuted(`${next}`, lang);
            }
          }

          if (next <= 0) {
            setIsRunning(false);
            ambientMusic.stop();
            if (!completionSpokenRef.current) {
              completionSpokenRef.current = true;
              speakIfUnmuted(t('exerciseSession', 'voiceComplete'), lang);
              playIfUnmuted(playComplete);
              saveExerciseToDatabase('completed');
            }
            return 0;
          }
          return next;
        });
      }, 1000);
    } else {
      // Paused or not running
      ambientMusic.stop();
    }
    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, selectedDuration, lang]);

  const saveExerciseToDatabase = async (status: 'completed' | 'incomplete') => {
    setIsSaving(true);
    try {
      const elapsed = selectedDuration - timeLeftRef.current;
      const exerciseTitleKey = currentExercise.titleKey.split('.')[1];
      await sql`
        INSERT INTO historial_ejercicios (user_id, tipo_ejercicio, duracion, status, created_at)
        VALUES (${user?.id}, ${exerciseTitleKey}, ${elapsed}, ${status}, ${localISOString()})
      `;
      if (status === 'completed') setIsComplete(true);
    } catch (error) {
      console.error('Error al guardar ejercicio:', error);
      if (status === 'completed') setIsComplete(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    cancelCountdown();
    ambientMusic.stop();
    if (isRunning || (timeLeft > 0 && timeLeft < currentExercise.defaultDuration)) {
      saveExerciseToDatabase('incomplete');
    }
    onBack();
  };

  // Skip en modo rutina: guarda incompleto y avanza
  const handleSkipConfirmed = async () => {
    setShowSkipConfirm(false);
    setIsRunning(false);
    cancelCountdown();
    ambientMusic.stop();
    await saveExerciseToDatabase('incomplete');
    if (onComplete) onComplete();
    else onBack();
  };

  // Arrancar temporizador con cuenta regresiva por voz
  const startCountdownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [countdownNum, setCountdownNum] = useState<number | null>(null);

  const cancelCountdown = () => {
    if (startCountdownRef.current) {
      clearTimeout(startCountdownRef.current);
      startCountdownRef.current = null;
    }
    isCountingDownRef.current = false;
    setCountdownNum(null);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  };

  const handleToggleRun = () => {
    // If counting down, cancel it
    if (isCountingDownRef.current) {
      cancelCountdown();
      return;
    }

    if (isRunning) {
      // Pausar
      setIsRunning(false);
      cancelCountdown();
      ambientMusic.stop();
      return;
    }

    // Cuenta regresiva por voz: "El ejercicio comienza en 3, 2, 1"
    if (!mutedRef.current && timeLeft === selectedDuration) {
      isCountingDownRef.current = true;
      // Decir "El ejercicio comienza en" y ESPERAR a que termine
      speakText(t('exerciseSession', 'voiceStartsIn'), lang, () => {
        if (!isCountingDownRef.current) return; // fue cancelado
        let count = 3;
        const tick = () => {
          if (!isCountingDownRef.current) return; // fue cancelado
          if (count > 0) {
            setCountdownNum(count);
            speakText(`${count}`, lang, () => {
              count--;
              if (isCountingDownRef.current) {
                startCountdownRef.current = setTimeout(tick, 300);
              }
            });
          } else {
            setCountdownNum(null);
            isCountingDownRef.current = false;
            setIsRunning(true);
          }
        };
        tick();
      });
    } else {
      // Resumir desde pausa — sin countdown
      setIsRunning(true);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleReset = () => {
    setTimeLeft(selectedDuration);
    setIsRunning(false);
    setIsComplete(false);
    setShowSkipConfirm(false);
    cancelCountdown();
    ambientMusic.stop();
    lastSpokenCountdownRef.current = null;
    completionSpokenRef.current = false;
  };

  const handleDurationSelect = (duration: number) => {
    setSelectedDuration(duration);
    setTimeLeft(duration);
    setIsRunning(false);
    cancelCountdown();
  };

  const hasStarted = timeLeft < selectedDuration;
  const rawProgress = ((selectedDuration - timeLeft) / selectedDuration) * 100;
  const progress = hasStarted ? Math.min(Math.max(rawProgress, 0), 100) : 0;

  // Show duration selector while exercise hasn't been started and isn't complete
  const showDurationSelector = !isRunning && !hasStarted && !isComplete && currentExercise.minDuration !== undefined;

  if (isComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8 text-center">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl text-white">✓</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">{t('exerciseSession', 'exerciseComplete')}</h2>
          <p className="text-gray-600 mb-2">
            {t('exerciseSession', 'completedSuccess')} "{t(currentExercise.titleKey.split('.')[0], currentExercise.titleKey.split('.')[1])}" {t('exerciseSession', 'completedSuccessSuffix')}
          </p>
          {isSaving ? (
            <p className="text-sm text-gray-500 mb-6">{t('exerciseSession', 'savingHistory')}</p>
          ) : (
            <p className="text-sm text-green-600 mb-6">✓ {t('exerciseSession', 'savedHistory')}</p>
          )}
          {queueRemaining > 0 && (
            <p className="text-sm text-indigo-600 font-medium mb-4">
              🏃 {t('exerciseSession', 'routineInProgress')} {queueRemaining} {queueRemaining > 1 ? t('exerciseSession', 'exercisesRemainingPlural') : t('exerciseSession', 'exercisesRemaining')} {t('exerciseSession', 'remaining')}
            </p>
          )}
          <div className="flex gap-4">
            <button
              onClick={handleReset}
              className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
            >
              {t('common', 'repeat')}
            </button>
            {onComplete ? (
              <button
                onClick={onComplete}
                className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
              >
                {queueRemaining > 0 ? t('exerciseSession', 'nextExercise') : t('exerciseSession', 'finishRoutine')}
              </button>
            ) : (
              <button
                onClick={onBack}
                className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
              >
                {t('common', 'finish')}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={handleBack} className="flex items-center gap-2 text-gray-700 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" /> {t('common', 'back')}
          </button>
          <div className="flex items-center gap-2">
            {/* Botón silencio */}
            <button
              onClick={() => setMuted(m => !m)}
              title={muted ? t('exerciseSession', 'unmute') : t('exerciseSession', 'mute')}
              className={`p-2 rounded-lg transition ${muted ? 'bg-gray-200 text-gray-500' : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'}`}
            >
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            {/* Botón saltar (solo en rutina) */}
            {(queueRemaining > 0 || onComplete) && (
              <button
                onClick={() => setShowSkipConfirm(true)}
                className="flex items-center gap-1.5 text-sm text-orange-600 hover:text-orange-800 bg-orange-50 hover:bg-orange-100 px-3 py-2 rounded-lg transition font-semibold"
              >
                <SkipForward className="w-4 h-4" />
                {t('exerciseSession', 'skip')}
              </button>
            )}
          </div>
        </div>

        {/* Modal de confirmación de skip */}
        {showSkipConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
              <SkipForward className="w-12 h-12 text-orange-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-gray-800 mb-2">{t('exerciseSession', 'skipConfirmTitle')}</h3>
              <p className="text-sm text-gray-600 mb-5">
                "{t(currentExercise.titleKey.split('.')[0], currentExercise.titleKey.split('.')[1])}" {t('exerciseSession', 'skipConfirmMsg')} <span className="font-semibold text-orange-600">incompleto</span>.
                {queueRemaining > 0 && ` ${t('exerciseSession', 'remainingInRoutine').replace('en la rutina.', '')} ${queueRemaining} ${queueRemaining > 1 ? t('exerciseSession', 'exercisesRemainingPlural') : t('exerciseSession', 'exercisesRemaining')} ${t('exerciseSession', 'remainingInRoutine').split('en la rutina')[0]}`}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSkipConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition"
                >
                  {t('exerciseSession', 'continueHere')}
                </button>
                <button
                  onClick={handleSkipConfirmed}
                  className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition"
                >
                  {t('exerciseSession', 'yesSkip')}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-1 text-center">
            {t(currentExercise.titleKey.split('.')[0], currentExercise.titleKey.split('.')[1])}
          </h1>
          <p className="text-gray-500 text-center mb-6 text-sm">
            {t('common', 'duration')}: {Math.floor(selectedDuration / 60)} {t('common', 'min')}
            {selectedDuration % 60 !== 0 ? ` ${selectedDuration % 60} ${t('common', 'sec')}` : ''}
          </p>

          {/* ── Duration Selector (solo si está disponible y no ha empezado) ── */}
          {showDurationSelector && currentExercise.minDuration !== undefined && currentExercise.maxDuration !== undefined && (
            <div className="mb-6 p-4 bg-indigo-50 rounded-lg border-2 border-indigo-200">
              <p className="text-sm font-semibold text-gray-800 mb-3 text-center">
                {t('exercises', 'selectDuration')}
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[60, 90, 120, 150, 180, 210, 240, 270, 300].map((duration) => {
                  const mins = Math.floor(duration / 60);
                  const secs = duration % 60;
                  const durationLabel = secs > 0 ? `${mins}.${secs}` : `${mins}`;
                  const isSelected = selectedDuration === duration;
                  return (
                    <button
                      key={duration}
                      onClick={() => handleDurationSelect(duration)}
                      className={`px-4 py-2 rounded-full font-medium transition ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-lg'
                          : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-indigo-400'
                      }`}
                    >
                      {durationLabel} {t('common', 'min')}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Animación visual ── */}
          <div className="mb-6 p-4 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-100">
            <p className="text-xs text-center text-indigo-400 mb-3 uppercase tracking-widest font-semibold">
              {t('exerciseSession', 'howToDo')}
            </p>
            <AnimationComponent />
          </div>

          {/* ── Timer circular ── */}
          <div className="mb-6">
            <div className="w-40 h-40 mx-auto relative flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="44" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="44"
                  fill="none"
                  stroke={timeLeft <= Math.min(30, Math.floor(selectedDuration * 0.25)) ? '#ef4444' : '#6366f1'}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 44}`}
                  strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress / 100)}`}
                  style={{ transition: hasStarted ? 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' : 'stroke 0.3s ease' }}
                />
              </svg>
              <span className={`text-4xl font-bold z-10 ${timeLeft <= Math.min(30, Math.floor(selectedDuration * 0.25)) ? 'text-red-500' : 'text-gray-800'}`}>
                {formatTime(timeLeft)}
              </span>
            </div>
            {timeLeft <= Math.min(30, Math.floor(selectedDuration * 0.25)) && timeLeft > 0 && isRunning && (
              <p className="text-center text-xs text-red-400 mt-2 font-medium">
                {t('exerciseSession', 'almostDone')}
              </p>
            )}
            {countdownNum !== null && !isRunning && (
              <p className="text-center text-2xl font-bold text-indigo-600 mt-2 animate-pulse">
                {countdownNum}
              </p>
            )}
          </div>

          {/* ── Controles ── */}
          <div className="flex justify-center gap-4 mb-8">
            <button
              onClick={handleToggleRun}
              className="bg-indigo-600 text-white p-4 rounded-full hover:bg-indigo-700 transition shadow-lg"
            >
              {isRunning ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8" />}
            </button>
            <button
              onClick={handleReset}
              className="bg-gray-200 text-gray-800 p-4 rounded-full hover:bg-gray-300 transition shadow-lg"
            >
              <RotateCcw className="w-8 h-8" />
            </button>
          </div>

          {/* ── Instrucciones ── */}
          <div className="bg-blue-50 rounded-xl p-6">
            <h3 className="font-semibold text-gray-800 mb-4 text-lg">{t('exerciseSession', 'stepsTitle')}</h3>
            <ol className="space-y-3">
              {tArray(currentExercise.stepsKey.split('.')[0], currentExercise.stepsKey.split('.')[1]).map((step: string, index: number) => (
                <li key={index} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </span>
                  <span className="text-gray-700">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExerciseSession;
