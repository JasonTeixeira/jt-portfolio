/**
 * niches.mjs — the niche catalog. ONE source of truth that drives niche-specific
 * copy on the automations microsite (?niche=law), lead sourcing (score-leads),
 * the AI Front Desk trade config, and the Time-Back Audit examples.
 *
 * Add a niche = add an entry. Every surface personalizes automatically.
 * Coverage target: the SMB service economy (trades, professional, health, other).
 *
 * Fields per niche:
 *   label     display name
 *   cat       trades | professional | health | property | other
 *   trade     phrase for the AI receptionist ("a {trade} business")
 *   hook      one-line pain hook (their biggest leak/time-sink)
 *   sinks     top automatable time-sinks (audit + copy fodder)
 *   keywords  Google-Maps/search terms for sourcing (score-leads)
 *   avgJob    rough average job/customer value (ROI calculator default, USD)
 */

export const NICHES = {
  // ── trades / home services ──────────────────────────────────────
  plumbing:      { label: 'Plumbing', cat: 'trades', trade: 'plumbing', hook: 'Every missed call after hours is a burst-pipe job going to the next plumber.', sinks: ['missed-call text-back', 'after-hours booking', 'quote follow-up', 'review requests'], keywords: ['plumber', 'plumbing'], avgJob: 450 },
  hvac:          { label: 'HVAC', cat: 'trades', trade: 'heating & cooling', hook: 'A no-AC call in July that hits voicemail is a $6k install you just lost.', sinks: ['24/7 call answering', 'maintenance reminders', 'quote follow-up', 'seasonal reactivation'], keywords: ['hvac', 'air conditioning', 'air condition', 'heating', 'cooling', 'furnace', 'ac repair', 'heat pump', 'climate control'], avgJob: 700 },
  electrical:    { label: 'Electrical', cat: 'trades', trade: 'electrical', hook: 'Emergency electrical calls you miss go straight to a competitor.', sinks: ['missed-call text-back', 'estimate follow-up', 'scheduling', 'reviews'], keywords: ['electrician', 'electrical'], avgJob: 500 },
  roofing:       { label: 'Roofing', cat: 'trades', trade: 'roofing', hook: 'Storm leads are a race — slow follow-up means the roof goes to someone else.', sinks: ['speed-to-lead', 'estimate follow-up', 'financing follow-up', 'reviews'], keywords: ['roofing', 'roofer'], avgJob: 9000 },
  restoration:   { label: 'Restoration', cat: 'trades', trade: 'water & fire damage restoration', hook: 'Water damage is 24/7 and insurance-funded — a missed 2am call is a $12k job gone.', sinks: ['24/7 call answering', 'insurance intake', 'status updates', 'reviews'], keywords: ['restoration', 'water damage', 'fire damage', 'flood', 'mold', 'mitigation', 'remediation', 'disaster', 'water removal', 'damage repair'], avgJob: 8000 },
  garage:        { label: 'Garage Door', cat: 'trades', trade: 'garage door', hook: 'Stuck-door calls are urgent and easy to lose to voicemail.', sinks: ['missed-call text-back', 'scheduling', 'quote follow-up', 'reviews'], keywords: ['garage door'], avgJob: 400 },
  pest:          { label: 'Pest Control', cat: 'trades', trade: 'pest control', hook: 'Recurring-service reminders and rebooking done by hand eat your week.', sinks: ['recurring reminders', 'reactivation', 'speed-to-lead', 'reviews'], keywords: ['pest control', 'exterminator'], avgJob: 250 },
  landscaping:   { label: 'Landscaping', cat: 'trades', trade: 'landscaping & lawn care', hook: 'Quotes and seasonal rebooking pile up and get dropped.', sinks: ['quote follow-up', 'seasonal reactivation', 'scheduling', 'reviews'], keywords: ['landscaping', 'lawn care'], avgJob: 600 },
  cleaning:      { label: 'Cleaning Services', cat: 'trades', trade: 'cleaning service', hook: 'Booking, rescheduling, and reminders by text all day is a full-time job.', sinks: ['online booking', 'reminders', 'reactivation', 'reviews'], keywords: ['cleaning service', 'house cleaning', 'maid service'], avgJob: 200 },
  auto:          { label: 'Auto Repair', cat: 'trades', trade: 'auto repair shop', hook: 'Status calls and appointment chasing tie up your front desk.', sinks: ['appointment reminders', 'status updates', 'speed-to-lead', 'reviews'], keywords: ['auto repair', 'mechanic', 'auto shop'], avgJob: 500 },
  handyman:      { label: 'Handyman', cat: 'trades', trade: 'handyman service', hook: 'Small jobs, big volume — the admin of quoting and scheduling never ends.', sinks: ['missed-call text-back', 'quote follow-up', 'scheduling', 'reviews'], keywords: ['handyman'], avgJob: 350 },
  moving:        { label: 'Moving Companies', cat: 'trades', trade: 'moving company', hook: 'Quote requests come in bursts and go cold in hours.', sinks: ['speed-to-lead', 'quote follow-up', 'scheduling', 'reviews'], keywords: ['moving company', 'movers'], avgJob: 1200 },

  // ── professional services ───────────────────────────────────────
  law:           { label: 'Law Firms', cat: 'professional', trade: 'law firm', hook: 'Intake, document collection, and client updates by hand bury your paralegals.', sinks: ['new-client intake', 'document collection', 'consult scheduling', 'client status updates', 'billing follow-up'], keywords: ['law firm', 'attorney', 'lawyer'], avgJob: 3500 },
  accounting:    { label: 'Accounting & Bookkeeping', cat: 'professional', trade: 'accounting firm', hook: 'Client onboarding and document chasing every tax season is pure manual grind.', sinks: ['client onboarding', 'document collection', 'reminder sequences', 'reporting'], keywords: ['accounting', 'bookkeeping', 'cpa', 'tax'], avgJob: 2000 },
  realestate:    { label: 'Real Estate', cat: 'professional', trade: 'real estate team', hook: 'Leads go cold in minutes and transaction coordination eats your day.', sinks: ['speed-to-lead', 'lead nurture', 'transaction coordination', 'reviews'], keywords: ['real estate', 'realtor', 'real estate agent'], avgJob: 8000 },
  insurance:     { label: 'Insurance Agencies', cat: 'professional', trade: 'insurance agency', hook: 'Quote requests and policy renewals done by hand leak revenue.', sinks: ['speed-to-lead', 'renewal reminders', 'quote follow-up', 'reviews'], keywords: ['insurance agency', 'insurance agent'], avgJob: 900 },
  financial:     { label: 'Financial Advisors', cat: 'professional', trade: 'financial advisory firm', hook: 'Prospect follow-up and review scheduling slip through the cracks.', sinks: ['lead nurture', 'review scheduling', 'onboarding', 'reminders'], keywords: ['financial advisor', 'financial planning', 'wealth management'], avgJob: 3000 },
  marketing:     { label: 'Marketing Agencies', cat: 'professional', trade: 'marketing agency', hook: 'Client onboarding, reporting, and check-ins swallow billable hours.', sinks: ['client onboarding', 'automated reporting', 'lead nurture', 'reviews'], keywords: ['marketing agency', 'digital agency'], avgJob: 3000 },

  // ── health / wellness ───────────────────────────────────────────
  dental:        { label: 'Dental Practices', cat: 'health', trade: 'dental practice', hook: 'Missed calls and no-shows cost you $3k patients you never hear about.', sinks: ['24/7 call answering', 'appointment reminders', 'no-show recovery', 'recall reactivation', 'reviews'], keywords: ['dentist', 'dental'], avgJob: 800 },
  medical:       { label: 'Medical Clinics', cat: 'health', trade: 'medical clinic', hook: 'Front-desk phone volume and reminders overwhelm your staff.', sinks: ['call answering', 'appointment reminders', 'no-show recovery', 'intake'], keywords: ['medical clinic', 'urgent care', 'family practice'], avgJob: 400 },
  chiro:         { label: 'Chiropractic', cat: 'health', trade: 'chiropractic clinic', hook: 'Rebooking and recall by hand leaks recurring visits.', sinks: ['recall reactivation', 'reminders', 'speed-to-lead', 'reviews'], keywords: ['chiropractor', 'chiropractic'], avgJob: 120 },
  medspa:        { label: 'Med Spas', cat: 'health', trade: 'med spa', hook: 'DMs, bookings, and reminders across channels are a mess to manage.', sinks: ['online booking', 'reminders', 'reactivation', 'reviews'], keywords: ['med spa', 'medical spa', 'aesthetics'], avgJob: 400 },
  vet:           { label: 'Veterinary', cat: 'health', trade: 'veterinary clinic', hook: 'Appointment and reminder volume swamps the front desk.', sinks: ['call answering', 'reminders', 'no-show recovery', 'reviews'], keywords: ['veterinary', 'vet clinic', 'animal hospital'], avgJob: 300 },
  salon:         { label: 'Salons & Barbers', cat: 'health', trade: 'salon', hook: 'No-shows and empty chairs from manual booking cost real money.', sinks: ['online booking', 'reminders', 'reactivation', 'reviews'], keywords: ['salon', 'hair salon', 'barber'], avgJob: 80 },
  fitness:       { label: 'Gyms & Fitness', cat: 'health', trade: 'fitness studio', hook: 'Lead follow-up and member reactivation are left undone.', sinks: ['speed-to-lead', 'trial follow-up', 'reactivation', 'reviews'], keywords: ['gym', 'fitness studio', 'personal training'], avgJob: 150 },

  // ── property / other ────────────────────────────────────────────
  propmgmt:      { label: 'Property Management', cat: 'property', trade: 'property management company', hook: 'Maintenance requests and tenant comms by hand never stop.', sinks: ['maintenance intake', 'tenant comms', 'reminders', 'reporting'], keywords: ['property management'], avgJob: 250 },
  contractor:    { label: 'Contractors / Construction', cat: 'property', trade: 'general contractor', hook: 'Bid follow-up and project updates fall through the cracks.', sinks: ['speed-to-lead', 'bid follow-up', 'project updates', 'reviews'], keywords: ['general contractor', 'construction', 'remodeling'], avgJob: 15000 },
  events:        { label: 'Event & Catering', cat: 'other', trade: 'event services business', hook: 'Inquiry follow-up and scheduling are slow and manual.', sinks: ['speed-to-lead', 'inquiry follow-up', 'scheduling', 'reviews'], keywords: ['event planning', 'catering', 'event venue'], avgJob: 3000 },
};

export const NICHE_KEYS = Object.keys(NICHES);
export const DEFAULT_NICHE = 'restoration';

/** Resolve a niche by key (slug), else the default. */
export function getNiche(key) {
  const k = String(key || '').toLowerCase().trim();
  return { key: NICHES[k] ? k : DEFAULT_NICHE, ...(NICHES[k] || NICHES[DEFAULT_NICHE]) };
}

/** Group niches by category for index/listing pages. */
export function nichesByCategory() {
  const out = {};
  for (const k of NICHE_KEYS) {
    const c = NICHES[k].cat;
    (out[c] = out[c] || []).push({ key: k, ...NICHES[k] });
  }
  return out;
}
