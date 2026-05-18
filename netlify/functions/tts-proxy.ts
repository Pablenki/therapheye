// =========================================
// Netlify Function: tts-proxy
// Cascada: Unreal Speech → PlayHT → ElevenLabs → [client: Web Speech API]
// Unreal Speech : 250K chars/mes gratis, sin tarjeta  ← primario
// PlayHT        : 12.5K words/mes gratis              ← fallback 1
// ElevenLabs    : 10K chars/mes gratis, sin tarjeta   ← fallback 2
// Web Speech API: navegador nativo, sin límite        ← señalizado al cliente
// =========================================

import type { Handler } from '@netlify/functions';

const MAX_TEXT_LENGTH = 4500;

// ── Unreal Speech ──────────────────────────────────────────────────────────────
// Voces multilingual. Scarlett (F) y Dan (M) funcionan bien en español.
// Docs: https://docs.unrealspeech.com

async function callUnrealSpeech(
  apiKey: string,
  text: string,
  lang: string,
): Promise<{ ok: boolean; audioBase64?: string; error?: string }> {
  const voiceId = lang === 'en' ? 'Dan' : 'Scarlett';

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
    console.warn('[tts-proxy] Unreal Speech falló:', res.status, errText);
    return { ok: false, error: `UnrealSpeech ${res.status}` };
  }

  const buffer = await res.arrayBuffer();
  const audioBase64 = Buffer.from(buffer).toString('base64');
  return { ok: true, audioBase64 };
}

// ── PlayHT ─────────────────────────────────────────────────────────────────────
// Requiere PLAYHT_API_KEY + PLAYHT_USER_ID
// Docs: https://docs.play.ht/reference/api-generate-tts-audio-stream

async function callPlayHT(
  apiKey: string,
  userId: string,
  text: string,
  lang: string,
): Promise<{ ok: boolean; audioBase64?: string; error?: string }> {
  // Voces PlayHT2.0 — multilingual
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
      body: JSON.stringify({
        text,
        voice,
        output_format: 'mp3',
        voice_engine: 'PlayHT2.0',
      }),
    });
  } catch (e: any) {
    return { ok: false, error: `PlayHT network: ${e.message}` };
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.warn('[tts-proxy] PlayHT falló:', res.status, errText);
    return { ok: false, error: `PlayHT ${res.status}` };
  }

  const buffer = await res.arrayBuffer();
  const audioBase64 = Buffer.from(buffer).toString('base64');
  return { ok: true, audioBase64 };
}

// ── ElevenLabs ─────────────────────────────────────────────────────────────────
// Rachel (21m00Tcm4TlvDq8ikWAM) — multilingual v2, buena en español
// Docs: https://elevenlabs.io/docs/api-reference/text-to-speech

const ELEVENLABS_VOICE = '21m00Tcm4TlvDq8ikWAM'; // Rachel — multilingual

async function callElevenLabs(
  apiKey: string,
  text: string,
): Promise<{ ok: boolean; audioBase64?: string; error?: string }> {
  let res: Response;
  try {
    res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
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
    console.warn('[tts-proxy] ElevenLabs falló:', res.status, errText);
    return { ok: false, error: `ElevenLabs ${res.status}` };
  }

  const buffer = await res.arrayBuffer();
  const audioBase64 = Buffer.from(buffer).toString('base64');
  return { ok: true, audioBase64 };
}

// ── Handler principal ──────────────────────────────────────────────────────────

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let text: string;
  let lang: string;

  try {
    const body = JSON.parse(event.body || '{}');
    text = String(body.text || '').slice(0, MAX_TEXT_LENGTH);
    lang = body.lang === 'en' ? 'en' : 'es';
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (!text.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No text provided' }) };
  }

  const unrealKey  = process.env.UNREAL_SPEECH_API_KEY;
  const playhtKey  = process.env.PLAYHT_API_KEY;
  const playhtUser = process.env.PLAYHT_USER_ID;
  const elevenKey  = process.env.ELEVENLABS_API_KEY;

  const ok = (audioBase64: string, provider: string) => ({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioContent: audioBase64, provider }),
  });

  const errors: string[] = [];

  // 1. Unreal Speech (250K chars/mes)
  if (unrealKey) {
    const r = await callUnrealSpeech(unrealKey, text, lang);
    if (r.ok) return ok(r.audioBase64!, 'UnrealSpeech');
    errors.push(r.error!);
  }

  // 2. PlayHT (12.5K words/mes)
  if (playhtKey && playhtUser) {
    const r = await callPlayHT(playhtKey, playhtUser, text, lang);
    if (r.ok) return ok(r.audioBase64!, 'PlayHT');
    errors.push(r.error!);
  }

  // 3. ElevenLabs (10K chars/mes)
  if (elevenKey) {
    const r = await callElevenLabs(elevenKey, text);
    if (r.ok) return ok(r.audioBase64!, 'ElevenLabs');
    errors.push(r.error!);
  }

  // 4. Señalizar al cliente que use Web Speech API nativa
  console.warn('[tts-proxy] Todos los proveedores fallaron, indicando fallback al cliente:', errors);
  return {
    statusCode: 503,
    body: JSON.stringify({ error: 'TTS_FALLBACK_WEB' }),
  };
};

export { handler };
