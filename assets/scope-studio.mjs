// Scope Studio page controller — offline question flow + a live system blueprint.
// As you pick needs, a real architecture diagram assembles (nodes per capability,
// grouped by phase, colored by track) and resolves to a "proven" verdict when an
// eval gate is present. Everything is deterministic; numbers come only from the rate card.
// Defines window.__renderScopePlan (blueprint + HUD + itemized plan) directly.

import { QUESTIONS, keysFromAnswers, computePlan, encodeKeys, decodeKeys, DISCLAIMER, CARD_BY_KEY } from './scope-core.mjs';

const TRACK_COLOR = { 'AI Build': '#22d3ee', 'Eval & QA': '#a78bfa', 'Test Automation': '#10b981', 'Automation': '#F59E0B', 'Product': '#8FA0FF' };
const PHASE_COLOR = { audit: '#8FA0FF', build: '#22d3ee', gate: '#a78bfa', operate: '#10b981' };
const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function money(n) { return '$' + (n >= 1000 ? Math.round(n / 100) / 10 + 'k' : String(Math.round(n))); }
function band([lo, hi]) { return money(lo) + '–' + money(hi); }
function trackColor(t) { return TRACK_COLOR[t] || '#8E8882'; }
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* ── anonymous prospect tracking: fire-and-forget, never affects the UI ──
   A missing/failing /api/scope endpoint (static hosting, no env configured)
   must never log a console error or block any interaction. */
function prospectId() {
  try {
    let pid = localStorage.getItem('scope_pid');
    if (!pid) {
      pid = (crypto.randomUUID && crypto.randomUUID()) || (Date.now().toString(36) + Math.random().toString(36).slice(2));
      localStorage.setItem('scope_pid', pid);
    }
    return pid;
  } catch {
    return null; // localStorage unavailable (private mode, quota) — tracking is best-effort only
  }
}

function track(type, extra) {
  try {
    const pid = prospectId();
    if (!pid) return;
    fetch('/api/scope', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospectId: pid, type, ...extra }),
    }).catch(() => {}); // network failure — swallow, never surface to the UI
  } catch {
    // fetch/JSON unavailable or threw synchronously — tracking must never break the tool
  }
}

