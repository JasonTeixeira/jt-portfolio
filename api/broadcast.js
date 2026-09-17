/**
 * /api/broadcast — send a newsletter broadcast to field-notes subscribers (admin-gated).
 *   GET  → { subscribers } preview count before you send.
 *   POST { subject, heading, bodyText, ctaLabel?, ctaUrl?, test?: true } →
 *         test:true sends ONE preview to the operator (RESEND_TO) and records nothing.
 *         otherwise sends to every active subscriber, once each (deduped), with a
 *         per-recipient unsubscribe link + List-Unsubscribe header, and records each send.
 *
 * Reuses the existing email + suppression + unsubscribe-token infrastructure, so a
 * suppressed or opted-out address is never mailed. Capped per invocation so a large list
 * cannot time out the function.
 */
import { withObserve } from '../lib/observe.mjs';
import { rateLimited, clientIp } from '../lib/ratelimit.mjs';
import { authorizeAdmin, adminActor } from '../lib/admin-auth.mjs';
import { sendClient } from '../lib/notify.mjs';
import { broadcastEmail } from '../lib/email-templates.mjs';
import { logAudit } from '../lib/audit-db.mjs';
import {
  isEnabled, newsletterSubscribers, subscriberCount, createBroadcast,
  recordSend, alreadySentEmails, markBroadcastSent, ensureUnsubToken,
} from '../lib/broadcast-db.mjs';

const SITE = process.env.SITE_URL || 'https://agency.sageideas.dev';
const MAX_PER_RUN = 500; // serverless-safe ceiling; larger lists need a paginated resend
const unsubUrl = (token) => `${SITE}/api/unsubscribe?token=${encodeURIComponent(token)}`;

async function handler(req, res) {
  if (await rateLimited(clientIp(req), 30, 'admin')) return res.status(429).json({ ok: false, error: 'slow_down' });
  if (!(await authorizeAdmin(req))) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true, reason: 'not_configured', subscribers: 0 });

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, subscribers: await subscriberCount() });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const heading = typeof body.heading === 'string' && body.heading.trim() ? body.heading.trim() : subject;
    const bodyText = typeof body.bodyText === 'string' ? body.bodyText.trim() : '';
    const ctaLabel = typeof body.ctaLabel === 'string' ? body.ctaLabel.trim().slice(0, 40) : '';
    const ctaUrl = typeof body.ctaUrl === 'string' && /^https?:\/\//i.test(body.ctaUrl) ? body.ctaUrl.trim() : '';
    if (!subject || !bodyText) return res.status(400).json({ ok: false, error: 'subject and bodyText required' });
    if (subject.length > 160 || bodyText.length > 20000) return res.status(400).json({ ok: false, error: 'too long' });

    // Test send: one email to the operator inbox, nothing recorded, no subscriber touched.
    if (body.test) {
      const to = process.env.RESEND_TO || process.env.ADMIN_EMAILS?.split(',')[0];
      if (!to) return res.status(400).json({ ok: false, error: 'no_test_recipient' });
      const mail = broadcastEmail({ subject: `[TEST] ${subject}`, heading, bodyText, ctaLabel, ctaUrl, unsubscribeUrl: unsubUrl('test-token') });
      const r = await sendClient({ to, subject: mail.subject, text: mail.text, html: mail.html, headers: mail.headers });
      return res.status(200).json({ ok: r.ok, test: true, to });
    }

    const subsR = await newsletterSubscribers();
    if (!subsR.ok) return res.status(502).json({ ok: false, error: 'list_unavailable' });
    const subs = subsR.data;
    if (!subs.length) return res.status(200).json({ ok: true, sent: 0, subscribers: 0, note: 'no active subscribers' });

    const bc = await createBroadcast({ subject, heading, recipientCount: subs.length });
    if (!bc.ok || !bc.data) return res.status(502).json({ ok: false, error: 'broadcast_create_failed' });
    const broadcastId = bc.data.id;
    const doneR = await alreadySentEmails(broadcastId);
    const done = doneR.ok ? doneR.data : new Set();

    let sent = 0, skipped = 0, failed = 0;
    for (const s of subs.slice(0, MAX_PER_RUN)) {
      if (done.has(s.email)) { skipped++; continue; }
      try {
        const token = await ensureUnsubToken(s.id, s.unsubscribe_token);
        const mail = broadcastEmail({ subject, heading, bodyText, ctaLabel, ctaUrl, unsubscribeUrl: unsubUrl(token) });
        const r = await sendClient({ to: s.email, subject: mail.subject, text: mail.text, html: mail.html, headers: mail.headers });
        if (r.ok) { await recordSend(broadcastId, s.email); sent++; }
        else if (r.skipped) { skipped++; } // suppressed / opted out
        else { failed++; }
      } catch { failed++; }
    }
    await markBroadcastSent(broadcastId, sent);
    logAudit({ actor: adminActor(req), action: 'broadcast_sent', targetType: 'broadcast', targetId: broadcastId, meta: { subject, sent, skipped, failed, recipients: subs.length } });
    const capped = subs.length > MAX_PER_RUN;
    return res.status(200).json({ ok: true, broadcastId, sent, skipped, failed, subscribers: subs.length, capped });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'method not allowed' });
}

export default withObserve('/api/broadcast', handler);
