// =========================================
// Netlify Function: claude-proxy (ahora usa Google Gemini)
// Proxy seguro para IA — tier gratuito de Gemini
// Mantiene la API key en el servidor
// Retorna formato compatible con el frontend existente
// =========================================

import type { Handler } from '@netlify/functions';

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'GEMINI_API_KEY not configured' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');

    if (!body.messages || !Array.isArray(body.messages)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'messages is required' }) };
    }

    // Convertir formato Claude → Gemini
    const geminiContents: any[] = [];

    // System prompt va como systemInstruction
    const systemInstruction = body.system || undefined;

    // Convertir messages [{role, content}] al formato Gemini [{role, parts}]
    for (const msg of body.messages) {
      const role = msg.role === 'assistant' ? 'model' : 'user';

      // El content puede ser string o array (para imágenes)
      let parts: any[];
      if (typeof msg.content === 'string') {
        parts = [{ text: msg.content }];
      } else if (Array.isArray(msg.content)) {
        parts = msg.content.map((block: any) => {
          if (block.type === 'text') return { text: block.text };
          if (block.type === 'image' && block.source) {
            return {
              inlineData: {
                mimeType: block.source.media_type,
                data: block.source.data,
              },
            };
          }
          return { text: JSON.stringify(block) };
        });
      } else {
        parts = [{ text: String(msg.content) }];
      }

      geminiContents.push({ role, parts });
    }

    const geminiBody: any = {
      contents: geminiContents,
      generationConfig: {
        maxOutputTokens: Math.min(body.max_tokens || 512, 2048),
        temperature: 0.7,
      },
    };

    if (systemInstruction) {
      geminiBody.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const model = 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data.error?.message
        || data.error?.status
        || `Gemini HTTP ${res.status}`;
      console.error('[claude-proxy] Gemini error:', res.status, JSON.stringify(data));
      // Map any Gemini status to a safe HTTP status the client understands
      const safeStatus = res.status === 401 || res.status === 403 ? 401
        : res.status === 429 ? 429
        : res.status >= 500 ? 503
        : 400;
      return {
        statusCode: safeStatus,
        body: JSON.stringify({ error: errMsg }),
      };
    }

    // Convertir respuesta Gemini → formato Claude (compatible con el frontend)
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: [{ type: 'text', text }],
      }),
    };
  } catch (e: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message || 'Internal error' }),
    };
  }
};

export { handler };
