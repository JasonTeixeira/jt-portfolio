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
import { sendClient, sendOperator, isEnabled as mailEnabled } from '../lib/notify.mjs';
import { resetEmail, confirmEmail } from '../lib/email-templates.mjs';

const SUPA = process.env.SUPABASE_URL;
const SKEY = process.env.SUPABASE_SERVICE_KEY;
const SITE = process.env.SITE_URL || 'https://agency.sageideas.dev';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TYPES = { signup: 'signup', recovery: 'recovery' };
const FLOOR_MS = 650; // constant-time floor: hide the exists-vs-not timing difference
function allowedType(t) { return Object.prototype.hasOwnProperty.call(TYPES, t) ? TYPES[t] : null; }
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

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
      // redirect_to MUST be top-level for the raw GoTrue admin endpoint — nesting it under
      // `options` (the supabase-js SDK shape) makes GoTrue silently ignore it and fall back
      // to the Site URL, so the reset link never lands on reset.html. Verified against prod.
      body: JSON.stringify({ type, email, redirect_to }),
    });
    if (!r.ok) return done(); // no such user / already confirmed → stay generic (no email)
    const data = await r.json().catch(() => null);
    const link = data && (data.action_link || (data.properties && data.properties.action_link));
    if (!link) return done();
    const mail = type === 'recovery' ? resetEmail({ link }) : confirmEmail({ link });
    const sent = await sendClient({ to: email, subject: mail.subject, text: mail.text, html: mail.html });
    // Client always gets a generic 200 (anti-enumeration), but a REAL delivery failure —
    // not "suppressed" and not "unconfigured" — means a user who exists can't reset. That
    // must not vanish into console logs, so alert the operator.
    if (sent && sent.ok === false && !sent.skipped) {
      try {
        await sendOperator({ subject: `Auth email FAILED to send (${type})`,
          text: `A ${type} email could not be delivered to a real account.\nError: ${sent.error || 'unknown'}\n\nThe user saw a generic success message and may be stuck — follow up or check Resend.\n` });
      } catch (e) { console.error('[auth-email] operator alert failed', (e && e.message) || e); }
    }
    return done();
  } catch (e) {
    console.error('[auth-email]', (e && e.message) || e);
    return done();
  }
}

export default withObserve('/api/auth-email', handler);
