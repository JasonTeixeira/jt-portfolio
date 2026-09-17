// Client-facing portal page. Renders the whitelisted /api/portal view — plan bought,
// milestone timeline, payment summary, and agreement link — plus the milestone-approve
// flow. Every dynamic value goes through textContent or DOM properties — never
// innerHTML — because milestone titles/deliverables come from the operator's own input.
import { computePlan, SEGMENTS } from './scope-core.mjs';
import { money } from './proposal-core.mjs';
import { deliverableTokens } from './portal-core.mjs';
import { t, LOCALE } from './i18n.mjs';

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
  return h('a', { href: 'book.html', class: 'btn-ghost', style: 'border-color:#a78bfa;color:#a78bfa;margin-top:16px;display:inline-flex' }, label || t('hdr.talk'));
}

/* ── project status chip — free-text status, mapped where known, title-cased otherwise ── */
const PROJECT_STYLE = new Set(['kickoff', 'active', 'in_progress', 'delivered', 'complete', 'completed']);
const PROJECT_LABEL = { kickoff: 'st.kickoff', active: 'st.active', in_progress: 'st.in_progress', delivered: 'st.delivered', complete: 'st.complete', completed: 'st.complete' };
function titleCase(s) { return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }
function statusChip(status) {
  const raw = String(status || 'kickoff').toLowerCase();
  const styleKey = PROJECT_STYLE.has(raw) ? raw : 'kickoff';
  const label = PROJECT_LABEL[raw] ? t(PROJECT_LABEL[raw]) : titleCase(raw);
  return h('span', { class: `portal-chip st-${styleKey}` }, h('span', { class: 'dot' }), label);
}

/* ── milestone status badge: pending -> in_progress -> delivered -> approved ── */
const MS_LABEL = { pending: 'st.pending', in_progress: 'st.in_progress', delivered: 'st.delivered', approved: 'st.approved' };
function msStyleKey(status) {
  const raw = String(status || 'pending').toLowerCase();
  return MS_LABEL[raw] ? raw : 'pending';
}
function milestoneBadge(status) {
  const key = msStyleKey(status);
  return h('span', { class: `portal-badge st-${key}` }, t(MS_LABEL[key]));
}

