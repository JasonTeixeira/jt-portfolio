/**
 * lib/instantly.mjs — Instantly.ai API adapter, so the whole send is CLI-driven (no UI).
 *
 * We source + write proposals with our own engine, then drive Instantly's sending
 * infrastructure (warmed inbox rotation, deliverability, follow-ups) entirely through its API:
 * create the campaign + sequence, push the leads, launch. The only thing that isn't API-able is
 * buying/connecting the sending domains+inboxes (a one-time purchase in Instantly).
 *
 * Env: INSTANTLY_API_KEY. Without it → { ok:false, skipped:true }, never throws.
 */

const BASE = 'https://api.instantly.ai/api/v2';
const TIMEOUT_MS = 15_000;

export function isEnabled() { return Boolean(process.env.INSTANTLY_API_KEY); }

async function call(method, path, body) {
  const key = process.env.INSTANTLY_API_KEY;
  if (!key) return { ok: false, skipped: true };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await r.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* non-json */ }
    if (!r.ok) return { ok: false, error: `instantly_${r.status}`, detail: (json && json.message) || text.slice(0, 200) };
    return { ok: true, data: json };
  } catch (e) {
    return { ok: false, error: e && e.name === 'AbortError' ? 'instantly_timeout' : String((e && e.message) || e) };
  } finally {
    clearTimeout(timer);
  }
}

// Business-hours, Mon–Fri schedule in the given IANA timezone (Instantly accepts e.g.
// "America/Chicago", "America/New_York"). Conservative sending window.
function schedule(timezone = 'America/Chicago') {
  return { schedules: [{ name: 'Business hours', timing: { from: '09:00', to: '17:00' },
    days: { 0: false, 1: true, 2: true, 3: true, 4: true, 5: true, 6: false }, timezone }] };
}

/**
 * Create a campaign with a multi-step email sequence.
 * @param {string} name
 * @param {Array<{subject:string, body:string, delay:number}>} steps  delay = days after previous
 * @returns {Promise<{ok:boolean, data?:{id:string}, error?:string}>}
 */
export async function createCampaign(name, steps, timezone) {
  const sequences = [{ steps: steps.map((s) => ({
    type: 'email', delay: s.delay || 0, variants: [{ subject: s.subject, body: s.body }],
  })) }];
  return call('POST', '/campaigns', { name, campaign_schedule: schedule(timezone), sequences });
}

/**
 * Add one lead to a campaign. custom holds merge variables referenced as {{key}} in the body
 * (e.g. {{pitch}}, {{automations}}, {{website_cta}}).
 */
export async function addLead(campaignId, { email, firstName, company, custom }) {
  const body = { campaign: campaignId, email };
  if (firstName) body.first_name = firstName;
  if (company) body.company_name = company;
  if (custom && typeof custom === 'object') body.custom_variables = custom;
  return call('POST', '/leads', body);
}

export async function deleteCampaign(id) { return call('DELETE', `/campaigns/${id}`); }
