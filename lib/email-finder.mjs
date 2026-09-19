/**
 * lib/email-finder.mjs — find a real, verified email for a local business.
 *
 * Local SMBs (a neighborhood plumber, a solo law firm) are NOT in B2B contact databases like
 * Findymail/Apollo — those return nothing for them. But local businesses overwhelmingly use a
 * handful of predictable addresses (info@, office@, contact@ …). So the reliable, cheap method
 * is the industry-standard "guess + verify": generate the common patterns from the business's
 * domain, then VERIFY each with Findymail (which works great as a verifier) and keep the first
 * that's real. Free to generate, ~1 verifier credit per business.
 *
 * Env: FINDYMAIL_API_KEY (verifier). Without it → { ok:false, skipped:true }, never throws.
 */

const VERIFY_URL = 'https://app.findymail.com/api/verify';
const TIMEOUT_MS = 12_000;
// Priority order: what local businesses actually use, most common first. We stop at the first
// address that verifies, so common hits (info@) cost 1 credit; misses cost up to MAX_TRIES.
const PATTERNS = ['info', 'office', 'contact', 'hello', 'admin', 'sales', 'support', 'team'];
const MAX_TRIES = 4; // cap verifier spend per business

export function isEnabled() { return Boolean(process.env.FINDYMAIL_API_KEY); }

function cleanDomain(domain) {
  return String(domain || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./i, '').toLowerCase();
}

// Candidate addresses for a domain — role inboxes in hit-rate order, capped to bound verifier
// spend. (Owner-name guesses like harvey@ are unreliable for local businesses — hbaker@,
// harveybaker@, etc. — so we stick to the role addresses SMBs actually use.)
export function candidates(domain) {
  const d = cleanDomain(domain);
  if (!d || !d.includes('.')) return [];
  return PATTERNS.slice(0, MAX_TRIES).map((p) => `${p}@${d}`);
}

async function verify(email, key) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email }),
      signal: controller.signal,
    });
    if (r.status === 402 || r.status === 429) return { ok: false, error: `findymail_${r.status}` }; // out of credits / rate
    if (!r.ok) return { ok: false, error: `findymail_${r.status}` };
    const j = await r.json();
    return { ok: true, verified: Boolean(j && j.verified), provider: (j && j.provider) || null };
  } catch (e) {
    return { ok: false, error: e && e.name === 'AbortError' ? 'findymail_timeout' : String((e && e.message) || e) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @returns {Promise<{ok:boolean, data?:{email:string, provider:string}|null, error?:string, skipped?:boolean}>}
 *          data is null when no candidate verified (a normal outcome). Stops on the first hit.
 */
export async function findBusinessEmail(domain) {
  const key = process.env.FINDYMAIL_API_KEY;
  if (!key) return { ok: false, skipped: true };
  const list = candidates(domain);
  if (!list.length) return { ok: true, data: null };
  for (const email of list) {
    const v = await verify(email, key);
    if (!v.ok) {
      // Out of credits → stop the whole run cleanly rather than silently finding nothing.
      if (/402|429/.test(v.error || '')) return { ok: false, error: v.error };
      continue;
    }
    if (v.verified) return { ok: true, data: { email, provider: v.provider } };
  }
  return { ok: true, data: null };
}
