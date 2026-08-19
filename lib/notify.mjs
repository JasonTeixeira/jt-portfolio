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
export const sendOperator = ({ subject, text }) =>
  send({ from: `Scope Studio <${FROM}>`, to: [TO], subject, text });
export const sendClient = ({ to, subject, text, replyTo }) =>
  send({ from: `Jason Teixeira <${FROM}>`, to: [to], reply_to: replyTo || TO, subject, text });
