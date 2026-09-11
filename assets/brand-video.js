/* brand-video.js — hydrates a lightweight <figure class="brand-video" data-*> placeholder into
   the full accessible video embed (EN captions default, ES/PT selectable), and injects a
   VideoObject JSON-LD block per video for SEO (Google video rich results + the WebVTT captions
   become an indexable transcript). One source of truth so all 23 embeds stay identical + on-brand.

   Usage on a page:
   <figure class="brand-video" data-slug="01-intro" data-title="I ship AI features. Then I prove they work."
           data-desc="..." data-dur="PT51S" data-preload="metadata"></figure>

   preload: "metadata" (default, above-the-fold) or "none" (below-the-fold, poster still shows).
   Never autoplays. Poster uses the .webp (falls back to nothing if unsupported — video still plays). */
(function () {
  'use strict';
  var d = document;
  var MEDIA = '/media';
  var SITE = 'https://agency.sageideas.dev';

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function build(fig) {
    if (fig.getAttribute('data-hydrated')) return;
    fig.setAttribute('data-hydrated', '1');
    var slug = fig.getAttribute('data-slug'); if (!slug) return;
    var title = fig.getAttribute('data-title') || '';
    var desc = fig.getAttribute('data-desc') || title;
    var preload = fig.getAttribute('data-preload') === 'none' ? 'none' : 'metadata';
    var poster = MEDIA + '/posters/' + slug + '.webp';

    var v = d.createElement('video');
    v.setAttribute('controls', '');
    v.setAttribute('playsinline', '');
    v.setAttribute('preload', preload);
    v.setAttribute('poster', poster);
    v.setAttribute('style', 'width:100%;height:auto;aspect-ratio:16/9;border-radius:16px;background:#09090B;display:block');
    if (title) v.setAttribute('aria-label', title);
    v.innerHTML =
      '<source src="' + MEDIA + '/videos/' + slug + '.mp4" type="video/mp4">' +
      '<track kind="subtitles" src="' + MEDIA + '/captions/' + slug + '.en.vtt" srclang="en" label="English" default>' +
      '<track kind="subtitles" src="' + MEDIA + '/captions/' + slug + '.es.vtt" srclang="es" label="Español">' +
      '<track kind="subtitles" src="' + MEDIA + '/captions/' + slug + '.pt.vtt" srclang="pt" label="Português">' +
      'Your browser does not support embedded video. <a href="' + MEDIA + '/videos/' + slug + '.mp4">Download the MP4</a>.';
    // optional caption line under the video
    var cap = fig.getAttribute('data-caption');
    fig.appendChild(v);
    if (cap) { var fc = d.createElement('figcaption'); fc.className = 'brand-video-cap'; fc.textContent = cap; fig.appendChild(fc); }

    // VideoObject schema (SEO). thumbnail = poster jpg (broad support for crawlers).
    try {
      var ld = {
        '@context': 'https://schema.org', '@type': 'VideoObject',
        name: title, description: desc,
        thumbnailUrl: [SITE + MEDIA + '/posters/' + slug + '.jpg'],
        contentUrl: SITE + MEDIA + '/videos/' + slug + '.mp4',
        uploadDate: '2026-09-09',
        publisher: { '@type': 'Organization', name: 'Sage Ideas', url: SITE }
      };
      var dur = fig.getAttribute('data-dur'); if (dur) ld.duration = dur;
      var s = d.createElement('script'); s.type = 'application/ld+json'; s.textContent = JSON.stringify(ld);
      d.head.appendChild(s);
    } catch (e) { /* schema is best-effort */ }
  }

  function run() { var figs = d.querySelectorAll('figure.brand-video'); for (var i = 0; i < figs.length; i++) build(figs[i]); }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', run); else run();
})();
