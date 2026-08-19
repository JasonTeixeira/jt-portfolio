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

function statusChip(status) {
  const meta = STATUS_META[status] || { label: status || 'unknown', color: '#8E8882' };
  return h('span', { class: 'chip', style: `color:${meta.color};border-color:${meta.color}44` },
    h('span', { class: 'dot', style: `background:${meta.color}` }),
    meta.label,
  );
}

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
  renderDetail(mount, result.json.proposal, key);
}

function renderDetail(mount, row, key) {
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
