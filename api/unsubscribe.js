import { withObserve } from '../lib/observe.mjs';
import { isEnabled, setUnsubscribedByToken } from '../lib/nurture-db.mjs';
const SITE = process.env.SITE_URL || 'https://agency.sageideas.dev';
async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  const token = String((req.query && req.query.token) || '');
  let failed = false;
  // Only a token that actually matched a prospect counts as a real unsubscribe.
  // An unknown/expired token (matched:false) or a missing token must NOT show a
  // false "you're unsubscribed" — the person would think they opted out and keep
  // getting mail. Route those to the honest "couldn't complete, email me" state.
  if (isEnabled() && token) {
    try {
      const r = await setUnsubscribedByToken(token);
      if (!r || r.ok === false || r.matched === false) { failed = true; console.error('[unsubscribe] not applied', (r && (r.error || 'token_not_matched')) || 'no_result'); }
    } catch (e) { failed = true; console.error('[unsubscribe] error', (e && e.message) || e); }
  } else {
    failed = true; // no token, or persistence disabled → can't confirm removal
  }
  // One-click POST (RFC 8058) wants a plain 200; GET is a human click -> confirmation page.
  // On a real failure, do NOT tell the user they're unsubscribed — send them to an error state.
  if (req.method === 'POST') return res.status(200).json({ ok: !failed });
  res.setHeader('Location', `${SITE}/unsubscribe.html?${failed ? 'error=1' : 'done=1'}`);
  return res.status(302).end ? res.status(302).end() : res.status(302).json({ ok: true });
}

export default withObserve('/api/unsubscribe', handler);
