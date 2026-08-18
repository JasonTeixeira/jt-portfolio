/**
 * /api/lead — lead-magnet capture for the sample eval report.
 *
 * On submit: (1) always emails YOU the new lead (works now via onboarding@
 * resend.dev → your account inbox), (2) adds the contact to a Resend Audience
 * if RESEND_AUDIENCE_ID is set (builds the owned list), (3) emails the visitor
 * the report + first nurture note IF a verified sending domain is configured
 * (RESEND_FROM is not the onboarding sender). The capture page reveals the
 * report link on success regardless, so the visitor always gets it instantly.
 *
 * Returns { ok: true } even if the notify email hiccups — capturing the lead
 * on-page must never fail because of a mail transport issue.
 */

const RESEND = 'https://api.resend.com';
const REPORT_URL = 'https://agency.sageideas.dev/sample-report.html';

const hits = new Map();
function throttled(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 10;
}

async function resend(path, key, body) {
  return fetch(`${RESEND}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  const { email, name, feature, website } = req.body ?? {};
  if (website) return res.status(200).json({ ok: true }); // honeypot

  const clean = typeof email === 'string' ? email.trim() : '';
  if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) || clean.length > 320) {
    return res.status(400).json({ ok: false, error: 'enter a valid email' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (throttled(ip)) return res.status(429).json({ ok: false, error: 'slow down' });

  const key = process.env.RESEND_API_KEY;
  // No key → still succeed on-page (the report link is revealed client-side);
  // the lead just isn't recorded. Never block the capture.
  if (!key) return res.status(200).json({ ok: true, report: REPORT_URL });

  const from = process.env.RESEND_FROM || 'onboarding@resend.dev';
  const notifyTo = process.env.RESEND_TO || 'hello@sageideas.dev';
  const nm = (typeof name === 'string' ? name.trim() : '').slice(0, 120) || '(no name)';
  const feat = (typeof feature === 'string' ? feature.trim() : '').slice(0, 500);

  // 1. Always notify you of the new lead.
  try {
    await resend('/emails', key, {
      from: `Lead magnet <${from}>`,
      to: [notifyTo],
      reply_to: clean,
      subject: `New sample-report lead — ${clean}`,
      text: `Email: ${clean}\nName: ${nm}\nFeature URL: ${feat || '(none given)'}\n\nThey grabbed the sample eval report. If they left a feature URL, run the eval CLI on it and send the real report as touch 1.`,
    });
  } catch (_) {}

  // 2. Build the owned list (optional audience).
  const audience = process.env.RESEND_AUDIENCE_ID;
  if (audience) {
    try { await resend(`/audiences/${audience}/contacts`, key, { email: clean, unsubscribed: false }); } catch (_) {}
  }

  // 3. Email the visitor the report — only if a verified domain sender is set
  //    (onboarding@resend.dev can only send to your own inbox).
  if (from.indexOf('resend.dev') === -1) {
    try {
      await resend('/emails', key, {
        from: `Jason Teixeira <${from}>`,
        to: [clean],
        subject: 'Your sample AI evaluation report',
        text: `Hi${nm !== '(no name)' ? ' ' + nm : ''} —\n\nHere's the sample eval report — the exact format and rigor I'd send you, on a fictional target so you can see the method: ${REPORT_URL}\n\nI test and prove AI features for teams shipping LLM products. If you want this run on YOUR live feature for real — verbatim transcripts, no cherry-picking — reply with the feature URL and I'll send you the findings, free. No call required.\n\n— Jason\nagency.sageideas.dev`,
      });
    } catch (_) {}
  }

  return res.status(200).json({ ok: true, report: REPORT_URL });
}