/* ── calm, single-note unavailable state — covers no id, not-ok, and dormant (DB off) ── */
function renderUnavailable(root) {
  clear(root);
  root.appendChild(h('div', { class: 'portal-empty' },
    h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#22d3ee' }, 'portal'), h('span', { class: 'line' })),
    h('h1', { class: 'portal-title', style: 'font-size:clamp(1.8rem,4vw,2.6rem)' }, t('portal.unavailable.title')),
    h('p', { class: 'subtle', style: 'margin-top:12px' }, t('portal.unavailable.body')),
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

  // "What's next / when" — a due date on open milestones, a delivered date once shipped.
  const dstr = (m.status === 'delivered' || m.status === 'approved')
    ? (m.delivered_at ? t('ms.deliveredOn', { date: fmtDay(m.delivered_at) }) : '')
    : (m.due_at ? t('ms.dueOn', { date: fmtDay(m.due_at) }) : '');
  if (dstr) row.appendChild(h('div', { style: 'font-size:11.5px;color:var(--muted,#8E8882);margin:-2px 0 6px' }, dstr));

  const delivWrap = h('div', { class: 'portal-ms-deliverables' });
  const lines = String(m.deliverables || '').split('\n').map((s) => s.trim()).filter(Boolean);
  if (lines.length === 0) {
    delivWrap.appendChild(h('div', {}, t('ms.detailsToFollow')));
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
    const submitBtn = h('button', { type: 'submit', class: 'btn-solid green', style: 'padding:10px 18px;font-size:13px' }, t('ms.approveBtn'));
    const form = h('form', { class: 'portal-approve' },
      h('label', { for: nameId }, h('span', { class: 'lbl-text' }, t('ms.approveName')), nameInput),
      submitBtn,
      status,
    );

    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const name = nameInput.value.trim();
      if (name.length < 2) {
        clear(status); status.classList.remove('ok'); status.classList.add('err');
        status.appendChild(document.createTextNode(t('ms.approvePrompt')));
        return;
      }
      status.classList.remove('err'); clear(status);
      nameInput.disabled = true; submitBtn.disabled = true; submitBtn.textContent = t('ms.approving');

      fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portalToken, action: 'approve_milestone', milestoneId: m.id, name, session: getSess(portalToken) }),
      })
        .then((res) => res.json().catch(() => null))
        .then((data) => {
          if (data && data.ok) {
            row.classList.remove('st-delivered');
            row.classList.add('st-approved');
            const badge = titleBlock.querySelector('.portal-badge');
            if (badge) { badge.className = 'portal-badge st-approved'; clear(badge); badge.appendChild(document.createTextNode(t('st.approved'))); }
            clear(status); status.classList.remove('err'); status.classList.add('ok');
            status.appendChild(document.createTextNode(t('ms.approved')));
            submitBtn.textContent = t('st.approved');
            return;
          }
          clear(status); status.classList.add('err');
          if (data && data.skipped) {
            status.appendChild(document.createTextNode(t('ms.approveOff')));
          } else {
            status.appendChild(document.createTextNode(t('ms.error') + ' '));
            status.appendChild(h('a', { href: `mailto:${CONTACT_EMAIL}`, style: 'color:#22d3ee' }, CONTACT_EMAIL));
            status.appendChild(document.createTextNode('.'));
          }
          nameInput.disabled = false; submitBtn.disabled = false; submitBtn.textContent = t('ms.approveBtn');
        })
        .catch(() => {
          clear(status); status.classList.add('err');
          status.appendChild(document.createTextNode(t('ms.network')));
          nameInput.disabled = false; submitBtn.disabled = false; submitBtn.textContent = t('ms.approveBtn');
        });
    });

    row.appendChild(form);

    // Request-changes: an alternative to approving on a delivered milestone. Logs to the
    // thread + alerts the operator; non-destructive (doesn't flip status).
    const rcToggle = h('button', { type: 'button', class: 'btn-ghost', style: 'margin-top:8px;padding:8px 14px;font-size:12.5px' }, t('ms.requestChanges'));
    const rcText = h('textarea', { rows: '3', placeholder: t('ms.changesPrompt'), style: 'width:100%;padding:9px;border-radius:8px;resize:vertical' });
    const rcSend = h('button', { type: 'button', class: 'btn-solid green', style: 'margin-top:8px;padding:9px 16px;font-size:13px' }, t('ms.changesSend'));
    const rcCancel = h('button', { type: 'button', class: 'btn-ghost', style: 'margin-top:8px;margin-left:8px;padding:9px 16px;font-size:13px' }, t('ms.cancel'));
    const rcStatus = h('div', { class: 'portal-approve-status', role: 'status', 'aria-live': 'polite' });
    const rcForm = h('div', { style: 'display:none;margin-top:8px' }, rcText, h('div', {}, rcSend, rcCancel), rcStatus);
    rcToggle.addEventListener('click', () => { rcForm.style.display = rcForm.style.display === 'none' ? 'block' : 'none'; if (rcForm.style.display === 'block') rcText.focus(); });
    rcCancel.addEventListener('click', () => { rcForm.style.display = 'none'; });
    rcSend.addEventListener('click', () => {
      const note = rcText.value.trim();
      clear(rcStatus); rcStatus.classList.remove('ok', 'err');
      if (note.length < 2) { rcStatus.classList.add('err'); rcStatus.appendChild(document.createTextNode(t('ms.changesPrompt'))); return; }
      rcSend.disabled = true;
      fetch('/api/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portalToken, action: 'request_changes', milestoneId: m.id, note, session: getSess(portalToken) }) })
        .then((r) => r.json().catch(() => null))
        .then((d) => {
          clear(rcStatus);
          if (d && d.ok) { rcStatus.classList.add('ok'); rcStatus.appendChild(document.createTextNode(t('ms.changesSent'))); rcText.value = ''; rcForm.style.display = 'none'; }
          else { rcStatus.classList.add('err'); rcStatus.appendChild(document.createTextNode(t('ms.changesError'))); rcSend.disabled = false; }
        })
        .catch(() => { clear(rcStatus); rcStatus.classList.add('err'); rcStatus.appendChild(document.createTextNode(t('ms.changesError'))); rcSend.disabled = false; });
    });
    row.appendChild(h('div', { class: 'portal-approve', style: 'margin-top:2px' }, rcToggle, rcForm));
  }

  return row;
}

