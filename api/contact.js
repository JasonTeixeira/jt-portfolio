import { withObserve } from '../lib/observe.mjs';
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
import { captureInboundLead } from '../lib/scope-db.mjs';

const TO = process.env.RESEND_TO || 'hello@sageideas.dev';
const FROM = process.env.RESEND_FROM || 'portfolio@agency.sageideas.dev';
const MAX = { name: 200, email: 320, message: 5000, company: 300, stage: 40 };

async function handler(req, res) {
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

  // Persist to the CRM FIRST so an inbound lead is never dropped — even if email
  // delivery isn't configured or fails. captureInboundLead is degrade-safe (guarded).
  // Timeout-guard it so a slow Supabase round-trip can't hold this public endpoint open.
  const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r({ ok: false, error: 'timeout' }), ms))]);
  const cap = await withTimeout(captureInboundLead({ email, name, company, source: 'contact_form', note: message, stage: 'engaged' }), 4000);
  if (!cap || (!cap.ok && !cap.skipped)) console.error('[contact] crm capture failed', (cap && cap.error) || 'unknown');

  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(501).json({ ok: false, error: 'mail delivery not configured' });

  // RESEND_FROM may already be a full "Name <email>" (as in prod) — don't double-wrap
  // it into `Portfolio contact <Name <email>>`, which Resend rejects (the 502 that was
  // silently dropping operator notifications). Wrap only a bare address.
  const fromHeader = FROM.includes('<') ? FROM : `Portfolio contact <${FROM}>`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromHeader,
      to: [TO],
      reply_to: email,
      subject: `Portfolio inquiry — ${name.trim().replace(/\s+/g, ' ').slice(0, 80)}`,
      text: `From: ${name.trim()} <${email}>\nCompany: ${(company || '—').toString().trim()}\nStage: ${(stage || '—').toString().trim()}\n\n${message.trim()}`
    })
  });

  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    console.error('resend failed', r.status, detail.slice(0, 500));
    return res.status(502).json({ ok: false, error: 'mail delivery failed' });
  }

  // Instant auto-response to the LEAD — reply in seconds while they're hot, with a booking link.
  // SECURITY: only send to a POSITIVELY-CONFIRMED first-time email (existed === false). The rate
  // limit is per-IP, which can't stop an attacker from email-bombing / phishing-relaying a third
  // party via our verified domain; gating on a first-seen recipient caps the auto-reply to one
  // per address. If the CRM is unavailable (existed unknown), we skip the auto-reply — safe default.
  const isNewLead = !!(cap && cap.ok && cap.data && cap.data.existed === false);
  if (isNewLead) try {
    const SITE = (process.env.SITE_URL || 'https://agency.sageideas.dev').replace(/\/$/, '');
    const first = name.trim().split(/\s+/)[0].replace(/[<>]/g, '');
    const book = `${SITE}/book.html`;
    const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:8px;color:#1a1a1a">`
      + `<div style="font-family:ui-monospace,Menlo,monospace;font-size:13px;color:#0a7f5f;font-weight:700">jason.teixeira()</div>`
      + `<h1 style="font-size:22px;line-height:1.25;margin:16px 0 8px;color:#111">Thanks, ${first} — I've got your message.</h1>`
      + `<p style="font-size:15px;line-height:1.65;color:#444;margin:0 0 18px">A real person (me) reads every one and replies within one business day. If you'd rather not wait, grab a time and we'll talk it through live:</p>`
      + `<p style="margin:0 0 22px"><a href="${book}" style="background:#0a7f5f;color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block">Book a 15-minute intro →</a></p>`
      + `<p style="font-size:14px;line-height:1.65;color:#444;margin:0 0 20px">Everything I build is designed to be provable — no "trust me," just receipts. You can see them at <a href="${SITE}" style="color:#0a7f5f">agency.sageideas.dev</a>.</p>`
      + `<p style="font-size:14px;color:#444;margin:0">— Jason<br><span style="color:#888;font-size:13px">Sage Ideas LLC · Orlando, FL</span></p></div>`;
    const text = `Thanks, ${first} — I've got your message.\n\nA real person (me) reads every one and replies within one business day. If you'd rather not wait, book a 15-minute intro here:\n${book}\n\nEverything I build is designed to be provable — see the receipts at ${SITE}.\n\n— Jason\nSage Ideas LLC · Orlando, FL`;
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromHeader, to: [email], reply_to: TO, subject: `Thanks ${first} — I got your message (and here's how to skip the wait)`, html, text }),
    });
  } catch (e) { console.error('[contact] auto-reply failed', (e && e.message) || e); }

  return res.status(200).json({ ok: true });
}

export default withObserve('/api/contact', handler);
