// Client workspace dashboard — lists the signed-in client's projects (or, for the
// operator, a link into the admin cockpit). Shared across the /es and /pt mirrors;
// all copy comes from i18n so the page renders in the locale set by <html lang>.
// Every dynamic value goes through textContent — never innerHTML.
import { getSession, currentUser, signOut } from './auth.mjs';
import { money } from './proposal-core.mjs';
import { t, LOCALE } from './i18n.mjs';

const STATUS = { kickoff: 'st.kickoff', active: 'st.active', in_progress: 'st.in_progress', delivered: 'st.delivered', complete: 'st.complete', completed: 'st.complete' };
function el(tag, cls, txt) { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }
const fmtDate = (iso) => { if (!iso) return ''; const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(LOCALE, { month: 'short', day: 'numeric', year: 'numeric' }); };

function fmtBytes(n) { if (!n && n !== 0) return ''; if (n < 1024) return n + ' B'; if (n < 1048576) return (n / 1024).toFixed(0) + ' KB'; return (n / 1048576).toFixed(1) + ' MB'; }

// Unified documents & agreements across all the client's projects.
function renderDocs(wrap, docs) {
  wrap.innerHTML = '';
  wrap.appendChild(el('div', 'cx-docs-h', t('dash.docs')));
  wrap.appendChild(el('p', 'cx-sub', t('dash.docsIntro')));
  if (!docs.length) { wrap.appendChild(el('div', 'cx-empty', t('dash.noDocs'))); return; }
  const list = el('div', 'cx-doclist');
  for (const d of docs) {
    const row = el('div', 'cx-docrow');
    row.dataset.search = `${d.name || ''} ${d.project || ''} ${d.kind || ''}`.toLowerCase();
    const meta = el('div', 'cx-docmeta');
    meta.appendChild(el('div', 'nm', d.name || 'Document'));
    meta.appendChild(el('div', 'meta', `${d.project || ''}${d.size ? ' · ' + fmtBytes(d.size) : ''}`));
    row.appendChild(el('span', `cx-docico ${d.kind === 'agreement' ? 'a' : 'f'}`, d.kind === 'agreement' ? '§' : '↓'));
    row.appendChild(meta);
    if (d.href) {
      const a = el('a', 'cx-docbtn', d.kind === 'agreement' ? t('dash.openDoc') : t('dash.download'));
      a.href = d.href; a.target = '_blank'; a.rel = 'noopener';
      if (d.kind === 'file') a.setAttribute('download', '');
      row.appendChild(a);
    }
    list.appendChild(row);
  }
  wrap.appendChild(list);
}

function wireSearch(search, grid, docsWrap, noResults) {
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    let anyProj = false, anyDoc = false;
    [...grid.children].forEach((card) => { const m = !q || card.textContent.toLowerCase().includes(q); card.style.display = m ? '' : 'none'; if (m) anyProj = true; });
    grid.style.display = anyProj ? '' : 'none';
    docsWrap.querySelectorAll('.cx-docrow').forEach((row) => { const m = !q || (row.dataset.search || '').includes(q); row.style.display = m ? '' : 'none'; if (m) anyDoc = true; });
    if (noResults) noResults.style.display = (q && !anyProj && !anyDoc) ? '' : 'none';
  });
}

// "Needs your attention" band — the client's mission-control, aggregated across their
// projects from the counts /api/my-projects now returns. Each item deep-links to the
// portal where the action lives. Rendered only when something actually needs action.
function renderAttention(root, projects) {
  let awaiting = 0, unread = 0, balanceDue = 0, contracts = 0;
  let awaitingTok = null, unreadTok = null, balanceTok = null, contractTok = null;
  for (const p of projects) {
    const plan = p.plan || {};
    if (p.awaitingApproval > 0) { awaiting += p.awaitingApproval; awaitingTok = awaitingTok || p.portalToken; }
    if (p.unreadMessages > 0) { unread += p.unreadMessages; unreadTok = unreadTok || p.portalToken; }
    if (plan.balance_cents > 0 && !plan.balance_paid_at) { balanceDue += plan.balance_cents; balanceTok = balanceTok || p.portalToken; }
    if (p.contract && p.contract.status === 'sent') { contracts += 1; contractTok = contractTok || p.portalToken; }
  }
  if (!(awaiting || unread || balanceDue || contracts)) return;
  const band = el('div');
  band.style.cssText = 'border:1px solid color-mix(in oklab,#22d3ee 40%,var(--line));background:color-mix(in oklab,#22d3ee 7%,var(--card,#0F0F13));border-radius:14px;padding:16px 20px;margin:6px 0 22px';
  const hd = el('div', null, 'Needs your attention');
  hd.style.cssText = 'font-family:var(--mono,monospace);font-size:10.5px;letter-spacing:0.12em;text-transform:uppercase;color:#22d3ee;margin-bottom:12px';
  band.appendChild(hd);
  const items = el('div'); items.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px';
  const addItem = (label, tok, accent) => {
    const a = document.createElement('a');
    a.href = `portal.html?id=${encodeURIComponent(tok)}`;
    a.style.cssText = 'display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:999px;padding:8px 14px;font-size:13px;color:var(--ink);text-decoration:none;background:var(--card,#0F0F13)';
    const dot = el('span'); dot.style.cssText = `width:7px;height:7px;border-radius:50%;flex-shrink:0;background:${accent}`;
    a.appendChild(dot); a.appendChild(document.createTextNode(label)); items.appendChild(a);
  };
  if (contracts) addItem(`${contracts} agreement${contracts > 1 ? 's' : ''} to sign`, contractTok, '#a78bfa');
  if (awaiting) addItem(`${awaiting} milestone${awaiting > 1 ? 's' : ''} awaiting your approval`, awaitingTok, '#10b981');
  if (balanceDue) addItem(`Balance due: ${money(balanceDue)}`, balanceTok, '#f59e0b');
  if (unread) addItem(`${unread} new message${unread > 1 ? 's' : ''}`, unreadTok, '#22d3ee');
  band.appendChild(items);
  root.appendChild(band);
}

