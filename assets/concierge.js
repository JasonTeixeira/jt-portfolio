/**
 * Site-wide concierge chat — a floating helper that answers questions about
 * working with Jason and nudges toward the real conversion actions (demos,
 * live eval, free mini-eval, book a call). Calls /api/chat with mode:concierge
 * (real DeepSeek); falls back to scripted answers if the endpoint is offline,
 * so it never breaks. Drop-in: <script defer src="assets/concierge.js"></script>
 */
(function () {
  var C = { bg: '#0C0C0E', line: '#2A2826', ink: '#F4F2EF', dim: '#A8A29E', faint: '#8E8882', green: '#10b981', cyan: '#22d3ee' };
  var MONO = "'JetBrains Mono',monospace";
  var GREET = "Hi — I'm Jason's assistant. Ask me anything about the eval work, pricing, or how to get your AI feature checked. A real person reads everything too.";
  var CHIPS = ['What do you actually do?', 'How much does it cost?', 'Check my AI feature'];
  var FALLBACK = [
    [/price|cost|\$|how much|pay/i, "Free mini-eval to start (no call needed). Then $750 audit — one week, credited toward any build. Pilots from $2,500, full builds from $9,500. Prices are on the What I Build page."],
    [/what.*do|who|service|offer/i, "Jason tests and proves AI features for teams shipping LLM products — evaluation harnesses, safety probes, CI quality gates — plus automation and QA when it fits. His whole thing is 'proof, not vibes.' Want to see it work? Try the live eval."],
    [/eval|test|prove|check|feature|bot|assistant/i, "The fastest path: he runs a free mini-eval on your live AI feature and sends the findings — real probes, verbatim transcripts, no call required. Book a call or use the contact form and drop the feature URL."],
    [/book|call|talk|meet|hire|start|contact/i, "Best move: book a 15-minute call — you describe the problem, he tells you honestly what it takes and what it costs. Head to the Book a call page."],
    [/demo|see|show|work|voice|chat/i, "The Demos page has a real AI receptionist you can chat with or talk to out loud, and the Eval page grades an AI live — press the button and watch. Both show exactly what he builds."],
    [/human|real|person|email/i, "A real person reads everything at hello@sageideas.dev — usually same-day. Booking a call is the fastest path for anything specific."]
  ];
  var FB_DEFAULT = "Good question — for anything specific, the fastest path is a 15-minute call (the Book page) or emailing hello@sageideas.dev. Meanwhile: the eval work, pricing, and how to get your feature checked — ask away.";

  var open = false, mode = null, hist = [], panel, msgsEl, input;

  function css(el, s) { for (var k in s) el.style[k] = s[k]; }
  function add(who, text) {
    var d = document.createElement('div');
    css(d, { maxWidth: '86%', padding: '9px 12px', fontSize: '13px', lineHeight: '1.5', borderRadius: who === 'me' ? '13px 13px 4px 13px' : '13px 13px 13px 4px', alignSelf: who === 'me' ? 'flex-end' : 'flex-start', background: who === 'me' ? C.cyan : '#17161a', color: who === 'me' ? '#03282e' : '#D6D6DE' });
    d.textContent = text; msgsEl.appendChild(d); msgsEl.scrollTop = msgsEl.scrollHeight; return d;
  }
  function ask(history) {
    return fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'concierge', messages: history }) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { return d && d.ok && d.reply ? d.reply : null; })
      .catch(function () { return null; });
  }
  function scripted(q) { for (var i = 0; i < FALLBACK.length; i++) if (FALLBACK[i][0].test(q)) return FALLBACK[i][1]; return FB_DEFAULT; }
  function send(v) {
    v = (v || '').trim(); if (!v) return;
    add('me', v); input.value = ''; hist.push({ role: 'user', content: v });
    track('concierge-msg');
    var t = add('bot', '…');
    function done(txt) { t.textContent = txt; msgsEl.scrollTop = msgsEl.scrollHeight; hist.push({ role: 'assistant', content: txt }); }
    if (mode === 'script') { setTimeout(function () { done(scripted(v)); }, 350); return; }
    ask(hist).then(function (reply) {
      if (reply) { mode = 'ai'; done(reply); }
      else if (mode === 'ai') { done('One sec — say that once more?'); }
      else { mode = 'script'; setTimeout(function () { done(scripted(v)); }, 250); }
    });
  }
  function toggle() {
    open = !open; panel.style.display = open ? 'flex' : 'none';
    if (open && !msgsEl.children.length) { add('bot', GREET); hist.push({ role: 'assistant', content: GREET }); track('concierge-open'); input.focus(); }
  }
  function track(n) { try { if (typeof window.va === 'function') window.va('event', { name: n }); } catch (e) {} }

  function build() {
    var fab = document.createElement('button');
    fab.setAttribute('aria-label', 'Ask about working with Jason');
    fab.textContent = '💬';
    css(fab, { position: 'fixed', right: '20px', bottom: '20px', width: '52px', height: '52px', borderRadius: '50%', background: C.green, color: '#052e22', border: 'none', cursor: 'pointer', fontSize: '20px', boxShadow: '0 0 22px rgba(16,185,129,0.35), 0 12px 32px -8px rgba(0,0,0,0.6)', zIndex: '95' });
    fab.onclick = toggle;

    panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    css(panel, { position: 'fixed', right: '20px', bottom: '84px', width: 'min(340px, calc(100vw - 40px))', maxHeight: 'min(460px, calc(100vh - 120px))', background: C.bg, border: '1px solid ' + C.line, borderRadius: '16px', boxShadow: '0 32px 80px -24px rgba(0,0,0,0.9)', zIndex: '95', display: 'none', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" });

    var head = document.createElement('div');
    css(head, { display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 15px', borderBottom: '1px solid ' + C.line });
    head.innerHTML = '<span style="width:26px;height:26px;border-radius:8px;background:' + C.green + ';color:#052e22;display:grid;place-items:center;font-size:11px;font-weight:700;font-family:' + MONO + '">JT</span><span><b style="font-size:13px;color:' + C.ink + '">Ask about working with Jason</b><br><small style="font-family:' + MONO + ';font-size:9px;color:' + C.green + '">● usually replies in seconds</small></span><button aria-label="Close" style="margin-left:auto;background:none;border:none;color:' + C.faint + ';font-size:16px;cursor:pointer">×</button>';
    head.querySelector('button').onclick = function () { open = false; panel.style.display = 'none'; };

    msgsEl = document.createElement('div');
    css(msgsEl, { flex: '1', overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '9px', minHeight: '170px' });

    var chips = document.createElement('div');
    css(chips, { display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '0 15px 10px' });
    CHIPS.forEach(function (c) {
      var b = document.createElement('button'); b.textContent = c;
      css(b, { border: '1px solid ' + C.line, background: 'transparent', borderRadius: '14px', padding: '6px 11px', fontSize: '11.5px', color: C.dim, cursor: 'pointer', fontFamily: 'inherit' });
      b.onclick = function () { send(c); }; chips.appendChild(b);
    });

    var row = document.createElement('div');
    css(row, { display: 'flex', gap: '8px', padding: '11px 15px', borderTop: '1px solid ' + C.line });
    input = document.createElement('input'); input.placeholder = 'Ask about the work…';
    css(input, { flex: '1', minWidth: '0', background: '#0F0F13', border: '1px solid ' + C.line, borderRadius: '10px', padding: '9px 12px', fontSize: '13px', color: C.ink, fontFamily: 'inherit', outline: 'none' });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(input.value); });
    var sendBtn = document.createElement('button'); sendBtn.textContent = '→';
    css(sendBtn, { background: C.green, color: '#052e22', border: 'none', borderRadius: '10px', padding: '0 14px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' });
    sendBtn.onclick = function () { send(input.value); };
    row.appendChild(input); row.appendChild(sendBtn);

    panel.appendChild(head); panel.appendChild(msgsEl); panel.appendChild(chips); panel.appendChild(row);
    document.body.appendChild(fab); document.body.appendChild(panel);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
