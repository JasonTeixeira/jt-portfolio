/**
 * /api/settings — operator-visible configuration status (admin-gated). Read-only: booleans
 * and counts only, NEVER a secret value. Gives the operator one place to see what's wired
 * and what isn't (all of it is env-controlled), instead of guessing.
 *   GET → { groups: [{ title, items: [{ label, on, hint }] }] }
 */
import { rateLimited, clientIp } from '../lib/ratelimit.mjs';
import { withObserve } from '../lib/observe.mjs';
import { authorizeAdmin } from '../lib/admin-auth.mjs';

const on = (v) => Boolean(v);
const adminEmails = (process.env.ADMIN_EMAILS || 'sage@sageideas.org,hello@sageideas.dev').split(',').map((s) => s.trim()).filter(Boolean);

async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  if (await rateLimited(clientIp(req), 60, 'admin')) return res.status(429).json({ ok: false, error: 'slow_down' });
  if (!(await authorizeAdmin(req))) return res.status(401).json({ ok: false, error: 'unauthorized' });

  const e = process.env;
  const groups = [
    { title: 'Payments', items: [
      { label: 'Stripe keyed', on: on(e.STRIPE_SECRET_KEY), hint: 'STRIPE_SECRET_KEY' },
      { label: 'Stripe webhook secret', on: on(e.STRIPE_WEBHOOK_SECRET), hint: 'STRIPE_WEBHOOK_SECRET — required to record payments' },
    ] },
    { title: 'Email', items: [
      { label: 'Resend keyed', on: on(e.RESEND_API_KEY), hint: 'RESEND_API_KEY' },
      { label: 'Verified sending domain', on: on(e.RESEND_FROM) && !/onboarding@resend\.dev/i.test(e.RESEND_FROM || ''), hint: 'RESEND_FROM on a verified domain (else delivers only to owner)' },
      { label: 'Bounce/complaint webhook', on: on(e.RESEND_WEBHOOK_SECRET), hint: 'RESEND_WEBHOOK_SECRET — feeds the suppression list' },
      { label: 'Automated nurture drip', on: e.NURTURE_ENABLED === 'true' && on(e.CRON_SECRET), hint: 'NURTURE_ENABLED=true + CRON_SECRET' },
    ] },
    { title: 'Security', items: [
      { label: 'Operator MFA enforced', on: /^(1|true|yes)$/i.test(e.ADMIN_REQUIRE_MFA || ''), hint: 'ADMIN_REQUIRE_MFA=true (enroll at /security.html first)' },
      { label: 'Break-glass admin token', on: on(e.SCOPE_ADMIN_TOKEN), hint: 'SCOPE_ADMIN_TOKEN — recovery access' },
      { label: 'Portal session secret', on: on(e.PORTAL_SESSION_SECRET || e.SCOPE_ADMIN_TOKEN || e.SUPABASE_SERVICE_KEY), hint: 'PORTAL_SESSION_SECRET — signs client portal sessions' },
      { label: `Operator allowlist (${adminEmails.length})`, on: adminEmails.length > 0, hint: 'ADMIN_EMAILS — who can open the cockpit' },
    ] },
    { title: 'Reliability', items: [
      { label: 'Error monitoring (Sentry)', on: on(e.SENTRY_DSN), hint: 'SENTRY_DSN' },
      { label: 'Rate limiting backed (Upstash)', on: on(e.UPSTASH_REDIS_REST_URL) && on(e.UPSTASH_REDIS_REST_TOKEN), hint: 'UPSTASH_* — else weak in-memory only' },
      { label: 'Site URL set', on: on(e.SITE_URL), hint: 'SITE_URL' },
    ] },
  ];
  return res.status(200).json({ ok: true, groups });
}

export default withObserve('/api/settings', handler);
