/**
 * assets/agent.js — "Atlas," Jason's AI associate. A premium, agentic site-wide
 * assistant: it represents Jason, qualifies the visitor, and drives to the real
 * conversion actions (free mini-eval, book a call, see it live, browse services).
 *
 * Real AI via /api/chat (mode: associate, DeepSeek) with a typewriter reveal;
 * falls back to a scripted brain when the endpoint is offline, so it NEVER
 * breaks on a static host. Contextual action chips + inline lead capture
 * (/api/lead) turn the chat into a conversion surface, not a toy.
 *
 * Drop-in: <script defer src="assets/agent.js"></script>
 * Programmatic open (e.g. a hero CTA): window.openAtlas()
 */
(function () {
  var C = { bg: '#0B0B0D', panel: '#0C0C0E', line: '#26241F', ink: '#F4F2EF', dim: '#A8A29E', faint: '#8E8882', green: '#10b981', cyan: '#22d3ee', purple: '#a78bfa' };
  var MONO = "'JetBrains Mono',monospace";
  var GREET = "Hey — I'm Atlas, Jason's AI associate. I can show you exactly what he builds, get your AI feature checked for free, or set up a call. What are you working on?";
  var START = [
    { label: 'What does Jason do?', q: 'What does Jason actually do?' },
    { label: 'Check my AI feature (free)', act: 'minieval' },
    { label: 'What can he build?', nav: 'services.html' },
    { label: 'Book a call', nav: 'book.html' }
  ];

  // Scripted fallback brain — quote-first, used only when /api/chat is offline.
  var FALLBACK = [
    [/price|cost|\$|how much|pay|budget|rate|quote/i, "There's no fixed price list — every engagement is scoped and quoted after a short call, so you pay for your problem, not a package. The lowest-risk start is free: Jason runs a real eval on your live AI feature and sends the findings. Want that?"],
    [/what.*(do|does|build|offer)|who is|services?|help with/i, "Jason ships AI features and then proves they work — LLM evaluation harnesses, adversarial safety testing, CI quality gates — plus test automation and AI workflow automation. His whole thing is 'proof, not vibes.' Want to see it run live, or have your own feature checked?"],
    [/eval|test|prove|check|feature|bot|assistant|chatbot|agent|rag|hallucinat|safety|injection/i, "The fastest path: a free mini-eval. Jason points his eval engine at your live AI feature, runs adversarial probes (injection, jailbreak, hallucination, PII…), and sends you the verbatim findings — no call required. Drop your feature URL and I'll set it up."],
    [/book|call|talk|meet|hire|start|contact|email|reach/i, "Easiest is a 15-minute call — you describe the problem, Jason tells you honestly what it takes and what it'd cost. Want me to open the booking page, or should I take your email so he reaches out?"],
    [/demo|see|show|work|voice|live|example/i, "Two live things worth seeing: the Demos page has an AI receptionist you can chat or talk to, and the Eval page grades an AI in real time — press run and watch it fail probes. Want me to open one?"],
    [/proof|case|experience|done before|track record|result|metric|client/i, "Real proof, all public: an open-source eval gate (green in ~10 min), a QA platform with 85 runners and a documented red→green security fix, a 37/37 Playwright suite, plus Fortune-50 test infra and a live suite taken from 10% flake to under 1%. Want the case studies?"],
    [/human|real person|are you (a )?(ai|bot|real)|atlas/i, "Honest answer: I'm Atlas, Jason's AI associate — real AI, and a real person reads everything at hello@sageideas.dev. I can answer most things about the work and set up the next step. What do you need?"]
  ];
  var FB_DEFAULT = "Good question — for anything specific, the fastest paths are a free mini-eval on your feature or a 15-minute call. Meanwhile I can walk you through what Jason builds, the proof behind it, or how engagements work. What's most useful?";

  var open = false, mode = null, hist = [], panel, msgsEl, chipsEl, input, typingEl;

  function css(el, s) { for (var k in s) el.style[k] = s[k]; }
  function el(tag, style, html) { var n = document.createElement(tag); if (style) css(n, style); if (html != null) n.innerHTML = html; return n; }
  function track(n) { try { if (typeof window.va === 'function') window.va('event', { name: n }); } catch (e) {} }

  function bubble(who) {
    var d = el('div', {
      maxWidth: '88%', padding: '10px 13px', fontSize: '13.5px', lineHeight: '1.55',
      borderRadius: who === 'me' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
      alignSelf: who === 'me' ? 'flex-end' : 'flex-start',
      background: who === 'me' ? 'linear-gradient(135deg,#22d3ee,#0ea5b7)' : '#17161a',
      color: who === 'me' ? '#04242a' : '#E7E5E1',
      boxShadow: who === 'me' ? '0 6px 18px -8px rgba(34,211,238,0.5)' : 'none',
      opacity: '0', transform: 'translateY(6px)', transition: 'opacity .25s, transform .25s'
    });
    msgsEl.appendChild(d);
    requestAnimationFrame(function () { d.style.opacity = '1'; d.style.transform = 'none'; });
    scroll();
    return d;
  }
  function scroll() { msgsEl.scrollTop = msgsEl.scrollHeight; }

  // typewriter reveal for the wow factor (respects reduced-motion)
  function typeInto(node, text, done) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || text.length > 320) { node.textContent = text; scroll(); done && done(); return; }
    var i = 0;
    (function step() {
      node.textContent = text.slice(0, i);
      scroll();
      if (i++ < text.length) { setTimeout(step, 12); } else { done && done(); }
    })();
  }

  function showTyping() {
    typingEl = el('div', { alignSelf: 'flex-start', display: 'flex', gap: '4px', padding: '12px 14px', background: '#17161a', borderRadius: '14px 14px 14px 4px' });
    for (var i = 0; i < 3; i++) {
      var dot = el('span', { width: '6px', height: '6px', borderRadius: '50%', background: C.faint, animation: 'atlasdot 1s ' + (i * 0.15) + 's infinite ease-in-out' });
      typingEl.appendChild(dot);
    }
    msgsEl.appendChild(typingEl); scroll();
  }
  function hideTyping() { if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl); typingEl = null; }

  function scripted(q) { for (var i = 0; i < FALLBACK.length; i++) if (FALLBACK[i][0].test(q)) return FALLBACK[i][1]; return FB_DEFAULT; }

  function ask(history) {
    return fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'associate', messages: history }) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { return d && d.ok && d.reply ? d.reply : null; })
      .catch(function () { return null; });
  }

  // contextual action chips based on the running conversation
  function actionsFor(text) {
    var t = (text || '').toLowerCase(), acts = [];
    if (/eval|test|prove|check|feature|bot|assistant|chatbot|agent|rag|hallucinat|safety|injection|price|cost/.test(t))
      acts.push({ label: '⚡ Free mini-eval', act: 'minieval' });
    if (/proof|case|experience|result|metric|client|track record|done before/.test(t))
      acts.push({ label: '📁 Case studies', nav: 'case-studies.html' });
    if (/demo|see|show|live|watch|example/.test(t))
      acts.push({ label: '▶ See it live', nav: 'eval.html' });
    acts.push({ label: '📅 Book a call', nav: 'book.html' });
    if (acts.length < 3) acts.push({ label: '◆ All services', nav: 'services.html' });
    // de-dupe by label, cap 3
    var seen = {}, out = [];
    acts.forEach(function (a) { if (!seen[a.label] && out.length < 3) { seen[a.label] = 1; out.push(a); } });
    return out;
  }

  function renderChips(list) {
    chipsEl.innerHTML = '';
    (list || []).forEach(function (c) {
      var b = el('button', {
        border: '1px solid ' + C.line, background: 'rgba(255,255,255,0.02)', borderRadius: '15px',
        padding: '7px 12px', fontSize: '11.5px', color: C.ink, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap'
      }, c.label);
      b.onmouseenter = function () { b.style.borderColor = C.cyan; b.style.color = C.cyan; };
      b.onmouseleave = function () { b.style.borderColor = C.line; b.style.color = C.ink; };
      b.onclick = function () {
        if (c.nav) { track('atlas-nav'); location.href = c.nav; return; }
        if (c.act === 'minieval') { captureFlow('minieval'); return; }
        if (c.act === 'followup') { captureFlow('followup'); return; }
        if (c.q) { send(c.q); }
      };
      chipsEl.appendChild(b);
    });
  }

  // inline lead capture — the conversion payoff, posts to /api/lead
  function captureFlow(kind) {
    chipsEl.innerHTML = '';
    var intro = kind === 'minieval'
      ? "Perfect. Drop your work email and the URL of your live AI feature — Jason runs a real mini-eval and sends you the findings. No call needed."
      : "Great — leave your email and Jason will personally follow up, usually same day.";
    var b = bubble('bot'); b.textContent = intro; hist.push({ role: 'assistant', content: intro });

    var wrap = el('div', { alignSelf: 'stretch', display: 'flex', flexDirection: 'column', gap: '8px', padding: '4px 2px' });
    var email = el('input'); email.type = 'email'; email.placeholder = 'you@company.com';
    var url = el('input'); url.type = 'text'; url.placeholder = 'https://yourapp.com/chat  (optional)';
    [email, url].forEach(function (inp) {
      css(inp, { background: '#0F0F13', border: '1px solid ' + C.line, borderRadius: '9px', padding: '10px 12px', fontSize: '13px', color: C.ink, fontFamily: 'inherit', outline: 'none' });
      inp.onfocus = function () { inp.style.borderColor = 'rgba(16,185,129,0.5)'; };
      inp.onblur = function () { inp.style.borderColor = C.line; };
    });
    if (kind !== 'minieval') url.style.display = 'none';
    var go = el('button', { background: C.green, color: '#052e22', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }, kind === 'minieval' ? 'Send me the findings →' : 'Have Jason reach out →');
    wrap.appendChild(email); wrap.appendChild(url); wrap.appendChild(go);
    msgsEl.appendChild(wrap); scroll();

    go.onclick = function () {
      var e = (email.value || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { email.style.borderColor = '#f43f5e'; email.focus(); return; }
      go.disabled = true; go.textContent = 'sending…';
      track('atlas-lead-' + kind);
      fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e, feature: (url.value || '').trim(), name: '', source: 'atlas-' + kind }) })
        .then(function () { return true; }).catch(function () { return true; })
        .then(function () {
          if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
          var ok = bubble('bot');
          ok.textContent = kind === 'minieval'
            ? "You're in — Jason will run the eval and email your findings. Anything else I can line up while you're here?"
            : "Done — Jason has it and will reach out shortly. Anything else I can help with?";
          hist.push({ role: 'assistant', content: ok.textContent });
          renderChips(actionsFor('proof demo services'));
        });
    };
  }

  function send(v) {
    v = (v || '').trim(); if (!v) return;
    bubble('me').textContent = v; input.value = ''; hist.push({ role: 'user', content: v });
    chipsEl.innerHTML = ''; track('atlas-msg');
    showTyping();
    function finish(txt) {
      hideTyping();
      var b = bubble('bot');
      typeInto(b, txt, function () { hist.push({ role: 'assistant', content: txt }); renderChips(actionsFor(v + ' ' + txt)); });
    }
    if (mode === 'script') { setTimeout(function () { finish(scripted(v)); }, 420); return; }
    ask(hist).then(function (reply) {
      if (reply) { mode = 'ai'; finish(reply); }
      else if (mode === 'ai') { finish("One sec — mind saying that once more?"); }
      else { mode = 'script'; setTimeout(function () { finish(scripted(v)); }, 320); }
    });
  }

  // ── voice input (Web Speech, feature-detected) ──
  var recog = null, listening = false;
  function setupVoice(micBtn) {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { micBtn.style.display = 'none'; return; }
    recog = new SR(); recog.lang = 'en-US'; recog.interimResults = false; recog.maxAlternatives = 1;
    recog.onresult = function (e) { var t = e.results[0][0].transcript; input.value = t; send(t); };
    recog.onend = function () { listening = false; micBtn.style.color = C.faint; micBtn.style.background = 'transparent'; };
    micBtn.onclick = function () {
      if (listening) { recog.stop(); return; }
      try { recog.start(); listening = true; micBtn.style.color = '#04242a'; micBtn.style.background = C.cyan; track('atlas-voice'); } catch (e) {}
    };
  }

  function openPanel() {
    open = true; panel.style.display = 'flex';
    requestAnimationFrame(function () { panel.style.opacity = '1'; panel.style.transform = 'none'; });
    if (!msgsEl.children.length) {
      var g = bubble('bot'); typeInto(g, GREET, function () { hist.push({ role: 'assistant', content: GREET }); renderChips(START); });
      track('atlas-open');
    }
    setTimeout(function () { input && input.focus(); }, 300);
  }
  function closePanel() { open = false; panel.style.opacity = '0'; panel.style.transform = 'translateY(10px) scale(0.98)'; setTimeout(function () { panel.style.display = 'none'; }, 200); }
  function toggle() { open ? closePanel() : openPanel(); }
  window.openAtlas = openPanel;

  function build() {
    // keyframes (typing dots + FAB pulse)
    var st = document.createElement('style');
    st.textContent = '@keyframes atlasdot{0%,80%,100%{opacity:.3;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}@keyframes atlaspulse{0%{box-shadow:0 0 0 0 rgba(16,185,129,.45)}70%{box-shadow:0 0 0 14px rgba(16,185,129,0)}100%{box-shadow:0 0 0 0 rgba(16,185,129,0)}}@media (prefers-reduced-motion:reduce){.atlas-fab{animation:none!important}}';
    document.head.appendChild(st);

    var fab = document.createElement('button');
    fab.className = 'atlas-fab';
    fab.setAttribute('aria-label', 'Ask about working with Jason');
    fab.innerHTML = '<span style="font-size:19px">✦</span>';
    css(fab, { position: 'fixed', right: '20px', bottom: '20px', width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg,#10b981,#0ea5b7)', color: '#03231b', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', boxShadow: '0 10px 30px -8px rgba(0,0,0,0.7)', zIndex: '95', animation: 'atlaspulse 3.2s infinite' });
    fab.onclick = toggle;

    panel = el('div', {
      position: 'fixed', right: '20px', bottom: '88px', width: 'min(384px, calc(100vw - 32px))',
      height: 'min(600px, calc(100vh - 120px))', background: C.panel, border: '1px solid ' + C.line,
      borderRadius: '18px', boxShadow: '0 40px 90px -24px rgba(0,0,0,0.92)', zIndex: '96', display: 'none',
      flexDirection: 'column', overflow: 'hidden', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
      opacity: '0', transform: 'translateY(10px) scale(0.98)', transition: 'opacity .2s, transform .2s'
    });
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', "Atlas — Jason's AI associate");

    // header
    var head = el('div', { display: 'flex', alignItems: 'center', gap: '11px', padding: '14px 16px', borderBottom: '1px solid ' + C.line, background: 'linear-gradient(180deg,rgba(16,185,129,0.06),transparent)' });
    var av = el('div', { position: 'relative', width: '38px', height: '38px', borderRadius: '11px', background: 'linear-gradient(135deg,#10b981,#22d3ee)', display: 'grid', placeItems: 'center', fontFamily: MONO, fontSize: '15px', fontWeight: '700', color: '#03231b', flexShrink: '0' }, '✦');
    var pulseDot = el('span', { position: 'absolute', right: '-2px', bottom: '-2px', width: '11px', height: '11px', borderRadius: '50%', background: C.green, border: '2px solid ' + C.panel });
    av.appendChild(pulseDot);
    var htext = el('div', { flex: '1', minWidth: '0' }, '<div style="font-size:14px;font-weight:700;color:' + C.ink + '">Atlas</div><div style="font-family:' + MONO + ';font-size:9.5px;color:' + C.green + '">● Jason’s AI associate · online</div>');
    var x = el('button', { marginLeft: 'auto', background: 'none', border: 'none', color: C.faint, fontSize: '20px', cursor: 'pointer', lineHeight: '1' }, '×');
    x.setAttribute('aria-label', 'Close'); x.onclick = closePanel;
    head.appendChild(av); head.appendChild(htext); head.appendChild(x);

    msgsEl = el('div', { flex: '1', overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' });

    chipsEl = el('div', { display: 'flex', flexWrap: 'wrap', gap: '7px', padding: '0 16px 10px' });

    var row = el('div', { display: 'flex', gap: '8px', alignItems: 'center', padding: '11px 14px', borderTop: '1px solid ' + C.line });
    input = document.createElement('input'); input.placeholder = 'Ask Atlas anything…'; input.setAttribute('aria-label', 'Message Atlas');
    css(input, { flex: '1', minWidth: '0', background: '#0F0F13', border: '1px solid ' + C.line, borderRadius: '11px', padding: '10px 13px', fontSize: '13.5px', color: C.ink, fontFamily: 'inherit', outline: 'none' });
    input.onfocus = function () { input.style.borderColor = 'rgba(34,211,238,0.5)'; };
    input.onblur = function () { input.style.borderColor = C.line; };
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(input.value); });
    var mic = el('button', { background: 'transparent', border: '1px solid ' + C.line, color: C.faint, borderRadius: '11px', width: '38px', height: '38px', fontSize: '15px', cursor: 'pointer', flexShrink: '0' }, '🎙');
    mic.setAttribute('aria-label', 'Talk to Atlas');
    var sendBtn = el('button', { background: 'linear-gradient(135deg,#10b981,#0ea5b7)', color: '#03231b', border: 'none', borderRadius: '11px', width: '40px', height: '38px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', flexShrink: '0' }, '→');
    sendBtn.setAttribute('aria-label', 'Send'); sendBtn.onclick = function () { send(input.value); };
    row.appendChild(input); row.appendChild(mic); row.appendChild(sendBtn);

    var trust = el('div', { padding: '0 16px 12px', fontFamily: MONO, fontSize: '9.5px', color: C.faint, textAlign: 'center' }, 'real AI · a real person reads everything at hello@sageideas.dev');

    panel.appendChild(head); panel.appendChild(msgsEl); panel.appendChild(chipsEl); panel.appendChild(row); panel.appendChild(trust);
    document.body.appendChild(fab); document.body.appendChild(panel);
    setupVoice(mic);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
