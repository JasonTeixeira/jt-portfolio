/**
 * /api/client-prefs — a logged-in client's own notification preferences (Supabase-Auth gated).
 *   GET  → { prefs: { notify_updates } }
 *   POST { notify_updates } → save
 * Scoped to the caller's VERIFIED email from the JWT — a client only ever reads/writes their own.
 */
import { withObserve } from '../lib/observe.mjs';
import { rateLimited, clientIp } from '../lib/ratelimit.mjs';
import { userFromRequest } from '../lib/auth-user.mjs';
import { isEnabled, getClientPrefs, setClientPrefs } from '../lib/client-prefs-db.mjs';

async function handler(req, res) {
  if (await rateLimited(clientIp(req), 60, 'client-prefs')) return res.status(429).json({ ok: false, error: 'slow_down' });
  const user = await userFromRequest(req);
  if (!user) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!isEnabled()) return res.status(200).json({ ok: true, prefs: { notify_updates: true } });

  if (req.method === 'GET') {
    const prefs = await getClientPrefs(user.email);
    return res.status(200).json({ ok: true, prefs });
  }
  if (req.method === 'POST') {
    const body = req.body || {};
    const r = await setClientPrefs(user.email, { notify_updates: body.notify_updates !== false });
    if (!r.ok) return res.status(200).json({ ok: false, reason: 'write_failed' });
    return res.status(200).json({ ok: true, prefs: { notify_updates: body.notify_updates !== false } });
  }
  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'method not allowed' });
}

export default withObserve('/api/client-prefs', handler);
