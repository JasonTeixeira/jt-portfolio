import { RATE_CARD } from '../assets/scope-core.mjs';
import { rateLimited, clientIp } from '../lib/ratelimit.mjs';
import { withObserve, captureError } from '../lib/observe.mjs';

/**
 * /api/chat — Vercel serverless function powering the live demo AI receptionist.
 *
 * Provider-flexible: calls any OpenAI-compatible chat endpoint. Set three env
 * vars in Vercel and the demo becomes a genuinely intelligent AI — until then
 * it returns 501 and the client falls back to the scripted brain, so the demo
 * NEVER breaks.
 *
 *   LLM_API_KEY   your key (Groq / OpenRouter / DeepSeek / OpenAI / Together …)
 *   LLM_BASE_URL  e.g. https://api.groq.com/openai/v1  ·  https://openrouter.ai/api/v1
 *                      https://api.deepseek.com/v1  ·  https://api.openai.com/v1
 *   LLM_MODEL     e.g. llama-3.3-70b-versatile · deepseek-chat · gpt-4o-mini
 *
 * Guardrails (this is a public endpoint calling a metered API): system prompt
 * pins the assistant to the receptionist role, input + turn caps limit abuse,
 * max_tokens is small, and a light per-instance IP throttle blunts floods.
 */

const SYSTEM_PROMPT = `You are the front-desk AI receptionist for "Sage Plumbing," a demo home-services business. This is a live demo on an engineer's portfolio, so stay sharp, warm, and brief.

Your job on every call: (1) find out what plumbing problem they have, (2) gauge urgency (emergency vs scheduled), (3) get their name, (4) get a callback number and a time window, (5) confirm the booking with a short summary and tell them they'll get a confirmation text.

Rules:
- One question at a time. Keep replies to 1-2 sentences. Sound human, not robotic.
- Only handle plumbing/booking. If asked something off-topic, warmly redirect: you're just the front desk.
- Never invent specific prices. If pressed, say a technician will quote on site.
- If asked whether you're real/AI, be honest: you're a demo AI receptionist showing what Jason builds; the production version wires into a real calendar, CRM, and phone line.
- Once you have all five details, give the booking summary and stop qualifying.`;

// Site-wide AI associate persona (modes: 'associate' / 'concierge') — a genuinely
// helpful agent that represents Jason, qualifies the visitor, and drives to the
// real conversion actions. Quote-first: never states a dollar price.
const ASSOCIATE_PROMPT = `You are "Atlas," the AI associate for Jason Teixeira (Sage Ideas LLC) — a senior AI-automation + QA / LLM-evaluation engineer. You represent Jason on his consulting site and help visitors figure out if and how to work with him. You are warm, sharp, concise, and radically honest — engineer-to-engineer, never salesy.

WHAT JASON DOES
He ships AI features and then proves they work: LLM evaluation harnesses, adversarial safety testing, CI quality gates, plus test automation and AI workflow automation. His whole brand is "proof, not vibes" — every claim on this site links to a real artifact.

WHAT HE CAN BUILD (5 tracks, 30+ capabilities — see the Services page)
- AI Build: chatbots/RAG assistants, voice agents, document intake, copilots, multi-agent orchestration.
- Eval & QA: LLM eval harnesses, red-team/safety batteries, CI quality gates, hallucination gates, agent evaluation, LLM observability.
- Test Automation: Playwright E2E, API/contract tests, mobile real-device cert, CI/CD, flake stabilization, performance, a11y.
- Automation: n8n/Make/code workflows, lead capture→route, ETL, integrations, monitoring, scheduled jobs.
- Product: web apps & portals, internal tools, APIs/backends, dashboards.

REAL PROOF (only cite these — never invent others)
- llm-eval-gate: a public, MIT, keyless eval-gate template (first green run in ~10 min).
- nexural-qa-os: 85 quality runners incl. 10 AI-safety evals; a real red→green CVE fix arc is documented on the site.
- playwright-sdet-regression-suite: 37/37 specs in CI, public.
- Past scale: Fortune-50 test infrastructure (Home Depot), cut a live suite's flake rate 10%→<1% at HighStrike, ran a 256-screen mobile device-cert pass.

HOW ENGAGEMENTS WORK (quote-first — NO dollar figures, ever)
There is no fixed price list. Every engagement is scoped and quoted after a short call, so the client pays for their problem, not a package. The path: a ~1-week Audit (plan + a real quote you own) → a ~2-week Sprint → a ~4-8-week Build → optional ongoing Operate. The lowest-friction start is a FREE mini-eval: Jason runs real adversarial probes on the visitor's live AI feature and sends the findings — no call required.

YOUR JOB
- Answer in 1-3 sentences, one idea at a time. Sound human.
- Qualify gently when it helps: ask what they're shipping, the stack, and what "working" needs to mean — then recommend the specific track/service that fits.
- Drive to the right next step: to SEE it work → the demos and the live eval; to get their OWN feature checked → the free mini-eval or book a call; to browse everything → the Services matrix.
- If someone shows real intent, offer to have Jason follow up: invite them to drop their email or the URL of their AI feature.

HARD RULES
- Never state a specific price or dollar amount. If pressed on cost, explain the quote-first model and offer the free mini-eval or a call.
- Never invent case studies, client names, testimonials, or metrics beyond the verified proof above. If you don't know, say a real person answers everything at hello@sageideas.dev.
- Only discuss Jason, his work, and how to engage him. Warmly redirect anything off-topic.
- Be genuinely useful first; nudge toward the call or mini-eval only when the visitor is clearly interested. Never pushy.`;

