// Operator marketing/outreach cockpit (module ④), backed by /api/marketing.
// Manual-assist: surfaces who needs a touch + a copy-ready opener; the operator
// sends and logs the touch (via /api/prospects). No auto cold-emailing.

const STAGE_COLOR = { new: '#22d3ee', scoped: '#a78bfa', engaged: '#10b981' };
const TOUCH_KINDS = ['email', 'dm', 'call', 'meeting', 'note', 'follow_up'];

function opener(lead) {
  const first = String(lead.name || '').trim().split(/\s+/)[0] || 'there';
  const co = lead.company ? lead.company : 'your shop';
  const who = lead.segment ? lead.segment : 'service';
  return `Hi ${first} — I set up an AI front desk for ${who} businesses: it texts back every missed call, answers 24/7, and replies to web leads in seconds — so the jobs that hit voicemail stop going to the next guy on the list. I build it and, because I'm a QA engineer, I actually test it before it talks to your customers. Worth a quick look at what it'd catch for ${co}? — Jason`;
}

export function renderMarketing(mount, key, deps) {
  const { h, clear, authHeaders, renderNotAuthorized } = deps;

  async function api(method, path, body) {
    const opts = { method, headers: authHeaders(body ? { 'Content-Type': 'application/json' } : {}) };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    if (res.status === 401) return { unauthorized: true };
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  }

  function draw() {
    clear(mount);
    const statMount = h('div', { class: 'stat-row' });
    const nurtureMount = h('div', {});
    const listMount = h('div', { style: 'margin-top:18px' });
    mount.appendChild(statMount);
    mount.appendChild(nurtureMount);
    mount.appendChild(listMount);
    const stat = (n, l, color) => h('div', { class: 'stat' }, h('div', { class: 'n', style: color ? `color:${color}` : '' }, n), h('div', { class: 'l' }, l));

    api('GET', '/api/marketing').then((r) => {
      if (r.unauthorized) { renderNotAuthorized(mount.parentNode || mount); return; }
      if (r.status === 502 || !r.json || !r.json.ok) {
        statMount.appendChild(h('p', { class: 'subtle', style: 'color:#F59E0B' }, "Couldn't load outreach — refresh to retry."));
        return;
      }
      const { leads = [], needsActionCount = 0, nurture = {}, counts = {} } = r.json;
      const openCount = (counts.new || 0) + (counts.scoped || 0) + (counts.engaged || 0);
      clear(statMount);
      statMount.appendChild(stat(String(needsActionCount), 'Need a touch', '#F59E0B'));
      statMount.appendChild(stat(String(openCount), 'Open leads', '#22d3ee'));
      statMount.appendChild(stat(String(counts.won || 0), 'Won'));
      statMount.appendChild(stat(String(nurture.recentSends7d || 0), 'Nurture sent · 7d', '#10b981'));

      clear(nurtureMount);
      const nurtOn = nurture.enabled;
      nurtureMount.appendChild(h('div', { style: `margin-top:6px;font-family:var(--mono,monospace);font-size:11.5px;color:${nurtOn ? 'var(--faint)' : '#F59E0B'}` },
        nurtOn ? 'Automated nurture drip: ON (warm leads / unpaid proposals / expiring quotes).'
          : 'Automated nurture drip: OFF — set NURTURE_ENABLED=true to auto-send warm follow-ups.'));

      clear(listMount);
      listMount.appendChild(h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#10b981' }, 'who to reach out to'), h('span', { class: 'line' })));
      if (!leads.length) { listMount.appendChild(h('p', { class: 'subtle' }, 'No open leads yet — they appear here as prospects come in and go stale.')); return; }
      // needs-action first (already sorted stalest-first by the API within that)
      const ordered = [...leads].sort((a, b) => (b.needsAction === a.needsAction ? b.daysSinceActivity - a.daysSinceActivity : (b.needsAction ? 1 : -1)));
      for (const lead of ordered) listMount.appendChild(leadRow(lead));
    });

    function leadRow(lead) {
      const color = STAGE_COLOR[lead.stage] || '#8E8882';
      const stale = lead.needsAction;
      const wrap = h('div', { class: 'admin-card', style: `margin-bottom:10px;border-left:3px solid ${stale ? '#F59E0B' : 'transparent'}` });
      const head = h('div', { style: 'display:flex;align-items:center;gap:14px;flex-wrap:wrap' },
        h('div', { style: 'flex:1;min-width:180px' },
          h('div', { style: 'font-size:14px' }, lead.name || lead.email || 'Unknown'),
          h('div', { class: 'mono', style: 'font-size:11px;color:var(--faint)' }, `${lead.company ? lead.company + ' · ' : ''}${lead.email || ''}`)),
        h('span', { style: `font-family:var(--mono,monospace);font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:${color}` }, lead.stage),
        h('span', { class: 'mono', style: `font-size:11px;color:${stale ? '#F59E0B' : 'var(--faint)'}` }, `${lead.daysSinceActivity}d · ${lead.suggestedAction}`));
      wrap.appendChild(head);

      // actions: log a touch + copy opener
      const kindSel = h('select', { style: 'background:#0d0d11;border:1px solid #23232b;border-radius:6px;padding:6px 8px;color:#e5e5ea;font-size:12px' },
        ...TOUCH_KINDS.map((k) => h('option', { value: k }, k.replace('_', ' '))));
      const logBtn = h('button', { type: 'button', class: 'btn-ghost', style: 'padding:6px 12px;font-size:12px' }, 'Log touch');
      const status = h('span', { class: 'subtle', style: 'font-size:11px' }, '');
      logBtn.addEventListener('click', async () => {
        logBtn.disabled = true; clear(status); status.appendChild(document.createTextNode('Logging…'));
        const r = await api('POST', '/api/prospects', { action: 'touch', id: lead.id, kind: kindSel.value });
        if (r.json && r.json.ok) { draw(); } else { logBtn.disabled = false; clear(status); status.appendChild(document.createTextNode('Failed — retry')); }
      });
      const copyBtn = h('button', { type: 'button', class: 'btn-ghost', style: 'padding:6px 12px;font-size:12px' }, 'Copy opener');
      copyBtn.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(opener(lead)); clear(status); status.appendChild(document.createTextNode('Opener copied ✓')); }
        catch { clear(status); status.appendChild(document.createTextNode('Copy failed')); }
      });
      wrap.appendChild(h('div', { style: 'display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap' }, kindSel, logBtn, copyBtn, status));
      return wrap;
    }
  }

  draw();
}
