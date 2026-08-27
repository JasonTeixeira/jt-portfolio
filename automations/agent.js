/* Sage Automations — live AI sales agent widget.
   Talks to the real brain (/api/chat mode=automations), personalized to the
   visitor's niche. Consultative closer: helps the owner see the fit + books them.
   Degrade-safe: if the LLM is offline, falls back to the book CTA. ES module. */
import { getNiche } from '../assets/niches.mjs';

{
  const params = new URLSearchParams(location.search);
  const niche = getNiche(params.get('niche'));
  const bizRaw = (params.get('biz') || '').replace(/[<>]/g, '').slice(0, 60).trim();
  const context =
    `The visitor runs a ${niche.label} business${bizRaw ? ' called ' + bizRaw : ''}. ` +
    `Common time-sinks for them: ${(niche.sinks || []).join(', ')}. ` +
    `Their average job/customer value is around $${niche.avgJob}.`;

  const GREETING = bizRaw
    ? `Hey! I'm Jason's AI. I put this page together for ${bizRaw}. Tell me what eats most of your week and I'll show you where automation could give you that time back.`
    : `Hey! I'm Jason's AI. I help ${niche.label.toLowerCase()} get their time back with automation. What takes up most of your week — or ask me anything.`;
  const OFFLINE = "I'm offline for a sec — but the fastest way is a quick call. Tap “Book my 15-minute demo” and Jason will follow up himself.";

  const css = document.createElement('style');
  css.textContent = `
   .sa-fab{position:fixed;right:20px;bottom:20px;z-index:80;display:flex;align-items:center;gap:9px;background:#0f7a52;color:#fff;border:none;border-radius:999px;padding:13px 18px;font:650 15px/1 var(--font,system-ui);cursor:pointer;box-shadow:0 12px 30px -10px rgba(6,40,28,.6)}
   .sa-fab:hover{background:#064e3b}
   .sa-panel{position:fixed;right:20px;bottom:20px;z-index:81;width:min(380px,calc(100vw - 32px));height:min(560px,calc(100vh - 40px));background:#fff;border:1px solid #e3e8e4;border-radius:18px;box-shadow:0 24px 60px -20px rgba(6,40,28,.5);display:flex;flex-direction:column;overflow:hidden}
   .sa-panel[hidden]{display:none}
   .sa-head{background:#064e3b;color:#eafff4;padding:14px 16px;display:flex;justify-content:space-between;align-items:center}
   .sa-head b{font:700 15px/1.2 var(--font,system-ui)} .sa-head small{color:#7fae99;font-size:12px;display:block;margin-top:2px}
   .sa-x{background:none;border:none;color:#7fae99;font-size:22px;cursor:pointer;line-height:1}
   .sa-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:#f4f7f4}
   .sa-msg{max-width:85%;padding:10px 13px;border-radius:14px;font:400 14.5px/1.45 var(--font,system-ui)}
   .sa-them{background:#fff;border:1px solid #e3e8e4;align-self:flex-start;border-bottom-left-radius:5px}
   .sa-you{background:#0f7a52;color:#fff;align-self:flex-end;border-bottom-right-radius:5px}
   .sa-typing{align-self:flex-start;color:#6b7a72;font-size:13px;padding:4px 6px}
   .sa-foot{border-top:1px solid #e3e8e4;padding:10px;display:flex;gap:8px;background:#fff}
   .sa-foot input{flex:1;border:1.5px solid #e3e8e4;border-radius:10px;padding:11px 12px;font:400 14.5px var(--font,system-ui)}
   .sa-foot input:focus{outline:none;border-color:#0f7a52}
   .sa-send{background:#0f7a52;color:#fff;border:none;border-radius:10px;padding:0 16px;font:650 14px var(--font,system-ui);cursor:pointer}
   .sa-cta{align-self:flex-start;margin-top:2px}
   .sa-cta a{display:inline-block;background:#0f7a52;color:#fff;text-decoration:none;font:650 13px var(--font,system-ui);padding:9px 14px;border-radius:999px}
   @media (prefers-reduced-motion:reduce){.sa-fab,.sa-panel{transition:none}}`;
  document.head.appendChild(css);

  const fab = document.createElement('button');
  fab.className = 'sa-fab';
  fab.innerHTML = '<span aria-hidden="true">✦</span> Chat with our AI';
  fab.setAttribute('aria-label', 'Chat with our AI about automation for your business');

  const panel = document.createElement('div');
  panel.className = 'sa-panel';
  panel.hidden = true;
  panel.innerHTML =
    '<div class="sa-head"><div><b>Sage Automations</b><small>Jason\'s AI · replies in seconds</small></div><button class="sa-x" aria-label="Close">×</button></div>' +
    '<div class="sa-body" id="sa-body"></div>' +
    '<form class="sa-foot" id="sa-form"><input id="sa-in" placeholder="Type here…" autocomplete="off" maxlength="600"><button class="sa-send" type="submit">Send</button></form>';
  document.body.appendChild(fab);
  document.body.appendChild(panel);

  const body = panel.querySelector('#sa-body');
  const form = panel.querySelector('#sa-form');
  const input = panel.querySelector('#sa-in');
  const history = [];
  let greeted = false;

  function bubble(cls, text) {
    const d = document.createElement('div');
    d.className = 'sa-msg ' + cls;
    d.textContent = text;
    body.appendChild(d);
    body.scrollTop = body.scrollHeight;
    return d;
  }
  function ctaBubble() {
    const d = document.createElement('div');
    d.className = 'sa-cta';
    d.innerHTML = '<a href="#pricing" id="sa-book">Book my 15-minute demo →</a>';
    body.appendChild(d);
    body.scrollTop = body.scrollHeight;
    d.querySelector('a').addEventListener('click', (e) => { e.preventDefault(); close(); const b = document.querySelector('[data-book]'); if (b) b.click(); });
  }
  function open() {
    panel.hidden = false; fab.style.display = 'none';
    if (!greeted) { greeted = true; bubble('sa-them', GREETING); history.push({ role: 'assistant', content: GREETING }); setTimeout(() => input.focus(), 50); }
  }
  function close() { panel.hidden = true; fab.style.display = ''; }
  fab.addEventListener('click', open);
  panel.querySelector('.sa-x').addEventListener('click', close);

  async function send(text) {
    bubble('sa-you', text);
    history.push({ role: 'user', content: text });
    const typing = document.createElement('div');
    typing.className = 'sa-typing'; typing.textContent = 'typing…';
    body.appendChild(typing); body.scrollTop = body.scrollHeight;
    try {
      const r = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'automations', context, messages: history.slice(-14) }),
      });
      typing.remove();
      if (!r.ok) throw new Error('offline');
      const d = await r.json();
      const reply = (d && d.reply) ? String(d.reply) : OFFLINE;
      bubble('sa-them', reply);
      history.push({ role: 'assistant', content: reply });
      // nudge the CTA once the conversation has some depth
      if (history.filter((m) => m.role === 'user').length >= 2 && !document.querySelector('#sa-book')) ctaBubble();
    } catch (e) {
      typing.remove();
      bubble('sa-them', OFFLINE);
      ctaBubble();
    }
  }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v) return;
    input.value = '';
    send(v);
  });
}
