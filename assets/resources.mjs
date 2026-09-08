// Interactivity for the Client Resource Center: tabs, expandable capability tracks
// + a "what do you need?" highlighter, an accordion process timeline, a browser-saved
// onboarding checklist, a security accordion, animated stats, and Save-as-PDF.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── tabs ── */
const tabs = $$('.rc-tab');
const panels = new Map($$('.rc-panel').map((p) => [p.id.replace('panel-', ''), p]));
function selectTab(name, push = true) {
  if (!panels.has(name)) name = 'overview';
  tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.panel === name)));
  panels.forEach((p, key) => { p.hidden = key !== name; });
  if (push && location.hash.slice(1) !== name) history.replaceState(null, '', `#${name}`);
}
tabs.forEach((t) => t.addEventListener('click', () => selectTab(t.dataset.panel)));
$('#rc-tabs').addEventListener('keydown', (e) => {
  const i = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault();
    const n = (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
    tabs[n].focus(); selectTab(tabs[n].dataset.panel);
  }
});
$$('.rc-jump').forEach((j) => j.addEventListener('click', () => { selectTab(j.dataset.goto); window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); }));
selectTab(location.hash.slice(1) || 'overview', false);

/* ── capabilities: expandable tracks + need highlighter ── */
$$('.rc-track .rc-track-h').forEach((h) => h.addEventListener('click', () => h.parentElement.classList.toggle('open')));
const tracks = $$('.rc-track');
$$('.rc-need').forEach((btn) => btn.addEventListener('click', () => {
  const on = btn.getAttribute('aria-pressed') === 'true';
  $$('.rc-need').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  if (on) { tracks.forEach((t) => t.classList.remove('dim', 'hot')); return; }
  btn.setAttribute('aria-pressed', 'true');
  const want = btn.dataset.need;
  tracks.forEach((t) => {
    const match = t.dataset.track === want;
    t.classList.toggle('hot', match);
    t.classList.toggle('dim', !match);
    t.classList.toggle('open', match);
  });
}));

/* ── how we work: phase accordion (independent toggles) ── */
$$('#rc-phases .rc-phase-h').forEach((h) => h.addEventListener('click', () => h.parentElement.classList.toggle('open')));

/* ── data & security: accordion ── */
$$('#rc-accs .rc-acc-h').forEach((h) => h.addEventListener('click', () => h.parentElement.classList.toggle('open')));

/* ── onboarding checklist (saved in the browser) ── */
const CHECK_KEY = 'rc_onboarding';
const checks = $$('#rc-checklist .rc-check');
const progress = $('#rc-check-progress');
function loadChecks() { try { return JSON.parse(localStorage.getItem(CHECK_KEY) || '{}'); } catch { return {}; } }
function renderChecks() {
  const state = loadChecks();
  let done = 0;
  checks.forEach((c) => { const on = !!state[c.dataset.check]; c.classList.toggle('done', on); if (on) done++; });
  if (progress) progress.textContent = `${done} / ${checks.length}`;
}
checks.forEach((c) => c.addEventListener('click', () => {
  const state = loadChecks();
  state[c.dataset.check] = !state[c.dataset.check];
  try { localStorage.setItem(CHECK_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  renderChecks();
}));
renderChecks();

/* ── animated stat count-up ── */
const stats = $$('#rc-stats [data-count]');
function countUp(el) {
  const target = Number(el.dataset.count) || 0;
  const suffix = el.dataset.suffix || '';
  if (reduce || target <= 0) { el.textContent = target + suffix; return; }
  const dur = 900; const start = performance.now();
  function step(now) {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * eased) + suffix;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
if ('IntersectionObserver' in window && !reduce) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { countUp(en.target); io.unobserve(en.target); } });
  }, { threshold: 0.4 });
  stats.forEach((s) => io.observe(s));
} else {
  stats.forEach((s) => { s.textContent = (s.dataset.count || s.textContent) + (s.dataset.suffix || ''); });
}

/* ── save as PDF (print CSS flattens everything to a clean doc) ── */
$('#rc-pdf')?.addEventListener('click', () => window.print());
