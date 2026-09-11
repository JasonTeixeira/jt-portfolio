/* narrator.js — site-wide voice narration in Nadine's voice.
   Drop this on any page; it maps the current page to a pre-recorded narration clip
   (/assets/narration/en/<key>.mp3), and if that clip exists, shows a small "Hear this page"
   control. Click it and Nadine narrates the page through a Web Audio graph that drives a live
   orb + waveform (the same real-signal visualizer as the intro). No autoplay (starts on the
   click gesture), degrades to plain playback without Web Audio, and never shows if no clip. */
(function () {
  'use strict';
  var d = document;
  if (d.getElementById('jt-narrator')) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Map the pathname → narration key. (English narration site-wide for now.)
  var p = location.pathname.replace(/\/(es|pt)(\/|$)/, '/');
  function keyFor(x) {
    if (x === '/' || /(^|\/)index\.html$/.test(x)) return 'home';
    if (/services\.html$/.test(x)) return 'services';
    if (/case-studies\.html$/.test(x) || /work-[a-z]+\.html$/.test(x)) return 'work';
    if (/proof\.html$/.test(x)) return 'proof';
    if (/lead-audit\.html$/.test(x)) return 'lead-audit';
    if (/book\.html$/.test(x)) return 'book';
    return null;
  }
  var CAPTIONS = {
    home: "Welcome to Sage Ideas. Jason builds AI features for teams, and then proves they actually work — with evals, tests, and gates you can see. Everything on this page links to real evidence.",
    services: "Here's everything Jason builds — AI features, automations, data pipelines, web apps, and the quality layer that proves it all works. Most clients keep him on a monthly retainer.",
    work: "These are real systems Jason has shipped and runs himself — a live trading platform and a full learning product, built solo. The strongest proof isn't a testimonial; it's software in production.",
    proof: "This is the part most agencies skip. This very site runs its own quality checks, in public — no fake green, not even Jason's. Every claim links to a real, reproducible run.",
    'lead-audit': "Let's find the money you're leaving on the table. See what slow lead response is costing you, then hear the AI front desk that answers every lead instantly.",
    book: "Ready to talk? Grab a fifteen-minute intro call. No sales team, no pressure — just a quick conversation about whether Jason can help."
  };
  var key = keyFor(p);
  if (!key || !CAPTIONS[key]) return;
  var SRC = '/assets/narration/en/' + key + '.mp3?v=nadine1';

  // Only mount if the clip is really there (fetch HEAD — deterministic, no autoplay dependency).
  try {
    fetch(SRC, { method: 'HEAD' }).then(function (r) { if (r && r.ok) mount(); }).catch(function () {});
  } catch (e) { /* no fetch → skip */ }

  var audio = null, actx = null, analyser = null, freq = null, rafId = 0, playing = false;
  function mount() {
    injectCss();
    var wrap = d.createElement('div'); wrap.id = 'jt-narrator'; wrap.setAttribute('lang', 'en');
    wrap.innerHTML =
      '<button class="jt-nar-toggle" aria-label="Hear this page, narrated">' +
      '<span class="jt-nar-orb" aria-hidden="true"></span>' +
      '<span class="jt-nar-lbl">Hear this page</span>' +
      '</button>' +
      '<div class="jt-nar-panel" hidden>' +
      '<div class="jt-nar-row"><span class="jt-nar-orb big" aria-hidden="true"></span><span class="jt-nar-name">Nadine</span>' +
      '<canvas class="jt-nar-viz" width="110" height="22" aria-hidden="true"></canvas>' +
      '<button class="jt-nar-x" aria-label="Stop narration">&times;</button></div>' +
      '<p class="jt-nar-cap"></p>' +
      '</div>';
    d.body.appendChild(wrap);
    wrap.querySelector('.jt-nar-toggle').addEventListener('click', start);
    wrap.querySelector('.jt-nar-x').addEventListener('click', stop);
  }

  function ensureGraph() {
    if (audio) return true;
    try {
      audio = new window.Audio(); audio.crossOrigin = 'anonymous'; audio.src = SRC;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        actx = new AC();
        var s = actx.createMediaElementSource(audio);
        analyser = actx.createAnalyser(); analyser.fftSize = 128; analyser.smoothingTimeConstant = 0.8;
        freq = new Uint8Array(analyser.frequencyBinCount);
        s.connect(analyser); analyser.connect(actx.destination);
      }
      audio.onended = stop;
      audio.onerror = stop;
      return true;
    } catch (e) { if (!audio) { try { audio = new window.Audio(); audio.src = SRC; } catch (e2) { audio = null; } } return !!audio; }
  }

  function start() {
    var w = d.getElementById('jt-narrator'); if (!w) return;
    if (!ensureGraph()) return;
    if (actx && actx.state === 'suspended') actx.resume();
    w.querySelector('.jt-nar-toggle').hidden = true;
    var panel = w.querySelector('.jt-nar-panel'); panel.hidden = false;
    w.querySelector('.jt-nar-cap').textContent = CAPTIONS[key];
    playing = true;
    try { var pr = audio.play(); if (pr && pr.catch) pr.catch(function () { stop(); }); } catch (e) { stop(); return; }
    viz();
  }

  function viz() {
    if (reduce || !analyser || !playing) return;
    var w = d.getElementById('jt-narrator'); if (!w) return;
    var orbs = w.querySelectorAll('.jt-nar-orb'), cv = w.querySelector('.jt-nar-viz'), cx = cv && cv.getContext ? cv.getContext('2d') : null;
    var n = freq.length;
    function frame() {
      if (!analyser || !playing) return;
      analyser.getByteFrequencyData(freq);
      var sum = 0; for (var i = 0; i < n; i++) sum += freq[i];
      var amp = sum / (n * 255);
      orbs.forEach(function (o) { o.style.transform = 'scale(' + (1 + amp * 0.5).toFixed(3) + ')'; o.style.boxShadow = '0 0 ' + (8 + amp * 26) + 'px rgba(34,211,238,' + (0.5 + amp * 0.4).toFixed(2) + ')'; });
      if (cx) {
        var W = cv.width, H = cv.height, bars = 20, bw = W / bars;
        cx.clearRect(0, 0, W, H);
        for (var b = 0; b < bars; b++) { var v = freq[Math.floor(b / bars * n)] / 255, bh = Math.max(2, v * H); cx.fillStyle = 'rgba(34,211,238,' + (0.3 + v * 0.7).toFixed(2) + ')'; cx.fillRect(b * bw + 1, (H - bh) / 2, bw - 2, bh); }
      }
      rafId = requestAnimationFrame(frame);
    }
    cancelAnimationFrame(rafId); frame();
  }

  function stop() {
    playing = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    if (audio) { try { audio.pause(); audio.currentTime = 0; } catch (e) {} }
    var w = d.getElementById('jt-narrator'); if (!w) return;
    w.querySelector('.jt-nar-panel').hidden = true;
    var tog = w.querySelector('.jt-nar-toggle'); tog.hidden = false;
    w.querySelectorAll('.jt-nar-orb').forEach(function (o) { o.style.transform = ''; o.style.boxShadow = ''; });
  }

  function injectCss() {
    if (d.getElementById('jt-nar-css')) return;
    var css = [
      // pointer-events:none on the wrapper so its empty area (full-width on mobile) never
      // swallows taps meant for the Atlas FAB beneath it; the actual controls re-enable it.
      '#jt-narrator{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147482000;pointer-events:none;font-family:"Plus Jakarta Sans",system-ui,sans-serif}',
      // Hide while the mobile nav is open so it never overlaps a menu item (e.g. Sign up).
      'body.site-nav-open #jt-narrator{display:none!important}',
      '.jt-nar-toggle{pointer-events:auto;display:inline-flex;align-items:center;gap:9px;background:rgba(12,12,15,0.94);backdrop-filter:blur(12px);border:1px solid #2A2826;border-radius:999px;padding:9px 16px 9px 11px;color:#F4F2EF;font:600 12.5px/1 "Plus Jakarta Sans",system-ui,sans-serif;cursor:pointer;box-shadow:0 12px 34px rgba(0,0,0,0.5);transition:border-color .2s,transform .2s}',
      '.jt-nar-toggle:hover{border-color:#22d3ee;transform:translateY(-1px)}',
      '.jt-nar-orb{width:18px;height:18px;border-radius:50%;flex:0 0 auto;background:radial-gradient(circle at 35% 30%,#22d3ee,#065f46);box-shadow:0 0 10px rgba(34,211,238,.5)}',
      '.jt-nar-orb.big{width:24px;height:24px}',
      '.jt-nar-panel{pointer-events:auto;background:rgba(12,12,15,0.97);backdrop-filter:blur(16px);border:1px solid #2A2826;border-radius:16px;padding:15px 18px;width:min(460px,calc(100vw - 24px));box-shadow:0 24px 70px rgba(0,0,0,.6)}',
      '.jt-nar-row{display:flex;align-items:center;gap:10px;margin-bottom:10px}',
      '.jt-nar-name{font:700 12px/1 "JetBrains Mono",monospace;letter-spacing:.06em;color:#F4F2EF}',
      '.jt-nar-viz{width:110px;height:22px;opacity:.9}',
      '.jt-nar-x{margin-left:auto;background:transparent;border:1px solid #2A2826;border-radius:7px;color:#8E8882;width:28px;height:28px;cursor:pointer;font-size:15px;line-height:1}',
      '.jt-nar-x:hover{color:#F4F2EF;border-color:#3D3A37}',
      '.jt-nar-cap{margin:0;font-family:"Instrument Serif",Georgia,serif;font-size:clamp(1.05rem,2vw,1.3rem);line-height:1.35;color:#F4F2EF}',
      '@media (max-width:560px){#jt-narrator{left:12px;right:12px;transform:none;text-align:center}.jt-nar-panel{width:auto}}',
      '@media (prefers-reduced-motion:reduce){.jt-nar-orb{transition:none}}'
    ].join('');
    var st = d.createElement('style'); st.id = 'jt-nar-css'; st.textContent = css; d.head.appendChild(st);
  }
})();
