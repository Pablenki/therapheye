// =========================================
// SERVICIO DE EMAILJS
// =========================================

import emailjs from '@emailjs/browser';

const SERVICE_ID = 'service_l215bdw';
const PUBLIC_KEY = 'ueY6zLrLJDbWMeCCH';
const TEMPLATE_VERIFICACION = 'template_dcsyas5';
const TEMPLATE_BIENVENIDA = 'template_swoo69m';

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