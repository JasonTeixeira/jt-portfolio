/**
 * /api/intel — cockpit intelligence (admin-gated): computed next-best-actions + at-risk
 * signals + a weighted pipeline forecast, all derived from the real ledger.
 *   GET → { actions:[...], atRiskCount, forecastCents, forecastBreakdown }
 */
import { rateLimited, clientIp } from '../lib/ratelimit.mjs';
import { withObserve } from '../lib/observe.mjs';
import { authorizeAdmin } from '../lib/admin-auth.mjs';
import { isEnabled, intelligence } from '../lib/scope-db.mjs';

async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  if (await rateLimited(clientIp(req), 60, 'admin')) return res.status(429).json({ ok: false, error: 'slow_down' });
  if (!(await authorizeAdmin(req))) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true, actions: [] });

  const r = await intelligence();
  if (!r.ok) return res.status(502).json({ ok: false, error: 'intel_unavailable' });
  return res.status(200).json({ ok: true, ...r.data });
}

export default withObserve('/api/intel', handler);
