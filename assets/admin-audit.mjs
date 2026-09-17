// Audit log (cockpit) — a read-only trail of operator write actions. Newest first.
// All values via textContent; meta rendered as compact key:value pairs.

const ACTION_META = {
  proposal_approved: ['▤', 'Approved proposal', '#22d3ee'],
  contract_sent: ['✎', 'Sent agreement', '#22d3ee'],
  milestone_delivered: ['✓', 'Delivered milestone', '#10b981'],
  invoice_generated: ['$', 'Generated invoice', '#F59E0B'],
  invoice_sent: ['$', 'Sent invoice', '#10b981'],
  prospect_created: ['↓', 'Added prospect', '#a78bfa'],
  prospect_stage_changed: ['⇉', 'Moved a stage', '#8E8882'],
};
function meta(a) { return ACTION_META[a] || ['·', String(a || 'action').replace(/_/g, ' '), '#8E8882']; }

export function renderAudit(root, key, deps) {
  const { h, clear, authHeaders, renderNotAuthorized } = deps;
  clear(root);
  const wrap = h('div', {});
  wrap.appendChild(h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#10b981' }, 'cockpit · audit log'), h('span', { class: 'line' })));
  wrap.appendChild(h('h1', { class: 'sec-title' }, 'Audit log'));
  wrap.appendChild(h('p', { class: 'subtle', style: 'font-size:13px;margin-top:4px' }, 'Every write action, newest first — who did what, when.'));
  const body = h('div', { class: 'admin-card', style: 'margin-top:16px' }, h('p', { class: 'subtle', style: 'font-size:13px' }, 'Loading…'));
  wrap.appendChild(body);
  root.appendChild(wrap);

  const age = (iso) => { const t = new Date(iso).getTime(); if (Number.isNaN(t)) return ''; const d = Math.floor((Date.now() - t) / 864e5); return d <= 0 ? 'today' : d === 1 ? '1d ago' : `${d}d ago`; };

  fetch('/api/audit', { headers: authHeaders() }).then(async (res) => {
    if (res.status === 401) { renderNotAuthorized(root); return; }
    const j = await res.json().catch(() => null);
    clear(body);
    if (res.status >= 500 || !j || !j.ok) { body.appendChild(h('p', { class: 'subtle', style: 'color:#F59E0B' }, "Couldn't load the audit log — refresh to retry.")); return; }
    const entries = j.entries || [];
    if (!entries.length) { body.appendChild(h('p', { class: 'subtle', style: 'font-size:13px' }, 'No actions recorded yet — this fills in as you work.')); return; }
    for (const e of entries) {
      const [ico, label, color] = meta(e.action);
      const target = e.target_id ? ` · ${e.target_id}` : '';
      body.appendChild(h('div', { style: 'display:flex;align-items:center;gap:12px;padding:9px 0;border-top:1px solid #17171d;font-size:13px' },
        h('span', { class: 'mono', style: `flex:none;width:16px;text-align:center;color:${color}` }, ico),
        h('span', { style: 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, label + target),
        h('span', { class: 'mono', style: 'flex:none;font-size:11px;color:var(--faint);max-width:34%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, e.actor || 'operator'),
        h('span', { class: 'mono', style: 'flex:none;font-size:11px;color:var(--faint)' }, age(e.created_at))));
    }
  }).catch(() => { clear(body); body.appendChild(h('p', { class: 'subtle', style: 'color:#F59E0B' }, "Couldn't reach the server.")); });
}
