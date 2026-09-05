import { withObserve } from '../../lib/observe.mjs';
import { timingSafeEqual } from 'node:crypto';
import * as db from '../../lib/nurture-db.mjs';
import { sendClient, sendOperator } from '../../lib/notify.mjs';
import {
  SEND_CAP, STEP, isSendable, leadDue, dueStepForProposal,
  leadEmail, unpaidEmail, expiringEmail, listUnsubHeaders,
} from '../../assets/nurture-core.mjs';
const SITE = process.env.SITE_URL || 'https://agency.sageideas.dev';
const CRON = process.env.CRON_SECRET;

export function authorized(req) {
  if (!CRON) return false; // fail closed
  const got = String((req.headers && req.headers.authorization) || '');
  const want = `Bearer ${CRON}`;
  if (got.length !== want.length) return false;
  try { return timingSafeEqual(Buffer.from(got), Buffer.from(want)); } catch { return false; }
}
function unsubUrl(token) { return `${SITE}/api/unsubscribe?token=${encodeURIComponent(token)}`; }

async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  if (!authorized(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (process.env.NURTURE_ENABLED !== 'true') return res.status(200).json({ ok: true, skipped: true, reason: 'disabled' });
  if (!db.isEnabled()) return res.status(200).json({ ok: true, skipped: true, reason: 'not_configured' });
  const now = new Date().toISOString();
  let sent = 0, due = 0, errors = 0;
  const cap = () => sent >= SEND_CAP;

  async function fire({ prospect, proposal, step, email }) {
    due++;
    if (cap()) return;
    try {
      const rec = await db.recordSend({ prospect_id: prospect.id, proposal_id: proposal ? proposal.id : null, step });
      if (!rec.ok || rec.recorded === false) return; // duplicate / claimed by another run / db issue -> do not send
      const tok = await db.ensureUnsubToken(prospect.id);
      if (!tok.ok || !tok.token) return;
      const built = email(unsubUrl(tok.token));
      const r = await sendClient({ to: prospect.email || (proposal && proposal.client_email), subject: built.subject, text: built.text, headers: built.headers });
      if (r.ok) sent++;
      // send row already recorded; a send failure is not retried (a nurture nudge is best-effort)
    } catch { errors++; }
  }

  // A — leads with no proposal
  try {
    const leads = await db.leadCandidates(now);
    for (const { prospect, hasPlan } of (leads.data || [])) {
      if (cap()) break;
      const steps = await db.sentStepsForProspect(prospect.id);
      if (!leadDue(prospect, false, steps.data || new Set(), now)) continue;
      await fire({ prospect, proposal: null, step: STEP.LEAD,
        email: (u) => leadEmail({ prospect, hasPlan, siteUrl: SITE, unsubscribeUrl: u }) });
    }
  } catch (e) { errors++; console.error('nurture section error:', e && e.message ? e.message : e); }

  // B + C — approved proposals (unpaid reminders + expiry). unpaidProposals covers both; expiry handled by dueStepForProposal.
  try {
    const props = await db.unpaidProposals();
    for (const p of (props.data || [])) {
      if (cap()) break;
      const sp = p.scope_prospects;
      if (!sp) continue; // no prospect row -> cannot confirm consent -> fail closed
      const prospect = { id: p.prospect_id, email: p.client_email,
        unsubscribed: sp.unsubscribed, nurture_suppressed: sp.nurture_suppressed };
      if (!isSendable(prospect)) continue;
      const steps = await db.sentStepsForProposal(p.id);
      const step = dueStepForProposal(p, steps.data || new Set(), now);
      if (!step) continue;
      const email = step === STEP.EXPIRING
        ? (u) => expiringEmail({ proposal: p, siteUrl: SITE, unsubscribeUrl: u })
        : (u) => unpaidEmail({ proposal: p, step, siteUrl: SITE, unsubscribeUrl: u });
      await fire({ prospect, proposal: p, step, email });
    }
  } catch (e) { errors++; console.error('nurture section error:', e && e.message ? e.message : e); }

  // D — operator digest: stale drafts + run summary (also the heartbeat)
  try {
    const stale = await db.staleDrafts(now);
    const drafts = stale.data || [];
    if (drafts.length || sent || errors) {
      const lines = drafts.map((d) => `• ${d.client_email || '(no email)'} — proposal ${d.id} — stop: ${SITE}/api/suppress?key=YOUR_TOKEN&prospect=${d.prospect_id}`);
      await sendOperator({ subject: `Nurture ran: ${sent} sent, ${drafts.length} drafts waiting`,
        text: `Nurture tick complete.\nSent: ${sent}\nDue: ${due}\nErrors: ${errors}\n\nProposals waiting for your approval (>24h):\n${lines.join('\n') || '(none)'}\n` });
    }
  } catch (e) { errors++; console.error('nurture section error:', e && e.message ? e.message : e); }

  return res.status(200).json({ ok: true, sent, due, errors, capped: cap() });
}

export default withObserve('/api/cron/nurture', handler);
