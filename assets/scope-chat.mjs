// assets/scope-chat.mjs — the conversational alternative to the Scope Studio
// questionnaire. Same rules as assets/agent.js (message list, labelled send
// box, typewriter reveal, POST to /api/chat) but talking to /api/chat's
// 'scope' mode instead of 'associate' — the model returns structured turns
// (reply + selection[] of capability keys), which this controller applies to
// the SAME live blueprint the questionnaire drives, via
// window.__applyScopeKeys (assets/scope-studio.mjs).
//
// Degradation-safe by design: /api/chat scope mode returns 501 whenever the
// LLM env isn't configured (see api/chat.js), which is the case on the static
// test server and any not-yet-configured deploy. On that — or a network
// failure, or a malformed reply — this shows a plain offline state and never
// fabricates a scripted reply (unlike assets/agent.js's Atlas): scope mode's
// grounding (price stripping, key allowlisting) only exists server-side, so
// there is no safe client-side fallback persona for it. The questionnaire
// stays fully usable regardless; the toggle just switches which panel is
// visible.

const GREETING =
  "This is Jason's AI. It scopes your project so neither of us wastes time on a call that isn't a fit. Tell me what you're working on and I'll ask a few questions. Jason reads every plan it makes; you can skip straight to him anytime.";
const OFFLINE_MSG = "The AI's offline right now. Use the quick questions instead; they build the exact same plan.";

const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function prospectId() {
  try {
    return localStorage.getItem('scope_pid') || null;
  } catch {
    return null; // localStorage unavailable (private mode, quota) — persistence is best-effort only
  }
}

// Fire-and-forget transcript persistence, reusing the same /api/scope beacon
// scope-studio.mjs's track() posts to. A missing/failing endpoint (static
// hosting, no env configured) must never surface to the UI.
function persistTranscript(messages) {
  try {
    const pid = prospectId();
    if (!pid) return;
    fetch('/api/scope', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospectId: pid, type: 'questioned', meta: { messages } }),
    }).catch(() => {});
  } catch {
    // fetch/JSON unavailable or threw synchronously — never break the chat over this
  }
}

const toggleChat = document.getElementById('scope-mode-chat');
const toggleQuick = document.getElementById('scope-mode-quick');
const questionsEl = document.getElementById('scope-questions');
const chatRoot = document.getElementById('scope-chat');

