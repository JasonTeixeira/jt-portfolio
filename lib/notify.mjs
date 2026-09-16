import { isSuppressed } from './suppression-db.mjs';

const RESEND = 'https://api.resend.com';
const KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM || 'onboarding@resend.dev';
const TO = process.env.RESEND_TO || 'hello@sageideas.dev';
export function isEnabled() { return Boolean(KEY); }
async function send(body) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const r = await fetch(`${RESEND}/emails`, { method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body) });
    return r.ok ? { ok: true } : { ok: false, error: `resend_${r.status}` };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}
export const sendOperator = ({ subject, text, html, replyTo }) =>
  send({ from: `Scope Studio <${FROM}>`, to: [TO], subject, text, ...(html ? { html } : {}), ...(replyTo ? { reply_to: replyTo } : {}) });
// Client sends respect the suppression list: an address that hard-bounced or filed a
// spam complaint is skipped (returns {skipped, reason:'suppressed'}) so we never mail a
// dead/hostile inbox. isSuppressed() fails open, so a transient DB blip can't block mail.
export async function sendClient({ to, subject, text, html, replyTo, headers }) {
  if (await isSuppressed(to)) return { ok: false, skipped: true, reason: 'suppressed' };
  return send({ from: `Jason Teixeira <${FROM}>`, to: [to], reply_to: replyTo || TO, subject, text, ...(html ? { html } : {}), ...(headers ? { headers } : {}) });
}