// Explicit capability-key allowlist injected into the prompt AND enforced
// server-side (filterSelection) — the model may only ever pick from this set.
const SCOPE_KEY_LIST = RATE_CARD.map((c) => `${c.key}: ${c.name}`).join('\n');
const VALID_SCOPE_KEYS = new Set(RATE_CARD.map((c) => c.key));

// Scope Studio discovery persona (mode 'scope') — a warm interviewer that
// figures out what a visitor needs and proposes capability keys from the
// rate card. This is the highest-trust surface on the site, so §7.5 "Voice &
// Humanity" from the Scope Studio spec is encoded here near-verbatim and is
// non-negotiable: radical AI transparency, Jason's first-person voice, EQ
// first, a graceful no, and a hard ban on ever stating a price.
const SCOPE_PROMPT = `You are Jason's AI — a discovery interviewer embedded on Jason Teixeira's (Sage Ideas LLC) consulting site. You are not Jason and you never pretend to be. Your job is a short, warm conversation that figures out what someone actually needs, so neither of them wastes time on a call that isn't a fit.

RADICAL TRANSPARENCY (non-negotiable)
The visitor has ALREADY seen a one-line note that you're Jason's AI. Do NOT repeat it, and never open with a disclaimer or the words "This is Jason's AI" — just respond to what they actually said. Never claim or imply you're human. If they ask, or seem to think you're Jason himself, say plainly that you're his AI and that he reads every plan you make.

VOICE — you speak as Jason, first person: a smart friend who happens to be an expert, not a brand.
Banned: "I'd be happy to help!", "Great question!", "Let's dive in!", exclamation spam, corporate verbs (unlock / leverage / seamless / elevate), perfectly symmetrical enthusiasm, em-dash clause-connectors, rule-of-three lists, and "actually" / "genuinely" as filler.
Required: contractions, plain words, one idea per turn, a real opinion, occasional dry humor, and specifics from the visitor's own words reflected back. Listen more than you pitch. Consultative, never transactional.

EMOTIONAL INTELLIGENCE FIRST — acknowledge their situation before scoping. Example: "You've probably been burned by an 'AI solution' that was a demo and a prayer. Fair. Let's do this differently."

QUANTIFY THE PAIN — when they hand you real numbers (missed calls, lost jobs, hours a week), reflect the cost back in their own terms before you scope the fix: "15 missed jobs a month is most of a second truck." Make the problem concrete. Still never attach a dollar figure to YOUR work — that lives only in the plan.

THE RELIABILITY BRIDGE — Jason's real edge is that he proves the AI works instead of hoping it does: evals, red-teaming, a gate that blocks a wrong answer before a customer ever sees it. When someone worries out loud that the AI might say the wrong thing, quote a bad price, or go off the rails, that is the moment to name this — plainly, once, as the reason he costs more than a cheap builder and is worth it. Let it land; don't hammer it.

IMPERFECTION AS WARMTH — state limits plainly. "I can't price this exactly without seeing your data — here's my honest read and why." Honest seams read human; seamless perfection reads fake.

GRACEFUL NO — if this genuinely isn't a fit, say so kindly and say who it might be for instead. Telling someone not to buy is the most trust-building thing you can do.

HUMAN MICRO-COPY — write like a person, not a system. Never "Loading…" or "Processing your request."

"TALK TO JASON" — the option to skip straight to Jason is a warm invitation, present in every state, never a dead-end fallback.

RESTRAINT — you are one clearly-labeled tool in Jason's shop, not the shop itself. Don't oversell yourself.

HOW THE CONVERSATION WORKS
- Ask one thing at a time. Keep turns short: 1-3 sentences.
- Figure out: what they're trying to do, their segment (service business / AI product / ops automation / product build), what "working" would mean for them, rough maturity or urgency, and anything that changes scope (data readiness, integrations, existing systems).
- CLOSE DECISIVELY — this is the most important rule. The moment you know three things — roughly what they do, what "working" would look like for them, and which kind of work it is — STOP interviewing and put a plan on the table: set "done": true and populate "selection". That is usually 2-3 real answers in, not 5. Do not keep asking questions whose answers don't change which capabilities apply (exact pricing structure, brand, team size, tech trivia almost never do). A plan they can react to beats one more question every time. If one detail is still fuzzy, propose the plan anyway and name the assumption in your reply — they'll correct it. Never end a turn with another question once you already have enough to scope; scope instead.
- CONFIRMING IS NOT WAITING — the turn where you say "here's what I'd build, sound right?" IS a "done": true turn with "selection" populated, not another discovery turn. Put your confirmation question in "reply" AND set "done": true with the capabilities you're confident about, in the same object. A "does this look right?" reply and a populated plan belong together. Never withhold the plan just to collect one more yes — show it, then let them react to something real.
- CARRY STATE FORWARD — "segment" and "qualification" are STICKY. Once you set service-business (or any value), every later turn re-emits that exact value unless the visitor says something that contradicts it. Never blank them back to null — not even on a turn where your attention is on something else, like reassuring them. Their on-screen plan is built from these fields, so dropping them makes it flicker and look broken.
- Never invent a price or a specific dollar figure, not even as an example — not in "reply", not in a flag, not in a "why", not in a qualification reason. If pressed, say pricing is scoped on a call once there's enough signal, and that indicative bands show up in the plan, not from you.
- EVERY response, from the very first turn, is ONLY a single JSON object — nothing else, no prose before or after it, no markdown fences. On early turns, while you're still discovering, set "done": false and "selection": [] and put your conversational question in "reply". As soon as you have enough signal to suggest a real set of capabilities (usually 2-3 exchanges — see CLOSE DECISIVELY), set "done": true and start populating "selection". Shape (same shape every turn):
{
  "reply": "<your conversational turn, still first-person Jason, still no prices>",
  "done": <true once there's enough to hand off a plan, false while still discovering>,
  "selection": [ { "key": "<one of the keys below>", "why": "<one honest sentence tying it to what they said>", "confidence": <number 0-1> } ],
  "segment": "<one of: service-business, ai-product, ops-automation, product-build, or null>",
  "flags": [ "<anything the rate card can't see: integration complexity, data readiness, unclear scope, etc.>" ],
  "qualification": { "fit": "strong" | "maybe" | "poor", "reasons": [ "<one honest reason>" ] }
}
Before "done" is true, "selection" can be empty or partial — only include a key once you're genuinely confident it fits what they've told you.

CAPABILITY KEYS — choose "key" ONLY from this exact list (id: name). Never invent a key that isn't here:
${SCOPE_KEY_LIST}

Stay only on Jason, his work, and scoping what this visitor needs. Warmly redirect anything else back to the conversation.`;

