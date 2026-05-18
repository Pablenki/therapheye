// =========================================
// Utilidad TTS compartida
// Cascada: proxy (Unreal Speech → PlayHT → ElevenLabs) → Web Speech API
// Uso: await speak("Inhala profundo", "es")
//      speak(...).then(() => nextStep())   ← se resuelve al terminar el audio
// =========================================

type Lang = 'es' | 'en';

let currentAudio: HTMLAudioElement | null = null;

// ── Detener todo audio activo ─────────────────────────────────────────────────

export function stopSpeech(): void {
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
// Retorna Promise que se resuelve cuando el audio termina.

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
    // Safety timeout — estimado 150 palabras/min a rate 0.9
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

// ── Reproducir audio base64 MP3 ───────────────────────────────────────────────

function playBase64Audio(base64: string): Promise<void> {
  return new Promise((resolve, reject) => {
    stopSpeech();
    const audio = new Audio(`data:audio/mp3;base64,${base64}`);
    currentAudio = audio;
    audio.onended  = () => { currentAudio = null; resolve(); };
    audio.onerror  = (e) => { currentAudio = null; reject(e); };
    audio.play().catch(reject);
  });
}

// ── speak() — Web Speech API directa (uso general) ───────────────────────────
// Siempre retorna Promise que se resuelve cuando el audio termina.

export async function speak(text: string, lang: Lang = 'es'): Promise<void> {
  if (!text.trim()) return;
  stopSpeech();
  await speakWebSpeech(text, lang);
}

// ── speakViaProxy() — Cascada proxy (solo ChatSintomas) ───────────────────────
// Unreal Speech → PlayHT → ElevenLabs → Web Speech API como fallback final.

export async function speakViaProxy(text: string, lang: Lang = 'es'): Promise<void> {
  if (!text.trim()) return;
  stopSpeech();

  try {
    const res = await fetch('/.netlify/functions/tts-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang }),
    });

    if (res.ok) {
      const data = await res.json() as { audioContent?: string };
      if (data.audioContent) {
        await playBase64Audio(data.audioContent);
        return;
      }
    }
    // Proxy señalizó TTS_FALLBACK_WEB o cualquier error → Web Speech
  } catch {
    // Sin conexión o proxy caído → Web Speech
  }

  await speakWebSpeech(text, lang);
}
