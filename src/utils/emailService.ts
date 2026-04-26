// =========================================
// SERVICIO DE EMAILJS
// =========================================

import emailjs from '@emailjs/browser';

const SERVICE_ID = 'service_l215bdw';
const PUBLIC_KEY = 'ueY6zLrLJDbWMeCCH';
const TEMPLATE_VERIFICACION = 'template_dcsyas5';
const TEMPLATE_BIENVENIDA = 'template_swoo69m';
const TEMPLATE_ELIMINAR_CUENTA = 'template_dcsyas5'; // Mismo template de verificación — cambia esto al ID del nuevo template cuando lo crees en EmailJS
const TEMPLATE_REPORTE_SEMANAL = 'template_reporte_semanal'; // Crea este template en EmailJS con variables: email, nombre, semana, ejercicios, racha, puntaje_promedio, resumen
const TEMPLATE_SOPORTE_TECNICO = 'template_soporte_tecnico'; // Crea este template en EmailJS con variables: to_email, usuario_nombre, usuario_email, transcript, fecha

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

// Envía reporte semanal de salud visual
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
  await emailjs.send(
    SERVICE_ID,
    TEMPLATE_REPORTE_SEMANAL,
    {
      email,
      nombre,
      semana: stats.semana,
      ejercicios: stats.ejercicios,
      racha: stats.racha,
      puntaje_promedio: stats.puntajePromedio !== null ? `${stats.puntajePromedio}/100` : 'N/A',
      resumen: stats.resumen,
    },
    PUBLIC_KEY
  );
};

// Envía transcript del chat al soporte técnico
export const enviarSoporteTecnico = async (
  usuarioNombre: string,
  usuarioEmail: string,
  transcript: string,
  fecha: string
): Promise<void> => {
  await emailjs.send(
    SERVICE_ID,
    TEMPLATE_SOPORTE_TECNICO,
    {
      to_email: 'therapheye@gmail.com',
      usuario_nombre: usuarioNombre,
      usuario_email: usuarioEmail,
      transcript,
      fecha,
    },
    PUBLIC_KEY
  );
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