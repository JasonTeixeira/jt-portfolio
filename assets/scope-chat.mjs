// assets/scope-chat.mjs — conversational Scope Studio. Talks to /api/chat 'scope'
// mode (structured turns: reply + selection[] + qualification + done), drives the
// SAME live blueprint the questionnaire builds (window.__applyScopeKeys), and at
// the done/strong-fit moment captures an email in-chat (fires /api/lead +
// /api/proposal, the same handoff scope-studio.mjs does on its lead form).
// Degradation-safe: a genuine 501 (LLM env absent) shows a plain offline state and
// the questionnaire stays fully usable; transient errors retry once and never brick.

import { computePlan } from './scope-core.mjs';

const GREETING =
  "This is Jason's AI. It scopes your project so neither of us wastes time on a call that isn't a fit. Tell me what you're working on and I'll ask a few questions. Jason reads every plan it makes; you can skip straight to him anytime.";
const OFFLINE_MSG = "The AI's offline right now. Use the quick questions instead; they build the exact same plan.";
const NARRATION = "I've sketched a plan for you on the right. Tweak it or keep going.";
const HANDOFF_COPY = "Want me to send this plan to your inbox? Jason reads every one, and he'll follow up himself.";

const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function prospectId() {
  try { return localStorage.getItem('scope_pid') || null; } catch { return null; }
}

