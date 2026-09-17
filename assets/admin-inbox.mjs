// Unified operator inbox (cockpit). Lists every project thread with unread client
// messages; opening a thread loads it via /api/messages (which marks it read) and lets
// the operator reply inline. `onRead` lets the shell refresh the nav badge after a read.

export function renderInbox(mount, key, deps) {
  const { h, clear, authHeaders, renderNotAuthorized, onRead } = deps;
  const wrap = h('div', { style: 'display:grid;grid-template-columns:minmax(240px,340px) 1fr;gap:16px;align-items:start' });
  const listCard = h('div', { class: 'admin-card' });
  const threadCard = h('div', { class: 'admin-card' }, h('p', { class: 'subtle' }, 'Select a conversation.'));
  listCard.appendChild(h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#22d3ee' }, 'unread from clients'), h('span', { class: 'line' })));
  const listBody = h('div', {}, h('p', { class: 'subtle' }, 'Loading…'));
  listCard.appendChild(listBody);
  wrap.appendChild(listCard);
  wrap.appendChild(threadCard);
  mount.appendChild(wrap);

  function fmtTime(iso) { const t = new Date(iso).getTime(); if (Number.isNaN(t)) return ''; const d = Math.floor((Date.now() - t) / 864e5); return d <= 0 ? 'today' : d === 1 ? '1d ago' : `${d}d ago`; }

  async function openThread(thread) {
    clear(threadCard);
    threadCard.appendChild(h('p', { class: 'subtle' }, 'Loading conversation…'));
    let msgs = [];
    try {
      const res = await fetch(`/api/messages?projectId=${encodeURIComponent(thread.projectId)}`, { headers: authHeaders() });
      if (res.status === 401) { renderNotAuthorized(mount.parentNode || mount); return; }
      const j = await res.json().catch(() => null);
      msgs = (j && j.ok && j.messages) || [];
    } catch { clear(threadCard); threadCard.appendChild(h('p', { class: 'subtle', style: 'color:#F59E0B' }, "Couldn't load this conversation.")); return; }

    clear(threadCard);
    threadCard.appendChild(h('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:10px' },
      h('strong', { style: 'font-size:14px' }, thread.email || 'Client'),
      thread.portalToken ? h('a', { href: `portal.html?id=${encodeURIComponent(thread.portalToken)}`, target: '_blank', class: 'subtle', style: 'font-size:11px' }, 'open portal →') : null));

    const scroll = h('div', { style: 'max-height:52vh;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:4px 0' });
    for (const m of msgs) {
      const mine = m.sender === 'operator';
      const bubble = h('div', { style: `max-width:80%;align-self:${mine ? 'flex-end' : 'flex-start'};background:${mine ? 'rgba(16,185,129,.12)' : '#141418'};border:1px solid ${mine ? 'rgba(16,185,129,.3)' : 'var(--line,#26262c)'};border-radius:10px;padding:8px 12px` },
        h('div', { style: 'font-size:13px;white-space:pre-wrap;word-break:break-word' }, m.body));
      if (m.attachment && m.attachment.name) {
        bubble.appendChild(h('a', { href: m.attachment.url || '#', target: '_blank', rel: 'noopener', style: 'display:inline-flex;align-items:center;gap:6px;margin-top:5px;font-size:12px;color:#22d3ee;text-decoration:none' }, h('span', {}, '📎'), h('span', {}, m.attachment.name)));
      }
      bubble.appendChild(h('div', { class: 'subtle', style: 'font-size:10px;margin-top:4px;color:var(--faint)' }, `${mine ? 'you' : 'client'} · ${fmtTime(m.created_at)}`));
      scroll.appendChild(bubble);
    }
    threadCard.appendChild(scroll);

    const box = h('textarea', { rows: '3', placeholder: 'Write a reply…', style: 'width:100%;padding:10px;border-radius:8px;resize:vertical;margin-top:10px' });
    const send = h('button', { type: 'button', class: 'btn-solid green', style: 'margin-top:8px;padding:8px 16px;cursor:pointer' }, 'Send reply');
    const status = h('span', { class: 'subtle', style: 'font-size:11px;margin-left:10px' }, '');
    send.addEventListener('click', async () => {
      const text = box.value.trim();
      if (text.length < 1) return;
      send.disabled = true; status.textContent = 'sending…';
      try {
        const res = await fetch('/api/messages', { method: 'POST',
          headers: authHeaders({ 'content-type': 'application/json' }),
          body: JSON.stringify({ projectId: thread.projectId, body: text }) });
        const j = await res.json().catch(() => null);
        if (j && j.ok) { box.value = ''; status.textContent = 'sent'; openThread(thread); }
        else status.textContent = 'send failed';
      } catch { status.textContent = 'send failed'; }
      send.disabled = false;
    });
    threadCard.appendChild(h('div', {}, send, status));

    // Opening marked it read server-side — refresh badge + drop it from the unread list.
    if (typeof onRead === 'function') onRead();
    load();
  }

  async function load() {
    try {
      const res = await fetch('/api/inbox', { headers: authHeaders() });
      if (res.status === 401) { renderNotAuthorized(mount.parentNode || mount); return; }
      const j = await res.json().catch(() => null);
      const threads = (j && j.ok && j.threads) || [];
      clear(listBody);
      if (!threads.length) { listBody.appendChild(h('p', { class: 'subtle' }, 'Inbox zero — no unread client messages.')); return; }
      for (const t of threads) {
        const btn = h('button', { type: 'button', class: 'btn-ghost', style: 'display:block;width:100%;text-align:left;padding:10px;margin:4px 0;border-radius:10px' },
          h('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:8px' },
            h('strong', { style: 'font-size:13px' }, t.email || 'Client'),
            h('span', { style: 'font-size:11px;background:#22d3ee;color:#04121a;border-radius:10px;padding:1px 7px;font-weight:700' }, String(t.unread))),
          h('div', { class: 'subtle', style: 'font-size:11.5px;color:var(--faint);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, t.latestBody || ''));
        btn.addEventListener('click', () => openThread(t));
        listBody.appendChild(btn);
      }
    } catch { clear(listBody); listBody.appendChild(h('p', { class: 'subtle', style: 'color:#F59E0B' }, "Couldn't load the inbox — refresh to retry.")); }
  }

  load();
}
