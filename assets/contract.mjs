// Client-facing contract page. Renders the tailored SOW/MSA from /api/contract and posts
// acceptance. The caveat is always shown when a contract loads — this is a drafting aid,
// not executed legal advice. All section text goes through textContent, never innerHTML,
// because section bodies are operator-generated (and may contain the client's own name).
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

function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(LOCALE, { year: 'numeric', month: 'long', day: 'numeric' });
}

function bookLink(label) {
  return h('a', { href: 'book.html', class: 'btn-ghost', style: 'border-color:#a78bfa;color:#a78bfa;margin-top:16px;display:inline-flex' }, label || t('hdr.talk'));
}

/* ── calm, single-note state — covers no id, not-ok (draft/missing), and dormant ── */
function renderUnavailable(root) {
  clear(root);
  root.appendChild(h('div', { class: 'ctr-empty' },
    h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#22d3ee' }, 'agreement'), h('span', { class: 'line' })),
    h('h1', { class: 'sec-title', style: 'font-size:clamp(1.8rem,4vw,2.6rem)' }, t('ctr.unavailable.title')),
    h('p', { class: 'subtle', style: 'margin-top:12px' }, t('portal.unavailable.body')),
    bookLink(),
  ));
}

function renderCaveat(caveatText) {
  return h('div', { class: 'ctr-caveat', role: 'note' },
    h('span', { class: 'mk' }, '⚠'),
    h('p', { style: 'margin:0' }, h('strong', {}, t('ctr.headsUp')), caveatText || ''),
  );
}

/* ── the real page: sections + caveat + (accepted confirmation | accept form) ── */
function renderContract(root, contract, publicId) {
  clear(root);
  const kindLabel = contract.kind === 'msa' ? t('ctr.kindMsa') : t('ctr.kindSow');

  root.appendChild(h('div', {},
    h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#22d3ee' }, kindLabel), h('span', { class: 'line' })),
    h('h1', { class: 'sec-title' }, t('ctr.title')),
    h('p', { class: 'subtle', style: 'margin-top:12px' }, t('ctr.readBelow')),
  ));

  root.appendChild(renderCaveat(contract.caveat));

  const sections = Array.isArray(contract.body && contract.body.sections) ? contract.body.sections : [];
  const doc = h('div', { class: 'ctr-card' });
  if (sections.length === 0) {
    doc.appendChild(h('p', { class: 'subtle' }, t('ctr.finalizing')));
  } else {
    for (const s of sections) {
      doc.appendChild(h('div', { class: 'ctr-section' }, h('h3', {}, s.heading || ''), h('p', {}, s.body || '')));
    }
  }
  root.appendChild(doc);

  if (contract.status === 'accepted') {
    const acceptedText = formatDate(contract.accepted_at);
    root.appendChild(h('div', { class: 'ctr-card' },
      h('span', { class: 'ctr-status-pill' }, acceptedText ? t('ctr.acceptedOn', { date: acceptedText }) : t('ctr.acceptedPill')),
      h('p', { class: 'subtle', style: 'margin-top:14px' }, t('ctr.acceptedThanks')),
    ));
    return;
  }

  // Accept block — full name + explicit agree checkbox, posted to /api/contract.
  const status = h('div', { class: 'ctr-status', role: 'status', 'aria-live': 'polite' });
  const nameInput = h('input', { id: 'ctr-name', type: 'text', required: 'required', autocomplete: 'name' });
  const agreeInput = h('input', { id: 'ctr-agree', type: 'checkbox', required: 'required' });
  const submitBtn = h('button', { type: 'submit', class: 'btn-solid green' }, t('ctr.accept'));

  const form = h('form', { class: 'ctr-form' },
    h('label', { class: 'fld', for: 'ctr-name' }, h('span', { class: 'lbl-text' }, t('ctr.fullName')), nameInput),
    h('div', { class: 'ctr-check' }, agreeInput, h('label', { for: 'ctr-agree' }, t('ctr.agree'))),
    submitBtn,
    status,
  );

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const name = nameInput.value.trim();
    if (name.length < 2 || !agreeInput.checked) {
      clear(status); status.classList.remove('ok'); status.classList.add('err');
      status.appendChild(document.createTextNode(t('ctr.needNameBox')));
      return;
    }
    status.classList.remove('err'); clear(status);
    nameInput.disabled = true; agreeInput.disabled = true; submitBtn.disabled = true;
    submitBtn.textContent = t('ctr.sending');

    fetch('/api/contract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicId, action: 'accept', name, agreed: true }),
    })
      .then((res) => res.json().catch(() => null))
      .then((data) => {
        if (data && data.ok) {
          clear(status); status.classList.add('ok');
          status.appendChild(document.createTextNode(t('ctr.acceptedMsg')));
          submitBtn.textContent = t('ctr.accepted');
          return;
        }
        // Already accepted (e.g. a second tab or reload-then-resubmit) is not an error.
        if (data && data.error === 'not_acceptable') {
          clear(status); status.classList.remove('err'); status.classList.add('ok');
          status.appendChild(document.createTextNode(t('ctr.alreadyAccepted')));
          submitBtn.textContent = t('ctr.accepted');
          return;
        }
        clear(status); status.classList.remove('ok'); status.classList.add('err');
        if (data && data.skipped) {
          status.appendChild(document.createTextNode(t('ctr.acceptOff')));
          status.appendChild(h('a', { href: 'book.html', style: 'color:var(--cyan)' }, t('ctr.bookCall')));
        } else {
          status.appendChild(document.createTextNode(t('ctr.errEmail')));
          status.appendChild(h('a', { href: `mailto:${CONTACT_EMAIL}`, style: 'color:var(--cyan)' }, CONTACT_EMAIL));
          status.appendChild(document.createTextNode(t('ctr.errTail')));
        }
        nameInput.disabled = false; agreeInput.disabled = false; submitBtn.disabled = false;
        submitBtn.textContent = t('ctr.accept');
      })
      .catch(() => {
        clear(status); status.classList.remove('ok'); status.classList.add('err');
        status.appendChild(document.createTextNode(t('ctr.network')));
        status.appendChild(h('a', { href: `mailto:${CONTACT_EMAIL}`, style: 'color:var(--cyan)' }, CONTACT_EMAIL));
        status.appendChild(document.createTextNode(t('ctr.errTail')));
        nameInput.disabled = false; agreeInput.disabled = false; submitBtn.disabled = false;
        submitBtn.textContent = t('ctr.accept');
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
  root.appendChild(h('p', { class: 'subtle', style: 'padding-top:8vh;text-align:center' }, t('ctr.loading')));

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
