/**
 * /api/contact — Vercel serverless function.
 * Forwards contact-form submissions to AUTHOR's inbox via Resend when
 * RESEND_API_KEY is configured; otherwise returns 501 so the client falls
 * back to a prefilled mailto (the form never silently loses a lead).
 */
// Configurable via env so Resend works before/without domain verification:
// set RESEND_FROM='onboarding@resend.dev' to send immediately (delivers only to
// the account owner's verified email — fine, since TO is your own inbox), then
// switch to a verified-domain sender like portfolio@agency.sageideas.dev later.
import { rateLimited, clientIp } from '../lib/ratelimit.mjs';

const TO = process.env.RESEND_TO || 'hello@sageideas.dev';
const FROM = process.env.RESEND_FROM || 'portfolio@agency.sageideas.dev';
const MAX = { name: 200, email: 320, message: 5000, company: 300, stage: 40 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  const { name, email, message, website, company, stage } = req.body ?? {};

  // honeypot: bots fill every field — humans never see this one
  if (website) return res.status(200).json({ ok: true });

  // throttle: this hits the paid Resend API on every POST
  if (await rateLimited(clientIp(req), 10, 'contact')) return res.status(429).json({ ok: false, error: 'slow_down' });

  if (
    typeof name !== 'string' || !name.trim() || name.length > MAX.name ||
    typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > MAX.email ||
    typeof message !== 'string' || !message.trim() || message.length > MAX.message ||
    (company != null && (typeof company !== 'string' || company.length > MAX.company)) ||
    (stage != null && (typeof stage !== 'string' || stage.length > MAX.stage))
  ) {
    return res.status(400).json({ ok: false, error: 'invalid input' });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(501).json({ ok: false, error: 'mail delivery not configured' });

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `Portfolio contact <${FROM}>`,
      to: [TO],
      reply_to: email,
      subject: `Portfolio inquiry — ${name.trim().slice(0, 80)}`,
      text: `From: ${name.trim()} <${email}>\nCompany: ${(company || '—').toString().trim()}\nStage: ${(stage || '—').toString().trim()}\n\n${message.trim()}`
    })
  });

  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    console.error('resend failed', r.status, detail.slice(0, 500));
    return res.status(502).json({ ok: false, error: 'mail delivery failed' });
  }
  return res.status(200).json({ ok: true });
}