/* ── the signature: a live-assembling system blueprint ── */
function buildBlueprint(plan) {
  const W = 480;
  const hasGate = plan.phases.some((p) => p.phase === 'gate');
  const cols = plan.phases; // ordered audit→build→gate→operate
  const perSide = Math.ceil(Math.max(...cols.map((c) => c.items.length), 1) / 2);
  const H = Math.max(220, 150 + perSide * 34);
  const midY = H / 2;
  const x0 = 46, x1 = W - 46;
  const colX = cols.length === 1 ? [(x0 + x1) / 2] : cols.map((_, i) => x0 + 92 + (i * (x1 - x0 - 184)) / Math.max(cols.length - 1, 1));

  const NS = 'http://www.w3.org/2000/svg';
  const parts = [];
  // rail
  parts.push(`<line x1="${x0}" y1="${midY}" x2="${x1}" y2="${midY}" stroke="#2A2826" stroke-width="1.5" stroke-linecap="round"/>`);
  // capability nodes branch off phase stations
  let delay = 0;
  cols.forEach((col, ci) => {
    const sx = colX[ci];
    parts.push(`<circle cx="${sx}" cy="${midY}" r="3" fill="${PHASE_COLOR[col.phase]}" class="bp-station"/>`);
    parts.push(`<text x="${sx}" y="${midY + 24}" text-anchor="middle" class="bp-phase" fill="${PHASE_COLOR[col.phase]}">${esc(col.label).toUpperCase()}</text>`);
    col.items.forEach((it, k) => {
      const up = k % 2 === 0;
      const tier = Math.floor(k / 2);
      const ny = midY + (up ? -1 : 1) * (46 + tier * 34);
      const c = trackColor(it.track);
      const d = (delay += 55);
      parts.push(`<line x1="${sx}" y1="${midY}" x2="${sx}" y2="${ny}" stroke="${c}" stroke-opacity="0.4" stroke-width="1.25" class="bp-edge" style="--d:${d}ms"/>`);
      parts.push(`<g class="bp-node" style="--d:${d}ms">
        <circle cx="${sx}" cy="${ny}" r="11" fill="none" stroke="${c}" stroke-opacity="0.28" class="bp-halo"/>
        <circle cx="${sx}" cy="${ny}" r="5" fill="${c}"/>
        <text x="${sx}" y="${ny + (up ? -16 : 22)}" text-anchor="middle" class="bp-label" fill="#C4BFB8">${esc(it.name)}</text>
      </g>`);
    });
  });
  // start + verdict
  parts.push(`<g class="bp-node" style="--d:0ms"><circle cx="${x0}" cy="${midY}" r="6" fill="#F4F2EF"/><text x="${x0}" y="${midY - 16}" text-anchor="middle" class="bp-cap" fill="#8E8882">YOUR BUILD</text></g>`);
  const vc = hasGate ? '#10b981' : '#8E8882';
  const vlabel = hasGate ? 'PROVEN' : 'SHIPPED';
  parts.push(`<g class="bp-node bp-verdict${hasGate ? ' on' : ''}" style="--d:${delay + 120}ms">
    <circle cx="${x1}" cy="${midY}" r="12" fill="none" stroke="${vc}" stroke-opacity="0.35" class="bp-halo"/>
    <circle cx="${x1}" cy="${midY}" r="6" fill="${vc}"/>
    <text x="${x1}" y="${midY - 18}" text-anchor="middle" class="bp-cap" fill="${vc}">${vlabel}</text>
  </g>`);
  const packet = REDUCED ? '' : `<circle r="3.5" fill="#22d3ee" class="bp-packet"><animate attributeName="cx" from="${x0}" to="${x1}" dur="3.2s" repeatCount="indefinite"/><animate attributeName="cy" values="${midY};${midY}" dur="3.2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;1;0" dur="3.2s" repeatCount="indefinite"/></circle>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="A live diagram of your scoped system: ${plan.count} components across ${cols.length} phases, ${hasGate ? 'with an evaluation gate that proves it works' : 'ready to ship'}." style="display:block;width:100%;height:auto;overflow:visible">${parts.join('')}${packet}</svg>`;
}

/* ── count-up on the total band ── */
let lastLo = 0, lastHi = 0, rafId = 0;
function animateTotal(el, toLo, toHi) {
  if (REDUCED) { el.textContent = band([toLo, toHi]); lastLo = toLo; lastHi = toHi; return; }
  cancelAnimationFrame(rafId);
  const fromLo = lastLo, fromHi = lastHi, t0 = performance.now(), dur = 520;
  function step(now) {
    const p = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = band([Math.round(fromLo + (toLo - fromLo) * e), Math.round(fromHi + (toHi - fromHi) * e)]);
    if (p < 1) rafId = requestAnimationFrame(step); else { lastLo = toLo; lastHi = toHi; }
  }
  rafId = requestAnimationFrame(step);
}

