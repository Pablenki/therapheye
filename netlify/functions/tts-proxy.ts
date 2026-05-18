// =========================================
// Netlify Function: tts-proxy
// ES: Deepgram Aura → ElevenLabs (x2) → PlayHT → Web Speech
// EN: Unreal Speech (x2) → Deepgram Aura → ElevenLabs (x2) → Web Speech
// Unreal Speech  : 250K chars/mes × 2 = 500K  (solo inglés)
// Deepgram Aura  : pay-as-you-go / $200 crédito inicial
// ElevenLabs     : 10K chars/mes × 2 = 20K    (multilingual)
// PlayHT         : 12.5K words/mes             (opcional, español)
// =========================================

import type { Handler } from '@netlify/functions';

const MAX_TEXT_LENGTH = 4500;

// ── Unreal Speech ──────────────────────────────────────────────────────────────

// Voces disponibles en UnrealSpeech v7 (solo inglés; español usa Scarlett como genérico)
const UNREAL_EN_VOICES = new Set(['Dan','Will','Eric','Scarlett','Lily','Liv','Amy','Sky','Eleanor']);

async function callUnrealSpeech(
  apiKey: string,
  text: string,
  lang: string,
  voiceParam?: string,
): Promise<{ ok: boolean; audioBase64?: string; error?: string; quota?: boolean }> {
  const voiceId = lang === 'en'
    ? (voiceParam && UNREAL_EN_VOICES.has(voiceParam) ? voiceParam : 'Dan')
    : 'Scarlett';

  let res: Response;
  try {
    res = await fetch('https://api.v7.unrealspeech.com/stream', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Text: text,
        VoiceId: voiceId,
        Bitrate: '128k',
        Speed: '0',
        Pitch: '1',
        TimestampType: 'sentence',
      }),
    });
  } catch (e: any) {
    return { ok: false, error: `UnrealSpeech network: ${e.message}` };
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const isQuota = res.status === 429 || res.status === 402;
    console.warn(`[tts-proxy] Unreal Speech falló (${res.status}):`, errText);
    return { ok: false, error: `UnrealSpeech ${res.status}`, quota: isQuota };
  }

  const buffer = await res.arrayBuffer();
  const audioBase64 = Buffer.from(buffer).toString('base64');
  return { ok: true, audioBase64 };
}

// ── PlayHT ─────────────────────────────────────────────────────────────────────

async function callPlayHT(
  apiKey: string,
  userId: string,
  text: string,
  lang: string,
): Promise<{ ok: boolean; audioBase64?: string; error?: string }> {
  const voice = lang === 'en'
    ? 's3://voice-cloning-zero-shot/d9ff78ba-d016-47f6-b0ef-dd630f59414e/female-cs/manifest.json'
    : 's3://voice-cloning-zero-shot/e040bd1b-f190-4bdb-83f0-75ef85b18f84/original/manifest.json';

  let res: Response;
  try {
    res = await fetch('https://api.play.ht/api/v2/tts/stream', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-User-Id': userId,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({ text, voice, output_format: 'mp3', voice_engine: 'PlayHT2.0' }),
    });
  } catch (e: any) {
    return { ok: false, error: `PlayHT network: ${e.message}` };
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.warn(`[tts-proxy] PlayHT falló (${res.status}):`, errText);
    return { ok: false, error: `PlayHT ${res.status}` };
  }

  const buffer = await res.arrayBuffer();
  const audioBase64 = Buffer.from(buffer).toString('base64');
  return { ok: true, audioBase64 };
}

// ── ElevenLabs ─────────────────────────────────────────────────────────────────

const ELEVENLABS_VOICE = '21m00Tcm4TlvDq8ikWAM'; // Rachel — multilingual v2

async function callElevenLabs(
  apiKey: string,
  text: string,
): Promise<{ ok: boolean; audioBase64?: string; error?: string; quota?: boolean }> {
  let res: Response;
  try {
    res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE}`,
      {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      },
    );
  } catch (e: any) {
    return { ok: false, error: `ElevenLabs network: ${e.message}` };
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const isQuota = res.status === 429 || res.status === 401;
    console.warn(`[tts-proxy] ElevenLabs falló (${res.status}):`, errText);
    return { ok: false, error: `ElevenLabs ${res.status}`, quota: isQuota };
  }

  const buffer = await res.arrayBuffer();
  const audioBase64 = Buffer.from(buffer).toString('base64');
  return { ok: true, audioBase64 };
}

// ── Deepgram Aura 2 TTS ────────────────────────────────────────────────────────
// Voces ES disponibles:
//   Mujer : aura-2-estrella-es | aura-2-olivia-es | aura-2-selena-es | aura-2-celeste-es
//   Hombre: aura-2-luciano-es  | aura-2-sirio-es  | aura-2-valerio-es | aura-2-javier-es
// Voz EN por defecto: aura-2-thalia-en (female) / aura-2-orion-en (male)

const DEEPGRAM_DEFAULT_ES = 'aura-2-estrella-es';
const DEEPGRAM_DEFAULT_EN = 'aura-asteria-en';

async function callDeepgram(
  apiKey: string,
  text: string,
  lang: string,
  voiceModel?: string,
): Promise<{ ok: boolean; audioBase64?: string; error?: string; quota?: boolean }> {
  const model = voiceModel ?? (lang === 'es' ? DEEPGRAM_DEFAULT_ES : DEEPGRAM_DEFAULT_EN);

  let res: Response;
  try {
    res = await fetch(`https://api.deepgram.com/v1/speak?model=${model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });
  } catch (e: any) {
    return { ok: false, error: `Deepgram network: ${e.message}` };
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const isQuota = res.status === 429 || res.status === 402;
    console.warn(`[tts-proxy] Deepgram falló (${res.status}):`, errText);
    return { ok: false, error: `Deepgram ${res.status}`, quota: isQuota };
  }

  const buffer = await res.arrayBuffer();
  return { ok: true, audioBase64: Buffer.from(buffer).toString('base64') };
}

