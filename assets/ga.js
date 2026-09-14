/* Unified GA4 — reports this site's traffic + funnel events to the SAME GA4 property as the
   Sage Academy (G-PS7LKSEGVW), so the agency and the school show up in one dashboard.
   - Production-only: hostname-gated to sageideas.dev, so preview/localhost don't pollute the data.
   - Routes the site's window.va(name, {data}) funnel calls into GA4 as events (scope/proposal/book),
     so you get real conversion funnels, not just pageviews.
   Match the Academy's privacy posture (IP anonymized, non-personalized). */
(function () {
  var GA_ID = 'G-PS7LKSEGVW';
  try { if (!location.hostname.endsWith('sageideas.dev')) return; } catch (e) { return; }
  var g = document.createElement('script');
  g.async = true; g.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(g);
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA_ID, { anonymize_ip: true });
  // The site fires window.va('event-name', { name, data }) at funnel milestones — send them to GA4.
  function gaRouter(kind, payload) {
    try {
      // GA4 event names must be alphanumeric+underscore, start with a letter, <=40 chars.
      // The site fires hyphenated names (book-call, wib-mini-eval, funnel-hire) — normalize them.
      var raw = (payload && payload.name) || kind || 'event';
      var name = String(raw).replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[^a-zA-Z]+/, '').slice(0, 40) || 'event';
      gtag('event', name, (payload && payload.data) || {});
    } catch (e) { /* ignore */ }
  }
  window.va = gaRouter;
  // Vercel Insights (injected async by site.js) replaces window.va with its own reporter when it
  // loads, which would steal the funnel events. Reclaim window.va after load so the funnel's
  // click-events (book, mini-eval, capture, etc.) reliably reach GA4. Vercel still auto-tracks
  // pageviews via its own script, independent of window.va — so both dashboards stay populated.
  window.addEventListener('load', function () { window.va = gaRouter; });

  // Sitewide click/engagement tracking. This lived only in site.js (homepage-only) before, so
  // every lander/demo/book page carried [data-evt] attributes with no listener — their
  // funnel-step clicks were silently unreported. ga.js is loaded on every page, so put it here.
  // (site.js's duplicate delegator was removed to avoid double-firing on the homepage.)
  try {
    var qp = new URLSearchParams(location.search);
    var utm = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']
      .map(function (k) { var v = qp.get(k); return v ? k + '=' + v : ''; }).filter(Boolean).join('&');
    if (utm && !sessionStorage.getItem('jt-utm')) sessionStorage.setItem('jt-utm', utm);
  } catch (e) { /* private mode */ }
  function track(name, data) {
    var payload = data || {};
    try { var u = sessionStorage.getItem('jt-utm'); if (u) payload.utm = u; } catch (e) { /* ignore */ }
    gaRouter('event', { name: name, data: payload });
  }
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-evt]');
    if (el) track(el.getAttribute('data-evt'));
    var resume = e.target.closest && e.target.closest('a[href$="Jason-Teixeira-Resume.pdf"]');
    if (resume) track('resume-download');
  });
  document.addEventListener('toggle', function (e) {
    if (e.target.classList && e.target.classList.contains('brief-more') && e.target.open) track('brief-expand');
    if (e.target.classList && e.target.classList.contains('faq') && e.target.open) track('faq-open');
  }, true);
})();
