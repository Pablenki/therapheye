// =========================================
// Netlify Function: claude-proxy
// Cascada: Gemini flash-latest → Gemini 2.5-flash → Groq → xAI
// Gemini free: 5 RPM / 20 RPD por modelo
// Groq free: 30 RPM / 14,400 RPD (llama-3.1-8b-instant)
// xAI: último recurso (requiere créditos)
// =========================================

import type { Handler } from '@netlify/functions';

// ── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 1,
  baseDelayMs = 1500,
  retryOn429 = false,
): Promise<Response> {
  let lastRes: Response | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, init);
    const shouldRetry = res.status === 503 || (retryOn429 && res.status === 429);
    if (!shouldRetry) return res;
    lastRes = res;
    if (attempt < maxRetries) {
      const delay = baseDelayMs * Math.pow(2, attempt);
      console.warn(`[claude-proxy] ${res.status} — reintento ${attempt + 1}/${maxRetries} en ${delay}ms`);
      await sleep(delay);
    }
  }
  return lastRes!;
}

// ── Gemini ────────────────────────────────────────────────────────────────────

async function callGemini(
  apiKey: string,
  model: string,
  body: any,
): Promise<{ ok: boolean; text?: string; error?: string; status?: number }> {
  const geminiContents: any[] = [];

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
  if (body.system) {
    geminiBody.systemInstruction = { parts: [{ text: body.system }] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(geminiBody),
  });

  const data = await res.json();

  if (!res.ok) {
    const errMsg = data.error?.message || data.error?.status || `Gemini ${model} HTTP ${res.status}`;
    console.warn(`[claude-proxy] ${model} falló (${res.status}):`, errMsg);
    return { ok: false, error: errMsg, status: res.status };
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return { ok: true, text };
}

// ── Groq (OpenAI-compatible) ──────────────────────────────────────────────────

async function callGroq(
  apiKey: string,
  body: any,
): Promise<{ ok: boolean; text?: string; error?: string; status?: number }> {
  const messages: any[] = [];

  if (body.system) messages.push({ role: 'system', content: body.system });

  for (const msg of (body.messages || [])) {
    let content: string;
    if (typeof msg.content === 'string') {
      content = msg.content;
    } else if (Array.isArray(msg.content)) {
      content = msg.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('\n') || '[imagen adjunta]';
    } else {
      content = String(msg.content);
    }
    messages.push({ role: msg.role, content });
  }

  const res = await fetchWithRetry(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages,
        max_tokens: Math.min(body.max_tokens || 512, 8192),
        temperature: 0.7,
      }),
    },
    1,
    1000,
    false,
  );

  const data = await res.json();

  if (!res.ok) {
    const errMsg = data.error?.message || data.error?.type || `Groq HTTP ${res.status}`;
    console.warn('[claude-proxy] Groq falló:', res.status, errMsg);
    return { ok: false, error: errMsg, status: res.status };
  }

  const text = data.choices?.[0]?.message?.content || '';
  return { ok: true, text };
}

// ── xAI / Grok ────────────────────────────────────────────────────────────────

async function callXAI(
  apiKey: string,
  body: any,
): Promise<{ ok: boolean; text?: string; error?: string; status?: number }> {
  const messages: any[] = [];

  if (body.system) messages.push({ role: 'system', content: body.system });

  for (const msg of (body.messages || [])) {
    let content: string;
    if (typeof msg.content === 'string') {
      content = msg.content;
    } else if (Array.isArray(msg.content)) {
      content = msg.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('\n') || '[imagen adjunta]';
    } else {
      content = String(msg.content);
    }
    messages.push({ role: msg.role, content });
  }

  const res = await fetchWithRetry(
    'https://api.x.ai/v1/chat/completions',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'grok-3-mini',
        messages,
        max_tokens: Math.min(body.max_tokens || 512, 8192),
        temperature: 0.7,
      }),
    },
    2,    // 2 reintentos para 503
    1500,
    false,
  );

  const data = await res.json();

  if (!res.ok) {
    const errMsg = data.error?.message || data.error?.type || `xAI HTTP ${res.status}`;
    console.warn('[claude-proxy] xAI falló:', res.status, errMsg);
    return { ok: false, error: errMsg, status: res.status };
  }

  const text = data.choices?.[0]?.message?.content || '';
  return { ok: true, text };
}

// ── Handler principal ─────────────────────────────────────────────────────────

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

  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey   = process.env.GROQ_API_KEY;
  const xaiKey    = process.env.XAI_API_KEY;

  if (!geminiKey && !groqKey && !xaiKey) {
    return { statusCode: 503, body: JSON.stringify({ error: 'AI_UNAVAILABLE' }) };
  }

  // ── Cascada: Gemini flash-latest → Gemini 2.5-flash → Groq → xAI ───────────
  const errors: string[] = [];

  const ok = (text: string, provider: string) => ({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: [{ type: 'text', text }], provider }),
  });

  if (geminiKey) {
    for (const model of ['gemini-flash-latest', 'gemini-2.5-flash']) {
      const r = await callGemini(geminiKey, model, body);
      if (r.ok) return ok(r.text!, model === 'gemini-flash-latest' ? 'Gemini 3 Flash' : 'Gemini 2.5 Flash');
      errors.push(`${model}: ${r.error}`);
      if (r.status === 401 || r.status === 403) break;
    }
  }

  if (groqKey) {
    const r = await callGroq(groqKey, body);
    if (r.ok) return ok(r.text!, 'Groq · LLaMA 3.1');
    errors.push(`Groq: ${r.error}`);
  }

  if (xaiKey) {
    const r = await callXAI(xaiKey, body);
    if (r.ok) return ok(r.text!, 'xAI Grok');
    errors.push(`xAI: ${r.error}`);
  }

  console.error('[claude-proxy] Todos los proveedores fallaron:', errors);
  return {
    statusCode: 503,
    body: JSON.stringify({ error: 'AI_UNAVAILABLE' }),
  };
};

export { handler };
