// Client-facing contract page. Renders the tailored SOW/MSA from /api/contract and posts
// acceptance. The caveat is always shown when a contract loads — this is a drafting aid,
// not executed legal advice. All section text goes through textContent, never innerHTML,
// because section bodies are operator-generated (and may contain the client's own name).
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

/* ── calm, single-note state — covers no id, not-ok (draft/missing), and dormant ── */
function renderUnavailable(root) {
  clear(root);
  root.appendChild(h('div', { class: 'ctr-empty' },
    h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#22d3ee' }, 'agreement'), h('span', { class: 'line' })),
    h('h1', { class: 'sec-title', style: 'font-size:clamp(1.8rem,4vw,2.6rem)' }, "This agreement isn’t available."),
    h('p', { class: 'subtle', style: 'margin-top:12px' }, 'It may have moved, or the link might be off. Talk to me and I’ll help you find it.'),
    bookLink(),
  ));
}

function renderCaveat(caveatText) {
  return h('div', { class: 'ctr-caveat', role: 'note' },
    h('span', { class: 'mk' }, '⚠'),
    h('p', { style: 'margin:0' }, h('strong', {}, 'Heads up: '), caveatText || ''),
  );
}

/* ── the real page: sections + caveat + (accepted confirmation | accept form) ── */
function renderContract(root, contract, publicId) {
  clear(root);
  const kindLabel = contract.kind === 'msa' ? 'master services agreement' : 'statement of work';

  root.appendChild(h('div', {},
    h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#22d3ee' }, kindLabel), h('span', { class: 'line' })),
    h('h1', { class: 'sec-title' }, 'Your agreement'),
    h('p', { class: 'subtle', style: 'margin-top:12px' }, 'Please read it below. If anything looks off, tell me before you accept — nothing here is final until you do.'),
  ));

  root.appendChild(renderCaveat(contract.caveat));

  const sections = Array.isArray(contract.body && contract.body.sections) ? contract.body.sections : [];
  const doc = h('div', { class: 'ctr-card' });
  if (sections.length === 0) {
    doc.appendChild(h('p', { class: 'subtle' }, 'This agreement is being finalized.'));
  } else {
    for (const s of sections) {
      doc.appendChild(h('div', { class: 'ctr-section' }, h('h3', {}, s.heading || ''), h('p', {}, s.body || '')));
    }
  }
  root.appendChild(doc);

  if (contract.status === 'accepted') {
    const acceptedText = formatDate(contract.accepted_at);
    root.appendChild(h('div', { class: 'ctr-card' },
      h('span', { class: 'ctr-status-pill' }, acceptedText ? `✓ Accepted on ${acceptedText}` : '✓ Accepted'),
      h('p', { class: 'subtle', style: 'margin-top:14px' }, 'Thanks — this agreement is signed. A copy is on this page any time you need it.'),
    ));
    return;
  }

  // Accept block — full name + explicit agree checkbox, posted to /api/contract.
  const status = h('div', { class: 'ctr-status', role: 'status', 'aria-live': 'polite' });
  const nameInput = h('input', { id: 'ctr-name', type: 'text', required: 'required', autocomplete: 'name' });
  const agreeInput = h('input', { id: 'ctr-agree', type: 'checkbox', required: 'required' });
  const submitBtn = h('button', { type: 'submit', class: 'btn-solid green' }, 'Accept agreement');

  const form = h('form', { class: 'ctr-form' },
    h('label', { class: 'fld', for: 'ctr-name' }, h('span', { class: 'lbl-text' }, 'Full name'), nameInput),
    h('div', { class: 'ctr-check' }, agreeInput, h('label', { for: 'ctr-agree' }, 'I have read and agree to this agreement')),
    submitBtn,
    status,
  );

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const name = nameInput.value.trim();
    if (name.length < 2 || !agreeInput.checked) {
      clear(status); status.classList.remove('ok'); status.classList.add('err');
      status.appendChild(document.createTextNode('Add your name and check the box to continue.'));
      return;
    }
    status.classList.remove('err'); clear(status);
    nameInput.disabled = true; agreeInput.disabled = true; submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    fetch('/api/contract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicId, action: 'accept', name, agreed: true }),
    })
      .then((res) => res.json().catch(() => null))
      .then((data) => {
        if (data && data.ok) {
          clear(status); status.classList.add('ok');
          status.appendChild(document.createTextNode('Agreement accepted. A copy is on this page.'));
          submitBtn.textContent = 'Accepted';
          return;
        }
        clear(status); status.classList.remove('ok'); status.classList.add('err');
        if (data && data.skipped) {
          status.appendChild(document.createTextNode('Acceptance isn’t switched on yet. Email Jason and he’ll confirm it another way. '));
          status.appendChild(h('a', { href: 'book.html', style: 'color:var(--cyan)' }, 'Book a call →'));
        } else {
          status.appendChild(document.createTextNode('Something went wrong. Email '));
          status.appendChild(h('a', { href: `mailto:${CONTACT_EMAIL}`, style: 'color:var(--cyan)' }, CONTACT_EMAIL));
          status.appendChild(document.createTextNode(' and I’ll get you sorted.'));
        }
        nameInput.disabled = false; agreeInput.disabled = false; submitBtn.disabled = false;
        submitBtn.textContent = 'Accept agreement';
      })
      .catch(() => {
        clear(status); status.classList.remove('ok'); status.classList.add('err');
        status.appendChild(document.createTextNode('Couldn’t reach the server. Email '));
        status.appendChild(h('a', { href: `mailto:${CONTACT_EMAIL}`, style: 'color:var(--cyan)' }, CONTACT_EMAIL));
        status.appendChild(document.createTextNode(' and I’ll get you sorted.'));
        nameInput.disabled = false; agreeInput.disabled = false; submitBtn.disabled = false;
        submitBtn.textContent = 'Accept agreement';
      });
  });

  root.appendChild(h('div', { class: 'ctr-card' }, form));
}

async function init() {
  const root = document.getElementById('contract-root');
  if (!root) return;

  const params = new URLSearchParams(location.search);
  const id = (params.get('id') || '').trim();
  if (!id) { renderUnavailable(root); return; }

  // Immediate placeholder inside the reserved min-height so the fetch->render
  // transition does not shift the page (keeps CLS ~0).
  root.appendChild(h('p', { class: 'subtle', style: 'padding-top:8vh;text-align:center' }, 'Loading your agreement…'));

  let json = null;
  try {
    const res = await fetch(`/api/contract?publicId=${encodeURIComponent(id)}`);
    if (res.ok) json = await res.json().catch(() => null);
  } catch {
    // network error (e.g. static host with no API route) — fall through to unavailable
  }

  // Covers no id, {ok:false} (draft / not found), and dormant ({ok:false, reason:'not_configured'}).
  const contract = json && json.ok ? json.contract : null;
  if (!contract) { renderUnavailable(root); return; }
  renderContract(root, contract, id);
}

init().catch(() => {
  const root = document.getElementById('contract-root');
  if (root) renderUnavailable(root);
});
