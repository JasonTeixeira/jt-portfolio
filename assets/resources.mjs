// Interactivity for the Client Resource Center.
// Public visitors get the marketing chrome + a local demo checklist. A logged-in
// client gets the workspace chrome, their real engagement (project/contract/deposit),
// and a server-persisted onboarding checklist whose "agreement accepted" / "deposit
// paid" steps are derived live from real data. Disclosures are keyboard-accessible.
import { currentUser, getSession, signOut } from './auth.mjs';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let uid = 0;
const nextId = (p) => `${p}-${++uid}`;

/* ── tabs (roving tabindex + aria wiring) ── */
const tabs = $$('.rc-tab');
const panels = new Map($$('.rc-panel').map((p) => [p.id.replace('panel-', ''), p]));
tabs.forEach((t) => {
  const name = t.dataset.panel;
  t.id = t.id || `tab-${name}`;
  t.setAttribute('aria-controls', `panel-${name}`);
  const panel = panels.get(name);
  if (panel) panel.setAttribute('aria-labelledby', t.id);
});
function selectTab(name, push = true) {
  if (!panels.has(name)) name = 'overview';
  tabs.forEach((t) => {
    const on = t.dataset.panel === name;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
  });
  panels.forEach((p, key) => { p.hidden = key !== name; });
  if (push && location.hash.slice(1) !== name) history.replaceState(null, '', `#${name}`);
}
tabs.forEach((t) => t.addEventListener('click', () => selectTab(t.dataset.panel)));
$('#rc-tabs').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  e.preventDefault();
  const i = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
  const n = (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
  tabs[n].focus(); selectTab(tabs[n].dataset.panel);
});
$$('.rc-jump').forEach((j) => j.addEventListener('click', () => { selectTab(j.dataset.goto); window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); }));

/* ── accessible disclosure: header (div) acts as a real button controlling a body ── */
function setOpen(item, header, body, open) {
  item.classList.toggle('open', open);
  header.setAttribute('aria-expanded', String(open));
  body.setAttribute('aria-hidden', String(!open));
}
function wireDisclosure(header) {
  const item = header.parentElement;
  const body = header.nextElementSibling;
  if (!body) return;
  if (!body.id) body.id = nextId('rc-disc');
  header.setAttribute('role', 'button');
  header.setAttribute('tabindex', '0');
  header.setAttribute('aria-controls', body.id);
  setOpen(item, header, body, item.classList.contains('open'));
  const toggle = () => setOpen(item, header, body, !item.classList.contains('open'));
  header.addEventListener('click', toggle);
  header.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
}
$$('.rc-track .rc-track-h, #rc-phases .rc-phase-h, #rc-accs .rc-acc-h').forEach(wireDisclosure);

/* ── capabilities: need highlighter ── */
const tracks = $$('.rc-track');
function trackOpen(t, open) {
  const h = t.querySelector('.rc-track-h'); const body = t.querySelector('.rc-track-body');
  setOpen(t, h, body, open);
}
$$('.rc-need').forEach((btn) => btn.addEventListener('click', () => {
  const on = btn.getAttribute('aria-pressed') === 'true';
  $$('.rc-need').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  if (on) { tracks.forEach((t) => { t.classList.remove('dim', 'hot'); trackOpen(t, false); }); return; }
  btn.setAttribute('aria-pressed', 'true');
  const want = btn.dataset.need;
  tracks.forEach((t) => {
    const match = t.dataset.track === want;
    t.classList.toggle('hot', match);
    t.classList.toggle('dim', !match);
    trackOpen(t, match);
  });
}));

/* ── stat count-up ── */
const stats = $$('#rc-stats [data-count]');
function countUp(el) {
  const target = Number(el.dataset.count) || 0;
  const suffix = el.dataset.suffix || '';
  if (reduce || target <= 0) { el.textContent = target + suffix; return; }
  const start = performance.now();
  (function step(now) {
    const p = Math.min(1, (now - start) / 900);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + suffix;
    if (p < 1) requestAnimationFrame(step);
  })(start);
}
if ('IntersectionObserver' in window && !reduce) {
  const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { countUp(en.target); io.unobserve(en.target); } }), { threshold: 0.4 });
  stats.forEach((s) => io.observe(s));
} else { stats.forEach((s) => { s.textContent = (s.dataset.count || s.textContent) + (s.dataset.suffix || ''); }); }

/* ── save as PDF ── */
$('#rc-pdf')?.addEventListener('click', () => window.print());

/* ── onboarding checklist ── logged-out: local demo; logged-in: server + real state ── */
const CHECK_KEY = 'rc_onboarding';
const checklist = $('#rc-checklist');
const progress = $('#rc-check-progress');
function setProgress(done, total) { if (progress) progress.textContent = `${done} / ${total}`; }

function wireLocalChecklist() {
  const rows = $$('.rc-check', checklist);
  const load = () => { try { return JSON.parse(localStorage.getItem(CHECK_KEY) || '{}'); } catch { return {}; } };
  const render = () => { const st = load(); let d = 0; rows.forEach((c) => { const on = !!st[c.dataset.check]; c.classList.toggle('done', on); if (on) d++; }); setProgress(d, rows.length); };
  rows.forEach((c) => {
    c.setAttribute('role', 'button'); c.setAttribute('tabindex', '0');
    const toggle = () => { const st = load(); st[c.dataset.check] = !st[c.dataset.check]; try { localStorage.setItem(CHECK_KEY, JSON.stringify(st)); } catch { /* ignore */ } render(); };
    c.addEventListener('click', toggle);
    c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  });
  render();
}