// ── Handler principal ──────────────────────────────────────────────────────────

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let text: string;
  let lang: string;
  let voice: string | undefined;

  try {
    const body = JSON.parse(event.body || '{}');
    text  = String(body.text || '').slice(0, MAX_TEXT_LENGTH);
    lang  = body.lang === 'en' ? 'en' : 'es';
    voice = typeof body.voice === 'string' && body.voice ? body.voice : undefined;
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (!text.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No text provided' }) };
  }

  const unrealKey1  = process.env.UNREAL_SPEECH_API_KEY;
  const unrealKey2  = process.env.UNREAL_SPEECH_API_KEY_2;
  const playhtKey   = process.env.PLAYHT_API_KEY;
  const playhtUser  = process.env.PLAYHT_USER_ID;
  const elevenKey1  = process.env.ELEVENLABS_API_KEY;
  const elevenKey2  = process.env.ELEVENLABS_API_KEY_2;
  const deepgramKey = process.env.DEEPGRAM_API_KEY;

  const ok = (audioBase64: string, provider: string) => ({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioContent: audioBase64, provider }),
  });

  const errors: string[] = [];

  if (lang === 'es') {
    // ── Español: Deepgram Aura → ElevenLabs → PlayHT → Web Speech
    //            Unreal Speech excluido (voces solo en inglés)
    if (deepgramKey) {
      const r = await callDeepgram(deepgramKey, text, lang, voice);
      if (r.ok) return ok(r.audioBase64!, 'Deepgram');
      errors.push(r.error!);
    }
    if (elevenKey1) {
      const r = await callElevenLabs(elevenKey1, text);
      if (r.ok) return ok(r.audioBase64!, 'ElevenLabs·1');
      errors.push(r.error!);
    }
    if (elevenKey2) {
      const r = await callElevenLabs(elevenKey2, text);
      if (r.ok) return ok(r.audioBase64!, 'ElevenLabs·2');
      errors.push(r.error!);
    }
    if (playhtKey && playhtUser) {
      const r = await callPlayHT(playhtKey, playhtUser, text, lang);
      if (r.ok) return ok(r.audioBase64!, 'PlayHT');
      errors.push(r.error!);
    }

  } else {
    // ── Inglés: Unreal Speech → Deepgram Aura → ElevenLabs → Web Speech
    let unrealQuotaHit = false;
    // Extraer voz UnrealSpeech si el frontend envió una (y es válida)
    const unrealVoice = voice && UNREAL_EN_VOICES.has(voice) ? voice : undefined;

    if (unrealKey1) {
      const r = await callUnrealSpeech(unrealKey1, text, lang, unrealVoice);
      if (r.ok) return ok(r.audioBase64!, 'UnrealSpeech·1');
      errors.push(r.error!);
      unrealQuotaHit = !!r.quota;
    }
    if (unrealKey2 && unrealQuotaHit) {
      const r = await callUnrealSpeech(unrealKey2, text, lang, unrealVoice);
      if (r.ok) return ok(r.audioBase64!, 'UnrealSpeech·2');
      errors.push(r.error!);
    }
    if (deepgramKey) {
      const r = await callDeepgram(deepgramKey, text, lang, voice);
      if (r.ok) return ok(r.audioBase64!, 'Deepgram');
      errors.push(r.error!);
    }
    if (elevenKey1) {
      const r = await callElevenLabs(elevenKey1, text);
      if (r.ok) return ok(r.audioBase64!, 'ElevenLabs·1');
      errors.push(r.error!);
    }
    if (elevenKey2) {
      const r = await callElevenLabs(elevenKey2, text);
      if (r.ok) return ok(r.audioBase64!, 'ElevenLabs·2');
      errors.push(r.error!);
    }
  }

  // 4. Señalizar al cliente que use Web Speech API nativa
  console.warn('[tts-proxy] Todos los proveedores fallaron:', errors);
  return {
    statusCode: 503,
    body: JSON.stringify({ error: 'TTS_FALLBACK_WEB' }),
  };
};

export { handler };
