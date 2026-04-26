import { useState, useEffect, useRef, useCallback, type ReactElement } from 'react';
import { ArrowLeft, Play, Pause, RotateCcw, Volume2, VolumeX, SkipForward, Music2, X } from 'lucide-react';
import FatigaModal from '../components/FatigaModal';
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

// ─── Estilos de música ────────────────────────────────────────────────────────
export type MusicStyle = 'zen' | 'bosque' | 'oceano' | 'espacial' | 'clasico';

export const MUSIC_STYLES: { id: MusicStyle; emoji: string; nameEs: string; nameEn: string; descEs: string; descEn: string }[] = [
  { id: 'zen',      emoji: '🧘', nameEs: 'Zen',      nameEn: 'Zen',      descEs: 'Pad suave y pentatónica',   descEn: 'Soft pad & pentatonic' },
  { id: 'bosque',   emoji: '🌿', nameEs: 'Bosque',   nameEn: 'Forest',   descEs: 'Tonos graves y naturales',  descEn: 'Deep natural tones' },
  { id: 'oceano',   emoji: '🌊', nameEs: 'Océano',   nameEn: 'Ocean',    descEs: 'Pulsos suaves en oleadas',  descEn: 'Gentle wave pulses' },
  { id: 'espacial', emoji: '✨', nameEs: 'Espacial', nameEn: 'Space',    descEs: 'Tonos etéreos y cristalinos', descEn: 'Ethereal crystal tones' },
  { id: 'clasico',  emoji: '🎵', nameEs: 'Clásico',  nameEn: 'Classic',  descEs: 'Arpegio melódico ordenado', descEn: 'Ordered melodic arpeggio' },
];

// ─── Música ambiental (generada con Web Audio API, 5 estilos) ────────────────
// Volumen de música secundaria (≈25% del narrador TTS = 1.0). Antes: 0.55 → demasiado alto
// comparado con la voz. Ajustado para que la narración sea claramente prioritaria.
const MUSIC_VOLUME_DEFAULT = 0.22;

class AmbientMusic {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private oscillators: OscillatorNode[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isPlaying = false;

  // Exponer estado para que el componente pueda validar
  public get playing() { return this.isPlaying; }

  private makeCtx(volume: number) {
    this.ctx = new AudioContext();
    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = -18; compressor.knee.value = 10;
    compressor.ratio.value = 4; compressor.attack.value = 0.05; compressor.release.value = 0.3;
    compressor.connect(this.ctx.destination);
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
    this.gainNode.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + 2.5);
    this.gainNode.connect(compressor);
  }

  private addPad(freqs: number[], type: OscillatorType, gain: number) {
    freqs.forEach(freq => {
      const osc = this.ctx!.createOscillator();
      osc.type = type; osc.frequency.value = freq;
      const g = this.ctx!.createGain(); g.gain.value = gain;
      osc.connect(g); g.connect(this.gainNode!); osc.start();
      this.oscillators.push(osc);
    });
  }

  private addMelody(notes: number[], intervalMs: number, type: OscillatorType, noteGain: number, noteDur: number) {
    this.intervalId = setInterval(() => {
      if (!this.ctx || !this.gainNode) return;
      const freq = notes[Math.floor(Math.random() * notes.length)];
      const osc = this.ctx.createOscillator();
      osc.type = type; osc.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(noteGain, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + noteDur);
      osc.connect(g); g.connect(this.gainNode);
      osc.start(); osc.stop(this.ctx.currentTime + noteDur + 0.1);
    }, intervalMs);
  }

