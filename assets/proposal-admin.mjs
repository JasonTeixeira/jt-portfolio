// Operator console for the proposal pipeline. Reads an admin token from the URL,
// sends it as x-admin-token on every call, and renders whatever the API returns.
// All dynamic values (client email, scope notes, etc.) go through textContent —
// never innerHTML — since this data is client-editable.
import { depositCents, balanceCents, money, PROPOSAL_STATUS } from './proposal-core.mjs';

const STATUS_META = {
  [PROPOSAL_STATUS.DRAFT]: { label: 'Draft', color: '#F59E0B' },
  [PROPOSAL_STATUS.APPROVED]: { label: 'Approved', color: '#22d3ee' },
  [PROPOSAL_STATUS.PAID]: { label: 'Paid', color: '#10b981' },
  [PROPOSAL_STATUS.EXPIRED]: { label: 'Expired', color: '#8E8882' },
  [PROPOSAL_STATUS.DECLINED]: { label: 'Declined', color: '#f43f5e' },
};

const CONTRACT_STATUS_META = {
  draft: { label: 'Draft', color: '#8E8882' },
  sent: { label: 'Sent', color: '#22d3ee' },
  accepted: { label: 'Accepted', color: '#10b981' },
  declined: { label: 'Declined', color: '#f43f5e' },
};

const MILESTONE_STATUS_META = {
  pending: { label: 'Pending', color: '#8E8882' },
  in_progress: { label: 'In progress', color: '#F59E0B' },
  delivered: { label: 'Delivered', color: '#22d3ee' },
  approved: { label: 'Approved', color: '#10b981' },
};

function h(tag, props, ...children) {
  const node = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else node.setAttribute(k, v);
    }
  }
  for (const c of children.flat(Infinity)) {
    if (c === undefined || c === null || c === false) continue;
    node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return node;
}

function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

function copyButton(text) {
  const btn = h('button', { type: 'button', class: 'btn-ghost', style: 'padding:5px 10px;font-size:11.5px' }, 'Copy');
  btn.addEventListener('click', () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => { btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = 'Copy'; }, 1500); })
        .catch(() => {});
    }
  });
  return btn;
}

function chipFor(status, metaMap) {
  const meta = metaMap[status] || { label: status || 'unknown', color: '#8E8882' };
  return h('span', { class: 'chip', style: `color:${meta.color};border-color:${meta.color}44` },
    h('span', { class: 'dot', style: `background:${meta.color}` }),
    meta.label,
  );
}

function statusChip(status) { return chipFor(status, STATUS_META); }
function contractStatusChip(status) { return chipFor(status, CONTRACT_STATUS_META); }
function milestoneStatusChip(status) { return chipFor(status, MILESTONE_STATUS_META); }

