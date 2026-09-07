/**
 * /api/my-projects — the logged-in client's own projects (Supabase-Auth gated).
 * GET with `Authorization: Bearer <supabase jwt>` → { projects:[{portalToken, status, plan}], admin }
 * Projects are matched to the caller's VERIFIED email (from the JWT), so a client only ever
 * sees their own. Open signup is safe: an email with no matching proposal gets an empty list.
 */
import { withObserve } from '../lib/observe.mjs';
import { rateLimited, clientIp } from '../lib/ratelimit.mjs';
import { userFromRequest, isAdminEmail } from '../lib/auth-user.mjs';
import { isEnabled, listClientProjectsByEmail } from '../lib/portal-db.mjs';

async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  if (await rateLimited(clientIp(req), 60, 'my-projects')) return res.status(429).json({ ok: false, error: 'slow_down' });
  const user = await userFromRequest(req);
  if (!user) return res.status(401).json({ ok: false, error: 'unauthorized' });
  const admin = isAdminEmail(user.email);
  if (!isEnabled()) return res.status(200).json({ ok: true, email: user.email, admin, projects: [] });

  const r = await listClientProjectsByEmail(user.email);
  const rows = r.ok ? r.data : [];
  const projects = rows.map((p) => {
    const prop = p.scope_proposals || {};
    return {
      portalToken: p.portal_token, status: p.status, created_at: p.created_at,
      plan: {
        keys: Array.isArray(prop.keys) ? prop.keys : [], segment: prop.segment || null,
        firm_cents: prop.firm_cents, deposit_cents: prop.deposit_cents,
        balance_cents: prop.balance_cents, balance_paid_at: prop.balance_paid_at || null,
      },
    };
  });
  return res.status(200).json({ ok: true, email: user.email, admin, projects });
}

export default withObserve('/api/my-projects', handler);
