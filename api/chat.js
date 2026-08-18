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

const PROMPTS = { receptionist: SYSTEM_PROMPT, concierge: ASSOCIATE_PROMPT, associate: ASSOCIATE_PROMPT };

const MAX_TURNS = 16;
const MAX_CHARS = 800;
const MAX_OUT = { associate: 220, concierge: 220 };

// tiny per-instance throttle (best-effort; resets on cold start)
const hits = new Map();
function throttled(ip) {
  const now = Date.now();
  const win = 60_000;
  const arr = (hits.get(ip) || []).filter((t) => now - t < win);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 20; // >20 msgs/min per IP
}

export default async function handler(req, res) {
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

  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    'unknown';
  if (throttled(ip)) {
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

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20_000);
    const r = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        // OpenRouter niceties; ignored by other providers.
        'HTTP-Referer': 'https://agency.sageideas.dev',
        'X-Title': 'Sage Ideas demo receptionist',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: persona }, ...messages],
        max_tokens: MAX_OUT[body.mode] || 160,
        temperature: 0.6,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(t);

    if (!r.ok) {
      console.error('[chat] provider error', r.status, await r.text().catch(() => ''));
      return res.status(502).json({ ok: false, error: 'provider_error' });
    }
    const data = await r.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) return res.status(502).json({ ok: false, error: 'empty_reply' });
    return res.status(200).json({ ok: true, reply });
  } catch (err) {
    console.error('[chat] error', err instanceof Error ? err.message : err);
    return res.status(502).json({ ok: false, error: 'upstream_failed' });
  }
}
