// =========================================
// Netlify Function: claude-proxy
// Proxy seguro para IA — usa Groq (primario) con fallback a Gemini
// Groq: 30 RPM gratis, respuestas <1s, modelos Llama 3.1
// Gemini: 15 RPM gratis, usado si Groq no está configurado
// =========================================

import type { Handler } from '@netlify/functions';

// ── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Retry con backoff exponencial.
 * retryOn429: si false, devuelve inmediatamente en 429 (Gemini: reintentar 429 genera más 429).
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 3,
  baseDelayMs = 2000,
  retryOn429 = true,
): Promise<Response> {
  let lastRes: Response | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, init);
    const shouldRetry = res.status === 503 || (retryOn429 && res.status === 429);
    if (!shouldRetry) return res;
    lastRes = res;
    if (attempt < maxRetries) {
      const delay = baseDelayMs * Math.pow(2, attempt); // 2s, 4s, 8s
      console.warn(`[claude-proxy] ${res.status} — reintento ${attempt + 1}/${maxRetries} en ${delay}ms`);
      await sleep(delay);
    }
  }
  return lastRes!;
}

// ── Groq (OpenAI-compatible) ─────────────────────────────────────────────────

async function callGroq(apiKey: string, body: any): Promise<{ ok: boolean; text?: string; error?: string; status?: number }> {
  const model = 'llama-3.1-8b-instant'; // rápido y eficiente; cambiar a llama-3.3-70b-versatile para respuestas más largas

  // Convertir formato Claude → OpenAI/Groq
  const messages: any[] = [];

  if (body.system) {
    messages.push({ role: 'system', content: body.system });
  }

  for (const msg of (body.messages || [])) {
    let content: string;
    if (typeof msg.content === 'string') {
      content = msg.content;
    } else if (Array.isArray(msg.content)) {
      // Groq no soporta imágenes en todos los modelos — extraer solo texto
      content = msg.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('\n') || '[imagen adjunta]';
    } else {
      content = String(msg.content);
    }
    messages.push({ role: msg.role, content });
  }

  const groqBody = {
    model,
    messages,
    max_tokens: Math.min(body.max_tokens || 512, 8192),
    temperature: 0.7,
  };

  const res = await fetchWithRetry(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(groqBody),
    },
    3,    // max 3 reintentos
    1500, // 1.5s base delay (Groq es rápido)
  );

  const data = await res.json();

  if (!res.ok) {
    const errMsg = data.error?.message || data.error?.type || `Groq HTTP ${res.status}`;
    console.error('[claude-proxy] Groq error:', res.status, JSON.stringify(data));
    return { ok: false, error: errMsg, status: res.status };
  }

  const text = data.choices?.[0]?.message?.content || '';
  return { ok: true, text };
}

// ── Gemini (fallback) ────────────────────────────────────────────────────────

async function callGemini(apiKey: string, body: any): Promise<{ ok: boolean; text?: string; error?: string; status?: number }> {
  const geminiContents: any[] = [];
  const systemInstruction = body.system || undefined;

  for (const msg of (body.messages || [])) {
    const role = msg.role === 'assistant' ? 'model' : 'user';
    let parts: any[];
    if (typeof msg.content === 'string') {
      parts = [{ text: msg.content }];
    } else if (Array.isArray(msg.content)) {
      parts = msg.content.map((block: any) => {
        if (block.type === 'text') return { text: block.text };
        if (block.type === 'image' && block.source) {
          return { inlineData: { mimeType: block.source.media_type, data: block.source.data } };
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

  const res = await fetchWithRetry(
    url,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiBody) },
    1,     // max 1 reintento — solo para 503, nunca para 429
    2500,  // 2.5s base delay
    false, // NO reintentar en 429: reintentar solo empeora el rate-limit
  );

  const data = await res.json();

  if (!res.ok) {
    const errMsg = data.error?.message || data.error?.status || `Gemini HTTP ${res.status}`;
    console.error('[claude-proxy] Gemini error:', res.status, JSON.stringify(data));
    return { ok: false, error: errMsg, status: res.status };
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return { ok: true, text };
}

// ── Handler principal ────────────────────────────────────────────────────────

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body: any;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  if (!body.messages || !Array.isArray(body.messages)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'messages is required' }) };
  }

  const groqKey   = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!groqKey && !geminiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'No AI API key configured (GROQ_API_KEY or GEMINI_API_KEY)' }) };
  }

  // Intentar Groq primero (si está configurado)
  if (groqKey) {
    const result = await callGroq(groqKey, body);
    if (result.ok) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: [{ type: 'text', text: result.text }] }),
      };
    }
    console.warn('[claude-proxy] Groq falló, intentando Gemini:', result.error);
    // Si Groq falla y no hay Gemini, retornar el error de Groq
    if (!geminiKey) {
      const safeStatus = result.status === 429 ? 429 : result.status && result.status >= 500 ? 503 : 400;
      return { statusCode: safeStatus, body: JSON.stringify({ error: result.error }) };
    }
  }

  // Fallback: Gemini
  if (geminiKey) {
    const result = await callGemini(geminiKey, body);
    if (result.ok) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: [{ type: 'text', text: result.text }] }),
      };
    }
    const safeStatus = result.status === 429 ? 429 : result.status && result.status >= 500 ? 503 : 400;
    return { statusCode: safeStatus, body: JSON.stringify({ error: result.error }) };
  }

  return { statusCode: 500, body: JSON.stringify({ error: 'No provider available' }) };
};

export { handler };
