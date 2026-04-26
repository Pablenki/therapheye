// =========================================
// HOOK: useReporteSemanal
// Envía reporte por email los lunes si el usuario
// tiene email configurado y no se ha enviado esta semana
// =========================================

import { useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { sql } from '../neonCliente';
import { enviarReporteSemanal } from '../utils/emailService';

const REPORTE_KEY = 'therapheye_reporte_semana'; // stores "YYYY-WW"

function getWeekKey(): string {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${week}`;
}

function isMonday(): boolean {
  return new Date().getDay() === 1;
}

export function useReporteSemanal() {
  const { user } = useUser();

  useEffect(() => {
    if (!user?.id || !user.email) return;
    if (!isMonday()) return;

    const weekKey = getWeekKey();
    const lastSent = localStorage.getItem(REPORTE_KEY);
    if (lastSent === weekKey) return; // already sent this week

    // Mark immediately to avoid double-sending on fast re-renders
    try { localStorage.setItem(REPORTE_KEY, weekKey); } catch {}

    const sendReport = async () => {
      try {
        // Get last 7 days stats
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const [sesiones, evaluaciones, rachaRows] = await Promise.all([
          sql`SELECT COUNT(*) as cnt FROM sesiones_ejercicio
              WHERE user_id = ${user.id} AND created_at > ${since}`.catch(() => [{ cnt: 0 }]),
          sql`SELECT AVG(puntaje) as avg_score FROM respuestas_cuestionario
              WHERE user_id = ${user.id} AND created_at > ${since}`.catch(() => [{ avg_score: null }]),
          sql`SELECT racha FROM progreso_usuario WHERE user_id = ${user.id} LIMIT 1`.catch(() => [{ racha: 0 }]),
        ]);

        const ejercicios = Number(sesiones[0]?.cnt ?? 0);
        const avgScore = evaluaciones[0]?.avg_score ? Math.round(Number(evaluaciones[0].avg_score)) : null;
        const racha = Number(rachaRows[0]?.racha ?? 0);

        const now = new Date();
        const semana = now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

        let resumen = '';
        if (ejercicios === 0) {
          resumen = 'Esta semana no registraste ejercicios oculares. Te animamos a retomar tu rutina hoy mismo.';
        } else if (ejercicios < 3) {
          resumen = `Hiciste ${ejercicios} ejercicio(s) esta semana. ¡Bien empezando! Intenta llegar a 5 por semana.`;
        } else if (ejercicios < 5) {
          resumen = `${ejercicios} ejercicios esta semana — vas por buen camino. Un poco más de consistencia y notarás la diferencia.`;
        } else {
          resumen = `¡Excelente semana! ${ejercicios} ejercicios completados. Tu racha actual de ${racha} días demuestra tu compromiso con tu salud visual.`;
        }

        await enviarReporteSemanal(user.email, user.nombre, {
          semana,
          ejercicios,
          racha,
          puntajePromedio: avgScore,
          resumen,
        });
      } catch {
        // Silently fail — don't disrupt the user experience
      }
    };

    // Delay to let app fully load first
    const timer = setTimeout(sendReport, 10_000);
    return () => clearTimeout(timer);
  }, [user?.id, user?.email, user?.nombre]);
}
