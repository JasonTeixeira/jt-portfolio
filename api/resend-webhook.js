/**
 * /api/resend-webhook — Resend delivery events (Svix-signed). Feeds the suppression list
 * so a hard-bounced or spam-complained address stops receiving ALL mail, and alerts the
 * operator on a spam complaint (a real reputation risk). Verifies the Svix signature with
 * RESEND_WEBHOOK_SECRET before trusting anything; unsigned/mismatched → 400.
 *
 * Configure in Resend: add this URL as a webhook, subscribe to email.bounced +
 * email.complained (delivered/opened optional), paste the signing secret as
 * RESEND_WEBHOOK_SECRET (whsec_…).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { withObserve, captureError } from '../lib/observe.mjs';
import { suppress } from '../lib/suppression-db.mjs';
import { sendOperator } from '../lib/notify.mjs';

export const config = { api: { bodyParser: false } };

const SECRET = process.env.RESEND_WEBHOOK_SECRET || '';
const TOLERANCE_MS = 5 * 60 * 1000;

async function collectRaw(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

// Svix signature scheme (what Resend uses): base64( HMAC-SHA256( `${id}.${ts}.${body}`,
// base64decode(secret without 'whsec_') ) ), compared against any `v1,<sig>` in the
// svix-signature header, with a timestamp-tolerance check to stop replay. Pure + exported
// so the crypto path is unit-tested (a security check must be testable, not trusted).
export function verifySvix(secret, rawBody, headers, nowMs = Date.now()) {
  if (!secret) return false;
  const id = headers['svix-id'];
  const ts = headers['svix-timestamp'];
  const sigHeader = headers['svix-signature'];
  if (!id || !ts || !sigHeader) return false;
  const tsNum = Number(ts) * 1000;
  if (!Number.isFinite(tsNum) || Math.abs(nowMs - tsNum) > TOLERANCE_MS) return false;
  const key = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64');
  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
  const signed = `${id}.${ts}.${body}`;
  const expected = createHmac('sha256', key).update(signed).digest('base64');
  const expBuf = Buffer.from(expected);
  for (const part of String(sigHeader).split(' ')) {
    const [, sig] = part.split(',');
    if (!sig) continue;
    const got = Buffer.from(sig);
    if (got.length === expBuf.length && timingSafeEqual(got, expBuf)) return true;
  }
  return false;
}

export function recipients(data) {
  const to = data && data.to;
  if (Array.isArray(to)) return to.filter(Boolean);
  if (typeof to === 'string') return [to];
  return [];
}

// A soft/transient bounce (mailbox full, greylisting) is temporary — don't permanently
// suppress. Only Permanent/hard bounces mean the address is dead.
export function isHardBounce(data) {
  const b = (data && data.bounce) || {};
  const t = String(b.type || b.bounceType || '').toLowerCase();
  if (!t) return true; // unknown shape → treat as hard (Resend's default bounce event is hard)
  return t.includes('permanent') || t.includes('hard') || t.includes('undetermined');
}

async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  if (!SECRET) return res.status(200).json({ ok: false, skipped: true }); // not configured yet
  let raw;
  try { raw = await collectRaw(req); } catch { return res.status(400).json({ ok: false, error: 'bad body' }); }
  if (!verifySvix(SECRET, raw, req.headers)) return res.status(400).json({ ok: false, error: 'bad signature' });

  let event;
  try { event = JSON.parse(raw.toString('utf8')); } catch { return res.status(400).json({ ok: false, error: 'bad json' }); }

  try {
    const type = event && event.type;
    const data = (event && event.data) || {};
    if (type === 'email.bounced' && isHardBounce(data)) {
      for (const email of recipients(data)) {
        await suppress(email, 'bounce', { email_id: data.email_id || null, at: event.created_at || null });
      }
    } else if (type === 'email.complained') {
      const list = recipients(data);
      for (const email of list) await suppress(email, 'complaint', { email_id: data.email_id || null, at: event.created_at || null });
      // A spam complaint is a reputation event — the operator should see it.
      try {
        await sendOperator({ subject: 'Spam complaint on a sent email',
          text: `A recipient marked one of our emails as spam and has been suppressed.\nTo: ${list.join(', ') || '?'}\nSubject: ${data.subject || '?'}\n\nReview sending practices if this recurs.\n` });
      } catch (e) { console.error('[resend-webhook] complaint alert failed', (e && e.message) || e); }
    }
    return res.status(200).json({ ok: true, received: true });
  } catch (e) {
    console.error('[resend-webhook] handler error', event && event.type, e instanceof Error ? e.message : e);
    captureError(e, { route: '/api/resend-webhook', kind: 'resend_webhook_failed', eventType: event && event.type });
    return res.status(200).json({ ok: true, received: true }); // ack so Resend doesn't retry-storm on our bug
  }
}

export default withObserve('/api/resend-webhook', handler);