/* ── the real page: header + plan + milestone timeline + payment + agreement ── */
function fmtTime(iso) { try { return new Date(iso).toLocaleString(LOCALE, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch { return ''; } }
function fmtBytes(n) { if (!n && n !== 0) return ''; if (n < 1024) return n + ' B'; if (n < 1048576) return (n / 1024).toFixed(0) + ' KB'; return (n / 1048576).toFixed(1) + ' MB'; }

/* ── deliverable files (download-only; short-lived signed URLs) ── */
function buildDeliverablesCard(view) {
  const files = Array.isArray(view.deliverables) ? view.deliverables : [];
  if (!files.length) return null;
  const card = h('div', { class: 'portal-card' });
  card.appendChild(h('h2', { class: 'portal-card-title' }, t('files.title')));
  const wrap = h('div', { style: 'display:flex;flex-direction:column;gap:8px' });
  for (const f of files) {
    wrap.appendChild(h('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--line);border-radius:10px;padding:10px 14px' },
      h('div', { style: 'min-width:0' },
        f.url ? h('a', { href: f.url, target: '_blank', rel: 'noopener', style: 'color:#22d3ee;font-size:14px;word-break:break-word' }, f.name) : h('span', { style: 'font-size:14px' }, f.name),
        h('div', { style: 'font-family:var(--mono);font-size:10.5px;color:var(--faint);margin-top:2px' }, fmtBytes(f.size_bytes))),
      f.url ? h('a', { href: f.url, target: '_blank', rel: 'noopener', class: 'btn-ghost', style: 'padding:5px 12px;font-size:12px' }, t('files.download')) : null));
  }
  card.appendChild(wrap);
  return card;
}

/* ── client <-> operator message thread ── */
function buildMessagesCard(view, portalToken) {
  const card = h('div', { class: 'portal-card' });
  card.appendChild(h('h2', { class: 'portal-card-title' }, t('msg.title')));
  card.appendChild(h('p', { class: 'subtle', style: 'margin:-4px 0 14px;font-size:13px' }, t('msg.intro')));
  const thread = h('div', { style: 'display:flex;flex-direction:column;gap:10px;margin-bottom:14px' });
  const empty = h('p', { class: 'subtle', style: 'font-size:13px' }, t('msg.empty'));
  function addBubble(m) {
    const mine = m.sender === 'client';
    thread.appendChild(h('div', { style: `align-self:${mine ? 'flex-end' : 'flex-start'};max-width:82%;border:1px solid var(--line);border-radius:14px;padding:10px 14px;background:${mine ? 'rgba(34,211,238,0.08)' : 'var(--card)'}` },
      h('div', { style: 'font-family:var(--mono);font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:var(--faint);margin-bottom:4px' }, mine ? t('msg.you') : 'Jason'),
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
      const r = await fetch(`/api/portal?id=${encodeURIComponent(portalToken)}${getSess(portalToken) ? `&s=${encodeURIComponent(getSess(portalToken))}` : ``}`);
      const j = r.ok ? await r.json().catch(() => null) : null;
      const list = j && j.ok && Array.isArray(j.messages) ? j.messages : null;
      if (list && list.length > shown) {
        if (thread.contains(empty)) clear(thread);
        for (let i = shown; i < list.length; i++) addBubble(list[i]);
        shown = list.length;
      }
    } catch { /* transient — try again next tick */ }
  }, 25000);

  const ta = h('textarea', { rows: '3', placeholder: t('msg.placeholder'), style: 'width:100%;box-sizing:border-box;background:#0F0F13;border:1px solid var(--line);border-radius:10px;color:var(--ink);font-family:inherit;font-size:14px;padding:10px 12px;resize:vertical' });
  const btn = h('button', { type: 'button', class: 'btn-solid green', style: 'margin-top:8px;padding:9px 18px;font-size:13px' }, t('msg.send'));
  const status = h('span', { class: 'subtle', style: 'font-size:12px;margin-left:10px' }, '');
  btn.addEventListener('click', () => {
    const text = (ta.value || '').trim();
    if (text.length < 1) return;
    btn.disabled = true; clear(status); status.appendChild(document.createTextNode(t('msg.sending')));
    fetch('/api/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'message', portalToken, body: text, session: getSess(portalToken) }) })
      .then((r) => r.json().catch(() => null)).then((d) => {
        btn.disabled = false; clear(status);
        if (d && d.ok) { if (thread.contains(empty)) clear(thread); addBubble({ sender: 'client', body: text, created_at: new Date().toISOString() }); shown += 1; ta.value = ''; }
        else { status.appendChild(document.createTextNode(t('msg.sendErr') + ' ')); status.appendChild(h('a', { href: `mailto:${CONTACT_EMAIL}`, style: 'color:#22d3ee' }, CONTACT_EMAIL)); status.appendChild(document.createTextNode('.')); }
      }).catch(() => { btn.disabled = false; clear(status); status.appendChild(document.createTextNode(t('msg.network'))); });
  });
  card.appendChild(h('div', {}, ta, h('div', { style: 'display:flex;align-items:center' }, btn, status)));
  return card;
}

/* ── project progress stepper (Kickoff → Building → Delivered → Complete) ── */
/* ── project assistant: grounded, read-only Q&A about THIS project ── */
function buildAssistantCard(portalToken) {
  const card = h('div', { class: 'portal-card' });
  card.appendChild(h('h2', { class: 'portal-card-title' }, t('asst.title')));
  card.appendChild(h('p', { class: 'subtle', style: 'margin:-4px 0 12px;font-size:13px' }, t('asst.intro')));

  const thread = h('div', { style: 'display:flex;flex-direction:column;gap:10px;margin-bottom:12px' });
  const status = h('span', { class: 'subtle', style: 'font-size:12px' }, '');
  const ASSISTANT = 'Assistant';
  function bubble(who, text, mine) {
    thread.appendChild(h('div', { style: `align-self:${mine ? 'flex-end' : 'flex-start'};max-width:88%;border:1px solid var(--line);border-radius:14px;padding:10px 14px;background:${mine ? 'rgba(34,211,238,0.08)' : 'var(--card)'}` },
      h('div', { style: 'font-family:var(--mono);font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:var(--faint);margin-bottom:4px' }, who),
      h('div', { style: 'font-size:14px;line-height:1.6;color:var(--ink);white-space:pre-wrap' }, text)));
  }

  const input = h('input', { type: 'text', placeholder: t('asst.placeholder'), style: 'width:100%;box-sizing:border-box;background:#0F0F13;border:1px solid var(--line);border-radius:10px;color:var(--ink);font-family:inherit;font-size:14px;padding:10px 12px' });
  const btn = h('button', { type: 'button', class: 'btn-solid green', style: 'margin-top:8px;padding:9px 18px;font-size:13px' }, t('asst.send'));
  let busy = false;
  async function ask(preset) {
    const question = String(preset || input.value || '').trim();
    if (!question || busy) return;
    busy = true; btn.disabled = true; input.value = '';
    bubble(t('asst.you'), question, true);
    clear(status); status.appendChild(document.createTextNode(t('asst.sending')));
    try {
      const r = await fetch('/api/portal-assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ portalToken, question }) });
      const d = await r.json().catch(() => null);
      clear(status);
      if (d && d.ok && d.answer) bubble(ASSISTANT, d.answer, false);
      else if (d && d.skipped) bubble(ASSISTANT, t('asst.offline'), false);
      else bubble(ASSISTANT, t('asst.error'), false);
    } catch { clear(status); bubble(ASSISTANT, t('asst.error'), false); }
    busy = false; btn.disabled = false;
  }
  btn.addEventListener('click', () => ask());
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ask(); } });

  const chips = h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px' });
  [t('asst.q1'), t('asst.q2'), t('asst.q3')].forEach((q) => {
    const chip = h('button', { type: 'button', class: 'btn-ghost', style: 'padding:6px 12px;font-size:12px' }, q);
    chip.addEventListener('click', () => ask(q));
    chips.appendChild(chip);
  });
  card.appendChild(chips);
  card.appendChild(thread);
  card.appendChild(h('div', {}, input, h('div', { style: 'display:flex;align-items:center;gap:10px' }, btn, status)));
  return card;
}

