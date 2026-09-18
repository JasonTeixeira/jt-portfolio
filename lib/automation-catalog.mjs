/**
 * lib/automation-catalog.mjs — the full menu of AI automations Sage Ideas offers SMBs.
 *
 * The outbound engine doesn't pitch one product — for each sourced business it selects the
 * automations that actually fit that business and assembles a TAILORED proposal. This catalog
 * is the source of truth the proposal generator (lib/lead-score.mjs) picks from, and it drives
 * the SMB landing page + outreach copy so everything stays consistent.
 *
 * Keep entries concrete and outcome-first. `fit` tags let the rule-based fallback pick sensible
 * defaults per vertical without the LLM; the LLM uses the whole catalog to choose per business.
 */

export const AUTOMATIONS = [
  { id: 'ai-receptionist', name: 'AI receptionist / front desk',
    outcome: 'answers every call and text 24/7, books the job, and never sends a customer to voicemail',
    fit: ['home-services', 'legal', 'clinic', 'local-service', 'fitness', 'all'] },
  { id: 'missed-call-textback', name: 'Missed-call text-back',
    outcome: 'the instant you miss a call, it auto-texts the caller so the lead never goes cold',
    fit: ['home-services', 'legal', 'clinic', 'local-service', 'all'] },
  { id: 'speed-to-lead', name: 'Speed-to-lead follow-up',
    outcome: 'responds to every web/ad lead in seconds — the #1 driver of whether a lead converts',
    fit: ['home-services', 'legal', 'clinic', 'local-service', 'all'] },
  { id: 'website-assistant', name: 'AI website assistant',
    outcome: 'qualifies visitors and books appointments right from your site, day or night',
    fit: ['clinic', 'fitness', 'legal', 'local-service', 'all'] },
  { id: 'booking-reminders', name: 'Booking + no-show reminders',
    outcome: 'automated scheduling and SMS reminders that cut no-shows and fill the calendar',
    fit: ['clinic', 'fitness', 'local-service', 'all'] },
  { id: 'review-engine', name: 'Review generation',
    outcome: 'automatically asks happy customers for a review after each job — more 5-stars, higher ranking',
    fit: ['home-services', 'clinic', 'local-service', 'fitness', 'restaurant', 'all'] },
  { id: 'quote-estimate', name: 'Quote & estimate automation',
    outcome: 'turns an inquiry into a quote fast, so you win the job before a competitor calls back',
    fit: ['home-services', 'local-service'] },
  { id: 'intake-automation', name: 'Client intake automation',
    outcome: 'collects and organizes new-client info automatically — no more manual intake forms',
    fit: ['legal', 'clinic'] },
  { id: 'doc-processing', name: 'Document & form processing',
    outcome: 'AI reads, sorts, and extracts data from incoming documents and forms',
    fit: ['legal', 'clinic', 'professional'] },
  { id: 'nurture-sequences', name: 'Email/SMS nurture sequences',
    outcome: 'automated follow-up that keeps leads warm and brings past customers back',
    fit: ['home-services', 'clinic', 'fitness', 'local-service', 'all'] },
  { id: 'crm-workflow', name: 'Back-office workflow automation',
    outcome: 'connects your tools and kills the repetitive admin eating your team’s week',
    fit: ['professional', 'legal', 'all'] },
  { id: 'reporting', name: 'Reporting dashboard',
    outcome: 'one view of calls, leads, bookings, and revenue so you know what’s working',
    fit: ['all'] },
];

export const BY_ID = new Map(AUTOMATIONS.map((a) => [a.id, a]));

// Map a normalized vertical (from lib/lead-score.mjs classifyVertical) → sensible default
// automation picks for the rule-based fallback (used when the LLM is off).
export const DEFAULTS_BY_VERTICAL = {
  'home services': ['ai-receptionist', 'missed-call-textback', 'speed-to-lead', 'review-engine'],
  'law firm': ['ai-receptionist', 'speed-to-lead', 'intake-automation', 'missed-call-textback'],
  'med spa / clinic': ['ai-receptionist', 'booking-reminders', 'website-assistant', 'review-engine'],
  'medical/dental': ['ai-receptionist', 'booking-reminders', 'intake-automation', 'review-engine'],
  'local service': ['ai-receptionist', 'missed-call-textback', 'quote-estimate', 'review-engine'],
  'fitness/salon': ['booking-reminders', 'website-assistant', 'nurture-sequences', 'review-engine'],
  'restaurant/retail': ['review-engine', 'nurture-sequences', 'reporting'],
  'local business': ['ai-receptionist', 'missed-call-textback', 'review-engine'],
};

export function defaultAutomationsFor(verticalKind) {
  const ids = DEFAULTS_BY_VERTICAL[verticalKind] || DEFAULTS_BY_VERTICAL['local business'];
  return ids.map((id) => BY_ID.get(id)).filter(Boolean);
}

// Compact catalog string for the LLM prompt (id — name: outcome).
export function catalogForPrompt() {
  return AUTOMATIONS.map((a) => `${a.id} — ${a.name}: ${a.outcome}`).join('\n');
}
