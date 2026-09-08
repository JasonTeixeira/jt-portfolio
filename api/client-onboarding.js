/**
 * /api/client-onboarding — a logged-in client's manual onboarding checklist.
 *   GET                     → { ok, steps }           (this user's ticked steps)
 *   POST { step, done }     → { ok, steps }           (toggle one whitelisted step)
 *
 * Auth: Supabase-Auth JWT (same as /api/my-projects). Every row is scoped to the
 * caller's VERIFIED user id, so a client can only ever read/write their own state.
 * Degrade-safe when Supabase is off; never throws on a bad body.
 */
import { withObserve } from '../lib/observe.mjs';
import { rateLimited, clientIp } from '../lib/ratelimit.mjs';
import { userFromRequest } from '../lib/auth-user.mjs';
import { isEnabled, getClientOnboarding, setClientOnboardingStep, CLIENT_ONBOARDING_STEPS } from '../lib/scope-db.mjs';

async function handler(req, res) {
  if (await rateLimited(clientIp(req), 60, 'client-onboarding')) return res.status(429).json({ ok: false, error: 'slow_down' });
  const user = await userFromRequest(req);
  if (!user) return res.status(401).json({ ok: false, error: 'unauthorized' });

  if (req.method === 'GET') {
    if (!isEnabled()) return res.status(200).json({ ok: true, steps: {} });
    const r = await getClientOnboarding(user.id);
    return res.status(200).json({ ok: true, steps: r.ok ? r.data : {} });
  }

  if (req.method === 'POST') {
    if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true });
    const body = req.body || {};
    const step = String(body.step || '');
    if (!CLIENT_ONBOARDING_STEPS.includes(step)) return res.status(400).json({ ok: false, error: 'invalid step' });
    const r = await setClientOnboardingStep(user.id, step, body.done === true);
    if (!r.ok) return res.status(200).json({ ok: false, reason: 'write_failed' });
    return res.status(200).json({ ok: true, steps: r.data });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'method not allowed' });
}

export default withObserve('/api/client-onboarding', handler);
