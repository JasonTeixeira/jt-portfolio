/* subscribe.js — renders the field-notes email capture into every
   [data-subscribe] slot. Shared by the homepage and generated note pages. */
(function () {
  'use strict';
  var slots = document.querySelectorAll('[data-subscribe]');
  if (!slots.length) return;

  var MONO = "font-family:'JetBrains Mono',monospace;";

  slots.forEach(function (slot) {
    slot.innerHTML =
      '<div style="border:1px solid rgba(16,185,129,0.3);background:rgba(16,185,129,0.04);padding:clamp(20px,3.5vw,30px)">' +
      '<div style="' + MONO + 'font-size:10.5px;letter-spacing:0.14em;text-transform:uppercase;color:#10b981;margin-bottom:8px">field notes, by email</div>' +
      '<p style="margin:0 0 14px;font-size:13.5px;line-height:1.65;color:#A8A29E;max-width:52ch">One or two notes a month from the proof-first trenches. No course funnel, no daily drip — unsubscribe is one click.</p>' +
      '<form style="display:flex;gap:10px;flex-wrap:wrap" novalidate>' +
      '<input type="email" name="email" required placeholder="you@company.com" autocomplete="email" aria-label="Email address" style="flex:1;min-width:min(220px,100%);background:#0C0C0E;border:1px solid #2A2826;border-radius:8px;color:#F4F2EF;font-family:\'Plus Jakarta Sans\',sans-serif;font-size:13.5px;padding:11px 14px">' +
      '<input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px">' +
      '<button type="submit" class="btn-solid green" style="border:none;cursor:pointer;padding:11px 20px;font-size:13px;font-family:\'Plus Jakarta Sans\',sans-serif">Subscribe →</button>' +
      '</form>' +
      '<div data-sub-status role="status" aria-live="polite" style="' + MONO + 'font-size:11px;color:#8E8882;margin-top:10px;min-height:1em"></div>' +
      '</div>';

    var form = slot.querySelector('form');
    var status = slot.querySelector('[data-sub-status]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var email = form.elements.email.value.trim();
      status.textContent = 'subscribing…';
      fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, website: form.elements.website.value })
      }).then(function (r) {
        if (r.ok) {
          form.reset();
          status.textContent = "you're on the list — thanks.";
          if (typeof window.va === 'function') window.va('event', { name: 'subscribe', data: { via: 'api' } });
        } else { throw new Error('api ' + r.status); }
      }).catch(function () {
        status.innerHTML = 'list isn’t wired up yet — email <a href="mailto:hello@sageideas.dev?subject=subscribe" style="color:#22d3ee">hello@sageideas.dev</a> with "subscribe" and I’ll add you by hand.';
        if (typeof window.va === 'function') window.va('event', { name: 'subscribe', data: { via: 'fallback' } });
      });
    });
  });
})();
