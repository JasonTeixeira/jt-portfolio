// Client-facing portal page. Renders the whitelisted /api/portal view — plan bought,
// milestone timeline, payment summary, and agreement link — plus the milestone-approve
// flow. Every dynamic value goes through textContent or DOM properties — never
// innerHTML — because milestone titles/deliverables come from the operator's own input.
import { computePlan, SEGMENTS } from './scope-core.mjs';
import { money } from './proposal-core.mjs';
import { deliverableTokens } from './portal-core.mjs';

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

/* ── one deliverable line: plain text, but any http(s) URL becomes a safe link ──
   A line like "Loom walkthrough — https://loom.com/share/abc" renders the label as
   text and the URL as a clickable link. The href is only ever set from a URL the
   pure classifier already proved is http/https, so a javascript:/data: string can
   never reach the href — it stays inert text. Links open in a new tab with
   rel=noopener to prevent reverse-tabnabbing. */
function deliverableLine(line) {
  const { tokens, hasLink } = deliverableTokens(line);
  if (!hasLink) return h('div', {}, line);
  const div = h('div', {});
  for (const t of tokens) {
    if (t.type === 'link') {
      div.appendChild(h('a', {
        href: t.href, target: '_blank', rel: 'noopener noreferrer nofollow',
        style: 'color:#22d3ee;text-decoration:underline;word-break:break-word',
      }, t.text));
    } else {
      div.appendChild(document.createTextNode(t.text));
    }
  }
  return div;
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
    for (const line of lines) delivWrap.appendChild(deliverableLine(line));
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
function fmtTime(iso) { try { return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch { return ''; } }
function fmtBytes(n) { if (!n && n !== 0) return ''; if (n < 1024) return n + ' B'; if (n < 1048576) return (n / 1024).toFixed(0) + ' KB'; return (n / 1048576).toFixed(1) + ' MB'; }

/* ── deliverable files (download-only; short-lived signed URLs) ── */
function buildDeliverablesCard(view) {
  const files = Array.isArray(view.deliverables) ? view.deliverables : [];
  if (!files.length) return null;
  const card = h('div', { class: 'portal-card' });
  card.appendChild(h('h2', { class: 'portal-card-title' }, 'Files'));
  const wrap = h('div', { style: 'display:flex;flex-direction:column;gap:8px' });
  for (const f of files) {
    wrap.appendChild(h('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--line);border-radius:10px;padding:10px 14px' },
      h('div', { style: 'min-width:0' },
        f.url ? h('a', { href: f.url, target: '_blank', rel: 'noopener', style: 'color:#22d3ee;font-size:14px;word-break:break-word' }, f.name) : h('span', { style: 'font-size:14px' }, f.name),
        h('div', { style: 'font-family:var(--mono);font-size:10.5px;color:var(--faint);margin-top:2px' }, fmtBytes(f.size_bytes))),
      f.url ? h('a', { href: f.url, target: '_blank', rel: 'noopener', class: 'btn-ghost', style: 'padding:5px 12px;font-size:12px' }, 'Download') : null));
  }
  card.appendChild(wrap);
  return card;
}

/* ── client <-> operator message thread ── */
function buildMessagesCard(view, portalToken) {
  const card = h('div', { class: 'portal-card' });
  card.appendChild(h('h2', { class: 'portal-card-title' }, 'Messages'));
  card.appendChild(h('p', { class: 'subtle', style: 'margin:-4px 0 14px;font-size:13px' }, 'Message Jason directly about your project — he’s notified by email when you send.'));
  const thread = h('div', { style: 'display:flex;flex-direction:column;gap:10px;margin-bottom:14px' });
  const empty = h('p', { class: 'subtle', style: 'font-size:13px' }, 'No messages yet.');
  function addBubble(m) {
    const mine = m.sender === 'client';
    thread.appendChild(h('div', { style: `align-self:${mine ? 'flex-end' : 'flex-start'};max-width:82%;border:1px solid var(--line);border-radius:14px;padding:10px 14px;background:${mine ? 'rgba(34,211,238,0.08)' : 'var(--card)'}` },
      h('div', { style: 'font-family:var(--mono);font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:var(--faint);margin-bottom:4px' }, mine ? 'You' : 'Jason'),
      h('div', { style: 'font-size:14px;line-height:1.6;color:var(--ink);white-space:pre-wrap' }, m.body),
      h('div', { style: 'font-family:var(--mono);font-size:10px;color:var(--faint);margin-top:5px' }, fmtTime(m.created_at)),
    ));
  }
  const msgs = Array.isArray(view.messages) ? view.messages : [];
  if (!msgs.length) thread.appendChild(empty); else msgs.forEach(addBubble);
  card.appendChild(thread);

  // Poll so the client sees Jason's replies without reloading. Lightweight: refetch
  // the portal every 25s and append only messages beyond the count we've rendered.
  let shown = msgs.length;
  const poll = setInterval(async () => {
    if (!document.body.contains(card)) { clearInterval(poll); return; } // stop if navigated away
    try {
      const r = await fetch(`/api/portal?id=${encodeURIComponent(portalToken)}`);
      const j = r.ok ? await r.json().catch(() => null) : null;
      const list = j && j.ok && Array.isArray(j.messages) ? j.messages : null;
      if (list && list.length > shown) {
        if (thread.contains(empty)) clear(thread);
        for (let i = shown; i < list.length; i++) addBubble(list[i]);
        shown = list.length;
      }
    } catch { /* transient — try again next tick */ }
  }, 25000);

  const ta = h('textarea', { rows: '3', placeholder: 'Write a message…', style: 'width:100%;box-sizing:border-box;background:#0F0F13;border:1px solid var(--line);border-radius:10px;color:var(--ink);font-family:inherit;font-size:14px;padding:10px 12px;resize:vertical' });
  const btn = h('button', { type: 'button', class: 'btn-solid green', style: 'margin-top:8px;padding:9px 18px;font-size:13px' }, 'Send');
  const status = h('span', { class: 'subtle', style: 'font-size:12px;margin-left:10px' }, '');
  btn.addEventListener('click', () => {
    const text = (ta.value || '').trim();
    if (text.length < 1) return;
    btn.disabled = true; clear(status); status.appendChild(document.createTextNode('Sending…'));
    fetch('/api/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'message', portalToken, body: text }) })
      .then((r) => r.json().catch(() => null)).then((d) => {
        btn.disabled = false; clear(status);
        if (d && d.ok) { if (thread.contains(empty)) clear(thread); addBubble({ sender: 'client', body: text, created_at: new Date().toISOString() }); shown += 1; ta.value = ''; }
        else { status.appendChild(document.createTextNode('Couldn’t send — try again or email ')); status.appendChild(h('a', { href: `mailto:${CONTACT_EMAIL}`, style: 'color:#22d3ee' }, CONTACT_EMAIL)); status.appendChild(document.createTextNode('.')); }
      }).catch(() => { btn.disabled = false; clear(status); status.appendChild(document.createTextNode('Network error.')); });
  });
  card.appendChild(h('div', {}, ta, h('div', { style: 'display:flex;align-items:center' }, btn, status)));
  return card;
}

/* ── project progress stepper (Kickoff → Building → Delivered → Complete) ── */
function buildStepper(view, plan) {
  const STAGES = ['Kickoff', 'Building', 'Delivered', 'Complete'];
  const raw = String((view.project && view.project.status) || 'kickoff').toLowerCase();
  const ms = Array.isArray(view.milestones) ? view.milestones : [];
  const anyActive = ms.some((m) => ['in_progress', 'delivered', 'approved'].includes(m.status)) || ['active', 'in_progress'].includes(raw);
  const allDelivered = ms.length > 0 && ms.every((m) => ['delivered', 'approved'].includes(m.status));
  const allApproved = ms.length > 0 && ms.every((m) => m.status === 'approved');
  const complete = ['complete', 'completed'].includes(raw) || (allApproved && !!plan.balance_paid_at);
  let idx = 0;
  if (anyActive) idx = 1;
  if (allDelivered) idx = 2;
  if (complete) idx = 3;

  const card = h('div', { class: 'portal-card', style: 'display:flex;align-items:flex-start;padding:22px clamp(18px,3vw,30px)' });
  STAGES.forEach((label, i) => {
    const done = i <= idx; const current = i === idx;
    const dot = h('div', { style: `width:${current ? '14px' : '11px'};height:${current ? '14px' : '11px'};border-radius:50%;flex:none;background:${done ? 'var(--green)' : 'transparent'};border:2px solid ${done ? 'var(--green)' : 'var(--line)'};box-shadow:${current ? '0 0 0 4px rgba(16,185,129,0.18)' : 'none'}` });
    card.appendChild(h('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:9px;flex:none' },
      h('div', { style: 'height:14px;display:flex;align-items:center' }, dot),
      h('div', { style: `font-family:var(--mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:${done ? 'var(--ink)' : 'var(--faint)'};white-space:nowrap` }, label)));
    if (i < STAGES.length - 1) card.appendChild(h('div', { style: `flex:1;min-width:16px;height:2px;margin-top:6px;background:${i < idx ? 'var(--green)' : 'var(--line)'}` }));
  });
  return card;
}

function renderPortal(root, view, portalToken, opts = {}) {
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

  // progress stepper
  root.appendChild(buildStepper(view, plan));

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

  // Files — client-downloadable deliverables (only shown when there are any).
  const filesCard = buildDeliverablesCard(view);
  if (filesCard) root.appendChild(filesCard);

  // Billing & receipt — itemized deposit/balance with paid dates + total, printable.
  const fmtDay = (iso) => { try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return ''; } };
  const receiptRow = (label, amountCents, sub, paid) => {
    const lbl = h('span', { class: 'lbl' }, label);
    if (sub) lbl.appendChild(h('span', { style: 'display:block;font-size:11px;color:var(--faint);font-family:var(--mono);margin-top:2px' }, sub));
    return h('div', { class: 'portal-pay-row' }, lbl, h('span', { class: 'val', style: paid ? 'color:var(--green)' : '' }, money(amountCents) + (paid ? ' ✓' : '')));
  };
  const payCard = h('div', { class: 'portal-card' },
    h('h2', { class: 'portal-card-title' }, 'Billing & receipt'),
    receiptRow('Deposit', plan.deposit_cents, plan.paid_at ? `Paid ${fmtDay(plan.paid_at)}` : 'Pending', Boolean(plan.paid_at)),
  );
  if (plan.balance_paid_at) {
    payCard.appendChild(receiptRow('Balance', plan.balance_cents, `Paid ${fmtDay(plan.balance_paid_at)}`, true));
    payCard.appendChild(h('div', { class: 'portal-pay-row', style: 'border-top:1px solid var(--line);margin-top:6px;padding-top:12px' }, h('span', { class: 'lbl', style: 'font-weight:600' }, 'Total'), h('span', { class: 'val', style: 'font-weight:600' }, money(plan.firm_cents))));
    payCard.appendChild(h('p', { class: 'subtle', style: 'margin-top:10px;font-size:13px' }, 'Paid in full. Thank you.'));
    const printBtn = h('button', { type: 'button', class: 'btn-ghost', style: 'margin-top:12px;padding:9px 16px;font-size:13px' }, 'Print / Save PDF');
    printBtn.addEventListener('click', () => window.print());
    payCard.appendChild(printBtn);
  } else if (plan.balance_cents > 0 && opts.justPaid) {
    // Returned from Stripe checkout; webhook not yet processed. Suppress the pay
    // button entirely so a second click can't create a second charge.
    payCard.appendChild(receiptRow('Balance', plan.balance_cents, 'Payment submitted', false));
    payCard.appendChild(h('div', { class: 'portal-pay-row', style: 'border-top:1px solid var(--line);margin-top:6px;padding-top:12px' }, h('span', { class: 'lbl', style: 'font-weight:600' }, 'Total'), h('span', { class: 'val', style: 'font-weight:600' }, money(plan.firm_cents))));
    payCard.appendChild(h('p', { class: 'subtle', style: 'margin-top:12px;font-size:13px;color:var(--green)' }, 'Payment received — confirming it now. This page will update in a moment.'));
    // Escape hatch so a delayed webhook never dead-ends the client (reloads without ?balance=paid).
    payCard.appendChild(h('a', { href: `portal.html?id=${encodeURIComponent(portalToken)}`, class: 'subtle', style: 'font-size:12px;color:#22d3ee' }, 'Taking a while? Refresh →'));
  } else if (plan.balance_cents > 0) {
    payCard.appendChild(receiptRow('Balance remaining', plan.balance_cents, 'Due', false));
    payCard.appendChild(h('div', { class: 'portal-pay-row', style: 'border-top:1px solid var(--line);margin-top:6px;padding-top:12px' }, h('span', { class: 'lbl', style: 'font-weight:600' }, 'Total'), h('span', { class: 'val', style: 'font-weight:600' }, money(plan.firm_cents))));
    const payBtn = h('button', { type: 'button', class: 'btn-solid green', style: 'margin-top:14px;padding:11px 20px;font-size:14px' }, `Pay balance — ${money(plan.balance_cents)}`);
    const payStatus = h('span', { class: 'subtle', style: 'font-size:12px;margin-left:10px' }, '');
    payBtn.addEventListener('click', () => {
      payBtn.disabled = true; clear(payStatus); payStatus.appendChild(document.createTextNode('Opening secure checkout…'));
      fetch('/api/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'pay_balance', portalToken }) })
        .then((r) => r.json().catch(() => null)).then((d) => {
          if (d && d.ok && d.url) { window.location.href = d.url; return; }
          if (d && d.alreadyPaid) { window.location.reload(); return; }
          payBtn.disabled = false; clear(payStatus); payStatus.appendChild(document.createTextNode('Couldn’t start checkout. Email '));
          payStatus.appendChild(h('a', { href: `mailto:${CONTACT_EMAIL}`, style: 'color:#22d3ee' }, CONTACT_EMAIL));
          payStatus.appendChild(document.createTextNode('.'));
        }).catch(() => { payBtn.disabled = false; clear(payStatus); payStatus.appendChild(document.createTextNode('Network error. Try again.')); });
    });
    payCard.appendChild(h('div', {}, payBtn, payStatus));
  } else {
    payCard.appendChild(h('div', { class: 'portal-pay-row' }, h('span', { class: 'lbl' }, 'Balance'), h('span', { class: 'val' }, money(plan.balance_cents))));
  }
  root.appendChild(payCard);

  // Messages — two-way thread with Jason.
  root.appendChild(buildMessagesCard(view, portalToken));

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
  // Stripe returns from balance checkout with ?balance=paid. If the webhook hasn't
  // marked the balance paid yet, we must NOT re-show the Pay button (double-charge guard).
  const justPaid = params.get('balance') === 'paid';
  renderPortal(root, json, id, { justPaid });
  // Give the webhook a moment, then refresh once to pick up the confirmed payment.
  if (justPaid && json.plan && !json.plan.balance_paid_at) {
    setTimeout(async () => {
      try {
        const r = await fetch(`/api/portal?id=${encodeURIComponent(id)}`);
        const j = r.ok ? await r.json().catch(() => null) : null;
        if (j && j.ok) { clear(root); renderPortal(root, j, id, { justPaid }); }
      } catch { /* keep the confirming state */ }
    }, 4000);
  }
}

init().catch(() => {
  const root = document.getElementById('portal-root');
  if (root) renderUnavailable(root);
});