function buildStepper(view, plan) {
  const STAGES = [t('step.kickoff'), t('step.building'), t('step.delivered'), t('step.complete')];
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

  // Animated progress rail: a connected metro-line with a lit, pulsing current stage.
  const card = h('div', { class: 'portal-card portal-progress' });
  card.appendChild(h('div', { class: 'pp-head' },
    h('span', { class: 'pp-stage' }, STAGES[idx]),
    h('span', { class: 'pp-of' }, `stage ${idx + 1} of ${STAGES.length}`)));
  const rail = h('div', { class: 'portal-rail' });
  rail.appendChild(h('div', { class: 'prog', style: `width:${idx * 25}%` }));
  STAGES.forEach((label, i) => {
    const done = i < idx; const current = i === idx;
    rail.appendChild(h('div', { class: `portal-stage${done ? ' done' : ''}${current ? ' current' : ''}` },
      h('span', { class: 'knob' }, done ? '✓' : String(i + 1)),
      h('span', { class: 'lb' }, label)));
  });
  card.appendChild(rail);
  return card;
}

const fmtDay = (iso) => { try { return new Date(iso).toLocaleDateString(LOCALE, { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return ''; } };

// Invoice & receipt history — sent/paid invoices only (drafts never reach the client). Each
// paid invoice opens a clean, printable receipt.
function buildInvoicesCard(view) {
  const invoices = Array.isArray(view.invoices) ? view.invoices : [];
  if (!invoices.length) return null;
  const card = h('div', { class: 'portal-card' }, h('h2', { class: 'portal-card-title' }, t('invoices.title')));
  for (const inv of invoices) {
    const kindLabel = t('invoices.kind.' + inv.kind);
    const statusPill = h('span', { class: 'portal-badge', style: inv.paid ? 'color:var(--green);border-color:var(--green)' : '' }, inv.paid ? t('invoices.paid') : t('invoices.sent'));
    const row = h('div', { style: 'display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--line);flex-wrap:wrap' },
      h('span', { class: 'mono', style: 'font-size:12px;color:var(--muted,#8E8882)' }, 'INV-' + inv.invoice_no),
      h('span', { style: 'font-size:13px' }, kindLabel),
      statusPill,
      h('span', { style: 'flex:1' }),
      h('span', { class: 'mono', style: 'font-weight:600' }, money(inv.amount_cents)));
    if (inv.paid) {
      const rb = h('button', { type: 'button', class: 'btn-ghost', style: 'padding:6px 12px;font-size:12px' }, t('invoices.receipt'));
      rb.addEventListener('click', () => showReceipt(inv));
      row.appendChild(rb);
    } else if (inv.due_at) {
      row.appendChild(h('span', { class: 'mono', style: 'font-size:11px;color:var(--muted,#8E8882)' }, t('invoices.due', { date: fmtDay(inv.due_at) })));
    }
    card.appendChild(row);
  }
  return card;
}

// A printable, self-contained receipt overlay for a single paid invoice.
function showReceipt(inv) {
  const overlay = h('div', { class: 'receipt-overlay', role: 'dialog', 'aria-modal': 'true',
    style: 'position:fixed;inset:0;z-index:300;background:rgba(6,6,8,.72);display:flex;align-items:flex-start;justify-content:center;padding:6vh 16px;overflow:auto' });
  const line = (l, v, strong) => h('div', { style: `display:flex;justify-content:space-between;gap:16px;padding:9px 0;border-bottom:1px solid #eee;font-size:${strong ? '16px' : '14px'};font-weight:${strong ? '700' : '400'}` }, h('span', {}, l), h('span', { style: 'font-variant-numeric:tabular-nums' }, v));
  const doc = h('div', { class: 'receipt-doc', style: 'width:min(560px,100%);background:#fff;color:#111;border-radius:14px;padding:36px 34px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif' },
    h('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid #111;padding-bottom:14px;margin-bottom:20px' },
      h('span', { style: 'font-weight:800;font-size:18px' }, 'Sage Ideas'),
      h('span', { style: 'font-weight:800;font-size:13px;letter-spacing:.08em;color:#0F9D6C' }, t('receipt.paid'))),
    h('div', { style: 'font-size:21px;font-weight:700' }, t('receipt.heading')),
    h('div', { style: 'color:#666;font-size:13px;margin-bottom:20px' }, t('receipt.for', { no: inv.invoice_no })),
    line(t('invoices.kind.' + inv.kind), money(inv.amount_cents), true),
    line(t('invoices.paid'), fmtDay(inv.sent_at || inv.issued_at)),
    h('p', { style: 'color:#666;font-size:12px;margin-top:18px;line-height:1.5' }, 'Thank you for your business. — Jason, Sage Ideas'));
  const printBtn = h('button', { type: 'button', class: 'btn-ghost no-print', style: 'padding:9px 16px;font-size:13px' }, t('billing.print'));
  printBtn.addEventListener('click', () => { document.body.classList.add('receipting'); window.print(); setTimeout(() => document.body.classList.remove('receipting'), 400); });
  const closeBtn = h('button', { type: 'button', class: 'btn-ghost no-print', style: 'padding:9px 16px;font-size:13px' }, t('receipt.close'));
  closeBtn.addEventListener('click', () => overlay.remove());
  doc.appendChild(h('div', { class: 'no-print', style: 'display:flex;gap:10px;margin-top:22px' }, printBtn, closeBtn));
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) overlay.remove(); });
  document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', esc); } });
  overlay.appendChild(doc);
  document.body.appendChild(overlay);
}

