/**
 * lib/places.mjs — Google Places (New) lead sourcing for the LOCAL-SMB outbound lane.
 *
 * Where Apollo finds B2B/tech decision-makers, Places finds local businesses (plumbers,
 * dentists, law firms, med spas) by type + city — the volume engine for the AI-automation
 * lane. Returns the business name, phone, website, rating, and review count; the website
 * domain then feeds email enrichment (Hunter/Apollo) and verification downstream.
 *
 * Env-gated like every integration here — no key → { ok:false, skipped:true }, never throws:
 *   GOOGLE_PLACES_API_KEY   (or GOOGLE_MAPS_API_KEY) — a GCP key with the Places API (New) enabled
 *
 * Uses the Places API (New) Text Search endpoint (POST places:searchText) with a field mask
 * so we only pay for the fields we use. Pagination via nextPageToken (20/page, up to ~60/query).
 */

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
const TIMEOUT_MS = 12_000;
// Only the fields we use — the field mask is billed, so keep it tight.
const FIELD_MASK = [
  'places.displayName', 'places.formattedAddress', 'places.nationalPhoneNumber',
  'places.websiteUri', 'places.rating', 'places.userRatingCount',
  'places.businessStatus', 'places.primaryType', 'nextPageToken',
].join(',');

function apiKey() {
  return process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
}
export function isEnabled() {
  return Boolean(apiKey());
}

// Pull the registrable-ish domain out of a website URL (drops scheme, path, and www.).
export function domainOf(websiteUri) {
  if (!websiteUri || typeof websiteUri !== 'string') return null;
  try {
    const u = new URL(websiteUri);
    return u.hostname.replace(/^www\./i, '').toLowerCase() || null;
  } catch {
    return null;
  }
}

function normalize(p) {
  if (!p || typeof p !== 'object') return null;
  const website = p.websiteUri || null;
  return {
    name: (p.displayName && p.displayName.text) || null,
    phone: p.nationalPhoneNumber || null,
    website,
    domain: domainOf(website),
    address: p.formattedAddress || null,
    rating: typeof p.rating === 'number' ? p.rating : null,
    reviews: typeof p.userRatingCount === 'number' ? p.userRatingCount : 0,
    type: p.primaryType || null,
    operational: p.businessStatus ? p.businessStatus === 'OPERATIONAL' : true,
  };
}

/**
 * One page of local businesses matching a plain-language query.
 * @param {string} query e.g. "plumbers in Phoenix, AZ" or "med spa Dallas TX"
 * @param {string} [pageToken] from a previous call's nextPageToken
 * @param {number} [pageSize=20] max 20 per Places API
 * @returns {Promise<{ok:boolean, data?:{businesses:object[], nextPageToken:string|null}, error?:string, skipped?:boolean}>}
 */
export async function searchBusinesses(query, pageToken = null, pageSize = 20) {
  const key = apiKey();
  if (!key) return { ok: false, skipped: true };
  if (!query || typeof query !== 'string') return { ok: false, error: 'query required' };
  const body = { textQuery: query, pageSize: Math.min(20, Math.max(1, pageSize | 0)) };
  if (pageToken) body.pageToken = pageToken;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key, // key in a header, never the URL (won't leak in logs)
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (resp.status === 403) return { ok: false, error: 'places_forbidden (enable Places API / check key)' };
    if (resp.status === 429) return { ok: false, error: 'places_rate_limited' };
    if (!resp.ok) return { ok: false, error: `places_${resp.status}` };
    const json = await resp.json();
    const businesses = Array.isArray(json && json.places) ? json.places.map(normalize).filter(Boolean) : [];
    return { ok: true, data: { businesses, nextPageToken: (json && json.nextPageToken) || null } };
  } catch (e) {
    return { ok: false, error: e && e.name === 'AbortError' ? 'places_timeout' : String((e && e.message) || e) };
  } finally {
    clearTimeout(timer);
  }
}
