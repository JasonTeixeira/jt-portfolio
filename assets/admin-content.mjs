// Content studio (cockpit ⑤), backed by /api/content. Board by status +
// add/edit form. DOM via shared h()/clear() (textContent only, no innerHTML).

const STATUS_COLS = [
  { key: 'idea', label: 'Ideas', color: '#8E8882' },
  { key: 'draft', label: 'Drafting', color: '#F59E0B' },
  { key: 'scheduled', label: 'Scheduled', color: '#22d3ee' },
  { key: 'published', label: 'Published', color: '#10b981' },
];
const CHANNELS = ['blog', 'linkedin', 'x', 'instagram', 'youtube', 'newsletter', 'other'];
const CHANNEL_COLOR = { blog: '#22d3ee', linkedin: '#38bdf8', x: '#e5e5ea', instagram: '#f472b6', youtube: '#f43f5e', newsletter: '#10b981', other: '#8E8882' };

function localToISO(v) { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString(); }
function toLocalInput(iso) { if (!iso) return ''; const d = new Date(iso); if (Number.isNaN(d.getTime())) return ''; const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }
function fmtWhen(iso) { if (!iso) return ''; const d = new Date(iso); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); }

export function renderContent(mount, key, deps) {
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
    const head = h('div', { style: 'display:flex;align-items:center;gap:12px;margin-bottom:14px' },
      h('div', { class: 'sec-rule', style: 'flex:1' }, h('span', { class: 'sec-label', style: 'color:#10b981' }, 'content pipeline'), h('span', { class: 'line' })),
      h('button', { type: 'button', class: 'btn-solid green', style: 'padding:8px 16px;font-size:13px', onClick: () => openForm(formMount) }, '+ New content'));
    mount.appendChild(head);
    const formMount = h('div', {});
    mount.appendChild(formMount);

    const board = h('div', { style: 'display:grid;grid-template-columns:repeat(4,1fr);gap:12px;align-items:start' });
    const cols = {};
    for (const col of STATUS_COLS) {
      const colEl = h('div', { style: 'background:#0d0d11;border:1px solid #1a1a20;border-radius:10px;padding:10px;min-height:80px' },
        h('div', { class: 'mono', style: `font-size:11px;color:${col.color};margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em` }, col.label, h('span', { class: 'count', style: 'color:var(--faint);margin-left:6px' }, '')));
      cols[col.key] = colEl;
      board.appendChild(colEl);
    }
    mount.appendChild(board);

    api('GET', '/api/content').then((r) => {
      if (r.unauthorized) { renderNotAuthorized(mount.parentNode || mount); return; }
      if (r.status === 502) { board.appendChild(h('p', { class: 'subtle', style: 'color:#F59E0B;grid-column:1/-1' }, "Couldn't load content — refresh to retry.")); return; }
      const items = (r.json && r.json.content) || [];
      const counts = { idea: 0, draft: 0, scheduled: 0, published: 0 };
      for (const it of items) { counts[it.status] = (counts[it.status] || 0) + 1; if (cols[it.status]) cols[it.status].appendChild(card(it)); }
      for (const col of STATUS_COLS) { const c = cols[col.key].querySelector('.count'); if (c) c.textContent = String(counts[col.key] || 0); }
      if (!items.length) board.appendChild(h('p', { class: 'subtle', style: 'grid-column:1/-1;margin-top:8px' }, 'No content yet — capture your first idea to start the pipeline.'));
    });

    function card(it) {
      const color = CHANNEL_COLOR[it.channel] || '#8E8882';
      const el = h('div', { style: 'background:#111117;border:1px solid #22232b;border-radius:8px;padding:8px 10px;margin-bottom:8px' });
      el.appendChild(h('div', { style: 'display:flex;align-items:start;gap:8px' },
        h('span', { title: it.channel, style: `font-family:var(--mono,monospace);font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:${color};margin-top:2px;flex:none` }, it.channel),
        h('div', { style: 'flex:1;font-size:13px;line-height:1.3' }, it.title)));
      const meta = h('div', { style: 'display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap' });
      if (it.scheduled_for) meta.appendChild(h('span', { class: 'mono', style: 'font-size:10px;color:var(--faint)' }, '📅 ' + fmtWhen(it.scheduled_for)));
      if (it.url) meta.appendChild(h('a', { href: it.url, target: '_blank', rel: 'noopener noreferrer', style: 'font-size:10px;color:#22d3ee' }, 'link ↗'));
      const sel = h('select', { style: 'font-size:11px;background:#0d0d11;border:1px solid #23232b;border-radius:5px;color:#e5e5ea;padding:2px 4px;margin-left:auto' },
        ...STATUS_COLS.map((s) => h('option', { value: s.key, selected: s.key === it.status ? 'selected' : false }, s.label)));
      sel.addEventListener('change', async () => { const r = await api('POST', '/api/content', { action: 'update', id: it.id, status: sel.value }); if (r.json && r.json.ok) draw(); });
      const edit = h('button', { type: 'button', class: 'btn-ghost', style: 'padding:2px 7px;font-size:11px', onClick: () => openForm(formMount, it) }, 'edit');
      meta.appendChild(sel); meta.appendChild(edit);
      el.appendChild(meta);
      return el;
    }

    function openForm(fm, it) {
      clear(fm);
      const editing = Boolean(it && it.id);
      const inputStyle = 'background:#0d0d11;border:1px solid #23232b;border-radius:6px;padding:8px 10px;color:#e5e5ea;font-size:13px';
      const titleIn = h('input', { type: 'text', placeholder: 'Headline / working title', value: (it && it.title) || '', style: inputStyle });
      const chanIn = h('select', { style: inputStyle }, ...CHANNELS.map((cN) => h('option', { value: cN, selected: it && it.channel === cN ? 'selected' : false }, cN)));
      const statusIn = h('select', { style: inputStyle }, ...STATUS_COLS.map((s) => h('option', { value: s.key, selected: it && it.status === s.key ? 'selected' : false }, s.label)));
      const schedIn = h('input', { type: 'datetime-local', value: it ? toLocalInput(it.scheduled_for) : '', style: inputStyle });
      const urlIn = h('input', { type: 'url', placeholder: 'Published URL (optional)', value: (it && it.url) || '', style: inputStyle });
      const notesIn = h('textarea', { rows: '3', placeholder: 'Outline / notes', style: inputStyle + ';resize:vertical' }); if (it && it.notes) notesIn.value = it.notes;
      const err = h('div', { style: 'color:#f87171;font-size:12px;min-height:14px' });
      async function save() {
        err.textContent = '';
        if (!titleIn.value.trim()) { err.textContent = 'Title is required.'; return; }
        const payload = { title: titleIn.value.trim(), channel: chanIn.value, status: statusIn.value, scheduled_for: schedIn.value ? localToISO(schedIn.value) : null, url: urlIn.value.trim() || null, notes: notesIn.value.trim() || null };
        if (editing) { payload.action = 'update'; payload.id = it.id; } else { payload.action = 'create'; }
        const r = await api('POST', '/api/content', payload);
        if (r.unauthorized) { err.textContent = 'Session expired — sign in again.'; return; }
        if (!r.json || !r.json.ok) { err.textContent = (r.json && r.json.error) ? `Could not save: ${r.json.error}` : 'Could not save.'; return; }
        draw();
      }
      async function del() { const r = await api('POST', '/api/content', { action: 'delete', id: it.id }); if (r.json && r.json.ok) draw(); else err.textContent = 'Could not delete.'; }
      const card2 = h('div', { class: 'admin-card', style: 'margin-bottom:14px' },
        h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#10b981' }, editing ? 'edit content' : 'new content'), h('span', { class: 'line' })),
        h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px' },
          h('div', { style: 'grid-column:1/-1' }, h('label', { style: 'display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--faint)' }, 'Title', titleIn)),
          h('label', { style: 'display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--faint)' }, 'Channel', chanIn),
          h('label', { style: 'display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--faint)' }, 'Status', statusIn),
          h('label', { style: 'display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--faint)' }, 'Scheduled for', schedIn),
          h('label', { style: 'display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--faint)' }, 'URL', urlIn),
          h('div', { style: 'grid-column:1/-1' }, h('label', { style: 'display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--faint)' }, 'Notes', notesIn))),
        err,
        h('div', { style: 'display:flex;gap:10px;margin-top:6px' },
          h('button', { type: 'button', class: 'btn-solid green', style: 'padding:8px 18px;font-size:13px', onClick: save }, editing ? 'Save' : 'Add content'),
          h('button', { type: 'button', class: 'btn-ghost', style: 'padding:8px 16px;font-size:13px', onClick: () => clear(fm) }, 'Cancel'),
          editing ? h('span', { style: 'flex:1' }) : false,
          editing ? h('button', { type: 'button', class: 'btn-ghost', style: 'padding:8px 16px;font-size:13px;color:#f87171', onClick: del }, 'Delete') : false));
      fm.appendChild(card2);
      titleIn.focus();
    }
  }

  draw();
}
