/**
 * /api/inbox — operator unified comms inbox (admin-gated). Every client->operator
 * message the operator hasn't read yet, grouped into per-project threads + a total
 * unread count for the nav badge. Opening/replying to a thread reuses /api/messages.
 *   GET → { total, threads: [{projectId, portalToken, publicId, email, unread, latestBody, latestAt}] }
 */
import { rateLimited, clientIp } from '../lib/ratelimit.mjs';
import { withObserve } from '../lib/observe.mjs';
import { authorizeAdmin } from '../lib/admin-auth.mjs';
import { isEnabled, operatorUnreadMessages } from '../lib/portal-db.mjs';

async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  if (await rateLimited(clientIp(req), 60, 'admin')) return res.status(429).json({ ok: false, error: 'slow_down' });
  if (!(await authorizeAdmin(req))) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true, total: 0, threads: [] });

  const r = await operatorUnreadMessages();
  if (!r.ok) return res.status(502).json({ ok: false, error: 'inbox_unavailable' });

  // Rows arrive newest-first; fold them into one thread per project. The first row
  // seen for a project is its latest message (drives the preview + sort order).
  const byProject = new Map();
  for (const row of r.data || []) {
    const proj = row.scope_projects || {};
    const prop = proj.scope_proposals || {};
    const key = row.project_id;
    if (!byProject.has(key)) {
      byProject.set(key, {
        projectId: key,
        portalToken: proj.portal_token || null,
        publicId: prop.public_id || null,
        email: prop.client_email || null,
        unread: 0,
        latestBody: String(row.body || '').slice(0, 160),
        latestAt: row.created_at,
      });
    }
    byProject.get(key).unread += 1;
  }
  const threads = Array.from(byProject.values());
  const total = threads.reduce((n, t) => n + t.unread, 0);
  return res.status(200).json({ ok: true, total, threads });
}

export default withObserve('/api/inbox', handler);
