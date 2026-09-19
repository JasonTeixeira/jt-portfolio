/**
 * lib/lead-score.mjs — AI qualification for the outbound engine.
 *
 * Turns a raw sourced contact into a scored, prioritized, personalized lead: a 0–100 fit
 * score, an A/B/C tier, a one-line reason, and a specific cold-email opener referencing what
 * this person/company actually does. Uses the same OpenAI-compatible LLM the demo receptionist
 * uses (LLM_API_KEY / LLM_BASE_URL / LLM_MODEL). If the LLM isn't configured, a deterministic
 * rule-based fallback keeps sourcing working — you still get a usable score and a templated
 * opener, just not an AI-personalized one.
 *
 * Never throws: an LLM hiccup or a malformed completion falls back to the rule-based score.
 */

import { BY_ID, defaultAutomationsFor, catalogForPrompt } from './automation-catalog.mjs';

const TIMEOUT_MS = 20_000;

export function isEnabled() {
  return Boolean(process.env.LLM_API_KEY && process.env.LLM_BASE_URL && process.env.LLM_MODEL);
}

// Jason sells to teams SHIPPING LLM/AI features who need them proven (eval, QA, safety) or
// built. Seniority + an AI/eng signal in the title is the strongest cheap predictor of fit.
const SENIOR = /\b(cto|vp|head|director|chief|founder|co-?founder|principal|lead|staff)\b/i;
const AI_ENG = /\b(ai|ml|machine learning|llm|data|engineering|engineer|product|platform|quality|qa|devops)\b/i;

// Deterministic fallback — used when the LLM is off or fails. Bounded, explainable.
export function ruleScore(person = {}) {
  const title = String(person.title || '');
  let score = 40;
  if (SENIOR.test(title)) score += 30;
  if (AI_ENG.test(title)) score += 20;
  if (person.company) score += 5;
  if (person.email) score += 5;
  score = Math.max(0, Math.min(100, score));
  const tier = score >= 75 ? 'A' : score >= 55 ? 'B' : 'C';
  const who = person.firstName || (person.name || '').split(' ')[0] || 'there';
  const co = person.company ? ` at ${person.company}` : '';
  const opener = `Hi ${who} — I help teams shipping AI features prove they actually work (LLM evals, safety testing, CI quality gates). Saw your work${co} and thought a quick, free evaluation of one live feature might be useful.`;
  return { score, tier, reason: 'rule-based fit (title seniority + AI/eng signal)', opener, personalized: false };
}

// ── Local-SMB scoring (Lane A: AI front desk / automation) ───────────────────────────────
// Closeability by vertical (see docs/OUTBOUND_TARGETING.md): missed-call/lead economics +
// speed of owner decision + how underserved they are. Home services & solo legal close best;
// restaurants/retail close worst.
// Ordered specific → generic (first match wins). Tier = closeability for AI automation:
// A = a missed lead costs a lot + owner decides fast + underserved; D = thin-margin volume trap.
const VERTICAL_TIER = [
  // ── Tier A: highest close — a lost lead = real money, fast decisions ──
  { re: /plumb|hvac|heating|cooling|air condition|electric|roof|garage|restoration|water damage|fire damage|pest|remodel|renovat|general contractor|handyman|excavat|concrete|foundation|septic|solar install/i, tier: 'A', kind: 'home services' },
  { re: /attorney|law firm|lawyer|legal|counsel|law office|litigation/i, tier: 'A', kind: 'law firm' },
  { re: /real estate|realtor|realty|real-estate|home sales|property sales|brokerage/i, tier: 'A', kind: 'real estate' },
  { re: /insurance agen|insurance broker|insurance servic/i, tier: 'A', kind: 'insurance agency' },
  { re: /mortgage|lending|loan officer|home loan/i, tier: 'A', kind: 'mortgage / lending' },
  // ── Tier B: strong — high value or booking/intake heavy, a bit more friction ──
  { re: /med spa|medspa|aesthetic|dermatolog|cosmetic|plastic surg|iv therapy|hair restoration|weight loss clinic|wellness clinic/i, tier: 'B', kind: 'med spa / clinic' },
  { re: /dental|dentist|orthodont|endodont/i, tier: 'B', kind: 'dental' },
  { re: /veterinar|animal hospital|pet clinic/i, tier: 'B', kind: 'veterinary' },
  { re: /chiroprac|physical therapy|physiotherap|optometr|audiolog/i, tier: 'B', kind: 'specialty health' },
  { re: /property manage|hoa manage|apartment|leasing office/i, tier: 'B', kind: 'property management' },
  { re: /accounting|accountant|bookkeep|tax service|cpa|payroll/i, tier: 'B', kind: 'accounting / tax' },
  { re: /marketing agenc|advertising agenc|digital agenc|web design|seo agenc|creative agenc|branding/i, tier: 'B', kind: 'agency' },
  { re: /financial advisor|wealth manage|financial planning|investment advis/i, tier: 'B', kind: 'financial advisor' },
  { re: /auto dealer|car dealer|dealership|rv dealer|motorcycle dealer/i, tier: 'B', kind: 'dealership' },
  { re: /home care|senior care|assisted living|home health|hospice|caregiv/i, tier: 'B', kind: 'senior / home care' },
  { re: /staffing|recruit|employment agenc/i, tier: 'B', kind: 'staffing / recruiting' },
  { re: /auto repair|mechanic|body shop|cleaning|maid|janitor|moving|locksmith|landscap|lawn|appliance repair|tow|pressure wash|window|pool servic|security system|it servic|managed servic|msp/i, tier: 'B', kind: 'local service' },
  // ── Tier C: workable, more price-sensitive / has incumbents ──
  { re: /clinic|medical|doctor|physician|urgent care|pediatric|family practice/i, tier: 'C', kind: 'medical' },
  { re: /gym|fitness|studio|pilates|yoga|crossfit|salon|barber|spa|tattoo|massage/i, tier: 'C', kind: 'fitness / salon' },
  { re: /tutor|school|academy|training center|driving school|daycare|childcare/i, tier: 'C', kind: 'education' },
  { re: /travel agenc|event plan|photograph|catering|florist|funeral/i, tier: 'C', kind: 'events / lifestyle' },
  // ── Tier D: volume trap — thin margins, low ticket, high churn ──
  { re: /restaurant|cafe|coffee|bar|food|bakery|retail|store|boutique|grocery/i, tier: 'D', kind: 'restaurant / retail' },
];
const TIER_BASE = { A: 82, B: 68, C: 55, D: 38 };

