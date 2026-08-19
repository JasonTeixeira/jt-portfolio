import { isEnabled, setSuppressed } from '../lib/nurture-db.mjs';
import { checkToken } from '../lib/admin-auth.mjs';
export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  if (!checkToken(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true });
  const prospect = String((req.query && req.query.prospect) || '');
  if (!prospect) return res.status(400).json({ ok: false, error: 'prospect required' });
  await setSuppressed(prospect);
  return res.status(200).json({ ok: true, suppressed: prospect });
}
