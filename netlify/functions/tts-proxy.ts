// =========================================
// Netlify Function: tts-proxy
// Google Cloud Text-to-Speech (Neural2 voices)
// Requires env var: GOOGLE_TTS_API_KEY
// Free tier: 1M chars/month (Neural2)
// =========================================

import type { Handler } from '@netlify/functions';

const MAX_TEXT_LENGTH = 4500;

const VOICES: Record<string, string> = {
  es: 'es-US-Neural2-A',
  en: 'en-US-Neural2-C',
};

const LANG_CODES: Record<string, string> = {
  es: 'es-US',
  en: 'en-US',
};

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) {
    return { statusCode: 503, body: JSON.stringify({ error: 'TTS not configured' }) };
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

  try {
    const res = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: LANG_CODES[lang], name: VOICES[lang] },
          audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0, pitch: 0 },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error('[tts-proxy] Google API error:', res.status, errText);
      return { statusCode: res.status, body: JSON.stringify({ error: 'TTS API error' }) };
    }

    const data = await res.json() as { audioContent?: string };
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioContent: data.audioContent }),
    };
  } catch (e: any) {
    console.error('[tts-proxy] Unexpected error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message || 'TTS failed' }) };
  }
};

export { handler };
