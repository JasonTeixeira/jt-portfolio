// Hand-rolled SVG charts for the cockpit — dependency-free, crisp, quant-first (real
// baseline, gridline, endpoint emphasis, hover readout; no gratuitous motion). Reused
// across Overview + Money. All values are numbers; labels/formatting come from the caller.

const NS = 'http://www.w3.org/2000/svg';
let _gradSeq = 0; // guarantees a document-unique gradient id per chart (no value-hash collisions)
function s(tag, attrs, ...kids) {
  const n = document.createElementNS(NS, tag);
  for (const k in (attrs || {})) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  for (const c of kids) if (c != null) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  return n;
}

// A week-over-week (or any) delta pill: "↑ 12%" green up / "↓ 8%" red down / "—" flat.
// fmt(v) formats the absolute change for the title. Returns a <span>.
export function deltaBadge(now, prev, { fmt } = {}) {
  const span = document.createElement('span');
  span.className = 'mono';
  span.style.cssText = 'font-size:11px;font-weight:600;padding:2px 7px;border-radius:999px;white-space:nowrap';
  const d = (now || 0) - (prev || 0);
  // Flat is flat — a zero change (incl. equal non-zero weeks) must never read as growth.
  if (d === 0) { span.textContent = '—'; span.style.color = 'var(--faint,#8E8882)'; return span; }
  const pct = prev ? Math.round((d / prev) * 100) : 100; // prev=0 & now>0 → brand-new, 100%
  const up = d > 0;
  span.textContent = `${up ? '↑' : '↓'} ${Math.abs(pct)}%`;
  span.style.color = up ? '#10b981' : '#f43f5e';
  span.style.background = up ? 'rgba(16,185,129,.10)' : 'rgba(244,63,94,.10)';
  if (fmt) span.title = `${up ? '+' : '−'}${fmt(Math.abs(d))} vs prior period`;
  return span;
}

// Vertical bar chart for categorical series (AR-aging buckets, per-month totals).
// data: [{label, value, color?}]. opts: { height, color, format }. Value on each bar,
// category label below, max gridline, hover emphasis. Returns a responsive <div>.
export function barChart(data, opts = {}) {
  const { height = 172, color = '#22d3ee', format = (v) => String(v) } = opts;
  const pts = (data || []).map((d) => ({ label: d.label, value: Number(d.value) || 0, color: d.color || color }));
  const wrap = document.createElement('div');
  wrap.style.cssText = 'width:100%;position:relative';
  if (!pts.length) return wrap;
  const W = 760; const H = height; const padX = 12; const padTop = 22; const padBot = 34;
  const innerW = W - padX * 2; const innerH = H - padTop - padBot;
  const max = Math.max(...pts.map((p) => p.value), 1);
  const band = innerW / pts.length; const barW = Math.min(band * 0.62, 96);
  const y = (v) => padTop + innerH - (innerH * v) / max;

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: String(H), preserveAspectRatio: 'none', style: 'display:block;overflow:visible' });
  svg.appendChild(s('line', { x1: padX, y1: y(0), x2: W - padX, y2: y(0), stroke: '#26262c', 'stroke-width': '1' }));
  svg.appendChild(s('line', { x1: padX, y1: y(max), x2: W - padX, y2: y(max), stroke: '#1c1c22', 'stroke-width': '1', 'stroke-dasharray': '3 4' }));
  pts.forEach((p, i) => {
    const bx = padX + band * i + (band - barW) / 2;
    const by = y(p.value); const bh = Math.max(0, y(0) - by);
    const rect = s('rect', { x: bx, y: by, width: barW, height: bh, rx: '3', fill: p.color, opacity: p.value ? '0.92' : '0.25' });
    rect.addEventListener('mouseenter', () => rect.setAttribute('opacity', '1'));
    rect.addEventListener('mouseleave', () => rect.setAttribute('opacity', p.value ? '0.92' : '0.25'));
    svg.appendChild(rect);
    if (p.value) svg.appendChild(s('text', { x: bx + barW / 2, y: by - 6, 'text-anchor': 'middle', fill: 'var(--faint,#8E8882)', 'font-size': '11', 'font-family': 'var(--mono,monospace)' }, format(p.value)));
    svg.appendChild(s('text', { x: bx + barW / 2, y: H - 14, 'text-anchor': 'middle', fill: 'var(--faint,#8E8882)', 'font-size': '11', 'font-family': 'var(--mono,monospace)' }, p.label));
  });
  wrap.appendChild(svg);
  return wrap;
}

