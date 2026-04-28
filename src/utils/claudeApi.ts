// =========================================
// AI API CLIENT — Therapheye
// Usa Google Gemini (tier gratuito)
// Proxy serverless en producción,
// directo a Gemini en desarrollo local
// =========================================

interface AIRequest {
  model?: string;
  max_tokens?: number;
  system?: string;
  messages: { role: string; content: any }[];
}

interface AIResponse {
  content: { type: string; text: string }[];
  [key: string]: any;
}

const PROXY_URL = '/.netlify/functions/claude-proxy';

export async function callClaude(req: AIRequest): Promise<AIResponse> {
  const isDev = import.meta.env.DEV;

  // En producción siempre usar el proxy
  if (!isDev) {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        max_tokens: req.max_tokens || 512,
        system: req.system,
        messages: req.messages,
      }),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  }

  // Dev: llamada directa a Gemini
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('No VITE_GEMINI_API_KEY configured in .env');

  // Convertir formato a Gemini
  const geminiContents = req.messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: typeof msg.content === 'string'
      ? [{ text: msg.content }]
      : Array.isArray(msg.content)
        ? msg.content.map((block: any) => {
            if (block.type === 'text') return { text: block.text };
            if (block.type === 'image' && block.source) {
              return { inlineData: { mimeType: block.source.media_type, data: block.source.data } };
            }
            return { text: JSON.stringify(block) };
          })
        : [{ text: String(msg.content) }],
  }));

  const geminiBody: any = {
    contents: geminiContents,
    generationConfig: {
      maxOutputTokens: Math.min(req.max_tokens || 512, 2048),
      temperature: 0.7,
    },
  };

  if (req.system) {
    geminiBody.systemInstruction = { parts: [{ text: req.system }] };
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    }
  );

  if (!res.ok) throw new Error(`Gemini API ${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Retornar en formato compatible
  return { content: [{ type: 'text', text }] };
}
