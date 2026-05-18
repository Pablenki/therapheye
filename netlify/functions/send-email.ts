// =========================================
// Netlify Function: send-email
// Envía todos los correos de Therapheye via Gmail SMTP (Nodemailer)
// Sin límites de templates ni de volumen mensual
// =========================================

import type { Handler } from '@netlify/functions';
import nodemailer from 'nodemailer';

// ── Estilos base compartidos ──────────────────────────────────────────────────
const BASE = `
  <div style="background:#f3f4f6;padding:32px 0;font-family:'Segoe UI',Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
`;
const CLOSE = `
      <div style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
        <p style="margin:0;color:#9ca3af;font-size:12px;">Equipo Therapheye</p>
        <a href="mailto:therapheye@gmail.com" style="color:#9ca3af;font-size:12px;text-decoration:none;">therapheye@gmail.com</a>
      </div>
    </div>
  </div>
`;

const header = (titulo: string, subtitulo: string) => `
  <div style="background:linear-gradient(135deg,#6366f1 0%,#4f46e5 100%);padding:36px 32px 28px;text-align:center;">
    <div style="font-size:40px;margin-bottom:12px;">👁️</div>
    <h1 style="margin:0 0 8px;color:#fff;font-size:24px;font-weight:700;">${titulo}</h1>
    <p style="margin:0;color:#c7d2fe;font-size:14px;">${subtitulo}</p>
  </div>
`;

const btn = (texto: string, url: string) => `
  <div style="text-align:center;margin:28px 0 8px;">
    <a href="${url}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;">
      ${texto} →
    </a>
  </div>
`;

const tip = (texto: string) => `
  <div style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:8px;padding:14px 16px;margin:20px 0;">
    <p style="margin:0;color:#15803d;font-size:13px;">💡 ${texto}</p>
  </div>
`;

const feature = (icon: string, texto: string) => `
  <div style="background:#f8fafc;border-radius:8px;padding:12px 16px;margin:8px 0;display:flex;align-items:center;gap:12px;">
    <span style="font-size:20px;">${icon}</span>
    <span style="color:#374151;font-size:14px;">${texto}</span>
  </div>
`;

// ── Templates ─────────────────────────────────────────────────────────────────

function templateVerificacion(nombre: string, codigo: string): string {
  return BASE + header('Verifica tu cuenta', 'Solo un paso más para comenzar') + `
    <div style="padding:28px 32px;">
      <p style="color:#374151;font-size:15px;margin:0 0 20px;">Hola <strong>${nombre}</strong>,</p>
      <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">Usa este código para verificar tu cuenta en Therapheye:</p>
      <div style="background:#eef2ff;border:2px dashed #6366f1;border-radius:12px;padding:20px;text-align:center;margin:0 0 24px;">
        <span style="font-size:36px;font-weight:800;letter-spacing:10px;color:#4f46e5;">${codigo}</span>
      </div>
      <p style="color:#9ca3af;font-size:12px;margin:0;">Este código expira en 10 minutos. Si no creaste una cuenta, ignora este correo.</p>
    </div>
  ` + CLOSE;
}

function templateBienvenida(nombre: string): string {
  return BASE + header('¡Bienvenido a Therapheye!', 'Tu cuenta ha sido verificada exitosamente ✅') + `
    <div style="padding:28px 32px;">
      <p style="color:#374151;font-size:15px;margin:0 0 8px;">¡Hola, <strong>${nombre}</strong>! 🚀</p>
      <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">Ya eres parte de <strong>Therapheye</strong>, el sistema inteligente para cuidar tu salud visual. Esto es lo que puedes hacer:</p>
      ${feature('📋', 'Cuestionarios de evaluación visual')}
      ${feature('💪', 'Ejercicios visuales personalizados')}
      ${feature('📊', 'Historial de evaluaciones')}
      ${feature('🔔', 'Seguimiento continuo de tu salud visual')}
      ${tip('Recuerda la regla 20-20-20: Cada 20 minutos, mira algo a 6 metros de distancia durante 20 segundos. ¡Tu vista te lo agradecerá!')}
      ${btn('Ir a Therapheye', 'https://therapheye.netlify.app')}
    </div>
  ` + CLOSE;
}

function templateEliminarCuenta(nombre: string, codigo: string): string {
  return BASE + header('Confirmación de eliminación', 'Acción irreversible — lee con atención') + `
    <div style="padding:28px 32px;">
      <p style="color:#374151;font-size:15px;margin:0 0 20px;">Hola <strong>${nombre}</strong>,</p>
      <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">Recibimos una solicitud para eliminar tu cuenta. Usa este código para confirmar:</p>
      <div style="background:#fef2f2;border:2px dashed #ef4444;border-radius:12px;padding:20px;text-align:center;margin:0 0 24px;">
        <span style="font-size:36px;font-weight:800;letter-spacing:10px;color:#dc2626;">${codigo}</span>
      </div>
      <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:8px;padding:14px 16px;margin:0 0 16px;">
        <p style="margin:0;color:#991b1b;font-size:13px;">⚠️ Esta acción eliminará permanentemente todos tus datos. Si no fuiste tú, ignora este correo.</p>
      </div>
    </div>
  ` + CLOSE;
}

