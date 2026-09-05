import { rateLimited, clientIp } from '../lib/ratelimit.mjs';
import { withObserve } from '../lib/observe.mjs';
import { isEnabled, setSuppressed } from '../lib/nurture-db.mjs';
import { checkToken } from '../lib/admin-auth.mjs';
async function handler(req, res) {
  if (await rateLimited(clientIp(req), 30, 'admin')) return res.status(429).json({ ok: false, error: 'slow_down' });
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  if (!checkToken(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true });
  const prospect = String((req.query && req.query.prospect) || '');
  if (!prospect) return res.status(400).json({ ok: false, error: 'prospect required' });
  const r = await setSuppressed(prospect);
  if (!r.ok) return res.status(200).json({ ok: false, skipped: true });
  return res.status(200).json({ ok: true, suppressed: prospect });
}

export default withObserve('/api/suppress', handler);
