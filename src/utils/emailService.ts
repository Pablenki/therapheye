// =========================================
// SERVICIO DE EMAIL — Therapheye
// Usa Netlify Function + Gmail SMTP (sin límites de terceros)
// =========================================

const API = '/.netlify/functions/send-email';

const post = (body: object) =>
  fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(res => { if (!res.ok) throw new Error(`Email error ${res.status}`); });

// Genera código de 6 dígitos
export const generarCodigo = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

export const enviarCorreoVerificacion = (email: string, nombre: string, codigo: string) =>
  post({ type: 'verificacion', email, nombre, codigo });

export const enviarCorreoBienvenida = (email: string, nombre: string) =>
  post({ type: 'bienvenida', email, nombre });

export const enviarCorreoEliminacion = (email: string, nombre: string, codigo: string) =>
  post({ type: 'eliminar', email, nombre, codigo });

export const enviarReporteSemanal = (
  email: string,
  nombre: string,
  stats: { semana: string; ejercicios: number; racha: number; puntajePromedio: number | null; resumen: string }
) =>
  post({
    type: 'reporte',
    email,
    nombre,
    semana: stats.semana,
    ejercicios: stats.ejercicios,
    racha: stats.racha,
    puntaje_promedio: stats.puntajePromedio !== null ? `${stats.puntajePromedio}/100` : 'N/A',
    resumen: stats.resumen,
  });

export const enviarCorreoResetPassword = (email: string, nombre: string, url: string) =>
  post({ type: 'reset-password', email, nombre, url });

export const enviarSoporteTecnico = (
  usuarioNombre: string,
  usuarioEmail: string,
  transcript: string,
  fecha: string
) =>
  post({ type: 'soporte', usuario_nombre: usuarioNombre, usuario_email: usuarioEmail, transcript, fecha });
