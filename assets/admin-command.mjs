// ⌘K command palette for the operator cockpit. Jump to any section, run a quick action,
// or search clients/proposals and deep-link straight to them. Keyboard-first: ⌘K/Ctrl+K
// opens, ↑/↓ move, Enter activates, Esc closes. DOM via the shared `h`; all dynamic text
// goes through textContent (client-editable data). Self-contained; styles inline.

export function createCommandPalette(deps) {
  const { h, authHeaders, navigate, sections, actions, money, onUnauthorized } = deps;

  const input = h('input', {
    type: 'text', placeholder: 'Search clients, proposals, or jump to…', 'aria-label': 'Command palette',
    autocomplete: 'off', spellcheck: 'false',
    style: 'width:100%;background:transparent;border:0;outline:0;color:var(--ink,#F4F2EF);font-size:16px;padding:16px 18px;font-family:inherit',
  });
  const listEl = h('div', { role: 'listbox', style: 'max-height:52vh;overflow-y:auto;padding:6px' });
  const panel = h('div', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Command palette',
    style: 'width:min(640px,92vw);background:var(--card,#0C0C0E);border:1px solid var(--line,#26262c);border-radius:16px;box-shadow:0 24px 80px rgba(0,0,0,.6);overflow:hidden' },
    h('div', { style: 'border-bottom:1px solid var(--line,#26262c);display:flex;align-items:center;gap:8px;padding-left:8px' },
      h('span', { style: 'color:var(--faint,#8E8882);font-size:15px;padding-left:8px' }, '⌘'), input),
    listEl,
    h('div', { style: 'border-top:1px solid var(--line,#26262c);padding:8px 14px;display:flex;gap:16px;color:var(--faint,#8E8882);font-size:11px;font-family:var(--mono,monospace)' },
      h('span', {}, '↑↓ move'), h('span', {}, '↵ open'), h('span', {}, 'esc close')));
  const overlay = h('div', {
    style: 'position:fixed;inset:0;z-index:200;display:none;align-items:flex-start;justify-content:center;padding-top:12vh;background:rgba(5,5,7,.66);backdrop-filter:blur(3px)',
  }, panel);

  let items = [];      // flat activatable list: {label, sublabel, kind, run}
  let sel = 0;
  let searchTimer = null;
  let reqSeq = 0;      // guards against out-of-order search responses

  const norm = (s) => String(s || '').toLowerCase();

  function localMatches(q) {
    const jump = sections.map((s) => ({ label: s.label, sublabel: 'Section', kind: 'jump', run: () => navigate(s.id) }));
    const acts = (actions || []).map((a) => ({ label: a.label, sublabel: 'Action', kind: 'action', run: a.run }));
    if (!q) return { jump, acts };
    const f = (arr) => arr.filter((x) => norm(x.label).includes(q));
    return { jump: f(jump), acts: f(acts) };
  }

  function render(groups) {
    // groups: [{title, rows:[item...]}] — flatten into `items` with headers between.
    items = [];
    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
    let any = false;
    for (const g of groups) {
      if (!g.rows.length) continue;
      any = true;
      listEl.appendChild(h('div', { style: 'padding:8px 12px 4px;color:var(--faint,#8E8882);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;font-family:var(--mono,monospace)' }, g.title));
      for (const row of g.rows) {
        const idx = items.length;
        const el = h('div', { role: 'option', 'data-idx': String(idx),
          style: 'display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:9px;cursor:pointer' },
          h('span', { style: 'flex:1;min-width:0' },
            h('span', { style: 'display:block;font-size:14px;color:var(--ink,#F4F2EF);overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, row.label),
            row.sublabel ? h('span', { style: 'display:block;font-size:11.5px;color:var(--faint,#8E8882);overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, row.sublabel) : null),
          row.badge ? h('span', { class: 'mono', style: 'font-size:11px;color:var(--faint,#8E8882)' }, row.badge) : null);
        el.addEventListener('mousemove', () => { if (sel !== idx) { sel = idx; paint(); } });
        el.addEventListener('click', () => activate(idx));
        items.push({ ...row, el });
        listEl.appendChild(el);
      }
    }
    if (!any) listEl.appendChild(h('div', { style: 'padding:20px 14px;color:var(--faint,#8E8882);font-size:13px' }, 'No matches.'));
    sel = 0; paint();
  }

  function paint() {
    items.forEach((it, i) => { it.el.style.background = i === sel ? 'rgba(16,185,129,.14)' : 'transparent'; });
    const cur = items[sel]; if (cur && cur.el.scrollIntoView) cur.el.scrollIntoView({ block: 'nearest' });
  }

  function activate(i) {
    const it = items[i]; if (!it) return;
    close();
    try { it.run(); } catch { /* ignore */ }
  }

  function drawFor(q) {
    const { jump, acts } = localMatches(q);
    render([
      { title: 'Actions', rows: acts },
      { title: 'Jump to', rows: jump },
    ]);
  }

  async function runSearch(q) {
    const seq = ++reqSeq;
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { headers: authHeaders() });
      if (seq !== reqSeq) return; // a newer query superseded this one
      // A dead/expired session must not look like "no matches" — bounce to the auth prompt,
      // matching how every other admin data call in the cockpit handles 401.
      if (res.status === 401) { close(); if (typeof onUnauthorized === 'function') onUnauthorized(); return; }
      const j = await res.json().catch(() => null);
      const clients = (j && j.clients) || [];
      const proposals = (j && j.proposals) || [];
      const { jump, acts } = localMatches(q);
      render([
        { title: 'Clients', rows: clients.map((c) => ({
          label: c.name || c.company || c.email || 'Client', sublabel: [c.email, c.company].filter(Boolean).join(' · ') || c.stage,
          run: () => navigate('clients', c.id) })) },
        { title: 'Proposals', rows: proposals.map((p) => ({
          label: p.public_id || 'Proposal', sublabel: [p.client_email, p.status].filter(Boolean).join(' · '),
          badge: p.firm_cents != null && money ? money(p.firm_cents) : null,
          run: () => navigate('proposals', p.id) })) },
        { title: 'Actions', rows: acts },
        { title: 'Jump to', rows: jump },
      ]);
    } catch { /* keep local results already shown */ }
  }

  input.addEventListener('input', () => {
    const q = input.value.trim();
    drawFor(q.toLowerCase());                 // instant local results
    if (searchTimer) clearTimeout(searchTimer);
    if (q.length >= 2) searchTimer = setTimeout(() => runSearch(q), 160); // debounced remote
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (items.length) { sel = (sel + 1) % items.length; paint(); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (items.length) { sel = (sel - 1 + items.length) % items.length; paint(); } }
    else if (e.key === 'Enter') { e.preventDefault(); activate(sel); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });

  function open() { overlay.style.display = 'flex'; input.value = ''; drawFor(''); input.focus(); }
  function close() { overlay.style.display = 'none'; input.blur(); }
  function isOpen() { return overlay.style.display === 'flex'; }

  return { el: overlay, open, close, isOpen };
}
