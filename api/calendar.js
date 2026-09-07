/**
 * /api/calendar — operator scheduling (admin-gated).
 *
 *   GET  ?from=<iso>&to=<iso>   → { events: [...] }   (defaults to a wide window)
 *   GET  ?upcoming=1            → { events: [...] }   (next scheduled, from now)
 *   POST { action:'create', ...event }        → { ok, event }
 *   POST { action:'update', id, ...patch }    → { ok, event }
 *   POST { action:'delete', id }              → { ok }
 *
 * All figures/links are operator-private; never exposed to the client portal.
 */
import { rateLimited, clientIp } from '../lib/ratelimit.mjs';
import { withObserve } from '../lib/observe.mjs';
import { authorizeAdmin } from '../lib/admin-auth.mjs';
import {
  isEnabled, listEvents, upcomingEvents, createEvent, updateEvent, deleteEvent,
} from '../lib/calendar-db.mjs';

// Only our own boundary-validation messages are safe to echo to the client;
// anything else (raw Postgres/PostgREST text) is logged and masked.
const SAFE_ERRORS = new Set([
  'title required', 'starts_at required', 'invalid starts_at', 'invalid ends_at',
  'invalid kind', 'invalid status', 'invalid url', 'invalid prospect_id',
  'invalid project_id', 'ends_at before starts_at', 'id required', 'not_found',
]);
function failPost(res, err, op) {
  if (err && !SAFE_ERRORS.has(err)) console.error(`[calendar] ${op} failed`, err);
  if (err === 'not_found') return res.status(404).json({ ok: false, error: 'not_found' });
  const safe = err && SAFE_ERRORS.has(err) ? err : 'save_failed';
  return res.status(400).json({ ok: false, error: safe });
}

async function handler(req, res) {
  if (await rateLimited(clientIp(req), 60, 'admin')) return res.status(429).json({ ok: false, error: 'slow_down' });
  if (!(await authorizeAdmin(req))) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true, events: [] });

  if (req.method === 'GET') {
    if (String(req.query.upcoming || '') === '1') {
      const r = await upcomingEvents();
      if (!r.ok) return res.status(502).json({ ok: false, error: 'calendar_unavailable' });
      return res.status(200).json({ ok: true, events: r.data });
    }
    const r = await listEvents({ from: req.query.from, to: req.query.to });
    if (!r.ok) return res.status(502).json({ ok: false, error: 'calendar_unavailable' });
    return res.status(200).json({ ok: true, events: r.data });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const action = String(body.action || '');
    if (action === 'create') {
      const r = await createEvent(body);
      if (!r.ok) return failPost(res, r.error, 'create');
      return res.status(200).json({ ok: true, event: r.data });
    }
    if (action === 'update') {
      const id = String(body.id || '');
      if (!id) return res.status(400).json({ ok: false, error: 'id required' });
      const r = await updateEvent(id, body);
      if (!r.ok) return failPost(res, r.error, 'update');
      return res.status(200).json({ ok: true, event: r.data });
    }
    if (action === 'delete') {
      const id = String(body.id || '');
      if (!id) return res.status(400).json({ ok: false, error: 'id required' });
      const r = await deleteEvent(id);
      if (!r.ok) return failPost(res, r.error, 'delete');
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ ok: false, error: 'unknown action' });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'method not allowed' });
}

export default withObserve('/api/calendar', handler);
