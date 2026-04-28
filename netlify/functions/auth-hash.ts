// =========================================
// Netlify Function: auth-hash
// Hashing y verificación de contraseñas server-side
// Mantiene bcrypt fuera del bundle del frontend
// =========================================

import type { Handler } from '@netlify/functions';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { action, password, hash } = JSON.parse(event.body || '{}');

    if (action === 'hash') {
      if (!password || typeof password !== 'string') {
        return { statusCode: 400, body: JSON.stringify({ error: 'password is required' }) };
      }
      const salt = await bcrypt.genSalt(SALT_ROUNDS);
      const passwordHash = await bcrypt.hash(password, salt);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: passwordHash }),
      };
    }

    if (action === 'compare') {
      if (!password || !hash) {
        return { statusCode: 400, body: JSON.stringify({ error: 'password and hash are required' }) };
      }
      const match = await bcrypt.compare(password, hash);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match }),
      };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid action. Use "hash" or "compare"' }) };
  } catch (e: any) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message || 'Internal error' }) };
  }
};

export { handler };
