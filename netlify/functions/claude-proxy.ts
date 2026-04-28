// =========================================
// Netlify Function: claude-proxy
// Proxy seguro para la API de Anthropic Claude
// Mantiene ANTHROPIC_API_KEY en el servidor
// =========================================

import type { Handler } from '@netlify/functions';

const handler: Handler = async (event) => {
  // Solo POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');

    // Validar campos requeridos
    if (!body.messages || !Array.isArray(body.messages)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'messages is required' }) };
    }

    // Limitar max_tokens para evitar abuso
    const maxTokens = Math.min(body.max_tokens || 512, 2048);

    // Solo permitir modelos Haiku para controlar costos
    const allowedModels = ['claude-haiku-4-5-20251001', 'claude-sonnet-4-5-20250514'];
    const model = allowedModels.includes(body.model) ? body.model : 'claude-haiku-4-5-20251001';

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: body.system || undefined,
        messages: body.messages,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        statusCode: res.status,
        body: JSON.stringify(data),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (e: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message || 'Internal error' }),
    };
  }
};

export { handler };
