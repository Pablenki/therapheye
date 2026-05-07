// =========================================
// Netlify Function: push-notify
// Envía push notification a los dispositivos
// de un usuario específico (llamado desde cliente)
// Usado por: detección de inactividad del timer
// =========================================

import { neon } from '@neondatabase/serverless';
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:admin@therapheye.netlify.app',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const getDb = () => neon(process.env.NEON_DATABASE_URL || process.env.VITE_NEON_DATABASE_URL || '');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

export const handler = async (event: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { ...CORS, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body: any;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { userId, title, message, tag } = body;
  if (!userId || !title) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'userId and title required' }) };
  }

  const sql = getDb();

  let subs: Array<{ endpoint: string; p256dh: string; auth: string }> = [];
  try {
    subs = await sql`
      SELECT endpoint, p256dh, auth
      FROM push_subscriptions
      WHERE user_id = ${userId}
    ` as any;
  } catch {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ sent: 0, msg: 'no subscriptions' }) };
  }

  if (subs.length === 0) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ sent: 0, msg: 'no subscriptions' }) };
  }

  const payload = JSON.stringify({
    title,
    body: message || '',
    tag: tag || 'timer-alert',
    url: '/',
  });

  let sent = 0, removed = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      sent++;
    } catch (e: any) {
      if (e.statusCode === 410 || e.statusCode === 404) {
        await sql`DELETE FROM push_subscriptions WHERE endpoint = ${sub.endpoint}`.catch(() => {});
        removed++;
      }
    }
  }

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ sent, removed }) };
};
