// Operator console for the proposal pipeline. Reads an admin token from the URL,
// sends it as x-admin-token on every call, and renders whatever the API returns.
// All dynamic values (client email, scope notes, etc.) go through textContent —
// never innerHTML — since this data is client-editable.
import { depositCents, balanceCents, money, PROPOSAL_STATUS } from './proposal-core.mjs';
import { getSession } from './auth.mjs';
import { renderCalendar as renderCalendarView } from './admin-calendar.mjs';
import { renderTasks as renderTasksView } from './admin-tasks.mjs';
import { renderMoneyBody } from './admin-money.mjs';

// Admin auth: a logged-in operator (Supabase JWT, sent as Bearer) OR the break-glass
// ?key token (sent as x-admin-token). authHeaders() attaches whichever we have.
let AUTH = null;
function authHeaders(extra) {
  const h = extra ? { ...extra } : {};
  if (AUTH && AUTH.mode === 'jwt') h.Authorization = 'Bearer ' + AUTH.value;
  else if (AUTH && AUTH.mode === 'key') h['x-admin-token'] = AUTH.value;
  return h;
}

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

function renderLoginPrompt(root) {
  clear(root);
  root.appendChild(h('div', { class: 'admin-card' },
    h('h1', { class: 'sec-title', style: 'font-size:1.8rem;margin-top:0' }, 'Operator sign-in required'),
    h('p', { class: 'subtle' }, 'Log in with your operator account to open the cockpit.'),
    h('a', { href: 'login.html?next=proposal-admin.html', class: 'btn-solid green', style: 'display:inline-flex;margin-top:14px;padding:10px 18px;text-decoration:none' }, 'Log in →'),
  ));
}

function renderUnconfigured(root) {
  clear(root);
  root.appendChild(h('div', { class: 'admin-card' },
    h('h1', { class: 'sec-title', style: 'font-size:1.8rem;margin-top:0' }, 'Proposals aren’t connected yet.'),
    h('p', { class: 'subtle' }, 'The backend isn’t configured on this environment.'),
  ));
}

