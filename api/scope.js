/**
 * /api/scope — Vercel serverless function persisting Scope Studio activity
 * (prospect, event, and optionally a computed plan) to Supabase.
 *
 * Env-guarded: without SUPABASE_URL / SUPABASE_SERVICE_KEY (see lib/scope-db.mjs)
 * this returns a clean 200 `{ ok:false, skipped:true, reason:'not_configured' }`
 * (not 501 — the client fires this as a fire-and-forget beacon, and a non-2xx
 * status would log a console error and ding Lighthouse Best Practices on the
 * live site) and the client keeps working entirely from localStorage —
 * persistence is additive telemetry, never a dependency for the visitor's flow.
 *
 * Once a request is validated, every DB call is best-effort: lib/scope-db.mjs's
 * `guard()` already never throws, and the handler wraps the whole sequence in
 * try/catch as a second safety net, so a Supabase hiccup still resolves 200
 * `{ ok:true, skipped:true }` rather than surfacing an error to the browser.
 */

import { isEnabled, upsertProspect, appendEvent, insertPlan } from '../lib/scope-db.mjs';

const EVENT_TYPES = new Set(['started', 'questioned', 'plan_built', 'lead_captured', 'handoff_clicked']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Pure request-body validator — no DB access, safe to unit test directly.
 */
export function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'bad_request' };
  }
  const { prospectId, type, plan, email, segment } = body;

  if (typeof prospectId !== 'string' || !prospectId.trim()) {
    return { ok: false, error: 'prospectId required' };
  }
  if (typeof type !== 'string' || !EVENT_TYPES.has(type)) {
    return { ok: false, error: 'invalid type' };
  }
  if (plan !== undefined && (typeof plan !== 'object' || plan === null || Array.isArray(plan))) {
    return { ok: false, error: 'invalid plan' };
  }
  if (email !== undefined && email !== null && email !== '' &&
      (typeof email !== 'string' || email.length > 320 || !EMAIL_RE.test(email))) {
    return { ok: false, error: 'invalid email' };
  }
  if (segment !== undefined && segment !== null && typeof segment !== 'string') {
    return { ok: false, error: 'invalid segment' };
  }

  return { ok: true };
}

// tiny per-instance IP throttle (best-effort; resets on cold start) — same
// shape as api/chat.js, just a looser cap since this is background telemetry
// (a single Scope Studio session can legitimately fire several events).
const hits = new Map();
function throttled(ip) {
  const now = Date.now();
  const win = 60_000;
  const arr = (hits.get(ip) || []).filter((t) => now - t < win);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 40; // >40 scope events/min per IP
}

function planRow(prospectId, plan, fallbackSegment) {
  const total = Array.isArray(plan.total) ? plan.total
    : Array.isArray(plan.totalBand) ? plan.totalBand
    : null;
  const totalLo = total && Number.isFinite(total[0]) ? total[0]
    : Number.isFinite(plan.total_lo) ? plan.total_lo : null;
  const totalHi = total && Number.isFinite(total[1]) ? total[1]
    : Number.isFinite(plan.total_hi) ? plan.total_hi : null;

  return {
    prospect_id: prospectId,
    keys: Array.isArray(plan.keys) ? plan.keys : [],
    segment: (typeof plan.segment === 'string' && plan.segment) || fallbackSegment || null,
    total_lo: totalLo,
    total_hi: totalHi,
    flags: Array.isArray(plan.flags) ? plan.flags : [],
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  // Not configured yet → still 200 (not 501): a non-2xx response here would
  // log a "Failed to load resource" console error on every page load (this
  // is a fire-and-forget track('started') call) and ding Lighthouse Best
  // Practices on the live site. ok:false + skipped tells the client
  // persistence is off; it keeps going on localStorage-only Scope Studio
  // state regardless — no browser console error, no behavior change.
  if (!isEnabled()) {
    return res.status(200).json({ ok: false, skipped: true, reason: 'not_configured' });
  }

  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    'unknown';
  if (throttled(ip)) {
    return res.status(429).json({ ok: false, error: 'slow_down' });
  }

  const body = req.body ?? {};
  const check = validate(body);
  if (!check.ok) {
    return res.status(400).json({ ok: false, error: check.error });
  }

  const { prospectId, type, plan, email, segment } = body;
  let skipped = false;

  // Never break the visitor's experience over a persistence hiccup: every
  // step is best-effort and failures are absorbed, not surfaced.
  try {
    const prospectRow = { id: prospectId };
    if (email) prospectRow.email = email;
    if (segment) prospectRow.segment = segment;
    const prospectResult = await upsertProspect(prospectRow);
    if (!prospectResult.ok) skipped = true;

    const eventResult = await appendEvent({
      prospect_id: prospectId,
      type,
      meta: (body.meta && typeof body.meta === 'object' && !Array.isArray(body.meta)) ? body.meta : {},
    });
    if (!eventResult.ok) skipped = true;

    if (plan) {
      const planResult = await insertPlan(planRow(prospectId, plan, segment));
      if (!planResult.ok) skipped = true;
    }
  } catch (err) {
    console.error('[scope] persistence error', err instanceof Error ? err.message : err);
    skipped = true;
  }

  return res.status(200).json(skipped ? { ok: true, skipped: true } : { ok: true });
}
