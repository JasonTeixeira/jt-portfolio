// Client-facing portal page. Renders the whitelisted /api/portal view — plan bought,
// milestone timeline, payment summary, and agreement link — plus the milestone-approve
// flow. Every dynamic value goes through textContent or DOM properties — never
// innerHTML — because milestone titles/deliverables come from the operator's own input.
import { computePlan, SEGMENTS } from './scope-core.mjs';
import { money } from './proposal-core.mjs';

const CONTACT_EMAIL = 'hello@sageideas.dev';

/* ── tiny DOM builder: props become attrs/class/handlers, children are text or nodes ── */
function h(tag, props, ...children) {
  const node = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
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

function bookLink(label) {
  return h('a', { href: 'book.html', class: 'btn-ghost', style: 'border-color:#a78bfa;color:#a78bfa;margin-top:16px;display:inline-flex' }, label || 'Talk to Jason →');
}

/* ── project status chip — free-text status, mapped where known, title-cased otherwise ── */
const PROJECT_STYLE = new Set(['kickoff', 'active', 'in_progress', 'delivered', 'complete', 'completed']);
const PROJECT_LABEL = { kickoff: 'Kickoff', active: 'Active', in_progress: 'In progress', delivered: 'Delivered', complete: 'Complete', completed: 'Complete' };
function titleCase(s) { return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }
function statusChip(status) {
  const raw = String(status || 'kickoff').toLowerCase();
  const styleKey = PROJECT_STYLE.has(raw) ? raw : 'kickoff';
  const label = PROJECT_LABEL[raw] || titleCase(raw);
  return h('span', { class: `portal-chip st-${styleKey}` }, h('span', { class: 'dot' }), label);
}

/* ── milestone status badge: pending -> in_progress -> delivered -> approved ── */
const MS_LABEL = { pending: 'Pending', in_progress: 'In progress', delivered: 'Delivered', approved: 'Approved' };
function msStyleKey(status) {
  const raw = String(status || 'pending').toLowerCase();
  return MS_LABEL[raw] ? raw : 'pending';
}
function milestoneBadge(status) {
  const key = msStyleKey(status);
  return h('span', { class: `portal-badge st-${key}` }, MS_LABEL[key]);
}

/* ── calm, single-note unavailable state — covers no id, not-ok, and dormant (DB off) ── */
function renderUnavailable(root) {
  clear(root);
  root.appendChild(h('div', { class: 'portal-empty' },
    h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#22d3ee' }, 'portal'), h('span', { class: 'line' })),
    h('h1', { class: 'portal-title', style: 'font-size:clamp(1.8rem,4vw,2.6rem)' }, "This project isn’t available."),
    h('p', { class: 'subtle', style: 'margin-top:12px' }, 'It may have moved, or the link might be off. Talk to me and I’ll help you find it.'),
    bookLink(),
  ));
}

/* ── one milestone row: seq dot, title/badge/amount, deliverables, and (if delivered) an approve control ── */
function buildMilestoneRow(m, portalToken) {
  const statusKey = msStyleKey(m.status);
  const row = h('div', { class: `portal-ms st-${statusKey}` });
  row.appendChild(h('div', { class: 'portal-ms-dot' }, m.seq != null ? String(m.seq) : ''));

  const titleBlock = h('div', {}, h('div', { class: 'portal-ms-title' }, m.title || 'Milestone'), milestoneBadge(m.status));
  row.appendChild(h('div', { class: 'portal-ms-head' }, titleBlock, h('div', { class: 'portal-ms-amt' }, money(m.amount_cents))));

  const delivWrap = h('div', { class: 'portal-ms-deliverables' });
  const lines = String(m.deliverables || '').split('\n').map((s) => s.trim()).filter(Boolean);
  if (lines.length === 0) {
    delivWrap.appendChild(h('div', {}, 'Details to follow.'));
  } else {
    for (const line of lines) delivWrap.appendChild(h('div', {}, line));
  }
  row.appendChild(delivWrap);

  // Approve control — only on a milestone that is exactly 'delivered' (server truth, not the
  // display-normalized style key), matching the server's own guarded transition.
  if (m.status === 'delivered') {
    const status = h('div', { class: 'portal-approve-status', role: 'status', 'aria-live': 'polite' });
    const nameId = `ms-name-${m.id}`;
    const nameInput = h('input', { type: 'text', id: nameId, required: 'required', autocomplete: 'name' });
    const submitBtn = h('button', { type: 'submit', class: 'btn-solid green', style: 'padding:10px 18px;font-size:13px' }, 'Approve delivery');
    const form = h('form', { class: 'portal-approve' },
      h('label', { for: nameId }, h('span', { class: 'lbl-text' }, 'Your full name'), nameInput),
      submitBtn,
      status,
    );

    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const name = nameInput.value.trim();
      if (name.length < 2) {
        clear(status); status.classList.remove('ok'); status.classList.add('err');
        status.appendChild(document.createTextNode('Add your name to approve.'));
        return;
      }
      status.classList.remove('err'); clear(status);
      nameInput.disabled = true; submitBtn.disabled = true; submitBtn.textContent = 'Approving…';

      fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portalToken, action: 'approve_milestone', milestoneId: m.id, name }),
      })
        .then((res) => res.json().catch(() => null))
        .then((data) => {
          if (data && data.ok) {
            row.classList.remove('st-delivered');
            row.classList.add('st-approved');
            const badge = titleBlock.querySelector('.portal-badge');
            if (badge) { badge.className = 'portal-badge st-approved'; clear(badge); badge.appendChild(document.createTextNode('Approved')); }
            clear(status); status.classList.remove('err'); status.classList.add('ok');
            status.appendChild(document.createTextNode('Approved. Thank you.'));
            submitBtn.textContent = 'Approved';
            return;
          }
          clear(status); status.classList.add('err');
          if (data && data.skipped) {
            status.appendChild(document.createTextNode('Approvals aren’t switched on yet. Email Jason to confirm.'));
          } else {
            status.appendChild(document.createTextNode('Something went wrong. Try again, or email '));
            status.appendChild(h('a', { href: `mailto:${CONTACT_EMAIL}`, style: 'color:#22d3ee' }, CONTACT_EMAIL));
            status.appendChild(document.createTextNode('.'));
          }
          nameInput.disabled = false; submitBtn.disabled = false; submitBtn.textContent = 'Approve delivery';
        })
        .catch(() => {
          clear(status); status.classList.add('err');
          status.appendChild(document.createTextNode('Couldn’t reach the server. Try again in a moment.'));
          nameInput.disabled = false; submitBtn.disabled = false; submitBtn.textContent = 'Approve delivery';
        });
    });

    row.appendChild(form);
  }

  return row;
}

