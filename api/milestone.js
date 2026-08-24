import { checkToken } from '../lib/admin-auth.mjs';
import { isEnabled, upsertMilestone, markDelivered } from '../lib/portal-db.mjs';

export function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'bad body' };
  if (body.action === 'deliver') {
    if (typeof body.id !== 'string' || !body.id.trim()) return { ok: false, error: 'id required' };
    return { ok: true };
  }
  const hasId = typeof body.id === 'string' && Boolean(body.id.trim());
  const hasProjectId = typeof body.projectId === 'string' && Boolean(body.projectId.trim());
  if (!hasId && !hasProjectId) return { ok: false, error: 'projectId required' };
  if (typeof body.title !== 'string' || !body.title.trim()) return { ok: false, error: 'title required' };
  return { ok: true };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  // Fail-closed admin gate BEFORE any DB work.
  if (!checkToken(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true });
  const body = req.body || {};
  const v = validate(body); if (!v.ok) return res.status(400).json({ ok: false, error: v.error });
  if (body.action === 'deliver') {
    const r = await markDelivered(body.id.trim());
    if (!r.ok) return res.status(200).json({ ok: false, skipped: true });
    return res.status(200).json({ ok: true, milestone: r.data });
  }
  const row = {
    id: typeof body.id === 'string' && body.id.trim() ? body.id.trim() : undefined,
    project_id: body.projectId,
    title: body.title.trim(),
    deliverables: typeof body.deliverables === 'string' ? body.deliverables.slice(0, 4000) : null,
    amount_cents: typeof body.amountCents === 'number' && Number.isFinite(body.amountCents) ? Math.round(body.amountCents) : 0,
    seq: typeof body.seq === 'number' && Number.isFinite(body.seq) ? Math.round(body.seq) : 0,
    due_at: body.dueAt || null,
  };
  const r = await upsertMilestone(row);
  if (!r.ok) return res.status(200).json({ ok: false, skipped: true });
  return res.status(200).json({ ok: true, milestone: r.data });
}