async function apiGet(path) {
  const res = await fetch(path, { headers: authHeaders() });
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

function contractRow(c) {
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
        headers: authHeaders({ 'Content-Type': 'application/json' }),
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
      headers: authHeaders({ 'Content-Type': 'application/json' }),
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

function milestoneRow(m) {
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
        headers: authHeaders({ 'Content-Type': 'application/json' }),
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
      headers: authHeaders({ 'Content-Type': 'application/json' }),
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
      headers: authHeaders({ 'Content-Type': 'application/json' }),
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
  mount.appendChild(renderDeliverablesCard(project, key));
  mount.appendChild(renderMessagesCard(project, key));
}

// ---- Deliverable files (operator: upload / list / delete) -------------------
function fmtBytes(n) { if (!n && n !== 0) return ''; if (n < 1024) return n + ' B'; if (n < 1048576) return (n / 1024).toFixed(0) + ' KB'; return (n / 1048576).toFixed(1) + ' MB'; }
function renderDeliverablesCard(project, key) {
  const card = h('div', { class: 'admin-card', style: 'margin-top:16px' });
  card.appendChild(h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#a78bfa' }, 'Deliverable files'), h('span', { class: 'line' })));
  if (!project) { card.appendChild(h('p', { class: 'subtle' }, 'Files can be shared once a project exists.')); return card; }
  const list = h('div', { style: 'display:flex;flex-direction:column;gap:8px;margin:12px 0' });
  const empty = h('p', { class: 'subtle', style: 'font-size:13px' }, 'No files uploaded yet.');
  function fileRow(f) {
    const del = h('button', { type: 'button', class: 'btn-ghost', style: 'padding:4px 10px;font-size:11px;border-color:#f43f5e;color:#f43f5e' }, 'Delete');
    const rowEl = h('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--line);border-radius:10px;padding:9px 13px;background:#0F0F13' },
      h('div', { style: 'min-width:0' },
        f.url ? h('a', { href: f.url, target: '_blank', rel: 'noopener', style: 'color:#22d3ee;font-size:13.5px;word-break:break-word' }, f.name) : h('span', { style: 'font-size:13.5px' }, f.name),
        h('div', { class: 'mono', style: 'font-size:10.5px;color:var(--faint);margin-top:2px' }, [fmtBytes(f.size_bytes), f.content_type].filter(Boolean).join(' · '))),
      del);
    del.addEventListener('click', () => {
      if (!window.confirm('Delete this file? The client will no longer see it.')) return;
      del.disabled = true;
      fetch('/api/deliverables', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ action: 'delete', projectId: project.id, id: f.id }) })
        .then((r) => r.json().catch(() => null)).then((d) => { if (d && d.ok) rowEl.remove(); else del.disabled = false; }).catch(() => { del.disabled = false; });
    });
    return rowEl;
  }
  function load() {
    apiGet(`/api/deliverables?projectId=${encodeURIComponent(project.id)}`, key).then((r) => {
      const files = r.json && r.json.ok ? (r.json.files || []) : [];
      clear(list);
      if (!files.length) list.appendChild(empty); else files.forEach((f) => list.appendChild(fileRow(f)));
    }).catch(() => {});
  }
  card.appendChild(list);
  const fileInput = h('input', { type: 'file', style: 'font-size:12px;color:var(--faint)' });
  const upBtn = h('button', { type: 'button', class: 'btn-solid green', style: 'padding:8px 16px;font-size:13px;margin-left:8px' }, 'Upload');
  const upStatus = h('span', { class: 'subtle', style: 'font-size:12px;margin-left:10px' }, '');
  upBtn.addEventListener('click', async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) { clear(upStatus); upStatus.appendChild(document.createTextNode('Choose a file first.')); return; }
    upBtn.disabled = true; clear(upStatus); upStatus.appendChild(document.createTextNode('Uploading…'));
    try {
      const signResp = await fetch('/api/deliverables', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ action: 'signUpload', projectId: project.id, filename: file.name }) }).then((r) => r.json().catch(() => null));
      if (!signResp || !signResp.ok || !signResp.signedUrl) throw new Error('sign');
      const put = await fetch(signResp.signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
      if (!put.ok) throw new Error('put');
      const reg = await fetch('/api/deliverables', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ action: 'register', projectId: project.id, name: file.name, storagePath: signResp.path, sizeBytes: file.size, contentType: file.type || null }) }).then((r) => r.json().catch(() => null));
      if (!reg || !reg.ok) throw new Error('register');
      fileInput.value = ''; clear(upStatus); upBtn.disabled = false; load();
    } catch { upBtn.disabled = false; clear(upStatus); upStatus.appendChild(document.createTextNode('Upload failed. Try again.')); }
  });
  card.appendChild(h('div', { style: 'display:flex;align-items:center;flex-wrap:wrap;gap:6px' }, fileInput, upBtn, upStatus));
  load();
  return card;
}

