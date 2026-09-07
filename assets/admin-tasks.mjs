// Operator "Tasks & budgets" view (cockpit module 3), backed by /api/tasks.
// DOM built with the shared `h`/`clear` helpers; user data via textContent only.

const STATUS_COLS = [
  { key: 'todo', label: 'To do', color: '#8E8882' },
  { key: 'doing', label: 'In progress', color: '#F59E0B' },
  { key: 'blocked', label: 'Blocked', color: '#f43f5e' },
  { key: 'done', label: 'Done', color: '#10b981' },
];
const PRIORITY = { high: '#f43f5e', medium: '#F59E0B', low: '#8E8882' };
const KINDS = ['subcontractor', 'tool', 'ads', 'fees', 'other'];

function localToISO(v) { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString(); }
function fmtDue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function renderTasks(mount, key, deps) {
  const { h, clear, authHeaders, renderNotAuthorized, money } = deps;

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
    const tasksSection = h('div', {});
    const budgetSection = h('div', { style: 'margin-top:28px' });
    mount.appendChild(tasksSection);
    mount.appendChild(budgetSection);
    drawTasks(tasksSection);
    drawBudget(budgetSection);
  }

  /* ── Tasks board ─────────────────────────────────────────────── */
  function drawTasks(root) {
    clear(root);
    const head = h('div', { style: 'display:flex;align-items:center;gap:12px;margin-bottom:14px' },
      h('div', { class: 'sec-rule', style: 'flex:1' }, h('span', { class: 'sec-label', style: 'color:#10b981' }, 'tasks'), h('span', { class: 'line' })),
      h('button', { type: 'button', class: 'btn-solid green', style: 'padding:8px 16px;font-size:13px', onClick: () => openTaskForm(formMount) }, '+ New task'));
    root.appendChild(head);
    const formMount = h('div', {});
    root.appendChild(formMount);

    const board = h('div', { style: 'display:grid;grid-template-columns:repeat(4,1fr);gap:12px;align-items:start' });
    const cols = {};
    for (const col of STATUS_COLS) {
      const colEl = h('div', { style: 'background:#0d0d11;border:1px solid #1a1a20;border-radius:10px;padding:10px;min-height:80px' },
        h('div', { class: 'mono', style: `font-size:11px;color:${col.color};margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em` }, col.label, h('span', { class: 'count', style: 'color:var(--faint);margin-left:6px' }, '')));
      cols[col.key] = colEl;
      board.appendChild(colEl);
    }
    root.appendChild(board);

    api('GET', '/api/tasks').then((r) => {
      if (r.unauthorized) { renderNotAuthorized(mount.parentNode || mount); return; }
      if (r.status === 502) { board.appendChild(h('p', { class: 'subtle', style: 'color:#F59E0B;grid-column:1/-1' }, "Couldn't load tasks — refresh to retry.")); return; }
      const tasks = (r.json && r.json.tasks) || [];
      const counts = { todo: 0, doing: 0, blocked: 0, done: 0 };
      for (const t of tasks) {
        counts[t.status] = (counts[t.status] || 0) + 1;
        if (cols[t.status]) cols[t.status].appendChild(taskCard(t));
      }
      for (const col of STATUS_COLS) { const c = cols[col.key].querySelector('.count'); if (c) c.textContent = String(counts[col.key] || 0); }
      const empty = !tasks.length;
      if (empty) board.appendChild(h('p', { class: 'subtle', style: 'grid-column:1/-1;margin-top:8px' }, 'No tasks yet — add the first thing you need to get done.'));
    });

    function taskCard(t) {
      const card = h('div', { style: 'background:#111117;border:1px solid #22232b;border-radius:8px;padding:8px 10px;margin-bottom:8px' });
      card.appendChild(h('div', { style: 'display:flex;align-items:start;gap:8px' },
        h('span', { title: `${t.priority} priority`, style: `width:8px;height:8px;border-radius:50%;background:${PRIORITY[t.priority] || '#8E8882'};margin-top:5px;flex:none` }),
        h('div', { style: `flex:1;font-size:13px;line-height:1.3${t.status === 'done' ? ';text-decoration:line-through;color:var(--faint)' : ''}` }, t.title)));
      const meta = h('div', { style: 'display:flex;align-items:center;gap:8px;margin-top:6px' });
      if (t.due_at) meta.appendChild(h('span', { class: 'mono', style: 'font-size:10px;color:var(--faint)' }, '⏱ ' + fmtDue(t.due_at)));
      const sel = h('select', { style: 'font-size:11px;background:#0d0d11;border:1px solid #23232b;border-radius:5px;color:#e5e5ea;padding:2px 4px;margin-left:auto' },
        ...STATUS_COLS.map((s) => h('option', { value: s.key, selected: s.key === t.status ? 'selected' : false }, s.label)));
      sel.addEventListener('change', async () => {
        const r = await api('POST', '/api/tasks', { action: 'task_update', id: t.id, status: sel.value });
        if (r.json && r.json.ok) drawTasks(root);
      });
      const del = h('button', { type: 'button', title: 'Delete', class: 'btn-ghost', style: 'padding:2px 7px;font-size:11px;color:#f87171', onClick: async () => { const r = await api('POST', '/api/tasks', { action: 'task_delete', id: t.id }); if (r.json && r.json.ok) drawTasks(root); } }, '✕');
      meta.appendChild(sel); meta.appendChild(del);
      card.appendChild(meta);
      return card;
    }

    function openTaskForm(fm) {
      clear(fm);
      const inputStyle = 'background:#0d0d11;border:1px solid #23232b;border-radius:6px;padding:8px 10px;color:#e5e5ea;font-size:13px';
      const titleIn = h('input', { type: 'text', placeholder: 'What needs doing? e.g. Send Acme kickoff deck', style: inputStyle });
      const prioIn = h('select', { style: inputStyle }, ...['medium', 'high', 'low'].map((p) => h('option', { value: p }, p)));
      const dueIn = h('input', { type: 'date', style: inputStyle });
      const err = h('div', { style: 'color:#f87171;font-size:12px;min-height:14px' });
      async function save() {
        err.textContent = '';
        if (!titleIn.value.trim()) { err.textContent = 'Title is required.'; return; }
        const r = await api('POST', '/api/tasks', { action: 'task_create', title: titleIn.value.trim(), priority: prioIn.value, due_at: dueIn.value ? localToISO(dueIn.value) : null });
        if (r.unauthorized) { err.textContent = 'Session expired — sign in again.'; return; }
        if (!r.json || !r.json.ok) { err.textContent = 'Could not add task.'; return; }
        drawTasks(root);
      }
      const card = h('div', { class: 'admin-card', style: 'margin-bottom:14px' },
        h('div', { style: 'display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px' },
          h('label', { style: 'display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--faint)' }, 'Task', titleIn),
          h('label', { style: 'display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--faint)' }, 'Priority', prioIn),
          h('label', { style: 'display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--faint)' }, 'Due', dueIn)),
        err,
        h('div', { style: 'display:flex;gap:10px;margin-top:6px' },
          h('button', { type: 'button', class: 'btn-solid green', style: 'padding:8px 18px;font-size:13px', onClick: save }, 'Add task'),
          h('button', { type: 'button', class: 'btn-ghost', style: 'padding:8px 16px;font-size:13px', onClick: () => clear(fm) }, 'Cancel')));
      fm.appendChild(card);
      titleIn.focus();
    }
  }

  /* ── Budget & margin ─────────────────────────────────────────── */
  function drawBudget(root) {
    clear(root);
    root.appendChild(h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#10b981' }, 'budget · margin per deal'), h('span', { class: 'line' })));
    const statMount = h('div', { class: 'stat-row' });
    const tableMount = h('div', { style: 'margin-top:14px' });
    root.appendChild(statMount);
    root.appendChild(tableMount);
    const stat = (n, l, color) => h('div', { class: 'stat' }, h('div', { class: 'n', style: color ? `color:${color}` : '' }, n), h('div', { class: 'l' }, l));

    api('GET', '/api/tasks?budget=1').then((r) => {
      if (r.unauthorized) return;
      if (r.status === 502 || !r.json || !r.json.ok) { statMount.appendChild(h('p', { class: 'subtle', style: 'color:#F59E0B' }, "Couldn't load budget — refresh to retry.")); return; }
      const { rows, totals } = r.json.budget;
      clear(statMount);
      statMount.appendChild(stat(money(totals.revenueCents), 'Revenue (won)', '#10b981'));
      statMount.appendChild(stat(money(totals.costCents), 'Costs', '#F59E0B'));
      statMount.appendChild(stat(money(totals.marginCents), 'Margin', '#22d3ee'));
      statMount.appendChild(stat(totals.marginPct + '%', 'Margin %'));
      clear(tableMount);
      if (!rows.length) { tableMount.appendChild(h('p', { class: 'subtle' }, 'No won deals or costs yet — margin fills in once deposits are paid and you log costs.')); return; }
      for (const row of rows) tableMount.appendChild(budgetRow(row));
    });

    function budgetRow(row) {
      const marginColor = row.marginCents >= 0 ? '#10b981' : '#f43f5e';
      const costsMount = h('div', {});
      const wrap = h('div', { class: 'admin-card', style: 'margin-bottom:10px' });
      wrap.appendChild(h('div', { style: 'display:flex;align-items:center;gap:14px;flex-wrap:wrap' },
        h('div', { style: 'flex:1;min-width:160px' },
          h('div', { style: 'font-size:14px' }, row.clientEmail || row.publicId),
          h('div', { class: 'mono', style: 'font-size:11px;color:var(--faint)' }, `${row.status} · ${row.publicId}`)),
        h('div', { style: 'text-align:right' }, h('div', { class: 'mono', style: 'font-size:13px;color:#10b981' }, money(row.revenueCents)), h('div', { class: 'l', style: 'font-size:10px;color:var(--faint)' }, 'revenue')),
        h('div', { style: 'text-align:right' }, h('div', { class: 'mono', style: 'font-size:13px;color:#F59E0B' }, money(row.costCents)), h('div', { class: 'l', style: 'font-size:10px;color:var(--faint)' }, 'cost')),
        h('div', { style: 'text-align:right' }, h('div', { class: 'mono', style: `font-size:13px;color:${marginColor}` }, money(row.marginCents)), h('div', { class: 'l', style: 'font-size:10px;color:var(--faint)' }, `margin · ${row.marginPct}%`)),
        h('button', { type: 'button', class: 'btn-ghost', style: 'padding:5px 11px;font-size:12px', onClick: () => toggleCosts() }, '+ cost')));
      wrap.appendChild(costsMount);

      let open = false;
      function toggleCosts() { open = !open; clear(costsMount); if (open) loadCosts(); }
      function loadCosts() {
        const inputStyle = 'background:#0d0d11;border:1px solid #23232b;border-radius:6px;padding:6px 8px;color:#e5e5ea;font-size:12px';
        const labelIn = h('input', { type: 'text', placeholder: 'Cost label e.g. Contractor design', style: inputStyle });
        const kindIn = h('select', { style: inputStyle }, ...KINDS.map((k) => h('option', { value: k }, k)));
        const amtIn = h('input', { type: 'number', min: '0', step: '0.01', placeholder: 'USD', style: inputStyle + ';width:90px' });
        const err = h('div', { style: 'color:#f87171;font-size:11px' });
        const listMount = h('div', { style: 'margin:8px 0' });
        async function addCost() {
          err.textContent = '';
          const dollars = Number(amtIn.value);
          if (!labelIn.value.trim()) { err.textContent = 'Label required.'; return; }
          if (!Number.isFinite(dollars) || dollars < 0) { err.textContent = 'Valid amount required.'; return; }
          const r = await api('POST', '/api/tasks', { action: 'cost_add', proposal_id: row.proposalId, label: labelIn.value.trim(), kind: kindIn.value, amount_cents: Math.round(dollars * 100) });
          if (!r.json || !r.json.ok) { err.textContent = 'Could not add cost.'; return; }
          drawBudget(root); // refresh totals + this row
        }
        const form = h('div', { style: 'display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px solid #1a1a20' },
          labelIn, kindIn, amtIn,
          h('button', { type: 'button', class: 'btn-solid green', style: 'padding:6px 12px;font-size:12px', onClick: addCost }, 'Add'));
        costsMount.appendChild(listMount);
        costsMount.appendChild(form);
        costsMount.appendChild(err);
        api('GET', `/api/tasks?costs=${encodeURIComponent(row.proposalId)}`).then((cr) => {
          if (!cr.json || !cr.json.ok) return;
          const costs = cr.json.costs || [];
          clear(listMount);
          if (!costs.length) { listMount.appendChild(h('p', { class: 'subtle', style: 'font-size:12px' }, 'No costs logged for this deal yet.')); return; }
          for (const cst of costs) {
            listMount.appendChild(h('div', { style: 'display:flex;align-items:center;gap:10px;font-size:12px;padding:4px 0' },
              h('span', { class: 'mono', style: 'color:#F59E0B;width:80px;text-align:right' }, money(cst.amount_cents)),
              h('span', { style: 'color:var(--faint);width:90px' }, cst.kind),
              h('span', { style: 'flex:1' }, cst.label),
              h('button', { type: 'button', class: 'btn-ghost', style: 'padding:2px 7px;font-size:11px;color:#f87171', onClick: async () => { const dr = await api('POST', '/api/tasks', { action: 'cost_delete', id: cst.id }); if (dr.json && dr.json.ok) drawBudget(root); } }, '✕')));
          }
        });
      }
      return wrap;
    }
  }

  draw();
}
