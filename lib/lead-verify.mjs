/**
 * lib/lead-verify.mjs — email verification for the outbound engine.
 *
 * Cold outreach lives or dies on deliverability: sending to invalid/spam-trap addresses
 * spikes your bounce rate and burns the sending domain you just authenticated. This verifies
 * every sourced address BEFORE it's ever mailed.
 *
 * Provider: ZeroBounce by default (swap the URL/parse for NeverBounce/Bouncer if you prefer).
 * Env-gated like everything else:
 *
 *   ZEROBOUNCE_API_KEY   (or EMAIL_VERIFY_API_KEY as a generic alias)
 *
 * Without a key, verifyEmail returns { ok:false, skipped:true } — the orchestrator treats
 * that as "unverified" and marks the prospect so, rather than blocking sourcing entirely.
 * Fail-safe: a verifier outage returns unknown, never a thrown error.
 */

const BASE = 'https://api.zerobounce.net/v2/validate';
const TIMEOUT_MS = 10_000;

function apiKey() {
  return process.env.ZEROBOUNCE_API_KEY || process.env.EMAIL_VERIFY_API_KEY || '';
}
export function isEnabled() {
  return Boolean(apiKey());
}

// ZeroBounce statuses → is this address safe to send to? Only 'valid' is a clean send;
// 'catch-all' is risky (accepted but unverifiable) — we surface it but don't send by default.
const DELIVERABLE = new Set(['valid']);
const RISKY = new Set(['catch-all']);

/**
 * @param {string} email
 * @returns {Promise<{ok:boolean, data?:{email:string, status:string, deliverable:boolean, risky:boolean}, error?:string, skipped?:boolean}>}
 */
export async function verifyEmail(email) {
  const key = apiKey();
  if (!key) return { ok: false, skipped: true };
  const clean = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    return { ok: true, data: { email: clean, status: 'invalid', deliverable: false, risky: false } };
  }
  const url = `${BASE}?api_key=${encodeURIComponent(key)}&email=${encodeURIComponent(clean)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) return { ok: false, error: `verify_${resp.status}` };
    const json = await resp.json();
    const status = String((json && json.status) || 'unknown').toLowerCase();
    return {
      ok: true,
      data: { email: clean, status, deliverable: DELIVERABLE.has(status), risky: RISKY.has(status) },
    };
  } catch (e) {
    return { ok: false, error: e && e.name === 'AbortError' ? 'verify_timeout' : String((e && e.message) || e) };
  } finally {
    clearTimeout(timer);
  }
}