function formatAge(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const days = Math.floor((Date.now() - t) / 864e5);
  if (days <= 0) return 'today';
  if (days === 1) return '1d ago';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function renderNotAuthorized(root) {
  clear(root);
  root.appendChild(h('div', { class: 'admin-card' },
    h('h1', { class: 'sec-title', style: 'font-size:1.8rem;margin-top:0' }, 'Not authorized.'),
  ));
}

function renderUnconfigured(root) {
  clear(root);
  root.appendChild(h('div', { class: 'admin-card' },
    h('h1', { class: 'sec-title', style: 'font-size:1.8rem;margin-top:0' }, 'Proposals aren’t connected yet.'),
    h('p', { class: 'subtle' }, 'The backend isn’t configured on this environment.'),
  ));
}

async function apiGet(path, key) {
  const res = await fetch(path, { headers: { 'x-admin-token': key } });
  if (res.status === 401) return { unauthorized: true };
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

function renderList(root, list, key) {
  clear(root);

  const counts = { [PROPOSAL_STATUS.DRAFT]: 0, [PROPOSAL_STATUS.APPROVED]: 0, [PROPOSAL_STATUS.PAID]: 0 };
  for (const p of list) if (p.status in counts) counts[p.status] += 1;

  const wrap = h('div', {});
  wrap.appendChild(h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#22d3ee' }, 'proposal pipeline'), h('span', { class: 'line' })));
  wrap.appendChild(h('h1', { class: 'sec-title' }, 'Proposals'));

  wrap.appendChild(h('div', { class: 'stat-row' },
    h('div', { class: 'stat' }, h('div', { class: 'n' }, String(counts[PROPOSAL_STATUS.DRAFT])), h('div', { class: 'l' }, 'Drafts pending')),
    h('div', { class: 'stat' }, h('div', { class: 'n' }, String(counts[PROPOSAL_STATUS.APPROVED])), h('div', { class: 'l' }, 'Approved, unpaid')),
    h('div', { class: 'stat' }, h('div', { class: 'n' }, String(counts[PROPOSAL_STATUS.PAID])), h('div', { class: 'l' }, 'Paid')),
  ));

  const detailMount = h('div', { id: 'admin-detail-mount' });

  const tbody = h('tbody');
  if (list.length === 0) {
    tbody.appendChild(h('tr', {}, h('td', { colspan: '5', class: 'subtle' }, 'No proposals yet.')));
  }
  for (const row of list) {
    const openBtn = h('button', { type: 'button', class: 'btn-ghost', style: 'padding:6px 12px;font-size:12px' }, 'Open');
    openBtn.addEventListener('click', () => openDetail(detailMount, row.id, key));
    tbody.appendChild(h('tr', {},
      h('td', {}, statusChip(row.status)),
      h('td', { class: 'mono' }, typeof row.firm_cents === 'number' ? money(row.firm_cents, row.currency || 'usd') : '—'),
      h('td', {}, row.client_email || '—'),
      h('td', { class: 'mono', style: 'color:var(--faint)' }, formatAge(row.created_at)),
      h('td', {}, openBtn),
    ));
  }

  wrap.appendChild(h('div', { class: 'admin-card' },
    h('div', { style: 'overflow-x:auto' },
      h('table', { class: 'admin-table' },
        h('thead', {}, h('tr', {},
          h('th', {}, 'Status'), h('th', {}, 'Firm price'), h('th', {}, 'Client'), h('th', {}, 'Created'), h('th', {}, ''),
        )),
        tbody,
      ),
    ),
  ));

  wrap.appendChild(detailMount);
  root.appendChild(wrap);
}

async function openDetail(mount, id, key) {
  clear(mount);
  mount.appendChild(h('div', { class: 'admin-card' }, h('p', { class: 'subtle' }, 'Loading…')));

  let result;
  try {
    result = await apiGet(`/api/proposal-admin?id=${encodeURIComponent(id)}`, key);
  } catch {
    clear(mount);
    mount.appendChild(h('div', { class: 'admin-card' }, h('p', { class: 'subtle' }, 'Couldn’t reach the server.')));
    return;
  }
  if (result.unauthorized || !result.json || !result.json.ok || !result.json.proposal) {
    clear(mount);
    mount.appendChild(h('div', { class: 'admin-card' }, h('p', { class: 'subtle' }, 'Couldn’t load that proposal.')));
    return;
  }
  const { proposal, project, milestones, contracts } = result.json;
  renderDetail(mount, proposal, key, project || null, Array.isArray(milestones) ? milestones : [], Array.isArray(contracts) ? contracts : []);
}

// ---- Contracts (generate + send) -------------------------------------------

function contractRow(c, key) {
  const link = `${location.origin}/contract.html?id=${c.public_id}`;
  const row = h('div', { style: 'display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)' },
    h('span', { class: 'chip mono' }, c.kind === 'msa' ? 'MSA' : 'SOW'),
    contractStatusChip(c.status),
    h('a', { href: link, style: 'color:var(--cyan);font-size:12.5px;word-break:break-all' }, link),
    copyButton(link),
  );
  if (c.status === 'draft') {
    const sendBtn = h('button', { type: 'button', class: 'btn-solid cyan', style: 'padding:5px 12px;font-size:11.5px' }, 'Send to client');
    sendBtn.addEventListener('click', () => {
      sendBtn.disabled = true;
      sendBtn.textContent = 'Sending…';
      fetch('/api/contract-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': key },
        body: JSON.stringify({ id: c.id }),
      })
        .then((res) => res.json().catch(() => null))
        .then((data) => {
          if (data && data.ok) {
            const note = document.createTextNode('Sent.');
            sendBtn.replaceWith(note);
          } else {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send to client';
          }
        })
        .catch(() => {
          sendBtn.disabled = false;
          sendBtn.textContent = 'Send to client';
        });
    });
    row.appendChild(sendBtn);
  }
  return row;
}

function renderContractsCard(row, key, contracts) {
  const list = h('div', { id: 'contracts-list' });
  for (const c of contracts) list.appendChild(contractRow(c, key));

  const status = h('p', { class: 'subtle', style: 'font-size:12.5px;margin-top:8px;min-height:14px' });

  function doGenerate(kind, btn) {
    clear(status);
    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = 'Generating…';
    fetch('/api/contract-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': key },
      body: JSON.stringify({ proposalId: row.id, kind }),
    })
      .then((res) => res.json().catch(() => null))
      .then((data) => {
        btn.disabled = false;
        btn.textContent = orig;
        if (data && data.ok && data.publicId) {
          list.insertBefore(contractRow({ id: data.id, public_id: data.publicId, kind, status: 'draft' }, key), list.firstChild);
        } else {
          clear(status);
          status.appendChild(document.createTextNode('Couldn’t generate that contract. Try again.'));
        }
      })
      .catch(() => {
        btn.disabled = false;
        btn.textContent = orig;
        clear(status);
        status.appendChild(document.createTextNode('Couldn’t reach the server.'));
      });
  }

  const genSow = h('button', { type: 'button', class: 'btn-ghost' }, 'Generate SOW');
  const genMsa = h('button', { type: 'button', class: 'btn-ghost' }, 'Generate MSA');
  genSow.addEventListener('click', () => doGenerate('sow', genSow));
  genMsa.addEventListener('click', () => doGenerate('msa', genMsa));

  return h('div', { class: 'admin-card' },
    h('h2', { class: 'sec-title', style: 'font-size:1.5rem;margin-top:0' }, 'Contracts'),
    h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;margin-top:10px' }, genSow, genMsa),
    status,
    list,
  );
}

