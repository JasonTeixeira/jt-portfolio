/**
 * /api/voice — Twilio inbound-CALL webhook. The real "missed-call text-back":
 * someone calls the number, hears a short friendly greeting, and immediately
 * gets a REAL text that starts the AI booking conversation (handled by /api/sms).
 *
 * That's the live demo you send prospects: "call this number, watch it text you."
 * And it's the deliverable — a client forwards their missed/after-hours calls here.
 *
 * Config: same Twilio + LLM env as /api/sms. Dormant/degrade-safe until set.
 */
import { withObserve } from '../lib/observe.mjs';
import { verifyTwilioSignature, sendSms, tidyPhone } from '../lib/sms.mjs';
import { resolveTenant } from '../lib/frontdesk-config.mjs';
import { append, clear } from '../lib/frontdesk-session.mjs';

function xmlEscape(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }

  const b = req.body || {};
  const from = tidyPhone(b.From);
  const to = tidyPhone(b.To);

  const url = `https://${req.headers['x-forwarded-host'] || req.headers.host || ''}${req.url}`;
  if (!verifyTwilioSignature(req.headers['x-twilio-signature'], url, b)) {
    return res.status(403).json({ ok: false, error: 'bad_signature' });
  }

  const { tenant } = resolveTenant(to);
  const greet = `Thanks for calling ${tenant.name}. Sorry we couldn't grab your call — we're texting you right now so we can help and get you booked. Talk soon!`;

  // fire the text-back that starts the SMS AI conversation, and seed the thread
  if (from) {
    const opener = `Hi! Thanks for calling ${tenant.name} — sorry we missed you. What can we help you with? I can get you booked right now. 👋`;
    const key = `sms:${from}`;
    clear(key);
    append(key, 'assistant', opener);
    sendSms({ to: from, body: opener }).catch(() => {});
  }

  res.setHeader('Content-Type', 'text/xml; charset=utf-8');
  return res.status(200).send(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">${xmlEscape(greet)}</Say><Hangup/></Response>`
  );
}

export default withObserve('/api/voice', handler);
