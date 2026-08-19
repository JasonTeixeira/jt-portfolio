// Client-facing proposal page. Renders scope + price + terms from the server response
// and posts acceptance to start the deposit checkout. Every dynamic value goes through
// textContent or DOM properties — never innerHTML — because this page renders whatever
// the API and the plan give it, including client-editable fields (scope_note).
import { computePlan } from './scope-core.mjs';
import { TERMS, money, PROPOSAL_STATUS } from './proposal-core.mjs';

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

function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function bookLink(label) {
  return h('a', { href: 'book.html', class: 'btn-ghost', style: 'border-color:#a78bfa;color:#a78bfa;margin-top:16px;display:inline-flex' }, label || 'Talk to Jason →');
}

/* ── calm, single-note states ── */
function renderUnavailable(root) {
  clear(root);
  root.appendChild(h('div', { class: 'prop-empty' },
    h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#22d3ee' }, 'proposal'), h('span', { class: 'line' })),
    h('h1', { class: 'sec-title', style: 'font-size:clamp(1.8rem,4vw,2.6rem)' }, "This proposal isn’t available."),
    h('p', { class: 'subtle', style: 'margin-top:12px' }, 'It may have moved, expired, or the link might be off. Talk to me and I’ll help you find it.'),
    bookLink(),
  ));
}

function renderExpired(root) {
  clear(root);
  root.appendChild(h('div', { class: 'prop-empty' },
    h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#F59E0B' }, 'proposal expired'), h('span', { class: 'line' })),
    h('h1', { class: 'sec-title', style: 'font-size:clamp(1.8rem,4vw,2.6rem)' }, 'This proposal has expired.'),
    h('p', { class: 'subtle', style: 'margin-top:12px' }, 'Scope and pricing may have moved since I put this together. Talk to me and I’ll get you a fresh version fast.'),
    bookLink(),
  ));
}

function renderPaid(root, proposal) {
  clear(root);
  const balance = typeof proposal.balance_cents === 'number' ? money(proposal.balance_cents, proposal.currency || 'usd') : null;
  root.appendChild(h('div', { class: 'prop-empty' },
    h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#10b981' }, 'deposit received'), h('span', { class: 'line' })),
    h('h1', { class: 'sec-title', style: 'font-size:clamp(1.8rem,4vw,2.6rem)' }, 'Thanks. The deposit’s in.'),
    h('p', { class: 'subtle', style: 'margin-top:12px' }, 'I have what I need to get started. Here’s what’s still ahead.'),
    balance ? h('div', { class: 'prop-card', style: 'text-align:left;max-width:420px;margin-left:auto;margin-right:auto' },
      h('div', { class: 'price-row', style: 'border-top:none;padding-top:0' },
        h('span', { class: 'lbl' }, 'Balance on delivery'),
        h('span', { class: 'val' }, balance))) : null,
    h('p', { class: 'subtle', style: 'margin-top:16px' }, 'Questions before I dive in? Email ',
      h('a', { href: `mailto:${CONTACT_EMAIL}`, style: 'color:var(--cyan)' }, CONTACT_EMAIL), ' or ',
      h('a', { href: 'book.html', style: 'color:var(--cyan)' }, 'book a call'), '.'),
  ));
}

