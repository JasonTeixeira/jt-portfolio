/**
 * sms.mjs — send SMS + verify inbound webhooks. Twilio first (best trial/docs);
 * Telnyx is a later cost swap behind the same two functions.
 *
 * Dormant-safe: without creds, sendSms() no-ops and returns {ok:false,reason}.
 * Never throws into a request path.
 */
import crypto from 'node:crypto';

const TWILIO_BASE = 'https://api.twilio.com/2010-04-01';

export function smsEnabled() {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}

/**
 * Send an SMS via Twilio. Fire-safe: returns a result, never throws.
 * @param {{to:string, body:string, from?:string}} m
 */
export async function sendSms({ to, body, from }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const fromNum = from || process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !fromNum) return { ok: false, reason: 'sms_not_configured' };
  if (!to || !body) return { ok: false, reason: 'missing_to_or_body' };

  const params = new URLSearchParams({ To: to, From: fromNum, Body: body.slice(0, 1500) });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`${TWILIO_BASE}/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      return { ok: false, reason: `twilio_${r.status}`, detail: txt.slice(0, 200) };
    }
    const d = await r.json().catch(() => ({}));
    return { ok: true, sid: d.sid };
  } catch (err) {
    return { ok: false, reason: err && err.name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Verify an inbound Twilio webhook signature so nobody can spoof fake texts/calls.
 * Twilio signs: HMAC-SHA1( fullUrl + sorted(key+value...) , authToken ) → base64.
 * Returns true if valid. If ALLOW_UNSIGNED_WEBHOOKS=1 (local/testing), returns true.
 * @param {string} signature - X-Twilio-Signature header
 * @param {string} url - the exact public URL Twilio POSTed to
 * @param {Record<string,string>} params - the POST body params
 */
export function verifyTwilioSignature(signature, url, params) {
  // Escape hatch for LOCAL/preview testing only — HARD-gated so it can never
  // silently disable auth in production even if the env var leaks into prod.
  if (process.env.ALLOW_UNSIGNED_WEBHOOKS === '1' && process.env.VERCEL_ENV !== 'production') return true;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || !signature || !url) return false;
  const sorted = Object.keys(params || {}).sort();
  let data = url;
  for (const k of sorted) data += k + (params[k] == null ? '' : params[k]);
  const expected = crypto.createHmac('sha1', token).update(Buffer.from(data, 'utf-8')).digest('base64');
  // constant-time compare
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Best-effort E.164-ish tidy for display/storage. */
export function tidyPhone(n) { return String(n || '').replace(/[^\d+]/g, '').slice(0, 20); }
