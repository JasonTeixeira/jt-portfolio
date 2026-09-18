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
const VERTICAL_TIER = [
  { re: /plumb|hvac|heating|cooling|electric|roof|garage|restoration|water damage|pest|contractor|handyman/i, tier: 'A', kind: 'home services' },
  { re: /attorney|law firm|lawyer|legal|counsel/i, tier: 'A', kind: 'law firm' },
  { re: /med spa|medspa|aesthetic|dermatolog|cosmetic|iv therapy|chiroprac|wellness clinic/i, tier: 'B', kind: 'med spa / clinic' },
  { re: /auto repair|mechanic|cleaning|maid|moving|locksmith|landscap|appliance|tow/i, tier: 'B', kind: 'local service' },
  { re: /dental|dentist|clinic|medical|doctor|physician/i, tier: 'C', kind: 'medical/dental' },
  { re: /gym|fitness|studio|salon|barber|spa/i, tier: 'C', kind: 'fitness/salon' },
  { re: /restaurant|cafe|bar|food|retail|store|shop/i, tier: 'D', kind: 'restaurant/retail' },
];
const TIER_BASE = { A: 82, B: 68, C: 55, D: 38 };

function classifyVertical(text) {
  const s = String(text || '');
  for (const v of VERTICAL_TIER) if (v.re.test(s)) return v;
  return { tier: 'C', kind: 'local business' };
}

// Deterministic SMB fallback: score from vertical tier + web/reviews signals; opener pitches
// the AI front desk with the missed-call/booking angle in the business's own terms.
export function ruleScoreBusiness(biz = {}) {
  const v = classifyVertical(`${biz.type || ''} ${biz.name || ''} ${biz.vertical || ''}`);
  let score = TIER_BASE[v.tier];
  if (biz.website) score += 5;            // enrichable + established
  if ((biz.reviews || 0) >= 25) score += 5; // busy → more missed calls → more pain
  if (!biz.website) score -= 8;           // no site: great prospect but needs phone/SMS, not email
  score = Math.max(0, Math.min(100, Math.round(score)));
  const tier = v.tier === 'D' ? 'C' : v.tier; // never label a real lead below C for the operator
  const nm = biz.name || 'your team';
  const opener = `Hi — I build AI front desks for ${v.kind}s like ${nm}: it answers every call and text 24/7, books the job, and follows up on missed calls automatically, so you stop losing work to voicemail. Want a 2-minute demo on your own number?`;
  return { score, tier, reason: `${v.kind} · tier ${v.tier} closeability`, opener, personalized: false, vertical: v.kind };
}

const SMB_SYS = `You qualify LOCAL SMB leads for Jason Teixeira (Sage Ideas LLC), who sells AI automation to local businesses: an "AI front desk" that answers calls/texts 24/7, books jobs/appointments, does missed-call text-back, and automates review requests. Given one business, output STRICT JSON only:
{"score": <0-100 likelihood to buy a retainer>, "tier": "A"|"B"|"C", "reason": "<=12 words", "opener": "<1-2 sentence warm, specific cold-email opener that names their business/trade and leads with the missed-call or booking pain + a free demo offer; never states a price>"}
Score highest for home services + solo law firms (a missed call = a lost job/case); lower for restaurants/retail. opener must be human and specific. Return ONLY the JSON object.`;

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
    const parsed = parseScore(text);
    return { ok: true, data: parsed ? { ...parsed, vertical: classifyVertical(`${biz.type || ''} ${biz.name || ''}`).kind } : ruleScoreBusiness(biz) };
  } catch {
    return { ok: true, data: ruleScoreBusiness(biz) };
  } finally {
    clearTimeout(timer);
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