// Horizontal funnel / distribution bars (DOM, not SVG — crisper for labelled rows).
// data: [{label, value, color?}]. opts: { format, showConversion } — conversion is % of the
// FIRST row (funnel drop-off). Returns a <div>.
export function funnelBars(data, opts = {}) {
  const { format = (v) => String(v), showConversion = true, color = '#22d3ee' } = opts;
  const wrap = document.createElement('div');
  const pts = (data || []).map((d) => ({ label: d.label, value: Number(d.value) || 0, color: d.color || color }));
  const max = Math.max(...pts.map((p) => p.value), 1);
  const first = pts.length ? pts[0].value : 0;
  for (const p of pts) {
    const pct = Math.round((p.value / max) * 100);
    const conv = first ? Math.round((p.value / first) * 100) : 0;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:12px;margin:8px 0';
    const label = document.createElement('span');
    label.style.cssText = 'flex:none;width:96px;font-size:12.5px;color:var(--dim,#A8A29E);text-transform:capitalize';
    label.textContent = p.label;
    const track = document.createElement('div');
    track.style.cssText = 'flex:1;height:22px;background:#0F0F13;border-radius:6px;overflow:hidden;position:relative';
    const fill = document.createElement('div');
    fill.style.cssText = `height:100%;width:${pct}%;background:${p.color};opacity:.9;border-radius:6px;min-width:2px;transition:width .3s var(--ease-out,ease)`;
    track.appendChild(fill);
    const val = document.createElement('span');
    val.className = 'mono';
    val.style.cssText = 'flex:none;width:40px;text-align:right;font-size:12.5px;font-weight:600';
    val.textContent = format(p.value);
    row.appendChild(label); row.appendChild(track); row.appendChild(val);
    if (showConversion) {
      const c = document.createElement('span');
      c.className = 'mono';
      c.style.cssText = 'flex:none;width:44px;text-align:right;font-size:11px;color:var(--faint,#8E8882)';
      c.textContent = `${conv}%`;
      c.title = `${conv}% of ${pts[0] ? pts[0].label : 'top'}`;
      row.appendChild(c);
    }
    wrap.appendChild(row);
  }
  return wrap;
}

