import { withObserve } from '../lib/observe.mjs';
/**
 * /api/subscribe — field-notes email capture.
 * Notifies AUTHOR of each subscriber via Resend when RESEND_API_KEY is set;
 * otherwise 501 so the client shows the manual-subscribe fallback.
 */
import { rateLimited, clientIp } from '../lib/ratelimit.mjs';

const TO = 'hello@sageideas.dev';
const FROM = 'portfolio@agency.sageideas.dev';

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }
  const { email, website } = req.body ?? {};
  if (website) return res.status(200).json({ ok: true }); // honeypot
  // throttle: this hits the paid Resend API on every POST
  if (await rateLimited(clientIp(req), 10, 'subscribe')) return res.status(429).json({ ok: false, error: 'slow_down' });
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    return res.status(400).json({ ok: false, error: 'invalid email' });
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(501).json({ ok: false, error: 'not configured' });

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `Portfolio subscribe <${FROM}>`,
      to: [TO],
      subject: `New field-notes subscriber: ${email}`,
      text: `${email} subscribed via agency.sageideas.dev on ${new Date().toISOString()}`
    })
  });
  if (!r.ok) {
    console.error('resend failed', r.status);
    return res.status(502).json({ ok: false, error: 'delivery failed' });
  }
  return res.status(200).json({ ok: true });
}

export default withObserve('/api/subscribe', handler);
