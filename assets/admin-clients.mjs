// Client 360 hub (cockpit): a list of every client → one unified detail view with
// deals, payments, projects/deliverables, contract, notes, external links, timeline.
// DOM via the shared h()/clear(); user data via textContent only.

const STAGE_COLOR = { new: '#22d3ee', scoped: '#a78bfa', engaged: '#10b981', won: '#10b981', lost: '#f43f5e' };
const PROP_COLOR = { draft_pending: '#F59E0B', approved: '#22d3ee', deposit_paid: '#10b981', paid: '#10b981', expired: '#8E8882', declined: '#f43f5e' };
function fmtDay(iso) { if (!iso) return ''; const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }

export function renderClients(root, key, deps) {
  const { h, clear, authHeaders, renderNotAuthorized, money } = deps;

  async function api(method, path, body) {
    const opts = { method, headers: authHeaders(body ? { 'Content-Type': 'application/json' } : {}) };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    if (res.status === 401) return { unauthorized: true };
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  }
  const chip = (label, color) => h('span', { style: `font-family:var(--mono,monospace);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:${color};border:1px solid ${color}55;border-radius:999px;padding:3px 9px;white-space:nowrap` }, label);
  const panel = (title) => h('div', { class: 'admin-card', style: 'margin-top:16px' }, h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#10b981' }, title), h('span', { class: 'line' })));

  function drawList() {
    clear(root);
    const wrap = h('div', {});
    wrap.appendChild(h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#10b981' }, 'clients · everyone'), h('span', { class: 'line' })));
    wrap.appendChild(h('h1', { class: 'sec-title' }, 'Clients'));
    const listMount = h('div', { style: 'margin-top:20px' });
    wrap.appendChild(listMount);
    root.appendChild(wrap);
    api('GET', '/api/clients').then((r) => {
      if (r.unauthorized) { renderNotAuthorized(root); return; }
      if (!r.json || !r.json.ok) { listMount.appendChild(h('p', { class: 'subtle', style: 'color:#F59E0B' }, "Couldn't load clients — refresh to retry.")); return; }
      const clients = r.json.clients || [];
      if (!clients.length) { listMount.appendChild(h('p', { class: 'subtle' }, 'No clients yet — they appear here as prospects and deals come in.')); return; }
      for (const cl of clients) {
        const row = h('button', { type: 'button', class: 'admin-card', style: 'width:100%;text-align:left;display:flex;align-items:center;gap:14px;margin-top:10px;cursor:pointer;flex-wrap:wrap' },
          h('div', { style: 'flex:1;min-width:180px' },
            h('div', { style: 'font-size:15px' }, cl.name || cl.email || 'Unknown'),
            h('div', { class: 'mono', style: 'font-size:11px;color:var(--faint)' }, `${cl.company ? cl.company + ' · ' : ''}${cl.email || ''}`)),
          chip(cl.stage || 'new', STAGE_COLOR[cl.stage] || '#8E8882'),
          h('span', { class: 'mono', style: 'font-size:11px;color:var(--faint)' }, fmtDay(cl.updated_at)));
        row.addEventListener('click', () => drawDetail(cl.id));
        listMount.appendChild(row);
      }
    });
  }

  function drawDetail(id) {
    clear(root);
    const back = h('button', { type: 'button', class: 'btn-ghost', style: 'padding:6px 12px;font-size:12px;margin-bottom:8px' }, '← All clients');
    back.addEventListener('click', drawList);
    root.appendChild(back);
    const mount = h('div', {});
    root.appendChild(mount);
    mount.appendChild(h('p', { class: 'subtle', style: 'padding-top:20px' }, 'Loading client…'));

    api('GET', `/api/clients?id=${encodeURIComponent(id)}`).then((r) => {
      if (r.unauthorized) { renderNotAuthorized(root); return; }
      clear(mount);
      if (r.status === 404) { mount.appendChild(h('p', { class: 'subtle' }, 'Client not found.')); return; }
      if (!r.json || !r.json.ok) { mount.appendChild(h('p', { class: 'subtle', style: 'color:#F59E0B' }, "Couldn't load this client — refresh to retry.")); return; }
      const { prospect, proposals, projects, contracts, files, events, money: m } = r.json.client;

      mount.appendChild(h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#10b981' }, 'client · 360'), h('span', { class: 'line' })));
      mount.appendChild(h('div', { style: 'display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-top:4px' },
        h('h1', { class: 'sec-title', style: 'margin:0' }, prospect.name || prospect.email || 'Client'),
        chip(prospect.stage || 'new', STAGE_COLOR[prospect.stage] || '#8E8882')));
      mount.appendChild(h('div', { class: 'mono', style: 'font-size:12px;color:var(--faint);margin-top:6px' }, `${prospect.company ? prospect.company + ' · ' : ''}${prospect.email || ''}${prospect.source ? ' · via ' + prospect.source : ''}`));

      // money strip
      const stat = (n, l, color) => h('div', { class: 'stat' }, h('div', { class: 'n', style: color ? `color:${color}` : '' }, n), h('div', { class: 'l' }, l));
      mount.appendChild(h('div', { class: 'stat-row' },
        stat(money(m.collectedCents), 'Collected', '#10b981'),
        stat(money(m.outstandingCents), 'Outstanding', '#F59E0B'),
        stat(String(m.wonCount), 'Deals won')));

      // deals
      const dealsP = panel('deals');
      if (!proposals.length) dealsP.appendChild(h('p', { class: 'subtle', style: 'font-size:13px' }, 'No proposals yet.'));
      for (const p of proposals) {
        const paidTxt = p.balance_paid_at ? `paid in full · ${fmtDay(p.balance_paid_at)}` : (p.paid_at ? `deposit paid · ${fmtDay(p.paid_at)}` : 'unpaid');
        dealsP.appendChild(h('div', { style: 'display:flex;align-items:center;gap:12px;padding:8px 0;border-top:1px solid #17171d;flex-wrap:wrap' },
          h('span', { class: 'mono', style: 'font-size:11px;color:var(--faint);width:96px' }, p.public_id),
          chip(p.status || 'draft', PROP_COLOR[p.status] || '#8E8882'),
          h('span', { style: 'flex:1' }, ''),
          h('span', { class: 'mono', style: 'font-size:12px' }, money(p.firm_cents)),
          h('span', { class: 'mono', style: 'font-size:11px;color:var(--faint)' }, paidTxt)));
      }
      mount.appendChild(dealsP);

      // projects + deliverables
      const projP = panel('projects & deliverables');
      if (!projects.length) projP.appendChild(h('p', { class: 'subtle', style: 'font-size:13px' }, 'No active project yet (starts on deposit).'));
      for (const pj of projects) {
        const pjFiles = files.filter((f) => f.project_id === pj.id);
        const head = h('div', { style: 'display:flex;align-items:center;gap:12px;padding:8px 0;border-top:1px solid #17171d;flex-wrap:wrap' },
          chip(pj.status || 'active', '#22d3ee'),
          h('span', { style: 'flex:1' }, `${pjFiles.length} file${pjFiles.length === 1 ? '' : 's'}`));
        if (pj.portal_token) { const a = h('a', { href: `portal.html?id=${encodeURIComponent(pj.portal_token)}`, target: '_blank', rel: 'noopener', style: 'font-size:12px;color:#22d3ee' }, 'open portal ↗'); head.appendChild(a); }
        projP.appendChild(head);
        for (const f of pjFiles.slice(0, 8)) projP.appendChild(h('div', { style: 'font-size:12.5px;color:var(--dim);padding:3px 0 3px 12px' }, '· ' + f.name));
      }
      mount.appendChild(projP);

      // contract
      const conP = panel('contract');
      if (!contracts.length) conP.appendChild(h('p', { class: 'subtle', style: 'font-size:13px' }, 'No contract generated yet.'));
      for (const ct of contracts) conP.appendChild(h('div', { style: 'display:flex;align-items:center;gap:12px;padding:6px 0' },
        chip(ct.status || 'draft', ct.status === 'accepted' ? '#10b981' : '#22d3ee'),
        h('span', { class: 'mono', style: 'font-size:11px;color:var(--faint)' }, ct.accepted_at ? `signed ${fmtDay(ct.accepted_at)}` : ct.public_id)));
      mount.appendChild(conP);

      // notes + links (editable)
      const metaP = panel('notes & links');
      const notesTa = h('textarea', { rows: '4', placeholder: 'Private notes about this client…', style: 'width:100%;box-sizing:border-box;background:#0d0d11;border:1px solid #23232b;border-radius:8px;color:#e5e5ea;font-family:inherit;font-size:13.5px;padding:10px 12px;resize:vertical' });
      if (prospect.notes) notesTa.value = prospect.notes;
      metaP.appendChild(h('label', { class: 'mono', style: 'font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);display:block;margin-bottom:6px' }, 'Notes'));
      metaP.appendChild(notesTa);
      metaP.appendChild(h('label', { class: 'mono', style: 'font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);display:block;margin:16px 0 6px' }, 'Links (GitHub / Drive / Figma…)'));
      const linksMount = h('div', {});
      metaP.appendChild(linksMount);
      const inStyle = 'background:#0d0d11;border:1px solid #23232b;border-radius:6px;color:#e5e5ea;font-family:inherit;font-size:12.5px;padding:7px 9px';
      function linkRow(l) {
        const label = h('input', { type: 'text', placeholder: 'label', value: (l && l.label) || '', style: inStyle + ';width:130px' });
        const url = h('input', { type: 'url', placeholder: 'https://…', value: (l && l.url) || '', style: inStyle + ';flex:1;min-width:160px' });
        const rm = h('button', { type: 'button', class: 'btn-ghost', style: 'padding:4px 9px;font-size:11px;color:#f87171' }, '✕');
        const rowEl = h('div', { style: 'display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap' }, label, url, rm);
        rowEl._get = () => ({ label: label.value.trim(), url: url.value.trim() });
        rm.addEventListener('click', () => rowEl.remove());
        return rowEl;
      }
      (Array.isArray(prospect.links) && prospect.links.length ? prospect.links : []).forEach((l) => linksMount.appendChild(linkRow(l)));
      const addLink = h('button', { type: 'button', class: 'btn-ghost', style: 'padding:5px 11px;font-size:12px' }, '+ link');
      addLink.addEventListener('click', () => linksMount.appendChild(linkRow()));
      const saveBtn = h('button', { type: 'button', class: 'btn-solid green', style: 'padding:8px 16px;font-size:13px' }, 'Save');
      const saveStatus = h('span', { class: 'subtle', style: 'font-size:12px;margin-left:10px' }, '');
      saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true; clear(saveStatus); saveStatus.appendChild(document.createTextNode('Saving…'));
        const links = [...linksMount.children].map((c) => c._get()).filter((l) => l.label && /^https?:\/\//i.test(l.url));
        const rr = await api('POST', '/api/clients', { action: 'update_meta', id, notes: notesTa.value.trim(), links });
        saveBtn.disabled = false; clear(saveStatus);
        saveStatus.appendChild(document.createTextNode(rr.json && rr.json.ok ? 'Saved ✓' : 'Could not save'));
      });
      metaP.appendChild(h('div', { style: 'display:flex;align-items:center;gap:6px;margin-top:4px' }, addLink));
      metaP.appendChild(h('div', { style: 'display:flex;align-items:center;margin-top:14px' }, saveBtn, saveStatus));
      mount.appendChild(metaP);

      // timeline
      const tlP = panel('activity');
      if (!events.length) tlP.appendChild(h('p', { class: 'subtle', style: 'font-size:13px' }, 'No activity logged yet.'));
      for (const e of events.slice(0, 20)) {
        const note = e.meta && e.meta.note ? ' — ' + e.meta.note : '';
        tlP.appendChild(h('div', { style: 'display:flex;gap:12px;padding:5px 0;font-size:12.5px' },
          h('span', { class: 'mono', style: 'font-size:11px;color:var(--faint);width:110px;flex:none' }, fmtDay(e.created_at)),
          h('span', { style: 'color:var(--dim)' }, String(e.type || '').replace(/_/g, ' ') + note)));
      }
      mount.appendChild(tlP);
    });
  }

  drawList();
}
