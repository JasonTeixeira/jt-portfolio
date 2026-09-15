/**
 * /api/my-projects — the logged-in client's own projects (Supabase-Auth gated).
 * GET with `Authorization: Bearer <supabase jwt>` → { projects:[{portalToken, status, plan}], admin }
 * Projects are matched to the caller's VERIFIED email (from the JWT), so a client only ever
 * sees their own. Open signup is safe: an email with no matching proposal gets an empty list.
 */
import { withObserve } from '../lib/observe.mjs';
import { rateLimited, clientIp } from '../lib/ratelimit.mjs';
import { userFromRequest, isAdminEmail } from '../lib/auth-user.mjs';
import { isEnabled, listClientProjectsByEmail, contractSummariesForProposals, deliveredMilestonesByProjects, unreadClientMessagesByProjects } from '../lib/portal-db.mjs';

// Client dashboard only cares about a contract they can act on or have signed.
const VISIBLE_CONTRACT_STATUSES = new Set(['sent', 'accepted']);

async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  if (await rateLimited(clientIp(req), 60, 'my-projects')) return res.status(429).json({ ok: false, error: 'slow_down' });
  const user = await userFromRequest(req);
  if (!user) return res.status(401).json({ ok: false, error: 'unauthorized' });
  const admin = isAdminEmail(user.email);
  if (!isEnabled()) return res.status(200).json({ ok: true, email: user.email, admin, projects: [] });

  const r = await listClientProjectsByEmail(user.email);
  const rows = r.ok ? r.data : [];

  // Batch-load the visible contract (sent/accepted) per proposal so the dashboard
  // can flag "contract awaiting your signature" without an N+1 query.
  const proposalIds = rows.map((p) => (p.scope_proposals || {}).id).filter(Boolean);
  const cR = proposalIds.length ? await contractSummariesForProposals(proposalIds) : { ok: true, data: [] };
  const contractByProposal = {};
  if (cR.ok) for (const c of cR.data) {
    if (VISIBLE_CONTRACT_STATUSES.has(c.status) && !contractByProposal[c.proposal_id]) {
      contractByProposal[c.proposal_id] = { publicId: c.public_id, status: c.status };
    }
  }

  // Attention-band counts, batched over the client's own project ids (the internal
  // project id is used only here — it is never returned to the client).
  const projectIds = rows.map((p) => p.id).filter(Boolean);
  const [msR, unreadR] = await Promise.all([
    projectIds.length ? deliveredMilestonesByProjects(projectIds) : { ok: true, data: [] },
    projectIds.length ? unreadClientMessagesByProjects(projectIds) : { ok: true, data: [] },
  ]);
  const tally = (r) => {
    const m = {};
    if (r.ok) for (const row of r.data) { const k = row.project_id; if (k) m[k] = (m[k] || 0) + 1; }
    return m;
  };
  const awaitingByProject = tally(msR);
  const unreadByProject = tally(unreadR);

  const projects = rows.map((p) => {
    const prop = p.scope_proposals || {};
    return {
      portalToken: p.portal_token, status: p.status, created_at: p.created_at,
      contract: contractByProposal[prop.id] || null,
      awaitingApproval: awaitingByProject[p.id] || 0,
      unreadMessages: unreadByProject[p.id] || 0,
      plan: {
        keys: Array.isArray(prop.keys) ? prop.keys : [], segment: prop.segment || null,
        firm_cents: prop.firm_cents, deposit_cents: prop.deposit_cents,
        balance_cents: prop.balance_cents,
        paid_at: prop.paid_at || null, balance_paid_at: prop.balance_paid_at || null,
      },
    };
  });
  return res.status(200).json({ ok: true, email: user.email, admin, projects });
}

export default withObserve('/api/my-projects', handler);
