/**
 * /api/sms — Twilio inbound-SMS webhook. THE real AI Front Desk over text.
 *
 * A customer texts the business's number → Twilio POSTs here → the grounded
 * receptionist brain replies (real SMS, via TwiML) → when it has enough to book,
 * it texts the OWNER a lead summary. This is the actual deliverable: point a
 * client's number at this URL + add their tenant config, and it's live for them.
 *
 * Config to go live (Vercel env): TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
 * TWILIO_FROM_NUMBER, FRONTDESK_DEMO_OWNER_PHONE, and the LLM_* vars.
 * Dormant/degrade-safe until then. Set ALLOW_UNSIGNED_WEBHOOKS=1 only for testing.
 */
import { withObserve } from '../lib/observe.mjs';
import { rateLimited, clientIp } from '../lib/ratelimit.mjs';
import { verifyTwilioSignature, sendSms, tidyPhone } from '../lib/sms.mjs';
import { resolveTenant } from '../lib/frontdesk-config.mjs';
import { getHistory, append, clear } from '../lib/frontdesk-session.mjs';
import { frontDeskReply } from '../lib/frontdesk-brain.mjs';

function xmlEscape(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}
function twiml(res, message) {
  res.setHeader('Content-Type', 'text/xml; charset=utf-8');
  const msg = message ? `<Message>${xmlEscape(message)}</Message>` : '';
  return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><Response>${msg}</Response>`);
}

async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }

  const b = req.body || {};
  const from = tidyPhone(b.From);
  const to = tidyPhone(b.To);
  const text = String(b.Body || '').slice(0, 800).trim();

  // Verify this really came from Twilio (unless explicitly allowed for testing).
  const url = `https://${req.headers['x-forwarded-host'] || req.headers.host || ''}${req.url}`;
  if (!verifyTwilioSignature(req.headers['x-twilio-signature'], url, b)) {
    return res.status(403).json({ ok: false, error: 'bad_signature' });
  }
  if (!from || !text) return twiml(res, '');

  // per-number throttle (a customer texting fast is fine; this blunts abuse)
  if (await rateLimited(from || clientIp(req), 12, 'sms')) {
    return twiml(res, 'One sec — got a lot coming in. Give me a moment and text again.');
  }

  const { tenant } = resolveTenant(to);
  const key = `sms:${from}`;
  const history = getHistory(key);

  const out = await frontDeskReply(tenant, history, text);
  append(key, 'user', text);
  append(key, 'assistant', out.reply);

  // Booked-enough: alert the owner with the lead, then reset the thread.
  if (out.done) {
    const L = out.lead || {};
    const summary = `New lead via AI Front Desk\n` +
      `Name: ${L.name || '(caller)'}\n` +
      `Phone: ${L.phone || from}\n` +
      `Job: ${L.issue || text.slice(0, 80)}\n` +
      `When: ${L.when || 'asap'}${L.urgent ? '  ⚠ URGENT' : ''}`;
    if (tenant.ownerPhone) sendSms({ to: tenant.ownerPhone, body: summary }).catch(() => {});
    console.log('[frontdesk] lead', JSON.stringify({ tenant: tenant.name, from, lead: L }));
    clear(key);
  }

  return twiml(res, out.reply);
}

export default withObserve('/api/sms', handler);