function el(tag, cls, txt) { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }
function authFetch(path, opts = {}) {
  const s = getSession();
  const headers = { ...(opts.headers || {}) };
  if (s && s.access_token) headers.Authorization = `Bearer ${s.access_token}`;
  return fetch(path, { ...opts, headers });
}

// The two auto-derived steps (from real data) + the four manual, server-persisted steps.
const AUTO_STEPS = [
  { id: 'agreement_accepted', label: 'Agreement accepted' },
  { id: 'deposit_paid', label: 'Deposit paid' },
];
const MANUAL_STEPS = [
  { id: 'repo_access', label: 'Grant repo / environment access' },
  { id: 'shared_feature', label: 'Share the AI feature and where it breaks today' },
  { id: 'kickoff_booked', label: 'Book the kickoff call' },
  { id: 'billing_contact', label: 'Confirm your billing contact' },
];

function buildAuthedChecklist(auto, manual) {
  checklist.innerHTML = '';
  const rows = [];
  const total = AUTO_STEPS.length + MANUAL_STEPS.length;
  const recount = () => setProgress(rows.filter((r) => r.classList.contains('done')).length, total);

  AUTO_STEPS.forEach((s) => {
    const row = el('div', 'rc-check' + (auto[s.id] ? ' done' : ''));
    row.append(el('span', 'box', '✓'), el('span', 'lbl2', s.label));
    const tag = el('span', null, auto[s.id] ? 'done automatically' : 'waiting on this');
    tag.style.cssText = 'margin-left:auto;font-family:var(--mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);align-self:center';
    row.append(tag);
    row.style.cursor = 'default';
    checklist.append(row); rows.push(row);
  });

  MANUAL_STEPS.forEach((s) => {
    const row = el('div', 'rc-check' + (manual[s.id] ? ' done' : ''));
    row.setAttribute('role', 'button'); row.setAttribute('tabindex', '0');
    row.append(el('span', 'box', '✓'), el('span', 'lbl2', s.label));
    const toggle = async () => {
      const next = !row.classList.contains('done');
      row.classList.toggle('done', next); recount(); // optimistic
      const r = await authFetch('/api/client-onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ step: s.id, done: next }) })
        .then((x) => x.json().catch(() => null)).catch(() => null);
      if (!r || !r.ok) { row.classList.toggle('done', !next); recount(); } // roll back on failure
    };
    row.addEventListener('click', toggle);
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    checklist.append(row); rows.push(row);
  });
  recount();
}

function money(cents) { const n = Number(cents); if (!Number.isFinite(n)) return ''; return '$' + Math.round(n / 100).toLocaleString('en-US'); }

function renderEngagement(mount, projects) {
  mount.innerHTML = '';
  const rule = el('div', 'rc-rule'); rule.append(el('span', 'lbl', 'your engagement'), el('span', 'line')); mount.append(rule);
  if (!projects.length) {
    const card = el('div', 'rc-pcard');
    card.append(el('h4', null, 'No active project yet'));
    card.append(el('p', null, 'Once your proposal is accepted it shows up here with your milestones, contract, and billing.'));
    mount.append(card); return;
  }
  const grid = el('div', 'rc-cards');
  projects.forEach((p) => {
    const plan = p.plan || {};
    const card = el('div', 'rc-pcard');
    card.append(el('h4', null, 'Your project'));
    const bits = el('p', null);
    const contract = p.contract && p.contract.status === 'accepted' ? 'Contract signed' : (p.contract ? 'Contract awaiting your signature' : 'Contract pending');
    const pay = plan.balance_paid_at ? 'Paid in full' : (plan.paid_at ? `Deposit paid · ${money(plan.balance_cents)} balance due` : 'Awaiting deposit');
    bits.textContent = `${contract} · ${pay}`;
    card.append(bits);
    if (p.portalToken) {
      const a = el('a', null, 'Open your project portal →');
      a.href = `portal.html?id=${encodeURIComponent(p.portalToken)}`;
      a.style.cssText = 'display:inline-block;margin-top:10px;font-family:var(--mono);font-size:12px;color:var(--cyan);text-decoration:none';
      card.append(a);
    }
    grid.append(card);
  });
  mount.append(grid);
}

async function initAuthed(user) {
  document.body.classList.add('rc-authed');
  const emailSlot = $('#rc-client-email'); if (emailSlot) emailSlot.textContent = user.email || '';
  const logout = $('#rc-client-logout');
  if (logout) logout.addEventListener('click', async () => { try { await signOut(); } catch { /* ignore */ } location.href = 'index.html'; });

  // real engagement + auto onboarding state
  let projects = [];
  try { const r = await authFetch('/api/my-projects').then((x) => x.json().catch(() => null)); if (r && r.ok) projects = Array.isArray(r.projects) ? r.projects : []; } catch { /* leave empty */ }
  const engagement = $('#rc-engagement'); if (engagement) renderEngagement(engagement, projects);

  const auto = {
    agreement_accepted: projects.some((p) => p.contract && p.contract.status === 'accepted'),
    deposit_paid: projects.some((p) => p.plan && p.plan.paid_at),
  };
  let manual = {};
  try { const r = await authFetch('/api/client-onboarding').then((x) => x.json().catch(() => null)); if (r && r.ok && r.steps) manual = r.steps; } catch { /* empty */ }
  if (checklist) buildAuthedChecklist(auto, manual);
}

// boot: default to public/local; upgrade to authed if a valid session resolves
selectTab(location.hash.slice(1) || 'overview', false);
window.addEventListener('hashchange', () => selectTab(location.hash.slice(1) || 'overview', false));
if (checklist) wireLocalChecklist();
currentUser().then((u) => { if (u) initAuthed(u); }).catch(() => { /* stay public */ });
