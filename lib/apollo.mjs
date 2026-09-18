/**
 * lib/apollo.mjs — Apollo.io lead-sourcing client (the front half of the outbound engine).
 *
 * Discovers ICP-matched decision-makers and reveals their work email, so the outbound
 * pipeline (scripts/source-leads.mjs) can fill scope_prospects with real targets instead of
 * a hand-typed list.
 *
 * Env-gated exactly like the rest of the codebase: without APOLLO_API_KEY every call returns
 * { ok:false, skipped:true } and never throws, so a missing key degrades cleanly (the operator
 * just gets "sourcing not configured") rather than crashing a script or an endpoint.
 *
 *   APOLLO_API_KEY   your Apollo key (Settings → API in the Apollo dashboard)
 *
 * Two calls, matching Apollo's REST API v1:
 *   searchPeople(icp, page) → POST /mixed_people/search  — discovery (may not include email)
 *   enrichPerson(person)    → POST /people/match          — reveal the verified work email
 *
 * Response shapes are parsed DEFENSIVELY (Apollo tweaks fields over time and locks emails
 * behind plan tiers), so a shape change degrades to "no email" rather than a thrown error.
 */

const BASE = 'https://api.apollo.io/api/v1';
const TIMEOUT_MS = 12_000;

export function isEnabled() {
  return Boolean(process.env.APOLLO_API_KEY);
}

async function call(path, body) {
  const key = process.env.APOLLO_API_KEY;
  if (!key) return { ok: false, skipped: true };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        // Apollo accepts the key as a header; never put it in the URL/query (would leak in logs).
        'X-Api-Key': key,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (resp.status === 401 || resp.status === 403) return { ok: false, error: 'apollo_unauthorized' };
    if (resp.status === 429) return { ok: false, error: 'apollo_rate_limited' };
    if (!resp.ok) return { ok: false, error: `apollo_${resp.status}` };
    const json = await resp.json();
    return { ok: true, data: json };
  } catch (e) {
    return { ok: false, error: e && e.name === 'AbortError' ? 'apollo_timeout' : String((e && e.message) || e) };
  } finally {
    clearTimeout(timer);
  }
}

// A revealed/valid work email — Apollo returns locked placeholders like
// "email_not_unlocked@domain.com" for people you haven't enriched; treat those as no email.
function realEmail(raw) {
  const e = String(raw || '').trim().toLowerCase();
  if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  // Apollo returns "email_not_unlocked@domain.com" for people you haven't enriched.
  if (e.includes('email_not_unlocked') || e.includes('not_unlocked')) return null;
  return e;
}

// Normalize one Apollo person → the shape the rest of the pipeline speaks (matches
// scope_prospects columns + bulkImportProspects input).
function normalize(p) {
  if (!p || typeof p !== 'object') return null;
  const org = p.organization || p.account || {};
  const name = p.name || [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || null;
  return {
    apolloId: p.id || null,
    firstName: p.first_name || null,
    lastName: p.last_name || null,
    name,
    title: p.title || null,
    email: realEmail(p.email),
    linkedin: p.linkedin_url || null,
    company: org.name || null,
    domain: org.primary_domain || org.website_url || null,
  };
}

/**
 * Discover people matching an Ideal Customer Profile.
 * @param {object} icp
 * @param {string[]} [icp.titles]        e.g. ['Head of Engineering','VP Product','CTO']
 * @param {string[]} [icp.employeeRanges] Apollo ranges e.g. ['11,50','51,200','201,500']
 * @param {string[]} [icp.keywords]      org keyword tags e.g. ['artificial intelligence','saas']
 * @param {string[]} [icp.locations]     e.g. ['United States']
 * @param {number}  [page=1]
 * @param {number}  [perPage=25]
 * @returns {Promise<{ok:boolean, data?:{people:object[], totalPages:number, total:number}, error?:string, skipped?:boolean}>}
 */
export async function searchPeople(icp = {}, page = 1, perPage = 25) {
  const body = {
    page: Math.max(1, page | 0),
    per_page: Math.min(100, Math.max(1, perPage | 0)),
  };
  if (Array.isArray(icp.titles) && icp.titles.length) body.person_titles = icp.titles.slice(0, 20);
  if (Array.isArray(icp.employeeRanges) && icp.employeeRanges.length) body.organization_num_employees_ranges = icp.employeeRanges.slice(0, 10);
  if (Array.isArray(icp.keywords) && icp.keywords.length) body.q_organization_keyword_tags = icp.keywords.slice(0, 20);
  if (Array.isArray(icp.locations) && icp.locations.length) body.person_locations = icp.locations.slice(0, 10);

  const r = await call('/mixed_people/search', body);
  if (!r.ok) return r;
  const people = Array.isArray(r.data && r.data.people) ? r.data.people.map(normalize).filter(Boolean) : [];
  const pg = (r.data && r.data.pagination) || {};
  return { ok: true, data: { people, totalPages: pg.total_pages || 1, total: pg.total_entries || people.length } };
}

/**
 * Reveal the verified work email for one discovered person (consumes an Apollo enrichment
 * credit). Pass the normalized person from searchPeople. Returns the same shape with `email`
 * filled when Apollo can reveal it, else email stays null.
 */
export async function enrichPerson(person) {
  if (!person) return { ok: false, error: 'no_person' };
  if (person.email) return { ok: true, data: person }; // already have it — don't spend a credit
  const body = { reveal_personal_emails: false };
  if (person.apolloId) body.id = person.apolloId;
  if (person.firstName) body.first_name = person.firstName;
  if (person.lastName) body.last_name = person.lastName;
  if (person.domain) body.domain = String(person.domain).replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (person.company) body.organization_name = person.company;

  const r = await call('/people/match', body);
  if (!r.ok) return r;
  const matched = normalize(r.data && r.data.person);
  return { ok: true, data: { ...person, email: (matched && matched.email) || null } };
}
