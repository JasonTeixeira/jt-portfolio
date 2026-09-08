// Operator calendar view (native, Supabase-backed via /api/calendar).
// Rendered below the admin tab bar. All DOM built with the shared `h`/`clear`
// helpers passed in from proposal-admin so there is one DOM factory, and user
// data always lands via textContent (never innerHTML).

const KIND_COLOR = {
  meeting: '#22d3ee', call: '#a78bfa', deadline: '#F59E0B', task: '#10b981', reminder: '#f472b6',
};
const KINDS = ['meeting', 'call', 'deadline', 'task', 'reminder'];

function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function monthLabel(d) { return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); }
function fmtTime(iso, allDay) {
  if (!iso) return '';
  if (allDay) return 'All day';
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
function fmtWhen(iso, allDay) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}${allDay ? '' : ' · ' + fmtTime(iso, false)}`;
}
// datetime-local uses local wall-clock; convert to a real ISO instant for the API.
function localToISO(v) { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString(); }

export function renderCalendar(mount, key, deps) {
  const { h, clear, authHeaders, renderNotAuthorized } = deps;
  let cursor = new Date(); cursor.setDate(1); cursor.setHours(0, 0, 0, 0);

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
    // ── controls row ─────────────────────────────────────────────
    const monthStart = new Date(cursor);
    const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const nav = h('div', { style: 'display:flex;align-items:center;gap:12px;margin:8px 0 16px' },
      h('button', { type: 'button', class: 'btn-ghost', style: 'padding:6px 12px', onClick: () => { cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1); draw(); } }, '‹'),
      h('div', { class: 'sec-title', style: 'font-size:1.3rem;margin:0;min-width:190px' }, monthLabel(cursor)),
      h('button', { type: 'button', class: 'btn-ghost', style: 'padding:6px 12px', onClick: () => { cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1); draw(); } }, '›'),
      h('button', { type: 'button', class: 'btn-ghost', style: 'padding:6px 12px', onClick: () => { cursor = new Date(); cursor.setDate(1); cursor.setHours(0, 0, 0, 0); draw(); } }, 'Today'),
      h('span', { style: 'flex:1' }),
      h('button', { type: 'button', class: 'btn-solid green', style: 'padding:8px 16px;font-size:13px', onClick: () => openForm() }, '+ New event'));
    mount.appendChild(nav);

    const formMount = h('div', {});
    mount.appendChild(formMount);

    // ── month grid ───────────────────────────────────────────────
    const grid = h('div', { style: 'display:grid;grid-template-columns:repeat(7,1fr);gap:6px' });
    for (const wd of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
      grid.appendChild(h('div', { class: 'mono', style: 'font-size:11px;color:var(--faint);text-align:center;padding:4px 0' }, wd));
    }
    // leading blanks to align weekday of the 1st
    const lead = monthStart.getDay();
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const todayKey = ymd(new Date());
    const cells = {};
    for (let i = 0; i < lead; i++) grid.appendChild(h('div', {}));
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = ymd(new Date(cursor.getFullYear(), cursor.getMonth(), day));
      const isToday = dateKey === todayKey;
      const cell = h('div', { style: `min-height:92px;border:1px solid ${isToday ? 'var(--green)' : '#1a1a20'};border-radius:8px;padding:6px;background:#0d0d11;display:flex;flex-direction:column;gap:3px` },
        h('div', { class: 'mono', style: `font-size:11px;color:${isToday ? 'var(--green)' : 'var(--faint)'}` }, String(day)));
      cells[dateKey] = cell;
      grid.appendChild(cell);
    }
    mount.appendChild(grid);

    // ── upcoming list ────────────────────────────────────────────
    const upWrap = h('div', { class: 'admin-card', style: 'margin-top:20px' });
    upWrap.appendChild(h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#10b981' }, 'upcoming'), h('span', { class: 'line' })));
    const upList = h('div', {});
    upWrap.appendChild(upList);
    mount.appendChild(upWrap);

    // ── load events for the visible month ────────────────────────
    api('GET', `/api/calendar?from=${encodeURIComponent(monthStart.toISOString())}&to=${encodeURIComponent(nextMonth.toISOString())}`)
      .then((r) => {
        if (r.unauthorized) { renderNotAuthorized(mount.parentNode || mount); return; }
        if (r.status === 502) { grid.appendChild(h('p', { class: 'subtle', style: 'color:#F59E0B;grid-column:1/-1' }, "Couldn't load calendar — refresh to retry.")); return; }
        const events = (r.json && r.json.events) || [];
        for (const ev of events) {
          const key2 = ymd(new Date(ev.starts_at));
          const cell = cells[key2];
          if (!cell) continue;
          cell.appendChild(eventChip(ev));
        }
      });

    // upcoming (from now, across months)
    api('GET', '/api/calendar?upcoming=1').then((r) => {
      if (r.unauthorized) return;
      const events = (r.json && r.json.events) || [];
      clear(upList);
      if (!events.length) { upList.appendChild(h('p', { class: 'subtle' }, 'Nothing scheduled ahead. Add a meeting or deadline to get started.')); return; }
      for (const ev of events) upList.appendChild(upcomingRow(ev));
    });

    function eventChip(ev) {
      const color = KIND_COLOR[ev.kind] || '#22d3ee';
      const chip = h('button', {
        type: 'button', title: `${ev.title} — click to manage`,
        style: `text-align:left;font-size:11px;line-height:1.25;padding:3px 6px;border-radius:5px;border:1px solid ${color}44;background:${color}18;color:#e5e5ea;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap`,
      });
      chip.appendChild(h('span', { style: `color:${color};margin-right:4px` }, '●'));
      chip.appendChild(document.createTextNode(`${ev.all_day ? '' : fmtTime(ev.starts_at, false) + ' '}${ev.title}`));
      chip.addEventListener('click', () => openForm(ev));
      return chip;
    }

    function upcomingRow(ev) {
      const color = KIND_COLOR[ev.kind] || '#22d3ee';
      const row = h('div', { style: 'display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid #16161c' },
        h('span', { style: `width:8px;height:8px;border-radius:50%;background:${color};flex:none` }),
        h('div', { style: 'flex:1;min-width:0' },
          h('div', { style: 'font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, ev.title),
          h('div', { class: 'mono', style: 'font-size:11px;color:var(--faint)' }, `${ev.kind} · ${fmtWhen(ev.starts_at, ev.all_day)}`)),
        h('button', { type: 'button', class: 'btn-ghost', style: 'padding:4px 10px;font-size:12px', onClick: () => openForm(ev) }, 'Edit'));
      return row;
    }

    // ── add / edit form ──────────────────────────────────────────
    function openForm(ev) {
      clear(formMount);
      const editing = Boolean(ev && ev.id);
      const field = (label, node) => h('label', { style: 'display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--faint)' }, label, node);
      const inputStyle = 'background:#0d0d11;border:1px solid #23232b;border-radius:6px;padding:8px 10px;color:#e5e5ea;font-size:13px';
      const titleIn = h('input', { type: 'text', placeholder: 'e.g. Discovery call — Acme Co', value: (ev && ev.title) || '', style: inputStyle });
      const kindIn = h('select', { style: inputStyle }, ...KINDS.map((k) => h('option', { value: k, selected: ev && ev.kind === k ? 'selected' : false }, k)));
      // datetime-local wants YYYY-MM-DDTHH:mm in local time
      const toLocalInput = (iso) => { if (!iso) return ''; const d = new Date(iso); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
      // New-event default: next top-of-hour if viewing the current (or a past) month,
      // else 9am on the 1st of the month being viewed. Never defaults to a past instant.
      const defaultStart = ev ? toLocalInput(ev.starts_at) : (() => {
        const now = new Date();
        const viewingFutureMonth = cursor.getFullYear() > now.getFullYear() || (cursor.getFullYear() === now.getFullYear() && cursor.getMonth() > now.getMonth());
        const d = viewingFutureMonth ? new Date(cursor) : new Date(now);
        if (viewingFutureMonth) d.setHours(9, 0, 0, 0);
        else { d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); }
        return toLocalInput(d.toISOString());
      })();
      const startIn = h('input', { type: 'datetime-local', value: defaultStart, style: inputStyle });
      const endIn = h('input', { type: 'datetime-local', value: ev ? toLocalInput(ev.ends_at) : '', style: inputStyle });
      const allDayIn = h('input', { type: 'checkbox' }); if (ev && ev.all_day) allDayIn.checked = true;
      const notesIn = h('textarea', { rows: '2', placeholder: 'Notes (optional)', style: inputStyle + ';resize:vertical' }); if (ev && ev.notes) notesIn.value = ev.notes;
      const err = h('div', { style: 'color:#f87171;font-size:12px;min-height:14px' });

      async function save() {
        err.textContent = '';
        const starts = localToISO(startIn.value);
        if (!titleIn.value.trim()) { err.textContent = 'Title is required.'; return; }
        if (!starts) { err.textContent = 'A valid start date/time is required.'; return; }
        const payload = {
          title: titleIn.value.trim(), kind: kindIn.value, starts_at: starts,
          ends_at: localToISO(endIn.value), all_day: allDayIn.checked, notes: notesIn.value.trim() || null,
        };
        if (editing) { payload.action = 'update'; payload.id = ev.id; } else { payload.action = 'create'; }
        const r = await api('POST', '/api/calendar', payload);
        if (r.unauthorized) { err.textContent = 'Session expired — sign in again.'; return; }
        if (!r.json || !r.json.ok) { err.textContent = (r.json && r.json.error) ? `Could not save: ${r.json.error}` : 'Could not save the event.'; return; }
        draw();
      }
      async function del() {
        if (!window.confirm('Delete this event? This can’t be undone.')) return;
        const r = await api('POST', '/api/calendar', { action: 'delete', id: ev.id });
        if (r.json && r.json.ok) draw(); else err.textContent = 'Could not delete.';
      }

      const card = h('div', { class: 'admin-card', style: 'margin-bottom:18px' },
        h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#10b981' }, editing ? 'edit event' : 'new event'), h('span', { class: 'line' })),
        h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px' },
          h('div', { style: 'grid-column:1/-1' }, field('Title', titleIn)),
          field('Type', kindIn),
          h('label', { style: 'display:flex;align-items:center;gap:8px;font-size:12px;color:var(--faint);align-self:end;padding-bottom:8px' }, allDayIn, 'All day'),
          field('Starts', startIn),
          field('Ends (optional)', endIn),
          h('div', { style: 'grid-column:1/-1' }, field('Notes', notesIn))),
        err,
        h('div', { style: 'display:flex;gap:10px;margin-top:6px' },
          h('button', { type: 'button', class: 'btn-solid green', style: 'padding:8px 18px;font-size:13px', onClick: save }, editing ? 'Save changes' : 'Add event'),
          h('button', { type: 'button', class: 'btn-ghost', style: 'padding:8px 16px;font-size:13px', onClick: () => clear(formMount) }, 'Cancel'),
          editing ? h('span', { style: 'flex:1' }) : false,
          editing ? h('button', { type: 'button', class: 'btn-ghost', style: 'padding:8px 16px;font-size:13px;color:#f87171', onClick: del }, 'Delete') : false));
      formMount.appendChild(card);
      titleIn.focus();
    }
  }

  draw();
}
