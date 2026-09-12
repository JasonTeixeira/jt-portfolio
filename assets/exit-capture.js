/* exit-capture.js — a tasteful, once-per-visitor last-chance mini-eval.
   Fires on genuine exit intent (desktop cursor leaving toward the tab bar) and
   offers the site's most differentiated free thing: a real eval of their AI feature.
   NOT a discount beg, NOT a full-screen modal — a small slide-up card, dismissible.

   Deliberately restrained so it never cheapens the brand:
   - once per visitor (localStorage jt-exit-v1), marked seen the moment it shows
   - desktop/hover pointers only (exit-intent is meaningless on touch)
   - never fires if a greeter/concierge is already open, if they already gave an
     email/name, on the booking/builder conversion pages, or under automation (SEO/tests safe)
   - respects prefers-reduced-motion (no slide, just appears)
   Posts to /api/lead {source:'exit-intent'}; degrades gracefully with an email fallback.
*/
(function () {
  var ENABLED = true;
  if (!ENABLED) return;
  var d = document, w = window;
  try { if (navigator.webdriver) return; } catch (e) { /* ignore */ }
  // touch / no-hover devices: skip (no real exit-intent signal)
  if (!w.matchMedia || !w.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  // not on the pages that ARE the conversion (don't interrupt booking/scoping/checkout)
  var path = location.pathname.replace(/\.html$/, '');
  if (/\/(book|build|portal|contract|proposal|login|signup|reset|dashboard)$/.test(path)) return;
  // already engaged? then no nag.
  try {
    if (localStorage.getItem('jt-exit-v1')) return;
    if (localStorage.getItem('jt-name')) return; // they've already given us their name
  } catch (e) { /* ignore */ }

  var LOC = /^\/pt(\/|$)/.test(location.pathname) ? 'pt' : /^\/es(\/|$)/.test(location.pathname) ? 'es' : 'en';
  function L(m) { return m[LOC] || m.en; }
  var T = {
    kicker: L({ en: 'Before you go', es: 'Antes de irte', pt: 'Antes de ir' }),
    head: L({ en: 'Want a free read on your AI feature?', es: '¿Quieres una lectura gratis de tu función de IA?', pt: 'Quer uma leitura grátis do seu recurso de IA?' }),
    sub: L({ en: "Drop the link and your email — Jason runs real adversarial probes against it and sends you what breaks. No call, no obligation.", es: 'Deja el enlace y tu correo — Jason corre pruebas adversarias reales y te envía lo que falla. Sin llamada, sin compromiso.', pt: 'Deixe o link e seu e-mail — o Jason roda testes adversariais reais e te envia o que quebra. Sem ligação, sem compromisso.' }),
    url: L({ en: 'https://your-app.com/chat', es: 'https://tu-app.com/chat', pt: 'https://seu-app.com/chat' }),
    email: 'you@company.com',
    send: L({ en: 'Send me the findings →', es: 'Envíame los hallazgos →', pt: 'Me envie os resultados →' }),
    ok: L({ en: "Got it — Jason will email your findings, usually same day.", es: 'Listo — Jason te enviará los hallazgos, normalmente el mismo día.', pt: 'Pronto — o Jason vai te enviar os resultados, normalmente no mesmo dia.' }),
    okFail: L({ en: "Got it. If you don't hear back, email hello@sageideas.dev.", es: 'Listo. Si no tienes respuesta, escribe a hello@sageideas.dev.', pt: 'Pronto. Se não tiver retorno, escreva para hello@sageideas.dev.' }),
    close: L({ en: 'Close', es: 'Cerrar', pt: 'Fechar' })
  };
  var reduce = w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var shown = false, card;

  function build() {
    card = d.createElement('div');
    card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', T.head); card.setAttribute('lang', LOC);
    card.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%) translateY(' + (reduce ? '0' : '120%') + ');z-index:120;width:min(440px,calc(100vw - 28px));background:#0C0C0E;border:1px solid #2A2826;border-radius:16px;box-shadow:0 20px 60px -12px rgba(0,0,0,0.7);padding:20px 20px 18px;opacity:' + (reduce ? '1' : '0') + ';transition:transform .5s cubic-bezier(.16,1,.3,1),opacity .4s;font-family:"Plus Jakarta Sans",system-ui,sans-serif';
    card.innerHTML =
      '<button type="button" class="jt-ex-x" aria-label="' + T.close + '" style="position:absolute;top:12px;right:12px;background:transparent;border:none;color:#8E8882;font-size:18px;line-height:1;cursor:pointer;padding:4px">&times;</button>' +
      '<div style="font-family:\'JetBrains Mono\',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#a78bfa;margin-bottom:8px">' + T.kicker + '</div>' +
      '<div style="font-family:\'Instrument Serif\',Georgia,serif;font-size:22px;line-height:1.2;color:#F4F2EF;margin-bottom:8px">' + T.head + '</div>' +
      '<p style="margin:0 0 14px;font-size:13px;line-height:1.6;color:#A8A29E">' + T.sub + '</p>' +
      '<form class="jt-ex-form" style="display:flex;flex-direction:column;gap:9px">' +
      '<input class="jt-ex-url" type="url" inputmode="url" placeholder="' + T.url + '" style="background:#08090c;border:1px solid #2A2826;border-radius:9px;padding:10px 12px;font-size:13px;color:#F4F2EF;font-family:inherit;outline:none">' +
      '<div style="display:flex;gap:9px;flex-wrap:wrap">' +
      '<input class="jt-ex-email" type="email" required placeholder="' + T.email + '" style="flex:1;min-width:170px;background:#08090c;border:1px solid #2A2826;border-radius:9px;padding:10px 12px;font-size:13px;color:#F4F2EF;font-family:inherit;outline:none">' +
      '<button type="submit" style="background:#a78bfa;color:#1a0f2e;border:none;border-radius:9px;padding:10px 16px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap">' + T.send + '</button>' +
      '</div><p class="jt-ex-status" aria-live="polite" style="margin:2px 0 0;font-family:\'JetBrains Mono\',monospace;font-size:10.5px;color:#8E8882"></p>' +
      '</form>';
    d.body.appendChild(card);
    requestAnimationFrame(function () { card.style.transform = 'translateX(-50%) translateY(0)'; card.style.opacity = '1'; });
    card.querySelector('.jt-ex-x').addEventListener('click', dismiss);
    var form = card.querySelector('.jt-ex-form');
    var emailEl = card.querySelector('.jt-ex-email'), urlEl = card.querySelector('.jt-ex-url'), statusEl = card.querySelector('.jt-ex-status');
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var email = (emailEl.value || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { emailEl.style.borderColor = '#f43f5e'; emailEl.focus(); return; }
      var btn = form.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'sending…';
      if (w.plausible) { try { w.plausible('exit-intent-submit'); } catch (e) { /* ignore */ } }
      fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email, feature: (urlEl.value || '').trim(), name: '', source: 'exit-intent' }) })
        .then(function (r) { return r && r.ok; }).catch(function () { return false; })
        .then(function (ok) {
          form.querySelector('div').style.display = 'none'; urlEl.style.display = 'none';
          statusEl.style.color = '#10b981'; statusEl.textContent = ok ? T.ok : T.okFail;
          setTimeout(dismiss, 3200);
        });
    });
  }
  function dismiss() {
    if (!card) return;
    card.style.transform = 'translateX(-50%) translateY(120%)'; card.style.opacity = '0';
    setTimeout(function () { if (card && card.parentNode) card.parentNode.removeChild(card); card = null; }, 480);
  }
  function otherSurfaceOpen() {
    return !!(d.getElementById('jt-gateway') || (d.getElementById('jt-welcome')) ||
      (d.querySelector('div[role="dialog"][aria-label*="Nadine"]')));
  }
  function trigger() {
    if (shown || otherSurfaceOpen()) return;
    shown = true;
    try { localStorage.setItem('jt-exit-v1', '1'); } catch (e) { /* ignore */ }
    build();
  }
  // Exit intent: cursor leaves the viewport toward the top (tab bar / address bar / close).
  // Armed after 8s so it never fires on a bounce-in-bounce-out.
  setTimeout(function () {
    d.addEventListener('mouseout', function (e) {
      if (shown) return;
      if (e.clientY <= 0 && !e.relatedTarget && !e.toElement) trigger();
    });
  }, 8000);
})();