function templateReporteSemanal(nombre: string, semana: string, ejercicios: number, racha: number, puntaje: string, resumen: string): string {
  return BASE + header('Tu resumen semanal', `Semana del ${semana}`) + `
    <div style="padding:28px 32px;">
      <p style="color:#374151;font-size:15px;margin:0 0 20px;">Hola <strong>${nombre}</strong>, aquí está tu progreso de esta semana:</p>
      <div style="display:grid;gap:12px;margin:0 0 20px;">
        <div style="background:#eef2ff;border-radius:10px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;">
          <span style="color:#4f46e5;font-size:14px;font-weight:600;">💪 Ejercicios completados</span>
          <span style="color:#4f46e5;font-size:22px;font-weight:800;">${ejercicios}</span>
        </div>
        <div style="background:#f0fdf4;border-radius:10px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;">
          <span style="color:#15803d;font-size:14px;font-weight:600;">🔥 Racha actual</span>
          <span style="color:#15803d;font-size:22px;font-weight:800;">${racha} días</span>
        </div>
        <div style="background:#fffbeb;border-radius:10px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;">
          <span style="color:#92400e;font-size:14px;font-weight:600;">⭐ Puntaje promedio</span>
          <span style="color:#92400e;font-size:22px;font-weight:800;">${puntaje}</span>
        </div>
      </div>
      <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 20px;">${resumen}</p>
      ${tip('Sigue así — la constancia es la clave para una mejor salud visual.')}
      ${btn('Ver mi progreso completo', 'https://therapheye.netlify.app')}
    </div>
  ` + CLOSE;
}

function templateResetPassword(nombre: string, url: string): string {
  return BASE + header('Restablecer contraseña', 'Recibimos una solicitud de cambio de contraseña') + `
    <div style="padding:28px 32px;">
      <p style="color:#374151;font-size:15px;margin:0 0 8px;">Hola <strong>${nombre}</strong>,</p>
      <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">Haz clic en el botón para crear una nueva contraseña. Este enlace expira en <strong>30 minutos</strong>.</p>
      ${btn('Restablecer mi contraseña', url)}
      <div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:8px;padding:14px 16px;margin:20px 0 0;">
        <p style="margin:0;color:#92400e;font-size:13px;">⚠️ Si no solicitaste este cambio, ignora este correo. Tu contraseña actual no se modificará.</p>
      </div>
    </div>
  ` + CLOSE;
}

function templateSoporteTecnico(nombre: string, email: string, transcript: string, fecha: string): string {
  return BASE + header('Nuevo mensaje de soporte', fecha) + `
    <div style="padding:28px 32px;">
      <div style="background:#f8fafc;border-radius:10px;padding:16px 20px;margin:0 0 20px;">
        <p style="margin:0 0 4px;color:#374151;font-size:14px;"><strong>Usuario:</strong> ${nombre}</p>
        <p style="margin:0;color:#6b7280;font-size:14px;"><strong>Email:</strong> ${email}</p>
      </div>
      <p style="color:#374151;font-size:14px;font-weight:600;margin:0 0 12px;">Transcript del chat:</p>
      <div style="background:#f1f5f9;border-radius:8px;padding:16px;max-height:400px;overflow-y:auto;">
        <pre style="margin:0;color:#374151;font-size:13px;white-space:pre-wrap;font-family:'Courier New',monospace;line-height:1.6;">${transcript}</pre>
      </div>
    </div>
  ` + CLOSE;
}

// ── Handler ───────────────────────────────────────────────────────────────────

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailPass) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Gmail credentials not configured' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { type, ...d } = body;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    });

    type MailOpts = { to: string; subject: string; html: string };
    let opts: MailOpts;

    switch (type) {
      case 'verificacion':
        opts = {
          to: d.email,
          subject: '🔐 Código de verificación — Therapheye',
          html: templateVerificacion(d.nombre, d.codigo),
        };
        break;
      case 'bienvenida':
        opts = {
          to: d.email,
          subject: '👁️ ¡Bienvenido a Therapheye!',
          html: templateBienvenida(d.nombre),
        };
        break;
      case 'eliminar':
        opts = {
          to: d.email,
          subject: '⚠️ Confirma la eliminación de tu cuenta — Therapheye',
          html: templateEliminarCuenta(d.nombre, d.codigo),
        };
        break;
      case 'reporte':
        opts = {
          to: d.email,
          subject: `📊 Tu resumen semanal — Therapheye`,
          html: templateReporteSemanal(d.nombre, d.semana, d.ejercicios, d.racha, d.puntaje_promedio, d.resumen),
        };
        break;
      case 'reset-password':
        opts = {
          to: d.email,
          subject: '🔑 Restablece tu contraseña — Therapheye',
          html: templateResetPassword(d.nombre, d.url),
        };
        break;
      case 'soporte':
        opts = {
          to: gmailUser,
          subject: `🆘 Soporte técnico — ${d.usuario_nombre}`,
          html: templateSoporteTecnico(d.usuario_nombre, d.usuario_email, d.transcript, d.fecha),
        };
        break;
      default:
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid email type' }) };
    }

    await transporter.sendMail({ from: `Therapheye <${gmailUser}>`, ...opts });
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e: any) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message || 'Send failed' }) };
  }
};

export { handler };
