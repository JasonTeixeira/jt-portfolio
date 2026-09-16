/**
 * /api/search — global operator search (admin-gated) for the ⌘K palette.
 *   GET ?q=<term> → { clients: [...], proposals: [...] }
 * Read-only; results carry the ids needed to deep-link into the cockpit.
 */
import { rateLimited, clientIp } from '../lib/ratelimit.mjs';
import { withObserve } from '../lib/observe.mjs';
import { authorizeAdmin } from '../lib/admin-auth.mjs';
import { isEnabled, search } from '../lib/search-db.mjs';

async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  if (await rateLimited(clientIp(req), 120, 'admin')) return res.status(429).json({ ok: false, error: 'slow_down' });
  if (!(await authorizeAdmin(req))) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true, clients: [], proposals: [] });

  const r = await search(req.query.q);
  if (!r.ok) return res.status(502).json({ ok: false, error: 'search_unavailable' });
  return res.status(200).json({ ok: true, ...r.data });
}

export default withObserve('/api/search', handler);