function persistTranscript(messages) {
  try {
    const pid = prospectId();
    if (!pid) return;
    fetch('/api/scope', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospectId: pid, type: 'questioned', meta: { messages } }) }).catch(() => {});
  } catch { /* never break the chat over telemetry */ }
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
  const handoffEl = document.getElementById('scope-chat-handoff');
  const handoffForm = document.getElementById('sc-handoff-form');
  const handoffEmail = document.getElementById('sc-handoff-email');
  const handoffStatus = document.getElementById('sc-handoff-status');
  const handoffCopy = handoffEl && handoffEl.querySelector('.sc-handoff-copy');

  let hist = [];
  let opened = false;
  let notConfigured = false; // permanent offline — 501 only
  let lastKeys = [];
  let lastSegment = null;
  let narratedPlan = false;
  let handoffShown = false;
  let typingEl = null;

  function setMode(mode) {
    const chat = mode === 'chat';
    toggleChat.setAttribute('aria-pressed', String(chat));
    toggleQuick.setAttribute('aria-pressed', String(!chat));
    chatRoot.hidden = !chat;
    questionsEl.hidden = chat;
    if (chat) { openChat(); setTimeout(() => inputEl && inputEl.focus(), REDUCED ? 0 : 150); }
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
  function note(text) { const b = bubble('bot', text); b.classList.add('sc-note'); return b; }

  function showTyping() {
    if (typingEl) return;
    typingEl = document.createElement('div');
    typingEl.className = 'sc-bubble sc-bot sc-typing';
    typingEl.setAttribute('aria-label', 'Thinking');
    if (REDUCED) { typingEl.textContent = '…'; }
    else { for (let i = 0; i < 3; i++) { const d = document.createElement('span'); d.className = 'sc-dot'; typingEl.appendChild(d); } }
    messagesEl.appendChild(typingEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  function hideTyping() { if (typingEl) { typingEl.remove(); typingEl = null; } }

  function showOffline() {
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
  function setBusy(busy) { if (inputEl) inputEl.disabled = busy; if (sendBtn) sendBtn.disabled = busy; }

  function applySelection(selection, segment) {
    if (!Array.isArray(selection) || !selection.length) return;
    const keys = selection.map((s) => s && s.key).filter(Boolean);
    if (!keys.length) return;
    lastKeys = keys;
    lastSegment = segment || lastSegment || null;
    if (typeof window.__applyScopeKeys === 'function') window.__applyScopeKeys(keys, lastSegment);
    if (!narratedPlan) { narratedPlan = true; note(NARRATION); } // UI aside; not pushed to model history
  }

  const FIT_CHIP = { strong: { label: 'Strong fit', cls: 'fit-strong' }, maybe: { label: 'Worth a conversation', cls: 'fit-maybe' } };
  function clearFitChip() { if (!fitEl) return; fitEl.hidden = true; fitEl.textContent = ''; fitEl.className = 'scope-fit'; }
  function showFitChip(fit) {
    if (!fitEl) return;
    const chip = FIT_CHIP[fit];
    if (!chip) { clearFitChip(); return; }
    fitEl.className = 'scope-fit ' + chip.cls; fitEl.textContent = chip.label; fitEl.hidden = false;
  }
  function clearDisqualify() { if (!disqualifyEl) return; disqualifyEl.hidden = true; disqualifyEl.textContent = ''; }
  function showDisqualify(reasons) {
    if (!disqualifyEl) return;
    disqualifyEl.textContent = '';
    const heading = document.createElement('p'); heading.className = 'sd-heading';
    heading.textContent = "This probably isn't the right fit for me."; disqualifyEl.appendChild(heading);
    const list = Array.isArray(reasons) ? reasons.filter((r) => typeof r === 'string' && r.trim()) : [];
    if (list.length) {
      const ul = document.createElement('ul'); ul.className = 'sd-reasons';
      list.forEach((reason) => { const li = document.createElement('li'); li.textContent = reason; ul.appendChild(li); });
      disqualifyEl.appendChild(ul);
    }
    const noteP = document.createElement('p'); noteP.className = 'sd-note';
    noteP.textContent = "That's not a knock on the project. It just means someone else is likely a better match than I am for this one.";
    disqualifyEl.appendChild(noteP);
    const cta = document.createElement('a'); cta.className = 'sd-cta'; cta.href = 'book.html';
    cta.textContent = 'Talk to Jason directly →'; disqualifyEl.appendChild(cta);
    disqualifyEl.hidden = false;
  }
  function applyQualification(q) {
    if (!q || typeof q !== 'object') { clearFitChip(); clearDisqualify(); return; }
    if (q.fit === 'poor') { clearFitChip(); showDisqualify(q.reasons); }
    else if (q.fit === 'strong' || q.fit === 'maybe') { clearDisqualify(); showFitChip(q.fit); }
    else { clearFitChip(); clearDisqualify(); }
  }
  window.__applyQualification = applyQualification;

  function showHandoff() {
    if (handoffShown || !handoffEl) return;
    handoffShown = true;
    if (handoffCopy) handoffCopy.textContent = HANDOFF_COPY;
    handoffEl.hidden = false;
    try { handoffEl.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'nearest' }); } catch { /* jsdom */ }
  }
  async function submitPlan(email) {
    const e = (email || '').trim();
    if (!e) return;
    const pid = prospectId();
    let band = [0, 0];
    try { band = computePlan(lastKeys, lastSegment).totalBand; } catch { /* keep [0,0] */ }
    if (handoffStatus) handoffStatus.textContent = 'Sending it over…';
    try {
      await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e, prospectId: pid, source: 'scope-chat', plan: { keys: lastKeys, segment: lastSegment, total: band } }) });
    } catch { /* degrade-safe */ }
    try {
      fetch('/api/proposal', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospectId: pid, email: e, plan: { keys: lastKeys, segment: lastSegment, totalBand: band } }) }).catch(() => {});
    } catch { /* degrade-safe */ }
    if (handoffForm) handoffForm.hidden = true;
    if (handoffStatus) handoffStatus.textContent = "On its way. I'll follow up personally.";
  }
  if (handoffForm) {
    handoffForm.addEventListener('submit', (e) => { e.preventDefault(); submitPlan(handoffEmail ? handoffEmail.value : ''); });
  }

  // One request with a single retry on a transient failure (network / 5xx).
  // 501 (not configured) and 429 (rate limited) are returned as-is, not retried.
  async function requestTurn() {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'scope', messages: hist }) });
        if (r.status === 501 || r.status === 429) return { status: r.status };
        if (r.ok) { const data = await r.json().catch(() => null); return { status: 200, data }; }
        if (attempt === 0) continue; // 5xx -> retry once
        return { status: r.status };
      } catch {
        if (attempt === 0) continue; // network error -> retry once
        return { networkError: true };
      }
    }
    return { networkError: true };
  }

  async function send(text) {
    const v = (text || '').trim();
    if (!v) return;
    bubble('user', v);
    hist.push({ role: 'user', content: v });
    if (inputEl) inputEl.value = '';
    if (notConfigured) { showOffline(); return; }

    setBusy(true); showTyping();
    const result = await requestTurn();
    hideTyping(); setBusy(false);

    if (result.status === 501) { notConfigured = true; showOffline(); return; }
    if (result.status === 429) { note("I'm getting a lot of questions right now. Give it a second and try again."); return; }
    const data = result.data;
    if (!data || !data.ok || typeof data.reply !== 'string' || !data.reply) {
      note("That didn't go through. Try again?");
      return;
    }
    bubble('bot', data.reply);
    hist.push({ role: 'assistant', content: data.reply });
    applySelection(data.selection, data.segment);
    applyQualification(data.qualification);
    if (data.done && data.qualification && (data.qualification.fit === 'strong' || data.qualification.fit === 'maybe')) showHandoff();
    persistTranscript(hist);
  }

  if (formEl) { formEl.addEventListener('submit', (e) => { e.preventDefault(); send(inputEl ? inputEl.value : ''); }); }
}
