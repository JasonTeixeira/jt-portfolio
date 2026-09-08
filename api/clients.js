/**
 * /api/clients — per-client 360 hub (admin-gated).
 *   GET               → { clients: [...] }
 *   GET ?id=<uuid>    → { client: {prospect, proposals, projects, contracts, files, events, money} }
 *   POST { action:'update_meta', id, notes?, links? }  → save operator notes + external links
 * Operator-private.
 */
import { rateLimited, clientIp } from '../lib/ratelimit.mjs';
import { withObserve } from '../lib/observe.mjs';
import { authorizeAdmin } from '../lib/admin-auth.mjs';
import { isEnabled, clientList, clientDetail, updateClientMeta } from '../lib/scope-db.mjs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_ERRORS = new Set(['id required', 'invalid id', 'invalid links', 'not_found']);
function failPost(res, err, op) {
  if (err && !SAFE_ERRORS.has(err)) console.error(`[clients] ${op} failed`, err);
  if (err === 'not_found') return res.status(404).json({ ok: false, error: 'not_found' });
  return res.status(400).json({ ok: false, error: err && SAFE_ERRORS.has(err) ? err : 'save_failed' });
}

async function handler(req, res) {
  if (await rateLimited(clientIp(req), 60, 'admin')) return res.status(429).json({ ok: false, error: 'slow_down' });
  if (!(await authorizeAdmin(req))) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true, clients: [] });

  if (req.method === 'GET') {
    const id = String(req.query.id || '');
    if (id) {
      if (!UUID_RE.test(id)) return res.status(400).json({ ok: false, error: 'invalid id' });
      const r = await clientDetail(id);
      if (!r.ok) return r.error === 'not_found' ? res.status(404).json({ ok: false, error: 'not_found' }) : res.status(502).json({ ok: false, error: 'client_unavailable' });
      return res.status(200).json({ ok: true, client: r.data });
    }
    const r = await clientList();
    if (!r.ok) return res.status(502).json({ ok: false, error: 'clients_unavailable' });
    return res.status(200).json({ ok: true, clients: r.data });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    if (String(body.action || '') !== 'update_meta') return res.status(400).json({ ok: false, error: 'unknown action' });
    const id = String(body.id || '');
    if (!UUID_RE.test(id)) return res.status(400).json({ ok: false, error: 'invalid id' });
    const r = await updateClientMeta(id, { notes: body.notes, links: body.links });
    return r.ok ? res.status(200).json({ ok: true }) : failPost(res, r.error, 'update_meta');
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'method not allowed' });
}

export default withObserve('/api/clients', handler);
