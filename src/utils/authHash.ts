// =========================================
// AUTH HASH CLIENT — Therapheye
// Usa el proxy serverless en producción,
// fallback a bcryptjs directo en desarrollo
// =========================================

const PROXY_URL = '/.netlify/functions/auth-hash';

export async function hashPassword(password: string): Promise<string> {
  if (import.meta.env.DEV) {
    const bcrypt = await import('bcryptjs');
    const salt = await bcrypt.default.genSalt(10);
    return bcrypt.default.hash(password, salt);
  }

  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'hash', password }),
  });
  if (!res.ok) throw new Error(`Hash failed: ${res.status}`);
  const data = await res.json();
  return data.hash;
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  if (import.meta.env.DEV) {
    const bcrypt = await import('bcryptjs');
    return bcrypt.default.compare(password, hash);
  }

  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'compare', password, hash }),
  });
  if (!res.ok) throw new Error(`Compare failed: ${res.status}`);
  const data = await res.json();
  return data.match;
}