function classifyVertical(text) {
  const s = String(text || '');
  for (const v of VERTICAL_TIER) if (v.re.test(s)) return v;
  return { tier: 'C', kind: 'local business' };
}

// Deterministic SMB fallback: score from vertical tier + web/reviews signals, pick the
// automations that fit this vertical from the catalog, and assemble a TAILORED pitch that
// names 2-3 of them in the business's own terms. No LLM required.
export function ruleScoreBusiness(biz = {}) {
  const v = classifyVertical(`${biz.type || ''} ${biz.name || ''} ${biz.vertical || ''}`);
  let score = TIER_BASE[v.tier];
  if (biz.website) score += 5;            // enrichable + established
  if ((biz.reviews || 0) >= 25) score += 5; // busy → more missed calls → more pain
  if (!biz.website) score -= 8;           // no site: great prospect but needs phone/SMS, not email
  score = Math.max(0, Math.min(100, Math.round(score)));
  const tier = v.tier === 'D' ? 'C' : v.tier; // never label a real lead below C for the operator
  const picks = defaultAutomationsFor(v.kind).slice(0, 3);
  const nm = biz.name || 'your team';
  const list = picks.map((a) => a.outcome).slice(0, 2).join(', and ');
  const pitch = `Hi — for ${nm}, I'd set up AI automation that ${list}. It runs in the background so you stop losing work to missed calls and manual follow-up. Want a quick, tailored breakdown for your business — no cost?`;
  return {
    score, tier, reason: `${v.kind} · tier ${v.tier} closeability`,
    automations: picks.map((a) => ({ id: a.id, name: a.name, outcome: a.outcome })),
    pitch, opener: pitch, personalized: false, vertical: v.kind,
  };
}

const SMB_SYS = `You build TAILORED AI-automation proposals for Jason Teixeira (Sage Ideas LLC), who offers local businesses a full range of AI automation — not one product. Given one business, pick the automations from THIS catalog that best fit it and write a proposal tailored to that specific business.

CATALOG (id — name: outcome):
${catalogForPrompt()}

Output STRICT JSON only:
{"score": <0-100 likelihood to buy>, "tier": "A"|"B"|"C", "reason": "<=12 words", "automations": ["<id>","<id>","<id>"], "pitch": "<2-3 sentence cold-email proposal that names their business/trade, calls out a likely pain, and proposes the 2-3 chosen automations in plain outcome terms; offers a free tailored breakdown; never states a price>"}

Rules: choose 2-4 automation IDs that genuinely fit this business's trade/size. Score highest for home services + solo law firms (a missed call = a lost job/case), lower for restaurants/retail. pitch must be human and specific to them. Return ONLY the JSON object.`;

const SYS = `You qualify inbound sales leads for Jason Teixeira, a senior AI-automation + QA / LLM-evaluation engineer (Sage Ideas LLC). He sells to teams SHIPPING LLM/AI features who need them PROVEN (evaluation harnesses, adversarial safety testing, CI quality gates) or built. Given one contact, output STRICT JSON only:
{"score": <0-100 fit>, "tier": "A"|"B"|"C", "reason": "<=12 words", "opener": "<1-2 sentence warm, specific, non-salesy cold-email opener that references their role/company and offers a FREE evaluation of one live AI feature>"}
Rules: score high only for people who plausibly own or influence shipping AI/software. opener must be human, specific, and never promise prices. Return ONLY the JSON object, no prose.`;

