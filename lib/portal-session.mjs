// Portal session — a short-lived, server-signed proof that the visitor entered the
// email address this magic-link was sent to. The portal_token stays the permanent
// project pointer; THIS is the thing that expires, so a leaked/forwarded link is
// useless past the session window without also knowing the client's email.
//
// Format: "<expMs>.<hmac>" where hmac = HMAC-SHA256(token + "." + expMs, KEY).
// KEY is a server-only secret (never shipped to the client). No DB row needed —
// verification is pure crypto, so it works on the stateless serverless path.
import { createHmac, timingSafeEqual } from 'node:crypto';

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const key = () => process.env.PORTAL_SESSION_SECRET || process.env.SCOPE_ADMIN_TOKEN || process.env.SUPABASE_SERVICE_KEY || '';

export function signSession(token) {
  const k = key();
  if (!k || !token) return null;
  const exp = Date.now() + TTL_MS;
  const mac = createHmac('sha256', k).update(`${token}.${exp}`).digest('base64url');
  return `${exp}.${mac}`;
}

export function verifySession(token, session) {
  const k = key();
  if (!k || !token || typeof session !== 'string') return false;
  const dot = session.indexOf('.');
  if (dot < 1) return false;
  const exp = Number(session.slice(0, dot));
  const mac = session.slice(dot + 1);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = createHmac('sha256', k).update(`${token}.${exp}`).digest('base64url');
  try {
    const a = Buffer.from(mac);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}

// Reveal just enough for the client to recognise the address without leaking it:
//   "jason@example.com" -> "j••••@example.com"
export function maskEmail(email) {
  if (typeof email !== 'string' || !email.includes('@')) return null;
  const [user, domain] = email.split('@');
  const head = user.slice(0, 1);
  return `${head}${'•'.repeat(Math.max(1, user.length - 1))}@${domain}`;
}

export const SESSION_TTL_MS = TTL_MS;
