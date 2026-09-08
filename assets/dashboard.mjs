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
      e.appendChild(p2); root.appendChild(e); return;
    }

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
  })();
}

initDashboard();
