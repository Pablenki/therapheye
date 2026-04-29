// =========================================
// Netlify Function: send-email
// Envía correos via Gmail SMTP (Nodemailer)
// Reemplaza templates de EmailJS que no caben en el tier gratuito
// =========================================

import type { Handler } from '@netlify/functions';
import nodemailer from 'nodemailer';

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
    const { type, ...data } = body;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    });

    let mailOptions: nodemailer.SendMailOptions;

    if (type === 'soporte') {
      mailOptions = {
        from: `Therapheye <${gmailUser}>`,
        to: gmailUser,
        subject: `Soporte técnico — ${data.usuario_nombre}`,
        html: `
          <h2>Nuevo mensaje de soporte</h2>
          <p><strong>Usuario:</strong> ${data.usuario_nombre} (${data.usuario_email})</p>
          <p><strong>Fecha:</strong> ${data.fecha}</p>
          <hr/>
          <h3>Transcript del chat:</h3>
          <pre style="background:#f5f5f5;padding:12px;border-radius:6px;white-space:pre-wrap;">${data.transcript}</pre>
        `,
      };
    } else if (type === 'reporte') {
      mailOptions = {
        from: `Therapheye <${gmailUser}>`,
        to: data.email,
        subject: `Tu resumen semanal — Therapheye`,
        html: `
          <div style="font-family:sans-serif;max-width:500px;margin:auto;">
            <h2 style="color:#6366f1;">Hola ${data.nombre} 👁️</h2>
            <p>Aquí está tu resumen de la semana <strong>${data.semana}</strong>:</p>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:8px;border-bottom:1px solid #eee;">Ejercicios completados</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;"><strong>${data.ejercicios}</strong></td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #eee;">Racha actual</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;"><strong>${data.racha} días</strong></td></tr>
              <tr><td style="padding:8px;">Puntaje promedio</td><td style="padding:8px;text-align:right;"><strong>${data.puntaje_promedio}</strong></td></tr>
            </table>
            <p style="margin-top:16px;">${data.resumen}</p>
            <p style="color:#999;font-size:12px;margin-top:24px;">Therapheye — Salud visual inteligente</p>
          </div>
        `,
      };
    } else {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid email type' }) };
    }

    await transporter.sendMail(mailOptions);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e: any) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message || 'Send failed' }) };
  }
};

export { handler };
