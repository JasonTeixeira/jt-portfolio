/**
 * /api/revenue — operator money command center (admin-gated).
 * GET → { revenue: {collected, outstanding, pipeline, won, avgDeal, monthly}, stages }
 * All figures computed from the real scope_proposals ledger + prospect stages.
 */
import { rateLimited, clientIp } from '../lib/ratelimit.mjs';
import { withObserve } from '../lib/observe.mjs';
import { authorizeAdmin } from '../lib/admin-auth.mjs';
import { isEnabled, revenueSummary, prospectStageCounts } from '../lib/scope-db.mjs';

async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  if (await rateLimited(clientIp(req), 60, 'admin')) return res.status(429).json({ ok: false, error: 'slow_down' });
  if (!(await authorizeAdmin(req))) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true });
  const [rev, stages] = await Promise.all([revenueSummary(), prospectStageCounts()]);
  // Surface a real backend failure as an error, never a silently-blank dashboard.
  if (!rev.ok) return res.status(502).json({ ok: false, error: 'revenue_unavailable' });
  return res.status(200).json({ ok: true, revenue: rev.data, stages: stages.ok ? stages.data : {} });
}

export default withObserve('/api/revenue', handler);