window.__renderScopePlan = function (plan) {
  const bp = document.getElementById('scope-blueprint');
  const hud = document.getElementById('scope-hud');
  const mount = document.getElementById('scope-plan');
  if (!mount) return;

  if (!plan.count) {
    if (bp) bp.innerHTML = `<div class="bp-empty"><span class="bp-seed"></span><p>Your system builds here.<br><span>Pick what you want to happen — watch it assemble, priced and proven.</span></p></div>`;
    if (hud) hud.innerHTML = '';
    mount.innerHTML = '';
    lastLo = lastHi = 0;
    return;
  }

  if (bp) bp.innerHTML = buildBlueprint(plan);

  if (hud) {
    hud.innerHTML = `
      <div class="hud-row">
        <div class="hud-stat"><span class="hud-num" data-track="green" id="scope-total-num">${band(plan.totalBand)}</span><span class="hud-lbl">indicative range</span></div>
        <div class="hud-stat"><span class="hud-num sm">${plan.count}</span><span class="hud-lbl">components</span></div>
        <div class="hud-stat"><span class="hud-num sm">~${plan.timelineWeeks[0]}–${plan.timelineWeeks[1]}<span class="hud-u">wks</span></span><span class="hud-lbl">timeline</span></div>
      </div>
      <div class="hud-bar" aria-hidden="true">${plan.phases.map((p) => `<span style="flex:${p.items.length};background:${PHASE_COLOR[p.phase]}"></span>`).join('')}</div>`;
    const num = document.getElementById('scope-total-num');
    if (num) animateTotal(num, plan.totalBand[0], plan.totalBand[1]);
  }

  const phaseCards = plan.phases.map((p) => `
    <div class="plan-phase">
      <div class="plan-phase-h" style="color:${PHASE_COLOR[p.phase]}"><span class="pp-dot" style="background:${PHASE_COLOR[p.phase]}"></span>${esc(p.label)} <span class="pp-band">${band(p.band)}</span></div>
      ${p.items.map((i) => `
        <div class="plan-item" style="--tc:${trackColor(i.track)}">
          <div class="pi-main"><div class="pi-name">${esc(i.name)}</div><div class="pi-why">${esc(i.why)}</div></div>
          <div class="pi-price">${band(i.band)}<span class="pi-eff">${esc(i.effort)}</span></div>
        </div>`).join('')}
    </div>`).join('');

  // #scope-total kept for the smoke test (contains "$" and "indicative")
  mount.innerHTML = `
    <div class="plan-card">
      ${phaseCards}
      <div id="scope-total" class="plan-total">
        <span class="pt-num">${band(plan.totalBand)}</span>
        <span class="pt-lbl">indicative range · exact scope on a call</span>
      </div>
    </div>`;
};

/* ─────────────────────────── controller ─────────────────────────── */
const root = document.getElementById('scope-root');
const qMount = document.getElementById('scope-questions');
const planMount = document.getElementById('scope-plan');
const disc = document.getElementById('scope-disclaimer');

function optionColor(o) {
  const k = (o.keys || [])[0];
  const card = k && CARD_BY_KEY.get(k);
  return card ? trackColor(card.track) : '#22d3ee';
}

