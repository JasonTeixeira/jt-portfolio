// Living code-native node-network for the auth stage. Emerald/cyan nodes drift on
// black, link when near, and pulse packets travel along edges — the site's
// "self-proving system" motif. Compositor-light (canvas), reduced-motion aware.

const GREEN = '16,185,129';
const CYAN = '34,211,238';

export function mountAuthVisual(canvas) {
  if (!canvas) return () => {};
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
  let nodes = [], packets = [], raf = 0, running = true;

  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.max(18, Math.min(46, Math.round((W * H) / 26000)));
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22,
      r: 1.2 + Math.random() * 2.1,
      c: Math.random() < 0.5 ? GREEN : CYAN,
    }));
  }

  const LINK = 132;
  function edges() {
    const out = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
        const d = Math.hypot(dx, dy);
        if (d < LINK) out.push([i, j, d]);
      }
    }
    return out;
  }

  function draw(animate) {
    ctx.clearRect(0, 0, W, H);
    const es = edges();
    for (const [i, j, d] of es) {
      const a = (1 - d / LINK) * 0.5;
      ctx.strokeStyle = `rgba(255,255,255,${a * 0.28})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.stroke();
    }
    for (const n of nodes) {
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 4);
      g.addColorStop(0, `rgba(${n.c},0.9)`); g.addColorStop(1, `rgba(${n.c},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(${n.c},1)`; ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
    }
    // packets travel along a live edge
    if (animate) {
      if (packets.length < 3 && es.length && Math.random() < 0.04) {
        const e = es[Math.floor(Math.random() * es.length)];
        packets.push({ a: e[0], b: e[1], t: 0, c: Math.random() < 0.5 ? GREEN : CYAN });
      }
      for (const p of packets) {
        p.t += 0.018;
        const A = nodes[p.a], B = nodes[p.b];
        if (!A || !B) { p.t = 2; continue; }
        const x = A.x + (B.x - A.x) * p.t, y = A.y + (B.y - A.y) * p.t;
        ctx.fillStyle = `rgba(${p.c},1)`; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill();
      }
      packets = packets.filter((p) => p.t <= 1);
    }
  }

  function step() {
    if (!running) return;
    for (const n of nodes) {
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;
    }
    draw(true);
    raf = requestAnimationFrame(step);
  }

  resize();
  if (reduce) { draw(false); }
  else { raf = requestAnimationFrame(step); }

  let rt;
  const onResize = () => { clearTimeout(rt); rt = setTimeout(() => { resize(); if (reduce) draw(false); }, 150); };
  window.addEventListener('resize', onResize);

  return function destroy() {
    running = false; cancelAnimationFrame(raf); window.removeEventListener('resize', onResize);
  };
}

// Decorative, honest terminal caption (never claims access before it happens).
export function mountAuthTerminal(el, lines) {
  if (!el) return;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const seq = lines && lines.length ? lines : ['> initializing session', '> awaiting credentials', '> everything here is tested'];
  if (reduce) { el.textContent = seq[seq.length - 1]; return; }
  let li = 0, ci = 0, deleting = false;
  const caret = document.createElement('span'); caret.className = 'caret'; caret.textContent = ' ';
  function tick() {
    const full = seq[li];
    if (!deleting) {
      ci++;
      if (ci > full.length) { deleting = true; setTimeout(tick, 1500); return; }
    } else {
      ci--;
      if (ci <= 0) { deleting = false; li = (li + 1) % seq.length; }
    }
    el.textContent = full.slice(0, ci); el.appendChild(caret);
    setTimeout(tick, deleting ? 26 : 52);
  }
  tick();
}