// ---- Messages (operator side of the client thread) -------------------------
function renderMessagesCard(project, key) {
  const card = h('div', { class: 'admin-card', style: 'margin-top:16px' });
  card.appendChild(h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#22d3ee' }, 'Messages'), h('span', { class: 'line' })));
  if (!project) { card.appendChild(h('p', { class: 'subtle' }, 'Messages open once the deposit is paid and a project exists.')); return card; }
  const thread = h('div', { style: 'display:flex;flex-direction:column;gap:10px;margin:12px 0' });
  const empty = h('p', { class: 'subtle', style: 'font-size:13px' }, 'No messages yet.');
  function bubble(m) {
    const mine = m.sender === 'operator';
    return h('div', { style: `align-self:${mine ? 'flex-end' : 'flex-start'};max-width:82%;border:1px solid var(--line);border-radius:14px;padding:9px 13px;background:${mine ? 'rgba(16,185,129,0.08)' : '#0F0F13'}` },
      h('div', { style: 'font-family:var(--mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);margin-bottom:3px' }, mine ? 'You (Jason)' : 'Client'),
      h('div', { style: 'font-size:13.5px;line-height:1.55;color:var(--ink);white-space:pre-wrap' }, m.body),
      h('div', { class: 'mono', style: 'font-size:10px;color:var(--faint);margin-top:4px' }, formatAge(m.created_at)));
  }
  function load() {
    apiGet(`/api/messages?projectId=${encodeURIComponent(project.id)}`, key).then((r) => {
      const msgs = r.json && r.json.ok ? (r.json.messages || []) : [];
      clear(thread);
      if (!msgs.length) thread.appendChild(empty); else msgs.forEach((m) => thread.appendChild(bubble(m)));
    }).catch(() => {});
  }
  card.appendChild(thread);
  const ta = h('textarea', { rows: '3', placeholder: 'Reply to the client…', style: 'width:100%;box-sizing:border-box;background:#0F0F13;border:1px solid var(--line);border-radius:10px;color:var(--ink);font-family:inherit;font-size:13.5px;padding:10px 12px;resize:vertical' });
  const btn = h('button', { type: 'button', class: 'btn-solid green', style: 'margin-top:8px;padding:8px 16px;font-size:13px' }, 'Send reply');
  const st = h('span', { class: 'subtle', style: 'font-size:12px;margin-left:10px' }, '');
  btn.addEventListener('click', () => {
    const text = (ta.value || '').trim();
    if (text.length < 1) return;
    btn.disabled = true; clear(st); st.appendChild(document.createTextNode('Sending…'));
    fetch('/api/messages', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ projectId: project.id, body: text }) })
      .then((r) => r.json().catch(() => null)).then((d) => {
        btn.disabled = false; clear(st);
        if (d && d.ok) { if (thread.contains(empty)) clear(thread); thread.appendChild(bubble({ sender: 'operator', body: text, created_at: new Date().toISOString() })); ta.value = ''; }
        else { st.appendChild(document.createTextNode('Couldn’t send.')); }
      }).catch(() => { btn.disabled = false; clear(st); st.appendChild(document.createTextNode('Network error.')); });
  });
  card.appendChild(h('div', {}, ta, h('div', { style: 'display:flex;align-items:center' }, btn, st)));
  load();
  return card;
}

// ---- Pipeline / CRM (prospects) --------------------------------------------

const STAGE_META = {
  new:     { label: 'New',     color: '#8E8882' },
  scoped:  { label: 'Scoped',  color: '#22d3ee' },
  engaged: { label: 'Engaged', color: '#F59E0B' },
  won:     { label: 'Won',     color: '#10b981' },
  lost:    { label: 'Lost',    color: '#f43f5e' },
};
const STAGE_ORDER = ['new', 'scoped', 'engaged', 'won', 'lost'];
function stageChip(stage) { return chipFor(stage, STAGE_META); }

function postProspect(payload) {
  return fetch('/api/prospects', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  }).then((res) => res.json().catch(() => null));
}
function setStage(id, stage, key, lostReason) { return postProspect({ id, stage, lostReason }, key); }

// touch_email -> "Email", follow_up -> "Follow-up" — for the timeline + picker
const TOUCH_KINDS = ['email', 'dm', 'call', 'meeting', 'note', 'follow_up'];
const TOUCH_LABEL = { email: 'Email', dm: 'DM', call: 'Call', meeting: 'Meeting', note: 'Note', follow_up: 'Follow-up' };
function eventLabel(type) {
  if (typeof type === 'string' && type.indexOf('touch_') === 0) return TOUCH_LABEL[type.slice(6)] || type.slice(6);
  return type;
}