/* ── the real page: header + plan + milestone timeline + payment + agreement ── */
function renderPortal(root, view, portalToken) {
  clear(root);
  const plan = view.plan || {};
  const segLabel = plan.segment && SEGMENTS[plan.segment] ? SEGMENTS[plan.segment].label : null;

  root.appendChild(h('div', { class: 'portal-head' },
    h('div', {},
      h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#22d3ee' }, 'client portal'), h('span', { class: 'line' })),
      h('h1', { class: 'portal-title' }, 'Your project'),
      segLabel ? h('p', { class: 'portal-sub' }, segLabel) : null,
    ),
    statusChip(view.project && view.project.status),
  ));

  // The plan they bought — itemized from the catalog keys, grouped by phase, display-only.
  const planData = computePlan(Array.isArray(plan.keys) ? plan.keys : [], plan.segment || null);
  const planCard = h('div', { class: 'portal-card' }, h('h2', { class: 'portal-card-title' }, 'The plan you bought'));
  if (planData.phases.length === 0) {
    planCard.appendChild(h('p', { class: 'subtle' }, 'Scope details are being finalized.'));
  } else {
    for (const phase of planData.phases) {
      const phaseBlock = h('div', { class: 'portal-phase' }, h('h3', {}, phase.label));
      for (const item of phase.items) {
        phaseBlock.appendChild(h('div', { class: 'portal-plan-item' }, h('span', { class: 'nm' }, item.name), h('span', { class: 'tk' }, item.track)));
      }
      planCard.appendChild(phaseBlock);
    }
  }
  root.appendChild(planCard);

  // Milestone timeline — the centerpiece.
  const msCard = h('div', { class: 'portal-card' }, h('h2', { class: 'portal-card-title' }, 'Milestones'));
  const milestones = Array.isArray(view.milestones) ? [...view.milestones].sort((a, b) => (a.seq || 0) - (b.seq || 0)) : [];
  if (milestones.length === 0) {
    msCard.appendChild(h('p', { class: 'subtle' }, 'Milestones will appear here once the project kicks off.'));
  } else {
    const timeline = h('div', { class: 'portal-timeline' });
    for (const m of milestones) timeline.appendChild(buildMilestoneRow(m, portalToken));
    msCard.appendChild(timeline);
  }
  root.appendChild(msCard);

  // Payment summary.
  root.appendChild(h('div', { class: 'portal-card' },
    h('h2', { class: 'portal-card-title' }, 'Payment'),
    h('div', { class: 'portal-pay-row' }, h('span', { class: 'lbl' }, 'Deposit paid'), h('span', { class: 'val' }, money(plan.deposit_cents))),
    h('div', { class: 'portal-pay-row' }, h('span', { class: 'lbl' }, 'Balance due on delivery'), h('span', { class: 'val' }, money(plan.balance_cents))),
  ));

  // Agreement — only shown once a contract has been sent (or accepted).
  if (view.contract && view.contract.public_id) {
    root.appendChild(h('div', { class: 'portal-card' },
      h('h2', { class: 'portal-card-title' }, 'Agreement'),
      h('a', { href: `contract.html?id=${encodeURIComponent(view.contract.public_id)}`, class: 'portal-agreement-link' }, 'View your agreement →'),
      h('div', { class: 'portal-agreement-status' }, view.contract.status === 'accepted' ? 'Accepted' : 'Awaiting your review'),
    ));
  }
}

async function init() {
  const root = document.getElementById('portal-root');
  if (!root) return;

  const params = new URLSearchParams(location.search);
  const id = (params.get('id') || '').trim();
  if (!id) { renderUnavailable(root); return; }

  // Immediate placeholder inside the reserved min-height so the fetch->render
  // transition does not shift the page (keeps CLS ~0).
  root.appendChild(h('p', { class: 'subtle', style: 'padding-top:8vh;text-align:center' }, 'Loading your project…'));

  let json = null;
  try {
    const res = await fetch(`/api/portal?id=${encodeURIComponent(id)}`);
    if (res.ok) json = await res.json().catch(() => null);
  } catch {
    // network error (e.g. static host with no API route) — fall through to unavailable
  }

  // Covers no id, {ok:false} (not found / bad request), and dormant ({ok:false, reason:'not_configured'}).
  if (!json || !json.ok) { renderUnavailable(root); return; }
  renderPortal(root, json, id);
}

init().catch(() => {
  const root = document.getElementById('portal-root');
  if (root) renderUnavailable(root);
});
