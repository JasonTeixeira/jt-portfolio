import { isSuppressed } from './suppression-db.mjs';

const RESEND = 'https://api.resend.com';
const KEY = process.env.RESEND_API_KEY;
const TO = process.env.RESEND_TO || 'hello@sageideas.dev';
export function isEnabled() { return Boolean(KEY); }

// RESEND_FROM may be a bare address ("hello@sageideas.dev") OR already a full display
// header ("Jason Teixeira <hello@sageideas.dev>", as it is in prod). Only add a display
// name when it's a bare address — otherwise we'd double-wrap into
// "Name <Name <hello@…>>", which Resend rejects (422) and every email silently fails.
// (contact.js already guards this the same way; notify.mjs did not — that was the bug.)
// Reads env at call time so it can't be captured wrong at import.
export function fromHeader(name) {
  const from = process.env.RESEND_FROM || 'onboarding@resend.dev';
  return from.includes('<') ? from : `${name} <${from}>`;
}
// Cold OUTBOUND is sent from a SEPARATE authenticated domain/subdomain (OUTBOUND_FROM,
// e.g. "Jason Teixeira <jason@mail.sageideas.dev>") so that if cold volume ever trips a
// spam filter, it damages the outbound domain's reputation — NOT the primary domain that
// carries transactional mail (receipts, portal links, scoped plans). Falls back to
// RESEND_FROM if a dedicated outbound domain isn't configured yet. Read at call time.
export function outboundFromHeader(name) {
  const from = process.env.OUTBOUND_FROM || process.env.RESEND_FROM || 'onboarding@resend.dev';
  return from.includes('<') ? from : `${name} <${from}>`;
}
// True once a dedicated, distinct outbound domain is configured (not just the transactional
// one). The cron gates cold sequences on this so we never blast cold mail from the primary
// domain by accident.
export function outboundConfigured() {
  const ob = process.env.OUTBOUND_FROM;
  return Boolean(ob && ob !== process.env.RESEND_FROM);
}
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
  send({ from: fromHeader('Scope Studio'), to: [TO], subject, text, ...(html ? { html } : {}), ...(replyTo ? { reply_to: replyTo } : {}) });
// Client sends respect the suppression list: an address that hard-bounced or filed a
// spam complaint is skipped (returns {skipped, reason:'suppressed'}) so we never mail a
// dead/hostile inbox. isSuppressed() fails open, so a transient DB blip can't block mail.
export async function sendClient({ to, subject, text, html, replyTo, headers }) {
  if (await isSuppressed(to)) return { ok: false, skipped: true, reason: 'suppressed' };
  return send({ from: fromHeader('Jason Teixeira'), to: [to], reply_to: replyTo || TO, subject, text, ...(html ? { html } : {}), ...(headers ? { headers } : {}) });
}
// Cold outbound: same suppression discipline as sendClient, but from the outbound domain and
// with reply_to pointed at the real inbox so replies reach you regardless of sending domain.
export async function sendOutbound({ to, subject, text, html, replyTo, headers }) {
  if (await isSuppressed(to)) return { ok: false, skipped: true, reason: 'suppressed' };
  return send({ from: outboundFromHeader('Jason Teixeira'), to: [to], reply_to: replyTo || TO, subject, text, ...(html ? { html } : {}), ...(headers ? { headers } : {}) });
}