// ---- Milestones (add + mark delivered) -------------------------------------

function milestoneRow(m, key) {
  const row = h('div', { style: 'display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)' },
    h('span', { class: 'mono', style: 'color:var(--faint);font-size:11.5px;min-width:18px' }, String(m.seq ?? 0)),
    h('span', { style: 'flex:1 1 160px' }, m.title || '—'),
    h('span', { class: 'mono' }, money(m.amount_cents || 0)),
    milestoneStatusChip(m.status || 'pending'),
  );
  if (m.status === 'pending' || m.status === 'in_progress' || !m.status) {
    const btn = h('button', { type: 'button', class: 'btn-ghost', style: 'padding:5px 10px;font-size:11.5px' }, 'Mark delivered');
    btn.addEventListener('click', () => {
      btn.disabled = true;
      btn.textContent = 'Marking…';
      fetch('/api/milestone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': key },
        body: JSON.stringify({ id: m.id, action: 'deliver' }),
      })
        .then((res) => res.json().catch(() => null))
        .then((data) => {
          if (data && data.ok) {
            btn.replaceWith(milestoneStatusChip('delivered'));
          } else {
            btn.disabled = false;
            btn.textContent = 'Mark delivered';
          }
        })
        .catch(() => {
          btn.disabled = false;
          btn.textContent = 'Mark delivered';
        });
    });
    row.appendChild(btn);
  }
  return row;
}

