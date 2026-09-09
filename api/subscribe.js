import { withObserve } from '../lib/observe.mjs';
/**
 * /api/subscribe — field-notes email capture.
 * Persists the subscriber to the CRM (degrade-safe), adds them to the Resend
 * audience when RESEND_AUDIENCE_ID is set, and notifies the author via Resend.
 * Returns 200 if the subscriber was captured OR emailed; 501 only when neither
 * the DB nor Resend is configured, so the client shows the manual fallback and
 * a subscriber is never silently lost.
 */
import { rateLimited, clientIp } from '../lib/ratelimit.mjs';
import { captureInboundLead, isEnabled as dbEnabled } from '../lib/scope-db.mjs';

const TO = process.env.RESEND_TO || 'hello@sageideas.dev';
const FROM = process.env.RESEND_FROM || 'portfolio@agency.sageideas.dev';

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }
  const { email, website } = req.body ?? {};
  if (website) return res.status(200).json({ ok: true }); // honeypot
  // throttle: this can hit the paid Resend API on every POST
  if (await rateLimited(clientIp(req), 10, 'subscribe')) return res.status(429).json({ ok: false, error: 'slow_down' });
  if (typeof email !== 'string' || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'invalid email' });
  }
  const clean = email.trim().toLowerCase();

  // 1) Persist first so the subscriber survives even if email delivery is off/fails.
  //    captureInboundLead is guarded (never throws); race a timeout so a slow DB
  //    can't hang the request.
  const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r({ ok: false, error: 'timeout' }), ms))]);
  let captured = false;
  if (dbEnabled()) {
    const cap = await withTimeout(
      captureInboundLead({ email: clean, source: 'newsletter', note: 'field-notes subscribe', stage: 'subscriber' }),
      4000
    );
    captured = Boolean(cap && cap.ok);
  }

  // 2) Email delivery (author notice + owned-list audience) when Resend is set.
  const key = process.env.RESEND_API_KEY;
  let emailed = false;
  if (key) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `Portfolio subscribe <${FROM}>`,
          to: [TO],
          reply_to: clean,
          subject: `New field-notes subscriber: ${clean}`,
          text: `${clean} subscribed via agency.sageideas.dev on ${new Date().toISOString()}`
        })
      });
      emailed = r.ok;
      if (!r.ok) console.error('resend failed', r.status);
    } catch (e) { console.error('resend threw', (e && e.message) || e); }

    // Add to the owned Resend audience (best-effort) so the list is portable.
    const audience = process.env.RESEND_AUDIENCE_ID;
    if (audience) {
      try {
        await fetch(`https://api.resend.com/audiences/${audience}/contacts`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: clean, unsubscribed: false })
        });
      } catch (_) { /* non-fatal */ }
    }
  }

  if (!captured && !emailed) {
    // Nothing is configured to receive this subscriber → let the client fall back.
    if (!key && !dbEnabled()) return res.status(501).json({ ok: false, error: 'not configured' });
    return res.status(502).json({ ok: false, error: 'delivery failed' });
  }
  return res.status(200).json({ ok: true });
}

export default withObserve('/api/subscribe', handler);