  start(volume = MUSIC_VOLUME_DEFAULT, style: MusicStyle = 'zen') {
    if (this.isPlaying) return;
    try {
      this.makeCtx(volume);

      // Nota: los valores de ganancia por nota se mantienen relativos al gainNode
      // principal (que ya se redujo a MUSIC_VOLUME_DEFAULT). Así la música queda
      // como secundaria respecto al TTS (narrador a 1.0).
      if (style === 'zen') {
        // Pad F mayor suave + melodía pentatónica
        this.addPad([174.61, 220, 261.63], 'triangle', 0.22);
        this.addMelody([261.63, 293.66, 329.63, 392, 440, 523.25], 3500, 'sine', 0.42, 3);

      } else if (style === 'bosque') {
        // Pad A menor grave + melodía lenta y profunda
        this.addPad([110, 130.81, 164.81], 'sine', 0.26);
        this.addMelody([196, 220, 246.94, 261.63, 293.66], 5000, 'triangle', 0.38, 4.5);

      } else if (style === 'oceano') {
        // Solo pulsos rítmicos tipo oleada (sin pad sostenido)
        const waveNotes = [261.63, 311.13, 349.23, 392];
        let idx = 0;
        this.intervalId = setInterval(() => {
          if (!this.ctx || !this.gainNode) return;
          const freq = waveNotes[idx % waveNotes.length]; idx++;
          const osc = this.ctx.createOscillator();
          osc.type = 'sine'; osc.frequency.value = freq;
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.001, this.ctx.currentTime);
          g.gain.linearRampToValueAtTime(0.45, this.ctx.currentTime + 1.2);
          g.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 2.8);
          osc.connect(g); g.connect(this.gainNode);
          osc.start(); osc.stop(this.ctx.currentTime + 3);
        }, 2800);

      } else if (style === 'espacial') {
        // Pad alto etéreo C5/E5/G5 + notas cristalinas agudas
        this.addPad([523.25, 659.25, 783.99], 'sine', 0.13);
        this.addMelody([783.99, 880, 1046.5, 1174.66, 1318.51], 4500, 'sine', 0.35, 5);

      } else if (style === 'clasico') {
        // Arpegio C mayor ordenado (C E G C5) cada 0.9 s
        const arpNotes = [261.63, 329.63, 392, 523.25, 392, 329.63];
        let arpIdx = 0;
        this.intervalId = setInterval(() => {
          if (!this.ctx || !this.gainNode) return;
          const freq = arpNotes[arpIdx % arpNotes.length]; arpIdx++;
          const osc = this.ctx.createOscillator();
          osc.type = 'triangle'; osc.frequency.value = freq;
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.38, this.ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.85);
          osc.connect(g); g.connect(this.gainNode);
          osc.start(); osc.stop(this.ctx.currentTime + 0.9);
        }, 900);
      }

      this.isPlaying = true;
    } catch { /* noop */ }
  }

  /** Baja el volumen antes de que el narrador hable (fade-down ~1s) */
  duckForSpeech() {
    if (!this.isPlaying || !this.gainNode || !this.ctx) return;
    try {
      this.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
      this.gainNode.gain.linearRampToValueAtTime(0.03, this.ctx.currentTime + 1.0);
    } catch { /* noop */ }
  }

  /** Restaura el volumen tras el narrador (fade-up ~2s) */
  restoreVolume() {
    if (!this.isPlaying || !this.gainNode || !this.ctx) return;
    try {
      this.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
      this.gainNode.gain.linearRampToValueAtTime(MUSIC_VOLUME_DEFAULT, this.ctx.currentTime + 2.0);
    } catch { /* noop */ }
  }

  // Detención inmediata: corta osciladores Y cierra el AudioContext para asegurar
  // que no queden instancias sonando (antes solo rampeaba volumen y dejaba ctx activo).
  stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false; // marcar primero para evitar reentradas
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
    // Corte duro del gain (evita cola audible tras silenciar)
    if (this.gainNode && this.ctx) {
      try {
        this.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
        this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
      } catch { /* noop */ }
    }
    // Parar todos los osciladores activos de inmediato
    this.oscillators.forEach(o => { try { o.stop(); } catch {/**/} });
    this.oscillators = [];
    // Cerrar el contexto (libera nodos pendientes)
    if (this.ctx) { try { this.ctx.close(); } catch {/**/} }
    this.ctx = null; this.gainNode = null;
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
  const [showFatiga, setShowFatiga] = useState(false);
  const [isSaving, setIsSaving]     = useState(false);
  const [muted, setMuted]           = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [musicStyle, setMusicStyle] = useState<MusicStyle>('zen');
  const [showMusicPicker, setShowMusicPicker] = useState(false);

  const musicStyleRef = useRef<MusicStyle>('zen');
  musicStyleRef.current = musicStyle;

  // Ref para silencio — disponible dentro del intervalo sin stale closure
  const mutedRef     = useRef(muted);
  const timeLeftRef  = useRef(timeLeft);
  mutedRef.current   = muted;
  timeLeftRef.current = timeLeft;

  const speakIfUnmuted = useCallback((text: string, spkLang: 'es' | 'en' = 'es', onEnd?: () => void) => {
    if (!mutedRef.current) {
      ambientMusic.duckForSpeech();
      speakText(text, spkLang, () => {
        ambientMusic.restoreVolume();
        onEnd?.();
      });
    } else {
      onEnd?.();
    }
  }, []);

  const playIfUnmuted = useCallback((fn: () => void) => {
    if (!mutedRef.current) fn();
  }, []);

  // Prevent double execution
  const isCountingDownRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSpokenCountdownRef = useRef<number | null>(null);
  const completionSpokenRef = useRef(false);

  // ── Estado de "retomar" ejercicio incompleto ──────────────────────────────
  // RESUME_TTL_MS: descarta estados de retomar demasiado viejos (p. ej. semanas).
  const RESUME_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const [resumePrompt, setResumePrompt] = useState<
    { originalDuration: number; timeLeft: number } | null
  >(null);

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

    // Detectar sesión incompleta previa para ofrecer "Continuar"
    try {
      const raw = localStorage.getItem(`therapheye_resume_${exerciseId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as { originalDuration: number; timeLeft: number; savedAt: number };
        const age = Date.now() - (parsed.savedAt || 0);
        if (
          parsed && typeof parsed.timeLeft === 'number' && parsed.timeLeft > 0 &&
          typeof parsed.originalDuration === 'number' && parsed.originalDuration > 0 &&
          parsed.timeLeft < parsed.originalDuration &&
          age < RESUME_TTL_MS
        ) {
          setResumePrompt({ originalDuration: parsed.originalDuration, timeLeft: parsed.timeLeft });
        } else {
          // Expirado o inválido: limpiar
          localStorage.removeItem(`therapheye_resume_${exerciseId}`);
        }
      }
    } catch { /* noop */ }
  }, [exerciseId, currentExercise.defaultDuration]);


  // ── Temporizador basado en timestamp (una sola fuente de verdad) ──────────
  // Antes: setInterval(() => prev - 1) acumulaba drift y ponía el audio/voz y el
  // contador fuera de sincronía (especialmente en los últimos 5 s).
  // Ahora: guardamos endTimestampRef = ahora + timeLeft*1000 al iniciar/resumir,
  // y en cada tick calculamos el nuevo `remaining` a partir de Date.now().
  // Las llamadas de voz se disparan cuando el contador visible cambia, por lo
  // que UI y TTS quedan perfectamente alineados.
  const endTimestampRef = useRef<number | null>(null);
  const lastAnnouncedSecondRef = useRef<number | null>(null);

  useEffect(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }

    if (isRunning && timeLeftRef.current > 0) {
      // Al (re)arrancar, anclamos el fin absoluto a partir del tiempo restante actual
      endTimestampRef.current = Date.now() + timeLeftRef.current * 1000;
      // Reset announcement guard al reanudar
      lastAnnouncedSecondRef.current = timeLeftRef.current;

      // Start ambient music
      if (!mutedRef.current) ambientMusic.start(MUSIC_VOLUME_DEFAULT, musicStyleRef.current);

      const tick = () => {
        if (endTimestampRef.current == null) return;
        const remainingMs = endTimestampRef.current - Date.now();
        // ceil para que en t=0.3s restante sigamos mostrando "1" hasta llegar a 0
        const remaining = Math.max(0, Math.ceil(remainingMs / 1000));
        const d = selectedDuration;

        // Actualizar UI (React evita re-render si el valor no cambió)
        setTimeLeft(remaining);

        // Disparar avisos SOLO cuando el segundo visible cambia.
        // Esto garantiza que la voz se sincronice con el cambio visual.
        if (lastAnnouncedSecondRef.current !== remaining) {
          lastAnnouncedSecondRef.current = remaining;

          // 1 minuto restante (solo ejercicios >= 90s)
          if (remaining === 60 && d >= 90) {
            speakIfUnmuted(t('exerciseSession', 'voice1min'), lang);
          }

          // Mitad del ejercicio (solo si > 60s y la mitad no coincide con el aviso de 1min)
          const halfwaySecond = Math.floor(d / 2);
          if (remaining === halfwaySecond && d > 60 && halfwaySecond > 60) {
            speakIfUnmuted(t('exerciseSession', 'voice50'), lang);
          }

          // Faltan 30 segundos (solo ejercicios > 60s)
          if (remaining === 30 && d > 60) {
            speakIfUnmuted(t('exerciseSession', 'voice30sec'), lang);
          }

          // Faltan 15 segundos / ya casi terminas (solo ejercicios > 20s)
          if (remaining === 15 && d > 20) {
            speakIfUnmuted(t('exerciseSession', 'voice15sec'), lang);
          }

          // Countdown final (5..1)
          if (remaining <= 5 && remaining > 0) {
            if (lastSpokenCountdownRef.current !== remaining) {
              lastSpokenCountdownRef.current = remaining;
              speakIfUnmuted(`${remaining}`, lang);
            }
          }
        }

        if (remaining <= 0) {
          if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
          endTimestampRef.current = null;
          setIsRunning(false);
          ambientMusic.stop();
          if (!completionSpokenRef.current) {
            completionSpokenRef.current = true;
            speakIfUnmuted(t('exerciseSession', 'voiceComplete'), lang);
            playIfUnmuted(playComplete);
            // Al completar, la duración guardada debe ser la total elegida (no d-1).
            saveExerciseToDatabase('completed', d);
          }
        }
      };

      // Resolución alta (250ms) para mayor precisión de la cuenta final
      intervalRef.current = setInterval(tick, 250);
    } else {
      // Pausado o sin correr
      endTimestampRef.current = null;
      ambientMusic.stop();
    }
    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, selectedDuration, lang]);

  // ── Reacción al toggle de silencio ─────────────────────────────────────────
  // Antes: al silenciar, la música seguía sonando (el useEffect del timer no
  // dependía de `muted`). Ahora detenemos inmediatamente música y voz al mutear
  // y la música se reanuda si se desmutea estando corriendo.
  useEffect(() => {
    if (muted) {
      ambientMusic.stop();
      if ('speechSynthesis' in window) {
        try { window.speechSynthesis.cancel(); } catch { /* noop */ }
      }
    } else if (isRunning && timeLeftRef.current > 0) {
      // Reanuda la música ambiental al desmutar si el ejercicio está en curso
      ambientMusic.start(MUSIC_VOLUME_DEFAULT, musicStyleRef.current);
    }
    // Solo reaccionamos a cambios de muted/isRunning (no a timeLeft cada segundo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted, isRunning]);

  // Storage key for resume state per exercise
  const resumeKey = (id: string) => `therapheye_resume_${id}`;

  // Persistimos estado para "retomar" cuando se queda incompleto.
  // Se limpia al completar correctamente.
  const saveResumeState = (exerciseId: string, originalDuration: number, timeLeftSnapshot: number) => {
    try {
      localStorage.setItem(resumeKey(exerciseId), JSON.stringify({
        originalDuration,
        timeLeft: Math.max(0, Math.floor(timeLeftSnapshot)),
        savedAt: Date.now(),
      }));
    } catch { /* noop */ }
  };

  const clearResumeState = (exerciseId: string) => {
    try { localStorage.removeItem(resumeKey(exerciseId)); } catch { /* noop */ }
  };

  // Ahora acepta `exactDuration` opcional. Para 'completed' pasamos selectedDuration
  // tal cual (así 1 min se guarda como 60, no 59).
  const saveExerciseToDatabase = async (
    status: 'completed' | 'incomplete',
    exactDuration?: number
  ) => {
    setIsSaving(true);
    try {
      const computedElapsed = exactDuration != null
        ? Math.max(0, Math.round(exactDuration))
        : Math.max(0, Math.round(selectedDuration - timeLeftRef.current));
      const exerciseTitleKey = currentExercise.titleKey.split('.')[1];
      await sql`
        INSERT INTO historial_ejercicios (user_id, tipo_ejercicio, duracion, status, created_at)
        VALUES (${user?.id}, ${exerciseTitleKey}, ${computedElapsed}, ${status}, ${localISOString()})
      `;
      // Gestionar estado de reanudación
      if (status === 'completed') {
        clearResumeState(exerciseId);
        setIsComplete(true);
        setShowFatiga(true);
        // Registrar para PresenceDetector y progreso del sidebar
        try { localStorage.setItem('therapheye_last_exercise', String(Date.now())); window.dispatchEvent(new Event('therapheye-exercise-done')); } catch {}
      } else if (status === 'incomplete' && timeLeftRef.current > 0 && timeLeftRef.current < selectedDuration) {
        saveResumeState(exerciseId, selectedDuration, timeLeftRef.current);
      }
    } catch (error) {
      console.error('Error al guardar ejercicio:', error);
      if (status === 'completed') { setIsComplete(true); setShowFatiga(true); }
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
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        {showFatiga && user?.id && (
          <FatigaModal
            userId={user.id}
            exerciseId={exerciseId}
            onClose={() => setShowFatiga(false)}
          />
        )}
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
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={handleBack} className="flex items-center gap-2 text-gray-700 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" /> {t('common', 'back')}
          </button>
          <div className="flex items-center gap-2">
            {/* Botón selector de música */}
            {!muted && (
              <button
                onClick={() => setShowMusicPicker(true)}
                title={lang === 'es' ? 'Cambiar música' : 'Change music'}
                className="p-2 rounded-lg transition bg-purple-100 text-purple-600 hover:bg-purple-200 relative"
              >
                <Music2 className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 text-[10px] leading-none">
                  {MUSIC_STYLES.find(s => s.id === musicStyle)?.emoji}
                </span>
              </button>
            )}
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

        {/* ── Modal selector de música ── */}
        {showMusicPicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center">
                    <Music2 className="w-5 h-5 text-purple-600" />
                  </div>
                  <h3 className="text-base font-bold text-gray-800">
                    {lang === 'es' ? 'Elige tu música' : 'Choose your music'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowMusicPicker(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {MUSIC_STYLES.map(style => (
                  <button
                    key={style.id}
                    onClick={() => {
                      const wasRunning = isRunning && !muted;
                      if (wasRunning) { ambientMusic.stop(); }
                      setMusicStyle(style.id);
                      musicStyleRef.current = style.id;
                      if (wasRunning) {
                        setTimeout(() => ambientMusic.start(MUSIC_VOLUME_DEFAULT,style.id), 1300);
                      }
                      setShowMusicPicker(false);
                    }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition text-left ${
                      musicStyle === style.id
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-100 hover:border-purple-200 hover:bg-purple-50/50'
                    }`}
                  >
                    <span className="text-2xl leading-none">{style.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">
                        {lang === 'es' ? style.nameEs : style.nameEn}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {lang === 'es' ? style.descEs : style.descEn}
                      </p>
                    </div>
                    {musicStyle === style.id && (
                      <span className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 text-center mt-3">
                {lang === 'es' ? 'El cambio aplica en el siguiente inicio' : 'Change applies on next start'}
                {isRunning && !muted ? (lang === 'es' ? ' o al instante si está corriendo' : ' · instant if running') : ''}
              </p>
            </div>
          </div>
        )}

        {/* Modal de "Continuar ejercicio incompleto" */}
        {resumePrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center">
                  <Play className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="text-base font-bold text-gray-800">
                  {lang === 'es' ? '¿Retomar ejercicio?' : 'Resume exercise?'}
                </h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                {lang === 'es'
                  ? `Tienes una sesión sin terminar. Faltaban ${formatTime(resumePrompt.timeLeft)} de ${formatTime(resumePrompt.originalDuration)}.`
                  : `You have an unfinished session. ${formatTime(resumePrompt.timeLeft)} remaining of ${formatTime(resumePrompt.originalDuration)}.`}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    // Empezar de cero: descartar estado
                    try { localStorage.removeItem(`therapheye_resume_${exerciseId}`); } catch { /* noop */ }
                    setResumePrompt(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition"
                >
                  {lang === 'es' ? 'Empezar de nuevo' : 'Start over'}
                </button>
                <button
                  onClick={() => {
                    // Retomar: aplicar duración y tiempo restante guardados
                    setSelectedDuration(resumePrompt.originalDuration);
                    setTimeLeft(resumePrompt.timeLeft);
                    setResumePrompt(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition"
                >
                  {lang === 'es' ? 'Continuar' : 'Continue'}
                </button>
              </div>
            </div>
          </div>
        )}

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
