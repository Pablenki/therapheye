// =========================================
// Netlify Function: push-subscribe
// Guarda o actualiza la suscripción push de un usuario
// =========================================

import { neon } from '@neondatabase/serverless';

const getDb = () => {
  const url = process.env.NEON_DATABASE_URL || process.env.VITE_NEON_DATABASE_URL || '';
  return neon(url);
};

export const handler = async (event: any) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { subscription, userId, preferences } = JSON.parse(event.body || '{}');
    if (!subscription?.endpoint || !userId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing subscription or userId' }) };
    }

    const sql = getDb();

    await sql`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id          SERIAL PRIMARY KEY,
        user_id     TEXT NOT NULL,
        endpoint    TEXT NOT NULL UNIQUE,
        p256dh      TEXT NOT NULL,
        auth        TEXT NOT NULL,
        notify_exercises     BOOLEAN DEFAULT true,
        notify_questionnaire BOOLEAN DEFAULT true,
        notify_streak        BOOLEAN DEFAULT true,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      INSERT INTO push_subscriptions
        (user_id, endpoint, p256dh, auth, notify_exercises, notify_questionnaire, notify_streak)
      VALUES (
        ${userId},
        ${subscription.endpoint},
        ${subscription.keys.p256dh},
        ${subscription.keys.auth},
        ${preferences?.exercises  ?? true},
        ${preferences?.questionnaire ?? true},
        ${preferences?.streak     ?? true}
      )
      ON CONFLICT (endpoint) DO UPDATE SET
        user_id              = ${userId},
        notify_exercises     = ${preferences?.exercises  ?? true},
        notify_questionnaire = ${preferences?.questionnaire ?? true},
        notify_streak        = ${preferences?.streak     ?? true},
        updated_at           = NOW()
    `;

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (e: any) {
    console.error('push-subscribe error:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