function renderPortal(root, view, portalToken, opts = {}) {
  clear(root);
  const plan = view.plan || {};
  const segLabel = plan.segment && SEGMENTS[plan.segment] ? SEGMENTS[plan.segment].label : null;

  root.appendChild(h('div', { class: 'portal-head' },
    h('div', {},
      h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#22d3ee' }, t('portal.eyebrow')), h('span', { class: 'line' })),
      h('h1', { class: 'portal-title' }, t('portal.title')),
      segLabel ? h('p', { class: 'portal-sub' }, segLabel) : null,
    ),
    statusChip(view.project && view.project.status),
  ));

  // progress stepper
  root.appendChild(buildStepper(view, plan));

  // The plan they bought — itemized from the catalog keys, grouped by phase, display-only.
  const planData = computePlan(Array.isArray(plan.keys) ? plan.keys : [], plan.segment || null);
  const planCard = h('div', { class: 'portal-card' }, h('h2', { class: 'portal-card-title' }, t('plan.title')));
  if (planData.phases.length === 0) {
    planCard.appendChild(h('p', { class: 'subtle' }, t('plan.finalizing')));
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
  const msCard = h('div', { class: 'portal-card' }, h('h2', { class: 'portal-card-title' }, t('ms.title')));
  const milestones = Array.isArray(view.milestones) ? [...view.milestones].sort((a, b) => (a.seq || 0) - (b.seq || 0)) : [];
  if (milestones.length === 0) {
    msCard.appendChild(h('p', { class: 'subtle' }, t('ms.empty')));
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
  const fmtDay = (iso) => { try { return new Date(iso).toLocaleDateString(LOCALE, { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return ''; } };
  const receiptRow = (label, amountCents, sub, paid) => {
    const lbl = h('span', { class: 'lbl' }, label);
    if (sub) lbl.appendChild(h('span', { style: 'display:block;font-size:11px;color:var(--faint);font-family:var(--mono);margin-top:2px' }, sub));
    return h('div', { class: 'portal-pay-row' }, lbl, h('span', { class: 'val', style: paid ? 'color:var(--green)' : '' }, money(amountCents) + (paid ? ' ✓' : '')));
  };
  const payCard = h('div', { class: 'portal-card' },
    h('h2', { class: 'portal-card-title' }, t('billing.title')),
    receiptRow(t('billing.deposit'), plan.deposit_cents, plan.paid_at ? t('billing.paidOn', { date: fmtDay(plan.paid_at) }) : t('billing.pending'), Boolean(plan.paid_at)),
  );
  if (plan.balance_paid_at) {
    payCard.appendChild(receiptRow(t('billing.balance'), plan.balance_cents, t('billing.paidOn', { date: fmtDay(plan.balance_paid_at) }), true));
    payCard.appendChild(h('div', { class: 'portal-pay-row', style: 'border-top:1px solid var(--line);margin-top:6px;padding-top:12px' }, h('span', { class: 'lbl', style: 'font-weight:600' }, t('billing.total')), h('span', { class: 'val', style: 'font-weight:600' }, money(plan.firm_cents))));
    payCard.appendChild(h('p', { class: 'subtle', style: 'margin-top:10px;font-size:13px' }, t('billing.paidInFull')));
    const printBtn = h('button', { type: 'button', class: 'btn-ghost', style: 'margin-top:12px;padding:9px 16px;font-size:13px' }, t('billing.print'));
    printBtn.addEventListener('click', () => window.print());
    payCard.appendChild(printBtn);
  } else if (plan.balance_cents > 0 && opts.justPaid) {
    // Returned from Stripe checkout; webhook not yet processed. Suppress the pay
    // button entirely so a second click can't create a second charge.
    payCard.appendChild(receiptRow(t('billing.balance'), plan.balance_cents, t('billing.paymentSubmitted'), false));
    payCard.appendChild(h('div', { class: 'portal-pay-row', style: 'border-top:1px solid var(--line);margin-top:6px;padding-top:12px' }, h('span', { class: 'lbl', style: 'font-weight:600' }, t('billing.total')), h('span', { class: 'val', style: 'font-weight:600' }, money(plan.firm_cents))));
    payCard.appendChild(h('p', { class: 'subtle', style: 'margin-top:12px;font-size:13px;color:var(--green)' }, t('billing.confirming')));
    // Escape hatch so a delayed webhook never dead-ends the client (reloads without ?balance=paid).
    payCard.appendChild(h('a', { href: `portal.html?id=${encodeURIComponent(portalToken)}`, class: 'subtle', style: 'font-size:12px;color:#22d3ee' }, t('billing.refresh')));
  } else if (plan.balance_cents > 0) {
    payCard.appendChild(receiptRow(t('billing.balanceRemaining'), plan.balance_cents, t('billing.due'), false));
    payCard.appendChild(h('div', { class: 'portal-pay-row', style: 'border-top:1px solid var(--line);margin-top:6px;padding-top:12px' }, h('span', { class: 'lbl', style: 'font-weight:600' }, t('billing.total')), h('span', { class: 'val', style: 'font-weight:600' }, money(plan.firm_cents))));
    const payBtn = h('button', { type: 'button', class: 'btn-solid green', style: 'margin-top:14px;padding:11px 20px;font-size:14px' }, t('billing.pay', { amount: money(plan.balance_cents) }));
    const payStatus = h('span', { class: 'subtle', style: 'font-size:12px;margin-left:10px' }, '');
    payBtn.addEventListener('click', () => {
      // Confirm before sending the client to a real payment page (sensitive action).
      if (!window.confirm(`Continue to secure checkout for the remaining balance of ${money(plan.balance_cents)}?`)) return;
      payBtn.disabled = true; clear(payStatus); payStatus.appendChild(document.createTextNode(t('billing.opening')));
      fetch('/api/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'pay_balance', portalToken, session: getSess(portalToken) }) })
        .then((r) => r.json().catch(() => null)).then((d) => {
          if (d && d.ok && d.url) { window.location.href = d.url; return; }
          if (d && d.alreadyPaid) { window.location.reload(); return; }
          payBtn.disabled = false; clear(payStatus); payStatus.appendChild(document.createTextNode(t('billing.checkoutErr') + ' '));
          payStatus.appendChild(h('a', { href: `mailto:${CONTACT_EMAIL}`, style: 'color:#22d3ee' }, CONTACT_EMAIL));
          payStatus.appendChild(document.createTextNode('.'));
        }).catch(() => { payBtn.disabled = false; clear(payStatus); payStatus.appendChild(document.createTextNode(t('msg.network'))); });
    });
    payCard.appendChild(h('div', {}, payBtn, payStatus));
  } else {
    payCard.appendChild(h('div', { class: 'portal-pay-row' }, h('span', { class: 'lbl' }, t('billing.balance')), h('span', { class: 'val' }, money(plan.balance_cents))));
  }
  root.appendChild(payCard);

  const invCard = buildInvoicesCard(view);
  if (invCard) root.appendChild(invCard);

  // Project assistant — grounded, read-only Q&A about this project.
  root.appendChild(buildAssistantCard(portalToken));

  // Messages — two-way thread with Jason.
  root.appendChild(buildMessagesCard(view, portalToken));

  // Agreement — only shown once a contract has been sent (or accepted).
  if (view.contract && view.contract.public_id) {
    root.appendChild(h('div', { class: 'portal-card' },
      h('h2', { class: 'portal-card-title' }, t('agr.title')),
      h('a', { href: `contract.html?id=${encodeURIComponent(view.contract.public_id)}`, class: 'portal-agreement-link' }, t('agr.view')),
      h('div', { class: 'portal-agreement-status' }, view.contract.status === 'accepted' ? t('agr.accepted') : t('agr.awaiting')),
    ));
  }
}

// ── portal session (proof the visitor entered the email this link was sent to) ──
// Stored per-token in localStorage; the server signs it and enforces the 7-day expiry,
// so a stale/forged value just fails verification server-side and re-locks the portal.
export function sessKey(id) { return `portal_sess_${id}`; }
export function getSess(id) { try { return localStorage.getItem(sessKey(id)) || ''; } catch { return ''; } }
export function setSess(id, s) { try { if (s) localStorage.setItem(sessKey(id), s); } catch { /* private mode */ } }

// The email-verification gate shown when the server returns { locked:true }.
function renderVerify(root, id, emailHint, onVerified) {
  clear(root);
  const status = h('div', { class: 'portal-approve-status', role: 'status', 'aria-live': 'polite', style: 'min-height:20px;margin-top:10px' });
  const emailInput = h('input', { type: 'email', required: 'required', autocomplete: 'email', inputmode: 'email',
    placeholder: 'you@company.com', 'aria-label': 'The email this link was sent to',
    style: 'width:100%;max-width:340px;background:#0F0F13;border:1px solid var(--line);border-radius:9px;padding:11px 13px;font-size:14px;color:var(--ink);font-family:inherit;outline:none' });
  const btn = h('button', { type: 'submit', class: 'btn-solid green', style: 'padding:11px 20px;font-size:13px;margin-top:12px' }, 'Open my project →');
  const form = h('form', { style: 'margin-top:18px' },
    h('label', { for: '', style: 'display:block' }, h('span', { class: 'lbl-text', style: 'display:block;font-size:12.5px;color:var(--dim);margin-bottom:6px' }, 'Enter the email this link was sent to'), emailInput),
    btn, status);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    if (!email) return;
    btn.disabled = true; emailInput.disabled = true; btn.textContent = 'Checking…';
    clear(status);
    try {
      const r = await fetch('/api/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_email', portalToken: id, email }) });
      const j = r.ok ? await r.json().catch(() => null) : null;
      if (j && j.ok && j.session) { setSess(id, j.session); onVerified(); return; }
      status.appendChild(document.createTextNode("That email doesn't match this project. Use the address the link was sent to, or email hello@sageideas.dev."));
    } catch {
      status.appendChild(document.createTextNode('Could not verify right now — check your connection and try again.'));
    }
    btn.disabled = false; emailInput.disabled = false; btn.textContent = 'Open my project →';
  });
  root.appendChild(h('section', { class: 'wrap', style: 'max-width:520px;padding-top:10vh' },
    h('div', { class: 'mono', style: 'font-size:10.5px;letter-spacing:0.12em;text-transform:uppercase;color:var(--cyan)' }, 'Private project portal'),
    h('h1', { class: 'portal-title', style: 'font-size:clamp(1.6rem,3.5vw,2.2rem);margin:12px 0 0' }, 'Verify it’s you'),
    h('p', { class: 'subtle', style: 'margin-top:12px;max-width:52ch' }, emailHint
      ? `This link opens a private project workspace. Confirm the email it was sent to (${emailHint}) to continue.`
      : 'This link opens a private project workspace. Confirm the email it was sent to to continue.'),
    form));
}