function renderMilestonesCard(project, milestones, key) {
  if (!project) {
    return h('div', { class: 'admin-card' },
      h('h2', { class: 'sec-title', style: 'font-size:1.5rem;margin-top:0' }, 'Milestones'),
      h('p', { class: 'subtle', style: 'margin-top:10px' }, 'Milestones open once the deposit is paid.'),
    );
  }

  const sorted = milestones.slice().sort((a, b) => (a.seq || 0) - (b.seq || 0));
  const list = h('div', { id: 'milestones-list' });
  for (const m of sorted) list.appendChild(milestoneRow(m, key));

  const titleInput = h('input', { type: 'text', placeholder: 'e.g. Kickoff & discovery' });
  const deliverablesInput = h('textarea', { rows: '2', placeholder: 'What gets delivered' });
  const amountInput = h('input', { type: 'number', min: '0', step: '1', placeholder: '0' });
  const seqInput = h('input', { type: 'number', min: '0', step: '1', value: String(sorted.length) });
  const dueInput = h('input', { type: 'date' });
  const addStatus = h('p', { class: 'subtle', style: 'font-size:12.5px;margin-top:8px;min-height:14px' });
  const addBtn = h('button', { type: 'button', class: 'btn-solid green' }, 'Add milestone');

  addBtn.addEventListener('click', () => {
    const title = titleInput.value.trim();
    clear(addStatus);
    if (!title) { addStatus.appendChild(document.createTextNode('Title is required.')); return; }
    addBtn.disabled = true;
    addBtn.textContent = 'Adding…';
    const amountCents = Math.round((parseFloat(amountInput.value) || 0) * 100);
    const seq = Math.round(parseFloat(seqInput.value) || 0);
    const dueAt = dueInput.value ? new Date(`${dueInput.value}T23:59:59`).toISOString() : undefined;
    fetch('/api/milestone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': key },
      body: JSON.stringify({ projectId: project.id, title, deliverables: deliverablesInput.value, amountCents, seq, dueAt }),
    })
      .then((res) => res.json().catch(() => null))
      .then((data) => {
        addBtn.disabled = false;
        addBtn.textContent = 'Add milestone';
        if (data && data.ok && data.milestone) {
          list.appendChild(milestoneRow(data.milestone, key));
          titleInput.value = '';
          deliverablesInput.value = '';
          amountInput.value = '';
          dueInput.value = '';
          seqInput.value = String(sorted.length + 1);
        } else {
          clear(addStatus);
          addStatus.appendChild(document.createTextNode('Couldn’t add that milestone. Try again.'));
        }
      })
      .catch(() => {
        addBtn.disabled = false;
        addBtn.textContent = 'Add milestone';
        clear(addStatus);
        addStatus.appendChild(document.createTextNode('Couldn’t reach the server.'));
      });
  });

  return h('div', { class: 'admin-card' },
    h('h2', { class: 'sec-title', style: 'font-size:1.5rem;margin-top:0' }, 'Milestones'),
    list,
    h('div', { style: 'border-top:1px solid var(--line);margin-top:16px;padding-top:16px' },
      h('div', { class: 'grid2' },
        h('label', { class: 'fld' }, h('span', { class: 'lbl-text' }, 'Title'), titleInput),
        h('label', { class: 'fld' }, h('span', { class: 'lbl-text' }, 'Amount ($)'), amountInput),
      ),
      h('label', { class: 'fld' }, h('span', { class: 'lbl-text' }, 'Deliverables'), deliverablesInput),
      h('div', { class: 'grid2' },
        h('label', { class: 'fld' }, h('span', { class: 'lbl-text' }, 'Seq'), seqInput),
        h('label', { class: 'fld' }, h('span', { class: 'lbl-text' }, 'Due date (optional)'), dueInput),
      ),
      addBtn,
      addStatus,
    ),
  );
}

