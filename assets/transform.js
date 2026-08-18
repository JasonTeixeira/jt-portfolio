/* transform.js — "before → after" scrollytelling for the homepage.
   A sticky diagram morphs across three states as the visitor scrolls the steps.
   Reuses the hero pipeline's node/label vocabulary. Index-only (no-ops elsewhere). */
(function () {
  var stage = document.getElementById('tf-stage');
  var stepsMount = document.getElementById('tf-steps');
  if (!stage || !stepsMount) return;

  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NS = 'http://www.w3.org/2000/svg';
  var MONO = "'JetBrains Mono',monospace";
  var RED = '#f43f5e', AMBER = '#F59E0B', CYAN = '#22d3ee', PURPLE = '#a78bfa', GREEN = '#10b981', DIM = '#8E8882', LINE = '#2A2826';

  /* ---- content: three scroll steps + the diagram state each drives ---- */
  var STEPS = [
    {
      kicker: '01 · today', color: AMBER,
      head: 'Your operation today.',
      body: 'Requests come in and a person handles them by hand. If there is an AI feature, it shipped on a demo. Nothing proves it works, so when it breaks a customer finds out first.',
      tags: ['missed follow-ups', 'no eval', 'silent failures', 'unprovable']
    },
    {
      kicker: '02 · the work', color: PURPLE,
      head: 'I put a checkpoint where the risk is.',
      body: 'I automate the flow, place an evaluation gate in front of the AI, and instrument every step. The busywork disappears. The risk gets a gate it has to pass.',
      tags: ['automated intake', 'eval gate', 'instrumented', 'human-approved where it counts']
    },
    {
      kicker: '03 · proven', color: GREEN,
      head: 'The same operation — now provable.',
      body: 'Every release passes the gate or it does not ship. You get the working system and the receipts: the run, the score, the signed verdict.',
      tags: ['automated', 'eval-gated', 'monitored', '37/37 in CI']
    }
  ];

  /* node config per state: [x, baseY]; each state gives {c: color, t: label, s: sublabel} */
  var NODES = [
    { x: 90,  y: 130, st: [ {c: CYAN,  t: 'REQUESTS', s: 'calls · forms · leads'}, {c: CYAN, t: 'REQUESTS', s: 'every source, captured'}, {c: CYAN, t: 'REQUESTS', s: 'every source, captured'} ] },
    { x: 250, y: 130, st: [ {c: AMBER, t: 'MANUAL', s: 'by hand, when there’s time'}, {c: CYAN, t: 'AUTOMATED', s: 'intake → classify → route'}, {c: CYAN, t: 'AUTOMATED', s: 'runs itself'} ] },
    { x: 410, y: 130, st: [ {c: RED,   t: 'NO EVAL', s: 'ships on a demo'}, {c: PURPLE, t: 'EVAL GATE', s: 'faithfulness · injection'}, {c: GREEN, t: 'EVAL GATE', s: 'pass, or it blocks'} ] },
    { x: 570, y: 130, st: [ {c: RED,   t: 'SHIP BLIND', s: 'hope it holds'}, {c: PURPLE, t: 'GATED SHIP', s: 'checked on every PR'}, {c: GREEN, t: 'SHIP PROVEN', s: 'green means green'} ] },
    { x: 690, y: 130, st: [ {c: RED,   t: 'UNPROVABLE', s: 'find out from a customer'}, {c: DIM, t: 'MEASURED', s: 'traced · scored'}, {c: GREEN, t: 'PROVEN', s: 'run · score · signed'} ] }
  ];
  var EDGE_COLOR = [RED, PURPLE, GREEN];

  function sv(tag, attrs, children) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    (children || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }

  var W = 780, H = 260;
  var refs = { nodes: [], subs: [], labels: [], edges: [] };

  function buildStage() {
    var kids = [];
    // edges between consecutive nodes
    for (var i = 0; i < NODES.length - 1; i++) {
      var a = NODES[i], b = NODES[i + 1];
      var e = sv('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: LINE, 'stroke-width': '1.5', 'stroke-linecap': 'round', style: 'transition:stroke .55s ease, stroke-dasharray .55s ease' });
      refs.edges.push(e); kids.push(e);
    }
    // nodes + labels
    NODES.forEach(function (n) {
      var s0 = n.st[0];
      var halo = sv('circle', { cx: n.x, cy: n.y, r: 12, fill: 'none', stroke: s0.c, 'stroke-opacity': '0.3', style: 'transition:stroke .55s ease' });
      var dot = sv('circle', { cx: n.x, cy: n.y, r: 5.5, fill: s0.c, style: 'transition:fill .55s ease' });
      var lab = sv('text', { x: n.x, y: n.y - 22, fill: s0.c, 'font-family': MONO, 'font-size': 11, 'letter-spacing': '0.1em', 'text-anchor': 'middle', style: 'transition:fill .55s ease' });
      lab.textContent = s0.t;
      var sub = sv('text', { x: n.x, y: n.y + 30, fill: DIM, 'font-family': MONO, 'font-size': 8.5, 'letter-spacing': '0.04em', 'text-anchor': 'middle' });
      sub.textContent = s0.s;
      refs.nodes.push({ halo: halo, dot: dot }); refs.labels.push(lab); refs.subs.push(sub);
      kids.push(halo, dot, lab, sub);
    });
    var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'A five-stage operation diagram that transforms from manual and unprovable to automated and eval-gated.', style: 'width:100%;height:auto;display:block' }, kids);
    var wrap = document.createElement('div');
    wrap.style.cssText = 'background:#0C0C0E;border:1px solid ' + LINE + ';border-radius:14px;padding:22px 20px;position:relative;overflow:hidden';
    wrap.appendChild(svg);
    stage.appendChild(wrap);
  }

  function setState(idx) {
    NODES.forEach(function (n, i) {
      var s = n.st[idx];
      refs.nodes[i].halo.setAttribute('stroke', s.c);
      refs.nodes[i].dot.setAttribute('fill', s.c);
      refs.labels[i].setAttribute('fill', s.c);
      refs.labels[i].textContent = s.t;
      refs.subs[i].textContent = s.s;
    });
    var ec = EDGE_COLOR[idx];
    refs.edges.forEach(function (e) {
      e.setAttribute('stroke', ec);
      e.setAttribute('stroke-dasharray', idx === 0 ? '4 5' : '0');
    });
    var cap = document.getElementById('tf-caption');
    if (cap) { cap.textContent = STEPS[idx].kicker.toUpperCase(); cap.style.color = STEPS[idx].color; }
  }

  function buildSteps() {
    STEPS.forEach(function (s, i) {
      var step = document.createElement('div');
      step.className = 'tf-step';
      step.setAttribute('data-idx', i);
      var tags = s.tags.map(function (t) {
        return '<span style="display:inline-block;font-family:' + MONO + ';font-size:11px;color:' + s.color +
          ';border:1px solid ' + s.color + '44;border-radius:999px;padding:4px 11px;margin:6px 6px 0 0">' + t + '</span>';
      }).join('');
      step.innerHTML =
        '<div style="font-family:' + MONO + ';font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:' + s.color + '">' + s.kicker + '</div>' +
        '<h3 style="font-family:\'Instrument Serif\',Georgia,serif;font-weight:400;font-size:clamp(1.6rem,3vw,2.4rem);line-height:1.1;margin:12px 0 0;color:#F4F2EF">' + s.head + '</h3>' +
        '<p style="margin:14px 0 0;font-size:1rem;line-height:1.7;color:#A8A29E;max-width:42ch">' + s.body + '</p>' +
        '<div style="margin-top:16px">' + tags + '</div>';
      stepsMount.appendChild(step);
    });
  }

  buildStage();
  buildSteps();

  if (REDUCED || !('IntersectionObserver' in window)) {
    setState(2); // show the resolved, provable state; steps read as a plain list
    return;
  }

  setState(0);
  var current = 0;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) {
        var idx = parseInt(en.target.getAttribute('data-idx'), 10);
        if (idx !== current) { current = idx; setState(idx); }
      }
    });
  }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
  Array.prototype.forEach.call(stepsMount.children, function (step) { io.observe(step); });
})();
