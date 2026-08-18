// Scope Studio page controller — offline question flow + plan-key derivation.
// Renders questions, tracks answers, and rehydrates from a shared URL.
// The actual plan visualization is installed by Task 6 via window.__renderScopePlan.

const PHASE_COLOR = { audit: '#8FA0FF', build: '#22d3ee', gate: '#a78bfa', operate: '#10b981' };
function money(n) { return '$' + (n >= 1000 ? Math.round(n / 100) / 10 + 'k' : String(n)); }
function band([lo, hi]) { return money(lo) + '–' + money(hi); }

window.__renderScopePlan = function (plan) {
  const mount = document.getElementById('scope-plan');
  if (!mount) return;
  if (!plan.count) {
    mount.innerHTML = '<div style="border:1px dashed #2A2826;border-radius:12px;padding:28px;color:#8E8882;font-family:\'JetBrains Mono\',monospace;font-size:12.5px">Pick what you want to happen — your plan builds here as you go.</div>';
    return;
  }
  const phases = plan.phases.map(p => `
    <div style="margin-top:18px">
      <div style="font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:0.12em;text-transform:uppercase;color:${PHASE_COLOR[p.phase]};margin-bottom:8px">${p.label} · ${band(p.band)}</div>
      ${p.items.map(i => `
        <div style="display:flex;justify-content:space-between;gap:14px;border-top:1px solid #211F1C;padding:11px 0">
          <div><div style="color:#F4F2EF;font-size:14px">${i.name}</div><div style="color:#8E8882;font-size:12px;line-height:1.5">${i.why}</div></div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#A8A29E;white-space:nowrap;text-align:right">${band(i.band)}<br><span style="color:#8E8882">${i.effort}</span></div>
        </div>`).join('')}
    </div>`).join('');
  mount.innerHTML = `
    <div style="border:1px solid #2A2826;border-radius:14px;padding:22px;background:#0C0C0E">
      <div style="font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:0.12em;text-transform:uppercase;color:#8E8882">your plan · ${plan.count} pieces · ~${plan.timelineWeeks[0]}–${plan.timelineWeeks[1]} wks</div>
      ${phases}
      <div id="scope-total" style="margin-top:20px;border-top:1px solid #2A2826;padding-top:16px;display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px">
        <span style="font-family:'Instrument Serif',Georgia,serif;font-size:clamp(1.4rem,2.4vw,2rem);color:#10b981">${band(plan.totalBand)}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#8E8882">indicative range · exact scope on a call</span>
      </div>
    </div>`;
};

import { QUESTIONS, keysFromAnswers, computePlan, encodeKeys, decodeKeys, DISCLAIMER } from './scope-core.mjs';

const root = document.getElementById('scope-root');
const qMount = document.getElementById('scope-questions');
const planMount = document.getElementById('scope-plan');
const disc = document.getElementById('scope-disclaimer');

if (root && qMount && planMount && disc) {
  disc.textContent = DISCLAIMER;
  const answers = {};
  renderQuestions();
  rehydrateFromUrl();
  renderPlan();

  function renderQuestions() {
    qMount.innerHTML = QUESTIONS.map((q) => `
      <fieldset style="border:1px solid #2A2826;border-radius:12px;padding:18px 20px;margin:0 0 16px">
        <legend style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#8E8882;padding:0 6px">${q.prompt}</legend>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
          ${q.options.map((o) => `<button type="button" class="scope-opt" data-q="${q.id}" data-id="${o.id}" data-multi="${q.multi}" aria-pressed="false" style="font-family:'JetBrains Mono',monospace;font-size:12.5px;color:#A8A29E;border:1px solid #2A2826;border-radius:999px;padding:7px 13px;background:transparent;cursor:pointer">${o.label}</button>`).join('')}
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
    btn.style.color = on ? '#09090B' : '#A8A29E';
    btn.style.background = on ? '#22d3ee' : 'transparent';
    btn.style.borderColor = on ? '#22d3ee' : '#2A2826';
  }

  function segmentFromAnswers() {
    const s = (answers.segment || [])[0];
    return { 'seg-service': 'service-business', 'seg-aiproduct': 'ai-product', 'seg-ops': 'ops-automation', 'seg-product': 'product-build' }[s] || null;
  }

  function renderPlan() {
    const keys = keysFromAnswers(answers);
    const plan = computePlan(keys, segmentFromAnswers());
    window.__renderScopePlan(plan);
    syncUrl();
    root.setAttribute('data-state', keys.length ? 'plan' : 'discovery');
    updateHandoff(plan);
  }

  function planSummaryText(plan) {
    const lines = plan.items.map((i) => `• ${i.name} — ${band(i.band)} (${i.effort})`);
    return `Here's the plan I scoped on your site:\n\n${lines.join('\n')}\n\nIndicative total: ${band(plan.totalBand)} · ~${plan.timelineWeeks[0]}–${plan.timelineWeeks[1]} weeks\n(Indicative only — happy to lock exact scope on a call.)\n\nShared plan: ${location.href}`;
  }

  function updateHandoff(plan) {
    const email = document.getElementById('scope-email');
    if (email) {
      const subj = encodeURIComponent('My scoped plan — via the site');
      const body = encodeURIComponent(plan.count ? planSummaryText(plan) : 'I started scoping on your site and want to talk.');
      email.setAttribute('href', `mailto:hello@sageideas.dev?subject=${subj}&body=${body}`);
    }
    const copy = document.getElementById('scope-copy');
    if (copy && !copy.dataset.wired) {
      copy.dataset.wired = '1';
      copy.addEventListener('click', async () => {
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