function prospectRow(p, key, onChanged) {
  const stageCell = h('td', {}, stageChip(p.stage || 'new'));
  const move = h('select', { class: 'mono', style: 'background:#0F0F13;border:1px solid var(--line);border-radius:8px;color:var(--ink);font-size:12px;padding:6px 8px' },
    ...STAGE_ORDER.map((s) => {
      const o = h('option', { value: s }, STAGE_META[s].label);
      if (s === (p.stage || 'new')) o.setAttribute('selected', 'selected');
      return o;
    }),
  );
  move.addEventListener('change', () => {
    const stage = move.value;
    let lostReason;
    if (stage === 'lost') { lostReason = (window.prompt('Reason lost? (optional)') || '').trim() || undefined; }
    move.disabled = true;
    setStage(p.id, stage, key, lostReason).then((data) => {
      move.disabled = false;
      if (data && data.ok) { clear(stageCell); stageCell.appendChild(stageChip(stage)); if (onChanged) onChanged(); }
    }).catch(() => { move.disabled = false; });
  });

  const openBtn = h('button', { type: 'button', class: 'btn-ghost', style: 'padding:6px 12px;font-size:12px' }, 'Timeline');
  const tl = h('tr', { style: 'display:none' }, h('td', { colspan: '6' }, h('div', { class: 'tl-mount subtle', style: 'font-size:12.5px;padding:4px 6px' }, '')));
  openBtn.addEventListener('click', () => {
    const shown = tl.style.display !== 'none';
    tl.style.display = shown ? 'none' : '';
    if (!shown) loadTimeline(tl.querySelector('.tl-mount'), p.id, key);
  });

  const row = h('tr', {},
    stageCell,
    h('td', {}, p.company || p.name || '—'),
    h('td', {}, p.email || '—'),
    h('td', { class: 'mono', style: 'color:var(--faint)' }, p.segment || '—'),
    h('td', { class: 'mono', style: 'color:var(--faint)' }, formatAge(p.updated_at)),
    h('td', {}, h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, move, openBtn)),
  );
  return [row, tl];
}

// Compact "log an outreach touch" form shown inside a prospect's timeline panel.
function touchForm(id, key, onLogged) {
  const kind = h('select', { class: 'mono', style: 'background:#0F0F13;border:1px solid var(--line);border-radius:8px;color:var(--ink);font-size:12px;padding:6px 8px' },
    ...TOUCH_KINDS.map((k) => h('option', { value: k }, TOUCH_LABEL[k])));
  const note = h('input', { type: 'text', placeholder: 'note (optional)', maxlength: '1000',
    style: 'flex:1;min-width:140px;background:#0F0F13;border:1px solid var(--line);border-radius:8px;color:var(--ink);font-size:12px;padding:6px 10px' });
  const btn = h('button', { type: 'button', class: 'btn-solid green', style: 'padding:6px 14px;font-size:12px' }, 'Log touch');
  btn.addEventListener('click', () => {
    btn.disabled = true;
    postProspect({ action: 'touch', id, kind: kind.value, note: note.value }, key).then((d) => {
      btn.disabled = false;
      if (d && d.ok) { note.value = ''; if (onLogged) onLogged(); }
    }).catch(() => { btn.disabled = false; });
  });
  return h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px' }, kind, note, btn);
}

function loadTimeline(mount, id, key) {
  clear(mount); mount.appendChild(document.createTextNode('Loading…'));
  apiGet(`/api/prospects?id=${encodeURIComponent(id)}`, key).then((r) => {
    clear(mount);
    mount.appendChild(touchForm(id, key, () => loadTimeline(mount, id, key)));
    const events = r.json && r.json.ok ? (r.json.events || []) : [];
    if (!events.length) { mount.appendChild(document.createTextNode('No activity recorded yet.')); return; }
    for (const e of events) {
      const note = e.meta && typeof e.meta.note === 'string' ? e.meta.note : '';
      mount.appendChild(h('div', { class: 'mono', style: 'padding:3px 0;border-bottom:1px solid var(--line)' },
        h('span', { style: 'color:var(--cyan)' }, eventLabel(e.type)), '  ',
        h('span', { style: 'color:var(--faint)' }, formatAge(e.created_at)),
        note ? h('div', { style: 'color:var(--ink);white-space:pre-wrap;margin-top:2px' }, note) : null,
      ));
    }
  }).catch(() => { clear(mount); mount.appendChild(document.createTextNode('Couldn’t load activity.')); });
}

