/**
 * /api/audit — operator write-path audit log (admin-gated, read-only).
 *   GET → { entries: [{actor, action, target_type, target_id, meta, created_at}] }
 */
import { rateLimited, clientIp } from '../lib/ratelimit.mjs';
import { withObserve } from '../lib/observe.mjs';
import { authorizeAdmin } from '../lib/admin-auth.mjs';
import { isEnabled, listAudit } from '../lib/audit-db.mjs';

async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  if (await rateLimited(clientIp(req), 60, 'admin')) return res.status(429).json({ ok: false, error: 'slow_down' });
  if (!(await authorizeAdmin(req))) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true, entries: [] });

  const r = await listAudit(150);
  if (!r.ok) return res.status(502).json({ ok: false, error: 'audit_unavailable' });
  return res.status(200).json({ ok: true, entries: r.data });
}

export default withObserve('/api/audit', handler);
