/**
 * /api/auth-email — sends signup-confirmation and password-reset emails through
 * Resend (which works) instead of Supabase's built-in mailer (which needs SMTP wired).
 *
 *   POST { email, type: 'signup' | 'recovery' }
 *
 * We mint the action link server-side via Supabase admin generate_link (no email sent
 * by Supabase), then deliver it ourselves via Resend. Always answers 200 generically so
 * it never reveals whether an account exists. Strictly rate-limited (it emails a
 * user-supplied address — a classic forgot-password abuse surface).
 */
import { rateLimited, clientIp } from '../lib/ratelimit.mjs';
import { withObserve } from '../lib/observe.mjs';
import { sendClient, isEnabled as mailEnabled } from '../lib/notify.mjs';

const SUPA = process.env.SUPABASE_URL;
const SKEY = process.env.SUPABASE_SERVICE_KEY;
const SITE = process.env.SITE_URL || 'https://agency.sageideas.dev';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TYPES = { signup: 'signup', recovery: 'recovery' };
const FLOOR_MS = 650; // constant-time floor: hide the exists-vs-not timing difference
function allowedType(t) { return Object.prototype.hasOwnProperty.call(TYPES, t) ? TYPES[t] : null; }
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

const COPY = {
  signup: {
    subject: 'Confirm your account · Sage Ideas',
    intro: 'Welcome — confirm your email to activate your account and open your project portal. This link expires shortly and can be used once.',
    cta: 'Confirm your account:',
  },
  recovery: {
    subject: 'Reset your password · Sage Ideas',
    intro: 'Use the secure link below to set a new password. It expires shortly and can be used once.',
    cta: 'Reset your password:',
  },
};

async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  const t0 = Date.now();
  // Constant-time floor on every account-relevant answer so the response time can't
  // distinguish "account exists" (extra Resend call) from "doesn't exist".
  const done = async () => { const dt = Date.now() - t0; if (dt < FLOOR_MS) await sleep(FLOOR_MS - dt); return res.status(200).json({ ok: true }); };

  // Strict per-IP limit — this triggers an email to a user-supplied address.
  if (await rateLimited(clientIp(req), 5, 'auth-email')) return res.status(429).json({ ok: false, error: 'slow_down' });

  const body = req.body || {};
  const email = String(body.email || '').trim().toLowerCase();
  const type = allowedType(String(body.type || ''));

  if (!EMAIL_RE.test(email) || email.length > 320 || !type) return done();
  if (!SUPA || !SKEY || !mailEnabled()) return done();
  // Second, target-keyed limit: hard-caps email-bombing / phantom-signup abuse to a
  // few per address regardless of IP rotation or serverless cold-start resets. Silent
  // drop (generic 200) so the limit itself isn't an enumeration signal.
  if (await rateLimited(`tgt:${email}`, 3, 'auth-email-target')) return done();

  try {
    const redirect_to = type === 'recovery' ? `${SITE}/reset.html` : `${SITE}/login.html`;
    const r = await fetch(`${SUPA}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, email, options: { redirect_to } }),
    });
    if (!r.ok) return done(); // no such user / already confirmed → stay generic (no email)
    const data = await r.json().catch(() => null);
    const link = data && (data.action_link || (data.properties && data.properties.action_link));
    if (!link) return done();
    const c = COPY[type];
    await sendClient({ to: email, subject: c.subject,
      text: `${c.intro}\n\n${c.cta}\n${link}\n\nIf you didn’t request this, you can safely ignore this email.\n\n— Jason · Sage Ideas` });
    return done();
  } catch (e) {
    console.error('[auth-email]', (e && e.message) || e);
    return done();
  }
}

export default withObserve('/api/auth-email', handler);
