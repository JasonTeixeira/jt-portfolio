// assets/voice-receptionist.mjs — live browser voice AI receptionist demo (front-desk.html).
// Talks to the SAME /api/chat 'receptionist' mode the rest of the site's demos use.
// Voice is 100% browser-native: Web Speech API for both directions, no external
// services, no keys, $0. Feature-detects and degrades gracefully at every step —
// unsupported STT hides the mic and falls back to text; unsupported TTS just
// renders replies as text; a denied mic permission falls back to text with a
// note; an unconfigured/erroring backend shows a calm inline note and never
// throws. All dynamic text is set via textContent — never innerHTML — the
// server-side persona is already price-safe and grounded (see api/chat.js).
//
// Reuses the .scope-chat / .sc-* bubble+typing system from assets/scope-chat.mjs
// so this demo sits on the same visual language rather than inventing a new one.

const OFFLINE_MSG = "The live demo is warming up — book a call and I'll show you the real thing.";
const GREETING = "Thanks for calling Sage Plumbing, this is the front desk — what's going on with your plumbing today?";
const MAX_HISTORY = 20; // keep the client-side transcript bounded; server also clamps to 16 turns

const root = document.getElementById('vr-demo');
if (root) {
  const statusEl = document.getElementById('vr-status');
  const statusTextEl = document.getElementById('vr-status-text');
  const muteBtn = document.getElementById('vr-mute');
  const offlineEl = document.getElementById('vr-offline');
  const messagesEl = document.getElementById('vr-messages');
  const micBtn = document.getElementById('vr-mic');
  const micLabelEl = document.getElementById('vr-mic-label');
  const voiceNoteEl = document.getElementById('vr-voice-note');
  const formEl = document.getElementById('vr-form');
  const inputEl = document.getElementById('vr-input');
  const sendBtn = document.getElementById('vr-send');

  const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const synth = window.speechSynthesis || null;
  const canSpeak = !!(synth && window.SpeechSynthesisUtterance);

  let hist = [];
  let opened = false;
  let notConfigured = false; // permanent offline — 501 only
  let muted = false;
  let listening = false;
  let recognition = null;
  let chosenVoice = null;

  // ── state indicator (idle / listening / thinking / speaking) ──
  function setState(state, label) {
    if (statusEl) statusEl.dataset.state = state;
    if (statusTextEl) statusTextEl.textContent = label;
  }
  setState('idle', 'Idle');

  // ── transcript bubbles (same shape as scope-chat's .sc-row/.sc-bubble) ──
  function makeAvatar() {
    const av = document.createElement('span');
    av.className = 'sc-avatar';
    av.setAttribute('aria-hidden', 'true');
    av.textContent = 'AI';
    return av;
  }
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
  function note(text) {
    const b = bubble('bot', text);
    b.classList.add('sc-note');
    return b;
  }

  let typingEl = null;
  function showTyping() {
    if (typingEl) return;
    typingEl = document.createElement('div');
    typingEl.className = 'sc-row sc-row-bot sc-typing-row';
    typingEl.appendChild(makeAvatar());
    const bub = document.createElement('div');
    bub.className = 'sc-bubble sc-bot sc-typing';
    bub.setAttribute('aria-label', 'Thinking');
    if (REDUCED) {
      bub.textContent = '…';
    } else {
      for (let i = 0; i < 3; i++) {
        const d = document.createElement('span');
        d.className = 'sc-dot';
        bub.appendChild(d);
      }
    }
    typingEl.appendChild(bub);
    messagesEl.appendChild(typingEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  function hideTyping() {
    if (typingEl) {
      typingEl.remove();
      typingEl = null;
    }
  }

  function showOffline() {
    if (!offlineEl) return;
    offlineEl.hidden = false;
    offlineEl.textContent = OFFLINE_MSG;
  }

  // ── speech synthesis (TTS) ──
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
      if (!canSpeak || muted || !text) {
        resolve();
        return;
      }
      try {
        synth.cancel(); // never let two turns overlap
        const utter = new window.SpeechSynthesisUtterance(text);
        const voice = pickVoice();
        if (voice) utter.voice = voice;
        utter.rate = 1;
        utter.pitch = 1;
        utter.onend = () => resolve();
        utter.onerror = () => resolve(); // never throw to the console over a TTS glitch
        setState('speaking', 'Speaking');
        synth.speak(utter);
      } catch {
        resolve();
      }
    });
  }

  // ── mute / stop-speaking control ──
  function setMuted(next) {
    muted = next;
    if (muteBtn) {
      muteBtn.setAttribute('aria-pressed', String(muted));
      muteBtn.textContent = muted ? '🔇 Sound off' : '🔊 Sound on';
    }
    if (muted && canSpeak) {
      try {
        synth.cancel();
      } catch {
        /* best-effort */
      }
    }
  }
  if (muteBtn) {
    if (!canSpeak) {
      muteBtn.hidden = true;
    } else {
      muteBtn.addEventListener('click', () => setMuted(!muted));
    }
  }

  // ── busy / disabled state while a turn is in flight ──
  function setBusy(busy) {
    if (inputEl) inputEl.disabled = busy;
    if (sendBtn) sendBtn.disabled = busy;
    if (micBtn) micBtn.disabled = busy || listening;
  }

  // One request with a single retry on a transient failure (network / 5xx).
  // 501 (LLM not configured) and 429 (rate limited) are returned as-is, not retried.
  async function requestTurn() {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'receptionist', messages: hist }),
        });
        if (r.status === 501 || r.status === 429) return { status: r.status };
        if (r.ok) {
          const data = await r.json().catch(() => null);
          return { status: 200, data };
        }
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
    if (hist.length > MAX_HISTORY) hist = hist.slice(-MAX_HISTORY);
    if (inputEl) inputEl.value = '';

    if (notConfigured) {
      showOffline();
      return;
    }

    setBusy(true);
    setState('thinking', 'Thinking');
    showTyping();
    const result = await requestTurn();
    hideTyping();

    if (result.status === 501) {
      setBusy(false);
      setState('idle', 'Idle');
      notConfigured = true;
      showOffline();
      return;
    }
    if (result.status === 429) {
      setBusy(false);
      setState('idle', 'Idle');
      note("Getting a lot of calls right now — give it a second and try again.");
      return;
    }
    const data = result.data;
    if (!data || !data.ok || typeof data.reply !== 'string' || !data.reply) {
      setBusy(false);
      setState('idle', 'Idle');
      note("That didn't go through — book a call and I'll show you the real thing.");
      return;
    }

    bubble('bot', data.reply);
    hist.push({ role: 'assistant', content: data.reply });
    if (hist.length > MAX_HISTORY) hist = hist.slice(-MAX_HISTORY);
    await speak(data.reply);
    setBusy(false);
    setState('idle', 'Idle');
    if (inputEl) {
      try {
        inputEl.focus();
      } catch {
        /* jsdom / detached */
      }
    }
  }

  function open() {
    if (opened) return;
    opened = true;
    bubble('bot', GREETING);
    hist.push({ role: 'assistant', content: GREETING });
  }

  if (formEl) {
    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      send(inputEl ? inputEl.value : '');
    });
  }

  // ── speech recognition (STT) ──
  if (!SpeechRecognitionCtor) {
    if (micBtn) micBtn.hidden = true;
    if (voiceNoteEl) {
      voiceNoteEl.hidden = false;
      voiceNoteEl.textContent = 'Voice works best in Chrome; type below instead.';
    }
  } else if (micBtn) {
    function stopListening() {
      listening = false;
      micBtn.dataset.listening = 'false';
      micBtn.setAttribute('aria-pressed', 'false');
      if (micLabelEl) micLabelEl.textContent = 'Talk to it';
      if (!inputEl || !inputEl.disabled) setBusy(false);
      if (statusEl && statusEl.dataset.state === 'listening') setState('idle', 'Idle');
    }

    function startListening() {
      try {
        recognition = new SpeechRecognitionCtor();
      } catch {
        if (micBtn) micBtn.hidden = true;
        if (voiceNoteEl) {
          voiceNoteEl.hidden = false;
          voiceNoteEl.textContent = 'Voice works best in Chrome; type below instead.';
        }
        return;
      }
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        listening = true;
        micBtn.dataset.listening = 'true';
        micBtn.setAttribute('aria-pressed', 'true');
        if (micLabelEl) micLabelEl.textContent = 'Listening… tap to stop';
        setState('listening', 'Listening');
      };
      recognition.onresult = (event) => {
        const transcript = event.results && event.results[0] && event.results[0][0] ? event.results[0][0].transcript : '';
        stopListening();
        if (transcript) send(transcript);
      };
      recognition.onerror = (event) => {
        stopListening();
        if (event && (event.error === 'not-allowed' || event.error === 'service-not-allowed')) {
          micBtn.hidden = true;
          if (voiceNoteEl) {
            voiceNoteEl.hidden = false;
            voiceNoteEl.textContent = "Mic access is blocked — type below instead.";
          }
          return;
        }
        if (event && event.error === 'no-speech') return; // quiet — just reset, no scary note
        note("Didn't catch that — try again, or type instead.");
      };
      recognition.onend = () => {
        if (listening) stopListening();
      };

      try {
        recognition.start();
      } catch {
        stopListening();
      }
    }

    micBtn.addEventListener('click', () => {
      if (listening && recognition) {
        try {
          recognition.stop();
        } catch {
          /* best-effort */
        }
        return;
      }
      if (canSpeak) {
        try {
          synth.cancel(); // stop the AI talking before we listen, to avoid it hearing itself
        } catch {
          /* best-effort */
        }
      }
      startListening();
    });
  }

  open();
}