async function loadPortal(root, id, justPaid) {
  let json = null;
  try {
    const s = getSess(id);
    const res = await fetch(`/api/portal?id=${encodeURIComponent(id)}${s ? `&s=${encodeURIComponent(s)}` : ''}`);
    if (res.ok) json = await res.json().catch(() => null);
  } catch { /* network error → unavailable */ }

  // Locked = valid token but no verified session yet → show the email gate, then reload.
  if (json && json.ok && json.locked) { renderVerify(root, id, json.emailHint, () => loadPortal(root, id, justPaid)); return; }
  // Covers no id, {ok:false} (not found / bad request), and dormant ({ok:false, reason:'not_configured'}).
  if (!json || !json.ok) { renderUnavailable(root); return; }

  clear(root);
  renderPortal(root, json, id, { justPaid });
  // Give the webhook a moment, then refresh once to pick up the confirmed payment.
  if (justPaid && json.plan && !json.plan.balance_paid_at) {
    setTimeout(async () => {
      try {
        const s = getSess(id);
        const r = await fetch(`/api/portal?id=${encodeURIComponent(id)}${s ? `&s=${encodeURIComponent(s)}` : ''}`);
        const j = r.ok ? await r.json().catch(() => null) : null;
        if (j && j.ok && !j.locked) { clear(root); renderPortal(root, j, id, { justPaid }); }
      } catch { /* keep the confirming state */ }
    }, 4000);
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
  root.appendChild(h('p', { class: 'subtle', style: 'padding-top:8vh;text-align:center' }, t('portal.loading')));
  await loadPortal(root, id, params.get('balance') === 'paid');
}

init().catch(() => {
  const root = document.getElementById('portal-root');
  if (root) renderUnavailable(root);
});
