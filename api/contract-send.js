import { checkToken } from '../lib/admin-auth.mjs';
import { isEnabled, sendContract } from '../lib/portal-db.mjs';
import { sendClient } from '../lib/notify.mjs';

const SITE = process.env.SITE_URL || 'https://agency.sageideas.dev';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  // Fail-closed admin gate BEFORE any DB work.
  if (!checkToken(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true });
  const { id } = req.body || {};
  if (typeof id !== 'string' || !id.trim()) return res.status(400).json({ ok: false, error: 'id required' });
  const r = await sendContract(id.trim());
  if (!r.ok || !r.data) return res.status(200).json({ ok: false, skipped: true });
  const row = r.data;
  if (row.client_email) {
    try {
      await sendClient({
        to: row.client_email,
        subject: 'Your agreement is ready',
        text: `Hi,\n\nYour agreement is ready to review and sign.\n\nView it here: ${SITE}/contract.html?id=${row.public_id}\n\nIf anything looks off, just reply and we'll sort it out.\n\n— Jason\n`,
      });
    } catch {}
  }
  return res.status(200).json({ ok: true, publicId: row.public_id });
}
