// Settings / system status (cockpit). Read-only view of what's configured — everything is
// env-controlled, so this is visibility, not a control panel. Green = wired, amber = off.

export function renderSettings(root, key, deps) {
  const { h, clear, authHeaders, renderNotAuthorized } = deps;
  clear(root);
  const wrap = h('div', {});
  wrap.appendChild(h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#10b981' }, 'cockpit · settings'), h('span', { class: 'line' })));
  wrap.appendChild(h('h1', { class: 'sec-title' }, 'Settings'));
  wrap.appendChild(h('p', { class: 'subtle', style: 'font-size:13px;margin-top:4px;max-width:640px' }, 'What’s wired on this environment. Everything here is controlled by environment variables in Vercel — this is a read-only status view so nothing is a guess.'));
  const body = h('div', { style: 'margin-top:8px' }, h('p', { class: 'subtle', style: 'font-size:13px' }, 'Loading…'));
  wrap.appendChild(body);
  root.appendChild(wrap);

  fetch('/api/settings', { headers: authHeaders() }).then(async (res) => {
    if (res.status === 401) { renderNotAuthorized(root); return; }
    const j = await res.json().catch(() => null);
    clear(body);
    if (res.status >= 500 || !j || !j.ok) { body.appendChild(h('p', { class: 'subtle', style: 'color:#F59E0B' }, "Couldn't load settings — refresh to retry.")); return; }
    for (const g of j.groups || []) {
      const card = h('div', { class: 'admin-card', style: 'margin-top:16px' });
      card.appendChild(h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label' }, g.title), h('span', { class: 'line' })));
      for (const it of g.items || []) {
        card.appendChild(h('div', { style: 'display:flex;align-items:center;gap:12px;padding:9px 0;border-top:1px solid #17171d' },
          h('span', { style: `flex:none;width:8px;height:8px;border-radius:50%;background:${it.on ? '#10b981' : '#F59E0B'}` }),
          h('span', { style: 'flex:1;min-width:0;font-size:13.5px' }, it.label),
          h('span', { class: 'mono', style: `flex:none;font-size:11px;color:${it.on ? '#10b981' : '#F59E0B'}` }, it.on ? 'ON' : 'OFF'),
          h('span', { class: 'subtle', style: 'flex:none;font-size:11px;color:var(--faint);max-width:46%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', title: it.hint || '' }, it.hint || '')));
      }
      body.appendChild(card);
    }
  }).catch(() => { clear(body); body.appendChild(h('p', { class: 'subtle', style: 'color:#F59E0B' }, "Couldn't reach the server.")); });
}
