// =========================================
// Netlify Function: ai-queue
// Gestiona la cola de acceso al asistente de IA
// Solo un usuario activo a la vez (limita consumo TPM/día en Groq)
// Inactividad: sesión expira automáticamente a los 2 minutos sin heartbeat
// =========================================

import { neon } from '@neondatabase/serverless';
import type { Handler } from '@netlify/functions';

const INACTIVITY_MS = 2 * 60 * 1000; // 2 minutos

const getDb = () => {
  const url = process.env.NEON_DATABASE_URL || process.env.VITE_NEON_DATABASE_URL || '';
  return neon(url);
};

async function ensureTable(sql: ReturnType<typeof neon>) {
  await sql`
    CREATE TABLE IF NOT EXISTS ai_chat_sessions (
      user_id      TEXT        PRIMARY KEY,
      joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function cleanupExpired(sql: ReturnType<typeof neon>) {
  const cutoff = new Date(Date.now() - INACTIVITY_MS).toISOString();
  await sql`DELETE FROM ai_chat_sessions WHERE last_heartbeat < ${cutoff}`;
}

export const handler: Handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        ...headers,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body: any;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { action, userId } = body;
  if (!action || !userId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'action and userId required' }) };
  }

  const sql = getDb();

  try {
    await ensureTable(sql);
    await cleanupExpired(sql);

    // ── join: entra a la cola (o refresca si ya estaba) ──
    if (action === 'join') {
      // ON CONFLICT: si el usuario ya existe, solo actualiza heartbeat (mantiene joined_at original → mantiene posición)
      await sql`
        INSERT INTO ai_chat_sessions (user_id, joined_at, last_heartbeat)
        VALUES (${userId}, NOW(), NOW())
        ON CONFLICT (user_id) DO UPDATE SET last_heartbeat = NOW()
      `;

      const sessions = await sql`SELECT user_id FROM ai_chat_sessions ORDER BY joined_at ASC`;
      const position = (sessions as any[]).findIndex((s: any) => s.user_id === userId);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: position === 0 ? 'active' : 'waiting',
          position,
        }),
      };
    }

    // ── heartbeat: mantiene viva la sesión y devuelve posición actual ──
    if (action === 'heartbeat') {
      const updated = await sql`
        UPDATE ai_chat_sessions
        SET last_heartbeat = NOW()
        WHERE user_id = ${userId}
        RETURNING user_id
      `;

      if ((updated as any[]).length === 0) {
        // La sesión expiró en el servidor (otro proceso la limpió)
        return { statusCode: 200, headers, body: JSON.stringify({ status: 'expired' }) };
      }

      const sessions = await sql`SELECT user_id FROM ai_chat_sessions ORDER BY joined_at ASC`;
      const position = (sessions as any[]).findIndex((s: any) => s.user_id === userId);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: position === 0 ? 'active' : 'waiting',
          position,
        }),
      };
    }

    // ── leave: el usuario sale de la cola / libera el turno ──
    if (action === 'leave') {
      await sql`DELETE FROM ai_chat_sessions WHERE user_id = ${userId}`;
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };

  } catch (err: any) {
    console.error('[ai-queue] Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error' }) };
  }
};
