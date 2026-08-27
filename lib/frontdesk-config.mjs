/**
 * frontdesk-config.mjs — multi-tenant config for the AI Front Desk.
 *
 * Each client (and the public demo) is ONE entry here — business name, trade,
 * services, hours, booking target, owner alert number. Standing up a new client
 * = add an entry, point their Twilio number at the webhook, done. That's the
 * productization: no per-client code.
 *
 * The demo tenant is what a prospect texts/calls to see it work live.
 */

export const DEMO_TENANT = 'demo';

// Env-overridable owner alert number for the demo (where lead alerts go — you).
const DEMO_OWNER = process.env.FRONTDESK_DEMO_OWNER_PHONE || '';

/** @typedef {{ name:string, trade:string, services:string[], hours:string, ownerPhone:string, bookingNote:string }} Tenant */

/** Built-in tenants. Real clients get added here (or loaded from Supabase later). */
export const TENANTS = {
  [DEMO_TENANT]: {
    name: 'Sage Demo Services',
    trade: 'home services (demo)',
    services: ['plumbing', 'HVAC', 'water damage / restoration', 'general repair'],
    hours: 'Mon–Sat 7am–7pm, with 24/7 emergency booking',
    ownerPhone: DEMO_OWNER,
    bookingNote: 'This is a live demo of Jason\'s AI Front Desk. It books real appointment slots in the demo, and texts the owner a summary — exactly what a paying client gets.',
  },
};

/**
 * Resolve which tenant an inbound message/call belongs to. In production you
 * map the RECEIVING Twilio number → tenant. For the single demo number we
 * default to the demo tenant. `toNumber` is the number that was texted/called.
 */
export function resolveTenant(toNumber) {
  const map = numberMap();
  const key = map[normalize(toNumber)] || DEMO_TENANT;
  return { key, tenant: TENANTS[key] || TENANTS[DEMO_TENANT] };
}

// Optional env mapping: "FRONTDESK_NUMBERS=+15551230000:demo,+15551239999:acme"
function numberMap() {
  const raw = process.env.FRONTDESK_NUMBERS || '';
  const out = {};
  raw.split(',').map((p) => p.trim()).filter(Boolean).forEach((pair) => {
    const [num, key] = pair.split(':');
    if (num && key) out[normalize(num)] = key.trim();
  });
  return out;
}

function normalize(n) { return String(n || '').replace(/[^\d+]/g, ''); }
