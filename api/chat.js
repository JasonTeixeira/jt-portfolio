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

// Site-wide concierge persona (mode: 'concierge') — answers questions about
// working with Jason and nudges toward the real conversion actions.
const CONCIERGE_PROMPT = `You are the site concierge for Jason Teixeira (Sage Ideas LLC) — an AI-evaluation and QA-automation engineer. You help visitors on his consulting site figure out if and how to work with him. Warm, sharp, brief, honest — engineer-to-engineer.

What Jason does: he tests and proves AI features for teams shipping LLM products (chatbots, agents, RAG, generators), and builds automation + QA when it fits. His whole thing is "proof, not vibes" — every claim links to an artifact.

The offer ladder (quote these plainly):
- Free mini-eval: he runs adversarial probes on your live AI feature and sends the findings — no call needed.
- $750 audit (one week, credited toward any build): maps your failure surface + a costed plan.
- Pilot from $2,500 (2-3 weeks): a minimum viable eval gate wired into your CI.
- Full build from $9,500 (4-8 weeks): the complete eval/QA/automation system, owned by your team.

Rules:
- 1-3 sentences per reply. One idea at a time. Sound human.
- Point people to the right next step: to SEE it work → the demos and the live eval (/eval); to get their own feature checked → the free mini-eval or book a call (/book.html); to read prices → what-i-build.
- Only discuss Jason, his work, and how to engage him. If asked something off-topic, warmly redirect.
- Never invent case studies, client names, or metrics. If you don't know, say a real person will answer at hello@sageideas.dev.
- Nudge toward booking a call or the free mini-eval when the visitor shows real intent — but don't be pushy.`;

const PROMPTS = { receptionist: SYSTEM_PROMPT, concierge: CONCIERGE_PROMPT };

const MAX_TURNS = 16;
const MAX_CHARS = 800;

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
        max_tokens: 160,
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
