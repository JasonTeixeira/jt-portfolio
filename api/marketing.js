/**
 * /api/marketing — operator marketing/outreach cockpit (admin-gated, read-only).
 * GET → { leads:[...], needsActionCount, nurture:{enabled, recentSends7d}, counts }
 * Manual-assist: surfaces who needs a touch. Sending/logging happens via /api/prospects.
 */
import { rateLimited, clientIp } from '../lib/ratelimit.mjs';
import { withObserve } from '../lib/observe.mjs';
import { authorizeAdmin } from '../lib/admin-auth.mjs';
import { isEnabled, marketingSummary, prospectStageCounts } from '../lib/scope-db.mjs';

async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  if (await rateLimited(clientIp(req), 60, 'admin')) return res.status(429).json({ ok: false, error: 'slow_down' });
  if (!(await authorizeAdmin(req))) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true });
  const [sum, counts] = await Promise.all([marketingSummary(), prospectStageCounts()]);
  if (!sum.ok) return res.status(502).json({ ok: false, error: 'marketing_unavailable' });
  return res.status(200).json({
    ok: true,
    leads: sum.data.leads,
    needsActionCount: sum.data.needsActionCount,
    nurture: { enabled: process.env.NURTURE_ENABLED === 'true', recentSends7d: sum.data.nurture.recentSends7d },
    counts: counts.ok ? counts.data : {},
  });
}

export default withObserve('/api/marketing', handler);