function renderPipeline(root, key) {
  clear(root);
  const wrap = h('div', {});
  wrap.appendChild(tabBar('pipeline', root, key));
  wrap.appendChild(h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#22d3ee' }, 'CRM · every prospect'), h('span', { class: 'line' })));
  wrap.appendChild(h('h1', { class: 'sec-title' }, 'Pipeline'));

  const statMount = h('div', { class: 'stat-row' });
  const tbody = h('tbody');
  wrap.appendChild(statMount);

  // Outbound: log a cold-reached lead straight into the pipeline.
  const inEmail = h('input', { type: 'email', placeholder: 'email *', maxlength: '200', style: 'background:#0F0F13;border:1px solid var(--line);border-radius:8px;color:var(--ink);font-size:12px;padding:7px 10px;min-width:180px' });
  const inCompany = h('input', { type: 'text', placeholder: 'company', maxlength: '160', style: 'background:#0F0F13;border:1px solid var(--line);border-radius:8px;color:var(--ink);font-size:12px;padding:7px 10px;min-width:150px' });
  const inName = h('input', { type: 'text', placeholder: 'name', maxlength: '120', style: 'background:#0F0F13;border:1px solid var(--line);border-radius:8px;color:var(--ink);font-size:12px;padding:7px 10px;min-width:130px' });
  const inSeg = h('input', { type: 'text', placeholder: 'segment', maxlength: '60', style: 'background:#0F0F13;border:1px solid var(--line);border-radius:8px;color:var(--ink);font-size:12px;padding:7px 10px;min-width:120px' });
  const addBtn = h('button', { type: 'button', class: 'btn-solid green', style: 'padding:7px 16px;font-size:12px' }, 'Add prospect');
  const addMsg = h('span', { class: 'mono', style: 'font-size:12px;color:var(--faint)' }, '');
  addBtn.addEventListener('click', () => {
    const email = (inEmail.value || '').trim();
    if (!email) { clear(addMsg); addMsg.appendChild(document.createTextNode('email required')); return; }
    addBtn.disabled = true; clear(addMsg); addMsg.appendChild(document.createTextNode('adding…'));
    postProspect({ action: 'create', email, company: inCompany.value, name: inName.value, segment: inSeg.value }, key).then((d) => {
      addBtn.disabled = false; clear(addMsg);
      if (d && d.ok) { inEmail.value = inCompany.value = inName.value = inSeg.value = ''; load(); }
      else { addMsg.appendChild(document.createTextNode(d && d.error ? d.error : 'couldn’t add (already in pipeline?)')); }
    }).catch(() => { addBtn.disabled = false; clear(addMsg); addMsg.appendChild(document.createTextNode('network error')); });
  });
  wrap.appendChild(h('div', { class: 'admin-card', style: 'margin-bottom:14px' },
    h('div', { class: 'mono', style: 'font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);margin-bottom:8px' }, 'Log an outbound lead'),
    h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, inEmail, inCompany, inName, inSeg, addBtn, addMsg),
  ));

  wrap.appendChild(h('div', { class: 'admin-card' },
    h('div', { style: 'overflow-x:auto' },
      h('table', { class: 'admin-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Stage'), h('th', {}, 'Company'), h('th', {}, 'Email'), h('th', {}, 'Segment'), h('th', {}, 'Last touch'), h('th', {}, ''))),
        tbody,
      ),
    ),
  ));
  root.appendChild(wrap);

  function load() {
    apiGet('/api/prospects?list=1', key).then((r) => {
      const prospects = r.json && r.json.ok ? (r.json.prospects || []) : [];
      const counts = r.json && r.json.ok ? (r.json.counts || {}) : {};
      clear(statMount);
      for (const s of STAGE_ORDER) {
        statMount.appendChild(h('div', { class: 'stat' },
          h('div', { class: 'n', style: `color:${STAGE_META[s].color}` }, String(counts[s] || 0)),
          h('div', { class: 'l' }, STAGE_META[s].label),
        ));
      }
      clear(tbody);
      if (!prospects.length) { tbody.appendChild(h('tr', {}, h('td', { colspan: '6', class: 'subtle' }, 'No prospects yet — they appear here the moment someone uses the scope studio.'))); return; }
      for (const p of prospects) { const [row, tl] = prospectRow(p, key, load); tbody.appendChild(row); tbody.appendChild(tl); }
    }).catch(() => {});
  }
  load();
}

