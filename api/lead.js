/**
 * /api/lead — lead-magnet capture for the sample eval report, and the
 * general lead-capture endpoint for the Atlas chat + Scope Studio handoffs.
 *
 * On submit: (1) always emails YOU the new lead (works now via onboarding@
 * resend.dev → your account inbox), (2) adds the contact to a Resend Audience
 * if RESEND_AUDIENCE_ID is set (builds the owned list), (3) emails the visitor
 * the report + first nurture note IF a verified sending domain is configured
 * (RESEND_FROM is not the onboarding sender). The capture page reveals the
 * report link on success regardless, so the visitor always gets it instantly.
 *
 * Optionally also accepts { prospectId, plan } from a Scope Studio session
 * (see assets/scope-studio.mjs, lib/scope-db.mjs). When Supabase is enabled
 * and a prospectId is present, this links the lead's email to that prospect
 * record, marks it 'engaged', and appends a lead_captured event, and folds
 * the scoped plan into the operator notify email. All of that is guarded by
 * isEnabled() and wrapped so a persistence hiccup can never break the lead
 * capture itself.
 *
 * Returns { ok: true } even if the notify email or the DB write hiccups —
 * capturing the lead on-page must never fail because of a downstream issue.
 */

import { isEnabled, upsertProspect, appendEvent } from '../lib/scope-db.mjs';
import { rateLimited, clientIp } from '../lib/ratelimit.mjs';
import { withObserve } from '../lib/observe.mjs';

const RESEND = 'https://api.resend.com';
const REPORT_URL = 'https://agency.sageideas.dev/sample-report.html';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


async function resend(path, key, body) {
  return fetch(`${RESEND}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * Pure request-body validator — no I/O, safe to unit test directly.
 * `email` is required (same rule as before); `prospectId` and `plan` are
 * optional additions for the Scope Studio handoff.
 */
export function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'bad_request' };
  }
  const { email, prospectId, plan } = body;

  const clean = typeof email === 'string' ? email.trim() : '';
  if (!clean || !EMAIL_RE.test(clean) || clean.length > 320) {
    return { ok: false, error: 'enter a valid email' };
  }
  if (prospectId !== undefined && prospectId !== null &&
      (typeof prospectId !== 'string' || !prospectId.trim())) {
    return { ok: false, error: 'invalid prospectId' };
  }
  if (plan !== undefined && plan !== null &&
      (typeof plan !== 'object' || Array.isArray(plan))) {
    return { ok: false, error: 'invalid plan' };
  }

  return { ok: true };
}

/** Short "Scoped plan —" block folded into the operator notify email, or '' if no plan. */
function planSummaryText(plan) {
  if (!plan || typeof plan !== 'object') return '';
  const lines = [];
  if (typeof plan.segment === 'string' && plan.segment) lines.push(`Segment: ${plan.segment}`);
  if (Array.isArray(plan.keys) && plan.keys.length) lines.push(`Scope: ${plan.keys.join(', ')}`);
  if (Array.isArray(plan.total) && plan.total.length === 2 &&
      Number.isFinite(plan.total[0]) && Number.isFinite(plan.total[1])) {
    lines.push(`Indicative total: $${plan.total[0]}–$${plan.total[1]}`);
  }
  return lines.length ? `\n\nScoped plan —\n${lines.join('\n')}` : '';
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  const { name, feature, website } = req.body ?? {};
  if (website) return res.status(200).json({ ok: true }); // honeypot

  const check = validate(req.body ?? {});
  if (!check.ok) {
    return res.status(400).json({ ok: false, error: check.error });
  }
  const { email, prospectId, plan } = req.body;
  const clean = email.trim();

  const ip = clientIp(req);
  if (await rateLimited(ip, 10, 'lead')) return res.status(429).json({ ok: false, error: 'slow down' });

  // Link the lead to its Scope Studio prospect record, if any. Independent of
  // the Resend key below — never allowed to affect the { ok: true } response.
  if (isEnabled() && typeof prospectId === 'string' && prospectId.trim()) {
    try {
      const row = { id: prospectId.trim(), email: clean, stage: 'engaged' };
      if (plan && typeof plan.segment === 'string' && plan.segment) row.segment = plan.segment;
      await upsertProspect(row);
      await appendEvent({
        prospect_id: prospectId.trim(),
        type: 'lead_captured',
        meta: plan && Array.isArray(plan.total) ? { total: plan.total } : {},
      });
    } catch (err) {
      console.error('[lead] prospect link error', err instanceof Error ? err.message : err);
    }
  }

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
      text: `Email: ${clean}\nName: ${nm}\nFeature URL: ${feat || '(none given)'}\n\nThey grabbed the sample eval report. If they left a feature URL, run the eval CLI on it and send the real report as touch 1.${planSummaryText(plan)}`,
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

export default withObserve('/api/lead', handler);
