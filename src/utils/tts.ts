// =========================================
// Utilidad TTS compartida
// Cascada: proxy (Deepgram → ElevenLabs → PlayHT) → Web Speech API
// Uso: await speak("Inhala profundo", "es")
//      speak(...).then(() => nextStep())   ← se resuelve al terminar el audio
// =========================================

type Lang = 'es' | 'en';

let currentAudio: HTMLAudioElement | null = null;

// Contador de generación: se incrementa en cada stopSpeech() para
// cancelar respuestas del proxy que lleguen tarde (evita eco por doble-click).
let speakGen = 0;

// ── Detener todo audio activo ─────────────────────────────────────────────────

export function stopSpeech(): void {
  speakGen++;                          // invalida cualquier speakViaProxy en vuelo
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

// ── Web Speech API (fallback final, navegador nativo) ─────────────────────────

function speakWebSpeech(text: string, lang: Lang): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) { resolve(); return; }
    window.speechSynthesis.cancel();

    const utt = new SpeechSynthesisUtterance(text);
    utt.lang   = lang === 'en' ? 'en-US' : 'es-MX';
    utt.rate   = 0.9;
    utt.pitch  = 1.0;
    utt.volume = 1.0;

    let resolved = false;
    const done = () => { if (!resolved) { resolved = true; resolve(); } };
    utt.onend  = done;
    utt.onerror = done;
    const words = text.trim().split(/\s+/).length;
    setTimeout(done, Math.max(4000, words * 500));

    const applyVoiceAndSpeak = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) { window.speechSynthesis.speak(utt); return; }

      const voz = lang === 'en'
        ? voices.find(v => v.lang === 'en-US') || voices.find(v => v.lang.startsWith('en'))
        : voices.find(v => v.lang === 'es-MX') ||
          voices.find(v => v.lang === 'es-US') ||
          voices.find(v => v.lang === 'es-419') ||
          voices.find(v => v.lang.startsWith('es-') && !v.lang.includes('-ES')) ||
          voices.find(v => v.lang.startsWith('es'));

      if (voz) utt.voice = voz;
      window.speechSynthesis.speak(utt);
    };

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      applyVoiceAndSpeak();
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        applyVoiceAndSpeak();
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  });
}

// ── AudioContext compartido (para boost de volumen) ──────────────────────────
let sharedAudioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext {
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioContext();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

// ── Reproducir audio base64 MP3 con boost de volumen ──────────────────────────

function playBase64Audio(base64: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Detener audio anterior sin incrementar speakGen
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = '';
      currentAudio = null;
    }
    const audio = new Audio(`data:audio/mp3;base64,${base64}`);

    // Boost de volumen x1.6 usando Web Audio API (HTML Audio máximo es 1.0)
    try {
      const ctx  = getAudioCtx();
      const src  = ctx.createMediaElementSource(audio);
      const gain = ctx.createGain();
      gain.gain.value = 1.6;
      src.connect(gain);
      gain.connect(ctx.destination);
    } catch { /* fallback: volumen nativo 1.0 */ }

    currentAudio = audio;
    audio.onended  = () => { currentAudio = null; resolve(); };
    audio.onerror  = (e) => { currentAudio = null; reject(e); };
    audio.play().catch(reject);
  });
}

// ── speak() — Web Speech API directa (uso general) ───────────────────────────

export async function speak(text: string, lang: Lang = 'es'): Promise<void> {
  if (!text.trim()) return;
  stopSpeech();
  await speakWebSpeech(text, lang);
}

// ── speakViaProxy() — Cascada proxy (ChatSintomas) ───────────────────────────
// Usa contador de generación para descartar respuestas obsoletas del proxy
// y evitar el eco que ocurre cuando el usuario hace doble-click.

export async function speakViaProxy(text: string, lang: Lang = 'es', voice?: string): Promise<void> {
  if (!text.trim()) return;
  stopSpeech();                        // incrementa speakGen
  const myGen = speakGen;             // captura generación actual

  try {
    const res = await fetch('/.netlify/functions/tts-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang, ...(voice ? { voice } : {}) }),
    });

    if (myGen !== speakGen) return;    // cancelado por click posterior

    if (res.ok) {
      const data = await res.json() as { audioContent?: string };
      if (myGen !== speakGen) return;  // cancelado mientras parseábamos JSON
      if (data.audioContent) {
        await playBase64Audio(data.audioContent);
        return;
      }
    }
    // Proxy señalizó TTS_FALLBACK_WEB o error → Web Speech
  } catch {
    // Sin conexión o proxy caído → Web Speech
  }

  if (myGen !== speakGen) return;      // cancelado antes del fallback
  await speakWebSpeech(text, lang);
}
