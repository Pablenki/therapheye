// =========================================
// SERVICIO DE EMAILJS
// =========================================

import emailjs from '@emailjs/browser';

const SERVICE_ID = 'service_l215bdw';
const PUBLIC_KEY = 'ueY6zLrLJDbWMeCCH';
const TEMPLATE_VERIFICACION = 'template_dcsyas5';
const TEMPLATE_BIENVENIDA = 'template_swoo69m';
const TEMPLATE_ELIMINAR_CUENTA = 'template_dcsyas5';

// Genera código de 6 dígitos
export const generarCodigo = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Envía correo de verificación
export const enviarCorreoVerificacion = async (
  email: string,
  nombre: string,
  codigo: string
): Promise<void> => {
  await emailjs.send(
    SERVICE_ID,
    TEMPLATE_VERIFICACION,
    {
      email,
      nombre,
      codigo,
    },
    PUBLIC_KEY
  );
};

// Envía correo de confirmación para eliminar cuenta
export const enviarCorreoEliminacion = async (
  email: string,
  nombre: string,
  codigo: string
): Promise<void> => {
  await emailjs.send(
    SERVICE_ID,
    TEMPLATE_ELIMINAR_CUENTA,
    { email, nombre, codigo },
    PUBLIC_KEY
  );
};

// Envía reporte semanal de salud visual (via Netlify Function + Gmail)
export const enviarReporteSemanal = async (
  email: string,
  nombre: string,
  stats: {
    semana: string;
    ejercicios: number;
    racha: number;
    puntajePromedio: number | null;
    resumen: string;
  }
): Promise<void> => {
  const res = await fetch('/.netlify/functions/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'reporte',
      email,
      nombre,
      semana: stats.semana,
      ejercicios: stats.ejercicios,
      racha: stats.racha,
      puntaje_promedio: stats.puntajePromedio !== null ? `${stats.puntajePromedio}/100` : 'N/A',
      resumen: stats.resumen,
    }),
  });
  if (!res.ok) throw new Error('Error enviando reporte semanal');
};

// Envía transcript del chat al soporte técnico (via Netlify Function + Gmail)
export const enviarSoporteTecnico = async (
  usuarioNombre: string,
  usuarioEmail: string,
  transcript: string,
  fecha: string
): Promise<void> => {
  const res = await fetch('/.netlify/functions/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'soporte',
      usuario_nombre: usuarioNombre,
      usuario_email: usuarioEmail,
      transcript,
      fecha,
    }),
  });
  if (!res.ok) throw new Error('Error enviando soporte técnico');
};

// Envía correo de bienvenida
export const enviarCorreoBienvenida = async (
  email: string,
  nombre: string
): Promise<void> => {
  await emailjs.send(
    SERVICE_ID,
    TEMPLATE_BIENVENIDA,
    {
      email,
      nombre,
    },
    PUBLIC_KEY
  );
};