if (toggleChat && toggleQuick && questionsEl && chatRoot) {
  const messagesEl = document.getElementById('scope-chat-messages');
  const formEl = document.getElementById('scope-chat-form');
  const inputEl = document.getElementById('scope-chat-input');
  const sendBtn = document.getElementById('scope-chat-send');
  const offlineEl = document.getElementById('scope-chat-offline');
  const fitEl = document.getElementById('scope-fit');
  const disqualifyEl = document.getElementById('scope-chat-disqualify');

  let hist = [];
  let offline = false;
  let opened = false;

  function setMode(mode) {
    const chat = mode === 'chat';
    toggleChat.setAttribute('aria-pressed', String(chat));
    toggleQuick.setAttribute('aria-pressed', String(!chat));
    chatRoot.hidden = !chat;
    questionsEl.hidden = chat;
    if (chat) {
      openChat();
      setTimeout(() => inputEl && inputEl.focus(), REDUCED ? 0 : 150);
    }
  }
  toggleChat.addEventListener('click', () => setMode('chat'));
  toggleQuick.addEventListener('click', () => setMode('quick'));

  function bubble(role, text) {
    const b = document.createElement('div');
    b.className = 'sc-bubble ' + (role === 'user' ? 'sc-user' : 'sc-bot');
    b.textContent = text;
    messagesEl.appendChild(b);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return b;
  }

  function showOffline() {
    offline = true;
    if (!offlineEl) return;
    offlineEl.hidden = false;
    offlineEl.textContent = OFFLINE_MSG;
  }

  function openChat() {
    if (opened) return;
    opened = true;
    bubble('bot', GREETING);
    hist.push({ role: 'assistant', content: GREETING });
  }

  function setBusy(busy) {
    if (inputEl) inputEl.disabled = busy;
    if (sendBtn) sendBtn.disabled = busy;
  }

  // Apply the model's proposed capability keys to the SAME live blueprint the
  // questionnaire builds. Never trusts the model beyond what api/chat.js has
  // already grounded server-side (filterSelection against the real rate card).
  function applySelection(selection, segment) {
    if (!Array.isArray(selection) || !selection.length) return;
    if (typeof window.__applyScopeKeys !== 'function') return;
    const keys = selection.map((s) => s && s.key).filter(Boolean);
    if (keys.length) window.__applyScopeKeys(keys, segment || null);
  }

  const FIT_CHIP = {
    strong: { label: 'Strong fit', cls: 'fit-strong' },
    maybe: { label: 'Worth a conversation', cls: 'fit-maybe' },
  };

  function clearFitChip() {
    if (!fitEl) return;
    fitEl.hidden = true;
    fitEl.textContent = '';
    fitEl.className = 'scope-fit';
  }

  function showFitChip(fit) {
    if (!fitEl) return;
    const chip = FIT_CHIP[fit];
    if (!chip) {
      clearFitChip();
      return;
    }
    fitEl.className = 'scope-fit ' + chip.cls;
    fitEl.textContent = chip.label;
    fitEl.hidden = false;
  }

  function clearDisqualify() {
    if (!disqualifyEl) return;
    disqualifyEl.hidden = true;
    disqualifyEl.textContent = '';
  }

  // Kind, specific "this probably isn't the right fit" panel — shown INSTEAD of
  // a confidence chip when the server-graded qualification is 'poor'. Reasons
  // come from the model via api/chat.js's price-sanitizing filter, but they are
  // still untrusted free text: every piece is set via textContent, never HTML,
  // so nothing in a reason can inject markup or script.
  function showDisqualify(reasons) {
    if (!disqualifyEl) return;
    disqualifyEl.textContent = '';

    const heading = document.createElement('p');
    heading.className = 'sd-heading';
    heading.textContent = "Honestly, this probably isn't the right fit for me.";
    disqualifyEl.appendChild(heading);

    const list = Array.isArray(reasons) ? reasons.filter((r) => typeof r === 'string' && r.trim()) : [];
    if (list.length) {
      const ul = document.createElement('ul');
      ul.className = 'sd-reasons';
      list.forEach((reason) => {
        const li = document.createElement('li');
        li.textContent = reason;
        ul.appendChild(li);
      });
      disqualifyEl.appendChild(ul);
    }

    const note = document.createElement('p');
    note.className = 'sd-note';
    note.textContent = "That's not a knock on the project. It just means someone else is likely a better match than I am for this one.";
    disqualifyEl.appendChild(note);

    const cta = document.createElement('a');
    cta.className = 'sd-cta';
    cta.href = 'book.html';
    cta.textContent = 'Talk to Jason directly →';
    disqualifyEl.appendChild(cta);

    disqualifyEl.hidden = false;
  }

  // Reads a scope-mode qualification and renders the right signal: a subtle
  // confidence chip for 'strong'/'maybe', or the graceful disqualification
  // panel for 'poor' (never both at once, never a hard-sell CTA on a poor fit).
  // Exposed as window.__applyQualification so it can be driven directly —
  // both by send() below and by tests, since scope mode's grounding only
  // exists server-side and there is no safe client fallback to script from.
  function applyQualification(q) {
    if (!q || typeof q !== 'object') {
      clearFitChip();
      clearDisqualify();
      return;
    }
    if (q.fit === 'poor') {
      clearFitChip();
      showDisqualify(q.reasons);
    } else if (q.fit === 'strong' || q.fit === 'maybe') {
      clearDisqualify();
      showFitChip(q.fit);
    } else {
      clearFitChip();
      clearDisqualify();
    }
  }
  window.__applyQualification = applyQualification;

  async function send(text) {
    const v = (text || '').trim();
    if (!v) return;
    bubble('user', v);
    hist.push({ role: 'user', content: v });
    if (inputEl) inputEl.value = '';

    if (offline) {
      showOffline();
      return;
    }

    setBusy(true);
    let data = null;
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'scope', messages: hist }),
      });
      if (r.ok) data = await r.json().catch(() => null);
    } catch {
      data = null; // network failure — falls through to the offline state below
    }
    setBusy(false);

    if (!data || !data.ok || typeof data.reply !== 'string' || !data.reply) {
      showOffline();
      return;
    }

    bubble('bot', data.reply);
    hist.push({ role: 'assistant', content: data.reply });
    applySelection(data.selection, data.segment);
    applyQualification(data.qualification);
    persistTranscript(hist);
  }

  if (formEl) {
    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      send(inputEl ? inputEl.value : '');
    });
  }
}