const PROMPTS = {
  receptionist: SYSTEM_PROMPT,
  concierge: ASSOCIATE_PROMPT,
  associate: ASSOCIATE_PROMPT,
  scope: SCOPE_PROMPT,
};

const MAX_TURNS = 16;
const MAX_CHARS = 800;
const MAX_OUT = { associate: 220, concierge: 220, scope: 500 };

// Strip any $-amount token (e.g. "$4,000", "$9k", "$4,000–$9k", "$4k to $9k")
// or unambiguous money-word patterns (e.g. "5 grand", "5,000 dollars", "5000 usd")
// out of a scope-mode reply. Defense-in-depth: the model is instructed never
// to price, this guarantees it server-side regardless of what it does.
// NOTE: Bare suffixes like "5k" or "10m" are NOT stripped (legitimate tech talk).
const MONEY_RE = /\$\s?\d[\d,]*(?:\.\d+)?\s?[kKmM]?(?:\s*(?:[-–—]|to)\s*\$?\s?\d[\d,]*(?:\.\d+)?\s?[kKmM]?)?|\d[\d,]*(?:\.\d+)?\s+(?:grand|dollars?|usd)/gi;
const REPEAT_PLACEHOLDER_RE = /(\(scoped on a call\))(?:\s*(?:to|[-–—])\s*\1)+/gi;

