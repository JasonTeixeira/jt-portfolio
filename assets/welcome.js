/* welcome.js — "Atlas concierge": a proactive, NON-blocking first-visit greeter on the home page.
   Slides in after the splash settles, asks one question, routes to the right action, and hands off
   to the existing systems (funnel mode, Atlas, real pages). Once-only, skippable, a11y + i18n aware.
   Home pages only (index.html, es/index.html, pt/index.html) — the only place this script is loaded. */
(function () {
  'use strict';
  var d = document, path = location.pathname;
  // locale + base path for routing
  var loc = /^\/pt(\/|$)/.test(path) ? 'pt' : /^\/es(\/|$)/.test(path) ? 'es' : 'en';
  var base = loc === 'en' ? '' : '/' + loc;
  var force = /[?&]welcome=1/.test(location.search);
  var SEEN = 'jt-welcome-v1';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  try { if (!force && localStorage.getItem(SEEN)) return; } catch (e) {}

  var T = {
    en: { hi: "Hey — I'm Atlas, Jason's associate.", q: "What brings you here? I'll point you straight to it.",
      ship: "Ship an AI feature I can trust", qa: "Fix flaky or untested QA", hire: "I'm hiring for a role", browse: "Just exploring",
      watch: "Watch the 60-sec pitch", dismiss: "I'm here bottom-right whenever you need me.", hired: "Switched to the hiring view — résumé's up top.", online: "online", close: "Close" },
    es: { hi: "Hola — soy Atlas, el asociado de Jason.", q: "¿Qué te trae por aquí? Te llevo directo.",
      ship: "Lanzar una función de IA confiable", qa: "Arreglar QA inestable o sin pruebas", hire: "Estoy contratando", browse: "Solo explorando",
      watch: "Ver el pitch de 60 s", dismiss: "Estoy abajo a la derecha cuando me necesites.", hired: "Cambié a la vista de contratación — el CV está arriba.", online: "en línea", close: "Cerrar" },
    pt: { hi: "Olá — sou o Atlas, o associado do Jason.", q: "O que te traz aqui? Te levo direto ao ponto.",
      ship: "Lançar um recurso de IA confiável", qa: "Corrigir QA instável ou sem testes", hire: "Estou contratando", browse: "Só explorando",
      watch: "Ver o pitch de 60 s", dismiss: "Estou no canto inferior direito quando precisar.", hired: "Mudei para a visão de contratação — o CV está no topo.", online: "online", close: "Fechar" }
  }[loc];

  function va(name, data) { if (typeof window.va === 'function') try { window.va('event', { name: name, data: data || {} }); } catch (e) {} }
  function seen() { try { localStorage.setItem(SEEN, '1'); } catch (e) {} }

  // cinematic navigate (reuse the page-transition cover if present)
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
    if (closed) return; closed = true; seen();
    if (card) { card.classList.remove('in'); card.classList.add('out'); setTimeout(function () { card.remove(); }, 380); }
    if (!interacted) va('welcome-dismiss');
    d.removeEventListener('keydown', onKey);
  }
  function onKey(e) { if (e.key === 'Escape') close(false); }

  function build() {
    card = d.createElement('div'); card.id = 'jt-welcome'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', 'Atlas'); card.setAttribute('lang', loc);
    card.innerHTML =
      '<button class="jt-w-x" aria-label="' + T.close + '">&times;</button>' +
      '<div class="jt-w-head"><span class="jt-w-mk">&#9670;</span><span class="jt-w-name">Atlas</span><span class="jt-w-on"><i></i>' + T.online + '</span></div>' +
      '<p class="jt-w-hi">' + T.hi + '</p>' +
      '<p class="jt-w-q">' + T.q + '</p>' +
      '<div class="jt-w-chips">' + CHIPS.map(function (c, i) { return '<button class="jt-w-chip" data-k="' + c.k + '" style="--i:' + i + '">' + c.label + '</button>'; }).join('') + '</div>' +
      '<button class="jt-w-watch"><span aria-hidden="true">&#9654;</span> ' + T.watch + '</button>';
    d.body.appendChild(card);
    card.querySelector('.jt-w-x').addEventListener('click', function () { close(false); });
    card.querySelectorAll('.jt-w-chip').forEach(function (b) { b.addEventListener('click', function () { var c = CHIPS.filter(function (x) { return x.k === b.dataset.k; })[0]; if (c) c.act(); }); });
    card.querySelector('.jt-w-watch').addEventListener('click', function () { va('welcome-watch'); openVideo(); });
    d.addEventListener('keydown', onKey);
    requestAnimationFrame(function () { card.classList.add('in'); });
    va('welcome-shown', { loc: loc });
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

  // fire after the splash has revealed and the page has settled
  var delay = reduce ? 600 : 1600;
  if (d.readyState === 'complete') setTimeout(build, delay);
  else window.addEventListener('load', function () { setTimeout(build, delay); });
})();
