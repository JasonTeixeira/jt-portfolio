// GTM weekly tracker (cockpit). Server-persisted scoreboard + retro + mini-eval queue,
// with a short history of prior weeks. Replaces the old browser-localStorage ops.html.
// Autosaves (debounced) to /api/gtm. DOM via shared `h`/`clear`; all values via textContent.

const METRICS = [
  ['posts', 'posts published', '3'], ['comments', 'buyer comments', '25'],
  ['minievals', 'mini-evals run', '5–10'], ['touches', 'outreach touches', '25'],
  ['conversations', 'conversations', '—'], ['calls', 'calls booked', '—'],
  ['proposals', 'proposals sent', '—'], ['collected', '$ collected', '—'],
];
const KIT = [
  ['One-page offer', 'docs/sales-kit/offer.md'],
  ['Cold opener', 'docs/sales-kit/opener.md'],
  ['Mini-eval script', 'docs/sales-kit/mini-eval.md'],
  ['Proposal book', 'book.html'],
];

// Monday of the current week as YYYY-MM-DD — the default week key.
function currentMonday() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

export function renderGTM(mount, key, deps) {
  const { h, clear, authHeaders, renderNotAuthorized } = deps;
  const root = h('div', {});
  mount.appendChild(root);

  // In-memory model for the week being edited; autosave debounced.
  let week = currentMonday();
  let model = { metrics: {}, retro: '', evals: [] };
  let saveTimer = null;
  const savedTag = h('span', { class: 'subtle', style: 'font-size:11px;color:var(--faint)' }, '');

  function scheduleSave() {
    savedTag.textContent = 'saving…';
    if (saveTimer) clearTimeout(saveTimer);
    // Snapshot the week + a deep copy of the data at edit time. If the operator switches
    // weeks before this fires, the pending save still writes the RIGHT week's data —
    // it can never bleed week A's edits onto week B's row (the async model reassign in
    // load() cannot race it).
    const w = week;
    const snapshot = JSON.parse(JSON.stringify(model));
    saveTimer = setTimeout(() => doSave(w, snapshot), 600);
  }
  async function doSave(w, data) {
    try {
      const res = await fetch('/api/gtm', { method: 'POST',
        headers: authHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify({ week_of: w, data }) });
      if (res.status === 401) { renderNotAuthorized(mount.parentNode || mount); return; }
      const j = await res.json().catch(() => null);
      // Only reflect status if we're still looking at the week we just saved.
      if (w === week) savedTag.textContent = j && j.ok ? 'saved' : 'save failed';
    } catch { if (w === week) savedTag.textContent = 'save failed'; }
  }
  // Before leaving a week, fire any pending debounced save immediately so a later edit
  // on the next week can't cancel it and lose this week's last change.
  function flushSave() {
    if (!saveTimer) return;
    clearTimeout(saveTimer); saveTimer = null;
    doSave(week, JSON.parse(JSON.stringify(model)));
  }

  function draw() {
    clear(root);

    // Week picker + save state
    const head = h('div', { style: 'display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px' },
      h('label', { class: 'subtle', style: 'font-size:12px' }, 'Week of'),
      (() => {
        const inp = h('input', { type: 'date', value: week, style: 'padding:6px 10px;border-radius:8px' });
        inp.addEventListener('change', () => { if (inp.value) { flushSave(); week = inp.value; load(); } });
        return inp;
      })(),
      savedTag);
    root.appendChild(head);

    // Scoreboard grid
    const board = h('div', { class: 'admin-card' });
    board.appendChild(h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#10b981' }, 'weekly scoreboard'), h('span', { class: 'line' })));
    const grid = h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px' });
    for (const [k, label, target] of METRICS) {
      const inp = h('input', { type: k === 'collected' ? 'text' : 'number', value: model.metrics[k] || '', placeholder: '0',
        style: 'width:100%;padding:6px 10px;border-radius:8px' });
      inp.addEventListener('input', () => { model.metrics[k] = inp.value; scheduleSave(); });
      grid.appendChild(h('div', {},
        h('label', { class: 'subtle', style: 'font-size:11px;display:block;margin-bottom:4px' }, label),
        h('div', { style: 'display:flex;align-items:center;gap:6px' }, inp,
          h('span', { class: 'subtle', style: 'font-size:11px;color:var(--faint);white-space:nowrap' }, '/ ' + target))));
    }
    board.appendChild(grid);
    root.appendChild(board);

    // Retro
    const retroCard = h('div', { class: 'admin-card', style: 'margin-top:16px' });
    retroCard.appendChild(h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label' }, 'retro — what worked / what to change'), h('span', { class: 'line' })));
    const retro = h('textarea', { rows: '4', placeholder: 'One honest note per week.', style: 'width:100%;padding:10px;border-radius:8px;resize:vertical' });
    retro.value = model.retro || '';
    retro.addEventListener('input', () => { model.retro = retro.value; scheduleSave(); });
    retroCard.appendChild(retro);
    root.appendChild(retroCard);

    // Mini-eval queue
    const evalCard = h('div', { class: 'admin-card', style: 'margin-top:16px' });
    evalCard.appendChild(h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#22d3ee' }, 'mini-eval queue'), h('span', { class: 'line' })));
    const evalBody = h('div', {});
    function drawEvals() {
      clear(evalBody);
      (model.evals || []).forEach((row, i) => {
        const mk = (field, ph, w) => {
          const inp = h('input', { value: row[field] || '', placeholder: ph, style: `padding:5px 8px;border-radius:6px;${w}` });
          inp.addEventListener('input', () => { row[field] = inp.value; scheduleSave(); });
          return inp;
        };
        const sel = h('select', { style: 'padding:5px 8px;border-radius:6px' });
        for (const s of ['queued', 'running', 'done', 'sent']) sel.appendChild(h('option', { value: s, selected: row.status === s || undefined }, s));
        sel.addEventListener('change', () => { row.status = sel.value; scheduleSave(); });
        const del = h('button', { type: 'button', class: 'btn-ghost', style: 'padding:4px 8px;font-size:12px' }, '×');
        del.addEventListener('click', () => { model.evals.splice(i, 1); scheduleSave(); drawEvals(); });
        evalBody.appendChild(h('div', { style: 'display:flex;gap:8px;align-items:center;margin:6px 0;flex-wrap:wrap' },
          mk('target', 'target', 'flex:1;min-width:140px'), mk('url', 'feature url', 'flex:1;min-width:140px'), sel, del));
      });
    }
    drawEvals();
    const add = h('button', { type: 'button', class: 'btn-ghost', style: 'margin-top:8px;padding:6px 12px;font-size:12px' }, '+ add target');
    add.addEventListener('click', () => { model.evals = model.evals || []; model.evals.push({ target: '', url: '', status: 'queued' }); scheduleSave(); drawEvals(); });
    evalCard.appendChild(evalBody);
    evalCard.appendChild(add);
    root.appendChild(evalCard);

    // Kit + history row
    const cols = h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px' });
    const kit = h('div', { class: 'admin-card' });
    kit.appendChild(h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label' }, 'the kit'), h('span', { class: 'line' })));
    for (const [label, href] of KIT) kit.appendChild(h('a', { href, style: 'display:block;padding:6px 0;color:var(--green);text-decoration:none;font-size:13px' }, '→ ' + label));
    cols.appendChild(kit);
    const hist = h('div', { class: 'admin-card' });
    hist.appendChild(h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label' }, 'recent weeks'), h('span', { class: 'line' })));
    hist.appendChild(historyBody);
    cols.appendChild(hist);
    root.appendChild(cols);
  }

  const historyBody = h('div', { class: 'subtle', style: 'font-size:12px' }, 'Loading…');
  function drawHistory(weeks) {
    clear(historyBody);
    const others = (weeks || []).filter((w) => w.week_of !== week);
    if (!others.length) { historyBody.appendChild(h('p', { class: 'subtle' }, 'No prior weeks yet.')); return; }
    for (const w of others.slice(0, 8)) {
      const collected = (w.data && w.data.metrics && w.data.metrics.collected) || '—';
      const btn = h('button', { type: 'button', class: 'btn-ghost', style: 'display:flex;justify-content:space-between;width:100%;padding:6px 8px;font-size:12px;margin:2px 0' },
        h('span', { class: 'mono' }, w.week_of), h('span', { style: 'color:var(--green)' }, String(collected)));
      btn.addEventListener('click', () => { flushSave(); week = w.week_of; load(); });
      historyBody.appendChild(btn);
    }
  }

  async function load() {
    try {
      const res = await fetch('/api/gtm', { headers: authHeaders() });
      if (res.status === 401) { renderNotAuthorized(mount.parentNode || mount); return; }
      const j = await res.json().catch(() => null);
      const weeks = (j && j.ok && j.weeks) || [];
      const hit = weeks.find((w) => w.week_of === week);
      model = hit && hit.data && typeof hit.data === 'object'
        ? { metrics: hit.data.metrics || {}, retro: hit.data.retro || '', evals: hit.data.evals || [] }
        : { metrics: {}, retro: '', evals: [] };
      savedTag.textContent = hit ? 'saved' : 'new week';
      draw();
      drawHistory(weeks);
    } catch { clear(root); root.appendChild(h('p', { class: 'subtle', style: 'color:#F59E0B' }, "Couldn't load the GTM tracker — refresh to retry.")); }
  }

  load();
}
