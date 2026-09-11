/* gateway.js — a FIRST-VISIT-ONLY, skippable, full-screen "concierge gateway". It introduces the
   site with a quick title reveal, then hands the visitor the intent selection (each routes into the
   Nadine-voiced concierge) plus the 60-second tour and a big Skip. Shown once (localStorage), never
   to crawlers/automation, reduced-motion aware, and the real page renders underneath the whole time
   (so SEO + LCP are unaffected). Flip ENABLED=false to turn it off site-wide.

   Reuses what already exists: window.openAtlas(intentKey) opens the concierge straight to that
   Nadine-voiced answer; window.jtTourStart() launches the voiced guided tour.

   Force it for a demo with ?gateway=1 . */
(function () {
  'use strict';
  var ENABLED = true;
  if (!ENABLED) return;
  var d = document, w = window;
  var SEEN = 'jt-gateway-v1';
  var force = /[?&]gateway=1/.test(location.search);
  var seen = false; try { seen = !!localStorage.getItem(SEEN); } catch (e) {}
  var bot = false; try { bot = !!navigator.webdriver; } catch (e) {}
  if (!force && (seen || bot)) return; // first-visit humans only
  var reduce = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var LOC = (function () { var p = location.pathname; return /^\/pt(\/|$)/.test(p) ? 'pt' : /^\/es(\/|$)/.test(p) ? 'es' : 'en'; })();
  function L(m) { return m[LOC] || m.en; }
  var base = LOC === 'en' ? '' : '/' + LOC;

  var T = {
    kicker: L({ en: 'AI Automation × QA / LLM Eval', es: 'Automatización de IA × QA', pt: 'Automação de IA × QA' }),
    title: L({ en: 'I ship AI features.\nThen I <em>prove</em> they work.', es: 'Lanzo funciones de IA.\nLuego <em>demuestro</em> que funcionan.', pt: 'Eu entrego recursos de IA.\nDepois <em>provo</em> que funcionam.' }),
    hi: L({ en: "Hi — I'm Nadine, Jason's AI. What brings you in today?", es: 'Hola — soy Nadine, la IA de Jason. ¿Qué te trae hoy?', pt: 'Oi — sou a Nadine, a IA do Jason. O que te traz aqui hoje?' }),
    tour: L({ en: 'Take the 60-second tour', es: 'Ver el recorrido de 60 s', pt: 'Ver o tour de 60 s' }),
    skip: L({ en: 'Skip to the site', es: 'Ir directo al sitio', pt: 'Ir direto ao site' }),
    on: L({ en: 'online', es: 'en línea', pt: 'online' })
  };
  // intent cards → guided keys in the concierge (agent.js GUIDED)
  var INTENTS = [
    { k: 'build', c: '#22d3ee', label: L({ en: 'What does Jason do?', es: '¿Qué hace Jason?', pt: 'O que o Jason faz?' }) },
    { k: 'eval', c: '#10b981', label: L({ en: 'Check my AI feature — free', es: 'Revisa mi IA — gratis', pt: 'Avaliar minha IA — grátis' }) },
    { k: 'howItWorks', c: '#a78bfa', label: L({ en: 'How it works & pricing', es: 'Cómo funciona y precios', pt: 'Como funciona e preços' }) },
    { k: 'book', c: '#F59E0B', label: L({ en: "I'm ready to talk", es: 'Quiero hablar', pt: 'Quero conversar' }) }
  ];

  function injectCss() {
    if (d.getElementById('jt-gw-css')) return;
    var css = [
      '#jt-gateway{position:fixed;inset:0;z-index:2147483000;overflow-x:hidden;overflow-y:auto;background:radial-gradient(120% 80% at 50% -10%,rgba(34,211,238,.10),transparent 60%),#09090B;color:#F4F2EF;display:flex;flex-direction:column;font-family:"Plus Jakarta Sans",system-ui,sans-serif;opacity:0;transition:opacity .5s ease}',
      '#jt-gateway *{box-sizing:border-box}',
      '#jt-gateway.in{opacity:1}',
      '#jt-gateway.out{opacity:0;pointer-events:none}',
      '.jt-gw-top{display:flex;align-items:center;justify-content:space-between;padding:20px clamp(18px,4vw,44px)}',
      '.jt-gw-mk{font-family:"JetBrains Mono",monospace;font-weight:700;font-size:15px;letter-spacing:.02em}',
      '.jt-gw-mk .a{color:#22d3ee}.jt-gw-mk .b{color:#a78bfa}',
      '.jt-gw-skip{background:transparent;border:1px solid #2A2826;color:#A8A29E;border-radius:999px;padding:9px 18px;font:600 12.5px/1 "Plus Jakarta Sans",system-ui,sans-serif;cursor:pointer;transition:border-color .2s,color .2s}',
      '.jt-gw-skip:hover{border-color:#3D3A37;color:#F4F2EF}',
      '.jt-gw-body{position:relative;z-index:1;flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:0 clamp(18px,5vw,44px);max-width:960px;margin:0 auto;width:100%}',
      '.jt-gw-top{position:relative;z-index:1}',
      '.jt-gw-aura{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none}',
      '.jt-gw-aura i{position:absolute;display:block;width:62vmax;height:62vmax;border-radius:50%;filter:blur(90px);opacity:.16;will-change:transform}',
      '.jt-gw-aura .b1{background:#22d3ee;top:-22%;left:-12%;animation:jt-gw-d1 24s ease-in-out infinite}',
      '.jt-gw-aura .b2{background:#10b981;bottom:-26%;right:-12%;animation:jt-gw-d2 30s ease-in-out infinite}',
      '.jt-gw-aura .b3{background:#a78bfa;top:26%;right:18%;width:42vmax;height:42vmax;opacity:.10;animation:jt-gw-d1 34s ease-in-out infinite reverse}',
      '@keyframes jt-gw-d1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(6vw,4vh) scale(1.12)}}',
      '@keyframes jt-gw-d2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-5vw,-4vh) scale(1.1)}}',
      '@keyframes jt-gw-breathe{0%,100%{transform:scale(1);box-shadow:0 0 12px rgba(34,211,238,.5)}50%{transform:scale(1.22);box-shadow:0 0 24px rgba(34,211,238,.9)}}',
      '.jt-gw-kick{font-family:"JetBrains Mono",monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#22d3ee;opacity:0;transform:translateY(8px)}',
      '.jt-gw-h1{font-family:"Instrument Serif",Georgia,serif;font-weight:400;font-size:clamp(2rem,5vw,4.2rem);line-height:1.05;letter-spacing:-.02em;margin:18px 0 0;text-wrap:balance;max-width:100%;overflow-wrap:break-word;padding:0 4px}',
      '.jt-gw-h1 em{font-style:italic;color:#10b981}',
      '.jt-gw-h1 .ln{display:block;opacity:0;transform:translateY(14px)}',
      '.jt-gw-hi{display:inline-flex;align-items:center;gap:10px;margin-top:26px;font-size:15px;color:#C9C5C0;opacity:0;transform:translateY(8px)}',
      '.jt-gw-orb{width:16px;height:16px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#22d3ee,#065f46);box-shadow:0 0 12px rgba(34,211,238,.55);flex:0 0 auto;animation:jt-gw-breathe 3.4s ease-in-out infinite}',
      '.jt-gw-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:34px;width:100%;max-width:620px;opacity:0;transform:translateY(10px)}',
      '.jt-gw-int{display:flex;align-items:center;gap:12px;text-align:left;background:rgba(255,255,255,.02);border:1px solid #2A2826;border-radius:14px;padding:16px 18px;color:#F4F2EF;font:600 14.5px/1.25 "Plus Jakarta Sans",system-ui,sans-serif;cursor:pointer;transition:border-color .18s,transform .18s,background .18s}',
      '.jt-gw-int:hover{transform:translateY(-2px);background:rgba(255,255,255,.04)}',
      '.jt-gw-dot{width:9px;height:9px;border-radius:50%;flex:0 0 auto}',
      '.jt-gw-int .arw{margin-left:auto;color:#8E8882;font-size:16px}',
      '.jt-gw-foot{display:flex;gap:14px;align-items:center;justify-content:center;flex-wrap:wrap;margin-top:26px;opacity:0;transform:translateY(8px)}',
      '.jt-gw-tour{display:inline-flex;align-items:center;gap:9px;background:#10b981;color:#04120d;border:none;border-radius:12px;padding:13px 24px;font:700 14px/1 "Plus Jakarta Sans",system-ui,sans-serif;cursor:pointer}',
      '.jt-gw-tour:hover{box-shadow:0 10px 30px -8px rgba(16,185,129,.6)}',
      '.jt-gw-skip2{background:transparent;border:none;color:#8E8882;font:600 13.5px/1 "Plus Jakarta Sans",system-ui,sans-serif;cursor:pointer;text-decoration:underline;text-underline-offset:3px}',
      '.jt-gw-skip2:hover{color:#F4F2EF}',
      '@keyframes jt-gw-up{to{opacity:1;transform:none}}',
      '.jt-gw-anim{animation:jt-gw-up .6s cubic-bezier(.16,1,.3,1) forwards}',
      '@media (max-width:560px){.jt-gw-grid{grid-template-columns:1fr;max-width:100%}.jt-gw-h1{font-size:clamp(2.2rem,9vw,3.4rem)}.jt-gw-body{padding:0 16px}.jt-gw-top{padding:16px}.jt-gw-hi{font-size:14px}.jt-gw-foot{width:100%}}',
      '@media (prefers-reduced-motion:reduce){#jt-gateway,.jt-gw-anim,.jt-gw-kick,.jt-gw-h1 .ln,.jt-gw-hi,.jt-gw-grid,.jt-gw-foot{transition:none!important;animation:none!important;opacity:1!important;transform:none!important}.jt-gw-aura i,.jt-gw-orb{animation:none!important}}'
    ].join('');
    var st = d.createElement('style'); st.id = 'jt-gw-css'; st.textContent = css; d.head.appendChild(st);
  }

  var gw;
  function markSeen() { try { localStorage.setItem(SEEN, '1'); } catch (e) {} }
  function dismiss(then) {
    if (!gw) return; markSeen();
    gw.classList.remove('in'); gw.classList.add('out');
    d.removeEventListener('keydown', onKey);
    setTimeout(function () { if (gw && gw.parentNode) gw.remove(); gw = null; if (then) then(); }, reduce ? 0 : 520);
  }
  function onKey(e) { if (e.key === 'Escape') dismiss(); }

  function build() {
    injectCss();
    var titleLines = T.title.split('\n').map(function (t) { return '<span class="ln">' + t + '</span>'; }).join('');
    var intents = INTENTS.map(function (it) {
      return '<button class="jt-gw-int" data-intent="' + it.k + '"><span class="jt-gw-dot" style="background:' + it.c + '"></span>' + it.label + '<span class="arw">&rarr;</span></button>';
    }).join('');
    var langs = ['en', 'es', 'pt'].map(function (l) {
      var href = l === 'en' ? '/?gateway=1' : '/' + l + '/?gateway=1';
      return l === LOC ? '<b style="color:#F4F2EF">' + l.toUpperCase() + '</b>' : '<a href="' + href + '" style="color:#8E8882;text-decoration:none">' + l.toUpperCase() + '</a>';
    }).join('<span style="color:#3D3A37">·</span>');

    gw = d.createElement('div'); gw.id = 'jt-gateway'; gw.setAttribute('role', 'dialog'); gw.setAttribute('aria-label', 'Welcome'); gw.setAttribute('lang', LOC);
    gw.innerHTML =
      '<div class="jt-gw-aura" aria-hidden="true"><i class="b1"></i><i class="b2"></i><i class="b3"></i></div>' +
      '<div class="jt-gw-top">' +
      '<span class="jt-gw-mk"><span class="a">jason</span>.<span class="b">teixeira</span>()</span>' +
      '<button class="jt-gw-skip" type="button" data-skip>' + T.skip + ' &rarr;</button>' +
      '</div>' +
      '<div class="jt-gw-body">' +
      '<div class="jt-gw-kick">' + T.kicker + '</div>' +
      '<h1 class="jt-gw-h1">' + titleLines + '</h1>' +
      '<div class="jt-gw-hi"><span class="jt-gw-orb"></span>' + T.hi + '</div>' +
      '<div class="jt-gw-grid">' + intents + '</div>' +
      '<div class="jt-gw-foot">' +
      '<button class="jt-gw-tour" type="button" data-tour><span aria-hidden="true">&#9654;</span> ' + T.tour + '</button>' +
      '<button class="jt-gw-skip2" type="button" data-skip>' + T.skip + '</button>' +
      '</div>' +
      '<nav aria-label="Language" style="margin-top:26px;font-family:\'JetBrains Mono\',monospace;font-size:11px;display:flex;gap:8px;align-items:center">' + langs + '</nav>' +
      '</div>';
    d.body.appendChild(gw);

    // wire
    gw.querySelectorAll('[data-skip]').forEach(function (b) { b.addEventListener('click', function () { track('gateway-skip'); dismiss(); }); });
    gw.querySelector('[data-tour]').addEventListener('click', function () { track('gateway-tour'); dismiss(function () { if (w.jtTourStart) w.jtTourStart(); }); });
    gw.querySelectorAll('.jt-gw-int').forEach(function (b) {
      b.addEventListener('click', function () {
        var intent = b.getAttribute('data-intent'); track('gateway-intent-' + intent);
        // Hottest lead: go STRAIGHT to the booking calendar, no extra step.
        if (intent === 'book') { markSeen(); track('gateway-book-direct'); location.href = base + '/book.html'; return; }
        dismiss(function () { if (w.openAtlas) w.openAtlas(intent); });
      });
    });
    d.addEventListener('keydown', onKey);

    // reveal
    requestAnimationFrame(function () {
      gw.classList.add('in');
      if (reduce) return;
      var seq = [gw.querySelector('.jt-gw-kick')].concat([].slice.call(gw.querySelectorAll('.jt-gw-h1 .ln')), [gw.querySelector('.jt-gw-hi'), gw.querySelector('.jt-gw-grid'), gw.querySelector('.jt-gw-foot')]);
      seq.forEach(function (el, i) { if (el) { el.style.animationDelay = (0.12 + i * 0.11) + 's'; el.classList.add('jt-gw-anim'); } });
    });
    track('gateway-shown');
  }
  function track(n) { try { if (typeof w.va === 'function') w.va('event', { name: n }); } catch (e) {} }

  if (d.readyState === 'complete' || d.readyState === 'interactive') build();
  else w.addEventListener('DOMContentLoaded', build);
})();