// Onboarding progress — surfaces the getting-started checklist on the dashboard home so a
// new client sees it on first login (it used to live only on resources.html). Two steps are
// derived from real data; the four manual steps + toggling live on the resources checklist,
// which this links to (single source of truth — no duplicated toggle logic to drift).
function renderOnboarding(root, projects, accessToken) {
  const agreementAccepted = projects.some((p) => p.contract && p.contract.status === 'accepted');
  const depositPaid = projects.some((p) => (p.plan || {}).paid_at);
  const MANUAL = ['repo_access', 'shared_feature', 'kickoff_booked', 'billing_contact'];
  const MANUAL_LABEL = { repo_access: 'Grant repo / environment access', shared_feature: 'Share the AI feature + where it breaks', kickoff_booked: 'Book the kickoff call', billing_contact: 'Confirm your billing contact' };
  const card = el('div');
  card.style.cssText = 'border:1px solid var(--line);background:var(--card,#0F0F13);border-radius:14px;padding:16px 20px;margin:0 0 22px';
  root.appendChild(card);
  (async () => {
    let steps = {};
    try { const r = await fetch('/api/client-onboarding', { headers: { Authorization: `Bearer ${accessToken}` } }); if (r.ok) { const j = await r.json(); if (j.ok) steps = j.steps || {}; } } catch { /* leave empty */ }
    const all = [
      { label: 'Agreement accepted', done: agreementAccepted },
      { label: 'Deposit paid', done: depositPaid },
      ...MANUAL.map((id) => ({ label: MANUAL_LABEL[id], done: steps[id] === true })),
    ];
    const done = all.filter((s) => s.done).length;
    if (done === all.length) { card.remove(); return; } // fully onboarded → no card
    const hd = el('div', null, `Getting started — ${done} of ${all.length} done`);
    hd.style.cssText = 'font-family:var(--mono,monospace);font-size:10.5px;letter-spacing:0.12em;text-transform:uppercase;color:var(--faint);margin-bottom:12px';
    card.appendChild(hd);
    const list = el('div'); list.style.cssText = 'display:grid;gap:7px';
    for (const s of all) {
      const row = el('div'); row.style.cssText = `display:flex;align-items:center;gap:10px;font-size:13.5px;color:${s.done ? 'var(--faint)' : 'var(--ink)'}`;
      const box = el('span', null, s.done ? '✓' : '○'); box.style.cssText = `width:16px;text-align:center;color:${s.done ? '#10b981' : 'var(--faint)'}`;
      row.append(box, el('span', null, s.label + (s.done ? '' : '')));
      list.appendChild(row);
    }
    card.appendChild(list);
    const link = el('a', null, 'Complete setup →'); link.href = 'resources.html'; link.style.cssText = 'display:inline-block;margin-top:14px;font-family:var(--mono,monospace);font-size:12px;color:var(--cyan);text-decoration:none';
    card.appendChild(link);
  })();
}