/**
 * @param {object} person normalized contact { name, firstName, title, company, domain, email }
 * @returns {Promise<{ok:boolean, data:{score:number,tier:string,reason:string,opener:string,personalized:boolean}}>}
 *          Always ok:true with a usable score (AI or rule-based) — never throws.
 */
export async function scoreLead(person = {}) {
  if (!isEnabled()) return { ok: true, data: ruleScore(person) };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(`${process.env.LLM_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.LLM_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.LLM_MODEL,
        max_tokens: 260,
        temperature: 0.4,
        messages: [
          { role: 'system', content: SYS },
          { role: 'user', content: `Contact:\nName: ${person.name || ''}\nTitle: ${person.title || ''}\nCompany: ${person.company || ''}\nDomain: ${person.domain || ''}` },
        ],
      }),
      signal: controller.signal,
    });
    if (!resp.ok) return { ok: true, data: ruleScore(person) };
    const json = await resp.json();
    const text = json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
    const parsed = parseScore(text);
    return { ok: true, data: parsed || ruleScore(person) };
  } catch {
    return { ok: true, data: ruleScore(person) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Score a LOCAL BUSINESS for the AI-automation lane (Lane A). Same contract as scoreLead:
 * always ok:true with a usable {score,tier,reason,opener}, AI-personalized when the LLM is on,
 * rule-based otherwise. Never throws.
 * @param {object} biz normalized Places business { name, type, vertical, website, reviews, address }
 */
export async function scoreBusiness(biz = {}) {
  if (!isEnabled()) return { ok: true, data: ruleScoreBusiness(biz) };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(`${process.env.LLM_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.LLM_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.LLM_MODEL,
        max_tokens: 260,
        temperature: 0.4,
        messages: [
          { role: 'system', content: SMB_SYS },
          { role: 'user', content: `Business:\nName: ${biz.name || ''}\nType/trade: ${biz.type || biz.vertical || ''}\nWebsite: ${biz.website ? 'yes' : 'no'}\nReviews: ${biz.reviews || 0}\nArea: ${biz.address || ''}` },
        ],
      }),
      signal: controller.signal,
    });
    if (!resp.ok) return { ok: true, data: ruleScoreBusiness(biz) };
    const json = await resp.json();
    const text = json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
    const parsed = parseProposal(text);
    return { ok: true, data: parsed ? { ...parsed, vertical: classifyVertical(`${biz.type || ''} ${biz.name || ''}`).kind } : ruleScoreBusiness(biz) };
  } catch {
    return { ok: true, data: ruleScoreBusiness(biz) };
  } finally {
    clearTimeout(timer);
  }
}

// Parse a tailored-proposal completion: {score,tier,reason,automations:[ids],pitch}.
// automation IDs are validated against the catalog (unknown ones dropped); pitch required.
export function parseProposal(text) {
  if (typeof text !== 'string') return null;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]);
    let score = Number(o.score);
    if (!Number.isFinite(score)) return null;
    score = Math.max(0, Math.min(100, Math.round(score)));
    const pitch = typeof o.pitch === 'string' && o.pitch.trim() ? o.pitch.trim().slice(0, 700) : null;
    if (!pitch) return null;
    const tier = ['A', 'B', 'C'].includes(o.tier) ? o.tier : (score >= 75 ? 'A' : score >= 55 ? 'B' : 'C');
    const ids = Array.isArray(o.automations) ? o.automations : [];
    const automations = [];
    const seen = new Set();
    for (const id of ids) {
      const a = typeof id === 'string' && BY_ID.get(id);
      if (a && !seen.has(a.id)) { seen.add(a.id); automations.push({ id: a.id, name: a.name, outcome: a.outcome }); }
      if (automations.length >= 4) break;
    }
    return { score, tier, reason: String(o.reason || '').slice(0, 120), automations, pitch, opener: pitch, personalized: true };
  } catch {
    return null;
  }
}

// Defensively pull the JSON object out of a completion (models sometimes wrap it in prose/fences).
export function parseScore(text) {
  if (typeof text !== 'string') return null;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]);
    let score = Number(o.score);
    if (!Number.isFinite(score)) return null;
    score = Math.max(0, Math.min(100, Math.round(score)));
    const tier = ['A', 'B', 'C'].includes(o.tier) ? o.tier : (score >= 75 ? 'A' : score >= 55 ? 'B' : 'C');
    const opener = typeof o.opener === 'string' && o.opener.trim() ? o.opener.trim().slice(0, 500) : null;
    if (!opener) return null;
    return { score, tier, reason: String(o.reason || '').slice(0, 120), opener, personalized: true };
  } catch {
    return null;
  }
}
