import { isEnabled, getProposalById, listProposals } from '../lib/proposal-db.mjs';
import { checkToken } from '../lib/admin-auth.mjs';
export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  if (!checkToken(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true, list: [] });
  if (req.query.list) {
    const r = await listProposals({ limit: 100 });
    return res.status(200).json({ ok: true, list: r.data || [] });
  }
  const id = String(req.query.id || '');
  if (!id) return res.status(400).json({ ok: false, error: 'id required' });
  const r = await getProposalById(id);
  if (!r.ok || !r.data) return res.status(404).json({ ok: false, error: 'not_found' });
  return res.status(200).json({ ok: true, proposal: r.data });
}