export function initDashboard() {
  const root = document.getElementById('root');
  if (!root) return;
  const s = getSession();
  if (!s || !s.access_token) { location.replace('login.html?next=dashboard.html'); return; }

  const emailSlot = document.getElementById('cx-email');
  const logoutBtn = document.getElementById('cx-logout');
  if (logoutBtn) logoutBtn.addEventListener('click', async () => { try { await signOut(); } catch { /* ignore */ } location.href = 'index.html'; });

  (async () => {
    const u = await currentUser();
    if (!u) { location.replace('login.html?next=dashboard.html'); return; }
    if (emailSlot) emailSlot.textContent = u.email || '';

    let data = { projects: [], admin: false, email: u.email };
    let loadError = false;
    try {
      const r = await fetch('/api/my-projects', { headers: { Authorization: `Bearer ${s.access_token}` } });
      if (r.ok) data = await r.json();
      else loadError = true;
    } catch { loadError = true; }

    root.innerHTML = '';
    root.appendChild(el('div', 'cx-eyebrow', t('dash.eyebrow')));
    root.appendChild(el('h1', 'cx-h1', t('dash.title')));
    root.appendChild(el('p', 'cx-sub', t('dash.sub')));

    if (data.admin) {
      const a = el('div', 'cx-admin');
      a.appendChild(el('div', null, t('dash.adminNote')));
      const link = el('a', 'btn-solid green', t('dash.adminOpen')); link.href = 'proposal-admin.html'; link.style.cssText = 'padding:8px 16px;font-size:13px;text-decoration:none';
      a.appendChild(link);
      root.appendChild(a);
    }

    if (loadError) {
      const e = el('div', 'cx-empty');
      e.appendChild(el('div', null, t('dash.loadErr')));
      const p2 = el('p', null, t('dash.loadErrSub')); p2.style.cssText = 'margin-top:8px;font-size:14px';
      const rb = el('button', 'btn-solid green', t('dash.retry')); rb.style.cssText = 'margin-top:16px;padding:9px 18px;font-size:13px;cursor:pointer'; rb.addEventListener('click', () => location.reload());
      e.appendChild(p2); e.appendChild(rb); root.appendChild(e); return;
    }

    const projects = Array.isArray(data.projects) ? data.projects : [];
    if (!projects.length) {
      const e = el('div', 'cx-empty');
      e.appendChild(el('div', null, data.admin ? t('dash.emptyAdmin') : t('dash.empty')));
      const p2 = el('p', null, data.admin ? '' : t('dash.emptySub'));
      p2.style.cssText = 'margin-top:8px;font-size:14px';
      if (!data.admin) { const talk = el('a', null, t('dash.talk')); talk.href = 'book.html'; talk.style.color = 'var(--cyan)'; talk.style.textDecoration = 'none'; p2.appendChild(document.createTextNode(' ')); p2.appendChild(talk); }
      e.appendChild(p2);
      // Email-mismatch hint: a paying client who signed up under a different email than they were
      // invoiced under lands here with nothing. Tell them why + point to the receipt portal link.
      if (!data.admin) {
        const hint = el('p', null, t('dash.emptyMismatch').replace('{email}', u.email || 'this email'));
        hint.style.cssText = 'margin-top:16px;font-size:12.5px;color:var(--faint);line-height:1.65;max-width:54ch';
        e.appendChild(hint);
      }
      root.appendChild(e); return;
    }

    // Mission-control: what needs the client's attention, then their onboarding progress.
    renderAttention(root, projects);
    if (!data.admin) renderOnboarding(root, projects, s.access_token);

    const grid = el('div', 'cx-grid');
    for (const p of projects) {
      const plan = p.plan || {};
      const card = document.createElement('a');
      card.className = 'cx-card'; card.href = `portal.html?id=${encodeURIComponent(p.portalToken)}`;
      const statusKey = STATUS[String(p.status || 'kickoff').toLowerCase()] || 'st.active';
      card.appendChild(el('div', 'st', t(statusKey)));
      card.appendChild(el('div', 'amt', money(plan.firm_cents)));
      let pay;
      if (plan.balance_paid_at) pay = t('dash.paidFull', { date: fmtDate(plan.balance_paid_at) });
      else if (plan.paid_at) pay = t('dash.depositPaid', { date: fmtDate(plan.paid_at), balance: money(plan.balance_cents) });
      else pay = t('dash.awaitingDeposit');
      card.appendChild(el('div', 'pay', pay));
      if (p.contract && p.contract.status === 'sent') card.appendChild(el('span', 'flag sign', t('dash.contractSign')));
      else if (p.contract && p.contract.status === 'accepted') card.appendChild(el('span', 'flag signed', t('dash.contractSigned')));
      card.appendChild(el('div', 'go', t('dash.openProject')));
      grid.appendChild(card);
    }
    root.appendChild(grid);

    // Search + a unified documents view across all their projects.
    const search = el('input'); search.type = 'search'; search.placeholder = t('dash.search'); search.className = 'cx-search';
    root.insertBefore(search, grid);
    const docsWrap = el('div', 'cx-docs'); root.appendChild(docsWrap);
    const noResults = el('p', 'cx-sub', t('dash.noResults')); noResults.style.display = 'none'; root.appendChild(noResults);
    (async () => {
      let docs = [];
      try { const r = await fetch('/api/my-documents', { headers: { Authorization: `Bearer ${s.access_token}` } }); if (r.ok) { const j = await r.json(); if (j.ok) docs = Array.isArray(j.documents) ? j.documents : []; } } catch { /* leave empty */ }
      renderDocs(docsWrap, docs);
      wireSearch(search, grid, docsWrap, noResults);
    })();
  })();
}

initDashboard();
