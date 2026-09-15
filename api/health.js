import { withObserve } from '../lib/observe.mjs';
/**
 * /api/health — public subsystem wiring probe.
 *
 * Reports which subsystems are CONFIGURED (booleans only — never a secret
 * value, a key prefix, or an error message that could leak one). Safe to
 * expose publicly: point an uptime monitor (UptimeRobot/BetterStack) at this
 * route, or hit it manually after setting Vercel env vars to confirm the
 * wiring took before running the live E2E money-path script
 * (scripts/e2e-moneypath.mjs).
 *
 * Always 200 on GET — this is a health probe, not a business endpoint, so an
 * "unwired" subsystem is a normal state (`subsystems.<name> === false`), not
 * an HTTP error.
 */

import { isEnabled as scopeDbEnabled } from '../lib/scope-db.mjs';
import { isEnabled as stripeEnabled } from '../lib/stripe.mjs';
import { isEnabled as resendEnabled } from '../lib/notify.mjs';
import { smsEnabled } from '../lib/sms.mjs';

async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  // scope-db / proposal-db / portal-db / nurture-db all gate on the same two
  // env vars (SUPABASE_URL, SUPABASE_SERVICE_KEY) — any one's isEnabled() is
  // representative of "is Supabase wired" as a whole.
  const subsystems = {
    llm: Boolean(process.env.LLM_API_KEY && process.env.LLM_BASE_URL && process.env.LLM_MODEL),
    supabase: scopeDbEnabled(),
    stripe: stripeEnabled(),
    stripe_webhook: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    resend: resendEnabled(),
    admin: Boolean(process.env.SCOPE_ADMIN_TOKEN),
    nurture: process.env.NURTURE_ENABLED === 'true' && Boolean(process.env.CRON_SECRET),
    site_url: Boolean(process.env.SITE_URL),
    // Production-readiness (ops) signals — booleans only, no secret values.
    sentry: Boolean(process.env.SENTRY_DSN), // error monitoring live (lib/observe.mjs)
    rate_limit_backed: Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN), // false → in-mem fallback only (weak on serverless)
    email_domain: Boolean(process.env.RESEND_FROM) && !/onboarding@resend\.dev/i.test(process.env.RESEND_FROM || ''), // false → sending from Resend sandbox (delivers only to account owner)
    frontdesk_sms: smsEnabled(),
    frontdesk_owner_alert: Boolean(process.env.FRONTDESK_DEMO_OWNER_PHONE),
  };

  return res.status(200).json({ ok: true, ts: new Date().toISOString(), subsystems });
}

export default withObserve('/api/health', handler);