function tabBar(active, root, key) {
  function tab(id, label) {
    const on = id === active;
    const b = h('button', { type: 'button', class: on ? 'btn-solid green' : 'btn-ghost', style: 'padding:8px 16px;font-size:13px' }, label);
    if (!on) b.addEventListener('click', () => {
      if (id === 'pipeline') renderPipeline(root, key);
      else if (id === 'money') renderMoney(root, key);
      else if (id === 'calendar') renderCalendar(root, key);
      else if (id === 'tasks') renderTasks(root, key);
      else renderProposals(root, key);
    });
    return b;
  }
  return h('div', { style: 'display:flex;gap:10px;margin-bottom:4px;flex-wrap:wrap' }, tab('pipeline', 'Pipeline'), tab('calendar', 'Calendar'), tab('tasks', 'Tasks & budgets'), tab('money', 'Money'), tab('proposals', 'Proposals'));
}

// Money command center — real figures from the proposals ledger (see admin-money.mjs).
function renderMoney(root, key) {
  clear(root);
  const wrap = h('div', {});
  wrap.appendChild(tabBar('money', root, key));
  wrap.appendChild(h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#10b981' }, 'money · your numbers'), h('span', { class: 'line' })));
  wrap.appendChild(h('h1', { class: 'sec-title' }, 'Revenue'));
  const mount = h('div', {});
  wrap.appendChild(mount);
  root.appendChild(wrap);
  renderMoneyBody(mount, { h, clear, money, apiGet, renderNotAuthorized });
}

// Calendar & scheduling — native events (see admin-calendar.mjs for the view).
function renderCalendar(root, key) {
  clear(root);
  const wrap = h('div', {});
  wrap.appendChild(tabBar('calendar', root, key));
  wrap.appendChild(h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#10b981' }, 'calendar · schedule'), h('span', { class: 'line' })));
  wrap.appendChild(h('h1', { class: 'sec-title' }, 'Calendar'));
  const mount = h('div', {});
  wrap.appendChild(mount);
  root.appendChild(wrap);
  renderCalendarView(mount, key, { h, clear, authHeaders, renderNotAuthorized });
}

// Tasks & budgets — task board + per-deal margin (see admin-tasks.mjs).
function renderTasks(root, key) {
  clear(root);
  const wrap = h('div', {});
  wrap.appendChild(tabBar('tasks', root, key));
  wrap.appendChild(h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#10b981' }, 'tasks · budgets'), h('span', { class: 'line' })));
  wrap.appendChild(h('h1', { class: 'sec-title' }, 'Tasks & budgets'));
  const mount = h('div', {});
  wrap.appendChild(mount);
  root.appendChild(wrap);
  renderTasksView(mount, key, { h, clear, authHeaders, renderNotAuthorized, money });
}

function renderProposals(root, key) {
  apiGet('/api/proposal-admin?list=1', key).then((r) => {
    if (r.unauthorized) { renderNotAuthorized(root); return; }
    if (!r.json || !r.json.ok) { renderUnconfigured(root); return; }
    clear(root);
    const shell = h('div', {}, tabBar('proposals', root, key));
    const listMount = h('div', {});
    shell.appendChild(listMount);
    root.appendChild(shell);
    renderList(listMount, Array.isArray(r.json.list) ? r.json.list : [], key);
  }).catch(() => renderNotAuthorized(root));
}

async function init() {
  const root = document.getElementById('admin-root');
  if (!root) return;

  const key = (new URLSearchParams(location.search).get('key') || '').trim();
  const session = getSession();
  if (key) AUTH = { mode: 'key', value: key };
  else if (session && session.access_token) AUTH = { mode: 'jwt', value: session.access_token };
  if (!AUTH) { renderLoginPrompt(root); return; }

  // Auth/config probe via the proposals endpoint, then default to the Pipeline (CRM) view.
  let result;
  try {
    result = await apiGet('/api/proposal-admin?list=1', key);
  } catch {
    renderNotAuthorized(root);
    return;
  }
  if (result.unauthorized) { renderNotAuthorized(root); return; }
  if (!result.json || !result.json.ok) { renderUnconfigured(root); return; }
  renderPipeline(root, key);
}

init().catch(() => {
  const root = document.getElementById('admin-root');
  if (root) renderNotAuthorized(root);
});
