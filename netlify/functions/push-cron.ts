// =========================================
// Netlify Scheduled Function: push-cron
// Corre diariamente a las 20:00 UTC (~2pm CST)
// Envía recordatorios personalizados por usuario
// =========================================

import { neon } from '@neondatabase/serverless';
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:admin@therapheye.netlify.app',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const getDb = () => neon(process.env.NEON_DATABASE_URL || process.env.VITE_NEON_DATABASE_URL || '');

interface Sub {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  notify_exercises: boolean;
  notify_questionnaire: boolean;
  notify_streak: boolean;
}

async function sendPush(sub: Sub, payload: object) {
  await webpush.sendNotification(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    JSON.stringify(payload)
  );
}

export const handler = async () => {
  const sql = getDb();
  const now = new Date();
  const todayKey  = now.toISOString().split('T')[0];
  const weekAgo   = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const yesterday = new Date(now.getTime() - 86_400_000);
  const yKey      = yesterday.toISOString().split('T')[0];
  const isMonday  = now.getUTCDay() === 1;

  let subs: Sub[] = [];
  try {
    subs = await sql`SELECT * FROM push_subscriptions` as Sub[];
  } catch {
    return { statusCode: 200, body: JSON.stringify({ msg: 'table not ready yet' }) };
  }

  let sent = 0, failed = 0, removed = 0;

  for (const sub of subs) {
    const notifications: object[] = [];

    try {
      // ── 1. Recordatorio de ejercicios (diario si no hizo ninguno hoy) ──────
      if (sub.notify_exercises) {
        const [row] = await sql`
          SELECT COUNT(*) as cnt FROM historial_ejercicios
          WHERE user_id = ${sub.user_id} AND created_at::date = ${todayKey}
        `;
        if (Number(row.cnt) === 0) {
          notifications.push({
            title: '👁 ¡Cuida tus ojos hoy!',
            body: 'No has hecho tus ejercicios visuales. Solo 5 minutos marcan la diferencia.',
            url: '/',
            tag: 'daily-exercise',
          });
        }
      }

      // ── 2. Cuestionario semanal (solo lunes) ─────────────────────────────
      if (sub.notify_questionnaire && isMonday) {
        const [row] = await sql`
          SELECT COUNT(*) as cnt FROM respuestas_cuestionario
          WHERE user_id = ${sub.user_id} AND created_at >= ${weekAgo}
        `;
        if (Number(row.cnt) === 0) {
          notifications.push({
            title: '📊 Evaluación semanal pendiente',
            body: 'No has completado tu cuestionario de fatiga visual esta semana.',
            url: '/',
            tag: 'weekly-quest',
          });
        }
      }

      // ── 3. Racha en riesgo (activo ayer, sin actividad hoy) ──────────────
      if (sub.notify_streak) {
        const [[yRow], [tRow]] = await Promise.all([
          sql`SELECT COUNT(*) as cnt FROM respuestas_cuestionario WHERE user_id = ${sub.user_id} AND created_at::date = ${yKey}`,
          sql`SELECT COUNT(*) as cnt FROM respuestas_cuestionario WHERE user_id = ${sub.user_id} AND created_at::date = ${todayKey}`,
        ]);
        if (Number(yRow.cnt) > 0 && Number(tRow.cnt) === 0) {
          notifications.push({
            title: '🔥 ¡Tu racha está en riesgo!',
            body: 'Completa el cuestionario o un ejercicio hoy para no perder tu racha.',
            url: '/',
            tag: 'streak-risk',
          });
        }
      }

      // ── Enviar notificaciones de este usuario ─────────────────────────────
      for (const notif of notifications) {
        await sendPush(sub, notif);
        sent++;
      }
    } catch (e: any) {
      if (e.statusCode === 410 || e.statusCode === 404) {
        // Suscripción expirada → eliminar
        await sql`DELETE FROM push_subscriptions WHERE endpoint = ${sub.endpoint}`;
        removed++;
      } else {
        failed++;
      }
    }
  }

  console.log(`push-cron: sent=${sent} failed=${failed} removed=${removed} subs=${subs.length}`);
  return { statusCode: 200, body: JSON.stringify({ sent, failed, removed, subs: subs.length }) };
};
