/* welcome.js — "Atlas concierge": a proactive, NON-blocking first-visit greeter on the home page.
   Slides in after the splash settles, greets, and either runs a guided TOUR (animated section
   spotlight + typed narration + optional natural voice) or routes to the right action. Hands off
   to the existing systems (funnel mode, Atlas chat, real pages). Once-only, skippable, a11y + i18n.
   Home pages only (index.html, es/index.html, pt/index.html) — the only place this script is loaded.

   VOICE (optional, drop-in): each greeting/tour line looks for an audio clip at
   /assets/greeter/<loc>/<key>.mp3 (keys: s1..s6, one per tour step). If the file exists it plays in sync with
   the step (started by the user's tour click — a real gesture, so no autoplay block); if not, the
   step is text-only. Generate the clips from docs/GREETER-VOICE-SCRIPT.md and drop them in — nothing
   else changes. A mute toggle appears only when at least one clip is present. */
(function () {
  'use strict';
  var d = document, path = location.pathname;
  var loc = /^\/pt(\/|$)/.test(path) ? 'pt' : /^\/es(\/|$)/.test(path) ? 'es' : 'en';
  var base = loc === 'en' ? '' : '/' + loc;
  var force = /[?&]welcome=1/.test(location.search);
  var SEEN = 'jt-welcome-v2';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  try { if (!force && localStorage.getItem(SEEN)) return; } catch (e) {}
  // Don't auto-fire under automation — E2E runs aren't first-time visitors and the overlay
  // was intercepting unrelated assertions. ?welcome=1 still forces it, so it stays testable.
  try { if (!force && navigator.webdriver) return; } catch (e) {}

  var T = {
    en: {
      hi: "Hey — I'm Atlas, Jason's assistant.", q: "Want the 60-second tour, or shall I point you straight to it?",
      tour: "Take the 60-second tour", ship: "Ship an AI feature I can trust", qa: "Fix flaky or untested QA",
      hire: "I'm hiring for a role", browse: "Just exploring", watch: "Watch the 60-sec pitch",
      dismiss: "I'm here bottom-right whenever you need me.", hired: "Switched to the hiring view — résumé's up top.",
      online: "online", close: "Close", next: "Next", back: "Back", skip: "Skip tour", sound: "Sound", mute: "Mute",
      book: "Book a 15-min intro", explore: "I'll explore on my own",
      steps: [
        "Here's the whole idea: Jason builds your AI feature — then proves it actually works.",
        "The short version lives right here: what he does, why him, and how to start.",
        "This is the part most shops skip — the site runs its own quality checks, in public. No fake green, not even his.",
        "The work comes in three shapes: LLM and RAG evaluation, test automation, and workflow automation.",
        "Behind it: thirteen years in software quality, and two live AI products he builds and runs on his own.",
        "The best first step is a one-week audit — you leave with a plan either way. Want to grab a time?"
      ]
    },
    es: {
      hi: "Hola — soy Atlas, el asistente de Jason.", q: "¿Quieres el recorrido de 60 segundos o te llevo directo?",
      tour: "Ver el recorrido de 60 s", ship: "Lanzar una función de IA confiable", qa: "Arreglar QA inestable o sin pruebas",
      hire: "Estoy contratando", browse: "Solo explorando", watch: "Ver el pitch de 60 s",
      dismiss: "Estoy abajo a la derecha cuando me necesites.", hired: "Cambié a la vista de contratación — el CV está arriba.",
      online: "en línea", close: "Cerrar", next: "Siguiente", back: "Atrás", skip: "Omitir", sound: "Sonido", mute: "Silenciar",
      book: "Agenda 15 min", explore: "Prefiero explorar solo",
      steps: [
        "La idea es esta: Jason construye tu función de IA — y luego prueba que realmente funciona.",
        "La versión corta está aquí mismo: qué hace, por qué él y cómo empezar.",
        "Esta es la parte que casi todos omiten: el sitio ejecuta sus propias pruebas de calidad, en público. Nada de verde falso.",
        "El trabajo viene en tres formas: evaluación de LLM y RAG, automatización de pruebas y automatización de flujos.",
        "Detrás: trece años en calidad de software, y dos productos de IA en vivo que construye y opera solo.",
        "El mejor primer paso es una auditoría de una semana — te vas con un plan de todos modos. ¿Reservamos un horario?"
      ]
    },
    pt: {
      hi: "Olá — sou o Atlas, o assistente do Jason.", q: "Quer o tour de 60 segundos ou te levo direto ao ponto?",
      tour: "Ver o tour de 60 s", ship: "Lançar um recurso de IA confiável", qa: "Corrigir QA instável ou sem testes",
      hire: "Estou contratando", browse: "Só explorando", watch: "Ver o pitch de 60 s",
      dismiss: "Estou no canto inferior direito quando precisar.", hired: "Mudei para a visão de contratação — o CV está no topo.",
      online: "online", close: "Fechar", next: "Próximo", back: "Voltar", skip: "Pular", sound: "Som", mute: "Silenciar",
      book: "Agende 15 min", explore: "Prefiro explorar sozinho",
      steps: [
        "A ideia é esta: o Jason constrói o seu recurso de IA — e depois prova que ele realmente funciona.",
        "A versão curta está aqui: o que ele faz, por que ele e como começar.",
        "Esta é a parte que quase todos pulam — o site roda os próprios testes de qualidade, em público. Nada de verde falso.",
        "O trabalho vem em três formas: avaliação de LLM e RAG, automação de testes e automação de fluxos.",
        "Nos bastidores: treze anos em qualidade de software, e dois produtos de IA no ar que ele constrói e opera sozinho.",
        "O melhor primeiro passo é uma auditoria de uma semana — você sai com um plano de qualquer forma. Vamos marcar um horário?"
      ]
    }
  }[loc];

  // Tour steps: a section selector + the audio-clip key. Steps whose section is absent are skipped
  // (keeps es/pt robust even if a section like #tldr isn't mirrored yet).
  var STEP_DEFS = [
    { sel: '#top', key: 's1' }, { sel: '#tldr', key: 's2' }, { sel: '#proof', key: 's3' },
    { sel: '#services', key: 's4' }, { sel: '#about', key: 's5' }, { sel: '#contact', key: 's6' }
  ];

  function va(name, data) { if (typeof window.va === 'function') try { window.va('event', { name: name, data: data || {} }); } catch (e) {} }
  function seen() { try { localStorage.setItem(SEEN, '1'); } catch (e) {} }

  // ── voice (optional, drop-in) ──────────────────────────────────────────────
  var AUDIO_BASE = base + '/assets/greeter/' + loc + '/';
  var muted = false, curAudio = null;
  function stopAudio() { if (curAudio) { try { curAudio.pause(); } catch (e) {} curAudio = null; } }
  function playClip(key, onEnd) {
    stopAudio();
    if (muted) { return; }
    try {
      var a = new window.Audio(AUDIO_BASE + key + '.mp3');
      a.onended = function () { if (onEnd) onEnd(); };
      a.onerror = function () { curAudio = null; }; // no clip yet → text-only, silent
      curAudio = a;
      var p = a.play();
      if (p && p.catch) p.catch(function () { curAudio = null; });
    } catch (e) { curAudio = null; }
  }

  function go(href) {
    var ov = d.getElementById('jt-pt');
    if (ov && !reduce) { var m = ov.querySelector('.jt-pt-mark'); if (m) { m.style.animation = 'none'; void m.offsetWidth; m.style.animation = ''; } d.documentElement.classList.add('jt-pt-out'); setTimeout(function () { location.href = href; }, 360); }
    else location.href = href;
  }
  function setHire() { var b = d.querySelector('.funnel-btn[data-set="hire"]'); if (b) b.click(); }
  function toast(msg) { var t = d.getElementById('jt-toast'); if (t) { t.textContent = msg; t.classList.add('show'); setTimeout(function () { t.classList.remove('show'); }, 3200); } }

  var CHIPS = [
    { k: 'ship', label: T.ship, act: function () { va('welcome-ship'); go(base + '/eval.html'); } },
    { k: 'qa', label: T.qa, act: function () { va('welcome-qa'); go(base + '/services.html'); } },
    { k: 'hire', label: T.hire, act: function () { va('welcome-hire'); setHire(); close(true); toast(T.hired); } },
    { k: 'browse', label: T.browse, act: function () { va('welcome-browse'); close(true); toast(T.dismiss); } }
  ];

  var card, closed = false;
  function close(interacted) {
    if (closed) return; closed = true; seen(); stopAudio();
    if (card) { card.classList.remove('in'); card.classList.add('out'); setTimeout(function () { card.remove(); }, 380); }
    if (!interacted) va('welcome-dismiss');
    d.removeEventListener('keydown', onKey);
  }
  function onKey(e) { if (e.key === 'Escape') close(false); }

  function build() {
    injectCss();
    card = d.createElement('div'); card.id = 'jt-welcome'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', 'Atlas'); card.setAttribute('lang', loc);
    card.innerHTML =
      '<button class="jt-w-x" aria-label="' + T.close + '">&times;</button>' +
      '<div class="jt-w-inner">' +
      '<div class="jt-w-head"><span class="jt-w-mk" aria-hidden="true"></span><span class="jt-w-name">Atlas</span><span class="jt-w-on"><i></i>' + T.online + '</span></div>' +
      '<p class="jt-w-hi">' + T.hi + '</p>' +
      '<p class="jt-w-q">' + T.q + '</p>' +
      '<button class="jt-w-tour"><span class="jt-w-tour-ic" aria-hidden="true">&#9654;</span> ' + T.tour + '</button>' +
      '<div class="jt-w-chips">' + CHIPS.map(function (c, i) { return '<button class="jt-w-chip" data-k="' + c.k + '" style="--i:' + i + '"><span>' + c.label + '</span><i class="jt-w-arw" aria-hidden="true">&rarr;</i></button>'; }).join('') + '</div>' +
      '<div class="jt-w-foot"><button class="jt-w-watch"><span aria-hidden="true">&#9654;</span> ' + T.watch + '</button></div>' +
      '</div>';
    d.body.appendChild(card);
    card.querySelector('.jt-w-x').addEventListener('click', function () { close(false); });
    card.querySelector('.jt-w-tour').addEventListener('click', function () { va('welcome-tour-start'); startTour(); });
    card.querySelectorAll('.jt-w-chip').forEach(function (b) { b.addEventListener('click', function () { var c = CHIPS.filter(function (x) { return x.k === b.dataset.k; })[0]; if (c) c.act(); }); });
    card.querySelector('.jt-w-watch').addEventListener('click', function () { va('welcome-watch'); openVideo(); });
    d.addEventListener('keydown', onKey);
    requestAnimationFrame(function () { card.classList.add('in'); });
    va('welcome-shown', { loc: loc });
  }

  // ── guided tour ─────────────────────────────────────────────────────────────
  var tour = null, steps = [], si = 0, typeTimer = null;
  function startTour() {
    steps = STEP_DEFS.filter(function (s) { return d.querySelector(s.sel); });
    if (!steps.length) { close(true); return; }
    if (card) { card.classList.remove('in'); card.classList.add('out'); setTimeout(function () { if (card) card.remove(); }, 300); }
    d.removeEventListener('keydown', onKey);
    seen();

    tour = d.createElement('div'); tour.id = 'jt-tour'; tour.setAttribute('role', 'dialog'); tour.setAttribute('aria-label', 'Guided tour'); tour.setAttribute('lang', loc);
    tour.innerHTML =
      '<div class="jt-tour-spot" aria-hidden="true"></div>' +
      '<div class="jt-tour-panel">' +
      '<div class="jt-tour-row">' +
      '<span class="jt-tour-orb" aria-hidden="true"></span>' +
      '<span class="jt-tour-name">Atlas</span>' +
      '<span class="jt-tour-dots" aria-hidden="true"></span>' +
      '<button class="jt-tour-sound" hidden aria-pressed="false"></button>' +
      '<button class="jt-tour-skip">' + T.skip + '</button>' +
      '</div>' +
      '<p class="jt-tour-text" aria-live="polite"></p>' +
      '<div class="jt-tour-nav">' +
      '<button class="jt-tour-back" hidden>&larr; ' + T.back + '</button>' +
      '<button class="jt-tour-next">' + T.next + ' &rarr;</button>' +
      '</div>' +
      '</div>';
    d.body.appendChild(tour);

    var dots = tour.querySelector('.jt-tour-dots');
    dots.innerHTML = steps.map(function () { return '<i></i>'; }).join('');

    tour.querySelector('.jt-tour-skip').addEventListener('click', endTour);
    tour.querySelector('.jt-tour-next').addEventListener('click', function () { step(si + 1); });
    tour.querySelector('.jt-tour-back').addEventListener('click', function () { step(si - 1); });

    // sound toggle only if a clip is actually present (probe the first one)
    probeAudio(function (present) {
      if (!present) return;
      var sb = tour.querySelector('.jt-tour-sound');
      sb.hidden = false; renderSound(sb);
      sb.addEventListener('click', function () {
        muted = !muted; renderSound(sb);
        if (muted) stopAudio(); else if (steps[si]) playClip(steps[si].key);
      });
    });

    d.addEventListener('keydown', tourKey);
    window.addEventListener('scroll', positionSpot, { passive: true });
    window.addEventListener('resize', positionSpot);
    requestAnimationFrame(function () { tour.classList.add('in'); step(0); });
    va('tour-shown', { loc: loc, steps: steps.length });
  }

  function renderSound(sb) { sb.textContent = muted ? T.sound : T.mute; sb.setAttribute('aria-pressed', String(!muted)); sb.classList.toggle('is-muted', muted); }
  function probeAudio(cb) {
    try {
      var a = new window.Audio(); var done = false;
      a.oncanplaythrough = function () { if (!done) { done = true; cb(true); } };
      a.onloadedmetadata = function () { if (!done) { done = true; cb(true); } };
      a.onerror = function () { if (!done) { done = true; cb(false); } };
      a.src = AUDIO_BASE + 's1.mp3'; a.load();
      setTimeout(function () { if (!done) { done = true; cb(false); } }, 2500);
    } catch (e) { cb(false); }
  }

  function tourKey(e) {
    if (e.key === 'Escape') endTour();
    else if (e.key === 'ArrowRight') step(si + 1);
    else if (e.key === 'ArrowLeft') step(si - 1);
  }

  function positionSpot() {
    if (!tour || !steps[si]) return;
    var el = d.querySelector(steps[si].sel); if (!el) return;
    var r = el.getBoundingClientRect(); var pad = 10;
    var spot = tour.querySelector('.jt-tour-spot');
    var top = Math.max(6, r.top - pad), left = Math.max(6, r.left - pad);
    var w = Math.min(window.innerWidth - 12, r.width + pad * 2);
    var h = r.height + pad * 2;
    spot.style.top = top + 'px'; spot.style.left = left + 'px'; spot.style.width = w + 'px'; spot.style.height = h + 'px';
  }

  function typeText(node, text) {
    if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }
    if (reduce) { node.textContent = text; return; }
    node.textContent = ''; var i = 0;
    typeTimer = setInterval(function () {
      i += 2; node.textContent = text.slice(0, i);
      if (i >= text.length) { clearInterval(typeTimer); typeTimer = null; }
    }, 16);
  }

  function step(n) {
    if (!tour) return;
    if (n < 0) n = 0;
    if (n >= steps.length) { endTour(true); return; }
    si = n;
    var s = steps[si], el = d.querySelector(s.sel);
    var back = tour.querySelector('.jt-tour-back'), next = tour.querySelector('.jt-tour-next');
    back.hidden = si === 0;
    next.innerHTML = (si === steps.length - 1) ? (T.book + ' &rarr;') : (T.next + ' &rarr;');
    next.classList.toggle('is-final', si === steps.length - 1);
    Array.prototype.forEach.call(tour.querySelectorAll('.jt-tour-dots i'), function (dot, i) { dot.classList.toggle('on', i === si); });
    var orb = tour.querySelector('.jt-tour-orb'); orb.classList.add('speaking');
    if (el) {
      try { el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); } catch (e) { el.scrollIntoView(); }
    }
    setTimeout(function () {
      positionSpot();
      typeText(tour.querySelector('.jt-tour-text'), (T.steps[si] || ''));
      playClip(s.key);
      setTimeout(function () { orb.classList.remove('speaking'); }, 1200);
    }, reduce ? 0 : 460);
    va('tour-step', { i: si });
  }

  function endTour(finished) {
    if (!tour) return;
    if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }
    stopAudio();
    d.removeEventListener('keydown', tourKey);
    window.removeEventListener('scroll', positionSpot);
    window.removeEventListener('resize', positionSpot);
    va(finished ? 'tour-finished' : 'tour-skipped', { at: si });
    var t = tour; tour = null;
    t.classList.remove('in'); t.classList.add('out');
    setTimeout(function () { t.remove(); }, 320);
    if (finished) go(base + '/book.html');
  }

  function openVideo() {
    var m = d.createElement('div'); m.id = 'jt-w-video';
    m.innerHTML = '<div class="jt-w-vbd"></div><div class="jt-w-vwrap"><button class="jt-w-x" aria-label="' + T.close + '">&times;</button>' +
      '<video src="/assets/video/agency-reel.mp4" controls playsinline preload="metadata" poster="/assets/video/agency-reel-poster.jpg"></video></div>';
    d.body.appendChild(m);
    var v = m.querySelector('video');
    function shut() { m.remove(); d.removeEventListener('keydown', vkey); }
    function vkey(e) { if (e.key === 'Escape') shut(); }
    m.querySelector('.jt-w-vbd').addEventListener('click', shut);
    m.querySelector('.jt-w-x').addEventListener('click', shut);
    d.addEventListener('keydown', vkey);
    requestAnimationFrame(function () { m.classList.add('in'); });
    if (v && v.play) v.play().catch(function () {});
  }

  // Tour-only CSS injected once (the card's .jt-w-* styles live in site.css).
  function injectCss() {
    if (d.getElementById('jt-tour-css')) return;
    var css = [
      '#jt-welcome .jt-w-mk{width:22px;height:22px;border-radius:6px;background:radial-gradient(circle at 35% 30%,#22d3ee,#065f46);box-shadow:0 0 12px rgba(34,211,238,.5)}',
      '.jt-w-tour{display:flex;align-items:center;gap:9px;width:100%;margin:4px 0 12px;padding:12px 16px;border-radius:11px;border:1px solid rgba(34,211,238,.35);background:linear-gradient(180deg,rgba(34,211,238,.14),rgba(16,185,129,.10));color:#F4F2EF;font:600 13.5px/1 "Plus Jakarta Sans",system-ui,sans-serif;cursor:pointer;transition:border-color .2s,transform .2s,box-shadow .2s}',
      '.jt-w-tour:hover{border-color:#22d3ee;transform:translateY(-1px);box-shadow:0 10px 30px -12px rgba(34,211,238,.5)}',
      '.jt-w-tour-ic{color:#22d3ee}',
      '#jt-tour{position:fixed;inset:0;z-index:2147483000;pointer-events:none;opacity:0;transition:opacity .3s ease}',
      '#jt-tour.in{opacity:1}#jt-tour.out{opacity:0}',
      '.jt-tour-spot{position:fixed;border-radius:16px;box-shadow:0 0 0 9999px rgba(6,6,9,.74),0 0 0 1px rgba(34,211,238,.7),0 0 40px rgba(34,211,238,.35) inset;transition:top .5s cubic-bezier(.16,1,.3,1),left .5s cubic-bezier(.16,1,.3,1),width .5s cubic-bezier(.16,1,.3,1),height .5s cubic-bezier(.16,1,.3,1);pointer-events:none}',
      '.jt-tour-panel{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(8px);width:min(560px,calc(100vw - 32px));background:rgba(12,12,15,.96);backdrop-filter:blur(16px);border:1px solid #2A2826;border-radius:16px;padding:18px 20px;box-shadow:0 30px 80px rgba(0,0,0,.6);pointer-events:auto;opacity:0;transition:opacity .3s ease,transform .3s ease}',
      '#jt-tour.in .jt-tour-panel{opacity:1;transform:translateX(-50%) translateY(0)}',
      '.jt-tour-row{display:flex;align-items:center;gap:10px;margin-bottom:12px}',
      '.jt-tour-orb{width:26px;height:26px;border-radius:50%;flex:0 0 auto;background:radial-gradient(circle at 35% 30%,#22d3ee,#065f46);box-shadow:0 0 14px rgba(34,211,238,.55)}',
      '.jt-tour-orb.speaking{animation:jt-orb 1s ease-in-out infinite}',
      '@keyframes jt-orb{0%,100%{transform:scale(1);box-shadow:0 0 14px rgba(34,211,238,.55)}50%{transform:scale(1.12);box-shadow:0 0 22px rgba(34,211,238,.85)}}',
      '.jt-tour-name{font:700 12px/1 "JetBrains Mono",monospace;letter-spacing:.08em;color:#F4F2EF}',
      '.jt-tour-dots{display:flex;gap:5px;margin-left:6px}.jt-tour-dots i{width:6px;height:6px;border-radius:50%;background:#3D3A37;transition:background .3s,width .3s}.jt-tour-dots i.on{background:#22d3ee;width:16px;border-radius:3px}',
      '.jt-tour-sound{margin-left:auto;font:600 11px/1 "JetBrains Mono",monospace;color:#8E8882;background:transparent;border:1px solid #2A2826;border-radius:7px;padding:6px 9px;cursor:pointer}',
      '.jt-tour-sound.is-muted{color:#F59E0B;border-color:rgba(245,158,11,.4)}',
      '.jt-tour-skip{font:600 11px/1 "JetBrains Mono",monospace;color:#8E8882;background:transparent;border:1px solid #2A2826;border-radius:7px;padding:6px 10px;cursor:pointer;transition:color .2s,border-color .2s}',
      '.jt-tour-sound:not([hidden])~.jt-tour-skip{margin-left:8px}.jt-tour-row .jt-tour-skip{margin-left:auto}.jt-tour-row .jt-tour-sound:not([hidden])+.jt-tour-skip{margin-left:8px}',
      '.jt-tour-skip:hover{color:#F4F2EF;border-color:#3D3A37}',
      '.jt-tour-text{margin:0;font-family:"Instrument Serif",Georgia,serif;font-size:clamp(1.15rem,2.4vw,1.5rem);line-height:1.35;color:#F4F2EF;min-height:2.6em}',
      '.jt-tour-nav{display:flex;gap:10px;justify-content:flex-end;margin-top:16px}',
      '.jt-tour-back,.jt-tour-next{font:600 13px/1 "Plus Jakarta Sans",system-ui,sans-serif;border-radius:9px;padding:11px 18px;cursor:pointer;border:1px solid #2A2826;background:transparent;color:#C9C5C0;transition:all .18s}',
      '.jt-tour-back:hover{border-color:#3D3A37;color:#F4F2EF}',
      '.jt-tour-next{background:#10b981;border-color:#10b981;color:#04120d}.jt-tour-next:hover{box-shadow:0 8px 24px -8px rgba(16,185,129,.6)}',
      '.jt-tour-next.is-final{background:#22d3ee;border-color:#22d3ee}',
      '@media (max-width:520px){.jt-tour-panel{left:12px;right:12px;bottom:12px;transform:translateY(8px);width:auto}#jt-tour.in .jt-tour-panel{transform:translateY(0)}}',
      '@media (prefers-reduced-motion:reduce){.jt-tour-spot{transition:none}.jt-tour-orb.speaking{animation:none}}'
    ].join('');
    var st = d.createElement('style'); st.id = 'jt-tour-css'; st.textContent = css; d.head.appendChild(st);
  }

  var delay = reduce ? 600 : 1600;
  if (d.readyState === 'complete') setTimeout(build, delay);
  else window.addEventListener('load', function () { setTimeout(build, delay); });
})();