// Area chart. data: [{label, value}]. opts: { height, color, format(value)->string }.
// Returns a responsive <div> wrapping the SVG (scales to container width).
export function areaChart(data, opts = {}) {
  const { height = 160, color = '#10b981', format = (v) => String(v) } = opts;
  const W = 760; const H = height; const padX = 12; const padTop = 20; const padBot = 24;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'width:100%;position:relative';
  const pts = (data || []).map((d) => ({ label: d.label, value: Number(d.value) || 0 }));
  if (pts.length < 2) { wrap.appendChild(document.createTextNode('')); return wrap; }

  const max = Math.max(...pts.map((p) => p.value), 1);
  const innerW = W - padX * 2; const innerH = H - padTop - padBot;
  const x = (i) => padX + (innerW * i) / (pts.length - 1);
  const y = (v) => padTop + innerH - (innerH * v) / max;

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: String(H), preserveAspectRatio: 'none',
    style: 'display:block;overflow:visible' });
  const gid = `ag${++_gradSeq}`;
  const grad = s('linearGradient', { id: gid, x1: '0', y1: '0', x2: '0', y2: '1' },
    s('stop', { offset: '0', 'stop-color': color, 'stop-opacity': '0.28' }),
    s('stop', { offset: '1', 'stop-color': color, 'stop-opacity': '0' }));
  svg.appendChild(s('defs', {}, grad));

  // baseline + max gridline
  svg.appendChild(s('line', { x1: padX, y1: y(0), x2: W - padX, y2: y(0), stroke: '#26262c', 'stroke-width': '1' }));
  svg.appendChild(s('line', { x1: padX, y1: y(max), x2: W - padX, y2: y(max), stroke: '#1c1c22', 'stroke-width': '1', 'stroke-dasharray': '3 4' }));

  const linePts = pts.map((p, i) => `${x(i)},${y(p.value)}`).join(' ');
  svg.appendChild(s('polygon', { points: `${padX},${y(0)} ${linePts} ${W - padX},${y(0)}`, fill: `url(#${gid})` }));
  svg.appendChild(s('polyline', { points: linePts, fill: 'none', stroke: color, 'stroke-width': '2', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));

  // endpoint emphasis
  const last = pts[pts.length - 1];
  svg.appendChild(s('circle', { cx: x(pts.length - 1), cy: y(last.value), r: '3.5', fill: color }));

  // hover guide + dot (updated by the overlay below)
  const guide = s('line', { x1: 0, y1: padTop, x2: 0, y2: padTop + innerH, stroke: '#3a3a42', 'stroke-width': '1', opacity: '0' });
  const dot = s('circle', { r: '3.5', fill: color, stroke: '#0C0C0E', 'stroke-width': '1.5', opacity: '0' });
  svg.appendChild(guide); svg.appendChild(dot);
  wrap.appendChild(svg);

  // labels: max value (top-left), first + last week (bottom)
  const yLabel = document.createElement('div');
  yLabel.className = 'mono';
  yLabel.style.cssText = 'position:absolute;top:0;left:2px;font-size:10px;color:var(--faint,#8E8882)';
  yLabel.textContent = format(max);
  wrap.appendChild(yLabel);
  const xLabels = document.createElement('div');
  xLabels.style.cssText = 'display:flex;justify-content:space-between;margin-top:2px';
  xLabels.appendChild(Object.assign(document.createElement('span'), { className: 'mono', textContent: pts[0].label, style: 'font-size:10px;color:var(--faint,#8E8882)' }));
  xLabels.appendChild(Object.assign(document.createElement('span'), { className: 'mono', textContent: last.label, style: 'font-size:10px;color:var(--faint,#8E8882)' }));
  wrap.appendChild(xLabels);

  // hover readout
  const tip = document.createElement('div');
  tip.className = 'mono';
  tip.style.cssText = 'position:absolute;pointer-events:none;opacity:0;transform:translate(-50%,-130%);background:#141418;border:1px solid #26262c;border-radius:7px;padding:4px 8px;font-size:11px;color:var(--ink,#F4F2EF);white-space:nowrap;transition:opacity .08s';
  wrap.appendChild(tip);
  svg.addEventListener('mousemove', (e) => {
    const rect = svg.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;               // 0..1 across the drawn area
    let i = Math.round(((rel * W) - padX) / (innerW / (pts.length - 1)));
    i = Math.max(0, Math.min(pts.length - 1, i));
    const p = pts[i];
    guide.setAttribute('x1', x(i)); guide.setAttribute('x2', x(i)); guide.setAttribute('opacity', '0.7');
    dot.setAttribute('cx', x(i)); dot.setAttribute('cy', y(p.value)); dot.setAttribute('opacity', '1');
    tip.style.opacity = '1';
    tip.style.left = `${(x(i) / W) * 100}%`;
    tip.style.top = `${(y(p.value) / H) * 100}%`;
    tip.textContent = `${p.label} · ${format(p.value)}`;
  });
  svg.addEventListener('mouseleave', () => { guide.setAttribute('opacity', '0'); dot.setAttribute('opacity', '0'); tip.style.opacity = '0'; });

  return wrap;
}
