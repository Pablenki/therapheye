// =========================================
// CLAUDE API CLIENT — Therapheye
// Usa el proxy serverless en producción,
// fallback a directo en desarrollo local
// =========================================

interface ClaudeRequest {
  model?: string;
  max_tokens?: number;
  system?: string;
  messages: { role: string; content: any }[];
}

interface ClaudeResponse {
  content: { type: string; text: string }[];
  [key: string]: any;
}

const PROXY_URL = '/.netlify/functions/claude-proxy';
const DIRECT_URL = 'https://api.anthropic.com/v1/messages';

export async function callClaude(req: ClaudeRequest): Promise<ClaudeResponse> {
  const isDev = import.meta.env.DEV;
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

  // En producción siempre usar el proxy (API key en el servidor)
  // En desarrollo, usar directo si hay VITE_ANTHROPIC_API_KEY
  if (!isDev) {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: req.model || 'claude-haiku-4-5-20251001',
        max_tokens: req.max_tokens || 512,
        system: req.system,
        messages: req.messages,
      }),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  }

  // Dev: llamada directa
  if (!apiKey) throw new Error('No API key configured');
  const res = await fetch(DIRECT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: req.model || 'claude-haiku-4-5-20251001',
      max_tokens: req.max_tokens || 512,
      system: req.system,
      messages: req.messages,
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}
