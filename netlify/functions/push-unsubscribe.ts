// =========================================
// Netlify Function: push-unsubscribe
// Elimina una suscripción push de la BD
// =========================================

import { neon } from '@neondatabase/serverless';

const getDb = () => neon(process.env.NEON_DATABASE_URL || process.env.VITE_NEON_DATABASE_URL || '');

export const handler = async (event: any) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method not allowed' };
  }

  try {
    const { endpoint } = JSON.parse(event.body || '{}');
    if (!endpoint) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing endpoint' }) };

    const sql = getDb();
    await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (e: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
