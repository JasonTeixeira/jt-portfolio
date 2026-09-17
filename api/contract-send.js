import { rateLimited, clientIp } from '../lib/ratelimit.mjs';
import { withObserve } from '../lib/observe.mjs';
import { authorizeAdmin, adminActor } from '../lib/admin-auth.mjs';
import { logAudit } from '../lib/audit-db.mjs';
import { isEnabled, sendContract } from '../lib/portal-db.mjs';
import { sendClient } from '../lib/notify.mjs';
import { contractEmail } from '../lib/email-templates.mjs';

const SITE = process.env.SITE_URL || 'https://agency.sageideas.dev';

async function handler(req, res) {
  if (await rateLimited(clientIp(req), 30, 'admin')) return res.status(429).json({ ok: false, error: 'slow_down' });
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  // Fail-closed admin gate BEFORE any DB work.
  if (!(await authorizeAdmin(req))) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true });
  const { id } = req.body || {};
  if (typeof id !== 'string' || !id.trim()) return res.status(400).json({ ok: false, error: 'id required' });
  const r = await sendContract(id.trim());
  if (!r.ok || !r.data) return res.status(200).json({ ok: false, skipped: true });
  const row = r.data;
  if (row.client_email) {
    try {
      const mail = contractEmail({ link: `${SITE}/contract.html?id=${row.public_id}` });
      await sendClient({ to: row.client_email, subject: mail.subject, text: mail.text, html: mail.html });
    } catch {}
  }
  logAudit({ actor: adminActor(req), action: 'contract_sent', targetType: 'contract', targetId: row.public_id, meta: { to: row.client_email || null } }).catch(() => {});
  return res.status(200).json({ ok: true, publicId: row.public_id });
}

export default withObserve('/api/contract-send', handler);