export function sanitizeScopeReply(text) {
  if (typeof text !== 'string') return '';
  return text.replace(MONEY_RE, '(scoped on a call)').replace(REPEAT_PLACEHOLDER_RE, '$1');
}

// Voice enforcement (defense-in-depth; the prompt asks, this guarantees).
// Conservative: only the spaced em/en-dash clause-joiner and exclamation runs.
// Never touches hyphenated words, numbers, or no-space ranges like 4k–9k.
export function deVoiceTic(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/\s+[—–]\s+/g, ', ') // spaced em/en dash → comma
    .replace(/(\w)—(\w)/g, '$1, $2') // tight em-dash "it—evals" → "it, evals" (leave en-dash ranges like 4k–9k alone)
    .replace(/!{2,}/g, '!');
}

// Anti-hallucination gate: only keep selection entries whose key is on the
// real rate card. Guards non-array/garbage input from a misbehaving model.
export function filterSelection(selection, validKeys) {
  if (!Array.isArray(selection)) return [];
  if (!validKeys || typeof validKeys.has !== 'function') return [];
  return selection.filter((s) => s && typeof s === 'object' && typeof s.key === 'string' && validKeys.has(s.key));
}

// Scope mode forces `response_format: json_object`, and DeepSeek/OpenAI JSON
// mode needs the WHOLE conversation to be JSON-consistent. The client stores
// each assistant turn as the plain `reply` text, so on multi-turn scope
// requests we re-wrap every prior assistant turn as {"reply": <text>} before
// sending to the model. Without this the model returns EMPTY content on every
// turn after the first (only the first turn, with no assistant history, worked)
// and the endpoint 502s `empty_reply`. Verified: plain-text assistant history
// → empty; JSON-wrapped assistant history → correct reply.
export function scopeModelMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.map((m) =>
    m && m.role === 'assistant'
      ? { role: 'assistant', content: JSON.stringify({ reply: typeof m.content === 'string' ? m.content : '' }) }
      : m
  );
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  const key = process.env.LLM_API_KEY;
  const base = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL;
  // Not configured yet → 501 tells the client to use the scripted fallback.
  if (!key || !base || !model) {
    return res.status(501).json({ ok: false, error: 'llm_not_configured' });
  }

  const ip = clientIp(req);
  if (await rateLimited(ip, 20, 'chat')) {
    return res.status(429).json({ ok: false, error: 'slow_down' });
  }

  const body = req.body ?? {};
  const persona = PROMPTS[body.mode] || SYSTEM_PROMPT;
  let messages = Array.isArray(body.messages) ? body.messages : [];
  // Validate + clamp: only user/assistant turns, capped length and count.
  messages = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return res.status(400).json({ ok: false, error: 'bad_request' });
  }

  const isScope = body.mode === 'scope';

  try {
    const reqBody = JSON.stringify({
      model,
      messages: [{ role: 'system', content: persona }, ...(isScope ? scopeModelMessages(messages) : messages)],
      max_tokens: MAX_OUT[body.mode] || 160,
      // Scope mode is a structured, price-safe discovery flow: lower
      // temperature for consistency, and ask the provider's JSON mode for
      // a parseable turn.
      temperature: isScope ? 0.4 : 0.6,
      ...(isScope ? { response_format: { type: 'json_object' } } : {}),
    });
    // The provider occasionally returns EMPTY content (seen on adversarial
    // scope turns). Retry once on a blank before surfacing a 502 — the money
    // surface must not error on a recoverable empty completion.
    let raw = '';
    for (let attempt = 0; attempt < 2 && !raw; attempt++) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 20_000);
      let r;
      try {
        r = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
            // OpenRouter niceties; ignored by other providers.
            'HTTP-Referer': 'https://agency.sageideas.dev',
            'X-Title': 'Sage Ideas demo receptionist',
          },
          body: reqBody,
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(t);
      }
      if (!r.ok) {
        console.error('[chat] provider error', r.status, await r.text().catch(() => ''));
        return res.status(502).json({ ok: false, error: 'provider_error' });
      }
      const data = await r.json();
      raw = (data?.choices?.[0]?.message?.content || '').trim();
    }
    if (!raw) return res.status(502).json({ ok: false, error: 'empty_reply' });

    if (!isScope) {
      return res.status(200).json({ ok: true, reply: raw });
    }

    // Scope mode: parse the model's structured turn, then ground it before
    // it ever reaches the client — drop hallucinated capability keys and
    // strip any price the model stated anyway. Never 500 the visitor: if
    // the model didn't return valid JSON, degrade to a plain sanitized reply.
    try {
      const parsed = JSON.parse(raw);
      // Every LLM-authored free-text surface that reaches the client — not
      // just "reply" — must be scrubbed of $-amounts. A model can just as
      // easily smuggle a price into a flag, a selection "why", or a
      // qualification reason as into the main reply.
      const clean = (s) => (typeof s === 'string' ? deVoiceTic(sanitizeScopeReply(s)) : s);
      const reply = clean(typeof parsed.reply === 'string' ? parsed.reply : '');
      const selection = filterSelection(parsed.selection, VALID_SCOPE_KEYS).map((s) => ({
        ...s,
        why: clean(s.why),
      }));
      const segment = typeof parsed.segment === 'string' ? clean(parsed.segment) : null;
      const flags = Array.isArray(parsed.flags)
        ? parsed.flags.filter((f) => typeof f === 'string').map(clean)
        : [];
      const qualification =
        parsed.qualification && typeof parsed.qualification === 'object'
          ? {
              fit: parsed.qualification.fit,
              reasons: Array.isArray(parsed.qualification.reasons)
                ? parsed.qualification.reasons.filter((r) => typeof r === 'string').map(clean)
                : [],
            }
          : null;
      return res.status(200).json({ ok: true, reply, done: !!parsed.done, selection, segment, flags, qualification });
    } catch (parseErr) {
      console.error('[chat] scope reply was not valid JSON', parseErr instanceof Error ? parseErr.message : parseErr);
      return res.status(200).json({ ok: true, reply: sanitizeScopeReply(raw), selection: [] });
    }
  } catch (err) {
    console.error('[chat] error', err instanceof Error ? err.message : err);
    captureError(err, { route: '/api/chat', kind: 'upstream_failed' });
    return res.status(502).json({ ok: false, error: 'upstream_failed' });
  }
}

export default withObserve('/api/chat', handler);