/* ── the real page: SOW + price block + terms + accept form ── */
function renderApproved(root, proposal, publicId, opts) {
  clear(root);
  const currency = proposal.currency || 'usd';
  const plan = computePlan(Array.isArray(proposal.keys) ? proposal.keys : [], proposal.segment || null);

  const header = h('div', {},
    h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#22d3ee' }, 'your proposal'), h('span', { class: 'line' })),
    h('h1', { class: 'sec-title' }, "Here’s your plan and what it costs."),
    h('p', { class: 'subtle', style: 'margin-top:12px' }, 'Everything below is what’s included, what it costs, and how it works. If anything looks off, just say so. Nothing here is final until you accept it.'),
  );
  root.appendChild(header);
  if (opts && opts.pendingPaid) {
    root.appendChild(h('p', { class: 'subtle', style: 'margin-top:10px;color:#F59E0B' },
      'If you just paid, it can take a moment to confirm. Refresh in a minute.'));
  }

  // SOW — the hero: itemized, grouped by phase, all text from the plan
  const sow = h('div', { class: 'prop-card' });
  if (plan.phases.length === 0) {
    sow.appendChild(h('p', { class: 'subtle' }, 'Scope details are being finalized.'));
  }
  for (const phase of plan.phases) {
    const phaseBlock = h('div', { class: 'prop-phase' }, h('h3', {}, phase.label));
    for (const item of phase.items) {
      phaseBlock.appendChild(h('div', { class: 'prop-item' },
        h('div', { class: 'name' }, item.name),
        h('div', { class: 'why' }, item.why),
      ));
    }
    sow.appendChild(phaseBlock);
  }
  root.appendChild(sow);

  // Price block — the signature element. Every number comes straight from the server.
  const firm = money(proposal.firm_cents, currency);
  const deposit = money(proposal.deposit_cents, currency);
  const balance = money(proposal.balance_cents, currency);
  root.appendChild(h('div', { class: 'price-block' },
    h('div', { class: 'mono', style: 'font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#8E8882' }, 'Firm price'),
    h('div', { class: 'price-firm' }, firm),
    h('div', { class: 'price-row' }, h('span', { class: 'lbl' }, 'Deposit to start'), h('span', { class: 'val' }, deposit)),
    h('div', { class: 'price-row' }, h('span', { class: 'lbl' }, 'Balance on delivery'), h('span', { class: 'val' }, balance)),
  ));

  if (proposal.scope_note && String(proposal.scope_note).trim()) {
    root.appendChild(h('div', { class: 'prop-card' },
      h('h3', { style: 'font-family:var(--mono);font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#a78bfa;margin:0 0 10px' }, 'Note'),
      h('p', { class: 'subtle', style: 'margin:0' }, proposal.scope_note),
    ));
  }

  // Terms
  const termsCard = h('div', { class: 'prop-card' },
    h('h3', { style: 'font-family:var(--mono);font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#8E8882;margin:0 0 4px' }, 'Terms'));
  for (const t of TERMS) {
    termsCard.appendChild(h('div', { class: 'terms-item' }, h('h4', {}, t.heading), h('p', {}, t.body)));
  }
  root.appendChild(termsCard);

  const expiryText = formatDate(proposal.expires_at);
  if (expiryText) {
    root.appendChild(h('p', { class: 'subtle', style: 'margin-top:14px;font-size:12.5px' }, `This proposal is valid until ${expiryText}.`));
  }

  // Accept form
  const status = h('div', { class: 'prop-status', role: 'status', 'aria-live': 'polite' });
  const nameInput = h('input', { id: 'prop-name', type: 'text', required: 'required', autocomplete: 'name' });
  const agreeInput = h('input', { id: 'prop-agree', type: 'checkbox', required: 'required' });
  const submitBtn = h('button', { type: 'submit', class: 'btn-solid green' }, 'Accept & pay the deposit');

  const form = h('form', { class: 'prop-form' },
    h('label', { class: 'fld', for: 'prop-name' }, h('span', { class: 'lbl-text' }, 'Full name'), nameInput),
    h('div', { class: 'prop-check' }, agreeInput, h('label', { for: 'prop-agree' }, 'I agree to the terms above')),
    submitBtn,
    status,
  );

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const name = nameInput.value.trim();
    if (name.length < 2 || !agreeInput.checked) {
      clear(status);
      status.classList.add('err');
      status.appendChild(document.createTextNode('Add your name and check the box to continue.'));
      return;
    }
    status.classList.remove('err');
    clear(status);
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    fetch('/api/proposal-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicId, acceptName: name, agreed: true }),
    })
      .then((res) => res.json().catch(() => null))
      .then((data) => {
        if (data && data.ok && data.url) {
          window.location.assign(data.url);
          return;
        }
        clear(status);
        if (data && data.skipped) {
          status.appendChild(document.createTextNode('Payments aren’t switched on yet. Email Jason and he’ll send a link. '));
          status.appendChild(h('a', { href: 'book.html', style: 'color:var(--cyan)' }, 'Book a call →'));
        } else {
          status.classList.add('err');
          status.appendChild(document.createTextNode('Something went wrong. Email '));
          status.appendChild(h('a', { href: `mailto:${CONTACT_EMAIL}`, style: 'color:var(--cyan)' }, CONTACT_EMAIL));
          status.appendChild(document.createTextNode(' and I’ll get you sorted.'));
        }
        submitBtn.disabled = false;
        submitBtn.textContent = 'Accept & pay the deposit';
      })
      .catch(() => {
        clear(status);
        status.classList.add('err');
        status.appendChild(document.createTextNode('Couldn’t reach the server. Email '));
        status.appendChild(h('a', { href: `mailto:${CONTACT_EMAIL}`, style: 'color:var(--cyan)' }, CONTACT_EMAIL));
        status.appendChild(document.createTextNode(' and I’ll get you sorted.'));
        submitBtn.disabled = false;
        submitBtn.textContent = 'Accept & pay the deposit';
      });
  });

  root.appendChild(h('div', { class: 'prop-card' }, form));
}

async function init() {
  const root = document.getElementById('proposal-root');
  if (!root) return;

  const params = new URLSearchParams(location.search);
  const id = (params.get('id') || '').trim();
  const paidFlag = params.get('paid') === '1';

  if (!id) { renderUnavailable(root); return; }

  let json = null;
  try {
    const res = await fetch(`/api/proposal?publicId=${encodeURIComponent(id)}`);
    if (res.ok) json = await res.json().catch(() => null);
  } catch {
    // network error (e.g. static host with no API route) — fall through to unavailable
  }

  const proposal = json && json.ok ? json.proposal : null;
  if (!proposal) { renderUnavailable(root); return; }

  if (proposal.status === PROPOSAL_STATUS.EXPIRED) { renderExpired(root); return; }
  if (proposal.status === PROPOSAL_STATUS.PAID) { renderPaid(root, proposal); return; }
  if (proposal.status === PROPOSAL_STATUS.APPROVED) { renderApproved(root, proposal, id, { pendingPaid: paidFlag }); return; }
  renderUnavailable(root);
}

init().catch(() => {
  const root = document.getElementById('proposal-root');
  if (root) renderUnavailable(root);
});
