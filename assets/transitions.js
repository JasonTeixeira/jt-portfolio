/* transitions.js — page splash + flip transition between pages (progressive enhancement).
   The splash/reveal on load is pure CSS (#jt-pt in the markup). This adds the EXIT flip
   when navigating to another same-origin page, so MPA navigation feels seamless. */
(function () {
  'use strict';
  var root = document.documentElement;
  // respect reduced motion — no intercept, CSS hides the splash instantly
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    if (a.target === '_blank' || a.hasAttribute('download') || a.getAttribute('rel') === 'external') return;
    var href = a.getAttribute('href') || '';
    if (/^(#|mailto:|tel:|javascript:)/i.test(href)) return;
    var url;
    try { url = new URL(a.href, location.href); } catch (_) { return; }
    if (url.origin !== location.origin) return;                 // external → normal
    if (url.pathname === location.pathname) return;             // same page / anchor → let it be
    e.preventDefault();
    var ov = document.getElementById('jt-pt');
    var m = ov && ov.querySelector('.jt-pt-mark');
    if (m) { m.style.animation = 'none'; void m.offsetWidth; m.style.animation = ''; } // restart the flip
    root.classList.add('jt-pt-out');
    setTimeout(function () { location.href = url.href; }, 360);
  }, true);

  // if the user comes back via bfcache, make sure the overlay isn't stuck covering
  window.addEventListener('pageshow', function (e) { if (e.persisted) root.classList.remove('jt-pt-out'); });
})();
