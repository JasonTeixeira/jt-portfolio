/**
 * /api/content — operator content studio (admin-gated).
 *   GET                  → { content: [...] }   (optional ?status=)
 *   GET ?upcoming=1      → { content: [...] }   (next scheduled)
 *   POST { action:'create'|'update'|'delete', ... }
 * Operator-private; never exposed to the client portal.
 */
import { rateLimited, clientIp } from '../lib/ratelimit.mjs';
import { withObserve } from '../lib/observe.mjs';
import { authorizeAdmin } from '../lib/admin-auth.mjs';
import {
  isEnabled, listContent, upcomingContent, createContent, updateContent, deleteContent,
} from '../lib/content-db.mjs';

const SAFE_ERRORS = new Set([
  'title required', 'invalid channel', 'invalid status', 'invalid scheduled_for',
  'invalid url', 'id required', 'not_found',
]);
function failPost(res, err, op) {
  if (err && !SAFE_ERRORS.has(err)) console.error(`[content] ${op} failed`, err);
  if (err === 'not_found') return res.status(404).json({ ok: false, error: 'not_found' });
  return res.status(400).json({ ok: false, error: err && SAFE_ERRORS.has(err) ? err : 'save_failed' });
}

async function handler(req, res) {
  if (await rateLimited(clientIp(req), 60, 'admin')) return res.status(429).json({ ok: false, error: 'slow_down' });
  if (!(await authorizeAdmin(req))) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true, content: [] });

  if (req.method === 'GET') {
    const r = String(req.query.upcoming || '') === '1' ? await upcomingContent() : await listContent({ status: req.query.status });
    if (!r.ok) return res.status(502).json({ ok: false, error: 'content_unavailable' });
    return res.status(200).json({ ok: true, content: r.data });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const action = String(body.action || '');
    if (action === 'create') {
      const r = await createContent(body);
      return r.ok ? res.status(200).json({ ok: true, item: r.data }) : failPost(res, r.error, 'create');
    }
    if (action === 'update') {
      if (!body.id) return res.status(400).json({ ok: false, error: 'id required' });
      const r = await updateContent(String(body.id), body);
      return r.ok ? res.status(200).json({ ok: true, item: r.data }) : failPost(res, r.error, 'update');
    }
    if (action === 'delete') {
      if (!body.id) return res.status(400).json({ ok: false, error: 'id required' });
      const r = await deleteContent(String(body.id));
      return r.ok ? res.status(200).json({ ok: true }) : failPost(res, r.error, 'delete');
    }
    return res.status(400).json({ ok: false, error: 'unknown action' });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'method not allowed' });
}

export default withObserve('/api/content', handler);
