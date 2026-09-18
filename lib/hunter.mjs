/**
 * lib/hunter.mjs — Hunter.io domain → email finder for the local-SMB lane.
 *
 * Google Places gives a business's website; this turns that domain into a real contact email
 * (owner/generic), which then goes through verification (lib/lead-verify.mjs) before any send.
 *
 * Env-gated: no key → { ok:false, skipped:true }, never throws.
 *   HUNTER_API_KEY   — hunter.io → API dashboard
 */

const BASE = 'https://api.hunter.io/v2/domain-search';
const TIMEOUT_MS = 10_000;

function apiKey() { return process.env.HUNTER_API_KEY || ''; }
export function isEnabled() { return Boolean(apiKey()); }

// Prefer a person over a generic inbox, then higher confidence. Returns the single best email.
function pickBest(emails) {
  const list = Array.isArray(emails) ? emails.filter((e) => e && e.value) : [];
  if (!list.length) return null;
  const scored = list.map((e) => ({
    email: String(e.value).toLowerCase(),
    confidence: Number(e.confidence) || 0,
    type: e.type || 'generic',
    firstName: e.first_name || null,
    lastName: e.last_name || null,
    position: e.position || null,
    // owners/founders/decision-makers rank highest; generic role inboxes lowest.
    rank: /owner|founder|ceo|president|principal|partner/i.test(e.position || '') ? 3
      : e.type === 'personal' ? 2 : 1,
  }));
  scored.sort((a, b) => (b.rank - a.rank) || (b.confidence - a.confidence));
  return scored[0];
}

/**
 * @param {string} domain e.g. "acmeplumbing.com"
 * @returns {Promise<{ok:boolean, data?:{email:string,confidence:number,type:string,firstName:?string,lastName:?string,position:?string}|null, error?:string, skipped?:boolean}>}
 *          data is null when Hunter has no email for the domain (a normal, non-error outcome).
 */
export async function findEmail(domain) {
  const key = apiKey();
  if (!key) return { ok: false, skipped: true };
  const d = String(domain || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
  if (!d || !d.includes('.')) return { ok: true, data: null };
  const url = `${BASE}?domain=${encodeURIComponent(d)}&api_key=${encodeURIComponent(key)}&limit=10`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (resp.status === 429) return { ok: false, error: 'hunter_rate_limited' };
    if (!resp.ok) return { ok: false, error: `hunter_${resp.status}` };
    const json = await resp.json();
    const best = pickBest(json && json.data && json.data.emails);
    return { ok: true, data: best };
  } catch (e) {
    return { ok: false, error: e && e.name === 'AbortError' ? 'hunter_timeout' : String((e && e.message) || e) };
  } finally {
    clearTimeout(timer);
  }
}
