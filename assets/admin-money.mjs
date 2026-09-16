// Money command center body (cockpit) — real figures from /api/revenue.
// Rendered into a mount below the admin tab bar; DOM via shared `h`/`clear`.
import { areaChart, barChart } from './admin-charts.mjs';

export function renderMoneyBody(mount, deps) {
  const { h, clear, money, apiGet, renderNotAuthorized } = deps;
  const statMount = h('div', { class: 'stat-row' });
  const detail = h('div', {});
  mount.appendChild(statMount);
  mount.appendChild(detail);
  const stat = (n, l, color) => h('div', { class: 'stat' }, h('div', { class: 'n', style: color ? `color:${color}` : '' }, n), h('div', { class: 'l' }, l));

  apiGet('/api/revenue').then((r) => {
    if (r.unauthorized) { renderNotAuthorized(mount.parentNode || mount); return; }
    if (r.status === 502 || (r.json && r.json.error === 'revenue_unavailable')) { clear(statMount); statMount.appendChild(h('p', { class: 'subtle', style: 'color:#F59E0B' }, "Couldn't load revenue right now — refresh to retry.")); return; }
    if (!r.json || !r.json.ok || !r.json.revenue) { clear(statMount); statMount.appendChild(h('p', { class: 'subtle' }, 'No revenue yet — it fills in as deposits and balances get paid.')); return; }
    const v = r.json.revenue;
    clear(statMount);
    statMount.appendChild(stat(money(v.collectedCents), 'Collected', '#10b981'));
    statMount.appendChild(stat(money(v.outstandingCents), 'Balance outstanding', '#F59E0B'));
    statMount.appendChild(stat(money(v.pipelineCents), 'Open pipeline', '#22d3ee'));
    statMount.appendChild(stat(String(v.wonCount), 'Deals won'));
    statMount.appendChild(stat(money(v.avgDealCents), 'Avg deal'));
    clear(detail);
    // ── Collected revenue, last 6 months (zero-filled) as an area chart ──
    const monthly = v.monthly || {};
    const now = new Date();
    const series = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      series.push({ label: d.toLocaleString('en', { month: 'short' }), value: monthly[d.toISOString().slice(0, 7)] || 0 });
    }
    if (series.some((p) => p.value > 0)) {
      const card = h('div', { class: 'admin-card', style: 'margin-top:16px' });
      card.appendChild(h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#10b981' }, 'collected · last 6 months'), h('span', { class: 'line' })));
      card.appendChild(areaChart(series, { height: 160, color: '#10b981', format: (c) => money(c) }));
      detail.appendChild(card);
    }

    // ── AR aging: outstanding balances bucketed by how long they've been owed ──
    const aging = r.json.aging;
    if (aging && aging.totalCents > 0) {
      const card2 = h('div', { class: 'admin-card', style: 'margin-top:16px' });
      card2.appendChild(h('div', { class: 'sec-rule' },
        h('span', { class: 'sec-label', style: 'color:#F59E0B' }, 'balance owed · aging'),
        h('span', { class: 'line' })));
      const BUCKETS = [['current', '0–30d', '#10b981'], ['d30', '31–60', '#22d3ee'], ['d60', '61–90', '#F59E0B'], ['d90', '91–120', '#f97316'], ['older', '120+', '#f43f5e']];
      card2.appendChild(barChart(
        BUCKETS.map(([k, label, color]) => ({ label, value: (aging.buckets && aging.buckets[k]) || 0, color })),
        { height: 170, format: (c) => money(c) }));
      // The individual overdue lines — oldest first — so nothing rots unseen.
      const overdue = (aging.items || []).filter((it) => it.bucket !== 'current');
      if (overdue.length) {
        const listWrap = h('div', { style: 'margin-top:12px' });
        for (const it of overdue.slice(0, 12)) {
          listWrap.appendChild(h('div', { style: 'display:flex;align-items:center;gap:12px;margin:6px 0;font-size:12.5px' },
            h('span', { style: 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, it.email || it.publicId || '—'),
            h('span', { class: 'mono', style: 'color:var(--faint);width:80px;text-align:right' }, `${it.days}d`),
            h('span', { class: 'mono', style: 'width:96px;text-align:right;color:#F59E0B' }, money(it.cents))));
        }
        card2.appendChild(listWrap);
      }
      detail.appendChild(card2);
    }
  }).catch(() => {});
}
