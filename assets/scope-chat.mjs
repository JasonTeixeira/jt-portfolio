// assets/scope-chat.mjs — conversational Scope Studio. Talks to /api/chat 'scope'
// mode (structured turns: reply + selection[] + qualification + done), drives the
// SAME live blueprint the questionnaire builds (window.__applyScopeKeys), and at
// the done/strong-fit moment captures an email in-chat (fires /api/lead +
// /api/proposal, the same handoff scope-studio.mjs does on its lead form).
// Degradation-safe: a genuine 501 (LLM env absent) shows a plain offline state and
// the questionnaire stays fully usable; transient errors retry once and never brick.
// Bot turns reveal with a word-by-word typewriter (reduced-motion shows instantly);
// the conversation is remembered locally (best-effort) so a same-day return visit
// can resume where it left off. All dynamic text stays textContent-only — never
// innerHTML — even while revealing.
//
// Voice mode (additive, opt-in via a toggle): browser-native Web Speech API only,
// same pattern as assets/voice-receptionist.mjs. Tap-to-talk STT feeds transcripts
// into the SAME send() path below — every grounding/degrade/qualification/handoff
// guarantee applies unchanged, voice is just another input device. TTS speaks the
// server's already price-safe `reply` string verbatim, nothing else. Feature-detects
// and degrades calmly at every step; never throws.

import { computePlan } from './scope-core.mjs';

const GREETING =
  "This is Jason's AI. It scopes your project so neither of us wastes time on a call that isn't a fit. Tell me what you're working on and I'll ask a few questions. Jason reads every plan it makes; you can skip straight to him anytime.";
const OFFLINE_MSG = "The AI's offline right now. Use the quick questions instead; they build the exact same plan.";
const NARRATION = "I've sketched a plan for you on the right. Tweak it or keep going.";
const HANDOFF_COPY = "Want me to send this plan to your inbox? Jason reads every one, and he'll follow up himself.";
const RESUME_COPY = 'Picking up where we left off.';
const VOICE_HANDOFF_PROMPT = 'Want me to send this to your inbox?';
const VOICE_UNSUPPORTED_NOTE = 'Voice works best in Chrome; type here otherwise.';
const VOICE_DENIED_NOTE = 'Mic access is blocked — type here instead.';

const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition || null;
const synth = window.speechSynthesis || null;
const canSpeak = !!(synth && window.SpeechSynthesisUtterance);

// per-word typewriter cadence — deterministic, not random, so it never flakes
const REVEAL_BASE_MS = 34;
const REVEAL_LONGWORD_MS = 12;
const REVEAL_SENTENCE_PAUSE_MS = 130;
const REVEAL_CLAUSE_PAUSE_MS = 60;

// local memory — best-effort only, never anything beyond what the user already typed
const MEMORY_KEY = 'scope_chat_v1';
const MEMORY_MAX_AGE_MS = 24 * 60 * 60 * 1000;

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

function saveMemory(hist, lastKeys, lastSegment, lastQual, lastDone) {
  try {
    if (!Array.isArray(hist) || hist.length < 2) return; // nothing beyond the greeting — not worth resuming
    localStorage.setItem(MEMORY_KEY, JSON.stringify({ hist, lastKeys, lastSegment, lastQual: lastQual || null, lastDone: !!lastDone, ts: Date.now() }));
  } catch { /* private mode / quota — memory is best-effort only */ }
}

function loadMemory() {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.ts !== 'number' || Date.now() - parsed.ts > MEMORY_MAX_AGE_MS) return null;
    const hist = Array.isArray(parsed.hist)
      ? parsed.hist.filter((m) => m && typeof m === 'object' && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content)
      : [];
    if (hist.length < 2) return null; // opted-out / stale / never got past the greeting
    const lastKeys = Array.isArray(parsed.lastKeys) ? parsed.lastKeys.filter((k) => typeof k === 'string' && k) : [];
    const lastSegment = typeof parsed.lastSegment === 'string' && parsed.lastSegment ? parsed.lastSegment : null;
    const q = parsed.lastQual;
    const lastQual = q && typeof q === 'object' && (q.fit === 'strong' || q.fit === 'maybe' || q.fit === 'poor')
      ? { fit: q.fit, reasons: Array.isArray(q.reasons) ? q.reasons.filter((r) => typeof r === 'string') : [] }
      : null;
    const lastDone = parsed.lastDone === true;
    return { hist, lastKeys, lastSegment, lastQual, lastDone };
  } catch { return null; }
}

