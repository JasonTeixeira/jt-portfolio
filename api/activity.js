/**
 * /api/activity — Overview activity feed + new-leads week delta (admin-gated).
 *   GET → { activity: [{type, meta, created_at, prospect}], leadsWeek: {now, prev} }
 * Read-only; powers the cockpit command center.
 */
import { rateLimited, clientIp } from '../lib/ratelimit.mjs';
import { withObserve } from '../lib/observe.mjs';
import { authorizeAdmin } from '../lib/admin-auth.mjs';
import { isEnabled, recentActivity, newLeadsWeekDelta } from '../lib/scope-db.mjs';

async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  if (await rateLimited(clientIp(req), 60, 'admin')) return res.status(429).json({ ok: false, error: 'slow_down' });
  if (!(await authorizeAdmin(req))) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true, activity: [], leadsWeek: null });

  const [act, leads] = await Promise.all([recentActivity(24), newLeadsWeekDelta()]);
  if (!act.ok) return res.status(502).json({ ok: false, error: 'activity_unavailable' });
  return res.status(200).json({ ok: true, activity: act.data, leadsWeek: leads.ok ? leads.data : null });
}

export default withObserve('/api/activity', handler);
