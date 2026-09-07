/**
 * /api/prospects — the operator CRM/pipeline endpoint (token-gated).
 *
 *   GET  ?list[=stage]  → { prospects: [...], counts: {new,scoped,engaged,won,lost} }
 *   GET  ?id=<uuid>     → { prospect, events: [...] }
 *   POST { id, stage, lostReason? }  → transition a prospect's stage
 *
 * Reads/writes scope_prospects + scope_events (data the funnel already persists).
 * Fail-closed auth (same token as proposal-admin); degrade-safe when Supabase is off.
 */
import { rateLimited, clientIp } from '../lib/ratelimit.mjs';
import { withObserve } from '../lib/observe.mjs';
import { authorizeAdmin } from '../lib/admin-auth.mjs';
import {
  isEnabled, listProspects, getProspect, listProspectEvents,
  setProspectStage, prospectStageCounts, isValidStage,
  createProspect, logTouch, isValidTouch,
} from '../lib/scope-db.mjs';

// minimal email sanity — the funnel already validates on the way in; this is a
// server-side guard for operator-typed outbound leads.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

async function handler(req, res) {
  if (await rateLimited(clientIp(req), 30, 'admin')) return res.status(429).json({ ok: false, error: 'slow_down' });
  if (!(await authorizeAdmin(req))) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true, prospects: [], counts: {} });

  if (req.method === 'GET') {
    const id = String(req.query.id || '');
    if (id) {
      const p = await getProspect(id);
      if (!p.ok || !p.data) return res.status(404).json({ ok: false, error: 'not_found' });
      const ev = await listProspectEvents(id);
      return res.status(200).json({ ok: true, prospect: p.data, events: ev.ok ? ev.data : [] });
    }
    // list (optionally filtered by stage) + counts
    const stage = req.query.list && req.query.list !== '1' ? String(req.query.list) : undefined;
    const [ps, counts] = await Promise.all([listProspects({ stage }), prospectStageCounts()]);
    return res.status(200).json({ ok: true, prospects: ps.ok ? ps.data : [], counts: counts.ok ? counts.data : {} });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const action = String(body.action || '');

    // outbound: log a cold-reached lead into the pipeline
    if (action === 'create') {
      const email = str(body.email, 200).toLowerCase();
      if (!EMAIL_RE.test(email)) return res.status(400).json({ ok: false, error: 'valid email required' });
      const r = await createProspect({
        email,
        name: str(body.name, 120) || null,
        company: str(body.company, 160) || null,
        segment: str(body.segment, 60) || null,
      });
      if (!r.ok) return res.status(200).json({ ok: false, reason: 'write_failed' });
      return res.status(200).json({ ok: true, created: Array.isArray(r.data) ? r.data[0] : r.data });
    }

    // record an outreach touch on a prospect's timeline
    if (action === 'touch') {
      const id = str(body.id, 64);
      const kind = str(body.kind, 20);
      if (!id) return res.status(400).json({ ok: false, error: 'id required' });
      if (!isValidTouch(kind)) return res.status(400).json({ ok: false, error: 'invalid touch kind' });
      const r = await logTouch(id, kind, body.note);
      if (!r.ok) return res.status(200).json({ ok: false, reason: 'write_failed' });
      return res.status(200).json({ ok: true, logged: true });
    }

    // default: stage transition (back-compat — proposal-admin posts {id, stage})
    const id = str(body.id, 64);
    const stage = str(body.stage, 20);
    if (!id) return res.status(400).json({ ok: false, error: 'id required' });
    if (!isValidStage(stage)) return res.status(400).json({ ok: false, error: 'invalid stage' });
    const r = await setProspectStage(id, stage, body.lostReason);
    if (!r.ok) return res.status(200).json({ ok: false, reason: 'write_failed' });
    return res.status(200).json({ ok: true, updated: Array.isArray(r.data) ? r.data[0] : r.data });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'method not allowed' });
}

export default withObserve('/api/prospects', handler);