function renderDetail(mount, row, key, project, milestones, contracts) {
  clear(mount);
  const currency = row.currency || 'usd';

  const firmInput = h('input', { type: 'number', min: '0', step: '1', value: String(Math.round((row.firm_cents || 0) / 100)) });
  const pctInput = h('input', { type: 'number', min: '0', max: '100', step: '1', value: String(Math.round((row.deposit_pct || 0.3) * 100)) });
  const noteInput = h('textarea', { rows: '3' });
  noteInput.value = row.scope_note || '';
  const expiryInput = h('input', { type: 'date', value: row.expires_at ? String(row.expires_at).slice(0, 10) : '' });

  const depositOut = h('span', { class: 'val mono' }, '—');
  const balanceOut = h('span', { class: 'val mono' }, '—');

  function recompute() {
    const firmCents = Math.round((parseFloat(firmInput.value) || 0) * 100);
    const pct = Math.max(0, Math.min(100, parseFloat(pctInput.value) || 0)) / 100;
    const dep = depositCents(firmCents, pct);
    const bal = balanceCents(firmCents, dep);
    depositOut.textContent = money(dep, currency);
    balanceOut.textContent = money(bal, currency);
  }
  firmInput.addEventListener('input', recompute);
  pctInput.addEventListener('input', recompute);
  recompute();

  const status = h('div', { class: 'prop-status mono', style: 'margin-top:12px;font-size:12.5px;color:var(--faint);min-height:16px' });
  const approveBtn = h('button', { type: 'button', class: 'btn-solid green' }, 'Approve');

  approveBtn.addEventListener('click', () => {
    clear(status);
    approveBtn.disabled = true;
    approveBtn.textContent = 'Approving…';
    const firmCents = Math.round((parseFloat(firmInput.value) || 0) * 100);
    const depositPct = Math.max(0, Math.min(100, parseFloat(pctInput.value) || 0)) / 100;
    const expiresAt = expiryInput.value ? new Date(`${expiryInput.value}T23:59:59`).toISOString() : undefined;

    fetch('/api/proposal-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': key },
      body: JSON.stringify({ id: row.id, firmCents, depositPct, scopeNote: noteInput.value, expiresAt }),
    })
      .then((res) => res.json().catch(() => null))
      .then((data) => {
        approveBtn.disabled = false;
        approveBtn.textContent = 'Approve';
        if (data && data.ok && data.publicId) {
          const link = `${location.origin}/proposal.html?id=${data.publicId}`;
          clear(status);
          const linkRow = h('div', { style: 'margin-top:4px;display:flex;gap:10px;align-items:center;flex-wrap:wrap' });
          linkRow.appendChild(document.createTextNode('Approved. Client link: '));
          const linkEl = h('a', { href: link, style: 'color:var(--cyan)' }, link);
          linkRow.appendChild(linkEl);
          const copyBtn = h('button', { type: 'button', class: 'btn-ghost', style: 'padding:6px 12px;font-size:12px' }, 'Copy');
          copyBtn.addEventListener('click', () => {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(link).then(() => { copyBtn.textContent = 'Copied'; setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500); }).catch(() => {});
            }
          });
          linkRow.appendChild(copyBtn);
          status.appendChild(linkRow);
        } else {
          clear(status);
          status.appendChild(document.createTextNode('Approve didn’t go through. Try again.'));
        }
      })
      .catch(() => {
        approveBtn.disabled = false;
        approveBtn.textContent = 'Approve';
        clear(status);
        status.appendChild(document.createTextNode('Couldn’t reach the server.'));
      });
  });

  const stateNote = h('p', { class: 'subtle', style: 'font-size:12.5px;margin-top:10px' },
    row.accepted_at ? `Accepted by ${row.accepted_name || 'client'} on ${new Date(row.accepted_at).toLocaleDateString('en-US')}. ` : 'Not yet accepted. ',
    row.paid_at ? `Paid on ${new Date(row.paid_at).toLocaleDateString('en-US')}.` : 'Not yet paid.',
  );

  mount.appendChild(h('div', { class: 'admin-card' },
    h('h2', { class: 'sec-title', style: 'font-size:1.5rem;margin-top:0' }, 'Edit & approve'),
    h('div', { class: 'grid2', style: 'margin-top:16px' },
      h('label', { class: 'fld' }, h('span', { class: 'lbl-text' }, 'Firm price ($)'), firmInput),
      h('label', { class: 'fld' }, h('span', { class: 'lbl-text' }, 'Deposit (%)'), pctInput),
    ),
    h('label', { class: 'fld' }, h('span', { class: 'lbl-text' }, 'Scope note'), noteInput),
    h('label', { class: 'fld' }, h('span', { class: 'lbl-text' }, 'Expiry'), expiryInput),
    h('div', { class: 'price-row', style: 'border-top:1px solid var(--line);padding-top:10px' }, h('span', { class: 'lbl' }, 'Deposit'), depositOut),
    h('div', { class: 'price-row' }, h('span', { class: 'lbl' }, 'Balance'), balanceOut),
    approveBtn,
    status,
    stateNote,
  ));

  mount.appendChild(renderContractsCard(row, key, contracts));
  mount.appendChild(renderMilestonesCard(project, milestones, key));
}

async function init() {
  const root = document.getElementById('admin-root');
  if (!root) return;

  const key = (new URLSearchParams(location.search).get('key') || '').trim();
  if (!key) { renderNotAuthorized(root); return; }

  let result;
  try {
    result = await apiGet('/api/proposal-admin?list=1', key);
  } catch {
    renderNotAuthorized(root);
    return;
  }
  if (result.unauthorized) { renderNotAuthorized(root); return; }
  if (!result.json || !result.json.ok) { renderUnconfigured(root); return; }
  renderList(root, Array.isArray(result.json.list) ? result.json.list : [], key);
}

init().catch(() => {
  const root = document.getElementById('admin-root');
  if (root) renderNotAuthorized(root);
});