function clearMemory() { try { localStorage.removeItem(MEMORY_KEY); } catch { /* best-effort */ } }

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

  // voice mode DOM (all optional — feature/DOM absence degrades to text-only, never throws)
  const voiceToggleBtn = document.getElementById('scope-voice-toggle');
  const voiceToggleLabelEl = document.getElementById('scope-voice-toggle-label');
  const voiceFallbackNoteEl = document.getElementById('scope-voice-fallback-note');
  const voicePanelEl = document.getElementById('scope-voice-panel');
  const voiceStatusEl = document.getElementById('scope-voice-status');
  const voiceStatusTextEl = document.getElementById('scope-voice-status-text');
  const voiceMuteBtn = document.getElementById('scope-voice-mute');
  const voiceMicBtn = document.getElementById('scope-voice-mic');
  const voiceMicLabelEl = document.getElementById('scope-voice-mic-label');

  let hist = [];
  let opened = false;
  let notConfigured = false; // permanent offline — 501 only
  let lastKeys = [];
  let lastSegment = null;
  let narratedPlan = false;
  let handoffShown = false;
  let lastQualification = null; // persisted so a returning strong-fit visitor keeps the handoff CTA
  let lastDone = false;
  let typingEl = null;
  let voiceMode = false;
  let voiceMuted = false;
  let listening = false;
  let recognition = null;
  let chosenVoice = null;

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

  function makeAvatar() {
    const av = document.createElement('span');
    av.className = 'sc-avatar';
    av.setAttribute('aria-hidden', 'true');
    av.textContent = 'JT';
    return av;
  }

  // Plain (non-revealing) bubble — used for the user's own messages, asides
  // (offline/error notes, plan narration) and restored history on resume.
  function bubble(role, text) {
    if (role === 'user') {
      const b = document.createElement('div');
      b.className = 'sc-bubble sc-user sc-enter';
      b.textContent = text;
      messagesEl.appendChild(b);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return b;
    }
    const row = document.createElement('div');
    row.className = 'sc-row sc-row-bot sc-enter';
    row.appendChild(makeAvatar());
    const b = document.createElement('div');
    b.className = 'sc-bubble sc-bot';
    b.textContent = text;
    row.appendChild(b);
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return b;
  }
  function note(text) { const b = bubble('bot', text); b.classList.add('sc-note'); return b; }

  function chunkDelay(chunk) {
    let d = REVEAL_BASE_MS;
    if (chunk.trim().length > 6) d += REVEAL_LONGWORD_MS;
    if (/[.!?]["')]*\s*$/.test(chunk)) d += REVEAL_SENTENCE_PAUSE_MS;
    else if (/[,;:]\s*$/.test(chunk)) d += REVEAL_CLAUSE_PAUSE_MS;
    return d;
  }

  // Reveals a bot turn word-by-word into an aria-hidden visual span (so a live
  // region doesn't announce every chunk), then commits the full text once to an
  // sr-only sibling for a single clean screen-reader announcement. Reduced-motion
  // sets both immediately. Only ever mutates textContent — never innerHTML.
  function revealBotBubble(text) {
    return new Promise((resolve) => {
      const row = document.createElement('div');
      row.className = 'sc-row sc-row-bot sc-enter';
      row.appendChild(makeAvatar());
      const el = document.createElement('div');
      el.className = 'sc-bubble sc-bot';
      const visible = document.createElement('span');
      visible.className = 'sc-bubble-visible';
      visible.setAttribute('aria-hidden', 'true');
      const srText = document.createElement('span');
      srText.className = 'sr-only';
      el.appendChild(visible);
      el.appendChild(srText);
      row.appendChild(el);
      if (typingEl && typingEl.parentNode) messagesEl.insertBefore(row, typingEl);
      else messagesEl.appendChild(row);
      hideTyping();
      messagesEl.scrollTop = messagesEl.scrollHeight;

      const finish = () => {
        el.classList.remove('sc-revealing');
        srText.textContent = text; // one mutation → one polite announcement
        resolve(el);
      };
      if (REDUCED) { visible.textContent = text; messagesEl.scrollTop = messagesEl.scrollHeight; finish(); return; }

      el.classList.add('sc-revealing');
      const chunks = text.match(/\S+\s*/g) || [text];
      let i = 0;
      (function step() {
        if (i >= chunks.length) { finish(); return; }
        visible.textContent += chunks[i];
        const delay = chunkDelay(chunks[i]);
        i++;
        messagesEl.scrollTop = messagesEl.scrollHeight;
        setTimeout(step, delay);
      })();
    });
  }

  function showTyping() {
    if (typingEl) return;
    typingEl = document.createElement('div');
    typingEl.className = 'sc-row sc-row-bot sc-typing-row';
    typingEl.appendChild(makeAvatar());
    const bub = document.createElement('div');
    bub.className = 'sc-bubble sc-bot sc-typing';
    bub.setAttribute('aria-label', 'Thinking');
    if (REDUCED) { bub.textContent = '…'; }
    else { for (let i = 0; i < 3; i++) { const d = document.createElement('span'); d.className = 'sc-dot'; bub.appendChild(d); } }
    typingEl.appendChild(bub);
    messagesEl.appendChild(typingEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  function hideTyping() { if (typingEl) { typingEl.remove(); typingEl = null; } }

  function showOffline() {
    if (!offlineEl) return;
    offlineEl.hidden = false;
    offlineEl.textContent = OFFLINE_MSG;
  }

  function showResumeBanner() {
    if (!chatRoot || chatRoot.querySelector('.sc-resume')) return;
    const banner = document.createElement('div');
    banner.className = 'sc-resume';
    const text = document.createElement('span');
    text.className = 'sc-resume-text';
    text.textContent = RESUME_COPY;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sc-resume-reset';
    btn.textContent = 'Start over';
    btn.addEventListener('click', () => { clearMemory(); banner.remove(); resetChat(); });
    banner.appendChild(text);
    banner.appendChild(btn);
    chatRoot.insertBefore(banner, chatRoot.firstChild);
  }
  function hideResumeBanner() {
    const banner = chatRoot && chatRoot.querySelector('.sc-resume');
    if (banner) banner.remove();
  }

  function restoreFromMemory(saved) {
    hist = saved.hist.slice();
    hist.forEach((m) => bubble(m.role === 'user' ? 'user' : 'bot', m.content));
    if (saved.lastKeys.length) {
      lastKeys = saved.lastKeys;
      lastSegment = saved.lastSegment;
      if (typeof window.__applyScopeKeys === 'function') window.__applyScopeKeys(lastKeys, lastSegment);
      narratedPlan = true; // the plan already sits on the canvas — don't re-narrate it
    }
    if (saved.lastQual) {
      lastQualification = saved.lastQual;
      lastDone = saved.lastDone;
      applyQualification(saved.lastQual); // restore the fit chip / disqualify panel
      // a returning strong/maybe-fit visitor who already reached done keeps the email-capture CTA
      if (saved.lastDone && (saved.lastQual.fit === 'strong' || saved.lastQual.fit === 'maybe')) showHandoff();
    }
    showResumeBanner();
  }

  function resetChat() {
    messagesEl.textContent = '';
    hist = [];
    lastKeys = [];
    lastSegment = null;
    narratedPlan = false;
    handoffShown = false;
    lastQualification = null;
    lastDone = false;
    clearFitChip();
    clearDisqualify();
    if (handoffEl) handoffEl.hidden = true;
    if (handoffForm) handoffForm.hidden = false;
    if (handoffStatus) handoffStatus.textContent = '';
    if (typeof window.__applyScopeKeys === 'function') window.__applyScopeKeys([], null);
    if (notConfigured) { showOffline(); }
    else { revealBotBubble(GREETING); hist.push({ role: 'assistant', content: GREETING }); }
    if (inputEl) { try { inputEl.focus(); } catch { /* jsdom / detached */ } }
  }

  function openChat() {
    if (opened) return;
    opened = true;
    const saved = loadMemory();
    if (saved) { restoreFromMemory(saved); return; }
    revealBotBubble(GREETING);
    hist.push({ role: 'assistant', content: GREETING });
  }
  function setBusy(busy) {
    if (inputEl) inputEl.disabled = busy;
    if (sendBtn) sendBtn.disabled = busy;
    if (voiceMicBtn) voiceMicBtn.disabled = busy || listening;
  }

  // ── voice mode: state indicator (idle / listening / thinking / speaking) ──
  function setVoiceState(state, label) {
    if (voiceStatusEl) voiceStatusEl.dataset.state = state;
    if (voiceStatusTextEl) voiceStatusTextEl.textContent = label;
  }

  // ── voice mode: speech synthesis (TTS) — speaks the server's reply verbatim ──
  function pickVoice() {
    if (!canSpeak || chosenVoice) return chosenVoice;
    const voices = synth.getVoices();
    if (!voices.length) return null;
    chosenVoice =
      voices.find((v) => /en-US/i.test(v.lang) && /Google|Natural|Samantha|Aria/i.test(v.name)) ||
      voices.find((v) => /^en/i.test(v.lang) && v.default) ||
      voices.find((v) => /^en/i.test(v.lang)) ||
      voices[0];
    return chosenVoice;
  }
  if (canSpeak && typeof synth.addEventListener === 'function') {
    synth.addEventListener('voiceschanged', () => pickVoice());
  }
  function speak(text) {
    return new Promise((resolve) => {
      if (!canSpeak || voiceMuted || !text) { resolve(); return; }
      try {
        synth.cancel(); // never let two turns overlap
        const utter = new window.SpeechSynthesisUtterance(text);
        const voice = pickVoice();
        if (voice) utter.voice = voice;
        utter.rate = 1;
        utter.pitch = 1;
        utter.onend = () => resolve();
        utter.onerror = () => resolve(); // never throw to the console over a TTS glitch
        setVoiceState('speaking', 'Speaking');
        synth.speak(utter);
      } catch { resolve(); }
    });
  }

  // ── voice mode: mute control ──
  function setVoiceMuted(next) {
    voiceMuted = next;
    if (voiceMuteBtn) {
      voiceMuteBtn.setAttribute('aria-pressed', String(voiceMuted));
      voiceMuteBtn.textContent = voiceMuted ? '🔇 Sound off' : '🔊 Sound on';
    }
    if (voiceMuted && canSpeak) { try { synth.cancel(); } catch { /* best-effort */ } }
  }
  if (voiceMuteBtn) {
    if (!canSpeak) voiceMuteBtn.hidden = true;
    else voiceMuteBtn.addEventListener('click', () => setVoiceMuted(!voiceMuted));
  }

  // ── voice mode: enter/exit — text chat stays fully usable throughout ──
  function setVoiceMode(on) {
    voiceMode = on;
    if (voiceToggleBtn) voiceToggleBtn.setAttribute('aria-pressed', String(on));
    if (voiceToggleLabelEl) voiceToggleLabelEl.textContent = on ? 'Voice mode on' : 'Voice mode';
    if (voicePanelEl) voicePanelEl.hidden = !on;
    if (!on) {
      if (listening && recognition) { try { recognition.stop(); } catch { /* best-effort */ } }
      if (canSpeak) { try { synth.cancel(); } catch { /* best-effort */ } }
      setVoiceState('idle', 'Idle');
    } else {
      setVoiceState('idle', 'Idle');
      if (voiceMicBtn) { try { voiceMicBtn.focus(); } catch { /* jsdom / detached */ } }
    }
  }

  // permanently falls back to text-only: unsupported STT, or a denied mic mid-session
  function disableVoiceEntirely(message) {
    setVoiceMode(false);
    if (voiceToggleBtn) voiceToggleBtn.hidden = true;
    if (voiceFallbackNoteEl) { voiceFallbackNoteEl.hidden = false; voiceFallbackNoteEl.textContent = message; }
  }

  if (!SpeechRecognitionCtor) {
    disableVoiceEntirely(VOICE_UNSUPPORTED_NOTE);
  } else if (voiceToggleBtn && voiceMicBtn) {
    voiceToggleBtn.addEventListener('click', () => setVoiceMode(!voiceMode));

    function stopListening() {
      listening = false;
      if (voiceMicBtn) { voiceMicBtn.dataset.listening = 'false'; voiceMicBtn.setAttribute('aria-pressed', 'false'); }
      if (voiceMicLabelEl) voiceMicLabelEl.textContent = 'Talk to it';
      if (!inputEl || !inputEl.disabled) setBusy(false);
      if (voiceStatusEl && voiceStatusEl.dataset.state === 'listening') setVoiceState('idle', 'Idle');
    }

    function startListening() {
      try { recognition = new SpeechRecognitionCtor(); }
      catch { disableVoiceEntirely(VOICE_UNSUPPORTED_NOTE); return; }
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        listening = true;
        if (voiceMicBtn) { voiceMicBtn.dataset.listening = 'true'; voiceMicBtn.setAttribute('aria-pressed', 'true'); }
        if (voiceMicLabelEl) voiceMicLabelEl.textContent = 'Listening… tap to stop';
        setVoiceState('listening', 'Listening');
      };
      recognition.onresult = (event) => {
        const transcript = event.results && event.results[0] && event.results[0][0] ? event.results[0][0].transcript : '';
        stopListening();
        if (transcript) send(transcript);
      };
      recognition.onerror = (event) => {
        stopListening();
        if (event && (event.error === 'not-allowed' || event.error === 'service-not-allowed')) {
          disableVoiceEntirely(VOICE_DENIED_NOTE);
          return;
        }
        if (event && event.error === 'no-speech') return; // quiet — just reset, no scary note
        note("Didn't catch that — try again, or type instead.");
      };
      recognition.onend = () => { if (listening) stopListening(); };

      try { recognition.start(); } catch { stopListening(); }
    }

    voiceMicBtn.addEventListener('click', () => {
      if (listening && recognition) { try { recognition.stop(); } catch { /* best-effort */ } return; }
      if (canSpeak) { try { synth.cancel(); } catch { /* best-effort */ } } // stop the AI talking before we listen, to avoid it hearing itself
      startListening();
    });
  }

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
    // voice mode: a short spoken nudge alongside the on-screen handoff card (the
    // email field itself stays typed-only, for accuracy — see module header)
    if (voiceMode && canSpeak && !voiceMuted) {
      speak(VOICE_HANDOFF_PROMPT).then(() => { if (voiceMode) setVoiceState('idle', 'Idle'); });
    }
  }
  async function submitPlan(email) {
    const e = (email || '').trim();
    if (!e) return;
    const pid = prospectId();
    let band = [0, 0];
    try { band = computePlan(lastKeys, lastSegment).totalBand; } catch { /* keep [0,0] */ }
    if (handoffStatus) handoffStatus.textContent = 'Sending it over…';
    let leadOk = false;
    try {
      const r = await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e, prospectId: pid, source: 'scope-chat', plan: { keys: lastKeys, segment: lastSegment, total: band } }) });
      leadOk = r.ok;
    } catch { leadOk = false; }
    // proposal draft is best-effort regardless
    try {
      fetch('/api/proposal', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospectId: pid, email: e, plan: { keys: lastKeys, segment: lastSegment, totalBand: band } }) }).catch(() => {});
    } catch { /* degrade-safe */ }
    if (handoffForm) handoffForm.hidden = true;
    if (handoffStatus) handoffStatus.textContent = leadOk
      ? "On its way. I'll follow up personally."
      : "That didn't send. Email me at hello@sageideas.dev and I'll pick it up.";
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
    hideResumeBanner();
    bubble('user', v);
    hist.push({ role: 'user', content: v });
    saveMemory(hist, lastKeys, lastSegment, lastQualification, lastDone);
    if (inputEl) inputEl.value = '';
    if (notConfigured) { showOffline(); if (voiceMode) setVoiceState('idle', 'Idle'); return; }

    setBusy(true); showTyping();
    if (voiceMode) setVoiceState('thinking', 'Thinking');
    const result = await requestTurn();

    if (result.status === 501) {
      hideTyping(); setBusy(false); notConfigured = true; showOffline();
      if (voiceMode) setVoiceState('idle', 'Idle');
      return;
    }
    if (result.status === 429) {
      hideTyping(); setBusy(false); note("I'm getting a lot of questions right now. Give it a second and try again.");
      if (voiceMode) setVoiceState('idle', 'Idle');
      return;
    }
    const data = result.data;
    if (!data || !data.ok || typeof data.reply !== 'string' || !data.reply) {
      hideTyping(); setBusy(false);
      note("That didn't go through. Try again?");
      if (voiceMode) setVoiceState('idle', 'Idle');
      return;
    }
    // input stays disabled through the reveal — a second send can't land mid-turn.
    // In voice mode the reply is spoken in parallel with the typewriter reveal —
    // it's the exact same server string either way, never anything price-bearing
    // the server didn't already send.
    const revealPromise = revealBotBubble(data.reply);
    const speakPromise = voiceMode ? speak(data.reply) : Promise.resolve();
    await Promise.all([revealPromise, speakPromise]);
    setBusy(false);
    if (voiceMode) setVoiceState('idle', 'Idle');
    if (inputEl) { try { inputEl.focus(); } catch { /* jsdom / detached */ } }
    hist.push({ role: 'assistant', content: data.reply });
    applySelection(data.selection, data.segment);
    lastQualification = data.qualification || null;
    lastDone = !!data.done;
    applyQualification(data.qualification);
    if (data.done && data.qualification && (data.qualification.fit === 'strong' || data.qualification.fit === 'maybe')) showHandoff();
    persistTranscript(hist);
    saveMemory(hist, lastKeys, lastSegment, lastQualification, lastDone);
  }

  if (formEl) { formEl.addEventListener('submit', (e) => { e.preventDefault(); send(inputEl ? inputEl.value : ''); }); }
}
