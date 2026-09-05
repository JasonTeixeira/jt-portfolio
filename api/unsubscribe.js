import { isEnabled, setUnsubscribedByToken } from '../lib/nurture-db.mjs';
const SITE = process.env.SITE_URL || 'https://agency.sageideas.dev';
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  const token = String((req.query && req.query.token) || '');
  let failed = false;
  if (isEnabled() && token) {
    try {
      const r = await setUnsubscribedByToken(token);
      if (r && r.ok === false) { failed = true; console.error('[unsubscribe] write failed', r.error || ''); }
    } catch (e) { failed = true; console.error('[unsubscribe] error', (e && e.message) || e); }
  }
  // One-click POST (RFC 8058) wants a plain 200; GET is a human click -> confirmation page.
  // On a real failure, do NOT tell the user they're unsubscribed — send them to an error state.
  if (req.method === 'POST') return res.status(200).json({ ok: !failed });
  res.setHeader('Location', `${SITE}/unsubscribe.html?${failed ? 'error=1' : 'done=1'}`);
  return res.status(302).end ? res.status(302).end() : res.status(302).json({ ok: true });
}
