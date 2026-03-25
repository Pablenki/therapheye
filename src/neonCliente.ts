import { neon } from '@neondatabase/serverless';

// Connection string de Neon desde variable de entorno
const sql = neon(import.meta.env.VITE_NEON_DATABASE_URL);

// ─── Helper: genera ISO 8601 con offset local del usuario ────────────────────
// Ejemplo: "2026-03-24T16:42:00-06:00" en vez de "2026-03-24T22:42:00.000Z"
// Esto hace que PostgreSQL TIMESTAMPTZ almacene la hora correcta del usuario.
export const localISOString = (date?: Date): string => {
  const d = date ?? new Date();
  const pad = (n: number, len = 2) => n.toString().padStart(len, '0');
  const offsetMin = d.getTimezoneOffset(); // ej: 360 para UTC-6
  const sign = offsetMin <= 0 ? '+' : '-';
  const absOff = Math.abs(offsetMin);
  const offH = pad(Math.floor(absOff / 60));
  const offM = pad(absOff % 60);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${offH}:${offM}`;
};

export { sql };