if (root && qMount && planMount && disc) {
  disc.textContent = DISCLAIMER;
  const answers = {};
  let planTrackTimer = 0;
  track('started');
  renderQuestions();
  rehydrateFromUrl();
  renderPlan();

  function renderQuestions() {
    qMount.innerHTML = QUESTIONS.map((q, qi) => `
      <fieldset class="scope-q" style="--qd:${qi * 70}ms">
        <legend>${esc(q.prompt)}</legend>
        <div class="scope-opts">
          ${q.options.map((o) => `<button type="button" class="scope-opt" data-q="${q.id}" data-id="${o.id}" data-multi="${q.multi}" aria-pressed="false" style="--tc:${optionColor(o)}">${esc(o.label)}</button>`).join('')}
        </div>
      </fieldset>`).join('');
    qMount.querySelectorAll('.scope-opt').forEach((btn) => btn.addEventListener('click', onPick));
  }

  function onPick(e) {
    const b = e.currentTarget;
    const q = b.dataset.q;
    const id = b.dataset.id;
    const multi = b.dataset.multi === 'true';
    answers[q] = answers[q] || [];
    if (multi) {
      const i = answers[q].indexOf(id);
      if (i >= 0) answers[q].splice(i, 1);
      else answers[q].push(id);
    } else {
      answers[q] = answers[q][0] === id ? [] : [id];
      qMount.querySelectorAll(`.scope-opt[data-q="${q}"]`).forEach((x) => setPressed(x, false));
    }
    setPressed(b, answers[q].includes(id));
    renderPlan();
  }

  function setPressed(btn, on) {
    btn.setAttribute('aria-pressed', String(on));
    btn.classList.toggle('is-on', on);
  }

  function segmentFromAnswers() {
    const s = (answers.segment || [])[0];
    return { 'seg-service': 'service-business', 'seg-aiproduct': 'ai-product', 'seg-ops': 'ops-automation', 'seg-product': 'product-build' }[s] || null;
  }

  function renderPlan() {
    const keys = keysFromAnswers(answers);
    const segment = segmentFromAnswers();
    const plan = computePlan(keys, segment);
    window.__renderScopePlan(plan);
    syncUrl();
    root.setAttribute('data-state', keys.length ? 'plan' : 'discovery');
    updateHandoff(plan);
    if (keys.length) {
      clearTimeout(planTrackTimer);
      planTrackTimer = setTimeout(() => {
        track('plan_built', { plan: { keys, segment, total: plan.totalBand } });
      }, 600);
    }
  }

  function planSummaryText(plan) {
    const lines = plan.items.map((i) => `• ${i.name} · ${band(i.band)} (${i.effort})`);
    return `Here's the plan I scoped on your site:\n\n${lines.join('\n')}\n\nIndicative total: ${band(plan.totalBand)} · ~${plan.timelineWeeks[0]}–${plan.timelineWeeks[1]} weeks\n(Indicative only. Happy to lock exact scope on a call.)\n\nShared plan: ${location.href}`;
  }

  function updateHandoff(plan) {
    const email = document.getElementById('scope-email');
    if (email) {
      const subj = encodeURIComponent('My scoped plan · via the site');
      const body = encodeURIComponent(plan.count ? planSummaryText(plan) : 'I started scoping on your site and want to talk.');
      email.setAttribute('href', `mailto:hello@sageideas.dev?subject=${subj}&body=${body}`);
      if (!email.dataset.wired) {
        email.dataset.wired = '1';
        email.addEventListener('click', () => track('handoff_clicked', { meta: { kind: 'email' } }));
      }
    }
    const copy = document.getElementById('scope-copy');
    if (copy && !copy.dataset.wired) {
      copy.dataset.wired = '1';
      copy.addEventListener('click', async () => {
        track('handoff_clicked', { meta: { kind: 'copy' } });
        try {
          await navigator.clipboard.writeText(location.href);
          copy.textContent = 'Copied';
          setTimeout(() => { copy.textContent = 'Copy shareable link'; }, 1600);
        } catch {
          // Clipboard API unavailable (e.g. insecure context) — link is still visible to copy manually.
        }
      });
    }
  }

  function selectedOptionIds() {
    const ids = [];
    QUESTIONS.forEach((q) => (answers[q.id] || []).forEach((id) => ids.push(id)));
    return ids;
  }

  function syncUrl() {
    const ids = selectedOptionIds();
    const enc = ids.length ? '#plan=' + encodeKeys(ids) : location.pathname;
    history.replaceState(null, '', enc);
  }

  function rehydrateFromUrl() {
    const m = location.hash.match(/plan=([^&]+)/);
    if (!m) return;
    const { keys: ids } = decodeKeys(m[1]); // these are option ids
    const idSet = new Set(ids);
    QUESTIONS.forEach((q) => q.options.forEach((o) => {
      if (idSet.has(o.id)) {
        answers[q.id] = answers[q.id] || [];
        if (!answers[q.id].includes(o.id)) answers[q.id].push(o.id);
        const btn = qMount.querySelector(`.scope-opt[data-q="${q.id}"][data-id="${o.id}"]`);
        if (btn) setPressed(btn, true);
      }
    }));
  }
}
