import { isEnabled, setUnsubscribedByToken } from '../lib/nurture-db.mjs';
const SITE = process.env.SITE_URL || 'https://agency.sageideas.dev';
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  const token = String((req.query && req.query.token) || '');
  if (isEnabled() && token) { try { await setUnsubscribedByToken(token); } catch {} }
  // One-click POST (RFC 8058) wants a plain 200; GET is a human click -> confirmation page.
  if (req.method === 'POST') return res.status(200).json({ ok: true });
  res.setHeader('Location', `${SITE}/unsubscribe.html?done=1`);
  return res.status(302).end ? res.status(302).end() : res.status(302).json({ ok: true });
}
